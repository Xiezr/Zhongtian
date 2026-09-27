# v89.143 F3：smoke-test.js —— 5 条断言升级到 7 列 / 无「全部」/ 商城铺满
# 跑法：python .workbuddy/tools/patch/v89143_f3_smoke.py
import io
P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89143/smoke-test.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

# ① 整页容器（商城页多了 shop-page 类）
rep("""  check('实测：商城/背包输出的是整页容器', (function () {
    var sh = G.ui.shopHTML(), bh = G.ui.bagHTML();
    return /class="ui-page"/.test(sh) && /class="ui-page"/.test(bh)
      && /shop-rows/.test(sh) && /bag-grid/.test(bh);
  })());""",
"""  check('实测：商城/背包输出的是整页容器（商城 = 满高 shop-page · v89.143）', (function () {
    var sh = G.ui.shopHTML(), bh = G.ui.bagHTML();
    return /class="ui-page/.test(sh) && /class="ui-page/.test(bh)
      && /shop-page/.test(sh)                       /* v89.143（老板 2）：满高 flex 列（4 行铺满） */
      && /shop-rows/.test(sh) && /bag-grid/.test(bh);
  })());""",
 '①整页容器')

# ② 背包每页 28 格（7 列 × 4 行）
rep("""  check('背包每页 16 格（4 列 × 4 行）', G.ui.BAG_PER_PAGE === 16, G.ui.BAG_PER_PAGE + ' 格/页');""",
"""  /* v89.143（老板 1）：背包统一 7 列 —— 每页必须**整行**（不许出现"2 行 + 2 格"） */
  check('背包每页 28 格（7 列 × 4 行 · 整行不截）', G.ui.BAG_PER_PAGE === 28
    && G.ui.BAG_PER_PAGE % 7 === 0, G.ui.BAG_PER_PAGE + ' 格/页');""",
 '②每页28')

# ③ 分类只渲染该类（all 退役 → 归一）
rep("""      var bak = G.state, bakSub = G.ui._bagSub, bakTab = G.ui._bagTab;
      try {
        var st95d = G.newGame({ name: '包', cityName: '许都', mapSeed: 13 });
        G.state = st95d;
        st95d.items = { chest_tong: 2, lingsui: 3 };
        G.ui._bagTab = 'treasure';
        G.ui._bagSub = 'chest';
        var hChest = G.ui.bagTreasureHTML('type');
        G.ui._bagSub = 'blueprint';
        var hBp = G.ui.bagTreasureHTML('val');
        G.ui._bagSub = 'all';
        var hAll = G.ui.bagTreasureHTML('type');
        /* ⚠️ all 是多段拼接 + 每段各自分页（16 行/页）—— 断言只查"单类只出该类"
           与"all 比单类更长（确实拼了多段）"，不赌某个道具落在第几页。 */
        return /chest_tong/.test(hChest) && !/lingsui/.test(hChest) && !/装备图纸/.test(hChest)
          && /装备图纸|尚无装备图纸/.test(hBp)
          && hAll.length > hChest.length;
      } finally { G.state = bak; G.ui._bagSub = bakSub; G.ui._bagTab = bakTab; }
    })());""",
"""      var bak = G.state, bakSub = G.ui._bagSub, bakTab = G.ui._bagTab;
      try {
        var st95d = G.newGame({ name: '包', cityName: '许都', mapSeed: 13 });
        G.state = st95d;
        st95d.items = { chest_tong: 2, lingsui: 3 };
        G.ui._bagTab = 'treasure';
        G.ui._bagSub = 'chest';
        var hChest = G.ui.bagTreasureHTML('type');
        G.ui._bagSub = 'blueprint';
        var hBp = G.ui.bagTreasureHTML('val');
        /* v89.143（老板 1）：「全部」退役 —— 老的 / 失效的值走归一（→ 第一个有货分类），
           且**不再有三段并排**：归一后渲染的就是**单类**（与 bagSubFirstOf 逐字同源）。 */
        G.ui._bagSub = 'all';
        var hAll = G.ui.bagTreasureHTML('type');
        var first = G.ui.bagSubFirstOf();
        var hFirst = (first === 'material') ? G.ui.bagMatHTML('type')
          : (first === 'blueprint') ? G.ui.bagBpHTML('type') : G.ui.bagItemHTML('type', first);
        return /chest_tong/.test(hChest) && !/lingsui/.test(hChest) && !/装备图纸/.test(hChest)
          && /装备图纸|尚无装备图纸/.test(hBp)
          && first !== 'all'
          && hAll === hFirst                               /* 归一后 = 第一个有货分类（逐字） */
          && G.ui.bagSubNorm('all') === first
          && G.ui.bagSubNorm('nope') === first
          && G.ui.bagSubNorm('chest') === 'chest';
      } finally { G.state = bak; G.ui._bagSub = bakSub; G.ui._bagTab = bakTab; }
    })());""",
 '③分类归一')

# ④ 旧值迁移
rep("""    check('④ 旧值迁移：openBag("item") → 宝物·全部；setBagTab("mat") → 宝物·材料', (function () {
      var bakTab = G.ui._bagTab, bakSub = G.ui._bagSub;
      try {
        G.ui.openBag('item');
        var o1 = (G.ui._bagTab === 'treasure' && G.ui._bagSub === 'all');
        G.ui.setBagTab('mat');
        var o2 = (G.ui._bagTab === 'treasure' && G.ui._bagSub === 'material');
        return o1 && o2;
      } finally { G.ui._bagTab = bakTab; G.ui._bagSub = bakSub; }
    })());""",
"""    check('④ 旧值迁移：openBag("item") → 宝物·第一个有货分类（v89.143 无「全部」）；setBagTab("mat") → 宝物·材料', (function () {
      var bakTab = G.ui._bagTab, bakSub = G.ui._bagSub;
      try {
        G.ui.openBag('item');
        var o1 = (G.ui._bagTab === 'treasure' && G.ui._bagSub === G.ui.bagSubFirstOf()
          && G.ui._bagSub !== 'all');
        G.ui.setBagTab('mat');
        var o2 = (G.ui._bagTab === 'treasure' && G.ui._bagSub === 'material');
        return o1 && o2;
      } finally { G.ui._bagTab = bakTab; G.ui._bagSub = bakSub; }
    })());""",
 '④旧值迁移')

# ⑤ 已单独打（见 F3 运行记录）

# 自检 + 落盘
assert 'BAG_PER_PAGE === 28' in s
assert 'segCells\\.push' in s
assert '\r\n' not in s
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE smoke-test.js len ' + str(len(bak)) + ' -> ' + str(len(s)))
