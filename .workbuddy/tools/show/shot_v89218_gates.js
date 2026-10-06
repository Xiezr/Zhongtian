/* v89.217/v89.218 实机验收：
   ① 创建界面 13 州 chip = 新架空名（无旧名残留）
   ② 顶栏 12 页签（史册 / 故事集退役 · 图标全绘）· 无 tab-badge-story
   ③ 开局落位（region=盐岸）→ 城池面板 / 侧栏显示新州名与新域名
   ④ 地图视图出图（缩略图与新名标注）
   ⑤ 零残留：无 #story-fx / 无 GAME.SG / 无 storyHTML
   ⑥ 键盘：Shift+1 → 公文视图（续号收窄后仍通）
   图：v89218-create / v89218-nav / v89218-map / v89218-city */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + '  [' + (extra || '') + ']'); }
}
(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  var errs = [];
  p.on('pageerror', function (e) { errs.push(String(e).slice(0, 120)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await sleep(500);

  /* ══ ① 创建界面：13 chip 全为新名（v89.221：data-v **与可见文本**都验 ——
     当年只验 dataset.v，label 漏了两轮） ══ */
  var r1 = await p.evaluate(function () {
    var chips = Array.prototype.slice.call(
      document.querySelectorAll('#screen-create [data-target="create-region"]'));
    return chips.map(function (el) { return { v: el.dataset.v, t: (el.textContent || '').trim() }; });
  });
  var vals = r1.map(function (x) { return x.v; });
  var labels = r1.map(function (x) { return x.t; });
  var NEW13 = ['烬环', '霜脊', '沉陆', '泽心', '枯河', '黑岭', '雾谷', '灰野', '藤林', '潮湾', '盐岸', '碎垣', '风碛'];
  var OLD13 = ['司隶', '幽州', '徐州', '荆州', '兖州', '并州', '益州', '冀州', '交州', '扬州', '青州', '豫州', '凉州'];
  chk('①a 创建界面 14 枚 chip（随机 + 13 州）', r1.length === 14, r1.length + ' 枚');
  chk('①b 13 州全为架空新名（data-v）', NEW13.every(function (n) { return vals.indexOf(n) >= 0; }), vals.join(','));
  chk('①c 旧名零残留', OLD13.every(function (n) { return vals.indexOf(n) < 0 && labels.indexOf(n) < 0; }));
  chk('①d 可见文本 = 新名（v89.221 补测：label 与 data-v 同源）',
    NEW13.every(function (n) { return labels.indexOf(n) >= 0; }), labels.join(','));
  await p.screenshot({ path: E + 'v89218-create.png' });

  /* ══ ② 顶栏页签 ══ */
  var r2 = await p.evaluate(function () {
    /* 顶栏图标是进游戏时一次性绘制（ui.paintNav 有 _navPainted 守卫）—— 先补绘再核。 */
    if (window.GAME.ui.paintNav) window.GAME.ui.paintNav();
    var tabs = Array.prototype.slice.call(document.querySelectorAll('#topnav .tab[data-view]'));
    return {
      views: tabs.map(function (t) { return t.dataset.view; }),
      painted: tabs.every(function (t) { var i = t.querySelector('i.ti'); return !!(i && i.innerHTML && i.innerHTML.length > 20); }),
      badge: !!document.querySelector('#tab-badge-story'),
      sfx: !!document.getElementById('story-fx'),
      navHtml: document.getElementById('topnav').textContent.replace(/\s+/g, ''),
    };
  });
  chk('②a 页签 12 个（史册/故事集已退役）', r2.views.length === 12, r2.views.join(','));
  chk('②b 无 story / stories 页签', r2.views.indexOf('story') < 0 && r2.views.indexOf('stories') < 0);
  chk('②c 图标全绘（每个页签 <i> 均已填 SVG）', r2.painted);
  chk('②d 无 tab-badge-story · 无 #story-fx', !r2.badge && !r2.sfx);
  chk('②e 顶栏文本无「史册 / 故事集」', r2.navHtml.indexOf('史册') < 0 && r2.navHtml.indexOf('故事集') < 0, r2.navHtml);

  /* ══ ③ 开局（region=盐岸）→ 新州名 / 新域名 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验名', cityName: '落霞', region: '盐岸', mapSeed: 20261018 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.renderSide();
    G.ui.setView('city'); G.ui.renderView('city');
  });
  await sleep(800);
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    var cap = null;
    (G.DATA.NPC_CITIES || []).forEach(function (x) { if (x.id === 'cap') cap = x; });
    var sg = typeof G.SG;                       /* 应为 undefined */
    var stFn = typeof G.ui.storyHTML;
    return {
      cityName: c.name, cityState: c.state,
      capital: cap ? cap.name + '@' + cap.state : '?',
      fullName: G.cityFullName(cap),
      sg: String(sg), stFn: String(stFn),
      side: (document.querySelector('.auth-side') || {}).textContent || '',
    };
  });
  chk('③a 出生城标的州 = 盐岸（开局落位随新名走）', r3.cityState === '盐岸', r3.cityState);
  chk('③b 旧都 = 灰烬城@烬环 · 全称 ' + r3.fullName, r3.capital === '灰烬城@烬环');
  chk('③c GAME.SG / ui.storyHTML 均 undefined', r3.sg === 'undefined' && r3.stFn === 'undefined', r3.sg + '/' + r3.stFn);
  await p.screenshot({ path: E + 'v89218-nav.png' });

  /* ══ ④ 地图视图（新名标注）══ */
  await p.evaluate(function () {
    var G = window.GAME;
    if (!G.state.map.grid) G.map.generate();
    G.ui.setView('map'); G.ui.renderView('map');
    if (G.ui.renderMapCanvas) G.ui.renderMapCanvas();
    if (G.ui.fitMini) { try { G.ui.fitMini(); } catch (e) {} }
  });
  await sleep(900);
  await p.screenshot({ path: E + 'v89218-map.png' });

  /* ══ ⑤ 键盘 Shift+1 → 公文（续号收窄）══ */
  await p.evaluate(function () { document.body.focus(); });
  await p.keyboard.down('Shift'); await p.keyboard.press('Digit1'); await p.keyboard.up('Shift');
  await sleep(300);
  var r5 = await p.evaluate(function () { return window.GAME.ui.view; });
  chk('⑤ Shift+1 → 公文（reports）', r5 === 'reports', r5);

  /* ══ ⑥ 城池面板（含州名拼接）出图 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.setView('city'); G.ui.renderView('city'); G.ui.renderSide();
  });
  await sleep(600);
  await p.screenshot({ path: E + 'v89218-city.png' });

  chk('⑥ 控制台零 pageerror', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
