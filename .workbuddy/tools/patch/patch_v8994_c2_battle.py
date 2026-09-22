# -*- coding: utf-8 -*-
"""v89.94 Patch C2 —— js/battle.js：回放关键帧 / 以少胜多 / 行军通道带 ops。"""
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


# ---------- ① 三个纯函数助手（放在 compactScene 之前） ----------
rep(
"""  /* 精简战斗场景（供战报存档与详情面板）：条带 ≤16 帧 + 逐回合兵力 */
  GAME.battle.compactScene = function (r) {""",
"""  /* ============================================================
   * v89.94（B2 · E3）：战报回放的数据侧 —— 战力口径 / 以少胜多 / 关键帧
   * ------------------------------------------------------------
   * · armyPowerOf：兵种构成 → 战力（走 STORY.troopPower 唯一出口，与来袭/家底同一把尺）；
   * · underdogOf：以弱胜强（我方战力 < 守方战力×0.8 且赢）；
   * · replayFramesOf：从 roundsLog 抽 ≤maxFrames 帧（首 2 + 尾 2 + 首杀/破塔/折半/最烈），
   *   每帧带条带与一行事件（截断到 maxEv 字），并给关键帧标记。
   *   验收线：战报增量 < 2KB/场（probe 实测钉住）。
   * ============================================================ */
  GAME.battle.armyPowerOf = function (by) {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var n = 0;
    for (var k in (by || {})) {
      n += (by[k] || 0) * (tp ? tp(k) : ((DATA.TROOPS[k] || {}).power || 1));
    }
    return Math.round(n);
  };
  GAME.battle.underdogOf = function (r) {
    if (!r || r.winner !== 'atk') return false;
    var a = GAME.battle.armyPowerOf(r.atkStartBy);
    var d0 = GAME.battle.armyPowerOf(r.defStartBy);
    var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
    var d = d0 * (1 + ((r.defBonusEff || 0) / div));
    return d > 0 && a > 0 && a < d * 0.8;
  };
  GAME.battle.replayFramesOf = function (r) {
    var cfg = DATA.REPLAY || {};
    var maxFrames = cfg.maxFrames || 10, maxEv = cfg.maxEv || 56;
    if (!r || r.engine !== 'tactic' || !r.roundsLog || !r.roundsLog.length) return null;
    var log = r.roundsLog, strips = r.strips || [], n = log.length;
    function evLine(rr) {
      var parts = [];
      (rr.events || []).forEach(function (e) {
        if (parts.length >= 3) return;
        if (e.kind === 'attack' || e.kind === 'counter') {
          parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '→' + (e.target || '')
            + (e.kind === 'counter' ? '反击' : '') + ' 杀 ' + U.numText(e.kill || 0, 0));
        } else if (e.kind === 'tower') {
          parts.push('破塔 ' + (e.destroy || 0) + ' 座（余 ' + (e.left || 0) + '）');
        } else if (e.kind === 'wall') {
          parts.push('城头→' + (e.target || '') + ' 杀 ' + U.numText(e.kill || 0, 0));
        }
      });
      var s0 = parts.join('；');
      if (s0.length > maxEv) s0 = s0.slice(0, maxEv - 1) + '…';
      return s0;
    }
    var a0 = (log[0] && log[0].a) || 0, d0 = (log[0] && log[0].d) || 0;
    var picks = {};
    [0, 1, n - 2, n - 1].forEach(function (i) { if (i >= 0 && i < n) picks[i] = true; });
    var firstKill = -1, firstTower = -1, halfA = -1, halfD = -1, maxKill = 0, maxIdx = -1;
    log.forEach(function (rr, i) {
      var k = 0;
      (rr.events || []).forEach(function (e) {
        if (e.kill) k += e.kill;
        if (firstKill < 0 && (e.kill || 0) > 0) firstKill = i;
        if (firstTower < 0 && e.kind === 'tower') firstTower = i;
      });
      if (k > maxKill) { maxKill = k; maxIdx = i; }
      if (halfA < 0 && a0 > 0 && rr.a <= a0 * 0.5) halfA = i;
      if (halfD < 0 && d0 > 0 && rr.d <= d0 * 0.5) halfD = i;
    });
    [firstKill, firstTower, maxIdx].forEach(function (i) { if (i >= 0) picks[i] = true; });
    [halfA, halfD].forEach(function (i) { if (i >= 0) picks[i] = true; });
    var idx = Object.keys(picks).map(Number).sort(function (x, y) { return x - y; });
    while (idx.length > maxFrames) idx.splice(idx.length - 2, 1);      /* 优先保首尾 */
    var frames = idx.map(function (i) {
      var rr = log[i];
      return { r: rr.r, a: rr.a, d: rr.d, gap: rr.gap, s: strips[i] || '', ev: evLine(rr) };
    });
    var key = [];
    if (firstKill >= 0) key.push({ r: log[firstKill].r, tag: 'first', text: '初次接敌' });
    if (firstTower >= 0) key.push({ r: log[firstTower].r, tag: 'tower', text: '攻破箭塔' });
    if (halfD >= 0) key.push({ r: log[halfD].r, tag: 'half', text: '敌军折半' });
    if (halfA >= 0) key.push({ r: log[halfA].r, tag: 'lost', text: '我军折半' });
    if (maxIdx >= 0) key.push({ r: log[maxIdx].r, tag: 'hot', text: '最烈一回合' });
    key.push({ r: log[n - 1].r, tag: 'final',
      text: r.retreat ? '主动撤退' : (r.winner === 'atk' ? '得胜' : '力尽') });
    return { field: r.field, rounds: n, frames: frames, key: key, retreat: !!r.retreat };
  };

  /* 精简战斗场景（供战报存档与详情面板）：条带 ≤16 帧 + 逐回合兵力 */
  GAME.battle.compactScene = function (r) {""",
'E3 助手三件')

