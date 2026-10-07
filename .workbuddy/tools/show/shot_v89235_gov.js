'use strict';
/* v89.235 实机验证：① 政务厅格等级角标位置（与普通格子同构 · 都在格顶名称行内）
   ② 城外面板：政务厅 Lv1 时被闸 → 报「需政务厅 Lv2」；抬到 Lv2 → 升级键可用
   跑法：node .workbuddy/tools/show/shot_v89235_gov.js
   产物：.workbuddy/shots/v89235-gov-badge.png · v89235-ext-blocked.png · v89235-ext-ok.png */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var R = 'E:/Deepseekdb/';
var SHOTS = R + '.workbuddy/shots/';
var CHROME = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var pass = 0, fail = 0;
function chk(name, ok, extra) {
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  ok ? pass++ : fail++;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var browser = await pw.chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await sleep(1000);
  /* 建局 + 造局（政务厅 Lv1 + 城外净化厂 Lv1 + 资源） */
  var setup = await page.evaluate(function () {
    var G = window.GAME;
    if (!G.state) { G.newGame({ name: '验235', cityName: '灰岗', mapSeed: 20261007 }); G.ui.enterGame(); }
    try { G.ui.closeAllModals(); } catch (e) { }
    var st = G.state, c = st.cities[0];
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 9e7; });
    var eg = G.extGridOf(c), idx = -1;
    for (var i = 0; i < eg.length; i++) { if (!eg[i].type && !eg[i].pending) { idx = i; break; } }
    var rb = G.buildExt(idx, 'farm');
    for (var t = 0; t < 300 && st.queues.build.length; t++) G.tickOnce();
    G.ui.setView('city'); G.ui.renderView('city'); G.ui.renderSide();
    return { idx: idx, extOk: eg[idx].type === 'farm' && eg[idx].lv === 1, govLv: G.buildingLevel(c, 'guanfu') };
  }).catch(function (e) { return { err: String(e) }; });
  console.log('造局: ' + JSON.stringify(setup));
  await sleep(800);

  /* ===== ① 政务厅角标位置（实机几何 · rect ÷k） ===== */
  console.log('===== ① 政务厅角标位置 =====');
  var m1 = await page.evaluate(function () {
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    function R2(el) { var r = el.getBoundingClientRect(); return { l: r.left / k, t: r.top / k, r: r.right / k, b: r.bottom / k, w: r.width / k, h: r.height / k, cy: (r.top + r.bottom) / 2 / k }; }
    var gp = document.querySelector('.gov-palace');
    if (!gp) return { miss: 'gov-palace 不在 DOM' };
    var badge = gp.querySelector('.tile-badge');
    var nm = gp.querySelector('.tile-label .nm');
    var label = gp.querySelector('.tile-label');
    if (!badge || !nm || !label) return { miss: 'badge/nm/label 缺', hasB: !!badge, hasN: !!nm };
    var rb = R2(badge), rn = R2(nm), rl = R2(label), rg = R2(gp);
    /* 对照：普通格子（民房）的 badge */
    var norm = document.querySelector('.iso-tile.built .tile-badge');
    var rnb = norm ? R2(norm) : null;
    var rnn = norm ? R2(norm.closest('.tile-label').querySelector('.nm')) : null;
    return {
      badge: rb, nm: rn, label: rl, gp: rg,
      norm: rnb && rnn ? { badge: rnb, nm: rnn, dTop: Math.abs(rnb.t - rnb.t) } : null,
      govTxt: gp.textContent.slice(0, 20)
    };
  }).catch(function (e) { return { err: String(e) }; });
  if (m1 && m1.badge && m1.nm) {
    var dCY = Math.abs(m1.badge.cy - m1.nm.cy);
    var inRow = m1.badge.l >= m1.nm.r - 8;               /* 角标在名称右侧 */
    var atTop = (m1.badge.t - m1.gp.t) < m1.gp.h / 2;     /* 在格子上半部（格顶） */
    var inLabel = m1.badge.l >= m1.label.l - 2 && m1.badge.r <= m1.label.r + 2;  /* 在 label 行内 */
    chk('①a 政务厅角标与名称同一行（centerY 差 ≤8px）', dCY <= 8, 'dCY=' + dCY.toFixed(1));
    chk('①b 角标在名称右侧（行内并排）· 在 label 行内', inRow && inLabel, JSON.stringify({ bl: +m1.badge.l.toFixed(0), nr: +m1.nm.r.toFixed(0), ll: +m1.label.l.toFixed(0), lr: +m1.label.r.toFixed(0) }));
    chk('①c 角标在格顶区域（上半部）', atTop, 'badge.t-gp.t=' + (m1.badge.t - m1.gp.t).toFixed(0) + ' < ' + (m1.gp.h / 2).toFixed(0));
    chk('①d 与普通格子同构（普通格 badge 也在行内）', !!m1.norm, m1.norm ? 'normDcy≈' + Math.abs(m1.norm.badge.cy - m1.norm.nm.cy).toFixed(1) : '-');
  } else {
    chk('① 政务厅角标取证', false, JSON.stringify(m1).slice(0, 150));
  }
  await sleep(250);
  var gpBox = await page.evaluate(function () {
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    var gp = document.querySelector('.gov-palace');
    if (!gp) return null;
    var r = gp.getBoundingClientRect();
    return { x: r.left / k, y: r.top / k, width: r.width / k, height: r.height / k };
  });
  if (gpBox) await page.screenshot({ path: SHOTS + 'v89235-gov-badge.png', clip: { x: gpBox.x - 30, y: gpBox.y - 30, width: gpBox.width + 60, height: gpBox.height + 60 } });
  else await page.screenshot({ path: SHOTS + 'v89235-gov-badge.png' });

  /* ===== ② 城外面板：卡闸文案 → 抬政务厅 → 升级键 ===== */
  console.log('===== ② 城外面板闸 =====');
  var m2 = await page.evaluate(function (idx) {
    var G = window.GAME;
    G.ui.closeAllModals();
    G.ui.openExtModal(idx);
    var mr = document.querySelector('#modal-root');
    var t = mr ? mr.textContent : '';
    return { hasNeed: t.indexOf('需政务厅 Lv2') >= 0, hasMax: t.indexOf('已达最高等级') >= 0, snip: t.slice(0, 140) };
  }, setup.idx).catch(function (e) { return { err: String(e) }; });
  chk('②a 政务厅 Lv1：城外面板报「需政务厅 Lv2」（而非"已达最高等级"）', m2 && m2.hasNeed === true && m2.hasMax === false, JSON.stringify(m2).slice(0, 160));
  await sleep(300);
  await page.screenshot({ path: SHOTS + 'v89235-ext-blocked.png' });

  var m3 = await page.evaluate(function (idx) {
    var G = window.GAME;
    var st = G.state, c = st.cities[0];
    G.ui.closeAllModals();
    /* 抬政务厅到 Lv2 */
    var gi = -1;
    for (var i = 0; i < c.cells.length; i++) {
      if (c.cells[i].build && c.cells[i].build.id === 'guanfu') { gi = i; break; }
    }
    var rg = G.upgradeAt(c.id, gi);
    for (var t = 0; t < 400 && st.queues.build.length; t++) G.tickOnce();
    var govLv = G.buildingLevel(c, 'guanfu');
    G.ui.openExtModal(idx);
    var mr = document.querySelector('#modal-root');
    var txt = mr ? mr.textContent : '';
    var upBtn = mr ? mr.querySelector('[data-action="ext-upgrade"]') : null;
    var upDisabled = upBtn ? (upBtn.disabled === true || upBtn.classList.contains('dim')) : null;
    return { govLv: govLv, rgOk: rg.ok, hasUp: !!upBtn, upDisabled: upDisabled, hasMax: txt.indexOf('已达最高等级') >= 0 };
  }, setup.idx).catch(function (e) { return { err: String(e) }; });
  chk('②b 抬政务厅 Lv2 后：升级键可用（非禁用/非"已达最高等级"）',
    m3 && m3.govLv === 2 && m3.hasUp === true && m3.upDisabled === false && m3.hasMax === false,
    JSON.stringify(m3).slice(0, 160));
  await sleep(300);
  await page.screenshot({ path: SHOTS + 'v89235-ext-ok.png' });

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
