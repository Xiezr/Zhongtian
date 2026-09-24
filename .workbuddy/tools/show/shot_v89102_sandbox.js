/* ============================================================
 * shot_v89102_sandbox.js — 沙盘实机截图（真浏览器）
 * ------------------------------------------------------------
 * 出一张图给老板拍板：新建一局 → 造一场仗 → 打开战报沙盘 →
 * 分别截「回放态」「推演态」。渲染的是真 index.html（file://），
 * 素材（ai_*.png）走真实相对路径 —— 顺带验证素材层在真浏览器里加载。
 * 用法：node .workbuddy/tools/show/shot_v89102_sandbox.js
 * 产出：.workbuddy/shots/v89102-sandbox-replay.png / -sim.png
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) {
    var alt = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
    exe = fs.existsSync(alt) ? alt : exe;
  }
  console.log('browser =', exe, fs.existsSync(exe) ? '(ok)' : '(MISSING)');
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  page.on('console', function (m) { if (m.type() === 'error') console.log('  [page:error]', m.text().slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 建局 + 打一场（全部走游戏自己的出口，不碰存档） */
  var info = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    st.settings.battleWatch = false;
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 5e6; });
    c.res.pop = 60000;
    c.cells.forEach(function (x) { if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 8); });
    var gen = st.generals[0];
    gen.level = 25;
    G.setStaNow(gen, 9999); gen.energy = 100;
    /* 找一座据点（有箭塔的攻城战，画面最全） */
    var t = null;
    for (var y = 0; y < 61 && !t; y++) {
      for (var x = 0; x < 61; x++) {
        var f = G.map.fortAt(x, y);
        if (f && f.level >= 5 && f.level <= 7) { t = { kind: 'fort', x: x, y: y }; break; }
      }
    }
    if (!t) for (var y2 = 4; y2 < 40 && !t; y2++) {
      for (var x2 = 4; x2 < 40; x2++) {
        var tl = G.map.tile(x2, y2);
        if (tl && tl.terrain !== 'city' && !G.map.fortAt(x2, y2) && G.map.wildLevelNow(x2, y2) >= 4) {
          t = { kind: 'wild', x: x2, y: y2 }; break;
        }
      }
    }
    /* ⚠️ 必须传**副本**：expedition 会 `city.army[a3] -= atkArmy[a3]`，
       若把 `c.army` 直接当 atkArmy 传进去，两者是同一个对象 → 自我清零（0 兵打仗）。
       本脚本第一版就是这么踩的（截图里沙盘打不开，排查到配方里兵力全是 0）。 */
    var army = { qingji: 6000, gongjian: 4000, changqiang: 4000, daodun: 2000 };
    c.army = Object.assign({}, army);
    var r = G.battle.expedition(t, 'raid', army, gen.id);
    G.ui.enterGame && G.ui.enterGame();
    return { msg: r && r.msg, n: st.reports.length, title: st.reports[0] && st.reports[0].title };
  });
  console.log('战果：', info.msg, '· 战报', info.n, '份 ·', info.title);

  /* 打开公文页 → 点第一条战报 → 沙盘 */
  await page.evaluate(function () {
    window.GAME.ui.setView('reports');
  });
  await page.waitForTimeout(500);
  var ok = await page.evaluate(function () {
    var btn = document.querySelector('[data-action="view-report"]');
    if (!btn) return 'no-btn';
    btn.click();
    return 'clicked';
  });
  console.log('view-report:', ok);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'v89102-sandbox-replay.png') });
  console.log('已存 v89102-sandbox-replay.png');

  /* 跳到中段一帧（有位移与杀伤），再截一张推演态 */
  await page.evaluate(function () {
    var G = window.GAME;
    var max = Number((document.getElementById('sd-range') || {}).max || 0);
    G.ui.sdSet(Math.max(1, Math.round(max * 0.45)));
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'v89102-sandbox-mid.png') });
  console.log('已存 v89102-sandbox-mid.png');

  var simOk = await page.evaluate(function () {
    var G = window.GAME;
    var b = document.querySelector('[data-action="sd-sim"]');
    if (!b || b.disabled) return 'sim-disabled';
    b.click();
    return 'sim-on';
  });
  console.log('推演：', simOk);
  await page.waitForTimeout(500);
  await page.evaluate(function () {
    var b = document.querySelector('[data-action="sd-done"]');
    if (b) b.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(function () {
    var b = document.querySelector('[data-action="sd-done"]');
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'v89102-sandbox-sim.png') });
  console.log('已存 v89102-sandbox-sim.png');

  /* 几何验证（老板硬规矩：弹窗内不做下拉）——量真实高度差，不靠肉眼 */
  var geo = await page.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var body = root.querySelector('.m-body');
    var board = root.querySelector('.sd-board');
    var rows = root.querySelectorAll('.sd-row').length;
    return {
      rows: rows,
      bodyClient: body ? body.clientHeight : -1,
      bodyScroll: body ? body.scrollHeight : -1,
      wrapH: (document.getElementById('sd-wrap') || {}).offsetHeight || -1,
      boardH: board ? board.offsetHeight : -1,
      lane: getComputedStyle(root.querySelector('.sd-row') || document.body).height,
      overflow: body ? (body.scrollHeight - body.clientHeight) : -1,
    };
  });
  console.log('几何：行数 ' + geo.rows + ' · 泳道高 ' + geo.lane + ' · 沙盘高 ' + geo.boardH
    + ' · 正文可滚区 ' + geo.bodyClient + ' / 内容 ' + geo.bodyScroll
    + ' → 溢出 ' + geo.overflow + 'px ' + (geo.overflow <= 2 ? '✅ 无下拉' : '❌ 有下拉'));

  /* 素材层实证：真浏览器里 img 是否加载成功 */
  var imgStat = await page.evaluate(function () {
    var ims = Array.prototype.slice.call(document.querySelectorAll('#modal-root img'));
    var ok = 0, bad = [];
    ims.forEach(function (im) {
      if (im.complete && im.naturalWidth > 0) ok++;
      else bad.push((im.getAttribute('src') || '').slice(-28));
    });
    return { total: ims.length, ok: ok, bad: bad.slice(0, 5) };
  });
  console.log('素材层：img ' + imgStat.ok + '/' + imgStat.total + ' 已加载'
    + (imgStat.bad.length ? '　未加载：' + imgStat.bad.join(', ') : ''));

  await browser.close();
})();
