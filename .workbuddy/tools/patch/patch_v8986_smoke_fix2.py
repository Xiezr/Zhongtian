# -*- coding: utf-8 -*-
"""v89.86 · smoke 三处断言修复（以 .py 文件执行 —— heredoc 会改写反斜杠）"""
import io
import os

SM = r'E:\Deepseekdb\smoke-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(old, new, tag):
    src = read(SM)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        raise SystemExit(1)
    write(SM, src.replace(old, new, 1))
    assert new in read(SM), '落盘回查失败：' + tag
    print('OK  ' + tag)


# ① v89.74 门派断言：P0 零平衡 → P1 已实装（sectBonus 唯一出口 + 兼容判据）
edit(r"""      /* P0 零平衡影响：门派加成不得提前混进战斗/产量公式 */
      && !/sectBonus|sectProd|sectAtk/.test(dmS);""",
     r"""      /* v89.86（老板拍板 · 门派 P1）：被动加成**已实装** —— 原 P0 的"零平衡"判据
         升级为"由 sectBonus 唯一发放 + 无门派时全 0"的向后兼容判据
         （消费点接线与 ×1.08 实测见 §85 门派P1 断言）。 */
      && /GAME\.sectBonus = function/.test(dmS) && /GAME\.sectTraitText = function/.test(dmS);""",
     'v89.74 断言升级')

# ② 两条"全境口径"断言：只认旧 marchesHTML 的过滤串（避免误伤 ui.js 另一处同形统计）
edit(r"""&& !/m\.cityId === c\.id/.test(uS31));""",
     r"""&& !/return !c \|\| m\.cityId === c\.id/.test(uS31));""",
     'uS31 全境口径')

edit(r"""&& !/m\.cityId === c\.id/.test(ui8) && ui8.indexOf('⚔ 军务总览') >= 0);""",
     r"""&& !/return !c \|\| m\.cityId === c\.id/.test(ui8) && ui8.indexOf('⚔ 军务总览') >= 0);""",
     'ui8 全境口径')

print('DONE')
