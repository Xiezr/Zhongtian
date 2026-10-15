# -*- coding: utf-8 -*-
"""v89.222 · 最后取证：§179/§164 区段原文 + 版本号 + 计数"""
import io, re

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()

def dump(f, a, b):
    lines = rd(f).split('\n')
    print('===== %s %d-%d =====' % (f, a, b))
    for i in range(a, min(b, len(lines)) + 1):
        print('L%-6d %s' % (i, lines[i-1].rstrip()[:230]))

dump('smoke-test.js', 8486, 8502)
dump('smoke-test.js', 28910, 28930)
dump('smoke-test.js', 16682, 16714)
dump('smoke-test.js', 30000, 30010)

s = rd('smoke-test.js')
print('===== 版本号相关 =====')
for i, ln in enumerate(s.split('\n'), 1):
    if 'GAME\\.VERSION' in ln or ('v89.221' in ln and ('每轮' in ln or 'VERSION' in ln)):
        print('L%d  %s' % (i, ln.strip()[:180]))
m = rd('js/main.js')
for i, ln in enumerate(m.split('\n'), 1):
    if 'GAME.VERSION' in ln:
        print('main.js L%d  %s' % (i, ln.strip()[:150]))

print('===== 计数 =====')
for f in ['smoke-test.js', 'e2e-test.js']:
    t = rd(f)
    print(f, "许都=%d 邺城=%d 灰岗=%d 灰丘=%d" % (t.count('许都'), t.count('邺城'), t.count('灰岗'), t.count('灰丘')))

# js/ + index.html 全量 174 旧城名扫描（报点，人眼过）
tool = rd('.workbuddy/tools/patch/patch_v89217a_names.py')
def section(name):
    i = tool.index(name + ' = [')
    j = tool.index('\n]', i)
    return re.findall(r"\('([^']+)',\s*'([^']+)'\)", tool[i:j])
CITY_OLD = [o for o, n in section('CITY')]
REG_OLD = [o for o, n in section('REGION')]
print('===== js/ + index.html 旧城/区名扫描（排除已知通用词） =====')
GENERIC = {'新城', '平原', '成都', '任城', '长子', '高密', '北平', '南海', '九江', '丹阳', '庐江', '汉中'}
for f in ['js/data.js', 'js/state.js', 'js/ui.js', 'js/domain.js', 'js/battle.js', 'js/map.js', 'js/tactic.js', 'js/systems.js', 'js/icons.js', 'js/questdata.js', 'js/story.js', 'js/main.js', 'index.html']:
    t = rd(f)
    for w in CITY_OLD + REG_OLD:
        if w in GENERIC:
            continue
        if w in t:
            for i, ln in enumerate(t.split('\n'), 1):
                if w in ln:
                    print('%s L%d (%s): %s' % (f, i, w, ln.strip()[:150]))
