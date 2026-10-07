# -*- coding: utf-8 -*-
"""v89.224a2：修复三个被误扫的"需求档案逐字守卫"（回改档案原文），并导出全量档案守卫掩码清单。"""
import io, os, re

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224a2'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)

s = rd('smoke-test.js')
fixes = [
    ("md.indexOf('侦察可能失败，视双方英雄资质和等级差设计')", "md.indexOf('侦察可能失败，视双方将领资质和等级差设计')"),
    ("arc.indexOf('升级时英雄刷新状态')", "arc.indexOf('升级时将领刷新状态')"),
    ("a.indexOf('英雄名称信息下的这行去掉')", "a.indexOf('将领名称信息下的这行去掉')"),
]
for a, b in fixes:
    c = s.count(a)
    assert c == 1, '锚点 %r 出现 %d 次' % (a, c)
    s = s.replace(a, b)
wr('smoke-test.js', s)
print('[fix] 3 处档案守卫回改原文 %s' % ('（DRY）' if DRY else '✓'))

# ---- 导出全量"读档案守卫"清单（供后续批次掩码）----
s2 = rd('smoke-test.js')
lines = s2.split('\n')
guards = []
for i, ln in enumerate(lines):
    if '需求档案.md' in ln:
        # 向上找 check( 起点
        j = i
        for k in range(i, max(0, i - 15), -1):
            if re.search(r"check\('§", lines[k]):
                j = k; break
        # 向下收集 indexOf 串
        seg = '\n'.join(lines[j:i + 14])
        subs = re.findall(r"indexOf\('([^']+)'\)", seg)
        title = re.search(r"check\('([^']+)'", lines[j])
        guards.append((j + 1, title.group(1) if title else '?', subs))
print('\n共 %d 个读档案守卫：' % len(guards))
watch = ['将领', '商城', '凡品', '良材', '英杰', '名世', '天授', '统率', '内政', '勇武', '智谋',
         '军中', '改造', '装备', '播种', '种子', '建材', '资质', '英雄', '游商', '实验室', '派系驻地']
out = []
for ln_no, title, subs in guards:
    hits = []
    for sb in subs:
        for w in watch:
            if w in sb:
                hits.append(sb)
                break
    mark = ' ⚠需掩码' if hits else ''
    out.append('L%d %s%s' % (ln_no, title[:60], mark))
    for h in hits:
        out.append('    引: %s' % h[:90])
io.open(BASE + '.workbuddy/tmp/p224_archive_guards.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('清单已写 .workbuddy/tmp/p224_archive_guards.txt（%d 行）' % len(out))
