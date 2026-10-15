/* v89.166 实机验证（真浏览器）：
   ① 城池面板（含「进入城池」）→ 点按钮 → 菜单全关 + 城内大界面（图 v89166-city-panel / v89166-city-entered）
   ② 君主面板「进入」→ 同一行为（菜单全关 + view=city）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89166_enter.js */
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

  /* ---------- 造局：第二城（进入目标）+ 站在地图视图 ---------- */
  var boot = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验166', cityName: '许都', region: '豫州', mapSeed: 20260966 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c0 = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c0)[k] = 200000; });
    G.res(c0).gold = 200000;
    var built = false;
    for (var y = 1; y < (G.DATA.MAP_H || 40) - 1 && !built; y++) {
      for (var x = 1; x < (G.DATA.MAP_W || 40) - 1 && !built; x++) {
        var t = G.map.tile(x, y);
        if (!t || t.terrain !== 'plain') continue;
        var dup = false;
        (G.state.wilds || []).forEach(function (w) { if (w.x === x && w.y === y) dup = true; });
        if (dup) continue;
        G.state.wilds.push({ x: x, y: y, type: 'plain', lv: 3 });
        try { G.buildCityAt(x, y); } catch (e) { }
        if (G.state.cities.length >= 2) built = true;
      }
    }
    G.ui.setView('map');                       /* 老板路径：从地图出发 */
    return { cities: G.state.cities.length, target: G.state.cities[1] ? G.state.cities[1].id : null,
      targetName: G.state.cities[1] ? G.state.cities[1].name : '—' };
  });
  console.log('  造局：城数=' + boot.cities + ' · 目标城=' + boot.targetName);
  await p.waitForTimeout(900);

  /* ---------- ① 城池面板 → 进入城池 ---------- */
  console.log('===== ① 城池面板 · 进入城池（地图点击我城的同一入口） =====');
  await p.evaluate(function (tid) {
    var G = window.GAME;
    G.ui.openCityPanel(GAME.cityById(tid));    /* 与"地图点我城"同一入口函数 */
  }, boot.target);
  await p.waitForTimeout(500);
  var r1 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    return { has: !!(m && m.querySelector('.inner-panel')),
      hasBtn: !!(m && m.querySelector('[data-action="city-enter"]')),
      view: window.GAME.ui.view,
      txt: m ? (m.textContent || '').replace(/\s+/g, ' ').slice(0, 90) : '' };
  });
  console.log('  面板：' + r1.txt);
  chk('城池面板已打开（真渲染 · 含「进入城池」键）', r1.has && r1.hasBtn);
  chk('打开时视图仍在地图（面板是"菜单"，不是直进）', r1.view === 'map', 'view=' + r1.view);
  var rc1 = await p.evaluate(function () {
    var box = document.querySelector('#modal-root .modal');
    var r = box ? box.getBoundingClientRect() : null;
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
  if (rc1) {
    await p.screenshot({ path: OUT + 'v89166-city-panel.png',
      clip: { x: rc1.x, y: rc1.y, width: rc1.w, height: Math.min(rc1.h, 700) } });
    console.log('  图：v89166-city-panel.png');
  }

  await p.evaluate(function () {
    document.querySelector('#modal-root [data-action="city-enter"]').click();
  });
  await p.waitForTimeout(600);
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var vc = document.getElementById('view-container');
    return {
      hasModal: !!document.querySelector('#modal-root .inner-panel'),
      stack: (G.ui._modalStack || []).length,
      view: G.ui.view,
      city: G.currentCity() ? G.currentCity().name : '—',
      iso: !!(vc && vc.querySelector('.city-iso')),
      toast: (function () { var t = document.querySelector('#toast-layer'); return t ? (t.textContent || '').slice(0, 40) : ''; })(),
    };
  });
  console.log('  点击后：view=' + r2.view + ' · 当前城=' + r2.city + ' · 弹窗=' + r2.hasModal + ' · iso=' + r2.iso + ' · toast=' + r2.toast);
  chk('★ 点「进入城池」→ 菜单全关（无残留弹窗 · 栈清空）', !r2.hasModal && r2.stack === 0);
  chk('★ 直接显示城内大界面（view=city · .city-iso 真渲染）', r2.view === 'city' && r2.iso);
  chk('★ 当前城已切到目标城', r2.city === boot.targetName, r2.city);
  await p.screenshot({ path: OUT + 'v89166-city-entered.png' });
  console.log('  图：v89166-city-entered.png');

  /* ---------- ② 君主面板「进入」（对照入口 · 同一行为） ---------- */
  console.log('===== ② 君主面板 · 进入（对照 · 同一出口） =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('map');
    G.ui.openLordInfo();
  });
  await p.waitForTimeout(400);
  var r3 = await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="lord-city-enter"]');
    var has = !!btn;
    if (btn) btn.click();
    return { has: has };
  });
  await p.waitForTimeout(500);
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    return { hasModal: !!document.querySelector('#modal-root .inner-panel'),
      view: G.ui.view, city: G.currentCity() ? G.currentCity().name : '—' };
  });
  console.log('  点击后：view=' + r4.view + ' · 当前城=' + r4.city + ' · 弹窗=' + r4.hasModal);
  chk('君主面板含「进入」键（真渲染）', r3.has);
  chk('★ 点「进入」→ 菜单全关 + 城内大界面（两入口行为一致）', !r4.hasModal && r4.view === 'city');

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
