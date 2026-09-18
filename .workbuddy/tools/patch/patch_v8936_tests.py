# -*- coding: utf-8 -*-
"""v89.36 测试补丁：smoke-test.js 旧军粮断言 → 新口径（维持退役 / 募兵×3 / 烽火接链）

只改 smoke-test.js。e2e 无粮耗引用，不需要改。
"""
import io, os, sys

R = r'E:\Deepseekdb'
P = R + r'\smoke-test.js'


def read():
    return io.open(P, encoding='utf-8', newline='').read()


def write(s):
    tmp = P + '.tmp8936'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, P)


def edit(old, new, tag):
    src = read()
    k = src.count(old)
    if k == 1:
        write(src.replace(old, new, 1))
        assert new in read(), '落盘回查失败：' + tag
        print('OK  ' + tag)
        return
    if k == 0 and new in src:
        print('SKIP（已应用） ' + tag)
        return
    print('FAIL [%s] 命中 %d 次' % (tag, k)); sys.exit(1)


def cut(start, end, repl, tag):
    src = read()
    i = src.find(start)
    if i < 0:
        if repl in src:
            print('SKIP（已应用） ' + tag)
            return
        print('FAIL [%s] 找不到起点' % tag); sys.exit(1)
    j = src.find(end, i)
    if j < 0:
        print('FAIL [%s] 找不到终点' % tag); sys.exit(1)
    write(src[:i] + repl + src[j + len(end):])
    assert repl in read(), '落盘回查失败：' + tag
    print('OK  ' + tag)


# ============================================================
# T1. 天时影响：feedMult 断言 → 退役断言
# ============================================================
edit(
    u"  check('雪天军粮多耗', ST.feedMult() > 1.2, '×' + ST.feedMult().toFixed(2));",
    u"""  /* v89.36：军粮维持退役（军队不再吃粮）—— feedMult 随之移除 */
  check('v89.36：军粮乘数已退役（STORY.feedMult 不存在）', typeof ST.feedMult === 'undefined');""",
    'T1 feedMult 断言')

# ============================================================
# T2. §29 头注（③ 标题）
# ============================================================
edit(
    u'   *   ③ 粮食钳制 + 断粮后果     ④ 攻城伤害链 + 胜利判定',
    u'   *   ③ 军粮口径（v89.36 改）    ④ 攻城伤害链 + 胜利判定',
    'T2 §29 头注')

