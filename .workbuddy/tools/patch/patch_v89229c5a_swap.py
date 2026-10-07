# -*- coding: utf-8 -*-
# v89.229 批 c5a：smoke / e2e —— 旧兵种显示名 + id 全量替换（词边界 · 数量报告）
import io, os, re
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

NAMES = [
    ('搬运工', '板车'), ('民兵', '步行机'), ('长矛手', '步行机'), ('侦察兵', '侦察单元'),
    ('弩手', '导弹车'), ('摩托游骑', '伏击车'), ('装甲战车', '主战机甲'), ('运输车', '运输平台'),
    ('重弩车', '无人轰炸机'), ('破门车', '自行火炮'), ('迫击炮', '自行火炮'),
    ('旧军残部', '狂猎'), ('防暴甲兵', '电磁盾卫'), ('突击摩托', '武装直升机'),
    ('王牌战车', '狂猎'), ('重甲战车', '主战机甲'), ('变异巨兽', '泰坦机甲'),
]
IDS = [('minfu','banche'), ('qingji','fujiche'), ('chihou','zhencha'), ('zhouche','yunshu'),
       ('yibing','buxingji'), ('changqiang','buxingji'), ('qingzhoubing','kuanglie'),
       ('daodun','dunwei'), ('gongjian','daodanche'), ('tuqibing','wuzhi'),
       ('tieji','zhuzhan'), ('xiliangtieqi','zhuzhan'), ('hubaoqi','kuanglie'),
       ('tengjiabing','dianci'), ('toudan','huopao'), ('chongche','huopao'),
       ('chuangnu','wuren'), ('nanjiangxiangbing','taitan')]

report = []
for f in ['smoke-test.js', 'e2e-test.js']:
    s = io.open(BASE + f, encoding='utf-8', newline='').read()
    n0 = len(s)
    cnt = 0
    # ① 显示名（长词优先：按词长降序替换，防子串）
    for old, new in sorted(NAMES, key=lambda x: -len(x[0])):
        c = s.count(old)
        if c:
            s = s.replace(old, new)
            cnt += c
            report.append('  %s: %s→%s ×%d' % (f, old, new, c))
    # ② id（词边界）
    for old, new in IDS:
        rx = re.compile(r'\b' + old + r'\b')
        c = len(rx.findall(s))
        if c:
            s = rx.sub(new, s)
            cnt += c
            report.append('  %s: %s→%s ×%d' % (f, old, new, c))
    if not DRY and s != io.open(BASE + f, encoding='utf-8', newline='').read():
        tmp = BASE + f + '.tmp229c5a'
        io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
        os.replace(tmp, BASE + f)
    report.append('== %s 共 %d 处替换（%d → %d 字符）' % (f, cnt, n0, len(s)))

io.open(BASE + '.workbuddy/tmp/p229c5a_report.txt', 'w', encoding='utf-8', newline='').write('\n'.join(report))
print('\n'.join(report))
print('C5A DONE%s' % ('（DRY）' if DRY else ''))
