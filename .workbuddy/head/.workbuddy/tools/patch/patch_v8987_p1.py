# -*- coding: utf-8 -*-
"""v89.87 需求1：就地快购（组件 + 六接入点 + 种子开售/页签）—— SHOP_CATS 在 ui.js"""
import io

P2 = r'E:\Deepseekdb\js\ui.js'
s2 = io.open(P2, encoding='utf-8', newline='').read()

# --- 2.0 SHOP_CATS 加「种子」页签 ---
old0x = """    /* v89.51（老板「别买了用不了」）：营造 —— 工事图/营造方略一类。
       此前该类型不在任何页签里 → 有 price 却渲染不出来（玩家看不见也买不到）。 */
    build_cost: '营造',
  };"""
new0x = """    /* v89.51（老板「别买了用不了」）：营造 —— 工事图/营造方略一类。
       此前该类型不在任何页签里 → 有 price 却渲染不出来（玩家看不见也买不到）。 */
    build_cost: '营造',
    /* v89.87（老板拍板 · 需求 1）：**种子开售** —— 配合"就地快购全覆盖"。
       v78 曾定"种子不售、仅采集/征战产出"；本批按最新拍板开售（价格早已在表中）。 */
    seed: '种子',
  };"""
assert s2.count(old0x) == 1, ('shopcats', s2.count(old0x))
s2 = s2.replace(old0x, new0x, 1)

# --- 2.1 快购组件（插在 ui.openShop 之前） ---
anchor = "  ui.openShop = function (cat) {"
assert s2.count(anchor) == 1, ('shop-anchor', s2.count(anchor))
QB = """  /* ============================================================
   * 快购（v89.87 · 老板需求 1）：消耗点就地直购
   * ------------------------------------------------------------
   * 老板原话：「在消耗宝物的地方提供按钮，可以直接购物，避免每次都去商城」。
   * 两种形态：
   *   · openQuickBuy(itemId, need, back) —— 单物品（材料/图纸/锦囊/种子），
   *     默认数量 = 缺口；back 是"购买成功后重开的来源面板"回调。
   *   · openQuickCat(cat) —— 整类快购（加速宝物等多种同类选购）。
   * 购买走商城的**同一出口 GAME.doShopping** —— 价格/校验/扣款/日志完全一致，
   * 不存在"快购价"与"商城价"两套。种子页签同步开售（ui.SHOP_CATS）。
   * ============================================================ */
  ui._qbItem = null; ui._qbBack = null;
  /* 快购贴图：材料/图纸走各自专用画法，其余走宝物画法 */
  ui.qbArt = function (it) {
    var k = (it.type === 'material') ? 'mat' : (it.type === 'blueprint' ? 'bp' : 'qb-item');
    return ui.itemArt(k, it.id, 1);
  };
  ui.openQuickBuy = function (itemId, need, back) {
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) it = x; });
    if (!it || !it.price) { ui.toast('该物品暂不可购买（仅产出获得）'); return; }
    ui._qbItem = itemId;
    ui._qbBack = back || null;
    var have = (GAME.state.items || {})[itemId] || 0;
    var gap = Math.max(1, (need || 1) - have);
    ui.openModal(
      '<div class="gold-heading">🛒 快购 · ' + U.escape(it.name) + '</div>' +
      '<div class="item-row" style="border:none;">' +
        '<div class="ir-art">' + ui.qbArt(it) + '</div>' +
        '<div class="ir-info">' +
          '<div class="ir-name">' + U.escape(it.name) + '</div>' +
          '<div class="ir-meta">单价 ' + U.numText(it.price * 100, 0) + ' 金　·　持有 ' + have +
            '　·　需求 ' + (need || 1) + '（缺 ' + gap + '）</div>' +
          (it.desc ? '<div class="ir-desc">' + U.escape(it.desc) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ui-sub" style="margin-top:4px;">购买数量</div>' +
      ui.qtyInput('qb-qty', gap, it.price * 100, 9999) +
      '<div class="ir-total" id="qb-qty-total" data-label="合计" style="text-align:right;color:var(--gold-light);"></div>' +
      '<div class="op-hint" style="margin-top:4px;">现有黄金 ' + U.numText(GAME.state.res.gold || 0, 0) + '</div>' +
      '<div class="m-foot"><button class="btn gold" data-action="qb-buy">购买</button>' +
      '<button class="btn" data-action="close-modal">取消</button></div>');
  };
  ui.openQuickCat = function (cat) {
    var list = (DATA.ITEMS || []).filter(function (x) { return x.price > 0 && x.type === cat; });
    if (!list.length) { ui.toast('该类别暂无可购之物'); return; }
    var rows = list.map(function (it) {
      var have = (GAME.state.items || {})[it.id] || 0;
      return '<div class="xc-row">' +
        '<div class="xc-ico">' + ui.qbArt(it) + '</div>' +
        '<div class="xc-info"><b>' + U.escape(it.name) + ' ×' + have + '</b>' +
          '<span class="xc-prod">' + U.numText(it.price * 100, 0) + ' 金 · ' + U.escape(it.desc || '') + '</span></div>' +
        '<input type="number" id="qbq-' + it.id + '" min="1" value="1" style="width:64px;padding:4px;' +
          'background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
        '<button class="btn sm gold" data-action="qb-cat-buy" data-item="' + it.id + '" data-cat="' + cat + '">买入</button>' +
        '</div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🛒 快购 · ' + U.escape((ui.SHOP_CATS && ui.SHOP_CATS[cat]) || cat) + '</div>' +
      '<div class="ui-sub" style="text-align:center;">现有黄金 ' + U.numText(GAME.state.res.gold || 0, 0) + '</div>' +
      '<div class="modal-scroll" style="max-height:440px;">' + rows + '</div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
  };

"""
s2 = s2.replace(anchor, QB + anchor, 1)

