# -*- coding: utf-8 -*-
# v89.229 批 b 探针 2：icon/color 消费 + 残留词 + emoji
import io, re
BASE = 'E:/Deepseekdb/'
OUT = BASE + '.workbuddy/tmp/p229b2.txt'
def rd(p):
    try: return io.open(BASE + p, encoding='utf-8', newline='').read()
    except: return ''
L = []; w = L.append
FILES = [('data', 'js/data.js'), ('ui', 'js/ui.js'), ('domain', 'js/domain.js'),
         ('state', 'js/state.js'), ('battle', 'js/battle.js'), ('systems', 'js/systems.js'),
         ('quest', 'js/questdata.js'), ('main', 'js/main.js'), ('html', 'index.html'),
         ('smoke', 'smoke-test.js'), ('e2e', 'e2e-test.js')]

w('=' * 24 + ' C1 RESOURCES 的 .icon / .color 消费 ' + '=' * 24)
for name, f in FILES:
    s = rd(f)
    for m in re.finditer(r"[^\n]*(\.icon\b|\.color\b|resIcon|RES_ICON)[^\n]*", s):
        t = m.group(0).strip()
        if re.search(r'RESOURCES|resLine|resbar|res=', t) and len(t) < 175:
            w('  [%s L%d] %s' % (name, s[:m.start()].count('\n') + 1, t[:170]))

w('')
w('=' * 24 + ' C2 残留词：粮草 / 复合材料场 / 沃土 / 伐木 ' + '=' * 24)
for name, f in FILES:
    s = rd(f)
    for k in ['粮草', '复合材料场', '沃土', '伐木', '采石', '开矿']:
        for m in re.finditer(r"[^\n]*%s[^\n]*" % k, s):
            t = m.group(0).strip()
            if len(t) < 185:
                w('  [%s L%d|%s] %s' % (name, s[:m.start()].count('\n') + 1, k, t[:175]))

w('')
w('=' * 24 + ' C3 资源 emoji 全仓（🌾🪵⛰️🔩 等） ' + '=' * 24)
EMOJI = {'\U0001F33E': '🌾', '\U0001FAB5': '🪵', '\u26F0': '⛰️', '\U0001F529': '🔩',
         '\U0001FA93': '🪓', '\u26CF': '⛏️', '\U0001F331': '🌱', '\U0001F525': '🔥',
         '\u26A1': '⚡', '\U0001F4A7': '💧', '\U0001F30A': '🌊'}
for name, f in FILES:
    s = rd(f)
    for k, nm in EMOJI.items():
        c = s.count(k)
        if c:
            w('  [%s] %s ×%d' % (name, nm, c))
            for m in re.finditer(r"[^\n]*%s[^\n]*" % re.escape(k), s):
                t = m.group(0).strip()
                if len(t) < 165:
                    w('       L%d %s' % (s[:m.start()].count('\n') + 1, t[:160]))

w('')
w('=' * 24 + ' C4 domain L1225-1235（碎石=材料 那个语境） ' + '=' * 24)
dm = rd('js/domain.js').split('\n')
for i in range(1224, 1236):
    w('  L%d|%s' % (i + 1, dm[i]))
w('')
w('=' * 24 + ' C5 data L3000-3010（quest g06 上下文）& questdata 80-100 ' + '=' * 24)
q = rd('js/questdata.js').split('\n')
for i in range(37, 53):
    w('  qL%d|%s' % (i + 1, q[i]))

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L))
print('written', len(L), 'lines')
