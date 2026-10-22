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

  /* 球面是**进地图时才建**的 —— 不进去，faction 选不出核心，stats() 恒为空。
     所以先进地图、等 cells 真的到位，再注入恩怨。 */
  await page.evaluate(function () {
    if (GAME.ui.setView) GAME.ui.setView('map');
    if (GAME.map3d && GAME.map3d.rebuild) GAME.map3d.rebuild();
  });
  await page.waitForFunction('window.GAME && GAME.sphere && GAME.sphere.cells && GAME.sphere.cells.length > 0',
    null, { timeout: 60000 });
  await page.waitForTimeout(3000);

  /* 给四家注入不同的"记忆"，看意图是否各说各话 */
  const info = await page.evaluate(function () {
    GAME.faction.ensure();
    var arr = GAME.faction.arr();
    /* ⚠️ A8（v92.12）：核心未探明 → 面板显示「？？？」，连意图都看不到。
       这是对的（不知道是谁就不该知道它想干什么），但截图要验证意图，
       所以先把四家老巢点亮 —— 等价于"玩家已经派侦察队找到它们了"。 */
    arr.forEach(function (f) { if (GAME.fog && GAME.fog.bump) GAME.fog.bump(f.core, GAME.fog.ALL); });
    arr.forEach(function (x) {
      var d = GAME.faction.defOf(x.id) || {};
      if (d.persona === 'raider') x.standing = { g: 62, f: 10, t: 0 };   /* 恨你、不怕 → 集结 */
      else if (d.persona === 'holder') x.standing = { g: 70, f: 90, t: 0 }; /* 又恨又怕 → 绕开 */
      else if (d.persona === 'zealot') x.standing = { g: 80, f: 20, t: 0 }; /* 不怕 → 集结 */
      else x.standing = { g: 20, f: 0, t: 30 };                            /* 商盟 → 做生意 */
    });
    GAME.ui.setView('admin');
    return GAME.faction.stats().map(function (x) {
      return x.name + '→' + x.intent.name + '（' + x.intent.because + '）';
    });
  });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, '09-intent.png'), timeout: 60000 });

  console.log(JSON.stringify(info, null, 2));
  console.log('页面错误：', errors.length ? errors.slice(0, 3) : '无');
  await browser.close();
  server.close();
})().catch(e => { console.error('失败', e && e.message); process.exit(1); });
