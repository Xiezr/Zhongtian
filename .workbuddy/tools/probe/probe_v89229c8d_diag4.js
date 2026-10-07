/* v89.229c8d 探针：v89.95 单目标 + §164③ 智能对比（去重后） */
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

P('=== v89.95 一回合只打一个目标（溢出作废）===');
(function () {
  var env1 = G.tactic.begin({ daodanche: 7000 }, null, { dunwei: 40, huopao: 4000 }, 0, null,
    { sieging: false, kind: 'wild', defName: 'x', field: 700 });
  var r1 = env1.step();
  var evs = (r1.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; });
  P('  atk attack 事件数=' + evs.length);
  P('  第一件=' + JSON.stringify(evs[0]));
  var cc = null;
  (env1.units.def || []).forEach(function (u) { if (u.id === 'huopao') cc = u; });
  P('  def 侧 huopao count=' + (cc && cc.count));
  P('  def 侧单位=' + JSON.stringify((env1.units.def || []).map(function (u) { return u.id + ':' + u.count + '@adv' + u.adv; })));
  P('  SPLASH_PCT=' + G.tactic.SPLASH_PCT);
  P('  目标优先级：' + JSON.stringify((G.battle.smartOnOf && G.battle.smartOnOf()) ? 'smart ON' : 'smart OFF'));
})();

P('');
P('=== §164③ 智能对比（去重后镜像小局）===');
function run(A, smart) {
  var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(A)), 0, null, { stances: {} });
  var rec = { side: 'atk', cmd: {} };
  var guard = 0;
  while (!env.over && guard++ < 36) {
    if (smart) G.battle.smartApply(rec, env);
    var st = env.step(); if (!st) break;
  }
  var fin = env.finish();
  var aL = 0, dL = 0;
  for (var k in fin.atkLossBy) aL += fin.atkLossBy[k];
  for (var k in fin.defLossBy) dL += fin.defLossBy[k];
  return { aL: aL, dL: dL, rounds: fin.rounds, winner: fin.winner };
}
var variants = {
  'A 去重七兵种(500/400/400/200/100/40/20)': { buxingji: 500, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 },
  'B 步行机1000(补回被合并的量)': { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 },
  'C 原八项严格映射(民500+矛500)': { buxingji: 500, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20, taitan: 0 },
  'D 三兵种精简(步/盾/弹)': { buxingji: 800, dunwei: 600, daodanche: 600 },
  'E 五兵种(步/盾/弹/伏/轰)': { buxingji: 800, dunwei: 500, daodanche: 500, fujiche: 200, wuren: 40 }
};
Object.keys(variants).forEach(function (k) {
  var A = variants[k];
  var off = run(A, false), on = run(A, true);
  var rOff = off.aL > 0 ? off.dL / off.aL : 0;
  var rOn = on.aL > 0 ? on.dL / on.aL : 0;
  P('  ' + k);
  P('     off 比=' + rOff.toFixed(2) + ' 我损=' + off.aL + ' 敌损=' + off.dL + ' 回合=' + off.rounds + ' 胜=' + off.winner);
  P('     on  比=' + rOn.toFixed(2) + ' 我损=' + on.aL + ' 敌损=' + on.dL + ' 回合=' + on.rounds + ' 胜=' + on.winner
    + '  → on/off=' + (rOff > 0 ? (rOn / rOff).toFixed(2) : '∞') + ' 我损比=' + (off.aL ? (on.aL / off.aL).toFixed(2) : '-'));
});

fs.writeFileSync(R + '.workbuddy/tmp/p229c8_probe5.txt', out.join('\n'), 'utf8');
console.log('DONE5');
process.exit(0);
