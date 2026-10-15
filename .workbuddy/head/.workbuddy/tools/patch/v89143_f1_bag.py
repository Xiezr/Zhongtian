# v89.143 F1：ui.js —— 背包宝物各分类统一 7 列（.bag-grid）+ 删「全部」分类
# 跑法：python .workbuddy/tools/patch/v89143_f1_bag.py
import io
P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89143/ui.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

# ---------- ① BAG_PER_PAGE：16 → 28（7 列 × 4 行） ----------
rep("""  ui.BAG_PER_PAGE = 16;""",
"""  /* v89.143（老板 1）：7 列网格下每页必须是**整行** —— 16 = 2 行 + 2 格（末行缺 5 格），
     与"7 列空间设计"不符。改 28 = **4 行 × 7 列**（与商城 4 行同高节奏，铺满一屏）。 */
  ui.BAG_PER_PAGE = 28;""",
 '①BAG_PER_PAGE')

# ---------- ② 分类归一（唯一出口）+ 删「全部」 ----------
rep("""  ui.bagSubChipsHTML = function () {
    var sub = ui._bagSub || 'all';
    var list = [['all', '全部', ui.bagSubCountOf('all')]];
    var mn = ui.bagSubCountOf('material');
    if (mn > 0) list.push(['material', '材料', mn]);""",
"""  /* ============================================================
   * v89.143（老板 1）：「背包宝物界面均参考 7 列空间设计，**不要"全部"这个分类**」
   * ------------------------------------------------------------
   * 两件事一起：
   *   ① 物品（宝物）子页改走 `pageBag`（.bag-grid **7 列**）—— 改前它走 `pageRows`
   *      （**4 列**的 .shop-rows），只有材料 / 图纸 / 装备页才是 7 列 —— 这就是
   *      老板看到的"没按 7 列"；统一后四页同一个网格、同一个每页格数（28 = 4×7）。
   *   ② 「全部」分类条整条退役（含"三段并排"的渲染分支）——
   *      归一出口 `bagSubNorm`：任何"老的 / 空的 / 失效的"分类值 → **第一个有货分类**
   *      （材料 → 类型序 → 图纸）；全空时仍给材料页（空态文案最合适）。
   * ============================================================ */
  ui.bagSubFirstOf = function () {
    if (ui.bagSubCountOf('material') > 0) return 'material';
    var hit = null;
    Object.keys(ui.BAG_ITEM_CN).forEach(function (ty) {
      if (!hit && ui.bagSubCountOf(ty) > 0) hit = ty;
    });
    if (hit) return hit;
    if (ui.bagSubCountOf('blueprint') > 0) return 'blueprint';
    return 'material';
  };
  ui.bagSubNorm = function (v) {
    if (!v || v === 'all') return ui.bagSubFirstOf();
    if (v === 'material' || v === 'blueprint') return v;
    if (ui.BAG_ITEM_CN[v]) return v;
    return ui.bagSubFirstOf();
  };
  ui.bagSubChipsHTML = function () {
    var sub = ui.bagSubNorm(ui._bagSub);
    var list = [];
    var mn = ui.bagSubCountOf('material');
    if (mn > 0) list.push(['material', '材料', mn]);""",
 '②归一+删全部')

# ---------- ③ bagTreasureHTML：删 all 三段并排分支 ----------
rep("""  ui.bagTreasureHTML = function (sort) {
    var sub = ui._bagSub || 'all';
    if (sub === 'material') return ui.bagMatHTML(sort);
    if (sub === 'blueprint') return ui.bagBpHTML(sort);
    if (sub !== 'all') return ui.bagItemHTML(sort, sub);
    return ui.bagMatHTML(sort) + ui.bagItemHTML(sort) + ui.bagBpHTML(sort);
  };""",
"""  ui.bagTreasureHTML = function (sort) {
    /* v89.143（老板 1）：「全部」退役 —— 分类恒为**一个**具体类目（归一出口保证）。 */
    var sub = ui.bagSubNorm(ui._bagSub);
    ui._bagSub = sub;
    if (sub === 'material') return ui.bagMatHTML(sort);
    if (sub === 'blueprint') return ui.bagBpHTML(sort);
    return ui.bagItemHTML(sort, sub);
  };""",
 '③bagTreasureHTML')

