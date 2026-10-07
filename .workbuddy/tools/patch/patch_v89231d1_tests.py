# -*- coding: utf-8 -*-
"""v89.231 批次 d1：smoke-test.js / e2e-test.js —— 词替换（掩码-替换-恢复）
掩码面：老板引述（smoke 2 处）；其余全部换代（含断言逻辑中的比较串）。
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

MAP = [
    ('练兵技巧', '募兵整训'), ('战斗技巧', '战斗条令'), ('打造技巧', '锻造工艺'),
    ('侦察技巧', '侦察网络'), ('防护技巧', '装甲强化'), ('负重技巧', '载重优化'),
    ('行军技巧', '机动行军'), ('抛射技巧', '弹道校正'), ('驾驭技巧', '机车操控'),
    ('建筑技术', '废墟重建'), ('储存技术', '仓储扩容'), ('补给技巧', '生命维持'),
    ('统帅能力', '指挥链路'), ('城防技术', '防御工事'), ('维修技术', '再生技术'),
    ('抢掠技巧', '废墟搜刮'), ('合成技巧', '量产工艺'), ('车轮技术', '传动系统'),
    ('机修技巧', '座驾改装'), ('研究技巧', '逆向工程'),
]

PROT = {
    'smoke-test.js': [
        '「不同侦察技巧等级应该可以侦察出**不同类型**的信息」',
        '"🔒 需侦察技巧 Lv3"',
    ],
    'e2e-test.js': [],
}

REPORT = []
for f, prot in PROT.items():
    s = rd(f)
    masks = {}
    for k, t in enumerate(prot):
        c = s.count(t)
        assert c == 1, '%s protect miss: [%s] count=%d' % (f, t[:30], c)
        ph = '\x01R%d\x01' % k
        masks[ph] = t
        s = s.replace(t, ph)
    cnt = []
    for old, new in MAP:
        c = s.count(old)
        if c:
            s = s.replace(old, new)
            cnt.append('%s×%d' % (old, c))
    for ph, t in masks.items():
        assert s.count(ph) == 1, '%s restore miss %s' % (f, ph)
        s = s.replace(ph, t)
    wr(f, s)
    REPORT.append('[ok] %s: %s%s' % (f, ' · '.join(cnt), (' · 掩码×%d' % len(prot)) if prot else ''))

# 残留复扫
NAMES = [m[0] for m in MAP]
for f in PROT.keys():
    s = rd(f)
    left = sum(s.count(nm) for nm in NAMES)
    REPORT.append('    %s 残留: %d' % (f, left))

print('\n'.join(REPORT))
