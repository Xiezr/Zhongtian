# -*- coding: utf-8 -*-
"""v89.128 补丁 D：smoke 城墙断言升级（占格 → 环城槽）
   覆盖：两块结构断言 / applyBuildDone / CORE_API / 满级段 /
         自动升级四连（putWall·第一目标·不重复·满级·两城）/ 战损摆法 / 城防摆法 / 两处 wallLv 摆法
"""
import io

R = 'E:/Deepseekdb/'
P = R + 'smoke-test.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    assert s.count(old) == 1, '%s 锚点 %d 个' % (tag, s.count(old))
    s = s.replace(old, new)
    n += 1
    print('  ✓ ' + tag)


# ── ① 结构断言（3029 区）──
rep("""  /* v89.126（老板）：「将城墙与其他建筑并列管理，只是一个有特殊功能的建筑」——
     城墙占一格、进建造列表；等级在 cells；建造/升级走通用出口。 */
  check('城墙**占城内一格**（进建造列表，与其它建筑并列）', DATA.BUILD_ORDER.indexOf('chengqiang') >= 0);
  check('城墙等级在 cells 里（buildingLevel 无特判 + wallCellIdxOf 唯一出口）', (function () {
    var srcW = require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8');
    var cW = G.makeCity({ id: 'w1b126', name: 'W' });
    cW.cells.push({ build: { id: 'chengqiang', lvl: 4 } });
    return !/if \\(bid === 'chengqiang'\\) return city\\.wallLv/.test(srcW)
      && G.buildingLevel(cW, 'chengqiang') === 4
      && G.wallCellIdxOf(cW) === cW.cells.length - 1;
  })());""",
    """  /* v89.128（老板）：「城墙以**环城一圈的城墙结构**作为一个建筑（地位与城内建筑同），
     而不是占据城内一个地块」——城墙回**环城槽** city.wall（不占格）；
     cellOf 是槽的唯一访问器；空格建造菜单剔除（入口 = 环城热区）。 */
  check('城墙环城结构（枚举表保留 + 空格菜单已剔除）', (function () {
    return DATA.BUILD_ORDER.indexOf('chengqiang') >= 0
      && /bid !== 'chengqiang'/.test(uiS);
  })());
  check('城墙等级在环城槽（buildingLevel 统一读法 + cellOf 唯一访问器 + 不占格）', (function () {
    var cW = G.makeCity({ id: 'w1b128', name: 'W' });
    G.wallSlotOf(cW).build = { id: 'chengqiang', lvl: 4 };
    return G.buildingLevel(cW, 'chengqiang') === 4
      && G.cellOf(cW, 'wall') === cW.wall
      && cW.cells.filter(function (x) { return x.build && x.build.id === 'chengqiang'; }).length === 0;
  })());""",
    '① 结构断言（3029 区）')

# ── ② 结构断言（4141 区）──
rep("  check('#1 城墙占城内一格（v89.126 起与其它建筑并列管理）', DATA.BUILD_ORDER.indexOf('chengqiang') >= 0);",
    "  check('#1 城墙环城结构（v89.128：不占格；枚举表保留、环城槽读写）', DATA.BUILD_ORDER.indexOf('chengqiang') >= 0);",
    '② 结构断言（4141 区）')

# ── ③ 等级读法断言（4144 区）──
rep("""  check('#1 城墙等级在 cells（buildingLevel 统一读法 + wallCellIdxOf）', (function () {
    var cW3 = G.makeCity({ id: 'w1', name: 'W' });
    cW3.cells.push({ build: { id: 'chengqiang', lvl: 4 } });
    return G.buildingLevel(cW3, 'chengqiang') === 4 && G.wallCellIdxOf(cW3) >= 0;
  })());""",
    """  check('#1 城墙等级在环城槽（buildingLevel 统一读法 + cellOf 唯一访问器）', (function () {
    var cW3 = G.makeCity({ id: 'w1', name: 'W' });
    G.wallSlotOf(cW3).build = { id: 'chengqiang', lvl: 4 };
    return G.buildingLevel(cW3, 'chengqiang') === 4 && G.cellOf(cW3, 'wall').build.lvl === 4;
  })());""",
    '③ 等级读法断言')

# ── ④ applyBuildDone 断言 ──
rep("""    var ccW = stW.cities[0];
    var idxW = 47;
    ccW.cells[idxW] = { build: { id: 'chengqiang', lvl: 3 },
      pending: { buildId: 'chengqiang', targetLevel: 4 } };
    G.applyBuildDone({ type: 'upgrade', cityId: ccW.id, gridIndex: idxW, buildId: 'chengqiang', targetLevel: 4 });
    var okW = ccW.cells[idxW].build.lvl === 4 && !ccW.cells[idxW].pending;""",
    """    var ccW = stW.cities[0];
    /* v89.128：城墙走**环城槽**（gridIndex:'wall'）—— applyBuildDone 同一套流程 */
    G.wallSlotOf(ccW).build = { id: 'chengqiang', lvl: 3 };
    G.wallSlotOf(ccW).pending = { buildId: 'chengqiang', targetLevel: 4 };
    G.applyBuildDone({ type: 'upgrade', cityId: ccW.id, gridIndex: 'wall', buildId: 'chengqiang', targetLevel: 4 });
    var okW = ccW.wall.build.lvl === 4 && !ccW.wall.pending;""",
    '④ applyBuildDone')

