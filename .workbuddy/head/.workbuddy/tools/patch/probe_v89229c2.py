# -*- coding: utf-8 -*-
# v89.229 批 c 侦察 2：troop 图标 / L57 / quest 引用 / smoke 段
import io, re
BASE = 'E:/Deepseekdb/'
OUT = BASE + '.workbuddy/tmp/p229c_recon2.txt'
def rd(p):
    try: return io.open(BASE + p, encoding='utf-8', newline='').read()
    except: return ''
L = []; w = L.append

w('=' * 26 + ' S1 icons.js troop 图标注册 ' + '=' * 26)
ic = rd('js/icons.js')
for m in re.finditer(r"[^\n]*troop[^\n]*", ic):
    t = m.group(0).strip()
    if len(t) < 170:
        w('  [L%d] %s' % (ic[:m.start()].count('\n') + 1, t[:165]))

w('')
w('=' * 26 + ' S2 bitmaps.js troop 位图 ' + '=' * 26)
bm = rd('js/bitmaps.js')
for m in re.finditer(r"[^\n]*troop[^\n]*", bm):
    t = m.group(0).strip()
    if len(t) < 170:
        w('  [L%d] %s' % (bm[:m.start()].count('\n') + 1, t[:165]))

w('')
w('=' * 26 + ' S3 battle L50-62（qi 模式匹配） ' + '=' * 26)
b = rd('js/battle.js').split('\n')
for i in range(46, 66):
    w('bL%-5d|%s' % (i + 1, b[i]))

w('')
w('=' * 26 + ' S4 questdata 兵种简写全量（sub: 等） ' + '=' * 26)
q = rd('js/questdata.js')
for m in re.finditer(r"[^\n]*(sub: '[a-z]+'|troopCount|stash)[^\n]*", q):
    t = m.group(0).strip()
    if len(t) < 175:
        w('  [qL%d] %s' % (q[:m.start()].count('\n') + 1, t[:170]))

w('')
w('=' * 26 + ' S5 smoke §223 段（ab 对表） ' + '=' * 26)
s = rd('smoke-test.js')
i = s.find('§223')
if i >= 0:
    j = s.find('§224', i)
    w(s[i - 400:i + 3800] if j < 0 else s[i - 400:j][:4200])

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L))
print('written', len(L))
