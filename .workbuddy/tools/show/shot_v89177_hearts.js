/* v89.177 实机验证（真浏览器）：
   ① 官府弹窗「民心 / 民怨」段（值 + 两措施按钮）
   ② 真点「鼓舞民心」→ 民心 50→56 · 金 -2000 · 按钮转「本日已行」（live 重开刷新）
   ③ 君主面板「突破考验」五关清单
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89177_hearts.js */
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

  var setup = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验177', cityName: '许都', region: '碎垣', mapSeed: 20260977 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.map.generate();
    var c = G.state.cities[0];
    var gIdx = -1;
    c.cells.forEach(function (cc, i) { if (gIdx < 0 && cc.build && cc.build.id === 'guanfu') gIdx = i; });
    if (gIdx < 0) return { ok: false, msg: '无官府格' };
    G.ui.openBuildModal(gIdx);
    return { ok: true, gIdx: gIdx, hearts: G.heartsOf(), gold: G.goldOf() };
  });
  chk('① 官府弹窗打开（官府格 ' + setup.gIdx + '）· 初始民心 ' + setup.hearts, setup.ok && setup.hearts === 50);
  await p.waitForTimeout(600);

  var s1 = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var txt = root ? root.textContent : '';
    return {
      txt: txt, hasSeg: txt.indexOf('民心 / 民怨') >= 0,
      b1: !!document.querySelector('#modal-root [data-action="hearts-boost"]'),
      b2: !!document.querySelector('#modal-root [data-action="hearts-soothe"]'),
      seg: (txt.match(/民心 \/ 民怨[^措]{0,120}/) || [''])[0],
    };
  });
  chk('① 「民心 / 民怨」段在册 + 两措施按钮', s1.hasSeg && s1.b1 && s1.b2, s1.seg.slice(0, 90));
  await p.screenshot({ path: OUT + 'v89177-hearts.png', fullPage: false });
  console.log('  （截图 v89177-hearts.png）');

  /* ② 真点「鼓舞民心」 */
  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="hearts-boost"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(1600);   /* 等 live 重开刷新按钮状态 */
  var s2 = await p.evaluate(function () {
    var G = window.GAME;
    var txt = (document.querySelector('#modal-root') || {}).textContent || '';
    return {
      hearts: G.heartsOf(), comfort: G.heartsComfortOf(), gold: G.goldOf(),
      btnTxt: ((document.querySelector('#modal-root [data-action="hearts-boost"]') || {}).textContent) || '',
      stillBtn: !!document.querySelector('#modal-root [data-action="hearts-boost"]'),
    };
  });
  /* ⚠️ 这是活系统：1.6 秒等待期间民心在按公式**衰减**（0.5/游戏时）、金在**生产**——
     断言取区间（上界=理论值 +6 / 扣 2000，下界放宽 0.2 以容纳实时变化）。 */
  chk('② 民心 50→≈56（安抚 +6 · 实时衰减下界）', s2.hearts > 55.8 && s2.hearts <= 56 && s2.comfort > 5.8,
    '民心=' + s2.hearts.toFixed(2) + ' 安抚=' + s2.comfort.toFixed(2));
  chk('② 金扣 2000（±期间税产）', (setup.gold - s2.gold) >= 1990 && (setup.gold - s2.gold) <= 2010,
    setup.gold + '→' + s2.gold);
  chk('② 按钮转「本日已行」', s2.stillBtn && s2.btnTxt.indexOf('本日已行') >= 0, s2.btnTxt.slice(0, 40));
  await p.screenshot({ path: OUT + 'v89177-after.png', fullPage: false });
  console.log('  （截图 v89177-after.png）');

  /* ③ 君主面板五关清单 */
  var s3 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    if (!G.lordGeneralOf()) return { ok: false };
    G.ui.openLordInfo();
    var txt = (document.querySelector('#modal-root') || {}).textContent || '';
    return { ok: true, txt: txt, hasTrial: txt.indexOf('突破考验') >= 0 };
  });
  await p.waitForTimeout(300);
  chk('③ 君主面板「突破考验」在册（五关）', s3.ok && s3.hasTrial,
    (s3.txt || '').match(/突破考验[^。]{0,150}/) ? (s3.txt.match(/突破考验[^。]{0,150}/)[0]).slice(0, 120) : '(未捕获)');
  await p.screenshot({ path: OUT + 'v89177-trials.png', fullPage: false });
  console.log('  （截图 v89177-trials.png）');

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
