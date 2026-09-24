/* v89.100 批量对照：4 seed × 3 模式（rush / loot / lootx）
   —— 单 seed 有混沌式路径依赖（军力可差 4~7 倍），必须多 seed 统计。
   输出：batch_v89100.md */
var fs = require('fs');
var cp = require('child_process');
var BASE = 'E:/Deepseekdb/';

var SEEDS = [20260922, 20260923, 20260924, 20260925];
var MODES = ['rush', 'loot', 'lootx'];
var rows = [];

function runOne(seed, mode) {
  var tag = 'b' + seed + '_' + mode;
  var dir = BASE + '.workbuddy/tmp/playtest600/' + tag;
  if (!fs.existsSync(dir + '/rush_final.json')) {
    var t0 = Date.now();
    cp.execFileSync('node', [BASE + '.workbuddy/tools/playtest/play_rush_1x.js', '1080000', tag, mode, '1', String(seed)], { cwd: BASE, stdio: 'ignore' });
    console.log('  ran ' + tag + ' in ' + Math.round((Date.now() - t0) / 1000) + 's');
  } else {
    console.log('  reuse ' + tag);
  }
  var rf = JSON.parse(fs.readFileSync(dir + '/rush_final.json', 'utf8'));
  var gf = JSON.parse(fs.readFileSync(dir + '/gold_final.json', 'utf8'));
  var snaps = fs.readFileSync(dir + '/snapshots.jsonl', 'utf8').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
  var last = snaps[snaps.length - 1];
  var bl = 0; for (var k in (last.bl || {})) bl += last.bl[k];
  var top = 0; (gf.gens || []).forEach(function (x) { if ((x.lv || 0) > top) top = x.lv; });
  var errs = JSON.parse(fs.readFileSync(dir + '/errors.json', 'utf8')).length;
  rows.push({
    seed: seed, mode: mode, cities: last.cities, army: Math.round(last.army), bl: bl,
    gold: Math.round(last.res.gold), pop: Math.round(last.pop), topLv: top,
    books: gf.gold.books || 0, sold: gf.gold.sold || 0, sales: gf.gold.sales || 0,
    consign: (rf.rush && rf.rush.consign) ? rf.rush.consign.gold : 0,
    consignPieces: (rf.rush && rf.rush.consign) ? rf.rush.consign.pieces : 0,
    rank: rf.rank, sieWin: rf.rush.sieWin, errs: errs
  });
}

SEEDS.forEach(function (s) {
  console.log('seed ' + s + ':');
  MODES.forEach(function (m) { runOne(s, m); });
});

/* 汇总 */
var out = [];
function ap(x) { out.push(x); }
ap('# v89.100 批量对照（4 seed × rush / loot / lootx）');
ap('');
ap('| seed | 模式 | 城 | 军力 | 建筑和 | 金 | 顶将 | 书 | 卖资源 | 寄售 | 爵 | 攻胜 | 错 |');
ap('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
rows.forEach(function (r) {
  ap('| ' + r.seed + ' | ' + r.mode + ' | ' + r.cities + ' | ' + r.army + ' | ' + r.bl + ' | ' + r.gold
    + ' | ' + r.topLv + ' | ' + r.books + ' | ' + r.sold + ' | ' + (r.mode === 'loot' ? r.consign : '—')
    + ' | ' + r.rank + ' | ' + (r.sieWin || 0) + ' | ' + r.errs + ' |');
});
ap('');

function avg(mode, key) {
  var v = rows.filter(function (r) { return r.mode === mode; });
  if (!v.length) return 0;
  return v.reduce(function (a, b) { return a + b[key]; }, 0) / v.length;
}
ap('## 均值对照');
ap('');
ap('| 指标 | rush | loot（真卖） | lootx（空转） | loot / lootx |');
ap('|---|---|---|---|---|');
[['army', '军力'], ['cities', '城池'], ['bl', '建筑和'], ['topLv', '顶将等级'], ['books', '经验书'], ['sold', '卖资源金'], ['gold', '终局金']].forEach(function (p) {
  var a = avg('rush', p[0]), b = avg('loot', p[0]), c = avg('lootx', p[0]);
  var ratio = c > 0 ? (b / c).toFixed(2) : '—';
  ap('| ' + p[1] + ' | ' + Math.round(a * 10) / 10 + ' | ' + Math.round(b * 10) / 10 + ' | ' + Math.round(c * 10) / 10 + ' | **' + ratio + '** |');
});
ap('');
ap('## 配对对比（loot − lootx，同 seed）');
ap('');
ap('| seed | 军力 loot | 军力 lootx | Δ军力 | 寄售金 | 书 loot/lootx |');
ap('|---|---|---|---|---|---|');
SEEDS.forEach(function (s) {
  var l = rows.filter(function (r) { return r.seed === s && r.mode === 'loot'; })[0];
  var x = rows.filter(function (r) { return r.seed === s && r.mode === 'lootx'; })[0];
  if (!l || !x) return;
  ap('| ' + s + ' | ' + l.army + ' | ' + x.army + ' | ' + (l.army - x.army >= 0 ? '+' : '') + (l.army - x.army)
    + ' | ' + l.consign + ' | ' + l.books + ' / ' + x.books + ' |');
});

fs.writeFileSync(BASE + '.workbuddy/tmp/playtest600/batch_v89100.md', out.join('\n'), 'utf8');
console.log('DONE, digest written');
