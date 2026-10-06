/* v89.179 探针 A —— 「骑兵对枪兵保有赢面 · 克制只做局部放大」标定
   老板原话：『骑兵打枪兵常理应该怎样，当然是骑兵赢面大啦，克制只是局部放大优势，
   怎么能改变整体态势呢？』
   背景（v89.178 实测）：枪打骑 ×2.5 + 长枪拒马 ×3 —— 同人口枪兵仍胜（损 16%）、
   同数量（骑 2 倍人口）骑兵才险胜（损 63%）—— 克制仍在翻转胜负（无克制时枪惨败）。
   本探针输出：
     ① 现状复测（×2.5/×3，复现 v89.178 口径）
     ② 候选矩阵（攻因子 × 防因子；三个关键对局）
     ③ 决赛候选：五骑同人口全查 + 「放大器残留」对照（有拒马 vs 无克制）
   跑法：node .workbuddy/tools/probe/probe_v89179a_cavspear.js
   注：固定 region=豫州 + 晴天（v89.178 §90.1：战斗数值受天气影响，探针必须锁天气）；
       全部数值走引擎真跑（T.begin），不自行复算公式。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: '碎垣' });
GAME.state.world.weather = 'clear';

var CAVS = ['qingji', 'tieji', 'tuqibing', 'hubaoqi', 'xiliangtieqi'];
var POP0 = 4000;

function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
function army1(c, n) { var o = {}; o[c] = n; return o; }
function eqPop(c) { return army1(c, Math.floor(POP0 / DATA.TROOPS[c].pop)); }

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
function cell(r) {
  return ((r.win === 'atk' ? '枪' : '骑') + Math.round((r.win === 'atk' ? r.aL / r.a0 : r.dL / r.d0) * 100)).padEnd(6);
}
function setCounters(a, d) {
  CAVS.forEach(function (c) {
    DATA.COUNTER_ATK.changqiang[c] = a;
    DATA.COUNTER_DEF.changqiang[c] = d;
  });
}
var KEY = [
  ['同人口·轻骑', army1('changqiang', POP0), army1('qingji', 2000)],
  ['同数量·轻骑', army1('changqiang', POP0), army1('qingji', POP0)],
  ['同人口·铁骑', army1('changqiang', POP0), army1('tieji', 1333)],
];

/* ① 现状 */
setCounters(2.5, 3);
console.log('=== ① 现状复测（攻 ×2.5 / 防 ×3）—— 预期复现 v89.178：同人口枪胜损16% ===');
KEY.forEach(function (c) { console.log('  ' + c[0] + '  ' + fmt(simOne(c[1], c[2]))); });

/* ② 候选矩阵 */
var ATKS = [2.5, 2, 1.5, 1.25, 1];
var DEFS = [3, 2, 1.5, 1.25, 1];
console.log('');
console.log('=== ② 候选矩阵（格 = 胜方+胜方损失%；目标：同人口骑胜、同数量骑胜、铁骑骑胜）===');
KEY.forEach(function (c) {
  console.log('  ▸ ' + c[0] + '（枪 ' + sum(c[1]) + ' vs 骑 ' + sum(c[2]) + '）');
  console.log('          ' + DEFS.map(function (d) { return ('防' + d).padStart(8); }).join(''));
  ATKS.forEach(function (a) {
    var line = '   攻' + String(a).padEnd(5);
    DEFS.forEach(function (d) {
      setCounters(a, d);
      line += cell(simOne(c[1], c[2])).padStart(8);
    });
    console.log(line);
  });
});

/* ③ 决赛候选：五骑同人口 + 放大器残留 */
console.log('');
console.log('=== ③ 决赛候选（五骑同人口全查 + 拒马残留对照）===');
[[2, 2], [1.5, 1.5], [1.25, 1.25], [1, 1]].forEach(function (f) {
  setCounters(f[0], f[1]);
  console.log('  ── 候选 攻×' + f[0] + ' 防×' + f[1] + ' ──');
  CAVS.forEach(function (c) {
    console.log('     ' + DATA.TROOPS[c].name + '·同人口  ' + fmt(simOne(army1('changqiang', POP0), eqPop(c))));
  });
  var rK = simOne(army1('changqiang', POP0), army1('qingji', 2000));
  setCounters(1, 1);
  var r0 = simOne(army1('changqiang', POP0), army1('qingji', 2000));
  console.log('     残留对照(同人口·轻骑)：有拒马 枪损' + Math.round(rK.aL / rK.a0 * 100) + '%/骑损' + Math.round(rK.dL / rK.d0 * 100)
    + '%　无克制 枪损' + Math.round(r0.aL / r0.a0 * 100) + '%/骑损' + Math.round(r0.dL / r0.d0 * 100) + '%');
});
setCounters(2.5, 3);
console.log('');
console.log('（已还原 ×2.5/×3，探针结束）');
process.exit(0);
