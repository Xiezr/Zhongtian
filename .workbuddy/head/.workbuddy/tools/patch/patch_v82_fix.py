# -*- coding: utf-8 -*-
"""v82 · 修复补丁：extraLand 退役（防 audit 零引用）+ 两处重复语句收编。

v82 主补丁撤掉「附属野地 / 城外空地」两行显示后，data.js 的 extraLand
成了零引用字段（gate 的「四项计数非全 0」会拒绝提交）——它是
`12 + (lv-1)*3` 的老口径副本，真机制走 DATA.EXT_CAP_BY_LV，直接退役。
顺手：battle.js / ui.js 各有一处**同段重复的语句**（v67 基线快照带来的），
与本轮 state.js 的「顺手去重复行」同类，一并收编。
"""
import io
import sys

DATA = r'E:\Deepseekdb\js\data.js'
BAT = r'E:\Deepseekdb\js\battle.js'
UI = r'E:\Deepseekdb\js\ui.js'
HTML = r'E:\Deepseekdb\index.html'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new and new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== A. data.js ==')
# A1 · extraLand 退役（v82：显示撤除后零引用；机制走 EXT_CAP_BY_LV）
patch(
    DATA,
    """      buildCost: null, maxLevel: 12, prod: null, // 初始自带 Lv1
      levelCost: costTable(GUANFU),
      extraLand: function (lv) { return 12 + (lv - 1) * 3; },
    },""",
    """      buildCost: null, maxLevel: 12, prod: null, // 初始自带 Lv1
      levelCost: costTable(GUANFU),
      /* v82（老板）：「不需要显示附属野地/城外空地及其数量」——
         原「城外空地」数值副本（12 + (lv-1)×3 的老口径）随显示撤除退役；
         真实机制唯一出口 = DATA.EXT_CAP_BY_LV + GAME.extCap。 */
    },""",
    'A1 extraLand 退役',
)

print()
print('== B. battle.js ==')
# B1 · repUnread 重复行（v67 基线带来的：每份战报 +2 → +1）
patch(
    BAT,
    """    s.repUnread = (s.repUnread || 0) + 1;
    /* v41（需求 4）：新战报 → 未读 +1，公文菜单图标开始闪黄（进公文页清零） */
    s.repUnread = (s.repUnread || 0) + 1;
    return {""",
    """    s.repUnread = (s.repUnread || 0) + 1;   /* v82：收编同段重复行（原先每份战报 +2） */
    return {""",
    'B1 repUnread 重复行',
)

print()
print('== C. index.html / ui.js ==')
# C0 · 官府面板的「原名」标注退役后，.cs-orig 样式成死代码 —— 一并撤除
patch(
    HTML,
    """  /* 原名标注：名城改名后仍要能看出它本来是谁（州治/战报都按原名对齐） */
  .cs-orig { color: var(--text-dim); font-size: var(--fs-cap); margin-left: 5px; }
""",
    """  /* v82（老板）：「不需要显示原名 新城池」——官府面板的原名标注退役，
     对应样式随之撤除（域层 origName 照记：州治判定/战报仍按它对号）。 */
""",
    'C0 cs-orig 样式退役',
)

# C1 · setView 里「进公文页清零」重复块（保留第一份）
patch(
    UI,
    """    if (v === 'reports' && GAME.state && GAME.state.repUnread) {
      GAME.state.repUnread = 0;
      ui.syncBadges();
    }
    /* v41（需求 4）：进公文页即视为「已读」—— 闪黄提醒的寿命到玩家看一眼为止。
       清零后立刻同步一次徽标，否则要等主循环下一拍才灭（体感像"点了没反应"）。 */
    if (v === 'reports' && GAME.state && GAME.state.repUnread) {
      GAME.state.repUnread = 0;
      ui.syncBadges();
    }""",
    """    /* v41（需求 4）：进公文页即视为「已读」—— 闪黄提醒的寿命到玩家看一眼为止。
       清零后立刻同步一次徽标，否则要等主循环下一拍才灭（体感像"点了没反应"）。
       v82：收编同段重复块（v67 基线带来的逐字双份）。 */
    if (v === 'reports' && GAME.state && GAME.state.repUnread) {
      GAME.state.repUnread = 0;
      ui.syncBadges();
    }""",
    'C1 setView 重复块',
)

print()
print('完成。')
