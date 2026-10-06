/* ============================================================
 * shot_v89108_cap_inn.js — v89.108 实机图（两条需求）
 *   ① 城池弹窗：达上限 →「占领」置灰 + 理由条（侦查/掠夺照常）
 *   ② 出征面板：方式下拉「占领」置灰带原因（从侦查进入）
 *   ③ 爵位页：城池（领地上限）2/2
 *   ④⑤ 客栈对比：主城 Lv6 → 6 位候选 ／ 分城 Lv2 → 2 位候选
 * 顺带量：按钮 disabled、dropdown option disabled、候选行数、溢出
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260923 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; st.res[k] = 9e6; });
    c.res.pop = 42000;
    /* 找平原建分城（首城 1 + 新城 = 2 = 平民领地上限，正好摆出"到顶"现场） */
    var w = null;
    for (var r = 1; r <= 6 && !w; r++) {
      for (var dx = -r; dx <= r && !w; dx++) for (var dy = -r; dy <= r && !w; dy++) {
        var t = G.map.tile(c.x + dx, c.y + dy);
        if (!t || t.terrain !== 'plain') continue;
        if (st.cities.some(function (x2) { return x2.x === c.x + dx && x2.y === c.y + dy; })) continue;
        w = { x: c.x + dx, y: c.y + dy };
      }
    }
    var built = null;
    if (w) {
      st.wilds = (st.wilds || []).filter(function (x2) { return !(x2.x === w.x && x2.y === w.y); });
      st.wilds.push({ x: w.x, y: w.y, type: 'plain', lv: 3 });
      built = G.buildCityAt(w.x, w.y);
    }
    if (!built || !built.ok) return { err: '建分城失败' };
    var cB = built.city;
    cB.name = '分城';
    /* 客栈等级：主城 6（=6 位候选）／ 分城 2（=2 位候选）；招贤馆都给 3 席 */
    function setB(city, bid, lv) {
      for (var i = 0; i < city.cells.length; i++) {
        var x = city.cells[i];
        if (x.official) continue;
        if (x.build && x.build.id !== bid) continue;
        if (x.build && x.build.id === bid) { x.build.lvl = lv; return true; }
        x.build = { id: bid, lvl: lv };
        return true;
      }
      return false;
    }
    setB(c, 'kezhan', 6); setB(c, 'zhaoxianguan', 3); setB(c, 'guanfu', 3);
    setB(cB, 'kezhan', 2); setB(cB, 'zhaoxianguan', 3); setB(cB, 'guanfu', 3);
    G.ui.enterGame();
    G.refreshAll();
    return {
      cities: st.cities.length, cap: G.cityCapOf(), rank: (G.DATA.RANK[st.rank] || {}).name,
      mainId: c.id, splitId: cB.id, cName: c.name, bName: cB.name,
    };
  });
  if (boot.err) { console.log('✗ ' + boot.err); await browser.close(); process.exit(1); }
  console.log('开局：' + boot.cities + ' 城（' + boot.cName + ' / ' + boot.bName + '）· 爵位「' + boot.rank
    + '」· 领地上限 ' + boot.cap + ' 座 → 已达顶');

  /* ① 城池弹窗：占领置灰 */
  var m1 = await page.evaluate(function () {
    var npc = (GAME.state.map.cities || [])[0];
    GAME.ui.openAttackModal(npc);
    var btn = document.querySelector('[data-action="exp-open"][data-mode="occupy"]');
    var warn = document.querySelector('#modal-root .note-warn');
    return { npc: npc.name, disabled: !!(btn && btn.disabled), warn: warn ? warn.textContent : '' };
  });
  await new Promise(function (r) { setTimeout(r, 260); });
  await page.screenshot({ path: path.join(OUT, 'v89108-city-modal.png') });
  console.log('✓ v89108-city-modal.png（' + m1.npc + '：「占领」置灰 ' + m1.disabled + ' · 提示「' + m1.warn.slice(0, 44) + '…」）');

  /* ② 出征面板：方式下拉「占领」置灰（从侦查进入，保持真实操作流） */
  var m2 = await page.evaluate(function () {
    GAME.doOpenExp('city', 'scout');
    var opt = document.querySelector('#exp-mode option[value="occupy"]');
    return { disabled: !!(opt && opt.disabled), text: opt ? opt.textContent : '' };
  });
  await new Promise(function (r) { setTimeout(r, 300); });
  await page.screenshot({ path: path.join(OUT, 'v89108-exp-modal.png') });
  console.log('✓ v89108-exp-modal.png（方式下拉「占领」置灰 ' + m2.disabled + ' · 「' + m2.text.slice(0, 56) + '」）');

  /* ③ 爵位页：城池（领地上限） */
  var m3 = await page.evaluate(function () {
    GAME.ui.closeModal();
    GAME.ui.setView('rank');
    var tx = document.querySelector('#view-container').textContent || '';
    return {
      hasCap: tx.indexOf('城池（领地上限）') >= 0,
      hit: (tx.match(/城池（领地上限）[^声]*/) || [''])[0].slice(0, 30),
    };
  });
  await new Promise(function (r) { setTimeout(r, 260); });
  await page.screenshot({ path: path.join(OUT, 'v89108-rank-page.png') });
  console.log('✓ v89108-rank-page.png（含「城池（领地上限）」' + m3.hasCap + ' · ' + m3.hit.trim() + '）');

  /* ④ 客栈：主城 Lv6 → 6 位 */
  var m4 = await page.evaluate(function (ids) {
    GAME.ui._cityId = ids.mainId;
    GAME.ui.openInn();
    var rows = document.querySelectorAll('.inn-tbl tbody tr').length;
    var sub = document.querySelector('#modal-root .m-sub');
    return { rows: rows, sub: sub ? sub.textContent : '' };
  }, boot);
  await new Promise(function (r) { setTimeout(r, 260); });
  await page.screenshot({ path: path.join(OUT, 'v89108-inn-main.png') });
  console.log('✓ v89108-inn-main.png（主城客栈 Lv6 → ' + m4.rows + ' 位候选）');

  /* ⑤ 客栈：分城 Lv2 → 2 位（老板投诉的场景） */
  var m5 = await page.evaluate(function (ids) {
    GAME.ui.closeModal();
    GAME.ui._cityId = ids.splitId;
    GAME.ui.openInn();
    var rows = document.querySelectorAll('.inn-tbl tbody tr').length;
    return { rows: rows };
  }, boot);
  await new Promise(function (r) { setTimeout(r, 260); });
  await page.screenshot({ path: path.join(OUT, 'v89108-inn-split.png') });
  console.log('✓ v89108-inn-split.png（分城客栈 Lv2 → ' + m5.rows + ' 位候选）');

  var ok = m1.disabled && m2.disabled && m3.hasCap && m4.rows === 6 && m5.rows === 2;
  console.log(ok ? '\n全部实机判据通过（置灰 2 处 · 上限显示 1 处 · 候选 6/2）' : '\n⚠ 有判据未过，请查看上方');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(function (e) { console.error('脚本异常：', e); process.exit(1); });
