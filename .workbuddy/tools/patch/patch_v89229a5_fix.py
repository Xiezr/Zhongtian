# -*- coding: utf-8 -*-
# v89.229 批 a5：修正 —— ① data.js plot 用 node 精确解（渲染逐字节复现尾数）② index.html 裸 #fff → 令牌
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def rep(s, old, new, tag, cnt=1):
    c = s.count(old)
    assert c == cnt, '[%s] count=%d' % (tag, c)
    return s.replace(old, new)

# ---------- ① data.js：plot 精确 HSL（node 解 · rgbOfHsl 渲染往返零误差） ----------
P = 'js/data.js'
s = rd(P); s0 = s
s = rep(s,
"""    gov:  { name: '官府', tone: '行政中枢 · 金 ', plot: { h: 45,   s: 54.9, l: 34   } },
    live: { name: '民生', tone: '基础生计 · 砖陶', plot: { h: 13.4, s: 41.9, l: 40.1 } },
    mil:  { name: '军事', tone: '训练防御 · 钢蓝', plot: { h: 221.4, s: 40.3, l: 41.9 } },
    ops:  { name: '城务', tone: '百业运营 · 铜青', plot: { h: 167.1, s: 40.3, l: 36.2 } }""",
"""    gov:  { name: '官府', tone: '行政中枢 · 金', plot: { h: 45,    s: 55,   l: 34 } },
    live: { name: '民生', tone: '基础生计 · 砖陶', plot: { h: 13.6,  s: 42,   l: 40 } },
    mil:  { name: '军事', tone: '训练防御 · 钢蓝', plot: { h: 221.5, s: 40.5, l: 42 } },
    ops:  { name: '城务', tone: '百业运营 · 铜青', plot: { h: 167.6, s: 40.5, l: 36 } }""",
'plot-precise')
assert s != s0
if not DRY:
    tmp = BASE + P + '.tmp229a5'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P)
    t = rd(P)
    assert 'h: 45,    s: 55,' in t and 'h: 167.6, s: 40.5,' in t
    print('[OK] data.js plot 精确值已更新')
else:
    print('[DRY] data.js 1 处命中')

# ---------- ② index.html：--on-block 令牌 + .nm color ----------
P2 = 'index.html'
s = rd(P2); s0 = s
s = rep(s,
"""    --text: #eae7e0;
    --text-dim: #a8a7af;
    --text-dark: #2a2416;""",
"""    --text: #eae7e0;
    --text-dim: #a8a7af;
    --text-dark: #2a2416;
    --on-block: #fff;              /* v89.229：名称色块上的文字（色块四主题均为中深色 → 恒用白 · 对比 ≥4.5） */""",
'onblock-def')
s = rep(s,
"""  .tile-label .nm {
    min-width: 0; color: #fff;""",
"""  .tile-label .nm {
    min-width: 0; color: var(--on-block);""",
'nm-color')
assert s != s0
if not DRY:
    tmp = BASE + P2 + '.tmp229a5'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P2)
    t = rd(P2)
    assert t.count('--on-block: #fff;') == 1 and 'color: var(--on-block);' in t
    print('[OK] index.html --on-block 已落盘')
else:
    print('[DRY] index.html 2 处命中')
print('A5 DONE%s' % ('（DRY）' if DRY else ''))
