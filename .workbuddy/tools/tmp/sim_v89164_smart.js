/* v89.164 探索仿真（临时）：全兵种镜像对局，对比几种"通用战斗方式"候选
   跑法：node .workbuddy/tools/tmp/sim_v89164_smart.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;

/* ---- 兵种全满的镜像编队 ---- */
var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};

function sumLoss(by) { var s = 0; for (var k in by) s += by[k]; return s; }
function counts(a) { var s = 0; for (var k in a) s += a[k]; return s; }

/* ---- 方案 A：全默认（全前进 + 同兵种/自动） ---- */
var PLAN_BASE = { byId: {}, smart: null };

/* ---- 方案 B：目标优化（静态） ---- */
var CAV = ['qingji', 'tieji', 'tuqibing', 'hubaoqi', 'xiliangtieqi', 'nanjiangxiangbing'];
var PLAN_TARGET = { byId: {
  changqiang: { t: 'qingji' },              /* 枪打骑（×3 攻） */
  daodun: { t: 'gongjian' },                /* 盾顶弓（防射 ×3 + 打软目标） */
  tengjiabing: { t: 'changqiang' },         /* 藤甲顶枪 */
  gongjian: { t: 'gongjian' },              /* 弓对射 */
  chuangnu: { t: 'chuangnu' },              /* 弩打器械（×3） */
  toudan: { t: 'gongjian' },                /* 投石打软目标 */
  qingji: { t: 'gongjian' }, tieji: { t: 'gongjian' }, tuqibing: { t: 'gongjian' },
  hubaoqi: { t: 'gongjian' }, xiliangtieqi: { t: 'gongjian' }, nanjiangxiangbing: { t: 'gongjian' },
}, smart: null };

/* ---- 智能 tick：远程进射程转 hold；步近战贴身转 hold ---- */
function smartTick(env, side, opt) {
  opt = opt || {};
  var mine = env.units[side], theirs = env.units[side === 'atk' ? 'def' : 'atk'];
  var D = env.field || 1;
  var themFront = 0;
  theirs.forEach(function (u) { if (u.count > 0 && u.adv > themFront) themFront = u.adv; });
  var stat = {};
  mine.forEach(function (u) {
    if (u.count <= 0) return;
    /* ⚠️ 真实间距 = 战场纵深 − 我方前出 − 敌方前出（双方相向而行）。
       第一版写成 `themFront - u.adv`（敌方 adv 减我方 adv）——量纲错，已修正。 */
    var gap = D - u.adv - themFront;
    var isRanged = u.range >= 500;
    var isCav = u.spd >= 400;
    var want;
    if (isRanged) want = (gap <= u.range * (opt.rangeK || 1)) ? 'hold' : 'advance';   /* 进射程 → 站桩 */
    else if (isCav) want = (gap <= (opt.cavGap != null ? opt.cavGap : 150)) ? 'hold' : 'advance'; /* 骑冲到位后缠斗 */
    else want = (gap <= (opt.infGap != null ? opt.infGap : 150)) ? 'hold' : 'advance';            /* 步接敌转守 */
    stat[want] = (stat[want] || 0) + 1;
    if (u.stance !== want) env.setCmd(side, u.id, { s: want });
  });
  return stat;
}
var PLAN_SMART_HOLD = { byId: {}, smart: smartTick };
var PLAN_SMART_TARGET = { byId: PLAN_TARGET.byId, smart: smartTick };

/* 变体：全部 hold（防守实验） */
var PLAN_HOLD_ALL = { byId: null, holdAll: true };

function applyPlan(env, side, plan) {
  if (plan.holdAll) {
    env.units[side].forEach(function (u) { env.setCmd(side, u.id, { s: 'hold' }); });
    return;
  }
  if (plan.only) {
    env.units[side].forEach(function (u) {
      var hit = (plan.only === 'ranged') ? (u.range >= 500) : (u.range < 500 && u.spd < 400);
      if (hit) env.setCmd(side, u.id, { s: 'hold' });
    });
    return;
  }
  for (var tid in (plan.byId || {})) {
    var c = plan.byId[tid];
    env.setCmd(side, tid, { s: c.s || 'advance', t: c.t !== undefined ? c.t : '' });
  }
}

