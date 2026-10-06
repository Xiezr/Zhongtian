# -*- coding: utf-8 -*-
"""v89.214 收口：把 smoke 里**引用历史档案**的 md.indexOf('…') 串还原成老板原文
   （档案是历史记录、不参与换皮；只有"引用档案的断言"需要还原原文措辞）。
   判据：当前串不在档案里、反向后在档案里 → 替换；否则列出来人工核。"""
import io, re, sys
R = 'E:/Deepseekdb/'
REV = [('政务厅', '官府'), ('围墙', '城墙'), ('练兵场', '校场'), ('集水场', '农田'),
       ('训练营', '军营'), ('研习所', '书院'), ('交易站', '市场'), ('货仓', '仓库'),
       ('居所', '民房'), ('补给站', '驿站'), ('瞭望塔', '烽火台'), ('车库', '马厩'),
       ('酒馆', '客栈'), ('招募站', '招贤馆'), ('锻造间', '铁匠铺'), ('机工坊', '工匠作坊'),
       ('派系驻地', '门派驻地'), ('派系', '门派'), ('威望', '爵位'), ('晋升', '晋爵'),
       ('净水', '粮食'), ('建材', '石料'), ('废铁', '铁锭'), ('木料', '木材'),
       ('战技', '内功'), ('残卷', '秘籍'), ('遗物', '宝具'),
       ('长矛手', '长枪兵'), ('盾卫', '刀盾兵'), ('弩手', '弓箭手'), ('民兵', '义兵'),
       ('搬运工', '民夫'), ('侦察兵', '斥候'), ('摩托游骑', '轻骑兵'), ('装甲战车', '铁骑兵'),
       ('突击摩托', '突骑兵'), ('王牌战车', '虎豹骑'), ('重甲战车', '西凉铁骑'),
       ('变异巨兽', '南疆象兵'), ('旧军残部', '青州兵'), ('防暴甲兵', '藤甲兵'),
       ('重弩车', '床弩'), ('破门车', '冲车'), ('迫击炮', '投石车'), ('运输车', '辎重车'),
       ('机车', '骑兵'), ('座驾', '坐骑'), ('机修', '驯马'), ('警报', '烽火'),
       ('幸存者', '平民')]

md = io.open(R + '需求档案.md', encoding='utf-8', errors='replace', newline='').read()
p = R + 'smoke-test.js'
s = io.open(p, encoding='utf-8', newline='').read()

def rev(t):
    for a, b in REV:
        t = t.replace(a, b)
    return t

changed, manual = [], []
def repl(m):
    q = m.group(1)
    if q in md:
        return m.group(0)
    r = rev(q)
    if r != q and r in md:
        changed.append('%s  →  %s' % (q, r))
        return "md.indexOf('%s')" % r
    manual.append(q)
    return m.group(0)

s2 = re.sub(r"md\.indexOf\('([^']*)'\)", repl, s)
if changed:
    io.open(p, 'w', encoding='utf-8', newline='').write(s2)
print('还原 %d 条：' % len(changed))
for c in changed: print('   ' + c)
print('\n需人工核 %d 条：' % len(manual))
for c in manual: print('   ' + c)
