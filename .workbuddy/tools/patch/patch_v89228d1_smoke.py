# -*- coding: utf-8 -*-
"""v89.228 批 D1：smoke 插入 §228 段 + 版本正则三连（v89.227→v89.228）。
用法：DRY=1 python patch_v89228d1_smoke.py / python patch_v89228d1_smoke.py
"""
import io, os

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(BASE + p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
    os.replace(BASE + p + '.tmp', BASE + p)


p = 'smoke-test.js'
s = rd(p)

# 1) 版本正则三连（源码里每个点前是 1 个反斜杠 —— raw 串直写）
old_re = r"GAME\.VERSION = 'v89\.227'"
new_re = r"GAME\.VERSION = 'v89\.228'"
c = s.count(old_re)
print('版本正则命中 ×%d（期望 3）' % c)
assert c == 3, '版本正则计数不符'
s = s.replace(old_re, new_re)

# 2) 插入 §228 段（锚 = 结语行）
frag = rd('.workbuddy/tools/patch/v89228_sec_smoke.txt').rstrip('\n')
anchor = "  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1, '插入锚点 ×%d' % s.count(anchor)
assert '§228（v89.228）' not in s, '已插入过'
s = s.replace(anchor, "  })();\n\n" + frag + "\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');")

if not DRY:
    wr(p, s)
    print('D1 落盘完成')
else:
    print('D1 DRY 完成（版本 ×3 + §228 段插入）')
