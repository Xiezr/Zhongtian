# -*- coding: utf-8 -*-
"""v89.7 补丁修正 b：ui.js 君主面板「头像」行补 IIFE 收尾 `})() +`
（v897 首轮把 (function () { 开了没合上 —— node --check 捕获，这里补齐。）"""
import io, sys

ROOT = r'E:\Deepseekdb'
p = ROOT + r'\js\ui.js'
src = io.open(p, encoding='utf-8', newline='').read()

OLD = """              '<button class="btn sm" data-action="open-avatar-pick">更换</button></td></tr>' +
          '<tr><td class="k">爵位</td><td>' + (cur ? cur.name : '平民') +"""
NEW = """              '<button class="btn sm" data-action="open-avatar-pick">更换</button></td></tr>' +
          })() +
          '<tr><td class="k">爵位</td><td>' + (cur ? cur.name : '平民') +"""

n = src.count(OLD)
if n != 1:
    print('FAIL 锚点命中 %d 次（应为 1）' % n)
    sys.exit(1)
src = src.replace(OLD, NEW, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(src)

back = io.open(p, encoding='utf-8', newline='').read()
assert NEW in back, '落盘回查失败'
print('OK  ui.js 头像行 IIFE 收尾补齐')
