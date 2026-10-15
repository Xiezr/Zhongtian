/* ============================================================
 * shot_v89115.js — v89.115 实机图 + 几何量测
 *   ① 自动化：左 1/3 名单（六项）+ 右 2/3 详情（自动治疗）
 *   ② 背包：宝物页 + 二级分类条（按商城分类检索）
 *   ③ 战报：斗将战（战前 · 胜者 +10%）
 *   ④ 军务·烽火：规则块改现实时间口径（每 30 分钟一场）
 * 用法：node .workbuddy/tools/show/shot_v89115.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var TAG = 'v89115';
var OUT = path.join(R, '.workbuddy/shots');
fs.mkdirSync(OUT, { recursive: true });

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
    /* 给背包一些货（材料 + 宝箱 + 图纸 + 精华），让分类条有内容 */
    st.items = st.items || {};
    st.items.chest_tong = (st.items.chest_tong || 0) + 2;
    st.items.lingsui = (st.items.lingsui || 0) + 3;
    st.items.jinang = (st.items.jinang || 0) + 1;
    (G.DATA.MATERIALS || []).slice(0, 6).forEach(function (m, i) { st.items[m.id] = (i + 1) * 3; });
    (G.DATA.BLUEPRINTS || []).slice(0, 2).forEach(function (b) { st.items[b.id] = 1; });
    /* 伤兵（自动治疗详情要有数） */
    st.wounded = 46; st.woundedArmy = { yibing: 46 };
    /* 造军营（兵营截图不用，这里只保证城池有兵） */
    c.army = { yibing: 5000, changqiang: 3000, qingji: 500, minfu: 800, zhouche: 60 };
    /* 找一格 Lv1~3 野地（真打一场用） */
    var tgt = null, CMAX = G.COORD_MAX || 499;
    for (var dx = -20; dx <= 20 && !tgt; dx++) {
      for (var dy = -20; dy <= 20 && !tgt; dy++) {
        if (!dx && !dy) continue;
        var xx = c.x + dx, yy = c.y + dy;
        if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
        var tl = G.map.tile(xx, yy);
        if (!tl || tl.terrain === 'city') continue;
        var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
        /* 斗将只在**双方都有将领**时发生 —— 截图要选"有守将"的野地 */
        var wd = G.wildDefenseAt ? G.wildDefenseAt(xx, yy, lv) : null;
        if (lv >= 1 && lv <= 3 && wd && wd.gen) tgt = { x: xx, y: yy, lv: lv };
      }
    }
    return { save: !!raw, city: c.name, wild: tgt };
  }, saveRaw);
  console.log('开局：' + JSON.stringify(boot));

  async function shot(name, expr, probe, afterExpr) {
    await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });
    var openR = await page.evaluate(function (e) {
      try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
      catch (err) { return { err: String(err && err.message).slice(0, 120) }; }
      return { ok: true };
    }, expr);
    if (openR.err) { console.log('⛔ ' + name + ' —— ' + openR.err); return openR; }
    await new Promise(function (rr) { setTimeout(rr, 350); });
    if (afterExpr) {
      await page.evaluate(function (e) {
        try { (new Function('ui', 'GAME', 'return (' + e + ')')(window.GAME.ui, window.GAME)); }
        catch (err) { return { err: String(err && err.message).slice(0, 120) }; }
        return { ok: true };
      }, afterExpr);
      await new Promise(function (rr) { setTimeout(rr, 320); });
    }
    var r = await page.evaluate(function (o) {
      var vc = document.querySelector('#view-container');
      var scope = vc || document.body;
      var out = { mode: (vc ? 'view' : 'body') };
      if (o.probe) {
        try { out.p = (new Function('scope', 'root', 'return (' + o.probe + ')')(scope, document.querySelector('#modal-root'))); }
        catch (e2) { out.pErr = String(e2 && e2.message).slice(0, 90); }
      }
      return out;
    }, { probe: probe });
    await page.screenshot({ path: path.join(OUT, TAG + '-' + name + '.png') });
    console.log('✓ ' + TAG + '-' + name + '.png  ' + JSON.stringify(r.p || r.pErr || {}));
    await page.evaluate(function () { window.GAME.ui.closeModal && window.GAME.ui.closeModal(); });
    await new Promise(function (rr) { setTimeout(rr, 140); });
    return r;
  }

  /* ① 自动化：左名单 + 右详情（点「自动治疗」） */
  var r1 = await shot('auto-pane',
    '(function(){ui.setView("auto");})()',
    '(function(){' +
    'var items=scope.querySelectorAll(".auto-item");' +
    'var pane=scope.querySelector(".auto-pane");' +
    'var tx=pane?pane.textContent:"";' +
    'return {items:items.length,paneHas:!!pane,' +
    'hasHeal:/自动治疗/.test(tx),hasFee:/治疗费/.test(tx),hasNote:/15 现实秒/.test(tx)};})()',
    '(function(){var b=document.querySelector("[data-action=\\"auto-pick\\"][data-key=\\"heal\\"]");if(b)b.click();})()');

  /* ② 背包：宝物页 · 材料分类（二级分类条） */
  var r2 = await shot('bag-treasure',
    '(function(){ui.openBag("treasure");})()',
    '(function(){' +
    'var subs=scope.querySelectorAll("[data-action=\\"bag-sub\\"]");' +
    'var names=[];subs.forEach(function(x){names.push(x.textContent.replace(/\\s+/g," ").trim());});' +
    'var tabs=scope.querySelectorAll("[data-action=\\"bag-tab\\"]");' +
    'return {tabs:tabs.length,subs:subs.length,list:names.slice(0,8).join(" | "),' +
    'hasSec:/bag-sec/.test(scope.innerHTML)};})()',
    '(function(){ui.setBagSub("material");})()');

  /* ③ 出征面板：斗将预告（目标取一座 NPC 名城 —— 名城必有守将，
       面板会写出"我方 X vs 守将 Y（战前 50% 触发 · 胜者全军 +10%）"）。
       ⚠️ 斗将只在双方都有将领时才有得斗：低等级野地常年无守将，
          取材要挑"一定有守将"的目标（名城 npcCityGuard 是派生的，必有）。 */
  var r3 = await shot('duel-preview',
    '(function(){' +
    'var st=GAME.state;' +
    'var npc=null;(st.map.cities||[]).forEach(function(x){if(!npc&&x.type===`county`)npc=x;});' +
    'if(!npc)npc=(st.map.cities||[])[0];' +
    'if(!npc)return "no-npc";' +
    /* ⚠️ 别动 DATA.DUEL.chance —— 预告要显示的就是"50% 触发"（截图设成 1 会显示 100%） */
    'ui.openExpModal({kind:"city",id:npc.id,npc:npc});' +
    '})()',
    '(function(){var mr=document.querySelector("#modal-root");var tx=mr?mr.textContent:"";' +
    'var pw=document.getElementById("exp-power");' +
    'return {hasDuel:tx.indexOf("斗将")>=0,hasChance:/50%/.test(tx),' +
    'powerTxt:(pw?pw.textContent:"").replace(/\s+/g," ").slice(0,120),' +
    'genOpts:document.querySelectorAll("#exp-gen option").length};})()',
    '(function(){var c=GAME.currentCity();' +
    'c.army=c.army||{};' +
    'if(!c.army.yibing)c.army={yibing:5000,changqiang:3000};' +
    'Object.keys(c.army||{}).forEach(function(id){' +
    'var el=document.getElementById("exp-"+id);if(el)el.value=(el.max||0);});' +
    'ui.updateExpMarch();})()');

  /* ④ 军务 · 烽火：规则块（现实时间口径） */
  var r4 = await shot('beacon-rules',
    '(function(){ui.setView("marches");ui._marchTab="beacon";ui.renderView("marches");})()',
    '(function(){var tx=scope.textContent||"";return {hasMin:/每 30 分钟/.test(tx),' +
    'hasReal:/现实时间/.test(tx),hasOffline:/最多补算 3 场/.test(tx)};})()');

  var okAll = true;
  function need(cond, label) { if (!cond) { okAll = false; console.log('  ⚠ 未过：' + label); } }
  need(r1.p && r1.p.items === 6 && r1.p.paneHas && r1.p.hasHeal && r1.p.hasFee, '① 自动化左名单六项 + 右详情');
  need(r2.p && r2.p.tabs === 2 && r2.p.subs >= 3 && r2.p.hasSec, '② 背包两类 + 二级分类条');
  need(r3.p && r3.p.hasDuel && r3.p.hasChance, '③ 出征面板斗将预告');
  need(r4.p && r4.p.hasMin && r4.p.hasReal, '④ 烽火规则现实时间口径');
  console.log(okAll ? '\n实机判据通过' : '\n⚠ 有判据未过');
  await browser.close();
  process.exit(okAll ? 0 : 1);
})().catch(function (e) { console.error('异常：', e && e.message); process.exit(1); });
