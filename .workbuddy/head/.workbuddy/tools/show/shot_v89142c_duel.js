'use strict';
/* v89.142 实机验证（真浏览器）：需求 7 —— 战前斗将在回合战况播报
   （拆自 shot_v89142b：组合脚本在 1920×1080 + 三连截图后渲染进程会崩，
    本脚本单主题、1440×900、兵力 ≤ 练兵场容量。）
   跑法：node .workbuddy/tools/show/shot_v89142c_duel.js */
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
    /* 选靶：必有守将的野地（wildDefenseAt 确定性派生，出口在 GAME 上） */
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
      simKeys: rec ? Object.keys(rec.sim || {}) : [],
      hasDuel: !!(rec && rec.sim && rec.sim.duel && rec.sim.duel.done),
      hasGenSim: !!(rec && rec.sim && rec.sim.genSim), recId: rec ? rec.id : null };
  });
  console.log('靶=' + JSON.stringify(r1.wl || null) + ' · ok=' + r1.ok + (r1.msg ? '（' + r1.msg + '）' : ''));
  console.log('rec.sim keys = ' + JSON.stringify(r1.simKeys));
  chk('7A 观战挂起成功（战斗待指挥）', r1.ok === true && r1.pending === true);
  chk('7A rec.sim 存下 duel 与 genSim（修复"斗将只给对面加成"的漏存）',
    r1.hasDuel && r1.hasGenSim, r1.simKeys.join(','));

  var r2 = await p.evaluate(function (rid) {
    var G = window.GAME;
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.openBattlefield(rid);                        /* 真实入口 */
    var logEl = document.getElementById('bt-log');
    var row = logEl ? logEl.querySelector('.bt-ev.duel') : null;
    return { opened: !!logEl, hasRow: !!row, text: row ? row.textContent : '',
      logFirst: logEl ? (logEl.textContent || '').slice(0, 80) : '' };
  }, r1.recId);
  console.log('回合战况首行：' + r2.text);
  chk('7B 战斗界面回合战况里有斗将播报行（.bt-ev.duel + "战前斗将"字样）',
    r2.hasRow && /战前斗将/.test(r2.text) && /\+10%/.test(r2.text));
  chk('7B 播报行在回合记录区（#bt-log）内 —— 就是老板说的"回合战况这里"',
    r2.opened && r2.logFirst.indexOf('战前斗将') >= 0);
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-bt-duel.png' });
  console.log('浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
