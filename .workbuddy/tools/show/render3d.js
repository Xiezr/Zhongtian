/* 真·3D 地形渲染（用游戏地图的真实地形数据）
 * 用法：node .workbuddy/tools/show/render3d.js
 * 产出：.workbuddy/shots/terrain3d.png
 * 原理：透视相机 + 高度场 + 坡面法线光照 + 画家算法（软件 3D 光栅化到 canvas 2D）。
 *       低多边形面片风格（像参考图）。只读游戏数据，不改产品代码。
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

  var dataUrl = await p.evaluate(function (o) {
    var G = window.GAME, DATA = G.DATA, grid = G.state.map.grid, seed = G.state.map.seed;
    var Wc = DATA.MAP_W, Hc = DATA.MAP_H;
    function nhash(ix, iy, salt) { var h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x2545f491); h ^= h >>> 13; return (h >>> 8) / 16777216; }
    function vnoise(x, y, step, salt) { var fx = x / step, fy = y / step, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); var a = nhash(ix, iy, salt), b2 = nhash(ix + 1, iy, salt), c = nhash(ix, iy + 1, salt), d = nhash(ix + 1, iy + 1, salt); var t0 = a + (b2 - a) * tx, t1 = c + (d - c) * tx; return t0 + (t1 - t0) * ty; }
    var OCT = [[16, 0.5], [8, 0.3], [4, 0.2]];
    function fbm(x, y, salt) { var v = 0; for (var i = 0; i < OCT.length; i++) v += OCT[i][1] * vnoise(x, y, OCT[i][0], salt + i * 101); return v; }

    /* 找一块起伏最大的区域（不靠城） */
    function regionScore(rx, rz, N) {
      var v = 0, n = 0;
      for (var z = 0; z < N; z += 3) for (var x = 0; x < N; x += 3) {
        var e = fbm(rx + x, rz + z, seed * 7 + 11); v += (e - 0.5) * (e - 0.5); n++;
      }
      return v / n;
    }
    var N = 78, best = null;
    for (var t = 0; t < 60; t++) {
      var rx = 30 + (t * 61) % (Wc - N - 60), rz = 30 + (t * 47) % (Hc - N - 60);
      var s = regionScore(rx, rz, N);
      if (!best || s > best.s) best = { x: rx, z: rz, s: s };
    }
    var x0 = best.x, z0 = best.z;

    /* 高度场（世界单位）*/
    var HS = 15;                                 /* 最高山约 15 单位 */
    function elev(gx, gz) {
      var t = (grid[gz] && grid[gz][gx] && grid[gz][gx].terrain) || 'plain';
      var e = fbm(gx, gz, seed * 7 + 11);
      var h = Math.max(0, e - 0.32) * HS * 1.7;
      if (t === 'hill') h += 3.2;
      if (t === 'forest') h += 0.8;
      if (t === 'lake') h = 0.6;
      if (t === 'zhaoze') h = Math.min(h, 1.0);
      return h;
    }
    /* 地形基色（低多边形平涂 + 光照）*/
    var PAL = { plain: [196, 178, 118], caoyuan: [168, 186, 104], forest: [86, 122, 70], desert: [216, 190, 122], hill: [172, 160, 140], zhaoze: [116, 134, 108], lake: [74, 142, 178], city: [196, 160, 116] };
    function terrainAt(gx, gz) { var t = (grid[gz] && grid[gz][gx] && grid[gz][gx].terrain) || 'plain'; return t; }

    /* ---- 相机 ---- */
    var cvW = 1280, cvH = 720;
    var cxw = x0 + N / 2, czw = z0 + N / 2;
    var lookY = 4, camH = 46, camDist = 52;
    var camPos = [cxw, camH, czw + camDist];
    var lookAt = [cxw, lookY, czw];
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
    function sub(a, c) { return [a[0] - c[0], a[1] - c[1], a[2] - c[2]]; }
    function cross(a, c) { return [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]]; }
    function dot(a, c) { return a[0] * c[0] + a[1] * c[1] + a[2] * c[2]; }
    var fwd = norm(sub(lookAt, camPos));
    var right = norm(cross(fwd, [0, 1, 0]));
    var up = cross(right, fwd);
    var focal = 900;
    function proj(P) {
      var rel = sub(P, camPos);
      var d = dot(rel, fwd);
      var sx = cvW / 2 + dot(rel, right) * focal / d;
      var sy = cvH / 2 - dot(rel, up) * focal / d;
      return [sx, sy, d];
    }
    /* 光照：方向光（左上前方） */
    var L = norm([-0.55, 0.7, 0.45]);
    function shade(rgb, nx, ny, nz) {
      var lam = Math.max(0.22, dot([nx, ny, nz], L));
      var amb = 0.42;
      var k = amb + lam * 0.85;
      return 'rgb(' + Math.min(255, rgb[0] * k | 0) + ',' + Math.min(255, rgb[1] * k | 0) + ',' + Math.min(255, rgb[2] * k | 0) + ')';
    }

    var cv = document.createElement('canvas'); cv.width = cvW; cv.height = cvH;
    var ctx = cv.getContext('2d');
    /* 天空 */
    var sky = ctx.createLinearGradient(0, 0, 0, cvH);
    sky.addColorStop(0, '#9fc3dd'); sky.addColorStop(0.55, '#cfe0e8'); sky.addColorStop(1, '#e8e2d2');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, cvW, cvH);

    /* 收集格，按深度从远到近（画家算法） */
    var cells = [];
    for (var gz2 = 0; gz2 < N; gz2++) for (var gx2 = 0; gx2 < N; gx2++) {
      var gx = x0 + gx2, gz = z0 + gz2;
      var h = elev(gx, gz);
      cells.push({ gx: gx, gz: gz, h: h, t: terrainAt(gx, gz) });
    }
    cells.sort(function (A, B) {
      var dA = dot(sub([A.gx + 0.5, A.h, A.gz + 0.5], camPos), fwd);
      var dB = dot(sub([B.gx + 0.5, B.h, B.gz + 0.5], camPos), fwd);
      return dB - dA;                      /* 远（大 depth）先画 */
    });

    var waterY = 0.8;
    cells.forEach(function (c) {
      var isWater = (c.t === 'lake');
      var h = isWater ? waterY : c.h;
      var x = c.gx, z = c.gz;
      var yTL = isWater ? waterY : c.h, yTR = yTL, yBR = yTR, yBL = yTL;
      /* 四角（平滑：取角点邻近高度平均，做出坡面）*/
      var c00 = isWater ? waterY : (elev(x, z) + elev(x + 1, z) + elev(x, z + 1) + elev(x + 1, z + 1)) / 4;
      var hTop = isWater ? waterY : c.h;
      var base = PAL[c.t] || PAL.plain;
      /* 顶面四角世界点 */
      var P00 = proj([x, hTop, z]), P10 = proj([x + 1, hTop, z]), P11 = proj([x + 1, hTop, z + 1]), P01 = proj([x, hTop, z + 1]);
      if (P00[2] <= 0.2 && P10[2] <= 0.2 && P11[2] <= 0.2 && P01[2] <= 0.2) return;
      /* 崖壁（朝南 / 朝东 且邻居更低）*/
      var hS = isWater ? -1 : elev(x, z + 1);
      var hE = isWater ? -1 : elev(x + 1, z);
      if (!isWater && hS < c.h - 0.05) {
        var b00 = proj([x, hS, z + 1]), b10 = proj([x + 1, hS, z + 1]);
        ctx.beginPath(); ctx.moveTo(P01[0], P01[1]); ctx.lineTo(P11[0], P11[1]); ctx.lineTo(b10[0], b10[1]); ctx.lineTo(b00[0], b00[1]); ctx.closePath();
        ctx.fillStyle = shade(base, 0, 0.2, 1); ctx.fill();     /* 南立面 */
      }
      if (!isWater && hE < c.h - 0.05) {
        var b11 = proj([x + 1, hE, z + 1]), b10b = proj([x + 1, hE, z]);
        ctx.beginPath(); ctx.moveTo(P10[0], P10[1]); ctx.lineTo(P11[0], P11[1]); ctx.lineTo(b11[0], b11[1]); ctx.lineTo(b10b[0], b10b[1]); ctx.closePath();
        ctx.fillStyle = shade(base, 1, 0.2, 0); ctx.fill();     /* 东立面 */
      }
      /* 顶面：法线由高度梯度近似 */
      var dhx = (elev(x + 1, z) - elev(x - 1, z)) * 0.5;
      var dhz = (elev(x, z + 1) - elev(x, z - 1)) * 0.5;
      var nrm = norm([-dhx * 0.32, 1, -dhz * 0.32]);
      ctx.beginPath(); ctx.moveTo(P00[0], P00[1]); ctx.lineTo(P10[0], P10[1]); ctx.lineTo(P11[0], P11[1]); ctx.lineTo(P01[0], P01[1]); ctx.closePath();
      if (isWater) {
        ctx.fillStyle = 'rgb(74,142,178)'; ctx.fill();
      } else {
        ctx.fillStyle = shade(base, nrm[0], nrm[1], nrm[2]); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = 0.4; ctx.stroke();   /* 极淡接缝，保留低多边形质感 */
      }
    });

    return cv.toDataURL('image/png');
  }, {});

  fs.writeFileSync('.workbuddy/shots/terrain3d.png', Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('3D-DONE');
  await b.close();
})().catch(function (e) { console.error('ERR', e && (e.stack || e.message)); process.exit(1); });
