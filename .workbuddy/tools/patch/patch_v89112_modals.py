# -*- coding: utf-8 -*-
"""
v89.112 · 弹窗整改：充分利用版面 + 消除嵌套下拉条 + 条目过多改分页
------------------------------------------------------------------
老板令（原话）：「怎么小小弹窗，搞一堆右侧下拉条，能不能充分利用界面版面，
说了多少次，设置合理的界面大小，避免使用下拉条，条目过多的分页，搞什么！」

压测取证（audit_v89112_pressure.js，真实试玩存档 + 极限补料）：
  野地一览 溢出 675px · 采集点 475px · 战报详情 277px+嵌套双滚动
  · 装备/出征/自动出征 嵌套滚动 · 秘境 38px

三级整改（对齐老板三句话）：
  ① 合理的界面大小  → xxl 档 1020×840 提到 1200×850（画布 1440×900 的 83%×94%）
  ② 避免使用下拉条  → 撤掉弹窗内所有"写死的中间高度"（.panel-body/.exp-body/.modal-scroll）
  ③ 条目过多的分页  → 野地/采集/装备/战报回合纪要 接入 ui.modalPage（弹窗内翻页）

两阶段提交：先全量校验锚点，全部命中才写盘；逐文件备份 + 语法自检。
"""
import io, os, re, shutil

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')
os.makedirs(BK, exist_ok=True)

# ============================================================
# A. index.html（CSS）
# ============================================================
hp = os.path.join(R, 'index.html')
h = io.open(hp, encoding='utf-8').read()
h0 = h

def sub_txt(s, a, b, tag):
    n = s.count(a)
    assert n == 1, '锚点 %s 命中 %d 次：%s' % (tag, n, a[:70])
    return s.replace(a, b, 1)

# ①-a 第一处 xxl 定义块（含 v75 注释）
a1 = """  /* xxl（v75 客栈招募）：980×800 —— 老板「大一点，尽量所有候选同一页」。
     单行候选（行高实测 36px）：14 位（客栈 Lv12 + 专精 2）与 16 位（县城上限）真机一页装下；
     兜底规则同其余档位。 */
  .modal-xxl { width: 1020px; height: 840px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }"""
b1 = """  /* xxl（v75 客栈招募；v89.112 再扩）：**1200×850** —— 老板「充分利用界面版面。
     画布 1440×900：左右各留 120px、上下各留 25px —— 相比旧 1020×840（左右各 210px）
     多出 18% 面积。坐在这一档的是"内容确实多"的面板（市场/客栈/见闻/君主/出征/
     全境营造/战报详情…），加宽后原本靠滚动条苟着的段（出兵表/候选表）多数能一屏站直。
     兜底规则同其余档位。 */
  .modal-xxl { width: 1200px; height: 850px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }"""
h = sub_txt(h, a1, b1, 'xxl#1')

# ①-b 第二处（v89.105 重复定义块）
a2 = """  /* v89.105（基调统一 · 弹窗整备）：xxl 由 980×800 调到 1020×840。
     依据是**实测**：坐在这一档的面板（客栈/市场/见闻日志/出征/自动出征/君主）
     内容高 690~830px，800 高时正文区只有 780 —— 差 9~40px 就装不下，
     于是有的冒滚动条、有的被挤掉一行。画布 1440×900，840 仍留 30px 天地。
     ⚠️ 再改这一档要**重新量**（node .workbuddy/tools/audit/audit_v89105_modals.js）。 */
  .modal-xxl { width: 1020px; height: 840px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }"""
b2 = """  /* v89.105（基调统一 · 弹窗整备）：xxl 数值在上一处（v89.112 起 1200×850）。
     ⚠️ 再改这一档要**重新量**：
        node .workbuddy/tools/audit/audit_v891112_pressure.js（载荷体检）
      —— 它用真实试玩存档压出"哪些面板还会冒滚动条"。 */
  .modal-xxl { width: 1200px; height: 850px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }"""
h = sub_txt(h, a2, b2, 'xxl#2')

# ② .panel-body：558 上限撤除（仅 openPanel 的弹窗使用 —— 已核实）
a3 = """  .panel-body { max-height: 558px; overflow-y: auto; margin: 0 -4px; }"""
b3 = """  /* v89.112（老板：「避免使用下拉条」）：**撤掉 558px 的中间高度** ——
     那是"小小弹窗配小滚动区"的老病根：弹窗内容区明明有 600+，容器却只给 558，
     于是差 50px 也要冒一条滚动条。内容多装不下时由**弹窗整体**或**分页**承载
     （openPanel 家族里唯一的长列表 = 装备背包，已接 ui.modalPage 弹窗内分页）。 */
  .panel-body { max-height: none; overflow-y: auto; margin: 0 -4px; }"""
