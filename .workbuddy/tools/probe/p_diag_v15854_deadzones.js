'use strict';
/* v158.54 取证探针：星球「死角 / 轴线 / 闪变」的**生成层**诊断（只读，不改产品）
   ------------------------------------------------------------
   前四轮（v157.78/.80/.81）修的是相机旋转层；老板这次点名「从生成层面消失死角、
   轴线只做标识用」。所以本探针不碰相机输入，直接量 globe 网格本体：

     ① cube-sphere 六面拼接的**接缝顶点**：位置重合（方向 toFixed 同键）但法线/颜色
        差异 —— 差异大就是"直线分界/轴线/死角"的生成层铁证；
     ② **立方体棱/角**在球面的落点（6 面 12 棱 8 角）→ 对照截图看"轴线"是不是它；
     ③ axisRoot（那根青色圆柱）的体积/位置 —— 它该只做标识；
     ④ 固定视角**连拍 N 帧**，逐帧像素差 → 闪变量化（不靠肉眼）；
     ⑤ 极点俯视 / cube 角正对 两个特殊视角截图。

   跑法：NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" \
         node .workbuddy/tools/probe/p_diag_v15854_deadzones.js
   产物：.workbuddy/shots/v15854-*.png + .workbuddy/tmp/diag_v15854.log
*/
const { chromium } = require('playwright-core');
const fs = require('fs');
const { PNG } = require('pngjs');
const ROOT = 'E:/Deepseekdb';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const SHOTS = ROOT + '/.workbuddy/shots/';
const L = [];
const log = (s) => { L.push(String(s)); console.log(s); };

