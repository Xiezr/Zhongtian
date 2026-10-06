/* v89.204 实机验收：① 强化面板分页条（页码居中 · 几何真量）② 强化卡面（成本悬停 · 无 .ec-cost · 高 84）
   ③ 商城底栏分页（居中 + 缩略图不重叠）④ 侧栏民心（战争创伤分解）⑤ 失城（真调 → 日志 + 城池列表）
   ------------------------------------------------------------
   老板需求 1：「据点、城池占领以民心为基础…」  需求 2：「页码固定显示位置为居中…」 */
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
    G.newGame({ name: 'v204', cityName: '许都', region: '豫州', mapSeed: 20261006 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { qingji: 5000 };
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui._cityId = c.id;
  });

  /* ══ ① 强化面板：分页条三栏 + 页码居中（几何真量 · 布局值免 k）══ */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var has = false;
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'tiejiangpu') { x.build.lvl = 10; has = true; } });
    if (!has) {
      for (var i = 0; i < c.cells.length; i++) {
        if (!c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: 'tiejiangpu', lvl: 10 }; break; }
      }
    }
    G.state.res.gold = 9e8; G.state.res.iron = 9e8; G.state.res.stone = 9e8;
    for (var k = 0; k < 40; k++) { try { G.addEquip('cr_head_1'); } catch (e) { } }
    G.ui._enhSel = ''; G.ui._enhFilter = 'all'; G.ui._pages['enh'] = 1;
    G.ui.closeAllModals();
    G.ui.openEnhance();
  });
  await sleep(500);
  var r1 = await p.evaluate(function () {
    var pg = document.querySelector('#modal-root .pager');
    if (!pg) return { err: 'no-pager' };
    var mid = pg.querySelector('.pg-info');
    var l = pg.querySelector('.pg-side.l');
    var r = pg.querySelector('.pg-side.r');
    if (!mid || !l || !r) return { err: 'no-three' };
    /* 几何：rect 中点差 ÷ k = 布局差（#app-scale 会乘 k） */
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    var pr = pg.getBoundingClientRect(), mr = mid.getBoundingClientRect();
    var diff = Math.round(((mr.left + mr.right) / 2 - (pr.left + pr.right) / 2) / k * 10) / 10;
    return {
      pages: document.querySelectorAll('#modal-root .pager').length,
      diff: diff,
      midTxt: (mid.textContent || '').slice(0, 24),
      nL: l.querySelectorAll('button').length, nR: r.querySelectorAll('button').length,
    };
  });
  chk('①a 强化面板分页条：三栏齐备（左 ' + (r1.nL || 0) + ' 钮 / 右 ' + (r1.nR || 0) + ' 钮）· 页码「' + (r1.midTxt || '') + '」',
    !r1.err && r1.nL >= 3 && r1.nR >= 2, JSON.stringify(r1));
  chk('①b 页码**居中**（页码中点 − 条中点 = ' + r1.diff + 'px，|差| ≤ 2）',
    !r1.err && Math.abs(r1.diff) <= 2, JSON.stringify(r1));
  await p.screenshot({ path: E + 'v89204-enh.png' });

  /* ══ ② 强化卡面：无 .ec-cost · 高 84 · title 含「下级成本」══ */
  var r2 = await p.evaluate(function () {
    var cards = document.querySelectorAll('#modal-root .enh-card');
    var c0 = cards[0] || null;
    var hs = [];
    cards.forEach(function (c) { hs.push(c.getBoundingClientRect().height); });
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    return {
      n: cards.length,
      cost: document.querySelectorAll('#modal-root .ec-cost').length,
      title: c0 ? (c0.getAttribute('title') || '') : '',
      h: hs.length ? Math.round(hs[0] / k) : 0,
    };
  });
  chk('②a 卡面数 ' + r2.n + '（40 件 → 3 页）· .ec-cost 节点 = ' + r2.cost + '（应 0）',
    r2.n >= 2 && r2.cost === 0, JSON.stringify(r2));
  chk('②b 卡面 title 含「下级成本」（悬停承载 · 实测「' + r2.title.slice(0, 34) + '…」）',
    /下级成本/.test(r2.title), r2.title);
  chk('②c 卡高 = ' + r2.h + 'px（84 基线 · 成本行撤下不改卡高）', Math.abs(r2.h - 84) <= 3, 'h=' + r2.h);

  /* ══ ③ 商城视图底栏分页（居中 + 缩略图不重叠）══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.setView('shop');
  });
  await sleep(450);
  var r3 = await p.evaluate(function () {
    var pg = document.querySelector('#bottom-bar .pager');
    if (!pg) return { err: 'no-pager' };
    var mid = pg.querySelector('.pg-info');
    if (!mid) return { err: 'no-mid' };
    var mini = document.querySelector('#bottom-bar .bb-mini');
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    var pr = pg.getBoundingClientRect(), mr = mid.getBoundingClientRect();
    var mrr = mini ? mini.getBoundingClientRect() : null;
    return {
      diff: Math.round(((mr.left + mr.right) / 2 - (pr.left + pr.right) / 2) / k * 10) / 10,
      midTxt: (mid.textContent || '').slice(0, 24),
      overlap: mrr ? Math.round((pr.right - mrr.left) / k) : null,
    };
  });
  chk('③a 商城底栏分页：页码「' + (r3.midTxt || '') + '」居中（差 ' + r3.diff + 'px ≤ 2）',
    !r3.err && Math.abs(r3.diff) <= 2, JSON.stringify(r3));
  chk('③b 分页条与缩略图不重叠（右缘 − 缩略图左缘 = ' + r3.overlap + 'px < 0 即不相交）',
    r3.overlap != null && r3.overlap < 0, JSON.stringify(r3));
  await p.screenshot({ path: E + 'v89204-pager.png' });

  /* ══ ④ 侧栏民心（战争创伤分解）══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city');
    var c = G.state.cities[0];
    G.heartsWarAdd(c, 20);
    G.ui.renderCityAttrs(c, G.state);
  });
  await sleep(350);
  var r4 = await p.evaluate(function () {
    var line = document.querySelector('#city-attrs .res-line .lbl');
    var rows = document.querySelectorAll('#city-attrs .res-line');
    var target = null;
    rows.forEach(function (r2) { if (r2.textContent.indexOf('民心') >= 0) target = r2; });
    return {
      has: !!target,
      txt: target ? (target.textContent || '').slice(0, 18) : '',
      title: target ? (target.querySelector('.val').getAttribute('title') || '') : '',
    };
  });
  chk('④a 侧栏民心行在册（「' + r4.txt + '」）· 战争创伤悬停分解在册',
    r4.has && /战争创伤/.test(r4.title), JSON.stringify(r4));
  await p.screenshot({ path: E + 'v89204-hearts.png' });

  /* ══ ⑤ 失城（真调 → 日志 + 城池列表）══ */
  var r5 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var c0 = st.cities[0];
    st.wilds = st.wilds || [];
    st.wilds.push({ x: c0.x + 3, y: c0.y + 3, type: 'plain', level: 3, levelDay: G.questDayIndex() });
    var built = G.buildCityAt(c0.x + 3, c0.y + 3);
    var cB = (built && built.city) ? built.city : null;
    if (!cB) return { err: 'no-secondary' };
    st.mainCityId = cB.id;
    var name0 = c0.name;
    var n0 = st.cities.length;
    G.heartsWarAdd(c0, 200);
    c0.army = {}; c0.def = 0;
    var out = G.invasionResolve(c0, '流寇', 3);
    return {
      n0: n0, n1: st.cities.length, name: name0,
      fallen: !!(out && out.cityFallen && out.cityFallen.ok),
      msg: (out && out.cityFallen && out.cityFallen.msg) || '',
      logHas: (G.state.log || []).some(function (l) { return String(l.msg || '').indexOf('民心尽失') >= 0; }),
    };
  });
  chk('⑤a 失城真调：城数 ' + r5.n0 + ' → ' + r5.n1 + ' · ' + (r5.msg || r5.err),
    r5.fallen && r5.n1 === r5.n0 - 1, JSON.stringify(r5));
  chk('⑤b 战争日志含「民心尽失」（' + (r5.logHas ? '在册' : '缺') + '）', r5.logHas === true, JSON.stringify(r5));
  await sleep(300);
  /* 截图：战争日志页（首条 = 🏴 城陷战报 —— 失城的持久界面证据） */
  await p.evaluate(function () { window.GAME.ui.setView('reports'); });
  await sleep(420);
  await p.screenshot({ path: E + 'v89204-lost.png' });

  console.log('');
  console.log('实机结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('[fatal] ' + (e && e.stack || e)); process.exit(2); });
