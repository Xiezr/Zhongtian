# -*- coding: utf-8 -*-
"""v90.80 奇遇系统退役 · 脚本 B：js/data.js + js/map.js + js/main.js
用法：python .workbuddy/tools/patch/patch_v9080b_data_map_main.py [--apply]
"""
import io, re, sys

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def brace_ok(s, tag):
    code = re.sub(r'/\*[\s\S]*?\*/', '', s)
    code = re.sub(r'(^|[^:\\])//[^\n]*', r'\1', code)
    code = re.sub(r"'(?:[^'\\]|\\.)*'", "''", code)
    code = re.sub(r'"(?:[^"\\]|\\.)*"', '""', code)
    assert code.count('{') == code.count('}'), tag + ' brace %d/%d' % (code.count('{'), code.count('}'))

apply = '--apply' in sys.argv
logs = []
buffers = []   # (path, content) —— 全部段落检毕后统一写盘（原子化）

# ---------------- data.js ----------------
P1 = 'js/data.js'
MARK1 = 'v90.80（老板「去除奇遇系统」）：v89.6「奇遇 · 见闻录」数据整族退役'
s1 = rd(P1)
if MARK1 in s1:
    logs.append('[skip] data.js 已落盘')
else:
    i0 = s1.index(' * v89.6（老板：「没有达到我想要的探索性和趣味性。赛博许愿术，发动！」）：')
    i = s1.rindex('/* =====', 0, i0)
    j0 = s1.index(' * v89 · 全屏荒野场景剧本（老板：「专属全屏交互 + 特定退出」）')
    j = s1.rindex('/* =====', 0, j0)
    seg = s1[i:j]
    assert 'DATA.WONDER = {' in seg and 'DATA.WONDERS = {' in seg and 'w_xinghe' in seg
    assert 'SCENE_FLOW' not in seg and len(seg) < 60000, 'data seg'
    TOMB1 = ('/* ⛔ ' + MARK1 + ' ——\n'
             '   DATA.WONDER（三带密度 / 探奇消耗 / 三档奖励 / 出口文案）与 DATA.WONDERS（24 条三档剧本）一并清除。\n'
             '   引擎 / UI / 地图 / main 动作 / 测试同步退役（见 smoke §80 零残留守卫）。 */')
    s1 = s1[:i] + TOMB1 + '\n\n' + s1[j:]
    brace_ok(s1, 'data')
    assert 'DATA.WONDER =' not in s1 and 'DATA.WONDERS =' not in s1
    logs.append('[ok] data.js 数据块（%d 字符）' % len(seg))
    buffers.append((P1, s1))

# ---------------- map.js ----------------
P2 = 'js/map.js'
MARK2 = 'v90.80（老板「去除奇遇系统」）：奇缘星'
s2 = rd(P2)
if MARK2 in s2:
    logs.append('[skip] map.js 已落盘')
else:
    i0 = s2.index(' * v89.6（老板：「探索性和趣味性」）：奇缘星')
    i = s2.rindex('/* =====', 0, i0)
    j0 = s2.index(' * 正方形俯视网格渲染（v20）')
    j = s2.rindex('/* =====', 0, j0)
    seg2 = s2[i:j]
    assert 'function drawWonderStar' in seg2 and 'polyFill(ctx' in seg2
    TOMB2 = '/* ⛔ ' + MARK2 + '（drawWonderStar）随奇遇系统整条退役（悬星调用同步清）。 */'
    s2 = s2[:i] + TOMB2 + '\n\n  ' + s2[j:]
    old2 = ('        var wd6 = GAME.wonderSiteOf ? GAME.wonderSiteOf(d.gx, d.gy) : null;\n'
            '        if (wd6 && wd6.revealed && !wd6.done) drawWonderStar(ctx, cx, cy - 12);\n')
    c = s2.count(old2)
    assert c == 1, 'map call count=' + str(c)
    s2 = s2.replace(old2, '')
    brace_ok(s2, 'map')
    assert 'function drawWonderStar' not in s2 and 'GAME.wonderSiteOf' not in s2
    logs.append('[ok] map.js 悬星（%d 字符）+ 调用点' % len(seg2))
    buffers.append((P2, s2))

# ---------------- main.js ----------------
P3 = 'js/main.js'
MARK3 = 'v90.80（老板「去除奇遇系统」）：case do-wonder / open-journal / journal-go'
s3 = rd(P3)
if MARK3 in s3:
    logs.append('[skip] main.js 已落盘')
else:
    # B4a: v89.6 注释 + 两 case（到 open-journal break 行）
    i0 = s3.index('/* v89.6：奇遇 · 见闻录 */')
    i = s3.rindex('\n', 0, i0) + 1
    j0 = s3.index("case 'open-journal': ui.openJournal(); break;")
    j = s3.index('\n', j0) + 1
    segA = s3[i:j]
    assert "case 'do-wonder'" in segA and "case 'open-journal'" in segA
    ind = segA[:len(segA) - len(segA.lstrip(' '))]
    s3 = s3[:i] + ind + '/* ⛔ ' + MARK3 + '\n' + ind + '   随「奇遇 · 见闻录」整条退役（见 smoke §80 退役记录）。 */\n' + s3[j:]
    # B4b: mat-go 注释里的 journal-go 措辞
    oldB = '（照 journal-go 时序）'
    c = s3.count(oldB)
    assert c == 1, 'main matgo comment count=' + str(c)
    s3 = s3.replace(oldB, '（时序沿用地图定位惯例）')
    # B4c: journal-go 整条 case
    i0 = s3.index("case 'journal-go':")
    i = s3.rindex('\n', 0, i0) + 1
    j0 = s3.index('点该格探奇')
    j = s3.index('\n', 0, s3.index('break;', j0)) + 1
    segC = s3[i:j]
    assert "case 'journal-go':" in segC and '点该格探奇' in segC and 'break;' in segC
    s3 = s3[:i] + s3[j:]
    # B5: 2136 注释
    oldB5 = '；时序照 journal-go'
    c = s3.count(oldB5)
    assert c == 1, 'main 2136 count=' + str(c)
    s3 = s3.replace(oldB5, '；时序沿用既有地图定位惯例')
    brace_ok(s3, 'main')
    for f in ["case 'do-wonder'", "case 'open-journal'", "case 'journal-go'"]:
        assert f not in s3, 'main leftover ' + f
    logs.append('[ok] main.js 三 case + 两注释')
    buffers.append((P3, s3))

print('\n'.join(logs))
if not apply:
    print('DRY-RUN OK（未写盘）。确认后加 --apply。')
else:
    for p, content in buffers:
        wr(p, content)
        print('written: ' + p)
    print('APPLIED.')
