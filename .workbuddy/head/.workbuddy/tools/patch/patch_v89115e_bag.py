# -*- coding: utf-8 -*-
"""
patch_v89115e_bag.py — 需求 0b：背包分「装备 / 宝物」两大类；宝物按（商城的）分类检索
"""
import io, os, sys

R = 'E:/Deepseekdb/'
def read(p): return io.open(R + p, encoding='utf-8').read()
def write(p, s):
    tmp = R + p + '.tmp115e'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
def sub1(s, old, new, label):
    n = s.count(old)
    if n != 1:
        print('!! [%s] 匹配数 = %d\n   首行: %s' % (label, n, old.split('\n')[0][:90])); sys.exit(1)
    return s.replace(old, new, 1)

U = read('js/ui.js')

# ---- A. BAG_TABS / BAG_SORT_OPTS ----
OLD_A = """  var BAG_TABS = [['equip', '装备'], ['mat', '材料'], ['item', '宝物'], ['bp', '图纸']];
  var EQUIP_SLOT_ORDER = ['weapon', 'head', 'chest', 'shoulder', 'arm', 'waist',
    'feet', 'back', 'neck', 'ring', 'pendant', 'mount'];
  var BAG_SORT_OPTS = {
    equip: [['q', '品质'], ['val', '价值'], ['set', '套件'], ['slot', '部位']],
    mat: [['series', '系列'], ['tier', '品阶'], ['have', '数量']],
    item: [['type', '类型'], ['val', '价值']],
    bp: [['val', '价值']],
  };
  ui._bagSort = ui._bagSort || { equip: 'q', mat: 'series', item: 'type', bp: 'val' };"""
NEW_A = """  /* v89.115（老板）：「背包分成装备和宝物，宝物参考商城的分类进行划分，
     以便快速检索拥有的材料和宝物」——
     顶层改**两类**（装备 / 宝物）；宝物页内用**二级分类条**（材料 / 珠宝 / 符类 / …）
     按类型名出口 `BAG_ITEM_CN`（与商城分类对齐）切分，只列**有货**的类。 */
  var BAG_TABS = [['equip', '装备'], ['treasure', '宝物']];
  /* 二级分类的默认值：全部（= 材料 + 宝物 + 图纸，分三段） */
  ui._bagSub = ui._bagSub || 'all';
  var EQUIP_SLOT_ORDER = ['weapon', 'head', 'chest', 'shoulder', 'arm', 'waist',
    'feet', 'back', 'neck', 'ring', 'pendant', 'mount'];
  var BAG_SORT_OPTS = {
    equip: [['q', '品质'], ['val', '价值'], ['set', '套件'], ['slot', '部位']],
    /* 宝物页四类排序：材料看系列/品阶，宝物看类型/价值，通用"数量"两端都能用 */
    treasure: [['type', '类型'], ['series', '系列'], ['tier', '品阶'], ['val', '价值'], ['have', '数量']],
  };
  ui._bagSort = ui._bagSort || { equip: 'q', treasure: 'type' };
  /* 旧顶层页签值 → 新的「类 + 二级分类」映射（老深链/老测试不炸；见 setBagTab） */
  var BAG_LEGACY_TAB = { mat: ['treasure', 'material'], item: ['treasure', 'all'], bp: ['treasure', 'blueprint'] };"""
U = sub1(U, OLD_A, NEW_A, 'BAG_TABS')

# ---- B. BAG_ITEM_CN 注释（与商城分类对齐）----
OLD_B = """  ui.BAG_ITEM_CN = {
    jewel: '珠宝（赏赐忠诚）', attr_buff: '符类', prod_buff: '生产', military_buff: '军事',"""
NEW_B = """  /* v89.115（老板「宝物参考商城的分类进行划分」）：本表即**宝物二级分类名**，
     与商城分类（ui.SHOP_CATS）对齐 —— 商城的每个页签在这里都有对应一类
     （material / blueprint 走专属渲染，另有 rank_up / essence / pop_fill 三类是背包专有：
     商城不售、只能征战/秘境所得）。**新增可上架类型时两处都要有**。 */
  ui.BAG_ITEM_CN = {
    jewel: '珠宝（赏赐忠诚）', attr_buff: '符类', prod_buff: '生产', military_buff: '军事',"""
