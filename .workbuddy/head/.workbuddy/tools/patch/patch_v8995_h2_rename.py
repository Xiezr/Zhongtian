# -*- coding: utf-8 -*-
"""v89.95 Patch H2 —— 稀缺资源改名：虎符 → **节钺**（虎符之名已被商城符类占用，实测撞名）。
逐文件做定向替换（不用全局替换，避免误伤"虎符"符类）。"""
import io, subprocess

FILES = ['js/data.js', 'js/domain.js', 'js/battle.js', 'js/systems.js', 'js/state.js', 'js/ui.js', 'js/main.js']
PAIRS = [
    ('DATA.HUFU', 'DATA.JIEYUE'),
    ('DATA.JIEYUE', 'DATA.JIEYUE'),
    ('GAME.hufuOf', 'GAME.jieyueOf'),
    ('GAME.hufuGrant', 'GAME.jieyueGrant'),
    ('GAME.hufuClaim', 'GAME.jieyueClaim'),
    ('GAME.hufuSpend', 'GAME.jieyueSpend'),
    ('GAME.hufuTextOf', 'GAME.jieyueTextOf'),
    ('GAME.hufuExpandCity', 'GAME.jieyueExpandCity'),
    ('GAME.hufuCfg', 'GAME.jieyueCfg'),
    ('s.hufuTaken', 's.jieyueTaken'),
    ('s0.hufuTaken', 's0.jieyueTaken'),
    ('s0.hufu', 's0.jieyue'),
    ('S95.hufu', 'S95.jieyue'),
    ('s.hufu', 's.jieyue'),
    ('g.hufu', 'g.jieyue'),
    ('city.hufuSlots', 'city.jieyueSlots'),
    ('c.hufuSlots', 'c.jieyueSlots'),
    ('hufu-expand', 'jieyue-expand'),
    ("'虎符'", "'节钺'"),
    ('🐯 虎符', '🪓 节钺'),
    ('虎符 ×', '节钺 ×'),
    ('虎符不足', '节钺不足'),
    ('虎符只能', '节钺只能'),
    ('虎符系统不可用', '节钺系统不可用'),
    ('虎符扩编', '节钺扩编'),
    ('首占名城 → 虎符', '首占名城 → 节钺'),
    ('虎符**', '节钺**'),
    ('**虎符', '**节钺'),
    ('得虎符', '得节钺'),
    ('用虎符', '用节钺'),
    ('虎符（', '节钺（'),
    ('虎符】', '节钺】'),
    ('问鼎天授（1 枚）· 城池扩编', '问鼎天授（1 枚）· 开府扩编'),
    ('🐯', '🪓'),
]
tot = 0
for f in FILES:
    s = io.open(f, encoding='utf-8').read()
    o = s
    for a, b in PAIRS:
        if a in s:
            s = s.replace(a, b)
    if s != o:
        io.open(f, 'w', encoding='utf-8', newline='').write(s)
        print('PATCHED ' + f)
        tot += 1
print('files changed: %d' % tot)

# 数据层的名字与图标定稿
P = 'js/data.js'
s = io.open(P, encoding='utf-8').read()
if 'name: \'节钺\', icon: \'🪓\'' in s or "name: '节钺'" in s:
    print('data name OK')
else:
    print('WARN: data name 未改到，请人工核对')
for f in FILES:
    r = subprocess.run(['node', '--check', f], capture_output=True, cwd='E:/Deepseekdb')
    print(f + ': ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:200]))
