# -*- coding: utf-8 -*-
# v89.229 探针 F：_trainFilter/_trainTab 消费面 + canTrain/解锁链 + newGame 初始兵
import io, re
BASE = 'E:/Deepseekdb/'
OUT = BASE + '.workbuddy/tmp/p229f.txt'
def rd(p):
    try: return io.open(BASE + p, encoding='utf-8', newline='').read()
    except: return ''
L = []; w = L.append
FILES = [('ui', 'js/ui.js'), ('domain', 'js/domain.js'), ('state', 'js/state.js'),
         ('main', 'js/main.js'), ('smoke', 'smoke-test.js'), ('e2e', 'e2e-test.js')]

w('=' * 26 + ' F1 _trainFilter 全消费面 ' + '=' * 26)
for name, f in FILES:
    s = rd(f)
    for m in re.finditer(r"[^\n]*_trainFilter[^\n]*", s):
        w('  [%s L%d] %s' % (name, s[:m.start()].count('\n') + 1, m.group(0).strip()[:170]))

w('')
w('=' * 26 + ' F2 _trainTab 全消费面 ' + '=' * 26)
for name, f in FILES:
    s = rd(f)
    for m in re.finditer(r"[^\n]*_trainTab[^\n]*", s):
        w('  [%s L%d] %s' % (name, s[:m.start()].count('\n') + 1, m.group(0).strip()[:170]))

w('')
w('=' * 26 + ' F3 canTrain 实现 ' + '=' * 26)
dm = rd('js/domain.js')
i = dm.find('GAME.canTrain = function')
j = dm.find('\n  GAME.', i + 40)
w(dm[i:j])
i = dm.find('GAME.trainLimitOf = function')
j = dm.find('\n  GAME.', i + 40)
w(dm[i:j])

w('')
w('=' * 26 + ' F4 doTrain / train-tab / select-train 的入口 ' + '=' * 26)
u = rd('js/ui.js'); mn = rd('js/main.js')
for name, s in [('ui', u), ('main', mn), ('domain', dm)]:
    for pat in ['doTrain', "train-tab", "select-train", "openTroops\\("]:
        for m in re.finditer(r"[^\n]*%s[^\n]*" % pat, s):
            t = m.group(0).strip()
            if len(t) < 175:
                w('  [%s L%d] %s' % (name, s[:m.start()].count('\n') + 1, t[:170]))

w('')
w('=' * 26 + ' F5 newGame 初始 army / 初始解锁 ' + '=' * 26)
st = rd('js/state.js')
for m in re.finditer(r"[^\n]*(army|troop)[^\n]*", st):
    t = m.group(0).strip()
    if re.search(r"yibing|minfu|army\s*[:=]|army\[", t) and len(t) < 170:
        w('  [state L%d] %s' % (st[:m.start()].count('\n') + 1, t[:165]))

w('')
w('=' * 26 + ' F6 兵种在 questdata / ui 的引用 ' + '=' * 26)
q = rd('js/questdata.js')
for m in re.finditer(r"[^\n]*\b(minfu|yibing|chihou|changqiang|daodun|gongjian|qingji|tieji|zhouche|chuangnu|chongche|toudan|qingzhoubing|tengjiabing|tuqibing|hubaoqi|xiliangtieqi|nanjiangxiangbing)\b[^\n]*", q):
    w('  [quest L%d] %s' % (q[:m.start()].count('\n') + 1, m.group(0).strip()[:165]))

w('')
w('=' * 26 + ' F7 ui.js 兵种名硬编码（非表读） ' + '=' * 26)
for m in re.finditer(r"[^\n]*(yibing|minfu|changqiang|gongjian|qingji)\b[^\n]*", u):
    t = m.group(0).strip()
    if len(t) < 175:
        w('  [ui L%d] %s' % (u[:m.start()].count('\n') + 1, t[:170]))

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L))
print('written', len(L), 'lines')
