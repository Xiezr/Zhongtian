/* 单角色渲染体检：把 Soldier / RobotExpressive 各自单独摆到原点，
 * 用固定相机（正面 3/4）渲染一张，肉眼判断"蒙皮骨骼绑定是否正确、是否立正"。
 * 用法：node .workbuddy/tools/show/probe_actor_look.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 900, height: 620 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && window.GAME.gltf && window.THREE', null, { timeout: 30000 });

  var res = await p.evaluate(function () {
    var THREE = window.THREE, G = window.GAME;
    var out = [];
    function shot(name, clipName, yaw, camDist) {
      return new Promise(function (resolve) {
        var a = new G.gltf.Actor({ name: name });
        a.load(function (act) {
          if (!act) { out.push({ name: name, err: 'load fail' }); return resolve(); }
          var scene = new THREE.Scene();
          scene.background = new THREE.Color(0x22303f);
          scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.4));
          var dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(2, 4, 3); scene.add(dl);
          /* 转身加在外层容器上 —— 直接写 root.rotation.y 会和 parseAnimated 的立姿旋转复合，
             把站姿拧成躺姿（踩过：出来的是一具横躺的士兵）。 */
          var wrap = new THREE.Group();
          wrap.add(act.root);
          wrap.rotation.y = yaw || 0;
          scene.add(wrap);
          if (clipName) act.play(clipName);
          /* 相机：看人物腰部高度，高度按 1 单位归一化后的模型 */
          var cam = new THREE.PerspectiveCamera(35, 900 / 620, 0.1, 100);
          var d = camDist || 2.6;
          cam.position.set(0, 1.0, d);
          cam.lookAt(0, 0.55, 0);
          var cv = document.createElement('canvas'); cv.width = 900; cv.height = 620;
          var rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
          rd.setSize(900, 620, false);
          /* 跑 3 帧让蒙皮/动画进入稳定状态 */
          for (var k = 0; k < 30; k++) act.update(0.05);
          rd.render(scene, cam);
          var url = cv.toDataURL('image/png');
          var bb = new THREE.Box3().setFromObject(wrap);
          out.push({
            name: name, clip: act.currentName,
            min: bb.min.toArray().map(function (v) { return +v.toFixed(2); }),
            max: bb.max.toArray().map(function (v) { return +v.toFixed(2); }),
            url: url
          });
          rd.dispose();
          resolve();
        });
      });
    }
    return shot('Soldier', 'Idle', Math.PI, 2.6)
      .then(function () { return shot('RobotExpressive', 'Idle', 0, 2.6); })
      .then(function () { return out; });
  });

  res.forEach(function (r, i) {
    if (r.url) {
      var f = '.workbuddy/shots/actor_' + r.name + '.png';
      fs.writeFileSync(f, Buffer.from(r.url.split(',')[1], 'base64'));
      console.log('WROTE ' + f + ' clip=' + r.clip + ' min=' + JSON.stringify(r.min) + ' max=' + JSON.stringify(r.max));
    } else {
      console.log('FAIL ' + JSON.stringify(r));
    }
  });
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
