# -*- coding: utf-8 -*-
"""v89.144 老板 4 条 —— index.html CSS 补丁
   ① .bt-duelbar（斗将顶部固定行）
   ② .exp-tbl 列宽（第 4 列两键）
   ④ .exp-sel.act-row（label 定宽 / 下拉 20em）
"""
import io

P = 'E:/Deepseekdb/index.html'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

def save(tag):
    assert '\r\n' not in s, '行尾被写成 CRLF'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('  [saved] ' + tag + '  len=' + str(len(s)))

def rep(old, new, tag, done_when=None, count=1):
    global s
    if done_when and done_when in s:
        print('  [skip]  ' + tag + '（已落）')
        return
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('  [ok]    ' + tag)

# ---------- ① .bt-duelbar ----------
rep(
"""  .bt-top .bt-hint { justify-self: end; text-align: right; opacity: .72; font-size: var(--fs-cap); }""",
"""  .bt-top .bt-hint { justify-self: end; text-align: right; opacity: .72; font-size: var(--fs-cap); }
  /* v89.144（老板 1）：战前斗将结果**顶部固定一行**（在 .bt-top 读秒行之上）——
     原来只在回合战况最底（时间最早，要滚到底才看到），还会被 64 行裁剪吃掉。 */
  .bt-duelbar { margin: 0 0 var(--sp-1); padding: var(--sp-1) var(--sp-2); border-radius: var(--r-sm);
    border-left: 3px solid var(--gold-dark); background: rgba(var(--gold-soft-rgb), .07);
    color: var(--gold-light); font-size: var(--fs-sub); }""",
    '① .bt-duelbar',
    done_when='.bt-duelbar { margin:')

# ---------- ② exp-tbl 列宽 ----------
rep(
"""  .exp-tbl .et-c-name { width: 42%; }
  .exp-tbl .et-c-own { width: 22%; }
  .exp-tbl .et-c-in { width: 21%; }
  .exp-tbl .et-c-act { width: 15%; }""",
"""  /* v89.144（老板 2）：第 4 列由单键「全」改成 [上限][清空] 两键 → 列宽 15% → 22%，
     其余三列同步收窄（合计仍 100%）。 */
  .exp-tbl .et-c-name { width: 40%; }
  .exp-tbl .et-c-own { width: 19%; }
  .exp-tbl .et-c-in { width: 19%; }
  .exp-tbl .et-c-act { width: 22%; }
  .exp-tbl .et-act { white-space: nowrap; text-align: center; }
  .exp-tbl .et-act .btn + .btn { margin-left: var(--sp-1); }""",
    '② exp-tbl 列宽',
    done_when='.exp-tbl .et-act .btn + .btn')

# ---------- ④ .exp-sel.act-row ----------
rep(
"""  .exp-sel > select:disabled { opacity: .55; }""",
"""  .exp-sel > select:disabled { opacity: .55; }
  /* v89.144（老板 4）：目标下拉**固定位置与长度** —— label 定宽（以「我方城池」行为基准）、
     下拉定宽 20 个中文（20em）；5 行起点/长度完全一致；行内不再有「共 N · 列最近 N」备注。 */
  .exp-sel.act-row { margin: 4px 0; }
  .exp-sel.act-row > label { min-width: 108px; }
  .exp-sel.act-row > select.act-sel { flex: 0 0 auto; width: 20em; max-width: 20em; }
  .exp-sel.act-row .act-none { flex: 0 0 auto; }""",
    '④ .exp-sel.act-row',
    done_when='.exp-sel.act-row > select.act-sel')

save('index.html 全部')
print('\nALL OK · len ' + str(orig_len) + ' -> ' + str(len(s)))
