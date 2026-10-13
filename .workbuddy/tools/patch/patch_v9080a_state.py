# -*- coding: utf-8 -*-
"""v90.80 奇遇系统退役 · 脚本 A：js/state.js
用法：python .workbuddy/tools/patch/patch_v9080a_state.py [--apply]
安全：原子写（末尾一次写盘）· 段落级幂等守卫 · 写后自检（GAME.* 形态零残留）
"""
import io, sys

P = 'js/state.js'
MARK = 'v90.80（老板「去除奇遇系统」）：v89.6「奇遇 · 见闻录」引擎整条退役'

TOMB3 = ('/* ⛔ ' + MARK + ' ——\n'
         '   wonderState / wonderSites / wonderSiteOf / wonderSurvey / wonderClueRoll / wonderClueText /\n'
         '   _jhClueAttach / wonderCheck / wonderSpend / wonderRoll 共 12 出口全清（数据层 DATA.WONDER/WONDERS 同步清；\n'
         '   UI / 地图悬星 / main 动作 / 测试见各自墓碑与 smoke §80 退役记录）。 */')


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


def main():
    apply = '--apply' in sys.argv
    s = rd(P)

    if MARK in s:
        print('[skip] 已落盘（marker 在册）')
        return 0

    logs = []

    # A1: enterPlanet 清缓存行（注：与 _cntyF 同行，按片段替换）
    old1 = 'GAME.map._wonderSites = null; '
    c = s.count(old1)
    assert c == 1, 'A1 count=' + str(c)
    s = s.replace(old1, '')
    logs.append('[ok] A1 清缓存片段')

    # A2: 注释措辞
    old2 = '旧网格/据点/奇观缓存不刷新'
    c = s.count(old2)
    assert c == 1, 'A2 count=' + str(c)
    s = s.replace(old2, '旧网格/据点缓存不刷新')
    logs.append('[ok] A2 注释措辞')

    # A3: 引擎大块（12 出口）—— 从块注释首到 jianghuDone 行首
    i0 = s.index(' * v89.6（老板：「探索性和趣味性」）：奇遇 · 见闻录')
    i = s.rindex('/* =====', 0, i0)
    j = s.index('  GAME.jianghuDone = function (s, x, y, actId, day) {')
    seg = s[i:j]
    assert 'GAME.wonderState = function' in seg and 'GAME.wonderRoll = function' in seg
    assert 'GAME._jhClueAttach = function' in seg and 'GAME.jianghuDone' not in seg
    assert len(seg) < 40000, 'seg too big'
    s = s[:i] + TOMB3 + '\n\n' + s[j:]
    logs.append('[ok] A3 引擎块（%d 字符）' % len(seg))

    # A4: 三处线索挂接调用 → 直接返回
    for n in range(3):
        k = s.index('return GAME._jhClueAttach(')
        e = s.index(', chk);', k) + len(', chk);')
        seg4 = s[k:e]
        assert seg4.count('GAME._jhClueAttach(') == 1 and seg4.count(', chk);') == 1, 'A4-%d' % n
        new4 = seg4.replace('return GAME._jhClueAttach(', 'return ').replace(', chk);', ';')
        s = s[:k] + new4 + s[e:]
    assert 'GAME._jhClueAttach' not in s, 'A4 leftover'
    logs.append('[ok] A4 线索挂接 ×3')

    # A5: sceneBegin 注释
    old5 = '  /* v89.6：剧本开场内核抽成共用出口 —— 荒野活动与奇遇共用同一套场景机 */'
    c = s.count(old5)
    assert c == 1, 'A5 count=' + str(c)
    s = s.replace(old5, '  /* 剧本开场内核抽成共用出口 —— 荒野活动各幕共用同一套场景机 */')
    logs.append('[ok] A5 场景机注释')

    # A6: wonderStart（探奇开场）整块
    i0 = s.index("  /* 探奇开场：奇遇剧本（kind:'wonder' —— 扣费/结算在 scenePick 里分流） */")
    i = s.rindex('\n', 0, i0) + 1
    j = s.index('  /* 选一幕（首次选择才真正扣费+落锁）；末幕选择即结算 */')
    seg6 = s[i:j]
    assert 'GAME.wonderStart = function' in seg6 and 'sceneBegin' in seg6
    s = s[:i] + '  /* ⛔ v90.80：探奇开场（wonderStart）随奇遇系统整条退役。 */\n' + s[j:]
    logs.append('[ok] A6 wonderStart')

    # A7: scenePick 两处分流
    old7a = "    if (!fx.spent) { (fx.kind === 'wonder') ? GAME.wonderSpend(fx.chk) : GAME.jianghuSpend(fx.chk); fx.spent = true; }"
    c = s.count(old7a)
    assert c == 1, 'A7a count=' + str(c)
    s = s.replace(old7a, '    if (!fx.spent) { GAME.jianghuSpend(fx.chk); fx.spent = true; }')
    old7b = "      fx.result = (fx.kind === 'wonder') ? GAME.wonderRoll(fx.chk, fx.mods) : GAME.jianghuRoll(fx.chk, fx.mods);"
    c = s.count(old7b)
    assert c == 1, 'A7b count=' + str(c)
    s = s.replace(old7b, '      fx.result = GAME.jianghuRoll(fx.chk, fx.mods);')
    logs.append('[ok] A7 scenePick 分流 ×2')

    # 写后自检
    for f in ['GAME.wonderState', 'GAME.wonderSites', 'GAME.wonderSiteOf', 'GAME.wonderSurvey',
              'GAME.wonderClueRoll', 'GAME.wonderClueText', 'GAME.wonderCheck', 'GAME.wonderSpend',
              'GAME.wonderRoll', 'GAME.wonderStart', 'GAME._jhClueAttach',
              'GAME.map._wonderSites', 'GAME.map._wonderMap', 'GAME.map._wonderSeed']:
        assert f not in s, 'leftover ' + f
    # 花括号配平（剥注释 + 剥字符串；粗检，最终以 node --check 为准）
    import re
    code = re.sub(r'/\*[\s\S]*?\*/', '', s)
    code = re.sub(r'(^|[^:\\])//[^\n]*', r'\1', code)
    code = re.sub(r"'(?:[^'\\]|\\.)*'", "''", code)
    code = re.sub(r'"(?:[^"\\]|\\.)*"', '""', code)
    assert code.count('{') == code.count('}'), 'brace imbalance %d/%d' % (code.count('{'), code.count('}'))

    if not apply:
        print('\n'.join(logs))
        print('DRY-RUN OK（未写盘）。确认后加 --apply。')
        return 0

    wr(P, s)
    s2 = rd(P)
    assert MARK in s2 and 'GAME.wonderStart' not in s2
    print('\n'.join(logs))
    print('APPLIED. lines=%d' % (s2.count('\n') + 1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
