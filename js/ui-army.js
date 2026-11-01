/* ============================================================
 * ui-army.js　军务 · 出征战术 / 阵位指令 / 募兵
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

  /* ============================================================
   * 出征战术（v59 · 阵位与指挥指令的设置界面）
   * ------------------------------------------------------------
   * 原版把这件事放在「练兵场 → 出征 → 出征战术」里设默认动作，防守方在
   * 「练兵场 → 防守战术」里设。本作**只有攻方需要指挥**（守方 NPC 用默认动作，
   * 见 GAME.tacticOf 的注释：做了没有消费点的入口就是死数据），所以只做一个入口。
   *
   * 每兵种两项（照搬原版 §九）：
   *   · 动作 —— 前进 / 防御 / 后退，**决定初始站位**（100 / 50 / 0）与每回合怎么动
   *   · 目标 —— 「自动」或敌方某一兵种，另有「箭塔」（攻城时拆工事，原版的核心动作）
   * 点选即存、只切 class 不重绘（与全站点选一致），下次出征生效。
   * ============================================================ */
  ui.TAC_PER = 4;                    // 弹窗每页 4 个兵种（页面内嵌不分页，全列）
  /* 战术 chip —— side 必填（v89.109 起战术分侧：atk = 出征 / def = 防守）。
     ⚠️ `data-g` 必须带 side 前缀：出征页与防守页的 chip 若同名，互斥组会串台。 */
    /* ⛔ v89.133 退役：`tacticChip`（chip 按钮组）—— 第 13 条改下拉框后无调用点。
     原实现：`<span class="chip" data-action="tactic-set" data-f=… data-v=…>`（v89.109 版）。 */

  /* 会出现在战场上的兵种（与 tactic.unitsOf 的判据一致：非 nocombat）——
     侦察单元不上阵、指挥它没有意义，所以战术表里也不该有它。 */
  ui.tacticTroopIds = function () {
    return Object.keys(DATA.TROOPS).filter(function (id) { return !DATA.TROOPS[id].nocombat; });
  };
  /* 单兵种战术块（页面与弹窗共用 —— **唯一渲染口**，改样式只改这一处）。
     未设置时高亮该侧**默认**（防守侧 = 全员前进；出征侧 = 前进）——
     "高亮的就是下场时生效的"，不留给玩家"我到底设没设"的疑问。 */
  ui.tacticBlockOf = function (side, id) {
    /* v89.136（老板 4）：'raid'/'occupy' 是**出征细分页** ——
       显示走合并视图（细分覆盖通用 · 与战斗读取同一口径），写入 data-tside 落细分表。 */
    if (side !== 'def' && side !== 'raid' && side !== 'occupy') side = 'atk';
    var isDef = side === 'def';
    var isSub = (side === 'raid' || side === 'occupy');
    var tr = DATA.TROOPS[id];
    var set = (isSub ? GAME.tacticsFor(side) : GAME.tacticsOf(side))[id] || {};
    /* v89.137（清单②）：细分页显示"这条是细分里设的，还是跟随通用"——
       ownSub137 = 细分表（raid/occupy）里有该兵种的记录（写入端 data-tside 即落该表）。 */
    var ownSub137 = isSub
      ? !!(GAME.state && GAME.state.tactics && GAME.state.tactics[side] && GAME.state.tactics[side][id])
      : false;
    var curS = set.s || (isDef ? 'hold' : 'advance');
    var curT = (typeof set.t === 'string') ? set.t : '';
    var sortieOn = !!set.sortie;
    var ids = ui.tacticTroopIds();
    /* v89.149（老板 4）：默认目标 = 同兵种（引擎层），战术页的「自动」即此义；
       「任意」= 显式不指定（哨兵 DATA.TARGET_ANY）—— 保住"打最近的"这条既有能力。 */
    var tgt = [{ v: '', label: '自动（同兵种）' }]
      .concat([{ v: DATA.TARGET_ANY, label: '任意（打最近）' }])
      .concat(ids.map(function (x) {
        return { v: x, label: DATA.TROOPS[x].name };
      })).concat([{ v: DATA.TARGET_WALL, label: '⚙️ ' + DATA.WALL_TOWER.name }]);
    /* ============================================================
     * v89.133（v89.128 第二批第 13 条 · 老板）：「军务中出征战术，动作和目标均以下拉框
     *   显示，不直接全部列出，分左右两列显示」——
     *   chip 按钮组（一排 3~6 个）→ **原生 select**；行内只留「名称 · 动作 · 目标」（防守侧 + 出城）。
     * 一份实现两处宿主：**出征战术页**与**页内弹窗**（openTacticModal 复用本函数）——
     *   change 由 main.js 的全局委托转 GAME.action（与页内其它 select 同一机制）。
     * ============================================================ */
    var sel = function (k, cur, opts) {
      return '<select class="city-select tl-sel" data-action="tactic-set" data-tside="' + side +
        '" data-troop="' + id + '" data-f="' + k + '">' +
        opts.map(function (o) {
          return '<option value="' + o.v + '"' + (cur === o.v ? ' selected' : '') + '>' +
            U.escape(o.label) + '</option>';
        }).join('') + '</select>';
    };
    /* v89.138（清单①）：细分页"本页单独设置"的行加**左侧金边**（own-sub）——
       改细分下拉后整行立刻带金边（与行尾小标两层视觉），一眼分清哪几行覆盖了通用。 */
    return '<div class="tac-line' + (isSub && ownSub137 ? ' own-sub' : '') + '">' +
      '<span class="tl-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</span>' +
      sel('s', curS, DATA.STANCES.map(function (st) { return { v: st.id, label: st.icon + st.name }; })) +
      sel('t', curT, tgt) +
      (isDef ? '<label class="tl-sortie" title="出城迎战：出城部队前出到围墙之外 —— 攻方必须先把它打完，'
        + '才够得着围墙；它也吃不到围墙护佑">' +
        '<input type="checkbox" data-action="tactic-set" data-tside="' + side + '" data-troop="' + id +
        '" data-f="sortie"' + (sortieOn ? ' checked' : '') + '>出城</label>' : '') +
      /* v89.137：细分页的小标（"跟随通用" / "细分"）—— 一眼分清哪几行是本页设的 */
      (isSub
        ? '<span class="tl-sub-tag' + (ownSub137 ? ' own' : '') + '" title="' +
          U.escape(ownSub137
            ? '本页单独设置 —— 覆盖通用出征战术（战斗按本页执行）'
            : '未单独设置 —— 跟随通用的出征战术（改这里的下拉即在本页单独设置）') +
          '">' + (ownSub137 ? '细分' : '跟随通用') + '</span>'
        : '') +
      '</div>';
  };
  /* 全表（页面内嵌用） */
  ui.tacticBlockHTML = function (side) {
    /* v89.133（第 13 条）：**分左右两列** —— 每个兵种一行（名称 · 动作 · 目标）。 */
    return '<div class="tac-grid">' +
      ui.tacticTroopIds().map(function (id) { return ui.tacticBlockOf(side, id); }).join('') + '</div>';
  };
  ui.openTacticModal = function (side) {
    /* v89.136（老板 4）：支持细分（'raid'/'occupy'）—— 出征面板的「逐兵种」按当前出征方式打开。 */
    if (side !== 'def' && side !== 'raid' && side !== 'occupy') side = 'atk';
    var isDef = side === 'def';
    var isSub = (side === 'raid' || side === 'occupy');
    var ids = ui.tacticTroopIds();
    var pg = ui.modalPage('tactic' + side, ids, ui.TAC_PER, function () { ui.openTacticModal(side); });
    var body = pg.slice.map(function (id) { return ui.tacticBlockOf(side, id); }).join('');
    ui.openShell({
      title: isDef ? '🛡️ 防守战术'
        : (side === 'raid' ? '⚔️ 出征战术 · 掠夺'
          : (side === 'occupy' ? '⚔️ 出征战术 · 占领' : '⚔️ 出征战术')),
      sub: '当前：' + GAME.tacticSummary(side) + ui.help(
        '每兵种：**动作**（前进 / 防御 / 后退）+ **目标**（敌方某一兵种，或攻城时的**箭塔**）。' +
        (isDef ? '\n防守侧另有「**出城迎战**」：出城部队前出到围墙之外 —— 攻方必须先把它打完，\n才够得着围墙（拆不了工事）；它也吃不到围墙护佑（风险与收益都归自己）。' : '') +
        '\n动作决定**初始站位**：前进 = 第一排（100）、防御 = 第二排（50）、后退 = 第三排（0）。\n' +
        '· **前进**：每回合向敌阵推进（推进到刚好能开火就停）\n' +
        '· **防御**：原地不动，**受到的伤害减半**（远程原地对射就是选它）\n' +
        '· **后退**：每回合向己方后撤，用来躲开箭塔的**双倍攻击区**\n' +
        '目标：指定兵种在射程内就优先打它；选**箭塔**则专拆城防工事（拆完自动转为打守军）。\n' +
        (isDef ? '我方城市被攻打时用**你设的这套**；NPC 守方用默认（全员前进）。'
               : '守方（NPC 城市 / 野地）默认动作：**全员前进**（v89.203 起野地/据点/名城统一）。')),
      body: body + pg.pager,
      foot: '<div class="m-foot">' +
        '<button class="btn" data-action="tactic-reset" data-tside="' + side + '">恢复默认</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>' +
      '</div>',
    });
  };
  /* ③ 资源栏：每项数量+时产+「+」快捷道具 */
  var RES_QUICK_ITEM = { grain: 'shennongchu', wood: 'lubanfu', stone: 'kaishanchui', iron: 'xuantielu', gold: 'shuilibian' };
  /* ============================================================
   * 侧栏资源栏（v29 建 · v60 改口径）
   * ------------------------------------------------------------
   * v29：产量取 `GAME.productionPerSec()` 是**全境合计**，切城时资源栏一个数字
   *   都不动；于是改成本城产量，栏首写明"本城产量 · 全境存量"。
   * v89.123（老板「资源产量以每小时产量呈现，过万以"万"显示」）：
   *   增速由「/秒」改「/时」（`U.rateHTML` 内换算，入参 *每秒* 口径不变），
   *   数值过万进「万」档（`U.perHourText` 唯一出口）；悬停明细与主显示同口径。
   * v60（需求 4）：**存量也归属城市了** —— s.res 现在就是当前城的库存
   *   （见 state.js 的 attachRes 访问器）。所以：
   *     · 栏首报"本城"；
   *     · 存量 = 本城库存（不是全境共享）；
   *     · 悬停里仍给出"本城构成 / 全境合计"两把尺子，方便对比；
   *     · 上限取本城仓容（GAME.storeCap 已按城）。
   * ============================================================ */
  ui.renderResBar = function (c, s) {
    var box = $('#res-bar');
    if (!box) return;
    /* v89.158（老板 2）：悬停保护 —— 鼠标在资源栏内时本秒不重绘
       （否则每秒重建会把悬停的 .amt / .rate-wrap 节点换掉 → 容量悬停闪烁）。 */
    if (ui.hoverHold(box)) return;
    var prodAll = GAME.productionPerSec();
    var prodCity = GAME.cityProdPerSec(c);
    /* v77（老板）：原「本城 · 城名」表头退役。
       v90.90（老板）：附属野地清单**移入君主左侧**（资源区下拉退役）。 */
    var html = '';
    DATA.RES_ORDER.forEach(function (k) {   /* v89.134：读 DATA.RES_ORDER */
      var meta = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
      var perSec = prodCity[k] || 0;          // 本城产量（随切城变化）
      var perSecAll = prodAll[k] || 0;        // 全境合计（悬停里给出）
      var val = s.res[k] || 0;
      /* v19：资源行**只用文字**（去掉图标）；存量取整到个位
         （小数在每秒刷新的画面上一直在闪，没有信息量）；增速仍按 /秒。 */
      /* v20（需求 11）：产量悬停显示构成明细（基础产量 + 各类加成/扣除） */
      /* v20（需求 11）：产量悬停显示构成明细（基础 + 各类加成/扣除）
         U.rateHTML 产出的是 <span class="num-rate">，外面再包一层带 data-tip 的容器。 */
      var bd = GAME.prodBreakdown ? GAME.prodBreakdown(k, c) : null;
      var tipLines = ['本城产量构成（/时）'];
      var _ts = GAME.timeScale();
      if (bd && bd.length) {
        bd.forEach(function (x) {
          /* v89.123：明细与主显示同口径 —— /时（游戏时间，×3600÷ts）+ 过万以万 */
          tipLines.push(x.name + '：' + (x.val >= 0 ? '+' : '-') + U.perHourText(Math.abs(x.val) * 3600 / _ts));
        });
        tipLines.push('本城合计：+' + U.perHourText(perSec * 3600 / _ts));
      } else {
        tipLines.push('本城暂无产量');
      }
      tipLines.push('———');
      tipLines.push('全境合计：+' + U.perHourText(perSecAll * 3600 / _ts));
      var rateHtml = '<span class="rate-wrap" data-tip="' + U.escape(tipLines.join('\n')) + '">'
        + U.rateHTML(perSec) + '</span>';
      /* v89.158（老板 1「左侧资源统计的容量显示仍然不对」）：容量悬停改**分账**——
         上限 = 战储仓/基础 + 城外堆场，两行相加自洽（唯一出口 GAME.storePartsOf）；
         改前只写"其中城外堆场 +Y"，另外的 200 万基础没有出处（账对不上）。
         已占 ≥100% 显示"已满"（不再出现"已占 123%"这类读数）。
         旧币是货币，不受战储仓上限约束（同前口径）。 */
      var sp = GAME.storePartsOf ? GAME.storePartsOf(GAME.currentCity()) : null;
      /* v89.212（老板 1）：城外堆场按资源分账 —— 本行上限取**本资源自己的** cap
         （净水 = 战储仓 + 净化厂堆场 / 生物质 = 战储仓 + 温室堆场……「地块多的存的多」）。 */
      var cap = (k === 'gold') ? 0
        : ((sp && sp.capByRes && sp.capByRes[k] != null) ? sp.capByRes[k]
          : (sp ? sp.total : (GAME.storeCap ? GAME.storeCap() : 0)));
      var _pct = (cap > 0) ? Math.round(val / cap * 100) : 0;
      var amtTip = (k === 'gold')
        ? ('旧币：全境通用（各城共用这一口池子 —— 任何城市的建造 / 募兵 / 花销都从这里扣）'
          + '\n货币，不受仓储上限约束；无需运输。'
          + '\n现有 ' + U.numText(val, 0))
        : ((meta ? meta.name : k) + '　上限 ' + U.amtText(cap)
          + '（' + (_pct >= 100 ? '已满' : '已占 ' + _pct + '%') + '）'
          + '\n· ' + ((sp && sp.lv > 0)
              ? ('战储仓（' + sp.lv + ' 级合计）：' + U.amtText(sp.base))
              : ('基础储量：' + U.amtText(sp ? sp.base : cap)))
          + ((sp && sp.extByRes && sp.extByRes[k] > 0)
              ? ('\n· 城外堆场（本类地块）：+' + U.amtText(sp.extByRes[k])
                + '（净化厂堆水 / 温室堆生物质 / 电站堆电能 / 熔炉堆废钢 · 不吃仓储加成）')
              : '')
          /* v89.160（老板 1）：逾溢折损 —— **机制在界面可见**（读数与结算同源 DATA.OVERFLOW） */
          + (_pct >= 100 ? ('\n· ⚠️ 已超上限：超出部分每游戏日折损 '
              + Math.round(((DATA.OVERFLOW || {}).ratio == null ? 0.25 : DATA.OVERFLOW.ratio) * 100) + '%'
              + '（现实约 ' + ui.rotPeriodRealText() + '）（'
              + (((DATA.OVERFLOW || {}).events) || []).map(function (e) { return e.name; }).join(' / ') + '）') : '')
          + '\n现有 ' + U.numText(val, 0));
      html += '<div class="res-line">' +
        '<span class="lbl">' + (meta ? meta.name : k) + '</span>' +
        '<span class="val">' +
          '<span class="amt" title="' + U.escape(amtTip) + '">' + U.amtHTML(val) + '</span>' +
          rateHtml +
          /* v89.128（老板）：「不要显示现有道具数量，纯粹一个加号按钮就行」 */
          '<span class="plus-btn" data-action="quick-item" data-res="' + k + '" title="使用辅助宝物">+</span>' +
        '</span></div>';
    });
    box.innerHTML = html;
  };

  /* 「+」号：弹出该资源对应的辅助宝物 */
  ui.openQuickItem = function (res) {
    var s = GAME.state;
    var itemId = RES_QUICK_ITEM[res];
    var cands = DATA.ITEMS.filter(function (it) { return it.type === 'prod_buff' && it.res === res; });
    var resName = '';
    DATA.RESOURCES.forEach(function (r) { if (r.key === res) resName = r.name; });
    var rows = cands.map(function (it) {
      var have = (s.items && s.items[it.id]) || 0;
      return '<div style="background:rgba(var(--sh-rgb),.22);border:1px solid #1d2028;border-radius:8px;padding:10px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-weight:700;color:var(--gold-light);">' + it.name + ' <span style="color:var(--text-dim);font-size:var(--fs-cap);">持有 ' + have + '</span></span>' +
          (have ? '<button class="btn sm gold" data-action="use-item-quick" data-item="' + it.id + '">使用</button>'
                : '<button class="btn sm gold" data-action="shop-buy" data-item="' + it.id + '" title="单价 ' +
                  U.numText(it.price * 100, 0) + ' 旧币">购买</button>') +
        '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:4px;">' + it.desc + '</div>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">加快' + resName + '产量</div>' + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
  };

  /* ============================================================
   * v89.128（老板 需求 7）：「幸存者增长速度这里加个类似资源增速的加号按钮，
   *   用于使用相关道具（不要显示现有道具数量）」—— 幸存者道具快用：
   *   招揽令（增速 buff）/ 迁入令（一次性注入）。与资源 "+" 同款交互；
   *   左侧栏按钮上**不显数量**，持有与否在弹窗里说明。
   * ============================================================ */
  ui.openQuickPop = function () {
    var s = GAME.state;
    var cands = DATA.ITEMS.filter(function (it) {
      return (it.type === 'pop_boost' || it.type === 'pop_fill') && !it.noShop;
    });
    var rows = cands.map(function (it) {
      var have = (s.items && s.items[it.id]) || 0;
      return '<div style="background:rgba(var(--sh-rgb),.22);border:1px solid #1d2028;border-radius:8px;padding:10px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-weight:700;color:var(--gold-light);">' + it.name + ' <span style="color:var(--text-dim);font-size:var(--fs-cap);">持有 ' + have + '</span></span>' +
          (have ? '<button class="btn sm gold" data-action="use-item-quick" data-item="' + it.id + '">使用</button>'
                : '<span style="color:var(--text-dim);font-size:var(--fs-sub);">未持有（游商 · 民生页有售）</span>') +
        '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:4px;">' + it.desc + '</div>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">幸存者道具（招揽令 / 迁入令）</div>' + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
  };

  /* 装备/宝物面板快捷入口 */
  /* ============================================================
   * 功能面板：统一以弹窗形式打开，均带「关闭」按钮
   * 功能归属建筑（避免顶部菜单与建筑入口重复）
   * ============================================================ */
  ui.PANEL_TITLE = {
    troops: '⚔️ 军队（军营）', tech: '📜 科技（科研中心）', equip: '🎽 装备（制造厂）',
    items: '💎 宝物', generals: '🧑‍✈️ 英雄（英雄枢纽）', stats: '📊 统计',
    rank: '🏅 威望', ext: '🌾 城外',
  };
  /* 募兵面板的**弹窗级重绘**（v20）
     原写法在 select-train 里调 GAME.refreshView()，它只重绘中央视图 ——
     而募兵面板开在弹窗里，于是「点了兵种没反应、训练永远是最初那个兵」。
     选中兵种/改数量后必须重绘弹窗本体。 */
  /* ============================================================
   * 募兵面板（v24 · 需求 8）
   * 入口一律带**军营下标** —— 募兵是某座军营的行为，队列也挂在它身上。
   * idx == null 时兜底取本城第一座军营（旧入口 / 中央视图直达）。
   * ============================================================ */
  ui.openTroops = function (idx, opts) {
    /* v80（老板）：「目前选择数量后会跳回到页面顶端，要求取消跳转这个动作」——
       重绘前把两级滚动容器的位置记下来（.inner-panel 与 .panel-body），重绘后原样还回去；
       仅当旧窗本来就是募兵面板（有 #train-count）时才恢复，从别处打开时仍从顶端开始。 */
    var prevRoot = $('#modal-root');
    var keep = null;
    if (prevRoot && prevRoot.querySelector('#train-count')) {
      var pIp = prevRoot.querySelector('.inner-panel');
      var pPb = prevRoot.querySelector('.panel-body');
      keep = { ip: pIp ? pIp.scrollTop : 0, pb: pPb ? pPb.scrollTop : 0 };
    }
    /* v89.229（兵种重构）：**统一面板** —— 兵营与机工坊共用一屏（14 兵种三组分页），
       旧 `filter`（'siege'/'normal'）参数退役；工位由**选中兵种**决定
       （trainBarracks 读 sel.craft）。
       ⛔ 入口语义与**重绘语义必须分开**（`opts.keepState`）：
         · 用户入口（从建筑/裸入口打开）→ 落「募兵队列」页（v81 老板：队列独占第一页）+
           按建筑类型预置选中项（机工坊 → 首个器械兵 / 军营 → 首个常备兵）；
         · 面板内重绘（切页 / 点兵种卡 / 数量变更 / renderTroopsModal）→ **保持**当前页与选中项。
       不分开的后果（v89.229 实机抓出）：`renderTroopsModal()` 走 `openTroops(_trainBIdx)` →
       每次都把 _trainTab 与 _trainSel 重置回"入口默认值" → 切页点不动、点卡也点不动
       （点击立即被重绘抹掉）。smoke 直接摆状态读 HTML，测不出这条；e2e 真点才暴露。 */
    var _keepState = !!(opts && opts.keepState);
    var _idx0 = (idx == null || idx === '' || !isFinite(Number(idx))) ? null : Number(idx);
    if (!_keepState) {
      if (_idx0 != null) {
        var c0 = GAME.currentCity();
        var inShop = (GAME.craftWorkshopsOf(c0) || []).some(function (x) { return x.idx === _idx0; });
        var _first = Object.keys(DATA.TROOPS).filter(function (id) {
          return !!DATA.TROOPS[id].craft === !!inShop;
        })[0];
        if (_first) ui._trainSel = _first;    /* 从哪座建筑打开 → 预置该类首个兵种 */
      }
      /* v90.64（老板）：募兵营改「左列清单 / 右详情」，**不再有分页**（14 兵种一列全列）；
         旧 `_trainTab` 取值一律退役，仅保留选中兵种 `_trainSel`。 */
    }
    ui._trainBIdx = _idx0;
    /* v89.211（老板 3）：入场工位**归一** —— 陈旧/跨类 idx（如上次点的是军营格）在这里
       回落本类首座，显示（trainBarracks）与提交（doTrain）此后读同一份。
       改前 siege 面板显示正常（有回落），提交却把旧 idx 原样交给 GAME.train →
       明明有作坊却报"本城尚无机工坊"（老板实测）。 */
    var _b211 = ui.trainBarracks();
    ui._trainBIdx = _b211 ? _b211.idx : null;
    ui.openPanel('troops', '⚔️ 兵种整备');
    if (keep) {
      var nIp = $('#modal-root .inner-panel');
      var nPb = $('#modal-root .panel-body');
      if (nIp) nIp.scrollTop = keep.ip;
      if (nPb) nPb.scrollTop = keep.pb;
    }
  };
  /* 面板内重绘（切页 / 点兵种卡 / 数量变更）——**必须保持**当前页与选中项
     （v89.229：不传 keepState 会退回"入口默认"，切页与点卡会被当场抹掉）。 */
  ui.renderTroopsModal = function () { ui.openTroops(ui._trainBIdx, { keepState: true }); };

  /* 当前面板的**工位**（v89.229：统一面板后按**选中兵种**解析 —— 器械兵 → 机工坊，
     常备兵 → 军营）。显示（troopsHTML）与提交（doTrain）读同一份。
     找不到时回退该类的第一座。 */
  ui.trainBarracks = function () {
    var c = GAME.currentCity();
    var sel = DATA.TROOPS[ui._trainSel];
    var isCraft = !!(sel && sel.craft);
    var list = isCraft ? GAME.craftWorkshopsOf(c) : GAME.barracksOf(c);
    if (!list.length) return null;
    if (ui._trainBIdx != null) {
      for (var i = 0; i < list.length; i++) if (list[i].idx === ui._trainBIdx) return list[i];
    }
    return list[0];
  };

  /* ============================================================
   * v91.72（老板）：「多条目的信息，比如步兵队列。满 6 条会将这个界面撑开，
   *   对于这种多条目的信息，建议采用一个伸缩的设置 —— 除非展开，否则收起来，
   *   以一条汇总呈现」。
   * ------------------------------------------------------------
   * 通用**折叠块**（唯一出口）：标题行 = 汇总（总是可见），明细默认收起，
   * 点标题行展开/收起。展开态记 `ui._foldOpen[key]`（界面态，不落存档）；
   * 动作 `fold-toggle` 在 main.js 里改状态 + 走当前弹窗的 live 回调重绘
   * （保存滚动位），无 live 时退回整页重绘。
   * ============================================================ */
  ui._foldOpen = {};

})();
