# -*- coding: utf-8 -*-
"""v89.214 收口 2：把"误还原"的产品断言回改成新名。
   规则：`X.indexOf('…')` 里若串包含**旧名**、且它所在的 check 块**不读 需求档案.md** → 回改成新名。
   （档案引用串保留旧名 = 老板原文；产品断言串用新名 = 现产品实况。）"""
import io, re
R = 'E:/Deepseekdb/'
FWD = [('政务厅', '官府'), ('围墙', '城墙'), ('练兵场', '校场'), ('集水场', '农田'), ('训练营', '军营'),
       ('研习所', '书院'), ('交易站', '市场'), ('货仓', '仓库'), ('居所', '民房'), ('补给站', '驿站'),
       ('瞭望塔', '烽火台'), ('车库', '马厩'), ('酒馆', '客栈'), ('招募站', '招贤馆'), ('锻造间', '铁匠铺'),
       ('机工坊', '工匠作坊'), ('派系驻地', '门派驻地'), ('派系', '门派'), ('威望', '爵位'), ('晋升', '晋爵'),
       ('净水', '粮食'), ('建材', '石料'), ('废铁', '铁锭'), ('木料', '木材'), ('战技', '内功'), ('残卷', '秘籍'),
       ('遗物', '宝具'), ('长矛手', '长枪兵'), ('盾卫', '刀盾兵'), ('弩手', '弓箭手'), ('民兵', '义兵'),
       ('搬运工', '民夫'), ('侦察兵', '斥候'), ('摩托游骑', '轻骑兵'), ('装甲战车', '铁骑兵'),
       ('突击摩托', '突骑兵'), ('王牌战车', '虎豹骑'), ('重甲战车', '西凉铁骑'), ('变异巨兽', '南疆象兵'),
       ('旧军残部', '青州兵'), ('防暴甲兵', '藤甲兵'), ('重弩车', '床弩'), ('破门车', '冲车'),
       ('迫击炮', '投石车'), ('运输车', '辎重车'), ('机车', '骑兵'), ('座驾', '坐骑'), ('机修', '驯马'),
       ('警报', '烽火'), ('幸存者', '平民')]

p = R + 'smoke-test.js'
s = io.open(p, encoding='utf-8', newline='').read()
lines = s.split('\n')

def is_archive(lineno, q):
    """该串所在 check 块里有没有读 需求档案.md（往上找 16 行）"""
    lo = max(0, lineno - 16)
    return '需求档案.md' in '\n'.join(lines[lo:lineno + 1])

fixed = []
def repl(m):
    var, q = m.group(1), m.group(2)
    lineno = s2[:m.start()].count('\n') if False else None
    return m.group(0)

# 逐串扫描（带行号定位）
out = []
pos = 0
pat = re.compile(r"(\w+)\.indexOf\('([^']*)'\)")
for m in pat.finditer(s):
    q = m.group(2)
    lineno = s[:m.start()].count('\n')
    nq = q
    if not is_archive(lineno, q):
        for nw, od in FWD:          # FWD 是 (新, 旧) —— 产品断言要把**旧名**改回**新名**
            nq = nq.replace(od, nw)
    if nq != q:
        out.append((m.start(), m.end(), "%s.indexOf('%s')" % (m.group(1), nq)))
        fixed.append('L%d  %s → %s' % (lineno + 1, q, nq))
res = []
last = 0
for a, b, rep in out:
    res.append(s[last:a]); res.append(rep); last = b
res.append(s[last:])
s2 = ''.join(res)
io.open(p, 'w', encoding='utf-8', newline='').write(s2)
print('回正 %d 条' % len(fixed))
for f in fixed: print('   ' + f)
