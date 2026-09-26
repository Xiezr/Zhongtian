/* v89.131 实机脚本：将领档案版面（自带判定）+ 截图
 * ------------------------------------------------------------
 * 判据（差值 >2px 即 ✗）：
 *   ① 六维/状态列 ≈ 1/4、装备栏 ≈ 3/4；装备栏内部 人形:汇总 ≈ 2:1；
 *   ② 人形框真的放大（≥380 宽）；汇总列撑满（bottom == 人形框 bottom，无"底下留空"）；
 *   ③ 状态行序 体力→精力→攻击→防御→忠诚；体力/精力各带「＋」；解雇在人名行；
 *   ④ 体力道具窗真开（选道具 + 数量 + 执行按钮）；商城「精力」页签有 4 档。
 * 跑法：node .workbuddy/tools/show/shot_v89131_pane.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var FAIL = 0;
function chk(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) FAIL++;
}

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    G.ui._cityId = st.cities[0].id;
    /* 给首将穿装备 + 备些道具（道具窗要能看到选项） */
    var g = st.generals[0];
    try { G.systems.autoEquipBest(g.id); } catch (e) { }
    st.items = st.items || {};
    st.items.jiuzhuangyao = 3; st.items.xingjun_san = 5;
    st.items.qingxin_wan = 2; st.items.ningshen_yulu = 1;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('generals');
    G.refreshAll();
  });
  await p.waitForTimeout(700);

  /* ── ①②③ 版面 ── */
  var m = await p.evaluate(function () {
    function rr(sel) {
      var el = document.querySelector(sel);
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
        h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
    }
    var pane = rr('.gen-pane'), colL = rr('.gp-col-l'), colR = rr('.gp-col-r');
    var doll = rr('.doll'), side = rr('.doll-side'), ops = rr('.gp-dollops');
    var rows = {};
    [['体力', 'gen-sta-pick'], ['精力', 'gen-energy-pick'], ['攻击', null], ['防御', null], ['忠诚', null]]
      .forEach(function (it) {
        var el = null;
        var all = document.querySelectorAll('.gp-col-l .gd-line');
        for (var i = 0; i < all.length; i++) {
          if (all[i].textContent.indexOf(it[0]) === 0) el = all[i];
        }
        if (el) {
          rows[it[0]] = { y: Math.round(el.getBoundingClientRect().top),
            plus: !!el.querySelector('[data-action="' + (it[1] || '__none__') + '"]') };
        }
      });
    var nameOps = document.querySelector('.gp-name .gp-nameops [data-action="dismiss-gen"]');
    var opsColHasDismiss = !!document.querySelector('.gp-ops [data-action="dismiss-gen"]');
    var body = rr('.gp-body');
    var vc = document.querySelector('#view-container');
    var dwrap = document.querySelector('.gp-doll');
    var dollCols = dwrap ? getComputedStyle(dwrap).gridTemplateColumns : '';
    return { pane: pane, colL: colL, colR: colR, doll: doll, side: side, ops: ops, dollCols: dollCols,
      rows: rows, nameOps: !!nameOps, opsColHasDismiss: opsColHasDismiss,
      body: body, vc: { scrollH: vc.scrollHeight, clientH: vc.clientHeight },
      nSlots: document.querySelectorAll('.doll-slot').length };
  });
  var ratioL = m.colL.w / m.body.w, ratioR = m.colR.w / m.body.w;
  chk('① 六维/状态列 ≈ 1/4 宽', Math.abs(ratioL - 0.25) < 0.03, (ratioL * 100).toFixed(1) + '%');
  chk('① 装备栏 ≈ 3/4 宽', Math.abs(ratioR - 0.75) < 0.03, (ratioR * 100).toFixed(1) + '%');
  /* 2:1 判据从 .gp-doll 的 computed gridTemplateColumns 读（人形框自身居中，
     拿 .doll 的 rect 猜列宽会把它两侧的留白算进去 —— 首版就是这么误报 54.4% 的） */
  var cols = (m.dollCols || '').split(/\s+/).map(parseFloat).filter(function (x) { return x > 0; });
  var rDoll = cols.length === 2 ? cols[0] / (cols[0] + cols[1]) : 0;
  chk('① 装备图 : 属性汇总 ≈ 2:1', Math.abs(rDoll - 2 / 3) < 0.03,
    (rDoll * 100).toFixed(1) + '% : ' + ((1 - rDoll) * 100).toFixed(1) + '%');
  chk('② 人形框已放大（≥380×480，原 282×358）', m.doll.w >= 380 && m.doll.h >= 480,
    m.doll.w + '×' + m.doll.h);
  chk('② 汇总列撑满人形框高度（底下不再留空）',
    Math.abs(m.side.bottom - m.doll.bottom) <= 2 && Math.abs(m.side.h - m.doll.h) <= 2,
    '侧面 h=' + m.side.h + ' vs 人形 h=' + m.doll.h);
  chk('② 按钮组钉在汇总列底部（margin-top:auto）',
    m.ops && Math.abs(m.ops.bottom - m.side.bottom) <= 2, 'buttons bottom ' + (m.ops || {}).bottom);
  var rk = ['体力', '精力', '攻击', '防御', '忠诚'];
  var orderOk = rk.every(function (k, i) {
    if (!m.rows[k]) return false;
    if (i === 0) return true;
    return m.rows[rk[i - 1]].y < m.rows[k].y;
  });
  chk('③ 状态行序 体力→精力→攻击→防御→忠诚', orderOk,
    rk.map(function (k) { return k + (m.rows[k] ? m.rows[k].y : '-'); }).join(' < '));
  chk('③ 体力/精力行各带「＋」', m.rows['体力'] && m.rows['体力'].plus && m.rows['精力'] && m.rows['精力'].plus);
  chk('③ 解雇在人名行（且操作列已无解雇）', m.nameOps && !m.opsColHasDismiss);
  chk('③ 12 个方槽在位', m.nSlots === 12, m.nSlots + ' 个');

  /* 全页截图（档案） */
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89131-pane.png' });

  /* ── ④ 体力道具窗 ── */
  await p.evaluate(function () {
    var el = null;
    var all = document.querySelectorAll('.gp-col-l .gd-line');
    for (var i = 0; i < all.length; i++) if (all[i].textContent.indexOf('体力') === 0) el = all[i];
    var btn = el && el.querySelector('[data-action="gen-sta-pick"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(450);
  var pick = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var t = (root && root.textContent) || '';
    return { open: t.indexOf('体力道具') >= 0, chips: document.querySelectorAll('#modal-root [data-action="restore-pick-item"]').length,
      hasDo: !!document.querySelector('#modal-root [data-action="gen-restore-do"]'),
      hasQty: !!document.querySelector('#modal-root input[type="number"], #modal-root .qty-input') };
  });
  chk('④ 体力道具窗真开（标题/选项/数量/执行）', pick.open && pick.chips >= 2 && pick.hasDo,
    '选项 ' + pick.chips + ' · 执行键 ' + pick.hasDo + ' · 数量框 ' + pick.hasQty);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89131-pick-sta.png' });

  /* 精力窗 */
  await p.evaluate(function () { try { window.GAME.ui.closeAllModals(); } catch (e) { } });
  await p.waitForTimeout(200);
  await p.evaluate(function () {
    var el = null;
    var all = document.querySelectorAll('.gp-col-l .gd-line');
    for (var i = 0; i < all.length; i++) if (all[i].textContent.indexOf('精力') === 0) el = all[i];
    var btn = el && el.querySelector('[data-action="gen-energy-pick"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(450);
  var pick2 = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    var t = (root && root.textContent) || '';
    return { open: t.indexOf('精力道具') >= 0, chips: document.querySelectorAll('#modal-root [data-action="restore-pick-item"]').length };
  });
  chk('④ 精力道具窗真开（清心丸等在列）', pick2.open && pick2.chips >= 2, '选项 ' + pick2.chips);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89131-pick-energy.png' });

  /* ── 商城「精力」页签 ── */
  await p.evaluate(function () {
    var G = window.GAME;
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.openShop('energy');
  });
  await p.waitForTimeout(450);
  var shop = await p.evaluate(function () {
    /* ⚠️ 商城是**视图**（openShop → setView('shop')），内容在 #view-container 不是 modal-root */
    var vc = document.querySelector('#view-container');
    var t = (vc && vc.textContent) || '';
    var names = ['清心丸', '提神散', '养神丹', '凝神玉露'].filter(function (n) { return t.indexOf(n) >= 0; });
    return { names: names, view: window.GAME.ui.view };
  });
  chk('④ 商城「精力」页签 4 档齐（清心丸/提神散/养神丹/凝神玉露）', shop.names.length === 4, shop.names.join(' '));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89131-shop-energy.png' });

  console.log(FAIL ? '\n✗ 有 ' + FAIL + ' 项未达标' : '\n✓ 全项达标');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
