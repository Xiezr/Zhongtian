# -*- coding: utf-8 -*-
"""v89.185 批次1 · ui.js + systems.js —— 人口有效上限显示接线。"""
import io

def rep(s, tag, old, new, n=1):
    c = s.count(old)
    assert c == n, tag + ' count=' + str(c)
    return s.replace(old, new, 1)

# ================= ui.js =================
P = 'js/ui.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
orig = s

# U1a. renderCityAttrs 的 maxPop → eff（保 maxPopBase185 供悬停对照）
s = rep(s, 'U1a',
"""    var maxPop = GAME.maxPopOf(c);
    var hearts = Math.round(s.hearts || 100);""",
"""    /* v89.185（老板 6）：「实际人口上限=人口上限*民心/100」——
       人口行一律显示**有效上限**（民心折算）；基准值在悬停里给出对照。 */
    var maxPopBase185 = GAME.maxPopOf(c);
    var maxPop = GAME.effPopCapOf(c);
    var hearts = Math.round(s.hearts || 100);""")

# U1b. 悬停行（上限人口 → 加民心折算说明）
s = rep(s, 'U1b',
"""        var popLabLine = '\\n建筑人口 ' + U.fmt(popLab) + ' / 上限人口 ' + U.numText(maxPop, 0)
          + '（建筑人口为各建筑固定占用，不可征兵）';""",
"""        var popLabLine = '\\n建筑人口 ' + U.fmt(popLab) + ' / 上限人口 ' + U.numText(maxPop, 0)
          + '（民心 ' + hearts + '% 折算 · 基准 ' + U.numText(maxPopBase185, 0) + '）'
          + '\\n（建筑人口为各建筑固定占用，不可征兵）';""")

# U1c. 已到上限提示
s = rep(s, 'U1c',
"            (popNow >= maxPop ? '\\n已到上限 —— 不再增长（建/升民房可提上限）' : '') + '\">' +",
"            (popNow >= maxPop ? '\\n已到上限 —— 不再增长（建/升民房可提上限 · 或安民抬民心）' : '') + '\">' +")

# U2. 募兵面板三段条 capP → eff
s = rep(s, 'U2',
"          var capP = GAME.maxPopOf(c) || 0;",
"""          /* v89.185（老板 6）：面板"上限"与人口行同源（民心折算的有效上限） */
          var capP = GAME.effPopCapOf(c) || 0;""")

# U3. 人口统计面板 → eff（短锚定位后局部替换即可）
c3 = s.count("U.numText(R.pop || 0, 0) + ' / ' + U.numText(GAME.maxPopOf(city), 0)")
assert c3 == 1, 'U3 count=' + str(c3)
s = s.replace("U.numText(R.pop || 0, 0) + ' / ' + U.numText(GAME.maxPopOf(city), 0)",
              "U.numText(R.pop || 0, 0) + ' / ' + U.numText(GAME.effPopCapOf ? GAME.effPopCapOf(city) : GAME.maxPopOf(city), 0)", 1)

# U4. 附庸/某某 meta 行 → eff
c4 = s.count('U.fmt(GAME.maxPopOf(c2))')
assert c4 == 1, 'U4 count=' + str(c4)
s = s.replace('U.fmt(GAME.maxPopOf(c2))',
              'U.fmt(GAME.effPopCapOf ? GAME.effPopCapOf(c2) : GAME.maxPopOf(c2))', 1)

assert s != orig
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch ui OK, len=' + str(len(s)))

# ================= systems.js =================
P2 = 'js/systems.js'
s = io.open(P2, 'r', encoding='utf-8', newline='').read()
orig = s

# Y1. 移民令封顶 → eff
s = rep(s, 'Y1',
"      var _cap5 = GAME.maxPopOf(_c5);",
"""      /* v89.185（老板 6）：封顶 = **有效人口上限**（民心折算）——
         民心低时移民来投自然也少（与人口增长目标同一把尺）。 */
      var _cap5 = GAME.effPopCapOf(_c5);""")

assert s != orig
io.open(P2, 'w', encoding='utf-8', newline='').write(s)
print('patch systems OK, len=' + str(len(s)))
