/* v89.216 实机验收：① 分页条「页码文本严格居中」（v89.213 挂账 36px 归零）
   ② 换皮视觉层：调色板荒原化 + 骑兵剪影 → 机车（程序化图标）
   图：v89216-city / v89216-troops / v89216-pager */
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
    G.newGame({ name: 'v216', cityName: '许都', region: '碎垣', mapSeed: 20261016 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    G.currentCity().army = { yibing: 1234, changqiang: 800, qingji: 120, tieji: 30, chuangnu: 12 };
    G.ui.setView('shop'); G.ui.renderView('shop');
  });
  await sleep(650);

  /* ══ ① 分页条：页码文本次中轴 ══ */
  var r1 = await p.evaluate(function () {
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    var pg = document.querySelector('#bottom-bar .pager') || document.querySelector('.pager');
    if (!pg) return { err: 'no-pager' };
    var l = pg.querySelector('.pg-side.l'), rr = pg.querySelector('.pg-side.r'), info = pg.querySelector('.pg-info');
    var mid = function (el) { var x = el.getBoundingClientRect(); return Math.round((x.left + x.right) / 2 / k * 10) / 10; };
    var w = function (el) { return el ? Math.round(el.getBoundingClientRect().width / k) : 0; };
    return { lw: w(l), rw: w(rr), imid: info ? mid(info) : 0, txt: info ? info.textContent.slice(0, 24) : '' };
  });
  console.log('  分页：左组 ' + r1.lw + ' / 右组 ' + r1.rw + ' / 文本中点 ' + r1.imid + '  「' + r1.txt + '」');
  chk('①a 两侧组等宽（对中前提）', r1.lw === r1.rw && r1.lw > 0, r1.lw + ' vs ' + r1.rw);
  chk('①b 页码文本中点 = 屏幕中点 720（v89.213 时实测 +36px）', Math.abs(r1.imid - 720) <= 1, 'mid=' + r1.imid);
  await p.screenshot({ path: E + 'v89216-pager.png', clip: { x: 200, y: 930, width: 1040, height: 70 } });

  /* ══ ② 视觉层：调色板 + 机车图标 ══ */
  var r2 = await p.evaluate(async function () {
    var G = window.GAME;
    var P = G.icons.P;
    var txt = await (await fetch('js/icons.js')).text();
    return {
      palette: { ink: P.ink, tileHi: P.tileHi, wallHi: P.wallHi, grHi: P.grHi, waHi: P.waHi },
      wheelMark: (txt.match(/r="6\.6"/g) || []).length,      /* 机车轮（模板串 1 处，渲染出 2 枚） */
      headlight: txt.indexOf('61.4') >= 0,
      horseLeg: txt.indexOf('L43 52 L40 52'),                 /* 旧马腿路径特征 */
      carBody: txt.indexOf('M22 30 L24 20 L40 20 L44 30'),    /* 座驾（越野车顶）特征 */
      hasBikeNote: txt.indexOf('骑兵剪影 → **机车**') >= 0,
    };
  });
  console.log('  矢量回退层：轮标记 ' + r2.wheelMark + ' · 前灯 ' + r2.headlight
    + ' · 旧马腿 ' + r2.horseLeg + ' · 座驾车顶 ' + r2.carBody);
  chk('②a 调色板 = 荒原化（锈铁顶/水泥墙/荒草/浑水）',
    r2.palette.tileHi === '#b4a08a' && r2.palette.wallHi === '#d5cfc0'
    && r2.palette.grHi === '#a8b06a' && r2.palette.waHi === '#8fbcca', JSON.stringify(r2.palette));
  chk('②b 机车（矢量回退层）：车轮模板 + 前灯在册', r2.wheelMark >= 1 && r2.headlight, 'wheels=' + r2.wheelMark);
  chk('②c 旧马形（马腿路径）已清除', r2.horseLeg < 0, 'idx=' + r2.horseLeg);
  chk('②d 座驾槽位图标 = 越野车（车顶特征在册）', r2.carBody >= 0, 'idx=' + r2.carBody);

  /* 城池视图 + 军务截图 */
  await p.evaluate(function () { var G = window.GAME; G.ui.closeAllModals(); G.ui.setView('city'); G.ui.renderView('city'); G.ui.renderSide(); });
  await sleep(700);
  await p.screenshot({ path: E + 'v89216-city.png' });
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._trainTab = 'cav';
    if (G.ui.openTroops) G.ui.openTroops();
  });
  await sleep(800);
  await p.screenshot({ path: E + 'v89216-troops.png' });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
