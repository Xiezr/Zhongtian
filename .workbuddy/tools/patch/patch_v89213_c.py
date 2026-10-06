# v89.213 补丁 C：.bottombar padding 对称化（左 92/右 12 → 左右 92）
#   内容盒中轴 760 ≠ 屏幕中轴 720（不对称 padding 致整体右偏 40px）
import io

P = 'E:/Deepseekdb/index.html'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

def rep(tag, old, new, cnt=1):
    global s
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    s = s.replace(old, new)
    print('[ok] ' + tag)

rep('C1 bottombar padding',
    "  .bottombar {\n"
    "    flex: none; height: 46px; display: flex; align-items: center; justify-content: center;\n"
    "    /* v89.52：左留白给最左的「🏷 名称」按钮（绝对定位），避免与居中分页/导航重叠 */\n"
    "    padding: 0 var(--sp-mid) 0 92px; border-top: 1px solid var(--line-strong);",
    "  .bottombar {\n"
    "    flex: none; height: 46px; display: flex; align-items: center; justify-content: center;\n"
    "    /* v89.52：左留白给最左的「🏷 名称」按钮（绝对定位），避免与居中分页/导航重叠。\n"
    "       v89.213（老板「页码集中在中部」）：左 92 / 右 12 不对称会让居中内容整体右偏\n"
    "       40px（内容盒中轴 760 ≠ 屏幕中轴 720）——改**左右对称**，内容轴回到屏幕正中；\n"
    "       右侧顺带为 40px 缩略图（right:10px）留出更大余量。 */\n"
    "    padding: 0 92px; border-top: 1px solid var(--line-strong);")

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written')
