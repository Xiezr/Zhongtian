# -*- coding: utf-8 -*-
"""破坏测试：确认第 58 节（v70 五项需求）的核心断言**真的会红**。

  A. 解雇守卫摘除（君主可被解雇）        → "★ 君主不可解雇"必红
  B. 迁址不还原旧地块（旧格留 city）      → "★ 迁址：旧格还平原"必红
  C. 城外数量表少一块（合计 ≠ 上限）      → "★ 城外数量表逐档合计"必红
  D. 出生点忽略所选州（恒回固定点）       → "★ 出生州：十三州逐个验证"必红

用法：python break_v70.py
"""
import hashlib
import io
import os
import re
import subprocess
import sys

ROOT = r'E:\Deepseekdb'
J = lambda *a: os.path.join(ROOT, *a)
SMOKE = J('smoke-test.js')
DOMAIN = J('js', 'domain.js')
DATA = J('js', 'data.js')
STATE = J('js', 'state.js')
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
NODE_PATH = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'

MUST_HAVE = [
    '★ 君主不可解雇',
    '★ 迁址：旧格还平原',
    '★ 城外数量表逐档合计',
    '★ 出生州：十三州逐个验证',
]

INJECTIONS = [
    ('A. 解雇守卫摘除（君主可被解雇）',
     DOMAIN,
     "    /* v70（老板）：「不可解雇」—— 君主本人（框架与守卫同源：GAME.isLordGeneral） */\n"
     "    if (GAME.isLordGeneral(g)) return { ok: false, msg: '君主本人不可解雇' };\n",
     "    /* BREAKTEST: 君主守卫摘除 */\n",
     '★ 君主不可解雇'),

    ('B. 迁址不还原旧地块（旧格留 city）',
     DOMAIN,
     "    /* ① 旧格归还：走「放弃城池」同一出口 restoreCityTile（自建城 → 还回平原） */\n"
     "    GAME.restoreCityTile(city);\n",
     "    /* BREAKTEST: 旧格不归还 */\n",
     '★ 迁址：旧格还平原'),

    ('C. 城外数量表少一块（合计 ≠ 上限）',
     DATA,
     "    [5, 3, 2, 2],   [6, 4, 2, 3],   [7, 5, 3, 3],   [8, 6, 4, 3],",
     "    [4, 3, 2, 2],   [6, 4, 2, 3],   [7, 5, 3, 3],   [8, 6, 4, 3],   /* BREAKTEST */",
     '★ 城外数量表逐档合计'),

    ('D. 出生点忽略所选州（恒回固定点）',
     STATE,
     "  GAME.pickStartPos = function (stateName, seed) {\n",
     "  GAME.pickStartPos = function (stateName, seed) {\n"
     "    return { x: DATA.START_POS.x, y: DATA.START_POS.y, state: stateName };   /* BREAKTEST */\n",
     '★ 出生州：十三州逐个验证'),
]


def md5(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def run_smoke():
    env = dict(os.environ)
    env['NODE_PATH'] = NODE_PATH
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
