'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader'] });
  var p = await b.newPage();
  p.on('pageerror', function (e) { console.log('PAGEERROR: ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') console.log('CONSOLE-ERR: ' + m.text().slice(0, 300)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForTimeout(4000);
  var st = await p.evaluate(function () {
    return { GAME: !!window.GAME, DATA: !!(window.GAME && window.GAME.DATA), ui: !!(window.GAME && window.GAME.ui), THREE: !!window.THREE };
  });
  console.log('STATE ' + JSON.stringify(st));
  await b.close();
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