function run(atkPlan, defPlan, label) {
  var env = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(ARMY)), 0, null, { stances: {} });
  applyPlan(env, 'atk', atkPlan);
  applyPlan(env, 'def', defPlan);
  var guard = 0, log = [];
  while (!env.over && guard++ < 36) {
    if (atkPlan.smart) atkPlan.smart(env, 'atk');
    if (defPlan.smart) defPlan.smart(env, 'def');
    var st = env.step();
    if (!st) break;
    if (st.r <= 2 || st.r === guard) {
      log.push('r' + st.r + ' gap=' + Math.round(st.gap) + ' atkLeft=' + counts(env.units.atk.reduce(function (a, u) { a[u.id] = (a[u.id] || 0) + (u.count || 0); return a; }, {}))
        + ' defLeft=' + counts(env.units.def.reduce(function (a, u) { a[u.id] = (a[u.id] || 0) + (u.count || 0); return a; }, {})));
    }
  }
  var fin = env.finish();
  var aL = sumLoss(fin.atkLossBy), dL = sumLoss(fin.defLossBy);
  var aTot = counts(ARMY);
  console.log('  [' + label + '] 回合=' + fin.rounds + ' · 我方损失=' + aL + '（' + (aL / aTot * 100).toFixed(1) + '%）'
    + ' · 敌方损失=' + dL + '（' + (dL / aTot * 100).toFixed(1) + '%）'
    + ' · 交换比(敌损/我损)=' + (aL > 0 ? (dL / aL).toFixed(2) : '∞') + ' · winner=' + fin.winner);
  return { rounds: fin.rounds, aL: aL, dL: dL, winner: fin.winner, fin: fin, log: log };
}

G.newGame({ name: 'sim', region: '烬环' });
console.log('=== 全兵种镜像对局（我方=攻 用候选方案 · 敌方=守 全默认前进） ===');
var r1 = run(PLAN_BASE, PLAN_BASE, 'P0 基线（全默认）');
var r2 = run(PLAN_TARGET, PLAN_BASE, 'B 目标优化（静态）');
var r3 = run(PLAN_SMART_HOLD, PLAN_BASE, 'C 智能 hold（无目标微调）');
var r4 = run(PLAN_SMART_TARGET, PLAN_BASE, 'D 智能 hold + 目标优化');
console.log('\n=== 防守实验：我方全 hold ===');
var r5 = run(PLAN_HOLD_ALL, PLAN_BASE, 'E 全 hold vs 全默认');
console.log('\n=== 反向对照：敌方用智能方案，我方全默认 ===');
var r6 = run(PLAN_BASE, PLAN_SMART_TARGET, 'F 默认 vs 智能+目标');
console.log('\n=== 细分解：谁的 hold 贡献大 ===');
var PLAN_HOLD_RANGED = { byId: null, only: 'ranged' };      /* 仅远程 hold */
var PLAN_HOLD_INF = { byId: null, only: 'inf' };            /* 仅步近战 hold */
var r7 = run(PLAN_HOLD_RANGED, PLAN_BASE, 'G 仅远程转 hold');
var r8 = run(PLAN_HOLD_INF, PLAN_BASE, 'H 仅步近战 hold');
console.log('\n=== hold 对 hold（双方都守） ===');
var r9 = run(PLAN_HOLD_ALL, PLAN_HOLD_ALL, 'I 全 hold vs 全 hold');
console.log('\n=== 双智能（双方同方案） ===');
var r10 = run(PLAN_SMART_HOLD, PLAN_SMART_HOLD, 'J 智能 vs 智能');
console.log('\n=== 智能 tick 生效验证（打印第 1/3/6 回合 stance 快照） ===');
(function () {
  var env = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(ARMY)), 0, null, { stances: {} });
  for (var r = 1; r <= 8 && !env.over; r++) {
    var stat = smartTick(env, 'atk', {});
    var st = env.step();
    if (r <= 6) {
      var stances = env.units.atk.filter(function (u) { return u.count > 0; })
        .map(function (u) { return u.id.slice(0, 2) + ':' + u.stance.slice(0, 3) + '@' + u.adv; }).join(' ');
      console.log('  r' + r + ' gap=' + Math.round(st.gap) + ' | ' + stances);
    }
  }
})();
console.log('\n=== 阈值扫参：infGap 对交换比 ===');
[80, 150, 300, 600, 99999].forEach(function (g) {
  var plan = { byId: {}, smart: function (env, side) { return smartTick(env, side, { infGap: g }); } };
  run(plan, PLAN_BASE, 'infGap=' + g);
});
process.exit(0);
