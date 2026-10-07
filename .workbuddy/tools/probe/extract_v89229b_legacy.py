# -*- coding: utf-8 -*-
"""按文件导出 p229b_legacy.txt 里的残留明细（供分类：活工具 vs 历史仪器）"""
import io, sys

F = '.workbuddy/tmp/p229b_legacy.txt'
ARGS = sys.argv[1:]
if ARGS and ARGS[0].startswith('file:'):
    F = ARGS[0][5:]; ARGS = ARGS[1:]

s = io.open(F, encoding='utf-8').read()
KEYS = ARGS or ['audit_v89105_chains', 'audit_v89105_modals', 'ladder_audit',
                        'lifecycle_v89121', 'gen_gicons', 'wasteland_prompts',
                        'play_rush_1x', 'play_v89118', 'dbg8988', 'gallery33', 'gallery31']
pos = 0
sections = []
while True:
    j = s.find('#####', pos)
    if j < 0:
        break
    k2 = s.find('\n', j)
    sections.append((s[j:k2], j, k2))
    pos = k2 + 1
for key in KEYS:
    for head, j, k2 in sections:
        if key in head:
            end = len(s)
            for h2, j2, k22 in sections:
                if j2 > j:
                    end = j2
                    break
            print('======================== ' + head.strip())
            print(s[j:end].strip()[:2400])
            break
    else:
        print('======================== ' + key + '  (未找到)')
