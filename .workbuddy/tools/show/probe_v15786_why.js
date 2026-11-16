/* 为什么改了顶点色画面不变？—— 对照三件事：
   ① M._globe 的 color 数组是否真被改（读值）
   ② 场景里真正渲染的 globe 是否就是 M._globe（同一对象）
   ③ 把 LIT 压到 0.05 看画面是否明显变黑（截图） */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', mapSeed: 20260926 });
    G.state = st; if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('map'); G.refreshAll();
    var c = G.currentCity();
    if (G.fog) for (var r = 3; r <= 9; r += 2) G.fog.revealAround(c.ci, r, 2);
    if (G.map3d.focusOnCell) G.map3d.focusOnCell(c.ci, true);
    G.map3d.setZoom(0.10);
  });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(function () {
    var M = window.GAME.map3d;
    var g = M._globe;
    /* 场景里所有带 color 属性的 mesh */
    var list = [];
    (g && g.parent ? g.parent : { children: [] }).children.forEach(function (o) {
      if (o && o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.color) {
        list.push({ verts: o.geometry.attributes.position.count, isGlobe: o === g,
          matType: o.material && o.material.type, hasMap: !!(o.material && o.material.map),
          firstCol: Array.prototype.slice.call(o.geometry.attributes.color.array, 0, 3).map(function (x) { return +x.toFixed(3); }) });
      }
    });
    /* 挑一个已探明顶点与一个未探明顶点，读它们的当前色 */
    var vx = M._globeVtxCell, arr = g.geometry.attributes.color.array, F = window.GAME.fog;
    var a = -1, b = -1;
    for (var i = 0; i < vx.ci0.length; i++) {
      var ci = vx.ci0[i]; if (ci < 0) continue;
      if (F.get(ci) > 0 && a < 0) a = i;
      if (F.get(ci) === 0 && b < 0) b = i;
      if (a >= 0 && b >= 0) break;
    }
    var rd = function (k) { return [arr[k*3], arr[k*3+1], arr[k*3+2]].map(function (x) { return +x.toFixed(3); }); };
    return { LIT: M.EXPLORE_LIT, DIM: M.EXPLORE_DIM, lit: M._globeExploreLit,
      meshes: list, knownCol: a >= 0 ? rd(a) : null, unknownCol: b >= 0 ? rd(b) : null,
      baseKnown: a >= 0 ? [M._globeColBase[a*3], M._globeColBase[a*3+1], M._globeColBase[a*3+2]].map(function (x) { return +x.toFixed(3); }) : null };
  });
  console.log('LIT/DIM = ' + info.LIT + '/' + info.DIM + ' · 提亮顶点 ' + info.lit);
  console.log('已探明顶点色 ' + JSON.stringify(info.knownCol) + ' ← 原始 ' + JSON.stringify(info.baseKnown));
  console.log('未探明顶点色 ' + JSON.stringify(info.unknownCol));
  console.log('场景带色 mesh：');
  info.meshes.forEach(function (m) { console.log('  verts=' + m.verts + ' isGlobe=' + m.isGlobe + ' mat=' + m.matType + ' map=' + m.hasMap + ' firstCol=' + JSON.stringify(m.firstCol)); });

  /* 极端测试：LIT=0.05 → 已探索区应该几乎全黑 */
  await p.evaluate(function () {
    var M = window.GAME.map3d;
    M.EXPLORE_LIT = 0.05; M.EXPLORE_DIM = 1.0;
    M._paintGlobeExplore();
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '.workbuddy/tmp/v15786_black_test.png' });
  console.log('页面异常 ' + errs.length);
  await browser.close();
})();
