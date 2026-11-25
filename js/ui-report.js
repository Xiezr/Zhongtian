/* ============================================================
 * ui-report.js　文书 · 通用分页 / 统计 / 公文 / 战报沙盘
 * ------------------------------------------------------------
 * 拆分自 ui.js（v156.27）。**纯搬运** —— 所有 ui.xxx 定义及其先后顺序
 *   一字未改，只是换了文件。等价性由逐条 sha1 比对证明。
 * ⚠️ 这个文件的职责就是「一个功能域的全部面板实现」，不要在这里改引擎逻辑。
 * ============================================================ */
import './ui.js';
(function () {
  var GAME = window.GAME;
  var DATA = GAME.DATA, U = GAME.utils;
  var ui = GAME.ui;
  var $ = ui._dom.$, $$ = ui._dom.$$;

  /* ================= 任务（随机任务 + 成长任务 + 已完成） ================= */

  /* v25（需求 11）：旧的卡片墙渲染器已删除 —— 任务列表只给一行名称，
     领取/放弃/进度全部进详情弹窗，卡片不再有使用场景。 */


  /* ============================================================
   * 通用分页（v14.1）
   * 长列表不再无限下拉：每页固定条数，翻页控件统一。
   * 用法：ui.pagerHTML(key, total, perPage) 取分页条；
   *       切片用 ui.pageOf(key, total, perPage) 返回的 from/to。
   * ============================================================ */
  ui._pages = ui._pages || {};
  ui.PAGE_SIZE = 12;
  ui.pageOf = function (key, total, perPage) {
    var size = perPage || ui.PAGE_SIZE;
    var maxPage = Math.max(1, Math.ceil((total || 0) / size));
    var cur = ui._pages[key] || 1;
    if (cur > maxPage) cur = maxPage;
    if (cur < 1) cur = 1;
    ui._pages[key] = cur;
    return { page: cur, size: size, maxPage: maxPage, from: (cur - 1) * size, to: Math.min(total || 0, cur * size) };
  };
  /* 翻页条现在**不留在内容里**，而是登记到 ui._bottom，由 renderView 收尾时
     一次性画进屏幕下方的固定条 #bottom-bar（需求 3：位置固定，不随内容滚动）。
     返回空串 —— 内容区再也不需要为翻页控件预留位置，也就不会"必须滚到底才能翻页"。 */
  ui._bottom = [];
  ui.pagerHTML = function (key, total, perPage) {
    ui._bottom.push(ui.pagerInnerHTML(key, total, perPage));
    return '';
  };
  /* 纯函数：只产出分页条的 HTML（供底部条与测试直接调用）。
     v89.213（老板）：「页码集中在中部，不要分散至两边，导致和其他菜单重叠住了」——
     v89.204 的三栏 grid（前导/页码/后导分居两端）退役：底栏里左栏按钮撞进
     「🏷 隐藏名称 / ⚔ 指挥战斗」（.bb-tools · 实测重叠 95px、按钮被盖住）。
     现为**整体居中 flex**（CSS 在 .pager）：l → 页码 → r 三块作为一个整体排在中轴，
     两侧自动留白。同款结构见 modalPagerHTML。 */
  ui.pagerInnerHTML = function (key, total, perPage) {
    var p = ui.pageOf(key, total, perPage);
    if (!total) return '<div class="pager"><span class="pg-info">暂无记录</span></div>';
    if (p.maxPage <= 1) return '<div class="pager"><span class="pg-info">共 ' + total + ' 项</span></div>';
    var btn = function (n, label, extra) {
      return '<button class="btn sm' + (extra || '') + '" data-action="page" data-key="' + key + '" data-n="' + n + '">' + label + '</button>';
    };
    var l = btn(1, '« 首页');
    /* v89.189：分页"到头"不是操作受阻 —— 加 data-no-why，软化器不动它 */
    l += '<button class="btn sm" data-action="page" data-key="' + key + '" data-n="' + (p.page - 1) + '"' + (p.page <= 1 ? ' disabled data-no-why="1"' : '') + '>‹ 上页</button>';
    var lo = Math.max(1, p.page - 2), hi = Math.min(p.maxPage, lo + 4);
    lo = Math.max(1, hi - 4);
    for (var i = lo; i <= hi; i++) l += btn(i, String(i), i === p.page ? ' gold' : '');
    var r = '<button class="btn sm" data-action="page" data-key="' + key + '" data-n="' + (p.page + 1) + '"' + (p.page >= p.maxPage ? ' disabled data-no-why="1"' : '') + '>下页 ›</button>';
    r += btn(p.maxPage, '末页 »');
    return '<div class="pager"><span class="pg-side l">' + l + '</span>'
      + '<span class="pg-info">第 ' + p.page + '/' + p.maxPage + ' 页 · 共 ' + total + ' 项</span>'
      + '<span class="pg-side r">' + r + '</span></div>';
  };
  /* 画底部条：有分页就画分页，没有就留一行极淡的占位（位置照留、高度不变）。
     v85（老板）：「底部导航栏增加一个缩略地图」—— 每次落画都**固定拼**一枚 38px
     缩略图（绝对定位在条尾，不参与居中排版），点击展开「天下大势」面板。
     ⚠ 它只能在 paintBottom 里拼 —— 若在某视图 _bottom.push，会被下一次落画覆盖。 */
  ui.paintBottom = function () {
    var bar = $('#bottom-bar');
    if (!bar) return;
    var arr = ui._bottom || [];
    /* ============================================================
     * v89.151（老板 3）：底部导航栏左侧统一为 `.bb-tools` 容器（两枚**同级图标按钮**）——
     *   ① 「名称」改名随状态走：「🏷 隐藏名称」（显示中）/「🏷 显示名称」（已隐藏）；
     *   ② 新增同级菜单「⚔ 指挥战斗」= 战斗待指挥清单入口（`ui.openBattleList`）——
     *      **有正在进行的战斗时闪烁**（`.blink`，由 ui.paintWarBeacon 每秒切换，不重建 DOM）。
     * 沿用 v89.52 的定位套路（贴底栏最左、不挤占居中的分页/地图导航），
     * v89.67 的 title 规矩照旧：写清"哪些能收、哪些永远在"。
     * ============================================================ */
    var show = ui._mapShowLabels !== false;
    var lblBtn = '<button class="bb-label-toggle' + (show ? ' on' : '') +
      '" data-action="map-toggle-labels" title="' + (show
        ? '点击隐藏：城内建筑 · 城外资源建筑的名称与等级（**地图标注不受影响**）'
        : '当前已隐藏 —— 点击恢复显示：城内建筑 · 城外资源建筑的名称与等级') +
      '">🏷 ' + (show ? '隐藏名称' : '显示名称') + '</button>';
    var warBtn = '<button class="bb-war" data-action="battle-list-open" ' +
      'title="指挥战斗：查看正在进行的战斗与行军中的军队（有战斗待指挥时闪烁）">⚔ 指挥战斗</button>';
    /* v90.73（老板 9）：底部导航加**星球生成器**入口 —— 调参生成星球，作为副本（不与其他星球同屏）。 */
    /* v90.79（老板 1）：星球生成器移到底栏**最右**（与「隐藏名称」同款图标按钮样式）。 */
    /* v158.18（老板「新手玩法」）：名字是老板定的不动，title 补清楚"不影响当前星球"——
       新手最容易把这个入口当成"会重置世界"的危险按钮而不敢点。 */
    var planetBtn = '<button class="bb-planet" data-action="planet-gen-open" ' +
      'title="星球生成器：设置要素参数，生成一颗新星球作为独立副本（不影响你当前的星球；也能在这里查看 / 进入已生成的星球）">🪐 星球生成器</button>';
    /* v90.98（老板）：**地图视野缩放条** —— 底栏右侧、星球生成器左侧；仅地图视图显示。
       拖动滑块 = 极小视野 ⇄ 极大视野（与滚轮同源 camO.dist，见 map3d.zoomFrac/setZoom）。 */
    var zoomHTML = '';
    if (ui.view === 'map' && GAME.map3d && GAME.map3d.enabled && GAME.map3d.zoomFrac) {
      var zf98 = Math.round(GAME.map3d.zoomFrac() * 100);
      zoomHTML = '<div class="bb-zoom" title="地图视野：左=极小视野（近看细节） · 右=极大视野（整星总览）；也可用鼠标滚轮缩放">' +
        '<span class="bzm-ico">🔍</span>' +
        '<input id="bb-zoom" type="range" min="0" max="100" step="1" value="' + zf98 + '" aria-label="地图视野缩放" ' +
        'oninput="var G2=window.GAME;if(G2&&G2.map3d&&G2.map3d.setZoom)G2.map3d.setZoom(this.value/100);">' +
        '</div>';
    }
    bar.innerHTML = '<div class="bb-tools">' + lblBtn + warBtn + '</div>'
      + (arr.length ? arr.join('')
      : '<span class="bb-hint">—</span>')
      + '<div class="bb-tools bb-tools-r">' + zoomHTML + planetBtn + '</div>';
    ui.paintWarBeacon();
  };
  /* v89.151（老板 3）：「指挥战斗（有正在进行的战斗时发生闪烁）」——
     只切 class（**不重建按钮**），主循环每秒调用；paintBottom 收尾也调一次（首绘即正确）。
     判据走唯一出口 ui.battleListOf（state === 'live'），与清单弹窗同源。 */
  ui.paintWarBeacon = function () {
    var btn = (document.querySelector ? document.querySelector('#bottom-bar .bb-war') : null);
    if (!btn || !btn.classList) return;
    var on = ui.battleListOf().length > 0;
    if (on !== btn.classList.contains('blink')) btn.classList.toggle('blink', on);
  };
  ui.setPage = function (key, n) {
    ui._pages[key] = Math.max(1, Number(n) || 1);
    GAME.refreshView();
  };

  /* ============================================================
   * 弹窗内分页（v20 · 需求 9）
   *   「弹窗里避免下拉条，改用翻页」
   *
   * ⚠ 这里有个**必须记住的坑**：ui.setPage 走的是 GAME.refreshView()，
   *   它只重绘**中央视图**。弹窗内的翻页若复用它，点了不会有任何反应 ——
   *   这与「兵营点兵种没反应」是同一类 bug。
   *   所以弹窗分页单独一套：记录当前弹窗的重绘回调，翻页时重绘弹窗。
   * ============================================================ */
  ui._modalPageRender = null;      // 当前弹窗的重绘回调（由各弹窗自己登记）
  ui.setModalPage = function (key, n) {
    ui._pages[key] = Math.max(1, Number(n) || 1);
    if (ui._modalPageRender) ui._modalPageRender();
  };
  /* 弹窗分页条（按钮走 action=mpage → ui.setModalPage）
     v89.213（老板）：与 ui.pagerInnerHTML 同款 —— 整体居中的 flex 排布（三栏退役）。 */
  ui.modalPagerHTML = function (key, total, perPage) {
    var p = ui.pageOf(key, total, perPage);
    var btn = function (n, label, off) {
      /* v89.190（上轮遗留）：分页「到头」加 data-no-why —— 与 ui.pagerHTML 同款白名单，
         否则兜底扫掠会把它们软化成「点了弹原因」（到头不是操作受阻）。 */
      return '<button class="btn sm' + (off ? ' off' : '') + '" data-action="mpage" data-key="' + key + '" data-n="' + n + '"'
        + (off ? ' disabled data-no-why="1"' : '') + '>' + label + '</button>';
    };
    if (!total) return '<div class="pager"><span class="pg-info">暂无记录</span></div>';
    if (p.maxPage <= 1) return '<div class="pager"><span class="pg-info">共 ' + total + ' 项</span></div>';
    var l = btn(1, '« 首页', p.page <= 1) + btn(p.page - 1, '‹ 上页', p.page <= 1);
    var lo = Math.max(1, p.page - 2), hi = Math.min(p.maxPage, lo + 4);
    lo = Math.max(1, hi - 4);
    for (var i = lo; i <= hi; i++) l += btn(i, String(i), false).replace('class="btn sm"', 'class="btn sm' + (i === p.page ? ' gold' : '') + '"');
    var r = btn(p.page + 1, '下页 ›', p.page >= p.maxPage) + btn(p.maxPage, '末页 »', p.page >= p.maxPage);
    return '<div class="pager"><span class="pg-side l">' + l + '</span>'
      + '<span class="pg-info">第 ' + p.page + '/' + p.maxPage + ' 页 · 共 ' + total + ' 项</span>'
      + '<span class="pg-side r">' + r + '</span></div>';
  };
  /* 切片 + 登记重绘回调 + 返回分页条 */
  ui.modalPage = function (key, list, perPage, renderFn) {
    var p = ui.pageOf(key, list.length, perPage);
    ui._modalPageRender = renderFn;
    return {
      slice: list.slice(p.from, p.to),
      pager: ui.modalPagerHTML(key, list.length, perPage),
      page: p.page, maxPage: p.maxPage, from: p.from,
    };
  };

  /* ⛔ v90.92 退役：任务页（ui.tasksHTML）与任务详情弹窗整条删除 ——
     老板「去掉纪事剧本」中的「任务系统」。
     移除：tasksHTML / questJumpOf / doQuestGo / openQuestDetail。
     注：公文消息的 'task' 类标签（改元等）不属本系统，保留。 */

  /* ⛔ v90.92 退役：`ui.timeAgo`（相对时间）与 `GAME.rewardString`（奖励成文案）——
     二者**唯一消费点**是任务页 / 任务详情弹窗（已完成列表时间戳 · 奖励行），
     随任务系统整条移除后成为无引用死函数（审计实测）→ 按「零死代码」口径删除。
     将来别处若需要，从 git 历史取回（v90.92 前 ui.js 同段）。 */

  /* --------- 统计 --------- */
  /* ============================================================
   * 统计（v23 · 需求 5）：顶栏菜单，承载**所有城市的汇总**
   * 侧栏只讲当前城市，全局数字集中到这里，两边不再打架。
   * ============================================================ */
  /* 卷轴壳：上下木轴 + 竹简底 + 朱印标题（统计 / 公文共用） */
  /* v95 补回：`ui.scrollClose` 是卷轴的闭合半。统计页退役后它一度没有调用点
     （审计会算死函数），但 smoke §38 钉着"开/闭成对存在"。
     这里在开壳时取一次引用 —— 两个半壳必须同时存在，缺一半就是坏结构。 */
  ui.scrollClose = function () {
    return '</div><div class="scroll-axis"></div></div>';
  };
  ui.scrollOpen = function (seal, title, right) {
    if (!ui.scrollClose) return '';      /* 成对自检（引用即保留） */
    return '<div class="scroll-page">' +
      '<div class="scroll-axis"></div>' +
      '<div class="scroll-body">' +
        '<div class="scroll-title"><span class="seal">' + seal + '</span>' +
          '<span class="tx">' + title + '</span>' +
          (right ? '<span class="rq">' + right + '</span>' : '') +
        '</div>';
  };
  /* 简牍分区标题（替代 emoji 小标） */
  ui.sealH = function (label, cnt) {
    return '<div class="seal-h">' + label + (cnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</div>';
  };

  /* ⛔ v89.104（老板）：「统计这个菜单好像没啥用，删掉吧，将英雄，军务，任务放一起」
     —— 统计页（黄册 `statsHTML` + `lgSec`/`lgRow`）整体退役。
     为什么可以删：它当年搬走的"别处已有"三块（君主/府库/军民）现在**处处都有**，
     剩下几行汇总（疆域/在外/工役）在侧栏与各专用面板里都看得到 ——
     留一个"看一眼就没别的用"的菜单，只会让顶栏更长。 */

  ui.setRepFilter = function (v) {
    if (['all', 'win', 'lose', 'fav'].indexOf(v) < 0) return;
    ui._repFilter = v;
    ui._pages['rep'] = 1;
    ui.renderView('reports');
  };
  /* v89.89（D4）：收藏切换 —— 存进战报条目自身（s.reports[].fav，随档持久） */
  ui.toggleRepFav = function (rid) {
    var r = GAME.repByRid(rid);
    if (!r) return;
    r.fav = !r.fav;
    ui.toast(r.fav ? '已收藏该战报（「⭐ 收藏」筛选里可见）' : '已取消收藏');
    ui.renderView('reports');
  };
  ui.MSG_PER = 15;     /* 消息每页 */
  /* v89.107：战报每页 10 份。⚠️ 旧代码里 `ui.DOC_PER` **从来没定义过** ——
     `pageOf(..., ui.DOC_PER)` 悄悄回落到 PAGE_SIZE(12)，而 `n > undefined` 恒 false，
     于是**战报翻页条从来没登记过**：超过一页就只看得到头 12 份。本轮补上定义。 */
  ui.DOC_PER = 10;
  /* ============================================================
   * v89.155（老板 1）：公文**每页条数按可用高度算**（铺满到底，不再固定 15/10）
   * ------------------------------------------------------------
   * 老板原话：「公文的显示没界面底部到底，没铺满界面就分页了」。
   * ⛔ v89.157（老板 1「底部还是不到边」）**单位口径修正**：
   *   旧常量 127/104/28/24.65 是**视觉 px**（含 #app-scale 的 1.111 缩放），
   *   而 `vc.clientHeight` 是**布局 px**（不受 transform 影响）—— 两把尺混算，
   *   预算被低估 ≈11% → 每页少排 4 行、底部空 127px（实测）。
   * 实测（1600×1000 实机 · **布局值**，v89.157 重量）：
   *   #view-container 高 787px；标题+页签+chips 到消息区顶 = 114px；
   *   系统页消息行高 22.4px；
   *   战报/侦查行（.doc-bar）高 30.0px；底注（"共 N 条"）保留 19px。
   * → 系统页默认 = (787−114−19)/22.2 = 29 条（v90.92：原任务摘要区 ≈93px 已退役）（余 6px · 底注贴底 ≈5px，实测）；
   *   切到单主题标签（无摘要）= 29 条；战报页 = (787−114−19)/30 = 21 份（余 22px · 底距 26px）。
   * 口径：per = floor((视图高 − 头 − 底注) / 行高)，下限 8 / 上限 60；
   *   余量 < 4px 时让掉一行（GUARD_H）—— 防字体度量抖动撑出滚动条（目标：底注贴底 ≤20px）。
   *   拿不到布局（桩 / jsdom）→ 回落 MSG_PER / DOC_PER（旧值保留为兜底）。
   *   ⚠️ 头/摘要/底注是**实测量值** —— 改公文版式后重跑量测并更新（改动点集中在本段）。
   * ============================================================ */
  ui.DOC_HEAD_H = 114;      /* 标题 + 页签 + chips 到消息区顶（布局 px · 实测 113.7） */
  /* ⛔ v90.92：DOC_TASK_H（任务摘要区 93px）随任务系统退役。 */
  ui.DOC_FOOT_H = 19;       /* 底注"共 N 条"保留高度（布局 px）；.ui-page 底内边距 14px 会随之滚出 ——
                               视图页允许滚动（§30.3），且容器常驻 12px 滚动槽（scrollbar-gutter），观感不变 */
  ui.DOC_GUARD_H = 4;       /* 余量守卫：除不尽时的最小余量（不足则让掉一行，防抖动溢出） */
  ui.DOC_LINE_H = { sys: 22.2, war: 30.0, scout: 30.0 };   /* 行高（布局 px · 实机重量 22.18/30.0） */
  ui.docPerOf = function (kind) {
    var fb = (kind === 'sys') ? ui.MSG_PER : ui.DOC_PER;
    var vcH = 0;
    try {
      var vc = document.getElementById('view-container');
      if (vc && vc.clientHeight) vcH = vc.clientHeight;
    } catch (e) { vcH = 0; }
    if (!vcH) vcH = 787;      /* 标准画布（1440×900）的实测值兜底 */
    var avail = vcH - ui.DOC_HEAD_H - ui.DOC_FOOT_H;
    if (avail < 120) return fb;                       /* 布局异常（窗口畸形）→ 兜底 */
    var _lh = ui.DOC_LINE_H[kind] || 26;
    var _per = Math.floor(avail / _lh);
    /* v89.157：余量不足 GUARD 时让掉一行（防字体度量抖动把最后一行挤出滚动条） */
    if (_per > 1 && (avail - _per * _lh) < (ui.DOC_GUARD_H || 0)) _per--;
    return Math.max(8, Math.min(60, _per));
  };

  /* ============================================================
   * 公文（v89.107 重做）· 老板：「公文有几种报告类型，按军务那样整几个
   *   独立切换界面 —— 战报，侦查报告，警报警报，系统消息，等」
   * ------------------------------------------------------------
   * 结构 = 与军务同一套骨架（.march-tabs 页签 + 每页一套正文，互不堆叠）：
   *   战报 = s.reports 里的战报（全部/胜/败/收藏 筛选 + 分页）
   *   侦查 = s.reports 里 type==='scout' 的回报（v89.73 起的结构化工文）
   *   警报 = kind==='beacon' 的消息（犯境预警 / 击退或被破 / 防守计）
   *   任务 = kind==='task' 的消息（v90.92：可领取摘要随任务系统退役）
   *   系统 = kind==='sys' 的其余提示
   * 单一来源：类别表 `DATA.MSG_KINDS`（页签名/图标/**顺序**都由它派生 ——
   *   加一行就多一个页签）；消息类别在**发射点**声明（state.js 的 GAME.log）。
   * 退役并删净（不许两套并存）：频道条 msg-channels / setMsgChannel /
   *   msgLines / msgCount / msgPager / `msg-channel` 动作 / `_msgCh` 状态。
   *   旧的"系统·战报·任务·全部"四频道是**扁平流 + 按文本猜颜色**，
   *   与"分类各自成页"是两套结构，留一个必然互相打架。
   * ============================================================ */
  /* v89.153（老板 1/2）：默认落在「系统」页（页签顺序第一 —— 系统 / 战报 / 侦查）。 */
  ui._docTab = 'sys';
  ui.docTabOf = function (id) { return DATA.MSG_KIND_BY[id] || DATA.MSG_KINDS[0]; };
  /* 报告取用：战报 / 侦查是**报告类**（读 s.reports），其余是消息类（读 kind） */
  ui.docReportsOf = function (id) {
    return (GAME.state.reports || []).filter(function (r) {
      return id === 'scout' ? r.type === 'scout' : r.type !== 'scout';
    });
  };
  ui.docCountOf = function (id) {
    if (id === 'war' || id === 'scout') return ui.docReportsOf(id).length;
    if (id === 'sys') return GAME.msgFeedOf().length;      /* v89.153：三源合一（军情/任务/系统） */
    return GAME.msgsOf(id).length;
  };
  /* ⛔ v89.153（老板 2）：「将战报中的军情……整合到系统菜单下」——
     `ui.WAR_FLOW` / `ui.warFlowOf`（战报页下半段的军情流水）整条退役：
     军情（war 类消息）现在落在**系统页**（`GAME.msgFeedOf` 三源合一 + 「军情」小标签）。 */
  /* v89.116：**公文页签只列 doc !== false 的类别**（警报移出 —— 见 DATA.MSG_KINDS 注释）。
     唯一出口：页签渲染 / 页签切换校验 / 兜底全读它，不在别处写死类名。 */
  ui.docKinds = function () {
    return (DATA.MSG_KINDS || []).filter(function (k) { return k.doc !== false; });
  };
  ui.docTabHTML = function () {
    return '<div class="march-tabs doc-tabs">' + ui.docKinds().map(function (k) {
      return '<span class="mt' + (ui._docTab === k.id ? ' on' : '') + '" data-action="doc-tab" data-v="' +
        k.id + '" title="' + U.escape(k.desc) + '">' + k.icon + ' ' + k.name +
        '<b class="mt-n">' + ui.docCountOf(k.id) + '</b></span>';
    }).join('') + '</div>';
  };
  ui.setDocTab = function (v) {
    if (!DATA.MSG_KIND_BY[v]) return;
    /* v89.116：不在公文页签里的类别（如 beacon）不许切进去 —— 老档 `_docTab='beacon'
       会在渲染时落到"该板块已移出公文"的说明页；切换则直接拒绝（保持现状）。 */
    var _okTab = ui.docKinds().some(function (k) { return k.id === v; });
    if (!_okTab) { ui._docTab = 'sys'; ui._pages['docsys'] = 1; ui.renderView('reports'); return; }
    ui._docTab = v;
    ui._pages['doc' + v] = 1;                      /* 切页签回第 1 页（同 march-tab / bag-tab 口径） */
    ui.renderView('reports');
  };
  /* 一条报告行（战报页 / 侦查页共用；侦查不给收藏 —— 回报是"看过就够"的东西）
     v89.120：行上带 **data-rid**（稳定身份），不再带"渲染时刻的数组下标" ——
     列表在弹窗期间不重绘、而 reports 会被 unshift 位移，旧索引会指到别的报告
     （老板实测：点掠报弹出侦察报告）。取号走唯一出口 GAME.repRidOf。 */
  ui.docRepRowHTML = function (r, withFav) {
    var d = new Date(r.t);
    var rid = GAME.repRidOf(r);
    return '<div class="doc-bar' + (r.win ? ' win' : '') + '" data-action="view-report" data-rid="' + rid + '">' +
      '<span class="db-t">' + (r.underdog ? '🏅 ' : '') + U.escape(r.title) + '</span>' +
      '<span class="db-d">' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
      (withFav ? '<span class="db-fav' + (r.fav ? ' on' : '') + '" data-action="rep-fav" data-rid="' + rid +
        '" title="' + (r.fav ? '取消收藏' : '收藏该战报') + '">' + (r.fav ? '⭐' : '☆') + '</span>' : '') +
      '<span class="db-go">' + (withFav ? '查看 ›' : '展开 ›') + '</span></div>';
  };
  /* ============================================================
   * v89.153（老板 2）：系统页**小标签**（参考战报的 全部/胜/败）+ **主题色**
   * ------------------------------------------------------------
   * 标签 id = `GAME.msgSubOf(rec)` 的返回值（era/weather/build/gather/war/task/sys），
   * 界面三处（chips / 筛选 / 行色）全读它 —— 不另立映射表。
   * 颜色是**数据的属性**：主题色在 DATA.MSG_SUBS，大类色在 DATA.MSG_TAG_COLOR
   * （chips 与消息行都从这读；CSS 里不各写一份）。
   * ============================================================ */
  ui._msgTag = 'all';
  /* v89.157：标签序 = 军情 → 任务 → 人事 → 治理 → 建造 → 采集收获 → 市易 → 改元 → 天时 → 系统 */
  ui.MSG_TAG_ORDER = ['war', 'task', 'staff', 'admin', 'build', 'gather', 'trade', 'era', 'weather', 'sys'];
  ui.msgTagNameOf = function (tag) {
    if (DATA.MSG_SUB_BY[tag]) return DATA.MSG_SUB_BY[tag].name;
    return DATA.MSG_TAG_NAME[tag] || (DATA.MSG_KIND_BY[tag] ? DATA.MSG_KIND_BY[tag].name : tag);
  };
  ui.msgTagColorOf = function (tag) {
    if (DATA.MSG_SUB_BY[tag]) return DATA.MSG_SUB_BY[tag].color;
    return DATA.MSG_TAG_COLOR[tag] || 'var(--text-dim)';
  };
  /* 小标签行：**全部** + 有消息的标签（"只列有货的" —— 与宝物页分类同一口径） */
  ui.msgTagChipsHTML = function (feed) {
    var have = {};
    (feed || []).forEach(function (r) { have[GAME.msgSubOf(r)] = 1; });
    var list = ui.MSG_TAG_ORDER.filter(function (t) { return have[t]; });
    var h = '<div class="msg-channels">' +
      '<span class="ch' + (ui._msgTag === 'all' ? ' active' : '') +
        '" data-action="msg-tag" data-v="all">全部</span>';
    list.forEach(function (t) {
      h += '<span class="ch' + (ui._msgTag === t ? ' active' : '') + '" data-action="msg-tag" data-v="' + t +
        '" style="color:' + ui.msgTagColorOf(t) + '">' +
        U.escape(ui.msgTagIconOf(t) + ' ' + ui.msgTagNameOf(t)) + '</span>';
    });
    return h + '</div>';
  };
  /* 主题色 → rgba（徽章底色用；hex 一律 #rrggbb，来自 DATA.MSG_SUBS/TAG_COLOR）。
     var(--xxx) 之类解析失败 → 回落灰（不 throw）。 */
  ui.colorA = function (hex, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return 'rgba(168,167,175,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  ui.msgTagIconOf = function (tag) {
    if (DATA.MSG_SUB_BY[tag]) return DATA.MSG_SUB_BY[tag].icon || '';
    return (DATA.MSG_TAG_ICON || {})[tag] || '';
  };
  /* 一条系统页消息行（v89.157 老板 1：「各类消息没有有效区分，或区分度不强」）——
     三处同时上色：① 左侧 3px 主题色竖条 ② 主题徽章（图标 + 名）③ 行文本（沿用 v89.153 字体色）。 */
  ui.msgLineHTML = function (l) {
    var d = new Date(l.t);
    var tag = GAME.msgSubOf(l);
    var c = ui.msgTagColorOf(tag);
    return '<div class="bb-line bb-sub" style="color:' + c + ';border-left-color:' + c + ';">' +
      '<span class="bl-t">' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
      '<span class="ml-tag" style="color:' + c + ';background:' + ui.colorA(c, 0.12) +
        ';border-color:' + ui.colorA(c, 0.45) + ';">' +
        U.escape(ui.msgTagIconOf(tag) + ' ' + ui.msgTagNameOf(tag)) + '</span>' +
      U.escape(l.msg) +
      /* v129：写入端已把连续重复合并（见 GAME.log），这里补一个可读的计数 */
      ((l.n | 0) > 1 ? ' <span style="color:var(--text-dim);font-size:var(--fs-cap);">×' + (l.n | 0) + '</span>' : '') +
      '</div>';
  };
  ui.setMsgTag = function (v) {
    ui._msgTag = v || 'all';
    ui._pages['docsys'] = 1;                    /* 切标签回第 1 页（同页签/背包口径） */
    ui.renderView('reports');
  };
  /* ⛔ v90.92 退役：任务可领取摘要（ui.msgTaskSummaryHTML）随任务系统删除。 */
  /* 消息流水行（警报 / 侦查页用）：一行 = 时刻 + 文本，按类别上色
     （沿用 .bb-line 既有配色；时刻只到分 —— 一屏 15 行要扫得动） */
  ui.docLinesHTML = function (id) {
    var list = GAME.msgsOf(id);
    if (!list.length) return '';
    var pg = ui.pageOf('doc' + id, list.length, ui.MSG_PER);
    return '<div class="msg-log" id="msg-log">' + list.slice(pg.from, pg.to).map(function (l) {
      var d = new Date(l.t);
      return '<div class="bb-line ' + id + '"><span class="bl-t">' + U.pad(d.getHours()) + ':' +
        U.pad(d.getMinutes()) + '</span>' + U.escape(l.msg) + '</div>';
    }).join('') + '</div>';
  };
  /* 各页正文（**纯内容**：主循环每秒刷新的 renderLog 也走这里；
     翻页条另由 docPagerReg 在整页渲染时登记一次 —— 每秒登记会把底栏刷爆） */
  ui.docBodyHTML = function (id) {
    var K = ui.docTabOf(id);
    /* v89.116：不进公文的类别（警报）—— 直调（老档 _docTab 残留 / 测试）时给一句指引，
       而不是照旧渲染一套警报流水（那正是老板要撤掉的那块）。 */
    if (K && K.doc === false) {
      /* v89.153：task 并入系统页；beacon 另有落点（军务 · 警报）—— 按类别给不同指引 */
      if (K.id === 'task') {
        return '<div class="q-empty">📜 「任务」类消息已并入「系统」页 ——' +
          '点上方「系统」页签可按「任务」小标签筛选。</div>';
      }
      return '<div class="q-empty">🔥 「' + U.escape(K.name) + '」已移出公文 —— 预警与来袭流水在' +
        '「军务 · 警报」页（点上方页签可回到公文其它板块）。</div>';
    }
    /* ---- 战报：**只列战报**（报告 · 筛选 + 分页）——军情流水 v89.153 起在「系统」页 ---- */
    if (id === 'war') {
      var rf = ui._repFilter;
      if (['all', 'win', 'lose', 'fav'].indexOf(rf) < 0) rf = 'all';
      var allRep = ui.docReportsOf('war');
      var chips = [['all', '全部'], ['win', '🏆 胜'], ['lose', '⚔️ 败'], ['fav', '⭐ 收藏']]
        .map(function (c) {
          return '<span class="ch' + (rf === c[0] ? ' active' : '') + '" data-action="rep-filter" data-v="' +
            c[0] + '">' + c[1] + '</span>';
        }).join('');
      if (!allRep.length) {
        return '<div class="q-empty">尚无战报 —— 出征 / 攻城 / 防守的战果都会记在这里' +
          '（军事流水见「系统 · 军情」）。</div>';
      }
      var hit = allRep.filter(function (r) {
        if (rf === 'win' && !r.win) return false;
        if (rf === 'lose' && r.win) return false;
        if (rf === 'fav' && !r.fav) return false;
        return true;
      });
      var pg = ui.pageOf('docwar', hit.length, ui.docPerOf('war'));
      var rows = hit.slice(pg.from, pg.to).map(function (r) {
        return ui.docRepRowHTML(r, true);      /* v89.120：身份走 rid，不再传数组下标 */
      }).join('');
      return '<div class="msg-channels">' + chips + '</div>' +
        (hit.length ? rows : '<div class="q-empty">此筛选下没有战报。</div>') +
        '<div class="ui-sub">共 ' + allRep.length + ' 份战报 · 收藏 ' +
          allRep.filter(function (r) { return r.fav; }).length + ' 份</div>';
    }
    /* ---- 侦查：回报列表（结构化工文，点开看分层情报） ---- */
    if (id === 'scout') {
      var sc = ui.docReportsOf('scout');
      var flow = ui.docLinesHTML('scout');        /* 当前无发射点，留口：将来有侦查流水也落这页 */
      if (!sc.length && !flow) return '<div class="q-empty">尚无侦查回报 —— 派侦察单元探一次，回报会落在这里。</div>';
      var rows = '', prev = 0;
      var pg2 = ui.pageOf('docscout', sc.length, ui.docPerOf('scout'));
      sc.slice(pg2.from, pg2.to).forEach(function (r) { rows += ui.docRepRowHTML(r, false); });
      return rows + (sc.length ? '<div class="ui-sub">共 ' + sc.length + ' 份回报 · 点一行展开分层情报</div>' : '') + flow;
    }
    /* ---- 系统：军情 / 任务 / 系统**三源合一** + 小标签筛选（v89.153 老板 2） ---- */
    if (id === 'sys') {
      var feed = GAME.msgFeedOf();
      var tag = ui._msgTag;
      if (tag !== 'all' && !feed.some(function (r) { return GAME.msgSubOf(r) === tag; })) {
        tag = 'all'; ui._msgTag = 'all';          /* 标签失效（消息被滚动清掉）→ 回落"全部" */
      }
      var hit = (tag === 'all') ? feed
        : feed.filter(function (r) { return GAME.msgSubOf(r) === tag; });
      var h = ui.msgTagChipsHTML(feed);
      if (!feed.length) {
        return h + '<div class="q-empty">暂无消息 —— 军情 / 任务 / 治理与其余提示都会汇总到这里。</div>';
      }
      var pg = ui.pageOf('docsys', hit.length, ui.docPerOf('sys'));
      h += hit.length
        ? '<div class="msg-log" id="msg-feed">' + hit.slice(pg.from, pg.to).map(ui.msgLineHTML).join('') + '</div>'
        : '<div class="q-empty">此标签下暂无消息。</div>';
      h += hit.length ? '<div class="ui-sub">共 ' + hit.length + ' 条（军情 / 任务 / 系统三源合一 · 按最近 ' +
        GAME.msgDays() + ' 游戏天滚动保留）</div>' : '';
      return h;
    }
    /* ---- 警报等其余消息类：流水（直调兜底） ---- */
    var rows2 = ui.docLinesHTML(id);
    if (!rows2) {
      return '<div class="q-empty">' + (id === 'beacon'
        ? '警报未起 —— 敌军来犯前会在这里预警（瞭望塔等级越高，预警越早）。'
        : '暂无系统提示。') + '</div>';
    }
    return rows2;
  };
  /* 翻页条登记：**整页渲染时调一次**（不能进 docBodyHTML —— 主循环每秒会重复登记） */
  ui.docPagerReg = function (id) {
    var total, per;
    /* v89.155（老板 1）：每页条数与正文同源（docPerOf）—— 翻页条与列表不许两把尺 */
    if (id === 'war' || id === 'scout') { total = ui.docCountOf(id); per = ui.docPerOf(id); }
    else { total = ui.docCountOf(id); per = ui.docPerOf('sys'); }   /* v89.153：task 页退役，系统页照常分页 */
    if (total > per) ui.pagerHTML('doc' + id, total, per);
    return '';
  };
  ui.reportsHTML = function () {
    var id = ui._docTab, K = ui.docTabOf(id);
    /* v29（需求 6）：公文**只留报告与消息** —— 队列整段撤销：
       建造 / 募兵 → 政务厅弹窗「在办事项」；行军 → 顶栏「行军」；自动 → 顶栏「自动」。
       v39（需求 4）：不套卷轴壳 —— 内容只有几块，套壳就成了"框里装框"。 */
    return '<div class="ui-page">' +
      '<div class="gold-heading">📜 公文 · ' + K.name +
        ui.help(K.desc + '\n三类独立成页（系统 / 战报 / 侦查），顶部页签切换。\n' +
          '系统页按小标签筛选：军情 / 任务 / 人事 / 治理 / 建造 / 采集收获 / 市易 / 改元 / 天时（只列有消息的）。\n' +
          '战报支持「胜 / 败 / 收藏」筛选与分页。') + '</div>' +
      ui.docTabHTML() +
      '<div id="doc-body">' + ui.docBodyHTML(id) + '</div>' +
      ui.docPagerReg(id) +
      '</div>';
  };
  /* ------------------------------------------------------------
   * 战报详情（v27 · 需求 4/5）
   * ------------------------------------------------------------
   *   ① 战况正文（含兵种损耗）
   *   ② **战斗场景** —— 文字网格：每回合一行条带，左边我军、右边敌军，
   *      中间的点就是两军之间的间距（缩到没有就接上了）
   *   ③ 回合纪要表 —— 逐回合双方兵力与间距
   *   ④ 兵种损耗表 —— 初始 / 损失 / 剩余（需求 4 的正面回答）
   * ------------------------------------------------------------ */
  /* ============================================================
   * v89.102（老板需求 2）：战报**沙盘**（固定沙盘 · 逐兵种逐帧）
   * ------------------------------------------------------------
   * 老板原话：「战斗报告的界面大一点，分回合回放创建一个固定沙盘，界面为战场，
   *   左侧为我方各兵种及数量，竖排，逐个兵种以一小图标显示（就兵种图标）
   *   附带动作和目标选项框。右侧则为敌军兵种……回放精细度更高一点，
   *   每个兵种的移动和攻击作为一帧……如此直至一方兵员消耗完毕」。
   *
   * 格局（max 档 = 铺满视口；**不做弹窗内下拉**——泳道高度按行数自适应）：
   *   ┌ 顶栏：回合 / 间距 / 帧号 / 双方兵力 / 箭塔 ─────────────────┐
   *   │ 我方竖排（图标·兵力·动作三选·目标框）│ 沙盘 │ 敌军竖排      │
   *   └ 帧流（逐帧一行）──────────────────────────────────────────┘
   * · 沙盘 = **距离轴**：0 在左（我军出发线）→ 纵深在右（敌阵）。
   *   每支部队一条**固定泳道**，令牌只在自己那条泳道上左右移动 ——
   *   这就是"固定沙盘"：版式不随帧重排，只有令牌在动。
   * · 一帧 = 一次行动：move/retreat 走位、attack/counter/wall 结算杀伤、
   *   tower 拆塔。帧序列由**同一把引擎**重跑得出（见 battle.js sandboxOf）。
   * · 动作三选与目标框：**回放态**显示该兵种当回合的实际动作/目标（只读）；
   *   **推演态**可改 —— 改完点「完成回合」，引擎按新指令结算并出下一帧，
   *   直至一方兵员耗尽（这就是老板说的"直至一方兵员消耗完毕"）。
   * ============================================================ */
  ui._sd = null;                 /* { ri, rep, sb, i, cur, timer, mode, sim } */
  ui.SD_STANCE = { advance: '前进', hold: '驻守', retreat: '后退' };
  ui.sdTroopName = function (sb, idx) {
    var id = (idx >= 0) ? sb.ids[idx] : '';
    return (DATA.TROOPS[id] && DATA.TROOPS[id].name) || id || '';
  };

  /* 初始战场态（每个兵团一份可变副本；adv = 动作行位的推进量）
     v89.104：带 **er（有效射程）** —— 接触判定按双方位移（间距 ≤ 双方最前部队射程），
     不再用"有没有开过火"的锁（老板：「接触判定按双方位移」）。 */
  ui.sdStateInit = function (sb) {
    function cp(u) {
      /* v89.176：补 `spd`（接敌预测的推进预演要读）与 `start`（损失读数）——
         与 snapUnits/unitsInit 的字段清单对齐（v89.151 手写清单漏字段的同族教训：
         打包函数漏一个字段 = 一个功能静默失真）。 */
      return { id: u.id, name: u.name, count: u.count, adv: u.adv, spd: u.spd || 0,
        start: (u.start != null ? u.start : u.count),
        er: (u.er != null ? u.er : (u.range || 0)), range: u.range || 0,
        stance: u.stance || 'advance', target: u.target || '', act: '', lastTgt: '' };
    }
    return { atk: (sb.init.atk || []).map(cp), def: (sb.init.def || []).map(cp),
      towers: sb.towers || 0, round: 0 };
  };
  /* 应用一帧（就地改 st；返回该帧的施动者） */
  ui.sdApply = function (st, sb, f) {
    var mine = f[1] === 0;
    var own = mine ? st.atk : st.def, foe = mine ? st.def : st.atk;
    var uid = (f[2] >= 0) ? sb.ids[f[2]] : '', tid = (f[4] >= 0) ? sb.ids[f[4]] : '';
    var k = f[3], v1 = f[5], v2 = f[6], i, u = null, t = null;
    for (i = 0; i < own.length; i++) if (own[i].id === uid) u = own[i];
    for (i = 0; i < foe.length; i++) if (foe[i].id === tid) t = foe[i];
    if (k === 'm' && u) { u.adv += v1; u.stance = 'advance'; }
    else if (k === 'r' && u) { u.adv -= v1; u.stance = 'retreat'; }
    else if ((k === 'a' || k === 'c' || k === 'w') && t) {
      t.count = Math.max(0, t.count - v1);
      t.hit = k === 'c' ? 'counter' : 'attack';
    } else if (k === 't') { st.towers = v2; }
    if (u) { u.act = k; u.actVal = v1; if (t && (k === 'a')) u.lastTgt = t.id; }
    st.round = f[0] || st.round;
    return u;
  };
  ui.sdStateAt = function (sb, k) {
    var st = ui.sdStateInit(sb);
    for (var i = 0; i < k && i < sb.frames.length; i++) ui.sdApply(st, sb, sb.frames[i]);
    return st;
  };
  /* 快照（推演态）→ 战场态；acts = 该回合事件（标出"谁动了"） */
  ui.sdStateFromSnap = function (snap, sb, acts) {
    var st = { atk: [], def: [], towers: snap.towers ? snap.towers.left : 0,
      round: snap.round || 0 };
    function cp(u) {
      /* v89.176：补 `spd`（接敌预测的推进预演要读）与 `start`（损失读数）——
         与 snapUnits/unitsInit 的字段清单对齐（v89.151 手写清单漏字段的同族教训：
         打包函数漏一个字段 = 一个功能静默失真）。 */
      return { id: u.id, name: u.name, count: u.count, adv: u.adv, spd: u.spd || 0,
        start: (u.start != null ? u.start : u.count),
        er: (u.er != null ? u.er : (u.range || 0)), range: u.range || 0,
        stance: u.stance || 'advance', target: u.target || '', act: '', lastTgt: '' };
    }
    st.atk = (snap.atk || []).map(cp);
    st.def = (snap.def || []).map(cp);
    (acts || []).forEach(function (e) {
      var list = (e.side === 'atk') ? st.atk : st.def;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === e.id) {
          list[i].act = ({ move: 'm', retreat: 'r', attack: 'a', counter: 'c', tower: 't', wall: 'w' })[e.kind] || '';
          list[i].actVal = Math.round(e.step || e.kill || e.destroy || 0);
          if (e.kind === 'attack') list[i].lastTgt = e.targetId || '';
        }
      }
    });
    return st;
  };

  /* 一帧 → 一行文字（帧流用） */
  ui.sdLine = function (sb, f) {
    if (!f) return '';
    var D = DATA.TROOPS || {};
    var nm = ui.sdTroopName(sb, f[2]), tn = ui.sdTroopName(sb, f[4]);
    /* v89.116：`sdSideName` 现在是 (sb, side) —— 这里必须把 sb 传进去，
       否则视角是空的：守城仗里"我方"会被叫成"敌军"。 */
    var side = ui.sdSideName(sb, f[1] === 0 ? 'atk' : 'def'), k = f[3], v1 = f[5], v2 = f[6];
    if (k === 'm') return '🚶 第' + f[0] + '回合 ' + side + ' ' + nm + ' 前进 ' + U.numText(v1, 0) + '（最近距离 ' + U.numText(v2, 0) + '）';
    if (k === 'r') return '↩️ 第' + f[0] + '回合 ' + side + ' ' + nm + ' 后退 ' + U.numText(v1, 0) + '（最近距离 ' + U.numText(v2, 0) + '）';
    if (k === 'a') return '⚔️ 第' + f[0] + '回合 ' + side + ' ' + nm + ' → ' + tn + '　杀伤 ' + U.numText(v1, 0);
    if (k === 'c') return '🛡️ 第' + f[0] + '回合 ' + side + ' ' + nm + ' 反击 → ' + tn + '　杀伤 ' + U.numText(v1, 0);
    if (k === 't') return '🏯 第' + f[0] + '回合 ' + side + ' ' + nm + ' 拆箭塔 ' + U.numText(v1, 0) + ' 座（余 ' + U.numText(v2, 0) + '）';
    /* 城头火力打的是**攻方**（墙在守方那一侧）→ 文字按视角给 */
    if (k === 'w') return '🏯 第' + f[0] + '回合 城头火力 → ' + (tn || ui.sdSideName(sb, 'atk')) + '　杀伤 ' + U.numText(v1, 0);
    return '';
  };

  /* 令牌在沙盘上的横向位置（%）：与本方出发线同一条映射（唯一出口 btPosPct） */
  ui.sdPct = function (side, adv, D) { return ui.btPosPct(side, adv, D); };

  /* 前线画在"最前部队**前方**"多少 %（纯画面偏移，不参与任何计算） */
  ui.SD_FL_AHEAD = 2.0;

  /* 军阵泳道（v89.103）：我方占偶数道、敌方占奇数道 —— **交错**。
     为什么交错：两军现在共用一条距离轴，交战时会走到同一 x，
     若同一泳道就会叠在一起（两个兵牌互相遮住）；交错之后
     "我方第 i 队 vs 敌方第 i 队"恰好上下相邻，接触时看得见"贴上了"。 */
  ui.sdLaneOf = function (side, i) { return i * 2 + (side === 'atk' ? 0 : 1); };
  ui.sdLanesOf = function (st) { return 2 * Math.max(st.atk.length, st.def.length); };

  /* 前线几何（唯一出口在引擎：GAME.tactic.frontsOf）——
     沙盘只是把它画出来，不在界面里另算一套。 */
  ui.sdFrontsOf = function (st, sb) {
    return GAME.tactic.frontsOf(st.atk, st.def, sb.field || 1);
  };

  /* 三条线（我军前线 / 敌军前线 / 接触线）—— 位置与可见性都由 frontsOf 决定：
     · 未接触：两条虚线各在本军最前部队前方；
     · 已接触：两条合成**一条实线**（接触线，画在两线中点）；
     · 一方被歼：线推到该方出发线（被攻入大军腹地），战斗结束。 */
  /* ============================================================
   * v89.176（老板「公文战报里的沙盘与战场沙盘进行一下统一化」）：
   * **战场三线**的唯一出口 —— 实时战场（bt-field）与战报沙盘（sd-field）
   * 共用同一份渲染（同一把 GAME.tactic.frontsOf 口径）：
   *   · 未接触：两条虚线各在本军最前部队前方；
   *   · 已接触：合成一条实线（接触线，画在两线中点）；
   *   · 一方被歼：线推到该方出发线（"被攻入腹地"）。
   * `nameOf(side)` 给称谓（战场固定"我军/敌军"；沙盘随视角）；
   * `pfx` = id 前缀（'sd-fl' / 'bt-fl' —— 两个弹窗各自独立，不抢 id）。
   * 入参 units 只须 {count, adv, er}（快照与沙盘态都满足）。
   * ============================================================ */
  ui.fieldLinesHTML = function (nameOf, atkUnits, defUnits, D, pfx) {
    var fr = GAME.tactic.frontsOf(atkUnits || [], defUnits || [], D || 1);
    var contact = fr.contact || !!fr.broke;
    var aPct = um01(ui.btPosPct('atk', fr.aFront, D) + ui.SD_FL_AHEAD);
    var dPct = um01(ui.btPosPct('def', fr.dFront, D) - ui.SD_FL_AHEAD);
    var cPct = fr.broke === 'atk' ? 4 : (fr.broke === 'def' ? 96 : um01(ui.sdAxisPct(fr.mid, D)));
    function el(cls, id, pct, label, show) {
      return '<div class="sd-fl ' + cls + (show ? '' : ' hide') + '" id="' + id + '"' +
        ' style="left:' + (Math.round(pct * 10) / 10) + '%;"><span>' + label + '</span></div>';
    }
    return el('atk', pfx + '-a', aPct, nameOf('atk') + '前线', !contact)
      + el('def', pfx + '-d', dPct, nameOf('def') + '前线', !contact)
      + el('hit' + (fr.broke ? ' broke' : ''), pfx + '-c', cPct,
        fr.broke ? nameOf(fr.broke) + '被攻入腹地' : '接触线', contact);
  };
  /* v89.176：**战场标尺**的唯一出口（沙盘/战场共用）——两端出发线 + 纵深读数 */
  ui.fieldScaleHTML = function (nameOf, D) {
    return '<div class="sd-scale"><span>' + nameOf('atk') + '出发线</span><span>纵深 '
      + U.numText(D || 0, 0) + '</span><span>' + nameOf('def') + '出发线</span></div>';
  };
  ui.sdLineHTML = function (st, sb) {
    /* v89.176：转发到共享出口（输出与改前逐字一致 —— 仅供既有断言/调用方兼容） */
    return ui.fieldLinesHTML(function (sd2) { return ui.sdSideName(sb, sd2); },
      st.atk, st.def, sb.field || 1, 'sd-fl');
  };
  function um01(x) { return Math.max(1, Math.min(99, x)); }

  /* 沙盘本体：泳道 + 双方令牌（绝对定位，left 过渡即位移演出） */
  ui.sdFieldHTML = function (st, sb, lane) {
    var D = sb.field || 1;
    var n = Math.max(st.atk.length, st.def.length);
    var lenes = '', toks = '';
    /* v89.192（老板 4 · 沙盘铺满）：field 由"内联固定高"改 **min-height**（拉伸吃满 board），
       泳道/令牌的 top 相应加"内容区垂直居中"偏移 —— 场高 = 内容高时偏移为 0（旧观感不变），
       场被拉高后泳道整体居中（不挤在顶部、下面留白）。偏移走 CSS calc + --sd-ch（渲染时给）。 */
    var _yoff = 'calc((100% - var(--sd-ch)) / 2)';
    for (var i = 0; i < n; i++) {
      /* 一条"对阵带" = 我方第 i 队 + 敌方第 i 队（两条泳道），带底一条虚线 */
      lenes += '<div class="sd-lane" style="top:calc(' + _yoff + ' + ' + ((i + 1) * 2 * lane) + 'px);"></div>';
    }
    /* v89.176：接敌角标（与战场同源：contactForecast）——下一回合将交手的令牌亮圈 */
    var sdInc = {};
    try {
      var fcSd = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast(st.atk, st.def, D) : null;
      if (fcSd) sdInc = fcSd.engage || {};
    } catch (e) { sdInc = {}; }
    function tok(u, side, i) {
      return '<div class="sd-tok ' + side + (sdInc[side + '|' + u.id] ? ' incoming' : '') + '" id="sd-k-' + side + '-' + u.id + '"' +
        ' data-bside="' + side + '" data-troop="' + u.id + '"' +
        ' style="top:calc(' + _yoff + ' + ' + (ui.sdLaneOf(side, i) * lane + 2) + 'px);left:' + ui.sdPct(side, u.adv, D) + '%;">' +
        '<span class="sd-tico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<b id="sd-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b></div>';
    }
    st.atk.forEach(function (u, i) { toks += tok(u, 'atk', i); });
    st.def.forEach(function (u, i) { toks += tok(u, 'def', i); });
    /* 底图：地形材质铺满（AI 位图，缺图则纯渐变兜底）；攻城时右缘画围墙 */
    var tex = '';
    if (GAME.icons.bitmapSrc) {
      var src = GAME.icons.bitmapSrc('terrain', 'plain');
      if (sb.place && sb.place.kind === 'wild' && sb.place.terrain) {
        src = GAME.icons.bitmapSrc('terrain', sb.place.terrain) || src;
      }
      if (src) tex = ' style="background-image:url(' + src + ')"';
    }
    /* v89.116（老板「增加右侧（我方守城）的围墙示意」）：
       围墙画在**守方那一侧**（共享轴的右端）：
         · 守城仗（ourSide='def'）：那是我方围墙 —— 带上等级文字；
         · 攻城仗（ourSide='atk'）：那是敌方围墙，照旧只画工事。
       围墙**有没有**由 `sb.wall`（守城仗必给）或箭塔数决定 —— 0 级墙 + 0 塔的空城不画。 */
    var hasWall = !!(sb.wall ? (sb.wall.lv > 0 || sb.wall.towers > 0) : (sb.towers > 0));
    var wallImg = (hasWall && GAME.icons.bitmapSrc && GAME.icons.bitmapSrc('building', 'chengqiang'))
      ? '<img class="sd-wall" src="' + GAME.icons.bitmapSrc('building', 'chengqiang') + '" alt="">' : '';
    var wallLv = (sb.wall && sb.wall.lv) || 0;
    var wallTxt = hasWall
      ? '<div class="sd-castle">🧱 ' + (ui.sdOurSide(sb) === 'def' ? '我方围墙' : '敌方围墙')
          + (wallLv > 0 ? ' Lv' + wallLv : '')
          + (sb.towers > 0 ? '　🏯 箭塔 <b id="sd-tower">' + st.towers + '</b> / ' + sb.towers : '')
        + '</div>' + wallImg : '';
    return '<div class="sd-field" id="sd-field" style="min-height:' + (n * 2 * lane) + 'px;--sd-ch:' + (n * 2 * lane) + 'px;">' +
      '<div class="sd-ground"' + tex + '></div>' + lenes + toks + ui.sdLineHTML(st, sb) + wallTxt +
      ui.fieldScaleHTML(function (sd2) { return ui.sdSideName(sb, sd2); }, D) +
      '</div>';
  };
  /* 泳道高度：按**总泳道数**（双方交错后 = 2 × 大的一方）自适应 ——
     保证「弹窗内不做下拉」这条硬规矩。
     v89.192（沙盘铺满）：总高上限 420 → **360** —— 铺满后 board 实测 369px
     （弹窗 884 − m-head − m-sub − sd-foot − sd-log 40%），360 让「双方各 8 队」
     （16 泳道）也装得下（16×22=352 ≤ 369）；再多的极端载荷由 .sd-field
     的 overflow:hidden 兜底（同战场极端载荷让步原则）。 */
  ui.sdLaneH = function (n) {
    var maxH = 360;
    return Math.max(20, Math.min(34, Math.floor(maxH / Math.max(1, n))));
  };

  /* ============================================================
   * v89.116（老板需求 4）：**沙盘视角** —— "哪一边是我"
   * ------------------------------------------------------------
   * 出征口径：我方 = atk（左）。来袭 / 守城口径：我方 = def（右，围墙那一侧）。
   * 一个字段决定四件事：标签（我军/敌军）、可操作侧、围墙画哪边、列宽配比。
   * 唯一出口 = 本函数组，界面各处不许再写死 'atk'。
   * ============================================================ */
  ui.sdOurSide = function (sb) { return (sb && sb.ourSide === 'def') ? 'def' : 'atk'; };
  ui.sdIsMine = function (sb, side) { return ui.sdOurSide(sb) === side; };
  /* 显示名：视角中性（"我军"永远指玩家那一侧） */
  ui.sdSideName = function (sb, side) { return ui.sdIsMine(sb, side) ? '我军' : '敌军'; };
  /* 沙盘列宽：可操作的一侧给宽列（左宽右窄 / 左窄右宽，随视角翻） */
  ui.sdBoardCols = function (sb) {
    return ui.sdOurSide(sb) === 'def' ? '190px 1fr 306px' : '306px 1fr 190px';
  };

  /* 侧栏（我方 = 可操作；敌军 = 只读） */
  ui.sdRosterHTML = function (st, sb, side, lane) {
    var list = (side === 'atk') ? st.atk : st.def;
    var foe = (side === 'atk') ? st.def : st.atk;
    var mine = ui.sdIsMine(sb, side);
    var rows = list.map(function (u) {
      var sts = '';
      if (mine) {
        sts = ['advance', 'hold', 'retreat'].map(function (s) {
          return '<span class="sd-chip' + (u.stance === s ? ' on' : '') + '" data-action="sd-stance"' +
            ' data-t="' + u.id + '" data-s="' + s + '">' + ui.SD_STANCE[s] + '</span>';
        }).join('');
      } else {
        sts = '<span class="sd-chip on ro">' + (ui.SD_STANCE[u.stance] || u.stance) + '</span>';
      }
      /* v89.149（老板 4）：与战场同一口径 —— 同兵种（默认）/ 任意 / 兵种名 / 城防箭塔，
         不写"目标："前缀；默认值照样由**引擎**给（unitsOf），这里只回显。 */
      var opts = '<option value="' + u.id + '"' + (u.target === u.id ? ' selected' : '') + '>同兵种</option>'
        + '<option value=""' + (!u.target ? ' selected' : '') + '>任意</option>';
      foe.forEach(function (d) {
        if (d.id === u.id) return;
        opts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>'
          + U.escape(d.name) + '</option>';
      });
      if (st.towers > 0) {
        opts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '') +
          '>城防箭塔</option>';
      }
      return '<div class="sd-row" data-row="' + side + '-' + u.id + '">' +
        '<span class="sd-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<b class="sd-cnt" id="sd-c-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
        '<span class="sd-chips">' + sts + '</span>' +
        (mine
          /* id 实名在册（sd-t- 前缀，与战场界面同一命名习惯） */
          ? '<select class="sd-sel" id="sd-t-' + u.id + '" data-action="sd-target" data-t="' + u.id + '">' + opts + '</select>'
          /* v89.116：敌军侧也给一行只读的"目标"读数 —— 此前整列不显示目标，
             玩家看不出"它到底在打谁" */
          : '<span class="sd-sel ro">' + ui.btTargetLabelOf(u, foe) + '</span>') +
        '</div>';
    }).join('');
    return '<div class="sd-col ' + (mine ? 'sd-mine' : 'sd-foe') + '" style="--lane:' + lane + 'px;">' + rows + '</div>';
  };

