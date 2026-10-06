/* v89.199 诊断 D：全量输入 + 逐次定位溢出元素 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'x', cityName: '许都', region: '碎垣', mapSeed: 20260932 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui._autoSel = 'train';
    G.ui.setView('auto');
    G.ui.renderView('auto');
  });
  await new Promise(function (r) { setTimeout(r, 600); });

  async function probe(tag) {
    var s = await p.evaluate(function () {
      var vc = document.getElementById('view-container');
      var all = vc.querySelectorAll('*');
      var list = [];
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.scrollWidth > 1500) {
          list.push({ cls: (el.className || el.tagName) + '', sw: el.scrollWidth,
            ow: el.offsetWidth, cw: el.clientWidth });
        }
      }
      list.sort(function (a, b2) { return b2.sw - a.sw; });
      /* 也找 vc 自身直属子元素的宽度 */
      var kids = [];
      for (var k = 0; k < vc.children.length; k++) {
        var kk = vc.children[k];
        kids.push((kk.className || kk.tagName) + ':' + kk.offsetWidth + '/' + kk.scrollWidth);
      }
      return { sw: vc.scrollWidth, cw: vc.clientWidth, n: list.length,
        top: list.slice(0, 6), kids: kids.slice(0, 12) };
    });
    console.log(tag + ' vcSW=' + s.sw + ' vcCW=' + s.cw + ' 溢出元素=' + s.n);
    s.top.forEach(function (t) { console.log('   ⤷ ' + t.cls + ' sw=' + t.sw + ' ow=' + t.ow); });
    if (!s.n) console.log('   kids: ' + s.kids.join(' | '));
    return s;
  }

  await probe('[初始]');
  var n = await p.evaluate(function () { return document.querySelectorAll('#view-container input.at-num').length; });
  for (var i = 0; i < n; i++) {
    var loc = p.locator('#view-container input.at-num').nth(i);
    try {
      await loc.click({ timeout: 3000 });
      await loc.press('Control+a');
      await p.keyboard.type('9999', { delay: 20 });
      await p.keyboard.press('Tab');
    } catch (e) { console.log('   [中断] i=' + i); break; }
    await new Promise(function (r) { setTimeout(r, 120); });
    if (i % 4 === 3 || i === n - 1) await probe('[第 ' + (i + 1) + '/' + n + ' 框后]');
  }
  await new Promise(function (r) { setTimeout(r, 900); });
  await probe('[终态+0.9s]');
  await b.close();
  process.exit(0);
})();
