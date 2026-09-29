/* v89.177 探针 A：**量级与口径** —— 为「民心公式 / 措施定价 / 君主突破考验」定标
   ① 地图系统城数（考验"城池"的数值空间）
   ② 人口上限 / 军队量级 / 金币日产出（考验"军队/资源"的数值空间）
   ③ 珠宝与宝物库存结构（"宝物"口径 = s.items 里的 jewel 型种类）
   ④ 游戏日出口 questDayIndex（"每日一次"冷却用）
   ⑤ 民心公式草案：base = 100 − tax×100 的取值表
   运行：node .workbuddy/tools/probe/probe_v89177a_scale.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });
var s = G.state;

console.log('=== ① 地图系统城（城池考验的数值空间）===');
var cities = (s.map && s.map.cities) || [];
var byType = {};
cities.forEach(function (c) { byType[c.type] = (byType[c.type] || 0) + 1; });
console.log('  未占据系统城总数 = ' + cities.length + '　分档: ' + JSON.stringify(byType));
console.log('  玩家初始城池数 = ' + s.cities.length + '（' + s.cities[0].name + '）');

console.log('');
console.log('=== ② 人口 / 军队 / 金币量级 ===');
var c0 = s.cities[0];
var popCap = GAME.maxPopOf ? GAME.maxPopOf(c0) : '?';
var armyT = GAME.armyTotal ? GAME.armyTotal(c0) : '?';
console.log('  初始城人口上限 = ' + U.fmt(popCap) + '　驻军 = ' + U.fmt(armyT));
console.log('  初始金 = ' + U.fmt(GAME.goldOf()));
console.log('  初始税率 = ' + (s.tax * 100) + '%　初始民心 = ' + s.hearts);
/* 模拟 2 游戏日 tick（看税收量级） */
var g0 = GAME.goldOf();
var day = 86400;         /* 1 游戏日 = 86400 游戏秒 */
if (GAME.tickOnce) {
  GAME.tickOnce(day);    /* 一步走一天（ts 参数语义 = 游戏秒） */
  GAME.tickOnce(day);
}
console.log('  2 游戏日后金 = ' + U.fmt(GAME.goldOf()) + '（产 ' + U.fmt(GAME.goldOf() - g0) + ' 金 / 2 日）');

console.log('');
console.log('=== ③ 宝物库存（s.items）===');
var items = s.items || {};
var jewelIds = {};
(DATA.ITEMS || []).forEach(function (it) { if (it.type === 'jewel') jewelIds[it.id] = true; });
var kinds = Object.keys(items).filter(function (k) { return (items[k] || 0) > 0; });
var jewelKinds = kinds.filter(function (k) { return jewelIds[k]; });
console.log('  s.items 持有种类 = ' + kinds.length + '　其中珠宝型 = ' + jewelKinds.length
  + '　（珠宝全集 ' + Object.keys(jewelIds).length + ' 种）');

console.log('');
console.log('=== ④ 游戏日出口 ===');
console.log('  questDayIndex 存在 = ' + (typeof GAME.questDayIndex === 'function')
  + '　当前 = ' + (GAME.questDayIndex ? GAME.questDayIndex() : '?'));
console.log('  已完成任务结构：done 键数 = ' + Object.keys(s.quests.done || {}).length);

console.log('');
console.log('=== ⑤ 民心公式草案：base = clamp(100 − tax×100, 0, 100) ===');
[0, 0.2, 0.3, 0.5, 0.75, 1].forEach(function (t) {
  console.log('  税率 ' + Math.round(t * 100) + '% → 民心基准 ' + U.clamp(100 - t * 100, 0, 100)
    + '　（旧口径下也是基准）· 税收因子 tax×(1−tax) = ' + (t * (1 - t)).toFixed(3));
});
console.log('  ⚠️ 拉弗峰值：tax=50% 时 tax×(1−tax) = 0.25（税收 ∝ 人口×民心×税率）');

process.exit(0);
