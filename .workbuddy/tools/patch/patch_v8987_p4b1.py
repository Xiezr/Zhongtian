# -*- coding: utf-8 -*-
"""v89.87 需求4b：战斗观战会话 —— battle.js 核心（挂起/推进/落账重放/恢复）

改动：
  ① expedition 模拟点前：挂起判定（_needWatch）→ _suspendExpedition；支持 _sim/_result 重放
  ② 新增观战引擎块（攻占处理注释前）：_needWatch/_makeEnv/_suspendExpedition/
     stepBattle/autoBattle/finishBattle/tick/restoreBattles/pendingCount
  ③ march.arrive：pending 返回时不把 gen 状态置 idle（战斗中保持 'march'）
"""
import io

P = r'E:\Deepseekdb\js\battle.js'
src = io.open(P, encoding='utf-8', newline='').read()

# ---------- ① expedition 挂起：simulate 调用点拆出 simOpts ----------
oldA = """    var result = GAME.battle.simulate(atkArmy, gen, scArmy, scVal, scGen,
      { sieging: t.kind === 'city', kind: t.kind, defName: t.name, wallLv: tWallLv,"""
newA = """    /* ============================================================
     * v89.87（老板需求 4 · 战斗观战）：出征战斗改为**会话制**
     * ------------------------------------------------------------
     * 开启观战（settings.battleWatch !== false）且非自动时，抵达不再立即
     * 跑完模拟 —— 在此建立战场会话并挂起（GAME.battle.stepBattle 逐回合
     * 推进，60 真实秒/回合、可提前完成）；战斗结束由 finishBattle 带
     * `opts._result` 重入本函数，从同一锚点继续走下方**既有落账段** ——
     * 一场战斗、一段代码、两条路径，落账逻辑零复制。
     * `opts._sim`：挂起时保存的战斗输入（重放用 —— 保证与首算逐字节一致）。
     * ============================================================ */
    var simOpts = { sieging: t.kind === 'city', kind: t.kind, defName: t.name, wallLv: tWallLv,"""
assert src.count(oldA) == 1, ('A', src.count(oldA))
src = src.replace(oldA, newA, 1)

oldB = "        towers: (t.npc && GAME.towerCountOf) ? GAME.towerCountOf(t.npc) : null });"
newB = """        towers: (t.npc && GAME.towerCountOf) ? GAME.towerCountOf(t.npc) : null };
    if (opts._sim) {                       /* 重放：用挂起时保存的权威输入（不重算） */
      scArmy = opts._sim.scArmy || {}; scVal = opts._sim.scVal || 0;
      scGen = opts._sim.scGen || null; scNote = opts._sim.scNote || null;
      simOpts = opts._sim.simOpts || simOpts;
    } else if (!opts._result && GAME.battle._needWatch(opts)) {
      /* 观战：建立会话挂起（落账上下文一并保存） */
      return GAME.battle._suspendExpedition(target, modeId, atkArmy, genId, opts,
        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts });
    }
    var result = opts._result || GAME.battle.simulate(atkArmy, gen, scArmy, scVal, scGen, simOpts);"""
assert src.count(oldB) == 1, ('B', src.count(oldB))
src = src.replace(oldB, newB, 1)

# ---------- ② 观战引擎块（插在攻占处理注释前） ----------
anchor = "  /* --------- 攻占处理 ---------"
assert src.count(anchor) == 1, ('anchor', src.count(anchor))

