/* 实机验证：棚户真的出现在城面板（有棚户那一行才渲染） */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '_shots');
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
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const { server, port } = await serve();
  const browser = await chromium.launch({ executablePath: MSEDGE, headless: true,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('http://127.0.0.1:' + port + '/index.html?demo=1', { waitUntil: 'load' });
  await page.waitForFunction('window.GAME && window.GAME.ui && window.GAME.state', null, { timeout: 30000 });
  await page.waitForTimeout(2500);

  /* 把人口推到居所上限，跑两个月，让棚户长出来 */
  const info = await page.evaluate(function () {
    var c = GAME.currentCity();
    var R = GAME.res(c);
    var cap = GAME.effPopCapOf(c);
    R.pop = Math.round(cap * 0.98);
    GAME.state.growthMonth = null;
    GAME.growth.tick(true);
    GAME.growth.tick(true);
    GAME.growth.tick(true);
    if (GAME.ui.openCityPanel) GAME.ui.openCityPanel(c);
    return { cap: cap, pop: R.pop, shanty: GAME.growth.shantyOf(c),
             cap2: GAME.growth.shantyCapOf(c), line: GAME.growth.lineOf(c) };
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '07-shanty.png'), timeout: 60000 });

  /* 行政页：世界还剩多少文明 */
  await page.evaluate(function () {
    GAME.ui.closeAllModals();
    if (GAME.ui.setView) GAME.ui.setView('admin');
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '08-world.png'), timeout: 60000 });

  console.log(JSON.stringify(info, null, 2));
  console.log('页面错误：', errors.length ? errors.slice(0, 3) : '无');
  await browser.close();
  server.close();
})().catch(e => { console.error('失败', e && e.message); process.exit(1); });
