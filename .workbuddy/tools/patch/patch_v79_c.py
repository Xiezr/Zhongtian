# -*- coding: utf-8 -*-
"""v79-C · 装备单件化：实例模型 { u, id, enh } + 同名 甲/乙 序号 + 按件强化。

模型：库存与穿戴存**实例** { u, id, enh }——
  u   = 件号（s.nextEqU 递增；同名按件号排序 → 甲/乙/丙… 序号，即"区分办法"）
  id  = 装备谱 id（DATA.EQUIP）；enh = 百炼等级（**按件**记）
兼容：旧的纯 id 字符串（老档 / 测试夹具）照读 —— 一律经 eqId / eqEnhOf 取值。
"""
import io
import sys

DOM = r'E:\Deepseekdb\js\domain.js'
SYS = r'E:\Deepseekdb\js\systems.js'
BAT = r'E:\Deepseekdb\js\battle.js'
ST = r'E:\Deepseekdb\js\state.js'
UI = r'E:\Deepseekdb\js\ui.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== A. domain.js 实例模型 ==')
# A1 · 工具层（挂在拆解函数之前）
patch(DOM,
"""  /* --------- 装备拆解：回收部分打造材料 --------- */
  GAME.salvageEquip = function (itemId) {
    var s = GAME.state, it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '无此装备' };
    var idx = (s.inventory || []).indexOf(itemId);
    if (idx < 0) return { ok: false, msg: '背包中没有这件装备' };
    var wornBy = null;
    s.generals.forEach(function (g) { if ((g.equip || {})[it.slot] === itemId) wornBy = g.name; });
    var mats = GAME.forgeMaterials(itemId), got = [];
    var due = { };
    for (var k in mats) {
      var n = Math.max(1, Math.floor(mats[k] * (DATA.FORGE.salvageRate || 0.4)));
      due[k] = n;
      got.push((DATA.MATERIAL_BY_ID[k] ? DATA.MATERIAL_BY_ID[k].name : k) + '×' + n);
    }
    /* 拆解前先把该件从将领身上卸下（若在穿） */
    if (wornBy) {
      s.generals.forEach(function (g) { if ((g.equip || {})[it.slot] === itemId) delete g.equip[it.slot]; });
    }
    s.items = s.items || {};
    for (var k2 in due) s.items[k2] = (s.items[k2] || 0) + due[k2];
    s.inventory.splice(idx, 1);
    GAME.statBump('salvaged', 1);
    GAME.log('拆解 ' + it.name + '，回收 ' + got.join('、'));
    return { ok: true, msg: '已拆解 ' + it.name + '，回收 ' + got.join('、'), got: got };
  };""",
"""  /* ============================================================
   * v79（老板第 4 条）：「装备强化是针对单件装备的，同名装备搞个区分办法」
   * ------------------------------------------------------------
   * 装备从"种"升级为"件"：库存与穿戴里存**实例** { u, id, enh }——
   *   u   = 件号（s.nextEqU 递增；同名按件号排序 → 甲/乙/丙… 序号）
   *   id  = 装备谱 id（DATA.EQUIP 的键）
   *   enh = 百炼等级（**按件**记，0..max）
   * 兼容：旧的纯 id 字符串（老档 / 测试夹具）照读不误 ——
   *   一律经 eqId / eqEnhOf 取值，读取方**不许**再直接下标。
   * ============================================================ */
  GAME.eqId = function (x) { return (x && typeof x === 'object') ? x.id : x; };
  GAME.eqEnhOf = function (x) { return (x && typeof x === 'object' && x.enh) || 0; };
  GAME.eqUidOf = function (x) { return (x && typeof x === 'object') ? x.u : null; };
  GAME.eqMake = function (id, enh) {
    var s = GAME.state;
    s.nextEqU = (s.nextEqU || 0) + 1;
    return { u: s.nextEqU, id: id, enh: Math.max(0, Math.min(GAME.enhMax(), enh || 0)) };
  };
  /* 入包（**唯一出口**：打造 / 缴获 / 卸下 / 归还 都走它） */
  GAME.addEquip = function (id, enh) {
    var s = GAME.state;
    s.inventory = s.inventory || [];
    var inst = GAME.eqMake(id, enh);
    s.inventory.push(inst);
    return inst;
  };
  /* 全部件（背包 + 穿戴） */
  GAME.eqPieces = function () {
    var s = GAME.state, out = [];
    ((s && s.inventory) || []).forEach(function (x) { if (x) out.push(x); });
    ((s && s.generals) || []).forEach(function (g) {
      for (var sl in (g.equip || {})) if (g.equip[sl]) out.push(g.equip[sl]);
    });
    return out;
  };
  /* 找一件：件号（数字）→ 实例；实例 → 自身；装备 id → 第一件（背包优先） */
  GAME.eqFind = function (ref) {
    var s = GAME.state;
    if (ref && typeof ref === 'object') return ref;
    var inv = (s && s.inventory) || [], found = null, i;
    var isNum = (typeof ref === 'number') || /^\\d+$/.test(String(ref));
    if (isNum) {
      var u = Number(ref);
      for (i = 0; i < inv.length; i++) if (inv[i] && inv[i].u === u) return inv[i];
      ((s && s.generals) || []).forEach(function (g) {
        for (var sl in (g.equip || {})) if (g.equip[sl] && g.equip[sl].u === u) found = found || g.equip[sl];
      });
      return found;
    }
    for (i = 0; i < inv.length; i++) if (GAME.eqId(inv[i]) === ref) return inv[i];
    ((s && s.generals) || []).forEach(function (g) {
      for (var sl in (g.equip || {})) if (GAME.eqId(g.equip[sl]) === ref) found = found || g.equip[sl];
    });
    return found;
  };
  /* 同名群（按件号升序）—— 序号（甲/乙/丙…）由此派生 */
  GAME.eqGroupOf = function (id) {
    return GAME.eqPieces().filter(function (x) { return GAME.eqId(x) === id; })
      .sort(function (a, b) { return (GAME.eqUidOf(a) || 0) - (GAME.eqUidOf(b) || 0); });
  };
  GAME.eqSerial = function (x) {
    var u = GAME.eqUidOf(x);
    if (u == null) return '';
    var g = GAME.eqGroupOf(GAME.eqId(x));
    if (g.length < 2) return '';
    var idx = -1;
    for (var i = 0; i < g.length; i++) if (GAME.eqUidOf(g[i]) === u) { idx = i; break; }
    if (idx < 0) return '';
    var STEMS = '甲乙丙丁戊己庚辛壬癸';
    return idx < STEMS.length ? STEMS.charAt(idx) : ('#' + (idx + 1));
  };
  GAME.eqName = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    return it ? it.name : '（装备）';
  };
  /* 显示名 = 名 + 强化 + 同名序号（老板要的「区分办法」） */
  GAME.eqLabel = function (x) {
    var lv = GAME.eqEnhOf(x), sn = GAME.eqSerial(x);
    return GAME.eqName(x) + (lv ? ' +' + lv : '') + (sn ? '·' + sn : '');
  };
  /* 存档迁移（唯一出口；loadGame 调用）：旧 id 串 → 实例；
     旧"按种"强化（s.forgeEnh）并入该种**第一件**，其余从 0 起。 */
  GAME.migrateEquipModel = function (s) {
    if (!s || s._eqModel2) return s;
    var legacyEnh = s.forgeEnh || {};
    var mk = function (id, enh) {
      s.nextEqU = (s.nextEqU || 0) + 1;
      return { u: s.nextEqU, id: id, enh: enh || 0 };
    };
    var take = function (id) {
      if (legacyEnh[id] > 0) { var e = legacyEnh[id]; delete legacyEnh[id]; return e; }
      return 0;
    };
    if (Array.isArray(s.inventory)) {
      s.inventory = s.inventory.map(function (x) {
        if (x && typeof x === 'object') return x;
        return mk(x, take(x));
      });
    }
    (s.generals || []).forEach(function (g) {
      if (!g || !g.equip) return;
      for (var sl in g.equip) {
        var v = g.equip[sl];
        if (v && typeof v === 'object') continue;
        g.equip[sl] = mk(v, take(v));
      }
    });
    delete s.forgeEnh;
    s._eqModel2 = 1;
    return s;
  };

  /* --------- 装备拆解：回收部分打造材料（v79：按**件**拆） --------- */
  GAME.salvageEquip = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '背包中没有这件装备' };
    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '无此装备' };
    var idx = (s.inventory || []).indexOf(inst);
    if (idx < 0) return { ok: false, msg: '该件不在背包（正穿在将领身上，先卸下）' };
    var label = GAME.eqLabel(inst);
    var mats = GAME.forgeMaterials(itemId), got = [];
    var due = { };
    for (var k in mats) {
      var n = Math.max(1, Math.floor(mats[k] * (DATA.FORGE.salvageRate || 0.4)));
      due[k] = n;
      got.push((DATA.MATERIAL_BY_ID[k] ? DATA.MATERIAL_BY_ID[k].name : k) + '×' + n);
    }
    s.items = s.items || {};
    for (var k2 in due) s.items[k2] = (s.items[k2] || 0) + due[k2];
    s.inventory.splice(idx, 1);
    GAME.statBump('salvaged', 1);
    GAME.log('拆解 ' + label + '，回收 ' + got.join('、'));
    return { ok: true, msg: '已拆解 ' + label + '，回收 ' + got.join('、'), got: got };
  };""",
'A1 实例模型工具 + 拆解改写')

