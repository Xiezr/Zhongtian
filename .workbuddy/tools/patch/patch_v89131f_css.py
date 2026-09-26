# -*- coding: utf-8 -*-
"""v89.131 补丁 F：index.html —— 将领档案版面改造
① .gp-body 1/4:3/4（六维|状态 左 1/4，装备栏右 3/4）；顺手删 2183 的死规则
② .gp-doll 2:1（装备图 2/4 · 装备属性汇总 1/4）+ stretch + 汇总列撑满（按钮钉底）
③ .doll 放大（max-width 300→400）· 方槽 54→62 · 图标 22→28
④ 解雇按钮新样式 .gp-nameops（人名行右侧）
⑤ 体力/精力行「＋」样式 .gd-line .gd-plus
用法：python patch_v89131f_css.py
"""
import io

P = 'E:/Deepseekdb/index.html'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    c = s.count(old)
    assert c == 1, '[%s] 锚点 %d 处（需 1）' % (tag, c)
    s = s.replace(old, new)
    n += 1
    print('  OK ' + tag)


# ---------- ① 死规则（被 2250 行同权重后定义覆盖）删除 ----------
rep("""  .gp-body { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  /* ============================================================
   * 左清单（v45 · 需求 1）：**整段可滚、不分页**""",
"""  /* v89.131：这里原有一条 `.gp-body { grid-template-columns: 1fr 1fr }` ——
     与 2250 行的定义同权重且更早，**永远是死规则**（后者胜），一并删除。
     当前分栏口径写在 2250 行（1/4 : 3/4）。 */
  /* ============================================================
   * 左清单（v45 · 需求 1）：**整段可滚、不分页**""",
    '删死规则')

# ---------- ② .gp-body 分栏 ----------
rep("""  .gp-body { display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: var(--sp-5); align-items: start; }""",
"""  /* v89.131（老板）：「六维/状态占左四分之一；装备栏占四分之三，稍微放大一点。
     其中的四分之二为装备图，另四分之一为装备属性汇总」——
     列宽三段合起来 = 4 份：.gp-body 给 1:3，.gp-doll 内部再给 2:1。 */
  .gp-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
    gap: var(--sp-5); align-items: start; }""",
    'gp-body 1:3')

# ---------- ③ .gp-doll 2:1 + stretch ----------
rep("""  .gp-doll { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--sp-4);
    align-items: start; margin-top: var(--sp-3); }
  .gp-dollops { display: flex; gap: var(--sp-2); margin-top: var(--sp-3); }""",
"""  /* v89.131（老板）：「装备图占四分之二、装备属性汇总占四分之一」——
     装备栏（3/4）内部再分 2:1；同时 `align-items: stretch` 让汇总列**撑满人形框高度**
     （老板报的「装备的界面没有占满，底下有留空的一块」就是它：汇总列内容只到 186px，
     而人形框 358px —— 下缘一大片空）。按钮组改 `margin-top:auto` 钉到列底，
     于是汇总列目视从顶到底都排满。 */
  .gp-doll { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--sp-4);
    align-items: stretch; margin-top: var(--sp-3); }
  .gp-dollops { display: flex; gap: var(--sp-2); margin-top: auto; padding-top: var(--sp-3); }""",
    'gp-doll 2:1 + stretch')

# ---------- ④ .doll-side 撑满 ----------
rep("""  .doll-side { min-width: 0; }""",
"""  /* v89.131：汇总列改为纵向 flex —— 与 .gp-doll 的 stretch 配合，
     「装备提供 / 套装进度」在上、按钮组钉底（margin-top:auto）。 */
  .doll-side { min-width: 0; display: flex; flex-direction: column; }""",
    'doll-side flex')

