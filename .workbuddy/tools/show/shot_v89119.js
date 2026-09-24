/* ============================================================
 * shot_v89119.js — v89.119 实机图 + 判据
 *   ① 实时战斗界面 · 下部分回合记录：反击并入"引发它的那次出手"
 *      （`进 30 · → 敌 歼 N（敌反击 歼 M）`；不再独立成格、不再排到出手之前）
 *   ② 战报（沙盘 / 正文）：回合纪要里的反击与出手段同段
 *
 * 靶子：脚本**动态选靶**（扫城周 L5~L7 野地，按"离城最近"取两格），
 *   兵力按守军总量 × 1.5 配（探针 probe_v89119_arena2.js 实测：该配比
 *   "我方胜 + 11~20 回合 + 20~40 次反击"，正好够展示配对形态）。
 * ⚠️ 「完成回合」在**播放中点击会被吞**（ui._bt.playing → 只 toast）——
 *   点击节拍必须 > 一回合动画时长（620ms + 260ms×事件数），故取 2600ms。
 * 用法：node .workbuddy/tools/show/shot_v89119.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var TAG = 'v89119';
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  if (!fs.existsSync(exe)) exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium_headless_shell-1217/chrome-win64/headless_shell.exe';
  var browser = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  page.on('pageerror', function (e) { errs.push(String(e && e.message).slice(0, 160)); });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForFunction('window.GAME && GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北', cityName: '许都', mapSeed: 20260925 });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    var c = G.currentCity() || st.cities[0];
    G.ui._cityId = c.id;
    if (G.ui.enterGame) G.ui.enterGame();
    if (G.ui.closeAllModals) G.ui.closeAllModals(); else if (G.ui.closeModal) G.ui.closeModal();
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    c.army = { yibing: 12000, changqiang: 12000, daodun: 9000 };
    c.wallLv = 5;
    /* 动态选靶：城周 L5~L7（最近优先） */
    var list = [], CMAX = G.COORD_MAX || 499;
    for (var dx = -14; dx <= 14; dx++) {
      for (var dy = -14; dy <= 14; dy++) {
        var xx = c.x + dx, yy = c.y + dy;
        if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
        var tl = G.map.tile(xx, yy);
        if (!tl || tl.terrain === 'city') continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
        if (lv >= 5 && lv <= 7) {
          var d = G.wildDefenseAt(xx, yy, lv);
          list.push({ x: xx, y: yy, lv: lv, total: d.total, dist: Math.abs(dx) + Math.abs(dy) });
        }
      }
    }
    list.sort(function (a, b) { return a.dist - b.dist; });
    return { city: c.name, spots: list.slice(0, 2) };
  });
  console.log('现场：' + boot.city + '　靶子 ' + JSON.stringify(boot.spots));
  var sp1 = boot.spots[0], sp2 = boot.spots[1] || boot.spots[0];

  /* 按守军总量配兵（×1.5，比例 55/25/20 —— 见文件头注释） */
  function armyOf(sp) {
    var n = Math.round(sp.total * 1.5);
    return { changqiang: Math.round(n * 0.55), daodun: Math.round(n * 0.25), yibing: Math.round(n * 0.20) };
  }
  var A1 = armyOf(sp1), A2 = armyOf(sp2);

  async function shot(name, expr, probe, after, settleMs) {
    if (!after) {
      await page.evaluate(function () {
        var G = window.GAME;
        if (G.ui.closeAllModals) G.ui.closeAllModals(); else if (G.ui.closeModal) G.ui.closeModal();
      });
    }
    var openR = await page.evaluate(function (e) {
      try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message).slice(0, 140) }; }
      return { ok: true };
    }, expr);
    if (openR.err) { console.log('⛔ ' + name + ' —— ' + openR.err); return openR; }
    await new Promise(function (rr) { setTimeout(rr, 420); });
    if (after) {
      var aErr = await page.evaluate(function (e) {
        try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
        catch (err) { return String(err && err.message).slice(0, 140); }
        return null;
      }, after);
      if (aErr) console.log('  after 出错：' + aErr);
      await new Promise(function (rr) { setTimeout(rr, settleMs || 320); });
    }
    var p = probe ? await page.evaluate(function (e) {
      try { return (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { probeErr: String(err && err.message).slice(0, 140) }; }
    }, probe) : null;
    var geo = await page.evaluate(function () {
      var el = document.querySelector('#modal-root .modal') || document.querySelector('#view-container');
      if (!el) return null;
      var panel = el.querySelector('.inner-panel') || el;
      return { overflow: panel.scrollHeight - panel.clientHeight,
        w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) };
    });
    var file = path.join(OUT, TAG + '-' + name + '.png');
    await page.screenshot({ path: file });
    console.log('\n【' + name + '】' + (p ? JSON.stringify(p) : '')
      + '\n  geo=' + JSON.stringify(geo) + '　→ ' + path.basename(file));
    return { p: p, geo: geo, file: file };
  }

  /* ---------- ① 实时战斗：回合记录里的反击配对形态 ---------- */
  var r1 = await shot('battle-round-log',
    '(function(){' +
    'if(ui.closeAllModals)ui.closeAllModals();' +
    'var st=GAME.state,c=GAME.currentCity();' +
    'var g=(st.generals||[]).filter(function(x){return !x.status||x.status==="idle";})[0];' +
    'if(!g)return "no-gen";' +
    'g.cityId=c.id;g.status="idle";if(GAME.setStaNow)GAME.setStaNow(g,300);g.energy=300;' +
    'st.settings=st.settings||{};st.settings.battleWatch=true;' +
    'var d=GAME.march.dispatch({kind:"wild",x:' + sp1.x + ',y:' + sp1.y + ',name:"试野地",lv:' + sp1.lv + '},' +
    '"raid",' + JSON.stringify(A1) + ',g.id,null,null,null);' +
    'if(!d||d.ok===false)return "dispatch:"+((d&&d.msg)||"-");' +
    '(st.marches||[]).forEach(function(m){m.elapsed=m.totalTime+1;});GAME.march.tick();' +
    'if(ui.openBattlefield&&st.battles&&st.battles[0])ui.openBattlefield(st.battles[0].id);' +
    '})()',
    '(function(){var lg=document.getElementById("bt-log");' +
    'if(!lg)return {noLog:true};' +
    'var rows=[];for(var i=0;i<lg.children.length;i++){var e=lg.children[i];' +
    'rows.push({cls:e.className,txt:e.textContent});}' +
    'var allr=rows.filter(function(x){return x.cls.indexOf("atk")>=0||x.cls.indexOf("def")>=0;});' +
    'var ctr=0,pair=0,lone=0,hdrs=0;' +
    'rows.forEach(function(x){if(x.cls.indexOf("hdr")>=0)hdrs++;});' +
    'allr.forEach(function(x){ctr+=(x.txt.match(/反击/g)||[]).length;' +
    'pair+=(x.txt.match(/（[^）]*反击 歼/g)||[]).length;' +
    'if(x.txt.indexOf("反击")>=0&&x.txt.indexOf("（")<0)lone++;});' +
    'return {rows:rows.length,actRows:allr.length,hdrs:hdrs,ctr:ctr,pair:pair,lone:lone,' +
    'sample:allr.slice(-10).map(function(x){return x.txt;})};})()',
    '(function(){var n=0;var id=setInterval(function(){' +
    'var b=document.querySelector("#modal-root [data-action=\\"bt-done\\"]");' +
    'if(b)b.click();n++;if(n>=4)clearInterval(id);},2600);})()',
    11200);

  /* ---------- ② 战报：回合纪要里的反击同段 ---------- */
  var r2 = await shot('report-counter',
    '(function(){' +
    'if(ui.closeAllModals)ui.closeAllModals();' +
    'var st=GAME.state,c=GAME.currentCity();' +
    'var g=(st.generals||[]).filter(function(x){return !x.status||x.status==="idle";})[0];' +
    'if(!g)return "no-gen";' +
    'g.cityId=c.id;g.status="idle";if(GAME.setStaNow)GAME.setStaNow(g,300);g.energy=300;' +
    'st.settings=st.settings||{};st.settings.battleWatch=false;' +
    'var d=GAME.march.dispatch({kind:"wild",x:' + sp2.x + ',y:' + sp2.y + ',name:"试野地",lv:' + sp2.lv + '},' +
    '"raid",' + JSON.stringify(A2) + ',g.id,null,null,null);' +
    'if(!d||d.ok===false)return "dispatch:"+((d&&d.msg)||"-");' +
    '(st.marches||[]).forEach(function(m){m.elapsed=m.totalTime+1;});GAME.march.tick();' +
    'ui.viewReport(GAME.repRidOf(GAME.state.reports[0]));' +   /* v89.120：身份 rid */
    '})()',
    '(function(){var mr=document.querySelector("#modal-root");var tx=mr?mr.textContent:"";' +
    'var st=GAME.state;var body=(st.reports&&st.reports[0]&&st.reports[0].body)||"";' +
    'var all=tx+"\\n"+body;' +
    'var ctr=(all.match(/反击 杀伤/g)||[]).length;' +
    'var pair=(all.match(/（[^）]*反击 杀伤/g)||[]).length;' +
    'var lone=0;all.split("；").forEach(function(x){if(x.indexOf("反击 杀伤")>=0&&x.indexOf("（")<0)lone++;});' +
    'var rounds=(all.match(/第 \\d+ 回合/g)||[]).length;' +
    'var i=all.indexOf("（");' +
    'return {ctr:ctr,pair:pair,lone:lone,roundRows:rounds,domLen:tx.length,bodyLen:body.length,' +
    'snippet:(i<0?"(无)":all.slice(Math.max(0,i-80),i+64))};})()',
    /* after：沙盘弹窗 → 点「📜 战报正文」→ 正文页（回合纪要在那一页） */
    '(function(){var b=document.querySelector("#modal-root [data-action=\\"sd-text\\"]");if(b)b.click();})()',
    900);

  var okAll = true;
  function need(cond, label) { if (!cond) { okAll = false; console.log('  ⚠ 未过：' + label); } }
  need(r1.p && r1.p.ctr >= 2 && r1.p.ctr === r1.p.pair && r1.p.lone === 0 && r1.p.hdrs >= 2,
    '① 战场回合记录：反击全部为配对形态（（X反击 歼 N））、无独立段、≥2 回合');
  need(r1.geo && r1.geo.overflow <= 0, '① 战场不溢出');
  need(r2.p && r2.p.ctr >= 1 && r2.p.pair >= 1 && r2.p.lone === 0, '② 战报：反击与出手段同段');
  need(r2.geo && r2.geo.overflow <= 0, '② 战报弹窗不溢出');
  console.log('\n页面错误：' + (errs.length ? errs.join(' | ') : '无'));
  console.log(okAll ? '\n实机判据通过' : '\n⚠ 有判据未过');
  await browser.close();
  process.exit(okAll ? 0 : 1);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