# A2 · 打造入包
patch(DOM,
"""    if (!s.inventory) s.inventory = [];
    s.inventory.push(itemId);
    s.forged = s.forged || [];""",
"""    GAME.addEquip(itemId);   /* v79：入包唯一出口（生成实例，件号递增） */
    s.forged = s.forged || [];""",
'A2 打造入包')

# A3 · 强化链改写（enhOf/ enhCost / enhList / enhance）
patch(DOM,
"""   * 铁匠铺 · 百炼强化（v77）
   * ------------------------------------------------------------
   * 强化等级按**装备种**记（s.forgeEnh[itemId]）—— 装备是量产件模型
   * （背包存 id 不存实例），同种共享、新造的继承。
   * 效果并入 genEquipBonus（唯一出口），这里只管"能不能升、花多少"。
   * ============================================================ */
  GAME.enhOf = function (itemId) {
    var s = GAME.state;
    return (s && s.forgeEnh && s.forgeEnh[itemId]) || 0;
  };
  GAME.enhMax = function () { return (DATA.ENHANCE && DATA.ENHANCE.max) || 10; };
  /* 下一级成本（唯一出口；UI 与扣费读同一份） */
  GAME.enhCost = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (!it) return null;
    var base = (DATA.FORGE.costByQ || {})[it.q] || DATA.FORGE.costByQ[1];
    var lv = GAME.enhOf(itemId);
    var C = DATA.ENHANCE || {};
    return {
      gold: Math.round((base.gold || 0) * (C.goldMul || 0.35) * (lv + 1)),
      iron: Math.round((base.iron || 0) * (C.ironMul || 0.22) * (lv + 1)),
      stone: Math.round((base.stone || 0) * (C.stoneMul || 0.22) * (lv + 1)),
    };
  };
  /* 可强化清单：背包 + 已穿戴里的全部装备种（去重；品质高、已强化者在前） */
  GAME.enhList = function () {
    var s = GAME.state, seen = {}, ids = [];
    ((s && s.inventory) || []).forEach(function (id) {
      if (!seen[id] && DATA.EQUIP[id]) { seen[id] = 1; ids.push(id); }
    });
    ((s && s.generals) || []).forEach(function (g) {
      for (var sl in (g.equip || {})) {
        var id = g.equip[sl];
        if (!seen[id] && DATA.EQUIP[id]) { seen[id] = 1; ids.push(id); }
      }
    });
    ids.sort(function (a, b) {
      return (DATA.EQUIP[b].q - DATA.EQUIP[a].q) || (GAME.enhOf(b) - GAME.enhOf(a));
    });
    return ids;
  };
  GAME.enhance = function (itemId) {
    var s = GAME.state, it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '未知装备' };
    if (GAME.forgeLevel() <= 0) return { ok: false, msg: '需先建造铁匠铺' };
    var lv = GAME.enhOf(itemId);
    if (lv >= GAME.enhMax()) return { ok: false, msg: '「' + it.name + '」已至 +' + GAME.enhMax() + '（满级）' };
    /* 至少得拥有这件（或在穿）—— 没拥有过的种类不给强化 */
    var owned = ((s.inventory) || []).indexOf(itemId) >= 0;
    if (!owned) {
      ((s.generals) || []).forEach(function (g) {
        for (var sl in (g.equip || {})) if (g.equip[sl] === itemId) owned = true;
      });
    }
    if (!owned) return { ok: false, msg: '尚未拥有「' + it.name + '」（先打造或缴获）' };
    var cost = GAME.enhCost(itemId);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资材不足（需 ' + GAME.costString(cost) + '）' };
    GAME.payCost(cost);
    s.forgeEnh = s.forgeEnh || {};
    s.forgeEnh[itemId] = lv + 1;
    GAME.log('铁匠铺百炼：' + it.name + ' → +' + (lv + 1));
    return { ok: true, msg: '「' + it.name + '」强化 +' + (lv + 1)
      + '（装备属性 +' + Math.round((lv + 1) * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%）' };
  };""",
"""   * 铁匠铺 · 百炼强化（v77 立项 / v79 改**按件**）
   * ------------------------------------------------------------
   * 老板第 4 条：「装备强化是针对单件装备的，同名装备搞个区分办法」——
   * 强化等级从 s.forgeEnh[itemId]（按种共享）迁到**实例** inst.enh（按件）：
   * 同名多件各有各的等级，靠 +N 与 甲/乙/丙 序号区分（见 GAME.eqLabel）。
   * 效果并入 genEquipBonus（唯一出口），这里只管"能不能升、花多少"。
   * ============================================================ */
  GAME.enhOf = function (x) { return GAME.eqEnhOf(x); };   /* 实例/身份证 → 该件强化级 */
  GAME.enhMax = function () { return (DATA.ENHANCE && DATA.ENHANCE.max) || 10; };
  /* 下一级成本（唯一出口；UI 与扣费读同一份） */
  GAME.enhCost = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    if (!it) return null;
    var base = (DATA.FORGE.costByQ || {})[it.q] || DATA.FORGE.costByQ[1];
    var lv = GAME.enhOf(x);
    var C = DATA.ENHANCE || {};
    return {
      gold: Math.round((base.gold || 0) * (C.goldMul || 0.35) * (lv + 1)),
      iron: Math.round((base.iron || 0) * (C.ironMul || 0.22) * (lv + 1)),
      stone: Math.round((base.stone || 0) * (C.stoneMul || 0.22) * (lv + 1)),
    };
  };
  /* 可强化清单：背包 + 穿戴里的**全部件**（品质高、已强化者在前） */
  GAME.enhList = function () {
    var out = GAME.eqPieces().slice();
    out.sort(function (a, b) {
      return (DATA.EQUIP[GAME.eqId(b)].q - DATA.EQUIP[GAME.eqId(a)].q)
        || (GAME.enhOf(b) - GAME.enhOf(a));
    });
    return out;
  };
  GAME.enhance = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '尚未拥有这件装备（先打造或缴获）' };
    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '未知装备' };
    if (GAME.forgeLevel() <= 0) return { ok: false, msg: '需先建造铁匠铺' };
    var lv = GAME.enhOf(inst);
    var label0 = GAME.eqLabel(inst);
    if (lv >= GAME.enhMax()) return { ok: false, msg: '「' + label0 + '」已至 +' + GAME.enhMax() + '（满级）' };
    var cost = GAME.enhCost(inst);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资材不足（需 ' + GAME.costString(cost) + '）' };
    GAME.payCost(cost);
    if (inst && typeof inst === 'object') inst.enh = lv + 1;   /* 按件 +1 */
    GAME.log('铁匠铺百炼：' + label0 + ' → +' + (lv + 1));
    return { ok: true, msg: '「' + GAME.eqLabel(inst) + '」强化 +' + (lv + 1)
      + '（装备属性 +' + Math.round((lv + 1) * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%）' };
  };""",
'A3 强化链改写')

