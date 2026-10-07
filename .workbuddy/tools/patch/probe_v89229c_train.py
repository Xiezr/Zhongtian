# -*- coding: utf-8 -*-
# v89.229 探针 C：训练/解锁链 + 兵种 UI + cat 消费面
import io, re
BASE = 'E:/Deepseekdb/'
def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()

d = rd('js/data.js'); u = rd('js/ui.js'); dm = rd('js/domain.js'); st = rd('js/state.js')

print('=' * 30, 'C1 训练出口（domain/systems）', '=' * 30)
for f, s in [('domain', dm), ('systems', rd('js/systems.js')), ('state', st)]:
    for m in re.finditer(r"[^\n]*(train|Train|练兵|募兵|征兵)[^\n]*", s):
        ln = s[:m.start()].count('\n') + 1
        t = m.group(0).strip()
        if re.search(r'= function|\.push|function ', t) and len(t) < 160:
            print('  [%s L%d] %s' % (f, ln, t[:150]))

print()
print('=' * 30, 'C2 兵种解锁/训练上限', '=' * 30)
for key in ['troopUnlock', 'TROOP_UNLOCK', 'trainLimit', 'TRAIN_LIMIT', 'troopCap']:
    for f, s in [('data', d), ('domain', dm), ('ui', u), ('state', st)]:
        c = s.count(key)
        if c: print('  %s: %s ×%d' % (f, key, c))

print()
print('=' * 30, 'C3 募兵/训练面板（ui）', '=' * 30)
for m in re.finditer(r"ui\.(\w*[Tt]roop\w*|\w*[Tt]rain\w*) = function", u):
    print('  ui.%-28s @L%d' % (m.group(1), u[:m.start()].count('\n') + 1))
# 面板渲染里怎么列兵种
i = u.find('ui.renderTroopsModal')
if i < 0: i = u.find('renderTroops')
print()
print('  -- 兵种列表渲染（前 60 行）--')
print('\n'.join(u[i:i + 2600].split('\n')[:60]))

print()
print('=' * 30, 'C4 cat 的消费面', '=' * 30)
for f, s in [('data', d), ('ui', u), ('domain', dm), ('tactic', rd('js/tactic.js')), ('battle', rd('js/battle.js'))]:
    for m in re.finditer(r"[^\n]*\bcat\b[^\n]*", s):
        t = m.group(0).strip()
        if re.search(r"\.cat\b|cat:|cat ===|cat !=", t) and 'category' not in t and len(t) < 170:
            ln = s[:m.start()].count('\n') + 1
            print('  [%s L%d] %s' % (f, ln, t[:160]))
