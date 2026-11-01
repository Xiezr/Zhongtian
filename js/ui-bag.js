/* ============================================================
 * ui-bag.js　行囊 · 背包 / 装备 / 分页排序
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
  var BAG_LEGACY_TAB = ui._C.BAG_LEGACY_TAB;

  /* ============================================================
   * v150（P0-1）· **阶段**：让第一小时只露出"这一小时该做的事"
   * ------------------------------------------------------------
   * 问题（实测）：开局能建 2/15 种建筑、能研 3/29 项科技，但界面把**全部**
   * 都摆出来；账本一屏 12 条（另有模块面板）。行业参照是前 30 分钟 ≤3 个可见目标。
   *
   * 三条硬约束（决定了下面的写法）：
   *   ① **不新增存档字段** —— phase 完全派生（城数 / 胜场 / 是否立城），
   *      读档、重开、老档都自动正确，零迁移；
   *   ② **不删 DOM** —— 上百条断言用 `[data-view=…]` 查顶栏；这里只加 class，
   *      由 CSS `.topnav .tab-locked{opacity:.38;filter:grayscale(1)}` 灰显
   *      （v156.33 老板「顶上还是把游商啥的搞没了」：从 `display:none` 改成"在场但锁着"）；
   *   ③ **不拦 setView** —— 老档/脚本/测试直接 `setView('station')` 照常可用；
   *      收的只是"界面上看不看得见、点不点得到"。
   * ============================================================ */
  ui.phaseOf = function () {
    var s = GAME.state;
    if (!s) return 'prologue';
    if (GAME.prologue && GAME.prologue.on && GAME.prologue.on()) return 'prologue';
    var n = ((GAME.city && GAME.city.all) ? GAME.city.all() : (s.cities || [])).length;
    var wins = GAME.stat ? (GAME.stat('wins') | 0) : 0;
    /* early 的退出口径只看「城 + 胜场」：
       军营是新手链的第三环，建好它不算"会玩了"——还得募兵、打第一场。 */
    if (n <= 1 && wins < 3) return 'early';
    if (n < 5) return 'mid';
    return 'late';
  };

  /* 晚解锁的账本小节（按标题关键词）：early 一律折成一条灰行，点了告诉你还差什么。 */
  ui.GATE_SEC = [
    ['☁ 辐射云', 'mid'], ['☢ 污染', 'mid'], ['🏴 竞争者', 'mid'],
    ['🛣 领土连通', 'mid'], ['📜 废墟科技', 'mid'], ['🎯 作战目标', 'mid'],
    ['🩹 伤兵与老兵', 'mid'], ['🔥 民怨', 'mid'], ['🏯 守城工事', 'mid'],
    ['🕳 地下远征', 'mid'], ['🃏 指令牌', 'mid'], ['🧩 套装指令', 'mid'],
    ['☄ 奇观', 'late'], ['👁 谁看见了你', 'late']
  ];
  ui.gateRankOf = function (ph) { return ph === 'early' ? 0 : (ph === 'mid' ? 1 : 2); };
  ui.gatedOut = function (need) {
    var rank = ui.gateRankOf(ui.phaseOf());
    var needRank = need === 'late' ? 2 : (need === 'mid' ? 1 : 0);
    return needRank > rank;
  };
  /* 还差什么才解锁（给灰行用一句人话） */
  ui.gateWhyText = function () {
    var ph = ui.phaseOf();
    if (ph === 'early') return '再打几场、或再开一座城就解锁';
    if (ph === 'mid') return '开满 5 座城（或打下更远的地方）后解锁';
    return '';
  };

  /* 顶栏阶段锁（幂等）：把 station / shop / collection 标成 locked —— **看得见、进不去**。
     只加 class，不动 DOM —— 见上面第 ② 条。
     v156.33：锁定态从"藏起来"改成"灰显"（CSS 见 index.html `.tab-locked`），
     所以那句 title 现在真的能被悬停看到；点击拦截在 js/main.js 的 topnav 监听里。 */
  ui.syncPhase = function () {
    try {
      var ph = ui.phaseOf();
      if (ui._phaseShown === ph) return;
      ui._phaseShown = ph;
      var hide = (ph === 'early') ? ['station', 'shop', 'collection'] : [];
      var tabs = document.querySelectorAll('#topnav .tab[data-view]');
      for (var i = 0; i < tabs.length; i++) {
        var v = tabs[i].getAttribute('data-view');
        var locked = hide.indexOf(v) >= 0;
        tabs[i].classList.toggle('tab-locked', locked);
        /* 锁着的时候给一句为什么（悬停）：不解释的灰＝玩家以为坏了 */
        if (locked) {
          tabs[i].setAttribute('title', '站稳脚跟后解锁：' + ui.gateWhyText());
          tabs[i].setAttribute('aria-disabled', 'true');
        } else {
          tabs[i].removeAttribute('title');
          tabs[i].removeAttribute('aria-disabled');
        }
      }
    } catch (e) { /* 桩环境（无 classList/元素）：静默跳过，不影响测试口径 */ }
  };

  ui.foldBlock = function (key, title, rows, opts) {
    opts = opts || {};
    var n = (rows || []).length;
    /* 未手动展开过时：条目少（≤ opts.autoOpen）默认展开，多则收起 —— 满足老板
       「满 6 条会撑开界面」的场景，又不会让 1~2 条的小队列多一次点击。 */
    var open = (ui._foldOpen[key] == null)
      ? (opts.autoOpen != null && n <= opts.autoOpen)
      : !!ui._foldOpen[key];
    if (opts.empty && !n) return '';
    var head = '<div class="op-zone-t" data-action="fold-toggle" data-fold="' + U.escape(key) + '"' +
      ' style="cursor:pointer;user-select:none;" title="' + U.escape(open ? '点击收起明细' : '点击展开明细') + '">' +
      (open ? '▾ ' : '▸ ') + title +
      '<span class="q-sec-n" style="float:right;">' + (opts.note != null ? opts.note : (n + ' 条')) +
      '</span></div>';
    return '<div class="op-zone"' + (opts.style ? ' style="' + opts.style + '"' : '') + '>' +
      head + (open ? (opts.detail || '') : '') + '</div>';
  };
  /* 本营募兵队列（执行中 / 排队等待） */
  ui.trainQueueBlock = function (bar, city, kind) {
    kind = GAME.queueKindOf ? GAME.queueKindOf(kind) : 'train';
    var isCraft = kind === 'craft';
    var qs = GAME.trainQueuesOf(city, bar.idx, kind);
    var slots = GAME.trainQueueSlots(bar.lvl, city);
    var title = isCraft ? '本作坊制造队列' : '本营募兵队列';
    if (!qs.length) {
      return '<div class="q-sec" style="margin-top:14px;"><span class="q-sec-t">' + title + '</span>' +
        '<span class="q-sec-n">0 / ' + slots + ' 条</span></div>' +
        '<div class="q-empty">' + (isCraft ? '本作坊暂无制造任务' : '本营暂无募兵任务') + '</div>';
    }
    /* v28（需求 8）：补一列「加速」—— 只有正在执行的那条能加速
       （排队的还没开始走表，加速它没有意义）。 */
    var hasBoost = GAME.systems.trainBoostItems && GAME.systems.trainBoostItems().length > 0;
    var rows = qs.map(function (q, i) {
      var t = DATA.TROOPS[q.troopId];
      var pct = Math.min(100, Math.floor((q.elapsed || 0) / q.totalTime * 100));
      var running = (i === 0);
      var left = Math.max(0, (q.totalTime - (q.elapsed || 0)) / GAME.timeScale());
      return '<tr><td class="ctr">' + (i + 1) + '</td>' +
        '<td>' + (t ? t.name : q.troopId) + ' ×' + U.numText(q.count, 0) + '</td>' +
        '<td class="ctr">' + (running
          ? '<b style="color:var(--green-ok)">' + (kind === 'craft' ? '制造中' : '募兵中') + '</b>'
          : '排队等待') + '</td>' +
        '<td class="num">' + (running
          ? '<span class="qbar" style="display:inline-block;width:64px;vertical-align:middle;margin-right:6px;">' +
            '<i style="width:' + pct + '%"></i></span>' + pct + '%' +
            '<span class="ui-sub" style="margin-left:6px;">余 ' + U.durExact(left) + '</span>'
          : '—') + '</td>' +
        /* v89.49：按钮**不再因"没宝物"而禁用** —— 面板里有花旧币提速那条路
           （v28 的 disabled 就是老板"不可加速"的直接原因）。 */
        '<td class="ctr">' + (running
          ? '<button class="btn sm gold" data-action="train-boost" data-idx="' + bar.idx + '">加速</button>'
          : '—') +
          ' <button class="btn sm" data-action="train-cancel" data-idx="' + bar.idx + '" data-kind="' + kind +
          '" data-i="' + i + '" title="取消本条募兵，返还 80% 军资">取消</button>' +
        '</td></tr>';
    }).join('');
    /* v91.72：多条目折叠 —— 默认一条汇总（标题 + N 条 + 正在执行的那条），
       点标题行才展开逐条表格（满 6 条不再把面板撑开）。 */
    var run = qs[0] || null;
    var runTxt = run ? ((DATA.TROOPS[run.troopId] ? DATA.TROOPS[run.troopId].name : run.troopId)
      + ' ×' + U.numText(run.count, 0) + ' · ' + Math.min(100, Math.floor((run.elapsed || 0) / run.totalTime * 100)) + '%') : '空闲';
    var foldKey = 'queue-' + kind + '-' + (city && city.id) + '-' + bar.idx;
    return ui.foldBlock(foldKey,
      (isCraft ? '本作坊制造队列' : '本营募兵队列') +
        '<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);margin-left:8px;">' +
        (qs.length > 1 ? ('执行中：' + U.escape(runTxt) + '（另有 ' + (qs.length - 1) + ' 条排队）') : U.escape(runTxt)) +
        '</span>',
      qs.slice(),
      { note: qs.length + ' / ' + slots + ' 条', autoOpen: 3,
        detail:
        '<table class="tbl"><thead><tr><th>序</th><th>兵种</th><th>状态</th><th>进度</th><th>操作</th></tr></thead><tbody>' +
        rows + '</tbody></table>' +
        /* v89.49：两条路都写清楚（原先只在"没宝物"时报一句，且按钮是灰的） */
        '<div class="ui-sub" style="margin-top:4px;">' + (hasBoost
          ? '可提速：宝物加速（更划算）· 花旧币买时间'
          : '背包没有加速宝物，仍可**花旧币买时间**') +
          ui.help('提速面板里有两条路：\n' +
            '① 花旧币买时间 —— 价 = 该批军资 ×20% × 还能缩短的比例，随时可用\n' +
            '② 宝物加速 —— 操典残页 −30%（每队列限 1 次）· 操典全卷 −50%，游商「加速」类购得，更划算') +
        '</div>' });
  };

  ui.openPanel = function (view, title, size) {
    var box = ui['PANEL_TITLE'] || {};
    var body = '';
    if (view === 'troops') body = ui.troopsHTML();
    else if (view === 'tech') body = ui.techHTML(true);   /* v91.72b：弹窗外壳已有标题，正文不再重复 */
    else if (view === 'equip') body = ui.equipHTML(true);    /* v89.112：弹窗模式（分页走弹窗内） */
    else if (view === 'items') { ui.openBag('item'); return; }
    else if (view === 'generals') body = ui.generalsHTML();
    /* v89.104：`stats` 视图（黄册）已退役 —— 弹窗入口同步撤除 */
    else if (view === 'rank') body = ui.rankHTML();
    else if (view === 'ext') body = ui.extHTML();
    else body = '<div style="padding:20px;text-align:center;color:var(--text-dim);">此功能暂未开放</div>';
    /* v89.165（老板：「查看所有类似实时读秒设置」）：含读秒/进度的子视图接入
       live 每秒重开 —— troops（募兵队列「余 X」+ 队列条）/ tech（研究中 X%）/
       ext（城外施工总览）。纯静态子视图（equip / rank）不接，省每秒重建。 */
    var o165 = size ? { size: size } : {};
    if (view === 'troops' || view === 'tech' || view === 'ext') {
      o165.live = function () { ui.openPanel(view, title, size); };
    }
    ui.openModal(
      '<div class="gold-heading">' + (title || box[view] || view) + '</div>' +
      '<div class="panel-body">' + body + '</div>' +
      '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.105：`.panel-body` 有 558px 硬上限，默认档(620→正文 603)里
         34(标题) + 558 + 47(操作栏) = 639 > 603 → 必然冒滚动条。
         加一个可选尺寸参数，让"内容确实高"的面板（装备 12 格 + 说明）走 xl。 */
      (o165.size || o165.live) ? o165 : null
    );
  };

  ui.openEquipPanel = function () { ui.openPanel('equip', null, 'max'); };   /* v90.18（老板「装备界面不够宽」）：xxl → max 满幅 */
  ui.openItemsPanel = function () { ui.openPanel('items'); };

  /* ============================================================
   * 背包（v13）：按类型拆分页签 → 组内分组 → 组内可排序
   *   · 页签：装备 / 材料 / 宝物 / 图纸
   *   · 拆分：不同类型分置于不同页签与分组，互不混杂
   *   · 排序：装备按 品质/价值/套件/部位；材料按 系列/品阶/数量；宝物按 类型/价值
   *   · 每行 5 格，属性走悬停浮层，点击开详情
   * ============================================================ */
  /* v89.115（老板）：「背包分成装备和宝物，宝物参考游商的分类进行划分，
     以便快速检索拥有的材料和宝物」——
     顶层改**两类**（装备 / 宝物）；宝物页内用**二级分类条**（材料 / 珠宝 / 符类 / …）
     按类型名出口 `BAG_ITEM_CN`（与游商分类对齐）切分，只列**有货**的类。 */
  var BAG_TABS = [['equip', '装备'], ['treasure', '宝物']];
  /* 二级分类的默认值：全部（= 材料 + 宝物 + 图纸，分三段） */
  ui._bagSub = ui._bagSub || 'all';
  /* v90.11：机甲 19 槽（身体 13 + 外挂 6）—— 顺序即部件栏/背包的分组序 */
  var BAG_SORT_OPTS = {
    equip: [['q', '品质'], ['val', '价值'], ['set', '套件'], ['slot', '部位']],
    /* 宝物页四类排序：材料看系列/品阶，宝物看类型/价值，通用"数量"两端都能用 */
    treasure: [['type', '类型'], ['series', '系列'], ['tier', '品阶'], ['val', '价值'], ['have', '数量']],
  };
  ui._bagSort = ui._bagSort || { equip: 'q', treasure: 'type' };
  /* 旧顶层页签值 → 新的「类 + 二级分类」映射（老深链/老测试不炸；见 setBagTab） */
  /* v89.143（老板 1）：'item'（老深链）不再落到「全部」—— 落**第一个有货分类**（null = 归一） */

  /* 背包（v25 · 需求 2）：与游商一起由弹窗改为**整页视图** */
  ui.bagHTML = function () {
    var s = GAME.state;
    var t = ui._bagTab || 'equip';
    /* 旧值兜底（v89.115）：直接赋内部变量（老脚本/老用例）也走得通 —— 一次迁移到位 */
    if (BAG_LEGACY_TAB[t]) { ui._bagSub = BAG_LEGACY_TAB[t][1]; t = BAG_LEGACY_TAB[t][0]; ui._bagTab = t; }
    if (t !== 'equip' && t !== 'treasure') t = 'equip';
    var sk = (t === 'equip') ? 'equip' : 'treasure';          /* 排序按「类」存，不按二级分类 */
    var sort = ui._bagSort[sk] || (BAG_SORT_OPTS[sk] || [['q', '']])[0][0];

    var html = '';
    /* 页签（v89.115：两类 —— 装备 / 宝物） */
    html += '<div class="subtabs" style="margin:0 0 8px;justify-content:center;">' +
      BAG_TABS.map(function (x) {
        return '<span class="sub' + (t === x[0] ? ' active' : '') + '" data-action="bag-tab" data-v="' + x[0] + '">' + x[1] + '</span>';
      }).join('') + '</div>';
    /* 二级分类条（仅宝物页）—— 参考游商分类，只列有货的（快速检索）；
       v89.143：进页先归一（删「全部」后，失效值一律落到第一个有货分类）。 */
    if (t === 'treasure') {
      /* v91.57：两层 —— 大类（战备/物资/民生/秘宝 + 材料）× 细类（仅当前大类下）。 */
      if (ui._bagCat === 'material') { ui._bagSub = 'material'; }
      else { ui._bagSub = ui.bagSubNorm(ui._bagSub); }
      html += ui.bagCatsHTML() + (ui._bagCat === 'material' ? '' : ui.bagSubChipsHTML());
    }
    /* v89.117（老板「参考制造厂分类，增加更细致的划分」）：装备页三排筛选 */
    if (t === 'equip') html += ui.bagEqChipsHTML();
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
    /* v89.145（老板 2）：背包页改**.bag-page**（满高 flex 列）——
       顶部（标题 / 页签 / 分类条 / 排序条）冻结不动，只有 `.bag-body`（底下细分物品区）
       内部滚动；不再是 .view-box 整页滚。 */
    return '<div class="ui-page bag-page">' +
      '<div class="gold-heading">🎒 背包 · ' + (t === 'treasure' ? '宝物' : '装备') +
        ui.help('悬停格子看属性\n点格子开详情\n' +
          '宝物页顶部的分类条按**游商分类**切分（只列有货的）—— 材料 / 珠宝 / 符类…\n' +
          '装备可穿戴，也可拆解回收材料 · 未穿戴的件可点「售」换旧币') +
      '</div>' + html + '</div>';
  };
  ui.openBag = function (tab) {
    /* v89.115：旧值（'mat'/'item'/'bp'）自动迁移到「宝物 + 二级分类」—— 深链与脚本不炸 */
    if (tab) {
      if (BAG_LEGACY_TAB[tab]) {
        ui._bagTab = BAG_LEGACY_TAB[tab][0];
        ui._bagSub = BAG_LEGACY_TAB[tab][1];
      } else {
        ui._bagTab = (tab === 'treasure') ? 'treasure' : 'equip';
      }
    }
    ui.setView('bag');
  };
  /* ============================================================
   * 视图内重绘（v29 · 需求 3/4）
   * ------------------------------------------------------------
   * ⚠ 这类重绘**不经过 ui.renderView**（切页签、换排序、翻页都走这里），
   *   而分页条是 renderView 收尾时才落到底部条的 —— 于是切页签后
   *   正文换了、底部条还挂着上一个页签的页码，点下去就翻错了列表。
   *   统一收敛到这一个函数：先清空本帧的分页收集，再重画正文、刷新底部条。
   * ============================================================ */
  ui.repaintView = function (fn) {
    var box = $('#view-container');
    if (!box) return;
    ui._bottom = [];
    box.innerHTML = fn();
    ui.paintBottom();
  };

  ui.renderBag = function () {
    if (ui.view !== 'bag') return;
    ui.repaintView(function () { return ui.bagHTML(); });
  };

  /* 背包总量摘要（v89.115：按「类 + 二级分类」给） */
  ui.bagSummary = function (t) {
    var s = GAME.state;
    if (t === 'equip') {
      var _all = ui.bagEquipEntries ? ui.bagEquipEntries() : [];
      var _worn = _all.filter(function (e) { return !!e.wornBy; }).length;
      return '装备 ' + _all.length + ' 件（未穿戴 ' + (_all.length - _worn) + ' · 已穿戴 ' + _worn + '）';
    }
    /* v89.143（老板 1）：无「全部」后，摘要 = **当前分类 + 全量兜底**
       （'all' 仍是计数出口 bagSubCountOf 的合法入参，只是不再是一个分类页）。 */
    var sub = ui.bagSubNorm(ui._bagSub);
    var nm2 = (sub === 'material') ? '材料'
      : (sub === 'blueprint') ? '图纸'
      : ((ui.BAG_ITEM_CN[sub] || sub) + '').replace(/（.*/, '');
    return nm2 + ' ' + ui.bagSubCountOf(sub) + ' 件（宝物共 ' + ui.bagSubCountOf('all') + ' 件）';
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
     分类顺序 = BAG_ITEM_CN 的键序（与游商分类对齐）；材料/图纸各单列。 */
  /* ============================================================
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
  /* v91.57：切**大类** → 细类归到该大类下第一个有货的（材料类则细类锁 material）。 */
  ui.setBagCat = function (c) {
    ui._bagCat = (c === 'material' || ui.BAG_CATS[c]) ? c : ui.bagCatFirstOf();
    if (ui._bagCat === 'material') { ui._bagSub = 'material'; }
    else {
      var ts = ui.BAG_CATS[ui._bagCat].types || [], pick = null;
      ts.forEach(function (ty) { if (!pick && ui.bagSubCountOf(ty) > 0) pick = ty; });
      ui._bagSub = pick || ts[0] || 'chest';
    }
    ui._pages['bag-item'] = 1; ui._pages['bag-item-' + ui._bagSub] = 1;
    ui.renderBag();
  };
  ui.bagSubChipsHTML = function () {
    var sub = ui.bagSubNorm(ui._bagSub);
    var list = [];
    var mn = ui.bagSubCountOf('material');
    if (mn > 0) list.push(['material', '材料', mn]);
    /* v91.57（老板）：「宝物界面类型直接列举、超出看不到 → 往上再做一层分类」——
       细类只列**当前大类**下的（`ui._bagCat`），不再把所有类型一次铺开。 */
    (ui.BAG_CATS[ui._bagCat].types || []).forEach(function (ty) {
      var meta = ui.BAG_ITEM_CN[ty]; if (!meta) return;
      var n = ui.bagSubCountOf(ty);
      if (n > 0) list.push([ty, (meta + '').replace(/（.*/, ''), n]);
    });
    var bn = ui.bagSubCountOf('blueprint');
    if (bn > 0 && (ui.BAG_CATS[ui._bagCat].types || []).indexOf('blueprint') >= 0) list.push(['blueprint', '图纸', bn]);
    /* v89.147（老板 2）：分类条从**界面左侧**开始（原来 inline-flex 居中）——
       行容器与装备页同款（.bag-filterrow：块级占满 + 左起 + 不换行）→ 两页排序框同位置。 */
    return '<div class="chips chips-xs bag-filterrow">' +
      list.map(function (x) {
        return '<span class="chip' + (sub === x[0] ? ' on' : '') +
          '" data-action="bag-sub" data-v="' + x[0] + '">' + x[1] + ' <i>' + x[2] + '</i></span>';
      }).join('') + '</div>';
  };
  /* v91.57：**大类（一级分类）**表 —— 宝物页上层分类，把 ~26 个细类收进 4 个桶。 */
  ui.BAG_CATS = {
    war: { name: '战备', types: ['attr_buff', 'military_buff', 'mount_buff', 'boost', 'exp', 'stamina', 'energy', 'perm', 'rank_up', 'essence', 'talis', 'corvee', 'chest'] },
    mat: { name: '物资', types: ['wmat', 'res_crate'] },   /* v91.72：+ 战储仓压缩物资 */
    civ: { name: '民生', types: ['prod_buff', 'pop_boost', 'pop_fill', 'build_cost'] },
    treasure: { name: '秘宝', types: ['jewel', 'bao', 'neigong', 'blueprint'] },
  };
  ui._bagCat = ui._bagCat || 'war';
  ui.bagCatCountOf = function (cat) {
    var c = ui.BAG_CATS[cat]; if (!c) return 0;
    var n = 0; (c.types || []).forEach(function (ty) { n += ui.bagSubCountOf(ty); });
    return n;
  };
  ui.bagCatFirstOf = function () {
    var hit = null;
    Object.keys(ui.BAG_CATS).forEach(function (c) { if (!hit && ui.bagCatCountOf(c) > 0) hit = c; });
    return hit || 'war';
  };
  ui.bagCatsHTML = function () {
    /* 材料（material）不在大类里（它恒单列）→ 有材料时单给一个「材料」大类。 */
    var mn = ui.bagSubCountOf('material');
    var chips = (mn > 0 ? '<span class="chip' + (ui._bagCat === 'material' ? ' on' : '') +
        '" data-action="bag-cat" data-v="material">材料 <i>' + mn + '</i></span>' : '') +
      Object.keys(ui.BAG_CATS).map(function (c) {
        var n = ui.bagCatCountOf(c);
        return '<span class="chip' + (ui._bagCat === c ? ' on' : '') +
          '" data-action="bag-cat" data-v="' + c + '">' + ui.BAG_CATS[c].name + ' <i>' + n + '</i></span>';
      }).join('');
    return '<div class="chips chips-xs bag-filterrow bag-catrow">' + chips + '</div>';
  };
  /* 宝物页（按二级分类分派）：material → 材料页 · blueprint → 图纸页 ·
     单一类型 → 宝物页（过滤）· all → 三段并排（材料 / 宝物 / 图纸） */
  ui.bagTreasureHTML = function (sort) {
    /* v89.143（老板 1）：「全部」退役 —— 分类恒为**一个**具体类目（归一出口保证）。 */
    var sub = ui.bagSubNorm(ui._bagSub);
    ui._bagSub = sub;
    if (sub === 'material') return ui.bagMatHTML(sort);
    if (sub === 'blueprint') return ui.bagBpHTML(sort);
    return ui.bagItemHTML(sort, sub);
  };

  /* ============================================================
   * 背包分页（v29 · 需求 4）
   * ------------------------------------------------------------
   * 旧版只有「装备」页有分页，而且分页条**长在内容末尾** —— 一屏装不下，
   * 就得先滚到底才够得着翻页；材料/图纸/宝物三页干脆直接长列表铺到底。
   * 现在四处一起改：
   *   · 四个页签**都分页**，每页 20 格（4 行 × 5 格，正好整行不截断）；
   *   · 分页条统一送到屏幕下方的固定导航条（ui.pagerHTML → #bottom-bar），
   *     内容区永远不必为了翻页而滚动；
   *   · 分页单位是**格子**而不是"分组"，所以一页里可能跨两个分组 ——
   *     pageBag 在拼接时按需补分组标题，不会出现"页首是一排没有归属的裸格子"。
   * ============================================================ */
  /* v89.143（老板 1）：7 列网格下每页必须是**整行** —— 16 = 2 行 + 2 格（末行缺 5 格），
     与"7 列空间设计"不符。改 28 = **4 行 × 7 列**（与游商 4 行同高节奏，铺满一屏）。 */
  ui.BAG_PER_PAGE = 28;
  ui.pageBag = function (key, rows) {
    var cells = rows.filter(function (r) { return r.cell != null; });
    var p = ui.pageOf(key, cells.length, ui.BAG_PER_PAGE);
    var html = '', lastSec = null, open = false;
    for (var i = p.from; i < p.to; i++) {
      var r = cells[i];
      /* 一个分组 = 「标题 + 一个 .bag-grid」；换组时先把上一格网格闭合，
         再开新的一格 —— 分页切在分组中间时，页首同样会有标题跟着。 */
      if (r.sec !== lastSec) {
        if (open) { html += '</div>'; open = false; }
        html += r.secHTML + '<div class="bag-grid">';
        open = true; lastSec = r.sec;
      }
      html += r.cell;
    }
    if (open) html += '</div>';
    ui.pagerHTML(key, cells.length, ui.BAG_PER_PAGE);
    return html || '<div class="q-empty">本页无内容。</div>';
  };
  /* 通用"行分页"（v29）：给物品行（.item-row）用 ——
     pageBag 是给格子（.bag-grid）用的，两者 DOM 结构不同，不能混用。
     分页条同样送到屏幕下方的固定条。 */
  ui.pageRows = function (key, rows, perPage, cls) {
    var per = perPage || 8;
    var p = ui.pageOf(key, rows.length, per);
    var html = rows.slice(p.from, p.to).map(function (r) { return r.cell; }).join('');
    ui.pagerHTML(key, rows.length, per);
    return html ? ('<div class="' + (cls || 'shop-rows') + '">' + html + '</div>')
      : '<div class="q-empty">本页无内容。</div>';
  };

  /* 一组格子（secHTML 为该组标题）→ 行数组 */
  ui.bagRows = function (secHTML, sec, cells) {
    return cells.map(function (c) { return { sec: sec, secHTML: secHTML, cell: c }; });
  };

  /* ---------- 装备页（v79：按**件**列格 —— 同名以 甲/乙/丙 序号 + 强化 +N 区分） ---------- */
  /* ============================================================
   * v89.117（老板「背包的装备中列出所有装备（包括英雄穿戴的），如正在穿戴，
   *   显示对应英雄名称即可」）—— 装备清单**唯一出口**：
   *     背包件（s.inventory） + **全体英雄两套装备位**（equip / lingEquip）。
   * 病根：穿戴时 domain 会把件从 inventory 里 splice 掉（脱下才 push 回来），
   *   所以"已经穿在身上的那一半家当"在背包里根本看不到。
   * 顺序：背包件在前、穿戴件在后（同一件只出现一次 —— 穿戴件不在背包里）。
   * ============================================================ */
  ui.bagEquipEntries = function () {
    var s = GAME.state || {};
    var out = [];
    (s.inventory || []).forEach(function (inst) {
      if (!inst || !DATA.EQUIP[GAME.eqId(inst)]) return;
      out.push({ inst: inst, wornBy: '', from: 'bag' });
    });
    (s.generals || []).forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {
        var bag = g[bk] || {};
        for (var sl in bag) {
          var inst2 = bag[sl];
          if (!inst2 || !DATA.EQUIP[GAME.eqId(inst2)]) continue;
          out.push({ inst: inst2, wornBy: g.name, from: 'worn', genId: g.id, slot: sl });
        }
      });
    });
    return out;
  };
  /* 装备页筛选状态（唯一出口：chips / 渲染 / 断言都读它） */
  ui._bagEq = ui._bagEq || { cls: 'all', set: '', state: 'all', q: 'all' };
  ui.bagEqFiltered = function () {
    var f = ui._bagEq || {};
    return ui.bagEquipEntries().filter(function (e) {
      var it = DATA.EQUIP[GAME.eqId(e.inst)];
      if (!it) return false;
      if (f.state === 'worn' && !e.wornBy) return false;
      if (f.state === 'free' && e.wornBy) return false;
      if (f.q !== 'all' && it.q !== Number(f.q)) return false;
      if (f.cls === 'set' && !it.set) return false;
      if (f.cls === 'solo' && it.set) return false;
      if (f.cls === 'set' && f.set && it.set !== f.set) return false;
      return true;
    });
  };
  /* 筛选条（三排：类别 / 状态 / 品质；只在装备页出现） */
  /* ============================================================
   * v89.147（老板 1）：「背包，装备界面，**上边分类栏保持在一行，位于界面左侧**，
   *   状态，品质，散件，全部这 4 个作为**主类**，依次往右排列」
   * ------------------------------------------------------------
   * 原来 = **两排居中**（row1 类别 / row2「状态」+「品质」标签+选项）——
   * 现在合并为**一行 4 组、左侧起**：
   *   ① 状态（全部 / 未穿戴 / 已穿戴）
   *   ② 品质（全部 / Q1…，按持有情况列）
   *   ③ 散件（全部 / 套装 / 散件 + 选中「套装」时追加套名细化）
   *   ④ 全部（一键把三个维度还原 —— 激活态 = 当前即"全默认"）
   * 行容器 `.chips.bag-filterrow`（块级占满 + 左起 + 不换行）——与宝物页同款，
   *   两页行高一致（排序框同位置）。
   * ============================================================ */
  ui.bagEqChipsHTML = function () {
    var f = ui._bagEq || {};
    var all = ui.bagEquipEntries();
    var setsIn = [];
    all.forEach(function (e) {
      var sid = (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set;
      if (sid && setsIn.indexOf(sid) < 0) setsIn.push(sid);
    });
    function chip(k, v, label, n, on) {
      return '<span class="chip' + (on ? ' on' : '') + '" data-action="bag-eq-f" data-k="' + k +
        '" data-v="' + v + '">' + label + ' <i>' + n + '</i></span>';
    }
    var cnt = function (pred) { return all.filter(pred).length; };
    var qsIn = [1, 2, 3, 4, 5, 6].filter(function (q) {
      return all.some(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; });
    });
    /* 第 4 主类「全部」的激活态 = 三个维度都处于"全部"（即当前显示的就是全部装备） */
    var isAll = (f.state === 'all' || !f.state) && (f.q === 'all' || f.q == null)
      && (f.cls === 'all' || !f.cls);
    return '<div class="chips chips-xs bag-filterrow">' +
      '<span class="lb">状态</span>' +
      chip('state', 'all', '全部', all.length, f.state === 'all' || !f.state) +
      chip('state', 'free', '未穿戴', cnt(function (e) { return !e.wornBy; }), f.state === 'free') +
      chip('state', 'worn', '已穿戴', cnt(function (e) { return !!e.wornBy; }), f.state === 'worn') +
      '<span class="lb">品质</span>' +
      chip('q', 'all', '全部', all.length, f.q === 'all' || f.q == null) +
      qsIn.map(function (q) {
        return chip('q', q, DATA.Q_NAME[q] || ('Q' + q),
          cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; }), Number(f.q) === q);
      }).join('') +
      '<span class="lb">散件</span>' +
      chip('cls', 'all', '全部', all.length, f.cls === 'all' || !f.cls) +
      chip('cls', 'set', '套装', cnt(function (e) { return !!(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'set') +
      chip('cls', 'solo', '散件', cnt(function (e) { return !(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'solo') +
      (f.cls === 'set' && setsIn.length
        ? setsIn.map(function (sid) {
            return chip('set', sid, (DATA.SETS[sid] && DATA.SETS[sid].name) || sid,
              cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set === sid; }), f.set === sid);
          }).join('') : '') +
      chip('reset', 'all', '全部', all.length, isAll) +
      '</div>';
  };
  ui.setBagEqFilter = function (k, v) {
    ui._bagEq = ui._bagEq || {};
    /* v89.147（老板 1）：第 4 主类「全部」= 一键把三个维度还原（state/q/cls → all）。
       v89.147 前这里不接受 'reset'（会把它当普通键存进 _bagEq）—— 现在显式分支。 */
    if (k === 'reset') {
      ui._bagEq = { cls: 'all', set: '', state: 'all', q: 'all' };
    } else if (k === 'q') {
      ui._bagEq.q = (v === 'all') ? 'all' : Number(v);
    } else {
      ui._bagEq[k] = v;
    }
    if (k === 'cls' && v !== 'set') ui._bagEq.set = '';
    ui._pages['bag-equip'] = 1;                  /* 换筛选回第一页（分页键 = bag-equip） */
    ui.renderBag();
  };

  ui.bagEquipHTML = function (sort) {
    var s = GAME.state;
    var entries = ui.bagEqFiltered();
    if (!entries.length) {
      var anyEq = ui.bagEquipEntries().length;
      return '<div class="q-empty">' + (anyEq
        ? '当前筛选下没有装备 —— 换一档筛选试试（类别 / 状态 / 品质）。'
        : '尚无装备。点城内「制造厂」打造，或攻占城市缴获。') + '</div>';
    }
    var inv = entries;
    /* 分组（按部位 / 按套装）—— 组内按件排 */
    var groups = {};
    inv.forEach(function (e) {
      var it = DATA.EQUIP[GAME.eqId(e.inst)];
      var key = (sort === 'set') ? (it.set ? ('set:' + it.set) : 'solo') : it.slot;
      (groups[key] = groups[key] || []).push(e);
    });
    var keys = Object.keys(groups);
    if (sort === 'slot') {
      keys.sort(function (a, b) { return EQUIP_SLOT_ORDER.indexOf(a) - EQUIP_SLOT_ORDER.indexOf(b); });
    } else if (sort === 'set') {
      keys.sort(function (a, b) { return (a === 'solo' ? 1 : 0) - (b === 'solo' ? 1 : 0); });
    }
    var rows = [];
    keys.forEach(function (k) {
      var arr = groups[k];
      arr.sort(function (x, y) {
        return ui.bagCmp('equip', sort, GAME.eqId(x.inst), GAME.eqId(y.inst))
          || (GAME.eqEnhOf(y.inst) - GAME.eqEnhOf(x.inst));
      });
      var title, sub;
      if (k.indexOf('set:') === 0) {
        var sn = DATA.SETS[k.slice(4)];
        title = (sn ? sn.name : k.slice(4)) + ' 套件';
        sub = arr.length + ' 件';
      } else if (k === 'solo') {
        title = '散件（无套装）'; sub = arr.length + ' 件';
      } else {
        title = (DATA.EQUIP_SLOT_NAMES[k] || k); sub = arr.length + ' 件';
      }
      var cells = arr.map(function (e) {
        var inst = e.inst;
        var id = GAME.eqId(inst), it = DATA.EQUIP[id];
        var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
        var u = GAME.eqUidOf(inst);
        return ui.bagCell({
          /* v89.116：`DATA.EQUIP_SLOT_ICON` 不存在 —— 旧兜底一旦被走到就是**抛错**；
             真出口 `icons.forEquip` 恒在（icons.js），缺了也只是空图标、不炸。 */
          cls: 'q' + it.q, ico: (GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : ''),
          name: GAME.eqLabel(inst),
          q: it.q,
          /* v89.117：穿戴角标改**英雄全名**（原只显示首字，张飞/张辽分不出） */
          worn: e.wornBy || '',
          title: GAME.eqLabel(inst) + (setNm ? '（' + setNm + '）' : '') + (e.wornBy ? ' · ' + e.wornBy + ' 着' : ''),
          lore: (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + ' · ' + (DATA.Q_NAME[it.q] || '')
            + ' · 估值 ' + U.fmt(GAME.itemValue(id)) + (e.wornBy ? '　·　穿戴：' + e.wornBy : ''),
          attr: GAME.equipDescOf(inst),
          /* v89.214（老板 1）：悬停改**分行**（六维逐行 · 原始值白 + 增强值缀色） */
          attrHTML: ui.equipStatsHTML(inst),
          noteHTML: ui.equipEnhNoteHTML(inst),
          /* 穿戴件点击 = 开详情（卸下/强化/分解都在那里）；背包件保持"一键穿上"。
             —— 已穿在身上的再"穿上"没有意义，详情才是要去的下一级。 */
          act: e.wornBy ? 'bag-detail' : 'open-bag-equip', key: (u != null ? u : id),
          /* v90.55（老板）：未穿戴件 → 格上「售」按钮（出售换旧币；已穿戴不可售）。 */
          sellKey: e.wornBy ? null : (u != null ? u : id),
        });
      });
      rows = rows.concat(ui.bagRows(
        '<div class="bag-sec">' + title + ' <span class="n">' + sub + '</span></div>', k, cells));
    });
    return ui.pageBag('bag-equip', rows);
  };

  /* ---------- 材料页 ---------- */
  ui.bagMatHTML = function (sort) {
    var s = GAME.state, items = s.items || {};
    if (sort === 'have') {
      var owned2 = DATA.MATERIALS.filter(function (m) { return items[m.id] > 0; })
        .sort(function (a, b) { return (items[b.id] || 0) - (items[a.id] || 0); });
      if (!owned2.length) return '<div class="q-empty">尚无材料。攻打野地可按地形采集，攻占城市亦可缴获。</div>';
      return ui.pageBag('bag-mat', ui.bagRows(
        '<div class="bag-sec">按持有量排序 <span class="n">' + owned2.length + ' 种</span></div>', 'have',
        owned2.map(function (m) { return ui.matCell(m, items[m.id], false, sort); })));
    }
    var rows = [];
    (DATA.MAT_SERIES || []).forEach(function (ser) {
      var arr = DATA.MATERIALS.filter(function (m) { return m.series === ser.id; });
      arr.sort(function (a, b) { return sort === 'tier' ? b.tier - a.tier : a.tier - b.tier; });
      rows = rows.concat(ui.bagRows(
        '<div class="bag-sec" style="color:' + ser.tone + ';">' + ser.name +
        ' <span class="n">' + ser.use + ' · 持有 ' + arr.filter(function (m) { return items[m.id] > 0; }).length + '/' + arr.length + '</span></div>',
        ser.id, arr.map(function (m) { return ui.matCell(m, items[m.id] || 0, false, sort); })));
    });
    return ui.pageBag('bag-mat', rows);
  };

  /* ---------- 图纸页 ---------- */
  ui.bagBpHTML = function (sort) {
    var s = GAME.state, items = s.items || {};
    var arr = (DATA.BLUEPRINTS || []).filter(function (b) { return items[b.id] > 0; });
    arr.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    if (!arr.length) {
      return '<div class="q-empty">尚无装备图纸。<br>来源：游商购买 · 攻占名城缴获（重镇 18% / 首府 40% / 旧都 80%）· 遗迹古冢</div>';
    }
    return ui.pageBag('bag-bp', ui.bagRows(
      '<div class="bag-sec">装备图纸 <span class="n">凭图纸可于制造厂打造对应套装</span></div>', 'bp',
      arr.map(function (b) {
        var q = b.forgeLv >= 7 ? 4 : b.forgeLv >= 5 ? 3 : 2;
        return ui.bagCell({
          cls: 'q' + q,
          ico: GAME.icons.forItem ? GAME.icons.forItem('blueprint', b.id) : '📜',
          name: b.name, cnt: items[b.id], q: q, noStar: true,
          title: b.name, lore: '需制造厂 Lv' + b.forgeLv + ' · 持有 ' + items[b.id],
          attr: b.desc, act: 'open-bp-detail', key: b.id,
        });
      })));
  };

  /* ---------- 宝物页 ---------- */
  /* ---------- 宝物页（v29 · 需求 14 改版式） ----------
     与游商同一套「物品行」：左贴图 / 右介绍 / 下方 数量输入框 + 使用按钮。
     数量以**本行输入框**为准（不再是全局的一个"使用数量"档位）。 */
  /* 背包宝物页的类型分组表（v89.51：提为**出口常量**，门禁可直接断言闭环）
     —— 凡是「能在背包里用」的类型必须在此有分组；material / blueprint 走专属页签。
     改前缺 chest / neigong / corvee / talis / build_cost 五类：宝箱、残卷、政令、
     封存匣、营造物**买得到、看得见单价，却在背包里根本不显示** ——
     老板点的「买了用不了」正是这里。 */
})();
