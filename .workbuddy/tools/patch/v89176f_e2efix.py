# v89.176 修复：e2e §176 段搬到 main 作用域（§175 段之后）——原位置 G 未定义
import io

ROOT = 'E:/Deepseekdb/'
p = ROOT + 'e2e-test.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

head = '/* ============================================================\n * v89.176（智能战术 v2）：接敌角标 / 损失读数 / 沙盘统一 —— 真 DOM 版\n * ============================================================ */\n'
i = s.index(head)
j = s.index('let ABORTED = false;')
seg = s[i:j].rstrip() + '\n'

s2 = s[:i] + s[j:]
anchor = "      !!lg175 && lg175.textContent.indexOf('维持阵型') >= 0);\n  })();\n"
k = s2.index(anchor) + len(anchor)
s2 = s2[:k] + '\n' + seg + '\n' + s2[k:]

io.open(p, 'w', encoding='utf-8', newline='').write(s2)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert chk.count('v89.176 顶栏损失读数出现') == 1, '段数不对'
assert chk.index('v89.176 顶栏损失读数出现') > chk.index('维持阵型'), '位置不对（应在 §175 段之后）'
assert chk.index('let ABORTED = false;') > chk.index('v89.176 顶栏损失读数出现'), '段应在 ABORTED 之前'
print('E2E-FIXED')
