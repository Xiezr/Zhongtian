/* v89.199 实机验收：
   ① 需求 2：自动征兵面板全量输入 → 页面不被撑宽（修复前 1408→2383）
   ② 需求 1：拨钟 8h + focus 唤醒事件 → 立即补算（不等主循环下一拍）
   ③ 版本标识在册 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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
    G.newGame({ name: 'v199', cityName: '许都', region: '豫州', mapSeed: 20260932 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui._autoSel = 'train';
    G.ui.setView('auto');
    G.ui.renderView('auto');
  });
  await sleep(700);

  /* ════ ① 自动征兵：全量输入不撑宽 ════ */
  console.log('── ① 需求2：自动征兵目标列全量输入（修复前 vcSW 1408→2383）──');
  var sw0 = await p.evaluate(function () {
    var vc = document.getElementById('view-container');
    return { sw: vc.scrollWidth, cw: vc.clientWidth };
  });
  var n = await p.evaluate(function () {
    return document.querySelectorAll('#view-container input.at-num').length; });
  for (var i = 0; i < n; i++) {
    var loc = p.locator('#view-container input.at-num').nth(i);
    try {
      await loc.click({ timeout: 3000 });
      await loc.press('Control+a');
      await p.keyboard.type('9999', { delay: 12 });
      await p.keyboard.press('Tab');
    } catch (e) { break; }
    await sleep(70);
  }
  await sleep(500);
  var r1 = await p.evaluate(function () {
    var vc = document.getElementById('view-container');
    var wrap = vc.querySelector('.res-line.wrap-ok');
    var val = wrap ? wrap.querySelector('.val') : null;
    var rects = (val && val.getClientRects) ? val.getClientRects().length : 0;
    var over = 0;
    var all = vc.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) { if (all[i].scrollWidth > 1500) over++; }
    var txt = wrap ? (wrap.textContent || '') : '';
    var nDiff = (txt.match(/差 /g) || []).length;
    var vr = val ? val.getBoundingClientRect() : null;
    var cfg = window.GAME.autoTrainCfg();
    var set = 0;
    Object.keys(cfg.targets || {}).forEach(function (k) {
      if ((cfg.targets[k] || {}).max > 0) set++;
    });
    return { sw: vc.scrollWidth, cw: vc.clientWidth, rects: rects,
      over: over, set: set, nDiff: nDiff, txtLen: txt.length, txtTail: txt.slice(-70),
      wrapH: wrap ? wrap.offsetHeight : -1, nWrap: vc.querySelectorAll('.res-line.wrap-ok').length,
      valH: vr ? Math.round(vr.height) : -1, valW: vr ? Math.round(vr.width) : -1 };
  });
  chk('①a 输入 '+n+' 框后页面不被撑宽（' + sw0.sw + ' → ' + r1.sw + '，应不变）',
    r1.sw <= sw0.sw + 4, 'sw=' + r1.sw);
  chk('①b 无横向溢出（scrollWidth === clientWidth，溢出元素 0）',
    r1.sw === r1.cw && r1.over === 0, 'sw=' + r1.sw + ' cw=' + r1.cw + ' over=' + r1.over);
  chk('①c 输入生效 + 「待补」'+r1.nDiff+' 项俱在（15 兵种 · wrap-ok 行 ' + r1.nWrap + ' 个）',
    r1.set >= 10 && r1.nDiff >= 10 && r1.nWrap >= 1,
    'set=' + r1.set + ' nDiff=' + r1.nDiff + ' txtLen=' + r1.txtLen);
  chk('①d 长文本折行渲染（val ' + r1.valW + '×' + r1.valH + ' · rects=' + r1.rects
    + ' · 行容器高 ' + r1.wrapH + '）',
    r1.rects >= 2 || r1.valH >= 40 || r1.wrapH >= 44,
    'rects=' + r1.rects + ' valH=' + r1.valH + ' wrapH=' + r1.wrapH + ' tail=' + JSON.stringify(r1.txtTail.slice(-50)));
  await p.screenshot({ path: E + 'v89199-zoom-fixed.png' });

  /* ════ ② 拨钟 8h + focus 唤醒 → 立即补算 ════ */
  console.log('── ② 需求1：拨钟 8h + focus 唤醒事件（验证"醒来立即补算"通道）──');
  /* 制造队列 + 关闭干扰弹窗 */
  await p.evaluate(function () {
    var G = window.GAME, s = G.state, c = s.cities[0];
    G.ui.closeAllModals();
    s.queues.train.push({ kind: 'train', cityId: c.id, bIdx: 0, troopId: 'yibing',
      count: 100, elapsed: 0, totalTime: 500000, waiting: false });
  });
  /* 等"刚拍过"的时刻（此后 ~900ms 内无 interval 拍 —— 确定性证明 focus 通道独立生效） */
  var justTicked = false;
  for (var k = 0; k < 30 && !justTicked; k++) {
    var age = await p.evaluate(function () {
      return Date.now() - (window.GAME._loopLastAt || 0); });
    if (age < 80) justTicked = true;
    else await sleep(70);
  }
  chk('②a 已进入"刚拍过"窗口（距上次主循环拍 <80ms）', justTicked);
  var t0 = await p.evaluate(function () {
    var G = window.GAME;
    G._loopLastAt = Date.now() - 8 * 3600 * 1000;      /* 拨钟 8h */
    return { w: G.state.world.elapsed, at: Date.now() };
  });
  /* 立即派发唤醒事件（不等 1 秒 interval 拍） */
  await p.evaluate(function () {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(260);
  var t1 = await p.evaluate(function () {
    var G = window.GAME;
    var toast = document.getElementById('toast');
    return { w: G.state.world.elapsed, toast: toast ? (toast.textContent || '') : '' };
  });
  var adv = t1.w - t0.w;
  var need = 8 * 3600 * 120 * 0.9;                    /* 8h×120 游戏秒 · 留 10% 余量 */
  chk('②b focus 事件后 260ms 内补算已发生（world Δ=' + Math.round(adv) + '，需 ≥' + Math.round(need) + '）',
    adv >= need, 'Δ=' + Math.round(adv));
  chk('②c 补算提示 toast 在册（含"时间跳变"）', t1.toast.indexOf('时间跳变') >= 0,
    JSON.stringify(t1.toast.slice(0, 60)));

  /* ════ ③ 版本标识 ════ */
  console.log('── ③ 版本标识 ──');
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.setView('settings');
    G.ui.renderView('settings');
    var vc = document.getElementById('view-container');
    return { v: G.VERSION, txt: vc ? (vc.textContent || '') : '' };
  });
  chk('③ GAME.VERSION=' + r3.v + ' + 设置页含「运行版本」与 Ctrl+F5 指引',
    r3.v === 'v89.199' && r3.txt.indexOf('运行版本') >= 0 && r3.txt.indexOf('Ctrl + F5') >= 0,
    'v=' + r3.v);
  await p.screenshot({ path: E + 'v89199-settings.png' });

  console.log('\n═══ v89.199 实机：' + PASS + ' 过 / ' + FAIL + ' 红 ═══');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
