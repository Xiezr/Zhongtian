# -*- coding: utf-8 -*-
r"""v89.219-c：长按连续强化 + 套装整体强化（老板 1）

· 域层：GAME.enhSetPiecesOf / enhSetInfoOf / enhanceSet（件集合 / 总价 / 执行，唯一出口）；
· 界面：百炼面板底栏在"选中件属套装且已拥有 ≥2 件"时多一枚「整套 +1」键（长按同款连续）；
· 交互：长按机制（mousedown/touchstart → 阈值 → 连发；松手/失焦/键变灰即停；
        连发期静音 toast；松手后那一次 click 吞掉）。
"""
import io, sys

R = 'E:/Deepseekdb/'
def rd(p): return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ---------------------------------------------------------------- domain.js
D_OLD = r"""    GAME.log('锻造间百炼：' + label0 + ' → +' + (lv + 1), 'sys', 'admin');
    return { ok: true, msg: '「' + GAME.eqLabel(inst) + '」强化 +' + (lv + 1)
      + '（装备属性 +' + Math.round((lv + 1) * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%）' };
  };
"""
D_NEW = D_OLD + r"""
  /* ============================================================
   * v89.219（老板 1）：**套装整体强化** —— 一次把"我拥有的该套全部件"各 +1 级。
   * ------------------------------------------------------------
   * 语义 = 「整体」：总价先行校验，任一环节不足则**整体不动**（不半升）；
   * 已满级件自动跳过（不计件数、不计成本）；改造件不参与（归调校）。
   * 三出口同源：enhSetPiecesOf（件集合）· enhSetInfoOf（{ all, todo, cost } 展示与执行共用）
   * · enhanceSet（执行）。界面底栏「整套」键与测试都读同一份 ——
   * 成本/上限/过滤全走既有出口（enhCost / enhMax / eqPieces / eqId），不另立口径。
   * ============================================================ */
  GAME.enhSetPiecesOf = function (setId) {
    return GAME.eqPieces().filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return !!(it && it.set === setId && !it.ling);
    }).sort(function (a, b) { return (GAME.eqUidOf(a) || 0) - (GAME.eqUidOf(b) || 0); });
  };
  GAME.enhSetInfoOf = function (setId) {
    var def = (DATA.SETS || {})[setId];
    if (!def) return null;
    var all = GAME.enhSetPiecesOf(setId);
    var maxE = GAME.enhMax();
    var todo = all.filter(function (x) { return GAME.eqEnhOf(x) < maxE; });
    var cost = { gold: 0, iron: 0, stone: 0 };
    todo.forEach(function (x) {
      var c = GAME.enhCost(x) || {};
      for (var k in c) cost[k] = (cost[k] || 0) + c[k];
    });
    return { def: def, all: all, todo: todo, cost: cost, maxE: maxE };
  };
  GAME.enhanceSet = function (setId) {
    var info = GAME.enhSetInfoOf(setId);
    if (!info) return { ok: false, n: 0, msg: '未知套装' };
    if (GAME.forgeLevel() <= 0) return { ok: false, n: 0, msg: '需先建造锻造间' };
    if (!info.all.length) return { ok: false, n: 0, msg: '「' + info.def.name + '」一件都还没有（先打造 / 缴获几件）' };
    if (!info.todo.length) return { ok: false, n: 0, msg: '「' + info.def.name + '」整套已至 +' + info.maxE + '（满级）' };
    if (!GAME.canAfford(info.cost)) {
      return { ok: false, n: info.todo.length,
        msg: '整套资材不足（' + info.todo.length + ' 件共需 ' + GAME.costString(info.cost) + '）' };
    }
    GAME.payCost(info.cost);
    info.todo.forEach(function (x) { x.enh = GAME.eqEnhOf(x) + 1; });   /* 按件 +1 */
    GAME.log('锻造间百炼：' + info.def.name + ' 整套 +1（' + info.todo.length + ' 件，耗 ' + GAME.costString(info.cost) + '）', 'sys', 'admin');
    return { ok: true, n: info.todo.length, cost: info.cost,
      msg: '「' + info.def.name + '」整套 +1 —— ' + info.todo.length + ' 件（共耗 ' + GAME.costString(info.cost) + '）' };
  };
"""

