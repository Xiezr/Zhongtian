/* ============================================================
 * ui-craft.js　器物 · 宝物 / 神器 / 荒野行动 / 游商 / 制造 / 熔铸 / 抽卡
 * ------------------------------------------------------------
 * 拆分自 ui.js（v156.27）。**纯搬运** —— 所有 ui.xxx 定义及其先后顺序
 *   一字未改，只是换了文件。等价性由逐条 sha1 比对证明。
 * ⚠️ 这个文件的职责就是「一个功能域的全部面板实现」，不要在这里改引擎逻辑。
 * ============================================================ */
import './ui.js';
(function () {
  var GAME = window.GAME;
  var DATA = GAME.DATA, U = GAME.utils;
  var ui = GAME.ui;
  var $ = ui._dom.$, $$ = ui._dom.$$;

  /* 共享常量：定义在 ui.js 的 ui._C（全站唯一一份，取的是同一个对象） */
  var EQUIP_SLOT_ORDER = ui._C.EQUIP_SLOT_ORDER;

  /* ============================================================
   * v89.104（老板）：「背包里的宝物界面不要设置英雄清单，点击使用的时候，
   * 如果是直接消耗的无对象物品，直接使用并生效即可；有使用对象的物品，做好提示，
   * 比如『请在XX界面使用』『请对英雄使用』『请在什么建筑中使用』等等，
   * 匹配其使用界面或场景」
   * ------------------------------------------------------------
   * `ITEM_USE_ROUTE` 是**唯一出口**：type → 去处。
   *   · direct: true      = 无对象，就地使用（systems.useItem 里不需要英雄的那些分支）
   *   · hint/btn/view     = 有对象或场景：按钮改成"去往该界面"，背包里不再选人
   * 依据：systems.useItem 里**调用 _findGen 的分支**才需要英雄
   *   （jewel / attr_buff / exp / stamina / perm / rank_up / mount_buff / neigong）。
   * ⚠️ 新增道具类型必须在这张表里登记 —— smoke 有一条"路由表覆盖全部 type"的门禁。
   * ============================================================ */
  ui.ITEM_USE_ROUTE = {
    /* 无对象：就地生效 */
    prod_buff: { direct: true },
    build_cost: { direct: true },
    military_buff: { direct: true },
    boost: { direct: true },
    corvee: { direct: true },
    chest: { direct: true },
    pop_boost: { direct: true },
    pop_fill: { direct: true },
    /* 有对象：去英雄面板（背包不选人） */
    jewel: { hint: '赏赐忠诚：请对英雄使用', view: 'generals', btn: '去英雄面板' },
    attr_buff: { hint: '符类加属性：请对英雄使用', view: 'generals', btn: '去英雄面板' },
    exp: { hint: '加经验：请对英雄使用', view: 'generals', btn: '去英雄面板' },
    stamina: { hint: '恢复体力：请对英雄使用', view: 'generals', btn: '去英雄面板' },
    energy: { hint: '恢复精力：请对英雄使用', view: 'generals', btn: '去英雄面板' },
    perm: { hint: '永久丹药：请对英雄使用', view: 'generals', btn: '去英雄面板' },
    mount_buff: { hint: '座驾道具：请对英雄使用', view: 'generals', btn: '去英雄面板' },
    neigong: { hint: '战技残页：请对英雄使用', view: 'generals', btn: '去英雄面板' },
    /* v89.186（老板 1）：遗物为英雄挂件 —— 背包不选人，去英雄面板佩 */
    bao: { hint: '遗物为英雄挂件：请到英雄面板佩上', view: 'generals', btn: '去英雄面板' },
    rank_up: { hint: '提升资质：请对英雄使用', view: 'generals', btn: '去英雄面板' },
    /* v91.30：奇观材料 —— 无"使用"动作（作高阶升级/强化/打造/融合的消耗料）。
       v91.59（老板）：6 种"直接使用型"专属用途退役 → 9 种一律 wmat，去**融合淬体**。 */
    wmat: { hint: '奇观材料：用于高阶升级 / 强化 / 打造 / 基因融合（非消耗品）', act: 'ling-fuse-open', btn: '去融合淬体' },
    /* v91.72：舰船蓝图 —— 非消耗品，指引去空间站建造对应舰种（奇观探索产出）。 */
    ship_bp: { hint: '舰船蓝图：请到空间站建造对应舰种', view: 'station', btn: '去空间站' },
    /* v91.72：压缩物资 —— 无对象，就地解压入当前城（仓容不足则拒绝）。 */
    res_crate: { direct: true },
    /* 有场景：去对应玩法界面 */
    essence: { hint: '请到调校界面使用', act: 'ling-temper-open', btn: '去调校' },
    talis: { hint: '封存匣在出征时随计略消耗，无需手动使用', view: 'city', btn: '去城市' },
  };
  /* 某件道具的"去处"（未知类型一律当"无对象"处理 —— 宁可给个使用按钮，
     也不要让它变成一件看得见、点不动的死物） */
  ui.itemRouteOf = function (it) {
    var R = ui.ITEM_USE_ROUTE[it && it.type];
    return R || { direct: true };
  };
  /* v89.115（老板「宝物参考游商的分类进行划分」）：本表即**宝物二级分类名**，
     与游商分类（ui.SHOP_CATS）对齐 —— 游商的每个页签在这里都有对应一类
     （material / blueprint 走专属渲染，另有 rank_up / essence / pop_fill 三类是背包专有：
     游商不售、只能征战/采集所得）。**新增可上架类型时两处都要有**。 */
  ui.BAG_ITEM_CN = {
    jewel: '珠宝（赏赐忠诚）', attr_buff: '符类', prod_buff: '生产', military_buff: '军事',
    boost: '加速', exp: '经验', stamina: '体力', perm: '永久丹药', mount_buff: '座驾',
    /* v89.131：精力族（提神剂等）单独一组 —— 与英雄页的「体力 / 精力」两行同名对应 */
    energy: '精力',
    rank_up: '血清（提升资质）',
    essence: '精华（调校基因强化件）',
    chest: '宝箱', neigong: '战技残页', corvee: '政令', talis: '封存匣', build_cost: '营造', wmat: '奇观材料',
    ship_bp: '舰船蓝图',
    res_crate: '压缩物资（解压回城）',
    /* v89.99（老板「增加道具如招揽令」）：民生 —— 幸存者增速道具；
       v89.104：迁入令（一次性幸存者注入）同属民生族 */
    pop_boost: '民生（幸存者增速）',
    pop_fill: '民生（迁入令）',
    /* v89.186（老板 1）：遗物 —— 英雄挂件（背包可见、不可就地使用；装配在英雄面板） */
    bao: '遗物（英雄挂件）',
  };
  ui.bagItemHTML = function (sort, onlyType) {
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
    });
    var order = Object.keys(CN);
    if (sort === 'val') order.sort(function (a, b) {
      var va = Math.max.apply(null, (groups[a] || [{ price: 0 }]).map(function (x) { return x.price || 0; }));
      var vb = Math.max.apply(null, (groups[b] || [{ price: 0 }]).map(function (x) { return x.price || 0; }));
      return vb - va;
    });
    var rows = [], any = false;
    order.forEach(function (tp) {
      var arr = groups[tp];
      if (!arr || !arr.length) return;
      any = true;
      if (sort === 'val') arr = arr.slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); });

      /* v89.155（老板 4）：默认（按类型）排序 = 内置标号（同功能相邻 · 由小到大） */
      else arr = arr.slice().sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });
      var segCells = [];
      arr.forEach(function (it) {
        var have = items[it.id] || 0;
        var tplName = (CN[tp] || tp).replace(/（.*/, '');
        /* v89.140（老板 7）：「背包中的宝物也是，**建立统一的物品框和规格样式**，
           按每行可为 **7 个物品**并列的宽度设计。物品介绍**悬停显示**」——
           行卡片（.item-row + 数量框 + 按钮）整体退役，改与材料页同一个 `ui.bagCell`
           （统一物品框：图标 + 名称 + 数量角标 + 悬停介绍；容量条见 CSS `.bag-grid` 7 列）。
           动作按 ITEM_USE_ROUTE 分流（就地使用 / 指路），不另立规则：
             direct → 点击就地使用 1 个；route.act → 该动作；否则 → 跳到对应视图。 */
        var route = ui.itemRouteOf(it);
        var cell = {
          cls: 'q' + (((it.price || 0) >= 60) ? 4 : ((it.price || 0) >= 26) ? 3 : ((it.price || 0) >= 10) ? 2 : 1),
          ico: (GAME.icons.forItem ? GAME.icons.forItem(it.type, it.id) : '') || '💎',
          name: it.name, cnt: have,
          q: 1, noStar: true,
          title: it.name + '（' + tplName + '）',
          lore: '持有 ' + U.numText(have, 0) + (it.price ? '　估值 ' + U.fmt(it.price * 100) + ' 旧币' : ''),
          attr: (GAME.itemEffect(it) || '') +
            (route.direct ? '　（点击使用 1 个 · 右键批量）' : ('　↳ ' + (route.hint || '需在对应界面使用'))) +
            (GAME.systems.consignPriceOf && GAME.systems.consignPriceOf(it.id) > 0
              ? '　·　可寄售（右下角「售」）' : ''),
          key: it.id,
          /* v91.72（老板）：「商品的出售建议直接放在背包物品的右下角」——
             与装备格同一个「售」角标，动作走寄售确认（item-sell-ask）。 */
          sellKey: (GAME.systems.consignPriceOf && GAME.systems.consignPriceOf(it.id) > 0) ? it.id : null,
          sellAct: 'item-sell-ask',
        };
        if (route.direct) { cell.act = 'use-bag-item'; cell.bulk = 1; }   /* v89.141：右键 = 批量小窗 */
        else if (route.act) { cell.act = route.act; }
        /* v89.179c：`main.js case 'bag-go'` 读 `el.dataset.msg` 提示"该去哪用" ——
           模板此前**没发**这个属性（全仓无 data-msg 发射）→ 永远只说通用兜底话术（死读）。
           这里补上，与格子里已显示的 `route.hint` 同源。 */
        else { cell.act = 'bag-go'; cell.view = route.view; cell.msg = route.hint || '需在对应界面使用'; }
        segCells.push(ui.bagCell(cell));
      });
      /* v89.143：每个类型**一段**（标题 + .bag-grid 7 列）—— 与材料 / 图纸页同构 */
      rows = rows.concat(ui.bagRows(
        '<div class="bag-sec">' + U.escape((CN[tp] || tp).replace(/（.*/, '')) +
        ' <span class="n">' + segCells.length + ' 种</span></div>', tp, segCells));
    });
    if (!any) return '<div class="q-empty">此类暂无宝物 —— 换一个分类看看。</div>';
    /* v89.104（老板）：「背包里的宝物界面**不要设置英雄清单**」——
       原来那排"使用对象"英雄 chips 整段撤除：需要对象的道具在背包里**不给使用按钮**，
       改给"去英雄面板"的指路（见 ITEM_USE_ROUTE）；无对象道具就地使用。
       于是背包页不再替玩家挑人，也不会再把道具静默发给第一位英雄。 */
    ui._itemGen = ui._itemGen || (s.generals[0] ? s.generals[0].id : '');
    /* v89.143（老板 1）：改走 `pageBag`（.bag-grid **7 列**，每页 28 = 4×7）——
       改前走 `pageRows`（4 列的 .shop-rows），是"宝物页不是 7 列"的病根所在。
       分页 key 带二级分类（换分类回第 1 页，不会停在越界页码上）。 */
    return ui.pageBag('bag-item-' + (onlyType || ui.bagSubNorm(ui._bagSub)), rows);
  };

  /* v89.141（老板 0 · 按建议执行）：「宝物整叠使用」——
     单击仍 = 使用 1 个（v89.140 既定交互不变）；**右键**（contextmenu，见 main.js 委托）
     打开本窗 → 一次用 N 个（「最多」= 全部用完）。
     出口复用 GAME.doBagUse：≥2 走 useItemMany（与旧"数量框"时代同一出口，不另立规则）。 */
  ui.openBulkUse = function (itemId) {
    var s = GAME.state, have = (s.items || {})[itemId] || 0;
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) it = x; });
    if (!it) { ui.toast('无此物品'); return; }
    if (have <= 0) { ui.toast('数量为 0，无法使用'); return; }
    var route = ui.itemRouteOf(it);
    if (!route.direct) { ui.toast(route.hint || '该物品需在对应界面使用'); return; }
    ui.openShell({
      title: '批量使用 · ' + U.escape(it.name),
      sub: '持有 ×' + have + '　（单击 = 用 1 个 · 右键 = 本窗）',
      size: 'sm',
      body: '<div class="attr"><span class="k">效果</span><span class="v good">' +
          U.escape(GAME.itemEffect(it) || '—') + '</span></div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-row">' +
          ui.qtyInput('bulk-q', 1, 0, have) +
          '<span class="op-hint">用几个就生效几次（「最多」= 全部用完）</span>' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="bulk-use-do" data-key="' + itemId + '">使用</button>' +
        '</div>',
    });
  };

  ui.matCell = function (m, have, dim, sort) {
    return ui.bagCell({
      cls: 'q' + m.tier + (have > 0 ? '' : ' dim'),
      ico: GAME.icons.forMat ? GAME.icons.forMat(m.id) : '🪨',
      name: m.name, cnt: have > 0 ? have : '',
      q: m.tier, noStar: true,
      title: m.name + '（' + m.seriesName + ' · 第' + m.tier + '品）',
      lore: have > 0 ? ('持有 ' + have + '　单价 ' + U.fmt(m.price * 100) + '旧币') : '尚未获得',
      attr: m.desc + '　' + ui.matUseText(m),
      act: 'open-mat-detail', key: m.id,
    });
  };

  ui.matUseText = function (m) {
    var slots = [];
    for (var sl in DATA.FORGE.matBySlot) {
      if (DATA.FORGE.matBySlot[sl].indexOf(m.series) >= 0) slots.push(DATA.EQUIP_SLOT_NAMES[sl] || sl);
    }
    return slots.length ? ('用于：' + slots.join('、')) : '';
  };

  /* ---------- 排序比较器 ---------- */
  ui.bagCmp = function (tab, sort, x, y) {
    if (tab === 'equip') {
      var A = DATA.EQUIP[x], B = DATA.EQUIP[y];
      if (sort === 'q') return (B.q - A.q) || (GAME.itemValue(y) - GAME.itemValue(x));
      if (sort === 'val') return GAME.itemValue(y) - GAME.itemValue(x);
      if (sort === 'set') return (A.set ? 0 : 1) - (B.set ? 0 : 1) || (B.q - A.q);
      if (sort === 'slot') return EQUIP_SLOT_ORDER.indexOf(A.slot) - EQUIP_SLOT_ORDER.indexOf(B.slot) || (B.q - A.q);
    }
    return 0;
  };

  /* 背包格子（含悬停浮层）。o.noStar 时不显示品质星（材料/宝物用色阶表示） */
  ui.bagCell = function (o) {
    /* v89.140：补 `data-view`（"指路类"用品的格子 → bag-go 需要目标视图）
       v89.179c：补 `data-msg`（bag-go 的提示话术 —— 模板不发、handler 却读，属死读）。 */
    var actAttr = (o.act ? ' data-action="' + o.act + '" data-key="' + o.key + '"' + (o.view ? ' data-view="' + o.view + '"' : '') + (o.msg ? ' data-msg="' + U.escape(o.msg) + '"' : '') : ' data-action="bag-detail" data-key="' + o.key + '"') + (o.gen ? ' data-gen="' + o.gen + '"' : '') + (o.bulk ? ' data-bulk="1"' : '');
    return '<div class="bag-cell ' + (o.cls || '') + '"' + actAttr + ' data-tip-el="1">' +
      (!o.noStar && o.q ? '<span class="bag-q">' + '★'.repeat(Math.min(4, o.q)) + '</span>' : '') +
      (o.cnt ? '<span class="bag-cnt">×' + o.cnt + '</span>' : '') +
      (o.worn ? '<span class="bag-worn" title="' + U.escape(o.worn) + ' 着">' + U.escape(o.worn) + '</span>' : '') +
      /* v90.55（老板）：可售件（背包中未穿戴）→ 角上「售」按钮（自带 data-action，点击优先于格子动作）。 */
      (o.sellKey != null ? '<span class="bag-sell" data-action="' + (o.sellAct || 'sell-equip-ask') +
        '" data-key="' + o.sellKey + '" title="出售换旧币">售</span>' : '') +
      '<span class="bag-ico">' + o.ico + '</span>' +
      '<span class="bag-name">' + U.escape(o.name) + '</span>' +
      '<div class="bag-tip"><div class="tip-t">' + U.escape(o.title) + '</div>' +
        '<div class="tip-l">' + U.escape(o.lore || '') + '</div>' +
        /* v89.214（老板 1）：属性分行浮层 —— 装备类调用方传 attrHTML（结构化分行、
           白值 + 彩色增量）；其余（材料等）保持原来的单行 attr（转义文本）。 */
        (o.attrHTML ? o.attrHTML : (o.attr ? '<div class="tip-a">' + U.escape(o.attr) + '</div>' : '')) +
      (o.noteHTML || '') + '</div>' +
      '</div>';
  };

  /* 装备详情（点背包格子）—— v79：**单件视角**。
     ref 可以是 件号（实例）/ 装备 id（旧入口兼容，取第一件）。 */
  ui.openEquipDetail = function (ref) {
    var inst = GAME.eqFind(ref);
    var itemId = inst ? GAME.eqId(inst) : ref;
    var it = DATA.EQUIP[itemId];
    if (!it) { ui.toast('无此装备'); return; }
    var lv = GAME.eqEnhOf(inst), sn = inst ? GAME.eqSerial(inst) : '';
    /* v89.214（老板 1）：显示名不再缀 ·甲/·乙 —— 序号只在本面板的「持有」行以
       「同名第 N / M 件」呈现（内部编号进详情、不进名称行）。 */
    var label = it.name + (lv ? ' +' + lv : '');
    var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : null;
    var html = '<div class="gold-heading">' + U.escape(label) + (setNm ? ' · ' + setNm : '') + '</div>';
    html += '<div class="attr"><span class="k">部位</span><span class="v">' + (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + '</span></div>';
    html += '<div class="attr"><span class="k">品质</span><span class="v">' + (DATA.Q_NAME[it.q] || "") + ' ' + '★'.repeat(it.q) + '</span></div>';
    /* v79：熔铸等级**按件** —— 这一件自己升到几级就显示几级
       v89.214：基因强化件这一行叫「调校」（同一字段 enh，语义按套分流） */
    if (lv) {
      html += '<div class="attr"><span class="k">' + (it.ling ? '调校' : '熔铸') + '</span><span class="v good">+' + lv +
        '（装备属性 +' + Math.round((it.ling ? (GAME.lingTemperMulOf(lv) - 1) : (lv * ((DATA.ENHANCE || {}).perLv || 0.08))) * 100) + '%，仅此件）</span></div>';
    }
    /* v89.214（老板 1）：属性**分行** —— 原始值白、增强增量按来源着色（与悬停同源） */
    html += '<div class="attr"><span class="k">属性</span><span class="v">' + ui.equipStatsHTML(inst || { id: itemId }) + '</span></div>';
    if (setNm) {
      var sd = DATA.SETS[it.set];
      var lines = [];
      for (var k in sd.bonus) lines.push(k + ' 件：' + sd.bonus[k]);
      html += '<div class="note">套装加成（穿齐件数生效）<br>' + lines.join('<br>') + '</div>';
    }
    html += '<div class="attr"><span class="k">估值</span><span class="v">' + U.fmt(GAME.itemValue(itemId)) + ' 旧币</span></div>';
    var s = GAME.state, inv = s.inventory || [];
    var group = GAME.eqGroupOf(itemId);
    var inInv = inst ? (inv.indexOf(inst) >= 0) : false;
    var wornBy = null;
    s.generals.forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套都查 */
        for (var sl in (g[bk] || {})) {
          var v = g[bk][sl];
          var hit = inst ? (v === inst) : (GAME.eqId(v) === itemId);
          if (hit) wornBy = wornBy || g.name;
        }
      });
    });
    var gIdx = '';
    if (sn && group.length > 1) {
      var gi = inst ? GAME.eqSerialNo(inst) : 0;
      gIdx = '（同名第 ' + gi + ' / ' + group.length + ' 件）';
    }
    html += '<div class="attr"><span class="k">持有</span><span class="v">' + group.length + ' 件' + gIdx +
      (wornBy ? '（' + U.escape(wornBy) + ' 已穿）' : '') + '</span></div>';
    /* v78（老板需求 3）：「装备不要『穿给谁』这种」—— 名单式穿戴整块撤除；
       穿戴统一在**英雄侧**完成：英雄档案点部位换装（openEqSlot），或「装备」页选将后点装备。 */
    html += '<div class="note" style="margin-top:8px;">穿戴：到「英雄」面板点对应部位换装（或「装备」页选将后点装备）。</div>';
    if (inInv) {
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : itemId;
      var mats = GAME.forgeMaterials(itemId), mtx = [];
      for (var mk in mats) {
        mtx.push((DATA.MATERIAL_BY_ID[mk] ? DATA.MATERIAL_BY_ID[mk].name : mk)
          + '×' + Math.max(1, Math.floor(mats[mk] * (DATA.FORGE.salvageRate || 0.4))));
      }
      html += '<div class="note" style="margin-top:12px;">拆解可回收 40% 打造材料：' + mtx.join('、') + '<br>'
        + '出售可换旧币 <b>' + U.fmt(GAME.equipSellPrice(itemId)) + '</b>（估值 60%）。</div>';
      html += '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn sm gold" data-action="open-enhance" style="margin-right:6px;">⚒ 前往制造厂强化</button>' +
        /* v89.110：拆解 = 销毁该件（不可逆）—— 改走二次确认（ui.openSalvageConfirm）。 */
        '<button class="btn red" data-action="salvage-equip-ask" data-key="' + key + '">拆解回收</button>' +
        /* v90.55（老板）：出售装备换旧币（二次确认 ui.openSellConfirm）。 */
        '<button class="btn" style="margin-left:6px;" data-action="sell-equip-ask" data-key="' + key + '">出售</button></div>';
    } else if (inst) {
      html += '<div class="note">此件正穿在 ' + U.escape(wornBy || '英雄') + ' 身上。可在「英雄」面板卸下（强化等级随件保留）。</div>';
    } else {
      html += '<div class="note">尚未拥有此装备（先打造或缴获）。</div>';
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 材料详情 */
  ui.openMatDetail = function (mid) {
    var m = DATA.MATERIAL_BY_ID[mid];
    if (!m) { ui.toast('无此材料'); return; }
    var have = (GAME.state.items || {})[mid] || 0;
    var html = '<div class="gold-heading">' + GAME.icons.forMat(mid) + ' ' + m.name + '</div>';
    html += '<div class="attr"><span class="k">系列</span><span class="v" style="color:' + (DATA.MAT_SERIES_BY_ID[m.series] || {}).tone + ';">'
      + m.seriesName + ' 第' + m.tier + ' 品</span></div>';
    html += '<div class="attr"><span class="k">持有</span><span class="v good">' + have + '</span></div>';
    html += '<div class="attr"><span class="k">游商价</span><span class="v">' + U.fmt(m.price * 100) + ' 旧币 / 个</span></div>';
    html += '<div class="note">' + U.escape(m.desc) + '</div>';
    var slots = [];
    for (var sl in DATA.FORGE.matBySlot) {
      if (DATA.FORGE.matBySlot[sl].indexOf(m.series) >= 0) slots.push(DATA.EQUIP_SLOT_NAMES[sl] || sl);
    }
    html += '<div class="note">用于打造：' + (slots.join('、') || '—') + '<br>用量：'
      + ['1', '2', '3', '4'].map(function (q) {
        return DATA.Q_NAME[q] + ' ' + (DATA.FORGE.qtyByQ[q][DATA.FORGE.matBySlot.weapon.indexOf(m.series)] || DATA.FORGE.qtyByQ[q][0]);
      }).join(' · ') + '（视部位而定）</div>';
    html += '<div class="note">来源：' + ui.matSourceText(m) + '</div>';
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 材料来源文案 */
  ui.matSourceText = function (m) {
    var out = [];
    for (var t in DATA.WILD_MATERIAL) {
      if (DATA.WILD_MATERIAL[t][m.id]) out.push((DATA.TERRAIN[t] ? DATA.TERRAIN[t].name : t) + '野地');
    }
    var cityName = { fort: '野外城市', county: '聚落', jun: '重镇', zhou: '首府', capital: '旧都' };
    for (var ct in DATA.CITY_MATERIAL) {
      if (DATA.CITY_MATERIAL[ct][m.id]) out.push(cityName[ct] || ct);
    }
    /* v14 辖区特产：占该辖区内城市可获持续岁贡（高阶材料的主要长期来源） */
    var spStates = [];
    for (var st in DATA.STATE_SPECIALTY) {
      if (DATA.STATE_SPECIALTY[st].mat === m.id) spStates.push(st);
    }
    if (spStates.length) out.push(spStates.join('/') + '岁贡');
    return out.length ? out.join(' · ') : '游商购买';
  };

  /* 该材料的辖区特产归属（打造面板用：告诉玩家缺料去哪儿打） */
  ui.matSpecialtyStates = function (matId) {
    var out = [];
    for (var st in (DATA.STATE_SPECIALTY || {})) {
      if (DATA.STATE_SPECIALTY[st].mat === matId) out.push(st);
    }
    return out;
  };
  /* v89.89（A4）：材料产地跳转目标 —— 已据该区 → 自己的城；未据 → 首府（NPC 首府）。
     首府被占后不在 NPC 列表里，但从自己的城（同区）找得到。返回 null = 无产地记录。 */
  ui.matGoTargetOf = function (matId) {
    var states = ui.matSpecialtyStates(matId);
    if (!states.length) return null;
    var st0 = states[0];
    var mine = (GAME.state.cities || []);
    for (var j = 0; j < mine.length; j++) {
      if (mine[j].state === st0) {
        return { x: mine[j].x, y: mine[j].y, name: mine[j].name, state: st0, owned: true };
      }
    }
    /* 首府 = 首府（zhou）或旧都（capital —— 烬环的首府是灰烬城）；
       两者都不在（已被占 / 无记录）→ 退到该区任何 NPC 城（重镇 / 聚落）。 */
    var list = ((GAME.state.map || {}).cities || []).filter(function (x) { return x.state === st0; });
    if (!list.length) return null;
    var rank = { zhou: 0, capital: 1, jun: 2, county: 3 };
    list.sort(function (a, b) {
      return (rank[a.type] == null ? 9 : rank[a.type]) - (rank[b.type] == null ? 9 : rank[b.type]);
    });
    var best = list[0];
    return { x: best.x, y: best.y, name: best.name, state: st0, owned: false };
  };

  /* 图纸详情 */
  ui.openBpDetail = function (bid) {
    var b = null;
    (DATA.BLUEPRINTS || []).forEach(function (x) { if (x.id === bid) b = x; });
    if (!b) { ui.toast('无此图纸'); return; }
    var have = (GAME.state.items || {})[bid] || 0;
    var html = '<div class="gold-heading">📜 ' + b.name + '</div>';
    html += '<div class="attr"><span class="k">持有</span><span class="v good">' + have + '</span></div>';
    html += '<div class="attr"><span class="k">用途</span><span class="v">解锁该套装的打造资格</span></div>';
    html += '<div class="note">' + U.escape(b.desc || '') + '</div>';
    html += '<div class="note">来源：游商购买 · 攻占名城缴获（重镇 18% / 首府 40% / 旧都 80%）· 遗迹古冢<br>打造套装件<b>每件消耗图纸 1 张</b>（游商可购，亦可持续缴获）。</div>';
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 宝物详情 */
  ui.openItemDetail = function (itemId) {
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) it = x; });
    if (!it) { ui.toast('无此宝物'); return; }
    var html = '<div class="gold-heading">' + GAME.itemIcon(it) + ' ' + it.name + '</div>';
    html += '<div class="attr"><span class="k">类别</span><span class="v">' + (it.type || '') + '</span></div>';
    if (it.price) {
      html += '<div class="attr"><span class="k">游商价</span><span class="v">' + U.fmt(it.price * 100) + ' 旧币</span></div>';
    }
    html += '<div class="note">' + U.escape(GAME.itemEffect(it) || '无特别效果') + '</div>';
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 宝物图标（按类型） */
  GAME.itemIcon = function (it) {
    var m = {
      jewel: { zhenzhu: '🫧', shanhu: '🪸', liuli: '🔮', hupo: '🟠', manao: '🔴', shuijing: '💎', feicui: '🟢', yushi: '⚪', yemingzhu: '🌟' },
      blueprint: '📜', prod_buff: '🌾', military_buff: '🎖️', boost: '⚡',
      exp: '📗', stamina: '🧪', perm: '💊', mount_buff: '🐎', attr_buff: '🔯',
      rank_up: '🌿',
      /* v89.51：补六类此前落 💠 兜底的（宝箱/残卷/政令/封存匣/辐能核心/营造） */
      chest: '📦', neigong: '📕', corvee: '📋', talis: '🎴', essence: '✨', build_cost: '📐',
    };
    if (it.type === 'jewel') return (m.jewel && m.jewel[it.id]) || '💠';
    return (m[it.type] && typeof m[it.type] === 'string') ? m[it.type] : '💠';
  };
  /* 宝物效果文案 —— **唯一出口**（物品行、悬停浮层、详情弹窗都读它）
     ⚠️ v51 修重复（老板：「物品备注信息是重复了的」）：
       改前这里会拼三段 `赏赐忠诚 +N` ＋ `it.desc` ＋ `游商价 N旧币`，
       而调用点又自己拼了一遍 `it.desc` —— 于是同一段说明在卡片里出现**三遍**：
         「赏赐忠诚 +5（威望晋升亦需）」
         「赏赐忠诚 +5　赏赐忠诚 +5（威望晋升亦需）　游商价 200旧币」
       根因是**同一个概念有两个出口**（数据里的 desc 与这里重新拼的文案）。
       现在收敛：效果文案 = `it.desc`（数据里已写全，含数值与时长），
       价格由 meta 显示（游商「单价」/ 背包「估值」），忠诚数值也在 desc 里，一律不再重复。 */
  GAME.itemEffect = function (it) {
    if (!it) return '';
    return it.desc || '';
  };

  /* ⛔ v90.97（老板）：君主左侧「城市/据点/野地 三清单」整条退役 —— 内容移入**行政菜单**
     （星球→城市分级树 + 只读总览）。`GAME.empireItems` / `ui._estListHTML` 一并删除。
     对应的动作 `lord-city-enter / lord-wild-go / lord-fort-go` 已无 UI 出处（保留 case 不碍事，见 main.js）。 */

  /* 君主信息弹窗（原版「君主」按钮） */
    ui.openLordInfo = function () {
    var s = GAME.state;
    var totalPop = GAME.totalPopCap();   /* v60：全境幸存者上限（唯一出口） */
    var popNow = GAME.totalPop();
    /* v89.188（老板 3）：「（英雄 N）」计数撤下（所有英雄标识统一）——heroCount 随之清零 */
    var cur = GAME.systems.rankInfo(s.rank);
    var next = GAME.systems.nextRank();
    var chk = next ? GAME.systems.canPromote() : null;
    var curCity = GAME.currentCity() || {};
    /* 晋升条件整句（悬停用）——「现有 / 所需」都带上，鼠标一放一目了然 */
    var condTitle = '已登顶「废土之王」';
    if (next) {
      var jewParts = Object.keys(next.jewel || {}).map(function (j) {
        var it = null;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === j) it = x; });
        return (it ? it.name : j) + ' ' + ((s.items && s.items[j]) || 0) + '/' + next.jewel[j];
      });
      condTitle = '晋升「' + next.name + '」条件：声望 ' + U.fmt(s.rep) + '/' + U.fmt(next.rep)
        + '　城市 ' + (GAME.empireCityCount ? GAME.empireCityCount() : s.cities.length) + '/' + cur.city   /* v91.22：帝国口径 */
        + '　星球 ' + (GAME.planetsOwnedCount ? GAME.planetsOwnedCount() : 1) + '/' + (cur.planet || 1)
        + '　旧币 ' + U.fmt(s.res.gold || 0) + '/' + U.fmt(next.gold)
        + (jewParts.length ? '　珠宝 ' + jewParts.join('、') : '')
        + (chk && !chk.ok ? '（' + chk.msg + '）' : '（条件已满足）');
    }
    var lg = GAME.lordGeneralOf();
    var salaryTotal = GAME.genSalaryTotal ? GAME.genSalaryTotal() : 0;
    /* v77（老板）：「君主界面分左右两半：左边城市列表（加进入按钮），右边两列信息表
       （姓名+改名 / 威望+晋升（悬停见条件）/ 声望 / 幸存者总和 / 英雄总和 / 状态）」。
       旧版（单列 + chips + 城市表 + rankBlock）整段退役；威望区块并入右表。 */
    ui.openShell({
      /* v91.57（老板）：君主前的图标去掉；界面收窄（xl → lg）。 */
      title: '君主',
      sub: (cur ? cur.name : '幸存者') + ' · 声望 ' + U.fmt(s.rep) + ' · ' + (GAME.empireCityCount ? GAME.empireCityCount() : s.cities.length) + ' 城（帝国）',
      size: 'lg',
      /* v91.57（老板）：「下方信息栏，各种按钮放在每行右侧」——三列表（键 | 值 | 操作右贴）。 */
      body: '<div class="ls-right"><div class="m-sec">君主信息</div>' +
        '<table class="tbl lord-tbl"><tbody>' +
        (function () {
          var R = function (k, v, act) { return '<tr><td class="k">' + k + '</td><td>' + v + '</td><td class="act">' + (act || '') + '</td></tr>'; };
          var rows = '';
          rows += R('君主姓名', '<b>' + U.escape(s.ruler.name) + '</b>', '<button class="btn sm" data-action="open-rename-lord">改名</button>');
          rows += R('头像', (function () {
            var face = GAME.portraits ? GAME.portraits.poolFile({ gender: s.ruler.gender, portraitSeed: s.ruler.portraitSeed }) : '';
            return (face ? '<img class="lord-av-mini" src="' + face + '" alt="君主头像">' : '');
          })(), '<button class="btn sm" data-action="open-avatar-pick">更换</button>');
          rows += R('威望', (cur ? cur.name : '幸存者') + ' <span class="ui-sub">（' + (s.rank || 0) + ' / ' + (DATA.RANK.length - 1) + '）</span>',
            next ? '<button class="btn sm' + (chk && chk.ok ? ' gold' : '') + '" data-action="lord-promote" title="' + U.escape(condTitle) + '">晋升：' + next.name + '</button>' : '<span style="color:var(--gold-light);">已登顶</span>');
          /* v91.57（老板）：威望作用**逐条列出**（控城数 / 建造等级上限 / 各项加成）。 */
          rows += R('威望作用', '<span style="color:var(--green-ok);">' + GAME.rankBonusText() + '</span>', '');
          rows += R('节钺', (DATA.JIEYUE || {}).icon + ' ×<b>' + GAME.jieyueOf() + '</b> <span class="ui-sub">（攻占名城 / 威望每 ' + ((DATA.JIEYUE || {}).rankEvery || 4) + ' 档 +1）</span>',
            '<button class="btn sm" data-action="open-jieyue">查看用途</button>');
          rows += R('主城', (function () { var mc = GAME.mainCityOf(); return mc ? ('🏯 ' + U.escape(mc.name) + ' <span class="ui-sub">（驻跸加成中）</span>') : '<span class="ui-sub">未设 —— 到目标城的政务厅点「设为主城」</span>'; })(), '');
          rows += R('神器', '供奉 ' + U.fmt(GAME.artPts()) + '　' + (DATA.ARTIFACTS || []).map(function (a) { return a.icon + a.name.slice(0, 2) + ' Lv' + GAME.artLevelOf(a.id); }).join(' · '),
            '<button class="btn sm gold" data-action="open-artifacts">查看</button>');
          rows += R('声望', '<span style="color:var(--green-ok);">' + U.fmt(s.rep) + '</span>', '');
          rows += R('幸存者总和', U.fmt(popNow) + ' / ' + U.fmt(totalPop), '');
          rows += R('英雄总和', '' + s.generals.length, '');
          rows += R('月俸支出', U.fmt(salaryTotal) + ' 旧币 / 7 游戏日 <span class="ui-sub">（月俸结算时从各城府库扣除）</span>', '');
          if (lg) rows += R('君主领兵', 'Lv' + lg.level + ' / ' + GAME.genLevelCap(lg) + ' · ' + ui.genStatusName(lg) + '（不可解雇）', '');
          rows += R('状态', '正常', '');
          return rows;
        })() +
        '</tbody></table>' +
        '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

    /* ============================================================
   * 神器面板（v79 · 老板「神器加成（养成，主要依靠游戏时长和特殊活动逐渐提升），
   * 神器界面在君主菜单中」）
   * ------------------------------------------------------------
   * 三件神器**共用一池供奉值**（s.artifacts.pts）：
   *   · 游戏时长（主要）—— 主循环与离线补算各推一次（GAME.artTick）
   *   · 特殊活动（加速）—— 攻占城市 / 威望晋升大额入账（GAME.artGain）
   * 等级 = 供奉值翻过的门槛数（DATA.ARTIFACT.pts）；加成走 GAME.artifactBonusNum。
   * ============================================================ */
  ui.openArtifacts = function () {
    var pts = GAME.artPts();
    var A = DATA.ARTIFACT || {};
    var maxLv = A.maxLv || 10;
    var lv = GAME.artLevelOf();
    var next = lv < maxLv ? (A.pts || [])[lv] : null;
    var pct = next ? Math.min(100, Math.floor(pts / next * 100)) : 100;
    var rows = (DATA.ARTIFACTS || []).map(function (a) {
      var l = GAME.artLevelOf(a.id);
      return '<div class="art-row">' +
        '<div class="art-ic">' + a.icon + '</div>' +
        '<div class="art-main">' +
          '<div class="art-nm">' + U.escape(a.name) + ' <span class="art-lv">Lv' + l + '</span>' +
            ' <span class="ui-sub">' + U.escape(a.theme || '') + '</span></div>' +
          '<div class="ui-sub">' + U.escape(a.desc || '') + '</div>' +
          '<div class="ui-sub" style="color:var(--gold-light);">现效力：' + GAME.artEffText(a, l) + '</div>' +
        '</div>' +
        '<div class="art-side">满级 Lv' + maxLv + '</div>' +
        '</div>';
    }).join('');
    var srcLine = '供奉来源：游戏时长 +' + (A.perGameHour || 0) + '/游戏小时（主）　·　攻占城市 '
      + '（聚落 ' + ((A.capturePts || {}).county || 0) + ' / 重镇 ' + ((A.capturePts || {}).jun || 0)
      + ' / 首府 ' + ((A.capturePts || {}).zhou || 0) + ' / 旧都 ' + ((A.capturePts || {}).capital || 0)
      + '）　·　威望晋升 +' + (A.promotePts || 0);
    ui.openModal('<div class="gold-heading">🏺 神器 · 供奉值 ' + U.fmt(pts) + '</div>' +
      '<div class="ui-sub" style="text-align:center;">' + srcLine + '</div>' +
      '<div class="pbar" style="margin:8px 0 2px;"><i style="width:' + pct + '%;"></i></div>' +
      '<div class="ui-sub" style="text-align:center;">' +
        (next ? ('距 Lv' + (lv + 1) + '：' + U.fmt(pts) + ' / ' + U.fmt(next)) : '已至最高 Lv' + lv) +
      '</div>' +
      rows +
      '<div class="note">三件神器共用一池供奉值，随游戏时间自动积累（离线同口径），攻占城市与威望晋升可大额加速。</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.165：供奉值随游戏时间累积（3 点/游戏小时）—— 接入 live 每秒重开，
         总量与进度条随秒推进（120× 下约每 10 秒 +1 点，肉眼可见）。 */
      { size: 'xl', live: function () { ui.openArtifacts(); } });
  };

  /* ============================================================
   * 头像更换面板（v89.7 · 老板「头像可更换」）
   * ------------------------------------------------------------
   * 与创建界面 / 麾下英雄同一套头像池（assets/portraits/pool；v90 池换代后按性别 m 66 / f 25 张）。
   * 点选即换：改的是唯一事实源 `s.ruler.portraitSeed`（GAME.setLordAvatar）——
   * 顶栏立绘、君主面板预览、英雄页的脸全部同源生效。
   * 「完成」回君主面板（与改名同一套流程：动作后回到原面板）。
   * ============================================================ */
  ui.openAvatarPick = function () {
    var s = GAME.state;
    var gender = (s.ruler && s.ruler.gender === 'female') ? 'f' : 'm';
    var pool = (GAME.portraits && GAME.portraits.POOL && GAME.portraits.POOL[gender]) || [];
    var seed = (s.ruler && s.ruler.portraitSeed) || 0;
    var cur = pool.length ? (seed % pool.length) : 0;
    var body;
    if (!pool.length) {
      body = '<div class="q-empty">头像池不可用（assets/portraits/pool 缺失）。</div>';
    } else {
      body = '<div class="ui-sub" style="text-align:center;">共 ' + pool.length +
          ' 张 · 与麾下英雄同一套画师　—— 点一张即换，换错再点一张就行。</div>' +
        '<div class="av-grid">' +
        pool.map(function (file, i) {
          return '<div class="av-cell' + (i === cur ? ' cur' : '') +
            '" data-action="pick-lord-avatar" data-idx="' + i + '" title="第 ' + (i + 1) + ' 张">' +
            '<img src="' + GAME.portraits.DIR + 'pool/' + file + '" alt="头像 ' + (i + 1) + '"></div>';
        }).join('') +
        '</div>';
    }
    var sh = ui.modalShell({
      title: '👤 更换头像', sub: '点选即换 · 随档保存',
      body: body, size: 'md',
      foot: '<div class="m-foot"><button class="btn" data-action="close-avatar-pick">完成</button></div>'
    });
    /* noClose：底部由本面板自管（「完成」要回君主面板，不是单纯关窗） */
    ui.openModal(sh.html, { size: 'md', noClose: true });
  };

    /* ============================================================
   * v89.138（老板 3）：「如果提速后完成了募兵，剩余时长为 0，则应**自动关闭**提速小弹窗」——
   * 判据：该营（或作坊）的"正在执行"队列已无剩余（`trainRushRemain ≤ 0`）
   *   或干脆已没有在办队列。完成 → 关窗；没完成 → 留在面板里（剩余变短看得见）。
   * ============================================================ */
  ui.queueDone138 = function (bIdx) {
    var c = GAME.currentCity();
    if (!c) return true;
    var kinds = ['train', 'craft'];
    for (var i = 0; i < kinds.length; i++) {
      var run = GAME.trainRunningOf(c.id, bIdx, kinds[i]);
      if (run && GAME.trainRushRemain(run) > 0) return false;
    }
    return true;
  };

  /* ============================================================
   * 募兵提速（v28 起 · v89.49 改双路）
   * ------------------------------------------------------------
   * v28 原设计：列出背包里 target=train 的宝物，点一下加速。
   * **v89.49 病根**（老板「募兵队列怎么不可加速了？」）：
   *   只有宝物一条路 —— 背包没有操典残页/点兵术时，队列里的「加速」是 disabled，
   *   玩家看到的直接是"不可加速"（灰按钮，点了没反应）。
   * 现在面板分两段：
   *   ① 💰 花旧币买时间（永远可用，三档，价随"还能缩短多少"浮动）
   *   ② 🎁 宝物加速（有则列出，没有则说明去哪买）
   * 计价与结算全部读 GAME.trainRush* 出口，界面不自己算。
   * ============================================================ */
  ui.openTrainBoost = function (bIdx) {
    var c = GAME.currentCity();
    var bar = null;
    GAME.barracksOf(c).forEach(function (x) { if (x.idx === bIdx) bar = x; });
    var kind = 'train';
    if (!bar) {
      /* v89.49：也可能是机工坊（器械队列）—— 两套队列共用本面板 */
      GAME.craftWorkshopsOf(c).forEach(function (x) { if (x.idx === bIdx) { bar = x; kind = 'craft'; } });
    }
    if (!bar) { ui.toast('未找到该军营'); return; }
    var label = kind === 'craft' ? '精密制造厂' : '军营';
    var run = GAME.trainRunningOf(c.id, bIdx, kind);
    var head = '<div class="gold-heading">⚡ 提速 · 城内第 ' + (bIdx + 1) + ' 格' + label + '</div>';
    /* v89.49：队列刚好走完、还没被主循环扫走时（remain = 0）也按空态显示 ——
       否则三档都会报「0 旧币」，点了回一句"已完工"，很难看。 */
    if (!run || GAME.trainRushRemain(run) <= 0) {
      ui.openModal(head + '<div class="q-empty">本' + (kind === 'craft' ? '作坊' : '营') +
        '当前没有进行中的' + (kind === 'craft' ? '制造' : '募兵') + '任务</div>' +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
      return;
    }
    var t = DATA.TROOPS[run.troopId] || {};
    var left = Math.max(0, (run.totalTime - (run.elapsed || 0)) / GAME.timeScale());
    var pctDone = Math.min(100, Math.floor((run.elapsed || 0) / run.totalTime * 100));
    /* ---- ① 花旧币买时间 ---- */
    var steps = GAME.trainRushCfg().steps || [];
    var goldBtn = steps.map(function (st) {
      var cost = GAME.trainRushCost(run, st.pct);
      var afford = (GAME.state.res.gold || 0) >= cost;
      return '<button class="btn sm' + (afford ? ' gold' : ' dim') + '" data-action="train-rush"'
        + ' data-pct="' + st.pct + '" data-idx="' + bIdx + '" data-kind="' + kind + '"'
        + ' title="花旧币缩短训练时间：需 ' + U.numText(cost, 0) + ' 旧币　·　持有 ' + U.numText(GAME.state.res.gold || 0, 0) + '"'
        + (afford ? '' : ' disabled data-why="旧币不足：需 ' + U.numText(cost, 0) + ' 旧币"') + '>' + st.label + '</button>';
    }).join('');
    /* ---- ② 宝物加速 ---- */
    var list = GAME.systems.trainBoostItems();
    var itemHtml = list.length
      ? '<div class="xc-list" style="margin-top:8px;">' + list.map(function (it) {
          var used = run.boost && run.boost[it.id];
          var dis = it.once && used;
          return '<div class="xc-row">' +
            '<div class="xc-ico">' + (GAME.icons.forItem ? GAME.icons.forItem(it.type, it.id) : '') + '</div>' +
            '<div class="xc-info"><b>' + U.escape(it.name) + ' ×' + (GAME.state.items[it.id] || 0) + '</b>' +
              '<span class="xc-prod">' + U.escape(it.desc || '') + '</span></div>' +
            '<button class="btn sm' + (dis ? ' dim' : ' gold') + '" data-action="do-train-boost" data-item="' + it.id +
              '" data-idx="' + bIdx + '"' + (dis ? ' disabled data-why="本队列本日已用过该加速（每队列限一次）"' : '') + '>' + (dis ? '已用过' : '加速') + '</button>' +
            '</div>';
        }).join('') +
        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm" data-action="qb-cat" data-cat="boost" data-scope="train">🛒 购买训练宝物</button></div>' + '</div>'
      : '<div class="q-empty" style="margin-top:8px;">背包里没有训练加速宝物 —— 可就地购买（见下）</div>' +
        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm gold" data-action="qb-cat" data-cat="boost" data-scope="train">🛒 购买训练宝物</button></div>';
    var body =
      '<div class="attr"><span class="k">进行中</span><span class="v">' +
        (t.name || run.troopId) + ' ×' + U.numText(run.count, 0) + '</span></div>' +
      '<div class="attr"><span class="k">剩余</span><span class="v good">' + U.durExact(left) + '</span></div>' +
      '<div class="attr"><span class="k">进度</span><span class="v">' + pctDone + '%</span></div>' +
      /* ⛔ v89.138（老板 3）：「已用宝物 hanxin_dianbing，这行不要，而且为啥是拼音」——
         该行显示的是**内部 id**（拼音），既是信息噪声又不像中文界面。
         宝物"用过没"已由宝物行自身的「已用过」禁用态表达（不需要第二处）。 */
      '<div class="op-zone" style="margin-top:10px;"><div class="op-zone-t">💰 花旧币买时间' +
        ui.help('价格 = 该批军资 ×20% × 还能缩短的比例\n' +
          '（军资 = 兵种单价 × 数量；越接近完工越便宜）\n' +
          '宝物加速更划算，但需游商购得、且受"每队列限 1 次"限制') + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' + goldBtn + '</div>' +
        '<div class="ui-sub" style="text-align:center;margin-top:6px;">现有旧币 ' +
          U.numText(GAME.state.res.gold || 0, 0) + '</div>' +
      '</div>' +
      '<div class="op-zone" style="margin-top:10px;"><div class="op-zone-t">🎁 宝物加速（更划算）</div>' +
        itemHtml + '</div>';
    ui.openShell({
      title: '', sub: '',
      size: 'md',
      body: head + body,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.165（老板：「查看所有类似实时读秒设置」）：本窗上文写着「剩余变短看得见」
         —— 但此前没接 live，读秒是静止的。现补上：逐秒重开（剩余/进度实时走）；
         队列走完（trainRushRemain ≤ 0）→ 自动关窗（v89.138 原意，覆盖"开着等自然完成"）。 */
      live: function () {
        if (ui.queueDone138(bIdx)) ui.closeModal();
        else ui.openTrainBoost(bIdx);
      }
    });
  };

  /* 资源显示名与图标（模块级共享：野地面板 / 采集面板等多处复用） */
  ui.RES_NAME = { grain: '水', wood: '生', stone: '电', iron: '钢', gold: '币' };   /* v89.229：随资源换代（净水/生物质/电能/废钢） */
  ui.RES_ICON = { grain: '💧', wood: '🌿', stone: '⚡', iron: '🔩', gold: '💰' };   /* v89.229：随资源换代 */

  /* v87「地形专属场景区块」-> v88.1 整合：
     ui.wildSceneHTML / ui.doWildScene / _wsGen / _wsResult 已全部删除 ——
     六地形场景并入下方「荒野行动区块」（ui.jianghuHTML，kind:'scene' 活动）。 */

  /* ============================================================
   * v88（老板「改造培养系统」）：荒野行动区块
   * ------------------------------------------------------------
   * 嵌在野地弹窗（openLandModal 未占/已占两分支）内、地形场景之下：
   *   活动菜单（每处**每活动**每日一次）+ 带队英雄 + 结果回显。
   * 逻辑出口 GAME.jianghuCheck / jianghuDo（state.js，唯一）。
   * ============================================================ */
  ui._jhGen = null;
  ui._jhResult = null;
  ui.jianghuHTML = function (ci) {
    if (!GAME.jianghuActsAt) return '';
    var jcell = (GAME.sphere && GAME.sphere.cells) ? GAME.sphere.cells[ci] : null;
    if (!jcell) return '';
    var acts = GAME.jianghuActsAt(ci);   /* v89.4：逐地分布（同格恒同貌） */
    /* v88.1：地形专属（scene）排最前 —— 本地的「招牌」 */
    acts.sort(function (p1, p2) {
      return ((p2.def.kind === 'scene') ? 1 : 0) - ((p1.def.kind === 'scene') ? 1 : 0);
    });
    var s = GAME.state;
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    var home = GAME.currentCity();
    /* v89：改造线君主专属 —— 荒野行动只由君主亲往（主角单修） */
    var own = (s.generals || []).filter(function (g) { return g.cityId === home.id && GAME.isLordGeneral(g); });
    if (!ui._jhGen || !own.some(function (g) { return g.id === ui._jhGen; })) {
      ui._jhGen = own[0] ? own[0].id : '';
    }
    var res = (ui._jhResult && ui._jhResult.ci === ci) ? ui._jhResult : null;
    /* v89.4：野地生态 —— 逐地随缘（荒僻 / 1~3 事）· 等级联动（难度 / 收益） */
    var lv4 = GAME.map.wildLevelNow(ci);
    var sp4 = DATA.JH_SPREAD || {};
    var lvN4 = 1 + lv4 * (sp4.lvNeed || 0), lvR4 = 1 + lv4 * (sp4.lvRew || 0);
    var h = '<div class="op-zone" style="margin-top:8px;">' +
      '<div class="op-zone-t">☯ 荒野行动　<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);">君主亲往 · 逐地随缘而生 · 看机能判定</span></div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">野地 Lv' + lv4 +
        ' · 难度 ×' + lvN4.toFixed(1) + ' · 收益 ×' + lvR4.toFixed(1) +
        '　—— 荒野诸事随缘而现，精华用于调校基因强化件</div>';
    /* ⛔ v90.80（老板「去除奇遇系统」）：探奇入口整条退役（奇遇 · 见闻录 · 见 smoke §80 退役记录）。 */
    if (res) {
      h += '<div class="note" style="margin:4px 0;color:' + (res.bad ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
        U.escape(res.name + '：' + res.text) + '</div>';
    }
    if (!acts.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0;">此处野地荒僻，暂无荒野之事 —— 野地之事随缘而现，换一处看看。</div>';
    } else if (!own.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);">君主不在此城 —— 荒野之事，需君主亲至。</div>';
    } else {
      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0;">' +
        '<label style="color:var(--text-dim);">君主亲往</label>' +
        '<input type="hidden" id="jh-gen" value="' + ui._jhGen + '">' +
        ui.genChips({ cls: 'gen-chips inline', target: 'jh-gen', value: ui._jhGen, list: own,
          sub: function (g) { return '精' + Math.round(g.energy || 0) + ' 体' + Math.round(GAME.staNow(g)) + ' 灵' + GAME.lingPowerOf(g); } }) +
        '</div>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
      acts.forEach(function (a) {
        var done = GAME.jianghuDone(s, ci, a.id, day);
        h += done
          ? '<span class="op-done" style="font-size:var(--fs-sub);padding:5px 8px;">' + a.def.icon + ' ' + a.def.name + '（今日已做）</span>'
          : '<button class="btn sm" data-action="do-jianghu" data-ci="' + ci + '" data-act="' + a.id + '"' +
              ' title="' + U.escape(a.def.desc || '') + '（点按钮走进场景，走到东西旁边动手）">' + a.def.icon + ' ' + a.def.name + '（精' + a.def.energy + ' · 体' + a.def.stam + '）</button>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  };
  /* v90.93（老板「去掉纪事剧本」中的「全屏剧本」）：
     活动按钮 → **一次性结算**（one-shot）。
     原「专属全屏交互 + 特定退出」的全屏剧本（#scene-fx：2~3 幕对话 /
     选择累计修正系数 / 场景画布与热点 / 时机条 / 专属结算屏）整条退役：
       · ui：_sceneFx / openSceneFx / renderSceneFx / closeSceneFx / sceneFxHTML /
         paintSceneFx / sxfBadges / sxfQuote / sxfOptIcon / SXF_KIND / SXF_ANCHORS /
         sxfStageMode / sxfTimingGrade / sxfTimingPos / sxfTimingStart /
         sxfTimingClear / sxfTimingStop（与 .sxf-* 样式族、#scene-fx 全屏层）；
       · 引擎：GAME.sceneFx / sceneBegin / sceneStart / scenePick / sceneEscape；
       · 数据：DATA.SCENE_FLOW；地图：GAME.map.paintScene / SCENE_KEYS。
     内核（jianghuCheck / jianghuSpend / jianghuRoll）原样保留 ——
     下面这段就是它原本就有的「无剧本兜底」出口。 */
  ui.doJianghu = function (ci, actId) {
    var gsel = document.getElementById('jh-gen');
    var gid = gsel ? gsel.value : ui._jhGen;
    if (gid) ui._jhGen = gid;
    var lg = GAME.lordGeneralOf();       /* v89：君主专属（闸门在 jianghuCheck，这里便于兜底） */
    if (lg && (!gid || gid !== lg.id)) gid = lg.id;
    /* v143（3D 化最后一公里）：正式阶段也走 3D 场景 —— 走进去、动手、才结算，
       不再"弹一行字"（那是 v90.93 去全屏剧本留下的后遗症）。
       场景内交互的结算出口与下面的 2D 兜底是**同一个**（GAME.jianghuDo），
       账不会有两本。门槛拒绝（今日无此事）toast 后即返回，不重复走 2D；
       场景打不开（无 WebGL 的老设备）才落 2D 一次性结算兜底。 */
    if (GAME.scene3d && GAME.scene3d.play) {
      var r3 = null;
      try {
        r3 = GAME.scene3d.play(actId, ci, { host: 'live', gen: gid, exitTo: 'land' });
      } catch (e) { r3 = null; }   /* 渲染层炸了 → 兜底，玩法必须还能玩 */
      if (r3 && r3.ok) return;
      if (r3 && r3.why === 'gate') { ui.toast(r3.msg); return; }
    }
    var r0 = GAME.jianghuDo(ci, gid, actId);
    if (!r0.ok) { ui.toast(r0.msg); return; }
    ui._jhResult = { ci: ci, name: r0.name, text: r0.text, bad: r0.bad };
    ui.toast('☯ ' + r0.name + (r0.text ? '（' + r0.text + '）' : ''));
    GAME.refreshAll();
    ui.openLandModalCi(ci);
  };
  /* ⛔ v90.80：ui.doWonder（探奇）随奇遇系统整条退役。 */
  /* ⛔ v90.80：ui.doWonder（探奇）随奇遇系统整条退役。 */

  /* ⛔ v90.80（老板「去除奇遇系统」）：见闻录面板（ui.openJournal / ui.journalHTML）随奇遇系统整条退役。 */

  /* ============================================================
   * v89.154（老板 3）：附属野地**显示排序**（唯一出口）
   * ------------------------------------------------------------
   * 老板原话：「附属野地界面，有采集的野地排序最上方，有驻军的接着，
   *   无驻军的野地按地形，等级（高到低）排序」。
   * 三档：① 采集中（gatherAt 非空）→ ② 有驻军（wildGarrisonTotal > 0）
   *       → ③ 其余：地形（DATA.TERRAIN 表序）→ 同地形按等级**降序**。
   * 读的两处（资源区下拉框 / 附属野地面板）**同用本出口** ——
   * ui._wildSel 是"显示序下标"，两处顺序不一致时「进入」高亮会指错行。
   * 只排显示副本（slice），不改 s.wilds 本身（占领先后是数据，显示序是视图）。
   * ============================================================ */
  ui.wildSortedOf = function (wilds) {
    var tOrder = {};
    Object.keys(DATA.TERRAIN).forEach(function (k, i) { tOrder[k] = i; });
    var prioOf = function (w) {
      if (GAME.gatherAt(w.ci)) return 0;                                   /* ① 采集中 */
      if (GAME.wildGarrisonTotal(GAME.wildGarrisonAt(w.ci)) > 0) return 1; /* ② 有驻军 */
      return 2;
    };
    /* 先算一次优先级（sort 比较函数会被调 O(n log n) 次，别在里面反复查表） */
    var list = (wilds || []).map(function (w) {
      return { w: w, p: prioOf(w) };
    });
    list.sort(function (a, b) {
      if (a.p !== b.p) return a.p - b.p;
      if (a.p === 2) {
        var ta = tOrder[a.w.type] == null ? 99 : tOrder[a.w.type];
        var tb = tOrder[b.w.type] == null ? 99 : tOrder[b.w.type];
        if (ta !== tb) return ta - tb;                       /* 地形（表序）为主键 */
        if ((b.w.level || 0) !== (a.w.level || 0)) return (b.w.level || 0) - (a.w.level || 0);
      }
      return 0;                                              /* 稳定：同档保持原序 */
    });
    return list.map(function (x) { return x.w; });
  };

  /* ============================================================
   * v89.155（老板 2）：野地「召回驻军」按钮的**唯一渲染出口**（三态）
   * ------------------------------------------------------------
   * 老板原话：「召回军队时，第一次点击变黄色，第二次点击执行召回并变回无驻军的绿色，
   *   2 秒内无点击则返回红色（己方野地界面的召回驻军同步调整，就不要显示一大段说明
   *   或者文字弹窗了）。召回后不要弹窗己方小野地界面，直接执行召回即可」。
   * 三态：无驻军 = 绿（disabled）；有驻军 = 红；已上膛（_wdArm138 命中本坐标）= 黄。
   * 两处消费（附属野地操作列 / 地块面板「地块操作」）**同读本出口** ——
   * live 逐秒重绘时按钮按状态重建（上膛的黄色不会被每秒重绘冲掉）。
   * `data-lbl` 存原始文案（wdRepaint 重绘时回传，列表"🏳️ 召回"与地块"🏳️ 召回驻军"各保持）。
   * ============================================================ */
  ui.WD_LABELS = { w: '🏳️ 召回', g: '🏳️ 召回驻军' };   /* 两种场景的基础文案（w=野地列表 / g=地块面板） */
  ui.wildWdBtnHTML = function (ci, opts) {
    opts = opts || {};
    var hasGar = (opts.hasGar != null) ? opts.hasGar
      : GAME.wildGarrisonTotal(GAME.wildGarrisonAt(ci)) > 0;
    var armed = hasGar && ui._wdArm138 === ('c' + ci);
    var sz = opts.xs ? ' xs' : '';
    var mode = (opts.lblMode === 'g') ? 'g' : 'w';
    var lbl = ui.WD_LABELS[mode];
    if (!hasGar) {
      return '<button class="btn' + sz + ' green" data-action="wild-withdraw" data-ci="' + ci +
        '" data-lblmode="' + mode + '" disabled title="该野地没有驻军">' + lbl + '</button>';
    }
    return '<button class="btn' + sz + (armed ? ' gold' : ' red') + '" data-action="wild-withdraw" data-ci="' + ci +
      '" data-lblmode="' + mode + '" title="' + (armed ? '再点一次执行（2 秒内有效）' : '撤回驻军（英雄随军回城）—— 连点两次执行') + '">' +
      (armed ? '⚠️ 再点一次' : lbl) + '</button>';
  };
  /* 上膛/回落的**就地重绘**（唯一出口）—— 点击与 2 秒超时都调它；
     按坐标找当前屏幕上的召回按钮（列表 / 地块面板同屏至多一处），用同一渲染出口重建。
     桩环境（无 querySelectorAll）自动跳过 —— 不影响测试口径。 */
  ui.wdRepaint = function (ci) {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    var root = null;
    try { root = document.getElementById('modal-root') || document.body; } catch (e) { return; }
    if (!root || !root.querySelectorAll) return;
    var btns = root.querySelectorAll('[data-action="wild-withdraw"]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!b.dataset || Number(b.dataset.ci) !== Number(ci)) continue;
      b.outerHTML = ui.wildWdBtnHTML(ci, {
        xs: !!(b.classList && b.classList.contains('xs')),
        lblMode: b.dataset.lblmode || 'w'
      });
    }
  };

  /* 附属野地弹窗（原版「附属野地」） */
  ui.openWilds = function () {
    var s = GAME.state;
    /* v89.154（老板 3）：显示序 = wildSortedOf（采集/驻军/地形+等级） */
    var wilds = ui.wildSortedOf(s.wilds);
    var RES_NAME = ui.RES_NAME, RES_ICON = ui.RES_ICON;

    /* 野地对各类资源的贡献折算（用总产量反推：贡献 = 总产 × m/(1+m)） */
    var prod = GAME.productionPerSec();
    var wm = (GAME.wildMult && GAME.wildMult()) || {};
    var contrib = {};
    DATA.RES_ORDER.forEach(function (k) {   /* v89.134：读 DATA.RES_ORDER */
      var m = wm[k] || 0;
      contrib[k] = m > 0 ? prod[k] * m / (1 + m) * 3600 / GAME.timeScale() : 0;
    });

    /* v89.112（老板：条目过多的分页）：30 片野地平铺 = 675px 溢出。
       改 xxl 档 + 弹窗内翻页（每页 13 行；分页条走 mpage → 重开本弹窗）。 */
    var pgW = ui.modalPage('wilds', wilds, 13, function () { ui.openWilds(); });
    var rows = pgW.slice.map(function (w, wi) {
      var t = DATA.TERRAIN[w.type];
      var addStr = '—', resStr = '—';
      var ga = GAME.gatherAt(w.ci);
      if (ga) {
        var gy = GAME.gatherYield(ga);
        addStr = '采集中 ' + gy.pct + '%';
      } else if (t && t.add) {
        /* v15：加成按「每级 × 等级」线性计算 */
        var add = GAME.wildAddOf(w.type, w.level) || {};
        var parts = [], names = [];
        for (var r in add) {
          parts.push(RES_ICON[r] + RES_NAME[r] + ' +' + Math.round(add[r] * 100) + '%');
          names.push(RES_NAME[r]);
        }
        addStr = parts.join(' ');
        resStr = names.join('/');
      }
      /* ============================================================
       * v89.137（老板 6）：「进入附属野地界面，上边对各野地分别同步增加操作列，
       *   设置派驻，采集，收获，召回按钮」——
       *   · 派驻 → 出征界面（station · 与地块/军务同一条唯一入口）
       *   · 采集 → 原地开工（须驻军**有将**；已在采集中则禁用）
       *   · 收获 → 满 1 小时方可（判据与 gather-finish 同源：gatherYield().ready）
       *   · 召回 → 撤回驻军（英雄随军回城）
       * 禁用态一律**写清原因**（悬停），不做"点了才报错"。
       * ============================================================ */
      var _hasGar137 = GAME.wildGarrisonTotal(w.garrison) > 0;
      var _hasGen137 = !!(w.garrison && w.garrison.genId);
      var _gy137 = ga ? GAME.gatherYield(ga) : null;
      /* v89.138（清单②）：操作列走 flex + wrap —— 4 颗刚好一行；将来加第 5 颗会自动换行，
         不会把"加成/采集"列挤没（列宽兜底写进 CSS `.wild-ops`）。 */
      var _opsCell = '<td class="ctr wild-ops">' +
        '<button class="btn xs" data-action="wild-garrison-open" data-ci="' + w.ci +
          '" title="派驻 / 增派驻军 —— 走出征界面（驻守·增援）">🛡️ 派驻</button> ' +
        ((_hasGen137 && !ga)
          ? '<button class="btn xs gold" data-action="wild-garrison-gather" data-ci="' + w.ci +
            '" title="驻军原地开工开采（不抽兵）">⛏️ 采集</button>'
          : '<button class="btn xs" data-action="wild-garrison-gather" disabled title="' +
            (_hasGar137 ? (ga ? '已在采集中' : '驻军须有英雄带队（派驻时选一位英雄补驻）') : '先派驻军（首次须带将）')
            + '">⛏️ 采集</button>') + ' ' +
        ((_gy137 && _gy137.ready)
          ? '<button class="btn xs gold" data-action="gather-finish" data-id="' + ga.id + '" title="收成入城">📦 收获</button>'
          : '<button class="btn xs" data-action="gather-finish" disabled title="满 1 小时方可收获">📦 收获</button>') + ' ' +
        /* v89.155（老板 2）：三态按钮（红→黄→绿）走唯一出口；上膛态进 live 渲染 */
        ui.wildWdBtnHTML(w.ci, { xs: true, hasGar: _hasGar137 }) +
        /* v89.154（老板 1）：「附属野地界面，操作栏中增加一个放弃野地按钮，按钮应该采用防误触设计」——
           防误触三层（v89.156 收敛）：① 红色 + 与正向动作留间距（.wild-drop，可换行分组）
           ② 只触发二次确认窗（wild-abandon-ask，绝不一键执行）
           ③ 确认窗明写「不可撤销」+ 逐项列出失去/撤回什么，窗内红键**一击执行**
              （v89.156 老板：「本身已经是 2 次确认了」—— 上膛式退役）。 */
        '<button class="btn xs red wild-drop" data-action="wild-abandon-ask" data-ci="' + w.ci +
          '" title="放弃该野地 —— 需二次确认，且不可撤销（驻军与采集队会先撤回城内）">🗑️ 放弃</button>' +
        '</td>';
      /* v89.140（老板 8）：「附属野地界面，在**操作列的左边**增加一列英雄和一列驻军，
         分别显示英雄和军队总数」——驻军英雄走 wildGarrisonAt().genId（唯一来源），
         数量走 wildGarrisonTotal（与地块界面/军务同源）。 */
      var _garW = GAME.wildGarrisonAt(w.ci);
      var _garN = GAME.wildGarrisonTotal(_garW);
      var _genW = null;
      if (_garW && _garW.genId) {
        (s.generals || []).forEach(function (g0) { if (g0.id === _garW.genId) _genW = g0; });
      }
      return '<tr' + ((pgW.from + wi) === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +
        '><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + GAME.map.coordText(w.x, w.y) + '</td>' +
        '<td class="ctr">Lv' + w.level + '</td><td class="ctr">' + resStr + '</td>' +
        '<td class="ctr" style="color:' + (ga ? 'var(--gold-light)' : 'var(--green-ok)') + ';">' + addStr + '</td>' +
        '<td class="ctr">' + (_genW ? U.escape(_genW.name) : '<span style="color:var(--text-dim);">—</span>') + '</td>' +
        '<td class="num">' + (_garN > 0 ? U.fmt(_garN) : '<span style="color:var(--text-dim);">—</span>') + '</td>' +
        _opsCell + '</tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">尚未占领野地（在地图点击野地格派兵占领）</td></tr>';

    /* 野地合计贡献 */
    var totalLine = ['grain', 'wood', 'stone', 'iron'].map(function (k) {
      var v = contrib[k];
      return '<span class="wild-res">' + RES_ICON[k] + RES_NAME[k] +
        ' <b>' + (v > 0 ? '+' + U.fmt(v) : '0') + '</b>/时</span>';
    }).join('');

    var cap = GAME.buildingLevel(GAME.currentCity(), 'guanfu') || 1;
    var sky = GAME.story ? GAME.story.skyLine() : '';
    ui.openModal(
      '<div class="gold-heading">🏕️ 附属野地（' + wilds.length + '/' + cap + '）</div>' +
      (sky ? '<div class="ui-sub" style="text-align:center;margin-bottom:8px;">' + sky + '</div>' : '') +
      /* v89.140（老板 8）：表头补「英雄」「驻军」两列（与数据行同列数——
         第一版只加了单元格忘了表头，实机判据当场抓出） */
      '<table class="tbl"><thead><tr><th>地形</th><th>坐标</th><th>等级</th><th>产出资源</th><th>加成 / 采集</th>' +
        '<th class="ctr">英雄</th><th class="num">驻军</th><th class="ctr">操作</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      /* v89.112：分页条（>1 页才出按钮；单页只显示"共 N 项"） */
      (wilds.length > 13 ? pgW.pager : '') +
      '<div class="wild-total"><span style="color:var(--text-dim);font-size:var(--fs-sub);">野地贡献合计</span>' + totalLine + '</div>' +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.136（清单①）：live 逐秒刷新（产量加成/等级衰减随日推进实时） */
      { size: 'xxl', live: function () { ui.openWilds(); } }
    );
  };

  /* ============================================================
   * v89.193（老板 2）：**前哨面板与总览**（同附属野地的汇总管理界面）
   * ------------------------------------------------------------
   * 老板原话：「前哨格本身（我的前哨=城市视觉格）未加情报按钮；——设置同附属野地，
   *   每城最多 5 个。等级不同的前哨辐射范围和效果不同，设计一下。给一个同附属野地的
   *   弹窗界面进行汇总管理，要素设计一下」。
   * · openOutpostPanel(f)：点**前哨格**（占据后的城市视觉格）开的面板 ——
   *   旧行为把它当"未占领野地"（显示守军 + 侦查/掠夺/占领按钮，全是错误操作），
   *   现在直接给情报：等级/辐射/五项护持（走 fortEffectOf 唯一出口）/归属城/覆盖统计。
   * · openOutposts()：**前哨总览**（要素：名称/坐标/等级/辐射/护持摘要/所属城/定位；
   *   分页 8 行（v89.195 起：档位一览表占高）；顶部"每城上限 5 · 本城 n/5"；底部各城占用小结）。
   * 入口：地图导航栏「🚩 前哨」（回本城右侧）+ 前哨面板内「前哨总览」。
   * ============================================================ */
  ui.openOutpostPanel = function (f) {
    if (!f) return;
    var fx = GAME.fortEffectOf(f);
    var own = GAME.cityById(f.cityId);
    var s = GAME.state;
    /* 覆盖统计：覆盖内的我方野地（享受护持）/ 可驻地块（非城市水域） */
    var nOwn = 0;
    (s.wilds || []).forEach(function (w) {
      if (Math.max(Math.abs((f.x || 0) - w.x), Math.abs((f.y || 0) - w.y)) <= fx.radius) nOwn++;
    });
    var nWild = 0;
    for (var dy = -fx.radius; dy <= fx.radius; dy++) {
      for (var dx = -fx.radius; dx <= fx.radius; dx++) {
        var tl = GAME.map.tile(f.x + dx, f.y + dy);
        if (tl && tl.terrain !== 'city' && tl.terrain !== 'water') nWild++;
      }
    }
    ui.openModal(
      '<div class="gold-heading">🚩 我方前哨 · ' + U.escape(f.name || '?') + ' Lv' + (f.lv || 1) + '</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">辐射 <b>' + fx.radius +
        '</b> 格 · 所属 ' + U.escape(own ? own.name : '（未定归属）') + ' · 不占城市名额</div>' +
      '<div class="op-zone op-zone-eq"><div class="op-zone-t">前哨护持（随据点等级）</div>' +
        '<div class="attr"><span class="k">衰减保护</span><span class="v">覆盖内野地 -1 级/现实日（与驻军同档，取档不叠加）</span></div>' +
        '<div class="attr"><span class="k">采集增产</span><span class="v">采力产出 <b>×' + fx.gatherMul +
          '</b> · 宝物概率 <b>+' + Math.round(fx.treasureAdd * 100) + '%</b></span></div>' +
        '<div class="attr"><span class="k">兵站</span><span class="v">覆盖内野地驻军上限 <b>×' + fx.garrisonCapMul + '</b></span></div>' +
        '<div class="attr"><span class="k">情报站</span><span class="v">' +
          (fx.intelFull ? '覆盖内军师估算 <b>确凿</b>（误差归零）'
            : '覆盖内军师估算误差 <b>减半</b>（升到 Lv5 转确凿）') + '</span></div>' +
        '<div class="attr"><span class="k">商旅税所</span><span class="v">每现实日 <b>+' + fx.tax + ' 旧币</b>（与岁贡同轴）</span></div>' +
      '</div>' +
      '<div class="op-zone"><div class="op-zone-t">覆盖概况</div>' +
        '<div class="attr"><span class="k">我方野地</span><span class="v">' + nOwn + ' 处（享受护持）</span></div>' +
        '<div class="attr"><span class="k">可驻地块</span><span class="v">' + nWild + ' 块</span></div>' +
      '</div>' +
      /* v89.195（老板 1）：「前哨可放手」—— 危险操作独立区（v89.68 口径：
         不与高频正向动作并排紧邻）；确认窗内红键一击执行（v89.156）。 */
      '<div class="op-zone danger op-zone-eq"><div class="op-zone-t">危险操作</div><div class="op-row">' +
        '<button class="btn red" data-action="fort-abandon-ask" data-ci="' + f.ci + '">🗑️ 放手该前哨</button>' +
        '<span class="op-hint">护持与商税中止；名额释放；不可撤销（该处据点已拔除，不会再出现）</span>' +
      '</div></div>' +
      '<div class="modal-foot" style="display:flex;gap:8px;justify-content:center;">' +
        '<button class="btn gold" data-action="open-outposts">🚩 前哨总览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      { live: function () { ui.openOutpostPanel(f); } }
    );
  };
  ui.openOutposts = function () {
    var list = [];
    var fs = GAME.fortsOf();
    for (var k in fs) list.push(fs[k]);
    /* 排序：等级降序，平局按坐标序（确定性） */
    list.sort(function (a, b) {
      return (b.lv || 1) - (a.lv || 1) || ((a.x || 0) - (b.x || 0)) || ((a.y || 0) - (b.y || 0));
    });
    var me = GAME.currentCity();
    var mineN = me ? GAME.fortsOfCity(me).length : 0;
    var maxN = (DATA.FORT_AURA || {}).maxPerCity || 5;
    /* v89.195：13 → 8（档位一览表占高 ~170px；实机满页压测溢出 150px，
       每行 ~30px → 减 5 行消除）—— 分页只在前哨 > 8 处时出现。 */
    var pgW = ui.modalPage('outposts', list, 8, function () { ui.openOutposts(); });
    var rows = pgW.slice.map(function (f) {
      var fx = GAME.fortEffectOf(f);
      var own = GAME.cityById(f.cityId);
      return '<tr><td>' + U.escape(f.name || '?') + '</td>' +
        '<td class="ctr">' + GAME.map.coordText(f.x, f.y) + '</td>' +
        '<td class="ctr">Lv' + (f.lv || 1) + '</td>' +
        '<td class="ctr">' + fx.radius + ' 格</td>' +
        '<td>采×' + fx.gatherMul + ' · 宝+' + Math.round(fx.treasureAdd * 100) + '% · 驻×' + fx.garrisonCapMul +
          ' · ' + (fx.intelFull ? '情报确凿' : '情报半明') + ' · 税' + fx.tax + '旧币/日</td>' +
        '<td class="ctr">' + U.escape(own ? own.name : '—') + '</td>' +
        '<td class="ctr"><button class="btn sm" data-action="fort-goto" data-x="' + f.x + '" data-y="' + f.y + '">定位</button> ' +
          '<button class="btn sm" data-action="fort-abandon-ask" data-ci="' + f.ci + '">放手</button></td></tr>';
    }).join('');
    /* 各城占用小结（多城玩家一眼看清名额去用） */
    var byCity = {};
    list.forEach(function (f) {
      var cid = f.cityId || '—';
      if (!byCity[cid]) byCity[cid] = { n: 0, name: '（未定归属）' };
      byCity[cid].n++;
      var cc = GAME.cityById(cid);
      if (cc) byCity[cid].name = cc.name;
    });
    var cityLine = Object.keys(byCity).map(function (cid) {
      return byCity[cid].name + ' ' + byCity[cid].n + '/' + maxN;
    }).join('　·　');
    ui.openModal(
      '<div class="gold-heading">🚩 我方前哨（共 ' + list.length + ' 处）</div>' +
      '<div class="ui-sub" style="text-align:center;margin-bottom:8px;">每城上限 ' + maxN + ' 处 · 当前城 ' +
        U.escape(me ? me.name : '—') + ' <b>' + mineN + '/' + maxN + '</b> · 等级越高辐射越广、护持越强</div>' +
      (list.length
        ? '<table class="tbl"><thead><tr><th>名称</th><th class="ctr">坐标</th><th class="ctr">等级</th><th class="ctr">辐射</th>' +
          '<th>护持（随等级）</th><th class="ctr">所属城</th><th class="ctr">操作</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table>'
        : '<div class="q-empty">尚未占据任何前哨 —— 在地图点击野外城市，派兵「拔除并收为前哨」（不占城市名额）。</div>') +
      (list.length > 13 ? pgW.pager : '') +
      (cityLine ? '<div class="wild-total" style="margin-top:8px;">' + cityLine + '</div>' : '') +
      /* v89.195（老板 2）：「等级高功能强」——**等级档位一览**（口径直读唯一表
         DATA.FORT_AURA.tiers）：把五档完整护持摆给玩家看，给"去打高级据点"一个
         明确的目标；档位边界由表派生（第 i 档下限 = 上一档 lv + 1），不另写一份。 */
      (function () {
        var tiers195 = (DATA.FORT_AURA || {}).tiers || [];
        if (!tiers195.length) return '';
        var rows195 = tiers195.map(function (t, i) {
          var lo = (i === 0) ? 1 : ((tiers195[i - 1].lv || 2) + 1);
          return '<tr><td class="ctr">Lv' + lo + '–' + t.lv + '</td>' +
            '<td class="ctr">' + t.radius + ' 格</td>' +
            '<td class="ctr">×' + t.gatherMul + '</td>' +
            '<td class="ctr">+' + Math.round(t.treasureAdd * 100) + '%</td>' +
            '<td class="ctr">×' + t.garrisonCapMul + '</td>' +
            '<td class="ctr">' + (t.intel === 'full' ? '确凿' : '半明') + '</td>' +
            '<td class="ctr">' + t.tax + ' 旧币/日</td></tr>';
        }).join('');
        return '<div style="margin-top:8px;">' +
          '<div class="ui-sub" style="text-align:center;margin-bottom:4px;">📶 等级档位一览' +
          '（前哨等级 = 占据时据点等级 · 等级越高护持越强）</div>' +
          '<table class="tbl"><thead><tr><th class="ctr">档位</th><th class="ctr">辐射</th>' +
          '<th class="ctr">采集</th><th class="ctr">宝物</th><th class="ctr">驻军上限</th>' +
          '<th class="ctr">情报</th><th class="ctr">商税</th></tr></thead>' +
          '<tbody>' + rows195 + '</tbody></table></div>';
      })() +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xxl', live: function () { ui.openOutposts(); } }
    );
  };
  /* ============================================================
   * v89.195（老板 1）：**放手确认窗**（前哨面板 / 总览两处入口共用）
   * ------------------------------------------------------------
   * 口径（v89.156 老板 2）：「弹窗出来的放弃按钮点击直接执行即可，
   *   本身已经是 2 次确认了」——打开本窗 = 第一次确认，窗内红键一击执行。
   * 写清三件事：失去什么 / 名额怎么变 / 能否撤销（不可撤销四个字必须在）。
   * ============================================================ */
  ui.openFortAbandonAsk = function (ci) {
    var f = GAME.fortOwnAt ? GAME.fortOwnAt(ci) : null;
    if (!f) { ui.toast('此处没有我方前哨'); return; }
    var fx = GAME.fortEffectOf(f);
    var own = GAME.cityById(f.cityId);
    var n = own ? GAME.fortsOfCity(own).length : 0;
    var maxN = ((DATA.FORT_AURA || {}).maxPerCity) || 5;
    ui.openShell({
      title: '🗑️ 放弃前哨 · ' + U.escape(f.name || '?'),
      sub: 'Lv' + (f.lv || 1) + '　' + GAME.map.coordTextCi(f.ci)
        + (own ? '　归属 ' + U.escape(own.name) : ''),
      size: 'sm',
      body:
        '<div class="note">放弃后这处前哨的<b>全部护持立即中止</b>，且<b>不可撤销</b>：' +
          '该处据点已被拔除（v89.103 口径），不会再出现在地图上。</div>' +
        '<div class="attr"><span class="k">失去护持</span><span class="v">辐射 ' + fx.radius +
          ' 格：采集 ×' + fx.gatherMul + ' · 宝物 +' + Math.round(fx.treasureAdd * 100) +
          '% · 驻军上限 ×' + fx.garrisonCapMul + ' · ' +
          (fx.intelFull ? '情报确凿' : '情报半明') + ' · 商税 ' + fx.tax + ' 旧币/日</span></div>' +
        '<div class="attr"><span class="k">名额变化</span><span class="v good">' +
          (own ? U.escape(own.name) + '：' + n + '/' + maxN + ' → ' + (n - 1) + '/' + maxN + '（可再设哨）' : '已释放') +
          '</span></div>' +
        '<div class="attr"><span class="k">格子处置</span><span class="v">恢复为普通地形（可正常使用）</span></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn red" data-action="fort-abandon-arm" data-ci="' + f.ci + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };


  /* 游商弹窗（原版右下功能入口） */
  /* ============================================================
   * v89.194（老板 S3）：**陈列馆**（收藏视图 · v89.227 更名，原名「藏珍阁」）—— 与游商 / 背包并列的整页菜单
   * ------------------------------------------------------------
   * 结构：标题（全库统计）→ 系列 chips（全部 + 18 系，带完成度与 ✓）
   *   → 当前系列说明 + 一键集齐 → 藏品网格（4 列 / 每页 12）→ 底部翻页。
   * 卡片：图标 / 名 + 副题 / 所属系列 / 价格 + 购买（已藏 = 金框 ✓ 已入藏）。
   * 动作全走唯一出口：collect-buy / collect-series（域层才是硬闸；
   *   按钮置灰只是提示 —— v89.189 口径：可点+说明，用了 data-why）。
   * ============================================================ */
  ui.COL_PER_PAGE = 12;      /* 每页 12 席（4 列 × 3 行） */
  ui._colCat = 'all';
  ui.collectHTML = function () {
    var s = GAME.state;
    var C = DATA.COLLECT || { series: [] };
    var stat = GAME.collectStatOf();
    var cat = ui._colCat || 'all';
    /* 拍平：全部藏品 + 归属系列（过滤与展示全走这一份） */
    var all = [];
    (C.series || []).forEach(function (sr) {
      (sr.items || []).forEach(function (it) { all.push({ it: it, sr: sr }); });
    });
    var cur = null;
    (C.series || []).forEach(function (sr) { if (sr.id === cat) cur = sr; });
    var list = cur ? all.filter(function (x) { return x.sr.id === cur.id; }) : all;
    var per = ui.COL_PER_PAGE;
    var p = ui.pageOf('collect', list.length, per);
    var slice = list.slice(p.from, p.to);
    ui.pagerHTML('collect', list.length, per);

    var chips = [['all', '🏛 全部', stat.have + '/' + stat.total, false]]
      .concat((C.series || []).map(function (sr) {
        var d = GAME.collectSeriesDoneOf(sr.id);
        return [sr.id, sr.icon + ' ' + sr.name, d.have + '/' + d.total, d.done];
      }));
    var chipsHTML = chips.map(function (c2) {
      return '<span class="chip col-chip' + (c2[0] === cat ? ' on' : '') + (c2[3] ? ' done' : '') +
        '" data-action="collect-cat" data-c="' + c2[0] + '">' + c2[1] +
        '<i>' + c2[2] + (c2[3] ? ' ✓' : '') + '</i></span>';
    }).join('');

    var cards = slice.map(function (x) {
      /* v89.196（老板 7）：成就型三态 —— 未解锁（🔒 条件+进度）/ 已解锁待激活（花旧币）/ 已入藏。 */
      var have = GAME.collectHaveOf(x.it.id);
      var cd = GAME.collectCondOf(x.it.id);          /* 条件对象（显示"锁 + 进度"用） */
      var unlocked = GAME.collectCondMetOf(x.it.id); /* v89.196：解锁判定唯一出口 */
      var can = (GAME.goldOf() || 0) >= x.it.price;
      var tail;
      if (have) {
        tail = '<div class="col-own">✓ 已入藏</div>';
      } else if (!unlocked) {
        /* v89.202：进度显示与判定同源（历史最高）——"最高"二字防误读为现值 */
        tail = '<div class="col-lock">🔒 ' + U.escape(cd.name) + ' ≥ ' + U.fmt(cd.n) +
          '<i>最高 ' + U.fmt(cd.cur) + ' / ' + U.fmt(cd.n) + '</i></div>';
      } else {
        /* v90.44（老板）：激活费不再内联（col-price 退役），移入「激活」按钮悬停。 */
        tail = '<div class="col-buy">' +
          '<button class="btn sm' + (can ? ' gold' : ' dim') + '" data-action="collect-buy" data-item="' + x.it.id + '"' +
          ' title="激活费：' + U.escape(U.fmt(x.it.price)) + ' 旧币"' +
          (can ? '' : ' disabled data-why="旧币不足：需 ' + U.fmt(x.it.price) + ' 旧币"') + '>激活</button></div>';
      }
      return '<div class="col-card' + (have ? ' owned' : (unlocked ? '' : ' locked')) + '">' +
        '<div class="col-ico">' + (x.sr.icon || '🏺') + '</div>' +
        '<div class="col-nm">' + U.escape(x.it.name) +
          (x.it.sub ? '<span class="col-sub">' + U.escape(x.it.sub) + '</span>' : '') + '</div>' +
        '<div class="col-sr">' + U.escape(x.sr.name) + '</div>' +
        tail +
        '</div>';
    }).join('');

    var curMissing = cur ? (cur.items || []).filter(function (it) { return !GAME.collectHaveOf(it.id); }) : [];
    /* v89.196（老板 7）：一键集齐也要过解锁闸 —— 有未解锁件时禁用并给出原因（不做半套）。 */
    var curLocked = curMissing.filter(function (it) {
      var cd = GAME.collectCondOf(it.id);
      return cd && !cd.met;
    });
    var headDesc = cur
      ? (cur.icon + ' ' + U.escape(cur.name) + ' —— ' + U.escape(cur.desc || ''))
      : '成系列收藏英雄与佳人的珍品 —— 集齐一系可得声望。';
    return '<div class="ui-page col-page">' +
      '<div class="gold-heading">🏛 陈列馆' +
        ui.help('成就型收藏：完成特定任务后藏品【解锁】，再花旧币【激活】入藏。\n' +
          '解锁按历史最高判定 —— 达成过即永久解锁（数值回落不会重新上锁）。\n' +
          '藏品纯为荣誉（不给战斗属性）；集齐一系得该系声望，' +
          '全 ' + stat.seriesTotal + ' 系集齐另得 ' + U.fmt(C.allRep || 0) + ' 声望。\n' +
          '卡上金额为旧币（全境通用池）；已入藏的藏品不再出售（一物一藏）。') +
        '<span class="ui-sub">　已藏 <b>' + stat.have + '</b> / ' + stat.total +
          ' 件　·　系列 <b>' + stat.seriesDone + '</b> / ' + stat.seriesTotal + '</span>' +
      '</div>' +
      '<div class="shop-cats col-cats">' + chipsHTML + '</div>' +
      '<div class="col-desc"><span>' + headDesc + '</span>' +
        (cur
          ? '<button class="btn sm' + (curMissing.length && !curLocked.length ? ' gold' : ' dim') +
            '" data-action="collect-series" data-s="' + cur.id + '"' +
            (curMissing.length && !curLocked.length ? '' : ' disabled data-why="'
              + (curLocked.length ? ('还有 ' + curLocked.length + ' 件未解锁') : '本系列已集齐') + '"') +
            '>一键集齐本系（' + curMissing.length + ' 件）</button>'
          : '') +
      '</div>' +
      (cards ? '<div class="col-grid">' + cards + '</div>' : '<div class="q-empty">暂无藏品。</div>') +
      '</div>';
  };
  ui.setColCat = function (c) { ui._colCat = c; ui._pages['collect'] = 1; ui.renderCollect(); };
  ui.renderCollect = function () {
    if (ui.view !== 'collection') return;
    ui.repaintView(function () { return ui.collectHTML(); });
  };

  /* ============================================================
   * 游商（v18 重制）
   * 旧版把 73 件商品一次性铺成一长条 —— 弹窗里要滚很久才能看到底，
   * 与"附属窗口固定大小"的要求冲突。改为：
   *   · 顶部分类页签（每类显示件数）
   *   · 固定 2 列 × 8 行网格（每页 16 件，不足则留白，尺寸不跳）
   *   · 底部分页条
   * ============================================================ */
  ui._shopCat = null;
  ui.SHOP_PER_PAGE = 16;
  ui.SHOP_CATS = {
    material: '材料', jewel: '珠宝', /* v91.30：图纸/残卷/民生 页签退役；珠宝/生产/营造仍有在售 */ attr_buff: '符类', prod_buff: '生产',
    military_buff: '军事', boost: '加速', exp: '经验', stamina: '体力',
    perm: '丹药', mount_buff: '座驾',
    /* v77（老板「丰富商场道具」）：宝箱 / 战技残卷 / 政令（征调令）三类新货 */
    chest: '宝箱', corvee: '政令',   /* v91.30：残卷页签退役（残页走奇观产，不进游商） */
    /* v86（老板「按计划进行」· G1）：封存匣 —— 施展计谋所需 */
    talis: '封存匣',
    build_cost: '营造',   /* 低档营造仍在售（≥50% 的转奇观产） */
    /* ⛔ v89.224：种子货架退役（老板 2「不要播种 / 种子」）—— seed 页签整条删除。 */
    /* v91.30：民生(pop_boost)页签退役（招揽令转奇观产）；pop_fill(迁入令)仍留民生。 */
    /* v89.121（全生命周期模拟抓出的断链）：**迁入令此前没有页签** ——
       它有价（120 元宝）、无 noShop 标记，但「在售 == 有页签」（v89.51 的判据）下
       **游商与快购都渲染不出来** → 有定价却永远买不到（"半上架"）。
       并入「民生」页签（与招揽令同族）后：游商可见、可比价。 */
    pop_fill: '民生',
    /* v89.131（老板「体力精力应当设计加号按钮，供道具使用」）：
       精力族（提神剂/清醒片/专注剂/静心液）—— 新 type 'energy'，
       **在售 == 有页签**（v89.51 判据）：漏了这行就是"半上架"（有价却渲染不出来）。 */
    energy: '精力',
  };
  /* v89.51：**在售 == 有页签**（唯一判据）。
     改前只按 `price > 0` 收件 —— 「有价但不在任何页签」的类型（营造等）
     会静默消失：数据以为上架了，玩家永远看不见。
     现在把规则钉死：想上架 → 先进 SHOP_CATS；不想卖（血清等，price 仅供背包「估值」）
     自然被排除，不会再出现"半上架"状态。 */
  /* ============================================================
   * v89.155（老板 4）：商品/背包的**内置排序标号**（不显示）
   * ------------------------------------------------------------
   * 老板原话：「改变商品排序规则，同功能商品按其功能由小到大相邻排序。
   *   建议内置一套通用性强的内置排序标号（不直接显示在商品或背包界面）」。
   * 口径：标号 = 功能族 × 1000 + 族内强度档（0~999）——
   *   · 功能族 = 效果维度（eff 的键；产量宝物的维度在 `res` 字段）；
   *     同族商品必然相邻（例：攻击四鼓 atk 0.10/0.15/0.25/0.35 连排升序）；
   *   · 族内档位 = 效果值 ×1000；无效果的商品（珠宝/图纸/加速…）用 price 当档位；
   *   · 想手动指定顺序：在物品上写 `ord`（数字）→ 直接生效（覆盖派生）。
   * 消费点三处（同读本出口）：游商营业顺序 / 背包宝物页组内顺序 / 快购列表。
   * ⚠️ 下表值 = **基族号**：实际族号 = 基族 × 10（单键/单值）或 × 10 + 1（复合变体）。
   * ============================================================ */
  ui.ITEM_FAM = {
    /* 军事 buff：按效果维度分族 */
    atk: 101, def: 102, wound: 103, cap: 104,
    /* 属性符：按四维/速度分族 */
    tong_mult: 201, yw_mult: 202, zm_mult: 203, nz_mult: 204, spd: 205,
    /* 产量宝物：按资源维度分族（itemFamOf 用 'res_' 前缀查表） */
    res_grain: 301, res_wood: 302, res_stone: 303, res_iron: 304, res_gold: 305,
    /* 建造减耗：单族 */
    build: 401
  };
  ui.ITEM_TYPE_FAM = {
    jewel: 501, talis: 502, boost: 503, exp: 504, stamina: 505, energy: 506, chest: 507,
    neigong: 508, perm: 509, rank_up: 510, mount_buff: 512, corvee: 513,
    essence: 514, pop_boost: 515, pop_fill: 516, material: 517, blueprint: 518
  };
  ui.itemFamOf = function (it) {
    if (!it) return 9990;
    if (it.eff && typeof it.eff === 'object') {
      var ks = Object.keys(it.eff);
      /* v89.155：**复合效果（多键）归"首键的复合变体族"**（基族 × 10 + 1）——
         "同功能相邻"的精确含义 = 功能组合相同者才相邻：
         否则"攻守符（攻+防）"会插进纯攻击四鼓中间把它们劈开（本段注释来自实测抓出）。
         复合件在变体族内按首键值升序（攻守符 15% → 全军令/万全策 20% → 天时令 30%）。 */
      if (ks.length > 1) {
        var f0 = ui.ITEM_FAM[ks[0]];
        if (f0 != null) return f0 * 10 + 1;
      }
      for (var i = 0; i < ks.length; i++) if (ui.ITEM_FAM[ks[i]] != null) return ui.ITEM_FAM[ks[i]] * 10;
    }
    if (it.res && ui.ITEM_FAM['res_' + it.res] != null) return ui.ITEM_FAM['res_' + it.res] * 10;
    if (it.type === 'build_cost') return ui.ITEM_FAM.build * 10;
    if (ui.ITEM_TYPE_FAM[it.type] != null) return ui.ITEM_TYPE_FAM[it.type] * 10;
    return 9000;                                  /* 未知新类型：统一殿后（族内按 price） */
  };
  ui.itemPowOf = function (it) {
    var v = null;
    if (it && it.eff && typeof it.eff === 'object') {
      var ks = Object.keys(it.eff);
      if (ks.length) v = Math.abs(Number(it.eff[ks[0]]) || 0);
    } else if (it && typeof it.eff === 'number') v = Math.abs(it.eff);
    if (v == null) v = ((it && it.price) || 0) / 1000;      /* 无效果 → 价格当档位 */
    return Math.max(0, Math.min(999, Math.round(v * 1000)));
  };
  ui.itemOrdOf = function (it) {
    if (it && typeof it.ord === 'number') return it.ord;    /* 手写标号优先 */
    return ui.itemFamOf(it) * 1000 + ui.itemPowOf(it);
  };

  ui.shopItems = function () {
    /* v89.104（老板「商场同类产品档次太多了…最多分 4 档」）：
       `noShop: true` 的档位**不上架** —— 这里是唯一过滤口，游商页与快购都读它。
       v89.121（老板拍板「承认绝版」）：下架 = 停止产出（掉落/任务/炼制亦不给），
       仅老存档已持有的可用；详见 data.js「宝物」段头。 */
    return DATA.ITEMS.filter(function (it) {
      /* v89.179c：dropOnly 的宝物（pct ≥ 0.5 的高阶加速）只走采集/战役掉落，
         不上架游商（也不进快购）—— 与 noShop 不同：noShop 是"全网下架且不产出"，
         dropOnly 是"游商不卖但可掉落"（老板「移出游商，改采集/战役掉落」）。 */
      /* v91.30：wonderOnly = 奇观产（珠宝/≥50%强效/图纸/战技残页/奇观材料）—— 游商与快购都不列。 */
      return it.price > 0 && !it.noShop && !it.dropOnly && !it.wonderOnly && !!ui.SHOP_CATS[it.type];
    });
  };
  /* ============================================================
   * 快购（v89.87 · 老板需求 1）：消耗点就地直购
   * ------------------------------------------------------------
   * 老板原话：「在消耗宝物的地方提供按钮，可以直接购物，避免每次都去游商」。
   * 两种形态：
   *   · openQuickBuy(itemId, need, back) —— 单物品（材料/图纸/封存匣/种子），
   *     默认数量 = 缺口；back 是"购买成功后重开的来源面板"回调。
   *   · openQuickCat(cat) —— 整类快购（加速宝物等多种同类选购）。
   * 购买走游商的**同一出口 GAME.doShopping** —— 价格/校验/扣款/日志完全一致，
   * 不存在"快购价"与"游商价"两套。种子页签同步开售（ui.SHOP_CATS）。
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
    /* v89.121（老板「承认绝版」）：下架档 = 绝版 —— 游商页本就不列，
       这里把"就地快购"也堵上（noShop 必须在**所有购买口**生效）。 */
    if (it.noShop) { ui.toast('「' + it.name + '」已下架（绝版），不再出售 —— 仅旧藏可用'); return; }
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
          '<div class="ir-meta">单价 ' + U.numText(it.price * 100, 0) + ' 旧币　·　持有 ' + have +
            '　·　需求 ' + (need || 1) + '（缺 ' + gap + '）</div>' +
          (it.desc ? '<div class="ir-desc">' + U.escape(it.desc) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ui-sub" style="margin-top:4px;">购买数量</div>' +
      ui.qtyInput('qb-qty', gap, it.price * 100, 9999) +
      '<div class="ir-total" id="qb-qty-total" data-label="合计" style="text-align:right;color:var(--gold-light);"></div>' +
      '<div class="op-hint" style="margin-top:4px;">现有旧币 ' + U.numText(GAME.state.res.gold || 0, 0) + '</div>' +
      '<div class="m-foot"><button class="btn gold" data-action="qb-buy">购买</button>' +
      '<button class="btn" data-action="close-modal">取消</button></div>');
  };
  /* v89.116（老板「快购没有针对性，我加速兵种招募的怎么还买到缩短建造、行军什么的」）
     —— **病根**：`boost` 类里混装了研究 / 建造 / 训练 / 行军 / 交易站五种用途的宝物，
     快购却整类端上来（点"购买加速宝物"给的是**全部加速宝物**）。
     口径：调用点必须声明**用途**（= `DATA.ITEMS[].target`，与"背包里可用于加速募兵的宝物"
     `S.trainBoostItems` 同一字段），快购只列该用途的；
     另给一个「看全部加速宝物」的显式入口 —— 想通买的人有路，但不能默认塞给玩家。 */
  ui.QB_SCOPE_CN = { research: '研究', build: '建造', train: '募兵训练', march: '行军', trade: '交易站交易',
    wound: '伤兵' };   /* v89.186：伤兵系（eff.wound > 0）—— 出征面板「快购兵书」专用 */
  ui.qbScopeItemsOf = function (cat, scope) {
    return (DATA.ITEMS || []).filter(function (x) {
      if (!(x.price > 0) || x.type !== cat) return false;
      if (x.noShop) return false;    /* v89.121：快购列表与游商同口径（下架=绝版，不列） */
      /* v89.179c（老板「高阶比例道具移出游商」）：dropOnly 的高阶加速宝物（pct ≥ 0.5）
         与游商同口径 —— 快购也不卖，只能在采集 / 战役里掉（GAME.grantBoostDrop）。 */
      if (x.dropOnly) return false;
      /* v89.186（老板 2）：scope='wound' = 伤兵系筛选（eff.wound > 0）——
         与 target 型 scope（加速用途）并列的第二种筛选维度。 */
      if (scope === 'wound') { if (!(x.eff && x.eff.wound > 0)) return false; }
      else if (scope && x.target !== scope) return false;
      return true;
    }).sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });   /* v89.155：与游商同一标号 */
  };
  ui.openQuickCat = function (cat, scope) {
    var list = ui.qbScopeItemsOf(cat, scope);
    if (!list.length) {
      ui.toast(scope ? ('该用途暂无可购之物（' + (ui.QB_SCOPE_CN[scope] || scope) + '）') : '该类别暂无可购之物');
      return;
    }
    var rows = list.map(function (it) {
      var have = (GAME.state.items || {})[it.id] || 0;
      return '<div class="xc-row">' +
        '<div class="xc-ico">' + ui.qbArt(it) + '</div>' +
        '<div class="xc-info"><b>' + U.escape(it.name) + ' ×' + have + '</b>' +
          '<span class="xc-prod">' + U.numText(it.price * 100, 0) + ' 旧币 · ' + U.escape(it.desc || '') + '</span></div>' +
        '<input type="number" id="qbq-' + it.id + '" min="1" value="1" style="width:64px;padding:4px;' +
          'background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
        '<button class="btn sm gold" data-action="qb-cat-buy" data-item="' + it.id + '" data-cat="' + cat + '" data-scope="' + (scope || '') + '">买入</button>' +
        '</div>';
    }).join('');
    var scopeCn = scope ? (ui.QB_SCOPE_CN[scope] || scope) : '';
    var allN = ui.qbScopeItemsOf(cat, null).length;
    ui.openModal(
      '<div class="gold-heading">🛒 快购 · ' + U.escape((ui.SHOP_CATS && ui.SHOP_CATS[cat]) || cat)
        + (scopeCn ? '（' + scopeCn + '专用）' : '') + '</div>' +
      '<div class="ui-sub" style="text-align:center;">现有旧币 ' + U.numText(GAME.state.res.gold || 0, 0)
        + (scope ? '　·　此处只列<b>' + scopeCn + '</b>用途的宝物（共 ' + list.length + ' / ' + allN + ' 种）' : '') + '</div>' +
      '<div class="modal-scroll">' + rows + '</div>' +   /* v89.112：撤内联 440px 上限 */
      '<div class="m-foot">' +
        (scope ? '<button class="btn" data-action="qb-cat" data-cat="' + cat + '">看全部加速宝物</button>' : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>');
  };

  /* v89.121：页签分组（按**显示名**聚合 —— 多个 type 可共享一页，
     如「民生」= pop_boost + pop_fill；key 取组内第一个 type，`_shopCat` 语义不变）。 */
  ui.shopCatOf = function (all) {
    var seen = {}, out = [];
    Object.keys(ui.SHOP_CATS).forEach(function (tp) {
      if (!all.some(function (it) { return it.type === tp; })) return;
      var nm = ui.SHOP_CATS[tp];
      if (seen[nm]) { seen[nm].types.push(tp); return; }
      var g = { key: tp, name: nm, types: [tp] };
      seen[nm] = g;
      out.push(g);
    });
    return out;
  };
  /* 组内任一 type → 组的 key（老调用点全传 type；找不到返回 null） */
  ui.shopCatKey = function (c) {
    if (!c) return null;
    var cats = ui.shopCatOf(ui.shopItems());
    for (var i = 0; i < cats.length; i++) if (cats[i].types.indexOf(c) >= 0) return cats[i].key;
    return null;
  };
  ui.openShop = function (cat) {
    var cats = ui.shopCatOf(ui.shopItems());
    ui._shopCat = ui.shopCatKey(cat) || ui.shopCatKey(ui._shopCat) || (cats[0] ? cats[0].key : 'material');
    ui._pages['shop-items'] = 1;
    ui.setView('shop');
  };
  ui.renderShop = function () {
    if (ui.view !== 'shop') return;
    ui.repaintView(function () { return ui.shopHTML(); });
  };
  ui.setShopCat = function (c) { ui._shopCat = c; ui._pages['shop-items'] = 1; ui.renderShop(); };

  /* ============================================================
   * 物品贴图（v29 · 需求 14：「图标整好看一点」）
   * ------------------------------------------------------------
   * 改前是**光秃秃一枚图标**直接贴在卡片上：不同品阶看不出差别，
   * 24 个材料格子看上去像同一批小方块。
   * 现在统一加一层「贴图承台」：
   *   · 品阶底纹（凡/良/珍/神 四档渐变，与装备品质色一致）
   *   · 内高光 + 外投影，把图标从背景里"抬"起来
   *   · 右下角品阶珠（1~4 颗），远看就能分档
   * 图标本身仍由 icons.js 手绘 SVG 提供 —— 这里只做承台，不重画图形。
   * ============================================================ */
  ui.itemArt = function (kind, id, q) {
    var svg = '', slot = null, icoType = null, matId = null;
    if (kind === 'equip') {
      var e = DATA.EQUIP[id];
      slot = e && e.slot;
      svg = (GAME.icons.forEquip && slot) ? GAME.icons.forEquip(slot) : '';
    } else if (kind === 'mat') {
      matId = id;
      svg = (GAME.icons.forMat ? GAME.icons.forMat(matId) : '') || '';
    } else if (kind === 'bp') {
      icoType = 'blueprint';
      svg = (GAME.icons.forItem ? GAME.icons.forItem('blueprint', id) : '') || '';
    } else {
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
      icoType = it ? it.type : 'jewel';
      svg = (GAME.icons.forItem ? GAME.icons.forItem(icoType, id) : '') || '';
    }
    var qq = Math.max(1, Math.min(6, q || 1));   /* v88：基因强化件品质到 6（机甲 q<=4 不受影响） */
    /* 材料自带品阶珠（icons.js 里已画），不再重复叠一层 */
    var gems = (kind === 'mat') ? '' : new Array(qq + 1).join('<i></i>');
    return '<span class="ia q' + qq + '">' +
      '<span class="ia-art">' + svg + '</span>' +
      '<span class="ia-gem">' + gems + '</span></span>';
  };

  /* ============================================================
   * 物品行（v29 · 需求 14）
   * ------------------------------------------------------------
   * 游商与背包共用：**左侧贴图 · 右侧介绍 · 下方操作栏**
   * （左＝数量输入框 + −/＋/最多；右＝主操作按钮）。
   * 数量输入框是"带加减号的输入框"：既能一键微调，也能直接键入大数，
   * 不像一堆固定档位的 chip 那样"想买 37 个就只能买 50 个"。
   * ============================================================ */
  ui.itemRow = function (o) {
    /* v89.117：可选**整行点选**（制造厂把"逐卡打造键"收成"选一件 + 底部一个键"）——
       只有传了 pickAction 才挂 data-action，既有调用点不受影响。 */
    var pick = o.pickAction ? ' data-action="' + o.pickAction + '" data-item="' + o.pickItem + '"' : '';
    /* v90.44（老板）：卡片级悬停提示（费用等"数额"走这里，不占版面）。 */
    var tip = o.tip ? ' title="' + U.escape(String(o.tip).replace(/<[^>]+>/g, '')) + '"' : '';
    return '<div class="item-row' + (o.cls ? ' ' + o.cls : '') + (o.sel ? ' on' : '') + '"' + pick + tip + '>' +
      '<div class="ir-art">' + ui.itemArt(o.kind, o.id, o.q) + '</div>' +
      /* v89.140（老板 6）：「物品简介改**悬停显示**」——hoverDesc 时 desc 走 title
         （卡片内不再占一行 → 卡片等高、位置固定）。 */
      '<div class="ir-info"' + ((o.hoverDesc && o.desc)
        ? ' title="' + U.escape(String(o.desc).replace(/<[^>]+>/g, '')) + '"' : '') + '>' +
        '<div class="ir-name">' + o.name + (o.tagHtml || '') + '</div>' +
        '<div class="ir-meta">' + (o.meta || '') + '</div>' +
        ((!o.hoverDesc && o.desc) ? '<div class="ir-desc">' + o.desc + '</div>' : '') +
      '</div>' +
      '<div class="ir-foot">' +
        '<div class="ir-left">' + (o.qtyHtml || '') + (o.totalHtml || '') + '</div>' +
        '<div class="ir-right">' + (o.actHtml || '') + '</div>' +
      '</div></div>';
  };
  /* 数量输入框 + 加减 + 最多（inputId 同时也是"合计"文本节点的前缀） */
  ui.qtyInput = function (inputId, init, unit, cap, noMax) {
    return '<span class="qty-input">' +
      '<button class="qi-btn" data-action="qty-step" data-for="' + inputId + '" data-d="-1" title="减少数量">−</button>' +
      '<input type="number" id="' + inputId + '" min="1" value="' + init + '" ' +
        'data-unit="' + (unit || 0) + '" data-cap="' + (cap || 0) + '">' +
      '<button class="qi-btn" data-action="qty-step" data-for="' + inputId + '" data-d="1" title="增加数量">＋</button>' +
      (noMax ? '' : '<button class="qi-btn max" data-action="qty-max" data-for="' + inputId + '">最多</button>') +
      '</span>';
  };
  /* 加减 / 最多：只改**输入框的值与合计文字**，不重绘 ——
     重绘会把玩家刚键入的数字清掉（募兵数量上踩过这个坑）。 */
  ui.qtyStep = function (el) {
    var id = el.getAttribute('data-for');
    var inp = document.getElementById(id);
    if (!inp) return;
    var d = Number(el.getAttribute('data-d')) || 0;
    inp.value = Math.max(1, Math.floor(Number(inp.value) || 1) + d);
    ui.qtySync(id);
  };
  ui.qtyMax = function (el) {
    var id = el.getAttribute('data-for');
    var inp = document.getElementById(id);
    if (!inp) return;
    inp.value = Math.max(1, Math.floor(Number(inp.getAttribute('data-cap')) || 1));
    ui.qtySync(id);
  };
  ui.qtySync = function (inputId) {
    var inp = document.getElementById(inputId);
    var tot = document.getElementById(inputId + '-total');
    if (!inp || !tot) return;
    var unit = Number(inp.getAttribute('data-unit')) || 0;
    var cap = Number(inp.getAttribute('data-cap')) || 0;
    var n = Math.max(1, Math.floor(Number(inp.value) || 1));
    if (cap > 0 && n > cap) { n = cap; inp.value = n; }
    tot.textContent = (tot.getAttribute('data-label') || '合计') + ' ' + U.numText(unit * n, 0) + ' 旧币';
  };
  /* 读某行的数量（实付/使用以**输入框当前值**为准） */
  ui.qtyValueOf = function (inputId) {
    var el = document.getElementById(inputId);
    return Math.max(1, Math.floor(Number(el && el.value) || 1));
  };

  /* ============================================================
   * 游商（v25 起为整页视图；v29 · 需求 14 换版式）
   * ------------------------------------------------------------
   * 版式由"竖卡 + 一颗按钮"改为**物品行**：左贴图 / 右介绍 / 下方操作栏。
   * 两列铺排、每页 8 行；分页条仍统一在屏幕下方的固定条里。
   * 每行自带数量输入框 —— 买几个就在那一行填，不必先选一个"全局数量"。
   * ============================================================ */
  ui.SHOP_COLS = 2;
  ui.shopQtyCapOf = function (it) {
    var unit = (it && it.price ? it.price : 0) * 100;
    if (unit <= 0) return 1;
    return Math.max(1, Math.floor((GAME.state.res.gold || 0) / unit));
  };
  ui.shopHTML = function () {
    var s = GAME.state;
    var all = ui.shopItems();
    var cats = ui.shopCatOf(all);
    var cat = ui._shopCat || (cats[0] && cats[0].key);
    /* v89.121：同一显示名下的多个 type 合并成一页（如「民生」= pop_boost + pop_fill）。
       `_shopCat` 的语义**保持 type**（组的 key = 该组第一个 type）——既有断言零改动。 */
    var cur = null;
    for (var ci = 0; ci < cats.length; ci++) {
      if (cats[ci].key === cat || cats[ci].types.indexOf(cat) >= 0) cur = cats[ci];
    }
    if (!cur) cur = cats[0] || { key: cat, name: ui.SHOP_CATS[cat] || cat, types: [cat] };
    /* v89.155（老板 4）：同功能相邻、由小到大（内置标号，不显示） */
    var items = all.filter(function (it) { return cur.types.indexOf(it.type) >= 0; })
      .sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });
    var per = ui.SHOP_PER_PAGE;
    var p = ui.pageOf('shop-items', items.length, per);
    var slice = items.slice(p.from, p.to);
    ui.pagerHTML('shop-items', items.length, per);

    var tabs = cats.map(function (g) {
      var n = all.filter(function (it) { return g.types.indexOf(it.type) >= 0; }).length;
      return '<span class="shop-cat' + (g.key === cur.key ? ' on' : '') + '" data-action="shop-cat" data-c="' + g.key + '">'
        + g.name + '<i>' + n + '</i></span>';
    }).join('');

    var rows = slice.map(function (it) {
      var price = it.price * 100;
      var cap = ui.shopQtyCapOf(it);
      var canBuy = (s.res.gold || 0) >= price;
      var have = (s.items || {})[it.id] || 0;
      var inputId = 'sq-' + it.id;
      return ui.itemRow({
        kind: 'item', id: it.id, q: 1,
        name: U.escape(it.name),
        /* v90.44（老板）：「耗费资源的操作不要直接显示数额，改为悬停显示」——
           单价从行上撤下（只留「持有」），改挂**购买按钮**悬停。
           v91.59（老板）：加「今日 N/20」（每现实日购买上限）。 */
        meta: '持有 ' + U.numText(have, 0) + '　·　今日 ' + GAME.shopBoughtToday(it.id) + '/' + GAME.shopDailyMax(),
        desc: GAME.itemEffect(it) || '',
        hoverDesc: true,          /* v89.140（老板 6）：简介悬停显示（卡片固定高、位置固定） */
        /* v89.145（老板 1）：「购买数量那里不要**最多**这个功能 —— 总不能那点旧币
           全买了同一件商品，日子还过不过了」。第 5 参 noMax=true → 不渲染「最多」键；
           −/＋ 与直接键入都在（数量上限 data-cap 仍守着 qtySync 的越界钳制）。 */
        qtyHtml: ui.qtyInput(inputId, 1, price, cap, true),
        /* v90.44（老板）：「不要直接显示数额」——「合计 N 旧币」一并撤除（单价在购买按钮悬停）。 */
        actHtml: '<button class="btn' + (canBuy ? ' gold' : ' dim') + '" data-action="shop-buy" data-item="' + it.id + '"' +
          ' title="单价 ' + U.numText(price, 0) + ' 旧币　·　持有旧币 ' + U.numText(s.res.gold || 0, 0) + '"' +
          (canBuy ? '' : ' disabled data-why="旧币不足：需 ' + U.numText(price, 0) + ' 旧币"') + '>购买</button>',
      });
    }).join('');

    /* v89.145（老板 1）：「不足 4 行时仍会下方留白 —— 要不要无论如何都撑满？」→ **撑满**。
       `shop-fill` 从"满页才挂"改成**恒定挂**：3 行 / 2 行 / 1 行的分类同样铺满可视区
       （行高按行数平分；窗口矮到 <116px/行 时物品区内部滚动，见 CSS）。
       v89.143 的"不满不硬拉"是旧口径 —— 本轮按老板拍板整条改掉。 */
    return '<div class="ui-page shop-page">' +
      '<div class="gold-heading">🛒 游商 · ' + (ui.SHOP_CATS[cat] || cat) +
        ui.help('每行左侧贴图、右侧说明；下方填数量（可点 −/＋ 微调，或直接键入）后点「购买」。\n' +
          '单价 = 元宝价 × 100 旧币；分页条固定在屏幕下方。') +
      '</div>' +
      '<div class="shop-cats">' + tabs + '</div>' +
      (rows ? '<div class="shop-rows shop-fill">' + rows + '</div>'
        : '<div class="q-empty">该分类暂无商品。</div>') +
      '</div>';
  };

  /* ============================================================
   * 制造厂 · 打造（v29 · 需求 12）
   * ------------------------------------------------------------
   * 改前：一个 48 件的长列表塞在弹窗里，每件一行小字 + 一颗按钮，
   *   品质、材料、图纸三种"能不能造"的原因挤在同一段文字里，
   *   而且**弹窗尺寸随品阶分页变化**，翻页时窗口会跳。
   * 改后照游商的样子重做：固定尺寸弹窗 + 品质点选 + 物品行
   *   （左贴图 / 右：部位·品质·属性·材料需求 / 下：数量 + 打造）。
   * ============================================================ */
  ui._forgeQ = 1;
  /* v89.201（老板 2）：「打造套装可以多选套件，一次性打造」——
     选中从**单值**（_forgeSel）升级为**保序数组** _forgeSelList；旧单值整条退役。 */
  ui._forgeSelList = [];
  /* 每页件数：3 列 × 2 行（列数见 index.html 的 .forge-rows）。
     定 6 的依据是**弹窗正文的可视高度**，不是手感 —— 实测 lg(860×600) 下正文只有 433px，
     而底部「套装效果」表就要 105px，再加两行卡片必然溢出（改前溢出 576px，弹窗内出现滚动条）。
     换 xl(960×660) 后正文约 493px，2 行卡片 + 套装表 + 分页条刚好放得下。 */
  ui.FORGE_PER_PAGE = 6;
  /* 切品质 / 切类别 → **页码归零**。
     否则在"全部·3 页"里翻到第 3 页再切到只有 1 页的品质，会停在一个越界页上
     （ui.pageOf 只会把它夹到末页，夹完显示的是"最后一页"而不是第一页，读起来像丢了内容）。 */
  ui.setForgeQ = function (q) {
    ui._forgeQ = Number(q) || 1;
    ui._pages['forge'] = 1;
    ui.openForge();
  };
  /* v89.117：点选一件（再按底部「打造」）—— 只重绘面板，不弹新窗（同级刷新）
     v89.201（老板 2）：**多选** —— 点一件加入选集、再点一次取消（toggle），
     底部一键**一次打造全部选中件**（套装整套一起打的场景）。 */
  ui.forgePick = function (itemId) {
    if (!itemId) return;
    ui._forgeSelList = ui._forgeSelList || [];
    var i = ui._forgeSelList.indexOf(String(itemId));
    if (i >= 0) ui._forgeSelList.splice(i, 1);
    else ui._forgeSelList.push(String(itemId));
    ui.openForge();
  };
  /* v89.201：清空选集 / 全选当前列表（toggle：已全选时再点=取消全选） */
  ui.forgeClear = function () { ui._forgeSelList = []; ui.openForge(); };
  ui.forgeAllSet = function () {
    var pool = ui._forgePool || [];
    var ids = pool.map(function (f) { return String(f.id); });
    var allIn = ids.length > 0 && ids.every(function (id) {
      return (ui._forgeSelList || []).indexOf(id) >= 0;
    });
    ui._forgeSelList = allIn ? [] : ids;
    ui.openForge();
  };
  /* v89.117：具体套装筛选（唯一出口：chips、断言都读它） */
  ui.setForgeSet = function (sid) {
    ui._forgeSet = String(sid || '');
    ui._pages['forge'] = 1;
    ui.openForge();
  };
  ui.setForgeKind = function (k) {
    ui._forgeKind = (k === 'set' || k === 'solo') ? k : 'all';
    ui._pages['forge'] = 1;
    ui.openForge();
  };
  /* v90.56（老板）：制造厂**部位筛选**（唯一出口；点部位 chip 或从装备更换进来定位）。 */
  ui.setForgeSlot = function (sl) {
    ui._forgeSlot = String(sl || '');
    ui._pages['forge'] = 1;
    ui.openForge();
  };
  /* 从装备更换「该部位无货」入口 → 关掉更换窗、开制造厂并定位到该部位。 */
  ui.openForgeAtSlot = function (slot) {
    ui.closeModal();                 /* 先关「更换」窗（回落到英雄面板），再开制造厂 */
    ui._forgeSlot = String(slot || '');
    ui._pages['forge'] = 1;
    ui.openForge();
  };
  /* ⛔ v89.204（老板 2）：「打造界面不要'套装效果一览'」——
     ui.forgeSetNote / ui.openForgeSetInfo / 底部按钮 / case 'forge-setinfo' 整条退役。
     沿革：v38 建（打造面板正文）→ v51 移独立小窗（正文腾 105px）→ v89.204 整条删。
     套装**数据**（DATA.SETS）不动 —— 卡面套装名、加成结算照常消费。
     回退点 = v89.203 快照（backup/v89204）。 */
  ui.forgeRow = function (f, lv) {
    var it = f.item;
    var qName = DATA.Q_NAME[f.q] || ('Q' + f.q);
    var slotName = DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot;
    /* 材料需求逐项列出，缺的标红 —— 一眼看出"差哪一味"，
       并顺带标出**这一味出自哪个区**、自己有没有据其首府 ——
       三/四阶材料是长线目标，玩家最常卡在"不知道去哪弄"。
       （这也是 ui.matSpecialtyStates 的消费点：此前它只被旧打造面板用过。） */
    var myStates = {};
    (GAME.state.cities || []).forEach(function (c) { if (c.state) myStates[c.state] = 1; });
    var matParts = Object.keys(f.mats || {}).map(function (mk) {
      var md = DATA.MATERIAL_BY_ID[mk];
      var have = (GAME.state.items || {})[mk] || 0;
      var need = f.mats[mk];
      var states = ui.matSpecialtyStates(mk);
      var src = '';
      if (states.length) {
        var held = states.filter(function (st) { return myStates[st]; });
        src = '（' + states.join('/') + '特产' +
          (held.length ? '　<b style="color:var(--green-ok);">已据' + held.join('/') + '</b>' : '') + '）';
      }
      /* v89.89（A4 · 100+ 轮实玩期待）：产地就地可查 + 点击跳转 ——
         悬停出完整产地说明（哪些区 / 是否已据 / 跳转指引）；🗺️ 一键定位产地
         （已据 → 自己的城；未据 → 首府，时序沿用地图定位惯例）。 */
      var mtip = states.length
        ? ' data-tip="产地：' + states.join('、') + '（首府特产）' +
          (held.length ? '；已据 ' + held.join('、') : '；尚未据有 —— 点 🗺️ 定位该区') + '"'
        : '';
      var mgo = states.length
        ? '<span class="mat-go" data-action="mat-go" data-mat="' + mk +
          '" title="前往产地（首府）">🗺️</span>'
        : '';
      return '<span class="' + (have >= need ? '' : 'lack') + '"' + mtip + '>' +
        (md ? md.name : mk) + ' ' + have + '/' + need + src + mgo + '</span>';
    });
    var blockers = [];
    if (!f.tierOk) blockers.push('需制造厂 Lv' + (DATA.FORGE.tierLv[f.q - 1] || 7));
    if (!f.bpOk) blockers.push('缺图纸「' + (f.bp ? f.bp.name : '') + '」');
    if (!f.matsOk) blockers.push('材料不足');
    var jwMissing = false;
    /* v91.72（老板）：「目前装备需求加上了奇迹材料，但是在制造厂中还没有把相应信息做好」——
       奇观材料（走 cost.jewel 键）单独列一行，与普通材料**间隔开**；
       缺什么标红（与 GAME.canAfford 同一份 cost，不另算）。 */
    var jwNeed = GAME.jewelNeedOf ? GAME.jewelNeedOf(f.cost) : {};
    var jwParts = Object.keys(jwNeed).map(function (jid) {
      var inv = (GAME.state.items || {})[jid] || 0, need2 = jwNeed[jid];
      var jn = ((DATA.ITEM_BY_ID || {})[jid] || {}).name || jid;
      if (inv < need2) jwMissing = true;
      return '<span class="' + (inv >= need2 ? '' : 'lack') + '">' + U.escape(jn) + ' ' + inv + '/' + need2 + '</span>';
    });
    if (!GAME.canAfford(f.cost)) blockers.push(jwParts.length ? '奇观材料 / 资材不足' : '资材不足');
    var ok = !blockers.length;
    /* v89.87（老板需求 1）：缺什么就地可买（只在真缺时渲染 —— 不占常态高度）。
       v91.72（老板）：「如果材料不足，可以放在点选那一行上，不占据装备信息展示空间」——
       qb 按钮从卡片正文移到**点选行**（actHtml）。 */
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
    }
    /* 打造是**一次一件**（套装件每件都要消耗一张图纸），所以这里不放数量框 ——
       放了反而会让人以为能一次造十个。数量框留给"买/用"这类可批量的事。 */
    return ui.itemRow({
      kind: 'equip', id: f.id, q: f.q,
      name: U.escape(it.name),
      tagHtml: '<span class="ir-tag">' + qName + '</span>' +
        (it.set && DATA.SETS[it.set]
          ? '<span class="ir-tag set">' + U.escape(DATA.SETS[it.set].name) + '</span>'
          : '<span class="ir-tag">散件</span>'),
      /* v90.44（老板）：「造价」不再内联（数额入卡片悬停）；材料名（品类）保留。 */
      meta: slotName + '　' + U.escape(GAME.equipDesc(it) || ''),
      tip: '造价 ' + (GAME.costString(f.cost) || '—'),
      /* v51：卡片瘦身两处 —— 都是"同一条信息已有别的出处"，删掉不丢东西：
         ① meta 里原有一行「套装门槛 x/y/z 件」：套装的 tag 已标出套名，
            底部的「套装效果」表也逐档列了门槛与加成，这里第三遍；
         ② desc 原本**总是**两行（材料 ＋ 条件结论），其中"条件齐备，可以打造"
            只是复述按钮状态（可造时按钮是金色、不可造时是灰的且禁用）。
            改成**只在有阻塞时才写字**——缺料/缺图纸/资材不足这些"差什么"必须一眼看到，
            而"什么都不缺"不需要文字。
         两处合起来给每张卡省约 38px：208 → 170。这不是审美，是能否放下两行的硬数
         （正文 434px 里 2×208 = 416 差 1px 装不下，2×170 = 340 才有余量）。 */
      desc: '材料：' + (matParts.join('　') || '无') +
        /* v91.72：奇观材料独立一行（与普通材料之间留 4px 间隔）。 */
        (jwParts.length ? '<br><span style="display:inline-block;margin-top:4px;">奇观材料：' +
          jwParts.join('　') + '</span>' : '') +
        (ok ? '' : '<br><span style="color:var(--red-light);">' + blockers.join('　') + '</span>'),
      /* v89.117（老板「太多打造按钮了，统一成一个放在底部」）：
         逐卡「打造」键退役 —— 卡片改为**可点选**，底部只有一个打造键（动作名沿用
         `forge-item`，改从选中集取件；v89.201 起为多选 _forgeSelList）。"点选"提示占位极小，
         而省下的是每张卡一整个按钮的高度。 */
      /* v91.72：缺料按钮进「点选」这一行（不占装备信息展示空间）。 */
      actHtml: (qbBtns ? '<span class="ir-lack" style="display:inline-flex;gap:2px;flex-wrap:wrap;margin-right:6px;">' +
          qbBtns + '</span>' : '') +
        '<span class="ir-pick">' + ((ui._forgeSelList || []).indexOf(String(f.id)) >= 0 ? '✔ 已选' : '点选') + '</span>',
      pickAction: 'forge-pick', pickItem: f.id,
      sel: ((ui._forgeSelList || []).indexOf(String(f.id)) >= 0),
    });
  };
  ui.openForge = function () {
    var lv = GAME.forgeLevel();
    if (lv <= 0) {
      ui.openShell({
        title: '⚒️ 制造厂', size: 'sm',
        body: '<div class="q-empty">尚未建造制造厂。<br>在城内空地上建造「制造厂」后即可打造装备。</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var maxQ = GAME.forgeMaxQ();
    var list = GAME.forgeList();
    var s = GAME.state;
    /* v38（需求 3）：先分「套装 / 散件」，再按品质分页 ——
       原先两者混在一张长单列里，挑一套要整页翻。 */
    var kind = ui._forgeKind || 'all';
    var isSet = function (f) { return !!(f.item && f.item.set); };
    var setsOnly = list.filter(isSet);
    var soloOnly = list.filter(function (f) { return !isSet(f); });
    var pool = kind === 'set' ? setsOnly : (kind === 'solo' ? soloOnly : list);
    /* v89.117（老板「上方的类别选择，再加一个具体套装，方便制作同一套装下的装备」）：
       按**套装 id** 再筛一道（只列这批可打造件里真出现的套装）。 */
    var setIdCur = ui._forgeSet || '';
    var setIdsInPool = [];
    setsOnly.forEach(function (f) {
      var sid = f.item.set;
      if (sid && setIdsInPool.indexOf(sid) < 0) setIdsInPool.push(sid);
    });
    if (setIdCur && setIdsInPool.indexOf(setIdCur) < 0) { setIdCur = ''; ui._forgeSet = ''; }
    if (kind === 'set' && setIdCur) pool = pool.filter(function (f) { return f.item.set === setIdCur; });
    /* v90.56（老板）：**部位筛选** —— 从装备更换「该部位无货」入口进来时定位到该部位。 */
    var slotCur = ui._forgeSlot || '';
    var slotsInPool = [];
    pool.forEach(function (f) { var sl = f.item && f.item.slot; if (sl && slotsInPool.indexOf(sl) < 0) slotsInPool.push(sl); });
    if (slotCur && slotsInPool.indexOf(slotCur) < 0) { slotCur = ''; ui._forgeSlot = ''; }
    if (slotCur) pool = pool.filter(function (f) { return f.item.slot === slotCur; });
    var slotRow = slotsInPool.length > 1
      ? '<span class="ff-k">部位</span><span class="shop-cats">' +
        [['', '全部']].concat(slotsInPool.map(function (sl) { return [sl, (DATA.EQUIP_SLOT_NAMES[sl] || sl)]; }))
          .map(function (k) {
            return '<span class="shop-cat' + (slotCur === k[0] ? ' on' : '') +
              '" data-action="forge-slot" data-s="' + k[0] + '">' + U.escape(k[1]) + '</span>';
          }).join('') + '</span>'
      : '';
    var kindHtml = [['all', '全部', list.length], ['set', '套装', setsOnly.length], ['solo', '散件', soloOnly.length]]
      .map(function (k) {
        return '<span class="shop-cat' + (kind === k[0] ? ' on' : '') +
          '" data-action="forge-kind" data-k="' + k[0] + '">' + k[1] + '<i>' + k[2] + '</i></span>';
      }).join('');
    var setRow = (kind !== 'set' || !setIdsInPool.length) ? ''
      : '<span class="ff-k">套装</span><span class="shop-cats">' +
        [['', '全部', setsOnly.length]].concat(setIdsInPool.map(function (sid) {
          return [sid, (DATA.SETS[sid] && DATA.SETS[sid].name) || sid,
            setsOnly.filter(function (f) { return f.item.set === sid; }).length];
        })).map(function (k) {
          return '<span class="shop-cat' + (setIdCur === k[0] ? ' on' : '') +
            '" data-action="forge-set" data-s="' + k[0] + '">' + U.escape(k[1]) + '<i>' + k[2] + '</i></span>';
        }).join('') + '</span>';
    var curQ = ui._forgeQ;
    var qs = [1, 2, 3, 4, 5, 6].filter(function (q) { return pool.some(function (f) { return f.q === q; }); });
    if (qs.indexOf(curQ) < 0) { curQ = qs[0] || 1; ui._forgeQ = curQ; }
    var rows = pool.filter(function (f) { return f.q === curQ; });
    /* v51（老板：**稍微放大一点、调节一下、搞成翻页**）：
       改前 size 'lg'（860×600）+ 4 列 + 不分页 —— 实测正文只有 433px、
       内容却有 1009px（**溢出 576px**，弹窗里出现滚动条，也违反"弹窗内一律分页"的约定）；
       而且 4 列挤在 822px 里每格只剩 198px，卡片的部位/造价/材料三行全在折行，
       卡片被撑到 265px 高 —— 越挤越高，越发放不下。
       改后：① 弹窗提到 **xl**（960×660，正文 ~493px）；② 列表换**独立类 `.forge-rows` = 3 列**
       （每格 ≈300px，接近游商主视图 317px 的舒适宽度，卡片反而变矮）；
       ③ 走 `ui.modalPage` 分页，**3 列 × 2 行 = 6 件/页**。 */
    /* 选中集：只认**在册**的件（v89.201：单选 → 多选保序数组 _forgeSelList；
       跨页/跨品质保留 —— 换筛选后仍在册的不清空） */
    var listById = {};
    list.forEach(function (f) { listById[f.id] = f; });
    var selIds = (ui._forgeSelList || []).filter(function (id) { return !!listById[id]; });
    ui._forgeSelList = selIds;
    /* 逐件预检：**至少一件可造**才能按（部分可造时点按 = 能造的造掉、不能的留在选集） */
    var blockList = [];
    selIds.forEach(function (id) {
      var f2 = listById[id], b2 = [];
      if (!f2.tierOk) b2.push('需制造厂 Lv' + (DATA.FORGE.tierLv[f2.q - 1] || 7));
      if (!f2.bpOk) b2.push('缺图纸');
      if (!f2.matsOk) b2.push('材料不足');
      if (!GAME.canAfford(f2.cost)) b2.push('资材不足');
      if (b2.length) blockList.push(f2.item.name + '（' + b2.join('、') + '）');
    });
    var selOk = selIds.length > 0 && blockList.length < selIds.length;
    var selWhy = blockList.join('；');
    ui._forgePool = pool;    /* v89.201：当前筛选池（「全选」的作用域 = 玩家眼下看到的这批） */
    var pg = ui.modalPage('forge', rows, ui.FORGE_PER_PAGE, function () { ui.openForge(); });
    var tabHtml = qs.map(function (q) {
      var n = pool.filter(function (f) { return f.q === q; }).length;
      var okN = pool.filter(function (f) { return f.q === q && f.tierOk; }).length;
      return '<span class="shop-cat' + (q === curQ ? ' on' : '') + '" data-action="forge-q" data-q="' + q + '">' +
        (DATA.Q_NAME[q] || ('Q' + q)) + '<i>' + okN + '/' + n + '</i></span>';
    }).join('');
    ui.openShell({
      /* v89.136（上轮清单① live 续铺）：逐秒刷新（旧币/铁/木/石随打造即时变） */
      live: function () { ui.openForge(); },
      title: '⚒️ 制造厂 · Lv' + lv,
      sub: '可打造至「' + (DATA.Q_NAME[maxQ] || '—') + '」　旧币 ' + U.numText(s.res.gold || 0, 0) +
        '　废钢 ' + U.numText(s.res.iron || 0, 0) + '　生物质 ' + U.numText(s.res.wood || 0, 0) +
        '　电能 ' + U.numText(s.res.stone || 0, 0),
      size: 'xl',
      body: '<div class="forge-filter">' +
          '<span class="ff-k">类别</span><span class="shop-cats">' + kindHtml + '</span>' +
          setRow +
          slotRow +
          '<span class="ff-k">品质</span><span class="shop-cats">' + tabHtml + '</span>' +
          /* v51：两段常驻说明搬进帮助入口（原本占正文 146px，约等于一整行卡片，
             而正文高度是这条面板最稀缺的资源 —— 一屏能不能放两行就卡在这）。
             搬走的是**参考资料**（材料去哪打、套装各档加多少），不是操作项：
             材料需求与缺料原因仍在每张卡片上；套名与门槛在卡片 tag 上。 */
          ui.help('打造是**一次一件**（套装件每件消耗图纸 1 张）。\n' +
            '材料来源：攻打野地按地形采集 · 攻占城市缴获 · 已占**首府**的岁贡持续供应本区特产（三、四阶材料的主要活路）。\n' +
            '套装件另需**图纸**：游商可购，攻占重镇 18% / 首府 40% / 旧都 80% 缴获，遗迹古冢亦有。') +
        '</div>' +
        (rows.length ? '<div class="forge-rows">' + pg.slice.map(function (f) { return ui.forgeRow(f, lv); }).join('') + '</div>'
          : '<div class="q-empty">' + (kind === 'set' ? '该品质暂无套装件。'
            : kind === 'solo' ? '该品质暂无散件。' : '该品质暂无可打造之物。') + '</div>'),
      /* v89.117（老板「统一成一个放在底部，跟百炼强化啥的放一起就行」）：
         底部三个键：**打造**（唯一入口，认选中件）/ 熔铸强化 / 套装效果一览。
         动作名仍叫 `forge-item`（既有派发与选择器零改动），件号改从 ui._forgeSelList 取。 */
      /* v89.140（老板 5）：「翻页设置放在当前界面的**底部**」——分页条从正文末尾
         挪到 foot（弹窗下沿固定区），翻页不用再滚到底。
         v89.140（老板 4）：底部的「熔铸强化」按钮**删去**（已搬到制造厂建筑菜单上）。 */
      foot: '<div class="m-foot">' + (rows.length ? pg.pager : '') +
        '<button class="btn' + (selOk ? ' gold' : ' dim') + '" data-action="forge-item"' +
          (selOk ? '' : ' disabled data-why="' + U.escape(selIds.length
            ? ('选集内均不可打造：' + selWhy) : '先在下方点选一件要打造的装备（可多选）') + '"') + '>⚒ 打造' +
          (selIds.length === 1 ? '：' + U.escape(listById[selIds[0]].item.name)
            : (selIds.length ? ' ' + selIds.length + ' 件' : '（先在下方点选）')) + '</button>' +
        (selIds.length ? '<button class="btn" data-action="forge-clear">✕ 清空选择</button>' : '') +
        (selIds.length && selWhy ? '<span class="op-hint">' + U.escape(selWhy.slice(0, 48)) + '</span>' : '') +
        (pool.length ? '<button class="btn" data-action="forge-allset" title="全选当前列表（含本页之外），再点一次取消">⚑ 全选</button>' : '') +
        /* v89.204（老板 2）：「套装效果一览」按钮随该功能整条退役（见上方墓碑） */
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
  /* ⛔ v89.204：`ui.openForgeSetInfo`（独立小窗）随「套装效果一览」整条退役 ——
     与 ui.forgeSetNote 同批，沿革见上方墓碑。 */


  /* ============================================================
   * 熔铸强化（v77 · 老板「制造厂加入装备强化系统，装备可进行强化」· v89.227 更名，原名「百炼强化」）
   * ------------------------------------------------------------
   * 列出**已拥有**的装备（背包 + 已穿戴；GAME.enhList）。
   * 等级与效果都走唯一出口（GAME.enhOf / genEquipBonus），这里只做呈现。
   * ⛔ v89.201（老板 3）：「百炼强化应该参考打造界面或背包装备界面，
   *   一个专属界面进行强化操作。而且目前点一次，滚动条就自动回到顶部，
   *   又得手动滚动下来」——
   *   ① 单列列表（lg 小窗）改**专属界面**：xxl 档 + 顶部筛选（全部/未满/满级）+
   *      3 列网格卡片（品阶图 + 名称·序号 + 大号 +N/上限 + 下级成本）+
   *      点选（enh-pick）+ **底部唯一强化键**（与打造面板同款"点选 + 底键"形态）+
   *      分页（ui.ENH_PER_PAGE/页）。原"每行一颗强化键"整排退役。
   *   ② 滚动回顶：doEnhance/enhPick 重开面板走 ui.reopenKeepScroll（快照回填），
   *      并挂 live 每秒刷新（旧币随税收/强化即时变；live 快照本就含滚动位）。
   * ============================================================ */
  ui.ENH_PER_PAGE = 15;          /* 3 列 × 5 行（xxl 正文 ~690px，卡高 84px + 行距） */
  ui._enhSel = null;             /* 选中的件（key = 件号 u 或装备 id，String 化比对） */
  ui._enhFilter = 'all';         /* 筛选：all / todo（未满）/ done（满级） */
  /* 件 key 唯一出口（卡片点选 / 选中比对 / 底键 data-item 三处同源）
     v89.202：调校面板同用（两体系同一把尺 · 不另造）。 */
  ui.enhKeyOf = function (inst) {
    var k = GAME.eqUidOf(inst);
    return String(k != null ? k : GAME.eqId(inst));
  };
  ui.setEnhFilter = function (k) {
    ui._enhFilter = (k === 'todo' || k === 'done') ? k : 'all';
    ui._pages['enh'] = 1;
    ui.openEnhance();
  };
  ui.enhPick = function (key) {
    if (key == null) return;
    key = String(key);
    ui._enhSel = (ui._enhSel === key) ? '' : key;
    ui.reopenKeepScroll(ui.openEnhance);      /* v89.201：点选也保留滚动位（不再跳回顶部） */
  };
  ui.openEnhance = function () {
    if (GAME.forgeLevel() <= 0) {
      ui.openShell({
        title: '⚒ 熔铸强化', size: 'sm',
        body: '<div class="q-empty">尚未建造制造厂。<br>在城内空地上建造「制造厂」后即可打造与强化装备。</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var list = GAME.enhList();
    var perLv = Math.round(((DATA.ENHANCE || {}).perLv || 0.08) * 100);
    var maxE = GAME.enhMax();
    var filt = ui._enhFilter || 'all';
    var pool = list.filter(function (inst) {
      if (filt === 'todo') return GAME.enhOf(inst) < maxE;
      if (filt === 'done') return GAME.enhOf(inst) >= maxE;
      return true;
    });
    /* 选中件只认**池内**（换筛选把选中件筛出池外 → 自动清空，避免"看不见的选中"） */
    var selInst = null;
    pool.forEach(function (x) { if (ui.enhKeyOf(x) === ui._enhSel) selInst = x; });
    if (!selInst) ui._enhSel = '';
    var nTodo = list.filter(function (x) { return GAME.enhOf(x) < maxE; }).length;
    var filtHtml = [['all', '全部', list.length], ['todo', '未满', nTodo], ['done', '满级', list.length - nTodo]]
      .map(function (k) {
        return '<span class="shop-cat' + (filt === k[0] ? ' on' : '') +
          '" data-action="enh-filter" data-k="' + k[0] + '">' + k[1] + '<i>' + k[2] + '</i></span>';
      }).join('');
    var pg = ui.modalPage('enh', pool, ui.ENH_PER_PAGE, function () { ui.openEnhance(); });
    var cards = pg.slice.map(function (inst) {
      var id = GAME.eqId(inst);
      var it = DATA.EQUIP[id], lv = GAME.enhOf(inst);
      /* v89.214（老板 1）：卡面名称行**去掉 ·甲/·乙 序号** —— 同名件靠「强化等级 + 数值」
         区分（完全同级的件等价、可互换）；序号只在详情面板以「同名第 N / M 件」出现。 */
      var key = ui.enhKeyOf(inst);
      var cost = lv < maxE ? GAME.enhCost(inst) : null;
      var setNm = (it.set && DATA.SETS[it.set]) ? ('（' + DATA.SETS[it.set].name + '）') : '';
      /* v89.204（老板 2）：「强化界面的资源要求请以悬停显示，而不是直接占用位置」——
         成本行从卡面撤下（.ec-cost 退役），并入悬停文案。 */
      var tipE204 = GAME.eqLabel(inst) + setNm + '　'
        + (cost ? ('下级成本 ' + GAME.costString(cost)) : '已至满级');
      return '<div class="enh-card' + (key === ui._enhSel ? ' on' : '') +
          '" data-action="enh-pick" data-key="' + key + '"' +
          ' title="' + U.escape(tipE204) + '">' +
        '<span class="ec-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="ec-mid">' +
          '<span class="ec-nm"><b>' + U.escape(GAME.eqName(inst)) + '</b>' +
            '<i class="ec-tag">' + U.escape(GAME.qNameOf(it) || '') + '</i></span>' +
          '<span class="ec-lv">+' + lv + ' <i>/' + maxE + '</i></span>' +
        '</span></div>';
    }).join('') || '<div class="q-empty">' + (filt === 'todo' ? '全部装备都到满级了。'
      : (filt === 'done' ? '还没有满级装备。' : '背包与穿戴中还没有可强化的装备（先在制造厂打造几件）。')) + '</div>';
    /* 底键状态（与结算同一把尺：成本读 GAME.enhCost、资材读 GAME.canAfford） */
    var selLv = selInst ? GAME.enhOf(selInst) : -1;
    var selCost = (selInst && selLv < maxE) ? GAME.enhCost(selInst) : null;
    var canEnh = !!selCost && GAME.canAfford(selCost);
    var btnWhy = !selInst ? '先在下方点选一件装备（可先切「未满」筛选）'
      : (selLv >= maxE ? '「' + GAME.eqLabel(selInst) + '」已至 +' + maxE + '（满级）'
        : ('资材不足：下一级需 ' + GAME.costString(selCost)));
    /* v89.219（老板 1）：**套装整体强化** —— 选中件属套装且已拥有 ≥2 件时，底栏多一枚
       「整套 +1」键（一键把该套全部件各 +1；与单件键同款**长按连续**）。
       件集合 / 总价 / 上限全走唯一出口 GAME.enhSetInfoOf（展示与执行同源）。 */
    var setKey = (selInst && DATA.EQUIP[GAME.eqId(selInst)].set) || '';
    var setInfo = setKey ? GAME.enhSetInfoOf(setKey) : null;
    var setBtn = '';
    if (setInfo && setInfo.all.length >= 2) {
      var setCan = setInfo.todo.length > 0 && GAME.canAfford(setInfo.cost);
      var setWhy = !setInfo.todo.length
        ? '「' + setInfo.def.name + '」整套已至 +' + maxE + '（满级）'
        : ('整套资材不足：' + setInfo.todo.length + ' 件共需 ' + GAME.costString(setInfo.cost));
      setBtn = '<button class="btn' + (setCan ? ' gold' : ' dim') + '" data-action="enhance-set"' +
        ' data-set="' + U.escape(setKey) + '"' +     /* ⚠ 用 setKey（表键），不是 def.id（不存在） */
        ' title="' + U.escape(setInfo.def.name + '：已拥有 ' + setInfo.all.length + ' 件 · 本次可升 '
          + setInfo.todo.length + ' 件 · 共需 ' + GAME.costString(setInfo.cost)) + '"' +
        (setCan ? '' : ' disabled data-why="' + U.escape(setWhy) + '"') +
        '>⚒ 整套 +1（' + setInfo.todo.length + ' 件）</button>';
    }
    ui.openShell({
      /* v89.201：逐秒刷新（旧币随税收/强化即时变；live 快照自动保滚动位） */
      live: function () { ui.openEnhance(); },
      title: '⚒ 熔铸强化',
      sub: '按件强化（同名件看强化等级区分）　满级 +' + maxE + '　每级全属性 +' + perLv + '%（对原始值线性叠加 · 满级共 +' + Math.round(maxE * perLv) + '%）　旧币 '
        + U.numText(GAME.state.res.gold || 0, 0),
      size: 'xxl',
      body: '<div class="forge-filter">' +
          '<span class="ff-k">筛选</span><span class="shop-cats">' + filtHtml + '</span>' +
          ui.help('装备强化按件记录：同名多件各有各的等级（卡面 +N 即其等级）。\n' +
            '每级全属性 +' + perLv + '%（对原始值线性叠加；+10 = +80%，非复利）。\n' +
            '点选一件 → 底部「强化」键逐级强化 —— 长按可连续强化（按住不放即连升）。\n' +
            '套装件会多一枚「整套 +1」键：一键把该套全部件各升一级（同样支持长按）。') +
        '</div>' +
        '<div class="enh-rows">' + cards + '</div>',
      foot: '<div class="m-foot">' + (pool.length ? pg.pager : '') +
        '<button class="btn' + (canEnh ? ' gold' : ' dim') + '" data-action="enhance-item"' +
          ' data-item="' + U.escape(ui._enhSel || '') + '"' +
          (canEnh ? '' : ' disabled data-why="' + U.escape(btnWhy) + '"') + '>⚒ 强化' +
          (selInst && selLv < maxE ? ' +' + (selLv + 1) : '') + '</button>' +
        setBtn +
        (selCost ? '<span class="op-hint">' + U.escape('下一级 ' + GAME.costString(selCost)) + '</span>' : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ============================================================
   * v88 · 调校（基因强化件强化 —— 与熔铸强化平行的独立面板）
   * ------------------------------------------------------------
   * 列出**已拥有**的基因强化件（背包 + 穿戴；GAME.lingTemperList），
   * 每件给下一级精华成本。等级与效果都走唯一出口（eqEnhOf / genEquipBonus /
   * lingPowerOf），这里只做呈现。
   * ⛔ v89.202（老板 1）：「调校同款」—— 照 v89.201 熔铸专属界面重做：
   *   ① 单列列表（lg 小窗 · 每行一颗"调校 +N"键）改**专属界面**：xxl 档 +
   *      顶部筛选（全部/未满/圆满）+ 3 列网格卡片（品阶图 + 名称·序号 +
   *      大号 +N/上限 + 下级成本）+ 点选（ling-pick）+ **底部唯一调校键**
   *      （与熔铸/打造同款"点选 + 底键"形态）+ 分页（ui.LING_PER_PAGE/页）。
   *   ② live 每秒刷新（辐能核心随采集/探索即时变）+ 操作后 reopenKeepScroll
   *      （滚动位保留，与熔铸同）。
   * 件 key 出口复用 ui.enhKeyOf（uid ?? id · 两体系同一把尺，不另造）。
   * 旧"每行一颗调校键"的 .enh-list/.enh-row 单列家族随本轮整族退役（CSS 同步清）。
   * ============================================================ */
  ui.LING_PER_PAGE = 15;          /* 3 列 x 5 行（xxl 正文 ~690px，卡高 84px + 行距） */
  ui._lingSel = null;             /* 选中的件（key = 件号 u 或装备 id，String 化比对） */
  ui._lingFilter = 'all';         /* 筛选：all / todo（未满）/ done（圆满） */
  ui.setLingFilter = function (k) {
    ui._lingFilter = (k === 'todo' || k === 'done') ? k : 'all';
    ui._pages['ling'] = 1;
    ui.openLingTemper();
  };
  ui.lingPick = function (key) {
    if (key == null) return;
    key = String(key);
    ui._lingSel = (ui._lingSel === key) ? '' : key;
    ui.reopenKeepScroll(ui.openLingTemper);     /* 点选保留滚动位（v89.201 机制） */
  };
  ui.openLingTemper = function () {
    /* v89：调校君主专属 —— 无君主直接拒开 */
    if (!GAME.lordGeneralOf()) { ui.toast('君主不在，无从调校'); return; }
    var list = GAME.lingTemperList();
    var maxL = GAME.lingTemperMax();
    /* v91.59（老板）：调校改为**递增曲线**（+12%→+20%），展示改读曲线两端与满级累计。 */
    var _ARR = (DATA.LING_TEMPER || {}).perLvArr || [0.12];
    var perLo = Math.round(_ARR[0] * 100), perHi = Math.round(_ARR[_ARR.length - 1] * 100);
    var perFull = Math.round((GAME.lingTemperMulOf(maxL) - 1) * 100);
    var perLv = perLo;   /* 卡面旧引用兜底（tips/文案已改用曲线描述） */
    var ess = (GAME.state.items || {}).lingsui || 0;
    var filt = ui._lingFilter || 'all';
    var pool = list.filter(function (inst) {
      if (filt === 'todo') return GAME.eqEnhOf(inst) < maxL;
      if (filt === 'done') return GAME.eqEnhOf(inst) >= maxL;
      return true;
    });
    /* 选中件只认**池内**（换筛选把选中件筛出池外 → 自动清空，避免"看不见的选中"） */
    var selInst = null;
    pool.forEach(function (x) { if (ui.enhKeyOf(x) === ui._lingSel) selInst = x; });
    if (!selInst) ui._lingSel = '';
    var nTodo = list.filter(function (x) { return GAME.eqEnhOf(x) < maxL; }).length;
    var filtHtml = [['all', '全部', list.length], ['todo', '未满', nTodo], ['done', '圆满', list.length - nTodo]]
      .map(function (kk) {
        return '<span class="shop-cat' + (filt === kk[0] ? ' on' : '') +
          '" data-action="ling-filter" data-k="' + kk[0] + '">' + kk[1] + '<i>' + kk[2] + '</i></span>';
      }).join('');
    var pg = ui.modalPage('ling', pool, ui.LING_PER_PAGE, function () { ui.openLingTemper(); });
    var cards = pg.slice.map(function (inst) {
      var id = GAME.eqId(inst);
      var it = DATA.EQUIP[id], lv = GAME.eqEnhOf(inst);
      /* v89.214（老板 1）：卡面名称行去序号（同熔铸面板） */
      var key = ui.enhKeyOf(inst);
      var cost = lv < maxL ? GAME.lingTemperCost(inst) : null;
      /* v89.204（老板 2）：与熔铸同款 —— 成本行改悬停（.ec-cost 退役） */
      var tipL204 = GAME.eqLabel(inst) + '　每级改造属性 +' + perLo + '%~+' + perHi + '%（递增）　'
        + (cost ? ('下级成本 辐能核心 ' + cost) : '已至圆满');
      return '<div class="enh-card' + (key === ui._lingSel ? ' on' : '') +
          '" data-action="ling-pick" data-key="' + key + '"' +
          ' title="' + U.escape(tipL204) + '">' +
        '<span class="ec-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="ec-mid">' +
          '<span class="ec-nm"><b>' + U.escape(GAME.eqName(inst)) + '</b>' +
            '<i class="ec-tag">' + U.escape(GAME.qNameOf(it) || '') + '</i></span>' +
          '<span class="ec-lv">+' + lv + ' <i>/' + maxL + '</i></span>' +
        '</span></div>';
    }).join('') || '<div class="q-empty">' + (filt === 'todo' ? '全部基因强化件都已圆满。'
      : (filt === 'done' ? '还没有圆满的基因强化件。'
        : (GAME.jianghuWildMounted
          ? '还没有基因强化件。到野地「荒野行动」清剿/试炼/采集，可得基因强化件与辐能核心。'
          : '还没有基因强化件。'))) + '</div>';
    /* 底键状态（与结算同一把尺：成本读 GAME.lingTemperCost、精华读 s.items.lingsui） */
    var selLv = selInst ? GAME.eqEnhOf(selInst) : -1;
    var selCost = (selInst && selLv < maxL) ? GAME.lingTemperCost(selInst) : null;
    var canT = !!selCost && ess >= selCost;
    var btnWhy = !selInst ? '先在下方点选一件基因强化件（可先切「未满」筛选）'
      : (selLv >= maxL ? '「' + GAME.eqLabel(selInst) + '」已至 +' + maxL + '（圆满）'
        : ('辐能核心不足：下一级需 ' + selCost + '（现有 ' + ess + '）'));
    ui.openShell({
      /* v89.202：逐秒刷新（辐能核心随采集/探索即时变；live 快照自动保滚动位） */
      live: function () { ui.openLingTemper(); },
      title: '☯ 调校 · 基因强化件',
      sub: '按件调校（同名件看调校等级区分）　圆满 +' + maxL + '　每级改造属性 +' + perLo + '%~+' + perHi + '% 递增（对原始值线性叠加 · 圆满共 +' + perFull + '%）　辐能核心 ' + ess + '（野地采集 · 征战所得）',
      size: 'xxl',
      body: '<div class="forge-filter">' +
          '<span class="ff-k">筛选</span><span class="shop-cats">' + filtHtml + '</span>' +
          ui.help('调校按件记录：同名多件各有各的等级（卡面 +N 即其等级）。\n' +
            '每级改造属性 +' + perLo + '%~+' + perHi + '% 递增（对原始值线性叠加；圆满共 +' + perFull + '%，非复利）。\n' +
            '点选一件 → 底部「调校」键逐级提升 —— 长按可连续调校（按住不放即连升）。') +
        '</div>' +
        '<div class="enh-rows">' + cards + '</div>',
      foot: '<div class="m-foot">' + (pool.length ? pg.pager : '') +
        '<button class="btn' + (canT ? ' gold' : ' dim') + '" data-action="ling-temper-item"' +
          ' data-key="' + U.escape(ui._lingSel || '') + '"' +
          (canT ? '' : ' disabled data-why="' + U.escape(btnWhy) + '"') + '>☯ 调校' +
          (selInst && selLv < maxL ? ' +' + (selLv + 1) : '') + '</button>' +
        (selCost ? '<span class="op-hint">' + U.escape('下一级 辐能核心 ' + selCost) + '</span>' : '') +
        '<button class="btn" data-action="ling-fuse-open">🧬 融合淬体</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ============================================================
   * v91.59（老板）：「有没有卡牌类游戏的抽卡式消耗资源、赌概率式，或材料融合原体装备
   *   （好属性概率低）」——**融合淬体**（基因强化件的产出口）。
   * ------------------------------------------------------------
   * 面板：列出 9 种奇观材料 + 持有量 + 加/减「牌」（每份材料 = 一张牌）；
   *   底部实时显示**品质概率**（max-of-N 解析式 · 见 _fuseOdds）；「融合」→ GAME.lingFuse。
   * 选择态存 ui._fuseSel = { 材料id: 份数 }。
   * ============================================================ */
  ui._fuseSel = {};
  ui._fuseOdds = function (arr, total) {
    /* 单张牌品质分布 → N 张取 max 的分布：P(max=q) = CDF(q)^N − CDF(q-1)^N。 */
    var F = DATA.LING_FUSE || {}, w = F.qWeight || [0, 40, 26, 17, 11, 6];
    var q6 = F.q6Chance == null ? 0.05 : F.q6Chance;
    var sum = w[1] + w[2] + w[3] + w[4] + w[5];
    var cdf = [], acc = 0;
    for (var q = 1; q <= 5; q++) { acc += (1 - q6) * w[q] / sum; cdf[q] = acc; }
    var out = [];
    for (var k = 1; k <= 5; k++) {
      var hi = Math.pow(cdf[k], total), lo = k > 1 ? Math.pow(cdf[k - 1], total) : 0;
      out[k] = hi - lo;
    }
    out[6] = Math.pow(q6, total);       /* 6 阶须 N 张各自都中 q6（极稀有）——近似：单张即中已在上文；此式偏严，作展示下限 */
    /* 修正：单张命中 q6 即整次为 6 → P = 1 − (1−q6)^N。 */
    out[6] = 1 - Math.pow(1 - q6, total);
    return out;
  };
  ui.openLingFuse = function () {
    var s = GAME.state;
    var pool = (DATA.ITEMS || []).filter(function (it) { return it.type === 'wmat'; });
    var hold = function (id) { return (s.items || {})[id] || 0; };
    var total = 0;
    pool.forEach(function (it) { total += (ui._fuseSel[it.id] || 0); });
    var odds = ui._fuseOdds(null, Math.max(1, total));
    var rows = pool.map(function (it) {
      var n = ui._fuseSel[it.id] || 0, own = hold(it.id);
      return '<div class="lf-row">' +
        '<span class="lf-art">' + ui.itemArt('mat', it.id, 1) + '</span>' +
        '<span class="lf-nm">' + U.escape(it.name) + '<i>持 ' + own + '</i></span>' +
        '<span class="lf-step">' +
          '<button class="btn sm" data-action="lf-step" data-mat="' + it.id + '" data-d="-1"' + (n <= 0 ? ' disabled' : '') + '>−</button>' +
          '<b>' + n + '</b>' +
          '<button class="btn sm" data-action="lf-step" data-mat="' + it.id + '" data-d="1"' + (n >= own ? ' disabled' : '') + '>＋</button>' +
        '</span></div>';
    }).join('');
    var oddsHtml = total > 0 ? odds.slice(1).map(function (p, i) {
      var q = i + 1; return '<i><b>' + (DATA.LING_Q_NAME[q] || ('T' + q)) + '</b>' + Math.round(p * 100) + '%</i>';
    }).join('') : '<span class="ui-sub">放入材料（每份 = 一张牌）后显示品质概率</span>';
    ui.openShell({
      title: '🧬 融合淬体 · 基因强化件',
      sub: '耗奇观材料融合「原体」强化件 —— 品质随机（**好属性概率低**），牌越多越可能出高阶　已配 ' + total + ' 张牌',
      size: 'lg',
      body:
        '<div class="note">放入奇观材料（每份 = 一张牌），点「融合」抽取一件**基因强化件**（随机部位 × 随机品质）。' +
          '多放牌可提升出件品质。产出件可再走「调校」（辐能核心）逐级强化。</div>' +
        '<div class="lf-list">' + rows + '</div>' +
        '<div class="ui-sub" style="margin-top:6px;">品质概率（按当前 ' + total + ' 张牌）</div>' +
        '<div class="ds-tiers lf-odds">' + oddsHtml + '</div>',
      foot: '<div class="m-foot">' +
        '<button class="btn' + (total > 0 ? ' gold' : ' dim') + '" data-action="lf-do"' +
          (total > 0 ? '' : ' disabled data-why="请先放入奇观材料"') + '>🧬 融合淬体</button>' +
        '<button class="btn" data-action="lf-clear"' + (total > 0 ? '' : ' disabled') + '>清空</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
  ui.fuseStep = function (mat, d) {
    var it = null; (DATA.ITEMS || []).forEach(function (x) { if (x.id === mat) it = x; });
    if (!it || it.type !== 'wmat') return;
    var own = (GAME.state.items || {})[mat] || 0;
    var n = Math.max(0, Math.min(own, (ui._fuseSel[mat] || 0) + d));
    if (n > 0) ui._fuseSel[mat] = n; else delete ui._fuseSel[mat];
    ui.reopenKeepScroll(ui.openLingFuse);
  };



  /* 底部信息流频道切换（实现见 renderLog 处） */


})();
