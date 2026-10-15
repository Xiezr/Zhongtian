/* ============================================================
 * js/portraits.js  将领肖像（v22 · 需求 2）
 * ------------------------------------------------------------
 * 三种来源（按优先级）：
 *   ① 通用头像池 assets/portraits/pool/{m,f}NN.webp —— 男女各 20 张，
 *      由 AI 图集批量生成（自己生成，无第三方权利负担），**全体将领默认走这一层**。
 *      按将领名的 seed 稳定分配，同一个将领每次都是同一张脸。
 *   ② 史实名将专属图 assets/portraits/hero_<id>.webp（28 位）—— 仅当池子被清空时回退。
 *   ③ 程序化 SVG 立绘 —— 由「性别 + 资质 + 四维」确定，最后一层兜底，
 *      离线可用、零存储，保证界面永不空白。
 *
 * 存档只写 `portraitSeed`（一个整数，几字节），**不存图片**——
 * 否则几十张 base64 会直接吃光 localStorage 的 5MB 配额。
 *
 * 立绘规律（让玩家能从脸上读出信息）：
 *   甲胄主色 = 四维最高项（勇武赤 / 智谋青 / 统率金 / 内政绿）
 *   冠帽等级 = 资质（凡品布巾 → 良材束发 → 英杰皮冠 → 名世银冠 → 天授金冠）
 *   胡须/发式/五官 = seed 决定，同资质的人也不重样
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};

  var P = GAME.portraits = {};

  /* 史实名将 → 头像文件 id */
  P.HERO_FILE = {
    '曹操': 'caocao', '诸葛亮': 'zhugeliang', '关羽': 'guanyu', '吕布': 'lvbu', '周瑜': 'zhouyu',
    '司马懿': 'simayi', '陆逊': 'luxun', '邓艾': 'dengai', '吕蒙': 'lvmeng', '姜维': 'jiangwei',
    '孙坚': 'sunjian', '赵云': 'zhaoyun', '陆抗': 'lukang', '羊祜': 'yanghu', '孙策': 'sunce',
    '徐庶': 'xushu', '张辽': 'zhangliao', '鲁肃': 'lusu', '贾诩': 'jiaqu', '刘备': 'liubei',
    '张飞': 'zhangfei', '马超': 'machao', '黄忠': 'huangzhong', '典韦': 'dianwei', '许褚': 'xuchu',
    '孙权': 'sunquan', '袁绍': 'yuanshao', '董卓': 'dongzhuo'
  };
  P.DIR = 'assets/portraits/';

  /* ============================================================
   * v43：通用头像池（男女各 20 张，共 40）
   * ------------------------------------------------------------
   * 由 ImageGen 以 2×2 图集批量生成后切分，**自己生成，无第三方权利负担**
   * （比抓网图干净：别人的 AI 图受平台条款约束，未必可商用）。
   * 落位 assets/portraits/pool/{m,f}NN.webp，背景已用连通域洪水填充抠成透明。
   *
   * 分配规则：**按将领名的 seed 从池中稳定取一张** ——
   *   同一将领每次进游戏都是同一张脸（seed 存在存档里，旧档免迁移），
   *   不同将领则分散到池中不同头像上（"随机用"，但不会每次刷新都换脸）。
   * ============================================================ */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  P.POOL = { m: [], f: [] };
  (function () {
    for (var i = 1; i <= 20; i++) {
      P.POOL.m.push('m' + pad(i) + '.webp');
      P.POOL.f.push('f' + pad(i) + '.webp');
    }
  })();

  /* 性别判定：显式 gender 优先，其次是"美人"标记 */
  P.isFemale = function (g) { return !!(g && (g.gender === 'female' || g.beauty)); };

  /* 该将领在池中的头像路径（池为空时返回空串，由 fileOf 回退到史实名将图） */
  P.poolFile = function (g) {
    var pool = P.POOL[P.isFemale(g) ? 'f' : 'm'];
    if (!pool || !pool.length) return '';
    return P.DIR + 'pool/' + pool[P.seedOf(g) % pool.length];
  };

  /* 确定性伪随机（mulberry32）：同一 seed 永远同一张脸 */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 从将领对象推出稳定 seed（招募时写入，旧档按名字哈希补算） */
  P.seedOf = function (g) {
    if (g && g.portraitSeed != null) return g.portraitSeed;
    var str = String((g && (g.name || g.id)) || 'x'), s = 2166136261;
    for (var i = 0; i < str.length; i++) {
      s ^= str.charCodeAt(i);
      s = Math.imul(s, 16777619);
    }
    return s >>> 0;
  };

  /* 招募时调用：给将领定下肖像（史实名将记 heroKey，其余只记 seed） */
  P.assign = function (g) {
    if (!g) return g;
    if (g.portraitSeed == null) g.portraitSeed = P.seedOf(g);
    if (g.hero && P.HERO_FILE[g.name]) g.heroKey = P.HERO_FILE[g.name];
    return g;
  };

  P.isHero = function (g) { return !!(g && g.heroKey); };
  /* v43：头像取图统一入口 —— 池子优先（全体将领都有脸），
     池子为空时才回退到史实名将专属图。 */
  P.fileOf = function (g) {
    var p = P.poolFile(g);
    if (p) return p;
    return P.isHero(g) ? (P.DIR + 'hero_' + g.heroKey + '.webp') : '';
  };

  /* ---------- 调色板 ---------- */
  var SKIN = ['#e9cba9', '#e0bd9a', '#d8b189', '#ceA87f', '#e6d0b4'];
  var HAIR = ['#2a2420', '#3a3128', '#1d1916', '#463c32', '#5a4a3a'];
  var CLOTH = {
    yw: ['#7d3524', '#c25b3c'],   /* 勇武：赤 */
    zm: ['#27405e', '#4a7bab'],   /* 智谋：青 */
    tong: ['#6f5220', '#c19a48'], /* 统率：金 */
    nz: ['#35502e', '#6b9550']    /* 内政：绿 */
  };

  /* ---------- 程序化立绘（v31 立绘感升级） ---------- */
  /* 设计原则：让程序化头像也能"有神"
     - 双眼：白睛+虹膜+瞳孔+高光点（上神）+眼线（轮廓）
     - 鼻：鼻梁高光 + 鼻翼阴影
     - 嘴：上唇线 + 下唇高光
     - 脸：左暗右亮（单一光源从左上来）
     - 甲胄：领口翻边 + 护肩铜扣 + V 字领 */
  P.svg = function (g, size) {
    size = size || 96;
    var r = rng(P.seedOf(g));
    var fem = !!(g && (g.beauty || g.gender === 'female'));
    var uid = 'p' + (P.seedOf(g) % 100000);

    /* 四维最高项 → 甲胄主色 */
    var a = { yw: (g.yw || 60), zm: (g.zm || 60), tong: (g.tong || 60), nz: (g.nz || 60) };
    var top = 'tong';
    ['yw', 'zm', 'tong', 'nz'].forEach(function (k) { if (a[k] > a[top]) top = k; });
    var cl = CLOTH[top];
    var clHi = cl[1], clLo = cl[0];

    /* 资质 → 冠帽 */
    var rankIdx = { 'fan': 0, 'liang': 1, 'ying': 2, 'ming': 3, 'tian': 4 }[g && g.rank] || 0;

    var skin = SKIN[Math.floor(r() * SKIN.length)];
    var hair = HAIR[Math.floor(r() * HAIR.length)];
    var faceW = 26 + Math.round(r() * 5);
    var faceH = 30 + Math.round(r() * 4);
    var browY = 42 + Math.round(r() * 2);
    var eyeY = 48 + Math.round(r() * 2);
    var eyeGap = 7 + Math.round(r() * 3);
    var beard = !fem && r() > 0.35;
    var beardLen = beard ? (4 + Math.round(r() * 7)) : 0;
    /* v31 新增：虹膜色（深褐/黑/蓝 随机） */
    var irisPal = ['#3a2818', '#1a1410', '#243d5e', '#3a4a2e', '#5a3818'];
    var iris = irisPal[Math.floor(r() * irisPal.length)];

    /* 冠帽形状（按资质递进） */
    var crown = '';
    if (rankIdx === 0) {
      crown = '<path d="M' + (50 - faceW / 2 - 2) + ' 40 Q50 28 ' + (50 + faceW / 2 + 2) + ' 40' +
        ' Q50 33 ' + (50 - faceW / 2 - 2) + ' 40 Z" fill="' + hair + '" opacity=".88"/>' +
        /* 布巾 */
        '<rect x="' + (50 - faceW / 2 - 3) + '" y="38" width="' + (faceW + 6) + '" height="4.5" rx="2" fill="#6a5a44"/>' +
        '<rect x="' + (50 - faceW / 2 - 3) + '" y="38" width="' + (faceW + 6) + '" height="1.4" rx=".8" fill="#8a7050"/>';
    } else if (rankIdx === 1) {
      crown = '<path d="M' + (50 - faceW / 2 - 2) + ' 39 Q50 26 ' + (50 + faceW / 2 + 2) + ' 39 Z" fill="' + hair + '"/>' +
        '<rect x="' + (50 - faceW / 2 - 3) + '" y="37" width="' + (faceW + 6) + '" height="4" rx="1.6" fill="#8a6a3a"/>' +
        '<rect x="' + (50 - faceW / 2 - 3) + '" y="37" width="' + (faceW + 6) + '" height="1.4" rx=".8" fill="#b08848"/>';
    } else if (rankIdx === 2) {
      crown = '<path d="M' + (50 - faceW / 2 - 3) + ' 38 L50 24 L' + (50 + faceW / 2 + 3) + ' 38 Z" fill="#3d3a34"/>' +
        '<path d="M' + (50 - faceW / 2 - 4) + ' 38 h' + (faceW + 8) + ' v4 h-' + (faceW + 8) + ' Z" fill="#57524a"/>' +
        '<path d="M' + (50 - faceW / 2 - 4) + ' 38 h' + (faceW + 8) + ' v1 h-' + (faceW + 8) + ' Z" fill="#7a7268"/>' +
        '<circle cx="50" cy="26" r="2.4" fill="#c9a24b"/>' +
        '<circle cx="50" cy="26" r="1" fill="#fff3cf"/>';
    } else if (rankIdx === 3) {
      crown = '<path d="M' + (50 - faceW / 2 - 4) + ' 37 L50 20 L' + (50 + faceW / 2 + 4) + ' 37 Z" fill="#b9c3ce"/>' +
        '<path d="M' + (50 - faceW / 2 - 5) + ' 37 h' + (faceW + 10) + ' v4.5 h-' + (faceW + 10) + ' Z" fill="#d5dde6"/>' +
        '<path d="M' + (50 - faceW / 2 - 5) + ' 37 h' + (faceW + 10) + ' v1.2 h-' + (faceW + 10) + ' Z" fill="#fff" opacity=".55"/>' +
        '<circle cx="50" cy="23" r="2.6" fill="#6fa8d8"/>' +
        '<circle cx="50" cy="23" r="1.2" fill="#cee0f4"/>' +
        '<path d="M50 20 q-4 -7 -1 -11" stroke="#6fa8d8" stroke-width="1.6" fill="none"/>' +
        '<path d="M50 20 q4 -7 1 -11" stroke="#6fa8d8" stroke-width="1.6" fill="none"/>';
    } else {
      crown = '<path d="M' + (50 - faceW / 2 - 4) + ' 36 L50 18 L' + (50 + faceW / 2 + 4) + ' 36 Z" fill="#c9a24b"/>' +
        '<path d="M' + (50 - faceW / 2 - 6) + ' 36 h' + (faceW + 12) + ' v5 h-' + (faceW + 12) + ' Z" fill="#e8c878"/>' +
        '<path d="M' + (50 - faceW / 2 - 6) + ' 36 h' + (faceW + 12) + ' v1.4 h-' + (faceW + 12) + ' Z" fill="#fff3cf"/>' +
        '<circle cx="50" cy="22" r="3" fill="#fff3cf"/>' +
        '<circle cx="50" cy="22" r="1.4" fill="#c9a24b"/>' +
        '<path d="M44 19 q-6 -8 -2 -13 M56 19 q6 -8 2 -13" stroke="#e8c878" stroke-width="1.8" fill="none"/>' +
        /* 凤凰翎 */
        '<path d="M50 16 q-3 -6 0 -10 q3 4 0 10 Z" fill="#c44a2a"/>' +
        '<path d="M50 16 q-3 -6 0 -10" stroke="#fff" stroke-width=".4" fill="none" opacity=".55"/>';
    }

    var svg =
      '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" class="portrait-svg" role="img">' +
      '<defs>' +
        '<radialGradient id="' + uid + 'bg" cx="50%" cy="34%" r="76%">' +
          '<stop offset="0%" stop-color="#5c4830"/><stop offset="100%" stop-color="#201708"/>' +
        '</radialGradient>' +
        '<linearGradient id="' + uid + 'cl" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + clHi + '"/><stop offset="100%" stop-color="' + clLo + '"/>' +
        '</linearGradient>' +
        /* 脸部光照：左亮右暗（径向） */
        '<radialGradient id="' + uid + 'sk" cx="40%" cy="40%" r="65%">' +
          '<stop offset="0%" stop-color="' + skin + '" stop-opacity="1"/>' +
          '<stop offset="65%" stop-color="' + skin + '" stop-opacity=".95"/>' +
          '<stop offset="100%" stop-color="#000" stop-opacity=".22"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<rect width="100" height="100" rx="10" fill="url(#' + uid + 'bg)"/>' +
      /* === 肩甲（v31 重画） === */
      '<path d="M10 100 Q12 76 50 70 Q88 76 90 100 Z" fill="url(#' + uid + 'cl)"/>' +
      /* 肩甲右暗面 */
      '<path d="M50 70 Q88 76 90 100 L50 100 Z" fill="rgba(0,0,0,.22)"/>' +
      /* V 字翻领 */
      '<path d="M38 76 L50 100 L62 76 Q56 84 50 80 Q44 84 38 76 Z" fill="#1a1410" opacity=".55"/>' +
      '<path d="M40 78 L50 96 L60 78" stroke="' + clHi + '" stroke-width="1" fill="none" opacity=".7"/>' +
      /* 领口金边 */
      '<path d="M40 78 Q50 74 60 78" stroke="#e0b85c" stroke-width="1.4" fill="none"/>' +
      /* 护肩铜扣（左右各一） */
      '<circle cx="22" cy="86" r="2.4" fill="#c9a24b"/>' +
      '<circle cx="22" cy="86" r="1.2" fill="#fff3cf"/>' +
      '<circle cx="78" cy="86" r="2.4" fill="#c9a24b"/>' +
      '<circle cx="78" cy="86" r="1.2" fill="#fff3cf"/>' +
      /* 胸甲竖纹（铠甲金属感） */
      '<g stroke="rgba(0,0,0,.25)" stroke-width=".7" fill="none">' +
      '<path d="M30 86 L34 100"/><path d="M40 80 L42 100"/><path d="M60 80 L58 100"/><path d="M70 86 L66 100"/>' +
      '</g>' +
      /* 高光（金属反光） */
      '<path d="M14 90 Q22 80 30 86" stroke="rgba(255,255,255,.18)" stroke-width="1.4" fill="none"/>' +
      /* === 脖颈 === */
      '<path d="M43 60 h14 v11 q-7 5 -14 0 Z" fill="' + skin + '"/>' +
      '<path d="M43 60 h14 v11 q-7 5 -14 0 Z" fill="rgba(0,0,0,.18)"/>' +
      /* 颈左高光 */
      '<path d="M43 62 q3 4 4 7" stroke="rgba(255,255,255,.25)" stroke-width="1.2" fill="none"/>' +
      /* === 耳（v31 加耳廓弧线） === */
      '<ellipse cx="' + (50 - faceW / 2 - 1) + '" cy="' + (eyeY + 2) + '" rx="3" ry="4.4" fill="' + skin + '"/>' +
      '<path d="M' + (50 - faceW / 2 - 2) + ' ' + (eyeY - 1) + ' q-2 3 0 7" stroke="rgba(0,0,0,.22)" stroke-width=".9" fill="none"/>' +
      '<ellipse cx="' + (50 + faceW / 2 + 1) + '" cy="' + (eyeY + 2) + '" rx="3" ry="4.4" fill="' + skin + '"/>' +
      '<path d="M' + (50 + faceW / 2 + 2) + ' ' + (eyeY - 1) + ' q2 3 0 7" stroke="rgba(0,0,0,.22)" stroke-width=".9" fill="none"/>' +
      /* === 脸 === */
      '<path d="M' + (50 - faceW / 2) + ' 38 q' + (faceW / 2) + ' -7 ' + faceW + ' 0' +
        ' q3 ' + (faceH / 2) + ' -' + (faceW / 2 - 3) + ' ' + (faceH - 4) +
        ' q-' + (faceW / 2 - 3) + ' 8 -' + (faceW - 6) + ' 0' +
        ' q-' + (faceW / 2 - 3) + ' -' + (faceH / 2 - 4) + ' -3 -' + (faceH - 4) + ' Z" fill="url(#' + uid + 'sk)"/>' +
      /* 发际 */
      (fem
        ? '<path d="M' + (50 - faceW / 2 - 1) + ' 40 q' + (faceW / 2 + 1) + ' -13 ' + (faceW + 2) + ' 0' +
            ' q-' + (faceW / 2) + ' -6 -' + (faceW + 2) + ' 0 Z" fill="' + hair + '"/>' +
          '<circle cx="' + (50 - faceW / 2 + 4) + '" cy="30" r="2" fill="#d8577f"/>' +
          '<circle cx="' + (50 + faceW / 2 - 4) + '" cy="31" r="1.6" fill="#d8577f"/>'
        : '<path d="M' + (50 - faceW / 2 - 1) + ' 41 q' + (faceW / 2 + 1) + ' -12 ' + (faceW + 2) + ' 0' +
            ' q-' + (faceW / 2) + ' -5 -' + (faceW + 2) + ' 0 Z" fill="' + hair + '"/>'
      ) +
      crown +
      /* === 眉（v31 加眉峰与下边线） === */
      '<path d="M' + (50 - eyeGap - 5) + ' ' + browY + ' q5 -3 9 -.4" stroke="' + hair +
        '" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      '<path d="M' + (50 + eyeGap - 4) + ' ' + (browY - 0.6) + ' q4 -2.4 9 .4" stroke="' + hair +
        '" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      /* === 双眼（v31 重画：眼线 + 虹膜 + 瞳孔 + 高光） === */
      /* 左眼 */
      '<ellipse cx="' + (50 - eyeGap) + '" cy="' + eyeY + '" rx="3.4" ry="2.1" fill="#fbf7f0"/>' +
      '<ellipse cx="' + (50 - eyeGap) + '" cy="' + eyeY + '" rx="3.4" ry="2.1" fill="none" stroke="#3a2a20" stroke-width=".9"/>' +
      '<circle cx="' + (50 - eyeGap + 0.2) + '" cy="' + eyeY + '" r="1.7" fill="' + iris + '"/>' +
      '<circle cx="' + (50 - eyeGap + 0.2) + '" cy="' + eyeY + '" r=".85" fill="#0a0806"/>' +
      /* 眼高光（左上小白点） */
      '<circle cx="' + (50 - eyeGap - 0.6) + '" cy="' + (eyeY - 0.6) + '" r=".7" fill="#fff" opacity=".95"/>' +
      '<circle cx="' + (50 - eyeGap + 0.6) + '" cy="' + (eyeY + 0.4) + '" r=".4" fill="#fff" opacity=".6"/>' +
      /* 上睫毛 */
      '<path d="M' + (50 - eyeGap - 2.4) + ' ' + (eyeY - 1.8) + ' q3.4 -1.5 6.8 0" stroke="#1a1410" stroke-width=".6" fill="none" opacity=".65"/>' +
      /* 右眼 */
      '<ellipse cx="' + (50 + eyeGap) + '" cy="' + eyeY + '" rx="3.4" ry="2.1" fill="#fbf7f0"/>' +
      '<ellipse cx="' + (50 + eyeGap) + '" cy="' + eyeY + '" rx="3.4" ry="2.1" fill="none" stroke="#3a2a20" stroke-width=".9"/>' +
      '<circle cx="' + (50 + eyeGap + 0.2) + '" cy="' + eyeY + '" r="1.7" fill="' + iris + '"/>' +
      '<circle cx="' + (50 + eyeGap + 0.2) + '" cy="' + eyeY + '" r=".85" fill="#0a0806"/>' +
      '<circle cx="' + (50 + eyeGap - 0.6) + '" cy="' + (eyeY - 0.6) + '" r=".7" fill="#fff" opacity=".95"/>' +
      '<circle cx="' + (50 + eyeGap + 0.6) + '" cy="' + (eyeY + 0.4) + '" r=".4" fill="#fff" opacity=".6"/>' +
      '<path d="M' + (50 + eyeGap - 2.4) + ' ' + (eyeY - 1.8) + ' q3.4 -1.5 6.8 0" stroke="#1a1410" stroke-width=".6" fill="none" opacity=".65"/>' +
      /* === 鼻（v31 加鼻梁高光 + 鼻翼阴影） === */
      '<path d="M50 ' + (eyeY + 2) + ' L49.4 ' + (eyeY + 8) + ' q-2 1.2 -3.4 2.4 q3 1 6 0 q-1.4 -1.2 -3.4 -2.4 L50 ' + (eyeY + 2) + ' Z" fill="rgba(0,0,0,.14)"/>' +
      /* 鼻梁高光（v31 新增） */
      '<path d="M48.4 ' + (eyeY + 3) + ' L48 ' + (eyeY + 7) + '" stroke="rgba(255,255,255,.4)" stroke-width=".7" fill="none" stroke-linecap="round"/>' +
      /* 鼻底小阴影（鼻翼） */
      '<ellipse cx="48" cy="' + (eyeY + 10) + '" rx="1" ry=".6" fill="rgba(0,0,0,.18)"/>' +
      '<ellipse cx="52" cy="' + (eyeY + 10) + '" rx="1" ry=".6" fill="rgba(0,0,0,.18)"/>' +
      /* === 嘴（v31 重画：上唇线 + 下唇高光） === */
      '<path d="M' + (50 - 4.5) + ' ' + (eyeY + 12) + ' q4.5 -1.5 9 0" stroke="#8a3a28" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
      /* 上唇珠状高光 */
      '<path d="M' + (50 - 3) + ' ' + (eyeY + 12) + ' q3 -.6 6 0" stroke="#a8553f" stroke-width=".8" fill="none" opacity=".6"/>' +
      /* 下唇（淡红） */
      '<path d="M' + (50 - 4) + ' ' + (eyeY + 12) + ' q4 3 8 0 q-4 1.4 -8 0 Z" fill="#b85544" opacity=".55"/>' +
      /* 下唇高光 */
      '<path d="M' + (50 - 2.5) + ' ' + (eyeY + 13) + ' q2.5 -.8 5 0" stroke="rgba(255,255,255,.35)" stroke-width=".7" fill="none"/>' +
      /* === 胡须 === */
      (beard
        ? '<path d="M' + (50 - 7) + ' ' + (eyeY + 14) + ' q7 ' + (beardLen + 6) + ' 14 0 q-7 ' + (beardLen + 1) + ' -14 0 Z" fill="' + hair + '" opacity=".92"/>' +
          /* 山羊胡中分线 */
          '<path d="M50 ' + (eyeY + 14) + ' v' + (beardLen - 2) + '" stroke="rgba(0,0,0,.18)" stroke-width=".7" fill="none"/>' +
          /* 胡须纹路（多道细丝） */
          '<g stroke="' + hair + '" stroke-width=".45" fill="none" opacity=".55">' +
          '<path d="M' + (50 - 6) + ' ' + (eyeY + 15) + ' q-2 3 -3 8"/>' +
          '<path d="M' + (50 - 3) + ' ' + (eyeY + 15) + ' q-1 3 -1 9"/>' +
          '<path d="M' + (50 + 3) + ' ' + (eyeY + 15) + ' q1 3 1 9"/>' +
          '<path d="M' + (50 + 6) + ' ' + (eyeY + 15) + ' q2 3 3 8"/>' +
          '</g>'
        : ''
      ) +
      /* === 资质光晕 === */
      (rankIdx >= 3
        ? '<rect width="100" height="100" rx="10" fill="none" stroke="' +
            (rankIdx === 4 ? 'rgba(232,200,120,.75)' : 'rgba(160,190,220,.55)') + '" stroke-width="1.6"/>'
        : '<rect width="100" height="100" rx="10" fill="none" stroke="rgba(214,178,105,.30)" stroke-width="1.2"/>'
      ) +
      '</svg>';
    return svg;
  };

  /* ---------- 统一入口：有 AI 图用图，没有就用立绘 ----------
     头像文件放在 assets/portraits/ 下，**同名预渲染一份 SVG 备用**：
     file:// 下无法可靠探测文件是否存在，于是让 <img> 出错时就地切换到备用立绘，
     任何情况下都不会出现空白框或裂图。 */
  P.html = function (g, size, cls) {
    size = size || 96;
    var extra = cls ? ' ' + cls : '';
    var src = P.fileOf(g);
    /* v43：只有"池子被清空且不是史实名将"时才退回程序化立绘 ——
       正常情况全体将领都能拿到池中头像。 */
    if (!src) {
      return P.svg(g, size).replace('<svg ', '<svg class="portrait-svg' + extra + '" ');
    }
    return '<span class="portrait-holder' + extra + '" style="width:' + size + 'px;height:' + size + 'px;">' +
      '<img class="portrait-img" src="' + src + '" width="' + size + '" height="' + size +
        '" alt="' + U_esc(g.name) + '" onerror="GAME.portraits.swap(this)">' +
      '<span class="portrait-alt" hidden>' + P.svg(g, size) + '</span>' +
      '</span>';
  };

  function U_esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  P.swap = function (img) {
    var holder = img.parentNode;
    if (!holder) return;
    var alt = holder.querySelector('.portrait-alt');
    if (alt) {
      alt.hidden = false;
      if (img.parentNode) img.parentNode.removeChild(img);
    }
  };

  /* 旧档兼容：给已有将领补上 seed / heroKey（不写盘，读档时补齐） */
  P.ensure = function (g) {
    if (!g) return g;
    if (g.portraitSeed == null) g.portraitSeed = P.seedOf(g);
    if (g.hero && !g.heroKey && P.HERO_FILE[g.name]) g.heroKey = P.HERO_FILE[g.name];
    return g;
  };
})();
