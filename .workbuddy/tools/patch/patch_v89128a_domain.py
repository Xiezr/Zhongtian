# -*- coding: utf-8 -*-
"""v89.128 补丁 A（domain.js）：城墙回环城槽 —— 槽访问唯一出口 cellOf / wallSlotOf
   改动 9 处：wallCellIdxOf 退役 / buildingLevel 双形状读 / buildAt·upgradeAt·cancelBuild·
   demolishRefund·demolishAt 走 cellOf / popLaborLevelsOf 算城墙 / 自动建造候选含城墙
"""
import io

R = 'E:/Deepseekdb/'
P = R + 'js/domain.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    assert s.count(old) == 1, '%s 锚点 %d 个' % (tag, s.count(old))
    s = s.replace(old, new)
    n += 1
    print('  ✓ ' + tag)


# ---------- ① wallCellIdxOf → cellOf / wallSlotOf ----------
old1 = """  /* v89.126（老板「城墙与其他建筑并列管理」）：城墙格下标（唯一出口）——
     -1 = 尚未修建。环城热区点击 / 建造入口 / 断言一律读它。 */
  GAME.wallCellIdxOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return -1;
    var idx = -1;
    (city.cells || []).forEach(function (x, i) {
      if (idx < 0 && x.build && x.build.id === 'chengqiang') idx = i;
    });
    return idx;
  };"""
new1 = """  /* ============================================================
   * v89.128（老板「城墙以**环城一圈的城墙结构**作为一个建筑（地位与城内建筑同），
   *   而不是占据城内一个地块」）——城墙回**环城槽**：
   * ------------------------------------------------------------
   * · 数据形状 `city.wall = { build: {id:'chengqiang', lvl}, pending }`（与 cell 同形）
   *   —— 不占 48 格中的任何一格；`cellOf` 是**槽的唯一访问器**
   *   （数字 → cells[key]；`'wall'` → city.wall），建造/升级/拆除/队列一律走它。
   * · NPC 影子的城墙仍在计划 cells 里（攻占转正时提取到槽）——`buildingLevel`
   *   两个形状都认（读口合一，写口唯一）。
   * · 旧 `wallCellIdxOf`（v89.126 占格时代的"找格"出口）**退役**。
   * ============================================================ */
  GAME.cellOf = function (city, key) {
    if (!city) return null;
    if (key === 'wall') return city.wall || null;
    return (city.cells || [])[key];
  };
  GAME.wallSlotOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return null;
    if (!city.wall) city.wall = { build: null, pending: null };
    return city.wall;
  };"""
rep(old1, new1, '① cellOf/wallSlotOf')

# ---------- ② buildingLevel 双形状读 ----------
old2 = """    /* v89.126：城墙占格后与其它建筑**同一读法**（原 `city.wallLv` 特判退役）。 */
    var l = 0;
    (city.cells || []).forEach(function (c) { if (c.build && c.build.id === bid && c.build.lvl > l) l = c.build.lvl; });
    return l;"""
new2 = """    var l = 0;
    (city.cells || []).forEach(function (c) { if (c.build && c.build.id === bid && c.build.lvl > l) l = c.build.lvl; });
    /* v89.128：城墙回环城槽（不占格）——等级从槽里读；NPC 影子仍在计划 cells 里，
       两个形状都认（读口合一），写口只有 `wallSlotOf` 一个。 */
    if (bid === 'chengqiang' && city.wall && city.wall.build && (city.wall.build.lvl || 0) > l) l = city.wall.build.lvl;
    return l;"""
rep(old2, new2, '② buildingLevel')

# ---------- ③ buildAt ----------
old3 = """    var cell = city.cells[gridIndex];
    if (!cell || cell.build) return { ok: false, msg: '该格已被占用' };"""
new3 = """    /* v89.128：'wall' = 环城槽（城墙不占格） */
    var cell = (gridIndex === 'wall') ? GAME.wallSlotOf(city) : city.cells[gridIndex];
    if (!cell || cell.build) return { ok: false, msg: gridIndex === 'wall' ? '城墙已修建（可升级）' : '该格已被占用' };"""
rep(old3, new3, '③ buildAt')

