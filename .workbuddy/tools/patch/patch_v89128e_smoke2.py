# -*- coding: utf-8 -*-
"""v89.128 补丁 E：smoke 剩余 8 条红点升级（转正提取 / 迁移口径 / 正则可升级）
   ⚠ 本脚本写盘一律 newline=''（保持项目 LF 行尾 —— v89.128 踩过 CRLF 打穿 \n 断言的坑）
"""
import io

R = 'E:/Deepseekdb/'
P = R + 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    assert s.count(old) == 1, '%s 锚点 %d 个' % (tag, s.count(old))
    s = s.replace(old, new)
    n += 1
    print('  ✓ ' + tag)


# ── ① 移动/交换断言（条件已含城墙）──
rep("""  check('v76：移动/交换与升级/拆除同排（官府除外）', /data-action="move-ask"/.test(uS31)
    && /b\\.id === 'guanfu' \\? ''[\\s\\S]{0,60}: '<button class="btn bldg-act" data-action="move-ask"/.test(uS31)
    && /\\.bldg-foot \\{ display: flex; justify-content: center/.test(htmlSrc25));""",
    """  check('v76：移动/交换与升级/拆除同排（官府/城墙除外）', /data-action="move-ask"/.test(uS31)
    && /b\\.id === 'guanfu' \\|\\| b\\.id === 'chengqiang' \\? ''[\\s\\S]{0,60}: '<button class="btn bldg-act" data-action="move-ask"/.test(uS31)
    && /\\.bldg-foot \\{ display: flex; justify-content: center/.test(htmlSrc25));""",
    '① 移动断言')

# ── ② 6×6 迁移断言（注释已重写）──
rep("""  check('旧档 6×6 → 8×6 扩容迁移存在', /v40 迁移：城内 6×6 → 8×6（48 格）/.test(ST)
    && /c\\.cells\\.length === 36/.test(ST));""",
    """  check('旧档 6×6 → 8×6 扩容迁移存在（v89.128 整合段）', /6×6 → 8×6（48 格）/.test(ST)
    && /c\\.cells\\.length === 36/.test(ST));""",
    '② 6×6 迁移断言')

# ── ③ 攻占转正：城墙 → 环城槽 ──
rep("""      var want = G.cityPlanOf(7, G.npcBuildLvOf(tgt)), c = countOf({ cells: nc.cells });
      /* v89.126：功能格数 21 → 22（城墙占格）；城墙等级查格子 */
      var wc61 = nc.cells.filter(function (x) { return x.build && x.build.id === 'chengqiang'; });
      return nc.cells.length === want.total && nc.col === want.col && nc.row === want.row
        && c.junying === 2 && c.cangku === 4 && c.minfang === want.total - 22
        && wc61.length === 1 && wc61[0].build.lvl === G.npcBuildLvOf(tgt);""",
    """      var want = G.cityPlanOf(7, G.npcBuildLvOf(tgt)), c = countOf({ cells: nc.cells });
      /* v89.128：城墙从影子格提取到**环城槽**（不占 cells）——等级保留、那一格释放 */
      return nc.cells.length === want.total && nc.col === want.col && nc.row === want.row
        && c.junying === 2 && c.cangku === 4 && c.minfang === want.total - 22
        && !!(nc.wall && nc.wall.build && nc.wall.build.id === 'chengqiang'
          && nc.wall.build.lvl === G.npcBuildLvOf(tgt))
        && nc.cells.filter(function (x) { return x.build && x.build.id === 'chengqiang'; }).length === 0;""",
    '③ 攻占转正（格数）')

# ── ④ 攻占转正：库存继承 ──
rep("""      var empty = nc.cells.filter(function (c) { return !c.build; }).length;
      var want = Math.round(G.npcCityRes(tgt).grain * DATA.EXPEDITION.cityInherit);
      /* v89.126：城墙占格 —— 等级随 cells 继承 */
      var wc60 = nc.cells.filter(function (c) { return c.build && c.build.id === 'chengqiang'; });
      return empty === 0 && nc.res.grain === want
        && wc60.length === 1 && wc60[0].build.lvl === G.npcBuildLvOf(tgt);""",
    """      var empty = nc.cells.filter(function (c) { return !c.build; }).length;
      var want = Math.round(G.npcCityRes(tgt).grain * DATA.EXPEDITION.cityInherit);
      /* v89.128：城墙提取到环城槽 —— 原墙格释放（empty 应为 1）、等级保留在槽 */
      return empty === 1 && nc.res.grain === want
        && !!(nc.wall && nc.wall.build && nc.wall.build.lvl === G.npcBuildLvOf(tgt))
        && nc.cells.filter(function (c) { return c.build && c.build.id === 'chengqiang'; }).length === 0;""",
    '④ 攻占转正（库存）')

