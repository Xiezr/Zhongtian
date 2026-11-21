# -*- coding: utf-8 -*-
"""v157.95 · 水球 + 逐像素 discard（治「海面没有厚度 / 持续空洞 / 六边形」）

思路：水面不再由"水格多边形"拼，而是**一颗完整球**；
      片元里查高程图，高程高于水面就 discard。
      ⇒ 海岸线由**像素**决定，几何上不可能有缝、有洞、有格边。

实现：
  1. 烘 1024×512 等距柱状高程图（灰度，e 编码到 0.15±0.15）；
  2. 水面几何 = 半径 1 的球（VS 里本来就用 normalize(position) 重算表面，半径无所谓）；
  3. FS 里按方向查高程，> 水面线就 discard。
"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s
n0 = len(s)

# ---------- 1) 高程图烘焙函数（放在 bakeColorAtlas 之前） ----------
anchor = "  function bakeColorAtlas(N) {"
assert s.count(anchor) == 1, 'a0'
ELEV = '''  /* ============================================================
   * v157.95：**等距柱状高程图**（给水面的逐像素裁剪用）
   * ------------------------------------------------------------
   * 为什么不用立方体图集：得在片元里自己算"哪个面 + 面内 uv"，
   * 六个面的参数化各不相同（有两个是镜像的），写错一个面就多一条接缝 ——
   * 今晚已经在接缝上栽过两次，不再赌这个。
   * 等距柱状只要 atan2/asin 两行，没有面、没有镜像。
   * 编码：v = (e + 0.15) / 0.30，8 位 → 分辨率 ≈ 0.0012 高程 ≈ 0.03 世界单位。
   * ============================================================ */
  function bakeElevTex(W, H) {
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var cx = cv.getContext('2d'); var img = cx.createImageData(W, H); var d = img.data;
    var PI = Math.PI;
    for (var y = 0; y < H; y++) {
      var lat = (0.5 - (y + 0.5) / H) * PI;          /* +π/2 → -π/2（与 uv.y=1 在上一致，配 flipY=false）*/
      var cy0 = Math.cos(lat), sy0 = Math.sin(lat);
      for (var x = 0; x < W; x++) {
        var lon = ((x + 0.5) / W - 0.5) * 2 * PI;
        var dx = cy0 * Math.sin(lon), dy = sy0, dz = cy0 * Math.cos(lon);
        var e = sphElev([dx, dy, dz]);
        var v = (e + 0.15) / 0.30;
        v = v < 0 ? 0 : (v > 1 ? 1 : v);
        var o = (y * W + x) * 4;
        var c = Math.round(v * 255);
        d[o] = c; d[o + 1] = c; d[o + 2] = c; d[o + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;                       /* 上面按"行 = 纬度"算的，不许再翻 */
    tex.wrapS = THREE.RepeatWrapping;        /* 经度环绕 */
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex._shared = true;
    M._elevBakeMs = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0);
    return tex;
  }

''' + anchor
s = s.replace(anchor, ELEV)

# ---------- 2) 常量 ----------
a = "  M._nrmAtlasMs = 0;"
b = """  M._nrmAtlasMs = 0;
  /* v157.95：水球方案 —— 水面 = 整球，海岸线由片元按高程图裁 */
  M.WATER_SPHERE = true;
  M._elevTex = null;
  M._elevTexU = { value: null };
  M._elevBakeMs = 0;
  M.WATERLEVEL = 0.038;      /* 与水面半径 R+1.0 对应的高程（1.0 / HSC）*/"""
assert s.count(a) == 1, 'a1'
s = s.replace(a, b)

assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('step1 elev tex fn, bytes %d -> %d' % (n0, len(s)))
