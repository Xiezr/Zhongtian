# -*- coding: utf-8 -*-
"""v89.139 批一：data.js —— 珠宝产出重排（含夜明珠）+ 等级门槛 + 数量 + 采集负重系数"""
import io, os, sys, re

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'data.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag):
    global s
    cnt = s.count(old)
    assert cnt == 1, '%s 锚点命中 %d 次' % (tag, cnt)
    s = s.replace(old, new)
    ok.append(tag)


# ── ① jewelTable 重排（补夜明珠 + 等级门槛 + 数量） ──
rep("""    jewelTable: {
      lake:    ['zhenzhu', 'shanhu'],     /* 水产之珍：珍珠 · 珊瑚 */
      caoyuan: ['manao', 'hupo'],         /* 草原化石：玛瑙 · 琥珀 */
      zhaoze:  ['hupo', 'liuli'],         /* 沼泽沉淀：琥珀 · 琉璃 */
      forest:  ['liuli', 'feicui'],       /* 林下矿脉：琉璃 · 翡翠 */
      desert:  ['shuijing', 'liuli'],     /* 戈壁结晶：水晶 · 琉璃 */
      hill:    ['yushi', 'feicui'],       /* 山石之髓：玉石 · 翡翠 */
    },
    jewelChance: 0.18,        /* 基础掉率（每队每轮收获掷一次） */
    jewelPerLv: 0.02,         /* 野地每级 +2%（Lv10 → 38%） */
    jewelRareP: 0.35,         /* 命中后取"稀有档"的概率 */
  };""",
"""    /* v89.139（老板 4）：「将爵位晋升需要的珠宝合理安排到野地采集的收获中，珠宝**由采集产出**」。
       ------------------------------------------------------------
       爵位（DATA.RANK）与建筑高阶升级（DATA.jewelCostAt）合计要这 9 种：
         珍珠 · 珊瑚 · 琉璃 · 琥珀 · 玛瑙 · 水晶 · 翡翠 · 玉石 · **夜明珠**
       v89.135 的地形表只覆盖前 8 种 —— 夜明珠**没有任何采集来源**，
       爵位「公乘」（玉石×10 + 夜明珠×5）以后的晋升只能商城买（48 元宝/颗，
       裂土封王要 50 颗 = 2400 元宝）—— 这就是"没合理安排"。
       本轮安排（每地形 ×2 档 = 12 槽，覆盖全部 9 种）：
         · 档位沿用"常见 / 稀有"，稀有档按 jewelRareP 概率；
         · **外加等级门槛**（jewelMinLv，按"贵重程度"分三批）——
           低档珠宝 Lv1 野地即得、中档要 Lv3+、高档（翡翠/玉石/夜明珠）要 Lv6+，
           于是"高级珠宝出自高级野地"，且与爵位节奏（前中后期）对得上。 */
    jewelTable: {
      lake:    ['zhenzhu', 'shanhu'],     /* 水产之珍：珍珠 · 珊瑚 */
      caoyuan: ['hupo', 'manao'],         /* 草原化石：琥珀 · 玛瑙 */
      zhaoze:  ['hupo', 'liuli'],         /* 沼泽沉淀：琥珀 · 琉璃 */
      forest:  ['liuli', 'feicui'],       /* 林下矿脉：琉璃 · 翡翠 */
      desert:  ['shuijing', 'liuli'],     /* 戈壁结晶：水晶 · 琉璃 */
      hill:    ['yushi', 'yemingzhu'],    /* 山石之髓：玉石 · 夜明珠（补上唯一缺口） */
    },
    /* 最低野地等级门槛（按珠宝 id；缺省 = 1）——高档珠宝只在高级野地出现 */
    jewelMinLv: {
      zhenzhu: 1, shanhu: 1, liuli: 1,
      hupo: 3, manao: 3, shuijing: 5,
      feicui: 6, yushi: 6, yemingzhu: 6,
    },
    jewelChance: 0.18,        /* 基础掉率（每队每轮收获掷一次） */
    jewelPerLv: 0.02,         /* 野地每级 +2%（Lv10 → 38%） */
    jewelRareP: 0.35,         /* 命中后取"稀有档"的概率 */
    /* 每次命中的数量 = 1 + ⌊野地等级 × 本系数⌋（Lv5→2 颗、Lv10→3 颗、Lv15→4 颗）——
       爵位后期单次要几十颗（裂土封王：珊瑚 100 / 琥珀 90 / 夜明珠 50），
       只掉 1 颗的节奏与爵位需求对不上。 */
    jewelCountPerLv: 0.2,
    /* v89.139（老板 5）：「采集的产出…建议关联驻军的总负重」——
       收成受"驻军总负重 × 本系数"节制：采力决定"采得出多少"，
       负重决定"一次能带回多少"（辎重车因此有了采集价值）。
       系数 2.0：纯民夫（负重 250×兵数）不触顶、精锐骑兵（负重小）会被节制，
       补辎重车即可解锁全部采力 —— 与 v89.121「负重技巧 +5%/级」同族。 */
    loadMul: 2.0,
  };""",
    'jewelTable+loadMul')

# ── ② GATHER 表头注释补一句（口径来源） ──
rep("""       basePerHour 保留为**民夫基准**，也用作旧数据（只有人数、没有兵种）的折算率。 */""",
"""       basePerHour 保留为**民夫基准**，也用作旧数据（只有人数、没有兵种）的折算率。
       v89.139（老板 5）：收成再加一道**负重闸** —— 见下方 loadMul 注释。 */""",
    'GATHER 头注释')

assert '\r\n' not in s
assert s.count('{') == s.count('}'), '花括号不配平'
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'yemingzhu' in chk and 'jewelMinLv' in chk and 'loadMul' in chk, '落盘校验失败'
print('✅ data.js：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
