# -*- coding: utf-8 -*-
"""v89.86 · P-20 测试同步：军务总览（全境口径 + 五段结构）"""
import io
import os
import sys

SM = r'E:\Deepseekdb\smoke-test.js'


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


edit(SM, r"""  check('行军视图按本城过滤队列', /filter\(function \(m\) \{ return !c \|\| m\.cityId === c\.id; \}\)/.test(uS31));
  check('行军视图含行军中 + 在外驻军两区', /行军中/.test(uS31) && /在外驻军 · 采集/.test(uS31));""",
     r"""  /* v89.86（整改 P-20）：行军视图 → 军务总览 —— 全境口径（不再按本城过滤）+ 五段结构 */
  check('军务总览为全境口径（行军段不再按本城过滤）',
    /var list = \(s\.marches \|\| \[\]\)\.slice\(\);/.test(uS31) && !/m\.cityId === c\.id/.test(uS31));
  check('军务总览五段就位（城内 / 驻守野地 / 采集队 / 行军 / 伤兵）',
    /① 城内/.test(uS31) && /② 驻守野地/.test(uS31) && /③ 采集队/.test(uS31)
    && /④ 行军/.test(uS31) && /⑤ 伤兵/.test(uS31));""",
     'smoke · P-20 全境与五段')

print('DONE')
