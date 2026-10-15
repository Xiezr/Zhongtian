# -*- coding: utf-8 -*-
"""v67 破坏测试：注入"退回改前写法"，确认对应断言真的变红。
规矩同 v66：备份 → 见备份先还原 → 每例后还原 → 收尾 md5；跑前先校验断言在文件里。"""
import io, os, re, shutil, hashlib, subprocess, sys

ROOT = r'E:\Deepseekdb'
BAK = os.path.join(ROOT, '.workbuddy', 'tmp', 'break_bak_v67')
NODE = r'C:\Users\18811\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
ENV = dict(os.environ); ENV['NODE_PATH'] = r'C:\Users\18811\.workbuddy\binaries\node\workspace\node_modules'
FILES = ['js/domain.js', 'js/ui.js', 'js/main.js', 'index.html', 'smoke-test.js', 'e2e-test.js']


def md5(p): return hashlib.md5(io.open(p, 'rb').read()).hexdigest()

def backup():
    if not os.path.isdir(BAK): os.makedirs(BAK)
    for f in FILES:
        d = os.path.join(BAK, f.replace('/', '__'))
        if not os.path.exists(d): shutil.copy2(os.path.join(ROOT, f), d)

def restore():
    for f in FILES:
        d = os.path.join(BAK, f.replace('/', '__'))
        if os.path.exists(d): shutil.copy2(d, os.path.join(ROOT, f))

def patch(rel, old, new):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    if s.count(old) != 1:
        raise RuntimeError('锚点命中 %d 次：%s' % (s.count(old), rel))
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new))

def run(script, timeout=600):
    r = subprocess.run([NODE, script], cwd=ROOT, env=ENV, stdout=subprocess.PIPE,
                       stderr=subprocess.STDOUT, timeout=timeout)
    out = r.stdout.decode('utf-8', 'replace')
    fails = [x.strip() for x in re.findall(r'❌ ([^\[]+)\[?', out)]
    aborted = ('不可当作通过' in out) or ('异常（已中断' in out)
    m = re.search(r'结果：(\d+) 通过 / (\d+) 失败', out)
    return {'fails': fails, 'aborted': aborted, 'summary': m.group(0) if m else '（没有结果行）'}

CASES = [
    ('野地驻军那项清理被删掉（表里漏一项）',
     lambda: patch('js/domain.js',
                   "    { key: 'wilds', path: 'garrison.cityId', label: '野地驻军',\n      clean: function",
                   "    { key: 'wilds', path: 'garrison.cityId', label: '野地驻军',\n      cleanX: function"),
     'smoke-test.js', '关联数据一类都不剩'),
    ('最后一座城的限制被去掉',
     lambda: patch('js/domain.js', "    if ((s.cities || []).length <= 1) {", "    if (false) {"),
     'smoke-test.js', '最后一座城池不许放弃'),
    ('放弃后不重算 NPC 城列表',
     lambda: patch('js/domain.js',
                   "      s.map.cities = GAME.buildNpcCities(s.map.seed).filter(function (c) { return !taken[c.id]; });",
                   "      s.map.cities = s.map.cities;"),
     'smoke-test.js', '系统城回到地图'),
    ('城池面板入口不再看"还有别的城"',
     lambda: patch('js/ui.js', "(isOwn && (s.cities || []).length > 1", "(isOwn && true"),
     'smoke-test.js', '只在还有别的城时出现'),
    ('增速列的发丝竖线被去掉',
     lambda: patch('index.html',
                   "    /* v67（老板）：「分一下列」—— 增速列与存量列之间走一条发丝竖线 */\n    border-left: 1px solid var(--line);",
                   "    /* 竖线被去掉 */"),
     'smoke-test.js', '发丝竖线'),
]

if __name__ == '__main__':
    backup()
    restore()
    base = {f: md5(os.path.join(ROOT, f)) for f in FILES}
    missing = []
    for desc, fn, script, key in CASES:
        s = io.open(os.path.join(ROOT, script), 'r', encoding='utf-8', newline='').read()
        if key not in s:
            missing.append('%s ← 「%s」不在 %s' % (desc, key, script))
    if missing:
        print('⛔ 预检失败：'); [print('   ' + m) for m in missing]; sys.exit(2)
    print('预检通过：%d 例断言都在。\n' % len(CASES))

    zero = []
    for desc, fn, script, key in CASES:
        restore()
        try:
            fn()
        except Exception as e:
            print('⛔ 注入失败：%-32s %s' % (desc, e)); zero.append(desc + '（锚点错）'); continue
        r = run(script)
        hit = any(key in f for f in r['fails'])
        if not hit: zero.append(desc)
        print('%s  %-34s %s  %s' % ('✅ 变红' if hit else '⛔ 零反应', desc, r['summary'],
                                    '（中断！）' if r['aborted'] else ''))
        if hit:
            print('       命中断言：' + [f for f in r['fails'] if key in f][0][:70])
        else:
            print('       红了的断言：' + ('、'.join(r['fails'][:4]) if r['fails'] else '（一条都没红）'))
    restore()
    bad = [f for f in FILES if md5(os.path.join(ROOT, f)) != base[f]]
    print('\n收尾 md5：%s' % ('全部还原 ✅' if not bad else '⛔ 残留：' + '、'.join(bad)))
    print('零反应：%d 例 %s' % (len(zero), ('→ ' + '、'.join(zero)) if zero else ''))
