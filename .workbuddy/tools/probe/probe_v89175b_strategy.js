/* v89.175 探针 B：目标策略设计验证 —— 策略库 × 多场景 × 赛马
   候选目标规则：static（现状表）/ dmg（期望实伤）/ eff（有效杀·防溢出）/ front（清前排）/
                 threat（打输出最高者）
   变量：守方默认姿态（advance 现状 vs hold 建议）/ rangeK（远程站位）。
   跑法：node .workbuddy/tools/probe/probe_v89175b_strategy.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });

var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};
var SCENES = {
  mirror: ARMY,
  cavHeavy: { qingji: 600, tieji: 400, tuqibing: 400, hubaoqi: 200, xiliangtieqi: 120, changqiang: 400, gongjian: 300 },
  bowHeavy: { gongjian: 1600, chuangnu: 200, toudan: 80, daodun: 300, changqiang: 300 },
  infHeavy: { changqiang: 1300, daodun: 1100, tengjiabing: 700, qingji: 200, gongjian: 400 },
};
function sum(a) { var s = 0; for (var k in a) s += a[k]; return s; }
function total(list) { var n = 0; list.forEach(function (u) { if (u.count > 0) n += u.count; }); return n; }
function pick(list, id) { var o = null; list.forEach(function (u) { if (u.id === id) o = u; }); return o; }
var PLAN = G.battle.smartPlanOf();

/* ---------- 候选目标规则 ---------- */
function chooseTarget(rule, u, mine, foes) {
  if (rule === 'static') return PLAN.targets[u.id] || null;
  if (!foes.length) return null;
  var enemyArmy = {};
  foes.forEach(function (e) { enemyArmy[e.id] = (enemyArmy[e.id] || 0) + e.count; });
  var perA = T.perAtk(u, { counterMul: T.counterAtkOf(u.id, enemyArmy) });
  var myF = 0;
  mine.forEach(function (x) { if (x.count > 0 && x.adv > myF) myF = x.adv; });
  var best = null, bestScore = -Infinity;
  foes.forEach(function (e) {
    var cf = T.clashFactor(perA, T.perDef(e, { defMul: T.counterDefOf(e.id, u.id) }));
    var perHp = T.perHp(e, null);
    var hold = (e.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
    var killF = perA * u.count * cf * hold / perHp;
    var score;
    if (rule === 'dmg') score = killF;
    else if (rule === 'eff') score = Math.min(killF, e.count) * 1000 + killF * 0.001;
    else if (rule === 'front') score = e.adv * 1000 + Math.min(killF, e.count);
    else if (rule === 'threat') {
      var ePerA = T.perAtk(e, { counterMul: T.counterAtkOf(e.id, enemyArmy) });
      score = ePerA * e.count * cf;      /* 敌方该支的"对我威胁"× 本次可削减比例 */
    } else score = 0;
    if (score > bestScore) { bestScore = score; best = e; }
  });
  return best ? best.id : null;
}
/* ---------- 智能 apply（策略可注入版 · v3） ----------
   追击规则（v2）：远程"射程内有活敌 → hold；打不着 → advance"。
   通用交战规则（v3·CHASE2）：**全兵种"能开火才 hold"** ——
     有敌在我方"开火距离"内 → hold（站定输出/贴住缠斗）；否则 advance（收网/冲锋）。
     修 v89.164 的"250 提前 hold"死锁：刀盾在 205 处 hold 但射程仅 30（打不到）→
     两侧互卡 30 回合清不完（probe_v89175c 实锤）。*/
var CHASE = false;    /* v2：远程追击 */
var CHASE2 = false;   /* v3：全兵种"能打才 hold" */
function smartApplyX(rec, env, rule, rangeK, defHold) {
  var mine = env.units.atk, foes = env.units.def;
  var D = env.field, eF = 0;
  foes.forEach(function (x) { if (x.count > 0 && x.adv > eF) eF = x.adv; });
  rec.cmd = rec.cmd || {};
  var n = 0;
  mine.forEach(function (u) {
    if (!(u.count > 0)) return;
    var c = rec.cmd[u.id] = rec.cmd[u.id] || {};
    var gap = D - u.adv - eF;
    var wantS;
    if (CHASE2) {
      var engageD = (u.range || 0) >= 500 ? u.range : (u.range || 0) + 40;
      var anyE = false;
      foes.forEach(function (e) { if (e.count > 0 && (D - u.adv - e.adv) <= engageD) anyE = true; });
      wantS = anyE ? 'hold' : 'advance';
    } else if ((u.range || 0) >= 500) {
      if (CHASE) {
        var anyInRange = false;
        foes.forEach(function (e) { if (e.count > 0 && (D - u.adv - e.adv) <= (u.range || 0)) anyInRange = true; });
        wantS = anyInRange ? 'hold' : 'advance';
      } else {
        wantS = (gap <= u.range * rangeK) ? 'hold' : 'advance';
      }
    } else {
      var isCav = (u.spd || 0) >= 400;
      var k = isCav ? (PLAN.gapCav != null ? PLAN.gapCav : 250) : (PLAN.gapInf != null ? PLAN.gapInf : 250);
      wantS = (gap <= k) ? 'hold' : 'advance';
    }
    var wantT = rule === 'static' ? (PLAN.targets[u.id] || null) : chooseTarget(rule, u, mine, foes);
    var patch = {};
    if (c.s !== wantS) { c.s = wantS; patch.s = wantS; }
    if (wantT != null && c.t !== wantT) { c.t = wantT; patch.t = wantT; }
    if (patch.s || patch.t !== undefined) { env.setCmd('atk', u.id, patch); n++; }
  });
  return n;
}
function runOne(rule, scene, defHold, rangeK) {
  var env = T.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(scene)), 0, null, { stances: {} });
  if (defHold === true) env.units.def.forEach(function (u) { env.setCmd('def', u.id, { s: 'hold' }); });
  else if (defHold === 'ranged') env.units.def.forEach(function (u) { if ((u.range || 0) >= 500) env.setCmd('def', u.id, { s: 'hold' }); });
  var rec = { side: 'atk', cmd: {} };
  var g = 0;
  while (!env.over && g++ < 40) {
    smartApplyX(rec, env, rule, rangeK == null ? 1.0 : rangeK, defHold);
    env.step();
  }
  var aRem = total(env.units.atk), dRem = total(env.units.def);
  var aStart = sum(ARMY), dStart = sum(scene);
  var aLoss = (aStart - aRem) / aStart, dLoss = (dStart - dRem) / dStart;
  return {
    aLoss: aLoss, dLoss: dLoss,
    win: aRem > 0 && dRem === 0, rounds: g,
    ratio: dRem === 0 ? ((aStart - aRem) > 0 ? (dStart / Math.max(1, aStart - aRem)) : 999) : (dLoss / Math.max(0.0001, aLoss)),
  };
}
function fmt(r) { return (r.ratio >= 100 ? '∞' : r.ratio.toFixed(2)) + (r.win ? 'W' : 'L') + '(' + r.rounds + ')'; }
function log(s) { console.log(s); }

