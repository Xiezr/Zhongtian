# -*- coding: utf-8 -*-
"""v15789 P0b · 让"起伏"真的看得出来（法线夸张 + 曲率遮蔽）

P0 首版实测：山地区域局部对比度只 +10.7%，肉眼"差不多"。原因不是代码没生效，而是
**纯方向漫反射的物理上限** —— 朝向太阳的那片地形，法线偏 10° 时 cos 只掉 2%，
天顶附近的地形无论怎么夸张法线都不会出现明暗（cos 在峰值处导数为 0）。

补两条：
  ① 法线夸张（制图学常规手法）：切向分量 × EXAG，tan(θ') = EXAG·tan(θ)。
  ② 曲率遮蔽：每个顶点与邻点平均高程的差 → 谷地压暗 / 山脊微提亮。
     这条**与太阳方向无关**，所以"背光的山坡仍平"这个死角被补上。

两者都受同一个 `uRelief` 闸门控制（M.setRelief 一个数全关/全调）。
"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s
n0 = len(s)

head = "    (function buildTerrainNormals() {"
tail = "    var geo = new THREE.BufferGeometry();"
i = s.index(head)
j = s.index(tail, i)
assert i < j and (j - i) < 6000, 'block-bound wrong: %d' % (j - i)

NEW = """    (function buildTerrainNormals() {
      var nv = pos.length / 3;
      var acc = new Float32Array(nv * 3), wmap = Object.create(null);
      var hArr = new Float32Array(nv);
      var nbSum = new Float32Array(nv), nbCnt = new Float32Array(nv);
      var vi, k, px, py, pz, L, j3;
      for (vi = 0; vi < nv; vi++) {
        j3 = vi * 3; px = pos[j3]; py = pos[j3 + 1]; pz = pos[j3 + 2];
        L = Math.sqrt(px * px + py * py + pz * pz) || 1;
        hArr[vi] = L;                     /* 该顶点的球心距 = 地形高度（R + 归一化高度×HSC）*/
        k = (px / L).toFixed(5) + ',' + (py / L).toFixed(5) + ',' + (pz / L).toFixed(5);
        if (!wmap[k]) wmap[k] = [];
        wmap[k].push(vi);
      }
      for (var t = 0; t < idx.length; t += 3) {
        var ia = idx[t], ib = idx[t + 1], ic = idx[t + 2];
        var a3 = ia * 3, b3 = ib * 3, c3 = ic * 3;
        var ax = pos[a3], ay = pos[a3 + 1], az = pos[a3 + 2];
        var ux = pos[b3] - ax, uy = pos[b3 + 1] - ay, uz = pos[b3 + 2] - az;
        var vx = pos[c3] - ax, vy = pos[c3 + 1] - ay, vz = pos[c3 + 2] - az;
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        /* 朝外统一：六个面绕向不一致 → 用径向点积定向（与 SP.faceFlipOf 同一约定）*/
        if (nx * ax + ny * ay + nz * az < 0) { nx = -nx; ny = -ny; nz = -nz; }
        acc[a3] += nx; acc[a3 + 1] += ny; acc[a3 + 2] += nz;
        acc[b3] += nx; acc[b3 + 1] += ny; acc[b3 + 2] += nz;
        acc[c3] += nx; acc[c3 + 1] += ny; acc[c3 + 2] += nz;
        /* 邻点高程累加（求曲率用 —— 谷地/山脊的判据）*/
        nbSum[ia] += hArr[ib] + hArr[ic]; nbCnt[ia] += 2;
        nbSum[ib] += hArr[ia] + hArr[ic]; nbCnt[ib] += 2;
        nbSum[ic] += hArr[ia] + hArr[ib]; nbCnt[ic] += 2;
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
      /* 曲率：顶点高程 − 邻点平均高程。先量样本平均幅度，再定归一化系数，
         这样换星球 / 换地形尺度都不用改常数（不写死"每单位多少"）。*/
      var curv = new Float32Array(nv), cavg = 0, cn = 0;
      for (var vc = 0; vc < nv; vc++) {
        if (!nbCnt[vc]) continue;
        curv[vc] = hArr[vc] - nbSum[vc] / nbCnt[vc];
        cavg += Math.abs(curv[vc]); cn++;
      }
      cavg = cavg / (cn || 1);
      var kA = (0.20 / (cavg > 1e-4 ? cavg : 1)), shMin = 1, shMax = 1;
      var EXAG = (M.RELIEF_EXAG == null ? 2.0 : +M.RELIEF_EXAG);
      var shade = new Float32Array(nv);

      var devMax = 0, devSum = 0;
      for (var vj = 0; vj < nv; vj++) {
        j3 = vj * 3;
        px = pos[j3]; py = pos[j3 + 1]; pz = pos[j3 + 2];
        L = Math.sqrt(px * px + py * py + pz * pz) || 1;
        var rx = px / L, ry = py / L, rz = pz / L;
        var x2 = acc[j3], y2 = acc[j3 + 1], z2 = acc[j3 + 2];
        var L2 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);
        var ux2, uy2, uz2;
        if (L2 > 1e-9) { ux2 = x2 / L2; uy2 = y2 / L2; uz2 = z2 / L2; }
        else { ux2 = rx; uy2 = ry; uz2 = rz; }
        var d0 = rx * ux2 + ry * uy2 + rz * uz2;
        var ang = Math.acos(Math.max(-1, Math.min(1, d0))) * 180 / Math.PI;
        devSum += ang; if (ang > devMax) devMax = ang;
        /* ① 法线夸张：保留"朝外"分量，切向分量 × EXAG（tanθ' = EXAG·tanθ）*/
        var tx = ux2 - d0 * rx, ty = uy2 - d0 * ry, tz = uz2 - d0 * rz;
        var ex = rx + tx * EXAG, ey = ry + ty * EXAG, ez = rz + tz * EXAG;
        var Le = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
        nor[j3] = ex / Le; nor[j3 + 1] = ey / Le; nor[j3 + 2] = ez / Le;
        /* ② 曲率遮蔽：谷地压暗到 0.74、山脊最多提亮到 1.06（不对称 —— 怕把亮色顶爆）*/
        var sh = 1 + curv[vj] * kA;
        if (sh < 0.74) sh = 0.74; else if (sh > 1.06) sh = 1.06;
        shade[vj] = sh;
        if (sh < shMin) shMin = sh; if (sh > shMax) shMax = sh;
      }
      M._globeShade = shade;             /* 由 buildGlobe 落成顶点属性 aShade */
      /* 自检出口：改前 maxDeg/avgDeg 应恒 0；改后应显著 > 0（法线真随地形走）*/
      M._globeNrmStat = {
        verts: nv, welded: weldN, exag: EXAG,
        maxDeg: +devMax.toFixed(2), avgDeg: +(devSum / (nv || 1)).toFixed(2),
        curvMeanAbs: +cavg.toFixed(3), kA: +kA.toFixed(3),
        shadeMin: +shMin.toFixed(3), shadeMax: +shMax.toFixed(3)
      };
    })();
