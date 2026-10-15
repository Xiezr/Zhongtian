# -*- coding: utf-8 -*-
"""v89.131 补丁 E2：体力/精力道具选择窗 + 动作派发 + 商城页签 + 提示表
文件：ui.js（选择窗 / SHOP_CATS / QUICK_ITEM_HINT）· main.js（4 个 case + doGenRestore）
用法：python patch_v89131e2_ui_picker.py
"""
import io

n = 0


def patch_file(P, pairs):
    global n
    s = io.open(P, encoding='utf-8', newline='').read()
    orig = s
    for tag, old, new in pairs:
        c = s.count(old)
        assert c == 1, '[%s] 锚点 %d 处（需 1）' % (tag, c)
        s = s.replace(old, new)
        n += 1
        print('  OK ' + tag)
    assert (s.count('{') - s.count('}')) == (orig.count('{') - orig.count('}')), P + ' 花括号盈亏'
    assert (s.count('(') - s.count(')')) == (orig.count('(') - orig.count(')')), P + ' 圆括号盈亏'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)


UI = 'E:/Deepseekdb/js/ui.js'
MAIN = 'E:/Deepseekdb/js/main.js'

# ---------- ui.js ----------
ui_pairs = [
    # ① 选择窗（插在 setGiftItem 之后）
    ('ui 选择窗', """  ui.setGiftItem = function (genId, itemId) {
    ui._giftPick = ui._giftPick || {};
    ui._giftPick[genId] = itemId;
    ui._giftQ = ui._giftQ || {};
    ui._giftQ[genId] = 1;                      /* 换珠宝 → 件数回 1（新珠宝持有数不同） */
    ui.openGiftPick(genId);
  };""",
     """  ui.setGiftItem = function (genId, itemId) {
    ui._giftPick = ui._giftPick || {};
    ui._giftPick[genId] = itemId;
    ui._giftQ = ui._giftQ || {};
    ui._giftQ[genId] = 1;                      /* 换珠宝 → 件数回 1（新珠宝持有数不同） */
    ui.openGiftPick(genId);
  };

  /* 体力 / 精力道具选择窗（v89.131 · 老板「体力精力应当设计加号按钮，供道具使用，参考赏赐」）
     ------------------------------------------------------------
     与赏赐/经验两窗同一套做法：可选项直接来自 DATA.ITEMS + 背包（以后加道具自动出现），
     「用几个」在窗里选；将领页上只留一个 ＋。
     kind: 'sta'（stamina 族 · 体力）/ 'energy'（energy 族 · 精力）—— 一个出口管两个池子。
     上限/当前一律走唯一出口（energyMaxOf/energyNowOf · staMax/staNow），不另算一份。 */
  ui.openRestorePick = function (genId, kind) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var isEn = (kind === 'energy');
    var type = isEn ? 'energy' : 'stamina';
    var cfg = isEn
      ? { label: '精力', maxOf: GAME.energyMaxOf, nowOf: GAME.energyNowOf }
      : { label: '体力', maxOf: GAME.staMax, nowOf: GAME.staNow };
    var items = (DATA.ITEMS || []).filter(function (it) {
      return it.type === type && (s.items || {})[it.id] > 0;
    });
    if (!items.length) { ui.toast('背包中暂无' + cfg.label + '道具'); return; }
    ui._modalKind = 'restore';
    ui._restorePick = ui._restorePick || {};
    var key = genId + '|' + kind;
    var want = ui._restorePick[key];
    var pick = items[0].id;
    items.forEach(function (x) { if (x.id === want) pick = x.id; });
    var it = null;
    items.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var mx = cfg.maxOf(g), now = Math.round(cfg.nowOf(g));
    var q = Math.max(1, Math.min(have, Number((ui._restoreQ || {})[key]) || 1));
    var after = Math.min(mx, now + q * Math.round((it.amount || 0) * mx));
    ui.openShell({
      title: '💊 ' + cfg.label + '道具 · ' + U.escape(g.name),
      sub: '按上限百分比回复　当前 ' + now + ' / ' + mx,
      size: 'sm',
      body: '<div class="ui-sub">选道具</div>' +
        '<div class="gd-chips">' + items.map(function (x) {
          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') + '" data-action="restore-pick-item"' +
            ' data-gen="' + genId + '" data-kind="' + kind + '" data-item="' + x.id + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">回' + Math.round((x.amount || 0) * 100) + '%</i></button>';
        }).join('') + '</div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-row">' +
          ui.qtyInput('restore-q-' + kind + '-' + genId, q, 0, have) +
          '<span class="op-hint">用 <b>' + q + '</b> 件　' + cfg.label + ' ' + now + ' → <b>' + after + '</b>' +
            (q >= have ? '（已用满持有）' : '') + '</span>' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="gen-restore-do" data-gen="' + genId + '" data-kind="' + kind +
          '" data-item="' + pick + '" data-qty-from="restore-q-' + kind + '-' + genId + '">使用 ' + q + ' 件</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };
  ui.setRestoreItem = function (genId, kind, itemId) {
    ui._restorePick = ui._restorePick || {};
    ui._restorePick[genId + '|' + kind] = itemId;
    ui._restoreQ = ui._restoreQ || {};
    ui._restoreQ[genId + '|' + kind] = 1;   /* 换道具 → 件数回 1（新道具回复量不同） */
    ui.openRestorePick(genId, kind);
  };"""),

    # ② 商城页签
    ('SHOP_CATS energy', """    pop_fill: '民生',
  };""",
     """    pop_fill: '民生',
    /* v89.131（老板「体力精力应当设计加号按钮，供道具使用」）：
       精力族（清心丸/提神散/养神丹/凝神玉露）—— 新 type 'energy'，
       **在售 == 有页签**（v89.51 判据）：漏了这行就是"半上架"（有价却渲染不出来）。 */
    energy: '精力',
  };"""),

    # ③ 提示表
    ('QUICK_ITEM_HINT energy', """    stamina: { hint: '恢复体力：请对将领使用', view: 'generals', btn: '去将领面板' },""",
     """    stamina: { hint: '恢复体力：请对将领使用', view: 'generals', btn: '去将领面板' },
    energy: { hint: '恢复精力：请对将领使用', view: 'generals', btn: '去将领面板' },"""),
]
patch_file(UI, ui_pairs)

