# -*- coding: utf-8 -*-
"""v89.204 批次 G：smoke-test.js —— 7 处旧断言按新口径升级（不删 · §0.7 规则变更三件套）
  G1 loseCity 红线（14571）
  G2 配置表齐备（21780）
  G3 范围=据点/县城 -> 全城（21791）
  G4 破防=chipBase×比 -> 固定 20（21799）
  G5 撤退"半计破防" -> "民心未动"（21937 + extra）
  G6 siegeTextOf 文案（22064）
  G7 §198 的 siegeChipOf.length===1 -> 0（34546）
"""
import io

P = 'E:/Deepseekdb/smoke-test.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, old, new, mark, cnt=1):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(P, s.replace(old, new))
    print('[ok] ' + tag)

# G1
rep('G1 loseCity',
    """    check('DATA.INVASION 存在，且 loseCity===false（体验红线：输了不丢城）',
      !!D.INVASION && D.INVASION.loseCity === false);""",
    """    /* v89.204（老板 1）规则变更：撤销"输了不丢城"红线 —— 民心归零 + 城破 → 失城（主城除外） */
    check('DATA.INVASION 存在，且 loseCity===true（v89.204：民心尽则失城 · 主城除外）',
      !!D.INVASION && D.INVASION.loseCity === true);""",
    'loseCity===true（v89.204：民心尽则失城')

# G2
rep('G2 配置表齐备',
    """    check('E1：配置表齐备（试点范围 / 每日恢复 / 破防上下限 / 衰减保底）· v89.198 战法系数零残留', (function () {
      var C = DATA.SIEGE || {};
      return C.scope.join(',') === 'fort,county' && C.repairPerDay > 0
        && C.chipBase > 0 && C.chipMin < C.chipBase && C.chipMax > C.chipBase
        && C.defScale > 0 && C.defScale < 1 && C.defThr > 0 && C.defThr < 1
        /* v89.198（老板「清除战法这个玩法」）规则变更所致：encircle/surprise 系数随玩法全撤 */
        && C.encircle === undefined && C.surprise === undefined;
    })());""",
    """    /* v89.204（老板 1）规则变更：守备值口径改制为**民心**（固定 −heartsLoss）
       —— 旧动态 chip（chipBase/chipMin/chipMax）与撤退半计（retreatChipMul）四键退役。 */
    check('E1：配置表齐备（全城范围 / 每日恢复 / 固定 −20 / 衰减保底）· v89.198 战法系数零残留', (function () {
      var C = DATA.SIEGE || {};
      return C.scope.join(',') === 'fort,county,jun,zhou,capital' && C.repairPerDay > 0
        && C.heartsLoss === 20
        && C.chipBase === undefined && C.chipMin === undefined && C.chipMax === undefined
        && C.retreatChipMul === undefined
        && C.defScale > 0 && C.defScale < 1 && C.defThr > 0 && C.defThr < 1
        /* v89.198（老板「清除战法这个玩法」）规则变更所致：encircle/surprise 系数随玩法全撤 */
        && C.encircle === undefined && C.surprise === undefined;
    })());""",
    '固定 −20 / 衰减保底')

# G3
rep('G3 范围',
    """    check('E1：试点范围 = 据点/县城（野地/郡城不在内）', (function () {
      return G.siegeScopeOf({ kind: 'fort', x: 1, y: 1 })
        && G.siegeScopeOf({ kind: 'city', cityType: 'county', npc: { id: 'cty_x' } })
        && !G.siegeScopeOf({ kind: 'wild', x: 1, y: 1 })
        && !G.siegeScopeOf({ kind: 'city', cityType: 'jun', npc: { id: 'jun_x' } });
    })());""",
    """    /* v89.204（老板 1）规则变更：「据点、城池占领以民心为基础」—— 全部城池纳入
       （郡/州/都自本轮起同样走多波围攻，不再是决战制）；野地不在内（占领不磨民心）。 */
    check('E1：范围 = 据点 + 全部城池（v89.204：名城纳入 · 野地不在内）', (function () {
      return G.siegeScopeOf({ kind: 'fort', x: 1, y: 1 })
        && G.siegeScopeOf({ kind: 'city', cityType: 'county', npc: { id: 'cty_x' } })
        && G.siegeScopeOf({ kind: 'city', cityType: 'jun', npc: { id: 'jun_x' } })
        && G.siegeScopeOf({ kind: 'city', cityType: 'zhou', npc: { id: 'zhou_x' } })
        && G.siegeScopeOf({ kind: 'city', cityType: 'capital', npc: { id: 'cap_x' } })
        && !G.siegeScopeOf({ kind: 'wild', x: 1, y: 1 });
    })());""",
    'v89.204：名城纳入 · 野地不在内')