# ── ⑤ CORE_API 表 ──
rep("    ['GAME.storeCap', G.storeCap], ['GAME.wallCellIdxOf', G.wallCellIdxOf],",
    "    ['GAME.storeCap', G.storeCap], ['GAME.cellOf', G.cellOf], ['GAME.wallSlotOf', G.wallSlotOf],",
    '⑤ CORE_API')

# ── ⑥ 全满级段（1486）──
rep("    ct.wallLv = G.buildCapOf(ct, 'chengqiang');",
    "    G.wallSlotOf(ct).build = { id: 'chengqiang', lvl: G.buildCapOf(ct, 'chengqiang') };   /* v89.128：城墙拉满（环城槽） */",
    '⑥ 全满级段')

# ── ⑦ 战损摆法（8435 区）──
rep("  var bkWall = c.wallLv;",
    "  var bkWall = c.wall ? JSON.parse(JSON.stringify(c.wall)) : null;   /* v89.128：环城槽快照 */",
    '⑦a 战损快照')
rep("""  function setLv(lv) {
    c.cells.forEach(function (x) { if (x.build && x.build.id !== 'guanfu') x.build.lvl = lv; });
    c.cells.forEach(function (x) { if (x.official) x.build.lvl = lv; });
    c.wallLv = lv;
  }""",
    """  function setLv(lv) {
    c.cells.forEach(function (x) { if (x.build && x.build.id !== 'guanfu') x.build.lvl = lv; });
    c.cells.forEach(function (x) { if (x.official) x.build.lvl = lv; });
    G.wallSlotOf(c).build = { id: 'chengqiang', lvl: lv };   /* v89.128：环城槽 */
  }""",
    '⑦b 战损 setLv')
rep("""  c.cells.forEach(function (x, i) { x.build = bkCells[i]; });
  c.wallLv = bkWall;
  return ok;""",
    """  c.cells.forEach(function (x, i) { x.build = bkCells[i]; });
  c.wall = bkWall;
  return ok;""",
    '⑦c 战损还原')

# ── ⑧ 塔射程摆法（11354）──
rep("    c.wallLv = 6; c.def = 20;",
    "    G.wallSlotOf(c).build = { id: 'chengqiang', lvl: 6 };   /* v89.128：环城槽 */\n    c.def = 20;",
    '⑧ 塔射程摆法')

# ── ⑨ 攻城摆法（13374）──
rep("    c.wallLv = 3; c.army = { yibing: 1234 };",
    "    G.wallSlotOf(c).build = { id: 'chengqiang', lvl: 3 };   /* v89.128：环城槽 */\n    c.army = { yibing: 1234 };",
    '⑨ 攻城摆法')

# ── ⑩ _wallSet（守备力段）──
rep("""    /* ---- ★ 核心一：城防真的被消费（不再是死显示）----
       v89.126：城墙占格 —— 摆"格子里的城墙等级"（原 `c.wallLv` 摆法已退役） */
    var _wallSet = function (cc, lv) {
      var wi = (G.wallCellIdxOf ? G.wallCellIdxOf(cc) : -1);
      if (wi >= 0) cc.cells[wi].build = null;   /* 先清旧城墙格 */
      if (lv > 0) {
        var slot = -1;
        for (var i = 0; i < cc.cells.length; i++) {
          var x = cc.cells[i];
          if (!x.build && !x.official && !x.pending) { slot = i; break; }
        }
        if (slot >= 0) cc.cells[slot].build = { id: 'chengqiang', lvl: lv };
      }
    };""",
    """    /* ---- ★ 核心一：城防真的被消费（不再是死显示）----
       v89.128：城墙摆进**环城槽**（唯一写口 wallSlotOf） */
    var _wallSet = function (cc, lv) {
      var ws = G.wallSlotOf(cc);
      ws.build = lv > 0 ? { id: 'chengqiang', lvl: lv } : null;
      ws.pending = null;
    };""",
    '⑩ _wallSet')

