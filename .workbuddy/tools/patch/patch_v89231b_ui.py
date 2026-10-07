# -*- coding: utf-8 -*-
"""v89.231 批次 b：ui.js 分组渲染 + 文案换代 + index.html 分组样式
① techHTML：rows 生成改为按 DATA.TECH_CATS 分节
② 玩家文案：'（城防技术已折扣）'→'（防御工事已折扣）' · '技巧每级 -5%'→'逆向工程每级 -5%'
③ 注释旧名全局替换（侦察技巧/城防技术）
④ index.html：.tbl .tech-cat td 样式
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

REPORT = []
P = 'js/ui.js'
s = rd(P)
s_orig = s

# ---------- ① techHTML 分组 ----------
old_head = "var rows = DATA.TECH.map(function (t) {"
new_head = "var rowOf = function (t) {"
c = s.count(old_head)
assert c == 1, 'head count=%d' % c
s = s.replace(old_head, new_head)

old_tail = """        '<td class="ctr">' + btn + '</td></tr>';
    }).join('');"""
new_tail = """        '<td class="ctr">' + btn + '</td></tr>';
    };
    /* v89.231（老板「调整科技体系」）：**分组渲染** —— 按 DATA.TECH_CATS 分节
       （唯一分组源；分组缺失/空组自动跳过，兜底不吞行）。 */
    var rows = (DATA.TECH_CATS || [{ key: null, name: '' }]).map(function (cat) {
      var inner = DATA.TECH.filter(function (t) { return cat.key == null || t.cat === cat.key; })
        .map(rowOf).join('');
      if (!inner) return '';
      var head = cat.name ? '<tr class="tech-cat"><td colspan="4">' + cat.name + '</td></tr>' : '';
      return head + inner;
    }).join('');"""
c = s.count(old_tail)
assert c == 1, 'tail count=%d' % c
s = s.replace(old_tail, new_tail)
REPORT.append('[ok] techHTML 分组渲染')

# ---------- ② 玩家文案 ----------
for old, new, tag in [
    ("'（城防技术已折扣）'", "'（防御工事已折扣）'", 'wall-discount'),
    ('>技巧每级 -5%<', '>逆向工程每级 -5%<', 'study-line'),
]:
    c = s.count(old)
    assert c == 1, '%s count=%d' % (tag, c)
    s = s.replace(old, new)
REPORT.append('[ok] 玩家文案 ×2（防御工事已折扣 · 逆向工程每级）')

# ---------- ③ 注释旧名全局替换 ----------
for old, new in [('侦察技巧', '侦察网络'), ('城防技术', '防御工事')]:
    c = s.count(old)
    REPORT.append('    ui.js %s ×%d' % (old, c))
    s = s.replace(old, new)

assert len(s) > len(s_orig), 'size sanity'
wr(P, s)

# ---------- ④ index.html 样式 ----------
P2 = 'index.html'
h = rd(P2)
anchor = "  .tbl tr:nth-child(even) td { background: rgba(var(--sh-rgb),.05); }"
add = anchor + """
  /* v89.231：研习所科技分组标题行（DATA.TECH_CATS · 每节一行，四列合 colspan） */
  .tbl .tech-cat td {
    background: rgba(var(--sh-rgb),.5);
    color: var(--gold-light);
    font-weight: 700;
    font-size: var(--fs-sub);
    letter-spacing: 2px;
    padding: var(--sp-1) var(--sp-3);
    text-align: center;
  }"""
c = h.count(anchor)
assert c == 1, 'css anchor count=%d' % c
h = h.replace(anchor, add)
wr(P2, h)
REPORT.append('[ok] index.html .tech-cat 样式')

print('\n'.join(REPORT))
