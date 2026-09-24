/* ============================================================
 * v89.116 探针③：守城战报能不能建**真沙盘**（老板「守城的战报沙盘应当通用掠夺战斗的沙盘」）
 * ------------------------------------------------------------
 * 验证四件事：
 *   ① 来袭结算的 result 里有 `unitsInit`（沙盘配方的必要输入）；
 *   ② 用同一批输入手搓配方 → `sandboxOf` 能重建、且 verify=true（史实=重跑）；
 *   ③ 出城迎战部队（sortie）的 adv = SORTIE_ADV，且**逐回合真的前进/接战**；
 *   ④ 沙盘帧里能不能认出"我方是守方"（供界面把城墙画在右侧）。
 * 跑法：node .workbuddy/tools/probe/probe_v89116_defsb.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
var st = G.newGame({ name: '探', cityName: '许都' });
G.state = st;
if (!st.map.grid) G.map.generate();

var city = G.currentCity();
/* 造一个"会被打且守得住"的局：城里有兵、有城墙、有箭塔、有守将 */
city.army = { changqiang: 4000, gongjian: 2000, daodun: 2000 };
city.wallLv = 5;
(function seedGuard() {
  var g = (st.generals || []).filter(function (x) { return !x.cityId || x.cityId === city.id; })[0];
  if (g) { g.cityId = city.id; g.status = 'guard'; }
})();
console.log('===== ⓪ 现场 =====');
console.log('  城：' + city.name + '　驻军 ' + JSON.stringify(city.army) + '　城墙 Lv' + (city.wallLv || 0));
console.log('  守将（guardGeneralOf）= ' + ((G.guardGeneralOf(city) || {}).name || '(无)'));
console.log('  ⚠ 代码里 invasionResolve 读的是 GAME.guardOf —— 该函数**不存在**（真名 guardGeneralOf）'
  + '，所以守将永远是 null：战报写"（无守将）"、守将加成不进战斗。');
console.log('  城防 cityDefense = ' + G.cityDefense(city) + '　箭塔 towerCountOf = ' + G.towerCountOf(city));

console.log('\n===== ① 结算 result 有哪些字段 =====');
var I = DATA.INVASION || {};
var slot = G.invasionSlotOf(G.realNow()) + 1;
/* 先给城配点料：城墙 + 兵 + 守将 */
city.cells = city.cells || [];
var r = null;
try {
  r = G.invasionResolve(city, I.sources[0], slot);
} catch (e) {
  console.log('  结算异常：' + e.message);
}
if (r) {
  console.log('  held=' + r.held + ' lootOk=' + r.lootOk + ' 损兵=' + r.troopsLost + ' 伤兵=' + (r.wounded || 0));
  if (r.battle) {
    Object.keys(r.battle).forEach(function (k) { console.log('    battle.' + k + ' = ' + r.battle[k]); });
  } else console.log('    ⚠ 无 battle 明细（引擎异常兜底）');
}
var rep = (st.reports || [])[0];
console.log('  战报 title = ' + (rep ? rep.title : '(无)'));
console.log('  战报 sandbox = ' + (rep && rep.sandbox ? '有' : 'null（当前口径：防御战不给沙盘）'));
console.log('  战报 scene = ' + (rep && rep.scene ? '有' : '无') + '　replay = ' + (rep && rep.replay ? '有' : '无'));
console.log('  战报 loss = ' + (rep && rep.loss ? JSON.stringify(Object.keys(rep.loss)) : '无'));

console.log('\n===== ② 手搓配方 → sandboxOf 能不能重建 + verify =====');
/* 用与 invasionResolve 完全相同的输入手搓一次（模拟修好之后的行为） */
var ia = G.invasionArmyOf(city, slot);
var guard = G.guardGeneralOf(city);
var wallLv = city.wallLv || (G.buildingLevel(city, 'chengqiang') || 0);
var towers = G.towerCountOf(city);
var defVal = G.cityDefense(city);
var defArmy0 = U.deep(city.army || {});
var simOpts = { kind: 'city', sieging: true, defName: city.name, wallLv: wallLv, towers: towers, playerDef: true };
console.log('  （复算用的守将）' + ((guard || {}).name || '(无)'));
var res2 = G.tactic.simulate(ia.army, null, U.deep(city.army), defVal, guard, simOpts);
console.log('  重跑：' + res2.rounds + ' 回合　我(守)损 ' + res2.defLoss + ' / 敌(攻)损 ' + res2.atkLoss
  + '　胜方 ' + res2.winner);
