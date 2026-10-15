# -*- coding: utf-8 -*-
"""v90.80 奇遇系统退役 · 脚本 C：js/ui.js
用法：python .workbuddy/tools/patch/patch_v9080c_ui.py [--apply]
"""
import io, re, sys

P = 'js/ui.js'
MARK = 'v90.80'


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


def drop_line(s, text):
    i0 = s.index(text)
    i = s.rindex('\n', 0, i0) + 1
    j = s.index('\n', i0) + 1
    seg = s[i:j]
    assert text in seg, 'drop_line'
    return s[:i] + s[j:], seg


def main():
    apply = '--apply' in sys.argv
    s = rd(P)
    s0 = s
    if 'ui.doWonder（探奇）随奇遇系统整条退役' in s:
        print('[skip] 已落盘')
        return 0
    logs = []

    # C1: 音频 SPEC 的 wonder 音色（死键，全仓无调用）
    c1a = "      wonder:  [[784, 0.08, 'triangle'], [988, 0.08, 'triangle'], [1174, 0.14, 'triangle']],\n"
    c1b = "      wonder: [[784, 0.08, 'triangle'], [988, 0.08, 'triangle'], [1174, 0.14, 'triangle']],\n"
    hit = c1a if c1a in s else (c1b if c1b in s else None)
    assert hit, 'C1 anchor'
    s, seg1 = drop_line(s, hit)
    logs.append('[ok] C1 音频 SPEC.wonder')

    # C2: 野地弹窗探奇入口块
    i0 = s.index('/* v89.6：奇遇入口 —— 已现形才露面')
    i = s.rindex('\n', 0, i0) + 1
    j0 = s.index('if (res) {', i0)
    j = s.rindex('\n', 0, j0) + 1
    seg2 = s[i:j]
    assert 'wonderSiteOf' in seg2 and 'wnr-btn' in seg2 and 'if (res)' not in seg2
    ind = seg2[:len(seg2) - len(seg2.lstrip(' '))]
    s = s[:i] + ind + '/* ⛔ v90.80（老板「去除奇遇系统」）：探奇入口整条退役（奇遇 · 见闻录 · 见 smoke §80 退役记录）。 */\n' + s[j:]
    logs.append('[ok] C2 探奇入口块（%d 字符）' % len(seg2))

    # C3: ui.doWonder
    i0 = s.index('/* v89.6：探奇 —— 已现形点位')
    i = s.rindex('\n', 0, i0) + 1
    j0 = s.index('ui.openSceneFx = function (fx)')
    j = s.rindex('\n', 0, j0) + 1
    seg3 = s[i:j]
    assert 'ui.doWonder = function' in seg3 and 'wonderStart' in seg3 and 'ui.openSceneFx = function' not in seg3
    ind = seg3[:len(seg3) - len(seg3.lstrip(' '))]
    s = s[:i] + ind + '/* ⛔ v90.80：ui.doWonder（探奇）随奇遇系统整条退役。 */\n' + s[j:]
    logs.append('[ok] C3 ui.doWonder')

    # C4: SXF_KIND 去 wonder 项
    old4 = ("  ui.SXF_KIND = { fight: '征伐', trial: '试炼', gather: '采集', cultivate: '静修', "
            "visit: '拜访', scene: '探索', wonder: '奇遇' };")
    c = s.count(old4)
    assert c == 1, 'C4 count=' + str(c)
    s = s.replace(old4, old4.replace(", wonder: '奇遇'", ''))
    logs.append('[ok] C4 SXF_KIND')

    # C5: 奇遇横幅「奇缘紫」分支
    i0 = s.index('/* v89.6：奇遇横幅改「奇缘紫」底纹')
    i = s.rindex('\n', 0, i0) + 1
    j0 = s.index('/* 天时（story 缺席时静默省略） */')
    j = s.rindex('\n', 0, j0) + 1
    seg5 = s[i:j]
    assert "fx.kind === 'wonder'" in seg5 and '--wonder-rgb' in seg5
    ind = seg5[:len(seg5) - len(seg5.lstrip(' '))]
    s = s[:i] + ind + '/* ⛔ v90.80：奇遇横幅「奇缘紫」底纹随奇遇系统退役。 */\n' + s[j:]
    logs.append('[ok] C5 横幅分支')

    # C6: 见闻录段（openJournal + journalHTML）
    i0 = s.index(' * v89.6（老板：「探索性和趣味性」）：见闻录 —— 奇遇图鉴')
    i = s.rindex('/* =====', 0, i0)
    j0 = s.index(' * v89.154（老板 3）：附属野地**显示排序**（唯一出口）')
    j = s.rindex('/* =====', 0, j0)
    seg6 = s[i:j]
    assert 'ui.openJournal = function' in seg6 and 'ui.journalHTML = function' in seg6 and '已录见闻' in seg6
    trailing = seg6[len(seg6.rstrip()):]
    assert trailing.startswith('\n\n'), 'C6 trailing=' + repr(trailing)
    s = s[:i] + '/* ⛔ v90.80（老板「去除奇遇系统」）：见闻录面板（ui.openJournal / ui.journalHTML）随奇遇系统整条退役。 */' + trailing + s[j:]
    logs.append('[ok] C6 见闻录段（%d 字符）' % len(seg6))

    # C7: 结算屏线索行（唯一生产者已删）
    s, seg7 = drop_line(s, "if (res.clue) h += '<div class=\"sxf-clue\">'")
    logs.append('[ok] C7 线索行')

    # C8: 底栏「见闻录」按钮
    s, seg8 = drop_line(s, 'data-action="open-journal">📜 见闻录</button>')
    logs.append('[ok] C8 底栏入口')

    # C9: 就近探察块
    i0 = s.index('/* v89.6：就近探察')
    i = s.rindex('\n', 0, i0) + 1
    j0 = s.index('    var lv = (GAME.map._wildLvOverride != null) ? GAME.map._wildLvOverride', i0)
    j = j0
    seg9 = s[i:j]
    assert 'wonderSurvey' in seg9 and 'wnr-line' in seg9
    ind = seg9[:len(seg9) - len(seg9.lstrip(' '))]
    s = s[:i] + ind + '/* ⛔ v90.80：就近探察（奇遇点位现形）随奇遇系统退役。 */\n' + s[j:]
    logs.append('[ok] C9 就近探察')

    # C10: 两处 wsurvLine 注入点
    c = s.count('wsurvLine + ')
    assert c == 2, 'C10 count=' + str(c)
    s = s.replace('wsurvLine + ', '')
    logs.append('[ok] C10 注入点 ×2')

    # C11: 材料产地注释里的 journal-go 措辞
    oldC11 = '，照 journal-go 时序）'
    c = s.count(oldC11)
    assert c == 1, 'C11 count=' + str(c)
    s = s.replace(oldC11, '，时序沿用地图定位惯例）')
    logs.append('[ok] C11 注释措辞')

    # 自检
    for f in ['wonderSiteOf', 'wonderSurvey', 'wonderStart', 'wonderCheck', 'wonderSpend',
              'do-wonder', 'open-journal', 'journal-go', 'wnr-', '--wonder', 'sxf-clue',
              'ui.doWonder = function', 'ui.openJournal = function', 'ui.journalHTML = function']:
        assert f not in s, 'leftover ' + f
    # 花括号差值法（剥注释 + 剥字符串；ui.js 含正则字面量，剥器有已知偏差 → 只验"删的 { 与 } 数相等"）
    def _braces(x):
        c = re.sub(r'/\*[\s\S]*?\*/', '', x)
        c = re.sub(r'(^|[^:\\])//[^\n]*', r'\1', c)
        c = re.sub(r"'(?:[^'\\]|\\.)*'", "''", c)
        c = re.sub(r'"(?:[^"\\]|\\.)*"', '""', c)
        return c.count('{'), c.count('}')
    bo, bc = _braces(s0)
    ao2, ac2 = _braces(s)
    assert (bo - ao2) == (bc - ac2), 'brace delta %d/%d' % (bo - ao2, bc - ac2)

    if not apply:
        print('\n'.join(logs))
        print('DRY-RUN OK（未写盘）。确认后加 --apply。')
        return 0
    wr(P, s)
    print('\n'.join(logs))
    print('APPLIED. lines=%d' % (rd(P).count('\n') + 1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
