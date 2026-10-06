/* ============================================================
 * shot_v89104_views.js — v89.104 界面整备实机截图（真浏览器 · 真 index.html）
 * ------------------------------------------------------------
 * 出图给老板拍板：设置页 / 自动页 / 军务四页签（总览·出征·军务处）/ 宝物页 /
 * 史册（待阅逸闻 4×5）/ 故事集 / 地图（放大 20% 后）。
 * 顺带量：弹窗/页面是否溢出、关键元素是否存在。
 * 用法：node .workbuddy/tools/show/shot_v89104_views.js
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
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  page.on('console', function (m) { if (m.type() === 'error') console.log('  [page:error]', m.text().slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 建局：三城 + 若干道具 + 两条待阅逸闻（都走游戏自己的出口） */
  var boot = await page.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260921 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 8e5; });
    c.res.pop = 30000;
    c.army = { yibing: 8000, gongjian: 3000, qingji: 1200 };
    c.cells.forEach(function (x) { if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 6); });
    st.items = st.items || {};
    ['shennongchu', 'zengminling', 'yiminling', 'zhenzhu', 'lianbing_jingyan', 'chest_tong', 'jinang']
      .forEach(function (id) { st.items[id] = 3; });
    st.wounded = 4200;
    st.woundedArmy = { yibing: 3000, changqiang: 1200 };
    st.reports = st.reports || [];
    st.reports.unshift({ t: Date.now(), type: 'scout', title: '侦查回报 · 黄巾寨', body: '守军约 3,200 名', win: true });
    /* 待阅逸闻：走 SG 的待阅队列（真数据） */
    try {
      G.SG.pendingPush && G.SG.pendingPush('bld-guanfu-01');
      G.SG.pendingPush && G.SG.pendingPush('bld-junying-01');
    } catch (e) {}
    G.ui.enterGame();            /* ⚠️ 必须真正进游戏场景（否则 setView 只在"创建君主"页上画，截图全一样） */
    G.ui.setView('city');
    G.refreshAll();
    return { ok: true, cities: st.cities.length, sgPending: (G.SG.pending ? G.SG.pending().length : -1) };
  });
  console.log('开局 =', JSON.stringify(boot));

  async function shot(name, view, extra) {
    await page.evaluate(function (v) { window.GAME.ui.setView(v); }, view);
    if (extra) await page.evaluate(extra);
    await new Promise(function (r) { setTimeout(r, 320); });
    await page.screenshot({ path: path.join(OUT, name) });
    var geo = await page.evaluate(function () {
      var vc = document.querySelector('#view-container');
      return { len: vc ? vc.innerHTML.length : -1,
        overflow: vc ? Math.max(0, vc.scrollHeight - vc.clientHeight) : -1 };
    });
    console.log('  ' + name + '　内容 ' + geo.len + ' 字　页面溢出 ' + geo.overflow + 'px');
  }

  await shot('v89104-settings.png', 'settings');
  await shot('v89104-auto.png', 'auto');
  await shot('v89104-march-exp.png', 'marches', function () { window.GAME.ui._marchTab = 'exp'; });
  await shot('v89104-march-affairs.png', 'marches', function () { window.GAME.ui._marchTab = 'affairs'; });
  await shot('v89104-bag.png', 'bag', function () {
    var G = window.GAME; G.ui._bagTab = 'item'; G.ui.renderBag();
  });
  /* v89.218：story / stories 视图已退役，截图项撤除。 */
  await shot('v89104-stories.png', 'stories');
  await shot('v89104-map.png', 'map');
  var mapGeo = await page.evaluate(function () {
    var f = window.GAME.ui.mapFrame || {};
    return { span: [f.spanX, f.spanY], cell: f.cell, zoom: window.GAME.ui.MAP_ZOOM };
  });
  console.log('地图：观察框 ' + mapGeo.span + ' · 格距 ' + mapGeo.cell + ' · 放大倍率 ' + mapGeo.zoom);

  await browser.close();
  console.log('done');
})().catch(function (e) { console.error('FAIL', e); process.exit(1); });
