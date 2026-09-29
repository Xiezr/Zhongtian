/* v89.195 实机验收：① 总览（13 前哨满页 + 档位一览表 · 不溢出）② 行内放手 → 确认窗
   ③ 红键一击执行（前哨 -1 + 弹层关净 + 地形恢复）④ 前哨面板危险区 ⑤ 资质升档 toast 含"攻防补足" */
var E = 'E:/Deepseekdb/.workbuddy/shots/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  var fails = 0;
  function chk(tag, ok, extra) {
    console.log((ok ? '✅ ' : '❌ ') + tag + (extra ? '  [' + extra + ']' : ''));
    if (!ok) fails++;
    return ok;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '前哨客', cityName: '许都', region: '豫州', mapSeed: 20260932 });
    G.state.world.weather = 'clear';
    if (!G.state.map.grid) G.map.generate();
    G.goldAdd(5000000 - G.goldOf());
    var c = G.state.cities[0];
    /* 造 13 个前哨（满页压测：档位一览表叠加后弹窗不许溢出）—— 直推对象（容量压测口径） */
    G.state.forts = G.state.forts || {};
    var mades = [];
    for (var i = 0; i < 13; i++) {
      var fx = c.x + 4 + (i % 7), fy = c.y + 4 + Math.floor(i / 7) * 3 + (i % 3);
      var key = fx + ',' + fy;
      if (G.state.forts[key]) { continue; }
      G.state.forts[key] = { x: fx, y: fy, lv: 2 + (i % 5) * 2, name: '测哨' + i, day: 0, cityId: c.id };
      mades.push(key);
    }
    /* 资质侧造局：一个凡品 Lv60 将 + 一枚蕴灵草 */
    var g = G.makeGeneral('升档体测将', 60, 'idle', c.id, false, 'fan', 'balance');
    G.state.generals.push(g);
    G.ui._rankTestGen = g.id;
    (G.DATA.ITEMS || []).forEach(function (it) {
      if (it.type === 'rank_up' && it.from === 'fan') G.state.items[it.id] = (G.state.items[it.id] || 0) + 1;
    });
    G.ui.enterGame(); G.ui.closeAllModals();
  });

  /* ── ① 总览：13 前哨满页 + 档位一览表（不溢出）── */
  await p.evaluate(function () { window.GAME.ui.openOutposts(); });
  await sleep(1000);
  var r1 = await p.evaluate(function () {
    var ip = document.querySelector('#modal-root .inner-panel');
    if (!ip) return { ok: false };
    var txt = ip.textContent || '';
    var over = ip.scrollHeight - ip.clientHeight;
    var tbls = ip.querySelectorAll('table.tbl').length;
    return {
      has: txt.indexOf('等级档位一览') >= 0,
      lv12: txt.indexOf('Lv1–2') >= 0, lv910: txt.indexOf('Lv9–10') >= 0,
      rows: ip.querySelectorAll('table.tbl tr').length,
      tbls: tbls, over: over, h: ip.clientHeight,
    };
  });
  chk('① 总览：档位一览表在册（Lv1–2…Lv9–10）+ 13 前哨满页不溢出（over=' + r1.over + '）',
    r1.has && r1.lv12 && r1.lv910 && r1.over <= 0 && r1.tbls >= 2,
    'tbls=' + r1.tbls + ' rows=' + r1.rows + ' h=' + r1.h);
  await p.screenshot({ path: E + 'v89195-outposts.png' });

  /* ── ② 行内「放手」真点 → 确认窗 ── */
  var r2 = await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="fort-abandon-ask"]');
    if (!btn) return { ok: false, why: 'no-btn' };
    btn.click();
    return { ok: true };
  });
  await sleep(500);
  var r2b = await p.evaluate(function () {
    var ip = document.querySelector('#modal-root .inner-panel');
    var txt = ip ? ip.textContent : '';
    var arm = document.querySelector('#modal-root [data-action="fort-abandon-arm"]');
    return {
      arm: !!arm, undo: txt.indexOf('不可撤销') >= 0,
      quota: txt.indexOf('名额变化') >= 0, lose: txt.indexOf('失去护持') >= 0,
      len: txt.length,
    };
  });
  chk('② 行内放手真点 → 确认窗三件套 + 红键', r2.ok && r2b.arm && r2b.undo && r2b.quota && r2b.lose,
    JSON.stringify(r2b));
  await p.screenshot({ path: E + 'v89195-abandon-ask.png' });

  /* ── ③ 红键一击执行：前哨 -1 + 弹层关净 + 地形恢复 ── */
  var r3 = await p.evaluate(function () {
    var arm = document.querySelector('#modal-root [data-action="fort-abandon-arm"]');
    var x = Number(arm.getAttribute('data-x')), y = Number(arm.getAttribute('data-y'));
    window.GAME._t195 = { x: x, y: y, nBefore: Object.keys(GAME.fortsOf()).length };
    arm.click();
    return { ok: true };
  });
  await sleep(600);
  var r3b = await p.evaluate(function () {
    var G = window.GAME;
    var t = G._t195;
    return {
      n: Object.keys(G.fortsOf()).length,
      nBefore: t.nBefore,
      terr: G.map.tile(t.x, t.y).terrain,
      gone: G.fortOwnAt(t.x, t.y) === null,
      closed: document.querySelectorAll('#modal-root .inner-panel').length === 0,
    };
  });
  chk('③ 红键一击执行：前哨 ' + r3b.nBefore + ' → ' + r3b.n + '（-1）· 记录删除 · 关净 · 地形恢复（' + r3b.terr + '）',
    r3b.n === r3b.nBefore - 1 && r3b.gone && r3b.closed, JSON.stringify(r3b));
  await p.screenshot({ path: E + 'v89195-after-abandon.png' });

  /* ── ④ 前哨面板：危险区在册（直开面板）── */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var k = Object.keys(G.fortsOf())[0];
    if (!k) return { ok: false };
    var f = G.fortsOf()[k];
    G.ui.openOutpostPanel(f);
    return { ok: true };
  });
  await sleep(500);
  var r4b = await p.evaluate(function () {
    var ip = document.querySelector('#modal-root .inner-panel');
    var txt = ip ? ip.innerHTML : '';
    return {
      btn: txt.indexOf('fort-abandon-ask') >= 0 && txt.indexOf('放手该前哨') >= 0,
      opZone: txt.indexOf('op-zone danger') >= 0,
      over: ip ? (ip.scrollHeight - ip.clientHeight) : -999,
    };
  });
  chk('④ 前哨面板：危险区 + 放手按钮在册 · 不溢出（over=' + r4b.over + '）',
    r4.ok && r4b.btn && r4b.opZone && r4b.over <= 0, JSON.stringify(r4b));
  await p.screenshot({ path: E + 'v89195-panel.png' });

  /* ── ⑤ 资质升档：真点「晋升」→ toast 含"攻防补足"（资质补全属性实机）── */
  var r5 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    /* 清空历史 toast（③ 的"已放弃"还在堆叠里）——本次只读本操作的反馈 */
    G.ui._notes = [];
    var tel = document.getElementById('toast');
    if (tel) { tel.innerHTML = ''; tel.classList.remove('show'); }
    G.ui.setView('generals');
    G.ui._genSel = G.ui._rankTestGen;
    G.ui.renderView('generals');
    return { ok: true };
  });
  await sleep(400);
  var r5b = await p.evaluate(function () {
    var btn = document.querySelector('#view-container [data-action="gen-rankup"]');
    if (!btn) return { ok: false, why: 'no-rankup-btn' };
    var gen = null;
    (window.GAME.state.generals || []).forEach(function (g) { if (g.id === window.GAME.ui._rankTestGen) gen = g; });
    var a0 = gen ? gen.attack : 0;
    btn.click();
    return { ok: true, a0: a0, a1: gen ? gen.attack : 0 };
  });
  await sleep(600);
  var r5c = await p.evaluate(function () {
    var t = (document.getElementById('toast') || {}).textContent || '';
    var gen = null;
    (window.GAME.state.generals || []).forEach(function (g) { if (g.id === window.GAME.ui._rankTestGen) gen = g; });
    return { toast: t, a: gen ? gen.attack : 0, rank: gen ? gen.rank : '' };
  });
  chk('⑤ 资质升档真点：toast 含「攻防补足」· 攻防 ' + r5b.a0 + '→' + r5c.a + '（等级 ' + r5c.rank + '）',
    r5b.ok && r5c.toast.indexOf('攻防补足') >= 0 && r5c.a > r5b.a0,
    'ok=' + r5b.ok + ' has=' + (r5c.toast.indexOf('攻防补足') >= 0) + ' 攻防 ' + r5b.a0 + '→' + r5c.a
      + ' len=' + r5c.toast.length);
  await p.screenshot({ path: E + 'v89195-rankup.png' });

  console.log('\n' + (fails ? ('❌ 实机失败 ' + fails + ' 项') : '✅ 实机全过 5/5'));
  await b.close();
  process.exit(fails ? 1 : 0);
})();
