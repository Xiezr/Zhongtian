/* ============================================================
 * shot_v89113_mayor_inv.js — v89.113 五条需求实机图
 *   ① 烽火规则块（公文·烽火顶部）
 *   ② 城池面板：城主 / 守将双职
 *   ③ 防御战报：口径对齐（来犯战力 / 参战守军 / 斥候）+ 伤兵 + 俘虏
 *   ④ 建筑文案（建筑详情）
 * 用法：node .workbuddy/tools/show/shot_v89113_mayor_inv.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var TAG = 'v89113';
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var savePath = path.join(R, '.workbuddy/tmp/playtest600/cap108/final_state.json');
  var saveRaw = fs.existsSync(savePath) ? fs.readFileSync(savePath, 'utf8') : null;
  var boot = await page.evaluate(function (raw) {
    var G = window.GAME;
    var st = raw ? JSON.parse(raw) : G.newGame({ name: '北', cityName: '许都' });
    if (raw) G.adoptState(st);
    if (!st.map.grid) G.map.generate();
    var c = G.currentCity() || st.cities[0];
    G.ui._cityId = c.id;
    if (G.ui.enterGame) G.ui.enterGame();     /* 进入游戏（视图渲染的前提） */
    /* 城主/守将各任命一位（真实出口 assignGeneral） */
    var gens = st.generals.filter(function (g) { return !g.status || g.status === 'idle'; });
    if (gens[0]) G.assignGeneral(gens[0].id, 'mayor', c.id);
    if (gens[1]) G.assignGeneral(gens[1].id, 'guard', c.id);
    /* 造一场来袭（拨到当日 9:01 → 结算）以便出防御战报 */
    st.world = st.world || {};
    st.world.elapsed = 0;
    G.invasionTick(0);
    st.world.elapsed = G.invasionDueOfDay(0) + 60;
    var fired = G.invasionTick(1);
    /* enterGame 可能弹出开场引导 —— 截图前清掉，否则视图类判据读到的是弹窗 */
    if (G.ui.closeModal) G.ui.closeModal();
    var c2 = G.currentCity();
    return { city: c.name, mayor: (G.mayorGeneralOf(c) || {}).name, guard: (G.guardGeneralOf(c) || {}).name,
      fired: fired, reports: st.reports.length,
      wounded: st.wounded || 0 };
  }, saveRaw);
  console.log('开局：' + JSON.stringify(boot));

  async function shot(name, expr, probe) {
    /* 每张图前先清残留弹窗（视图类判据要读 #view-container，弹窗会挡住 scope 优先序） */
    await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });
    var openR = await page.evaluate(function (e) {
      try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message).slice(0, 90) }; }
      return { ok: true };
    }, expr);
    if (openR.err) { console.log('⛔ ' + name + ' —— ' + openR.err); return openR; }
    await new Promise(function (rr) { setTimeout(rr, 320); });        /* 先等渲染落定 */
    var r = await page.evaluate(function (o) {
      var root = document.querySelector('#modal-root');
      var modal = root.querySelector('.modal');
      /* textContent（含隐藏/未展开）比 innerText 稳 —— innerText 受可见性影响 */
      var scope = modal || document.querySelector('#view-container') || document.body;
      var out = { hasModal: !!modal };
      if (o.probe) {
        try { out.p = (new Function('scope', 'root', 'return (' + o.probe + ')')(scope, root)); }
        catch (e2) { out.pErr = String(e2 && e2.message).slice(0, 80); }
      }
      return out;
    }, { probe: probe });
    await page.screenshot({ path: path.join(OUT, TAG + '-' + name + '.png') });
    console.log('✓ ' + TAG + '-' + name + '.png  ' + JSON.stringify(r.p || {}));
    await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });
    await new Promise(function (rr) { setTimeout(rr, 140); });
    return r;
  }

  /* ① 烽火规则块 */
  var r1 = await shot('beacon-rules',
    '(function(){ui.setView("marches");ui._marchTab="beacon";ui.renderView("marches");})()',
    '(function(){var tx=scope.textContent||"";return {hasTitle:tx.indexOf("来犯 · 触发与规则")>=0,hasSrc:tx.indexOf("流寇")>=0,hasHour:tx.indexOf("每日 9 时")>=0,hasScope:tx.indexOf("28%~45%")>=0,overflow:(function(){var b=document.querySelector(".view-box");return b?b.scrollHeight-b.clientHeight:-1;})()};})()');

  /* ② 城池面板：城主 / 守将 */
  var r2 = await shot('city-mayor', 'ui.openCityPanel()',
    '(function(){var tx=scope.textContent||"";return {hasMayor:tx.indexOf("城主")>=0,hasGuard:tx.indexOf("守将")>=0,hasFn:tx.indexOf("内政·智谋")>=0,hasFn2:tx.indexOf("征兵·对阵")>=0};})()');

  /* ③ 防御战报（最新一条 defense） */
  var r3 = await shot('def-report',
    '(function(){var st=GAME.state;var k=-1;st.reports.forEach(function(r,i){if(k<0&&r.type==="defense")k=i;});if(k<0)return;ui.viewReport(k);})()',
    '(function(){var tx=scope.textContent||"";return {hasPower:tx.indexOf("战力")>=0,hasDef:tx.indexOf("守军")>=0,hasDef2:tx.indexOf("守备力")>=0,hasWound:tx.indexOf("伤兵")>=0,hasCap:tx.indexOf("俘获")>=0,title:(document.querySelector(".gold-heading")||{}).innerText};})()');

  /* ④ 建筑文案（点已建建筑 → 详情弹窗标题下有 desc） */
  var r4 = await shot('bldg-desc',
    '(function(){var c=GAME.currentCity();var idx=-1;c.cells.forEach(function(x,i){if(idx<0&&x.build&&!x.official)idx=i;});ui.openBuildModal(idx>=0?idx:0);})()',
    '(function(){var tx=scope.textContent||"";var any=/一城枢机|编户齐民|聚士讲学|募兵练卒|点兵演武|通有无|仓廪实|高墙深池|置驿传命|烽燧相望|牧养战马|招贤纳士|筑馆延宾|江湖门墙|炉火照夜|百工群集/.test(tx);return {hasDesc:any,sample:tx.slice(0,60)};})()');

  var ok = (r1.p && r1.p.hasTitle && r1.p.hasSrc && r1.p.hasHour && r1.p.hasScope)
    && (r2.p && r2.p.hasMayor && r2.p.hasGuard)
    && (r3.p && r3.p.hasDef && r3.p.hasDef2)
    && (r4.p && r4.p.hasDesc);
  console.log(ok ? '\n实机判据通过' : '\n⚠ 有判据未过');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
