'use strict';
/* v89.228 实机验证：黄金→旧币 · 人口→幸存者 · 装备名录换代（真浏览器）
   跑法：node .workbuddy/tools/show/shot_v89228_rename.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* 造局：新局 + 给君主装一件 cr_weapon_4（原名「神兵」） */
  await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '验228', cityName: '灰岗', region: '碎垣', mapSeed: 20261028 });
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    var c = st.cities[0]; G.ui._cityId = c.id;
    var g = G.lordGeneralOf();
    var eid = G.addEquip('cr_weapon_4', 0);
    G.systems.equipItem(g.id, eid);
    G.ui._genSel = g.id;
    G.ui.setView('generals'); G.ui.renderView('generals');
    return true;
  });
  await p.waitForTimeout(700);

  /* ① 数据层：RESOURCES + 装备名 */
  var d1 = await p.evaluate(function () {
    var G = window.GAME, gold = null, pop = null;
    (G.DATA.RESOURCES || []).forEach(function (r) { if (r.key === 'gold') gold = r; if (r.key === 'pop') pop = r; });
    return {
      gold: gold && gold.name, pop: pop && pop.name,
      weapon: G.DATA.EQUIP['cr_weapon_4'] && G.DATA.EQUIP['cr_weapon_4'].name,
      mount: G.DATA.EQUIP['cr_mount_4'] && G.DATA.EQUIP['cr_mount_4'].name,
    };
  });
  chk('RESOURCES：gold=旧币 · pop=幸存者', d1.gold === '旧币' && d1.pop === '幸存者', JSON.stringify(d1));
  chk('装备名录：cr_weapon_4=陨铁战刃 · cr_mount_4=战马', d1.weapon === '陨铁战刃' && d1.mount === '战马', d1.weapon + '/' + d1.mount);

  /* ② 出口层：costString / buildCostTip 报「旧币」 */
  var d2 = await p.evaluate(function () {
    var G = window.GAME;
    var cs = G.costString({ grain: 100, gold: 3000 });
    var tp = G.ui.buildCostTip({ grain: 100, gold: 3000, time: 3600 });
    return { cs: cs, tp: tp };
  });
  chk('costString 含「旧币 3,000」', d2.cs.indexOf('旧币 3,000') >= 0, d2.cs.slice(0, 60));
  chk('buildCostTip 含旧币 + 全境通用', d2.tp.indexOf('旧币') >= 0 && d2.tp.indexOf('全境通用') >= 0, d2.tp.slice(0, 80));

  /* ③ DOM 层：英雄面板武器槽显示「陨铁战刃」 */
  var d3 = await p.evaluate(function () {
    var vc = document.querySelector('#view-container');
    var slot = vc && vc.querySelector('.gen-pane .doll-slot[data-slot="weapon"]');
    return { txt: slot ? slot.textContent.trim() : '(no-slot)' };
  });
  chk('英雄面板武器槽显示「陨铁战刃」（换装后）', d3.txt.indexOf('陨铁战刃') >= 0, d3.txt.slice(0, 50));

  /* ④ 城面板：城属性行含「幸存者」不含「人口」 */
  var d4 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.renderCityAttrs(G.currentCity(), G.state);
    var h = document.querySelector('#city-attrs');
    return { txt: h ? h.textContent : '(no-attrs)' };
  });
  chk('城属性含「幸存者」不含「人口」', d4.txt.indexOf('幸存者') >= 0 && d4.txt.indexOf('人口') < 0, d4.txt.slice(0, 80));

  /* ⑤ 资源栏标签（含旧币）+ 全页残留扫描 */
  var d5 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city'); G.ui.renderView('city');
    var labels = [];
    document.querySelectorAll('#res-bar .lbl, .res-line .lbl').forEach(function (x) { labels.push(x.textContent.trim()); });
    var body = document.body.innerText || '';
    return { labels: labels, hasGold: body.indexOf('黄金') >= 0, hasPop: body.indexOf('人口') >= 0, peeks: body.slice(0, 0) };
  });
  chk('资源栏标签含「旧币」（真渲染）', d5.labels.indexOf('旧币') >= 0, d5.labels.join('/'));
  chk('全页文本零「黄金」零「人口」', !d5.hasGold && !d5.hasPop, 'gold=' + d5.hasGold + ' pop=' + d5.hasPop);

  /* ⑥ 像素体检 + 截图 */
  await p.screenshot({ path: '.workbuddy/shots/v89228-rename-full.png' });
  var shot = await p.$('#res-bar');
  if (shot) { await shot.screenshot({ path: '.workbuddy/shots/v89228-resbar.png' }); console.log('  截图: v89228-rename-full.png / v89228-resbar.png'); }
  else { console.log('  截图: v89228-rename-full.png'); }

  chk('运行期无页面错误', errs.length === 0, errs.slice(0, 2).join(' ; '));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
