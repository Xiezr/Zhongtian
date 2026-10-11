/* 地形高度风格小样对比（离线渲染）
 * 用法：node .workbuddy/tools/show/sample_height.js
 * 产出：.workbuddy/shots/sample_step.png   （A · 阶梯方块 / Minecraft 式）
 *       .workbuddy/shots/sample_smooth.png （B · 平滑浮雕 / 坡度光影）
 * 说明：同一片地形、同一套方块化平涂材质，只比高度表现方式。只读游戏，不改产品代码。
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');

var SEED = 20260926;
var COLS = 48, ROWS = 30, CELL = 26, STEP = 9;   /* 一屏小样：48×30 格，每格 26px，每级高度 9px */

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
  }, SEED);
  await p.waitForTimeout(300);

  var out = await p.evaluate(function (o) {
    var G = window.GAME, DATA = G.DATA;
    var grid = G.state.map.grid, W = DATA.MAP_W, H = DATA.MAP_H, seed = G.state.map.seed;
    /* —— 复刻 map.js 的 fbm（高程场）—— */
    function nhash(ix, iy, salt) {
      var h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
      h = Math.imul(h ^ (h >>> 15), 0x2545f491); h ^= h >>> 13; return (h >>> 8) / 16777216;
    }
    function vnoise(x, y, step, salt) {
      var fx = x / step, fy = y / step, ix = Math.floor(fx), iy = Math.floor(fy);
      var tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = nhash(ix, iy, salt), b = nhash(ix + 1, iy, salt), c = nhash(ix, iy + 1, salt), d = nhash(ix + 1, iy + 1, salt);
      var t0 = a + (b - a) * tx, t1 = c + (d - c) * tx; return t0 + (t1 - t0) * ty;
    }
    var OCT = [[21, 0.55], [11, 0.30], [6, 0.15]];
    function fbm(x, y, salt) { var v = 0; for (var i = 0; i < OCT.length; i++) v += OCT[i][1] * vnoise(x, y, OCT[i][0], salt + i * 101); return v; }

    /* 方块化平涂材质：每种地形一个干净色 */
    var PAL = { plain: '#b8a86a', caoyuan: '#a9b45c', forest: '#5c7a3c', desert: '#d9c177',
      hill: '#9c938a', lake: '#4a7c9e', zhaoze: '#6c7c5c', city: '#c09355' };
    var COLS = o.cols, ROWS = o.rows, CELL = o.cell, STEP = o.step;
    var gx0 = Math.floor(W / 2 - COLS / 2), gy0 = Math.floor(H / 2 - ROWS / 2);
    var maxH = 0;

    /* 取每格：地形 + 高度级（elev 离散成台阶） */
    var cells = [];
    for (var gy = 0; gy < ROWS; gy++) {
      var row = [];
      for (var gx = 0; gx < COLS; gx++) {
        var wx = gx0 + gx, wy = gy0 + gy;
        var t = (grid[wy] && grid[wy][wx] && grid[wy][wx].terrain) || 'plain';
        var e = fbm(wx, wy, seed * 7 + 11);
        var h = Math.max(0, Math.min(7, Math.floor(e * 8.5)));
        if (t === 'lake') h = 0; else if (t === 'zhaoze') h = Math.min(h, 1);
        if (t === 'hill') h = Math.max(h, 4);
        row.push({ t: t, h: h, e: e });
        if (h > maxH) maxH = h;
      }
      cells.push(row);
    }
    var cw = COLS * CELL, ch = ROWS * CELL;

    function hex2rgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
    function shade(hex, k, addR, addG, addB) {
      var c = hex2rgb(hex);
      return 'rgb(' + Math.min(255, Math.round(c[0] * k + (addR || 0))) + ',' +
        Math.min(255, Math.round(c[1] * k + (addG || 0))) + ',' +
        Math.min(255, Math.round(c[2] * k + (addB || 0))) + ')';
    }

    /* ===== A · 阶梯方块（Minecraft 式）===== */
    var cA = document.createElement('canvas'); cA.width = cw; cA.height = ch + maxH * STEP; var a = cA.getContext('2d');
    a.fillStyle = '#2b2a24'; a.fillRect(0, 0, cA.width, cA.height);
    for (var y2 = 0; y2 < ROWS; y2++) {
      for (var x2 = 0; x2 < COLS; x2++) {
        var c = cells[y2][x2], col = PAL[c.t] || '#888';
        var px = x2 * CELL, ground = y2 * CELL, top = ground - c.h * STEP;
        if (c.h > 0) {                                    /* 崖壁：地形色压暗 + 上亮下暗 */
          var g = a.createLinearGradient(0, top + CELL, 0, ground + CELL);
          g.addColorStop(0, shade(col, 0.62)); g.addColorStop(1, shade(col, 0.34));
          a.fillStyle = g; a.fillRect(px, top + CELL, CELL, c.h * STEP);
        }
        a.fillStyle = shade(col, 1.02);
        a.fillRect(px, top, CELL, CELL);                  /* 顶面 */
        a.fillStyle = 'rgba(255,255,255,.10)'; a.fillRect(px, top, CELL, 2);       /* 顶面上高光 */
        a.fillStyle = 'rgba(0,0,0,.20)'; a.fillRect(px, top + CELL - 2, CELL, 2);  /* 顶面下 AO */
      }
    }

    /* ===== B · 平滑浮雕（坡度光影 · 无格界）===== */
    var cB = document.createElement('canvas'); cB.width = cw; cB.height = ch; var bctx = cB.getContext('2d');
    bctx.fillStyle = '#2b2a24'; bctx.fillRect(0, 0, cw, ch);
    function heightPx(px, py) {                            /* 像素级双线性高度（连续） */
      var fx = px / CELL, fy = py / CELL;
      var ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      function hh(x, y) { x = Math.max(0, Math.min(COLS - 1, x)); y = Math.max(0, Math.min(ROWS - 1, y)); return cells[y][x].e; }
      var h00 = hh(ix, iy), h10 = hh(ix + 1, iy), h01 = hh(ix, iy + 1), h11 = hh(ix + 1, iy + 1);
      return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
    }
    var img = bctx.createImageData(cw, ch);
    for (var py = 0; py < ch; py++) {
      for (var pxx = 0; pxx < cw; pxx++) {
        var e0 = heightPx(pxx, py);
        var dx = heightPx(pxx + 2, py) - heightPx(pxx - 2, py);
        var dy = heightPx(pxx, py + 2) - heightPx(pxx, py - 2);
        var lam = 1 + (dx * 3.0 - dy * 4.5) * 6;          /* 左上光 → 坡面明暗 */
        lam = Math.max(0.45, Math.min(1.6, lam));
        var t2 = cells[Math.min(ROWS - 1, py / CELL | 0)][Math.min(COLS - 1, pxx / CELL | 0)].t;
        var base = hex2rgb(PAL[t2] || '#888');
        var o = (py * cw + pxx) * 4;
        img.data[o] = Math.min(255, base[0] * lam | 0);
        img.data[o + 1] = Math.min(255, base[1] * lam | 0);
        img.data[o + 2] = Math.min(255, base[2] * lam | 0);
        img.data[o + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);

    return { step: cA.toDataURL('image/png'), smooth: cB.toDataURL('image/png'), maxH: maxH };
  }, { cols: COLS, rows: ROWS, cell: CELL, step: STEP });

  fs.writeFileSync('.workbuddy/shots/sample_step.png', Buffer.from(out.step.replace(/^data:image\/png;base64,/, ''), 'base64'));
  fs.writeFileSync('.workbuddy/shots/sample_smooth.png', Buffer.from(out.smooth.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('maxH=' + out.maxH + ' SAMPLE-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
