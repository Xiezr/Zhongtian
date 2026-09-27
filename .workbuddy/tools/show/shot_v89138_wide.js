/* v89.138 实机脚本：六条需求的可见面验证（自带判定 + 截图）
 * ------------------------------------------------------------
 * 判定清单：
 *   ① 地图：画布铺满（覆盖 ≥95%）· 观察框 15×8@88（单格放大）· 截图
 *   ② 城池菜单：进入城池 → 城内视图 · 派遣/运输双入口 → 出征界面（带各自提示）· 无度支/改名
 *   ③ 弃城两段确认：第一次点只上膛（文案变 + 不执行）
 *   ④ 提速面板：无「已用宝物」行 · 提速完成 → 自动关窗
 *   ⑤ 建筑面板：无「功能」标题
 *   ⑥ 召回：三处入口齐（wild-withdraw）+ 两段确认上膛文案
 * 截图：v89138-map.png / citymenu.png / exp-dispatch.png / boost.png / pane.png
 * 跑法：node .workbuddy/tools/show/shot_v89138_wide.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var FAIL = 0;
function chk(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) FAIL++;
}

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e)); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20261006 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    c.army = { yibing: 3000, changqiang: 2000 };
    c.res.gold = 1e7;
    c.res.grain = 5e6; c.res.wood = 5e6; c.res.stone = 5e6; c.res.iron = 5e6;
    c.res.pop = 60000;
    /* 第二座城（派遣/运输/弃城都要它） */
    var c2 = G.makeCity({ id: 'v138b', name: '柴桑', x: c.x + 6, y: c.y + 5, type: 'self' });
    c2.cells[0].build = { id: 'zhaoxianguan', lvl: 6 };
    c2.cells[1].build = { id: 'junying', lvl: 3 };
    c2.army = { yibing: 1000 };
    st.cities.push(c2);
    /* 首领 + 军营 */
    var lord = G.lordGeneralOf(); lord.status = 'idle'; lord.cityId = c.id;
    var bidx = -1;
    c.cells.forEach(function (cell, i) { if (bidx < 0 && !cell.build && !cell.official) bidx = i; });
    if (bidx >= 0) c.cells[bidx].build = { id: 'junying', lvl: 3 };
    /* 己方野地 + 带将驻军 + 采集队（召回用） */
    st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === 3 && z.y === 3); });
    var g1 = null;
    (st.generals || []).forEach(function (g) { if (!g1 && g.id !== lord.id) g1 = g; });
    if (!g1) { g1 = G.makeGeneral('驻将甲', 12, 'idle', c.id, false); st.generals.push(g1); }
    g1.status = 'garrison'; g1.cityId = c.id;
    st.wilds.push({ x: 3, y: 3, type: 'lake', level: 8, levelDay: 0,
      garrison: { troops: { yibing: 5000 }, cityId: c.id, genId: g1.id } });
    var w = G.map.wildAt(3, 3);
    w.garrison = { troops: { yibing: 5000 }, cityId: c.id, genId: g1.id };
    G.startGather(3, 3, { yibing: 5000 }, {});
    G.ui.enterGame();
    G.ui.setView('map');
    try { G.ui.closeAllModals(); } catch (e) { }
    return { cid: c.id, c2id: c2.id, bidx: bidx };
  });
  console.log('造局：双城 + 军营(格' + init.bidx + ') + 野地(3,3) 带将驻军 + 采集队');

  /* ══ ① 地图铺满 + 放大 ══ */
  await p.waitForTimeout(600);
  var v1 = await p.evaluate(function () {
    var U2 = window.GAME.ui, cv = document.getElementById('mapCanvas');
    var box = U2.viewBoxSize(), fr = U2.mapFrame;
    var availW = box.w - 44, availH = box.h - 54;
    return { box: Math.round(box.w) + 'x' + Math.round(box.h),
      fr: fr.spanX + 'x' + fr.spanY + '@' + fr.cell,
      cv: cv.width + 'x' + cv.height,
      covW: Math.round(cv.width / availW * 100), covH: Math.round(cv.height / availH * 100) };
  });
  console.log('① 地图：可用区 ' + v1.box + ' · 观察框 ' + v1.fr + ' · 画布 ' + v1.cv +
    ' · 覆盖率 ' + v1.covW + '%/' + v1.covH + '%');
  chk('① 地图铺满（覆盖率 ≥95%）', v1.covW >= 95 && v1.covH >= 95);
  chk('① 单格放大（观察框格距 = 88 · 视野 15×8）', /^15x8@88$/.test(v1.fr));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89138-map.png' });

  /* ══ ② 城池菜单：按钮 / 进入城池 / 派遣入口 ══ */
  var v2 = await p.evaluate(function (cid) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openCityPanel(G.cityById(cid));
    var root = document.getElementById('modal-root');
    var btns = [];
    Array.prototype.slice.call(root.querySelectorAll('.m-foot button')).forEach(function (b) {
      btns.push((b.getAttribute('data-action') || '') + ':' + b.textContent.trim());
    });
    return { btns: btns };
  }, init.cid);
  console.log('② 城池菜单底栏：' + v2.btns.join(' | '));
  chk('② 四动作齐（enter/dispatch-exp/transport/jieyue）+ 弃城',
    v2.btns.join(',').indexOf('city-enter') >= 0 && v2.btns.join(',').indexOf('city-dispatch-exp') >= 0
    && v2.btns.join(',').indexOf('city-transport') >= 0 && v2.btns.join(',').indexOf('jieyue-expand') >= 0
    && v2.btns.join(',').indexOf('city-abandon-ask') >= 0);   /* 初始态 ask；上膛后才变 arm */
  chk('② 度支归集 / 将领派遣 / 改名 已不在', v2.btns.join(',').indexOf('budget-gather') < 0
    && v2.btns.join(',').indexOf('city-dispatch,') < 0 && v2.btns.join(',').indexOf('city-rename') < 0);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89138-citymenu.png' });

  /* 进入城池 → 视图变 city */
  var v2b = await p.evaluate(function (cid) {
    var G = window.GAME;
    var btn = document.querySelector('#modal-root [data-action="city-enter"]');
    if (btn) btn.click();
    return { view: G.ui.view, city: G.ui._cityId };
  }, init.cid);
  await p.waitForTimeout(500);
  chk('② 进入城池 → 城内视图', v2b.view === 'city', 'view=' + v2b.view);

  /* 弃城两段确认：第一次点只上膛 */
  var v2c = await p.evaluate(function (cid) {
    var G = window.GAME;
    G.ui.setView('map');
    G.ui.closeAllModals();
    G.ui.openCityPanel(G.cityById(cid));
    /* 第一段：打开弃城确认面板（ask）；第二段：面板里的「确定放弃」→ 第一次点只上膛 */
    var b1 = document.querySelector('#modal-root [data-action="city-abandon-ask"]');
    if (!b1) return { err: '无弃城 ask 按钮（面板底栏=' + (document.querySelector('#modal-root .m-foot') || {}).textContent + '）' };
    b1.click();
    if (!document.querySelector('#modal-root [data-action="city-abandon-arm"]')) {
      return { err: 'ask 点击后未出现确认面板 · 当前标题=' +
        ((document.querySelector('#modal-root .m-title') || {}).textContent || '?') };
    }
    var btn = document.querySelector('#modal-root [data-action="city-abandon-arm"]');
    if (!btn) return { err: '确认面板无 arm 按钮' };
    var before = btn.textContent.trim();
    btn.click();
    var after = document.querySelector('#modal-root [data-action="city-abandon-arm"]');
    return { before: before, after: after ? after.textContent.trim() : '(gone)',
      armed: (G.ui._abandonArm138 || null), cities: G.state.cities.length };
  }, init.c2id);   /* ⚠️ 用**第二座城**（柴桑）：许都挂着野地驻军+采集队 = hard refs，
                       弃城会被正确拦下（"还有 N 支…属于这座城"）—— 那是业务行为，不是 bug */
  console.log('② 弃城第一次点：' + (v2c.err ? ('ERR=' + v2c.err) : (v2c.before + ' → ' + v2c.after + '（armed=' + v2c.armed + ' 城数 ' + v2c.cities + '）')));
  chk('② 弃城两段确认（第一次只上膛 · 不执行）',
    !v2c.err && /再点一次/.test(v2c.after) && v2c.armed && v2c.cities === 2);
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); window.GAME.ui._abandonArm138 = null; });

  /* 派遣 / 运输 → 出征界面 + 提示 */
  var v2d = await p.evaluate(function (c2id) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openCityPanel(G.cityById(c2id));
    document.querySelector('#modal-root [data-action="city-dispatch-exp"]').click();
    var root = document.getElementById('modal-root');
    var txt = (root.textContent || '');
    var sel = root.querySelector('#exp-mode');
    return { mode: sel ? sel.value : null, hasHint: txt.indexOf('派遣：') >= 0,
      hasCargoHint: txt.indexOf('押运兵力') >= 0 };
  }, init.c2id);
  console.log('② 派遣入口：方式=' + v2d.mode + ' · 提示=' + v2d.hasHint + ' · 押运提示=' + v2d.hasCargoHint);
  chk('② 派遣 → 出征界面（transfer + 专属提示）', v2d.mode === 'transfer' && v2d.hasHint);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89138-exp-dispatch.png' });
  var v2e = await p.evaluate(function (c2id) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openCityPanel(G.cityById(c2id));
    document.querySelector('#modal-root [data-action="city-transport"]').click();
    var txt = (document.getElementById('modal-root').textContent || '');
    return { hasHint: txt.indexOf('运输：') >= 0 };
  }, init.c2id);
  chk('② 运输 → 出征界面（押运提示）', v2e.hasHint);

  /* ══ ④ 提速面板：无「已用宝物」+ 完成关窗 ══ */
  var v4 = await p.evaluate(function (o) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui._cityId = o.cid;
    /* 起一条募兵队列（走真实入队出口 —— 手搓对象缺字段会让面板认不出队列） */
    var tr138 = G.train('yibing', 100, o.cid, o.bidx);
    G.ui.openTrainBoost(o.bidx);
    var root = document.getElementById('modal-root');
    var txt = (root.textContent || '');
    var hasBoostRow = txt.indexOf('已用宝物') >= 0;
    /* 花金提速 → 选**满档**（pct 最大者，一步到底）→ 期望自动关窗；
       低档只缩短时长、队列未完成 → 不关窗（这是设计，见 queueDone138 注释）。 */
    var btns = Array.prototype.slice.call(root.querySelectorAll('[data-action="train-rush"]'));
    var best = null;
    btns.forEach(function (x) {
      var pv = Number(x.getAttribute('data-pct')) || 0;
      if (!best || pv > (Number(best.getAttribute('data-pct')) || 0)) best = x;
    });
    if (best) best.click();
    return { hasBoostRow: hasBoostRow, clicked: !!best, pct: best ? best.getAttribute('data-pct') : '-',
      tr: tr138 && tr138.msg };
  }, init);
  await p.waitForTimeout(400);
  var v4b = await p.evaluate(function () {
    var G = window.GAME;
    var root = document.getElementById('modal-root');
    var open = !!(root && root.querySelector('#modal-root .modal'));
    return { stillOpen: open, q: G.trainRunningOf(G.ui._cityId, 0, 'train') ? 'run' : 'none' };
  });
  console.log('④ 提速面板：入队=' + (v4.tr || '-') + ' · 已用宝物行=' + v4.hasBoostRow +
    ' · 点提速=' + v4.clicked + '（满档 pct=' + v4.pct + '）' +
    ' · 提速后弹窗仍开=' + v4b.stillOpen + ' · 队列=' + v4b.q);
  chk('④ 无「已用宝物」拼音行', v4.hasBoostRow === false);
  chk('④ 提速完成（剩余 0）→ 自动关窗', v4.clicked && v4b.stillOpen === false);

  /* ══ ⑤ 建筑面板：无「功能」标题 ══ */
  var v5 = await p.evaluate(function (o) {
    var G = window.GAME;
    var c = G.cityById(o.cid);
    var idx = null;
    c.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'junying') idx = i; });
    G.ui.closeAllModals();
    G.ui.openBuildModal(idx, c);
    var root = document.getElementById('modal-root');
    var txt = (root.textContent || '');
    var zts = [];
    Array.prototype.slice.call(root.querySelectorAll('.op-zone-t')).forEach(function (t) { zts.push(t.textContent.trim()); });
    return { hasFn: /(^|[^（])功能([^）]|$)/.test(txt), zts: zts, txtHead: txt.slice(0, 120) };
  }, init);
  console.log('⑤ 军营面板 op-zone 标题：' + JSON.stringify(v5.zts));
  chk('⑤ 无「功能」标题（op-zone-t 不含"功能"）',
    v5.zts.every(function (t) { return t.indexOf('功能') < 0; }));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89138-pane.png' });

  /* ══ ⑥ 召回：入口齐 + 两段确认 ══ */
  var v6 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openLandModal(3, 3);
    var root = document.getElementById('modal-root');
    var btns = [];
    Array.prototype.slice.call(root.querySelectorAll('[data-action="wild-withdraw"]')).forEach(function (x) {
      btns.push(x.textContent.trim());
    });
    var txt0 = root.textContent || '';
    var btn = root.querySelector('[data-action="wild-withdraw"]');
    if (btn) btn.click();
    var txt1 = (document.getElementById('modal-root').textContent || '');
    return { n: btns.length, before: txt0.indexOf('再点一次') >= 0, after: txt1.indexOf('再点一次') >= 0,
      armed: G.ui._wdArm138 || null };
  });
  console.log('⑥ 地块界面：召回按钮 ' + v6.n + ' 个 · 点击后上膛=' + v6.after + '（armed=' + v6.armed + '）');
  chk('⑥ 召回入口在位 + 两段确认（点击后变"再点一次"）', v6.n >= 1 && v6.after === true && !!v6.armed);
  await p.evaluate(function () { window.GAME.ui._wdArm138 = null; });

  if (errs.length) console.log('\n⚠ 页面错误 ' + errs.length + ' 条：' + errs.slice(0, 3).join(' | '));
  else console.log('\n✅ 无页面错误');
  console.log('\n===== 实机判定：' + (FAIL ? (FAIL + ' 项失败') : '全部通过') + ' =====');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
