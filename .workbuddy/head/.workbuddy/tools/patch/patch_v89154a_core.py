# -*- coding: utf-8 -*-
"""v89.154 核心补丁：附属野地（放弃按钮 + 排序）/ 改建回大界面 / CSS。
分段落盘 + 幂等守卫 + 写后自检。所有 io 一律 newline=''（CRLF 铁律 §42.2）。"""
import io, re

R = 'E:/Deepseekdb/'

def rd(p):
    return io.open(R + p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

# ==================== 段 1：ui.js — 排序出口 + openWilds + 放弃按钮 + ask + 下拉框 + 弃城复位 ====================
P = 'js/ui.js'
s = rd(P)
orig_len = len(s)
done = []

# ---- 1a：新出口 ui.wildSortedOf（插在 openWilds 之前） ----
ANCHOR_1A = u"  /* 附属野地弹窗（原版「附属野地」） */\n  ui.openWilds = function () {"
NEW_1A = u"""  /* ============================================================
   * v89.154（老板 3）：附属野地**显示排序**（唯一出口）
   * ------------------------------------------------------------
   * 老板原话：「附属野地界面，有采集的野地排序最上方，有驻军的接着，
   *   无驻军的野地按地形，等级（高到低）排序」。
   * 三档：① 采集中（gatherAt 非空）→ ② 有驻军（wildGarrisonTotal > 0）
   *       → ③ 其余：地形（DATA.TERRAIN 表序）→ 同地形按等级**降序**。
   * 读的两处（资源区下拉框 / 附属野地面板）**同用本出口** ——
   * ui._wildSel 是"显示序下标"，两处顺序不一致时「进入」高亮会指错行。
   * 只排显示副本（slice），不改 s.wilds 本身（占领先后是数据，显示序是视图）。
   * ============================================================ */
  ui.wildSortedOf = function (wilds) {
    var tOrder = {};
    Object.keys(DATA.TERRAIN).forEach(function (k, i) { tOrder[k] = i; });
    var prioOf = function (w) {
      if (GAME.gatherAt(w.x, w.y)) return 0;                                   /* ① 采集中 */
      if (GAME.wildGarrisonTotal(GAME.wildGarrisonAt(w.x, w.y)) > 0) return 1; /* ② 有驻军 */
      return 2;
    };
    /* 先算一次优先级（sort 比较函数会被调 O(n log n) 次，别在里面反复查表） */
    var list = (wilds || []).map(function (w) {
      return { w: w, p: prioOf(w) };
    });
    list.sort(function (a, b) {
      if (a.p !== b.p) return a.p - b.p;
      if (a.p === 2) {
        var ta = tOrder[a.w.type] == null ? 99 : tOrder[a.w.type];
        var tb = tOrder[b.w.type] == null ? 99 : tOrder[b.w.type];
        if (ta !== tb) return ta - tb;                       /* 地形（表序）为主键 */
        if ((b.w.level || 0) !== (a.w.level || 0)) return (b.w.level || 0) - (a.w.level || 0);
      }
      return 0;                                              /* 稳定：同档保持原序 */
    });
    return list.map(function (x) { return x.w; });
  };

  /* 附属野地弹窗（原版「附属野地」） */
  ui.openWilds = function () {"""

if u'ui.wildSortedOf = function' in s:
    done.append('1a skip')
else:
    assert s.count(ANCHOR_1A) == 1, '1a anchor'
    s = s.replace(ANCHOR_1A, NEW_1A)
    done.append('1a OK')

# ---- 1b：openWilds 读排序出口 ----
ANCHOR_1B = u"    var wilds = s.wilds || [];"
NEW_1B = u"""    /* v89.154（老板 3）：显示序 = wildSortedOf（采集/驻军/地形+等级） */
    var wilds = ui.wildSortedOf(s.wilds);"""
if u'var wilds = ui.wildSortedOf(s.wilds);' in s:
    done.append('1b skip')
else:
    assert s.count(ANCHOR_1B) == 1, '1b anchor'
    s = s.replace(ANCHOR_1B, NEW_1B)
    done.append('1b OK')

# ---- 1c：操作列第 5 颗按钮（放弃 · 防误触） ----
ANCHOR_1C = u"""          : '<button class="btn xs" data-action="wild-withdraw" disabled title="该野地没有驻军">🏳️ 召回</button>') +
        '</td>';"""
NEW_1C = u"""          : '<button class="btn xs" data-action="wild-withdraw" disabled title="该野地没有驻军">🏳️ 召回</button>') +
        /* v89.154（老板 1）：「附属野地界面，操作栏中增加一个放弃野地按钮，按钮应该采用防误触设计」——
           防误触四层：① 红色 + 与正向动作留间距（.wild-drop，可换行分组）
           ② 只触发二次确认窗（wild-abandon-ask，绝不一键执行）
           ③ 确认窗内红按钮**上膛式**（wild-abandon-arm 连点两次才执行，与弃城同规 §89.138）
           ④ 确认窗明写「不可撤销」+ 逐项列出失去/撤回什么。 */
        '<button class="btn xs red wild-drop" data-action="wild-abandon-ask" data-x="' + w.x + '" data-y="' + w.y +
          '" title="放弃该野地 —— 需二次确认，且不可撤销（驻军与采集队会先撤回城内）">🗑️ 放弃</button>' +
        '</td>';"""
if u'class="btn xs red wild-drop"' in s:
    done.append('1c skip')
else:
    assert s.count(ANCHOR_1C) == 1, '1c anchor'
    s = s.replace(ANCHOR_1C, NEW_1C)
    done.append('1c OK')

# ---- 1d：ask 弹窗 —— 不可撤销 + 按钮改上膛式名 + 打开即复位 ----
ANCHOR_1D0 = u"""  ui.openAbandonWildAsk = function (x, y) {
    var w = GAME.map.wildAt(x, y);"""
NEW_1D0 = u"""  ui.openAbandonWildAsk = function (x, y) {
    ui._wildArm154 = null;      /* v89.154：打开即复位 —— 关窗再开必须重新上膛（防误触） */
    var w = GAME.map.wildAt(x, y);"""

ANCHOR_1D1 = u"""        (garN || at ? '；驻军与采集队会先撤回城内，不会损失兵力' : '') + '。</div>' +"""
NEW_1D1 = u"""        (garN || at ? '；驻军与采集队会先撤回城内，不会损失兵力' : '') +
        '。<b>此操作不可撤销</b> —— 确认按钮需连点两次。</div>' +"""

ANCHOR_1D2 = u"""        '<button class="btn red" data-action="wild-abandon-do" data-x="' + x + '" data-y="' + y + '">确定放弃</button>' +"""
NEW_1D2 = u"""        '<button class="btn red" data-action="wild-abandon-arm" data-x="' + x + '" data-y="' + y + '">确定放弃</button>' +"""
if u'_wildArm154 = null;' in s:
    done.append('1d skip')
else:
    for tag, a, b in [('1d0', ANCHOR_1D0, NEW_1D0), ('1d1', ANCHOR_1D1, NEW_1D1), ('1d2', ANCHOR_1D2, NEW_1D2)]:
        assert s.count(a) == 1, tag + ' anchor'
        s = s.replace(a, b)
    done.append('1d OK')

# ---- 1e：renderWildPick 同用排序出口 + sig 加驻军有无 ----
ANCHOR_1E = u"""    var wilds = (s && s.wilds) || [];
    /* v89.137（清单①）：采集"在采"状态在此可见 —— 选项带 ⛏ 标记；
       签名把"是否在采"也算进去（否则采集开/停时下拉不刷新）。 */
    var _gatherFlag137 = function (w) { return (GAME.gatherAt && GAME.gatherAt(w.x, w.y)) ? 'g' : ''; };
    var sig = wilds.map(function (w) { return w.x + ',' + w.y + ',' + w.level + _gatherFlag137(w); }).join('|');"""
NEW_1E = u"""    /* v89.154（老板 3）：下拉框与「附属野地面板」**同用** ui.wildSortedOf（唯一排序出口）——
       两处顺序一致，ui._wildSel 的显示序下标语义才一致（否则「进入」高亮会指错行）。 */
    var wilds = ui.wildSortedOf(s && s.wilds);
    /* v89.137（清单①）：采集"在采"状态在此可见 —— 选项带 ⛏ 标记；
       签名把"是否在采 + 是否驻军（都影响排序档位）"也算进去（否则开/停时下拉不刷新）。 */
    var _gatherFlag137 = function (w) { return (GAME.gatherAt && GAME.gatherAt(w.x, w.y)) ? 'g' : ''; };
    var _garFlag154 = function (w) { return (GAME.wildGarrisonTotal(GAME.wildGarrisonAt(w.x, w.y)) > 0) ? 'G' : ''; };
    var sig = wilds.map(function (w) { return w.x + ',' + w.y + ',' + w.level + _gatherFlag137(w) + _garFlag154(w); }).join('|');"""
if u'var wilds = ui.wildSortedOf(s && s.wilds);' in s:
    done.append('1e skip')
else:
    assert s.count(ANCHOR_1E) == 1, '1e anchor'
    s = s.replace(ANCHOR_1E, NEW_1E)
    done.append('1e OK')

# ---- 1f：弃城上膛标志 —— 打开即复位（防误触漏洞一体修） ----
ANCHOR_1F = u"""  ui.openAbandonCityAsk = function (cityId) {
    var s = GAME.state, city = GAME.cityById(cityId);"""
NEW_1F = u"""  ui.openAbandonCityAsk = function (cityId) {
    ui._abandonArm138 = null;   /* v89.154：打开即复位 —— 关窗再开必须重新上膛（防误触漏洞一体修） */
    var s = GAME.state, city = GAME.cityById(cityId);"""
if u'ui._abandonArm138 = null;   /* v89.154' in s:
    done.append('1f skip')
else:
    assert s.count(ANCHOR_1F) == 1, '1f anchor'
    s = s.replace(ANCHOR_1F, NEW_1F)
    done.append('1f OK')

wr(P, s)
s2 = rd(P)
_bk = io.open(R + 'backup/v89154/ui.js.before', encoding='utf-8', newline='').read()
assert (s2.count(u'{') - s2.count(u'}')) == (_bk.count(u'{') - _bk.count(u'}')), 'brace imbalance'
assert s2.count(u'ui.wildSortedOf = function') == 1, 'wildSortedOf count'
assert s2.count(u'data-action="wild-abandon-arm"') == 1, 'arm count'
assert u'data-action="wild-abandon-do"' not in s2, 'old do remains'
assert s2.count(u'ui._wildArm154 = null;') == 1 and s2.count(u'ui._wildArm154') == 1
print('ui.js done:', done, 'len', orig_len, '->', len(s))

# ==================== 段 2：main.js — 上膛 case + 改建回大界面 ====================
P = 'js/main.js'
s = rd(P)
done = []

ANCHOR_2A = u"""      case 'wild-abandon-do': {
        var wa = GAME.doAbandonWild(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast(wa.msg);
        ui.closeModal();
        GAME.refreshAll();
        break;"""
NEW_2A = u"""      /* v89.154（老板 1）：放弃野地改**上膛式**（与弃城同规）——
         第一次点击只"上膛"（变文案 + toast 警告），再点一次才执行。
         触发端分布在：地块面板「危险操作」区 + 附属野地操作列（v89.154 新增）。 */
      case 'wild-abandon-arm': {
        var _wxy154 = el.dataset.x + ',' + el.dataset.y;
        if (ui._wildArm154 !== _wxy154) {
          ui._wildArm154 = _wxy154;
          el.innerHTML = '⚠️ 再点一次 —— 放弃该野地（不可撤销）';
          ui.toast('⚠️ 危险操作：再点一次才真的放弃');
          break;
        }
        ui._wildArm154 = null;
        var wa = GAME.doAbandonWild(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast(wa.msg);
        ui.closeModal();
        GAME.refreshAll();
        break;"""
if u"case 'wild-abandon-arm':" in s:
    done.append('2a skip')
else:
    assert s.count(ANCHOR_2A) == 1, '2a anchor'
    s = s.replace(ANCHOR_2A, NEW_2A)
    done.append('2a OK')

ANCHOR_2B = u"""      case 'ext-convert': (function () {
        var rr = GAME.convertExt(Number(el.dataset.idx), el.dataset.eid);
        ui.toast(rr.msg);
        if (rr.ok) { ui.closeModal(); GAME.refreshAll(); }
      })(); break;"""
NEW_2B = u"""      case 'ext-convert': (function () {
        var rr = GAME.convertExt(Number(el.dataset.idx), el.dataset.eid);
        ui.toast(rr.msg);
        /* v89.154（老板 2）：「城外建筑进入改建界面，完成改建后，应直接回到城外大界面」——
           改建面板是从「地块面板」进的下级；closeModal 只弹一层会回到地块面板（已被改用途，
           信息过时）。closeAllModals 一次关净 → 回到城外地块大界面（视图页）。 */
        if (rr.ok) { ui.closeAllModals(); GAME.refreshAll(); }
      })(); break;"""
_i2 = s.find(u"case 'ext-convert': (function () {")
_seg2 = s[_i2:_i2 + 600] if _i2 >= 0 else ''
if u'closeAllModals' in _seg2:
    done.append('2b skip')
else:
    assert s.count(ANCHOR_2B) == 1, '2b anchor'
    s = s.replace(ANCHOR_2B, NEW_2B)
    done.append('2b OK')

wr(P, s)
s2 = rd(P)
assert s2.count(u"case 'wild-abandon-arm':") == 1
assert u"case 'wild-abandon-do':" not in s2, 'old do case remains'
_i2b = s2.find(u"case 'ext-convert': (function () {")
_seg2b = s2[_i2b:_i2b + 600] if _i2b >= 0 else ''
assert u'closeAllModals' in _seg2b, 'ext-convert not switched to closeAllModals'
print('main.js done:', done)

# ==================== 段 3：index.html — .wild-drop 间距 ----
P = 'index.html'
s = rd(P)
ANCHOR_3 = u"  .wild-ops { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; align-items: center; }"
NEW_3 = u"""  .wild-ops { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; align-items: center; }
  /* v89.154（老板 1）：操作列的「放弃」= 危险动作 —— 与正向动作留出间距做视觉分组（防误触） */
  .wild-ops .wild-drop { margin-left: var(--sp-2); }"""
if u'.wild-ops .wild-drop' in s:
    print('html skip')
else:
    assert s.count(ANCHOR_3) == 1, '3 anchor'
    s = s.replace(ANCHOR_3, NEW_3)
    wr(P, s)
    assert u'.wild-ops .wild-drop { margin-left: var(--sp-2); }' in rd(P)
    print('html OK')

print('ALL SEGMENTS DONE')
