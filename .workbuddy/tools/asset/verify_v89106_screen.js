/* ============================================================
 * verify_v89106_screen.js — **屏幕上**的配色体检（不是素材、不是源码，是渲染结果）
 * ------------------------------------------------------------
 * 为什么还要这一道：素材改了色，不等于**玩家看到**的就是那个色 ——
 * CSS 滤镜、覆盖层、主题变量、图标缩放都可能在中途改色（v39~v43 就是这么栽的）。
 * 做法：真机截图 → 按每个地块图标的 bounding box 裁像素 → 剔除地面底色 →
 *       算每族**屏幕实测**均值色 → 两两 ΔE00（这就是玩家眼里的"分不分得出"）。
 * 用法：node .workbuddy/tools/asset/verify_v89106_screen.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var PNG;
try { PNG = require('pngjs').PNG; } catch (e) { PNG = require('pngjs').PNG; }

/* ---- ΔE00（与 recolor_bldg_icons.js / smoke-test.js 同一套，三处一字不差） ---- */
function srgb2lab(c) {
  function f(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  var r = f(c[0]), g = f(c[1]), b = f(c[2]);
  var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  var y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  var z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  function h(t) { return t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116; }
  var fx = h(x), fy = h(y), fz = h(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function de00(c1, c2) {
  var A = srgb2lab(c1), B = srgb2lab(c2);
  var L1 = A[0], a1 = A[1], b1 = A[2], L2 = B[0], a2 = B[1], b2 = B[2];
  var C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  var G = Cb > 0 ? 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7)))) : 0;
  var a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  var C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  var h1p = Math.atan2(b1, a1p) * 180 / Math.PI; if (h1p < 0) h1p += 360;
  var h2p = Math.atan2(b2, a2p) * 180 / Math.PI; if (h2p < 0) h2p += 360;
  var dLp = L2 - L1, dCp = C2p - C1p, dhp = 0;
  if (C1p * C2p !== 0) dhp = (h2p - h1p + 180) % 360 - 180;
  var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);
  var Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2, hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;
  var T = 1 - 0.17 * Math.cos((hbp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * hbp * Math.PI / 180)
    + 0.32 * Math.cos((3 * hbp + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * hbp - 63) * Math.PI / 180);
  var dTh = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  var Rc = Cbp > 0 ? 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7))) : 0;
  var Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  var Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  var Rt = -Math.sin(2 * dTh * Math.PI / 180) * Rc;
  return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2)
    + Rt * (dCp / Sc) * (dHp / Sh));
}
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  var h = 0, s = 0, l = (mx + mn) / 2;
  if (d > 1e-9) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

