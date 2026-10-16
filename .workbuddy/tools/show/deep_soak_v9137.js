'use strict';
/* ============================================================
 * 深度浸泡评测 —— 600× · 域层全链路（在岗探针 · v91.37）
 * ------------------------------------------------------------
 * 与 .workbuddy/eval_20261016（SBTM 交互覆盖）互补：那个测**点击覆盖**，
 * 本探针测**域层在长时高速推进下的健康**（经济/队列/战斗/自动化/存档/内存）。
 *
 * 驱动：虚拟时钟（1 迭代 = 1 现实秒）+ GAME.tickOnce（内含 ×600 游戏推进 + 全部自动化）。
 * 不变量：非负/无 NaN/无 Infinity/时间单调/存档体积/堆内存/异常。
 * 用法：node deep_soak_v9137.js [--hours 12] [--players]
 * ============================================================ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var path = require('path');

var HOURS = (function () { var i = process.argv.indexOf('--hours'); return i >= 0 ? Number(process.argv[i + 1]) || 12 : 12; })();
var ITERS = Math.round(HOURS * 3600);        /* 1 迭代 = 1 现实秒 */
var PLAYERS = process.argv.includes('--players');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--js-flags=--expose-gc'] });
  var p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  var pageErrs = [];
  p.on('pageerror', function (e) { pageErrs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });

  /* 一份在页面里跑的大循环（返回结构化报告）。 */
  var report = await p.evaluate(function (args) {
    var HOURS = args.hours, ITERS = args.iters, PLAYERS = args.players;
    var G = window.GAME, U = G.utils, D = G.DATA;
    var R = { meta: { hours: HOURS, iters: ITERS, ts: 0 }, errs: [], viol: [], samples: [], players: [] };

    /* ---- 建档 + 建房 ---- */
    var st = G.newGame({ name: '评测', cityName: '灰岗', region: '碎垣', mapSeed: 20260926, portraitSeed: 8 });
    G.map.generate();
    G.ui._cityId = st.cities[0].id;

    /* ---- 活动富集：给兵/将/资源，使自动出征/探索真正开跑 ---- */
    (function enrich() {
      var c = st.cities[0];
      G.RES_KEYS.forEach(function (k) { c.res[k] = 5e6; });
      c.army = { buxingji: 20000, daodanche: 2000, dunwei: 3000 };
      st.generals = st.generals || [];
      if (!st.generals.length) st.generals.push(G.makeGeneral('统', 40, 'idle'));
      st.mainCityId = c.id;
    })();

    /* ---- 虚拟时钟：Date.now 走快，但**与迭代同步**（1 迭代 = 1 现实秒） ---- */
    var _base = Date.now();
    var _voff = 0;
    var _realNow = Date.now;
    Date.now = function () { return _base + _voff; };
    U.now = Date.now;
    G._realNowOf = Date.now;                       /* GAME.realNow 走它 */

    /* ---- 设 600× ---- */
    try { if (G.state.settings) G.state.settings.timeScale = 600; } catch (e) { }
    R.meta.ts = G.timeScale();

    /* ---- 开启全部自动化（等价于玩家把自动菜单全开） ---- */
    var A = {};
    try {
      st.settings = st.settings || {};
      st.settings.autoUpgrade = true; st.settings.autoResearch = true; st.settings.autoTrain = true;
      st.settings.autoHeal = true; st.settings.autoLordTrain = true; st.settings.autoGather = true;
      var am = G.autoMarchCfg(); if (am) { am.on = true; am.everyMin = 1; am.target = 'wild'; am.maxLevel = 6; am.dailyMax = 0;
        am.army = { buxingji: 5000 }; am.genId = (st.generals[0] || {}).id || null; }
      var ae = G.autoExploreCfg(); if (ae) { ae.on = true; ae.everyMin = 1; ae.dailyMax = 0; ae.army = { buxingji: 500 }; }
      A = { up: !!st.settings.autoUpgrade, march: !!(am && am.on), explore: !!(ae && ae.on) };
    } catch (e) { R.errs.push('auto-enable: ' + e.message); }
    R.meta.auto = A;

    function bad(v) { return typeof v === 'number' && (!isFinite(v) || v < 0); }
    function checkInv(i) {
      var s = G.state; if (!s) return;
      var ctx = { i: i, day: (G.questDayIndex ? G.questDayIndex() : 0) };
      /* I3 资源非负/无 NaN */
      (s.cities || []).forEach(function (c, ci) {
        var r = c.res || {};
        G.RES_KEYS.forEach(function (k) {
          var v = r[k];
          if (v != null && bad(v)) R.viol.push('I3 res ' + ctx.i + ' city' + ci + ' ' + k + '=' + v);
        });
        (c.army ? Object.keys(c.army) : []).forEach(function (id) {
          var n = c.army[id];
          if (n != null && bad(n)) R.viol.push('I4 army ' + ctx.i + ' ' + id + '=' + n);
        });
        if (c.pop != null && bad(c.pop)) R.viol.push('I7 pop ' + ctx.i + ' city' + ci + '=' + c.pop);
      });
      var g = s.res;
      if (g) G.RES_KEYS.forEach(function (k) { if (bad(g[k])) R.viol.push('I3 global ' + ctx.i + ' ' + k); });
      /* I5 英雄体力/忠诚范围 */
      (s.generals || []).forEach(function (gn) {
        if (gn.stamina != null && (bad(gn.stamina))) R.viol.push('I5 sta ' + ctx.i + ' ' + gn.name + '=' + gn.stamina);
        if (gn.loyalty != null && (gn.loyalty > 100.001 || bad(gn.loyalty))) R.viol.push('I5 loyal ' + ctx.i + ' ' + gn.name + '=' + gn.loyalty);
      });
      if (R.viol.length > 40) R.viol = R.viol.slice(0, 40);   /* 封顶防爆 */
    }
    function sample(i) {
      var s = G.state;
      var army = 0; (s.cities || []).forEach(function (c) { army += G.armyTotal(c); });
      var heap = (window.performance && performance.memory) ? performance.memory.usedJSHeapSize : 0;
      R.samples.push({ i: i, day: (G.questDayIndex ? G.questDayIndex() - (R.samples[0] ? R.samples[0].day0 : 0) : 0),
        cities: (s.cities || []).length, army: army, gens: (s.generals || []).length,
        grain: Math.round((G.res(s.cities[0]) || {}).grain || 0), heapMB: Math.round(heap / 1048576),
        bld: G.buildingCount ? s.cities.reduce(function (a, c) { return a + (c.build ? c.build.length : 0); }, 0) : 0,
        q: (s.queues.build.length + s.queues.train.length + s.queues.tech.length) });
    }

    var t0 = _realNow();
    var okTicks = 0;
    try {
      for (var i = 0; i < ITERS; i++) {
        _voff += 1000;                    /* 虚拟时钟 +1 现实秒（与游戏推进同基） */
        G.tickOnce();
        okTicks++;
        if (i % 600 === 0 && i > 0) checkInv(i);      /* 每 600 迭代（=10 游戏分钟×600… 实为每 600 现实秒）校验 */
        if (i % Math.max(1, Math.floor(ITERS / 24)) === 0) sample(i);
        /* 玩家驱动：周期性做真实操作，制造队列/战斗/建造变化 */
        if (PLAYERS && i % 1500 === 0) {
          try {
            var city = G.currentCity();
            if (city) {
              /* 补足本钱（模拟"一直在经营"） */
              G.RES_KEYS.forEach(function (k) { city.res[k] = Math.max(city.res[k] || 0, 5e6); });
              city.army = city.army || {};
              city.army.buxingji = Math.max(city.army.buxingji || 0, 30000);
              if (!(st.generals || []).length) { st.generals = st.generals || []; st.generals.push(G.makeGeneral('轮', 40, 'idle')); }
              var gid = (st.generals[0] || {}).id;
              /* ① 打野地（真实行军 → 抵达结算） */
              try {
                var cells = G.sphere && G.sphere.cells;
                if (cells && G.map && G.map.wildLevel) {
                  var found = -1;
                  for (var z = 0; z < cells.length; z++) {
                    if (cells[z] && !G.map.wildAt(z) && ['plain', 'caoyuan', 'forest', 'hill', 'desert'].indexOf(cells[z].type) >= 0
                      && G.map.wildLevel(z) <= 6) { found = z; break; }
                  }
                  if (found >= 0) G.battle.expedition({ kind: 'wild', ci: found }, 'occupy', { buxingji: 4000 }, gid);
                }
              } catch (e) { R.errs.push('exp-wild@' + i + ': ' + e.message); }
              /* ② 攻打最近的系统名城（真实攻城 → 占领/战报） */
              try {
                var npcs = G.DATA.NPC_CITIES || [];
                if (npcs.length) {
                  var nc = npcs[Math.min(npcs.length - 1, (i / 1500) % npcs.length)];
                  if (nc && !G.cityById(nc.id)) G.battle.attackCity(nc, { buxingji: 8000, daodanche: 1000 }, gid, 'occupy');
                }
              } catch (e) { R.errs.push('exp-city@' + i + ': ' + e.message); }
              R.players.push({ i: i, day: G.questDayIndex(), marches: (st.marches || []).length });
            }
          } catch (e) { R.errs.push('player@' + i + ': ' + e.message); }
        }
      }
    } catch (e) { R.errs.push('loop@' + i + ': ' + (e.stack || e.message)); }
    var t1 = _realNow();
    R.meta.wallMs = Math.round(t1 - t0);
    R.meta.okTicks = okTicks;

    /* ---- 终态存档体积（I8） ---- */
    try {
      var js = JSON.stringify(G.state);
      R.meta.saveKB = Math.round(js.length / 1024);
      R.meta.saveMB = +(js.length / 1048576).toFixed(2);
    } catch (e) { R.errs.push('save-serialize: ' + e.message); }

    /* ---- 终态快照 ---- */
    var s = G.state;
    R.autoInfo = {
      marchMsg: (s.autoMarchInfo || {}).msg, exploreMsg: (s.autoExploreInfo || {}).msg,
      marchCfg: (function () { var c = G.autoMarchCfg(); return c ? { on: c.on, last: c.last, everyMin: c.everyMin, genId: c.genId, army: c.army } : null; })(),
      gens: (s.generals || []).map(function (g) { return { name: g.name, status: g.status }; }),
    };
    R.final = {
      day: G.questDayIndex(), cities: (s.cities || []).length, gens: (s.generals || []).length,
      army: (s.cities || []).reduce(function (a, c) { return a + G.armyTotal(c); }, 0),
      bldN: s.cities.reduce(function (a, c) { return a + (c.build ? c.build.length : 0); }, 0),
      bldLv: s.cities.reduce(function (a, c) { return a + (c.build ? c.build.reduce(function (x, b) { return x + (b.level || 0); }, 0) : 0); }, 0),
      wilds: (s.wilds || []).length, marches: (s.marches || []).length,
      stats: (s.stats || null), msgLog: (s.msgLog || []).length, log: (s.log || []).length,
      items: Object.keys(s.items || {}).length, heapMB: (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0),
    };
    Date.now = _realNow;             /* 还原（后续断言用真实钟） */
    return R;
  }, { hours: HOURS, iters: ITERS, players: PLAYERS });

  /* ---- 落盘 ---- */
  var outDir = path.join(__dirname, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deep_soak.json'), JSON.stringify(report, null, 1));

  console.log('ts=' + report.meta.ts + ' iters=' + report.meta.okTicks + '/' + ITERS + ' wall=' + report.meta.wallMs + 'ms');
  console.log('final=' + JSON.stringify(report.final));
  console.log('saveMB=' + report.meta.saveMB + ' viol=' + report.viol.length + ' errs=' + report.errs.length + ' pageErrs=' + pageErrs.length);
  if (report.viol.length) console.log('VIOL(0..8)=' + JSON.stringify(report.viol.slice(0, 8)));
  if (report.errs.length) console.log('ERRS(0..5)=' + JSON.stringify(report.errs.slice(0, 5)));
  if (pageErrs.length) console.log('PAGEERRS(0..5)=' + JSON.stringify(pageErrs.slice(0, 5)));
  var s0 = report.samples[0] || {}, sN = report.samples[report.samples.length - 1] || {};
  console.log('mem ' + s0.heapMB + 'MB → ' + sN.heapMB + 'MB · armies ' + s0.army + '→' + sN.army + ' · cities ' + s0.cities + '→' + sN.cities);
  console.log('auto=' + JSON.stringify(report.autoInfo));
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
