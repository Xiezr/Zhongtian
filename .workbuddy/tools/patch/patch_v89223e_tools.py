# -*- coding: utf-8 -*-
"""v89.223e：活工具夹具同步 —— cityName 许都→灰岗（17 文件）+ 显示词（audit 链）。
历史补丁/探针/截图脚本（映射源/历史仪器）不在本批。
用法: DRY=1 python patch_v89223e_tools.py
"""
import io, os, sys

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

DRY = os.environ.get('DRY') == '1'
BASE = '.workbuddy/tools/'
FIX = [("cityName: '许都'", "cityName: '灰岗'", 1)]

TOOLS = [
    ('audit/audit_v89105_chains.js', FIX + [
        ('义兵', '民兵', 3), ('民夫', '搬运工', 4), ('辎重车', '运输车', 1)]),
    ('audit/audit_v89105_modals.js', FIX),
    ('audit/audit_v89112_pressure.js', FIX),
    ('audit/diag_v89105_overflow.js', FIX),
    ('audit/ladder_audit.js', [('义兵', '民兵', 5), ('铁骑', '装甲战车', 1)]),
    ('asset/check_v89174_shots.js', FIX),
    ('asset/verify_v89106_screen.js', FIX),
    ('play/lifecycle_v89121.js', FIX),
    ('play/repro_v89174_builddone.js', FIX),
    ('play/repro_v89174b_window.js', FIX),
    ('play/repro_v89174c_zero.js', FIX),
    ('playtest/play_600x.js', FIX + [('「许都」', '「灰岗」', 1), ('· 豫州 ·', '· 碎垣 ·', 1)]),
    ('playtest/play_farm2_600x.js', FIX + [('「许都」', '「灰岗」', 1), ('· 豫州 ·', '· 碎垣 ·', 1)]),
    ('playtest/play_gold_600x.js', FIX + [('「许都」', '「灰岗」', 1), ('· 豫州 ·', '· 碎垣 ·', 1)]),
    ('playtest/play_strat_600x.js', FIX + [('「许都」', '「灰岗」', 1), ('· 豫州 ·', '· 碎垣 ·', 1)]),
    ('playtest/play_rush_1x.js', FIX + [('「许都」', '「灰岗」', 1), ('· 豫州 ·', '· 碎垣 ·', 1)]),
    ('playtest/play_v89118.js', FIX + [('「许都」', '「灰岗」', 1), ('· 豫州 ·', '· 碎垣 ·', 1)]),
]

nfo = 0
for rel, subs in TOOLS:
    f = BASE + rel
    s = rd(f)
    if not s:
        raise AssertionError('missing %s' % f)
    for old, new, exp in subs:
        if old not in s:
            if new in s:
                print('[skip] %s :: %s -> %s' % (rel, old, new))
                continue
            raise AssertionError('[%s] 锚点缺失: %s' % (rel, old))
        c = s.count(old)
        assert c == exp, '[%s] %s count=%d（应 %d）' % (rel, old, c, exp)
        s = s.replace(old, new)
        nfo += 1
    if not DRY:
        wr(f, s)
    print('[ok] %s' % rel)
print(('DRY 预检完成' if DRY else '已落盘') + '（%d 文件 · %d 处）' % (len(TOOLS), nfo))
