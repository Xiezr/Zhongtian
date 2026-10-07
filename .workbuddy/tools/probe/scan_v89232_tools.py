# -*- coding: utf-8 -*-
"""v89.232 第二层：活工具（非 patch/probe/backup）引号内旧词扫描"""
import io, os, re

WORDS = ['统率', '内政', '勇武', '智谋', '凡品', '良材', '英杰', '名世', '天授',
         '将领', '商城', '派系驻地', '播种', '种子', '灵田', '藏珍阁', '百炼',
         '木料', '碎石', '废铁', '黄金', '金币', '万金', '人口',
         '军中装备', '改造装备', '名将套', '神武', '倚天', '游侠', '陷阵', '守御', '天策',
         '泰坦筋', '河石', '青玉', '羊脂玉', '昆山玉', '织锦', '云缎',
         '民房', '仓库', '校场', '客栈', '书院', '城墙',
         '搬运工', '摩托游骑', '侦察兵', '长矛手', '旧军残部', '刀盾', '弩手', '突击摩托',
         '装甲战车', '重甲战车', '王牌战车', '防暴甲兵', '迫击炮', '破门车', '重弩车', '变异巨兽',
         '辎重车', '床弩', '冲车', '投石兵', '民夫', '义兵', '斥候', '象兵',
         '虎符', '文曲星符', '武曲星符', '智多星符',
         '弘农', '高陵', '蓟县', '高柳', '涿县', '上谷', '琅琊', '汉寿', '宛县', '肤施', '雁门', '乐安', '许昌', '赤壁',
         '大汉', '汉室', '朝廷', '郡守', '县令']
NAMES = '|'.join(WORDS)

SKIP = ['patch', 'probe', 'tmp', 'break', '.git', 'backup']
files = []
for root, dirs, fs in os.walk('E:/Deepseekdb/.workbuddy/tools'):
    r = root.replace('\\', '/')
    if any(x in r for x in SKIP):
        continue
    for f in fs:
        if f.endswith(('.js', '.py')):
            files.append(os.path.join(root, f).replace('\\', '/'))

for p in sorted(files):
    s = io.open(p, encoding='utf-8', errors='replace').read()
    lines = s.split('\n')
    hits = []
    for i, line in enumerate(lines):
        st = line.strip()
        if st.startswith('*') or st.startswith('/*') or st.startswith('//') or st.startswith('#'):
            continue
        for m in re.finditer(r"(['\"`])((?:(?!\1).)*?(?:" + NAMES + r")(?:(?!\1).)*?)\1", line):
            hits.append('L%-5d %s' % (i + 1, m.group(0)[:140]))
    if hits:
        rel = p.replace('E:/Deepseekdb/', '')
        print('\n##### %s  (%d)' % (rel, len(hits)))
        for h in hits[:14]:
            print('  ' + h)
