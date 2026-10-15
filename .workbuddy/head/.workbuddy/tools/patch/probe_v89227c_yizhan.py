# -*- coding: utf-8 -*-
"""v89.227 探针 C：yizhan/fenghuotai/chengqiang 的操作面 + 其余按钮渲染路径。"""
import io, re

BASE = 'E:/Deepseekdb/'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


u = rd('js/ui.js')
d = rd('js/data.js')
m = rd('js/main.js')

print('========== 1) yizhan / fenghuotai / chengqiang / majiu 在 ui.js 的操作入口 ==========')
for bid in ['yizhan', 'fenghuotai', 'chengqiang', 'majiu', 'cangku', 'minfang']:
    print('--- %s ---' % bid)
    for i, ln in enumerate(u.split('\n'), 1):
        if ("'" + bid + "'") in ln or ('"' + bid + '"') in ln:
            s = ln.strip()
            if any(k in s for k in ['act', 'open', 'label', 'button', 'btn', 'data-action', 'case']):
                print('  L%-6d %s' % (i, s[:170]))
    print()

print('========== 2) 补给的入口（open-yizhan 等）==========')
for pat in ['open-yizhan', 'open-supply', 'open-fenghuotai', 'open-watch', 'open-tower-', "'open-bu'"]:
    c = u.count(pat) + m.count(pat) + d.count(pat)
    if c:
        print('  %s x%d' % (pat, c))
        for i, ln in enumerate(u.split('\n'), 1):
            if pat in ln:
                print('     ui.js L%d  %s' % (i, ln.strip()[:160]))

print()
print('========== 3) main.js 里建筑相关 case ==========')
for i, ln in enumerate(m.split('\n'), 1):
    if re.search(r"case '(open-|bld-|tower-)", ln):
        print('  L%-6d %s' % (i, ln.strip()[:160]))

print()
print('========== 4) 补给站/瞭望塔 的说明文案（data.js desc）==========')
i = d.find('DATA.BUILDINGS = {')
blk = d[i:d.find('\n  };', i)]
for bid in ['yizhan', 'fenghuotai', 'cangku', 'majiu', 'minfang', 'chengqiang']:
    j = blk.find('    %s: {' % bid)
    if j >= 0:
        seg = blk[j:j + 700]
        print('--- %s ---' % bid)
        print(seg[:650].replace('\n', ' | ')[:640])
        print()
