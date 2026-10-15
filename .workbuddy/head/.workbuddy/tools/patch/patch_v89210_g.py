# -*- coding: utf-8 -*-
"""v89.210 补丁 G —— e2e-test.js：插入 §210 段"""
import io

P = 'E:/Deepseekdb/e2e-test.js'
F = 'E:/Deepseekdb/.workbuddy/tmp/frag_e2e210.txt'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
n0 = len(s)

if '§210（v89.210 · 真实 DOM）' in s:
    print('[skip] §210e 已插入')
else:
    anchor = '\n  return finish();'
    assert s.count(anchor) == 1, 'anchor count=' + str(s.count(anchor))
    frag = io.open(F, 'r', encoding='utf-8', newline='').read().rstrip('\n')
    assert '§210（v89.210' in frag
    s = s.replace(anchor, '\n' + frag + '\n' + anchor.lstrip('\n'))
    print('[ok] §210e 已插入')

assert s.count('§210（v89.210 · 真实 DOM）') == 1
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('写入 ' + str(n0) + ' -> ' + str(len(s)) + ' 字节')
print('done')
