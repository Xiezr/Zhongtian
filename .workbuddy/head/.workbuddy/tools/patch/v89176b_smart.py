# v89.176 补丁 B：战斗层 —— smartStanceOf 加阵型模式 / smartApply 传 mode /
#                 smartArbitrate 扩到 5×4 联合赛马 + 保兵评分 / 撤退闸三出口 / stepBattle 接闸
import io

ROOT = 'E:/Deepseekdb/'
def read(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def write(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(f, tag, old, new):
    s = read(f)
    first = new.split('\n')[0].strip()
    if first and first in s:
        print('[skip] ' + tag + '（已在）'); return
    c = s.count(old)
    assert c == 1, tag + ' 锚点命中 ' + str(c) + ' 次'
    s = s.replace(old, new)
    write(f, s)
    print('[ok] ' + tag)

F = 'js/battle.js'

# ============================================================
# B1 smartStanceOf：加 mode（第 4 参，默认 echelon = 行为与改前逐字一致）
# ============================================================
rep(F, 'B1 smartStanceOf + modes',
"""  GAME.battle.smartStanceOf = function (u, gap, plan) {
    plan = plan || GAME.battle.smartPlanOf();
    if ((u.range || 0) >= 500) {
      return (gap <= u.range * (plan.rangeK || 1)) ? 'hold' : 'advance';
    }
    var isCav = (u.spd || 0) >= 400;
    var k = isCav ? (plan.gapCav != null ? plan.gapCav : 250)
                  : (plan.gapInf != null ? plan.gapInf : 250);
    return (gap <= k) ? 'hold' : 'advance';
  };""",
"""  GAME.battle.smartStanceOf = function (u, gap, plan, mode) {
    plan = plan || GAME.battle.smartPlanOf();
    mode = mode || 'echelon';
    /* v89.176（老板「总体策略是齐头并进，针尖麦芒，还是退守底线消耗，一波冲锋。
       还是错落有致，进退有据逐一消灭，伺机全军出动」）：**阵型模式**（第 4 参）——
       与目标规则正交：本函数只决定"动作"，打谁由 smartPickTarget 决定。
       模式表与标定数据见 DATA.SMART_PLAN.modes 注释（probe_v89176d_modes）。
       `plan.fastestId`（spear 的尖刀）由 smartApply 经 planX 传入；单独调用缺省时
       spear 自动回落到 echelon 分支（纯函数不依赖外部状态）。 */
    if (mode === 'turtle') return 'hold';        /* 退守消耗：全军原地（受创减半） */
    if (mode === 'charge') return 'advance';     /* 一波冲锋：全军全速、永不转防御 */
    var _er = (u.er != null ? u.er : (u.range || 0));
    if (mode === 'line') {                       /* 齐头并进：贴到**射程边缘**才转防御 */
      return (gap <= _er) ? 'hold' : 'advance';
    }
    if (mode === 'spear' && plan.fastestId && u.id === plan.fastestId) {
      return 'advance';                          /* 针尖麦芒：尖刀（最快一档）持续前压 */
    }
    /* echelon 错落有致（默认 · v89.164 标定 —— 与此前逐字一致） */
    if ((u.range || 0) >= 500) {
      return (gap <= u.range * (plan.rangeK || 1)) ? 'hold' : 'advance';
    }
    var isCav = (u.spd || 0) >= 400;
    var k = isCav ? (plan.gapCav != null ? plan.gapCav : 250)
                  : (plan.gapInf != null ? plan.gapInf : 250);
    return (gap <= k) ? 'hold' : 'advance';
  };""")

# ============================================================
# B2 smartApply：读 mode + 算 fastestId（经 planX 传纯函数）
# ============================================================
rep(F, 'B2a smartApply 读 mode',
"""    var plan = GAME.battle.smartPlanOf();
    /* v89.175：目标规则（首回合赛马选定；缺省 static = v89.164 静态表，行为不变） */
    var rule = rec.smartRule || 'static';
    var mine = (env.units && env.units.atk) || [];
    var theirs = (env.units && env.units.def) || [];
    var D = env.field || 1, themFront = 0;""",
"""    var plan = GAME.battle.smartPlanOf();
    /* v89.175：目标规则（首回合赛马选定；缺省 static = v89.164 静态表，行为不变）
       v89.176：阵型模式（modes × rules 联合赛马；缺省 echelon = v89.164 标定，行为不变） */
    var rule = rec.smartRule || 'static';
    var mode = rec.smartMode || 'echelon';
    var mine = (env.units && env.units.atk) || [];
    var theirs = (env.units && env.units.def) || [];
    /* v89.176：尖刀是谁 —— 我军存活部队里 spd 最高的一支（spear 模式用；经 planX
       传入 smartStanceOf，让它保持纯函数）。 */
    var _fastest = '', _fspd = -1;
    mine.forEach(function (x) { if (x.count > 0 && (x.spd || 0) > _fspd) { _fspd = x.spd || 0; _fastest = x.id; } });
    var planX = { gapInf: plan.gapInf, gapCav: plan.gapCav, rangeK: plan.rangeK,
      targets: plan.targets, fastestId: _fastest };
    var D = env.field || 1, themFront = 0;""")

rep(F, 'B2b smartApply 传参',
"""      var wantS = GAME.battle.smartStanceOf(u, D - u.adv - themFront, plan);""",
"""      var wantS = GAME.battle.smartStanceOf(u, D - u.adv - themFront, planX, mode);""")

# ============================================================
# B3 smartArbitrate：5 阵型 × 4 规则联合赛马 + 保兵评分（返回带 mode）
# ============================================================
rep(F, 'B3 smartArbitrate 升级',
"""  /* v89.175：**开战赛马** —— 把候选规则各全速模拟一遍（引擎确定 → 同输入同结果），
     按「胜 > 交换比」选最优；结果 `{ rule, scores }` 存 rec.smartPick（随档往返），
     每场只跑一次。实测成本 ≈ 4 套 × 9ms（probe_v89175b 计时）。 */
  GAME.battle.smartArbitrate = function (rec) {
    var plan = GAME.battle.smartPlanOf();
    var rules = (plan.rules || ['static']).slice();
    var t0 = Date.now();
    var gen = null;
    (GAME.state.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    var genSim = (rec.sim && rec.sim.genSim) || gen;
    var scores = [];
    rules.forEach(function (rule) {
      var env = null;
      try {
        env = GAME.tactic.begin(rec.atkArmy || {}, genSim, (rec.sim && rec.sim.scArmy) || {},
          (rec.sim && rec.sim.scVal) || 0, (rec.sim && rec.sim.scGen) || null,
          (rec.sim && rec.sim.simOpts) || {});
      } catch (e) { env = null; }
      if (!env) return;
      var recX = { side: 'atk', cmd: {}, smartRule: rule };
      var g = 0;
      while (!env.over && g++ < 40) { GAME.battle.smartApply(recX, env); env.step(); }
      var aRem = 0, dRem = 0, aStart = 0, dStart = 0;
      env.units.atk.forEach(function (u) { aStart += u.start; if (u.count > 0) aRem += u.count; });
      env.units.def.forEach(function (u) { dStart += u.start; if (u.count > 0) dRem += u.count; });
      var win = aRem > 0 && dRem === 0;
      var ratio;
      if (dRem === 0) ratio = (aStart > aRem) ? (dStart / (aStart - aRem)) : 999;
      else ratio = (dStart - dRem) / Math.max(0.0001, (aStart - aRem));
      ratio = Math.round(ratio * 100) / 100;
      scores.push({ rule: rule, win: win, ratio: ratio, rounds: g });
    });
    var best = null, bestSc = -1e9;
    scores.forEach(function (s) {
      var sc = (s.win ? 10000 : 0) + s.ratio;
      if (sc > bestSc) { bestSc = sc; best = s.rule; }
    });
    return { rule: best || 'static', scores: scores, ms: Date.now() - t0 };
  };""",
"""  /* v89.175：**开战赛马** —— 候选策略各全速模拟一遍（引擎确定 → 同输入同结果）。
     v89.176：候选空间从 4 条目标规则扩到 **5 阵型 × 4 目标 = 20 组合**；
     评分从「胜 > 交换比」改为「**胜 > 保兵率 > 交换比**」——老板「减少伤亡很重要，
     或者最重要」：同胜局面选**我方损失最小**的组合，劣局同样优先保兵。
     结果 `{ rule, mode, scores }` 存 rec.smartPick（随档往返），每场只跑一次；
     成本（probe_v89176d 实测）20 组合 ≈ 数十毫秒（首回合一次，长跑无感）。 */
  GAME.battle.smartArbitrate = function (rec) {
    var plan = GAME.battle.smartPlanOf();
    var rules = (plan.rules || ['static']).slice();
    var modes = (plan.modes || ['echelon']).slice();
    var t0 = Date.now();
    var gen = null;
    (GAME.state.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    var genSim = (rec.sim && rec.sim.genSim) || gen;
    var scores = [];
    modes.forEach(function (mode) {
      rules.forEach(function (rule) {
        var env = null;
        try {
          env = GAME.tactic.begin(rec.atkArmy || {}, genSim, (rec.sim && rec.sim.scArmy) || {},
            (rec.sim && rec.sim.scVal) || 0, (rec.sim && rec.sim.scGen) || null,
            (rec.sim && rec.sim.simOpts) || {});
        } catch (e) { env = null; }
        if (!env) return;
        var recX = { side: 'atk', cmd: {}, smartRule: rule, smartMode: mode };
        var g = 0;
        while (!env.over && g++ < 40) { GAME.battle.smartApply(recX, env); env.step(); }
        var aRem = 0, dRem = 0, aStart = 0, dStart = 0;
        env.units.atk.forEach(function (u) { aStart += u.start; if (u.count > 0) aRem += u.count; });
        env.units.def.forEach(function (u) { dStart += u.start; if (u.count > 0) dRem += u.count; });
        var win = aRem > 0 && dRem === 0;
        var ratio;
        if (dRem === 0) ratio = (aStart > aRem) ? (dStart / (aStart - aRem)) : 999;
        else ratio = (dStart - dRem) / Math.max(0.0001, (aStart - aRem));
        ratio = Math.round(ratio * 100) / 100;
        var aLoss = aStart > 0 ? Math.round((aStart - aRem) / aStart * 1000) / 1000 : 0;
        scores.push({ mode: mode, rule: rule, win: win, ratio: ratio, aLoss: aLoss, rounds: g });
      });
    });
    var best = null, bestSc = -1e30;
    scores.forEach(function (s) {
      var sc = (s.win ? 1e6 : 0) + (1 - s.aLoss) * 1e4 + Math.min(s.ratio, 999);
      if (sc > bestSc) { bestSc = sc; best = s; }
    });
    return { rule: (best && best.rule) || 'static', mode: (best && best.mode) || 'echelon',
      scores: scores, ms: Date.now() - t0 };
  };
  /* v89.176：保兵闸的三个读数出口（stepBattle 与界面共用 —— 数值只改 DATA.SMART_PLAN） */
  GAME.battle.retreatAtOf = function () {
    var p = GAME.battle.smartPlanOf();
    return (p && p.retreatAt != null) ? p.retreatAt : 0.30;
  };
  GAME.battle.warnAtOf = function () {
    var p = GAME.battle.smartPlanOf();
    return (p && p.warnAt != null) ? p.warnAt : 0.22;
  };
  /* 我方当前损失率（从会话快照算：start 总量 ↔ 现存总量；无快照/无 start → 0） */
  GAME.battle.lossRatioOf = function (ses) {
    if (!ses || !ses.snap) return 0;
    var snap = null;
    try { snap = ses.snap(); } catch (e) { return 0; }
    var s0 = 0, s1 = 0;
    ((snap && snap.atk) || []).forEach(function (u) { s0 += (u.start || 0); s1 += (u.count || 0); });
    if (s0 <= 0) return 0;
    return Math.max(0, (s0 - s1) / s0);
  };
  /* 目标是否"非拿下不可"（撤不得）—— 口径：**名城**（县城及以上系统城，
     GAME.isFamousCity 唯一出口）。野地 / 据点 / 自建城 → false（到线可撤）。 */
  GAME.battle.mustTakeOf = function (rec) {
    try {
      if (!rec || !rec.target) return false;
      var t = GAME.battle.resolveTarget(rec.target);
      if (!t || !t.ok || t.kind !== 'city') return false;
      return !!(t.npc && GAME.isFamousCity && GAME.isFamousCity(t.npc));
    } catch (e) { return false; }
  };""")

# ============================================================
# B4 stepBattle：mode 记录 + 撤退闸 + 预警
# ============================================================
rep(F, 'B4 stepBattle 撤退闸',
"""    if (GAME.battle.smartOnOf()) {
      if (!rec.smartPick) rec.smartPick = GAME.battle.smartArbitrate(rec);
      if (rec.smartPick && rec.smartPick.rule) rec.smartRule = rec.smartPick.rule;
      var _sm175 = GAME.battle.smartApply(rec, ses);
      rec.smartNote = { r: (rec.round || 0) + 1, n: _sm175.n, notes: _sm175.notes, rule: rec.smartRule };
      (rec.smartLog = rec.smartLog || []).push(rec.smartNote);
      if (rec.smartLog.length > 80) rec.smartLog.shift();
    }""",
"""    if (GAME.battle.smartOnOf()) {
      if (!rec.smartPick) rec.smartPick = GAME.battle.smartArbitrate(rec);
      if (rec.smartPick && rec.smartPick.rule) rec.smartRule = rec.smartPick.rule;
      if (rec.smartPick && rec.smartPick.mode) rec.smartMode = rec.smartPick.mode;
      var _sm175 = GAME.battle.smartApply(rec, ses);
      rec.smartNote = { r: (rec.round || 0) + 1, n: _sm175.n, notes: _sm175.notes,
        rule: rec.smartRule, mode: rec.smartMode };
      (rec.smartLog = rec.smartLog || []).push(rec.smartNote);
      if (rec.smartLog.length > 80) rec.smartLog.shift();
      /* ============================================================
       * v89.176（老板「减少伤亡很重要……损伤 30% 的局面，宁愿撤退。
       *   除非是有非拿下不可的目标比如名城」）：**保兵闸**。
       * 损失达线（DATA.SMART_PLAN.retreatAt）且目标非名城 → 走既有撤退落账
       * （retreatBattle：残部带回、本波破防按半计）；到线原因写进 smartNote
       * 与战报日志（问题可见）。名城（县城及以上系统城）死战不退。
       * 返回 null = 本回合无正常推进记录（已按撤退结算，调用方照常收尾）。
       * ============================================================ */
      var _lr176 = GAME.battle.lossRatioOf(ses);
      if (_lr176 >= GAME.battle.retreatAtOf() && !GAME.battle.mustTakeOf(rec)) {
        rec.smartNote.retreat = true;
        rec.smartNote.notes = rec.smartNote.notes || [];
        rec.smartNote.notes.push('损失 ' + Math.round(_lr176 * 100) + '% 达撤退线 → 保兵撤退');
        GAME.log.war('🏳️ 智能托管：损失达 ' + Math.round(_lr176 * 100) + '%（撤退线 '
          + Math.round(GAME.battle.retreatAtOf() * 100) + '%），按保兵策略主动撤退（残部带回）');
        GAME.battle.retreatBattle(id);
        return null;
      }
      if (_lr176 >= GAME.battle.warnAtOf() && !rec.smartWarned) {
        rec.smartWarned = true;
        GAME.log.war('⚠️ 智能托管：损失 ' + Math.round(_lr176 * 100) + '% 已近撤退线（'
          + Math.round(GAME.battle.retreatAtOf() * 100) + '%）—— 非名城目标到线将自动撤退（保兵）');
      }
    }""")

print('DONE-B')
