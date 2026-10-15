# -*- coding: utf-8 -*-
"""v89.185 批次1 · state.js + map.js —— 人口有效上限接线 / 守将成型接线。"""
import io

def rep(s, tag, old, new, n=1):
    c = s.count(old)
    assert c == n, tag + ' count=' + str(c)
    return s.replace(old, new, 1)

# ================= state.js =================
P = 'js/state.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
orig = s

# S1. 人口增长写入点 → eff
s = rep(s, 'S1',
"""      var maxPop = GAME.maxPopOf(city);
      var growth = GAME.popGrowthOf(city);   /* v89.89（E3）：唯一出口（与募兵面板同源）；
                                                v89.126 起单位 = 人 / **现实小时**（补满 ≈ 2 小时） */""",
"""      /* v89.185（老板 6）：「实际人口上限=人口上限*民心/100」——
         爬升目标改走 effPopCapOf（民心折算）；**只封增长、不削存量**：
         民心下滑时有效上限降低、人口停在原地（与资源"超上限只封增长"同规）。 */
      var maxPop = GAME.effPopCapOf(city);
      var growth = GAME.popGrowthOf(city);   /* v89.89（E3）：唯一出口（与募兵面板同源）；
                                                v89.126 起单位 = 人 / **现实小时**（补满 ≈ 2 小时） */""")

# S2. totalPopCap → eff
s = rep(s, 'S2',
"    return (s.cities || []).reduce(function (a, c) { return a + GAME.maxPopOf(c); }, 0);",
"""    /* v89.185（老板 6）：全境"人口上限"显示 = **实际值**（民心折算，与城栏同源） */
    return (s.cities || []).reduce(function (a, c) { return a + (GAME.effPopCapOf ? GAME.effPopCapOf(c) : GAME.maxPopOf(c)); }, 0);""")

# S3. 衰减注释
s = rep(s, 'S3',
"    /* 9e) 野地：等级衰减（被占每现实日 -1 级）+ 采集计时推进 */",
"    /* 9e) 野地：等级衰减（v89.185 起每现实日 -2 级 · 有驻军 -1 级）+ 采集计时推进 */")

# S4. npcCityGuard 四维段 → guardFillOf（区间替换，保精确）
a = s.index('    /* ---- 四维：**与真实将领同一条公式**（这是 v89.73 改的核心）----')
b = s.index('    g.freePts = 0;', a) + len('    g.freePts = 0;')
new4 = """    /* v89.185（老板 2）：四维/体力统一走 **GAME.guardFillOf**（守将成型唯一出口）——
       与野地 / 据点守将同一把尺（此前本函数手写同款公式、另两处却走 makeGeneral 的
       "纯 base 区间"口径 → 双口径；guardFillOf 与本公式逐点等价：
       base[1]×特性权重 + (等级−1)×成长×特性权重×(5/Σ权重) —— v89.73 的推导见其头注）。 */
    GAME.guardFillOf(g);"""
s = s[:a] + new4 + s[b:]

assert s != orig
assert s.count('GAME.guardFillOf(g);') == 1
assert s.count('GAME.effPopCapOf(city)') == 1
assert s.count('GAME.effPopCapOf ? GAME.effPopCapOf(c)') == 1
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch state OK, len=' + str(len(s)))

# ================= map.js =================
P2 = 'js/map.js'
s = io.open(P2, 'r', encoding='utf-8', newline='').read()
orig = s

# M1. 口径注释
s = rep(s, 'M1',
"""   * 口径（"相称" = 按据点等级配置）：
   *   · 资质：`GEN_RANKS[min(4, 2 + ⌊lv/3⌋)]` —— lv1-2 英杰 / 3-5 名世 / 6-10 天授；
   *     （比同为 Lv1-10 的野地高一档：据点是"城"，守军约 10 倍于同级野地）
   *   · 等级：`max(10, lv*4 + 20) + rand(0..5)` —— lv1 → 24~29、lv10 → 60~65
   *     （Lv10 据点 ≈ 弱县城守将 60~100 的下端，与"野地里的城"定位相称）；
   *   · **必有**（非概率：野地贼寇可无大当家，据点是有建制的守备军）；""",
"""   * 口径（"相称" = 按据点等级配置 · v89.185 老板 2 定稿）：
   *   · 资质：**名世**（`GAME.guardRankIdxOf('fort', lv)`；老板：「据点则为名世」）；
   *   · 等级：`base + (lv−1)×perLv + rand(jit)`（DATA.FORT_GUARD_LV）
   *     —— lv1 → 60~69、lv10 → 150~159（老板：「等级60起步-150级」）；
   *   · **必有**（非概率：野地贼寇可无大当家，据点是有建制的守备军）；""")

# M2. 等级行
s = rep(s, 'M2',
"    var gLv = Math.max(10, lv * 4 + 20) + Math.floor(rand() * 6);",
"""    /* v89.185（老板 2）：「据点则为名世，等级60起步-150级」—— DATA.FORT_GUARD_LV */
    var LG = DATA.FORT_GUARD_LV || { base: 60, perLv: 10, jit: 10 };
    var gLv = LG.base + Math.max(0, lv - 1) * LG.perLv + Math.floor(rand() * LG.jit);""")

# M3. makeGeneral 后补 guardFillOf
s = rep(s, 'M3',
"""    var g = GAME.makeGeneral(name, gLv, 'guard', null, false, rk.id, st.id, rand);
    g.npcGuard = true;""",
"""    var g = GAME.makeGeneral(name, gLv, 'guard', null, false, rk.id, st.id, rand);
    GAME.guardFillOf(g);   /* v89.185：等级/资质真转战力（四维按等级 + 满体力） */
    g.npcGuard = true;""")

assert s != orig
assert s.count('GAME.guardFillOf(g);') == 1
io.open(P2, 'w', encoding='utf-8', newline='').write(s)
print('patch map OK, len=' + str(len(s)))
