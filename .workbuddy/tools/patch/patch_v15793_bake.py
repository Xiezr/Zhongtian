# -*- coding: utf-8 -*-
"""v157.93 B 方案：地貌配色改**逐像素**（烘 6 面颜色图集）

为什么：K=128 时顶点间距 3.7 单位、地块直径 ~7 单位 → **每格只有约 2 个顶点**，
色块边界最多 1~2 个顶点过渡，必然呈六边形台阶（实测把混合带宽 0.34→0.10 画面无变化）。

做法：
  · 烘一张 4N×4N 的图集（4×4 格、用 6 格），每格 N² = 一个立方体面的地貌配色；
    逐纹素用 `sphBiome(e, dy, dir, true)` 求色（与顶点同一条出口，不另写一套）。
  · 顶点色从"基色"退化成**明暗系数**（已探索 ×1.15 / 未探索 ×0.90），
    片元里 `色 = 图集 × 顶点系数` —— 已探索提亮机制原样保留。
  · `M.COLOR_ATLAS_N` 控制精度；`M.useColorAtlas=false` 可一键退回顶点色（A/B 与保命）。

⚠️ CanvasTexture 默认 flipY=true（canvas 第 0 行 → uv.y=1）。我们按行序烘，
   所以显式 `flipY=false`，让 canvas 第 0 行 = uv.y=0 = j=0（与 buildGlobe 的 uv 一致）。
"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s
n0 = len(s)

# ---------------- 1) 常量 ----------------
old1 = "  M._detailTexU = { value: null };   /* 指向 makeGrainTex('n') 高度场（颜色图走 'c'，两个缓存 key）*/"
new1 = """  M._detailTexU = { value: null };   /* 指向 makeGrainTex('n') 高度场（颜色图走 'c'，两个缓存 key）*/
  /* v157.93：**逐像素地貌配色**（B 方案）—— 颜色改由图集采样，不再吃顶点密度。
     每面 N² 个纹素：N=256 → 纹素 1.84 单位（顶点是 3.7，即 2 倍精度）；N=512 → 0.92 单位（4 倍）。*/
  M.COLOR_ATLAS_N = 256;
  M.useColorAtlas = true;
  M._colTex = null;         /* 烘好的图集（Texture）*/
  M._colAtlasMs = 0;        /* 烘焙耗时（探针/断言）*/"""
assert s.count(old1) == 1, 'a1'
s = s.replace(old1, new1)

# ---------------- 2) 烘焙函数（放在 buildGlobe 之前） ----------------
old2 = "  /* cube-sphere 地形（**球面原生噪声 · 连续无缝**）：顶点全球均匀，地形直接在球面生成。*/"
new2 = """  /* ============================================================
   * v157.93：烘焙地貌配色图集（B 方案）
   * ------------------------------------------------------------
   * 逐纹素调用 `sphBiome(e, dy, dir, true)` —— 与顶点用的是**同一条出口**，
   * 所以色带、湖泊深度、高频细节全都在，不存在"两套配色"漂移。
   * 图集：4×4 格（只填前 6 格），整张 4N×4N 是二次幂（N=256→1024，N=512→2048），
   * mipmap 正常，不会再踩 v157.89d 那个 NPOT 的坑。
   * ============================================================ */
  function bakeColorAtlas(N) {
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var F = (SP && SP.CUBE_FACES) ? SP.CUBE_FACES : null;
    if (!F || F.length < 6) return null;
    var A = 4 * N;
    var cv = document.createElement('canvas'); cv.width = A; cv.height = A;
    var cx = cv.getContext('2d'); var img = cx.createImageData(A, A);
    var d = img.data;
    var seeded = seed3 ? seed3() : 0, P = (SP && SP.PLANET) ? SP.PLANET : {};
    for (var fi = 0; fi < 6; fi++) {
      var ox = (fi % 4) * N, oy = ((fi / 4) | 0) * N, fn = F[fi];
      for (var y = 0; y < N; y++) {
        var v = -1 + 2 * (y + 0.5) / N;
        for (var x = 0; x < N; x++) {
          var u = -1 + 2 * (x + 0.5) / N;
          var p = fn(u, v);
          var L = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1;
          var dx = p[0] / L, dy = p[1] / L, dz = p[2] / L;
          var e = sphElev([dx, dy, dz]);
          var c = sphBiome(e, dy, [dx, dy, dz], true);
          var o = ((oy + y) * A + (ox + x)) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
    }
    cx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;                        /* 关键：按行序烘 → 不许再翻 */
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    try { tex.anisotropy = 8; } catch (eA) { }
    tex._shared = true;
    M._colAtlasMs = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0);
    return tex;
  }

""" + old2
assert s.count(old2) == 1, 'a2'
s = s.replace(old2, new2)

assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('step1 baked fn, bytes %d -> %d' % (n0, len(s)))
