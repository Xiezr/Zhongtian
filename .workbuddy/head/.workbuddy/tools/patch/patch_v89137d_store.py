# -*- coding: utf-8 -*-
"""v89.137 补丁 D：data.js —— 都城库藏基准跟三档重算（6.48亿 → 8.64亿）"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'data.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次（须为 1）' % (tag, s.count(old)))
        sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

rep(
"""         ⇒ 县城 2.29亿 · 郡城 3.23亿 · 州城 4.50亿 · 都城 6.48亿""",
"""         ⇒ 县城 2.29亿 · 郡城 3.23亿 · 州城 4.50亿 · 都城 8.64亿
       v89.137：都城那一档随"建筑专精三档"重算 —— 都城建筑 Lv24 = 仓库**第二档**
         （专精 0.50 → 1.00，见 DATA.MASTERY_TIERS），故 6.48亿 → 8.64亿；
         县/郡/州（建筑 Lv12/16/20）仍在第一档，数值不变。""",
'注释推导')

rep(
"""    resByTier: { capital: 648000000, zhou: 450000000, jun: 322560000, county: 228960000 },""",
"""    resByTier: { capital: 864000000, zhou: 450000000, jun: 322560000, county: 228960000 },""",
'resByTier 都城')

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'capital: 864000000' in chk, '未落盘'
assert chk.count('{') == chk.count('}'), '花括号不配平'
print('✅ data.js 补丁D 完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