ENGINE = """  /* ============================================================
   * v89.87（老板需求 4）：战斗观战 —— 会话挂起 / 逐回合推进 / 落账重放
   * ------------------------------------------------------------
   * · 玩家出征战斗抵达后不再即时结算：挂起到 `s.battles`（纯数据，随存档走），
   *   由战场界面逐回合指挥（`settings.battleSec` 真实秒/回合，点「完成」提前结算）；
   * · 会话引擎 = `GAME.tactic.begin` 的**确定性**会话（同输入必得同结果），
   *   每回合指令快照进 `history` —— 读档恢复 = 重建会话 + 按 history 重放；
   * · 战斗结束 → `finishBattle` 重入 expedition（opts._result/_sim）走既有落账段；
   * · 无界面时也照常走表（60 秒一回合自动结算）——"后台照常走"（老板拍板）。
   * ============================================================ */
  /* 是否需要玩家指挥（观战）：未显式自动 + 设置开启 */
  GAME.battle._needWatch = function (opts) {
    var s = GAME.state;
    if (opts && opts.auto) return false;
    return !(s && s.settings && s.settings.battleWatch === false);
  };

  /* 建立/重建会话：按 history 重放到当前回合（读档恢复与首建同一路径） */
  GAME.battle._makeEnv = function (rec) {
    var s = GAME.state;
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    var env = GAME.tactic.begin(rec.atkArmy, gen, rec.sim.scArmy || {}, rec.sim.scVal || 0,
      rec.sim.scGen || null, rec.sim.simOpts || {});
    (rec.history || []).forEach(function (h) {
      for (var tid in (h || {})) env.setCmd('atk', tid, h[tid]);
      env.step();
    });
    return env;
  };

  /* 挂起：保存战斗输入与落账上下文（s.battles 全为纯数据，可随存档往返） */
  GAME.battle._suspendExpedition = function (target, modeId, atkArmy, genId, opts, simIn) {
    var s = GAME.state;
    s.battles = s.battles || [];
    var id = 'bt' + (GAME._battleSeq = (GAME._battleSeq || 0) + 1);
    var rec = {
      id: id, kind: 'expedition', side: 'atk',
      target: U.deep(target), modeId: modeId,
      atkArmy: U.deep(atkArmy), genId: genId,
      cityId: opts.cityId || null, scheme: opts.scheme || null,
      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,
             scGen: simIn.scGen ? U.deep(simIn.scGen) : null,
             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {} },
      round: 0, cnt: (s.settings && s.settings.battleSec) || 60, state: 'live',
      cmd: {}, history: [], snapLast: null, evLast: [],
      bornAt: U.now(),
    };
    s.battles.push(rec);
    GAME._bsess = GAME._bsess || {};
    GAME._bsess[id] = GAME.battle._makeEnv(rec);
    GAME.log('⚔️ 大军已抵 ' + ((rec.target && rec.target.name) || '目标')
      + '，战斗待指挥（每回合 ' + rec.cnt + ' 秒，可点「完成」提前结算）');
    return { ok: true, pending: true, battleId: id, target: rec.target,
             msg: '抵达' + ((rec.target && rec.target.name) || '') + '，战斗待指挥' };
  };

  /* 找记录 */
  GAME.battle._recOf = function (id) {
    var out = null;
    ((GAME.state && GAME.state.battles) || []).forEach(function (b) { if (b.id === id) out = b; });
    return out;
  };

  /* 推进一回合：指令先落会话、快照进 history（重放一致），再 step */
  GAME.battle.stepBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var snapCmd = U.deep(rec.cmd || {});
    rec.history.push(snapCmd);
    for (var tid in snapCmd) ses.setCmd('atk', tid, snapCmd[tid]);
    var r = ses.step();
    if (!r) return null;
    rec.round = r.r;
    rec.evLast = r.events || [];
    rec.snapLast = r.snap || null;
    if (r.over) GAME.battle.finishBattle(id);
    return r;
  };

  /* 自动：用当前指令一键跑完（history 逐回合同步，读档重放仍一致） */
  GAME.battle.autoBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var snapCmd = U.deep(rec.cmd || {});
    for (var tid in snapCmd) ses.setCmd('atk', tid, snapCmd[tid]);
    var guard = 0;
    while (!ses.over && guard++ < 200) {
      rec.history.push(U.deep(snapCmd));
      ses.step();
    }
    return GAME.battle.finishBattle(id);
  };

  /* 结束：收尾组装 result → 重入 expedition 落账（_result/_sim）→ 清挂起 */
  GAME.battle.finishBattle = function (id) {
    var s = GAME.state;
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var result = ses.finish();
    rec.state = 'done';
    var resp = null, err = null;
    _expArmySettled = false;
    try {
      resp = GAME.battle.expedition(rec.target, rec.modeId, rec.atkArmy, rec.genId,
        { arrived: true, cityId: rec.cityId, scheme: rec.scheme,
          _result: result, _sim: rec.sim });
    } catch (e) { err = e; }
    /* 将领状态收尾（等价 arrive 的 idle 设置） */
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    if (gen && gen.status === 'march') gen.status = 'idle';
    /* 军账兜底（P-25 同口径）：落账异常 / 目标失效 → 折返 */
    if (err || !resp || resp.ok === false) {
      var city = rec.cityId ? GAME.cityById(rec.cityId) : null;
      var rolled = false;
      if (!_expArmySettled && city) {
        for (var aR in rec.atkArmy) city.army[aR] = (city.army[aR] || 0) + rec.atkArmy[aR];
        rolled = true;
      }
      _expArmySettled = true;
      GAME.log('⚠️ 战斗结算中止（' + (err ? '异常' : ((resp && resp.msg) || '目标已不存在')) + '）：'
        + (rolled ? '大军折返 ' + city.name : '军账已结'));
      if (err && typeof console !== 'undefined' && console.warn) console.warn('[finishBattle] 落账异常：', err);
    }
    s.battles = (s.battles || []).filter(function (b) { return b.id !== id; });
    delete GAME._bsess[id];
    GAME._battleJustDone = {
      id: id, ok: !(err || !resp || resp.ok === false),
      winner: result.winner, rounds: result.rounds,
      atkLoss: result.atkLoss, defLoss: result.defLoss,
      resp: resp || null, rolled: !!(err || !resp || resp.ok === false),
    };
    if (GAME.ui && GAME.ui.onBattleDone) GAME.ui.onBattleDone(GAME._battleJustDone);
    return resp;
  };

  /* 主循环倒计时（真实秒）：「后台照常走」——界面关闭也按表推进；
     界面动画播放中（rec.anim）暂停计时。 */
  GAME.battle.tick = function (dt) {
    var s = GAME.state;
    if (!s || !s.battles || !s.battles.length) return;
    var sec = (s.settings && s.settings.battleSec) || 60;
    s.battles.slice().forEach(function (rec) {
      if (rec.state !== 'live' || rec.anim) return;
      if (rec.cnt == null) rec.cnt = sec;
      rec.cnt -= (dt || 1);
      if (rec.cnt <= 0) {
        rec.cnt = sec;
        GAME.battle.stepBattle(rec.id);
      }
    });
  };

  /* 读档恢复：重建会话（按 history 重放）——live 战斗继续等指挥 */
  GAME.battle.restoreBattles = function () {
    var s = GAME.state;
    if (!s || !s.battles || !s.battles.length) return;
    GAME._bsess = GAME._bsess || {};
    var drop = [];
    s.battles.forEach(function (rec) {
      rec.anim = false;
      if (rec.state !== 'live') { drop.push(rec.id); return; }
      try {
        GAME._bsess[rec.id] = GAME.battle._makeEnv(rec);
      } catch (e) {
        try { GAME.battle.autoBattle(rec.id); } catch (e2) { drop.push(rec.id); }
      }
    });
    if (drop.length) s.battles = s.battles.filter(function (b) { return drop.indexOf(b.id) < 0; });
  };

  /* 待指挥战斗数（军务 / 徽标用） */
  GAME.battle.pendingCount = function () {
    var s = GAME.state;
    if (!s || !s.battles) return 0;
    var n = 0;
    s.battles.forEach(function (b) { if (b.state === 'live') n++; });
    return n;
  };

"""

src = src.replace(anchor, ENGINE + anchor, 1)

# ---------- ③ arrive：pending 时保持征战中 ----------
oldC = """    if (gen.status === 'march') gen.status = 'idle';
    if (err || !r || r.ok === false) {"""
newC = """    /* v89.87：观战挂起（pending）时将领**保持征战在外**，不置 idle ——
       等 finishBattle 落账后统一收尾（否则战斗中将领会被当成空闲可再派遣） */
    if (!(r && r.pending) && gen.status === 'march') gen.status = 'idle';
    if (err || !r || r.ok === false) {"""
assert src.count(oldC) == 1, ('C', src.count(oldC))
src = src.replace(oldC, newC, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('OK battle.js 观战引擎落盘（4b1）')
