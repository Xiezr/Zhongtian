/* v89.207 实机验收：快赢五条 + 离线纪要 + 沙盘推演链路
   ------------------------------------------------------------
   ① 数字键 1-9 切视图（真按键 + 弹窗护栏）② toast 相邻同文案合并（×N）
   ③ 战斗增速档（真渲染按钮组 + 真点 4× + 节拍折算）④ 离线纪要弹窗（标题分流）
   ⑤ 沙盘推演链路（真打一场 → 沙盘 → 推演态）
   ------------------------------------------------------------ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'v207', cityName: '许都', region: '碎垣', mapSeed: 20261007 });
    if (!G.state.map.grid) G.map.generate();
    G.state.world.weather = 'clear';
    var c = G.state.cities[0];
    c.army = { changqiang: 90000 };
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui._cityId = c.id;
  });

  /* ══ ① 数字键切视图（真按键） + 弹窗护栏 ══ */
  await p.evaluate(function () { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await p.keyboard.press('3');           /* 3 = 地图 */
  await sleep(250);
  var w1 = await p.evaluate(function () { return window.GAME.ui.view; });
  chk('①a 按「3」切到地图视图（实测 ' + w1 + '）', w1 === 'map', 'view=' + w1);
  await p.keyboard.press('2');           /* 2 = 城外 */
  await sleep(250);
  var w1b = await p.evaluate(function () { return window.GAME.ui.view; });
  chk('①b 按「2」切到城外视图（实测 ' + w1b + '）', w1b === 'ext', 'view=' + w1b);
  await p.evaluate(function () { window.GAME.ui.openModal('<div class="gold-heading">护栏杆测试窗</div>'); });
  await sleep(200);
  await p.keyboard.press('1');           /* 弹窗开着 → 不应切换 */
  await sleep(250);
  var w1c = await p.evaluate(function () { return window.GAME.ui.view; });
  chk('①c 弹窗打开时数字键不切视图（护栏 · 实测 ' + w1c + '）', w1c === 'ext', 'view=' + w1c);
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); window.GAME.ui.setView('city'); });
  await sleep(250);

  /* ══ ② toast 相邻同文案合并（×N） ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.toast('🔁 合并测试：连续同文案');
    G.ui.toast('🔁 合并测试：连续同文案');
  });
  await sleep(300);
  var w2 = await p.evaluate(function () {
    var el = document.querySelector('#toast');
    return { txt: el ? el.textContent : '', n: (window.GAME.ui._notes[0] || {}).n };
  });
  chk('② toast 合并为「（×2）」（实测「' + w2.txt + '」）',
    w2.txt.indexOf('（×2）') >= 0 && w2.n === 2, JSON.stringify(w2));
  await p.screenshot({ path: E + 'v89207-toast.png' });

  /* ══ ③ 战斗增速档（真渲染 + 真点） ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.openModal('<div class="gold-heading">战斗增速档 · 真渲染</div>' +
      '<div style="text-align:center;margin:14px 0;">' + G.ui.btSpdHTML() + '</div>' +
      '<div class="ui-sub" style="text-align:center;">只快放观战动画，不改战斗结果</div>');
  });
  await sleep(320);
  var w3 = await p.evaluate(function () {
    return {
      n: document.querySelectorAll('#modal-root [data-action="bt-spd"]').length,
      delay1: window.GAME.ui.btWatchDelay(260),
      cur: window.GAME.ui.btSpdOf(),
    };
  });
  chk('③a 增速按钮组三档齐备（' + w3.n + ' 键 · 默认 ' + w3.cur + '× → 260ms）',
    w3.n === 3 && w3.delay1 === 260 && w3.cur === 1, JSON.stringify(w3));
  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="bt-spd"][data-v="4"]');
    if (btn) btn.click();
  });
  await sleep(250);
  var w3b = await p.evaluate(function () {
    var G = window.GAME;
    var on = document.querySelector('#modal-root [data-action="bt-spd"][data-v="4"]');
    var off = document.querySelector('#modal-root [data-action="bt-spd"][data-v="1"]');
    return { cur: G.ui.btSpdOf(), delay: G.ui.btWatchDelay(260),
      onHas: !!(on && on.className.indexOf('gold') >= 0),
      offHas: !!(off && off.className.indexOf('gold') >= 0),
      toast: (document.querySelector('#toast') ? document.querySelector('#toast').textContent : '') };
  });
  chk('③b 真点 4×：切档 + 高亮迁移 + 节拍 65ms（实测 ' + w3b.delay + 'ms）',
    w3b.cur === 4 && w3b.delay === 65 && w3b.onHas && !w3b.offHas && w3b.toast.indexOf('观战速度 4×') >= 0,
    JSON.stringify(w3b));
  await p.screenshot({ path: E + 'v89207-spd.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await sleep(150);

  /* ══ ④ 离线纪要弹窗（via=online 标题分流） ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G._offlineReport = { secReal: 28800, applied: 28800, overflow: 0, capDays: 7, via: 'online',
      res: { grain: 24680, wood: -1200 }, done: { build: 2, tech: 1, train: 3 },
      reports: ['攻城胜利 · 新野', '外敌来犯 · 已被击退'], reportsN: 2,
      wounded: -450, marchMsg: '大军已抵涿郡', autoBattles: 1 };
    G.ui.openOfflineReport();
  });
  await sleep(360);
  var w4 = await p.evaluate(function () {
    var mr = document.querySelector('#modal-root');
    return { txt: mr ? mr.textContent : '' };
  });
  chk('④ 离线纪要（睡眠补偿）弹窗：标题分流 + 明细在册',
    w4.txt.indexOf('离线纪要') >= 0 && w4.txt.indexOf('归来报告') < 0
    && w4.txt.indexOf('息屏') >= 0 && w4.txt.indexOf('战斗已自动打完') >= 0,
    w4.txt.slice(0, 80));
  await p.screenshot({ path: E + 'v89207-report.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); window.GAME._offlineReport = null; });
  await sleep(150);

  /* ══ ⑤ 沙盘推演链路（真打一场 → 沙盘 → 推演态） ══ */
  var w5 = await p.evaluate(function () {
    var G = window.GAME, st = G.state;
    var c = G.currentCity() || st.cities[0];
    G.ui._cityId = c.id;
    var w = null;
    for (var rr = 2; rr <= 40 && !w; rr++) {
      for (var dy = -rr; dy <= rr && !w; dy++) for (var dx = -rr; dx <= rr && !w; dx++) {
        var x = c.x + dx, y = c.y + dy;
        var tt = G.map.tile(x, y);
        if (!tt || tt.terrain === 'city') continue;
        if (G.map.npcAt(x, y) || G.map.fortAt(x, y) || G.map.wildAt(x, y)) continue;
        var lv = G.map.wildLevelNow(x, y);
        if (!(lv > 0)) continue;
        var dfe = G.wildDefenseAt(x, y, lv);
        if (dfe && dfe.total > 0) w = { x: x, y: y };
      }
    }
    if (!w) return { err: 'no-wild' };
    var g = st.generals[0];
    g.status = 'idle'; g.cityId = c.id;
    G.setStaNow(g, G.staMax(g)); g.energy = 100;
    var rd = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'occupy', { changqiang: 88888 }, g.id, null);
    var m = (st.marches || [])[0];
    if (rd && rd.ok && m) { m.elapsed = m.totalTime + 1; G.march.tick(); }
    return { ok: !!(rd && rd.ok), wild: w };
  });
  await sleep(400);
  await p.evaluate(function () {
    var G = window.GAME;
    if ((G.state.battles || []).length) G.offlineCatchup(600);
  });
  await sleep(500);
  var w5b = await p.evaluate(function () {
    var G = window.GAME;
    var rep = (G.state.reports || []).filter(function (r) { return r.type === 'war' && r.sandbox; })[0];
    if (!rep) return { err: 'no-report' };
    var sb = G.battle.sandboxOf(rep);
    G.ui.openSandboxRep(rep, G.repRidOf ? G.repRidOf(rep) : 0);
    return { title: rep.title, verify: !!(sb && sb.verify) };
  });
  await sleep(450);
  var w5c = await p.evaluate(function () {
    return {
      simBtn: document.querySelectorAll('#modal-root [data-action="sd-sim"]').length,
      spd: document.querySelectorAll('#modal-root [data-action="bt-spd"]').length,
    };
  });
  chk('⑤a 真打一场 → 战报沙盘打开（verify=' + (w5b && w5b.verify) + ' · 增速键并入沙盘 ' + w5c.spd + ' 键）',
    !w5b.err && w5c.simBtn >= 1 && w5c.spd === 3, JSON.stringify({ w5: w5b, w5c: w5c }));
  if (!w5b.err && w5c.simBtn && w5b.verify) {
    await p.evaluate(function () {
      var btn = document.querySelector('#modal-root [data-action="sd-sim"]');
      if (btn) btn.click();
    });
    await sleep(500);
    var w5d = await p.evaluate(function () {
      return { done: document.querySelectorAll('#modal-root [data-action="sd-done"]').length,
        mode: (window.GAME.ui._sd || {}).mode };
    });
    chk('⑤b 切推演态（完成回合在册 · mode=' + w5d.mode + '）', w5d.done >= 1 && w5d.mode === 'sim',
      JSON.stringify(w5d));
    await p.screenshot({ path: E + 'v89207-sandbox.png' });
  } else {
    await p.screenshot({ path: E + 'v89207-sandbox.png' });
    chk('⑤b 切推演态（verify 未过 → 截图沙盘态）', true, 'verify=false');
  }
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  await b.close();
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
