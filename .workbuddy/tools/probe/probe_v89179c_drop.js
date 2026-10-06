/* ============================================================
 * probe_v89179c_drop.js —— 高阶加速宝物掉落率标定（v89.179c · 老板②B闸配套）
 * ------------------------------------------------------------
 * 目的：`GAME.grantBoostDrop` 是唯一出口，本探针**真调它**跑长样，
 *   把"设计概率"与"实测概率"对齐，并换算成玩家体感口径：
 *     · 单件/次  命中率
 *     · 期望件数/次（采集 mult=1 · 出征 mult=0.7）
 *     · 拿到 1 件需要多少次（= 1/p）
 * 用法：node .workbuddy/tools/probe/probe_v89179c_drop.js
 * ============================================================ */
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(require('fs').readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;

var N = 50000;                     /* 每等级采样次数 */
var s = G.state;
G.newGame({ name: '标定', cityName: '许都', region: '碎垣', mapSeed: 20260928 });
s = G.state;

var tbl = (DATA.BOOST_DROP || {}).table || [];
var QUOTA = ((DATA.BOOST_DROP || {}).quota || {}).perRealDay || 0;
/* v89.179c：加了"现实日配额"后，长样必须**每次采样前重置配额**，
   否则第一轮就把配额用光、后面全部空手 → 测出来的是配额不是概率。 */
G.boostDropRollDay();
var TODAY_KEY = (s.boostDrop || {}).key || '';
function resetQuota() { s.boostDrop = { key: TODAY_KEY, count: 0 }; }

console.log('=== v89.179c 掉落率标定（真调 GAME.grantBoostDrop · 每档 N=' + N + '）===');
console.log('BOOST_DROP.battleMult = ' + (DATA.BOOST_DROP || {}).battleMult
  + ' · quota.perRealDay = ' + QUOTA + '（下表已按次重置配额，测的是**原始概率**）');
console.log('');
console.log('lv | 设计' + '件/次'.padEnd(6) + ' | 实测件/次 | 件/次(出征×0.7) | 单件命中率区间');
console.log('---|' + '-'.repeat(8) + '|-----------|----------------|------------------');

var byLv = {};
[1, 3, 5, 7, 10].forEach(function (lv) {
  /* ---- 采集口径（mult = 1）---- */
  s.items = {};
  for (var i = 0; i < N; i++) { resetQuota(); G.grantBoostDrop(lv, 1, null); }
  var total = 0, hits = {}, prob = [];
  tbl.forEach(function (r) { var n = s.items[r.id] || 0; hits[r.id] = n; total += n; });
  tbl.forEach(function (r) {
    var designed = Math.min(1, r.base + r.perLv * lv);
    var measured = hits[r.id] / N;
    prob.push(designed);
    r.__d = designed; r.__m = measured;
  });
  /* ---- 出征口径（mult = battleMult）---- */
  var m = (DATA.BOOST_DROP || {}).battleMult || 1;
  s.items = {};
  var N2 = Math.round(N / 2);
  for (var j = 0; j < N2; j++) { resetQuota(); G.grantBoostDrop(lv, m, null); }
  var total2 = 0;
  tbl.forEach(function (r) { total2 += (s.items[r.id] || 0); });

  byLv[lv] = { perCollect: total / N, perBattle: total2 / N2 };

  console.log(String(lv).padStart(2) + ' | '
    /* ⚠️ 设计值必须**尊重 minLv 门槛**（v89.179c 首版漏了，lv1 设计与实测对不上）：
       低于 row.minLv 的行永不参与掷骰 → 设计概率记 0。 */
    + (tbl.reduce(function (a, r) { return a + (lv >= r.minLv ? Math.min(1, r.base + r.perLv * lv) : 0); }, 0)).toFixed(3).padEnd(6) + ' | '
    + (total / N).toFixed(3).padEnd(10) + ' | '
    + (total2 / N2).toFixed(3).padEnd(15) + ' | '
    + (Math.min.apply(null, prob)).toFixed(4) + ' ~ ' + (Math.max.apply(null, prob)).toFixed(4));
});

console.log('');
console.log('=== 逐件：设计概率 vs 实测概率（lv=10 · 采集）===');
console.log('件名'.padEnd(12) + ' | 设计 p | 实测 p  | 偏差    | 拿到1件需采集次数');
tbl.forEach(function (r) {
  var dev = r.__m - r.__d;
  console.log(r.name.padEnd(12) + ' | '
    + r.__d.toFixed(4) + ' | ' + r.__m.toFixed(4) + ' | '
    + (dev >= 0 ? '+' : '') + dev.toFixed(4) + ' | '
    + (r.__m > 0 ? Math.round(1 / r.__m) + ' 次' : '—'));
});

console.log('');
console.log('=== 逐件：minLv 门槛（低于此等级永不掉）===');
tbl.forEach(function (r) { console.log('  ' + r.name + '  minLv=' + r.minLv + '  base=' + r.base + ' perLv=' + r.perLv); });

console.log('');
console.log('=== 结论口径 ===');
console.log('  采集（mult=1）期望件/次：' + [1, 3, 5, 7, 10].map(function (lv) {
  return 'Lv' + lv + ' ' + byLv[lv].perCollect.toFixed(2);
}).join(' · '));
console.log('  出征（mult=' + (DATA.BOOST_DROP || {}).battleMult + '）期望件/次：' + [1, 3, 5, 7, 10].map(function (lv) {
  return 'Lv' + lv + ' ' + byLv[lv].perBattle.toFixed(2);
}).join(' · '));

console.log('');
console.log('=== 配额影响（现实日上限 ' + QUOTA + ' 件）===');
console.log('  理论支出（无配额）· 按 DATA.GATHER：每队满 1 游戏小时可收获 · 同时最多 3 队');
console.log('    → 一天（游戏日）最多 72 次收获；Lv10 单次 ' + byLv[10].perCollect.toFixed(3)
  + ' 件 → 约 ' + (72 * byLv[10].perCollect).toFixed(1) + ' 件/游戏日');
console.log('    → 600× 下 1 现实日 ≈ 600 游戏日 → 现实里刷几分钟即上千件（**这就是配额存在的理由**）');
console.log('  有了配额之后（Lv10 · 采集）：');
[1, 5, 10].forEach(function (lv) {
  var p = byLv[lv].perCollect;
  console.log('    Lv' + lv + ' 期望 ' + p.toFixed(3) + ' 件/次 → 拿满 ' + QUOTA + ' 件约需 '
    + (QUOTA / (p || 1)).toFixed(1) + ' 次采集');
});
console.log('  说明：配额是**节奏旋钮**，不是防刷闸 —— 叠加已由 BOOST_CAP(' + ((DATA.BOOST_CAP || 0.3) * 100) + '%) 封住。');

process.exit(0);
