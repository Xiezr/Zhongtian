# -*- coding: utf-8 -*-
"""v89.3 横幅接线 —— js/ui.js：雅名（alias）+ 门类章（cat 兜底 kind）"""
import io

P = r'E:\Deepseekdb\js\ui.js'
d = io.open(P, encoding='utf-8', newline='').read()

OLD = r"""    h += '<span class="sxf-hero-name">' + U.escape(a.name) + '</span>';
    h += '<span class="sxf-hero-kind">' + U.escape(ui.SXF_KIND[a.kind] || '江湖') + '</span>';"""

NEW = r"""    h += '<span class="sxf-hero-name">' + U.escape(a.name) + '</span>';
    /* v89.3：雅名（alias）与门类章（cat 兜底 kind）—— 命名体系统一 */
    if (a.alias) h += '<span class="sxf-hero-alias">' + U.escape(a.alias) + '</span>';
    h += '<span class="sxf-hero-kind">' + U.escape(a.cat || ui.SXF_KIND[a.kind] || '江湖') + '</span>';"""

if 'sxf-hero-alias' in d:
    print('SKIP ui.js 已接线')
else:
    c = d.count(OLD)
    if c != 1:
        raise SystemExit('!! ui.js 锚点异常（出现 %d 次）' % c)
    d = d.replace(OLD, NEW, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK ui.js 横幅雅名 + 门类章接线')
