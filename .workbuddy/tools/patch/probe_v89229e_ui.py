# -*- coding: utf-8 -*-
# v89.229 探针 E：募兵 UI + 兵种标记消费面 + 资源/建筑
import io, re
BASE = 'E:/Deepseekdb/'
OUT = BASE + '.workbuddy/tmp/p229e.txt'
def rd(p):
    try: return io.open(BASE + p, encoding='utf-8', newline='').read()
    except: return ''

L = []
w = L.append
u = rd('js/ui.js'); d = rd('js/data.js'); dm = rd('js/domain.js')

w('=' * 26 + ' E1 ui.openTroops 全段 ' + '=' * 26)
i = u.find('ui.openTroops = function')
j = u.find('\n  ui.', i + 30)
w(u[i:j if j > 0 else i + 8000])

w('')
w('=' * 26 + ' E2 troopsHTML ' + '=' * 26)
i = u.find('ui.troopsHTML = function')
j = u.find('\n  ui.', i + 30)
w(u[i:j if j > 0 else i + 6000][:6000])

w('')
w('=' * 26 + ' E3 mech / craft / vsMech / nocombat 消费面 ' + '=' * 26)
for key in ['mech', 'craft', 'vsMech', 'nocombat']:
    w('-- %s --' % key)
    for f, s in [('data', d), ('ui', u), ('domain', dm), ('battle', rd('js/battle.js')), ('tactic', rd('js/tactic.js')), ('state', rd('js/state.js'))]:
        for m in re.finditer(r"[^\n]*[^\w]%s\b[^\n]*" % key, s):
            t = m.group(0).strip()
            if re.search(r"\.%s\b" % key, t) and len(t) < 165:
                w('  [%s L%d] %s' % (f, s[:m.start()].count('\n') + 1, t[:160]))

w('')
w('=' * 26 + ' E4 建筑表（BUILDINGS 全量 key/name/series）' + '=' * 26)
blk = d[d.find('DATA.BUILDINGS = {'):]
blk = blk[:blk.find('\n  };')]
for m in re.finditer(r"^    (\w+):\s*\{([^\n]*(?:\n(?!^    \w+:)[^\n]*)*)", blk, re.M):
    tid, body = m.group(1), m.group(2)
    nm = re.search(r"name: '([^']+)'", body)
    ser = re.search(r"series: '([^']+)'", body)
    w('  %-16s %-8s %s' % (tid, ser.group(1) if ser else '?', nm.group(1) if nm else '?'))

w('')
w('=' * 26 + ' E5 DATA.RESOURCES 与环境资源' + '=' * 26)
for key in ['DATA.RESOURCES', 'RES_KEYS', 'RES_CN', 'RES_META']:
    k = d.find(key)
    if k >= 0:
        w('-- %s @L%d --' % (key, d[:k].count('\n') + 1))
        w(d[k:k + 900])

w('')
w('=' * 26 + ' E6 EXT_BUILDINGS（城外建筑）' + '=' * 26)
k = d.find('DATA.EXT_BUILDINGS')
if k >= 0:
    w(d[k:k + 1800])
else:
    # 找 farm/forest 定义
    for key in ['farm:', 'forest:', 'quarry:', 'mine:']:
        k = d.find(key)
        w('  %s @L%d' % (key, d[:k].count('\n') + 1 if k >= 0 else -1))

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L))
print('written', len(L), 'lines ->', OUT)
