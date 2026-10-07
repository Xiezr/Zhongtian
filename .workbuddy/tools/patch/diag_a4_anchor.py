# -*- coding: utf-8 -*-
# 诊断 v2：直接对比 file 段与补丁 old 段
import io
BASE = 'E:/Deepseekdb/'
s = io.open(BASE + 'smoke-test.js', encoding='utf-8', newline='').read()
psrc = io.open(BASE + '.workbuddy/tools/patch/patch_v89229a4_smoke.py', encoding='utf-8', newline='').read()

# file 段
k1 = s.find('/* ③b 其余三主题逐字节对齐')
k2 = s.find("'/12 对齐'));", k1)
file_seg = s[k1:k2 + len("'/12 对齐'));")]
print('file 段长度：', len(file_seg))

# 补丁 old 段（含 4 空格缩进在脚本内的形态：脚本里 old 以 '''    /* ③b''' 开头）
p1 = psrc.find('/* ③b 其余三主题逐字节对齐')
p2 = psrc.find("'/12 对齐'));", p1)
old_seg = psrc[p1:p2 + len("'/12 对齐'));")]
print('old 段长度：', len(old_seg))

# 找共同前缀
n = min(len(file_seg), len(old_seg))
diverge = -1
for i in range(n):
    if file_seg[i] != old_seg[i]:
        diverge = i
        break
if diverge < 0:
    print('前缀全同；长度差 =', len(file_seg) - len(old_seg))
    print('file tail:', repr(file_seg[len(old_seg) - 40:][:200]))
    print('old  tail:', repr(old_seg[len(old_seg) - 40:][:200]))
else:
    print('分叉 @%d' % diverge)
    print('file: ...%r' % file_seg[max(0, diverge - 60):diverge + 80])
    print('old : ...%r' % old_seg[max(0, diverge - 60):diverge + 80])
