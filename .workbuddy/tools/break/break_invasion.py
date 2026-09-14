# -*- coding: utf-8 -*-
"""破坏测试：确认第 53 节（定期来袭）的三条核心断言**真的会红**。

红不了的就是装饰。逐类注入，每类都：
  ① 先校验断言确实在 smoke-test.js 里（改名要同步这张清单，否则会得出"零反应"的错误结论）
  ② 注入后跑 smoke，连"是否中断"一起看（拿不到「结果：N 通过 / M 失败」= 判据失效，不算红）
  ③ 收尾对**每个被动过的文件**做 md5 比对还原（成功失败都要还原）

⚠️ 每个注入要指名**目标文件** —— 第一版把三条都指向 state.js，
   结果 "cityDefense 恒返回 0" 锚点 0 次命中：它定义在 **domain.js**。
   （教训：注入锚点必须按"函数定义在哪个文件"逐条核对，不能假设同源。）

用法：python break_invasion.py
"""
import hashlib, io, os, re, subprocess, sys

ROOT = r'E:\Deepseekdb'
J = lambda *a: os.path.join(ROOT, *a)
SMOKE = J('smoke-test.js')
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
NODE_PATH = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'

MUST_HAVE = [
    '城墙 Lv0→12 守备力真的变了',
    '兵力集中在目标城 → 战损更小',
    '离线 simulateBulk 调 invasionTick',
]

INJECTIONS = [
    ('A. cityDefense 恒返回 0',
     J('js', 'domain.js'),
     '  GAME.cityDefense = function (city) {\n',
     '  GAME.cityDefense = function (city) {\n    return 0;   /* BREAKTEST */\n',
     '城墙 Lv0→12 守备力真的变了'),

    ('B. armyPowerOf 恒返回固定值',
     J('js', 'state.js'),
     '  GAME.armyPowerOf = function (city) {\n',
     '  GAME.armyPowerOf = function (city) {\n    return 1000;   /* BREAKTEST */\n',
     '兵力集中在目标城 → 战损更小'),

    ('C. simulateBulk 里删掉 invasionTick',
     J('js', 'state.js'),
     '    GAME.invasionTick(ts / 3600 * secReal);\n',
     '    /* BREAKTEST: 调用被移除 */\n',
     '离线 simulateBulk 调 invasionTick'),
]


def md5(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def run_smoke():
    env = dict(os.environ); env['NODE_PATH'] = NODE_PATH
    r = subprocess.run([NODE, 'smoke-test.js'], cwd=ROOT, capture_output=True, env=env, timeout=600)
    out = r.stdout.decode('utf-8', 'replace')
    m = re.search(r'结果：\s*(\d+)\s*通过\s*/\s*(\d+)\s*失败', out)
    return r.returncode, (m.groups() if m else None), re.findall(r'❌ (.+)', out)


def main():
    smoke_src = io.open(SMOKE, encoding='utf-8', newline='').read()
    missing = [s for s in MUST_HAVE if s not in smoke_src]
    if missing:
        print('✗ 下列断言不在 smoke-test.js 里，破坏测试无从判读（先同步断言清单）：')
        for s in missing:
            print('   -', s)
        return 2
    print('① 断言在位校验：%d 条全部命中 ✅' % len(MUST_HAVE))

    files = sorted({t for _, t, _, _, _ in INJECTIONS})
    base = {p: md5(p) for p in files}
    origin = {p: io.open(p, encoding='utf-8', newline='').read() for p in files}
    print('② 基线 md5：%d 个文件已记\n' % len(files))

    results = []
    for name, target, old, new, watch in INJECTIONS:
        print('── %s  （目标 %s）──' % (name, os.path.relpath(target, ROOT)))
        try:
            n = origin[target].count(old)
            if n != 1:
                print('   ✗ 锚点出现 %d 次（要求 1 次），未注入\n' % n)
                results.append((name, False, '锚点 %d 次' % n))
                continue
            io.open(target, 'w', encoding='utf-8', newline='').write(origin[target].replace(old, new, 1))
            rc, counts, fails = run_smoke()
            red = any(watch in f for f in fails)
            print('   smoke 退出码 %s  计数 %s  失败行 %d' % (rc, counts, len(fails)))
            if counts is None:
                print('   ⚠️ 判据失效：拿不到标准汇总行（疑似中断）')
            for f in [x for x in fails if watch in x][:2]:
                print('   ❌ ' + f.strip()[:76])
            print('   目标断言变红：%s' % ('✅ 是' if red else '❌ 否（零反应！注入没打到点上）'))
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
