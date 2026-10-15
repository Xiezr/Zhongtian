/* v89.180 实机验证（真浏览器）：
   ① 真开一仗（突骑 vs Lv4 野地）→ 逐回合推进 → 检查智能"后退"调整出现在回合记录
   ② 募兵（器械页）无人轰炸机卡悬停 → #tip-layer 显示「拆械 对器械伤害 ×3」
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89180_part.js */
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
    G.newGame({ name: '验180', cityName: '许都', region: '碎垣', mapSeed: 20260980 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.map.generate();
    var s = G.state, c = s.cities[0];
    s.settings.battleWatch = true;
    s.world.weather = 'clear';
    var g = G.makeGeneral('风筝验证', 1, 'idle', c.id, false);
    s.generals.push(g);
    G.setStaNow(g, 1000); g.energy = 100;
    /* 找 Lv4 野地（守军 = 长枪/刀盾/弓 —— 全慢速，满足风筝团队条件） */
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
    var wd = G.wildDefenseAt(wt.x, wt.y, wlv);
    c.army = { tuqibing: 500 };
    s.marches = [];
    var d = G.march.dispatch({ kind: 'wild', x: wt.x, y: wt.y }, 'raid', { tuqibing: 500 }, g.id);
    var m = s.marches[0];
    if (m) { m.elapsed = m.totalTime; G.march.tick(); }
    return { ok: d.ok === true && s.battles.length === 1, msg: d.msg,
      lv: wlv, def: JSON.stringify(wd.army), total: wd.total };
  });
  chk('① 出征挂起（Lv' + setup.lv + ' 野地 · 守军 ' + setup.def + ' 共 ' + setup.total + '）', setup.ok, setup.msg || '');
  await p.waitForTimeout(300);

  await p.evaluate(function () {
    var btn = document.querySelector('#modal-root [data-action="bt-open"]');
    if (btn) btn.click();
  });
  await p.waitForTimeout(500);
  var inBt = await p.evaluate(function () { return !!document.querySelector('#modal-root #bt-field'); });
  chk('① 进入战场界面', inBt);

  /* 逐回合推进（每回合等动画 + 智能托管写入） */
  for (var i = 0; i < 9; i++) {
    await p.waitForTimeout(2400);
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
  await p.waitForTimeout(1500);

  var s2 = await p.evaluate(function () {
    var rec = GAME.state.battles && GAME.state.battles[0];
    var log = document.querySelector('#bt-log');
    var notes = [];
    (rec && rec.smartLog || []).forEach(function (sn) {
      (sn.notes || []).forEach(function (n) { notes.push(n); });
    });
    var retreatNotes = notes.filter(function (n) { return n.indexOf('后退') >= 0; });
    return {
      state: rec ? rec.state : '?', round: rec ? rec.round : -1,
      logTxt: log ? log.textContent.slice(0, 300) : '',
      notesN: notes.length, retreatN: retreatNotes.length,
      retreatSample: retreatNotes.slice(0, 4).join(' | '),
      mode: rec && rec.smartMode, rule: rec && rec.smartRule,
    };
  });
  chk('② 智能调整记录出现「后退」（突骑风筝 · notes 非空）', s2.retreatN >= 1,
    '调整 ' + s2.notesN + ' 条 · 后退 ' + s2.retreatN + ' 条 · ' + s2.retreatSample);
  chk('②b 回合记录文本含「后退」（界面可见）', s2.logTxt.indexOf('后退') >= 0,
    'state=' + s2.state + ' round=' + s2.round + ' 阵型=' + s2.mode + '×' + s2.rule);
  await p.screenshot({ path: OUT + 'v89180-battle.png' });

  /* ③ 募兵（器械页）无人轰炸机卡悬停 → 拆械行 */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var c = G.state.cities[0];
    var fIdx = -1;
    c.cells.forEach(function (cc, i) {
      if (fIdx < 0 && cc.build && cc.build.id === 'gongjiangzuofang') fIdx = i;
    });
    if (fIdx < 0) {
      for (var i = 0; i < c.cells.length; i++) {
        if (!c.cells[i].build && !c.cells[i].official) { fIdx = i; break; }
      }
      if (fIdx >= 0) c.cells[fIdx] = { build: { id: 'gongjiangzuofang', lvl: 7 }, pending: null };
    }
    G.ui.openTroops(fIdx, 'siege');
  });
  await p.waitForTimeout(600);
  var card = await p.$('#modal-root .troop-card[data-troop="chuangnu"]');
  chk('③ 器械页无人轰炸机卡在册', !!card);
  if (card) {
    await card.hover();
    await p.waitForTimeout(500);
    var tip = await p.evaluate(function () {
      var el = document.getElementById('tip-layer');
      return el ? { on: el.classList.contains('on'), txt: (el.textContent || '') } : null;
    });
    chk('③ 悬停显示「拆械 对器械伤害 ×3」（#tip-layer）',
      !!tip && tip.on && tip.txt.indexOf('拆械') >= 0 && tip.txt.indexOf('×3') >= 0,
      tip ? tip.txt.replace(/\s+/g, ' ').slice(0, 110) : 'null');
    await p.screenshot({ path: OUT + 'v89180-tip.png' });
  }

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
