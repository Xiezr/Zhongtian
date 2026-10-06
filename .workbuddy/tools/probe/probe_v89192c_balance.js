/* v89.192 探针C：射程回落修复的平衡对照（4 配兵场景 · 无将领 · D 默认）
 * 用法：node probe_v89192c_balance.js [before|after]
 * 对照法：同一个探针分别用 backup（before）/当前（after）的 tactic.js 跑。
 * 报：胜者 / 回合 / 双方损失 / 交换比。
 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;
var TAG = process.argv[2] || 'after';
G.newGame({ name: 'bal192', region: '烬环' });
G.state.world.weather = 'clear';

var SCEN = [
  ['步重（枪4）', { changqiang: 4000 }],
  ['骑重（轻骑4）', { qingji: 4000 }],
  ['弓重（弓4）', { gongjian: 4000 }],
  ['混编（枪盾弓骑）', { changqiang: 2000, daodun: 2000, gongjian: 2000, qingji: 2000 }],
];
console.log('[' + TAG + '] 射程回落修复 · 平衡对照（镜像：双方同配兵 · 无将领）');
SCEN.forEach(function (sc) {
  var env = G.tactic.begin(sc[1], null, sc[1], 0, null, {});
  var last = null, g = 0;
  while (!env.over && g++ < 40) last = env.step();
  var fin = env.finish();
  var tot = 0; for (var k in sc[1]) tot += sc[1][k];
  console.log('  ' + sc[0] + '：' + fin.rounds + ' 回合 · 我损 ' + fin.atkLoss + ' / 敌损 ' + fin.defLoss
    + ' · 胜者=' + fin.winner + ' · 我损率=' + Math.round(fin.atkLoss / tot * 100) + '%'
    + ' · 交换比=' + (fin.atkLoss > 0 ? (fin.defLoss / fin.atkLoss).toFixed(2) : '∞'));
});
process.exit(0);
