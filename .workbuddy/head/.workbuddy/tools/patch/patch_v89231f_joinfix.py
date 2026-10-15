# -*- coding: utf-8 -*-
"""修复 smoke-test.js 的 join 断行（真换行 → 字面 \\n 两字符）"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()

bad = "      }).join('" + chr(10) + "');"
good = "      }).join('" + chr(92) + "n');"

c = s.count(bad)
assert c == 1, 'bad count=%d' % c
s = s.replace(bad, good)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('[ok] join 断行已修复（真换行 → 字面 backslash-n）')
