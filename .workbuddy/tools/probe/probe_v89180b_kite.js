/* v89.180 探针 B：风筝（kite）规则标定 —— 远程"前出接敌 → 保持距离无伤消耗"的可行性
   做法：逐回合对我方（攻方）设定 stance（retreat/hold/advance），敌方默认 advance。
   R0 = 现状（进射程即 hold）；R1/R2/R3 = 风筝候选（威胁线触发后撤）。
   全程真实引擎；天气固定 clear。输出胜负 + 双方损失 + 轨迹。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;

G.newGame({ name: 'p180b', avatar: '🧔', gender: 'male', region: '碎垣' });
try { GAME.state.world.weather = 'clear'; } catch (e) {}

function ruleOf(env, u, cfg) {
  var er = (u.er != null ? u.er : (u.range || 0));
  var D = env.field || 1;
  var foes = [];
  env.units.def.forEach(function (x) { if (x.count > 0) foes.push(x); });
  if (!foes.length) return 'hold';
  var eF = foes[0];
  foes.forEach(function (x) { if (x.adv > eF.adv) eF = x; });
  var gap = D - u.adv - eF.adv;
  if (er < 500) {                          /* 近战：维持 v89.164 标定 */
    return gap <= 250 ? 'hold' : 'advance';
  }
  if (gap > er) return 'advance';          /* 远程：前出接敌（拉进射程） */
  if (!cfg || !cfg.kite) return 'hold';    /* R0 现状：进射程即站桩 */
  /* 风筝候选 */
  var eRange = (eF.er != null ? eF.er : (eF.range || 0));
  var eSpd = eF.spd || 0;
  var threat = eRange + eSpd * (cfg.lead == null ? 1 : cfg.lead);
  if (gap > threat) return 'hold';                    /* 安全区：输出 */
  if (!(eRange < er - 1)) return 'hold';              /* 无窗口（敌射程 ≥ 我）→ 退无用 */
  if (cfg.spdNeed && !(u.spd >= eSpd)) return 'hold'; /* 跑不过就不退 */
  var back = Math.min(u.spd, u.adv + D);
  if (cfg.keep && gap + back > er + 1) return 'hold'; /* 退出去打不着 → 原地打 */
  return 'retreat';
}

function run(A, B, cfg, trace) {
  var env = T.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, { stances: {} });
  var rows = [], g = 0;
  while (!env.over && g++ < 40) {
    env.units.atk.forEach(function (u) {
      if (u.count <= 0) return;
      env.setCmd('atk', u.id, { s: ruleOf(env, u, cfg) });
    });
    var st = env.step();
    if (trace) {
      var aR = 0, dR = 0;
      env.units.atk.forEach(function (u) { aR += u.count; });
      env.units.def.forEach(function (u) { dR += u.count; });
      rows.push('r' + g + ' gap=' + (st && st.gap != null ? st.gap : '?') + ' 我' + aR + ' 敌' + dR);
    }
  }
  var fin = env.finish();
  var a0 = 0, d0 = 0;
  for (var k in A) a0 += A[k];
  for (var k2 in B) d0 += B[k2];
  return { win: fin.winner, rounds: fin.rounds, aLoss: fin.atkLoss / a0, dLoss: fin.defLoss / d0, rows: rows };
}
function pct(x) { return (x * 100).toFixed(1) + '%'; }
function fmt(r) {
  return '[' + (r.win === 'atk' ? '我胜' : r.win === 'def' ? '我败' : '平') + '] ' + r.rounds + '回合 我损' + pct(r.aLoss) + ' 敌损' + pct(r.dLoss);
}

var CFGS = {
  'R0 现状(进射程站桩)': { kite: false },
  'R1 风筝(单步预判)': { kite: true, lead: 1, keep: false },
  'R2 风筝(退后须可开火)': { kite: true, lead: 1, keep: true },
  'R3 风筝(速度+可开火)': { kite: true, lead: 2, keep: true, spdNeed: true },
};

var SCENES = {
  'S1 突骑2000 vs 长枪4000': [{ tuqibing: 2000 }, { changqiang: 4000 }],
  'S2 弓2000 vs 长枪4000': [{ gongjian: 2000 }, { changqiang: 4000 }],
  'S3 突骑1000+弓1000 vs 长枪4000': [{ tuqibing: 1000, gongjian: 1000 }, { changqiang: 4000 }],
  'S4 突骑2000 vs 长枪3000+弓500': [{ tuqibing: 2000 }, { changqiang: 3000, gongjian: 500 }],
  'S5 弓2000 vs 弓2000(对射对照)': [{ gongjian: 2000 }, { gongjian: 2000 }],
};

Object.keys(SCENES).forEach(function (sn) {
  console.log('== ' + sn + ' ==');
  Object.keys(CFGS).forEach(function (cn) {
    var r = run(SCENES[sn][0], SCENES[sn][1], CFGS[cn]);
    console.log('  ' + cn.padEnd(22) + fmt(r));
  });
});

console.log('');
console.log('== 轨迹对照（S1：R0 vs R2 前 14 回合）==');
['R0 现状(进射程站桩)', 'R2 风筝(退后须可开火)'].forEach(function (cn) {
  var r = run(SCENES['S1 突骑2000 vs 长枪4000'][0], SCENES['S1 突骑2000 vs 长枪4000'][1], CFGS[cn], true);
  console.log('  [' + cn + '] ' + fmt(r));
  r.rows.slice(0, 14).forEach(function (x) { console.log('     ' + x); });
});
process.exit(0);