;

  ui.sdHTML = function () {
    var sd = ui._sd, sb = sd.sb, st = sd.cur;
    var lane = ui.sdLaneH(ui.sdLanesOf(st));
    var fr = ui.sdFrontsOf(st, sb);
    return '<div class="sd-top">' +
        '<span>第 <b id="sd-round">' + (st.round || 0) + '</b> / ' + sb.maxRounds + ' 回合</span>' +
        /* v89.149（老板 7）：与战场顶栏同一口径「最近距离 / 全局」 */
        '<span>最近距离 <b id="sd-gap">' + U.numText(Math.round(fr.gap), 0) + '</b> / 全局 <b>'
          + U.numText(Math.round(sb.field || 0), 0) + '</b></span>' +
        '<span id="sd-phase">' + ui.sdPhaseText(fr, sb) + '</span>' +
        '<span>帧 <b id="sd-pos">' + sd.i + '</b> / ' + sb.frames.length + '</span>' +
        '<span id="sd-side-txt">' + ui.sdSideTotals(st, sb) + '</span>' +
        /* v89.176（老板「减少伤亡」）：沙盘**损失读数**（与战场同源口径：start↔count） */
        '<span id="sd-loss">' + ui.sdLossHTML(st, sb) + '</span>' +
        '<span class="sd-hint" id="sd-hint">' + (sd.mode === 'sim'
          ? '推演：改动作/目标后点「完成回合」' : '回放：逐帧看那一仗怎么打的') + '</span>' +
      '</div>' +
      '<div class="sd-board" id="sd-board" style="grid-template-columns:' + ui.sdBoardCols(sb) + ';">' +
        ui.sdRosterHTML(st, sb, 'atk', lane) +
        ui.sdFieldHTML(st, sb, lane) +
        ui.sdRosterHTML(st, sb, 'def', lane) +
      '</div>' +
      '<div class="sd-log" id="sd-log"></div>';
  };
  /* 战况一句话（顶部）：接敌中 / 两军接触 / 被攻入腹地（战斗结束）
     v89.116：口径按**视角**给（守城仗里"被攻入腹地"的是我方守军） */
  ui.sdPhaseText = function (fr, sb) {
    if (fr.broke) return '💥 ' + ui.sdSideName(sb, fr.broke) + '被攻入腹地';
    if (fr.contact) return '⚔ 两军接触中';
    return '➤ 接敌中';
  };
  /* v89.176：沙盘损失读数（我方/敌方损失 %）——无 start 的旧沙盘态 → 空串不渲染 */
  ui.sdLossHTML = function (st, sb) {
    function calc(list) {
      var s0 = 0, s1 = 0, has = false;
      (list || []).forEach(function (u) {
        if (u.start == null) return;
        has = true; s0 += u.start || 0; s1 += u.count || 0;
      });
      return (has && s0 > 0) ? Math.round((s0 - s1) / s0 * 100) : null;
    }
    var aP = calc(st.atk), dP = calc(st.def);
    if (aP == null && dP == null) return '';
    var mineA = ui.sdOurSide(sb) === 'atk';
    return '· 损失 我 <b id="sd-loss-m">' + ((mineA ? aP : dP) == null ? 0 : (mineA ? aP : dP))
      + '%</b> / 敌 <b id="sd-loss-f">' + ((mineA ? dP : aP) == null ? 0 : (mineA ? dP : aP)) + '%</b>';
  };
  ui.sdSideTotals = function (st, sb) {
    var a = 0, d = 0;
    st.atk.forEach(function (u) { a += u.count; });
    st.def.forEach(function (u) { d += u.count; });
    var mine = ui.sdOurSide(sb) === 'atk' ? a : d;
    var foe = ui.sdOurSide(sb) === 'atk' ? d : a;
    return '我 <b id="sd-ta">' + U.fmt(mine) + '</b>　敌 <b id="sd-td">' + U.fmt(foe) + '</b>';
  };

  /* ---- 底部动态操作条（帧导航 + 推演切换；放在正文区内，随模式重绘） ---- */
  ui.sdFootHTML = function () {
    var sd = ui._sd, sb = sd.sb;
    var sim = sd.mode === 'sim';
    return '<div class="sd-foot" id="sd-foot-dyn">' +
      '<button class="btn sm" data-action="sd-first">⏮ 首帧</button>' +
      '<button class="btn sm" data-action="sd-prev">◀ 上一帧</button>' +
      '<button class="btn sm gold" id="sd-play" data-action="sd-play"' + (sim ? ' disabled' : '') + '>▶ 播放</button>' +
      '<button class="btn sm" data-action="sd-next">下一帧 ▶</button>' +
      '<input type="range" id="sd-range" class="rp-range" min="0" max="' + sb.frames.length + '" value="' + sd.i + '" step="1">' +
      '<span class="rp-pos" id="sd-slider-pos">' + sd.i + ' / ' + sb.frames.length + '</span>' +
      /* v89.207（快赢④）：沙盘回放共享战斗增速档（与实时战场同一状态/同一出口） */
      (sim ? '' : ui.btSpdHTML()) +
      (sim
        ? '<button class="btn sm gold" data-action="sd-done">✅ 完成回合</button>' +
          '<button class="btn sm" data-action="sd-sim-exit">↩ 回到史实回放</button>'
        : '<button class="btn sm gold" data-action="sd-sim"' + (sb.verify ? '' : ' disabled') + '>🔮 沙盘推演</button>') +
      '</div>';
  };

  /* ---- 只改值、不重建 DOM（保 left 过渡动画；与战场界面同一手法） ---- */
  ui.sdPaint = function (frame) {
    var sd = ui._sd;
    if (!sd) return;
    var st = sd.cur, sb = sd.sb;
    [['atk', st.atk], ['def', st.def]].forEach(function (pair) {
      pair[1].forEach(function (u) {
        var k = document.getElementById('sd-k-' + pair[0] + '-' + u.id);
        if (k) {
          k.style.left = ui.sdPct(pair[0], u.adv, sb.field) + '%';
          /* 打光的部队压暗（看得见"这一支已经没了"），但令牌留位不消失 —— 版式不动 */
          if (u.count <= 0) { if (k.classList) k.classList.add('dead'); }
          else if (k.classList) k.classList.remove('dead');
        }
        var n = document.getElementById('sd-n-' + pair[0] + '-' + u.id);
        if (n) n.textContent = U.fmt(u.count);
        var c = document.getElementById('sd-c-' + pair[0] + '-' + u.id);
        if (c) c.textContent = U.fmt(u.count);
        /* 令牌被击中：闪光（复用战场界面的 .hit 动画） */
        if (u.hit && k) {
          k.classList.add('hit');
          (function (el) { setTimeout(function () { if (el.classList) el.classList.remove('hit'); }, 360); })(k);
          u.hit = '';
        }
      });
    });
    /* 动作 chips（回放 = 该兵种当回合的实际动作；推演 = 玩家指令）
       v89.116：可操作侧 = 视角给的"我方"（守城仗里是 def 那一列） */
    (ui.sdOurSide(sb) === 'atk' ? st.atk : st.def).forEach(function (u) {
      var row = document.querySelector('#sd-board [data-row="' + ui.sdOurSide(sb) + '-' + u.id + '"]');
      if (!row) return;
      var chips = row.querySelectorAll('.sd-chip');
      var eff = sd.mode === 'sim' ? u.stance
        : (u.act === 'm' ? 'advance' : (u.act === 'r' ? 'retreat' : u.stance));
      for (var i = 0; i < chips.length; i++) {
        var s = chips[i].getAttribute('data-s');
        if (s) chips[i].className = 'sd-chip' + (s === eff ? ' on' : '');
      }
    });
    var rd = document.getElementById('sd-round');
    if (rd) rd.textContent = st.round || 0;
    /* 前线 / 接触线（与 sdLineHTML 同一套口径：引擎 frontsOf 说了算） */
    var D = sb.field || 1;
    var fr = ui.sdFrontsOf(st, sb);
    var contact = fr.contact || !!fr.broke;
    function setLine(id, pct, show, label) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.left = (Math.round(Math.max(1, Math.min(99, pct)) * 10) / 10) + '%';
      if (el.classList) { if (show) el.classList.remove('hide'); else el.classList.add('hide'); }
      var tx = el.querySelector('span');
      if (tx && label) tx.textContent = label;
    }
    setLine('sd-fl-a', ui.sdPct('atk', fr.aFront, D) + ui.SD_FL_AHEAD, !contact,
      ui.sdSideName(sb, 'atk') + '前线');
    setLine('sd-fl-d', ui.sdPct('def', fr.dFront, D) - ui.SD_FL_AHEAD, !contact,
      ui.sdSideName(sb, 'def') + '前线');
    setLine('sd-fl-c', fr.broke === 'atk' ? 4 : (fr.broke === 'def' ? 96 : ui.sdAxisPct(fr.mid, D)),
      contact, fr.broke ? ui.sdSideName(sb, fr.broke) + '被攻入腹地' : '接触线');
    var gp = document.getElementById('sd-gap');
    if (gp) gp.textContent = U.numText(Math.round(fr.gap), 0);
    var ph = document.getElementById('sd-phase');
    if (ph) ph.textContent = ui.sdPhaseText(fr, sb);
    var ps = document.getElementById('sd-pos');
    if (ps) ps.textContent = sd.i;
    var sp = document.getElementById('sd-slider-pos');
    if (sp) sp.textContent = sd.i + ' / ' + sb.frames.length;
    var rg = document.getElementById('sd-range');
    if (rg && document.activeElement !== rg) rg.value = sd.i;
    var tw = document.getElementById('sd-tower');
    if (tw) tw.textContent = st.towers;
    var stx = document.getElementById('sd-side-txt');
    if (stx) stx.innerHTML = ui.sdSideTotals(st, sb);
    /* 帧流：本帧一行（跳帧时由 sdSet 重建近 20 行） */
    if (frame) {
      var log = document.getElementById('sd-log');
      if (log) {
        var d = document.createElement('div');
        d.className = 'sd-line';
        d.textContent = ui.sdLine(sb, frame) || ('第 ' + frame[0] + ' 回合');
        log.appendChild(d);
        while (log.children.length > 60) log.removeChild(log.firstChild);
        log.scrollTop = log.scrollHeight;
      }
    }
  };
  ui.sdRebuildLog = function () {
    var sd = ui._sd, sb = sd.sb, log = document.getElementById('sd-log');
    if (!log) return;
    var from = Math.max(0, sd.i - 19);
    var html = '';
    for (var i = from; i < sd.i; i++) {
      html += '<div class="sd-line">' + U.escape(ui.sdLine(sb, sb.frames[i])) + '</div>';
    }
    log.innerHTML = html;
    log.scrollTop = log.scrollHeight;
  };

  ui.sdSet = function (k) {
    var sd = ui._sd;
    if (!sd || sd.mode === 'sim') return;
    var K = sd.sb.frames.length;
    k = U.clamp(Math.round(k), 0, K);
    var frame = (k > 0) ? sd.sb.frames[k - 1] : null;
    var seq = (k === sd.i + 1);
    if (seq && sd.cur) ui.sdApply(sd.cur, sd.sb, frame);    /* 前进一帧：增量 */
    else sd.cur = ui.sdStateAt(sd.sb, k);                   /* 跳帧：整态重建 */
    sd.i = k;
    ui.sdPaint(seq ? frame : null);
    if (!seq) ui.sdRebuildLog();
  };
  ui.sdStep = function (d) { ui.sdSet((ui._sd ? ui._sd.i : 0) + d); };
  ui.sdStop = function () {
    if (ui._sd && ui._sd.timer) clearInterval(ui._sd.timer);
    if (ui._sd) ui._sd.timer = null;
    var b = document.getElementById('sd-play');
    if (b) b.textContent = '▶ 播放';
  };
  ui.sdToggle = function () {
    var sd = ui._sd;
    if (!sd || sd.mode === 'sim') return;
    if (sd.timer) { ui.sdStop(); return; }
    /* v89.207（快赢④）：帧间隔并入战斗增速档（btWatchDelay 唯一出口；基数仍取 DATA.SANDBOX） */
    var ms = ui.btWatchDelay((DATA.SANDBOX && DATA.SANDBOX.frameMs) || 420);
    if (sd.i >= sd.sb.frames.length) ui.sdSet(0);
    sd.timer = setInterval(function () {
      if (!ui._sd || ui._sd.mode !== 'replay') { ui.sdStop(); return; }
      if (ui._sd.i >= ui._sd.sb.frames.length) { ui.sdStop(); return; }
      ui.sdSet(ui._sd.i + 1);
    }, ms);
    var b = document.getElementById('sd-play');
    if (b) b.textContent = '⏸ 暂停';
  };

  /* ---- 推演：从**同一份配方**起一个真会话（引擎同一把，不是另写一套规则） ---- */
  ui.sdSimEnter = function () {
    var sd = ui._sd, sb = sd.sb;
    if (!sb.verify) { ui.toast('沙盘校验未过（史实与重跑不一致），不能推演'); return; }
    /* 视角：可操作侧由 sb.ourSide 决定（守城仗里推演的是守军） */
    var rc = sd.rep.sandbox;
    var o = JSON.parse(JSON.stringify(rc.simOpts || {}));
    /* 起点阵位照史实（否则推演一开始就与那一仗列阵不同） */
    o.stances = { atk: {}, def: {} };
    (((rc.init || {}).atk) || []).forEach(function (u) { o.stances.atk[u.id] = { s: u.s, t: u.t }; });
    (((rc.init || {}).def) || []).forEach(function (u) { o.stances.def[u.id] = { s: u.s, t: u.t }; });
    var env = null;
    try {
      /* v89.179b·P1-3：推演会话建立也装回史实加成快照（否则推演与那场仗的结算不同源）。
        rc.boost 为空（旧档/沙盘）时直接跑，与既有行为一致。 */
      env = GAME.battle.withBoost(rc.boost, function () {
        return GAME.tactic.begin(rc.atkArmy || {}, rc.gen || null, rc.scArmy || {}, rc.scVal || 0,
          rc.scGen || null, o);
      });
    } catch (e) { env = null; }
    if (!env) { ui.toast('推演会话不可用'); return; }
    ui.sdStop();
    sd.mode = 'sim';
    sd.sim = { env: env, cmds: {}, frames: [], per: [], over: false };
    sd.cur = ui.sdStateFromSnap(env.snap(), sb, []);
    sd.i = 0;
    ui.sdRepaintAll('已进入沙盘推演：改' + (ui.sdOurSide(sb) === 'def' ? '守军' : '我军')
      + '的动作 / 目标 → 点「完成回合」，直至一方兵员耗尽。');
  };
  ui.sdSimExit = function () {
    var sd = ui._sd;
    sd.mode = 'replay';
    sd.sim = null;
    sd.cur = ui.sdStateAt(sd.sb, sd.i);
    ui.sdRepaintAll('已回到史实回放。');
  };
  /* 推演推进一步（一回合） */
  ui.sdSimStep1 = function () {
    var sd = ui._sd;
    if (!sd || sd.mode !== 'sim' || !sd.sim || sd.sim.over) return;
    var sim = sd.sim, env = sim.env, sb = sd.sb;
    var _our = ui.sdOurSide(sb);
    for (var tid in sim.cmds) env.setCmd(_our, tid, sim.cmds[tid]);
    /* v89.179b·P1-3：推演每回合推进也装回史实加成快照（与 sdSimEnter 同一把尺）。 */
    var r = GAME.battle.withBoost(sd.sb.boost, function () { return env.step(); });
    if (!r) { sim.over = true; return; }
    /* 本回合的事件也压成"帧"（与回放态同一套结构）——帧流与帧号才连续 */
    (r.events || []).forEach(function (e) {
      var tgt = e.targetId || '';
      if (e.kind === 'wall' && e.hits && e.hits[0]) tgt = e.hits[0].id;
      sim.frames.push([r.r || 0, e.side === 'atk' ? 0 : 1,
        sb.ids.indexOf(e.id || ''), (GAME.battle.SANDBOX_KIND || {})[e.kind] || '?',
        tgt ? sb.ids.indexOf(tgt) : -1,
        Math.round(e.step || e.kill || e.destroy || 0),
        Math.round(e.kind === 'tower' ? (e.left || 0) : (e.gap || 0))]);
    });
    sim.per.push([r.r, r.a, r.d, r.gap]);
    sim.over = !!r.over;
    sd.cur = ui.sdStateFromSnap(r.snap || env.snap(), sb, r.events || []);
    sd.i = sim.frames.length;
    ui.sdPaint(sim.frames[sim.frames.length - 1] || null);
    if (sim.over) ui.sdSimEnd();
  };
  /* 推演结束：史实 vs 推演 对照 */
  ui.sdSimEnd = function () {
    var sd = ui._sd, sb = sd.sb, sim = sd.sim;
    var fin = null;
    try { fin = sim.env.finish(); } catch (e) { fin = null; }
    if (!fin) return;
    var h = sb.hist || {};
    var log = document.getElementById('sd-log');
    if (log) {
      var d = document.createElement('div');
      d.className = 'sd-line sd-fin';
      /* v89.116：对照按视角给（"我损"= 我方那一侧的损失） */
      var _o = ui.sdOurSide(sb) === 'atk';
      d.textContent = '🏁 推演结束：' + fin.rounds + ' 回合　我军损失 '
        + U.numText(_o ? fin.atkLoss : fin.defLoss, 0)
        + '　敌军损失 ' + U.numText(_o ? fin.defLoss : fin.atkLoss, 0)
        + '（史实：' + (h.rounds || 0) + ' 回合　我损 ' + U.numText(_o ? (h.atkLoss || 0) : (h.defLoss || 0), 0)
        + '　敌损 ' + U.numText(_o ? (h.defLoss || 0) : (h.atkLoss || 0), 0) + '）';
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    }
    var hint = document.getElementById('sd-hint');
    if (hint) hint.textContent = '推演已结束（一方兵员耗尽 / 满 30 回合）——「回到史实回放」可对照原仗';
  };
  /* 整屏重画（模式切换 / 推演每回合）——此时重建 DOM 是对的（版式可能变） */
  ui.sdRepaintAll = function (hint) {
    var sd = ui._sd;
    if (!sd) return;
    var wrap = document.getElementById('sd-wrap');
    if (!wrap) return;
    wrap.innerHTML = ui.sdHTML() + ui.sdFootHTML();
    if (hint) {
      var h = document.getElementById('sd-hint');
      if (h) h.textContent = hint;
    }
    ui.sdRebuildLog();
  };
  /* ---- 指令写入（设定即生效） ---- */
  ui.sdSetCmd = function (tid, patch) {
    var sd = ui._sd;
    if (!sd) return;
    /* v89.120（老板「战场推演…兵种实际行为和设定不一样」）：
       改前 replay 态**静默 return** —— 老板在默认的"史实回放"里改动作/目标，
       界面显示新选中值、设定却完全没生效（推演态本身没问题，探针实证过）。
       现在：**设定即生效** —— 回放态改设定自动进入推演；不能推演（校验未过）
       则明确拒绝并**重绘回弹**（别让 select 停在假值上）。 */
    if (sd.mode !== 'sim' || !sd.sim) {
      ui.sdSimEnter();                       /* 内部含 verify 校验与 toast */
      if (sd.mode !== 'sim' || !sd.sim) {    /* 进不去 → 不假装成功 */
        if (ui.sdRepaintAll) ui.sdRepaintAll('此战不可推演（史实与重跑不一致），设定不生效。');
        return;
      }
    }
    var c = sd.sim.cmds[tid] = sd.sim.cmds[tid] || {};
    if (patch.s) c.s = patch.s;
    if (patch.t !== undefined) c.t = patch.t;
    var u = null;
    /* v89.116：可操作侧 = 视角给的"我方"（守城仗里是 def） */
    (ui.sdOurSide(sd.sb) === 'atk' ? sd.cur.atk : sd.cur.def).forEach(function (x) { if (x.id === tid) u = x; });
    if (u) { if (patch.s) u.stance = patch.s; if (patch.t !== undefined) u.target = patch.t; }
    ui.sdPaint(null);
  };

  /* ---- 打不开沙盘时的说明（旧档战报 / 输入不全 / 校验不过） ---- */
  ui.sdUnavailable = function (rep) {
    var rc = rep && rep.sandbox;
    var why;
    if (!rc) why = '这份战报没有沙盘数据（旧档战报）';
    else if (!rc.result || !(rc.result.rounds >= 1)) {
      why = '此战未能取到完整的开打前输入（双方列阵为空）';
    } else why = '史实与重跑不一致（战后科技 / 加成已变）';
    return '<div class="note-warn" style="margin:8px 0;">📽 逐帧沙盘不可用：' + why + ' —— 下方按关键帧回放。</div>';
  };

  /* ---- 打开沙盘（战报详情 → 新格局：max 档 + 固定沙盘） ---- */
  ui.openSandbox = function (rid) {
    var rep = GAME.repByRid(rid);
    if (!rep) return;
    if (!ui.openSandboxRep(rep, rid)) ui.viewReportText(rid);
  };
  /* v89.196（老板 4）：沙盘呈现的**唯一渲染段** —— 入口多处共用：
     ① 战报（openSandbox(rid)）② 战斗结束界面「🎬 回看全程」（sdOpenDone）
     ③ 工具/试验（直给 rep）。返回 false = 无回放数据（调用方决定去向）。 */
  ui.openSandboxRep = function (rep, rid) {
    if (!rep) return false;
    ui.sdStop();
    ui._repId = rid || null;
    var sb = (GAME.battle.sandboxOf ? GAME.battle.sandboxOf(rep) : null);
    if (!sb || !sb.frames.length) return false;
    ui._sd = { rid: rid || null, rep: rep, sb: sb, i: 0, timer: null, mode: 'replay', sim: null };
    ui._sd.cur = ui.sdStateInit(sb);
    ui.openShell({
      title: '🎬 沙盘 · ' + U.escape(rep.title),
      sub: '共 ' + sb.rounds + ' 回合 · ' + sb.frames.length + ' 帧（每个兵种的每次移动 / 攻击各一帧）'
        + '　·　' + (sb.verify ? '✅ 与史实逐项一致' : '⚠ 与史实不一致（战后加成已变，画面仅示意）')
        + (ui.sdOurSide(sb) === 'def'
          ? '　·　守城视角：敌在左、我在右（围墙在我方一侧；出城迎战的部队照常逐回合前进接战）'
          : ''),
      size: 'max',
      body: '<div id="sd-wrap">' + ui.sdHTML() + ui.sdFootHTML() + '</div>',
      foot: '<button class="btn" data-action="sd-text">📜 战报正文</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>',
    });
    ui.sdRebuildLog();
    return true;
  };
  /* v89.196（老板 4）：战斗**结束瞬间**的「回看全程」——
     直接吃 _battleJustDone.report（含沙盘配方）开沙盘；无回执（如重载后）导流公文。 */
  ui.sdOpenDone = function () {
    var jd = GAME._battleJustDone;
    var rep = jd && jd.ok && jd.report;
    if (!rep) { ui.toast('战报尚未落账或已过期 —— 可在「公文」里回看历史战斗'); return false; }
    var rid = GAME.repRidOf ? GAME.repRidOf(rep) : null;
    var ok = ui.openSandboxRep(rep, rid);
    if (!ok) ui.toast('该战报没有回放数据 —— 可在「公文」查看战报正文');
    return ok;
  };

  /* ============================================================
   * ⛔ v89.137（老板 4）：「不要全境营造总览，重复」——整条退役。
   * 删净：本面板函数 + 政务厅入口按钮 + 动作 open-build-ov / rush-ov /
   * rush-ov-all + 数据层 GAME.buildOverview / rushAllBuilds / buildQueueOf
   * （见 domain.js 同款墓碑）。单体提速不受影响（建筑面板「⚡ 提速」）。
   * ============================================================ */

  /* ---- 战报正文（原详情页；沙盘界面里的「📜 战报正文」走这里） ---- */
  /* v89.119：战报正文页的**去重** —— 简报里由 battle.js 写出的「【兵种损耗】…」
     段，与下方结构化表（rp-tbl）是同一份信息的两次呈现（实机量：251px 的简报里
     约 110~150px 是它，而整页在 13 回合 / 7 兵种的载荷下溢出 200px+）。
     这里只在**渲染时**剥掉文本版；`report.body` 本体不动 ——
     列表摘要 / 旧存档等其它入口照旧能看到损耗。 */
  /* ============================================================
   * v89.150（老板 3）：「战报正文里不要**分回合回放**、**回合纪要**这 2 个板块。
   *   保留/设置：**战斗总结，战斗收获，兵种损耗**。其中目前的战斗总结和收获太杂乱了，
   *   组织一下分类分行呈现」
   * ------------------------------------------------------------
   * 改前：正文是一整块灰底文本（主文＋经验＋声望＋事件＋战利品全混在一起），
   *   下面接「分回合回放」「回合纪要」「兵种损耗」三块 —— 前两块逐回合刷屏。
   * 改后只剩**三块**，且前两块分类分行：
   *   ① 战斗总结 —— 每行一条（胜负 / 英雄 / 回合 / 双方损失 + 斗将·计谋·撤退·围攻）
   *   ② 战斗收获 —— **两列网格（类别 │ 内容）**：经验 / 声望 / 战利品 / 材料 / 军械 /
   *      俘虏 / 运力 / 备注 —— 一行一类，扫读即可
   *   ③ 兵种损耗 —— 结构化表（原样保留）
   * 分段走唯一出口 `ui.reportSectOf`（正文格式由 battle.js 的 reportText/report 一处生成，
   * 新档旧档同一把尺 —— 不解析结构化字段之外的任何东西）。
   * ============================================================ */
  /* 一行 → { label, body }：前缀形式「XXX：内容」拆两列；声望这类带 HTML 的行按文本判类。
     ⚠️ 前缀正则排除 `<` 与 `：`，保证只吃**纯文本前缀**（不误吞 HTML 标签里的冒号）。 */
  /* 事件标记**白名单**（唯一出处）：只有这些【】算"战况事件"，
     其余【】一律当主文 —— ⚠️ reportText 的 line1 就是「【城名】攻城胜利」，
     用"凡是【】都算事件"会把主文全吞掉（本补丁第一版就这么错的）。
     白名单来自全仓 grep：出征（斗将/计谋/撤退/围攻）· 守城（守土/遭劫/未破防）·
     侦查（情报层级）。 */
  ui.REPORT_EV_TAGS = { '斗将': 1, '计谋': 1, '撤退': 1, '围攻': 1,
    '守土': 1, '遭劫': 1, '未破防': 1, '情报层级': 1 };
  /* 归"收获"的标记（战利品 + 侦查顺手所得）；💡 守城的【遭劫】是损失，不归收获 */
  ui.REPORT_GAIN_TAGS = { '战利品': 1, '顺手所得': 1, '意外发现': 1, '顺手拾获': 1 };
  ui._repId = 0;                 /* v89.120：当前查看的战报**身份**（rid），不再是数组下标
                                    （v89.150：随回放块退役被误删一次，这里补回 —— 初始化仍要） */
  ui.reportSplitLine = function (t) {
    var s2 = String(t || '');
    var m = s2.match(/^([^：:<]{1,8})：\s*([\s\S]*)$/);
    if (m) return { label: m[1], body: m[2] };
    var plain = s2.replace(/<[^>]+>/g, '');
    if (/声望/.test(plain)) return { label: '声望', body: s2 };
    if (/经验/.test(plain)) return { label: '经验', body: s2 };
    return { label: '', body: s2 };
  };
  /* 正文 → 四段（唯一出口）：
       summary = 主文（胜负/英雄/回合/损失）+ 不带标记的续行
       events  = 【斗将】【计谋】【撤退】【围攻】（分行、带标记）
       loss    = 【兵种损耗】段（渲染另有结构化表，此处只做归类）
       gain    = 【战利品】段（按「；」拆行）+ 经验/声望两行 */
  ui.reportSectOf = function (r) {
    var raw = String((r && r.body) || '');
    var segs = raw.split(/<br\s*\/?>/i);
    var out = { summary: [], events: [], loss: [], gain: [] };
    var cur = 'summary';
    segs.forEach(function (seg) {
      var t = String(seg || '').trim();
      if (!t) return;
      var m = t.match(/^【([^】]+)】([\s\S]*)$/);
      if (m) {
        var tag = m[1], rest = m[2];
        /* 白名单判类（唯一出处 ui.REPORT_EV_TAGS / REPORT_GAIN_TAGS）——
           其余【】（如「【灰岗】攻城胜利」）**当主文**，不进事件段。 */
        cur = (tag === '兵种损耗') ? 'loss'
          : ui.REPORT_GAIN_TAGS[tag] ? 'gain'
            : ui.REPORT_EV_TAGS[tag] ? 'events' : 'summary';
        if (cur === 'summary') { out.summary.push(t); return; }
        if (cur === 'gain') {
          /* battle.js 把多条战利品用「；」拼在一行 → 拆成多行，才能"分类分行"。
             ⚠️ 必须**括号感知**：单条内部也有「；」（如"（已入灰岗府库；随军载重 …）"）——
             裸 split 会把一条劈成两半（第二半变成无类别的孤儿行）。 */
          ui.reportSplitSemi(rest).forEach(function (x) {
            if (String(x).trim()) out.gain.push(String(x).trim());
          });
        } else if (cur === 'loss') {
          out.loss.push(rest);
        } else {
          out.events.push('【' + tag + '】' + rest);
        }
        return;
      }
      /* 经验 / 声望两行（reportText 的 line4/line5）不带【】标记 → 按文本特征归**收获** */
      if (cur === 'summary' && (/^经验：/.test(t) || /声望<\/span> \+/.test(t))) { out.gain.unshift(t); return; }
      out[cur].push(t);
    });
    return out;
  };
  /* 「；」拆行（**括号深度感知**）：只在括号外断开 —— lootLines.join('；') 拼的行里，
     单条内部还嵌着「（…；…）」，裸 split 会把一条劈两半。 */
  ui.reportSplitSemi = function (t) {
    var out = [], cur = '', depth = 0;
    String(t || '').split('').forEach(function (ch) {
      if (ch === '（' || ch === '(') depth++;
      else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
      if (ch === '；' && depth === 0) { if (cur.trim()) out.push(cur); cur = ''; return; }
      cur += ch;
    });
    if (cur.trim()) out.push(cur);
    return out;
  };
  /* v123：**战报逐条淡入**
     ------------------------------------------------------------
     改前：一屏文字一次性糊上来，读起来像一张打印件 —— 这是"战斗没手感"
     最便宜的一半（另一半是动画和音效，不在这一轮）。
     改法只在**视觉层**：DOM 不变、文本不变，只给每条加 0.06s 递增的淡入延迟。
     所以任何检查战报内容的断言都不受影响（时间到就全在）。
     上限 12 条：再长就不逐条了，读起来会变成等待。 */
  ui.reportLinesHTML = function (lines, cls) {
    var arr = lines || [];
    var step = arr.length <= 12 ? 0.06 : 0;
    return '<div class="rp-lines ' + (cls || '') + '">' + arr.map(function (t, i) {
      var d = step ? (' style="animation-delay:' + (i * step).toFixed(2) + 's"') : '';
      return '<div class="rp-line rp-in"' + d + '>' + t + '</div>';
    }).join('') + '</div>';
  };
  ui.reportGainHTML = function (lines) {
    if (!lines || !lines.length) {
      return '<div class="rp-lines"><div class="rp-line" style="color:var(--text-dim);">（此役无收获）</div></div>';
    }
    return '<div class="rp-gain">' + lines.map(function (t) {
      var sp = ui.reportSplitLine(t);
      return '<div class="rp-glabel">' + U.escape(sp.label) + '</div>' +
        '<div class="rp-gtext">' + sp.body + '</div>';
    }).join('') + '</div>';
  };

  ui.viewReportText = function (rid) {
    var r = GAME.repByRid(rid);              /* v89.120：按稳定身份取（数组位移不再错位） */
    if (!r) return;
    /* v89.102：正文页是"沙盘不可用"时的落脚点 —— 把原因写在最上面，
       不让玩家以为"回放功能坏了"（旧档战报没有配方 / 重跑与史实不一致）。 */
    var _sbNow = null;
    if (r.sandbox && GAME.battle && GAME.battle.sandboxOf) {
      try { _sbNow = GAME.battle.sandboxOf(r); } catch (e) { _sbNow = null; }
    }
    ui._repId = rid;
    var _sect150 = ui.reportSectOf(r);
    var html = (_sbNow ? '' : (r.sandbox ? ui.sdUnavailable(r) : '')) +
      '<div class="gold-heading">' + U.escape(r.title) + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:10px;text-align:center;">' +
        new Date(r.t).toLocaleString() + '</div>';

    /* v89.94（B2 · E3）：以少胜多（以弱胜强才值得晒）+ 围攻战果（还差多少） */
    if (r.underdog) html += '<div class="rp-under">🏅 以少胜多 —— 此役以弱胜强，宜入简册</div>';
    if (r.siege) {
      html += '<div class="rp-under">🧱 围攻：民心 −' + r.siege.chip + ' → 余 '
        + Math.round(r.siege.hold) + '%（第 ' + r.siege.waves + ' 波'
        + (r.siege.broke ? ' · 民心已尽，城垣垂危' : ' · 守军退守内城') + '）</div>';
    }

    /* ---- ① 战斗总结（分类分行） ---- */
    html += ui.sealH('战斗总结', '胜负 · 英雄 · 回合 · 双方兵力');
    html += ui.reportLinesHTML(_sect150.summary, 'rp-sum');
    if (_sect150.events.length) html += ui.reportLinesHTML(_sect150.events, 'rp-evts');

    /* ---- ② 战斗收获（两列：类别 │ 内容） ---- */
    html += ui.sealH('战斗收获', '经验 · 声望 · 战利品');
    html += ui.reportGainHTML(_sect150.gain);

    /* ---- ②″ v144.4 作战目标：达成了没有（护送/斩首/坚守） ---- */
    if (r.objective && r.objective.label) {
      html += '<div class="rp-under" style="color:' + (r.objective.ok ? 'var(--green-ok)' : 'var(--red-light)') + ';">'
        + '🎯 作战目标「' + U.escape(r.objective.label) + '」'
        + (r.objective.ok ? '：达成' : '：未达成') + '</div>';
    }

    /* ---- ②′ v144.3 战场修正（本仗真吃到的加减，逐项列明） ---- */
    if (r.modTotal) {
      var _mt = r.modTotal, _rows = [];
      var _pct = function (v) { return (v > 0 ? '+' : '') + Math.round(v * 100) + '%'; };
      if (_mt.tier) _rows.push(['作战目标', _mt.tier]);
      if (_mt.atk || _mt.def || _mt.hp) {
        _rows.push(['合计修正', '攻 ' + _pct(_mt.atk || 0) + ' · 防 ' + _pct(_mt.def || 0)
          + ' · 血 ' + _pct(_mt.hp || 0)]);
      }
      if (_mt.risk) _rows.push(['危险梯度', '血 ' + _pct(_mt.risk)]);
      if (_mt.veteran) _rows.push(['老兵', '攻 ' + _pct(_mt.veteran)]);
      if (_mt.bond) _rows.push(['羁绊不合', '攻防 ' + _pct(_mt.bond)]);
      if (_mt.deck && (_mt.deck.atk || _mt.deck.def)) {
        _rows.push(['指令牌', '攻 ' + _pct(_mt.deck.atk || 0) + ' · 防 ' + _pct(_mt.deck.def || 0)]);
      }
      if (_rows.length) {
        html += ui.sealH('战场修正', '这一仗到底吃到了什么');
        html += '<table class="tbl rp-tbl"><thead><tr><th>来源</th><th>修正</th></tr></thead><tbody>'
          + _rows.map(function (x) {
            return '<tr><td>' + U.escape(x[0]) + '</td><td>' + U.escape(x[1]) + '</td></tr>';
          }).join('') + '</tbody></table>';
      }
    }

    /* ---- ③ 兵种损耗表（初始 → 剩余，逐项核对） ---- */
    var bk = ui._reportLoss(r);
    if (bk) {
      html += ui.sealH('兵种损耗', '初始 → 剩余（损失）');
      html += '<table class="tbl rp-tbl"><thead><tr><th>兵种</th><th>我方初始</th><th>我方损失</th>' +
        '<th>我方剩余</th><th>敌军初始</th><th>敌军损失</th><th>敌军剩余</th></tr></thead><tbody>';
      bk.ids.forEach(function (id) {
        var nm = DATA.TROOPS[id] ? DATA.TROOPS[id].name : id;
        html += '<tr><td>' + nm + '</td>' +
          '<td class="num">' + U.numText(bk.as[id] || 0, 0) + '</td>' +
          '<td class="num" style="color:var(--red-light);">' + (bk.al[id] ? '−' + U.numText(bk.al[id], 0) : '—') + '</td>' +
          '<td class="num">' + U.numText((bk.as[id] || 0) - (bk.al[id] || 0), 0) + '</td>' +
          '<td class="num">' + U.numText(bk.ds[id] || 0, 0) + '</td>' +
          '<td class="num" style="color:var(--green-ok);">' + (bk.dl[id] ? '−' + U.numText(bk.dl[id], 0) : '—') + '</td>' +
          '<td class="num">' + U.numText((bk.ds[id] || 0) - (bk.dl[id] || 0), 0) + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    /* v89.102（老板「侦查报告不要自动冒出来」）：侦查公文里留一个**手动入口** ——
       自动弹窗退役了，但"当场那份分层情报"（已解锁的准确值 + 未解锁的锁定行）
       必须还能一键看全，否则等于把功能删了。 */
    if (r.type === 'scout' && r.scout) {
      html += '<div style="text-align:center;margin-top:12px;">' +
        '<button class="btn gold" data-action="scout-open">🔭 展开侦查面板（分层情报）</button></div>';
    }

    /* v89.102（老板「战斗报告的界面大一点」）：沙盘入口摆在最上面（一仗打完先看怎么打的），
       正文页也升到 xxl 档 */
    /* v89.157（老板「逐回合文字复盘」）：顶部入口行 = 沙盘（有配方才给）+ 逐回合文字（有回合记录才给）——
       文字数据走唯一出口 GAME.battle.roundLinesOf（与关键帧摘要同源）；
       正文页仍只有 战斗总结 / 战斗收获 / 兵种损耗 三块，文字复盘在独立弹窗里分页。 */
    var _rl157 = (GAME.battle.roundLinesOf ? GAME.battle.roundLinesOf(r) : []) || [];
    var _top157 = '';
    if (r.sandbox) {
      _top157 += '<button class="btn gold" data-action="open-sandbox" data-rid="' + rid + '">🎬 打开沙盘回放（逐兵种逐帧）</button>';
    }
    if (_rl157.length >= 2) {
      _top157 += (r.sandbox ? '　' : '') +
        '<button class="btn' + (r.sandbox ? '' : ' gold') + '" data-action="report-rounds" data-rid="' + rid + '">' +
        '📜 逐回合文字复盘（' + _rl157.length + ' 回合）</button>';
    }
    if (_top157) html = '<div style="text-align:center;margin:0 0 8px;">' + _top157 + '</div>' + html;
    html += '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>';
    /* v89.112（老板：「小小弹窗，一堆右侧下拉条」）：战报详情**一律 xxl** ——
       旧逻辑只对 war 用 xxl，defense/scout 落在默认 md(660×620)：
       防战报（总结 + 收获 + 损耗表）在 md 里溢出且**双层滚动**。
       v89.150（老板 3）：删掉回放/纪要两块后信息量下降，但仍保留 tall（长战报不挤）。 */
    ui.openModal(html, { size: 'xxl', tall: true });
  };

  /* v89.157（老板「逐回合文字复盘」）：**逐回合文字**的独立弹窗 ——
     每回合一行（唯一出口 GAME.battle.roundLinesOf），弹窗内分页（每页 12 回合）；
     与正文页三块互不干扰（老板 v89.150：「不要分回合回放、回合纪要这 2 个板块」）。 */
  ui.REPORT_ROUND_PER = 12;
  ui.openReportRounds = function (rid) {
    var r = GAME.repByRid(rid);
    if (!r) return;
    var lines = (GAME.battle.roundLinesOf ? GAME.battle.roundLinesOf(r) : []) || [];
    if (!lines.length) { ui.toast('这份战报没有逐回合记录（旧档战报或非战斗类）'); return; }
    var pg = ui.modalPage('rtr' + rid, lines, ui.REPORT_ROUND_PER, function () { ui.openReportRounds(rid); });
    var html = '<div class="gold-heading">📜 逐回合文字复盘</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:10px;text-align:center;">' +
        U.escape(r.title) + '　·　共 ' + lines.length + ' 回合（一回合一行 · 措辞与关键帧同源）</div>' +
      '<div class="rt-rounds">' +
        pg.slice.map(function (t) {
          return '<div class="rt-round">' + U.escape(t) + '</div>';
        }).join('') +
      '</div>' + pg.pager +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html, { size: 'xl' });
  };

  /* v89.102：战报入口路由 —— 战斗类公文（有沙盘配方）直接进**大沙盘**；
     侦查/旧档及其它仍走正文页。两页之间可互相跳（正文页顶部有沙盘按钮）。 */
  ui.viewReport = function (rid) {
    var r = GAME.repByRid(rid);
    if (!r) return;
    if (r.sandbox && GAME.battle && GAME.battle.sandboxOf) {
      var sb = null;
      try { sb = GAME.battle.sandboxOf(r); } catch (e) { sb = null; }
      if (sb && sb.frames.length) { ui.openSandbox(rid); return; }
    }
    ui.viewReportText(rid);
  };

  /* 从战报正文里解析不出损耗明细，所以由 battle.js 写进 report.loss。
     这里只做取值与整理（老战报没有该字段时返回 null，界面自然不显示该段）。 */
  ui._reportLoss = function (r) {
    var L = r && r.loss;
    if (!L) return null;
    var ids = {};
    [L.atkStart, L.atkLoss, L.defStart, L.defLoss].forEach(function (m) {
      Object.keys(m || {}).forEach(function (k) { ids[k] = 1; });
    });
    var list = Object.keys(ids);
    if (!list.length) return null;
    return { ids: list, as: L.atkStart || {}, al: L.atkLoss || {}, ds: L.defStart || {}, dl: L.defLoss || {} };
  };

})();
