# -*- coding: utf-8 -*-
"""
patch_v89118f_boost.py — 沙盘保真度根因修复：**战斗加成快照**

病根（600×30h 试玩抓出，23 场 verify=false）：
  战报沙盘重跑（`sandboxOf`）与史实结果不一致。差异来源 = 引擎在重跑时读的是
  **当前**的全局加成（科技 `techBonus` / 天时·年号 `STORY.combatMod` / 羁绊
  `atkMult·siegeMult·cityDefMult` / 战鼓 buff），而史实用的是**那一刻**的 ——
  30h 里这些都会漂移（科技升级、换季换天气、羁绊解锁、战鼓到期）。

修法（与 v89.102「配方必须与开打那一刻逐字节一致」同一原则的延伸）：
  · `GAME.battle.boostSnapshot()` —— 唯一出口，把引擎侧全部全局加成打成小快照
    （techs / world / buffs / atkMult / siegeMult / cityDefMult；纯数据，~几百字节）；
  · `GAME.battle.withBoost(bs, fn)` —— 结算与重跑期间把快照**临时装回全局读点**，
    用完还原（try/finally）；
  · 快照随配方（`rc.boost`）与挂起会话（`_sim.boost`）随身携带 →
    史实结算、挂起重放、沙盘重跑三者读的是**同一份**加成。

改点：
  battle.js：boostSnapshot / withBoost / sandboxOf 包层（_sandboxBuild）/ 配方带 boost /
             expedition 采集与使用 / _suspendExpedition 透传
  state.js ：invasionResolve（守城）同办
"""
import io, os, sys

R = 'E:/Deepseekdb/'
files = {}


def load(p):
    if p not in files:
        files[p] = io.open(R + p, encoding='utf-8').read()
    return files[p]


def edit(path, old, new, tag):
    s = load(path)
    n = s.count(old)
    if n != 1:
        print('!! [%s] 锚点匹配 %d 次（应为 1）→ 中止' % (tag, n))
        sys.exit(1)
    files[path] = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


# ================================================================
# F1. 新增 boostSnapshot / withBoost（放在 sandboxRecipeOf 之前）
# ================================================================
edit('js/battle.js',
"""  GAME.battle.sandboxRecipeOf = function (r, atkArmy, gen, scArmy, scVal, scGen, simOpts, extra) {""",
"""  /* ============================================================
   * v89.118（600×30h 试玩）：「战斗加成快照」—— 沙盘保真度的根因修复
   * ------------------------------------------------------------
   * 引擎在结算/重跑时读**全局**加成：`systems.techBonus`（科技）、
   * `STORY.combatMod()`（天时 weather + 年号 era）、`STORY.atkMult/siegeMult/
   * cityDefMult`（羁绊）、`state.buffs`（战鼓 buff）。这些在 30 小时里都会漂移 ——
   * 于是**重跑读"现在"、史实读"那一刻"**，verify 必然出现假不一致（实测 23 场）。
   *
   * 口径（沿用 v89.102 的教训"配方必须与开打那一刻逐字节一致"）：
   *   · boostSnapshot() 在**开打那一刻**采集（纯数据小快照）；
   *   · withBoost() 在结算/重跑期间把它临时装回全局读点，用完**逐项还原**；
   *   · 快照随配方与挂起会话走（rc.boost / _sim.boost）——
   *     史实结算、挂起重放、沙盘重跑三者同源。
   * 采集清单 = 引擎侧全部全局读点（tactic.js 里的 TB/combatMod/atkMult/siegeMult/
   * buffActive 与 state.buffs）—— 新增读点时要往这里补一项，别只改一边。
   * ============================================================ */
  GAME.battle.boostSnapshot = function () {
    var st = GAME.state || {}, S = GAME.story || {};
    try {
      return {
        techs: U.deep(st.techs || {}),            /* → systems.techBonus（TB 全部 type） */
        world: U.deep(st.world || {}),            /* → STORY.combatMod（天时/年号，由 world 推导） */
        buffs: U.deep(st.buffs || {}),            /* → systems.buffActive + st.buffs.military */
        atkMult: (S.atkMult ? S.atkMult() : 1),   /* 羁绊「攻」× 年号 atkEra */
        siegeMult: (S.siegeMult ? S.siegeMult() : 1),
        cityDefMult: (S.cityDefMult ? S.cityDefMult() : 1),
        defAdd: (S.defMult ? S.defMult() : 0),    /* 羁绊「守御」（战役层也读） */
      };
    } catch (e) { return null; }
  };
  /* 把快照装回全局读点跑 fn，然后逐项还原。bs 为空 → 直接跑（旧档 / 无快照的仗）。 */
  GAME.battle.withBoost = function (bs, fn) {
    if (!fn) return null;
    if (!bs) return fn();
    var st = GAME.state, S = GAME.story;
    if (!st || !S) return fn();
    var bak = {
      techs: st.techs, world: st.world, buffs: st.buffs,
      atkMult: S.atkMult, siegeMult: S.siegeMult, cityDefMult: S.cityDefMult, defMult: S.defMult,
    };
    try {
      if (bs.techs) st.techs = bs.techs;
      if (bs.world) st.world = bs.world;
      st.buffs = bs.buffs || {};
      if (bs.atkMult != null) S.atkMult = function () { return bs.atkMult; };
      if (bs.siegeMult != null) S.siegeMult = function () { return bs.siegeMult; };
      if (bs.cityDefMult != null) S.cityDefMult = function () { return bs.cityDefMult; };
      if (bs.defAdd != null) S.defMult = function () { return bs.defAdd; };
      return fn();
    } finally {
      st.techs = bak.techs; st.world = bak.world; st.buffs = bak.buffs;
      S.atkMult = bak.atkMult; S.siegeMult = bak.siegeMult;
      S.cityDefMult = bak.cityDefMult; S.defMult = bak.defMult;
    }
  };

  GAME.battle.sandboxRecipeOf = function (r, atkArmy, gen, scArmy, scVal, scGen, simOpts, extra) {""",
'F1 boostSnapshot/withBoost')

