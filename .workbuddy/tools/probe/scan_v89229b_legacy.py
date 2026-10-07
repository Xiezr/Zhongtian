# -*- coding: utf-8 -*-
"""v89.229b 侦察：全仓（除史档/补丁脚本）旧兵种 id 残留扫描。
史档面（保留，不算残留）：.workbuddy/backup · .workbuddy/tools/patch · .workbuddy/tools/break
· .workbuddy/tools/tmp（历史探针）· .workbuddy/tmp（本轮临时物）。
活工具面（算残留）：audit / play / show / gen / probe 里**仍会被复跑**的脚本。"""
import io, os, re

OLD = ['minfu', 'qingji', 'chihou', 'zhouche', 'yibing', 'changqiang', 'qingzhoubing', 'daodun', 'gongjian',
       'tuqibing', 'tieji', 'xiliangtieqi', 'hubaoqi', 'tengjiabing', 'toudan', 'chongche', 'chuangnu',
       'nanjiangxiangbing']
SKIP = ('.workbuddy/tmp', '.workbuddy/backup', '.workbuddy/tools/patch', '.workbuddy/tools/break',
        '.workbuddy/tools/tmp', '.git', 'node_modules', 'backup')
pat = re.compile(r'\b(' + '|'.join(OLD) + r')\b')
tot = 0
for root, dirs, fs in os.walk('.'):
    r = root.replace('\\', '/')
    if any(x in r for x in SKIP):
        continue
    for f in fs:
        if not f.endswith(('.js', '.py', '.html')):
            continue
        p = os.path.join(root, f)
        s = io.open(p, encoding='utf-8', errors='replace').read()
        hits = []
        for m in pat.finditer(s):
            ln = s.count('\n', 0, m.start()) + 1
            line = s.split('\n')[ln - 1].strip()
            hits.append((ln, m.group(1), line[:140]))
        if hits:
            print('\n##### ' + p + '  (%d)' % len(hits))
            for ln, w, line in hits[:60]:
                print('  L%-6d %-18s %s' % (ln, w, line))
            tot += len(hits)
print('\n合计', tot)
