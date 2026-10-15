/* ============================================================
 * shot_v89117.js — v89.117 实机图 + 几何量测
 *   ① 军务总览（默认页签）：两营并列 + 页签角标
 *   ② 铁匠铺：整卡点选 + 底部唯一打造键 + 具体套装子条
 *   ③ 背包装备：含将领穿戴件（显示将领全名）+ 三排筛选
 *   ④ 弹窗层级：两级（铁匠铺 → 套装效果）+ 右上角 × 的「返回」提示
 *   ⑤ 战斗界面：三列 1/6 : 2/3 : 1/6 + 逐兵种回合行（错开 + 虚线）
 *   ⑥ 出征面板：城主 / 守将在下拉里置灰（不可出征）
 * 用法：node .workbuddy/tools/show/shot_v89117.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var TAG = 'v89117';
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

  /* ---------- 建局 + 补料（走游戏自己的出口） ---------- */
  var boot = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.newGame({ name: '北', cityName: '许都', mapSeed: 20260924 });
    G.state = st;
    if (!st.map.grid) G.map.generate();
    var c = G.currentCity() || st.cities[0];
    G.ui._cityId = c.id;
    if (G.ui.enterGame) G.ui.enterGame();
    if (G.ui.closeAllModals) G.ui.closeAllModals(); else if (G.ui.closeModal) G.ui.closeModal();
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 9e6; });
    st.res.gold = 5e6;
    c.army = { yibing: 6000, changqiang: 4000, gongjian: 2000, daodun: 2000, qingji: 600, minfu: 800, zhouche: 40 };
    c.wallLv = 5;
    /* 铁匠铺：真实建造出口 + 直接落成（说明见文档） */
    var idx = -1;
    for (var i = 0; i < c.cells.length && idx < 0; i++) {
      if (c.cells[i] && !c.cells[i].build && !c.cells[i].official) {
        var r = G.buildAt(c.id, i, 'tiejiangpu');
        if (r && r.ok) idx = i;
      }
    }
    if (idx >= 0 && c.cells[idx].pending) { c.cells[idx].pending = null; c.cells[idx].build = { id: 'tiejiangpu', lvl: 3 }; }
    (G.DATA.MATERIALS || []).forEach(function (m) { st.items[m.id] = 199; });
    /* 将领：一位当城主、一位当守将（出征下拉要能看到置灰）+ 一位空闲 */
    var gs = st.generals || [];
    if (gs[0]) G.assignGeneral(gs[0].id, 'mayor', c.id);
    if (gs[1]) G.assignGeneral(gs[1].id, 'guard', c.id);
    while (st.generals.length < 3) {
      st.generals.push(G.makeGeneral('v117备将', 20, 'idle', c.id, false));
    }
    /* 背包装备：几件散件 + 一件已穿戴（角标要显示将领名） */
    st.inventory = ['cr_weapon_1', 'cr_head_1', 'cr_chest_2', 'cr_feet_1', 'cr_ring_1'];
    var gFree = st.generals[st.generals.length - 1];
    if (gFree) G.systems.equipItem(gFree.id, 'cr_weapon_1');
    /* 两营有货 */
    st.wounded = 486; st.woundedArmy = { yibing: 260, changqiang: 140, gongjian: 86 };
    st.captives = { yibing: 64, changqiang: 38, qingji: 12 };
    /* 找一格低等级野地（战场图要用） */
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
    return { city: c.name, wild: tgt, forgeIdx: idx, freeGen: gFree ? gFree.name : '' };
  });
  console.log('现场：' + boot.city + '　铁匠铺格位 ' + boot.forgeIdx + '　野地 '
    + (boot.wild ? boot.wild.x + ',' + boot.wild.y : '无') + '　空闲将 ' + boot.freeGen);

  async function shot(name, expr, probe, after) {
    /* ⚠️ 判据用 falsy（首版写 `after === undefined`，而调用点传了 '' → 没关窗 →
       弹层栈一路累积到 3 层，量出来的"层数"全是假的）。 */
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
    await new Promise(function (rr) { setTimeout(rr, 380); });
    if (after) {
      var aErr = await page.evaluate(function (e) {
        try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
        catch (err) { return String(err && err.message).slice(0, 140); }
        return null;
      }, after);
      if (aErr) console.log('  after 出错：' + aErr);
      await new Promise(function (rr) { setTimeout(rr, 300); });
    }
    var p = await page.evaluate(function (e) {
      try { return (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message).slice(0, 140) }; }
    }, probe).catch(function (er) { return { probeErr: String(er && er.message).slice(0, 140) }; });
    var geo = await page.evaluate(function () {
      var panel = document.querySelector('#modal-root .inner-panel') || document.querySelector('.ui-page');
      var out = { overflow: panel ? (panel.scrollHeight - panel.clientHeight) : null,
        modalDepth: (window.GAME.ui._modalStack || []).length };
      var brd = document.querySelector('#modal-root .bt-board');
      if (brd) {
        out.boardCols = getComputedStyle(brd).gridTemplateColumns;
        var kids = brd.children;
        out.colW = [];
        for (var i = 0; i < kids.length; i++) out.colW.push(Math.round(kids[i].getBoundingClientRect().width));
      }
      var lg = document.getElementById('bt-log');
      if (lg) { out.logRows = lg.children.length; out.logH = Math.round(lg.getBoundingClientRect().height); }
      return out;
    });
    var f = path.join(OUT, TAG + '-' + name + '.png');
    await page.screenshot({ path: f });
    console.log('  📷 ' + TAG + '-' + name + '.png　' + JSON.stringify(p) + '　溢出=' + geo.overflow
      + '　层=' + geo.modalDepth + (geo.boardCols ? ('　三列=' + geo.boardCols + ' 实测px=' + geo.colW.join('/')) : '')
      + (geo.logRows != null ? ('　播报行=' + geo.logRows) : ''));
    return { p: p, geo: geo };
  }

  /* ---------- ① 军务总览：两营 + 角标 ---------- */
  var r1 = await shot('marches-two-camps',
    '(function(){ui._marchTab="over";ui.setView("marches");' +
    'var b=document.querySelector(".march-tabs .mt-n");return {badge:!!b};})()',
    '(function(){var vc=document.querySelector("#view-container");var tx=vc?vc.textContent:"";' +
    'return {hasWounded:tx.indexOf("伤兵营")>=0,hasCaptive:tx.indexOf("俘虏营")>=0,' +
    'rule8:tx.indexOf("8%")>=0,ruleCap:tx.indexOf("3,000")>=0,' +
    'healBtn:!!vc.querySelector("[data-action=\\"heal-wounded\\"]"),' +
    'conscript:!!vc.querySelector("[data-action=\\"conscript-captives\\"]"),' +
    'badge:!!vc.querySelector(".march-tabs .mt-n")};})()', '');

  /* ---------- ② 铁匠铺：单键 + 套装子条 ---------- */
  var r2 = await shot('forge-single-key',
    '(function(){ui._forgeKind="all";ui._forgeSet="";ui._forgeQ=1;ui._forgeSel="";' +
    'ui._pages["forge"]=1;ui.openForge();})()',
    '(function(){var root=document.querySelector("#modal-root");' +
    'var cards=root.querySelectorAll(".item-row[data-action=\\"forge-pick\\"]");' +
    'var inner=root.querySelectorAll(".item-row [data-action=\\"forge-item\\"]").length;' +
    'var foot=root.querySelectorAll(".m-foot [data-action=\\"forge-item\\"]");' +
    'return {cards:cards.length,innerBtns:inner,footBtns:foot.length,' +
    'footDisabled:foot[0]?foot[0].hasAttribute("disabled"):null,' +
    'footTxt:foot[0]?foot[0].textContent.replace(/\\s+/g,""):""};})()', '');

  /* ---------- ②b 铁匠铺：切「套装」→ 具体套装子条 + 选中一件 ---------- */
  var r2b = await shot('forge-set-filter',
    '(function(){ui._forgeKind="set";ui._forgeSet="";ui._forgeQ=1;ui._forgeSel="";ui.openForge();' +
    'var s=document.querySelector("#modal-root [data-action=\\"forge-set\\"]");if(s)s.click();' +
    'var row=document.querySelector("#modal-root .item-row[data-action=\\"forge-pick\\"]");if(row)row.click();})()',
    '(function(){var root=document.querySelector("#modal-root");' +
    'var chips=root.querySelectorAll("[data-action=\\"forge-set\\"]");' +
    'var foot=root.querySelector(".m-foot [data-action=\\"forge-item\\"]");' +
    'return {setChips:chips.length,sel:!!root.querySelector(".item-row.on"),' +
    'footTxt:foot?foot.textContent.replace(/\\s+/g,""):""};})()', '');

  /* ---------- ③ 背包装备：含穿戴 + 筛选 ---------- */
  var r3 = await shot('bag-equip-worn',
    '(function(){ui.openBag("equip");})()',
    '(function(){var vc=document.querySelector("#view-container");var tx=vc?vc.textContent:"";' +
    'var worn=vc.querySelectorAll(".bag-worn");var names=[];' +
    'worn.forEach(function(x){names.push(x.textContent);});' +
    'return {wornN:worn.length,wornNames:names.slice(0,4).join("/"),' +
    'chips:vc.querySelectorAll("[data-action=\\"bag-eq-f\\"]").length,' +
    'hasWornChip:tx.indexOf("已穿戴")>=0,hasFreeChip:tx.indexOf("未穿戴")>=0,' +
    'sum:(vc.querySelector(".bag-total")||{}).textContent};})()', '');

  /* ---------- ④ 弹窗层级：铁匠铺 → 套装效果 ---------- */
  var r4 = await shot('modal-stack',
    '(function(){ui.openForge();})()',
    /* probe 读的是「进下级之后」的状态（after 已把套装效果打开） */
    '(function(){var root=document.querySelector("#modal-root");' +
    'var t=(root.querySelector(".m-title")||{}).textContent||"";' +
    'var x=root.querySelector(".modal-x");' +
    'return {title:t,depth:(window.GAME.ui._modalStack||[]).length,' +
    'xTitle:x?x.getAttribute("title"):"",hasUp:x?x.className.indexOf("has-up")>=0:false,' +
    'behind:(window.GAME.ui._modalStack||[]).map(function(l){return l.title;}).join("|")};})()',
    '(function(){var b=document.querySelector("#modal-root [data-action=\\"forge-setinfo\\"]");if(b)b.click();})()');

  /* ---------- ⑤ 战斗界面：三列 + 逐兵种回合行 ---------- */
  var w = boot.wild;
  var r5 = await shot('battle-lanes',
    w ? '(function(){' +
      'if(ui.closeAllModals)ui.closeAllModals();' +          /* 层数要干净（这张图量的是战场本体） */
      'var st=GAME.state,c=GAME.currentCity();' +
      'var g=(st.generals||[]).filter(function(x){return !x.status||x.status==="idle";})[0];' +
      'if(!g)return "no-gen";' +
      'g.cityId=c.id;g.status="idle";if(GAME.setStaNow)GAME.setStaNow(g,300);g.energy=300;' +
      'st.settings=st.settings||{};st.settings.battleWatch=true;' +
      'var d=GAME.march.dispatch({kind:"wild",x:' + w.x + ',y:' + w.y + ',name:"试野地",lv:' + w.lv + '},' +
      '"raid",{yibing:1500,changqiang:1200,gongjian:600},g.id,null,null,null);' +
      'if(!d||d.ok===false)return "dispatch:"+((d&&d.msg)||"-");' +
      '(st.marches||[]).forEach(function(m){m.elapsed=m.totalTime+1;});GAME.march.tick();' +
      'if(ui.openBattlefield&&st.battles&&st.battles[0])ui.openBattlefield(st.battles[0].id);' +
      '})()' : '(function(){return "no wild";})()',
    '(function(){var root=document.querySelector("#modal-root");var lg=document.getElementById("bt-log");' +
    'return {sides:root.querySelectorAll("#bt-board .bt-side").length,' +
    'rows:root.querySelectorAll("#bt-board .bt-rrow").length,' +
    'logRows:lg?lg.children.length:0,' +
    'seps:lg?lg.querySelectorAll(".bt-ev.sep").length:0,' +
    'hdrs:lg?lg.querySelectorAll(".bt-ev.hdr").length:0,' +
    'indents:(function(){var out=[];if(!lg)return out;' +
    '   Array.prototype.slice.call(lg.querySelectorAll(".bt-ev.atk,.bt-ev.def")).slice(0,6)' +
    '   .forEach(function(x){out.push(x.style.paddingLeft||"0");});return out;})()};})()',
    /* after：连点两次「完成回合」—— 逐兵种回合行要有真回合才画得出来 */
    '(function(){var n=0;var id=setInterval(function(){' +
    'var b=document.querySelector("#modal-root [data-action=\\"bt-done\\"]");' +
    'if(b&&!b.hasAttribute("disabled"))b.click();n++;if(n>3)clearInterval(id);},260);})()');

  /* ---------- ⑥ 出征面板：城主 / 守将置灰 ---------- */
  var r6 = await shot('exp-gen-disabled',
    w ? '(function(){ui.openExpModal({kind:"wild",x:' + w.x + ',y:' + w.y + ',name:"试野地"});})()'
      : '(function(){return "no wild";})()',
    '(function(){var sel=document.getElementById("exp-gen");if(!sel)return {noSel:true};' +
    'var opts=[];Array.prototype.slice.call(sel.options).forEach(function(o){' +
    '   opts.push({t:o.textContent.slice(0,26),dis:o.disabled});});' +
    'return {n:sel.options.length,disabledN:sel.options.length-Array.prototype.filter.call(sel.options,function(o){return !o.disabled;}).length,' +
    'first:opts[0]?opts[0].t:"",hasMayor:opts.some(function(x){return /城主/.test(x.t)&&x.dis;}),' +
    'hasGuard:opts.some(function(x){return /守将/.test(x.t)&&x.dis;})};})()', '');

  console.log('\n页面错误: ' + (errs.length ? errs.join(' | ') : '无'));
  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
