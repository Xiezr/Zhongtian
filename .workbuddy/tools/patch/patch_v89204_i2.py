# -*- coding: utf-8 -*-
"""v89.204 批次 I2：main.js —— case 'forge-setinfo' 墓碑"""
import io

P = 'E:/Deepseekdb/js/main.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

s = rd(P)
if 'forge-setinfo` 随「套装效果一览」整条退役' in s:
    print('[skip] I2 case')
else:
    old = """      /* v51：套装效果表从打造面板正文移到独立小窗（正文腾出 105px 才放得下两行卡片） */
      case 'forge-setinfo': ui.openForgeSetInfo(); break;"""
    c = s.count(old)
    assert c == 1, 'I2 count=' + str(c)
    new = """      /* \u26d4 v89.204（老板 2）：`case 'forge-setinfo'` 随「套装效果一览」整条退役
         （面板 / 按钮 / 函数一起删，见 ui.js 墓碑；套装数据 DATA.SETS 仍在）。 */"""
    wr(P, s.replace(old, new))
    print('[ok] I2 case')

print('patch I2 done')
