'use strict';
/* v89.150 实机验证 A（真浏览器）：老板 2 —— **整幅画面等比例整体缩放**
   三个视口各量一遍：k 值 / #app-fit 尺寸 / 画布是否溢出 / 弹窗是否在画布内 /
   城内·城外·野地三页 + 建筑弹窗 + 小功能弹窗是不是都在同一坐标系里缩。
   跑法：node .workbuddy/tools/show/shot_v89150a_scale.js */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var EXE = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
var PASS = 0, FAIL = 0;
function chk(name, ok, extra) {
  if (ok) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

async function measure(p) {
  return await p.evaluate(function () {
    function R(sel) { var e = document.querySelector(sel); if (!e) return null;
      var r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top),
        b: Math.round(r.bottom), r: Math.round(r.right) }; }
    var sc = document.getElementById('app-scale');
    var fit = document.getElementById('app-fit');
    var vw = window.innerWidth, vh = window.innerHeight;
    var out = {
      vw: vw, vh: vh,
      kTok: getComputedStyle(document.documentElement).getPropertyValue('--app-k').trim(),
      kReal: (sc && sc.offsetWidth) ? (sc.getBoundingClientRect().width / sc.offsetWidth) : -1,
      scLayout: sc ? { w: sc.offsetWidth, h: sc.offsetHeight } : null,
      deckW: (document.body && document.body.clientWidth) || document.documentElement.clientWidth,
      fit: R('#app-fit'), scale: R('#app-scale'),
      canvas: R('#screen-game'), mask: R('#modal-root .modal-mask'),
      docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      docScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      modal: R('#modal-root .modal'),
      modalInner: document.querySelector('#modal-root .modal')
        ? { over: document.querySelector('#modal-root .modal').scrollHeight - document.querySelector('#modal-root .modal').clientHeight } : null,
    };
    out.expectK = Math.min(vw / 1440, vh / 900);
    return out;
  });
}

