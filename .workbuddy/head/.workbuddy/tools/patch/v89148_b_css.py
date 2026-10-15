# -*- coding: utf-8 -*-
"""v89.148 需求 2/3 —— index.html CSS 补丁
   ② 删 .bt-duelbar（斗将顶部行退役）
   ③ 战场布局：播报=底部 1/2 固定 · 示意固定高 330 · 列表限高内滚 · wrap 不滚
"""
import io

P = 'E:/Deepseekdb/index.html'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

def rep(old, new, tag, done_when=None, count=1):
    global s
    if done_when and done_when in s:
        print('  [skip]  ' + tag + '（已落）')
        return
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('  [ok]    ' + tag)

# ---------- ② 删 duelbar + ③ field 定高 ----------
rep(
"""  /* v89.144（老板 1）：战前斗将结果**顶部固定一行**（在 .bt-top 读秒行之上）——
     原来只在回合战况最底（时间最早，要滚到底才看到），还会被 64 行裁剪吃掉。 */
  .bt-duelbar { margin: 0 0 var(--sp-1); padding: var(--sp-1) var(--sp-2); border-radius: var(--r-sm);
    border-left: 3px solid var(--gold-dark); background: rgba(var(--gold-soft-rgb), .07);
    color: var(--gold-light); font-size: var(--fs-sub); }
  .bt-field { position: relative; min-height: 120px; margin: var(--sp-0) 0 var(--sp-3); border-radius: var(--r-xl);""",
"""  /* ⛔ v89.148（老板 2）退役：`.bt-duelbar`（战场最顶的斗将固定行）——
     老板：「这个播报出现在 2 处，**保留回合记录中的就行**」。样式随元素一并删除。
     v89.148（老板 3）：「**战场示意图高度固定**」——`min-height: 120` 改**定高 330**
     （可容 6 队兵牌：6×42 + 21 + 26 ≈ 299 < 330；不再是"内容撑多高就多高"）。 */
  .bt-field { position: relative; height: 330px; margin: var(--sp-0) 0 var(--sp-3); border-radius: var(--r-xl);""",
    '② duelbar 删 + field 定高',
    done_when='.bt-field { position: relative; height: 330px;')

# ---------- ③ bt-board：吃上半区 ----------
rep(
"""  .bt-board { display: grid; grid-template-columns: 1.1fr 3.8fr 1.1fr; gap: var(--sp-2); align-items: start; }""",
"""  /* v89.148（老板 3）：board = **上半区**（flex 吃剩余），固定布局不参与滚动 */
  .bt-board { flex: 1 1 auto; min-height: 0; overflow: hidden;
    display: grid; grid-template-columns: 1.1fr 3.8fr 1.1fr; gap: var(--sp-2); align-items: start; }""",
    '③ bt-board 吃上半区',
    done_when='.bt-board { flex: 1 1 auto; min-height: 0; overflow: hidden;')

# ---------- ③ bt-side：限高内滚 ----------
rep(
"""  .bt-side { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0; }""",
"""  /* v89.148（老板 3）：列表不超过示意图高度（330）· 超出内部滚动 —— 布局高度恒定 */
  .bt-side { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0;
    max-height: 330px; overflow-y: auto; }""",
    '③ bt-side 限高',
    done_when='.bt-side { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0;\n    max-height: 330px;')

# ---------- ③ bt-top：不伸缩 ----------
rep(
"""  .bt-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    gap: var(--sp-4); padding: var(--sp-1) var(--sp-0) var(--sp-3);
    font-size: var(--fs-sub); color: var(--text-dim); }""",
"""  .bt-top { flex: 0 0 auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    gap: var(--sp-4); padding: var(--sp-1) var(--sp-0) var(--sp-3);
    font-size: var(--fs-sub); color: var(--text-dim); }""",
    '③ bt-top 不伸缩',
    done_when='.bt-top { flex: 0 0 auto; display: grid;')

# ---------- ③ #bt-wrap：不滚（固定布局） ----------
rep(
"""  #bt-wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow-y: auto; }""",
"""  /* v89.148（老板 3）：布局**固定不滚** —— 三段（读秒 / 战场 / 播报）各自定高，
     滚动只发生在需要它的子块里（.bt-log / .bt-side）。 */
  #bt-wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }""",
    '③ wrap 不滚',
    done_when='#bt-wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }')

# ---------- ③ .bt-log：底部 1/2 固定 ----------
rep(
"""  .bt-log { flex: 1 1 250px; max-height: 340px; min-height: 130px; overflow-y: auto;
    background: rgba(var(--sh-rgb), .3);""",
"""  /* v89.148（老板 3）：「固定回合播报为**底部二分之一**，位置固定，高度固定」——
     旧口径（flex:1 1 250 + max 340 + min 130）= 随内容在 130~340px 间浮动；
     现在 = **wrap 高度的 50%**（弹窗尺寸固定 → 383px 恒定），位置钉在底部；
     极端载荷（12 队兵牌）由本区**内部滚动**消化（不再压缩自身高度）。 */
  .bt-log { flex: 0 0 50%; max-height: none; min-height: 0; overflow-y: auto;
    background: rgba(var(--sh-rgb), .3);""",
    '③ bt-log 底部 1/2',
    done_when='.bt-log { flex: 0 0 50%; max-height: none;')

assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ALL OK · len ' + str(orig_len) + ' -> ' + str(len(s)))