U = sub1(U, OLD_B, NEW_B, 'BAG_ITEM_CN 注释')

# ---- C. bagItemHTML 支持按类型过滤 ----
OLD_C = """  ui.bagItemHTML = function (sort) {
    var s = GAME.state, items = s.items || {};
    var CN = ui.BAG_ITEM_CN;
    var groups = {};
    Object.keys(items).forEach(function (id) {
      if ((items[id] || 0) <= 0) return;
      if (DATA.MATERIAL_BY_ID[id]) return;
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
      if (!it || it.type === 'blueprint') return;
      (groups[it.type] = groups[it.type] || []).push(it);
    });"""
NEW_C = """  ui.bagItemHTML = function (sort, onlyType) {
    var s = GAME.state, items = s.items || {};
    var CN = ui.BAG_ITEM_CN;
    var groups = {};
    Object.keys(items).forEach(function (id) {
      if ((items[id] || 0) <= 0) return;
      if (DATA.MATERIAL_BY_ID[id]) return;
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
      if (!it || it.type === 'blueprint') return;
      if (onlyType && it.type !== onlyType) return;      /* v89.115：二级分类过滤 */
      (groups[it.type] = groups[it.type] || []).push(it);
    });"""
U = sub1(U, OLD_C, NEW_C, 'bagItemHTML 过滤')

OLD_C2 = """    ui._itemGen = ui._itemGen || (s.generals[0] ? s.generals[0].id : '');
    var pick = '';
    /* v29（需求 4）：宝物页同样分页（每页 8 行），翻页条在底部固定条；
       v89.104：不再拼「使用对象」将领清单（pick 已恒为空） */
    return ui.pageRows('bag-item', rows.map(function (h) { return { cell: h }; }), 16);"""
NEW_C2 = """    ui._itemGen = ui._itemGen || (s.generals[0] ? s.generals[0].id : '');
    var pick = '';
    /* v29（需求 4）：宝物页同样分页（每页 8 行），翻页条在底部固定条；
       v89.104：不再拼「使用对象」将领清单（pick 已恒为空）；
       v89.115：分页 key 带二级分类 —— 换分类回到第 1 页，不会停在越界页码上 */
    return ui.pageRows('bag-item-' + (onlyType || 'all'),
      rows.map(function (h) { return { cell: h }; }), 16);"""
U = sub1(U, OLD_C2, NEW_C2, 'bagItemHTML 分页 key')

# ---- D. bagSummary 按新口径 ----
OLD_D = """  /* 背包总量摘要 */
  ui.bagSummary = function (t) {
    var s = GAME.state;
    if (t === 'equip') return '装备 ' + (s.inventory || []).length + ' 件';
    if (t === 'mat') {
      var n = 0;
      DATA.MATERIALS.forEach(function (m) { n += (s.items || {})[m.id] || 0; });
      var kinds = DATA.MATERIALS.filter(function (m) { return (s.items || {})[m.id] > 0; }).length;
      return '材料 ' + n + ' 个 / ' + kinds + ' 种';
    }
    var cnt = 0;
    for (var k in (s.items || {})) {
      if (DATA.MATERIAL_BY_ID[k]) continue;
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === k) it = x; });
      if (!it) continue;
      if (t === 'bp' && it.type !== 'blueprint') continue;
      if (t === 'item' && it.type === 'blueprint') continue;
      cnt += s.items[k] || 0;
    }
    return (t === 'bp' ? '图纸 ' : '宝物 ') + cnt + ' 个';
  };"""
