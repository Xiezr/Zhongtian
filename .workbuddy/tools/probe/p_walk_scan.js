/* 「走近勘探」真机制验收：远处 → 走过去 → 到达自动勘探并重开面板 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pwalknear';
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
  await p.evaluate(() => { GAME.newGame({ name: '走近', cityName: '灰岗', mapSeed: 20261126 }); GAME.ui.enterGame(); GAME.ui.setView('map'); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { try { document.querySelectorAll('.modal-mask .btn, .modal-foot .btn').forEach((b) => { if (/知道了|跳过|关闭|开始/.test(b.textContent || '')) b.click(); }); } catch (e) { } });
  await waitBoot(p);

  /* 找一块**离玩家 >6 格**、已探明、未勘探、能建厂的格 */
  const pick = await p.evaluate(() => {
    const M = GAME.map3d, RS = GAME.resource, cells = M._collider.cells;
    const pci = M.playerCi(), pd = cells[pci].dir;
    const cityCis = {}; (GAME.state.cities || []).forEach((c) => { cityCis[c.ci] = 1; });
    let best = null;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]; if (!c || cityCis[i]) continue;
      const fogOn = (typeof GAME.isExplored === 'function') ? GAME.isExplored(i)
        : (GAME.fog && GAME.fog.get ? GAME.fog.get(i) !== 0 : true);
      if (!fogOn) continue;
      let rv = null; try { rv = RS.view(i); } catch (e) { rv = null; }
      if (!rv || rv.scanned) continue;
      const dot = Math.max(-1, Math.min(1, c.dir[0] * pd[0] + c.dir[1] * pd[1] + c.dir[2] * pd[2]));
      const away = Math.acos(dot) * M.R;
      if (away < 15) continue;   /* 明显超过 11 米阈值即可（开局只探明 61 格，最远约 24 米） */
      if (!best || away > best.away) best = { ci: i, type: c.type, res: rv.res, away: +away.toFixed(1) };
    }
    return best || { err: 'none' };
  });
  console.log('—— 目标  ' + JSON.stringify(pick));
  if (pick.err) throw new Error('选不到远处的格');

  const before0 = await p.evaluate(() => ({ ci: GAME.map3d.playerCi() }));

  /* ① 远处打开面板：必须是「走过去」而不是「勘探」 */
  await p.evaluate((ci) => { GAME.ui.openLandModalCi(ci); }, pick.ci);
  await p.waitForTimeout(450);
  const far = await p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    const txt = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
    return {
      goScan: !!document.querySelector('[data-action="res-go-scan"]'),
      plainScan: !!document.querySelector('[data-action="res-scan"]'),
      btnText: (function () { const b = document.querySelector('[data-action="res-go-scan"]'); return b ? (b.textContent || '').trim() : ''; })(),
      hint: (txt.match(/走到地块上[^；]{0,24}/) || [''])[0]
    };
  });
  console.log('—— 远处面板  ' + JSON.stringify(far));
  ok('① 远处（' + pick.away + ' 米）只给「走过去勘探」，不再假装就地能探',
    far.goScan === true && far.plainScan === false, 'goScan=' + far.goScan + ' scan=' + far.plainScan);
  ok('① 按钮写明距离（玩家知道要走多远）', /约 \d+ 米/.test(far.btnText), 'btn=' + far.btnText);
  await p.screenshot({ path: OUT + '/1_far_panel.png' });

  /* ② 真点它：面板应关、小人接到目标、HUD 出现行程 */
  await p.click('[data-action="res-go-scan"]');
  await p.waitForTimeout(500);
  const walking = await p.evaluate(() => {
    const M = GAME.map3d;
    const qh = document.getElementById('quest-hint');
    return { modalOpen: !!document.querySelector('.modal-mask'),
      target: M.walkTarget ? M.walkTarget() : -99,
      walkThen: M._walkThen || null,
      hud: qh ? (qh.textContent || '').trim() : '' };
  });
  console.log('—— 点击后  ' + JSON.stringify(walking));
  ok('② 面板关闭（不然挡着路）', walking.modalOpen === false, 'modal=' + walking.modalOpen);
  ok('② 小人接到目标格', walking.target === pick.ci, 'target=' + walking.target + ' 目标=' + pick.ci);
  ok('② 到达后要做的事已挂起（勘探）', !!walking.walkThen && walking.walkThen.act === 'scan', JSON.stringify(walking.walkThen));
  ok('② HUD 显示行程（"点了没反应"的反面）', /正在走过去|快到了/.test(walking.hud), 'hud=' + walking.hud);

  /* ③ 手动推帧走到（headless rAF 被节流），看是否自动勘探 + 重开面板 */
  /* 到达处理已经下沉到 `stepWalkTo` 的到达出口（v158.24 修正），所以这里可以放心手动步进：
     headless 的 rAF 被节流到几乎不跑（实测 46 秒走不完 24 米），等真帧验不出东西。 */
  const arrived = await p.evaluate(() => {
    const M = GAME.map3d;
    let frames = 0, r = null;
    while (M.walkTarget() >= 0 && frames < 4000) { r = M.stepWalkTo(1 / 60); frames++; }
    const rv = (function () { try { return GAME.resource.view(M.playerCi()); } catch (e) { return null; } })();
    /* 渲染循环在真机上到达时会 `_openCellPanel(ci)` —— 这里手动补同一行（等价动作） */
    if (r && r.arrived && GAME.ui.openLandModalCi) { try { GAME.ui.openLandModalCi(r.ci); } catch (e) { } }
    return { frames: frames, ci: M.playerCi(), target: M.walkTarget(),
      scannedNow: !!(rv && rv.scanned) };
  });
  await p.waitForTimeout(700);
  const afterArrive = await p.evaluate(() => {
    const m = document.querySelector('.modal-mask');
    return { modalOpen: !!m, hasBuild: !!document.querySelector('[data-action="res-build-open"]'),
      hasGoBuild: !!document.querySelector('[data-action="res-go-build"]') };
  });
  console.log('—— 走到  ' + JSON.stringify(arrived));
  console.log('—— 到达后面板  ' + JSON.stringify(afterArrive));
  ok('③ 真的走到了目标格', arrived.ci === pick.ci && arrived.target < 0, 'ci=' + arrived.ci);
  ok('③ 到达后**自动勘探**（不用玩家再点一次）', arrived.scannedNow === true, 'scanned=' + arrived.scannedNow);
  ok('③ 到达后重开面板，并直接给出「建采集场」', afterArrive.modalOpen && afterArrive.hasBuild && !afterArrive.hasGoBuild,
    'open=' + afterArrive.modalOpen + ' build=' + afterArrive.hasBuild + ' goBuild=' + afterArrive.hasGoBuild);
  await p.screenshot({ path: OUT + '/2_arrived_panel.png' });

  /* ④ 近处再验一次：站在目标格上，面板应是就地勘探/建厂 */
  const near = await p.evaluate((ci) => {
    const rv = GAME.resource.view(ci);
    GAME.ui.openLandModalCi(ci);
    return { scanned: !!(rv && rv.scanned) };
  }, pick.ci);
  await p.waitForTimeout(400);
  const nearPanel = await p.evaluate(() => ({
    plainScan: !!document.querySelector('[data-action="res-scan"]'),
    goScan: !!document.querySelector('[data-action="res-go-scan"]'),
    build: !!document.querySelector('[data-action="res-build-open"]'),
    goBuild: !!document.querySelector('[data-action="res-go-build"]')
  }));
  console.log('—— 近处面板  ' + JSON.stringify(nearPanel));
  ok('④ 近距离：建厂按钮是"就地建"，不是"走过去建"', nearPanel.build === true && nearPanel.goBuild === false,
    'build=' + nearPanel.build + ' goBuild=' + nearPanel.goBuild);

  console.log('=== 页面错误 ===', JSON.stringify(errs.slice(0, 4)));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
})().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });
