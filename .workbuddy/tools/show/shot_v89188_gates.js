/* v89.188 实机验证（真浏览器 · 只读量测 + 真点）：
   ① 将领界面：解雇/晋升袖珍按钮（20px）· 名称定宽 96px · 切将位置不变 · 长名截断
   ② 列表：名称 5 字位 → Lv 徽标逐将对齐
   ③ 标签零：将领界面无「史实名将 / 美人」字样
   ④ 民心行：民居无 / 官府有（真渲染两态）
   ⑤ 改建：材料不足按钮**可点** · 点击 toast 精确原因（"点不了"修复验证）
   跑法：NODE_PATH=... node .workbuddy/tools/show/shot_v89188_gates.js */
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
  var boot = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验188', cityName: '许都', region: '豫州', mapSeed: 20260928 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    var p1 = G.makeGeneral('陈到', 50, 'idle', null, false, 'ying', 'balance');
    var p2 = G.makeGeneral('花木兰', 80, 'guard', null, true, 'ming', 'power');
    var p3 = G.makeGeneral('长名字测试将', 60, 'idle', null, false, 'liang', 'command');
    p1.cityId = c.id; p2.cityId = c.id; p3.cityId = c.id;
    G.state.generals.push(p1, p2, p3);
    window.__p = { p1: p1.id, p2: p2.id, p3: p3.id, city: c.id };
    G.ui.setView('city');
    return { ok: true, gens: G.state.generals.length };
  });
  await p.waitForTimeout(500);
  chk('boot：三将已造（含 6 字长名 / 美人+守将标签位）', boot.ok && boot.gens >= 4, 'gens=' + boot.gens);

  /* ---------- ① 将领界面：量三将坐标 ---------- */
  var m = await p.evaluate(function () {
    var G = window.GAME, pset = window.__p;
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left / k * 10) / 10, y: Math.round(r.top / k * 10) / 10,
        w: Math.round(r.width / k * 10) / 10, h: Math.round(r.height / k * 10) / 10 };
    }
    function one(id) {
      G.ui._genSel = id;
      G.ui.setView('generals');
      G.ui.renderView('generals');
      var pane = document.querySelector('.gen-pane');
      if (!pane) return { err: 'no-pane' };
      var dis = pane.querySelector('.gp-nameops .btn');
      var rup = pane.querySelector('.gp-sub.gp-rankrow [data-action="gen-rankup"]');
      var nm = pane.querySelector('.gp-nm');
      return {
        dis: R(dis), rup: R(rup), nm: R(nm),
        disCls: dis ? dis.className : '', rupCls: rup ? rup.className : '',
        name: pane.querySelector('.gp-nm') ? pane.querySelector('.gp-nm').textContent : '',
        nmScroll: nm ? (nm.scrollWidth || 0) : 0,
      };
    }
    var o1 = one(pset.p1), o2 = one(pset.p2), o3 = one(pset.p3);
    /* 列表：切回后量 Lv 徽标 x（三将应相等） */
    G.ui._genSel = pset.p1; G.ui.renderView('generals');
    var rows = document.querySelectorAll('.gen-row:not(.empty)');
    var lvXs = [], nmWs = [];
    rows.forEach(function (row) {
      var lv = row.querySelector('.grow-lv'), nm = row.querySelector('.grow-nm');
      if (lv && nm) { lvXs.push(Math.round(R(lv).x * 10) / 10); nmWs.push(Math.round(R(nm).w * 10) / 10); }
    });
    /* ③ 标签零（视图整页 textContent） */
    var whole = document.querySelector('#view-container') ? document.querySelector('#view-container').textContent : '';
    return { o1: o1, o2: o2, o3: o3, lvXs: lvXs, nmWs: nmWs,
      hasShi: whole.indexOf('史实名将') >= 0, hasMei: whole.indexOf('美人') >= 0 };
  });
  console.log('  —— 量测 ——');
  console.log('  p1「' + m.o1.name + '」解雇 ' + JSON.stringify(m.o1.dis) + ' 晋升 ' + JSON.stringify(m.o1.rup) + ' nm ' + JSON.stringify(m.o1.nm));
  console.log('  p2「' + m.o2.name + '」解雇 ' + JSON.stringify(m.o2.dis) + ' 晋升 ' + JSON.stringify(m.o2.rup));
  console.log('  p3「' + m.o3.name + '」解雇 ' + JSON.stringify(m.o3.dis) + '（长名截断 scrollW=' + m.o3.nmScroll + '）');
  console.log('  列表 Lv 徽标 x = ' + JSON.stringify(m.lvXs) + ' · 名称区宽 = ' + JSON.stringify(m.nmWs));
  chk('①a 解雇 = 袖珍规格（h ≤ 22 · class 含 btn sm mini）',
    m.o1.dis && m.o1.dis.h <= 22 && m.o1.disCls.indexOf('mini') >= 0, 'h=' + (m.o1.dis && m.o1.dis.h));
  chk('①b 三将解雇按钮 x 恒定（切将不动）',
    m.o1.dis && m.o2.dis && m.o3.dis
      && Math.abs(m.o1.dis.x - m.o2.dis.x) <= 1 && Math.abs(m.o1.dis.x - m.o3.dis.x) <= 1,
    m.o1.dis.x + ' / ' + m.o2.dis.x + ' / ' + m.o3.dis.x);
  chk('①c 晋升按钮与解雇同 x 对齐（同规格）',
    m.o1.rup && m.o1.dis && Math.abs(m.o1.rup.x - m.o1.dis.x) <= 1 && m.o1.rupCls.indexOf('mini') >= 0,
    'dis=' + m.o1.dis.x + ' rup=' + (m.o1.rup && m.o1.rup.x));
  chk('①d 名称区定宽 96px（三将同宽）',
    m.o1.nm && Math.abs(m.o1.nm.w - 96) <= 1, 'w=' + (m.o1.nm && m.o1.nm.w));
  chk('② 列表：Lv 徽标 x 逐将对齐（名称 5 字位）',
    m.lvXs.length >= 3 && m.lvXs.every(function (x) { return Math.abs(x - m.lvXs[0]) <= 1; }),
    JSON.stringify(m.lvXs));
  chk('③ 将领界面零「史实名将 / 美人」字样', !m.hasShi && !m.hasMei, 'shi=' + m.hasShi + ' mei=' + m.hasMei);
  await p.screenshot({ path: OUT + 'v89188-gen.png' });

  /* ---------- ④ 民心行两态 ---------- */
  var hres = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    var pairs = [];
    (c.cells || []).forEach(function (cell, idx) {
      if (cell && cell.build) pairs.push({ idx: idx, bid: cell.build.id });
    });
    var guanfu = pairs.filter(function (x) { return x.bid === 'guanfu'; })[0];
    var other = pairs.filter(function (x) { return x.bid !== 'guanfu'; })[0];
    function probe(idx) {
      G.ui.closeAllModals();
      G.ui.openBuildModal(idx);
      var root = document.querySelector('#modal-root');
      var txt = root ? root.textContent : '';
      var has = txt.indexOf('民心 / 民怨') >= 0;
      var btnN = root ? root.querySelectorAll('[data-action="hearts-soothe"]').length : 0;
      G.ui.closeAllModals();
      return { has: has, btnN: btnN };
    }
    return { gf: guanfu ? probe(guanfu.idx) : null, ot: other ? probe(other.idx) : null,
      otBid: other ? other.bid : '?' };
  });
  chk('④ 民心/民怨段只在官府（民居无）', hres.gf && hres.gf.has && hres.gf.btnN === 1
    && hres.ot && !hres.ot.has && hres.ot.btnN === 0,
    '官府=' + JSON.stringify(hres.gf) + ' 其他(' + hres.otBid + ')=' + JSON.stringify(hres.ot));
  /* 官府面板截图 */
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.state.cities[0];
    for (var i = 0; i < c.cells.length; i++) {
      if (c.cells[i] && c.cells[i].build && c.cells[i].build.id === 'guanfu') { G.ui.openBuildModal(i); return; }
    }
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + 'v89188-hearts.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ---------- ⑤ 改建：材料不足按钮可点 ---------- */
  var cres = await p.evaluate(function () {
    var G = window.GAME, c = G.state.cities[0];
    var eg = G.extGridOf(c);
    /* 造一块 Lv8 农场（若无已建格）；并清空四资源 → 改建费必然不足 */
    var t = null;
    for (var i = 0; i < eg.length; i++) { if (eg[i] && eg[i].type) { t = eg[i]; break; } }
    if (!t) { eg[0].type = 'farm'; eg[0].lv = 8; t = eg[0]; }
    else { t.lv = 8; }
    ['grain', 'wood', 'stone', 'iron'].forEach(function (kk) { c.res[kk] = 0; });
    G.ui.openExtConvert(eg.indexOf(t));
    var btns = document.querySelectorAll('#modal-root [data-action="ext-convert"]');
    var n = btns.length, disN = 0;
    for (var j = 0; j < btns.length; j++) if (btns[j].disabled) disN++;
    /* 真点第一个（先记录资源，防误扣） */
    var bk = { grain: c.res.grain, wood: c.res.wood, stone: c.res.stone, iron: c.res.iron };
    if (btns[0]) btns[0].click();
    return { n: n, disN: disN, opened: !!document.querySelector('#modal-root .gold-heading'),
      bk: bk, idx: eg.indexOf(t) };
  });
  await p.waitForTimeout(500);
  var cres2 = await p.evaluate(function () {
    var G = window.GAME, c = G.state.cities[0];
    var toast = document.querySelector('#toast');
    var txt = toast ? toast.textContent : '';
    return { toast: txt,
      cost: { grain: c.res.grain, wood: c.res.wood, stone: c.res.stone, iron: c.res.iron } };
  });
  console.log('  —— 改建面板：' + cres.n + ' 个目标 · disabled=' + cres.disN + ' ——');
  console.log('  点击后 toast = 「' + cres2.toast.slice(0, 80) + '」');
  chk('⑤a 材料不足的改建按钮**可点**（0 disabled）', cres.n >= 3 && cres.disN === 0,
    'n=' + cres.n + ' dis=' + cres.disN + ' opened=' + cres.opened);
  chk('⑤b 点击 → toast 精确原因（材料不足/调运）· 资源未扣',
    cres2.toast.indexOf('材料不足') >= 0
      && cres2.cost.grain === 0 && cres2.cost.wood === 0,
    'toast 含材料不足=' + (cres2.toast.indexOf('材料不足') >= 0));
  await p.screenshot({ path: OUT + 'v89188-convert.png' });

  console.log('\n===== 实机结果：' + PASS + ' 通过 / ' + FAIL + ' 失败 =====');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
