/* ============================================================
 * tools/shot-eval.js —— 玩家视角实机截图（评估用）
 * ------------------------------------------------------------
 * 老板 2026-10-23：「这个游戏目前为止好玩吗，对于人类来说。
 *   你找找标准，好好评估一下。有些地方可能不符合人类的思维和审美」
 *
 * jsdom 能证明 DOM 对，证明不了"人类看到的是什么"。
 * 这个脚本拍四张：
 *   1. 创建角色（第一眼）
 *   2. 前传 · 地图（进去 10 秒看到的东西）
 *   3. 前传 · 世界账本（荒野行动藏在哪）
 *   4. 城市页（最常看的界面）
 *
 * 用法：
 *   NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
 *     node tools/shot-eval.js
 * 产物：tools/_shots/e1..e4-*.png
 * ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '_shots');
const MSEDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

function serve() {
  return new Promise(function (res) {
    const s = http.createServer(function (req, rep) {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rep.writeHead(404); rep.end('nope'); return; }
      rep.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rep);
    });
    s.listen(0, '127.0.0.1', function () { res(s); });
  });
}

(async function () {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ executablePath: MSEDGE, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 760 } });
  page.on('pageerror', (e) => console.error('PAGEERR', e.message));

  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);

  /* ① 创建角色：第一眼 */
  await page.screenshot({ path: path.join(OUT, 'e1-create.png'), timeout: 60000 });
  const c1 = await page.evaluate(function () {
    return { tabs: document.querySelectorAll('#screen-create [data-target]').length,
      text: (document.querySelector('#screen-create') || {}).innerText || '' };
  });
  console.error('CREATE ' + JSON.stringify(c1).slice(0, 400));

  /* ② 前传：直接建一个前传档并进游戏（等价玩家点完创建） */
  await page.evaluate(function () {
    GAME.newGame({ name: '评估', avatar: '🧔', gender: 'male', region: 'random', prologue: true });
    GAME.map.generate && GAME.map.generate();
    GAME.ui.enterGame();
  });
  await page.waitForTimeout(13000);   /* 首次进图分帧构建 40962 格 */
  await page.evaluate(function () {
    var c = GAME.currentCity();
    if (c && GAME.ui.mapCenterOn) { try { GAME.ui.mapCenterOn(c.x, c.y); } catch (e) {} }
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'e2-prologue-map.png'), timeout: 60000 });

  const c2 = await page.evaluate(function () {
    return { view: GAME.ui.view, on: GAME.prologue.on(),
      visibleText: (document.querySelector('#view-root') || document.body).innerText
        .replace(/\s+/g, ' ').slice(0, 500) };
  });
  console.error('PROLOGUE ' + JSON.stringify(c2));

  /* ③ 全世界账本（前传期已经不看它了；这里只取文本，不截图 —— 截图曾超时 60s） */
  await page.evaluate(function () { GAME.ui.openWorldPanel(); });
  await page.waitForTimeout(1500);
  try {
    await page.screenshot({ path: path.join(OUT, 'e3-worldpanel.png'), timeout: 15000 });
  } catch (e) { console.error('E3-SHOT-TIMEOUT'); }
  const c3 = await page.evaluate(function () {
    var m = document.querySelector('#modal-root');
    return { text: (m || {}).innerText ? m.innerText.replace(/\s+/g, ' ').slice(0, 900) : '' };
  });
  console.error('WORLD ' + JSON.stringify(c3));

  /* ④ 城市页（立城之后才有的东西，这里直接关前传看） */
  await page.evaluate(function () {
    GAME.ui.closeAllModals && GAME.ui.closeAllModals();
    if (GAME.prologue.on()) { var l = GAME.prologue.lord(); if (l) l.level = 20; GAME.prologue.build(); }
    GAME.ui.setView('city');
  });
  await page.waitForTimeout(2500);
  try { await page.screenshot({ path: path.join(OUT, 'e4-city.png'), timeout: 30000 }); } catch (e) { console.error('E4-TIMEOUT'); }
  const c4 = await page.evaluate(function () {
    var r = document.querySelector('#view-root') || document.body;
    return { text: r.innerText.replace(/\s+/g, ' ').slice(0, 900),
      btns: r.querySelectorAll('[data-action]').length };
  });
  console.error('CITY ' + JSON.stringify(c4));

  /* ⑤ 行政页（空状态兜底 / 势力块） */
  await page.evaluate(function () {
    GAME.ui.closeAllModals && GAME.ui.closeAllModals();
    GAME.ui.setView('admin');
  });
  await page.waitForTimeout(1200);
  try { await page.screenshot({ path: path.join(OUT, 'e5-admin.png'), timeout: 20000 }); } catch (e) { console.error('E5-TIMEOUT'); }
  const c5 = await page.evaluate(function () {
    var r = document.querySelector('#view-container') || document.body;
    return { text: r.innerText.replace(/\s+/g, ' ').slice(0, 700) };
  });
  console.error('ADMIN ' + JSON.stringify(c5));

  /* ⑥ v118：顶栏折叠 —— 数「看得见几个」，不是数 DOM 里几个 */
  const navCount = async () => page.evaluate(function () {
    var tabs = [].slice.call(document.querySelectorAll('#topnav .tab'));
    return {
      total: tabs.length,
      visible: tabs.filter(function (t) { return t.offsetParent !== null; })
        .map(function (t) { return t.dataset.view || t.textContent.trim(); })
    };
  });
  try {
    if (await page.evaluate(function () {
      return !!(GAME.prologue && GAME.prologue.on());
    })) {
      await page.evaluate(function () {
        var l = GAME.prologue.lord();
        if (l) l.level = GAME.prologue.needLv();
        GAME.prologue.build();
        GAME.ui.refreshView();
      });
      await page.waitForTimeout(1500);
    }
    const c6 = await navCount();
    console.error('NAV-CLOSED ' + JSON.stringify(c6));
    try { await page.screenshot({ path: path.join(OUT, 'e6-nav-closed.png'), timeout: 20000 }); } catch (e) {}
    await page.click('#nav-more-btn');
    await page.waitForTimeout(500);
    const c7 = await navCount();
    console.error('NAV-OPEN ' + JSON.stringify(c7));
    try { await page.screenshot({ path: path.join(OUT, 'e7-nav-open.png'), timeout: 20000 }); } catch (e) {}
    await page.evaluate(function () { GAME.ui.setView('shop'); });
    await page.waitForTimeout(600);
    const c8 = await navCount();
    console.error('NAV-SHOP ' + JSON.stringify(c8));
  } catch (e) { console.error('NAV-ERR ' + e.message); }

  await browser.close();
  srv.close();
  console.log('done');
  process.exit(0);
})().catch(function (e) { console.error('FAIL', e); process.exit(1); });
