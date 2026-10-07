# -*- coding: utf-8 -*-
"""v89.224a：将领→英雄 · 商城→游商（全站换代 · 唯一映射源见 docs/废土术语映射表.md）
范围：js/*.js + index.html + smoke-test.js + e2e-test.js（代码/文案/注释全过）。
保留：docs/ 史档（需求档案逐字引述铁律）与 .workbuddy/tools 历史仪器（映射源面）。
附：GAME.VERSION → v89.224；smoke §199④ 版本正则同步。
用法：DRY=1 python patch_v89224a_names.py   （预检） / python patch_v89224a_names.py（落盘）
"""
import io, os, sys

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()

def wr(p, s):
    if DRY:
        return
    tmp = BASE + p + '.tmp224a'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)

targets = ['js/data.js', 'js/ui.js', 'js/domain.js', 'js/state.js', 'js/main.js', 'js/battle.js',
           'js/systems.js', 'js/questdata.js', 'js/tactic.js', 'js/map.js', 'js/icons.js',
           'js/gicons.js', 'js/portraits.js', 'js/story.js', 'js/bitmaps.js',
           'index.html', 'smoke-test.js', 'e2e-test.js']

REPL = [('将领', '英雄'), ('商城', '游商')]
log = []
tot = 0
for f in targets:
    s = rd(f)
    n = 0
    for a, b in REPL:
        c = s.count(a)
        if c:
            s = s.replace(a, b)
            n += c
    if n:
        wr(f, s)
    log.append('%s: %d' % (f, n))
    tot += n

print('[%s] 替换总计 %d 处' % ('DRY' if DRY else 'REAL', tot))
for l in log:
    print('  ' + l)

# 版本号：main.js 唯一出口 + smoke §199④ 正则（§223⑤ 的历史字面量保持不动）
s = rd('js/main.js')
assert "GAME.VERSION = 'v89.223';" in s, 'main.js 版本锚点缺失'
s = s.replace("GAME.VERSION = 'v89.223';", "GAME.VERSION = 'v89.224';")
wr('js/main.js', s)
print('[版本] js/main.js v89.223 → v89.224 %s' % ('（DRY）' if DRY else ''))

s = rd('smoke-test.js')
old_re = "/GAME\\.VERSION = 'v89\\.223'/"
n_re = s.count(old_re)
assert n_re == 2, '§199④/§223⑤ 活版本正则应为 2 处，实为 %d' % n_re
s = s.replace(old_re, "/GAME\\.VERSION = 'v89\\.224'/")
wr('smoke-test.js', s)
print('[版本] smoke 两处活版本正则 → v89.224（§223⑤ 档案字面量保持）%s' % ('（DRY）' if DRY else ''))

# 核验：可执行形态零残留（剥离注释后不应再有 将领/商城）
if not DRY:
    for f in targets:
        s = rd(f)
        c1, c2 = s.count('将领'), s.count('商城')
        assert c1 == 0 and c2 == 0, '残留 %s: 将领=%d 商城=%d' % (f, c1, c2)
    print('[核验] 18 个目标文件 将领/商城 全零 ✓')
