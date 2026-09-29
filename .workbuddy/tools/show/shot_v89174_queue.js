/* v89.174 实机验证（真浏览器）：
   ① 官府格弹窗：官府要务下方「在建队列」段（图 v89174-queue.png）
   ② 施工中弹窗：**不操作**，等主循环 live 自动换态（建造中 → 民房 · Lv1）（图 v89174-swap.png）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89174_queue.js */
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
    G.newGame({ name: '验174', cityName: '许都', region: '豫州', mapSeed: 20260975 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('city');
    G.state.settings.timeScale = 1;
    var city = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(city)[k] = 1e8; });
    var empties = [], gIdx = -1;
    city.cells.forEach(function (cc, i) {
      if (!cc.build && !cc.pending && !cc.official) empties.push(i);
      if (gIdx < 0 && cc.build && cc.build.id === 'guanfu') gIdx = i;
    });
    var rA = G.buildAt(city.id, empties[0], 'minfang');
    var rB = G.buildAt(city.id, empties[1], 'minfang');
    var qs = G.state.queues.build;
    if (qs[qs.length - 2]) { qs[qs.length - 2].totalTime = 6; qs[qs.length - 2].elapsed = 0; }
    if (qs[qs.length - 1]) { qs[qs.length - 1].totalTime = 40; qs[qs.length - 1].elapsed = 0; }  /* B 保持在建 */
    return { okA: rA.ok, okB: rB.ok, idxA: empties[0], gIdx: gIdx };
  });
  console.log('  造局：A=' + info.okA + '（格 ' + info.idxA + '，6 秒）· B=' + info.okB + '（40 秒）· 官府格 ' + info.gIdx);

  async function shotModal(file) {
    await p.waitForFunction(function () {
      var el = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
      if (!el) return false;
      var r = el.getBoundingClientRect();
      if (r.height < 100) return false;
      if (window.__shotH == null) { window.__shotH = r.height; return false; }
      if (Math.abs(window.__shotH - r.height) > 0.5) { window.__shotH = r.height; return false; }
      return true;
    }, null, { timeout: 6000, polling: 120 });
    var clip = await p.evaluate(function () {
      var el = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 10), width: r.width + 20, height: r.height + 20 };
    });
    if (clip) await p.screenshot({ path: OUT + file, fullPage: true, clip: clip });
    return clip;
  }

  console.log('===== ① 官府弹窗：官府要务下方「在建队列」 =====');
  await p.evaluate(function (ii) { var G = window.GAME; G.ui.closeAllModals(); G.ui.openBuildModal(ii.gIdx); }, info);
  await p.waitForTimeout(500);
  var s1 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var txt = m ? m.textContent : '';
    return {
      hasQ: txt.indexOf('在建队列') >= 0,
      cnt: (txt.match(/在建队列（\d+）/) || [''])[0],
      hasRow: txt.indexOf('民房') >= 0 && txt.indexOf('建造') >= 0,
      pct: /\d+% · \d\d:\d\d/.test(txt),
    };
  });
  chk('① 官府弹窗含「在建队列」段', s1.hasQ, s1.cnt);
  chk('① 队列行含建筑名 + 动作 + 进度条文本', s1.hasRow && s1.pct);
  var c1 = await shotModal('v89174-queue.png');
  console.log('   图1 ' + (c1 ? Math.round(c1.width) + 'x' + Math.round(c1.height) : 'FAIL'));

  console.log('===== ② 施工弹窗：不操作，等 live 自动换态 =====');
  await p.evaluate(function (ii) { var G = window.GAME; G.ui.closeAllModals(); G.ui.openBuildModal(ii.idxA); }, info);
  await p.waitForTimeout(400);
  var t0 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    return m ? m.textContent.indexOf('建造中') >= 0 : false;
  });
  chk('② 打开时弹窗为「建造中」', t0);
  /* 只等——不点、不关。ts=1 下 6 秒完成；给 12 秒余量 */
  await p.waitForTimeout(12000);
  var s2 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var txt = m ? m.textContent : '';
    return {
      open: !!m && txt.length > 0,
      stillBuilding: txt.indexOf('建造中') >= 0,
      normal: /民房 · Lv1/.test(txt),
      txt: txt.slice(0, 120),
    };
  });
  chk('② 弹窗仍开着（没被静默关掉）', s2.open);
  chk('★ ② 完全不操作 → 弹窗被 live 自动换成「民房 · Lv1」（不再建造中）',
    !s2.stillBuilding && s2.normal, s2.txt.replace(/\s+/g, ' ').slice(0, 70));
  var c2 = await shotModal('v89174-swap.png');
  console.log('   图2 ' + (c2 ? Math.round(c2.width) + 'x' + Math.round(c2.height) : 'FAIL'));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
