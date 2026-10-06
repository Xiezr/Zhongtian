# -*- coding: utf-8 -*-
"""v89.204：插入 §204 段（smoke + e2e）—— 长内容走文件（§12.5）
   smoke：插在 "  console.log('结果：...')" 之前
   e2e：插在 "  return finish();" 之前（带缩进唯一形态 · §185 教训）
"""
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

# ── smoke ──
PS = 'E:/Deepseekdb/smoke-test.js'
frag = rd('E:/Deepseekdb/.workbuddy/tmp/frag_smoke204.txt')
s = rd(PS)
if '§204（v89.204 · 老板 1/2）' in s:
    print('[skip] smoke §204')
else:
    anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    c = s.count(anchor)
    assert c == 1, 'smoke anchor count=' + str(c)
    s = s.replace(anchor, frag + anchor)
    wr(PS, s)
    print('[ok] smoke §204')

# ── e2e ──
PE = 'E:/Deepseekdb/e2e-test.js'
frag2 = rd('E:/Deepseekdb/.workbuddy/tmp/frag_e2e204.txt')
e = rd(PE)
if '§204. v89.204 民心占领 + 弹窗版面' in e:
    print('[skip] e2e §204')
else:
    anchor2 = "  return finish();"
    c2 = e.count(anchor2)
    print('e2e anchor count=' + str(c2))
    assert c2 >= 1
    # 用最后一个出现（main 的收尾）—— rfind
    i = e.rfind(anchor2)
    e = e[:i] + frag2 + e[i:]
    wr(PE, e)
    print('[ok] e2e §204')

print('insert done')
