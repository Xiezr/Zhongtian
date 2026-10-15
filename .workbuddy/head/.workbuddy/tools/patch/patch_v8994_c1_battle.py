# -*- coding: utf-8 -*-
"""v89.94 Patch C1 —— js/battle.js：
① prepare 战法校验；② 观战挂起带 ops；③ finishBattle 拆出 _settleBattle + retreatBattle；
④ expedition：奇袭放大计略 / 围困 / 围攻缩放 / 破防落账 / 下城闸门 / 战报字段 / msg。
每个替换都有断言（找不到锚点即失败），整体幂等（命中标记即跳过）。"""
import io

P = 'js/battle.js'
src = io.open(P, encoding='utf-8').read()
orig = src
n_ok = 0


def rep(old, new, tag, limit=1):
    global src, n_ok
    if new in src:
        print('SKIP(已打): ' + tag)
        return
    assert old in src, 'ANCHOR MISSING [' + tag + ']'
    src = src.replace(old, new, limit)
    n_ok += 1
    print('OK: ' + tag)


# ---------- ① prepare：战法校验（与界面同一判据） ----------
rep(
"""    /* v63（老板）：「野外城每天只能被掠夺一次」。""",
"""    /* v89.94（B2 · E2）：战法校验 —— 围困须据点/城池、奇袭须有计略（与界面同一判据） */
    var _opsIssue = GAME.opsConfigIssueOf(opts.ops, t, opts.scheme || null);
    if (_opsIssue) return { ok: false, msg: _opsIssue };

    /* v63（老板）：「野外城每天只能被掠夺一次」。""",
'prepare 战法校验')

# ---------- ② 观战挂起：rec 带 ops ----------
rep(
"""      cityId: opts.cityId || null, scheme: opts.scheme || null,
      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,""",
"""      cityId: opts.cityId || null, scheme: opts.scheme || null,
      ops: GAME.opsIdOf(opts.ops),                 /* v89.94（E2）：随军战法（落账时读） */
      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,""",
'挂起记录带 ops')

# ---------- ③ finishBattle → _settleBattle + retreatBattle ----------
rep(
"""  /* 结束：收尾组装 result → 重入 expedition 落账（_result/_sim）→ 清挂起 */
  GAME.battle.finishBattle = function (id) {
    var s = GAME.state;
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var result = ses.finish();
    rec.state = 'done';
    var resp = null, err = null;""",
"""  /* 结束：收尾组装 result → 重入 expedition 落账（_result/_sim）→ 清挂起
     ------------------------------------------------------------
     v89.94（B2 · E1）：落账段拆成 `_settleBattle` —— 「完成」与「主动撤退」
     走**同一段落账**，只在 result 上差一个 retreat 旗标（不复制落账逻辑）。 */
  GAME.battle.finishBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    return GAME.battle._settleBattle(id, ses.finish());
  };

  /* v89.94（B2 · E1）：主动撤退 —— 撤出战斗、带走残部、保留已造成的破防（按半计）。
     与"打完"只有两点不同：① result.retreat=true（破防 ×0.5、战报写明"主动撤退"）；
     ② 不判胜（目标未下 —— 哪怕台上占优，撤了就是没拿下）。 */
  GAME.battle.retreatBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var result = ses.finish();
    result.retreat = true;
    if (result.winner === 'atk') result.winner = 'def';
    return GAME.battle._settleBattle(id, result);
  };

  /* 落账段（finishBattle / retreatBattle 共用） */
  GAME.battle._settleBattle = function (id, result) {
    var s = GAME.state;
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!rec) return null;
    rec.state = 'done';
    var resp = null, err = null;""",
'finishBattle 拆分')

# ---------- ④ _settleBattle：重入 expedition 带 ops ----------
rep(
"""      resp = GAME.battle.expedition(rec.target, rec.modeId, rec.atkArmy, rec.genId,
        { arrived: true, cityId: rec.cityId, scheme: rec.scheme,
          _result: result, _sim: rec.sim });""",
"""      resp = GAME.battle.expedition(rec.target, rec.modeId, rec.atkArmy, rec.genId,
        { arrived: true, cityId: rec.cityId, scheme: rec.scheme, ops: rec.ops || 'assault',
          _result: result, _sim: rec.sim });""",
'落账重入带 ops')

# ---------- ⑤ expedition：opsId / 奇袭倍率 ----------
rep(
"""    var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;
    if (opts.scheme) {""",
"""    var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;
    /* v89.94（B2 · E2）：战法 —— 奇袭放大本战计略效果（opsIdOf 收敛一切脏值） */
    var opsId = GAME.opsIdOf(opts.ops);
    var _opsMul = (opsId === 'surprise') ? (((DATA.SIEGE || {}).surprise || {}).schemeMul || 1.5) : 1;
    if (opts.scheme) {""",
'opsId + 奇袭倍率')