function pixDiff(a, b) {
  const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(b));
  let diff = 0, big = 0, n = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    diff += d; if (d > 30) big++; n++;
  }
  return { avg: +(diff / n).toFixed(3), bigPct: +(big / n * 100).toFixed(3) };
}

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto('file:///' + ROOT + '/index.html');
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    GAME.newGame({ name: 'Z', cityName: '灰岗', mapSeed: 20261127 });
    GAME.ui.enterGame(); GAME.ui.setView('map');
  });
  for (let i = 0; i < 150; i++) {
    const st = await p.evaluate(() => {
      const c = document.getElementById('mapCanvas'), ov = document.getElementById('boot-loading');
      return { c: !!c && c.clientWidth > 0, boot: ov ? ov.classList.contains('on') : false, g: !!(GAME.map3d && GAME.map3d._globe) };
    });
    if (st.c && !st.boot && st.g) break;
    await p.waitForTimeout(200);
  }
  await p.waitForTimeout(900);
  /* 停自转，保证连拍是同一视角 */
  await p.evaluate(() => { GAME.map3d.setSpin(false); GAME.map3d._lastAct = Date.now(); });
  await p.waitForTimeout(300);

  /* ---------- ① ②③ 生成层网格诊断 ---------- */
  const geo = await p.evaluate(() => {
    const M = GAME.map3d, g = M._globe;
    if (!g || !g.geometry) return { err: 'no globe' };
    const pos = g.geometry.getAttribute('position');
    const nor = g.geometry.getAttribute('normal');
    const col = g.geometry.getAttribute('color');
    const idx = g.geometry.getIndex();
    const n = pos.count;
    /* 方向键 → 顶点列表：同一球面位置（方向 toFixed(5)）的重复顶点 */
    const map = Object.create(null);
    let worstN = null, worstND = -1, worstC = null, worstCD = -1, seamGroups = 0, seamVerts = 0;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const L = Math.hypot(x, y, z) || 1;
      const key = (x / L).toFixed(5) + ',' + (y / L).toFixed(5) + ',' + (z / L).toFixed(5);
      (map[key] || (map[key] = [])).push(i);
    }
    for (const k in map) {
      const list = map[k];
      if (list.length < 2) continue;
      seamGroups++; seamVerts += list.length;
      for (let a = 0; a < list.length; a++) for (let c = a + 1; c < list.length; c++) {
        const i = list[a], j = list[c];
        if (nor) {
          const dot = nor.getX(i) * nor.getX(j) + nor.getY(i) * nor.getY(j) + nor.getZ(i) * nor.getZ(j);
          const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
          if (ang > worstND) { worstND = ang; worstN = { dir: k, i, j }; }
        }
        if (col) {
          const dd = Math.abs(col.getX(i) - col.getX(j)) + Math.abs(col.getY(i) - col.getY(j)) + Math.abs(col.getZ(i) - col.getZ(j));
          if (dd > worstCD) { worstCD = dd; worstC = { dir: k, i, j }; }
        }
      }
    }
    /* 立方体 8 角投影方向（cube-sphere 六面交汇点）*/
    const corners = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const l = Math.sqrt(3); corners.push([+(sx / l).toFixed(3), +(sy / l).toFixed(3), +(sz / l).toFixed(3)]);
    }
    /* 立方体 12 棱中点方向（六面公共边）*/
    const edges = [];
    for (const ax of [0, 1, 2]) for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const v = [0, 0, 0]; v[ax] = 1;
      const o = (ax + 1) % 3, t = (ax + 2) % 3; v[o] = s1; v[t] = s2;
      const l = Math.hypot(v[0], v[1], v[2]); edges.push(v.map((z) => +(z / l).toFixed(3)));
    }
    const axis = M._axisRoot;
    return {
      verts: n, tris: idx ? idx.count / 3 : 0, seamGroups, seamVerts,
      worstNormalDeg: +worstND.toFixed(2), worstNormal: worstN,
      worstColorDelta: +worstCD.toFixed(3), worstColor: worstC,
      corners, edges,
      axis: axis ? { isMesh: !!axis.isMesh, type: axis.geometry && axis.geometry.type,
        pos: axis.geometry && axis.geometry.parameters ? axis.geometry.parameters : null,
        visible: axis.visible, count: axis.geometry ? axis.geometry.getAttribute('position').count : 0 } : null,
      sub: GAME.mapSphere ? GAME.mapSphere.sub : null
    };
  });
  log('【生成层网格诊断】');
  Object.keys(geo).forEach((k) => log('  ' + k + ': ' + JSON.stringify(geo[k])));

  /* ---------- ⑤ 特殊视角截图 ---------- */
  await p.evaluate(() => { GAME.map3d.lookAtDir([0, 1, 0]); });
  await p.waitForTimeout(450);
  await p.screenshot({ path: SHOTS + 'v15854-A-pole.png' });
  await p.evaluate(() => { GAME.map3d.lookAtDir([1, 1, 1]); });
  await p.waitForTimeout(450);
  await p.screenshot({ path: SHOTS + 'v15854-B-cube-corner.png' });

  /* ---------- ④ 连拍逐帧闪变（默认视角，停自转） ---------- */
  await p.evaluate(() => { GAME.map3d.resetView(); });
  await p.waitForTimeout(400);
  const frames = [];
  for (let k = 0; k < 6; k++) {
    const f = SHOTS + 'v15854-flick' + k + '.png';
    await p.screenshot({ path: f }); frames.push(f);
    await p.waitForTimeout(180);
  }
  log('【连拍逐帧闪变 · 默认视角停自转】');
  for (let k = 1; k < frames.length; k++) {
    const d = pixDiff(frames[k - 1], frames[k]);
    log('  帧' + (k - 1) + '→' + k + '  avgDiff=' + d.avg + '  bigPx%=' + d.bigPct);
  }

  /* ---------- 消元：关线框 / 关云 / 关轴线，看 bigPx 谁贡献 ---------- */
  async function flickWith(label, fn) {
    await p.evaluate(fn);
    await p.waitForTimeout(300);
    const ff = [];
    for (let k = 0; k < 4; k++) {
      const f = SHOTS + 'v15854-x-' + label + '-' + k + '.png';
      await p.screenshot({ path: f }); ff.push(f); await p.waitForTimeout(160);
    }
    let sum = 0;
    for (let k = 1; k < ff.length; k++) sum += pixDiff(ff[k - 1], ff[k]).bigPct;
    log('  消元[' + label + '] bigPx%累计=' + sum.toFixed(3));
  }
  log('【消元闪变】');
  await flickWith('base', () => {});
  await flickWith('noAxis', () => { const a = GAME.map3d._axisRoot; if (a) a.visible = false; });
  await flickWith('noShell', () => { if (GAME.map3d._shellMat) GAME.map3d._shellMat.colorWrite = false; });
  await flickWith('noSky', () => { const s = GAME.map3d._sky; if (s && s.removeFromParent) s.removeFromParent(); });

  log('【页面异常】' + (errs.length ? errs.slice(0, 4).join(' | ') : '无'));
  await b.close();
  fs.writeFileSync(ROOT + '/.workbuddy/tmp/diag_v15854.log', L.join('\n'), 'utf8');
})().catch((e) => { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
