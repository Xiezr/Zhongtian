'use strict';
/* v89.144 实机验证 B（真浏览器）：斗将播报 —— ⛔ **v89.148 改口径**：
   老板「这个播报出现在 2 处，保留回合记录中的就行」→ 顶部固定行（.bt-duelbar）**已退役**，
   本脚本改为验收"**只有回合记录一处**"（战场 HTML 里不得再有顶部行）。
   跑法：node .workbuddy/tools/show/shot_v89144b_duel.js  */
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
  var p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260942 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var xc = c.cells.filter(function (x) { return x.build && x.build.id === 'xiaochang'; })[0];
    if (xc) xc.build.lvl = 5;
    c.army = { changqiang: 60000 };
    var g = st.generals[0]; g.stamina = 999; g.energy = 999;
    /* 选靶：必有守将的野地（wildDefenseAt 确定性派生 · §56.5 的定式） */
    var wl = null;
    for (var rr = 2; rr <= 14 && !wl; rr++) {
      for (var dy = -rr; dy <= rr && !wl; dy++) {
        for (var dx = -rr; dx <= rr && !wl; dx++) {
          var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
          if (!tl || G.map.wildAt(x, y) || (G.map.npcAt && G.map.npcAt(x, y))) continue;
          var lv = G.map.wildLevelNow(x, y);
          if (!(lv >= 8)) continue;
          var wd = G.wildDefenseAt(x, y, lv);
          if (wd && wd.gen) wl = { x: x, y: y, lv: lv, gen: wd.gen.name, total: wd.total };
        }
      }
    }
    if (!wl) return { err: 'no-target' };
    var ch = G.DATA.DUEL.chance; G.DATA.DUEL.chance = 1;   /* 必触发（用完还原） */
    G.state.settings.battleWatch = true;
    var r = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'occupy', { changqiang: 38000 }, g.id, {});
    G.DATA.DUEL.chance = ch;
    var rec = null; (G.state.battles || []).forEach(function (bb) { rec = bb; });
    return { wl: wl, ok: r.ok, msg: r.msg || '', pending: !!r.pending,
      hasDuel: !!(rec && rec.sim && rec.sim.duel && rec.sim.duel.done), recId: rec ? rec.id : null };
  });
  console.log('靶=' + JSON.stringify(r1.wl || null) + ' · ok=' + r1.ok + (r1.msg ? '（' + r1.msg + '）' : ''));
  chk('1A 观战挂起 + rec.sim.duel 在（斗将已掷）', r1.ok === true && r1.pending === true && r1.hasDuel === true);

  var r2 = await p.evaluate(function (rid) {
    var G = window.GAME;
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.openBattlefield(rid);
    var wrap = document.getElementById('bt-wrap');
    var bar = wrap.querySelector('.bt-duelbar');   /* v89.148：应恒为 null（顶部行已退役） */
    var top = wrap.querySelector('.bt-top');
    var log = document.getElementById('bt-log');
    var logRow = log ? log.querySelector('.bt-ev.duel') : null;
    /* 顶部行的**真实位置**：它必须整块排在 .bt-top 之上（DOM 顺序 + 视觉 y） */
    var before = false;
    if (bar && top && wrap.children && wrap.children.length) {
      var kids = [].slice.call(wrap.children);
      before = kids.indexOf(bar) >= 0 && kids.indexOf(top) >= 0 && kids.indexOf(bar) < kids.indexOf(top);
    }
    return {
      hasBar: !!bar, beforeTop: before,
      barText: bar ? bar.textContent : '',
      barTop: bar ? Math.round(bar.getBoundingClientRect().top) : -1,
      topTop: top ? Math.round(top.getBoundingClientRect().top) : -1,
      logRowText: logRow ? logRow.textContent : '',
      wrapIdx: bar && top ? [].slice.call(wrap.children).map(function (x) { return x.className; }) : [],
    };
  }, r1.recId);
  console.log('  顶部行：' + JSON.stringify(r2.barText || '(无)'));
  console.log('  DOM 顺序：' + JSON.stringify(r2.wrapIdx.slice(0, 3)) + ' · y: top=' + r2.topTop);
  chk('1B v89.148：战场最顶**没有** .bt-duelbar（播报只留一处）', r2.hasBar === false);
  chk('1B 回合记录里那行仍在（唯一播报处 · 含"战前斗将"+ 胜者名）',
    /战前斗将/.test(r2.logRowText) && /胜（/.test(r2.logRowText), r2.logRowText);
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89144-bt-duel.png' });

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
