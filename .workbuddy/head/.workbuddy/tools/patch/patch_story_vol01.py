#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""patch_story_vol01.py —— 补足 vol-01 三处幕文字数（每幕 >= 250 判据）

背景：story/tools/check.py 判据 7 要求每幕 >= 250 字，首轮有三处差 8~15 字。
做法：逐条精确替换 + 逐条回查（命中数必须为 1），幂等（重复执行不叠加）。
用法：python .workbuddy/tools/patch/patch_story_vol01.py
"""
import io
import os

ROOT = r'E:\Deepseekdb'
P = os.path.join(ROOT, 'story', 'vol-01.js')

EDITS = [
    # 1) 客栈 n1：伙计那句话补一句，+16 字
    (u'堂中伙计拎着灯路过，低声说了一句：「此人已在店里住了六日，每日只听这一回书。」',
     u'堂中伙计拎着灯路过，低声说了一句：「此人已在店里住了六日，每日只听这一回书 —— 六日六回，一回不多，一回不少。」'),
    # 2) 湖泊 n1：补一句湖面的异样，+28 字
    (u'灯下面没有船，只有一片极静的水面，静得连月亮都沉得更深。',
     u'灯下面没有船，只有一片极静的水面，静得连月亮都沉得更深。湖上无风，浪却一下一下拍着船舷，像有什么东西在水底翻身。'),
    # 3) 湖泊 n2：铜锁补一笔质感，+16 字
    (u'月光照在铜锁上，泛出一点不像铜的青。',
     u'月光照在铜锁上，泛出一点不像铜的青，像沁过水的老玉，握久了手心发沉。'),
]

src = io.open(P, encoding='utf-8', newline='').read()
before = len(src)

for i, (old, new) in enumerate(EDITS, 1):
    n = src.count(old)
    if n != 1:
        print(u'✗ 第 %d 条命中 %d 次（应为 1 次）—— 已中止，文件未写入' % (i, n))
        raise SystemExit(1)
    src = src.replace(old, new)
    print(u'✓ 第 %d 条已替换（+%d 字）' % (i, len(new) - len(old)))

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print(u'落盘完成：%d → %d 字符' % (before, len(src)))

# 落盘核验（不信任编辑工具返回值，重新读盘比对）
chk = io.open(P, encoding='utf-8', newline='').read()
ok = all(chk.count(new) == 1 for _, new in EDITS) and len(chk) == len(src)
print(u'回查：%s' % (u'✓ 三处均已在盘上' if ok else u'✗ 回查不一致'))
raise SystemExit(0 if ok else 1)
