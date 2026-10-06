'use strict';
/* v89.139 探针 A（逻辑层）：采集产出打表 / 珠宝覆盖 / 爵位珠宝阶梯 / 地图箭头 / 战场备注
   跑法：node .workbuddy/tools/probe/probe_v89139_base.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

console.log('=== ① 采集产出公式打表（现状）===');
console.log('公式：amount = min(采力, powerCap) × (1 + lv×levelBonus) × 小时数');
console.log('powerCap=' + DATA.GATHER.powerCap + ' · levelBonus=' + DATA.GATHER.levelBonus +
  ' · maxHours=' + DATA.GATHER.maxHours + ' · loadMul=' + (DATA.GATHER.loadMul === undefined ? '(未定义)' : DATA.GATHER.loadMul));
function loadOf(army) {
  var L = 0;
  for (var k in army) { var t = DATA.TROOPS[k]; if (t) L += army[k] * (t.load || 0); }
  return L;
}
function powerOf(army) {
  var p = 0;
  for (var k in army) { var t = DATA.TROOPS[k]; if (t) p += army[k] * (t.gather || 0); }
  return p;
}
var CASES = [
  ['民夫 ×5000', { minfu: 5000 }],
  ['民夫 ×15000', { minfu: 15000 }],
  ['义兵 ×10000', { yibing: 10000 }],
  ['长枪 ×8000', { changqiang: 8000 }],
  ['铁骑 ×3000', { tieji: 3000 }],
  ['虎豹 ×3000', { hubaoqi: 3000 }],
  ['象兵 ×2000', { nanjiangxiangbing: 2000 }],
  ['民夫×5000 + 辎重车×60', { minfu: 5000, zhouche: 60 }],
  ['铁骑×3000 + 辎重车×60', { tieji: 3000, zhouche: 60 }],
];
function yieldAt(army, lv, hours) {
  var raw = Math.min(powerOf(army), DATA.GATHER.powerCap);
  var amt = Math.round(raw * (1 + lv * DATA.GATHER.levelBonus) * hours);
  return amt;
}
console.log('配兵'.padEnd(24) + '采力'.padEnd(10) + '负重'.padEnd(12) + 'Lv1×24h'.padEnd(12) + 'Lv5×24h'.padEnd(12) + 'Lv10×24h');
CASES.forEach(function (c) {
  console.log(c[0].padEnd(24) + String(powerOf(c[1])).padEnd(10) + String(loadOf(c[1])).padEnd(12) +
    String(yieldAt(c[1], 1, 24)).padEnd(12) + String(yieldAt(c[1], 5, 24)).padEnd(12) + String(yieldAt(c[1], 10, 24)));
});

console.log('\n=== ② 珠宝覆盖检查（爵位阶梯 9 种 vs 采集地形表）===');
var lad = DATA.jewelLadder();
console.log('珠宝阶梯（price 升序）：' + lad.map(function (id) {
  var n = id; (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) n = x.name + '(' + x.price + ')'; });
  return n;
}).join(' → '));
var jt = DATA.GATHER.jewelTable || {};
var covered = {};
Object.keys(jt).forEach(function (k) { jt[k].forEach(function (id) { covered[id] = (covered[id] || 0) + 1; }); });
console.log('采集表覆盖：');
lad.forEach(function (id) {
  var n = id; (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) n = x.name; });
  console.log('  ' + (n + '(' + id + ')').padEnd(18) + ' 地形数=' + (covered[id] || 0) +
    (covered[id] ? '' : '  ⛔ 无产出地形'));
});
console.log('jewelChance=' + DATA.GATHER.jewelChance + ' · jewelPerLv=' + DATA.GATHER.jewelPerLv +
  ' · jewelRareP=' + DATA.GATHER.jewelRareP);

console.log('\n=== ③ 爵位晋升珠宝需求表（lv 12→48 每 4 级）===');
var out = [];
for (var lv = 12; lv <= 48; lv += 4) {
  var need = DATA.jewelCostAt(lv);
  var txt = need ? Object.keys(need).map(function (k) {
    var n = k; (DATA.ITEMS || []).forEach(function (x) { if (x.id === k) n = x.name; });
    return n + '×' + need[k];
  }).join(',') : '—';
  out.push('升' + (lv + 1) + '级(需' + lv + '级城): ' + txt);
}
console.log(out.join('\n'));

console.log('\n=== ④ 地图方向箭头（源码取证）===');
var mapSrc = fs.readFileSync(path.join(R, 'js/map.js'), 'utf8');
var arrowIdx = mapSrc.indexOf("视野外的州城/都城");
console.log('箭头段在 map.js 第 ' + (mapSrc.slice(0, arrowIdx).split('\n').length) + ' 行附近');
console.log('箭头字符：' + ['◀', '▶', '▲', '▼'].map(function (ch) {
  return ch + '=' + (mapSrc.indexOf("'" + ch + "'") >= 0);
}).join(' '));

console.log('\n=== ⑤ 战场备注文案（源码取证）===');
var uiSrc = fs.readFileSync(path.join(R, 'js/ui.js'), 'utf8');
var subIdx = uiSrc.indexOf('战斗待指挥 · 每回合');
console.log('备注行在 ui.js 第 ' + (uiSrc.slice(0, subIdx).split('\n').length) + ' 行');
console.log('文案：' + uiSrc.slice(subIdx, subIdx + 80).split('\n')[0]);

console.log('\n=== ⑥ 缩略图我城（默认档 vs 筛选）===');
var st = G.newGame({ name: '探', cityName: '许都', region: '碎垣', mapSeed: 20260939 });
G.makeCity({ id: 'mine2', name: '二城', x: 30, y: 30, type: 'self' });
G.makeCity({ id: 'mine3', name: '三城', x: 60, y: 40, type: 'self' });
console.log('我方城池数=' + G.state.cities.length + '（' + G.state.cities.map(function (c) { return c.name; }).join(', ') + '）');
var v0 = G.ui.miniView();
console.log('默认档：level=[' + v0.level + '] win=' + JSON.stringify(v0.win) + ' → drawMini 会画 ' +
  G.state.cities.length + ' 个红点（现状 = 全部）');
console.log('筛选档位现有选项：全部 / 州城 / 郡城 / 县城（无「我城」）');

console.log('\n=== ⑦ 大屏留白（--app-w 口径）===');
console.log('html{--app-w:1440px} —— 1920 屏下 #screen-game 居中 → 左右各留白 240px');

console.log('\n=== ⑧ 节钺（功能清点）===');
var jy = DATA.RES_SPECIAL && DATA.RES_SPECIAL.jieyue;
if (jy) console.log(JSON.stringify(jy).slice(0, 300));
var dSrc = fs.readFileSync(path.join(R, 'js/domain.js'), 'utf8');
var cnt = (dSrc.match(/jieyue/g) || []).length;
console.log('domain.js 中 jieyue 出现次数=' + cnt);
var uiSrc2 = fs.readFileSync(path.join(R, 'js/ui.js'), 'utf8');
console.log('ui.js 中 jieyue 出现次数=' + (uiSrc2.match(/jieyue/g) || []).length);
console.log('battle.js 中 jieyue 出现次数=' + ((fs.readFileSync(path.join(R, 'js/battle.js'), 'utf8').match(/jieyue/g) || []).length));

process.exit(0);
