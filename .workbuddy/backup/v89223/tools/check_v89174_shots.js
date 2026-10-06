/* v89.174 体检：① 两图像素基线；② 弹窗**无滚动条**复量（官府「在建队列」灌满 3 条 —— 铁律：弹窗内不许滚动条）
   运行：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/asset/check_v89174_shots.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), PNG = require('pngjs').PNG;
var pw = require('playwright-core');
var S = 'E:/Deepseekdb/.workbuddy/shots/';
var PASS = 0, FAIL = 0;
function chk(n, ok, ex) { if (ok) { PASS++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); } }
function load(f) { return PNG.sync.read(fs.readFileSync(S + f)); }
function st(p) {
  var n = p.width * p.height, sum = 0, bright = 0, gold = 0;
  for (var i = 0; i < p.data.length; i += 4) {
    var r = p.data[i], g = p.data[i + 1], b = p.data[i + 2];
    var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += L; if (L > 110) bright++;
    if (r > 180 && g > 150 && b < 120 && r - b > 70) gold++;
  }
  var rows = [], cur = null, need = Math.max(3, Math.round(p.width * 0.004));
  for (var y = 0; y < p.height; y++) {
    var c = 0;
    for (var x = 0; x < p.width; x++) { var j = (p.width * y + x) << 2; if (0.2126 * p.data[j] + 0.7152 * p.data[j + 1] + 0.0722 * p.data[j + 2] > 110) c++; }
    if (c >= need) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; } else if (cur) { rows.push(cur); cur = null; }
  }
  if (cur) rows.push(cur);
  return { w: p.width, h: p.height, mean: sum / n, bright: bright / n, gold: gold, rows: rows.length };
}

var A = st(load('v89174-queue.png')), B = st(load('v89174-swap.png'));
console.log('  queue ' + A.w + 'x' + A.h + ' 均亮=' + A.mean.toFixed(1) + ' 亮=' + (A.bright * 100).toFixed(2) + '% 金=' + A.gold + ' 行组=' + A.rows);
console.log('  swap  ' + B.w + 'x' + B.h + ' 均亮=' + B.mean.toFixed(1) + ' 亮=' + (B.bright * 100).toFixed(2) + '% 金=' + B.gold + ' 行组=' + B.rows);
chk('两图非空（面板真渲染）', A.w >= 480 && B.w >= 480 && A.h >= 400 && B.h >= 400);
chk('两图多行渲染（行组 ≥ 6）', A.rows >= 6 && B.rows >= 6);
chk('暗主题基线（均亮 35~75）', [A, B].every(function (s) { return s.mean > 35 && s.mean < 75; }));

(async function () {
  var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1680, height: 1120 } });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
  var info = await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '量174', cityName: '许都', region: '碎垣', mapSeed: 20260976 });
    G.ui.enterGame(); G.ui.closeAllModals();
    G.ui.setView('city');
    G.state.settings.timeScale = 1;
    var city = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(city)[k] = 1e8; });
    var empties = [], gIdx = -1;
    city.cells.forEach(function (cc, i) {
      if (!cc.build && !cc.pending && !cc.official) empties.push(i);
      if (gIdx < 0 && cc.build && cc.build.id === 'guanfu') gIdx = i;
    });
    /* 灌满 3 条在建（buildSlots 基础 3）：民房×2 + 学院（BUILD_ORDER 合法 id） */
    var okN = 0, ids = ['minfang', 'minfang', 'shuyuan'];
    var tried = [];
    for (var i = 0; i < empties.length && okN < 3; i++) {
      var bid = ids[okN];
      var r = G.buildAt(city.id, empties[i], bid);
      tried.push(bid + ':' + (r.ok ? 'ok' : r.msg));
      if (r.ok) okN++;
    }
    G.state.queues.build.forEach(function (q) { q.totalTime = 9999; q.elapsed = 0; });
    return { okN: okN, gIdx: gIdx, tried: tried.join(' | ') };
  });
  console.log('  量局：在建 ' + info.okN + ' 条 · 官府格 ' + info.gIdx + ' · [' + info.tried + ']');
  await p.evaluate(function (ii) { window.GAME.ui.openBuildModal(ii.gIdx); }, info);
  await p.waitForTimeout(500);
  var m = await p.evaluate(function () {
    var el = document.querySelector('#modal-root .inner-panel') || document.querySelector('#modal-root .modal');
    var root = document.querySelector('#modal-root');
    var sc = null;
    root.querySelectorAll('.inner-panel, .modal-scroll').forEach(function (x) {
      if (x.scrollHeight > x.clientHeight + 1) sc = x;
    });
    return {
      h: el ? Math.round(el.getBoundingClientRect().height) : 0,
      scrollOver: !!sc,
      sh: sc ? sc.scrollHeight : 0, ch: sc ? sc.clientHeight : 0,
      txt: root.textContent.indexOf('在建队列') >= 0,
    };
  });
  chk('★ 官府弹窗（3 条在建）**无滚动条**（弹窗内滚动是老板明令禁止）',
    m.txt && !m.scrollOver, '高=' + m.h + (m.scrollOver ? (' 溢 ' + m.sh + '>' + m.ch) : ''));
  await p.screenshot({ path: S + 'v89174-queue3.png', fullPage: false });
  console.log('  （截图 v89174-queue3.png · 高 ' + m.h + '）');
  await b.close();
  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
