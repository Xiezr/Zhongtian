# -*- coding: utf-8 -*-
"""v89.231 侦察：科技名全仓残留扫描（排除史档/备份）"""
import io, os

NAMES = ['练兵技巧','战斗技巧','打造技巧','侦察技巧','防护技巧','负重技巧','行军技巧','抛射技巧',
         '驾驭技巧','建筑技术','储存技术','补给技巧','统帅能力','城防技术','维修技术','抢掠技巧',
         '合成技巧','车轮技术','机修技巧','研究技巧']
SKIP = ['.git', 'backup', 'node_modules', '.workbuddy/tmp', '.workbuddy/backup', '.workbuddy\\tmp', '.workbuddy\\backup']

ROOT = 'E:/Deepseekdb'
for root, dirs, fs in os.walk(ROOT):
    r = root.replace('\\', '/')
    if any(x in r for x in SKIP):
        continue
    for f in fs:
        if not f.endswith(('.js', '.html', '.md', '.py')):
            continue
        p = os.path.join(root, f)
        try:
            s = io.open(p, encoding='utf-8', errors='replace').read()
        except Exception:
            continue
        rows = []
        for nm in NAMES:
            c = s.count(nm)
            if c:
                rows.append('%s x%d' % (nm, c))
        if rows:
            rel = p.replace(ROOT + '/', '').replace('\\', '/')
            print('%-56s %s' % (rel, ' · '.join(rows)))
