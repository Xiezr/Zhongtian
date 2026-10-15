/* v89.192 量测：沙盘弹窗 vs 战场界面（铺满参考）· 含极端载荷（8 兵种）
 * 用法：NODE_PATH=... node measure_v89192_panes.js
 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  var out = await p.evaluate(async function () {
    var G = window.GAME;
    G.newGame({ name: '量测', cityName: '会稽', region: '潮湾', mapSeed: 20260931 });
    G.state.world.weather = 'clear';
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    function R(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
      return { w: Math.round(r.width / k), h: Math.round(r.height / k), t: Math.round(r.top / k) };
    }
    var res = {};

    /* ---- A. 战场界面（挂起式观战） ---- */
    G.state.settings.battleWatch = true;
    var c0 = G.state.cities[0], g0 = G.state.generals[0];
    g0.cityId = c0.id; g0.status = 'idle';
    var tgt = null;
    for (var dx = -6; dx <= 6 && !tgt; dx++) for (var dy = -6; dy <= 6 && !tgt; dy++) {
      if (!dx && !dy) continue;
      var x = c0.x + dx, y = c0.y + dy, tl = G.map.tile(x, y);
      if (!tl || tl.terrain === 'city') continue;
      var lv = G.map.wildLevelNow(x, y);
      if (lv >= 1 && lv <= 3) tgt = { x: x, y: y, lv: lv };
    }
    /* 多兵种载荷（8 兵种）→ 造大一点的仗 */
    c0.army = { yibing: 500, changqiang: 500, daodun: 500, gongjian: 500 };
    G.setStaNow(g0, 200); g0.energy = 200;
    var d = G.march.dispatch({ kind: 'wild', x: tgt.x, y: tgt.y, lv: tgt.lv },
      'raid', { yibing: 500, changqiang: 500, daodun: 500, gongjian: 500 }, g0.id, null, null, null);
    if (!d || d.ok === false) return { err: 'dispatch:' + (d && d.msg) };
    (G.state.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
    G.march.tick();
    var rec = (G.state.battles || [])[0];
    if (!rec) return { err: 'no-battle' };
    /* 不推进（round=0）直接开战场 —— 只量几何，别让战斗秒完（2000 兵打 Lv1 两回合就 done） */
    try { G.ui.openBattlefield(rec.id); } catch (e) { res.btOpenErr = String(e && e.message); }
    res.btRec = { id: rec.id, state: rec.state, round: rec.round, history: (rec.history || []).length,
      ses: !!(G._bsess && G._bsess[rec.id]) };
    await new Promise(function (r) { setTimeout(r, 500); });
    res.btTitle = (document.querySelector('#modal-root .m-title') || {}).textContent || '(无标题)';
    res.btDump = ((document.querySelector('#modal-root .inner-panel') || {}).textContent || '').slice(0, 160);
    res.btModals = document.querySelectorAll('#modal-root .modal').length;
    res.btWrapExists = !!document.getElementById('bt-wrap');
    res.btModalCls = (document.querySelector('#modal-root .modal') || {}).className || '';
    res.bt = {
      modal: R(document.querySelector('#modal-root .modal')),
      body: R(document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .panel-body')),
      wrap: R(document.getElementById('bt-wrap')),
      top: R(document.querySelector('#modal-root .bt-top')),
      board: R(document.getElementById('bt-board')),
      field: R(document.getElementById('bt-field')),
      log: R(document.getElementById('bt-log')),
      logLines: document.getElementById('bt-log') ? document.getElementById('bt-log').children.length : -1,
    };
    res.bt.wrapOver = (function () { var w = document.getElementById('bt-wrap');
      return w ? (w.scrollHeight - w.clientHeight) : -1; })();
    G.ui.closeAllModals();

    /* ---- B. 沙盘（把这场跑完 → 战报 → 沙盘） ---- */
    G.battle.autoBattle(rec.id);
    await new Promise(function (r) { setTimeout(r, 400); });
    var rep = (G.state.reports || [])[0];
    if (!rep) return Object.assign(res, { err2: 'no-report' });
    var rid = G.repRidOf ? G.repRidOf(rep) : 0;
    G.ui.openSandbox(rid);
    await new Promise(function (r) { setTimeout(r, 500); });
    res.sd = {
      modal: R(document.querySelector('#modal-root .modal')),
      body: R(document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .panel-body')),
      wrap: R(document.getElementById('sd-wrap')),
      top: R(document.querySelector('#modal-root .sd-top')),
      board: R(document.getElementById('sd-board')),
      field: R(document.getElementById('sd-field')),
      log: R(document.getElementById('sd-log')),
      foot: R(document.querySelector('#modal-root .sd-foot')),
      logLines: document.getElementById('sd-log') ? document.getElementById('sd-log').children.length : -1,
      rounds: G.ui._sd ? G.ui._sd.sb.rounds : -1,
      atkN: G.ui._sd ? G.ui._sd.cur.atk.length : -1,
      defN: G.ui._sd ? G.ui._sd.cur.def.length : -1,
    };
    res.sd.wrapOver = (function () { var w = document.getElementById('sd-wrap');
      return w ? (w.scrollHeight - w.clientHeight) : -1; })();
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
  process.exit(0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
