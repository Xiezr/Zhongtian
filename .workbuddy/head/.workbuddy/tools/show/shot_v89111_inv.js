/* ============================================================
 * shot_v89111_inv.js — v89.111 实机图：来袭新节奏（每日 9 时一场 · 提前 4 时只报一次）
 *   ① 军务·烽火页：每日 9 时 / 下次来袭（剩余时间）/ 来犯势力 / 状态
 *   ② 烽火流水：5:30 那条预警原文（势力 + 剩余 + 今日 9 时）
 * 实机量：页面含「每日 9 时」「剩余」「来犯」；流水含预警；零溢出
 * 跑法：node .workbuddy/tools/show/shot_v89111_inv.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-headless-shell-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260923 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    st.rank = 10;                       /* 抬爵 → 领地上限放宽（否则平民 2 座挡住建城） */
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; st.res[k] = 9e6; });
    c.army = { yibing: 4200, changqiang: 2600, gongjian: 900 };
    c.wallLv = 8;
    /* 再添三座城（轮转排期才有看头），并给其中两座搭烽火台（情报分级） */
    var made = 0;
    for (var r = 1; r <= 8 && made < 3; r++) {
      for (var dx = -r; dx <= r && made < 3; dx++) for (var dy = -r; dy <= r && made < 3; dy++) {
        var t = G.map.tile(c.x + dx, c.y + dy);
        if (!t || t.terrain !== 'plain') continue;
        if (st.cities.some(function (x2) { return x2.x === c.x + dx && x2.y === c.y + dy; })) continue;
        st.wilds = (st.wilds || []).filter(function (x2) { return !(x2.x === c.x + dx && x2.y === c.y + dy); });
        st.wilds.push({ x: c.x + dx, y: c.y + dy, type: 'plain', lv: 3 });
        var b = G.buildCityAt(c.x + dx, c.y + dy);
        if (b && b.ok) {
          b.city.army = { yibing: 3600 };
          b.city.name = '分城' + (made + 1);
          var cell = -1;
          (b.city.cells || []).forEach(function (x, j) { if (!x.build && !x.official && cell < 0) cell = j; });
          if (cell >= 0 && made === 0) b.city.cells[cell].build = { id: 'fenghuotai', lvl: 2 };
          if (cell >= 0 && made === 1) b.city.cells[cell].build = { id: 'fenghuotai', lvl: 1 };
          made++;
        }
      }
    }
    /* 拨到第 3 天 5:30 → 真走"提前 4 时报一次"的预警分支（落一条烽火流水） */
    st.world = st.world || {};
    var d3 = 3;
    st.world.elapsed = G.invasionDueOfDay(d3) - 3 * 3600 - 30 * 60;
    G.invasionTick(1);
    G.ui.enterGame();
    G.refreshAll();
    var tgt = G.invasionTargetOfDay(d3);
    return { cities: st.cities.length, target: tgt ? tgt.name : '(none)',
      beacons: st.cities.filter(function (x) { return G.buildingLevel(x, 'fenghuotai') > 0; }).length };
  });
  console.log('开局：城 ' + boot.cities + ' · 当日目标=' + boot.target + ' · 有烽火台的城 ' + boot.beacons);

  /* ① 军务 · 烽火页 */
  var m1 = await page.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'beacon';
    G.ui.setView('marches');
    var vc = document.querySelector('#view-container');
    var tx = vc ? (vc.textContent || '') : '';
    var h = vc ? vc.innerHTML : '';
    return {
      /* 说明文案在 ui.help 的 data-tip 属性里（textContent 读不到）——用 innerHTML 判 */
      hasDay: h.indexOf('每日 9 时') >= 0, hasLeft: tx.indexOf('剩余') >= 0,
      hasSrc: tx.indexOf('来犯') >= 0, hasAlert: tx.indexOf('警报中') >= 0,
      rows: (h.match(/<tr>/g) || []).length,
      hasIntelPow: tx.indexOf('战力') >= 0,
      hasUnknown: tx.indexOf('流寇') >= 0 || tx.indexOf('郡国游兵') >= 0 || tx.indexOf('坞堡私兵') >= 0,
    };
  });
  await new Promise(function (r) { setTimeout(r, 320); });
  await page.screenshot({ path: path.join(OUT, 'v89111-beacon-page.png') });
  console.log('✓ v89111-beacon-page.png（每日9时 ' + m1.hasDay + ' · 剩余 ' + m1.hasLeft
    + ' · 来犯列 ' + m1.hasSrc + ' · 警报中 ' + m1.hasAlert + ' · 表行 ' + m1.rows
    + ' · 情报战力 ' + m1.hasIntelPow + '）');

  /* ② 烽火流水（滚动到流水块再截图） */
  var m2 = await page.evaluate(function () {
    var G = window.GAME;
    var msgs = G.msgsOf('beacon') || [];
    var first = msgs.length ? msgs[0].msg : '';
    var logs = document.querySelectorAll('#view-container .msg-log');
    if (logs.length) logs[logs.length - 1].scrollIntoView({ block: 'center' });
    return { n: msgs.length, first: first,
      ok: first.indexOf('剩余') >= 0 && first.indexOf('今日 9 时') >= 0 && first.indexOf('烽火') >= 0,
      blocks: logs.length };
  });
  await new Promise(function (r) { setTimeout(r, 320); });
  await page.screenshot({ path: path.join(OUT, 'v89111-beacon-flow.png') });
  console.log('✓ v89111-beacon-flow.png（烽火流水 ' + m2.blocks + ' 块 · 最新：' + m2.first.slice(0, 66) + '）');

  var ok = m1.hasDay && m1.hasLeft && m1.hasSrc && m1.hasAlert && m1.rows >= 4
    && m2.ok && m2.n >= 1;
  console.log(ok ? '\n全部实机判据通过（每日9时/剩余时间/来犯势力/警报中/流水预警）'
    : '\n⚠ 有判据未过，请查看上方');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(function (e) { console.error('脚本异常：', e); process.exit(1); });
