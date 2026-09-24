/* ============================================================
 * shot_v89116.js — v89.116 实机图 + 几何量测
 *   ① 战场界面重排（左 1/4 我军 · 中 1/2 战场只画图标 · 右 1/4 敌军 · 底部一回合一行）
 *   ② 守城战报 → 真沙盘（我军在右 · 右侧城墙示意 · 出城兵种逐回合前进）
 *   ③ 军务处：伤兵营 + 俘虏营（逐兵种明细）
 *   ④ 待阅逸闻：6 列 × 5 行 + 底部翻页
 *   ⑤ 快购按用途过滤（训练加速只列训练宝物）
 *   ⑥ 显示比例：滑块真的改了比例（量 .city-iso 的 zoom）
 *   ⑦ 自动化 · 治疗：触发记录（逐兵种 + 人数）
 * 用法：node .workbuddy/tools/show/shot_v89116.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var TAG = 'v89116';
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- 建局 + 补料（全部走游戏自己的出口） ---------- */
  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北', cityName: '许都', mapSeed: 20260924 });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    var c = G.currentCity() || st.cities[0];
    G.ui._cityId = c.id;
    if (G.ui.enterGame) G.ui.enterGame();
    if (G.ui.closeModal) G.ui.closeModal();
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    G.state.res.gold = 5e6;
    c.army = { yibing: 6000, changqiang: 4000, gongjian: 2000, daodun: 2000, qingji: 600, minfu: 800, zhouche: 40 };
    c.wallLv = 5;
    /* 守将（守城沙盘要有将） */
    var g = (st.generals || [])[0];
    if (g) G.assignGeneral(g.id, 'guard', c.id);
    var g2 = (st.generals || [])[1];
    if (g2) G.assignGeneral(g2.id, 'mayor', c.id);
    /* 伤兵 + 俘虏（军务处两个营要有货） */
    st.wounded = 486; st.woundedArmy = { yibing: 260, changqiang: 140, gongjian: 86 };
    st.captives = { yibing: 64, changqiang: 38, qingji: 12 };
    /* 待阅逸闻：塞 34 篇（跨两页，看翻页） */
    st.sgPending = [];
    for (var i = 1; i <= 34; i++) {
      st.sgPending.push({ sid: 'shot_sg_' + i, title: '逸闻·' + (i < 10 ? '0' + i : i) + '　' +
        ['许都夜雨', '长坂坡旧事', '校场见闻', '市集奇谈', '书院残卷', '野地狼烟'][i % 6] });
    }
    /* 找一格低等级野地（战场截图真打一场用） */
    var tgt = null, CMAX = G.COORD_MAX || 499;
    for (var dx = -8; dx <= 8 && !tgt; dx++) {
      for (var dy = -8; dy <= 8 && !tgt; dy++) {
        if (!dx && !dy) continue;
        var xx = c.x + dx, yy = c.y + dy;
        if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
        var tl = G.map.tile(xx, yy);
        if (!tl || tl.terrain === 'city') continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
        if (lv >= 1 && lv <= 3) tgt = { x: xx, y: yy, lv: lv };
      }
    }
    return { city: c.name, army: c.army, wild: tgt };
  });
  console.log('现场：' + boot.city + '　野地 ' + (boot.wild ? boot.wild.x + ',' + boot.wild.y : '无'));

  async function shot(name, expr, probe, after) {
    await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });
    var openR = await page.evaluate(function (e) {
      try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message).slice(0, 140) }; }
      return { ok: true };
    }, expr);
    if (openR.err) { console.log('⛔ ' + name + ' —— ' + openR.err); return openR; }
    await new Promise(function (rr) { setTimeout(rr, 380); });
    if (after) {
      var aErr = await page.evaluate(function (e) {
        try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
        catch (err) { return String(err && err.message).slice(0, 140); }
        return null;
      }, after);
      if (aErr) console.log('  after 出错：' + aErr);
      await new Promise(function (rr) { setTimeout(rr, 260); });
    }
    var p = await page.evaluate(function (e) {
      try { return (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message).slice(0, 140) }; }
    }, probe).catch(function (er) { return { probeErr: String(er && er.message).slice(0, 140) }; });
    var geo = await page.evaluate(function () {
      var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('.ui-page');
      var out = { overflow: panel ? (panel.scrollHeight - panel.clientHeight) : null };
      var brd = document.querySelector('#modal-root .bt-board');
      if (brd) {
        var cs = getComputedStyle(brd);
        out.boardCols = cs.gridTemplateColumns;
        out.boardChildren = brd.children.length;
      }
      return out;
    });
    var f = path.join(OUT, TAG + '-' + name + '.png');
    await page.screenshot({ path: f });
    console.log('  📷 ' + TAG + '-' + name + '.png　' + JSON.stringify(p) + '　跨度溢出=' + geo.overflow
      + (geo.boardCols ? ('　三列=' + geo.boardCols) : ''));
    return { p: p, geo: geo };
  }

  /* ---------- ① 战场界面（三列 + 一回合一行） ---------- */
  var w = boot.wild;
  var r1 = await shot('battle',
    w ? '(function(){' +
      'var st=GAME.state,c=GAME.currentCity();' +
      'var g=(st.generals||[]).filter(function(x){return x.status==="guard"||!x.status;})[0];' +
      'if(!g)return "no-gen";' +
      'g.cityId=c.id;g.status="idle";if(GAME.setStaNow)GAME.setStaNow(g,300);g.energy=300;' +
      'st.settings=st.settings||{};st.settings.battleWatch=true;' +
      'var d=GAME.march.dispatch({kind:"wild",x:' + w.x + ',y:' + w.y + ',name:"试野地",lv:' + w.lv + '},' +
      '"raid",{yibing:1500,changqiang:1200,gongjian:600},g.id,null,null,null);' +
      'if(!d||d.ok===false)return "dispatch:"+((d&&d.msg)||"-");' +
      '(st.marches||[]).forEach(function(m){m.elapsed=m.totalTime+1;});GAME.march.tick();' +
      'if(ui.openBattlefield&&st.battles&&st.battles[0])ui.openBattlefield(st.battles[0].id);' +
      '})()' : '(function(){return "no wild";})()',
    '(function(){var mr=document.querySelector("#modal-root");var tx=mr?mr.textContent:"";' +
    'var brd=document.querySelector("#bt-board");' +
    'var iconOnly=true;' +
    'document.querySelectorAll("#bt-field .bt-unit").forEach(function(u){' +
    'if(u.querySelector(".bt-n")||u.querySelector(".bt-nm"))iconOnly=false;});' +
    'return {hasBoard:!!brd,sides:document.querySelectorAll("#bt-board .bt-side").length,' +
    'rows:document.querySelectorAll("#bt-board .bt-rrow").length,' +
    'fieldIcons:document.querySelectorAll("#bt-field .bt-unit .bt-ico").length,' +
    'iconOnly:iconOnly,stanceSel:document.querySelectorAll(\'[data-action="bt-stance"]\').length,' +
    'foeReadonly:document.querySelectorAll("#bt-side-def .bt-ro").length,' +
    'log:[].slice.call(document.querySelectorAll("#bt-log .bt-ev")).map(function(x){return x.textContent;}).slice(-1)[0]||""};})()',
    /* after：结算一回合，让播报里有一行真战况 */
    '(function(){var st=GAME.state;if(!st.battles||!st.battles[0])return "no-battle";' +
    'var r=GAME.battle.stepBattle(st.battles[0].id);if(r&&ui.btAfterStep)ui.btAfterStep(st.battles[0],r);})()');

  /* ---------- ② 守城沙盘（我军在右 + 城墙） ---------- */
  var r2 = await shot('def-sandbox',
    '(function(){' +
    'var st=GAME.state,c=GAME.currentCity();' +
    'var slot=GAME.invasionSlotOf(GAME.realNow())+1;' +
    'var out=GAME.invasionResolve(c,"流寇",slot);' +
    'var rep=(st.reports||[])[0];' +
    'if(!rep||!rep.sandbox)return "no-sandbox";' +
    'ui.openSandbox(0);' +
    '})()',
    '(function(){var mr=document.querySelector("#modal-root");var tx=mr?mr.textContent:"";' +
    'var sd=ui._sd;' +
    'return {ourSide:sd&&sd.sb?sd.sb.ourSide:"-",wall:/我方城墙/.test(tx),' +
    'wallLv:/Lv\\d/.test(tx),cols:document.querySelector("#sd-board")?document.querySelector("#sd-board").style.gridTemplateColumns:"-",' +
    'snip:(function(){var i=tx.indexOf("我方城墙");return i<0?"(无)":tx.slice(i,i+28).replace(/\\s+/g," ");})()};})()');

  /* ---------- ③ 军务处：两营逐兵种 ---------- */
  var r3 = await shot('affairs',
    '(function(){ui._marchTab="affairs";ui.setView("marches");})()',
    '(function(){var h=document.getElementById("view-container").innerHTML;' +
    'return {wounded:/伤兵营/.test(h),captive:/俘虏营/.test(h),' +
    'wRows:(h.match(/义兵|长枪兵|弓箭手/g)||[]).length,' +
    'cons:/conscript-captives/.test(h),rel:/release-captives/.test(h)};})()');

  /* ---------- ④ 待阅逸闻 6×5 + 翻页 ---------- */
  var r4 = await shot('sg-pending',
    '(function(){ui.setView("story");ui._pages["sg"]=1;ui.renderView("story");})()',
    '(function(){var h=document.getElementById("view-container").innerHTML;' +
    'var bot=document.getElementById("bottom-bar");' +
    'var cs=document.querySelector(".sg-grid")?getComputedStyle(document.querySelector(".sg-grid")).gridTemplateColumns:"-";' +
    'return {cells:(h.match(/class="sg-cell/g)||[]).length,' +
    'cols:cs,page:/第 1 \\/ 2 页/.test(h),pager:!!bot&&/data-action="page"/.test(bot.innerHTML)};})()');

  /* ---------- ⑤ 快购：训练加速只列训练 ---------- */
  var r5 = await shot('qbuy-train',
    '(function(){ui.openQuickCat("boost","train");})()',
    '(function(){var tx=document.querySelector("#modal-root").textContent;' +
    'return {title:tx.indexOf("募兵训练专用")>=0,' +
    'hanxin:/韩信三篇/.test(tx)&&/韩信点兵术/.test(tx),' +
    'noBuild:tx.indexOf("鲁班残页")<0,noMarch:tx.indexOf("急行军令")<0,noTech:tx.indexOf("墨家残卷")<0,' +
    'allBtn:/看全部加速宝物/.test(tx)};})()');

  /* ---------- ⑥ 显示比例：滑块真的改比例 ---------- */
  await page.evaluate(function () { window.GAME.ui.closeModal(); window.GAME.ui.setView('city'); });
  await new Promise(function (rr) { setTimeout(rr, 300); });
  var zoomBefore = await page.evaluate(function () {
    var el = document.querySelector('.city-iso');
    return el ? (el.style.zoom || '(空)') : '(无 .city-iso)';
  });
  var r6p = await page.evaluate(function () {
    var r = window.GAME.ui.previewZoom(115);
    var el = document.querySelector('.city-iso');
    return { ret: r, zoom: el ? el.style.zoom : '(无)', txt: (document.getElementById('zoom-txt') || {}).textContent };
  });
  await page.evaluate(function () { window.GAME.doSetZoom(115); });
  await new Promise(function (rr) { setTimeout(rr, 300); });
  var zoomAfter = await page.evaluate(function () {
    var el = document.querySelector('.city-iso');
    return { zoom: el ? el.style.zoom : '(无)', saved: (window.GAME.state.settings || {}).zoom };
  });
  var f6 = path.join(OUT, TAG + '-zoom.png');
  await page.screenshot({ path: f6 });
  console.log('  📷 ' + TAG + '-zoom.png　拖动前 ' + zoomBefore + ' → 拖动后 ' + JSON.stringify(r6p)
    + ' → 落库 ' + JSON.stringify(zoomAfter));
  await page.evaluate(function () { window.GAME.doSetZoom(100); });

  /* ---------- ⑦ 自动化 · 治疗触发记录 ---------- */
  var r7 = await shot('auto-heal',
    '(function(){' +
    'var st=GAME.state,c=GAME.currentCity();' +
    'st.settings.autoHeal=true;st.autoHealLog=[];st.autoHealState={at:0};' +
    'st.wounded=486;st.woundedArmy={yibing:260,changqiang:140,gongjian:86};' +
    'st.res.gold=5e6;GAME.autoHeal();' +
    'ui._autoSel="heal";ui.setView("auto");' +
    '})()',
    '(function(){var h=document.getElementById("view-container").innerHTML;' +
    'var i=h.indexOf("触发记录");' +
    'return {hasLog:i>=0,hasTroop:/义兵/.test(h)&&/长枪兵/.test(h)&&/弓箭手/.test(h),' +
    'snip:i<0?"(无)":h.slice(i,i+150).replace(/<[^>]*>/g," ").replace(/\\s+/g," ")};})()');

  var need = [];
  function need2(cond, label) { if (!cond) need.push(label); }
  need2(r1.p && r1.p.hasBoard && r1.p.sides === 2, '① 战场三列');
  need2(r1.p && r1.p.iconOnly && r1.p.fieldIcons > 0, '① 战场只画图标');
  need2(r1.p && r1.p.stanceSel > 0, '① 动作下拉');
  need2(r1.p && r1.p.foeReadonly > 0, '① 敌方只读');
  need2(r1.p && /第 \d+ 回合/.test(r1.p.log), '① 一回合一行播报');
  need2(r2.p && r2.p.ourSide === 'def' && r2.p.wall, '② 守城沙盘视角 + 城墙');
  need2(r2.p && r2.p.cols && r2.p.cols.indexOf('190px') >= 0, '② 守城列宽（我军加宽）');
  need2(r3.p && r3.p.wounded && r3.p.captive && r3.p.cons && r3.p.rel, '③ 两营逐兵种');
  need2(r4.p && r4.p.cells === 30 && r4.p.page && r4.p.pager, '④ 逸闻 6×5 + 翻页');
  need2(r5.p && r5.p.title && r5.p.hanxin && r5.p.noBuild && r5.p.noMarch && r5.p.noTech, '⑤ 快购按用途');
  need2(r6p.zoom && r6p.zoom !== zoomBefore && (zoomAfter.saved === 115), '⑥ 显示比例真的改');
  need2(r7.p && r7.p.hasLog && r7.p.hasTroop, '⑦ 治疗触发记录');
  console.log(need.length ? ('\n⚠ 未过：' + need.join(' · ')) : '\n实机判据全过');
  await browser.close();
  process.exit(need.length ? 1 : 0);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
