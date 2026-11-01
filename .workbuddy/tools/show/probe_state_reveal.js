/* 州辖地视野：同机位「点亮前 / 点亮后」对照出图 + 数值验收
 * 用法：node .workbuddy/tools/show/probe_state_reveal.js
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
    G.ui.setView('map');           /* 3D 球图在切到地图视图时才构建 */
  });
  var waitBoot = async function () {
    await p.waitForFunction(function () {
      var o = document.getElementById('boot-loading');
      return !o || !o.classList.contains('on');
    }, null, { timeout: 120000 });
  };
  await waitBoot();
  await p.waitForTimeout(1200);

  /* ---- 数值验收（独立于画面） ---- */
  var num = await p.evaluate(function () {
    var G = window.GAME, SP = G.mapSphere || G.sphere, F = G.fog;
    var r = {};
    var sz = {}, none = 0;
    for (var i = 0; i < SP.nv; i++) {
      var s0 = G.map.stateAt(i);
      if (!s0) none++; else sz[s0] = (sz[s0] || 0) + 1;
    }
    r.nv = SP.nv; r.noState = none; r.states = Object.keys(sz).length;
    var pick = null, best = -1;
    Object.keys(sz).forEach(function (k) { if (sz[k] > best) { best = sz[k]; pick = k; } });
    r.pick = pick; r.pickSize = sz[pick];
    r.beforeSeen = F.stats().seen;
    r.badName = F.revealState('不存在的州');
    return r;
  });
  console.log('NUM ' + JSON.stringify(num));

  /* ---- 机位：对准该州辖地中心，取"点亮前" ---- */
  var pick = num.pick;
  await p.evaluate(function (stateName) {
    var G = window.GAME, M = G.map3d, SP = G.mapSphere || G.sphere;
    var list = G.map.stateCiList(stateName);
    /* 取**陆地**质心定向：州辖地大多包含大片海，取中点常落在洋面（实测第一次就拍到全蓝） */
    var ax = 0, ay = 0, az = 0, n = 0;
    for (var i = 0; i < list.length; i++) {
      var c = SP.cells[list[i]];
      if (!c || !c.dir) continue;
      var t = c.type || '';
      if (t === 'ocean' || t === 'sea' || t === 'lake') continue;
      ax += c.dir[0]; ay += c.dir[1]; az += c.dir[2]; n++;
    }
    if (!n) { ax = SP.cells[list[0]].dir[0]; ay = SP.cells[list[0]].dir[1]; az = SP.cells[list[0]].dir[2]; n = 1; }
    var L = Math.hypot(ax, ay, az) || 1;
    var o = M.camO; M.clearFocus && M.clearFocus(); M.camFree = true;
    o.yaw = Math.atan2(ax / L, az / L);
    o.pitch = Math.asin(ay / L) + 0.55;
    o.dist = M.ZOOM_MIN + 150;
  }, pick);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: '.workbuddy/shots/state_before.png' });
  console.log('WROTE state_before.png');

  /* ---- 点亮该州，等迷雾重建后"点亮后" ---- */
  var res = await p.evaluate(function (stateName) {
    var G = window.GAME, F = G.fog;
    var before = F.stats().seen;
    var hit = F.revealState(stateName);
    var after = F.stats().seen;
    var list = G.map.stateCiList(stateName), full = 0;
    for (var j = 0; j < list.length; j++) if (F.get(list[j]) >= F.ALL) full++;
    return { hit: hit, before: before, after: after, delta: after - before,
      fullInState: full, size: list.length, hit2: F.revealState(stateName) };
  }, pick);
  console.log('REVEAL ' + JSON.stringify(res));
  await p.waitForTimeout(1800);
  await p.screenshot({ path: '.workbuddy/shots/state_after.png' });
  console.log('WROTE state_after.png');

  /* ---- 邻州是否被误点亮（平凡解守卫） ---- */
  var other = await p.evaluate(function (stateName) {
    var G = window.GAME, F = G.fog, sf = G.map._stateField();
    var otherName = sf.names.filter(function (n) { return n !== stateName; })[0];
    var ol = G.map.stateCiList(otherName), full = 0;
    for (var k = 0; k < ol.length; k++) if (F.get(ol[k]) >= F.ALL) full++;
    return { state: otherName, size: ol.length, fullPct: Math.round(full / Math.max(1, ol.length) * 1000) / 10 };
  }, pick);
  console.log('OTHER ' + JSON.stringify(other));

  await b.close();
})().catch(function (e) { console.error('ERR ' + (e && (e.stack || e.message))); process.exit(1); });
