/* v89.100 三跑对照分析器：econ（纯经济）/ loot（战利品变现）/ rushG（军事基准）
   输出：digest_v89100.md */
var fs = require('fs');
var path = require('path');
var BASE = 'E:/Deepseekdb/.workbuddy/tmp/playtest600/';
var out = [];
function ap(s) { out.push(s); }

function readJson(tag, f) {
  try { return JSON.parse(fs.readFileSync(BASE + tag + '/' + f, 'utf8')); } catch (e) { return null; }
}
function readLines(tag, f) {
  try { return fs.readFileSync(BASE + tag + '/' + f, 'utf8').split('\n').filter(Boolean); } catch (e) { return []; }
}
function readSnaps(tag) {
  return readLines(tag, 'snapshots.jsonl').map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
function fmt(v) { v = Number(v) || 0; if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'; if (v >= 1e4) return (v / 1e4).toFixed(1) + '万'; return String(Math.round(v)); }
function blSum(bl) { var s = 0; for (var k in (bl || {})) s += bl[k] || 0; return s; }

var TAGS = [['econ_1x', 'econ（纯经济）'], ['loot_1x', 'loot（战利品变现）'], ['rushG_1x', 'rush（军事基准）']];
var D = {};
TAGS.forEach(function (p) {
  var tag = p[0];
  var rf = readJson(tag, 'rush_final.json');
  var gf = readJson(tag, 'gold_final.json');
  var snaps = readSnaps(tag);
  var last = snaps.length ? snaps[snaps.length - 1] : null;
  var log = readLines(tag, 'run.log');
  var errs = readJson(tag, 'errors.json') || [];
  D[tag] = { rf: rf, gf: gf, snaps: snaps, last: last, log: log, errs: errs.length };
});

ap('# v89.100 三跑对照：纯经济（econ）/ 战利品变现（loot）/ 军事基准（rush）');
ap('');
ap('同 seed 20260922 · 同 18.75 游戏年（1× 300 现实小时）· 同一推演脑。');
ap('');

/* ================= 1. 终局对照 ================= */
ap('## 1. 终局对照');
ap('');
ap('| 指标 | econ（纯经济） | loot（战利品变现） | rush（基准） |');
ap('|---|---|---|---|');
function row(name, fn) {
  var cells = TAGS.map(function (p) { try { return fn(D[p[0]], p[0]); } catch (e) { return '?'; } });
  ap('| ' + name + ' | ' + cells.join(' | ') + ' |');
}
row('城池数', function (d) { return d.last ? d.last.cities : '?'; });
row('军力', function (d) { return d.last ? fmt(d.last.army) : '?'; });
row('建筑等级和', function (d) { return d.last ? blSum(d.last.bl) : '?'; });
row('人口', function (d) { return d.last ? fmt(d.last.pop) + '/' + fmt(d.last.popCap) : '?'; });
row('粮（终局）', function (d) { return d.last ? fmt((d.last.res || {}).grain) : '?'; });
row('金（终局）', function (d) { return d.last ? fmt((d.last.res || {}).gold) : '?'; });
row('累计套现（卖资源）', function (d) { return d.gf ? fmt(d.gf.gold.sold) + ' / ' + d.gf.gold.sales + ' 笔' : '?'; });
row('经验书（本）', function (d) { return d.gf ? (d.gf.gold.books || 0) : '?'; });
row('爵位档位（0=平民）', function (d) { return d.rf ? d.rf.rank : '?'; });
row('声望', function (d) { return d.rf ? fmt(d.rf.rep) : '?'; });
row('顶将等级', function (d) {
  var m = 0; ((d.gf && d.gf.gens) || []).forEach(function (g) { if ((g.lv || 0) > m) m = g.lv; });
  return m ? ('Lv' + m) : '?';
});
row('将领数', function (d) { return d.gf ? d.gf.gens.length : '?'; });
row('寄售总金（v89.100 新）', function (d) {
  if (!d.rf || !d.rf.rush || !d.rf.rush.consign) return '—';
  var c = d.rf.rush.consign;
  return fmt(c.gold) + ' / ' + c.pieces + ' 件';
});
row('运行错误', function (d) { return String(d.errs); });
ap('');

/* ================= 2. 三跑的消费结构 ================= */
ap('## 2. 消费结构（gold_final.spends）');
ap('');
ap('| 科目 | econ | loot | rush |');
ap('|---|---|---|---|');
var spendKeys = {};
TAGS.forEach(function (p) {
  var d = D[p[0]];
  if (d.gf && d.gf.gold && d.gf.gold.spends) Object.keys(d.gf.gold.spends).forEach(function (k) { spendKeys[k] = 1; });
});
Object.keys(spendKeys).sort().forEach(function (k) {
  ap('| ' + k + ' | ' + TAGS.map(function (p) {
    var d = D[p[0]];
    return d.gf && d.gf.gold.spends[k] ? fmt(d.gf.gold.spends[k]) : '0';
  }).join(' | ') + ' |');
});
ap('');

/* ================= 3. 逐年曲线 ================= */
ap('## 3. 逐年曲线（每半游戏年取样）');
ap('');
TAGS.forEach(function (p) {
  var d = D[p[0]];
  ap('### ' + p[1]);
  ap('');
  ap('| 游戏年 | 城 | 军 | 人口 | 建筑和 | 金 |');
  ap('|---|---|---|---|---|---|');
  var rows = d.snaps;
  var step = Math.max(1, Math.floor(rows.length / 38));
  for (var i = 0; i < rows.length; i += step) {
    var r = rows[i];
    ap('| ' + r.y + ' | ' + r.cities + ' | ' + fmt(r.army) + ' | ' + fmt(r.pop) + ' | ' + blSum(r.bl) + ' | ' + fmt((r.res || {}).gold) + ' |');
  }
  ap('');
});

/* ================= 4. 关键事件 ================= */
ap('## 4. 关键事件（各跑日志摘要）');
ap('');
TAGS.forEach(function (p) {
  var d = D[p[0]];
  ap('### ' + p[1]);
  ap('');
  var hits = d.log.filter(function (l) { return /晋爵|爵位|阶段切换|书|领主|Lv140|Lv100|Lv2[0-9][0-9]|寄售|统|新增/.test(l) && !/tick/.test(l); });
  var pick = hits.filter(function (l) { return /书|爵|Lv1|Lv2|寄售|阶段/.test(l); }).slice(0, 20);
  pick.forEach(function (l) { ap('- ' + l.slice(11, 200)); });
  if (!pick.length) ap('- （无关键事件）');
  ap('');
});

/* ================= 5. 寄售明细（loot） ================= */
ap('## 5. loot：寄售经济明细');
ap('');
(function () {
  var d = D['loot_1x'];
  if (!d.rf || !d.rf.rush || !d.rf.rush.consign) { ap('（无寄售数据）'); return; }
  var c = d.rf.rush.consign;
  ap('- 寄售总金：' + fmt(c.gold) + ' 金 · ' + c.kinds + ' 种 / ' + c.pieces + ' 件 · ' + c.runs + ' 轮');
  ap('- 首售时间：tick ' + c.tFirst + '（游戏年第 ' + (c.tFirst * 1 / 57600).toFixed(2) + ' 年）');
  /* 寄售 vs 卖资源：金收入结构 */
  if (d.gf) {
    var sold = d.gf.gold.sold || 0;
    ap('- 对照：卖资源（市场）累计 ' + fmt(sold) + ' 金 → 寄售相当于其 ' + Math.round(c.gold / Math.max(1, sold) * 100) + '%');
  }
  /* 寄售相关日志样本 */
  var cs = d.log.filter(function (l) { return /loot\.consign/.test(l); });
  ap('- 寄售轮次样本（首 3 / 尾 3）：');
  cs.slice(0, 3).concat(cs.slice(-3)).forEach(function (l) { ap('  - ' + l.slice(11, 180)); });
})();
ap('');

fs.writeFileSync(BASE + 'digest_v89100.md', out.join('\n'), 'utf8');
console.log('written digest_v89100.md (' + out.length + ' lines)');
