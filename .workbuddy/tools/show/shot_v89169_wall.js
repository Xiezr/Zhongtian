/* v89.169 实机验证（真浏览器）：城墙 0 级虚影环
   ① 0 级（未修建）→ 虚线虚影环真渲染（图 v89169-wall-lv0.png）
   ② Lv3 → 实墙登场、虚影退场（图 v89169-wall-lv3.png）
   ③ 悬停虚影 → brightness 提亮（图 v89169-wall-hover.png）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89169_wall.js */
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

  var clip = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验169', cityName: '许都', region: '碎垣', mapSeed: 20260969 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('city');
    G.wallSlotOf(G.currentCity()).build = null;      /* 未修建（0 级） */
    G.refreshAll();
    var r = document.querySelector('.iso-board').getBoundingClientRect();
    return { x: Math.max(0, r.x - 14), y: Math.max(0, r.y - 14), width: r.width + 28, height: r.height + 28 };
  });
  await p.waitForTimeout(320);

  console.log('===== ① 0 级（未修建）→ 虚线虚影环 =====');
  var s0 = await p.evaluate(function () {
    var g = document.querySelector('svg.iso-wall-ghost');
    if (!g) return { ok: false };
    var line = g.querySelector('polygon.wghost-line');
    var cs = getComputedStyle(line);
    return {
      ok: true,
      corners: g.querySelectorAll('rect.wghost-corner').length,
      dash: cs.strokeDasharray,
      stroke: cs.stroke,
      filter0: getComputedStyle(g).filter,
    };
  });
  chk('虚影环真渲染（iso-wall-ghost 在 DOM）', !!s0.ok);
  chk('四角虚影角楼位 ×4', s0.ok && s0.corners === 4);
  chk('虚线描边生效（computed dasharray）', s0.ok && /10/.test(s0.dash || ''), s0.dash);
  chk('描边走主题金 --gold-rgb（暗主题 = 201,162,75 @ .74）', s0.ok && /201, ?162, ?75/.test(s0.stroke || '') && /0\.74/.test(s0.stroke || ''), s0.stroke);
  await p.screenshot({ path: OUT + 'v89169-wall-lv0.png', fullPage: true, clip: clip });

  console.log('\n===== ② Lv3 → 实墙登场、虚影退场 =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.wallSlotOf(G.currentCity()).build = { id: 'chengqiang', lvl: 3 };
    G.refreshAll();
  });
  await p.waitForTimeout(320);
  var s3 = await p.evaluate(function () {
    return {
      ghost: !!document.querySelector('svg.iso-wall-ghost'),
      towers: document.querySelectorAll('svg.iso-wall .wtower').length,
      body: !!document.querySelector('svg.iso-wall polygon[stroke="url(#wallBody)"]'),
    };
  });
  chk('实墙角楼 ×4 真渲染', s3.towers === 4);
  chk('实墙墙身在（wallBody 渐变描边）', s3.body);
  chk('虚影退场（建好不画虚影）', !s3.ghost);
  await p.screenshot({ path: OUT + 'v89169-wall-lv3.png', fullPage: true, clip: clip });

  console.log('\n===== ③ 悬停虚影 → brightness 提亮 =====');
  var hv = await p.evaluate(function () {
    var G = window.GAME;
    G.wallSlotOf(G.currentCity()).build = null;
    G.refreshAll();
    var hit = document.querySelector('.wall-hit.top');
    var r = hit.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p.waitForTimeout(240);
  await p.mouse.move(hv.x, hv.y);
  await p.waitForTimeout(260);
  var sH = await p.evaluate(function () {
    var g = document.querySelector('svg.iso-wall-ghost');
    return { filter: g ? getComputedStyle(g).filter : '', hoverBg: getComputedStyle(document.querySelector('.wall-hit.top')).backgroundColor };
  });
  chk('悬停 → 虚影环提亮（brightness 1.45 生效）', /1\.45/.test(sH.filter || ''), sH.filter);
  await p.screenshot({ path: OUT + 'v89169-wall-hover.png', fullPage: true, clip: clip });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