# ---------- ④ bagItemHTML：pageRows(4 列) → pageBag(7 列) + 分类型段 ----------
rep("""    if (!any) return '<div class="q-empty">背包中暂无宝物。</div>';""",
"""    if (!any) return '<div class="q-empty">此类暂无宝物 —— 换一个分类看看。</div>';""",
 '④a空态文案')

# ④b：把 rows.push(ui.bagCell(cell)) 改成按类型分段（bagRows）
rep("""      arr.forEach(function (it) {
        var have = items[it.id] || 0;
        var tplName = CN[tp].replace(/（.*/, '');""",
"""      var segCells = [];
      arr.forEach(function (it) {
        var have = items[it.id] || 0;
        var tplName = (CN[tp] || tp).replace(/（.*/, '');""",
 '④b-1分段收集')

rep("""        if (route.direct) { cell.act = 'use-bag-item'; cell.bulk = 1; }   /* v89.141：右键 = 批量小窗 */
        else if (route.act) { cell.act = route.act; }
        else { cell.act = 'bag-go'; cell.view = route.view; }
        rows.push(ui.bagCell(cell));
      });
    });""",
"""        if (route.direct) { cell.act = 'use-bag-item'; cell.bulk = 1; }   /* v89.141：右键 = 批量小窗 */
        else if (route.act) { cell.act = route.act; }
        else { cell.act = 'bag-go'; cell.view = route.view; }
        segCells.push(ui.bagCell(cell));
      });
      /* v89.143：每个类型**一段**（标题 + .bag-grid 7 列）—— 与材料 / 图纸页同构 */
      rows = rows.concat(ui.bagRows(
        '<div class="bag-sec">' + U.escape((CN[tp] || tp).replace(/（.*/, '')) +
        ' <span class="n">' + segCells.length + ' 种</span></div>', tp, segCells));
    });""",
 '④b-2分段收尾')

rep("""    ui._itemGen = ui._itemGen || (s.generals[0] ? s.generals[0].id : '');
    var pick = '';
    /* v29（需求 4）：宝物页同样分页（每页 8 行），翻页条在底部固定条；
       v89.104：不再拼「使用对象」将领清单（pick 已恒为空）；
       v89.115：分页 key 带二级分类 —— 换分类回到第 1 页，不会停在越界页码上 */
    return ui.pageRows('bag-item-' + (onlyType || 'all'),
      rows.map(function (h) { return { cell: h }; }), 16);
  };""",
"""    ui._itemGen = ui._itemGen || (s.generals[0] ? s.generals[0].id : '');
    /* v89.143（老板 1）：改走 `pageBag`（.bag-grid **7 列**，每页 28 = 4×7）——
       改前走 `pageRows`（4 列的 .shop-rows），是"宝物页不是 7 列"的病根所在。
       分页 key 带二级分类（换分类回第 1 页，不会停在越界页码上）。 */
    return ui.pageBag('bag-item-' + (onlyType || ui.bagSubNorm(ui._bagSub)), rows);
  };""",
 '④c-pageBag')

# ---------- ⑤ bagSummary：全部分支退役（改"当前分类 + 全量"） ----------
rep("""    var sub = ui._bagSub || 'all';
    if (sub === 'all') {
      var nm = 0, kinds = 0;
      DATA.MATERIALS.forEach(function (m) {
        var c = (s.items || {})[m.id] || 0;
        nm += c; if (c > 0) kinds++;
      });
      return '宝物 ' + ui.bagSubCountOf('all') + ' 件（材料 ' + nm + ' 个 / ' + kinds + ' 种）';
    }
    var nm2 = (sub === 'material') ? '材料'
      : (sub === 'blueprint') ? '图纸'
      : ((ui.BAG_ITEM_CN[sub] || sub) + '').replace(/（.*/, '');
    return nm2 + ' ' + ui.bagSubCountOf(sub) + ' 件';""",
"""    /* v89.143（老板 1）：无「全部」后，摘要 = **当前分类 + 全量兜底**
       （'all' 仍是计数出口 bagSubCountOf 的合法入参，只是不再是一个分类页）。 */
    var sub = ui.bagSubNorm(ui._bagSub);
    var nm2 = (sub === 'material') ? '材料'
      : (sub === 'blueprint') ? '图纸'
      : ((ui.BAG_ITEM_CN[sub] || sub) + '').replace(/（.*/, '');
    return nm2 + ' ' + ui.bagSubCountOf(sub) + ' 件（宝物共 ' + ui.bagSubCountOf('all') + ' 件）';""",
 '⑤摘要')

