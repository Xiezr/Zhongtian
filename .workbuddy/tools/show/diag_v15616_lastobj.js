/* v156.16 诊断③：**抓"最后一个开始渲染的对象"** —— 报错就是它（或紧跟它的那个）
 * 用法：node .workbuddy/tools/show/diag_v15616_lastobj.js
 *
 * 手法：three 在渲染每个对象前都会调 `object.onBeforeRender(renderer, scene, camera, ...)`。
 * 给 scene 里每个对象挂上"记下我是谁"，然后触发一次 render（它必抛），
 * 读回最后记下的那个对象 —— 就是错误源头。
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && window.GAME.ui && window.THREE', null, { timeout: 30000 });
  await p.evaluate(function () {
    var Orig = window.THREE.WebGLRenderer;
    window.THREE.WebGLRenderer = function () {
      var r = new (Function.prototype.bind.apply(Orig, [null].concat([].slice.call(arguments))))();
      window.__R3 = r;
      return r;
    };
    window.THREE.WebGLRenderer.prototype = Orig.prototype;
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: 'H', region: 'R', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    if (G.prologue && G.prologue.off) { try { G.prologue.off('diag'); } catch (e) {} }
    if (st.prologue) st.prologue.on = false;
    G.ui.enterGame();
    try { G.ui.setView('map'); } catch (e) {}
  });
  await p.waitForTimeout(1800);

  var out = await p.evaluate(function () {
    var R3 = window.__R3, sc = null, cam = null;
    if (!R3) return { err: 'no renderer' };
    var orig = R3.render;
    R3.render = function (s, c) { sc = s; cam = c; return orig.apply(this, arguments); };
    try { GAME.ui.renderMapCanvas(); } catch (e) {}
    if (!sc) return { err: 'no scene' };

    /* 清空所有 onBeforeRender，重挂"记名"版 */
    var idx = 0, list = [];
    sc.traverse(function (o) {
      var i = idx++;
      var m = o.material ? [].concat(o.material)[0] : null;
      list[i] = (o.type || '?') + '#' + (o.name || '-') + '/' + (m ? m.type : '-')
        + '/geo=' + (o.geometry ? (o.geometry.type || '?') + ':' + (o.geometry.attributes ? Object.keys(o.geometry.attributes).join(',') : '-') : '-');
      o.onBeforeRender = function (rr, s, c) { window.__LAST = i + ' :: ' + list[i]; };
    });
    window.__LAST = '(none)';
    var msg = null;
    try { R3.render(sc, cam); } catch (e) { msg = String(e && e.message || e); }
    var msg2 = null;
    window.__LAST = '(second)';
    try { R3.render(sc, cam); } catch (e) { msg2 = String(e && e.message || e); }
    return { firstError: msg, secondError: msg2, lastObject: window.__LAST, objects: list.length, list: list };
  });
  console.log('firstError=' + out.firstError);
  console.log('secondError=' + out.secondError);
  console.log('lastObject=' + out.lastObject);
  if (out.list) out.list.forEach(function (s, i) { if (i < 40) console.log('  [' + i + '] ' + s); });
  await b.close();
})();
