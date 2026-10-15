'use strict';
/* v89.229 实机验证：城视图 —— 地块统一浅废土底 · 名称/等级都在格顶 · 名称文字色块承载族色
   跑法：node .workbuddy/tools/show/shot_v89229_family.js */
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
/* 默认主题（墨玉）期望值 */
var GROUND = [168, 160, 139];   /* #a8a08b 浅废土沙 */
var BLOCK = {
  gov: [134, 111, 39],   /* #866f27 官府 · 旧币 */
  live: [145, 79, 59],   /* #914f3b 民生 · 砖陶 */
  mil: [64, 90, 150],    /* #405a96 军事 · 钢蓝 */
  ops: [55, 129, 114],   /* #378172 城务 · 铜青 */
};
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 造局：4 族共 14 种建筑铺进前 14 格 */
  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验229', cityName: '灰岗', region: '碎垣', mapSeed: 20260953 });
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var want = [
      'honglusi',
      'minfang', 'cangku', 'majiu', 'yizhan',
      'junying', 'xiaochang', 'fenghuotai',
      'kezhan', 'zhaoxianguan', 'shuyuan', 'shichang', 'tiejiangpu', 'gongjiangzuofang'
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

  /* 读数：① 地块统一底色 ② 名称色块族色 ③ 位置（顶部）④ 文字白色 ⑤ badge 并入名称行 */
  var m = await p.evaluate(function () {
    var board = document.querySelector('#view-container .iso-board') || document.querySelector('.iso-board');
    if (!board) return { err: 'no-board' };
    var tiles = board.querySelectorAll('.iso-tile.built');
    var faceBgs = {}, blockBgs = {}, topFlags = [], textColors = [], badgeIn = 0, labelN = 0, sample = '';
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var face = t.querySelector('.tile-face');
      if (face) {
        var fb = window.getComputedStyle(face).backgroundColor;
        faceBgs[fb] = (faceBgs[fb] || 0) + 1;
      }
      var lab = t.querySelector('.tile-label');
      var nm = t.querySelector('.tile-label .nm');
      if (lab && nm) {
        labelN++;
        var nb = window.getComputedStyle(nm).backgroundColor;
        blockBgs[nb] = (blockBgs[nb] || 0) + 1;
        var tr = t.getBoundingClientRect(), nr = nm.getBoundingClientRect();
        topFlags.push(nr.top + nr.height / 2 < tr.top + tr.height / 2);   /* 名称在格上半区 = 顶部 */
        textColors.push(window.getComputedStyle(nm).color);
        var badge = lab.querySelector('.tile-badge');
        if (badge) badgeIn++;
        if (!sample) sample = nm.textContent + ' / ' + (badge ? badge.textContent : '—');
      }
    }
    return {
      faceBgKinds: Object.keys(faceBgs).length, faceBgs: faceBgs,
      blockBgs: blockBgs, labelN: labelN, badgeIn: badgeIn,
      topAll: topFlags.length > 0 && topFlags.every(Boolean),
      textWhiteAll: textColors.length > 0 && textColors.every(function (c) { return c === 'rgb(255, 255, 255)'; }),
      sample: sample
    };
  });
  console.log('读数: ' + JSON.stringify(m).slice(0, 460));

  /* ① 地块统一浅废土底（单一颜色 + 值正确 + 无族色残留） */
  var faceOK = m.faceBgKinds === 1 && m.faceBgs['rgb(' + GROUND.join(', ') + ')'];
  chk('地块统一浅废土底 #a8a08b（全 built 格同一色 · 无族色残留）', faceOK,
    '色种=' + m.faceBgKinds + ' ' + JSON.stringify(m.faceBgs));

  /* ② 名称色块 = 4 族新色值（逐字节） */
  Object.keys(BLOCK).forEach(function (k) {
    var want = 'rgb(' + BLOCK[k].join(', ') + ')';
    var got = m.blockBgs[want] || 0;
    chk('名称色块 ' + k + ' = rgb(' + BLOCK[k].join(',') + ') 且 ≥1 格', got >= 1, got + ' 格命中该色');
  });
  /* ③ 所有名称/等级都在格顶 + ④ 白字 + ⑤ badge 并入 */
  chk('名称位于格顶（全部 built 格 · 上半区判据）', m.topAll === true, '标签数=' + m.labelN);
  chk('名称文字白（四主题恒白 · var(--on-block)）', m.textWhiteAll === true, '');
  chk('等级角标并入名称行（.tile-label 内含 badge）', m.badgeIn >= m.labelN - 1, m.badgeIn + '/' + m.labelN + ' · 样例「' + m.sample + '」');

  /* 截图 */
  var board = await p.$('#view-container .iso-board') || await p.$('.iso-board');
  if (board) {
    await board.screenshot({ path: '.workbuddy/shots/v89229-family-board.png' });
    console.log('  截图: .workbuddy/shots/v89229-family-board.png');
  }
  await p.screenshot({ path: '.workbuddy/shots/v89229-family-full.png' });

  /* 像素核验：名称色块四色 + 地面色都在棋盘图上 */
  var shot = PNG.sync.read(fs.readFileSync('.workbuddy/shots/v89229-family-board.png'));
  var counts = { ground: 0 };
  Object.keys(BLOCK).forEach(function (k) { counts[k] = 0; });
  for (var i = 0; i < shot.data.length; i += 4) {
    var r = shot.data[i], g = shot.data[i + 1], bl = shot.data[i + 2];
    if (Math.abs(r - GROUND[0]) <= 2 && Math.abs(g - GROUND[1]) <= 2 && Math.abs(bl - GROUND[2]) <= 2) counts.ground++;
    Object.keys(BLOCK).forEach(function (k) {
      var e = BLOCK[k];
      if (Math.abs(r - e[0]) <= 2 && Math.abs(g - e[1]) <= 2 && Math.abs(bl - e[2]) <= 2) counts[k]++;
    });
  }
  console.log('棋盘像素统计: ' + JSON.stringify(counts));
  chk('像素层：浅废土底铺满棋盘（≥20000px）', counts.ground >= 20000, counts.ground + 'px');
  var allHit = Object.keys(BLOCK).every(function (k) { return counts[k] >= 60; });
  chk('像素层：4 族名称色块都"画出来了"（各 ≥60px 精确命中）', allHit, JSON.stringify(counts));

  chk('运行期无页面错误', errs.length === 0, errs.slice(0, 2).join(' ; '));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
