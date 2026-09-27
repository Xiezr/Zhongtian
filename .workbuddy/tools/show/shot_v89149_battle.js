'use strict';
/* v89.149 实机验收（真浏览器 · 1680×1000）—— 老板 7 条：
   ① 战斗声望（即时结算真账 + 战报行）② 动作设置**每回合可重设**（改完不回弹）③ 一字简称
   ④ 默认「同兵种」+ 无「目标：」前缀 ⑤ 战场条拉到回合记录上方（高度拉高）⑥ 无「左侧设动作/目标」
   ⑦ 读数统一「最近距离 / 全局」
   跑法：node .workbuddy/tools/show/shot_v89149_battle.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
var S = 'E:/Deepseekdb/.workbuddy/shots/';

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 造局（首局 · 即时结算路径）---------- */
  var r0 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验149', cityName: '许都', region: '豫州', mapSeed: 20260949 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var xc = c.cells.filter(function (x) { return x.build && x.build.id === 'xiaochang'; })[0];
    if (xc) xc.build.lvl = 8;
    c.army = { changqiang: 30000, gongjian: 8000, qingji: 3000 };
    var g = st.generals[0]; g.stamina = 999; g.energy = 999;
    /* 选靶：Lv5+ 且必有守将的野地（确定性） */
    var wl = null;
    for (var rr = 3; rr <= 14 && !wl; rr++) {
      for (var dy = -rr; dy <= rr && !wl; dy++) {
        for (var dx = -rr; dx <= rr && !wl; dx++) {
          var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
          if (!tl || G.map.wildAt(x, y) || (G.map.npcAt && G.map.npcAt(x, y))) continue;
          var lv = G.map.wildLevelNow(x, y);
          if (!(lv >= 5)) continue;
          var wd = G.wildDefenseAt(x, y, lv);
          if (wd && wd.gen) wl = { x: x, y: y, lv: lv, gen: wd.gen.name };
        }
      }
    }
    if (!wl) return { err: 'no-target' };
    G.__wl149 = wl;
    return { ok: true, wl: wl, gen: g.id, rep0: st.rep || 0 };
  });
  console.log('造局: ' + JSON.stringify(r0));
  if (!r0.ok) { await b.close(); process.exit(1); }

  /* ---------- ① 声望（即时结算真账）---------- */
  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.state, c = G.currentCity();
    var gen = null; st.generals.forEach(function (g2) { if (g2.id === G.__g149) gen = g2; });
    gen = gen || st.generals[0];
    gen.stamina = 999; gen.energy = 999;
    st.settings.battleWatch = false;                       /* 即时结算（一次性把路径跑通） */
    var rep0 = st.rep || 0;
    var r = G.battle.expedition({ kind: 'wild', x: G.__wl149.x, y: G.__wl149.y }, 'occupy',
      { changqiang: 20000 }, gen.id, {});
    var g = (r.result || {}).repGain || null;
    var txt = r.result ? G.battle.reportText('野地', { changqiang: 20000 }, gen, r.result) : '';
    return { ok: r.ok, rep0: rep0, rep1: st.rep || 0, gain: g && g.gain,
      lost: g && g.lost, coef: g && g.coef, ratio: g && g.ratio,
      reportHas: txt.indexOf('声望</span> +') >= 0, expHas: !!r.result.expGain };
  });
  console.log('① 声望：' + JSON.stringify(r1));
  chk('① 真打一场 → 声望真涨（账 = 公式值）', r1.rep1 - r1.rep0 === r1.gain && r1.gain > 0,
    'rep ' + r1.rep0 + ' → ' + r1.rep1 + ' (+' + r1.gain + ')');
  chk('① 声望随歼灭军力/兵力比（有口径可查）', r1.lost > 0 && r1.coef >= 0.4,
    '歼灭军力 ' + r1.lost + ' · 兵比 ' + r1.ratio + ' ×' + r1.coef);
  chk('① 战报正文有「声望 +N」行', r1.reportHas === true);

  /* ---------- 造观战局（界面复核用）---------- */
  var r2 = await p.evaluate(function () {
    var G = window.GAME, st = G.state, c = G.currentCity();
    var gen = st.generals[0]; gen.stamina = 999; gen.energy = 999;
    c.army = { changqiang: 30000, gongjian: 8000, qingji: 3000 };
    st.settings.battleWatch = true;
    var wl = G.__wl149;
    /* 双兵种（两行）—— 才能验"不动的那支保持原样"与铺满口径 */
    var r = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'raid', { changqiang: 9000, gongjian: 4000 }, gen.id, {});
    var rec = null; (st.battles || []).forEach(function (bb) { rec = bb; });
    if (!rec) return { err: 'no-rec', msg: r.msg || '' };
    G.ui.openBattlefield(rec.id);
    return { ok: true, recId: rec.id };
  });
  console.log('观战造局: ' + JSON.stringify(r2));
  if (!r2.ok) { console.log('  ⚠️ 观战局失败：' + JSON.stringify(r2)); }
  await p.waitForTimeout(600);

  /* ---------- ⑤ 布局（拉高）+ ③ 行内占用 ---------- */
  var m = await p.evaluate(function () {
    function R(sel) { var e = document.querySelector(sel); if (!e) return null;
      var r = e.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) }; }
    var out = {
      wrap: R('#bt-wrap'), top: R('#bt-wrap .bt-top'), board: R('#bt-wrap .bt-board'),
      field: R('#bt-wrap .bt-field'), log: R('#bt-wrap .bt-log'),
      sideA: R('#bt-wrap #bt-side-atk'),
      row: R('#bt-wrap #bt-side-atk .bt-card'),
      name: R('#bt-wrap #bt-side-atk .bt-rnm'),
      sel1: R('#bt-wrap #bt-side-atk .bt-l1 .bt-sel'),
      sel2: R('#bt-wrap #bt-side-atk .bt-l2 .bt-sel'),
      nameTxt: (document.querySelector('#bt-wrap #bt-side-atk .bt-rnm') || {}).textContent,
      units: []
    };
    Array.prototype.forEach.call(document.querySelectorAll('#bt-wrap #bt-field .bt-unit'), function (u) {
      var r = u.getBoundingClientRect();
      out.units.push({ cls: u.className.split(' ')[1], y: Math.round(r.top - out.field.y), hh: Math.round(r.height) });
    });
    out.fieldBottomToLogTop = (out.log && out.field) ? (out.log.y - out.field.b) : null;
    return out;
  });
  console.log('布局: ' + JSON.stringify({ field: m.field, board: m.board, log: m.log, gapToLog: m.fieldBottomToLogTop,
    sideA: m.sideA, units: m.units.map(function (u) { return u.cls + '@' + u.y; }) }));
  chk('⑤ 战场条填满 board 行（底边到回合记录 ≤ 20px —— 改前实测 140px）',
    m.field && m.fieldBottomToLogTop != null && m.fieldBottomToLogTop <= 20,
    '差 ' + m.fieldBottomToLogTop + 'px · 场高 ' + m.field.h + ' vs 行高 ' + m.board.h);
  var uMax = 0; m.units.forEach(function (u) { if (u.y > uMax) uMax = u.y; });
  var uMin = 1e9; m.units.forEach(function (u) { if (u.y < uMin) uMin = u.y; });
  chk('⑤ 兵牌纵向铺满（首枚贴顶 y≤2 · 末枚贴底 y+牌高≥场高−2）',
    m.units.length >= 2 && uMin <= 2 && (uMax + 30) >= m.field.h - 2,
    '首 y=' + uMin + ' · 末 y=' + uMax + '+30 vs 场高 ' + m.field.h);
  chk('③ 名称位 = 一字简称（全名在悬停）', (m.nameTxt || '').length === 1, JSON.stringify(m.nameTxt));
  chk('③ 两个下拉不再被挤（名称列宽 ≤ 20px · 两下拉合计 ≥ 行宽 − 30）',
    m.name.w <= 20 && (m.sel1.w + m.sel2.w) >= (m.row.w - 30),
    '名 ' + m.name.w + ' · 下拉 ' + m.sel1.w + '+' + m.sel2.w + ' / 行 ' + m.row.w);

  /* ---------- ④ 目标下拉（首项同兵种 · 无前缀）+ ⑦ 读数 + ⑥ 备注 ---------- */
  var d = await p.evaluate(function () {
    var sel = document.querySelector('#modal-root [data-action="bt-target"]');
    var board = document.querySelector('#bt-board');
    var gap = document.getElementById('bt-gap');
    var st = document.querySelector('#modal-root [data-action="bt-stance"]');
    return {
      opts: sel ? Array.prototype.map.call(sel.options, function (o) { return o.value + '=' + o.textContent; }) : [],
      selVal: sel ? sel.value : '',
      hasPrefix: !!board && (board.innerHTML || '').indexOf('目标：') >= 0,
      gapTxt: gap ? gap.textContent : '',
      hasHint: !!document.querySelector('#modal-root .bt-hint'),
      stanceVal: st ? st.value : '', stanceTxt: st ? st.selectedOptions[0].textContent : '',
      ab: (document.querySelector('#bt-wrap #bt-side-atk .bt-rnm') || {}).textContent
    };
  });
  console.log('④ 目标下拉: ' + JSON.stringify(d.opts) + ' · 选中=' + JSON.stringify(d.selVal));
  chk('④ 首项「同兵种」· 次项「任意」· 敌兵种只写名字 · 无「目标：」前缀',
    d.opts.length >= 2 && d.opts[0].indexOf('同兵种') >= 0 && d.opts[1] === '=任意'
    && d.hasPrefix === false, d.opts.join(' | '));
  chk('④ 默认动作 = 前进', d.stanceTxt === '前进' && d.stanceVal === 'advance', d.stanceTxt);
  chk('⑦ 读数 =「最近距离 X / 全局 D」', /最近距离/.test(d.gapTxt) && /全局/.test(d.gapTxt), d.gapTxt);
  chk('⑥ 无「左侧设动作/目标」备注', d.hasHint === false);

  /* ---------- ② 每回合可重设（先完成一回合，再改 → 不回弹）---------- */
  var r3 = await p.evaluate(function () {
    var G = window.GAME, rec = null;
    (G.state.battles || []).forEach(function (bb) { rec = bb; });
    if (!rec) return { err: 'no-rec' };
    G.battle.stepBattle(rec.id);
    return { round: rec.round };
  });
  await p.waitForTimeout(1100);
  var r4 = await p.evaluate(function () {
    var sel = document.querySelector('#modal-root [data-action="bt-stance"]');
    if (!sel) return { err: 'no-select' };
    var tk = sel.getAttribute('data-troop');
    sel.value = 'hold';
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    return { troop: tk };
  });
  await p.waitForTimeout(350);
  var r5 = await p.evaluate(function (tkA) {
    var G = window.GAME, rec = null;
    (G.state.battles || []).forEach(function (bb) { rec = bb; });
    var sel = document.querySelector('#modal-root [data-action="bt-stance"][data-troop="' + tkA + '"]');
    var all = document.querySelectorAll('#modal-root [data-action="bt-stance"]');
    var others = [];
    Array.prototype.forEach.call(all, function (s2) {
      if (s2.getAttribute('data-troop') !== tkA) others.push(s2.getAttribute('data-troop') + '=' + s2.value);
    });
    return { domVal: sel ? sel.value : '(缺)', cmd: JSON.stringify(rec && rec.cmd),
      cmdObj: (rec && rec.cmd) || {}, others: others, hist: (rec && rec.history || []).length };
  }, r4.troop || '');
  console.log('② 重设：troop=' + r4.troop + ' → ' + JSON.stringify(r5));
  chk('② 第 2 回合改动作 → **不回弹**（DOM = 命令 · 改前实测跳回 advance）',
    r5.domVal === 'hold' && (r5.cmd || '').indexOf('"s":"hold"') >= 0,
    'dom=' + r5.domVal + ' cmd=' + r5.cmd);
  chk('② 没动的那几支保持原样（不动则继承 · 且未进命令表）',
    r5.others.length >= 1 && r5.others.every(function (x) { return /=(advance|)$/.test(x); })
    && Object.keys((r5.cmdObj || {})).length === 1,
    r5.others.join(' ') + ' · cmd 键数=' + Object.keys(r5.cmdObj || {}).length);
  chk('② 命令进 history（逐回合快照 —— 读档重放同源）', r5.hist >= 1, 'history=' + r5.hist);

  /* ---------- 截图 ---------- */
  await p.screenshot({ path: S + 'v89149-bt-after.png' });
  await p.locator('#bt-wrap .bt-board').screenshot({ path: S + 'v89149-board-after.png' });

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
