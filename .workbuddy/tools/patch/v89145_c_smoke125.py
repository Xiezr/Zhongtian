# -*- coding: utf-8 -*-
"""v89.145 —— smoke-test.js 新增 §125 门禁节（老板 2 条）"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

ANCHOR = """    check('§124⑤ 需求档案在册（v89.144 · 老板四条关键词）', (function () {
      var a = fs124.readFileSync(p124.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.144') >= 0
        && a.indexOf('顶部固定一行') >= 0
        && a.indexOf('军队校场扩容') >= 0
        && a.indexOf('对单独兵种数量进行操作') >= 0;
    })());
  })();
"""
assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))

SECTION = r"""    check('§124⑤ 需求档案在册（v89.144 · 老板四条关键词）', (function () {
      var a = fs124.readFileSync(p124.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.144') >= 0
        && a.indexOf('顶部固定一行') >= 0
        && a.indexOf('军队校场扩容') >= 0
        && a.indexOf('对单独兵种数量进行操作') >= 0;
    })());
  })();

  /* ═══════════════════════════════════════════════════════════
   * §125（v89.145）：老板 2 条 —— 商城不足 4 行也撑满 + 去「最多」 /
   *   背包与商城「冻结头部、只滚物品区」
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs125 = require('fs'), p125 = require('path');
    var uS125 = fs125.readFileSync(p125.join(__dirname, 'js', 'ui.js'), 'utf8');
    var strip125 = function (x) { return x.replace(/\/\*[\s\S]*?\*\//g, ''); };
    var u125 = strip125(uS125);
    var h125 = fs125.readFileSync(p125.join(__dirname, 'index.html'), 'utf8');

    /* ---- ① 商城：每个分类的物品区都挂 shop-fill（撑满） ---- */
    var _r125a = '';
    check('§125① 商城**每个分类**的物品区都挂 shop-fill（不足 4 行也撑满 · 旧 fullRows143 条件已删）', (function () {
      var all = G.ui.shopItems();
      var cats = G.ui.shopCatOf(all);
      var keep = G.ui._shopCat, bad = [], minN = 1e9, minKey = '-';
      try {
        cats.forEach(function (g) {
          var n = all.filter(function (it) { return g.types.indexOf(it.type) >= 0; }).length;
          if (n < minN) { minN = n; minKey = g.key; }
          if (!n) return;                      /* 空分类渲染 q-empty，不涉网格 */
          G.ui._shopCat = g.key;
          if (!/class="shop-rows shop-fill"/.test(G.ui.shopHTML())) bad.push(g.key);
        });
      } finally { G.ui._shopCat = keep; }
      _r125a = '分类 ' + cats.length + ' 个 · 件数最少「' + minKey + '」' + minN + ' 件 / 满页 ' + (G.ui.SHOP_PER_PAGE || 16);
      return cats.length > 0 && bad.length === 0
        && !/fullRows143/.test(u125)
        && /<div class="shop-rows shop-fill">/.test(u125);
    })(), _r125a);

    /* ---- ② 商城购买数量：去「最多」（别处照用） ---- */
    check('§125② 商城购买数量行去「最多」（−/＋ 与越界钳制仍在 · 其他弹窗照用「最多」）', (function () {
      var keep = G.ui._shopCat, sh = '';
      try {
        var all = G.ui.shopItems();
        var cats = G.ui.shopCatOf(all);
        var first = cats.filter(function (g) {
          return all.some(function (it) { return g.types.indexOf(it.type) >= 0; });
        })[0];
        if (first) G.ui._shopCat = first.key;
        sh = G.ui.shopHTML();
      } finally { G.ui._shopCat = keep; }
      return /ui\.qtyInput\(inputId, 1, price, cap, true\)/.test(u125)
        && sh.indexOf('data-action="qty-step"') >= 0        /* −/＋ 仍在 */
        && sh.indexOf('data-action="qty-max"') < 0          /* 商城里没有「最多」 */
        && /data-action="qty-max"/.test(G.ui.qtyInput('zz125', 1, 100, 5));   /* 默认（别处）仍带 */
    })());

    /* ---- ③ 背包：.bag-page 冻结 + .bag-body 内滚 ---- */
    check('§125③ 背包页冻结头部（.bag-page 满高 flex 列 · 顶部各行 flex:0 0 auto · .bag-body 内滚）', (function () {
      var bh = G.ui.bagHTML();
      return /class="ui-page bag-page"/.test(bh)
        && /\.ui-page\.bag-page \{ display: flex; flex-direction: column; height: 100%; box-sizing: border-box; \}/.test(h125)
        && /\.ui-page\.bag-page > \*:not\(\.bag-body\) \{ flex: 0 0 auto; \}/.test(h125)
        && /\.ui-page\.bag-page \.bag-body \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/.test(h125);
    })());

    /* ---- ④ 商城：物品区内部滚动（分类条冻结） ---- */
    check('§125④ 商城物品区**内部滚动**（分类条/标题不动 · 窗口矮时只有它滚）',
      /\.ui-page\.shop-page \.shop-rows\.shop-fill \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/.test(h125)
      && /scrollbar-gutter: stable; align-content: stretch; grid-auto-rows: minmax\(116px, 1fr\); \}/.test(h125));

    /* ---- ⑤ 档案在册 ---- */
    check('§125⑤ 需求档案在册（v89.145 · 撑满 / 不要「最多」/ 冻结）', (function () {
      var a = fs125.readFileSync(p125.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.145') >= 0
        && a.indexOf('撑满') >= 0
        && a.indexOf('最多') >= 0
        && a.indexOf('冻结') >= 0;
    })());
  })();
"""

s = s.replace(ANCHOR, SECTION)
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('§125 inserted · len ' + str(orig_len) + ' -> ' + str(len(s)))
