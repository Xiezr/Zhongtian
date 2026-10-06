# -*- coding: utf-8 -*-
"""v89.204 批次 F3：state.js —— 税收按城级民心（结算 + 分解两处同源）"""
import io

P = 'E:/Deepseekdb/js/state.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, old, new, mark):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == 1, tag + ' count=' + str(c)
    wr(P, s.replace(old, new))
    print('[ok] ' + tag)

rep('F3a 税收结算',
    """    var taxGold = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (1 + GAME.cityBonusNum(city, 'taxPct') + mbTax162)""",
    """    /* v89.204（老板 1）：税收按**城级民心**（含战争创伤 —— 民心受创的城，税收同步走低） */
    var taxGold = popCap * (GAME.cityHeartsOf ? GAME.cityHeartsOf(city) : (s.hearts || 100)) / 100
      * (s.tax || 0) * (1 + GAME.cityBonusNum(city, 'taxPct') + mbTax162)""",
    '税收按**城级民心**')

rep('F3b 分解逐城',
    """        var b1 = pop1 * (s.hearts || 100) / 100 * (s.tax || 0) * (DATA.GOLD_GATE.tax || 1);""",
    """        /* v89.204：与 cityProdPerSec 同源 —— 逐城各按城级民心（战争创伤计入） */
        var b1 = pop1 * (GAME.cityHeartsOf ? GAME.cityHeartsOf(ct) : (s.hearts || 100)) / 100
          * (s.tax || 0) * (DATA.GOLD_GATE.tax || 1);""",
    '与 cityProdPerSec 同源 —— 逐城各按城级民心')

rep('F3c 分解行文案',
    """      rows.push({ name: '税收（人口' + U.numText(_popC162, 0) + '×民心' + Math.round(s.hearts || 100) + '%×税率' + Math.round((s.tax || 0) * 100) + '%）', val: _taxBase162 / 3600 * ts });""",
    """      /* v89.204：民心逐城各按城级值（战争创伤计入），汇总行不再显示单值 */
      rows.push({ name: '税收（人口' + U.numText(_popC162, 0) + '×民心×税率' + Math.round((s.tax || 0) * 100) + '%）', val: _taxBase162 / 3600 * ts });""",
    '汇总行不再显示单值')

print('patch F3 done')
