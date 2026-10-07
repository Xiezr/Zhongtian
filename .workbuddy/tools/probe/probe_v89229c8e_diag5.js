/* v89.229c8e 探针：v89.95 后排 huopao 为何掉 113 人 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
var out = [];
function P() { out.push(Array.prototype.join.call(arguments, ' ')); }
G.newGame({ name: '诊断', cityName: '灰岗' });
if (!G.state.map.grid) G.map.generate();
G.state.world.weather = 'clear';

function dump(army, label) {
  P('=== ' + label + ' ===');
  var env = G.tactic.begin({ daodanche: 7000 }, null, army, 0, null,
    { sieging: false, kind: 'wild', defName: 'x', field: 700 });
  P('  init def=' + JSON.stringify((env.units.def || []).map(function (u) { return u.id + ':' + u.count + '/start' + u.start + '@adv' + u.adv; })));
  var r1 = env.step();
  P('  全部事件：');
  (r1.events || []).forEach(function (e, i) {
    P('   ' + i + ' ' + JSON.stringify(e));
  });
  P('  步后 def=' + JSON.stringify((env.units.def || []).map(function (u) { return u.id + ':' + u.count; })));
  P('  步后 atk=' + JSON.stringify((env.units.atk || []).map(function (u) { return u.id + ':' + u.count; })));
}
dump({ dunwei: 40, huopao: 4000 }, '原夹具 dunwei40 + huopao4000');
dump({ dunwei: 40, huopao: 4000, yunshu: 1 }, '加一个垫背 yunshu1');
dump({ huopao: 4000 }, '纯 huopao4000（无前排）');

fs.writeFileSync(R + '.workbuddy/tmp/p229c8_probe6.txt', out.join('\n'), 'utf8');
console.log('DONE6');
process.exit(0);