var GROUND = [0x8b, 0x9a, 0x78];

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var boxes = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '灰岗', region: '碎垣', mapSeed: 20260923 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    var order = ['minfang', 'kezhan', 'cangku', 'majiu', 'shuyuan', 'zhaoxianguan',
      'junying', 'xiaochang', 'chengqiang', 'fenghuotai',
      'shichang', 'tiejiangpu', 'gongjiangzuofang', 'yizhan', 'honglusi'];
    var free = [];
    c.cells.forEach(function (x, i) { if (!x.official) free.push(i); });
    order.forEach(function (bid, k) { c.cells[free[k]].build = { id: bid, lvl: 3 }; });
    G.ui.enterGame();
    G.ui.setView('city');
    G.refreshAll();
    /* 等一帧，让 img 有尺寸 */
    var out = [];
    document.querySelectorAll('#view-container .iso-tile.built').forEach(function (el) {
      var img = el.querySelector('img.ico-img');
      if (!img) return;
      var r = img.getBoundingClientRect();
      var nm = el.querySelector('.tile-label .nm');
      var ser = (el.className.match(/ser-[a-z]+/) || ['-'])[0];
      var bid = '';
      var idx = Number(el.dataset.idx);
      var cell = G.currentCity().cells[idx];
      if (cell && cell.build) bid = cell.build.id;
      out.push({ id: bid, ser: ser.replace('ser-', ''), name: nm ? nm.textContent : '?',
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    });
    return out;
  });

  await new Promise(function (r) { setTimeout(r, 600); });
  var shot = await page.screenshot({ fullPage: false });
  var png = PNG.sync.read(shot);
  console.log('截图 ' + png.width + '×' + png.height + '，地块 ' + boxes.length + ' 个');

  /* 逐图标取像素：**取核心区**（bbox 正中 56%）+ 剔除"接近地面"的像素。
     为什么必须取核心：图标 76px、边缘是抗锯齿的软边，与绿色地面混色后
     均值会被拖向地面（实测把 米白民居 拖到 ΔE00 7.4 —— 那是量测口径的锅，
     眼睛看的是"建筑本体那一大块"。核心区口径 = 那一大块。） */
  function iconPixels(b) {
    var acc = [], n = 0;
    var cw = b.w * 0.56, ch = b.h * 0.56;
    var x0 = Math.max(0, Math.round(b.x + (b.w - cw) / 2));
    var x1 = Math.min(png.width, Math.round(b.x + (b.w + cw) / 2));
    var y0 = Math.max(0, Math.round(b.y + (b.h - ch) / 2 - b.h * 0.06));   /* 略上移：躲开底部光池 */
    var y1 = Math.min(png.height, Math.round(b.y + (b.h + ch) / 2 - b.h * 0.06));
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var i = (y * png.width + x) << 2;
        var c = [png.data[i], png.data[i + 1], png.data[i + 2]];
        if (de00(c, GROUND) < 22) continue;                 /* 地面 / 底噪 → 不算建筑本体 */
        acc.push(c); n++;
      }
    }
    if (!n) return null;
    var sx = 0, sy = 0, ss = 0, sl = 0;
    acc.forEach(function (c) {
      var h = rgb2hsl(c[0], c[1], c[2]);
      var rad = h[0] * Math.PI / 180;
      sx += Math.cos(rad) * h[1]; sy += Math.sin(rad) * h[1];
      ss += h[1]; sl += h[2];
    });
    var hue = Math.atan2(sy / n, sx / n) * 180 / Math.PI; if (hue < 0) hue += 360;
    var avg = [0, 1, 2].map(function (k) {
      return Math.round(acc.reduce(function (t, c) { return t + c[k]; }, 0) / n);
    });
    /* 强调色 = 最饱和四分位的均值 —— 材质高光/彩绘都在这里（均值口径抓不到 10% 的小色块） */
    var bySat = acc.slice().sort(function (x, y) {
      return rgb2hsl(y[0], y[1], y[2])[1] - rgb2hsl(x[0], x[1], x[2])[1];
    }).slice(0, Math.max(1, Math.round(n * 0.25)));
    var acc2 = [0, 1, 2].map(function (k) {
      return Math.round(bySat.reduce(function (t, c) { return t + c[k]; }, 0) / bySat.length);
    });
    return { hue: hue, sat: ss / n, lum: sl / n, n: n, rgb: avg, accent: acc2 };
  }

  var fam = {};
  boxes.forEach(function (b) {
    var st = iconPixels(b);
    if (!st) { console.log('  ⚠ ' + b.name + '（' + b.w + '×' + b.h + '）取不到建筑像素'); return; }
    (fam[b.ser] = fam[b.ser] || []).push({ id: b.id, name: b.name, st: st });
  });
  console.log('\n-- 屏幕实测：逐格（建筑本体**核心区**像素） --');
  boxes.forEach(function (b) { console.log('  bbox ' + b.name.padEnd(6) + ' ' + b.w + '×' + b.h + 'px'); });
  console.log('');
  Object.keys(fam).sort().forEach(function (s) {
    fam[s].forEach(function (o) {
      console.log('  ' + s.padEnd(6) + o.name.padEnd(6) + ' 色相 ' + String(Math.round(o.st.hue)).padStart(3)
        + '° 饱和 ' + String(Math.round(o.st.sat * 100)).padStart(2) + '% 明度 '
        + String(Math.round(o.st.lum * 100)).padStart(2) + '%  rgb(' + o.st.rgb.join(',') + ')  ' + o.st.n + 'px');
    });
  });
  var keys = Object.keys(fam).sort(), rep = {}, repACC = {};
  keys.forEach(function (k) {
    var all = [], acc = [];
    fam[k].forEach(function (o) { all.push(o.st.rgb); acc.push(o.st.accent); });
    rep[k] = [0, 1, 2].map(function (i) {
      return Math.round(all.reduce(function (t, c) { return t + c[i]; }, 0) / all.length);
    });
    repACC[k] = [0, 1, 2].map(function (i) {
      return Math.round(acc.reduce(function (t, c) { return t + c[i]; }, 0) / acc.length);
    });
  });
  console.log('\n-- 屏幕实测：族代表色（各族所有格 rgb 平均）--');
  keys.forEach(function (k) { console.log('  ' + k.padEnd(6) + 'rgb(' + rep[k].join(',') + ')'); });
  var rows = [], mn = 999, pair = '';
  for (var i = 0; i < keys.length; i++) {
    for (var j = i + 1; j < keys.length; j++) {
      var d = de00(rep[keys[i]], rep[keys[j]]);
      rows.push('  ' + (keys[i] + '/' + keys[j]).padEnd(14) + d.toFixed(1) + (d < 15 ? '  <<< 太近' : ''));
      if (d < mn) { mn = d; pair = keys[i] + '/' + keys[j]; }
    }
  }
  console.log('\n-- 屏幕实测：族间 ΔE00 --');
  rows.forEach(function (r) { console.log(r); });
  console.log('\n-- 屏幕实测：各族与城内地面 #8b9a78 的 ΔE00（<12 = 糊进地里）--');
  var gmn = 999, gw = '';
  keys.forEach(function (k) {
    var d = de00(rep[k], GROUND);
    if (d < gmn) { gmn = d; gw = k; }
    console.log('  ' + k.padEnd(6) + d.toFixed(1) + (d < 12 ? '  <<< 糊进地面' : ''));
  });
  console.log('\n-- 屏幕实测：**强调色**（最饱和四分位 = 材质高光/彩绘）族间 ΔE00 --');
  var amn = 999, apair = '';
  for (var a1 = 0; a1 < keys.length; a1++) {
    for (var a2 = a1 + 1; a2 < keys.length; a2++) {
      var ad = de00(repACC[keys[a1]], repACC[keys[a2]]);
      if (ad < amn) { amn = ad; apair = keys[a1] + '/' + keys[a2]; }
    }
  }
  console.log('  最小 ΔE00（强调色）= ' + amn.toFixed(1) + '（' + apair + '）'
    + (amn >= 15 ? '  ✅ 族色可辨' : '  ⚠ 偏近'));
  console.log('\n  ** 屏幕最小族间 ΔE00 = ' + mn.toFixed(1) + '（' + pair + '）**');
  console.log('  ** 屏幕最小与地面 ΔE00 = ' + gmn.toFixed(1) + '（' + gw + '）**');
  await browser.close();
  process.exit(mn >= 15 && gmn >= 12 ? 0 : 1);
})().catch(function (e) { console.error('失败：' + (e && e.stack || e)); process.exit(2); });