h = sub_txt(h, a3, b3, 'panel-body')

# ③ .exp-body 三处（出征/自动出征的出兵表）
a4 = """  .exp-body { max-height: 360px; overflow-y: auto; padding-right: var(--sp-1); }"""
b4 = """  /* v89.112：出兵表原 360px 上限 → 撤（兵种全列 12 行 ≈ 480px，卡在 360 必然内滚）。 */
  .exp-body { max-height: none; overflow-y: auto; padding-right: var(--sp-1); }"""
h = sub_txt(h, a4, b4, 'exp-body#1')

a5 = """  .exp-a-troops .exp-body { max-height: 520px; }"""
b5 = """  .exp-a-troops .exp-body { max-height: none; }   /* v89.112：同上，撤中间高度 */"""
h = sub_txt(h, a5, b5, 'exp-body#2')

a6 = """  .exp-col-r.exp-own .exp-a-troops .exp-body { max-height: 252px; }"""
b6 = """  .exp-col-r.exp-own .exp-a-troops .exp-body { max-height: none; }   /* v89.112 */"""
h = sub_txt(h, a6, b6, 'exp-body#3')

# ④ .modal-scroll（快购/派驻的弹窗内滚动）
a7 = """  .modal-scroll { max-height: 414px; overflow-y: auto; padding-right: var(--sp-1); }"""
b7 = """  /* v89.112：原 414px 中间高度 → 撤（"弹窗里再开小窗滚"是老板点名的病）。 */
  .modal-scroll { max-height: none; overflow-y: auto; padding-right: var(--sp-1); }"""
h = sub_txt(h, a7, b7, 'modal-scroll')

# ⑤ 新增 .rp-log（战报回合纪要：与沙盘 .bt-log 分开，后者 168/118px 上限是战斗实时窗）
a8 = """  .bt-log { max-height: 168px; overflow-y: auto; }"""
b8 = """  .bt-log { max-height: 168px; overflow-y: auto; }
  /* v89.112：战报详情 · 回合纪要专用容器。
     ⚠️ 与上面 .bt-log（沙盘"战斗中实时日志"小窗）**不是一回事**：那是地图上浮窗，
     168px 是设计；这里是弹窗详情页，配 ui.modalPage 翻页，无中间高度。 */
  .rp-log { display: flex; flex-direction: column; gap: var(--sp-hair); }"""
h = sub_txt(h, a8, b8, 'rp-log')

assert h != h0
shutil.copy2(hp, os.path.join(BK, 'index.v89111.html'))
io.open(hp + '.tmp', 'w', encoding='utf-8', newline='').write(h)
os.replace(hp + '.tmp', hp)
print('A. index.html：6 组 CSS 改动已落盘')

# ============================================================
# B. js/ui.js
# ============================================================
up = os.path.join(R, 'js', 'ui.js')
u = io.open(up, encoding='utf-8').read()
u0 = u

# ① modalPage 返回值补 from（分页高亮需要全局索引）
a = """    return {
      slice: list.slice(p.from, p.to),
      pager: ui.modalPagerHTML(key, list.length, perPage),
      page: p.page, maxPage: p.maxPage,
    };"""
b = """    return {
      slice: list.slice(p.from, p.to),
      pager: ui.modalPagerHTML(key, list.length, perPage),
      page: p.page, maxPage: p.maxPage, from: p.from,
    };"""
u = sub_txt(u, a, b, 'modalPage.from')

# ② openWilds：分页 + xxl
a = """    var rows = wilds.map(function (w, wi) {"""
b = """    /* v89.112（老板：条目过多的分页）：30 片野地平铺 = 675px 溢出。
       改 xxl 档 + 弹窗内翻页（每页 13 行；分页条走 mpage → 重开本弹窗）。 */
    var pgW = ui.modalPage('wilds', wilds, 13, function () { ui.openWilds(); });
    var rows = pgW.slice.map(function (w, wi) {"""
u = sub_txt(u, a, b, 'wilds.map')

a = """      return '<tr' + (wi === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +"""
b = """      return '<tr' + ((pgW.from + wi) === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +"""
u = sub_txt(u, a, b, 'wilds.sel')

a = """      '<tbody>' + rows + '</tbody></table>' +
      '<div class="wild-total"><span style="color:var(--text-dim);font-size:var(--fs-sub);">野地贡献合计</span>' + totalLine + '</div>' +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>'
    );"""
