/* ============================================================
 * ui-build.js　建造 · 前传君主 / 等距渲染 / 围墙 / 格内建筑 / 政务厅
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

  /* 共享常量：定义在 ui.js 的 ui._C（全站唯一一份，取的是同一个对象） */
  var BLDG_FUNC = ui._C.BLDG_FUNC;

  /* ============================================================
   * v89.116（老板「设置里的显示比例实质改不了比例」）—— **病根**：
   *   `ui.zoomBarHTML` 画出了 `#zoom-range` 滑块，但**全仓没有任何 input/change 监听**
   *   （v89.104 把档次 chips 换成 range 时，只删了旧的 `after==='zoom'` 分支，
   *   忘了给新滑块接线）→ 拖动无任何反应，设置里的百分比只是个摆设。
   * 现在两条路：
   *   · `previewZoom(v)` —— input 事件里**只改 DOM**（不重绘），拖动不中断；
   *   · `GAME.doSetZoom(v)` —— change 事件里落库 + 重绘（走既有唯一出口）。
   * ============================================================ */
  ui.previewZoom = function (v) {
    var z = Math.max(ui.ZOOM_MIN, Math.min(ui.ZOOM_MAX, Math.round(Number(v) || 100)));
    document.querySelectorAll('.city-iso').forEach(function (el) { el.style.zoom = (z / 100); });
    var t = document.getElementById('zoom-txt');
    if (t) t.textContent = z + '%';
    return z;
  };

  /* --------- 城内（36格：政务厅占右侧4格 + 32格可建；围墙环绕不占格） --------- */
  ui.cityHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    /* ⛔ v157.85：前传退役 → 不存在"开局没有城"。这里只留一句兜底文案，
       防止异常档（城数据损坏）把每秒刷新链炸断（旧写法第 2 行就 `c.col`）。 */
    if (!c) return '<div class="ui-page"><div class="gold-heading">还没有城</div>'
      + '<div class="ui-sub">当前存档没有可用城市 —— 请回到主菜单重新开局。</div></div>';
    var COLS = c.col || 6, ROWS = c.row || 6;
    ui.fitBoard(COLS, ROWS);              /* v27：按窗口算格子边长 */
    var M = ui.isoMetrics(COLS, ROWS);
    var cells = c.cells.map(function (cell, idx) {
      /* v23（需求 4）：政务厅 4 格交给宫殿整体渲染，这里跳过 */
      if (cell.official) return '';
      return ui.buildCellHTML(cell, idx, c, { M: M, col: idx % COLS, row: Math.floor(idx / COLS) });
    }).join('') + ui.govPalaceHTML(c, M);
    /* v25（需求 1）：围墙不再挂文字牌 —— 等级与操作都在点击后弹出的围墙面板里 */
    /* v89.128：环城一圈 = **围墙建筑的视觉** —— 修了才画；热区常在（未建时点它=修建） */
    var board = ui.isoBoard(COLS, ROWS, cells, {
      wall: (c.wall && c.wall.build) ? 'full' : 'ghost',   /* v89.169：0 级 = 虚线虚影（可见入口） */
      wallHit: true, wallAction: 'open-wall' });
    GAME.ensureExtGrid(c);
    /* ============================================================
     * v22（需求 3）：**中央只留城市与地块**
     * 原先棋盘上方堆了五样东西 —— 城市名/坐标/政务厅、幸存者·驻军·城防·城外、
     * 征收旧币+冷却、显示比例、辖区岁贡 —— 把唯一该看的东西压到屏幕下半截，
     * 而且截图里那句「就绪 · 以民心换旧币」既不是数据也不是操作提示，纯噪声。
     * 现在：城市身份与数值 → 侧栏「城市属性」；征收/缩放/岁贡 → 侧栏「城市操作」。
     * 连"城内共 N 格 · 点击地块弹出详情"这类玩法说明也一并去掉（需求 5 的延续）。
     * ============================================================ */
    return '<div class="ui-page city-pure">' +
      '<div class="city-iso" style="' + ui.zoomStyle() + '">' + board + '</div>' +
      /* v140（老板：「如何将城内外转成 3D」）：2D 棋盘旁边给一个 3D 俯瞰入口。
         不是替换 —— 2D 那套是数值与建造的操作面，3D 是"看看我这城长什么样"。
         两套读**同一份 city 数据**，所以点不点它都不影响存档与测试。 */
      '<div style="position:absolute;right:12px;bottom:12px;z-index:6;">'
      + '<span data-action="city-3d" style="display:inline-block;padding:6px 13px;'
      + 'border:1px solid var(--gold-light);border-radius:5px;background:rgba(18,20,26,.92);'
      + 'color:var(--gold-light);font-size:var(--fs-cap);cursor:pointer;"'
      + ' title="按当前城的格子与建筑，现搭一个 3D 俯瞰">🏙 用 3D 看一眼</span></div>' +
      '</div>';
  };
  /* 注意：GAME.extUsed(city) 已由 domain.js 提供（v14 按城市独立），此处不再重复定义 */

  /* 建筑分类配色（城内）：让空格一眼能分出功能类型 */
  var BLDG_CAT = {
    guanfu: 'gov', minfang: 'prod',
    junying: 'mil', xiaochang: 'mil', chengqiang: 'mil', majiu: 'mil', tiejiangpu: 'mil', gongjiangzuofang: 'mil',
    shuyuan: 'cult', zhaoxianguan: 'cult', kezhan: 'cult',
    shichang: 'com', honglusi: 'com', yizhan: 'com', fenghuotai: 'com',
    cangku: 'store'
  };
  /* 城外资源地块配色：按资源类型分色 */
  var EXT_CAT = { farm: 'farm', forest: 'wood', quarry: 'stone', mine: 'iron' };

  /* ============================================================
   * 等距地块渲染（v16 重制）
   * ------------------------------------------------------------
   * 由 (col,row) 直接算出格心的屏幕坐标（标准 2D 等距投影）：
   *     x = (col - row) * halfW
   *     y = (col + row) * halfH
   * 地块用 clip-path 裁成菱形；建筑 SVG 的**底边对齐格心**，
   * 不再做反向旋转的「立牌」—— 地块与建筑融为一体，不再悬浮错位。
   * 围墙是**外圈一匝墙环**（clip-path 环形，nonzero 挖洞），不占任何格。
   * ============================================================ */
  /* ============================================================
   * 地块投影（v18）：平行四边形剪切投影
   *   · 地块是平行四边形而非菱形 —— 整体轮廓不再是菱形，观感更接近原版斜视棋盘
   *   · 建筑底边落在**格心**（元素盒的 50%/50% 正好是格心），不再悬浮错位
   *   · 有建筑的地块隐去色块（CSS .built），只留建筑 + 基座阴影 —— 不再是"两层"
   *   · 围墙只占一条 13px 窄带，且 z-index 低于地块 → 永不遮挡建筑
   * ============================================================ */
  /* v20：地块是**正方形**（边长 88）。元素盒 = 地块本身，
     格心即元素盒的 50%/50% —— 建筑图标居中就正对格心，几何上不可能错位。
     TILE_SKEW 保留为 0（历史代码可能引用），不再参与定位。 */
  /* v25（需求 4）：地块 88 → 76，按**平板**（1024×768）适配。
     算一遍最宽的一屏：1024 − 左右内边距 24 − 侧栏间距 10 − 侧栏 288 = 702px；
     城外是 8 列：8×76 + 2×26 = 660 ≤ 702 ✓（88 时是 730，会横向溢出）。 */
  ui.TILE_W = 76;
  ui.TILE_H = 76;
  ui.TILE_SKEW = 0;

  /* ------------------------------------------------------------
   * 棋盘尺寸自适应（v27 · 需求 9）
   * ------------------------------------------------------------
   * 设计基准 1180×820，但格子边长**不写死** —— 按实测容器算：
   *   窗口大 → 格子大（更好点、图标更清楚）；窗口小 → 格子小（不溢出）。
   * `ui.viewBoxSize` 在 jsdom 下拿不到布局（clientWidth 恒 0），
   * 于是回落到基准值 —— 测试因此仍然是确定性的。
   * ------------------------------------------------------------ */
  /* ⛔ v157.85：「营地视图」（v131 前传 · 没有城时的地盘页）随前传整段退役删除。 */
  /* ============================================================
   * v132：**点名斗将**（老板「就是大地图加地块探索加斗将等」）
   * ------------------------------------------------------------
   * 只做呈现：四招 + 逐合记录 + 打完的结算。判定不在本文件。
   * ============================================================ */
  /* ============================================================
   * v144.1（老板「斗将正式化」）：**斗将竞技场**
   * ------------------------------------------------------------
   * 老板原话：「一个对战场景，两边是双方画像，每回合各自主动出手一次，
   *   画像飞向对方并造成伤害，伤害有英雄攻击，防御决定，血量由体力决定」。
   * 改前（v136）：血条是**比分派生**的（hp = 100×(3−对方得分)/3）——
   *   掉血只是比分的另一种画法，攻防与体力在这场里完全不参与；
   *   出手是"谁占先谁飞"，另一边站着不动。
   * 现在：
   *   · 左右两张**画像**对峙 —— 左我（君主真人头像）· 右敌（废土物种图鉴像）
   *   · **每合双方各出手一次** → 两张画像**同时飞向对方**，两边各飘一个伤害数
   *   · 血 = **体力**（上限 staMax，开打时按当前体力起手），面板写明"体力即血"
   *   · 面板直接显示**攻/防**两个数 —— 伤害就是这两个数定的，不能让玩家猜
   * ⚠️ 一分一合都不在这里算：血量与伤害全由 `GAME.duel.play` 从头复算
   *   （见 js/duel.js —— 三条口径与数值表都在那里），面板只负责画。
   * ============================================================ */
  /* ⛔ v157.85：`ui.openDuelPanel`（前传「点名斗将」的竞技场面板）整函数删除 ——
     它读的是 `GAME.prologue.duelOf()`，前传退役后没有数据源。
     ⚠️ 3D 斗将舞台 `duel3d` 本身保留：它是"表现层"，后续做正式斗将时还要用。 */

  /* ⛔ v157.85：`ui.campHTML`（前传「营地」页：没有城时兜住 renderView 并给荒野行动列表）
     整函数删除。前传退役后 `renderView` 一定有城可渲染。 */

  ui.DESIGN = { w: 1180, h: 820 };
  ui.SIDE_W = 283;          /* v43：CSS 侧栏宽度已固定为 283px（原为 clamp(272px,24vw,320px) 浮动值），
                               这里必须与之一致 —— 两处不一致时"按基准算"与"按实测算"会给出不同结果 */
  ui.viewBoxSize = function () {
    var el = null;
    try { el = document.getElementById('view-container'); } catch (e) { el = null; }
    var w = (el && el.clientWidth) ? el.clientWidth : (ui.DESIGN.w - 20 - 8 - ui.SIDE_W);
    var h = (el && el.clientHeight) ? el.clientHeight : (ui.DESIGN.h - 46 - 16);
    return { w: Math.floor(w), h: Math.floor(h) };
  };
  /* 求格边长：把 cols×rows 连同外沿一起塞进可用空间，四周留 16px 呼吸 */
  ui.fitTile = function (cols, rows, opt) {
    opt = opt || {};
    var box = ui.viewBoxSize();
    var availW = box.w - (opt.extraW || 0) - (opt.pad == null ? 0 : opt.pad) - 16;
    var availH = box.h - (opt.extraH || 0) - (opt.pad == null ? 0 : opt.pad) - 16;
    var s = Math.floor(Math.min(availW / cols, availH / rows));
    /* v40（需求 2）：上限 96 → 160。老板要"尽量填充界面" ——
       8 列 × 6 行在 1288×888 的可用区里算出来是 ~140，被 96 卡住后
       棋盘只占屏幕三分之二，剩下的全是留白。上限只作防极端值，实际尺寸
       仍由 availW/cols 与 availH/rows 的较小者决定（小窗口自然变小）。 */
    return Math.max(opt.min || 40, Math.min(opt.max || 160, s));
  };
  /* 城内 / 城外：改的是全局 TILE_W/H（isoMetrics 每次调用时读取，天然跟随） */
  ui.fitBoard = function (cols, rows) {
    var s = ui.fitTile(cols, rows, { pad: ui.WALL_PAD * 2 });
    ui.TILE_W = s;
    ui.TILE_H = s;
    return s;
  };
  /* v25（需求 1）：围墙不再紧贴地块 —— 中间留一段空隙，整体成一圈"环"。
     GAP 是空隙，PX 是带宽（同时也是点击热区厚度）。 */
  ui.WALL_GAP = 8;
  ui.WALL_PX = 18;
  ui.WALL_PAD = 8 + 18;  // = GAP + PX，版面外凸距离
  ui.TILE_R = 10;        // 地块圆角（与 .tile-face 一致）
  /* 保留接口（旧代码/测试引用）；正方面不用 clip-path，靠 border-radius */
  ui.tileClip = function () { return 'none'; };

  /* v20：正方形棋盘度量。棋盘 = cols×W 宽、rows×H 高，行列等距，无错位 */
  ui.isoMetrics = function (cols, rows) {
    var W = ui.TILE_W, H = ui.TILE_H, wp = ui.WALL_PAD;
    var bw = cols * W;                 // 棋盘宽
    var bh = rows * H;                 // 棋盘高
    return {
      w: bw + wp * 2, h: bh + wp * 2,  // 含围墙带的总版面
      bw: bw, bh: bh, W: W, SH: 0, H: H, wall: wp, r: ui.TILE_R,
      /* 地块元素左上角（含围墙边距） */
      x: function (col, row) { return wp + col * W; },
      y: function (col, row) { return wp + row * H; },
      clip: ui.tileClip(),
    };
  };

  /* 棋盘外沿（平行四边形四角，不含围墙带）—— 用于围墙描边 */
  ui.isoOutline = function (cols, rows) {
    var M = ui.isoMetrics(cols, rows);
    return [[0, 0], [cols * M.W, 0], [cols * M.W, rows * M.H], [0, rows * M.H]];
  };

  /* ============================================================
   * 围墙（v25 · 需求 1）
   * ------------------------------------------------------------
   * 改前：一圈 13px 窄带紧贴棋盘，外加一枚「🧱 围墙 Lv9 · 点击升级」文字牌。
   * 改后：
   *   · 与地块**留出空隙**（GAP），整体是一圈独立的"环"
   *   · 环上有围墙该有的东西：夯土墙身、雉堞（垛口）、压顶亮线、四角角楼
   *   · **不再有任何文字** —— 等级在政务厅屋面板与围墙面板里看；
   *     需要操作时点这圈墙即可（热区见 ui.wallHitHTML）
   * ============================================================ */
  /* v89.169：墙环**几何唯一出口** —— 带参数（WALL_PX）与四角（带中心线）只在这里算。
     实墙（isoWallSVG）与未修建虚影（isoWallGhostSVG）共用同一份，
     保证「待建的墙」与「建成的墙」永远落在同一条带上（改 WALL_PX / 内距只动一处）。 */
  ui.wallRingGeom = function (cols, rows) {
    var M = ui.isoMetrics(cols, rows);
    var w = ui.WALL_PX, cw = M.w, ch = M.h;
    /* 描边以「带中心线」为准：外壁贴容器边，内壁距外壁 w */
    var hw = w / 2;
    var pts = [
      hw.toFixed(2) + ',' + hw.toFixed(2),
      (cw - hw).toFixed(2) + ',' + hw.toFixed(2),
      (cw - hw).toFixed(2) + ',' + (ch - hw).toFixed(2),
      hw.toFixed(2) + ',' + (ch - hw).toFixed(2),
    ].join(' ');
    return { w: w, cw: cw, ch: ch, hw: hw, pts: pts };
  };
  ui.isoWallSVG = function (cols, rows) {
    var _g169 = ui.wallRingGeom(cols, rows);
    var w = _g169.w, cw = _g169.cw, ch = _g169.ch, hw = _g169.hw, pts = _g169.pts;
    /* 角楼：四面墙交角处的一座小墩台（含垛口与压顶） */
    var tower = function (x, y) {
      var t = 26;
      return '<g class="wtower">'
        + '<rect x="' + (x - t / 2) + '" y="' + (y - t / 2) + '" width="' + t + '" height="' + t + '" rx="3.5" fill="url(#wallBody)"/>'
        + '<rect x="' + (x - t / 2) + '" y="' + (y - t / 2) + '" width="' + t + '" height="6" rx="3" fill="url(#wallTop)"/>'
        + '<path d="M' + (x - t / 2 + 2) + ' ' + (y - t / 2 + 6) + ' H' + (x + t / 2 - 2)
          + '" stroke="rgba(0,0,0,.45)" stroke-width="1.4"/>'
        + '<path d="M' + (x - t / 2 + 4) + ' ' + (y - t / 2 + 12) + ' h4 M' + (x - 2) + ' ' + (y - t / 2 + 12)
          + ' h4 M' + (x + t / 2 - 8) + ' ' + (y - t / 2 + 12) + ' h4" stroke="rgba(255,240,205,.20)" stroke-width="2.4"/>'
        + '<rect x="' + (x - 4) + '" y="' + (y + 2) + '" width="8" height="9" rx="4" fill="rgba(0,0,0,.42)"/>'
        + '</g>';
    };
    return '<svg class="iso-wall" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">'
      + '<defs>'
      /* 夯土墙身：上端受光、下端吃影 */
      + '<linearGradient id="wallBody" x1="0" y1="0" x2="0" y2="1">'
      +   '<stop offset="0" stop-color="#6a6255"/><stop offset=".45" stop-color="#4a4438"/>'
      +   '<stop offset="1" stop-color="#2a251d"/></linearGradient>'
      /* 压顶：暗金一线，这是全图唯一允许的暖色 */
      + '<linearGradient id="wallTop" x1="0" y1="0" x2="0" y2="1">'
      +   '<stop offset="0" stop-color="#c9a24b"/><stop offset="1" stop-color="#6d5220"/></linearGradient>'
      + '</defs>'
      /* ① 墙身 */
      + '<polygon points="' + pts + '" fill="none" stroke="url(#wallBody)" stroke-width="' + w + '"/>'
      /* ② 雉堞：外半侧的垛口（虚线做成垛） */
      + '<polygon points="' + pts + '" fill="none" stroke="rgba(226,214,180,.34)" stroke-width="'
        + Math.max(4, w - 8) + '" stroke-dasharray="7 6"/>'
      /* ③ 墙根落影（外沿一圈暗线，把墙"压"在地上） */
      + '<polygon points="' + pts + '" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="2" transform="translate(0,2)"/>'
      /* ④ 压顶亮线（外沿） */
      + '<polygon points="' + pts + '" fill="none" stroke="url(#wallTop)" stroke-width="2.4"/>'
      /* ⑤ 内壁收口（与地块之间那圈空隙的边界） */
      + '<polygon points="' + pts + '" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="1.6"'
        + ' transform="scale(1)" style="transform-box:fill-box;transform-origin:center;"/>'
      /* ⑥ 四角角楼 */
      + tower(hw, hw) + tower(cw - hw, hw) + tower(cw - hw, ch - hw) + tower(hw, ch - hw)
      + '</svg>';
  };

  /* ============================================================
   * v89.169（老板）：「围墙 0 级的时候不明显，整得明显一点」
   * ------------------------------------------------------------
   * 病根：0 级（从未修建 / 破城掉回 0）时 `wall.build = null` → isoWallSVG 整段不画，
   *   城内视角**一无所有**；而围墙的唯一入口就是这圈（空格菜单还把围墙剔除了），
   *   于是"想修墙的人在棋盘上找不到墙"。
   * 现在：未修建 = 一圈**虚线虚影**（墙基土垄 + 虚线墙线 + 四角虚影角楼位），
   *   几何与实墙同源（wallRingGeom）；热区照旧（点虚影 = 打开「修建围墙」）。
   * 口径：实墙（完整形制）↔ 虚影（待修建）—— 虚影**不表示等级**，等级只看面板；
   *   配色走 CSS 的 `--gold-rgb`（暗底发亮 / 浅底加深，四套主题自适应）。
   * ============================================================ */
  ui.isoWallGhostSVG = function (cols, rows) {
    var _g169 = ui.wallRingGeom(cols, rows);
    var cw = _g169.cw, ch = _g169.ch, hw = _g169.hw, pts = _g169.pts;
    var t = 26;                                   /* 角楼墩台尺寸与实墙一致（虚影 = 待建位） */
    var corner = function (x, y) {
      return '<rect class="wghost-corner" x="' + (x - t / 2) + '" y="' + (y - t / 2) + '" width="' + t + '" height="' + t
        + '" rx="3.5" fill="none" stroke="rgba(201,162,75,.55)" stroke-width="1.6" stroke-dasharray="5 4"/>';
    };
    return '<svg class="iso-wall iso-wall-ghost" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">'
      + '<polygon class="wghost-base" points="' + pts + '" fill="none" stroke="rgba(201,162,75,.12)" stroke-width="' + _g169.w + '"/>'
      + '<polygon class="wghost-line" points="' + pts + '" fill="none" stroke="rgba(201,162,75,.74)" stroke-width="2.4" stroke-dasharray="10 7"/>'
      + corner(hw, hw) + corner(cw - hw, hw) + corner(cw - hw, ch - hw) + corner(hw, ch - hw)
      + '</svg>';
  };

  /* 围墙点击热区（v25 · 需求 1）：四条独立的带，只覆盖墙环，不侵入棋盘。
     用 HTML 元素而不是 SVG —— SVG 只有描边时命中判定不稳（填充区域才是热区）。 */
  ui.wallHitHTML = function (cols, rows, action) {
    var M = ui.isoMetrics(cols, rows);
    var w = ui.WALL_PX, cw = M.w, ch = M.h;
    var a = ' data-action="' + (action || 'open-wall') + '"';
    return '<div class="wall-hit top"' + a + ' style="left:0;top:0;width:' + cw + 'px;height:' + w + 'px;"></div>'
      + '<div class="wall-hit bottom"' + a + ' style="left:0;top:' + (ch - w) + 'px;width:' + cw + 'px;height:' + w + 'px;"></div>'
      + '<div class="wall-hit left"' + a + ' style="left:0;top:0;width:' + w + 'px;height:' + ch + 'px;"></div>'
      + '<div class="wall-hit right"' + a + ' style="left:' + (cw - w) + 'px;top:0;width:' + w + 'px;height:' + ch + 'px;"></div>';
  };

  ui.isoBoard = function (cols, rows, inner, opt) {
    opt = opt || {};
    var M = ui.isoMetrics(cols, rows);
    /* v42（需求 1）：棋盘不再需要分城内外 —— 留缝已统一为 `.iso-board .tile-face`
       的 1px 内缩（v41 曾用 opt.cls 给城外挂 .ext-board 做特例，现已收掉）。 */
    return '<div class="iso-board" style="width:' + M.w + 'px;height:' + M.h + 'px;'
      + '--tile-clip:' + M.clip.replace(/"/g, '') + ';">'
      /* v89.169：wall 三态 —— 'ghost' = 未修建虚影环；其余真值 = 已修建实墙；假值 = 不画。
         （围墙 0 级的可见入口：以前 0 级整圈不画，棋盘上找不到墙。） */
      + (opt.wall === 'ghost' ? ui.isoWallGhostSVG(cols, rows)
        : (opt.wall ? ui.isoWallSVG(cols, rows) : ''))
      + inner
      + (opt.wallHit ? ui.wallHitHTML(cols, rows, opt.wallAction) : '')
      + '</div>';
  };

  /* 单个地块。o 需带 M（度量）、col、row
     注意：元素盒宽 = W+SKEW、高 = H，其 **50%/50% 正好是格心**，
     所以建筑只需 left/top 50% + translate(-50%,-100%) 就"站"在格心上。 */
  /* ============================================================
   * 格内单元（v20）
   *   · 地块与建筑**同位同尺寸**：图标居中，不再 translateY 上浮
   *   · 名字与等级写在格内底部的一行标签里（需求 1）
   *   · 施工中显示图标 + 居中百分比 + 底部进度条
   * ============================================================ */
  /* ============================================================
   * 建筑「高度」随等级（v39 · 需求 2/3）
   * ------------------------------------------------------------
   * 老板要"从建筑高度…搞出一点区分度"。做法不是把图标整体放大，
   * 而是**底部固定、向上长**（CSS 里 transform-origin: 50% 100%）：
   * 于是 lv1 的小屋与 lv12 的大殿在同一格里的"占地"一样，
   * 只是高出来的部分更多 —— 这才是"建筑长高"的观感。
   * 系数收在唯一一处：0.018/级，满级(lv12) 约 +20%。
   * ============================================================ */
  ui.lvlScale = function (lv) {
    var n = Math.max(1, Math.min(12, Number(lv) || 1));
    /* v90.12（老板 3）：「城内部分建筑物大了一点，超出地块了」——
       原每级 +1.8%（满级 ×1.198）会让建筑图标顶出地块；收到每级 +0.6%（满级 ×1.066）。 */
    return (1 + (n - 1) * 0.006).toFixed(3);
  };

  ui.isoCell = function (o) {
    var M = o.M;
    var left = Math.round(M.x(o.col, o.row));
    var top = Math.round(M.y(o.col, o.row));
    var cls = 'iso-tile ' + (o.cls || '');
    var attr = o.act ? ' data-action="' + o.act + '"' + (o.idx != null ? ' data-idx="' + o.idx + '"' : '') : '';
    var inner = '';
    if (o.pending) {
      /* 升级中：建筑本体仍在（图标 + 名称 + 进度）；新建：施工占位 */
      inner = (o.icon
          ? o.icon + '<span class="tile-pct" data-' + (o.kind === 'ext' ? 'ext' : 'build') + '-progress="' + o.kind + ':' + o.idx + '">' + (o.pct || '…') + '</span>'
          : '<span class="tile-scaf">⚒</span><span class="tile-pct" data-' + (o.kind === 'ext' ? 'ext' : 'build') + '-progress="' + o.kind + ':' + o.idx + '">' + (o.pct || '…') + '</span>') +
        '<span class="tile-pbar"><i data-build-bar="' + o.kind + ':' + o.idx + '" style="width:' + (o.pctNum || 0) + '%"></i></span>' +
        (o.name ? '<span class="tile-label"><span class="nm">' + o.name + '</span></span>' : '');
    } else if (o.addHint) {
      inner = '<span class="iso-add">＋</span>';
    } else {
      /* v89.229（老板「建筑名称和等级都放顶部，建筑名称的文字色块行高调高」）：
         名称行移到**格顶**、族色编码由名称文字色块承载；等级角标并入名称行右端
         （同在格顶，flex 行内）——v23 的"右上角独立角标 + 底部标签"分工退役。
         无名称时角标独立显示（防御：现状两条渲染路径都带名，此为兜底）。 */
      var badge = o.lvl
        ? '<span class="tile-badge' + (o.lvlMax ? ' max' : '') + '">' + o.lvl + '</span>'
        : '';
      var lab = o.name
        ? '<span class="tile-label"><span class="nm">' + o.name + '</span>' + badge + '</span>'
        : badge;
      inner = (o.icon || '') + lab;
    }
    return '<div class="' + cls + '"' + attr + (o.sel ? ' data-sel="1"' : '') +
      ' style="left:' + left + 'px;top:' + top + 'px;width:' + M.W + 'px;height:' + M.H + 'px;">' +
      '<i class="tile-face"></i>' +
      '<span class="tile-art"' + (o.lvScale ? ' style="--lvs:' + o.lvScale + '"' : '') +
        '>' + inner + '</span>' +
      '</div>';
  };

  ui.buildCellHTML = function (cell, idx, city, pos) {
    var M = pos.M, col = pos.col, row = pos.row;
    if (cell.pending) {
      var pr = GAME.buildProgress('city', idx);
      var isUp16 = (cell.pending.targetLevel || 1) > 1;
      var pb16 = DATA.BUILDINGS[cell.pending.buildId];
      return ui.isoCell({ M: M, col: col, row: row, cls: 'busy', idx: idx, act: 'build-cell', kind: 'city',
        pending: true, pct: (pr ? pr.label : '…'), pctNum: (pr ? pr.pct : 0),
        icon: (isUp16 && cell.build) ? GAME.icons.forBuilding(cell.build.id) : null,
        name: (isUp16 ? ((pb16 ? pb16.name : '建筑') + ' 升级中') : '') });
    }
    if (!cell.build) {
      /* v91.19（老板 1）：**预留位** —— 固定栏位里"指定建筑"的槽：显示预定建筑名（暗字）；
         满足前置（`buildPrereqOf`）时地块边缘**渐变闪烁**，提示"此处现在可建"。居所槽仍为普通空位。 */
      var fixedBid = GAME.fixedBidAt ? GAME.fixedBidAt(idx) : 'minfang';
      if (fixedBid && fixedBid !== 'minfang' && DATA.BUILDINGS[fixedBid]) {
        /* v2026-10-31（老板）：预留位**不再框选 / 不显示建筑名** —— 仍预留（位置不变），
           满足建造条件时保留边缘闪烁（cls 带 ready）。推荐建筑在弹窗第一层给出。 */
        var rOk = GAME.buildPrereqOf ? GAME.buildPrereqOf(city, fixedBid, 1).ok : false;
        return ui.isoCell({ M: M, col: col, row: row, cls: 'empty reserve' + (rOk ? ' ready' : ''),
          idx: idx, act: 'build-cell', addHint: true });
      }
      return ui.isoCell({ M: M, col: col, row: row, cls: 'empty', idx: idx, act: 'build-cell', addHint: true });
    }
    var b = DATA.BUILDINGS[cell.build.id];
    var isGov = cell.official && cell.build.id === 'guanfu';
    /* v20：等级只传数字，满级另行标注（写法从 "Lv3满" 改为 "3 满"） */
    var isMax = cell.build.lvl >= GAME.buildCapOf(city, cell.build.id, cell.build);   /* v89.220：本座宽限 */
    if (!isGov) {
      /* v23：只传数字（"满"由绿色角标表达，不再拼进文本） */
      /* v39：挂 `ser-<系列>` —— 城内建筑按行当分色（数据侧唯一来源 DATA.SERIES）
         v89.107（老板）：「有警报时，建筑瞭望塔颜色明暗闪烁」——
         瞭望塔格在**预警窗内**挂 .alarm（CSS 做明暗呼吸），窗口口径走唯一出口
         GAME.invasionAlertOf（与军务·警报页、报信消息同源）。 */
      var alarm = (cell.build.id === 'fenghuotai' && GAME.invasionAlertOf && GAME.invasionAlertOf(city)) ? ' alarm' : '';
      /* v91.22（老板 1）：**瞭望塔地块底色 = 民居系**（民生·暖陶）—— 视觉上归入"无操作/民生"色块；
         其族属（DATA 的 series='mil' · 军事分组逻辑）保持不变，只改**渲染族色**。 */
      var _serCls = (cell.build.id === 'fenghuotai') ? 'live' : (b.series || 'gov');
      return ui.isoCell({ M: M, col: col, row: row,
        cls: 'built ser-' + _serCls + alarm, built: true, idx: idx, act: 'build-cell',
        /* v89.227：先查等级档位图（_t2/_t3）；缺则回退基础图。基础图那次调用
           保留 `GAME.icons.forBuilding(cell.build.id)` 原字符串（smoke 结构断言查它）。 */
        icon: (GAME.icons.bmBuildingTier(cell.build.id, cell.build.lvl) || GAME.icons.forBuilding(cell.build.id)), name: b.name,
        lvl: cell.build.lvl, lvlMax: isMax, lvScale: ui.lvlScale(cell.build.lvl) });
    }
    /* 政务厅 4 格（v23 · 需求 4）：不再逐格渲染 —— 由 ui.govPalaceHTML 跨格画成一座宫殿，
       这里只返回一个占位锚点（保持格序稳定，便于测试与几何断言）。 */
    return '';
  };

  /* ============================================================
   * 政务厅宫殿（v23 · 需求 4）
   * ------------------------------------------------------------
   * 政务厅**固定占 4 格**（2×2，位于棋盘正中 —— 第三行 4-5 与第四行 4-5，见 GAME.govCellsOf），
   * 数据上仍是 4 个普通格（建造队列、迁移保护、存档都依赖这个结构），
   * 但视觉上按 4 格的包围盒**融合成一座宫殿**：
   *   台基 → 台阶 → 檐柱 → 一层飞檐 → 二层主体 → 二层飞檐 → 屋脊鸱吻 → 金匾
   * 此前是一格立图标、其余三格压暗当"台基"，看起来像"地砖上插了个图标"。
   * ============================================================ */
  ui.govPalaceHTML = function (city, M, opt) {
    var idxs = [];
    city.cells.forEach(function (x, i) { if (x.official) idxs.push(i); });
    if (!idxs.length) return '';
    var c0 = 99, c1 = -1, r0 = 99, r1 = -1;
    idxs.forEach(function (i) {
      var cc = i % city.col, rr = Math.floor(i / city.col);
      if (cc < c0) c0 = cc; if (cc > c1) c1 = cc;
      if (rr < r0) r0 = rr; if (rr > r1) r1 = rr;
    });
    var left = Math.round(M.x(c0, r0)), top = Math.round(M.y(c0, r0));
    var W = (c1 - c0 + 1) * M.W, H = (r1 - r0 + 1) * M.H;

    var main = city.cells[idxs[0]];
    var lvl = (main.build && main.build.lvl) || 1;
    var b = DATA.BUILDINGS.guanfu;
    var isMax = b && main.build && main.build.lvl >= GAME.buildCapOf(city, 'guanfu');
    var pending = idxs.some(function (i) { return !!city.cells[i].pending; });
    var pr = pending ? GAME.buildProgress('city', idxs[0]) : null;

    /* 宫殿本体：台基 → 台阶 → 柱 → 双层飞檐 → 屋脊 → 匾额 */
    var svg =
      '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" class="gov-svg">' +
      '<defs>' +
        '<linearGradient id="govRoof" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#6b4a3a"/><stop offset="100%" stop-color="#3d2a20"/></linearGradient>' +
        '<linearGradient id="govBody" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#7a3a2c"/><stop offset="100%" stop-color="#4a211a"/></linearGradient>' +
        '<linearGradient id="govBase" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#4a4238"/><stop offset="100%" stop-color="#2a251e"/></linearGradient>' +
        '<linearGradient id="govGold" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#e8c878"/><stop offset="100%" stop-color="#b8892f"/></linearGradient>' +
      '</defs>' +
      /* 台基 */
      '<path d="M6 88 h88 v8 h-88 Z" fill="url(#govBase)"/>' +
      '<path d="M6 88 h88 v1.6 h-88 Z" fill="rgba(255,255,255,.14)"/>' +
      '<path d="M10 86 h80 v2 h-80 Z" fill="rgba(255,255,255,.07)"/>' +
      /* 台阶 */
      '<path d="M40 96 h20 v4 h-20 Z" fill="#3a332b"/>' +
      '<path d="M37 93 h26 v3 h-26 Z" fill="#453d33"/>' +
      /* 檐柱 */
      '<g fill="#6a3a2a">' +
        '<rect x="18" y="56" width="4" height="30" rx="1"/>' +
        '<rect x="34" y="56" width="4" height="30" rx="1"/>' +
        '<rect x="62" y="56" width="4" height="30" rx="1"/>' +
        '<rect x="78" y="56" width="4" height="30" rx="1"/>' +
      '</g>' +
      /* 一层主体 + 门窗 */
      '<rect x="14" y="58" width="72" height="28" fill="url(#govBody)"/>' +
      '<rect x="44" y="66" width="12" height="20" rx="1" fill="#2a1510"/>' +
      '<rect x="26" y="66" width="9" height="9" rx="1" fill="#c9a24b" opacity=".55"/>' +
      '<rect x="65" y="66" width="9" height="9" rx="1" fill="#c9a24b" opacity=".55"/>' +
      /* 一层飞檐（两端上翘） */
      '<path d="M6 58 Q30 46 50 46 Q70 46 94 58 Q72 52 50 52 Q28 52 6 58 Z" fill="url(#govRoof)"/>' +
      '<path d="M6 58 q-4 -3 -6 -7 q6 4 9 5 Z" fill="#6b4a3a"/>' +
      '<path d="M94 58 q4 -3 6 -7 q-6 4 -9 5 Z" fill="#6b4a3a"/>' +
      /* 二层主体 */
      '<rect x="28" y="36" width="44" height="10" fill="url(#govBody)"/>' +
      '<rect x="42" y="36" width="16" height="10" rx="1" fill="url(#govGold)" opacity=".85"/>' +
      /* 二层飞檐 */
      '<path d="M16 36 Q34 24 50 24 Q66 24 84 36 Q68 30 50 30 Q32 30 16 36 Z" fill="url(#govRoof)"/>' +
      '<path d="M16 36 q-4 -3 -6 -7 q6 4 9 5 Z" fill="#6b4a3a"/>' +
      '<path d="M84 36 q4 -3 6 -7 q-6 4 -9 5 Z" fill="#6b4a3a"/>' +
      /* 屋脊 + 鸱吻 */
      '<rect x="42" y="21" width="16" height="3.4" rx="1" fill="url(#govGold)"/>' +
      '<path d="M41 21 q-2 -4 1 -6 q1 3 2 4 Z" fill="#c9a24b"/>' +
      '<path d="M59 21 q2 -4 -1 -6 q-1 3 -2 4 Z" fill="#c9a24b"/>' +
      '<circle cx="50" cy="17" r="2.4" fill="#fff3cf"/>' +
      '</svg>';

    /* ============================================================
     * v36（需求 1「政务厅的贴图没变」）：政务厅位图优先
     * ------------------------------------------------------------
     * 政务厅是全城**唯一**不走 GAME.icons.forBuilding 的建筑 —— 它有下面这段
     * 专属手写 SVG（v23 把 4 格融成一座宫殿）。所以 v35 接入 AI 位图后，
     * 其它建筑都换了皮，只有政务厅还挂着原来那张手绘图。
     * 修复方式与图标层保持一致：位图优先、手写 SVG 退为兜底
     * （没生成位图 / 位图层未加载时，仍是原来那座宫殿，不会开天窗）。
     * ============================================================ */
    /* v90.64（老板「政务厅 12 级没更新贴图」）：政务厅**按等级取皮肤** ——
       此前恒取基础图 `bitmapSrc('building','guanfu')`，Lv≥6/≥12 的 _t2/_t3 从不生效。 */
    var _bmBase = (GAME.icons && GAME.icons.bitmapSrc) ? GAME.icons.bitmapSrc('building', 'guanfu') : '';
    var _bmTier = (GAME.icons && GAME.icons.bmBuildingTier) ? GAME.icons.bmBuildingTier('guanfu', lvl) : '';
    var _bmTierSrc = _bmTier ? ((String(_bmTier).match(/src="([^"]+)"/) || [])[1] || '') : '';
    var bmSrc = _bmTierSrc || _bmBase;
    var art = bmSrc
      ? '<img class="ico ico-img gov-img" src="' + bmSrc + '" alt="" draggable="false">'
      : svg;

    return '<div class="gov-palace' + (pending ? ' busy' : '') + '" data-action="build-cell" data-idx="' + idxs[0] + '"' +
      ' style="left:' + left + 'px;top:' + top + 'px;width:' + W + 'px;height:' + H + 'px;">' +
      '<i class="tile-face"></i>' +
      '<span class="gov-art">' + art + '</span>' +
      /* v89.235（老板「政务厅等级位置不对」）：等级角标并入名称行（与普通格子同构）——
         v89.229 把「名称+等级」合成同一行时，政务厅这块漏改：badge 独立成 span，
         而 .tile-badge 已改 position:static → 角标掉出格顶名称行、位置不对。 */
      '<span class="tile-label"><span class="nm">' + (b ? b.name : '政务厅') + '</span>' +
        (lvl ? '<span class="tile-badge' + (isMax ? ' max' : '') + '">' + lvl + '</span>' : '') +
      '</span>' +
      (pending ? '<span class="tile-pbar"><i data-build-bar="city:' + idxs[0] + '" style="width:' +
        (pr ? pr.pct : 0) + '%"></i></span>' +
        '<span class="tile-pct" data-build-progress="city:' + idxs[0] + '">' + (pr ? pr.label : '…') + '</span>' : '') +
      '</div>';
  };

  /* 功能建筑 → 功能入口（点建筑直达其功能；功能归属明确）
     v68（老板「操作项命名合理」）：统一命名规范 ——
       · 格式：图标 + 用途短语；多功能面板写「用途A · 用途B」；
       · **名字要覆盖面板的全部内容**（点了名不副实就是误导）——
         例：政务厅入口原叫「征收」，面板里却有征调民力 / 本城特产 / 岁贡 / 改名，
         已改「政务厅事务」；练兵场/军营/作坊去掉与建筑名重复的抬头词。 */

  /* ============================================================
   * 机工坊 · 器械与工事（v62 · 老板）
   * ------------------------------------------------------------
   * 老板：「机工坊可以造箭塔，箭塔默认参与防守」。
   *
   * 作坊本来就管"造攻守城器械"（原入口直接跳募兵面板的 siege 模式）；
   * 现在它多了一件事：**造箭塔**。所以入口改成这扇小面板，两块并排：
   *   · 制造器械 → 仍走原来的募兵面板（siege 模式），不复制任何配置；
   *   · 城防工事 → 就地建造箭塔（数量、造价、上限都读 domain 的唯一出口）。
   * ⚠️ 箭塔有**两个来源**（城防折出 / 作坊建造），所以面板必须把来源拆开写清楚，
   *    否则玩家会以为"我造了 6 座，怎么显示 18 座"。
   * ============================================================ */
  ui.openWorkshop = function (idx) {
    var c = GAME.currentCity();
    if (!c) return;
    var lv = GAME.buildingLevel(c, 'gongjiangzuofang');
    ui._workshopIdx = (idx == null || !isFinite(Number(idx))) ? null : Number(idx);
    var TW = DATA.WALL_TOWER;
    var built = GAME.towersBuiltOf(c);
    var fromDef = GAME.towersFromDef(c);
    var total = GAME.towerCountOf(c);
    var cap = GAME.towerCapOf(c);
    var room = GAME.towerRoomOf(c);
    var unit = GAME.towerCostOf(1);
    var costStr = GAME.costString(unit);
    var R = GAME.res(c);
    var afford = true;
    for (var k in unit) if ((R[k] || 0) < unit[k]) afford = false;
    var chips = room > 0
      ? [[1, '造 1 座'], [5, '造 5 座'], [999, '造满（' + room + ' 座）']].map(function (p) {
          /* v90.44（老板）：造价不再独立成行 —— 移入 chip 悬停。 */
          return '<span class="chip" data-action="tower-build" data-city="' + c.id +
            '" data-n="' + p[0] + '" data-idx="' + (ui._workshopIdx == null ? '' : ui._workshopIdx) + '"' +
            ' title="每座造价：' + U.escape(costStr) + '">' +
            p[1] + '</span>';
        }).join('')
      : '';
    ui.openShell({
      title: '🛠️ 精密制造厂 · Lv' + lv,
      sub: '器械制造与城防工事',
      /* 尺寸用**默认档**（660×620）而不是 sm：实测 sm（440×420）下正文超出 36px，
         会出现弹窗内滚动条 —— 那是老板明令禁止的（"弹窗内禁止下拉条，一律分页"）。 */
      body:
        '<div class="m-sec">制造器械</div>' +
        '<div class="op-row"><button class="btn gold" data-action="open-siege" data-idx="' +
          (ui._workshopIdx == null ? '' : ui._workshopIdx) + '">🛠️ 造东风快递 / 无人轰炸机等</button></div>' +
        '<div class="op-zone"><div class="op-hint">器械随军出征，用于拆箭塔、破围墙。</div></div>' +
        '<div class="m-sec" style="margin-top:10px;">城防工事 · ' + TW.name + '</div>' +
        '<div class="attr"><span class="k">本城箭塔</span><span class="v">' +
          '<b style="color:var(--gold-light);">' + total + '</b> 座　<span class="ui-sub">（城防折出 ' +
          fromDef + ' ＋ 作坊自建 ' + built + '）</span></span></div>' +
        '<div class="attr"><span class="k">自建上限</span><span class="v">' +
          built + ' / ' + cap + '　<span class="ui-sub">作坊每级 +' + TW.buildMaxPerLv + ' 座</span></span></div>' +
        /* v90.44：每座造价独立行撤除 —— 已进上方 chip 悬停 */
        '<div class="attr"><span class="k">本城守备力</span><span class="v good">' +
          GAME.cityDefense(c) + '　<span class="ui-sub">每座自建箭塔 +' + TW.homeDef + '</span></span></div>' +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-hint">' +
          '箭塔<b>默认参与防守</b>：造好即计入城头火力与守备力，无须指派。' +
          (room > 0 ? '' : '<br><b style="color:var(--amber);">已达上限 —— 升级作坊可再造。</b>') +
        '</div>' +
        '<div class="op-row" style="margin-top:6px;">' +
          (chips || '<span class="op-done">自建已满</span>') +
        '</div></div>',
      foot: '<div class="m-foot">' +
        (room > 0 && afford ? '' : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* v89.86（整改 P-04）：前置未满足时的展示文案 —— 若前置建筑**正在升级中**
     且升完就够（队列 targetLevel ≥ 需求），改报「X 升级中（剩余 T），完成后可建」；
     否则回落标准 short（"需政务厅 Lv2"）。两个调用点共用：建造菜单卡片 / 建筑面板升级按钮。 */
  ui.prereqText = function (city, pre) {
    if (!pre || pre.ok) return '';
    var list = pre.list || [];
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var q = GAME.pendingUpgradeOf ? GAME.pendingUpgradeOf(city, o.bid) : null;
      if (q && (q.targetLevel || 0) >= o.need) {
        var left = Math.max(0, (q.totalTime - q.elapsed) / GAME.timeScale());
        return o.name + '升级中（剩余 ' + U.durExact(left) + '），完成后可建';
      }
    }
    return pre.short;
  };

  /* ============================================================
   * v89.135（老板 11）：「建筑界面的升级按钮调整，费用改悬停显示，
   *   第一行显示资源，第二行显示所需珠宝，'费用'两个字不要。
   *   按钮变成第一行为升级两个字，第二行参考拆除按钮，LvX 到 LvX+1」——
   * 悬停费用文本的唯一出口（城内升级 / 围墙修建 / 城外升级三处共用）：
   *   第一行 耗时（增值：改前耗时散在别处）
   *   第二行 资源
   *   第三行 💎 珠宝（带持有数 —— 原面板行的"持有/需求"对比不丢）
   * 不出现"费用"二字。
   * ============================================================ */
  /* v89.161：逾溢折损周期的**现实时间换算**（唯一出口）——
     老板问「10 倍速下现实时间是多长」：一段"1 游戏日"在 10× 下 = 2.4 现实小时。
     这里按当前倍速换算，悬停/面板直接读它（改数据只改 DATA.OVERFLOW，文案自动跟）。 */
  ui.rotPeriodRealText = function () {
    var C = (typeof DATA !== 'undefined' && DATA.OVERFLOW) || {};
    var ts = Math.max(1, GAME.timeScale());
    var sec = ((C.periodGameHours == null ? 24 : C.periodGameHours) * 3600) / ts;
    var txt;
    if (sec >= 5400) txt = (Math.round(sec / 360) / 10) + ' 小时';
    else if (sec >= 90) txt = Math.round(sec / 60) + ' 分钟';
    else txt = Math.round(sec) + ' 秒';
    return txt + '（@' + ts + '×）';
  };

  ui.buildCostTip = function (cost) {
    if (!cost) return '—';
    var lines = [];
    if (cost.time) lines.push('耗时 ' + U.durExact(cost.time / Math.max(1, GAME.timeScale())));
    var resParts = [];
    for (var k in cost) {
      if (k === 'time' || k === 'jewel') continue;
      var name = k;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) name = r.name; });
      resParts.push(name + ' ' + U.fmt(cost[k]));
    }
    if (resParts.length) lines.push(resParts.join(' · '));
    var need = GAME.jewelNeedOf ? GAME.jewelNeedOf(cost) : {};
    var jp = [];
    var inv = (GAME.state && GAME.state.items) || {};
    for (var jid in need) {
      var jn = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
      jp.push('💎 ' + jn + ' ×' + need[jid] + '（持 ' + (inv[jid] || 0) + '）');
    }
    if (jp.length) lines.push(jp.join(' · '));
    /* v89.161（老板 5）：费用里含旧币时注明口径 —— 旧币全境通用，货品按本城结算 */
    if (cost.gold) lines.push('（旧币：全境通用 · 净水/生物质/电能/废钢：按本城结算）');
    return lines.join('\n') || '—';
  };

  ui.openBuildModal = function (idx, cityId, mode) {
    /* v89.174：cityId 可选 —— 弹窗 **live 每秒重开**时必须**锁定"打开弹窗的那座城"**
       （否则玩家切城后，重开会把同号格子开到另一座城上）。 */
    var s = GAME.state, c = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!c) return;                   /* 城市不存在（切档/拆除边界）：静默退出 */
    var cell = GAME.cellOf(c, idx);   /* v89.128：'wall' = 环城槽（不占格） */
    ui._curGrid = idx;
    /* ============================================================
     * v89.135（老板 10）：「政务厅界面简化，首页功能直接显示（城市名称修改，
     *   主城设置，基因实验室入口）。不再设置多一个'政务厅事务'按钮」——
     * openGuanfu 整条退役，功能直接落进政务厅格的建筑面板（施工中/已建两分支共用，
     * 升级期间照常可用）；"在办事项"不搬（老板：已有专门菜单）。
     * ============================================================ */
    var guanfuBox = '';
    var _gfBid135 = cell.build ? cell.build.id : (cell.pending ? cell.pending.buildId : null);
    if (_gfBid135 === 'guanfu') {
      var rn135 = GAME.canRenameCity(c);
      var isMain135 = GAME.isMainCity(c);
      var isSelf135 = (c.type || 'self') === 'self';
      var sp135 = isSelf135 ? null : GAME.specialtyOf(c);
      var y135 = isSelf135 ? null : GAME.cityDailyYield(c);
      var m135 = sp135 && DATA.MATERIAL_BY_ID[sp135.mat] ? DATA.MATERIAL_BY_ID[sp135.mat].name : (sp135 ? sp135.mat : '');
      var yParts = [];
      if (y135) {
        yParts.push('旧币 +' + U.fmt(y135.gold) + ' · 声望 +' + U.fmt(y135.rep));
        if (m135) yParts.push('特产 ' + m135 + ' ×' + y135.qty[0] + '~' + y135.qty[1]);
      }
      /* v89.137（老板 4）：「政务厅怎么没有设定主城的选项。不要全境营造总览，重复。
         图标大小规格不一样」——
         ① 主城入口**常显**：不再是"已是主城就整条撤掉"（那会让玩家在主城上看不到
            任何"主城"字样、以为没这功能）—— 已是主城 → 状态标记 + 悬停写明迁都方法；
         ② 「全境营造总览」整条退役（`ui.openBuildOverview` / `GAME.buildOverview` /
            `GAME.rushAllBuilds` / 三个动作 case 一并删，防死代码）——老板判定与
            各建筑面板的提速重复；
         ③ 规格统一：按钮全部 `btn sm`，图标统一 emoji 族（📝 / 🏛）。
         v89.224（老板 1）：「🧬 基因实验室」按钮**整条撤出** —— 实验室改由城内
         建筑「基因实验室」（honglusi 格）承载；本段只留改名 / 主城两键。 */
      guanfuBox = '<div class="op-zone"><div class="op-zone-t">政务厅要务</div>' +
        '<div class="op-row" style="flex-wrap:wrap;">' +
          '<button class="btn sm' + (rn135.ok ? '' : ' dim') + '" data-action="open-rename-city"' +
            (rn135.ok ? '' : ' disabled') + ' title="' +
            U.escape(rn135.ok ? '改名会同步到地图 / 侧栏 / 统计 / 战报抬头等所有引用处' : rn135.msg) +
            '">📝 修改城名</button>' +
          (isMain135
            ? '<span class="btn sm dim main-here" title="' +
              U.escape('本城即主城。主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
                + '　（迁都：到目标城的政务厅点「设为主城」，需 '
                + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 旧币）') +
              '">🏛 本城即主城</span>'
            : '<button class="btn sm gold" data-action="set-main-city" title="' +
              U.escape('主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
                + (GAME.mainCityOf()
                    ? '　（迁都需 ' + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 旧币）'
                    : '　（首设免费）')) +
              '">🏛 设为主城</button>') +
          /* v90.62（老板）：**放弃城市**选项并入政务厅要务（原只在城市操作弹窗）——
             仍需二次确认；最后一座城 / 尚有军队驻外时由 abandonCityCheck 拒绝。 */
          /* v91.72：只有**自建城且未设为主城**才给入口（判据同 GAME.abandonCityCheck · 不给必然被拒的按钮）。 */
          (((s.cities || []).length > 1 && (c.type || 'self') === 'self' && !c.origId && !isMain135)
            ? '<button class="btn sm red" data-action="city-abandon-ask" data-city="' + c.id +
              '" title="放弃本城（不可逆）：照表清理附属于本城的数据，该格归还地图">🗑 放弃城市</button>'
            : '') +
        '</div>' +
        (sp135 ? '<div class="attr"><span class="k">本城特产</span><span class="v">' + U.escape(m135) +
          '（' + sp135.tier + ' 阶）' +
          ui.help('如何收集本城特产：\n① 辖区岁贡 —— 每现实日自动入府，无需操作\n② 首府加成 —— 握有本区首府时，本区特产产量 ×' + DATA.STATE_SEAT_BONUS) +
          '</span></div>' : '') +
        (yParts.length ? '<div class="attr"><span class="k">岁贡 / 日</span><span class="v good">' +
          yParts.join(' · ') + '</span></div>' : '') +
        /* v91.02（老板）：「英雄列表也放入政务」—— 政务厅加入**本城英雄列表**（只读）：
           与英雄页**同源**（GAME.generalsIn → genCityOf），故两处名单永远一致。 */
        (function () {
          var gs91 = (GAME.generalsIn ? GAME.generalsIn(c) : []);
          var rows91 = gs91.map(function (gg) {
            var st91 = ui.genStatusName ? ui.genStatusName(gg) : '';
            return '<div class="attr"><span class="k">' + U.escape(gg.name) + '</span>' +
              '<span class="v">Lv' + (gg.level || 1) + (st91 ? ' · ' + U.escape(st91) : '') + '</span></div>';
          }).join('');
          return '<div class="m-sec" style="margin-top:10px;">🧑‍✈️ 本城英雄（' + gs91.length + '）</div>' +
            (rows91 || '<div class="note" style="margin:0;">本城暂无英雄 —— 到征召大厅招募、或从别城「英雄派遣」调入。</div>');
        })() +
        '</div>';
    }
    /* ============================================================
     * v89.177（老板「政务厅界面增加鼓舞民心，消减民怨的措施各 1 个，标题就叫民心/民怨，
     *   显示其值」）：「民心 / 民怨」段 —— 政务厅要务之下、在建队列之上。
     * 值走唯一出口（heartsOf/minyuanOf，民心=100−税率×100+安抚）；
     * 两个措施各每日一次、耗旧币（doHeartsAction 出口，界面不预判可行性——
     * 按了不可行会返回原因并 toast；按钮只按"本日是否已行"置灰）。
     * ============================================================ */
    /* v89.188（老板 5）：「怎么城内所有建筑都加上了民心民怨，只在政务厅」——
       生成门加政务厅判据（与 queueBox174 同款：`_gfBid135 === 'guanfu'`）；
       两处拼装点（施工中 / 正常态）零改动自动受益。 */
    var heartsBox177 = '';
    if (_gfBid135 === 'guanfu' && GAME.heartsOf && GAME.heartsActionOf) {
      /* v89.204（老板 1）：政务厅（当前城）民心走城级（含战争创伤） */
      var hb177 = (GAME.cityHeartsOf ? GAME.cityHeartsOf(c) : GAME.heartsOf());
      var my177 = Math.max(0, 100 - hb177);
      var mkAct177 = function (a) {
        if (!a) return '';
        /* data-action 必须**字面量**（audit 扫静态绑定：动态拼接 'hearts-' + id 会被判孤儿/不可达） */
        var cls177 = 'btn sm' + (a.ready ? ' gold' : '');
        var dis177 = a.ready ? '' : ' disabled data-why="本日已执行过该措施（每日一次）"';
        var tail177 = '（-' + U.fmt(a.cost) + ' 旧币 · +' + a.add + '）' + (a.ready ? '' : ' · 本日已行');
        var tip177 = '每日一次 · 消耗 ' + U.fmt(a.cost) + ' 旧币 · 安抚 +' + a.add + '（民心 / 民怨同步变化）';
        if (a.id === 'soothe') {
          return '<button class="' + cls177 + '"' + dis177
            + ' data-action="hearts-soothe" title="' + tip177 + '">🕊️ 消减民怨' + tail177 + '</button>';
        }
        return '<button class="' + cls177 + '"' + dis177
          + ' data-action="hearts-boost" title="' + tip177 + '">🎺 鼓舞民心' + tail177 + '</button>';
      };
      heartsBox177 = '<div class="op-zone"><div class="op-zone-t">民心 / 民怨</div>' +
        '<div class="attr"><span class="k">民心 / 民怨</span><span class="v"><b>'
          + Math.round(hb177) + '</b> / <b>' + Math.round(my177) + '</b>'
          + '<span class="ui-sub">　税率 ' + Math.round((s.tax || 0) * 100) + '% → 基准 '
          + Math.round(GAME.heartsBaseOf()) + '　安抚 ' + Math.round(GAME.heartsComfortOf())
          + ((GAME.heartsWarOf && GAME.heartsWarOf(c) > 0)
            ? '　战争创伤 −' + Math.round(GAME.heartsWarOf(c)) + '（每现实日恢复 '
              + (((DATA.SIEGE || {}).repairPerDay) || 0) + '）' : '')
          + '（随时间回落）</span></span></div>' +
        '<div class="attr"><span class="k">措施</span><span class="v">'
          + mkAct177(GAME.heartsActionOf('boost')) + ' ' + mkAct177(GAME.heartsActionOf('soothe'))
          + '</span></div>' +
        '</div>';
    }
    /* v89.174（老板 1）：「在城市的官方界面，政务厅要务的下方，显示本城在建的建筑队列和剩余时间」
       —— 只挂政务厅格；行内倒计时挂 data-build-progress / data-ext-progress
       （updateProgress 每秒刷），整段由弹窗 live 重开跟随"完成 / 新增"。
       v89.174（老板 2）：「读秒完成后，状态还是在建造中」—— 施工中分支此前**没接 live**
       （正常态 v89.135 已接）：补上，完成瞬间弹窗自动换回功能面板；
       回调统一走 liveFn174（**锁定城市** —— 切城后重开不会把同号格开到别城）。 */
    var queueBox174 = '';
    if (_gfBid135 === 'guanfu') {
      var qs174 = (s.queues.build || []).filter(function (q) { return q.cityId === c.id; });
      /* v91.72（老板）：多条目折叠 —— 默认只留一条汇总（N 项 + 最近一项的进度），
         展开才逐条列出（满 6 条不再把面板撑开）。≤3 条时默认展开。 */
      var _gfQKey174 = 'guanfu-queue-' + c.id;
      var _gfQOpen174 = (ui._foldOpen[_gfQKey174] == null) ? (qs174.length <= 3) : !!ui._foldOpen[_gfQKey174];
      var _first174 = qs174[0], _sum174 = '本城暂无在建工程';
      if (_first174) {
        var _b174 = DATA.BUILDINGS[_first174.buildId] || (DATA.EXT_BUILDINGS || {})[_first174.buildId] || {};
        var _pr174 = GAME.buildProgressOf(_first174);
        _sum174 = (qs174.length > 1
          ? ('在建 ' + qs174.length + ' 项 · 最近：' + (_b174.name || _first174.buildId) + ' ' + (_pr174 ? _pr174.label : ''))
          : ((_b174.name || _first174.buildId) + ' · ' + (_pr174 ? _pr174.label : '')));
      }
      queueBox174 = '<div class="op-zone"><div class="op-zone-t" data-action="fold-toggle" data-fold="guanfu-queue-' + c.id + '"' +
        ' style="cursor:pointer;user-select:none;" title="点击展开 / 收起重明细">' +
        (_gfQOpen174 ? '▾ ' : '▸ ') + '在建队列（' + qs174.length + '）' +
        '<span class="q-sec-n" style="float:right;">' + U.escape(_sum174) + '</span></div>' +
        (_gfQOpen174 ? (qs174.length ? qs174.map(function (q) {
          var bB = DATA.BUILDINGS[q.buildId];
          var bE = (DATA.EXT_BUILDINGS || {})[q.buildId];
          var nm = (bB && bB.name) || (bE && bE.name) || q.buildId;
          var what = q.type === 'build' ? '建造'
            : q.type === 'upgrade' ? ('升级至 Lv' + q.targetLevel)
            : q.type === 'ext_build' ? '城外营建'
            : ('城外升级至 Lv' + q.targetLevel);
          var pr = GAME.buildProgressOf(q);
          var attr = (q.type === 'build' || q.type === 'upgrade')
            ? ('data-build-progress="city:' + q.gridIndex + '"')
            : ('data-ext-progress="ext:' + q.extIdx + '"');
          return '<div class="attr"><span class="k">' + U.escape(nm) + '</span>' +
            '<span class="v">' + what + ' · <b ' + attr + '>' + (pr ? pr.label : '…') + '</b></span></div>';
        }).join('')
          : '<div class="attr"><span class="v" style="color:var(--text-dim);">本城暂无在建工程</span></div>') : '') +
        '</div>';
    }
    var liveFn174 = function () {
      if (!GAME.cityById(c.id)) { ui.closeModal(); return; }
      ui.openBuildModal(idx, c.id);
    };
    if (cell.pending) {
      var pb2 = DATA.BUILDINGS[cell.pending.buildId];
      /* v19：升级是**纯后台过程** —— 施工期间该建筑的功能照常可用。
         只有「新建」（地块上还没建筑）才没有任何功能可进。
         判据：cell.build 存在即视为升级（targetLevel>1），
         于是军营施工中仍可募兵、科研中心施工中仍可研究、制造厂施工中仍可打造。 */
      var isUpgrade = !!(cell.build && (cell.pending.targetLevel || 1) > 1);
      var pr16 = GAME.buildProgress('city', idx);
      var progBlock =
        '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-h1);font-weight:800;margin:8px 0;" data-modal-progress="city:' + idx + '">' + (GAME.buildPct('city', idx) || '…') + '</div>' +
        '<div class="pbar" style="width:70%;margin:0 auto 10px;"><i data-build-bar="city:' + idx + '" style="width:' + (pr16 ? pr16.pct : 0) + '%"></i></div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);">后台施工中，倒计时每秒更新，<b style="color:var(--gold-light);">不影响下方操作</b></div>';
      var fn = isUpgrade ? BLDG_FUNC[cell.build.id] : null;
      /* v68（弹窗统一）：施工中弹窗与正常态**同构** ——「名称 · Lv→Lv」+ 描述，
         危险操作进底栏（设计规范 §11）。
         v73（老板）：「建筑点开界面，顶部的图标也不要留，还是旧图标」——
         顶部图标块整体撤除（城内 / 城外 × 正常 / 施工中 四处一起撤），
         v72 的 .dlg-ico 尺寸盒随之退休 —— 没有图标，就没有 1024px 撑爆的土壤。 */
      ui.openModal(
        '<div class="gold-heading"' + (pb2 && pb2.desc ? ' data-tip="' + U.escape(pb2.desc) + '" style="cursor:help;"' : '') +
          '>' + (pb2 ? pb2.name : '建筑') +
          (isUpgrade ? (' · Lv' + (cell.pending.targetLevel - 1) + ' → Lv' + cell.pending.targetLevel) : '') + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-body);text-align:center;margin-bottom:12px;">' +
          (isUpgrade ? '🛠️ 升级中 · 后台施工，倒计时每秒更新，不影响下方操作'
                     : '🏗️ 建造中 · 倒计时每秒更新') + '</div>' +
        progBlock +
        (fn ? ('<div class="op-zone">' +
            /* v89.138（老板 4）：「建筑界面的"功能"两个字去掉，直接体现即可功能按钮」——
             标题行撤除，按钮直接呈现（施工中照常可用这层含义由上方"不影响下方操作"说明承担）。 */
            '<div class="op-row"><button class="btn gold" data-action="' + fn.act + '"' + (fn.view ? ' data-view="' + fn.view + '"' : '') +
              (fn.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + fn.label + '</button></div>' +
          '</div>')
          : '') +
        guanfuBox + heartsBox177 + queueBox174 +     /* v89.135：政务厅升级期间，改名/主城照常可用；v89.174：其下接「在建队列」 */
        '<div class="bldg-foot">' +
          /* v89.179b·P2-9：提速按钮显价（耗旧币不可逆但金额可见，与卸装/撤回行军同档，不加二次确认） */
          (function () {
            var _q = GAME.queueAt('city', idx);
            var _c = GAME.queueRushCost(_q);
            return '<button class="btn sm gold" data-action="rush-build" data-idx="' + idx + '"'
              + ' title="花旧币立即完成（工程价 20% × 剩余比例，约 ' + U.fmt(_c) + ' 旧币）">⚡ 提速'
              + (_c ? ' −' + U.fmt(_c) : '') + '</button>';
          })() +
          '<button class="btn sm red" data-action="cancel-build-ask" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>', { live: liveFn174 });
      return;
    }
    if (!cell.build && idx === 'wall') {
      /* v89.128（老板）：「围墙以**环城一圈的围墙结构**作为一个建筑（地位与城内建筑同），
         而不是占据城内一个地块」—— 围墙不占格，没有"空地可选"，入口 = 环城热区；
         这里给「修建」面板（造价 / 前置 / 说明）。 */
      var wb128 = DATA.BUILDINGS.chengqiang;
      var wcost128 = wb128.buildCost;
      wcost128 = GAME.buildCostDiscountOf(wcost128);   /* v89.179c：折扣唯一出口（成本打折 · 工期不动） */
      wcost128 = GAME.cityDefCostOf('chengqiang', wcost128, c);   /* v89.191：按城读城防科技 */
      var wpre128 = GAME.buildPrereqOf(c, 'chengqiang', 1);
      var wcan128 = GAME.canAfford(wcost128) && wpre128.ok;
      var wsub128 = !wpre128.ok ? ui.prereqText(c, wpre128)
        : (GAME.canAfford(wcost128) ? ('耗：' + GAME.costString(wcost128) + '（防御工事已折扣）') : '材料不足');
      ui.openModal(
        '<div class="gold-heading">🧱 围墙（未修建）</div>' +
        (wb128.desc ? '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' + U.escape(wb128.desc) + '</div>' : '') +
        '<div class="ui-sub" style="text-align:center;margin-bottom:10px;">环城一圈的围墙结构 · 不占城内地块 · 与城内建筑同一套管理</div>' +
        '<div class="bldg-bottom"><div class="bldg-acts">' +
          /* v89.135（老板 11）：修建键同构 —— 费用进悬停、两行（修建 / Lv0 → Lv1）；
             "材料不足/前置"等无法悬停的即时状态仍留在第二行。 */
          '<button class="btn gold bldg-act"' + (wcan128 ? '' : ' disabled') +
            ' title="' + U.escape(wcan128 ? ui.buildCostTip(wcost128) : wsub128) + '"' +
            ' data-action="confirm-build" data-idx="wall" data-build="chengqiang">修建围墙<span class="ba-sub">' +
            (wcan128 ? 'Lv0 → Lv1' : U.escape(wsub128)) + '</span></button>' +
        '</div><div class="bldg-foot">' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">耐久 100×N 万 · 守军防御 +10N% · 远程射程 +3N%</span>' +
        '</div></div>');
      return;
    }
    if (cell.build) {
      var b = DATA.BUILDINGS[cell.build.id];
      /* v68 · 逐步探索：卡在政务厅等级上时，'已满级' 会误导 —— 用前置检查给出准确原因 */
      /* v89.159（老板 2）：与 upgradeAt 同一把尺 —— 传本座目标等级，
         否则面板会显示"需政务厅 Lv5"而内核（修好后）放行，界面与执行分裂。 */
      var preUp = GAME.buildPrereqOf(c, cell.build.id, cell.build.lvl + 1, cell.build);   /* v89.220：同传本座 */
      var upCost = cell.build.lvl < GAME.buildCapOf(c, cell.build.id, cell.build) ? b.levelCost(cell.build.lvl) : null;
      var costStr = upCost ? GAME.costString(upCost) : (preUp.ok ? '已满级' : preUp.short);
      /* v89.104（老板「换成需要更多其他材料如珍珠等」）：高等级升级的**珠宝**单独一行 ——
         写"持有/需求"，缺料标红（与升级按钮的"材料不足"互相印证）。 */
      /* v89.135（老板 11）：面板上的珠宝行撤除 —— 费用（资源 + 珠宝两行）整体进**按钮悬停**
         （ui.buildCostTip · 含持有数对比，"缺不缺"信息不丢）。 */
      var jewelLine = '';
      var extra = '';
      if (b.id === 'minfang') extra = '<div class="attr"><span class="k">幸存者上限</span><span class="v good">' + b.pop[cell.build.lvl - 1] + '</span></div>';
      /* v82（老板）：「不需要显示附属野地/城外空地及其数量」—— 政务厅弹窗这两行退役。 */
      /* v89.102（老板）：口径 = **人马**（总兵力数），不是幸存者 —— 见 GAME.battle.marchCapOf */
      /* v89.132：改读 marchCapOf（唯一出口）—— 节钺练兵场扩编后，这里与练兵场面板同数 */
      if (b.id === 'xiaochang') extra = '<div class="attr"><span class="k">出征容量</span><span class="v">' + U.numText(GAME.battle.marchCapOf(c), 0) + ' 人马</span></div>';
      if (b.id === 'chengqiang') extra = '<div class="attr"><span class="k">耐久</span><span class="v">' + (100 * cell.build.lvl) + '万</span></div>' +
        '<div class="attr"><span class="k">守军防御</span><span class="v">+' + (10 * cell.build.lvl) + '%</span></div>';
      var bLv = cell.build.lvl;
      /* v28（需求 4/5）：军营面板必须列出**本营**的队列 ——
         玩家点开军营，看到的却是"可募兵种 12/18"，队列得去别处找。
         （队列数据本来就是按军营分的，只是这里从来没显示过。） */
      var barQueue = '';
      if (b.id === 'junying') {
        barQueue = ui.trainQueueBlock({ idx: idx, lvl: bLv }, c) +
          '<div class="ui-sub" style="margin-top:4px;">队列位 ' + GAME.trainQueueSlots(bLv, c) +
          '　（Lv5 / Lv10 / 满级各 +1 位）</div>';
      }
      if (b.id === 'junying') {
        var allT = Object.keys(DATA.TROOPS);
        var un = allT.filter(function (tid) { var u = DATA.TROOPS[tid].unlock || {}; return u.junying && bLv >= u.junying; });
        var nx = allT.filter(function (tid) { var u = DATA.TROOPS[tid].unlock || {}; return u.junying && u.junying === bLv + 1; });
        extra = '<div class="attr"><span class="k">可募兵种</span><span class="v">' + un.length + ' / ' + allT.length + '</span></div>'
          + (nx.length ? '<div class="attr"><span class="k">升 '+ (bLv+1) +' 级解锁</span><span class="v">' + nx.map(function(t){return DATA.TROOPS[t].name;}).join('、') + '</span></div>' : '');
      }
      if (b.id === 'shuyuan') {
        var tUn = DATA.TECH.filter(function (t) { return bLv >= t.lv; }).length;
        extra = '<div class="attr"><span class="k">可研究科技</span><span class="v">' + tUn + ' / ' + DATA.TECH.length + '</span></div>'
          + '<div class="attr"><span class="k">研究加速</span><span class="v">逆向工程每级 -5%</span></div>';
      }
      if (b.id === 'kezhan') extra = '<div class="attr"><span class="k">同时候选</span><span class="v">' + bLv + ' 位（每级+1）</span></div>';
      if (b.id === 'zhaoxianguan') extra = '<div class="attr"><span class="k">英雄容量</span><span class="v">' + s.generals.length + ' / ' + bLv + '</span></div>';
      /* v89.158（老板 1）：① "本仓储量"改**本座**口径 —— 改前把上限总额 ÷ 等级和，
         还把城外堆场摊了进来（无战储仓时干脆显示全额），数字对不上；
         ② "全境储量上限"标签错（v60 起仓储**按城**）→ 改"本城储量上限"。 */
      if (b.id === 'cangku') {
        var _sp158 = GAME.storePartsOf(c);
        var _per158 = _sp158.lv > 0 ? (_sp158.base / _sp158.lv) : _sp158.base;
        /* v89.212（老板 1）：上限**按资源分账** —— 逐资源列出（各含本类地块堆场） */
        var _caps212 = ['grain', 'wood', 'stone', 'iron'].map(function (k) {
          var _nm = ''; DATA.RESOURCES.forEach(function (r) { if (r.key === k) _nm = r.name; });
          return _nm + ' ' + U.fmt(_sp158.capByRes ? _sp158.capByRes[k] : _sp158.total);
        }).join(' · ');
        extra = '<div class="attr"><span class="k">本座储量</span><span class="v">' + U.fmt(Math.round(_per158 * bLv)) + '（Lv' + bLv + '）</span></div>'
          + '<div class="attr"><span class="k">本城储量上限</span><span class="v good">' + _caps212 + '（多仓叠加）</span></div>';
      }
      /* v89.62：去掉「商队 N 支」标注（老板「去除商队计数和限制，去除相应标注」）——
         交易站等级真正影响的是**折损**，这里就只报折损。 */
      if (b.id === 'shichang') extra =
        '<div class="attr"><span class="k">卖出折损</span><span class="v">×' + Math.min(0.95, 0.6 + bLv * 0.035).toFixed(2) + '</span></div>' +
        '<div class="attr"><span class="k">买入折损</span><span class="v">再扣 ' + Math.round((GAME.marketBuyCfg().loss || 0) * 100) + '%</span></div>';
      if (b.id === 'majiu') extra = '<div class="attr"><span class="k">机车解锁</span><span class="v">伏击车需1级 · 主战机甲/武装直升机需3级 · 狂猎/主战机甲需4级</span></div>';
      /* v89.157（老板 3）：「围墙等级不能低于政务厅超过 2 级」—— 面板显式给出"下一级要的围墙等级"，
         判据与升级拦截**同一出口**（buildPrereqOf 的 wallGate），不各算一份。 */
      if (b.id === 'guanfu') {
        var wl157 = GAME.buildingLevel(c, 'chengqiang');
        var need157 = Math.max(0, (cell.build.lvl + 1) - 2);
        var ok157 = wl157 >= need157;
        extra += '<div class="attr"><span class="k">围墙要求</span><span class="v' + (ok157 ? ' good' : '') + '">' +
          (need157 <= 0
            ? ('升 Lv' + (cell.build.lvl + 1) + ' 无围墙要求')
            : ('升 Lv' + (cell.build.lvl + 1) + ' 需围墙 ≥ Lv' + need157 + '（当前 Lv' + wl157 + (ok157 ? ' ✓' : ' ✗') + '）')) +
          '</span></div>';
      }
      /* v89.102（老板「主城随威望逐步解锁政务厅及其他建筑等级上限」）：把"这一级上限
         是怎么来的"就地摊开 —— 本城是主城且威望解锁 > 0 时才出这一行，
         否则玩家只会看到"已达最高等级"，不知道上限已被威望抬高过。 */
      var _lift = GAME.rankBuildCapOf ? GAME.rankBuildCapOf(c) : 0;
      if (_lift > 0) {
        var _cap = GAME.buildCapOf(c, b.id, cell.build);   /* v89.220：本座宽限（与升级口径同尺） */
        /* v89.159（老板 2）：政务厅总闸（其他建筑 ≤ 政务厅等级）会先于"档位 + 威望"生效 ——
           上限被政务厅压住时把**真正在限制它的那一条**写出来，
           否则玩家看到 Lv12 却读到"档位 24 + 威望解锁 +3"，数字对不上账。 */
        var _theo = DATA.MAX_BLEVEL + GAME.cityBuildBonus(c) + _lift;
        var _govNow = GAME.buildingLevel(c, 'guanfu');
        var _why = (b.id !== 'guanfu' && _govNow > 0 && _cap <= _govNow && _govNow < _theo)
          ? ('受政务厅 Lv' + _govNow + ' 限制 · <b>升政务厅可提升</b>')
          : ('档位 ' + (DATA.MAX_BLEVEL + GAME.cityBuildBonus(c)) + ' + <b>威望解锁 +' + _lift + '</b>');
        extra += '<div class="attr"><span class="k">等级上限</span><span class="v good">Lv' + _cap +
          '<span style="color:var(--text-dim);">（' + _why + '）</span></span></div>';
      }
      /* v60（需求 3）：**建筑专精写在这里**（老板：「写在对应建筑的介绍里就好，
         不要写在全境汇总」）。数据驱动 —— 本建筑在 DATA.MASTERY 里有条目就显示。
         v89.137（老板 5）：三档（12/24/36）—— 显示逐档进度与"当前 ×N / 下一档"，
         门槛与档数全读 DATA.MASTERY_TIERS / GAME.masteryTierOf（不手抄）。
         不逐个建筑手写文案：那又是一份平行数据，改一处忘一处。 */
      var mast = null;
      (DATA.MASTERY || []).forEach(function (m) { if (m.bid === b.id) mast = m; });
      if (mast) {
        var tiers137 = DATA.MASTERY_TIERS || [DATA.MAX_BLEVEL];
        var t137 = GAME.masteryTierOf(c, b.id);
        var prog137 = tiers137.map(function (t, i) {
          return 'Lv' + t + (t137 > i ? ' <b style="color:var(--green-ok);">✓</b>' : '');
        }).join(' → ');
        extra += '<div class="attr"><span class="k">建筑专精</span><span class="v' + (t137 > 0 ? ' good' : '') + '">'
          + prog137 + '　·　'
          + (t137 > 0 ? ('当前 <b>×' + t137 + '</b>：' + mast.txt) : ('Lv' + tiers137[0] + ' 起：' + mast.txt))
          /* tier 0 时"Lv12 起"本身已是目标，不再重复一条"下一档"；已到档才给"下一档/已满档" */
          + (t137 > 0
              ? (t137 < tiers137.length
                  ? '<span style="color:var(--text-dim);">（下一档 Lv' + tiers137[t137] + ' → ×' + (t137 + 1) + '）</span>'
                  : '<span style="color:var(--text-dim);">（已满档 ×' + tiers137.length + '）</span>')
              : '')
          + '</span></div>';
      }
      /* v89.135（老板 10）：`guanfuBox`（政务厅要务段）在函数顶部统一定义 ——
         施工中分支与已建分支共用（升级期间改名/主城照常可用）。 */

      ui.openModal(
        /* v73（老板）：顶部图标不留（旧 emoji 图标本就不如棋盘位图，索性撤下）。
           v76（老板）：「这种备注去掉：招募英雄…市井传闻查英雄坐标」—— 那时撤的是
           **纯功能罗列**（功能各面板都已写明）；v89.113（老板）：「在各建筑名称下
           合适的地方写一个简要的说明…写得有历史感，大气沧桑一点」—— 现将
           **历史感的一句 + 功能要点**（DATA.BUILDINGS[].desc 已整体重写）加回标题正下方，
           与 v76 的诉求不冲突：短、居中小字、不占版面。 */
        /* v91.14（老板）：建筑备注**不再直接写**在标题下，改为**悬停建筑名**显示
           （data-tip → 全站 #tip-layer 浮层）。城内/城外/施工中四处一致。 */
        '<div class="gold-heading"' + (b.desc ? ' data-tip="' + U.escape(b.desc) + '" style="cursor:help;"' : '') +
          '>' + b.name + ' · Lv' + cell.build.lvl + '</div>' +
        extra +
        guanfuBox + heartsBox177 + queueBox174 +
        jewelLine +
        barQueue +
        /* v68（弹窗统一 · 设计规范 §11）动线：① 功能「用建筑」（金色主按钮）；
           v76（老板）：「建筑的升级，拆除（1级，只能逐级拆除），移动/交换放在同一行上，
           并进行你的设计小巧思。建筑界面的关闭按钮在弹窗界面的最底部」——
           ② 操作三键**同排**、等宽，每键带一行小字说明后果（费用 / 降级去向 / 用途）；
           ③ 关闭单独一行、钉在弹窗最底部。 */
        (function () {
          /* v89.140：条目可以是**单条**或**数组**（制造厂 = 打造 + 熔铸强化两颗） */
          var fs = [].concat(BLDG_FUNC[b.id] || []);
          if (!fs.length) return '';
          return '<div class="op-zone">' +
            /* ⛔ v89.138（老板 4）：标题行撤除（同上） */
            '<div class="op-row">' + fs.map(function (f) {
              return '<button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
                (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button>';
            }).join('') + '</div>' +
          '</div>';
        })() +
        /* v80（老板）：「升级，拆除（拆1级），移动/交换固定放在底部，关闭的上方」——
           三键与关闭合成一块**吸底操作区**（.bldg-bottom）：内容再长也钉在弹窗下沿，
           上排＝操作三键，下排＝关闭。 */
        '<div class="bldg-bottom">' +
          '<div class="bldg-acts">' +
          /* v147/v149：升级前先看下一级 —— 用**小眼睛**浮在操作区右上角，
             不占三键的位置（实机自检：四个大键会把"升级"挤出主视线）。 */
          '<span class="bldg-eye" data-action="bld-preview" data-build="' + b.id +
            '" data-lvl="' + (cell.build.lvl + 1) + '" title="进 3D 看一眼 Lv' + (cell.build.lvl + 1) + ' 的样子（不占格、不扣费）">👁 Lv' +
            (cell.build.lvl + 1) + '</span>' +
          (upCost
            ? '<button class="btn gold bldg-act" data-action="confirm-upgrade" data-idx="' + idx + '"' +
                ' title="' + U.escape(ui.buildCostTip(upCost)) + '">升级' +
                '<span class="ba-sub">Lv' + cell.build.lvl + ' → Lv' + (cell.build.lvl + 1) + '</span></button>'
            /* v89.86（P-04）：前置升级中 → 报"X 升级中（剩余 T）"，不再像永久锁 */
            : '<button class="btn bldg-act dim" disabled data-why="' +
                U.escape(preUp.ok ? '已达最高等级' : ui.prereqText(c, preUp)) + '">⬆ 升级<span class="ba-sub">' +
                (preUp.ok ? '已达最高等级' : U.escape(ui.prereqText(c, preUp))) + '</span></button>') +
          '<button class="btn red bldg-act" data-action="demolish-ask" data-kind="city" data-idx="' + idx + '"' +
            ' title="拆除需二次确认">⛏ 拆 1 级<span class="ba-sub">' +
            (cell.build.lvl > 1 ? ('Lv' + cell.build.lvl + ' → Lv' + (cell.build.lvl - 1)) : '整座移除') + '</span></button>' +
          (b.id === 'guanfu' || b.id === 'chengqiang' ? ''   /* v89.128：围墙不占格，无"互换"可言 */
            : '<button class="btn bldg-act" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换<span class="ba-sub">与地块互换</span></button>') +
          '</div>' +
          '<div class="bldg-foot">' +
            '<button class="btn" data-action="close-modal">关闭</button>' +
          '</div>' +
        '</div>'
      , { live: liveFn174 });
      /* v89.135（老板 7）：live 逐秒刷新 —— 募兵/建造队列完成即变（"队列还在"病根）
         v89.174：回调统一 liveFn174（锁城 + 城市失效自动关闭） */
    } else {
      /* 空地：选择建筑（弹窗式） */
      /* v19：**不再复制一份唯一建筑表**（曾因此出现「后端放行、前端禁用」的错位）。
         统一引用 domain.js 的单一数据源。 */
      var UNIQUE = GAME.UNIQUE_BUILDINGS;
      /* v20（需求 9）：分页取代内部滚动条 —— 每页 9 格（3×3），尺寸恒定
         v63（老板）：「在城内空地上选择建造的建筑类型时，把相应建筑的图标同步进去。
           不用写消耗的资源，悬停显示即可」
           → ① 图标换 `GAME.icons.forBuilding`（**与城内棋盘同一套图**：
                 AI 位图优先、矢量兜底；`data.icon` 那个 emoji 只在取不到图时兜底），
             ② 卡片上不再写费用，改为 `title` 悬停显示（作用 + 材料 + 状态）。
           只留"图标 + 名称 + 不可建的原因"：不可建原因是**当前事实**，必须看得见；
           费用是"要花多少"，选的时候看一眼就够，正适合悬停。 */
      /* v89.128：围墙不占格 —— 不在"空格菜单"里（入口 = 环城热区），从候选剔除 */
      var all = DATA.BUILD_ORDER.filter(function (bid) { return bid !== 'chengqiang'; }).map(function (bid) {
        var b = DATA.BUILDINGS[bid];
        var cost = GAME.costString(b.buildCost);
        var lockMsg = '', afford = '', tip = b.desc + '｜耗：' + cost;
        if (!GAME.canAfford(b.buildCost)) { afford = ' disabled'; lockMsg = '材料不足'; tip += '｜材料不足'; }
        if (UNIQUE[bid] && GAME.buildingLevel(c, bid) > 0) { afford = ' disabled'; lockMsg = '已建造(唯一)'; tip += '｜本城已建有（唯一建筑）'; }
        if (bid === 'guanfu') { afford = ' disabled'; lockMsg = '政务厅初始自带'; tip += '｜政务厅初始自带'; }
        /* v68 · 逐步探索：前置不满足 → 置灰并写明原因（"需征召大厅 Lv2"）
           v89.86（P-04）：前置升级中改报动态文案（ui.prereqText），不再像永久锁。 */
        var preB = GAME.buildPrereqOf(c, bid, 1);
        if (!preB.ok) {
          afford = ' disabled';
          var preTxt = ui.prereqText(c, preB);
          lockMsg = preTxt; tip += '｜' + preTxt;
        }
        var ic = GAME.icons.forBuilding(bid) || b.icon;
        /* v147（D 期）：**先看看** —— 建造前先进 3D 预览（不占格、不扣费）。
           ⚠️ 卡片自身带 data-action（整卡点击 = 建造），里面的小按钮必须
              `event.stopPropagation` 才能不触发外层（见 main.js 的 bld-preview case）。 */
        return '<div class="troop-card bldg-pick' + afford + '" data-action="confirm-build" data-idx="' + idx +
          '" data-build="' + bid + '" style="cursor:pointer;" title="' + U.escape(tip) + '">' +
          '<div class="ticon">' + ic + '</div><div class="tname">' + b.name + '</div>' +
          (lockMsg ? '<div class="tstat" style="color:var(--red-light);">' + lockMsg + '</div>' : '') +
          '<span class="bld-eye" data-action="bld-preview" data-build="' + bid +
            '" title="进 3D 看一眼它建成后的样子（不占格、不扣费）">👁</span>' +
          '</div>';
      });
      /* v2026-10-31（老板）：预留地块点开分两层 ——
         第一层只显示「推荐建造」的建筑（= 本槽固定规划建筑 fixedBid）；
         给一个「其他建筑」按钮，点后切到全部建筑（与原来一致）。
         普通空位（非预留）直接给全部建筑。 */
      var _fixedBid = GAME.fixedBidAt ? GAME.fixedBidAt(idx) : 'minfang';
      var _isReserve = !!(cell.build || cell.pending) ? false
        : !!(_fixedBid && _fixedBid !== 'minfang' && DATA.BUILDINGS[_fixedBid]);
      var _reco = _isReserve && mode !== 'all';
      var _show = all;
      if (_reco) {
        var _r = all.filter(function (h) { return h.indexOf('data-build="' + _fixedBid + '"') >= 0; });
        if (_r.length) _show = _r; else _reco = false;   /* 兜底：找不到推荐卡就退回全部 */
      }
      var pgB = ui.modalPage('buildpick', _show, 9, function () { ui.openBuildModal(idx, null, _reco ? 'reco' : 'all'); });
      var _title, _sub, _footExtra = '';
      if (_reco) {
        _title = '🏗️ 本格推荐建造：' + (DATA.BUILDINGS[_fixedBid] ? DATA.BUILDINGS[_fixedBid].name : _fixedBid);
        _sub = '规划给本格的建筑　·　第 ' + pgB.page + '/' + pgB.maxPage + ' 页';
        _footExtra = '<button class="btn" data-action="build-other" data-idx="' + idx + '">其他建筑 ▾</button>';
      } else {
        _title = '🏗️ 选择要建造的建筑';
        _sub = '城战技能建筑 · 共 ' + all.length + ' 种　·　第 ' + pgB.page + '/' + pgB.maxPage + ' 页';
        if (_isReserve) _footExtra = '<button class="btn" data-action="build-reco" data-idx="' + idx + '">← 推荐建造</button>';
      }
      ui.openShell({
        title: _title,
        sub: _sub,
        /* v63：图标从 emoji 换成与棋盘同一套（84px），卡片比原来高 ——
           实测 lg（860×600）正文超出 18px 会**出现弹窗内滚动条**（老板明令禁止），
           所以提到 xl（960×min(700,88vh)）：三列各宽 ~300px，卡片照样一目了然。 */
        size: 'xl',
        body: '<div class="troop-grid" style="grid-template-columns:repeat(3,1fr);">' + pgB.slice.join('') + '</div>' + pgB.pager,
        foot: '<div class="m-foot">' + _footExtra + '<button class="btn" data-action="close-modal">关闭</button></div>'
      });
    }
  };

  /* ============================================================
   * 政务厅面板（v24 · 需求 4/5）：征收
   * ------------------------------------------------------------
   * 征收归属政务厅（不是侧栏统计）：
   *   · 普通城市 → 5 大资源，以民力换物资
   *   · 名城     → 该区特产高阶材料
   * 顺便把「特产怎么来」讲清楚：岁贡（自动）+ 征收（手动）+ 首府加成。
   * ============================================================ */
  /* ⛔ v89.135 移除：`ui.openGuanfu`（政务厅面板）—— 老板 10：「政务厅界面简化，首页功能
     直接显示，不再设置多一个'政务厅事务'按钮，功能包括城市名称修改，主城设置，基因实验室入口。
     其他'在办事项 · 建造 / 募兵 / 自动 / 行军'这种不需要，已有专门菜单。」
     · 改名 / 主城 / 基因实验室 / 全境营造总览 → 政务厅格建筑面板的「政务厅要务」段（openBuildModal）；
     · 本城特产 / 岁贡 → 同段的两行 attr（信息不丢）；
     · 「在办事项」整块退役（建造队列看建筑面板 / 募兵看军营 / 行军看军务总览 —— 各有专门菜单）；
     · 威望解锁的上限说明原在 liftLine → 早已由 openBuildModal 的 `_lift` 行承接。 */


  /* 城市重命名（v25 · 需求 8）：固定小窗，一个输入框 + 两个按钮 */
  ui.openRenameCity = function () {
    var c = GAME.currentCity();
    var chk = GAME.canRenameCity(c);
    if (!chk.ok) { ui.toast(chk.msg); return; }
    ui.openShell({
      title: '✎ 重命名城市',
      sub: '改名会同步到地图 / 侧栏 / 统计 / 战报等所有引用处',
      size: 'sm',
      body: '<div class="ui-sub" style="margin-bottom:6px;">新名字（12 字以内）</div>' +
        '<input type="text" id="rename-city-input" maxlength="12" value="' + U.escape(c.name) + '"' +
        ' style="width:100%;padding:8px;background:var(--slab-1);border:1px solid var(--gold-dark);' +
        'color:var(--text);border-radius:4px;text-align:center;">' +
        '<div class="op-row" style="justify-content:center;margin-top:12px;">' +
          '<button class="btn gold" data-action="do-rename-city">确定</button>' +
        '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  /* v77（老板）：「君主姓名（给一个改名按钮）」—— 与城市改名同一套小弹窗版式。
     域侧唯一出口 GAME.renameLord（同时改 ruler.name 与君主英雄 g.name，两处同源）。 */
  /* v91.14（老板）：「星球可以命名」—— 行政星球名右侧 ✎ 按钮打开本窗。
     10 字以内；改名走唯一出口 GAME.renamePlanet（全仓读点同步）。 */
  ui.openPlanetRename = function (pid) {
    var p = null; (GAME.planetsOf ? GAME.planetsOf() : []).forEach(function (x) { if (x.id === pid) p = x; });
    if (!p) { ui.toast('星球不存在'); return; }
    ui._renamePid = pid;
    ui.openShell({
      title: '✎ 星球命名',
      sub: '10 字以内 · 改名会同步到所有引用处（前哨命名 / 地图 / 提示）',
      size: 'sm',
      body: '<input type="text" id="rename-planet-input" maxlength="10" value="' + U.escape(p.name || ('星球 ' + pid)) + '"' +
        ' style="width:100%;padding:8px;background:var(--slab-1);border:1px solid var(--gold-dark);' +
        'color:var(--text);border-radius:4px;text-align:center;">' +
        '<div class="op-row" style="justify-content:center;margin-top:12px;">' +
          '<button class="btn gold" data-action="do-rename-planet">确定</button>' +
        '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  ui.openRenameLord = function () {
    var s = GAME.state;
    ui.openShell({
      title: '✎ 君主改名',
      sub: '8 字以内 · 改名会同步到所有引用处',
      size: 'sm',
      body: '<input type="text" id="rename-lord-input" maxlength="8" value="' + U.escape(s.ruler.name) + '"' +
        ' style="width:100%;padding:8px;background:var(--slab-1);border:1px solid var(--gold-dark);' +
        'color:var(--text);border-radius:4px;text-align:center;">' +
        '<div class="op-row" style="justify-content:center;margin-top:12px;">' +
          '<button class="btn gold" data-action="do-rename-lord">确定</button>' +
        '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  /* v89.126：原「围墙」独立面板（openWallModal）退役 ——
     围墙占格后走**通用建筑面板**（ui.openBuildModal，含建造/升级/取消/提速）；
     环城热区 `open-wall` 由 main.js 转发到该面板。 */

  GAME.costString = function (cost) {
    var parts = [];
    for (var k in cost) {
      if (k === 'time') continue;
      if (k === 'jewel') {                    /* v89.104：珠宝需求（高等级建筑） */
        var need = GAME.jewelNeedOf ? GAME.jewelNeedOf(cost) : {};
        for (var jid in need) {
          var jn = '';
          (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
          parts.push('💎' + (jn || jid) + ' ' + need[jid]);
        }
        continue;
      }
      var name = '';
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) name = r.name; });
      if (!name) name = k;
      parts.push(name + ' ' + U.fmt(cost[k]));
    }
    return parts.join(' · ') || '—';
  };
  /* 造价里有没有珠宝（界面据此提示"缺什么珠宝"） */
  /* 造价里的珠宝清单（唯一出口）—— v89.194：加 lackOnly 参数
     （costLackMsg 的缺料提示复用同一出口，不再自写第二份遍历）；格式统一为
     '💎名 ×N（持 M）'。 */
  GAME.costJewelText = function (cost, lackOnly) {
    var need = GAME.jewelNeedOf ? GAME.jewelNeedOf(cost) : {};
    var out = [];
    var inv = (GAME.state && GAME.state.items) || {};
    for (var jid in need) {
      var have = inv[jid] || 0;
      if (lackOnly && have >= need[jid]) continue;
      var jn = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
      out.push('💎' + jn + ' ×' + need[jid] + '（持 ' + have + '）');
    }
    return out.join('　');
  };

  /* --------- 城外（地块网格 · 弹窗式） --------- */
  ui.extHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    GAME.ensureExtGrid(c);
    var cap = GAME.extCap(c), used = GAME.extUsed(c);
    var all = GAME.extSummary ? GAME.extSummary() : null;
    var grid = GAME.extGridOf(c);
    /* v89.142（老板 1）：棋盘固定 **12×8**（96 = 整网格；几何常量唯一来源 = DATA.EXT_COLS/ROWS），
       地块落位走 GAME.extSlotOrder（**居中矩形逐圈扩张** · v89.157 老板「地块按建议」）——
       首档 12 块 = 规整 4×3 居中矩形（旧为"缺左上角的半环"）；尚未解锁的位置画**暗格**。
       画布与格子尺寸恒定：政务厅升级只多"亮"几格，版式不跳、行列不折。 */
    var COLS = DATA.EXT_COLS || 12, ROWS = DATA.EXT_ROWS || 8;
    ui.fitBoard(COLS, ROWS);              /* v27：按窗口算格子边长 */
    var M = ui.isoMetrics(COLS, ROWS);
    var order = GAME.extSlotOrder ? GAME.extSlotOrder() : null;
    var cells = grid.map(function (e, idx) {
      var slot = order ? order[idx] : { col: idx % COLS, row: Math.floor(idx / COLS) };
      var col = slot.col, row = slot.row;
      if (e.pending) {
        var pr = GAME.buildProgress('ext', idx, c.id);
        return ui.isoCell({ M: M, col: col, row: row, cls: 'busy', idx: idx, act: 'ext-cell', kind: 'ext',
          pending: true, pct: (pr ? pr.label : '…'), pctNum: (pr ? pr.pct : 0) });
      }
      if (!e.type) {
        return ui.isoCell({ M: M, col: col, row: row, cls: 'empty', idx: idx, act: 'ext-cell', addHint: true });
      }
      var eb = DATA.EXT_BUILDINGS[e.type];
      /* v20：产量不再单列一行（需求 1：名字与等级一行即可），悬停/点开看详情 */
      return ui.isoCell({
        M: M, col: col, row: row,
        cls: 'built res res-' + e.type, built: true, idx: idx, act: 'ext-cell',
        icon: GAME.icons.forExt(e.type), name: eb.name,
        lvl: e.lv, lvlMax: e.lv >= 10,
      });
    }).join('') + (order ? order.slice(grid.length).map(function (slot) {
      /* 未解锁暗格：不占交互（点了给解锁提示），只是"预留位"的视觉表达 */
      var nxLv = GAME.extNextLvOf ? GAME.extNextLvOf(c) : 0;
      return '<div class="iso-tile locked" data-action="ext-locked" style="left:' +
        Math.round(M.x(slot.col, slot.row)) + 'px;top:' + Math.round(M.y(slot.col, slot.row)) +
        'px;width:' + M.W + 'px;height:' + M.H + 'px;" title="' +
        (nxLv ? '政务厅 Lv' + nxLv + ' 可解锁更多地块' : '地块已至上限（96 = 12×8 满）') +
        '"><i class="tile-face"></i></div>';
    }).join('') : '');
    var board = ui.isoBoard(COLS, ROWS, cells, {});
    /* v22（需求 3）：与城内一致 —— 中央只留地块；
       城市名/块数在侧栏「城市属性」，显示比例与岁贡在侧栏「城市操作」。
       （all / used / cap 仍用于侧栏渲染，这里不再消费） */
    return '<div class="ui-page city-pure">' +
      '<div class="city-iso" style="' + ui.zoomStyle() + '">' + board + '</div>' +
      '</div>';
  };

  /* 城外地块弹窗：空地→选建 4 种资源建筑；已建→详情/升级 */
  ui.openExtModal = function (idx, cityId) {
    /* v89.174：与城内 openBuildModal 同构 —— 支持锁城重开（live 每秒刷新），
       施工/正常两态接 live（完成瞬间自动换形态，修"读秒完了还写着建造中"）。 */
    var s = GAME.state, c = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!c) return;
    var e = GAME.extGridOf(c)[idx];
    if (!e) return;
    var liveFnE174 = function () {
      if (!GAME.cityById(c.id)) { ui.closeModal(); return; }
      ui.openExtModal(idx, c.id);
    };
    if (e.pending) {
      var pendName = DATA.EXT_BUILDINGS[e.pending] ? DATA.EXT_BUILDINGS[e.pending].name : '建筑';
      var pendDesc = DATA.EXT_BUILDINGS[e.pending] ? (DATA.EXT_BUILDINGS[e.pending].desc || '') : '';
      var isUpE = !!e.type;
      var prE = GAME.buildProgress('ext', idx);
      /* v19：城外升级同样是后台过程 —— 施工期间**照常产出**（产量按当前等级计），
         只是不能改建/拆毁。面板要让玩家看到这一点，否则会以为停产了。 */
      var prodLine = '';
      if (isUpE) {
        var ebP = DATA.EXT_BUILDINGS[e.type];
        var phP = ebP.prod[e.lv - 1];
        prodLine = '<div class="attr"><span class="k">当前产出（施工中不停产）</span><span class="v good">' + U.perHourText(phP) + '/时</span></div>' +
          '<div class="attr"><span class="k">完工后 Lv' + (e.lv + 1) + '</span><span class="v">' + U.perHourText(ebP.prod[e.lv]) + '/时</span></div>';
      }
      ui.openModal(
        /* v73（老板）：顶部图标不留（与城内两处同批撤除） */
        '<div class="gold-heading"' + (pendDesc ? ' data-tip="' + U.escape(pendDesc) + '" style="cursor:help;"' : '') +
          '>' + pendName + (isUpE ? (' · Lv' + e.lv + ' → Lv' + (e.lv + 1)) : '') + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-body);text-align:center;margin-bottom:12px;">' +
          (isUpE ? '🛠️ 升级中 · 后台施工，倒计时每秒更新（施工中不停产）' : '🏗️ 建造中 · 倒计时每秒更新') + '</div>' +
        prodLine +
        '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-h1);font-weight:800;margin:8px 0;" data-modal-progress="ext:' + idx + '">' + (GAME.buildPct('ext', idx) || '…') + '</div>' +
        '<div class="pbar" style="width:70%;margin:0 auto 10px;"><i data-build-bar="ext:' + idx + '" style="width:' + (prE ? prE.pct : 0) + '%"></i></div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);">后台施工中，倒计时每秒更新　·　施工中不可改建 / 拆毁（完工后恢复；急用可「取消施工」）</div>' +
        '<div class="bldg-foot">' +
          (function () {
            var _q = GAME.queueAt('ext', idx);
            var _c = GAME.queueRushCost(_q);
            return '<button class="btn sm gold" data-action="rush-ext" data-idx="' + idx + '"'
              + ' title="花旧币立即完成（工程价 20% × 剩余比例，约 ' + U.fmt(_c) + ' 旧币）">⚡ 提速'
              + (_c ? ' −' + U.fmt(_c) : '') + '</button>';
          })() +
          '<button class="btn sm red" data-action="cancel-build-ask" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>', { live: liveFnE174 });
      return;
    }
    if (e.type) {
      var eb = DATA.EXT_BUILDINGS[e.type];
      var prodH = eb.prod[e.lv - 1];
      /* v89.212（老板 1）：堆场按资源分账 —— 本块只堆**自己那一类**资源，标签写明归属 */
      var _rn212 = '';
      DATA.RESOURCES.forEach(function (r) { if (r.key === eb.res) _rn212 = r.name; });
      /* v89.235（老板）：「城外资源建筑等级也不能超过政务厅等级」—— 与内核同尺：
         buildPrereqOf 官府闸 + buildCapOf 传 bid（本座）；被闸卡住时报准确原因
         （"已达最高等级"会误导 —— 与城内 v68 口径对齐）。 */
      var upPre = GAME.buildPrereqOf(c, e.type, e.lv + 1, e);
      var upCost = (e.lv < GAME.buildCapOf(c, e.type, e) && upPre.ok)
        ? GAME.buildCostDiscountOf(GAME.extBuildCost(e.type, e.lv)) : null;
      var costStr = upCost ? GAME.costString(upCost) : (upPre.ok ? '已满级' : upPre.short);
      var eRef = GAME.demolishExtRefund(idx);
      ui.openModal(
        /* v73（老板）：顶部图标不留（与城内两处同批撤除）；v91.14：备注改**悬停建筑名** */
        '<div class="gold-heading"' + (eb.desc ? ' data-tip="' + U.escape(eb.desc) + '" style="cursor:help;"' : '') +
          '>' + eb.name + ' · Lv' + e.lv + '</div>' +
        '<div class="attr"><span class="k">产量</span><span class="v good">' + U.perHourText(prodH) + '/时</span></div>' +
        /* v89.155（老板 5）：本块为堆场容量的贡献；v89.212（老板 1）：按资源分账（只加"本类资源"的上限） */
        '<div class="attr"><span class="k">另加' + (_rn212 || '资源') + '上限</span><span class="v good">+' + U.fmt(GAME.extStoreCapOneOf(e)) + '</span></div>' +
        (eRef ? '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-top:10px;">拆毁可返还累计投入的 50%：' + GAME.costString(eRef) + '</div>' : '') +
        /* v68（设计规范 §11）：与城内弹窗同一骨架 —— 功能行 / 升级行 / 底栏 */
        '<div class="op-zone">' +
          /* ⛔ v89.138（老板 4）：标题行撤除（同上） */
          '<div class="op-row"><button class="btn gold" data-action="ext-convert-ask" data-idx="' + idx + '">🔧 改建为其他资源建筑</button></div>' +
        '</div>' +
        /* v91.72（老板）：「资源建筑的升级按钮应该放在底部」——
           升级键从正文中段挪到底部操作栏（与拆毁 / 关闭同排），正文只留信息。 */
        '<div class="bldg-foot">' +
          (upCost
            ? '<button class="btn gold bldg-act" data-action="ext-upgrade" data-idx="' + idx + '"' +
                ' title="' + U.escape(ui.buildCostTip(upCost)) + '">升级' +
                '<span class="ba-sub">Lv' + e.lv + ' → Lv' + (e.lv + 1) + '</span></button>'
            : '<span class="op-done">' + (upPre.ok ? '已达最高等级' : U.escape(ui.prereqText(c, upPre))) + '</span>') +
          (upCost ? '<button class="btn sm red" data-action="demolish-ask" data-kind="ext" data-idx="' + idx + '" title="返还累计投入的 50%（需二次确认）">拆毁</button>' : '<span></span>') +
          '<button class="btn" data-action="close-modal">关闭</button>' +
        '</div>', { live: liveFnE174 }
      );
      return;
    }
    /* 空地：选建资源建筑（v63：与城内那处同一套规矩 —— 图标同步、费用改悬停） */
    var used = GAME.extUsed();
    var cap = GAME.extCap(c);
    var list = DATA.EXT_BUILD_ORDER.map(function (eid) {
      var eb2 = DATA.EXT_BUILDINGS[eid];
      /* v89.179c：显示价也走**折扣唯一出口** —— 否则 hover 说原价、面板说折扣价（两本账）。 */
      var costNow = GAME.buildCostDiscountOf(GAME.extBuildCost(eid, 0)) || { grain: eb2.cost[0][0] };
      var afford = GAME.canAfford(costNow) ? '' : ' disabled';
      /* v89.212（老板 1）：堆场按资源分账 —— 悬停写明"本类资源"（净化厂→净水上限 / 温室→生物质上限…） */
      var _rnB = '';
      DATA.RESOURCES.forEach(function (r) { if (r.key === eb2.res) _rnB = r.name; });
      var tip = eb2.desc + '｜耗' + U.fmt(costNow.grain) + '净水 · 产' + eb2.prod[0] + '/时' +
        /* v89.155（老板 5）：desc 已补（原先读 undefined → 悬停显示"undefined｜耗…"）；另加堆场信息 */
        '｜每级另加' + (_rnB || '资源') + '上限 +' + U.fmt(Math.round((DATA.BASE_STORE || 0) / (DATA.EXT_STORE_DIV || 1))) +
        (afford ? '｜材料不足' : '');
      return '<div class="troop-card bldg-pick' + afford + '" data-action="ext-build" data-idx="' + idx +
        '" data-eid="' + eid + '" style="cursor:pointer;" title="' + U.escape(tip) + '">' +
        '<div class="ticon">' + (GAME.icons.forExt(eid) || eb2.icon) + '</div>' +
        '<div class="tname">' + eb2.name + '</div></div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🌾 选择资源建筑（' + used + '/' + cap + '块）</div>' +
      '<div class="troop-grid" style="grid-template-columns:repeat(2,1fr);">' + list + '</div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    );
  };

  /* --------- 军队 --------- */
  /* 当前选中的兵种。
     注意：必须挂在 `ui` 上 —— 此处曾误写成 `GAME._trainSel`，而读取处一律是
     `ui._trainSel`（= GAME.ui._trainSel），两者是不同属性。结果是初始值丢失、
     训练按钮渲染成 data-troop="undefined"，点「训练」即报「参数错误」。 */
  ui._trainSel = 'buxingji';
  /* v20：募兵数量改为**状态**（原先渲染函数直接读 DOM，导致面板未打开时算不准、
     且加减按钮重绘错对象而毫无反应） */
  ui._trainCount = 10;
  /* v89.229（兵种重构）：旧 `_trainFilter`（兵营/机工坊分流）**退役** ——
     统一面板后由选中兵种的 craft 字段决定工位；从哪座建筑打开只影响初始选中。 */
  /* v90.64（老板）：募兵营改**左列清单 / 右详情**，`ui._trainTab` 分页态**整条退役**。 */
  ui.troopsHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!DATA.TROOPS[ui._trainSel]) ui._trainSel = 'buxingji';   // 兜底：选中项必须存在
    /* v90.64（老板）：募兵营改**左列兵种清单 / 右侧详情**；
       14 兵种一列全列（不再分组分页）；
       **队列移出本面板**（改放军营菜单首页 —— 见 openBuildModal 的 junying 段 barQueue）。 */
    var ids = Object.keys(DATA.TROOPS);
    var cards = ids.map(function (id) {
      var t = DATA.TROOPS[id];
      var chk = GAME.canTrain(id);
      var unlocked = chk.ok;
      /* v90.65（老板）：左侧列表**去掉悬停弹窗**，只留居中的兵种名（属性改在右侧展示栏看）。 */
      return '<div class="troop-card' + (unlocked ? '' : ' disabled') + (ui._trainSel === id ? ' selected' : '') + '" ' +
        (unlocked ? 'data-action="select-train"' : '') + ' data-troop="' + id + '"' +
        (unlocked ? '' : ' data-why="' + U.escape(chk.msg || '') + '"') + '>' +
        '<div class="tname">' + t.name + '</div>' +
        '</div>';
    }).join('');
    var sel = DATA.TROOPS[ui._trainSel];
    var afford = GAME.canTrain(ui._trainSel).ok;
    var qty = Math.max(1, Math.floor(Number(ui._trainCount) || 1));
    var timeStr = sel ? U.dur((sel.time * qty) / GAME.timeScale()) : '';
    var limN = (sel && GAME.trainLimitOf) ? GAME.trainLimitOf(sel.id) : null;
    var maxN = sel ? GAME.maxTrainCount(sel.id, c.id, ui._trainBIdx) : 0;
    var haveN = (sel && c.army && c.army[sel.id]) || 0;   /* v89.99：本城驻军（解散的门槛） */
    var kind = (sel && sel.craft) ? 'craft' : 'train';
    var bar = ui.trainBarracks();
    var slotsLeft = bar ? GAME.trainSlotsLeft(c, bar.idx, kind) : 0;
    var barLine = bar ? ''
      : '<div class="q-empty">本城尚未建造' + (kind === 'craft' ? '精密制造厂，无法制造器械。' : '军营，无法募兵。') +
        '<div style="margin-top:6px;"><button class="btn sm gold" data-action="hint-go" data-view="city" data-list="1">' +
        '→ 去建一座（军营需居所 Lv2）</button></div></div>';
    var listHTML = '<div class="troop-list">' + cards + '</div>';
    /* v90.65（老板）：右侧 = 选中兵种的**展示栏**（大图 + 属性 + 驻军/上限/消耗；**纯展示，无控件**）。 */
    var detailHead = !sel ? '' :
      '<div class="troop-detail-head">' +
        '<div class="tdh-fig">' + GAME.icons.forTroop(sel.id) + '</div>' +
        '<div class="tdh-info">' +
          '<div class="tdh-nm">' + U.escape(sel.name) + '</div>' +
          '<div class="tdh-stats">血 ' + sel.hp + '　攻 ' + sel.atk + '　防 ' + sel.def +
            '　射程 ' + sel.range + '　速度 ' + sel.spd + '　负重 ' + sel.load +
            (sel.vsMech ? '　拆械 ×' + sel.vsMech : '') + '</div>' +
          '<div class="tdh-sub">单兵耗时 ' + U.dur(sel.time) + '　·　幸存者 ' + sel.pop + '　·　本城驻军 <b>' + U.numText(haveN, 0) + '</b></div>' +
          '<div class="tdh-cost">募兵消耗：' + GAME.costString(sel.cost) + '　·　可募上限 ' + U.numText(maxN, 0) + '</div>' +
          ((maxN <= 0 && limN) ? '<div class="tdh-warn">' + (limN.reason === 'pop'
            ? '⚠️ 可征幸存者不足 —— 建居所或等待增长'
            : (limN.reason === 'res' ? '⚠️ 资源不足' : '当前不可募')) + '</div>' : '') +
        '</div>' +
      '</div>';
    /* v91.18（老板 2）：**精简为两行** ——
       行1：数量框 · 训练 · 招募总耗时；行2：驻军数 · 解散。
       去掉（老板点名）：重复兵种名 / 幸存者块（可征·上限·增势·每兵占幸存者）。 */
    var opsHTML = '<div class="troop-ops">' + barLine +
      ((maxN <= 0 && limN)
        ? '<div class="troop-ops-row"><span class="ui-sub" style="color:var(--red-light);">⚠️ ' +
            (limN.reason === 'pop' ? '可征幸存者不足（建居所或等待增长）'
              : (limN.reason === 'res' ? '资源不足' : '当前不可募')) + '</span></div>'
        : '') +
      '<div class="troop-ops-row">' +
        '<input type="number" id="train-count" min="1" value="' + qty + '" style="width:110px;padding:6px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;text-align:center;">' +
        '<button class="btn sm" data-action="train-max" title="按可用幸存者与资源填到最大可募数">上限</button>' +
        '<span style="flex:1 1 auto;"></span>' +
        '<button class="btn gold" data-action="confirm-train" data-troop="' + ui._trainSel + '"' +
          (slotsLeft > 0 ? '' : ' disabled data-why="本营训练队列已满：等待一个队列完成，或升级军营解锁等待位"') + '>' + (kind === 'craft' ? '制造' : '训练') + '</button>' +
        '<span style="flex:1 1 auto;"></span>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">约 ' + timeStr + (slotsLeft > 0 ? '' : '　· 队列已满') + '</span>' +
      '</div>' +
      '<div class="troop-ops-row">' +
        '<span style="color:var(--text);font-size:var(--fs-sub);">驻军 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">' + U.numText(haveN, 0) + '</b></span>' +
        '<span style="flex:1 1 auto;"></span>' +
        '<button class="btn sm red" data-action="troop-disband-ask" data-troop="' + ui._trainSel + '"' +
          (haveN > 0 ? '' : ' disabled') +
          ' title="解散本城驻军并归农（返还幸存者、军资不退；需二次确认）">解散</button>' +
      '</div>' +
    '</div>';
    return '<div class="ui-page troops-page"><div class="troop-split">' + listHTML +
      '<div class="troop-detail">' + detailHead + '</div></div>' + opsHTML + '</div>';
  };

})();
