/* v89.187 实机验证（真浏览器）：
   ① 宝具品质徽标 + 合成区（选择窗内）
   ② 合成真点：2 低 → 1 中（库存守恒 · 列表刷新）
   ③ 据点情报：野地面板「🔭 侦查」旁出现「🏯 据点情报」按钮（覆盖内）· 点击弹窗含守军明细/守将
   ④ 覆盖半径 10：面板文案动态 + 边界行为
   跑法：NODE_PATH=... node .workbuddy/tools/show/shot_v89187_gates.js */
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
    G.newGame({ name: '验187', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    /* 造宝具库存：低×2（玉犀符）+ 低×2（铜雀令）+ 中×2（八卦羽扇） */
    G.state.items = G.state.items || {};
    G.state.items['bao_yuxi'] = 2;
    G.state.items['bao_tongque'] = 2;
    G.state.items['bao_yushan'] = 2;
    G.ui.setView('city');
    if (G.ui.renderSide) G.ui.renderSide();
    G.ui.closeAllModals();
  });
  await p.waitForTimeout(700);

  /* ① 打开挂件选择窗（将领面板 → 佩上） */
  var w1 = await p.evaluate(function () {
    var G = window.GAME, g = G.state.generals[0];
    G.ui.openGenEquip(g.id);
    var btn = document.querySelector('.gp-attach186 [data-action="attach-pick"]');
    if (btn) btn.click();
    return { opened: !!document.querySelector('#modal-root .gold-heading') };
  });
  await p.waitForTimeout(400);
  var w1b = await p.evaluate(function () {
    var txt = document.querySelector('#modal-root').textContent;
    var badges = document.querySelectorAll('#modal-root .xc-row b span[style*="font-weight"]');
    var fuseBtn = document.querySelectorAll('#modal-root [data-action="bao-fuse"]');
    return { hasQ: txt.indexOf('〔低〕') >= 0 && txt.indexOf('〔中〕') >= 0,
      badgeN: badges.length, hasFuse: txt.indexOf('宝具合成') >= 0, fuseBtnN: fuseBtn.length,
      hasLine: /低 ×\d+ → 中/.test(txt.replace(/\s+/g, ' ')) };
  });
  chk('① 选择窗：品质徽标（〔低〕〔中〕）+ 合成区（低→中 · 中→高）+ 合成按钮',
    w1.opened && w1b.hasQ && w1b.badgeN >= 3 && w1b.hasFuse && w1b.fuseBtnN >= 1 && w1b.hasLine,
    'badges=' + w1b.badgeN + ' fuseBtn=' + w1b.fuseBtnN);
  await p.screenshot({ path: OUT + 'v89187-fuse.png' });

  /* ② 真点「合成」（低→中）：低 4→2 · 中 2→3（+1 件） */
  var w2 = await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="bao-fuse"][data-q="low"]');
    if (!btn) return { err: 'no-btn' };
    var G = window.GAME;
    var low0 = G.baojuCountQOf('low').n, mid0 = G.baojuCountQOf('mid').n;
    btn.click();
    var low1 = G.baojuCountQOf('low').n, mid1 = G.baojuCountQOf('mid').n;
    var txt = document.querySelector('#modal-root').textContent;
    return { low0: low0, mid0: mid0, low1: low1, mid1: mid1,
      refreshed: /低 ×\d+ → 中/.test(txt.replace(/\s+/g, ' ')) };
  });
  chk('② 合成真点：低 4→2 · 中 2→3（2 → 1 守恒）· 列表已刷新',
    !w2.err && w2.low0 === 4 && w2.low1 === 2 && w2.mid1 === w2.mid0 + 1 && w2.refreshed,
    'low ' + w2.low0 + '→' + w2.low1 + ' mid ' + w2.mid0 + '→' + w2.mid1);
  await p.screenshot({ path: OUT + 'v89187-fuse2.png' });

  /* ③ 据点情报：造前哨 → 野地面板出现按钮（侦查旁）→ 真点 → 弹窗明细 */
  var w3 = await p.evaluate(function () {
    var G = window.GAME, c = G.state.cities[0];
    G.ui.closeAllModals();
    var hit = null;
    for (var r = 2; r <= 14 && !hit; r++) {
      for (var dy = -r; dy <= r && !hit; dy++) for (var dx = -r; dx <= r && !hit; dx++) {
        var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
        if (!tl || tl.terrain !== 'plain') continue;
        if (G.map.wildAt(x, y)) continue;
        if (G.map.fortAt(x, y)) continue;
        hit = { x: x, y: y };
      }
    }
    if (!hit) return { err: 'no-target' };
    G.state.forts = {};      /* 先无覆盖：按钮不该有 */
    G.ui.openLandModal(hit.x, hit.y);
    var noBtn = !document.querySelector('#modal-root [data-action="wild-fortintel"]');
    G.ui.closeAllModals();
    G.state.forts = { 'a': { x: hit.x + 1, y: hit.y, lv: 3, name: '前哨甲' } };   /* 距离 1 → 覆盖内 */
    G.ui.openLandModal(hit.x, hit.y);
    var btn = document.querySelector('#modal-root [data-action="wild-fortintel"]');
    /* 位置：紧跟在「🔭 侦查」之后（老板指定"侦查按钮旁边"） */
    var btns = Array.prototype.slice.call(document.querySelectorAll('#modal-root .btn.gold'));
    var order = btns.map(function (x) { return x.getAttribute('data-action'); });
    var scoutIdx = order.indexOf('exp-open'), intelIdx = order.indexOf('wild-fortintel');
    return { hit: hit, noBtn: noBtn, hasBtn: !!btn,
      adjacent: scoutIdx >= 0 && intelIdx === scoutIdx + 1,
      order: order.join('>') };
  });
  chk('③a 野地面板：无覆盖时无按钮 · 覆盖内出现「🏯 据点情报」且紧邻「🔭 侦查」',
    !w3.err && w3.noBtn && w3.hasBtn && w3.adjacent, (w3.order || '').slice(0, 70));
  if (!w3.err) {
    var w3b = await p.evaluate(function () {
      var btn = document.querySelector('#modal-root [data-action="wild-fortintel"]');
      if (btn) btn.click();
      var txt = document.querySelector('#modal-root').textContent.replace(/\s+/g, ' ');
      var G = window.GAME;
      return { txt: txt.slice(0, 200),
        hasTitle: txt.indexOf('据点情报') >= 0,
        hasArmy: txt.indexOf('守军明细') >= 0,
        hasGen: txt.indexOf('守将') >= 0,
        hasPre: txt.indexOf('前哨甲') >= 0 };
    });
    await p.waitForTimeout(300);
    chk('③b 情报弹窗：守军明细 + 守将块 + 来源前哨',
      w3b.hasTitle && w3b.hasArmy && w3b.hasGen && w3b.hasPre, (w3b.txt || '').slice(0, 120));
    await p.screenshot({ path: OUT + 'v89187-intel.png' });
  }

  /* ④ 半径 10 文案 + 边界 */
  var w4 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state, bk = st.forts;
    var ok = ((G.DATA.FORT_AURA || {}).radius === 10);
    st.forts = { '20,20': { x: 20, y: 20, lv: 3, name: '甲' } };
    var inB = !!G.fortAuraAt(30, 20) && !!G.fortAuraAt(20, 10);
    var outB = !G.fortAuraAt(31, 20) && !G.fortAuraAt(20, 9);
    st.forts = bk;
    /* 面板文案（据点面板提示行 动态 10 格） */
    var c = G.state.cities[0], f = null;
    for (var r = 1; r <= 40 && !f; r++) for (var dy = -r; dy <= r && !f; dy++) for (var dx = -r; dx <= r && !f; dx++) {
      var q = G.map.fortAt(c.x + dx, c.y + dy);
      if (q) f = q;
    }
    G.ui.closeAllModals();
    var txt = '';
    if (f) { G.ui.openFortModal(f); txt = document.querySelector('#modal-root').textContent; G.ui.closeAllModals(); }
    return { ok: ok, inB: inB, outB: outB, txt10: txt.indexOf('周边 10 格') >= 0 };
  });
  chk('④ 半径 10：表值 + 10 格命中/11 格不中 + 面板文案「周边 10 格」',
    w4.ok && w4.inB && w4.outB && w4.txt10,
    'radius=10 ' + w4.inB + '/' + w4.outB + ' 文案=' + w4.txt10);

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('脚本异常：' + (e && e.message)); process.exit(2); });
