/* 城外建厂全链路验收：① 远程能否勘探（"走近"是真约束吗）② 勘探→建厂→施工 全链断没断 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pplant';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
let PASS = 0, FAIL = 0;
function ok(t, c, d) {
  if (c) { PASS++; console.log('OK   ' + t + (d ? '   [' + d + ']' : '')); }
  else { FAIL++; console.log('FAIL ' + t + (d ? '   [' + d + ']' : '')); }
}
const waitBoot = async (p) => {
  for (let i = 0; i < 100; i++) {
    const on = await p.evaluate(() => {
      const ov = document.getElementById('boot-loading');
      return ov ? ov.classList.contains('on') : false;
    });
    if (!on) return true;
    await p.waitForTimeout(200);
  }
  return false;
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { GAME.newGame({ name: '建厂', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await waitBoot(p);

  /* 选一块**离玩家 20 格以上、已探明、能建厂**的野地格 */
  const pick = await p.evaluate(() => {
    const M = GAME.map3d, RS = GAME.resource, cells = M._collider.cells;
    const pci = M.playerCi(), pd = cells[pci] ? cells[pci].dir : null;
    const cityCis = {}; (GAME.state.cities || []).forEach((c) => { cityCis[c.ci] = 1; });
    let best = null;
    const stat = { total: 0, city: 0, fog: 0, noRes: 0, scanned: 0, near: 0, ok: 0 };
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]; if (!c) continue; stat.total++;
      if (cityCis[i]) { stat.city++; continue; }
      /* 迷雾：开局只探明很少，先看探明判据是不是主因 */
      const fogOn = (typeof GAME.isExplored === 'function') ? GAME.isExplored(i)
        : (GAME.fog && GAME.fog.get ? GAME.fog.get(i) !== 0 : true);
      if (!fogOn) { stat.fog++; continue; }
      let rv = null; try { rv = RS.view(i); } catch (e) { rv = null; }
      if (!rv) { stat.noRes++; continue; }
      if (rv.scanned) { stat.scanned++; continue; }
      const dot = Math.max(-1, Math.min(1, c.dir[0] * pd[0] + c.dir[1] * pd[1] + c.dir[2] * pd[2]));
      const cellsAway = Math.acos(dot) * M.R / 5.25;
      if (cellsAway < 3) { stat.near++; continue; }
      stat.ok++;
      if (!best || cellsAway > best.away) best = { ci: i, type: c.type, res: rv.res, away: +cellsAway.toFixed(1) };
    }
    return best ? Object.assign(best, { playerCi: pci, stat: stat }) : { err: 'no target', stat: stat };
    return best ? Object.assign(best, { playerCi: pci }) : { err: 'no target' };
  });
  console.log('—— 目标地块  ' + JSON.stringify(pick));
  if (pick.err) throw new Error('选不到目标格');

  /* ① 人离这么远，直接打开地块面板并点「勘探」 */
  const before = await p.evaluate((ci) => {
    const M = GAME.map3d, RS = GAME.resource;
    const rv = RS.view(ci);
    return { playerCi: M.playerCi(), scanned: !!(rv && rv.scanned) };
  }, pick.ci);

  await p.evaluate((ci) => { GAME.ui.openLandModalCi(ci); }, pick.ci);
  await p.waitForTimeout(500);
  const panel = await p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    const txt = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
    return { hasScan: !!document.querySelector('[data-action="res-scan"]'),
      hasBuild: !!document.querySelector('[data-action="res-build-open"]'),
      head: ((m && m.querySelector('.gold-heading')) || {}).textContent || '',
      hint: (txt.match(/勘探[^。]{0,40}/) || [''])[0], text: txt.slice(0, 200) };
  });
  console.log('—— 面板  ' + JSON.stringify({ head: panel.head, hasScan: panel.hasScan, hasBuild: panel.hasBuild, hint: panel.hint }));
  ok('① 远处（' + pick.away + ' 格外）能打开带「勘探」的地块面板', panel.hasScan === true, 'hasScan=' + panel.hasScan);

  /* 真点「勘探」按钮 */
  if (panel.hasScan) {
    await p.click('[data-action="res-scan"]');
    await p.waitForTimeout(600);
  }
  const afterScan = await p.evaluate((ci) => {
    const rv = GAME.resource.view(ci);
    return { scanned: !!(rv && rv.scanned), richness: rv ? rv.richness : null, reserve: rv ? rv.reserveMax : null,
      playerCi: GAME.map3d.playerCi() };
  }, pick.ci);
  console.log('—— 勘探后  ' + JSON.stringify(afterScan));
  ok('★ 关键：人站在 ' + pick.away + ' 格外也能勘探成功（说明"走近"是假约束）',
    afterScan.scanned === true && afterScan.playerCi === before.playerCi,
    'scanned ' + before.scanned + '→' + afterScan.scanned + ' · 人没动=' + (afterScan.playerCi === before.playerCi));

  /* ② 勘探后面板应出现「建采集场」 */
  await p.evaluate((ci) => { GAME.ui.openLandModalCi(ci); }, pick.ci);
  await p.waitForTimeout(500);
  const panel2 = await p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    const txt = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
    return { hasBuild: !!document.querySelector('[data-action="res-build-open"]'),
      hasScan: !!document.querySelector('[data-action="res-scan"]'), text: txt.slice(0, 240) };
  });
  ok('② 勘探后出现「建采集场」入口（勘探→建厂 同一面板闭环）', panel2.hasBuild === true && panel2.hasScan === false,
    'build=' + panel2.hasBuild + ' scan=' + panel2.hasScan);
  await p.screenshot({ path: OUT + '/1_scanned.png' });

  /* ③ 点「建采集场」→ 进选建面板 */
  if (panel2.hasBuild) {
    await p.click('[data-action="res-build-open"]');
    await p.waitForTimeout(700);
  }
  const panel3 = await p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    const txt = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
    const btns = Array.from(document.querySelectorAll('[data-action^="res-build"]')).map((x) => x.dataset.action);
    return { head: ((m && m.querySelector('.gold-heading')) || {}).textContent || '',
      btns: btns, text: txt.slice(0, 300) };
  });
  console.log('—— 选建面板  ' + JSON.stringify({ head: panel3.head, btns: panel3.btns }));
  ok('③ 能进「选建采集场」面板', panel3.btns.length > 0 || /采集场|建造|开工/.test(panel3.text),
    'btns=' + JSON.stringify(panel3.btns));

  /* ④ 真开工：找可开工按钮，点下去，看队列/资源变化 */
  const doBuild = await p.evaluate((ci) => {
    const RS = GAME.resource;
    const rv = RS.view(ci);
    const eid = GAME.extBuildingOf ? GAME.extBuildingOf(rv.res) : null;
    return { res: rv.res, eid: eid };
  }, pick.ci);
  console.log('—— 目标建筑  ' + JSON.stringify(doBuild));

  const clicked = await p.evaluate(() => {
    const btn = document.querySelector('[data-action="plant-build-do"]') || document.querySelector('[data-action="res-build-do"]');
    if (!btn) return { found: false };
    const dis = btn.disabled;
    if (!dis) btn.click();
    return { found: true, disabled: dis, txt: (btn.textContent || '').trim() };
  });
  await p.waitForTimeout(900);
  const built = await p.evaluate((ci) => {
    const rv = GAME.resource.view(ci);
    const qs = (GAME.state.queues && GAME.state.queues.build) ? GAME.state.queues.build.length : 0;
    const qres = (GAME.state.queues && GAME.state.queues.res) ? GAME.state.queues.res.length : 0;
    return { plant: rv ? rv.plant : null, plantLv: rv ? rv.plantLv : null, queuesBuild: qs, queuesRes: qres };
  }, pick.ci);
  console.log('—— 开工后  ' + JSON.stringify({ clicked: clicked, built: built }));

  console.log('=== 页面错误 ===', JSON.stringify(errs.slice(0, 4)));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
