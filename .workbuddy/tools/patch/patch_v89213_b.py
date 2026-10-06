# v89.213 补丁 B：ui.js 两处分页出口注释改口径（三栏 → 整体居中）
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

def rep(tag, old, new, cnt=1):
    global s
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    s = s.replace(old, new)
    print('[ok] ' + tag)

# ---- B1: pagerInnerHTML 头注释 ----
rep('B1 pagerInnerHTML 注释',
    "  /* 纯函数：只产出分页条的 HTML（供底部条与测试直接调用）。\n"
    "     v89.204（老板 2）：「其页码固定显示位置为居中，其他菜单按钮位置合理排布」——\n"
    "     三栏 grid（1fr auto 1fr）：左 = 前导导航（首页/上页/数字页）· 中 = 页码信息\n"
    "     （**恒定居中**）· 右 = 后导导航（下页/末页）。左右等宽 ⇒ 中栏永远落在正中央\n"
    "     （与两侧按钮多少无关）。同款结构见 modalPagerHTML。 */",
    "  /* 纯函数：只产出分页条的 HTML（供底部条与测试直接调用）。\n"
    "     v89.213（老板）：「页码集中在中部，不要分散至两边，导致和其他菜单重叠住了」——\n"
    "     v89.204 的三栏 grid（前导/页码/后导分居两端）退役：底栏里左栏按钮撞进\n"
    "     「🏷 隐藏名称 / ⚔ 指挥战斗」（.bb-tools · 实测重叠 95px、按钮被盖住）。\n"
    "     现为**整体居中 flex**（CSS 在 .pager）：l → 页码 → r 三块作为一个整体排在中轴，\n"
    "     两侧自动留白。同款结构见 modalPagerHTML。 */")

# ---- B2: modalPagerHTML 头注释 ----
rep('B2 modalPagerHTML 注释',
    "  /* 弹窗分页条（按钮走 action=mpage → ui.setModalPage）\n"
    "     v89.204（老板 2）：三栏结构（页码恒定居中）—— 与 ui.pagerInnerHTML 同款。 */",
    "  /* 弹窗分页条（按钮走 action=mpage → ui.setModalPage）\n"
    "     v89.213（老板）：与 ui.pagerInnerHTML 同款 —— 整体居中的 flex 排布（三栏退役）。 */")

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written')
