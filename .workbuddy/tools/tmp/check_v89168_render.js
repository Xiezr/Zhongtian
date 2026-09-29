var fs = require('fs'), path = require('path');
var { chromium } = require(path.join('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules', 'playwright-core'));
var R = 'E:/Deepseekdb/.workbuddy/tmp/';
var s1 = fs.readFileSync(R + 'widget1_expcurve.svg', 'utf8');
var s2 = fs.readFileSync(R + 'widget2_expdelta.svg', 'utf8');
(async function () {
  var browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await browser.newPage({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 1.5 });
  for (var mode of ['light', 'dark']) {
    var bg = mode === 'light' ? '#ffffff' : '#1f1f1f';
    var wrap = '<html><body style="margin:0;padding:20px;background:' + bg + ';width:680px">'
      + '<div style="font-family:sans-serif">' + s1 + '</div>'
      + '<div style="font-family:sans-serif;margin-top:16px">' + s2 + '</div></body></html>';
    fs.writeFileSync(R + 'render_' + mode + '.html', wrap);
    await p.goto('file:///' + R + 'render_' + mode + '.html');
    await p.waitForTimeout(300);
    await p.screenshot({ path: R + 'render_' + mode + '.png', fullPage: true });
    console.log(mode + ' 图已出');
  }
  await browser.close();
  process.exit(0);
})();