print()
print('== B. systems.js ==')
# B1 · genEquipBonus / genSetBonus / setProgressOf 取件
patch(SYS,
"""    for (var slot in g.equip) {
      var item = DATA.EQUIP[g.equip[slot]];
      if (!item) continue;
      var mul = (slot === 'mount') ? horseMul : 1;
      /* v77 · 百炼强化：同种装备共享强化等级（s.forgeEnh），每级全属性 +perLv。
         乘在「装备本身」这一层（套装加成不参与强化）——结算口径唯一在这里。 */
      var enhLv = (GAME.enhOf ? GAME.enhOf(g.equip[slot]) : 0);""",
"""    for (var slot in g.equip) {
      var inst = g.equip[slot];
      var item = DATA.EQUIP[GAME.eqId ? GAME.eqId(inst) : inst];
      if (!item) continue;
      var mul = (slot === 'mount') ? horseMul : 1;
      /* v79 · 百炼强化改**按件**：读这一件自己的 inst.enh（同名各件互不影响）。
         乘在「装备本身」这一层（套装加成不参与强化）——结算口径唯一在这里。 */
      var enhLv = (GAME.eqEnhOf ? GAME.eqEnhOf(inst) : 0);""",
'B1a 装备总加成')
patch(SYS,
"""    var counts = {};
    for (var slot in g.equip) {
      var item = DATA.EQUIP[g.equip[slot]];
      if (item && item.set) counts[item.set] = (counts[item.set] || 0) + 1;
    }""",
"""    var counts = {};
    for (var slot in g.equip) {
      var item = DATA.EQUIP[GAME.eqId ? GAME.eqId(g.equip[slot]) : g.equip[slot]];
      if (item && item.set) counts[item.set] = (counts[item.set] || 0) + 1;
    }""",
'B1b 套装计数')
patch(SYS,
"""    var out = [], counts = {};
    for (var slot in ((g && g.equip) || {})) {
      var it = DATA.EQUIP[g.equip[slot]];
      if (it && it.set) counts[it.set] = (counts[it.set] || 0) + 1;
    }""",
"""    var out = [], counts = {};
    for (var slot in ((g && g.equip) || {})) {
      var it = DATA.EQUIP[GAME.eqId ? GAME.eqId(g.equip[slot]) : g.equip[slot]];
      if (it && it.set) counts[it.set] = (counts[it.set] || 0) + 1;
    }""",
'B1c 套装进度')

