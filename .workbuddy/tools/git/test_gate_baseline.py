# -*- coding: utf-8 -*-
"""门禁基线判定的单元测试（判据自己也要能测）。

跑法：
    python .workbuddy/tools/git/test_gate_baseline.py

验五件事：
  ① 只有已知失败        → 绿（⚠️），摘要写明"全部已知"
  ② 已知 + 一条新增     → 红，摘要点出新增那条
  ③ 全绿                → 绿
  ④ 已知少了一条        → 绿 + 提示"可收缩"
  ⑤ 有失败但解析不出标题 → 红（宁可误报，绝不静默放行）
"""
import importlib.util
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
GATE = os.path.join(ROOT, '.workbuddy', 'tools', 'git', 'gate.py')

spec = importlib.util.spec_from_file_location('gate_mod', GATE)
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

base = g.load_baseline()
known = sorted(base.get('entries', {}).get('smoke-test.js', {}).keys())
if not known:
    print('✗ 基线是空的 —— 先跑 gate.py --update-baseline')
    sys.exit(1)
print(f'基线已知失败 {len(known)} 条')


class R(object):
    def __init__(self, text, code=0):
        self.returncode = code
        self.stdout = text.encode('utf-8')
        self.stderr = b''


def body(titles, ok_n=4300):
    lines = ['  ✅ 某条通过的断言'] * 3
    for t in titles:
        lines.append('  ❌ ' + t)
    lines.append(f'结果：{ok_n} 通过 / {len(titles)} 失败')
    return '\n'.join(lines)


def run(titles, ok_n=4300):
    ok, summary, detail = g.judge(R(body(titles, ok_n)), 'smoke-test.js', 'smoke')
    return ok, summary


PASS = FAIL = 0
def check(name, cond, info=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'  ✅ {name}' + (f'  [{info}]' if info else ''))
    else:
        FAIL += 1
        print(f'  ❌ {name}' + (f'  [{info}]' if info else ''))


# ① 只有已知失败 → 绿
ok, s = run(known)
check('① 只有已知失败 → 放行（⚠️ 而非 ❌）', ok and s.startswith('⚠️'), s)

# ② 已知 + 新增 → 红
ok, s = run(known + ['§999 我新写坏的断言'])
check('② 已知 + 新增一条 → 拦下，且点出新增', (not ok) and '新增失败' in s and '§999' in s, s)

# ③ 全绿 → 绿（且不是 ⚠️）
ok, s = run([])
check('③ 全绿 → 通过（无 ⚠️）', ok and not s.startswith('⚠️'), s)

# ④ 少一条已知 → 绿 + 可收缩提示
ok, s = run(known[:-1])
check('④ 已知少一条 → 放行且提示可收缩', ok and ('可收缩' in s) and '全部已知' in s, s)

# ⑤ 有失败但抽不到标题 → 红
raw = '  something failed\n结果：4300 通过 / 2 失败'
ok, s, _ = g.judge(R(raw), 'smoke-test.js', 'smoke')
check('⑤ 有失败但解析不出标题 → 红（绝不静默放行）', not ok and '无法解析' in s, s)

# ⑥ 计数放大（同一标题从 1 变 2）→ 多出来的算新增
t0 = known[0]
ok, s = run(known + [t0])
check('⑥ 同一失败变多 → 多出来的算新增', (not ok) and '新增失败' in s, s)

# ⑦ 真实场景：smoke 有失败 → 退出码 1，但它**有汇总行**，必须走基线判定
ok, s, _ = g.judge(R(body(known), 1), 'smoke-test.js', 'smoke')
check('⑦ 退出码1 + 有汇总行 + 仅已知失败 → 放行（真实 smoke 就长这样）',
      ok and s.startswith('⚠️'), s)

# ⑧ 退出码 1 且没有汇总行 → 才是真的异常中断
ok, s, _ = g.judge(R('  一些无关输出\n', 1), 'smoke-test.js', 'smoke')
check('⑧ 退出码1 + 无汇总行 → 判异常中断', (not ok) and '异常中断' in s, s)

print()
print(f'结果：{PASS} 通过 / {FAIL} 失败')
sys.exit(1 if FAIL else 0)