# ---------- ⑥ 计略效果 ×奇袭倍率 ----------
rep(
"""            _ga[_gk] = Math.max(1, Math.round((scArmy[_gk] || 0) * (1 + _sc.eff.guardPct)));""",
"""            _ga[_gk] = Math.max(1, Math.round((scArmy[_gk] || 0) * (1 + _sc.eff.guardPct * _opsMul)));""",
'妖言 ×奇袭')
rep(
"""          scVal = Math.round((defBonus || 0) * (1 - _sc.eff.defCut));
          scNote = '火烧粮草 · 城防失灵 ' + Math.round(_sc.eff.defCut * 100) + '%';""",
"""          scVal = Math.round((defBonus || 0) * (1 - Math.min(0.9, _sc.eff.defCut * _opsMul)));
          scNote = '火烧粮草 · 城防失灵 ' + Math.round(Math.min(0.9, _sc.eff.defCut * _opsMul) * 100) + '%';""",
'火烧 ×奇袭')
rep(
"""          var _loy = Math.max(0, 100 - _sc.eff.loyaltyDrop * _tn);""",
"""          var _loy = Math.max(0, 100 - _sc.eff.loyaltyDrop * _opsMul * _tn);""",
'挑拨 ×奇袭')
rep(
"""        /* 趁火打劫（掠夺系数）与金蝉脱壳（战败保全）在下方各自结算点另行注明 */
      }
    }""",
"""        /* 趁火打劫（掠夺系数）与金蝉脱壳（战败保全）在下方各自结算点另行注明 */
      }
      if (opsId === 'surprise' && scNote) scNote += '（奇袭 ×' + _opsMul + '）';
    }
    /* ============================================================
     * v89.94（B2 · E1/E2）：围攻与战法 —— 只作用于**战斗入参**（零引擎改动）
     * ------------------------------------------------------------
     * · 围困：守军 −12%、城防同步疲敝（断粮之效）；
     * · 围攻（据点/县城）：守军与城防按**当前守备值**缩放 —— 破防越多越好打；
     * · 奇袭已在上方放大计略效果。
     * ⚠️ 必须发生在**观战挂起之前**：挂起时保存的 scArmy/scVal 是权威输入，
     *    重放读它（`opts._sim`）不重算 —— 否则同一场战斗两次结算结果会不同。
     * ⚠️ 缩放对**掠夺/占领都生效**（城破了就是破了），但**破防只有占领推进**。
     * ============================================================ */
    if (!opts._sim) {
      if (opsId === 'encircle' && scArmy) {
        var _ecCfg = (DATA.SIEGE || {}).encircle || {};
        var _ecCut = _ecCfg.garrisonCut == null ? 0.12 : _ecCfg.garrisonCut;
        var _ecA = {};
        for (var _ecK in scArmy) {
          var _ecV = scArmy[_ecK] || 0;
          _ecA[_ecK] = _ecV > 0 ? Math.max(1, Math.round(_ecV * (1 - _ecCut))) : 0;
        }
        scArmy = _ecA;
        scVal = Math.round(scVal * (1 - _ecCut));      /* 被围的守军无暇修葺城防 */
        scNote = (scNote ? scNote + '；' : '') + '围困 · 守军疲敝 −' + Math.round(_ecCut * 100) + '%';
      }
      if (GAME.siegeScopeOf(t)) {
        var _sgS = GAME.siegeScaleOf(t);
        var _sgA = {};
        for (var _sgK in scArmy) {
          var _sgV = scArmy[_sgK] || 0;
          _sgA[_sgK] = _sgV > 0 ? Math.max(1, Math.round(_sgV * _sgS.garrison)) : 0;
        }
        scArmy = _sgA;
        scVal = Math.round(scVal * _sgS.def);
        if (_sgS.hold < 100) {
          scNote = (scNote ? scNote + '；' : '') + '围攻已成 · 守备仅余 ' + Math.round(_sgS.hold)
            + '%（守军与城防同步衰减）';
        }
      }
    }""",
'围困 + 围攻缩放段')

