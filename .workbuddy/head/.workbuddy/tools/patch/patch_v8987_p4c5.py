# -*- coding: utf-8 -*-
"""v89.87 需求4c-5：按项目 UI 规约修正 —— 色走变量 / 图标容器含 img / 下拉框实名在册"""
import io

# ---------- 1) index.html：硬编码色 → 语义变量；svg 选择器补 img ----------
P1 = r'E:\Deepseekdb\index.html'
s1 = io.open(P1, encoding='utf-8', newline='').read()

pairs = [
  (".bt-unit.def .bt-n { color: #e8a49b; }",
   ".bt-unit.def .bt-n { color: var(--red-light); }"),
  (".bt-ev.attack { color: #d99a4e; }",
   ".bt-ev.attack { color: var(--amber); }"),
  (".bt-ev.counter { color: #6fa8d8; }",
   ".bt-ev.counter { color: var(--blue-info); }"),
  (".bt-unit .bt-ico svg { width: 20px; height: 20px; vertical-align: middle; }",
   ".bt-unit .bt-ico svg, .bt-unit .bt-ico img { width: 20px; height: 20px; vertical-align: middle; }"),
  (".bt-cmdrow .bt-ico svg { width: 18px; height: 18px; vertical-align: middle; }",
   ".bt-cmdrow .bt-ico svg, .bt-cmdrow .bt-ico img { width: 18px; height: 18px; vertical-align: middle; }"),
]
for old, new in pairs:
    assert s1.count(old) == 1, (old[:30], s1.count(old))
    s1 = s1.replace(old, new, 1)
io.open(P1, 'w', encoding='utf-8', newline='').write(s1)
print('OK index.html 规约修正')

# ---------- 2) ui.js：战场目标下拉加 id（实名在册） ----------
P2 = r'E:\Deepseekdb\js\ui.js'
s2 = io.open(P2, encoding='utf-8', newline='').read()
old2 = """        '<select class="bt-sel" data-action="bt-target" data-troop="' + u.id + '">' + opts + '</select>' +"""
new2 = """        /* id 实名在册（bt-t- 前缀，见 smoke 的白名单判据） */
        '<select class="bt-sel" id="bt-t-' + u.id + '" data-action="bt-target" data-troop="' + u.id + '">' + opts + '</select>' +"""
assert s2.count(old2) == 1, ('ui-sel', s2.count(old2))
s2 = s2.replace(old2, new2, 1)
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('OK ui.js 下拉框实名')

# ---------- 3) smoke-test.js：白名单登记 bt-t- 前缀 ----------
P3 = r'E:\Deepseekdb\smoke-test.js'
s3 = io.open(P3, encoding='utf-8', newline='').read()
old3 = """        || /id="xc-/.test(tag)                           /* 校场演武的选将框（v89.80） */"""
new3 = """        || /id="xc-/.test(tag)                           /* 校场演武的选将框（v89.80） */
        || /id="bt-t-/.test(tag)                         /* 战场界面逐兵种目标（v89.87） */"""
assert s3.count(old3) == 1, ('smoke-sel', s3.count(old3))
s3 = s3.replace(old3, new3, 1)
io.open(P3, 'w', encoding='utf-8', newline='').write(s3)
print('OK smoke-test.js 白名单')
