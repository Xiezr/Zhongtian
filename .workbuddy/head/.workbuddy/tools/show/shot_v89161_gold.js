/* v89.161 实机验证（真浏览器）：
   ① 资源栏旧币悬停 = 「全境通用」（真渲染 title）+ 图 v89161-gold-row.png
   ② 仓库面板折损行含现实换算（「游戏日（现实约 X @120×）」）+ 图 v89161-store-real.png
   ③ 费用悬停含旧币 → 注明「旧币：全境通用 · 粮木石铁：按本城结算」
   ④ 真环境跨城：乙城没货 → 报「本城资源不足」；给乙城备料 → 放行且只扣乙城
   ⑤ 调运面板没有旧币的数量框（真渲染）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89161_gold.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
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
    G.newGame({ name: '验161', cityName: '许都', region: '碎垣', mapSeed: 20260961 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
  });
  await p.waitForTimeout(900);

  console.log('===== ① 资源栏旧币行悬停 = 全境通用 =====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.renderSide();
    var amts = document.querySelectorAll('#res-bar .res-line .amt');
    var gold = null;
    document.querySelectorAll('#res-bar .res-line').forEach(function (row) {
      var lbl = row.querySelector('.lbl');
      if (lbl && /旧币/.test(lbl.textContent || '')) gold = row.querySelector('.amt');
    });
    return { tip: gold ? (gold.getAttribute('title') || '') : '', n: amts.length };
  });
  console.log('    旧币行 title = ' + r1.tip.split('\n')[0]);
  chk('旧币行悬停写「全境通用（各城共用这一口池子…）」', /全境通用/.test(r1.tip) && /一口池子/.test(r1.tip));
  var rc1 = await p.evaluate(function () {
    var row = null;
    document.querySelectorAll('#res-bar .res-line').forEach(function (x) {
      var l = x.querySelector('.lbl');
      if (!row && l && /旧币/.test(l.textContent || '')) row = x.getBoundingClientRect();
    });
    return row ? { x: row.left, y: row.top, w: row.width, h: row.height } : null;
  });
  if (rc1) {
    await p.screenshot({ path: OUT + 'v89161-gold-row.png',
      clip: { x: Math.max(0, rc1.x - 8), y: Math.max(0, rc1.y - 24), width: rc1.w + 16, height: rc1.h + 52 } });
    console.log('    📷 v89161-gold-row.png');
  }

  console.log('===== ② 仓库面板折损行（现实换算） =====');
  var r2 = await p.evaluate(function () {
    var G = window.GAME, c = G.currentCity();
    for (var i = 0; i < c.cells.length; i++) {
      if (!c.cells[i].build && !c.cells[i].officcial && !c.cells[i].official) { c.cells[i].build = { id: 'cangku', lvl: 3 }; break; }
    }
    c.res.grain = G.storeCapOf(c) + 320000;
    G.ui.openStore();
    var m = document.querySelector('#modal-root').innerHTML;
    return { real: /游戏日（现实约/.test(m), at: /@\d+×/.test(m), pct: /折损 25%/.test(m) };
  });
  await p.waitForTimeout(600);
  console.log('    折损行含现实换算 = ' + r2.real + ' · 带倍速 = ' + r2.at);
  chk('仓库面板折损行写「游戏日（现实约 X @120×）折损 25%」', r2.real && r2.at && r2.pct);
  var rc2 = await p.evaluate(function () {
    var el = document.querySelector('#modal-root .modal');
    if (!el) return null;
    var rc = el.getBoundingClientRect();
    return { x: rc.left, y: rc.top, w: rc.width, h: rc.height };
  });
  if (rc2) {
    /* 折损行在**面板上半部**（near + rotNote + rows 的顺序）→ 裁整块面板（上限 520px） */
    await p.screenshot({ path: OUT + 'v89161-store-real.png',
      clip: { x: rc2.x, y: rc2.y, width: rc2.w, height: Math.min(rc2.h, 520) } });
    console.log('    📷 v89161-store-real.png');
  }
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  console.log('===== ③ 费用悬停（含旧币时注明口径） =====');
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var tip = G.ui.buildCostTip({ grain: 100, gold: 500, time: 60 });
    var tip2 = G.ui.buildCostTip({ grain: 100, time: 60 });
    return { hit: /旧币：全境通用 · 粮木石铁：按本城结算/.test(tip), noHit: !/全境通用/.test(tip2), tip: tip };
  });
  console.log('    含旧币费用悬停 = ' + r3.tip.replace(/\n/g, ' | '));
  chk('含旧币费用悬停注明「旧币：全境通用 · 粮木石铁：按本城结算」', r3.hit);
  chk('不含旧币的费用悬停没有这行（不误导）', r3.noHit);

  console.log('===== ④ 真环境跨城：谁的城用谁的货 =====');
  var r4 = await p.evaluate(function () {
    var G = window.GAME, st = G.state, A = G.currentCity();
    var B = G.makeCity({ id: 'v161B', name: 'v161乙城', x: 640, y: 640, type: 'self' });
    G.registerCity(B);
    B.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(A)[k] = 5e6; G.res(B)[k] = 0; });
    st.queues.build = [];
    var mi = -1;
    B.cells.forEach(function (x, i) { if (mi < 0 && x.build && x.build.id === 'minfang') mi = i; });
    var sum4 = function (R) { return (R.grain || 0) + (R.wood || 0) + (R.stone || 0) + (R.iron || 0); };
    var aBefore = sum4(G.res(A));
    var rPoor = G.upgradeAt(B.id, mi);
    var blocked = rPoor.ok === false && /本城资源不足/.test(rPoor.msg || '') && sum4(G.res(A)) === aBefore;
    var cost = G.DATA.BUILDINGS.minfang.levelCost(B.cells[mi].build.lvl);
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(B)[k] = cost[k] || 0; });
    var bBefore = sum4(G.res(B));
    st.queues.build = []; B.cells[mi].pending = null;
    var rOk = G.upgradeAt(B.id, mi);
    var paid = rOk.ok === true && sum4(G.res(B)) < bBefore && sum4(G.res(A)) === aBefore;
    st.cities = st.cities.filter(function (x) { return x.id !== 'v161B'; });
    st.queues.build = [];
    return { blocked: blocked, paid: paid, msg: rPoor.msg, ok: rOk.msg };
  });
  console.log('    乙城没货 → ' + r4.msg + ' · 备料后 → ' + r4.ok);
  chk('★ 不挪用甲城（报「本城资源不足」，甲城分毫未动）', r4.blocked);
  chk('★ 备料后放行且只扣乙城', r4.paid);

  console.log('===== ⑤ 调运面板没有旧币的数量框 =====');
  var r5 = await p.evaluate(function () {
    var G = window.GAME, st = G.state, A = G.currentCity();
    var B = G.makeCity({ id: 'v161C', name: 'v161丙城', x: 641, y: 641, type: 'self' });
    G.registerCity(B);
    G.ui._cityId = A.id;
    G.ui.openExpModal({ kind: 'own', id: B.id });
    var hasGold = !!document.getElementById('cg-gold');
    var hasGrain = !!document.getElementById('cg-grain');
    G.ui.closeAllModals();
    st.cities = st.cities.filter(function (x) { return x.id !== 'v161C'; });
    return { gold: hasGold, grain: hasGrain, keys: (G.TRANSPORT_KEYS || []).join(',') };
  });
  console.log('    辎重框：粮=' + r5.grain + ' · 旧币=' + r5.gold + ' · TRANSPORT_KEYS=' + r5.keys);
  chk('★ 辎重区有粮框、无金框（旧币全境通用，不用运）', r5.grain === true && r5.gold === false);
  chk('TRANSPORT_KEYS 不含 gold', r5.keys.indexOf('gold') < 0);

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
