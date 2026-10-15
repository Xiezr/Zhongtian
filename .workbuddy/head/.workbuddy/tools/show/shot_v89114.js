/* ============================================================
 * shot_v89114.js — v89.114 三条需求实机图 + 几何量测
 *   ① 建筑弹窗：关闭键在右上角（圆形叉）· 底栏三键仍在 · 不出滚动条
 *   ② 兵营招募：卡面只剩图标 + 名字（属性行撤除）· 悬停浮层含全部属性（含负重）
 *   ③ 出征面板：搬运预估行（随军载重 vs 目标估掠）· 弹窗不出滚动条
 *   ④ 战报：资财行的运力口径 + 「运力不足」行（真打一场掠夺）
 * 用法：node .workbuddy/tools/show/shot_v89114.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var TAG = 'v89114';
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

/* 最新试玩存档（真实载荷） */
function latestSave() {
  var base = path.join(R, '.workbuddy/tmp/playtest600');
  var cands = [];
  (fs.existsSync(base) ? fs.readdirSync(base) : []).forEach(function (d) {
    var p = path.join(base, d, 'final_state.json');
    if (fs.existsSync(p)) cands.push({ p: p, t: fs.statSync(p).mtimeMs });
  });
  cands.sort(function (a, b) { return b.t - a.t; });
  return cands.length ? cands[0].p : null;
}

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var savePath = latestSave();
  var saveRaw = savePath ? fs.readFileSync(savePath, 'utf8') : null;
  var boot = await page.evaluate(function (raw) {
    var G = window.GAME;
    var st = raw ? JSON.parse(raw) : G.newGame({ name: '北', cityName: '许都' });
    if (raw) G.adoptState(st);
    if (!st.map.grid) G.map.generate();
    var c = G.currentCity() || st.cities[0];
    G.ui._cityId = c.id;
    if (G.ui.enterGame) G.ui.enterGame();
    if (G.ui.closeModal) G.ui.closeModal();
    /* 军营格：有则用，无则在空地上补一座（只为截图，不改存档字段结构） */
    var idx = -1;
    c.cells.forEach(function (x, i) { if (idx < 0 && x.build && x.build.id === 'junying') idx = i; });
    if (idx < 0) {
      c.cells.forEach(function (x, i) {
        if (idx < 0 && !x.official && !x.build && !x.pending) { x.build = { id: 'junying', lvl: 10 }; idx = i; }
      });
    }
    /* 给一批兵（让出征面板/搬运读数有内容） */
    c.army = { yibing: 5000, changqiang: 3000, qingji: 500, minfu: 800, zhouche: 60 };
    /* 找野地：low = Lv1~3（真打要赢）；max = 地图上等级最高的（演示"库藏超出运力"） */
    var tgt = null, maxW = null, CMAX = G.COORD_MAX || 499;
    for (var dx = -20; dx <= 20; dx++) {
      for (var dy = -20; dy <= 20; dy++) {
        if (!dx && !dy) continue;
        var xx = c.x + dx, yy = c.y + dy;
        if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
        var tl = G.map.tile(xx, yy);
        if (!tl || tl.terrain === 'city') continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
        if (!maxW || lv > maxW.lv) maxW = { x: xx, y: yy, lv: lv };
        if (!tgt && lv >= 1 && lv <= 3) tgt = { x: xx, y: yy, lv: lv };
      }
    }
    return { save: !!raw, city: c.name, junyingIdx: idx, wild: tgt, maxWild: maxW, army: c.army };
  }, saveRaw);
  console.log('开局：' + JSON.stringify(boot));

  async function shot(name, expr, probe, hoverSel, afterExpr) {
    await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });
    var openR = await page.evaluate(function (e) {
      try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message).slice(0, 120) }; }
      return { ok: true };
    }, expr);
    if (openR.err) { console.log('⛔ ' + name + ' —— ' + openR.err); return openR; }
    await new Promise(function (rr) { setTimeout(rr, 350); });
    if (afterExpr) {                                   /* 渲染落定后的补充操作（填兵等） */
      var afterR = await page.evaluate(function (e) {
        try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
        catch (err) { return { err: String(err && err.message).slice(0, 120) }; }
        return { ok: true };
      }, afterExpr);
      if (afterR.err) console.log('  after 失败: ' + afterR.err);
      await new Promise(function (rr) { setTimeout(rr, 260); });
    }
    if (hoverSel) {                                    /* 悬停（浮层留在页面上再截图） */
      try { await page.hover(hoverSel, { timeout: 3000 }); } catch (e) { console.log('  hover 失败: ' + e.message); }
      await new Promise(function (rr) { setTimeout(rr, 420); });
    }
    var r = await page.evaluate(function (o) {
      var root = document.querySelector('#modal-root');
      var modal = root.querySelector('.modal');
      var ip = root.querySelector('.inner-panel');
      var xb = root.querySelector('.modal-x');
      var out = { hasModal: !!modal };
      var mr = modal ? modal.getBoundingClientRect() : null;
      var xr = xb ? xb.getBoundingClientRect() : null;
      out.geo = {
        modal: mr ? (Math.round(mr.width) + '×' + Math.round(mr.height)) : '-',
        x: xr ? ('left+' + Math.round(xr.left - mr.left) + ' top+' + Math.round(xr.top - mr.top)
          + ' ' + Math.round(xr.width) + 'px') : 'NONE',
        overflow: ip ? (ip.scrollHeight - ip.clientHeight) : -1,
      };
      if (o.probe) {
        try { out.p = (new Function('scope', 'root', 'return (' + o.probe + ')')(modal || document.body, root)); }
        catch (e2) { out.pErr = String(e2 && e2.message).slice(0, 90); }
      }
      return out;
    }, { probe: probe });
    await page.screenshot({ path: path.join(OUT, TAG + '-' + name + '.png') });
    console.log('✓ ' + TAG + '-' + name + '.png  ' + JSON.stringify(r.geo || {}) + '  ' + JSON.stringify(r.p || r.pErr || {}));
    await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });
    await new Promise(function (rr) { setTimeout(rr, 140); });
    return r;
  }

  /* ① 建筑弹窗：右上角 × + 底栏三键 + 不溢出 */
  var r1 = await shot('bldg-x', 'ui.openBuildModal(' + boot.junyingIdx + ')',
    '(function(){' +
    'var x=root.querySelector(".modal-x");' +
    'var acts=root.querySelector(".bldg-acts");' +
    'var footClose=root.querySelector(".bldg-foot [data-action=\\"close-modal\\"]");' +
    'var mr=(root.querySelector(".modal")||{getBoundingClientRect:function(){return{right:0,top:0};}}).getBoundingClientRect();' +
    'var xr=x?x.getBoundingClientRect():null;' +
    'return {hasX:!!x,inTopRight: xr?(xr.left>mr.right-80 && xr.top<mr.top+80):false,' +
    'actsStillThere:!!acts,footHasClose:!!footClose,footExists:!!root.querySelector(".bldg-foot")};})()');

  /* ② 兵营招募（步兵页）+ 悬停浮层 */
  var r2 = await shot('troop-card', '(function(){ui._trainTab="inf";ui.openTroops(' + boot.junyingIdx + ',"normal");})()',
    '(function(){' +
    'var cards=root.querySelectorAll(".troop-card");var c0=cards[0];' +
    'var face=c0?c0.textContent.replace(/\\s+/g," ").trim():"";' +
    'return {cards:cards.length,face:face.slice(0,40),hasTstat:!!root.querySelector(".troop-card .tstat")};})()');
  var r2b = await shot('troop-tip', '(function(){ui._trainTab="inf";ui.openTroops(' + boot.junyingIdx + ',"normal");})()',
    '(function(){var tl=document.getElementById("tip-layer");var tx=tl?(tl.textContent||""):"";' +
    'return {tipShown: !!(tl && /兵种属性/.test(tx)),hasHp:/血 /.test(tx),hasLoad:/负重 /.test(tx),' +
    'snippet:tx.replace(/\\s+/g," ").slice(0,80)};})()', '#modal-root .troop-card');

  /* ③ 出征面板：搬运预估行 —— 目标取**地图上等级最高**的野地（才可能出现"超出运力"），
       兵力只带战斗兵（不带民夫/辎重车）→ 显示"运力不足"的警戒教玩家带后勤。
       ⚠️ 面板渲染不是同步的：兵力框要等渲染落定后再填（afterExpr），
          且城池驻军要先补（否 max=0，填多少都是 0）。 */
  var t3 = boot.maxWild || boot.wild;
  var r3 = await shot('exp-haul',
    t3
      ? '(function(){var c=GAME.currentCity();' +
        'if(!c.army||!c.army.yibing){c.army={yibing:5000,changqiang:3000,qingji:500,minfu:800,zhouche:60};}' +
        'ui.openExpModal({kind:"wild",x:' + t3.x + ',y:' + t3.y + ',name:"试野地"});})()'
      : '(function(){return "no wild";})()',
    '(function(){var h=document.getElementById("exp-haul");var tx=h?h.textContent:"";' +
    'var ins=[];document.querySelectorAll("input[id^=exp-]").forEach(function(e){' +
    'ins.push(e.id+"="+e.value+"/max:"+(e.max||"-"));});' +
    'return {haulLine:tx.replace(/\\s+/g," ").slice(0,130),inputs:ins.slice(0,6),' +
    'hasCap:/随军载重/.test(tx),hasWarn:/超出运力/.test(tx),hasOk:/可尽取/.test(tx)};})()',
    null,
    '(function(){' +
    /* 默认方式是「占领」——野地占领按规则不取财货（mul=0）；演示搬运要切到「掠夺」 */
    'ui._expMode="raid";if(ui.applyExpMode)ui.applyExpMode();' +
    'var c=GAME.currentCity();' +
    'Object.keys(c.army||{}).forEach(function(id){' +
    'var el=document.getElementById("exp-"+id);' +
    'if(el)el.value=(id==="minfu"||id==="zhouche")?0:(el.max||0);});' +
    'ui.updateExpMarch();})()');

  /* ④ 战报**正文**（含资财行 + 运力不足行）—— 沙盘走 viewReport，正文走 viewReportText */
  var r4 = await shot('loot-report', (function () {
    var w = boot.wild;
    if (!w) return '(function(){return "no wild";})()';
    return '(function(){' +
      'var st=GAME.state,c=GAME.currentCity();' +
      'c.army={yibing:300};' +
      'var g=(st.generals||[]).filter(function(x){return !x.status||x.status==="idle";})[0];' +
      'if(!g)return "no-gen";' +
      'g.cityId=c.id;g.status="idle";if(GAME.setStaNow)GAME.setStaNow(g,200);g.energy=200;' +
      'st.settings=st.settings||{};st.settings.battleWatch=false;' +
      'var d=GAME.march.dispatch({kind:"wild",x:' + w.x + ',y:' + w.y + ',name:"试野地",lv:' + w.lv + '},' +
      '"raid",{yibing:300},g.id,null,null,null);' +
      'if(!d||d.ok===false)return "dispatch:"+((d&&d.msg)||"-");' +
      '(st.marches||[]).forEach(function(m){m.elapsed=m.totalTime+1;});GAME.march.tick();' +
      'ui.viewReportText(0);' +
      '})()';
  })(),
    '(function(){var tx=scope.textContent||"";return {hasLoot:tx.indexOf("资财")>=0,' +
    'hasCap:tx.indexOf("随军载重")>=0,hasShort:tx.indexOf("运力不足")>=0,' +
    'snippet:tx.replace(/\\s+/g," ").slice(0,170)};})()');

  var okAll = true;
  function need(cond, label) { if (!cond) { okAll = false; console.log('  ⚠ 未过：' + label); } }
  need(r1.p && r1.p.hasX && r1.p.inTopRight && r1.p.actsStillThere && !r1.p.footHasClose, '① 建筑弹窗关闭键位置');
  need(r1.geo && r1.geo.overflow <= 0, '① 建筑弹窗不溢出');
  need(r2.p && r2.p.cards > 0 && !r2.p.hasTstat, '② 卡面无属性行');
  need(r2b.p && r2b.p.tipShown && r2b.p.hasLoad, '② 悬停浮层含负重');
  need(r3.p && r3.p.hasCap, '③ 出征面板搬运行');
  if (t3 && t3.lv >= 4) need(r3.p && r3.p.hasWarn, '③ 高级目标显示"超出运力"警戒（Lv' + t3.lv + '）');
  need(r3.geo && r3.geo.overflow <= 0, '③ 出征面板不溢出');
  need(r4.p && r4.p.hasCap && r4.p.hasShort, '④ 战报正文搬运两行');
  console.log(okAll ? '\n实机判据通过' : '\n⚠ 有判据未过');
  await browser.close();
  process.exit(okAll ? 0 : 1);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
