/* v89.174 复现：建造完成瞬间的 UI 行为（老板：「读秒完成后，状态还是在建造中」）
   场景 A：城内大界面格子（city 视图）—— 完成后格子是否重绘为正常
   场景 B：施工中弹窗（build-cell 点开的）—— 完成后弹窗是否换形态 / 文本变什么
   每秒采样 + 三张截图（A 前 / A 后 / B 后）。
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/play/repro_v89174_builddone.js */
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
  var p = await b.newPage({ viewport: { width: 1680, height: 1120 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var info = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '复现174', cityName: '许都', region: '豫州', mapSeed: 20260974 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('city');
    G.state.settings.timeScale = 1;                    /* 让读秒看得见（默认 120 太快） */
    var city = G.currentCity();
    G.res(city).grain = 1e8; G.res(city).wood = 1e8; G.res(city).stone = 1e8; G.res(city).iron = 1e8;
    /* 找两个空格 */
    var empties = [];
    city.cells.forEach(function (c, i) {
      if (!c.build && !c.pending && !c.official) empties.push(i);
    });
    var idxA = empties[0], idxB = empties[1];
    var rA = G.buildAt(city.id, idxA, 'minfang');
    var qA = G.state.queues.build[G.state.queues.build.length - 1];
    qA.totalTime = 8; qA.elapsed = 0;                  /* 复现用：8 游戏秒 @1x = 8 现实秒 */
    var rB = G.buildAt(city.id, idxB, 'minfang');
    var qB = G.state.queues.build[G.state.queues.build.length - 1];
    qB.totalTime = 8; qB.elapsed = 0;
    return { okA: rA.ok, okB: rB.ok, idxA: idxA, idxB: idxB, msgA: rA.msg, msgB: rB.msg };
  });
  console.log('  造局：A=' + info.msgA + '（格 ' + info.idxA + '）· B=' + info.msgB + '（格 ' + info.idxB + '）');
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + 'v89174-before.png', fullPage: false });

  console.log('===== 场景 A：大界面格子（不打开弹窗）=====');
  for (var t = 1; t <= 12; t++) {
    await p.waitForTimeout(1000);
    var sA = await p.evaluate(function (ii) {
      var G = window.GAME;
      var city = G.currentCity();
      var cellA = city.cells[ii.idxA];
      var host = document.querySelector('[data-action="build-cell"][data-idx="' + ii.idxA + '"]');
      var pctEl = document.querySelector('[data-build-progress="city:' + ii.idxA + '"]');
      return {
        qlen: G.state.queues.build.length,
        pend: !!cellA.pending, lvl: cellA.build ? cellA.build.lvl : 0,
        busy: host ? host.className.indexOf('busy') >= 0 : null,
        pctTxt: pctEl ? pctEl.textContent : null,
        lastBc: G._lastBuildCount,
        prog: G.buildProgress('city', ii.idxA) ? G.buildProgress('city', ii.idxA).label : null,
      };
    }, info);
    console.log('  t=' + t + 's  q=' + sA.qlen + '  格: pend=' + sA.pend + ' lvl=' + sA.lvl
      + ' busy=' + sA.busy + ' pctTxt=' + JSON.stringify(sA.pctTxt)
      + '  buildProgress=' + JSON.stringify(sA.prog) + '  lastBc=' + sA.lastBc);
  }
  await p.screenshot({ path: OUT + 'v89174-after-a.png', fullPage: false });
  var endA = await p.evaluate(function (ii) {
    var G = window.GAME;
    var city = G.currentCity();
    var cellA = city.cells[ii.idxA];
    var host = document.querySelector('[data-action="build-cell"][data-idx="' + ii.idxA + '"]');
    return {
      pend: !!cellA.pending, lvl: cellA.build ? cellA.build.lvl : 0,
      busy: host ? host.className.indexOf('busy') >= 0 : null,
      hasPct: !!document.querySelector('[data-build-progress="city:' + ii.idxA + '"]'),
      qlen: G.state.queues.build.length,
    };
  }, info);
  chk('逻辑链：队列已清 / cell.build 已设 / pending 已清',
    endA.qlen === 0 && endA.lvl >= 1 && !endA.pend,
    'q=' + endA.qlen + ' lvl=' + endA.lvl + ' pend=' + endA.pend);
  chk('★ 场景 A：格子重绘为正常（无 busy / 无进度文本）',
    endA.busy === false && !endA.hasPct,
    'busy=' + endA.busy + ' hasPct=' + endA.hasPct);

  console.log('===== 场景 B：施工中弹窗（第二格，点开看）=====');
  /* 重置第二格队列时间：已在跑（可能已完成）——重造：若 B 已完成则直接再升一级 */
  var info2 = await p.evaluate(function (ii) {
    var G = window.GAME;
    var city = G.currentCity();
    var cellB = city.cells[ii.idxB];
    /* B 已完成（lvl=1）→ 走升级路径再开一次施工 */
    var r = cellB.build ? G.upgradeAt(city.id, ii.idxB) : G.buildAt(city.id, ii.idxB, 'minfang');
    var q = G.state.queues.build[G.state.queues.build.length - 1];
    if (q) { q.totalTime = 8; q.elapsed = 0; }
    if (r.ok) G.ui.openBuildModal(ii.idxB);              /* 打开施工中弹窗（老板视角） */
    return { ok: r.ok, msg: r.msg };
  }, info);
  console.log('  造局B：' + info2.msg);
  for (var t2 = 1; t2 <= 12; t2++) {
    await p.waitForTimeout(1000);
    var sB = await p.evaluate(function (ii) {
      var G = window.GAME;
      var m = document.querySelector('#modal-root');
      var mtxt = m ? m.textContent : '';
      var mp = m ? m.querySelector('[data-modal-progress]') : null;
      var city = G.currentCity();
      var cellB = city.cells[ii.idxB];
      return {
        qlen: G.state.queues.build.length,
        pend: !!cellB.pending, lvl: cellB.build ? cellB.build.lvl : 0,
        modalOpen: !!m && mtxt.length > 0,
        building: mtxt.indexOf('建造中') >= 0, upgrading: mtxt.indexOf('升级中') >= 0,
        mpTxt: mp ? mp.textContent : null,
        head: (mtxt.match(/[^\n]{0,26}(建造中|升级中)[^\n]{0,40}/) || [''])[0],
      };
    }, info);
    console.log('  t=' + t2 + 's  q=' + sB.qlen + '  B: lvl=' + sB.lvl + ' pend=' + sB.pend
      + ' 弹窗[' + (sB.building ? '建造中' : (sB.upgrading ? '升级中' : '-')) + ']'
      + ' pct=' + JSON.stringify(sB.mpTxt));
  }
  await p.screenshot({ path: OUT + 'v89174-after-b.png', fullPage: false });
  var endB = await p.evaluate(function (ii) {
    var G = window.GAME;
    var m = document.querySelector('#modal-root');
    var mtxt = m ? m.textContent : '';
    var mp = m ? m.querySelector('[data-modal-progress]') : null;
    return {
      qlen: G.state.queues.build.length,
      modalOpen: !!m && mtxt.length > 0,
      building: mtxt.indexOf('建造中') >= 0 || mtxt.indexOf('升级中') >= 0,
      mpTxt: mp ? mp.textContent : null,
    };
  }, info);
  chk('★ 场景 B：完成后弹窗**不再**显示建造中/升级中（或弹窗已换新形态）', !endB.building,
    'building=' + endB.building + ' pctTxt=' + JSON.stringify(endB.mpTxt));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
