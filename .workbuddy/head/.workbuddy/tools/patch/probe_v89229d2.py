# -*- coding: utf-8 -*-
# v89.229 探针 D2：18 兵种 id 引用面（写盘版）
import io, re, os
BASE = 'E:/Deepseekdb/'
OUT = BASE + '.workbuddy/tmp/p229d2.txt'
def rd(p):
    try: return io.open(BASE + p, encoding='utf-8', newline='').read()
    except: return ''

IDS = ['minfu','yibing','chihou','changqiang','daodun','gongjian','qingji','tieji','zhouche',
       'chuangnu','chongche','toudan','qingzhoubing','tengjiabing','tuqibing','hubaoqi',
       'xiliangtieqi','nanjiangxiangbing']
SHORT = {'js/data.js':'data','js/ui.js':'ui','js/domain.js':'domain','js/state.js':'state',
         'js/battle.js':'battle','js/tactic.js':'tactic','js/systems.js':'systems',
         'js/questdata.js':'quest','js/main.js':'main','index.html':'html',
         'smoke-test.js':'smoke','e2e-test.js':'e2e'}
L = []
w = L.append
w('%-18s %s' % ('id', ' '.join('%-6s' % v for v in SHORT.values())))
for tid in IDS:
    row = []
    for f in SHORT:
        s = rd(f)
        c = len(re.findall(r"['\"]%s['\"]" % tid, s))     # 引号形态（真正的字面量引用）
        row.append(c)
    w('%-18s %s' % (tid, ' '.join('%-6d' % c for c in row)))
w('')
w('== 引号形态合计（按文件）==')
for f, name in SHORT.items():
    s = rd(f)
    n = sum(len(re.findall(r"['\"]%s['\"]" % t, s)) for t in IDS)
    if n: w('  %-8s %d' % (name, n))
w('')
w('== 裸词形态（含注释，按文件）==')
for f, name in SHORT.items():
    s = rd(f)
    n = sum(len(re.findall(r"\b%s\b" % t, s)) for t in IDS)
    if n: w('  %-8s %d' % (name, n))
# 逐 id 在 smoke 的"行为性引用"（exp: 断言上下文抓 3 条）
w('')
w('== smoke 中每个 id 的首 3 条引用行 ==')
sm = rd('smoke-test.js')
for tid in IDS:
    hits = []
    for m in re.finditer(r"[^\n]*['\"]%s['\"][^\n]*" % tid, sm):
        hits.append(sm[:m.start()].count('\n') + 1)
        if len(hits) >= 3: break
    w('  %-18s L%s' % (tid, hits))
io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L))
print('written', OUT, len(L), 'lines')
