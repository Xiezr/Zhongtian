/* ============================================================
 * tools/mode-cost-probe.js  「战略 / 建造 / 地表」三态运行成本实测
 * ------------------------------------------------------------
 * 用法：node tools/mode-cost-probe.js > tools/_mode-cost.log 2>&1
 *
 * 回答老板的疑虑：
 *   ① 系统级切换会不会把资源掏空？
 *   ② 切换本身会不会卡？
 *   ③ 元素越加越多之后，两套坐标系会不会互相拖死？
 *
 * 做法：真 WebGL 上下文（headless swiftshader），直接驱动
 *   `GAME.map3d.render(离屏canvas)` 逐帧跑 —— 走的就是玩家路径
 *   （render 内含 placeCamera + _tickSurfFade + 全部图层开关）。
 *   THREE.WebGLRenderer 实例靠 addInitScript 懒 hook 拿到，读 renderer.info。
 *   零改动生产代码。
 *
 * 输出分五段：
 *   env      环境与版本
 *   rebuild  建面成本（连续 12 次）
 *   load     三态稳态帧成本 + 图元/批次/显存对象
 *   switch   setMode 单次切换耗时
 *   roundtrip 往返 12 次的资源回归（泄漏检查）
 * ============================================================ */
const { chromium } = require('playwright-core');

