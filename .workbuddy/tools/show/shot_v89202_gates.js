/* v89.202 实机验收：① 蕴养同款（网格卡/筛选/底键真点）② 侦查可下拉（常规零滚动 + 极端可滚）
   ③ 收藏峰值（回落保持解锁 + 卷面「最高」文案） */
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
    G.newGame({ name: 'v202', cityName: '许都', region: '豫州', mapSeed: 20260932 });
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    c.army = { qingji: 5000 };
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui._cityId = c.id;
  });

  /* ══ ① 蕴养同款（网格卡 + 筛选 + 底键真点）══ */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    /* 三件修炼装备 + 精华 */
    ['lg_weapon_1', 'lg_weapon_4', 'lg_head_2'].forEach(function (id) { try { G.addEquip(id); } catch (e) { } });
    G.state.items = G.state.items || {};
    G.state.items.lingsui = 500;
    G.ui._lingSel = null; G.ui._lingFilter = 'all'; G.ui._pages['ling'] = 1;
    G.ui.closeAllModals();
    G.ui.openLingTemper();
    return { ok: true };
  });
  await sleep(500);
  var r1b = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel');
    var mbody = panel.querySelector('.m-body') || panel;
    return {
      nCards: panel.querySelectorAll('.enh-card').length,
      nChips: panel.querySelectorAll('[data-action="ling-filter"]').length,
      over: mbody.scrollHeight - mbody.clientHeight,
      hasBtn: !!panel.querySelector('[data-action="ling-temper-item"]'),
      hasRows: !!panel.querySelector('.enh-rows'),
      isXxl: document.querySelector('#modal-root .modal').className.indexOf('modal-xxl') >= 0,
      firstNm: (panel.querySelector('.enh-card .ec-nm b') || {}).textContent || '',
    };
  });
  chk('①a 蕴养同款：' + r1b.nCards + ' 网格卡 · ' + r1b.nChips + ' 筛选 · xxl=' + r1b.isXxl + ' · over=' + r1b.over + '（首件 ' + r1b.firstNm + '）',
    r1b.nCards >= 2 && r1b.nChips === 3 && r1b.hasRows && r1b.isXxl && r1b.over <= 0, '');
  /* 真点第一张卡 → 底键文案 → 真点底键 */
  var r1c = await p.evaluate(function () {
    var G = window.GAME;
    document.querySelector('#modal-root .enh-card').click();
    return 1;
  });
  await sleep(400);
  var r1d = await p.evaluate(function () {
    var G = window.GAME;
    var sel = String(G.ui._lingSel || '');
    var inst = null;
    G.lingTemperList().forEach(function (x) { if (String(G.ui.enhKeyOf(x)) === sel) inst = x; });
    var lv0 = inst ? G.eqEnhOf(inst) : -1;
    var btn = document.querySelector('#modal-root [data-action="ling-temper-item"]');
    var txt = btn ? btn.textContent.trim() : 'none';
    if (btn) btn.click();
    return { sel: sel, lv0: lv0, btnTxt: txt };
  });
  await sleep(450);
  var r1e = await p.evaluate(function () {
    var G = window.GAME;
    var sel = String(G.ui._lingSel || '');
    var lv1 = -1;
    G.lingTemperList().forEach(function (x) { if (String(G.ui.enhKeyOf(x)) === sel) lv1 = G.eqEnhOf(x); });
    return { lv1: lv1, selKept: String(G.ui._lingSel) === sel };
  });
  chk('①b 真点卡片 → 底键「' + r1d.btnTxt + '」→ 真点 → 该件 +' + r1d.lv0 + '→+' + r1e.lv1 + '（选中保留=' + r1e.selKept + '）',
    /蕴养 \+/.test(r1d.btnTxt) && r1e.lv1 === r1d.lv0 + 1 && r1e.selKept, JSON.stringify(r1e));
  await p.screenshot({ path: E + 'v89202-ling.png' });
  /* 筛选切换（圆满 → 空态文案；未满 = 全集） */
  var r1f = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setLingFilter('done');
    return 1;
  });
  await sleep(400);
  var r1g = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel');
    var txt = panel.textContent;
    var empty = txt.indexOf('还没有圆满的修炼装备') >= 0;
    var G = window.GAME;
    G.ui.setLingFilter('todo');
    return { empty: empty };
  });
  await sleep(350);
  var r1h = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel');
    return { nCards: panel.querySelectorAll('.enh-card').length };
  });
  chk('①c 筛选：圆满 → 空态文案在册 · 未满 → ' + r1h.nCards + ' 卡（三件都未满）',
    r1g.empty && r1h.nCards === 3, 'n=' + r1h.nCards);
  var r1i = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._lingFilter = 'all'; G.ui._lingSel = null; G.ui.closeAllModals();
    return 1;
  });

  /* ══ ② 侦查可下拉（常规零滚动 + 极端可滚）══ */
  var r2 = await p.evaluate(function () {
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
    if (!r || !r.ok) return { ok: false };
    /* 加料到极端（20 兵种） */
    var names = ['长枪兵', '刀盾兵', '弓箭手', '轻骑兵', '重步兵', '弩兵', '投石车', '冲车', '突骑兵',
      '虎豹骑', '象兵', '藤甲兵', '连弩兵', '井阑', '云梯', '火矢兵', '大盾兵', '游骑', '死士', '弓骑兵'];
    r.roster = names.map(function (nm, i) { return { name: nm, n: 1200 + i * 111 }; });
    r.totalExact = true;
    G.ui.closeAllModals();
    G.ui.openScoutResult({ kind: 'city', name: npc.name }, r);
    return { ok: true };
  });
  await sleep(500);
  var r2b = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel');
    var sc = panel.querySelector('.m-body') || panel;
    return { over: sc.scrollHeight - sc.clientHeight, nTrow: panel.querySelectorAll('.sc-trow').length };
  });
  chk('②a 侦查常规载荷（20 兵种）：over=' + r2b.over + '（零滚动 · 一页显示）· 编制 ' + r2b.nTrow + ' 格',
    r2.ok && r2b.over <= 0 && r2b.nTrow >= 20, '');
  await p.screenshot({ path: E + 'v89202-scout.png' });
  /* 极端：注入 --app-h=620 → 面板钳小 → 可下拉 */
  var r2c = await p.evaluate(function () {
    document.documentElement.style.setProperty('--app-h', '620px');
    var G = window.GAME;
    G.ui.closeAllModals();
    /* 重开（面板高度 = min(920, 620-40) = 580） */
    var s = G.state;
    var r = G._lastScoutR;
    return { hasR: !!r };
  });
  /* 直接重跑一次侦查太重 —— 用上一步的面板对象刷新：改 --app-h 后重开面板需要 r；
     这里改用「重开上一步的 r」——openScoutResult 的 r 已在闭包里，通过一次真跑重新生成 */
  var r2d = await p.evaluate(function () {
    var G = window.GAME;
    var s = G.state, c0 = G.currentCity();
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
    if (!r || !r.ok) return { ok: false };
    var names = ['长枪兵', '刀盾兵', '弓箭手', '轻骑兵', '重步兵', '弩兵', '投石车', '冲车', '突骑兵',
      '虎豹骑', '象兵', '藤甲兵', '连弩兵', '井阑', '云梯', '火矢兵', '大盾兵', '游骑', '死士', '弓骑兵'];
    r.roster = names.map(function (nm, i) { return { name: nm, n: 1200 + i * 111 }; });
    r.totalExact = true;
    G.ui.closeAllModals();
    G.ui.openScoutResult({ kind: 'city', name: npc.name }, r);
    return { ok: true };
  });
  await sleep(500);
  var r2e = await p.evaluate(function () {
    var panel = document.querySelector('#modal-root .inner-panel');
    var sc = panel.querySelector('.m-body') || panel;
    var over = sc.scrollHeight - sc.clientHeight;
    sc.scrollTop = 99999;
    var after = sc.scrollTop;
    var kids = sc.children;
    var last = kids[kids.length - 1];
    var pRect = sc.getBoundingClientRect();
    var lRect = last ? last.getBoundingClientRect() : null;
    var bottomVisible = lRect ? (lRect.bottom <= pRect.bottom + 1) : null;
    sc.scrollTop = 0;
    var backTop = sc.scrollTop === 0;
    return { over: over, canScroll: after > 0, after: after, bottomVisible: bottomVisible, backTop: backTop };
  });
  chk('②b 极端（app-h=620）：over=' + r2e.over + ' → 可下拉（scrollTop→' + r2e.after + '）· 滚到底内容可见=' + r2e.bottomVisible + ' · 可回顶=' + r2e.backTop,
    r2e.over > 0 && r2e.canScroll && r2e.bottomVisible === true && r2e.backTop, JSON.stringify(r2e));
  await p.screenshot({ path: E + 'v89202-scout-scroll.png' });
  await p.evaluate(function () {
    document.documentElement.style.removeProperty('--app-h');
    window.GAME.ui.closeAllModals();
    return 1;
  });

  /* ══ ③ 收藏峰值（回落保持解锁 + 「最高」文案）══ */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var s = G.state;
    var tgt = null;
    ((G.DATA.COLLECT || {}).series || []).forEach(function (sr) {
      (sr.items || []).forEach(function (it) {
        var cd = G.collectCondOf(it.id);
        if (cd && cd.type === 'itemKind' && !tgt) tgt = { id: it.id, name: it.name, n: cd.n, sid: sr.id };
      });
    });
    if (!tgt) return { ok: false };
    s.collectPeak = {};
    s.items = {};
    for (var i = 0; i < tgt.n + 2; i++) s.items['pk202_' + i] = 1;
    G.collectCondMetOf(tgt.id);                 /* 达成（记录峰值） */
    var ks = Object.keys(s.items);
    for (var j = 1; j < ks.length; j++) delete s.items[ks[j]];
    G.ui._colCat = tgt.sid; G.ui.setView('collection');
    return { ok: true, name: tgt.name, n: tgt.n, raw: Object.keys(s.items).length };
  });
  await sleep(400);
  var r3b = await p.evaluate(function () {
    var G = window.GAME;
    var tgt = null;
    ((G.DATA.COLLECT || {}).series || []).forEach(function (sr) {
      (sr.items || []).forEach(function (it) {
        var cd = G.collectCondOf(it.id);
        if (cd && cd.type === 'itemKind' && !tgt) tgt = { id: it.id, name: it.name };
      });
    });
    var card = null;
    Array.from(document.querySelectorAll('#view-container .col-card')).forEach(function (c) {
      if (c.textContent.indexOf(tgt.name) >= 0) card = c;
    });
    return { found: !!card, locked: card ? card.classList.contains('locked') : null,
      txt: card ? card.textContent.slice(0, 60) : '' };
  });
  chk('③a 收藏峰值：品种回落（现值 ' + r3.raw + ' < ' + r3.n + '）后「' + r3.name + '」保持解锁（locked=' + r3b.locked + '）',
    r3.ok && r3b.found && r3b.locked === false, JSON.stringify(r3b));
  await p.screenshot({ path: E + 'v89202-collect.png' });
  /* 对照：清峰值 → 同卡回锁 */
  var r3c = await p.evaluate(function () {
    var G = window.GAME;
    G.state.collectPeak = {};
    G.ui.renderCollect();
    return 1;
  });
  await sleep(300);
  var r3d = await p.evaluate(function () {
    var tgt = null;
    var G = window.GAME;
    ((G.DATA.COLLECT || {}).series || []).forEach(function (sr) {
      (sr.items || []).forEach(function (it) {
        var cd = G.collectCondOf(it.id);
        if (cd && cd.type === 'itemKind' && !tgt) tgt = { id: it.id, name: it.name };
      });
    });
    var card = null;
    Array.from(document.querySelectorAll('#view-container .col-card')).forEach(function (c) {
      if (c.textContent.indexOf(tgt.name) >= 0) card = c;
    });
    return { locked: card ? card.classList.contains('locked') : null };
  });
  chk('③b 对照：清峰值（现值未变）→ 同卡回锁（locked=' + r3d.locked + ' · 判定读的就是峰值）',
    r3d.locked === true, '');

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
