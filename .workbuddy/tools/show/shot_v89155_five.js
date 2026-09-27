'use strict';
/* v89.155 实机验证（真浏览器）：
   ① 公文铺满（系统页 21 条 · 底部空隙实测）+ 战报页 18 份
   ② 召回三态（红 → 黄[上膛] → 绿[无驻军]）：出图 + DOM 量
   ③ 商城排序标号（攻击四鼓 → 复合件组成组）
   ④ 城外面板「另加仓储上限」+ 空地 tip 无 undefined
   跑法：node .workbuddy/tools/show/shot_v89155_five.js */
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
    var st = G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260927 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 40 条消息（铺满量测） */
    for (var i = 1; i <= 40; i++) G.log('§测消息 ' + i + '：这是一条用于量测铺满的测试消息，内容中等长度，用于观察行距与底部空隙。', 'sys', 'gather');
    /* 3 份战报 */
    for (var j = 0; j < 3; j++) st.reports.unshift({ rid: 700 + j, title: '§测战报 ' + j, win: j % 2 === 0, day: 10 + j, fav: false, text: 'fake', t: Date.now() });
    /* 5 片野地：961-965（前两片带驻军） */
    st.wilds = [
      { x: 961, y: 961, type: 'lake', level: 5, day: 0, startDay: 0 },
      { x: 962, y: 962, type: 'hill', level: 8, day: 0, startDay: 0 },
      { x: 963, y: 963, type: 'forest', level: 3, day: 0, startDay: 0 },
      { x: 964, y: 964, type: 'caoyuan', level: 6, day: 0, startDay: 0 },
      { x: 965, y: 965, type: 'desert', level: 2, day: 0, startDay: 0 }
    ];
    st.gathers = [];
    var gen = st.generals[0];
    gen.status = 'garrison';
    st.wilds[0].garrison = { troops: { changqiang: 5000 }, cityId: c.id, genId: gen.id };
    st.wilds[1].garrison = { troops: { changqiang: 800, gongjian: 400 }, cityId: c.id, genId: gen.id };
    /* 城外 farm Lv6（容量行） */
    G.extGridOf(c)[8] = { id: 'e9', type: 'farm', lv: 6 };
    G.ui.setView('reports');
  });
  await p.waitForTimeout(800);

  /* ---------- ① 公文铺满 ---------- */
  console.log('===== ① 公文铺满（系统页） =====');
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var k = G.ui.appKOf ? G.ui.appKOf() : 1;
    var vc = document.getElementById('view-container');
    var lines = document.querySelectorAll('#msg-feed .bb-line');
    var last = lines[lines.length - 1];
    var vcR = vc.getBoundingClientRect();
    var gap = (vcR.bottom - last.getBoundingClientRect().bottom) / k;
    return {
      per: G.ui.docPerOf('sys'), rows: lines.length,
      bottomGap: +gap.toFixed(1),
      scroll: vc.scrollHeight - vc.clientHeight,
      lineH: +(lines[0].getBoundingClientRect().height / k).toFixed(2)
    };
  });
  console.log('    ' + JSON.stringify(r1));
  chk('系统页每页 ' + r1.per + ' 条（旧固定 15）', r1.per === 21 && r1.rows === 21, r1.rows + ' 行');
  chk('消息区**铺满到底**（末行距底 ≤ 60px · 旧行为 ~172px 空白）', r1.bottomGap >= 0 && r1.bottomGap <= 60, 'gap=' + r1.bottomGap);
  chk('整页无滚动（分页兜住）', r1.scroll <= 2, 'scroll=' + r1.scroll);
  await p.locator('#view-container').screenshot({ path: OUT + 'v89155-doc-sys.png' });
  /* 战报页 */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._docTab = 'war';
    G.ui.setView('reports');
  });
  await p.waitForTimeout(400);
  var r1b = await p.evaluate(function () {
    var G = window.GAME;
    return { per: G.ui.docPerOf('war'), bars: document.querySelectorAll('#doc-body .doc-bar').length };
  });
  console.log('    战报页 per=' + r1b.per + ' bars=' + r1b.bars);
  chk('战报页每页 18 份（旧固定 10）', r1b.per === 18, 'per=' + r1b.per);
  await p.locator('#view-container').screenshot({ path: OUT + 'v89155-doc-war.png' });

  /* ---------- ② 召回三态 ---------- */
  console.log('===== ② 召回三态（红→黄→绿） =====');
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openWilds();
    var b1 = document.querySelector('#modal-root [data-action="wild-withdraw"][data-x="961"]');
    return b1 ? b1.className : '(无)';
  });
  chk('红态就位（有驻军）', r2.indexOf('red') >= 0, r2);
  await p.locator('#modal-root .modal').screenshot({ path: OUT + 'v89155-wilds-red.png' });
  /* 点一下 → 黄 */
  await p.evaluate(function () {
    var b1 = document.querySelector('#modal-root [data-action="wild-withdraw"][data-x="961"]');
    if (b1) b1.click();
  });
  await p.waitForTimeout(250);
  var r3 = await p.evaluate(function () {
    var b1 = document.querySelector('#modal-root [data-action="wild-withdraw"][data-x="961"]');
    return { cls: b1 ? b1.className : '(无)', txt: b1 ? b1.textContent.trim() : '' };
  });
  console.log('    上膛态 = ' + r3.cls + ' / ' + r3.txt);
  chk('黄态（上膛 · 文案「再点一次」）', r3.cls.indexOf('gold') >= 0 && /再点一次/.test(r3.txt), r3.txt);
  await p.locator('#modal-root .modal').screenshot({ path: OUT + 'v89155-wilds-gold.png' });
  /* 连点第二次 → 执行 → 绿 */
  await p.evaluate(function () {
    var b1 = document.querySelector('#modal-root [data-action="wild-withdraw"][data-x="961"]');
    if (b1) b1.click();
  });
  await p.waitForTimeout(300);
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var b1 = document.querySelector('#modal-root [data-action="wild-withdraw"][data-x="961"]');
    var w = G.map.wildAt(961, 961);
    return {
      cls: b1 ? b1.className : '(无)', disabled: b1 ? b1.disabled : null,
      garrisonGone: !w || !w.garrison || G.wildGarrisonTotal(w.garrison) === 0,
      landPanel: (document.querySelector('#modal-root') || {}).innerHTML.indexOf('op-zone-t">地块操作') >= 0
    };
  });
  console.log('    执行后 = ' + r4.cls + ' disabled=' + r4.disabled);
  chk('执行后变绿（无驻军 · disabled）', r4.cls.indexOf('green') >= 0 && r4.disabled === true, r4.cls);
  chk('驻军已清空', r4.garrisonGone);
  chk('未弹地块面板（直接在列表里变绿）', !r4.landPanel);
  await p.locator('#modal-root .modal').screenshot({ path: OUT + 'v89155-wilds-green.png' });
  await p.evaluate(function () { window.GAME.ui.closeAllModals(); });

  /* ---------- ③ 商城排序 ---------- */
  console.log('===== ③ 商城排序标号 =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._shopCat = 'military_buff';
    G.ui.setView('shop');
  });
  await p.waitForTimeout(400);
  var r5 = await p.evaluate(function () {
    return Array.prototype.slice.call(document.querySelectorAll('#view-container [data-action="shop-buy"]'))
      .slice(0, 10).map(function (b) { return b.dataset.item; });
  });
  console.log('    前 10 位 = ' + r5.join(' → '));
  chk('攻击四鼓 → 复合件组（同功能相邻升序）', (function () {
    var exp = ['xianzhenzhangu', 'pozhengu', 'xuezhanqi', 'mieguogu', 'gongshou_fu', 'quanjun_ling', 'wanquan_ce', 'tianshi_ling'];
    return r5.slice(0, 8).join(',') === exp.join(',');
  })(), r5.slice(0, 8).join(','));
  await p.locator('#view-container').screenshot({ path: OUT + 'v89155-shop-order.png' });

  /* ---------- ④ 城外容量行 ---------- */
  console.log('===== ④ 城外资源建筑容量 =====');
  var r6 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openExtModal(8);
    var seg = document.querySelector('#modal-root').innerHTML;
    var m = seg.match(/另加仓储上限<\/span><span class="v good">([^<]*)</);
    return { cap: m ? m[1] : '(无)', hasCap: seg.indexOf('另加仓储上限') >= 0 };
  });
  console.log('    面板容量行 = ' + r6.cap);
  chk('已建面板含「另加仓储上限」（farm Lv6 = +200.0万）', r6.hasCap && r6.cap === '+200.0万', r6.cap);
  await p.locator('#modal-root .modal').screenshot({ path: OUT + 'v89155-ext-store.png' });
  /* 空地 tip */
  var r7 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.extGridOf(G.currentCity())[9] = { id: 'e10', type: null, lv: 0 };
    G.ui.openExtModal(9);
    var seg = document.querySelector('#modal-root').innerHTML;
    var m = seg.match(/title="([^"]*产地[^"]*)"/);
    return { tip: m ? m[1] : '(无)', noUndef: seg.indexOf('undefined') < 0 };
  });
  console.log('    空地 tip = ' + r7.tip);
  chk('空地 tip 无 undefined + 含「每级另加仓储上限」',
    r7.noUndef && r7.tip.indexOf('每级另加仓储上限') >= 0, r7.tip.slice(0, 70));
  await p.locator('#modal-root .modal').screenshot({ path: OUT + 'v89155-ext-tip.png' });

  chk('无页面运行时错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.error('CRASH: ' + (e && e.stack || e)); process.exit(1); });
