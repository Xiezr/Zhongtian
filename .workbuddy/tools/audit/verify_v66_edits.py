# -*- coding: utf-8 -*-
"""v66 改动落盘核验（第二版：正/反向分开写，标记与真实源码一致）。
⚠️ 教训：同一条消息里对同一文件的多次 Edit 会互相覆盖（后写覆盖前写），
且 Bash 的 grep 输出在本机有缓存 → 只认这个脚本的结果。
"""
import io, os

ROOT = r'E:\Deepseekdb'

MUST = [   # 必须出现
    ('js/data.js',   "w: 2.5, wg: 0.09",                    '客栈 英杰 ÷6'),
    ('js/data.js',   "w: 0.75, wg: 0.17",                   '客栈 名世 ÷8'),
    ('js/data.js',   "w: 0.2, wg: 0.28",                    '客栈 天授 ÷10'),
    ('js/data.js',   "sta: 600",                            '装备体力字段 sta'),
    ('js/state.js',  "Math.max(r.w * 0.05",                 '权重下限按比例'),
    ('js/state.js',  "var mx = GAME.staBaseMax(g);",        '离线恢复夹 base'),
    ('js/state.js',  "else g.stamina = Math.min(g.stamina, GAME.staBaseMax(g));", '读档夹回余量'),
    ('js/state.js',  "var staMx = GAME.staBaseMax(g);",     '在线恢复夹 base'),
    ('js/systems.js', "b.sta += (item.sta || 0) * mul;",    '装备体力并入 b.sta'),
    ('js/systems.js', "(it.sta || 0) * 0.2",                '装备评分用 sta'),
    ('js/systems.js', "var blk = GAME.expBlockOf ? GAME.expBlockOf(g3) : '';", 'useItem 经验拦截'),
    ('js/systems.js', "var staNow0 = GAME.staNow(g4);",     '止血散池子口径'),
    ('js/systems.js', "GAME.setStaNow(g4, staNow0 + healed);", '止血散写回'),
    ('js/systems.js', "var blk = GAME.expBlockOf ? GAME.expBlockOf(g) : '';", '批量经验拦截'),
    ('js/domain.js', "GAME.staBaseMax = function",          'staBaseMax'),
    ('js/domain.js', "GAME.staEquipOf = function",          'staEquipOf'),
    ('js/domain.js', "GAME.setStaNow = function",           'setStaNow'),
    ('js/domain.js', "GAME.staHpPct = function",            'staHpPct'),
    ('js/domain.js', "GAME.expBlockOf = function",          'expBlockOf'),
    ('js/domain.js', "staEq: Math.round(b.sta || 0),",      'genAttrs staEq'),
    ('js/battle.js', "return 1 + (GAME.staHpBonus ? GAME.staHpBonus(gen) : 0);", 'hpMultOf 单链'),
    ('js/battle.js', "if (GAME.staNow(gen) < mode.stamina) {", 'prepare 门槛池子口径'),
    ('js/battle.js', "GAME.setStaNow(gen, GAME.staNow(gen) - mode.stamina);", '出征/侦查扣体力'),
    ('js/ui.js',     "['staEq', '体力']];",                 '装备提供清单 体力行'),
    ('js/ui.js',     "(a[d.val || d.k] || 0)",              '六维取值键'),
    ('js/ui.js',     "'　体 ' + a.staMax +",                '列表悬停 总体体力'),
    ('js/ui.js',     "数学占位",                             '占位（不会命中，见下）'),
    ('js/ui.js',     "var staEqNow = a.staEq || 0;",        '状态行装备体力'),
    ('js/ui.js',     "U.numText(staMx, 0) + '</b>'",        '状态行主数字=上限'),
    ('js/ui.js',     "+ Math.round(bonus.sta || 0) +",      '装备汇总 体力'),
    ('js/ui.js',     "GAME.staHpPct(aEq.staMax) - GAME.staHpPct(aBare.staMax)", '装备→全军生命增量'),
    ('js/ui.js',     "if (item.sta) parts.push('体+' + item.sta);", '装备描述文案'),
    ('js/ui.js',     "var blk = GAME.expBlockOf(g);",       '经验面板拦截'),
    ('js/ui.js',     "atCap ? 'dim' : 'gold'",              '＋按钮变暗'),
    ('js/ui.js',     "val: 'staMax'",                       '六维体力取值键'),
]
MUST_NOT = [   # 不许再出现（两个出口 / 旧写法）
    ('js/systems.js', "b.hp += (item.hp",                   '装备加成不该再有 hp'),
    ('js/domain.js',  "hp: Math.round((g.hp || 100) + b.hp),", 'genAttrs 不该再有 hp'),
    ('js/battle.js',  "genEquipBonus(gen).hp",              'battle 不该再读装备 hp 折算生命'),
    ('js/battle.js',  "gen.stamina = Math.max(0, (gen.stamina || 0) - mode.stamina);", '出征不该直接改 g.stamina'),
    ('js/domain.js',  "gen.stamina = Math.max(0, (gen.stamina || 0) - G.stamina);", '采集不该直接改 g.stamina'),
    ('js/systems.js', "g4.stamina = Math.min(staMx,",       '止血散不该再直接改 g.stamina'),
    ('js/ui.js',      "Math.round(g.stamina || 0)",         'ui 不该直读 g.stamina'),
    ('js/ui.js',      "Math.round(g.stamina)",              'ui 不该直读 g.stamina（无 ||0 形态）'),
]

bad = 0
for f, mark, desc in MUST:
    if desc.startswith('占位'):
        continue
    src = io.open(os.path.join(ROOT, f), 'r', encoding='utf-8', newline='').read()
    if mark in src:
        print('OK    %-18s %s' % (f, desc))
    else:
        bad += 1
        print('MISS  %-18s %s' % (f, desc))

print('')
for f, mark, desc in MUST_NOT:
    src = io.open(os.path.join(ROOT, f), 'r', encoding='utf-8', newline='').read()
    if mark in src:
        bad += 1
        print('STILL %-18s %s' % (f, desc))
    else:
        print('OK    %-18s %s（已无）' % (f, desc))

print('')
print('未达标：%d 条' % bad)
