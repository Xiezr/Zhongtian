/* ============================================================
 * shot_v89120.js — v89.120 实机图 + 判据
 *   ① 实时战斗：三键（完成回合/自动战斗/撤退）在**读秒行正中间**（.bt-top .bt-acts）
 *      + 回合记录**倒叙**（最新回合在最上，块内正序、回合间虚线）
 *   ② 战报正文：掠报正文点「下页」—— 期间 unshift 侦察报告（位移干扰），
 *      仍打开**原掠报**（第 2 页）—— 病根修复的现场证据
 *   ③ 沙盘：replay 态改动作（chip）→ **自动进入推演**（设定即生效）+ 提示行
 * ⚠️ 「完成回合」在播放中点击会被吞（ui._bt.playing）—— 节拍 > 一回合动画（2600ms）。
 * 用法：node .workbuddy/tools/show/shot_v89120.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var TAG = 'v89120';
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
    var st = G.newGame({ name: '令', cityName: '许都', mapSeed: 20260925 });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    var c = G.currentCity() || st.cities[0];
    G.ui._cityId = c.id;
    if (G.ui.enterGame) G.ui.enterGame();
    if (G.ui.closeAllModals) G.ui.closeAllModals(); else if (G.ui.closeModal) G.ui.closeModal();
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    c.army = { yibing: 12000, changqiang: 12000, daodun: 9000 };
    c.wallLv = 5;
    /* 动态选靶：城周 L5~L7（最近优先）—— 多回合才看得到倒叙与推演空间 */
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
    /* ⚠️ 首版按"离城最近"取 → L5（840 守军）一回合打完，出不了倒叙 ——
       改按**守军总量降序**（多回合才看得到倒叙与推演空间）。 */
    list.sort(function (a, b) { return b.total - a.total; });
    return { city: c.name, spots: list.slice(0, 2) };
  });
  console.log('现场：' + boot.city + '　靶子 ' + JSON.stringify(boot.spots));
  var sp1 = boot.spots[0], sp2 = boot.spots[1] || boot.spots[0];
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

  /* ---------- ① 战场：三键在读秒行 + 回合记录倒叙 ---------- */
  var r1 = await shot('battle-btns-log',
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
    '(function(){' +
    'var top=document.querySelector("#modal-root .bt-top");' +
    'var acts=top?top.querySelector(".bt-acts"):null;' +
    'var btns=acts?acts.querySelectorAll("[data-action]").length:0;' +
    'var lg=document.getElementById("bt-log");' +
    'var hdrs=[];if(lg)lg.querySelectorAll(".bt-ev.hdr").forEach(function(e){hdrs.push(e.textContent);});' +
    'var kids=[];if(lg){for(var i=0;i<Math.min(4,lg.children.length);i++){kids.push(lg.children[i].className);}}' +
    'return {actsBtns:btns,hdrs:hdrs,kids:kids};})()',
    /* after：**轮询**点「完成回合」—— 只在非播放态点（L7 事件多，一回合动画可达数秒；
       固定 2600ms 节拍会把第二击吞掉 —— 首版就只出了一个回合头）。直到两个回合头。 */
    '(function(){var tries=0;var id=setInterval(function(){' +
    'tries++;' +
    'var lg=document.getElementById("bt-log");' +
    'var hc=lg?lg.querySelectorAll(".bt-ev.hdr").length:0;' +
    'if(hc>=2||tries>24){clearInterval(id);return;}' +
    'var bt=window.GAME.ui._bt;' +
    'if(bt&&!bt.playing){' +
    'var b=document.querySelector("#modal-root [data-action=\\"bt-done\\"]");' +
    'if(b)b.click();}' +
    '},600);})()',
    16000);

  /* ---------- ② 战报正文「下页」+ 干扰（病根修复的现场证据） ---------- */
  var r2 = await shot('report-next-page',
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
    'var rep=null;(st.reports||[]).forEach(function(r){if(!rep&&r.sandbox&&r.type!=="scout")rep=r;});' +
    'if(!rep)return "no-raid-report";' +
    /* 扩样：模拟大仗（>12 回合才出翻页条） */
    'if(rep.scene){var arr=[];for(var i=0;i<15;i++)arr.push("第 "+(i+1)+" 回合　·　间距 "+(900-i*10));rep.scene.roundsText=arr;}' +
    'ui.viewReportText(GAME.repRidOf(rep));' +
    '})()',
    '(function(){' +
    'var mr=document.querySelector("#modal-root");' +
    'var t=mr.querySelector(".gold-heading")||mr.querySelector(".m-title");' +
    'var title=t?t.textContent.replace(/\\s+/g," ").slice(0,40):"(无)";' +
    'var rep=GAME.repByRid(ui._repId);' +
    'return {title:title,repId:ui._repId,repTitle:rep?rep.title:"(无效身份)",' +
    'page:ui._pages["rlog"]||1,hasPager:!!mr.querySelector("[data-action=\\"mpage\\"][data-key=\\"rlog\\"]")};})()',
    /* after：干扰（unshift 侦察报告位移数组）+ 点**真·下页**（data-n=2） */
    '(function(){' +
    'GAME.state.reports.unshift({t:Date.now(),type:"scout",title:"【干扰】新侦查回报",body:"x",win:true});' +
    'var b=document.querySelector("#modal-root [data-action=\\"mpage\\"][data-key=\\"rlog\\"][data-n=\\"2\\"]");' +
    'if(b)b.click();})()',
    700);

  /* ---------- ③ 沙盘：replay 态改动作 → 自动进推演 ---------- */
  var r3 = await shot('sandbox-sim-enter',
    '(function(){' +
    'if(ui.closeAllModals)ui.closeAllModals();' +
    'var st=GAME.state;' +
    'var rep=null;(st.reports||[]).forEach(function(r){if(!rep&&r.sandbox&&r.type!=="scout")rep=r;});' +
    'if(!rep)return "no-sandbox-report";' +
    'ui.openSandbox(GAME.repRidOf(rep));' +
    '})()',
    '(function(){' +
    'var sd=ui._sd;if(!sd)return {noSd:true};' +
    'var mine=(ui.sdOurSide(sd.sb)==="atk"?sd.cur.atk:sd.cur.def);' +
    'var u0=mine[0]||{};' +
    'var h=document.getElementById("sd-hint");' +
    'return {mode:sd.mode,cmds:sd.sim?JSON.stringify(sd.sim.cmds):"null",' +
    'stance:u0.stance,tid:u0.id,hint:h?h.textContent.slice(0,60):"(无)"};})()',
    /* after：点「驻守」chip（真实点击走 sd-stance 分发）→ 自动进推演 */
    '(function(){' +
    'var sd=ui._sd;if(!sd)return;' +
    'var mine=(ui.sdOurSide(sd.sb)==="atk"?sd.cur.atk:sd.cur.def);' +
    'var tid=(mine[0]||{}).id;if(!tid)return;' +
    'var chip=document.querySelector("#sd-wrap .sd-chip[data-t=\\""+tid+"\\"][data-s=\\"hold\\"]");' +
    'if(chip)chip.click();})()',
    700);

  var okAll = true;
  function need(cond, label) { if (!cond) { okAll = false; console.log('  ⚠ 未过：' + label); } }
  need(r1.p && r1.p.actsBtns === 3, '① 读秒行里三键在册（.bt-top .bt-acts × 3）');
  need(r1.p && r1.p.hdrs && r1.p.hdrs.length >= 2
    && Number((r1.p.hdrs[0].match(/第 (\d+) 回合/) || [])[1] || 0)
       > Number((r1.p.hdrs[1].match(/第 (\d+) 回合/) || [])[1] || 0),
    '① 回合记录倒叙：首个回合头 > 第二个（最新在上）');
  need(r1.p && r1.p.kids && r1.p.kids.length >= 3
    && String(r1.p.kids[0]).indexOf('sep') >= 0 && String(r1.p.kids[1]).indexOf('hdr') >= 0,
    '① 块内正序（块首虚线 → 回合头 → 逐兵种行）');
  need(r1.geo && r1.geo.overflow <= 0, '① 战场不溢出');
  need(r2.p && r2.p.page === 2, '② 「下页」真翻到第 2 页');
  need(r2.p && r2.p.repTitle && r2.p.repTitle.indexOf('侦查') < 0
    && r2.p.title.indexOf('侦查') < 0, '② 干扰 unshift 后仍打开原掠报（未跳侦察报告）');
  need(r2.geo && r2.geo.overflow <= 0, '② 战报正文不溢出');
  need(r3.p && r3.p.mode === 'sim' && r3.p.cmds && r3.p.cmds.indexOf('"hold"') >= 0
    && r3.p.stance === 'hold', '③ 回放态改动作 → 自动进推演且设定落库');
  console.log('\n页面错误：' + (errs.length ? errs.join(' | ') : '无'));
  console.log(okAll ? '\n实机判据通过' : '\n⚠ 有判据未过');
  await browser.close();
  process.exit(okAll ? 0 : 1);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
