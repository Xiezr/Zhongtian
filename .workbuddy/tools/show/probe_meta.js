'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage();
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.gltf', null, { timeout: 30000 });
  var r = await p.evaluate(function () {
    var G = window.GAME;
    function one(n) { return new Promise(function (res) { G.gltf.loadAnimated(n, function (o) { res(o && o.meta); }); }); }
    return one('Soldier').then(function (a) { return one('RobotExpressive').then(function (b2) { return { Soldier: a, Robot: b2 }; }); });
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
