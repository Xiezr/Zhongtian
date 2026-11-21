# -*- coding: utf-8 -*-
"""v157.94 A 方案：明暗也搬到逐像素（烘法线图集）

背景：老板「为什么之前没有这个问题」→ 实测证明**是我加的逐顶点起伏明暗把格子显形了**：
同视角关掉起伏，色块边界立刻变柔和。所以要保留立体感、又不能有格子感，只能把明暗也做成逐像素。

做法：
  · 烘配色图集时**顺手把高度场 h 存下来**（同一批 sphElev，不额外采样）；
  · 再由 h 的差分算**物体空间法线**（切向基用面函数解析求，纯算术，不调 sphElev）；
  · 曲率遮蔽也一起烘进 alpha —— 于是"明暗 + 曲率"两件事都逐像素，彻底脱离网格密度。

编码：RGBA = (N*0.5+0.5, shade 归一化到 0.74~1.06)。
成本：复用 h → 烘焙只多一点点算术，不会翻倍。
"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s
n0 = len(s)

# ---------- 1) 常量 ----------
old1 = "  M._colAtlasMs = 0;        /* 烘焙耗时（探针/断言）*/"
new1 = """  M._colAtlasMs = 0;        /* 烘焙耗时（探针/断言）*/
  M.RELIEF_TEX = true;      /* v157.94：明暗走**逐像素法线图集**（关掉则退回逐顶点 vNrm，保命/对照）*/
  M._nrmTex = null;         /* 法线+曲率图集：RGB=法线(编码) A=曲率遮蔽 */
  M._nrmTexU = { value: null };
  M._nrmAtlasMs = 0;"""
assert s.count(old1) == 1, 'a1'
s = s.replace(old1, new1)

# ---------- 2) 烘焙：先存 h，再算法线与曲率 ----------
old2 = """    var A = 4 * N;
    var cv = document.createElement('canvas'); cv.width = A; cv.height = A;
    var cx = cv.getContext('2d'); var img = cx.createImageData(A, A);
    var d = img.data;"""
new2 = """    var A = 4 * N;
    var cv = document.createElement('canvas'); cv.width = A; cv.height = A;
    var cx = cv.getContext('2d'); var img = cx.createImageData(A, A);
    var d = img.data;
    /* v157.94：法线图集（与配色同布局）*/
    var ncv = document.createElement('canvas'); ncv.width = A; ncv.height = A;
    var ncx = ncv.getContext('2d'); var nimg = ncx.createImageData(A, A);
    var nd = nimg.data;
    /* 每面高度场（先存下来，法线用差分求；避免重复调 sphElev）*/
    var hArr = new Float32Array(N * N);"""
assert s.count(old2) == 1, 'a2'
s = s.replace(old2, new2)

old3 = """          var e = sphElev([dx, dy, dz]);
          var c = sphBiome(e, dy, [dx, dy, dz], true);
          var o = ((oy + y) * A + (ox + x)) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;"""
new3 = """          var e = sphElev([dx, dy, dz]);
          var c = sphBiome(e, dy, [dx, dy, dz], true);
          var o = ((oy + y) * A + (ox + x)) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
          hArr[y * N + x] = Math.max(0, e) * HSC;      /* 世界单位的相对高度 */"""
assert s.count(old3) == 1, 'a3'
s = s.replace(old3, new3)

# ---------- 3) 每面烘完：由 h 求法线 + 曲率，写进 nd ----------
old4 = """          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
          hArr[y * N + x] = Math.max(0, e) * HSC;      /* 世界单位的相对高度 */
        }
      }
    }"""
new4 = """          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
          hArr[y * N + x] = Math.max(0, e) * HSC;      /* 世界单位的相对高度 */
        }
      }
      /* ---- 由 h 求物体空间法线（差分）与曲率遮蔽，写进法线图集 ---- */
      var du = 2 / N;                                  /* 参数步长 */
      for (var yy = 0; yy < N; yy++) {
        for (var xx = 0; xx < N; xx++) {
          var xm = (xx - 1 + N) % N, xp = (xx + 1) % N;
          var ym = (yy - 1 + N) % N, yp = (yy + 1) % N;
          var hC = hArr[yy * N + xx];
          var dhdu = (hArr[yy * N + xp] - hArr[yy * N + xm]) / (2 * du);
          var dhdv = (hArr[yp * N + xx] - hArr[ym * N + xx]) / (2 * du);
          /* 该点方向与切向基（面函数解析求，纯算术）*/
          var uu = -1 + 2 * (xx + 0.5) / N, vv = -1 + 2 * (yy + 0.5) / N;
          var pC = fn(uu, vv);
          var lC = Math.sqrt(pC[0] * pC[0] + pC[1] * pC[1] + pC[2] * pC[2]) || 1;
          var rx = pC[0] / lC, ry = pC[1] / lC, rz = pC[2] / lC;
          var eps = 1e-3;
          var pU = fn(uu + eps, vv), pV = fn(uu, vv + eps);
          var Tux = pU[0] / (Math.sqrt(pU[0] * pU[0] + pU[1] * pU[1] + pU[2] * pU[2]) || 1) - rx;
          var Tuy = pU[1] / (Math.sqrt(pU[0] * pU[0] + pU[1] * pU[1] + pU[2] * pU[2]) || 1) - ry;
          var Tuz = pU[2] / (Math.sqrt(pU[0] * pU[0] + pU[1] * pU[1] + pU[2] * pU[2]) || 1) - rz;
          var Tvx = pV[0] / (Math.sqrt(pV[0] * pV[0] + pV[1] * pV[1] + pV[2] * pV[2]) || 1) - rx;
          var Tvy = pV[1] / (Math.sqrt(pV[0] * pV[0] + pV[1] * pV[1] + pV[2] * pV[2]) || 1) - ry;
          var Tvz = pV[2] / (Math.sqrt(pV[0] * pV[0] + pV[1] * pV[1] + pV[2] * pV[2]) || 1) - rz;
          /* 曲面切向 ≈ R·T + r·(dh/du)：高度远小于半径，取一阶近似 */
          var Pux = R * Tux + rx * dhdu, Puy = R * Tuy + ry * dhdu, Puz = R * Tuz + rz * dhdu;
          var Pvx = R * Tvx + rx * dhdv, Pvy = R * Tvy + ry * dhdv, Pvz = R * Tvz + rz * dhdv;
          var nx = Puy * Pvz - Puz * Pvy, ny = Puz * Pvx - Pux * Pvz, nz = Pux * Pvy - Puy * Pvx;
          var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
          if (nx * rx + ny * ry + nz * rz < 0) { nx = -nx; ny = -ny; nz = -nz; }
          /* 曲率遮蔽：与顶点版同一口径（谷地暗、山脊微亮），只是这里逐纹素 */
          var lap = hC - (hArr[yy * N + xp] + hArr[yy * N + xm] + hArr[yp * N + xx] + hArr[ym * N + xx]) / 4;
          var sh = 1 + lap * (M.CURV_K == null ? 0.18 : M.CURV_K);
          if (sh < 0.74) sh = 0.74; else if (sh > 1.06) sh = 1.06;
          var no = ((oy + yy) * A + (ox + xx)) * 4;
          nd[no] = Math.round((nx * 0.5 + 0.5) * 255);
          nd[no + 1] = Math.round((ny * 0.5 + 0.5) * 255);
          nd[no + 2] = Math.round((nz * 0.5 + 0.5) * 255);
          nd[no + 3] = Math.round(((sh - 0.74) / 0.32) * 255);
        }
      }
    }"""
assert s.count(old4) == 1, 'a4'
s = s.replace(old4, new4)

# ---------- 4) 生成法线纹理 ----------
old5 = """    M._colAtlasErr = 'ok';
    M._colAtlasKey = _key;"""
new5 = """    ncx.putImageData(nimg, 0, 0);
    var ntex = new THREE.CanvasTexture(ncv);
    ntex.flipY = false;
    ntex.wrapS = ntex.wrapT = THREE.ClampToEdgeWrapping;
    ntex.minFilter = THREE.LinearMipmapLinearFilter;
    ntex.magFilter = THREE.LinearFilter;
    ntex.generateMipmaps = true;
    try { ntex.anisotropy = 8; } catch (eN2) { }
    ntex._shared = true;
    M._nrmTex = ntex;
    if (M._nrmTexU) M._nrmTexU.value = ntex;
    M._nrmAtlasMs = M._colAtlasMs;
    M._colAtlasErr = 'ok';
    M._colAtlasKey = _key;"""
assert s.count(old5) == 1, 'a5'
s = s.replace(old5, new5)

assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('normal atlas baked in, bytes %d -> %d' % (n0, len(s)))