# ================================================================
# F2. 配方带 boost
# ================================================================
edit('js/battle.js',
"""      ourSide: (extra.ourSide === 'def') ? 'def' : 'atk',
      wall: extra.wall || null,""",
"""      ourSide: (extra.ourSide === 'def') ? 'def' : 'atk',
      wall: extra.wall || null,
      /* v89.118：**战斗加成快照**（开打那一刻的科技/天时/年号/羁绊/战鼓）——
         重跑靠它把全局读点装回史实那一刻（否则 30h 后重跑必然 verify=false）。 */
      boost: extra.boost || null,""",
'F2 配方带 boost')

# ================================================================
# F3. sandboxOf 包 withBoost（函数体挪进 _sandboxBuild）
# ================================================================
edit('js/battle.js',
"""  GAME.battle.sandboxOf = function (rep) {
    var rc = rep && rep.sandbox;
    if (!rc || !GAME.tactic || !GAME.tactic.begin) return null;""",
"""  GAME.battle.sandboxOf = function (rep) {
    var rc = rep && rep.sandbox;
    if (!rc || !GAME.tactic || !GAME.tactic.begin) return null;
    /* v89.118：重跑期间把**史实那一刻的加成快照**装回全局读点 —— 否则读的是"现在"
       的科技/天时/年号/羁绊/战鼓，与史实不同源（30h 试玩实测 23 场假不一致）。 */
    return GAME.battle.withBoost(rc.boost || null, function () {
      return GAME.battle._sandboxBuild(rc);
    });
  };
  /* 沙盘构建本体（在 withBoost 的加成快照内执行；逻辑与 v89.102 逐字相同） */
  GAME.battle._sandboxBuild = function (rc) {
    /* 快照缺失 / 空阵 → 没有沙盘（不许拿"0 回合 0 损失"当通过：那是假绿，
       真机踩过 —— `returnArmy` 清零后的 atkArmy 被写进配方）。 */
    if (GAME.battle.marchMenOf(rc.atkArmy) <= 0) return null;""",
'F3 sandboxOf 包层（一步到位）')

# ================================================================
# F4. _suspendExpedition 透传 boost
# ================================================================
edit('js/battle.js',
"""      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,
             scGen: simIn.scGen ? U.deep(simIn.scGen) : null,
             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {} },""",
"""      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,
             scGen: simIn.scGen ? U.deep(simIn.scGen) : null,
             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {},
             /* v89.118：战斗加成快照随挂起会话走（结算与重跑同源） */
             boost: simIn.boost || null },""",
'F4 挂起透传 boost')

