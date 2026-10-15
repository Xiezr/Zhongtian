# -*- coding: utf-8 -*-
"""v89.86 补 · P-15 引导链补上"官府压顶"分支（v68 规则：城内建筑 ≤ 官府等级）"""
import io
import os
import sys

UI = r'E:\Deepseekdb\js\ui.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


old = r"""    var slotGuide = '';
    if (cap > 0 && usedIn >= cap) {
      var zxgLv15 = GAME.buildingLevel(city, 'zhaoxianguan') || 0;
      var zxgCap15 = GAME.buildCapOf(city, 'zhaoxianguan');
      slotGuide = (zxgLv15 < zxgCap15)
        ? ('升招贤馆至 Lv' + (zxgLv15 + 1) + ' 可添 1 席')
        : ('招贤馆已至上顶（Lv' + zxgCap15 + '）—— 可把将领派往他城腾位');
    }"""
new = r"""    var slotGuide = '';
    if (cap > 0 && usedIn >= cap) {
      var zxgLv15 = GAME.buildingLevel(city, 'zhaoxianguan') || 0;
      var zxgCap15 = GAME.buildCapOf(city, 'zhaoxianguan');
      var govLv15 = GAME.buildingLevel(city, 'guanfu') || 0;
      var govCap15 = GAME.buildCapOf(city, 'guanfu');
      if (zxgLv15 < zxgCap15) {
        slotGuide = '升招贤馆至 Lv' + (zxgLv15 + 1) + ' 可添 1 席';
      } else if (govLv15 < govCap15) {
        /* v68 规则：城内建筑等级被官府压顶 —— 招贤馆想再升，得官府先升 */
        slotGuide = '先升官府至 Lv' + (govLv15 + 1) + '，再升招贤馆可添 1 席';
      } else {
        slotGuide = '招贤馆已至上顶（Lv' + zxgCap15 + '）—— 可把将领派往他城腾位';
      }
    }"""

src = read(UI)
if old not in src and new in src:
    print('SKIP（已应用）')
    sys.exit(0)
n = src.count(old)
assert n == 1, ('命中 %d 次' % n)
write(UI, src.replace(old, new, 1))
assert new in read(UI)
print('OK  P-15 · 引导链补官府分支')
