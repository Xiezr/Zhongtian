'use strict';
/* v89.154 实机验证（真浏览器）：
   ① 附属野地排序（采集 > 驻军 > 无驻军·地形→等级降序）+ 操作列「放弃」按钮（防误触）
   ② 放弃两段确认（上膛 + 不可撤销）→ 连点两次执行
   ③ 改建完成 → 直接回城外大界面（弹窗一次关净）
   跑法：node .workbuddy/tools/show/shot_v89154_wild.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var OUT = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.setView('ext');
    try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 造 5 片野地（**倒置**序 = 防平凡解：不排序时会输出倒序） */
    st.wilds = [
      { x: 942, y: 942, type: 'desert', level: 7, day: 0, startDay: 0 },
      { x: 941, y: 941, type: 'hill', level: 4, day: 0, startDay: 0 },
      { x: 940, y: 940, type: 'hill', level: 9, day: 0, startDay: 0 },
      { x: 939, y: 939, type: 'caoyuan', level: 5, day: 0, startDay: 0 },
      { x: 938, y: 938, type: 'lake', level: 3, day: 0, startDay: 0 }
    ];
    st.gathers = [];
    var gen = st.generals[0];
    gen.status = 'garrison';
    st.wilds[4].garrison = { troops: { changqiang: 5000 }, cityId: c.id, genId: gen.id };
    G.startGather(938, 938, { changqiang: 5000 }, { cityId: c.id });       /* 938 = 采集中 */
    st.wilds[3].garrison = { troops: { changqiang: 500 }, cityId: c.id }; /* 939 = 有驻军 */
    /* 改建造局：0 号地块 = 净化厂 Lv2 + 资源充足 */
    G.extGridOf(c)[0] = { type: 'farm', lv: 2 };
    c.res.grain = 5e5; c.res.wood = 5e5; c.res.stone = 5e5; c.res.iron = 5e5; c.res.gold = 5e5;
  });
  await p.waitForTimeout(600);

  /* ---------- ① 附属野地：排序 + 放弃按钮 ---------- */
  console.log('===== ① 附属野地面板（排序 + 操作列放弃按钮） =====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openWilds();
    var rows = Array.prototype.slice.call(document.querySelectorAll('#modal-root table tbody tr'));
    var coords = rows.map(function (tr) { return ((tr.children[1] || {}).textContent || '').trim(); });
    var drop = document.querySelector('#modal-root [data-action="wild-abandon-ask"]');
    var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    return {
      coords: coords,
      dropCls: drop ? drop.className : '(无)',
      dropRed: !!drop && drop.classList.contains('red') && drop.classList.contains('wild-drop'),
      listNoArm: document.querySelector('#modal-root').innerHTML.indexOf('wild-abandon-arm') < 0,
      overflow: panel ? panel.scrollHeight - panel.clientHeight : -1,
      lastOps: (function () {
        var tds = document.querySelectorAll('#modal-root table tbody tr td.wild-ops');
        return tds.length ? tds[0].textContent.replace(/\s+/g, ' ').trim() : '';
      })()
    };
  });
  chk('排序 = 采集 → 驻军 → 荒漠7 → 山9 → 山4（938|939|942|940|941）',
    r1.coords.slice(0, 5).join('|') === '938,938|939,939|942,942|940,940|941,941',
    r1.coords.slice(0, 5).join('|'));
  chk('操作列末位「放弃」= 红 + wild-drop（防误触分组）', r1.dropRed, r1.dropCls);
  chk('列表页不直接执行（无 arm，只有 ask）', r1.listNoArm);
  chk('面板无纵向溢出', r1.overflow <= 0, 'overflow=' + r1.overflow);
  console.log('    首行操作列文本: ' + r1.lastOps);
  await p.locator('#modal-root .modal').screenshot({ path: OUT + 'v89154-wilds.png' });

  /* ---------- ② 放弃两段确认（上膛） ---------- */
  console.log('===== ② 放弃二次确认（上膛式） =====');
  await p.evaluate(function () {
    var b = document.querySelector('#modal-root [data-action="wild-abandon-ask"]');
    if (b) b.click();
  });
  await p.waitForTimeout(250);
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var seg = document.querySelector('#modal-root').innerHTML;
    var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    return {
      hasArm: seg.indexOf('data-action="wild-abandon-arm"') >= 0,
      noRevoke: seg.indexOf('不可撤销') >= 0,
      cost3: seg.indexOf('将失去加成') >= 0 && seg.indexOf('撤回驻军') >= 0 && seg.indexOf('撤回采集队') >= 0,
      overflow: panel ? panel.scrollHeight - panel.clientHeight : -1
    };
  });
  chk('确认窗：上膛按钮 + 明写「不可撤销」+ 逐项代价', r2.hasArm && r2.noRevoke && r2.cost3);
  chk('确认窗无纵向溢出', r2.overflow <= 0, 'overflow=' + r2.overflow);
  await p.locator('#modal-root .modal').screenshot({ path: OUT + 'v89154-abandon-ask.png' });

  /* 连点两次：第一次只上膛，第二次执行 */
  await p.evaluate(function () {
    var b = document.querySelector('#modal-root [data-action="wild-abandon-arm"]');
    if (b) b.click();
  });
  await p.waitForTimeout(200);
  var r3a = await p.evaluate(function () {
    var b = document.querySelector('#modal-root [data-action="wild-abandon-arm"]');
    return { txt: b ? b.textContent.trim() : '(无)', alive: !!window.GAME.map.wildAt(938, 938) };
  });
  chk('第一次点击只上膛（文案变「再点一次」· 野地仍在）', /再点一次/.test(r3a.txt) && r3a.alive, r3a.txt);
  await p.locator('#modal-root .modal').screenshot({ path: OUT + 'v89154-abandon-armed.png' });
  await p.evaluate(function () {
    var b = document.querySelector('#modal-root [data-action="wild-abandon-arm"]');
    if (b) b.click();
  });
  await p.waitForTimeout(250);
  var r3b = await p.evaluate(function () {
    return { gone: !window.GAME.map.wildAt(938, 938) };
  });
  chk('第二次点击才执行（938 消失）', r3b.gone);
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await p.waitForTimeout(120);

  /* ---------- ③ 改建完成 → 回城外大界面 ---------- */
  console.log('===== ③ 改建完成 → 直接回城外大界面 =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('ext');
    G.ui.closeAllModals();
    G.ui.openExtModal(0);
  });
  await p.waitForTimeout(250);
  await p.evaluate(function () {
    var b = document.querySelector('#modal-root [data-action="ext-convert-ask"]');
    if (b) b.click();
  });
  await p.waitForTimeout(300);
  var r4 = await p.evaluate(function () {
    var seg = document.querySelector('#modal-root').innerHTML;
    var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    return {
      title: seg.indexOf('改建 · 净化厂') >= 0,
      cost: seg.indexOf('改建费') >= 0,
      overflow: panel ? panel.scrollHeight - panel.clientHeight : -1
    };
  });
  chk('改建选择面板（标题含「改建 · 净化厂」+ 改建费）', r4.title && r4.cost);
  chk('改建面板无纵向溢出', r4.overflow <= 0, 'overflow=' + r4.overflow);
  await p.locator('#modal-root .modal').screenshot({ path: OUT + 'v89154-convert-panel.png' });
  /* 整页对照图（弹窗打开 = 有遮罩态）—— 与"关闭后"的 convert-back 做亮度对照 */
  await p.screenshot({ path: OUT + 'v89154-convert-open.png' });

  await p.evaluate(function () {
    var b = document.querySelector('#modal-root [data-action="ext-convert"]:not([disabled])');
    if (b) b.click();
  });
  await p.waitForTimeout(300);
  var r5 = await p.evaluate(function () {
    var G = window.GAME;
    var cell = G.extGridOf(G.currentCity())[0];
    return {
      stack: (G.ui._modalStack || []).length,
      noPanel: document.querySelector('#modal-root').innerHTML.indexOf('inner-panel') < 0,
      cell: JSON.stringify(cell)
    };
  });
  chk('改建完成 → 弹窗一次关净（stack=0 · 无面板残留）', r5.stack === 0 && r5.noPanel, 'stack=' + r5.stack);
  chk('地块真被改建（farm → 其他 · 等级保留 Lv2）', r5.cell.indexOf('"lv":2') >= 0 && r5.cell.indexOf('"type":"farm"') < 0, r5.cell);
  await p.screenshot({ path: OUT + 'v89154-convert-back.png' });

  chk('无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error('CRASH: ' + (e && e.stack || e)); process.exit(1); });
