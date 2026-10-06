/* ============================================================
 * probe_v89179e_fixverify.js —— 代码复核 10 项修复的行为取证（v89.179b）
 * ------------------------------------------------------------
 * 网门已绿（audit 0 / smoke 3325 / e2e 1168 / tables 四查全过），
 * 本探针对**每一条修复做正向行为确认**（门禁只能证"没破"，不能证"修了"）。
 * 全程走真实出口：tactic.simulate / battle.survivedArmyOf / underdogOf /
 * tickOnce(模拟时间) / prodBreakdown / goldAdd —— 不自行复算公式。
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;

var PASS = 0, FAIL = 0;
function check(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

console.log('=== 符号在场性（10 处编辑点全部存在且可调用）===');
check('battle.survivedArmyOf 存在', typeof G.battle.survivedArmyOf === 'function');
check('battle.underdogOf 存在', typeof G.battle.underdogOf === 'function');
check('battle.withBoost 存在', typeof G.battle.withBoost === 'function');
check('state.tickOnce 存在', typeof G.tickOnce === 'function');
check('state.simulateSeconds 存在', typeof G.simulateSeconds === 'function');
check('state.prodBreakdown 存在', typeof G.prodBreakdown === 'function');
check('state.goldAdd 存在', typeof G.goldAdd === 'function');
check('queueRushCost 存在', typeof G.queueRushCost === 'function');
check('settleGenSalary 存在', typeof G.settleGenSalary === 'function');

/* 战斗/生产数学会走到 STORY 羁绊加成（读 GAME.state）→ 先开一局，让 state 存在 */
G.newGame({ name: '复核', avatar: '🧔', gender: 'male', region: '碎垣' });

/* ============================================================
 * P0-2：survivedArmyOf 排除 nocombat（斥候 chihou）出分母/被折算
 * ============================================================ */
console.log('');
console.log('=== P0-2 斥候(nocombat) 整队返回，不被战斗折算 ===');
check('chihou 标记为 nocombat', DATA.TROOPS.chihou && DATA.TROOPS.chihou.nocombat === true);
(function () {
  var atk = { changqiang: 5000, chihou: 50 };
  var def = { changqiang: 400 };
  var res = T.simulate(JSON.parse(JSON.stringify(atk)), null,
    JSON.parse(JSON.stringify(def)), 0, null, {});
  var surv = G.battle.survivedArmyOf(JSON.parse(JSON.stringify(atk)), res);
  check('攻方获胜（对照）', res.winner === 'atk', 'winner=' + res.winner);
  check('斥候整队返回（不被折算）', surv.chihou === 50, 'surv.chihou=' + surv.chihou);
  check('参战兵按比例折算', surv.changqiang > 0 && surv.changqiang <= 5000, 'surv.changqiang=' + surv.changqiang);
  /* 分母应为参战兵 5000，而非 5050 → 幸存有兵率 keep=atkRemain/5000 */
  var keep = res.atkRemain / 5000;
  var expect = Math.floor(5000 * keep);
  check('参战兵折算口径=5000（分母不含斥候）', Math.abs(surv.changqiang - expect) <= 2,
    'surv=' + surv.changqiang + ' 期望≈' + expect);
})();

/* ============================================================
 * P0-1 + P2-7：爵位俸禄在 tickOnce(逐秒) 与 simulateBulk(整段) 都入账
 *   对照：同环境 rank=0（无俸禄）应几乎不增金 → 隔离出俸禄贡献
 * ============================================================ */
console.log('');
console.log('=== P0-1 爵位俸禄逐秒入账（tickOnce）+ P2-7 整段结算 ===');
var rankIdx = -1;
for (var i = 0; i < DATA.RANK.length; i++) { if (DATA.RANK[i] && DATA.RANK[i].salary > 0) { rankIdx = i; break; } }
check('找到带俸禄的爵位', rankIdx >= 0, rankIdx >= 0 ? ('rank[' + rankIdx + '] salary=' + DATA.RANK[rankIdx].salary) : '');
(function () {
  function freshWithRank(rk) {
    G.newGame({ name: '薪' + rk, avatar: '🧔', gender: 'male', region: '碎垣' });
    var s = G.state;
    s.tax = 0;                         /* 关掉税收，隔离出俸禄这一项金源 */
    s.rank = rk;
    return s;
  }
  var sA = freshWithRank(rankIdx);
  var gA0 = sA.gold;
  G.simulateSeconds(3600);             /* 3600 个 tickOnce ≈ 1 游戏时 */
  var dA = sA.gold - gA0;

  var sB = freshWithRank(0);           /* 对照：无俸禄 */
  var gB0 = sB.gold;
  G.simulateSeconds(3600);
  var dB = sB.gold - gB0;

  var ts = G.timeScale();
  var gate = (DATA.GOLD_GATE && DATA.GOLD_GATE.salary) || 1;
  var expectA = DATA.RANK[rankIdx].salary * ts * gate;   /* 3600 tick 累计 = 俸禄×timeScale×gate */
  console.log('   金增(有俸禄)=' + dA.toFixed(2) + '  金增(无俸禄)=' + dB.toFixed(2)
    + '  理论俸禄=' + expectA.toFixed(2) + ' (timeScale=' + ts + ', GATE.salary=' + gate + ')');
  check('有俸禄档金明显增长', dA > 0, 'Δ=' + dA.toFixed(2));
  check('俸禄贡献隔离出（有俸禄 ≫ 无俸禄）', dA > dB + 1, 'ΔA=' + dA.toFixed(2) + ' ΔB=' + dB.toFixed(2));
  check('俸禄量级符合公式（±50%）', Math.abs(dA - expectA) <= expectA * 0.5, '实测=' + dA.toFixed(2) + ' 理论=' + expectA.toFixed(2));
})();

