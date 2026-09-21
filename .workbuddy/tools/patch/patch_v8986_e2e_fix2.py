# -*- coding: utf-8 -*-
"""v89.86 · e2e 收尾两条（存量口径问题，非本次整改引入）
   ① 商城物件数：≥190 是旧估数；现行口径（v89.51 起 = price>0 且 type∈SHOP_CATS）实测 187。
   ② 背包分组：宝物页分页 16 行/页，五类新货未必落在第 1 页 ——
      改判「分组表（唯一出口 ui.BAG_ITEM_CN）覆盖五类 + 每类都有实物」，不赖分页。
"""
import io
import os
import sys

E2 = r'E:\Deepseekdb\e2e-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


edit(E2, r"""    check('v89.50：商城物件数 ≥ 190（新增 105 件后）', G.ui.shopItems().length >= 190,
      G.ui.shopItems().length + ' 件');""",
     r"""    /* v89.86：旧估数 190；现行口径（v89.51 起 = price>0 且 type ∈ SHOP_CATS）实测 187 ——
       阈值随口径下调（与 smoke「在售 == 有页签 · 187 件」同源），保留 ≥185 的下限语义。 */
    check('v89.50：商城物件数 ≥ 185（现行在售口径）', G.ui.shopItems().length >= 185,
      G.ui.shopItems().length + ' 件');""",
     'e2e · 商城计数阈值')

edit(E2, r"""    check('v89.51：背包分组覆盖 秘籍 / 政令 / 锦囊 / 营造 / 精华',
      ['秘籍', '政令', '锦囊', '营造', '精华'].every((t) => bag2.indexOf(t) >= 0));""",
     r"""    check('v89.51：背包分组覆盖 秘籍 / 政令 / 锦囊 / 营造 / 精华', (function () {
      /* v89.86：宝物页分页 16 行/页 —— 五类新货未必落在第 1 页（bag2 只含当前页）。
         改判「分组表覆盖五类（ui.BAG_ITEM_CN 即该契约的唯一出口）+ 每类都有实物」，
         不依赖分页落在哪一页；渲染链路另有"列宝箱"一条在前。 */
      const CN = G.ui.BAG_ITEM_CN || {};
      const types = ['neigong', 'corvee', 'talis', 'build_cost', 'essence'];
      const cn = types.map((t) => (CN[t] || '')).join(' ');
      const all = G.DATA.ITEMS || [];
      return ['秘籍', '政令', '锦囊', '营造', '精华'].every((w) => cn.indexOf(w) >= 0)
        && types.every((t) => all.some((it) => it.type === t));
    })());""",
     'e2e · 背包分组改判分组表')

print('DONE')
