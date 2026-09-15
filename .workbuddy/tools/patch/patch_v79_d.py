# -*- coding: utf-8 -*-
"""v79-D · UI 层：装备单件化显示（背包 / 详情 / 强化 / 换装 / 人形）。

-
- bagEquipHTML 按件列格（同名 甲/乙/丙 + +N）
- openEquipDetail 单件视角（件号/序号/持有群/穿戴者）
- openEnhance 按件强化列表
- openEqSlot / equipHTML 按件候选与穿戴
- dollSlot 人形格显示 +N·序号
- 侧栏装备计数取件；data.js 强化注释跟随
"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'
DATA = r'E:\Deepseekdb\js\data.js'


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


print('== U1. bagEquipHTML 按件 ==')
patch(UI,
"""  /* ---------- 装备页 ---------- */
  ui.bagEquipHTML = function (sort) {
    var s = GAME.state, inv = s.inventory || [];
    if (!inv.length) return '<div class="q-empty">背包暂无装备。点城内「铁匠铺」打造，或攻占城池缴获。</div>';
    /* 按 id 归并计数，同时标记是否已穿 */
    var seen = {}, worn = {};
    inv.forEach(function (id) { seen[id] = (seen[id] || 0) + 1; });
    s.generals.forEach(function (g) {
      for (var sl in (g.equip || {})) worn[g.equip[sl]] = g.name;
    });
    var ids = Object.keys(seen);
    /* 分组 */
    var groups = {};
    ids.forEach(function (id) {
      var it = DATA.EQUIP[id];
      if (!it) return;
      var key = (sort === 'set') ? (it.set ? ('set:' + it.set) : 'solo') : it.slot;
      (groups[key] = groups[key] || []).push(id);
    });
    var keys = Object.keys(groups);
    if (sort === 'slot') {
      keys.sort(function (a, b) { return EQUIP_SLOT_ORDER.indexOf(a) - EQUIP_SLOT_ORDER.indexOf(b); });
    } else if (sort === 'set') {
      keys.sort(function (a, b) { return (a === 'solo' ? 1 : 0) - (b === 'solo' ? 1 : 0); });
    }
    var rows = [];
    keys.forEach(function (k) {
      var arr = groups[k];
      arr.sort(function (x, y) { return ui.bagCmp('equip', sort, x, y); });
      var title, sub;
      if (k.indexOf('set:') === 0) {
        var sn = DATA.SETS[k.slice(4)];
        title = (sn ? sn.name : k.slice(4)) + ' 套件';
        sub = arr.length + ' 种';
      } else if (k === 'solo') {
        title = '散件（无套装）'; sub = arr.length + ' 种';
      } else {
        title = (DATA.EQUIP_SLOT_NAMES[k] || k); sub = arr.length + ' 种';
      }
      var cells = arr.map(function (id) {
        var it = DATA.EQUIP[id];
        var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
        return ui.bagCell({
          cls: 'q' + it.q, ico: GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : (DATA.EQUIP_SLOT_ICON[it.slot] || ''),
          name: it.name, cnt: seen[id] > 1 ? seen[id] : '',
          q: it.q, worn: worn[id] || '',
          title: it.name + (setNm ? '（' + setNm + '）' : ''),
          lore: (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + ' · ' + (DATA.Q_NAME[it.q] || '')
            + ' · 估值 ' + U.fmt(GAME.itemValue(id)),
          attr: GAME.equipDesc(it),
          act: 'open-bag-equip', key: id,
        });
      });
      rows = rows.concat(ui.bagRows(
        '<div class="bag-sec">' + title + ' <span class="n">' + sub + '</span></div>', k, cells));
    });
    return ui.pageBag('bag-equip', rows);
  };""",
"""  /* ---------- 装备页（v79：按**件**列格 —— 同名以 甲/乙/丙 序号 + 强化 +N 区分） ---------- */
  ui.bagEquipHTML = function (sort) {
    var s = GAME.state;
    var inv = (s.inventory || []).filter(function (x) { return !!DATA.EQUIP[GAME.eqId(x)]; });
    if (!inv.length) return '<div class="q-empty">背包暂无装备。点城内「铁匠铺」打造，或攻占城池缴获。</div>';
    /* 已穿戴件号（角标/提示用） */
    var wornByU = {};
    s.generals.forEach(function (g) {
      for (var sl in (g.equip || {})) {
        var u = GAME.eqUidOf(g.equip[sl]);
        if (u != null) wornByU[u] = g.name;
      }
    });
    /* 分组（按部位 / 按套装）—— 组内按件排 */
    var groups = {};
    inv.forEach(function (inst) {
      var it = DATA.EQUIP[GAME.eqId(inst)];
      var key = (sort === 'set') ? (it.set ? ('set:' + it.set) : 'solo') : it.slot;
      (groups[key] = groups[key] || []).push(inst);
    });
    var keys = Object.keys(groups);
    if (sort === 'slot') {
      keys.sort(function (a, b) { return EQUIP_SLOT_ORDER.indexOf(a) - EQUIP_SLOT_ORDER.indexOf(b); });
    } else if (sort === 'set') {
      keys.sort(function (a, b) { return (a === 'solo' ? 1 : 0) - (b === 'solo' ? 1 : 0); });
    }
    var rows = [];
    keys.forEach(function (k) {
      var arr = groups[k];
      arr.sort(function (x, y) {
        return ui.bagCmp('equip', sort, GAME.eqId(x), GAME.eqId(y))
          || (GAME.eqEnhOf(y) - GAME.eqEnhOf(x));
      });
      var title, sub;
      if (k.indexOf('set:') === 0) {
        var sn = DATA.SETS[k.slice(4)];
        title = (sn ? sn.name : k.slice(4)) + ' 套件';
        sub = arr.length + ' 件';
      } else if (k === 'solo') {
        title = '散件（无套装）'; sub = arr.length + ' 件';
      } else {
        title = (DATA.EQUIP_SLOT_NAMES[k] || k); sub = arr.length + ' 件';
      }
      var cells = arr.map(function (inst) {
        var id = GAME.eqId(inst), it = DATA.EQUIP[id];
        var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
        var u = GAME.eqUidOf(inst);
        return ui.bagCell({
          cls: 'q' + it.q, ico: GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : (DATA.EQUIP_SLOT_ICON[it.slot] || ''),
          name: GAME.eqLabel(inst),
          q: it.q, worn: wornByU[u] || '',
          title: GAME.eqLabel(inst) + (setNm ? '（' + setNm + '）' : ''),
          lore: (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + ' · ' + (DATA.Q_NAME[it.q] || '')
            + ' · 估值 ' + U.fmt(GAME.itemValue(id)),
          attr: GAME.equipDesc(it),
          act: 'open-bag-equip', key: (u != null ? u : id),
        });
      });
      rows = rows.concat(ui.bagRows(
        '<div class="bag-sec">' + title + ' <span class="n">' + sub + '</span></div>', k, cells));
    });
    return ui.pageBag('bag-equip', rows);
  };""",
'U1 背包装备页按件')

print()
print('== U2. openEquipDetail 单件视角 ==')
patch(UI,
"""  /* 装备详情（点背包格子） */
  ui.openEquipDetail = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (!it) { ui.toast('无此装备'); return; }
    var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : null;
    var html = '<div class="gold-heading">' + it.name + (setNm ? ' · ' + setNm : '') + '</div>';
    html += '<div class="attr"><span class="k">部位</span><span class="v">' + (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + '</span></div>';
    html += '<div class="attr"><span class="k">品质</span><span class="v">' + (DATA.Q_NAME[it.q] || "") + ' ' + '★'.repeat(it.q) + '</span></div>';
    /* v77：百炼强化等级（同种共享）——装备详情一眼可见 */
    var eLv77 = GAME.enhOf ? GAME.enhOf(itemId) : 0;
    if (eLv77) {
      html += '<div class="attr"><span class="k">百炼</span><span class="v good">+' + eLv77 +
        '（装备属性 +' + Math.round(eLv77 * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%）</span></div>';
    }
    html += '<div class="attr"><span class="k">属性</span><span class="v good">' + GAME.equipDesc(it) + '</span></div>';
    if (setNm) {
      var sd = DATA.SETS[it.set];
      var lines = [];
      for (var k in sd.bonus) lines.push(k + ' 件：' + sd.bonus[k]);
      html += '<div class="note">套装加成（穿齐件数生效）<br>' + lines.join('<br>') + '</div>';
    }
    html += '<div class="attr"><span class="k">估值</span><span class="v">' + U.fmt(GAME.itemValue(itemId)) + ' 金</span></div>';
    var s = GAME.state, inv = s.inventory || [];
    var have = inv.filter(function (x) { return x === itemId; }).length;
    var wornBy = null;
    s.generals.forEach(function (g) { if ((g.equip || {})[it.slot] === itemId) wornBy = g.name; });
    if (have > 0) {
      html += '<div class="attr"><span class="k">持有</span><span class="v">' + have + ' 件' + (wornBy ? '（' + U.escape(wornBy) + ' 已穿）' : '') + '</span></div>';
      /* v78（老板需求 3）：「装备不要『穿给谁』这种」—— 名单式穿戴整块撤除；
         穿戴统一在**将领侧**完成：将领档案点部位换装（openEqSlot），或「装备」页选将后点装备。
         装备详情只留信息 / 强化 / 拆解（两个出口合一，界面不再重复一套选人逻辑）。 */
      html += '<div class="note" style="margin-top:8px;">穿戴：到「将领」面板点对应部位换装（或「装备」页选将后点装备）。</div>';
      /* 拆解 */
      var mats = GAME.forgeMaterials(itemId), mtx = [];
      for (var mk in mats) {
        mtx.push((DATA.MATERIAL_BY_ID[mk] ? DATA.MATERIAL_BY_ID[mk].name : mk)
          + '×' + Math.max(1, Math.floor(mats[mk] * (DATA.FORGE.salvageRate || 0.4))));
      }
      html += '<div class="note" style="margin-top:12px;">拆解可回收 40% 打造材料：' + mtx.join('、') + '</div>';
      html += '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn sm gold" data-action="open-enhance" style="margin-right:6px;">⚒ 前往铁匠铺强化</button>' +
        '<button class="btn red" data-action="salvage-equip" data-key="' + itemId + '">拆解回收</button></div>';
    } else {
      html += '<div class="note">此件不在背包中（可能正穿在将领身上）。可在「将领」面板卸下。</div>';
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };""",
"""  /* 装备详情（点背包格子）—— v79：**单件视角**。
     ref 可以是 件号（实例）/ 装备 id（旧入口兼容，取第一件）。 */
  ui.openEquipDetail = function (ref) {
    var inst = GAME.eqFind(ref);
    var itemId = inst ? GAME.eqId(inst) : ref;
    var it = DATA.EQUIP[itemId];
    if (!it) { ui.toast('无此装备'); return; }
    var lv = GAME.eqEnhOf(inst), sn = inst ? GAME.eqSerial(inst) : '';
    var label = it.name + (lv ? ' +' + lv : '') + (sn ? '·' + sn : '');
    var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : null;
    var html = '<div class="gold-heading">' + U.escape(label) + (setNm ? ' · ' + setNm : '') + '</div>';
    html += '<div class="attr"><span class="k">部位</span><span class="v">' + (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + '</span></div>';
    html += '<div class="attr"><span class="k">品质</span><span class="v">' + (DATA.Q_NAME[it.q] || "") + ' ' + '★'.repeat(it.q) + '</span></div>';
    /* v79：百炼等级**按件** —— 这一件自己升到几级就显示几级 */
    if (lv) {
      html += '<div class="attr"><span class="k">百炼</span><span class="v good">+' + lv +
        '（装备属性 +' + Math.round(lv * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%，仅此件）</span></div>';
    }
    html += '<div class="attr"><span class="k">属性</span><span class="v good">' + GAME.equipDesc(it) + '</span></div>';
    if (setNm) {
      var sd = DATA.SETS[it.set];
      var lines = [];
      for (var k in sd.bonus) lines.push(k + ' 件：' + sd.bonus[k]);
      html += '<div class="note">套装加成（穿齐件数生效）<br>' + lines.join('<br>') + '</div>';
    }
    html += '<div class="attr"><span class="k">估值</span><span class="v">' + U.fmt(GAME.itemValue(itemId)) + ' 金</span></div>';
    var s = GAME.state, inv = s.inventory || [];
    var group = GAME.eqGroupOf(itemId);
    var inInv = inst ? (inv.indexOf(inst) >= 0) : false;
    var wornBy = null;
    s.generals.forEach(function (g) {
      for (var sl in (g.equip || {})) {
        var v = g.equip[sl];
        var hit = inst ? (v === inst) : (GAME.eqId(v) === itemId);
        if (hit) wornBy = wornBy || g.name;
      }
    });
    var gIdx = '';
    if (sn && group.length > 1) {
      var gi = -1;
      for (var q = 0; q < group.length; q++) if (GAME.eqUidOf(group[q]) === GAME.eqUidOf(inst)) { gi = q + 1; break; }
      gIdx = '（同种第 ' + gi + ' / ' + group.length + ' 件）';
    }
    html += '<div class="attr"><span class="k">持有</span><span class="v">' + group.length + ' 件' + gIdx +
      (wornBy ? '（' + U.escape(wornBy) + ' 已穿）' : '') + '</span></div>';
    /* v78（老板需求 3）：「装备不要『穿给谁』这种」—— 名单式穿戴整块撤除；
       穿戴统一在**将领侧**完成：将领档案点部位换装（openEqSlot），或「装备」页选将后点装备。 */
    html += '<div class="note" style="margin-top:8px;">穿戴：到「将领」面板点对应部位换装（或「装备」页选将后点装备）。</div>';
    if (inInv) {
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : itemId;
      var mats = GAME.forgeMaterials(itemId), mtx = [];
      for (var mk in mats) {
        mtx.push((DATA.MATERIAL_BY_ID[mk] ? DATA.MATERIAL_BY_ID[mk].name : mk)
          + '×' + Math.max(1, Math.floor(mats[mk] * (DATA.FORGE.salvageRate || 0.4))));
      }
      html += '<div class="note" style="margin-top:12px;">拆解可回收 40% 打造材料：' + mtx.join('、') + '</div>';
      html += '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn sm gold" data-action="open-enhance" style="margin-right:6px;">⚒ 前往铁匠铺强化</button>' +
        '<button class="btn red" data-action="salvage-equip" data-key="' + key + '">拆解回收</button></div>';
    } else if (inst) {
      html += '<div class="note">此件正穿在 ' + U.escape(wornBy || '将领') + ' 身上。可在「将领」面板卸下（强化等级随件保留）。</div>';
    } else {
      html += '<div class="note">尚未拥有此装备（先打造或缴获）。</div>';
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };""",
'U2 详情单件视角')

print()
print('== U3. openEnhance 按件 ==')
patch(UI,
"""    var ids = GAME.enhList();
    var perLv = Math.round(((DATA.ENHANCE || {}).perLv || 0.08) * 100);
    var rows = ids.map(function (id) {
      var it = DATA.EQUIP[id], lv = GAME.enhOf(id), max = GAME.enhMax();
      var cost = lv < max ? GAME.enhCost(id) : null;
      var okA = cost ? GAME.canAfford(cost) : false;
      return '<div class="enh-row">' +
        '<span class="enh-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="enh-nm">' + U.escape(it.name) +
          (it.set && DATA.SETS[it.set] ? ' <span class="ui-sub">（' + U.escape(DATA.SETS[it.set].name) + '）</span>' : '') +
          '<span class="enh-tag">+' + lv + '</span>' +
          '<div class="enh-cost">' + (cost ? ('下一级 ' + GAME.costString(cost)) : ('已至 +' + max + '（满级）')) +
            '　<span class="ui-sub">每级全属性 +' + perLv + '%（同种装备共享）</span></div></span>' +
        (cost
          ? '<button class="btn sm' + (okA ? ' gold' : '') + '" data-action="enhance-item" data-item="' + id + '"' +
              (okA ? '' : ' disabled') + '>强化 +' + (lv + 1) + '</button>'
          : '<span class="op-done">满级</span>') +
        '</div>';
    }).join('') || '<div class="q-empty">背包与穿戴中还没有可强化的装备（先在左侧打造几件）。</div>';
    ui.openShell({
      title: '⚒ 百炼强化',
      sub: '同种装备共享强化等级（新打造的继承）　满级 +' + GAME.enhMax() + '　黄金 ' + U.numText(GAME.state.res.gold || 0, 0),
      size: 'lg',""",
"""    var list = GAME.enhList();
    var perLv = Math.round(((DATA.ENHANCE || {}).perLv || 0.08) * 100);
    var rows = list.map(function (inst) {
      var id = GAME.eqId(inst);
      var it = DATA.EQUIP[id], lv = GAME.enhOf(inst), max = GAME.enhMax();
      var cost = lv < max ? GAME.enhCost(inst) : null;
      var okA = cost ? GAME.canAfford(cost) : false;
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : id;
      return '<div class="enh-row">' +
        '<span class="enh-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="enh-nm">' + U.escape(GAME.eqLabel(inst)) +
          (it.set && DATA.SETS[it.set] ? ' <span class="ui-sub">（' + U.escape(DATA.SETS[it.set].name) + '）</span>' : '') +
          '<span class="enh-tag">+' + lv + '</span>' +
          '<div class="enh-cost">' + (cost ? ('下一级 ' + GAME.costString(cost)) : ('已至 +' + max + '（满级）')) +
            '　<span class="ui-sub">每级全属性 +' + perLv + '%（按件记，同名各升各的）</span></div></span>' +
        (cost
          ? '<button class="btn sm' + (okA ? ' gold' : '') + '" data-action="enhance-item" data-item="' + key + '"' +
              (okA ? '' : ' disabled') + '>强化 +' + (lv + 1) + '</button>'
          : '<span class="op-done">满级</span>') +
        '</div>';
    }).join('') || '<div class="q-empty">背包与穿戴中还没有可强化的装备（先在左侧打造几件）。</div>';
    ui.openShell({
      title: '⚒ 百炼强化',
      sub: '**按件**强化（同名以 甲/乙/丙 区分）　满级 +' + GAME.enhMax() + '　黄金 ' + U.numText(GAME.state.res.gold || 0, 0),
      size: 'lg',""",
'U3 强化面板按件')

print()
print('== U4. openEqSlot 按件候选 ==')
patch(UI,
"""    var curId = (g.equip || {})[slot];
    var cur = curId ? DATA.EQUIP[curId] : null;
    var cand = (s.inventory || []).filter(function (x) { return DATA.EQUIP[x] && DATA.EQUIP[x].slot === slot; });
    /* 去重计数 */
    var seen = {};
    cand.forEach(function (id) { seen[id] = (seen[id] || 0) + 1; });
    var ids = Object.keys(seen).sort(function (x, y) {
      return GAME.systems.equipScore(DATA.EQUIP[y]) - GAME.systems.equipScore(DATA.EQUIP[x]);
    });
    var html = '<div class="gold-heading">' + (DATA.EQUIP_SLOT_NAMES[slot] || slot) + ' · 更换</div>';
    html += '<div class="attr"><span class="k">当前</span><span class="v' + (cur ? ' good' : '') + '">'
      + (cur ? U.escape(cur.name) + '（' + U.escape(GAME.equipDesc(cur)) + '）' : '未着') + '</span></div>';
    if (cur) {
      html += '<div style="text-align:center;margin:8px 0;"><button class="btn red" data-action="gen-unequip" data-gen="' + genId + '" data-slot="' + slot + '">卸下当前</button></div>';
    }
    if (!ids.length) {
      html += '<div class="note">背包中没有该部位的装备。</div>';
    } else {
      html += '<div class="bag-sec">背包可选 <span class="n">' + ids.length + ' 种</span></div>';
      html += '<div class="bag-grid">' + ids.map(function (id) {
        var it = DATA.EQUIP[id];
        var better = !cur || GAME.systems.equipScore(it) > GAME.systems.equipScore(cur);
        return ui.bagCell({
          cls: 'q' + it.q, ico: GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : '',
          name: it.name, cnt: seen[id] > 1 ? seen[id] : '', q: it.q,
          title: it.name + (better ? '（优于当前）' : ''),
          lore: (DATA.Q_NAME[it.q] || '') + ' · 估值 ' + U.fmt(GAME.itemValue(id)),
          attr: GAME.equipDesc(it),
          act: 'gen-equip-item', key: id, gen: genId,
        });
      }).join('') + '</div>';
    }""",
"""    var curInst = (g.equip || {})[slot];
    var cur = curInst ? DATA.EQUIP[GAME.eqId(curInst)] : null;
    var cand = (s.inventory || []).filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return it && it.slot === slot;
    });
    /* v79：候选是一次**件**（同名各列各的，带 +N 与 甲/乙/丙 序号） */
    cand.sort(function (x, y) {
      var ix = DATA.EQUIP[GAME.eqId(x)], iy = DATA.EQUIP[GAME.eqId(y)];
      return (GAME.systems.equipScore(iy) - GAME.systems.equipScore(ix)) || (GAME.eqEnhOf(y) - GAME.eqEnhOf(x));
    });
    var html = '<div class="gold-heading">' + (DATA.EQUIP_SLOT_NAMES[slot] || slot) + ' · 更换</div>';
    html += '<div class="attr"><span class="k">当前</span><span class="v' + (cur ? ' good' : '') + '">'
      + (cur ? U.escape(GAME.eqLabel(curInst)) + '（' + U.escape(GAME.equipDesc(cur)) + '）' : '未着') + '</span></div>';
    if (cur) {
      html += '<div style="text-align:center;margin:8px 0;"><button class="btn red" data-action="gen-unequip" data-gen="' + genId + '" data-slot="' + slot + '">卸下当前</button></div>';
    }
    if (!cand.length) {
      html += '<div class="note">背包中没有该部位的装备。</div>';
    } else {
      html += '<div class="bag-sec">背包可选 <span class="n">' + cand.length + ' 件</span></div>';
      html += '<div class="bag-grid">' + cand.map(function (inst) {
        var id = GAME.eqId(inst), it = DATA.EQUIP[id];
        var better = !cur || GAME.systems.equipScore(it) > GAME.systems.equipScore(cur);
        var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : id;
        return ui.bagCell({
          cls: 'q' + it.q, ico: GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : '',
          name: GAME.eqLabel(inst), q: it.q,
          title: GAME.eqLabel(inst) + (better ? '（优于当前）' : ''),
          lore: (DATA.Q_NAME[it.q] || '') + ' · 估值 ' + U.fmt(GAME.itemValue(id)),
          attr: GAME.equipDesc(it),
          act: 'gen-equip-item', key: key, gen: genId,
        });
      }).join('') + '</div>';
    }""",
'U4 换装候选按件')

print()
print('== U5. equipHTML 槽位与网格按件 ==')
patch(UI,
"""      var itemId = g.equip[slot];
      var item = itemId ? DATA.EQUIP[itemId] : null;
      return '<div class="res-line"><span class="lbl">' + (DATA.EQUIP_SLOT_NAMES[slot] || slot) + '</span>' +
        '<span class="val">' + (item ? item.name + (item.set ? ' <span style="color:var(--hero-tag);">[' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) + ']</span>' : '') +
        (item.slot === 'weapon' && item.atk ? ' 攻' + item.atk : '') + (item.spd ? ' 速' + item.spd : '') : '—') + '</span>' +""",
"""      var inst = g.equip[slot];
      var item = inst ? DATA.EQUIP[GAME.eqId(inst)] : null;
      return '<div class="res-line"><span class="lbl">' + (DATA.EQUIP_SLOT_NAMES[slot] || slot) + '</span>' +
        '<span class="val">' + (item ? U.escape(GAME.eqLabel(inst)) + (item.set ? ' <span style="color:var(--hero-tag);">[' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) + ']</span>' : '') +
        (item.slot === 'weapon' && item.atk ? ' 攻' + item.atk : '') + (item.spd ? ' 速' + item.spd : '') : '—') + '</span>' +""",
'U5a 装备页槽位')
patch(UI,
"""    var invAll = (s.inventory || []).filter(function (itemId) { return !!DATA.EQUIP[itemId]; });
    var pgE = ui.pageOf('equip', invAll.length, 10);
    var inv = invAll.slice(pgE.from, pgE.to).map(function (itemId, i) {
      var item = DATA.EQUIP[itemId];
      if (!item) return '';
      return '<div class="troop-card" style="cursor:pointer;" data-action="equip-item" data-gen="' + g.id + '" data-item="' + itemId + '">' +
        '<div class="tname">' + item.name + '</div>' +
        '<div class="tstat">' + (DATA.EQUIP_SLOT_NAMES[item.slot] || item.slot) + (item.set ? ' · ' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) : '') + '</div>' +""",
"""    var invAll = (s.inventory || []).filter(function (x) { return !!DATA.EQUIP[GAME.eqId(x)]; });
    var pgE = ui.pageOf('equip', invAll.length, 10);
    var inv = invAll.slice(pgE.from, pgE.to).map(function (inst, i) {
      var item = DATA.EQUIP[GAME.eqId(inst)];
      if (!item) return '';
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : GAME.eqId(inst);
      return '<div class="troop-card" style="cursor:pointer;" data-action="equip-item" data-gen="' + g.id + '" data-item="' + key + '">' +
        '<div class="tname">' + U.escape(GAME.eqLabel(inst)) + '</div>' +
        '<div class="tstat">' + (DATA.EQUIP_SLOT_NAMES[item.slot] || item.slot) + (item.set ? ' · ' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) : '') + '</div>' +""",
'U5b 装备页网格')

print()
print('== U6. 人形格标签 + 侧栏计数 ==')
patch(UI,
"""      '<span class="eq-name' + (it ? '' : ' none') + '">' + (it ? U.escape(it.name) : '未着') + '</span>' +""",
"""      '<span class="eq-name' + (it ? '' : ' none') + '">' + (id ? U.escape(GAME.eqLabel(id)) : '未着') + '</span>' +""",
'U6a 人形格标签')
patch(UI,
"""      '<span class="eq-slot-tip tip-src"><div class="tip-t">' + slotName + (it ? ' · ' + U.escape(it.name) : '') + '</div>' +""",
"""      '<span class="eq-slot-tip tip-src"><div class="tip-t">' + slotName + (it ? ' · ' + U.escape(GAME.eqLabel(id)) : '') + '</div>' +""",
'U6b 人形格悬停')
patch(UI,
"""    var inv = {};
    (s.inventory || []).forEach(function (x) {
      var e = DATA.EQUIP[x]; if (e) inv[e.slot] = (inv[e.slot] || 0) + 1;
    });""",
"""    var inv = {};
    (s.inventory || []).forEach(function (x) {
      var e = DATA.EQUIP[GAME.eqId(x)]; if (e) inv[e.slot] = (inv[e.slot] || 0) + 1;
    });""",
'U6c 侧栏槽位计数')

print()
print('== U7. data.js 强化注释 ==')
patch(DATA,
"""   * 模型：强化等级记在**装备谱**上（s.forgeEnh[itemId] = 0..max）——""",
"""   * 模型（v79 改）：强化等级记在**单件**上（inst.enh = 0..max，同名各升各的；见 GAME.enhance）——""",
'U7 注释跟随')

print()
print('全部完成。')
