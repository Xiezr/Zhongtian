/* ============================================================
 * shot_v89112_modals.js — 弹窗整改实机对照（老板要看效果）
 * 用法：node shot_v89112_modals.js            → 改后四张
 *       MODE=before node shot_v89112_modals.js → 改前两张（需先换入旧版 ui.js/index.html）
 * 判据（改后）：野地/装备有弹窗内分页条 + 零溢出；改前：无分页条 + 有溢出
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var MODE = process.env.MODE === 'before' ? 'before' : 'after';
var TAG = process.env.TAG || ('v89112' + (MODE === 'before' ? 'before' : ''));
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 真实存档 + 极限补料（30 野地 / 8 采集 / 166 将） */
  var savePath = path.join(R, '.workbuddy/tmp/playtest600/cap108/final_state.json');
  var saveRaw = fs.existsSync(savePath) ? fs.readFileSync(savePath, 'utf8') : null;
  await page.evaluate(function (raw) {
    var G = window.GAME, DATA = G.DATA;
    var st = raw ? JSON.parse(raw) : G.newGame({ name: '北', cityName: '许都' });
    if (raw) G.adoptState(st);
    if (!st.map.grid) G.map.generate();
    var c = G.currentCity() || st.cities[0];
    G.ui._cityId = c.id;
    var wt = ['plain', 'forest', 'hill', 'marsh', 'lake'], wl = [];
    for (var i = 0; i < 30; i++) {
      wl.push({ x: 40 + (i % 15) * 2, y: 40 + Math.floor(i / 15) * 2, type: wt[i % 5], lv: 3 + (i % 7), levelDay: 1 });
    }
    st.wilds = wl;
    st.gathers = [];
    for (var gi = 0; gi < 8; gi++) {
      var gen = G.makeGeneral('采集将' + (gi + 1), 30, 'gather', c.id, false);
      gen.stamina = 200; gen.energy = 200;
      st.generals.push(gen);
      st.gathers.push({ id: 'px' + (gi + 1), x: 60 + gi, y: 60, type: wt[gi % 5],
        level: 4 + (gi % 5), genId: gen.id, troops: 1200 + gi * 100, at: (st.world && st.world.elapsed || 0) + 7200 });
    }
    try { G.map._view = { vx: Math.max(0, c.x - 13), vy: Math.max(0, c.y - 13), span: 26 }; } catch (e) {}
  }, saveRaw);

  async function shoot(name, expr, probe) {
    var r = await page.evaluate(function (o) {
      try { (new Function('ui', 'GAME', 'return (' + o.expr + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message).slice(0, 70) }; }
      var root = document.querySelector('#modal-root');
      var modal = root.querySelector('.modal');
      if (!modal) return { err: '无弹窗' };
      var body = root.querySelector('.m-body') || root.querySelector('.inner-panel') || modal;
      var box = modal.getBoundingClientRect();
      var scrollN = 0;
      var all = modal.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var cs = getComputedStyle(all[i]);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll')
          && all[i].scrollHeight - all[i].clientHeight > 2) scrollN++;
      }
      return {
        w: Math.round(box.width), h: Math.round(box.height),
        over: Math.round(body.scrollHeight - body.clientHeight), scrollN: scrollN,
        pagers: root.querySelectorAll('.pager').length,
        chips: root.querySelectorAll('.chips .chip').length,
        mage: root.querySelectorAll('[data-action="mpage"]').length,
      };
    }, { expr: expr });
    if (r.err) { console.log('⛔ ' + name + ' —— ' + r.err); return r; }
    await new Promise(function (rr) { setTimeout(rr, 260); });
    await page.screenshot({ path: path.join(OUT, TAG + '-' + name + '.png') });
    console.log('✓ ' + TAG + '-' + name + '.png  ' + r.w + '×' + r.h
      + ' · 溢出 ' + r.over + 'px · 滚动容器 ' + r.scrollN
      + ' · 分页条 ' + r.pagers + '（mpage 按钮 ' + r.mage + '）· 将领chips ' + r.chips);
    await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });
    await new Promise(function (rr) { setTimeout(rr, 120); });
    return r;
  }

  var out = {};
  out.wilds = await shoot('wilds-page', 'ui.openWilds()');
  out.equip = await shoot('equip-page', 'ui.openEquipPanel()');
  if (MODE === 'after') {
    out.exp = await shoot('exp-page', '(function(){var st=GAME.state;ui.openExpModal({kind:"wild",x:st.cities[0].x+2,y:st.cities[0].y+2});})()');
    out.rep = await shoot('report-page', '(function(){var st=GAME.state;var k=-1;st.reports.forEach(function(r,i){if(k<0&&((r.replay&&r.replay.frames)||r.scene))k=i;});ui.viewReportText(k<0?0:k);})()');
  }

  if (MODE === 'before') {
    var ok = out.wilds.over > 2 && out.wilds.pagers === 0 && out.wilds.scrollN >= 1
      && out.equip.chips > 100 && out.equip.pagers === 0 && out.equip.scrollN >= 1;
    console.log(ok ? '\n[before] 复现改前形态：无弹窗内分页、整体溢出（老板看到的滚动条）'
      : '\n⚠ [before] 未复现改前形态');
    await browser.close();
    process.exit(ok ? 0 : 1);
  }
  var okA = out.wilds.over <= 2 && out.wilds.scrollN === 0 && out.wilds.pagers >= 1
    && out.equip.over <= 2 && out.equip.scrollN === 0 && out.equip.pagers >= 1
    && out.exp.over <= 2 && out.exp.scrollN === 0
    && out.rep.over <= 2 && out.rep.scrollN === 0;
  console.log(okA ? '\n全部实机判据通过（零滚动 + 弹窗内分页齐备）' : '\n⚠ 有判据未过');
  await browser.close();
  process.exit(okA ? 0 : 1);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
