/* ============================================================
 * probe_v89156a_stack.js  复现「附属野地放弃后，关闭键闪烁关不掉」的层级栈 bug
 *
 * 病根假设（v89.156 探针取证）：
 *   `ui.openWilds` 的标题含动态数字「🏕️ 附属野地（N/M）」——
 *   放弃一片后 N 变化 → live 每秒重绘走 openModal 时被「标题不同 = 进下级」
 *   判定**误压栈** → 点关闭只弹一层（还弹出**旧快照**，含已删的行）→
 *   「闪烁一下维持在界面中、被删的行又出现、要点几下才关掉」。
 *
 * 本探针用真 DOM（jsdom）复现：
 *   ① 打开附属野地 → ② 放弃流程（ask → 执行 → 弹栈）→
 *   ③ 手动 liveModalTick（模拟下一秒）→ 读 _modalStack 长度（bug = 1，正解 = 0）
 *   ④ 点关闭 → 读 #modal-root 是否真空（bug = 面板还挂着，正解 = 空）
 *
 * 运行：
 *   NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node .workbuddy/tools/probe/probe_v89156a_stack.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { JSDOM } = require('jsdom');

const DIR = 'E:/Deepseekdb/';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let PASS = 0, FAIL = 0;
function ck(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCtx() {
  const noop = () => {};
  return {
    canvas: { width: 800, height: 600 },
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData: noop, drawImage: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, closePath: noop, arc: noop, ellipse: noop, fill: noop, stroke: noop, clip: noop,
    moveTo: noop, lineTo: noop, rect: noop, save: noop, restore: noop, translate: noop,
    scale: noop, rotate: noop, setTransform: noop, measureText: () => ({ width: 10 }),
    quadraticCurveTo: noop, bezierCurveTo: noop, roundRect: noop, createPattern: () => null,
    fillText: noop, strokeText: noop, setLineDash: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, imageSmoothingEnabled: true,
  };
}

const ROOT = path.resolve(DIR);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.resolve(ROOT, '.' + p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(0, '127.0.0.1', () => {
  const URL = 'http://127.0.0.1:' + server.address().port + '/index.html';
  JSDOM.fromURL(URL, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    },
  }).then((dom) => {
    const loaded = new Promise((resolve) => {
      dom.window.addEventListener('load', () => setTimeout(resolve, 300));
      setTimeout(resolve, 8000);
    });
    return loaded.then(() => run(dom, URL));
  }).catch((e) => {
    console.log('💥 探针异常：' + (e && e.stack || e));
    process.exit(1);
  });
});

async function run(dom, URL) {
  const { window } = dom;
  const { document } = window;
  const G = window.GAME;
  const ui = G.ui;
  console.log('静态服务：' + URL + ' · GAME/UI 就绪 = ' + !!G + '/' + !!ui);

  /* 主循环每秒自动调 ui.liveModalTick —— 会让时序不确定 → 替换成 noop，
     全部改手动控制（_realLive）。结束前还原（本探针不还原也行，进程退出）。 */
  const _realLive = ui.liveModalTick;
  ui.liveModalTick = function () { };

  /* ---------- 造局：新游戏 + 2 片野地 ---------- */
  G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
  ui.enterGame();
  ui.closeAllModals();
  await sleep(350);
  const c = G.currentCity();
  ui._cityId = c.id;
  const st = G.state;
  st.wilds = st.wilds || [];
  const X1 = c.x + 6, Y1 = c.y + 6, X2 = c.x + 7, Y2 = c.y + 7;
  st.wilds = st.wilds.filter(function (z) { return !(z.x === X1 && z.y === Y1) && !(z.x === X2 && z.y === Y2); });
  st.wilds.push({ x: X1, y: Y1, type: 'lake', level: 3, day: 0, startDay: 0 });
  st.wilds.push({ x: X2, y: Y2, type: 'hill', level: 4, day: 0, startDay: 0 });

  console.log('\n===== ① 打开附属野地面板 =====');
  ui.openWilds();
  await sleep(120);
  const t0 = ui._modalTitle;
  ck('面板已开（title 含「附属野地（2/」）', !!t0 && t0.indexOf('附属野地') >= 0 && t0.indexOf('2/') >= 0, 'title=' + t0);
  ck('栈为空', (ui._modalStack || []).length === 0);

  console.log('\n===== ② 放弃流程：ask → 执行 → 弹栈 =====');
  ui.openAbandonWildAsk(X1, Y1);
  await sleep(80);
  ck('确认窗已开（title 含「放弃」）', (ui._modalTitle || '').indexOf('放弃') >= 0, 'title=' + ui._modalTitle);
  ck('压栈 1 层（野地快照）', (ui._modalStack || []).length === 1);
  const wa = G.doAbandonWild(X1, Y1);
  ck('放弃执行成功', !!wa && st.wilds.length === 1, wa && wa.msg);
  ui.closeModal();            /* 相当于 main.js case 里的 ui.closeModal() */
  await sleep(80);
  ck('弹栈回野地（栈 0）', (ui._modalStack || []).length === 0);
  const backTitle = ui._modalTitle || '';
  console.log('    弹栈后 title = ' + backTitle);
  /* 旧快照里含**已删**的那片野地（X1,Y1）—— 这就是"被删除的那一行又出现"；
     正解（v89.156）：弹栈后立即 live 重绘 → 直接显示新数据（不含已删行）。 */
  const root = document.getElementById('modal-root');
  const htmlAfterPop = root ? root.innerHTML : '';
  ck('【弹栈即新数据】弹栈后不含已删的 ' + X1 + ',' + Y1 + '（正解；bug = 旧快照闪现）',
    htmlAfterPop.indexOf(X1 + ',' + Y1) < 0,
    '含已删=' + (htmlAfterPop.indexOf(X1 + ',' + Y1) >= 0));

  console.log('\n===== ③ live 重绘（模拟下一秒 · 标题数字变化） =====');
  _realLive.call(ui);
  await sleep(80);
  const stk1 = (ui._modalStack || []).length;
  const t1 = ui._modalTitle || '';
  console.log('    live 后 title = ' + t1 + ' · 栈长 = ' + stk1);
  ck('【核心判据】live 重绘不得压栈（栈长应为 0）', stk1 === 0, '栈长=' + stk1);
  const htmlLive = root ? root.innerHTML : '';
  ck('live 后已删行消失（重绘到新数据）', htmlLive.indexOf(X1 + ',' + Y1) < 0);

  console.log('\n===== ④ 点「关闭」→ 应真关 =====');
  ui.closeModal();
  await sleep(80);
  const htmlClosed = root ? root.innerHTML : 'x';
  const stillOpen = htmlClosed.indexOf('inner-panel') >= 0;
  ck('【核心判据】关闭 = 真关（modal-root 清空）', !stillOpen,
    '仍挂着=' + stillOpen + ' · 长度=' + (htmlClosed || '').length);
  ck('关闭后栈为空', (ui._modalStack || []).length === 0);

  console.log('\n===== ⑤ 对照：同标题不误压（普通重绘） =====');
  ui.closeAllModals();          /* 清干净再对照（④ 结束时还挂着旧快照层） */
  await sleep(60);
  ui.openWilds();
  await sleep(80);
  ui.openWilds();               /* 同标题重绘 —— 不压栈 */
  await sleep(80);
  ck('同标题重绘不压栈', (ui._modalStack || []).length === 0);
  ui.closeModal();
  await sleep(80);
  ck('普通关闭一次即真关', (root.innerHTML || 'x').indexOf('inner-panel') < 0);

  console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
}
