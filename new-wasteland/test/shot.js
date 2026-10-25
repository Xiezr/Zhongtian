/* ============================================================
 * test/shot.js — 用无头 Edge 真截几张图
 * ------------------------------------------------------------
 * 目的是「看」，不是「断言」。截图落到 test/shots/*.png
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'shots');
const PORT = 8899;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rp.writeHead(404); rp.end('no'); return; }
      rp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      rp.end(fs.readFileSync(f));
    });
    srv.listen(PORT, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();

  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  /* 1. 开场 */
  await page.screenshot({ path: path.join(OUT, '1-intro.png') });

  /* 2. 关掉开场 */
  await page.click('.intro');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '2-start.png') });

  /* 3. 选中队伍（看可达范围分色） */
  await page.click('.team');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '3-select.png') });

  /* 4. 派出去走几步 */
  const cells = await page.$$('.cell');
  /* 往右下走两格：15x15，城在 (7,7) → index 8*15+8 = 128 */
  await cells[128].click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '4-moved.png') });

  /* 5. 强制一次事件：直接改数据，看事件卡长什么样 */
  await page.evaluate(() => {
    const S = window.STATE.S();
    const t = S.tiles[7 * 15 + 9];
    t.site = 'town'; t.type = 'plain'; t.lit = false;
    const team = S.teams[0];
    team.x = 8; team.y = 7; team.supply = 6;
    window.STATE.log('测试：前方发现营地。', 'halt');
    window.ENGINE.dispatch(team.id, 9, 7);
    window.UI.renderAll();
    window.UI.maybeShowEvent();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '5-event.png') });

  /* 6. 造几个阵亡，看纪念碑 */
  await page.evaluate(() => {
    const S = window.STATE.S();
    S.event = null;
    const tpl = [
      ['陈烬', '第一小队', '灰岭（6,4）', '楼梯往下比往上长。'],
      ['李野', '第一小队', '灰岭（6,4）', '他们说楼里有灯。这栋楼断电十二年了。'],
      ['王石', '第二小队', '三号堆（11,3）', '剂量计爆表。他们没回头。']
    ];
    tpl.forEach((x) => {
      S.memorial.push({ name: x[0], team: x[1], place: x[2], hour: S.hour, last: x[3] });
    });
    S.tiles[4 * 15 + 6].deadHere = '第一小队 在此全灭';
    S.tiles[4 * 15 + 6].lit = true;
    S.tiles[3 * 15 + 11].deadHere = '第二小队 在此全灭';
    S.tiles[3 * 15 + 11].lit = true;
    /* 点亮一片，看地图有内容的样子 */
    [5, 6, 7, 8, 9].forEach((x) => [5, 6, 7, 8, 9].forEach((y) => { S.tiles[y * 15 + x].lit = true; }));
    window.UI.renderAll();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '6-memorial.png') });

  /* 7. 推进 8 小时，看日志与势力 */
  await page.evaluate(() => {
    window.ENGINE.advance(8);
    window.UI.renderAll();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '7-advance.png') });

  /* 8. 纪事：把时间推到冬季结算，看那一页纸 */
  await page.evaluate(() => {
    const S = window.STATE.S();
    S.hour = S.nextWinter - 1;
    window.ENGINE.advance(1);
    window.UI.renderAll();
    window.UI.maybeShowStory();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '8-story.png') });

  /* 9. 编成面板 */
  await page.evaluate(() => {
    const S = window.STATE.S();
    S.story = null;
    S.city.iron = 800;
    window.UI.renderAll();
    window.UI.openComp(S.teams[0].id);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '9-comp.png') });

  /* 10. 斗将 */
  await page.evaluate(() => {
    const S = window.STATE.S();
    S.story = null; S.event = null;
    document.getElementById('compModal').hidden = true;
    const t = S.teams[0];
    t.x = 8; t.y = 7; t.supply = 6;
    const tile = S.tiles[7 * 15 + 9];
    tile.site = 'fort'; tile.type = 'plain'; tile.lit = false; tile.owner = 'rust'; tile.duelDone = false;
    window.ENGINE.dispatch(t.id, 9, 7);
    window.UI.renderAll();
    window.UI.maybeShowDuel();
  });
  await page.waitForTimeout(300);
  /* 打两回合，让历史里有东西 */
  await page.evaluate(() => { window.ENGINE.duelMove('thrust'); window.UI.maybeShowDuel(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.ENGINE.duelMove('charge'); window.UI.maybeShowDuel(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '10-duel.png') });

  /* 11. 势力来使 */
  await page.evaluate(() => {
    const S = window.STATE.S();
    S.story = null; S.event = null; S.duel = null;
    document.getElementById('duelModal').hidden = true;
    S.winters = 1; S.envoyDone = [];
    window.ENGINE.maybeEnvoy();
    window.UI.renderAll();
    window.UI.maybeShowEnvoy();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '11-envoy.png') });

  /* 12. 手机竖屏 */
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  await mob.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await mob.waitForTimeout(500);
  await mob.evaluate(() => { const i = document.querySelector('.intro'); if (i) i.click(); });
  await mob.waitForTimeout(700);
  await mob.screenshot({ path: path.join(OUT, '12-mobile.png') });
  await mob.close();

  await browser.close();
  srv.close();

  if (errs.length) {
    console.log('❌ 页面报错：');
    errs.forEach((e) => console.log('   ' + e));
  } else {
    console.log('✅ 无页面报错');
  }
  console.log('截图：' + OUT);
  fs.readdirSync(OUT).forEach((f) => {
    const st = fs.statSync(path.join(OUT, f));
    console.log('   ' + f.padEnd(18) + (st.size / 1024).toFixed(0) + ' KB');
  });
})();
