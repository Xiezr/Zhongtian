"""清理 gate.py 的叠加式腐化：`_gate_timeout` 与 `run_one` 各被定义两次。

来历：v156.15 加了一版（超时可配），v156.19 又在后面整段重写了一遍（判定抽成 judge +
可并发），但**旧的一版没删** —— 同文件里两个 `def run_one`，后定义覆盖前定义。
后果不是"跑错"，而是：
  · 读代码的人看到两个，不知道该信哪个（我已经被骗过一次，以为超时写死在旧版里）；
  · 改旧版等于没改（被覆盖），改新版才生效 —— 典型的"指哪不打哪"。
Python 里函数只在调用时才查找，两份都在模块顶层、且 main() 在文件末尾定义，
所以删除前一份**行为零变化**。

用法：
    python .workbuddy/tools/patch/clean_gate_dupes.py --check   # 只看会删什么
    python .workbuddy/tools/patch/clean_gate_dupes.py           # 真删（自动备份）
"""
import io
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
P = os.path.join(ROOT, '.workbuddy', 'tools', 'git', 'gate.py')
BAK = os.path.join(ROOT, '.workbuddy', 'backup')

src = io.open(P, encoding='utf-8').read()
lines = src.split('\n')

def def_lines(name):
    return [i for i, L in enumerate(lines) if L.startswith('def ' + name + '(')]

report = []
for name in ('_gate_timeout', 'run_one'):
    idx = def_lines(name)
    report.append((name, [i + 1 for i in idx]))

print('重复定义检查：')
for name, rows in report:
    print('  %-14s 出现在行 %s' % (name, rows))
dupes = [n for n, rows in report if len(rows) > 1]
if not dupes:
    print('没有重复定义，无需处理。')
    sys.exit(0)

# 删除策略：对每个重复名，砍掉「第一处定义」到「第二处定义之前」的整段
cuts = []
for name in dupes:
    idx = def_lines(name)
    start = idx[0]
    end = idx[1]
    # 往前吃掉紧贴的注释块/空行（保持可读），但不越过上一个语句的结尾
    while start > 0 and (lines[start - 1].strip() == '' or lines[start - 1].lstrip().startswith('#')):
        start -= 1
    cuts.append((start, end, name))

cuts.sort(reverse=True)
print('\n将删除（按行号从后往前）：')
for start, end, name in cuts:
    print('  %s: 第 %d~%d 行（%d 行）' % (name, start + 1, end, end - start))

if '--check' in sys.argv:
    print('\n（--check：未写入）')
    sys.exit(0)

os.makedirs(BAK, exist_ok=True)
shutil.copy2(P, os.path.join(BAK, 'gate.py.bak'))
for start, end, name in cuts:
    del lines[start:end]

out = '\n'.join(lines)
# 连续 3 个以上空行压成 2 个（删完会留下空档）
out = re.sub(r'\n{4,}', '\n\n\n', out)
io.open(P, 'w', encoding='utf-8', newline='\n').write(out)
print('\n已删除并写回（备份 .workbuddy/backup/gate.py.bak）')
