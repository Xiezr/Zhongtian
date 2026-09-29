/* v89.176 探针 D：**总体策略（阵型模式）矩阵** —— 5 模式 × 4 场景
   模式（老板原词）：
     echelon 错落有致 = 现状（近战到 250 转防御 / 远程进射程转防御）——baseline
     line    齐头并进 = 全体推进到**射程边缘**（近战也贴到 er，不在 250 停）
     spear   针尖麦芒 = 最快一档（spd 最高的兵种）全速不停，其余照 250/er
     turtle  退守消耗 = 全体防御（原地，受创减半），等敌来
     charge  一波冲锋 = 全体全速推进、永不转防御
   目标规则用 v89.175 的 4 套（static/dmg/eff/front），模式只改姿态。
   跑法：node .workbuddy/tools/probe/probe_v89176d_modes.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });

var MODES = ['echelon', 'line', 'spear', 'turtle', 'charge'];
var RULES = ['static', 'dmg', 'eff', 'front'];
var PLAN = G.battle.smartPlanOf();
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

/* ---- 模式 → 姿态决策（返回 'hold' / 'advance'；spear 需要知道"谁最快"） ---- */
function modeStance(mode, u, gap, plan, fastestId) {
  var er = (u.er != null ? u.er : (u.range || 0));
  var isRanged = (u.range || 0) >= 500;
  if (mode === 'turtle') return 'hold';
  if (mode === 'charge') return 'advance';
  if (mode === 'line') return (gap <= er) ? 'hold' : 'advance';       /* 贴到射程边 */
  if (mode === 'spear') {
    if (u.id === fastestId) return 'advance';                          /* 尖刀不停 */
    return (gap <= (isRanged ? er : 250)) ? 'hold' : 'advance';
  }
  /* echelon = 现状 */
  if (isRanged) return (gap <= er * (plan.rangeK || 1)) ? 'hold' : 'advance';
  var k = ((u.spd || 0) >= 400) ? (plan.gapCav || 250) : (plan.gapInf || 250);
  return (gap <= k) ? 'hold' : 'advance';
}

function runOne(mode, rule, scene) {
  var env = T.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(scene)), 0, null, {});
  /* 最快兵种（我方） */
  var fastestId = '', fastest = -1;
  env.units.atk.forEach(function (u) { if (u.spd > fastest) { fastest = u.spd; fastestId = u.id; } });
  var recX = { side: 'atk', cmd: {} };
  var g = 0;
  while (!env.over && g++ < 40) {
    var mine = env.units.atk, theirs = env.units.def;
    var D = env.field || 1, themFront = 0;
    theirs.forEach(function (x) { if (x.count > 0 && x.adv > themFront) themFront = x.adv; });
    mine.forEach(function (u) {
      if (!(u.count > 0)) return;
      var gap = D - u.adv - themFront;
      var wantS = modeStance(mode, u, gap, PLAN, fastestId);
      var wantT = (rule === 'static') ? plan_target(u.id)
        : G.battle.smartPickTarget(u, theirs, rule, D);
      var patch = {};
      if (wantS && recX.cmd[u.id] !== wantS) { patch.s = wantS; }
      if (wantT != null) { patch.t = wantT; }
      if (patch.s || patch.t !== undefined) env.setCmd('atk', u.id, patch);
      recX.cmd[u.id] = wantS;
    });
    env.step();
  }
  var r = env.finish();
  var a0 = 0, d0 = 0;
  env.units.atk.forEach(function (u) { a0 += u.start; });
  env.units.def.forEach(function (u) { d0 += u.start; });
  var aRem = r.atkRemain, dRem = r.defRemain;
  var win = aRem > 0 && dRem === 0;
  var ratio = dRem === 0 ? (aRem < a0 ? (d0 / (a0 - aRem)) : 999) : ((d0 - dRem) / Math.max(1, a0 - aRem));
  return { win: win, ratio: ratio, aLossPct: (a0 - aRem) / a0, rounds: r.rounds || g };
}
function plan_target(id) { return PLAM[id]; }
var PLAM = PLAN.targets;

console.log('模式 × 场景（每格 = 交换比，W=胜；口径 = 静态目标；再看下方各规则细化）');
var TRACE = 'E:/Deepseekdb/.workbuddy/tmp/_p176d_progress.txt';
try { fs.writeFileSync(TRACE, 'BOOT\n'); } catch (e) {}
console.log('场景'.padEnd(10) + MODES.map(function (m) { return m.padEnd(16); }).join(''));
var best = {};
MODES.forEach(function (mode) {
  var line = mode.padEnd(10);
  Object.keys(SCENES).forEach(function (sn) {
    var t0 = Date.now();
    var r = runOne(mode, 'static', SCENES[sn]);
    try { fs.appendFileSync(TRACE, mode + '/' + sn + ' ' + (Date.now() - t0) + 'ms\n'); } catch (e) {}
    var cell = (r.win ? (r.ratio >= 100 ? '∞' : r.ratio.toFixed(2)) + 'W' : r.ratio.toFixed(2)) + '(' + r.rounds + ')';
    /* 记录每场景最优（胜优先，其次交换比） */
    var sc = (r.win ? 1000 : 0) + r.ratio;
    if (!best[sn] || sc > best[sn].sc) best[sn] = { sc: sc, mode: mode, r: r };
    line += cell.padEnd(16);
  });
  console.log(line);
});
console.log('');
console.log('各场景最优模式（静态目标下）：');
Object.keys(best).forEach(function (sn) {
  console.log('  ' + sn.padEnd(10) + ' → ' + best[sn].mode + '　交换比 ' + best[sn].r.ratio.toFixed(2)
    + (best[sn].r.win ? 'W' : '') + '　我损 ' + Math.round(best[sn].r.aLossPct * 100) + '%');
});

console.log('');
console.log('模式 × 规则（mirror 场景细化；看是否需要"模式×规则"联合赛马）');
RULES.forEach(function (rule) {
  var line = rule.padEnd(8);
  MODES.forEach(function (mode) {
    var r = runOne(mode, rule, SCENES.mirror);
    line += ((r.win ? (r.ratio >= 100 ? '∞' : r.ratio.toFixed(2)) + 'W' : r.ratio.toFixed(2)) + '(' + r.rounds + ')').padEnd(16);
  });
  console.log(line);
});

process.exit(0);
