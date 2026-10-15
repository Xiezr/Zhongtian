/* ============================================================
 * shot_v89107_beacon.js — v89.107 需求 1 实机图
 *   ① 军务 · 烽火页（预警 / 策略布防 / 烽火流水 三段）
 *   ② 城内棋盘：烽火台**明暗闪烁**（同场景抓两帧，逐像素比亮度差 = 闪烁的硬证据）
 * 顺带量：警报窗口（invasionAlertOf）、烽火台格的 .alarm 类、两帧亮度差
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var PNG = require('pngjs').PNG;
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260923 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    c.res.pop = 42000;
    c.army = { changqiang: 5000, gongjian: 2500, qingji: 900 };
    /* 城内：建烽火台（闪烁的载体）+ 几座同族建筑 */
    var free = [];
    c.cells.forEach(function (x, i) { if (!x.official) free.push(i); });
    [['fenghuotai', 3], ['junying', 4], ['chengqiang', 5], ['xiaochang', 2], ['minfang', 3], ['cangku', 3]]
      .forEach(function (b, i) { c.cells[free[i]].build = { id: b[0], lvl: b[1] }; });
    /* 第 2 座城（来袭解锁线 = 2 城） */
    var w = null;
    for (var r = 1; r <= 4 && !w; r++) {
      for (var dx = -r; dx <= r && !w; dx++) for (var dy = -r; dy <= r && !w; dy++) {
        var t = G.map.tile(c.x + dx, c.y + dy);
        if (t && t.terrain === 'plain') w = { x: c.x + dx, y: c.y + dy };
      }
    }
    if (w) { st.wilds.push({ x: w.x, y: w.y, type: 'plain', lv: 3 }); G.buildCityAt(w.x, w.y); }
    G.ui.enterGame();
    G.refreshAll();
    /* 拨进预警窗 → 真走 invasionTick 的报信分支（v89.111：拨到当日来犯时刻前 3 时） */
    st.world = st.world || {};
    st.world.elapsed = G.invasionDueOfDay(G.invasionDayOf(st.world.elapsed || 0)) - 3 * 3600;
    var wp = G.invasionWarnSec(c);
    G.invasionTick(0);
    /* 再补两条兵源/布防（让三段的第三段有内容） */
    G.schemeDefSet(c, 'kongcheng', (st.generals || [])[0]);
    var al = G.invasionAlertOf(c);
    G.ui._marchTab = 'beacon';
    G.ui.setView('marches');
    G.refreshAll();
    var tileCount = 0;
    document.querySelectorAll('#view-container .iso-tile.built .tile-art img.ico-img').forEach(function (im) {
      if (im.src.indexOf('ai_fenghuotai') >= 0) tileCount++;
    });
    return { cities: st.cities.length, alert: al ? al.hrs : 0,
      warnWindow: Math.round(wp.warnSec / 3600), beaconLv: wp.bc, towerImgs: tileCount };
  });
  console.log('开局：' + boot.cities + ' 城 · 烽火台 Lv' + boot.beaconLv +
    ' · 预警窗 ' + boot.warnWindow + ' 游戏时 · 当前警报余 ' + boot.alert + ' 时');
  await new Promise(function (r) { setTimeout(r, 460); });
  await page.screenshot({ path: path.join(OUT, 'v89107-beacon-page.png') });
  var geo = await page.evaluate(function () {
    var b = document.querySelector('#view-container');
    return { tabs: document.querySelectorAll('.march-tabs .mt').length,
      hasAlert: (b.textContent || '').indexOf('警报中') >= 0,
      hasPlan: (b.textContent || '').indexOf('策略布防') >= 0,
      over: (function () { var p = b.querySelector('.ui-page'); return p ? p.scrollHeight - p.clientHeight : -1; })() };
  });
  console.log('✓ v89107-beacon-page.png（军务页签 ' + geo.tabs + ' 个 · 警报中 ' + geo.hasAlert +
    ' · 含策略布防 ' + geo.hasPlan + ' · 纵向溢出 ' + geo.over + '）');

  /* ---- 闪烁证据：城内棋盘抓两帧（动画周期 1.15s，取 0 与 ~575ms）---- */
  await page.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'over';
    G.ui.setView('city');
    G.refreshAll();
  });
  await new Promise(function (r) { setTimeout(r, 420); });
  var box = await page.evaluate(function () {
    var im = null;
    document.querySelectorAll('#view-container .iso-tile.built .tile-art img.ico-img').forEach(function (x) {
      if (x.src.indexOf('ai_fenghuotai') >= 0 && !im) im = x;
    });
    if (!im) return null;
    var tile = im.closest('.iso-tile');
    var r = tile.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      alarm: tile.className.indexOf('alarm') >= 0 };
  });
  if (!box) { console.log('✗ 找不到烽火台格'); await browser.close(); process.exit(1); }
  console.log('烽火台格：.alarm ' + box.alarm + ' · ' + box.w + '×' + box.h + 'px @(' + box.x + ',' + box.y + ')');
  async function frame(file) {
    var buf = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
    fs.writeFileSync(file, buf);
    return PNG.sync.read(buf);
  }
  var f1 = await frame(path.join(OUT, 'v89107-beacon-blink-1.png'));
  await new Promise(function (r) { setTimeout(r, 575); });   /* ≈ 半个动画周期 → 最亮/最暗 */
  var f2 = await frame(path.join(OUT, 'v89107-beacon-blink-2.png'));
  var sum = 0, n = 0, mx = 0;
  for (var i = 0; i < f1.data.length; i += 4) {
    if (f1.data[i + 3] < 10) continue;
    var a = (f1.data[i] + f1.data[i + 1] + f1.data[i + 2]) / 3;
    var b = (f2.data[i] + f2.data[i + 1] + f2.data[i + 2]) / 3;
    var d = Math.abs(a - b); sum += d; n++;
    if (d > mx) mx = d;
  }
  console.log('两帧亮度差：平均 ' + (sum / Math.max(1, n)).toFixed(1) +
    ' · 最大 ' + mx.toFixed(0) + '（>12 即为肉眼可见的明暗变化）');
  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('失败：' + (e && e.stack || e)); process.exit(1); });
