# -*- coding: utf-8 -*-
"""v89.126 补丁 D：劳作占用人口（需求 2）
① data.js   DATA.POP_LABOR（满配 12.5%）
② domain.js 出口组 popLaborLevelsOf / popLaborFullOf / popLaborOf / popFreeOf
③ domain.js train 守卫 + trainLimitOf（可征人口）
④ ui.js     归因文案 / 三段条（可征 & title）/ 侧栏人口悬停
安全：读→改→原子写→node --check；每处锚点 count==1。
"""
import io, os, subprocess

R = r'E:/Deepseekdb'

def patch(rel, pairs):
    P = os.path.join(R, rel)
    s = io.open(P, encoding='utf-8').read()
    for i, (old, new) in enumerate(pairs):
        c = s.count(old)
        assert c == 1, '[%s] 锚点 %d 计数 %d（应为 1）\n---\n%s\n---' % (rel, i, c, old[:200])
        s = s.replace(old, new)
    tmp = P + '.tmp_v89126'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, P)
    r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
    assert r.returncode == 0, '[%s] node --check 失败：%s' % (rel, r.stderr[:300])
    print('✓ %s（%d 处）' % (rel, len(pairs)))

# ── ① data.js：DATA.POP_LABOR ──
patch('js/data.js', [
    ("  DATA.DISBAND = { popReturn: 1 };",
     "  /* ============================================================\n"
     "   * v89.126（老板）：「要让人口对玩家形成部分制约，一个现实城市，\n"
     "   *   不太可能全部人口一下全被征兵了。让除民房以外的建筑（城内，城墙，\n"
     "   *   城外），分别固定占用部分人口额（劳作），则这部分人口是不能用于征兵的，\n"
     "   *   建议在各级政府满配建筑下，占人口 10%-15%」\n"
     "   * ------------------------------------------------------------\n"
     "   * 模型 = **按\"满配进度\"折算**（唯一出口组在 domain.js）：\n"
     "   *   劳作占用 = 人口上限 × fullPct × min(1, 已建级数 ÷ 满配级数)\n"
     "   *   · 满配（非民房建筑全部盖到城池上限 + 城外地块建满）→ 恰好 fullPct；\n"
     "   *   · 未满配 → 按级数比例小一点（\"城市产业规模越大，占用越多\"）；\n"
     "   *   · 已建级数 = 城内非民房建筑（含城墙）等级和 + 城外地块等级和。\n"
     "   * 为什么不用\"每级固定人数\"：人口上限随民房按 ×1.18^L 指数涨、建筑级数\n"
     "   *   按线性涨 —— 固定人数在县城满配 ≈13%、到都城只剩 ≈6%、45 级时 <1%\n"
     "   *   （测量见探针 probe_v89126_labor_calib.js），撑不住 10%-15% 的验收区间。\n"
     "   *   折算模型让**任何规模的城池满配都是 fullPct**（12.5% = 区间中值）。\n"
     "   * 口径：劳作占用只约束**征兵**（cannot 用于募兵）；不影响生产 / 税收 / 增长。\n"
     "   * ============================================================ */\n"
     "  DATA.POP_LABOR = {\n"
     "    fullPct: 0.125,      /* 满配时劳作占用 = 人口上限的 12.5%（老板区间 10%-15% 中值） */\n"
     "  };\n"
     "  DATA.DISBAND = { popReturn: 1 };"),
])

# ── ② domain.js：出口组（插在 popSourcesOf 之后） ──
LIB = """      { name: '税制', v: GAME.popTaxMul() - 1 },
    ];
  };

  /* ============================================================
   * v89.126（老板需求 2）：**劳作占用**唯一出口组 ——
   *   除民房外的建筑（城内 / 城墙 / 城外）按等级占用人口，该部分**不可征兵**。
   *   口径见 DATA.POP_LABOR（按"满配进度"折算，满配恰好 = 上限 × fullPct）。
   *   界面、守卫、探针、测试一律读这四个出口，不许各算一份。
   * ============================================================ */
  /* ① 已建"级数"：城内非民房建筑（城墙占格后自动计入）+ 城外地块 */
  GAME.popLaborLevelsOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var n = 0;
    (city.cells || []).forEach(function (cl) {
      if (cl.build && cl.build.id !== 'minfang') n += (cl.build.lvl || 1);
    });
    var ext = (city.extGrid || []);
    ext.forEach(function (e) {
      if (e && e.type) n += (e.lv || 1);
    });
    return n;
  };
  /* ② 满配级数：（城内建筑数 − 1 民房）× 建筑上限 + 城外地块数 × 建筑上限 */
  GAME.popLaborFullOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var cap = GAME.buildCapOf(city);            /* 不带 bid → 基础上限（12 + 城池加成 + 爵位） */
    var cityN = Math.max(1, Object.keys(DATA.BUILDINGS).length - 1);   /* 除民房外的城内建筑数 */
    var extN = GAME.extCap(city) || 0;
    return (cityN + extN) * Math.max(1, cap);
  };
  /* ③ 劳作占用（人口，整数）＝ min(上限 × fullPct, 级数 × 每级) */
  GAME.popLaborOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var cfg = DATA.POP_LABOR || { fullPct: 0.125 };
    var cap = GAME.maxPopOf(city);
    if (cap <= 0) return 0;
    var full = GAME.popLaborFullOf(city);
    if (full <= 0) return 0;
    var lvSum = GAME.popLaborLevelsOf(city);
    return Math.floor(cap * cfg.fullPct * Math.min(1, lvSum / full));
  };
  /* ④ 可征人口（募兵的唯一人口口径）：人口 − 劳作占用（不为负） */
  GAME.popFreeOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    return Math.max(0, Math.floor(GAME.res(city).pop || 0) - GAME.popLaborOf(city));
  };"""