b = """      '<tbody>' + rows + '</tbody></table>' +
      /* v89.112：分页条（>1 页才出按钮；单页只显示"共 N 项"） */
      (wilds.length > 13 ? pgW.pager : '') +
      '<div class="wild-total"><span style="color:var(--text-dim);font-size:var(--fs-sub);">野地贡献合计</span>' + totalLine + '</div>' +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xxl' }
    );"""
u = sub_txt(u, a, b, 'wilds.foot')

# ③ openGathers：分页 + xxl
a = """    var list = GAME.gatherList();
    var body;
    if (!list.length) {
      body = '<div class="q-empty">当前没有采集队</div>';
    } else {
      body = list.map(function (g) {"""
b = """    var list = GAME.gatherList();
    /* v89.112（老板：条目过多的分页）：8 队卡片 = 475px 溢出 → xxl 档 + 每页 4 队翻页。
       卡片实测 ~110px（进度条 + 三行文字 + 三按钮），xxl 内容区 ~660px 装 4 张舒适。 */
    var pgG = ui.modalPage('gathers', list, 4, function () { ui.openGathers(); });
    var body;
    if (!list.length) {
      body = '<div class="q-empty">当前没有采集队</div>';
    } else {
      body = pgG.slice.map(function (g) {"""
u = sub_txt(u, a, b, 'gathers.map')

a = """      }).join('');
    }
    /* v89.83：派军采集入口搬到这里"""
b = """      }).join('') + (list.length > 4 ? pgG.pager : '');
    }
    /* v89.83：派军采集入口搬到这里"""
u = sub_txt(u, a, b, 'gathers.foot')

# openGathers 的 openModal 收尾：lg → xxl（实测 lg 847×591 里溢出 475px）
a2 = """              '此处是将领带队的采集队。</div></div>'
        : ''), 'lg');"""
b2 = """              '此处是将领带队的采集队。</div></div>'
        : ''), 'xxl');    /* v89.112：lg(591 高) 里溢出 475px → xxl + 每页 4 队 */"""
u = sub_txt(u, a2, b2, 'gathers.size')

# ④ equipHTML：弹窗模式走 modalPage
a = """  ui.equipHTML = function () {
    var s = GAME.state;"""
b = """  /* v89.112（老板：「条目过多的分页」）：本函数**视图/弹窗双用** ——
       · 视图（setView('equip')）：分页条走屏幕底部条（pagerHTML）；
       · 弹窗（openEquipPanel）：底部条会被 modal-mask 盖住、**点不到**（旧账本 bug），
         改走 ui.modalPage 弹窗内分页。
     入参 inModal 由调用方声明（openPanel 的 equip 分支传 true）。 */
  ui.equipHTML = function (inModal) {
    var s = GAME.state;"""
u = sub_txt(u, a, b, 'equipHTML.head')

a = """    var pgE = ui.pageOf('equip', invAll.length, 10);
    var inv = invAll.slice(pgE.from, pgE.to).map(function (inst, i) {"""
b = """    var pgE = ui.pageOf('equip', invAll.length, 10);
    var eqSlice = invAll.slice(pgE.from, pgE.to), eqPager = '';
    if (inModal) {
      var pgM = ui.modalPage('equip', invAll, 10, function () { ui.openEquipPanel(); });
      eqSlice = pgM.slice; eqPager = pgM.pager;
    } else {
      ui.pagerHTML('equip', invAll.length, 10);      /* 视图：底部条 */
    }
    var inv = eqSlice.map(function (inst, i) {"""
u = sub_txt(u, a, b, 'equipHTML.page')

a = """      '<div class="troop-grid" style="grid-template-columns:repeat(4,1fr);">' + inv + '</div>' +
      ui.pagerHTML('equip', invAll.length, 10) + '</div>' +"""
b = """      '<div class="troop-grid" style="grid-template-columns:repeat(4,1fr);">' + inv + '</div>' +
      eqPager + '</div>' +"""
u = sub_txt(u, a, b, 'equipHTML.pager')

# ⑤ openPanel：equip 分支传 inModal
a = """    else if (view === 'equip') body = ui.equipHTML();"""
b = """    else if (view === 'equip') body = ui.equipHTML(true);    /* v89.112：弹窗模式（分页走弹窗内） */"""
u = sub_txt(u, a, b, 'openPanel.equip')

