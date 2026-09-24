/* ============================================================
 * probe_v89120_report_nav.js — 「战报异常跳转」复现探针
 * ------------------------------------------------------------
 * 老板原话：「我点掠夺战报的下一页，弹出来一个侦察报告」
 * 取证目标（真浏览器 + 真点击）：
 *   ① 掠报正文页上到底有哪些按钮（action / 文案 / key）—— 找"下页"的真身
 *   ② 每步的 ui._modalPageRender 是否残留（null?）与众 _repView
 *   ③ 穷举操作序列，找出"点了之后弹出侦察报告"的那一条
 *   ④ 列表级「下页 ›」（page 动作）会不会误触弹窗回调
 * 用法：node .workbuddy/tools/probe/probe_v89120_report_nav.js
 * ============================================================ */
'use strict';
var path = require('path');
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  page.on('pageerror', function (e) { errs.push(String(e && e.message).slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 建局 + 造两份报告 ---------- */
  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '报', cityName: '许都' });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame && G.ui.enterGame();
    G.ui.closeAllModals();
    var c = G.currentCity();
    /* 找一格低等级野地（真打一场掠夺） */
    var tgt = null, CMAX = G.COORD_MAX || 499;
    for (var dx = -8; dx <= 8 && !tgt; dx++) {
      for (var dy = -8; dy <= 8 && !tgt; dy++) {
        if (!dx && !dy) continue;
        var xx = c.x + dx, yy = c.y + dy;
        if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
        var tl = G.map.tile(xx, yy);
        if (!tl || tl.terrain === 'city') continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
        if (lv >= 1 && lv <= 4) tgt = { x: xx, y: yy, lv: lv };
      }
    }
    if (!tgt) return { err: 'no wild' };
    /* 真打：足够兵力保证赢 */
    c.army = { yibing: 3000, changqiang: 1500, gongjian: 800 };
    var g = (st.generals || []).filter(function (x) { return !x.status || x.status === 'idle'; })[0];
    if (!g) return { err: 'no gen' };
    g.cityId = c.id; g.status = 'idle';
    if (G.setStaNow) G.setStaNow(g, 200); g.energy = 200;
    st.settings = st.settings || {}; st.settings.battleWatch = false;
    var d = G.march.dispatch({ kind: 'wild', x: tgt.x, y: tgt.y, name: '试野地', lv: tgt.lv },
      'raid', JSON.parse(JSON.stringify(c.army)), g.id, null, null, null);
    if (!d || d.ok === false) return { err: 'dispatch:' + ((d && d.msg) || '-') };
    (st.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
    G.march.tick();
    /* 再造一份侦察报告（结构照 battle.js 的真件） */
    st.reports.unshift({
      t: Date.now() - 60000, type: 'scout',
      title: '侦查回报 · 试野地',
      body: '【守军】义兵 ×120<br>【情报层级】侦察技巧 Lv1',
      loot: [], win: true,
      intel: { lv: 1, target: '试野地' },
      scout: { kind: 'wild', name: '试野地', lv: tgt.lv, x: tgt.x, y: tgt.y },
    });
    var raidI = -1, scoutI = -1;
    (st.reports || []).forEach(function (r, i) {
      if (raidI < 0 && r.type !== 'scout') raidI = i;
      if (scoutI < 0 && r.type === 'scout') scoutI = i;
    });
    return { raidI: raidI, scoutI: scoutI, nReports: st.reports.length, wild: tgt };
  });
  if (boot.err) { console.log('⛔ 建局失败：' + boot.err); await browser.close(); process.exit(1); }
  console.log('建局：reports=' + boot.nReports + ' 掠报 i=' + boot.raidI + ' 侦察 i=' + boot.scoutI);

  /* 报告字段体检 */
  var fields = await page.evaluate(function (o) {
    var G = window.GAME, R = G.state.reports;
    function f(r) {
      return { title: r.title, type: r.type, scene: !!r.scene, roundsText: r.scene ? (r.scene.roundsText || []).length : -1,
        replay: !!(r.replay && r.replay.frames && r.replay.frames.length),
        sandbox: !!r.sandbox, rounds: r.scene ? r.scene.rounds : -1 };
    }
    return { raid: f(R[o.raidI]), scout: f(R[o.scoutI]) };
  }, boot);
  console.log('掠报字段：' + JSON.stringify(fields.raid));
  console.log('侦察字段：' + JSON.stringify(fields.scout));

  /* ---------- 通用：读当前弹窗状态 ---------- */
  async function modalState(label) {
    return await page.evaluate(function () {
      var G = window.GAME, root = document.querySelector('#modal-root');
      var t = root.querySelector('.m-title') || root.querySelector('.gold-heading');
      var rep = G.repByRid(G.ui._repId);          /* v89.120：身份 rid */
      var btns = [];
      root.querySelectorAll('[data-action]').forEach(function (e) {
        var tx = (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 16);
        var key = e.getAttribute('data-key') ? ('#' + e.getAttribute('data-key') + '/' + (e.getAttribute('data-n') || '')) : '';
        /* 只收"翻页/导航"类按钮，避免刷屏 */
        var a = e.getAttribute('data-action');
        if (/mpage|page|sd-|rep-|view-report|sd-text/.test(a)) btns.push(a + key + ' 「' + tx + '」');
      });
      return {
        title: t ? (t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 46) : '(无弹窗)',
        repId: G.ui._repId, repTitle: rep ? rep.title : '(无效身份)',
        hasRenderFn: !!G.ui._modalPageRender, stack: (G.ui._modalStack || []).length,
        view: G.ui.view, pageRlog: G.ui._pages['rlog'] || 1,
        navBtns: btns.slice(0, 12),
      };
    });
  }
  function show(label, st) {
    console.log('\n【' + label + '】');
    console.log('  弹窗：' + st.title + '　| 层数 ' + st.stack + ' | renderFn ' + (st.hasRenderFn ? '有' : '无'));
    console.log('  _repId=' + st.repId + ' → ' + st.repTitle + '　| rlog 第 ' + st.pageRlog + ' 页');
    console.log('  导航按钮：' + (st.navBtns.length ? st.navBtns.join('　') : '(无)'));
  }
  async function click(sel) {
    return await page.evaluate(function (s) {
      var e = document.querySelector(s);
      if (!e) return false;
      e.click();
      return true;
    }, sel);
  }
  async function wait(ms) { await new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- 序列 1：掠报 → 正文 → 点「下页 ›」 ---------- */
  console.log('\n================ 序列 1：干净状态看掠报 ================');
  await page.evaluate(function (i) { window.GAME.ui.viewReport(i); }, boot.raidI);
  await wait(500);
  show('掠报打开（viewReport）', await modalState());
  /* 若在沙盘：切到正文 */
  var inSd = await click('[data-action="sd-text"]');
  if (inSd) { await wait(500); show('沙盘 → 点「📜 战报正文」', await modalState()); }
  /* 找 rlog 的「下页 ›」 */
  var hasNext = await page.evaluate(function () {
    return !!document.querySelector('#modal-root [data-action="mpage"][data-key="rlog"]');
  });
  console.log('  掠报正文页有 rlog 翻页条：' + hasNext);
  if (hasNext) {
    await click('#modal-root [data-action="mpage"][data-key="rlog"]:not([disabled])');
    await wait(500);
    show('点「下页 ›」（rlog/mpage）之后', await modalState());
  }

  /* ---------- 序列 2：先看侦察报告、再开掠报、再点下页 ---------- */
  console.log('\n================ 序列 2：先侦察 → 后掠报 ================');
  await page.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await wait(120);
  await page.evaluate(function (i) { window.GAME.ui.viewReport(i); }, boot.scoutI);
  await wait(400);
  show('打开侦察报告（viewReport i_scout）', await modalState());
  await page.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await wait(120);
  await page.evaluate(function (i) { window.GAME.ui.viewReport(i); }, boot.raidI);
  await wait(500);
  var inSd2 = await click('[data-action="sd-text"]');
  if (inSd2) { await wait(400); }
  show('再开掠报（进正文）', await modalState());
  var hasNext2 = await page.evaluate(function () {
    return !!document.querySelector('#modal-root [data-action="mpage"][data-key="rlog"]');
  });
  if (hasNext2) {
    await click('#modal-root [data-action="mpage"][data-key="rlog"]:not([disabled])');
    await wait(500);
    show('点「下页 ›」之后', await modalState());
  } else {
    console.log('  （掠报正文无 rlog 翻页条 —— 该路径不成立）');
  }

  /* ---------- 序列 3：列表级「下页 ›」（page/docwar） ---------- */
  console.log('\n================ 序列 3：公文列表翻页 ================');
  await page.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await wait(120);
  await page.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('reports');
    G.ui._docTab = 'war';
    G.ui.renderView('reports');
  });
  await wait(300);
  var listSt = await page.evaluate(function () {
    var G = window.GAME;
    var root = document.querySelector('#modal-root');
    var bb = document.querySelector('#bottom-bar') || document.body;
    return {
      modalOpen: !!root.innerHTML,
      hasListPager: /data-action="page"/.test(bb.innerHTML || ''),
      pageBtns: (function () {
        var out = [];
        (bb.querySelectorAll ? bb.querySelectorAll('[data-action="page"]') : []).forEach(function (e) {
          out.push((e.textContent || '').trim() + '#' + e.getAttribute('data-key') + '/' + e.getAttribute('data-n'));
        });
        return out.slice(0, 8);
      })(),
      renderFn: !!G.ui._modalPageRender,
    };
  });
  console.log('  列表页：弹窗=' + listSt.modalOpen + ' 底部条分页=' + listSt.hasListPager + ' renderFn=' + listSt.renderFn);
  console.log('  分页按钮：' + listSt.pageBtns.join('　'));
  /* 点列表下页 */
  var clickedPage = await page.evaluate(function () {
    var bb = document.querySelector('#bottom-bar') || document.body;
    var b = null;
    bb.querySelectorAll('[data-action="page"]').forEach(function (e) {
      if (!b && !e.disabled && (e.textContent || '').indexOf('下页') >= 0) b = e;
    });
    if (b) { b.click(); return true; }
    return false;
  });
  await wait(400);
  var afterPage = await modalState('列表翻页后');
  console.log('  点列表「下页 ›」：clicked=' + clickedPage);
  show('列表翻页后', afterPage);

  /* ---------- 序列 4：沙盘里有没有 mpage / 以及 sd 操作后 renderFn ---------- */
  console.log('\n================ 序列 4：沙盘 → 正文 → 下页（先动过工具） ================');
  await page.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await wait(120);
  /* 先开一个别的有 modalPage 的弹窗（装备），制造"残留回调" */
  await page.evaluate(function () {
    var G = window.GAME;
    G.ui.openEquipPanel && G.ui.openEquipPanel();
  });
  await wait(300);
  show('先开装备面板（它登记自己的回调）', await modalState());
  await page.evaluate(function () { window.GAME.ui.closeModal(); });
  await wait(150);
  await page.evaluate(function (i) { window.GAME.ui.viewReport(i); }, boot.raidI);
  await wait(500);
  var inSd4 = await click('[data-action="sd-text"]');
  if (inSd4) { await wait(400); }
  show('关装备 → 开掠报正文', await modalState());
  var hasNext4 = await page.evaluate(function () {
    return !!document.querySelector('#modal-root [data-action="mpage"][data-key="rlog"]');
  });
  if (hasNext4) {
    await click('#modal-root [data-action="mpage"][data-key="rlog"]:not([disabled])');
    await wait(500);
    show('点「下页 ›」之后', await modalState());
  }

  /* ---------- 序列 5：掠报正文「下页」+ 干扰 unshift（需求 1 的核心复现） ---------- */
  console.log('\n================ 序列 5：掠报正文「下页」+ 干扰 unshift ================');
  await page.evaluate(function () { window.GAME.ui.closeAllModals(); });
  await wait(120);
  var s5 = await page.evaluate(function (o) {
    var G = window.GAME;
    var rep = G.state.reports[o.raidI];
    /* 把 roundsText 扩到 15 条（模拟大仗：>12 才显示翻页条） */
    if (rep.scene) {
      var arr = [];
      for (var i = 0; i < 15; i++) arr.push('（扩样）第 ' + (i + 1) + ' 回合　·　间距 ' + (900 - i * 10));
      rep.scene.roundsText = arr;
    }
    var rid = G.repRidOf(rep);
    G.ui.viewReportText(rid);       /* 直接开正文（不绕沙盘） */
    return { rid: rid, title: rep.title };
  }, boot);
  await wait(450);
  show('掠报正文（扩样 15 回合）', await modalState());
  var hasNext5 = await page.evaluate(function () {
    return !!document.querySelector('#modal-root [data-action="mpage"][data-key="rlog"]:not([disabled])');
  });
  console.log('  有 rlog 翻页条：' + hasNext5);
  if (hasNext5) {
    /* 干扰：点「下页」之前来一份新侦察报告（unshift 位移）—— 这正是老板遇到的场景 */
    var clickedNext = await page.evaluate(function () {
      window.GAME.state.reports.unshift({ t: Date.now(), type: 'scout', title: '【干扰】新侦查回报', body: 'x', win: true });
      /* 点**真·下页**（data-n="2"）—— 之前首版选中的是第一个非禁用键（« 首页），页码没动 */
      var el = document.querySelector('#modal-root [data-action="mpage"][data-key="rlog"][data-n="2"]');
      if (el) el.click();
      return !!el;
    });
    console.log('  点的是「下页」（data-n=2）：' + clickedNext);
    await wait(450);
    var st5b = await modalState('点「下页」（期间 unshift 了侦察报告）');
    show('点「下页」（期间 unshift 了侦察报告）', st5b);
    var ok5 = st5b.title.indexOf('侦查') < 0 && st5b.repTitle === s5.title
      && st5b.pageRlog === 2;                      /* 页码真翻到 2（证明重开确实发生） */
    console.log('  ' + (ok5
      ? '✅ 修复有效：仍打开原掠报（未被侦察报告顶替）'
      : '⛔ 仍会跳报告！'));
  }

  console.log('\n页面错误：' + (errs.length ? errs.join(' | ') : '无'));
  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
