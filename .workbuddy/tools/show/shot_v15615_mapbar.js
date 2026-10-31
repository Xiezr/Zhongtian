/* v156.15 实机：地图手势条（⚔️出征 / 🔍侦查 / 📜详情）
 * 用法：node .workbuddy/tools/show/shot_v15615_mapbar.js
 * 产出：.workbuddy/shots/v15615-mapbar.png · v15615-detail.png · v15615-scout.png
 *
 * 为什么要有这个探针：3D 分支在 smoke/e2e 里 **0 覆盖**（jsdom 无 WebGL），
 * 「点地图先出短条、详情能回旧面板」这件事只能实机验（项目规矩：界面类先截图）。
 *
 * 走的是**真点击**：先把相机对准一块普通陆地 → 点画布中心 → 看是不是 pickAt 那条路
 * 弹出了手势条（而不是直接弹长面板）。
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({
    executablePath: exe,
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String((e && e.message) || e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var setup = await p.evaluate(function () {
    /* ⚠️ 整个 setup 用 try 包住：当前工作树有一处**既存**的渲染期异常（three 内部
       uniform/texture 上传，见 需求档案 v156.15「已知未修」），第一次 render 会抛一次，
       而 enterGame / setView / centerOn 都会同步触发一次 render。吞掉它继续 ——
       探针要验的是手势条，不是那处异常。 */
    try {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    /* 关掉前传：本探针验的是**立城之后**的地图手势 */
    if (G.prologue) {
      try { if (G.prologue.off) G.prologue.off('shot-15615'); } catch (e) {}
      if (st.prologue) st.prologue.on = false;
    }
    st.cities[0].pid = 1;
    G.ui._cityId = st.cities[0].id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    /* ⚠️ enterGame 落在「城」视图 —— 必须先切到地图，否则点画布什么都不会发生
       （而且 3D 拾取壳也只有进过地图才 build，`_collider` 才存在）。
       注意：当前工作树有一处**既存**的渲染期异常（three 内部 uniform/texture 上传，
       见 需求档案 v156.15「已知未修」），第一次 render 会抛一次；这里吞掉它，
       后面几帧仍然正常渲染 —— 探针要验的是手势条，不是那处异常。 */
    try { if (G.ui.setView) G.ui.setView('map'); } catch (eSet) {}
    var c0 = st.cities[0];
    var sph = (G.sphereOf ? G.sphereOf() : G.sphere);
    var SP = G.sphere || {};
    var best = null;
    /* 用球面内核的 hopsWithin 取城周围 4 环，再从里面挑一块干净的平原 */
    var near = (SP.hopsWithin && c0.ci >= 0) ? SP.hopsWithin(c0.ci, 4) : [];
    near.forEach(function (ci) {
      if (best) return;
      var c = sph.cells && sph.cells[ci];
      if (!c || c.type !== 'plain') return;
      if (G.map.ownCityAt && G.map.ownCityAt(ci)) return;
      if (G.map.npcAt && G.map.npcAt(ci)) return;
      if (G.camp && G.camp.isFound && G.camp.isFound(ci)) return;
      if (G.village && G.village.at && G.village.at(ci)) return;
      if (G.ruin && G.ruin.isFound && G.ruin.isFound(ci)) return;
      best = { ci: ci, x: c.x, y: c.y };
    });
    if (!best) return { err: '没找到合适的平原格', nearCount: near.length };
    /* 相机对准它（点一下地图中心就命中这一格） */
    try { if (G.map3d && G.map3d.centerOn) G.map3d.centerOn(best.x, best.y); } catch (e2) {}
    return { cityCi: c0.ci, target: best,
      map3d: !!(G.map3d && G.map3d.enabled) };
    } catch (eAll) { return { err: 'setup 抛错: ' + (eAll && eAll.message) }; }
  });

  if (setup.err) { console.log('setup=' + JSON.stringify(setup)); await b.close(); return; }
  await p.waitForTimeout(1600);   /* 等 3D 星球 build 完（拾取壳就绪） */
  /* 切到地图后可能又弹新手连续弹窗 —— 再关一次，保证点击落在画布上 */
  await p.evaluate(function () { try { GAME.ui.closeAllModals(); } catch (e) {} });
  await p.evaluate(function (tg) {
    /* 同一处既存渲染异常：吞掉（它只抛一次，后续帧正常） */
    try { if (GAME.map3d && GAME.map3d.centerOn) GAME.map3d.centerOn(tg.x, tg.y); } catch (e) {}
  }, setup.target);
  await p.waitForTimeout(700);

  /* —— 1. 真点一下地图中心 —— */
  var canvas = await p.$('#mapCanvas');
  var box = canvas ? await canvas.boundingBox() : null;
  if (box) await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForTimeout(500);
  var step1 = await p.evaluate(function () {
    var t = (document.getElementById('modal-root') || {}).textContent || '';
    return {
      bar: !!document.querySelector('[data-action="mapbar-march"]'),
      march: !!document.querySelector('[data-action="mapbar-scout"]'),
      detail: !!document.querySelector('[data-action="mapbar-detail"]'),
      title: t.slice(0, 40), modalChars: t.length,
      mapBar: window.GAME.ui._mapBar ? { ci: GAME.ui._mapBar.ci, kind: GAME.ui._mapBar.kind,
        target: GAME.ui._mapBar.target && GAME.ui._mapBar.target.kind } : null,
      cellKind: window.GAME.map3d && GAME.map3d._cellKind
    };
  });
  await p.screenshot({ path: '.workbuddy/shots/v15615-mapbar.png' });

  /* 真点击没弹出条（例如那一格是自己的城/营地）→ 用同一入口直接开一次，至少把 UI 验完 */
  var fallback = null;
  if (!step1.bar) {
    fallback = await p.evaluate(function (tg) {
      var G = window.GAME;
      var bt = G.map3d.barTargetOf(tg.ci, 'wild');
      if (!bt) return { opened: false, why: 'barTargetOf null' };
      var opened = G.ui.openMapBar({ ci: tg.ci, kind: 'wild', target: bt.target, openAs: bt.openAs });
      return { opened: !!opened, target: bt.target };
    }, setup.target);
    await p.waitForTimeout(400);
    await p.screenshot({ path: '.workbuddy/shots/v15615-mapbar.png' });
  }

  /* —— 2. 详情 → 必须回到旧长面板 —— */
  var step2 = await p.evaluate(async function () {
    var btn = document.querySelector('[data-action="mapbar-detail"]');
    if (!btn) return { clicked: false };
    btn.click();
    await new Promise(function (r) { setTimeout(r, 450); });
    var t = (document.getElementById('modal-root') || {}).textContent || '';
    return { clicked: true, chars: t.length,
      /* 未占野地 = 「🏕️ 平原 Lv8 + 产出 + 侦查/掠夺/占领」；已占野地 = 「地块操作」那一栏。
         两种都算"回到了旧面板" —— 判据按"旧面板独有的东西"认，不按某一个词。 */
      oldPanel: t.indexOf('产出') >= 0 || t.indexOf('地块操作') >= 0,
      oneKey: t.indexOf('侦查') >= 0 && (t.indexOf('占领') >= 0 || t.indexOf('一键出征') >= 0) };
  });
  await p.screenshot({ path: '.workbuddy/shots/v15615-detail.png' });

  /* —— 3. 侦查 → 统一出征面板（方式预设 scout） —— */
  var step3 = await p.evaluate(async function (tg) {
    var G = window.GAME;
    G.ui.closeAllModals();
    var bt = G.map3d.barTargetOf(tg.ci, 'wild');
    if (!bt) return { clicked: false, why: 'barTargetOf null' };
    G.ui.openMapBar({ ci: tg.ci, kind: 'wild', target: bt.target, openAs: bt.openAs });
    var btn = document.querySelector('[data-action="mapbar-scout"]');
    if (!btn) return { clicked: false, why: 'no scout btn' };
    btn.click();
    await new Promise(function (r) { setTimeout(r, 450); });
    var t = (document.getElementById('modal-root') || {}).textContent || '';
    return { clicked: true, chars: t.length, expMode: G.ui._expMode || null,
      isExpPanel: t.indexOf('兵力') >= 0 || t.indexOf('方式') >= 0 };
  }, setup.target);
  await p.screenshot({ path: '.workbuddy/shots/v15615-scout.png' });

  console.log('setup=' + JSON.stringify(setup));
  console.log('click=' + JSON.stringify(step1));
  console.log('fallback=' + JSON.stringify(fallback));
  console.log('detail=' + JSON.stringify(step2));
  console.log('scout=' + JSON.stringify(step3));
  console.log('pageerrors=' + (errs.length ? errs.join(' | ') : '0'));
  await b.close();
})();
