# -*- coding: utf-8 -*-
# v89.229 探针 D：18 兵种 id 的引用面（迁移风险评估）
import io, re
BASE = 'E:/Deepseekdb/'
def rd(p):
    try: return io.open(BASE + p, encoding='utf-8', newline='').read()
    except: return ''

IDS = ['minfu','yibing','chihou','changqiang','daodun','gongjian','qingji','tieji','zhouche',
       'chuangnu','chongche','toudan','qingzhoubing','tengjiabing','tuqibing','hubaoqi',
       'xiliangtieqi','nanjiangxiangbing']
FILES = ['js/data.js','js/ui.js','js/domain.js','js/state.js','js/battle.js','js/tactic.js',
         'js/systems.js','js/questdata.js','js/main.js','js/storydata.js','index.html',
         'smoke-test.js','e2e-test.js','audit.js']

print('%-20s | %s' % ('id', ' '.join('%-10s' % f.replace('js/', '').replace('.js', '')[:9] for f in FILES)))
print('-' * 175)
tot = {}
for tid in IDS:
    row = []
    for f in FILES:
        s = rd(f)
        # 词边界匹配（避免子串误命中）
        c = len(re.findall(r"['\"]%s['\"]|\b%s\b(?=[^a-zA-Z0-9_]|$)" % (tid, tid), s))
        row.append(c)
        tot[tid] = tot.get(tid, 0) + c
    print('%-20s | %s' % (tid, ' '.join('%-10d' % c for c in row)))
print()
print('合计：', tot)
print()
# 逐文件总命中（粗）
for f in FILES:
    s = rd(f)
    n = sum(len(re.findall(r"['\"]%s['\"]" % t, s)) for t in IDS)
    if n: print('  %-24s 引号形态总命中 %d' % (f, n))
