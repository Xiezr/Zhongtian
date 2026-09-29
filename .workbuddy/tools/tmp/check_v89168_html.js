var path = require('path');
var { chromium } = require(path.join('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules', 'playwright-core'));
(async function () {
  var b = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 820, height: 1200 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/.workbuddy/shots/v89168-expcurve.html');
  await p.waitForTimeout(400);
  var r = await p.evaluate(function () {
    var svgs = document.querySelectorAll('svg');
    var tx = document.querySelectorAll('text');
    var fills = [];
    tx.forEach(function (t, i) { if (i < 3 || i === 30) fills.push(getComputedStyle(t).fill); });
    return { svg: svgs.length, text: tx.length, rows: document.querySelectorAll('table tr').length, fills: fills,
      h: document.body.scrollHeight };
  });
  console.log('SVG=' + r.svg + ' · 文字=' + r.text + ' · 表格行=' + r.rows + ' · 页高=' + r.h);
  console.log('文字 fill 抽样 = ' + JSON.stringify(r.fills));
  console.log('页面错误 = ' + (errs.length ? errs.join(' | ') : '无'));
  await b.close();
  process.exit(0);
})();
