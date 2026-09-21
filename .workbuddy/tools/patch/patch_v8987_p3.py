# -*- coding: utf-8 -*-
"""v89.87 需求3：战斗单目标攻击 + 30% 溢出溅射（老板拍板）

改动 tactic.js 三处：
  ① 新增常量 T.SPLASH_PCT = 0.30（溢出溅射比例）
  ② fireOnce 增加 `ctx.single` 单主目标分支：主目标吃满 → 超出伤害对射程内
     其他每个敌方兵种各溅射 30%（箭塔/反击不传 single，行为不变）
  ③ actSide 主动攻击调用点：传 single + splashTargets（射程内的其他兵种）
"""
import io

P = r'E:\Deepseekdb\js\tactic.js'
src = io.open(P, encoding='utf-8', newline='').read()
orig = src

# ---------- ① 常量 ----------
old1 = """  T.FIELD_MARGIN = 199;
  /* 保底：双方都是近战（长枪 50）时也要留出可推进的间距 → 50 + 199 = 249 */
  T.FIELD_MIN = 200;"""
new1 = """  T.FIELD_MARGIN = 199;
  /* 保底：双方都是近战（长枪 50）时也要留出可推进的间距 → 50 + 199 = 249 */
  T.FIELD_MIN = 200;
  /* ============================================================
   * 溢出溅射比例（v89.87 · 老板拍板）
   * ------------------------------------------------------------
   * 「每个兵种每回合只主动攻击一次，目标为其中一个兵种」——
   * 主目标吃满本次伤害后，**超出部分对射程内其他每个敌方兵种各溅射 30%**。
   * 取代原 v57 的「溢出按由近及远**全额**顺延」。
   * 标靶是**兵种**（编队）不是个体：溅射量按各自防御/生命折算杀兵数，
   * 各自钳制在实有人数内（打不光更多）。
   * ============================================================ */
  T.SPLASH_PCT = 0.30;"""
assert src.count(old1) == 1, ('const', src.count(old1))
src = src.replace(old1, new1, 1)

# ---------- ② fireOnce 单目标分支 ----------
old2 = """      var hits = [], killed = 0, clash = 1;
      for (var pi = 0; pi < pool.length && av > 0; pi++) {"""
new2 = """      var hits = [], killed = 0, clash = 1;
      /* ============================================================
       * v89.87（老板拍板）：**主动攻击 = 单主目标制**
       * ------------------------------------------------------------
       *   · 主目标 = 指定目标（`preferId` 已排到池首）/ 否则最近的一支；
       *   · 主目标吃满本次攻击的全部伤害（自然钳制：最多打光它）；
       *   · 吃满后的**超出伤害**对射程内其他每个敌方兵种各溅射 30%
       *     （`ctx.splashTargets`，由 actSide 预先筛好"在射程内"的其他兵种）。
       * 箭塔火力与反击**不传 `ctx.single`** → 走下方原溢出逻辑，行为不变。
       * ============================================================ */
      if (ctx.single && pool.length) {
        var tg0 = pool[0];
        var perHp0 = T.perHp(tg0, ctx.defGenOfTarget);
        var cf0 = T.clashFactor(perA, T.perDef(tg0, { defMul: T.counterDefOf(tg0.id, shooter.id) }));
        var holdMul0 = (tg0.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
        var eff0 = av * cf0 * holdMul0;
        var k0 = Math.floor(eff0 / perHp0);
        if (k0 > tg0.count) k0 = tg0.count;          // 自然钳制：不能杀超过目标实有人数
        var over = eff0 - k0 * perHp0;               // 主目标吃满后的**超出伤害**
        clash = cf0;
        if (k0 > 0) {
          tg0.count -= k0;
          killed += k0;
          hits.push({ id: tg0.id, name: tg0.name, kill: k0 });
        }
        if (over > 0 && ctx.splashTargets && ctx.splashTargets.length) {
          ctx.splashTargets.forEach(function (sg) {
            if (sg === tg0 || sg.count <= 0) return;
            var sPerHp = T.perHp(sg, ctx.defGenOfTarget);
            var sCf = T.clashFactor(perA, T.perDef(sg, { defMul: T.counterDefOf(sg.id, shooter.id) }));
            var sHold = (sg.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
            var sk = Math.floor(over * T.SPLASH_PCT * sCf * sHold / sPerHp);
            if (sk > sg.count) sk = sg.count;        // 同样自然钳制
            if (sk > 0) {
              sg.count -= sk;
              killed += sk;
              hits.push({ id: sg.id, name: sg.name, kill: sk, splash: true });
            }
          });
        }
        return { killed: killed, hits: hits, clash: Math.round(clash * 100) };
      }
      for (var pi = 0; pi < pool.length && av > 0; pi++) {"""
assert src.count(old2) == 1, ('fireOnce', src.count(old2))
src = src.replace(old2, new2, 1)

# ---------- ③ actSide 开火调用点 ----------
old3 = """        if (gap <= effRange) {
          /* 溢出杀伤：一支 2000 人的弓兵齐射，攻击值除以敌军生命值本该杀掉一千多，
             若按"只打最近的一支"来算，前排只剩 91 人时整轮伤害就只兑现 91 ——
             剩下的 99% 凭空蒸发。所以一轮齐射按"由近及远"依次落到各支敌军身上。 */
          var decay = T.rangeDecay(gap, effRange);
          var res = fireOnce(u, enemyUnits, {
            siegeMult: siegeMult, decay: decay, onWall: onWall,
            wallFireMul: wallFireMul,
            preferId: u.target || '',
            defBonus: defBonusAgainst(u.side === 'atk' ? 'def' : 'atk'),
            defGenOfTarget: enemyGen,
          });"""
new3 = """        if (gap <= effRange) {
          /* v89.87（老板拍板）：主动攻击 = **单主目标**（rec，指定目标优先/否则最近），
             主目标吃满后超出伤害对**射程内其他每个**敌方兵种各溅射 30%。
             溅射目标在此预筛："与射手自身的间距 ≤ 射手有效射程"的其余兵种。 */
          var decay = T.rangeDecay(gap, effRange);
          var splash = [];
          enemyUnits.forEach(function (e) {
            if (e.count <= 0 || e === rec) return;
            var ge = gapOf(u, ef) + (ef - e.adv);
            if (ge <= effRange) splash.push(e);
          });
          var res = fireOnce(u, enemyUnits, {
            siegeMult: siegeMult, decay: decay, onWall: onWall,
            wallFireMul: wallFireMul,
            preferId: u.target || '',
            defBonus: defBonusAgainst(u.side === 'atk' ? 'def' : 'atk'),
            defGenOfTarget: enemyGen,
            single: true, splashTargets: splash,
          });"""
assert src.count(old3) == 1, ('actSide', src.count(old3))
src = src.replace(old3, new3, 1)

# ---------- ④ 头部注释补一行 ----------
old4 = """ *   · **回合制**。每回合所有存活部队按**速度从高到低**行动（速度含将领加成）。"""
new4 = """ *   · **回合制**。每回合所有存活部队按**速度从高到低**行动（速度含将领加成）。
 *   · v89.87（老板拍板）：每兵种每回合**主动攻击一个目标**；主目标吃满伤害后，
 *     超出部分对射程内其他每个敌方兵种各溅射 30%（T.SPLASH_PCT）。"""
assert src.count(old4) == 1, ('header', src.count(old4))
src = src.replace(old4, new4, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('OK tactic.js 需求3 单目标+30%溅射 落盘')
print('diff chars:', len(src) - len(orig))
