/* 省/市/区首府 → 下辖地视野：完整验收 + 同机位前后对照图
 *   ① 真实占领链路（onConquer）
 *   ② 省/市/区 三级都能点亮各自层级
 *   ③ decay 之后 revealOwned 能把辖地补回来（读档路径）
 *   ④ 邻省不受影响
 *   ⑤ 出图 state_adm_before / state_adm_after
 * 用法：node .workbuddy/tools/show/probe_admin_reveal.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', function (e) { console.log('EXC ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui && window.THREE', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map');
  });
  await p.waitForFunction(function () {
    var o = document.getElementById('boot-loading');
    return !o || !o.classList.contains('on');
  }, null, { timeout: 120000 });
  await p.waitForTimeout(1500);

  /* ---- 选省 + 机位（陆地质心）---- */
  var pick = await p.evaluate(function () {
    var G = window.GAME, M = G.map3d, SP = G.sphere;
    var provs = (M.admCities || []).filter(function (c) { return c.admLevel === 'prov'; });
    var best = null, bs = -1;
    provs.forEach(function (c) {
      var l = G.map.adminCiList('prov', c.admIndex);
      var n = l ? l.length : 0;
      if (n > bs) { bs = n; best = c; }
    });
    /* 机位：**省府所在格**定向。
       （不用辖地质心：该省一半是海，质心常落洋面 —— 实测第一次就拍到一片纯蓝） */
    var c2 = SP.cells[best.ci] || null;
    var d2 = (c2 && c2.dir) || [0, 1, 0];
    var L = Math.hypot(d2[0], d2[1], d2[2]) || 1;
    var o = M.camO; M.clearFocus && M.clearFocus(); M.camFree = true;
    o.yaw = Math.atan2(d2[0] / L, d2[2] / L);
    o.pitch = Math.asin(d2[1] / L) + 0.42;
    o.dist = M.ZOOM_MIN + 120;
    return { name: best.name, admIndex: best.admIndex, size: bs };
  });
  console.log('PICK ' + JSON.stringify(pick));
  await p.waitForTimeout(1800);
  await p.screenshot({ path: '.workbuddy/shots/admin_before.png' });
  console.log('WROTE admin_before.png');

  /* ---- 真占领，再看 ---- */
  var r1 = await p.evaluate(function (pick) {
    var G = window.GAME, F = G.fog;
    var prov = (G.map3d.admCities || []).filter(function (c) {
      return c.admLevel === 'prov' && c.admIndex === pick.admIndex;
    })[0];
    var list = G.map.adminCiList('prov', pick.admIndex);
    var before = 0;
    for (var i = 0; i < list.length; i++) if (F.get(list[i]) >= F.ALL) before++;
    var seen0 = F.stats().seen;
    var err = '';
    try { G.onConquer(prov, {}, null, null); } catch (e) { err = String(e && (e.message || e)); }
    var full = 0;
    for (var j = 0; j < list.length; j++) if (F.get(list[j]) >= F.ALL) full++;
    var nc = (G.state.cities || []).filter(function (c) { return c.admLevel === 'prov' && c.admIndex === pick.admIndex; })[0];
    return { beforeFull: before, afterFull: full, size: list.length,
      delta: F.stats().seen - seen0, err: err,
      city: nc ? { name: nc.name, admLevel: nc.admLevel, admIndex: nc.admIndex } : null };
  }, pick);
  console.log('PROV ' + JSON.stringify(r1));
  await p.waitForTimeout(1800);
  await p.screenshot({ path: '.workbuddy/shots/admin_after.png' });
  console.log('WROTE admin_after.png');

  /* ---- 市/区 两级 + decay 恢复 + 邻省守卫 ---- */
  var r2 = await p.evaluate(function (pick) {
    var G = window.GAME, F = G.fog, out = {};

    /* 邻省守卫要**先测**：后面会占一座市府，市府可能恰在邻省境内，
       那样"邻省有全明格"就是正当的（那是它自己的市府），会让这条断言失去意义。 */
    var provs0 = (G.map3d.admCities || []).filter(function (c) { return c.admLevel === 'prov'; });
    var other0 = provs0.filter(function (c) { return c.admIndex !== pick.admIndex; })[0];
    var ol0 = G.map.adminCiList('prov', other0.admIndex), of0 = 0;
    for (var k0 = 0; k0 < ol0.length; k0++) if (F.get(ol0[k0]) >= F.ALL) of0++;
    out.otherProv = { name: other0.name, size: ol0.length, full: of0 };

    /* 市府：占一座，检查该市全明 */
    var mk = (G.map3d.admCities || []).filter(function (c) { return c.admLevel === 'market'; })[0];
    var ml = G.map.adminCiList('market', mk.admIndex);
    try { G.onConquer(mk, {}, null, null); } catch (e) { out.mkErr = String(e && e.message); }
    var mf = 0;
    for (var i = 0; i < ml.length; i++) if (F.get(ml[i]) >= F.ALL) mf++;
    out.market = { name: mk.name, size: ml.length, full: mf };

    /* 区：占一座 */
    var ds = (G.map3d.admCities || []).filter(function (c) { return c.admLevel === 'district'; })[0];
    var dl = G.map.adminCiList('district', ds.admIndex);
    try { G.onConquer(ds, {}, null, null); } catch (e) { out.dsErr = String(e && e.message); }
    var df = 0;
    for (var j = 0; j < dl.length; j++) if (F.get(dl[j]) >= F.ALL) df++;
    out.district = { name: ds.name, size: dl.length, full: df };

    /* decay 之后能不能补回来（模拟读档/久不访问） */
    var provList = G.map.adminCiList('prov', pick.admIndex);
    /* ① 正着验：decay 把全明褪成半明，但 `decay()` 内部会调 revealOwned，
          "建制内"的辖地应当**当场补回**全明（与自家城周围同款待遇）。 */
    var nDecay = F.decay(true);
    var afterDecay = 0;
    for (var q = 0; q < provList.length; q++) if (F.get(provList[q]) >= F.ALL) afterDecay++;
    out.decayedFull = afterDecay;
    out.decayCount = nDecay;
    /* ② 反例守卫：**把带行政身份的城撤掉**再 decay —— 辖地必须真的褪色。
          否则"永远全明"可能来自别的东西（比如整张图早被别处点亮），
          这条断言就变成装饰品。 */
    var removed = (G.state.cities || []).filter(function (c) { return c.admLevel === 'prov' && c.admIndex === pick.admIndex; });
    G.state.cities = (G.state.cities || []).filter(function (c) { return !(c.admLevel === 'prov' && c.admIndex === pick.admIndex); });
    var nDecay2 = F.decay(true);
    var afterDrop = 0;
    for (var w2 = 0; w2 < provList.length; w2++) if (F.get(provList[w2]) >= F.ALL) afterDrop++;
    out.fullWithoutCity = afterDrop;       /* 应远小于 100%，证明全明确实依赖那座城 */
    /* ③ 恢复城 → revealOwned 应把辖地补回全明（读档路径） */
    G.state.cities = (G.state.cities || []).concat(removed);
    F.revealOwned();
    var restored = 0;
    for (var w3 = 0; w3 < provList.length; w3++) if (F.get(provList[w3]) >= F.ALL) restored++;
    out.restoredFull = restored;
    out.decay2Count = nDecay2;
    return out;
  }, pick);
  console.log('TIERS ' + JSON.stringify(r2, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR ' + (e && (e.stack || e.message))); process.exit(1); });