# ---------- ⑥ setBagTab / setBagSub：归一化 + 删 'all' 页码键 ----------
rep("""  var BAG_LEGACY_TAB = { mat: ['treasure', 'material'], item: ['treasure', 'all'], bp: ['treasure', 'blueprint'] };""",
"""  /* v89.143（老板 1）：'item'（老深链）不再落到「全部」—— 落**第一个有货分类**（null = 归一） */
  var BAG_LEGACY_TAB = { mat: ['treasure', 'material'], item: ['treasure', null], bp: ['treasure', 'blueprint'] };""",
 '⑥a-legacy')

rep("""    if (BAG_LEGACY_TAB[t]) {
      ui._bagTab = BAG_LEGACY_TAB[t][0];
      ui._bagSub = BAG_LEGACY_TAB[t][1];
    } else {
      ui._bagTab = (t === 'treasure') ? 'treasure' : 'equip';
    }
    ui._pages['bag-equip'] = 1;
    ui._pages['bag-treasure'] = 1;
    ui.renderBag();
  };
  /* 宝物二级分类切换（v89.115）：回到第 1 页（同 bag-tab 口径） */
  ui.setBagSub = function (v) {
    ui._bagSub = v || 'all';
    ui._pages['bag-item'] = 1;
    ui._pages['bag-item-all'] = 1;
    ui._pages['bag-item-' + ui._bagSub] = 1;
    ui._pages['bag-mat'] = 1;
    ui._pages['bag-bp'] = 1;
    ui.renderBag();
  };""",
"""    if (BAG_LEGACY_TAB[t]) {
      ui._bagTab = BAG_LEGACY_TAB[t][0];
      ui._bagSub = BAG_LEGACY_TAB[t][1] || ui.bagSubFirstOf();
    } else {
      ui._bagTab = (t === 'treasure') ? 'treasure' : 'equip';
    }
    ui._pages['bag-equip'] = 1;
    ui._pages['bag-treasure'] = 1;
    ui.renderBag();
  };
  /* 宝物二级分类切换（v89.115）：回到第 1 页（同 bag-tab 口径）
     v89.143：走归一出口（老的 'all' / 失效值 → 第一个有货分类） */
  ui.setBagSub = function (v) {
    ui._bagSub = ui.bagSubNorm(v);
    ui._pages['bag-item'] = 1;
    ui._pages['bag-item-' + ui._bagSub] = 1;
    ui._pages['bag-mat'] = 1;
    ui._pages['bag-bp'] = 1;
    ui.renderBag();
  };""",
 '⑥b-setBagSub')

# ---------- ⑦ bagHTML：进宝物页先归一 ----------
rep("""    /* 二级分类条（仅宝物页）—— 参考商城分类，只列有货的（快速检索） */
    if (t === 'treasure') html += ui.bagSubChipsHTML();""",
"""    /* 二级分类条（仅宝物页）—— 参考商城分类，只列有货的（快速检索）；
       v89.143：进页先归一（删「全部」后，失效值一律落到第一个有货分类）。 */
    if (t === 'treasure') { ui._bagSub = ui.bagSubNorm(ui._bagSub); html += ui.bagSubChipsHTML(); }""",
 '⑦bagHTML归一')

# 自检 + 落盘
assert 'BAG_PER_PAGE = 28' in s
assert "['all', '全部', ui.bagSubCountOf('all')]" not in s
assert 'ui.bagSubNorm = function' in s and 'ui.bagSubFirstOf = function' in s
assert '\r\n' not in s
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE ui.js len ' + str(len(bak)) + ' -> ' + str(len(s)))
