/* v157.85 冒烟启动检查：删了 prologue.js 后，界面创建角色 → 进游戏 → 切城市/地图/出征，
   全程抓 pageerror。判据：0 异常 + 有城 + 前传符号已消失。 */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  const st0 = await p.evaluate(function () {
    return { hasPrologue: !!window.GAME.prologue, ver: window.GAME.VERSION, modules: (window.GAME.DATA && 1) };
  });
  console.log('加载后：GAME.prologue = ' + (st0.hasPrologue ? '❌ 仍存在' : '✅ 已移除') + ' · 版本 ' + st0.ver);

  /* 走界面创建角色（这条路以前会 prologue:true） */
  const r = await p.evaluate(function () {
    var G = window.GAME, out = {};
    try {
      var el = document.getElementById('create-name');
      if (el) el.value = '测试君主';
      if (G.ui.doCreate) G.ui.doCreate();
      out.created = !!(G.state && G.state.ruler);
    } catch (e) { out.err = e.message; }
    out.cities = (G.state && G.state.cities || []).length;
    out.pro = !!(G.state && G.state.prologue && G.state.prologue.on);
    out.view = G.ui && G.ui.view;
    return out;
  });
  console.log('创建角色 → ' + JSON.stringify(r));

  /* 切几个视图 + 打开地图 */
  const views = ['city', 'map', 'army', 'gen', 'space'];
  for (const v of views) {
    const ok = await p.evaluate(function (vv) {
      try { window.GAME.ui.setView(vv); return { ok: true }; }
      catch (e) { return { ok: false, err: e.message }; }
    }, v);
    await p.waitForTimeout(900);
    console.log('  视图 ' + v + ' → ' + JSON.stringify(ok));
  }

  /* 打开地块面板（原来前传走 openPrologueLand） */
  const land = await p.evaluate(function () {
    try {
      var G = window.GAME, c = G.currentCity();
      if (G.ui.openLandModalCi && c && c.ci != null) { G.ui.openLandModalCi(c.ci); return { ok: true }; }
      return { ok: false, msg: '没有城或没有入口' };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  console.log('地块面板 → ' + JSON.stringify(land));
  await p.waitForTimeout(600);

  /* 出征面板（原来前传会 toast "还没有城"） */
  const exp = await p.evaluate(function () {
    try { if (window.GAME.ui.openExpedModal) { window.GAME.ui.openExpedModal({}); return { ok: true }; } return { ok: false, msg: '无入口' }; }
    catch (e) { return { ok: false, err: e.message }; }
  });
  console.log('出征面板 → ' + JSON.stringify(exp));

  await p.waitForTimeout(500);
  await p.screenshot({ path: '.workbuddy/tmp/v15785_boot.png' });
  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 5).join(' | ') : ''));
  const ok = !st0.hasPrologue && r.created && r.cities >= 1 && !r.pro && errs.length === 0;
  console.log(ok ? 'BOOT_PASS' : 'BOOT_FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
