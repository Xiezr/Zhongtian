# -*- coding: utf-8 -*-
"""v88 UI 第一批（ui.js）：品质色到6 / 描述加灵力 / 两袋寻址 / genPane 双轨 / dollSlot 重写 + 修复 / dollLingPanel。探针幂等。"""
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

# ---- U1) itemArt：品质珠上限 4 -> 6 ----
sub(
"""    var qq = Math.max(1, Math.min(4, q || 1));""",
"""    var qq = Math.max(1, Math.min(6, q || 1));   /* v88：修炼装备品质到 6（军装 q<=4 不受影响） */""",
    'U1 itemArt', 'min(6, q || 1)')

# ---- U2) equipDesc：加灵力 ----
sub(
"""    if (item.sta) parts.push('体+' + item.sta);
    return parts.join(' ') || '—';""",
"""    if (item.sta) parts.push('体+' + item.sta);
    if (item.lingv) parts.push('灵+' + item.lingv);   /* v88：灵力（游历战力） */
    return parts.join(' ') || '—';""",
    'U2 equipDesc', "if (item.lingv) parts.push('灵+' + item.lingv);")

# ---- U3) bagEquipHTML wornByU：两袋 ----
sub(
"""    var wornByU = {};
    s.generals.forEach(function (g) {
      for (var sl in (g.equip || {})) {
        var u = GAME.eqUidOf(g.equip[sl]);
        if (u != null) wornByU[u] = g.name;
      }
    });""",
"""    var wornByU = {};
    s.generals.forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套都标记 */
        for (var sl in (g[bk] || {})) {
          var u = GAME.eqUidOf(g[bk][sl]);
          if (u != null) wornByU[u] = g.name;
        }
      });
    });""",
    'U3 bag wornByU', "['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套都标记 */")

# ---- U4) openEquipDetail wornBy：两袋 ----
sub(
"""    var wornBy = null;
    s.generals.forEach(function (g) {
      for (var sl in (g.equip || {})) {
        var v = g.equip[sl];
        var hit = inst ? (v === inst) : (GAME.eqId(v) === itemId);
        if (hit) wornBy = wornBy || g.name;
      }
    });""",
"""    var wornBy = null;
    s.generals.forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套都查 */
        for (var sl in (g[bk] || {})) {
          var v = g[bk][sl];
          var hit = inst ? (v === inst) : (GAME.eqId(v) === itemId);
          if (hit) wornBy = wornBy || g.name;
        }
      });
    });""",
    'U4 detail wornBy', "['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套都查 */")

# ---- U5) 将领列表 tip：按当前套 ----
sub(
"""        '<div class="tip-a">Lv' + g.level + '　装备 ' + Object.keys(g.equip || {}).length + '/12' +""",
"""        '<div class="tip-a">Lv' + g.level + '　装备 ' + Object.keys(((g.equipOn === 'ling') ? g.lingEquip : g.equip) || {}).length + '/12' +""",
    'U5 列表 tip', "Object.keys(((g.equipOn === 'ling') ? g.lingEquip : g.equip) || {}).length")

# ---- U6) genPane：isLing + eqCnt ----
sub(
"""    var setB = GAME.systems.genSetBonus(g);
    var eqCnt = Object.keys(g.equip || {}).length;""",
"""    var setB = GAME.systems.genSetBonus(g);
    /* v88：当前生效套（'sha' 军中 / 'ling' 修炼）—— 本面板所有装备读取按它分流 */
    var isLing = (g.equipOn === 'ling');
    var eqCnt = Object.keys(((isLing ? g.lingEquip : g.equip) || {})).length;""",
    'U6 eqCnt', "var isLing = (g.equipOn === 'ling');\n    var eqCnt")

# ---- U7) genPane：inv 收集按套 ----
sub(
"""    (s.inventory || []).forEach(function (x) {
      var e = DATA.EQUIP[GAME.eqId(x)]; if (e) inv[e.slot] = (inv[e.slot] || 0) + 1;
    });""",
"""    (s.inventory || []).forEach(function (x) {
      var e = DATA.EQUIP[GAME.eqId(x)];
      if (e && !!e.ling === isLing) inv[e.slot] = (inv[e.slot] || 0) + 1;   /* v88：只数当前套 */
    });""",
    'U7 inv 按套', 'if (e && !!e.ling === isLing) inv[e.slot]')

