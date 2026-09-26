/* v89.126 探针：劳作占用校准与守卫真调（需求 2）
   复跑：node .workbuddy/tools/probe/probe_v89126_labor_calib.js
   —— ① 各规模城池"满配"占比表（期望全部 = 12.5%）
   —— ② 未满配按级数比例（一半级数 → 一半占用）
   —— ③ 老板场景（前期小城）的占用
   —— ④ 征兵守卫真调：可征内 OK / 超可征被拦 */
var R = 'E:/Deepseekdb/';
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
  'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

/* 满配假城：15 座非民房（含城墙）各 lv 级 + 25 间民房 lv 级 + 城外建满 lv 级 */
function mkFull(type, lv, extMult) {
  var cells = [{ build: { id: 'guanfu', lvl: lv } }];
  ['shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku', 'yizhan', 'fenghuotai', 'majiu',
    'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'chengqiang']
    .forEach(function (b) { cells.push({ build: { id: b, lvl: lv } }); });
  for (var i = 0; i < 25; i++) cells.push({ build: { id: 'minfang', lvl: lv } });
  var extGrid = [];
  var n = DATA.EXT_CAP_BY_LV[Math.min(lv - 1, DATA.EXT_CAP_BY_LV.length - 1)];
  for (var j = 0; j < (extMult == null ? n : Math.floor(n * extMult)); j++) {
    extGrid.push({ type: 'farm', lv: lv });
  }
  return { id: 'fake_' + type + lv, type: type, cells: cells, extGrid: extGrid };
}

console.log('════ ① 满配占比（期望全部 = 12.5%，老板区间 10%-15%）════');
[['self', 12], ['county', 12], ['jun', 16], ['zhou', 20], ['capital', 24]].forEach(function (t) {
  var c = mkFull(t[0], t[1]);
  var cap = G.maxPopOf(c), labor = G.popLaborOf(c);
  var pct = cap > 0 ? labor / cap * 100 : 0;
  console.log('  ' + (DATA.CITY_TIER[t[0]] || t[0]) + '（Lv' + t[1] + '）: 上限 ' + U.fmt(cap)
    + ' · 劳作 ' + U.fmt(labor) + ' → ' + pct.toFixed(2) + '%'
    + '   [级数 ' + G.popLaborLevelsOf(c) + ' / 满配 ' + G.popLaborFullOf(c) + ']');
});

console.log('');
console.log('════ ② 未满配按比例（一半级数 → 一半占用）════');
(function () {
  var c = mkFull('self', 12);
  /* 拆掉一半城外块 → 级数降 */
  c.extGrid = c.extGrid.slice(0, 24);
  var cap = G.maxPopOf(c), labor = G.popLaborOf(c);
  console.log('  县城半配（城外一半）: 上限 ' + U.fmt(cap) + ' · 劳作 ' + U.fmt(labor)
    + ' → ' + (labor / cap * 100).toFixed(2) + '%   [级数 ' + G.popLaborLevelsOf(c) + ' / ' + G.popLaborFullOf(c) + ']');
})();

console.log('');
console.log('════ ③ 老板场景（前期 8 间民房 1 级 + 官府 1）════');
(function () {
  var st = G.newGame({ name: 'v126c', cityName: '许都' });
  G.state = st;
  var c = st.cities[0];
  c.cells.forEach(function (x, i) { if (i < 8) x.build = { id: 'minfang', lvl: 1 }; else if (x.build) x.build.lvl = 1; });
  var cap = G.maxPopOf(c);
  console.log('  上限 ' + cap + ' · 劳作 ' + G.popLaborOf(c) + ' · 可征 ' + G.popFreeOf(c)
    + '   [级数 ' + G.popLaborLevelsOf(c) + ' / 满配 ' + G.popLaborFullOf(c) + ']');
  console.log('  → 前期劳作≈0（产业规模小），随建筑等级增长而上升');
})();

console.log('');
console.log('════ ④ 征兵守卫真调（大城：可征 750 时，750 过 / 751 拦）════');
(function () {
  var st = G.newGame({ name: 'v126d', cityName: '许都' });
  G.state = st;
  var c = st.cities[0];
  G.ui._cityId = c.id;
  /* 换满配 12 级 cells（含军营，供募兵）+ 城外建满 */
  var full = mkFull('self', 12);
  c.cells = full.cells; c.extGrid = full.extGrid;
  st.res.grain = 1e9; st.res.wood = 1e9; st.res.iron = 1e9; st.res.gold = 1e9; st.res.stone = 1e9;
  var cap = G.maxPopOf(c), labor = G.popLaborOf(c);
  var free = Math.floor(cap * 0.125);   /* 满配时 = 上限 12.5% */
  c.res.pop = labor + free;             /* 摆成"刚好可征 free" */
  console.log('  上限 ' + U.fmt(cap) + ' · 劳作占用 ' + U.fmt(labor) + '（' + (labor / cap * 100).toFixed(1) + '%）· 可征 ' + U.fmt(G.popFreeOf(c)));
  var r1 = G.train('yibing', free, c.id);
  console.log('  征 ' + U.fmt(free) + '（正好可征）→ ok=' + r1.ok + '  ' + (r1.msg || '').slice(0, 40));
  var r2 = G.train('yibing', free + 1, c.id);
  console.log('  再征 1 → ok=' + r2.ok + '  msg=' + (r2.msg || '').slice(0, 70));
  console.log(r1.ok && r2.ok === false && /可征人口不足/.test(r2.msg || '') ? '  ✓ 守卫真调通过' : '  ✗ 守卫异常');
})();
process.exit(0);
