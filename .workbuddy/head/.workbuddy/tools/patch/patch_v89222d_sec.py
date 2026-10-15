# -*- coding: utf-8 -*-
"""v89.222d · 向 smoke 插入 §222 零残留守卫段（片段文件读取，防转义事故）"""
import io, sys, os

R = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

s = rd('smoke-test.js')
sec = rd('.workbuddy/tools/patch/v89222_sec_smoke.txt')

if '§222-guard' in s:
    print('[skip] §222 已在')
    sys.exit(0)

anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
c = s.count(anchor)
if c != 1:
    print('❌ anchor count=%d' % c)
    sys.exit(1)

if DRY:
    print('[dry] anchor x%d；SEC %d 字符；未落盘' % (c, len(sec)))
    sys.exit(0)

wr('smoke-test.js', s.replace(anchor, sec + anchor))
print('✅ v89.222d §222 插入（SEC %d 字符）' % len(sec))
