# -*- coding: utf-8 -*-
"""v66 破坏测试：逐条注入"退回改前写法"，确认对应断言真的变红。
规矩（本项目踩过 5 次坑）：
  ① 先备份 → 见备份先还原 → 每例后还原 → 收尾 md5 比对；
  ② 跑之前**先校验断言确实在文件里**（否则"零反应"看着像全绿）；
  ③ 注入后连"是否中断"一起看（中断 = 后面的断言没跑，不能算通过）。
"""
import io, os, re, shutil, hashlib, subprocess, sys

ROOT = r'E:\Deepseekdb'
TMP = os.path.join(ROOT, '.workbuddy', 'tmp')
BAK = os.path.join(TMP, 'break_bak_v66')
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
ENV = dict(os.environ)
ENV['NODE_PATH'] = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'

FILES = ['js/data.js', 'js/state.js', 'js/domain.js', 'js/battle.js', 'js/systems.js', 'js/ui.js',
         'smoke-test.js', 'e2e-test.js']


def md5(p):
    return hashlib.md5(io.open(p, 'rb').read()).hexdigest()


def backup():
    if not os.path.isdir(BAK):
        os.makedirs(BAK)
    for f in FILES:
        d = os.path.join(BAK, f.replace('/', '__'))
        if not os.path.exists(d):
            shutil.copy2(os.path.join(ROOT, f), d)


def restore():
    for f in FILES:
        d = os.path.join(BAK, f.replace('/', '__'))
        if os.path.exists(d):
            shutil.copy2(d, os.path.join(ROOT, f))


def patch(rel, old, new):
    p = os.path.join(ROOT, rel)
    src = io.open(p, 'r', encoding='utf-8', newline='').read()
    if src.count(old) != 1:
        raise RuntimeError('锚点命中 %d 次：%s' % (src.count(old), rel))
    io.open(p, 'w', encoding='utf-8', newline='').write(src.replace(old, new))


def run(script, timeout=600):
    r = subprocess.run([NODE, script], cwd=ROOT, env=ENV, stdout=subprocess.PIPE,
                       stderr=subprocess.STDOUT, timeout=timeout)
    out = r.stdout.decode('utf-8', 'replace')
    fails = re.findall(r'❌ ([^\[]+)\[?', out)
    aborted = ('中断' in out and '不可当作通过' in out) or ('异常（已中断' in out)
    total = re.search(r'结果：(\d+) 通过 / (\d+) 失败', out)
    return {'fails': [f.strip() for f in fails], 'aborted': aborted,
            'raw': out, 'summary': total.group(0) if total else '（没有结果行 —— 可能崩了）'}


# 每例：(说明, 注入函数, 跑哪个脚本, 期望变红的断言关键字)
CASES = [
    ('客栈天授权重退回 2（÷10 作废）',
     lambda: patch('js/data.js', "w: 0.2, wg: 0.28", "w: 2, wg: 0.28"),
     'smoke-test.js', '权重按 ÷10'),
    ('权重下限退回写死的 0.5',
     lambda: patch('js/state.js', "Math.max(r.w * 0.05,", "Math.max(0.5,"),
     'smoke-test.js', '下限'),
    ('装备体力不再进上限',
     lambda: patch('js/domain.js', "return Math.round(GAME.staBaseMax(g) + GAME.staEquipOf(g));",
                   "return Math.round(GAME.staBaseMax(g));"),
     'smoke-test.js', '散件'),
    ('战斗里加回"装备生命"第二条路',
     lambda: patch('js/battle.js',
                   "    return 1 + (GAME.staHpBonus ? GAME.staHpBonus(gen) : 0);",
                   "    var eq = (GAME.systems && GAME.systems.genEquipBonus)\n"
                   "      ? Math.min(0.25, (GAME.systems.genEquipBonus(gen).sta || 0) / 10000) : 0;\n"
                   "    return 1 + (GAME.staHpBonus ? GAME.staHpBonus(gen) : 0) + eq;"),
     'smoke-test.js', '不再有第二条路'),
    ('经验道具不再拦上限',
     lambda: patch('js/systems.js',
                   "      var blk = GAME.expBlockOf ? GAME.expBlockOf(g3) : '';\n      if (blk) return { ok: false, msg: blk };",
                   "      var blk = '';"),
     'smoke-test.js', 'useItem 拒绝'),
    ('封顶判据失效（expBlockOf 永远放行）',
     lambda: patch('js/domain.js', "    if ((g.level || 1) < cap) return '';", "    return '';"),
     'smoke-test.js', '到上限后给出原因'),
    ('将领页体力主数字退回"当前值"',
     lambda: patch('js/ui.js', "U.numText(staMx, 0) + '</b>'", "U.numText(staNow, 0) + '</b>'"),
     'e2e-test.js', '体力」主数字'),
]

if __name__ == '__main__':
    backup()
    restore()          # 上次被打断留下的注入先清掉
    base = {f: md5(os.path.join(ROOT, f)) for f in FILES}

    # 预检：期望变红的断言字符串必须在测试文件里
    missing = []
    for desc, fn, script, key in CASES:
        s = io.open(os.path.join(ROOT, script), 'r', encoding='utf-8', newline='').read()
        if key not in s:
            missing.append('%s ← 「%s」不在 %s 里' % (desc, key, script))
    if missing:
        print('⛔ 预检失败（断言根本不在文件里，注入必然零反应）：')
        for m in missing:
            print('   ' + m)
        sys.exit(2)
    print('预检通过：%d 例的断言关键字都在。\n' % len(CASES))

    zero = []
    for desc, fn, script, key in CASES:
        restore()
        try:
            fn()
        except Exception as e:
            print('⛔ 注入失败（锚点问题）：%-30s %s' % (desc, e))
            zero.append(desc + '（锚点错）')
            continue
        r = run(script)
        hit = any(key in f for f in r['fails'])
        flag = '✅ 变红' if hit else '⛔ 零反应'
        if not hit:
            zero.append(desc)
        print('%s  %-34s %s  %s' % (flag, desc, r['summary'], '（中断！）' if r['aborted'] else ''))
        if hit:
            got = [f for f in r['fails'] if key in f][0]
            print('       命中断言：' + got[:80])
        else:
            print('       红了的断言：' + ('、'.join(r['fails'][:4]) if r['fails'] else '（一条都没红）'))
    restore()

    # 收尾：md5 必须与基线完全一致
    bad = [f for f in FILES if md5(os.path.join(ROOT, f)) != base[f]]
    print('')
    print('收尾 md5 校验：%s' % ('全部还原 ✅' if not bad else '⛔ 残留：' + '、'.join(bad)))
    print('零反应：%d 例 %s' % (len(zero), ('→ ' + '、'.join(zero)) if zero else ''))
