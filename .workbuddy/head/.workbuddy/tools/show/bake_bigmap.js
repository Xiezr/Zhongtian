/* 大地图烘焙 + 改前基线实机图
 * 用法：node .workbuddy/tools/show/bake_bigmap.js
 * 产出：
 *   .workbuddy/shots/bigmap_bake.png     —— 500×500 全域地形烘焙图（每格取该地形贴图均色）
 *   .workbuddy/shots/live_map_before.png —— 当前实机地图（同一局/同机位，作对照基线）
 * 说明：只读游戏，不改任何产品代码。
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');

var SEED = 20260926;
var PX = 4;            /* 每格像素：500×4 = 2000×2000 输出 */
var BLUR = 5;          /* 柔化半径 px：让地形连成"一张画"而不是色块 */
var OUT = 'assets/icons/ui/bigmap_world.png';   /* 落位到游戏素材 */

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
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.refreshAll();
  }, SEED);

  var dataUrl = await p.evaluate(function (o) {
    var px = o.px, blur = o.blur;
    var G = window.GAME, DATA = G.DATA;
    var grid = G.state.map.grid, W = DATA.MAP_W, H = DATA.MAP_H;
    var terrains = ['plain', 'caoyuan', 'zhaoze', 'lake', 'forest', 'desert', 'hill'];
    var col = { city: [150, 120, 70] };

    function avgOf(t) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {
          var s = document.createElement('canvas'); s.width = 8; s.height = 8;
          var sc = s.getContext('2d'); sc.drawImage(im, 0, 0, 8, 8);
          var d = sc.getImageData(0, 0, 8, 8).data, r = 0, g = 0, bl = 0, n = 0;
          for (var i = 0; i < d.length; i += 4) { if (d[i + 3] > 40) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; } }
          res(n ? [r / n | 0, g / n | 0, bl / n | 0] : [128, 128, 128]);
        };
        im.onerror = function () { res([128, 128, 128]); };
        im.src = 'assets/icons/ui/ai_terrain_' + t + '.png';
      });
    }

    return Promise.all(terrains.map(avgOf)).then(function (cols) {
      terrains.forEach(function (t, i) { col[t] = cols[i]; });
      var cv = document.createElement('canvas');
      cv.width = W * px; cv.height = H * px;
      var ctx = cv.getContext('2d');
      for (var y = 0; y < H; y++) {
        var row = grid[y];
        for (var x = 0; x < W; x++) {
          var t = (row[x] && row[x].terrain) || 'plain';
          var c = col[t] || [128, 128, 128];
          ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
          ctx.fillRect(x * px, y * px, px, px);
        }
      }
      /* 柔化：让地形连成一张画，而非逐格色块（同地形内看不见网格） */
      if (blur > 0) {
        var cv2 = document.createElement('canvas');
        cv2.width = cv.width; cv2.height = cv.height;
        var c2 = cv2.getContext('2d');
        c2.filter = 'blur(' + blur + 'px)';
        c2.drawImage(cv, 0, 0);
        cv = cv2;
      }
      var cnt = {};
      for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
        var tt = (grid[yy][xx] && grid[yy][xx].terrain) || 'plain';
        cnt[tt] = (cnt[tt] || 0) + 1;
      }
      console.log('TERRAIN-COUNT ' + JSON.stringify(cnt));
      console.log('COLORS ' + JSON.stringify(col));
      return cv.toDataURL('image/png');
    });
  }, { px: PX, blur: BLUR });

  fs.writeFileSync(OUT,
    Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  fs.copyFileSync(OUT, '.workbuddy/shots/bigmap_bake.png');
  console.log('WROTE ' + OUT);

  try {
    await p.evaluate(function () { GAME.ui.setView('map'); });
    await p.waitForTimeout(900);
    await p.screenshot({ path: '.workbuddy/shots/live_map_before.png' });
  } catch (e) { console.log('shot warn: ' + (e && e.message)); }

  console.log('BAKE-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