# ================================================================
# F5. expedition：采集 / 挂起 / 结算 / 配方
# ================================================================
edit('js/battle.js',
"""    if (opts._sim) {                       /* 重放：用挂起时保存的权威输入（不重算） */
      scArmy = opts._sim.scArmy || {}; scVal = opts._sim.scVal || 0;""",
"""    /* v89.118：战斗加成快照 —— 开打那一刻采集；重放沿用挂起时的那份（三者同源） */
    var _boost = (opts._sim && opts._sim.boost) || GAME.battle.boostSnapshot();
    if (opts._sim) {                       /* 重放：用挂起时保存的权威输入（不重算） */
      scArmy = opts._sim.scArmy || {}; scVal = opts._sim.scVal || 0;""",
'F5a 采集 boost')

edit('js/battle.js',
"""      return GAME.battle._suspendExpedition(target, modeId, atkArmy, genId, opts,
        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts,
          duel: duel, genSim: genSim });""",
"""      return GAME.battle._suspendExpedition(target, modeId, atkArmy, genId, opts,
        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts,
          duel: duel, genSim: genSim, boost: _boost });""",
'F5b 挂起带 boost')

edit('js/battle.js',
"""    var result = opts._result || GAME.battle.simulate(atkArmy, genSim, scArmy, scVal, scGen, simOpts);""",
"""    /* v89.118：结算也在加成快照内跑 —— 史实结果 = "那一刻的加成"下的结果，
       与沙盘重跑（装回同一份快照）逐字节同源。 */
    var result = opts._result || GAME.battle.withBoost(_boost, function () {
      return GAME.battle.simulate(atkArmy, genSim, scArmy, scVal, scGen, simOpts);
    });""",
'F5c 结算包 withBoost')

edit('js/battle.js',
"""      sandbox: GAME.battle.sandboxRecipeOf(result, _sbArmy, _sbGen, scArmy, scVal, scGen, simOpts,
        { cmds: (opts._sim && opts._sim.history) || null,
          place: { kind: t.kind, terrain: t.terrain || null } }),""",
"""      sandbox: GAME.battle.sandboxRecipeOf(result, _sbArmy, _sbGen, scArmy, scVal, scGen, simOpts,
        { cmds: (opts._sim && opts._sim.history) || null,
          place: { kind: t.kind, terrain: t.terrain || null },
          boost: _boost }),""",
'F5d 配方带 boost')

# ================================================================
# F6. 守城（state.js）
# ================================================================
edit('js/state.js',
"""    var result = null;
    try {
      result = GAME.tactic.simulate(ia.army, null, city.army, defVal, guard, simOpts);
    } catch (e) {""",
"""    var result = null;
    /* v89.118：与出征同办 —— **开打那一刻的加成快照**（科技/天时/年号/羁绊/战鼓）。
       守城的战报沙盘也要靠它才能与史实同源（30h 试玩实测：守城一路同样 verify=false）。 */
    var _boost118 = GAME.battle.boostSnapshot ? GAME.battle.boostSnapshot() : null;
    try {
      var _runSim118 = function () {
        return GAME.tactic.simulate(ia.army, null, city.army, defVal, guard, simOpts);
      };
      result = (GAME.battle.withBoost ? GAME.battle.withBoost(_boost118, _runSim118) : _runSim118());
    } catch (e) {""",
'F6a 守城结算包 withBoost')

edit('js/state.js',
"""        out._sandbox = GAME.battle.sandboxRecipeOf(result, ia.army, null, defArmy0, defVal, guard,
          simOpts, {
            place: { kind: 'city', name: city.name },
            ourSide: 'def',
            wall: { lv: wallLv, towers: towers },
          });""",
"""        out._sandbox = GAME.battle.sandboxRecipeOf(result, ia.army, null, defArmy0, defVal, guard,
          simOpts, {
            place: { kind: 'city', name: city.name },
            ourSide: 'def',
            wall: { lv: wallLv, towers: towers },
            boost: _boost118,          /* v89.118：加成快照随配方走（重跑装回） */
          });""",
'F6b 守城配方带 boost')

# ================================================================
# 落盘（原子 + 自检）
# ================================================================
base = {}
for p in files:
    base[p] = io.open(R + '.workbuddy/backup/v89118/' + os.path.basename(p), encoding='utf-8').read()

for p, s in files.items():
    assert '<<<<<<<' not in s, p
    d0 = (s.count('{') - s.count('}')) - (base[p].count('{') - base[p].count('}'))
    if d0 != 0:
        print('!! %s 花括号净变化 %+d → 中止' % (p, d0))
        sys.exit(1)
    tmp = R + p + '.tmp118f'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s（净 %+d）' % (p, d0))
print('补丁 F 完成')