# ---------------------------------------------------------------- ui.js（百炼面板）
U_OLD1 = r"""    var btnWhy = !selInst ? '先在下方点选一件装备（可先切「未满」筛选）'
      : (selLv >= maxE ? '「' + GAME.eqLabel(selInst) + '」已至 +' + maxE + '（满级）'
        : ('资材不足：下一级需 ' + GAME.costString(selCost)));
    ui.openShell({
"""
U_NEW1 = r"""    var btnWhy = !selInst ? '先在下方点选一件装备（可先切「未满」筛选）'
      : (selLv >= maxE ? '「' + GAME.eqLabel(selInst) + '」已至 +' + maxE + '（满级）'
        : ('资材不足：下一级需 ' + GAME.costString(selCost)));
    /* v89.219（老板 1）：**套装整体强化** —— 选中件属套装且已拥有 ≥2 件时，底栏多一枚
       「整套 +1」键（一键把该套全部件各 +1；与单件键同款**长按连续**）。
       件集合 / 总价 / 上限全走唯一出口 GAME.enhSetInfoOf（展示与执行同源）。 */
    var setInfo = (selInst && DATA.EQUIP[GAME.eqId(selInst)].set)
      ? GAME.enhSetInfoOf(DATA.EQUIP[GAME.eqId(selInst)].set) : null;
    var setBtn = '';
    if (setInfo && setInfo.all.length >= 2) {
      var setCan = setInfo.todo.length > 0 && GAME.canAfford(setInfo.cost);
      var setWhy = !setInfo.todo.length
        ? '「' + setInfo.def.name + '」整套已至 +' + maxE + '（满级）'
        : ('整套资材不足：' + setInfo.todo.length + ' 件共需 ' + GAME.costString(setInfo.cost));
      setBtn = '<button class="btn' + (setCan ? ' gold' : ' dim') + '" data-action="enhance-set"' +
        ' data-set="' + U.escape(setInfo.def.id) + '"' +
        ' title="' + U.escape(setInfo.def.name + '：已拥有 ' + setInfo.all.length + ' 件 · 本次可升 '
          + setInfo.todo.length + ' 件 · 共需 ' + GAME.costString(setInfo.cost)) + '"' +
        (setCan ? '' : ' disabled data-why="' + U.escape(setWhy) + '"') +
        '>⚒ 整套 +1（' + setInfo.todo.length + ' 件）</button>';
    }
    ui.openShell({
"""

U_OLD2 = r"""          (selInst && selLv < maxE ? ' +' + (selLv + 1) : '') + '</button>' +
        (selCost ? '<span class="op-hint">' + U.escape('下一级 ' + GAME.costString(selCost)) + '</span>' : '') +
"""
U_NEW2 = r"""          (selInst && selLv < maxE ? ' +' + (selLv + 1) : '') + '</button>' +
        setBtn +
        (selCost ? '<span class="op-hint">' + U.escape('下一级 ' + GAME.costString(selCost)) + '</span>' : '') +
"""

U_OLD3 = r"""          ui.help('装备强化按件记录：同名多件各有各的等级（卡面 +N 即其等级）。\n' +
            '每级全属性 +' + perLv + '%（走 genEquipBonus 唯一出口）。\n' +
            '点选一件 → 底部「强化」键逐级强化 —— 强化后选中保留，可连点提升。') +
"""
U_NEW3 = r"""          ui.help('装备强化按件记录：同名多件各有各的等级（卡面 +N 即其等级）。\n' +
            '每级全属性 +' + perLv + '%（对原始值线性叠加；+10 = +80%，非复利）。\n' +
            '点选一件 → 底部「强化」键逐级强化 —— 长按可连续强化（按住不放即连升）。\n' +
            '套装件会多一枚「整套 +1」键：一键把该套全部件各升一级（同样支持长按）。') +
"""

U_OLD4 = r"""          ui.help('调校按件记录：同名多件各有各的等级（甲/乙/丙 序号区分）。\n' +
            '每级改造属性 +' + perLv + '%（走 genEquipBonus 唯一出口）。\n' +
            '点选一件 → 底部「调校」键逐级提升 —— 调校后选中保留，可连点提升。') +
"""
U_NEW4 = r"""          ui.help('调校按件记录：同名多件各有各的等级（卡面 +N 即其等级）。\n' +
            '每级改造属性 +' + perLv + '%（对原始值线性叠加；+10 = +80%，非复利）。\n' +
            '点选一件 → 底部「调校」键逐级提升 —— 长按可连续调校（按住不放即连升）。') +
"""

