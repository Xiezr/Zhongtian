'use strict';
/* v89.233 实机验证：① 货币「旧币」显示（商城/侧栏）② 任务页新文风（86 条）
   ③ 垂钓/行猎结算顺滑（40 天种子抽样 · jianghuRoll 直调）
   跑法：node .workbuddy/tools/show/shot_v89233_four.js
   产物：.workbuddy/shots/v89233-tasks.png · v89233-shop.png */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var SHOTS = R + '.workbuddy/shots/';
var CHROME = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var pass = 0, fail = 0;
function chk(name, ok, extra) {
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (extra ? '  [' + extra + ']' : ''));
  ok ? pass++ : fail++;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var browser = await pw.chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });
  var page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await sleep(900);
  await page.evaluate(function () {
    var G = window.GAME;
    if (!G.state) { G.newGame({ name: '验四批', cityName: '灰岗' }); G.ui.enterGame(); }
    try { G.ui.closeAllModals(); } catch (e) { }
  });
  await sleep(500);
  await page.evaluate(function () { try { window.GAME.ui.closeAllModals(); } catch (e) { } });

  console.log('===== ① 货币「旧币」显示 =====');
  var m1 = await page.evaluate(function () {
    var G = window.GAME;
    G.ui.openShop();
    G.ui.renderView('shop');
    var vc = document.querySelector('#view-container');
    var txt = vc ? vc.textContent : '';
    return { hasCoin: txt.indexOf('旧币') >= 0, len: txt.length, snip: txt.slice(0, 100) };
  }).catch(function (e) { return { err: String(e) }; });
  chk('① 商城主视图含「旧币」（购买按钮/单价）', m1 && m1.hasCoin === true, JSON.stringify(m1).slice(0, 150));
  await sleep(300);
  await page.screenshot({ path: SHOTS + 'v89233-shop.png' });

  console.log('===== ② 任务页新文风 =====');
  var m2 = await page.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('tasks');
    G.ui.renderView('tasks');
    var vc = document.querySelector('#view-container');
    var txt = vc ? vc.textContent : '';
    return {
      hasA: txt.indexOf('残垣立命') >= 0, hasB: txt.indexOf('人烟渐聚') >= 0,
      oldLeft: txt.indexOf('立锥之地') >= 0 || txt.indexOf('民居渐稠') >= 0,
      len: txt.length
    };
  }).catch(function (e) { return { err: String(e) }; });
  chk('② 任务页含新标题（残垣立命 / 人烟渐聚）· 旧标题零残留', m2 && m2.hasA && m2.hasB && !m2.oldLeft, JSON.stringify(m2).slice(0, 140));
  await sleep(200);
  await page.screenshot({ path: SHOTS + 'v89233-tasks.png' });

  console.log('===== ③ 垂钓/行猎结算顺滑（40 天种子抽样）=====');
  var m3 = await page.evaluate(function () {
    var G = window.GAME;
    var st = G.state;
    if (!st.map.grid) G.map.generate();
    function findT(ter, n) {
      for (var y = 0; y < 60; y++) for (var x = 0; x < 60; x++) {
        var tl = G.map.tile(x, y);
        if (tl && tl.terrain === ter) {
          n.push({ x: x, y: y });
          if (n.length >= 4) return;
        }
      }
    }
    var lks = [], fss = [];
    findT('lake', lks); findT('forest', fss);
    if (!lks.length || !fss.length) return { err: '未找到湖/林格', lk: lks.length, fs: fss.length };
    var gen = G.lordGeneralOf();
    G.setStaNow(gen, 500); gen.energy = 500;
    st.jianghu = {};
    var seen = {}, oldHit = [];
    function sample(actId, terr, spots) {
      var chk = {
        act: G.DATA.LING_ACT[actId], gen: gen,
        x: spots[0].x, y: spots[0].y, day: 1, lv: 1, actId: actId
      };
      for (var d = 1; d <= 40; d++) {
        chk.day = d;
        var r = null;
        try { r = G.jianghuRoll(chk, { reward: 1 }); } catch (e) { return 'ERR:' + e.message; }
        if (r && r.name) seen[r.name] = (seen[r.name] || 0) + 1;
      }
      return null;
    }
    var e1 = sample('lake_scene', 'lake', lks);
    var e2 = sample('forest_scene', 'forest', fss);
    if (e1 || e2) return { err: e1 || e2 };
    var names = Object.keys(seen);
    return {
      names: names,
      lkOK: names.some(function (n) { return n.indexOf('活水同汲') >= 0 || n.indexOf('几瓢活水') >= 0; }),
      fsOK: names.some(function (n) { return n.indexOf('寻得山泉') >= 0; }),
      oldHit: names.filter(function (n) { return n.indexOf('得金') >= 0 || n === '肥鱼入篓' || n === '杂鱼数尾' || n === '猎得野味'; })
    };
  }).catch(function (e) { return { err: String(e) }; });
  chk('③ 垂钓出「活水」叙述 · 行猎出「山泉」叙述 · 旧叙述零残留',
    m3 && m3.lkOK && m3.fsOK && (!m3.oldHit || m3.oldHit.length === 0),
    m3 ? (m3.err || JSON.stringify(m3.names)) : 'null');

  await browser.close();
  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH', e); process.exit(2); });
