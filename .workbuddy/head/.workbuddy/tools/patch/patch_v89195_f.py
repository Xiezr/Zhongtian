# -*- coding: utf-8 -*-
"""v89.195 补丁F：e2e §195 段插入（前哨放手真点全链 + 档位一览）"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

s = rd('e2e-test.js')
if u'§195（v89.195）' in s:
    print('[skip] F e2e §195 段')
else:
    sec = io.open(R + '.workbuddy/tmp/sec195e2e.js', 'r', encoding='utf-8', newline='').read()
    anchor = u"  return finish();\n}\n\nlet ABORTED = false;"
    c = s.count(anchor)
    assert c == 1, 'F anchor count=' + str(c)
    s = s.replace(anchor, sec + u"\n" + anchor)
    wr('e2e-test.js', s)
    print('[ok] F e2e §195 段')

print('补丁F 完成')
