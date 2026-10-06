/* v89.220 实机验收：① 基因实验室（面板+政务厅按钮）② 本境调运「不设上限」
   ③ 占领城拆 1 级后升级键可用（Lv11 → Lv12）
   图：v89220-farm / v89220-gov / v89220-move / v89220-build
   判据（真机）：见各 chk。 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + '  [' + (extra || '') + ']'); }
}
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验收220', region: '烬环', mapSeed: 20261020 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    var st = G.state, c1 = st.cities[0];
    st.rank = 20; st.mainCityId = c1.id;
    /* 占一座县城（真链路）→ 拆军营 1 级（12→11） */
    var npc = null;
    (st.map.cities || []).forEach(function (x) { if (!npc && x.type === 'county') npc = x; });
    G.onConquer(npc, {}, st.generals[0], c1);
    var cc = null;
    st.cities.forEach(function (x) { if (x.origId === npc.id) cc = x; });
    cc.res = { grain: 9e8, wood: 9e8, stone: 9e8, iron: 9e8 };
    st.gold = 9e8;
    var idx = -1;
    cc.cells.forEach(function (x, i) { if (idx < 0 && x.build && x.build.id === 'junying') idx = i; });
    G.demolishAt(cc.id, idx);
    c1.army = { yibing: 5000, minfu: 1200, changqiang: 800 };
    window.__cc = cc.id; window.__idx = idx; window.__c1 = c1.id;
  });
  await sleep(600);

  /* ── ① 建筑面板：占领城拆后军营（Lv11 → Lv12 升级键可用 = 存量宽限的 UI 铁证） ── */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._cityId = window.__cc;
    G.ui.openBuildModal(window.__idx, window.__cc);
  });
  await sleep(750);
  var r1 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var h = m ? m.innerHTML : '';
    var upBtn = document.querySelector('#modal-root [data-action="confirm-upgrade"]');
    var dimBtn = document.querySelector('#modal-root [data-action="confirm-upgrade"][disabled]');
    return {
      hasUp: !!upBtn,
      upTxt: upBtn ? (upBtn.textContent || '').replace(/\s+/g, ' ').trim() : '',
      dim: !!dimBtn,
      hasTechHint: h.indexOf('需先研究') >= 0,
      hasMaxTxt: h.indexOf('已达最高等级') >= 0,
    };
  });
  console.log('  建筑面板：up=' + r1.hasUp + ' txt=' + r1.upTxt + ' 研究提示=' + r1.hasTechHint);
  chk('① 占领城拆后军营面板：升级键可用（confirm-upgrade · 非禁用）', r1.hasUp && !r1.dim, JSON.stringify(r1));
  chk('①a 升级键写明「Lv11 → Lv12」（本座口径）', /Lv11 → Lv12/.test(r1.upTxt), r1.upTxt);
  chk('①b 面板无「需先研究」空头提示', !r1.hasTechHint, '');
  await p.screenshot({ path: E + 'v89220-build.png' });

  /* ── ② 本境调运（从主城 → 占领城）：上限标签 = 不设上限 ── */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui._cityId = window.__c1;
    G.ui.openExpModal({ kind: 'own', id: window.__cc });
  });
  await sleep(800);
  var r2 = await p.evaluate(function () {
    var el = document.getElementById('exp-cap-t');
    var m = document.querySelector('#modal-root');
    var h = m ? (m.textContent || '') : '';
    return {
      lab: el ? (el.textContent || '').trim() : '(无)',
      hasOwn: h.indexOf('本境调运') >= 0 || h.indexOf('调兵') >= 0,
      hasCap: h.indexOf('练兵场容量') >= 0,
    };
  });
  console.log('  调运面板：上限标签=' + r2.lab);
  chk('② 本境调运面板：上限标签 = 「不设上限」', r2.lab === '不设上限', r2.lab);
  chk('②a 面板无「练兵场容量」字样（闸已退役）', !r2.hasCap, '');
  await p.screenshot({ path: E + 'v89220-move.png' });

  /* ── ③ 基因实验室面板（名称/副标题） ── */
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); window.GAME.ui.openFarm(); });
  await sleep(650);
  var r3 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var h = m ? (m.textContent || '') : '';
    return { hasName: h.indexOf('基因实验室') >= 0, hasSub: h.indexOf('个人实验室') >= 0,
             hasOld: h.indexOf('温室农场') >= 0 };
  });
  console.log('  实验室面板：name=' + r3.hasName + ' sub=' + r3.hasSub);
  chk('③ 基因实验室面板：标题与副标题换新（🎛 个人实验室 · 六块培养槽）', r3.hasName && r3.hasSub, JSON.stringify(r3));
  chk('③a 面板零「温室农场」旧名', !r3.hasOld, '');
  await p.screenshot({ path: E + 'v89220-farm.png' });

  /* ── ④ 政务厅面板：🧬 基因实验室 按钮 ── */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.cityById(window.__c1);
    var gi = -1;
    c.cells.forEach(function (x, i) { if (gi < 0 && x.build && x.build.id === 'guanfu') gi = i; });
    G.ui.closeAllModals();
    G.ui.openBuildModal(gi, c.id);
  });
  await sleep(650);
  var r4 = await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="open-farm"]');
    return { has: !!btn, txt: btn ? (btn.textContent || '').trim() : '' };
  });
  console.log('  政务厅按钮：' + r4.txt);
  chk('④ 政务厅面板「🧬 基因实验室」按钮在册', r4.has && r4.txt.indexOf('基因实验室') >= 0, r4.txt);
  await p.screenshot({ path: E + 'v89220-gov.png' });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