# ── ⑤ claimFort 满配断言 ──
rep("""          var plan = G.cityPlanOf(G.cityLvOf(nc), G.npcBuildLvOf(nc));
          var same = nc.cells.length === plan.cells.length;
          for (var i = 0; i < nc.cells.length && same; i++) {
            var a = nc.cells[i].build, b = plan.cells[i].build;
            if ((a ? a.id + a.lvl : '-') !== (b ? b.id + b.lvl : '-')) same = false;
          }
          ok = same && nc.res.pop === G.planPopCapOf(f.level)
            && st9.cities.length === 2 && G.map.fortAt(f.x, f.y) === null;""",
    """          var plan = G.cityPlanOf(G.cityLvOf(nc), G.npcBuildLvOf(nc));
          var same = nc.cells.length === plan.cells.length;
          var planWall9 = 0;
          for (var i = 0; i < nc.cells.length && same; i++) {
            var a = nc.cells[i].build, b = plan.cells[i].build;
            /* v89.128：计划里的城墙格 → 实城的**环城槽**（那一格是空格） */
            if (b && b.id === 'chengqiang') { planWall9 = b.lvl; if (a) same = false; continue; }
            if ((a ? a.id + a.lvl : '-') !== (b ? b.id + b.lvl : '-')) same = false;
          }
          ok = same && planWall9 > 0
            && !!(nc.wall && nc.wall.build && nc.wall.build.lvl === planWall9)
            && nc.res.pop === G.planPopCapOf(f.level)
            && st9.cities.length === 2 && G.map.fortAt(f.x, f.y) === null;""",
    '⑤ claimFort')

# ── ⑥ §107 整段（v89.127 → v89.128 口径）──
i0 = s.index('  /* ============================================================\n   * §107 城墙入城迁移不再静默（v89.127）')
i1 = s.index("    check('§107③ 迁移只发生一次（再读档不重复写）', n127 === 1, n127 + ' 条');\n    G.state = keep127;\n  })();", i0)
i1 += len("    check('§107③ 迁移只发生一次（再读档不重复写）', n127 === 1, n127 + ' 条');\n    G.state = keep127;\n  })();")
new_sect = """  /* ============================================================
   * §107 城墙迁移：格子 / wallLv → 环城槽（v89.128）
   * ------------------------------------------------------------
   * 老档读档时城墙归一到 `city.wall`（不占格）：
   *   ① v89.126 档（cells 里的城墙格）→ 槽（等级保留、格释放）+ 消息含「城墙调整」
   *   ② 更老档（`wallLv` 字段）→ 槽（同上；字段删除）
   *   ③ 再读一次不重复（旧痕已删，不产生第二条消息）
   * ============================================================ */
  (function () {
    var keep127 = G.state;
    /* ① cells 里的城墙格 → 槽 */
    var st127 = G.newGame({ name: 'v128a', cityName: '许都', region: '豫州', mapSeed: 1 });
    var c127 = st127.cities[0];
    c127.cells[47].build = { id: 'chengqiang', lvl: 7 };   /* 模拟 v89.126 档（格子里） */
    var st127a = G.adoptState(JSON.parse(JSON.stringify(st127)));
    var c127a = st127a.cities[0];
    var last127 = (st127a.msgLog || [])[st127a.msgLog.length - 1] || {};
    check('§107① 格子城墙 → 环城槽（Lv7 保留 · 格释放 · 消息含「城墙调整」）',
      !!(c127a.wall && c127a.wall.build && c127a.wall.build.lvl === 7)
      && c127a.cells.filter(function (x) { return x.build && x.build.id === 'chengqiang'; }).length === 0
      && (last127.msg || '').indexOf('城墙调整') >= 0,
      (last127.msg || '(无消息)').slice(0, 70));
    /* ② wallLv 老档 → 槽 */
    var st127b = G.newGame({ name: 'v128b', cityName: '许都', region: '豫州', mapSeed: 2 });
    st127b.cities[0].wallLv = 5;
    var st127c = G.adoptState(JSON.parse(JSON.stringify(st127b)));
    var c127c = st127c.cities[0];
    check('§107② wallLv 老档 → 环城槽（Lv5 · 字段删除）',
      !!(c127c.wall && c127c.wall.build && c127c.wall.build.lvl === 5) && c127c.wallLv === undefined,
      'wall=' + JSON.stringify(c127c.wall && c127c.wall.build));
    /* ③ 只迁一次 */
    var st127d = G.adoptState(JSON.parse(JSON.stringify(st127a)));
    var n127 = (st127d.msgLog || []).filter(function (m) { return (m.msg || '').indexOf('城墙调整') >= 0; }).length;
    check('§107③ 迁移只发生一次（再读档不重复写）', n127 === 1, n127 + ' 条');
    G.state = keep127;
  })();"""
s = s[:i0] + new_sect + s[i1:]
n += 1
print('  ✓ ⑥ §107 整段（v89.128 口径）')

assert s != orig and n == 6


def bal(x):
    return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))


assert bal(s) == bal(orig), '括号盈亏被改变 %s vs %s' % (bal(s), bal(orig))
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch E(smoke) OK · %d 处（行尾保持 LF）' % n)
