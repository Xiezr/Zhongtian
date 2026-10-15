# -*- coding: utf-8 -*-
"""v89.222 · 残留验证：旧词在用例文件里的最终分布（对照保留面）"""
import io

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()

OLD = ['长枪', '轻骑', '铁骑', '虎豹', '突骑', '西凉', '象兵', '青州', '刀盾', '藤甲', '投石',
       '弓兵', '弓箭', '弓手', '枪兵', '骑兵', '床弩',
       '州城', '州治', '郡城', '郡治', '县城', '都城', '帝都', '太守', '州郡',
       '洛阳', '司隶', '宛县', '许都', '邺城',
       '渠帅', '贼首', '山君', '寨主', '渠魁', '豪帅', '贼寇']

for f in ['smoke-test.js', 'e2e-test.js']:
    s = rd(f)
    lines = s.split('\n')
    print('===== %s =====' % f)
    tot = 0
    for i, ln in enumerate(lines, 1):
        hit = [w for w in OLD if w in ln]
        if hit:
            tot += len(hit)
            print('L%-6d (%s) %s' % (i, ','.join(hit), ln.strip()[:150]))
    print('--- 命中 %d 处 ---' % tot)
