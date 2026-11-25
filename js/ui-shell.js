/* ============================================================
 * ui-shell.js　外框 · 图例 / 坐标浮层 / 环境状态条 / 队列总览
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

  /* ============================================================
   * v89.150（老板 2）：「让玩家面对的游戏画面如同图片一样整体缩放」——
   *   下面三个出口是**画布坐标系**的公共设施（浮层挂载 / 坐标换算 / 画布尺寸），
   *   凡"按鼠标或元素位置摆浮层"的代码一律走它们，不各写一份换算。
   * ============================================================ */
  /* 画布尺寸（JS 侧唯一出口）：读 --app-w/--app-h 令牌（CSS 是源头），
     桩环境读不到（getComputedStyle 不支持自定义属性）→ 回落设计常量 1440×900。 */
  ui.canvasSize = function () {
    var w = 1440, h = 900;
    try {
      var cs = (typeof getComputedStyle === 'function') ? getComputedStyle(document.documentElement) : null;
      if (cs && cs.getPropertyValue) {
        var tw = parseFloat(cs.getPropertyValue('--app-w'));
        var th = parseFloat(cs.getPropertyValue('--app-h'));
        if (isFinite(tw) && tw > 0) w = tw;
        if (isFinite(th) && th > 0) h = th;
      }
    } catch (e) { /* 桩环境：用默认 */ }
    return { w: w, h: h };
  };
  /* 浮层挂载点（唯一出口）：整幅画面统一缩放后，所有浮层都要挂在缩放容器
     #app-scale 里（画布坐标系）；挂 body 会跑到缩放容器外 —— 字号不随缩放、
     坐标也是错的。桩环境没有容器 → 兜底 body（行为与旧版一致）。 */
  ui.layerRoot = function () {
    var sc = null;
    try { sc = (document.getElementById && document.getElementById('app-scale')) || null; } catch (e) { sc = null; }
    if (sc) return sc;
    return (typeof document !== 'undefined') ? document.body : null;
  };
  /* "视口坐标 → 画布坐标"的唯一换算：元素 rect 给的是**视觉坐标**（含 transform
     缩放）；画布内 absolute 定位要的是画布坐标 —— 减去缩放容器原点、除以缩放比。
     桩环境（rect 恒 0 / 无容器 / k=1）原样返回。 */
  ui.toCanvasXY = function (clientX, clientY) {
    var k = (GAME.appKOf ? GAME.appKOf() : 1) || 1;
    var ox = 0, oy = 0;
    try {
      var sc = document.getElementById && document.getElementById('app-scale');
      if (sc && sc.getBoundingClientRect) {
        var r = sc.getBoundingClientRect();
        if (r) { ox = r.left || 0; oy = r.top || 0; }
      }
    } catch (e) { ox = 0; oy = 0; }
    return { x: (clientX - ox) / k, y: (clientY - oy) / k, k: k };
  };

  /* ============================================================
   * v89.158（老板 2）：**悬停保护**（唯一出口）——
   *   鼠标悬停在该容器内时，本秒的"周期性重绘"让位（整块跳过），
   *   悬停期间保持"悬停那一刻"的数据呈现（老板口径：无需刷新悬停信息）。
   * ------------------------------------------------------------
   * 病根：主循环每秒用 innerHTML 重建侧栏/公文/弹窗 → 鼠标下的节点被替换 →
   *   ① 原生 title 提示与 #tip-layer 浮层因节点消失而收起
   *      （鼠标不动时浏览器不会再触发 mouseover）→ 视觉"闪烁"（实测复现）；
   *   ② CSS :hover 高亮同秒重置。
   * 口径：只有**周期性重绘**（主循环置 ui._tickPaint）让位；
   *   操作驱动的重绘（点"+"用宝物 → refreshAll）永远放行 ——
   *   否则"操作后的界面刷新"会被悬停挡住（点了 1 秒后才更新）。
   * 桩环境（jsdom 无 :hover 支持）→ 返回 false = 不保护（行为与旧版一致）；
   *   测试用 ui._hoverOf 注入悬停节点。
   * ⚠️ 取 :hover 链的**最深**元素必须用 querySelectorAll 取**最后一个** ——
   *   querySelector(':hover') 返回文档序第一个（html），永远判不中（本函数第一版就这么错）。
   * ============================================================ */
  ui._tickPaint = false;          /* 主循环每秒置 true（窗口内的重绘属"周期性"） */
  ui._hoverOf = null;             /* 测试注入点：返回悬停节点（桩环境用） */
  ui.hoverHold = function (sel) {
    if (!ui._tickPaint) return false;
    var box = null;
    try {
      box = (typeof sel === 'string')
        ? ((document.querySelector && document.querySelector(sel)) || null) : sel;
    } catch (e) { box = null; }
    if (!box || !box.contains) return false;
    var hv = null;
    try {
      if (ui._hoverOf) hv = ui._hoverOf();
      else if (document.querySelectorAll) {
        var all = document.querySelectorAll(':hover');
        hv = (all && all.length) ? all[all.length - 1] : null;
      }
    } catch (e2) { hv = null; }
    return !!(hv && box.contains(hv));
  };

  ui.TIP_ID = 'tip-layer';
  ui.tipEl = function () {
    var el = document.getElementById(ui.TIP_ID);
    if (el) return el;
    /* 兜底自建：测试环境（jsdom / 桩文档）里 index.html 的挂载点可能不存在。
       缺了它浮层就静默不显示 —— 这类"少个 DOM 就无声失败"最该有兜底。 */
    if (typeof document === 'undefined' || !document.body || !document.createElement) return null;
    el = document.createElement('div');
    el.id = ui.TIP_ID; el.className = 'tip-layer';
    el.setAttribute('aria-hidden', 'true');
    /* v89.150：挂缩放容器（画布坐标系）—— 见 ui.layerRoot 注释 */
    var _root150 = ui.layerRoot();
    if (!_root150 || !_root150.appendChild) return null;
    _root150.appendChild(el);
    return el;
  };
  /* 落位**纯函数**（便于断言）：给锚点矩形/浮层尺寸/视口，返回左上角坐标。
     ① 默认贴锚点正下方 ② 下方空间不够则翻到上方 ③ 左右上下四面夹进视口 */
  ui.tipPos = function (a, tw, th, vw, vh) {
    var gap = 10, pad = 8;
    var top = a.bottom + gap;
    if (top + th > vh - pad) top = a.top - gap - th;
    var left = a.left + a.width / 2 - tw / 2;
    left = Math.max(pad, Math.min(left, Math.max(pad, vw - pad - tw)));
    top = Math.max(pad, Math.min(top, Math.max(pad, vh - pad - th)));
    return { left: Math.round(left), top: Math.round(top) };
  };
  ui.tipHide = function () {
    var el = ui.tipEl();
    if (el) el.classList.remove('on');
  };
  ui.tipShow = function (html, anchor) {
    var el = ui.tipEl();
    if (!el || !anchor) return;
    el.innerHTML = html;
    el.classList.add('on');
    ui.tipPlace(anchor);
  };
  /* ============================================================
   * v156.17（老板：「地图上各颜色地块是啥意思，能不能悬停显示」）
   * 地图悬停小卡
   * ------------------------------------------------------------
   * 拆两半：`ui.mapTipHTML(brief)` 是**纯函数**（jsdom/smoke 能测），
   * `ui.showMapCellTip` 只管把浮层摆到鼠标旁边（复用全站唯一 #tip-layer）。
   * 内容来自 `GAME.map3d.cellBrief(ci)`：地形+等级 / 它是什么 / 点它能干什么。
   * ============================================================ */
  ui.mapTipHTML = function (b) {
    if (!b) return '';
    var esc = (U && U.escape) ? U.escape : function (x) { return String(x == null ? '' : x); };
    var head = (b.icon ? b.icon + ' ' : '') + esc(b.title || '地块')
      + ((b.lv != null) ? ' <b>Lv' + (b.lv | 0) + '</b>' : '');
    var html = '<div class="tip-t">' + head + '</div>';
    if (b.facts && b.facts.length) html += '<div class="tip-l">' + b.facts.map(esc).join('<br>') + '</div>';
    if (b.tasks && b.tasks.length) html += '<div class="tip-a">' + b.tasks.map(esc).join('<br>') + '</div>';
    if (b.coord) html += '<div class="tip-l" style="opacity:.55;margin-top:2px;">' + esc(b.coord) + '</div>';
    return html;
  };
  ui.showMapCellTip = function (b, cx, cy) {
    if (!b) { ui.tipHide(); return; }
    var el = ui._mapTipAnchor;
    if (!el && document.createElement && document.body) {
      /* 画布上悬停没有 DOM 锚点：造一个 1px 的隐身锚点跟着鼠标走，
         这样 `tipPlace` 那套「贴锚点 + 夹进视口」的逻辑可以原样复用（不用另写一套定位）。 */
      el = document.createElement('div');
      el.id = 'map-tip-anchor';
      el.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none;';
      document.body.appendChild(el);
      ui._mapTipAnchor = el;
    }
    if (!el) return;
    el.style.left = (Math.round(cx) - 1) + 'px';
    el.style.top = (Math.round(cy) - 1) + 'px';
    ui.tipShow(ui.mapTipHTML(b), el);
  };
  /* ============================================================
   * v156.17（老板：「地图上各颜色地块是啥意思」）—— **地形图例**
   * ------------------------------------------------------------
   * ⚠️ 入口**不放在地图上**：老板 v37 定过「地图不再输出标题/图例/提示」
   * （smoke 里有一条老口径：ui.js 不许出现"地图图例"那类命名，钉的就是这个）。
   * 所以图例挂到顶栏「更多」菜单里（`data-action="terr-legend"`），
   * 地图画布与底栏仍然一个装饰都不加 —— 想知道颜色含义，要么悬停看那一格，
   * 要么从「更多 → 🗺 图例」查整张表。
   * 颜色只表达**地形**（v154 定的：同类型同色、类型交界处自然断开，不另画线），
   * 所以图例只回答一件事：**这个颜色是什么地、能拿它干什么**。
   * 色块不写死 —— 直接用 `map3d.cellColorOf(ci)` 从真实渲染色里**采样**，
   * 保证"图例上的颜色 == 地图上的颜色"（写死一份迟早漂移）。
   * ============================================================ */
  /* 颜色值域 → CSS。`map3d.cellColorOf` 给的是 **0~255**（顶点色口径），
     但其它调用方（主题色之类）可能是 0~1；这里按最大值自适应。
     为什么单独抽出来：v156.17 第一版把它内联在图例行里、按 0~1 clamp，
     于是七个色块全渲染成纯白（截图当场抓到）。抽成纯函数后 smoke 能钉住两种值域。 */
  ui.colorCssOf = function (col) {
    if (!col || col.length < 3) return 'var(--slab-1)';
    var mx = Math.max(col[0], col[1], col[2]);
    var k = (mx > 1.5) ? 1 : 255;          /* 0~255 还是 0~1 */
    var c8 = function (v) { return Math.max(0, Math.min(255, Math.round((v || 0) * k))); };
    return 'rgb(' + c8(col[0]) + ',' + c8(col[1]) + ',' + c8(col[2]) + ')';
  };
  ui.terrainLegendRows = function () {
    var SPH = (GAME.mapSphere || GAME.sphere) || {};
    var TN = SPH.TYPE_NAME || {};
    var cells = SPH.cells || [];
    var order = ['plain', 'caoyuan', 'forest', 'hill', 'desert', 'zhaoze', 'lake'];
    /* 每种地形取第一格的**真实渲染色**当色块 */
    var firstOf = {};
    for (var i = 0; i < cells.length; i++) {
      var t = cells[i] && cells[i].type;
      if (t && firstOf[t] == null) firstOf[t] = i;
    }
    var RN = ui.RES_NAME || {};
    var rows = [];
    for (var k = 0; k < order.length; k++) {
      var ty = order[k];
      if (!TN[ty]) continue;
      var col = null;
      try {
        if (GAME.map3d && GAME.map3d.cellColorOf && firstOf[ty] != null) col = GAME.map3d.cellColorOf(firstOf[ty]);
      } catch (e) { col = null; }
      var css = 'var(--slab-1)';
      if (col) {
        /* ⚠️ `cellColorOf` 给的是 **0~255**（顶点色口径），不是 0~1 ——
           直接按 0~1 clamp 会全变纯白（v156.17 第一版就踩了，截图里七个色块全白）。
           值域换算收在 `ui.colorCssOf` 里（纯函数，smoke 有判据）。 */
        css = ui.colorCssOf(col);
      }
      var res = null;
      try { res = GAME.gatherResOf ? GAME.gatherResOf(ty) : null; } catch (e2) { res = null; }
      var canCity = (ty === 'plain');
      /* v158.18（老板「新手玩法」）：图例正文用**资源全名**（净水/生物质/电能/废钢），
         不再是单字「水/生/钢/电」—— 新手看不懂单字。走 ui.resFull 唯一出口。 */
      var resName = res ? (ui.resFull ? ui.resFull(res) : (RN[res] || res)) : null;
      rows.push({
        type: ty,
        name: TN[ty],
        css: css,
        res: resName,
        canCity: canCity,
        note: res ? ('可采：' + resName) : (canCity ? '不可采 · **可立城**' : '不可采')
      });
    }
    return rows;
  };
  ui.openTerrainLegend = function () {
    var rows = ui.terrainLegendRows();
    var html = '<div class="panel-body" style="line-height:1.9;">' +
      '<div class="ui-sub" style="margin-bottom:8px;">颜色 = 地形（同色同类；类型交界处自然断开）。'
      + '鼠标停在地块上会显示那一格的地形/等级与可做的事。</div>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      html += '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;'
        + 'border-bottom:1px solid rgba(255,255,255,.06);">'
        + '<span style="width:22px;height:22px;border-radius:4px;flex:none;'
        + 'border:1px solid rgba(255,255,255,.25);background:' + r.css + ';"></span>'
        + '<span style="font-weight:700;min-width:52px;">' + U.escape(r.name) + '</span>'
        + '<span class="ui-sub" style="flex:1;">' + U.escape(r.note).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</span>'
        + '</div>';
    }
    html += '</div>' + '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal('<div class="gold-heading">🗺 地形图例</div>' + html, { size: 'md' });
  };
  ui.tipPlace = function (anchor) {
    var el = ui.tipEl();
    if (!el || !anchor || !anchor.getBoundingClientRect || !el.getBoundingClientRect) return;
    var r = anchor.getBoundingClientRect();
    var t = el.getBoundingClientRect();
    /* v89.150（老板 2）：整体缩放后 —— 锚点/浮层 rect 是**视觉坐标**，
       而浮层在画布坐标系里 absolute 定位 → 先换算到画布坐标再落位；
       夹取范围也换成**画布尺寸**（"视口"对界面已不存在）。
       换算后与旧行为在 k=1、容器原点 (0,0) 时**逐像素一致**（测试口径不变）。 */
    var k = (GAME.appKOf ? GAME.appKOf() : 1) || 1;
    var ox = 0, oy = 0;
    try {
      var sc = document.getElementById && document.getElementById('app-scale');
      if (sc && sc.getBoundingClientRect) { var sr = sc.getBoundingClientRect(); if (sr) { ox = sr.left || 0; oy = sr.top || 0; } }
    } catch (e2) { ox = 0; oy = 0; }
    var a = { left: (r.left - ox) / k, top: (r.top - oy) / k, width: r.width / k,
      height: r.height / k, bottom: (r.bottom - oy) / k };
    var _cs150 = ui.canvasSize();
    var pos = ui.tipPos(a, t.width / k, t.height / k, _cs150.w, _cs150.h);
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
  };
  /* 从事件目标解析浮层内容：先找容器里的内容源，再退到 data-tip 属性 */
  ui.tipFor = function (node) {
    if (!node || !node.closest) return null;
    var host = node.closest('[data-tip-el]');
    if (host) {
      var src = host.querySelector('.tip-src, .bag-tip, .tcard-tip');
      if (src && (src.textContent || '').trim()) return { html: src.innerHTML, anchor: host };
    }
    var t = node.closest('[data-tip]');
    if (t) {
      var txt = t.getAttribute('data-tip') || '';
      if (txt) return { html: U.escape(txt), anchor: t };
    }
    /* ============================================================
     * v89.197（老板 5）：**原生 title 兜底升级** —— 全站 title 统一走 #tip-layer
     *   （规格一致：同宽域/同字号/同配色，不再"浏览器原生小方框"与浮层两套观感）。
     * 防"原生 + 浮层"双显：main.js 的委托在悬停时把 title 摘到 data-title-bk、
     *   移开时恢复（本函数只负责读出内容；摘/恢复都在委托里，行为集中一处）。
     * 已摘（悬停中）时走 data-title-bk 分支 —— 悬停期间浮层内容稳定不闪。
     * ============================================================ */
    var n = node.closest('[title]');
    if (n) {
      var txt2 = n.getAttribute('title') || '';
      if (txt2) return { html: U.escape(txt2), anchor: n, native: true };
    }
    var n2 = node.closest('[data-title-bk]');
    if (n2) {
      var txt3 = n2.getAttribute('data-title-bk') || '';
      if (txt3) return { html: U.escape(txt3), anchor: n2, native: true };
    }
    return null;
  };

  /* ============================================================
   * v89.88（老板需求 4）：大地图悬浮浮层的内容 —— 「坐标 + 等级」
   * ------------------------------------------------------------
   * 输入 = `GAME.map.pick` 的命中对象（与点击走**同一条**拾取路径）。
   * 等级一律走既有唯一出口，不另造一份：
   *   · 城市     → `GAME.cityLvOf`（城等级 = 政务厅 = 建筑，一号到底）
   *   · 野外城市 → `fort.level`（等级每日变化）
   *   · 野地     → `GAME.map.wildLevelNow`（已占读记录值、无主读日盐值）
   * 输出用既有浮层类（.tip-t / .tip-l），与 data-tip 提示同一套样式 ——
   * 一层、一套定位规则（tipPos 四面夹进视口），不会飞出屏幕。
   * ============================================================ */
  ui.mapTipFor = function (hit) {
    if (!hit) return null;
    var _hci = (hit.ci != null) ? hit.ci : ((GAME.sphere && GAME.sphere.ciOfXY && hit.x != null) ? GAME.sphere.ciOfXY(hit.x, hit.y) : -1);
    if (_hci < 0) return null;
    var head = '', rows = [];
    function line(txt) { rows.push('<div class="tip-l">' + txt + '</div>'); }
    if (hit.kind === 'player' && hit.city) {
      head = '🏯 ' + U.escape(hit.city.name) + '（己方）';
      line('城等级 <b>Lv' + GAME.cityLvOf(hit.city) + '</b> · 点击进入城市面板');
    } else if (hit.kind === 'npc' && hit.city) {
      var tier = (DATA.CITY_TIER || {})[hit.city.type] || '名城';
      head = '🏯 ' + U.escape(GAME.cityFullName(hit.city));
      line('城等级 <b>Lv' + GAME.cityLvOf(hit.city) + '</b> · ' + U.escape(tier) + '　点击可出征');
    } else if (hit.kind === 'fort' && hit.fort) {
      head = '🏕 ' + U.escape(GAME.fortLabelOf(hit.fort));
      line('野外城市 <b>Lv' + hit.fort.level + '</b> · 等级每日变化　点击可出征');
    } else {
      var _hc = (GAME.sphere && GAME.sphere.cells) ? GAME.sphere.cells[_hci] : null;
      var ter = (_hc && DATA.TERRAIN[_hc.type]) || null;
      var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(_hci) : 0;
      var own = GAME.map.wildAt(_hci);
      head = (ter ? ter.name : '空地') + (own ? '（己方 · 已占）' : '');
      line('野地 <b>Lv' + lv + '</b>' + (lv > 0 ? ' · 点击可出征' : ' · 无守军'));
    }
    var cur = GAME.currentCity && GAME.currentCity();
    var d = cur ? GAME.cityDist(cur, { ci: _hci }) : null;
    line('📍 球系坐标 <b>' + (GAME.map.coordTextCi ? GAME.map.coordTextCi(_hci) : '') + '</b>'
      + (d == null ? '' : '　距 ' + U.escape(cur.name) + ' ' + d + ' 格'));
    return '<div class="tip-t">' + head + '</div>' + rows.join('');
  };

  ui.help = function (text, label) {
    var t = U.escape(text);
    return '<span class="help-chip" data-tip="' + t + '" data-action="show-help" data-help="' + t + '" title="">'
      + (label || '?') + '</span>';
  };
  ui.openHelp = function (text) {
    ui.openShell({
      title: 'ⓘ 说明',
      size: 'sm',
      body: '<div class="help-body">' + U.escape(text) + '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">知道了</button></div>'
    });
  };

  /* ============================================================
   * v89.210（老板「按建议执行」· 规划三）：**环境状态条**（至多 3 枚 · 仅"非默认态"）
   * ------------------------------------------------------------
   * 目标（v89.208 梳理点名的"0 动作面系统"可发现性）：把"由环境驱动、玩家不会
   * 主动去玩"的三类**可报状态**显示在顶栏天时块右侧：来犯 / 民心低 / 逾溢折损。
   * （天候不进 chips —— 「天时」行本来就显示 年序/季节/天候，同屏双显违"不重复"原则。）
   * 规则：**默认 / 正常态不显示**（没有消息就是正常 —— 防信息噪音）；只读现成
   * 唯一出口、零新状态；点 chip = 跳到对应页 / 面板（data-action=sky-go）。
   * 优先级（超 3 枚按此截断）：① 来犯 ② 民心低 ③ 逾溢。
   * 「离线补偿」明确**不做常驻 chip**（发生时已有「归来报告 / 离线纪要」弹窗）。
   * ============================================================ */
  ui.durRealOf = function (ms) {
    var sec = Math.max(0, Math.round((ms || 0) / 1000));
    if (sec < 60) return sec + '秒';
    if (sec < 3600) return Math.floor(sec / 60) + '分';
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    return m ? (h + '时' + m + '分') : (h + '时');
  };
  ui.skyBadgesOf = function () {
    var s = GAME.state;
    var out = [];
    if (!s) return out;
    /* ① 来犯：最近一场的倒计时（现实时间 —— invasionDueAt 已含 开关/解锁/轮转 全部口径） */
    try {
      if (GAME.invasionDueAt) {
        var best = null;
        (s.cities || []).forEach(function (ct) {
          var due = GAME.invasionDueAt(ct);
          if (due && (!best || due < best.due)) best = { due: due, city: ct };
        });
        if (best) {
          var leftMs = best.due - GAME.realNow();
          if (leftMs > 0) {
            out.push({ id: 'inv', cls: 'sky-war', go: 'marches',
              txt: '⚔ ' + ui.durRealOf(leftMs),
              tip: '外敌来犯：' + best.city.name + ' 约 ' + ui.durRealOf(leftMs)
                + '后遇袭（现实时间）· 点击到军务 · 警报页布防' });
          }
        }
      }
    } catch (e1) { }
    /* ② 民心低：任一城 ≤ 40（再败即尽） */
    try {
      var worst = null;
      (s.cities || []).forEach(function (ct) {
        var h = GAME.cityHeartsOf(ct);
        if (h <= 40 && (!worst || h < worst.h)) worst = { h: h, city: ct };
      });
      if (worst) {
        out.push({ id: 'hearts', cls: 'sky-hearts', go: 'city', city: worst.city.id,
          txt: '💔 ' + worst.city.name + ' ' + Math.round(worst.h) + '%',
          tip: '民心低：' + worst.city.name + ' 民心仅 ' + Math.round(worst.h)
            + '%，再败即尽 · 点击查看该城' });
      }
    } catch (e2) { }
    /* ③ 天候**不进 chips**（v89.210 落地后调整）：「天时」行本就显示 年序/季节/天候，
       同屏双显违"不重复"原则 —— 原 sky-weather 档位一并退役（CSS 同步撤）。
       余下三类可报状态：来犯 / 民心低 / 逾溢（至多 3 枚 = 全部可同显）。 */
    /* ④ 逾溢折损：任一城有资源超出仓容（正在被天灾慢慢吃掉） */
    try {
      var rotCity = null;
      (s.cities || []).forEach(function (ct) {
        if (rotCity) return;
        var rows = GAME.overflowRotOf ? GAME.overflowRotOf(ct) : [];
        if (rows && rows.length) rotCity = ct;
      });
      if (rotCity) {
        out.push({ id: 'rot', cls: 'sky-rot', go: 'store',
          txt: '🔥 逾溢折损',
          tip: '仓廪逾溢：' + rotCity.name + ' 有资源超出仓容上限 —— 超出部分每游戏日折损 25%'
            + '（现实约 ' + ui.rotPeriodRealText() + '）· 点击打开战储仓' });
      }
    } catch (e4) { }
    return out.slice(0, 3);
  };
  ui.skyBadgeHTML = function (b) {
    if (!b) return '';
    var act = b.go ? (' data-action="sky-go" data-go="' + b.go + '"'
      + (b.city ? ' data-city="' + b.city + '"' : '')) : '';
    return '<span class="sky-badge ' + (b.cls || '') + (b.go ? '' : ' sky-none') + '"' + act
      + ' title="' + U.escape(b.tip || b.txt) + '">' + b.txt + '</span>';
  };
  ui.syncHeader = function () {
    var s = GAME.state;
    ui.paintNav();
    /* v25（需求 9）：头像换成程序化立绘（不再用 emoji）。
       v45（需求 2）：老板要求**主角头像也从 20 张头像池里随机取一张** ——
       与麾下英雄同一套美术。种子存在 `state.ruler.portraitSeed`（开局摇一次，
       之后每局固定），所以整局游戏里君主的脸不会变。
       池子为空时 `portraits.html` 自动退回 emoji 兜底（v90 起），界面不会开天窗。 */
    var av = $('#lord-avatar');
    if (av && GAME.portraits) {
      var rulerGen = {
        name: s.ruler.name || '君主', gender: s.ruler.gender || 'male',
        portraitSeed: s.ruler.portraitSeed,
        rank: 'tian',                       /* 程序化立绘兜底时君主用天启体冠 */
        tong: 92, nz: 84, yw: 86, zm: 88,   /* 兜底立绘：四维最高的"指挥"→金甲 */
      };
      /* v89.158：内容不变不重建（每秒重建会让悬停态/子节点被打断） */
      var _avSig = (s.ruler.name || '') + '|' + (s.ruler.gender || '') + '|' + (s.ruler.portraitSeed || '');
      if (av._sig !== _avSig) { av._sig = _avSig; av.innerHTML = GAME.portraits.html(rulerGen, 68); }
    }
    /* v26（需求 3）：顶栏天时。放在 syncHeader 里而不是单独定时器 ——
       主循环每秒都会调 syncHeader，年序/季节/天候一切换这里就跟着变。 */
    var sky = $('#nav-sky');
    if (sky) {
      /* v156.32（老板「天时啥的也省约一点」）：顶栏只排版**压缩句**（`1年 春 ☀晴`），
         完整句（`第 N 年 季 天候`）走 tooltip —— 同一份数据两个排版，
         出处仍是 story.skyLine / story.skyBrief 两个出口，界面不再自己拼串。 */
      var line = GAME.story ? GAME.story.skyLine() : '';
      var brief = (GAME.story && GAME.story.skyBrief) ? GAME.story.skyBrief() : line;
      /* v89.210（规划三）：环境状态条 —— 天时块右侧追加至多 3 枚「非默认态」chips
         （数据走唯一出口 ui.skyBadgesOf；默认态为零枚 = 无消息即正常）。 */
      var _bg210 = ui.skyBadgesOf ? ui.skyBadgesOf() : [];
      var _bgSig = (brief || '') + '|' + _bg210.map(function (b) { return b.txt; }).join('|');
      /* v89.158：内容不变不重建（同头像 —— 内容变（换季/换天候/状态变）才重画） */
      if (sky._sig !== _bgSig) {
        sky._sig = _bgSig;
        /* 值也包一层 span：`.nav-sky` 的 flex `gap` 只作用于**元素**，
           裸文本节点不是 flex item —— 上一版就是"天时"和"1年"粘在一起。 */
        sky.innerHTML = '<span class="ns-k">天时</span>'
          + '<span class="ns-v">' + U.escape(brief || '—') + '</span>'
          + _bg210.map(function (b) { return ui.skyBadgeHTML(b); }).join('');
      }
      var _tip = '天时：' + (line || '—') + '（季节 / 天候影响全图产出与战斗）';
      if (sky.title !== _tip) sky.title = _tip;
    }
    /* v81（老板）：「官职这行放玩家名称」—— 官职行退役（游戏里没有官职体系），
       君主名落在信息表首行；#lord-office 不再存在、也不再写。 */
    $('#lord-name').textContent = s.ruler.name;
    $('#lord-rep').textContent = U.fmt(s.rep);
    $('#lord-rank').textContent = (s.rank || 0);
  };

  /* ============================================================
   * 队列总览（v24 · 需求 9）
   * ------------------------------------------------------------
   * 原先屏幕下方常驻一条「建造队列实时播报」，把募兵、自动升级、行军全挤在
   * 一行里滚动 —— 既是"永远在动的噪音"，又占掉棋盘的高度。
   * 现在统一收进「公文」页的「队列」一节：要看时打开公文，平时界面干净。
   * 地块上的行内进度（施工 % / 募兵 %）**保留**，进度信息并不丢失。
   * ============================================================ */
  /* v29（需求 6）：`ui.renderQueue` 随公文的队列段一并删除 ——
     它原本只是个"仅当 #doc-queues 存在时才刷新"的挂钩，
     而 #doc-queues 已经不存在了，留着就是一段永不生效的死代码。
     队列现在按归口分散展示：政务厅（建造/募兵）、行军菜单、自动菜单。 */

})();
