# -*- coding: utf-8 -*-
"""v89.126 补丁 O（临时诊断）：给点墙环断言加 DBG 输出"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'e2e-test.js')
s = io.open(P, encoding='utf-8').read()
old = """  check('点墙环打开建造/城墙面板（需求 1 · v89.126 并入通用面板）',
    document.querySelector('#modal-root').innerHTML.indexOf('城墙') >= 0);"""
new = """  check('点墙环打开建造/城墙面板（需求 1 · v89.126 并入通用面板）',
    document.querySelector('#modal-root').innerHTML.indexOf('城墙') >= 0,
    'DBG wallCell=' + (G.wallCellIdxOf(G.currentCity()) >= 0)
      + ' toasts=' + Array.from(document.querySelectorAll('#toast .toast-line')).map((x) => x.textContent).join('|').slice(0, 60)
      + ' modal=' + (document.querySelector('#modal-root').innerHTML || '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').slice(0, 90));"""
assert s.count(old) == 1, '锚点计数 %d' % s.count(old)
s = s.replace(old, new)
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:400]
print('✓ 补丁 O（临时诊断）完成')
