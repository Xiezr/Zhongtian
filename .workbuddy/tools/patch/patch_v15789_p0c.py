# -*- coding: utf-8 -*-
"""v15789 P0c · 起伏明暗随高度淡出

近景实测（zoom 0.13，海拔约 200）开了起伏后出现"刷痕"状拉丝 —— 根因不是 bug，而是
**球面逐顶点明暗被放大**：它服务的是"看整颗星球"那一档；贴地时地形细节归地块层，
再叠一层顶点级明暗只会变成条纹。

口径：海拔 ≥ 520 全量，≤ 210 归零（≈缩放第 0.2 档），中间线性。
M.setRelief 仍是那个"一个数调手感"的出口（改的是 BASE，逐帧再乘淡出系数）。
"""
import io

P = 'js/map3d.js'
s = io.open(P, encoding='utf-8', newline='').read()
assert '\r\n' not in s
n0 = len(s)

# 1) BASE + 注释
old1 = """  M._reliefU = { value: 1.0 };"""
new1 = """  M._reliefU = { value: 1.0 };
  /* v157.89：**强度基准**（M.setRelief 写它）。真正的 uniform = BASE × 高度淡出系数，
     见 placeCamera 的 `_reliefU` 更新 —— 淡出是为了近景不出现"刷痕"。*/
  M.RELIEF_BASE = 1.0;
  M.RELIEF_AGL_FULL = 520;      /* 海拔 ≥ 此值：起伏全量（看整球那一档）*/
  M.RELIEF_AGL_ZERO = 210;      /* 海拔 ≤ 此值：起伏归零（贴地那一档）*/"""
assert s.count(old1) == 1, 'anchor1'
s = s.replace(old1, new1)

# 2) setRelief 写 BASE
old2 = """  M.setRelief = function (v) {
    var n = (v == null) ? 1 : (Math.max(0, Math.min(1, +v || 0)));
    M._reliefU.value = n;
    return n;
  };"""
new2 = """  M.setRelief = function (v) {
    var n = (v == null) ? 1 : (Math.max(0, Math.min(1, +v || 0)));
    M.RELIEF_BASE = n;
    M._reliefU.value = n;                    /* 本帧立即生效，不等下一帧 */
    return n;
  };"""
assert s.count(old2) == 1, 'anchor2'
s = s.replace(old2, new2)

# 3) 每帧按高度淡出
old3 = "    M._rAlt = _rAlt;                   /* v157.31：海拔（d − R）—— 位置/模式/地表淡出都读它，地形高不影响 */"
new3 = """    M._rAlt = _rAlt;                   /* v157.31：海拔（d − R）—— 位置/模式/地表淡出都读它，地形高不影响 */
    /* v157.89：起伏明暗**随高度淡出**。
       它服务的是"看整颗星球"那一档；贴地时地形细节归地块层，而逐顶点明暗被放大后
       在近景会变成"刷痕"状条纹（实机 zoom0.13 取证）。淡出口径写在 M.RELIEF_AGL_*。*/
    if (M._reliefU) {
      var _rF = (_rAlt - (M.RELIEF_AGL_ZERO || 210)) /
                ((M.RELIEF_AGL_FULL || 520) - (M.RELIEF_AGL_ZERO || 210));
      _rF = _rF < 0 ? 0 : (_rF > 1 ? 1 : _rF);
      M._reliefU.value = (M.RELIEF_BASE == null ? 1 : M.RELIEF_BASE) * _rF;
      M._reliefFade = _rF;             /* 探针/自检读数 */
    }"""
assert s.count(old3) == 1, 'anchor3'
s = s.replace(old3, new3)

assert s.count('RELIEF_AGL_FULL') >= 2, 'const-missing'
assert s.count('_reliefFade') >= 1, 'fade-missing'
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('PATCHED-C bytes %d -> %d' % (n0, len(s)))
