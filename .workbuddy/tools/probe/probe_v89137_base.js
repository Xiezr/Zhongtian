/* v89.137 探针：7 条需求的现状取证（真浏览器）
 * ------------------------------------------------------------
 * ① 官府面板：官府要务段的按钮清单（有没有"设为主城"）+ 图标规格
 * ② 战场面板：.bt-log 视高 / 行高 / 可见行数 / 面板下方留白
 * ③ 兵种行悬停：.bt-rrow 有没有 title
 * ④ 附属野地 openWilds：列结构（有没有操作列）
 * ⑤ 出征界面：station（驻守）方式对己方野地可选否
 * ⑥ 建筑专精：mastery 现状（门槛 / 值）
 * 跑法：node .workbuddy/tools/probe/probe_v89137_base.js
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e)); });

  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var init = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260930 });
    if (!st.map.grid) G.map.generate();
    var c = st.cities[0];
    G.ui._cityId = c.id;
    c.army = { yibing: 6000, changqiang: 3000, gongbing: 2000 };
    c.res.gold = 1e7;
    var lord = G.lordGeneralOf();
    lord.status = 'idle'; lord.cityId = c.id;
    G.ui.enterGame();
    try { G.ui.closeAllModals(); } catch (e) { }
    return { cid: c.id, cname: c.name };
  });
  console.log('造局：' + init.cname + ' (' + init.cid + ')');

  /* ══ ① 官府面板 ══ */
  var r1 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    /* 找官府格 idx */
    var idx = null;
    c.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'guanfu') idx = i; });
    var isMain = G.isMainCity(c);
    G.ui.closeAllModals();
    G.ui.openBuildModal(idx, c);
    var root = document.getElementById('modal-root');
    var btns = [];
    Array.prototype.slice.call(root.querySelectorAll('.op-row button, .bldg-acts button')).forEach(function (b) {
      btns.push(b.textContent.trim() + (b.disabled ? '[禁用]' : '') + '|act=' + (b.getAttribute('data-action') || ''));
    });
    var hasSetMain = !!root.querySelector('[data-action="set-main-city"]');
    var opZoneT = root.querySelector('.op-zone-t') ? root.querySelector('.op-zone-t').textContent : '';
    return { idx: idx, isMain: isMain, hasSetMain: hasSetMain, opZoneT: opZoneT, btns: btns,
      mainCityId: (G.state.settings || {}).mainCityId || G.state.mainCityId || null };
  });
  console.log('① 官府面板（isMain=' + r1.isMain + ' · mainCityId=' + r1.mainCityId + '）');
  console.log('   官府要务段标题：' + r1.opZoneT);
  r1.btns.forEach(function (t) { console.log('   · ' + t); });
  console.log('   有"设为主城"按钮：' + r1.hasSetMain);

  /* ①b 主城是别的城时，面板是否显示"设为主城"？ */
  var r1b = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var c = G.currentCity();
    /* 临时把主城设为另一座假城 → 看按钮 */
    var bak = st.settings.mainCityId;
    st.settings.mainCityId = 'FAKE_CITY_ID';
    var idx = null;
    c.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'guanfu') idx = i; });
    G.ui.closeAllModals();
    G.ui.openBuildModal(idx, c);
    var root = document.getElementById('modal-root');
    var hasSetMain = !!root.querySelector('[data-action="set-main-city"]');
    var btnHTML = '';
    var el = root.querySelector('[data-action="set-main-city"]');
    if (el) btnHTML = el.outerHTML;
    st.settings.mainCityId = bak;
    G.ui.closeAllModals();
    return { hasSetMain: hasSetMain, btnHTML: btnHTML };
  });
  console.log('   [对照] 主城指向别城时 hasSetMain=' + r1b.hasSetMain);
  if (r1b.btnHTML) console.log('   按钮 HTML: ' + r1b.btnHTML.slice(0, 200));

  /* ══ ⑥ 建筑专精现状 ══ */
  var r6 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var out = { masteryLen: G.DATA.MASTERY.length, sample: [], tiers: [] };
    G.DATA.MASTERY.slice(0, 3).forEach(function (m) { out.sample.push(m.bid + ':' + m.key + '=' + m.val); });
    /* 民房等级 */
    var mf = 0; c.cells.forEach(function (cell) { if (cell.build && cell.build.id === 'minfang') mf = cell.build.lvl; });
    out.minfangLv = mf;
    out.popPctNow = G.mastery('popPct', c);
    out.masteryOfNow = G.masteryOf(c, 'minfang');
    out.maxBlevel = G.DATA.MAX_BLEVEL;
    out.maxLevelAbs = G.DATA.MAX_LEVEL_ABS;
    out.minfangMaxLevel = G.DATA.BUILDINGS.minfang.maxLevel;
    out.capOf = G.buildCapOf(c, 'minfang');
    /* 三档可能性：有没有 DATA.MASTERY_TIERS */
    out.hasTiers = !!G.DATA.MASTERY_TIERS;
    return out;
  });
  console.log('⑥ 建筑专精现状：项数 ' + r6.masteryLen + ' · 民房 Lv' + r6.minfangLv +
    ' · popPct=' + r6.popPctNow + ' · masteryOf=' + r6.masteryOfNow);
  console.log('   MAX_BLEVEL=' + r6.maxBlevel + ' MAX_LEVEL_ABS=' + r6.maxLevelAbs +
    ' minfang.maxLevel=' + r6.minfangMaxLevel + ' buildCapOf=' + r6.capOf);
  console.log('   已有三档表? ' + r6.hasTiers + ' · 样本 ' + r6.sample.join(' / '));

  /* ══ ④ 附属野地 openWilds ══ */
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var c = G.currentCity();
    /* 造 3 块野地 */
    var made = [];
    var yy = 3;
    for (var i = 0; i < 3 && yy < 240; yy++) {
      for (var xx = 3; xx < 240 && i < 3; xx++) {
        var tl = G.map.tile(xx, yy);
        if (tl && tl.terrain === 'plain' && !G.map.wildAt(xx, yy) && !G.map.npcAt(xx, yy)) {
          st.wilds.push({ x: xx, y: yy, type: 'plain', level: 5 + i, levelDay: 0 });
          made.push(xx + ',' + yy); i++; break;
        }
      }
    }
    G.ui.closeAllModals();
    G.ui.openWilds();
    var root = document.getElementById('modal-root');
    var ths = [];
    Array.prototype.slice.call(root.querySelectorAll('table thead th')).forEach(function (t) { ths.push(t.textContent.trim()); });
    var firstRowTds = 0;
    var tr = root.querySelector('table tbody tr');
    if (tr) firstRowTds = tr.children.length;
    var actions = [];
    Array.prototype.slice.call(root.querySelectorAll('tbody [data-action]')).forEach(function (e) { actions.push(e.getAttribute('data-action')); });
    return { wilds: st.wilds.length, ths: ths, firstRowTds: firstRowTds, actions: actions.slice(0, 10) };
  });
  console.log('④ 附属野地：野地数 ' + r4.wilds + ' · 表头 [' + r4.ths.join(' | ') + '] · 首行 ' + r4.firstRowTds + ' 格');
  console.log('   行内动作：' + (r4.actions.join(', ') || '（无）'));

  /* ══ ⑤ 出征界面的 station 方式 ══ */
  var r5 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var w = st.wilds[0];
    G.ui.closeAllModals();
    G.ui.openExpModal({ kind: 'wild', x: w.x, y: w.y });
    var root = document.getElementById('modal-root');
    var sel = root.querySelector('#exp-mode');
    var opts = [];
    if (sel) Array.prototype.slice.call(sel.options).forEach(function (o) { opts.push(o.value + (o.disabled ? '[锁]' : '')); });
    var tgtHtml = '';
    var tsel = root.querySelector('#exp-target');
    if (tsel) tgtHtml = tsel.innerHTML.slice(0, 300);
    G.ui.closeAllModals();
    return { opts: opts, hasTargetSel: !!tsel, tgtHtml: tgtHtml };
  });
  console.log('⑤ 出征界面（目标=己方野地）方式下拉：' + (r5.opts.join(', ') || '（无）'));
  console.log('   有目标下拉：' + r5.hasTargetSel);
  if (r5.tgtHtml) console.log('   目标选项前 300 字：' + r5.tgtHtml.replace(/\n/g, ''));

  /* ══ ② / ③ 战场面板 ══ */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    var c = G.currentCity();
    /* 造一场真战斗：找 Lv5 野地（非我方）→ 出征 */
    var xy = null;
    for (var yy = 4; yy < 240 && !xy; yy++) {
      for (var xx = 4; xx < 240; xx++) {
        var w = G.map.wildAt(xx, yy);
        if (w && w.level >= 4 && w.level <= 7) { xy = { x: xx, y: yy, lv: w.level }; break; }
      }
    }
    if (!xy) return { err: '地图无 4~7 级野地' };
    /* 用真出口宣战：直接 expedition（保证链路通） */
    var gen = st.generals[0];
    gen.status = 'idle'; gen.cityId = c.id;
    var army = { yibing: 3000, changqiang: 1500 };
    var r = G.battle.expedition({ kind: 'wild', x: xy.x, y: xy.y }, 'raid', army, gen.id);
    var dbg = 'exp=' + JSON.stringify(r);
    /* 让行军瞬间抵达（若还在途） */
    var m = null;
    (st.marches || []).forEach(function (mm) { if (!m) m = mm; });
    if (m) {
      dbg += ' m.total=' + m.totalTime + ' m.elapsed=' + m.elapsed;
      m.elapsed = (m.totalTime || 0) + 1;
      G.march.tick();
      dbg += ' after-tick marches=' + JSON.stringify((st.marches || []).length);
    } else {
      dbg += ' [已瞬间抵达，无在途行军]';
    }
    /* 推进战斗（若生成会话） */
    var _bs = G._bsess || {};
    Object.keys(_bs).forEach(function (k) {
      try { _bs[k].step && _bs[k].step(); } catch (e) { dbg += ' stepErr=' + e.message; }
    });
    /* 找进行中的战斗 */
    var rec = null;
    var _bs2 = G._bsess || {};
    var _firstId = Object.keys(_bs2)[0];
    if (_firstId) rec = G.battle._recOf(_firstId);
    if (!rec) (st.reports || []).forEach(function (rp) { if (!rec && rp.battle) rec = rp; });
    if (!rec) return { err: '无战斗记录 · ' + dbg + ' · bsess=' + JSON.stringify(Object.keys(_bs2)) };
    G.ui.closeAllModals();
    G.ui.openBattlefield(rec.id);
    return { recId: rec.id, dbg: dbg };
  });
  if (r2.err) { console.log('② 战斗段失败：' + r2.err); }
  else {
    /* 推一回合 → 让 log 有内容，再量 */
    await p.evaluate(function () {
      var btn = document.querySelector('[data-action="bt-done"]');
      if (btn) btn.click();
    });
    await p.waitForTimeout(1500);
    var r2b = await p.evaluate(function () {
      var G = window.GAME;
      var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
      var log = document.getElementById('bt-log');
      var line = log && log.querySelector ? log.querySelector('.bt-ev') : null;
      var lh = line ? line.getBoundingClientRect().height : 0;
      var rr = document.querySelector('#bt-side-atk .bt-rrow');
      var rrowTitle = rr ? rr.getAttribute('title') : null;
      var rrowHTML = rr ? rr.outerHTML.slice(0, 500) : null;
      /* 面板底部与 log 底部的间距（下方留白） */
      var pr = panel ? panel.getBoundingClientRect() : null;
      var lr = log ? log.getBoundingClientRect() : null;
      var lines = log && log.children ? log.children.length : 0;
      var hdr = log && log.querySelector ? log.querySelector('.bt-ev.hdr') : null;
      var hdrH = hdr ? hdr.getBoundingClientRect().height : 0;
      return {
        panelH: pr ? pr.height : 0,
        panelScrollOverflow: panel ? (panel.scrollHeight - panel.clientHeight) : 0,
        logH: log ? log.clientHeight : 0,
        logMaxH: log ? getComputedStyle(log).maxHeight : '',
        lineH: lh, hdrH: hdrH,
        lines: lines,
        visibleLines: lh ? Math.floor((log ? log.clientHeight : 0) / lh) : 0,
        logBottomGap: (pr && lr) ? Math.round(pr.bottom - lr.bottom) : -1,
        logScrollH: log ? log.scrollHeight : 0,
        logMax: G.ui.BT_LOG_MAX,
        rrowTitle: rrowTitle,
        rrowHTML: rrowHTML
      };
    });
    console.log('② 战场面板：面板高 ' + Math.round(r2b.panelH) + 'px · 面板内溢出 ' + Math.round(r2b.panelScrollOverflow) + 'px');
    console.log('   .bt-log 视高 ' + r2b.logH + 'px（max-height ' + r2b.logMaxH + '）· scrollHeight ' + r2b.logScrollH +
      ' · 行数 ' + r2b.lines + ' · 行高 ' + Math.round(r2b.lineH) + 'px（回合头 ' + Math.round(r2b.hdrH) + '）');
    console.log('   可见约 ' + r2b.visibleLines + ' 行 · BT_LOG_MAX=' + r2b.logMax + ' · log 底距面板底 ' + r2b.logBottomGap + 'px');
    console.log('③ 兵种行 title：' + JSON.stringify(r2b.rrowTitle));
    console.log('   兵种行 HTML：' + (r2b.rrowHTML || '').replace(/\n/g, ' ').slice(0, 360));
  }

  if (errs.length) console.log('\n⚠ 页面错误 ' + errs.length + ' 条：' + errs.slice(0, 3).join(' | '));
  else console.log('\n✅ 无页面错误');
  await b.close();
  process.exit(0);
})();
