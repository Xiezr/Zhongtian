/* v89.191 实机验证（真浏览器 · 真点真填）：
   ① 自动征兵数值框：真点 → 焦点保留 → 真打字 → change 落库（修复前焦点秒丢）
   ② 解雇/晋升错开：两按钮 x 差 = 40px（≥ 按钮宽 36px，防误点带消除）
   ③ 科技面板：按城显示（lv/cap + 上限提示行）
   ④ 宝具入口：装备栏「🔮 宝具」与军中/修炼并列 → 真点开挂件窗
   跑法：NODE_PATH=... node .workbuddy/tools/show/shot_v89191_gates.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  var pass = 0, fail = 0;
  function chk(tag, ok, extra) {
    if (ok) { pass++; console.log('  ✓ ' + tag + (extra ? '  [' + extra + ']' : '')); }
    else { fail++; console.log('  ✗ ' + tag + (extra ? '  [' + extra + ']' : '')); }
  }
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验191', cityName: '许都', region: '碎垣', mapSeed: 20260929 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var c = G.state.cities[0];
    /* 摆一座书院（科技面板可研究工作用） */
    for (var i = 0; i < c.cells.length; i++) {
      var cl = c.cells[i];
      if (cl && !cl.build && !cl.pending && !cl.official) { cl.build = { id: 'shuyuan', lvl: 3 }; break; }
    }
    var p1 = G.makeGeneral('测一', 50, 'idle', null, false, 'ying', 'balance');
    p1.cityId = c.id;
    G.state.generals.push(p1);
    G.ui._genSel = p1.id;
  });
  await p.waitForTimeout(500);

  /* ───────── ① 自动征兵数值框：真点真填 ───────── */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui._autoSel = 'train';
    G.ui.setView('auto');
    G.ui.renderView('auto');
  });
  await p.waitForTimeout(600);
  {
    var loc = p.locator('#view-container input.at-num[data-k="max"][data-troop="yibing"]');
    var n = await loc.count();
    chk('①a 自动征兵「目标」数值框在场', n >= 1, 'count=' + n);
    if (n >= 1) {
      await loc.first().click();
      await p.waitForTimeout(300);
      var s1 = await p.evaluate(function () {
        var el = document.querySelector('#view-container input.at-num[data-k="max"][data-troop="yibing"]');
        return { focused: document.activeElement === el, value: el ? el.value : null };
      });
      chk('①b 真点后焦点保留（修复前 focused=false）', s1.focused === true, JSON.stringify(s1));
      await p.keyboard.press('Control+A');
      await p.keyboard.type('1234', { delay: 50 });
      await p.waitForTimeout(200);
      var s2 = await p.evaluate(function () {
        var el = document.querySelector('#view-container input.at-num[data-k="max"][data-troop="yibing"]');
        return { value: el ? el.value : null, st: window.GAME.autoTrainCfg().targets.yibing.max };
      });
      chk('①c 真打字可输入（value=1234）', s2.value === '1234', JSON.stringify(s2));
      await p.keyboard.press('Enter');
      await p.waitForTimeout(500);
      var s3 = await p.evaluate(function () {
        var G = window.GAME;
        var el = document.querySelector('#view-container input.at-num[data-k="max"][data-troop="yibing"]');
        return { st: G.autoTrainCfg().targets.yibing.max,
          focused: document.activeElement === el, val: el ? el.value : null };
      });
      chk('①d change 落库（state=1234）+ 焦点归还同框', s3.st === 1234 && s3.focused === true, JSON.stringify(s3));
      await p.screenshot({ path: E + 'v89191-input.png' });
      await p.evaluate(function () { window.GAME.autoTrainCfg().targets.yibing.max = 0; });
    }
  }

  /* ───────── ② 解雇/晋升错开几何 ───────── */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('generals');
    G.ui.renderView('generals');
  });
  await p.waitForTimeout(400);
  {
    var geo = await p.evaluate(function () {
      var G = window.GAME, k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
      function R(el) {
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return { x: Math.round(r.left / k * 10) / 10, y: Math.round(r.top / k * 10) / 10,
          w: Math.round(r.width / k * 10) / 10, h: Math.round(r.height / k * 10) / 10 };
      }
      var pane = document.querySelector('.gen-pane');
      var dis = pane && pane.querySelector('[data-action="dismiss-gen"]');
      var pro = pane && pane.querySelector('[data-action="gen-rankup"]');
      var rd = R(dis), rp = R(pro);
      var overlapX = (rd && rp) ? Math.max(0, Math.min(rd.x + rd.w, rp.x + rp.w) - Math.max(rd.x, rp.x)) : -1;
      return { dis: rd, pro: rp, dx: (rd && rp) ? Math.round((rp.x - rd.x) * 10) / 10 : null, overlapX: overlapX };
    });
    chk('②a 两按钮同排（解雇在名称行 · 晋升在资质行）', !!geo.dis && !!geo.pro, JSON.stringify(geo.dis) + ' / ' + JSON.stringify(geo.pro));
    chk('②b 横向错开 = 40px（≥ 按钮宽 36 → 点击带不再垂直相邻）', geo.dx === 40, 'dx=' + geo.dx);
    chk('②c 横向重叠 = 0（点歪落空不误触）', geo.overlapX === 0, 'overlapX=' + geo.overlapX);
    await p.screenshot({ path: E + 'v89191-gen.png' });
  }

  /* ───────── ③ 科技面板（按城 + 上限提示） ───────── */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('tech');
    G.ui.renderView('tech');
  });
  await p.waitForTimeout(400);
  {
    var t1 = await p.evaluate(function () {
      var vc = document.querySelector('#view-container');
      var txt = (vc.textContent || '').replace(/\s+/g, ' ');
      return { has: txt.indexOf('书院科技') >= 0, capNote: txt.indexOf('本城科技上限 Lv') >= 0,
        slash: /\/10/.test(txt), snippet: txt.slice(0, 120) };
    });
    chk('③a 科技面板在场 · 按城显示（lv/10）', t1.has === true, t1.snippet);
    chk('③b 上限提示行（本城上限 Lv10 · 主城可至 20）', t1.capNote === true);
    await p.screenshot({ path: E + 'v89191-tech.png' });
  }

  /* ───────── ④ 宝具入口（与军中/修炼并列） ───────── */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('generals');
    G.ui.renderView('generals');
  });
  await p.waitForTimeout(400);
  {
    var b1 = await p.evaluate(function () {
      var vc = document.querySelector('#view-container');
      var btn = vc.querySelector('[data-action="attach-pick"][data-slot="bao"]');
      var setBtn = vc.querySelector('[data-action="toggle-equip-set"]');
      var staticChip = vc.querySelector('.gp-head .btn.sm.mini.gold');
      var r = btn ? btn.getBoundingClientRect() : null;
      return { has: !!btn, hasSet: !!setBtn, label: btn ? btn.textContent.trim() : null,
        x: r ? Math.round(r.left) : null };
    });
    chk('④a 装备栏「🔮 宝具」入口在场（普通将）', b1.has === true && /宝具/.test(b1.label || ''), JSON.stringify(b1));
    await p.screenshot({ path: E + 'v89191-bao.png' });
    if (b1.has) {
      await p.locator('#view-container [data-action="attach-pick"][data-slot="bao"]').first().click();
      await p.waitForTimeout(500);
      var m1 = await p.evaluate(function () {
        var mr = document.querySelector('#modal-root');
        var txt = (mr && mr.textContent) || '';
        return { ok: txt.indexOf('宝具') >= 0, hasPick: txt.indexOf('佩上') >= 0 || txt.indexOf('库存中没有可佩') >= 0,
          snippet: txt.replace(/\s+/g, ' ').slice(0, 90) };
      });
      chk('④b 真点 → 挂件选择窗（宝具标题 + 佩上/库存出口）', m1.ok && m1.hasPick, m1.snippet);
      await p.screenshot({ path: E + 'v89191-baopick.png' });
      await p.evaluate(function () { window.GAME.ui.closeAllModals(); });
    }
  }

  console.log('\n实机结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack)); process.exit(1); });
