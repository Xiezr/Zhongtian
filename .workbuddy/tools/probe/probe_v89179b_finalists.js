/* v89.179 探针 B —— 决赛候选精查（五骑同人口 + 尺寸稳健性 + 放大器残留）
   候选：攻×1/防×2 · 攻×1/防×1.75 · 攻×1/防×1.5 · 攻×1/防×1.25 · 攻×1.25/防×1.25
   通过标准（本探针输出供人眼判定）：
     · 四种近战骑（轻/铁/虎豹/西凉）同人口全胜；轻骑同人口损失 ≤55%；多尺寸稳健；
     · 突骑（骑射）另案：零克制下亦枪胜 —— 记录为诚实缺口，不计入本判据。
   跑法：node .workbuddy/tools/probe/probe_v89179b_finalists.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: '豫州' });
GAME.state.world.weather = 'clear';

var CAVS = ['qingji', 'tieji', 'tuqibing', 'hubaoqi', 'xiliangtieqi'];
function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
function army1(c, n) { var o = {}; o[c] = n; return o; }
function eqPop(c) { return army1(c, Math.floor(4000 / DATA.TROOPS[c].pop)); }
function simOne(A, B) {
  var env = T.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
  var g = 0;
  while (!env.over && g++ < 40) env.step();
  var fin = env.finish();
  return { win: fin.winner, rounds: fin.rounds || g, aL: fin.atkLoss, dL: fin.defLoss, a0: sum(A), d0: sum(B) };
}
function fmt(r) {
  return (r.win === 'atk' ? '枪胜' : '骑胜') + ' ' + String(r.rounds).padStart(2) + '合'
    + ' 枪损' + String(Math.round(r.aL / r.a0 * 100)).padStart(3) + '%'
    + ' 骑损' + String(Math.round(r.dL / r.d0 * 100)).padStart(3) + '%';
}
function setCounters(a, d) {
  CAVS.forEach(function (c) {
    DATA.COUNTER_ATK.changqiang[c] = a;
    DATA.COUNTER_DEF.changqiang[c] = d;
  });
}
console.log('=== 决赛候选精查（五骑同人口 · 尺寸稳健 · 残留对照）===');
[[1, 2], [1, 1.75], [1, 1.5], [1, 1.25], [1.25, 1.25]].forEach(function (f) {
  setCounters(f[0], f[1]);
  console.log('');
  console.log('  ── 候选 攻×' + f[0] + ' 防×' + f[1] + ' ──');
  CAVS.forEach(function (c) {
    console.log('     ' + DATA.TROOPS[c].name + '·同人口4000  ' + fmt(simOne(army1('changqiang', 4000), eqPop(c))));
  });
  [6000, 2000, 1000].forEach(function (N) {
    console.log('     轻骑同人口@' + N + '  ' + fmt(simOne(army1('changqiang', N), army1('qingji', N / 2))));
  });
  console.log('     轻骑同数量@4000  ' + fmt(simOne(army1('changqiang', 4000), army1('qingji', 4000))));
  var rK = simOne(army1('changqiang', 4000), army1('qingji', 2000));
  setCounters(1, 1);
  var r0 = simOne(army1('changqiang', 4000), army1('qingji', 2000));
  console.log('     残留对照(轻骑同人口4000)：有克制 骑损' + Math.round(rK.dL / rK.d0 * 100)
    + '%　无克制 骑损' + Math.round(r0.dL / r0.d0 * 100) + '%　→ 放大器 +'
    + (Math.round(rK.dL / rK.d0 * 100) - Math.round(r0.dL / r0.d0 * 100)) + 'pp');
});
setCounters(2.5, 3);
console.log('');
console.log('（已还原 ×2.5/×3，探针结束）');
process.exit(0);