# ---- U8) genPane：gainRows 后加灵力行 ----
sub(
"""      ['staEq', '体力']];
    var gainRows = GAIN.map(function (p2) {
      /* v65（老板）：属性一律整数 —— genAttrs 已经取整，这里直接相减就是整数 */
      var d = Math.round((a[p2[0]] || 0) - (bare[p2[0]] || 0));
      if (!d) return '';
      return '<div class="eq-grow"><span class="k">' + p2[1] + '</span>' +
        '<span class="v">' + (d > 0 ? '+' : '') + d + '</span></div>';
    }).join('');""",
"""      ['staEq', '体力']];
    var gainRows = GAIN.map(function (p2) {
      /* v65（老板）：属性一律整数 —— genAttrs 已经取整，这里直接相减就是整数 */
      var d = Math.round((a[p2[0]] || 0) - (bare[p2[0]] || 0));
      if (!d) return '';
      return '<div class="eq-grow"><span class="k">' + p2[1] + '</span>' +
        '<span class="v">' + (d > 0 ? '+' : '') + d + '</span></div>';
    }).join('');
    /* v88：修炼侧加一行「灵力」（游历战力；差值法不适用 —— 直接用汇总出口） */
    var lingRow = '';
    if (isLing && GAME.lingPowerOf) {
      var lp = GAME.lingPowerOf(g);
      if (lp) lingRow = '<div class="eq-grow"><span class="k">灵力</span><span class="v">+' + lp + '</span></div>';
    }""",
    'U8 灵力行', "var lingRow = '';\n    if (isLing && GAME.lingPowerOf)")

# ---- U9) genPane：gp-sec 加 tab ----
sub(
"""    html += '<div class="gp-sec">装备栏（' + eqCnt + ' / 12）' +
      ui.help('12 个部位对应人形上的位置，点击任一部位可更换或卸下。\\n套装件每满 3 / 5 / 7 / 11 件逐档加成，效果累计。') +
      '</div>' +""",
"""    html += '<div class="gp-sec" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
      '装备栏（' + eqCnt + ' / 12）' +
      ui.help('军中装备用于攻城野战；修炼装备用于野地游历（灵力判定）。\\n两套独立养成、整套切换生效 —— 点右侧按钮切换当前生效套。') +
      '<span style="margin-left:auto;display:inline-flex;gap:4px;">' +
        '<button class="btn sm' + (isLing ? '' : ' gold') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="sha">⚔ 军中</button>' +
        '<button class="btn sm' + (isLing ? ' gold' : '') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="ling">☯ 修炼</button>' +
      '</span>' +
      '</div>' +""",
    'U9 装备栏 tab', "data-action=\"toggle-equip-set\" data-gen=\"' + genId + '\" data-set=\"sha\"")

# ---- U10) genPane：按钮区加蕴养 ----
sub(
"""          '<div class="gp-dollops">' +
            '<button class="btn sm gold" data-action="gen-auto-equip" data-gen="' + genId + '">一键最优装备</button>' +
            '<button class="btn sm" data-action="gen-unequip-all" data-gen="' + genId + '">全部卸下</button>' +
          '</div>' +""",
"""          '<div class="gp-dollops">' +
            '<button class="btn sm gold" data-action="gen-auto-equip" data-gen="' + genId + '">一键最优装备</button>' +
            '<button class="btn sm" data-action="gen-unequip-all" data-gen="' + genId + '">全部卸下</button>' +
            (isLing ? '<button class="btn sm" data-action="ling-temper-open">☯ 蕴养</button>' : '') +
          '</div>' +""",
    'U10 蕴养按钮', "(isLing ? '<button class=\"btn sm\" data-action=\"ling-temper-open\">☯ 蕴养</button>' : '')")

