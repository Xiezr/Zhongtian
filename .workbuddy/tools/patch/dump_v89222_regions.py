# -*- coding: utf-8 -*-
"""v89.222 · 关键区段原文 dump（供定级）"""
import io

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()

def dump(f, a, b):
    lines = rd(f).split('\n')
    print('===== %s %d-%d =====' % (f, a, b))
    for i in range(a, min(b, len(lines)) + 1):
        print('L%-6d %s' % (i, lines[i-1].rstrip()[:220]))

dump('smoke-test.js', 6540, 6578)
dump('smoke-test.js', 12685, 12706)
dump('smoke-test.js', 15070, 15092)
dump('smoke-test.js', 13936, 13952)
dump('smoke-test.js', 27112, 27132)
dump('smoke-test.js', 28878, 28912)
dump('smoke-test.js', 34288, 34312)
dump('e2e-test.js', 3735, 3762)

# 需求档案里的 许都
s = rd('需求档案.md').split('\n')
print('===== 需求档案 许都 =====')
for i, ln in enumerate(s, 1):
    if '许都' in ln:
        print('L%-6d %s' % (i, ln.strip()[:200]))

# 灰岗 在测试/产品里的用法
for f in ['smoke-test.js', 'e2e-test.js', 'js/data.js', 'js/state.js', 'js/domain.js']:
    t = rd(f)
    if '灰岗' in t:
        print('HAS 灰岗:', f, t.count('灰岗'))

# 产品侧 拒马/枪阵/枪克骑 的原文
for f in ['js/data.js', 'js/tactic.js', 'smoke-test.js']:
    t = rd(f).split('\n')
    for i, ln in enumerate(t, 1):
        if ('拒马' in ln) or ('枪阵' in ln) or ('枪克骑' in ln):
            print('%s L%d  %s' % (f, i, ln.strip()[:190]))
