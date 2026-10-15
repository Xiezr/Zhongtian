/* ============================================================
 * js/portraits.js  英雄肖像（v90 · 通用头像池）
 * ------------------------------------------------------------
 * 头像来源：assets/portraits/pool/{性别}_{风格}_{NN}.webp
 *   三种风格混排（human / beast / mecha），男 66 张 + 女 25 张，由 AI 批量
 *   生成后切分抠底（自己生成，无第三方权利负担）。按英雄名的 seed **稳定取一张**：
 *   同一英雄每次进游戏都是同一张脸（seed 存存档，旧档按名字哈希补算）。
 *
 * 存档只写 `portraitSeed`（一个整数，几字节），不存图片。
 *
 * 池文件清单**内嵌在下方 POOL**——头像是同步渲染的，运行时不能 fetch 目录，
 * 往池里加新图后须把文件名补进对应数组（顺序即分配顺序）。
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var P = GAME.portraits = {};

  P.DIR = 'assets/portraits/';

  /* 通用头像池文件清单（与 assets/portraits/pool/tags.json 同源） */
  P.POOL = {
    /* m · 66 张 */
    m: [
      'm_beast_01.webp', 'm_beast_02.webp', 'm_beast_03.webp', 'm_beast_04.webp',
      'm_beast_05.webp', 'm_beast_06.webp', 'm_beast_07.webp', 'm_beast_08.webp',
      'm_human_01.webp', 'm_human_02.webp', 'm_human_03.webp', 'm_human_04.webp',
      'm_human_05.webp', 'm_human_06.webp', 'm_human_07.webp', 'm_human_08.webp',
      'm_human_09.webp', 'm_human_10.webp', 'm_human_11.webp', 'm_human_12.webp',
      'm_human_13.webp', 'm_human_14.webp', 'm_human_15.webp', 'm_human_16.webp',
      'm_human_17.webp', 'm_human_24.webp', 'm_human_25.webp', 'm_human_26.webp',
      'm_human_27.webp', 'm_human_28.webp', 'm_human_36.webp', 'm_human_37.webp',
      'm_human_38.webp', 'm_human_39.webp', 'm_human_40.webp', 'm_human_41.webp',
      'm_human_42.webp', 'm_human_43.webp', 'm_mecha_01.webp', 'm_mecha_02.webp',
      'm_mecha_03.webp', 'm_mecha_04.webp', 'm_mecha_05.webp', 'm_mecha_06.webp',
      'm_mecha_07.webp', 'm_mecha_08.webp', 'm_mecha_09.webp', 'm_mecha_10.webp',
      'm_mecha_11.webp', 'm_mecha_12.webp', 'm_mecha_13.webp', 'm_mecha_14.webp',
      'm_mecha_15.webp', 'm_mecha_16.webp', 'm_mecha_17.webp', 'm_mecha_18.webp',
      'm_mecha_19.webp', 'm_mecha_20.webp', 'm_mecha_21.webp', 'm_mecha_22.webp',
      'm_mecha_23.webp', 'm_mecha_24.webp', 'm_mecha_25.webp', 'm_mecha_26.webp',
      'm_mecha_27.webp', 'm_mecha_28.webp'
    ],
    /* f · 25 张 */
    f: [
      'f_beast_01.webp', 'f_beast_02.webp', 'f_beast_03.webp', 'f_human_01.webp',
      'f_human_02.webp', 'f_human_03.webp', 'f_human_04.webp', 'f_human_05.webp',
      'f_human_06.webp', 'f_human_07.webp', 'f_human_08.webp', 'f_human_09.webp',
      'f_human_12.webp', 'f_human_13.webp', 'f_human_14.webp', 'f_human_20.webp',
      'f_human_21.webp', 'f_human_22.webp', 'f_mecha_01.webp', 'f_mecha_02.webp',
      'f_mecha_03.webp', 'f_mecha_04.webp', 'f_mecha_05.webp', 'f_mecha_06.webp',
      'f_mecha_07.webp'
    ]
  };

  /* 性别判定：显式 gender 优先，其次是"美人"标记 */
  P.isFemale = function (g) { return !!(g && (g.gender === 'female' || g.beauty)); };

  /* 从英雄对象推出稳定 seed（招募时写入，旧档按名字哈希补算） */
  P.seedOf = function (g) {
    if (g && g.portraitSeed != null) return g.portraitSeed;
    var str = String((g && (g.name || g.id)) || 'x'), s = 2166136261;
    for (var i = 0; i < str.length; i++) {
      s ^= str.charCodeAt(i);
      s = Math.imul(s, 16777619);
    }
    return s >>> 0;
  };

  /* 该英雄在池中的头像路径（池为空时返回空串） */
  P.poolFile = function (g) {
    var pool = P.POOL[P.isFemale(g) ? 'f' : 'm'];
    if (!pool || !pool.length) return '';
    return P.DIR + 'pool/' + pool[P.seedOf(g) % pool.length];
  };

  /* 头像取图统一入口 */
  P.fileOf = function (g) { return P.poolFile(g); };

  /* 招募时调用：给英雄定下肖像（只记 seed） */
  P.assign = function (g) {
    if (!g) return g;
    if (g.portraitSeed == null) g.portraitSeed = P.seedOf(g);
    return g;
  };

  function U_esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /* ---------- 统一入口：<img> 取池中头像 ---------- */
  P.html = function (g, size, cls) {
    size = size || 96;
    var extra = cls ? ' ' + cls : '';
    var src = P.fileOf(g);
    /* 池不可用时退回 emoji（正常情况不会发生），保证界面不开天窗 */
    if (!src) {
      return '<span style="font-size:' + Math.round(size * 0.7) + 'px;line-height:1;">' +
        U_esc((g && g.avatar) || '🧔') + '</span>';
    }
    return '<span class="portrait-holder' + extra + '" style="width:' + size + 'px;height:' + size + 'px;">' +
      '<img class="portrait-img" src="' + src + '" width="' + size + '" height="' + size +
        '" alt="' + U_esc(g && g.name) + '">' +
      '</span>';
  };

  /* 旧档兼容：给已有英雄补上 seed（不写盘，读档时补齐） */
  P.ensure = function (g) {
    if (g && g.portraitSeed == null) g.portraitSeed = P.seedOf(g);
    return g;
  };
})();
