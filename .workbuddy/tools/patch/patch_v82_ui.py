# -*- coding: utf-8 -*-
"""v82 · UI 层：官府面板重做（去征收 / 城名居中）/ 君主面板去档位文字 / 建筑弹窗去野地行 / 改名弹窗去原名。"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'


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
        print('  ✗ %s：锚点命中 %d 次' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


def replace_span(path, start, end_marker, block, done_marker, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if done_marker in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    c = t.count(start)
    if c != 1:
        print('  ✗ %s：起点命中 %d 次' % (tag, c))
        sys.exit(1)
    i = t.find(start)
    j = t.find(end_marker, i + len(start))
    if j < 0:
        print('  ✗ %s：找不到段尾' % tag)
        sys.exit(1)
    t = t[:i] + block + t[j:]
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print('  ✓ %s（整段替换）' % tag)


print('== U1. 官府面板 head 重做 + 征收表退役 ==')
replace_span(
    UI,
    '    var plan = GAME.levyPlan(c);',
    '    /* 需求 5 的正面回答直接写进面板：特产到底怎么收集。',
    """    var isSelf = (c.type || 'self') === 'self';
    var stateName = GAME.stateOfCity(c);            /* 特产 / 州治判定与岁贡同源 */
    var rn = GAME.canRenameCity(c);
    var isMain = GAME.isMainCity(c);

    /* v45（需求 4）：**重命名入口提到身份行旁边**（面板一长就落到折叠线以下，
       老板因此以为"官府根本没有改名功能"）；v79：主城设置按钮随行。
       v82（老板）：「不需要显示"本城"，城市名称居中，字体稍大即可」——
       档位括注（自建城）/「本城」标签 / 原名标注全部撤下，只留居中放大的城名
       （主城徽记保留），操作按钮另起一行居中。 */
    var mainBtn = isMain
      ? ''
      : ' <button class="btn sm" data-action="set-main-city" title="' +
          U.escape('主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
            + (GAME.mainCityOf()
                ? '　（迁都需 ' + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 金）'
                : '　（首设免费）')) +
        '">设为主城</button>';
    var head = '<div class="gold-heading">🏯 官府 · Lv' + lv + '</div>' +
      '<div class="city-title">' + U.escape(c.name) +
        (isMain ? ' <span class="city-tier mt">主城</span>' : '') + '</div>' +
      '<div class="city-sub">' +
        '<button class="btn sm' + (rn.ok ? '' : ' dim') + '" data-action="open-rename-city"' +
        (rn.ok ? '' : ' disabled') + ' title="' +
        U.escape(rn.ok ? '改名会同步到地图 / 侧栏 / 统计 / 战报抬头等所有引用处' : rn.msg) +
        '">✎ 重命名</button>' + mainBtn +
      '</div>';

    /* v82（老板）：「官府不需要征收物质这个功能去除」——
       征收（物资/特产表 + 立即征收按钮 + 冷却同步）整段退役；
       种田秘境入口（v73 原与征收同排）独立成区保留。 */
    var farmBox = '<div class="op-zone"><div class="op-row">' +
      '<button class="btn gold" data-action="open-farm"' +
        ' title="种田秘境：个人田庄灵田种灵植，收高阶打造材料与资质灵草">🌾 种田秘境</button>' +
      '<span class="op-hint">灵田种灵植：打造材料 + 资质灵草</span>' +
      '</div></div>';