# ============================================================
# T3. §29 ③ 整块重写
# ============================================================
NEW3 = u'''  /* ---------- ③ 军粮口径（v89.36：维持不耗粮 / 募兵耗粮 ×3） ---------- */
  console.log('  --- ③ 军粮口径（维持退役 · 募兵耗粮 ×3）---');
  /* v89.36（老板）：「维持军队无需耗粮食，相应招募提供耗粮3倍」——
     ① 军队维持不再消耗粮草（含缺粮钳制 / 计时 / 哗变·原 v65 规则，整体退役）；
     ② 粮改为**成军一次性消耗**：全部兵种 cost.grain ×3。 */
  check('结构：旧的军粮维持出口已整体退役', (function () {
    return typeof G.foodPerSecOf === 'undefined' && typeof G.foodPerSec === 'undefined'
      && typeof G.mutinyOf === 'undefined' && typeof G.starveStep === 'undefined'
      && typeof G.isStarving === 'undefined' && typeof DATA.STARVE === 'undefined'
      && !/foodPerSecOf/.test(stripComment(sS29));
  })());
  check('实测：麾下大军跑 10 tick，粮不再因「维持」下扣（只增不减）', (function () {
    var keep = G.state;
    try {
      var st4 = G.newGame({ name: '军粮', cityName: '许都' });
      if (!st4.map.grid) G.map.generate();
      st4.cities[0].army = { tieji: 200000 };   /* 老口径下这是"每秒上万粮"的耗粮大户 */
      st4.res.grain = 1000;
      var g0 = st4.res.grain;
      for (var i = 0; i < 10; i++) G.tickOnce();
      return st4.res.grain >= g0;
    } finally { G.state = keep; }
  })());
  check('实测：募兵耗粮 ×3（义兵 10 名恰好扣 2400 = 240/名）', (function () {
    var keep = G.state;
    try {
      var st5 = G.newGame({ name: '募兵粮', cityName: '许都' });
      if (!st5.map.grid) G.map.generate();
      var c = st5.cities[0];
      var bi = -1;
      for (var k = 0; k < c.cells.length; k++) {
        if (c.cells[k].build && c.cells[k].build.id === 'junying') { bi = k; break; }
      }
      if (bi < 0) {
        for (var k2 = 0; k2 < c.cells.length; k2++) {
          if (!c.cells[k2].build && !c.cells[k2].official) { c.cells[k2].build = { id: 'junying', lvl: 5 }; bi = k2; break; }
        }
      }
      if (bi < 0) return true;                  /* 无空格可造军营 → 跳过（本测试不负责建城） */
      if (c.cells[bi].build.lvl < 5) c.cells[bi].build.lvl = 5;
      c.res.grain = 5e6; c.res.wood = 5e6; c.res.iron = 5e6; c.res.pop = 5e4;
      var before = c.res.grain;
      var r = G.train('yibing', 10, c.id, bi);
      return r.ok === true && (before - c.res.grain) === 2400
        && DATA.TROOPS.yibing.cost.grain === 240
        && DATA.TROOPS.tieji.cost.grain === 6000
        && !('food' in DATA.TROOPS.yibing);
    } finally { G.state = keep; }
  })(), '义兵粮 80→240 · 铁骑 2000→6000 · food 字段移除');
  check('实测：烽火预警横幅接回 html 链（v89.36 修：此前返回串被丢弃、从未上屏）', (function () {
    var keep = G.state;
    try {
      var st9 = G.newGame({ name: '烽火链', cityName: '许都' });
      if (!st9.map.grid) G.map.generate();
      st9.cities.push(G.makeCity({ id: 'fv2', name: '二城', x: 265, y: 215 }));
      G.invasionTick(0);
      var c9 = G.currentCity();
      if (!c9 || G.invasionDueAt(c9) <= 0) return false;   /* 排期没生效 = 测不了 = 判红 */
      G.ui.renderCityAttrs(c9, G.state);
      var h = (global.document.querySelector('#city-attrs') || {}).innerHTML || '';
      return h.indexOf('烽火') >= 0 && h.indexOf('粮尽') < 0;
    } finally { G.state = keep; }
  })());
  check('断粮吃粮的时代结束：粮尽也能出征（不再有"粮尽"拦截）', (function () {
    var keep = G.state;
    try {
      var st7 = G.newGame({ name: '粮禁', cityName: '许都' });
      if (!st7.map.grid) G.map.generate();
      var gn = st7.generals[0]; gn.stamina = 100; gn.energy = 100;
      st7.cities[0].army = { yibing: 200000 };
      st7.res.grain = 0;
      var r = G.battle.expedition({ kind: 'wild', x: st7.cities[0].x + 1, y: st7.cities[0].y },
        'raid', { yibing: 1000 }, gn.id);
      /* 改前：必被"粮尽"拦下；改后：不再因为这个理由失败 */
      return !(r.ok === false && /粮/.test(r.msg));
    } finally { G.state = keep; }
  })());
  check('侧栏不再有断粮警示（随军粮维持退役）', (function () {
    var seg = stripComment(codeOf(uS29, 'ui.renderCityAttrs = function'));
    return seg.indexOf('守军尚可支撑') < 0 && seg.indexOf('DATA.STARVE') < 0;
  })());
  check('离线补算不再扣军粮 / 不再推缺粮计时（结构）', (function () {
    var bulk = stripComment(codeOf(sS29, 'GAME.simulateBulk = function'));
    return !/foodPerSecOf/.test(bulk) && !/starveStep/.test(bulk) && !/offLostTotal/.test(bulk);
  })());
'''

cut(
    u'  /* ---------- ③ 粮食钳制 + 断粮后果 ---------- */',
    u"    && /R\\.grain < 0\\) R\\.grain = 0/.test(codeOf(sS29, 'GAME.simulateBulk = function')));",
    NEW3,
    'T3 §29 ③ 块重写')

