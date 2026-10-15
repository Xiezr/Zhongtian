# -*- coding: utf-8 -*-
"""修复 smoke-test.js 里被 heredoc 吃掉反斜杠的三处（v89.117 · 第二轮）

坏形态（`\\s` → `/s`、`\\.` → `//.`）：
  L7097  `/line-height://s*([^;}]+)/`      → `/line-height:\\s*([^;}]+)/`
  L15035 `/--isz-xs://s*20px/`            → `/--isz-xs:\\s*20px/`
  L15834 `/--lh-body://s*1//.6/`          → `/--lh-body:\\s*1\\.6/`
其余（--lh 两张表）经查是好的。本脚本按**坏形态**逐条修（不依赖上下文），写后自检。
"""
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8').read()

FIX = [
    ('/line-height://s*([^;}]+)/', '/line-height:\\s*([^;}]+)/'),
    ('/--isz-xs://s*20px/', '/--isz-xs:\\s*20px/'),
    ('/--lh-body://s*1//.6/', '/--lh-body:\\s*1\\.6/'),
]
for old, new in FIX:
    n = s.count(old)
    if n != 1:
        print('!! %r 匹配 %d 次' % (old, n)); sys.exit(1)
    s = s.replace(old, new, 1)
    print('  ✓ %s → %s' % (old, new))

bad = [ln for ln in s.split('\n') if '//s*' in ln or '//.6' in ln]
if bad:
    print('!! 自检失败：')
    for b in bad[:5]:
        print('   ' + b[:130])
    sys.exit(1)

tmp = P + '.tmp117fix2'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('修复完成（第二轮）')
