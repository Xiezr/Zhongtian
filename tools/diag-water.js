/* ============================================================
 * tools/diag-water.js —— 临时诊断：候选地点里有多少掉进水里
 * ------------------------------------------------------------
 * 起因：地图截图里村社点看着压在蓝色海面上，但 §306⑪ 断言说"水上 0 处"。
 * 断言只跑了 mapSeed=4321 一个种子 —— **单种子测试证明不了所有种子**。
 * 这个脚本在真实页面上（随机种子）数一遍。
 * ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const MSEDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise(function (res) {
    const s = http.createServer(function (req, rep) {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rep.writeHead(404); rep.end('no'); return; }
      rep.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rep);
    });
    s.listen(0, '127.0.0.1', function () { res({ server: s, port: s.address().port }); });
  });
}

(async function () {
  const { server, port } = await serve();
  const browser = await chromium.launch({ executablePath: MSEDGE, headless: true,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto('http://127.0.0.1:' + port + '/index.html?demo=1', { waitUntil: 'load' });
  await page.waitForFunction('window.GAME && window.GAME.ui && window.GAME.state', null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  /* 球面 cells 是**进地图时**才建（懒加载）—— 不进去，sp.cells 是 undefined。 */
  await page.evaluate(function () {
    if (GAME.ui.setView) GAME.ui.setView('map');
    if (GAME.map3d && GAME.map3d.rebuild) GAME.map3d.rebuild();
  });
  await page.waitForTimeout(14000);

  const info = await page.evaluate(function () {
    var sp = GAME.mapSphere || GAME.sphere || null;
    var out = {
      hasSphere: !!sp,
      hasCells: !!(sp && sp.cells),
      nCells: (sp && sp.cells) ? sp.cells.length : -1,
      hasVillage: !!(GAME.village && GAME.village.list),
      hasCamp: !!(GAME.camp && GAME.camp.list),
      hasRuin: !!(GAME.ruin && GAME.ruin.list),
      seed: (GAME.state && GAME.state.map && GAME.state.map.seed)
    };
    if (!out.hasCells) return out;
    function stat(list, name) {
      if (!list || !list.length) return { name: name, total: 0, note: 'empty' };
      var lake = 0, none = 0, ok = 0;
      for (var i = 0; i < list.length; i++) {
        var c = sp.cells[list[i]];
        if (!c) { none++; continue; }
        if (c.type === 'lake') lake++; else ok++;
      }
      return { name: name, total: list.length, lake: lake, ok: ok, none: none };
    }
    try { out.village = stat(GAME.village.list(), 'village'); } catch (e) { out.village = 'ERR:' + e.message; }
    try { out.camp = stat(GAME.camp.list(), 'camp'); } catch (e) { out.camp = 'ERR:' + e.message; }
    try { out.ruin = stat(GAME.ruin.list(), 'ruin'); } catch (e) { out.ruin = 'ERR:' + e.message; }
    /* 🔑 关键验证：渲染用的 _tileCells 到底是"按 ci 索引"还是"按局部下标"？
       M._collider.cells 就是内部分块数组（map3d 里 _tileCells = cells）。 */
    var col = GAME.map3d && GAME.map3d._collider && GAME.map3d._collider.cells;
    if (col && col.length) {
      var bad = 0, sample = [];
      for (var i = 0; i < col.length; i++) {
        if (!col[i]) continue;
        if (col[i].ci !== i) {
          bad++;
          if (sample.length < 3) sample.push({ idx: i, ci: col[i].ci });
        }
      }
      out.tileCells = { len: col.length, mismatch: bad, sample: sample };
    } else {
      out.tileCells = 'no collider cells';
    }
    return out;
  });
  console.log(JSON.stringify(info, null, 2));
  console.log('页面错误：', errors.length ? errors.slice(0, 3) : '无');

  await browser.close();
  server.close();
})().catch(e => { console.error('失败', e && e.message); process.exit(1); });