# ============================================================
# T4. §29 ⑦ CORE_API：移除四个退役出口
# ============================================================
edit(
    u"""    ['GAME.loadGame', G.loadGame], ['GAME.starveStep', G.starveStep], ['GAME.mutinyOf', G.mutinyOf],
    ['GAME.isStarving', G.isStarving], ['GAME.wildMult', G.wildMult],
    ['GAME.techMult', G.techMult], ['GAME.foodPerSec', G.foodPerSec],""",
    u"""    ['GAME.loadGame', G.loadGame], ['GAME.wildMult', G.wildMult],
    ['GAME.techMult', G.techMult],""",
    'T4 CORE_API 表')

# ============================================================
# T5. 耗粮按城断言 → 退役断言
# ============================================================
edit(
    u"""  check('结构：耗粮按城（foodPerSecOf 唯一出口）',
    /GAME\\.foodPerSecOf = function/.test(stS) && /feedC = GAME\\.foodPerSecOf\\(ct\\)/.test(stS));""",
    u"""  check('结构：军粮维持已退役（v89.36：不再有按城耗粮出口）',
    !/foodPerSecOf/.test(stripComment(stS)) && !/feedC/.test(stripComment(stS)));""",
    'T5 耗粮按城断言')

# ============================================================
# T6. 名城 ② 组：旧"耗粮口径"两条 → 新口径两条
# ============================================================
NEW6 = u'''  check('结构：军粮维持口径已整体退役（v89.36：无 foodPerSecOf / starveStep）', (function () {
    /* 改前这里钉「耗粮只吃 s.cities」；军粮维持退役后整个口径不存在了 ——
       断言改为「口径与实现都不在」，防未来有人复活只加扣粮不加测试。 */
    var body = stripComment(stS);
    return !/foodPerSecOf/.test(body) && !/starveStep/.test(body);
  })());
  check('实测：NPC 守军一名不少，玩家驻军也不再吃粮（口径统一）', (function () {
    return freshState('v89food', function (st) {
      var npc = (st.map.cities || [])[0];
      if (!npc || !sumOf(npc.garrison)) return false;      // 分母为 0 的绿 = 什么都没测
      if ((st.cities || []).indexOf(npc) >= 0) return false;  // NPC 城不该混进已占据城池
      st.cities[0].army = { yibing: 1000 };
      var g0 = G.res(st.cities[0]).grain;
      var raw = JSON.stringify(npc.garrison);
      for (var i = 0; i < 3; i++) G.tickOnce();
      /* NPC 守军一名不少；玩家侧粮只增不减（产出入库，没有维持扣粮） */
      return JSON.stringify(npc.garrison) === raw && G.res(st.cities[0]).grain >= g0;
    });
  })(), (function () {
    var npc = (G.state.map.cities || [])[0];
    return npc ? ('该城守军 ' + sumOf(npc.garrison).toLocaleString() + ' 名（NPC 与玩家此刻都不耗粮）') : '';
  })());
'''

cut(
    u"  check('结构：耗粮口径只吃 `s.cities`（不碰 map.cities / garrison）', (function () {",
    u"完全不进入耗粮口径') : '';\n  })());",
    NEW6,
    'T6 名城耗粮两条重写')

