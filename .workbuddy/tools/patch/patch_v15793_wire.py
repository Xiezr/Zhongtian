# -*- coding: utf-8 -*-
"""v157.93 第二步：把图集接进去
  · 顶点色退化成"明暗系数"（默认 1）；颜色改由图集在片元里采样
  · 每个顶点带 aFace（0..5），片元按 4×4 格偏移算图集 uv
  · paintGlobeExplore 改成写系数（不再写 基色×系数）
"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s
n0 = len(s)

# ---------- 1) 顶点循环：颜色存系数 + 记录面号 ----------
old1 = """        var c = sphBiome(e, dy, [dx, dy, dz], true);
        col.push(c[0] / 255, c[1] / 255, c[2] / 255);"""
new1 = """        var c = sphBiome(e, dy, [dx, dy, dz], true);
        /* v157.93：走图集时顶点色只存**明暗系数**（默认 1），颜色由片元采样图集；
           图集不可用（烘焙失败/被关）则退回原样存基色。 */
        if (M.useColorAtlas) { col.push(1, 1, 1); facA.push(fi); }
        else { col.push(c[0] / 255, c[1] / 255, c[2] / 255); facA.push(0); }"""
assert s.count(old1) == 1, 'a1'
s = s.replace(old1, new1)

# ---------- 2) 声明 facA ----------
old2 = "    var pos = [], col = [], nor = [], idx = [], uv = [];"
new2 = "    var pos = [], col = [], nor = [], idx = [], uv = [], facA = [];"
assert s.count(old2) == 1, 'a2'
s = s.replace(old2, new2)

# ---------- 3) 属性落地 ----------
old3 = "    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));"
new3 = ("    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));\n"
        "    /* v157.93：立方体面号（片元按它偏移到图集对应格）*/\n"
        "    geo.setAttribute('aFace', new THREE.Float32BufferAttribute(facA, 1));")
assert s.count(old3) == 1, 'a3'
s = s.replace(old3, new3)

# ---------- 4) 烘焙图集（建完球、算完法线之后） ----------
old4 = "    M._globeMat = globe.material;"
new4 = """    /* v157.93：烘地貌配色图集（一次性；耗时写进 M._colAtlasMs 供探针）*/
    if (M.useColorAtlas) {
      try {
        var _ct = bakeColorAtlas(+M.COLOR_ATLAS_N || 256);
        if (_ct) { M._colTex = _ct; if (M.applyColorAtlas) M.applyColorAtlas(); }
      } catch (eCT) { M._colTex = null; }
    }
    M._globeMat = globe.material;"""
assert s.count(old4) == 1, 'a4'
s = s.replace(old4, new4)

# ---------- 5) paintGlobeExplore 写系数 ----------
old5 = """      var i3 = i * 3;
      if (k === 1) {
        arr[i3] = base[i3]; arr[i3 + 1] = base[i3 + 1]; arr[i3 + 2] = base[i3 + 2];
      } else {
        arr[i3] = Math.min(1, base[i3] * k);
        arr[i3 + 1] = Math.min(1, base[i3 + 1] * k);
        arr[i3 + 2] = Math.min(1, base[i3 + 2] * k);
      }"""
new5 = """      var i3 = i * 3;
      if (M.useColorAtlas && M._colTex) {
        /* v157.93：颜色由图集提供 → 顶点色只承载**系数**（1.15 提亮 / 0.90 压暗）*/
        arr[i3] = k; arr[i3 + 1] = k; arr[i3 + 2] = k;
      } else if (k === 1) {
        arr[i3] = base[i3]; arr[i3 + 1] = base[i3 + 1]; arr[i3 + 2] = base[i3 + 2];
      } else {
        arr[i3] = Math.min(1, base[i3] * k);
        arr[i3 + 1] = Math.min(1, base[i3 + 1] * k);
        arr[i3 + 2] = Math.min(1, base[i3 + 2] * k);
      }"""
assert s.count(old5) == 1, 'a5'
s = s.replace(old5, new5)

assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('step2 wired, bytes %d -> %d' % (n0, len(s)))