console.log('=== ⓪ 单局计时（定位慢因） ===');
(function () {
  var t0 = Date.now();
  var r1 = runOne('static', SCENES.mirror, true, 1.0);
  console.log('  static·mirror·hold 1 局 = ' + (Date.now() - t0) + 'ms · ' + fmt(r1));
  var t1 = Date.now();
  var r2 = runOne('eff', SCENES.mirror, true, 1.0);
  console.log('  eff·mirror·hold 1 局 = ' + (Date.now() - t1) + 'ms · ' + fmt(r2));
})();

console.log('=== ① 策略 × 场景（守方默认 advance = 现状）===');
console.log('规则\\场景\t' + Object.keys(SCENES).map(function (s) { return s.padEnd(10); }).join('\t') + '\t合计(几何均)');
var RULES = ['static', 'dmg', 'eff', 'front', 'threat'];
RULES.forEach(function (rule) {
  var line = rule.padEnd(8) + '\t', prod = 1;
  Object.keys(SCENES).forEach(function (sn) {
    var r = runOne(rule, SCENES[sn], false, 1.0);
    prod *= Math.max(0.01, r.ratio);
    line += fmt(r).padEnd(10) + '\t';
  });
  console.log(line + Math.pow(prod, 1 / Object.keys(SCENES).length).toFixed(2));
});

console.log('');
console.log('=== ② 守方 hold（建议：NPC 守方默认防御）—— 同表 ===');
RULES.forEach(function (rule) {
  var line = rule.padEnd(8) + '\t', prod = 1;
  Object.keys(SCENES).forEach(function (sn) {
    var r = runOne(rule, SCENES[sn], true, 1.0);
    prod *= Math.max(0.01, r.ratio);
    line += fmt(r).padEnd(10) + '\t';
  });
  console.log(line + Math.pow(prod, 1 / Object.keys(SCENES).length).toFixed(2));
});

