# -*- coding: utf-8 -*-
"""破坏测试：确认第 57 节（可领取任务置顶 + 行内领取）的核心断言**真的会红**。

  A. 顶块不再渲染（return 里摘掉 readyBlock）→ "达标任务自动置顶"必红
  B. 行内「领取」按钮去掉 data-q（点了也领不到）→ "顶块每行右侧都有"必红
  C. 已达标项不再从原区块排除（重复占位）→ "不再在原区块重复出现"必红
  D. 主循环钩子摘除（退回手动刷新）→ "主循环挂了…钩子"必红

用法：python break_quest_ready.py
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
UI = J('js', 'ui.js')
MAIN = J('js', 'main.js')
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
NODE_PATH = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'

MUST_HAVE = [
    '达标任务自动置顶',
    '顶块每行右侧都有',
    '不再在原区块重复出现',
    '主循环挂了',
]

INJECTIONS = [
    ('A. 顶块不再渲染（readyBlock 从 return 里摘掉）',
     UI,
     '      /* v69：可领取块在最顶 —— 有奖可领优先于历史记录 */\n      readyBlock +\n',
     '      /* BREAKTEST: 顶块未渲染 */\n      \'\' +\n',
     '达标任务自动置顶'),

    ('B. 行内「领取」按钮去掉 data-q（点了也领不到）',
     UI,
     '+ \'" data-q="\' + o.id + \'">领取</button></span>\'',
     '+ \'" data-q="">领取</button></span>\'   /* BREAKTEST */',
     '顶块每行右侧都有'),

    ('C. 已达标项不再从原区块排除（一处占位被破坏）',
     UI,
     '    var randWait = randItems.filter(notReady);',
     '    var randWait = randItems;   /* BREAKTEST */',
     '不再在原区块重复出现'),

    ('D. 主循环不再挂「可领取数→重绘任务面板」钩子（退回手动刷新）',
     MAIN,
     "        var qr = GAME.questSummary().ready;\n"
     "        if (GAME._lastQuestReady !== qr) {\n"
     "          GAME._lastQuestReady = qr;\n"
     "          if (ui.view === 'tasks') ui.renderView('tasks');\n"
     "        }\n",
     "        /* BREAKTEST: 主循环钩子摘除 */\n",
     '主循环挂了'),
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