# ---- U11) dollSlot 重写（含修复 v79 遗漏：实例 → id 规范化） ----
sub(
"""  ui.dollSlot = function (g, genId, slot, inv) {
    var pos = ui.DOLL_POS[slot] || [50, 50];
    var id = (g.equip || {})[slot];
    var it = id ? DATA.EQUIP[id] : null;
    var slotName = DATA.EQUIP_SLOT_NAMES[slot] || slot;
    var invN = inv[slot] || 0;
    var setNm = it && it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
    return '<div class="eq-cell doll-slot' + (it ? ' q' + it.q : ' empty') + '"' +
      ' style="left:' + pos[0] + '%;top:' + pos[1] + '%"' +
      ' data-action="eq-slot" data-gen="' + genId + '" data-slot="' + slot + '" data-tip-el="1">' +
      '<span class="eq-slotname">' + slotName + '</span>' +
      '<span class="eq-ico">' + (GAME.icons.forEquip ? GAME.icons.forEquip(slot) : '') + '</span>' +
      '<span class="eq-name' + (it ? '' : ' none') + '">' + (id ? U.escape(GAME.eqLabel(id)) : '未着') + '</span>' +
      (invN ? '<span class="eq-inv">+' + invN + '</span>' : '') +
      /* 悬停走全站唯一的 #tip-layer（v37）—— 不在这里自己绝对定位 */
      '<span class="eq-slot-tip tip-src"><div class="tip-t">' + slotName + (it ? ' · ' + U.escape(GAME.eqLabel(id)) : '') + '</div>' +
        '<div class="tip-l">' + (it ? U.escape(GAME.equipDesc(it) || '') : '该部位未着，点击选择') + '</div>' +
        (setNm ? '<div class="tip-a">' + setNm + ' 套装件</div>' : '') +
        (invN ? '<div class="tip-a">背包另有 ' + invN + ' 件可换</div>' : '') +
      '</span></div>';
  };""",
"""  ui.dollSlot = function (g, genId, slot, inv) {
    var pos = ui.DOLL_POS[slot] || [50, 50];
    /* v88：按**当前生效套**渲染（军装/修炼各 12 槽；槽名/图标/品质色/强化标全同步）。
       附带修复 v79 按件改造的一处遗漏：这里原先直接把实例对象当 DATA.EQUIP 的键
       （装着装备时 it 恒为 null → 格子丢品质色显示 empty 类）。统一走 eqId 规范化。 */
    var isLing = (g.equipOn === 'ling');
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var inst = bag[slot];
    var id = inst ? (GAME.eqId ? GAME.eqId(inst) : inst) : null;
    var it = id ? DATA.EQUIP[id] : null;
    var slotName = ((isLing ? DATA.LING_SLOT_NAMES : DATA.EQUIP_SLOT_NAMES) || {})[slot] || slot;
    var invN = inv[slot] || 0;
    var setNm = it && it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
    return '<div class="eq-cell doll-slot' + (it ? ' q' + it.q : ' empty') + '"' +
      ' style="left:' + pos[0] + '%;top:' + pos[1] + '%"' +
      ' data-action="eq-slot" data-gen="' + genId + '" data-slot="' + slot + '" data-tip-el="1">' +
      '<span class="eq-slotname">' + slotName + '</span>' +
      '<span class="eq-ico">' + (GAME.icons.forEquip ? GAME.icons.forEquip(slot) : '') + '</span>' +
      '<span class="eq-name' + (it ? '' : ' none') + '">' + (inst ? U.escape(GAME.eqLabel(inst)) : '未着') + '</span>' +
      (invN ? '<span class="eq-inv">+' + invN + '</span>' : '') +
      /* 悬停走全站唯一的 #tip-layer（v37）—— 不在这里自己绝对定位 */
      '<span class="eq-slot-tip tip-src"><div class="tip-t">' + slotName + (inst ? ' · ' + U.escape(GAME.eqLabel(inst)) : '') + '</div>' +
        '<div class="tip-l">' + (it ? U.escape(GAME.equipDesc(it) || '') : '该部位未着，点击选择') + '</div>' +
        (setNm ? '<div class="tip-a">' + setNm + ' 套装件</div>' : '') +
        (invN ? '<div class="tip-a">背包另有 ' + invN + ' 件可换</div>' : '') +
      '</span></div>';
  };""",
    'U11 dollSlot 重写', 'v88：按**当前生效套**渲染（军装/修炼各 12 槽')

# ---- U12) dollSetPanel 分流 + dollLingPanel ----
sub(
"""  /* 套装进度面板：件数 + 四档（已达/未达）+ 下一档提示 */
  ui.dollSetPanel = function (g) {
    var prog = GAME.setProgressOf(g);""",
"""  /* v88：修炼装备面板（灵力 / 总蕴养 / 精华余额）—— dollSetPanel 的修炼分支 */
  ui.dollLingPanel = function (g) {
    var s = GAME.state;
    var ess = (s.items || {}).lingsui || 0;
    var bag = g.lingEquip || {};
    var cnt = Object.keys(bag).length, total = 0;
    for (var k in bag) total += (GAME.eqEnhOf(bag[k]) || 0);
    var ling = GAME.lingPowerOf ? GAME.lingPowerOf(g) : 0;
    return '<div class="doll-set">' +
      '<div class="ds-block">' +
        '<div class="ds-head"><span class="ds-name">☯ 修炼装备</span><span class="ds-n">' + cnt + ' / 12 件</span></div>' +
        '<div class="ds-tiers">' +
          '<i class="on"><b>灵力</b>' + ling + '</i>' +
          '<i><b>总蕴养</b>+' + total + ' / 120</i>' +
          '<i><b>灵气精华</b>' + ess + '</i>' +
        '</div>' +
      '</div>' +
      '<div class="ds-empty">灵力用于野地游历判定；蕴养每级修炼属性 +8%（灵气精华 · 游历获得）。</div>' +
    '</div>';
  };
  /* 套装进度面板：件数 + 四档（已达/未达）+ 下一档提示
     v88：修炼侧无套装档 —— 直接转 dollLingPanel（灵力/蕴养面板） */
  ui.dollSetPanel = function (g) {
    if (g.equipOn === 'ling') return ui.dollLingPanel(g);
    var prog = GAME.setProgressOf(g);""",
    'U12 dollLingPanel', 'ui.dollLingPanel = function (g)')

# ---- U13) openDismissConfirm：两套合并 ----
sub(
"""    var eq = Object.keys(g.equip || {}).map(function (sl) { return DATA.EQUIP[g.equip[sl]].name; });""",
"""    var eq = [];
    ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套合并列出 */
      for (var sl in (g[bk] || {})) {
        var it2 = DATA.EQUIP[GAME.eqId(g[bk][sl])];
        if (it2) eq.push(it2.name);
      }
    });""",
    'U13 解雇确认', "['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套合并列出 */")

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')
