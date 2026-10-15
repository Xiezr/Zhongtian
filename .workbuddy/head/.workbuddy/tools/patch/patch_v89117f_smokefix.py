# -*- coding: utf-8 -*-
"""修复 smoke-test.js 里被 heredoc 吃掉反斜杠的两处（v89.117）

现象：`\\s` 在 bash heredoc 里变成了 `/s`（`line-height://s*`）——
**项目技能里写过：长内容走文件，别走命令行**（这次又踩）。
本脚本用文件式写入（Write 工具生成的 .py 本身是完整的），逐行精确替换 + 写后自检。
"""
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8').read()

FIX = [
    ("    var lhRaw = ((name[1].match(/line-height://s*([^;}]+)/) || [])[1] || '').trim();",
     "    var lhRaw = ((name[1].match(/line-height:\\s*([^;}]+)/) || [])[1] || '').trim();"),
    ("&& /--isz-xs://s*20px/.test(hS1)",
     "&& /--isz-xs:\\s*20px/.test(hS1)"),
    # 第一段里还有两处 \\s 可能也被吃了，一并核对
    ("(hS46.match(/--lh-([a-z0-9-]+)//s*:\\s*([\\d.]+)/g) || [])",
     "(hS46.match(/--lh-([a-z0-9-]+)\\s*:\\s*([\\d.]+)/g) || [])"),
    ("var m1 = d.match(/--lh-([a-z0-9-]+)//s*:\\s*([\\d.]+)/);",
     "var m1 = d.match(/--lh-([a-z0-9-]+)\\s*:\\s*([\\d.]+)/);"),
]
for old, new in FIX:
    n = s.count(old)
    if n == 0:
        print('  · 未命中（可能本来就对）：%s' % old[:56])
        continue
    s = s.replace(old, new)
    print('  ✓ 修复 %d 处：%s' % (n, old[:56]))

# 写后自检：不许再出现 `/s*` 这种被吃掉的形态
bad = [ln for ln in s.split('\n') if '/line-height://' in ln or '//s*' in ln]
if bad:
    print('!! 自检失败，仍有坏形态：')
    for b in bad[:5]:
        print('   ' + b[:120])
    sys.exit(1)
if '/var\\(--lh-' not in s:
    print('!! 自检失败：替换文本似乎没进去')
    sys.exit(1)

tmp = P + '.tmp117fix'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('修复完成')