# ---------- ⑦ 破防落账（胜负都算，占领才推进） ----------
rep(
"""    var win = result.winner === 'atk';
    GAME.statBump('wins', win ? 1 : 0);
    GAME.statBump(mode.occupy ? 'conquerAttempt' : 'raidCount', 1);""",
"""    var win = result.winner === 'atk';
    GAME.statBump('wins', win ? 1 : 0);
    GAME.statBump(mode.occupy ? 'conquerAttempt' : 'raidCount', 1);

    /* ============================================================
     * v89.94（B2 · E1）：围攻破防 —— **占领**打据点/县城时，每战都推进守备值
     * ------------------------------------------------------------
     * · 不论胜负都破防（战败也留下战果）—— 这就是"五五开"敢打的理由；
     * · 破防量按**战力比**取：45% × 比，夹在 [8%, 55%]（围困 ×1.5、撤退 ×0.5）；
     * · 守备归零 + 本战获胜 = 下城；否则"守军退守内城"，整军再来。
     * ============================================================ */
    var siegeOut = null;
    if (mode.occupy && GAME.siegeScopeOf(t)) {
      var _tpS = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
      var _aP = 0, _dP = 0, _kk;
      for (_kk in (result.atkStartBy || {})) _aP += (result.atkStartBy[_kk] || 0) * (_tpS ? _tpS(_kk) : 1);
      for (_kk in (result.defStartBy || {})) _dP += (result.defStartBy[_kk] || 0) * (_tpS ? _tpS(_kk) : 1);
      var _divS = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
      _dP = _dP * (1 + ((result.defBonusEff || 0) / _divS));
      var _ratioS = _dP > 0 ? (_aP / _dP) : 1;
      var _chipS = GAME.siegeChipOf(_ratioS, opsId);
      if (result.retreat) {
        _chipS = Math.max(1, Math.round(_chipS * ((DATA.SIEGE || {}).retreatChipMul == null
          ? 0.5 : (DATA.SIEGE || {}).retreatChipMul)));
      }
      siegeOut = GAME.siegeChipApply(t, _chipS);
      result.siege = { chip: siegeOut.chip, hold: siegeOut.hold, waves: siegeOut.waves,
        broke: siegeOut.broke, ratio: Math.round(_ratioS * 100) / 100, retreat: !!result.retreat };
      GAME.log((result.retreat ? '🏳️ 主动撤退' : (win ? '⚔️ 得胜' : '⚔️ 受挫'))
        + '：' + t.name + ' 守备 −' + siegeOut.chip + '% → 余 ' + Math.round(siegeOut.hold) + '%（第 '
        + siegeOut.waves + ' 波）'
        + (siegeOut.broke ? ' —— 城垣已破，再胜一阵即可拔城' : ''));
    }""",
'围攻破防落账')

# ---------- ⑧ 下城闸门（守备未破 → 不下城） ----------
rep(
"""        } else if (t.kind === 'fort') {
          GAME.battle.razeFort(t, gen);
        } else {
          GAME.onConquer(t.npc, result, gen, city);
        }""",
"""        } else if (t.kind === 'fort') {
          if (!siegeOut || siegeOut.broke) {
            GAME.battle.razeFort(t, gen);
            if (siegeOut) GAME.siegeClear(t);      /* v89.94：下城即清围攻档 */
          } else {
            /* 围攻未果：城垣未破 —— 兵回城，守备保留（下波再来） */
            GAME.log('🏯 ' + t.name + ' 城垣未破（守备余 ' + Math.round(siegeOut.hold)
              + '%）：守军退守内城，可整军再攻（占领＝围攻，多波次磨）');
          }
        } else {
          if (!siegeOut || siegeOut.broke) {
            GAME.onConquer(t.npc, result, gen, city);
            if (siegeOut) GAME.siegeClear(t);
          } else {
            GAME.log('🏯 ' + t.name + ' 城垣未破（守备余 ' + Math.round(siegeOut.hold)
              + '%）：守军退守内城，可整军再攻（占领＝围攻，多波次磨）');
          }
        }""",
'下城闸门')

# ---------- ⑨ 战报字段：撤退/围攻注脚 + replay/underdog/siege 入档 ----------
rep(
"""        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')""",
"""        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')
        + (result.retreat ? '<br>【撤退】主动撤退：残部带回，本波破防按半计（围攻进度保留）。' : '')
        + (result.siege ? '<br>【围攻】' + (result.siege.retreat ? '撤退收兵 · ' : '')
          + '破防 ' + result.siege.chip + '% → 守备余 ' + Math.round(result.siege.hold) + '%（第 '
          + result.siege.waves + ' 波' + (result.siege.broke ? ' · 城垣已破' : ' · 守军退守内城') + '）' : '')""",
'战报注脚')

rep(
"""         这里只留条带与逐回合兵力（≤16 帧）。 */
      scene: GAME.battle.compactScene(result),
    };""",
"""         这里只留条带与逐回合兵力（≤16 帧）。 */
      scene: GAME.battle.compactScene(result),
      /* v89.94（B2 · E3）：分回合回放的关键帧（≤10 帧 + 关键帧标记；增量 <2KB/场） */
      replay: GAME.battle.replayFramesOf(result),
      /* v89.94（B2 · E3）：以少胜多 —— 以弱胜强的一仗才值得晒 */
      underdog: GAME.battle.underdogOf(result),
      /* v89.94（B2 · E1）：围攻战果（据点/县城才有）—— 列表与详情都要显示"还差多少" */
      siege: result.siege || null,
    };""",
'战报 replay/underdog/siege 字段')

# ---------- ⑩ msg 文案（围攻未下城不要说"占领成功"） ----------
rep(
"""      msg: (win ? mode.name + '成功：' + t.name : mode.name + '失败：' + t.name),""",
"""      msg: (win
        ? ((siegeOut && !siegeOut.broke)
          ? '围攻得势：' + t.name + ' 守备余 ' + Math.round(siegeOut.hold) + '%（未下城）'
          : mode.name + '成功：' + t.name)
        : ((siegeOut && siegeOut.chip)
          ? '围攻受挫：' + t.name + ' 守备余 ' + Math.round(siegeOut.hold) + '%（战果已入账）'
          : mode.name + '失败：' + t.name)),""",
'msg 文案')

if src != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(src)
    print('PATCHED battle.js C1  (%d 处)' % n_ok)
else:
    print('NOCHANGE')
