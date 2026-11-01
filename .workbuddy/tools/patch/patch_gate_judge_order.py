"""v156.26d · 修 judge() 的判据顺序 bug —— 基线之所以没生效，就卡在这里。

现象（2026-11-01 实测）：
  基线建好了、单测 6/6 全绿，可真实门禁还是红：
      ❌ smoke-test.js 退出码 1（异常中断）
  可 smoke 明明印出了「结果：4349 通过 / 9 失败」。

根因：
  judge() 里 **先判 returncode != 0 → 直接 return "异常中断"**，
  而「结果：」分支在它后面 —— 永远走不到。
  smoke 的设计是 `process.exit(FAIL ? 1 : 0)`，有失败就 exit 1，
  所以"有失败"和"异常中断"在退出码上完全同形，只靠退出码分不开。

修法：**有标准汇总行就以汇总行为准**（它比退出码信息量大得多），
  退出码只在"没有汇总行"时才用来判异常中断。

单测里也补了这条组合（returncode=1 + 有汇总行），之前只测了 returncode=0。
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
GATE = os.path.join(ROOT, '.workbuddy', 'tools', 'git', 'gate.py')

src = io.open(GATE, encoding='utf-8').read()
if 'v156.26d' in src:
    print('SKIP: 已修')
    sys.exit(0)

old = """    if r.returncode != 0:
        _dump_fail(script, out, err)
        return False, f'{script} 退出码 {r.returncode}（异常中断）', tail

    # ① 显式失败数
    m = re.search(r'结果：\\s*(\\d+)\\s*通过\\s*/\\s*(\\d+)\\s*失败', out)
    if m:"""

new = """    # v156.26d：**先看有没有标准汇总行**。
    # smoke / e2e 的设计是 process.exit(有失败 ? 1 : 0) —— "有失败"和"异常中断"
    # 在退出码上同形，只看退出码会把"9 条已知失败"误报成"崩溃"，基线也就永远走不到。
    # 汇总行比退出码信息量大得多，有它就按它判。
    m = re.search(r'结果：\\s*(\\d+)\\s*通过\\s*/\\s*(\\d+)\\s*失败', out)
    if not m and r.returncode != 0:
        _dump_fail(script, out, err)
        return False, f'{script} 退出码 {r.returncode}（异常中断/无汇总行）', tail

    # ① 显式失败数
    if m:"""

if old not in src:
    print('ANCHOR NOT FOUND')
    sys.exit(1)
src = src.replace(old, new, 1)

# 后面那段"分母为 0 / 0 失败"的收尾要跟着改（原来是 if m: 块内，现在仍是）
io.open(GATE, 'w', encoding='utf-8', newline='\n').write(src)
print('gate.py: judge 判据顺序已修（汇总行优先于退出码）')
