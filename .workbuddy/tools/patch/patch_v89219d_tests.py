# -*- coding: utf-8 -*-
"""v89.219-d：版本号升级 + data.js 注释换代 + 插入 smoke §219 段 / e2e §219E 段"""
import io, sys

R = 'E:/Deepseekdb/'
def rd(p): return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

E = [
    # ① 版本号（main + smoke 断言 + 注释随轮）
    ('js/main.js', "  GAME.VERSION = 'v89.218';", "  GAME.VERSION = 'v89.219';", 1),
    ('smoke-test.js', "return /GAME\\.VERSION = 'v89\\.218'/.test(mS199)   /* v89.218：版本号每轮迭代更新（本条随轮升级） */",
     "return /GAME\\.VERSION = 'v89\\.219'/.test(mS199)   /* v89.219：版本号每轮迭代更新（本条随轮升级） */", 1),
    # ② data.js 注释里的旧头衔（保留末句"不重名"判断）
    ('js/data.js',
     "  /* 名城守将（v60 · 需求 6）：太守 / 都尉一系，名字另起一池 ——\n"
     "     与「贼寇」（WILD_LORD_*）和「酒馆招募」都不重名，一眼能看出是系统城的人。 */",
     "  /* 名城守将（v60 · 需求 6）：城守 / 武卫一系（v89.219 机构词换代：原「太守系」头衔），\n"
     "     名字另起一池 —— 与「贼寇」（WILD_LORD_*）和「酒馆招募」都不重名，一眼能看出是系统城的人。 */",
     1),
]

bad = []
for f, old, new, exp in E:
    s = rd(R + f)
    if new in s and old not in s:
        continue
    c = s.count(old)
    if c != exp:
        bad.append('%s x%d | %s' % (f, c, old[:50]))
if bad:
    print('❌ 预检失配（未落盘）：' + ' · '.join(bad))
    sys.exit(1)

for f, old, new, exp in E:
    p = R + f
    s = rd(p)
    if new in s and old not in s:
        print('  [skip] %s' % old[:30])
        continue
    wr(p, s.replace(old, new))
    print('  [ok] %s | %s' % (f, old[:30]))

# ③ smoke §219 段（插在"结果："行之前）
sec = io.open(R + '.workbuddy/tmp/sec219.js', encoding='utf-8', newline='').read()
p = R + 'smoke-test.js'
s = rd(p)
anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
if '§219⑧' in s:
    print('  [skip] smoke §219 已存在')
else:
    assert s.count(anchor) == 1, 'smoke anchor x%d' % s.count(anchor)
    wr(p, s.replace(anchor, sec + anchor))
    print('  [ok] smoke §219 段插入')

# ④ e2e §219E 段（插在 main 的 return finish() 之前）
secE = io.open(R + '.workbuddy/tmp/sec219e2e.js', encoding='utf-8', newline='').read()
p = R + 'e2e-test.js'
s = rd(p)
anchorE = "\n  return finish();\n}"
if '§219E' in s:
    print('  [skip] e2e §219E 已存在')
else:
    assert s.count(anchorE) == 1, 'e2e anchor x%d' % s.count(anchorE)
    wr(p, s.replace(anchorE, '\n' + secE + anchorE[1:]))
    print('  [ok] e2e §219E 段插入')

print('✅ v89.219-d 落盘完成')
