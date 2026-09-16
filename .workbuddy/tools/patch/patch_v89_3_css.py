# -*- coding: utf-8 -*-
"""v89.3 样式 —— index.html：.sxf-hero-alias（雅名金色小字）

守则：字号用令牌（--fs-sub）、颜色用变量（--gold），零裸像素 / 零硬编码色。
"""
import io

P = r'E:\Deepseekdb\index.html'
d = io.open(P, encoding='utf-8', newline='').read()

assert '--gold:' in d, '缺 --gold 变量'

OLD = r"""  .sxf-hero-kind { color: var(--text-dim); font-size: var(--fs-cap); border: 1px solid var(--line-strong);
    border-radius: 999px; padding: 1px 8px; }"""

NEW = r"""  .sxf-hero-kind { color: var(--text-dim); font-size: var(--fs-cap); border: 1px solid var(--line-strong);
    border-radius: 999px; padding: 1px 8px; }
  .sxf-hero-alias { color: var(--gold); font-size: var(--fs-sub); opacity: .92; }"""

if '.sxf-hero-alias {' in d:
    print('SKIP index.html 已含 .sxf-hero-alias')
else:
    c = d.count(OLD)
    if c != 1:
        raise SystemExit('!! index.html 锚点异常（出现 %d 次）' % c)
    d = d.replace(OLD, NEW, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK index.html 已加 .sxf-hero-alias')
