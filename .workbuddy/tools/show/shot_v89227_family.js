'use strict';
/* v89.227 实机验证：城内地块 4 族降饱和（官府/民生/军事/城务）+ 实测渲染色
   ⚠️ v89.229 起族色已从地块迁到「名称文字色块」——本脚本的地块色判据失效（保留为
   历史仪器）；现行验证见 shot_v89229_family.js。
   跑法：node .workbuddy/tools/show/shot_v89227_family.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
var EXPECT = {
  gov: [154, 150, 132],   /* #9a9684 官府 */
  live: [131, 118, 109],  /* #83766d 民生 */
  mil: [106, 113, 129],   /* #6a7181 军事 */
  ops: [111, 133, 130],   /* #6f8582 城务 */
};
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 造局：4 族共 14 种建筑铺进前 14 格（含老板点名两对：酒馆+招募站 / 训练营+练兵场） */
  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验227', cityName: '灰岗', region: '碎垣', mapSeed: 20260952 });
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var want = [
      'honglusi',                                                       /* gov */
      'minfang', 'cangku', 'majiu', 'yizhan',                           /* live */
      'junying', 'xiaochang', 'fenghuotai',                             /* mil */
      'kezhan', 'zhaoxianguan', 'shuyuan', 'shichang', 'tiejiangpu', 'gongjiangzuofang' /* ops */
    ];
    var used = 0;
    c.cells.forEach(function (x, i) {
      if (used >= want.length) return;
      if (x.official || x.build || x.pending) return;
      x.build = { id: want[used], lvl: 3, hiLv: 3 };
      used++;
    });
    G.ui.setView('city'); G.ui.renderView('city');
    return { used: used, cells: c.cells.length };
  });
  console.log('造局: ' + JSON.stringify(r1));
  await p.waitForTimeout(700);

  /* 读 4 族格的 .tile-face 计算渲染色 + 各类格子的 ser 归属 */
  var m = await p.evaluate(function () {
    var G = window.GAME;
    var board = document.querySelector('#view-container .iso-board') || document.querySelector('.iso-board');
    if (!board) return { err: 'no-board' };
    var out = {}, perBld = {};
    var tiles = board.querySelectorAll('.iso-tile.built');
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var cls = t.className.match(/ser-(\w+)/);
      if (!cls) continue;
      var ser = cls[1];
      var face = t.querySelector('.tile-face');
      if (!face) continue;
      var bg = window.getComputedStyle(face).backgroundColor;
      var mm = bg.match(/rgb\((\d+), (\d+), (\d+)\)/);
      if (!out[ser]) out[ser] = { rgb: mm ? [ +mm[1], +mm[2], +mm[3] ] : null, cls: t.className.trim() };
      /* 记录每格建筑（title 或 data-idx 无法直读——用可见文本兜底不做；改为格数与族数对照） */
      perBld[ser] = (perBld[ser] || 0) + 1;
    }
    var br = board.getBoundingClientRect();
    out._board = { w: Math.round(br.width), h: Math.round(br.height) };
    out._counts = perBld;
    return out;
  });
  console.log('族色读数: ' + JSON.stringify(m));

  /* 逐族断言 */
  Object.keys(EXPECT).forEach(function (k) {
    var got = m[k];
    var ok = got && got.rgb && Math.abs(got.rgb[0] - EXPECT[k][0]) <= 1
      && Math.abs(got.rgb[1] - EXPECT[k][1]) <= 1 && Math.abs(got.rgb[2] - EXPECT[k][2]) <= 1;
    chk('族 ' + k + ' 地块渲染色 = ' + EXPECT[k].join('/'), ok, got ? JSON.stringify(got.rgb) : '缺失');
  });
  chk('4 族格全部在渲染产物里', Object.keys(EXPECT).every(function (k) { return !!m[k]; }),
    Object.keys(m).filter(function (k) { return k[0] !== '_'; }).join(','));
  chk('族格计数 ≥ 铺装下限（live≥4 mil≥3 ops≥6 gov≥1 · 初始城自带建筑可叠加）', m._counts
    && m._counts.live >= 4 && m._counts.mil >= 3 && m._counts.ops >= 6 && m._counts.gov >= 1,
    JSON.stringify(m._counts));

  /* 截图（棋盘 + 全屏） */
  var board = await p.$('#view-container .iso-board') || await p.$('.iso-board');
  if (board) {
    await board.screenshot({ path: '.workbuddy/shots/v89227-family-board.png' });
    console.log('  截图: .workbuddy/shots/v89227-family-board.png');
  }
  await p.screenshot({ path: '.workbuddy/shots/v89227-family-full.png' });

  /* 像素核验：从棋盘截图里数"4 族渲染色"的像素数（证明真的画出来了） */
  var shot = PNG.sync.read(fs.readFileSync('.workbuddy/shots/v89227-family-board.png'));
  var counts = {};
  for (var i = 0; i < shot.data.length; i += 4) {
    var r = shot.data[i], g = shot.data[i + 1], bl = shot.data[i + 2];
    Object.keys(EXPECT).forEach(function (k) {
      var e = EXPECT[k];
      if (Math.abs(r - e[0]) <= 2 && Math.abs(g - e[1]) <= 2 && Math.abs(bl - e[2]) <= 2) {
        counts[k] = (counts[k] || 0) + 1;
      }
    });
  }
  console.log('棋盘像素统计（各族渲染色的精确命中）: ' + JSON.stringify(counts));
  var allHit = Object.keys(EXPECT).every(function (k) { return (counts[k] || 0) >= 500; });
  chk('像素层：4 族渲染色在棋盘上都"画出来了"（各 ≥500px 精确命中）', allHit, JSON.stringify(counts));

  chk('运行期无页面错误', errs.length === 0, errs.slice(0, 2).join(' ; '));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