# ---------------------------------------------------------------- main.js
M_OLD1 = r"""      case 'enhance-item': GAME.doEnhance(el.dataset.item); break;
"""
M_NEW1 = r"""      case 'enhance-item': GAME.doEnhance(el.dataset.item); break;
      /* v89.219（老板 1）：套装整体强化（选中件属套装时底栏出现的「整套 +1」键） */
      case 'enhance-set': GAME.doEnhanceSet(el.dataset.set); break;
"""

M_OLD2 = r"""  GAME.doEnhance = function (itemId) {
    var r = GAME.enhance(itemId);
    ui.toast(r.msg);
    /* v89.201（老板 3）：重开走 reopenKeepScroll ——
       改前是裸 ui.openEnhance()，弹窗重建、scrollTop 归零（"点一次就回到顶部"）。 */
    if (r.ok) { GAME.refreshAll(); ui.reopenKeepScroll(ui.openEnhance); }
  };
"""
M_NEW2 = r"""  GAME.doEnhance = function (itemId) {
    var r = GAME.enhance(itemId);
    if (!ui._holdMode) ui.toast(r.msg);   /* v89.219：长按连发期静音（否则每 ~180ms 刷一条） */
    /* v89.201（老板 3）：重开走 reopenKeepScroll ——
       改前是裸 ui.openEnhance()，弹窗重建、scrollTop 归零（"点一次就回到顶部"）。 */
    if (r.ok) { GAME.refreshAll(); ui.reopenKeepScroll(ui.openEnhance); }
    return r;
  };
  /* v89.219（老板 1）：套装整体强化（唯一出口 GAME.enhanceSet；长按同款连续） */
  GAME.doEnhanceSet = function (setId) {
    var r = GAME.enhanceSet(setId);
    if (!ui._holdMode) ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.reopenKeepScroll(ui.openEnhance); }
    return r;
  };
"""

M_OLD3 = r"""  GAME.doLingTemper = function (key) {
    var r = GAME.lingTemper(key);
    ui.toast(r.msg);
    /* v89.202：重开走 reopenKeepScroll —— 与百炼同（点一次不回顶部） */
    if (r.ok) { GAME.refreshAll(); ui.reopenKeepScroll(ui.openLingTemper); }
  };
"""
M_NEW3 = r"""  GAME.doLingTemper = function (key) {
    var r = GAME.lingTemper(key);
    if (!ui._holdMode) ui.toast(r.msg);   /* v89.219：长按连发期静音 */
    /* v89.202：重开走 reopenKeepScroll —— 与百炼同（点一次不回顶部） */
    if (r.ok) { GAME.refreshAll(); ui.reopenKeepScroll(ui.openLingTemper); }
    return r;
  };
"""

M_OLD4 = r"""    document.addEventListener('click', function (e) {
      /* v89.189（老板 1）：「无法操作 → 弹窗给原因」——**先按 data-why 找**：
"""
M_NEW4 = r"""    document.addEventListener('click', function (e) {
      /* v89.219（老板 1）：长按连发结束后紧跟的那一次 click 吞掉（否则连发之外多升一级）。 */
      if (ui._holdSuppress) { ui._holdSuppress = false; e.preventDefault(); return; }
      /* v89.189（老板 1）：「无法操作 → 弹窗给原因」——**先按 data-why 找**：
"""

