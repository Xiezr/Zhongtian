# -*- coding: utf-8 -*-
"""v89.185 批次1 · smoke-test.js —— 15 条口径断言升级（曲线不封口 / 衰减-2 / 人口有效上限 / 守将体系）。"""
import io

P = 'smoke-test.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
orig = s
def rep(tag, old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, tag + ' count=' + str(c)
    s = s.replace(old, new, 1)

# ---- A1. decayWilds：跨 3 日降 6 级 ----
rep('A1',
"""  check('decayWilds：跨 3 日降 3 级', (function () {
    var st = G.state;
    st.wilds = [{ x: 1, y: 1, type: 'lake', level: 8, levelDay: G.questDayIndex() - 3 }];
    var ch = G.decayWilds();
    var lv = st.wilds[0].level;
    st.wilds = [];
    return ch.length === 1 && lv === 5;
  })());""",
"""  check('decayWilds：跨 3 日降 6 级（v89.185：每现实日 -2 级 · 旧口径 -1）', (function () {
    var st = G.state;
    st.wilds = [{ x: 1, y: 1, type: 'lake', level: 8, levelDay: G.questDayIndex() - 3 }];
    var ch = G.decayWilds();
    var lv = st.wilds[0].level;
    st.wilds = [];
    return ch.length === 1 && lv === 2;
  })());""")

# ---- A2. 驻军消费点：守地减半衰减 ----
rep('A2',
"""  check('驻军有真实消费点：守地免衰减',
    /GAME\\.wildHeld = function/.test(dS36) && /if \\(GAME\\.wildHeld\\(w\\)\\) \\{/.test(dS36));""",
"""  check('驻军有真实消费点：守地减半衰减（v89.185：无驻军 -2/日 · 有驻军 -1/日）',
    /GAME\\.wildHeld = function/.test(dS36) && /var step = GAME\\.wildHeld\\(w\\) \\?/.test(dS36));""")

# ---- A3. 实测：有驻军减半衰减 ----
rep('A3',
"""  check('实测：有驻军的野地等级不再衰减', (function () {
    var s = G.state;
    var bw = JSON.stringify(s.wilds);
    var today = G.questDayIndex();
    s.wilds = [
      { x: -8, y: -8, type: 'lake', level: 8, levelDay: today - 3 },
      { x: -7, y: -7, type: 'forest', level: 8, levelDay: today - 3, garrison: { troops: { yibing: 100 }, cityId: 'c' } },
    ];
    G.decayWilds();
    var ok = s.wilds[0].level < 8 && s.wilds[1].level === 8;
    s.wilds = JSON.parse(bw);
    return ok;
  })());""",
"""  check('实测：有驻军减半衰减（3 日：无驻军 -6 → 2 级 · 有驻军 -3 → 5 级 · v89.185）', (function () {
    var s = G.state;
    var bw = JSON.stringify(s.wilds);
    var today = G.questDayIndex();
    s.wilds = [
      { x: -8, y: -8, type: 'lake', level: 8, levelDay: today - 3 },
      { x: -7, y: -7, type: 'forest', level: 8, levelDay: today - 3, garrison: { troops: { yibing: 100 }, cityId: 'c' } },
    ];
    G.decayWilds();
    var ok = s.wilds[0].level === 2 && s.wilds[1].level === 5;
    s.wilds = JSON.parse(bw);
    return ok;
  })());""")

# ---- B1. §103① 造局摆"有效上限的一半" ----
rep('B1',
"""    /* 摆"上限的一半"：既未到上限（不触发"已满 +0"分支）、又不是 0（增速有值） */
    s103.res.pop = Math.max(1, Math.floor(cap103 * 0.5));""",
"""    /* 摆"**有效**上限的一半"（v89.185：UI"已满 +0"判据走 effPopCapOf）——既未到上限、又不是 0 */
    s103.res.pop = Math.max(1, Math.floor(G.effPopCapOf(c103) * 0.5));""")

# ---- B2. §89 三段条：期望与产品同源（effPopCapOf） ----
rep('B2',
"""      var fakeBig = { cells: [{ build: { id: 'minfang', lvl: 12 } }] };
      var mpBig = G.maxPopOf(fakeBig);
      var okG = G.popGrowthOf(fakeBig) === mpBig / (DATA.POP_CFG.fillHours || 2);""",
"""      var fakeBig = { cells: [{ build: { id: 'minfang', lvl: 12 } }] };
      var mpBig = G.maxPopOf(fakeBig);
      /* v89.185：口径与产品同源 —— 增速 = **有效上限** ÷ fillHours（民心折算，见 effPopCapOf） */
      var okG = G.popGrowthOf(fakeBig) === G.effPopCapOf(fakeBig) / (DATA.POP_CFG.fillHours || 2);""")

# ---- B3. §105 ①②③ 基线改走有效上限 ----
rep('B3a',
"""    var cap105 = G.maxPopOf(c105);
    var g105 = G.popGrowthOf(c105);""",
"""    var cap105 = G.effPopCapOf(c105);   /* v89.185：口径改走**有效上限**（民心折算）——"补满时长恒定"不变 */
    var g105 = G.popGrowthOf(c105);""")
rep('B3b',
"    var capBig105 = G.maxPopOf(big105);",
"    var capBig105 = G.effPopCapOf(big105);   /* v89.185：同尺（有效上限） */")

# ---- B4. §106⑤ 同源 ----
rep('B4',
"""    check('§106⑤ 劳作不动增长：popGrowthOf = 上限 ÷ fillHours（不受劳作影响）',
      Math.abs(G.popGrowthOf(c106) - G.maxPopOf(c106) / (DATA.POP_CFG.fillHours || 2)) < 1e-9);""",
"""    check('§106⑤ 劳作不动增长：popGrowthOf = 有效上限 ÷ fillHours（不受劳作影响 · v89.185 同源）',
      Math.abs(G.popGrowthOf(c106) - G.effPopCapOf(c106) / (DATA.POP_CFG.fillHours || 2)) < 1e-9);""")

# ---- C1. §111② 据点守将：一律名世 ----
rep('C1a',
"      ok111b = !!(tt111.ok && tt111.guard && tt111.guard.name && det111 && idx1_111 === 2 && idx6_111 === 4);",
"      ok111b = !!(tt111.ok && tt111.guard && tt111.guard.name && det111 && idx1_111 === 3 && idx6_111 === 3);   /* v89.185：一律名世=3 */")
rep('C1b',
"        + ' · 确定性=' + det111 + ' · Lv1档=' + idx1_111 + '（英杰=2）/ Lv6档=' + idx6_111 + '（天授=4）';",
"        + ' · 确定性=' + det111 + ' · Lv1档=' + idx1_111 + '（名世=3）/ Lv6档=' + idx6_111 + '（名世=3）';")
rep('C1c',
"    check('§111② 据点守将：resolveTarget 带 guard + 确定性（两次全等）+ 相称（1→英杰 / 6→天授）', ok111b, note111b);",
"    check('§111② 据点守将：resolveTarget 带 guard + 确定性（两次全等）+ 相称（v89.185：一律名世）', ok111b, note111b);")

# ---- C2. §111③ 相称尺子：新公式（英杰30-120 / 名世60-150 / 天授120-240） ----
rep('C2',
"""      !!(recW1_111 && recW1_111.rankId === 'liang' && recW1_111.lv === 3)
      && !!(recW10_111 && recW10_111.rankId === 'tian' && recW10_111.lv === 20)
      && !!(recF10_111 && recF10_111.rankId === 'tian' && recF10_111.lv === 60)
      && !!(recCap_111 && recCap_111.rankId === 'tian' && recCap_111.lv === 190)
      && recOwn_111 === null
      && wildMin111 >= 16 && wildMin111 <= 20          /* 野地 Lv8：下限 16（+jitter 0~4） */
      && fortMin111 >= 52 && fortMin111 <= 57,         /* 据点 Lv8：下限 52（+jitter 0~5） */
      '野地Lv1=' + recW1_111.text + ' · 野地Lv10=' + recW10_111.text + ' · 据点Lv10=' + recF10_111.text
      + ' · 都城=' + recCap_111.text + ' · 调兵=null · 野地Lv8守将最小 ' + wildMin111 + '（建议 16）· 据点Lv8最小 ' + fortMin111 + '（建议 52）');""",
"""      !!(recW1_111 && recW1_111.rankId === 'ying' && recW1_111.lv === 30)       /* v89.185：野地=英杰 30 起 */
      && !!(recW10_111 && recW10_111.rankId === 'ying' && recW10_111.lv === 120)  /* 野地 Lv10 = 120 */
      && !!(recF10_111 && recF10_111.rankId === 'ming' && recF10_111.lv === 150)  /* 据点=名世 60 起 · Lv10=150 */
      && !!(recCap_111 && recCap_111.rankId === 'tian' && recCap_111.lv === 210)  /* 名城天授 120-240（都城 210） */
      && recOwn_111 === null
      && wildMin111 >= 100 && wildMin111 <= 109        /* 野地 Lv8：下限 30+7×10=100（+jitter 0~9） */
      && fortMin111 >= 130 && fortMin111 <= 139,       /* 据点 Lv8：下限 60+7×10=130（+jitter 0~9） */
      '野地Lv1=' + recW1_111.text + ' · 野地Lv10=' + recW10_111.text + ' · 据点Lv10=' + recF10_111.text
      + ' · 都城=' + recCap_111.text + ' · 调兵=null · 野地Lv8守将最小 ' + wildMin111 + '（建议 100）· 据点Lv8最小 ' + fortMin111 + '（建议 130）');""")

# ---- D1. §164① 常量表 ----
rep('D1a',
"  check('§164① 常量表 DATA.MAYOR_CURVE 存在（seg 150 · maxK 20）', (function () {\n      var C = DATA.MAYOR_CURVE || {};\n      return C.seg === 150 && C.maxK === 20;\n    })());",
"  check('§164① 常量表 DATA.MAYOR_CURVE 存在（seg 150 · tailDiv 4 —— v89.185 不封口）', (function () {\n      var C = DATA.MAYOR_CURVE || {};\n      return C.seg === 150 && C.tailDiv === 4;\n    })());")

# ---- D2. §164① 样本点 ----
rep('D2',
"""    check('§164① ★ 样本点：80→+80% · 150→+150% · 200→+175% · 300→+225% · 500→+268.75%', (function () {
      var f = G.curveBonusOf;
      return Math.abs(f(80, 0.01, 150) - 0.8) < 1e-9
        && Math.abs(f(150, 0.01, 150) - 1.5) < 1e-9
        && Math.abs(f(200, 0.01, 150) - 1.75) < 1e-9
        && Math.abs(f(300, 0.01, 150) - 2.25) < 1e-9
        && Math.abs(f(500, 0.01, 150) - 2.6875) < 1e-9;
    })());""",
"""    check('§164① ★ 样本点（v89.185 不封口）：150→+150% · 300→+225% · 450→+262.5% · 600→+300%', (function () {
      var f = G.curveBonusOf;
      return Math.abs(f(80, 0.01, 150) - 0.8) < 1e-9
        && Math.abs(f(150, 0.01, 150) - 1.5) < 1e-9
        && Math.abs(f(300, 0.01, 150) - 2.25) < 1e-9
        && Math.abs(f(450, 0.01, 150) - 2.625) < 1e-9
        && Math.abs(f(600, 0.01, 150) - 3.0) < 1e-9;
    })());""")

# ---- D3. §164① 收敛 → 不封口 ----
rep('D3',
"""    check('§164① ★ 收敛：nz 5000 → +300%（有界）· zm 836 → +146.7%', (function () {
      var a = G.curveBonusOf(5000, 0.01, 150);
      var b = G.curveBonusOf(836, 0.005, 150);
      return a > 2.999 && a <= 3.0 + 1e-9 && Math.abs(b - 1.4666) < 5e-4;
    })());""",
"""    check('§164① ★ 尾段不封口（v89.185）：nz 5000 → +1400% · zm 836 → +179.5% · 10 万点仍线性续增', (function () {
      var a = G.curveBonusOf(5000, 0.01, 150);     /* 1.5 + 0.75 + 4700×0.25% = 14.0 */
      var b = G.curveBonusOf(836, 0.005, 150);     /* 0.75 + 0.375 + 536×0.125% = 1.795 */
      var c = G.curveBonusOf(100000, 0.01, 150);   /* 大输入：150+75+99700×0.25% ≈ 251.2 */
      return Math.abs(a - 14.0) < 1e-9 && Math.abs(b - 1.795) < 1e-9 && Math.abs(c - 251.25) < 1e-6;
    })());""")

# ---- E1. W3 收敛 → 不封口 ----
rep('E1',
"""    check('W3：nz 5000 → prod 收敛 +300%（不再封顶 1.5，也不 ×50）', (function () {
      var city = s93.cities[0], g = s93.generals[0], bk = { st: g.status, cid: g.cityId, nz: g.nz };
      /* v89.113：内政加成归**城主**（守将只剩勇武征兵） */
      g.status = 'mayor'; g.cityId = city.id; g.nz = 5000;
      var gb = G.mayorBonus(city);
      /* v89.164（老板 1）：走 DATA.MAYOR_CURVE 分段减半曲线 —— 有界收敛于 +300% */
      var ok = gb.prod > 2.999 && gb.prod <= 3.0 + 1e-9 && Math.abs(gb.build - gb.prod) < 1e-9;
      g.status = bk.st; g.cityId = bk.cid; g.nz = bk.nz;
      return ok;
    })(), '收敛 ' + (G.curveBonusOf(5000, 0.01, 150) * 100).toFixed(2) + '%');""",
"""    check('W3：nz 5000 → prod 不封口（v89.185：+1400% · 旧收敛 +300%）', (function () {
      var city = s93.cities[0], g = s93.generals[0], bk = { st: g.status, cid: g.cityId, nz: g.nz };
      /* v89.113：内政加成归**城主**（守将只剩勇武征兵） */
      g.status = 'mayor'; g.cityId = city.id; g.nz = 5000;
      var gb = G.mayorBonus(city);
      /* v89.185（老板「设计不封口上限」）：段 2 起率恒定 —— nz 5000 = 1.5 + 0.75 + 4700×0.25% = 14.0 */
      var ok = Math.abs(gb.prod - 14.0) < 1e-9 && Math.abs(gb.build - gb.prod) < 1e-9;
      g.status = bk.st; g.cityId = bk.cid; g.nz = bk.nz;
      return ok;
    })(), '不封口 ' + (G.curveBonusOf(5000, 0.01, 150) * 100).toFixed(2) + '%');""")

# ---- F1. 移民令：封顶走有效上限 ----
rep('F1',
"""      var c = st.cities[0];
      G.ui._cityId = c.id;
      var cap = G.maxPopOf(c);
      var add = Math.floor(cap * 0.25);""",
"""      var c = st.cities[0];
      G.ui._cityId = c.id;
      /* v89.185（老板 6）：封顶走**有效上限**（民心折算）——与 useItem 内部的 _cap5 同源 */
      var cap = G.effPopCapOf(c);
      var add = Math.floor(cap * 0.25);""")

# ---- 写盘 + 自检 ----
assert s != orig
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch smoke OK, len=' + str(len(s)))
