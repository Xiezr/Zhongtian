# -*- coding: utf-8 -*-
"""v86 · 核心层（II）：battle.js —— 计谋效果接线（全部作用于入参/结算，不改引擎）。

六处：① expedition 战斗入参（妖言/火烧/挑拨）② 趁火打劫掠夺系数
③ 战报【计谋】行 ④ 挑拨归降（onConquer）⑤ returnArmy 金蝉脱壳
⑥ dispatch/arrive（校验+计费+千里奔袭+随军传递）。
"""
import io
import sys

B = r'E:\Deepseekdb\js\battle.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== B1. expedition 战斗入参（计谋效果段） ==')
patch(
    B,
    """    var tWallLv = (t.npc && GAME.buildingLevel) ? GAME.buildingLevel(t.npc, 'chengqiang') : 0;
    var result = GAME.battle.simulate(atkArmy, gen, t.garrison, defBonus, t.guard || null,""",
    """    var tWallLv = (t.npc && GAME.buildingLevel) ? GAME.buildingLevel(t.npc, 'chengqiang') : 0;
    /* v86（老板「按计划进行」· G1）：计谋效果 —— **全部作用于战斗入参**（零引擎改动）：
       妖言惑众→守军副本 −15%；火烧粮草→城防值 −30%；挑拨离间→守将加成减半。
       累计施计次数走 state 层唯一出口 schemeMarksOf（挑拨：忠诚 = 100 − 25×n）。 */
    var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;
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
          scVal = Math.round((defBonus || 0) * (1 - _sc.eff.defCut));
          scNote = '火烧粮草 · 城防失灵 ' + Math.round(_sc.eff.defCut * 100) + '%';
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
    var result = GAME.battle.simulate(atkArmy, gen, scArmy, scVal, scGen,""",
    'B1 战斗入参',
    probe='var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;',
)

print()
print('== B2. result 挂计谋注（win 判定前） ==')
patch(
    B,
    """    var win = result.winner === 'atk';
    GAME.statBump('wins', win ? 1 : 0);""",
    """    /* v86：计谋注脚 —— 战报/日志可见（金蝉脱壳只在战败时另算保全） */
    if (scNote) result.schemeNote = scNote;
    if (opts.scheme === 'jintui' && result.winner !== 'atk') {
      var _jt = GAME.schemeOf('jintui');
      result.schemeKeep = _jt ? _jt.eff.woundedKeep : 0;
      result.schemeNote = '金蝉脱壳 · 保全而退（阵亡 ' + Math.round(result.schemeKeep * 100) + '% 转伤兵）';
    }
    var win = result.winner === 'atk';
    GAME.statBump('wins', win ? 1 : 0);""",
    'B2 result 注',
    probe='if (scNote) result.schemeNote = scNote;',
)

print()
print('== B3. 趁火打劫（掠夺系数） ==')
patch(
    B,
    """        /* 抢掠技巧：掠夺资源收获 +3%/级 —— 只对「掠夺」生效（占领本就不取财货） */
        var raidBonus = (mode.id === 'raid') ? (1 + TB('pillage')) : 1;""",
    """        /* 抢掠技巧：掠夺资源收获 +3%/级 —— 只对「掠夺」生效（占领本就不取财货） */
        var raidBonus = (mode.id === 'raid') ? (1 + TB('pillage')) : 1;
        /* v86：趁火打劫 —— 本战掠夺资源 +30%（乘乱取利，与抢掠技巧叠乘） */
        if (opts.scheme === 'chenhuo') {
          var _ch = GAME.schemeOf('chenhuo');
          raidBonus *= 1 + (_ch ? _ch.eff.lootPct : 0);
        }""",
    'B3 趁火打劫',
    probe="raidBonus *= 1 + (_ch ? _ch.eff.lootPct : 0);",
)

print()
print('== B4. returnArmy 金蝉脱壳 ==')
patch(
    B,
    """    var keep = Math.max(0, Math.min(1, (result && result.atkRemain || 0) / aStart));
    var rate = (DATA.EXPEDITION && DATA.EXPEDITION.woundedRate) || 0.45;
    if (GAME.systems.buffActive('military') && s.buffs.military.wound) rate = s.buffs.military.wound;
    if (GAME.systems && GAME.systems.techBonus) rate = Math.min(0.9, rate * (1 + GAME.systems.techBonus('repair')));""",
    """    var keep = Math.max(0, Math.min(1, (result && result.atkRemain || 0) / aStart));
    var rate = (DATA.EXPEDITION && DATA.EXPEDITION.woundedRate) || 0.45;
    /* v86：金蝉脱壳 —— 战败时额外保全（阵亡转伤兵，与军医/治疗科技同链相加） */
    if (result && result.schemeKeep) rate = Math.min(0.9, rate + result.schemeKeep);
    if (GAME.systems.buffActive('military') && s.buffs.military.wound) rate = s.buffs.military.wound;
    if (GAME.systems && GAME.systems.techBonus) rate = Math.min(0.9, rate * (1 + GAME.systems.techBonus('repair')));""",
    'B4 金蝉脱壳',
    probe='if (result && result.schemeKeep) rate',
)