# G4
rep('G4 固定20',
    """    check('E1：破防 = chipBase×战力比（保底/封顶按配置；v89.198 起单参口径）', (function () {
      var C = DATA.SIEGE;
      var ok = G.siegeChipOf(1) === Math.max(C.chipMin, Math.min(C.chipMax, C.chipBase))
        && G.siegeChipOf(0.05) === C.chipMin
        && G.siegeChipOf(9) === C.chipMax
        && G.siegeChipOf.length === 1;
      return ok;
    })(), 'chipBase ' + DATA.SIEGE.chipBase + ' → 1:1 = ' + G.siegeChipOf(1) + '%');""",
    """    /* v89.204（老板 1）规则变更：单场获胜固定 −heartsLoss（20）—— 与战力比无关；
       参数保留但不再读 ratio（出口长度 0）。 */
    check('E1：单场获胜固定 −20（v89.204：与战力比无关 · 零参出口）', (function () {
      var C = DATA.SIEGE;
      return G.siegeChipOf() === C.heartsLoss
        && G.siegeChipOf(0.05) === C.heartsLoss
        && G.siegeChipOf(9) === C.heartsLoss
        && G.siegeChipOf.length === 0;
    })(), 'heartsLoss ' + DATA.SIEGE.heartsLoss + ' → 任意比 = ' + G.siegeChipOf(1) + '%');""",
    '单场获胜固定 −20（v89.204')

# G5a 标题
rep('G5a 撤退标题',
    """      check('E1：观战挂起 → 逐回合 → **主动撤退**（半计破防 + 残部归城）', (function () {""",
    """      check('E1：观战挂起 → 逐回合 → **主动撤退**（民心未动 + 残部归城 · v89.204 规则变更）', (function () {""",
    '民心未动 + 残部归城 · v89.204 规则变更')

# G5b 判据
rep('G5b 撤退判据',
    """        window.__r94ret.stage = 'settled';
        return !!stB && stB.r === 1 && liveB && !!sgRet && sgRet.chip >= 1
          && sgRet.chip < DATA.SIEGE.chipBase && armyBack && noBattle && loyKept;""",
    """        window.__r94ret.stage = 'settled';
        /* v89.204（老板 1）规则变更：撤退不折损民心 —— 战果无 siege 记录、
           民心档保持 100（未动）；残部归城与忠诚未扣口径不变。 */
        var fKey94 = 'f:' + fB.x + ',' + fB.y;
        var holdAfter94 = (S94.sieges || {})[fKey94] ? (S94.sieges || {})[fKey94].hold : 100;
        window.__r94ret.hold = holdAfter94;
        return !!stB && stB.r === 1 && liveB && !sgRet && holdAfter94 >= 100
          && armyBack && noBattle && loyKept;""",
    "var holdAfter94 = (S94.sieges || {})[fKey94]")

# G5c extra 输出
rep('G5c extra',
    """        return '阶段 ' + r.stage + ' · 派兵 ' + r.dispatch + ' · 挂起 ' + r.battles0
          + ' · 步进 ' + r.step + ' · 破防 ' + r.chip + '% · 残部归城 ' + (r.armyBack ? '✓' : '✗')
          + ' · 忠诚未扣 ' + (r.loyKept ? '✓' : '✗');""",
    """        return '阶段 ' + r.stage + ' · 派兵 ' + r.dispatch + ' · 挂起 ' + r.battles0
          + ' · 步进 ' + r.step + ' · 民心档 ' + r.hold + '（未动）· 残部归城 ' + (r.armyBack ? '✓' : '✗')
          + ' · 忠诚未扣 ' + (r.loyKept ? '✓' : '✗');""",
    '民心档 \' + r.hold + \'（未动）')

# G6
rep('G6 siegeTextOf',
    """    check('E1：围攻状态写进出征面板（守备/波次/每日恢复）', (function () {
      var tW = { kind: 'fort', x: 7, y: 7 };
      G.siegeChipApply(tW, 30);
      var txt = G.siegeTextOf(tW);
      G.siegeClear(tW);
      return txt.indexOf('守备 70%') >= 0 && txt.indexOf('已围攻 1 波') >= 0 && txt.indexOf('恢复') >= 0;
    })());""",
    """    check('E1：围攻状态可读（民心/波次/每日恢复 · v89.204 文案）', (function () {
      var tW = { kind: 'fort', x: 7, y: 7 };
      G.siegeChipApply(tW, 30);
      var txt = G.siegeTextOf(tW);
      G.siegeClear(tW);
      return txt.indexOf('民心 70%') >= 0 && txt.indexOf('已围攻 1 波') >= 0 && txt.indexOf('恢复') >= 0;
    })());""",
    '围攻状态可读（民心/波次/每日恢复')

# G7
rep('G7 §198 length',
    """        && u198.indexOf('v89.198') >= 0 && m198.indexOf('v89.198') >= 0
        && G.siegeChipOf.length === 1;""",
    """        && u198.indexOf('v89.198') >= 0 && m198.indexOf('v89.198') >= 0
        /* v89.204（老板 1）规则变更：siegeChipOf 改零参固定口径 */
        && G.siegeChipOf.length === 0;""",
    'siegeChipOf 改零参固定口径')

print('patch G done')
