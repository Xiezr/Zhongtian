/* 100 组自检：20 个纯海视角 × 5 个高度（8/35/55/80/130），每组读画面像素，
   统计"非海色像素占比"（= 色斑率）。
   判据：纯海视角下画面里不该出现大片非蓝像素；修复前云雾会让它冲到 60%+。
   用法：node scan_v15784_spots100.js
   输出：每组一行 + 汇总（平均/最大/超阈组数）。 */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e && e.message)));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 60000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
    G.ui.enterGame(); try { G.ui.closeAllModals(); } catch (e) { }
    G.ui.setView('map'); G.refreshAll();
    try { G.map3d.setSpin(false); } catch (e) { }
  }, 20260926);
  await p.waitForTimeout(4500);

  /* 找 20 个纯海中心（邻居 6 格全 lake），互相隔开 */
  const spots = await p.evaluate(function () {
    var SP = window.GAME.sphere, cells = SP.cells, adj = SP.adj, out = [];
    for (var i = 0; i < cells.length && out.length < 20; i++) {
      if (cells[i].type !== 'lake' || !cells[i].dir) continue;
      var an = adj[i] || [], ok = true;
      for (var k = 0; k < an.length; k++) if (cells[an[k]].type !== 'lake') { ok = false; break; }
      if (!ok) continue;
      var far = true;
      for (var m = 0; m < out.length; m++) {
        var d1 = cells[i].dir, d2 = out[m];
        if (d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2] > 0.94) { far = false; break; }
      }
      if (far) out.push(cells[i].dir);
    }
    return out;
  });
  console.log('纯海视角 ' + spots.length + ' 个 · 高度 5 档 → 共 ' + (spots.length * 5) + ' 组');

  /* 找一个能读像素的 2D canvas */
  const canvasInfo = await p.evaluate(function () {
    var list = document.querySelectorAll('canvas'), out = [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i], st = getComputedStyle(c);
      if (st.display === 'none' || c.width < 200) continue;
      var ctx = c.getContext('2d');
      var readable = false, nz = 0;
      try {
        var d = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 8, 8).data;
        for (var k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] > 0) nz++;
        readable = nz > 0;
      } catch (e) { }
      out.push({ i: i, w: c.width, h: c.height, id: c.id || '', cls: c.className || '', readable: readable });
    }
    return out;
  });
  console.log('canvas = ' + JSON.stringify(canvasInfo));
  const pick = canvasInfo.filter(function (c) { return c.readable && c.w > 600; })[0] || canvasInfo.filter(function (c) { return c.readable; })[0];
  if (!pick) { console.log('找不到可读 canvas'); await browser.close(); process.exit(1); }
  console.log('用 canvas #' + pick.i + ' ' + pick.w + 'x' + pick.h + ' id=' + pick.id);

  /* 单组：设视角 → 等稳定 → 统计非海色占比 */
  async function measure(dir, agl) {
    await p.evaluate(function (a) {
      var M = window.GAME.map3d;
      M.lookAtDir(a.dir);
      var d = M.R + a.agl;
      var f = (Math.log(d) - Math.log(M.ZOOM_MIN)) / (Math.log(M.ZOOM_MAX) - Math.log(M.ZOOM_MIN));
      M.setZoom(Math.max(0, Math.min(1, f)));
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    }, { dir: dir, agl: agl });
    await p.waitForTimeout(1300);        /* 让穿云雾衰减完（0.9s）+ 渲染落定 */
    return await p.evaluate(function (idx) {
      var c = document.querySelectorAll('canvas')[idx];
      var ctx = c.getContext('2d');
      var W = c.width, H = c.height;
      /* 只取画布中央 80% 区域，避开 HUD 与边框 */
      /* 只取中央 50%：保证画面里确实只有海（130 米视野能覆盖 30+ 格，边缘会进陆地） */
      var x0 = Math.floor(W * 0.25), y0 = Math.floor(H * 0.25);
      var w = Math.floor(W * 0.5), h = Math.floor(H * 0.5);
      var img = ctx.getImageData(x0, y0, w, h).data;
      var n = 0, off = 0, warm = 0, bright = 0;
      for (var i = 0; i < img.length; i += 4 * 3) {       /* 每 3 像素采一个 */
        var r = img[i], g = img[i + 1], b = img[i + 2];
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        var sat = mx ? (mx - mn) / mx : 0;
        var lum = 0.299 * r + 0.587 * g + 0.114 * b;
        /* 太空背景（球体外）：近黑、低饱和 → 既不是海也不是斑，直接不计入分母 */
        if (lum < 30 && sat < 0.22) { continue; }
        n++;
        /* v157.84 判据：色斑 = **暖色块**（陆地/沙）或 **亮白团**（云/雾）。
           灰蓝色（海面明暗、浪纹、大气辉光的中间调）不算 —— 那是海本身。 */
        var isSpot = (r > b + 12) || (lum > 150 && sat < 0.22);
        if (isSpot) {
          off++;
          if (r > b + 12) warm++;
          if (lum > 160) bright++;
        }
      }
      return { n: n, offPct: +(off / n * 100).toFixed(2), warmPct: +(warm / n * 100).toFixed(2),
        brightPct: +(bright / n * 100).toFixed(2) };
    }, pick.i);
  }

  const rows = [];
  for (const agl of [130, 80, 55, 35, 8]) {
    for (let i = 0; i < spots.length; i++) {
      const r = await measure(spots[i], agl);
      rows.push({ agl: agl, i: i, off: r.offPct, warm: r.warmPct, bright: r.brightPct });
    }
  }

  /* 汇总 */
  const offs = rows.map(r => r.off).sort((a, b) => a - b);
  const avg = offs.reduce((a, b) => a + b, 0) / offs.length;
  const p95 = offs[Math.floor(offs.length * 0.95)];
  const over = rows.filter(r => r.off > 5);
  console.log('');
  console.log('=== 汇总（' + rows.length + ' 组）===');
  console.log('非海色像素占比：平均 ' + avg.toFixed(2) + '% · 中位 ' + offs[Math.floor(offs.length / 2)].toFixed(2)
    + '% · P95 ' + p95.toFixed(2) + '% · 最大 ' + offs[offs.length - 1].toFixed(2) + '%');
  console.log('超 5% 的组 = ' + over.length + ' / ' + rows.length);
  over.slice(0, 10).forEach(function (r) {
    console.log('  超阈 agl=' + r.agl + ' 视角#' + r.i + ' → ' + r.off + '%（暖 ' + r.warm + '% · 亮 ' + r.bright + '%）');
  });
  /* 按高度看平均 */
  [130, 80, 55, 35, 8].forEach(function (a) {
    const sub = rows.filter(r => r.agl === a);
    const m = sub.reduce((s, r) => s + r.off, 0) / sub.length;
    console.log('  agl=' + String(a).padStart(3) + ' → 平均非海色 ' + m.toFixed(2) + '%');
  });
  console.log('页面异常 ' + errs.length + (errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''));
  const ok = errs.length === 0 && p95 < 5 && over.length <= rows.length * 0.05;
  console.log(ok ? 'SCAN100_PASS' : 'SCAN100_FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
