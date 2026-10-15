# -*- coding: utf-8 -*-
"""v89.222e · 需求档案补录（总览行 + 明细段；两处各自幂等）"""
import io, sys, os

R = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

frag = rd('.workbuddy/tools/patch/v89222_arc.txt')
ROW, DETAIL = frag.split('@@@ROW@@@')[1].split('@@@DETAIL@@@')
ROW = ROW.strip()
DETAIL = DETAIL.strip('\n')

s = rd('需求档案.md')
s = s.replace('\r\n', '\n')          # 归一 LF（§44.3：台账文件终态 LF）
n0 = len(s)

# ① 总览行：插在 v89.221 行之后
if '| v89.222 |' in s:
    print('[skip] 总览行已在')
else:
    i0 = s.index('\n| v89.221 |')
    j = s.index('\n', i0 + 1)
    s = s[:j] + '\n' + ROW + s[j:]
    print('[ok] 总览行插入')

# ② 明细段：文末追加
if '## v89.222' in s:
    print('[skip] 明细段已在')
else:
    s = s.rstrip('\n') + '\n\n' + DETAIL + '\n'
    print('[ok] 明细段追加')

# 自检
assert s.count('| v89.222 |') == 1, 'row x%d' % s.count('| v89.222 |')
assert s.count('## v89.222') == 1, 'detail x%d' % s.count('## v89.222')
assert '历史标题引述等全面更换' in s and '灰岗' in s
assert '\r\n' not in s

if DRY:
    print('[dry] 未落盘（%d → %d）' % (n0, len(s)))
    sys.exit(0)

wr('需求档案.md', s)
print('✅ v89.222e 落盘（%d → %d 字符）' % (n0, len(s)))
