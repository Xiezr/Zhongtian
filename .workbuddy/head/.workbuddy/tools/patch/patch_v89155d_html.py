# -*- coding: utf-8 -*-
"""v89.155 补丁 E：index.html —— .btn.green（野地召回「无驻军绿」）+ --green-deep 令牌。"""
import io, re

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

P = 'index.html'
s = rd(P)
done = []

# ---- ① --green-deep 令牌（挨着 --red-deep，主 :root 一处；其它主题继承） ----
A1 = u"    --red-deep: #5c1a10;"
N1 = u"""    --red-deep: #5c1a10;
    --green-deep: #3a6d36;   /* v89.155（老板 2）：绿按钮边框 —— .btn.green（野地召回"无驻军"态） */"""
if u'--green-deep' in s:
    done.append('1 skip')
else:
    assert s.count(A1) == 1, '1 anchor'
    s = s.replace(A1, N1)
    done.append('1 OK')

# ---- ② .btn.green（与 .btn.red 同构） ----
A2 = u"""  .btn.red { background: linear-gradient(180deg, var(--red-light), var(--red)); border-color: var(--red-deep); box-shadow: 0 3px 0 #4a150c, inset 0 1px 0 rgba(var(--hl-rgb),.25); }
  .btn.red:active { box-shadow: 0 1px 0 #4a150c; }"""
N2 = u"""  .btn.red { background: linear-gradient(180deg, var(--red-light), var(--red)); border-color: var(--red-deep); box-shadow: 0 3px 0 #4a150c, inset 0 1px 0 rgba(var(--hl-rgb),.25); }
  .btn.red:active { box-shadow: 0 1px 0 #4a150c; }
  /* v89.155（老板 2）：「召回」三态里的**无驻军绿**（"变回无驻军的绿色"）——
     与 .btn.red 同构（亮面渐变 + 深边框 + 投影），色取既有绿令牌族。 */
  .btn.green { background: linear-gradient(180deg, var(--green-ok), var(--green-deep)); border-color: var(--green-deep); box-shadow: 0 3px 0 #24471f, inset 0 1px 0 rgba(var(--hl-rgb),.25); }
  .btn.green:active { box-shadow: 0 1px 0 #24471f; }"""
if u'.btn.green {' in s:
    done.append('2 skip')
else:
    assert s.count(A2) == 1, '2 anchor'
    s = s.replace(A2, N2)
    done.append('2 OK')

wr(P, s)
s2 = rd(P)
assert s2.count(u'--green-deep: #3a6d36;') == 1
assert s2.count(u'.btn.green { background:') == 1
print('index.html done:', done)
