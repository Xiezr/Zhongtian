# -*- coding: utf-8 -*-
"""v89.210 补丁 E —— smoke-test.js：插入 §210 段 + §199④ 版本升级"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
F = 'E:/Deepseekdb/.workbuddy/tmp/frag_smoke210.txt'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
n0 = len(s)

if '§210（v89.210）' in s:
    print('[skip] §210 已插入')
else:
    anchor = "  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    assert s.count(anchor) == 1, 'anchor count=' + str(s.count(anchor))
    frag = io.open(F, 'r', encoding='utf-8', newline='').read().rstrip('\n')
    assert '===== §210' in frag
    s = s.replace(anchor,
                  "  })();\n\n" + frag + "\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');")
    print('[ok] §210 段已插入')

# §199④ 版本升级（随轮）
old_v = "return /GAME\\.VERSION = 'v89\\.209'/.test(mS199)   /* v89.209：版本号每轮迭代更新（本条随轮升级） */"
new_v = "return /GAME\\.VERSION = 'v89\\.210'/.test(mS199)   /* v89.210：版本号每轮迭代更新（本条随轮升级） */"
if new_v in s:
    print('[skip] §199④ 已升级')
else:
    assert s.count(old_v) == 1, 'v count=' + str(s.count(old_v))
    s = s.replace(old_v, new_v)
    print('[ok] §199④ 升级 v89.210')

assert s.count('§210（v89.210）') == 1
assert "GAME\\.VERSION = 'v89\\.210'" in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('写入 ' + str(n0) + ' -> ' + str(len(s)) + ' 字节')
print('done')
