/* v89.131 探针：将领档案面板几何量测（真浏览器）
 * ------------------------------------------------------------
 * 检查老板报的「装备的界面没有占满，底下有留空的一块」：
 *   量 .gp-body / .gp-col-l / .gp-col-r / .gp-doll / .doll / .doll-side 的矩形，
 *   找出留空在哪一层。
 * 跑法：node .workbuddy/tools/probe/probe_v89131_pane_geom.js
 */
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
    var st = G.newGame({ name: 'X', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    /* 给首将穿若干装备（触发装备栏满形态） */
    var g = st.generals[0];
    try {
      G.ui._genSel = g.id;
      G.systems.autoEquipBest(g.id);
    } catch (e) { }
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('generals');
    G.refreshAll();
  });
  await p.waitForTimeout(700);
  var m = await p.evaluate(function () {
    function rr(sel) {
      var el = document.querySelector(sel);
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        bottom: Math.round(r.bottom) };
    }
    var out = {
      page: rr('.ui-page'),
      split: rr('.gen-split'),
      pane: rr('.gen-pane'),
      head: rr('.gp-head'),
      body: rr('.gp-body'),
      colL: rr('.gp-col-l'),
      colR: rr('.gp-col-r'),
      dollWrap: rr('.gp-doll'),
      doll: rr('.doll'),
      dollSide: rr('.doll-side'),
      gpsecR: (function () {
        var el = document.querySelectorAll('.gp-col-r > .gp-sec')[0];
        if (!el) return null; var r = el.getBoundingClientRect();
        return { h: Math.round(r.height) };
      })(),
      dollops: rr('.gp-dollops'),
      lastEqGrow: (function () {
        var els = document.querySelectorAll('.doll-side .eq-grow');
        if (!els.length) return null; var r = els[els.length - 1].getBoundingClientRect();
        return { y: Math.round(r.top), bottom: Math.round(r.bottom) };
      })(),
      /* 装备区最末元素（doll 或 doll-side 谁更低） */
      viewH: window.innerHeight,
      pageScrollTop: (document.querySelector('#view-container') || { scrollTop: 0 }).scrollTop,
      viewContainer: (function () {
        var el = document.querySelector('#view-container'); if (!el) return null;
        var r = el.getBoundingClientRect();
        return { h: Math.round(r.height), scrollH: el.scrollHeight, clientH: el.clientHeight };
      })(),
      nSlots: document.querySelectorAll('.doll-slot').length,
      nEqGrows: document.querySelectorAll('.doll-side .eq-grow').length,
    };
    return out;
  });
  console.log(JSON.stringify(m, null, 1));
  /* 截图：将领视图整页 */
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89131-pane-before.png' });
  await b.close();
})();
