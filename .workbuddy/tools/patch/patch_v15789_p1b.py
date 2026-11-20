# -*- coding: utf-8 -*-
"""v157.89d：修 P1 的**规则网点**（老板截图「有斑纹」）

根因（双确认：我的 3 倍放大 + 老板截图同型）：
  ① 原贴图 384² 是**非二次幂**，WebGL1 下 mipmap / RepeatWrapping 会退化 → 高 repeat 时出摩尔纹；
  ② 噪声只有 8/16/32 三个**规整格**，格点在高倍放大下就是一个等间距点阵。
两件事叠在一起，近景看到的就是"整齐的小圆点"。

修法：
  ① 512²（POT）→ mipmap 正常，远景自动平滑、近景不摩尔；
  ② 互质格 6/15/37（不对齐）+ **域扭曲**（低频场推移采样坐标）打散残余格纹；
  ③ repeat 改成 **uniform**，可运行时扫参，不必重建包。
"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s
n0 = len(s)

# ---------- 1) 新增颗粒贴图生成器 ----------
anchor = "  /* cube-sphere 地形（**球面原生噪声 · 连续无缝**）：顶点全球均匀，地形直接在球面生成。*/"
assert s.count(anchor) == 1, 'anchor-gen'
NEW_FN = """  /* ============================================================
   * v157.89d：**颗粒高度场**（修 P1 的规则网点）
   * ------------------------------------------------------------
   * 老板截图「有斑纹」= 近景一片等间距小圆点。两个成因叠加：
   *   ① 原贴图 384² **非二次幂** —— WebGL1 下 mipmap / RepeatWrapping 退化，
   *      高 repeat（96）时出摩尔纹（规则点阵的典型形态）；
   *   ② 噪声只有 8/16/32 三个**规整格**，格点本身就是等间距的。
   * 修法：512²（POT）+ 互质格 6/15/37 + 域扭曲（低频场推移采样坐标）。
   * 这张图**只给法线用**，颜色仍用原来那张（不改变地形配色）。
   * ============================================================ */
  function makeGrainTex() {
    if (_dtCache.grain) return _dtCache.grain;
    var N = 512;
    function lattice(g, salt) {
      var a = new Float32Array(g * g);
      for (var i = 0; i < g * g; i++) a[i] = h3(i % g, (i / g) | 0, salt, 17);
      return a;
    }
    var W = lattice(5, 91), L6 = lattice(6, 71), L15 = lattice(15, 72), L37 = lattice(37, 73);
    function samp(A, g, x, y) {
      var gx = x * g, gy = y * g, x0 = Math.floor(gx), y0 = Math.floor(gy);
      var fx = gx - x0, fy = gy - y0;
      var x1 = (x0 + 1) % g, y1 = (y0 + 1) % g;
      var x0m = ((x0 % g) + g) % g, y0m = ((y0 % g) + g) % g;
      var v00 = A[y0m * g + x0m], v10 = A[y0m * g + x1], v01 = A[y1 * g + x0m], v11 = A[y1 * g + x1];
      var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      var t = v00 + (v10 - v00) * u, b = v01 + (v11 - v01) * u;
      return t + (b - t) * v;
    }
    var cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    var cx = cv.getContext('2d'); var img = cx.createImageData(N, N);
    for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) {
      var u = xx / N, v = yy / N;
      /* 域扭曲：低频场把采样坐标推开 ±6% 个格 —— 格点被揉散，不再等间距 */
      var wx = (samp(W, 5, u, v) - 0.5) * 0.12;
      var wy = (samp(W, 5, u + 0.37, v + 0.61) - 0.5) * 0.12;
      var n = samp(L6, 6, u + wx, v + wy) * 0.50
            + samp(L15, 15, u + wx * 1.8, v + wy * 1.8) * 0.32
            + samp(L37, 37, u + wx * 2.6, v + wy * 2.6) * 0.18;
      var c = Math.round((0.35 + n * 0.30) * 255);
      var o = (yy * N + xx) * 4;
      img.data[o] = c; img.data[o + 1] = c; img.data[o + 2] = c; img.data[o + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 4;
    t._shared = true;
    _dtCache.grain = t;
    return t;
  }
  M.GRAIN_N = 512;

""" + anchor
s = s.replace(anchor, NEW_FN)

# ---------- 2) 用颗粒图替掉细节图当高度场 ----------
old2 = "      if (M._detailTexU) M._detailTexU.value = dtex;"
new2 = """      /* v157.89d：高度场换成 512² 颗粒图（原来复用颜色细节图 → 规则网点）*/
      if (M._detailTexU) { try { M._detailTexU.value = makeGrainTex(); } catch (eG) { M._detailTexU.value = dtex; } }"""
assert s.count(old2) == 1, 'anchor-tex'
s = s.replace(old2, new2)

# ---------- 3) repeat 改 uniform ----------
old3 = "        + (REL ? ('\\n  vNrm = normalize(mat3(modelMatrix) * normal);\\n  vShade = aShade;'\n                  + '\\n  vDUv = uv * ' + _dRep.toFixed(1) + ';') : '')"
new3 = "        + (REL ? ('\\n  vNrm = normalize(mat3(modelMatrix) * normal);\\n  vShade = aShade;'\n                  + '\\n  vDUv = uv * uDetRep;') : '')"
assert s.count(old3) == 1, 'anchor-vduv'
s = s.replace(old3, new3)

# 顶点头加 uniform 声明
old4 = "        + (REL ? 'attribute float aShade;\\nvarying vec3 vNrm;\\nvarying float vShade;\\nvarying vec2 vDUv;\\n' : '');"
new4 = "        + (REL ? 'attribute float aShade;\\nuniform float uDetRep;\\nvarying vec3 vNrm;\\nvarying float vShade;\\nvarying vec2 vDUv;\\n' : '');"
assert s.count(old4) == 1, 'anchor-vhead'
s = s.replace(old4, new4)

# 片元头加 uniform
old5 = "                  + ' uniform sampler2D uDetailTex; uniform float uDetail; uniform float uDetAmp; varying vec2 vDUv;') : '')"
new5 = "                  + ' uniform sampler2D uDetailTex; uniform float uDetail; uniform float uDetAmp; uniform float uDetRep; varying vec2 vDUv;') : '')"
assert s.count(old5) == 1, 'anchor-fhead'
s = s.replace(old5, new5)

# 步长按新贴图尺寸与 uniform 算
old6 = "          + '  float _e = ' + (1.6 * _dRep / 384).toFixed(6) + ';\\n'"
new6 = "          + '  float _e = 1.6 * uDetRep / 512.0;\\n'"
assert s.count(old6) == 1, 'anchor-step'
s = s.replace(old6, new6)

# 绑定 uniform
old7 = "        sh.uniforms.uDetAmp = M._detailAmpU;"
new7 = "        sh.uniforms.uDetAmp = M._detailAmpU;\n        sh.uniforms.uDetRep = M._detRepU;"
assert s.count(old7) == 1, 'anchor-bind'
s = s.replace(old7, new7)

# ---------- 4) 常量与出口 ----------
old8 = "  M.DETAIL_REPEAT = 96;              /* uv 放大倍数（编译期写进着色器；近景颗粒尺度由它定）*/"
new8 = """  M.DETAIL_REPEAT = 40;              /* uv 放大倍数（默认值；v157.89d 起走 uniform，可运行时改）*/
  M._detRepU = { value: 40 };        /* 运行时出口：M.setGrainRep(v) */
  M.setGrainRep = function (v) {
    var n = (v == null) ? 40 : Math.max(4, Math.min(200, +v || 40));
    M._detRepU.value = n; M.DETAIL_REPEAT = n;
    return n;
  };"""
assert s.count(old8) == 1, 'anchor-const'
s = s.replace(old8, new8)

assert s.count('makeGrainTex') >= 2, 'gen-missing'
assert s.count('uDetRep') >= 5, 'uniform-missing'
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('PATCHED-D bytes %d -> %d' % (n0, len(s)))
