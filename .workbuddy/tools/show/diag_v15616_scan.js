/* v156.16 诊断②：把 scene 里**所有** material.uniforms 扫一遍，找出 value 为 null/undefined 的项
 * 用法：node .workbuddy/tools/show/diag_v15616_scan.js
 *
 * 为什么：错误栈落在 three 的 uniform.setValue（读 `.x`）→ 说明某个 uniform 的值是空。
 * 首帧抛一次、之后不再抛 → 典型是"第一次 render 时某个值还没准备好"。
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

    var rows = [];
    function scanMat(m, ctx) {
      if (!m) return;
      if (m.uniforms) {
        Object.keys(m.uniforms).forEach(function (k) {
          var u = m.uniforms[k];
          if (!u) { rows.push(ctx + ' uniform ' + k + ' = <entry undefined>'); return; }
          if (u.value === null || u.value === undefined) {
            rows.push(ctx + ' uniform ' + k + ' = ' + String(u.value));
          }
        });
      }
      /* 颜色/贴图这类常见空值 */
      if (m.color === undefined) rows.push(ctx + ' material.color = undefined');
      if (m.map === null && ctx.indexOf('Sprite') < 0) { /* 允许无贴图 */ }
    }
    sc.traverse(function (o) {
      var mats = o.material ? [].concat(o.material) : [];
      mats.forEach(function (m, i) {
        scanMat(m, (o.type || '?') + '#' + (o.name || '-') + '[' + i + ']/' + (m && m.type));
      });
    });
    return {
      rows: rows.slice(0, 40),
      totalObjects: (function () { var n = 0; sc.traverse(function () { n++; }); return n; })(),
      hasSunDir: !!GAME.map3d._sunDir,
      sunDirIsV3: !!(GAME.map3d._sunDir && GAME.map3d._sunDir.isVector3),
      termU: GAME.map3d._termU
    };
  });
  console.log(JSON.stringify(out, null, 1).slice(0, 4000));
  await b.close();
})();
