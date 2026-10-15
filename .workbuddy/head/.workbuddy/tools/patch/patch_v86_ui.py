# -*- coding: utf-8 -*-
"""v86 · UI 层：出征面板计略行 + 计略选择弹窗 + 城池布防 + 商城分类 + 事件分发。"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'
MJ = r'E:\Deepseekdb\js\main.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
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


print('== U1. 商城分类加「锦囊」 ==')
patch(
    UI,
    """    /* v77（老板「丰富商场道具」）：宝箱 / 内功秘籍 / 政令（徭役令）三类新货 */
    chest: '宝箱', neigong: '秘籍', corvee: '政令',
  };""",
    """    /* v77（老板「丰富商场道具」）：宝箱 / 内功秘籍 / 政令（徭役令）三类新货 */
    chest: '宝箱', neigong: '秘籍', corvee: '政令',
    /* v86（老板「按计划进行」· G1）：锦囊 —— 施展计谋所需 */
    talis: '锦囊',
  };""",
    'U1 商城分类',
    probe="talis: '锦囊',",
)

print()
print('== U2. 出征面板：计略行 ==')
patch(
    UI,
    """    html += '<div class="exp-info">战术 <b>' + GAME.tacticSummary() + '</b>' +
      '<span class="exp-tac-link" data-action="open-tactic">调整</span></div>';
    html += '<div class="exp-modes">' + mtabs + '</div>';""",
    """    html += '<div class="exp-info">战术 <b>' + GAME.tacticSummary() + '</b>' +
      '<span class="exp-tac-link" data-action="open-tactic">调整</span></div>';
    /* v86（老板「按计划进行」· G1）：计略 —— 本次出征携一门计（主将施计） */
    html += '<div class="exp-info">计略 <b id="exp-scheme-label">' + ui.expSchemeLabel() + '</b>' +
      '<span class="exp-tac-link" data-action="exp-scheme">选择</span></div>';
    html += '<div class="exp-modes">' + mtabs + '</div>';""",
    'U2 计略行',
    probe='id="exp-scheme-label"',
)

print()
print('== U3. openExpModal 打开时重置计略选择 ==')
patch(
    UI,
    """  ui.openExpModal = function (target) {
    var s = GAME.state, c = GAME.currentCity();
    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) { ui.toast(t.msg); return; }
    ui._expTarget = target;""",
    """  ui.openExpModal = function (target) {
    var s = GAME.state, c = GAME.currentCity();
    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) { ui.toast(t.msg); return; }
    ui._expTarget = target;
    ui._expScheme = null;      /* v86：每次打开出征面板重置计略（防上次的计意外带上） */""",
    'U3 重置',
    probe='ui._expScheme = null;      /* v86：每次打开出征面板重置计略',
)

print()
print('== U4. 计略函数组（挂在 openExpModal 之前） ==')
patch(
    UI,
    """  ui.openExpModal = function (target) {""",
    """  /* ============================================================
   * v86（老板「按计划进行」· G1）：计略选择（出征面板）
   * ------------------------------------------------------------
   * attack/march 计随出征携带（校验不通过给原因；含每日锁）；
   * defense 计在「城池面板 → 布防计略」单独布防（见 ui.openCityScheme）。
   * ============================================================ */
  ui._expScheme = null;
  ui.expSchemeLabel = function () {
    var sid = ui._expScheme;
    if (!sid) return '未用计';
    var sc = GAME.schemeOf(sid);
    return sc ? (sc.icon + ' ' + sc.name + '（精' + sc.energy + ' · 囊' + sc.jinang + '）') : '未用计';
  };
  ui.setExpSchemeLabel = function () {
    var lb = $('#exp-scheme-label');
    if (lb) lb.textContent = ui.expSchemeLabel();
  };
  ui.expSchemeGenOf = function () {
    var s = GAME.state, gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === ui._expGen) gen = g; });
    return gen;
  };
  ui.openExpScheme = function () {
    var s = GAME.state;
    var t = ui._expRes;
    if (!t) { ui.toast('未选择目标'); return; }
    var gen = ui.expSchemeGenOf();
    var ja = (s.items && s.items.jinang) || 0;
    var list = (DATA.SCHEMES || []).filter(function (sc) { return sc.kind === 'attack' || sc.kind === 'march'; });
    var rows = list.map(function (sc) {
      var chk = GAME.schemePrepare(sc.id, t, gen);
      var on = ui._expScheme === sc.id;
      var extra = '';
      if (sc.id === 'tiaobo' && t.npc) {
        var n = GAME.schemeMarksOf(GAME.schemeKeyOf(t), 'tiaobo');
        extra = '　<span style="color:var(--gold-light);">该城守将忠诚 ' + Math.max(0, 100 - 25 * n) + '（已施 ' + n + ' 次）</span>';
      }
      var btn = chk.ok
        ? '<button class="btn sm' + (on ? '' : ' gold') + '" data-action="exp-scheme-pick" data-v="' + sc.id + '">' + (on ? '撤下' : '选择') + '</button>'
        : '<button class="btn sm" disabled title="' + U.escape(chk.msg) + '">不可用</button>';
      return '<div class="inn-card"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">' + sc.icon + ' ' + sc.name +
          '　<span style="color:var(--text-dim);font-size:var(--fs-sub);">精' + sc.energy + ' · 囊' + sc.jinang + '</span>' +
          (on ? '　<span style="color:var(--green-ok);">已选</span>' : '') + extra + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);">' + U.escape(sc.tip) + '</div>' +
        (chk.ok ? '' : '<div style="color:var(--red-light);font-size:var(--fs-sub);margin-top:2px;">' + U.escape(chk.msg) + '</div>') +
        '</div>' + btn + '</div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🎴 计略 · ' + U.escape(t.name || '') + '</div>' +
      '<div class="note">每次出征可携一门计，由主将施计（消耗精力与锦囊）。锦囊现有 <b>' + ja + '</b> 个，商城可购。</div>' +
      rows +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
  };
  /* 布防计略（城池面板）——防御计布在自己城上，持续期内自动生效 */
  ui._csGen = null;
  ui.openCityScheme = function () {
    var c = GAME.currentCity();
    var s = GAME.state;
    var now = (s.world && s.world.elapsed) || 0;
    var ja = (s.items && s.items.jinang) || 0;
    var own = (s.generals || []).filter(function (g) { return g.cityId === c.id; });
    if (!ui._csGen || !own.some(function (g) { return g.id === ui._csGen; })) {
      ui._csGen = own[0] ? own[0].id : '';
    }
    var list = (DATA.SCHEMES || []).filter(function (sc) { return sc.kind === 'defense'; });
    var rows = list.map(function (sc) {
      var act = GAME.schemeDefOf(c, sc.id, now);
      var btn = act
        ? '<span style="color:var(--green-ok);white-space:nowrap;">布防中（余 ' + Math.ceil(act.left / 3600) + ' 时）</span>'
        : '<button class="btn sm gold" data-action="city-scheme-pick" data-v="' + sc.id + '">布防</button>';
      return '<div class="inn-card"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">' + sc.icon + ' ' + sc.name +
          '　<span style="color:var(--text-dim);font-size:var(--fs-sub);">精' + sc.energy + ' · 囊' + sc.jinang + '</span></div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);">' + U.escape(sc.tip) + '</div>' +
        '</div>' + btn + '</div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🎴 布防计略 · ' + U.escape(c.name) + '</div>' +
      '<div class="note">防御计布防于本城，持续期内自动生效。锦囊现有 <b>' + ja + '</b> 个。</div>' +
      '<div class="mk-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;">' +
        '<label style="color:var(--text-dim);">施计将领</label>' +
        '<input type="hidden" id="cs-gen" value="' + ui._csGen + '">' +
        ui.genChips({ cls: 'gen-chips inline', target: 'cs-gen', value: ui._csGen, list: own,
          sub: function (g) { return '精' + Math.round(g.energy || 0); } }) +
      '</div>' +
      rows +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
  };
  ui.doExpSchemePick = function (sid) {
    ui._expScheme = (ui._expScheme === sid) ? null : sid;   /* 再点一次 = 撤下 */
    ui.setExpSchemeLabel();
    ui.openExpScheme();
  };
  ui.doCitySchemePick = function (sid) {
    var c = GAME.currentCity();
    var sc = GAME.schemeOf(sid);
    var s = GAME.state;
    var gsel = document.getElementById('cs-gen');
    var gid = gsel ? gsel.value : ui._csGen;
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === gid) gen = g; });
    if (!sc) return;
    if (!gen) { ui.toast('请选择施计将领'); return; }
    if ((gen.energy || 0) < sc.energy) { ui.toast(gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + sc.energy + '），可服清心丸'); return; }
    if (((s.items || {}).jinang || 0) < sc.jinang) { ui.toast('锦囊不足（' + ((s.items || {}).jinang || 0) + '/' + sc.jinang + '），可去商城购买'); return; }
    GAME.schemeDefSet(c, sc.id, gen);
    ui._csGen = gen.id;
    ui.closeModal();
    ui.toast('已布防「' + sc.name + '」');
    GAME.refreshAll();
  };

  ui.openExpModal = function (target) {""",
    'U4 计略函数组',
    probe='ui.expSchemePanelHTML = function',
)

print()
print('== U5. 城池面板：布防计略显示+入口 ==')
patch(
    UI,
    """          (bc > 0 ? '（烽火台 Lv' + bc + ' 提前预警）' : '（无烽火台，预警偏迟）') +
          '　宜收拢兵力、修葺城墙。</div>';
      })();
    box.innerHTML = html;""",
    """          (bc > 0 ? '（烽火台 Lv' + bc + ' 提前预警）' : '（无烽火台，预警偏迟）') +
          '　宜收拢兵力、修葺城墙。</div>';
      })();
    html += ui.citySchemeHTML(c);
    box.innerHTML = html;""",
    'U5 城池面板入口',
    probe='html += ui.citySchemeHTML(c);',
)

print()
print('== U6. citySchemeHTML（挂 renderCityAttrs 之后） ==')
patch(
    UI,
    """    html += ui.citySchemeHTML(c);
    box.innerHTML = html;
  };""",
    """    html += ui.citySchemeHTML(c);
    box.innerHTML = html;
  };

  /* v86：城池面板的计略布防行（生效中显示倒计时；未挂给入口按钮）。
     输出值可被看见：空城计/坚壁清野剩余时长在此处常显。 */
  ui.citySchemeHTML = function (c) {
    if (!GAME.schemeDefOf) return '';
    var s = GAME.state;
    var now = (s.world && s.world.elapsed) || 0;
    var parts = [];
    var kc = GAME.schemeDefOf(c, 'kongcheng', now);
    var jb = GAME.schemeDefOf(c, 'jianbi', now);
    if (kc) parts.push('🎭 空城计（余 ' + Math.ceil(kc.left / 3600) + ' 时）');
    if (jb) parts.push('🏜️ 坚壁清野（余 ' + Math.ceil(jb.left / 3600) + ' 时）');
    return '<div class="res-line" style="align-items:center;"><span class="lbl">🎴 计略布防</span>' +
      '<span class="val" style="display:flex;align-items:center;gap:6px;">' +
      (parts.length ? '<span style="color:var(--green-ok);font-size:var(--fs-sub);">' + parts.join('　') + '</span>'
                    : '<span style="color:var(--text-dim);font-size:var(--fs-sub);">未布防</span>') +
      '<button class="btn sm" data-action="city-scheme">布防</button></span></div>';
  };""",
    'U6 citySchemeHTML',
    probe='ui.citySchemeHTML = function',
)

print()
print('== M1. main.js 事件分发 ==')
patch(
    MJ,
    """      case 'open-wilds': ui.openWilds(); break;
      case 'map-pan': ui.mapPan(Number(el.dataset.dx), Number(el.dataset.dy)); break;""",
    """      case 'open-wilds': ui.openWilds(); break;
      /* v86（老板「按计划进行」· G1）：计略 */
      case 'exp-scheme': ui.openExpScheme(); break;
      case 'exp-scheme-pick': ui.doExpSchemePick(el.dataset.v); break;
      case 'city-scheme': ui.openCityScheme(); break;
      case 'city-scheme-pick': ui.doCitySchemePick(el.dataset.v); break;
      case 'map-pan': ui.mapPan(Number(el.dataset.dx), Number(el.dataset.dy)); break;""",
    'M1 分发',
    probe="case 'exp-scheme': ui.toggleExpScheme(); break;",
)

print()
print('== M2. doExpConfirm 携计提交 ==')
patch(
    MJ,
    """    var r = GAME.march.dispatch(target, mode, atk, genSel.value);
    ui.toast(r.msg);
    if (r.ok) {
      ui.closeModal();
      GAME.refreshAll();""",
    """    var r = GAME.march.dispatch(target, mode, atk, genSel.value, ui._expScheme || null);
    ui.toast(r.msg);
    if (r.ok) {
      ui._expScheme = null;      /* v86：计已随军出发，面板状态清空 */
      ui.closeModal();
      GAME.refreshAll();""",
    'M2 提交携计',
    probe='ui._expScheme || null);',
)

print()
print('全部完成。')
