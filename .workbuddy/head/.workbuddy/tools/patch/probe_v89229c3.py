# -*- coding: utf-8 -*-
# v89.229 批 c 侦察 3：TR 表 / smoke 结构段 / smoke 引用分布
import io, re, collections
BASE = 'E:/Deepseekdb/'
OUT = BASE + '.workbuddy/tmp/p229c_recon3.txt'
def rd(p):
    try: return io.open(BASE + p, encoding='utf-8', newline='').read()
    except: return ''
L = []; w = L.append

w('=' * 26 + ' T1 icons.js TR 表（兵种图标） ' + '=' * 26)
ic = rd('js/icons.js')
i = ic.find('var TR = {')
if i < 0: i = ic.find('TR = {')
w(ic[i:i + 2500] if i >= 0 else 'TR NOT FOUND')

w('')
w('=' * 26 + ' T2 assets/icons troop 位图 ' + '=' * 26)
import os
d = BASE + 'assets/icons/ui'
troops = [f for f in os.listdir(d) if f.startswith('ai_') and any(k in f for k in ['minfu','yibing','chihou','changqiang','daodun','gongjian','qingji','tieji','zhouche','chuangnu','chongche','toudan','qingzhou','tuqi','hubao','tengjia','xiliang','nanjiang'])]
w('  troop 位图 %d 张: %s' % (len(troops), ' '.join(sorted(troops))[:600]))

w('')
w('=' * 26 + ' T3 smoke §221④ 守卫词表 & §129③ & §151 ' + '=' * 26)
s = rd('smoke-test.js')
for pat in ['§221④', '§129③', '§151']:
    for m in re.finditer(r'[^\n]*' + re.escape(pat) + r'[^\n]*', s):
        w('  [L%d] %s' % (s[:m.start()].count('\n') + 1, m.group(0).strip()[:170]))

w('')
w('=' * 26 + ' T4 smoke 旧 id 引用分布（按 id 计数） ' + '=' * 26)
IDS = ['minfu','yibing','chihou','changqiang','daodun','gongjian','qingji','tieji','zhouche',
       'chuangnu','chongche','toudan','qingzhoubing','tengjiabing','tuqibing','hubaoqi',
       'xiliangtieqi','nanjiangxiangbing']
cnt = collections.Counter()
for m in re.finditer(r"['\"]([a-z]+)['\"]", s):
    if m.group(1) in IDS: cnt[m.group(1)] += 1
w('  ' + str(dict(cnt)))
w('  合计 %d' % sum(cnt.values()))
e = rd('e2e-test.js')
cnt2 = collections.Counter()
for m in re.finditer(r"['\"]([a-z]+)['\"]", e):
    if m.group(1) in IDS: cnt2[m.group(1)] += 1
w('  e2e: ' + str(dict(cnt2)) + ' 合计 %d' % sum(cnt2.values()))

w('')
w('=' * 26 + ' T5 questdata L72-86（g 系列） ' + '=' * 26)
q = rd('js/questdata.js').split('\n')
for i in range(71, 87):
    w('qL%-5d|%s' % (i + 1, q[i]))

w('')
w('=' * 26 + ' T6 smoke §199④ 版本正则 & 训练相关断言 ' + '=' * 26)
for m in re.finditer(r"[^\n]*(§199④|_trainTab|train-tab)[^\n]*", s):
    t = m.group(0).strip()
    if len(t) < 175:
        w('  [L%d] %s' % (s[:m.start()].count('\n') + 1, t[:170]))

io.open(OUT, 'w', encoding='utf-8', newline='').write('\n'.join(L))
print('written', len(L))
