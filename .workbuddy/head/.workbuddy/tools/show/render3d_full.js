/* 全量 500×500 真·3D 地形渲染（每格细分 2×2 = 1000×1000 面片）
 * 用法：node .workbuddy/tools/show/render3d_full.js
 * 产出：.workbuddy/shots/terrain3d_full.png
 * 原理：透视相机 + 双线性高度场(细分) + 坡面法线光照 + 画家算法（远→近，不排序）。
 */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var pw = require('playwright-core');
var fs = require('fs');
var SEED = 20260926;

(async function () {
  var exe = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
  var b = await pw.chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  var p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', function (e) { console.log('EXC', e.message); });
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForFunction('window.GAME && window.GAME.DATA && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(function (seed) {
    var G = window.GAME;
    var st = G.newGame({ name: 'X', cityName: '灰岗', region: '碎垣', mapSeed: seed, portraitSeed: 8 });
    if (!st.map.grid) G.map.generate();
  }, SEED);
  await p.waitForTimeout(300);

  var out = await p.evaluate(function (o) {
    var G = window.GAME, DATA = G.DATA, grid = G.state.map.grid, seed = G.state.map.seed;
    var Wc = DATA.MAP_W, Hc = DATA.MAP_H;
    var t0 = performance.now();
    function nhash(ix, iy, salt) { var h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x2545f491); h ^= h >>> 13; return (h >>> 8) / 16777216; }
    function vnoise(x, y, step, salt) { var fx = x / step, fy = y / step, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); var a = nhash(ix, iy, salt), b2 = nhash(ix + 1, iy, salt), c = nhash(ix, iy + 1, salt), d = nhash(ix + 1, iy + 1, salt); var r0 = a + (b2 - a) * tx, r1 = c + (d - c) * tx; return r0 + (r1 - r0) * ty; }
    var OCT = [[16, 0.5], [8, 0.3], [4, 0.2]];
    function fbm(x, y, salt) { var v = 0; for (var i = 0; i < OCT.length; i++) v += OCT[i][1] * vnoise(x, y, OCT[i][0], salt + i * 101); return v; }

    /* 格高度场（fbm）+ 地形色 */
    var cellH = new Float32Array(Wc * Hc);
    for (var z = 0; z < Hc; z++) for (var x = 0; x < Wc; x++) cellH[z * Wc + x] = fbm(x, z, seed * 7 + 11);
    function sampleH(fx, fz) {          /* 双线性（fx,fz 为格坐标浮点）*/
      var ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz;
      var x1 = Math.min(Wc - 1, ix + 1), z1 = Math.min(Hc - 1, iz + 1);
      var a = cellH[iz * Wc + ix], b2 = cellH[iz * Wc + x1], c = cellH[z1 * Wc + ix], d = cellH[z1 * Wc + x1];
      return (a * (1 - tx) + b2 * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
    }
    var HS = 34, EBASE = 0.34;
    var emax = 1;                       /* 实际最高（归一化用）*/
    for (var i2 = 0; i2 < cellH.length; i2++) { var v2 = cellH[i2]; if (v2 > emax) emax = v2; }
    emax = Math.max(0.01, emax - EBASE) * HS;
    function elevC(gx, gz) { var e = cellH[Math.min(Hc - 1, Math.max(0, gz)) * Wc + Math.min(Wc - 1, Math.max(0, gx))]; return Math.max(0, e - EBASE) * HS; }

    var PAL = { plain: [198, 180, 120], caoyuan: [170, 188, 106], forest: [88, 124, 72], desert: [218, 192, 124], hill: [174, 162, 142], zhaoze: [118, 136, 110], lake: [72, 140, 178], city: [198, 162, 118] };
    function terr(gx, gz) { return (grid[gz] && grid[gz][gx] && grid[gz][gx].terrain) || 'plain'; }
    /* 高度色带：低处沙 → 草 → 林 → 干坡 → 岩 → 亮岩 → 雪（平滑 lerp） */
    function hx(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
    function lrp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    var STOPS = [[0.00, hx('#cfc09a')], [0.09, hx('#8fb257')], [0.26, hx('#577f43')], [0.44, hx('#8f8350')], [0.62, hx('#8f867a')], [0.82, hx('#c3b9ad')], [1.00, hx('#eef2f4')]];
    function rampColor(hn) {
      hn = Math.max(0, Math.min(1, hn));
      for (var i = 1; i < STOPS.length; i++) {
        if (hn <= STOPS[i][0]) { var t = (hn - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]); return lrp(STOPS[i - 1][1], STOPS[i][1], t); }
      }
      return STOPS[STOPS.length - 1][1];
    }

    /* ---- 相机（俯视全图）---- */
    var cw = o.w, chh = o.h;
    var cxw = Wc / 2, czw = Hc / 2;
    var camPos = [cxw - 20, 330, czw + 500], lookAt = [cxw, 0, czw];
    function sub(a, c) { return [a[0] - c[0], a[1] - c[1], a[2] - c[2]]; }
    function cross(a, c) { return [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]]; }
    function dot(a, c) { return a[0] * c[0] + a[1] * c[1] + a[2] * c[2]; }
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
    var fwd = norm(sub(lookAt, camPos)), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
    var focal = o.focal;
    function proj(P) { var r = sub(P, camPos); var d = dot(r, fwd); return [cw / 2 + dot(r, right) * focal / d, chh / 2 - dot(r, up) * focal / d, d]; }
    var L = norm([-0.5, 0.72, 0.48]);
    function shade(rgb, n) { var lam = Math.max(0.2, dot(n, L)); var k = 0.40 + lam * 0.9; return 'rgb(' + Math.min(255, rgb[0] * k | 0) + ',' + Math.min(255, rgb[1] * k | 0) + ',' + Math.min(255, rgb[2] * k | 0) + ')'; }

    var cv = document.createElement('canvas'); cv.width = cw; cv.height = chh;
    var ctx = cv.getContext('2d');
    var sky = ctx.createLinearGradient(0, 0, 0, chh); sky.addColorStop(0, '#9fc3dd'); sky.addColorStop(0.6, '#d3e1e8'); sky.addColorStop(1, '#e9e3d3');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, chh);

    var SUB = o.sub;                     /* 每格细分 SUB×SUB */
    var F = Wc * SUB;                    /* 细分网格边长 */
    var waterY = 1.2;
    var drawn = 0;
    /* 远→近：相机在南（+z），z 小=远。逐行绘制，无需排序。 */
    for (var iz = 0; iz < F; iz++) {
      var gz = iz / SUB;
      var tz = terr(Math.min(Wc - 1, Math.floor(gz)), Math.min(Hc - 1, Math.floor(gz)));
      for (var ix = 0; ix < F; ix++) {
        var gx = ix / SUB;
        var t = terr(Math.min(Wc - 1, gx | 0), Math.min(Hc - 1, gz | 0));
        var isW = (t === 'lake' || t === 'zhaoze');
        var h00 = isW ? waterY : Math.max(0, sampleH(gx, gz) - EBASE) * HS;
        var h10 = isW ? waterY : Math.max(0, sampleH(gx + 1 / SUB, gz) - EBASE) * HS;
        var h01 = isW ? waterY : Math.max(0, sampleH(gx, gz + 1 / SUB) - EBASE) * HS;
        var h11 = isW ? waterY : Math.max(0, sampleH(gx + 1 / SUB, gz + 1 / SUB) - EBASE) * HS;
        var P00 = proj([gx, h00, gz]), P10 = proj([gx + 1 / SUB, h10, gz]), P11 = proj([gx + 1 / SUB, h11, gz + 1 / SUB]), P01 = proj([gx, h01, gz + 1 / SUB]);
        if (P00[2] <= 0.5 || P10[2] <= 0.5 || P11[2] <= 0.5 || P01[2] <= 0.5) continue;
        /* 崖壁 / 水岸：南邻或东邻更低时，补一片立面（否则阶梯处露空 = "针林"）*/
        var base = lrp(rampColor(h00 / emax), PAL[t] || PAL.plain, 0.30);   /* 高度色带 × 地形色 */
        var gzS = gz + 1 / SUB, gxE = gx + 1 / SUB;
        var tS = terr(Math.min(Wc - 1, gx | 0), Math.min(Hc - 1, gzS | 0));
        var tE = terr(Math.min(Wc - 1, gxE | 0), Math.min(Hc - 1, gz | 0));
        var hS = (tS === 'lake' || tS === 'zhaoze') ? waterY : Math.max(0, sampleH(gx, gzS) - EBASE) * HS;
        var hE = (tE === 'lake' || tE === 'zhaoze') ? waterY : Math.max(0, sampleH(gxE, gz) - EBASE) * HS;
        if (!isW && hS < h01 - 0.05) {
          var bS0 = proj([gx, hS, gzS]), bS1 = proj([gx + 1 / SUB, hS, gzS]);
          ctx.beginPath(); ctx.moveTo(P01[0], P01[1]); ctx.lineTo(P11[0], P11[1]); ctx.lineTo(bS1[0], bS1[1]); ctx.lineTo(bS0[0], bS0[1]); ctx.closePath();
          ctx.fillStyle = shade(base, [0, 0.25, 0.97]); ctx.fill();
        }
        if (!isW && hE < h10 - 0.05) {
          var bE0 = proj([gxE, hE, gz]), bE1 = proj([gxE, hE, gz + 1 / SUB]);
          ctx.beginPath(); ctx.moveTo(P10[0], P10[1]); ctx.lineTo(P11[0], P11[1]); ctx.lineTo(bE1[0], bE1[1]); ctx.lineTo(bE0[0], bE0[1]); ctx.closePath();
          ctx.fillStyle = shade(base, [0.97, 0.25, 0]); ctx.fill();
        }
        /* 顶面 */
        var n = norm([-(h10 - h00 + h11 - h01) * 6, 1 / SUB * 4, -(h01 - h00 + h11 - h10) * 6]);
        ctx.beginPath(); ctx.moveTo(P00[0], P00[1]); ctx.lineTo(P10[0], P10[1]); ctx.lineTo(P11[0], P11[1]); ctx.lineTo(P01[0], P01[1]); ctx.closePath();
        ctx.fillStyle = isW ? 'rgb(72,140,178)' : shade(base, n);
        ctx.fill();
        drawn++;
      }
    }
    var ms = Math.round(performance.now() - t0);
    return { url: cv.toDataURL('image/png'), ms: ms, drawn: drawn };
  }, { w: 1680, h: 1050, focal: 1180, sub: 2 });

  fs.writeFileSync('.workbuddy/shots/terrain3d_full.png', Buffer.from(out.url.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('FULL-3D-DONE drawn=' + out.drawn + ' time=' + out.ms + 'ms');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
