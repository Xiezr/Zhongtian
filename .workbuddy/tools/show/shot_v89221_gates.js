/* v89.221 实机验收：① 创建界面 chip 标签=新区名 ② 任务页签 .fresh 闪烁（两帧对照）
   ③ 车库解锁行=新兵种名 ④ 占野者绰号池 ⑤ 任务视图（改名后的任务卡）
   图：v89221-create / v89221-nav1 / v89221-nav2 / v89221-build / v89221-tasks */
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
  await sleep(500);

  /* ══ ① 创建界面 chip 标签（真 DOM 读回） ══ */
  var chips = await p.evaluate(function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('#screen-create [data-target="create-region"]'));
    return els.map(function (el) { return { v: el.dataset.v, t: (el.textContent || '').trim() }; });
  });
  var NAMES = ['烬环', '枯河', '碎垣', '沉陆', '盐岸', '灰野', '霜脊', '黑岭', '风碛', '雾谷', '泽心', '潮湾', '藤林'];
  var bad = chips.filter(function (c) { return c.v !== 'random' && c.t !== c.v; });
  var hasOld = chips.some(function (c) { return c.t === '司隶' || c.t === '幽州' || c.t === '洛阳'; });
  console.log('  chip 读回: ' + chips.map(function (c) { return c.t; }).join('/'));
  chk('① 创建界面 13 chip 标签 = 新区名（老名零残留）', bad.length === 0 && !hasOld && chips.length === 14, JSON.stringify(bad));
  await p.screenshot({ path: E + 'v89221-create.png' });

  /* 进游戏 */
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验收', cityName: '灰烬城', region: '烬环', mapSeed: 20261021 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
  });
  await sleep(700);

  /* ══ ② 任务页签 .fresh 闪烁 ══ */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    c.army = c.army || {};
    c.army.gongjian = 300;                       /* g20「弓弩之利」需弩手 200 → 造出可领取 */
    var qs = G.questSummary();
    G.ui.syncBadges();
    var tab = document.querySelector('#topnav .tab[data-view="tasks"]');
    var ti = tab ? tab.querySelector('.ti') : null;
    var st = ti ? getComputedStyle(ti) : null;
    return {
      ready: qs.ready,
      fresh: tab ? tab.classList.contains('fresh') : null,
      anim: st ? st.animationName : '',
      badge: !!document.querySelector('#tab-badge-task'),
    };
  });
  console.log('  ready=' + r2.ready + ' fresh=' + r2.fresh + ' anim=' + r2.anim + ' 徽标元素=' + r2.badge);
  chk('② 有可领取任务 → 任务页签挂 .fresh · 动画 docBlink · 徽标元素不存在',
    r2.ready > 0 && r2.fresh === true && r2.anim === 'docBlink' && r2.badge === false, JSON.stringify(r2));
  var tabRect = await p.evaluate(function () {
    var tab = document.querySelector('#topnav .tab[data-view="tasks"]');
    var r = tab.getBoundingClientRect();
    return { x: Math.round(r.left) - 6, y: Math.round(r.top) - 6, w: Math.round(r.width) + 12, h: Math.round(r.height) + 12 };
  });
  await p.screenshot({ path: E + 'v89221-nav1.png', clip: { x: tabRect.x, y: tabRect.y, width: tabRect.w, height: tabRect.h } });
  await sleep(760);                              /* docBlink 周期 1.5s → 两帧落在不同相位 */
  await p.screenshot({ path: E + 'v89221-nav2.png', clip: { x: tabRect.x, y: tabRect.y, width: tabRect.w, height: tabRect.h } });

  /* 领完（一键全领，含随机任务） → 熄 */
  var r2b = await p.evaluate(function () {
    var G = window.GAME;
    G.doClaimAllQuests();
    G.ui.syncBadges();
    var tab = document.querySelector('#topnav .tab[data-view="tasks"]');
    return { ready: G.questSummary().ready, fresh: tab.classList.contains('fresh') };
  });
  chk('②b 全部领取后 .fresh 熄灭（ready 归 0）', r2b.ready === 0 && r2b.fresh === false, JSON.stringify(r2b));

  /* ══ ③ 车库解锁行（UI 文本 = 新兵种名） ══ */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var idx = -1;
    c.cells.forEach(function (x, i) { if (idx < 0 && x.build && x.build.id === 'majiu') idx = i; });
    if (idx < 0) {
      for (var i = 0; i < c.cells.length; i++) {
        if (!c.cells[i].build) { c.cells[i].build = { id: 'majiu', lvl: 3 }; idx = i; break; }
      }
    }
    if (idx < 0) return { err: 'no-cell' };
    G.ui.closeAllModals();
    G.ui.openBuildModal(idx);
    var root = document.querySelector('#modal-root');
    var txt = root ? root.textContent : '';
    var modal = root ? root.querySelector('.modal') : null;
    var r = modal ? modal.getBoundingClientRect() : null;
    return {
      idx: idx,
      has: txt.indexOf('摩托游骑需1级 · 装甲战车/突击摩托需3级 · 王牌战车/重甲战车需4级') >= 0,
      old: txt.indexOf('轻骑需1级') >= 0,
      rect: r ? { x: Math.max(0, Math.round(r.left) - 6), y: Math.max(0, Math.round(r.top) - 6), w: Math.round(r.width) + 12, h: Math.round(r.height) + 12 } : null,
    };
  });
  chk('③ 车库解锁行 = 新兵种名（旧名零残留）', r3.has === true && r3.old === false, JSON.stringify({ has: r3.has, old: r3.old }));
  if (r3.rect) await p.screenshot({ path: E + 'v89221-build.png', clip: { x: r3.rect.x, y: r3.rect.y, width: Math.min(r3.rect.w, 1200), height: Math.min(r3.rect.h, 900) } });

  /* ══ ④ 占野者绰号池（真造一个野地守将） ══ */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var T = G.DATA.WILD_LORD_TITLE;
    var OLD = ['渠帅', '贼首', '山君', '寨主', '渠魁', '豪帅'];
    var found = null;
    for (var y = 200; y < 260 && !found; y += 7) {
      for (var x = 240; x < 320 && !found; x += 7) {
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(x, y) || G.map.npcAt(x, y)) continue;
        var lv = G.map.wildLevelNow(x, y);
        var wd = G.wildDefenseAt(x, y, lv);
        if (wd && wd.gen) found = { x: x, y: y, lv: lv, title: wd.gen.title, name: wd.gen.name };
      }
    }
    return { pool: T, oldInPool: OLD.filter(function (w) { return T.indexOf(w) >= 0; }), guard: found };
  });
  chk('④ 绰号池 = 末日废土系（旧绰号零残留）', r4.pool.length === 6 && r4.oldInPool.length === 0, r4.pool.join('/'));
  chk('④b 真造野地守将 → 绰号取自新池', !!r4.guard && r4.pool.indexOf(r4.guard.title) >= 0,
    r4.guard ? (r4.guard.name + '（' + r4.guard.title + '）@' + r4.guard.x + ',' + r4.guard.y) : '未找到守将');
  console.log('  野地守将样本: ' + JSON.stringify(r4.guard));

  /* ══ ⑤ 任务视图（改名后的任务卡可见：造 g21 可领取 → 出现在"可领取"行） ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    c.army = c.army || {};
    c.army.changqiang = 260;                     /* g21「长矛成林」需长矛手 200 → 可领取行可见 */
    G.ui.closeAllModals();
    G.ui.setView('tasks'); G.ui.renderView('tasks');
  });
  await sleep(600);
  var r5 = await p.evaluate(function () {
    var t = document.querySelector('#view-container');
    var s = t ? t.textContent : '';
    return {
      hasNew: s.indexOf('长矛成林') >= 0,
      old: s.indexOf('长枪成林') >= 0,
    };
  });
  chk('⑤ 任务视图含改名后的任务卡（长矛成林）· 旧名零残留', r5.hasNew === true && r5.old === false, JSON.stringify(r5));
  await p.screenshot({ path: E + 'v89221-tasks.png' });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close(); process.exit(FAIL ? 1 : 0);
})();
