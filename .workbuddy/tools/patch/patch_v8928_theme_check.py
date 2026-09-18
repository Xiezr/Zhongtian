# -*- coding: utf-8 -*-
"""v89.28 题材线（江湖 / 修炼 / 四夷）· check.py 判据 12 扩展

背景：老板 2026-09-18「继续，好像缺少点江湖元素。然后可发掘修炼，功法，少数民族，夷狄等周边地区相关的」。
本补丁只做一件事：把四部**内功秘籍**纳入故事奖赏白名单（供「修炼 / 功法」主题卷作稀见奖赏）。

    book_sunzi   《孙子兵法》 → 内功「庙算」
    book_liutao  《太公六韬》 → 内功「将略」
    book_wuqin   《五禽戏》   → 内功「养生」
    book_yuenv   《越女剑经》 → 内功「剑心」

口径：仍是「既有入库出口」（STORY.applyReward → s.items[id]），无新机制；
原子写（temp + os.replace），不与并行的自动批次读写竞争。
"""
import io
import os
import sys

P = r'E:\Deepseekdb\story\tools\check.py'

OLD_HDR = u'     item 仅 "jingtie" / "lingsui"，且必须带正整数 count）'
NEW_HDR = (u'     item 仅 "jingtie" / "lingsui" + 四部内功秘籍（v89.28 题材线「功法」：\n'
           u'     book_sunzi / book_liutao / book_wuqin / book_yuenv），且必须带正整数 count）')

OLD_SET = u"    _rwi = set(['jingtie', 'lingsui'])"
NEW_SET = u"    _rwi = set(['jingtie', 'lingsui', 'book_sunzi', 'book_liutao', 'book_wuqin', 'book_yuenv'])  # v89.28 +4 内功秘籍"

src = io.open(P, encoding='utf-8', newline='').read()

for old, new, tag in ((OLD_HDR, NEW_HDR, u'头注'), (OLD_SET, NEW_SET, u'白名单')):
    n = src.count(old)
    if n != 1:
        print(u'FAIL [%s] 锚点命中 %d 次' % (tag, n))
        sys.exit(1)
    src = src.replace(old, new, 1)

tmp = P + '.tmp8928'
io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
os.replace(tmp, P)

back = io.open(P, encoding='utf-8', newline='').read()
assert NEW_HDR in back and NEW_SET in back, u'落盘回查失败'
print(u'OK  check.py 判据 12 已扩展（+ book_sunzi / book_liutao / book_wuqin / book_yuenv）')
