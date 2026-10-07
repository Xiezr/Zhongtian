# -*- coding: utf-8 -*-
"""v89.232 盲区专项：产品里【引号内仅含 粮/木/石/铁 的单字串】扫描"""
import io, re

FILES = ['js/data.js', 'js/ui.js', 'js/main.js', 'js/battle.js', 'js/domain.js', 'js/systems.js',
         'js/tactic.js', 'js/state.js', 'js/map.js', 'js/story.js', 'js/questdata.js']
PAT = re.compile(r"(['\"])(　?[粮木石铁]　?)\1")

for f in FILES:
    s = io.open('E:/Deepseekdb/' + f, encoding='utf-8').read()
    lines = s.split('\n')
    for i, line in enumerate(lines):
        st = line.strip()
        if st.startswith('*') or st.startswith('/*') or st.startswith('//'):
            continue
        for m in PAT.finditer(line):
            # 排除数组/对象键用（如 ['grain','wood'] 的中文映射已由他项覆盖）
            print('%s L%-6d %s' % (f, i + 1, line.strip()[:160]))