# --- 2.2 openItemDetail 的 seed 分支（开售） ---
old2 = """    if (it.type === 'seed') {
      /* v78（老板需求 1）：种子**不售** —— 来源写清楚（商城价一栏对种子没有意义） */
      html += '<div class="attr"><span class="k">来源</span><span class="v good">采集归来 · 出征缴获（不售）</span></div>';
    } else if (it.price) {"""
new2 = """    if (it.type === 'seed') {
      /* v89.87（老板拍板 · 需求 1）：种子开售（配合"快购全覆盖"）——
         v78 的"不售"已按最新拍板解除；来源标注保留 */
      html += '<div class="attr"><span class="k">来源</span><span class="v good">采集归来 · 出征缴获 · 商城可购</span></div>';
      if (it.price) html += '<div class="attr"><span class="k">商城价</span><span class="v">' + U.fmt(it.price * 100) + ' 金</span></div>';
    } else if (it.price) {"""
assert s2.count(old2) == 1, ('seed', s2.count(old2))
s2 = s2.replace(old2, new2, 1)

# --- 2.3 forgeRow：缺料/缺图纸 → 就地补货按钮 ---
old3 = """    var blockers = [];
    if (!f.tierOk) blockers.push('需铁匠铺 Lv' + (DATA.FORGE.tierLv[f.q - 1] || 7));
    if (!f.bpOk) blockers.push('缺图纸「' + (f.bp ? f.bp.name : '') + '」');
    if (!f.matsOk) blockers.push('材料不足');
    if (!GAME.canAfford(f.cost)) blockers.push('资材不足');
    var ok = !blockers.length;"""
new3 = """    var blockers = [];
    if (!f.tierOk) blockers.push('需铁匠铺 Lv' + (DATA.FORGE.tierLv[f.q - 1] || 7));
    if (!f.bpOk) blockers.push('缺图纸「' + (f.bp ? f.bp.name : '') + '」');
    if (!f.matsOk) blockers.push('材料不足');
    if (!GAME.canAfford(f.cost)) blockers.push('资材不足');
    var ok = !blockers.length;
    /* v89.87（老板需求 1）：缺什么就地可买（只在真缺时渲染 —— 不占常态高度） */
    var qbBtns = '';
    Object.keys(f.mats || {}).forEach(function (mk) {
      var have = (GAME.state.items || {})[mk] || 0, need2 = f.mats[mk];
      if (have < need2) {
        var mnm = DATA.MATERIAL_BY_ID[mk] ? DATA.MATERIAL_BY_ID[mk].name : mk;
        qbBtns += '<button class="btn xs" data-action="qb-item" data-item="' + mk +
          '" data-need="' + (need2 - have) + '">🛒' + mnm + '×' + (need2 - have) + '</button> ';
      }
    });
    if (!f.bpOk && f.bp && f.bp.id) {
      qbBtns += '<button class="btn xs" data-action="qb-item" data-item="' + f.bp.id + '" data-need="1">🛒图纸×1</button>';
    }"""
assert s2.count(old3) == 1, ('forge', s2.count(old3))
s2 = s2.replace(old3, new3, 1)

old4 = """      desc: '材料：' + (matParts.join('　') || '无') +
        (ok ? '' : '<br><span style="color:var(--red-light);">' + blockers.join('　') + '</span>'),"""
new4 = """      desc: '材料：' + (matParts.join('　') || '无') +
        (ok ? '' : '<br><span style="color:var(--red-light);">' + blockers.join('　') + '</span>') +
        (qbBtns ? '<br>' + qbBtns : ''),"""
assert s2.count(old4) == 1, ('forge-desc', s2.count(old4))
s2 = s2.replace(old4, new4, 1)

# --- 2.4 openTrainBoost：加速宝物区加"就地购买" ---
old5 = """      : '<div class="q-empty" style="margin-top:8px;">背包里没有加速宝物 —— 可去商城「加速」类购得（下文②）</div>';"""
new5 = """      : '<div class="q-empty" style="margin-top:8px;">背包里没有加速宝物 —— 可就地购买（见下）</div>' +
        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm gold" data-action="qb-cat" data-cat="boost">🛒 购买加速宝物</button></div>';"""
