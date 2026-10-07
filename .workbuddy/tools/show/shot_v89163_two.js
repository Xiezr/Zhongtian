/* v89.163 实机验证（真浏览器）：
   ① 底栏「⚔ 指挥战斗」清单 = ⚔ 战斗待指挥 + 🛫 行军中的军队（两段一门）+ 图 v89163-war-list.png
   ② 清单内点「召回」→ 原地重绘（不跳行军队列弹窗 · 行数 2→1）
   ③ 募兵面板兵种卡片悬停「单兵耗时」= 新值（弓箭手 1分 / 步行机 10秒）+ 图 v89163-train-time.png
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/show/shot_v89163_two.js */
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
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + e.message.slice(0, 200)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var boot = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验163', cityName: '许都', region: '碎垣', mapSeed: 20260963 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.currentCity();
    /* 造两条行军（不同模式）+ 一场待指挥战斗。
       ⚠️ totalTime 要足够大：march.tick 每现实秒推进 ts(=120) 游戏秒，
       elapsed 与 totalTime 太近会在脚本等待期间"到点抵达"（实中过：无将行军到点后
       报「请选择出征将领」被折返）。600000 游戏秒 ≈ 5000 现实秒，稳。 */
    var gA = G.state.generals[0], gB = G.state.generals[1];
    gA.status = 'march'; gA.cityId = c.id;
    gB.status = 'march'; gB.cityId = c.id;
    G.state.battles = [{ id: 'B163', state: 'live', side: 'atk', modeId: 'raid', target: { name: '荒野·甲' } }];
    G.state.marches = [
      { id: 'M1', cityId: c.id, genId: gB.id, modeId: 'raid', target: { kind: 'wild', x: 1, y: 1 },
        tx: 1, ty: 1, name: '荒野·乙', kind: 'wild', army: { yibing: 1200 }, elapsed: 252000, totalTime: 600000,
        scheme: null, ops: 'assault', cargo: null },
      { id: 'M2', cityId: c.id, genId: gA.id, modeId: 'siege', target: { kind: 'fort', x: 2, y: 2 },
        tx: 2, ty: 2, name: '黑风寨', kind: 'fort', army: { yibing: 3000, minfu: 200 }, elapsed: 60000, totalTime: 600000,
        scheme: null, ops: 'assault', cargo: null }
    ];
    /* 给募兵面板摆一座军营 Lv4 + 书院 Lv4（弓箭手解锁线） */
    var idxs = [];
    c.cells.forEach(function (x, i) { if (!x.build && x.official !== true && idxs.length < 2) idxs.push(i); });
    c.cells[idxs[0]].build = { id: 'junying', lvl: 4 };
    c.cells[idxs[1]].build = { id: 'shuyuan', lvl: 4 };
    c.army = { yibing: 500 };
    return { barIdx: idxs[0], n: G.state.marches.length };
  });
  console.log('  造局：行军 ' + boot.n + ' 条 · 军营格 idx=' + boot.barIdx);
  await p.waitForTimeout(900);

  console.log('===== ① 指挥战斗清单（⚔ 待指挥 + 🛫 行军中） =====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.openBattleList();
    var m = document.querySelector('#modal-root');
    return { txt: m ? (m.textContent || '').replace(/\s+/g, ' ') : '',
      warRows: m ? m.querySelectorAll('[data-action="bt-open"]').length : 0,
      marchRows: m ? m.querySelectorAll('[data-action="march-recall"]').length : 0,
      hasWarList: !!(m && m.querySelector('.war-list')) };
  });
  console.log('  弹窗文本 = ' + r1.txt.slice(0, 120));
  chk('★ 两段一员：⚔ 战斗待指挥（1）+ 🛫 行军中的军队（2）', r1.txt.indexOf('战斗待指挥（1）') >= 0
    && r1.txt.indexOf('行军中的军队（2）') >= 0, 'war=' + r1.warRows + ' march=' + r1.marchRows);
  chk('战斗行 1 + 行军行 2（含召回按钮）', r1.warRows === 1 && r1.marchRows === 2);
  chk('行军行含：目标名 / 主将 / 进度', r1.txt.indexOf('荒野·乙') >= 0 && r1.txt.indexOf('黑风寨') >= 0
    && r1.txt.indexOf('42%') >= 0);
  var rc1 = await p.evaluate(function () {
    var box = document.querySelector('#modal-root .modal');
    var r = box ? box.getBoundingClientRect() : null;
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
  if (rc1) {
    await p.screenshot({ path: OUT + 'v89163-war-list.png',
      clip: { x: Math.max(0, rc1.x), y: Math.max(0, rc1.y), width: rc1.w, height: Math.min(rc1.h, 620) } });
    console.log('    📷 v89163-war-list.png');
  }
  chk('弹窗可截图（宽度 ' + (rc1 ? Math.round(rc1.w) : 0) + '）', !!rc1);

  console.log('===== ② 清单内召回 → 原地重绘 =====');
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var btn = document.querySelector('#modal-root [data-action="march-recall"][data-id="M1"]');
    if (!btn) return { no: true };
    btn.click();
    return { no: false, left: G.state.marches.length };
  });
  await p.waitForTimeout(260);
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var m = document.querySelector('#modal-root');
    return { stillWar: !!(m && m.querySelector('.war-list')),
      notMarches: m ? (m.textContent || '').indexOf('行军队列（') < 0 : false,
      rows: m ? m.querySelectorAll('[data-action="march-recall"]').length : -1,
      left: G.state.marches.length,
      hasM1: m ? ((m.textContent || '').indexOf('荒野·乙') >= 0) : false };
  });
  console.log('  召回 M1 后：marches=' + r3.left + ' · 弹窗仍在清单=' + r3.stillWar + ' · 行军行=' + r3.rows
    + ' · 还含 M1 行=' + r3.hasM1);
  chk('★ 召回成功（兵力归城 · marches 2→1）', r2.no === false && r3.left === 1);
  chk('★ 原地重绘（仍是指挥战斗清单 · 没跳到行军队列弹窗）', r3.stillWar && r3.notMarches);
  chk('行军行 2→1、M1 行已消失（无幽灵行）', r3.rows === 1 && r3.hasM1 === false);

  console.log('===== ③ 募兵面板：兵种卡悬停「单兵耗时」新值 =====');
  await p.evaluate(function (idx) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openTroops(idx, 'normal');
    /* 募兵面板默认在「募兵队列」页（卡片不渲染）——切到「步兵」页（ui._trainTab） */
    G.ui._trainTab = 'inf';
    G.ui.renderTroopsModal();
  }, boot.barIdx);
  await p.waitForTimeout(420);
  var r4 = await p.evaluate(function () {
    var card = document.querySelector('[data-troop="gongjian"]');
    if (!card) return null;
    var r = card.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2,
      tipEl: !!card.querySelector('.tcard-tip') };
  });
  if (r4) {
    await p.mouse.move(r4.cx, r4.cy);
    await p.waitForTimeout(260);
    var r5 = await p.evaluate(function () {
      var el = document.getElementById('tip-layer');
      return { on: !!(el && el.classList.contains('on')), txt: el ? (el.textContent || '') : '' };
    });
    console.log('  弓箭手卡 tip = ' + r5.txt.replace(/\n/g, ' | ').slice(0, 130));
    chk('★ 悬停弓箭手：单兵耗时 = 1分（新值）', r5.on && r5.txt.indexOf('单兵耗时 1分') >= 0);
    var rc2 = await p.evaluate(function () {
      var el = document.getElementById('tip-layer');
      var r = el ? el.getBoundingClientRect() : null;
      return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    });
    /* 卡片 + tip 一起入图：以卡片为中心取一块区域 */
    await p.screenshot({ path: OUT + 'v89163-train-time.png',
      clip: { x: Math.max(0, Math.min(r4.cx - 260, 1330)), y: Math.max(0, r4.cy - 200),
        width: 520, height: 400 } });
    console.log('    📷 v89163-train-time.png（tip 框 ' + (rc2 ? Math.round(rc2.w) + 'x' + Math.round(rc2.h) : '-') + '）');
  } else {
    chk('募兵面板弓箭手卡片存在', false);
  }
  /* 步行机（junying 1 级可募）也在场：顺带读它的耗时 */
  var r6 = await p.evaluate(function () {
    var card = document.querySelector('[data-troop="yibing"]');
    if (!card) return null;
    var tip = card.querySelector('.tcard-tip');
    return tip ? (tip.textContent || '').replace(/\s+/g, ' ') : '';
  });
  console.log('  步行机卡 tip = ' + (r6 || '').slice(0, 110));
  chk('★ 步行机单兵耗时 = 10秒（新值）', !!r6 && r6.indexOf('单兵耗时 10秒') >= 0);

  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('FATAL: ' + e.message); process.exit(2); });
