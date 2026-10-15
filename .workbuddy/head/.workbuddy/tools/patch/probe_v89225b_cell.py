# -*- coding: utf-8 -*-
# v89.225 探针 B：城视图建筑格渲染 + 族旗/色标消费点
import io, re

def rd(p):
    return io.open('E:/Deepseekdb/' + p, encoding='utf-8', newline='').read()

s = rd('js/ui.js')

print('=== ui.buildCellHTML 全文 ===')
i = s.find('ui.buildCellHTML = function')
if i >= 0:
    # 找带缩进的函数结尾
    j = s.find('\n  };', i)
    print(s[i:j+5])

print()
print('=== ui.isoCell 全文 ===')
i = s.find('ui.isoCell = function')
if i >= 0:
    j = s.find('\n  };', i)
    print(s[i:j+5])