# ============================================================
# T7. v65 ⑦ 缺粮哗变规则 → 退役组
# ============================================================
NEW7 = u'''  /* ============================================================
   * ⑦ 军粮维持退役（v89.36）：维持不耗粮 → 缺粮哗变整组下线
   * ============================================================ */
  console.log('  --- ⑦ 军粮维持退役 ---');
  check('结构：在线与离线都不再扣军粮（原 starveStep 双口径确认下线）', (function () {
    /* ⚠️ 必须先剥注释：退役说明注释里会提到函数名，不剥就会读到自己写的说明。 */
    var tick = stripComment(code49(stS49, 'GAME.tickOnce = function'));
    var bulk = stripComment(code49(stS49, 'GAME.simulateBulk = function'));
    return !/foodPerSecOf/.test(tick) && !/starveStep/.test(tick)
      && !/foodPerSecOf/.test(bulk) && !/starveStep/.test(bulk);
  })());
  check('实测：**离线补算**不再因军粮掉兵（喂一座大军城跑 simulateBulk）', (function () {
    var keep = G.state;
    try {
      var st = G.newGame({ name: 'v89off', cityName: '许都' });
      if (!st.map.grid) G.map.generate();
      var c = st.cities[0];
      st.queues.train = [];                     /* 清队列：防止离线期间"训练完成"混进兵力数 */
      c.army = { yibing: 100000 };
      c.res.grain = 0;
      var n0 = c.army.yibing;
      /* 参数是**现实秒**：推进两个游戏日（= 2×24×3600 游戏秒 / 时间倍率） */
      G.simulateBulk(2 * 24 * 3600 / G.timeScale());
      return c.army.yibing >= n0;
    } finally { G.state = keep; }
  })(), '离线两日 → 兵力不降');
  check('结构：旧的哗变实现已删干净（mutinyOf / starveStep / isStarving 都不在）',
    typeof G.mutinyOf === 'undefined' && typeof G.starveStep === 'undefined'
      && typeof G.isStarving === 'undefined' && typeof G.applyStarvation !== 'function'
      && stripComment(stS49).indexOf('mutinyOf = function') < 0
      && stripComment(stS49).indexOf('starveStep = function') < 0);
'''

cut(
    u'  /* ============================================================\n   * ⑦ 缺粮哗变：24 小时宽限 + 每 24h 逃 20%',
    u"  })(), '100000 →(24h) 80000 →(48h) 64000');",
    NEW7,
    'T7 v65 ⑦ 组重写')

# ============================================================
# T8. 兵种悬停：去"耗粮"（两处）
# ============================================================
edit(
    u"""    return ok && !!tip
      && /募兵消耗/.test(tip[1]) && /人口 /.test(tip[1]) && /耗粮 /.test(tip[1]) && /单兵耗时/.test(tip[1])
      && /\\.troop-card \\.ticon \\.ico \\{[\\s\\S]{0,140}max-width: 84px/.test(hS38);""",
    u"""    return ok && !!tip
      && /募兵消耗/.test(tip[1]) && /人口 /.test(tip[1]) && /单兵耗时/.test(tip[1])
      && tip[1].indexOf('耗粮') < 0   /* v89.36：军粮维持退役，悬停不再列耗粮 */
      && /\\.troop-card \\.ticon \\.ico \\{[\\s\\S]{0,140}max-width: 84px/.test(hS38);""",
    'T8a 悬停结构断言')

edit(
    u"""  check('实测：悬停内容含消耗/人口/耗粮/耗时', (function () {""",
    u"""  check('实测：悬停内容含消耗/人口/耗时（耗粮已随军粮维持退役）', (function () {""",
    'T8b 悬停测试名')

edit(
    u"""    return /募兵消耗/.test(m[0]) && /人口 /.test(m[0]) && /耗粮 /.test(m[0]) && /单兵耗时/.test(m[0]);
  })());""",
    u"""    return /募兵消耗/.test(m[0]) && /人口 /.test(m[0]) && /单兵耗时/.test(m[0])
      && m[0].indexOf('耗粮') < 0;
  })());""",
    'T8c 悬停内容断言')

# ============================================================
# T9. 驻军行 CSS 断言（三列 → 两列）
# ============================================================
edit(
    u"""  check('结构：驻军行也是「名称 | 数量 | 耗粮」三列 + 竖线', (function () {
    var row = cssBlock(hS67, '.gb-row');
    var f = cssBlock(hS67, '.gb-row .gb-f');
    return /display: grid/.test(row) && /grid-template-columns: 1fr 62px 74px/.test(row)
      && /border-left: 1px solid var\\(--line\\)/.test(f);
  })());""",
    u"""  check('结构：驻军行两列（名称 | 数量），耗粮列随军粮退役移除（v89.36）', (function () {
    var row = cssBlock(hS67, '.gb-row');
    var c2 = cssBlock(hS67, '.gb-row .gb-c');
    return /display: grid/.test(row) && /grid-template-columns: 1fr 74px/.test(row)
      && /border-left: 1px solid var\\(--line\\)/.test(c2)
      && !/\\.gb-row \\.gb-f \\{/.test(hS67);
  })());""",
    'T9 驻军行 CSS 断言')

print()
print('ALL OK —— v89.36 测试补丁执行完毕')
