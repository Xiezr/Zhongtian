/* 立姿候选体检：不归一化加载，逐候选根旋转报告「骨骼 Y 跨度 / Box3 Y 跨度 / 骨骼数」，
 * 用来判断到底该按哪个量选朝向。
 * 用法：node .workbuddy/tools/show/probe_stand_candidates.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.gltf && window.THREE', null, { timeout: 30000 });

  var out = await p.evaluate(function () {
    var THREE = window.THREE, G = window.GAME;
    function probe(name) {
      return new Promise(function (resolve) {
        G.gltf.loadAnimated(name, function (res) {
          if (!res) return resolve({ name: name, err: 'load' });
          var root = res.root;
          var bones = []; root.traverse(function (o) { if (o.isBone) bones.push(o); });
          var skinned = []; root.traverse(function (o) { if (o.isSkinnedMesh) skinned.push(o); });
          var cands = [[0, 0, 0], [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [0, 0, -Math.PI / 2], [0, 0, Math.PI / 2]];
          var wp = new THREE.Vector3(), rows = [];
          cands.forEach(function (c) {
            root.rotation.set(c[0], c[1], c[2]);
            root.updateMatrixWorld(true);
            var lo = Infinity, hi = -Infinity;
            bones.forEach(function (bn) { bn.getWorldPosition(wp); if (wp.y < lo) lo = wp.y; if (wp.y > hi) hi = wp.y; });
            var bb = new THREE.Box3().setFromObject(root), sz = new THREE.Vector3(); bb.getSize(sz);
            rows.push({
              rot: c.map(function (v) { return Math.round(v * 180 / Math.PI); }).join(','),
              boneSpanY: bones.length ? +(hi - lo).toFixed(3) : null,
              boxSpanY: +sz.y.toFixed(3),
              boxSpanX: +sz.x.toFixed(3), boxSpanZ: +sz.z.toFixed(3)
            });
          });
          resolve({ name: name, bones: bones.length, skinned: skinned.length, rows: rows });
        }, { normalize: false });
      });
    }
    return probe('Soldier').then(function (a) {
      return probe('RobotExpressive').then(function (b2) { return [a, b2]; });
    });
  });
  out.forEach(function (o) {
    console.log('=== ' + o.name + '  bones=' + o.bones + ' skinned=' + o.skinned);
    (o.rows || []).forEach(function (r) { console.log('  rot(' + r.rot + ')  boneY=' + r.boneSpanY + '  boxY=' + r.boxSpanY + ' boxX=' + r.boxSpanX + ' boxZ=' + r.boxSpanZ); });
  });
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
