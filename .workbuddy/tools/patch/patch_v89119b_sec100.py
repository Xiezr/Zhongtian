# -*- coding: utf-8 -*-
# 把 §100 片段插到 smoke-test.js 的汇总行之前（短脚本：读→改→原子落盘→自检）
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
FRAG = 'E:/Deepseekdb/.workbuddy/tools/patch/v89119_sec100.js'
BAK = 'E:/Deepseekdb/.workbuddy/backup/v89119/smoke-test.js'

s = io.open(P, encoding='utf-8').read()
frag = io.open(FRAG, encoding='utf-8').read()
ANCHOR = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
if s.count(ANCHOR) != 1:
    print('!! 锚点 %d 处' % s.count(ANCHOR)); sys.exit(1)
s2 = s.replace(ANCHOR, frag + "\n" + ANCHOR, 1)
b = io.open(BAK, encoding='utf-8').read()
d = (s2.count('{') - s2.count('}')) - (b.count('{') - b.count('}'))
print('花括号净变化 %+d（片段应自平衡 = 0）' % d)
if d != 0:
    print('!! 片段不平衡 → 中止'); sys.exit(1)
tmp = P + '.tmp119sec100'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s2)
os.replace(tmp, P)
print('§100 已插入')