# ⑥ viewReportText：全类型 xxl + 回合纪要分页（rp-log）
a = """    html += '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html, r.type === 'war' ? 'xxl' : '');"""
b = """    html += '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>';
    /* v89.112（老板：「小小弹窗，一堆右侧下拉条」）：战报详情**一律 xxl** ——
       旧逻辑只对 war 用 xxl，defense/scout 落在默认 md(660×620)：
       防战报（回合纪要 + 战场条带 + 损耗表）在 md 里溢出 277px 且**双层滚动**。 */
    ui.openModal(html, 'xxl');"""
u = sub_txt(u, a, b, 'viewReportText.size')

a = """    if (sc) {
      /* 回合纪要（逐回合文字）：回放给"画面"、纪要给"全量" —— 两者并存 */
      html += ui.sealH('回合纪要', '速度高的兵种先行动；接敌即开火');
      html += '<div class="bt-log">' + (sc.roundsText || []).map(function (l) {
        return '<div class="bt-line">' + U.escape(l) + '</div>';
      }).join('') + '</div>';
    }"""
b = """    if (sc) {
      /* 回合纪要（逐回合文字）：回放给"画面"、纪要给"全量" —— 两者并存。
         v89.112：60+ 回合全量塞进 168px 的 .bt-log = 又一条内滚下拉条。
         改 .rp-log（无中间高度）+ 每页 12 行弹窗内翻页；末页附"查看完整"落点提示。 */
      var rlog = (sc.roundsText || []);
      var pgL = ui.modalPage('rlog', rlog, 12, function () { ui.viewReportText(i); });
      html += ui.sealH('回合纪要', '速度高的兵种先行动；接敌即开火'
        + (rlog.length > 12 ? '　·　共 ' + rlog.length + ' 回合' : ''));
      html += '<div class="rp-log">' + pgL.slice.map(function (l) {
        return '<div class="bt-line">' + U.escape(l) + '</div>';
      }).join('') + '</div>';
      if (rlog.length > 12) html += pgL.pager;
    }"""
u = sub_txt(u, a, b, 'viewReportText.rlog')

# ⑦ openFarm：xl → xxl（38px 溢出）
a = """  ui.openFarm = function () {
    ui.openModal('<div class="ui-page farm-space">' + ui.farmHTML() + '</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };"""
b = """  ui.openFarm = function () {
    ui.openModal('<div class="ui-page farm-space">' + ui.farmHTML() + '</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xxl' });    /* v89.112：xl(700 高) 里溢 38px → 升 xxl */
  };"""
u = sub_txt(u, a, b, 'openFarm.xxl')

# ⑧ openQuickCat 内联 max-height 撤除
a = """      '<div class="modal-scroll" style="max-height:440px;">' + rows + '</div>' +"""
b = """      '<div class="modal-scroll">' + rows + '</div>' +   /* v89.112：撤内联 440px 上限 */"""
u = sub_txt(u, a, b, 'quickcat.scroll')

assert u != u0
shutil.copy2(up, os.path.join(BK, 'ui.v89111.js'))
io.open(up + '.tmp', 'w', encoding='utf-8', newline='').write(u)
os.replace(up + '.tmp', up)
print('B. js/ui.js：12 处改动已落盘')

# ============================================================
# C. 写后自检
# ============================================================
h2 = io.open(hp, encoding='utf-8').read()
u2 = io.open(up, encoding='utf-8').read()
chk = [
    ('xxl=1200', h2.count('width: 1200px') >= 2),
    ('panel-body none', '.panel-body { max-height: none' in h2),
    ('exp-body none x3', h2.count('.exp-body { max-height: none') >= 1 and 'exp-a-troops .exp-body { max-height: none' in h2),
    ('modal-scroll none', '.modal-scroll { max-height: none' in h2),
    ('rp-log 定义', '.rp-log {' in h2),
    ('modalPage.from', 'page: p.page, maxPage: p.maxPage, from: p.from' in u2),
    ('wilds 分页', "ui.modalPage('wilds', wilds, 13" in u2),
    ('gathers 分页', "ui.modalPage('gathers', list, 4" in u2),
    ('equip 双模式', 'ui.equipHTML(true)' in u2 and 'if (inModal)' in u2),
    ('战报 xxl', "ui.openModal(html, 'xxl')" in u2),
    ('rlog 分页', "ui.modalPage('rlog'" in u2),
    ('farm xxl', 'v89.112：xl(700) 里溢 38px' in u2),
]
bad = [n for n, ok in chk if not ok]
print('自检：%d/%d 通过 %s' % (len(chk) - len(bad), len(chk), ('；缺：' + '、'.join(bad)) if bad else ''))
assert not bad, '自检未过：' + '、'.join(bad)
print('（下一步：node --check 两个 js + 跑 audit_v89112_pressure.js 复测）')