M_OLD5 = r"""      handleCanvasClick(e);
    });
"""
M_NEW5 = r"""      handleCanvasClick(e);
    });
    /* ============================================================
     * v89.219（老板 1）：**长按连续强化** —— 强化 / 整套 / 调校三枚底键，按住不放即连续执行。
     * ------------------------------------------------------------
     *   · 按下（mousedown 左键 / touchstart）→ 过 HOLD_DELAY 判定为长按 → 立刻执行一发，
     *     其后每 HOLD_EVERY 一发，直到：松开 / 失焦 / 键不可用（disabled 或已软化 data-why）。
     *   · ⚠️ 每发都**重新查询"屏幕上当前那枚键"** —— 每次强化都会重建面板（reopenKeepScroll），
     *     持有旧节点 = 持有孤儿节点（点击不再冒泡、读到的也是旧值）。
     *   · 连发期间静音 toast（ui._holdMode）；松手后的那一次原生 click 由 ui._holdSuppress 吞掉。
     * ============================================================ */
    ui.HOLD_ACTS = ['enhance-item', 'enhance-set', 'ling-temper-item'];
    ui.HOLD_DELAY = 320;        /* 长按判定阈值（毫秒）——短点一下不触发连发 */
    ui.HOLD_EVERY = 180;        /* 连发间隔（毫秒） */
    ui._hold = null;
    ui._holdMode = false;       /* 连发期：doEnhance / doEnhanceSet / doLingTemper 静音 toast */
    ui._holdSuppress = false;   /* 吞掉长按后的那一次 click */
    ui.holdStop = function () {
      var h = ui._hold;
      if (!h) return;
      if (h.t1) clearTimeout(h.t1);
      if (h.t2) clearInterval(h.t2);
      if (h.fired > 0) ui._holdSuppress = true;
      ui._hold = null;
      ui._holdMode = false;
    };
    ui.holdFire = function (h) {
      var btn = document.querySelector('[data-action="' + h.act + '"]');
      if (!btn || btn.disabled === true || (btn.getAttribute && btn.getAttribute('data-why'))) {
        ui.holdStop();
        return false;
      }
      GAME.action(h.act, btn);
      h.fired++;
      return true;
    };
    ui.holdStart = function (act) {
      ui.holdStop();
      ui._holdSuppress = false;
      var h = ui._hold = { act: act, fired: 0, t1: 0, t2: 0 };
      h.t1 = setTimeout(function () {
        ui._holdMode = true;
        if (ui.holdFire(h)) h.t2 = setInterval(function () { ui.holdFire(h); }, ui.HOLD_EVERY);
      }, ui.HOLD_DELAY);
    };
    var _holdDown = function (e) {
      if (e.type === 'mousedown' && e.button !== 0) return;
      var el = (e.target && e.target.closest) ? e.target.closest('[data-action]') : null;
      if (!el) return;
      var act = String(el.getAttribute('data-action') || '');
      if (ui.HOLD_ACTS.indexOf(act) < 0) return;
      ui.holdStart(act);
    };
    document.addEventListener('mousedown', _holdDown);
    document.addEventListener('touchstart', _holdDown, { passive: true });
    window.addEventListener('mouseup', ui.holdStop);
    window.addEventListener('touchend', ui.holdStop);
    window.addEventListener('touchcancel', ui.holdStop);
    window.addEventListener('blur', ui.holdStop);
"""

E = [
    ('js/domain.js', D_OLD, D_NEW, '套装强化三出口'),
    ('js/ui.js', U_OLD1, U_NEW1, '整套键状态'),
    ('js/ui.js', U_OLD2, U_NEW2, '整套键入底栏'),
    ('js/ui.js', U_OLD3, U_NEW3, '百炼帮助文案'),
    ('js/ui.js', U_OLD4, U_NEW4, '调校帮助文案'),
    ('js/main.js', M_OLD1, M_NEW1, 'case enhance-set'),
    ('js/main.js', M_OLD2, M_NEW2, 'doEnhance/doEnhanceSet'),
    ('js/main.js', M_OLD3, M_NEW3, 'doLingTemper'),
    ('js/main.js', M_OLD4, M_NEW4, 'click 抑制'),
    ('js/main.js', M_OLD5, M_NEW5, '长按机制'),
]

bad = []
for f, old, new, tag in E:
    s = rd(R + f)
    if s.count(new) and old not in s:
        continue
    c = s.count(old)
    if c != 1:
        bad.append('%s/%s x%d' % (f, tag, c))
if bad:
    print('❌ 预检失配（未落盘）：' + ' · '.join(bad))
    sys.exit(1)

for f, old, new, tag in E:
    p = R + f
    s = rd(p)
    if s.count(new) and old not in s:
        print('  [skip] %s' % tag)
        continue
    wr(p, s.replace(old, new))
    print('  [ok] %s / %s' % (f, tag))

print('✅ v89.219-c 落盘完成')
