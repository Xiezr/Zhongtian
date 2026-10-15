# -*- coding: utf-8 -*-
"""v89.204 批次 F2：main.js —— 调税 toast 民心按当前城"""
import io

P = 'E:/Deepseekdb/js/main.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

s = rd(P)
if 'GAME.cityHeartsOf && _ct204' in s:
    print('[skip] F2 调税 toast')
else:
    old = """    ui.toast('税率：' + v + '%　民心 ' + Math.round(GAME.heartsOf()) + ' / 民怨 ' + Math.round(GAME.minyuanOf()));"""
    c = s.count(old)
    assert c == 1, 'F2 count=' + str(c)
    new = """    /* v89.204（老板 1）：民心按**当前城**（含战争创伤）显示 */
    var _ct204 = GAME.currentCity ? GAME.currentCity() : null;
    var _h204 = (GAME.cityHeartsOf && _ct204) ? GAME.cityHeartsOf(_ct204) : GAME.heartsOf();
    ui.toast('税率：' + v + '%　民心 ' + Math.round(_h204) + ' / 民怨 ' + Math.round(100 - _h204));"""
    wr(P, s.replace(old, new))
    print('[ok] F2 调税 toast')

print('patch F2 done')