# ---------- main.js ----------
main_pairs = [
    ('main cases', """      case 'gen-gift-pick': ui.openGiftPick(el.dataset.gen); break;
      case 'gift-pick-item': ui.setGiftItem(el.dataset.gen, el.dataset.item); break;""",
     """      case 'gen-gift-pick': ui.openGiftPick(el.dataset.gen); break;
      case 'gift-pick-item': ui.setGiftItem(el.dataset.gen, el.dataset.item); break;
      /* v89.131（老板「体力精力应当设计加号按钮，供道具使用，参考赏赐」）：
         两个「＋」→ 同一个选择窗（kind 分流体力/精力）→ 执行 */
      case 'gen-sta-pick': ui.openRestorePick(el.dataset.gen, 'sta'); break;
      case 'gen-energy-pick': ui.openRestorePick(el.dataset.gen, 'energy'); break;
      case 'restore-pick-item': ui.setRestoreItem(el.dataset.gen, el.dataset.kind, el.dataset.item); break;
      case 'gen-restore-do':
        GAME.doGenRestore(el.dataset.gen, el.dataset.kind, el.dataset.item,
          el.dataset.qtyFrom ? ui.qtyValueOf(el.dataset.qtyFrom) : 1);
        break;"""),

    ('doGenRestore', """  GAME.doGenGift = function (genId, itemId, qty) {""",
     """  /* v89.131：体力/精力道具的使用出口（与 doGenGift 同构：真调 useItem(+Many) → toast → 刷新） */
  GAME.doGenRestore = function (genId, kind, itemId, qty) {
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var r = qty > 1
      ? GAME.systems.useItemMany(itemId, genId, qty)
      : GAME.systems.useItem(itemId, genId);
    ui.toast(r.msg);
    GAME.refreshAll();
    ui.closeModal();
    if (ui.view === 'generals') ui.renderView();
  };
  GAME.doGenGift = function (genId, itemId, qty) {"""),
]
patch_file(MAIN, main_pairs)

print('patch E2(ui+main) OK · %d 处' % n)
