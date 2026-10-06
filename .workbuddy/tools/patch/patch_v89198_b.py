# -*- coding: utf-8 -*-
"""v89.198 批次B：battle.js 战法全链清退（校验/效果/打包/重放/战报/队列/日志/dispatch）"""

import io

def rd(p):
    return io.open(p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    c = s.count(old)
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

def cut(path, tag, old, new):
    s = rd(path)
    c = s.count(old)
    if c == 0:
        print('[skip] ' + tag + '（已缩减/已落盘）')
        return
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

def slice_rep(path, tag, start, end, new, mark):
    """索引切片替换：[start, end]（含 end）→ new。"""
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    i1 = s.find(start)
    assert i1 >= 0, '[FAIL] ' + tag + ' start 未找到'
    i2 = s.find(end, i1)
    assert i2 >= 0, '[FAIL] ' + tag + ' end 未找到'
    i2 += len(end)
    s = s[:i1] + new + s[i2:]
    wr(path, s)
    print('[ok] ' + tag)

B = 'E:/Deepseekdb/js/battle.js'

# b1 出行校验
rep(B, 'C1 prepare 战法校验退役',
"""    /* v89.94（B2 · E2）：战法校验 —— 围困须据点/城池、奇袭须有计略（与界面同一判据） */
    var _opsIssue = GAME.opsConfigIssueOf(opts.ops, t, opts.scheme || null);
    if (_opsIssue) return { ok: false, msg: _opsIssue };""",
"""    /* ⛔ v89.198（老板「清除战法这个玩法」）：战法出行校验随玩法全撤退役。 */""",
    '战法出行校验随玩法全撤退役')

# b2 rec 打包
rep(B, 'C2 rec 打包字段清退',
"""      cityId: opts.cityId || null, scheme: opts.scheme || null,
      ops: GAME.opsIdOf(opts.ops),                 /* v89.94（E2）：随军战法（落账时读） */
      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,
             scGen: simIn.scGen ? U.deep(simIn.scGen) : null,
             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {},
             opsNote: simIn.opsNote || null,  /* v89.197：围困【战法】注脚（打包不漏字段） */""",
"""      cityId: opts.cityId || null, scheme: opts.scheme || null,
      /* ⛔ v89.198（老板「清除战法这个玩法」）：随军战法（ops）字段随玩法全撤退役。 */
      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,
             scGen: simIn.scGen ? U.deep(simIn.scGen) : null,
             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {},""",
    '随军战法（ops）字段随玩法全撤退役')

# b3 落账重跑
rep(B, 'C3 落账重跑去 ops',
"""        { arrived: true, cityId: rec.cityId, scheme: rec.scheme, ops: rec.ops || 'assault',
          _result: result, _sim: rec.sim });""",
"""        { arrived: true, cityId: rec.cityId, scheme: rec.scheme,
          _result: result, _sim: rec.sim });""",
    '{ arrived: true, cityId: rec.cityId, scheme: rec.scheme,\n          _result: result, _sim: rec.sim });')

# b4 计略效果去 _opsMul（含 opsNote）——切片替换
slice_rep(B, 'C4 计略效果基准化（去奇袭放大）',
    "    var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;",
    "      if (opsId === 'surprise' && scNote) scNote += '（奇袭 ×' + _opsMul + '）';\n    }\n",
"""    var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;
    /* ⛔ v89.198（老板「清除战法这个玩法」）：战法（强攻/围困/奇袭）全撤 ——
       奇袭的「计略 ×1.5」放大退役，计略按**基准系数**结算（与 ui.expDefModsOf 同源）。 */
    if (opts.scheme) {
      var _sc = GAME.schemeOf(opts.scheme);
      if (_sc) {
        if (_sc.id === 'yaoyan') {
          var _ga = {};
          for (var _gk in (scArmy || {})) {
            _ga[_gk] = Math.max(1, Math.round((scArmy[_gk] || 0) * (1 + _sc.eff.guardPct)));
          }
          scArmy = _ga;
          scNote = '妖言惑众 · 守军逃散 ' + Math.round(-_sc.eff.guardPct * 100) + '%';
        } else if (_sc.id === 'huoshao') {
          scVal = Math.round((defBonus || 0) * (1 - Math.min(0.9, _sc.eff.defCut)));
          scNote = '火烧粮草 · 城防失灵 ' + Math.round(Math.min(0.9, _sc.eff.defCut) * 100) + '%';
        } else if (_sc.id === 'tiaobo') {
          var _tn = GAME.schemeMarksOf(GAME.schemeKeyOf(t), 'tiaobo');
          var _loy = Math.max(0, 100 - _sc.eff.loyaltyDrop * _tn);
          if (scGen && _loy <= _sc.eff.faintAt) {
            scGen = U.deep(scGen);
            scGen.zm = Math.round((scGen.zm || 0) * 0.5);
            scNote = '挑拨离间 · 守将离心（忠诚 ' + _loy + '，加成减半）';
          } else {
            scNote = '挑拨离间 · 谗言已下（守将忠诚 ' + _loy + '）';
          }
        }
        /* 趁火打劫（掠夺系数）与金蝉脱壳（战败保全）在下方各自结算点另行注明 */
      }
    }
""",
    '计略按**基准系数**结算')

# b5 围困块退役（保留围攻段）
slice_rep(B, 'C5 围困块退役（保围攻）',
    "    /* ============================================================\n     * v89.94（B2 · E1/E2）：围攻与战法 —— 只作用于**战斗入参**（零引擎改动）",
    "      if (GAME.siegeScopeOf(t)) {\n",
"""    /* ============================================================
     * ⛔ v89.198（老板「清除战法这个玩法」）：围困（行军×1.5 / 守军−12% / 城防疲敝 / 破防×1.5）
     *   随玩法全撤退役；本段只剩**围攻**（据点/县城）：守军与城防按**当前守备值**缩放 ——
     *   破防越多越好打。
     * ⚠️ 必须发生在**观战挂起之前**：挂起时保存的 scArmy/scVal 是权威输入，
     *    重放读它（`opts._sim`）不重算 —— 否则同一场战斗两次结算结果会不同。
     * ⚠️ 缩放对**掠夺/占领都生效**（城破了就是破了），但**破防只有占领推进**。
     * ============================================================ */
    if (!opts._sim) {
      if (GAME.siegeScopeOf(t)) {
""",
    '本段只剩**围攻**')

# b6 重放读回
cut(B, 'C6 重放读回去 opsNote',
"""      scGen = opts._sim.scGen || null; scNote = opts._sim.scNote || null;
      opsNote = opts._sim.opsNote || null;     /* v89.197：战法注脚随会话走（重放同源） */
      simOpts = opts._sim.simOpts || simOpts;""",
"""      scGen = opts._sim.scGen || null; scNote = opts._sim.scNote || null;
      simOpts = opts._sim.simOpts || simOpts;""")

# b7 挂起打包
cut(B, 'C7 挂起打包去 opsNote',
"""        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, opsNote: opsNote, simOpts: simOpts,
          duel: duel, genSim: genSim, boost: _boost });""",
"""        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts,
          duel: duel, genSim: genSim, boost: _boost });""")

# b8 result.opsNote + 金蝉脱壳去乘
rep(B, 'C8 result.opsNote / 金蝉基准化',
"""    if (scNote) result.schemeNote = scNote;
    if (opsNote) result.opsNote = opsNote;      /* v89.197：战法注脚（战报【战法】行） */
    if (opts.scheme === 'jintui' && result.winner !== 'atk') {
      var _jt = GAME.schemeOf('jintui');
      result.schemeKeep = _jt ? Math.min(1, _jt.eff.woundedKeep * _opsMul) : 0;""",
"""    if (scNote) result.schemeNote = scNote;
    if (opts.scheme === 'jintui' && result.winner !== 'atk') {
      var _jt = GAME.schemeOf('jintui');
      result.schemeKeep = _jt ? Math.min(1, _jt.eff.woundedKeep) : 0;""",
    'result.schemeKeep = _jt ? Math.min(1, _jt.eff.woundedKeep) : 0;')

# b9 破防调用
rep(B, 'C9 siegeChipOf 调用去参',
"""      var _chipS = GAME.siegeChipOf(_ratioS, opsId);""",
"""      var _chipS = GAME.siegeChipOf(_ratioS);""",
    'GAME.siegeChipOf(_ratioS);')

# b10 趁火打劫
rep(B, 'C10 趁火打劫去乘',
"""          raidBonus *= 1 + (_ch ? _ch.eff.lootPct * _opsMul : 0);""",
"""          raidBonus *= 1 + (_ch ? _ch.eff.lootPct : 0);""",
    '_ch.eff.lootPct : 0);')

# b11 战报行删除
cut(B, 'C11 战报【战法】行退役',
"""        + (result.opsNote ? '<br>【战法】' + result.opsNote : '')
        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')""",
"""        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')""")

# b12 dispatch 签名
rep(B, 'C12 dispatch 六参签名',
"""  GAME.march.dispatch = function (target, modeId, army, genId, schemeId, ops, extra) {
    var s = GAME.state;
    /* v89.94（B2 · E2）：战法随军 —— 校验与 prepare 同一判据（含"奇袭须有计略"） */
    var opsId = GAME.opsIdOf(ops);
    var p = GAME.battle.prepare(target, modeId, army, genId, { ops: opsId, scheme: schemeId || null });""",
"""  GAME.march.dispatch = function (target, modeId, army, genId, schemeId, extra) {
    var s = GAME.state;
    /* ⛔ v89.198（老板「清除战法这个玩法」）：第 6 参 ops（随军战法）随玩法全撤退役。 */
    var p = GAME.battle.prepare(target, modeId, army, genId, { scheme: schemeId || null });""",
    '第 6 参 ops（随军战法）随玩法全撤退役')

# b13 围困行军时长
rep(B, 'C13 围困行军 ×1.5 退役',
"""    /* v89.94（B2 · E2）：围师必久 —— 围困行军 ×1.5（多出来的时间就是"围"） */
    if (opsId === 'encircle') {
      total = Math.round(total * (((DATA.SIEGE || {}).encircle || {}).marchMul || 1.5));
    }
    s.marches = s.marches || [];""",
"""    /* ⛔ v89.198：围困行军 ×1.5（围师必久）随战法全撤退役 —— 出征一律基准时长。 */
    s.marches = s.marches || [];""",
    '围困行军 ×1.5（围师必久）随战法全撤退役')

# b14 march 记录去 ops
cut(B, 'C14 march 记录去 ops',
"""      scheme: scheme,                    /* v86：随军计谋（抵达时读） */
      ops: opsId,                        /* v89.94：随军战法（抵达时读） */
      cargo: cargo || null,              /* v89.103：随军辎重（抵达落账 / 失败退回） */""",
"""      scheme: scheme,                    /* v86：随军计谋（抵达时读） */
      cargo: cargo || null,              /* v89.103：随军辎重（抵达落账 / 失败退回） */""")

# b15 出发日志后缀退役
cut(B, 'C15 出发日志去战法后缀',
"""    GAME.log.war('🛫 ' + (gen ? gen.name + ' 率军' : '增援部队') + '出发 → ' + t.name + '（' + mode.name
      + (opsId !== 'assault' ? ' · ' + GAME.opsOf(opsId).name : '')
      + cargoTxt""",
"""    GAME.log.war('🛫 ' + (gen ? gen.name + ' 率军' : '增援部队') + '出发 → ' + t.name + '（' + mode.name
      + cargoTxt""")

# b16 arrive 去 ops
rep(B, 'C16 arrive 去 ops',
"""        { arrived: true, cityId: m.cityId, scheme: m.scheme || null, ops: m.ops || 'assault',""",
"""        { arrived: true, cityId: m.cityId, scheme: m.scheme || null,""",
    '{ arrived: true, cityId: m.cityId, scheme: m.scheme || null,\n          cargo: m.cargo')

print('批次B 完成')
