/* v89.173 实机验证（真浏览器）：经验道具「撤等级限制 + 固定面额」
   ① Lv1：卡面「+300万 / +10万」、无「最多至」、可用档给按钮（图 v89173-exp-lv1.png）
   ② 真用一本兵仙遗篇 → Lv49（+300 万）：再用仍可（图 v89173-exp-used.png）
   ③ Lv60：**仍给使用按钮**（对照 v89.171 时代的"全变暗 + 无按钮"）（图 v89173-exp-lv60.png）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89173_items.js */
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
    G.newGame({ name: '验173', cityName: '许都', region: '碎垣', mapSeed: 20260973 });
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
    /* v89.173：等弹窗入场动画完成（面板高度连续两次测量一致 = 布局稳定）——
       首跑 Lv1 图截在动画初期（空窗、516x493 vs 稳定后 524x500），须先稳后截。 */
    await p.waitForFunction(function () {
      var el = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
      if (!el) return false;
      var r = el.getBoundingClientRect();
      if (r.height < 100) return false;
      if (window.__shotH == null) { window.__shotH = r.height; return false; }
      if (Math.abs(window.__shotH - r.height) > 0.5) { window.__shotH = r.height; return false; }
      var op = parseFloat(getComputedStyle(el).opacity);
      return (isNaN(op) || op >= 0.99);
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

  console.log('===== ① Lv1 选择窗：卡面「+X万」、无旧上限文案 =====');
  await p.evaluate(function (g) { var G = window.GAME; G.ui.closeAllModals(); G.ui.openExpPick(g); }, gid);
  await p.waitForTimeout(360);
  var s1 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var txt = m ? m.textContent : '';
    return {
      wan300: txt.indexOf('+300万') >= 0,
      wan10: txt.indexOf('+10万') >= 0,
      old: txt.indexOf('最多至') >= 0 || txt.indexOf('只服务前期') >= 0,
      btn: m ? m.querySelectorAll('[data-action="gen-exp-item"]').length : 0,
    };
  });
  chk('Lv1：卡面「+300万」（兵仙遗篇）', s1.wan300);
  chk('Lv1：卡面「+10万」（练兵经验）', s1.wan10);
  chk('Lv1：旧上限文案零残留（最多至 / 只服务前期）', !s1.old);
  chk('Lv1：可用档给使用按钮（2 枚）', s1.btn === 2, 'btn=' + s1.btn);
  var c1 = await shotModal('v89173-exp-lv1.png');
  console.log('   图1 ' + (c1 ? Math.round(c1.width) + 'x' + Math.round(c1.height) : 'FAIL'));

  console.log('===== ② 真用一本兵仙遗篇 → Lv49：再用仍可 =====');
  var s2 = await p.evaluate(function (g) {
    var G = window.GAME;
    var r = G.systems.gainExpByItem('bingxian_yipian', g, 'one');
    var gg = G.state.generals.filter(function (x) { return x.id === g; })[0];
    G.ui.closeAllModals();
    G.ui.openExpPick(g);
    return { ok: r.ok, lv: gg.level, msg: r.msg, left: (G.state.items.bingxian_yipian || 0) };
  }, gid);
  await p.waitForTimeout(360);
  chk('真用兵仙遗篇：Lv1 → Lv' + s2.lv + '（+300 万）· 道具 -1', s2.ok && s2.lv === 49 && s2.left === 1,
    (s2.msg || '').slice(0, 80));
  var s2b = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    return { btn: m.querySelectorAll('[data-action="gen-exp-item"]').length };
  });
  chk('Lv49：选择窗仍给按钮（无"到线拒绝"）', s2b.btn === 2, 'btn=' + s2b.btn);
  var c2 = await shotModal('v89173-exp-used.png');
  console.log('   图2 ' + (c2 ? Math.round(c2.width) + 'x' + Math.round(c2.height) : 'FAIL'));

  console.log('===== ③ Lv60：仍给使用按钮（对照 v89.171 的全暗） =====');
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
  chk('★ Lv60：仍给使用按钮（v89.171 时代为 0）', s3.btn === 2, 'btn=' + s3.btn);
  chk('Lv60：卡面零变暗（' + s3.dimN + '/' + s3.chips + '）', s3.chips > 0 && s3.dimN === 0);
  chk('Lv60：无「只服务前期」说明段', s3.txt.indexOf('只服务前期') < 0);
  var c3 = await shotModal('v89173-exp-lv60.png');
  console.log('   图3 ' + (c3 ? Math.round(c3.width) + 'x' + Math.round(c3.height) : 'FAIL'));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