(async function () {
  var b = await pw.chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  var errs = [];
  var p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
  p.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', function (e) { errs.push('PAGEERR ' + e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });

  var r1 = await p.evaluate(function () {
    var G = window.GAME, st = G.newGame({ name: '缩', cityName: '许都', region: '豫州', mapSeed: 20260950 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui._cityId = st.cities[0].id;
    return { ok: true };
  });

  /* ============ ① 大视口 1680×1000 ============ */
  console.log('===== ① 大视口 1680×1000（k 应 = 1.1111）=====');
  var m1 = await measure(p);
  console.log('  k(令牌)=' + m1.kTok + ' k(实测)=' + m1.kReal.toFixed(4) + ' 期望=' + m1.expectK.toFixed(4));
  console.log('  #app-fit=' + JSON.stringify(m1.fit) + ' · #app-scale=' + JSON.stringify(m1.scale));
  chk('① k = min(w/1440, h/900)', Math.abs(m1.kReal - m1.expectK) < 0.005, m1.kReal.toFixed(4) + ' vs ' + m1.expectK.toFixed(4));
  chk('① #app-fit 尺寸 = 画布 × k（1440k × 900k）',
    Math.abs(m1.fit.w - 1440 * m1.expectK) <= 2 && Math.abs(m1.fit.h - 900 * m1.expectK) <= 2,
    m1.fit.w + '×' + m1.fit.h + ' vs ' + Math.round(1440 * m1.expectK) + '×' + Math.round(900 * m1.expectK));
  chk('① 画布视觉尺寸 = 视口内不溢出（无滚动条）', m1.docScroll <= 1 && m1.docScrollX <= 1,
    'vScroll=' + m1.docScroll + ' hScroll=' + m1.docScrollX);
  /* ⚠️ 居中基准用 **body.clientWidth** —— html 有 scrollbar-gutter: stable，
     gutter（本机 10px）不占 body 但含在 html.clientWidth 里（实测 body 1670 / html 1680） */
  chk('① 画布水平居中（基准 = body.clientWidth）',
    Math.abs(m1.fit.x - (m1.deckW - m1.fit.w) / 2) <= 3,
    'x=' + m1.fit.x + ' 期望=' + Math.round((m1.deckW - m1.fit.w) / 2) + '（body.clientWidth=' + m1.deckW + '）');
  chk('① 画布**布局**尺寸仍是 1440×900（一格没重排 · 变的是 scale）',
    m1.scLayout && m1.scLayout.w === 1440 && m1.scLayout.h === 900,
    JSON.stringify(m1.scLayout));

  /* ============ ② 小视口 1200×760（过去会溢出） ============ */
  console.log('===== ② 小视口 1200×760（过去弹窗被压小 → 溢出）=====');
  await p.setViewportSize({ width: 1200, height: 760 });
  await p.waitForTimeout(400);
  var m2 = await measure(p);
  console.log('  k(实测)=' + m2.kReal.toFixed(4) + ' 期望=' + m2.expectK.toFixed(4) + ' · 画布视觉 ' + m2.canvas.w + '×' + m2.canvas.h);
  chk('② 小视口照样等比（k 变小，不裁剪）', Math.abs(m2.kReal - m2.expectK) < 0.005, m2.kReal.toFixed(4));
  chk('② 小视口无页面滚动条', m2.docScroll <= 1 && m2.docScrollX <= 1, 'v=' + m2.docScroll + ' h=' + m2.docScrollX);

  /* 弹窗在画布内 */
  var r2 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.openBuildModal && G.ui.openBuildModal(0);
    return { has: !!document.querySelector('#modal-root .modal') };
  });
  await p.waitForTimeout(300);
  var m3 = await measure(p);
  if (m3.modal) {
    console.log('  弹窗（建筑面板）：' + JSON.stringify(m3.modal) + ' · 内容溢出=' + (m3.modalInner ? m3.modalInner.over : '?'));
    chk('② 弹窗完完整整落在画布内（不越界）',
      m3.modal.x >= m3.scale.x - 1 && m3.modal.r <= m3.scale.r + 1
      && m3.modal.y >= m3.scale.y - 1 && m3.modal.b <= m3.scale.b + 1,
      '弹窗[' + m3.modal.x + ',' + m3.modal.r + '] 画布[' + m3.scale.x + ',' + m3.scale.r + ']');
    chk('② 弹窗内容不溢出（无下拉条）', m3.modalInner && m3.modalInner.over <= 1, 'over=' + (m3.modalInner && m3.modalInner.over));
  } else {
    chk('② 弹窗（建筑面板）打开', false, '未打开');
  }
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89150-scale-small.png' });

  /* ============ ③ 三页 + 点击命中 ============ */
  console.log('===== ③ 城内 / 城外 / 野地三页 + 地图点击命中 =====');
  await p.setViewportSize({ width: 1680, height: 1000 });
  await p.waitForTimeout(300);
  var r3 = await p.evaluate(function () {
    var G = window.GAME;
    try { G.ui.closeAllModals(); } catch (e) { }
    var out = {};
    ['city', 'ext', 'map'].forEach(function (v) {
      G.ui.setView('' + v);
      var box = document.getElementById('view-container');
      /* ⚠️ 城内/城外是 DOM 棋盘（无 canvas）——判据量**容器**（clientWidth 是布局值，不受缩放影响） */
      out[v] = { vcW: box ? box.clientWidth : -1, vcH: box ? box.clientHeight : -1 };
    });
    /* 地图视图：显式渲染一次（setView 后要等布局落定，见下面的 waitForTimeout） */
    G.ui.setView('map');
    if (G.ui.renderMapCanvas) G.ui.renderMapCanvas();
    out.mapReady = !!G.map._view;
    return out;
  });
  await p.waitForTimeout(500);
  var r3b = await p.evaluate(function () {
    var G = window.GAME;
    /* 地图点击命中：**自洽验证** —— 拿已知格反算"画布内屏幕坐标"，
       再乘 k 加缩放容器原点 → 视口坐标 → map.pick 应回同一格（真实点击走的正是这条链）。 */
    var cvEl = document.getElementById('mapCanvas');
    var v = G.map._view;
    if (!cvEl || !v || !v.HW || !v.cell) return { err: 'no-map', cv: !!cvEl, view: !!v,
      cw: cvEl ? cvEl.clientWidth : -1 };
    var sc = document.getElementById('app-scale');
    var sr = sc.getBoundingClientRect();
    var k = sr.width / sc.offsetWidth;
    /* 反投影：a = gx − gy, b = gx + gy → 画布内 mx/my（map.pick 的公式反解） */
    var gx = v.vx, gy = v.vy;
    var mx = v.ox + (gx - gy) * v.HW;
    var my = v.oy + (gx + gy) * v.HH;
    var cr = cvEl.getBoundingClientRect();
    var vxp = cr.left + mx * k, vyp = cr.top + my * k;
    return { want: { x: gx, y: gy }, got: G.map.pick(cvEl, vxp, vyp), k: k,
      mainW: cvEl.clientWidth, mx: Math.round(mx), my: Math.round(my) };
  });
  console.log('  三页容器：' + JSON.stringify(r3.city) + ' / ' + JSON.stringify(r3.ext) + ' / ' + JSON.stringify(r3.map));
  console.log('  地图画布 ' + r3b.mainW + 'px · k=' + (r3b.k || 0).toFixed(3) + ' · 打点(' + r3b.mx + ',' + r3b.my + ')' +
    ' → 命中 ' + (r3b.got ? '(' + r3b.got.x + ',' + r3b.got.y + ')' : JSON.stringify(r3b)));
  chk('③ 三页（城内/城外/野地）都在画布坐标系里（容器尺寸 > 0 且同基准）',
    [r3.city, r3.ext, r3.map].every(function (o) { return o.vcW > 0 && o.vcH > 0; })
    && r3.city.vcW === r3.ext.vcW,
    '城内 ' + r3.city.vcW + '×' + r3.city.vcH + ' · 城外 ' + r3.ext.vcW + ' · 野地 ' + r3.map.vcW);
  if (r3b && r3b.got) {
    chk('③ 地图点击命中不受缩放影响（已知格自点自中 · 视口坐标含 k 换算）',
      r3b.got.x === r3b.want.x && r3b.got.y === r3b.want.y,
      'want(' + r3b.want.x + ',' + r3b.want.y + ') got(' + r3b.got.x + ',' + r3b.got.y + ') k=' + r3b.k.toFixed(3));
  } else {
    chk('③ 地图点击命中（真打点）', false, JSON.stringify(r3b));
  }
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/shots/v89150-scale-big.png' });

  /* ============ ④ 浮层（提示条）落在画布坐标系 ============ */
  console.log('===== ④ 提示条 / 悬停浮层都在画布坐标系 =====');
  var r4 = await p.evaluate(function () {
    var G = window.GAME;
    G.ui.toast('v89.150 缩放验收：提示条应落在画布内底部居中');
    var t = document.getElementById('toast');
    var tr = t.getBoundingClientRect();
    var sc = document.getElementById('app-scale');
    var sr = sc.getBoundingClientRect();
    return { t: { x: Math.round(tr.left), y: Math.round(tr.top), w: Math.round(tr.width), b: Math.round(tr.bottom) },
      sc: { x: Math.round(sr.left), w: Math.round(sr.width), b: Math.round(sr.bottom) },
      parent: t.parentNode ? (t.parentNode.id || t.parentNode.className || '-') : '-' };
  });
  console.log('  提示条 ' + JSON.stringify(r4.t) + ' · 画布 ' + JSON.stringify(r4.sc) + ' · 父节点=' + r4.parent);
  chk('④ 提示条父节点 = #app-scale（画布坐标系）', r4.parent === 'app-scale', r4.parent);
  chk('④ 提示条水平居中于画布', Math.abs((r4.t.x + r4.t.w / 2) - (r4.sc.x + r4.sc.w / 2)) <= 3,
    '条心=' + Math.round(r4.t.x + r4.t.w / 2) + ' 画布心=' + Math.round(r4.sc.x + r4.sc.w / 2));
  chk('④ 提示条在画布内（底边不越界）', r4.t.b <= r4.sc.b + 1, r4.t.b + ' vs ' + r4.sc.b);

  console.log('\n浏览器错误：' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : '无'));
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  await b.close();
  process.exit(FAIL ? 1 : 0);
})();
