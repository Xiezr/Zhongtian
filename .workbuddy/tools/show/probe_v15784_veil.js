/* 验云雾层：把相机停在"穿云高度"看海，对比开/关云雾的截图。
   假设：老板截图上那片"雾状白斑"= M._cloudVeil 的 2D 云斑（26 团圆斑铺满屏），
        因为 _in = 1-|agl-55|/19 在 agl 36~74 之间持续 >0，停在 55 米就一直糊着。
   判据：agl=55 时 _cloudVeil 明显 >0，且关掉后画面干净。 */
const { chromium } = require('playwright-core');
const OUT = '.workbuddy/tmp/';
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    try { G.map3d.setSpin(false); } catch (e) { }
  }, 20260926);
  await p.waitForTimeout(4500);

  const spot = await p.evaluate(function () {
    var SP = window.GAME.sphere, cells = SP.cells, adj = SP.adj;
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].type !== 'lake') continue;
      var an = adj[i] || [], ok = true;
      for (var k = 0; k < an.length; k++) if (cells[an[k]].type !== 'lake') { ok = false; break; }
      if (ok && cells[i].dir) return cells[i].dir;
    }
    return null;
  });

  async function shotAt(agl, tag) {
    await p.evaluate(function (a) {
      var M = window.GAME.map3d;
      M.lookAtDir(window.__spot);
      /* setZoom 吃的是 0~1 的对数滑杆值，不是距离 —— 反算 */
      var d = M.R + a;
      var f = (Math.log(d) - Math.log(M.ZOOM_MIN)) / (Math.log(M.ZOOM_MAX) - Math.log(M.ZOOM_MIN));
      M.setZoom(Math.max(0, Math.min(1, f)));
    }, agl);
    await p.waitForTimeout(900);
    const st = await p.evaluate(function () {
      var M = window.GAME.map3d;
      return { agl: +(M.camO.dist - M.R).toFixed(1), surf: !!M._surf, veil: +(M._cloudVeil || 0).toFixed(3),
        puffs: M._puffs ? { n: M._puffs.children.length, vis: M._puffs.visible,
          op: M._puffs.children.length ? +M._puffs.children[0].material.opacity.toFixed(3) : null } : null };
    });
    await p.screenshot({ path: OUT + 'v15784_veil_' + tag + '.png' });
    console.log(tag.padEnd(14) + ' agl=' + st.agl + ' surf=' + st.surf + ' cloudVeil=' + st.veil
      + ' puffs=' + JSON.stringify(st.puffs));
    return st;
  }

  await p.evaluate(function (d) { window.__spot = d; }, spot);

  console.log('=== 不同高度：云雾浓度 ===');
  await shotAt(130, 'agl130');
  await shotAt(74, 'agl74');
  await shotAt(55, 'agl55');
  await shotAt(45, 'agl45');
  await shotAt(30, 'agl30');
  await shotAt(8, 'agl8');

  /* 关掉云雾再拍 55 */
  await p.evaluate(function () {
    var M = window.GAME.map3d;
    M._cloudVeilNoDraw = true;
    /* 直接把 2D 云雾段的开关掐掉：置一个永远为 0 的 veil */
    Object.defineProperty(M, '_cloudVeil', { get: function () { return 0; }, set: function () { }, configurable: true });
  });
  await shotAt(55, 'agl55_noveil');

  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
})();
