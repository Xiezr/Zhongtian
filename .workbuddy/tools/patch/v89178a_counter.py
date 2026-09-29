# -*- coding: utf-8 -*-
"""v89.178 补丁 A：克制系数全表降档（data.js）
   - 攻击向：枪打骑 3→2.5；床弩打器械保留 3（专项）
   - 防御向：盾 3→2、拒马 5→3、轻骑 4→2、铁骑 2→1.5、冲车 5→3、虎豹 4→2、西凉 2→1.5
   数据依据：probe_v89178d_final.js（双方无将 · 晴天 · 引擎真跑）：
     766 弓打轻骑首轮齐射 11→17（+55%）；弓打刀盾敌损 19%→26%；
     枪 vs 轻骑同人口仍胜（损 8%→16%）；枪 vs 铁骑同人口仍胜（20%→39%）；
     床弩 vs 冲车不变（损 17%）。
   跑法：python .workbuddy/tools/patch/v89178a_counter.py"""
import io, sys

P = 'js/data.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

# 行尾一致性守卫（项目 LF）
assert '\r\n' not in s, 'CRLF detected'

BLOCK = """  /* v89.178（老板「兵种克制太厉害了，兵种特性本身就体现在数值上了，外的系数给到3倍，
     游戏体感很差。766弓箭手杀伤35个敌方轻骑兵，这合理吗。」）——**全表降档**：
     · 防御向（挨打时兵防 ×N，是"被压制"体感的来源）全线收窄：
       刀盾抗箭 3→2 · 长枪拒马 5→3 · 轻骑抗箭 4→2 · 铁骑抗箭 2→1.5 ·
       冲车抗弓 5→3 · 虎豹抗箭 4→2 · 西凉抗箭 2→1.5；
     · 攻击向：枪打骑 3→2.5；床弩打器械**保留 3**（专项倍率：原版点名的"器械克星"，
       且攻城体系依赖它拆冲车 —— probe_v89178d 实测降到 2.5 时床弩 vs 冲车战损 17%→58%）。
     定标口径（probe_v89178d · 双方无将 · 晴天 · 引擎真跑）：766 弓打轻骑首轮齐射
     11→17（+55%）、打刀盾敌损 19%→26%；枪 vs 轻骑同人口仍胜（损 8%→16%）、
     vs 铁骑同人口仍胜（20%→39%）；床弩 vs 冲车不变。
     设计意图：**克制回到"占便宜 / 吃点亏"，不再是"打不动 / 打不动就被吃"**。
     ⚠️ 探针注记：战斗数值受**天气**影响（雨天弓射程 −20% → 接敌与开火时机变化，
     "首轮齐射"11 vs 21 是天气差不是随机）；探针对账必须固定 `world.weather`。 */
  DATA.COUNTER_ATK = {
"""

PAIRS = [
    # ① 表头注释段（在 DATA.COUNTER_ATK 定义前插入）
    ('  DATA.COUNTER_ATK = {\n', BLOCK),

    # ② 攻击向：枪打骑 3→2.5（该行含 5 个 3 值为唯一形态）
    ('changqiang: { qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3 },',
     'changqiang: { qingji: 2.5, tieji: 2.5, tuqibing: 2.5, hubaoqi: 2.5, xiliangtieqi: 2.5 },'),

    # ③ 防御向七行
    ('daodun: { gongjian: 3, chuangnu: 3, toudan: 3 },',
     'daodun: { gongjian: 2, chuangnu: 2, toudan: 2 },'),
    ('changqiang: { qingji: 5, tieji: 5, tuqibing: 5, hubaoqi: 5, xiliangtieqi: 5 },',
     'changqiang: { qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3 },'),
    ('qingji: { gongjian: 4, chuangnu: 4, toudan: 4 },',
     'qingji: { gongjian: 2, chuangnu: 2, toudan: 2 },'),
    ('tieji: { gongjian: 2, chuangnu: 2, toudan: 2 },',
     'tieji: { gongjian: 1.5, chuangnu: 1.5, toudan: 1.5 },'),
    ('chongche: { gongjian: 5 },',
     'chongche: { gongjian: 3 },'),
    ('hubaoqi: { gongjian: 4, chuangnu: 4, toudan: 4 },',
     'hubaoqi: { gongjian: 2, chuangnu: 2, toudan: 2 },'),
    ('xiliangtieqi: { gongjian: 2, chuangnu: 2, toudan: 2 },',
     'xiliangtieqi: { gongjian: 1.5, chuangnu: 1.5, toudan: 1.5 },'),

    # ④ 行内注释跟进（改前为 ×3/×4/×5 的描述）
    ('/* 枪克骑：长枪对骑兵 ×300%（v89.96 标定）——',
     '/* 枪克骑：长枪对骑兵 ×250%（v89.178 降档；v89.96 原为 ×300%）——'),
    ('/* 刀盾防远程 ×300%（"盾牌挡箭"这一常识的结构化） */',
     '/* 刀盾防远程 ×200%（"盾牌挡箭"这一常识的结构化；v89.178 由 ×3 降档） */'),
    ('/* 轻骑防远程 ×400% —— 这就是"骑兵冲弓阵"的机制来源：',
     '/* 轻骑防远程 ×200%（v89.178 由 ×4 降档）—— 这就是"骑兵冲弓阵"的机制来源：'),
    ('/* 铁骑防远程 ×200%（重甲但不如轻骑灵活） */',
     '/* 铁骑防远程 ×150%（重甲但不如轻骑灵活；v89.178 由 ×2 降档） */'),
    ('/* 冲车防弓 ×500% —— **只防弓，不防弩、不防投**（原版明确写） */',
     '/* 冲车防弓 ×300%（v89.178 由 ×5 降档）—— **只防弓，不防弩、不防投**（原版明确写） */'),
    ('防御向补强符合 B 套"克制靠挨打少实现"的框架（同"刀盾挡箭"的逻辑）。 */',
     '防御向补强符合 B 套"克制靠挨打少实现"的框架（同"刀盾挡箭"的逻辑）。\n       v89.178：随全表降档为 ×3（原 ×5）。 */'),
]

for old, new, *rest in [(a, b) for a, b in PAIRS]:
    c = s.count(old)
    assert c == 1, 'anchor count=%d for: %s' % (c, old[:60])
    s = s.replace(old, new)

# 写后自检：新值在位、旧值清零（在克制表区段内）
i = s.index('DATA.COUNTER_ATK = {')
j = s.index('阵位与指挥指令')
seg = s[i:j]
for gone in ['changqiang: { qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3 },\n    /* 床弩',
             'qingji: 5, tieji: 5', 'gongjian: 4, chuangnu: 4',
             'chongche: { gongjian: 5 },', 'daodun: { gongjian: 3,']:
    assert gone not in seg, 'old value remains: ' + gone
for need in ['gongjian: 2, chuangnu: 2, toudan: 2 },',
             'qingji: 3, tieji: 3, tuqibing: 3, hubaoqi: 3, xiliangtieqi: 3 },\n    /* 轻骑',
             'tieji: { gongjian: 1.5', 'chongche: { gongjian: 3 },',
             'hubaoqi: { gongjian: 2', 'xiliangtieqi: { gongjian: 1.5']:
    assert need in seg, 'new value missing: ' + need
assert s.count('changqiang: { qingji: 2.5') == 1

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch A OK: data.js updated, len=%d' % len(s))
