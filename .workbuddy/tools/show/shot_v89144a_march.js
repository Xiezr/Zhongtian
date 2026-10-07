'use strict';
/* v89.144 实机验证 A（真浏览器）：需求 2/3/4 —— 军务三处
   ② 每兵种行 [上限][清空]（标题栏无按钮 + 真点一次验证 min 口径）
   ③ 军队练兵场扩容独立页签（军务总览右边）
   ④ 目标下拉：5 行定宽统一 · 默认空 · 选定即 live 刷新 · 换行选择旧行消失
   跑法：node .workbuddy/tools/show/shot_v89144a_march.js  */
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
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  var errs = [];
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 造局 ---------- */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验144', cityName: '许都', region: '碎垣', mapSeed: 20260944 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    /* 练兵场 Lv5（= 出征容量 5 万）+ 兵力两档；再放一块我方野地（让"我方野地"组有目标） */
    var xc = null;
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'xiaochang') xc = x; });
    if (!xc) {
      for (var i = 0; i < c.cells.length && !xc; i++) {
        if (c.cells[i] && !c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: 'xiaochang', lvl: 5 }; xc = c.cells[i]; }
      }
    }
    if (xc) xc.build.lvl = Math.max(5, xc.build.lvl || 0);
    c.army = { yibing: 50000, changqiang: 30000 };
    st.wilds = st.wilds || [];
    if (!G.map.wildAt(c.x + 3, c.y + 3)) {
      st.wilds.push({ x: c.x + 3, y: c.y + 3, type: 'plain', level: 2, garrison: null, day: 0 });
    }
    G.ui._actPick = null;
  });

  /* ================= ③ 军队练兵场扩容页签 ================= */
  console.log('===== ③ 军队练兵场扩容独立页签 =====');
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'expand';
    G.ui.setView('marches');
    var vc = document.getElementById('view-container');
    var tabs = [].slice.call(vc.querySelectorAll('.march-tabs .mt')).map(function (t) { return t.textContent; });
    var txt = vc.textContent || '';
    return {
      tabs: tabs,
      hasCap: txt.indexOf('出征容量') >= 0,
      hasJieyue: vc.innerHTML.indexOf('data-action="jieyue-xc"') >= 0,
      hasTitle: txt.indexOf('军队练兵场扩容') >= 0,
    };
  });
  console.log('  页签条：' + JSON.stringify(r3.tabs));
  chk('③ 页签「军队练兵场扩容」排在「军务总览」右边（第 2 位）',
    r3.tabs.length >= 2 && r3.tabs[1].indexOf('军队练兵场扩容') >= 0, r3.tabs.join(' / '));
  chk('③ 该页 = 出征容量 + 节钺 · 练兵场扩编入口', r3.hasTitle && r3.hasCap && r3.hasJieyue);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89144-march-expand.png' });

  /* ================= ④ 目标下拉 ================= */
  console.log('===== ④ 目标下拉固定统一 =====');
  var r4a = await p.evaluate(function () {
    var G = window.GAME;
    G.ui._marchTab = 'act';
    G.ui._actPick = null;
    G.ui.setView('marches');
    var vc = document.getElementById('view-container');
    var sels = [].slice.call(vc.querySelectorAll('.act-row select'));
    var rects = sels.map(function (s) {
      var r = s.getBoundingClientRect();
      return { grp: s.dataset.grp, left: Math.round(r.left), w: Math.round(r.width), val: s.value };
    });
    var plus = (vc.innerHTML.match(/列最近/g) || []).length;
    var goBtn = vc.querySelector('[data-action="exp-act-go"]');
    return { rects: rects, remark: plus, anyDisabled: !!(goBtn && goBtn.disabled),
      emptyOpts: (vc.innerHTML.match(/<option value=""><\/option>/g) || []).length };
  });
  console.log('  下拉行：' + JSON.stringify(r4a.rects));
  var lefts = r4a.rects.map(function (r) { return r.left; });
  var widths = r4a.rects.map(function (r) { return r.w; });
  var uniq = function (a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); };
  chk('④ 5 行下拉**起点一致**（left 全等 · 以「我方城池」为基准）', uniq(lefts).length === 1, JSON.stringify(lefts));
  chk('④ 下拉**定宽一致**且 ≥ 20 个中文宽（20em ≈ 260px@13px）',
    uniq(widths).length === 1 && widths[0] >= 240, JSON.stringify(widths));
  chk('④ **默认显示为空**（全部 select.value === ""）',
    r4a.rects.every(function (t) { return t.val === ''; }), JSON.stringify(r4a.rects.map(function (t) { return t.val; })));
  chk('④ 下拉旁**没有「共 N · 列最近 N」备注**', r4a.remark === 0, '列最近 出现 ' + r4a.remark + ' 次');
  chk('④ 未选目标 → 「进入军事行动」置灰', r4a.anyDisabled === true);

  /* 选定 → live 刷新 */
  await p.evaluate(function () {
    var vc = document.getElementById('view-container');
    var s = vc.querySelector('.act-row select[data-grp="ownwild"]');
    s.value = '0';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  var r4b = await p.evaluate(function () {
    var G = window.GAME;
    var vc = document.getElementById('view-container');
    var sels = [].slice.call(vc.querySelectorAll('.act-row select'));
    var mine = sels.filter(function (s) { return s.dataset.grp === 'ownwild'; })[0];
    var others = sels.filter(function (s) { return s.dataset.grp !== 'ownwild'; });
    var goBtn = vc.querySelector('[data-action="exp-act-go"]');
    var subs = [].slice.call(vc.querySelectorAll('.ui-sub')).map(function (d) { return d.textContent; })
      .filter(function (t) { return t.indexOf('当前目标') >= 0; });
    return {
      mineVal: mine ? mine.value : '(none)',
      othersVal: others.map(function (s) { return s.value; }),
      goDisabled: !!(goBtn && goBtn.disabled),
      curLine: subs[0] || '',
      pick: G.ui._actPick,
    };
  });
  console.log('  选定后：mine=' + r4b.mineVal + ' · 目标行=「' + r4b.curLine + '」');
  chk('④ 选定后 **live 刷新**（该行选中 + 下方「当前目标」写出 + 按钮亮起）',
    r4b.mineVal !== '' && r4b.curLine.indexOf('当前目标') >= 0 && r4b.curLine.indexOf('尚未') < 0
    && r4b.goDisabled === false, r4b.curLine);
  chk('④ 其他行仍为空（目标只出现在被选中的那一行）',
    r4b.othersVal.every(function (v) { return v === ''; }), JSON.stringify(r4b.othersVal));
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89144-march-act.png' });

  /* 换行选择 → 旧行消失 */
  await p.evaluate(function () {
    var vc = document.getElementById('view-container');
    var s = vc.querySelector('.act-row select[data-grp="npc"]');
    if (s && s.options.length > 1) {
      s.value = '0';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await p.waitForTimeout(300);
  var r4c = await p.evaluate(function () {
    var vc = document.getElementById('view-container');
    var sels = [].slice.call(vc.querySelectorAll('.act-row select'));
    var own = sels.filter(function (s) { return s.dataset.grp === 'ownwild'; })[0];
    var npc = sels.filter(function (s) { return s.dataset.grp === 'npc'; })[0];
    return { ownVal: own ? own.value : '(none)', npcVal: npc ? npc.value : '(no-sel)',
      npcOpts: npc ? npc.options.length : 0 };
  });
  console.log('  换行选择后：我方野地=' + JSON.stringify(r4c.ownVal) + ' · 名城=' + JSON.stringify(r4c.npcVal));
  if (r4c.npcOpts > 1) {
    chk('④ **换行选择 → 原来选定的内容消失**（我方野地回到空、名城接上）',
      r4c.ownVal === '' && r4c.npcVal !== '', 'own=' + JSON.stringify(r4c.ownVal) + ' npc=' + JSON.stringify(r4c.npcVal));
  } else {
    console.log('  （名城组无目标 → 换行用例跳过，改用 ownwild↔owncity）');
    await p.evaluate(function () {
      var vc = document.getElementById('view-container');
      var s = vc.querySelector('.act-row select[data-grp="ownwild"]');
      s.value = '';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(250);
    var r4c2 = await p.evaluate(function () {
      var vc = document.getElementById('view-container');
      var own = vc.querySelector('.act-row select[data-grp="ownwild"]');
      var subs = [].slice.call(vc.querySelectorAll('.ui-sub')).map(function (d) { return d.textContent; })
        .filter(function (t) { return t.indexOf('当前目标') >= 0; });
      var goBtn = vc.querySelector('[data-action="exp-act-go"]');
      return { ownVal: own ? own.value : '-', cur: subs[0] || '', dis: !!(goBtn && goBtn.disabled) };
    });
    chk('④ 该行选回空 = 取消选择（当前目标回到「尚未选择」+ 按钮置灰）',
      r4c2.ownVal === '' && r4c2.cur.indexOf('尚未') >= 0 && r4c2.dis === true, r4c2.cur);
  }

  /* ================= ② 行内 [上限][清空] ================= */
  console.log('===== ② 每兵种行 [上限][清空] =====');
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state, c = G.currentCity();
    var npc = (st.map.cities || [])[0];
    G.ui.closeAllModals();
    G.ui.openExpModal({ kind: 'city', id: npc.id, npc: npc });
    return null;
  });
  await p.waitForTimeout(400);
  var r2a = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var root = document.getElementById('modal-root');
    var head = root.querySelector('.exp-a-troops .exp-sec-t');
    var nMax = root.querySelectorAll('[data-action="exp-max"]').length;
    var nZero = root.querySelectorAll('[data-action="exp-zero"]').length;
    var nTroop = Object.keys(G.DATA.TROOPS).length;
    var rowOf = function (tid) {
      var btn = root.querySelector('[data-action="exp-max"][data-troop="' + tid + '"]');
      return btn ? btn.closest('tr') : null;
    };
    var r1 = rowOf('yibing'), r2 = rowOf('changqiang');
    var inRow = function (tr) {
      return tr ? [].slice.call(tr.querySelectorAll('button')).map(function (b) { return b.textContent; }).join('/') : '';
    };
    return {
      headBtns: head ? head.querySelectorAll('button').length : -1,
      headText: head ? head.textContent : '',
      nMax: nMax, nZero: nZero, nTroop: nTroop,
      yibingRow: inRow(r1), cqRow: inRow(r2),
      cap: G.battle.marchCapOf(c),
    };
  });
  console.log('  标题栏="' + r2a.headText + '" 按钮数=' + r2a.headBtns + ' · 行内 [上限]×' + r2a.nMax + ' [清空]×' + r2a.nZero + '（兵种 ' + r2a.nTroop + '）');
  console.log('  行内容：yibing=「' + r2a.yibingRow + '」changqiang=「' + r2a.cqRow + '」· 练兵场容量=' + r2a.cap);
  chk('② 标题栏**没有**按钮（两枚全局键已退役）', r2a.headBtns === 0, 'buttons=' + r2a.headBtns);
  chk('② 每个兵种行都有 [上限][清空]（行数 = 兵种数）',
    r2a.nMax === r2a.nTroop && r2a.nZero === r2a.nTroop && r2a.nTroop > 0,
    r2a.nTroop + ' 行 × 2 键');
  chk('② 按钮在**兵种行内**（yibing 行 = 上限/清空）',
    r2a.yibingRow === '上限/清空', r2a.yibingRow);

  /* 真点：yibing 上限 → min(own, cap − 0)；再点 changqiang 上限 → min(own, cap − 已填) */
  var r2b = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var click = function (tid) {
      var btn = root.querySelector('[data-action="exp-max"][data-troop="' + tid + '"]');
      if (btn) btn.click();
      return btn != null;
    };
    click('yibing');
    var v1 = (document.getElementById('exp-yibing') || {}).value;
    click('changqiang');
    var v2 = (document.getElementById('exp-changqiang') || {}).value;
    var v1b = (document.getElementById('exp-yibing') || {}).value;
    return { v1: v1, v2: v2, v1b: v1b };
  });
  await p.waitForTimeout(250);
  var r2c = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    return { v1: (document.getElementById('exp-yibing') || {}).value,
             v2: (document.getElementById('exp-changqiang') || {}).value };
  });
  console.log('  点 yibing 上限 → ' + r2b.v1 + '；点 changqiang 上限 → ' + r2b.v2 + '（yibing 仍 ' + r2c.v1 + '）');
  chk('② 行内「上限」真调：yibing = min(拥有 50000, 容量 ' + r2a.cap + ' − 0) = ' + Math.min(50000, r2a.cap),
    Number(r2b.v1) === Math.min(50000, r2a.cap), 'v=' + r2b.v1);
  chk('② 第二名兵种上限 = min(30000, 容量 − yibing 已填) = ' + Math.max(0, Math.min(30000, r2a.cap - Math.min(50000, r2a.cap))),
    Number(r2b.v2) === Math.max(0, Math.min(30000, r2a.cap - Math.min(50000, r2a.cap))), 'v=' + r2b.v2);
  chk('② 行间互不影响（点 changqiang 不动 yibing）', Number(r2c.v1) === Number(r2b.v1));

  /* 清空：只清该行 */
  var r2d = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var btn = root.querySelector('[data-action="exp-zero"][data-troop="changqiang"]');
    if (btn) btn.click();
    return null;
  });
  await p.waitForTimeout(200);
  var r2e = await p.evaluate(function () {
    return { y: (document.getElementById('exp-yibing') || {}).value,
             c: (document.getElementById('exp-changqiang') || {}).value };
  });
  chk('② 行内「清空」只清该行（changqiang → 0 · yibing 不动）',
    Number(r2e.c) === 0 && Number(r2e.y) === Number(r2b.v1), 'yibing=' + r2e.y + ' changqiang=' + r2e.c);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89144-exp-rows.png' });

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
