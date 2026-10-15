/* v89.128 需求 7/8 实机图：左栏统计（幸存者行/按钮统一/野地行/幸存者道具弹窗）+ 对齐复验 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'minfang') x.build.lvl = 6; });
    st.res.pop = Math.floor(G.maxPopOf(c) * 0.35);
    st.wilds = [{ x: 3, y: 4, type: 'hill', level: 5 }];
    st.items.zengminling = 2; st.items.yiminling = 1;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('city');
    G.refreshAll();
  });
  await p.waitForTimeout(600);

  /* 侧栏区域截图 */
  var side = await p.$('#sidebar') || await p.$('.side') || await p.$('#left-bar');
  if (side) { await side.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89128-leftbar.png' }); }
  else { await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89128-leftbar.png', clip: { x: 0, y: 0, width: 380, height: 1000 } }); }

  var m = await p.evaluate(function () {
    function rr(sel) { var el = document.querySelector(sel); if (!el) return null; var r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }
    var at = document.querySelector('#city-attrs');
    var res = document.querySelector('#res-bar');
    return {
      resRate: rr('#res-bar .res-line .num-rate'),
      resPlus: rr('#res-bar .res-line .plus-btn'),
      popRate: rr('#city-attrs .pop-line .num-rate'),
      popPlus: rr('#city-attrs .pop-line .plus-btn'),
      atHasCap: at.innerHTML.indexOf('pop-line') >= 0 ? /pop-line[\s\S]{0,220}?cap">/.test(at.innerHTML) : null,
      hasBadge: res.innerHTML.indexOf('item-badge') >= 0,
      lbls: (at.textContent || '').replace(/\s+/g, ' ').slice(0, 40),
    };
  });
  console.log('资源行 num-rate 右缘:', m.resRate && m.resRate[1], ' plus 右缘:', m.resPlus && m.resPlus[1]);
  console.log('幸存者行 num-rate 右缘:', m.popRate && m.popRate[1], ' plus 右缘:', m.popPlus && m.popPlus[1]);
  console.log('幸存者行含 cap:', m.atHasCap, '（期望 false） · 资源含 item-badge:', m.hasBadge, '（期望 false）');
  console.log('属性区文字:', m.lbls);

  /* 点幸存者 "+" → 弹窗 */
  await p.click('#city-attrs .pop-line .plus-btn');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89128-popitems.png' });
  var m2 = await p.evaluate(function () {
    var mr = document.querySelector('#modal-root');
    return { t: (mr.textContent || '').replace(/\s+/g, ' ').slice(0, 80), hasZ: mr.innerHTML.indexOf('增民令') >= 0, hasY: mr.innerHTML.indexOf('移民令') >= 0 };
  });
  console.log('弹窗:', m2.t, '｜增民令:', m2.hasZ, '移民令:', m2.hasY);

  var pass = !m.hasBadge && m.atHasCap === false && m2.hasZ && m2.hasY;
  console.log(pass ? '✓ 需求 7/8 实机验证通过' : '✗ 有未达标项');
  await b.close();
  process.exit(pass ? 0 : 1);
})();
