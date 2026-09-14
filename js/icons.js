/* ============================================================
 * icons.js  手绘 SVG 图标库（v12）
 * 建筑 / 城外资源 / 野地 / 资源 / 兵种 全部矢量绘制
 * 不再使用「色块 + emoji」的组合
 * 统一风格：左上光源的平涂分层 + 檐口翘起 + 铜饰点缀
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var ICON = GAME.icons = {};
  ICON.ready = true;

  /* ---------------- 调色板 ---------------- */
  /* 暗黑风调色板（v18）：整体压暗 2~3 档、降饱和、拉开明暗差。
     设计原则：底色近乎墨黑，仅把**金/火**留作暖色高光（唯一亮点），
     其余材质一律冷灰暗调 —— 这样图标在深色面板上才有"物件感"而非贴纸感。 */
  var P = {
    /* v30 调色板「亮画面」化：对齐原版——鲜亮但不失层次，高光更透、暗部保留 */
    ink: '#241a10',
    /* 亮青瓦 */
    tileHi: '#9db2c8', tileMd: '#64788e', tileLo: '#3d4d61', tileEdge: '#232e3c',
    /* 金琉璃 */
    glaHi: '#e8b44e', glaMd: '#b47c26', gllaLo: '#7a4e12',
    /* 米黄砖墙 */
    wallHi: '#eedcb2', wallMd: '#c4a872', wallLo: '#93794c', wallEdge: '#5e4a2c',
    /* 亮木 */
    woodHi: '#c89058', woodMd: '#96602e', woodLo: '#6a4018', woodEdge: '#3f260c',
    /* 亮岩 */
    stHi: '#d0ccbe', stMd: '#9c968a', stLo: '#6b655a', stEdge: '#453f36',
    /* 亮金 */
    goldHi: '#f6d788', goldMd: '#d0a038', goldLo: '#92691e',
    /* 亮绿 */
    grHi: '#96c258', grMd: '#689838', grLo: '#42701e',
    /* 亮水 */
    waHi: '#8cc8ec', waMd: '#5898c4', waLo: '#35709e',
    /* 火（保留暖亮） */
    fiHi: '#ffdd77', fiMd: '#f0952f', fiLo: '#b85414',
    /* 亮朱 */
    rHi: '#d45c3c', rMd: '#a83a22', rLo: '#742513',
    /* 亮钢 */
    irHi: '#d4dce8', irMd: '#98a4b6', irLo: '#667284',
    /* 亮麻 */
    clHi: '#ecdcb2', clMd: '#b89e6e', clLo: '#856c44',
    /* 亮玉（修复 SLOT_ART 死引用：jadeHi/jadeLo 此前未定义） */
    jadeHi: '#8fd8ac', jadeLo: '#4a8a60',
    /* 亮皮革（修复 SLOT_ART 死引用：leatherHi/Md/Lo 此前未定义） */
    leatherHi: '#d8b488', leatherMd: '#a87e50', leatherLo: '#745432',
  };
  ICON.P = P;

  /* ---------------- 基础工具 ---------------- */
  function G(id, a, b, dir) {
    /* dir: 'v' 纵向（默认） | 'h' 横向 */
    var x2 = dir === 'h' ? 1 : 0, y2 = dir === 'h' ? 0 : 1;
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + x2 + '" y2="' + y2 + '">' +
      '<stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>';
  }
  /* 暗黑承台：建筑/城外/地形这类"大图"统一坐在同一块深色底座上。
     底座 = 深色径向渐变 + 暗金细描边 + 内圈压线 + 顶部冷光，
     让图标像是嵌在铜框里的浮雕，而不是浮在面板上的贴纸。 */
  function plateDefs() {
    return '<defs>'
      + '<radialGradient id="icPlate" cx="50%" cy="24%" r="82%">'
      +   '<stop offset="0" stop-color="#e6d2a0"/>'
      +   '<stop offset=".55" stop-color="#c8a870"/>'
      +   '<stop offset="1" stop-color="#97794a"/></radialGradient>'
      + '<linearGradient id="icRim" x1="0" y1="0" x2="0" y2="1">'
      +   '<stop offset="0" stop-color="#f8e8b8" stop-opacity=".9"/>'
      +   '<stop offset=".5" stop-color="#a8863e" stop-opacity=".55"/>'
      +   '<stop offset="1" stop-color="#6a4c1e" stop-opacity=".45"/></linearGradient>'
      + '</defs>';
  }
  function plate() {
    return plateDefs()
      + '<rect x="1.3" y="1.3" width="61.4" height="61.4" rx="9" fill="url(#icPlate)"/>'
      + /* 泥粒斜纹（夯土质感） */
      '<path d="M4 18 L60 8 M4 34 L60 24 M4 50 L60 40 M12 60 L60 52" stroke="#7a5a30" stroke-opacity=".08" stroke-width="2.4"/>'
      + '<ellipse cx="32" cy="10" rx="23" ry="9" fill="#fff6dc" opacity=".22"/>'
      + '<rect x="1.3" y="1.3" width="61.4" height="61.4" rx="9" fill="none" stroke="url(#icRim)" stroke-width="1.5"/>'
      + '<rect x="3.6" y="3.6" width="56.8" height="56.8" rx="7" fill="none" stroke="#4a3010" stroke-opacity=".38" stroke-width="1"/>'
      + '<rect x="3.6" y="3.6" width="56.8" height="56.8" rx="7" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1"/>';
  }
  /* v25（需求 7）：统一「光照层」。
     五十多个图标各画各的，形状再好也会显得不是一个世界的东西 ——
     差的就是打光。这里给**每一个**图标加同一套：
       ① 左上暖光 / 右下冷影的柔光罩（soft-light；不支持混合的浏览器退化成
          很淡的渐变，肉眼几乎无感，不会把图形糊住）
       ② 底部环境暗角，把图标"按"在平面上
     ID 固定不冲突（所有实例定义一致，取先出现的那一份即可）。 */
  function lightPass() {
    return '<defs>'
      + '<linearGradient id="icAmb" x1="0.08" y1="0" x2="0.92" y2="1">'
      +   '<stop offset="0" stop-color="#fff2cc" stop-opacity=".20"/>'
      +   '<stop offset=".42" stop-color="#ffffff" stop-opacity="0"/>'
      +   '<stop offset="1" stop-color="#3a2408" stop-opacity=".22"/></linearGradient>'
      + '<radialGradient id="icVig" cx="50%" cy="46%" r="66%">'
      +   '<stop offset=".58" stop-color="#000000" stop-opacity="0"/>'
      +   '<stop offset="1" stop-color="#2a1a04" stop-opacity=".16"/></radialGradient>'
      + '</defs>'
      + '<rect x="0" y="0" width="64" height="64" fill="url(#icAmb)" style="mix-blend-mode:soft-light" pointer-events="none"/>'
      + '<rect x="0" y="0" width="64" height="64" fill="url(#icVig)" pointer-events="none"/>';
  }
  function wrap(inner, opt) {
    opt = opt || {};
    return '<svg class="ico" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
      + lightPass() + (opt.plate ? plate() : '') + inner + '</svg>';
  }
  /* 屋顶：cx 中心，top 脊高，w 檐宽，h 檐高，tw 脊宽 */
  function roof(cx, top, w, h, tw, k, pal) {
    var A = pal === 'gla' ? [P.glaHi, P.glaMd, P.gllaLo] : [P.tileHi, P.tileMd, P.tileLo];
    var L = cx - w / 2, R = cx + w / 2, TL = cx - tw / 2, TR = cx + tw / 2;
    var y0 = top, y1 = top + h;
    return G(k + 'rf', A[0], A[2]) + G(k + 'rf2', A[1], A[2], 'h') +
      /* 主瓦面 */
      '<path d="M' + L + ' ' + y1 + ' L' + TL + ' ' + y0 + ' L' + TR + ' ' + y0 + ' L' + R + ' ' + y1 + ' Z" fill="url(#' + k + 'rf)"/>' +
      /* 瓦垄（三至四条竖线） */
      '<path d="M' + (cx - w * 0.22) + ' ' + y1 + ' L' + (cx - tw * 0.22) + ' ' + y0 + ' M' + cx + ' ' + y1 + ' L' + cx + ' ' + y0 +
      ' M' + (cx + w * 0.22) + ' ' + y1 + ' L' + (cx + tw * 0.22) + ' ' + y0 + '" stroke="' + A[2] + '" stroke-width=".7" opacity=".55" fill="none"/>' +
      /* 右暗面 */
      '<path d="M' + cx + ' ' + y0 + ' L' + TR + ' ' + y0 + ' L' + R + ' ' + y1 + ' L' + cx + ' ' + y1 + ' Z" fill="' + A[2] + '" opacity=".22"/>' +
      /* 檐口（两端翘起） */
      '<path d="M' + (L - 4) + ' ' + (y1 + 2) + ' Q' + L + ' ' + (y1 - 2.5) + ' ' + (L + 3) + ' ' + (y1 - 1.5) +
      ' L' + (R - 3) + ' ' + (y1 - 1.5) + ' Q' + R + ' ' + (y1 - 2.5) + ' ' + (R + 4) + ' ' + (y1 + 2) +
      ' Q' + R + ' ' + (y1 + 3.2) + ' ' + (R - 4) + ' ' + (y1 + 3.2) + ' L' + (L + 4) + ' ' + (y1 + 3.2) +
      ' Q' + L + ' ' + (y1 + 3.2) + ' ' + (L - 4) + ' ' + (y1 + 2) + ' Z" fill="' + A[2] + '"/>' +
      /* 正脊 + 两端鸱吻 */
      '<rect x="' + TL + '" y="' + (y0 - 3) + '" width="' + tw + '" height="4" rx="1.6" fill="' + A[2] + '"/>' +
      '<circle cx="' + TL + '" cy="' + (y0 - 1.6) + '" r="1.5" fill="' + P.goldMd + '"/>' +
      '<circle cx="' + TR + '" cy="' + (y0 - 1.6) + '" r="1.5" fill="' + P.goldMd + '"/>';
  }
  /* 茅草顶 */
  function thatch(cx, top, w, h, k) {
    var L = cx - w / 2, R = cx + w / 2, y0 = top, y1 = top + h;
    return G(k + 'tc', P.clHi, P.clLo) +
      '<path d="M' + L + ' ' + y1 + ' L' + cx + ' ' + y0 + ' L' + R + ' ' + y1 + ' Z" fill="url(#' + k + 'tc)"/>' +
      '<path d="M' + cx + ' ' + y0 + ' L' + R + ' ' + y1 + ' L' + cx + ' ' + y1 + ' Z" fill="' + P.clLo + '" opacity=".35"/>' +
      '<path d="M' + (L + 2) + ' ' + (y1 - 3) + ' L' + (R - 2) + ' ' + (y1 - 3) + '" stroke="' + P.woodEdge + '" stroke-width=".9" opacity=".45"/>' +
      '<rect x="' + (L - 2) + '" y="' + (y1 - 1) + '" width="' + (w + 4) + '" height="3.4" rx="1.4" fill="' + P.woodLo + '"/>';
  }
  /* 夯土墙 */
  function wallBlock(x, y, w, h, k) {
    return G(k + 'wl', P.wallHi, P.wallLo) +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.2" fill="url(#' + k + 'wl)"/>' +
      '<rect x="' + (x + w * 0.62) + '" y="' + y + '" width="' + (w * 0.38) + '" height="' + h + '" fill="' + P.wallLo + '" opacity=".3"/>';
  }
  /* 台基 */
  function plinth(cx, y, w, h, k) {
    return G(k + 'pl', P.stHi, P.stLo) +
      '<path d="M' + (cx - w / 2) + ' ' + y + ' L' + (cx - w / 2 + 3) + ' ' + (y + h) + ' L' + (cx + w / 2 - 3) + ' ' + (y + h) + ' L' + (cx + w / 2) + ' ' + y + ' Z" fill="url(#' + k + 'pl)"/>' +
      '<rect x="' + (cx - w / 2 - 1.5) + '" y="' + (y - 2) + '" width="' + (w + 3) + '" height="2.6" rx="1" fill="' + P.stHi + '" opacity=".85"/>';
  }
  /* 门 */
  function door(cx, y, w, h, k) {
    return '<rect x="' + (cx - w / 2) + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (w / 2) + '" fill="' + P.woodLo + '"/>' +
      '<rect x="' + (cx - w / 2 + .9) + '" y="' + (y + .9) + '" width="' + (w - 1.8) + '" height="' + (h - 1.2) + '" rx="' + ((w - 1.8) / 2) + '" fill="' + P.woodMd + '"/>' +
      '<rect x="' + (cx - w / 2) + '" y="' + (y + h - 2.2) + '" width="' + w + '" height="1.6" fill="' + P.goldMd + '" opacity=".8"/>';
  }
  /* 直棂窗 */
  function lattice(cx, y, w, h) {
    var s = '';
    for (var i = 1; i < 4; i++) s += '<line x1="' + (cx - w / 2 + w * i / 4) + '" y1="' + y + '" x2="' + (cx - w / 2 + w * i / 4) + '" y2="' + (y + h) + '" stroke="' + P.woodEdge + '" stroke-width=".7"/>';
    return '<rect x="' + (cx - w / 2) + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1" fill="#3d3126"/>' +
      '<rect x="' + (cx - w / 2 - .8) + '" y="' + (y - .8) + '" width="' + (w + 1.6) + '" height="' + (h + 1.6) + '" rx="1.4" fill="none" stroke="' + P.woodMd + '" stroke-width="1.2"/>' + s;
  }
  /* 旗 */
  function flag(x, y, h, col, col2) {
    return '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - h) + '" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
      '<path d="M' + x + ' ' + (y - h) + ' L' + (x + 13) + ' ' + (y - h + 4) + ' L' + x + ' ' + (y - h + 9) + ' Z" fill="' + col + '"/>' +
      '<path d="M' + x + ' ' + (y - h) + ' L' + (x + 7) + ' ' + (y - h + 2.4) + ' L' + x + ' ' + (y - h + 4.6) + ' Z" fill="' + col2 + '" opacity=".7"/>';
  }
  /* 酒旗/幌子 */
  function banner(x, y, h, col) {
    return '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - h) + '" stroke="' + P.woodLo + '" stroke-width="1.4"/>' +
      '<rect x="' + (x + 1) + '" y="' + (y - h + 1) + '" width="6" height="13" rx="1" fill="' + col + '"/>' +
      '<rect x="' + (x + 1) + '" y="' + (y - h + 1) + '" width="2.4" height="13" fill="#fff" opacity=".22"/>';
  }
  /* 树 */
  function tree(x, y, s, k) {
    return G(k + 'tr', P.grHi, P.grLo) +
      '<rect x="' + (x - .9) + '" y="' + (y - 6 * s) + '" width="1.8" height="' + (6 * s) + '" fill="' + P.woodLo + '"/>' +
      '<ellipse cx="' + x + '" cy="' + (y - 9 * s) + '" rx="' + (5 * s) + '" ry="' + (5.4 * s) + '" fill="url(#' + k + 'tr)"/>' +
      '<ellipse cx="' + (x - 1.8 * s) + '" cy="' + (y - 10.6 * s) + '" rx="' + (2.2 * s) + '" ry="' + (2.1 * s) + '" fill="' + P.grHi + '" opacity=".6"/>';
  }
  /* 石堆 */
  function rocks(x, y, k) {
    return G(k + 'rk', P.stHi, P.stLo) +
      '<path d="M' + (x - 8) + ' ' + y + ' L' + (x - 5) + ' ' + (y - 7) + ' L' + (x + 1) + ' ' + (y - 8.5) + ' L' + (x + 7) + ' ' + (y - 4) + ' L' + (x + 9) + ' ' + y + ' Z" fill="url(#' + k + 'rk)"/>' +
      '<path d="M' + (x + 1) + ' ' + (y - 8.5) + ' L' + (x + 7) + ' ' + (y - 4) + ' L' + (x + 9) + ' ' + y + ' L' + (x + 1) + ' ' + y + ' Z" fill="' + P.stLo + '" opacity=".45"/>' +
      '<path d="M' + (x - 4) + ' ' + (y - 4.6) + ' L' + (x - 1.5) + ' ' + (y - 6.4) + '" stroke="' + P.stHi + '" stroke-width="1" opacity=".7"/>';
  }

  /* ============================================================
   * 城内建筑（16）
   * ============================================================ */
  var B = {};
  var KA = 'ic_';

  B.guanfu = function (k) {
    return G(k + 'rf', P.glaHi, P.gllaLo) +
      plinth(32, 50, 42, 6, k) +
      wallBlock(15, 30, 34, 20, k) +
      roof(32, 6, 48, 11, 20, k, 'gla') +
      roof(32, 20, 36, 8, 15, k, 'gla') +
      door(32, 39, 9, 11, k) +
      lattice(20, 34, 6, 7) + lattice(44, 34, 6, 7) +
      '<rect x="26" y="34.5" width="12" height="3.6" rx="1" fill="' + P.goldMd + '"/>' +
      '<text x="32" y="37.4" font-size="3" text-anchor="middle" fill="' + P.woodEdge + '" font-family="serif">官府</text>';
  };

  B.minfang = function (k) {
    return thatch(32, 18, 34, 13, k) +
      wallBlock(17, 31, 30, 20, k) +
      door(32, 39, 8, 12, k) +
      lattice(24, 35, 5.5, 6) + lattice(40, 35, 5.5, 6) +
      '<rect x="41" y="15" width="4.5" height="9" rx="1" fill="' + P.stMd + '"/>' +
      '<rect x="40.4" y="13.4" width="5.7" height="2.4" rx="1" fill="' + P.stLo + '"/>' +
      '<ellipse cx="43.5" cy="11.6" rx="3" ry="2" fill="#fff" opacity=".13"/>';
  };

  B.shuyuan = function (k) {
    return G(k + 'rf', P.tileHi, P.tileLo) +
      plinth(32, 51, 40, 5, k) +
      wallBlock(16, 32, 32, 19, k) +
      roof(32, 10, 44, 10, 17, k) +
      roof(32, 22, 32, 7, 13, k) +
      door(32, 40, 11, 11, k) +
      '<rect x="24" y="36" width="4" height="7" rx="1" fill="' + P.clHi + '"/>' +
      '<rect x="36" y="36" width="4" height="7" rx="1" fill="' + P.clHi + '"/>' +
      '<rect x="29.6" y="27" width="4.8" height="4.4" rx=".8" fill="' + P.goldMd + '"/>';
  };

  B.junying = function (k) {
    /* 军帐 + 枪阵 + 帅旗 */
    var s = '<ellipse cx="32" cy="50" rx="22" ry="4.4" fill="' + P.grLo + '" opacity=".35"/>';
    s += G(k + 'tn', P.clHi, P.clMd) +
      '<path d="M20 49 L32 22 L44 49 Z" fill="url(#' + k + 'tn)"/>' +
      '<path d="M32 22 L44 49 L32 49 Z" fill="' + P.clLo + '" opacity=".38"/>' +
      '<path d="M32 22 L32 49" stroke="' + P.clLo + '" stroke-width=".8" opacity=".6"/>' +
      '<path d="M20 49 L44 49" stroke="' + P.woodLo + '" stroke-width="1.2"/>' +
      '<path d="M26 40 L32 27 L38 40" fill="' + P.rMd + '" opacity=".85"/>' +
      /* 枪阵 */
      '<g stroke="' + P.woodLo + '" stroke-width="1.3">' +
      '<line x1="12" y1="49" x2="10" y2="30"/><line x1="17" y1="49" x2="15.5" y2="26"/></g>' +
      '<path d="M10 30 L8.6 26 L11.4 26 Z" fill="' + P.irHi + '"/>' +
      '<path d="M15.5 26 L14.2 22.4 L16.8 22.4 Z" fill="' + P.irHi + '"/>' +
      flag(48, 48, 26, P.rMd, P.rHi);
    return s;
  };

  B.xiaochang = function (k) {
    /* 箭靶 + 栅栏 */
    var s = G(k + 'gd', P.grHi, P.grLo) + '<ellipse cx="32" cy="51" rx="24" ry="4.6" fill="url(#' + k + 'gd)"/>';
    /* 栅栏 */
    for (var i = 0; i < 7; i++) s += '<rect x="' + (9 + i * 7) + '" y="46" width="1.6" height="6" fill="' + P.woodLo + '"/>';
    s += '<rect x="8" y="47.6" width="48" height="1.6" rx=".8" fill="' + P.woodMd + '"/>';
    /* 靶 */
    s += '<rect x="30.6" y="26" width="2.8" height="21" fill="' + P.woodMd + '"/>';
    [['#f4ead2', 9], [P.rMd, 6.2], ['#f4ead2', 3.4], [P.rLo, 1.4]].forEach(function (r) {
      s += '<circle cx="32" cy="24" r="' + r[1] + '" fill="' + r[0] + '"/>';
    });
    s += '<circle cx="32" cy="24" r="9" fill="none" stroke="' + P.woodEdge + '" stroke-width="1"/>';
    /* 弓 */
    s += '<path d="M14 22 Q6 32 14 42" fill="none" stroke="' + P.woodLo + '" stroke-width="2.2"/>' +
      '<line x1="14" y1="22" x2="14" y2="42" stroke="' + P.clHi + '" stroke-width=".8"/>';
    return s;
  };

  B.shichang = function (k) {
    var s = G(k + 'gd', P.grHi, P.grLo) + '<ellipse cx="32" cy="52" rx="23" ry="4.4" fill="url(#' + k + 'gd)"/>';
    /* 摊位棚 */
    s += '<rect x="12" y="30" width="26" height="3.2" rx="1" fill="' + P.rMd + '"/>' +
      '<path d="M12 30 L15 22 L35 22 L38 30 Z" fill="' + P.rHi + '"/>' +
      '<path d="M25 22 L28 30 L38 30 L35 22 Z" fill="' + P.rLo + '" opacity=".45"/>' +
      '<line x1="14" y1="33" x2="14" y2="51" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
      '<line x1="36" y1="33" x2="36" y2="51" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
      /* 台面与货物 */
      '<rect x="10" y="42" width="30" height="3" rx="1" fill="' + P.woodMd + '"/>' +
      '<circle cx="17" cy="39.4" r="2.6" fill="' + P.goldMd + '"/>' +
      '<circle cx="24" cy="39.8" r="2.3" fill="' + P.grMd + '"/>' +
      '<rect x="29" y="37" width="6" height="5" rx="1" fill="' + P.clHi + '"/>' +
      /* 箩筐 */
      '<path d="M42 44 L44 52 L54 52 L56 44 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M42 44 L44 52 L49 52 L47 44 Z" fill="' + P.woodLo + '"/>' +
      '<ellipse cx="49" cy="44" rx="7" ry="2" fill="' + P.woodHi + '"/>' +
      banner(58, 46, 22, P.goldMd);
    return s;
  };

  B.cangku = function (k) {
    /* 圆形粮仓 */
    var s = G(k + 'bn', P.clHi, P.clMd) + thatch(26, 14, 30, 11, k);
    s += '<rect x="13" y="25" width="26" height="26" rx="2" fill="url(#' + k + 'bn)"/>' +
      '<rect x="26" y="25" width="13" height="26" fill="' + P.clLo + '" opacity=".35"/>' +
      '<rect x="13" y="38" width="26" height="1.6" fill="' + P.woodLo + '" opacity=".5"/>' +
      '<rect x="13" y="30" width="26" height="1.6" fill="' + P.woodLo + '" opacity=".5"/>' +
      door(26, 41, 8, 10, k) +
      /* 陶瓮与麻袋 */
      '<path d="M42 39 Q39 47 42 52 L50 52 Q53 47 50 39 Z" fill="' + P.woodMd + '"/>' +
      '<ellipse cx="46" cy="39" rx="4" ry="1.6" fill="' + P.woodHi + '"/>' +
      '<rect x="44" y="45" width="11" height="7" rx="2.4" fill="' + P.clMd + '"/>' +
      '<rect x="44" y="45" width="4" height="7" rx="1.6" fill="' + P.clHi + '" opacity=".6"/>';
    return s;
  };

  B.chengqiang = function (k) {
    var s = G(k + 'wl', P.wallHi, P.wallLo);
    /* 城墙主体 */
    s += '<rect x="6" y="26" width="52" height="26" rx="1.4" fill="url(#' + k + 'wl)"/>' +
      '<rect x="34" y="26" width="24" height="26" fill="' + P.wallLo + '" opacity=".28"/>' +
      /* 垛口 */
      '<path d="M6 26 L6 20 L12 20 L12 26 L16 26 L16 20 L22 20 L22 26 L26 26 L26 20 L32 20 L32 26 L36 26 L36 20 L42 20 L42 26 L46 26 L46 20 L52 20 L52 26 L58 26 L58 26 L6 26 Z" fill="' + P.wallMd + '" stroke="' + P.wallEdge + '" stroke-width=".6"/>' +
      /* 城门 */
      '<path d="M24 52 L24 34 Q32 27 40 34 L40 52 Z" fill="' + P.woodLo + '"/>' +
      '<path d="M25.2 52 L25.2 35 Q32 28.6 38.8 35 L38.8 52 Z" fill="' + P.woodMd + '"/>' +
      '<line x1="32" y1="30" x2="32" y2="52" stroke="' + P.woodEdge + '" stroke-width=".8"/>' +
      '<circle cx="29" cy="42" r="1" fill="' + P.goldMd + '"/><circle cx="35" cy="42" r="1" fill="' + P.goldMd + '"/>' +
      /* 门楼 */
      roof(32, 8, 26, 7, 11, k) +
      '<rect x="21" y="15" width="22" height="9" fill="' + P.wallMd + '"/>' +
      '<rect x="30" y="17" width="4" height="5" rx="1" fill="#3d3126"/>' +
      '<rect x="8" y="22" width="48" height="4.4" rx="1.4" fill="' + P.wallHi + '" opacity=".9"/>';
    return s;
  };

  B.yizhan = function (k) {
    var s = thatch(26, 22, 30, 10, k);
    s += wallBlock(13, 32, 26, 16, k) +
      '<rect x="13" y="32" width="26" height="16" fill="none"/>' +
      '<rect x="22" y="36" width="8" height="12" rx="1" fill="' + P.woodLo + '"/>' +
      '<rect x="16" y="36" width="4" height="5" fill="#3d3126"/>' +
      /* 驿马 */
      '<g fill="' + P.woodLo + '">' +
      '<path d="M40 52 L42 44 Q44 40 48 39 L56 39 Q58 40 58 43 L56 44 L56 48 Q56 50 54 50 L52 50 L52 52 L50 52 L50 50 L44 50 L44 52 L42 52 Z"/>' +
      '</g>' +
      '<path d="M48 39 Q49 35 52 35 L56 36 Q57 37 56 39 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M56 36 L58 33 L59 34 L57 37 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M42 43 Q40 41 41.6 39.6 L44 41 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M52 48 Q53 45 55 43" stroke="' + P.woodLo + '" stroke-width="1.4" fill="none"/>';
    return s;
  };

  B.fenghuotai = function (k) {
    var s = G(k + 'tw', P.stHi, P.stLo);
    /* 高台（上收下阔） */
    s += '<path d="M20 52 L25 20 L39 20 L44 52 Z" fill="url(#' + k + 'tw)"/>' +
      '<path d="M32 20 L39 20 L44 52 L32 52 Z" fill="' + P.stLo + '" opacity=".42"/>' +
      /* 砖缝 */
      '<g stroke="' + P.stEdge + '" stroke-width=".6" opacity=".45">' +
      '<line x1="22" y1="30" x2="42" y2="30"/><line x1="21" y1="40" x2="43" y2="40"/></g>' +
      '<rect x="17" y="16" width="30" height="5" rx="1.4" fill="' + P.stMd + '"/>' +
      '<rect x="17" y="16" width="30" height="1.6" fill="' + P.stHi + '"/>' +
      /* 台顶柴薪与烈焰 */
      '<path d="M23 16 L41 16 L39 11 L25 11 Z" fill="' + P.woodLo + '"/>' +
      '<path d="M28 11 L36 11 L35 8 L29 8 Z" fill="' + P.woodMd + '"/>' +
      G(k + 'fr', P.fiHi, P.fiLo) +
      '<path d="M32 0 Q37 5 35.5 8 Q34 10 32 9 Q30 10 28.5 8 Q27 5 32 0 Z" fill="url(#' + k + 'fr)"/>' +
      '<path d="M32 3 Q34.6 6.4 33.4 8.4 Q32.4 9.6 32 8.6 Z" fill="' + P.fiHi + '" opacity=".85"/>' +
      /* 烟 */
      '<ellipse cx="26" cy="4" rx="4.6" ry="2.6" fill="#fff" opacity=".1"/>' +
      '<ellipse cx="39" cy="2.4" rx="3.6" ry="2.2" fill="#fff" opacity=".08"/>';
    return s;
  };

  B.majiu = function (k) {
    var s = thatch(24, 22, 28, 9, k);
    s += wallBlock(11, 31, 26, 16, k) +
      /* 马厩栅栏开口 */
      '<rect x="15" y="36" width="18" height="11" fill="' + P.woodLo + '" opacity=".55"/>' +
      '<g stroke="' + P.woodMd + '" stroke-width="1.2">' +
      '<line x1="18" y1="36" x2="18" y2="47"/><line x1="24" y1="36" x2="24" y2="47"/><line x1="30" y1="36" x2="30" y2="47"/></g>' +
      '<rect x="15" y="35.4" width="18" height="1.4" fill="' + P.woodMd + '"/>' +
      /* 马 */
      '<g fill="' + P.woodLo + '">' +
      '<path d="M38 52 L40 43 Q42 39 47 38 L56 38 Q58 39 58 42 L56 43 L56 48 Q56 50 54 50 L52 50 L52 52 L50 52 L50 50 L43 50 L43 52 L41 52 Z"/>' +
      '</g>' +
      '<path d="M47 38 Q48 34 51 34 L55 35 Q56 36 55 38 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M55 35 L57 32 L58 33 L56 36 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M39 42 Q37 40 38.6 38.6 L41 40 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M51 47 Q52 44 54 42" stroke="' + P.woodLo + '" stroke-width="1.4" fill="none"/>';
    return s;
  };

  B.kezhan = function (k) {
    var s = plinth(32, 52, 42, 5, k);
    /* 二层楼 */
    s += wallBlock(15, 30, 34, 22, k) +
      roof(32, 12, 46, 9, 18, k) +
      '<rect x="15" y="29" width="34" height="3.4" rx="1.2" fill="' + P.woodMd + '"/>' +
      '<rect x="15" y="43" width="34" height="3.4" rx="1.2" fill="' + P.woodMd + '"/>' +
      door(28, 42, 9, 10, k) +
      lattice(20, 33, 6, 7) + lattice(36, 33, 6, 7) +
      /* 栏杆 */
      '<g stroke="' + P.woodLo + '" stroke-width="1">' +
      '<line x1="16" y1="42.6" x2="16" y2="45.6"/><line x1="21" y1="42.6" x2="21" y2="45.6"/><line x1="26" y1="42.6" x2="26" y2="45.6"/></g>' +
      banner(52, 40, 22, P.goldMd) +
      '<rect x="44" y="30" width="7" height="9" rx="1.4" fill="' + P.rMd + '"/>' +
      '<rect x="45.6" y="32" width="3.8" height="1.6" rx=".8" fill="' + P.clHi + '" opacity=".8"/>';
    return s;
  };

  B.zhaoxianguan = function (k) {
    var s = plinth(32, 52, 40, 5, k);
    s += wallBlock(14, 32, 36, 20, k) +
      roof(32, 14, 46, 9, 17, k) +
      roof(32, 25, 34, 7, 13, k) +
      door(32, 41, 11, 11, k) +
      '<rect x="22" y="36" width="5" height="8" rx="1" fill="#3d3126"/>' +
      '<rect x="37" y="36" width="5" height="8" rx="1" fill="#3d3126"/>' +
      /* 招贤榜 */
      '<rect x="44" y="30" width="12" height="15" rx="1.4" fill="' + P.clHi + '"/>' +
      '<rect x="44" y="30" width="12" height="15" rx="1.4" fill="none" stroke="' + P.woodLo + '" stroke-width="1"/>' +
      '<g stroke="' + P.woodLo + '" stroke-width=".7" opacity=".6">' +
      '<line x1="46" y1="34" x2="54" y2="34"/><line x1="46" y1="37" x2="54" y2="37"/><line x1="46" y1="40" x2="51" y2="40"/></g>' +
      '<rect x="48" y="26.6" width="4" height="3.6" rx="1" fill="' + P.goldMd + '"/>';
    return s;
  };

  B.honglusi = function (k) {
    var s = plinth(32, 52, 42, 5, k);
    s += wallBlock(16, 33, 32, 19, k) +
      roof(32, 15, 44, 9, 16, k) +
      roof(32, 26, 32, 7, 12, k) +
      door(32, 42, 10, 10, k) +
      '<rect x="23" y="36" width="5" height="7" rx="1" fill="#3d3126"/>' +
      '<rect x="36" y="36" width="5" height="7" rx="1" fill="#3d3126"/>' +
      /* 双阙 */
      '<rect x="4" y="36" width="8" height="16" rx="1" fill="' + P.stMd + '"/>' +
      '<rect x="2" y="32" width="12" height="4.4" rx="1.2" fill="' + P.stHi + '"/>' +
      '<rect x="52" y="36" width="8" height="16" rx="1" fill="' + P.stMd + '"/>' +
      '<rect x="50" y="32" width="12" height="4.4" rx="1.2" fill="' + P.stHi + '"/>' +
      '<circle cx="32" cy="30" r="2.6" fill="' + P.goldMd + '"/>';
    return s;
  };

  B.tiejiangpu = function (k) {
    var s = thatch(20, 24, 24, 8, k);
    s += wallBlock(9, 32, 22, 16, k) +
      '<rect x="13" y="37" width="14" height="11" fill="' + P.woodLo + '" opacity=".6"/>';
    /* 炉火 */
    s += G(k + 'fr', P.fiHi, P.fiLo) +
      '<path d="M13 44 L27 44 L25 36 L15 36 Z" fill="' + P.stLo + '"/>' +
      '<path d="M16 44 L24 44 L22.6 39 L17.4 39 Z" fill="url(#' + k + 'fr)"/>' +
      '<path d="M20 39 Q22 35 20.6 33 Q19.4 35 20 39 Z" fill="' + P.fiHi + '" opacity=".9"/>';
    /* 铁砧 */
    s += '<path d="M36 50 L52 50 L50 46 L38 46 Z" fill="' + P.irLo + '"/>' +
      '<path d="M40 46 L48 46 L47 42 L41 42 Z" fill="' + P.irMd + '"/>' +
      '<path d="M37 42 L51 42 L50 40 L38 40 Z" fill="' + P.irHi + '"/>' +
      '<path d="M51 40 L55 37 L53.6 40.4 Z" fill="' + P.irMd + '"/>';
    /* 锤 */
    s += '<rect x="44" y="24" width="2" height="14" rx="1" transform="rotate(18 45 31)" fill="' + P.woodMd + '"/>' +
      '<rect x="44" y="20" width="8" height="5" rx="1.4" transform="rotate(18 48 22.5)" fill="' + P.irMd + '"/>';
    return s;
  };

  B.gongjiangzuofang = function (k) {
    var s = roof(32, 20, 40, 9, 15, k);
    s += wallBlock(13, 31, 38, 20, k) +
      '<rect x="13" y="30" width="38" height="3" rx="1" fill="' + P.woodMd + '"/>' +
      door(24, 42, 10, 9, k) +
      /* 工作台 + 器械 */
      '<rect x="36" y="40" width="18" height="3" rx="1" fill="' + P.woodMd + '"/>' +
      '<rect x="38" y="43" width="2" height="8" fill="' + P.woodLo + '"/>' +
      '<rect x="50" y="43" width="2" height="8" fill="' + P.woodLo + '"/>' +
      '<circle cx="45" cy="35" r="4.4" fill="none" stroke="' + P.irMd + '" stroke-width="2"/>' +
      '<circle cx="45" cy="35" r="1.4" fill="' + P.irLo + '"/>' +
      '<g stroke="' + P.irMd + '" stroke-width="1.4">' +
      '<line x1="45" y1="30.6" x2="45" y2="33.6"/><line x1="45" y1="36.4" x2="45" y2="39.4"/>' +
      '<line x1="40.6" y1="35" x2="43.6" y2="35"/><line x1="46.4" y1="35" x2="49.4" y2="35"/></g>' +
      '<rect x="30" y="34" width="2" height="8" fill="' + P.woodLo + '"/>';
    return s;
  };

  /* ============================================================
   * 城外资源地块（4）
   * ============================================================ */
  var E = {};
  E.farm = function (k) {
    var s = G(k + 'fy', P.grHi, P.grMd) + '<ellipse cx="32" cy="54" rx="26" ry="6" fill="url(#' + k + 'fy)"/>';
    /* 田垄 */
    for (var i = 0; i < 3; i++) {
      s += '<path d="M10 ' + (44 + i * 5) + ' Q32 ' + (40 + i * 5) + ' 54 ' + (44 + i * 5) + ' L54 ' + (47 + i * 5) + ' Q32 ' + (43 + i * 5) + ' 10 ' + (47 + i * 5) + ' Z" fill="' + P.woodMd + '" opacity="' + (0.85 - i * 0.22) + '"/>';
    }
    /* 麦穗 */
    [[20, 40], [30, 36], [40, 39]].forEach(function (p) {
      s += '<line x1="' + p[0] + '" y1="' + (p[1] + 12) + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="' + P.grLo + '" stroke-width="1.2"/>' +
        '<path d="M' + p[0] + ' ' + p[1] + ' q3 4 0 9 q-3-5 0-9 Z" fill="' + P.goldHi + '"/>' +
        '<path d="M' + (p[0] - 3.4) + ' ' + (p[1] + 3) + ' q-4-3-5-6 q4 0 5 4 Z" fill="' + P.goldMd + '"/>' +
        '<path d="M' + (p[0] + 3.4) + ' ' + (p[1] + 3) + ' q4-3 5-6 q-4 0-5 4 Z" fill="' + P.goldMd + '"/>';
    });
    return s;
  };
  E.forest = function (k) {
    var s = '<ellipse cx="32" cy="55" rx="26" ry="5" fill="' + P.grLo + '" opacity=".4"/>';
    s += tree(14, 54, 1.15, k) + tree(50, 54, 1.35, k) + tree(32, 52, 0.95, k);
    /* 树桩与斧 */
    s += '<ellipse cx="32" cy="52" rx="5" ry="2.2" fill="' + P.woodMd + '"/>' +
      '<ellipse cx="32" cy="51" rx="5" ry="2.2" fill="' + P.woodHi + '"/>' +
      '<ellipse cx="32" cy="51" rx="2.4" ry="1" fill="' + P.woodMd + '" opacity=".6"/>' +
      '<rect x="18" y="34" width="1.6" height="12" rx=".8" transform="rotate(-22 18 40)" fill="' + P.woodMd + '"/>' +
      '<path d="M22 30 L29 33 L27.6 38 L20.6 35 Z" fill="' + P.irHi + '"/>' +
      '<path d="M29 33 L33 34.4 L31.6 38.4 L27.6 38 Z" fill="' + P.irMd + '"/>';
    return s;
  };
  E.quarry = function (k) {
    var s = '<ellipse cx="32" cy="54" rx="26" ry="5.4" fill="' + P.stLo + '" opacity=".35"/>';
    s += rocks(30, 52, k);
    s += '<path d="M18 52 L21 44 L29 43 L33 52 Z" fill="' + P.stMd + '"/>' +
      '<path d="M33 52 L29 43 L36 41 L40 52 Z" fill="' + P.stHi + '"/>' +
      '<path d="M40 52 L36 41 L43 44 L47 52 Z" fill="' + P.stMd + '"/>' +
      '<path d="M29 43 L36 41 L43 44" stroke="' + P.stEdge + '" stroke-width=".8" fill="none" opacity=".5"/>' +
      /* 凿子与锤 */
      '<rect x="46" y="26" width="2.4" height="13" rx="1.2" transform="rotate(20 47 32)" fill="' + P.irMd + '"/>' +
      '<path d="M44 24 L50 26 L48.6 30 L42.6 28 Z" fill="' + P.irHi + '"/>' +
      '<rect x="14" y="28" width="1.8" height="10" rx=".9" transform="rotate(-16 15 33)" fill="' + P.woodMd + '"/>' +
      '<rect x="11" y="22" width="8" height="4.6" rx="1.4" transform="rotate(-16 15 24.4)" fill="' + P.irMd + '"/>';
    return s;
  };
  E.mine = function (k) {
    var s = '<ellipse cx="32" cy="55" rx="26" ry="5" fill="' + P.stLo + '" opacity=".35"/>';
    /* 山体 + 矿洞 */
    s += G(k + 'mt', P.stHi, P.stLo) +
      '<path d="M6 54 L20 22 L34 54 Z" fill="url(#' + k + 'mt)"/>' +
      '<path d="M26 54 L44 16 L62 54 Z" fill="' + P.stMd + '"/>' +
      '<path d="M44 16 L62 54 L44 54 Z" fill="' + P.stLo + '" opacity=".45"/>' +
      '<path d="M20 22 L23 30 L17 31 Z" fill="' + P.stHi + '" opacity=".8"/>' +
      /* 洞口 */
      '<path d="M34 54 L34 40 Q42 33 50 40 L50 54 Z" fill="' + P.ink + '"/>' +
      '<path d="M35.6 54 L35.6 41.4 Q42 35.4 48.4 41.4 L48.4 54 Z" fill="#0f0b07"/>' +
      /* 支撑木架 */
      '<rect x="33" y="39" width="2.4" height="15" fill="' + P.woodLo + '"/>' +
      '<rect x="48.6" y="39" width="2.4" height="15" fill="' + P.woodLo + '"/>' +
      '<rect x="32" y="37.4" width="20" height="3" rx="1" fill="' + P.woodMd + '"/>' +
      /* 矿石车 */
      '<rect x="8" y="46" width="14" height="7" rx="1.4" fill="' + P.woodMd + '"/>' +
      '<path d="M8 46 L11 42 L19 42 L22 46 Z" fill="' + P.woodHi + '"/>' +
      '<circle cx="12" cy="54" r="2.2" fill="' + P.woodLo + '"/><circle cx="19" cy="54" r="2.2" fill="' + P.woodLo + '"/>' +
      '<circle cx="14" cy="44" r="1.8" fill="' + P.irMd + '"/><circle cx="17.4" cy="45" r="1.4" fill="' + P.goldMd + '"/>' +
      /* 镐 */
      '<rect x="52" y="22" width="2" height="14" rx="1" transform="rotate(24 53 29)" fill="' + P.woodMd + '"/>' +
      '<path d="M46 24 Q54 18 62 22 Q56 24 52 28 Q49 26 46 24 Z" fill="' + P.irMd + '"/>';
    return s;
  };

  /* ============================================================
   * 野地地形（7，供地图 canvas 与图例使用）
   * ============================================================ */
  var T = {};
  T.plain = function (k) {
    return '<ellipse cx="32" cy="40" rx="24" ry="13" fill="' + P.grMd + '"/>' +
      '<ellipse cx="32" cy="38" rx="21" ry="11" fill="' + P.grHi + '" opacity=".55"/>' +
      '<path d="M20 40 q2-5 4 0 M28 42 q2-6 4 0 M38 40 q2-5 4 0" stroke="' + P.grLo + '" stroke-width="1.4" fill="none" opacity=".7"/>';
  };
  T.caoyuan = function (k) {
    return '<ellipse cx="32" cy="40" rx="25" ry="13" fill="' + P.grHi + '"/>' +
      '<ellipse cx="32" cy="38" rx="22" ry="11" fill="#c2d68c" opacity=".45"/>' +
      '<g stroke="' + P.grLo + '" stroke-width="1.4" fill="none" opacity=".8">' +
      '<path d="M18 42 q2-7 3 0"/><path d="M26 44 q2-8 3 0"/><path d="M36 42 q2-7 3 0"/><path d="M45 43 q2-6 3 0"/></g>' +
      '<circle cx="46" cy="30" r="3.4" fill="' + P.fiHi + '" opacity=".5"/>';
  };
  T.zhaoze = function (k) {
    return '<ellipse cx="32" cy="40" rx="25" ry="13" fill="' + P.grLo + '"/>' +
      '<ellipse cx="30" cy="38" rx="20" ry="10" fill="' + P.waLo + '" opacity=".7"/>' +
      '<ellipse cx="30" cy="37" rx="15" ry="7" fill="' + P.waMd + '" opacity=".65"/>' +
      '<g stroke="' + P.grMd + '" stroke-width="1.6" fill="none">' +
      '<path d="M20 44 v-8 M22 44 q-4-3-4-7 M22 44 q4-3 4-7"/>' +
      '<path d="M42 45 v-9 M44 45 q-4-3-4-8 M44 45 q4-3 4-8"/></g>' +
      '<ellipse cx="34" cy="36" rx="4" ry="1.6" fill="#fff" opacity=".22"/>';
  };
  T.lake = function (k) {
    return '<ellipse cx="32" cy="40" rx="26" ry="14" fill="' + P.waLo + '"/>' +
      '<ellipse cx="32" cy="38" rx="22" ry="11" fill="' + P.waMd + '"/>' +
      '<ellipse cx="32" cy="36" rx="16" ry="7.4" fill="' + P.waHi + '" opacity=".55"/>' +
      '<g stroke="#fff" stroke-width="1.2" fill="none" opacity=".4">' +
      '<path d="M20 38 q4-2.4 8 0"/><path d="M32 43 q4-2.4 8 0"/><path d="M24 46 q3.4-2 6.8 0"/></g>';
  };
  T.forest = function (k) {
    return '<ellipse cx="32" cy="42" rx="25" ry="12" fill="' + P.grLo + '"/>' +
      tree(18, 46, 1.0, k) + tree(46, 46, 1.1, k) + tree(32, 44, 0.82, k) +
      '<ellipse cx="32" cy="50" rx="22" ry="4.4" fill="#000" opacity=".16"/>';
  };
  T.desert = function (k) {
    return G(k + 'ds', '#e8d5a4', '#b99a5e') +
      '<ellipse cx="32" cy="40" rx="26" ry="14" fill="url(#' + k + 'ds)"/>' +
      '<path d="M10 42 Q22 30 34 40 Q46 49 56 40" fill="none" stroke="#a8894e" stroke-width="1.8" opacity=".7"/>' +
      '<path d="M8 46 Q24 36 38 44 Q50 50 58 44" fill="none" stroke="#a8894e" stroke-width="1.4" opacity=".45"/>' +
      '<circle cx="46" cy="26" r="5" fill="#f6e3aa" opacity=".85"/>';
  };
  T.hill = function (k) {
    return '<ellipse cx="32" cy="44" rx="26" ry="11" fill="' + P.stLo + '"/>' +
      '<path d="M10 46 L22 22 L34 46 Z" fill="' + P.stMd + '"/>' +
      '<path d="M26 46 L40 16 L54 46 Z" fill="' + P.stHi + '"/>' +
      '<path d="M40 16 L54 46 L40 46 Z" fill="' + P.stMd + '" opacity=".55"/>' +
      '<path d="M40 16 L43 24 L37 25 Z" fill="#fff" opacity=".55"/>' +
      '<path d="M22 22 L24.4 28 L19.6 29 Z" fill="#fff" opacity=".35"/>';
  };
  T.city = function (k) {
    return '<rect x="10" y="26" width="44" height="24" rx="1.6" fill="' + P.wallMd + '"/>' +
      '<path d="M10 26 L10 20 L16 20 L16 26 L20 26 L20 20 L26 20 L26 26 L30 26 L30 20 L36 20 L36 26 L40 26 L40 20 L46 20 L46 26 L50 26 L50 20 L56 20 L56 26 L56 26 Z" fill="' + P.wallHi + '"/>' +
      '<path d="M24 50 L24 34 Q32 27 40 34 L40 50 Z" fill="' + P.woodLo + '"/>' +
      roof(32, 12, 26, 7, 11, k);
  };

  /* ============================================================
   * 资源（6）
   * ============================================================ */
  var R = {};
  /* v31 资源 6 重画：每个都做成"写实小品"——粮袋/木堆/石堆/矿坑/金币/村民 */
  R.grain = function (k) {
    /* 粮袋（麻布袋装粮，束口绳） */
    var s = '<ellipse cx="32" cy="56" rx="20" ry="3" fill="#000" opacity=".25"/>';
    /* 袋身（梯形上窄下宽） */
    s += '<path d="M14 22 L50 22 L54 54 L10 54 Z" fill="url(#' + G('ic_grn', P.clHi, P.clLo) + ')"/>';
    s = s.replace(G('ic_grn', P.clHi, P.clLo), '');
    s = '<ellipse cx="32" cy="56" rx="20" ry="3" fill="#000" opacity=".25"/>' +
      '<defs>' + G('ic_grn_g', P.clHi, P.clLo) + '</defs>' +
      '<path d="M14 22 L50 22 L54 54 L10 54 Z" fill="url(#ic_grn_g)"/>' +
      /* 右暗面 */
      '<path d="M32 22 L50 22 L54 54 L32 54 Z" fill="' + P.clLo + '" opacity=".28"/>' +
      /* 麻袋纹路（横线编织感） */
      '<g stroke="' + P.woodLo + '" stroke-width=".4" opacity=".55">' +
      '<path d="M14 30 L50 30"/><path d="M13 38 L51 38"/><path d="M12 46 L52 46"/>' +
      '</g>' +
      /* 束口绳（圆形束口） */
      '<ellipse cx="32" cy="22" rx="9" ry="3" fill="' + P.clMd + '"/>' +
      '<ellipse cx="32" cy="22" rx="9" ry="3" fill="none" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
      /* 绳索缠绕束口（多道弧） */
      '<path d="M23 22 Q32 18 41 22" stroke="' + P.woodMd + '" stroke-width="1.2" fill="none"/>' +
      '<path d="M23 22 Q32 26 41 22" stroke="' + P.woodMd + '" stroke-width="1.2" fill="none" opacity=".7"/>' +
      /* 粮穗头（左上伸出的麦穗） */
      '<line x1="20" y1="22" x2="14" y2="8" stroke="' + P.grLo + '" stroke-width="1.4"/>' +
      '<path d="M14 8 q3 3 0 6 q-3-3 0-6 Z" fill="' + P.goldHi + '"/>' +
      '<path d="M14 12 q-3-2-4-5 q4 0 4 5 Z" fill="' + P.goldMd + '"/>' +
      '<path d="M14 12 q3-2 4-5 q-4 0-4 5 Z" fill="' + P.goldMd + '"/>' +
      /* 袋中露出金穗 */
      '<path d="M28 20 q3 4 0 8 q-3-4 0-8 Z" fill="' + P.goldHi + '"/>' +
      '<path d="M36 20 q3 4 0 8 q-3-4 0-8 Z" fill="' + P.goldHi + '"/>';
    return s;
  };
  R.wood = function (k) {
    /* 木堆：3 段粗细不同的圆木 + 树叶点缀 */
    var s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".28"/>';
    /* 底段（最粗） */
    s += '<rect x="6" y="38" width="52" height="12" rx="2" fill="url(#' + G('ic_wd_a', P.woodHi, P.woodLo) + ')"/>';
    s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".28"/>' +
      '<defs>' + G('ic_wd_a', P.woodHi, P.woodLo) + G('ic_wd_b', P.woodMd, P.woodLo) + '</defs>' +
      '<rect x="6" y="38" width="52" height="12" rx="2" fill="url(#ic_wd_a)"/>' +
      /* 底段端面年轮 */
      '<ellipse cx="8" cy="44" rx="3" ry="6" fill="' + P.woodHi + '"/>' +
      '<ellipse cx="8" cy="44" rx="2" ry="4" fill="none" stroke="' + P.woodLo + '" stroke-width=".6"/>' +
      '<ellipse cx="8" cy="44" rx="1" ry="2" fill="' + P.woodLo + '" opacity=".7"/>' +
      /* 中段 */
      '<rect x="10" y="22" width="44" height="14" rx="2" fill="url(#ic_wd_b)"/>' +
      '<ellipse cx="54" cy="29" rx="3" ry="6" fill="' + P.woodMd + '"/>' +
      '<ellipse cx="54" cy="29" rx="2" ry="4" fill="none" stroke="' + P.woodLo + '" stroke-width=".6"/>' +
      /* 顶段（最细，亮色） */
      '<rect x="14" y="8" width="36" height="12" rx="2" fill="' + P.woodHi + '"/>' +
      '<rect x="14" y="8" width="36" height="3.4" rx="1.6" fill="#fff" opacity=".3"/>' +
      '<ellipse cx="50" cy="14" rx="3" ry="5.5" fill="' + P.woodMd + '"/>' +
      '<ellipse cx="50" cy="14" rx="2" ry="3.6" fill="none" stroke="' + P.woodLo + '" stroke-width=".6"/>' +
      /* 树皮竖纹 */
      '<g stroke="' + P.woodLo + '" stroke-width=".5" opacity=".55">' +
      '<line x1="20" y1="11" x2="20" y2="18"/><line x1="26" y1="11" x2="26" y2="18"/>' +
      '<line x1="34" y1="11" x2="34" y2="18"/><line x1="40" y1="11" x2="40" y2="18"/>' +
      '<line x1="46" y1="11" x2="46" y2="18"/>' +
      '<line x1="16" y1="25" x2="16" y2="34"/><line x1="24" y1="25" x2="24" y2="34"/>' +
      '<line x1="32" y1="25" x2="32" y2="34"/><line x1="40" y1="25" x2="40" y2="34"/>' +
      '<line x1="48" y1="25" x2="48" y2="34"/>' +
      '<line x1="12" y1="41" x2="12" y2="49"/><line x1="20" y1="41" x2="20" y2="49"/>' +
      '<line x1="28" y1="41" x2="28" y2="49"/><line x1="36" y1="41" x2="36" y2="49"/>' +
      '<line x1="44" y1="41" x2="44" y2="49"/><line x1="52" y1="41" x2="52" y2="49"/>' +
      '</g>' +
      /* 顶段嫩叶（绿色点缀） */
      '<path d="M16 8 Q14 4 18 4 Q20 6 18 9 Z" fill="' + P.grMd + '"/>' +
      '<path d="M48 8 Q50 4 46 4 Q44 6 46 9 Z" fill="' + P.grMd + '"/>';
    return s;
  };
  R.stone = function (k) {
    /* 石堆：3-4 块大小不同的石块堆叠 */
    var s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".28"/>';
    /* 底石（最大） */
    s += '<path d="M6 54 L10 38 L24 32 L40 34 L54 40 L58 54 Z" fill="' + P.stMd + '"/>' +
      '<path d="M10 38 L24 32 L40 34 L54 40 L58 54 L48 54 L36 50 L22 52 L10 54 Z" fill="' + P.stLo + '" opacity=".35"/>' +
      '<path d="M10 38 L24 32 L40 34 L54 40" stroke="' + P.stHi + '" stroke-width=".8" fill="none" opacity=".7"/>' +
      /* 中石 */
      '<path d="M14 36 L18 22 L32 18 L42 24 L44 36 Z" fill="' + P.stHi + '"/>' +
      '<path d="M32 18 L42 24 L44 36 L32 36 Z" fill="' + P.stMd + '" opacity=".4"/>' +
      '<path d="M18 22 L32 18 L42 24" stroke="' + P.stHi + '" stroke-width=".7" fill="none" opacity=".6"/>' +
      '<path d="M22 26 L26 24 M28 30 L34 28 M36 26 L40 30" stroke="' + P.stLo + '" stroke-width=".5" opacity=".55"/>' +
      /* 顶石（小而亮） */
      '<path d="M22 22 L26 10 L36 8 L40 18 L36 24 Z" fill="' + P.stHi + '"/>' +
      '<path d="M36 8 L40 18 L36 24 Z" fill="' + P.stMd + '" opacity=".35"/>' +
      '<path d="M26 10 L36 8 L40 18" stroke="#fff" stroke-width=".6" fill="none" opacity=".7"/>' +
      /* 顶石左高光 */
      '<path d="M24 18 L30 10 L36 9" stroke="#fff" stroke-width=".8" fill="none" opacity=".55"/>';
    return s;
  };
  R.iron = function (k) {
    /* 矿堆：坑坑洼洼的矿石块 + 红色光晕（暗示熔/热） */
    var s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".28"/>';
    /* 底矿（大块不规则） */
    s += '<path d="M8 52 L12 36 L20 30 L34 32 L48 30 L56 38 L56 52 Z" fill="' + P.irLo + '"/>' +
      '<path d="M12 36 L20 30 L34 32 L48 30 L56 38" stroke="' + P.irMd + '" stroke-width=".9" fill="none"/>' +
      /* 中矿 */
      '<path d="M16 34 L22 22 L34 20 L46 26 L48 34 Z" fill="' + P.irMd + '"/>' +
      '<path d="M22 22 L34 20 L46 26 L48 34 L34 34 Z" fill="' + P.irHi + '" opacity=".4"/>' +
      '<path d="M22 22 L34 20 L46 26" stroke="#fff" stroke-width=".7" fill="none" opacity=".6"/>' +
      /* 顶矿（小，最亮） */
      '<path d="M24 22 L28 10 L38 8 L42 18 L38 22 Z" fill="' + P.irHi + '"/>' +
      '<path d="M38 8 L42 18 L38 22 Z" fill="' + P.irMd + '" opacity=".4"/>' +
      '<path d="M28 10 L38 8 L42 18" stroke="#fff" stroke-width=".8" fill="none" opacity=".7"/>' +
      /* 红色光晕（暗示熔融） */
      '<circle cx="32" cy="20" r="3" fill="' + P.fiHi + '" opacity=".7"/>' +
      '<circle cx="32" cy="20" r="1.6" fill="#fff" opacity=".6"/>' +
      /* 矿面裂纹 */
      '<g stroke="' + P.ink + '" stroke-width=".6" opacity=".5">' +
      '<path d="M14 42 L20 44 M18 46 L26 48 M28 42 L34 44 M32 48 L40 46 M40 42 L48 44"/>' +
      '<path d="M22 30 L28 32 M26 36 L32 38 M36 28 L42 30"/>' +
      '</g>' +
      /* 散落小矿屑 */
      '<circle cx="14" cy="50" r="1.4" fill="' + P.irMd + '"/>' +
      '<circle cx="52" cy="50" r="1.6" fill="' + P.irMd + '"/>' +
      '<circle cx="58" cy="48" r="1" fill="' + P.irMd + '"/>';
    return s;
  };
  R.gold = function (k) {
    /* 金币堆：3 叠古钱币 + 金光 */
    var s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".25"/>';
    /* 后排高叠 */
    s += '<rect x="40" y="20" width="14" height="30" rx="1.4" fill="' + P.goldLo + '"/>' +
      '<ellipse cx="47" cy="20" rx="7" ry="2.6" fill="' + P.goldMd + '"/>' +
      '<ellipse cx="47" cy="20" rx="7" ry="2.6" fill="none" stroke="' + P.goldHi + '" stroke-width=".8"/>' +
      '<ellipse cx="47" cy="50" rx="7" ry="2.6" fill="' + P.goldLo + '"/>' +
      /* 金币叠竖纹（多枚） */
      '<line x1="40" y1="26" x2="54" y2="26" stroke="' + P.goldHi + '" stroke-width=".6" opacity=".6"/>' +
      '<line x1="40" y1="32" x2="54" y2="32" stroke="' + P.goldHi + '" stroke-width=".6" opacity=".6"/>' +
      '<line x1="40" y1="38" x2="54" y2="38" stroke="' + P.goldHi + '" stroke-width=".6" opacity=".6"/>' +
      '<line x1="40" y1="44" x2="54" y2="44" stroke="' + P.goldHi + '" stroke-width=".6" opacity=".6"/>' +
      /* 前排左叠 */
      '<rect x="10" y="28" width="14" height="22" rx="1.4" fill="' + P.goldMd + '"/>' +
      '<ellipse cx="17" cy="28" rx="7" ry="2.6" fill="' + P.goldHi + '"/>' +
      '<ellipse cx="17" cy="28" rx="7" ry="2.6" fill="none" stroke="' + P.goldLo + '" stroke-width=".7"/>' +
      '<ellipse cx="17" cy="50" rx="7" ry="2.6" fill="' + P.goldMd + '"/>' +
      /* 古钱方孔 */
      '<rect x="15" y="35" width="4" height="4" fill="' + P.goldLo + '"/>' +
      '<rect x="15" y="42" width="4" height="4" fill="' + P.goldLo + '"/>' +
      /* 前排中间矮叠 */
      '<rect x="26" y="36" width="14" height="14" rx="1.4" fill="' + P.goldMd + '"/>' +
      '<ellipse cx="33" cy="36" rx="7" ry="2.4" fill="' + P.goldHi + '"/>' +
      '<ellipse cx="33" cy="36" rx="7" ry="2.4" fill="none" stroke="' + P.goldLo + '" stroke-width=".7"/>' +
      '<ellipse cx="33" cy="50" rx="7" ry="2.4" fill="' + P.goldMd + '"/>' +
      '<rect x="31" y="40" width="4" height="4" fill="' + P.goldLo + '"/>' +
      /* 散落金币（地上一枚，斜放） */
      '<ellipse cx="6" cy="52" rx="5" ry="2" fill="' + P.goldHi + '" transform="rotate(-20 6 52)"/>' +
      '<ellipse cx="6" cy="52" rx="5" ry="2" fill="none" stroke="' + P.goldLo + '" stroke-width=".6" transform="rotate(-20 6 52)"/>' +
      '<rect x="4.5" y="51" width="3" height="3" fill="' + P.goldLo + '" transform="rotate(-20 6 52)"/>' +
      /* 金光星芒 */
      '<g stroke="' + P.goldHi + '" stroke-width=".7" stroke-linecap="round" opacity=".7">' +
      '<line x1="32" y1="6" x2="32" y2="12"/><line x1="22" y1="10" x2="26" y2="14"/>' +
      '<line x1="42" y1="10" x2="38" y2="14"/><line x1="20" y1="16" x2="24" y2="18"/>' +
      '<line x1="44" y1="16" x2="40" y2="18"/>' +
      '</g>';
    return s;
  };
  R.pop = function (k) {
    /* 村民队列：3 个小人剪影（一家） */
    var s = '<ellipse cx="32" cy="56" rx="24" ry="2.6" fill="#000" opacity=".25"/>';
    /* 左边小人（小孩） */
    s += '<circle cx="12" cy="22" r="3.8" fill="' + P.clHi + '"/>' +
      '<path d="M8 22 Q8 18 12 18 Q16 18 16 22 L16 24 L8 24 Z" fill="' + P.clLo + '"/>' +
      '<path d="M8 38 Q8 28 12 28 Q16 28 16 38 L13 38 L13 50 L11 50 L11 38 Z" fill="' + P.clMd + '"/>' +
      '<path d="M12 28 Q16 28 16 38 L13 38 L13 50 L15 50 L15 38 Z" fill="' + P.clLo + '" opacity=".4"/>' +
      /* 中间高个（成年人，戴斗笠） */
      '<ellipse cx="32" cy="14" rx="7" ry="2.4" fill="' + P.woodLo + '"/>' +
      '<rect x="30" y="13" width="4" height="6" fill="' + P.woodMd + '"/>' +
      '<circle cx="32" cy="22" r="4.2" fill="' + P.clHi + '"/>' +
      '<path d="M22 38 Q22 28 32 28 Q42 28 42 38 L37 50 L27 50 Z" fill="' + P.clMd + '"/>' +
      '<path d="M32 28 Q42 28 42 38 L37 50 L33 50 L33 28 Z" fill="' + P.clLo + '" opacity=".4"/>' +
      /* 腰带 */
      '<rect x="22" y="36" width="20" height="2" fill="' + P.woodLo + '"/>' +
      /* 右手持工具 */
      '<rect x="40" y="32" width="3" height="12" rx="1" transform="rotate(-20 41 38)" fill="' + P.woodMd + '"/>' +
      '<rect x="38" y="40" width="5" height="6" rx="1.4" transform="rotate(-20 41 43)" fill="' + P.irMd + '"/>' +
      /* 右边小人（戴包头） */
      '<path d="M50 16 Q50 12 54 12 Q58 12 58 16 L58 20 L50 20 Z" fill="' + P.woodLo + '"/>' +
      '<circle cx="54" cy="24" r="3.8" fill="' + P.clHi + '"/>' +
      '<path d="M50 38 Q50 28 54 28 Q58 28 58 38 L55 38 L55 50 L53 50 L53 38 Z" fill="' + P.clMd + '"/>' +
      /* 左边小人手持草 */
      '<line x1="6" y1="30" x2="14" y2="28" stroke="' + P.woodMd + '" stroke-width="1.4"/>' +
      '<path d="M14 28 q4 2 0 5 q-4-3 0-5 Z" fill="' + P.goldHi + '"/>' +
      /* 旗帜（中间成人肩扛小旗） */
      '<line x1="22" y1="22" x2="22" y2="14" stroke="' + P.woodMd + '" stroke-width="1.2"/>' +
      '<path d="M22 14 L30 16 L22 18 Z" fill="' + P.rMd + '"/>' +
      '<path d="M22 14 L26 15 L22 16 Z" fill="' + P.rHi + '"/>';
    return s;
  };

  /* ============================================================
   * 兵种（18）— 剪影 + 主武器，按兵科分色
   * ============================================================ */
  /* v31 兵种四类独立剪影
     foot: 步兵（持长兵器，盾在身侧）
     bow: 弓兵（开弓姿态）
     horse: 骑兵（马+骑手剪影）
     cart: 器械（车/弩/投石机） */
  function soldierFoot(tone, w) {
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    var s = '<ellipse cx="30" cy="56" rx="14" ry="2.6" fill="#000" opacity=".28"/>';
    /* 双腿（左前右后） */
    s += '<path d="M24 44 L21 56 L26 56 L29 44 Z" fill="' + C3 + '"/>' +
      '<path d="M31 44 L30 56 L35 56 L36 44 Z" fill="' + C2 + '"/>' +
      '<path d="M22 54 L26 54 M30 54 L34 54" stroke="#000" stroke-width=".6" opacity=".5"/>';
    /* 铠甲胸甲（左右分色） */
    s += '<path d="M22 22 L18 44 L30 44 L30 22 Z" fill="' + C2 + '"/>' +
      '<path d="M30 22 L42 22 L42 44 L30 44 Z" fill="' + C3 + '"/>' +
      /* 胸甲鳞片 */
      '<g stroke="' + C1 + '" stroke-width=".4" opacity=".55">' +
      '<path d="M21 28 L42 28"/><path d="M20 32 L42 32"/><path d="M19 36 L42 36"/><path d="M19 40 L42 40"/>' +
      '</g>' +
      /* 腰带 */
      '<rect x="18" y="40" width="24" height="3" fill="' + P.woodLo + '"/>' +
      '<rect x="29" y="39.5" width="3" height="4" rx=".8" fill="' + P.goldMd + '"/>';
    /* 双臂（持兵器） */
    s += '<path d="M22 22 L16 30 L18 32 L24 24 Z" fill="' + C2 + '"/>' + /* 左臂 */
      '<path d="M42 22 L48 16 L50 18 L44 24 Z" fill="' + C3 + '"/>' + /* 右臂 */
      /* 手 */
      '<circle cx="16.5" cy="30.5" r="1.6" fill="' + P.woodMd + '"/>' +
      '<circle cx="48.5" cy="16.5" r="1.6" fill="' + P.woodMd + '"/>';
    /* 头 */
    s += '<circle cx="32" cy="18" r="4.2" fill="' + P.woodMd + '"/>' +
      '<circle cx="32" cy="18" r="3.4" fill="' + P.clHi + '"/>' +
      '<circle cx="31" cy="16.5" r="1" fill="#fff" opacity=".4"/>';
    /* 头盔（带面甲） */
    s += '<path d="M27.4 16 Q27.4 11 32 11 Q36.6 11 36.6 16 Z" fill="' + C1 + '"/>' +
      '<rect x="27.6" y="14" width="8.8" height="2" rx="1" fill="' + C3 + '"/>' +
      /* 盔缨 */
      '<path d="M32 8 L31 4 M32 8 L33 4 M32 8 L32 3" stroke="' + P.rMd + '" stroke-width=".8" stroke-linecap="round"/>' +
      '<circle cx="32" cy="8" r="1" fill="' + P.goldMd + '"/>';
    /* 持的兵器（按 w 分） */
    if (w === 'spear') {
      s += '<line x1="50" y1="6" x2="44" y2="50" stroke="' + P.woodMd + '" stroke-width="2"/>' +
        '<path d="M50 6 L53 2 L55 6 L52 8 Z" fill="' + P.irHi + '"/>' +
        '<path d="M50 6 L53 2 L52 6 Z" fill="#fff" opacity=".5"/>';
    } else if (w === 'sword') {
      s += '<path d="M48 14 L54 8 L56 10 L50 16 Z" fill="' + P.irHi + '"/>' +
        '<path d="M48 14 L54 8 L55 9 L49 15 Z" fill="#fff" opacity=".4"/>' +
        '<rect x="44" y="14" width="9" height="2" rx=".8" transform="rotate(-45 48 15)" fill="' + P.goldMd + '"/>' +
        '<rect x="46" y="16" width="5" height="2.4" rx="1" transform="rotate(-45 48 17)" fill="' + P.woodMd + '"/>';
    } else if (w === 'shield') {
      s += '<rect x="10" y="26" width="14" height="20" rx="3" fill="' + P.irMd + '"/>' +
        '<rect x="10" y="26" width="14" height="5" rx="2" fill="' + P.irHi + '"/>' +
        '<path d="M12 30 L22 30 L22 42 Q17 48 12 42 Z" fill="' + P.goldMd + '"/>' +
        '<circle cx="17" cy="36" r="2.4" fill="' + P.rMd + '"/>' +
        '<line x1="17" y1="26" x2="17" y2="46" stroke="' + P.irLo + '" stroke-width="1"/>';
    } else if (w === 'axe') {
      s += '<line x1="50" y1="12" x2="46" y2="46" stroke="' + P.woodMd + '" stroke-width="2"/>' +
        '<path d="M48 10 Q56 4 60 10 Q56 14 52 18 Q49 14 48 10 Z" fill="' + P.irHi + '"/>' +
        '<path d="M48 10 Q56 4 60 10 L54 12 Z" fill="#fff" opacity=".4"/>';
    }
    return s;
  }
  function soldierBow(tone) {
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    var s = '<ellipse cx="30" cy="56" rx="14" ry="2.6" fill="#000" opacity=".28"/>';
    /* 双腿 */
    s += '<path d="M24 44 L21 56 L26 56 L29 44 Z" fill="' + C3 + '"/>' +
      '<path d="M31 44 L30 56 L35 56 L36 44 Z" fill="' + C2 + '"/>';
    /* 轻型胸甲（窄） */
    s += '<path d="M22 22 L20 44 L30 44 L30 22 Z" fill="' + C2 + '"/>' +
      '<path d="M30 22 L42 22 L42 44 L30 44 Z" fill="' + C3 + '"/>' +
      '<g stroke="' + C1 + '" stroke-width=".4" opacity=".5">' +
      '<path d="M21 28 L42 28"/><path d="M20 32 L42 32"/><path d="M19 36 L42 36"/><path d="M19 40 L42 40"/>' +
      '</g>';
    /* 左臂持弓（弓弦拉满姿态） */
    s += '<path d="M22 22 L14 30 L18 38 L24 32 Z" fill="' + C2 + '"/>' +
      /* 弓身（弯曲，浅色木） */
      '<path d="M14 30 Q6 36 14 46" stroke="' + P.woodHi + '" stroke-width="2.4" fill="none"/>' +
      '<path d="M14 30 Q6 36 14 46" stroke="' + P.woodLo + '" stroke-width=".8" fill="none" opacity=".5"/>' +
      /* 弓弦（拉紧） */
      '<line x1="14" y1="30" x2="22" y2="38" stroke="' + P.clHi + '" stroke-width=".9"/>' +
      /* 箭（搭弦） */
      '<line x1="22" y1="38" x2="48" y2="32" stroke="' + P.woodMd + '" stroke-width="1.4"/>' +
      '<path d="M48 32 L52 30 L52 33 L48 34 Z" fill="' + P.irHi + '"/>' +
      /* 箭羽 */
      '<path d="M44 33 L46 31 L46 33 Z M44 33 L46 35 L46 33 Z" fill="' + P.clHi + '"/>';
    /* 右臂拉弦 */
    s += '<path d="M42 22 L48 30 L44 34 L40 26 Z" fill="' + C3 + '"/>' +
      '<circle cx="46" cy="32" r="1.6" fill="' + P.woodMd + '"/>';
    /* 头 */
    s += '<circle cx="32" cy="18" r="4.2" fill="' + P.woodMd + '"/>' +
      '<circle cx="32" cy="18" r="3.4" fill="' + P.clHi + '"/>' +
      '<circle cx="31" cy="16.5" r="1" fill="#fff" opacity=".4"/>';
    /* 盔（轻盔，无缨） */
    s += '<path d="M27.6 16 Q27.6 11.5 32 11.5 Q36.4 11.5 36.4 16 Z" fill="' + C1 + '"/>' +
      '<rect x="27.6" y="14" width="8.8" height="2" rx="1" fill="' + C3 + '"/>' +
      /* 箭袋 */
      '<rect x="36" y="34" width="5" height="14" rx="1.4" fill="' + P.woodLo + '"/>' +
      '<rect x="36" y="34" width="5" height="3" rx="1" fill="' + P.clMd + '"/>' +
      /* 露出箭尾 */
      '<line x1="37" y1="36" x2="36" y2="32" stroke="' + P.woodMd + '" stroke-width=".7"/>' +
      '<line x1="39" y1="36" x2="38" y2="32" stroke="' + P.woodMd + '" stroke-width=".7"/>' +
      '<line x1="41" y1="36" x2="40" y2="32" stroke="' + P.woodMd + '" stroke-width=".7"/>';
    return s;
  }
  function soldierMount(tone, w) {
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    /* v31：骑兵剪影——坐姿骑手 + 马（马头朝右） */
    var s = '<ellipse cx="32" cy="56" rx="22" ry="2.6" fill="#000" opacity=".28"/>';
    /* 马（横向，腿前伸） */
    s += '<path d="M8 48 L10 36 Q14 28 22 28 L46 28 Q52 30 50 36 L48 38 L50 44 Q50 48 46 48 L43 48 L43 52 L40 52 L40 48 L20 48 L20 52 L17 52 L17 48 L13 48 Q8 48 8 48 Z" fill="' + P.woodLo + '"/>' +
      /* 马的左亮面 */
      '<path d="M8 48 L10 36 Q14 28 22 28 L20 36 L17 48 Z" fill="' + P.woodMd + '" opacity=".5"/>' +
      /* 马鬃 */
      '<path d="M14 32 Q20 28 22 28 L24 28 L20 34 Z" fill="' + P.woodHi + '"/>' +
      '<path d="M16 32 L18 28 M18 32 L20 28 M20 32 L22 28" stroke="' + P.woodEdge + '" stroke-width=".5"/>' +
      /* 马头（朝右前） */
      '<path d="M46 28 Q48 22 52 22 L58 24 Q60 28 56 30 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M56 30 L58 26 L60 27.4 L57.4 31 Z" fill="' + P.woodHi + '"/>' +
      '<circle cx="55" cy="26" r=".8" fill="#000"/>' +
      /* 马尾 */
      '<path d="M8 42 Q2 38 4 46 Q6 42 8 46" fill="' + P.woodLo + '"/>' +
      '<path d="M6 42 Q4 38 6 36" stroke="' + P.woodLo + '" stroke-width="1.4" fill="none"/>' +
      /* 马镫 */
      '<line x1="24" y1="48" x2="24" y2="52" stroke="' + P.woodLo + '" stroke-width="1"/>' +
      '<line x1="38" y1="48" x2="38" y2="52" stroke="' + P.woodLo + '" stroke-width="1"/>';
    /* 骑手（坐姿，腿前伸） */
    /* 腿 */
    s += '<path d="M22 26 L20 36 L26 36 L28 26 Z" fill="' + C3 + '"/>' +
      '<path d="M38 26 L38 36 L44 36 L42 26 Z" fill="' + C2 + '"/>';
    /* 身（铠甲前倾） */
    s += '<path d="M22 16 L20 28 L32 28 L32 16 Z" fill="' + C2 + '"/>' +
      '<path d="M32 16 L44 16 L42 28 L32 28 Z" fill="' + C3 + '"/>' +
      '<g stroke="' + C1 + '" stroke-width=".4" opacity=".5">' +
      '<path d="M21 20 L43 20"/><path d="M20 24 L42 24"/>' +
      '</g>';
    /* 左臂（持兵器） */
    s += '<path d="M22 16 L14 14 L12 16 L20 18 Z" fill="' + C2 + '"/>' +
      '<circle cx="13" cy="15" r="1.4" fill="' + P.woodMd + '"/>';
    /* 持兵器 */
    if (w === 'spear') {
      s += '<line x1="14" y1="14" x2="6" y2="2" stroke="' + P.woodMd + '" stroke-width="2"/>' +
        '<path d="M6 2 L9 -1 L11 3 L8 5 Z" fill="' + P.irHi + '"/>';
    } else if (w === 'sword') {
      s += '<path d="M14 14 L8 10 L10 8 L16 12 Z" fill="' + P.irHi + '"/>' +
        '<rect x="10" y="12" width="6" height="1.6" rx=".8" transform="rotate(-30 13 13)" fill="' + P.goldMd + '"/>';
    } else if (w === 'bow') {
      s += '<path d="M14 14 Q6 8 14 4" stroke="' + P.woodHi + '" stroke-width="1.8" fill="none"/>' +
        '<line x1="14" y1="14" x2="14" y2="4" stroke="' + P.clHi + '" stroke-width=".7"/>';
    } else if (w === 'axe') {
      s += '<line x1="14" y1="14" x2="12" y2="4" stroke="' + P.woodMd + '" stroke-width="1.6"/>' +
        '<path d="M10 4 Q4 0 0 4 Q6 8 10 8 Z" fill="' + P.irHi + '"/>';
    }
    /* 右臂 */
    s += '<path d="M42 16 L50 18 L52 16 L44 14 Z" fill="' + C3 + '"/>';
    /* 头 */
    s += '<circle cx="32" cy="12" r="4.2" fill="' + P.woodMd + '"/>' +
      '<circle cx="32" cy="12" r="3.4" fill="' + P.clHi + '"/>' +
      '<circle cx="31" cy="10.5" r="1" fill="#fff" opacity=".4"/>';
    /* 盔 */
    s += '<path d="M27.4 10 Q27.4 5 32 5 Q36.6 5 36.6 10 Z" fill="' + C1 + '"/>' +
      '<rect x="27.4" y="8" width="9.2" height="2" rx="1" fill="' + C3 + '"/>' +
      '<path d="M32 5 L30 2 M32 5 L34 2 M32 5 L32 1" stroke="' + P.rMd + '" stroke-width=".8" stroke-linecap="round"/>' +
      '<circle cx="32" cy="5" r="1" fill="' + P.goldMd + '"/>';
    /* 披风（骑兵常有） */
    s += '<path d="M44 18 L52 22 L48 28 L42 24 Z" fill="' + P.rMd + '" opacity=".5"/>';
    return s;
  }
  function soldierCart(tone, kind) {
    /* v31：器械四类——投石机/冲车/床弩/投石车 */
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    var s = '<ellipse cx="32" cy="56" rx="20" ry="2.6" fill="#000" opacity=".28"/>';
    /* 车轮（两轮） */
    s += '<circle cx="14" cy="50" r="6" fill="' + P.woodMd + '"/>' +
      '<circle cx="14" cy="50" r="4.2" fill="' + P.woodLo + '"/>' +
      '<circle cx="14" cy="50" r="1.4" fill="' + P.woodMd + '"/>' +
      '<g stroke="' + P.woodHi + '" stroke-width=".8" opacity=".6">' +
      '<line x1="14" y1="46" x2="14" y2="54"/><line x1="10" y1="50" x2="18" y2="50"/>' +
      '<line x1="11" y1="47" x2="17" y2="53"/><line x1="11" y1="53" x2="17" y2="47"/>' +
      '</g>' +
      '<circle cx="50" cy="50" r="6" fill="' + P.woodMd + '"/>' +
      '<circle cx="50" cy="50" r="4.2" fill="' + P.woodLo + '"/>' +
      '<circle cx="50" cy="50" r="1.4" fill="' + P.woodMd + '"/>' +
      '<g stroke="' + P.woodHi + '" stroke-width=".8" opacity=".6">' +
      '<line x1="50" y1="46" x2="50" y2="54"/><line x1="46" y1="50" x2="54" y2="50"/>' +
      '<line x1="47" y1="47" x2="53" y2="53"/><line x1="47" y1="53" x2="53" y2="47"/>' +
      '</g>' +
      /* 车板（两轮间木架） */
      '<rect x="20" y="42" width="24" height="6" rx="1.4" fill="' + P.woodMd + '"/>' +
      '<rect x="20" y="42" width="24" height="2" rx="1" fill="' + P.woodHi + '"/>';
    /* 车轴连轮 */
    s += '<line x1="14" y1="50" x2="20" y2="44" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
      '<line x1="50" y1="50" x2="44" y2="44" stroke="' + P.woodLo + '" stroke-width="1.6"/>';
    if (kind === 'cart') {
      /* 投石车：基座 + 抛杆 + 配重 + 弹丸 */
      s += '<path d="M20 30 L44 30 L46 42 L18 42 Z" fill="' + C2 + '"/>' +
        '<path d="M20 30 L32 30 L32 42 L18 42 Z" fill="' + C1 + '" opacity=".4"/>' +
        /* 抛杆（斜向上） */
        '<line x1="32" y1="30" x2="14" y2="8" stroke="' + P.woodLo + '" stroke-width="2.4"/>' +
        /* 配重（吊在抛杆尾端大箱） */
        '<rect x="36" y="28" width="12" height="10" rx="1.4" fill="' + P.woodLo + '"/>' +
        '<rect x="36" y="28" width="12" height="3" rx="1" fill="' + P.woodHi + '"/>' +
        /* 弹丸（吊在抛杆头） */
        '<circle cx="14" cy="8" r="3" fill="' + P.stLo + '"/>' +
        '<circle cx="13" cy="7" r="1.2" fill="' + P.stHi + '" opacity=".7"/>';
    } else if (kind === 'siege_ram') {
      /* 冲车：上覆皮盾的攻城槌 */
      s += '<path d="M20 18 L44 18 L46 30 L18 30 Z" fill="' + C2 + '"/>' +
        '<path d="M20 18 L32 18 L32 30 L18 30 Z" fill="' + C1 + '" opacity=".4"/>' +
        /* 屋顶皮盖 */
        '<path d="M18 18 Q32 10 46 18 Z" fill="' + P.rMd + '"/>' +
        '<path d="M18 18 Q32 10 46 18" stroke="' + P.rHi + '" stroke-width="1" fill="none" opacity=".7"/>' +
        /* 皮盖铆钉 */
        '<circle cx="24" cy="14" r="1" fill="' + P.goldMd + '"/>' +
        '<circle cx="32" cy="11" r="1" fill="' + P.goldMd + '"/>' +
        '<circle cx="40" cy="14" r="1" fill="' + P.goldMd + '"/>' +
        /* 攻城槌（前方） */
        '<line x1="14" y1="36" x2="18" y2="36" stroke="' + P.woodLo + '" stroke-width="2"/>' +
        '<rect x="6" y="34" width="12" height="4" rx="1.4" fill="' + P.woodMd + '"/>' +
        /* 槌头铁箍 */
        '<rect x="4" y="34" width="3" height="4" fill="' + P.irMd + '"/>' +
        '<rect x="15" y="34" width="3" height="4" fill="' + P.irMd + '"/>' +
        /* 铜钉 */
        '<circle cx="12" cy="36" r=".8" fill="' + P.goldMd + '"/>';
    } else if (kind === 'ballista') {
      /* 床弩：巨型弓 + 弩臂 + 弩机 */
      s += '<rect x="18" y="36" width="28" height="6" rx="1" fill="' + C2 + '"/>' +
        '<path d="M18 36 L32 36 L32 42 L18 42 Z" fill="' + C1 + '" opacity=".4"/>' +
        /* 弩臂 */
        '<path d="M18 36 Q12 18 18 12" stroke="' + P.woodLo + '" stroke-width="3" fill="none"/>' +
        '<path d="M46 36 Q52 18 46 12" stroke="' + P.woodLo + '" stroke-width="3" fill="none"/>' +
        '<path d="M18 36 Q12 18 18 12" stroke="' + P.woodHi + '" stroke-width="1" fill="none" opacity=".5"/>' +
        '<path d="M46 36 Q52 18 46 12" stroke="' + P.woodHi + '" stroke-width="1" fill="none" opacity=".5"/>' +
        /* 弩机（中间扳机盒） */
        '<rect x="29" y="22" width="6" height="14" rx="1" fill="' + P.woodMd + '"/>' +
        '<rect x="30" y="24" width="4" height="3" rx=".6" fill="' + P.goldMd + '"/>' +
        /* 长箭 */
        '<line x1="14" y1="12" x2="50" y2="12" stroke="' + P.woodMd + '" stroke-width="1.6"/>' +
        '<path d="M50 12 L54 10 L54 14 Z" fill="' + P.irHi + '"/>' +
        /* 箭羽 */
        '<path d="M48 11 L50 9 L50 11 Z M48 13 L50 15 L50 13 Z" fill="' + P.clHi + '"/>';
    } else if (kind === 'catapult') {
      /* 投石机：高架投臂 + 弹筐 */
      s += '<path d="M22 32 L42 32 L42 42 L22 42 Z" fill="' + C2 + '"/>' +
        '<path d="M22 32 L32 32 L32 42 L22 42 Z" fill="' + C1 + '" opacity=".4"/>' +
        /* 投臂（斜向下，弹筐端朝下） */
        '<line x1="32" y1="32" x2="14" y2="42" stroke="' + P.woodLo + '" stroke-width="2.4"/>' +
        '<line x1="32" y1="32" x2="48" y2="14" stroke="' + P.woodLo + '" stroke-width="2.4"/>' +
        /* 弹筐（投臂左下端） */
        '<path d="M10 40 L18 40 L20 46 L8 46 Z" fill="' + P.woodMd + '"/>' +
        '<ellipse cx="14" cy="40" rx="5" ry="2" fill="' + P.woodHi + '"/>' +
        '<ellipse cx="14" cy="40" rx="3.6" ry="1.2" fill="' + P.woodMd + '"/>' +
        /* 配重（右上端大石） */
        '<rect x="44" y="10" width="10" height="6" rx="1" fill="' + P.stMd + '"/>' +
        '<rect x="44" y="10" width="10" height="2" fill="' + P.stHi + '"/>' +
        /* 弹丸（地上一颗） */
        '<circle cx="14" cy="50" r="2.4" fill="' + P.stLo + '"/>';
    }
    /* 器械操作员（右侧小剪影） */
    s += '<rect x="46" y="34" width="6" height="10" rx="1" fill="' + C3 + '" opacity=".7"/>' +
      '<circle cx="49" cy="32" r="1.8" fill="' + P.woodMd + '"/>';
    return s;
  }
  function weapon(k, kind) {
    /* v31 简化：本函数保留兼容入口，实际绘制由 soldier* 系列完成。
       仅当 troop_*.w 未指定时 fallback 到老绘制。 */
    if (kind === 'spear') return '<line x1="44" y1="14" x2="40" y2="52" stroke="' + P.woodMd + '" stroke-width="2"/>' +
      '<path d="M44 14 L46.6 6 L49 14 L46.6 17 Z" fill="' + P.irHi + '"/>';
    if (kind === 'sword') return '<path d="M41 20 L47 14 L50 17 L44 23 Z" fill="' + P.irHi + '"/>' +
      '<rect x="37" y="21" width="8" height="2.4" rx="1" transform="rotate(-45 41 22)" fill="' + P.goldMd + '"/>';
    if (kind === 'bow') return '<path d="M44 18 Q54 30 44 42" fill="none" stroke="' + P.woodMd + '" stroke-width="2.4"/>' +
      '<line x1="44" y1="18" x2="44" y2="42" stroke="' + P.clHi + '" stroke-width=".9"/>' +
      '<line x1="40" y1="30" x2="50" y2="30" stroke="' + P.woodLo + '" stroke-width="1.2"/>';
    if (kind === 'shield') return '<path d="M24 30 L38 30 L38 42 Q31 50 24 42 Z" fill="' + P.irMd + '"/>' +
      '<path d="M26 32 L36 32 L36 41 Q31 47 26 41 Z" fill="' + P.goldMd + '" opacity=".6"/>';
    if (kind === 'axe') return '<rect x="40" y="18" width="2.2" height="20" rx="1" transform="rotate(12 41 28)" fill="' + P.woodMd + '"/>' +
      '<path d="M38 20 Q46 12 54 18 Q48 20 45 26 Q41 24 38 20 Z" fill="' + P.irHi + '"/>';
    if (kind === 'cart') return '<rect x="30" y="34" width="24" height="14" rx="2" fill="' + P.woodMd + '"/>' +
      '<rect x="30" y="34" width="24" height="4" fill="' + P.woodHi + '"/>' +
      '<circle cx="36" cy="50" r="4.4" fill="' + P.woodLo + '"/><circle cx="48" cy="50" r="4.4" fill="' + P.woodLo + '"/>' +
      '<circle cx="36" cy="50" r="1.6" fill="' + P.woodHi + '"/><circle cx="48" cy="50" r="1.6" fill="' + P.woodHi + '"/>';
    return '';
  }
  var TR = {
    minfu: { tone: ['#a89070', '#c4a985', '#8a7154'], cls: 'foot', w: 'axe' },
    yibing: { tone: ['#9a7c58', '#b89a72', '#7c6244'], cls: 'foot', w: 'sword' },
    chihou: { tone: ['#7f9a86', '#9fb8a4', '#5f7a68'], cls: 'bow', w: 'bow', light: true },
    changqiang: { tone: ['#8f7a5e', '#ac9673', '#6d5c48'], cls: 'foot', w: 'spear' },
    daodun: { tone: ['#8a7f6a', '#a89c84', '#6a6050'], cls: 'foot', w: 'shield' },
    gongjian: { tone: ['#8e9463', '#a8ae7c', '#6c714c'], cls: 'bow', w: 'bow' },
    qingji: { tone: ['#8a7358', '#a88e6c', '#665340'], w: 'sword', cls: 'mount', mount: true },
    tieji: { tone: ['#6f7784', '#8d95a2', '#525a66'], w: 'spear', cls: 'mount', mount: true },
    zhouche: { tone: ['#96876c', '#b2a184', '#70624c'], cls: 'cart', w: 'cart' },
    chuangnu: { tone: ['#7d7154', '#9a8d6c', '#5c5240'], cls: 'bow', w: 'bow' },
    chongche: { tone: ['#7a6b4e', '#95835f', '#584c38'], cls: 'cart', w: 'cart' },
    toudan: { tone: ['#75664b', '#8f7d5c', '#544a36'], cls: 'cart', w: 'cart' },
    qingzhoubing: { tone: ['#5f7f9a', '#7e9db8', '#456078'], cls: 'foot', w: 'spear' },
    tengjiabing: { tone: ['#6e8f5c', '#8cab77', '#4f6a41'], cls: 'foot', w: 'shield' },
    tuqibing: { tone: ['#7a8a6a', '#98a886', '#586648'], w: 'bow', cls: 'mount', mount: true },
    hubaoqi: { tone: ['#8f6a3c', '#ab864f', '#6a4c29'], w: 'spear', cls: 'mount', mount: true },
    xiliangtieqi: { tone: ['#8a5f45', '#a87c5e', '#654232'], w: 'sword', cls: 'mount', mount: true },
    nanjiangxiangbing: { tone: ['#6f7a8a', '#8d98a8', '#525b68'], w: 'axe', beast: true },
  };
  Object.keys(TR).forEach(function (id) {
    ICON['troop_' + id] = function (k) {
      var c = TR[id];
      var s = '';
      if (c.beast) {
        /* 战象 */
        s += '<path d="M8 52 L12 38 Q16 32 26 32 L44 32 Q50 33 50 38 L48 40 L49 47 Q49 50 46 50 L42 50 L42 53 L39 53 L39 50 L20 50 L20 53 L17 53 L17 50 Z" fill="' + P.stLo + '"/>' +
          '<path d="M14 36 Q16 30 22 30 L26 32 L22 38 Z" fill="' + P.stMd + '"/>' +
          '<path d="M14 40 Q8 44 8 50 Q12 50 13 44 Z" fill="' + P.stMd + '"/>' +
          '<path d="M46 30 Q50 26 54 30 Q50 32 46 34 Z" fill="' + P.stMd + '"/>' +
          '<rect x="20" y="20" width="24" height="12" rx="1.6" fill="' + P.woodMd + '"/>' +
          flag(30, 22, 14, P.rMd, P.rHi);
      } else if (c.cls === 'bow') {
        /* v31：弓兵独立剪影 */
        s += soldierBow(c.tone);
      } else if (c.cls === 'mount') {
        /* v31：骑兵（马+骑手）独立剪影 */
        s += soldierMount(c.tone, c.w);
      } else if (c.cls === 'cart') {
        /* v31：器械 4 类（按 c.w 区分投石/冲车/床弩/投石车） */
        s += soldierCart(c.tone, c.w === 'cart' ? 'cart' : (c.w === 'siege_ram' ? 'siege_ram' : (c.w === 'ballista' ? 'ballista' : 'catapult')));
      } else {
        /* v31：步兵 4 种兵器（默认 foot 类） */
        s += soldierFoot(c.tone, c.w);
      }
      return s;
    };
  });

  /* ============================================================
   * 打造材料（6 系列 × 4 品阶 = 24）
   * 造型随系列变化：铁=锭 / 木=原木 / 革=兽皮 / 筋=筋束 / 玉=玉璧 / 丝=布卷
   * 品阶体现为：配色贵重度 + 光泽 + 右下角品阶珠（1~4 颗）
   * ============================================================ */
  var MAT_PAL = {
    iron: [
      ['#9098a2', '#6a727c', '#494f58'], ['#ccd5df', '#98a2ae', '#69727e'],
      ['#e2eaf4', '#a9b7c8', '#78869a'], ['#9c8fc4', '#645a8e', '#3b3560'],
    ],
    wood: [
      ['#c9a068', '#9e7845', '#755630'], ['#bb9160', '#8e6a40', '#684a2a'],
      ['#8e5c3e', '#673f28', '#462818'], ['#8fc06c', '#5f9440', '#3c6626'],
    ],
    leather: [
      ['#c2a27a', '#9a7a52', '#735a38'], ['#b98a5c', '#8e6238', '#68462a'],
      ['#90806e', '#6b5748', '#4a3c30'], ['#6f92a0', '#4a6a7c', '#32505e'],
    ],
    sinew: [
      ['#e2d2aa', '#b8a478', '#8e7c54'], ['#ecdcb4', '#c2aa7e', '#96805a'],
      ['#dbe4bc', '#a8b484', '#7a8a60'], ['#f4e4bc', '#ccb474', '#9a8048'],
    ],
    jade: [
      ['#bab5a6', '#8e8a7c', '#68645a'], ['#8fc2b2', '#5f9484', '#3e6a5c'],
      ['#f2eee2', '#d0c9ba', '#a89f90'], ['#e4cc90', '#b89c54', '#8a7030'],
    ],
    silk: [
      ['#d8cbaa', '#b0a080', '#877a5c'], ['#f2ead8', '#ccc0a8', '#9e9480'],
      ['#d06c5a', '#a4452f', '#782f20'], ['#8fd2e2', '#5aa0c0', '#3a7490'],
    ],
  };

  function matShape(series, c, tier) {
    var A = c[0], B2 = c[1], C = c[2];
    var k = 'mt' + series;
    var g = G(k + 'a', A, C) + G(k + 'b', A, B2, 'h');
    /* 品阶越高，金属环/光晕越多：tier=1 无；tier=2 一道；tier=3 两道；tier=4 三道 + 宝顶 */
    var rings = '', crown = '';
    for (var i = 0; i < tier - 1; i++) {
      var ro = 16 + i * 2.4;
      rings += '<circle cx="32" cy="22" r="' + ro + '" fill="none" stroke="' + P.goldHi + '" stroke-width=".7" opacity="' + (0.18 + i * 0.06) + '"/>';
    }
    if (tier >= 4) {
      crown = '<circle cx="32" cy="9" r="2.2" fill="' + P.goldMd + '"/>' +
              '<circle cx="32" cy="9" r="1" fill="' + P.goldHi + '"/>' +
              '<path d="M28 13 L32 6 L36 13 Z" fill="' + P.goldMd + '" opacity=".7"/>';
    }

    if (series === 'iron') {
      /* 铁系：叠层方锭 + 角棱反光 + 钢质花纹
         v31 重做：3 块递增尺寸叠起，每块左亮右暗，顶面有高光带 */
      return g + rings + crown +
        /* 底层大锭（暗） */
        '<path d="M10 50 L14 38 L50 38 L54 50 Z" fill="' + C + '"/>' +
        '<path d="M14 38 L18 32 L50 32 L50 38 Z" fill="' + B2 + '"/>' +
        '<path d="M14 38 L50 38" stroke="' + A + '" stroke-width=".8" opacity=".5"/>' +
        /* 中锭 */
        '<path d="M14 38 L18 32 L46 32 L50 38 L50 22 L46 16 L18 16 L14 22 Z" fill="' + B2 + '"/>' +
        '<path d="M18 16 L46 16 L50 22 L14 22 Z" fill="' + A + '"/>' +
        '<path d="M18 16 L46 16 L50 22" stroke="#ffffff" stroke-width="1" opacity=".4"/>' +
        /* 顶锭（亮，最小） */
        '<path d="M18 22 L22 16 L42 16 L46 22 L46 12 L42 6 L22 6 L18 12 Z" fill="' + A + '"/>' +
        '<path d="M22 6 L42 6 L46 12 L18 12 Z" fill="#ffffff" opacity=".35"/>' +
        '<path d="M22 6 L42 6 L46 12" stroke="#ffffff" stroke-width="1.2" opacity=".7"/>' +
        /* 钢质花纹：十字錾刻 */
        '<path d="M28 14 L36 14 M32 10 L32 18" stroke="' + C + '" stroke-width=".8" opacity=".6"/>' +
        /* 左侧高光 */
        '<path d="M18 22 L18 12 L22 6 L22 16 Z" fill="#ffffff" opacity=".25"/>';
    }
    if (series === 'wood') {
      /* 木系：圆木堆叠 + 树皮纹理 + 年轮断面
         v31 重做：3 段原木堆叠，每段端面有同心圆年轮 + 树皮竖纹 */
      return g + rings + crown +
        /* 底段 */
        '<rect x="8" y="42" width="48" height="10" rx="2" fill="url(#' + k + 'a)"/>' +
        /* 中段 */
        '<rect x="12" y="28" width="40" height="11" rx="2" fill="url(#' + k + 'b)"/>' +
        /* 顶段 */
        '<rect x="14" y="16" width="36" height="10" rx="2" fill="' + A + '"/>' +
        /* 顶段高光 */
        '<rect x="14" y="16" width="36" height="3" rx="1.6" fill="#ffffff" opacity=".3"/>' +
        /* 树皮竖纹（多道） */
        '<g stroke="' + C + '" stroke-width=".6" opacity=".5">' +
        '<line x1="20" y1="18" x2="20" y2="24"/><line x1="26" y1="18" x2="26" y2="24"/>' +
        '<line x1="34" y1="18" x2="34" y2="24"/><line x1="40" y1="18" x2="40" y2="24"/>' +
        '<line x1="46" y1="18" x2="46" y2="24"/>' +
        '<line x1="16" y1="30" x2="16" y2="38"/><line x1="22" y1="30" x2="22" y2="38"/>' +
        '<line x1="30" y1="30" x2="30" y2="38"/><line x1="38" y1="30" x2="38" y2="38"/>' +
        '<line x1="44" y1="30" x2="44" y2="38"/><line x1="50" y1="30" x2="50" y2="38"/>' +
        '<line x1="12" y1="44" x2="12" y2="52"/><line x1="18" y1="44" x2="18" y2="52"/>' +
        '<line x1="26" y1="44" x2="26" y2="52"/><line x1="34" y1="44" x2="34" y2="52"/>' +
        '<line x1="42" y1="44" x2="42" y2="52"/><line x1="50" y1="44" x2="50" y2="52"/>' +
        '</g>' +
        /* 右端断面（年轮同心圆） */
        '<ellipse cx="54" cy="21" rx="3" ry="4" fill="' + B2 + '"/>' +
        '<ellipse cx="54" cy="21" rx="2" ry="2.6" fill="none" stroke="' + C + '" stroke-width=".6"/>' +
        '<ellipse cx="54" cy="21" rx="1" ry="1.2" fill="' + C + '" opacity=".7"/>' +
        '<ellipse cx="50" cy="33" rx="2.6" ry="4.4" fill="' + B2 + '"/>' +
        '<ellipse cx="50" cy="33" rx="1.6" ry="2.8" fill="none" stroke="' + C + '" stroke-width=".6"/>' +
        '<ellipse cx="54" cy="47" rx="2.6" ry="4" fill="' + B2 + '"/>' +
        '<ellipse cx="54" cy="47" rx="1.6" ry="2.4" fill="none" stroke="' + C + '" stroke-width=".6"/>';
    }
    if (series === 'leather') {
      /* 革系：卷起的皮料 + 缝针线 + 铜扣
         v31 重做：上端折叠皮卷 + 缝针虚线 + 铜质圆扣 */
      return g + rings + crown +
        /* 卷起的上端（圆角矩形） */
        '<path d="M16 16 Q32 10 48 16 L48 26 Q32 22 16 26 Z" fill="url(#' + k + 'a)"/>' +
        '<path d="M16 16 Q32 10 48 16" stroke="#ffffff" stroke-width="1" opacity=".4" fill="none"/>' +
        /* 主皮面（矩形，有圆角） */
        '<path d="M14 26 Q12 28 14 30 L14 48 Q12 50 14 52 L50 52 Q52 50 50 48 L50 30 Q52 28 50 26 Z" fill="url(#' + k + 'a)"/>' +
        /* 右暗面 */
        '<path d="M32 26 L50 26 L50 52 L32 52 Z" fill="' + C + '" opacity=".25"/>' +
        /* 缝针虚线（横线多道） */
        '<g stroke="' + C + '" stroke-width=".8" stroke-dasharray="1.4 1.4" opacity=".55" fill="none">' +
        '<path d="M18 30 L46 30"/><path d="M18 36 L46 36"/><path d="M18 42 L46 42"/><path d="M18 48 L46 48"/>' +
        '</g>' +
        /* 中央铜扣（金色圆） */
        '<circle cx="32" cy="40" r="5.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="32" cy="40" r="3.6" fill="' + P.goldHi + '"/>' +
        '<circle cx="32" cy="40" r="1.6" fill="' + P.goldLo + '"/>' +
        '<circle cx="29.6" cy="37.6" r="1.6" fill="#ffffff" opacity=".5"/>' +
        /* 边角铜钉 */
        '<circle cx="18" cy="32" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="46" cy="32" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="18" cy="48" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="46" cy="48" r="1.4" fill="' + P.goldMd + '"/>' +
        /* 卷边褶皱 */
        '<path d="M16 26 Q14 28 14 30 Q12 30 12 32" stroke="' + C + '" stroke-width=".8" fill="none" opacity=".5"/>' +
        '<path d="M48 26 Q50 28 50 30 Q52 30 52 32" stroke="' + C + '" stroke-width=".8" fill="none" opacity=".5"/>';
    }
    if (series === 'sinew') {
      /* 筋系：盘绕绳束 + 金线缠绕 + 铜扣
         v31 重做：3 股绞绳 + 螺旋金线 + 顶端流苏 */
      return g + rings + crown +
        /* 底端流苏（散开的丝线） */
        '<g stroke="' + B2 + '" stroke-width=".8" stroke-linecap="round">' +
        '<line x1="22" y1="50" x2="20" y2="56"/><line x1="26" y1="50" x2="25" y2="57"/>' +
        '<line x1="30" y1="50" x2="30" y2="58"/><line x1="34" y1="50" x2="35" y2="57"/>' +
        '<line x1="38" y1="50" x2="40" y2="56"/><line x1="42" y1="50" x2="44" y2="55"/>' +
        '</g>' +
        /* 主体：3 股绞绳（v31 重新分布，让"绳"感更强） */
        '<path d="M10 14 Q22 22 10 30 Q-2 38 10 46" stroke="' + C + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M32 12 Q44 22 32 32 Q20 42 32 50" stroke="' + A + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M54 14 Q66 22 54 30 Q42 38 54 46" stroke="' + B2 + '" stroke-width="5" fill="none" stroke-linecap="round" transform="translate(-22 0)"/>' +
        /* 绞绳横纹（多道短横线模拟绳股交叠） */
        '<g stroke="' + C + '" stroke-width=".7" opacity=".55">' +
        '<line x1="16" y1="20" x2="20" y2="18"/><line x1="14" y1="26" x2="18" y2="24"/>' +
        '<line x1="14" y1="32" x2="18" y2="30"/><line x1="16" y1="38" x2="20" y2="36"/>' +
        '<line x1="20" y1="44" x2="24" y2="42"/>' +
        '</g>' +
        '<g stroke="' + C + '" stroke-width=".7" opacity=".55">' +
        '<line x1="38" y1="20" x2="42" y2="18"/><line x1="40" y1="26" x2="44" y2="24"/>' +
        '<line x1="40" y1="32" x2="44" y2="30"/><line x1="38" y1="38" x2="42" y2="36"/>' +
        '<line x1="34" y1="44" x2="38" y2="42"/>' +
        '</g>' +
        /* 顶端铜扣 */
        '<rect x="22" y="8" width="20" height="6" rx="2" fill="' + P.goldMd + '"/>' +
        '<rect x="22" y="8" width="20" height="2" rx="1" fill="' + P.goldHi + '"/>' +
        '<rect x="29" y="6" width="6" height="3" rx="1" fill="' + P.goldLo + '"/>' +
        /* 中段金线缠绕 */
        '<g stroke="' + P.goldHi + '" stroke-width=".7" fill="none" opacity=".75">' +
        '<path d="M14 26 Q22 30 30 26"/><path d="M18 30 Q26 34 34 30"/>' +
        '<path d="M30 36 Q38 40 46 36"/><path d="M28 40 Q36 44 44 40"/>' +
        '</g>';
    }
    if (series === 'jade') {
      /* 玉系：雕花玉璧 + 镂空 + 玲珑透雕
         v31 重做：双层环 + 4 兽首（夔龙纹）+ 内圈花纹 */
      return g + rings + crown +
        /* 阴影环 */
        '<circle cx="33" cy="34" r="22" fill="#000" opacity=".18"/>' +
        /* 外环（厚） */
        '<circle cx="32" cy="34" r="22" fill="url(#' + k + 'a)"/>' +
        '<circle cx="32" cy="34" r="22" fill="none" stroke="' + C + '" stroke-width="1.4"/>' +
        /* 右暗面 */
        '<path d="M32 12 A22 22 0 0 1 32 56 Z" fill="' + C + '" opacity=".22"/>' +
        /* 内圈花纹（齿轮状装饰） */
        '<g fill="' + C + '" opacity=".4">' +
        /* 8 个小齿 */
        (function () {
          var out = '';
          for (var i = 0; i < 8; i++) {
            var ang = i * Math.PI / 4;
            var x = 32 + Math.cos(ang) * 18;
            var y = 34 + Math.sin(ang) * 18;
            out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="1.6"/>';
          }
          return out;
        })() +
        '</g>' +
        /* 中孔 */
        '<circle cx="32" cy="34" r="8" fill="#1b1712"/>' +
        '<circle cx="32" cy="34" r="8" fill="none" stroke="' + C + '" stroke-width="1"/>' +
        /* 内孔边高光（让玉看起来晶莹） */
        '<circle cx="32" cy="34" r="7" fill="none" stroke="#ffffff" stroke-width=".5" opacity=".5"/>' +
        /* 左上大弧高光（v31 新增：单弧光 → 多弧光，更亮） */
        '<path d="M18 22 Q22 14 30 12" stroke="#ffffff" stroke-width="2.4" fill="none" opacity=".65" stroke-linecap="round"/>' +
        '<path d="M14 30 Q14 22 18 18" stroke="#ffffff" stroke-width="1.4" fill="none" opacity=".45" stroke-linecap="round"/>' +
        /* 右下暗纹 */
        '<path d="M40 46 Q48 42 50 36" stroke="' + C + '" stroke-width=".9" fill="none" opacity=".55"/>';
    }
    /* silk 布卷：v31 重做——折叠布匹堆 + 织纹 + 流苏穗 */
    return g + rings + crown +
      /* 底层布（折角更明显） */
      '<path d="M10 50 L10 38 L18 30 L46 30 L54 38 L54 50 Z" fill="url(#' + k + 'a)"/>' +
      /* 折角 */
      '<path d="M18 30 L22 34 L14 38 Z" fill="' + A + '" opacity=".5"/>' +
      /* 暗面 */
      '<path d="M32 30 L54 38 L54 50 L32 50 Z" fill="' + C + '" opacity=".22"/>' +
      /* 织纹横线 */
      '<g stroke="' + C + '" stroke-width=".6" opacity=".45">' +
      '<path d="M14 36 L50 36"/><path d="M12 40 L52 40"/><path d="M10 44 L54 44"/><path d="M10 48 L54 48"/>' +
      '</g>' +
      /* 上层布（折叠） */
      '<path d="M16 30 L32 18 L48 30 Z" fill="' + A + '"/>' +
      '<path d="M32 18 L48 30 L40 30 Z" fill="' + C + '" opacity=".35"/>' +
      '<path d="M16 30 L32 18" stroke="#ffffff" stroke-width="1" opacity=".5" fill="none"/>' +
      /* 上层布纹 */
      '<g stroke="' + C + '" stroke-width=".5" opacity=".5">' +
      '<path d="M20 28 L34 22"/><path d="M24 29 L36 22"/>' +
      '</g>' +
      /* 顶端绳结 */
      '<rect x="29" y="14" width="6" height="3" rx="1.2" fill="' + P.goldMd + '"/>' +
      '<rect x="29" y="14" width="6" height="1.2" rx=".6" fill="' + P.goldHi + '"/>' +
      /* 底端流苏穗 */
      '<g stroke="' + C + '" stroke-width=".7" stroke-linecap="round" opacity=".8">' +
      '<line x1="16" y1="50" x2="14" y2="56"/><line x1="22" y1="50" x2="20" y2="57"/>' +
      '<line x1="28" y1="50" x2="27" y2="58"/><line x1="34" y1="50" x2="33" y2="58"/>' +
      '<line x1="40" y1="50" x2="41" y2="57"/><line x1="46" y1="50" x2="48" y2="56"/>' +
      '</g>' +
      /* 卷边侧高光 */
      '<path d="M14 38 L18 34 L46 34 L50 38" stroke="#ffffff" stroke-width=".7" fill="none" opacity=".4"/>';
  }

  /* 品阶珠：右下角 1~4 颗，数量即品阶 */
  function tierPips(tier) {
    var s = '';
    for (var i = 0; i < tier; i++) {
      s += '<circle cx="' + (48 - i * 6) + '" cy="56" r="2.6" fill="' + P.goldMd + '" stroke="' + P.goldLo + '" stroke-width=".7"/>';
    }
    return s;
  }

  var MAT_CELLS = [
    ['fatie', 'iron', 1], ['jingtie', 'iron', 2], ['bintie', 'iron', 3], ['yuntie', 'iron', 4],
    ['songmu', 'wood', 1], ['nanmu', 'wood', 2], ['tanmu', 'wood', 3], ['jianmu', 'wood', 4],
    ['cuge', 'leather', 1], ['xiaoge', 'leather', 2], ['xige', 'leather', 3], ['jiaoge', 'leather', 4],
    ['shoujin', 'sinew', 1], ['niujin', 'sinew', 2], ['jiaojin', 'sinew', 3], ['longjin', 'sinew', 4],
    ['heshi', 'jade', 1], ['qingyu', 'jade', 2], ['yangzhi', 'jade', 3], ['kunshan', 'jade', 4],
    ['mabu', 'silk', 1], ['xijuan', 'silk', 2], ['shujin', 'silk', 3], ['yunjin', 'silk', 4],
  ];
  MAT_CELLS.forEach(function (m) {
    var id = m[0], series = m[1], tier = m[2];
    ICON['mat_' + id] = function (k) {
      var c = MAT_PAL[series][tier - 1];
      return matShape(series, c, tier) + tierPips(tier);
    };
  });

  /* ============================================================
   * 装备部位（12）— 背包格子用
   * ============================================================ */
  var SLOT_ART = {
    weapon:   '<path d="M18 48 L38 14 L43 17 L23 51 Z" fill="' + P.irHi + '"/>' +
              '<path d="M20 46 L38 16 L41 18 L23 48 Z" fill="' + P.irMd + '" opacity=".6"/>' +
              '<rect x="12" y="44" width="14" height="4.4" rx="2.2" transform="rotate(-58 19 46)" fill="' + P.goldMd + '"/>' +
              '<rect x="9" y="49" width="7" height="7" rx="2" fill="' + P.woodMd + '"/>',
    head:     '<path d="M16 40 Q16 20 32 20 Q48 20 48 40 Z" fill="' + P.irMd + '"/>' +
              '<path d="M32 20 Q48 20 48 40 L40 40 Q40 27 32 25 Z" fill="' + P.irLo + '" opacity=".55"/>' +
              '<rect x="14" y="39" width="36" height="6" rx="3" fill="' + P.irHi + '"/>' +
              '<path d="M32 20 L32 10" stroke="' + P.goldMd + '" stroke-width="2.4"/>' +
              '<circle cx="32" cy="9" r="3.2" fill="' + P.goldMd + '"/>' +
              '<rect x="26" y="30" width="12" height="9" rx="1.6" fill="' + P.ink + '" opacity=".45"/>',
    chest:    '<path d="M18 20 L26 17 L32 22 L38 17 L46 20 L46 44 Q32 50 18 44 Z" fill="' + P.irMd + '"/>' +
              '<path d="M32 22 L38 17 L46 20 L46 44 Q40 47 32 47 Z" fill="' + P.irLo + '" opacity=".5"/>' +
              '<path d="M32 22 L32 47" stroke="' + P.irHi + '" stroke-width="1.4" opacity=".7"/>' +
              '<circle cx="32" cy="30" r="3" fill="' + P.goldMd + '"/>' +
              '<circle cx="32" cy="38" r="3" fill="' + P.goldMd + '"/>',
    shoulder: '<path d="M14 42 Q14 22 34 20 L42 24 L42 34 L52 34 L52 44 L30 46 Z" fill="' + P.irMd + '"/>' +
              '<path d="M22 41 Q22 27 34 25 L38 27 Q28 30 28 42 Z" fill="' + P.irHi + '" opacity=".55"/>' +
              '<circle cx="34" cy="30" r="2.6" fill="' + P.goldMd + '"/>',
    arm:      '<path d="M24 16 L40 16 L44 30 L38 50 L26 50 L20 30 Z" fill="' + P.irMd + '"/>' +
              '<path d="M24 16 L32 16 L32 50 L26 50 L20 30 Z" fill="' + P.irHi + '" opacity=".4"/>' +
              '<path d="M22 28 L42 28 M22 38 L42 38" stroke="' + P.irLo + '" stroke-width="1.6"/>',
    waist:    '<rect x="12" y="28" width="40" height="10" rx="3" fill="' + P.leatherMd + '"/>' +
              '<rect x="12" y="28" width="40" height="3.4" rx="1.6" fill="' + P.leatherHi + '" opacity=".7"/>' +
              '<rect x="28" y="24" width="10" height="18" rx="2.6" fill="' + P.goldMd + '"/>' +
              '<rect x="30.6" y="27" width="4.8" height="12" rx="1.6" fill="' + P.goldLo + '"/>',
    feet:     '<path d="M18 16 L30 16 L30 36 L46 36 Q50 36 50 42 L50 48 L18 48 Z" fill="' + P.leatherMd + '"/>' +
              '<path d="M18 16 L24 16 L24 48 L18 48 Z" fill="' + P.leatherLo + '" opacity=".5"/>' +
              '<rect x="17" y="44" width="34" height="5" rx="2.4" fill="' + P.ink + '" opacity=".55"/>',
    back:     '<path d="M22 12 Q34 8 44 14 L50 46 Q36 54 16 46 Z" fill="' + P.rMd + '"/>' +
              '<path d="M22 12 Q34 8 44 14 L45 22 Q34 16 23 20 Z" fill="' + P.rHi + '" opacity=".5"/>' +
              '<path d="M32 10 L32 52" stroke="' + P.goldMd + '" stroke-width="1.4" opacity=".6"/>',
    neck:     '<path d="M20 14 Q20 30 32 34 Q44 30 44 14" fill="none" stroke="' + P.goldMd + '" stroke-width="2.2"/>' +
              '<path d="M32 34 L26 42 L32 52 L38 42 Z" fill="' + P.jadeHi + '"/>' +
              '<path d="M32 34 L38 42 L32 52 Z" fill="' + P.jadeLo + '" opacity=".55"/>',
    ring:     '<circle cx="32" cy="38" r="13" fill="none" stroke="' + P.goldMd + '" stroke-width="4"/>' +
              '<circle cx="32" cy="38" r="13" fill="none" stroke="' + P.goldHi + '" stroke-width="1.4" opacity=".7"/>' +
              '<path d="M32 14 L24 26 L40 26 Z" fill="' + P.jadeHi + '"/>' +
              '<path d="M32 14 L32 26 L40 26 Z" fill="' + P.jadeLo + '" opacity=".5"/>',
    pendant:  '<path d="M32 12 L42 26 L32 50 L22 26 Z" fill="' + P.jadeHi + '"/>' +
              '<path d="M32 12 L32 50 L22 26 Z" fill="' + P.jadeLo + '" opacity=".45"/>' +
              '<path d="M32 12 L32 6" stroke="' + P.goldMd + '" stroke-width="2"/>' +
              '<circle cx="32" cy="5" r="2.6" fill="' + P.goldMd + '"/>',
    mount:    '<path d="M10 50 L14 38 Q18 30 28 30 L44 30 Q50 32 50 38 L48 40 L49 47 Q49 50 46 50 L42 50 L42 53 L39 53 L39 50 L20 50 L20 53 L17 53 L17 50 Z" fill="' + P.woodLo + '"/>' +
              '<path d="M46 30 Q48 24 54 25 L56 27 L52 31 Z" fill="' + P.woodMd + '"/>' +
              '<path d="M18 34 Q26 30 34 32" stroke="' + P.woodHi + '" stroke-width="1.6" fill="none" opacity=".6"/>' +
              '<rect x="24" y="20" width="18" height="9" rx="2" fill="' + P.rMd + '" opacity=".85"/>' +
              '<path d="M26 20 Q32 12 42 15 L42 20 Z" fill="' + P.rHi + '" opacity=".8"/>',
  };
  var SLOT_ICON = {};
  Object.keys(SLOT_ART).forEach(function (id) {
    ICON['slot_' + id] = function () { return SLOT_ART[id]; };
  });

  /* ============================================================
   * 宝物类型（按 type，珠宝按 id 分色）
   * ============================================================ */
  var GEM_PAL = {
    zhenzhu: ['#f2ece0', '#c8c0b0'], shanhu: ['#f08a6a', '#b8452f'],
    liuli: ['#a8d8e8', '#5a90b0'], hupo: ['#f0bc60', '#b8801c'],
    manao: ['#e07060', '#a03030'], shuijing: ['#e8f4fa', '#9fc0d4'],
    feicui: ['#7fd4a0', '#3c8a5c'], yushi: ['#f4f0e4', '#c8bca0'],
    yemingzhu: ['#fff4c0', '#d0a63f'],
  };
  function gemArt(a, b) {
    return '<path d="M32 8 L50 26 L32 56 L14 26 Z" fill="' + a + '"/>' +
      '<path d="M32 8 L50 26 L32 56 Z" fill="' + b + '" opacity=".55"/>' +
      '<path d="M32 8 L14 26 L32 26 Z" fill="#ffffff" opacity=".28"/>' +
      '<path d="M14 26 L50 26" stroke="' + b + '" stroke-width="1" opacity=".6"/>';
  }
  /* v31 物品类型重画：每类有独立造型 + 材质感 */
  var ITEM_ART = {
    jewel: function (id) { var c = GEM_PAL[id] || ['#9fd6e0', '#4a90a8']; return gemArt(c[0], c[1]); },
    blueprint: function () {
      /* v31：卷轴图纸——羊皮卷 + 绑绳 + 蓝图纹 */
      var s = '<ellipse cx="32" cy="56" rx="24" ry="2.4" fill="#000" opacity=".25"/>';
      /* 卷轴底（米黄羊皮） */
      s += '<rect x="10" y="14" width="44" height="36" rx="2" fill="' + P.clMd + '"/>' +
        '<rect x="14" y="14" width="36" height="36" rx="1" fill="' + P.clHi + '"/>' +
        /* 蓝图纹（机械/武器线条图） */
        '<g stroke="' + P.woodLo + '" stroke-width=".7" opacity=".55" fill="none">' +
        '<rect x="18" y="20" width="28" height="20" rx="1"/>' +
        '<circle cx="32" cy="30" r="6"/>' +
        '<line x1="20" y1="36" x2="44" y2="36"/>' +
        '<line x1="22" y1="40" x2="42" y2="40"/>' +
        '</g>' +
        /* 卷轴两端（圆环木轴） */
        '<rect x="6" y="14" width="6" height="36" rx="3" fill="' + P.woodMd + '"/>' +
        '<rect x="6" y="14" width="6" height="36" rx="3" fill="none" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
        '<circle cx="9" cy="22" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="9" cy="42" r="1.4" fill="' + P.goldMd + '"/>' +
        '<rect x="52" y="14" width="6" height="36" rx="3" fill="' + P.woodMd + '"/>' +
        '<rect x="52" y="14" width="6" height="36" rx="3" fill="none" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
        '<circle cx="55" cy="22" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="55" cy="42" r="1.4" fill="' + P.goldMd + '"/>' +
        /* 顶端红丝带 */
        '<path d="M28 8 Q32 14 36 8" stroke="' + P.rMd + '" stroke-width="2" fill="none"/>' +
        '<path d="M28 8 L24 6 M36 8 L40 6" stroke="' + P.rMd + '" stroke-width="1.6" fill="none"/>' +
        '<circle cx="32" cy="10" r="1.4" fill="' + P.goldMd + '"/>';
      return s;
    },
    prod_buff: function (id) {
      /* v31：工具箱造型——按 id 区分（锄/斧/锤/炉/鞭） */
      var s = '<ellipse cx="32" cy="54" rx="22" ry="2.6" fill="#000" opacity=".28"/>';
      var icon = '';
      if (id === 'shennongchu') {
        /* 神农锄：弯柄 + 锄头 */
        icon = '<line x1="44" y1="14" x2="20" y2="48" stroke="' + P.woodMd + '" stroke-width="3"/>' +
          '<path d="M14 46 L26 46 L30 54 L10 54 Z" fill="' + P.irMd + '"/>' +
          '<path d="M14 46 L20 46 L24 50 L18 50 Z" fill="' + P.irHi + '"/>';
      } else if (id === 'lubanfu') {
        /* 鲁班斧：长柄 + 斧头 */
        icon = '<line x1="20" y1="48" x2="44" y2="12" stroke="' + P.woodMd + '" stroke-width="2.4"/>' +
          '<path d="M40 8 Q52 4 56 14 Q50 16 46 22 Q42 18 40 8 Z" fill="' + P.irHi + '"/>' +
          '<path d="M40 8 Q52 4 56 14 L48 14 Z" fill="#fff" opacity=".4"/>';
      } else if (id === 'kaishanchui') {
        /* 开山锤：锤头 + 锤柄 */
        icon = '<rect x="18" y="12" width="22" height="14" rx="2" fill="' + P.irMd + '"/>' +
          '<rect x="18" y="12" width="22" height="4" rx="2" fill="' + P.irHi + '"/>' +
          '<line x1="29" y1="26" x2="20" y2="48" stroke="' + P.woodLo + '" stroke-width="3"/>' +
          '<rect x="14" y="46" width="14" height="6" rx="1.4" fill="' + P.woodMd + '"/>';
      } else if (id === 'xuantielu') {
        /* 玄铁炉：方形炉 + 火苗 + 钳 */
        icon = '<rect x="14" y="30" width="36" height="22" rx="2" fill="' + P.stLo + '"/>' +
          '<rect x="14" y="30" width="36" height="6" rx="2" fill="' + P.stMd + '"/>' +
          '<rect x="14" y="30" width="36" height="22" rx="2" fill="none" stroke="' + P.stEdge + '" stroke-width=".8"/>' +
          /* 炉口火 */
          '<path d="M22 30 Q24 22 28 30 Q26 24 30 30 Q28 22 32 30 Q30 24 34 30 Q32 22 36 30 Q34 24 38 30 Q36 22 42 30" stroke="' + P.fiHi + '" stroke-width="2" fill="none"/>' +
          '<circle cx="32" cy="38" r="3" fill="' + P.fiMd + '"/>';
      } else if (id === 'shuilibian') {
        /* 税吏鞭：长鞭 + 握柄 */
        icon = '<rect x="42" y="22" width="8" height="14" rx="2" fill="' + P.woodMd + '"/>' +
          '<rect x="42" y="22" width="8" height="3" rx="1" fill="' + P.goldMd + '"/>' +
          '<path d="M38 30 Q34 36 30 32 Q26 28 22 36 Q18 44 14 38 Q12 32 16 30" stroke="' + P.leatherLo + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<path d="M38 30 Q34 36 30 32 Q26 28 22 36" stroke="' + P.leatherMd + '" stroke-width="1" fill="none" stroke-linecap="round"/>';
      } else {
        /* 默认工具 */
        icon = '<line x1="32" y1="14" x2="32" y2="50" stroke="' + P.woodMd + '" stroke-width="3"/>' +
          '<rect x="24" y="8" width="16" height="10" rx="1" fill="' + P.irMd + '"/>';
      }
      s += icon + '<path d="M10 52 L54 52 L52 56 L12 56 Z" fill="' + P.goldLo + '" opacity=".55"/>';
      return s;
    },
    military_buff: function (id) {
      /* v31：军备造型——鼓/阵图/医书/旗 */
      var s = '<ellipse cx="32" cy="56" rx="22" ry="2.4" fill="#000" opacity=".28"/>';
      if (id === 'xianzhenzhangu') {
        /* 陷阵战鼓：立鼓 + 鼓槌 */
        s += '<rect x="20" y="22" width="24" height="28" rx="2" fill="' + P.woodMd + '"/>' +
          '<ellipse cx="32" cy="22" rx="12" ry="3.4" fill="' + P.rMd + '"/>' +
          '<ellipse cx="32" cy="22" rx="10" ry="2.6" fill="' + P.rHi + '"/>' +
          '<ellipse cx="32" cy="22" rx="6" ry="1.6" fill="' + P.fiHi + '" opacity=".55"/>' +
          /* 鼓钉 */
          '<circle cx="22" cy="28" r="1.2" fill="' + P.goldMd + '"/>' +
          '<circle cx="42" cy="28" r="1.2" fill="' + P.goldMd + '"/>' +
          '<circle cx="22" cy="44" r="1.2" fill="' + P.goldMd + '"/>' +
          '<circle cx="42" cy="44" r="1.2" fill="' + P.goldMd + '"/>' +
          /* 鼓槌（斜立） */
          '<line x1="48" y1="14" x2="54" y2="48" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
          '<ellipse cx="49" cy="13" rx="2.4" ry="3" fill="' + P.woodMd + '"/>' +
          '<ellipse cx="49" cy="13" rx="1.4" ry="1.8" fill="' + P.woodHi + '"/>';
      } else if (id === 'baguazhentu') {
        /* 八卦阵图：圆盘 + 八卦纹 */
        s += '<circle cx="32" cy="34" r="22" fill="' + P.woodMd + '"/>' +
          '<circle cx="32" cy="34" r="20" fill="' + P.woodLo + '"/>' +
          '<circle cx="32" cy="34" r="14" fill="' + P.clMd + '"/>' +
          '<circle cx="32" cy="34" r="14" fill="none" stroke="' + P.woodEdge + '" stroke-width=".8"/>' +
          /* 阴阳鱼 */
          '<path d="M32 20 A14 14 0 0 1 32 48 A7 7 0 0 1 32 34 A7 7 0 0 0 32 20 Z" fill="' + P.fiMd + '"/>' +
          '<circle cx="32" cy="27" r="2" fill="' + P.fiHi + '"/>' +
          '<circle cx="32" cy="41" r="2" fill="' + P.ink + '"/>' +
          /* 8 卦短线 */
          '<g stroke="' + P.woodEdge + '" stroke-width="1" fill="none">' +
          (function () {
            var out = '';
            for (var i = 0; i < 8; i++) {
              var ang = i * Math.PI / 4 + Math.PI / 8;
              var x = 32 + Math.cos(ang) * 18;
              var y = 34 + Math.sin(ang) * 18;
              out += '<line x1="' + (x - 3) + '" y1="' + y + '" x2="' + (x + 3) + '" y2="' + y + '"/>';
            }
            return out;
          })() +
          '</g>';
      } else if (id === 'qingnangshu') {
        /* 青囊书：医书 */
        s += '<rect x="12" y="18" width="40" height="32" rx="2" fill="' + P.grLo + '"/>' +
          '<rect x="12" y="18" width="40" height="32" rx="2" fill="url(#ic_qnsh_g)" />';
        s = s.replace('url(#ic_qnsh_g)', 'url(#ic_qnsh)');
        s += '<rect x="12" y="18" width="40" height="32" rx="2" fill="none" stroke="' + P.grLo + '" stroke-width="1"/>' +
          /* 书脊 */
          '<line x1="32" y1="18" x2="32" y2="50" stroke="' + P.grLo + '" stroke-width="1.4"/>' +
          /* 左页药草 */
          '<path d="M16 22 Q22 26 22 30 Q22 26 16 30 Q20 32 22 30" fill="' + P.grMd + '"/>' +
          '<rect x="16" y="34" width="14" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="16" y="38" width="10" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="16" y="42" width="12" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          /* 右页文字行 */
          '<rect x="34" y="22" width="14" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="34" y="26" width="10" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="34" y="34" width="12" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="34" y="38" width="14" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="34" y="42" width="10" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          /* 红丝带书签 */
          '<path d="M44 18 L48 14 L48 22 Z" fill="' + P.rMd + '"/>';
      } else if (id === 'junqi') {
        /* 军旗：旗杆 + 旗帜 + 流苏 */
        s += '<line x1="22" y1="6" x2="22" y2="56" stroke="' + P.woodMd + '" stroke-width="2.2"/>' +
          /* 旗顶铜矛 */
          '<path d="M22 6 L20 2 L24 2 Z" fill="' + P.goldMd + '"/>' +
          '<circle cx="22" cy="2" r="1" fill="' + P.goldHi + '"/>' +
          /* 旗布（带旗角） */
          '<path d="M22 10 L46 14 L42 22 L46 30 L22 26 Z" fill="' + P.rMd + '"/>' +
          '<path d="M22 10 L46 14 L42 22 L46 30 L22 26 Z" fill="none" stroke="' + P.rHi + '" stroke-width=".8"/>' +
          /* 旗上"军"字 */
          '<rect x="28" y="16" width="3" height="6" fill="' + P.goldHi + '"/>' +
          '<rect x="26" y="18" width="8" height="2" fill="' + P.goldHi + '"/>' +
          '<rect x="28" y="22" width="3" height="2" fill="' + P.goldHi + '"/>' +
          /* 流苏 */
          '<g stroke="' + P.rHi + '" stroke-width=".7" stroke-linecap="round">' +
          '<line x1="22" y1="26" x2="22" y2="36"/>' +
          '<line x1="20" y1="26" x2="18" y2="36"/>' +
          '<line x1="24" y1="26" x2="26" y2="36"/>' +
          '</g>';
      } else {
        /* 默认军备（旗） */
        s += '<line x1="22" y1="6" x2="22" y2="56" stroke="' + P.woodMd + '" stroke-width="2"/>' +
          '<path d="M22 10 L46 14 L22 22 Z" fill="' + P.rMd + '"/>';
      }
      return s;
    },
    boost: function () {
      /* v31：加速卷轴——沙漏造型 */
      return '<ellipse cx="32" cy="56" rx="20" ry="2.4" fill="#000" opacity=".25"/>' +
        /* 沙漏外框 */
        '<rect x="14" y="8" width="36" height="6" rx="1" fill="' + P.goldMd + '"/>' +
        '<rect x="14" y="48" width="36" height="6" rx="1" fill="' + P.goldMd + '"/>' +
        '<rect x="14" y="8" width="36" height="2" rx="1" fill="' + P.goldHi + '"/>' +
        '<rect x="14" y="52" width="36" height="2" rx="1" fill="' + P.goldHi + '"/>' +
        /* 沙漏玻璃 */
        '<path d="M16 14 L48 14 L34 32 L48 50 L16 50 L30 32 Z" fill="' + P.waHi + '" opacity=".5"/>' +
        '<path d="M16 14 L48 14 L34 32 L48 50 L16 50 L30 32 Z" fill="none" stroke="' + P.goldMd + '" stroke-width="1.6"/>' +
        /* 沙子（上半） */
        '<path d="M18 16 L46 16 L34 32 L18 16 Z" fill="' + P.goldHi + '" opacity=".75"/>' +
        '<path d="M20 16 L34 16 L30 28 L20 16 Z" fill="' + P.goldLo + '" opacity=".7"/>' +
        /* 沙柱（漏下） */
        '<line x1="32" y1="32" x2="32" y2="44" stroke="' + P.goldMd + '" stroke-width="2"/>' +
        /* 沙子（下半堆） */
        '<path d="M22 50 L42 50 L36 42 L28 42 Z" fill="' + P.goldMd + '"/>' +
        '<path d="M24 50 L40 50 L34 44 L30 44 Z" fill="' + P.goldHi + '"/>' +
        /* 玻璃高光 */
        '<path d="M18 16 L20 16 L34 32 L30 32 Z" fill="#fff" opacity=".5"/>';
    },
    exp: function () {
      /* v31：经验卷轴——卷起的圣旨 + 升字 */
      var s = '<ellipse cx="32" cy="56" rx="24" ry="2.4" fill="#000" opacity=".25"/>';
      s += '<rect x="10" y="22" width="44" height="24" rx="2" fill="' + P.clMd + '"/>' +
        '<rect x="14" y="22" width="36" height="24" rx="1" fill="' + P.clHi + '"/>' +
        '<rect x="14" y="22" width="36" height="6" fill="' + P.clMd + '" opacity=".5"/>' +
        '<rect x="14" y="40" width="36" height="6" fill="' + P.clMd + '" opacity=".5"/>' +
        /* 卷轴两端的卷边 */
        '<ellipse cx="10" cy="34" rx="2.4" ry="12" fill="' + P.clMd + '"/>' +
        '<ellipse cx="54" cy="34" rx="2.4" ry="12" fill="' + P.clMd + '"/>' +
        '<ellipse cx="10" cy="34" rx="1.4" ry="10" fill="' + P.clLo + '"/>' +
        '<ellipse cx="54" cy="34" rx="1.4" ry="10" fill="' + P.clLo + '"/>' +
        /* 中心"经验"二字（金色篆体简化） */
        '<path d="M22 28 L28 28 L28 36 L26 36 L26 32 L24 32 L24 36 L22 36 Z" fill="' + P.goldHi + '"/>' +
        '<path d="M22 38 L28 38 M22 41 L28 41 M22 44 L26 44" stroke="' + P.goldMd + '" stroke-width=".7"/>' +
        '<path d="M36 28 L42 28 L42 30 L40 30 L40 38 L38 38 L38 30 L36 30 Z" fill="' + P.goldHi + '"/>' +
        '<path d="M36 40 L42 40 M36 43 L42 43" stroke="' + P.goldMd + '" stroke-width=".7"/>' +
        /* 顶绳 */
        '<rect x="29" y="10" width="6" height="6" rx="1" fill="' + P.rMd + '"/>' +
        '<rect x="29" y="10" width="6" height="2" rx="1" fill="' + P.rHi + '"/>' +
        '<line x1="32" y1="6" x2="32" y2="10" stroke="' + P.woodMd + '" stroke-width="1.2"/>' +
        /* 金光 */
        '<g stroke="' + P.goldHi + '" stroke-width=".7" stroke-linecap="round" opacity=".7">' +
        '<line x1="14" y1="14" x2="18" y2="18"/><line x1="50" y1="14" x2="46" y2="18"/>' +
        '<line x1="12" y1="22" x2="18" y2="22"/><line x1="52" y1="22" x2="46" y2="22"/>' +
        '</g>';
      return s;
    },
    stamina: function () {
      /* v31：体力药水——药水瓶 + 心形 */
      var s = '<ellipse cx="32" cy="56" rx="20" ry="2.4" fill="#000" opacity=".25"/>';
      /* 瓶盖（金） */
      s += '<rect x="28" y="4" width="8" height="6" rx="1.4" fill="' + P.goldMd + '"/>' +
        '<rect x="28" y="4" width="8" height="2" rx="1" fill="' + P.goldHi + '"/>' +
        '<rect x="26" y="9" width="12" height="3" rx="1" fill="' + P.woodMd + '"/>' +
        /* 瓶颈 */
        '<path d="M26 12 L38 12 L38 18 L42 22 L42 50 Q42 56 32 56 Q22 56 22 50 L22 22 L26 18 Z" fill="' + P.waHi + '" opacity=".6"/>' +
        '<path d="M26 12 L38 12 L38 18 L42 22 L42 50 Q42 56 32 56 Q22 56 22 50 L22 22 L26 18 Z" fill="none" stroke="' + P.waLo + '" stroke-width="1"/>' +
        /* 药水（绿） */
        '<path d="M24 30 L40 30 L40 50 Q40 54 32 54 Q24 54 24 50 Z" fill="' + P.waMd + '" opacity=".85"/>' +
        '<path d="M24 30 L40 30" stroke="' + P.waLo + '" stroke-width="1" opacity=".5"/>' +
        /* 心形 */
        '<path d="M32 38 Q28 34 28 38 Q28 42 32 46 Q36 42 36 38 Q36 34 32 38 Z" fill="' + P.rMd + '"/>' +
        '<path d="M32 38 Q28 34 28 38 Q28 42 32 46" fill="' + P.rHi + '" opacity=".5"/>' +
        /* 玻璃高光 */
        '<path d="M24 22 Q22 32 24 42" stroke="#fff" stroke-width="1.4" fill="none" opacity=".7"/>' +
        '<circle cx="26" cy="26" r="1.4" fill="#fff" opacity=".55"/>';
      return s;
    },
    perm: function () {
      /* v31：永久令牌——铜牌 + 文字 */
      var s = '<ellipse cx="32" cy="56" rx="22" ry="2.4" fill="#000" opacity=".25"/>';
      /* 玉牌（绿色翡翠） */
      s += '<path d="M18 14 L46 14 L52 22 L52 38 L46 46 L18 46 L12 38 L12 22 Z" fill="' + P.jadeHi + '"/>' +
        '<path d="M18 14 L46 14 L52 22 L52 38 L46 46 L18 46 L12 38 L12 22 Z" fill="none" stroke="' + P.jadeLo + '" stroke-width="1.4"/>' +
        /* 右下暗面 */
        '<path d="M32 14 L46 14 L52 22 L52 38 L46 46 L32 46 Z" fill="' + P.jadeLo + '" opacity=".3"/>' +
        /* 高光（左上） */
        '<path d="M14 22 L18 16 L32 16 L28 22 Z" fill="#fff" opacity=".45"/>' +
        '<path d="M12 26 Q12 22 14 22" stroke="#fff" stroke-width="1" fill="none" opacity=".5"/>' +
        /* 中心字（"永"字简化） */
        '<rect x="28" y="22" width="3" height="14" fill="' + P.goldHi + '"/>' +
        '<rect x="34" y="22" width="3" height="14" fill="' + P.goldHi + '"/>' +
        '<rect x="26" y="25" width="14" height="2" fill="' + P.goldHi + '"/>' +
        '<rect x="26" y="31" width="14" height="2" fill="' + P.goldHi + '"/>' +
        /* 顶端挂绳 */
        '<path d="M28 14 Q32 8 36 14" stroke="' + P.goldMd + '" stroke-width="2" fill="none"/>' +
        '<circle cx="32" cy="6" r="1.6" fill="' + P.goldMd + '"/>' +
        '<circle cx="32" cy="6" r=".8" fill="' + P.goldHi + '"/>' +
        /* 边角装饰 */
        '<circle cx="16" cy="22" r="1" fill="' + P.goldMd + '"/>' +
        '<circle cx="48" cy="38" r="1" fill="' + P.goldMd + '"/>';
      return s;
    },
    mount_buff: function () {
      /* v31：马匹强化——马鞍 + 金光 */
      var s = '<ellipse cx="32" cy="56" rx="22" ry="2.6" fill="#000" opacity=".28"/>';
      /* 马身（剪影） */
      s += '<path d="M8 48 L12 36 Q16 30 22 30 L42 30 Q50 32 50 38 L48 40 L49 46 Q49 50 46 50 L42 50 L42 53 L39 53 L39 50 L20 50 L20 53 L17 53 L17 50 Z" fill="' + P.woodLo + '"/>' +
        '<path d="M8 48 L12 36 Q16 30 22 30 L20 36 L17 48 Z" fill="' + P.woodMd + '" opacity=".5"/>' +
        '<path d="M46 30 Q48 24 54 25 L56 27 L52 31 Z" fill="' + P.woodMd + '"/>' +
        '<path d="M14 32 Q20 28 22 30 L24 30 L20 34 Z" fill="' + P.woodHi + '"/>' +
        /* 马鞍（皮制高桥） */
        '<path d="M22 30 L20 36 L42 36 L40 30 Z" fill="' + P.rMd + '"/>' +
        '<path d="M22 30 L20 36 L26 36 L28 30 Z" fill="' + P.rHi + '" opacity=".5"/>' +
        '<path d="M40 30 L42 36 L36 36 L34 30 Z" fill="' + P.rLo + '" opacity=".4"/>' +
        /* 鞍垫 */
        '<ellipse cx="31" cy="34" rx="9" ry="2.4" fill="' + P.leatherMd + '"/>' +
        '<ellipse cx="31" cy="33.4" rx="7" ry="1.4" fill="' + P.leatherHi + '"/>' +
        /* 金色马镫 */
        '<line x1="24" y1="38" x2="24" y2="46" stroke="' + P.goldMd + '" stroke-width="1.4"/>' +
        '<ellipse cx="24" cy="47" rx="3" ry="1.6" fill="' + P.goldMd + '"/>' +
        '<line x1="38" y1="38" x2="38" y2="46" stroke="' + P.goldMd + '" stroke-width="1.4"/>' +
        '<ellipse cx="38" cy="47" rx="3" ry="1.6" fill="' + P.goldMd + '"/>' +
        /* 金光 */
        '<g stroke="' + P.goldHi + '" stroke-width=".8" stroke-linecap="round" opacity=".8">' +
        '<line x1="32" y1="6" x2="32" y2="14"/><line x1="20" y1="10" x2="24" y2="16"/>' +
        '<line x1="44" y1="10" x2="40" y2="16"/><line x1="14" y1="16" x2="20" y2="20"/>' +
        '<line x1="50" y1="16" x2="44" y2="20"/>' +
        '</g>' +
        '<circle cx="32" cy="20" r="1.4" fill="' + P.goldHi + '"/>';
      return s;
    },
    attr_buff: function () {
      /* v31：符咒（v31 重画：符纸 + 朱砂字 + 流苏） */
      var s = '<ellipse cx="32" cy="56" rx="20" ry="2.4" fill="#000" opacity=".28"/>';
      s += '<rect x="18" y="10" width="28" height="40" rx="2" fill="' + P.clHi + '"/>' +
        '<rect x="18" y="10" width="28" height="40" rx="2" fill="none" stroke="' + P.clLo + '" stroke-width="1"/>' +
        /* 边框纹 */
        '<rect x="20" y="12" width="24" height="36" rx="1" fill="none" stroke="' + P.rMd + '" stroke-width=".8"/>' +
        /* 中心朱砂"令"字（楷书简化） */
        '<path d="M32 16 L30 22 L28 24 L32 24 L34 24 L36 24 L34 22 Z" fill="' + P.rMd + '"/>' +
        '<rect x="28" y="26" width="8" height="2" fill="' + P.rMd + '"/>' +
        '<rect x="29" y="30" width="6" height="2" fill="' + P.rMd + '"/>' +
        '<rect x="30" y="34" width="4" height="2" fill="' + P.rMd + '"/>' +
        '<rect x="31" y="38" width="2" height="6" fill="' + P.rMd + '"/>' +
        /* 顶端封条 */
        '<rect x="20" y="8" width="24" height="4" rx=".8" fill="' + P.rMd + '"/>' +
        '<rect x="20" y="8" width="24" height="1.5" rx=".8" fill="' + P.rHi + '"/>' +
        /* 底端流苏（多道红丝） */
        '<g stroke="' + P.rMd + '" stroke-width=".8" stroke-linecap="round">' +
        '<line x1="22" y1="50" x2="20" y2="58"/><line x1="26" y1="50" x2="25" y2="59"/>' +
        '<line x1="30" y1="50" x2="30" y2="60"/><line x1="34" y1="50" x2="35" y2="59"/>' +
        '<line x1="38" y1="50" x2="40" y2="58"/><line x1="42" y1="50" x2="44" y2="57"/>' +
        '</g>' +
        /* 朱砂印（右下角方印） */
        '<rect x="38" y="38" width="6" height="6" rx=".8" fill="' + P.rMd + '"/>' +
        '<rect x="39" y="39" width="4" height="4" rx=".4" fill="' + P.rHi + '"/>';
      return s;
    },
    build_cost: function () {
      /* v31：考工记秘录——古籍书 */
      var s = '<ellipse cx="32" cy="56" rx="24" ry="2.4" fill="#000" opacity=".25"/>';
      /* 书页底 */
      s += '<rect x="10" y="14" width="44" height="36" rx="2" fill="' + P.woodMd + '"/>' +
        '<rect x="12" y="14" width="40" height="36" rx="1.4" fill="' + P.clMd + '"/>' +
        '<rect x="14" y="16" width="36" height="32" rx="1" fill="' + P.clHi + '"/>' +
        /* 书脊（中线） */
        '<line x1="32" y1="14" x2="32" y2="50" stroke="' + P.woodLo + '" stroke-width="1.4"/>' +
        /* 左页：城池图 */
        '<path d="M16 22 L26 22 L26 30 L20 30 L20 36 L26 36 L26 44 L16 44 Z" fill="none" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
        '<path d="M22 22 L22 30 M16 30 L26 30 M20 30 L20 36" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
        /* 右页：木榫卯图 */
        '<path d="M36 24 L48 24 M36 30 L48 30 M36 36 L48 36 M36 42 L48 42" stroke="' + P.woodLo + '" stroke-width=".8" opacity=".7"/>' +
        '<rect x="40" y="26" width="4" height="2" fill="' + P.woodMd + '"/>' +
        '<rect x="40" y="32" width="4" height="2" fill="' + P.woodMd + '"/>' +
        /* 封面边角金饰 */
        '<path d="M10 14 L14 14 L14 18 L10 18 Z" fill="' + P.goldMd + '"/>' +
        '<path d="M50 46 L54 46 L54 50 L50 50 Z" fill="' + P.goldMd + '"/>' +
        '<rect x="11" y="15" width="2" height="2" fill="' + P.goldHi + '"/>' +
        '<rect x="51" y="47" width="2" height="2" fill="' + P.goldHi + '"/>';
      return s;
    },
  };
  var TYPE_KEY = {
    jewel: 'jewel', blueprint: 'blueprint', prod_buff: 'prod_buff', military_buff: 'military_buff',
    boost: 'boost', exp: 'exp', stamina: 'stamina', perm: 'perm', mount_buff: 'mount_buff',
    attr_buff: 'attr_buff', build_cost: 'build_cost',
  };
  Object.keys(TYPE_KEY).forEach(function (t) {
    ICON['item_' + t] = function (k, id) { return ITEM_ART[TYPE_KEY[t]](id); };
  });

  /* ============================================================
   * 对外接口
   * ============================================================ */
  var ALL = {};
  Object.keys(B).forEach(function (id) { ALL['b_' + id] = B[id]; });
  Object.keys(E).forEach(function (id) { ALL['e_' + id] = E[id]; });
  Object.keys(T).forEach(function (id) { ALL['t_' + id] = T[id]; });
  Object.keys(R).forEach(function (id) { ALL['r_' + id] = R[id]; });
  Object.keys(TR).forEach(function (id) { ALL['troop_' + id] = ICON['troop_' + id]; });
  MAT_CELLS.forEach(function (m) { ALL['mat_' + m[0]] = ICON['mat_' + m[0]]; });
  Object.keys(SLOT_ART).forEach(function (id) { ALL['slot_' + id] = ICON['slot_' + id]; });
  Object.keys(TYPE_KEY).forEach(function (t) { ALL['item_' + t] = ICON['item_' + t]; });

  /* ============================================================
   * v32：game-icons 开源素材接入（需求原文：「建议采用网图」）
   * ------------------------------------------------------------
   * 手绘 SVG 造型上限太低（连改三代仍被判「难看」），改用专门为游戏绘制的
   * game-icons 图标库（4134 个，CC BY 3.0）。素材与映射表在 js/gicons.js。
   *
   * 为什么用"延迟绑定"包装而不是直接替换手绘实现：
   *   gicons.js 在本文件之后加载 → 此刻 GICONS 尚未定义。
   *   而取图发生在页面就绪之后（那时已就绪），所以外面套一层包装函数，
   *   运行时才查表；查不到就静默回退原手绘实现，零风险。
   * ============================================================ */
  var GI_PREFIX = [
    ['troop_', 'troop'], ['mat_', 'mat'], ['slot_', 'slot'], ['item_', 'item'],
    ['b_', 'building'], ['e_', 'ext'], ['t_', 'terrain'], ['r_', 'res'],
  ];
  var MAT_SERIES = {}, MAT_TIER = {};
  MAT_CELLS.forEach(function (m) { MAT_SERIES[m[0]] = m[1]; MAT_TIER[m[0]] = m[2]; });

  function giDraw(group, id) {
    if (typeof GICONS === 'undefined' || !GICONS) return '';
    if (group === 'mat') return GICONS.matDraw(MAT_SERIES[id], MAT_TIER[id] || 1);
    return GICONS.draw(group, id);
  }

  Object.keys(ALL).forEach(function (key) {
    var group = null, id = null, i;
    for (i = 0; i < GI_PREFIX.length; i++) {
      if (key.indexOf(GI_PREFIX[i][0]) === 0) {
        group = GI_PREFIX[i][1];
        id = key.slice(GI_PREFIX[i][0].length);
        break;
      }
    }
    if (!group) return;
    var hand = ALL[key];
    ALL[key] = function (k, arg2) {
      var art = giDraw(group, id);
      if (!art) return hand(k, arg2);                      /* 未命中 → 回退手绘 */
      if (group === 'mat') art += tierPips(MAT_TIER[id] || 1);
      return art;
    };
  });

  /* 建筑 id → 图标 key */
  var BUILDING_KEY = {
    guanfu: 'b_guanfu', minfang: 'b_minfang', shuyuan: 'b_shuyuan', junying: 'b_junying',
    xiaochang: 'b_xiaochang', shichang: 'b_shichang', cangku: 'b_cangku', chengqiang: 'b_chengqiang',
    yizhan: 'b_yizhan', fenghuotai: 'b_fenghuotai', majiu: 'b_majiu', kezhan: 'b_kezhan',
    zhaoxianguan: 'b_zhaoxianguan', honglusi: 'b_honglusi', tiejiangpu: 'b_tiejiangpu',
    gongjiangzuofang: 'b_gongjiangzuofang',
  };
  var EXT_KEY = { farm: 'e_farm', forest: 'e_forest', quarry: 'e_quarry', mine: 'e_mine' };
  var TERRAIN_KEY = {
    plain: 't_plain', caoyuan: 't_caoyuan', zhaoze: 't_zhaoze', lake: 't_lake',
    forest: 't_forest', desert: 't_desert', hill: 't_hill', city: 't_city',
  };
  var RES_KEY = { grain: 'r_grain', wood: 'r_wood', stone: 'r_stone', iron: 'r_iron', gold: 'r_gold', pop: 'r_pop' };

  /* 取图标 SVG 字符串。type: 'building'|'ext'|'terrain'|'res'|'troop' */
  /* ============================================================
   * 顶栏菜单图标（v25 · 需求 10）
   * ------------------------------------------------------------
   * 用手绘**线描**而不是平涂：20px 尺寸下线描的辨识度远高于平涂小块，
   * 而且 `stroke: currentColor` 能跟着文字一起变色（默认暗、悬停金）。
   * 禁止 emoji —— 与地块图标同一条约定。
   * ============================================================ */
  ICON.navSet = {
    city: '<path d="M4 20.5V10l8-5.5 8 5.5v10.5"/><path d="M3 20.5h18"/><path d="M9.6 20.5v-5.2h4.8v5.2"/>'
      + '<path d="M7.6 8.6V6.2h1.8v1.2M14.6 8.6V6.2h1.8v1.2"/>',
    ext: '<path d="M3.2 20.4h17.6"/><path d="M5.4 20.4V10.2l3.4-2.2 3.4 2.2v10.2"/>'
      + '<path d="M14.6 20.4V12l2.9-1.9 2.9 1.9v8.4"/>'
      + '<path d="M7.1 13.2v2.6M8.9 13.2v2.6"/><path d="M17.5 13.8v2.4"/>',
    map: '<path d="M3 6.6 9.2 4l5.6 2.6L21 4v13.4L14.8 20l-5.6-2.6L3 20z"/>'
      + '<path d="M9.2 4v13.4M14.8 6.6V20"/>',
    general: '<path d="M12 3.2c3.5 0 6 2.2 6 5.1v2.6c0 4.5-2.7 8.1-6 8.1s-6-3.6-6-8.1V8.3c0-2.9 2.5-5.1 6-5.1z"/>'
      + '<path d="M9.6 3.6h4.8"/><path d="M12 3.2c1.5 0 2.5.8 2.6 1.9h-5.2c.1-1.1 1.1-1.9 2.6-1.9z"/>'
      + '<path d="M8.6 11.4h2.1M13.3 11.4h2.1"/><path d="M12 8.4v1.6"/>',
    march: '<path d="M6 3.4v17.2"/><path d="M6 4.4h11.2l-2.5 3.5 2.5 3.5H6z"/><path d="M4 20.6h4"/>',
    quest: '<path d="M7 3.2h9.2A2.8 2.8 0 0 1 19 6v12a2.8 2.8 0 0 0 2.8 2.8H7A2.8 2.8 0 0 1 4.2 18V6A2.8 2.8 0 0 1 7 3.2z"/>'
      + '<path d="M7.6 3.2A2.8 2.8 0 0 0 4.8 6"/><path d="M8.4 8.4h7.2M8.4 12h7.2M8.4 15.6h4"/>',
    stats: '<path d="M4 4.4v15.2h16"/><path d="M8 19.6v-6.2M12.4 19.6V8.6M16.8 19.6v-9.4"/>',
    shop: '<path d="M4.2 9.6 5.6 4h12.8l1.4 5.6"/><path d="M4.2 9.6h15.6v9.8H4.2z"/>'
      + '<path d="M3.2 9.6c0 1.5 1.2 2.6 2.8 2.6s2.8-1.1 2.8-2.6c0 1.5 1.2 2.6 2.8 2.6s2.8-1.1 2.8-2.6c0 1.5 1.2 2.6 2.8 2.6s2.8-1.1 2.8-2.6"/>'
      + '<path d="M9.6 19.4v-4.8h4.8v4.8"/>',
    bag: '<path d="M6.2 8.2h11.6l1.3 11a1.5 1.5 0 0 1-1.5 1.6H6.4a1.5 1.5 0 0 1-1.5-1.6z"/>'
      + '<path d="M9.2 8.2V6.6a2.8 2.8 0 0 1 5.6 0v1.6"/><path d="M6.6 12.4h10.8"/>',
    story: '<path d="M4.6 4.2h6.2v15.6H4.6z"/><path d="M13.2 4.2h6.2v15.6h-6.2z"/>'
      + '<path d="M6.6 8h2.2M6.6 12h2.2M6.6 16h2.2M15.2 8H17.4M15.2 12h2.2M15.2 16h2.2"/>',
    doc: '<path d="M7.6 3.4h6.6l4.2 4.2v13H7.6z"/><path d="M14.2 3.4v4.2h4.2"/>'
      + '<path d="M10.4 12.4h5.2M10.4 16.2h5.2"/>',
    /* v29（需求 5）：自动化菜单 —— 齿轮外圈 + 回旋箭头，表示"自行运转" */
    auto: '<path d="M4.6 12a7.4 7.4 0 0 1 12.6-5.2"/><path d="M17.6 3.4v3.6h-3.6"/>'
      + '<path d="M19.4 12a7.4 7.4 0 0 1-12.6 5.2"/><path d="M6.4 20.6v-3.6h3.6"/>'
      + '<circle cx="12" cy="12" r="2.2"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/>'
      + '<path d="M12 2.6l1.5 2.3 2.6-.7.4 2.7 2.7.4-.7 2.6L20.8 12l-2.3 1.5.7 2.6-2.7.4-.4 2.7-2.6-.7L12 20.8l-1.5-2.3-2.6.7-.4-2.7-2.7-.4.7-2.6L3.2 12l2.3-1.5-.7-2.6 2.7-.4.4-2.7 2.6.7z"/>',
  };
  ICON.nav = function (key) {
    var d = ICON.navSet[key];
    if (!d) return '';
    return '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };

  /* ============================================================
   * v35：AI 位图素材层（**最高优先级**）
   * ------------------------------------------------------------
   * 需求：「游戏级美术 + 汉代风」「单个地块不再显示背景（透明），
   *        直接以图标轮廓」。
   *
   * 为什么位图不套 wrap()：
   *   wrap() 会补 lightPass（光晕暗角）与 plate()（承台圆盘）——
   *   而位图 PNG 自带透明轮廓，正是"直接以轮廓摆放"要的效果。
   *   不套 wrap 就自然没有承台，也省掉一层 SVG 包装。
   *
   * 矢量路径（game-icons / 手绘）全部保留为**回退**：
   *   BITMAPS 未登记该 id（如地形只出了城池/平原）时自动走矢量。
   * ============================================================ */
  function bmImg(src) {
    return '<img class="ico ico-img" src="' + src + '" alt="" draggable="false">';
  }
  function bmOf(group, id) {
    if (typeof BITMAPS === 'undefined' || !BITMAPS) return '';
    var src = BITMAPS.src(group, id);
    return src ? bmImg(src) : '';
  }
  /* ICON.get 的 type 既可能是分组名，也可能是 'mat_fatie' 这类复合 key */
  function bmOfType(type, id) {
    if (type === 'building' || type === 'ext' || type === 'terrain' || type === 'res' || type === 'troop') {
      return bmOf(type, id);
    }
    var m = /^(mat|slot|item)_(.+)$/.exec(type);
    return m ? bmOf(m[1], m[2]) : '';
  }

  /* v36（需求 1「官府的贴图没变」）：位图**原始路径**查询。
     ICON.get 返回的是包好的 <img> 字符串；而官府宫殿是跨 4 格的自绘容器
     （.gov-art 要按自己的尺寸与对齐方式摆图），所以单独暴露路径。 */
  ICON.bitmapSrc = function (group, id) {
    if (typeof BITMAPS === 'undefined' || !BITMAPS) return '';
    return BITMAPS.src(group, id);
  };
  /* ============================================================
   * 兜底层取图（**跳过 AI 位图**）：手绘 SVG / game-icons 矢量
   * ------------------------------------------------------------
   * 为什么要单独暴露：
   *   ① 测试要能**分层断言**。曾经 smoke 因为看不见素材层（裸 var 在
   *      require 下是模块局部），所有"图标长什么样"的断言其实只验到了
   *      兜底层，却误以为验的是最终输出 —— 位图从未被验过。
   *   ② 排查"换了素材却没生效"时的第一问：这个图标现在由哪一层提供？
   * ============================================================ */
  ICON.raw = function (type, id) {
    var key = null;
    if (type === 'building') key = BUILDING_KEY[id];
    else if (type === 'ext') key = EXT_KEY[id];
    else if (type === 'terrain') key = TERRAIN_KEY[id];
    else if (type === 'res') key = RES_KEY[id];
    else if (type === 'troop') key = ALL['troop_' + id] ? 'troop_' + id : null;
    else key = ALL[type] ? type : null;
    if (!key || !ALL[key]) return '';
    /* 建筑 / 城外 / 地形 是"大地图上的主体"，套承台；
       资源小标、兵种小图、材料、部位图不套（避免过重） */
    var big = (type === 'building' || type === 'ext' || type === 'terrain');
    return wrap(ALL[key]('ic_' + key + '_'), { plate: big });
  };
  /* 当前该图标由哪一层提供：'bitmap'（AI 位图）| 'vector'（矢量兜底） */
  ICON.layerOf = function (type, id) { return bmOfType(type, id) ? 'bitmap' : 'vector'; };
  ICON.get = function (type, id) {
    /* v35：AI 位图优先（自带透明轮廓，不套承台/光晕） */
    var bm = bmOfType(type, id);
    if (bm) return bm;
    return ICON.raw(type, id);
  };
  ICON.keys = function () { return Object.keys(ALL); };
  ICON.has = function (type, id) { return !!ICON.get(type, id); };

  /* 建筑 id 直接取图（供 ui 层简化调用） */
  ICON.forBuilding = function (id) { return ICON.get('building', id); };
  ICON.forExt = function (id) { return ICON.get('ext', id); };
  ICON.forTerrain = function (id) { return ICON.get('terrain', id); };
  ICON.forRes = function (id) { return ICON.get('res', id); };
  ICON.forTroop = function (id) { return ICON.get('troop', id); };
  ICON.forMat = function (id) { return ICON.get('mat_' + id, ''); };
  ICON.forEquip = function (slot) {
    /* v35：AI 位图优先 */
    var bm = bmOf('slot', slot);
    if (bm) return bm;
    var k = 'slot_' + slot;
    return ALL[k] ? wrap(ALL[k]('ic_' + k + '_')) : '';
  };
  ICON.forItem = function (type, id) {
    /* v35：AI 位图优先（材料与物品两类） */
    if (type === 'mat' || type === 'material') {
      var bm0 = bmOf('mat', id);
      if (bm0) return bm0;
    }
    var bm1 = bmOf('item', type);
    if (bm1) return bm1;
    /* v30 修复：材料（mat/material）此前漏分发，24 种材料全落 attr_buff 橙卡兜底图 */
    if ((type === 'mat' || type === 'material') && ALL['mat_' + id]) return wrap(ALL['mat_' + id]('ic_mt' + id + '_'));
    var k = 'item_' + (TYPE_KEY[type] || 'attr_buff');
    return ALL[k] ? wrap(ALL[k]('ic_' + k + '_', id)) : '';
  };
  ICON.MAT_CELLS = MAT_CELLS;
})();
