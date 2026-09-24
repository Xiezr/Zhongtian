# -*- coding: utf-8 -*-
"""v89.107 公文页重做：把 ui.js 的「消息频道」整段换成「五类独立页签」。

按**行号区间**替换（10626..10773），替换前逐条核对边界内容 —— 文本锚点在大段
中文注释里极易对不上（刚试过一次），行号 + 边界断言反而稳。
"""
import io, os, shutil, subprocess

R = r'E:/Deepseekdb'
UI = os.path.join(R, 'js', 'ui.js')
BLOCK = os.path.join(R, '.workbuddy', 'tmp', 'v89107_doc_block.js')
BAK = os.path.join(R, '.workbuddy', 'backup')
NODE = 'C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-3/node.exe'
A, B = 10626, 10773                    # 1-based，含两端

lines = io.open(UI, encoding='utf-8').read().split('\n')
# 边界断言：改错行就中止（不许"差一行"静默过）
assert 'ui.MSG_PER = 15;' in lines[A - 1], lines[A - 1][:70]
assert 'ui.reportsHTML = function' in lines[A], lines[A][:70]
assert 'ui.msgCount = function' in lines[10718], lines[10718][:70]
assert lines[B - 1].strip() == '};', lines[B - 1][:70]
assert '战报详情' in lines[B + 1], lines[B + 1][:70]
before = len(lines)
new_block = io.open(BLOCK, encoding='utf-8').read().rstrip('\n').split('\n')
out = lines[:A - 1] + new_block + lines[B:]
shutil.copyfile(UI, os.path.join(BAK, 'ui.v89107-before-doc.js'))
tmp = UI + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write('\n'.join(out))
os.replace(tmp, UI)
r = subprocess.run([NODE, '--check', UI], capture_output=True)
if r.returncode != 0:
    raise SystemExit('!! 语法失败\n' + r.stderr.decode('utf-8', 'ignore'))
print('ui.js：%d 行 → %d 行（公文页重做，区间 %d..%d）' % (before, len(out), A, B))
for kw in ['ui.docTabHTML', 'ui.docBodyHTML', 'ui.setDocTab', 'ui.docPagerReg']:
    assert kw in '\n'.join(out), '缺 ' + kw
print('新出口齐备：docTabHTML / docBodyHTML / setDocTab / docPagerReg')