NEW_D = """  /* 背包总量摘要（v89.115：按「类 + 二级分类」给） */
  ui.bagSummary = function (t) {
    var s = GAME.state;
    if (t === 'equip') return '装备 ' + (s.inventory || []).length + ' 件';
    var sub = ui._bagSub || 'all';
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
    return nm2 + ' ' + ui.bagSubCountOf(sub) + ' 件';
  };
  /* 某一类宝物有多少件（**唯一出口**：分类条角标、摘要、断言共读）。
     材料归 'material'；其余按 ITEMS[].type；'all' = 材料 + 全部宝物（含图纸）。 */
  ui.bagSubCountOf = function (ty) {
    var s = GAME.state || {}, items = s.items || {}, n = 0;
    if (ty === 'all' || ty === 'material') {
      (DATA.MATERIALS || []).forEach(function (m) { n += items[m.id] || 0; });
    }
    if (ty !== 'material' && ty !== 'blueprint') {
      for (var k in items) {
        if (DATA.MATERIAL_BY_ID[k]) continue;
        var it = null;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === k) it = x; });
        if (!it || it.type === 'blueprint') continue;
        if (ty === 'all' || it.type === ty) n += items[k] || 0;
      }
    }
    if (ty === 'all' || ty === 'blueprint') {
      (DATA.BLUEPRINTS || []).forEach(function (b) { n += items[b.id] || 0; });
    }
    return n;
  };
  /* 二级分类条（宝物页顶部）：全部 + 有货的分类（"快速检索拥有的"）；
     分类顺序 = BAG_ITEM_CN 的键序（与商城分类对齐）；材料/图纸各单列。 */
  ui.bagSubChipsHTML = function () {
    var sub = ui._bagSub || 'all';
    var list = [['all', '全部', ui.bagSubCountOf('all')]];
    var mn = ui.bagSubCountOf('material');
    if (mn > 0) list.push(['material', '材料', mn]);
    Object.keys(ui.BAG_ITEM_CN).forEach(function (ty) {
      var n = ui.bagSubCountOf(ty);
      if (n > 0) list.push([ty, (ui.BAG_ITEM_CN[ty] + '').replace(/（.*/, ''), n]);
    });
    var bn = ui.bagSubCountOf('blueprint');
    if (bn > 0) list.push(['blueprint', '图纸', bn]);
    return '<div class="chips chips-xs" style="justify-content:center;margin-bottom:6px;">' +
      list.map(function (x) {
        return '<span class="chip' + (sub === x[0] ? ' on' : '') +
          '" data-action="bag-sub" data-v="' + x[0] + '">' + x[1] + ' <i>' + x[2] + '</i></span>';
      }).join('') + '</div>';
  };
  /* 宝物页（按二级分类分派）：material → 材料页 · blueprint → 图纸页 ·
     单一类型 → 宝物页（过滤）· all → 三段并排（材料 / 宝物 / 图纸） */
  ui.bagTreasureHTML = function (sort) {
    var sub = ui._bagSub || 'all';
    if (sub === 'material') return ui.bagMatHTML(sort);
    if (sub === 'blueprint') return ui.bagBpHTML(sort);
    if (sub !== 'all') return ui.bagItemHTML(sort, sub);
    return ui.bagMatHTML(sort) + ui.bagItemHTML(sort) + ui.bagBpHTML(sort);
  };"""
U = sub1(U, OLD_D, NEW_D, 'bagSummary + 新增出口')

# ---- E. bagHTML 主体 ----
OLD_E = """  ui.bagHTML = function () {
    var s = GAME.state;
    var t = ui._bagTab || 'equip';
    var sort = ui._bagSort[t] || (BAG_SORT_OPTS[t] || [['q', '']])[0][0];

    var html = '';
    /* 页签 */
    html += '<div class="subtabs" style="margin:0 0 8px;justify-content:center;">' +
      BAG_TABS.map(function (x) {
        return '<span class="sub' + (t === x[0] ? ' active' : '') + '" data-action="bag-tab" data-v="' + x[0] + '">' + x[1] + '</span>';
      }).join('') + '</div>';
    /* 排序条 */
    html += '<div class="bag-sortbar"><span class="lb">排序</span>' +
      (BAG_SORT_OPTS[t] || []).map(function (o) {
        return '<span class="chip' + (sort === o[0] ? ' on' : '') + '" data-action="bag-sort" data-v="' + o[0] + '">' + o[1] + '</span>';
      }).join('') +
      '<span class="bag-total">' + ui.bagSummary(t) + '</span></div>';
    html += '<div class="bag-body">';

    if (t === 'equip') html += ui.bagEquipHTML(sort);
    else if (t === 'mat') html += ui.bagMatHTML(sort);
    else if (t === 'bp') html += ui.bagBpHTML(sort);
    else html += ui.bagItemHTML(sort);

    html += '</div>';
    return '<div class="ui-page">' +
      '<div class="gold-heading">🎒 背包 · ' + (BAG_TABS.filter(function (x) { return x[0] === t; })[0] || ['', ''])[1] +
        ui.help('悬停格子看属性\\n点格子开详情\\n装备可穿戴，也可拆解回收材料') +
      '</div>' + html + '</div>';
  };"""
