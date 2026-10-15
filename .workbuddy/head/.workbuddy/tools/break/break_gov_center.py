# -*- coding: utf-8 -*-
"""破坏测试：确认第 55 节（官府居中 + 迁移）的核心断言**真的会红**。

  A. govCellsOf 退回旧公式（右侧）→ "玩家城官府居中"必红
  B. 迁移的"对调"改成"直接清空"→ "中央的建筑与旧位对调"必红
  C. 迁移幂等守卫（atOld）移除 → "迁移幂等"必红

用法：python break_gov_center.py
"""
import hashlib, io, os, re, subprocess, sys

ROOT = r'E:\Deepseekdb'
J = lambda *a: os.path.join(ROOT, *a)
SMOKE = J('smoke-test.js')
ST = J('js', 'state.js')
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
NODE_PATH = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'

MUST_HAVE = [
    '玩家城官府居中',
    '迁移：中央的建筑与旧位对调',
    '迁移幂等',
]

INJECTIONS = [
    ('A. govCellsOf 退回右侧旧公式',
     ST,
     '  GAME.govCellsOf = function (col, row) {\n    var gc = Math.floor((col - 2) / 2), gr = Math.floor((row - 2) / 2);',
     '  GAME.govCellsOf = function (col, row) {\n    var gc = col - 2, gr = Math.floor((row - 2) / 2);   /* BREAKTEST */',
     '玩家城官府居中'),

    ('B. 迁移"对调"改成"直接清空"（建筑丢失）',
     ST,
     '          c.cells[oi].build = dis.build || null;',
     '          c.cells[oi].build = null;   /* BREAKTEST */',
     '迁移：中央的建筑与旧位对调'),

    ('C. 迁移幂等守卫移除（每次读档都折腾）',
     ST,
     '        if (!atOld) return;',
     '        /* BREAKTEST: if (!atOld) return; */',
     '迁移幂等'),
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
        print('✗ 下列断言不在 smoke-test.js 里（先同步断言清单）：')
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
        print('── %s ──' % name)
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
