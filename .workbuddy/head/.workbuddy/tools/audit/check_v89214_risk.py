# -*- coding: utf-8 -*-
"""换皮前置安全检查：把高风险词的**全部出现上下文**打印出来（人眼过一遍误伤）"""
import io, re, glob
R = 'E:/Deepseekdb/'
RISK = ['吴子', '三略', '上造', '大夫', '平民', '内功', '秘籍', '养生', '剑心', '治兵', '严整',
        '奇正', '料敌', '庙算', '将略', '木材', '石料', '铁锭', '粮食', '仓库', '市场', '校场',
        '骑兵', '坐骑', '驯马', '马厩', '驿站', '门派', '城墙', '客栈', '官府', '民房', '书院',
        '军营', '内功', '宝具', '晋爵', '爵位', '烽火', '农田', '义兵', '民夫', '斥候', '冲车']
files = sorted(glob.glob(R + 'js/*.js')) + [R + 'index.html']
out = []
for w in RISK:
    rows = []
    for f in files:
        s = io.open(f, encoding='utf-8', errors='replace', newline='').read()
        for m in re.finditer(re.escape(w), s):
            a = max(0, m.start() - 14); b = min(len(s), m.end() + 14)
            seg = s[a:b].replace('\n', '⏎')
            rows.append('%s: …%s…' % (f.split('/')[-1], seg))
    out.append('\n### %s（%d 处）' % (w, len(rows)))
    out.extend(rows[:40])
io.open(R + '.workbuddy/tmp/v89214_risk.txt', 'w', encoding='utf-8', newline='').write('\n'.join(out))
print('DONE lines=%d' % len(out))
