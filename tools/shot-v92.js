/* ============================================================
 * tools/shot-v92.js —— 无头实机截图（迷雾 / 纪念碑 / 军务页签）
 * ------------------------------------------------------------
 * 为什么要有这个脚本：jsdom 能证明"DOM 结构对"，证明不了"雾真的画出来了"。
 * 迷雾是一个 THREE 网格，只有真 WebGL 上下文才看得见。
 *
 * 用法：
 *   NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
 *     node tools/shot-v92.js
 * 产物：tools/_shots/*.png
 * ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '_shots');
const MSEDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.json': 'application/json', '.svg': 'image/svg+xml' };

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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  /* ?demo=1 是项目内置的"直接开局"入口（main.js boot 里）——
     直接 newGame 只会建状态，不会切界面，截图还是开场层。 */
  await page.goto('http://127.0.0.1:' + port + '/index.html?demo=1', { waitUntil: 'load' });
  await page.waitForFunction('window.GAME && window.GAME.ui && window.GAME.state', null, { timeout: 30000 });
  await page.waitForTimeout(2000);

  /* 进地图 */
  await page.evaluate(function () {
    if (GAME.ui.setView) GAME.ui.setView('map');
    if (GAME.map3d && GAME.map3d.rebuild) GAME.map3d.rebuild();
  });
  /* 首次进地图要分帧构建 40962 格（有进度遮罩）—— 等它撤掉再截，否则拍到的是"构建中"。 */
  await page.waitForTimeout(12000);
  /* 对准主城（等价玩家点"回主城"）：整球视角下 0.1% 的亮区只有几个像素，看不出效果。 */
  await page.evaluate(function () {
    var c = GAME.currentCity();
    if (c && GAME.ui.mapCenterOn) { try { GAME.ui.mapCenterOn(c.x, c.y); } catch (e) { } }
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, '01-map-fog.png') });

  /* 报告探明度 + 雾层网格是否存在 */
  const stat = await page.evaluate(function () {
    const s = GAME.fog.stats();
    return { seen: s.seen, total: s.total, pct: s.pct,
      hasMemorial: !!GAME.memorial, tabs: (GAME.ui.MARCH_TABS || []).map(t => t[1]) };
  });

  /* 强行点亮一大片（模拟长期远征）→ 看雾的边界 */
  await page.evaluate(function () {
    const city = GAME.currentCity();
    const ci = city.ci >= 0 ? city.ci : 0;
    for (let r = 0; r < 40; r++) GAME.fog.revealAround(ci, r, r % 3 === 0 ? GAME.fog.ALL : GAME.fog.TERRAIN);
    if (GAME.map3d.rebuild) GAME.map3d.rebuild();
  });
  /* 相机对准主城（否则可能正对着球背面，亮区看不见） */
  await page.evaluate(function () {
    var c = GAME.currentCity();
    if (c && GAME.map3d.centerOn) { try { GAME.map3d.centerOn(c.x, c.y); } catch (e) { } }
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '02-map-revealed.png') });

  const diag = await page.evaluate(function () {
    const m = GAME.map3d;
    const s = GAME.fog.stats();
    return {
      fogVer: GAME.fog.ver(), mFogVer: m._fogVer,
      fogTris: (m._fogDark && m._fogDark.geometry) ? m._fogDark.geometry.attributes.position.count / 3 : -1,
      halfTris: (m._fogHalf && m._fogHalf.geometry) ? m._fogHalf.geometry.attributes.position.count / 3 : -1,
      expectTris: (s.total - s.seen) * 6,
      seen: s.seen, nv: GAME.sphere.nv,
      camDist: (m.zoomFrac ? m.zoomFrac() : null),
    };
  });
  console.error('DIAG ' + JSON.stringify(diag));
  const stat2 = await page.evaluate(function () { const s = GAME.fog.stats(); return { seen: s.seen, pct: s.pct }; });

  /* 军务 → 阵亡名录 页签 */
  await page.evaluate(function () {
    GAME.ui._marchTab = 'memorial';
    GAME.memorial.record({ sent: { buxingji: 300 }, back: { buxingji: 120 }, wounded: { buxingji: 40 },
      place: '焦土关', ci: GAME.currentCity().ci, win: false, mode: '掠夺' });
    GAME.memorial.record({ sent: { dunwei: 150 }, back: { dunwei: 90 }, wounded: {},
      place: '哑雷坡', ci: GAME.currentCity().ci, win: true, mode: '占领' });
    GAME.ui.setView('marches');
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, '03-memorial.png') });

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ stat, stat2, errors }, null, 2));
  console.log('探明(开局)：', stat.seen, '/', stat.total, '=', stat.pct + '%');
  console.log('探明(点亮后)：', stat2.seen, '=', stat2.pct + '%');
  console.log('军务页签：', stat.tabs.join(' · '));
  console.log('页面错误：', errors.length ? errors.slice(0, 6) : '无');

  await browser.close();
  server.close();
})().catch(function (e) { console.error('❌', e && e.message); process.exit(1); });