console.log('  unitsInit = ' + (res2.unitsInit ? ('有（atk ' + res2.unitsInit.atk.length + ' 队 / def '
  + res2.unitsInit.def.length + ' 队）') : '无！'));
if (res2.unitsInit) {
  res2.unitsInit.def.forEach(function (u) {
    console.log('    [守] ' + u.id + ' count=' + u.count + ' stance=' + u.stance + ' adv=' + (u.adv == null ? '-' : u.adv));
  });
}
var rc = G.battle.sandboxRecipeOf(res2, ia.army, null, defArmy0, defVal, guard, simOpts,
  { place: { kind: 'city', name: city.name }, ourSide: 'def' });
console.log('  配方 atkArmy = ' + JSON.stringify(Object.keys(rc.atkArmy || {}))
  + '　scArmy = ' + JSON.stringify(Object.keys(rc.scArmy || {})));
if (rc) {
  var fakeRep = { sandbox: rc, title: '试', t: Date.now(), type: 'defense' };
  var sb = G.battle.sandboxOf(fakeRep);
  console.log('  sandboxOf → ' + (sb ? ('帧 ' + sb.frames.length + ' / ' + sb.rounds + ' 回合　verify=' + sb.verify
    + '　maxRounds=' + sb.maxRounds + '　field=' + sb.field) : 'null'));
  if (sb) {
    console.log('    ids = ' + sb.ids.join('、'));
    console.log('    init.atk = ' + JSON.stringify(sb.init.atk));
    console.log('    init.def = ' + JSON.stringify(sb.init.def));
    console.log('    前 6 帧：');
    sb.frames.slice(0, 6).forEach(function (f) { console.log('      ' + JSON.stringify(f)); });
  }
}

console.log('\n===== ③ 出城迎战（sortie）逐回合前进 =====');
/* 把守方某个兵种设成出城迎战，看它 adv / 是否接战 */
var tk = Object.keys(city.army || {})[0];
if (tk) {
  var bk = JSON.parse(JSON.stringify((G.state.tactics && G.state.tactics.def) || {}));
  try {
    G.setTactic('def', tk, { sortie: true, s: 'advance' });
    var res3 = G.tactic.simulate(ia.army, null, U.deep(city.army), defVal, guard, simOpts);
    console.log('  ' + tk + ' 设出城迎战 → ' + res3.rounds + ' 回合，守损 ' + res3.defLoss
      + '，出城部队 ' + res3.defSortieStart + ' → 余 ' + res3.defSortieLeft);
    console.log('  unitsInit.def（' + tk + '）adv = ' + res3.unitsInit.def.filter(function (u) { return u.id === tk; })
      .map(function (u) { return u.adv + '（SORTIE_ADV=' + G.tactic.SORTIE_ADV + '）'; }).join(','));
    /* 逐回合看它有没有前进 */
    var env = G.tactic.begin(ia.army, null, U.deep(city.army), defVal, guard, simOpts);
    var n = 0;
    while (!env.over && n++ < 5) {
      var s3 = env.step();
      if (!s3) break;
      var su = s3.snap.def.filter(function (u) { return u.id === tk; })[0];
      console.log('    第 ' + s3.r + ' 回合：' + tk + ' adv=' + (su ? su.adv : '-')
        + ' count=' + (su ? su.count : '-') + '　gap=' + Math.round(s3.gap));
    }
  } finally {
    Object.keys((G.state.tactics && G.state.tactics.def) || {}).forEach(function (k) {
      delete G.state.tactics.def[k];
    });
    Object.keys(bk).forEach(function (k) { G.state.tactics.def[k] = bk[k]; });
  }
}

console.log('\n===== ④ 界面侧：sd* 认不认得出"我方=守方" =====');
console.log('  ui.sdLineHTML 里"我方/敌军"是写死的（atk=我军）—— 需要 sb.ourSide 视角字段');
console.log('  ui.sdRosterHTML 只有 atk 侧可编辑 —— 守城视角下要反过来');
console.log('  城墙示意：towers=' + towers + ' wallLv=' + wallLv + '（sd 场里目前无城墙图形）');

process.exit(0);
