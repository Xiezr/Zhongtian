# -*- coding: utf-8 -*-
"""patch_v89115h_duel.py — 需求 2：斗将战（战前 · 50% · 胜者将领属性 +10% 临时）"""
import io, os, sys
R = 'E:/Deepseekdb/'
def read(p): return io.open(R + p, encoding='utf-8').read()
def write(p, s):
    tmp = R + p + '.tmp115h'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
def sub1(s, old, new, label):
    n = s.count(old)
    if n != 1:
        print('!! [%s] 匹配 %d\n   首行: %s' % (label, n, old.split('\n')[0][:90])); sys.exit(1)
    return s.replace(old, new, 1)

# ---- ① data.js：DATA.DUEL ----
D = read('js/data.js')
ANCHOR = "  DATA.WILD_GARRISON = { perLevel: 10000 };"
NEW_D = """  /* ============================================================
   * v89.115（老板）：「设计斗将战，为将领个人战，军队作战中概率触发（50%），
   *   斗将战在军队战前进行，斗将战胜利将获得临时 10% 将领属性加成，
   *   从而提高胜方全军战斗力」
   * ------------------------------------------------------------
   * 数值全在这张表；触发/对拼/加成的实现见 battle.rollDuel / duelBoostOf。
   *   · 触发概率 = chance（50%，老板给定；只掷一次，结果随战报走）；
   *   · 加成 = bonusPct（10%，老板给定）—— 加到**胜方将领的属性**上（临时），
   *     经 genAttrs 的加成链（atkPct/defPct/统率覆盖/速度）传导到**全军**；
   *   · 对拼合数 = rounds（每合比一次"勇武为主、统率智谋为辅"的战力）。
   * ============================================================ */
  DATA.DUEL = {
    enabled: true,
    chance: 0.50,        // 触发概率（军队战前的一次判定）
    bonusPct: 0.10,      // 胜者将领属性加成（临时；仅本战）
    rounds: 3,           // 对拼合数（逐合判定，先占先多者胜）
  };

""" + ANCHOR
D = sub1(D, ANCHOR, NEW_D, 'DATA.DUEL')
write('js/data.js', D)
print('  ✓ data.js')

# ---- ② battle.js：rollDuel / duelBoostOf / duelSeedOf / duelPreviewOf ----
B = read('js/battle.js')
ANCHOR2 = """  /* 战利品按城类型 */
  GAME.battle.genLootEx = function (c, extMul, rnd, dry) {"""
