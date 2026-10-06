# -*- coding: utf-8 -*-
"""v89.210 补丁 A —— battle.js：
   ① 把 _expeditionRun 抵达段的"守方输入构造"逐字节搬成唯一出口 GAME.battle.defenseInputsOf
   ② 新增 GAME.battle.previewOf（战前推演 · 与实战同引擎同输入）
"""
import io

P = 'E:/Deepseekdb/js/battle.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

if 'GAME.battle.defenseInputsOf = function' in s:
    print('[skip] A 已落盘（defenseInputsOf 已在册）')
else:
    A1 = '    var defBonus = (t.def || 0);'
    A2 = '        towers: (t.npc && GAME.towerCountOf) ? GAME.towerCountOf(t.npc) : null };'
    assert s.count(A1) == 1, 'A1 count=' + str(s.count(A1))
    assert s.count(A2) == 1, 'A2 count=' + str(s.count(A2))
    i0 = s.index(A1)
    i1 = s.index(A2, i0) + len(A2)
    seg = s[i0:i1]
    # 搬运内容自检：必须含这些关键件，且不含斗将段（斗将是抵达时掷、不搬）
    for kw in ['defBonus', 'tWallLv', 'scArmy', 'scNote', 'yaoyan', 'huoshao', 'tiaobo',
               'siegeScopeOf', 'simOpts', 'towers:']:
        assert kw in seg, 'seg 缺 ' + kw
    assert 'duel' not in seg, 'seg 混入 duel'
    assert 'var simOpts' in seg, 'seg 缺 simOpts 定义'

    helper = (
        '  /* ============================================================\n'
        '   * v89.210：守方输入构造**唯一出口** —— 从 _expeditionRun 抵达段逐字节搬出。\n'
        '   * ------------------------------------------------------------\n'
        '   * 结算（_expeditionRun）与「战前推演」（GAME.battle.previewOf）共用它：\n'
        '   * 「同一把尺」—— 杜绝"推演一套、实战一套"的漂移（本仓唯一出口铁律）。\n'
        '   * 参数：t = resolveTarget 的解析结果 · modeId = 出征方式 · opts.scheme / opts._sim 语义同结算。\n'
        '   * ============================================================ */\n'
        '  GAME.battle.defenseInputsOf = function (t, modeId, opts) {\n'
        '    opts = opts || {};\n'
        + seg + '\n'
        '    return { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts };\n'
        '  };\n'
    )

    call = (
        '    /* ============================================================\n'
        '     * v89.210：守方输入构造抽为**唯一出口** GAME.battle.defenseInputsOf ——\n'
        '     * 结算与「战前推演」（previewOf）共用同一份构造（逐字节搬运，行为不变）：\n'
        '     *   defBonus / tWallLv / scArmy·scVal·scGen·scNote / 计谋效果 / 围攻缩放 / simOpts。\n'
        '     * ============================================================ */\n'
        '    var _di210 = GAME.battle.defenseInputsOf(t, modeId, opts);\n'
        '    var scArmy = _di210.scArmy, scVal = _di210.scVal, scGen = _di210.scGen, scNote = _di210.scNote;\n'
        '    var simOpts = _di210.simOpts;\n'
    )
    s = s[:i0] + call + s[i1:]

    preview = (
        '  /* ============================================================\n'
        '   * v89.210（老板拍板 · 不留遗留）：**战前推演** —— 出征前预演一场。\n'
        '   * ------------------------------------------------------------\n'
        '   * 口径：与实战**同一引擎 + 同一输入构造**（defenseInputsOf）——\n'
        '   *   推演 = "照当前态势打这一场会怎样"的确定性预演（引擎确定性：同输入同结果）。\n'
        '   * 未计入（对玩家写明的诚实口径）：行军期间的天时/科技变化 · 战前斗将（随机触发，胜者 +10%）。\n'
        '   * 纯读：不扣兵、不扣体力、不写战报（兵/将深拷贝传入引擎）。\n'
        '   * ============================================================ */\n'
        '  GAME.battle.previewOf = function (target, modeId, atkArmy, genId, opts) {\n'
        '    opts = opts || {};\n'
        '    var p = GAME.battle.prepare(target, modeId, atkArmy, genId, opts);\n'
        '    if (!p.ok) return p;\n'
        '    var t = p.t, gen = p.gen, city = p.city;\n'
        '    var _di = GAME.battle.defenseInputsOf(t, modeId, { scheme: opts.scheme });\n'
        '    /* 与 expedition 同款：科技读点钉在出发城（set-if-unset + try/finally 还原） */\n'
        '    var Sys210 = GAME.systems;\n'
        '    var bak210 = Sys210 ? Sys210._techCtx : null;\n'
        '    var set210 = false;\n'
        '    if (Sys210 && Sys210._techCtx == null) { Sys210._techCtx = GAME.techsOf(city); set210 = true; }\n'
        '    try {\n'
        '      var boost = GAME.battle.boostSnapshot(city);\n'
        '      var result = GAME.battle.withBoost(boost, function () {\n'
        '        return GAME.battle.simulate(U.deep(atkArmy), gen ? U.deep(gen) : null,\n'
        '          _di.scArmy, _di.scVal, _di.scGen, _di.simOpts);\n'
        '      });\n'
        '      return { ok: true, t: t, gen: gen, city: city, boost: boost,\n'
        '        def: { scArmy: _di.scArmy, scVal: _di.scVal, scGen: _di.scGen,\n'
        '          scNote: _di.scNote, simOpts: _di.simOpts },\n'
        '        result: result };\n'
        '    } finally {\n'
        '      if (set210) Sys210._techCtx = bak210;\n'
        '    }\n'
        '  };\n'
    )

    B4 = '      if (setCtx191) Sys191._techCtx = bakCtx191;\n    }\n  };'
    assert s.count(B4) == 1, 'B4 count=' + str(s.count(B4))
    at = s.index(B4) + len(B4)
    s = s[:at] + '\n' + helper + '\n' + preview + s[at:]

    # 写后自检
    assert s.count('GAME.battle.defenseInputsOf = function') == 1
    assert s.count('GAME.battle.previewOf = function') == 1
    assert 'GAME.battle.defenseInputsOf(t, modeId, opts)' in s
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('[ok] A battle.js：defenseInputsOf 抽出口 + previewOf 新增')

print('done')
