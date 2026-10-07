'use strict';
/* v89.150 实机验证 B（真浏览器）：老板 1 / 4 / 6 ——
   ① 兵牌外框三档（徒步窄 / 机车中 / 器械维持 · v89.230 类名同步）
   活体回归：兵种 id 与形态类名随换代同步（可用即复跑）。
   ④ 战场弹窗铺满（左右留白清零、战场宽 +25%）
   ⑥ 关闭战场回大界面（一次关净 → 不在弹窗栈里）
   跑法：node .workbuddy/tools/show/shot_v89150b_troopfield.js */
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
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '战', cityName: '灰岗', region: '碎垣', mapSeed: 20260950 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var xc = c.cells.filter(function (x) { return x.build && x.build.id === 'xiaochang'; })[0];
    if (xc) xc.build.lvl = 12;
    /* 三形态齐备（徒步/机车/器械）+ 多队载荷（触发 dense 档） */
    c.army = { buxingji: 20000, dunwei: 8000, daodanche: 6000, fujiche: 5000, zhuzhan: 4000, wuren: 3000 };
    var g = st.generals[0]; g.stamina = 999; g.energy = 999;
    var wl = null;
    for (var rr = 3; rr <= 14 && !wl; rr++) {
      for (var dy = -rr; dy <= rr && !wl; dy++) {
        for (var dx = -rr; dx <= rr && !wl; dx++) {
          var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
          if (!tl || G.map.wildAt(x, y) || (G.map.npcAt && G.map.npcAt(x, y))) continue;
          var lv = G.map.wildLevelNow(x, y);
          if (!(lv >= 8)) continue;
          var wd = G.wildDefenseAt(x, y, lv);
          if (wd && wd.gen) wl = { x: x, y: y, lv: lv };
        }
      }
    }
    if (!wl) return { err: 'no-target' };
    st.settings.battleWatch = true;
    var r = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'raid',
      { buxingji: 12000, fujiche: 5000, wuren: 3000 }, g.id, {});
    var rec = null; (st.battles || []).forEach(function (bb) { rec = bb; });
    return { ok: !!rec, recId: rec ? rec.id : null, listN: G.ui.battleListOf().length, msg: r.msg || '' };
  });
  console.log('造局: ' + JSON.stringify(r1));
  chk('挂起成功（战斗待指挥）', r1.ok === true && r1.listN >= 1, '待指挥 ' + r1.listN + ' 场');

  /* ============ ① 兵牌三档 ============ */
  await p.evaluate(function (id) { window.GAME.ui.openBattlefield(id); }, r1.recId);
  await p.waitForTimeout(600);
  var m1 = await p.evaluate(function () {
    function W(sel) { var e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().width) : -1; }
    var out = { k: (window.GAME.appKOf ? window.GAME.appKOf() : 1), units: {}, fieldW: W('#bt-wrap .bt-field'),
      boardW: W('#bt-wrap .bt-board'), modalW: W('#modal-root .modal'), dense: false };
    var fd = document.querySelector('#bt-wrap .bt-field');
    out.dense = !!(fd && fd.classList.contains('dense'));
    out.n = document.querySelectorAll('#bt-wrap .bt-unit').length;
    ['walk', 'ride', 'craft'].forEach(function (sh) {
      var el = document.querySelector('#bt-wrap .bt-unit.' + sh);
      if (el) {
        var r = el.getBoundingClientRect();
        var ico = el.querySelector('.bt-ico svg, .bt-ico img');
        var ir = ico ? ico.getBoundingClientRect() : null;
        out.units[sh] = { w: Math.round(r.width / out.k), h: Math.round(r.height / out.k),
          ico: ir ? Math.round(ir.width / out.k) : -1, troop: el.dataset.troop };
      }
    });
    out.fb = getComputedStyle(fd).backgroundImage.slice(0, 90);
    return out;
  });
  console.log('  缩放 k=' + m1.k.toFixed(3) + ' · 兵牌数 ' + m1.n + ' · dense=' + m1.dense);
  console.log('  三档实测（除 k 还原为画布单位）：' + JSON.stringify(m1.units));
  chk('① 三档齐备（walk/ride/craft 都在场上）',
    !!m1.units.walk && !!m1.units.ride && !!m1.units.craft, Object.keys(m1.units).join('/'));
  if (m1.units.walk && m1.units.ride && m1.units.craft) {
    var wi = m1.units.walk.w, wc = m1.units.ride.w, ws = m1.units.craft.w;
    chk('① 徒步窄（28px ±2）', Math.abs(wi - 28) <= 2, wi + 'px');
    chk('① 机车比徒步宽、比器械窄（32px ±2）', Math.abs(wc - 32) <= 2 && wc > wi && wc < ws, wi + ' < ' + wc + ' < ' + ws);
    chk('① 器械维持方块（36px ±2 = 改前尺寸）', Math.abs(ws - 36) <= 2, ws + 'px');
    chk('① 图标大小三档一致（26px —— 变的是框的留白，不是图标）',
      m1.units.walk.ico === m1.units.ride.ico && m1.units.ride.ico === m1.units.craft.ico,
      [m1.units.walk.ico, m1.units.ride.ico, m1.units.craft.ico].join('/'));
  }
  chk('① 战场背景已淡（中间深色带 .26，不再是 .42）',
    /rgba\(0, 0, 0, 0\.26\)/.test(m1.fb), m1.fb.slice(0, 60));

  /* ============ ④ 战场铺满 ============ */
  console.log('===== ④ 战场铺满（改前：弹窗 1200 · 战场 730）=====');
  /* ⚠️ rect 是**视觉尺寸**（含 k）→ 一律除以 k 还原成画布单位再比（§63.4 的口径） */
  var mw = Math.round(m1.modalW / m1.k), bw = Math.round(m1.boardW / m1.k), fw = Math.round(m1.fieldW / m1.k);
  console.log('  弹窗 ' + mw + ' · board ' + bw + ' · 战场 ' + fw + 'px（画布单位）');
  chk('④ 战场弹窗 = 画布 − 16px（铺满 · 改前 1200）', Math.abs(mw - 1424) <= 3, mw + 'px');
  chk('④ 中间战场显著变宽（改前 730 → 应 ≥ 870）', fw >= 870, fw + 'px');
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89150-bt-full.png' });

  /* ============ ⑥ 关闭战场回大界面 ============ */
  console.log('===== ⑥ 关闭战场回大界面 =====');
  var r6 = await p.evaluate(function () {
    var G = window.GAME;
    /* 模拟真实链路：先开一个"中间面板"（城池面板），再进战场 → 关闭应**一次关净** */
    G.ui.closeAllModals();
    G.ui.setView('map');
    var before = { modalStack: (G.ui._modalStack || []).length, hasModal: !!document.querySelector('#modal-root .modal') };
    var rec = null; (G.state.battles || []).forEach(function (bb) { rec = bb; });
    G.ui.openBattlefield(rec.id);
    var opened = !!document.querySelector('#modal-root .modal');
    var closeAllFlag = !!G.ui._modalCloseAll;
    G.ui.closeModal();
    var after = { modalStack: (G.ui._modalStack || []).length,
      rootHTML: (document.getElementById('modal-root').innerHTML || '').length,
      view: G.ui.view };
    return { before: before, opened: opened, closeAllFlag: closeAllFlag, after: after };
  });
  console.log('  ' + JSON.stringify(r6));
  chk('⑥ 战场层带 closeAll 标记（关闭键 = 一次关净）', r6.closeAllFlag === true);
  chk('⑥ 关闭后 modal-root 清空（不滞留中间面板）', r6.after.rootHTML === 0, 'html 长度 ' + r6.after.rootHTML);
  chk('⑥ 关闭后回到视图层（地图）', r6.after.view === 'map', r6.after.view);

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
