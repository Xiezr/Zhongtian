# -*- coding: utf-8 -*-
# v89.229 批 c 侦察 4：持久容器形状（迁移面）
import io, re
BASE = 'E:/Deepseekdb/'
OUT = BASE + '.workbuddy/tmp/p229c_recon4.txt'
def rd(p):
    try: return io.open(BASE + p, encoding='utf-8', newline='').read()
    except: return ''
L = []; w = L.append

w('=' * 26 + ' U1 marches 记录形状 ' + '=' * 26)
b = rd('js/battle.js')
for m in re.finditer(r'[^\n]*marches\.push[^\n]*', b + rd('js/state.js') + rd('js/domain.js')):
    w('  %s' % m.group(0).strip()[:200])

w('')
w('=' * 26 + ' U2 gathers/采集 记录形状 ' + '=' * 26)
dm = rd('js/domain.js')
for m in re.finditer(r'[^\n]*(gathers\.push|gatherPush|startGather = function|\.gathers =)[^\n]*', dm + rd('js/state.js')):
    w('  %s' % m.group(0).strip()[:200])

w('')
w('=' * 26 + ' U3 battles（挂起战斗）记录形状 ' + '=' * 26)
for m in re.finditer(r'[^\n]*battles\.push[^\n]*', dm + rd('js/battle.js') + rd('js/state.js')):
    w('  %s' % m.group(0).strip()[:220])
w('  --- rec.sim 里含的军队字段 ---')
for m in re.finditer(r'[^\n]*(scArmy|defArmy)[^\n]*', b):
    t = m.group(0).strip()
    if len(t) < 175:
        w('  [bL%d] %s' % (b[:m.start()].count('\n') + 1, t[:170]))

w('')
w('=' * 26 + ' U4 reports 记录形状 ' + '=' * 26)
for m in re.finditer(r'[^\n]*reports\.(push|unshift)[^\n]*', dm + b + rd('js/state.js')):
    w('  %s' % m.group(0).strip()[:220])
for m in re.finditer(r'[^\n]*(losses|lossBy|atkLossBy|defLossBy)[^\n]*', b):
    t = m.group(0).strip()
    if len(t) < 170 and 'function' not in t:
        w('  [bL%d] %s' % (b[:m.start()].count('\n') + 1, t[:165]))

w('')
w('=' * 26 + ' U5 tactics 表形状（s.tactics） ' + '=' * 26)
st = rd('js/state.js')
i = st.find('s.tactics')
for m in re.finditer(r'[^\n]*tactics[^\n]*', st):
    t = m.group(0).strip()
    if len(t) < 175 and ('tactics' in t):
        w('  [sL%d] %s' % (st[:m.start()].count('\n') + 1, t[:170]))

w('')
w('=' * 26 + ' U6 quests.stash / wilds garrison 形状 ' + '=' * 26)
for f, name in [(dm, 'domain'), (st, 'state'), (b, 'battle')]:
    for m in re.finditer(r'[^\n]*(quests\.stash|garrison\.troops|wildGarrisonAdd)[^\n]*', f):
        t = m.group(0).strip()
        if len(t) < 175:
            w('  [%s L%d] %s' % (name, f[:m.start()].count('\n') + 1, t[:170]))

w('')
w('=' * 26 + ' U7 adoptState 位置与结构 ' + '=' * 26)
i = st.find('GAME.adoptState = function')
j = st.find('\n  GAME.', i + 30)
w(st[i:j][:2600] if i >= 0 else 'NOT FOUND')

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L))
print('written', len(L))
