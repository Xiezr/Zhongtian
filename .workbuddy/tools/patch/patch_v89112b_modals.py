# -*- coding: utf-8 -*-
"""
v89.112b · 弹窗整改第二批：将领选择器分页 + 出征表紧凑 + 战报纪要分页
----------------------------------------------------------------------
首批复测后仍剩 4 处（真实存档压测）：
  装备 溢出 2621（真因：.gen-chips 两列网格 × 166 位将领 = 83 行高墙 2356px）
  战报详情 溢出 353（回合纪要 12 行 362px + 损耗表 235px）
  出征 140 / 自动出征 113（出兵表 12 兵种 × 行高 50px = 846px，右列远超左列 555px）
"""
import io, os, shutil

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')

def sub_txt(s, a, b, tag):
    n = s.count(a)
    assert n == 1, '锚点 %s 命中 %d 次：%s' % (tag, n, a[:70])
    return s.replace(a, b, 1)

# ============================================================
# A. index.html（CSS）
# ============================================================
hp = os.path.join(R, 'index.html')
h = io.open(hp, encoding='utf-8').read()

# ① gen-chips 宽版（4 列）——装备/宝物面板（1182 弹窗）专用
a = """  .chips.gen-chips { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-1); padding: var(--sp-hair); }"""
b = """  .chips.gen-chips { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-1); padding: var(--sp-hair); }
  /* v89.112：**宽版 4 列** —— 装备/宝物面板的选择器。
     166 位将领 × 2 列 = 83 行 = 2356px 的高墙（"小小弹窗一屏全是人名"）。
     4 列 + 分页（每页 24，见 ui.genChips 的 per/modal 参数）后 6 行 ≈ 170px。 */
  .chips.gen-chips.wide { grid-template-columns: repeat(4, minmax(0, 1fr)); }"""
h = sub_txt(h, a, b, 'gen-chips.wide')

# ② 出征/自动出征：出兵表紧凑（.tbl td 的 8px 内边距在这里被降到 3px —— 12 行省 ~120px）
a = """  .exp-tbl td, .exp-tbl th { padding: var(--sp-1) var(--sp-2); }"""
b = """  .exp-tbl td, .exp-tbl th { padding: var(--sp-1) var(--sp-2); }
  /* v89.112（老板「避免使用下拉条」）：**弹窗内**的出兵/辎重表再收一档内边距。
     为什么原规则没生效：`.tbl td`（全站 8px，定义在后面且同为 (0,1,1)）把它覆盖了 ——
     12 行 × 16px 的上下内边距 = 撑出 846px 的右列（远超左列 555px，溢出 140px）。
     这里用 `.modal .exp-tbl`（(0,2,1)）压回来；视图里的表格不受影响。 */
  .modal .exp-tbl td, .modal .exp-tbl th { padding: 3px var(--sp-2); }
  .modal .exp-tbl .et-in input { padding: 3px var(--sp-2); }
  /* 出征页四块的段间距同步收紧（sp-3 → sp-2） */
  .modal .exp-col-l, .modal .exp-col-r { gap: var(--sp-2); }
  .modal .exp-sec { padding: var(--sp-2) var(--sp-3); }
  /* v89.112：战报详情的损耗表（7 列 × 兵种数）紧凑化 */
  .modal .rp-tbl td, .modal .rp-tbl th { padding: 3px var(--sp-2); }"""
h = sub_txt(h, a, b, 'exp-tbl 紧凑')

assert h != io.open(hp, encoding='utf-8').read()
shutil.copy2(hp, os.path.join(BK, 'index.v89112a.html'))
io.open(hp + '.tmp', 'w', encoding='utf-8', newline='').write(h)
os.replace(hp + '.tmp', hp)
print('A. index.html：2 组 CSS 已落盘')

# ============================================================
# B. js/ui.js
# ============================================================
up = os.path.join(R, 'js', 'ui.js')
u = io.open(up, encoding='utf-8').read()

# ① genChips：分页（per）+ 宽版（wide）+ 弹窗模式（modal+key）
a = """  ui.genChips = function (o) {
    var opt = o || {};
    var list = opt.list || (GAME.state.generals || []);
    var ST = { guard: '守', march: '征', gather: '采' };
    return ui.chips({
      cls: opt.cls || 'gen-chips',
      target: opt.target, store: opt.store, refresh: opt.refresh, after: opt.after,
      opts: list.map(function (g) {"""
b = """  /* v89.112（老板「条目过多的分页」）：将领选择器支持**分页**。
     166 位将领 × `.gen-chips` 两列网格 = 83 行 2356px —— 装备/宝物面板被它顶爆。
     用法：per=每页数（0/不传 = 不分页）；modal=true 走弹窗内翻页（mpage），
     否则走视图内联分页条（page → refreshView）。wide=true 用 4 列（见 CSS）。 */
  ui.genChips = function (o) {
    var opt = o || {};
    var list = opt.list || (GAME.state.generals || []);
    var ST = { guard: '守', march: '征', gather: '采' };
    var slice = list, pager = '';
    var per = opt.per || 0;
    if (per > 0 && list.length > per) {
      var key = opt.key || ('gchips_' + (opt.store || opt.target || 'x'));
      var p = ui.pageOf(key, list.length, per);
      slice = list.slice(p.from, p.to);
      pager = opt.modal ? ui.modalPagerHTML(key, list.length, per)
                        : ui.pagerInnerHTML(key, list.length, per);
    }
    return ui.chips({
      cls: (opt.cls || 'gen-chips') + (opt.wide ? ' wide' : ''),
      target: opt.target, store: opt.store, refresh: opt.refresh, after: opt.after,
      opts: slice.map(function (g) {"""
