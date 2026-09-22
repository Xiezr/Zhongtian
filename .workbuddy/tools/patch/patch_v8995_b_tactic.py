# -*- coding: utf-8 -*-
"""v89.95 Patch B —— 战斗核心：取消溅射（一击一目标）+ 战场纵深/推进上限 + 速度受控成长。
幂等（命中标记即跳过）。"""
import io

# ============================================================
# ① js/tactic.js：去溅射 + 纵深/推进上限
# ============================================================
P = 'js/tactic.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0


def rep(old, new, tag, path=None):
    global s, n
    if new in s:
        print('SKIP(已打): ' + tag)
        return
    assert old in s, 'MISS: ' + tag
    s = s.replace(old, new, 1)
    n += 1
    print('OK: ' + tag)


# --- ① 头部注释：规则说明改"一目标制" ---
rep(
""" *     超出部分对射程内其他每个敌方兵种各溅射 30%（T.SPLASH_PCT）。""",
""" *     **v89.95 起：一击只打一个目标兵种，溢出伤害作废（无溅射）**——
 *     老板原话：「战斗一个回合只对一个目标兵种出手，后续无溅射伤害」。
 *     改前是"主目标吃满后，溢出对射程内每个敌方兵种各溅射 30%"，
 *     结果是"一回合清掉对面两三支"、战斗 1~3 回合结束（没有回合对战可玩）。""",
'splash 注释')

# --- ② 纵深常量：让"接敌"至少走几回合 ---
rep(
"""  T.FIELD_MARGIN = 199;""",
"""  /* v89.95（B2）：纵深 = 最远射程 + MARGIN，且**不得小于 FIELD_MIN**。
     老板原话：「现在的速度对战斗具有决定性影响（一步到面前，先手打击，
     溅射伤害收场，根本没有回合对战乐趣）」。
     改前 FIELD_MIN=200、MARGIN=199 → 纯近战纵深 249，而长枪速度 300 →
     **第 1 回合就贴脸**，先手方一轮打光对手。现在纵深 ≥1400，
     接敌要走 3~5 回合，速度的收益变成"早到一两回合"而不是"一轮定胜负"。 */
  T.FIELD_MARGIN = 299;""",
'FIELD_MARGIN')

rep(
"""  T.FIELD_MIN = 200;""",
"""  T.FIELD_MIN = 1400;""",
'FIELD_MIN')

rep(
"""  T.SPLASH_PCT = 0.30;""",
"""  /* v89.95（B1）：`T.SPLASH_PCT` **退役**（一击一目标，溢出作废）。
     保留常量 = 0 只为兼容旧引用点（smoke 的老断言会改成新口径）。 */
  T.SPLASH_PCT = 0;""",
'SPLASH_PCT 退役')

# --- ③ 推进上限：任何单位单回合不得横穿半个战场 ---
rep(
"""  T.MARCH_UNIT = 1;""",
"""  T.MARCH_UNIT = 1;
  /* v89.95（B2）：**单回合推进上限** = 纵深 × MARCH_CAP_FRAC。
     速度再高也不能一回合贴脸（老板：「一步到面前」）——超出的部分被截掉，
     于是"速度优势"表现为**早 1~2 回合接敌**，而不是"一轮打光"。 */
  T.MARCH_CAP_FRAC = 0.35;
  T.advanceCapOf = function (D) {
    return Math.max(60, Math.round((D || T.FIELD_MIN) * T.MARCH_CAP_FRAC));
  };""",
'推进上限')

rep(
"""          var step = Math.min(u.spd * T.MARCH_UNIT, free);
          u.adv += step;""",
"""          var step = Math.min(u.spd * T.MARCH_UNIT, free);
          var _cap = T.advanceCapOf(D);
          if (step > _cap) step = _cap;
          u.adv += step;""",
'推进截断')

rep(
"""          var back = Math.min(u.spd * T.MARCH_UNIT, u.adv + D);""",
"""          var back = Math.min(u.spd * T.MARCH_UNIT, u.adv + D);
          var _capB = T.advanceCapOf(D);
          if (back > _capB) back = _capB;""",
'后退同样截断')