print()
print('== B5. 战报【计谋】行 ==')
patch(
    B,
    """      body: GAME.battle.reportText(t.name, atkArmy, gen, result)
        + (lossLines.length ? '<br>【兵种损耗】' + lossLines.join('<br>') : '')""",
    """      body: GAME.battle.reportText(t.name, atkArmy, gen, result)
        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')
        + (lossLines.length ? '<br>【兵种损耗】' + lossLines.join('<br>') : '')""",
    'B5 战报行',
    probe="(result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')",
)

print()
print('== B6. 挑拨归降（onConquer） ==')
patch(
    B,
    """    /* 名将必降：按州匹配历史名将 */
    var hero = GAME.battle.grantHero(npcCity, fromCity);""",
    """    /* 名将必降：按州匹配历史名将 */
    var hero = GAME.battle.grantHero(npcCity, fromCity);
    /* v86：挑拨离间 —— 守将忠诚 ≤25（累计施计 ≥3 次）时，战胜后 50% 倒戈归降。
       种子不用随机数：同一个城同一局结果稳定（照 invasionRoll 先例，
       断言可复现；roll 值仅由城 id 与结果决定）。 */
    (function () {
      if (!GAME.schemeOf || !GAME.schemeMarksOf) return;
      var _tk = 'npc:' + npcCity.id;
      var _n = GAME.schemeMarksOf(_tk, 'tiaobo');
      if (!_n) return;
      var _tsc = GAME.schemeOf('tiaobo');
      var _loy = Math.max(0, 100 - _tsc.eff.loyaltyDrop * _n);
      if (_loy > _tsc.eff.joinAt) return;
      var _roll = GAME.invasionRoll ? GAME.invasionRoll('tj|' + npcCity.id + '|' + _n) : Math.random();
      if (_roll >= _tsc.eff.joinChance) return;
      var _ng = GAME.npcCityInfo ? GAME.npcCityInfo(npcCity).guard : null;
      if (!_ng) return;
      var _gj = GAME.makeHero(_ng, _ng.level);
      _gj.loyalty = 50;
      if (fromCity) _gj.cityId = fromCity.id;
      s.generals.push(_gj);
      GAME.log('🕸️ 挑拨离间奏效：守将 ' + _ng.name + ' 倒戈归降，愿效犬马之劳！');
    })();""",
    'B6 挑拨归降',
    probe='挑拨离间奏效：守将 ',
)

print()
print('== B7. dispatch：校验+计费+千里奔袭+随军 ==')
patch(
    B,
    """  GAME.march.dispatch = function (target, modeId, army, genId) {
    var s = GAME.state;
    var p = GAME.battle.prepare(target, modeId, army, genId, {});
    if (!p.ok) return p;
    var city = p.city, gen = p.gen, mode = p.mode, t = p.t;

    for (var a in army) city.army[a] -= army[a];""",
    """  GAME.march.dispatch = function (target, modeId, army, genId, schemeId) {
    var s = GAME.state;
    var p = GAME.battle.prepare(target, modeId, army, genId, {});
    if (!p.ok) return p;
    var city = p.city, gen = p.gen, mode = p.mode, t = p.t;
    /* v86（老板「按计划进行」· G1）：计谋 —— 校验与计费在出发时完成；
       效果由抵达时的 expedition 读 opts.scheme（行军途中不占战斗状态）。 */
    var scheme = null;
    if (schemeId) {
      var schk = GAME.schemePrepare(schemeId, t, gen);
      if (!schk.ok) return schk;
      GAME.schemeUse(schemeId, t, gen);
      scheme = schemeId;
    }

    for (var a in army) city.army[a] -= army[a];""",
    'B7a dispatch 参数',
    probe='GAME.march.dispatch = function (target, modeId, army, genId, schemeId)',
)

patch(
    B,
    """    var total = GAME.march.travelTime({ x: city.x, y: city.y, cityId: city.id }, to, army, null, gen);
    s.marches = s.marches || [];""",
    """    var total = GAME.march.travelTime({ x: city.x, y: city.y, cityId: city.id }, to, army, null, gen);
    /* v86：千里奔袭 —— 本次行军 +30%（只影响这一趟，不改全局速度链） */
    if (scheme === 'benxi') {
      var _bx = GAME.schemeOf('benxi');
      total = Math.round(total / (1 + (_bx ? _bx.eff.marchPct : 0)));
    }
    s.marches = s.marches || [];""",
    'B7b 千里奔袭',
    probe="if (scheme === 'benxi')",
)

patch(
    B,
    """      target: target, tx: t.x, ty: t.y, name: t.name, kind: t.kind,
      army: U.deep(army), elapsed: 0, totalTime: total,
    };""",
    """      target: target, tx: t.x, ty: t.y, name: t.name, kind: t.kind,
      army: U.deep(army), elapsed: 0, totalTime: total,
      scheme: scheme,                    /* v86：随军计谋（抵达时读） */
    };""",
    'B7c march.scheme',
    probe='scheme: scheme,                    /* v86：随军计谋（抵达时读） */',
)

print()
print('== B8. arrive 传递 scheme ==')
patch(
    B,
    """    var r = GAME.battle.expedition(m.target, m.modeId, m.army, m.genId,
      { arrived: true, cityId: m.cityId });""",
    """    var r = GAME.battle.expedition(m.target, m.modeId, m.army, m.genId,
      { arrived: true, cityId: m.cityId, scheme: m.scheme || null });""",
    'B8 arrive 传参',
    probe='{ arrived: true, cityId: m.cityId, scheme: m.scheme || null }',
)

print()
print('全部完成。')
