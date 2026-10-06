/* v89.210 实机验收 · 睡眠补偿等价验证（真浏览器 · 拨钟法）
   ------------------------------------------------------------
   电脑睡眠 / 息屏唤醒在实验室无法直接复现（CDP frozen 对前台页不生效）——
   等价验证 = **拨真实钟**（模拟"墙上时间跳了 8 小时"）+ 真浏览器主循环真实拍钟：
   ① world.elapsed 全量补回（≈ 8h × 时间倍率）
   ② 资源真结算（粮增长）
   ③ 大缺口 → 「离线纪要」弹窗自动弹出（息屏补算报告 · 含"息屏"字样）
   ④ 轻提示 toast（时间跳变已补算）
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
    G.newGame({ name: 'v210夜', cityName: '许都', region: '碎垣', mapSeed: 20261011 });
    if (!G.state.map.grid) G.map.generate();
    G.state.world.weather = 'clear';
    G.ui.enterGame();
    G.ui.closeAllModals();
    /* 拨钟钩子：把 Date.now 加偏移（真定时器不动 —— 正是"睡眠唤醒"的等价） */
    var real = Date.now;
    window.__shift210 = function (ms) { Date.now = function () { return real.call(Date) + ms; }; };
    window.__night0 = {
      elapsed: G.state.world.elapsed,
      grain: G.state.cities[0].res.grain,
      ts: G.timeScale(),
    };
  });

  await sleep(1200);   /* 让主循环先正常拍几拍（锚点新鲜） */
  await p.evaluate(function () { window.__shift210(8 * 3600 * 1000); });
  await sleep(2400);   /* 下一拍：发现 8h 缺口 → 全量补算（并弹纪要） */

  var w = await p.evaluate(function () {
    var G = window.GAME;
    var mr = document.getElementById('modal-root');
    var toast = document.getElementById('toast');
    return {
      dElapsed: G.state.world.elapsed - window.__night0.elapsed,
      expect: 8 * 3600 * window.__night0.ts,
      grain0: window.__night0.grain,
      grain: G.state.cities[0].res.grain,
      modalTxt: mr ? ((mr.querySelector('.modal') ? mr.textContent : '') || '').slice(0, 220) : '',
      hasModal: !!(mr && mr.querySelector && mr.querySelector('.modal')),
      toastTxt: toast ? toast.textContent : '',
    };
  });
  var drift = w.expect > 0 ? Math.abs(w.dElapsed - w.expect) / w.expect : 1;
  chk('① 8 小时缺口全量补回（Δ=' + Math.round(w.dElapsed) + ' 游戏秒 · 期望≈' + w.expect + ' · 偏差 ' + (drift * 100).toFixed(1) + '%）',
    drift < 0.12, JSON.stringify({ d: w.dElapsed, e: w.expect }));
  chk('② 资源真结算（粮 ' + Math.round(w.grain0) + ' → ' + Math.round(w.grain) + '）', w.grain > w.grain0,
    String(w.grain0) + ' -> ' + String(w.grain));
  chk('③ 大缺口 → 「离线纪要」自动弹出（含"息屏"字样 · 补算完成了什么）',
    w.hasModal && w.modalTxt.indexOf('离线纪要') >= 0 && w.modalTxt.indexOf('息屏') >= 0,
    w.modalTxt.slice(0, 90));
  chk('④ 轻提示 toast（时间跳变）', w.toastTxt.indexOf('时间跳变') >= 0, w.toastTxt.slice(0, 60));
  await p.screenshot({ path: E + 'v89210-night.png' });

  console.log('\n===== 睡眠等价验证：' + PASS + ' 通过 / ' + FAIL + ' 失败 =====');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
