# -*- coding: utf-8 -*-
"""v89.223a：兵牌简称（ab）换代 —— js/data.js 15 步（含两组换位链）+ 终态序列校验。
用法: DRY=1 python patch_v89223a_ab.py   （预检不落盘）
"""
import io, os, re, sys

P = 'js/data.js'
def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

STEPS = [
    ("ab: '民'", "ab: '搬'", 'minfu 搬运工'),
    ("ab: '义'", "ab: '民'", 'yibing 民兵（腾出民）'),
    ("ab: '枪'", "ab: '矛'", 'changqiang 长矛手'),
    ("ab: '弩'", "ab: '重'", 'chuangnu 重弩车（先腾出弩）'),
    ("ab: '弓'", "ab: '弩'", 'gongjian 弩手'),
    ("ab: '轻'", "ab: '摩'", 'qingji 摩托游骑'),
    ("ab: '铁'", "ab: '装'", 'tieji 装甲战车'),
    ("ab: '辎'", "ab: '运'", 'zhouche 运输车'),
    ("ab: '冲'", "ab: '破'", 'chongche 破门车'),
    ("ab: '投'", "ab: '炮'", 'toudan 迫击炮'),
    ("ab: '青'", "ab: '旧'", 'qingzhoubing 旧军残部'),
    ("ab: '藤'", "ab: '防'", 'tengjiabing 防暴甲兵'),
    ("ab: '虎'", "ab: '王'", 'hubaoqi 王牌战车'),
    ("ab: '西'", "ab: '甲'", 'xiliangtieqi 重甲战车'),
    ("ab: '象'", "ab: '兽'", 'nanjiangxiangbing 变异巨兽'),
]
EXPECT = ['搬', '民', '斥', '矛', '盾', '弩', '摩', '装', '运', '重', '破', '炮', '旧', '防', '突', '王', '甲', '兽']
DRY = os.environ.get('DRY') == '1'

s0 = rd(P)
pre = re.findall(r"ab: '([^']*)'", s0)
if pre == EXPECT:
    print('[skip] 终态已在（幂等）')
    sys.exit(0)

s = s0
for old, new, tag in STEPS:
    c = s.count(old)
    assert c == 1, '[%s] count=%d（应为 1）' % (tag, c)
    s = s.replace(old, new)
    print('[ok] %-30s %s -> %s' % (tag, old, new))

seq = re.findall(r"ab: '([^']*)'", s)
print('终态 ab 序列: %s' % ''.join(seq))
assert seq == EXPECT, '终态序列不符: %s' % ''.join(seq)
assert len(seq) == 18 and len(set(seq)) == 18, '唯一性/数量不符'
assert s.count("ab: '") == 18, 'ab 定义数量应为 18，实为 %d' % s.count("ab: '")

if DRY:
    print('DRY 模式：未落盘（15 步全绿）')
else:
    wr(P, s)
    print('已落盘 %s（15 步）' % P)
