# -*- coding: utf-8 -*-
"""v15789 P1 · 片元级细节法线（近看有起伏颗粒）

为什么不直接加 `normalMap`：球体是 **MeshBasicMaterial**，three 的 normalMap 只对受光材质生效，
Basic 会**静默忽略** —— 加了个属性、画面零变化，是本轮最容易踩的坑。

做法：复用已有的细节灰度贴图（`makeDetailTex('globe')`，384²，Repeat）当**高度场**，
在注入的片元里做 1.6 纹素步长的有限差分求梯度 → 切线空间法线 → 用球面 TBN 扰动 vNrm。
- 3 次采样/像素，mipmap 让远景自动平均成平面（高频细节从太空看不见，不会产生噪点）。
- 与 P0 的顶点法线**互补**：远景靠顶点法线（球级+地形级），近景靠片元法线（像素级颗粒）。
- `M.setDetail(v)` 一个数全关/全调。
"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s
n0 = len(s)

# ---------- 1) 常量与 uniform 容器 ----------
old1 = "  M._reliefU = { value: 1.0 };"
new1 = """  M._reliefU = { value: 1.0 };
  /* v157.89 P1：片元级细节法线（近看颗粒）。
     ⚠️ 不能走 three 的 normalMap —— 球体是 MeshBasicMaterial，normalMap 对它无效（静默忽略）。
        这里把细节灰度贴图当高度场，在片元里求梯度自己扰动法线。*/
  M._detailTexU = { value: null };   /* 指向 makeDetailTex('globe')（与 map 共用同一张，免再生成）*/
  M._detailU = { value: 1.0 };       /* 细节强度闸门（M.setDetail）*/
  M.DETAIL_REPEAT = 16;              /* uv 放大倍数（编译期写进着色器）*/
  M.DETAIL_SLOPE = 18;               /* 高度差 → 法线倾角的放大系数*/"""
assert s.count(old1) == 1, 'anchor1'
s = s.replace(old1, new1)

# ---------- 2) 顶点：传细节 uv ----------
old2 = """      var _vHead = 'varying vec3 vWn;\\n'
        + (REL ? 'attribute float aShade;\\nvarying vec3 vNrm;\\nvarying float vShade;\\n' : '');
      sh.vertexShader = _vHead + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\\n  vWn = normalize(mat3(modelMatrix) * position);'
        + (REL ? '\\n  vNrm = normalize(mat3(modelMatrix) * normal);\\n  vShade = aShade;' : '')
      );"""
new2 = """      var _dRep = (+M.DETAIL_REPEAT || 16);
      var _vHead = 'varying vec3 vWn;\\n'
        + (REL ? 'attribute float aShade;\\nvarying vec3 vNrm;\\nvarying float vShade;\\nvarying vec2 vDUv;\\n' : '');
      sh.vertexShader = _vHead + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\\n  vWn = normalize(mat3(modelMatrix) * position);'
        + (REL ? ('\\n  vNrm = normalize(mat3(modelMatrix) * normal);\\n  vShade = aShade;'
                  + '\\n  vDUv = uv * ' + _dRep.toFixed(1) + ';') : '')
      );"""
assert s.count(old2) == 1, 'anchor2'
s = s.replace(old2, new2)

# ---------- 3) 片元：uniform 头 ----------
old3 = """      var _fHead = 'uniform vec3 uSunDir; uniform float uTerm;'
        + (REL ? ' uniform float uRelief; varying vec3 vNrm; varying float vShade;' : '')
        + ' varying vec3 vWn;\\n';"""
new3 = """      var _fHead = 'uniform vec3 uSunDir; uniform float uTerm;'
        + (REL ? (' uniform float uRelief; varying vec3 vNrm; varying float vShade;'
                  + ' uniform sampler2D uDetailTex; uniform float uDetail; varying vec2 vDUv;') : '')
        + ' varying vec3 vWn;\\n';"""
assert s.count(old3) == 1, 'anchor3'
s = s.replace(old3, new3)

# ---------- 4) 片元：细节法线扰动 + 用它算 rel ----------
old4 = """        sh.uniforms.uRelief = M._reliefU;
        _body += '\\n'
          + '  float _rel = clamp(dot(normalize(vNrm), normalize(uSunDir)), 0.0, 1.0);\\n'
          + '  gl_FragColor.rgb *= mix(1.0, 0.70 + 0.46 * _rel, uRelief);\\n'
          + '  gl_FragColor.rgb *= mix(1.0, vShade, uRelief);';"""
new4 = """        sh.uniforms.uRelief = M._reliefU;
        sh.uniforms.uDetail = M._detailU;
        sh.uniforms.uDetailTex = M._detailTexU;
        _body += '\\n'
          /* P1：细节法线。1.6 纹素步长求梯度（步长必须与 vDUv 的放大倍数同源，
             否则颗粒尺度会随 DETAIL_REPEAT 变化而错位）。*/
          + '  vec3 _N0 = normalize(vNrm);\\n'
          + '  vec3 _up = abs(_N0.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);\\n'
          + '  vec3 _T = normalize(cross(_up, _N0));\\n'
          + '  vec3 _B = cross(_N0, _T);\\n'
          + '  float _e = ' + (1.6 * _dRep / 384).toFixed(6) + ';\\n'
          + '  float _h0 = texture2D(uDetailTex, vDUv).r;\\n'
          + '  float _hx = texture2D(uDetailTex, vDUv + vec2(_e, 0.0)).r - _h0;\\n'
          + '  float _hy = texture2D(uDetailTex, vDUv + vec2(0.0, _e)).r - _h0;\\n'
          + '  vec3 _Nd = normalize(_N0 + (_T * (-_hx) + _B * (-_hy)) * (' + (M.DETAIL_SLOPE || 18) + ' * uDetail));\\n'
          + '  float _rel = clamp(dot(_Nd, normalize(uSunDir)), 0.0, 1.0);\\n'
          + '  gl_FragColor.rgb *= mix(1.0, 0.70 + 0.46 * _rel, uRelief);\\n'
          + '  gl_FragColor.rgb *= mix(1.0, vShade, uRelief);';"""
assert s.count(old4) == 1, 'anchor4'
s = s.replace(old4, new4)

# ---------- 5) 建球时把贴图接到 uniform ----------
old5 = """      var dtex = makeDetailTex('globe'); dtex.repeat.set(7, 7);"""
new5 = """      var dtex = makeDetailTex('globe'); dtex.repeat.set(7, 7);
      /* v157.89 P1：同一张图也当细节法线的高度场（raw 采样不吃 Texture.repeat，互不干扰）*/
      if (M._detailTexU) M._detailTexU.value = dtex;"""
assert s.count(old5) == 1, 'anchor5'
s = s.replace(old5, new5)

# ---------- 6) 强度出口 ----------
old6 = """  M.setLight = function (opt) {"""
new6 = """  /* v157.89 P1：细节法线强度（0 = 关 · 1 = 默认）。与 setRelief 各管一层：
     relief 管"地形起伏"（顶点级 · 远景），detail 管"表面颗粒"（像素级 · 近景）。*/
  M.setDetail = function (v) {
    var n = (v == null) ? 1 : (Math.max(0, Math.min(2, +v || 0)));
    M._detailU.value = n;
    return n;
  };
  M.setLight = function (opt) {"""
assert s.count(old6) == 1, 'anchor6'
s = s.replace(old6, new6)

assert s.count('uDetailTex') >= 4, 'tex-uniform-missing'
assert s.count('vDUv') >= 5, 'varying-missing'
assert s.count('M.setDetail') >= 1, 'exit-missing'
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('PATCHED-P1 bytes %d -> %d' % (n0, len(s)))
