# -*- coding: utf-8 -*-
# v89.225 探针 C：SERIES 定义 + ser- 类 CSS + forBuilding 渲染 + 旗/色标
import io, re

def rd(p):
    return io.open('E:/Deepseekdb/' + p, encoding='utf-8', newline='').read()

d = rd('js/data.js')
print('=== data.js 里 flag 的 13 处 ===')
for i, ln in enumerate(d.split('\n'), 1):
    if 'flag' in ln:
        print('  L%d %s' % (i, ln.strip()[:190]))

print()
print('=== data.js DATA.SERIES 段全文 ===')
i = d.find('DATA.SERIES =')
if i >= 0:
    j = d.find('\n};', i)
    print(d[i:j+3])

print()
print('=== data.js SERIES_OF / BUILD_SERIES 相关 ===')
for m in re.finditer(r'DATA\.(\w*[Ss]eries\w*|SERIES\w*)\s*=', d):
    print('  ', m.group(0), 'at', m.start())

print()
print('=== index.html 里 ser- 与 tile-face / tile-art CSS ===')
h = rd('index.html')
for i, ln in enumerate(h.split('\n'), 1):
    if re.search(r'\.ser-|\.tile-face|\.tile-art|\.iso-tile', ln):
        print('  L%d %s' % (i, ln.strip()[:190]))
