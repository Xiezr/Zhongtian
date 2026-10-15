# -*- coding: utf-8 -*-
"""v88 UI 第二批（ui.js）：openEqSlot 双轨 / openLingTemper / jianghuHTML / 弹窗接线 / 装备总览页。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\ui.js'
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

# ---- V1) openEqSlot 重写 ----
sub(
"""  /* 单槽位更换 */
  ui.openEqSlot = function (genId, slot) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var curInst = (g.equip || {})[slot];
    var cur = curInst ? DATA.EQUIP[GAME.eqId(curInst)] : null;
    var cand = (s.inventory || []).filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return it && it.slot === slot;
    });""",
"""  /* 单槽位更换（v88：按**当前生效套**过滤候选与槽名；修炼件附「蕴养」入口） */
  ui.openEqSlot = function (genId, slot) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var isLing = (g.equipOn === 'ling');
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var curInst = bag[slot];
    var cur = curInst ? DATA.EQUIP[GAME.eqId(curInst)] : null;
    var cand = (s.inventory || []).filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return it && it.slot === slot && (!!it.ling === isLing);   /* v88：只列本套件 */
    });""",
    'V1a openEqSlot 头', 'return it && it.slot === slot && (!!it.ling === isLing);   /* v88：只列本套件 */',
)

sub(
"""    var html = '<div class="gold-heading">' + (DATA.EQUIP_SLOT_NAMES[slot] || slot) + ' · 更换</div>';
    html += '<div class="attr"><span class="k">当前</span><span class="v' + (cur ? ' good' : '') + '">'
      + (cur ? U.escape(GAME.eqLabel(curInst)) + '（' + U.escape(GAME.equipDesc(cur)) + '）' : '未着') + '</span></div>';
    if (cur) {
      html += '<div style="text-align:center;margin:8px 0;"><button class="btn red" data-action="gen-unequip" data-gen="' + genId + '" data-slot="' + slot + '">卸下当前</button></div>';
    }""",
"""    var slotName2 = ((isLing ? DATA.LING_SLOT_NAMES : DATA.EQUIP_SLOT_NAMES) || {})[slot] || slot;
    var html = '<div class="gold-heading">' + slotName2 + ' · 更换' + (isLing ? '（☯ 修炼）' : '（⚔ 军中）') + '</div>';
    html += '<div class="attr"><span class="k">当前</span><span class="v' + (cur ? ' good' : '') + '">'
      + (cur ? U.escape(GAME.eqLabel(curInst)) + '（' + U.escape(GAME.equipDesc(cur)) + '）' : '未着') + '</span></div>';
    if (cur) {
      html += '<div style="text-align:center;margin:8px 0;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
      html += '<button class="btn red" data-action="gen-unequip" data-gen="' + genId + '" data-slot="' + slot + '">卸下当前</button>';
      if (isLing) {
        /* v88：修炼件就地蕴养（与军装「百炼强化」同位置的平行操作） */
        var lvT = GAME.eqEnhOf(curInst);
        if (lvT < GAME.lingTemperMax()) {
          var tcost = GAME.lingTemperCost(curInst);
          var tkey = GAME.eqUidOf(curInst) != null ? GAME.eqUidOf(curInst) : GAME.eqId(curInst);
          html += '<button class="btn gold" data-action="ling-temper-item" data-key="' + tkey + '">☯ 蕴养 +' + (lvT + 1) + '（精华 ' + tcost + '）</button>';
        } else {
          html += '<span class="op-done" style="align-self:center;">蕴养已圆满 +' + lvT + '</span>';
        }
      }
      html += '</div>';
    }""",
    'V1b 蕴养按钮', "html += '<button class=\"btn gold\" data-action=\"ling-temper-item\" data-key=\"' + tkey + '\">☯ 蕴养 +'",
)

sub(
"""      html += '<div class="note">背包中没有该部位的装备。</div>';""",
"""      html += '<div class="note">背包中没有该部位的' + (isLing ? '修炼' : '') + '装备。</div>';""",
    'V1c 空提示', "背包中没有该部位的' + (isLing ? '修炼' : '') + '装备",
)

sub(
"""          lore: (DATA.Q_NAME[it.q] || '') + ' · 估值 ' + U.fmt(GAME.itemValue(id)),""",
"""          lore: (GAME.qNameOf ? GAME.qNameOf(it) : '') + ' · 估值 ' + U.fmt(GAME.itemValue(id)),""",
    'V1d 品质名', 'lore: (GAME.qNameOf ? GAME.qNameOf(it) : \'\') + \' · 估值 \' + U.fmt(GAME.itemValue(id)),',
)

# ---- V2) openLingTemper 新增（openEnhance 之后） ----
sub(
"""      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* 排行榜（原版右下功能入口） */""",
"""      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ============================================================
   * v88 · 蕴养（修炼装备强化 —— 与百炼强化平行的独立面板）
   * ------------------------------------------------------------
   * 列出**已拥有**的修炼装备（背包 + 穿戴；GAME.lingTemperList），
   * 每行给下一级精华成本。等级与效果都走唯一出口（eqEnhOf / genEquipBonus /
   * lingPowerOf），这里只做呈现。
   * ============================================================ */
  ui.openLingTemper = function () {
    var list = GAME.lingTemperList();
    var perLv = Math.round(((DATA.LING_TEMPER || {}).perLv || 0.08) * 100);
    var ess = (GAME.state.items || {}).lingsui || 0;
    var rows = list.map(function (inst) {
      var id = GAME.eqId(inst);
      var it = DATA.EQUIP[id], lv = GAME.eqEnhOf(inst), max = GAME.lingTemperMax();
      var cost = lv < max ? GAME.lingTemperCost(inst) : null;
      var okA = cost != null && ess >= cost;
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : id;
      return '<div class="enh-row">' +
        '<span class="enh-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="enh-nm">' + U.escape(GAME.eqLabel(inst)) +
          '<span class="enh-tag">+' + lv + '</span>' +
          '<div class="enh-cost">' + (cost ? ('下一级 灵气精华 ' + cost) : ('已至 +' + max + '（圆满）')) +
            '　<span class="ui-sub">每级修炼属性 +' + perLv + '%（按件记，同名各蕴各的）</span></div></span>' +
        (cost
          ? '<button class="btn sm' + (okA ? ' gold' : '') + '" data-action="ling-temper-item" data-key="' + key + '"' +
              (okA ? '' : ' disabled') + '>蕴养 +' + (lv + 1) + '</button>'
          : '<span class="op-done">圆满</span>') +
        '</div>';
    }).join('') || '<div class="q-empty">还没有修炼装备。到野地「江湖游历」讨伐/试炼/采集，可得修炼装备与灵气精华。</div>';
    ui.openShell({
      title: '☯ 蕴养 · 修炼装备',
      sub: '**按件**蕴养（同名以 甲/乙/丙 区分）　满级 +' + GAME.lingTemperMax() + '　灵气精华 ' + ess + '（野地游历获得）',
      size: 'lg',
      body: '<div class="enh-list">' + rows + '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* 排行榜（原版右下功能入口） */""",
    'V2 蕴养面板', 'ui.openLingTemper = function ()')

# ---- V3) jianghuHTML + doJianghu（doWildScene 之后） ----
sub(
"""    GAME.refreshAll();
    ui.openLandModal(x, y);       /* 原地重开：显示结果与「今日已探」态 */
  };

  /* 附属野地弹窗（原版「附属野地」） */""",
"""    GAME.refreshAll();
    ui.openLandModal(x, y);       /* 原地重开：显示结果与「今日已探」态 */
  };

  /* ============================================================
   * v88（老板「修炼培养系统」）：江湖游历区块
   * ------------------------------------------------------------
   * 嵌在野地弹窗（openLandModal 未占/已占两分支）内、地形场景之下：
   *   活动菜单（每处**每活动**每日一次）+ 带队将领 + 结果回显。
   * 逻辑出口 GAME.jianghuCheck / jianghuDo（state.js，唯一）。
   * ============================================================ */
  ui._jhGen = null;
  ui._jhResult = null;
  ui.jianghuHTML = function (x, y) {
    if (!GAME.jianghuActsAt) return '';
    var tile = GAME.map.tile(x, y);
    if (!tile) return '';
    var acts = GAME.jianghuActsAt(tile.terrain);
    if (!acts.length) return '';
    var s = GAME.state;
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    var home = GAME.currentCity();
    var own = (s.generals || []).filter(function (g) { return g.cityId === home.id; });
    if (!ui._jhGen || !own.some(function (g) { return g.id === ui._jhGen; })) {
      ui._jhGen = own[0] ? own[0].id : '';
    }
    var res = (ui._jhResult && ui._jhResult.xy === (x + ',' + y)) ? ui._jhResult : null;
    var h = '<div class="op-zone" style="margin-top:8px;">' +
      '<div class="op-zone-t">☯ 江湖游历　<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);">每事每日一次 · 看灵力判定</span></div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">讨伐切磋、采药静修、拜访奇人——所得灵气精华用于蕴养修炼装备。</div>';
    if (res) {
      h += '<div class="note" style="margin:4px 0;color:' + (res.bad ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
        U.escape(res.name + '：' + res.text) + '</div>';
    }
    if (!own.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);">本城无将领可供差遣。</div>';
    } else {
      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0;">' +
        '<label style="color:var(--text-dim);">带队将领</label>' +
        '<input type="hidden" id="jh-gen" value="' + ui._jhGen + '">' +
        ui.genChips({ cls: 'gen-chips inline', target: 'jh-gen', value: ui._jhGen, list: own,
          sub: function (g) { return '精' + Math.round(g.energy || 0) + ' 体' + Math.round(GAME.staNow(g)) + ' 灵' + GAME.lingPowerOf(g); } }) +
        '</div>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
      acts.forEach(function (a) {
        var done = GAME.jianghuDone(s, x, y, a.id, day);
        h += done
          ? '<span class="op-done" style="font-size:var(--fs-sub);padding:5px 8px;">' + a.def.icon + ' ' + a.def.name + '（今日已做）</span>'
          : '<button class="btn sm" data-action="do-jianghu" data-x="' + x + '" data-y="' + y + '" data-act="' + a.id + '"' +
              ' title="' + U.escape(a.def.desc || '') + '">' + a.def.icon + ' ' + a.def.name + '（精' + a.def.energy + ' · 体' + a.def.stam + '）</button>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  };
  ui.doJianghu = function (x, y, actId) {
    var gsel = document.getElementById('jh-gen');
    var gid = gsel ? gsel.value : ui._jhGen;
    if (gid) ui._jhGen = gid;
    var r = GAME.jianghuDo(x, y, gid, actId);
    if (!r.ok) { ui.toast(r.msg); return; }
    ui._jhResult = { xy: x + ',' + y, name: r.name, text: r.text, bad: r.bad };
    ui.toast('☯ ' + r.name + (r.text ? '（' + r.text + '）' : ''));
    GAME.refreshAll();
    ui.openLandModal(x, y);       /* 原地重开：显示结果与「今日已做」态 */
  };

  /* 附属野地弹窗（原版「附属野地」） */""",
    'V3 江湖区块', 'ui.doJianghu = function (x, y, actId)')

# ---- V4) 两处弹窗调用点 ----
sub(
"""        ui.wildSceneHTML(x, y) +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +""",
"""        ui.wildSceneHTML(x, y) +
        ui.jianghuHTML(x, y) +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +""",
    'V4a 未占弹窗接线', "ui.wildSceneHTML(x, y) +\n        ui.jianghuHTML(x, y) +",
)

sub(
"""      ui.wildSceneHTML(x, y) +
      stat + ops +""",
"""      ui.wildSceneHTML(x, y) +
      ui.jianghuHTML(x, y) +
      stat + ops +""",
    'V4b 已占弹窗接线', "ui.wildSceneHTML(x, y) +\n      ui.jianghuHTML(x, y) +\n      stat + ops +",
)

# ---- V5) 装备总览页（equipHTML）按当前套 ----
sub(
"""    var slotRows = DATA.EQUIP_SLOTS.map(function (slot) {
      var inst = g.equip[slot];
      var item = inst ? DATA.EQUIP[GAME.eqId(inst)] : null;
      return '<div class="res-line"><span class="lbl">' + (DATA.EQUIP_SLOT_NAMES[slot] || slot) + '</span>' +""",
"""    /* v88：总览按**当前生效套**（槽名/装备/背包候选全同步） */
    var gIsLing = (g.equipOn === 'ling');
    var gBag = (gIsLing ? g.lingEquip : g.equip) || {};
    var gSlotNames = gIsLing ? DATA.LING_SLOT_NAMES : DATA.EQUIP_SLOT_NAMES;
    var slotRows = DATA.EQUIP_SLOTS.map(function (slot) {
      var inst = gBag[slot];
      var item = inst ? DATA.EQUIP[GAME.eqId(inst)] : null;
      return '<div class="res-line"><span class="lbl">' + (gSlotNames[slot] || slot) + '</span>' +""",
    'V5a 总览槽行', 'var gIsLing = (g.equipOn === \'ling\');\n    var gBag = (gIsLing ? g.lingEquip : g.equip) || {};',
)

sub(
"""    var invAll = (s.inventory || []).filter(function (x) { return !!DATA.EQUIP[GAME.eqId(x)]; });
    var pgE = ui.pageOf('equip', invAll.length, 10);""",
"""    var invAll = (s.inventory || []).filter(function (x) {
      var it3 = DATA.EQUIP[GAME.eqId(x)];
      return !!it3 && (!!it3.ling === gIsLing);   /* v88：候选只列当前套 */
    });
    var pgE = ui.pageOf('equip', invAll.length, 10);""",
    'V5b 总览候选', 'return !!it3 && (!!it3.ling === gIsLing);   /* v88：候选只列当前套 */',
)

sub(
"""        '<div class="tstat">' + (DATA.EQUIP_SLOT_NAMES[item.slot] || item.slot) + (item.set ? ' · ' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) : '') + '</div>' +""",
"""        '<div class="tstat">' + (gSlotNames[item.slot] || item.slot) + (item.set ? ' · ' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) : '') + '</div>' +""",
    'V5c 总览候选槽名', "(gSlotNames[item.slot] || item.slot) + (item.set ? ' · ' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) : '')",
)

sub(
"""        '<div><div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">已装备（' + Object.keys(g.equip || {}).length + '/12）</div>' + slotRows + '</div>' +""",
"""        '<div><div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">已装备（' + Object.keys(gBag).length + '/12）' + (gIsLing ? '　☯ 修炼' : '　⚔ 军中') + '</div>' + slotRows + '</div>' +""",
    'V5d 总览计数', "已装备（' + Object.keys(gBag).length + '/12）' + (gIsLing ? '　☯ 修炼' : '　⚔ 军中')",
)

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')
