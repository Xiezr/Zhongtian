'use strict';
/* v156.34 探针：星球自转中的「半径闪烁」
   ------------------------------------------------------------
   做法：进地图页（3D）→ 强制起转 → 连拍 N 帧（只拍 canvas）→
   逐帧量「球体左右边缘列」与「非背景像素数」，看轮廓半径是不是逐帧在跳。
   判据（数值化，不靠肉眼）：
     · 边缘列在相邻帧间抖动 > 2px  → 轮廓半径真的在变（几何/投影问题）
     · 轮廓稳定但亮像素数抖动明显   → 是"面上"在闪（排序 / z-fighting）
   ------------------------------------------------ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var path = require('path');
var { PNG } = require('pngjs');

var N = Number(process.argv[2] || 8);
var GAP = Number(process.argv[3] || 130);
var OUT = '.workbuddy/shots/flick';
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

function measure(file) {
  var png = PNG.sync.read(fs.readFileSync(file));
  var w = png.width, h = png.height, d = png.data;
  /* 背景 = 星空（极暗）。阈值 26：既排除星空噪点，又不把暗色地表判成背景。 */
  var TH = 26;
  var colCount = new Int32Array(w);
  var lit = 0;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum > TH) { colCount[x]++; lit++; }
    }
  }
  /* 边缘列：某列亮像素 ≥ 高度的 8% 才算"球体覆盖到这一列" */
  var need = Math.max(3, h * 0.08);
  var left = -1, right = -1;
  for (var cx = 0; cx < w; cx++) if (colCount[cx] >= need) { left = cx; break; }
  for (var cx2 = w - 1; cx2 >= 0; cx2--) if (colCount[cx2] >= need) { right = cx2; break; }
  return { w: w, h: h, lit: lit, left: left, right: right, diam: (right - left + 1) };
}

(async function () {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '闪', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
  });
  await p.waitForFunction(function () { var o = document.getElementById('boot-loading'); return !o || !o.classList.contains('on'); }, null, { timeout: 120000 });
  await p.waitForTimeout(1800);
  /* 强制进入自转态：_lastAct 归零 = "已静止 10 秒以上" */
  await p.evaluate(function () { GAME.map3d._lastAct = 0; });
  await p.waitForTimeout(500);

  var canvas = await p.$('#mapCanvas');
  if (!canvas) { console.log('NO CANVAS'); await b.close(); return; }
  var box = await canvas.boundingBox();
  console.log('canvas ' + Math.round(box.width) + '×' + Math.round(box.height));

  var shots = [];
  for (var k = 0; k < N; k++) {
    var f = path.join(OUT, 'f' + String(k + 1).padStart(2, '0') + '.png');
    await canvas.screenshot({ path: f });
    shots.push({ f: f, t: Date.now() });
    await p.waitForTimeout(GAP);
  }
  await b.close();

  console.log('\n帧   t(ms)     亮像素     左边缘  右边缘  直径');
  var rows = shots.map(function (s, i) {
    var m = measure(s.f);
    return { i: i + 1, t: s.t, ...m };
  });
  rows.forEach(function (r) {
    console.log(' ' + String(r.i).padStart(2) + '  '
      + String(r.t % 100000).padStart(7) + '  '
      + String(r.lit).padStart(8) + '  ' + String(r.left).padStart(6) + '  '
      + String(r.right).padStart(6) + '  ' + String(r.diam).padStart(5));
  });
  var diam = rows.map(function (r) { return r.diam; });
  var lit = rows.map(function (r) { return r.lit; });
  var dMin = Math.min.apply(null, diam), dMax = Math.max.apply(null, diam);
  var lMin = Math.min.apply(null, lit), lMax = Math.max.apply(null, lit);
  console.log('\n直径 ' + dMin + '~' + dMax + '（跨度 ' + (dMax - dMin) + 'px，'
    + ((dMax - dMin) / dMax * 100).toFixed(2) + '%）');
  console.log('亮像素 ' + lMin + '~' + lMax + '（跨度 ' + ((lMax - lMin) / lMax * 100).toFixed(2) + '%）');
  console.log('页面异常 ' + (errs.length ? errs.join(' | ') : '无'));
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
