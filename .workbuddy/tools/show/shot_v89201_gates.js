/* v89.201 实机验收：① 侦查单页（四板块 over=0）② 多选打造（真点两卡一次打造）
   ③ 百炼专属界面（网格卡筛选点选）④ 滚动保留（m-body scrollTop 复验） */
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
    G.newGame({ name: 'v201', cityName: '许都', region: '碎垣', mapSeed: 20260932 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { qingji: 5000 };
    G.ui.enterGame(); G.ui.closeAllModals();
    /* 铁匠铺 + 资材 + 装备 */
    var has = false;
    c.cells.forEach(function (cell) { if (cell.build && cell.build.id === 'tiejiangpu') { cell.build.lvl = 10; has = true; } });
    if (!has) {
      for (var i2 = 0; i2 < c.cells.length; i2++) {
        if (!c.cells[i2].build && !c.cells[i2].official) { c.cells[i2].build = { id: 'tiejiangpu', lvl: 10 }; break; }
      }
    }
    G.ui._cityId = c.id;
    (G.DATA.MATERIALS || []).forEach(function (m) { G.state.items[m.id] = 999; });
    (G.DATA.ITEMS || []).forEach(function (it) { if (it.type === 'blueprint') G.state.items[it.id] = 9; });
    G.state.res.gold = 9e8; G.state.res.iron = 9e8; G.state.res.stone = 9e8; G.state.res.wood = 9e8;
    var ids = Object.keys(G.DATA.EQUIP).filter(function (id) { return !G.DATA.EQUIP[id].ling; }).slice(0, 12);
    ids.forEach(function (id) { try { G.addEquip(id); } catch (e) { } });
  });

  /* ══ ① 侦查单页（真跑一次满级侦查）══ */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var s = G.state, c0 = G.currentCity();
    G.techSet('zhencha', 10, c0);
    if (s.world) s.world.weather = 'clear';
    var gen = null;
    (s.generals || []).forEach(function (g) { if (!gen && g.status !== 'march') gen = g; });
    var npc = (s.map.cities || [])[0];
    var r = null, tries = 0;
    while (tries++ < 8) {
      G.setStaNow(gen, 999); gen.energy = 999;
      var bk = Math.random; Math.random = function () { return 0.001; };
      try { r = G.battle.expedition({ kind: 'city', id: npc.id }, 'scout', { changqiang: 50 }, gen.id); }
      finally { Math.random = bk; }
      if (r && r.ok) break;
    }
    G.ui.closeAllModals();
    G.ui.openScoutResult({ kind: 'city', name: npc.name }, r);
    return { ok: !!(r && r.ok) };
  });
  await sleep(600);
  var r1b = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel');
    /* 侦查面板走裸 openModal（无 .m-body 包装）——滚动容器通用读法 */
    var scrollBox = panel.querySelector('.m-body') || panel;
    return {
      over: scrollBox.scrollHeight - scrollBox.clientHeight,
      boxCls: document.querySelector('#modal-root .modal').className,
      heads: Array.prototype.map.call(panel.querySelectorAll('.seal-h'), function (h) { return h.textContent.trim().slice(0, 8); }),
      nScoutChips: panel.querySelectorAll('[data-action="scout-page"]').length,
      nTrow: panel.querySelectorAll('.sc-trow').length,
    };
  });
  chk('①a 侦查单页：四板块在册 · 页签零残留（' + r1b.heads.join('/') + '）',
    r1.ok && r1b.heads.length >= 3 && r1b.nScoutChips === 0, JSON.stringify(r1b.heads));
  chk('①b 侦查单页不溢出（over=' + r1b.over + ' · xxl+tall=' + r1b.boxCls.indexOf('modal-tall') + '）· 编制三栏 ' + r1b.nTrow + ' 格',
    r1b.over <= 0 && r1b.boxCls.indexOf('modal-tall') >= 0 && r1b.nTrow >= 3, '');
  await p.screenshot({ path: E + 'v89201-scout.png' });

  /* ══ ② 多选打造：真点两卡 → 底键 2 件 → 真点打造 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui._forgeKind = 'all'; G.ui._forgeSet = ''; G.ui._forgeQ = 1; G.ui._forgeSelList = [];
    G.ui._pages['forge'] = 1;
    G.ui.openForge();
  });
  await sleep(500);
  var r2 = await p.evaluate(function () {
    /* 找第一页两张 q1 可造卡（真点，每点一次重查 DOM） */
    var G = window.GAME;
    var clicked = [];
    for (var k = 0; k < 2; k++) {
      var cards = document.querySelectorAll('#modal-root .item-row[data-action="forge-pick"]');
      for (var i = 0; i < cards.length; i++) {
        var id = cards[i].getAttribute('data-item');
        if (clicked.indexOf(id) >= 0) continue;
        if (G.ui._forgeSelList.indexOf(id) >= 0) continue;
        /* 只点凡品可造（q1） */
        var f = null;
        G.forgeList().forEach(function (x) { if (x.id === id) f = x; });
        if (!f || f.q !== 1) continue;
        cards[i].click();
        clicked.push(id);
        break;
      }
    }
    var sel = (G.ui._forgeSelList || []).slice();
    var btn = document.querySelector('#modal-root [data-action="forge-item"]');
    return { clicked: clicked, sel: sel,
      btnTxt: btn ? btn.textContent.trim() : 'none',
      btnOn: btn ? (!btn.hasAttribute('disabled') && btn.classList.contains('gold')) : false };
  });
  await sleep(300);
  chk('②a 真点两张卡 → 选集 2 件 · 底键「' + r2.btnTxt + '」可点',
    r2.sel.length === 2 && r2.btnOn && /2 件/.test(r2.btnTxt), JSON.stringify(r2));
  await p.screenshot({ path: E + 'v89201-forge-multi.png' });
  var r2b = await p.evaluate(function () {
    var G = window.GAME;
    var inv0 = (G.state.inventory || []).length;
    var btn = document.querySelector('#modal-root [data-action="forge-item"]');
    btn.click();
    var inv1 = (G.state.inventory || []).length;
    return { inv0: inv0, inv1: inv1, sel: (G.ui._forgeSelList || []).length };
  });
  await sleep(400);
  chk('②b 真点打造 → 两件一起入包（' + r2b.inv0 + '→' + r2b.inv1 + '）· 选集清空',
    r2b.inv1 === r2b.inv0 + 2 && r2b.sel === 0, JSON.stringify(r2b));

  /* ══ ③ 百炼专属界面：网格卡 + 筛选 + 点选 + 底键 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui._enhSel = null; G.ui._enhFilter = 'all'; G.ui._pages['enh'] = 1;
    G.ui.openEnhance();
  });
  await sleep(500);
  var r3 = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel');
    var mbody = panel.querySelector('.m-body');
    var cards = panel.querySelectorAll('.enh-card');
    cards[0].click();
    return { nCards: cards.length,
      nChips: panel.querySelectorAll('[data-action="enh-filter"]').length,
      over: mbody.scrollHeight - mbody.clientHeight };
  });
  await sleep(350);
  var r3b = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel');
    var btn = panel.querySelector('[data-action="enhance-item"]');
    return { sel: String(window.GAME.ui._enhSel || ''),
      btnTxt: btn ? btn.textContent.trim() : 'none',
      onCards: panel.querySelectorAll('.enh-card.on').length,
      isXxl: document.querySelector('#modal-root .modal').className.indexOf('modal-xxl') >= 0 };
  });
  chk('③a 百炼专属界面：' + r3.nCards + ' 网格卡 · ' + r3.nChips + ' 筛选 · xxl=' + r3b.isXxl + ' · over=' + r3.over,
    r3.nCards >= 2 && r3.nChips === 3 && r3b.isXxl && r3.over <= 0, '');
  chk('③b 点选后底键「' + r3b.btnTxt + '」· 高亮卡 ' + r3b.onCards + ' 张',
    /强化 \+/.test(r3b.btnTxt) && r3b.onCards === 1, JSON.stringify(r3b));
  var r3c = await p.evaluate(function () {
    var G = window.GAME;
    var sel = String(G.ui._enhSel);
    var inst = null;
    G.enhList().forEach(function (x) { if (G.ui.enhKeyOf(x) === sel) inst = x; });
    var lv0 = inst ? G.enhOf(inst) : -1;
    var panel = document.querySelector('#modal-root .inner-panel');
    panel.querySelector('[data-action="enhance-item"]').click();
    return { lv0: lv0 };
  });
  await sleep(450);
  var r3d = await p.evaluate(function () {
    var G = window.GAME;
    var sel = String(G.ui._enhSel);
    var inst = null;
    G.enhList().forEach(function (x) { if (G.ui.enhKeyOf(x) === sel) inst = x; });
    return { lv1: inst ? G.enhOf(inst) : -2, selKept: String(G.ui._enhSel) === sel };
  });
  chk('③c 真点强化 → 该件 +' + r3c.lv0 + '→+' + r3d.lv1 + ' · 选中保留',
    r3d.lv1 === r3c.lv0 + 1 && r3d.selKept, JSON.stringify(r3d));
  await p.screenshot({ path: E + 'v89201-enhance.png' });

  /* ══ ④ 滚动保留复验（临时放大页容量 + 补造装备造可滚场景）══ */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    for (var i = 0; i < 30; i++) { try { G.addEquip('cr_head_1'); } catch (e) { } }   /* 保证行数超容器 */
    G.ui.ENH_PER_PAGE = 200;
    G.ui._pages['enh'] = 1; G.ui._enhFilter = 'all';
    G.ui.openEnhance();
    var mbody = document.querySelector('#modal-root .inner-panel .m-body');
    var scrollable = mbody.scrollHeight > mbody.clientHeight;
    mbody.scrollTop = 300;
    return { scrollable: scrollable, before: mbody.scrollTop,
      sh: mbody.scrollHeight, ch: mbody.clientHeight };
  });
  await sleep(200);
  var r4b = await p.evaluate(function () {
    var G = window.GAME;
    var mbody0 = document.querySelector('#modal-root .inner-panel .m-body');
    mbody0.scrollTop = 300;
    var cards = document.querySelectorAll('#modal-root .enh-card');
    (cards[8] || cards[0]).click();
    return 1;
  });
  await sleep(400);
  var r4c = await p.evaluate(function () {
    var mbody = document.querySelector('#modal-root .inner-panel .m-body');
    window.GAME.ui.ENH_PER_PAGE = 15;    /* 还原 */
    return { after: mbody.scrollTop };
  });
  chk('④ 滚动保留：可滚=' + r4.scrollable + '（' + r4.sh + '/' + r4.ch + '）· 点选前 300 → 重开后 ' + r4c.after,
    r4.scrollable && r4c.after === 300, JSON.stringify(r4c));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
