'use strict';
/* v89.225 实机探针：城视图现状（建筑旗渲染 + 地块底色）
   跑法：node .workbuddy/tools/show/shot_v89225_city.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验225', cityName: '灰岗', region: '碎垣', mapSeed: 20260951 });
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    G.ui.setView('city');
    G.ui.renderView('city');
    /* 找几座代表性建筑格的 DOM 位置 */
    var want = { kezhan: -1, zhaoxianguan: -1, junying: -1, xiaochang: -1, guanfu: -1, shichang: -1 };
    c.cells.forEach(function (x, i) { if (x.build && want[x.build.id] === -1) want[x.build.id] = i; });
    return { want: want, cellsN: c.cells.length };
  });
  console.log('造局: ' + JSON.stringify(r1));
  await p.waitForTimeout(500);

  /* 收集 DOM 状态 */
  var d1 = await p.evaluate(function () {
    var G = window.GAME;
    var board = document.querySelector('#view-container .iso-board') || document.querySelector('.iso-board');
    var out = { boardFound: !!board, tiles: [] };
    if (!board) return out;
    var tiles = board.querySelectorAll('.iso-tile.built');
    for (var i = 0; i < tiles.length && i < 20; i++) {
      var t = tiles[i];
      var img = t.querySelector('img.ico-img');
      var face = t.querySelector('.tile-face');
      var cs = window.getComputedStyle(face);
      out.tiles.push({
        idx: t.getAttribute('data-idx'), cls: t.className.replace('iso-tile', '').trim(),
        img: img ? img.getAttribute('src').split('/').pop() : null,
        faceBg: cs.backgroundColor
      });
    }
    var br = board.getBoundingClientRect();
    out.boardRect = { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) };
    return out;
  });
  console.log('DOM: ' + JSON.stringify(d1, null, 1).slice(0, 3000));

  /* 棋盘元素截图 */
  var board = await p.$('#view-container .iso-board') || await p.$('.iso-board');
  if (board) {
    await board.screenshot({ path: '.workbuddy/shots/v89225-city-board.png' });
    console.log('  截图: .workbuddy/shots/v89225-city-board.png');
  } else {
    await p.screenshot({ path: '.workbuddy/shots/v89225-city-board.png' });
    console.log('  截图（全屏回退）: .workbuddy/shots/v89225-city-board.png');
  }
  await p.screenshot({ path: '.workbuddy/shots/v89225-city-full.png' });

  /* 像素分析：找高饱和色块（旗特征），按色相分组统计 */
  function hueOf(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return -1;
    var h;
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    return h;
  }
  var png = PNG.sync.read(fs.readFileSync('.workbuddy/shots/v89225-city-board.png'));
  var bins = new Array(36).fill(0);
  var n = png.width * png.height;
  for (var i = 0; i < png.data.length; i += 4) {
    var r = png.data[i], g = png.data[i + 1], bl = png.data[i + 2];
    var mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
    var l = (mx + mn) / 2 / 255;
    var s = mx === mn ? 0 : (l < 0.5 ? (mx - mn) / (mx + mn) : (mx - mn) / (510 - mx - mn));
    if (s > 0.45 && l > 0.2 && l < 0.85) {
      var h = hueOf(r, g, bl);
      if (h >= 0) bins[Math.floor(h / 10) % 36]++;
    }
  }
  console.log('棋盘像素尺寸 ' + png.width + 'x' + png.height);
  console.log('高饱和色相分布（前 8）:');
  bins.map(function (v, k) { return [k * 10, v]; }).sort(function (a, bb) { return bb[1] - a[1]; }).slice(0, 8)
    .forEach(function (t) { console.log('   ' + t[0] + '°: ' + t[1] + ' px'); });

  console.log('运行期错误: ' + (errs.length ? errs.join(' ; ') : '无'));
  await b.close();
  process.exit(0);
})();