NEW_B = """  /* ============================================================
   * v89.115（老板「设计斗将战」）：**斗将战**（将领个人战 · 军队战前）
   * ------------------------------------------------------------
   * · 触发：只在**双方都有将领**时才有得斗（出击打野地/据点/名城 · 我方主将 vs 守将）；
   *   概率 = DATA.DUEL.chance（50%）。敌方无将（如流寇来袭）→ 不触发。
   * · 个人战：逐合比"勇武 ×2 + 统率 + 智谋 ×0.5 + 等级 ×2"（各带确定性抖动），
   *   先占先多者胜（DATA.DUEL.rounds 合）。
   * · 结果：胜者将领**属性 +bonusPct（10%）** —— 以"深拷贝并放大属性"实现，
   *   原件不动 → 天然只是"这一战"；加成经 genAttrs 链（攻/防/统率覆盖/速度）
   *   传导成**全军战斗力**。
   * · 确定性：种子由调用方给（同一个 seed 必得同一结果）—— 观战挂起与沙盘配方
   *   都靠"把结果存进 _sim"来复现，重放绝不重掷（v89.87 会话制的同一原则）。
   * ============================================================ */
  GAME.battle.duelBoostOf = function (g, pct) {
    if (!g) return g;
    var D = DATA.DUEL || {};
    var m = 1 + (pct == null ? (D.bonusPct == null ? 0.10 : D.bonusPct) : pct);
    var out = U.deep(g);
    ['tong', 'yw', 'zm', 'nz', 'spd'].forEach(function (k) {
      out[k] = Math.round((out[k] || 0) * m);
    });
    out._duelBoost = m;                 /* 标记：让战报/断言能看出"这是斗将后的那一份" */
    return out;
  };
  /* 斗将种子（确定性随机源）：同一场战斗一个值 —— 目标坐标 + 现实毫秒 */
  GAME.battle.duelSeedOf = function (target) {
    var t = target || {};
    return (t.x == null ? '-' : t.x) + ',' + (t.y == null ? '-' : t.y) + '@' + U.now();
  };
  /* 掷一次斗将（纯函数：只读两名将领，不落任何状态） */
  GAME.battle.rollDuel = function (atkGen, defGen, seed) {
    var D = DATA.DUEL || {};
    if (!D.enabled || !atkGen || !defGen) return null;
    var roll = GAME.invasionRoll('duel|' + atkGen.id + '|' + defGen.id + '|' + (seed == null ? 0 : seed));
    var ch = (D.chance == null ? 0.5 : D.chance);
    if (roll >= ch) return { done: false, chance: ch, log: ['二将未及交锋（斗将未触发）'] };
    var pa = GAME.genAttrs ? GAME.genAttrs(atkGen) : atkGen;
    var pb = GAME.genAttrs ? GAME.genAttrs(defGen) : defGen;
    function power(a, g, salt) {
      var v = (a.yw || 0) * 2 + (a.tong || 0) + (a.zm || 0) * 0.5 + (g.level || 1) * 2;
      return v * (0.85 + GAME.invasionRoll('duelp|' + g.id + '|' + salt) * 0.3);
    }
    var rounds = Math.max(1, D.rounds == null ? 3 : D.rounds);
    var wa = 0, wb = 0, log = [];
    for (var i = 1; i <= rounds; i++) {
      if (power(pa, atkGen, i) >= power(pb, defGen, i + 100)) { wa++; log.push('第' + i + '合 ' + atkGen.name + ' 占先'); }
      else { wb++; log.push('第' + i + '合 ' + defGen.name + ' 占先'); }
    }
    var winner = (wa >= wb) ? 'atk' : 'def';
    log.push('斗将 ' + rounds + ' 合，' + (winner === 'atk' ? atkGen.name : defGen.name) + ' 胜（' + wa + ' : ' + wb + '）');
    return { done: true, winner: winner, wa: wa, wb: wb, rounds: rounds,
      winnerName: (winner === 'atk' ? atkGen.name : defGen.name),
      bonusPct: (D.bonusPct == null ? 0.10 : D.bonusPct), log: log };
  };
  /* 出征面板的预告一句（无守将/不适用 → 空串） */
  GAME.battle.duelPreviewOf = function (atkGen, defGen) {
    var D = DATA.DUEL || {};
    if (!D.enabled || !atkGen || !defGen) return '';
    return '⚔ 斗将：' + U.escape(atkGen.name) + ' vs ' + U.escape(defGen.name) +
      '（战前 ' + Math.round((D.chance == null ? 0.5 : D.chance) * 100) + '% 触发 · 胜者全军 +' +
      Math.round((D.bonusPct == null ? 0.10 : D.bonusPct) * 100) + '%）';
  };

  /* 战利品按城类型 */
  GAME.battle.genLootEx = function (c, extMul, rnd, dry) {"""
B = sub1(B, ANCHOR2, NEW_B, 'rollDuel 等出口')
write('js/battle.js', B)
print('  ✓ battle.js（出口）')

# ---- ③ battle.js：expedition 接线 ----
B2 = read('js/battle.js')
OLD3 = """    if (opts._sim) {                       /* 重放：用挂起时保存的权威输入（不重算） */
      scArmy = opts._sim.scArmy || {}; scVal = opts._sim.scVal || 0;
      scGen = opts._sim.scGen || null; scNote = opts._sim.scNote || null;
      simOpts = opts._sim.simOpts || simOpts;
    } else if (!opts._result && GAME.battle._needWatch(opts)) {
      /* 观战：建立会话挂起（落账上下文一并保存） */
      return GAME.battle._suspendExpedition(target, modeId, atkArmy, genId, opts,
        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts });
    }
    var result = opts._result || GAME.battle.simulate(atkArmy, gen, scArmy, scVal, scGen, simOpts);"""
