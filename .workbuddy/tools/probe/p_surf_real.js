/* 地表层到底建没建起来 —— 用项目自带的 surfSelfCheck 取证，不靠目测 */
const { chromium } = require('playwright-core');
const path = require('path');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/psurfre';
const URL = 'file:///E:/Deepseekdb/index.html';

(async () => {
  const EXE = process.env.AUDIT_CHROME || 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '地表', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); });
  await p.waitForTimeout(1200);

  /* 走真实开局 */
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await p.waitForTimeout(800);
  await p.evaluate(() => { try { GAME.ui.setView('map'); } catch (e) { } });
  await p.waitForTimeout(1500);

  /* ① 自检：地表层能不能建、各层齐不齐 */
  const sc = await p.evaluate(() => {
    const M = GAME.map3d;
    let r = null, err = null;
    try { r = M.surfSelfCheck ? M.surfSelfCheck() : null; } catch (e) { err = e.message; }
    return { selfCheck: r, err: err, surf: M._surf, stats: (M.surfStats ? M.surfStats() : null) };
  });
  console.log('=== ① surfSelfCheck ===');
  console.log(JSON.stringify(sc, null, 1).slice(0, 1400));

  /* ② 场景里到底有几个子节点、各多大 */
  const scene = await p.evaluate(() => {
    const M = GAME.map3d;
    let sc = null;
    try { sc = M._scene(); } catch (e) { }
    if (!sc) return { err: 'no scene' };
    return {
      children: sc.children.length,
      list: sc.children.map((c) => ({
        type: c.type, name: c.name || '', visible: c.visible,
        kids: c.children.length,
        tris: (function () { let n = 0; c.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.index) n += o.geometry.index.count / 3; else if (o.isMesh && o.geometry) n += (o.geometry.attributes.position ? o.geometry.attributes.position.count / 3 : 0); }); return Math.round(n); })()
      })).sort((a, b) => b.tris - a.tris).slice(0, 10)
    };
  });
  console.log('=== ② 场景子节点（按三角形数） ===');
  console.log(JSON.stringify(scene, null, 1).slice(0, 1600));

  /* ③ 相机在哪、看什么 */
  const cam = await p.evaluate(() => {
    const M = GAME.map3d, c = M._cam, o = M.camO;
    return { pos: c.position.toArray().map((v) => +v.toFixed(1)),
      dist: +o.dist.toFixed(2), R: M.R, surf: M._surf, surfEye: M.SURF_EYE,
      surfDir: o.dir ? o.dir.map((v) => +v.toFixed(4)) : null,
      lookAt: M._surfDir ? { x: +M._surfDir.x.toFixed(3), y: +M._surfDir.y.toFixed(3), z: +M._surfDir.z.toFixed(3) } : null };
  });
  console.log('=== ③ 相机 ===');
  console.log(JSON.stringify(cam));

  /* ④ 等真帧再截图 */
  await p.waitForTimeout(3000);
  await p.screenshot({ path: OUT + '/1_surf.png' });
  console.log('=== 页面错误 ===');
  console.log(JSON.stringify(errs.slice(0, 6)));
  await browser.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
