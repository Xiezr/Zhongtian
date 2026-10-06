/* v89.219 实机验收：机构词（缩略图/岁贡/城档）+ 悬停白值=原始值 + 整套键
   图：v89219-hover / v89219-forge / v89219-minimap
   判据（真机）：① 悬停浮层白字=原始值、金=增量；② 百炼底栏有「整套 +1」键；
   ③ 缩略图的区/镇下拉与图例换新词。 */
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
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验收', cityName: '灰烬城', region: '烬环', mapSeed: 20261019 });
    if (!G.state.map.grid) G.map.generate();
    G.ui.enterGame(); G.ui.closeAllModals();
    var c = G.currentCity();
    var idx = c.cells.findIndex(function (x) { return !x.build && !x.official; });
    if (idx >= 0) c.cells[idx].build = { id: 'tiejiangpu', lvl: 3 };
    G.state.res.gold = 1e9; G.state.res.iron = 1e9; G.state.res.stone = 1e9;
    /* 造三件陨锋套（+10 一件用于悬停验算 +1 两件） */
    var ids = Object.keys(G.DATA.EQUIP).filter(function (k) {
      return G.DATA.EQUIP[k].set === 'yitian' && !G.DATA.EQUIP[k].ling; });
    G.__yt = G.addEquip(ids[0], 10);
    G.addEquip(ids[1], 0);
    G.addEquip(ids[2], 0);
  });
  await sleep(600);

  /* ── ① 悬停浮层：白=原始值 / 金=增量（真 hover） ── */
  await p.evaluate(function () { window.GAME.ui.openBag('equip'); });
  await sleep(500);
  var tgt = p.locator('#view-container .bag-cell', { hasText: '陨锋战盔 +10' }).first();
  if (!(await tgt.count())) tgt = p.locator('#view-container .bag-cell').first();
  await tgt.hover();
  await sleep(500);
  var tip = await p.evaluate(function () {
    var el = document.getElementById('tip-layer');
    return { on: el.classList.contains('on'), text: (el.textContent || '').replace(/\s+/g, ' ').slice(0, 260) };
  });
  console.log('  浮层文本：' + tip.text);
  chk('① 悬停浮层已弹出', tip.on, 'on=' + tip.on);
  chk('①a 白字画**原始值**：浮层含 体力 600（表值）', tip.text.indexOf('600') >= 0, tip.text.slice(0, 80));
  chk('①b 金/青增量在册：浮层含 +480（= 600 × 80%）', tip.text.indexOf('+480') >= 0, '');
  chk('①c 脚注写"对原始值线性叠加 · 本件共 +80%"',
    tip.text.indexOf('对原始值线性叠加') >= 0 && tip.text.indexOf('本件共 +80%') >= 0, '');
  var tipRect = await p.evaluate(function () {
    var r = document.getElementById('tip-layer').getBoundingClientRect();
    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;
    return { x: Math.max(0, Math.round(r.left) - 6), y: Math.max(0, Math.round(r.top) - 6),
             width: Math.round(r.width) + 12, height: Math.round(r.height) + 12 };
  });
  await p.screenshot({ path: E + 'v89219-hover.png', clip: tipRect });
  await p.mouse.move(20, 20);
  await sleep(200);

  /* ── ② 百炼面板：整套键（长按提示 + 底键） ── */
  var forge = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var ids = Object.keys(G.DATA.EQUIP).filter(function (k) {
      return G.DATA.EQUIP[k].set === 'yitian' && !G.DATA.EQUIP[k].ling; });
    var inst = G.state.inventory.filter(function (x) { return x.id === ids[0]; })[0]
            || G.state.inventory.filter(function (x) { return x.id === ids[1]; })[0];
    G.ui._enhSel = G.ui.enhKeyOf(inst);
    G.ui.openEnhance();
    var setBtn = document.querySelector('[data-action="enhance-set"]');
    var oneBtn = document.querySelector('[data-action="enhance-item"]');
    return {
      set: !!setBtn, setText: setBtn ? setBtn.textContent.trim() : '',
      setTitle: setBtn ? (setBtn.getAttribute('title') || '') : '',
      one: !!oneBtn, oneText: oneBtn ? oneBtn.textContent.trim() : '',
      help: (function () { var chip = document.querySelector('.forge-filter .help-chip'); return chip ? (chip.getAttribute('data-tip') || '') : ''; })(),
    };
  });
  console.log('  整套键：' + forge.setText + ' ｜ title：' + forge.setTitle);
  chk('② 底栏出现「整套 +1」键', forge.set && forge.setText.indexOf('整套 +1') >= 0, forge.setText);
  chk('②a 整套键 title 写明件数与总价（悬停可见）',
    forge.setTitle.indexOf('已拥有') >= 0 && forge.setTitle.indexOf('共需') >= 0, forge.setTitle);
  chk('②b 单件键仍在（两者并存）', forge.one && forge.oneText.indexOf('强化') >= 0, forge.oneText);
  chk('②c 帮助文案写明"长按可连续强化"与整套键', forge.help.indexOf('长按可连续强化') >= 0
    && forge.help.indexOf('整套 +1') >= 0, forge.help.replace(/\s+/g, ' ').slice(0, 120));
  var mRect = await p.evaluate(function () {
    var r = document.querySelector('#modal-root .inner-panel').getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)),
             width: Math.round(r.width), height: Math.round(r.height) };
  });
  await p.screenshot({ path: E + 'v89219-forge.png', clip: mRect });

  /* ── ③ 缩略图（天下大势）：区/镇下拉 + 图例新词 ── */
  var mini = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    if (G.ui._miniFilter) G.ui._miniFilter = { level: '', state: '', jun: '' };
    G.ui.openMinimap();
    var body = (document.querySelector('#modal-root .inner-panel') || {}).textContent || '';
    return { text: body.replace(/\s+/g, ' ').slice(0, 400) };
  });
  console.log('  缩略图面板：' + mini.text.slice(0, 160));
  chk('③ 图例换成 区界/镇界/旧都/首府/重镇/聚落',
    mini.text.indexOf('区界') >= 0 && mini.text.indexOf('镇界') >= 0
    && mini.text.indexOf('旧都') >= 0 && mini.text.indexOf('首府') >= 0
    && mini.text.indexOf('重镇') >= 0 && mini.text.indexOf('聚落') >= 0, mini.text.slice(0, 120));
  var mr2 = await p.evaluate(function () {
    var r = document.querySelector('#modal-root .inner-panel').getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)),
             width: Math.round(r.width), height: Math.round(r.height) };
  });
  await p.screenshot({ path: E + 'v89219-minimap.png', clip: mr2 });

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
