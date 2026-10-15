# -*- coding: utf-8 -*-
"""v89.86 顺手修复（真 bug · 存量数据）：随机任务 r07 / r09 的兵种 id 对不上
   · r07「铁骑成军」sub 'tieqi'  → 兵种实际 id 为 'tieji'（铁骑兵）
   · r09「飞石破城」sub 'toushiche' → 兵种实际 id 为 'toudan'（投石车）
   后果：questMetric('troopCount', sub) 恒为 0 → 这两条任务**永远做不完**（占每日名额）。
   发现方式：P-08 可达性过滤探针扫描 sub 对齐时暴露。
"""
import io
import os
import sys

QD = r'E:\Deepseekdb\js\questdata.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


edit(QD, r"""    { id: 'r07', title: '铁骑成军', type: 'military', desc: '甲骑具装，正面破阵。', metric: 'troopCount', sub: 'tieqi', goal: 20,""",
     r"""    /* v89.86 修 bug：sub 'tieqi' → 'tieji'（兵种实际 id；原值导致该任务永远 0/20 做不完） */
    { id: 'r07', title: '铁骑成军', type: 'military', desc: '甲骑具装，正面破阵。', metric: 'troopCount', sub: 'tieji', goal: 20,""",
     'r07 · tieqi → tieji')

edit(QD, r"""    { id: 'r09', title: '飞石破城', type: 'military', desc: '投石之威，可碎城楼。', metric: 'troopCount', sub: 'toushiche', goal: 5,""",
     r"""    /* v89.86 修 bug：sub 'toushiche' → 'toudan'（兵种实际 id；原值导致该任务永远 0/5 做不完） */
    { id: 'r09', title: '飞石破城', type: 'military', desc: '投石之威，可碎城楼。', metric: 'troopCount', sub: 'toudan', goal: 5,""",
     'r09 · toushiche → toudan')

print('DONE')
