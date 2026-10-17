'use strict';
/* v91.74 实机验证：世界数据归一 —— 切星球后背景星球的队列/产出是否继续推进 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({ executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe', args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui');
  var out = await p.evaluate(async function () {
    var G = window.GAME, sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: 20260926 });
    G.ui._cityId = st.cities[0].id; G.ui.enterGame(); G.ui.setView('city');
    var c1 = st.cities[0];
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { st.res[k] = 9e7; });
    st.res.pop = 9e5;

    /* 第二颗星球 + 一座城（带 pid） */
    var p2 = G.addPlanet({ seed: 777001 });
    G.enterPlanet(p2.id); await sleep(40);
    var c2 = G.currentCity();
    c2.res = c2.res || {};
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c2.res[k] = 1e6; });
    c2.res.pop = 1e5;
    /* 第二星球放军营 + 科研中心，排建造/募兵/科技 */
    c2.cells[20].build = { id: 'junying', lvl: 5 };
    c2.cells[21].build = { id: 'shuyuan', lvl: 5 };
    st.queues.build.push({ pid: p2.id, cityId: c2.id, gridIndex: 22, buildId: 'minfang', type: 'build', elapsed: 0, totalTime: 1e9 });
    G.train('buxingji', 50, c2.id, 20);
    G.systems.research('zhongzhi', c2.id);
    var before2 = {
      cities: st.cities.length,
      build: st.queues.build.filter(function (q) { return q.pid === p2.id; }).length,
      train: st.queues.train.filter(function (q) { return q.pid === p2.id; }).length,
      tech: st.queues.tech.filter(function (q) { return q.pid === p2.id; }).length,
      grain: c2.res.grain
    };

    /* 切回母星（星球 1）—— 背景星球 = 星球 2 */
    G.enterPlanet(1); await sleep(40);
    var bq = st.queues.build.filter(function (q) { return q.pid === p2.id; })[0];
    var tq = st.queues.train.filter(function (q) { return q.pid === p2.id; })[0];
    var kq = st.queues.tech.filter(function (q) { return q.pid === p2.id; })[0];
    var e0 = { build: bq ? bq.elapsed : -1, train: tq ? tq.elapsed : -1, tech: kq ? kq.elapsed : -1 };
    /* 在母星上 tick 20 次：背景星球必须继续走 */
    for (var i = 0; i < 20; i++) G.tickOnce();
    var e1 = { build: bq.elapsed, train: tq.elapsed, tech: kq.elapsed };
    var grainGrew = c2.res.grain > before2.grain;

    /* 自动化是否覆盖背景星球：自动升级候选里应出现星球 2 的城 */
    st.settings.autoUpgrade = true;
    c2.cells[23].build = { id: 'minfang', lvl: 1 };
    G.autoUpgrade();
    var autoHitP2 = st.queues.build.some(function (q) { return q.pid === p2.id && q.cityId === c2.id && q.gridIndex === 23; });
    st.settings.autoUpgrade = false;

    /* 世界数组全局：cityById / cityByIdAnywhere 都查得到两星球的城 */
    return {
      before: before2, elapsedAway: e0, elapsedAfterTicks: e1, grainGrew: grainGrew,
      autoUpgradeHitsP2: autoHitP2,
      findC1: !!G.cityById(c1.id), findC2: !!G.cityById(c2.id),
      anyC2: !!G.cityByIdAnywhere(c2.id),
      citiesAll: st.cities.length,
      sliceView1: (G.sliceOf(1).cities || []).length,
      sliceView2: (G.sliceOf(p2.id).cities || []).length
    };
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('ERRORS', errs.length ? JSON.stringify(errs.slice(0, 5)) : '0');
  await b.close();
})();
