# -*- coding: utf-8 -*-
# v89.229 批 c6：产品 js/*.js —— 旧兵种显示名全量替换（历史标定注释掩码保护）
import io, os, glob
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

NAMES = [
    ('搬运工', '板车'), ('民兵', '步行机'), ('长矛手', '步行机'), ('侦察兵', '侦察单元'),
    ('弩手', '导弹车'), ('摩托游骑', '伏击车'), ('装甲战车', '主战机甲'), ('运输车', '运输平台'),
    ('重弩车', '无人轰炸机'), ('破门车', '自行火炮'), ('迫击炮', '自行火炮'),
    ('旧军残部', '狂猎'), ('防暴甲兵', '电磁盾卫'), ('突击摩托', '武装直升机'),
    ('王牌战车', '狂猎'), ('重甲战车', '主战机甲'), ('变异巨兽', '泰坦机甲'),
]

# data.js 的历史标定注释掩码区间（老板原话引述 / 当时称谓 —— 保留旧词）
def mask_zones(s):
    zones = [
        ('⚠️ v89.229 兵种重构：以下三段', '现行 id/名映射见 DATA.STROOPS 注释。 */'),
        ('* v89.163（老板「缩减征兵时长', '* v89.180（老板「补重弩车拆器械特性」）'),
        ('* v89.180（老板「补重弩车拆器械特性」）', '* v89.181（老板「2.王牌战车稍微加强」）'),
        ('* v89.181（老板「2.王牌战车稍微加强」）', 'DATA.TROOPS = {'),
    ]
    parts = []
    marks = []
    cur = 0
    for i, (a, b) in enumerate(zones):
        ia = s.find(a, cur)
        assert ia >= 0, 'zone %d start miss: %s' % (i, a[:30])
        ib = s.find(b, ia + len(a))
        assert ib > ia, 'zone %d end miss' % i
        # mark = [ia, ib)；end 文本（b）留给下一个 zone 当 start
        parts.append(s[cur:ia]); parts.append('\x01Z%d\x01' % i); cur = ib
        marks.append(s[ia:ib])
    parts.append(s[cur:])
    return ''.join(parts), marks

def unmask(s, marks):
    for i, m in enumerate(marks):
        assert ('\x01Z%d\x01' % i) in s, 'unmask miss %d' % i
        s = s.replace('\x01Z%d\x01' % i, m)
    return s

report = []
for f in sorted(glob.glob(BASE + 'js/*.js')):
    name = os.path.basename(f)
    s = io.open(f, encoding='utf-8', newline='').read()
    marks = None
    if name == 'data.js':
        s, marks = mask_zones(s)
    cnt = 0
    for old, new in sorted(NAMES, key=lambda x: -len(x[0])):
        c = s.count(old)
        if c:
            s = s.replace(old, new)
            cnt += c
    if marks is not None:
        s = unmask(s, marks)
    if cnt:
        report.append('  %s: %d 处' % (name, cnt))
        if not DRY:
            tmp = f + '.tmp229c6'
            io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
            os.replace(tmp, f)

report.append('合计：%d 处' % sum(int(r.split(':')[1].replace(' 处', '')) for r in report))
io.open(BASE + '.workbuddy/tmp/p229c6_report.txt', 'w', encoding='utf-8', newline='').write('\n'.join(report))
print('\n'.join(report))
print('C6 DONE%s' % ('（DRY）' if DRY else ''))