assert s2.count(old5) == 1, ('boost-empty', s2.count(old5))
s2 = s2.replace(old5, new5, 1)

old6 = """        }).join('') + '</div>'
      : '<div class="q-empty" style="margin-top:8px;">背包里没有加速宝物 —— 可就地购买（见下）</div>' +"""
new6 = """        }).join('') +
        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm" data-action="qb-cat" data-cat="boost">🛒 购买更多</button></div>' + '</div>'
      : '<div class="q-empty" style="margin-top:8px;">背包里没有加速宝物 —— 可就地购买（见下）</div>' +"""
assert s2.count(old6) == 1, ('boost-more', s2.count(old6))
s2 = s2.replace(old6, new6, 1)

# --- 2.5 布防计略：锦囊就地购买 ---
old7 = """      '<div class="note">防御计布防于本城，持续期内自动生效。锦囊现有 <b>' + ja + '</b> 个。</div>' +"""
new7 = """      '<div class="note">防御计布防于本城，持续期内自动生效。锦囊现有 <b>' + ja + '</b> 个。' +
        '<button class="btn xs" data-action="qb-item" data-item="jinang" data-need="1" style="margin-left:6px;">🛒 购锦囊</button></div>' +"""
assert s2.count(old7) == 1, ('scheme', s2.count(old7))
s2 = s2.replace(old7, new7, 1)

old8 = """    if (((s.items || {}).jinang || 0) < sc.jinang) { ui.toast('锦囊不足（' + ((s.items || {}).jinang || 0) + '/' + sc.jinang + '），可去商城购买'); return; }"""
new8 = """    if (((s.items || {}).jinang || 0) < sc.jinang) { ui.toast('锦囊不足（' + ((s.items || {}).jinang || 0) + '/' + sc.jinang + '），可点「🛒 购锦囊」就地购买'); return; }"""
assert s2.count(old8) == 1, ('scheme-toast', s2.count(old8))
s2 = s2.replace(old8, new8, 1)

# --- 2.6 种田：种子可就地购买 ---
old9 = """      '<div class="ui-sub" style="text-align:center;">个人田庄 · 六块灵田　种子由采集与征战获得，生长走游戏时间</div>' +
      '<div class="farm-grid">' + cells + '</div>' +"""
new9 = """      '<div class="ui-sub" style="text-align:center;">个人田庄 · 六块灵田　种子由采集/征战获得，也可直接购买；生长走游戏时间</div>' +
      '<div class="op-row" style="justify-content:center;margin:4px 0 8px;">' +
        '<button class="btn sm" data-action="qb-cat" data-cat="seed">🛒 购买种子</button></div>' +
      '<div class="farm-grid">' + cells + '</div>' +"""
assert s2.count(old9) == 1, ('farm', s2.count(old9))
s2 = s2.replace(old9, new9, 1)

io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('OK ui.js 快购组件 + 六接入点 + 种子页签')

# ============================================================
# ③ main.js：四个快购动作
# ============================================================
P3 = r'E:\Deepseekdb\js\main.js'
s3 = io.open(P3, encoding='utf-8', newline='').read()
old10 = """      /* v29（需求 14）：数量以**本行输入框**为准（不再有全局的"购买数量"档位） */
      case 'shop-buy': {
        var sbId = 'sq-' + el.dataset.item;
        GAME.doShopping(el.dataset.item, ui.qtyValueOf(sbId));
        break;
      }"""
new10 = """      /* v29（需求 14）：数量以**本行输入框**为准（不再有全局的"购买数量"档位） */
      case 'shop-buy': {
        var sbId = 'sq-' + el.dataset.item;
        GAME.doShopping(el.dataset.item, ui.qtyValueOf(sbId));
        break;
      }
      /* v89.87（老板需求 1）：快购 —— 消耗点就地直购（走商城同一出口 doShopping） */
      case 'qb-item': ui.openQuickBuy(el.dataset.item, Number(el.dataset.need) || 1); break;
      case 'qb-cat': ui.openQuickCat(el.dataset.cat); break;
      case 'qb-buy': {
        var _rq = GAME.doShopping(ui._qbItem, ui.qtyValueOf('qb-qty'));
        ui.toast(_rq.msg);
        if (_rq.ok) { var _bk = ui._qbBack; ui.closeModal(); if (_bk) _bk(); }
        break;
      }
      case 'qb-cat-buy': {
        var _rq2 = GAME.doShopping(el.dataset.item, ui.qtyValueOf('qbq-' + el.dataset.item));
        ui.toast(_rq2.msg);
        if (_rq2.ok) ui.openQuickCat(el.dataset.cat);
        break;
      }"""
assert s3.count(old10) == 1, ('main', s3.count(old10))
io.open(P3, 'w', encoding='utf-8', newline='').write(s3.replace(old10, new10, 1))
print('OK main.js 四动作')
