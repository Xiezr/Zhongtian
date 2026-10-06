/* v89.131 探针：精力公式设计的数值域采样
 * ------------------------------------------------------------
 * 目的（老板需求 3「精力的数值设定基于六维设计一个公式」）：
 *   ① 各资质将领的四维（tong/yw/zm/nz）与六维总和数值域；
 *   ② 精力消耗值域（远征模式 / 计略 / 游历）；
 *   ③ 当前精力口径的现状核实（回复上限 100 vs UI 读 staMax 的不一致）。
 * 跑法：node .workbuddy/tools/probe/probe_v89131_energy_domain.js
 */
var R = 'E:/Deepseekdb/';
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, D = G.DATA;

/* 先建局（genAttrs 需要 state.buffs 等） */
var st = G.newGame({ name: '探针', cityName: '许都', region: '碎垣', mapSeed: 99131 });

console.log('== ① 各资质四维和 / 体力上限 数值域（每档 40 样本 · 按资质典型等级）==');
var base = D.GEN_BASE;
console.log('  基准四维: tong/nz/yw/zm = ' + base.tong + '/' + base.nz + '/' + base.yw + '/' + base.zm
  + ' · 基准 stamina/energy = ' + base.stamina + '/' + base.energy);
D.GEN_RANKS.forEach(function (rk) {
  var sums4 = [], stas = [];
  for (var i = 0; i < 40; i++) {
    /* makeGeneral(name, level, status, cityId, isStarter, rankId, styleId) */
    var g = G.makeGeneral('测' + rk.id + i, rk.lvCap || 60, 'idle', null, false, rk.id, 'balance');
    if (!g) break;
    var a = G.genAttrs(g);
    sums4.push(a.tong + a.yw + a.zm + a.nz);
    stas.push(G.staMax(g));
  }
  sums4.sort(function (x, y) { return x - y; });
  stas.sort(function (x, y) { return x - y; });
  function md(arr) { return arr[(arr.length / 2) | 0]; }
  console.log('  ' + rk.name.padEnd(4) + '(' + rk.id.padEnd(6) + ') Lv' + String(rk.lvCap).padStart(3)
    + ' 四维和 ' + String(sums4[0]).padStart(4) + '~' + String(sums4[sums4.length - 1]).padStart(4)
    + ' (中位 ' + String(md(sums4)).padStart(4) + ')'
    + '  体力上限 ' + String(stas[0]).padStart(4) + '~' + String(stas[stas.length - 1]).padStart(5)
    + ' (中位 ' + String(md(stas)).padStart(4) + ')');
});

console.log('');
console.log('== ② 精力消耗值域（全部消费点）==');
var costs = [];
['scout', 'raid', 'occupy', 'gather', 'transfer'].forEach(function (id) {
  var m = (D.EXPED_MODES || D.MARCH_MODES || []).filter(function (x) { return x.id === id; })[0];
  if (!m) {
    /* 有的项目把模式放 DATA.EXPEDITION.modes */
    var em = (D.EXPEDITION && D.EXPEDITION.modes) || [];
    em.forEach(function (x) { if (x.id === id) m = x; });
  }
  if (m) costs.push('远征·' + m.name + ' ' + (m.energy || 0));
});
console.log('  ' + (costs.join(' · ') || '（模式表键名待查）'));
var schemeE = [], jianghuE = [];
(D.SCHEMES || []).forEach(function (sc) { schemeE.push(sc.energy); });
console.log('  计略: ' + schemeE.join('/') + '（' + schemeE.length + ' 项）');
Object.keys(D.SCENES || {}).forEach(function (k) { jianghuE.push(D.SCENES[k].energy); });
console.log('  游历: ' + jianghuE.join('/') + '（' + jianghuE.length + ' 项）');

console.log('');
console.log('== ③ 现状核实：回复上限 vs 显示口径 ==');
var g0 = st.generals[0];
console.log('  首将（' + g0.name + '）：g.energy=' + g0.energy
  + ' · g.stamina=' + g0.stamina
  + ' · staMax=' + G.staMax(g0)
  + ' · staBaseMax=' + G.staBaseMax(g0));
console.log('  回复段（state.js）: energy = Math.min(100, …+ enePerHour×游戏小时)'
  + ' → 精力回复被硬顶 100，与 UI 的 /staMax 显示不同源');
console.log('  配置（DATA.GEN_COST）: staPerHour=' + D.GEN_COST.staPerHour
  + '（游戏小时）· enePerHour=' + D.GEN_COST.enePerHour + '（游戏小时）');
console.log('');
console.log('== ④ 悬空引用核查：清心丸 ==');
var hit = (D.ITEMS || []).filter(function (it) { return it.name.indexOf('清心') >= 0; });
console.log('  DATA.ITEMS 中名为"清心丸"的道具: ' + (hit.length ? hit.length + ' 件' : '0 件 ← 悬空引用（提示玩家可服却不存在的道具）'));
var energyItems = (D.ITEMS || []).filter(function (it) { return it.type === 'energy' || it.type === 'stamina'; });
console.log('  可恢复类道具: energy 类 ' + (D.ITEMS || []).filter(function (it) { return it.type === 'energy'; }).length
  + ' 件 · stamina 类 ' + energyItems.filter(function (it) { return it.type === 'stamina'; }).length + ' 件');
process.exit(0);
