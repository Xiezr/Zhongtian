/* 只留玩家小人，其余全隐藏：确认"我"到底在不在画面里、有多大 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pstardew';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '新手', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await p.waitForTimeout(900);
  await p.mouse.move(720, 450);
  for (let i = 0; i < 46; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(70); }
  await p.waitForTimeout(2200);

  const d = await p.evaluate(() => {
    const M = GAME.map3d, sc = M._scene();
    const f = M.figureOf('stand');
    let figParent = null;
    /* 找小人根节点：从场景里找含 figureOf pos 的 group */
    sc.traverse((o) => { if (!figParent && o.isGroup && o.children.length && o.children[0].isMesh) figParent = o; });
    /* 更精确：遍历找 type=Group 且 kids 里含 legs 标记 */
    sc.children.forEach((ch) => { if (ch.type === 'Group' && ch.children.length >= 2 && ch.children.some((x) => x.isMesh)) figParent = ch; });
    const out = { fig: f, target: null, hidden: 0 };
    if (figParent) { out.target = { kids: figParent.children.length }; }
    /* 隐藏除 figRoot 外所有节点 */
    const keep = figParent;
    sc.children.forEach((ch) => { if (ch !== keep) { ch.visible = false; out.hidden++; } });
    /* 小人屏幕位置 */
    if (f) { const v = new THREE.Vector3(f.pos[0], f.pos[1], f.pos[2]).project(M._cam); out.ndc = [+v.x.toFixed(2), +v.y.toFixed(2)]; }
    out.keepKids = keep ? keep.children.length : 0;
    return out;
  });
  console.log(JSON.stringify(d));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + '/5_only_me.png' });
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
