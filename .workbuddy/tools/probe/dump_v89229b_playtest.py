# -*- coding: utf-8 -*-
"""按文件导出 playtest 6 员的**全部**旧 id 命中（不截断），供写补丁用。"""
import io, os, re

OLD = ['minfu', 'qingji', 'chihou', 'zhouche', 'yibing', 'changqiang', 'qingzhoubing', 'daodun', 'gongjian',
       'tuqibing', 'tieji', 'xiliangtieqi', 'hubaoqi', 'tengjiabing', 'toudan', 'chongche', 'chuangnu',
       'nanjiangxiangbing']
FILES = ['play_600x.js', 'play_farm2_600x.js', 'play_gold_600x.js', 'play_rush_1x.js',
         'play_strat_600x.js', 'play_v89118.js']
pat = re.compile(r'\b(' + '|'.join(OLD) + r')\b')
base = '.workbuddy/tools/playtest/'
for f in FILES:
    p = base + f
    s = io.open(p, encoding='utf-8', errors='replace').read()
    print('##### ' + f)
    for m in pat.finditer(s):
        ln = s.count('\n', 0, m.start()) + 1
        line = s.split('\n')[ln - 1].rstrip()
        print('  L%-6d %-18s %s' % (ln, m.group(1), line.strip()[:200]))