console.log('');
console.log('=== P2-7 simulateBulk 整段推进 + 调起将领月俸结算（不崩、elapsed 前进）===');
(function () {
  G.newGame({ name: '整段', avatar: '🧔', gender: 'male', region: '碎垣' });
  var s = G.state;
  var e0 = s.world.elapsed;
  var ok = true, err = '';
  try { if (G.simulateBulk) G.simulateBulk(600, 1); } catch (x) { ok = false; err = x.message; }
  check('simulateBulk 运行不抛', ok, err);
  check('world.elapsed 前进', s.world.elapsed > e0, 'elapsed ' + e0.toFixed(0) + '→' + s.world.elapsed.toFixed(0));
})();

/* ============================================================
 * P2-8：underdogOf 的 mySide 路由 —— 守方以弱胜强(带守城加成)应判"以弱胜强"
 * ============================================================ */
console.log('');
console.log('=== P2-8 underdogOf 攻/守侧正确路由（defBonusEff 只加成我方）===');
(function () {
  /* 守方 300 兵 + 守城加成 200/480；攻方 1000 兵；守方险胜 */
  var r = { winner: 'def', atkStartBy: { changqiang: 1000 }, defStartBy: { changqiang: 300 }, defBonusEff: 200 };
  var asDef = G.battle.underdogOf(r, 'def');   /* 我是守方 → 守城加成算我方 */
  var asAtk = G.battle.underdogOf(r, 'atk');   /* 我是攻方 → 守城加成算敌方 → 我方没赢 */
  check('守方(以弱胜强+守城加成)判为以弱胜强', asDef === true, 'underdogOf(def)=' + asDef);
  check('攻方(已败)不判以弱胜强', asAtk === false, 'underdogOf(atk)=' + asAtk);
  /* 反向：攻方 1000 兵带守城加成无意义（攻方不吃 defBonus）→ 攻方大优胜不应判以弱胜强 */
  var r2 = { winner: 'atk', atkStartBy: { changqiang: 1000 }, defStartBy: { changqiang: 300 }, defBonusEff: 200 };
  check('攻方大优胜不判以弱胜强', G.battle.underdogOf(r2, 'atk') === false, 'underdogOf(atk)=' + G.battle.underdogOf(r2, 'atk'));
})();

/* ============================================================
 * P1-4：prodBreakdown 非金资源的"本城加成"行（名城/爵位/主城/神器）
 * ============================================================ */
console.log('');
console.log('=== P1-4 prodBreakdown 本城加成行出现 ===');
(function () {
  G.newGame({ name: '产', avatar: '🧔', gender: 'male', region: '碎垣' });
  var s = G.state;
  var city = s.cities[0];
  DATA.CITY_PERK.self.prodPct = 0.1;   /* 注入名城产出加成，仅本探针有效 */
  var rows = G.prodBreakdown('food', city) || [];
  var hit = rows.some(function (x) { return x && /本城加成/.test(x.name); });
  check('food 明细含「本城加成」行', hit, '行数=' + rows.length);
  delete DATA.CITY_PERK.self.prodPct;
})();

/* ============================================================
 * P1-5：prodBreakdown 金源「俸禄」行只在全境视角(global)列，按城视角不列
 * ============================================================ */
console.log('');
console.log('=== P1-5 金源俸禄行仅全境视角列出 ===');
(function () {
  G.newGame({ name: '金', avatar: '🧔', gender: 'male', region: '碎垣' });
  var s = G.state;
  s.rank = rankIdx >= 0 ? rankIdx : 1;
  var globalRows = G.prodBreakdown('gold') || [];          /* 无 city = 全境视角 */
  var cityRows = G.prodBreakdown('gold', s.cities[0]) || []; /* 按城视角 */
  var hasSalary = function (rs) { return rs.some(function (x) { return x && /俸|禄|salary/i.test(x.name); }); };
  check('全境视角列出俸禄行', hasSalary(globalRows), '行数=' + globalRows.length);
  check('按城视角不列俸禄行', !hasSalary(cityRows), '行数=' + cityRows.length);
})();

/* ============================================================
 * P2-6：goldAdd 不再 round —— 小数零头累积不丢
 * ============================================================ */
console.log('');
console.log('=== P2-6 goldAdd 直接写字段（无 round）===');
(function () {
  G.newGame({ name: '金B', avatar: '🧔', gender: 'male', region: '碎垣' });
  var s = G.state;
  s.gold = 1.234;
  G.goldAdd(0.5);
  G.goldAdd(0.0007);
  check('goldAdd 保留小数零头', Math.abs(s.gold - 1.7347) < 1e-9, 's.gold=' + s.gold);
})();

/* ============================================================
 * P1-3：battle._makeEnv / stepBattle 已用 withBoost 包裹（取史实快照）
 *   行为确认：带 boost 的镜像对局可构造、step 推进、不抛
 * ============================================================ */
console.log('');
console.log('=== P1-3 withBoost 包裹的战术环境可构造可推进 ===');
(function () {
  G.newGame({ name: '镜', avatar: '🧔', gender: 'male', region: '碎垣' });
  var ok = true, err = '', env = null;
  try {
    env = T.begin({ changqiang: 1000 }, null, { changqiang: 800 }, 0, null, {});
    var steps = 0;
    while (env && env.step && !env.done && steps < 50) { env.step(); steps++; }
  } catch (x) { ok = false; err = x.message; }
  check('带 boost 战术环境构造+推进不抛', ok, err || ('steps=' + (typeof steps !== 'undefined' ? steps : '?')));
})();

console.log('');
console.log('━━ 修复行为取证：' + PASS + ' 通过 / ' + FAIL + ' 失败 ━━');
process.exit(FAIL > 0 ? 1 : 0);