# --- ④ fireOnce：删除溅射段（溢出作废） ---
rep(
"""       * v89.87（老板拍板）：**主动攻击 = 单主目标制**
       * ------------------------------------------------------------
       *   · 主目标 = 指定目标（`preferId` 已排到池首）/ 否则最近的一支；
       *   · 主目标吃满本次攻击的全部伤害（自然钳制：最多打光它）；
       *   · 吃满后的**超出伤害**对射程内其他每个敌方兵种各溅射 30%
       *     （`ctx.splashTargets`，由 actSide 预先筛好"在射程内"的其他兵种）。
       * 箭塔火力与反击**不传 `ctx.single`** → 走下方原溢出逻辑，行为不变。
       * ============================================================ */""",
"""       * v89.87（老板拍板）：**主动攻击 = 单主目标制**
       * ------------------------------------------------------------
       *   · 主目标 = 指定目标（`preferId` 已排到池首）/ 否则最近的一支；
       *   · 主目标吃满本次攻击的全部伤害（自然钳制：最多打光它）。
       * v89.95（B1 · 老板「一回合只对一个目标兵种出手，后续无溅射伤害」）：
       *   · **删除溅射** —— 主目标被打光后，**溢出伤害作废**，不再分给别的兵种；
       *   · 连带效果：一回合最多打掉**一支**部队，战斗从 1~3 回合拉长到多回合，
       *     "逐兵种指挥/阵位/计略"这些决策才真正有回本的空间。
       * 反击（counterStrike）本来就是"只打打我那一支"，天然合规。
       * ============================================================ */""",
'fireOnce 注释')

rep(
"""        if (over > 0 && ctx.splashTargets && ctx.splashTargets.length) {
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
        return { killed: killed, hits: hits, clash: Math.round(clash * 100) };""",
"""        /* v89.95（B1）：溢出作废 —— 不再对别的兵种溅射（一击一目标） */
        return { killed: killed, hits: hits, clash: Math.round(clash * 100) };""",
'删除溅射段')

# --- ⑤ wallVolley：城头火力也只打一支 ---
rep(
"""      var hits = [], killed = 0, dbl = 0;
      for (var pi = 0; pi < pool.length && av > 0; pi++) {
        var tg = pool[pi];
        /* ⚠️ v59：**必须按射程筛目标** —— 改前这里无条件打遍全场（v58 的城头射程
           几乎覆盖整个战场，所以那个漏检看不出来）；v59 后箭塔射程有真实上限
           （2350 一级），不筛就会出现"攻方退到射程外仍被箭塔打"的怪象
           —— 实测：弓兵连续后退到间距 2931、箭塔射程只有 1650，却仍每回合被杀 128 人，
           于是"后退躲箭塔"这条原版核心战术**根本用不出来**。
           按 adv 降序排列，所以一旦某支够不着，后面的更够不着 → 直接收工。 */""",
"""      var hits = [], killed = 0, dbl = 0;
      /* v89.95（B1）：城头火力同样**一击一目标** —— 只打射程内最靠前的那一支。
         改前是"由近及远逐个分伤"，同样属于溅射的一种（一轮打掉两三支）。 */
      var _poolOne = pool.slice(0, 1);
      for (var pi = 0; pi < _poolOne.length && av > 0; pi++) {
        var tg = _poolOne[pi];
        /* ⚠️ v59：**必须按射程筛目标** —— 改前这里无条件打遍全场（v58 的城头射程
           几乎覆盖整个战场，所以那个漏检看不出来）；v59 后箭塔射程有真实上限
           （2350 一级），不筛就会出现"攻方退到射程外仍被箭塔打"的怪象
           —— 实测：弓兵连续后退到间距 2931、箭塔射程只有 1650，却仍每回合被杀 128 人，
           于是"后退躲箭塔"这条原版核心战术**根本用不出来**。
           按 adv 降序排列，所以一旦某支够不着，后面的更够不着 → 直接收工。 */""",
'城头单目标')

if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED tactic.js x%d' % n)
else:
    print('NOCHANGE tactic.js')
