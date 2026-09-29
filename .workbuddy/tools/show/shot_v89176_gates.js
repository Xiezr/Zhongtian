/* v89.176 实机验证（真浏览器）：
   ① 野地出征 → 进战场 → 打 3 回合
   ② 量：顶栏损失读数（#bt-loss）· 接敌角标（.bt-unit.incoming）· 三线（bt-fl-*）· 标尺（sd-scale）
   ③ 一键打完 → 战报沙盘：量 sd 损失读数 / 角标 / 三线（统一化验证）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89176_gates.js */
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
    G.newGame({ name: '验176', cityName: '许都', region: '豫州', mapSeed: 20260976 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.map.generate();
    var s = G.state, c = s.cities[0];
    s.settings.battleWatch = true;
    s.world.weather = 'clear';
    var g = G.makeGeneral('观战预备', 1, 'idle', c.id, false);
    s.generals.push(g);
    G.setStaNow(g, 1000); g.energy = 100;
    var wt = null;
    for (var r = 1; r <= 40 && !wt; r++) {
      for (var dy = -r; dy <= r && !wt; dy++) for (var dx = -r; dx <= r && !wt; dx++) {
        var x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= G.DATA.MAP_W || y >= G.DATA.MAP_H) continue;
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(x, y) || G.map.fortAt(x, y)) continue;
        var wlv = G.map.wildLevelNow(x, y);
        if (wlv < 2 || wlv > 6) continue;
        wt = { x: x, y: y };
      }
    }
    if (!wt) return { ok: false, msg: '未找到野地' };
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
  chk('① 出征挂起（Lv' + setup.lv + ' 野地 · 守军同配 → 势均力敌）', setup.ok, setup.msg || '');
  await p.waitForTimeout(300);

  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="bt-open"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(500);
  var inBt = await p.evaluate(function () { return !!document.querySelector('#modal-root #bt-field'); });
  chk('① 进入战场界面', inBt);

  /* 完成回合 ×3（每回合等动画播完） */
  for (var i = 0; i < 3; i++) {
    await p.waitForTimeout(1100);
    await p.evaluate(function () {
      var rec = GAME.state.battles && GAME.state.battles[0];
      if (rec && rec.state !== 'live') return;
      var btn = document.querySelector('#modal-root [data-action="bt-done"]');
      if (btn) btn.click();
    });
    await p.waitForTimeout(1600);
  }

  var s2 = await p.evaluate(function () {
    var q = function (sel) { return document.querySelectorAll('#modal-root ' + sel); };
    var loss = document.querySelector('#modal-root #bt-loss');
    var log = document.querySelector('#bt-log');
    var rec = GAME.state.battles && GAME.state.battles[0];
    var incN = q('#bt-field .bt-unit.incoming').length;
    var flN = q('#bt-field .sd-fl').length;
    var scN = q('#bt-field .sd-scale').length;
    var lineC = document.querySelector('#modal-root #bt-fl-c');
    return {
      lossTxt: loss ? loss.textContent : '(无)',
      lossCls: loss ? loss.className : '',
      incN: incN, flN: flN, scN: scN,
      lineC: lineC ? lineC.textContent : '(无)',
      round: (document.querySelector('#bt-round') || {}).textContent,
      log: log ? log.textContent.slice(0, 400) : '',
      state: rec ? rec.state : '?',
    };
  });
  chk('② 顶栏损失读数在（📉 我损 x% · 敌损 y%）', /我损 \d+% · 敌损 \d+%/.test(s2.lossTxt), s2.lossTxt + ' · 类=' + s2.lossCls);
  chk('② 三线在（bt-field 里 3 条 sd-fl）+ 标尺 1 条', s2.flN === 3 && s2.scN === 1,
    'fl=' + s2.flN + ' scale=' + s2.scN + ' 线=' + s2.lineC);
  chk('② 回合轮次推进（第 ' + s2.round + ' 回合）', Number(s2.round) >= 2, 'state=' + s2.state);
  chk('② 智能行显示「阵型 · 规则」', /采用「[^」]*·[^」]*」/.test(s2.log) || s2.state !== 'live',
    (s2.log.match(/采用「[^」]+」/) || ['(未捕获)'])[0]);
  console.log('  诊断：角标=' + s2.incN + ' 支 · loss=' + s2.lossTxt);

  await p.screenshot({ path: OUT + 'v89176-battle.png', fullPage: false });
  console.log('  （截图 v89176-battle.png）');

  /* 一键打完 → 战报 → 沙盘 */
  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="bt-auto"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(2500);
  var done = await p.evaluate(function () {
    var G = window.GAME;                    /* ⛔ page.evaluate 里必须用 window.GAME（§87.5） */
    G.ui.closeAllModals();
    var s = G.state;
    var rep = (s.reports || [])[0];
    if (!rep) return { ok: false };
    var rid = G.repRidOf(rep);
    G.ui.openSandbox(rid);
    return { ok: true, rid: rid };
  });
  await p.waitForTimeout(600);
  var s3 = await p.evaluate(function () {
    var q = function (sel) { return document.querySelectorAll(sel); };
    return {
      inSd: !!document.querySelector('#sd-field'),
      lossTxt: (document.querySelector('#sd-loss') || {}).textContent || '(无)',
      flN: q('#sd-field .sd-fl').length,
      tkInc: q('#sd-field .sd-tok.incoming').length,
      scale: q('#sd-field .sd-scale').length,
    };
  });
  chk('③ 战报沙盘打开（统一化后）', !!done.ok && s3.inSd, done.ok ? ('rid=' + done.rid) : '无战报');
  chk('③ 沙盘损失读数在（· 损失 我 x% / 敌 y%）', /损失 我/.test(s3.lossTxt), s3.lossTxt);
  chk('③ 沙盘三线 3 条 + 标尺 1 条', s3.flN === 3 && s3.scale === 1,
    'fl=' + s3.flN + ' scale=' + s3.scale + ' 角标=' + s3.tkInc);

  await p.screenshot({ path: OUT + 'v89176-sandbox.png', fullPage: false });
  console.log('  （截图 v89176-sandbox.png）');
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
