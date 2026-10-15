# -*- coding: utf-8 -*-
"""v89.145 老板 2 条 —— index.html CSS 补丁
   ① 商城物品区：撑满 + 内部滚动（分类行冻结）
   ② 背包页：满高 flex 列（顶部冻结）· .bag-body 内部滚动
"""
import io

P = 'E:/Deepseekdb/index.html'
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

# ---------- ① 商城物品区：撑满 + 内部滚动 ----------
rep(
"""  .ui-page.shop-page { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
  .ui-page.shop-page .shop-rows.shop-fill { flex: 1 1 auto; min-height: 0;
    align-content: stretch; grid-auto-rows: minmax(116px, 1fr); }""",
"""  .ui-page.shop-page { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
  /* v89.145（老板 1/2）：① `shop-fill` 现由渲染**恒定挂**（不足 4 行也撑满 —— 行高按行数平分）；
     ② 物品区**内部滚动**（分类条 / 标题冻结不动）—— 窗口矮到 <116px/行 时只有这里滚。 */
  .ui-page.shop-page .shop-rows.shop-fill { flex: 1 1 auto; min-height: 0; overflow-y: auto;
    scrollbar-gutter: stable; align-content: stretch; grid-auto-rows: minmax(116px, 1fr); }""",
    '① 商城 shop-rows 内部滚动',
    done_when='.ui-page.shop-page .shop-rows.shop-fill { flex: 1 1 auto; min-height: 0; overflow-y: auto;')

# ---------- ② 背包页：满高 flex 列 + 内部滚动 ----------
rep(
"""  /* v29（需求 4）：背包内容交给 .view-box 统一滚动 ——
     旧版在这里又套了一层 52vh 的内部滚动条，翻页条还被推到内容最末尾，
     于是"背包得先滚到底才能翻页"。现在翻页条已移到屏幕下方固定条，
     内容区只需要一层滚动，也就不会再出现双滚动条。 */
  .bag-body { padding-right: var(--sp-1); }""",
"""  /* v29（需求 4）：背包内容交给 .view-box 统一滚动 ——
     旧版在这里又套了一层 52vh 的内部滚动条，翻页条还被推到内容最末尾，
     于是"背包得先滚到底才能翻页"。现在翻页条已移到屏幕下方固定条，
     内容区只需要一层滚动，也就不会再出现双滚动条。
     ⛔ v89.145（老板 2）改口径：「可以滚动，但**不要整页面滚动**，设置冻结部分 ——
     上边的材料等分类和排序功能所在行不应该动，而只是底下（细分）的宝物可以」——
     背包页改**满高 flex 列**：标题 / 页签 / 分类条 / 排序条全部冻结（不随滚），
     `.bag-body` 吃剩余高度并**内部滚动**（不再由 .view-box 整页滚）。 */
  .ui-page.bag-page { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
  .ui-page.bag-page > *:not(.bag-body) { flex: 0 0 auto; }      /* 顶部各行：冻结、不伸缩 */
  .ui-page.bag-page .bag-body { flex: 1 1 auto; min-height: 0; overflow-y: auto;
    scrollbar-gutter: stable; padding-right: var(--sp-1); }""",
    '② 背包 bag-page 冻结 + bag-body 内滚',
    done_when='.ui-page.bag-page .bag-body { flex: 1 1 auto;')

save('index.html 全部')
print('\nALL OK · len ' + str(orig_len) + ' -> ' + str(len(s)))
