# -*- coding: utf-8 -*-
"""v89.231 批次 c：battle.js / domain.js / main.js / systems.js / tactic.js
规则：除「老板原话引述」外，全部旧名 → 新名（掩码-替换-恢复三件套）。
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

# 受保护面：老板原话引述（battle / main 各 1 处）
PROT = {
    'js/battle.js': ['侦察技巧等级应该可以侦察出'],
    'js/main.js':   ['侦察技巧等级应该可以侦察出'],
    'js/domain.js': [],
    'js/systems.js': [],
    'js/tactic.js': [],
}

REPORT = []
for f, prot in PROT.items():
    s = rd(f)
    n0 = len(s)
    masks = {}
    for k, t in enumerate(prot):
        c = s.count(t)
        assert c == 1, '%s protect miss: %s count=%d' % (f, t, c)
        ph = '\x01Q%d\x01' % k
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
    REPORT.append('[ok] %s: %s%s' % (f, ' · '.join(cnt) if cnt else '(无命中)',
                                     (' · 掩码×%d' % len(prot)) if prot else ''))

# 替换后残留复扫（应只剩受保护面）
NAMES = [m[0] for m in MAP]
for f in PROT.keys():
    s = rd(f)
    left = sum(s.count(nm) for nm in NAMES)
    REPORT.append('    %s 残留计数: %d' % (f, left))

print('\n'.join(REPORT))
