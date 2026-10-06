# v89.213 补丁 F：① shot_v89204_gates.js 两处"页码居中"判据 → 内容块居中（v89.213 口径）
#   ② diag_v89213_pager.js 截图路径改名（防多次跑覆盖"改前图"——§63.6 纪律）
import io, os

# ---- F1/F2: shot_v89204_gates.js ----
P = 'E:/Deepseekdb/.workbuddy/tools/show/shot_v89204_gates.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

def rep(path_s, tag, old, new, cnt=1):
    global s
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    s = s.replace(old, new)
    print('[ok] ' + tag)

# F1: ①b（弹窗）——diff 口径改内容块
rep(P, 'F1 ①b 口径',
    "    var pr = pg.getBoundingClientRect(), mr = mid.getBoundingClientRect();\n"
    "    var diff = Math.round(((mr.left + mr.right) / 2 - (pr.left + pr.right) / 2) / k * 10) / 10;\n"
    "    return {\n"
    "      pages: document.querySelectorAll('#modal-root .pager').length,",
    "    var pr = pg.getBoundingClientRect();\n"
    "    /* v89.213 口径变更：三栏退役 → 内容块（l 组左缘~r 组右缘）整体居中 */\n"
    "    var lr = l.getBoundingClientRect(), rr = r.getBoundingClientRect();\n"
    "    var diff = Math.round(((lr.left + rr.right) / 2 - (pr.left + pr.right) / 2) / k * 10) / 10;\n"
    "    return {\n"
    "      pages: document.querySelectorAll('#modal-root .pager').length,")
rep(P, 'F1b ①b 标题',
    "  chk('①b 页码**居中**（页码中点 − 条中点 = ' + r1.diff + 'px，|差| ≤ 2）',",
    "  chk('①b 内容块**居中**（l 左缘~r 右缘中点 − 条中点 = ' + r1.diff + 'px，|差| ≤ 2 · v89.213 口径）',")

# F2: ③a（底栏）——diff 口径改内容块
rep(P, 'F2 ③a 口径',
    "    var mid = pg.querySelector('.pg-info');\n"
    "    if (!mid) return { err: 'no-mid' };\n"
    "    var mini = document.querySelector('#bottom-bar .bb-mini');\n"
    "    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;\n"
    "    var pr = pg.getBoundingClientRect(), mr = mid.getBoundingClientRect();\n"
    "    var mrr = mini ? mini.getBoundingClientRect() : null;\n"
    "    return {\n"
    "      diff: Math.round(((mr.left + mr.right) / 2 - (pr.left + pr.right) / 2) / k * 10) / 10,",
    "    var mid = pg.querySelector('.pg-info');\n"
    "    if (!mid) return { err: 'no-mid' };\n"
    "    var l3 = pg.querySelector('.pg-side.l'), r3b = pg.querySelector('.pg-side.r');\n"
    "    if (!l3 || !r3b) return { err: 'no-sides' };\n"
    "    var mini = document.querySelector('#bottom-bar .bb-mini');\n"
    "    var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-k')) || 1;\n"
    "    var pr = pg.getBoundingClientRect();\n"
    "    /* v89.213 口径变更：内容块（l 组左缘~r 组右缘）整体居中（三栏退役） */\n"
    "    var lr3 = l3.getBoundingClientRect(), rr3 = r3b.getBoundingClientRect();\n"
    "    var mrr = mini ? mini.getBoundingClientRect() : null;\n"
    "    return {\n"
    "      diff: Math.round(((lr3.left + rr3.right) / 2 - (pr.left + pr.right) / 2) / k * 10) / 10,")
rep(P, 'F2b ③a 标题',
    "  chk('③a 商城底栏分页：页码「' + (r3.midTxt || '') + '」居中（差 ' + r3.diff + 'px ≤ 2）',",
    "  chk('③a 商城底栏分页：内容块居中（差 ' + r3.diff + 'px ≤ 2 · v89.213 口径 · 页码「' + (r3.midTxt || '') + '」）',")

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written shot_v89204')

# ---- F3: diag 截图改名 ----
P2 = 'E:/Deepseekdb/.workbuddy/tools/show/diag_v89213_pager.js'
s2 = io.open(P2, 'r', encoding='utf-8', newline='').read()
a = s2.count("v89213-before-shop.png")
b = s2.count("v89213-before-modal.png")
assert a == 1 and b == 1, 'diag count=' + str(a) + '/' + str(b)
s2 = s2.replace("v89213-before-shop.png", "v89213-diag-shop.png")
s2 = s2.replace("v89213-before-modal.png", "v89213-diag-modal.png")
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('[ok] F3 diag 截图改名')

# ---- F4: 删除被覆盖的误导性文件（本轮临时产物 · 误命名 before） ----
for f in ['v89213-before-shop.png', 'v89213-before-modal.png']:
    p = 'E:/Deepseekdb/.workbuddy/shots/' + f
    if os.path.exists(p):
        os.remove(p)
        print('[ok] F4 删除误导文件 ' + f)
