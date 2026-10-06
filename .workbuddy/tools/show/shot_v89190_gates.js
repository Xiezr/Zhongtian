/* v89.190 实机验证（真浏览器 + 截图）：
   ① 将领界面：君主 vs 普通将 行高一致（Δ≤1px）· 解雇/晋升右移（+130px 且两行同 x）
      · 五按钮 16px 高 · 经验行无（N%） · gp-style 重复位不存在
   ② 自动征兵：自动化页 train 面板（表格/输入/规则）· 改输入落库 · 开关真点
   ③ 募兵面板「自动征兵设置」入口 → 跳到自动页并选中 train
   ④ 据点情报（已占野地）：已占面板有入口 → 弹窗含「我方驻军」
   截图：v89190-gen.png / v89190-auto.png / v89190-intel.png
   跑法：NODE_PATH=... node .workbuddy/tools/show/shot_v89190_gates.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var SHOT = 'E:/Deepseekdb/.workbuddy/shots/';
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
    G.newGame({ name: '实机190', cityName: '许都', region: '碎垣', mapSeed: 20260930 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    var p1 = G.makeGeneral('测一', 50, 'idle', null, false, 'ying', 'balance');
    p1.cityId = c.id;
    G.state.generals.push(p1);
    /* 给首城配军营+书院（募兵面板 / 自动征兵可用） */
    var placed = 0;
    for (var i = 0; i < c.cells.length && placed < 2; i++) {
      if (c.cells[i] && c.cells[i].build) continue;
      c.cells[i] = { build: { id: placed === 0 ? 'junying' : 'shuyuan', lvl: 3 } };
      placed++;
    }
    c.res.grain = 5000000; c.res.wood = 5000000; c.res.iron = 5000000; c.res.pop = 100000;
    G.goldAdd(5000000);
    G.ui.setView('city');
  });
  await p.waitForTimeout(500);
  var fail = 0;
  function chk(name, ok, extra) {
    console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!ok) fail++;
  }

  /* ---------- ① 将领界面几何 ---------- */
  var r1 = await p.evaluate(function () {
    var G = window.GAME, k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) { if (!el) return null; var r = el.getBoundingClientRect();
      return { x: Math.round(r.left / k * 10) / 10, y: Math.round(r.top / k * 10) / 10,
        w: Math.round(r.width / k * 10) / 10, h: Math.round(r.height / k * 10) / 10 }; }
    function snap(genId) {
      G.ui._genSel = genId; G.ui.setView('generals'); G.ui.renderView('generals');
      var pane = document.querySelector('.gen-pane');
      var idB = pane.querySelector('.gp-id');
      var nameB = idB.querySelector('.gp-name');
      var expRow = pane.querySelector('.gp-exprow');
      return {
        idH: R(idB).h, nameH: R(nameB).h,
        dismiss: R(pane.querySelector('.gp-nameops .btn')),
        rankup: R(pane.querySelector('.gp-rankrow .btn')),
        expadd: R(pane.querySelector('.gp-expadd')),
        setA: R(pane.querySelector('[data-action="toggle-equip-set"][data-set="sha"]')),
        setB: R(pane.querySelector('[data-action="toggle-equip-set"][data-set="ling"]')),
        gpStyle: pane.querySelectorAll('.gp-style').length,
        expText: expRow.textContent.replace(/\s+/g, ' '),
      };
    }
    var gs = G.state.generals;
    var lord = gs.filter(function (g) { return G.isLordGeneral(g); })[0];
    var p1 = gs.filter(function (g) { return g.name === '测一'; })[0];
    var oL = snap(lord.id), o1 = snap(p1.id);
    /* 回到普通将截图 */
    snap(p1.id);
    return { lord: oL, p1: o1 };
  });
  var L = r1.lord, N = r1.p1;
  chk('① 行高一致：gp-id 高 君主=' + L.idH + ' 普通=' + N.idH,
    Math.abs(L.idH - N.idH) <= 1, 'Δ=' + Math.round((N.idH - L.idH) * 10) / 10);
  chk('① 名称行高一致（不再被按钮撑高）', Math.abs(L.nameH - N.nameH) <= 1,
    '君主 ' + L.nameH + ' vs 普通 ' + N.nameH);
  chk('① 解雇/晋升右移 10 字符且两行同 x', N.dismiss && N.rankup
    && N.dismiss.x === N.rankup.x && N.dismiss.x >= 630 && N.dismiss.x <= 660,
    'x=' + (N.dismiss && N.dismiss.x) + '/' + (N.rankup && N.rankup.x) + '（旧 512 + 130 ≈ 642）');
  chk('① 五按钮 16px 高（解雇/晋升/经验＋/军中/修炼）',
    (N.dismiss && N.dismiss.h) === 16 && (N.rankup && N.rankup.h) === 16
    && (N.expadd && N.expadd.h) === 16
    && (L.setA && L.setA.h) === 16 && (L.setB && L.setB.h) === 16,
    [N.dismiss && N.dismiss.h, N.rankup && N.rankup.h, N.expadd && N.expadd.h,
      L.setA && L.setA.h, L.setB && L.setB.h].join('/'));
  chk('① 经验行无「（N%）」备注', N.expText.indexOf('%') < 0, JSON.stringify(N.expText.slice(0, 60)));
  chk('① 「均衡」重复位不存在（pane 无 .gp-style）', N.gpStyle === 0);
  await p.screenshot({ path: SHOT + 'v89190-gen.png', clip: { x: 0, y: 0, width: 1600, height: 1000 } });

  /* ---------- ② 自动征兵面板 ---------- */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui._autoSel = 'train';
    G.ui.setView('auto'); G.ui.renderView('auto');
    var pane = document.querySelector('.auto-pane');
    var inpN = pane ? pane.querySelectorAll('input[data-action="autotrain-set"]').length : 0;
    var txt = pane ? pane.textContent : '';
    var hasToggle = !!document.querySelector('[data-action="toggle-auto-train"]');
    /* 改一个输入真落库 */
    var inp = document.querySelector('.auto-pane input[data-action="autotrain-set"][data-k="max"][data-troop="yibing"]');
    var changed = false;
    if (inp) {
      inp.value = '888';
      inp.dispatchEvent(new window.Event('change', { bubbles: true }));
      changed = G.autoTrainCfg().targets.yibing.max === 888;
    }
    /* 开关真点 */
    var btn = document.querySelector('[data-action="toggle-auto-train"]');
    if (btn) btn.click();
    var onNow = G.state.settings.autoTrain === true;
    /* 复位（供后续） */
    G.state.settings.autoTrain = false;
    G.autoTrainCfg().targets.yibing.max = 0;
    G.ui.renderView('auto');
    return { inpN: inpN, hasToggle: hasToggle, changed: changed, onNow: onNow,
      hasRules: txt.indexOf('触发条件') >= 0 && txt.indexOf('停止条件') >= 0,
      hasSlots: txt.indexOf('可用栏位') >= 0, hasCities: txt.indexOf('各城栏位与缺口') >= 0 };
  });
  chk('② 自动征兵面板：输入 ≥17（15 兵种×2 + 保底 2）', r2.inpN >= 17, 'inp=' + r2.inpN);
  chk('② 规则四行齐备（触发/停止/可用栏位/各城）', r2.hasRules && r2.hasSlots && r2.hasCities);
  chk('② 改「目标」输入真落库（yibing.max=888）', r2.changed);
  chk('② 开关真点 → settings.autoTrain=true', r2.onNow && r2.hasToggle);
  await p.screenshot({ path: SHOT + 'v89190-auto.png', clip: { x: 0, y: 0, width: 1600, height: 1000 } });

  /* ---------- ③ 募兵面板入口 ---------- */
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._trainTab = 'que';
    G.ui.openTroops(null, 'normal');
    var rt = document.querySelector('#modal-root');
    var btn = rt && rt.querySelector('[data-action="go-auto-train"]');
    var found = !!btn;
    if (btn) btn.click();
    var ok = G.ui._autoSel === 'train' && !!document.querySelector('[data-action="toggle-auto-train"]');
    G.ui.closeAllModals();
    return { found: found, ok: ok };
  });
  chk('③ 募兵面板（队列页）有「自动征兵设置」入口', r3.found);
  chk('③ 点入口 → 自动页并选中 train', r3.ok);

  /* ---------- ④ 据点情报（已占野地） ---------- */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    var hit = null;
    for (var r = 1; r <= 6 && !hit; r++) {
      for (var dy = -r; dy <= r && !hit; dy++) for (var dx = -r; dx <= r && !hit; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city' || tl.terrain === 'water') continue;
        hit = { x: x, y: y };
      }
    }
    G.state.wilds.push({ x: hit.x, y: hit.y, type: 'plain', lv: 3 });
    G.state.forts = {};
    G.state.forts[(hit.x + 1) + ',' + hit.y] = { x: hit.x + 1, y: hit.y, lv: 3, name: '前哨甲' };
    G.ui.openLandModal(hit.x, hit.y);
    var rt = document.querySelector('#modal-root');
    var btn = rt && rt.querySelector('[data-action="wild-fortintel"]');
    var found = !!btn;
    var head = rt ? (rt.querySelector('.m-title') || rt.querySelector('.gold-heading')) : null;
    if (btn) btn.click();
    var txt = (document.querySelector('#modal-root') || {}).textContent || '';
    return { found: found, head: head ? head.textContent : '(?)',
      hasMine: txt.indexOf('我方驻军') >= 0, hasOwned: txt.indexOf('已归我方') >= 0,
      noEnemy: txt.indexOf('守军明细') < 0 };
  });
  chk('④ 已占野地面板有「据点情报」入口', r4.found, r4.head);
  chk('④ 弹窗=我方视角（我方驻军 · 已归我方 · 不列守军明细）',
    r4.hasMine && r4.hasOwned && r4.noEnemy);
  await p.screenshot({ path: SHOT + 'v89190-intel.png', clip: { x: 0, y: 0, width: 1600, height: 1000 } });

  console.log(fail === 0 ? '\nALL-PASS（' + (13 - fail) + '/0）' : '\nFAIL ' + fail);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
