# -*- coding: utf-8 -*-
"""v90.12（老板 1）：废土化资源重设 —— 建筑/兵种「少木料、重废钢」。
   建筑 buildCost：wood×0.35 · stone（碎石）×1.35 · iron（废钢）×1.8
   兵种 cost：      wood×0.4  · iron×1.6
   （grain 净水不变；只动数字，不增删资源种类。）"""
import re

SRC = r"E:/Deepseekdb/js/data.js"
t = open(SRC, encoding="utf-8").read()

def nice(n):
    n = int(round(n))
    if n < 100: return n
    if n < 1000: return int(round(n / 5.0) * 5)
    if n < 10000: return int(round(n / 50.0) * 50)
    return int(round(n / 500.0) * 500)

def scale_block(block, factors):
    def rep(m):
        k, v = m.group(1), int(m.group(2))
        return '%s: %d' % (k, nice(v * factors.get(k, 1.0)))
    return re.sub(r'(grain|wood|stone|iron|gold|cloth|horse): (\d+)', rep, block)

# 建筑 buildCost
BC = {'wood': 0.35, 'stone': 1.35, 'iron': 1.8}
def do_build(m):
    block = m.group(1)
    return 'buildCost: {' + scale_block(block, BC) + '}'
t2 = re.sub(r'buildCost: \{([^}]*)\}', do_build, t)

# 兵种 cost（含 grain 的 cost:{} 块 = 兵种/器械）
TC = {'wood': 0.4, 'iron': 1.6}
def do_troop(m):
    block = m.group(1)
    if 'grain' not in block:   # 只动兵种（都含 grain），跳过宝物类 cost
        return m.group(0)
    return 'cost: {' + scale_block(block, TC) + '}'
t3 = re.sub(r'cost: \{([^}]*)\}', do_troop, t2)

open(SRC, "w", encoding="utf-8").write(t3)
print("done. buildCost 块数:", len(re.findall(r'buildCost: \{', t3)),
      " / 兵种 cost 块数:", len([1 for m in re.finditer(r'cost: \{([^}]*)\}', t3) if 'grain' in m.group(1)]))