""",
    'v82（老板）：「官府不需要征收物质这个功能去除」',
    'U1 官府 head + 征收退役',
)

print()
print('== U2. 特产口改读唯一口径（原 levyPlan）==')
patch(UI,
    '    var sp = plan && plan.specialty;',
    '    var sp = isSelf ? null : GAME.specialtyOf(c);    /* v82：原走 levyPlan，随征收退役改直读 */',
    'U2a sp 取值')
patch(UI,
    """        '<div class="attr"><span class="k">本州归属</span><span class="v">' + (plan.stateName || '—') +
          (GAME.hasStateSeat(plan.stateName) ? '（州治在握）' : '') + '</span></div>' +""",
    """        '<div class="attr"><span class="k">本州归属</span><span class="v">' + (stateName || '—') +
          (GAME.hasStateSeat(stateName) ? '（州治在握）' : '') + '</span></div>' +""",
    'U2b 本州归属')
patch(UI,
    """          ui.help('如何收集本城特产：\\n' +
            '① 州郡岁贡 —— 每现实日自动入府，无需操作\\n' +
            '② 官府征收 —— 上方「立即征收」按钮，冷却 1 游戏小时\\n' +
            '③ 州治加成 —— 握有本州州城时，本州特产产量 ×' + DATA.STATE_SEAT_BONUS +""",
    """          ui.help('如何收集本城特产：\\n' +
            '① 州郡岁贡 —— 每现实日自动入府，无需操作\\n' +
            '② 州治加成 —— 握有本州州城时，本州特产产量 ×' + DATA.STATE_SEAT_BONUS +""",
    'U2c 特产帮助两条')

print()
print('== U3. 面板拼接与注释 ==')
patch(UI,
    """    /* v65：改用 **xl 档**（960×min(700px,88vh)）——
       默认档 660×620 装不下"征收表 + 岁贡 + 特产 + 队列"，实测 1600×950 溢出 57px。 */
    ui.openModal(head + body + yieldBox + spBox + queueBox +""",
    """    /* v65：改用 **xl 档**（960×min(700px,88vh)）—— 默认档装不下面板全集。
       v82：征收表退役后内容更少，但档位不动（960 宽是各面板的既定规格）。 */
    ui.openModal(head + farmBox + yieldBox + spBox + queueBox +""",
    'U3 拼接行')

print()
print('== U4. 征收冷却同步退役 ==')
patch(UI,
    """    /* 征收按钮冷却：弹窗不随主循环整体重绘，靠这里每秒同步一次 */
    var lb = document.getElementById('levy-btn');
    if (lb) {
      var lcd = GAME.levyReady(GAME.currentCity());
      lb.disabled = lcd > 0;
      lb.textContent = lcd > 0 ? ('冷却 ' + U.durExact(lcd / GAME.timeScale())) : '立即征收';
    }
""",
    """    /* v82：征收退役 —— 按钮冷却同步随功能撤除。 */
""",
    'U4 冷却同步退役')

print()
print('== U5. 君主面板去档位文字 ==')
patch(UI,
    """                  '<span class="ls-meta">' + (DATA.CITY_TIER[c2.type] || '自建城') +
                    ' · [' + c2.x + ',' + c2.y + '] · 人口上限 ' + U.fmt(GAME.maxPopOf(c2)) + '</span>' +""",
    """                  /* v82（老板）：「不要显示（自建城）这种文字」—— 档位文字撤下，坐标与人口保留 */
                  '<span class="ls-meta">[' + c2.x + ',' + c2.y + '] · 人口上限 ' + U.fmt(GAME.maxPopOf(c2)) + '</span>' +""",
    'U5a 城池列表去档位')
patch(UI,
    """              ? ('🏯 ' + U.escape(mc.name) + ' <span class="ui-sub">（' + (DATA.CITY_TIER[mc.type] || '自建城') + ' · 驻跸加成中）</span>')""",
    """              ? ('🏯 ' + U.escape(mc.name) + ' <span class="ui-sub">（驻跸加成中）</span>')""",
    'U5b 主城行去档位')

print()
print('== U6. 官府建筑弹窗去野地两行 ==')
patch(UI,
    """      if (b.id === 'guanfu') extra = '<div class="attr"><span class="k">附属野地上限</span><span class="v">' + cell.build.lvl + '</span></div>' +
        '<div class="attr"><span class="k">城外空地</span><span class="v">' + b.extraLand(cell.build.lvl) + '</span></div>';""",
    """      /* v82（老板）：「不需要显示附属野地/城外空地及其数量」—— 官府弹窗这两行退役。 */""",
    'U6 官府弹窗野地行')

print()
print('== U7. 改名弹窗去「原名」 ==')
patch(UI,
    """      sub: '原名：' + U.escape(c.origName || c.name) +
        '（初次改名后原名会一直保留，州治与战报仍按它对号）',""",
    """      sub: '改名会同步到地图 / 侧栏 / 统计 / 战报等所有引用处',""",
    'U7a 城池改名 sub')
patch(UI,
    """      sub: '原名：' + U.escape(s.ruler.name) + '（8 字以内）',""",
    """      sub: '8 字以内 · 改名会同步到所有引用处',""",
    'U7b 君主改名 sub')

print()
print('UI 层完成。')