NEW_E = """  ui.bagHTML = function () {
    var s = GAME.state;
    var t = ui._bagTab || 'equip';
    if (t !== 'equip' && t !== 'treasure') t = 'equip';       /* 脏值兜底（旧档深链） */
    var sk = (t === 'equip') ? 'equip' : 'treasure';          /* 排序按「类」存，不按二级分类 */
    var sort = ui._bagSort[sk] || (BAG_SORT_OPTS[sk] || [['q', '']])[0][0];

    var html = '';
    /* 页签（v89.115：两类 —— 装备 / 宝物） */
    html += '<div class="subtabs" style="margin:0 0 8px;justify-content:center;">' +
      BAG_TABS.map(function (x) {
        return '<span class="sub' + (t === x[0] ? ' active' : '') + '" data-action="bag-tab" data-v="' + x[0] + '">' + x[1] + '</span>';
      }).join('') + '</div>';
    /* 二级分类条（仅宝物页）—— 参考商城分类，只列有货的（快速检索） */
    if (t === 'treasure') html += ui.bagSubChipsHTML();
    /* 排序条 */
    html += '<div class="bag-sortbar"><span class="lb">排序</span>' +
      (BAG_SORT_OPTS[sk] || []).map(function (o) {
        return '<span class="chip' + (sort === o[0] ? ' on' : '') + '" data-action="bag-sort" data-v="' + o[0] + '">' + o[1] + '</span>';
      }).join('') +
      '<span class="bag-total">' + ui.bagSummary(t) + '</span></div>';
    html += '<div class="bag-body">';

    if (t === 'equip') html += ui.bagEquipHTML(sort);
    else html += ui.bagTreasureHTML(sort);

    html += '</div>';
    return '<div class="ui-page">' +
      '<div class="gold-heading">🎒 背包 · ' + (t === 'treasure' ? '宝物' : '装备') +
        ui.help('悬停格子看属性\\n点格子开详情\\n' +
          '宝物页顶部的分类条按**商城分类**切分（只列有货的）—— 材料 / 珠宝 / 符类…\\n' +
          '装备可穿戴，也可拆解回收材料') +
      '</div>' + html + '</div>';
  };"""
U = sub1(U, OLD_E, NEW_E, 'bagHTML 主体')

# ---- F. setBagTab / setBagSort ----
OLD_F = """  ui.setBagTab = function (t) {
    ui._bagTab = t;
    ui._pages['bag-' + t] = 1;
    ui.renderBag();
  };
  ui.setBagSort = function (v) {
    var t = ui._bagTab || 'equip';
    ui._bagSort[t] = v;
    ui._pages['bag-' + t] = 1;
    ui.openBag(t);
  };"""
NEW_F = """  ui.setBagTab = function (t) {
    /* v89.115：顶层两类（装备 / 宝物）；旧值 'mat' / 'item' / 'bp' 自动迁移到
       「宝物 + 对应二级分类」（老深链、老测试、老脚本都不炸）。 */
    if (BAG_LEGACY_TAB[t]) {
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
  };
  ui.setBagSort = function (v) {
    var sk = ((ui._bagTab || 'equip') === 'equip') ? 'equip' : 'treasure';
    ui._bagSort[sk] = v;
    ui._pages['bag-' + sk] = 1;
    ui.openBag(ui._bagTab);
  };"""
U = sub1(U, OLD_F, NEW_F, 'setBagTab/Sort')

write('js/ui.js', U)
print('  ✓ ui.js 写入完成')

# ---- G. main.js：bag-sub 动作 ----
M = read('js/main.js')
OLD_G = """      case 'bag-tab': ui.setBagTab(el.dataset.v); break;"""
NEW_G = """      case 'bag-tab': ui.setBagTab(el.dataset.v); break;
      /* v89.115：宝物二级分类条（参考商城分类检索） */
      case 'bag-sub': ui.setBagSub(el.dataset.v); break;"""
M = sub1(M, OLD_G, NEW_G, 'main bag-sub')
write('js/main.js', M)
print('  ✓ main.js 写入完成')
print('ALL DONE')
