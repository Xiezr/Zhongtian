# v89.213 补丁 D（smoke）：① §204⑦ 重写（三栏 → 整体居中口径）② §199④ 版本升级
#   ③ 文件末尾插入 §213 段（frag 文件读取）
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

def rep(tag, old, new, cnt=1):
    global s
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    s = s.replace(old, new)
    print('[ok] ' + tag)

# ---- D1: §204⑦ 重写（v89.213 口径） ----
rep('D1 §204⑦ 重写',
    "    /* ── ⑦ 分页条 CSS ── */\n"
    "    check('§204⑦ CSS：.pager 三栏 grid + 单元素态居中 + 底栏留白', (function () {\n"
    "      return /\\.pager \\{\\n    display: grid; grid-template-columns: 1fr auto 1fr;/.test(hS204)\n"
    "        && /\\.pager \\.pg-side\\.l \\{ justify-content: flex-start; \\}/.test(hS204)\n"
    "        && /\\.pager \\.pg-side\\.r \\{ justify-content: flex-end; \\}/.test(hS204)\n"
    "        && /\\.pager > \\.pg-info:only-child \\{ grid-column: 2; \\}/.test(hS204)\n"
    "        && /margin: 0 52px 0 0;/.test(hS204);\n"
    "    })());",
    "    /* ── ⑦ 分页条 CSS（v89.213 重写：三栏 grid → 整体居中 flex） ──\n"
    "       v89.213 规则变更：三栏把按钮推到条两端 → 底栏里撞 bb-tools 重叠 95px（实机实证）。\n"
    "       新判据 = 整体居中在册 + 三栏家族零残留（负向判据剥注释后查，防注释误伤）。 */\n"
    "    check('§204⑦（v89.213 重写）CSS：.pager 整体居中 flex · 三栏家族零残留 · 底栏 padding 对称', (function () {\n"
    "      var hs = hS204.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');\n"
    "      return /\\.pager \\{\\n    display: flex; justify-content: center; align-items: center; flex-wrap: wrap; width: 100%;/.test(hs)\n"
    "        && !/\\.pager \\{\\n    display: grid;/.test(hs)\n"
    "        && !/\\.pager \\.pg-side\\.l \\{ justify-content: flex-start; \\}/.test(hs)\n"
    "        && !/\\.pager > \\.pg-info:only-child/.test(hs)\n"
    "        && !/margin: 0 52px 0 0;/.test(hs)\n"
    "        && /padding: 0 92px; border-top: 1px solid var\\(--line-strong\\);/.test(hs);\n"
    "    })());")

# ---- D2: §199④ 版本号升级 ----
rep('D2 §199④ 版本',
    "      return /GAME\\.VERSION = 'v89\\.212'/.test(mS199)   /* v89.212：版本号每轮迭代更新（本条随轮升级） */",
    "      return /GAME\\.VERSION = 'v89\\.213'/.test(mS199)   /* v89.213：版本号每轮迭代更新（本条随轮升级） */")

# ---- D3: 插入 §213 段（读 frag 文件） ----
frag = io.open('E:/Deepseekdb/.workbuddy/tmp/frag_smoke213.txt', 'r', encoding='utf-8', newline='').read()
anchor = "\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1, 'anchor count=' + str(s.count(anchor))
assert '§213' not in s, '§213 already present'
s = s.replace(anchor, frag + anchor)
print('[ok] D3 §213 段插入')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written')
