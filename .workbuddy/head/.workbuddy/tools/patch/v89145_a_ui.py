# -*- coding: utf-8 -*-
"""v89.145 老板 2 条 —— ui.js 补丁（分段落盘 · 幂等守卫）
   ① 商城：shop-fill **恒定挂**（不足 4 行也撑满）；购买数量去掉「最多」（noMax）
   ② 背包页挂 .bag-page（满高 flex 列 → 分类/排序行冻结、.bag-body 内部滚动）
"""
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

def save(tag):
    assert '\r\n' not in s, '行尾被写成 CRLF'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('  [saved] ' + tag + '  len=' + str(len(s)))

def rep(old, new, tag, done_when=None, count=1):
    global s
    if done_when and done_when in s:
        print('  [skip]  ' + tag + '（已落）')
        return
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('  [ok]    ' + tag)

# ---------- ① 商城 shop-fill 恒定挂 ----------
rep(
"""    /* v89.143（老板 2）：满页（16 件 = 4 行 × 4 列）时给物品区挂 `shop-fill` ——
       行高从"写死 116px"改成**按可视区平分铺满**（CSS 见 .ui-page.shop-page 段）；
       不满 4 行时不拉伸（内容本来就不够，硬拉只会把两张卡撑成巨型）。 */
    var fullRows143 = slice.length >= per;
""",
"""    /* v89.145（老板 1）：「不足 4 行时仍会下方留白 —— 要不要无论如何都撑满？」→ **撑满**。
       `shop-fill` 从"满页才挂"改成**恒定挂**：3 行 / 2 行 / 1 行的分类同样铺满可视区
       （行高按行数平分；窗口矮到 <116px/行 时物品区内部滚动，见 CSS）。
       v89.143 的"不满不硬拉"是旧口径 —— 本轮按老板拍板整条改掉。 */
""",
    '①-1 shop-fill 恒定挂（注释+变量）',
    done_when='v89.145（老板 1）：「不足 4 行时仍会下方留白')

rep(
"""      (rows ? '<div class="shop-rows' + (fullRows143 ? ' shop-fill' : '') + '">' + rows + '</div>'""",
"""      (rows ? '<div class="shop-rows shop-fill">' + rows + '</div>'""",
    '①-2 渲染恒挂 shop-fill',
    done_when="'<div class=\"shop-rows shop-fill\">' + rows")

# ---------- ① 商城购买数量去掉「最多」 ----------
rep(
"""        qtyHtml: ui.qtyInput(inputId, 1, price, cap),""",
"""        /* v89.145（老板 1）：「购买数量那里不要**最多**这个功能 —— 总不能那点金币
           全买了同一件商品，日子还过不过了」。第 5 参 noMax=true → 不渲染「最多」键；
           −/＋ 与直接键入都在（数量上限 data-cap 仍守着 qtySync 的越界钳制）。 */
        qtyHtml: ui.qtyInput(inputId, 1, price, cap, true),""",
    '①-3 商城数量行去「最多」',
    done_when='qtyInput(inputId, 1, price, cap, true)')

# ---------- ② 背包页挂 bag-page ----------
rep(
"""    html += '</div>';
    return '<div class="ui-page">' +
      '<div class="gold-heading">🎒 背包 · ' + (t === 'treasure' ? '宝物' : '装备') +""",
"""    html += '</div>';
    /* v89.145（老板 2）：背包页改**.bag-page**（满高 flex 列）——
       顶部（标题 / 页签 / 分类条 / 排序条）冻结不动，只有 `.bag-body`（底下细分物品区）
       内部滚动；不再是 .view-box 整页滚。 */
    return '<div class="ui-page bag-page">' +
      '<div class="gold-heading">🎒 背包 · ' + (t === 'treasure' ? '宝物' : '装备') +""",
    '②-1 背包页 bag-page',
    done_when='class="ui-page bag-page"')

save('ui.js 全部')
print('\nALL OK · len ' + str(orig_len) + ' -> ' + str(len(s)))
