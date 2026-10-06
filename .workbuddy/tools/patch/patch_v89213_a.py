# v89.213 补丁 A：分页条改「整体居中 flex」（三栏 grid 退役）
#   · .pager：display:grid 1fr auto 1fr → display:flex; justify-content:center
#   · 删 .pg-side.l/.r 的方向性 justify（不再顶两端）+ only-child grid-column（flex 天然居中）
#   · .bottombar .pager：margin 0 52px 0 0 → 0（整体居中后无需右留 52px；不对称 margin 会让中点偏左 26px）
import io, sys

P = 'E:/Deepseekdb/index.html'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

def rep(tag, old, new, cnt=1):
    global s
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    s = s.replace(old, new)
    print('[ok] ' + tag)

# ---- A1: 底栏 pager 注释与 margin ----
rep('A1 底栏 pager',
    "  .bottombar .pager {\n"
    "    /* v89.204：三栏满行后右缘贴到条尾 —— 留 52px 给绝对定位的缩略图（40px + right 10px） */\n"
    "    margin: 0 52px 0 0; padding: var(--sp-1) var(--sp-4); background: transparent; border: none;\n"
    "  }",
    "  .bottombar .pager {\n"
    "    /* v89.213（老板）：「页码集中在中部，不要分散至两边，导致和其他菜单重叠住了」——\n"
    "       改**整体居中**后条不再满行铺开，两侧（左 10~197px 的 bb-tools「🏷/⚔」、右 1390px\n"
    "       的缩略图）天然留白；v89.204 的「右留 52px」随三栏布局一起退役（不对称 margin 会让\n"
    "       中点偏左 26px）。 */\n"
    "    margin: 0; padding: var(--sp-1) var(--sp-4); background: transparent; border: none;\n"
    "  }")

# ---- A2: .pager 本体 grid → flex 居中（含注释改写） ----
rep('A2 pager 头注释+grid',
    "  /* v89.204（老板 2）：「其页码固定显示位置为居中，其他菜单按钮位置合理排布」——\n"
    "     三栏 grid：左 = 前导导航（首页/上页/数字页）· 中 = 页码信息**恒定居中** ·\n"
    "     右 = 后导导航（下页/末页）。左右 1fr 等宽 ⇒ 中栏永远落在正中央（与按钮多少无关）。\n"
    "     width:100%：在弹窗 foot / 底栏（均为 flex 容器）里独占满行，\"居中\"才是整条的中轴。 */\n"
    "  .pager {\n"
    "    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%;",
    "  /* v89.213（老板）：「页码集中在中部，不要分散至两边，导致和其他菜单重叠住了」——\n"
    "     改前是 v89.204 的三栏 grid（前导/页码/后导分居两端）：底栏里左栏按钮直接撞进\n"
    "     「🏷 隐藏名称 / ⚔ 指挥战斗」（.bb-tools · 绝对定位 left:10px · 实测重叠 95px，\n"
    "     按钮被盖住、点「首页」实际点到「隐藏名称」）。改后 = **整体居中 flex**：首页/上页/\n"
    "     数字页 + 页码 + 下页/末页 作为一个整体排在中轴（justify-content:center），两侧\n"
    "     自动留白、与 bb-tools / 缩略图天然不重叠。DOM 结构不变（l → pg-info → r 顺序），\n"
    "     只改排布方向；超长（数字页满档）时 flex-wrap 兜底换行。\n"
    "     width:100%：在弹窗 foot / 底栏（均为 flex 容器）里独占满行，居中即整条中轴。 */\n"
    "  .pager {\n"
    "    display: flex; justify-content: center; align-items: center; flex-wrap: wrap; width: 100%;")

# ---- A3: 删方向性 justify 两条（.l/.r 不再顶两端） ----
rep('A3 删方向 justify',
    "  .pager .pg-side.l { justify-content: flex-start; }\n"
    "  .pager .pg-side.r { justify-content: flex-end; }\n",
    "")

# ---- A4: 删 only-child grid-column（flex 下天然居中） ----
rep('A4 删 only-child',
    "  /* 单元素态（暂无记录 / 共 N 项）：独立居中（三栏 grid 下默认会落左栏） */\n"
    "  .pager > .pg-info:only-child { grid-column: 2; }\n",
    "")

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written')
