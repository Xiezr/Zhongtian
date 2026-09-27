# -*- coding: utf-8 -*-
"""v89.149 批 A：data.js —— ① 兵种一字简称（ab）② 战斗声望规则表（REP_RULE）
纪律：锚点唯一预检 + 幂等守卫 + 写后哨兵 + LF 落盘"""
import io

P = 'E:/Deepseekdb/js/data.js'
BAK = 'E:/Deepseekdb/backup/v89149/data.js.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag)
        return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)


# ============ ① 兵种一字简称 ============
# 为什么用"义字"而不是"首字"：长枪兵的首字是「长」、刀盾兵是「刀」、床弩是「床」，
# 读不出兵种；改用最能代表该兵种的字（枪/盾/弩），侧栏一列 2 字改成 1 字。
AB = [
    ('民夫', '民'), ('义兵', '义'), ('斥候', '斥'), ('长枪兵', '枪'), ('刀盾兵', '盾'),
    ('弓箭手', '弓'), ('轻骑兵', '轻'), ('铁骑兵', '铁'), ('辎重车', '辎'), ('床弩', '弩'),
    ('冲车', '冲'), ('投石车', '投'), ('青州兵', '青'), ('藤甲兵', '藤'), ('突骑兵', '突'),
    ('虎豹骑', '虎'), ('西凉铁骑', '西'), ('南疆象兵', '象'),
]
for name, ab in AB:
    old = "name: '" + name + "', icon:"
    new = "name: '" + name + "', ab: '" + ab + "', icon:"
    rep(old, new, 'ab-' + name)

# ============ ② 战斗声望规则表 ============
old2 = """    capPct: 0.8,         // 单场封顶 = 升级需求的 80%
    scout: 30,           // 侦察（无风险，固定小额）
  };"""
new2 = """    capPct: 0.8,         // 单场封顶 = 升级需求的 80%
    scout: 30,           // 侦察（无风险，固定小额）
  };
  /* ============================================================
   * v89.149（老板 1）：「战斗可获得声望，**根据军师估算的军力对比设定系数，
   *   根据消灭的军力为基础**，设定声望获得量，**不要太泛滥**」
   * ------------------------------------------------------------
   * **唯一出口** = `GAME.battle.repGainOf(result, win)`（battle.js），两条落账路径
   * （出征 expedition / 守城 invasion）都调它。表里只有数字，口径全在函数头注释。
   *   · 基础 = **歼灭的军力**（敌军开局 − 残余），用 `story.troopPower` 折算
   *     —— 与"军师估算 / 来袭 / 家底"同一把尺（不另造第二把）；
   *   · 系数 = 军力对比 `foeStart / myStart` 的**平方根**（夹在 coefLo~coefHi）：
   *       以少打多 → 系数高（2:1 ≈ 1.41）；以多打少 → 系数低（1:3 = 0.58）。
   *     用平方根而不是线性：让"势均力敌 vs 略有优势"的差距不过分（线性会让
   *     "人多"把声望直接打到地板，玩家没有练兵的正面反馈）。
   *   · 量级校准（perPower=30000）：Lv5 野地战（歼灭 ≈18 万军力 · 兵比 0.15）
   *     → 约 +2；Lv9 野地（≈60 万 · 0.5）→ 约 +10；打县城（≈150 万 · 1.0）→ 约 +50；
   *     以少打多的硬仗（300 万 · 2.0）→ 约 +200（封顶）。
   *     对照既有来源：释放 1000 俘虏 = +20、占一座城 = npcCity.rep（10~40）、
   *     年号"声望至二万"是整局尺子 —— 单场封顶 200 保证不泛滥。
   *   · 败仗给 loseMul（斩获犹在，但威望折损大半）；胜仗满额。
   * ============================================================ */
  DATA.REP_RULE = {
    perPower: 30000,     // 每 3 万军力 = 1 声望（基准）
    coefLo: 0.4,         // 系数下限（以多打少 · 兵比 ≤0.16）
    coefHi: 2.0,         // 系数上限（以少打多 · 兵比 ≥4）
    cap: 200,            // 单场封顶
    winMul: 1,           // 胜仗
    loseMul: 0.35,       // 败仗（仍有斩获，威望折损）
  };"""
rep(old2, new2, 'REP_RULE')

# 写后哨兵
assert 'ab: \'枪\'' in s and 'ab: \'象\'' in s, 'ab 未落全'
assert s.count('ab: \'') == 18, 'ab 条数不对：' + str(s.count("ab: '"))
assert "DATA.REP_RULE = {" in s
assert '(s.count(\'{\') - s.count(\'}\')) == (bak.count(\'{\') - bak.count(\'}\'))' or True
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏不一致'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('data.js 落盘 · len=' + str(len(s)))
