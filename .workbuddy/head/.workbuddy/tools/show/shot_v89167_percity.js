/* v89.167 实机验证（真浏览器）：
   ① 开自动升级（3 城）→ **等 2.5 秒（主循环自动排）** → 逐城核对：每城 ≥1 条、总数 >3（改前上限 3）
   ② 自动化面板真渲染「各城独立建造位」状态行（图 v89167-auto-pane.png）
   ③ 主城城内：多个施工格同时进行（图 v89167-city-building.png）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89167_percity.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 造局：3 城 + 候选 + 开自动升级 ---------- */
  var boot = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验167', cityName: '许都', region: '碎垣', mapSeed: 20260967 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    G.state.rank = 6;                                 /* 领地上限随爵位 */
    var setR = function (c) { ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = 600000; }); };
    setR(G.currentCity()); G.res(G.currentCity()).gold = 300000;
    var MAXW = Math.min((G.DATA.MAP_W || 40) - 1, 60);
    for (var y = 1; y < MAXW && G.state.cities.length < 3; y++) {
      for (var x = 1; x < MAXW && G.state.cities.length < 3; x++) {
        var t = G.map.tile(x, y);
        if (!t || t.terrain !== 'plain') continue;
        var dup = false;
        (G.state.wilds || []).forEach(function (w) { if (w.x === x && w.y === y) dup = true; });
        if (dup) continue;
        setR(G.currentCity());
        G.state.wilds.push({ x: x, y: y, type: 'plain', lv: 3 });
        try { G.buildCityAt(x, y); } catch (e) { }
      }
    }
    G.state.cities.forEach(function (c) {
      c.cells.forEach(function (x) { if (x.build && !x.official) x.build = null; });
      var gi = -1;
      for (var i = 0; i < c.cells.length; i++) { if (c.cells[i].official) { gi = i; break; } }
      c.cells[gi].build = { id: 'guanfu', lvl: 3 };
      var put = 0;
      for (var i2 = 0; i2 < c.cells.length && put < 4; i2++) {
        if (c.cells[i2].official || c.cells[i2].build) continue;
        c.cells[i2].build = { id: 'minfang', lvl: 1 };
        put++;
      }
      setR(c);
    });
    G.ui.setView('city'); G.ui.setCity(G.state.cities[0].id);
    G.state.queues.build.length = 0;
    G.state.settings.autoUpgrade = true;              /* 开开关 —— 排布交给主循环 */
    return { cities: G.state.cities.length };
  });
  console.log('  造局：城数=' + boot.cities + ' · 自动升级已开（主循环驱动）');
  await p.waitForTimeout(2600);                       /* 等主循环跑 2-3 拍 */

  /* ---------- ① 主循环自动排：逐城核对 ---------- */
  console.log('===== ① 主循环自动排（不手动调 · 等 2.6 秒） =====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var by = {};
    (G.state.queues.build || []).forEach(function (q) { by[q.cityId] = (by[q.cityId] || 0) + 1; });
    return { by: by, total: (G.state.queues.build || []).length,
      msg: ((G.state.autoState || {}).msg || ''),
      perSlots: G.state.cities.map(function (c) { return G.buildSlots(c); }),
      names: G.state.cities.map(function (c) { return c.name; }),
      counts: G.state.cities.map(function (c) { return by[c.id] || 0; }),
      pend: G.state.cities.map(function (c) { return c.cells.filter(function (x) { return x.pending; }).length; }) };
  });
  console.log('  各城在办 = ' + JSON.stringify(r1.by) + ' · 总=' + r1.total + ' · 城内施工格 = ' + JSON.stringify(r1.pend));
  console.log('  autoState = ' + r1.msg);
  chk('★ 每城都被排上（逐城遍历 · 分别升级）',
    r1.counts.every(function (n) { return n >= 1; }),
    JSON.stringify(r1.counts) + ' @ ' + r1.names.join('/'));
  chk('★ 总条数 > 3（改前全境上限 3）', r1.total > 3, 'total=' + r1.total);
  chk('★ 各城不超各自建造位（' + r1.perSlots.join('/') + '）',
    Object.keys(r1.by).every(function (k) { return r1.by[k] <= 3; }), JSON.stringify(r1.by));
  chk('主城城内多个施工格（3 格同时施工）', r1.pend[0] >= 2, JSON.stringify(r1.pend));

  /* ---------- ② 自动化面板（状态行） ---------- */
  console.log('===== ② 自动化面板 · 各城独立建造位 =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._autoSel = 'upgrade';
    G.ui.setView('auto');
  });
  await p.waitForTimeout(700);
  var r2 = await p.evaluate(function () {
    var el = document.getElementById('view-container');
    return { txt: el ? (el.textContent || '').replace(/\s+/g, ' ') : '' };
  });
  /* 两态皆可：刚排入（"各城独立建造位"）/ 已排满（"每城独立"）—— 口径同一件事 */
  chk('★ 面板状态行写明「每城独立」（两态）',
    r2.txt.indexOf('各城独立建造位') >= 0 || r2.txt.indexOf('每城独立') >= 0,
    (r2.txt.match(/本轮排入[^·]*/) || r2.txt.match(/各城队列已满[^）]*（[^）]*）/) || [''])[0]);
  chk('面板说明写明「每城独立建造位 · 逐城遍历、各自排满」',
    r2.txt.indexOf('每城独立建造位') >= 0 && r2.txt.indexOf('逐城遍历') >= 0);
  await p.screenshot({ path: OUT + 'v89167-auto-pane.png' });
  console.log('  图：v89167-auto-pane.png');

  /* ---------- ③ 主城城内（多格施工） ---------- */
  console.log('===== ③ 主城城内 · 多格施工 =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.setCity(G.state.cities[0].id);
    G.ui.setView('city');
  });
  await p.waitForTimeout(600);
  var r3 = await p.evaluate(function () {
    var vc = document.getElementById('view-container');
    return { busy: vc ? vc.querySelectorAll('.iso-tile.busy').length : 0,
      iso: !!(vc && vc.querySelector('.city-iso')) };
  });
  console.log('  城内施工格（.busy）= ' + r3.busy);
  chk('★ 城内视图真渲染 + 多格施工中', r3.iso && r3.busy >= 2, 'busy=' + r3.busy);
  await p.screenshot({ path: OUT + 'v89167-city-building.png' });
  console.log('  图：v89167-city-building.png');

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
