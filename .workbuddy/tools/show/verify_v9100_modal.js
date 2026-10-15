/* v91.00 实机验收：① 否决性弹窗变小（xs）② 点弹窗外关闭 ③ noClose 窗不关
 * 用法：node .workbuddy/tools/show/verify_v9100_modal.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id; G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.refreshAll();
  });
  await p.waitForTimeout(500);

  /* ① 否决性弹窗：openWhyAsk → xs 尺寸 */
  var why = await p.evaluate(function () {
    GAME.ui.openWhyAsk({ getAttribute: function () { return '缺少条件：需要 Lv5 练兵场'; }, textContent: '升级城墙' });
    var box = document.querySelector('#modal-root .modal');
    var rect = box ? box.getBoundingClientRect() : null;
    return { hasXs: !!document.querySelector('#modal-root .modal-xs'),
      hasXXL: !!document.querySelector('#modal-root .modal-xxl'),
      w: rect ? Math.round(rect.width / 0.8533) : 0, h: rect ? Math.round(rect.height / 0.8533) : 0,
      text: (document.querySelector('#modal-root') || {}).textContent || '' };
  });
  console.log('REFUSAL:', JSON.stringify({ hasXs: why.hasXs, hasXXL: why.hasXXL, cssW: why.w, cssH: why.h, hasWhy: /缺少条件/.test(why.text) }));

  /* ② 点弹窗外（遮罩）→ 关闭 */
  var outside = await p.evaluate(function () {
    var mask = document.querySelector('#modal-root .modal-mask');
    if (!mask) return { ok: false, reason: 'no mask' };
    var r = mask.getBoundingClientRect();
    /* 点遮罩左上角（远离居中的 .modal 内容） */
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + 4, clientY: r.top + 4 }));
    var visibleAfter = !!(GAME.ui.modalVisible && GAME.ui.modalVisible());
    return { closed: !visibleAfter };
  });
  console.log('OUTSIDE-CLOSE:', JSON.stringify(outside));

  /* ③ noClose 窗：点外不关 */
  var noClose = await p.evaluate(function () {
    GAME.ui.openModal('<div class="gold-heading">必须选择</div><div class="note">做一个选择才能继续</div>', { size: 'md', noClose: true });
    var mask = document.querySelector('#modal-root .modal-mask');
    var r = mask.getBoundingClientRect();
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + 4, clientY: r.top + 4 }));
    var still = !!(GAME.ui.modalVisible && GAME.ui.modalVisible());
    /* 内容区点击也不关（点 .modal 本身） */
    var box = document.querySelector('#modal-root .modal');
    box.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    var still2 = !!(GAME.ui.modalVisible && GAME.ui.modalVisible());
    return { noCloseStaysOpen: still, contentClickStaysOpen: still2 };
  });
  console.log('NOCLOSE:', JSON.stringify(noClose));

  /* ④ 普通窗内容区点击**不关**（只点外面才关） */
  var content = await p.evaluate(function () {
    GAME.ui.closeAllModals();
    GAME.ui.openModal('<div class="gold-heading">普通窗</div><div class="note">内容</div>', { size: 'md' });
    var box = document.querySelector('#modal-root .modal');
    box.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return { contentClickStaysOpen: !!(GAME.ui.modalVisible && GAME.ui.modalVisible()) };
  });
  console.log('CONTENT-CLICK:', JSON.stringify(content));

  console.log('PAGEERRORS:', JSON.stringify(errs));
  console.log('VERIFY-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
