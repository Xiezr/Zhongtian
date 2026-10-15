# v89.143 F2：商城 4 行铺满（.ui-page.shop-page + .shop-rows.shop-fill）
# 跑法：python .workbuddy/tools/patch/v89143_f2_shop.py
import io
PU = 'E:/Deepseekdb/js/ui.js'
PH = 'E:/Deepseekdb/index.html'
bu = io.open('E:/Deepseekdb/backup/v89143/ui.js.before', encoding='utf-8', newline='').read()
bh = io.open('E:/Deepseekdb/backup/v89143/index.html.before', encoding='utf-8', newline='').read()

def patch(P, bak, pairs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in pairs:
        if new in s and old not in s:
            print('SKIP(已落) ' + tag); continue
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        print('OK ' + tag)
    assert '\r\n' not in s
    assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏[' + P + ']'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('WROTE ' + P + ' len ' + str(len(s)))

# ---------- ui.js ----------
patch(PU, bu, [
 ("""    return '<div class="ui-page">' +
      '<div class="gold-heading">🛒 商城 · ' + (ui.SHOP_CATS[cat] || cat) +""",
  """    /* v89.143（老板 2）：满页（16 件 = 4 行 × 4 列）时给物品区挂 `shop-fill` ——
       行高从"写死 116px"改成**按可视区平分铺满**（CSS 见 .ui-page.shop-page 段）；
       不满 4 行时不拉伸（内容本来就不够，硬拉只会把两张卡撑成巨型）。 */
    var fullRows143 = slice.length >= per;
    return '<div class="ui-page shop-page">' +
      '<div class="gold-heading">🛒 商城 · ' + (ui.SHOP_CATS[cat] || cat) +""",
  'u-页面类'),
 ("""      (rows ? '<div class="shop-rows">' + rows + '</div>'
        : '<div class="q-empty">该分类暂无商品。</div>') +
      '</div>';
  };""",
  """      (rows ? '<div class="shop-rows' + (fullRows143 ? ' shop-fill' : '') + '">' + rows + '</div>'
        : '<div class="q-empty">该分类暂无商品。</div>') +
      '</div>';
  };""",
  'u-物品区类'),
])

# ---------- index.html ----------
patch(PH, bh, [
 ("""  .shop-rows { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-3);
    grid-auto-rows: 116px; align-content: start; }""",
  """  .shop-rows { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-3);
    grid-auto-rows: 116px; align-content: start; }
  /* ============================================================
   * v89.143（老板 2）：「商城的物品区块高度低，导致 4 行物品没有铺满整个界面，统一调整」——
   * ------------------------------------------------------------
   * 改前：行高写死 116px → 4 行 ≈ 500px，下面的半屏是空白。
   * 改后：商城页改**满高 flex 列**（标题 / 分类条按内容，物品区吃掉剩余高度），
   *   满页（16 件 = 4 行）时 4 行**平分可视区** —— `minmax(116px, 1fr)`：
   *   窗口够大就铺满，窗口小到 <116px/行 时退回滚动（不把卡片压扁）。
   *   列数仍固定 4（v89.140 的"四行四列"口径不变）—— 变的只是行高。
   *   ⚠️ 只有 `.shop-fill`（满页）才拉伸：不满 4 行的分类不硬拉（两张卡撑成巨型的丑态）。
   * ============================================================ */
  .ui-page.shop-page { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
  .ui-page.shop-page .shop-rows.shop-fill { flex: 1 1 auto; min-height: 0;
    align-content: stretch; grid-auto-rows: minmax(116px, 1fr); }
  /* 卡片内部同步撑满：信息区吃掉多余高度、操作行钉在卡底（不然高卡片下半截是空的） */
  .ui-page.shop-page .shop-rows.shop-fill .item-row { grid-template-rows: minmax(0, 1fr) auto; }""",
  'h-铺满样式'),
])

print('ALL OK')
