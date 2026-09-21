# -*- coding: utf-8 -*-
"""v89.86 破坏测试：对整改 21 条 + 门派 P1 的 smoke §85 断言逐一注入，确认**变红**（可翻转）。
   跑法：python .workbuddy/tools/break/break_v8986.py
"""
import io
import os
import re
import subprocess
import sys
import hashlib

ROOT = r'E:\Deepseekdb'
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
NODE_PATH = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'
SMOKE = os.path.join(ROOT, 'smoke-test.js')


def md5(p):
    return hashlib.md5(io.open(p, 'rb').read()).hexdigest()


def run_smoke():
    env = dict(os.environ)
    env['NODE_PATH'] = NODE_PATH
    r = subprocess.run([NODE, 'smoke-test.js'], cwd=ROOT, capture_output=True, env=env, timeout=900)
    out = r.stdout.decode('utf-8', 'replace')
    m = re.search(r'结果：\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败', out)
    return r.returncode, (m.groups() if m else None), re.findall(r'❌ (.+)', out)


UI = os.path.join(ROOT, 'js', 'ui.js')
DO = os.path.join(ROOT, 'js', 'domain.js')
BA = os.path.join(ROOT, 'js', 'battle.js')
ST = os.path.join(ROOT, 'js', 'state.js')
DA = os.path.join(ROOT, 'js', 'data.js')

INJECTIONS = [
    ('P-12 科技按钮改回 cost.grain', UI,
     "'>研究(黄金 ' + U.fmt(cost.gold) + ')</button>'",
     "'>研究(NaN粮' + U.fmt(cost.grain) + ')</button>'",
     'v89.86（P-12）'),
    ('P-13 有效兵力上限改回 undefined', UI,
     'var suggest = Math.min(effCap, maxTroop);',
     'var suggest = Math.min(G.troopCap, maxTroop);',
     'v89.86（P-13）'),
    ('P-25 关闭军账兜底（不折返）', BA,
     'if (!_expArmySettled && city) {',
     'if (false && city) {',
     'v89.86（P-25）'),
    ('P-23 二次确认闸门失效', os.path.join(ROOT, 'js', 'main.js'),
     '_pw86.ratio < 0.5 && !ui._expForceArmed',
     '_pw86.ratio < 0 && !ui._expForceArmed',
     'v89.86（P-23）'),
    ('P-19 归因恒为 res（人口场景失真）', DO,
     "reason = (popBound <= resBound) ? 'pop' : 'res';",
     "reason = 'res';",
     'v89.86（P-19/P-05）'),
    ('P-06 触发改回直接开卷', UI,
     '    var r = GAME.SG.roll(kind, id);\n    if (!r.fire) return false;\n    return ui.sgDefer(r.sid);',
     '    var r = GAME.SG.roll(kind, id);\n    if (!r.fire) return false;\n    return ui.openStory(r.sid, true);',
     'v89.86（P-06）'),
    ('P-17 离线上限失效（不截断）', ST,
     'if (capGameSec > 0 && secReal * ts0 > capGameSec) {',
     'if (false) {',
     'v89.86（P-17）'),
    ('P-07 提速不推到满进度', DO,
     'q.elapsed = q.totalTime;      /* 下一拍由既有队列推进统一结算（与在线推进同一出口） */',
     'q.elapsed = q.elapsed + 1;',
     'v89.86（P-07）'),
    ('P-08 可达性恒真（过滤失效）', DO,
     "return (def.goal || 0) <= Math.max(1, popCap);",
     'return true;',
     'v89.86（P-08）'),
    ('P-20 行军段改回按本城过滤', UI,
     'var list = (s.marches || []).slice();',
     'var list = (s.marches || []).filter(function (m) { return !c || m.cityId === c.id; });',
     'v89.86（P-20）'),
    ('P-21 连做退化（只做 1 次）', DO,
     'var max = (Number(n) > 0) ? Math.min(Math.floor(Number(n)), left0) : left0;',
     'var max = 1;',
     'v89.86（P-21）'),
    ('门派P1 sectBonus 恒 0（加成失效）', DO,
     'return t.val || 0;\n  };',
     'return 0;\n  };',
     'v89.86（门派P1）'),
]


def main():
    smoke_src = io.open(SMOKE, encoding='utf-8', newline='').read()
    # 断言在位校验
    missing = []
    for name, _, _, _, watch in INJECTIONS:
        if watch not in smoke_src:
            missing.append((name, watch))
    if missing:
        print('✗ 部分断言不在 smoke-test.js（先同步断言清单）：')
        for n, w in missing:
            print('   -', n, '→', w)
        return 2
    print('① 断言在位校验：%d 条全部命中 ✅' % len(INJECTIONS))

    files = sorted({t for _, t, _, _, _ in INJECTIONS})
    base = {p: md5(p) for p in files}
    origin = {p: io.open(p, encoding='utf-8', newline='').read() for p in files}
    print('② 基线 md5：%d 个文件已记\n' % len(files))

    results = []
    for name, target, old, new, watch in INJECTIONS:
        print('── %s ──' % name)
        try:
            n = origin[target].count(old)
            if n != 1:
                print('   ✗ 锚点出现 %d 次（要求 1 次），未注入\n' % n)
                results.append((name, False, '锚点 %d 次' % n))
                continue
            io.open(target, 'w', encoding='utf-8', newline='').write(
                origin[target].replace(old, new, 1))
            rc, counts, fails = run_smoke()
            red = any(watch in f for f in fails)
            print('   smoke 退出码 %s  计数 %s  失败行 %d' % (rc, counts, len(fails)))
            if counts is None:
                print('   ⚠️ 判据失效：拿不到标准汇总行（疑似中断）')
            for f in [x for x in fails if watch in x][:2]:
                print('   ❌ ' + f.strip()[:78])
            print('   目标断言变红：%s' % ('✅ 是' if red else '❌ 否（零反应！）'))
            results.append((name, red, '失败 %s' % (counts[1] if counts else '?')))
        finally:
            io.open(target, 'w', encoding='utf-8', newline='').write(origin[target])
        print()

    print('=' * 62)
    for name, ok, note in results:
        print(('  ✅ ' if ok else '  ❌ ') + name + '  (' + note + ')')
    allok = all(ok for _, ok, _ in results)
    same = all(md5(p) == base[p] for p in files)
    print('=' * 62)
    print('破坏测试：%d/%d 变红' % (sum(1 for _, ok, _ in results if ok), len(results)))
    print('还原核验：%s' % ('✅ 全部文件与注入前逐字节一致' if same else '❌ 未还原干净！'))
    return 0 if (allok and same) else 1


if __name__ == '__main__':
    sys.exit(main())
