/* v89.175 实机验证（真浏览器 · 真开战）：智能战斗每回合可见
   ① 野地出征 → 挂起 → 点「观战」进战场
   ② 完成 2 回合 → 回合记录出现「🤖 智能调兵完成（…）· 采用「…」· 开始回合战斗」
   ③ 顶栏「⚡ 智能 · 调整 N / 维持」
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89175_smart.js */
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
  var p = await b.newPage({ viewport: { width: 1680, height: 1120 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var setup = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验175', cityName: '许都', region: '豫州', mapSeed: 20260977 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.map.generate();          /* 地图网格懒建（tile/wildAt 依赖 grid）——幂等 */
    var s = G.state, c = s.cities[0];
    s.settings.battleWatch = true;
    s.world.weather = 'clear';
    var g = G.makeGeneral('观战预备', 1, 'idle', c.id, false);
    s.generals.push(g);
    G.setStaNow(g, 1000); g.energy = 100;
    var wt = null, seen = [];
    for (var r = 1; r <= 40 && !wt; r++) {
      for (var dy = -r; dy <= r && !wt; dy++) for (var dx = -r; dx <= r && !wt; dx++) {
        var x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= G.DATA.MAP_W || y >= G.DATA.MAP_H) continue;
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(x, y) || G.map.fortAt(x, y)) continue;
        var wlv = G.map.wildLevelNow(x, y);
        if (seen.length < 12) seen.push('(' + x + ',' + y + ')=Lv' + wlv);
        /* 放宽：Lv1~6（小规模多兵种优先，但先保证找得到） */
        if (wlv < 1 || wlv > 6) continue;
        wt = { x: x, y: y };
      }
    }
    if (!wt) return { ok: false, msg: '未找到野地 · 样本 ' + seen.join(' ') };
    var wlv2 = G.map.wildLevelNow(wt.x, wt.y);
    var wd = G.wildDefenseAt(wt.x, wt.y, wlv2);
    var send = {};
    for (var gk in (wd.army || {})) send[gk] = wd.army[gk];
    c.army = {};
    for (var gk2 in send) c.army[gk2] = send[gk2];
    s.marches = [];
    var d = G.march.dispatch({ kind: 'wild', x: wt.x, y: wt.y }, 'raid', send, g.id);
    var m = s.marches[0];
    if (m) { m.elapsed = m.totalTime; G.march.tick(); }
    return { ok: d.ok === true && s.battles.length === 1, msg: d.msg, lv: wlv2 };
  });
  chk('① 出征挂起（Lv' + setup.lv + ' 野地）', setup.ok, setup.msg || '');
  await p.waitForTimeout(300);

  /* 点「观战」进战场 */
  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="bt-open"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(400);
  var inBt = await p.evaluate(function () { return !!document.querySelector('#modal-root #bt-field'); });
  chk('① 进入战场界面', inBt);

  /* 完成 2 回合（等读秒到位） */
  for (var i = 0; i < 2; i++) {
    await p.waitForTimeout(1200);
    await p.evaluate(function () {
      var btn = document.querySelector('#modal-root [data-action="bt-done"]');
      if (btn) btn.click();
    });
    await p.waitForTimeout(1400);
  }
  var s2 = await p.evaluate(function () {
    var log = document.querySelector('#bt-log');
    var smart = document.querySelector('#modal-root .bt-smart');
    var rec = null;
    try {
      var bs = GAME._bsess || {};
      for (var k in bs) { if (bs[k] && bs[k].rec) rec = bs[k].rec; }
      if (!rec && GAME.state.battles && GAME.state.battles[0]) rec = GAME.state.battles[0];
    } catch (e) { rec = null; }
    return {
      log: log ? log.textContent : '',
      smartTxt: smart ? smart.textContent : '',
      smartTip: smart ? (smart.getAttribute('title') || '') : '',
      smartOuter: smart ? smart.outerHTML.slice(0, 260) : '',
      note: rec && rec.smartNote ? JSON.stringify(rec.smartNote).slice(0, 160) : '（无 rec.smartNote）',
      fnProbe: (function () {
        try {
          var s = String(GAME.ui.btTopHTML);
          return { yu: s.indexOf('维持') >= 0, dot: s.indexOf("' · '") >= 0, tip: s.indexOf('tip175') >= 0 };
        } catch (e) { return 'ERR'; }
      })(),
      round: (document.querySelector('#bt-round') || {}).textContent,
    };
  });
  console.log('  诊断 outer: ' + s2.smartOuter);
  console.log('  诊断 note : ' + s2.note);
  console.log('  诊断 fnProbe: ' + JSON.stringify(s2.fnProbe));
  chk('② 回合记录含「智能调兵完成」+「开始回合战斗」',
    s2.log.indexOf('智能调兵完成') >= 0 && s2.log.indexOf('开始回合战斗') >= 0,
    '回合=' + s2.round);
  chk('② 回合记录含策略名（「采用「…」」）', /采用「[^」]+」/.test(s2.log),
    (s2.log.match(/采用「[^」]+」/) || [''])[0]);
  chk('③ 顶栏「⚡ 智能 · 调整 N / 维持」', /⚡ 智能 · (调整 \d+|维持)/.test(s2.smartTxt), s2.smartTxt);
  chk('③ 顶栏 title 含赛马策略与明细', s2.smartTip.indexOf('赛马采用') >= 0 || s2.smartTip.indexOf('智能战斗') >= 0,
    s2.smartTip.slice(0, 60));

  /* 截图（战场全景，含回合记录） */
  await p.screenshot({ path: OUT + 'v89175-smart.png', fullPage: false });
  console.log('  （截图 v89175-smart.png）');
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
