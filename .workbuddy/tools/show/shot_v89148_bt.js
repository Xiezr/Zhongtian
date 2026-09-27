'use strict';
/* v89.148 实机验证（真浏览器 + 真布局）：老板 3 条 ——
   ① 城外资源建筑容量 = 同级仓库的 1/6（真加几块地块 → 量 storeCap 增量）
   ② 斗将播报**只在回合记录里**（顶部固定行已退役）
   ③ 战斗界面：播报 = **底部二分之一**（固定）· 示意图固定高 330 · 表头无"（N 队）"· 布局不整块滚
   跑法：node .workbuddy/tools/show/shot_v89148_bt.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ================= ① 露天容量 = 同级仓库的 1/6 ================= */
  console.log('===== ① 城外资源建筑容量（同级仓库的 1/6）=====');
  var m0 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验148', cityName: '许都', region: '豫州', mapSeed: 20260947 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var cap0 = G.storeCapOf(c), ext0 = G.extStoreCapOf(c);
    /* 真加 4 块资源建筑（1/1/1/12 级）→ 增量应 = Σlv × BASE / 6 */
    var g = G.extGridOf(c);
    g.length = 0;
    g.push({ id: 'e1', type: 'farm', lv: 1 }, { id: 'e2', type: 'forest', lv: 1 },
      { id: 'e3', type: 'quarry', lv: 1 }, { id: 'e4', type: 'mine', lv: 12 });
    var cap1 = G.storeCapOf(c), ext1 = G.extStoreCapOf(c);
    return {
      div: G.DATA.EXT_STORE_DIV, base: G.DATA.BASE_STORE,
      oldConst: G.DATA.EXT_STORE_PER_LV === undefined ? '已删除' : ('仍在=' + G.DATA.EXT_STORE_PER_LV),
      cap0: cap0, ext0: ext0, cap1: cap1, ext1: ext1,
      want: Math.round(15 * G.DATA.BASE_STORE / 6),
      capDelta: cap1 - cap0, extDelta: ext1 - ext0,
    };
  });
  console.log('  EXT_STORE_DIV=' + m0.div + ' · BASE_STORE=' + m0.base + ' · 旧常量 ' + m0.oldConst);
  console.log('  露天容量：' + m0.ext0 + ' → ' + m0.ext1 + '（Σlv=15 × 200万 ÷ 6 = ' + m0.want + '）');
  console.log('  资源上限：' + m0.cap0 + ' → ' + m0.cap1 + '（增量 ' + m0.capDelta + ' = 露天增量 ' + m0.extDelta + '）');
  chk('① 旧常量已删 + 新常量 = 6', m0.oldConst === '已删除' && m0.div === 6);
  chk('① 露天容量 = Σlv × BASE_STORE ÷ 6（Lv12 单块 = 400 万 · Lv1 三块 = 100 万）',
    m0.ext1 === m0.want && m0.want === 5000000, m0.ext1 + ' vs ' + m0.want);
  /* ⚠️ 新局城里**本来就有几块**资源建筑（ext0 > 0）——判据要按"增量 = 露天增量"，
     不能拿 want（重建后的全量）当 delta。 */
  chk('① 资源上限**真跟着涨**（增量 = 露天增量 —— 纯加法不吃加成）',
    m0.capDelta === m0.extDelta && m0.ext1 === m0.want,
    'Δcap=' + m0.capDelta + ' Δext=' + m0.extDelta + ' ext1=' + m0.ext1);

  /* ================= ②③ 战斗界面 ================= */
  console.log('===== ②③ 战斗界面（斗将只在记录里 / 播报底部 1/2 / 示意图定高）=====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.state;
    var c = G.currentCity();
    var xc = c.cells.filter(function (x) { return x.build && x.build.id === 'xiaochang'; })[0];
    if (xc) xc.build.lvl = 5;
    c.army = { changqiang: 60000 };
    var g = st.generals[0]; g.stamina = 999; g.energy = 999;
    var wl = null;
    for (var rr = 2; rr <= 14 && !wl; rr++) {
      for (var dy = -rr; dy <= rr && !wl; dy++) {
        for (var dx = -rr; dx <= rr && !wl; dx++) {
          var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
          if (!tl || G.map.wildAt(x, y) || (G.map.npcAt && G.map.npcAt(x, y))) continue;
          var lv = G.map.wildLevelNow(x, y);
          if (!(lv >= 8)) continue;
          var wd = G.wildDefenseAt(x, y, lv);
          if (wd && wd.gen) wl = { x: x, y: y, lv: lv, gen: wd.gen.name };
        }
      }
    }
    if (!wl) return { err: 'no-target' };
    var ch = G.DATA.DUEL.chance; G.DATA.DUEL.chance = 1;   /* 必触发（用完还原） */
    G.state.settings.battleWatch = true;
    var r = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'occupy', { changqiang: 38000 }, g.id, {});
    G.DATA.DUEL.chance = ch;
    var rec = null; (G.state.battles || []).forEach(function (bb) { rec = bb; });
    if (!rec) return { err: 'no-rec', msg: r.msg };
    G.ui.openBattlefield(rec.id);
    return { ok: true, recId: rec.id, gen: wl.gen };
  });
  console.log('  造局：靶 ' + JSON.stringify(r1.gen || r1.err));
  if (!r1.ok) { await b.close(); process.exit(1); }
  await p.waitForTimeout(400);

  var m = await p.evaluate(function () {
    function h(sel) { var e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().height) : -1; }
    var wrap = document.querySelector('#bt-wrap');
    var log = document.querySelector('#bt-wrap .bt-log');
    var bar = document.querySelector('#bt-wrap .bt-duelbar');
    var logRow = document.querySelector('#bt-wrap .bt-log .bt-ev.duel');
    var heads = [].slice.call(document.querySelectorAll('#bt-wrap .bt-side-h')).map(function (x) { return x.textContent; });
    return {
      wrap: h('#bt-wrap'), wrapOver: wrap ? (wrap.scrollHeight - wrap.clientHeight) : -1,
      top: h('#bt-wrap .bt-top'), board: h('#bt-wrap .bt-board'),
      field: h('#bt-wrap .bt-field'), log: h('#bt-wrap .bt-log'),
      hasDuelBar: !!bar, logRow: logRow ? logRow.textContent : '(无)',
      heads: heads,
      logRatio: wrap && log ? log.getBoundingClientRect().height / wrap.getBoundingClientRect().height : -1,
      logScrollOver: log ? (log.scrollHeight - log.clientHeight) : -1,
    };
  });
  console.log('  wrap=' + m.wrap + '（溢出 ' + m.wrapOver + '）· top=' + m.top + ' · board=' + m.board
    + ' · field=' + m.field + ' · log=' + m.log + '（占 wrap ' + (m.logRatio * 100).toFixed(1) + '%）');
  console.log('  表头：' + JSON.stringify(m.heads) + ' · 顶部斗将行：' + (m.hasDuelBar ? '仍在（错）' : '已删（对）'));
  console.log('  记录里的斗将行：' + m.logRow);
  chk('② 顶部**没有** .bt-duelbar（播报只留一处）', m.hasDuelBar === false);
  chk('② 回合记录（#bt-log）里**有**斗将行', m.logRow.indexOf('战前斗将') >= 0 && m.logRow !== '(无)');
  chk('③ 播报区 = **底部二分之一**（log / wrap = 50% ± 2%）', Math.abs(m.logRatio - 0.5) <= 0.02,
    (m.logRatio * 100).toFixed(1) + '%');
  chk('③ 战场示意图**定高 330px**（±2px 舍入容差）', Math.abs(m.field - 330) <= 2, m.field + 'px');
  chk('③ 表头**无「（N 队）」备注**（只有 我军 / 敌军）',
    m.heads.length > 0 && m.heads.every(function (t) { return /^(我军|敌军)$/.test(t); }), JSON.stringify(m.heads));
  chk('③ 整个战场面板**不滚**（布局固定 · 溢出 ≤ 2px）', m.wrapOver <= 2, m.wrapOver + 'px');
  /* ⚠️ .bt-log 有 margin-top（--sp-2 = 6px）——"填满 wrap"的等式要把外边距算进去 */
  chk('③ 三段（读秒+战场+播报+播报外边距）填满 wrap',
    Math.abs(m.top + m.board + m.log + 6 - m.wrap) <= 3,
    m.top + '+' + m.board + '+' + m.log + '+6=' + (m.top + m.board + m.log + 6) + ' vs ' + m.wrap);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89148-bt-after.png' });

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
