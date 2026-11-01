/* 3D 斗将舞台独立验证 v2：清场后单独拍舞台 + 打印角色包围盒（判断比例/朝向/贴地）
 * 用法：node .workbuddy/tools/show/probe_duel3d2.js [前缀]
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var PREFIX = process.argv[2] || 'duel3d';

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 760, height: 420 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && window.THREE', null, { timeout: 30000 });

  /* 把游戏本体藏掉，只留我们自己的舞台（避免开局弹窗盖住镜头） */
  await p.evaluate(function () {
    /* 最干净：整页清空只留舞台（开局命名弹窗藏在一堆自定义容器里，逐个找不如推倒重来）。
       注意要在 mount 之前清，桌面网格才会按新容器尺寸建立。 */
    document.body.innerHTML = '';
    document.body.style.background = '#0d0b09';
    var st = document.createElement('div');
    st.className = 'duel-stage';
    st.style.cssText = 'position:absolute;left:0;top:0;width:600px;height:320px;border-radius:10px;';
    var d = document.createElement('div');
    d.id = 'duel-stage3d'; d.className = 'duel-stage3d';
    st.appendChild(d);
    document.body.appendChild(st);
  });
  await p.evaluate(function () { window.GAME.duel3d.mount({ holderId: 'duel-stage3d', roundNo: 0 }); });
  await p.waitForFunction(function () {
    var s = window.GAME.duel3d.state && window.GAME.duel3d.state();
    return s && s.ready;
  }, null, { timeout: 20000 });
  await p.waitForTimeout(700);

  var st0 = await p.evaluate(function () { return window.GAME.duel3d.state(); });
  console.log('STATE ' + JSON.stringify(st0));

  await p.screenshot({ path: '.workbuddy/shots/' + PREFIX + '_idle.png', clip: { x: 0, y: 0, width: 600, height: 320 } });
  await p.evaluate(function () { window.GAME.duel3d.mount({ holderId: 'duel-stage3d', roundNo: 1, dmgToA: 23, dmgToB: 41 }); });
  await p.waitForTimeout(180);
  await p.screenshot({ path: '.workbuddy/shots/' + PREFIX + '_attack.png', clip: { x: 0, y: 0, width: 600, height: 320 } });
  await p.evaluate(function () { window.GAME.duel3d.mount({ holderId: 'duel-stage3d', roundNo: 2, over: true, winner: 'atk' }); });
  await p.waitForTimeout(900);
  await p.screenshot({ path: '.workbuddy/shots/' + PREFIX + '_over.png', clip: { x: 0, y: 0, width: 600, height: 320 } });
  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
