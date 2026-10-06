/* v89.209 实机验收：存档缺陷链修复（真浏览器 + 真 UI 链路）
   ------------------------------------------------------------
   ① 坏档「粘贴导入」→ UI 拒绝（toast 报明原因 · 真点按钮）
   ② 真档「粘贴导入」→ 成功 + 落 s1 槽 + 面板刷新（不误伤合法档）
   ③ 老版残留坏槽（手写 localStorage）→ 「读取」被拒 + 内存无半迁移
      → 随后「新游戏」仍可开（缺陷 3 连锁解开 · 玩家真实路径）
   ------------------------------------------------------------ */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var E = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

(async function () {
  var b = await pw.chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  var p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('[pageerror] ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA', null, { timeout: 30000 });

  /* 起局 + 清手动槽（此 origin 可能有历史残留） + 开存档面板 + 展开粘贴框 */
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: 'v209', cityName: '许都', region: '碎垣', mapSeed: 20261009 });
    if (!G.state.map.grid) G.map.generate();
    G.state.world.weather = 'clear';
    G.ui.enterGame();
    G.ui.closeAllModals();
    ['s1', 's2', 's3'].forEach(function (id) { G.dropSlot(id); });
    window.__t209 = {
      gens: G.state.generals.length,
      cities: G.state.cities.length,
      col: G.state.cities[0].col,
      ruler: G.state.ruler && G.state.ruler.name,
    };
    G.ui.openSaveManager();
  });
  await sleep(400);
  await p.evaluate(function () {
    var t = document.querySelector('#modal-root [data-action="save-import-toggle"]');
    if (t) t.click();
  });
  await sleep(400);
  var w0 = await p.evaluate(function () {
    return {
      ta: !!document.querySelector('#sv-paste'),
      btn: !!document.querySelector('#modal-root [data-action="save-import-text"]'),
    };
  });
  chk('⓪ 存档面板 + 粘贴框真渲染（textarea=' + w0.ta + ' · 导入键=' + w0.btn + '）', w0.ta && w0.btn);

  /* ══ ① 坏档粘贴导入 → UI 拒绝 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = JSON.parse(G.savePayload());
    st.cities = [{}];                               /* 畸形：空壳城池 */
    var pack = { _fmt: G.SAVE_FMT, _ver: 3, state: st };
    pack._check = G.checksum(JSON.stringify(st));   /* 校验和正确 → 旧口径会放行 */
    var ta = document.querySelector('#sv-paste');
    if (ta) ta.value = JSON.stringify(pack);
    var btn = document.querySelector('#modal-root [data-action="save-import-text"]');
    if (btn) btn.click();
  });
  await sleep(350);
  var w1 = await p.evaluate(function () {
    var el = document.querySelector('#toast');
    return { txt: el ? el.textContent : '', rows: document.querySelectorAll('#modal-root .sv-row').length };
  });
  chk('① 坏档粘贴导入 → UI 拒绝（toast「' + (w1.txt || '').slice(0, 34) + '」）',
    w1.txt.indexOf('存档内容损坏') >= 0 || w1.txt.indexOf('不完整') >= 0, JSON.stringify(w1));
  await p.screenshot({ path: E + 'v89209-import-reject.png' });

  /* ══ ② 真档粘贴导入 → 成功 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = JSON.parse(G.savePayload());
    var pack = { _fmt: G.SAVE_FMT, _ver: 3, state: st };
    pack._check = G.checksum(JSON.stringify(st));
    var ta = document.querySelector('#sv-paste');
    if (ta) ta.value = JSON.stringify(pack);
    var btn = document.querySelector('#modal-root [data-action="save-import-text"]');
    if (btn) btn.click();
  });
  await sleep(400);
  var w2 = await p.evaluate(function () {
    var G = window.GAME;
    var el = document.querySelector('#toast');
    var rows = Array.prototype.slice.call(document.querySelectorAll('#modal-root .sv-row'));
    var s1HasLoad = !!document.querySelector('#modal-root [data-action="save-slot-load"][data-slot="s1"]');
    return {
      txt: el ? el.textContent : '',
      meta: !!G.slotMetaOf('s1'),
      s1HasLoad: s1HasLoad,
      rows: rows.length,
    };
  });
  chk('② 真档导入 → 成功 + 落 s1 + 面板出现「读取」键', w2.meta && w2.s1HasLoad && w2.rows === 7, JSON.stringify(w2));
  await p.screenshot({ path: E + 'v89209-import-ok.png' });

  /* ══ ③ 老版残留坏槽 → 「读取」被拒（不崩 · 无半迁移）→ 「新游戏」可开 ══ */
  await p.evaluate(function () {
    var G = window.GAME;
    var st = JSON.parse(G.savePayload());
    st.generals = 'oops';                            /* 模拟旧版导入残留的坏档 */
    var raw = JSON.stringify(st);
    localStorage.setItem(G.slotOf('s1').key, raw);
    G._setSlotIndex('s1', st, raw.length);           /* 索引在册 → 行上出现「读取」键 */
    G.ui.openSaveManager();
  });
  await sleep(400);
  var wAsk = await p.evaluate(function () {
    var b = document.querySelector('#modal-root [data-action="save-slot-load"][data-slot="s1"]');
    if (b) b.click();
    return { clicked: !!b };
  });
  await sleep(400);
  var wAsk2 = await p.evaluate(function () {
    /* 读取是两步链：先弹确认窗（save-slot-load-ask）→ 再点「确定读取」 */
    var d = document.querySelector('#modal-root [data-action="save-slot-load-do"]');
    if (d) d.click();
    return { confirm: !!d };
  });
  chk('③⓪ 读取两步链到位（行键=' + wAsk.clicked + ' · 确认窗=' + wAsk2.confirm + '）',
    wAsk.clicked && wAsk2.confirm);
  await sleep(400);
  var w3 = await p.evaluate(function () {
    var G = window.GAME;
    var el = document.querySelector('#toast');
    var t = window.__t209;
    return {
      txt: el ? el.textContent : '',
      gensArr: Array.isArray(G.state.generals),
      gensLen: G.state.generals && G.state.generals.length,
      citiesLen: G.state.cities && G.state.cities.length,
      col: (G.state.cities[0] || {}).col,
      ruler: G.state.ruler && G.state.ruler.name,
      wasGens: t.gens, wasCities: t.cities, wasCol: t.col, wasRuler: t.ruler,
    };
  });
  chk('③a 坏槽「读取」→ 被拒（toast 末「' + (w3.txt || '').slice(-36) + '」）+ 内存零半迁移',
    w3.txt.indexOf('读取失败') >= 0 && w3.gensArr === true
    && w3.gensLen === w3.wasGens && w3.citiesLen === w3.wasCities
    && w3.col === w3.wasCol && w3.ruler === w3.wasRuler, JSON.stringify(w3));
  await p.screenshot({ path: E + 'v89209-load-reject.png' });

  var w4 = await p.evaluate(function () {
    var G = window.GAME;
    var err = null;
    try { G.newGame({ name: 'v209b', cityName: '许都', region: '碎垣', mapSeed: 20261010 }); }
    catch (e) { err = String(e && e.message || e); }
    return { err: err, name: G.state && G.state.ruler && G.state.ruler.name };
  });
  chk('③b 随后「新游戏」正常可开（缺陷 3 连锁解开 · 实测 ' + w4.name + '）',
    w4.err === null && w4.name === 'v209b', w4.err || '');

  await b.close();
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})().catch(function (e) { console.log('崩：' + (e && e.stack || e)); process.exit(1); });
