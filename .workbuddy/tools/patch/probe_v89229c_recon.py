# -*- coding: utf-8 -*-
# v89.229 批 c 侦察：doTrain / 兵种 id 引用 / forTroop / 持久结构 / 迁面
import io, re
BASE = 'E:/Deepseekdb/'
OUT = BASE + '.workbuddy/tmp/p229c_recon.txt'
def rd(p):
    try: return io.open(BASE + p, encoding='utf-8', newline='').read()
    except: return ''
L = []; w = L.append

w('=' * 26 + ' R1 doTrain 实现（main.js） ' + '=' * 26)
m = rd('js/main.js').split('\n')
for i in range(1845, 1875):
    w('L%-5d|%s' % (i + 1, m[i]))

w('')
w('=' * 26 + ' R2 battle.js 兵种引用 ' + '=' * 26)
b = rd('js/battle.js')
for m2 in re.finditer(r"[^\n]*(minfu|yibing|chihou|changqiang|daodun|gongjian|qingji|tieji|zhouche|chuangnu|chongche|toudan|qingzhoubing|tengjiabing|tuqibing|hubaoqi|xiliangtieqi|nanjiangxiangbing)[^\n]*", b):
    t = m2.group(0).strip()
    if len(t) < 175:
        w('  [bL%d] %s' % (b[:m2.start()].count('\n') + 1, t[:170]))

w('')
w('=' * 26 + ' R3 state.js 兵种引用 ' + '=' * 26)
st = rd('js/state.js')
for m2 in re.finditer(r"[^\n]*(minfu|yibing|chihou|changqiang|daodun|gongjian|qingji|tieji|zhouche|chuangnu|chongche|toudan|qingzhoubing|tengjiabing|tuqibing|hubaoqi|xiliangtieqi|nanjiangxiangbing)[^\n]*", st):
    t = m2.group(0).strip()
    if len(t) < 175:
        w('  [sL%d] %s' % (st[:m2.start()].count('\n') + 1, t[:170]))

w('')
w('=' * 26 + ' R4 icons.forTroop 实现 ' + '=' * 26)
ic = rd('js/icons.js')
i = ic.find('forTroop')
w(ic[i - 300:i + 900] if i >= 0 else 'NOT FOUND')

w('')
w('=' * 26 + ' R5 持久结构 troopId/army 面（state/domain/battle） ' + '=' * 26)
for name, f in [('state', 'js/state.js'), ('domain', 'js/domain.js'), ('battle', 'js/battle.js')]:
    s = rd(f)
    for m2 in re.finditer(r"[^\n]*(troopId|\.army\b|garrison|\.army\[)[^\n]*", s):
        t = m2.group(0).strip()
        if re.search(r'army|troopId', t) and len(t) < 165 and ('function' not in t or 'troopId' in t):
            w('  [%s L%d] %s' % (name, s[:m2.start()].count('\n') + 1, t[:160]))

w('')
w('=' * 26 + ' R6 barracksOf / craftWorkshopsOf / maxTrainCount 实现 ' + '=' * 26)
dm = rd('js/domain.js')
for fn in ['GAME.barracksOf = function', 'GAME.craftWorkshopsOf = function', 'GAME.maxTrainCount = function']:
    i = dm.find(fn)
    if i >= 0:
        j = dm.find('\n  GAME.', i + 30)
        w('===== %s =====' % fn)
        w(dm[i:j][:1200])

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L))
print('written', len(L))
