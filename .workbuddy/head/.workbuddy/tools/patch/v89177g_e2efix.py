# v89.177 修复：e2e §177 段从顶层（ABORTED 前）移到 §176 段之后（main 作用域）
import io

ROOT = 'E:/Deepseekdb/'
p = ROOT + 'e2e-test.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

head = '/* ============================================================\n * v89.177（民心/民怨 · 君主突破考验）：真 DOM 版\n * ============================================================ */\n'
i = s.index(head)
j = s.index('let ABORTED = false;')
seg = s[i:j].rstrip() + '\n'

s2 = s[:i] + s[j:]
anchor = "return txt.indexOf('针尖麦芒') >= 0 && txt.indexOf('清前排') >= 0;\n  })());\n})();\n"
k = s2.index(anchor) + len(anchor)
s2 = s2[:k] + '\n' + seg + '\n' + s2[k:]

io.open(p, 'w', encoding='utf-8', newline='').write(s2)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert chk.count('v89.177 官府弹窗') == 1, '段数不对'
assert chk.index('v89.177 官府弹窗') > chk.index('针尖麦芒'), '位置不对'
assert chk.index('let ABORTED = false;') > chk.index('v89.177 官府弹窗'), '应在 ABORTED 前'
print('E2E-177 FIXED')
