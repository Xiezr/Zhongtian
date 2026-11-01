'use strict';
/* v156.34：把 3D 场景里**所有**对象列出来（类型 / 材质 / 包围球半径 / 是否透明）。
   目的：认清"球体外那圈白雾"到底是谁 —— 大气壳？星环？陨石带？还是别的。
   scene 是闭包私有，但可以从任意已暴露对象 `.parent` 反爬上去。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
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
  await p.waitForTimeout(1600);
  var out = await p.evaluate(function () {
    var M = GAME.map3d;
    var anchor = M._sky || M._collider || M._globeMat;
    if (!anchor) return { err: 'no anchor' };
    var sc = anchor, guard = 0;
    while (sc && sc.parent && guard++ < 20) sc = sc.parent;
    var R = (GAME.sphere && GAME.sphere.R) || 300;
    var rows = [];
    sc.traverse(function (o) {
      var mat = o.material, mats = Array.isArray(mat) ? mat : (mat ? [mat] : []);
      var info = {
        name: o.name || '', type: o.type,
        visible: o.visible, renderOrder: o.renderOrder,
        mat: mats.map(function (m) {
          return (m.type || '?') + (m.transparent ? '/T' : '') + (m.opacity != null ? ' op=' + m.opacity : '');
        }).join(' + '),
        r: null
      };
      try {
        if (o.geometry) {
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          var bs = o.geometry.boundingSphere;
          if (bs) info.r = +(bs.radius * (o.scale && o.scale.x ? o.scale.x : 1)).toFixed(1);
        }
      } catch (e) { }
      if (o.type !== 'Object3D' && o.type !== 'Scene' && o.type !== 'Group') rows.push(info);
    });
    rows.sort(function (a, b) { return (b.r || 0) - (a.r || 0); });
    return { R: R, n: rows.length, rows: rows.slice(0, 24) };
  });
  if (out.err) { console.log(out.err); await b.close(); return; }
  console.log('场景对象 ' + out.n + ' 个（按包围球半径降序，前 24）   星球 R=' + out.R);
  console.log('半径    类型              渲染序 材质 / 可见');
  out.rows.forEach(function (r) {
    console.log(String(r.r == null ? '  -  ' : r.r.toFixed(1)).padStart(7) + '  '
      + r.type.padEnd(16) + String(r.renderOrder).padStart(4) + '   '
      + (r.visible ? '' : '✗隐藏 ') + r.mat + (r.name ? '  name=' + r.name : ''));
  });
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
