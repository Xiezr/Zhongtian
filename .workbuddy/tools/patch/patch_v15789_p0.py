# -*- coding: utf-8 -*-
"""v15789 P0 · 球体受光化（真地形法线 + 起伏明暗）

病根（本轮取证）：
  buildGlobe 的顶点法线就是「从球心往外的径向」——实测偏离径向 最大 0.02° / 平均 0°。
  法线与地形起伏完全无关 → 山脊与山谷的受光一模一样 → 地形只能靠顶点色区分，
  看起来像"贴了一张地图的纸"。**这也是「换成 Lambert 受光材质也没用」的原因**：
  Lambert 拿径向法线算，只会得到一颗光滑的球，与现有昼夜线是同一个结果。

做法：
  ① 三角面法线（叉积，模长=2×面积 → 天然面积加权）累加到顶点，再按「方向」跨面焊接
     （cube-sphere 六片在公共边上有重复顶点；不焊接会沿六条大圆出现接缝亮/暗线）。
  ② applyTerminator 增加一条"按真法线"的起伏明暗项，**只对球面开**（地块不开）。

落盘纪律：newline=''（防 CRLF 全文件改写）；四段锚点各断言 count==1；写后自检。
"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s, '文件已是 CRLF，先修行尾'
n0 = len(s)

# ---------------- 1) 顶点法线占位 ----------------
old1 = "        nor.push(dx, dy, dz);                              /* 法线=位置方向（球面朝外 · 不受绕向影响）*/"
new1 = (
    "        /* v157.89：**占位** —— 真法线等六个面全建完后统一求（见下方 buildTerrainNormals）。\n"
    "           ⚠️ 改前这里是 `nor.push(dx,dy,dz)`（径向法线）：它与地形起伏完全无关，\n"
    "           实测偏离径向 最大 0.02° / 平均 0° —— 山脊与山谷受光一模一样，\n"
    "           这就是「球体像贴了张地图的纸」的根因，也是「换受光材质也没用」的原因。*/\n"
    "        nor.push(0, 0, 0);"
)
assert s.count(old1) == 1, 'anchor1'
s = s.replace(old1, new1)

# ---------------- 2) 真法线计算块 ----------------
old2 = "    });\n    var geo = new THREE.BufferGeometry();"
new2 = """    });
    /* ============================================================
     * v157.89：**真地形法线**（老板「球体是空壳，可以全填充吗」的续集）
     * ------------------------------------------------------------
     * 取舍说明：原计划是「把 Basic 换成 Lambert 受光材质」，取证后发现那条路会白做 ——
     *   `nor` 全是径向，Lambert 拿径向法线算出来只是**一颗光滑的球**（与现有昼夜线同果），
     *   山脊山谷照样一样亮。真正缺的是「地形法线」；补上它，起伏才有受光。
     *   材质仍留 Basic：场景那四盏灯（太阳 3.2 强度）一旦真正参与，会把整颗球打爆成白，
     *   并连带改变地表建筑/单位的观感 —— 那是另一件事，不在 P0 范围内。
     *
     * 算法：三角面法线（叉积，模长 = 2×面积 → 天然面积加权）累加到顶点；
     *   再按「方向」跨面焊接 —— cube-sphere 六片在公共边上有重复顶点，
     *   不焊接会沿六条大圆出现接缝亮/暗线（正是老板最反感的"色斑"）。
     * ============================================================ */
    (function buildTerrainNormals() {
      var nv = pos.length / 3;
      var acc = new Float32Array(nv * 3), wmap = Object.create(null);
      var vi, k, px, py, pz, L, j3;
      for (vi = 0; vi < nv; vi++) {
        j3 = vi * 3; px = pos[j3]; py = pos[j3 + 1]; pz = pos[j3 + 2];
        L = Math.sqrt(px * px + py * py + pz * pz) || 1;
        k = (px / L).toFixed(5) + ',' + (py / L).toFixed(5) + ',' + (pz / L).toFixed(5);
        if (!wmap[k]) wmap[k] = [];
        wmap[k].push(vi);
      }
      for (var t = 0; t < idx.length; t += 3) {
        var a3 = idx[t] * 3, b3 = idx[t + 1] * 3, c3 = idx[t + 2] * 3;
        var ax = pos[a3], ay = pos[a3 + 1], az = pos[a3 + 2];
        var ux = pos[b3] - ax, uy = pos[b3 + 1] - ay, uz = pos[b3 + 2] - az;
        var vx = pos[c3] - ax, vy = pos[c3 + 1] - ay, vz = pos[c3 + 2] - az;
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        /* 朝外统一：六个面绕向不一致 → 用径向点积定向（与 SP.faceFlipOf 同一约定）*/
        if (nx * ax + ny * ay + nz * az < 0) { nx = -nx; ny = -ny; nz = -nz; }
        acc[a3] += nx; acc[a3 + 1] += ny; acc[a3 + 2] += nz;
        acc[b3] += nx; acc[b3 + 1] += ny; acc[b3 + 2] += nz;
        acc[c3] += nx; acc[c3 + 1] += ny; acc[c3 + 2] += nz;
      }
      var weldN = 0;
      for (var kk in wmap) {
        var list = wmap[kk];
        if (list.length < 2) continue;
        weldN += list.length;
        var sx = 0, sy = 0, sz = 0, q, i2, i3;
        for (q = 0; q < list.length; q++) {
          i2 = list[q] * 3;
          sx += acc[i2]; sy += acc[i2 + 1]; sz += acc[i2 + 2];
        }
        for (q = 0; q < list.length; q++) {
          i3 = list[q] * 3;
          acc[i3] = sx; acc[i3 + 1] = sy; acc[i3 + 2] = sz;
        }
      }
      var devMax = 0, devSum = 0;
      for (var vj = 0; vj < nv; vj++) {
        j3 = vj * 3;
        px = pos[j3]; py = pos[j3 + 1]; pz = pos[j3 + 2];
        L = Math.sqrt(px * px + py * py + pz * pz) || 1;
        var rx = px / L, ry = py / L, rz = pz / L;
        var x2 = acc[j3], y2 = acc[j3 + 1], z2 = acc[j3 + 2];
        var L2 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);
        if (L2 > 1e-9) {
          nor[j3] = x2 / L2; nor[j3 + 1] = y2 / L2; nor[j3 + 2] = z2 / L2;
        } else {
          nor[j3] = rx; nor[j3 + 1] = ry; nor[j3 + 2] = rz;
        }
        var d0 = rx * nor[j3] + ry * nor[j3 + 1] + rz * nor[j3 + 2];
        var ang = Math.acos(Math.max(-1, Math.min(1, d0))) * 180 / Math.PI;
        devSum += ang; if (ang > devMax) devMax = ang;
      }
      /* 自检出口：改前 maxDeg/avgDeg 应恒 0；改后应显著 > 0（法线真随地形走）*/
      M._globeNrmStat = {
        verts: nv, welded: weldN,
        maxDeg: +devMax.toFixed(2), avgDeg: +(devSum / (nv || 1)).toFixed(2)
      };
    })();
    var geo = new THREE.BufferGeometry();"""
assert s.count(old2) == 1, 'anchor2'
s = s.replace(old2, new2)

# ---------------- 3) 阴影 uniform 与强度出口 ----------------
old3 = "  M._termU = { value: 0.45 };"
new3 = ("  M._termU = { value: 0.45 };\n"
        "  /* v157.89：地形起伏明暗的强度（0 = 关 · 1 = 默认）。老板觉得\"不够立体\"就往上给，\n"
        "     觉得\"太脏/太暗\"就往回收 —— 一个数就能调，不必改着色器。*/\n"
        "  M._reliefU = { value: 1.0 };")
assert s.count(old3) == 1, 'anchor3'
s = s.replace(old3, new3)

# ---------------- 4) applyTerminator 增加起伏项 ----------------
old4 = """  function applyTerminator(mat) {
    if (!mat || typeof mat.onBeforeCompile !== 'function') return mat;
    mat.onBeforeCompile = function (sh) {"""
new4 = """  /* v157.89：第二参 `withRelief` = 是否注入"地形起伏明暗"。
     只给球面开（地块/水面/标记物不开）：它们的法线不是地形法线，硬开会把侧面压黑。*/
  function applyTerminator(mat, withRelief) {
    if (!mat || typeof mat.onBeforeCompile !== 'function') return mat;
    var REL = !!withRelief;
    mat.onBeforeCompile = function (sh) {"""
assert s.count(old4) == 1, 'anchor4'
s = s.replace(old4, new4)

old5 = """      sh.vertexShader = 'varying vec3 vWn;\\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\\n  vWn = normalize(mat3(modelMatrix) * position);'
      );
      sh.fragmentShader = 'uniform vec3 uSunDir; uniform float uTerm; varying vec3 vWn;\\n'
        + sh.fragmentShader.replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\\n'
          + '  float _sunL = clamp(dot(normalize(vWn), normalize(uSunDir)), 0.0, 1.0);\\n'
          + '  gl_FragColor.rgb *= (1.0 - uTerm) + uTerm * (0.35 + 0.65 * _sunL);'
        );"""
new5 = """      var _vHead = 'varying vec3 vWn;\\n' + (REL ? 'varying vec3 vNrm;\\n' : '');
      sh.vertexShader = _vHead + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\\n  vWn = normalize(mat3(modelMatrix) * position);'
        + (REL ? '\\n  vNrm = normalize(mat3(modelMatrix) * normal);' : '')
      );
      var _fHead = 'uniform vec3 uSunDir; uniform float uTerm;'
        + (REL ? ' uniform float uRelief; varying vec3 vNrm;' : '') + ' varying vec3 vWn;\\n';
      var _body = '\\n'
        + '  float _sunL = clamp(dot(normalize(vWn), normalize(uSunDir)), 0.0, 1.0);\\n'
        + '  gl_FragColor.rgb *= (1.0 - uTerm) + uTerm * (0.35 + 0.65 * _sunL);';
      if (REL) {
        /* 起伏明暗：用**真地形法线**与太阳夹角，0.70~1.16 的软包裹（无硬阴影）。
           · 只用一次乘，不叠第二套光照；日面仍以 1.0 为基准，不整体提亮。
           · 系数区间刻意不对称（压暗 30%、提亮 16%）：山体"抢眼"但不会把亮色顶爆。*/
        sh.uniforms.uRelief = M._reliefU;
        _body += '\\n'
          + '  float _rel = clamp(dot(normalize(vNrm), normalize(uSunDir)), 0.0, 1.0);\\n'
          + '  gl_FragColor.rgb *= mix(1.0, 0.70 + 0.46 * _rel, uRelief);';
      }
      sh.fragmentShader = _fHead
        + sh.fragmentShader.replace('#include <dithering_fragment>',
            '#include <dithering_fragment>' + _body);"""
assert s.count(old5) == 1, 'anchor5'
s = s.replace(old5, new5)

# ---------------- 5) 球面调用点开起伏 ----------------
old6 = "    applyTerminator(_gmat243);          /* v92.243：太阳方向明暗（昼夜线）*/"
new6 = "    applyTerminator(_gmat243, true);    /* v92.243 昼夜线 + v157.89 地形起伏明暗（仅球面）*/"
assert s.count(old6) == 1, 'anchor6'
s = s.replace(old6, new6)

# ---------------- 6) 强度出口 ----------------
old7 = "  M.setLight = function (opt) {"
new7 = """  /* v157.89：地形起伏明暗强度（0 = 关 · 1 = 默认）。给老板一个"一个数调手感"的出口。*/
  M.setRelief = function (v) {
    var n = (v == null) ? 1 : (Math.max(0, Math.min(1, +v || 0)));
    M._reliefU.value = n;
    return n;
  };
  M.setLight = function (opt) {"""
assert s.count(old7) == 1, 'anchor7'
s = s.replace(old7, new7)

# ---------------- 写盘 + 自检 ----------------
assert s.count('buildTerrainNormals') >= 2, 'block-missing'
assert s.count('_globeNrmStat') >= 1, 'stat-missing'
assert s.count('uRelief') >= 3, 'uniform-missing'
assert len(s) > n0, 'size-not-grown'
assert '\r\n' not in s, 'CRLF introduced'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('PATCHED bytes %d -> %d' % (n0, len(s)))