# B2 · canEquip / equipItem 按件
patch(SYS,
"""  S.canEquip = function (gen, itemId) {
    var item = DATA.EQUIP[itemId];
    if (!item) return { ok: false, msg: '未知装备' };
    var inv = GAME.state.inventory || [];
    if (inv.indexOf(itemId) < 0) return { ok: false, msg: '背包中没有该装备' };
    /* 坐骑需马厩/马鞭等条件简化：等级不做硬约束 */
    return { ok: true, item: item };
  };

  S.equipItem = function (genId, itemId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var chk = S.canEquip(g, itemId);
    if (!chk.ok) return chk;
    var item = chk.item;
    /* 同槽位旧装备回背包 */
    if (g.equip[item.slot]) s.inventory.push(g.equip[item.slot]);
    g.equip[item.slot] = itemId;
    var idx = s.inventory.indexOf(itemId);
    if (idx >= 0) s.inventory.splice(idx, 1);
    GAME.log('装备 ' + item.name + ' 给 ' + g.name);
    return { ok: true, msg: '已装备 ' + item.name };
  };""",
"""  /* v79：按**件**装备 —— ref 可以是件号 / 实例 / 装备 id（旧入口兼容） */
  S.canEquip = function (gen, ref) {
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '背包中没有该装备' };
    var item = DATA.EQUIP[GAME.eqId(inst)];
    if (!item) return { ok: false, msg: '未知装备' };
    if ((GAME.state.inventory || []).indexOf(inst) < 0) return { ok: false, msg: '该件不在背包' };
    /* 坐骑需马厩/马鞭等条件简化：等级不做硬约束 */
    return { ok: true, item: item, inst: inst };
  };

  S.equipItem = function (genId, ref) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var chk = S.canEquip(g, ref);
    if (!chk.ok) return chk;
    var item = chk.item, inst = chk.inst;
    g.equip = g.equip || {};
    /* 同槽位旧件回背包（原物原样，强化随件走） */
    if (g.equip[item.slot]) s.inventory.push(g.equip[item.slot]);
    var idx = s.inventory.indexOf(inst);
    if (idx >= 0) s.inventory.splice(idx, 1);
    g.equip[item.slot] = inst;
    var label = GAME.eqLabel(inst);
    GAME.log('装备 ' + label + ' 给 ' + g.name);
    return { ok: true, msg: '已装备 ' + label };
  };""",
'B2 按件装备')