const CHROME = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const URL = 'http://127.0.0.1:8123/index.html';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--disable-dev-shm-usage', '--no-sandbox', '--window-size=1400,860']
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });

  await page.addInitScript(() => {
    let cached = null;
    function hook(v) {
      if (!v || !v.WebGLRenderer || v.WebGLRenderer.__hooked) return;
      const Orig = v.WebGLRenderer;
      const W = function (...a) { const i = new Orig(...a); window.__R3 = i; return i; };
      W.prototype = Orig.prototype; Object.setPrototypeOf(W, Orig); W.__hooked = true;
      v.WebGLRenderer = W;
    }
    Object.defineProperty(window, 'THREE', { configurable: true,
      get() { try { hook(cached); } catch (e) { } return cached; },
      set(v) { cached = v; try { hook(v); } catch (e) { } } });
  });

  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));

  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(3500);

  /* ---- 开局（走 UI 真实入口：填名字 → doCreate） ---- */
  await page.evaluate(() => {
    const nm = document.getElementById('create-name');
    if (nm) nm.value = '成本测试';
    GAME.ui.doCreate();
  });
  await page.waitForTimeout(12000);
  await page.evaluate(() => {
    /* 关掉可能挡路的引导弹窗，避免每帧重绘开销被 UI 抢 */
    try { GAME.ui && GAME.ui.closeModal && GAME.ui.closeModal(); } catch (e) { }
    document.querySelectorAll('#boot-loading').forEach(e => e.classList.remove('on'));
    const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 860;
    cv.id = 'probeCanvas'; cv.style.display = 'none';
    document.body.appendChild(cv);
    window.__cv = cv;
    /* 预热：建好星球/图元，避免把首建成本算进稳态 */
    for (let i = 0; i < 4; i++) GAME.map3d.render(cv);
  });
  await page.waitForTimeout(500);

  const out = {};

  /* ---- env ---- */
  out.env = await page.evaluate(() => {
    const M = GAME.map3d, r = window.__R3;
    let gpu = 'n/a';
    try {
      const g = r.getContext(), d = g.getExtension('WEBGL_debug_renderer_info');
      gpu = d ? String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)) : String(g.getParameter(g.RENDERER));
    } catch (e) { }
    const tri = (x) => (x ? x.attributes.position.count : 0);
    let leaf = 0, objs = 0, tris = 0;
    if (M._sr && M._sr.root) M._sr.root.traverse(o => {
      objs++;
      if (o.isMesh || o.isLine || o.isPoints) {
        leaf++;
        const g = o.geometry;
        if (g) tris += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3 * (o.isInstancedMesh ? o.count : 1);
      }
    });
    return {
      version: GAME.VERSION, gpu,
      cells: GAME.sphere.cells.length,
      mode: M.mode, surfOn: !!M._surf, surf: M.surfStats(),
      srObjects: objs, srDrawables: leaf, srTriangles: Math.round(tris),
      modeConst: { strategy: M.MODE_STRATEGY, build: M.MODE_BUILD }
    };
  });

  /* ---- rebuild 成本 ---- */
  out.rebuild = await page.evaluate(() => {
    const M = GAME.map3d, cv = window.__cv;
    const wall = [], inner = [];
    for (let i = 0; i < 12; i++) {
      const t0 = performance.now();
      M.rebuildSurf(M._surfDir || [0, 1, 0].map((v, k) => k === 1 ? 1 : 0));
      wall.push(+(performance.now() - t0).toFixed(1));
      const s = M.surfStats(); inner.push(s ? s.ms : -1);
    }
    return { wall, inner, cells: (M.surfStats() || {}).cells };
  });

  /* ---- 三态稳态 ---- */
  async function steady(label, setup, frames) {
    return await page.evaluate(([lab, code, n]) => {
      const M = GAME.map3d, cv = window.__cv, r = window.__R3;
      const gl = r.getContext();
      /* ⚠️ 前传模式会把相机焊在贴地（`_inPro241`），不解除就分不出三个态 */
      M.camFree = true;
      if (code === 'strategy') {
        M.setMode(M.MODE_STRATEGY);
        M.surfaceMode(false);
        M.camO && (M.camO.dist = 0);           /* 占位，下面用 resetView 兜底 */
        M.resetView();                          /* yaw/pitch/dist = R*2.9（真正的轨道） */
      } else if (code === 'surf') {
        M.setMode(M.MODE_STRATEGY);
        M.surfaceMode(true);
      } else if (code === 'build') {
        M.surfaceMode(false);
        M.setMode(M.MODE_BUILD);
      }
      /* 让 fade / 拆层 / 重建走完（fade K=0.14，40 帧后残差 < 0.3%） */
      for (let i = 0; i < 45; i++) { M.render(cv); gl.finish(); }
      const dt = [], calls = [], tris = [];
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        M.render(cv);
        gl.finish();                            /* WebGL 提交是异步的，必须等 GPU 落地 */
        dt.push(performance.now() - t0);
        calls.push(r.info.render.calls);
        tris.push(r.info.render.triangles);
      }
      const s = dt.slice().sort((a, b) => a - b);
      return {
        label: lab, frames: n,
        ms_p50: +s[Math.floor(n * 0.5)].toFixed(1),
        ms_p90: +s[Math.floor(n * 0.9)].toFixed(1),
        ms_avg: +(dt.reduce((a, b) => a + b, 0) / n).toFixed(1),
        calls_p50: calls.slice().sort((a, b) => a - b)[Math.floor(n * 0.5)],
        tris_p50: tris.slice().sort((a, b) => a - b)[Math.floor(n * 0.5)],
        mem: { geometries: r.info.memory.geometries, textures: r.info.memory.textures },
        programs: r.info.programs ? r.info.programs.length : -1,
        surfOn: !!M._surf, surf: M.surfStats(),
        jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1
      };
    }, [label, setup, frames]);
  }

  out.loadStrategy = await steady('strategy', 'strategy', 30);
  out.loadSurf = await steady('surf', 'surf', 30);
  out.loadBuild = await steady('build', 'build', 30);

  /* ---- 单次切换耗时 ---- */
  out.switch = await page.evaluate(() => {
    const M = GAME.map3d, cv = window.__cv;
    const toBuild = [], toStrat = [];
    for (let i = 0; i < 8; i++) {
      let t0 = performance.now();
      M.setMode(M.MODE_BUILD);
      toBuild.push(+(performance.now() - t0).toFixed(2));
      for (let k = 0; k < 6; k++) M.render(cv);
      t0 = performance.now();
      M.setMode(M.MODE_STRATEGY);
      toStrat.push(+(performance.now() - t0).toFixed(2));
      for (let k = 0; k < 8; k++) M.render(cv);
    }
    return { toBuild, toStrat };
  });

  /* ---- 往返 12 次：资源回归（含"真的拆层"这一条路径） ---- */
  out.roundtrip = await page.evaluate(() => {
    const M = GAME.map3d, cv = window.__cv, r = window.__R3;
    const gl = r.getContext();
    M.camFree = true;
    M.resetView();
    for (let i = 0; i < 60; i++) { M.render(cv); gl.finish(); if (!M._sr) break; }
    const base = { geometries: r.info.memory.geometries, textures: r.info.memory.textures };
    const geo = [], tex = [], heap = [], srLeft = [], rebuildHit = [];
    for (let i = 0; i < 12; i++) {
      M.setMode(M.MODE_BUILD);
      for (let k = 0; k < 10; k++) { M.render(cv); gl.finish(); }
      rebuildHit.push(!!M._sr);
      M.setMode(M.MODE_STRATEGY);
      M.resetView();                                   /* 拉回轨道 → 触发淡出 + 拆层 */
      for (let k = 0; k < 60; k++) { M.render(cv); gl.finish(); if (!M._sr) break; }
      geo.push(r.info.memory.geometries);
      tex.push(r.info.memory.textures);
      heap.push(performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1);
      srLeft.push(!!M._sr);
    }
    return { base, geo, tex, heap,
             srAfterEnterBuild: rebuildHit, srLeftBehind: srLeft.filter(Boolean).length,
             geoFinal: r.info.memory.geometries, texFinal: r.info.memory.textures };
  });

  console.log(JSON.stringify({ out, errs: errs.slice(0, 6) }, null, 2));
  await browser.close();
})().catch(e => { console.error('PROBE FAIL', (e && e.stack) || e); process.exit(1); });
