'use strict';
/* v89.151 实机验证 A（真浏览器）：底栏两按钮 + 指挥战斗闪烁 + 悬停富浮层 + 侧栏版式 + 距离读数
   跑法：node .workbuddy/tools/show/shot_v89151a_battle.js */
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
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ============ 造局：挂起一场带守将的野地战 ============ */
  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260951 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var xc = c.cells.filter(function (x) { return x.build && x.build.id === 'xiaochang'; })[0];
    if (xc) xc.build.lvl = 9;
    c.army = { changqiang: 30000, qingji: 4000, gongjian: 6000 };
    var g = st.generals[0]; g.stamina = 999; g.energy = 999;
    var wl = null;
    for (var rr = 3; rr <= 14 && !wl; rr++) {
      for (var dy = -rr; dy <= rr && !wl; dy++) {
        for (var dx = -rr; dx <= rr && !wl; dx++) {
          var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
          if (!tl || G.map.wildAt(x, y) || (G.map.npcAt && G.map.npcAt(x, y))) continue;
          var lv = G.map.wildLevelNow(x, y);
          if (!(lv >= 7)) continue;
          var wd = G.wildDefenseAt(x, y, lv);
          if (wd && wd.gen) wl = { x: x, y: y, lv: lv, gen: wd.gen.name };
        }
      }
    }
    if (!wl) return { err: 'no-target' };
    st.settings.battleWatch = true;
    var r = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'raid',
      { changqiang: 6000, qingji: 3000 }, g.id, {});
    var rec = null; (st.battles || []).forEach(function (bb) { rec = bb; });
    if (!rec) return { err: 'no-rec', msg: r.msg };
    return { ok: true, recId: rec.id, wl: wl };
  });
  console.log('造局: ' + JSON.stringify(r1));
  if (!r1.ok) { console.log('结果：' + PASS + ' 通过 / ' + (FAIL + 1) + ' 失败'); await b.close(); process.exit(1); }

  /* ============ ① 底栏：两枚同级按钮 + 文案动态 ============ */
  console.log('===== ① 底栏「隐藏名称 / 指挥战斗」=====');
  await p.waitForTimeout(1400);   /* 等主循环至少跑一拍（闪烁态） */
  var m1 = await p.evaluate(function () {
    var bar = document.getElementById('bottom-bar');
    var tools = bar.querySelector('.bb-tools');
    var lbl = bar.querySelector('.bb-label-toggle');
    var war = bar.querySelector('.bb-war');
    return {
      hasTools: !!tools,
      lblText: lbl ? lbl.textContent.trim() : '',
      warText: war ? war.textContent.trim() : '',
      warBlink: war ? war.classList.contains('blink') : false,
      warAction: war ? war.getAttribute('data-action') : '',
      lblLeft: lbl ? Math.round(lbl.getBoundingClientRect().left) : -1,
      warLeft: war ? Math.round(war.getBoundingClientRect().left) : -1,
      warRight: war ? Math.round(war.getBoundingClientRect().right) : -1,
    };
  });
  console.log('  ' + JSON.stringify(m1));
  chk('① 底栏左侧 .bb-tools 容器 + 两枚同级按钮', m1.hasTools && m1.lblText.length > 0 && m1.warText.length > 0);
  chk('① 「指挥战斗」在「名称」右边（同级 · 左缘更大）', m1.warLeft > m1.lblLeft, m1.warLeft + ' > ' + m1.lblLeft);
  chk('① 「指挥战斗」按钮动作 = battle-list-open', m1.warAction === 'battle-list-open');
  chk('① 有 live 战斗 → 指挥战斗**闪烁**（.blink）', m1.warBlink === true);
  chk('① 「名称」文案 = 隐藏名称（显示中态）', m1.lblText.indexOf('隐藏名称') >= 0, m1.lblText);

  /* 点一下 → 文案变「显示名称」、labels-off 出现；再点回来 */
  var m1b = await p.evaluate(function () {
    var lbl = document.querySelector('#bottom-bar .bb-label-toggle');
    lbl.click();
    return { text: lbl.textContent.trim(), off: document.body.classList.contains('labels-off') };
  });
  await p.waitForTimeout(150);
  var m1c = await p.evaluate(function () {
    var lbl = document.querySelector('#bottom-bar .bb-label-toggle');
    return { text: lbl.textContent.trim(), off: document.body.classList.contains('labels-off') };
  });
  console.log('  点击后：' + JSON.stringify(m1c));
  chk('① 隐藏后文案变「显示名称」+ body.labels-off', m1c.text.indexOf('显示名称') >= 0 && m1c.off === true, m1c.text);
  await p.evaluate(function () { document.querySelector('#bottom-bar .bb-label-toggle').click(); });
  await p.waitForTimeout(150);
  var m1d = await p.evaluate(function () {
    return { text: document.querySelector('#bottom-bar .bb-label-toggle').textContent.trim(),
      off: document.body.classList.contains('labels-off') };
  });
  chk('① 再点复原（显示名称→隐藏名称 · labels-off 归位）', m1d.text.indexOf('隐藏名称') >= 0 && m1d.off === false, m1d.text);

  /* ============ ② 指挥战斗 → 清单弹窗（真点） ============ */
  console.log('===== ② 指挥战斗清单（真点按钮）=====');
  await p.evaluate(function () { document.querySelector('#bottom-bar .bb-war').click(); });
  await p.waitForTimeout(300);
  var m2 = await p.evaluate(function () {
    var root = document.getElementById('modal-root');
    var tbl = root.querySelector('table.tbl');
    return { open: !!root.querySelector('.gold-heading'), head: root.textContent.slice(0, 60),
      rows: root.querySelectorAll('table.tbl tbody tr').length, hasGo: !!root.querySelector('[data-action="bt-open"]') };
  });
  console.log('  ' + JSON.stringify(m2));
  chk('② 弹出「战斗待指挥」清单（表格 + 观战键）', m2.open && m2.rows >= 1 && m2.hasGo);

  /* ============ ③ 打开战场 → 悬停富浮层 ============ */
  console.log('===== ③ 兵种悬停富浮层（真 mouseover）=====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var rec = null; (G.state.battles || []).forEach(function (bb) { rec = bb; });
    G.ui.openBattlefield(rec.id);
  });
  await p.waitForTimeout(600);
  var m3 = await p.evaluate(function () {
    /* 悬停我方第一枚兵牌（真实 mouseover 委托路径） */
    var el = document.querySelector('#bt-field .bt-unit.atk');
    if (!el) return { err: 'no-unit' };
    el.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
    return { troop: el.getAttribute('data-troop'), tipEl: el.getAttribute('data-tip-el') };
  });
  await p.waitForTimeout(300);
  var m3b = await p.evaluate(function () {
    var tip = document.getElementById('tip-layer');
    return { cls: tip ? tip.className : '', text: tip ? (tip.textContent || '').slice(0, 300) : '(无)',
      hasCnt: tip ? /cnt-good|cnt-bad|无相克/.test(tip.innerHTML || '') : false,
      // 颜色实测：取一个 .cnt-good/.cnt-bad 元素的计算色
      goodColor: (function () { var e = tip && tip.querySelector('.tip-l.cnt-good'); return e ? getComputedStyle(e).color : ''; })(),
      badColor: (function () { var e = tip && tip.querySelector('.tip-l.cnt-bad'); return e ? getComputedStyle(e).color : ''; })(),
    };
  });
  console.log('  tip: ' + JSON.stringify(m3b));
  chk('③ 兵牌悬停触发富浮层（#tip-layer.on · 走 data-tip-el）', m3.tipEl === '1' && /on/.test(m3b.cls), m3b.cls);
  chk('③ 浮层含「全军血量 / 全军攻击 / 全军防御」三行', /全军血量/.test(m3b.text) && /全军攻击/.test(m3b.text) && /全军防御/.test(m3b.text));
  chk('③ 浮层有克制/被克行（含无色分支）', m3b.hasCnt === true);
  chk('③ 血不是零（计算值真实）', !/血量 0\b/.test(m3b.text) && /全军血量/.test(m3b.text), m3b.text.slice(0, 80));

  /* ============ ④ 侧栏版式（简称同宽 · 下拉等长居右 · 居中） ============ */
  console.log('===== ④ 侧栏版式 =====');
  var m4 = await p.evaluate(function () {
    /* ⚠️ rect 是**视觉尺寸**（被 #app-scale 的 transform 乘过）→ 一律 ÷k 还原成画布单位再比（§63.4） */
    var sc = document.getElementById('app-scale');
    var k = sc ? (sc.getBoundingClientRect().width / sc.offsetWidth) : 1;
    function R(el) { var r = el.getBoundingClientRect();
      return { l: Math.round(r.left / k), r: Math.round(r.right / k), w: Math.round(r.width / k), t: Math.round(r.top / k) }; }
    var card = document.querySelector('#bt-side-atk .bt-card') || document.querySelector('.bt-card');
    if (!card) return { err: 'no-card' };
    var nm = card.querySelector('.bt-rnm');
    var cnt = card.querySelector('.bt-rn');
    var sel1 = card.querySelector('.bt-l1 .bt-sel');
    var sel2 = card.querySelector('.bt-l2 .bt-sel');
    var sideH = document.querySelector('.bt-side-h');
    var gen = document.querySelector('.bt-side .bt-gen');
    var cs = function (el, p) { return el ? getComputedStyle(el)[p] : ''; };
    return {
      nmW: nm ? R(nm).w : -1, cntW: cnt ? R(cnt).w : -1,
      nmFs: cs(nm, 'fontSize'), nmFw: cs(nm, 'fontWeight'),
      sel1W: sel1 ? R(sel1).w : -1, sel2W: sel2 ? R(sel2).w : -1,
      sel1R: sel1 ? R(sel1).r : -1, sel2R: sel2 ? R(sel2).r : -1,
      sideAlign: cs(sideH, 'textAlign'), genJust: cs(gen, 'justifyContent'),
    };
  });
  console.log('  ' + JSON.stringify(m4));
  chk('④ 简称与数量同宽（48px · 已 ÷k 还原画布单位）', m4.nmW === m4.cntW && m4.nmW === 48, m4.nmW + ' vs ' + m4.cntW);
  chk('④ 简称字号已放大（13px · 700）', m4.nmFs === '13px' && m4.nmFw === '700', m4.nmFs + '/' + m4.nmFw);
  chk('④ 行动/目标两下拉**等长**（±1px）', m4.sel1W > 0 && Math.abs(m4.sel1W - m4.sel2W) <= 1, m4.sel1W + ' vs ' + m4.sel2W);
  chk('④ 两下拉右缘对齐（居右）', Math.abs(m4.sel1R - m4.sel2R) <= 1, m4.sel1R + ' vs ' + m4.sel2R);
  chk('④ 我军/敌军表头居中 · 将领行居中', m4.sideAlign === 'center' && m4.genJust === 'center',
    m4.sideAlign + ' / ' + m4.genJust);

  /* ============ ⑤ 距离读数 ============ */
  var m5 = await p.evaluate(function () {
    var g = document.getElementById('bt-gap');
    return { text: g ? g.textContent.replace(/\s+/g, ' ').trim() : '(无)', title: g ? g.getAttribute('title') : '' };
  });
  console.log('  读数: ' + JSON.stringify(m5.text));
  chk('⑤ 距离读数 =「距离 XX / XX」（无「最近距离/全局」字样）',
    /^距离 /.test(m5.text) && m5.text.indexOf('最近距离') < 0 && m5.text.indexOf('全局') < 0, m5.text);

  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89151-bt-hover.png' });
  console.log('浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 4)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