# B3 · 一键最优（按件挑）
patch(SYS,
"""    DATA.EQUIP_SLOTS.forEach(function (slot) {
      var curId = g.equip[slot] || null;
      var bestId = curId, bestScore = S.equipScore(curId ? DATA.EQUIP[curId] : null);
      s.inventory.forEach(function (id) {
        var it = DATA.EQUIP[id];
        if (!it || it.slot !== slot) return;
        var sc = S.equipScore(it);
        if (sc > bestScore) { bestScore = sc; bestId = id; }
      });
      if (bestId && bestId !== curId) {
        if (curId) s.inventory.push(curId);
        var idx = s.inventory.indexOf(bestId);
        if (idx >= 0) s.inventory.splice(idx, 1);
        g.equip[slot] = bestId;
        changed.push(DATA.EQUIP[bestId].name);
      }
    });""",
"""    DATA.EQUIP_SLOTS.forEach(function (slot) {
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
'B3 一键最优按件')

# B4 · 卸下（日志名改按件）
patch(SYS,
"""  S.unequipItem = function (genId, slot) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g || !g.equip[slot]) return { ok: false, msg: '该槽位无装备' };
    s.inventory.push(g.equip[slot]);
    var itemName = DATA.EQUIP[g.equip[slot]] ? DATA.EQUIP[g.equip[slot]].name : '';
    delete g.equip[slot];
    GAME.log('卸下 ' + itemName);
    return { ok: true, msg: '已卸下' };
  };""",
"""  S.unequipItem = function (genId, slot) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g || !g.equip[slot]) return { ok: false, msg: '该槽位无装备' };
    var label = GAME.eqLabel(g.equip[slot]);
    s.inventory.push(g.equip[slot]);   /* 原物原样回背包（强化随件走） */
    delete g.equip[slot];
    GAME.log('卸下 ' + label);
    return { ok: true, msg: '已卸下 ' + label };
  };""",
'B4 卸下按件')

print()
print('== C. battle.js 缴获入包 ==')
patch(BAT,
"""        if (!s.inventory) s.inventory = [];
        s.inventory.push(id);""",
"""        GAME.addEquip(id);   /* v79：缴获入包走实例唯一出口 */""",
'C1 缴获入包')

print()
print('== D. state.js 模板 + 迁移 ==')
patch(ST,
"""      inventory: U.deep(DATA.INITIAL_EQUIP),    // 装备背包 [itemId]
      forged: [],                               // 已打造过的装备（图鉴用）
      forgeEnh: {},                             // v77：装备百炼强化等级 {itemId: lv}""",
"""      /* v79（老板第 4 条）：装备**单件化** —— 背包存实例 { u, id, enh }：
         u = 件号（同名以 甲/乙/丙 区分）· id = 装备谱 · enh = 该件百炼等级 */
      inventory: (DATA.INITIAL_EQUIP || []).map(function (id, i) { return { u: i + 1, id: id, enh: 0 }; }),
      nextEqU: (DATA.INITIAL_EQUIP || []).length,
      forged: [],                               // 已打造过的装备（图鉴用）""",
'D1 新档模板')
patch(ST,
"""      /* v77 补字段：百炼强化表 / 月俸锚点（老档锚点=当前游戏时刻，首期 7 游戏日后到来） */
      if (!st.forgeEnh) st.forgeEnh = {};""",
"""      /* v79：装备单件化迁移（旧 id 串 → 实例；旧"按种"强化并入首件） */
      if (GAME.migrateEquipModel) GAME.migrateEquipModel(st);
      /* v77 补字段：月俸锚点（老档锚点=当前游戏时刻，首期 7 游戏日后到来） */""",
'D2 迁移挂载')

print()
print('全部完成。')
