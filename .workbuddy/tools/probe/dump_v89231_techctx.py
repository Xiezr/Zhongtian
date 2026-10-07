# -*- coding: utf-8 -*-
"""v89.231 侦察：dump 产品 js 里科技旧名的每处上下文（前后 60 字）"""
import io

NAMES = ['练兵技巧','战斗技巧','打造技巧','侦察技巧','防护技巧','负重技巧','行军技巧','抛射技巧',
         '驾驭技巧','建筑技术','储存技术','补给技巧','统帅能力','城防技术','维修技术','抢掠技巧',
         '合成技巧','车轮技术','机修技巧','研究技巧']
FILES = ['js/battle.js','js/domain.js','js/main.js','js/systems.js','js/tactic.js','js/ui.js','js/data.js']

for f in FILES:
    s = io.open('E:/Deepseekdb/' + f, encoding='utf-8').read()
    rows = []
    for nm in NAMES:
        pos = 0
        while True:
            i = s.find(nm, pos)
            if i < 0:
                break
            ln = s.count('\n', 0, i) + 1
            a = s.rfind('\n', 0, max(0, i - 90))
            b = s.find('\n', i + 90)
            ctx = s[a + 1 if a >= 0 else 0:b if b >= 0 else len(s)].strip()
            rows.append((ln, nm, ctx[:180]))
            pos = i + len(nm)
    if rows:
        print('\n########## ' + f + '  (%d)' % len(rows))
        for ln, nm, ctx in sorted(rows):
            print('L%-6d [%s] %s' % (ln, nm, ctx))
