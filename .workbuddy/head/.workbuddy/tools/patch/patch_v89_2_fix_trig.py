# -*- coding: utf-8 -*-
"""v89.2 修复：古阵光圈的刻度用**预置单位圆表**，不调用 Math.sin/cos
   （v50 守卫：map.js 全文件禁三角函数调用 —— 等距绘制必须纯线性变换）。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\map.js'
d = io.open(P, encoding='utf-8', newline='').read()

OLD = """      for (var i = 0; i < 12; i++) {
        var a = Math.PI * 2 * i / 12;
        seg(ctx, 430 + Math.cos(a) * 204, 208 + Math.sin(a) * 42,
          430 + Math.cos(a) * 214, 208 + Math.sin(a) * 46, 'rgba(111,208,232,.5)', 2);
      }"""

NEW = """      /* 刻度 12 枚：用**预置单位圆表**而不是 Math.sin/cos ——
         v50 守卫规定 map.js 全文件纯线性变换（等距绘制的误差不许靠三角函数累积） */
      var RUNE_U = [[1, 0], [0.866, 0.5], [0.5, 0.866], [0, 1], [-0.5, 0.866], [-0.866, 0.5],
        [-1, 0], [-0.866, -0.5], [-0.5, -0.866], [0, -1], [0.5, -0.866], [0.866, -0.5]];
      for (var i = 0; i < 12; i++) {
        var ux = RUNE_U[i][0], uy = RUNE_U[i][1];
        seg(ctx, 430 + ux * 204, 208 + uy * 42,
          430 + ux * 214, 208 + uy * 46, 'rgba(111,208,232,.5)', 2);
      }"""

if 'RUNE_U' in d:
    print('SKIP v89.2 三角函数修复')
else:
    c = d.count(OLD)
    assert c == 1, '锚点命中 %d 处' % c
    d = d.replace(OLD, NEW, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK v89.2 三角函数修复')

d2 = io.open(P, encoding='utf-8', newline='').read()
import re
print('残留 Math.sin/cos/tan 调用:', len(re.findall(r'Math\.(?:sin|cos|tan)\(', d2)), '(期望 0)')
