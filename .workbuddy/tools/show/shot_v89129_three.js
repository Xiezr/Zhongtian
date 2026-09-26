/* v89.129 实机图（三个场景）：
   ① 城墙面板（新时间：Lv11→12 = 22h 起 / 资源重排）
   ② 据点侦查（守将行显示守备官 —— 补上"据点无守将"缺口）
   ③ 出征面板（"相称建议"行 —— 按目标等级配备相称资质等级的将领） */
'use strict';
var fs = require('fs');
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 建局（地图生成；城内外摆满东西） */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    c.cells.forEach(function (x) { if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 8); });
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 12; });
    st.res.grain = 9e7; st.res.wood = 9e7; st.res.stone = 9e7; st.res.iron = 9e7;
    st.techs = st.techs || {}; st.techs.zhencha = 99;      /* 侦查层全解锁（守将名册可见） */
    G.wallSlotOf(c).build = { id: 'chengqiang', lvl: 10 }; /* 城墙 Lv10 → 下一档 22h */
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) {}
    G.ui.setView('city');
    G.refreshAll();
  });
  await p.waitForTimeout(500);

  /* ── ① 城墙面板：点环城 → 看"升级"档的时长与资源 ── */
  await p.click('#view-container .wall-hit[data-action="open-wall"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89129-wall-panel.png' });
  var r1 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var txt = (m.textContent || '').replace(/\s+/g, ' ');
    var G = window.GAME;
    var c = G.currentCity();
    return {
      txt: txt.slice(0, 150),
      nextTimeH: (G.DATA.buildTimeSec('chengqiang', 10) / 3600),
      cost: G.DATA.BUILDINGS.chengqiang.levelCost(10),
    };
  });
  console.log('① 城墙面板（Lv10→11，应见 22h/资源 1740.8 万）：');
  console.log('   面板文本：', r1.txt);
  console.log('   曲线值：', r1.nextTimeH + 'h  资源：', JSON.stringify(r1.cost));

  /* ── ② 据点侦查：找据点 → 侦查 → 守将行 ── */
  var r2a = await p.evaluate(function () {
    var G = window.GAME, D = G.DATA;
    /* 就近补摆侦查科技（开面板前一刻生效 —— v89.128 的"先补数据、再开面板"教训） */
    G.state.techs = G.state.techs || {};
    G.state.techs.zhencha = 99;
    var hit = null;
    for (var y = 0; y < (D.MAP_H || 60) && !hit; y++) {
      for (var x = 0; x < (D.MAP_W || 60) && !hit; x++) { hit = G.map.fortAt(x, y); }
    }
    if (!hit) return { ok: false };
    var t = G.battle.resolveTarget({ kind: 'fort', x: hit.x, y: hit.y });
    var gen = G.state.generals[0];
    gen.stamina = 999; gen.energy = 999;
    /* 走**真实侦查链路**（expedition 的 scout 分支 —— 它才带 intelTiers 包装；
       scoutTarget 是内层，直接调它面板会因缺 intelTiers 兜底成全锁） */
    var r = G.battle.expedition({ kind: 'fort', x: hit.x, y: hit.y }, 'scout', {}, gen.id);
    G.ui.closeAllModals();
    if (r && r.ok) G.ui.openScoutResult({ kind: 'fort', name: t.name }, r, 0);
    return { ok: !!(r && r.ok), msg: (r && r.msg) || '', fort: hit.name + ' Lv' + hit.level,
      tech: G.systems.techLevel('zhencha'),
      rIntelLv: r && r.intelTiers ? r.intelTiers.lv : null, rGuard: r && r.guard ? r.guard.name : null,
      guard: t.guard ? (t.guard.name + ' ' + G.rankOf(t.guard).name + ' Lv' + t.guard.level) : 'null' };
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89129-scout-fort.png' });
  var r2 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var txt = (m.textContent || '').replace(/\s+/g, ' ');
    var mm = txt.match(/守将[^统]{0,40}/);
    return { hit: mm ? mm[0] : null, txt: txt.slice(0, 120) };
  });
  console.log('② 据点侦查（' + JSON.stringify(r2a) + '）：');
  console.log('   守将行：', r2.hit || '未命中', '｜', r2.txt);

  /* ── ③ 出征面板：对据点开面板 → 相称建议行 ── */
  var r3a = await p.evaluate(function () {
    var G = window.GAME, D = G.DATA;
    var hit = null;
    for (var y = 0; y < (D.MAP_H || 60) && !hit; y++) {
      for (var x = 0; x < (D.MAP_W || 60) && !hit; x++) { hit = G.map.fortAt(x, y); }
    }
    if (!hit) return { ok: false };
    G.ui.closeAllModals();
    G.ui.openExpModal({ kind: 'fort', x: hit.x, y: hit.y });
    return { ok: true };
  });
  await p.waitForTimeout(450);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89129-exp-fort.png' });
  var r3 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var txt = (m.textContent || '').replace(/\s+/g, ' ');
    var mm = txt.match(/相称建议[^带]{0,30}带队/);
    return { hit: mm ? mm[0] : null };
  });
  console.log('③ 出征面板（据点）：相称建议行 =', r3.hit || '未命中');

  /* ── ③b 出征面板：对野地（低等级）再看一行 ── */
  var r4a = await p.evaluate(function () {
    var G = window.GAME;
    var best = null;
    for (var r = 2; r < 12 && !best; r++) {
      for (var dy = -r; dy <= r && !best; dy++) {
        for (var dx = -r; dx <= r && !best; dx++) {
          var x = G.currentCity().x + dx, y = G.currentCity().y + dy;
          var tile = G.map.tile(x, y);
          if (!tile || tile.terrain === 'city') continue;
          if (G.map.wildAt && G.map.wildAt(x, y)) continue;
          var lv = G.map.wildLevelNow(x, y);
          if (lv >= 6) best = { x: x, y: y, lv: lv };
        }
      }
    }
    if (!best) return { ok: false };
    G.ui.closeAllModals();
    G.ui.openExpModal({ kind: 'wild', x: best.x, y: best.y });
    return { ok: true, lv: best.lv, x: best.x, y: best.y };
  });
  await p.waitForTimeout(450);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89129-exp-wild.png' });
  var r4 = await p.evaluate(function () {
    var m = document.querySelector('#modal-root');
    var txt = (m.textContent || '').replace(/\s+/g, ' ');
    var mm = txt.match(/相称建议[^带]{0,30}带队/);
    return { hit: mm ? mm[0] : null };
  });
  console.log('③b 出征面板（野地）：相称建议行 =', r4.hit || '未命中', JSON.stringify(r4a));

  await b.close();
  console.log('done');
})().catch(function (e) { console.error('ERR', e.message); process.exit(1); });
