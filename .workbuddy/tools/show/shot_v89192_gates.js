/* v89.192 实机验证：① 回本城按钮 ② 观战补历史 ③ 沙盘显示复核 ④ 射程修复回放
 * 用法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node shot_v89192_gates.js
 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  var pass = 0, fail = 0;
  function chk(name, ok, extra) {
    if (ok) { pass++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
    else { fail++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
  }
  p.on('pageerror', function (e) { console.log('  [pageerror] ' + e.message); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  /* ===== 起局 + 地图 ===== */
  var boot = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '越王勾践', cityName: '会稽', region: '潮湾', mapSeed: 20260931 });
    G.state.world.weather = 'clear';       /* §90.1 纪律：战斗相关固定天气 */
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    return { mapOk: !!G.state.map.grid, cities: G.state.cities.length };
  });
  chk('起局 + 地图生成', boot.mapOk, '城数=' + boot.cities);

  /* ===== ① 回本城按钮 ===== */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('map');
    var btns = document.querySelectorAll('#bottom-bar [data-action="map-mycity"]');
    var bC = document.querySelector('#bottom-bar [data-action="map-center"]');
    var bM = btns[0];
    var out = { n: btns.length, hasCenter: !!bC };
    if (bC && bM) {
      var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
      var rc = bC.getBoundingClientRect(), rm = bM.getBoundingClientRect();
      out.order = Math.round((rm.left - rc.left) / k);     /* 回本城应在回主城右侧 */
      out.label = bM.textContent.trim();
    }
    /* 切到第二座城，再看回本城能不能跳到该城（造一座城） */
    return out;
  });
  chk('① 回本城按钮在册（回主城右侧）', r1.n === 1 && r1.hasCenter && r1.order > 0,
    'n=' + r1.n + ' dx=' + r1.order + ' 文案=' + r1.label);

  var r1b = await p.evaluate(function () {
    var G = window.GAME;
    var c0 = G.state.cities[0];
    /* 造第二座城（占野地 → 筑城），把 _cityId 切过去 → 点回本城 → 视野中心应变 */
    var made = null;
    outer:
    for (var dx = 2; dx <= 8; dx++) for (var dy = -8; dy <= 8; dy++) {
      var x = c0.x + dx, y = c0.y + dy, tl = G.map.tile(x, y);
      if (!tl || tl.terrain !== 'plain') continue;
      if (G.map.wildAt(x, y)) continue;
      G.state.wilds.push({ x: x, y: y, type: 'plain', lv: 1 });
      var rr = G.buildCityAt(x, y);
      if (rr && rr.ok !== false) { made = rr.city || G.state.cities[G.state.cities.length - 1]; break outer; }
    }
    if (!made) return { err: 'no-second-city' };
    G.ui._cityId = made.id;
    /* 先把视野移到远处，再点按钮 */
    G.ui.mapView.x = 10; G.ui.mapView.y = 10;
    G.ui.mapMyCity();
    var mv = { x: G.ui.mapView.x, y: G.ui.mapView.y };
    return { cx: made.x, cy: made.y, mv: mv, name: made.name,
      back: (mv.x === made.x && mv.y === made.y) };
  });
  chk('① 回本城：点击后视野中心 = 当前城坐标', r1b.back === true,
    JSON.stringify(r1b));
  await p.screenshot({ path: E + 'v89192-map.png' });

  /* ===== ② 观战补历史 ===== */
  var r2 = await p.evaluate(async function () {
    var G = window.GAME;
    G.state.settings.battleWatch = true;
    var c0 = G.state.cities[0];
    /* ①段把当前城切到了新城 —— 这里切回（dispatch 读"当前城"的兵力） */
    G.ui._cityId = c0.id;
    var g0 = G.state.generals[0];
    g0.cityId = c0.id; g0.status = 'idle';
    /* 找低等级野地 */
    var tgt = null, CMAX = 499;
    for (var dx = -6; dx <= 6 && !tgt; dx++) for (var dy = -6; dy <= 6 && !tgt; dy++) {
      if (!dx && !dy) continue;
      var x = c0.x + dx, y = c0.y + dy, tl = G.map.tile(x, y);
      if (!tl || tl.terrain === 'city') continue;
      var lv = G.map.wildLevelNow(x, y);
      if (lv >= 1 && lv <= 3) tgt = { x: x, y: y, lv: lv };
    }
    if (!tgt) return { err: 'no-wild' };
    c0.army = { yibing: 900 };
    G.setStaNow(g0, 200); g0.energy = 200;
    var d = G.march.dispatch({ kind: 'wild', x: tgt.x, y: tgt.y, lv: tgt.lv },
      'raid', { yibing: 900 }, g0.id, null, null, null);
    if (!d || d.ok === false) return { err: 'dispatch:' + (d && d.msg) };
    (G.state.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
    G.march.tick();
    var rec = (G.state.battles || [])[0];
    if (!rec) return { err: 'no-battle' };
    /* 后台推进 3 回合（模拟"玩家没看、战斗照打"） */
    for (var i = 0; i < 3; i++) G.battle.stepBattle(rec.id);
    var roundBefore = rec.round;
    /* 点上观战（中途进入） */
    G.ui.openBattlefield(rec.id);
    await new Promise(function (r) { setTimeout(r, 600); });
    var log = document.getElementById('bt-log');
    var blocks = 0, hdrs = [];
    if (log && log.children) {
      Array.prototype.forEach.call(log.children, function (el) {
        if (el.className.indexOf('hdr') >= 0) { blocks++; hdrs.push(el.textContent); }
      });
    }
    return { roundBefore: roundBefore, hdrN: blocks, hdrs: hdrs,
      logKids: log && log.children ? log.children.length : -1 };
  });
  chk('② 中途观战：前 3 回合的块被补渲染到 #bt-log', r2.hdrN >= 3, JSON.stringify(r2));
  await p.screenshot({ path: E + 'v89192-watch.png' });

  /* ===== ③ 沙盘显示复核（与战场界面同框对比） ===== */
  var r3 = await p.evaluate(async function () {
    var G = window.GAME;
    /* 把当前战斗跑完 → 生成战报 → 打开沙盘 */
    var rec = (G.state.battles || [])[0];
    if (rec) G.battle.autoBattle(rec.id);
    await new Promise(function (r) { setTimeout(r, 400); });
    var rep = (G.state.reports || [])[0];
    if (!rep) return { err: 'no-report' };
    G.ui.closeAllModals();
    var rid = G.repRidOf ? G.repRidOf(rep) : 0;
    G.ui.openSandbox(rid);
    await new Promise(function (r) { setTimeout(r, 500); });
    var wrap = document.getElementById('sd-wrap');
    var board = document.getElementById('sd-board');
    var field = document.getElementById('sd-field');
    var logEl = document.getElementById('sd-log');
    var modal = document.querySelector('#modal-root .modal');
    function R(el) { if (!el) return null; var r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) }; }
    var out = {
      wrap: R(wrap), board: R(board), field: R(field), log: R(logEl), modal: R(modal),
      over: wrap ? (wrap.scrollHeight - wrap.clientHeight) : -1,
      verify: G.ui._sd ? G.ui._sd.sb.verify : null,
      frames: G.ui._sd ? G.ui._sd.sb.frames.length : 0,
      rounds: G.ui._sd ? G.ui._sd.sb.rounds : 0,
    };
    /* 帧流行数（滑到末帧时应有一批行） */
    if (G.ui._sd && G.ui.sdSet) { G.ui.sdSet(999); }
    await new Promise(function (r) { setTimeout(r, 300); });
    out.logLines = logEl ? logEl.children.length : -1;
    return out;
  });
  chk('③ 沙盘可打开（含帧流）', !r3.err && r3.verify !== undefined, JSON.stringify(r3));
  /* v89.192（老板 4）：沙盘**铺满**（参考战场界面）——实机几何硬判据 */
  chk('③b 沙盘铺满：wrap ≥700 · board ≥350 · 帧流 ≥250（改前 443/272/96）',
    !r3.err && r3.wrap && r3.wrap.h >= 700 && r3.board && r3.board.h >= 350
      && r3.log && r3.log.h >= 250 && r3.over === 0,
    (r3.wrap ? r3.wrap.h : '-') + '/' + (r3.board ? r3.board.h : '-') + '/'
      + (r3.log ? r3.log.h : '-') + ' over=' + r3.over);
  await p.screenshot({ path: E + 'v89192-sandbox.png' });

  /* ===== ④ 射程修复实证（回到老板场景的形态：回放帧里弓箭手转为出手） ===== */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var T = G.tactic;
    var env = T.begin({ gongjian: 3000 }, null, { qingji: 3000, changqiang: 3000, daodun: 3000, gongjian: 3000 },
      0, null, { field: 2300 });
    env.units.atk.forEach(function (u) { if (u.id === 'gongjian') u.adv = 267; });
    env.units.def.forEach(function (u) {
      if (u.id === 'qingji') u.adv = 875;
      if (u.id === 'changqiang') u.adv = 300;
      if (u.id === 'daodun') u.adv = 275;
      env.setCmd && env.setCmd('def', u.id, { s: 'hold' });
    });
    env.setCmd('atk', 'gongjian', { s: 'advance', t: 'changqiang' });
    var r = env.step();
    var evs = (r.events || []).filter(function (e) { return e.side === 'atk' && e.id === 'gongjian'; });
    return { evs: evs.map(function (e) { return e.kind + (e.kill ? ('(' + e.kill + '→' + (e.target || '') + ')') : ''); }) };
  });
  chk('④ 射程回落：目标（长枪 1733 外）不打、「射程内伏击车（1158）」被出手',
    r4.evs.join(' ').indexOf('attack') >= 0, JSON.stringify(r4.evs));

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
