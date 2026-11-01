/* 3D 斗将舞台独立验证：建一个 520×268 的容器直接 mount，等角色加载后连拍三帧
 * （第 0 帧=待机 / 第 1 帧=出招中 / 第 2 帧=结算胜利）
 * 用法：node .workbuddy/tools/show/probe_duel3d.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'] });
  var p = await b.newPage({ viewport: { width: 900, height: 620 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  p.on('console', function (m) { if (m.type() === 'error') console.log('PAGE-ERR', m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && window.THREE', null, { timeout: 30000 });

  var has = await p.evaluate(function () { return !!(window.GAME.duel3d && window.GAME.duel3d.mount); });
  console.log('duel3d 已加载 = ' + has);

  await p.evaluate(function () {
    var d = document.createElement('div');
    d.id = 'duel-stage3d';
    d.style.cssText = 'position:absolute;left:20px;top:20px;width:520px;height:268px;';
    var st = document.createElement('div');
    st.className = 'duel-stage';
    st.style.cssText = 'position:absolute;left:16px;top:16px;width:528px;height:276px;';
    st.appendChild(d);
    document.body.appendChild(st);
  });
  var ok = await p.evaluate(function () { return window.GAME.duel3d.mount({ holderId: 'duel-stage3d', roundNo: 0 }); });
  console.log('mount() = ' + ok);

  /* 等两个角色都就绪（最多 20s） */
  await p.waitForFunction(function () {
    var s = window.GAME.duel3d.state && window.GAME.duel3d.state();
    return s && s.ready;
  }, null, { timeout: 20000 });
  await p.waitForTimeout(600);
  console.log('state@idle ' + JSON.stringify(await p.evaluate(function () { return window.GAME.duel3d.state(); })));
  await p.screenshot({ path: '.workbuddy/shots/duel3d_idle.png', clip: { x: 16, y: 16, width: 528, height: 276 } });

  /* 触发第 1 合：双方出招 */
  await p.evaluate(function () { window.GAME.duel3d.mount({ holderId: 'duel-stage3d', roundNo: 1, dmgToA: 23, dmgToB: 41 }); });
  await p.waitForTimeout(160);
  console.log('state@attack ' + JSON.stringify(await p.evaluate(function () { return window.GAME.duel3d.state(); })));
  await p.screenshot({ path: '.workbuddy/shots/duel3d_attack.png', clip: { x: 16, y: 16, width: 528, height: 276 } });

  /* 结算：我方胜 */
  await p.evaluate(function () { window.GAME.duel3d.mount({ holderId: 'duel-stage3d', roundNo: 2, over: true, winner: 'atk' }); });
  await p.waitForTimeout(700);
  console.log('state@over ' + JSON.stringify(await p.evaluate(function () { return window.GAME.duel3d.state(); })));
  await p.screenshot({ path: '.workbuddy/shots/duel3d_over.png', clip: { x: 16, y: 16, width: 528, height: 276 } });

  console.log('DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
