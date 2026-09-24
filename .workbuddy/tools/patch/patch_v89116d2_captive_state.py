# -*- coding: utf-8 -*-
"""v89.116 补丁 D2：守城侧的俘虏明细（补 D 里漏掉的两处）"""
import io, os, sys

R = 'E:/Deepseekdb/'
EDITS = [
    ('js/state.js',
     """        var _cap113 = GAME.battle.captiveGain(city, result, { kind: 'defense' }, result.atkLoss || 0);""",
     """        /* v89.116：把敌军（= 攻方）的逐兵种损失表一起传进去（俘虏营按兵种列清单） */
        var _cap113 = GAME.battle.captiveGain(city, result, { kind: 'defense' },
          result.atkLoss || 0, result.atkLossBy);""",
     'state.js 守城侧传明细'),
    ('js/state.js',
     """    if (out.captives && out.captives.gain > 0) {
      lines.push('俘获 ' + U.numText(out.captives.gain, 0) + ' 众（溃卒收编为民）');
    }""",
     """    if (out.captives && out.captives.gain > 0) {
      /* v89.116：按兵种列出来（老板：「不要一个总数量」） */
      var _cp2 = [];
      for (var _ck2 in (out.captives.byType || {})) {
        if (!out.captives.byType[_ck2]) continue;
        _cp2.push((DATA.TROOPS[_ck2] ? DATA.TROOPS[_ck2].name : (_ck2 === 'unknown' ? '来历不明' : _ck2))
          + ' ×' + U.numText(out.captives.byType[_ck2], 0));
      }
      lines.push('俘获 ' + U.numText(out.captives.gain, 0) + ' 众入营'
        + (_cp2.length ? '（' + _cp2.join('、') + '）' : '')
        + '　·　军务处·俘虏营可收编为民');
    }""",
     'state.js 守城战报俘虏明细'),
]


def main():
    p = R + 'js/state.js'
    s = io.open(p, encoding='utf-8').read()
    for _, old, new, tag in EDITS:
        n = s.count(old)
        if n != 1:
            print('!! [%s] 匹配 %d 次 → 中止' % (tag, n))
            return 1
        s = s.replace(old, new, 1)
        print('  ✓ %s' % tag)
    b = io.open(R + '.workbuddy/backup/v89116/state.js', encoding='utf-8').read()
    d0 = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
    if d0 != 0:
        print('!! 花括号净变化 %+d → 中止' % d0)
        return 1
    tmp = p + '.tmp116d2'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, p)
    print('  → 落盘 state.js（净 %+d）' % d0)
    return 0


sys.exit(main())
