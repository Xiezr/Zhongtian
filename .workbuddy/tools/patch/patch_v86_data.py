# -*- coding: utf-8 -*-
"""v86 · 数据层：DATA.SCHEMES（计谋八计）+ 锦囊道具。

老板「1.按计划进行」= 第四轮排期第 1 项 G1 计谋 + G12 珠宝；
复核后 G12 珠宝九品已完整（珍珠…夜明珠 + 赏赐/爵位双消费点）→ 本轮聚焦 G1。
"""
import io
import sys

D = r'E:\Deepseekdb\js\data.js'


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


print('== S1. 锦囊道具入库 ==')
patch(
    D,
    """    { id: 'yemingzhu', name: '夜明珠', type: 'jewel', loyalty: 60, price: 48, desc: '赏赐忠诚 +60' },""",
    """    { id: 'yemingzhu', name: '夜明珠', type: 'jewel', loyalty: 60, price: 48, desc: '赏赐忠诚 +60' },
    /* v86（老板「按计划进行」· 第四轮 G1）：锦囊 —— 施展计谋所需 */
    { id: 'jinang', name: '锦囊', type: 'talis', price: 15, desc: '施展计谋所需。妙计千条，藏于囊中。' },""",
    'S1 锦囊',
    probe="id: 'jinang', name: '锦囊'",
)

print()
print('== S2. DATA.SCHEMES 八计 ==')
patch(
    D,
    """  window.GAME.DATA = DATA;
})();""",
    """  /* ============================================================
   * v86（老板「按计划进行」· 第四轮 G1）：计谋 / 锦囊
   * ------------------------------------------------------------
   * 八计三门：
   *   · attack（出征携带）—— 妖言惑众 / 火烧粮草 / 挑拨离间 / 趁火打劫
   *   · march （出征携带）—— 千里奔袭 / 金蝉脱壳
   *   · defense（城池布防）—— 空城计 / 坚壁清野
   * 效果**全部作用于战斗/入侵结算的入参**（不改战斗引擎）：
   *   见 battle.js expedition 段 与 state.js invasion 段。
   * 消耗 = 精力（已有链）+ 锦囊（type:'talis'，商城可购）。
   * 唯一出口组：GAME.schemeOf / schemeKeyOf / schemePrepare / schemeUse /
   *   schemeMarksOf / schemeDefOf / schemeDefSet / schemeDefConsume（state.js）。
   * ⚠️ 每个 eff 的键都必须在 js/ 里有**字面读取点**（smoke §71 有断言守；
   *    写进表而无消费 = 死数据，是本项目的经典失效模式）。
   * ============================================================ */
  DATA.SCHEMES = [
    { id: 'yaoyan', name: '妖言惑众', icon: '🗣️', kind: 'attack', jinang: 2, energy: 12,
      eff: { guardPct: -0.15 },
      tip: '目标守军规模 −15%（流言四起，守卒逃散）' },
    { id: 'huoshao', name: '火烧粮草', icon: '🔥', kind: 'attack', jinang: 2, energy: 14,
      eff: { defCut: 0.30 },
      tip: '目标城防值 −30%（夜焚敌仓，守备懈怠）' },
    { id: 'tiaobo', name: '挑拨离间', icon: '🕸️', kind: 'attack', jinang: 3, energy: 18,
      eff: { loyaltyDrop: 25, faintAt: 50, joinAt: 25, joinChance: 0.5 },
      tip: '守将忠诚 −25（对同一城每日限一次）；忠诚 ≤50 时其加成减半，≤25 时战胜后 50% 归降' },
    { id: 'chenhuo', name: '趁火打劫', icon: '💰', kind: 'attack', jinang: 1, energy: 10,
      eff: { lootPct: 0.30 },
      tip: '本战掠夺资源 +30%（乘乱取利）' },
    { id: 'benxi', name: '千里奔袭', icon: '💨', kind: 'march', jinang: 2, energy: 15,
      eff: { marchPct: 0.30 },
      tip: '本次行军速度 +30%（轻装疾行）' },
    { id: 'jintui', name: '金蝉脱壳', icon: '🦗', kind: 'march', jinang: 1, energy: 8,
      eff: { woundedKeep: 0.35 },
      tip: '若战败，额外保全 35% 兵力（阵亡转伤兵）' },
    { id: 'kongcheng', name: '空城计', icon: '🎭', kind: 'defense', jinang: 2, energy: 10, durH: 6,
      eff: { invSkip: 1 },
      tip: '布防 6 小时：期间下一次来犯之敌不战而退' },
    { id: 'jianbi', name: '坚壁清野', icon: '🏜️', kind: 'defense', jinang: 2, energy: 12, durH: 8,
      eff: { invLossCut: 0.40 },
      tip: '布防 8 小时：期间遭来犯时的损失 −40%' },
  ];

  window.GAME.DATA = DATA;
})();""",
    'S2 SCHEMES',
    probe='DATA.SCHEMES = [',
)

print()
print('全部完成。')