patch('js/domain.js', [
    ("""      { name: '税制', v: GAME.popTaxMul() - 1 },
    ];
  };
""", LIB),
    # ── ③ 守卫：train ──
    ("    var needPop = t.pop * count;\n"
     "    var cost = {};\n"
     "    for (var k in t.cost) cost[k] = t.cost[k] * count;\n"
     "    cost.pop = needPop;\n"
     "    if (!GAME.canAfford(cost)) return { ok: false, msg: '资源或人口不足' };\n"
     "    GAME.payCost(cost);",
     "    var needPop = t.pop * count;\n"
     "    var cost = {};\n"
     "    for (var k in t.cost) cost[k] = t.cost[k] * count;\n"
     "    cost.pop = needPop;\n"
     "    /* v89.126（需求 2）：人口受**劳作占用**制约 —— 只有\"可征人口\"（人口−劳作）能征兵 */\n"
     "    var _free126 = GAME.popFreeOf(city);\n"
     "    if (needPop > _free126) {\n"
     "      return { ok: false, msg: '可征人口不足（需 ' + U.fmt(needPop) + '，可征 ' + U.fmt(_free126)\n"
     "        + '；劳作占用 ' + U.fmt(GAME.popLaborOf(city)) + ' 不可征兵）' };\n"
     "    }\n"
     "    if (!GAME.canAfford(cost)) return { ok: false, msg: '资源不足' };\n"
     "    GAME.payCost(cost);"),
    # ── ③ 守卫：trainLimitOf ──
    ("    /* 人口：可用人口 ÷ 每兵占人口 */\n"
     "    var popBound = Infinity;\n"
     "    if (t.pop > 0) popBound = Math.floor((s.res.pop || 0) / t.pop);",
     "    /* 人口：**可征人口**（人口 − 劳作占用，v89.126 唯一出口）÷ 每兵占人口 */\n"
     "    var popBound = Infinity;\n"
     "    if (t.pop > 0) popBound = Math.floor(GAME.popFreeOf(GAME.currentCity()) / t.pop);"),
])

# ── ④ ui.js ──
patch('js/ui.js', [
    # 4a 归因文案
    ("                ? '⚠️ 人口不足（募兵占用人口）—— 建民房或等待人口增长'",
     "                ? '⚠️ 可征人口不足（劳作占用 ' + U.fmt(GAME.popLaborOf(GAME.currentCity()))\n"
     "                    + ' 不可征兵）—— 建民房或等待人口增长'"),
    # 4b 三段条：可征 = popFreeOf
    ("          var avail = Math.floor(s.res.pop || 0);\n"
     "          var capP = GAME.maxPopOf(c) || 0;",
     "          var avail = GAME.popFreeOf(c);   /* v89.126：可征 = 人口 − 劳作占用（唯一出口） */\n"
     "          var capP = GAME.maxPopOf(c) || 0;"),
    # 4c 三段条 title
    ("          return '<span class=\"pop-3\" title=\"可征＝当前可用人口（募兵从此扣）· 上限＝民房决定 · 增势＝现实每小时自然增长（基准 2 小时补满）' + srcTxt + '\">' +",
     "          return '<span class=\"pop-3\" title=\"可征＝人口 − 劳作占用（城市产业所占，不可征兵 · 当前劳作 '\n"
     "            + U.fmt(GAME.popLaborOf(c)) + '）· 上限＝民房决定 · 增势＝现实每小时自然增长（基准 2 小时补满）' + srcTxt + '\">' +"),
    # 4d 侧栏人口悬停：加劳作行
    ("        var popEta = (popNow < maxPop && grow > 0)\n"
     "          ? '\\n约 ' + U.dur((maxPop - popNow) / (grow / 3600)) + '后补满（现实时间）' : '';",
     "        var popEta = (popNow < maxPop && grow > 0)\n"
     "          ? '\\n约 ' + U.dur((maxPop - popNow) / (grow / 3600)) + '后补满（现实时间）' : '';\n"
     "        /* v89.126（需求 2）：劳作占用（不可征兵）—— 悬停可见 */\n"
     "        var popLab = GAME.popLaborOf(c);\n"
     "        var popLabLine = popLab > 0\n"
     "          ? '\\n劳作占用 ' + U.fmt(popLab) + '（城市产业，不可征兵）· 可征 ' + U.fmt(Math.max(0, popNow - popLab))\n"
     "          : '';"),
    ("          '<span class=\"rate-wrap\" data-tip=\"人口增势（现实时间：基准 ' + ((DATA.POP_CFG || {}).fillHours || 2)\n"
     "            + ' 小时补满）：民房上限决定速率' + popSrc + popEta +",
     "          '<span class=\"rate-wrap\" data-tip=\"人口增势（现实时间：基准 ' + ((DATA.POP_CFG || {}).fillHours || 2)\n"
     "            + ' 小时补满）：民房上限决定速率' + popSrc + popEta + popLabLine +"),
])

print('补丁 D 完成。')
