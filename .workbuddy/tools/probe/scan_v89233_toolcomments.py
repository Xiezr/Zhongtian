# -*- coding: utf-8 -*-
"""v89.233 侦察：活工具（.workbuddy/tools/）注释层旧词扫描。

范围 = 会复跑的工具（audit/gen/play/playtest/show/git）；排除史档面（patch/probe/tmp/dbg）。
输出：文件 × 行 → 人工分类（清 / 保留 / 已声明沿革）。
"""
import io, os, re

ROOT = 'E:/Deepseekdb/.workbuddy/tools/'
INCLUDE_DIRS = ['audit', 'gen', 'play', 'playtest', 'show', 'git', 'asset', 'economy']
WORDS = ['黄金', '金币', '银两', '万金', '人口', '木料', '碎石', '废铁', '集水场', '木料场', '碎石场', '废铁场',
         '粮食', '木材', '石料', '铁锭',
         '民兵', '义兵', '长矛手', '侦察兵', '搬运工', '轻骑', '铁骑', '虎豹骑', '突骑兵', '西凉铁骑',
         '青州兵', '刀盾兵', '藤甲兵', '投石车', '冲车', '床弩', '弩手', '弓兵', '弓手', '枪兵',
         '摩托游骑', '装甲战车', '运输车', '重弩车', '破门车', '迫击炮', '旧军残部', '防暴甲兵',
         '突击摩托', '王牌战车', '重甲战车', '变异巨兽', '象兵', '轻骑',
         '太守', '郡守', '县令', '州牧', '刺史', '知府', '衙门',
         '州城', '州治', '郡城', '郡治', '县城', '州郡', '洛阳', '长安', '许昌', '许都', '邺城',
         '宛城', '宛县', '东平', '司隶',
         '练兵技巧', '战斗技巧', '打造技巧', '侦察技巧', '防护技巧', '负重技巧', '行军技巧', '抛射技巧',
         '驾驭技巧', '建筑技术', '储存技术', '补给技巧', '统帅能力', '城防技术', '维修技术', '抢掠技巧',
         '合成技巧', '车轮技术', '机修技巧', '研究技巧', '种植技术', '砍伐技术', '挖掘技术', '冶炼技术',
         '民房', '校场', '客栈', '书院', '城墙']

pat = re.compile('|'.join(re.escape(w) for w in WORDS))
files = []
for d in INCLUDE_DIRS:
    p = ROOT + d
    if not os.path.isdir(p):
        continue
    for f in sorted(os.listdir(p)):
        if f.endswith(('.js', '.py')):
            files.append(d + '/' + f)
total = 0
for rel in files:
    p = ROOT + rel
    s = io.open(p, encoding='utf-8', errors='replace').read()
    lines = s.split('\n')
    hits = []
    for i, ln in enumerate(lines):
        st = ln.strip()
        if not (st.startswith('*') or st.startswith('/*') or st.startswith('//') or st.startswith('#')):
            continue
        for m in pat.finditer(ln):
            hits.append((i + 1, m.group(0), st[:130]))
    if hits:
        print('##### %s (%d)' % (rel, len(hits)))
        for ln, w, txt in hits:
            print('L%-6d [%s] %s' % (ln, w, txt))
        total += len(hits)
print('== 合计 %d 处（注释层） ==' % total)
