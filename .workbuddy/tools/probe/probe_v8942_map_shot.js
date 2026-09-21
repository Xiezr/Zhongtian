/* _shot_map.js — 地图视图截图探针（before/after 通用 · v89.42）
 * 用法: NODE_PATH=<...> node probe_v8942_map_shot.js [输出前缀]
 * 要点：内置 HTTP 服务（file:// 下贴图会污染 canvas，toDataURL 导出被拒）；
 *       锁定地图 seed=4242 保证前后地形一致；自动挑"野地种类最多"的视野中心；
 *       同时导出 canvas 原始像素（_raw.png）与逐格地形快照（_grid.json）。
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2] || 'E:/Deepseekdb/.workbuddy/tmp/v8942_map';
const FORCE_SEED = 4242;
const ROOT = path.resolve('E:/Deepseekdb');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const URL = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const b = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(URL);
  await p.waitForTimeout(1500);

  const startInfo = await p.evaluate((seed) => {
    GAME.newGame({ name: '演示君主', avatar: '🧔', gender: 'male', region: 'random' });
    const s = GAME.state;
    s.map.seed = seed;
    s.map.grid = null;
    s.map.cities = null;
    s.map.wilds = null;
    if (GAME.map) GAME.map._wonderSites = null;
    GAME.map.generate();
    /* 跳过首页/创建界面直进游戏（enterGame 内部会 setView('city')） */
    if (GAME.ui && GAME.ui.enterGame) GAME.ui.enterGame();
    else {
      var sc = document.querySelector('#screen-create'); if (sc) sc.classList.add('hidden');
      var sg = document.querySelector('#screen-game'); if (sg) sg.classList.remove('hidden');
    }
    var hid = [];
    ['screen-home', 'screen-create'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.classList.add('hidden'); hid.push(id); }
    });
    return { seed: s.map.seed, start: s.map.startPos, view: GAME.ui.view, hidden: hid };
  }, FORCE_SEED);
  await p.waitForTimeout(400);

  await p.evaluate(() => { GAME.ui.setView('map'); });
  await p.waitForTimeout(400);

  /* 选视野中心：13×7 视窗内"野地种类"最多者 */
  const pick = await p.evaluate(() => {
    const fr = GAME.ui.mapFrame || { spanX: 13, spanY: 7 };
    const hx = Math.ceil(fr.spanX / 2) + 1, hy = Math.ceil(fr.spanY / 2) + 1;
    let best = null;
    for (let y = 40; y < 460; y += 9) {
      for (let x = 40; x < 460; x += 9) {
        const cnt = {};
        for (let dy = -hy; dy <= hy; dy++) {
          for (let dx = -hx; dx <= hx; dx++) {
            const t = GAME.map.tile(x + dx, y + dy);
            if (t) cnt[t.terrain] = (cnt[t.terrain] || 0) + 1;
          }
        }
        const wildKinds = Object.keys(cnt).filter((k) => k !== 'plain' && k !== 'city').length;
        const kinds = Object.keys(cnt).length;
        const score = wildKinds * 1000 + kinds;
        if (!best || score > best.score) best = { x, y, score, cnt, wildKinds };
      }
    }
    return best;
  });
  console.log('START ' + JSON.stringify(startInfo));
  console.log('PICK ' + JSON.stringify(pick));

  await p.evaluate((c) => { GAME.ui.mapCenterOn(c.x, c.y); }, pick);

  /* 等位图就绪（before 场景没有素材，等 3s 即走） */
  const t0 = Date.now();
  let art = -1;
  while (Date.now() - t0 < 8000) {
    art = await p.evaluate(() => (GAME.map.artCount ? GAME.map.artCount() : -2));
    if (art >= 7) break;
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(800);

  const info = await p.evaluate(() => {
    const el = document.getElementById('mapCanvas');
    const r = el ? el.getBoundingClientRect() : null;
    return {
      art: GAME.map.artCount(),
      frame: GAME.ui.mapFrame,
      view: { x: GAME.ui.mapView.x, y: GAME.ui.mapView.y },
      curView: GAME.ui.view,
      canvas: r ? { x: r.x, y: r.y, w: r.width, h: r.height, disp: getComputedStyle(el).display } : null,
    };
  });
  console.log('INFO ' + JSON.stringify(info));
  const el = await p.$('#mapCanvas');
  await el.screenshot({ path: OUT + '_canvas.png' });
  /* 1:1 原始像素（canvas backing store，最真实的分析信号） */
  const raw = await p.evaluate(() => {
    const c = document.getElementById('mapCanvas');
    return c.toDataURL('image/png');
  });
  require('fs').writeFileSync(OUT + '_raw.png', Buffer.from(raw.split(',')[1], 'base64'));
  /* 逐格地形快照（分析用：格号 → 地形 + 屏幕几何） */
  const grid = await p.evaluate(() => {
    const v = GAME.map._view;
    const out = { view: v, tiles: [] };
    for (let gy = v.vy - 9; gy <= v.vy + 9; gy++) {
      for (let gx = v.vx - 11; gx <= v.vx + 11; gx++) {
        const t = GAME.map.tile(gx, gy);
        if (!t) continue;
        out.tiles.push({ gx: gx, gy: gy, terrain: t.terrain });
      }
    }
    return out;
  });
  require('fs').writeFileSync(OUT + '_grid.json', JSON.stringify(grid));
  await p.screenshot({ path: OUT + '_full.png' });
  console.log('INFO ' + JSON.stringify(info));
  console.log('ERRORS ' + JSON.stringify(errs.slice(0, 10)));
  await b.close();
  server.close();
  console.log('SHOT_OK');
})().catch((e) => { console.error('FAIL ' + e.message + '\n' + (e.stack || '')); process.exit(1); });
