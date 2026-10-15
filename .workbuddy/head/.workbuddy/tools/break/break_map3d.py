# -*- coding: utf-8 -*-
"""v90.61 破坏测试：往 3D 主地图注入 bug，验证 §map3d 护栏**真的会红**。
用法：python .workbuddy/tools/break/break_map3d.py
铁律：先基线全绿 → 逐条注入 → 看是否变红 → 立刻还原。
"""
import io, os, re, subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def _repo_root():
    d = os.path.dirname(os.path.abspath(__file__))
    for _ in range(8):
        if os.path.exists(os.path.join(d, 'index.html')):
            return d
        d = os.path.dirname(d)
    return d

ROOT = _repo_root()
JS = os.path.join(ROOT, 'js')

# (名字, 文件, 原文, 替换)
CASES = [
    ('① 删 3D 分派支路（回退开关失灵）', 'ui.js',
     "    if (GAME.map3d && GAME.map3d.enabled) {",
     "    if (false) {"),

    ('② 3D 不再读真实地形（terrain 来源断）', 'map3d.js',
     "    var t = GAME.map.tile(Math.round(gx), Math.round(gz));",
     "    var t = null;"),

    ('③ 去掉无 THREE 时的自降级（无 three 会崩）', 'map3d.js',
     "  if (typeof THREE === 'undefined') { GAME.map3d = { enabled: false, why: 'no-three' }; return; }",
     "  if (false) { }"),
]


def run_smoke():
    p = subprocess.run(['node', 'smoke-test.js'], cwd=ROOT, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    out = (p.stdout or '') + (p.stderr or '')
    fails = re.findall(r'^\s*❌ (.*)$', out, re.M)
    m = re.search(r'结果：(\d+) 通过 / (\d+) 失败', out)
    total = int(m.group(2)) if m else -1
    return fails, total, out


def main():
    print('== 基线 ==')
    _, base_total, _ = run_smoke()
    print('   基线失败 %d 条' % base_total)
    if base_total != 0:
        print('   ⚠️ 基线不是全绿，先修完再来做破坏测试')
        return 1

    orig = {}
    red = []
    for name, f, old, new in CASES:
        path = os.path.join(JS, f)
        if path not in orig:
            orig[path] = io.open(path, encoding='utf-8').read()
        src = orig[path]
        if src.count(old) != 1:
            print('%-46s ⚠️ 锚点命中 %d 次，跳过' % (name, src.count(old)))
            continue
        io.open(path, 'w', encoding='utf-8', newline='').write(src.replace(old, new))
        fails, total, _ = run_smoke()
        io.open(path, 'w', encoding='utf-8', newline='').write(src)   # 立刻还原
        red.append((name, total, fails))
        print('%-46s 变红 %d 条' % (name, total))
        for x in fails[:4]:
            print('        · ' + x)
        if total == 0:
            print('        ⚠️⚠️ 一条都没红 —— 这批改动没有护栏守着！')

    print('\n== 汇总 ==')
    zero = [n for n, t, _ in red if t == 0]
    print('   注入 %d 类，变红 %d 条断言，零反应 %d 类' %
          (len(red), sum(t for _, t, _ in red), len(zero)))
    if zero:
        for n in zero:
            print('   ❗ ' + n)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
