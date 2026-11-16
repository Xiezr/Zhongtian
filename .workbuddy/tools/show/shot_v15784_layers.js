/* 色斑分层隔离：把海面逐层剥开，看"斑"来自哪一层。
   步骤：相机对准一片纯海（rAlt≈130）→ 截图 baseline → 依次隐藏
   marine(近景水面) / water(底色海面) / globe(星球本体) / 云雾 → 各截一张。
   另输出 scene 顶层 mesh 清单（名字/材质/顶点数），便于对号入座。 */
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

  /* 找一片"纯海"：lake 格，且 6 邻居全是 lake */
  const spot = await p.evaluate(function () {
    var SP = window.GAME.sphere, cells = SP.cells, adj = SP.adj;
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].type !== 'lake') continue;
      var an = adj[i] || [], ok = true;
      for (var k = 0; k < an.length; k++) if (cells[an[k]].type !== 'lake') { ok = false; break; }
      if (ok && cells[i].dir) return { ci: i, dir: cells[i].dir };
    }
    return null;
  });
  console.log('纯海格 = ' + JSON.stringify(spot && spot.ci));

  /* 把相机指过去 + 拉到中景 */
  await p.evaluate(function (d) {
    var M = window.GAME.map3d;
    M.lookAtDir(d);
    M.camO.dist = M.R + 130;
    if (M.setZoom) M.setZoom(M.R + 130);
    M._syncZoom && M._syncZoom();
  }, spot.dir);
  await p.waitForTimeout(1200);

  /* 场景清单 */
  const inv = await p.evaluate(function () {
    var M = window.GAME.map3d;
    var scope = (M._globe && M._globe.parent) ? M._globe.parent : null;
    var out = [];
    if (scope) scope.traverse(function (o) {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      var g = o.geometry || {}, mt = o.material || {};
      out.push({
        name: o.name || '(anon)',
        type: o.isMesh ? 'Mesh' : (o.isPoints ? 'Points' : 'Line'),
        verts: g.attributes && g.attributes.position ? g.attributes.position.count : 0,
        mat: mt.type || '?',
        transparent: !!mt.transparent,
        opacity: mt.opacity,
        visible: o.visible,
        color: mt.color ? '#' + mt.color.getHexString() : null
      });
    });
    return out;
  });
  console.log('场景对象 ' + inv.length + ' 个（顶点>1000）：');
  inv.filter(function (o) { return o.verts > 1000; }).slice(0, 20).forEach(function (o) {
    console.log('  ' + o.type + ' ' + o.name + ' verts=' + o.verts + ' mat=' + o.mat
      + ' color=' + o.color + ' opacity=' + o.opacity + ' visible=' + o.visible);
  });

  await p.screenshot({ path: OUT + 'v15784_L0_base.png' });

  /* 逐层隐藏 */
  const layers = [
    ['marine', function () { var M = window.GAME.map3d; var n = 0; (M._globe.parent).traverse(function (o) { if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uTime) { o.visible = false; n++; } }); return n; }],
    ['water', function () { var M = window.GAME.map3d; var n = 0; (M._globe.parent).traverse(function (o) { if (o.isMesh && o.material && o.material.type === 'MeshBasicMaterial' && o.material.color && o.material.color.getHexString() === '4a7fa0') { o.visible = false; n++; } }); return n; }],
    ['globe', function () { var M = window.GAME.map3d; if (M._globe) { M._globe.visible = false; return 1; } return 0; }]
  ];
  for (const [tag, fn] of layers) {
    const n = await p.evaluate(fn);
    await p.waitForTimeout(500);
    await p.screenshot({ path: OUT + 'v15784_L_' + tag + '.png' });
    console.log('隐藏 ' + tag + ' → ' + n + ' 个对象');
    /* 复原（下一层要单独看，所以复原上一层） */
    await p.evaluate(function (t) {
      var M = window.GAME.map3d;
      (M._globe.parent).traverse(function (o) { o.visible = true; });
    }, tag);
    await p.waitForTimeout(300);
  }

  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
})();
