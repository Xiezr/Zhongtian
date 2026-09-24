# -*- coding: utf-8 -*-
"""v89.117 补丁 B2（重写）—— 军务处两卡改走 ui.campCard

⚠️ 首版翻车点：锚点 `'<div class="story-card"><div class="gold-heading">🏥 伤兵营（本境）' +`
在新加的 `ui.campCard` 里**也有一份**（campCard 的 full 分支就是它）——
`s.find` 取到的是 campCard 里那处，切片范围把 campCard 后半截和军务处的函数头一起吞了。
（**没落盘**：脚本是"先定位→再校验→最后写"，校验当场报 0 次匹配并退出。）
规矩：① 锚点**先数重复**；② 长块切口用"函数定位 + 从该点向后找"。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
p = 'js/ui.js'
s = io.open(R + p, encoding='utf-8').read()

START = "    return '<div class=\"story-card\"><div class=\"gold-heading\">🏥 伤兵营（本境）' +"
END = "      '<div class=\"story-card\"><div class=\"gold-heading\">🧾 兵源与征募'"
FN = 'ui.marchAffairsHTML = function () {'

fn = s.find(FN)
a = s.find(START, fn)
b = s.find(END, a)
print('  锚点出现次数：START %d / END %d / 函数 %d' % (s.count(START), s.count(END), s.count(FN)))
print('  切口：函数 @%d → 卡首 @%d → 卡尾 @%d（长 %d）' % (fn, a, b, b - a))
if not (0 < fn < a < b):
    print('!! 定位失败'); sys.exit(1)
print('  切片头 90 字：%r' % s[a:a + 90])
print('  切片尾 90 字：%r' % s[b - 90:b])

NEW = "    return ui.campCard('wounded') + ui.campCard('captive') +\n"
s2 = s[:a] + NEW + s[b:]

# 写前自检：两个函数的壳都还在、切片处只换了一行
for must in ['ui.campCard = function (kind, opts)', 'ui.marchAffairsHTML = function () {',
             '🧾 兵源与征募', "ui.armyBreakdownRows = function"]:
    if must not in s2:
        print('!! 自检失败：丢了 %r' % must); sys.exit(1)
if s2.count("ui.campCard('wounded') + ui.campCard('captive')") != 1:
    print('!! 自检失败：替换点不对'); sys.exit(1)

# 死变量清点：这两个在此后再无消费点
DEAD = ["    var wounded = s.wounded || 0;\n",
        "    var parts = [];\n"
        "    Object.keys(s.woundedArmy || {}).forEach(function (k) {\n"
        "      if ((s.woundedArmy[k] || 0) > 0) parts.push((DATA.TROOPS[k] ? DATA.TROOPS[k].name : k) + ' ' + U.numText(s.woundedArmy[k], 0));\n"
        "    });\n",
        "    var captN = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;\n"]
for d in DEAD:
    n = s2.count(d)
    if n != 1:
        print('!! 待删局部量匹配 %d 次（保留不动，不阻断本次落盘）：%r' % (n, d[:40]))
        continue
    s2 = s2.replace(d, '', 1)
    print('  ✓ 删掉无消费的局部量 %r' % d[:38])

tmp = R + p + '.tmp117b3'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s2)
os.replace(tmp, R + p)
print('补丁 B2（重写）完成')
