'use strict';
/* v89.141：96h（4 游戏天 · 1×）试玩留存分析 —— 读 snapshots.jsonl + run.log 出报告
   跑法：node .workbuddy/tools/playtest/analyze_v89141_96h.js */
var fs = require('fs'), path = require('path');
var DIR = 'E:/Deepseekdb/.workbuddy/tmp/playtest600/v89141_96h/';

var snaps = fs.readFileSync(path.join(DIR, 'snapshots.jsonl'), 'utf8')
  .trim().split('\n').map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } })
  .filter(Boolean);
var log = fs.readFileSync(path.join(DIR, 'run.log'), 'utf8').split('\n');

function fmt(n) {
  n = Number(n) || 0;
  if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + '亿';
  if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(2) + '万';
  return String(Math.round(n));
}
function gmStr(t) {   /* 游戏小时 → "第X天Y时" */
  var h = t / 3600;
  return 'D' + Math.floor(h / 24) + '+' + Math.round(h % 24) + 'h';
}

console.log('===== ① 24 快照全表（每 4 游戏小时） =====');
console.log('时间     城  军   旧币     净水      生物质     电能      废钢    幸存者/上限  科技  任务  爵位');
snaps.forEach(function (s) {
  console.log(
    pad(gmStr(s.t), 8) + pad(s.cities, 3) + pad(s.army, 4) + pad(fmt(s.res.gold), 7) +
    pad(fmt(s.res.grain), 8) + pad(fmt(s.res.wood), 7) + pad(fmt(s.res.stone), 8) +
    pad(fmt(s.res.iron), 8) + pad(s.pop + '/' + s.popCap, 10) +
    pad(s.techSum, 5) + pad(s.qDone, 5) + pad(s.rep, 6));
});

console.log('\n===== ② 分段资源净增（每 4h 一段） =====');
console.log('时段       木净增/时   石净增/时   铁净增/时   粮净增/时   旧币净增/时');
for (var i = 1; i < snaps.length; i++) {
  var a = snaps[i - 1], b = snaps[i], h = (b.t - a.t) / 3600;
  console.log(pad(gmStr(b.t), 10) +
    pad(((b.res.wood - a.res.wood) / h).toFixed(1), 11) +
    pad(((b.res.stone - a.res.stone) / h).toFixed(1), 11) +
    pad(((b.res.iron - a.res.iron) / h).toFixed(1), 11) +
    pad(((b.res.grain - a.res.grain) / h).toFixed(1), 11) +
    pad(((b.res.gold - a.res.gold) / h).toFixed(1), 11));
}

console.log('\n===== ③ 建筑/地块/科技进度（首末对照） =====');
var f = snaps[0], l = snaps[snaps.length - 1];
console.log('  城内建筑：' + JSON.stringify(f.bl) + '\n        → ' + JSON.stringify(l.bl));
console.log('  城外地块：' + JSON.stringify(f.ext) + '\n        → ' + JSON.stringify(l.ext));
console.log('  科技：' + JSON.stringify(f.tech) + '（合 ' + f.techSum + '）→ ' +
  JSON.stringify(l.tech) + '（合 ' + l.techSum + '）');
console.log('  围墙：' + JSON.stringify(f.wall) + ' → ' + JSON.stringify(l.wall));

console.log('\n===== ④ 卡点统计（软失败按类型） =====');
var soft = {};
log.forEach(function (line) {
  var m = line.match(/·\s+([a-zA-Z.]+)：(.+?)（第(\d+)次）$/);
  if (!m) return;
  var kind = m[1], msg = m[2].replace(/（第\d+次）/, ''), n = Number(m[3]);
  var key = kind + ' | ' + msg.slice(0, 42);
  if (!soft[key] || soft[key].n < n) soft[key] = { n: n, kind: kind, msg: msg };
});
var arr = Object.keys(soft).map(function (k) { return soft[k]; })
  .sort(function (a, b) { return b.n - a.n; });
arr.slice(0, 14).forEach(function (o) {
  console.log('  ' + pad(String(o.n), 6) + ' × ' + o.kind + '：' + o.msg.slice(0, 56));
});

console.log('\n===== ⑤ 里程碑时间线 =====');
var marks = [];
log.forEach(function (line) {
  var t = line.match(/\+(\d+)min\]\s+(.*)$/);
  if (!t) return;
  var min = Number(t[1]), body = t[2];
  if (/🏗 开建|🎉|晋升|爵|建城|🧱|出征|掠夺|占领|战报|首次|招募到|招贤/.test(body)
    && !/（第\d+次）/.test(body)) marks.push({ min: min, body: body });
});
var seen = {};
marks.forEach(function (m) {
  var k = m.body.slice(0, 30);
  if (seen[k]) return; seen[k] = 1;
  console.log('  [+' + (m.min / 60).toFixed(1) + 'h] ' + m.body.slice(0, 96));
});

console.log('\n===== ⑥ 90 分钟留存体检（前 1.5 游戏小时能不能留住人） =====');
var early = log.filter(function (l) {
  var t = l.match(/\+(\d+)min\]/);
  return t && Number(t[1]) <= 90;
});
var kinds = { build: 0, train: 0, quest: 0, market: 0, gather: 0, other: 0 };
early.forEach(function (l) {
  if (/🏗|开建|建成|完工/.test(l)) kinds.build++;
  else if (/募兵|征兵|训练/.test(l)) kinds.train++;
  else if (/任务|quest/i.test(l)) kinds.quest++;
  else if (/市场|卖出|买入/.test(l)) kinds.market++;
  else if (/采集|收获/.test(l)) kinds.gather++;
});
console.log('  前 90 分钟日志构成：' + JSON.stringify(kinds));

console.log('\n===== ⑦ 终态 =====');
console.log('  ' + (function () {
  var fs2 = fs.readFileSync(path.join(DIR, 'rush_final.json'), 'utf8');
  return fs2;
})());

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
