import io
p = '.workbuddy/tools/git/test_gate_baseline.py'
s = io.open(p, encoding='utf-8').read()
if '⑦ 真实场景' in s:
    print('SKIP'); raise SystemExit(0)

anchor = "print()\nprint(f'结果：{PASS} 通过 / {FAIL} 失败')"
add = '''# ⑦ 真实场景：smoke 有失败 → 退出码 1，但它**有汇总行**，必须走基线判定
ok, s = g.judge(R(body(known), 1), 'smoke-test.js', 'smoke')
check('⑦ 退出码1 + 有汇总行 + 仅已知失败 → 放行（真实 smoke 就长这样）',
      ok and s.startswith('⚠️'), s)

# ⑧ 退出码 1 且没有汇总行 → 才是真的异常中断
ok, s, _ = g.judge(R('  一些无关输出\\n', 1), 'smoke-test.js', 'smoke')
check('⑧ 退出码1 + 无汇总行 → 判异常中断', (not ok) and '异常中断' in s, s)

print()
print(f'结果：{PASS} 通过 / {FAIL} 失败')'''
assert anchor in s, 'anchor missing'
s = s.replace(anchor, add, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('测试已补 ⑦⑧')
