/* v89.160 实机验证（真浏览器）：
   ① 仓库面板真渲染「逾溢折损」规则 + 当前超出上限（图 v89160-store-rot.png）
   ② 真跑 1 游戏日 → 公文出灾种行（图 v89160-rot-log.png）
   ③ 自动化面板真渲染新文案（图 v89160-auto-pane.png）
   ④ 真环境顺延：贵项在前也不挡路（铁匠铺 → 民房）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89160_two.js */
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
    G.newGame({ name: '验160', cityName: '许都', region: '豫州', mapSeed: 20260960 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.currentCity();
    /* 起一座仓库，让仓容有实际值；再把粮顶到上限之上 */
    for (var i = 0; i < c.cells.length; i++) {
      if (!c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: 'cangku', lvl: 3 }; break; }
    }
    c.res.grain = G.storeCapOf(c) + 320000;
    c.res.iron = G.storeCapOf(c) + 88000;
  });
  await p.waitForTimeout(900);

  async function clipOf(sel, pad) {
    return p.evaluate(function (s) {
      var el = document.querySelector(s);
      if (!el) return null;
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return null;
      return { x: Math.max(0, r.left - (s._pad || 0)), y: Math.max(0, r.top - 6), w: Math.min(r.width + 8, 1590), h: Math.min(r.height + 14, 990) };
    }, sel);
  }

  console.log('===== ① 仓库面板 · 逾溢折损规则 =====');
  var r1 = await p.evaluate(function () {
    window.GAME.ui.openStore();
    var m = document.querySelector('#modal-root').innerHTML;
    return { hit: m.indexOf('逾溢折损') >= 0, now: m.indexOf('当前超出上限') >= 0, pct: m.indexOf('游戏日折损 25%') >= 0 };
  });
  await p.waitForTimeout(600);
  chk('仓库面板含「逾溢折损 / 游戏日折损 25% / 当前超出上限」', r1.hit && r1.now && r1.pct);
  var rc = await clipOf('#modal-root .modal');
  if (rc) {
    await p.screenshot({ path: OUT + 'v89160-store-rot.png', clip: { x: rc.x, y: rc.y, width: rc.w, height: r1.hit ? Math.min(rc.h, 520) : rc.h } });
    console.log('    📷 v89160-store-rot.png  ' + Math.round(rc.w) + '×' + Math.round(rc.h));
  }
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  console.log('===== ② 真跑 1 游戏日 → 公文灾种行 =====');
  var r2 = await p.evaluate(function () {
    var G = window.GAME, st = G.state, c = G.currentCity();
    if (st.overflowAt == null) G.settleOverflowRot();
    st.overflowAt = st.world.elapsed;
    st.world.elapsed += 86400;
    c.res.grain = G.storeCapOf(c) + 320000;
    c.res.iron = G.storeCapOf(c) + 88000;
    G.tickOnce();
    var L = st.msgLog || [];
    var msg = (L[L.length - 1] || {}).msg || '';
    st.msgLog.forEach(function (x) { if (/损失/.test(x.msg || '')) msg = x.msg; });
    window.__rot160 = msg;
    G.ui._docTab = 'sys'; G.ui.setView('reports'); G.ui.renderView('reports');
    return { msg: msg };
  });
  console.log('    公文行 = ' + r2.msg);
  chk('公文出现灾种 + 逐项损失（粮/铁）', /损失/.test(r2.msg) && /粮食/.test(r2.msg) && /铁/.test(r2.msg));
  await p.waitForTimeout(800);
  var r2b = await p.evaluate(function () {
    var out = null;
    var all = document.querySelectorAll('#view-container *');
    for (var i = 0; i < all.length && !out; i++) {
      var t = all[i].textContent || '';
      if (t.indexOf('仓廪逾溢') >= 0 && t.length < 160) {
        var rc = all[i].getBoundingClientRect();
        if (rc.height > 6) out = { x: rc.left, y: rc.top, w: rc.width, h: rc.height };
      }
    }
    return out;
  });
  if (r2b) {
    await p.screenshot({ path: OUT + 'v89160-rot-log.png',
      clip: { x: Math.max(0, r2b.x - 200), y: Math.max(0, r2b.y - 22), width: 1000, height: Math.max(90, r2b.h + 44) } });
    console.log('    📷 v89160-rot-log.png');
  } else { console.log('    （未定位到公文行，跳图）'); }

  console.log('===== ③ 自动化面板 · 新文案 =====');
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('auto'); G.ui._autoSel = 'upgrade'; G.ui.renderView('auto');
    var t = (document.querySelector('#view-container') || {}).textContent || '';
    return { hit: t.indexOf('顺延试下一项') >= 0, noInside: t.indexOf('城内优先') < 0 };
  });
  await p.waitForTimeout(700);
  chk('自动化面板写明「某项资源不足就顺延试下一项」且不再有「城内优先」', r3.hit && r3.noInside);
  var r3b = await p.evaluate(function () {
    var el = document.querySelector('.auto-pane .auto-note') || document.querySelector('.auto-note');
    if (!el) return null;
    var rc = el.getBoundingClientRect();
    return { x: rc.left, y: rc.top, w: rc.width, h: rc.height };
  });
  if (r3b && r3b.h > 8) {
    await p.screenshot({ path: OUT + 'v89160-auto-pane.png',
      clip: { x: Math.max(0, r3b.x - 12), y: Math.max(0, r3b.y - 12), width: Math.min(r3b.w + 24, 1400), height: Math.min(r3b.h + 24, 400) } });
    console.log('    📷 v89160-auto-pane.png');
  }

  console.log('===== ④ 真环境顺延（贵项在前 → 命中便宜项） =====');
  var r4 = await p.evaluate(function () {
    var G = window.GAME, st = G.state, c = G.currentCity();
    var bkQ = (st.queues.build || []).slice();
    c.cells.forEach(function (x) { if (x.build && x.build.id !== 'guanfu') x.build = null; });
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
    G.extGridOf(c).forEach(function (e) { e.type = null; e.lv = 0; e.pending = null; });
    c.cells[0].build = { id: 'tiejiangpu', lvl: 1 };
    c.cells[1].build = { id: 'minfang', lvl: 1 };
    if (G.wallSlotOf(c).build) G.wallSlotOf(c).build = null;
    var cm = G.DATA.BUILDINGS.minfang.levelCost(1);
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = cm[k] || 0; });
    st.settings.autoUpgrade = true;
    st.queues.build = [];
    var r = G.autoUpgrade();
    st.queues.build = bkQ;
    c.cells.forEach(function (x) { x.pending = null; });
    return { ok: !!(r && r.ok), name: (r && r.target && r.target.name) || '', idx: (r && r.target && r.target.idx) };
  });
  chk('顺延过铁匠铺（idx0）· 命中民房（idx1）', r4.ok && r4.idx === 1 && /民房/.test(r4.name), JSON.stringify(r4));

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