console.log('');
console.log('=== ③ rangeK 扫参（static 表 · 守方 hold）===');
console.log('rangeK\t' + Object.keys(SCENES).map(function (s) { return s.padEnd(10); }).join('\t'));
[0.8, 0.9, 1.0, 1.1, 1.2].forEach(function (k) {
  var line = k.toFixed(2) + '\t';
  Object.keys(SCENES).forEach(function (sn) {
    var r = runOne('static', SCENES[sn], true, k);
    line += fmt(r).padEnd(10) + '\t';
  });
  console.log(line);
});

console.log('');
console.log('=== ⑤ 守方「仅远程 hold」（近战仍迎击 —— 建议方案）===');
RULES.forEach(function (rule) {
  var line = rule.padEnd(8) + '\t', prod = 1;
  Object.keys(SCENES).forEach(function (sn) {
    var r = runOne(rule, SCENES[sn], 'ranged', 1.0);
    prod *= Math.max(0.01, r.ratio);
    line += fmt(r).padEnd(10) + '\t';
  });
  console.log(line + Math.pow(prod, 1 / Object.keys(SCENES).length).toFixed(2));
});

console.log('');
console.log('=== ⑥ 守方仅远程 hold + 我方**追击规则**（收网）===');
CHASE = true;
RULES.forEach(function (rule) {
  var line = rule.padEnd(8) + '\t', prod = 1;
  Object.keys(SCENES).forEach(function (sn) {
    var r = runOne(rule, SCENES[sn], 'ranged', 1.0);
    prod *= Math.max(0.01, r.ratio);
    line += fmt(r).padEnd(10) + '\t';
  });
  console.log(line + Math.pow(prod, 1 / Object.keys(SCENES).length).toFixed(2));
});
console.log('（对照：①守方冲=2.48 · ⑤仅远程hold无追击=2.93 —— static 行）');
CHASE = false;

console.log('');
console.log('=== ⑦ 守方仅远程 hold + 我方**"能打才 hold"**（v3 · 全兵种）===');
CHASE2 = true;
RULES.forEach(function (rule) {
  var line = rule.padEnd(8) + '\t', prod = 1;
  Object.keys(SCENES).forEach(function (sn) {
    var r = runOne(rule, SCENES[sn], 'ranged', 1.0);
    prod *= Math.max(0.01, r.ratio);
    line += fmt(r).padEnd(10) + '\t';
  });
  console.log(line + Math.pow(prod, 1 / Object.keys(SCENES).length).toFixed(2));
});
console.log('（对照：①守方冲 2.48 · ⑤仅远程hold+旧规则 2.93 · ⑥+远程追击 2.39）');
CHASE2 = false;

console.log('');
console.log('=== ⑧ 守方保持现状（冲）+ 我方 v3「能打才 hold」 —— 单变量对比 ① ===');
CHASE2 = true;
RULES.forEach(function (rule) {
  var line = rule.padEnd(8) + '\t', prod = 1;
  Object.keys(SCENES).forEach(function (sn) {
    var r = runOne(rule, SCENES[sn], false, 1.0);
    prod *= Math.max(0.01, r.ratio);
    line += fmt(r).padEnd(10) + '\t';
  });
  console.log(line + Math.pow(prod, 1 / Object.keys(SCENES).length).toFixed(2));
});
CHASE2 = false;

console.log('');
console.log('=== ④ 赛马演示（守方冲世界 · **胜优先**评分：胜 > 交换比）===');
['mirror', 'cavHeavy', 'bowHeavy', 'infHeavy'].forEach(function (sn) {
  var scores = {};
  ['static', 'dmg', 'eff', 'front'].forEach(function (rule) {
    scores[rule] = runOne(rule, SCENES[sn], false, 1.0);
  });
  var bestRule = null, bestSc = -1e9;
  Object.keys(scores).forEach(function (r2) {
    var sc = (scores[r2].win ? 10000 : 0) + scores[r2].ratio;
    if (sc > bestSc) { bestSc = sc; bestRule = r2; }
  });
  var staticSc = scores.static.win ? 10000 + scores.static.ratio : scores.static.ratio;
  console.log('  ' + sn.padEnd(10) + ' → 采用【' + bestRule + '】' +
    (bestRule === 'static' ? '（= 静态表）' : '（赛马增益 +' + (((scores[bestRule].win ? 10000 : 0) + scores[bestRule].ratio) - staticSc).toFixed(2) + '）') +
    '　' + Object.keys(scores).map(function (r3) { return r3 + '=' + fmt(scores[r3]); }).join('  '));
});
process.exit(0);
