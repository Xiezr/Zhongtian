/* ============================================================
 * probe_v89112_seg.js — 量「出征 / 自动出征 / 战报详情」的子段高度分布
 * 目的：定位溢出到底来自哪一段（好对症下药，不做猜测式改动）
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var savePath = path.join(R, '.workbuddy/tmp/playtest600/cap108/final_state.json');
  var saveRaw = fs.existsSync(savePath) ? fs.readFileSync(savePath, 'utf8') : null;
  await page.evaluate(function (raw) {
    var G = window.GAME;
    var st = raw ? JSON.parse(raw) : G.newGame({ name: 'x', cityName: '许都' });
    if (raw) G.adoptState(st);
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = (G.currentCity() || st.cities[0]).id;
    /* v89.112：与压测同载荷（199 物品塞满）——复现"可用道具"区的膨胀 */
    st.items = st.items || {};
    (G.DATA.ITEMS || []).forEach(function (it) { if (it && it.id) st.items[it.id] = 3; });
  }, saveRaw);

  function seg(name, expr) {
    return page.evaluate(function (e) {
      try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message).slice(0, 80) }; }
      var root = document.querySelector('#modal-root');
      var modal = root.querySelector('.modal');
      if (!modal) return { err: '无弹窗' };
      var body = root.querySelector('.m-body') || root.querySelector('.inner-panel') || modal;
      var box = modal.getBoundingClientRect();
      var out = [];
      /* 正文的直接子元素逐个量（跳过纯容器，深入一层） */
      function walk(el, depth, pfx) {
        if (depth > 4) return;
        for (var i = 0; i < el.children.length; i++) {
          var ch = el.children[i];
          var r = ch.getBoundingClientRect();
          var cls = (ch.className || ch.tagName).toString().slice(0, 34);
          if (/inner-panel|m-body|panel-body|exp-col|exp-grid|ui-page/.test(cls) && depth < 4) {
            walk(ch, depth + 1, pfx + '  ');
          } else if (r.height > 24) {
            out.push(pfx + cls + '  h=' + Math.round(r.height));
          }
        }
      }
      walk(body, 0, '');
      return { w: Math.round(box.width), h: Math.round(box.height),
        over: Math.round(body.scrollHeight - body.clientHeight),
        bodyH: Math.round(body.clientHeight), segs: out.slice(0, 26) };
    }, expr);
  }

  var r1 = await seg('出征', '(function(){var st=GAME.state;ui.openExpModal({kind:"wild",x:st.cities[0].x+2,y:st.cities[0].y+2});})()');
  console.log('══ 出征 ' + (r1.w || '?') + '×' + (r1.h || '?') + ' 溢出 ' + r1.over + '（正文区 ' + r1.bodyH + '）');
  (r1.segs || []).forEach(function (s) { console.log('   ' + s); });
  await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });

  var r2 = await seg('自动出征', 'ui.openAutoMarch()');
  console.log('\n══ 自动出征 ' + (r2.w || '?') + '×' + (r2.h || '?') + ' 溢出 ' + r2.over + '（正文区 ' + r2.bodyH + '）');
  (r2.segs || []).forEach(function (s) { console.log('   ' + s); });
  await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });

  /* 找一份有 replay 或 scene 的战报 */
  var r3 = await page.evaluate(function () {
    var G = window.GAME, st = G.state;
    var idx = -1;
    (st.reports || []).forEach(function (r, i) {
      if (idx >= 0) return;
      if ((r.replay && r.replay.frames) || r.scene) idx = i;
    });
    if (idx < 0) return { err: '无带 replay/scene 的战报' };
    /* v89.120：身份 rid（不再是数组下标） */
    G.ui.viewReportText(G.repRidOf(GAME.state.reports[idx]));
    var root = document.querySelector('#modal-root');
    var modal = root.querySelector('.modal');
    if (!modal) return { err: '无弹窗' };
    var body = root.querySelector('.m-body') || root.querySelector('.inner-panel') || modal;
    var box = modal.getBoundingClientRect();
    var out = [];
    for (var i = 0; i < body.children.length; i++) {
      var ch = body.children[i];
      var rr = ch.getBoundingClientRect();
      out.push((ch.className || ch.tagName).toString().slice(0, 34) + '  h=' + Math.round(rr.height));
    }
    return { idx: idx, type: st.reports[idx].type, w: Math.round(box.width), h: Math.round(box.height),
      over: Math.round(body.scrollHeight - body.clientHeight), bodyH: Math.round(body.clientHeight), segs: out };
  });
  console.log('\n══ 战报详情 [#' + r3.idx + ' type=' + r3.type + '] ' + (r3.w || '?') + '×' + (r3.h || '?')
    + ' 溢出 ' + r3.over + '（正文区 ' + r3.bodyH + '）');
  (r3.segs || []).forEach(function (s) { console.log('   ' + s); });

  var r4 = await seg('装备', 'ui.openEquipPanel()');
  console.log('\n══ 装备 ' + (r4.w || '?') + '×' + (r4.h || '?') + ' 溢出 ' + r4.over + '（正文区 ' + r4.bodyH + '）');
  (r4.segs || []).forEach(function (s) { console.log('   ' + s); });
  await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });

  /* v89.112：本境调运（own 模式）—— 撤 252px 上限后是否整窗不下拉 */
  var r5 = await seg('本境调运', '(function(){var G=GAME,st=G.state;var to=st.cities[1];ui.openExpModal({kind:"own",id:to.id});})()');
  console.log('\n══ 本境调运 ' + (r5.w || '?') + '×' + (r5.h || '?') + ' 溢出 ' + r5.over + '（正文区 ' + r5.bodyH + '）');
  (r5.segs || []).forEach(function (s) { console.log('   ' + s); });
  await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });

  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
