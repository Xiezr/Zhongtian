# -*- coding: utf-8 -*-
"""v89.222b · 用例文件旧词全面更换（e2e-test.js）"""
import io, sys, os

R = 'E:/Deepseekdb/'
P = 'e2e-test.js'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

s = rd(P)
s0 = s
bad = []
log = []

def rep(tag, old, new, expect=1):
    global s
    c = s.count(old)
    if c == expect:
        s = s.replace(old, new)
        log.append('[ok]   %s x%d' % (tag, c)); return
    if c == 0 and new and s.count(new) >= 1:
        log.append('[skip] %s（已落盘）' % tag); return
    bad.append('%s count=%d expect=%d | %s' % (tag, c, expect, old[:70]))

rep('E1 下拉选项标题', '（选项 = 州郡县 + 坐标）', '（选项 = 区镇落 + 坐标）')
rep('E2 下拉全称标题', '下拉框选项含州郡县全称与坐标', '下拉框选项含区镇落全称与坐标')
rep('E3 雨天注释', '（雨：弓兵射程 −20%/行军 −20%）', '（雨：远程射程 −20%/行军 −20%）')
rep('E4 步骑分类', '步骑分类对调', '步兵/机车分类对调')

GLOBAL = [('长枪', '长矛手'), ('弓兵', '弩手'), ('象兵', '变异巨兽'), ('许都', '灰岗')]
for old, new in GLOBAL:
    c = s.count(old)
    s = s.replace(old, new)
    log.append('[glob] %s→%s x%d' % (old, new, c))

if bad:
    print('\n'.join(log)); print('\n❌ 失配 %d：' % len(bad))
    for b in bad: print('   ' + b)
    sys.exit(1)

if DRY:
    print('\n'.join(log)); print('\n[dry] 未落盘（%d → %d）' % (len(s0), len(s))); sys.exit(0)

wr(P, s)
print('\n'.join(log))
print('\n✅ v89.222b 落盘（%d → %d 字符）' % (len(s0), len(s)))
