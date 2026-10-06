/* 探针：为什么"真打一场"没出战报、"真拨时刻"没出烽火 —— 打印出口返回值 */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var out = await page.evaluate(function () {
    var G = window.GAME, log = [];
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260923 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    c.army = { changqiang: 6000, gongjian: 3000, qingji: 1200 };
    G.ui.enterGame(); G.ui.setView('reports'); G.refreshAll();
    log.push('城市数 ' + st.cities.length + ' · INVASION.enabled=' + (G.DATA.INVASION || {}).enabled
      + ' unlockCities=' + (G.DATA.INVASION || {}).unlockCities
      + ' settings.invasion=' + (st.settings && st.settings.invasion));
    /* 找野地 */
    var t = null;
    for (var r = 1; r <= 4 && !t; r++) {
      for (var dx = -r; dx <= r && !t; dx++) for (var dy = -r; dy <= r && !t; dy++) {
        var tt = G.map.tile(c.x + dx, c.y + dy);
        if (tt && tt.terrain !== 'city' && tt.terrain !== 'lake') t = { x: c.x + dx, y: c.y + dy, t: tt.terrain };
      }
    }
    log.push('找到目标 ' + JSON.stringify(t));
    var gen = (st.generals || [])[0];
    log.push('将领 ' + (gen ? gen.name + ' status=' + gen.status + ' cityId=' + gen.cityId : '无'));
    if (gen) { gen.cityId = c.id; gen.status = 'idle'; }
    var r1 = G.battle.expedition({ kind: 'wild', x: t.x, y: t.y }, 'raid',
      { changqiang: 3000, gongjian: 1500, qingji: 600 }, gen.id);
    log.push('出征返回 ' + JSON.stringify(r1 && r1.ok !== undefined ? { ok: r1.ok, msg: r1.msg } : r1));
    log.push('战报数 ' + (st.reports || []).length + ' · 类型 ' + JSON.stringify((st.reports || []).map(function (x) { return x.type || 'battle'; })));
    var r2 = G.battle.expedition({ kind: 'wild', x: t.x, y: t.y }, 'scout', { qingji: 200 }, gen.id);
    log.push('侦查返回 ' + JSON.stringify(r2 && r2.ok !== undefined ? { ok: r2.ok, msg: r2.msg } : r2));
    log.push('侦查后战报数 ' + (st.reports || []).length);
    /* 烽火：先把城市数凑到 2（真出口建城） */
    log.push('INVASION 原设置 ' + JSON.stringify({ enabled: (G.DATA.INVASION || {}).enabled, unlock: (G.DATA.INVASION || {}).unlockCities }));
    return log;
  });
  out.forEach(function (l) { console.log('  ' + l); });
  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('探针失败：' + (e && e.stack || e)); process.exit(1); });
