# -*- coding: utf-8 -*-
"""v88 核心分流（systems.js）：equipBagOf 唯一出口 + 9 处双轨改造。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\systems.js'
d = io.open(P, encoding='utf-8', newline='').read()
dirty = False

def sub(old, new, tag, probe):
    global d, dirty
    if probe in d:
        print('SKIP ' + tag)
        return
    assert d.count(old) == 1, tag + ' 锚点命中 %d 次' % d.count(old)
    d = d.replace(old, new, 1)
    dirty = True
    print('OK ' + tag)

# ---- 0) equipBagOf（分流唯一出口）+ 1) genEquipBonus 分流 ----
sub(
"""  /* 某将装备总加成 */
  S.genEquipBonus = function (g) {""",
"""  /* ============================================================
   * v88 · 双轨装备（老板「修炼型装备系统」）
   * ------------------------------------------------------------
   * 「当前生效套」由 g.equipOn 决定（'sha' 军装 / 'ling' 修炼，缺省 sha）。
   * equipBagOf 是**唯一分流出口**：genEquipBonus / genSetBonus / setProgressOf /
   * 穿脱 / 一键最优 / 全部卸下全部读它 —— 切换只需改这一个键，
   * 六维（genAttrs）、体力上限（staMax）、战斗换算与界面显示自动同步。
   * ============================================================ */
  S.equipBagOf = function (g) {
    if (!g) return {};
    return ((g.equipOn === 'ling') ? g.lingEquip : g.equip) || {};
  };

  /* 某将装备总加成（按**当前生效套**；v88 双轨分流） */
  S.genEquipBonus = function (g) {""",
    '0/9 equipBagOf', 'S.equipBagOf = function (g)')

sub(
"""    var b = { tong: 0, nz: 0, yw: 0, zm: 0, atk: 0, def: 0, spd: 0, sta: 0 };
    if (!g || !g.equip) return b;
    /* 驯马技巧：坐骑装备属性 +5%/级 */
    var horseMul = 1 + S.techBonus('horse');
    for (var slot in g.equip) {
      var inst = g.equip[slot];
      var item = DATA.EQUIP[GAME.eqId ? GAME.eqId(inst) : inst];
      if (!item) continue;
      var mul = (slot === 'mount') ? horseMul : 1;""",
"""    var b = { tong: 0, nz: 0, yw: 0, zm: 0, atk: 0, def: 0, spd: 0, sta: 0 };
    if (!g) return b;
    /* v88：读**当前生效套**（双轨分流的唯一出口；修炼侧 75% 量级写在数据里） */
    var bag = S.equipBagOf(g);
    var isLing = (g.equipOn === 'ling');
    /* 驯马技巧：坐骑装备属性 +5%/级（仅军装侧 —— 修炼装备独立体系不吃它） */
    var horseMul = 1 + S.techBonus('horse');
    for (var slot in bag) {
      var inst = bag[slot];
      var item = DATA.EQUIP[GAME.eqId ? GAME.eqId(inst) : inst];
      if (!item) continue;
      var mul = (slot === 'mount' && !isLing) ? horseMul : 1;""",
    '1/9 genEquipBonus', 'v88：读**当前生效套**（双轨分流的唯一出口；修炼侧 75% 量级写在数据里）')

# ---- 2) genSetBonus 分流 ----
sub(
"""  S.genSetBonus = function (g) {
    var out = {};
    if (!g || !g.equip) return out;
    var counts = {};
    for (var slot in g.equip) {
      var item = DATA.EQUIP[GAME.eqId ? GAME.eqId(g.equip[slot]) : g.equip[slot]];
      if (item && item.set) counts[item.set] = (counts[item.set] || 0) + 1;
    }""",
"""  S.genSetBonus = function (g) {
    var out = {};
    if (!g) return out;
    var bag = S.equipBagOf(g);   /* v88：按当前生效套（修炼装备 MVP 无套装，自动为空） */
    var counts = {};
    for (var slot in bag) {
      var item = DATA.EQUIP[GAME.eqId ? GAME.eqId(bag[slot]) : bag[slot]];
      if (item && item.set) counts[item.set] = (counts[item.set] || 0) + 1;
    }""",
    '2/9 genSetBonus', 'bag = S.equipBagOf(g);   /* v88：按当前生效套（修炼装备 MVP 无套装，自动为空） */')

# ---- 3) setProgressOf 分流 ----
sub(
"""  S.setProgressOf = function (g) {
    var out = [], counts = {};
    for (var slot in ((g && g.equip) || {})) {
      var it = DATA.EQUIP[GAME.eqId ? GAME.eqId(g.equip[slot]) : g.equip[slot]];
      if (it && it.set) counts[it.set] = (counts[it.set] || 0) + 1;
    }""",
"""  S.setProgressOf = function (g) {
    var out = [], counts = {};
    var bag = S.equipBagOf(g);   /* v88：按当前生效套 */
    for (var slot in bag) {
      var it = DATA.EQUIP[GAME.eqId ? GAME.eqId(bag[slot]) : bag[slot]];
      if (it && it.set) counts[it.set] = (counts[it.set] || 0) + 1;
    }""",
    '3/9 setProgressOf', 'var bag = S.equipBagOf(g);   /* v88：按当前生效套 */')

# ---- 4) equipItem：按装备归属选袋 ----
sub(
"""    var item = chk.item, inst = chk.inst;
    g.equip = g.equip || {};
    /* 同槽位旧件回背包（原物原样，强化随件走） */
    if (g.equip[item.slot]) s.inventory.push(g.equip[item.slot]);
    var idx = s.inventory.indexOf(inst);
    if (idx >= 0) s.inventory.splice(idx, 1);
    g.equip[item.slot] = inst;
    var label = GAME.eqLabel(inst);""",
"""    var item = chk.item, inst = chk.inst;
    /* v88：按装备归属选袋 —— 修炼装备入 g.lingEquip，军装入 g.equip（各自 12 槽） */
    var bag = item.ling ? (g.lingEquip = g.lingEquip || {}) : (g.equip = g.equip || {});
    /* 同槽位旧件回背包（原物原样，强化随件走） */
    if (bag[item.slot]) s.inventory.push(bag[item.slot]);
    var idx = s.inventory.indexOf(inst);
    if (idx >= 0) s.inventory.splice(idx, 1);
    bag[item.slot] = inst;
    var label = GAME.eqLabel(inst);""",
    '4/9 equipItem', 'var bag = item.ling ? (g.lingEquip = g.lingEquip || {}) : (g.equip = g.equip || {});')

# ---- 5) autoEquipBest：按当前套 + 只选本套件 ----
sub(
"""    g.equip = g.equip || {};
    s.inventory = s.inventory || [];
    var changed = [];
    DATA.EQUIP_SLOTS.forEach(function (slot) {
      var curInst = g.equip[slot] || null;
      var bestInst = curInst, bestScore = S.equipScore(curInst ? DATA.EQUIP[GAME.eqId(curInst)] : null);
      s.inventory.forEach(function (inst) {
        var it = DATA.EQUIP[GAME.eqId(inst)];
        if (!it || it.slot !== slot) return;
        var sc = S.equipScore(it);
        if (sc > bestScore) { bestScore = sc; bestInst = inst; }
      });
      if (bestInst && bestInst !== curInst) {
        if (curInst) s.inventory.push(curInst);
        var idx = s.inventory.indexOf(bestInst);
        if (idx >= 0) s.inventory.splice(idx, 1);
        g.equip[slot] = bestInst;
        changed.push(GAME.eqLabel(bestInst));
      }
    });""",
"""    /* v88：只作用于**当前生效套**（军装模式挑军装，修炼模式挑修炼） */
    var isLing = (g.equipOn === 'ling');
    var bag = isLing ? (g.lingEquip = g.lingEquip || {}) : (g.equip = g.equip || {});
    s.inventory = s.inventory || [];
    var changed = [];
    DATA.EQUIP_SLOTS.forEach(function (slot) {
      var curInst = bag[slot] || null;
      var bestInst = curInst, bestScore = S.equipScore(curInst ? DATA.EQUIP[GAME.eqId(curInst)] : null);
      s.inventory.forEach(function (inst) {
        var it = DATA.EQUIP[GAME.eqId(inst)];
        if (!it || it.slot !== slot) return;
        if (!!it.ling !== isLing) return;   /* v88：跨套不候选 */
        var sc = S.equipScore(it);
        if (sc > bestScore) { bestScore = sc; bestInst = inst; }
      });
      if (bestInst && bestInst !== curInst) {
        if (curInst) s.inventory.push(curInst);
        var idx = s.inventory.indexOf(bestInst);
        if (idx >= 0) s.inventory.splice(idx, 1);
        bag[slot] = bestInst;
        changed.push(GAME.eqLabel(bestInst));
      }
    });""",
    '5/9 autoEquipBest', 'if (!!it.ling !== isLing) return;   /* v88：跨套不候选 */')

# ---- 6) unequipAll：按当前套 ----
sub(
"""    var cnt = 0;
    for (var slot in (g.equip || {})) {
      s.inventory.push(g.equip[slot]);
      delete g.equip[slot];
      cnt++;
    }
    if (!cnt) return { ok: false, msg: '该将领未着装备' };""",
"""    var cnt = 0;
    var bag = S.equipBagOf(g);   /* v88：只卸当前生效套 */
    for (var slot in bag) {
      s.inventory.push(bag[slot]);
      delete bag[slot];
      cnt++;
    }
    if (!cnt) return { ok: false, msg: '该将领未着装备' };""",
    '6/9 unequipAll', 'var bag = S.equipBagOf(g);   /* v88：只卸当前生效套 */')

# ---- 7) unequipItem：按当前套 ----
sub(
"""    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g || !g.equip[slot]) return { ok: false, msg: '该槽位无装备' };
    var label = GAME.eqLabel(g.equip[slot]);
    s.inventory.push(g.equip[slot]);   /* 原物原样回背包（强化随件走） */
    delete g.equip[slot];
    GAME.log('卸下 ' + label);
    return { ok: true, msg: '已卸下 ' + label };""",
"""    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    var bag = S.equipBagOf(g);   /* v88：按当前生效套 */
    if (!g || !bag[slot]) return { ok: false, msg: '该槽位无装备' };
    var label = GAME.eqLabel(bag[slot]);
    s.inventory.push(bag[slot]);   /* 原物原样回背包（强化随件走） */
    delete bag[slot];
    GAME.log('卸下 ' + label);
    return { ok: true, msg: '已卸下 ' + label };""",
    '7/9 unequipItem', 'var bag = S.equipBagOf(g);   /* v88：按当前生效套 */\n    if (!g || !bag[slot])')

# ---- 8) equipScore：灵力计分 ----
sub(
"""  S.equipScore = function (it) {
    if (!it) return -1;
    var v = (it.tong || 0) * 3 + (it.yw || 0) * 3 + (it.zm || 0) * 3 + (it.nz || 0) * 3
      + (it.atk || 0) + (it.def || 0) + (it.sta || 0) * 0.2 + (it.spd || 0) * 4;
    return v + (it.set ? 50 : 0);
  };""",
"""  S.equipScore = function (it) {
    if (!it) return -1;
    var v = (it.tong || 0) * 3 + (it.yw || 0) * 3 + (it.zm || 0) * 3 + (it.nz || 0) * 3
      + (it.atk || 0) + (it.def || 0) + (it.sta || 0) * 0.2 + (it.spd || 0) * 4;
    v += (it.lingv || 0) * 0.5;   /* v88：灵力计入评分（修炼侧同槽比优；军装 lingv=0 无影响） */
    return v + (it.set ? 50 : 0);
  };""",
    '8/9 equipScore', 'v += (it.lingv || 0) * 0.5;')

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')
