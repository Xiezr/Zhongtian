'use strict';
/* v89.142 实机验证（真浏览器）：需求 2/3/4 军务界面 + 需求 6 上限填入 + 需求 7 斗将播报
   跑法：node .workbuddy/tools/show/shot_v89142b_ui.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var scene = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260942 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0];
    G.ui._cityId = c.id;
    /* 练兵场 Lv5 → 出征容量 5 万 */
    var xc = c.cells.filter(function (x) { return x.build && x.build.id === 'xiaochang'; })[0];
    if (xc) xc.build.lvl = 5; else {
      var free = c.cells.filter(function (x) { return x && !x.build && !x.official; })[0];
      if (free) free.build = { id: 'xiaochang', lvl: 5 };
    }
    /* 军队：三种兵 */
    c.army = { changqiang: 30000, gongjian: 20000, qingji: 9000 };
    /* 己方野地（plain Lv5）+ 现驻军 8000 → 派驻上限 50000 - 8000 = 42000 */
    var wx = c.x + 2, wy = c.y + 2;
    st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === wx && z.y === wy); });
    st.wilds.push({ x: wx, y: wy, type: 'plain', level: 5, day: 0 });
    var w = G.map.wildAt(wx, wy);
    w.garrison = { troops: { yibing: 8000 }, cityId: c.id, genId: null };
    /* 第二座己方城池（供"调兵"目标） */
    var bx = c.x - 3, by = c.y + 3;
    if (!G.map.wildAt(bx, by)) st.wilds.push({ x: bx, y: by, type: 'plain', level: 2, day: 0 });
    G.buildCityAt(bx, by);
    var c2 = st.cities[st.cities.length - 1];
    c2.name = '二城';
    /* 二城：练兵场 Lv3（容量 3 万）+ 现有兵力 12000 → 上限 18000 */
    var xc2 = c2.cells.filter(function (x) { return x && !x.build && !x.official; })[0];
    if (xc2) xc2.build = { id: 'xiaochang', lvl: 3 };
    c2.army = { yibing: 12000 };
    return { cid: c.id, c2id: c2.id, wx: wx, wy: wy,
      capMain: G.battle.marchCapOf(c), cap2: G.battle.marchCapOf(c2),
      wcap: G.wildGarrisonCap(5) };
  });
  await p.waitForTimeout(600);
  console.log('场景：主城容量 ' + scene.capMain + ' · 二城容量 ' + scene.cap2 + ' · 野地派驻上限 ' + scene.wcap);

  /* ================= 需求 6：上限填入（三种目标） ================= */
  console.log('===== 需求 6：兵力表头「上限」自动填入 =====');
  function fillVia(targetKind) {
    return p.evaluate(function (kind) {
      var G = window.GAME, c = G.currentCity();
      try { G.ui.closeAllModals(); } catch (e) { }
      var tg;
      if (kind === 'city') {
        var nc = (G.state.map.cities || [])[0];
        tg = { kind: 'city', id: nc.id, npc: nc };
      } else if (kind === 'ownwild') {
        var w = (G.state.wilds || [])[0];
        tg = { kind: 'wild', x: w.x, y: w.y };
      } else if (kind === 'owncity') {
        tg = { kind: 'own', id: G.state.cities[1].id };
      }
      G.ui.openExpModal(tg);
      var h = document.getElementById('modal-root').innerHTML;
      var btn = document.querySelector('#modal-root [data-action="exp-fill-all"]');
      if (!btn) return { err: '按钮缺失', hasUpper: h.indexOf('上限') >= 0 };
      var title = btn.getAttribute('title') || '';
      btn.click();                                   /* 走全站委托 → case exp-fill-all */
      var got = 0, per = {};
      Object.keys(G.DATA.TROOPS).forEach(function (id) {
        var el = document.getElementById('exp-' + id);
        if (el && el.value) { per[id] = Number(el.value); got += Number(el.value); }
      });
      return { got: got, per: per, title: title, cap: G.ui.expFillCapOf(c, G.ui._expRes, G.ui._expMode) };
    }, targetKind);
  }
  var r6a = await fillVia('city');
  console.log('  [出征·NPC 城] 上限=' + r6a.cap + ' · 实填=' + r6a.got + ' · ' + JSON.stringify(r6a.per));
  console.log('    title: ' + r6a.title);
  chk('6A 表头按钮 = 「上限」（不是"全带"）', r6a.title.indexOf('上限') >= 0);
  chk('6A 出征类：按练兵场容量填入（30000+20000=50000；伏击车挤不进去）',
    r6a.cap === scene.capMain && r6a.got === scene.capMain, 'cap=' + r6a.cap + ' got=' + r6a.got);

  var r6b = await fillVia('ownwild');
  console.log('  [己方野地·驻守] 上限=' + r6b.cap + ' · 实填=' + r6b.got + ' · ' + JSON.stringify(r6b.per));
  console.log('    title: ' + r6b.title);
  chk('6B 己方野地：按派驻上限 − 现有驻军填入（50000−8000=42000）',
    r6b.cap === 42000 && r6b.got === 42000, 'cap=' + r6b.cap + ' got=' + r6b.got);

  var r6c = await fillVia('owncity');
  console.log('  [己方城池·调兵] 上限=' + r6c.cap + ' · 实填=' + r6c.got + ' · ' + JSON.stringify(r6c.per));
  console.log('    title: ' + r6c.title);
  chk('6C 己方城池：按目标城容量 − 目标城兵力填入（30000−12000=18000）',
    r6c.cap === 18000 && r6c.got === 18000, 'cap=' + r6c.cap + ' got=' + r6c.got);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-exp-cap.png' });

  /* ================= 需求 2/3/4：军务界面 ================= */
  console.log('===== 需求 2/3/4：军务界面（5 类分行 / 按钮底部） =====');
  var r234 = await p.evaluate(function () {
    var G = window.GAME;
    try { G.ui.closeAllModals(); } catch (e) { }
    G.ui._marchTab = 'act';
    G.ui.setView('marches');
    var vc = document.getElementById('view-container');
    var h = vc.innerHTML;
    var out = {};
    /* 需求 2：5 类分行 */
    out.grpLabels = ['我方城池', '我方野地', '名城', '野地', '野外据点']
      .map(function (s) { return h.indexOf(s) >= 0; });
    out.selN = (h.match(/data-action="exp-act-pick"/g) || []).length;
    out.goAfterLast = h.indexOf('exp-act-go') > h.lastIndexOf('exp-act-pick');
    /* 需求 3：出征战术页 —— 按钮在正文之后 */
    G.ui._marchTab = 'exp';
    G.ui.setView('marches');
    var h2 = document.getElementById('view-container').innerHTML;
    out.expTabAfter = h2.indexOf('data-action="exp-tac-sub"') > h2.indexOf('tac-grid');
    out.expTabHasBoth = h2.indexOf('🚩 占领战术') >= 0 && h2.indexOf('🔥 掠夺战术') >= 0;
    /* 需求 4：防守战术页 —— 两个小页都按钮在底部 */
    G.ui._marchTab = 'def';
    G.ui._defSub = 'tac';
    G.ui.setView('marches');
    var h3 = document.getElementById('view-container').innerHTML;
    out.defTacAfter = h3.indexOf('data-action="def-sub"') > h3.indexOf('tac-grid');
    G.ui._defSub = 'over';
    G.ui.setView('marches');
    var h4 = document.getElementById('view-container').innerHTML;
    out.defOverAfter = h4.indexOf('data-action="def-sub"') > h4.indexOf('class="tbl"');
    out.defTabHasBoth = h4.indexOf('🛡️ 全境防御') >= 0 && h4.indexOf('⚔️ 防守战术') >= 0;
    return out;
  });
  console.log('  ' + JSON.stringify(r234));
  chk('2 五类目标行齐备 + 5 个下拉 + 按钮在所有下拉之后（底部）',
    r234.grpLabels.every(Boolean) && r234.selN === 5 && r234.goAfterLast, JSON.stringify(r234.grpLabels));
  chk('3 出征战术页：小页按钮在战术表之后（底部）+ 两个按钮在册',
    r234.expTabAfter && r234.expTabHasBoth);
  chk('4 防守战术页：两个小页的按钮都在正文之后（底部）+ 两个按钮在册',
    r234.defTacAfter && r234.defOverAfter && r234.defTabHasBoth);
  await p.evaluate(function () { window.GAME.ui._marchTab = 'act'; window.GAME.ui.setView('marches'); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-march-act.png' });
  await p.evaluate(function () { window.GAME.ui._marchTab = 'exp'; window.GAME.ui.setView('marches'); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-march-exp.png' });
  await p.evaluate(function () { window.GAME.ui._marchTab = 'def'; window.GAME.ui._defSub = 'tac'; window.GAME.ui.setView('marches'); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89142-march-def.png' });

  /* 需求 7（斗将播报）另立单主题脚本：shot_v89142c_duel.js
     —— 组合脚本在 1920×1080 + 三连截图后渲染进程会崩（实机踩过），单拆更稳。 */

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 6)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