u = sub_txt(u, a, b, 'genChips.head')

a = """          label: U.escape(g.name) + '<span class="chip-sub">' + sub +
            (ST[g.status] ? ' ' + ST[g.status] : '') + '</span>'
        };
      })
    });
  };"""
b = """          label: U.escape(g.name) + '<span class="chip-sub">' + sub +
            (ST[g.status] ? ' ' + ST[g.status] : '') + '</span>'
        };
      })
    }) + pager;
  };"""
u = sub_txt(u, a, b, 'genChips.tail')

# ② 装备面板：选择器分页 + 宽版；档位 xl → xxl
a = """        ui.genChips({ store: '_equipGen', refresh: 'view', value: g.id || (ui._equipGen || '') }) + '</div>' +"""
b = """        ui.genChips({ store: '_equipGen', refresh: 'view', value: g.id || (ui._equipGen || ''),
          per: 24, modal: true, key: 'gchips_eq', wide: true }) + '</div>' +"""
u = sub_txt(u, a, b, 'equip.chips')

a = """  ui.openEquipPanel = function () { ui.openPanel('equip', null, 'xl'); };   /* v89.105：实测 675px */"""
b = """  ui.openEquipPanel = function () { ui.openPanel('equip', null, 'xxl'); };   /* v89.112：选择器分页后仍 900+，升 xxl */"""
u = sub_txt(u, a, b, 'equip.panel')

# ③ 宝物背包（视图）：选择器分页 + 宽版（内联分页条走 page 动作 → refreshView）
a = """          ui.genChips({ store: '_itemGen', value: ui._itemGen }) + '</div>'"""
b = """          ui.genChips({ store: '_itemGen', value: ui._itemGen,
            per: 24, key: 'gchips_item', wide: true }) + '</div>'"""
u = sub_txt(u, a, b, 'items.chips')

# ④ 战报详情：回合纪要 12 → 6 行/页（连带把"共 N 回合"提示保留）
a = """      var rlog = (sc.roundsText || []);
      var pgL = ui.modalPage('rlog', rlog, 12, function () { ui.viewReportText(i); });"""
b = """      var rlog = (sc.roundsText || []);
      var pgL = ui.modalPage('rlog', rlog, 6, function () { ui.viewReportText(i); });"""
u = sub_txt(u, a, b, 'rlog.6')

# ⑤ 损耗表加 rp-tbl 类（紧凑化 CSS 的挂点）
a = """      html += '<table class="tbl"><thead><tr><th>兵种</th><th>我方初始</th><th>我方损失</th>' +
        '<th>我方剩余</th><th>敌军初始</th><th>敌军损失</th><th>敌军剩余</th></tr></thead><tbody>';"""
b = """      html += '<table class="tbl rp-tbl"><thead><tr><th>兵种</th><th>我方初始</th><th>我方损失</th>' +
        '<th>我方剩余</th><th>敌军初始</th><th>敌军损失</th><th>敌军剩余</th></tr></thead><tbody>';"""
u = sub_txt(u, a, b, 'rp-tbl')

shutil.copy2(up, os.path.join(BK, 'ui.v89112a.js'))
io.open(up + '.tmp', 'w', encoding='utf-8', newline='').write(u)
os.replace(up + '.tmp', up)
print('B. js/ui.js：5 处改动已落盘')

# 自检
h2 = io.open(hp, encoding='utf-8').read()
u2 = io.open(up, encoding='utf-8').read()
chk = [
    ('gen-chips.wide', '.chips.gen-chips.wide' in h2),
    ('exp-tbl 紧凑', '.modal .exp-tbl td' in h2),
    ('rp-tbl CSS', '.modal .rp-tbl td' in h2),
    ('genChips 分页', 'opt.modal ? ui.modalPagerHTML' in u2),
    ('装备 chips 参数', "per: 24, modal: true, key: 'gchips_eq'" in u2),
    ('宝物 chips 参数', "per: 24, key: 'gchips_item'" in u2),
    ('装备 xxl', "ui.openPanel('equip', null, 'xxl')" in u2),
    ('rlog 6 行', "ui.modalPage('rlog', rlog, 6" in u2),
    ('rp-tbl 类', 'class=\\"tbl rp-tbl\\"' in u2),
]
bad = [n for n, ok in chk if not ok]
print('自检：%d/%d %s' % (len(chk) - len(bad), len(chk), ('缺 ' + '、'.join(bad)) if bad else '通过'))
assert not bad, '自检未过'
