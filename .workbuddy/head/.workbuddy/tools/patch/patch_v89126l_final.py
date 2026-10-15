# -*- coding: utf-8 -*-
"""v89.126 补丁 L：收尾批
① §104④ 崩溃修复（upgradeWall → 通用 upgradeAt）
② domain.upgradeAt 恢复"珠宝不足（…）"提示（原在 upgradeWall 里）
③ NPC 满配系列数字（order 17→18、民房 26、items 15、48 格 19）
④ 四处 sh.wallLv / nc.wallLv 判据 → 城墙格
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
    assert r.returncode == 0, '[%s] node --check 失败：%s' % (rel, r.stderr[:400])
    print('✓ %s（%d 处）' % (rel, len(pairs)))

# ② domain：upgradeAt 珠宝提示
patch('js/domain.js', [
    ("    cost = GAME.cityDefCostOf(cell.build.id, cost);   /* v89.126：城墙吃城防技术折扣 */\n"
     "    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足' };",
     "    cost = GAME.cityDefCostOf(cell.build.id, cost);   /* v89.126：城墙吃城防技术折扣 */\n"
     "    if (!GAME.canAfford(cost)) {\n"
     "      /* v89.104：高等级升级的拦路虎可能是**珠宝**而不是资源 —— 报清楚缺哪种\n"
     "         （原在 upgradeWall 里，城墙并入通用路径后迁到此，全建筑受益）。 */\n"
     "      var _jt126 = (cost.jewel && GAME.costJewelText) ? GAME.costJewelText(cost) : '';\n"
     "      return { ok: false, msg: cost.jewel ? ('珠宝不足（' + _jt126 + '）') : '材料不足' };\n"
     "    }"),
])

# ①③④ smoke
patch('smoke-test.js', [
    # ① §104④
    ("""    c104.wallLv = 10;
    var nq104 = (st104.queues.build || []).length;
    var rw104 = G.upgradeWall(c104.id);
    var q104 = (st104.queues.build || [])[nq104];
    var want104 = Math.max(60 * G.cityBuildMult(c104), G.buildMinTime());
    var ok104 = !!(rw104 && rw104.ok && q104 && Math.abs(q104.totalTime - want104) < 1e-6);
    G.state = keep104;
    check('§104④ 真调城墙 Lv10→11：入队时间 = 60×倍率（含 5 现实秒地板）', ok104,""",
     """    /* v89.126：城墙占格 —— 摆一格 Lv10 城墙，走**通用升级出口** upgradeAt */
    var idxW104 = -1;
    for (var iw104 = 0; iw104 < c104.cells.length; iw104++) {
      var xw104 = c104.cells[iw104];
      if (!xw104.build && !xw104.official && !xw104.pending) { idxW104 = iw104; break; }
    }
    if (idxW104 >= 0) c104.cells[idxW104].build = { id: 'chengqiang', lvl: 10 };
    var nq104 = (st104.queues.build || []).length;
    var rw104 = idxW104 >= 0 ? G.upgradeAt(c104.id, idxW104) : null;
    var q104 = (st104.queues.build || [])[nq104];
    /* 城墙时间列是哨兵 0 → 格子升级兜底 lvl×60（与其它建筑同一兜底） */
    var want104 = Math.max(10 * 60 * G.cityBuildMult(c104), G.buildMinTime());
    var ok104 = !!(rw104 && rw104.ok && q104 && Math.abs(q104.totalTime - want104) < 1e-6);
    G.state = keep104;
    check('§104④ 真调城墙 Lv10→11（通用 upgradeAt）：入队时间 = lvl×60×倍率（含 5 现实秒地板）', ok104,"""),
    # ③ CITY_PLAN order 17 → 18
    ("    && PLACE.maxLevel === 10 && PLACE.order.length === 17 && PLACE.filler === 'minfang');",
     "    /* v89.126：城墙占格 → 优先序 17 → 18 项 */\n"
     "    && PLACE.maxLevel === 10 && PLACE.order.length === 18 && PLACE.filler === 'minfang');"),
    # ③ 民房格数
    ("      /* 4 = 官府 4 格；17 = 功能建筑格数（v70：军营2 + 仓库4 + 其余 11）；余下全是民房 */\n"
     "      if (c.minfang !== plan.total - 4 - 17) return false;",
     "      /* 4 = 官府 4 格；18 = 功能建筑格数（v70：军营2 + 仓库4 + 其余 11；v89.126：+ 城墙）；余下全是民房 */\n"
     "      if (c.minfang !== plan.total - 4 - 18) return false;"),
    # ③ 48 格断言
    ("""  check('实测：48 格装得下"官府4 + 军营2 + 其余12"（18 格）',
    G.cityPlanOf(1).total >= 18, 'Lv1 = ' + G.cityPlanOf(1).total + ' 格');""",
     """  check('实测：48 格装得下"官府4 + 军营2 + 其余13（含城墙）"（19 格）',
    G.cityPlanOf(1).total >= 19, 'Lv1 = ' + G.cityPlanOf(1).total + ' 格');"""),
    # ③ fortPlanOf items 14 → 15
    ("        && p.popCap > 0 && p.def === G.fortDefOf(f) && p.items.length === 14;",
     "        && p.popCap > 0 && p.def === G.fortDefOf(f) && p.items.length === 15;   /* v89.126：+ 城墙 */"),
    # ③ 布局呈现 民房 ×27 → ×26
    ("""    /* v70：仓库 1→4 之后，Lv8 满配的民房 30 → 27 */
    return html.indexOf('军营 ×2') >= 0 && html.indexOf('仓库 ×4') >= 0
      && html.indexOf('民房 ×27') >= 0""",
     """    /* v70：仓库 1→4 之后 30 → 27；v89.126：城墙占格后 27 → 26 */
    return html.indexOf('军营 ×2') >= 0 && html.indexOf('仓库 ×4') >= 0
      && html.indexOf('民房 ×26') >= 0"""),
    # ④ 10796 建筑默认全满
    ("      && bl === DATA.MAX_BLEVEL + G.cityBuildBonus(npcZhou)\n"
     "      && sh.wallLv === bl && sh.extGrid.length > 0;",
     "      && bl === DATA.MAX_BLEVEL + G.cityBuildBonus(npcZhou)\n"
     "      /* v89.126：城墙占格 —— 「城墙同此」改查格子 */\n"
     "      && sh.cells.filter(function (c) { return c.build && c.build.id === 'chengqiang'; }).length === 1\n"
     "      && sh.extGrid.length > 0;"),
    # ④ 11723 满配名城每一格
    ("    var bad = sh.cells.filter(function (c) { return c.build && c.build.lvl !== bl; }).length;\n"
     "    /* v89.64：州城 = 12 + 8 = 20（基数由满级城等级 10 改为 MAX_BLEVEL 12） */\n"
     "    return bad === 0 && sh.wallLv === bl && bl === DATA.MAX_BLEVEL + 8;",
     "    var bad = sh.cells.filter(function (c) { return c.build && c.build.lvl !== bl; }).length;\n"
     "    /* v89.126：城墙同此 = 城墙**格**等级 === bl */\n"
     "    var wcell = sh.cells.filter(function (c) { return c.build && c.build.id === 'chengqiang'; });\n"
     "    /* v89.64：州城 = 12 + 8 = 20（基数由满级城等级 10 改为 MAX_BLEVEL 12） */\n"
     "    return bad === 0 && wcell.length === 1 && wcell[0].build.lvl === bl && bl === DATA.MAX_BLEVEL + 8;"),
    # ④ 10840 v60 攻城
    ("      var empty = nc.cells.filter(function (c) { return !c.build; }).length;\n"
     "      var want = Math.round(G.npcCityRes(tgt).grain * DATA.EXPEDITION.cityInherit);\n"
     "      return empty === 0 && nc.res.grain === want && nc.wallLv === G.npcBuildLvOf(tgt);",
     "      var empty = nc.cells.filter(function (c) { return !c.build; }).length;\n"
     "      var want = Math.round(G.npcCityRes(tgt).grain * DATA.EXPEDITION.cityInherit);\n"
     "      /* v89.126：城墙占格 —— 等级随 cells 继承 */\n"
     "      var wc60 = nc.cells.filter(function (c) { return c.build && c.build.id === 'chengqiang'; });\n"
     "      return empty === 0 && nc.res.grain === want\n"
     "        && wc60.length === 1 && wc60[0].build.lvl === G.npcBuildLvOf(tgt);"),
    # ④ 11044 v61 攻占
    ("      return nc.cells.length === want.total && nc.col === want.col && nc.row === want.row\n"
     "        && c.junying === 2 && c.cangku === 4 && c.minfang === want.total - 21\n"
     "        && nc.wallLv === G.npcBuildLvOf(tgt);",
     "      /* v89.126：功能格数 21 → 22（城墙占格）；城墙等级查格子 */\n"
     "      var wc61 = nc.cells.filter(function (x) { return x.build && x.build.id === 'chengqiang'; });\n"
     "      return nc.cells.length === want.total && nc.col === want.col && nc.row === want.row\n"
     "        && c.junying === 2 && c.cangku === 4 && c.minfang === want.total - 22\n"
     "        && wc61.length === 1 && wc61[0].build.lvl === G.npcBuildLvOf(tgt);"),
])

print('补丁 L 完成。')
