/* v89.180 探针 D：风筝落地后标定 —— 真实 smartApply 管线 · "关/开风筝"单变量对照
   附录：§176 四场景回归（不能劣化）+ smartStanceOf 新参直接验。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;

G.newGame({ name: 'p180d', avatar: '🧔', gender: 'male', region: '豫州' });
try { GAME.state.world.weather = 'clear'; } catch (e) {}

var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};
var S176 = {
  cavHeavy: { qingji: 600, tieji: 400, tuqibing: 400, hubaoqi: 200, xiliangtieqi: 120, changqiang: 400, gongjian: 300 },
  bowHeavy: { gongjian: 1600, chuangnu: 200, toudan: 80, daodun: 300, changqiang: 300 },
  infHeavy: { changqiang: 1300, daodun: 1100, tengjiabing: 700, qingji: 200, gongjian: 400 },
};
var CASES = [
  ['S1 突骑2000/枪4000', { tuqibing: 2000 }, { changqiang: 4000 }],
  ['S2 弓2000/枪4000', { gongjian: 2000 }, { changqiang: 4000 }],
  ['S3 突1000+弓1000/枪4000', { tuqibing: 1000, gongjian: 1000 }, { changqiang: 4000 }],
  ['S4 突2000/枪3000+弓500', { tuqibing: 2000 }, { changqiang: 3000, gongjian: 500 }],
  ['S5 弓2000/弓2000', { gongjian: 2000 }, { gongjian: 2000 }],
  ['s176-mirror', ARMY, ARMY],
  ['s176-cavHeavy', ARMY, S176.cavHeavy],
  ['s176-bowHeavy', ARMY, S176.bowHeavy],
  ['s176-infHeavy', ARMY, S176.infHeavy],
];

function runSmart(A, B) {
  var env = T.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
  var recX = { side: 'atk', cmd: {} };
  var g = 0;
  while (!env.over && g++ < 40) { G.battle.smartApply(recX, env); env.step(); }
  var r = env.finish();
  var a0 = 0, d0 = 0;
  env.units.atk.forEach(function (u) { a0 += u.start; });
  env.units.def.forEach(function (u) { d0 += u.start; });
  return { win: r.winner, rounds: r.rounds || g, aLoss: r.atkLoss / a0, dLoss: r.defLoss / d0 };
}
function pct(x) { return (x * 100).toFixed(1) + '%'; }
function fmt(r) {
  return (r.win === 'atk' ? '我胜' : r.win === 'def' ? '我败' : '平') + ' ' + r.rounds + '回合 我损' + pct(r.aLoss) + ' 敌损' + pct(r.dLoss);
}

var bkLead = DATA.SMART_PLAN.kiteLead;
console.log('=== A. 关/开风筝 · 单变量对照（真实 smartApply 管线）===');
CASES.forEach(function (c) {
  DATA.SMART_PLAN.kiteLead = -1e9;               /* 关：威胁线恒负 → 永不触发 */
  var off = runSmart(c[1], c[2]);
  DATA.SMART_PLAN.kiteLead = bkLead;             /* 开 */
  var on = runSmart(c[1], c[2]);
  console.log('  ' + c[0].padEnd(26) + '关: ' + fmt(off));
  console.log('  ' + ''.padEnd(26) + '开: ' + fmt(on));
});
DATA.SMART_PLAN.kiteLead = bkLead;

console.log('');
console.log('=== B. smartStanceOf 新参直接验（向后兼容）===');
var f = G.battle.smartStanceOf;
var tu = { id: 'tuqibing', range: 1000, spd: 450, er: 1000 };
var bow = { id: 'gongjian', range: 1200, spd: 250, er: 1200 };
var k1 = { kite: true, threat: 350, eRange: 50, back: 450 };
console.log('  突骑 gap=300 有 ctx(威胁350/敌50/可退450) → ' + f(tu, 300, null, 'echelon', k1) + '（期望 retreat）');
console.log('  突骑 gap=300 无 ctx            → ' + f(tu, 300, null, 'echelon') + '（期望 hold）');
console.log('  突骑 gap=500 有 ctx            → ' + f(tu, 500, null, 'echelon', k1) + '（期望 hold · 500>350 安全区）');
console.log('  弓 gap=300 有 ctx(敌射程1200)   → ' + f(bow, 300, null, 'echelon', { kite: true, threat: 350, eRange: 1200, back: 250 }) + '（期望 hold · 无窗口）');
console.log('  突骑 gap=1500 有 ctx           → ' + f(tu, 1500, null, 'echelon', k1) + '（期望 advance）');
console.log('  突骑 gap=300 可退0             → ' + f(tu, 300, null, 'echelon', { kite: true, threat: 350, eRange: 50, back: 0 }) + '（期望 hold · 退不动）');

console.log('');
console.log('=== C. 赛马快照（本局推荐组合）===');
[['mirror', ARMY, ARMY], ['cavHeavy', ARMY, S176.cavHeavy]].forEach(function (c) {
  var rec = { side: 'atk', genId: null, atkArmy: c[1],
    sim: { scArmy: c[2], scVal: 0, scGen: null, simOpts: {} } };
  var pick = G.battle.smartArbitrate(rec);
  var best = null;
  pick.scores.forEach(function (s) {
    var sc = (s.win ? 1e6 : 0) + (1 - s.aLoss) * 1e4 + Math.min(s.ratio, 999);
    if (!best || sc > best.sc) { best = { sc: sc, s: s }; }
  });
  console.log('  ' + c[0].padEnd(10) + ' → ' + pick.rule + ' × ' + pick.mode + '（我损 ' + pct(best.s.aLoss) + ' · ' + pick.ms + 'ms）');
});
process.exit(0);