# ── ⑪ putWall ──
rep("""  function putWall(st, name) {
    var c = st.cities[0];
    c.cells.forEach(function (x) {
      if (x.build && !x.official) x.build.lvl = Math.min(5, DATA.BUILDINGS[x.build.id].maxLevel);
    });
    (c.cells || []).forEach(function (x) { if (x.official) x.build.lvl = 12; });
    var put = false;
    for (var i = 0; i < c.cells.length && !put; i++) {
      var x = c.cells[i];
      if (!x.build && !x.official && !x.pending) { x.build = { id: 'chengqiang', lvl: 1 }; put = true; }
    }
    st.settings.autoUpgrade = true;
    st.queues.build.length = 0;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5000000; });
    return put;
  }""",
    """  function putWall(st, name) {
    var c = st.cities[0];
    c.cells.forEach(function (x) {
      if (x.build && !x.official) x.build.lvl = Math.min(5, DATA.BUILDINGS[x.build.id].maxLevel);
    });
    (c.cells || []).forEach(function (x) { if (x.official) x.build.lvl = 12; });
    /* v89.128：城墙摆进**环城槽** Lv1（全场最低）→ 自动升级第一目标必是它 */
    G.wallSlotOf(c).build = { id: 'chengqiang', lvl: 1 };
    st.settings.autoUpgrade = true;
    st.queues.build.length = 0;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5000000; });
    return true;
  }""",
    '⑪ putWall')

# ── ⑫ 第一目标断言 ──
rep("""  check('实测：城墙格 Lv1（最低）时，自动升级第一目标就是它（普通候选排序）', (function () {
    return withState('v126wall1', function (st) {
      if (!putWall(st)) return false;
      var c = st.cities[0];
      var r = G.autoUpgrade();
      var tgt = r && r.target;
      return !!(r && r.ok && tgt) && c.cells[tgt.idx]
        && c.cells[tgt.idx].build && c.cells[tgt.idx].build.id === 'chengqiang';
    });
  })()""",
    """  check('实测：城墙槽 Lv1（最低）时，自动升级第一目标就是它（普通候选排序）', (function () {
    return withState('v126wall1', function (st) {
      if (!putWall(st)) return false;
      var c = st.cities[0];
      var r = G.autoUpgrade();
      var tgt = r && r.target;
      return !!(r && r.ok && tgt) && String(tgt.idx) === 'wall'
        && !!(c.wall && c.wall.build && c.wall.build.id === 'chengqiang');
    });
  })()""",
    '⑫ 第一目标断言')

# ── ⑬ 不重复排队断言 ──
rep("""  check('实测：城墙已在施工队列时不再重复排队（cell.pending 与其它建筑同一查法）', (function () {
    return withState('v126wall2', function (st) {
      if (!putWall(st)) return false;
      var c = st.cities[0];
      var r1 = G.autoUpgrade();
      if (!(r1 && r1.ok && r1.target)) return false;
      var idxW = G.wallCellIdxOf(c);
      if (idxW < 0 || !(c.cells[idxW].pending)) return false;
      var r2 = G.autoUpgrade();
      var wallQ = st.queues.build.filter(function (q) { return q.buildId === 'chengqiang'; });
      /* 判据：城墙队列**只有一条**、且第二次不会再挑它（它已 pending） */
      return wallQ.length === 1 && !(r2 && r2.target && r2.target.idx === idxW);
    });
  })());""",
    """  check('实测：城墙已在施工队列时不再重复排队（wall.pending 与其它建筑同一查法）', (function () {
    return withState('v126wall2', function (st) {
      if (!putWall(st)) return false;
      var c = st.cities[0];
      var r1 = G.autoUpgrade();
      if (!(r1 && r1.ok && r1.target)) return false;
      if (!(c.wall && c.wall.pending)) return false;
      var r2 = G.autoUpgrade();
      var wallQ = st.queues.build.filter(function (q) { return q.buildId === 'chengqiang'; });
      /* 判据：城墙队列**只有一条**、且第二次不会再挑它（它已 pending） */
      return wallQ.length === 1 && !(r2 && r2.target && String(r2.target.idx) === 'wall');
    });
  })());""",
    '⑬ 不重复排队')

# ── ⑭ 满级段 ──
rep("""      var capW = G.buildCapOf(c, 'chengqiang');
      var putW = false;
      for (var i = 0; i < c.cells.length && !putW; i++) {
        if (!c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: 'chengqiang', lvl: capW }; putW = true; }
      }""",
    """      var capW = G.buildCapOf(c, 'chengqiang');
      G.wallSlotOf(c).build = { id: 'chengqiang', lvl: capW };   /* v89.128：环城槽拉满 */""",
    '⑭ 满级段')

# ── ⑮ 两城摆法 ──
rep("""        var put = false;
        for (var i = 0; i < c.cells.length && !put; i++) {
          var x = c.cells[i];
          if (!x.build && !x.official && !x.pending) { x.build = { id: 'chengqiang', lvl: 1 }; put = true; }
        }
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5000000; });""",
    """        G.wallSlotOf(c).build = { id: 'chengqiang', lvl: 1 };   /* v89.128：环城槽 */
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5000000; });""",
    '⑮ 两城摆法')

assert s != orig and n == 17


def bal(x):
    return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))


assert bal(s) == bal(orig), '括号盈亏被改变 %s vs %s' % (bal(s), bal(orig))
io.open(P, 'w', encoding='utf-8').write(s)
print('patch D(smoke) OK · %d 处' % n)