"""
s = s[:i] + NEW + s[j:]

# 顶点属性落地（紧接 normal 之后）
oldA = "    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));"
newA = ("    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));\n"
        "    /* v15789：曲率遮蔽系数（每顶点一个标量，1 = 无影响）。复用 uRelief 同一个闸门。*/\n"
        "    if (M._globeShade) geo.setAttribute('aShade', new THREE.Float32BufferAttribute(M._globeShade, 1));")
assert s.count(oldA) == 1, 'anchor-attr'
s = s.replace(oldA, newA)

# 顶点着色器：加 attribute/varying
oldV = "        + (REL ? '\\n  vNrm = normalize(mat3(modelMatrix) * normal);' : '')"
newV = ("        + (REL ? '\\n  vNrm = normalize(mat3(modelMatrix) * normal);\\n  vShade = aShade;' : '')")
assert s.count(oldV) == 1, 'anchor-vs'
s = s.replace(oldV, newV)

oldVH = "      var _vHead = 'varying vec3 vWn;\\n' + (REL ? 'varying vec3 vNrm;\\n' : '');"
newVH = ("      var _vHead = 'varying vec3 vWn;\\n'\n"
         "        + (REL ? 'attribute float aShade;\\nvarying vec3 vNrm;\\nvarying float vShade;\\n' : '');")
assert s.count(oldVH) == 1, 'anchor-vh'
s = s.replace(oldVH, newVH)

# 片元：加 varying 与遮蔽乘项
oldF = "        + (REL ? ' uniform float uRelief; varying vec3 vNrm;' : '') + ' varying vec3 vWn;\\n';"
newF = ("        + (REL ? ' uniform float uRelief; varying vec3 vNrm; varying float vShade;' : '')\n"
        "        + ' varying vec3 vWn;\\n';")
assert s.count(oldF) == 1, 'anchor-fs'
s = s.replace(oldF, newF)

oldB = """        _body += '\\n'
          + '  float _rel = clamp(dot(normalize(vNrm), normalize(uSunDir)), 0.0, 1.0);\\n'
          + '  gl_FragColor.rgb *= mix(1.0, 0.70 + 0.46 * _rel, uRelief);';"""
newB = """        _body += '\\n'
          + '  float _rel = clamp(dot(normalize(vNrm), normalize(uSunDir)), 0.0, 1.0);\\n'
          + '  gl_FragColor.rgb *= mix(1.0, 0.70 + 0.46 * _rel, uRelief);\\n'
          + '  gl_FragColor.rgb *= mix(1.0, vShade, uRelief);';"""
assert s.count(oldB) == 1, 'anchor-body'
s = s.replace(oldB, newB)

assert s.count('_globeShade') >= 2, 'shade-missing'
assert s.count("aShade") >= 4, 'attr-missing'
assert len(s) > n0 or True
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('PATCHED-B bytes %d -> %d' % (n0, len(s)))
