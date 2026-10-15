# -*- coding: utf-8 -*-
"""v89.232 批次 A2（ui 标题修正）+ 批次 B（测试面同步）
A2：'⚔️ 派系驻地' 标题（锚点含 > 前缀）
B： smoke/e2e 连带同步（断言串/断言名/注释——描述现行产品文案的部分）
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

REPORT = []
ERR = []

def rep(f, tag, old, new, cnt=1):
    s = rd(f)
    c = s.count(old)
    if c != cnt:
        ERR.append('%s · %s: count=%d (want %d)' % (f, tag, c, cnt))
        return
    s = s.replace(old, new)
    wr(f, s)
    REPORT.append('[ok] %s · %s' % (f, tag))

# ---------- A2 ----------
rep('js/ui.js', 'sect.title2', ">⚔️ 派系驻地' + (lv", ">⚔️ 派系' + (lv")

# ---------- B: smoke ----------
S = 'smoke-test.js'
# ① 断言：检查产品源码串（必须同源）
rep(S, 'assert.costline', '（金：全境通用 · 粮木石铁：按本城结算）', '（金：全境通用 · 净水/生物质/电能/废钢：按本城结算）')
# ② 断言名（天时）
rep(S, 'assert.tian.shi', "check('天时对粮产有乘数'", "check('天时对净水有乘数'")
rep(S, 'assert.tian.xue', "check('雪天粮产低于木产'", "check('雪天净水低于生物质'")
# ③ 注释（描述现行产品文案）
rep(S, 'note.weather', '（远程射程 −20% / 粮产 −15% / 行军 −20%）', '（远程射程 −20% / 净水 −15% / 行军 −20%）')
rep(S, 'note.grain0', '新局有初始余粮，否则"缺粮"不成立', '新局有初始净水，否则"缺水"不成立')
rep(S, 'note.sect1', '找一个格子临时放派系驻地', '找一个格子临时放基因实验室（honglusi）')
rep(S, 'note.sect2', '没建派系驻地 → 入派与立派都必须拒', '没建基因实验室 → 入派与立派都必须拒')

# ---------- B: e2e ----------
E = 'e2e-test.js'
rep(E, 'note.cargo', '辎重区 = 四行（粮木石铁）', '辎重区 = 四行（净水/生物质/电能/废钢）')
rep(E, 'assert.cargo', '调运：辎重区 = 四行货品（粮木石铁 · v89.161 起金不通运）',
    '调运：辎重区 = 四行货品（净水/生物质/电能/废钢 · v89.161 起金不通运）')
rep(E, 'note.sect', '真实点击链：临时放一座派系驻地', '真实点击链：临时放一座基因实验室（honglusi）')

print('\n'.join(REPORT))
if ERR:
    print('\n!!! 失败项：')
    print('\n'.join(ERR))
else:
    print('\n全部 %d 处落地。' % len(REPORT))