NEW3 = """    /* ---- v89.115（老板「设计斗将战，为将领个人战，军队作战中概率触发（50%），
       斗将战在军队战前进行，斗将战胜利将获得临时 10% 将领属性加成」）----
       战前斗将：胜方主将拿到一份**属性 +10% 的副本**（原件不动 = 只此一战），
       由 genAttrs 加成链传导到全军。结果随 `_sim` 存走 —— 重放/挂起不重掷。 */
    var duel = null, genSim = gen;
    function _doDuel() {
      duel = GAME.battle.rollDuel(gen, scGen, GAME.battle.duelSeedOf(target));
      if (duel && duel.done) {
        if (duel.winner === 'atk') genSim = GAME.battle.duelBoostOf(gen);
        else scGen = GAME.battle.duelBoostOf(scGen);
        GAME.log.war('⚔ 斗将：' + duel.log.join('；'));
      }
      return duel;
    }
    if (opts._sim) {                       /* 重放：用挂起时保存的权威输入（不重算） */
      scArmy = opts._sim.scArmy || {}; scVal = opts._sim.scVal || 0;
      scGen = opts._sim.scGen || null; scNote = opts._sim.scNote || null;
      simOpts = opts._sim.simOpts || simOpts;
      duel = opts._sim.duel || null;
      genSim = opts._sim.genSim || gen;
    } else if (!opts._result && GAME.battle._needWatch(opts)) {
      /* 观战：**先斗将**（战前发生），结果与加成后的两份将领一并挂起 */
      _doDuel();
      return GAME.battle._suspendExpedition(target, modeId, atkArmy, genId, opts,
        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts,
          duel: duel, genSim: genSim });
    } else if (!opts._sim) {
      /* 即时结算（非观战、非重放）：同样战前斗将 */
      _doDuel();
    }
    var result = opts._result || GAME.battle.simulate(atkArmy, genSim, scArmy, scVal, scGen, simOpts);
    if (duel) result.duel = duel;"""
B2 = sub1(B2, OLD3, NEW3, 'expedition 斗将接线')

OLD4 = """    var _sbArmy = U.deep(atkArmy), _sbGen = gen ? U.deep(gen) : null;"""
NEW4 = """    /* v89.115：配方里的主将用**斗将后的那份**（genSim）—— 否则沙盘重跑会少一个 +10% 的加成，
       校验必然对不上（v89.102 的教训：配方必须与"开打那一刻的输入"逐字节一致）。 */
    var _sbArmy = U.deep(atkArmy), _sbGen = genSim ? U.deep(genSim) : null;"""
B2 = sub1(B2, OLD4, NEW4, '配方用 genSim')

OLD5 = """      body: GAME.battle.reportText(t.name, atkArmy, gen, result)
        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')"""
NEW5 = """      body: GAME.battle.reportText(t.name, atkArmy, gen, result)
        + (result.duel && result.duel.done
          ? '<br>【斗将】' + result.duel.log.join('；') + '　·　' + result.duel.winnerName +
            ' 得势：其全军将领属性 +' + Math.round((result.duel.bonusPct || 0.10) * 100) + '%（限本战）'
          : '')
        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')"""
B2 = sub1(B2, OLD5, NEW5, '战报斗将行')
write('js/battle.js', B2)
print('  ✓ battle.js（接线）')

# ---- ④ ui.js：出征面板军师估算行追加斗将预告 ----
U = read('js/ui.js')
OLD6 = """            + (pw74.siege ? '<br><span style="opacity:.75;">🧱 围攻：守备 ' + Math.round(pw74.siege.hold)
              + '%（守军与城防已按此衰减）</span>' : '');"""
NEW6 = """            + (pw74.siege ? '<br><span style="opacity:.75;">🧱 围攻：守备 ' + Math.round(pw74.siege.hold)
              + '%（守军与城防已按此衰减）</span>' : '')
            /* v89.115：斗将预告（我方主将 vs 守将；无守将则空） */
            + ((GAME.battle.duelPreviewOf && ui._expRes && ui._expRes.guard)
              ? (function () {
                  var eg = null, sel = document.getElementById('exp-gen');
                  (GAME.state.generals || []).forEach(function (x) { if (sel && x.id === sel.value) eg = x; });
                  var s0 = eg ? GAME.battle.duelPreviewOf(eg, ui._expRes.guard) : '';
                  return s0 ? '<br><span style="color:var(--gold-light);">' + s0 + '</span>' : '';
                })()
              : '');"""
U = sub1(U, OLD6, NEW6, '出征面板斗将预告')
write('js/ui.js', U)
print('  ✓ ui.js')
print('ALL DONE')
