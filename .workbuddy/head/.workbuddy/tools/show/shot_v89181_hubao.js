/* v89.181 实机验证（真浏览器）：
   ① 发兵虎豹 500（新值 hp5400/def280）→ 打 Lv4 野地 → 进战场打 3 回合
   ② 页面环境核值：DATA.TROOPS.hubaoqi 新值 + （尽力）战场快照 hpPer=5400
   ③ 截图（战场 · 虎豹在场）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89181_hubao.js */
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
    G.newGame({ name: '验181', cityName: '许都', region: '碎垣', mapSeed: 20260981 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.map.generate();
    var s = G.state, c = s.cities[0];
    s.settings.battleWatch = true;
    s.world.weather = 'clear';
    var g = G.makeGeneral('虎豹验证', 1, 'idle', c.id, false);
    s.generals.push(g);
    G.setStaNow(g, 1000); g.energy = 100;
    var wt = null, wlv = 0;
    for (var r = 1; r <= 40 && !wt; r++) {
      for (var dy = -r; dy <= r && !wt; dy++) for (var dx = -r; dx <= r && !wt; dx++) {
        var x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= G.DATA.MAP_W || y >= G.DATA.MAP_H) continue;
        var tl = G.map.tile(x, y);
        if (!tl || tl.terrain === 'city') continue;
        if (G.map.wildAt(x, y) || G.map.fortAt(x, y)) continue;
        var lv = G.map.wildLevelNow(x, y);
        if (lv !== 4) continue;
        wt = { x: x, y: y }; wlv = lv;
      }
    }
    if (!wt) return { ok: false, msg: '未找到 Lv4 野地' };
    c.army = { hubaoqi: 500 };
    s.marches = [];
    var d = G.march.dispatch({ kind: 'wild', x: wt.x, y: wt.y }, 'raid', { hubaoqi: 500 }, g.id);
    var m = s.marches[0];
    if (m) { m.elapsed = m.totalTime; G.march.tick(); }
    var t = G.DATA.TROOPS.hubaoqi;
    return { ok: d.ok === true && s.battles.length === 1, msg: d.msg,
      hp: t.hp, def: t.def, atk: t.atk, spd: t.spd };
  });
  chk('① 出征挂起（虎豹 500 → Lv4 野地）', setup.ok, setup.msg || '');
  chk('① 页面环境表值（hp5400 / def280 / atk510 / spd850）',
    setup.hp === 5400 && setup.def === 280 && setup.atk === 510 && setup.spd === 850,
    'hp' + setup.hp + ' def' + setup.def);
  await p.waitForTimeout(300);

  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="bt-open"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(500);
  var inBt = await p.evaluate(function () { return !!document.querySelector('#modal-root #bt-field'); });
  chk('① 进入战场界面', inBt);

  /* 打 3 回合 */
  for (var i = 0; i < 3; i++) {
    await p.waitForTimeout(2300);
    var st = await p.evaluate(function () {
      var rec = GAME.state.battles && GAME.state.battles[0];
      if (rec && rec.state !== 'live') return 'done';
      var btn = document.querySelector('#modal-root [data-action="bt-done"]');
      if (btn) btn.click();
      return 'click';
    });
    if (st === 'done') break;
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(1200);

  var s2 = await p.evaluate(function () {
    var rec = GAME.state.battles && GAME.state.battles[0];
    /* 读引擎会话 `GAME._bsess[rec.id].units`（诊断确认结构：{field,over,units,...}） */
    var hpPer = null, spdU = null;
    try {
      var ses = GAME._bsess && rec && GAME._bsess[rec.id];
      var list = (ses && ses.units && ses.units.atk) || [];
      list.forEach(function (u) { if (u && u.id === 'hubaoqi') { hpPer = u.hpPer; spdU = u.spd; } });
    } catch (e) { hpPer = 'ERR'; }
    return { state: rec ? rec.state : '?', round: rec ? rec.round : -1, hpPer: hpPer };
  });
  chk('② 战斗推进（打满 3 回合或提前结束）', s2.round >= 2 || s2.state === 'done',
    'round=' + s2.round + ' state=' + s2.state);
  chk('② 战场引擎单位 hpPer = 5400（新值真实进战斗）', s2.hpPer === 5400,
    'hpPer=' + s2.hpPer);
  await p.screenshot({ path: OUT + 'v89181-hubao.png' });

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