# ---------- ② march.dispatch：签名带 ops + 校验 ----------
rep(
"""  GAME.march.dispatch = function (target, modeId, army, genId, schemeId) {
    var s = GAME.state;
    var p = GAME.battle.prepare(target, modeId, army, genId, {});
    if (!p.ok) return p;""",
"""  GAME.march.dispatch = function (target, modeId, army, genId, schemeId, ops) {
    var s = GAME.state;
    /* v89.94（B2 · E2）：战法随军 —— 校验与 prepare 同一判据（含"奇袭须有计略"） */
    var opsId = GAME.opsIdOf(ops);
    var p = GAME.battle.prepare(target, modeId, army, genId, { ops: opsId, scheme: schemeId || null });
    if (!p.ok) return p;""",
'dispatch 签名 + 战法校验')

# ---------- ③ 围困行军 ×1.5 ----------
rep(
"""    if (scheme === 'benxi') {
      var _bx = GAME.schemeOf('benxi');
      total = Math.round(total / (1 + (_bx ? _bx.eff.marchPct : 0)));
    }""",
"""    if (scheme === 'benxi') {
      var _bx = GAME.schemeOf('benxi');
      total = Math.round(total / (1 + (_bx ? _bx.eff.marchPct : 0)));
    }
    /* v89.94（B2 · E2）：围师必久 —— 围困行军 ×1.5（多出来的时间就是"围"） */
    if (opsId === 'encircle') {
      total = Math.round(total * (((DATA.SIEGE || {}).encircle || {}).marchMul || 1.5));
    }""",
'围困行军 ×1.5')

# ---------- ④ 行军记录带 ops + 日志显战法 ----------
rep(
"""      army: U.deep(army), elapsed: 0, totalTime: total,
      scheme: scheme,                    /* v86：随军计谋（抵达时读） */
    };""",
"""      army: U.deep(army), elapsed: 0, totalTime: total,
      scheme: scheme,                    /* v86：随军计谋（抵达时读） */
      ops: opsId,                        /* v89.94：随军战法（抵达时读） */
    };""",
'行军记录带 ops')

rep(
"""    GAME.log('🛫 ' + gen.name + ' 率军出发 → ' + t.name + '（' + mode.name
      + ' · 行军 ' + U.durExact(left) + ' · 速度 ' + GAME.march.speedText(army, { cityId: city.id }, to, gen) + '）');""",
"""    GAME.log('🛫 ' + gen.name + ' 率军出发 → ' + t.name + '（' + mode.name
      + (opsId !== 'assault' ? ' · ' + GAME.opsOf(opsId).name : '')
      + ' · 行军 ' + U.durExact(left) + ' · 速度 ' + GAME.march.speedText(army, { cityId: city.id }, to, gen) + '）');""",
'出发日志显战法')

# ---------- ⑤ arrive 把 ops 交给 expedition ----------
rep(
"""      r = GAME.battle.expedition(m.target, m.modeId, m.army, m.genId,
        { arrived: true, cityId: m.cityId, scheme: m.scheme || null });""",
"""      r = GAME.battle.expedition(m.target, m.modeId, m.army, m.genId,
        { arrived: true, cityId: m.cityId, scheme: m.scheme || null, ops: m.ops || 'assault' });""",
'arrive 传 ops')

if src != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(src)
    print('PATCHED battle.js C2  (%d 处)' % n_ok)
else:
    print('NOCHANGE')
