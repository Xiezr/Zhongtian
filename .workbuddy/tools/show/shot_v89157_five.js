/* v89.157 实机：① 公文系统页（徽章+铺满）② 将领条单行 ③ 城墙门槛 ④ 逐回合弹窗 ⑤ 地块 4×3 */
const pw = require('playwright-core');
const EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const OUT = 'E:/Deepseekdb/.workbuddy/shots/';
let pass = 0, fail = 0;
function chk(name, ok, extra) {
  if (ok) { pass++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

(async function () {
  const b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on('pageerror', function (e) { console.log('PAGEERR: ' + String(e.message).slice(0, 160)); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  /* ---------- ① 公文系统页 ---------- */
  console.log('===== ① 公文系统页（徽章 + 铺满） =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
    G.ui.enterGame(); G.ui.closeAllModals();
    if (!G.state.map.grid) G.map.generate();
    var subs = ['war', 'task', 'era', 'weather', 'build', 'gather', 'staff', 'admin', 'trade', 'sys'];
    for (var i = 1; i <= 46; i++) {
      var sub = subs[i % subs.length];
      G.log('§量测消息 ' + i + '：这是一条用于量测行高与铺满的测试消息，中等长度文本内容。', 'sys', sub === 'war' ? undefined : sub);
    }
    G.ui._msgTag = 'all';
    G.ui.setView('reports');
    G.ui.renderView('reports');
  });
  await p.waitForTimeout(700);
  const r1 = await p.evaluate(function () {
    var G = window.GAME;
    function R(el) { var r = el.getBoundingClientRect(); return { t: r.top, b: r.bottom, h: r.height }; }
    var vc = document.getElementById('view-container');
    var lines = document.querySelectorAll('#msg-feed .bb-line');
    var last = lines.length ? R(lines[lines.length - 1]) : null;
    var tags = document.querySelectorAll('#msg-feed .ml-tag').length;
    var subLines = document.querySelectorAll('#msg-feed .bb-line.bb-sub').length;
    var subEl = document.querySelector('#doc-body .ui-sub');
    var subBottomGap = subEl ? +(R(vc).b - R(subEl).b).toFixed(1) : -1;
    var chips = document.querySelectorAll('.msg-channels .ch');
    var chipIcons = 0;
    Array.prototype.forEach.call(chips, function (c) { if (/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(c.textContent || '')) chipIcons++; });
    return { vcH: vc.clientHeight, subBottomGap: subBottomGap,
      lastBottom: last ? +last.b.toFixed(1) : -1, vcBottom: +R(vc).b.toFixed(1),
      gap: last ? +(R(vc).b - last.b).toFixed(1) : -1, lineCount: lines.length, tags: tags, subLines: subLines,
      chips: chips.length, chipIcons: chipIcons, scroll: vc.scrollHeight - vc.clientHeight, per: G.ui.docPerOf('sys') };
  });
  chk('系统页每条消息都带主题徽章 + 竖条（bb-sub）', r1.tags === r1.lineCount && r1.subLines === r1.lineCount,
    'lines=' + r1.lineCount + ' tags=' + r1.tags);
  chk('底部到边（底注贴底 ≤20px；旧版末行距底 127px）', r1.subBottomGap >= 0 && r1.subBottomGap <= 20,
    'sub-底距=' + r1.subBottomGap + 'px · 末行距底=' + r1.gap + 'px');
  chk('chips 带图标（' + r1.chipIcons + '/' + r1.chips + '）· 内容不被裁（滚动只涉底内边距 ≤14px）',
    r1.chipIcons >= r1.chips - 1 && r1.scroll <= 14, 'per=' + r1.per + ' scroll=' + r1.scroll);
  await p.locator('#view-container').screenshot({ path: OUT + 'v89157-doc-sys.png' });

  /* ---------- ② 将领状态条 ---------- */
  console.log('===== ② 将领页（体力/精力/忠诚 单行） =====');
  await p.evaluate(function () {
    var G = window.GAME;
    G.ui.closeAllModals();
    var g = (G.state.generals || [])[0];
    if (g) G.ui._genSel = g.id;
    G.ui.setView('generals');
    G.ui.renderView('generals');
  });
  await p.waitForTimeout(600);
  const r2 = await p.evaluate(function () {
    var G = window.GAME;
    function R(el) { var r = el.getBoundingClientRect(); return { h: r.height / 1, w: r.width, bw: 0 }; }
    var rows = [];
    Array.prototype.forEach.call(document.querySelectorAll('.gp-col-l .gd-line'), function (el) {
      var bar = el.querySelector('.gd-bar');
      rows.push({ txt: (el.textContent || '').slice(0, 8).replace(/\s+/g, ''), h: +R(el).h.toFixed(1),
        barW: bar ? +bar.getBoundingClientRect().width.toFixed(1) : -1 });
    });
    return rows;
  });
  var single = r2.filter(function (x) { return x.barW > 0; });
  var wrapped = single.filter(function (x) { return x.h > 30; });
  chk('体力/精力/忠诚三条均为单行（无折行）', single.length === 3 && wrapped.length === 0,
    single.map(function (x) { return x.txt + ':' + x.h + 'px'; }).join(' '));
  chk('进度条宽 106（CSS px · 含缩放后 ≈117）', single.every(function (x) { return x.barW > 100 && x.barW < 125; }),
    'barW=' + (single[0] ? single[0].barW : -1));
  await p.locator('.gen-split').screenshot({ path: OUT + 'v89157-gen-rows.png' });

  /* ---------- ③ 城墙门槛 ---------- */
  console.log('===== ③ 官府 · 城墙要求 =====');
  const r3 = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    G.ui._cityId = c.id;
    /* 官府抬到 11、无墙 → 面板应显示"升 Lv12 需城墙 ≥ Lv10（当前 Lv0 ✗）" */
    var gi = -1;
    c.cells.forEach(function (x, i) { if (gi < 0 && x.build && x.build.id === 'guanfu') gi = i; });
    c.cells[gi].build.lvl = 11;
    G.wallSlotOf(c).build = null;
    G.ui.closeAllModals();
    G.ui.openBuildModal(gi);
    var root = document.getElementById('modal-root');
    var txt = root.textContent || '';
    var m = txt.match(/城墙要求[^）]*（[^）]*）/);
    return { gi: gi, row: m ? m[0].slice(0, 80) : (txt.indexOf('城墙要求') >= 0 ? '有行无文' : '无行'),
      hasRow: txt.indexOf('城墙要求') >= 0, txt: m ? m[0] : '' };
  });
  chk('官府面板出「城墙要求」行（含所需/当前/✗）', r3.hasRow && r3.txt.indexOf('需城墙') >= 0 && r3.txt.indexOf('✗') >= 0, r3.txt);
  { /* live 面板每秒重绘 → 元素截图会 detached；用整页截图 + clip（一次性取坐标） */
    const box = await p.evaluate(function () {
      var el = document.querySelector('#modal-root .inner-panel');
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    });
    await p.screenshot({ path: OUT + 'v89157-wall-req.png', clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
  }
  /* 真点升级 → 被拦（toast 指向城墙）；给墙 → 放行 */
  const r3b = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
    G.state.queues.build = [];
    c.cells.forEach(function (x) { x.pending = null; });
    var el = document.querySelector('#modal-root [data-action="confirm-upgrade"]');
    if (el) el.click();
    var toast0 = (document.getElementById('toast') || {}).textContent || '';
    var queued0 = (G.state.queues.build || []).length;
    G.wallSlotOf(c).build = { id: 'chengqiang', lvl: 10 };
    var el2 = document.querySelector('#modal-root [data-action="confirm-upgrade"]');
    if (el2) el2.click();
    var toast1 = (document.getElementById('toast') || {}).textContent || '';
    var queued1 = (G.state.queues.build || []).length;
    return { toast0: toast0, toast1: toast1, queued0: queued0, queued1: queued1 };
  });
  await p.waitForTimeout(300);
  const r3c = await p.evaluate(function () {
    var t = document.querySelector('#modal-root [data-action="confirm-upgrade"]');
    var toast = (document.getElementById('toast') || {}).textContent || '';
    return { toast: toast, hasBtn: !!t };
  });
  chk('无墙点升级 → 被拦（提示含「城墙」）', (r3b.toast0 || r3c.toast || '').indexOf('城墙') >= 0,
    (r3b.toast0 || r3c.toast || '').slice(0, 60));
  const r3d = await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    G.state.queues.build = [];
    c.cells.forEach(function (x) { if (x.pending) x.pending = null; });
    var el = document.querySelector('#modal-root [data-action="confirm-upgrade"]');
    if (el) el.click();
    return { queued: (G.state.queues.build || []).length };
  });
  chk('给墙 Lv10 后点升级 → 放行（入队 1）', (r3b.queued1 + r3d.queued) >= 1,
    'queued1=' + r3b.queued1 + ' queued=' + r3d.queued + ' toast1=' + String(r3b.toast1).slice(0, 50));

  /* ---------- ④ 逐回合文字复盘 ---------- */
  console.log('===== ④ 逐回合文字复盘（弹窗） =====');
  await p.evaluate(function () {
    var G = window.GAME;
    var rl = [];
    for (var i = 1; i <= 14; i++) {
      rl.push({ r: i, a: 200000 - i * 4000, d: 120000 - i * 3000, gap: i < 6 ? 1200 - i * 150 : 0,
        events: (i % 5 === 0) ? [] : [
          { kind: 'attack', side: 'atk', id: 0, name: '长枪兵', target: '弓兵', kill: 120 + i * 7 },
          { kind: 'counter', side: 'd', targetId: 0, name: '弓兵', kill: 30 + i }
        ] });
    }
    G.state.reports.unshift({ t: Date.now(), title: '§157 许都·攻城（实测）', win: true, type: 'war', fav: false,
      body: '【许都】攻城胜利', engine: 'tactic', rounds: 14, winner: 'atk', roundsLog: rl });
    G.ui.closeAllModals();
    G.ui.viewReportText(G.repRidOf(G.state.reports[0]));
  });
  await p.waitForTimeout(400);
  await p.locator('#modal-root [data-action="report-rounds"]').click();
  await p.waitForTimeout(400);
  const r4 = await p.evaluate(function () {
    var box = document.querySelector('#modal-root .rt-rounds');
    var rounds = document.querySelectorAll('#modal-root .rt-round');
    var panel = document.querySelector('#modal-root .inner-panel');
    return { n: rounds.length, head: rounds.length ? (rounds[0].textContent || '').slice(0, 60) : '',
      overflow: panel ? panel.scrollHeight - panel.clientHeight : -1,
      pager: !!document.querySelector('#modal-root .pager') };
  });
  chk('逐回合弹窗：每页 12 回合 + 翻页条 + 无溢出', r4.n === 12 && r4.pager && r4.overflow <= 0,
    'n=' + r4.n + ' overflow=' + r4.overflow);
  chk('首行 = 第1回合（我 X · 敌 Y）：事件', r4.head.indexOf('第1回合') === 0 && r4.head.indexOf('长枪兵→弓兵') > 0, r4.head);
  {
    const box2 = await p.evaluate(function () {
      var el = document.querySelector('#modal-root .inner-panel');
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    });
    await p.screenshot({ path: OUT + 'v89157-rounds.png', clip: { x: box2.x, y: box2.y, width: box2.w, height: box2.h } });
  }

  /* ---------- ⑤ 地块 Lv1 = 4×3 居中 ---------- */
  console.log('===== ⑤ 城外地块（12 = 4×3 居中矩形） =====');
  await p.evaluate(function () {
    var G = window.GAME;
    var c = G.currentCity();
    /* 官府复位到 Lv1（前面城墙用例把官府抬到 11 了 —— extCap 跟官府走） */
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 1; });
    G.wallSlotOf(c).build = null;
    G.state.queues.build = [];
    c.cells.forEach(function (x) { if (x.pending) x.pending = null; });
    G.ui.closeAllModals();
    G.ui.setView('ext');
  });
  await p.waitForTimeout(600);
  const r5 = await p.evaluate(function () {
    var G = window.GAME;
    var ord = G.extSlotOrder();
    var cap = G.extCap(G.currentCity());
    var lit = {};
    ord.slice(0, cap).forEach(function (o) { lit[o.row + ',' + o.col] = 1; });
    var litN = 0, lockedN = 0, c0 = 99, c1 = -1, r0 = 99, r1 = -1;
    ord.slice(0, cap).forEach(function (o) {
      litN++; if (o.col < c0) c0 = o.col; if (o.col > c1) c1 = o.col;
      if (o.row < r0) r0 = o.row; if (o.row > r1) r1 = o.row;
    });
    var domLocked = document.querySelectorAll('.iso-tile.locked').length;
    var domTiles = document.querySelectorAll('.iso-tile').length;
    var map = [];
    for (var r = 0; r < 8; r++) { var l = ''; for (var c = 0; c < 12; c++) l += lit[r + ',' + c] ? '■' : '·'; map.push(l); }
    return { cap: cap, litN: litN, bbox: { r0: r0, r1: r1, c0: c0, c1: c1 }, w: c1 - c0 + 1, h: r1 - r0 + 1,
      domLocked: domLocked, domTiles: domTiles, map: map };
  });
  chk('Lv1 12 块 = 4×3 居中矩形（bbox 4 宽 3 高 · 面积 12）',
    r5.cap === 12 && r5.w === 4 && r5.h === 3 && r5.litN === 12, JSON.stringify(r5.bbox));
  chk('DOM：12 亮格 + 84 暗格', r5.domTiles === 96 && r5.domLocked === 84,
    'tiles=' + r5.domTiles + ' locked=' + r5.domLocked);
  console.log(r5.map.join('\n'));
  await p.locator('#view-container').screenshot({ path: OUT + 'v89157-ext-lv1.png' });

  console.log('\n===== 实机结果：' + pass + ' pass / ' + fail + ' fail =====');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH: ' + (e && e.stack || e)); process.exit(1); });
