/* v89.171 实机验证（真浏览器）：经验道具「前期化」三段态
   ① Lv1：选择窗逐档写明「最多至 LvN」、可用档给按钮（图 v89171-exp-lv1.png）
   ② 真用一本练兵经验 → Lv10：该档到线变暗、其余档仍可用（图 v89171-exp-used.png）
   ③ Lv60：全族到线 —— 无使用按钮 + 说明段 + 卡面全暗（图 v89171-exp-lv60.png）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89171_items.js */
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

  var gid = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验171', cityName: '许都', region: '碎垣', mapSeed: 20260971 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('generals');
    var st = G.state;
    var g = st.generals.filter(function (x) { return !x.isLord; })[0] || st.generals[0];
    st.items = { bingxian_yipian: 2, lianbing_jingyan: 2, bingsheng: 1 };
    g.rank = 'tian'; g.level = 1; g.exp = 0;
    G.ui._genSel = g.id;
    return g.id;
  });

  async function shotModal(file) {
    var clip = await p.evaluate(function () {
      var el = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 10), width: r.width + 20, height: r.height + 20 };
    });
    if (clip) await p.screenshot({ path: OUT + file, fullPage: true, clip: clip });
    return clip;
  }

  console.log('===== ① Lv1 选择窗：逐档「最多至 LvN」+ 可用档给按钮 =====');
  await p.evaluate(function (g) { var G = window.GAME; G.ui.closeAllModals(); G.ui.openExpPick(g); }, gid);
  await p.waitForTimeout(360);
  var s1 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    return {
      txt: m ? m.textContent : '',
      l50: m ? m.textContent.indexOf('最多至 Lv50') >= 0 : false,
      l10: m ? m.textContent.indexOf('最多至 Lv10') >= 0 : false,
      btn: m ? m.querySelectorAll('[data-action="gen-exp-item"]').length : 0,
    };
  });
  chk('Lv1：卡面「最多至 Lv50」（兵仙遗篇）', s1.l50);
  chk('Lv1：卡面「最多至 Lv10」（练兵经验）', s1.l10);
  chk('Lv1：可用档给使用按钮（2 枚）', s1.btn === 2, 'btn=' + s1.btn);
  var c1 = await shotModal('v89171-exp-lv1.png');
  console.log('   图1 ' + (c1 ? Math.round(c1.width) + 'x' + Math.round(c1.height) : 'FAIL'));

  console.log('===== ② 真用一本练兵经验 → Lv10：该档到线变暗 =====');
  var s2 = await p.evaluate(function (g) {
    var G = window.GAME;
    var r = G.systems.gainExpByItem('lianbing_jingyan', g, 'one');
    G.ui.closeAllModals();
    G.ui.openExpPick(g);
    return { ok: r.ok, lv: G.state.generals.filter(function (x) { return x.id === g; })[0].level, msg: r.msg };
  }, gid);
  await p.waitForTimeout(360);
  chk('真用练兵经验：升级到 Lv' + s2.lv, s2.ok && s2.lv === 10, (s2.msg || '').slice(0, 80));
  var s2b = await p.evaluate(function () {
    var lb = document.querySelector('#modal-root [data-item="lianbing_jingyan"]');
    var bx = document.querySelector('#modal-root [data-item="bingxian_yipian"]');
    return {
      lbDim: !!(lb && lb.className.indexOf('dim') >= 0),
      bxDim: !!(bx && bx.className.indexOf('dim') >= 0),
      btn: document.querySelectorAll('#modal-root [data-action="gen-exp-item"]').length,
    };
  });
  chk('到场后：练兵经验卡变暗（to Lv10 到线）', s2b.lbDim);
  chk('对照：兵仙遗篇卡仍可用（未到线）', !s2b.bxDim && s2b.btn === 2);
  var c2 = await shotModal('v89171-exp-used.png');
  console.log('   图2 ' + (c2 ? Math.round(c2.width) + 'x' + Math.round(c2.height) : 'FAIL'));

  console.log('===== ③ Lv60：全族到线（无按钮 + 说明段 + 全暗） =====');
  await p.evaluate(function (g) {
    var G = window.GAME;
    var gg = G.state.generals.filter(function (x) { return x.id === g; })[0];
    gg.level = 60; gg.exp = 0;
    G.ui.closeAllModals();
    G.ui.openExpPick(g);
  }, gid);
  await p.waitForTimeout(360);
  var s3 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var chips = m.querySelectorAll('[data-action="exp-pick-item"]');
    var dimN = 0;
    chips.forEach(function (c) { if (c.className.indexOf('dim') >= 0) dimN++; });
    return {
      txt: m.textContent,
      btn: m.querySelectorAll('[data-action="gen-exp-item"]').length,
      chips: chips.length, dimN: dimN,
    };
  });
  chk('Lv60：没有任何使用按钮（全族到线）', s3.btn === 0, 'btn=' + s3.btn);
  chk('Lv60：说明段写明「只服务前期」', s3.txt.indexOf('只服务前期') >= 0);
  chk('Lv60：全部卡面变暗（' + s3.dimN + '/' + s3.chips + '）', s3.chips > 0 && s3.dimN === s3.chips);
  var c3 = await shotModal('v89171-exp-lv60.png');
  console.log('   图3 ' + (c3 ? Math.round(c3.width) + 'x' + Math.round(c3.height) : 'FAIL'));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
