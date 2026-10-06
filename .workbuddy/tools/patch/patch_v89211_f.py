# -*- coding: utf-8 -*-
"""v89.211 补丁 F：domain.js GAME.train 域侧防御回落
   指定工位对不上（陈旧/跨类）而本城该级建筑存在 → 回落首座（与界面 resolver 同口径）。"""
import io
R = 'E:/Deepseekdb/'
def rd(p):
    with io.open(R + p, 'r', encoding='utf-8', newline='') as f:
        return f.read()
def wr(p, s):
    with io.open(R + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
def sub1(s, old, new, tag, cnt=1):
    n = s.count(old)
    assert n == cnt, '[%s] anchor count=%d (want %d)' % (tag, n, cnt)
    return s.replace(old, new)

s = rd('js/domain.js')
if '_fb211' in s:
    print('[skip] F1 train 回落已在册')
else:
    old = """    var bLv = kind === 'craft' ? GAME.craftLevel(city, bIdx) : GAME.barracksLevel(city, bIdx);
    if (bLv <= 0) {
      return { ok: false, msg: kind === 'craft'
        ? '本城尚无工匠作坊，无法制造器械（先建工匠作坊）'
        : '本城尚无军营，无法募兵（先建军营）' };
    }"""
    new = """    var bLv = kind === 'craft' ? GAME.craftLevel(city, bIdx) : GAME.barracksLevel(city, bIdx);
    /* v89.211（老板 3）防御回落：指定工位对不上（陈旧/跨类 idx）而本城该级建筑存在时，
       回落首座 —— 与界面解析（ui.trainBarracks）同一口径。否则下面那句
       "本城尚无工匠作坊"就是假报（明明有作坊，只因提交带的是上次点的军营格）。
       真无作坊的城仍走原拒绝（提示与实际情况相符）。 */
    if (bLv <= 0) {
      var _fb211 = kind === 'craft' ? GAME.firstWorkshopIdx(city) : GAME.firstBarracksIdx(city);
      if (_fb211 >= 0 && _fb211 !== bIdx) {
        bIdx = _fb211;
        bLv = kind === 'craft' ? GAME.craftLevel(city, bIdx) : GAME.barracksLevel(city, bIdx);
      }
    }
    if (bLv <= 0) {
      return { ok: false, msg: kind === 'craft'
        ? '本城尚无工匠作坊，无法制造器械（先建工匠作坊）'
        : '本城尚无军营，无法募兵（先建军营）' };
    }"""
    s = sub1(s, old, new, 'F1')
    wr('js/domain.js', s)
    print('[ok] F1 train 回落')

print('DONE')
