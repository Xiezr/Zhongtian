# -*- coding: utf-8 -*-
"""v89.223b：产品侧旧词收尾（注释/文案 15 处 · 机制零变化）。
用法: DRY=1 python patch_v89223b_misc.py   （预检不落盘）
"""
import io, os, sys

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

DRY = os.environ.get('DRY') == '1'

ITEMS = [
    ('js/data.js', '[攻]弓箭兵前进454', '[攻]弩手前进454', '战报示例 弓箭兵→弩手'),
    ('js/data.js', '民兵→枪→盾→弓→摩托游骑→', '民兵→长矛手→盾卫→弩手→摩托游骑→', '野地构兵递进注释（随 ab 换代同步）'),
    ('js/data.js', '③ 史书纪事（记账式 · 非事件选项）', '③ 史书纪事（⛔ v89.218 已整条退役 · 下文为沿革留档）', '史书纪事块头改退役标注'),
    ('js/icons.js', '/* 战象 */', '/* 变异巨兽 */', 'icons 巨兽图标注释'),
    ('js/questdata.js', "title: '弓弩扩充'", "title: '弩手扩充'", '任务 r02 标题'),
    ('js/questdata.js', '补足弓手，方能制敌', '补足弩手，方能制敌', '任务 r02 文案'),
    ('js/questdata.js', "title: '弓弩之利'", "title: '强弩之利'", '任务 g20 标题'),
    ('js/questdata.js', '强弓劲弩，可制敌于百步之外。', '强弩利矢，可制敌于百步之外。', '任务 g20 文案'),
    ('js/state.js', '/* 10) 历法天时推进 + 史册记账 + 年号纪元（story.js） */',
     '/* 10) 历法天时推进 + 年号纪元（story.js；史册记账随 v89.218 退役） */', '主循环第 10 步注释'),
    ('index.html', '④ 记录：史册 / 公文', '④ 记录：公文', '导航分组注释'),
    ('index.html', '/* 深金分隔线（史册条目左缘） */', '/* 深金分隔线（作战指示徽章描边） */', 'gold-line 令牌说明'),
    ('js/tactic.js', '（弓 220 + 装备 8000 = ×37）', '（弩手 220 + 装备 8000 = ×37）', 'v89.96 并链说明'),
    ('js/tactic.js', '（射程 ≥ 500 的弓/弩/投）', '（射程 ≥ 500）', '射程衰减适用范围'),
    ('js/tactic.js', '（v89.149「弓打弓」）', '（v89.149「弩打弩」）', '同兵种目标轮次引注'),
    ('js/domain.js', '（搬运工 2 / 枪盾 4 / 弓 5 / 摩托游骑 6 / 装甲战车 9 /',
     '（搬运工 2 / 长矛手·盾卫 4 / 弩手 5 / 摩托游骑 6 / 装甲战车 9 /', '采集效率注释'),
    ('js/main.js', "GAME.VERSION = 'v89.222';", "GAME.VERSION = 'v89.223';", '版本号'),
]

ok = 0
for f, old, new, tag in ITEMS:
    s = rd(f)
    if old not in s:
        if new in s:
            print('[skip] %s（已落）' % tag)
            ok += 1
            continue
        raise AssertionError('[%s] 锚点缺失: %s' % (tag, old[:40]))
    c = s.count(old)
    assert c == 1, '[%s] count=%d（应为 1）' % (tag, c)
    s = s.replace(old, new)
    if not DRY:
        wr(f, s)
    print('[ok] %-34s %s' % (tag, f))
    ok += 1
print(('DRY 预检完成' if DRY else '已落盘') + '（%d/%d 处）' % (ok, len(ITEMS)))
