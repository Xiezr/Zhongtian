/* v89.165 实机验证（真浏览器 · 老板场景直接复现）：
   ① 指挥战斗清单：打开后**不做任何操作**，等 2.4 秒 → 读秒应自己跳动（live 每秒重开）
   ② 募兵队列（募兵面板 · 默认队列页）：同上，"余 X"自己走
   ③ 军务烽火页（视图页逐秒）："剩余 X（现实时间）"自己走
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89165_live.js */
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

  /* ---------- 造局 ---------- */
  var boot = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验165', cityName: '许都', region: '豫州', mapSeed: 20260965 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.currentCity();
    /* ① 一条行军（造局三件套：大 totalTime + 真将领 + status='march'） */
    var g0 = G.state.generals[0];
    g0.status = 'march'; g0.cityId = c.id;
    G.state.marches = [{ id: 'M165', cityId: c.id, genId: g0.id, modeId: 'raid',
      target: { kind: 'wild', x: 1, y: 1 }, tx: 1, ty: 1, name: '荒野·测', kind: 'wild',
      army: { yibing: 800 }, elapsed: 96000, totalTime: 600000, scheme: null, ops: 'assault', cargo: null }];
    G.state.battles = [];
    /* ② 军营 + 一条募兵队列（totalTime 取大：脚本期间不会走完） */
    var idxs = [];
    c.cells.forEach(function (x, i) { if (!x.build && x.official !== true && idxs.length < 1) idxs.push(i); });
    c.cells[idxs[0]].build = { id: 'junying', lvl: 4 };
    G.state.queues.train.push({ kind: 'train', cityId: c.id, bIdx: idxs[0], troopId: 'yibing',
      count: 50, elapsed: 600, totalTime: 6000, waiting: false });
    /* ③ 第二城（烽火页排期需 ≥2 城）：占野地 → buildCityAt */
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
    return { barIdx: idxs[0], cities: G.state.cities.length, built: built };
  });
  console.log('  造局：军营格 idx=' + boot.barIdx + ' · 城数=' + boot.cities + '（第二城 ' + (boot.built ? '已建' : '未建') + '）');
  await p.waitForTimeout(1200);

  /* ---------- ① 指挥战斗清单：读秒自己跳 ---------- */
  console.log('===== ① 指挥战斗清单（老板场景 · 不操作等 2.4 秒） =====');
  await p.evaluate(function () {
    var G = window.GAME;
    /* 按 DOM span 抓读秒（⚠️ 整窗 textContent 会把"兵力 800"与"16%"粘成"80016%"） */
    window.__grab1 = function () {
      var el = document.querySelector('#modal-root .war-list');
      var sp = null;
      if (el) Array.prototype.slice.call(el.querySelectorAll('span')).forEach(function (x) {
        if (!sp && /% ·/.test(x.textContent || '')) sp = x;
      });
      return sp ? (sp.textContent || '').trim() : '(无)';
    };
    G.ui.openBattleList();
  });
  await p.waitForTimeout(900);
  var t1 = await p.evaluate('window.__grab1()');
  await p.waitForTimeout(2400);
  var t2 = await p.evaluate('window.__grab1()');
  console.log('  采样：' + t1 + '  →  ' + t2);
  chk('★ 清单打开后不操作，读秒自己跳动（live 每秒重开）', t1 !== '(无)' && t2 !== '(无)' && t1 !== t2, t1 + ' → ' + t2);
  chk('读秒口径正确（16% · 时:分:秒）', /^16% · \d+:\d\d:\d\d$/.test(t1), t1);
  var rc1 = await p.evaluate(function () {
    var box = document.querySelector('#modal-root .modal');
    var r = box ? box.getBoundingClientRect() : null;
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
  if (rc1) {
    await p.screenshot({ path: OUT + 'v89165-battle-list.png',
      clip: { x: rc1.x, y: rc1.y, width: rc1.w, height: Math.min(rc1.h, 640) } });
    console.log('  图：v89165-battle-list.png');
  }

  /* ---------- ② 募兵队列（募兵面板）：余 X 自己走 ---------- */
  console.log('===== ② 募兵队列（募兵面板 · 默认队列页 · 等 2.4 秒） =====');
  await p.evaluate(function (barIdx) {
    var G = window.GAME;
    G.ui.closeAllModals();
    window.__grab2 = function () {
      var el = document.querySelector('#modal-root');
      var mm = el ? (el.textContent || '').match(/余 [\d:]+/) : null;
      return mm ? mm[0] : '(无)';
    };
    G.ui._trainTab = 'que';                      /* 默认页 = 募兵队列（§77.3：先摆正再看） */
    G.ui.openTroops(barIdx, 'normal');
    G.ui._trainTab = 'que';
    G.ui.renderTroopsModal();
  }, boot.barIdx);
  await p.waitForTimeout(900);
  var q1 = await p.evaluate('window.__grab2()');
  await p.waitForTimeout(2400);
  var q2 = await p.evaluate('window.__grab2()');
  console.log('  采样：' + q1 + '  →  ' + q2);
  chk('★ 募兵面板的「余 X」自己跳动（troops 子视图 live）', q1 !== '(无)' && q2 !== '(无)' && q1 !== q2, q1 + ' → ' + q2);
  var rc2 = await p.evaluate(function () {
    var box = document.querySelector('#modal-root .modal');
    var r = box ? box.getBoundingClientRect() : null;
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
  if (rc2) {
    await p.screenshot({ path: OUT + 'v89165-troops-live.png',
      clip: { x: rc2.x, y: rc2.y, width: rc2.w, height: Math.min(rc2.h, 640) } });
    console.log('  图：v89165-troops-live.png');
  }

  /* ---------- ③ 军务烽火页（视图页逐秒）：剩余 X（现实时间）自己走 ---------- */
  console.log('===== ③ 军务烽火页（视图页逐秒 · 等 2.4 秒） =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    window.__grab3 = function () {
      var el = document.getElementById('view-container');
      var mm = el ? (el.textContent || '').match(/剩余 [^（]+（现实时间）/) : null;
      return mm ? mm[0] : '(无)';
    };
    G.ui._marchTab = 'beacon';
    G.ui.setView('marches');
    G.ui.renderView('marches');
  });
  await p.waitForTimeout(900);
  var s1 = await p.evaluate('window.__grab3()');
  await p.waitForTimeout(2400);
  var s2 = await p.evaluate('window.__grab3()');
  console.log('  采样：' + s1 + '  →  ' + s2);
  chk('★ 烽火页「剩余 X（现实时间）」自己跳动（视图逐秒名单含 beacon）',
    s1 !== '(无)' && s2 !== '(无)' && s1 !== s2, s1 + ' → ' + s2);
  await p.screenshot({ path: OUT + 'v89165-beacon-live.png' });
  console.log('  图：v89165-beacon-live.png');

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
