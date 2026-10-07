# -*- coding: utf-8 -*-
"""dump smoke 35690-35700 的精确字节，定位 join 断行"""
import io
s = io.open('E:/Deepseekdb/smoke-test.js', encoding='utf-8', newline='').read()
lines = s.split('\n')
for i in range(35688, 35702):
    print('L%d %r' % (i + 1, lines[i]))
