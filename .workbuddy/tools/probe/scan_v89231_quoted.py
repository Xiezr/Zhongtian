# -*- coding: utf-8 -*-
"""v89.231 侦察：找产品代码里'引号内'的旧科技名（玩家可见串），排除注释行"""
import io, re

NAMES = '练兵技巧|战斗技巧|打造技巧|侦察技巧|防护技巧|负重技巧|行军技巧|抛射技巧|驾驭技巧|建筑技术|储存技术|补给技巧|统帅能力|城防技术|维修技术|抢掠技巧|合成技巧|车轮技术|机修技巧|研究技巧'
FILES = ['js/battle.js','js/domain.js','js/main.js','js/systems.js','js/tactic.js','js/ui.js','js/data.js','js/state.js','js/story.js','index.html']

for f in FILES:
    s = io.open('E:/Deepseekdb/' + f, encoding='utf-8').read()
    lines = s.split('\n')
    print('\n########## ' + f)
    for i, line in enumerate(lines):
        if not re.search(NAMES, line):
            continue
        stripped = line.strip()
        # 跳过纯注释行
        if stripped.startswith('*') or stripped.startswith('/*') or stripped.startswith('//'):
            continue
        # 找引号内命中
        for m in re.finditer(r"(['\"`])((?:(?!\1).)*?(?:" + NAMES + r")(?:(?!\1).)*?)\1", line):
            print('L%-6d QUOTED: %s' % (i + 1, m.group(0)[:160]))