# ---------- ⑤ .doll 放大 ----------
rep("""  /* 人形框尺寸：300×380。
     高度不是随便定的 —— 右栏 = 人形框 + 属性 + 套装 + 按钮，这里是唯一能压的项；
     400px 会把档案顶到 840px、整页溢出 16px（多出一条页面滚动条）。
     min-width 是**方槽不重叠的硬下限**：5 行 × 54px = 270px 高，
     而框高 = 宽 × 19/15，所以宽度低于 230px 时行间距会被压到负数（实测 1024 视口下
     框只有 167×212 → 19 对方槽重叠）。宁可让人形框顶出格子，也不能让方槽叠一起。
     ⚠️ 高度变则 DOLL_POS 的百分比全部要重排（详见 js/ui.js 里那张表）。 */
  .doll { position: relative; width: 100%; max-width: 300px; min-width: 230px;
    margin: 0 auto; aspect-ratio: 15 / 19;""",
"""  /* 人形框尺寸：v46 的 300×380 → v89.131 的 **400×506**（老板「装备栏…稍微放大一点」）。
     放大依据：装备栏拿到 3/4 宽（808px）后，2/4 的格子有 ~529px ——
     300 上限会让框在格子里显得空，故抬到 400（宽 +33%、面积 ×1.78）。
     高度 = 宽 × 19/15（aspect-ratio 不动 → DOLL_POS 的百分比落点全部照旧）；
     视图页允许滚动（§30.3），不再为"不出现滚动条"把框压小。
     min-width 是**方槽不重叠的硬下限**：5 行 × 62px = 310px 高，
     而框高 = 宽 × 19/15，所以宽度低于 250px 时行间距会被压到负数。
     宁可让人形框顶出格子，也不能让方槽叠一起。
     ⚠️ 高度变则 DOLL_POS 的百分比全部要重排（详见 js/ui.js 里那张表）。 */
  .doll { position: relative; width: 100%; max-width: 400px; min-width: 230px;
    margin: 0 auto; aspect-ratio: 15 / 19;""",
    'doll max-width 400')

# ---------- ⑥ 方槽 54→62 / 图标 22→28 ----------
rep("""  .doll-slot { position: absolute; width: 54px; height: 54px; margin-left: -27px;
    min-height: 0; gap: var(--sp-hair); z-index: 3; }""",
"""  /* v89.131：方槽 54→62、图标 22→28（跟随人形框放大；排版预算见下方
     "槽位内三行装得下" 的实算：2+4+11+1+28+1+11 = 58 ≤ 62，余 4px）。 */
  .doll-slot { position: absolute; width: 62px; height: 62px; margin-left: -31px;
    min-height: 0; gap: var(--sp-hair); z-index: 3; }""",
    'slot 62')

rep("""  .doll-slot .eq-ico { width: 22px; height: 22px; margin-top: 0; }""",
"""  .doll-slot .eq-ico { width: 28px; height: 28px; margin-top: 0; }""",
    'slot icon 28')

# ---------- ⑦ 解雇按钮（人名行右侧） ----------
rep("""  .gp-ops .btn { min-width: 92px; }""",
"""  .gp-ops .btn { min-width: 92px; }
  /* v89.131（老板）：「解雇放在人名所在行右侧，稍带点距离」——
     margin-left:auto 把按钮推到人名行的右缘（flex 行内“右侧”的标准解法），
     padding-left 留出与姓名/标签的间距（"稍带点距离"）。 */
  .gp-nameops { margin-left: auto; padding-left: var(--sp-5); flex: none; }""",
    'gp-nameops')

# ---------- ⑧ 体力/精力行的「＋」 ----------
rep("""  .gd-dims .gd-plus { padding: 0 var(--sp-3); line-height: var(--lh-body); }""",
"""  .gd-dims .gd-plus { padding: 0 var(--sp-3); line-height: var(--lh-body); }
  /* v89.131：体力/精力行的「＋」（道具入口）—— 与六维表里的 gd-plus 同款
     （行内贴右；.gd-line 是 flex，margin-left:auto 把它推到行尾）。 */
  .gd-line .gd-plus { margin-left: auto; padding: 0 var(--sp-3); line-height: var(--lh-body); flex: none; }""",
    'gd-line gd-plus')

assert s != orig and n == 9, 'n=%d' % n
assert 'max-width: 400px' in s and 'width: 62px; height: 62px' in s and 'gp-nameops' in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch F(css) OK · %d 处' % n)
