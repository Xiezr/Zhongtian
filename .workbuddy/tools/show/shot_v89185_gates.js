/* v89.185 实机验证（真浏览器）：
   ① 人口行显示"民心 x% 折算"（有效人口上限）→ 截图
   ② 野地守将新体系（Lv5+ 有将 → 等级 70~129 · 英杰）→ 出征面板截图
   ③ 据点守将（名世 60 起）→ 出征面板截图
   ④ 衰减 -2/日 真跑 + 六维不封口真调（数值断言）
   跑法：NODE_PATH=... node .workbuddy/tools/show/shot_v89185_gates.js */
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
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验185', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    /* v89.185 实机修：开场引导弹窗会挡住侧栏；主动切视图 + 渲染侧栏（同产品出口） */
    G.ui.setView('city');
    if (G.ui.renderSide) G.ui.renderSide();
    G.ui.closeAllModals();
  });
  await p.waitForTimeout(900);

  /* ① 人口行（民心折算） */
  var pop = await p.evaluate(function () {
    var tip = document.querySelector('#city-attrs .pop-line .rate-wrap');
    return { tip: tip ? (tip.getAttribute('data-tip') || '') : null };
  });
  chk('① 人口行悬停含「民心 X% 折算」', !!pop.tip && /民心 \d+% 折算/.test(pop.tip),
    (pop.tip || '缺').replace(/\s+/g, ' ').slice(0, 60));
  var clip1 = await p.evaluate(function () {
    var el = document.querySelector('#city-attrs');
    var r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(360, r.width + 8), height: Math.min(420, r.height + 8) };
  });
  await p.screenshot({ path: OUT + 'v89185-pop.png', clip: clip1 });

  /* ② 野地守将（扫有将的 Lv5-8 野地 → 出征面板） */
  var wild = await p.evaluate(function () {
    var G = window.GAME, c = G.state.cities[0];
    for (var lv = 8; lv >= 5; lv--) {
      for (var r = 1; r <= 14; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (!tl || tl.terrain !== 'plain') continue;
        if (G.map.wildAt(x, y) || G.map.fortAt(x, y)) continue;
        if (G.map.wildLevelNow(x, y) !== lv) continue;
        var wd = G.wildDefenseAt(x, y, lv);
        if (!wd.gen) continue;
        var t = G.battle.resolveTarget({ kind: 'wild', x: x, y: y });
        G.ui.closeAllModals();
        G.ui.openExpModal({ kind: 'wild', x: x, y: y });
        return { x: x, y: y, lv: lv, glv: wd.gen.level, rank: wd.gen.rank, name: wd.gen.name, guard: !!(t && t.guard) };
      }
    }
    return null;
  });
  chk('② 野地有将样本（Lv5-8 · 等级 = 30+(lv-1)×10 ~ +9 · 英杰）',
    !!wild && wild.guard && wild.rank === 'ying'
    && wild.glv >= 30 + (wild.lv - 1) * 10 && wild.glv <= 30 + (wild.lv - 1) * 10 + 9,
    wild ? ('Lv' + wild.lv + ' 守将 ' + wild.name + ' ' + wild.glv + ' ' + wild.rank) : '未扫到');
  await p.waitForTimeout(350);
  var clip2 = await p.evaluate(function () {
    var el = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: Math.min(1200, r.width + 12), height: Math.min(920, r.height + 12) };
  });
  if (clip2) await p.screenshot({ path: OUT + 'v89185-wild.png', clip: clip2 });

  /* ③ 据点守将 + 出征面板截图 */
  var fort = await p.evaluate(function () {
    var G = window.GAME;
    var f = null;
    for (var y = 0; y < 60 && !f; y++) for (var x = 0; x < 60 && !f; x++) f = G.map.fortAt(x, y);
    if (!f) return null;
    var g = G.fortGuardOf(f);
    G.ui.closeAllModals();
    G.ui.openExpModal({ kind: 'fort', x: f.x, y: f.y });
    return { lv: f.level, glv: g.level, rank: g.rank };
  });
  chk('③ 据点守将（名世 · 60+(lv-1)×10 ~ +9）',
    !!fort && fort.rank === 'ming'
    && fort.glv >= 60 + (fort.lv - 1) * 10 && fort.glv <= 60 + (fort.lv - 1) * 10 + 9,
    fort ? ('据点Lv' + fort.lv + ' 守将 Lv' + fort.glv + ' ' + fort.rank) : '无据点');
  await p.waitForTimeout(350);
  var clip3 = await p.evaluate(function () {
    var el = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: Math.min(1200, r.width + 12), height: Math.min(920, r.height + 12) };
  });
  if (clip3) await p.screenshot({ path: OUT + 'v89185-fort.png', clip: clip3 });

  /* ④ 衰减 -2/日 真跑 + 六维不封口真调 */
  var num = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    /* 衰减：造一块已占野地（昨天登记）→ decayWilds → -2；有驻军 → -1 */
    var st = G.state;
    var bw = JSON.stringify(st.wilds);
    var today = G.questDayIndex();
    st.wilds = [
      { x: -8, y: -8, type: 'lake', level: 8, levelDay: today - 1 },
      { x: -7, y: -7, type: 'forest', level: 8, levelDay: today - 1, garrison: { troops: { yibing: 50 }, cityId: st.cities[0].id } },
    ];
    G.decayWilds();
    var plain = st.wilds[0].level, held = st.wilds[1].level;
    st.wilds = JSON.parse(bw);
    /* 曲线：不封口（`data` 出口真调） */
    var c5 = G.curveBonusOf(5000, 0.01, 150);
    return { plain: plain, held: held, curve: c5 };
  });
  chk('④a 衰减真跑：无驻军 -2（8→6）· 有驻军 -1（8→7）', num.plain === 6 && num.held === 7,
    'plain=' + num.plain + ' held=' + num.held);
  chk('④b 六维不封口真调（nz 5000 → +1400%）', Math.abs(num.curve - 14.0) < 1e-9, '+' + (num.curve * 100).toFixed(0) + '%');

  console.log('实机结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
