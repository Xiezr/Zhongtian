/* v89.197 探针B：据点等级分布（老板 2："5级以上占百分之八十，等级越高比例越高"）
   ① 权重表结构：5级+合计 80% · 1~4级合计 20% · 逐级严格递增
   ② 全图实际采样：逐级占比与权重表一致（构造性配额）
   ③ 次日重掷：配额不靠运气 · 同日确定性
   ④ 旧结构（high/highPct）零残留 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '据点分布探针', region: '司隶' });
if (!G.state.map.grid) G.map.generate();

console.log('══════ ① 权重表结构 ══════');
var W = D.FORT.levelDist && D.FORT.levelDist.weights;
if (!W) { console.log('  ✗ weights 表缺失'); process.exit(1); }
var tot = 0, lv;
for (lv = 1; lv <= 10; lv++) tot += W[lv];
var hi = 0, lo = 0, inc = true;
for (lv = 5; lv <= 10; lv++) hi += W[lv];
for (lv = 1; lv <= 4; lv++) lo += W[lv];
for (lv = 2; lv <= 10; lv++) if (!(W[lv] > W[lv - 1])) inc = false;
console.log('  weights = ' + JSON.stringify(W));
console.log('  5级+ 合计 = ' + (hi / tot * 100).toFixed(1) + '%（应 80%）　1~4级 = ' + (lo / tot * 100).toFixed(1) + '%（应 20%）　严格递增 = ' + inc);
console.log('  旧结构残留（high/highPct/lowPct）：' +
  JSON.stringify({ high: D.FORT.levelDist.high, highPct: D.FORT.levelDist.highPct, lowPct: D.FORT.levelDist.lowPct }));

console.log('\n══════ ② 全图实际采样 ══════');
var day = G.questDayIndex ? G.questDayIndex() : 0;
var tbl = G.map._fortLevelTable(day);
var cnt = {}, n = 0;
Object.keys(tbl).forEach(function (k) { cnt[tbl[k]] = (cnt[tbl[k]] || 0) + 1; n++; });
console.log('  候选 ' + n + ' 座（当日）');
var allOk = true, hi2 = 0;
for (lv = 1; lv <= 10; lv++) {
  var pct = (cnt[lv] || 0) / n * 100, w = W[lv] / tot * 100;
  var ok = Math.abs(pct - w) <= 0.25;
  if (!ok) allOk = false;
  if (lv >= 5) hi2 += cnt[lv];
  console.log('  Lv' + lv + '：' + cnt[lv] + ' 座 = ' + pct.toFixed(2) + '%（表 ' + w + '%）' + (ok ? ' ✓' : ' ✗'));
}
console.log('  5级+ 合计 = ' + (hi2 / n * 100).toFixed(2) + '%（应 80.00%）　逐级一致 = ' + allOk);

console.log('\n══════ ③ 次日重掷 + 同日确定性 ══════');
var t1 = G.map._fortLevelTable(day + 1);
var c2 = {}, n2 = 0;
Object.keys(t1).forEach(function (k) { c2[t1[k]] = (c2[t1[k]] || 0) + 1; n2++; });
var hi3 = 0;
for (lv = 5; lv <= 10; lv++) hi3 += (c2[lv] || 0);
console.log('  次日：' + n2 + ' 座 · 5级+ 合计 = ' + (hi3 / n2 * 100).toFixed(2) + '%（应 80.00%）');
var bak = G.map._fortLv;
G.map._fortLv = null;
var t2 = G.map._fortLevelTable(day + 1);
G.map._fortLv = bak;
var ks = Object.keys(t1), same = true;
for (var i = 0; i < ks.length && i < 3000; i++) if (t1[ks[i]] !== t2[ks[i]]) { same = false; break; }
console.log('  同日重建逐点一致 = ' + same + '（skipped ' + Math.min(ks.length, 3000) + ' 点）');

console.log('\n完成。');
process.exit(0);
