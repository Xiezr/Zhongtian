/* ============================================================
 * probe_v89117_flicker.js — **弹窗闪烁与层级**取证（真浏览器）
 * ------------------------------------------------------------
 * 老板：「一些弹窗界面在点击操作时会闪烁，界面刷新？无法连续操作。
 *        还有部分界面多层点击进入下级界面之后，关闭的时候不回到上一级界面」
 *
 * 量四样（全部可复现，不靠肉眼）：
 *   ① 同级重绘：连点"面板内换页/换类"，观察 #modal-root 的 **DOM 变动次数**
 *      —— innerHTML 整体重建 = mask 被销毁重插（闪烁的机制来源）；
 *   ② 入场动画：重建后 `.modal-mask` 上 `getAnimations()` 是否重新跑（闪烁的直接证据）；
 *   ③ 层级：从 A 面板点进 B 面板，再关闭 → 落在哪一层（A / 城池视图 / 空）；
 *   ④ 输入焦点：重绘后输入框的焦点/光标是否丢失（"无法连续操作"的机制来源）。
 * 用法：node .workbuddy/tools/probe/probe_v89117_flicker.js
 * ============================================================ */
'use strict';
var path = require('path');
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  page.on('pageerror', function (e) { errs.push(String(e && e.message).slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 建局 + 造出铁匠铺（打造面板要有东西才谈得上重绘） */
  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '闪', cityName: '许都' });
    G.state = st;
    G.map.generate();
    G.ui.enterGame && G.ui.enterGame();
    G.ui.closeModal && G.ui.closeModal();
    /* 给一座铁匠铺（走真实建造出口 GAME.buildAt） */
    var c = G.currentCity();
    ['gold', 'wood', 'stone', 'iron'].forEach(function (k) { GAME_res(st, k, 9e8); });
    var idx = -1, msg = '';
    for (var i2 = 0; i2 < (c.cells || []).length && idx < 0; i2++) {
      var r = G.buildAt(c.id, i2, 'tiejiangpu');
      if (r && r.ok) idx = i2; else msg = (r && r.msg) || '';
    }
    /* 建造是**施工中**（cell.pending），探针要的是"已建成" —— 直接落成（探针惯例：
       压的是界面逻辑，不是建造流程；建造流程另有专用用例）。 */
    if (idx >= 0 && c.cells[idx] && c.cells[idx].pending) {
      c.cells[idx].pending = null;
      c.cells[idx].build = { id: 'tiejiangpu', lvl: 3 };
    }
    return { found: idx, forge: G.forgeLevel ? G.forgeLevel() : -1, msg: msg };
    function GAME_res(stt, k, v) {
      if (stt.res && stt.res[k] !== undefined) stt.res[k] = v;
      else if (stt[k] !== undefined) stt[k] = v;
    }
  });
  console.log('===== 现场 =====');
  console.log('  铁匠铺格位 ' + boot.found + '　铁匠铺等级 ' + boot.forge);

  /* ---------- ① 同级重绘：DOM 变动计数 ---------- */
  var r1 = await page.evaluate(async function () {
    var G = window.GAME;
    G.ui.openForge();
    await new Promise(function (r) { setTimeout(r, 300); });
    var root = document.querySelector('#modal-root');
    var mask0 = root.querySelector('.modal-mask');
    var mut = 0;
    var obs = new window.MutationObserver(function (recs) { mut += recs.length; });
    obs.observe(root, { childList: true, subtree: true });
    /* 连点两次"品质"切页（同级重绘）+ 两次"类别" */
    var acts = ['forge-q', 'forge-q', 'forge-kind', 'forge-kind'];
    var clicked = 0;
    for (var i = 0; i < acts.length; i++) {
      var els = root.querySelectorAll('[data-action="' + acts[i] + '"]');
      var el = els[Math.min(i % 2, els.length - 1)];
      if (el) { el.click(); clicked++; await new Promise(function (r) { setTimeout(r, 120); }); }
    }
    await new Promise(function (r) { setTimeout(r, 260); });
    obs.disconnect();
    var mask1 = root.querySelector('.modal-mask');
    var anims = 0;
    try { anims = (mask1 && mask1.getAnimations ? mask1.getAnimations() : []).length; } catch (e) { anims = -1; }
    return { clicked: clicked, mutations: mut, maskSame: mask0 === mask1, anims: anims,
      stillOpen: !!root.querySelector('.modal') };
  });
  console.log('\n===== ① 同级重绘（连点 4 次换页/换类）=====');
  console.log('  点击次数 ' + r1.clicked + '　#modal-root DOM 变动 ' + r1.mutations + ' 次');
  console.log('  mask 元素**同一个**？' + (r1.maskSame ? '是（未重建 = 不闪）' : '**否 —— 被销毁重建（闪烁机制）**'));
  console.log('  重建后入场动画在跑：' + r1.anims + ' 条');

  /* ---------- ④ 输入焦点：重绘是否夺焦点 ---------- */
  var r4 = await page.evaluate(async function () {
    var G = window.GAME;
    G.ui.closeModal();
    G.ui.openExpModal({ kind: 'wild', x: (G.currentCity().x + 2), y: G.currentCity().y });
    await new Promise(function (r) { setTimeout(r, 350); });
    var inp = document.querySelector('#modal-root input[id^="exp-"]');
    if (!inp) return { skipped: true };
    var sameNodeBefore = true;
    inp.focus();
    inp.setAttribute('data-probe117', '1');
    inp.value = '12';
    var before = document.activeElement === inp;
    /* 触发一次同级重绘（兵力变化走 updateExpMarch，不重建弹窗） */
    G.ui.updateExpMarch && G.ui.updateExpMarch();
    await new Promise(function (r) { setTimeout(r, 120); });
    var afterSame = document.activeElement === inp;
    var sameNode = !!document.querySelector('#modal-root input[data-probe117="1"]');
    return { before: before, after: afterSame, sameNode: sameNode, val: inp.value,
      hasFocus: document.hasFocus() };
  });
  console.log('\n===== ④ 输入焦点（同级重绘后）=====');
  console.log('  ' + JSON.stringify(r4));

  /* ---------- ③ 层级：进下级再关闭 ---------- */
  var r3 = await page.evaluate(async function () {
    var G = window.GAME;
    G.ui.closeModal();
    G.ui.openForge();                        /* A 级：铁匠铺（有底部「套装效果一览」） */
    await new Promise(function (r) { setTimeout(r, 300); });
    var tA = (document.querySelector('#modal-root .m-title') || {}).textContent || '';
    var btn = document.querySelector('#modal-root [data-action="forge-setinfo"]');
    if (btn) btn.click();
    await new Promise(function (r) { setTimeout(r, 300); });
    var tB = (document.querySelector('#modal-root .m-title') || {}).textContent || '';
    var opened = !!document.querySelector('#modal-root .modal');
    /* 关闭 B：看回到哪 */
    G.ui.closeModal();
    await new Promise(function (r) { setTimeout(r, 200); });
    var after = (document.querySelector('#modal-root .m-title') || {}).textContent || '';
    var stillOpen = !!document.querySelector('#modal-root .modal');
    var vc = document.querySelector('#view-container');
    return { A: tA, BDiff: tB !== tA, B: tB, opened: opened,
      afterClose: after, stillOpen: stillOpen,
      viewBack: !!(vc && vc.textContent.length > 50) };
  });
  console.log('\n===== ③ 层级（A 铁匠铺 → B 套装效果 → 关闭）=====');
  console.log('  A = ' + JSON.stringify(r3.A) + '　B = ' + JSON.stringify(r3.B));
  console.log('  关闭 B 之后：弹窗还开着？' + r3.stillOpen + '　标题 = ' + JSON.stringify(r3.afterClose));
  console.log('  → ' + (r3.stillOpen && r3.afterClose === r3.A
    ? '回到上一级 ✅' : '**没回到上一级（回到城池视图）** ❌'));

  console.log('\n页面错误: ' + (errs.length ? errs.join(' | ') : '无'));
  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
