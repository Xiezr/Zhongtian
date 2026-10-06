/* ============================================================
 * shot_v89156a_wilds.js  实机：附属野地「放弃 → 弹栈即新数据 → 关闭一次即关净」
 *   复现老板场景（真浏览器）：放弃一片野地后，点关闭**一次**必须关净；
 *   且弹栈后列表**不含已删行**（旧 bug = 弹旧快照含已删行 + 要点几下）。
 * 运行：node .workbuddy/tools/show/shot_v89156a_wilds.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const pw = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = 'E:/Deepseekdb/.workbuddy/shots/';

let PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  const b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  const init = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
    G.ui.enterGame();
    G.ui.closeAllModals();
    var c = G.state.cities[0];
    G.ui._cityId = c.id;
    G.state.wilds = [];
    var X1 = c.x + 6, Y1 = c.y + 6, X2 = c.x + 7, Y2 = c.y + 7;
    G.state.wilds.push({ x: X1, y: Y1, type: 'lake', level: 3, day: 0, startDay: 0 });
    G.state.wilds.push({ x: X2, y: Y2, type: 'hill', level: 4, day: 0, startDay: 0 });
    return { X1: X1, Y1: Y1, X2: X2, Y2: Y2 };
  });
  await p.waitForTimeout(600);
  console.log('seed: 野地 (' + init.X1 + ',' + init.Y1 + ') / (' + init.X2 + ',' + init.Y2 + ')');

  /* ---------- ① 打开附属野地面板 ---------- */
  console.log('===== ① 附属野地面板 =====');
  await p.evaluate(function () { window.GAME.ui.openWilds(); });
  await p.waitForTimeout(500);
  const r1 = await p.evaluate(function (o) {
    var root = document.querySelector('#modal-root');
    return {
      open: !!root.querySelector('.inner-panel'),
      hasDrop: !!root.querySelector('[data-action="wild-abandon-ask"]'),
      hasRows: root.innerHTML.indexOf(o.X1 + ',' + o.Y1) >= 0
    };
  }, init);
  chk('面板已开 + 两片野地在列 + 「放弃」按钮在', r1.open && r1.hasDrop && r1.hasRows);
  await p.locator('#modal-root .inner-panel').screenshot({ path: OUT + 'v89156-wilds.png' });

  /* ---------- ② 放弃流程：ask → 一击执行 ---------- */
  console.log('===== ② 放弃流程（一击执行） =====');
  await p.locator('#modal-root [data-action="wild-abandon-ask"]').first().click();
  await p.waitForTimeout(400);
  const r2 = await p.evaluate(function () {
    var root = document.querySelector('#modal-root');
    return {
      askOpen: root.innerHTML.indexOf('该地块恢复') >= 0,
      hasDo: !!root.querySelector('[data-action="wild-abandon-do"]'),
      noArm: root.innerHTML.indexOf('wild-abandon-arm') < 0
    };
  });
  chk('确认窗已开（一击执行键 · 无上膛）', r2.askOpen && r2.hasDo && r2.noArm);
  await p.locator('#modal-root [data-action="wild-abandon-do"]').click();
  await p.waitForTimeout(1400);          /* 跨过 live 周期（每秒重绘）——验证稳定态 */
  const r3 = await p.evaluate(function (o) {
    var G = window.GAME;
    var root = document.querySelector('#modal-root');
    return {
      wildGone: !G.map.wildAt(o.X1, o.Y1),
      panelBack: root.innerHTML.indexOf('附属野地') >= 0,
      deletedRow: root.innerHTML.indexOf(o.X1 + ',' + o.Y1) >= 0,   /* 应为 false（弹栈即新数据） */
      keepRow: root.innerHTML.indexOf(o.X2 + ',' + o.Y2) >= 0,
      title: (root.querySelector('.gold-heading') || {}).textContent || ''
    };
  }, init);
  console.log('    弹栈后 title = ' + r3.title);
  chk('野地真被放弃', r3.wildGone);
  chk('弹栈回野地面板（含另一片野地）', r3.panelBack && r3.keepRow);
  chk('【核心】弹栈即新数据 —— 列表**不含已删行**（旧 bug = 旧快照闪现已删行）', !r3.deletedRow);

  /* ---------- ③ 点「关闭」一次 → 真关（跨 live 周期再验一次防"复活"） ---------- */
  console.log('===== ③ 关闭一次即关净 =====');
  await p.locator('#modal-root .modal-x').click();
  await p.waitForTimeout(1300);
  const r4 = await p.evaluate(function () {
    return { any: !!document.querySelector('#modal-root .inner-panel') };
  });
  chk('【核心】点关闭**一次即关净**（1.3s 后仍无弹窗 —— 防 live"复活"）', !r4.any);

  /* ---------- ④ 对照：再开再关（普通路径） ---------- */
  await p.evaluate(function () { window.GAME.ui.openWilds(); });
  await p.waitForTimeout(400);
  await p.locator('#modal-root .modal-x').click();
  await p.waitForTimeout(1300);
  const r5 = await p.evaluate(function () { return { any: !!document.querySelector('#modal-root .inner-panel') }; });
  chk('对照：普通开关一次即净', !r5.any);

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error('CRASH: ' + (e && e.stack || e)); process.exit(1); });
