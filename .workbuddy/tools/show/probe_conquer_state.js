/* 真实占领链路：直接调 GAME.onConquer 占领某州首府，检查
 *   ① 城真的进版图（type 保留 zhou）；② 该州辖地被点亮；
 *   ③ 日志里有"下辖 N 格视野尽开"（读 st.log / st.msgLog，不是 st.reports）。
 * 用法：node .workbuddy/tools/show/probe_conquer_state.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  var p = await b.newPage({ viewport: { width: 1100, height: 760 } });
  p.on('pageerror', function (e) { console.log('EXC ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var out = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'CT', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    var F = G.fog;
    var zhou = (G.DATA.NPC_CITIES || []).filter(function (c) {
      return c.type === 'zhou' && c.state === '霜脊';
    })[0];
    if (!zhou) return { err: 'no zhou' };
    var r = { zhou: zhou.name, state: zhou.state };
    var list = G.map.stateCiList(zhou.state);
    r.size = list.length;
    var before = F.stats().seen;
    r.beforeFull = 0;
    for (var i = 0; i < list.length; i++) if (F.get(list[i]) >= F.ALL) r.beforeFull++;
    r.citiesBefore = st.cities.length;
    try { G.onConquer(zhou, {}, null, null); r.ok = true; }
    catch (e) { r.ok = false; r.err2 = String(e && (e.message || e)); }
    r.citiesAfter = st.cities.length;
    var nm = st.cities.filter(function (c) { return c.name === zhou.name; })[0];
    r.cityIn = !!nm;
    r.cityType = nm && nm.type;
    var full = 0;
    for (var j = 0; j < list.length; j++) if (F.get(list[j]) >= F.ALL) full++;
    r.fullAfter = full;
    r.seenDelta = F.stats().seen - before;
    var all = [];
    (st.log || []).forEach(function (x) { if (x && x.msg) all.push(x.msg); });
    (st.msgLog || []).forEach(function (x) { if (x && x.msg) all.push(x.msg); });
    r.logHit = all.join('\n').indexOf('下辖') >= 0;
    r.logSample = all.filter(function (l) { return l.indexOf('下辖') >= 0; }).slice(0, 1);
    return r;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(function (e) { console.error('ERR ' + (e && (e.stack || e.message))); process.exit(1); });
