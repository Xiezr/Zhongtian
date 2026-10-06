/* v89.189 实机验证（真浏览器）：
   ① 受阻弹窗：出征「进入军事行动」（未选目标）真点 → 弹「无法执行」窗（含原因）
   ② 受阻弹窗：灰兵种卡真点 → 弹窗（原"点了没反应"修复）
   ③ 掠夺金：genLootEx / npcLoot 实机真调（金占比 · 占领全拿量级）
   ④ 人口占用：1 民房 ↔ 9 建筑 / 16 资源 恒等（真调）+ 侧栏「建筑人口」渲染
   跑法：NODE_PATH=... node .workbuddy/tools/show/shot_v89189_gates.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
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
    G.newGame({ name: '验189', cityName: '许都', region: '碎垣', mapSeed: 20260929 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    /* 塞两座建筑：军营 Lv1（灰兵种卡场景）+ 铁匠铺 Lv1 */
    var c = G.state.cities[0];
    var placed = 0;
    for (var i = 0; i < c.cells.length; i++) {
      if (c.cells[i] && c.cells[i].build) continue;
      if (placed === 0) { c.cells[i] = { build: { id: 'junying', lvl: 1 } }; placed++; }
      else if (placed === 1) { c.cells[i] = { build: { id: 'tiejiangpu', lvl: 1 } }; placed++; }
      else break;
    }
    window.__c = c.id;
    G.ui.setView('city');
    if (G.ui.renderSide) G.ui.renderSide();
  });
  await p.waitForTimeout(500);

  /* ---------- ① 出征「进入军事行动」受阻 ---------- */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'act';          /* 进入军事行动按钮在军务的「行动」页签 */
    G.ui.setView('marches');
    var btn = document.querySelector('[data-action="exp-act-go"]');
    if (!btn) return { err: 'no-btn' };
    var pre = { dis: btn.hasAttribute('disabled'), why: btn.getAttribute('data-why') || '' };
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    var txt = (document.querySelector('#modal-root') || {}).textContent || '';
    return { pre: pre, shown: txt.indexOf('无法执行') >= 0, reason: txt.indexOf('尚未选择出征目标') >= 0,
      txt: txt.slice(0, 90) };
  });
  chk('① 出征提交：软化态（无 disabled + 有 data-why）后真点 → 弹「无法执行」窗', 
    !r1.err && r1.pre && !r1.pre.dis && r1.pre.why.indexOf('尚未选择出征目标') >= 0
      && r1.shown && r1.reason, r1.err || r1.txt.replace(/\s+/g, ' '));
  await p.screenshot({ path: OUT + 'v89189-why.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ---------- ② 灰兵种卡受阻 ---------- */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var jyIdx = -1;
    for (var i = 0; i < c.cells.length; i++) {
      if (c.cells[i] && c.cells[i].build && c.cells[i].build.id === 'junying') { jyIdx = i; break; }
    }
    if (jyIdx < 0) return { err: 'no-junying' };
    G.ui._trainTab = 'inf';          /* 兵种卡在「步兵」页签（que 队列页不出卡） */
    G.ui.openTroops(jyIdx, 'normal');
    var card = document.querySelector('#modal-root .troop-card.disabled');
    if (!card) return { err: 'no-grey-card' };
    var why = card.getAttribute('data-why') || '';
    card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    var txt = (document.querySelector('#modal-root') || {}).textContent || '';
    return { why: why, shown: txt.indexOf('无法执行') >= 0, txt: txt.slice(0, 90) };
  });
  chk('② 灰兵种卡真点 → 弹「无法执行」窗（原"点了没反应"的 train-locked 死路修复）',
    !r2.err && r2.why && r2.shown, r2.err || ('why=' + String(r2.why).slice(0, 40)));
  await p.screenshot({ path: OUT + 'v89189-train.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ---------- ③ 掠夺金实机真调 ---------- */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var o = G.battle.genLootEx({ kind: 'fort', lv: 10, dropType: 'fort', x: 1, y: 1 }, 1,
      function () { return 0.5; }, true);
    var rs = o.grain + o.wood + o.stone + o.iron;
    var cty = G.npcCityRes({ id: 'npc_v189', type: 'county', level: 12, x: 1, y: 1 });
    var cap = G.npcCityRes({ id: 'npc_v189c', type: 'capital', level: 24, x: 1, y: 1 });
    return { fGold: o.gold, fPct: o.gold / (rs + o.gold),
      cGold: cty.gold, kGold: cap.gold };
  });
  chk('③ 掠夺金真调：fort Lv10 金 19.6 万·占比 ≤1.2% · 县城占领金 ≤500 万 · 都城 ≤2000 万',
    Math.abs(r3.fGold - 196000) / 196000 < 0.05 && r3.fPct <= 0.012
      && r3.cGold > 1e6 && r3.cGold <= 5e6 && r3.kGold <= 2e7,
    'fort金 ' + r3.fGold + ' 占比 ' + (r3.fPct * 100).toFixed(2) + '% 县城 ' + r3.cGold + ' 都城 ' + r3.kGold);

  /* ---------- ④ 人口占用恒等 + 侧栏渲染 ---------- */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var lv = 12, pm = G.DATA.BUILDINGS.minfang.pop[lv - 1];
    function labor(cells, extGrid) {
      return G.popLaborOf({ id: 'v4', cells: cells || [], extGrid: extGrid || [] });
    }
    var b9 = labor((function () {
      var a = [];
      ['junying', 'shuyuan', 'xiaochang', 'shichang', 'cangku', 'kezhan', 'majiu', 'yizhan', 'fenghuotai']
        .forEach(function (id) { a.push({ build: { id: id, lvl: lv } }); });
      return a;
    })());
    var e16 = labor([], (function () {
      var a = []; for (var i = 0; i < 16; i++) a.push({ type: 'farm', lv: lv });
      return a;
    })());
    /* 侧栏渲染（含"建筑人口"悬停） */
    G.ui.setView('city');
    if (G.ui.renderSide) G.ui.renderSide();
    var sideTxt = (document.querySelector('.auth-side') || {}).innerHTML || '';
    return { pm: pm, b9: b9, e16: e16, side: sideTxt.indexOf('建筑人口') >= 0 };
  });
  chk('④ 人口恒等：9 座同级建筑 == 1 民房人口（±1）· 16 块资源同理 · 侧栏「建筑人口」在册',
    Math.abs(r4.b9 - r4.pm) <= 1 && Math.abs(r4.e16 - r4.pm) <= 1 && r4.side,
    'P_m=' + r4.pm + ' b9=' + r4.b9 + ' e16=' + r4.e16);
  await p.screenshot({ path: OUT + 'v89189-city.png' });

  console.log('\n===== 实机结果：' + PASS + ' 通过 / ' + FAIL + ' 失败 =====');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
