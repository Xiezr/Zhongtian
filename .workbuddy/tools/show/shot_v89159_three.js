/* v89.159 实机验证（真浏览器）：
   ① 民房 Lv3（官府 4）→ 面板给「升级」键（不再误报需官府）
   ② 民房 Lv4（同城 · 另一座）→ 面板如实报「需官府 Lv5」
   ③ 主城 + 爵位解锁 → 「等级上限」行写「受官府 Lv8 限制 · 升官府可提升」
   ④ 将领升级 → 体力/精力回满 + 公文「升级刷新」行（真渲染）
   ⑤ 采集收获满仓 → 收获明细含「仓容已满…未入库」（真环境）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89159_three.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验159', cityName: '许都', region: '碎垣', mapSeed: 20260959 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.currentCity();
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
    var mf = [];
    c.cells.forEach(function (x, i) { if (x.build && x.build.id === 'minfang') mf.push(i); });
    c.cells[mf[0]].build.lvl = 4;      /* 一座已 4 级 */
    c.cells[mf[1]].build.lvl = 3;      /* 本座 3 级（老板场景） */
    window.__mf159 = mf;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = 3e7; });
  });
  await p.waitForTimeout(900);

  /* 面板截图：live 面板每秒重建 → 用 clip（一次性坐标），不用 locator.screenshot */
  async function shotModal(name) {
    var r = await p.evaluate(function () {
      var el = document.querySelector('#modal-root .modal');
      if (!el) return null;
      var k = window.GAME.ui.appKOf ? window.GAME.ui.appKOf() : 1;
      var rc = el.getBoundingClientRect();
      return { x: Math.max(0, rc.left), y: Math.max(0, rc.top), w: Math.min(rc.width, 1600 - rc.left), h: Math.min(rc.height, 1000 - rc.top) };
    });
    if (!r) { console.log('    （面板不存在，跳图）'); return; }
    await p.screenshot({ path: OUT + name, clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
    console.log('    📷 ' + name + '  ' + Math.round(r.w) + '×' + Math.round(r.h));
  }

  console.log('===== ① 民房 Lv3（官府 4）→ 给「升级」键 =====');
  await p.evaluate(function () {
    window.GAME.ui.openBuildModal(window.__mf159[1]);
  });
  await p.waitForTimeout(700);
  var r1 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root').innerHTML;
    var btn = document.querySelector('#modal-root [data-action="confirm-upgrade"]');
    return { html: m, up: !!btn, need: m.indexOf('需官府') >= 0,
      title: (document.querySelector('#modal-root .gold-heading') || {}).textContent || '' };
  });
  chk('① 面板标题 = 民房 · Lv3（' + r1.title.trim() + '）', /民房 · Lv3/.test(r1.title));
  chk('① 有「升级」键（Lv3 → Lv4）', r1.up === true);
  chk('① 面板不含「需官府」（不再误报）', r1.need === false);
  await shotModal('v89159-build-up.png');

  console.log('===== ② 民房 Lv4（同城另一座）→ 报「需官府 Lv5」 =====');
  await p.evaluate(function () { window.GAME.ui.openBuildModal(window.__mf159[0]); });
  await p.waitForTimeout(700);
  var r2 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root').innerHTML;
    return { need5: m.indexOf('需官府 Lv5') >= 0, up: !!document.querySelector('#modal-root [data-action="confirm-upgrade"]') };
  });
  chk('② 面板报「需官府 Lv5」', r2.need5 === true);
  chk('② 且不给「升级」键（已到顶）', r2.up === false);
  await shotModal('v89159-build-block.png');

  console.log('===== ③ 主城 + 爵位解锁 → 上限行写明"受官府限制" =====');
  await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    G.state.mainCityId = c.id; G.state.rank = 5;                 /* 爵位解锁 +5 */
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 8; });
    G.ui.openBuildModal(window.__mf159[1]);
  });
  await p.waitForTimeout(700);
  var r3 = await p.evaluate(function () {
    var t = (document.querySelector('#modal-root') || {}).textContent || '';
    return { hit: t.indexOf('受官府 Lv8 限制') >= 0, up: t.indexOf('升官府可提升') >= 0,
      cap: (t.match(/等级上限[^（]*（[^）]*）/) || [''])[0] };
  });
  chk('③ 上限行 = ' + (r3.cap || '—'), r3.hit && r3.up);
  await shotModal('v89159-cap-line.png');

  console.log('===== ④ 将领升级 → 体力/精力回满 + 公文行（真渲染） =====');
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var g = (G.state.generals || []).filter(function (x) { return !x.isLord; })[0];
    G.setStaNow(g, Math.round(G.staMax(g) * 0.2));
    G.setEnergyNow(g, Math.round(G.energyMaxOf(g) * 0.2));
    var low = { sta: G.staNow(g), ene: G.energyNowOf(g) };
    G.battle.gainExp(g, G.expNeedOf(g) + 1, '实机159');
    window.__gen159 = g;
    return { lv: g.level, sta: G.staNow(g), staMx: G.staMax(g), ene: G.energyNowOf(g), eneMx: G.energyMaxOf(g), low: low };
  });
  chk('④ 升级后体力/精力回满（' + r4.low.sta + ' → ' + r4.sta + '/' + r4.staMx + ' · ' +
    r4.low.ene + ' → ' + r4.ene + '/' + r4.eneMx + '）',
    r4.sta === r4.staMx && r4.ene === r4.eneMx);
  /* 公文 · 系统页（真渲染出「升级刷新」行） */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._docTab = 'sys'; G.ui.setView('reports'); G.ui.renderView('reports');
  });
  await p.waitForTimeout(800);
  var r4b = await p.evaluate(function () {
    var t = (document.querySelector('#view-container') || {}).textContent || '';
    var hit = t.indexOf('升级刷新') >= 0;
    var row = null;
    var all = document.querySelectorAll('#view-container .doc-line, #view-container .msg-line, #view-container div');
    for (var i = 0; i < all.length && !row; i++) {
      if ((all[i].textContent || '').indexOf('升级刷新') >= 0) row = all[i].getBoundingClientRect();
    }
    return { hit: hit, box: row ? { x: row.left, y: row.top, w: row.width, h: row.height } : null };
  });
  chk('④ 公文（系统页）含「升级刷新…已回满」行', r4b.hit === true);
  if (r4b.box && r4b.box.h > 4) {
    await p.screenshot({ path: OUT + 'v89159-levelup-doc.png',
      clip: { x: Math.max(0, r4b.box.x - 220), y: Math.max(0, r4b.box.y - 26), width: 900, height: Math.max(80, r4b.box.h + 52) } });
    console.log('    📷 v89159-levelup-doc.png');
  }

  console.log('===== ⑤ 采集收获满仓 → 明细写明「仓容已满…未入库」 =====');
  var r5 = await p.evaluate(function () {
    var G = window.GAME, st = G.state, c = G.currentCity();
    if (!st.map.grid) G.map.generate();
    var tp = null, t5 = null;
    for (var y = 1; y < G.DATA.MAP_H - 1 && !tp; y++) {
      for (var x = 1; x < G.DATA.MAP_W - 1 && !tp; x++) {
        var tl = G.map.tile(x, y);
        if (tl && tl.terrain !== 'city' && G.gatherResOf(tl.terrain)) { t5 = { x: x, y: y }; tp = tl.terrain; }
      }
    }
    if (!t5) return { ok: false };
    st.gathers = st.gathers || [];
    st.gathers.push({ id: 'shot159g', x: t5.x, y: t5.y, type: tp, level: 6,
      elapsed: 999999, army: { minfu: 5000 }, genId: null, cityId: c.id });
    var cap = G.storeCapOf(c);
    G.res(c).grain = cap + 50000;
    var before = G.res(c).grain;
    var fin = G.finishGather('shot159g');
    return { ok: fin.ok, text: fin.rewardText || '', keep: G.res(c).grain >= before - 0.001, trimmed: fin.trimmed };
  });
  chk('⑤ 满仓收获不削存量 · 明细 = ' + (r5.text || '—'), r5.ok === true && r5.keep === true && /仓容已满/.test(r5.text || ''));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
