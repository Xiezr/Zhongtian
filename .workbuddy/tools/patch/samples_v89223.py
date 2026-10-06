# -*- coding: utf-8 -*-
"""v89.223 改前/改后对照样本 v2（换位链与守卫段引用已校正）。
运行: python samples_v89223.py
"""
import io, os

def rd(p):
    try:
        return io.open(p, encoding='utf-8', newline='').read()
    except Exception:
        return ''

B = '.workbuddy/backup/v89223/'
def bb(rel):
    if rel.startswith('.workbuddy/tools/'):
        return B + 'tools/' + os.path.basename(rel)
    return B + rel.replace('js/', '')

ROWS = [
    ('ab 长矛手', 'js/data.js', "ab: '枪'", "ab: '矛'", (1, 1, 0), ''),
    ('ab 弩手', 'js/data.js', "ab: '弓'", "ab: '弩'", (1, 1, 0), ''),
    ('ab 搬运工（换位）', 'js/data.js', "ab: '民'", "ab: '搬'", (1, 1, 1), '「民」移交民兵（残留=1 为设计）'),
    ('ab 民兵（换位）', 'js/data.js', "ab: '义'", "ab: '民'", (1, 1, 0), ''),
    ('ab 变异巨兽', 'js/data.js', "ab: '象'", "ab: '兽'", (1, 1, 0), ''),
    ('ab 王牌战车', 'js/data.js', "ab: '虎'", "ab: '王'", (1, 1, 0), ''),
    ('战报示例', 'js/data.js', '[攻]弓箭兵前进454', '[攻]弩手前进454', (1, 1, 0), ''),
    ('任务 r02', 'js/questdata.js', "title: '弓弩扩充'", "title: '弩手扩充'", (1, 1, 0), ''),
    ('任务 g20', 'js/questdata.js', "title: '弓弩之利'", "title: '强弩之利'", (1, 1, 0), ''),
    ('icons 注释', 'js/icons.js', '/* 战象 */', '/* 变异巨兽 */', (1, 1, 0), ''),
    ('主循环注释', 'js/state.js', '史册记账 + 年号纪元', '（story.js；史册记账随 v89.218 退役）', (1, 1, 0), ''),
    ('版本号', 'js/main.js', "GAME.VERSION = 'v89.222';", "GAME.VERSION = 'v89.223';", (1, 1, 0), ''),
    ('smoke 兵牌镜像', 'smoke-test.js', '>枪<span', '>矛<span', (1, 2, 0), '新后=2（镜像 + §223③ 守卫引用）'),
    ('smoke 出口期望', 'smoke-test.js', "=== '枪' &&", "=== '矛' &&", (1, 1, 0), '正文 1 处（§223③ 引用不带 &&）'),
    ('§199④ 版本正则', 'smoke-test.js', "v89\\.222", "v89\\.223", (1, 2, 0), '新后=2（正则 + §223⑤ 守卫）'),
    ('工具夹具 chains', '.workbuddy/tools/audit/audit_v89105_chains.js', "cityName: '许都'", "cityName: '灰岗'", (1, 1, 0), ''),
    ('工具链词 chains', '.workbuddy/tools/audit/audit_v89105_chains.js', '义兵', '民兵', (3, None, 0), '新后 ≥3（显示词）'),
    ('工具词 ladder', '.workbuddy/tools/audit/ladder_audit.js', '可养义兵', '可养民兵', (1, 1, 0), ''),
]

ok = 0
print('%-22s %-6s %-6s %-6s %-6s %s' % ('样本', 'old前', 'new后', 'old残', '判定', '备注'))
for tag, rel, a, b, (ea, eb, eo), note in ROWS:
    ca = rd(bb(rel)).count(a)
    ct = rd(rel)
    cb = ct.count(b)
    co = ct.count(a)
    good = (ca == ea and co == eo and (cb == eb if eb is not None else cb >= 1))
    ok += good
    print('%-24s %-6d %-6d %-6d %-6s %s' % (tag, ca, cb, co, 'OK' if good else '!!!!', note))
print('对照 %d/%d' % (ok, len(ROWS)))
