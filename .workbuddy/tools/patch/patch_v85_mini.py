# -*- coding: utf-8 -*-
"""v85 · 核心层（II）：缩略地图 —— 数据派生（map.js）+ 渲染/面板/底部条（ui.js）。

- map.miniBuild：全图 500×500 州/郡归属（先州后郡两遍最近邻，州心 13 / 郡单元 114），
  按 map.seed 缓存；边界是**地理**划分（读 NPC_CITIES 固有 state，占领不影响）。
- ui.miniOff / drawMini / paintMiniBottom / openMinimap：离屏静态层 + 动态我城叠加；
  底部条固定拼 38px 小图（点击开「天下大势」）；州界亮金实线 / 郡界灰白细线。
"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'
MAP = r'E:\Deepseekdb\js\map.js'
MAIN = r'E:\Deepseekdb\js\main.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


MINI_BUILD = """  /* ============================================================
   * v85（老板）：「底部导航栏增加一个缩略地图（覆盖 500×500），在缩略地图标注
   * 州城，郡城位置。对州郡的边界以不同样式的线条区分」
   * ------------------------------------------------------------
   * 全图 500×500 的州/郡归属一次性派生（按 map.seed 缓存；占领不影响 ——
   * 边界是**地理**划分，读 DATA.NPC_CITIES 的固有 state）：
   *   · 州心 = 都城 / 州城（13 个）；每格取最近州心 → 州域（Voronoi）。
   *   · 郡单元 = 每座郡城 + 所属州城（州直辖）；**先定州、再在本州郡心里取最近**
   *     —— 两遍最近邻保证郡界不跨州（不会出现交叉行政区）。
   * 输出：ownerState / ownerJun（Uint8Array × 25 万格）+ 中心坐标表。
   * 渲染（州染 / 界线 / 城点）在 ui 层，这里只管数据。
   * ============================================================ */
  GAME.map.miniBuild = function () {
    var s = GAME.state, seed = s.map.seed;
    if (GAME.map._mini && GAME.map._mini.seed === seed) return GAME.map._mini;
    var W = DATA.MAP_W, H = DATA.MAP_H;
    var stName = [], stX = [], stY = [];                    /* 州心（出现顺序 = 色板下标） */
    var junByState = [], junN = 0;                          /* 每州的郡单元：{x,y,id} */
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type === 'county') return;                      /* 县城不参与中心 */
      var si = stName.indexOf(c.state);
      if (si < 0) { si = stName.length; stName.push(c.state); }
      if (c.type === 'capital' || c.type === 'zhou') {
        if (stX[si] == null) { stX[si] = c.x; stY[si] = c.y; }
      }
      if (!junByState[si]) junByState[si] = [];
      junByState[si].push({ x: c.x, y: c.y, id: junN++ });
    });
    var S = stName.length;
    var ownerState = new Uint8Array(W * H), ownerJun = new Uint8Array(W * H);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var bs = 0, bd = 4294967295;
        for (var i = 0; i < S; i++) {
          var dx = x - stX[i], dy = y - stY[i], d = dx * dx + dy * dy;
          if (d < bd) { bd = d; bs = i; }
        }
        var J = junByState[bs], bjId = 0, bd2 = 4294967295;
        for (var j = 0; j < J.length; j++) {
          var dx2 = x - J[j].x, dy2 = y - J[j].y, d2 = dx2 * dx2 + dy2 * dy2;
          if (d2 < bd2) { bd2 = d2; bjId = J[j].id; }
        }
        ownerState[y * W + x] = bs;
        ownerJun[y * W + x] = bjId;
      }
    }
    GAME.map._mini = { seed: seed, state: ownerState, jun: ownerJun,
      stName: stName, stX: stX, stY: stY };
    return GAME.map._mini;
  };

  /* 距离（曼哈顿） */"""

MINI_UI = """  /* ============================================================
   * v85（老板）：缩略地图渲染 —— 底部小图与「天下大势」面板复用同一份离屏图。
   * ------------------------------------------------------------
   * 静态层（地形 × 州染 + 州界/郡界 + 州城/郡城/都城点）画进离屏 canvas，
   * 按 map.seed 缓存；动态层（我城）在每次 drawMini 时叠加。
   * 界线样式：**州界 = 亮金实线（整格满涂）**；**郡界 = 灰白细线（对角 2px，
   * 细一档形成区分）** —— 即老板要的「不同样式的线条」。
   * ============================================================ */
  ui.MINI_PX = 1000;               /* 离屏分辨率 = 2px / 格（世界 500×500） */
  ui.MINI_TINT = [
    '#d4453a', '#4a80c8', '#c8813a', '#4aa06a', '#8a5fc0', '#b0b03a', '#3a9aa8',
    '#7a6ac0', '#c05a8a', '#5ac0a0', '#c0a040', '#6a9a40', '#c06040'
  ];
  ui._miniOff = null; ui._miniSeed = null;
  ui.mixHex = function (a, b, k) {        /* 十六进制色混合：a×(1-k) + b×k */
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round((pa >> 16) * (1 - k) + (pb >> 16) * k);
    var g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k);
    var bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
    return (r << 16) | (g << 8) | bl;
  };
  ui.miniOff = function () {              /* 离屏静态层（按 seed 缓存） */
    var s = GAME.state;
    if (ui._miniOff && ui._miniSeed === s.map.seed) return ui._miniOff;
    if (!GAME.map.miniBuild) return null;
    var d = GAME.map.miniBuild();
    var W = DATA.MAP_W, H = DATA.MAP_H, P = ui.MINI_PX / W;
    var cv, ctx, img;
    try {
      cv = document.createElement('canvas');
      cv.width = ui.MINI_PX; cv.height = ui.MINI_PX;
      ctx = cv.getContext && cv.getContext('2d');
      if (!ctx || !ctx.createImageData) return null;
      img = ctx.createImageData(ui.MINI_PX, ui.MINI_PX);
    } catch (e) { return null; }          /* jsdom：无 2d 上下文，静默跳过 */
    /* 底色查表：州染 × 地形色（预混，循环内只查表） */
    var baseLUT = [];
    for (var si = 0; si < ui.MINI_TINT.length; si++) {
      baseLUT[si] = {};
      for (var tk in DATA.TERRAIN) {
        var tc = DATA.TERRAIN[tk].color || '#b8a06a';            /* city 无 color → 土金 */
        baseLUT[si][tk] = ui.mixHex(tc, ui.MINI_TINT[si], 0.16);
      }
    }
    var px = img.data;
    var put = function (mx, my, v) {
      var o = (my * ui.MINI_PX + mx) * 4;
      px[o] = (v >> 16) & 255; px[o + 1] = (v >> 8) & 255; px[o + 2] = v & 255; px[o + 3] = 255;
    };
    var gt = s.map.grid || [];
    for (var y = 0; y < H; y++) {
      var row = gt[y] || [];
      for (var x = 0; x < W; x++) {
        var idx = y * W + x;
        var t = (row[x] && row[x].terrain) || 'plain';
        var st = d.state[idx], jn = d.jun[idx];
        var col = (baseLUT[st] && baseLUT[st][t] != null) ? baseLUT[st][t] : 0x808080;
        var rSt = x + 1 < W ? d.state[idx + 1] : st;
        var dSt = y + 1 < H ? d.state[idx + W] : st;
        var rJn = x + 1 < W ? d.jun[idx + 1] : jn;
        var dJn = y + 1 < H ? d.jun[idx + W] : jn;
        var X = x * P, Y = y * P;
        if (rSt !== st || dSt !== st) {                        /* 州界：亮金实线 */
          put(X, Y, 0xf0d060); put(X + 1, Y, 0xf0d060);
          put(X, Y + 1, 0xf0d060); put(X + 1, Y + 1, 0xf0d060);
        } else if (rJn !== jn || dJn !== jn) {                 /* 郡界：灰白细线（对角 2px） */
          put(X + 1, Y, 0xcfcfc0); put(X, Y + 1, 0xcfcfc0);
          put(X, Y, col); put(X + 1, Y + 1, col);
        } else {
          put(X, Y, col); put(X + 1, Y, col); put(X, Y + 1, col); put(X + 1, Y + 1, col);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    /* 城点：都城红 / 州城亮金 / 郡城米白（各带深色描边提升可读性） */
    var cityDot = function (cx, cy, w, fill, stroke) {
      var X = Math.round((cx + 0.5) / W * ui.MINI_PX) - Math.round(w / 2);
      var Y = Math.round((cy + 0.5) / W * ui.MINI_PX) - Math.round(w / 2);
      ctx.fillStyle = stroke; ctx.fillRect(X - 1, Y - 1, w + 2, w + 2);
      ctx.fillStyle = fill; ctx.fillRect(X, Y, w, w);
    };
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type === 'capital') cityDot(c.x, c.y, 6, '#ff5a40', '#3a0f08');
      else if (c.type === 'zhou') cityDot(c.x, c.y, 5, '#ffd76a', '#4a3208');
      else if (c.type === 'jun') cityDot(c.x, c.y, 3, '#f2ead0', '#3a3a2c');
    });
    ui._miniOff = cv; ui._miniSeed = s.map.seed;
    return cv;
  };
  ui.drawMini = function (canvas, size) { /* 打底 + 动态层（我城金点） */
    if (!canvas) return false;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx || !ctx.drawImage) return false;
    var off = ui.miniOff();
    if (!off) return false;
    var W = DATA.MAP_W;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(off, 0, 0, size, size);
    var s = GAME.state;
    (s.cities || []).forEach(function (c) {
      var pxx = (c.x + 0.5) / W * size, pyy = (c.y + 0.5) / W * size;
      ctx.beginPath();
      ctx.arc(pxx, pyy, Math.max(3, size / 110), 0, 6.2832);
      ctx.fillStyle = '#ffe9a0'; ctx.fill();
      ctx.lineWidth = Math.max(1, size / 500); ctx.strokeStyle = '#7a4a12'; ctx.stroke();
    });
    return true;
  };
  ui.paintMiniBottom = function () {      /* 底部条那枚 38px 小图 */
    var cv = $('#mini-canvas');
    if (!cv) return;
    try { ui.drawMini(cv, ui.MINI_PX); } catch (e) { /* 画布 stub 环境：静默跳过 */ }
  };
  ui.openMinimap = function () {          /* 「天下大势」面板 */
    ui.openModal(
      '<div class="gold-heading">🗺 天下大势</div>' +
      '<div class="mini-wrap"><canvas id="mini-big" width="' + ui.MINI_PX + '" height="' + ui.MINI_PX + '"></canvas></div>' +
      '<div class="mini-legend"><b class="lg-state">━</b> 州界　<b class="lg-jun">┄</b> 郡界　' +
        '<b class="lg-cap">■</b> 都城　<b class="lg-zhou">■</b> 州城　<b class="lg-jun-c">■</b> 郡城　' +
        '<b class="lg-me">●</b> 我城</div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
    var big = $('#mini-big');
    try { ui.drawMini(big, ui.MINI_PX); } catch (e) { }
  };

  /* 鼠标点选的地块（v44）：存 pick() 的结果，供状态行显示 */"""

print('== M1. map.js：miniBuild（州/郡归属派生） ==')
patch(
    MAP,
    '  /* 距离（曼哈顿） */\n})();',
    MINI_BUILD + '\n})();',
    'M1 map.miniBuild',
    probe='GAME.map.miniBuild = function',
)

print()
print('== M2. ui.js：缩略地图渲染层 ==')
patch(
    UI,
    '  /* 鼠标点选的地块（v44）：存 pick() 的结果，供状态行显示 */',
    MINI_UI,
    'M2 mini 渲染层',
    probe='ui.openMinimap = function',
)

print()
print('== M3. ui.js：paintBottom 拼装缩略图 ==')
patch(
    UI,
    """  /* 画底部条：有分页就画分页，没有就留一行极淡的占位（位置照留、高度不变） */
  ui.paintBottom = function () {
    var bar = $('#bottom-bar');
    if (!bar) return;
    var arr = ui._bottom || [];
    bar.innerHTML = arr.length ? arr.join('')
      : '<span class="bb-hint">—</span>';
  };""",
    """  /* 画底部条：有分页就画分页，没有就留一行极淡的占位（位置照留、高度不变）。
     v85（老板）：「底部导航栏增加一个缩略地图」—— 每次落画都**固定拼**一枚 38px
     缩略图（绝对定位在条尾，不参与居中排版），点击展开「天下大势」面板。
     ⚠ 它只能在 paintBottom 里拼 —— 若在某视图 _bottom.push，会被下一次落画覆盖。 */
  ui.paintBottom = function () {
    var bar = $('#bottom-bar');
    if (!bar) return;
    var arr = ui._bottom || [];
    bar.innerHTML = (arr.length ? arr.join('')
      : '<span class="bb-hint">—</span>')
      + '<button class="bb-mini" data-action="open-minimap" title="缩略地图：点击看天下大势">'
      + '<canvas id="mini-canvas" width="' + ui.MINI_PX + '" height="' + ui.MINI_PX + '"></canvas>'
      + '</button>';
    ui.paintMiniBottom();
  };""",
    'M3 paintBottom 拼缩略图',
    probe='data-action="open-minimap"',
)

print()
print('== M4. main.js：分发 case ==')
patch(
    MAIN,
    "      case 'map-goto': ui.mapGoto(); break;",
    "      case 'map-goto': ui.mapGoto(); break;\n      case 'open-minimap': ui.openMinimap(); break;",
    'M4 open-minimap case',
    probe="case 'open-minimap'",
)

print()
print('全部完成。')
