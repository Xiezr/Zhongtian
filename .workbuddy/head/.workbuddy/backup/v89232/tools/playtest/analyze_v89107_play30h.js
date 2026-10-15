/* ============================================================
 * analyze_v89107_play30h.js — 600× × 30 现实小时试玩的评测提取
 * 数据：.workbuddy/tmp/playtest600/<tag>/（snapshots / battles / events / run.log）
 * 产出：控制台摘要 + digest_v89107.md 片段
 * 用法：node .workbuddy/tools/playtest/analyze_v89107_play30h.js <tag>
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var TAG = process.argv[2] || 'v89107_600x30h';
var D = path.join(R, '.workbuddy/tmp/playtest600', TAG);
if (!fs.existsSync(D)) { console.log('无此目录：' + D); process.exit(1); }

function jsonl(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(function (l) {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
}
function fmt(v) {
  v = Number(v) || 0;
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return String(Math.round(v));
}
var snaps = jsonl(path.join(D, 'snapshots.jsonl'));
var btl = jsonl(path.join(D, 'battles.jsonl'));
var ev = jsonl(path.join(D, 'events.jsonl'));
var log = fs.existsSync(path.join(D, 'run.log')) ? fs.readFileSync(path.join(D, 'run.log'), 'utf8') : '';
var final = fs.existsSync(path.join(D, 'final_state.json'))
  ? JSON.parse(fs.readFileSync(path.join(D, 'final_state.json'), 'utf8')) : null;
var ckDir = path.join(D, 'checkpoints');
var cks = fs.existsSync(ckDir) ? fs.readdirSync(ckDir).sort() : [];

console.log('===== 600× × 30h 试玩评测：' + TAG + ' =====');
console.log('\n—— ① 时间线（抽样）——');
console.log('  快照 ' + snaps.length + ' 帧 · 检查点 ' + cks.length + ' 个 · 事件 ' + ev.length + ' 条 · 战报 ' + btl.length + ' 条');
var picks = [0, Math.floor(snaps.length * 0.05), Math.floor(snaps.length * 0.2), Math.floor(snaps.length * 0.5),
  Math.floor(snaps.length * 0.8), snaps.length - 1].filter(function (v, i, a) { return v >= 0 && a.indexOf(v) === i; });
picks.forEach(function (i) {
  var s = snaps[i];
  if (!s) return;
  console.log('  第 ' + String(s.year != null ? s.year : i).padStart(6) + ' 年 · 城 ' +
    String(s.cities != null ? s.cities : '?').padStart(3) + ' · 军 ' + String(fmt(s.army)).padStart(8) +
    ' · 金 ' + String(fmt(s.gold)).padStart(9) + ' · 将 ' + String(s.generals != null ? s.generals : '?').padStart(4) +
    ' · 民心 ' + (s.hearts != null ? Math.round(s.hearts) : '?'));
});

console.log('\n—— ② 战斗 ——');
/* ⚠️ 字段是 `winner`（'atk'/'def'），不是 `win` —— 第一版写成 b.win 得出"胜率 0%"的假数 */
var win = btl.filter(function (b) { return b.winner === 'atk'; }).length;
var lose = btl.filter(function (b) { return b.winner === 'def'; }).length;
console.log('  战报 ' + btl.length + ' 条 · 胜 ' + win + ' · 败 ' + lose +
  '（胜率 ' + (btl.length ? Math.round(win / btl.length * 100) : 0) + '%）');
var rd = btl.reduce(function (t, b) { return t + (b.rounds || 0); }, 0);
var al = btl.reduce(function (t, b) { return t + (b.atkLoss || 0); }, 0);
console.log('  平均回合 ' + (btl.length ? (rd / btl.length).toFixed(1) : 0) +
  ' · 我方累计损兵 ' + fmt(al));
var modeCnt = {};
btl.forEach(function (b) { var k = b.mode || b.kind || '?'; modeCnt[k] = (modeCnt[k] || 0) + 1; });
console.log('  方式分布：' + JSON.stringify(modeCnt));

console.log('\n—— ③ 事件类型 Top（按语义关键词粗分）——');
var KEY = [
  ['烽火/来袭', /烽火|犯境|来犯|击退|攻破城门|空城计|坚壁清野/],
  ['占领/扩张', /占领|建城|新城池|接管|转正/],
  ['行军/调防', /行军|抵达|抵|调防|辎重|召回|驻守/],
  ['招募/将领', /招募|招贤|入我帐下|归降|客栈|贤才/],
  ['建造/升级', /建造|完成|升级|落成|改建|拆除|扩编/],
  ['经济/交易', /市易|售出|购入|得金|税收|开采|收获|采集/],
  ['任务/成就', /任务|奖励|达成|爵位|晋升|改元/],
  ['战斗/战报', /得胜|受挫|撤退|缴械|缴获|损兵|伤兵|俘获/],
  ['其它', /.*/]
];
var cnt = {}, byKind = {};
ev.forEach(function (e) {
  for (var i = 0; i < KEY.length; i++) {
    if (KEY[i][1].test(e.msg)) { cnt[KEY[i][0]] = (cnt[KEY[i][0]] || 0) + 1; break; }
  }
});
Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).forEach(function (k) {
  console.log('  ' + k.padEnd(12) + String(cnt[k]).padStart(7) + ' 条   ' + (cnt[k] / Math.max(1, ev.length) * 100).toFixed(1) + '%');
});

console.log('\n—— ④ 卡住的地方（软失败 Top 12）——');
var soft = {};
log.split('\n').forEach(function (l) {
  var m = l.match(/·\s*([a-zA-Z.]+\S?)：(.*?)（第\d+次）?$/);
  if (!m) return;
  var key = m[1] + '：' + m[2].slice(0, 24);
  soft[key] = (soft[key] || 0) + 1;
});
Object.keys(soft).sort(function (a, b) { return soft[b] - soft[a]; }).slice(0, 12).forEach(function (k) {
  console.log('  ' + String(soft[k]).padStart(5) + '×  ' + k);
});

console.log('\n—— ⑤ 终态 ——');
if (final) {
  var f = final;
  console.log('  ' + JSON.stringify({
    year: f.year, cities: f.cities, army: f.army, gold: f.gold, generals: f.generals,
    hearts: f.hearts, pop: f.pop, rep: f.rep, battles: f.battles, errs: f.errs
  }));
} else {
  console.log('  （无 final_state.json）');
}
var lines = log.split('\n').filter(function (l) { return /错误合计|用时|终态/.test(l); });
lines.slice(-3).forEach(function (l) { console.log('  ' + l.replace(/^\[[^\]]*\]\s*/, '')); });