# ---------- ④ upgradeAt ----------
old4 = """    var cell = city.cells[gridIndex];
    if (!cell || !cell.build) return { ok: false, msg: '空地无法升级' };"""
new4 = """    var cell = (gridIndex === 'wall') ? GAME.wallSlotOf(city) : city.cells[gridIndex];
    if (!cell || !cell.build) return { ok: false, msg: gridIndex === 'wall' ? '尚未修建城墙' : '空地无法升级' };"""
rep(old4, new4, '④ upgradeAt')

# ---------- ⑤ cancelBuild 清 pending ----------
old5 = """    if (kind === 'city') {
      var c = GAME.cityById(q.cityId);
      if (c && c.cells[q.gridIndex]) c.cells[q.gridIndex].pending = null;"""
new5 = """    if (kind === 'city') {
      var c = GAME.cityById(q.cityId);
      var _c128 = c && GAME.cellOf(c, q.gridIndex);   /* v89.128：'wall' 槽同样生效 */
      if (_c128) _c128.pending = null;"""
rep(old5, new5, '⑤ cancelBuild')

# ---------- ⑥ demolishRefund ----------
old6 = """  GAME.demolishRefund = function (city, gridIndex) {
    var cell = city && city.cells[gridIndex];"""
new6 = """  GAME.demolishRefund = function (city, gridIndex) {
    var cell = city && GAME.cellOf(city, gridIndex);   /* v89.128：'wall' 槽同样生效 */"""
rep(old6, new6, '⑥ demolishRefund')

# ---------- ⑦ demolishAt ----------
old7 = """  GAME.demolishAt = function (cityId, gridIndex) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) return { ok: false, msg: '城池不存在' };
    var cell = city.cells[gridIndex];
    if (!cell || !cell.build) return { ok: false, msg: '空地块' };"""
new7 = """  GAME.demolishAt = function (cityId, gridIndex) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) return { ok: false, msg: '城池不存在' };
    var cell = GAME.cellOf(city, gridIndex);   /* v89.128：'wall' = 环城槽 */
    if (!cell || !cell.build) return { ok: false, msg: '空地块' };"""
rep(old7, new7, '⑦ demolishAt')

# ---------- ⑧ popLaborLevelsOf 加城墙 ----------
old8 = """    var n = 0;
    (city.cells || []).forEach(function (cl) {
      if (cl.build && cl.build.id !== 'minfang') n += (cl.build.lvl || 1);
    });"""
new8 = """    var n = 0;
    (city.cells || []).forEach(function (cl) {
      if (cl.build && cl.build.id !== 'minfang') n += (cl.build.lvl || 1);
    });
    /* v89.128：城墙在环城槽（不占格）——劳作占用照样算它 */
    if (city.wall && city.wall.build) n += (city.wall.build.lvl || 1);"""
rep(old8, new8, '⑧ popLaborLevelsOf')

# ---------- ⑨ 自动建造候选含城墙 ----------
old9 = """        cands.push({ kind: 'city', idx: idx, cityId: ct.id, lv: cell.build.lvl,
          name: (multi ? ct.name + '·' : '') + b.name });
      });
    });"""
new9 = """        cands.push({ kind: 'city', idx: idx, cityId: ct.id, lv: cell.build.lvl,
          name: (multi ? ct.name + '·' : '') + b.name });
      });
      /* v89.128：环城槽的城墙也进候选（不占格，与城内建筑同列） */
      var _w128 = GAME.cellOf(ct, 'wall');
      if (_w128 && _w128.build && !_w128.pending && _w128.build.lvl < GAME.buildCapOf(ct, 'chengqiang')) {
        cands.push({ kind: 'city', idx: 'wall', cityId: ct.id, lv: _w128.build.lvl,
          name: (multi ? ct.name + '·' : '') + '城墙' });
      }
    });"""
rep(old9, new9, '⑨ 自动建造候选')

# ---------- 写前自检 ----------
assert s != orig and n == 9


def bal(x):
    return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))


assert bal(s) == bal(orig), '括号盈亏被改变 %s vs %s' % (bal(s), bal(orig))
assert 'GAME.cellOf = function' in s and 'wallCellIdxOf' not in s.split('v89.128')[0]
io.open(P, 'w', encoding='utf-8').write(s)
print('patch A(domain) OK · %d 处' % n)
