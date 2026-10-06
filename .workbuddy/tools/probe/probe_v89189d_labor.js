/* v89.189 批次 D 探针：建筑人口占用 —— 现状（v89.126 全局 12.5%）vs 老板新口径
   （1 民房照看 16 座同级资源建筑 / 9 座城内同级建筑，除官府与城墙）
   A. 民房人口表（1-24 级）
   B. 四场景：初始 / 中期 / 首城满配(12格) / 都城满配(24格)
   C. 新口径逐建筑占用（Lv1/6/12/24）
   D. 民房需求与征兵余量（新口径）
   跑法：node .workbuddy/tools/probe/probe_v89189d_labor.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
G.newGame({ name: 'l189', avatar: '🧔', gender: 'male', region: '碎垣' });

var popT = DATA.BUILDINGS.minfang.pop;
function fmtN(n) { return U.fmt(Math.round(n)); }
function lvlPop(lv) { return popT[Math.max(0, Math.min(popT.length - 1, lv - 1))] || 0; }

console.log('===== A. 民房人口表（单座 · 1-24 级）=====');
[1, 6, 12, 18, 24].forEach(function (lv) {
  console.log('  Lv' + String(lv).padEnd(2) + ' 人口 ' + fmtN(lvlPop(lv)).padEnd(9)
    + '　→ 单座城内建筑占（/9）' + fmtN(lvlPop(lv) / 9).padEnd(8)
    + '　单块资源地占（/16）' + fmtN(lvlPop(lv) / 16));
});

/* 新口径占用（正向口径 · 与拟定实现一致） */
function laborNew(city) {
  var sum = 0;
  (city.cells || []).forEach(function (cl) {
    if (!cl.build) return;
    if (cl.build.id === 'minfang' || cl.build.id === 'guanfu') return;
    sum += lvlPop(cl.build.lvl || 1) / 9;
  });
  (city.extGrid || []).forEach(function (e) {
    if (!e || !e.type) return;
    sum += lvlPop(e.lv || 1) / 16;
  });
  return Math.floor(sum);
}
function popOf(city) {
  var n = 0;
  (city.cells || []).forEach(function (cl) { if (cl.build && cl.build.id === 'minfang') n += lvlPop(cl.build.lvl || 1); });
  return n;
}
var CITY_BUILDINGS = ['shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku', 'kezhan', 'zhaoxianguan',
  'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai'];

function mkScene(name, gflv, mfN, bldN, extN, blv) {
  var cells = [{ build: { id: 'guanfu', lvl: gflv } }];
  for (var i = 0; i < mfN; i++) cells.push({ build: { id: 'minfang', lvl: gflv } });
  for (var j = 0; j < bldN; j++) cells.push({ build: { id: CITY_BUILDINGS[j % CITY_BUILDINGS.length], lvl: blv } });
  var extGrid = [];
  for (var k = 0; k < extN; k++) extGrid.push({ type: 'farm', lv: blv });
  var c = { id: 's_' + name, type: 'self', cells: cells, extGrid: extGrid };
  var pop = popOf(c), oldL = G.popLaborOf(c), newL = laborNew(c);
  console.log('  ' + name.padEnd(14) + ' 民房' + String(mfN).padEnd(3) + '×Lv' + String(gflv).padEnd(3)
    + ' 建筑' + String(bldN).padEnd(3) + '×Lv' + String(blv).padEnd(3) + ' 资源' + String(extN).padEnd(3)
    + '｜人口 ' + fmtN(pop).padEnd(9)
    + '｜现状占比 ' + (pop > 0 ? (oldL / pop * 100).toFixed(1) : '-') + '%'
    + '｜新口径 ' + fmtN(newL) + '（' + (pop > 0 ? (newL / pop * 100).toFixed(0) : '-') + '%）'
    + '｜可征 ' + fmtN(Math.max(0, pop - newL)));
  return { pop: pop, newL: newL };
}

console.log('\n===== B. 四场景（现状 vs 新口径）=====');
console.log('  ── 现状 = v89.126 全局 12.5%×进度 ──');
mkScene('初始小城', 2, 2, 2, 2, 2);
mkScene('中期城', 6, 3, 5, 8, 6);
mkScene('首城满配', 12, 2, 9, 12, 12);
mkScene('首城满配(3房)', 12, 3, 8, 12, 12);
mkScene('都城满配', 24, 8, 11, 96, 24);
mkScene('都城全建筑', 24, 12, 12, 96, 24);

console.log('\n===== C. 新口径逐项（Lv24 满配 · 都城视角）=====');
console.log('  单座城内建筑（Lv24）占 ' + fmtN(lvlPop(24) / 9) + ' · 单块资源（Lv24）占 ' + fmtN(lvlPop(24) / 16)
  + ' · 单座民房（Lv24）供 ' + fmtN(lvlPop(24)));
console.log('  换算：1 民房 ↔ ' + (lvlPop(24) / (lvlPop(24) / 9)).toFixed(0) + ' 座同级城内建筑 '
  + '或 ' + (lvlPop(24) / (lvlPop(24) / 16)).toFixed(0) + ' 块同级资源地（按定义恒为 9 / 16）');

console.log('\n===== D. 关键平衡点（新口径）=====');
console.log('  首城 12 格：2 民房 + 9 建筑 + 12 资源 → 占用/人口 = '
  + ((9 * lvlPop(12) / 9 + 12 * lvlPop(12) / 16) / (2 * lvlPop(12)) * 100).toFixed(0) + '%（可征余 '
  + fmtN(2 * lvlPop(12) - (9 * lvlPop(12) / 9 + 12 * lvlPop(12) / 16)) + '）');
console.log('  都城 24 格：8 民房 + 11 建筑 + 96 资源 → 占用/人口 = '
  + ((11 * lvlPop(24) / 9 + 96 * lvlPop(24) / 16) / (8 * lvlPop(24)) * 100).toFixed(0) + '%');
console.log('  （现状 v89.126 同场景仅 12.5% —— 老板判"太少"的实锤）');

process.exit(0);
