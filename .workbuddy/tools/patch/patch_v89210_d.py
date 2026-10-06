# -*- coding: utf-8 -*-
"""v89.210 补丁 D —— index.html：环境状态条 chips 样式（插在 .nav-sky .ns-k 之后）"""
import io

P = 'E:/Deepseekdb/index.html'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
n0 = len(s)

OLD = '  .nav-sky .ns-k { color: var(--text-dim); font-weight: 400; letter-spacing: 0; }\n'
mark = '.nav-sky .sky-badge {'
if mark in s:
    print('[skip] D 已落盘')
else:
    assert s.count(OLD) == 1, 'anchor count=' + str(s.count(OLD))
    NEW = OLD + (
        '  /* v89.210（规划三）：环境状态条 —— 非默认态 chips（来犯 / 民心 / 天候 / 逾溢；\n'
        '     数据与生成见 ui.skyBadgesOf / ui.skyBadgeHTML；默认态不显示 = 零噪音）。 */\n'
        '  .nav-sky .sky-badge {\n'
        '    display: inline-flex; align-items: center; gap: var(--sp-0);\n'
        '    padding: var(--sp-0) var(--sp-2); margin-left: var(--sp-1); border-radius: var(--r-sm);\n'
        '    font-weight: 400; letter-spacing: 0; cursor: pointer; user-select: none;\n'
        '    background: rgba(var(--sh-rgb), .44); border: 1px solid var(--line-strong); color: var(--text);\n'
        '  }\n'
        '  .nav-sky .sky-badge.sky-none { cursor: default; }\n'
        '  .nav-sky .sky-badge.sky-war { color: var(--gold-light); border-color: var(--gold-dark); }\n'
        '  .nav-sky .sky-badge.sky-hearts { color: var(--red-light); border-color: var(--red); }\n'
        '  .nav-sky .sky-badge.sky-weather { color: var(--blue-info); }\n'
        '  .nav-sky .sky-badge.sky-rot { color: var(--gold-light); }\n'
    )
    s = s.replace(OLD, NEW)
    assert s.count(mark) == 1
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('[ok] D CSS 状态条')
print('写入 ' + str(n0) + ' -> ' + str(len(s)) + ' 字节')
print('done')
