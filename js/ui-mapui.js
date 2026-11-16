/* ============================================================
 * ui-mapui.js　地图界面 · 调兵运输 / 据点情报 / 地图本体 / 前哨格
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
   * v93.3：拓荒队面板 —— 用这一代人，换下一代人能活
   * ------------------------------------------------------------
   * 风险是**算出来的、写出来的**（距离/目标/人数都摆着），
   * 玩家不是在抽奖，是在决定"这 300 个人值不值一趟"。
   * ============================================================ */
  ui.openConvoyModal = function () {
    var CV = GAME.convoy;
    if (!CV) return;
    var city = GAME.currentCity();
    var pop = city ? Math.round(city.pop || 0) : 0;
    var h = '<div class="gold-heading">🚚 拓荒队</div>';
    h += '<div class="panel-body">';
    h += '<div class="exp-info exp-info-l">'
      + '带出去的是<b>人</b>，不是兵。他们可能回不来 —— 但带回来的东西，<b>买不到</b>。</div>';
    h += '<div style="font-size:var(--fs-cap);color:var(--gold-light);margin:8px 0;">已到手：'
      + U.escape(CV.lineOf()) + '</div>';
    h += '<div style="font-size:var(--fs-cap);color:var(--text-dim);margin-bottom:6px;">'
      + '城里现有人口：<b>' + U.numText(pop, 0) + '</b></div>';

    var ts = CV.targets();
    if (!ts.length) {
      h += '<div class="q-empty">还没有可去的地方。先往远处探一探。</div>';
    }
    ts.forEach(function (t) {
      h += '<div style="border-top:1px solid var(--wood-light);padding:8px 0;">';
      h += '<div><b>' + t.icon + ' ' + U.escape(t.name) + '</b>'
        + '<span style="color:var(--text-dim);font-size:var(--fs-cap);">　距离 ' + t.dist + ' 格 · 带回「'
        + U.escape(t.gainName) + '」</span></div>';
      if (t.cleared) {
        h += '<div style="font-size:var(--fs-cap);color:var(--text-dim);margin-top:4px;">已经搬空了。</div>';
      } else {
        var d100 = CV.deadEstimateOf(t, 100), d300 = CV.deadEstimateOf(t, 300);
        h += '<div style="font-size:var(--fs-cap);color:var(--text-dim);margin-top:3px;">'
          + '派 100 人：预计回不来的 <' + d100 + ' 人　·　派 300 人：预计 <' + d300 + ' 人'
          + '（人越多，死的比例越低，但死的总数更多）</div>';
        h += '<div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap;">'
          + '<button class="btn" data-action="convoy-send" data-ck="' + t.kind + '" data-n="100">派 100</button>'
          + '<button class="btn" data-action="convoy-send" data-ck="' + t.kind + '" data-n="300">派 300</button>'
          + '<button class="btn" data-action="convoy-send" data-ck="' + t.kind + '" data-n="600">派 600</button>'
          + '</div>';
      }
      h += '</div>';
    });

    h += '</div><div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(h);
  };

  ui.openCityPanel = function (city) {
    var s = GAME.state;
    city = city || GAME.currentCity();
    if (!s || !city) { ui.toast('城市不存在'); return; }
    var R = GAME.res(city);
    var perk = GAME.perkOf(city);
    var isOwn = (s.cities || []).some(function (c) { return c.id === city.id; });
    var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(city) : null;
    /* v89.113（老板需求 3）：城主（文治）与守将（武功）同级并列 */
    var mayor = GAME.mayorGeneralOf ? GAME.mayorGeneralOf(city) : null;
    var lv = GAME.buildingLevel(city, 'guanfu') || 1;
    var rows = GAME.TRANSPORT_KEYS.map(function (k) {
      var meta = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
      return '<div class="attr"><span class="k">' + (meta ? meta.icon + ' ' + meta.name : k) + '</span>' +
        '<span class="v">' + U.numText(R[k] || 0, 0) + '</span></div>';
    }).join('');
    ui.openShell({
      /* v89.135（老板 7）：逐秒刷新（驻军/资源/幸存者实时；有输入焦点时自动跳过） */
      live: function () { ui.openCityPanel(city); },
      title: (isOwn ? '🏯 ' : '🏙 ') + U.escape(city.name),
      sub: ui.cityTierName(city.type) + '　政务厅 Lv' + lv + '　' + GAME.map.coordText(city.x, city.y) +
        (GAME.isFamousCity(city) ? '　·　名城' : ''),
      body:
        /* 档位优势（需求 5）：名城与自建城的差别写在这里 —— 玩家点开一座城
           第一眼就该知道"占了它有什么好处"。 */
        '<div class="attr"><span class="k">' + perk.name + '优势</span><span class="v">' +
          U.escape(perk.desc) + '</span></div>' +
        (isOwn ? rows +
          '<div class="attr"><span class="k">👥 幸存者</span><span class="v">' +
            U.numText(R.pop || 0, 0) + ' / ' + U.numText(GAME.effPopCapOf ? GAME.effPopCapOf(city) : GAME.maxPopOf(city), 0) + '</span></div>' +
          /* v93.5：**城会自己长** —— 住不下的人在城墙外搭棚子。
             有才显示（没有就不占版面）；带一个"推平"按钮，
             因为这是唯一能对"自己长出来的东西"动手的地方。 */
          ((function () {
            var sh = (GAME.growth && GAME.growth.shantyOf) ? GAME.growth.shantyOf(city) : 0;
            if (sh <= 0) return '';
            var capSh = GAME.growth.shantyCapOf ? GAME.growth.shantyCapOf(city) : 0;
            return '<div class="attr"><span class="k">🏚 城外棚户</span><span class="v" style="color:var(--red-light);">'
              + U.numText(sh, 0) + ' / ' + U.numText(capSh, 0) + ' 人'
              + '　<span style="font-size:var(--fs-cap);color:var(--text-dim);">寒潮先死 · 会起火</span>'
              + '　<button class="btn" style="font-size:var(--fs-cap);padding:0 6px;margin-left:4px;"'
              + ' data-action="shanty-clear" data-cid="' + city.id + '">推平</button>'
              + '</span></div>';
          })()) +
          '<div class="attr"><span class="k">⚔ 驻军</span><span class="v">' +
            U.numText(GAME.armyTotal(city), 0) + '　城防 ' + GAME.cityDefense(city) + '</span></div>' +
          /* v96：兵员等级（这座城训到几级，直接决定战力与能接什么仗） */
          (GAME.trooplv ? ('<div class="attr"><span class="k">🪖 兵员</span><span class="v">'
            + U.escape(GAME.trooplv.lineOf(city).replace('🪖 ', '')) + '</span></div>') : '') +
          /* v97：惰性（压兵员等级上限的那条） */
          (GAME.idle && GAME.idle.of(city) > 0
            ? ('<div class="attr"><span class="k">🧠 惰性</span><span class="v">'
              + U.escape(GAME.idle.cityLine(city)) + '</span></div>') : '') +
          /* ============================================================
           * v94.1：这座城的**三条线**（污染 / 温度 / 补给）
           * ------------------------------------------------------------
           * 六层世界的最小版里，这三条是"这座城自己的账"，
           * 所以它们该在城面板里出现，而不是只在世界的账本里汇总。
           * 没有内容的行不显示（不拿空行占版面）。
           * ============================================================ */
          ((function () {
            var rows2 = [];
            if (GAME.taint && GAME.taint.cityLine) {
              var tn = GAME.taint.levelOf(city);
              rows2.push('<div class="attr"><span class="k">☢ 污染</span>'
                + '<span class="v" style="color:' + tn.color + ';">'
                + U.escape(GAME.taint.cityLine(city).replace('☢ 污染 ', '')) + '</span></div>');
            }
            if (GAME.climate && GAME.climate.cityLine) {
              rows2.push('<div class="attr"><span class="k">🌡 温度</span><span class="v">'
                + GAME.climate.cityLine(city) + '</span></div>');
            }
            if (GAME.land && GAME.land.cityLine) {
              rows2.push('<div class="attr"><span class="k">🛣 补给</span><span class="v">'
                + GAME.land.cityLine(city) + '</span></div>');
            }
            return rows2.join('');
          })()) +
          '<div class="attr"><span class="k">📜 城主</span><span class="v">' +
            (mayor ? (function () {
              /* v89.162（老板「列举城主的六维加成」）：悬停给出城主**全部**加成
                 （治理→产量/建造/税收 · 谋略→研究/城防），小字保持一行不撑版面。 */
              var mbC = GAME.mayorBonus(city);
              var tipC = '治理 → 产量 +' + Math.round(mbC.prod * 100) + '% · 建造 +'
                + Math.round(mbC.build * 100) + '% · 税收 +' + Math.round(mbC.tax * 100) + '%'
                + '\n谋略 → 研究 +' + Math.round(mbC.research * 100) + '% · 城防 +'
                + Math.round(mbC.def * 100) + '%';
              return U.escape(mayor.name) + ' Lv' + mayor.level
                + '　<span class="ui-sub" title="' + U.escape(tipC) + '">治理·谋略</span>';
            })() : '<span class="ui-sub">未任命（治理/谋略加成为零）</span>') + '</span></div>' +
          '<div class="attr"><span class="k">🎖 守将</span><span class="v">' +
            (guard ? (function () {
              /* v89.115：守城全军加成就地可见（与实战同一原子 genAttrs.atkPct/defPct）——
                 守城战时**不打指挥折扣**（全覆盖），界面读的就是这个数。 */
              var ga = GAME.genAttrs(guard);
              return U.escape(guard.name) + ' Lv' + guard.level +
                '　<span class="ui-sub">征兵·对阵　·　守城全军加成：攻 +' +
                Math.round((ga.atkPct || 0) * 100) + '%　防 +' + Math.round((ga.defPct || 0) * 100) +
                '%</span>';
            })() : '<span class="ui-sub">未任命</span>') + '</span></div>'
          : '<div class="q-empty">尚未据有此地。</div>') +
        /* 名城专属选项（v60 · 需求 5）：只有名城才有的额外操作。
           冷却与代价写在悬停里（弹窗正文高度是最稀缺的资源，说明文字不上正文）。 */
        (isOwn ? (function () {
          var opts = GAME.cityOptsOf(city);
          if (!opts.length) return '';
          return '<div class="ui-sub" style="margin-top:10px;">' + perk.name + '专属</div>' +
            '<div class="chips city-opts">' + opts.map(function (o) {
              var cd = GAME.cityOptCdLeft(city, o);
              var costTxt = Object.keys(o.cost || {}).map(function (kk) {
                return GAME.resName(kk) + ' ' + U.fmt(o.cost[kk]);
              }).join('　');
              return '<span class="chip' + (cd ? ' dim' : '') + '" data-action="city-opt"' +
                ' data-city="' + city.id + '" data-opt="' + o.id + '"' +
                ' title="' + U.escape(o.desc + (costTxt ? '\n代价：' + costTxt : '') +
                  (cd ? '\n冷却中：还需 ' + cd + ' 日' : '')) + '">' +
                o.icon + ' ' + o.name + (cd ? ' <i class="chip-sub">' + cd + '日</i>' : '') + '</span>';
            }).join('') + '</div>';
        })() : ''),
      /* ============================================================
       * v89.138（老板 2）：「调兵·运输，英雄派遣**合并成"派遣"和"运输"**，均进入出征界面
       *   设定英雄和兵种以及携带的资源。**去掉度支归集**。…**去掉改名**菜单。
       *   放弃城市菜单**增加二次确认**。」
       * ------------------------------------------------------------
       * · 派遣 / 运输 = 同一出征界面的两个入口（带各自的操作提示，见 openExpModal 的 opts.hint）——
       *   派遣 = 兵/将随军入城（可不带货）；运输 = 押运资源（先选兵，再填辎重）；
       * · 「英雄派遣」独立面板（openDispatch）与「度支归集」「改名」整条退役 ——
       *   改名在**政务厅面板**（open-rename-city）仍有入口，功能不丢；
       * · 节钺扩编：悬停**第一行先讲"这是干什么用的"**（老板问过一次，说明原文案没讲透）。
       * ============================================================ */
      foot: '<div class="m-foot">' +
        (isOwn
          ? '<button class="btn gold" data-action="city-enter" data-city="' + city.id + '">进入城市</button>' +
            /* v142：地图上的城面板直接进 3D 街区（省掉"先进 2D、再点右下角 3D"两步）。
               v60 老板说过「不要一点击地图就直接进入城市」，所以入口仍在面板里 ——
               新按钮只是把"进入"这条路的终点从 2D 棋盘换成了街上。 */
            '<button class="btn" data-action="city-enter-3d" data-city="' + city.id + '"' +
              ' title="' + U.escape('直接进 3D 街区：走街串巷，走到建筑旁按 E 进屋（建造/升级仍在城市页那套面板）')
              + '">🏙 进城逛逛（3D）</button>' +
            '<button class="btn" data-action="city-dispatch-exp" data-city="' + city.id + '"' +
              ' title="' + U.escape('派遣：把兵力 / 英雄调往本城 —— 在出征界面选主将 + 兵种，抵达即入城（不带货也可发）')
              + '">🛡️ 派遣</button>' +
            '<button class="btn" data-action="city-transport" data-city="' + city.id + '"' +
              ' title="' + U.escape('运输：把资源运往本城 —— 在出征界面先选押运兵力（运力随兵力涨），再到辎重区填资源')
              + '">🚚 运输</button>' +
            /* v89.95（A1）· v89.138：节钺扩编 —— 悬停第一行先答"干什么用的" */
            '<button class="btn" data-action="jieyue-expand" data-city="' + city.id +
              '" title="' + U.escape('【扩编】给本城 +1 个建造位（同时可建工程数 +1，每城至多 '
                + ((DATA.JIEYUE || {}).citySlotMax || 2) + ' 次）—— 消耗 1 枚「节钺」。\n'
                + '节钺是君主符节（' + (GAME.jieyueTextOf ? GAME.jieyueTextOf() : '') + '）：旧币买不到，'
                + '首占名城 / 完成特定功业才得；共 4 种用法 —— 觉醒体→天启体、城建扩编（本按钮）、'
                + '练兵场扩编（出征容量 +1 万人马）、招揽人才（英雄席位 +1）。')
                + '">🪓 节钺扩编 · 建造位 +1（' +
              ((city.jieyueSlots || 0) >= ((DATA.JIEYUE || {}).citySlotMax || 2)
                ? '本城已满 ' + (city.jieyueSlots || 0) + '/' + ((DATA.JIEYUE || {}).citySlotMax || 2)
                : '本城 ' + (city.jieyueSlots || 0) + '/' + ((DATA.JIEYUE || {}).citySlotMax || 2)
                  + '　持符 ' + GAME.jieyueOf()) + '</button>'
          : '') +
        /* v67（老板）：放弃城市 —— 只在还有别的城可去时才出现（否则点了必被拒）。
           v91.72：只有**自建城且未设为主城**可弃（名城/主城不给入口，判据同 abandonCityCheck）。 */
        (isOwn && (s.cities || []).length > 1 && (city.type || 'self') === 'self' && !city.origId
          && !(GAME.isMainCity && GAME.isMainCity(city))
          ? '<button class="btn red" data-action="city-abandon-ask" data-city="' + city.id +
            '" title="只有自建城可以放弃；主城需先迁都，名城不可放弃">🗑️ 放弃城市</button>'
          : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ⛔ v89.103 退役：**旧的「资源运输」面板**（openTransport / transportEstHTML /
     syncTransportEst / setTrTo / setTrKey / setTrPct / doTransport / TR_PCTS）——
     老板「任意自身城市向其他城市进行资源运输，应当采用出征界面，完成英雄，兵种，
     资源数量等确认」。现在：出征界面选己方城市 → 辎重区填资源数量 → 兵力押运、
     走行军通道抵达入城（见 ui.expCargoHTML / GAME.doTransferCargo）。
     ⚠️ 顺带消灭的老 bug：旧面板打开时 `ui._trTo[from.id]` **没有落默认值**，
     而 `doTransport` 又只读它 —— 于是"主城 → 分城点运输"必然报「城市不存在」
     （对象是空 id）。整条路退场后，这类"面板显示 A、提交按 B"的错位不再有落脚点。 */


  /* ============================================================
   * ⛔ v89.138（老板 2）：**「英雄派遣」独立面板整条退役** ——
   * 老板：「调兵·运输，英雄派遣合并成"派遣"和"运输"，均进入出征界面设定英雄和兵种
   *   以及携带的资源」。
   * 本面板（openDispatch）与其助手 setDpGen / setDpTo / doDispatch 一并删除；
   * 「派遣」= 出征界面（本境调运 · 允许 0 兵只派将）——主将下拉即"派谁"、
   * 兵种表即"带多少"，抵达入城（`gen.cityId = 目标城`，见 expedition 的 owncity 分支）。
   * 域侧 `GAME.dispatchableGensOf` / `GAME.doDispatch` 随之退役（见 domain.js 同款墓碑）。
   * 如需恢复：本段代码见 `backup/v89138/ui.js`（判据：`ui.openDispatch = function`）。
   * ============================================================ */

  /* ---------- 军队派驻（v89.59 · 老板需求 3）----------
     第三条城市间操作：转移**军队**（资源走运输、英雄走派遣）。即时到达、兵士不损耗。 */
  ui._tmTo = ui._tmTo || {};
  ui.openTroopMove = function (fromId) {
    var s = GAME.state;
    var from = GAME.cityById(fromId) || GAME.currentCity();
    if (!s || !from) { ui.toast('城市不存在'); return; }
    var others = (s.cities || []).filter(function (c) { return c.id !== from.id; });
    ui._tmFrom = from.id;
    if (!others.length) {
      ui.openShell({
        title: '⚔ 军队派驻', sub: '自' + from.name + '调出', size: 'sm',
        body: '<div class="q-empty">你只有这一座城 —— 无处可派。</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var to = null;
    others.forEach(function (c) { if (c.id === ui._tmTo[from.id]) to = c; });
    if (!to) to = others[0];
    var ids = Object.keys(from.army || {}).filter(function (k) { return (from.army[k] || 0) > 0; });
    var rows = ids.map(function (id) {
      var tr = DATA.TROOPS[id], own = from.army[id];
      return '<div class="res-line" style="align-items:center;"><span class="lbl">' + (tr ? tr.icon + ' ' + tr.name : id) + '</span>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">拥有 ' + U.fmt(own) + '</span>' +
        '<input type="number" id="tm-' + id + '" min="0" max="' + own + '" value="0" style="width:80px;padding:4px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
        '<button class="btn sm" data-action="tm-max" data-troop="' + id + '">全</button></div>';
    }).join('') || '<div class="q-empty">本城无驻军。</div>';
    /* v89.87（需求 2）：调兵改走**行军通道** —— 须选带队英雄 */
    var _gens = (s.generals || []).filter(function (g) {
      var gc = GAME.genCityOf ? GAME.genCityOf(g) : null;   /* 返回城对象 */
      return gc && gc.id === from.id && (!g.status || g.status === 'idle') &&
        !(GAME.gatherByGen && GAME.gatherByGen(g.id));
    });
    var genSel = '<select id="tm-gen" style="width:100%;padding:5px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
      _gens.map(function (g) {
        return '<option value="' + g.id + '">' + U.escape(g.name) + '（Lv' + (g.level || 1) + '）</option>';
      }).join('') + '</select>';
    ui.openShell({
      title: '⚔ 军队派驻',
      sub: '自' + U.escape(from.name) + '调出',
      /* v89.141（复核修复）：`sm`(433×414) 在"5 兵种"真实载荷下纵向溢出 82px
         （modals 审计在第二城可见后当场抓到）→ 升 `md`(660×620)：
         兵力行更舒展、多兵种不再滚动（"弹窗内不许滚动条"）。 */
      size: 'md',
      body:
        '<div class="ui-sub">调往</div>' +
        '<div class="gd-chips">' + others.map(function (c) {
          return '<span class="chip' + (c.id === to.id ? ' on' : '') + '" data-action="tm-to" data-i="' + from.id +
            '" data-v="' + c.id + '">' + U.escape(c.name) + ' <i class="gd-sub">' + GAME.cityDist(from, c) + ' 格</i></span>';
        }).join('') + '</div>' +
        '<div class="ui-sub" style="margin-top:8px;">带队英雄</div>' +
        (_gens.length ? genSel : '<div class="q-empty">本城无空闲英雄 —— 派兵须有英雄带队（出征/城主/守将/采集中的不能派）。</div>') +
        '<div class="ui-sub" style="margin-top:8px;">兵力</div>' + rows +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-hint">兵力按<b>行军通道</b>开拨：有行军时间（军务总览可查看/召回），抵达后入编目标城（不受目标城练兵场容量限制）。</div></div>',
      foot: '<div class="m-foot"><button class="btn gold" data-action="tm-do">派兵</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };
  ui.setTmTo = function (i, v) { ui._tmTo = ui._tmTo || {}; ui._tmTo[i] = v; ui.openTroopMove(i); };
  ui.doTroopMove = function () {
    var from = GAME.cityById(ui._tmFrom) || GAME.currentCity();
    if (!from) return;
    var tid = ui._tmTo[from.id], army = {};
    Object.keys(from.army || {}).forEach(function (id) {
      var inp = document.getElementById('tm-' + id);
      var v = inp ? Number(inp.value) : 0;
      if (v > 0) army[id] = Math.floor(v);
    });
    /* v89.87（需求 2）：调兵走行军通道，须带带队英雄（老板拍板"一律要选将"） */
    var genEl = document.getElementById('tm-gen');
    var genId = genEl ? genEl.value : null;
    var r = GAME.doTransferTroops(from.id, tid, army, genId);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openTroopMove(from.id); }
  };

  /* ⛔ v89.103 退役：**「城市间操作」小面板**（ui.openInterCity + ic-troop / ic-gen / ic-res）——
     它的三件事现在各有更正的入口，留着只会多一条"目标选己方城市 → 跳小面板"的岔路：
       · 派驻军队 / 辎重 / 资源 → **出征界面选己方城市**（本境调运，见 ui._expOwn）
       · 派驻英雄 → 城市面板「英雄派遣」（ui.openDispatch）
       · 跨城调兵 → 新城落成提示里的一键补防（ui.openTroopMove，v89.86 起）
     老板原话：「任意自身城市向其他城市进行资源运输，应当采用出征界面」。 */


  /* ============================================================
   * v89.86（整改 P-26）：新城落成的守备风险提示 ——
   * 新城初始守备力 0（无驻军、无围墙），实测首波入侵即被攻破
   * （小损 + 声望 −5，城不丢）。此前建成后没有任何提示，玩家第一次
   * 意识到风险往往是在战报里。这里把"当前事实 + 下一步"一次给全，
   * 并**复用跨城调兵出口**（ui._tmTo + openTroopMove）做一键补防。
   * ============================================================ */
  ui.openNewCityNotice = function (city) {
    if (!city) return;
    var from = GAME.mainCityOf() || GAME.currentCity();
    if (from && from.id === city.id) from = null;
    var def = GAME.defensePowerOf ? (GAME.defensePowerOf(city) || 0) : 0;
    ui.openShell({
      title: '🏯 新城落成 · ' + U.escape(city.name),
      sub: GAME.coordText(city) + '　守备力 ' + U.fmt(def),
      size: 'sm',
      body:
        '<div class="note-warn">⚠️ 新城当前守备力 <b>' + U.fmt(def) +
          '</b>（无驻军、无围墙）——若有兵马犯境会被攻破：损失资源与声望，<b>城市不会丢</b>。</div>' +
        '<div class="res-line"><span class="lbl">建议</span><span class="val">尽快派驻军队 / 修建围墙；有条件先建瞭望塔延长预警</span></div>' +
        (from ? '<div class="res-line" style="border-bottom:0;"><span class="lbl">可调兵来源</span><span class="val">' +
          U.escape(from.name) + '　在城兵力 ' + U.numText(GAME.armyTotal(from), 0) + '</span></div>' : ''),
      foot: '<div class="m-foot">' +
        (from ? '<button class="btn gold" data-action="newcity-send-troop" data-from="' + from.id + '" data-to="' + city.id + '">⚔ 从' + U.escape(from.name) + '调兵</button>' : '') +
        '<button class="btn" data-action="close-modal">稍后再说</button></div>'
    });
  };

  /* ============================================================
   * v89.187（老板 3）：**据点情报**（前哨覆盖内的地块 · 免侦查明细）
   * ------------------------------------------------------------
   * 老板原话：「在据点周边的地块……涉及到地块的界面上，侦查按钮旁边增加一个
   *   '据点情报'，点击时实时生成？或直接呈现该野地的详细兵力，提供一个弹窗清单」。
   * 口径（"实时生成 vs 直接呈现"在本项目等价）：守军/守将走**确定性出口**
   *   `GAME.wildDefenseAt`（v89.27 铁律：同一天同坐标，侦查看到的与打起来遇到的必同队）——
   *   点击即取**实时**数据、弹窗呈现明细（逐兵种 + 守将），不预存、不占存储。
   * 显示条件：地块在**我方前哨**覆盖内（`GAME.fortAuraAt`）——与情报站同一把尺；
   *   入口在野地面板「🔭 侦查」旁边（老板指定位置）。
   * ============================================================ */
  ui.fortIntelHTML = function (ci) {
    var aura = GAME.fortAuraAt ? GAME.fortAuraAt(ci) : null;
    if (!aura) return '<div class="q-empty">此地块不在任何我方前哨的情报范围内（占据据点后周边 '
      + ' 格（随前哨等级 6~14）自动纳入）。</div>';
    var tile = (GAME.sphere && GAME.sphere.cells) ? GAME.sphere.cells[ci] : null;
    if (!tile) return '<div class="q-empty">目标格越界。</div>';
    var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(ci) : GAME.map.wildLevel(ci);
    var _w = GAME.map.wildAt(ci);
    var terKey = (_w && _w.type) ? _w.type : tile.type;
    var ter = DATA.TERRAIN[terKey] || { name: terKey };
    /* v89.190（上轮遗留）：**已占野地** —— 情报切「我方视角」（老板「已占领野地/
       据点格」也要覆盖）：打下来的地块没有「敌方守军」概念（v89.139 已从地块面板撤
       守军数），这里给的是**我方驻军明细 + 衰减提示**；覆盖来源与未占态同源。 */
    if (_w) {
      var gar190 = GAME.wildGarrisonAt(ci);
      var gN190 = GAME.wildGarrisonTotal(gar190);
      return '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">🏕 由前哨「' + U.escape(aura.name || '?') +
        '」提供（Lv' + (aura.lv || 1) + '）· 情报实时</div>' +
        '<div class="op-zone"><div class="op-zone-t">地形</div>' +
          '<div class="attr"><span class="k">' + U.escape(ter.name || terKey) + '</span><span class="v">Lv' + lv +
            '（已归我方）</span></div></div>' +
        '<div class="op-zone"><div class="op-zone-t">我方驻军（共 ' + U.numText(gN190, 0) + ' 名）</div>' +
          (gN190 ? ui.armyBreakdownRows(gar190.troops, '（空）')
            : '<div class="q-empty">暂无驻军 —— 驻军守地减半衰减（无驻军每日 -2 级）</div>') +
        '</div>';
    }
    /* 实时取守军与守将（与侦查/战斗同一份 —— 确定性出口） */
    var wd = GAME.wildDefenseAt(ci, lv);
    var gen = wd.gen || null;
    var genBlock = '';
    if (gen) {
      var ga = GAME.genAttrs(gen);
      genBlock = '<div class="op-zone"><div class="op-zone-t">守将</div>' +
        /* v89.188（老板 4）：资质徽章走唯一出口 ui.rankBadge（星号 5 星位补位随之生效） */
        '<div class="attr"><span class="k">' + U.escape(gen.name) + '</span><span class="v">Lv' + gen.level +
          '　' + ui.rankBadge(gen) + '</span></div>' +
        '<div class="attr"><span class="k">四维</span><span class="v">指挥 ' + ga.tong + '　武力 ' + ga.yw +
          '　谋略 ' + ga.zm + '　治理 ' + ga.nz + '</span></div>' +
        '<div class="attr"><span class="k">体力</span><span class="v">' + Math.round(GAME.staNow(gen)) +
          ' / ' + Math.round(GAME.staMax(gen)) + '</span></div></div>';
    } else {
      genBlock = '<div class="op-zone"><div class="op-zone-t">守将</div>' +
        '<div class="res-line"><span class="lbl">—</span><span class="val" style="color:var(--text-dim);">此地无守将（守军无英雄加成）</span></div></div>';
    }
    return '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">🏕 由前哨「' + U.escape(aura.name || '?') +
      '」提供（Lv' + (aura.lv || 1) + '）· 情报实时（与侦查/战斗同一份）</div>' +
      '<div class="op-zone"><div class="op-zone-t">地形</div>' +
        '<div class="attr"><span class="k">' + U.escape(ter.name || terKey) + '</span><span class="v">Lv' + lv +
          '（野地等级每日变化）</span></div></div>' +
      '<div class="op-zone"><div class="op-zone-t">守军明细（共 ' + U.numText(wd.total, 0) + ' 人）</div>' +
        ui.armyBreakdownRows(wd.army, '（无守军）') + '</div>' +
      genBlock;
  };
  ui.openFortIntel = function (ci) {
    var tile = (GAME.sphere && GAME.sphere.cells) ? GAME.sphere.cells[ci] : null;
    if (!tile) { ui.toast('目标格越界'); return; }
    var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(ci) : GAME.map.wildLevel(ci);
    var _w = GAME.map.wildAt(ci);
    var terKey = (_w && _w.type) ? _w.type : tile.type;
    var ter = DATA.TERRAIN[terKey] || { name: terKey };
    ui.openModal(
      '<div class="gold-heading">🏯 据点情报 · ' + U.escape(ter.name || terKey) + ' Lv' + lv + '</div>' +
      ui.fortIntelHTML(ci) +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
  };

  /* ⛔ v157.85：`ui.openPrologueLand`（前传点脚下格 = ⚔打/⛏采/🗿试炼/🏡拜访 的行动列表）
     整函数删除 —— 这就是老板说的「前传的任务机制」那排按钮。
     现在 `openLandModalCi` 只有一套面板（正式阶段：守军/侦察/掠夺/占领）。 */

  ui.openLandModalCi = function (ci) {
    var RES_NAME = ui.RES_NAME;
    var tile = (GAME.sphere && GAME.sphere.cells) ? GAME.sphere.cells[ci] : null;
    if (!tile) return;
    /* ⛔ v157.85：前传的「点脚下格 → 行动列表」分派已删（前传整段退役）。 */
    /* ============================================================
     * v89.193（老板 2）：**我方前哨格专属面板** ——
     * 前哨格（占据后 terrain='city'、map.pick 落 kind='land'）此前掉进下方
     * "未占领野地"分支：显示"🏕️ 城市 LvN" + 守军约 N 名 + 侦查/掠夺/占领按钮 ——
     * 全是错误操作（这一格已属于我，"占领"自己的前哨没有意义）。
     * 现在：占据登记直接命中（GAME.fortOwnAt，不走覆盖半径）→ 走前哨面板。
     * ============================================================ */
    var _ownF193 = GAME.fortOwnAt ? GAME.fortOwnAt(ci) : null;
    if (_ownF193) { ui.openOutpostPanel(_ownF193); return; }
    /* ⛔ v90.80：就近探察（奇遇点位现形）随奇遇系统退役。 */
    var lv = (GAME.map._wildLvOverride != null) ? GAME.map._wildLvOverride
      : (GAME.map.wildLevelNow ? GAME.map.wildLevelNow(ci) : GAME.map.wildLevel(ci));
    GAME.map._wildLvOverride = null;
    /* v89.139 加固（唯一出口）：**已占野地的地形以野地记录为准** ——
       采集记录（startGather 的 `type: w.type`）、产量加成（wildAddOf 传 w.type）、
       珠宝表都读野地记录；面板若读 tile.terrain，一旦两者不一致
       （老档 / 外部写入 / 造局），面板会显示"平原"而没有采集区 —— 实测踩到过。
       未占野地（无记录）仍读地图格地形（它才是"这里是什么地形"的权威）。 */
    var _wRec139 = GAME.map.wildAt(ci);
    /* v90.62：3D 星球点击会带**球面地块地形**（_terrOverride）—— 球面原生地形与旧 500×500 不符，
       以点击地块的地形为准（按地形最大近似分配）。无 override 时照旧（野地记录 > 地图格）。 */
    /* v90.69（老板「平原不能建城」）：地形**唯一出口** = 球面（所见即所得）——
       球面地块地形与平面 s.map.grid 无关（3D 星球地形是球面原生生成）。
       改为：override（点选带入）> 野地记录 > **球面地块地形** > 平面格兜底。 */
    var _sph139 = tile ? { type: tile.type } : null;
    var _terKey139 = GAME.map._terrOverride || ((_wRec139 && _wRec139.type) ? _wRec139.type
      : ((_sph139 && _sph139.type) || tile.type));
    GAME.map._terrOverride = null;
    var ter = DATA.TERRAIN[_terKey139];
    /* v90.65（老板）：地块**行政区归属**（3D 星球点击带入）—— 显示省/市/区 */
    var _reg = GAME.map._regionOverride; GAME.map._regionOverride = null;
    GAME.map._coordOverride = null;   /* 坐标改由 coordText(x,y) 现算（全局单一出口） */
    var coordLine = '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:4px;">' +
      '🧭 球系坐标 ' + GAME.map.coordTextCi(ci) + '</div>';
    var admLine = coordLine + ((_reg && _reg.prov) ? ('<div class="adm-line" style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:6px;">' +
      '🏛 ' + U.escape(_reg.prov) + ' · ' + U.escape(_reg.market) + ' · ' + U.escape(_reg.district) + '</div>') : '');
    /* v15：加成按「每级 × 等级」线性计算 */
    /* v89.152：加成数据源统一为 _terKey139（野地记录优先）—— 与结算侧（state.js 读 w.type）同源 */
    var add = GAME.wildAddOf(_terKey139, lv) || {};
    var addStr = '';
    /* v89.152：产出行拆行后不再需要括号包裹，多资源用全角空格分隔 */
    for (var r in add) addStr += (addStr ? '　' : '') + (RES_NAME[r] || r) + ' +' + Math.round(add[r] * 100) + '%';
    /* v55：守军总数**必须与出征时遇到的同一个来源**。
       改前这里读 `GAME.battle.wildGarrison(lv)` —— 那是另一个公式，
       10 级算出来 6.9 万，而 `wildDefenseAt` 的真实守军只有 4560，**差 15 倍**：
       面板一直在骗人，而且"两个出口"正是本项目最经典的失效模式（已删掉那个公式）。
       现在直接读该地块**当天**的守军，与战斗完全一致。 */
    var base = GAME.wildDefenseAt(ci, lv).total;
    var owned = !!GAME.map.wildAt(ci);
    var gatherRes = GAME.gatherResOf(_terKey139);
    var at = GAME.gatherAt(ci);
    var tbl = DATA.WILD_MATERIAL[_terKey139] || {};
    var matNames = Object.keys(tbl).map(function (mid) {
      return DATA.MATERIAL_BY_ID[mid] ? DATA.MATERIAL_BY_ID[mid].name : mid;
    }).join('、');
    ui._buildCityCi = ci;   // v90.100：平原筑城用（球系 ci）
    /* v90.69：把**该格地形**（与面板同源 _terKey139）随出征目标带上 —— 占领时按它记野地类型
       （所见即所得），不再靠平面格或坐标反查。3D 点选/2D 点选一致。 */
    ui._expTarget = { kind: 'wild', ci: ci, terrain: _terKey139, pid: GAME.curPid() };
    ui._expMode = 'occupy';

    /* v89.135（老板「为啥没有珠宝（比如湖泊里有珍珠等等）」）：可采清单里的**珠宝行** */
    var jewelNames135 = ((DATA.GATHER.jewelTable || {})[_terKey139] || []).map(function (jid) {
      var n2 = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) n2 = x.name; });
      return n2;
    });
    /* ⛔ v89.152（老板 1）：`addLine139`（产量加成并入 note 行）退役 ——
       产出行拆为独立 4 行（资源/产量加成/材料/珠宝），产量加成有自己的行。 */
    /* v89.139（老板 4）：高档珠宝有野地等级门槛（见 DATA.GATHER.jewelMinLv）——界面写明。
       门槛 = 本地形所有珠宝里**最高**的那道（"要 LvN+ 才可能出全"）。 */
    var jewelLvHint139 = '';
    if (jewelNames135.length) {
      var _minLv139 = 1;
      ((DATA.GATHER.jewelTable || {})[_terKey139] || []).forEach(function (jid) {
        var mv = ((DATA.GATHER.jewelMinLv || {})[jid]) || 1;
        if (mv > _minLv139) _minLv139 = mv;
      });
      jewelLvHint139 = _minLv139 > 1 ? ('（Lv' + _minLv139 + '+ 野地收获偶得）') : '（收获偶得）';
    }
    /* ⛔ v89.152（老板 1）：`note` 单行块退役 —— 未占面板的产出改在下方 prodBox 里**分行呈现**
       （资源 / 产量加成 / 材料 / 珠宝 四行）；已占面板不再显示产出行（老板 5）。 */

    /* ---------- 未占领：产出行（4 行）+ 出兵入口（v89.152 老板 1/3/4） ----------
       老板：「1.产出分行呈现资源，产量加成，材料，珠宝；
       3.不要显示这行备注：🚩 占领：Lv0 无驻军位（军队打完回城；升到 Lv1+ 才有驻军位）　·　🔥 掠夺：打完直接撤军；
       4.侦察，掠夺，占领（不用占领并驻守）固定放菜单底部」——
       原「此地可采…」单行 note 与"占领/掠夺"备注行整条退役；三键固定弹窗底部。 */
    if (!owned) {
      var prodBox =
        '<div class="op-zone op-zone-eq"><div class="op-zone-t">产出</div>' +
        '<div class="attr"><span class="k">资源</span><span class="v">' +
          (gatherRes
            ? '<b style="color:var(--gold-light)">' + (RES_NAME[gatherRes] || gatherRes) + '</b>（占领后可派军采集）'
            : '<span class="ui-sub">无可采之物（平原不可采集）</span>') +
        '</span></div>' +
        '<div class="attr"><span class="k">产量加成</span><span class="v">' +
          (addStr || '<span class="ui-sub">—</span>') + '</span></div>' +
        '<div class="attr"><span class="k">材料</span><span class="v">' +
          (matNames || '<span class="ui-sub">—</span>') + '</span></div>' +
        '<div class="attr"><span class="k">珠宝</span><span class="v">' +
          (jewelNames135.length
            ? '<b style="color:var(--gold-light)">' + jewelNames135.join(' · ') + '</b>' + jewelLvHint139
            : '<span class="ui-sub">—</span>') +
        '</span></div>' +
        (_terKey139 === 'plain' ? '<div class="q-empty">💡 平原：占领后可在其上建新城</div>' : '') +
        '</div>';
      ui.openModal(
        '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '</div>' + admLine +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
          base.toLocaleString() + ' 名</div>' +
        prodBox +
        (GAME.jianghuWildMounted ? ui.jianghuHTML(ci) : '') +
        /* v89.152（老板 4）：三键固定放菜单底部；文案「占领」（不带"并驻守"） */
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="scout">🔭 侦查</button>' +
          /* v89.187（老板 3）：前哨覆盖内的地块 —— 侦查旁多一个「据点情报」（免侦查明细） */
          (GAME.fortAuraAt && GAME.fortAuraAt(ci)
            ? '<button class="btn gold" data-action="wild-fortintel" data-ci="' + ci +
              '" title="我方前哨覆盖：直接查看该野地守军/守将明细（免侦查）">🏯 据点情报</button>'
            : '') +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="raid">🔥 掠夺</button>' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="occupy">🚩 占领</button>' +
          '<button class="btn" data-action="close-modal">关闭</button></div>'
      );
      return;
    }

    /* ---------- 已占领：管理面板（v23 · 需求 1） ----------
       驻军 / 撤回 / 采集 / 出兵 / 筑城 / 放弃，全部集中在一处；
       并明确指出「驻军守地减半衰减」（v89.185：无驻军 -2/日 → 有驻军 -1/日）——否则玩家不知道驻军有什么用。 */
    var gar = GAME.wildGarrisonAt(ci);
    var garN = GAME.wildGarrisonTotal(gar);

    /* v89.135（老板 3）：「在己方野地界面显示**驻军英雄，兵种种类及数量**，
       这个板块与"地块操作：危险操作"并列」—— 驻军从一行摘要升格为独立板块。
       ⛔ v89.139（老板 3）：「兵力显示**总数量**即可」—— 兵种明细行整条退役，
       故 v89.135 的 `garRows135`（逐兵种 icon+名+数）一并删除（不留死变量）。 */
    var garGen135 = null;
    if (gar && gar.genId) {
      (GAME.state.generals || []).forEach(function (g) { if (g.id === gar.genId) garGen135 = g; });
    }
    /* v89.139（老板 3）：「驻军菜单下的开采行，等级衰减行，和备注行都不要；
       兵力显示总数量即可」—— 驻军板块收敛成两行：英雄 + 兵力（总数）。
       （开采进度移步「采集」区显示；等级衰减与驻守规则从面板撤除，
         相应语义仍在玩法里生效，见 DATA.WILD_GARRISON / wildDecayTick。） */
    var stat = '<div class="op-zone"><div class="op-zone-t">驻军</div>' +
      (garN
        ? '<div class="attr"><span class="k">英雄</span><span class="v">' +
            (garGen135
              ? (U.escape(garGen135.name) + ' Lv' + garGen135.level +
                 '　<span class="ui-sub">驻守野地</span>')
              : '<span style="color:var(--warn);">无英雄 —— 只可驻留、不可开采（派驻时带将补驻）</span>') +
          '</span></div>' +
          '<div class="attr"><span class="k">兵力</span><span class="v"><b>' + U.numText(garN, 0) + '</b> 名' +
            (gar ? '　<span class="ui-sub">来自 ' + U.escape((GAME.cityById(gar.cityId) || {}).name || '本城') + '</span>' : '') +
          '</span></div>'
        : '<div class="q-empty">暂无驻军 —— 点下方「派驻」派兵并选英雄入驻（守地减半衰减）</div>') +
      /* v151（老板「采集要选将选兵、等现实时间，地图上没法直接开工」）：
         **就地开工** —— 有将驻军：一键开始采集（兵留在原地）；
         无将/无驻军：一键派就近空闲英雄 + 城里兵入驻并立刻开工（一次点击，不需要走三层面板）。
         两个入口都走既有出口（startGather / march.dispatch('station')），不另开账。 */
      /* v152（老板：「参考星露谷在地图上种树也行」）：**主按钮跟地形走** ——
         能采的地方一个键开工（有将驻军直接采 / 没驻军就派一队过去）；
         不能采的地方不摆一个永远灰着的键，而是直接说明这里能干什么。 */
      (gatherRes
        ? '<div class="op-row" style="margin-top:6px;">'
          + (garN && gar && gar.genId
            ? '<button class="btn gold" data-action="wild-boom" data-ci="' + ci + '">⚡ 就地开工（采集）</button>'
            : '<button class="btn gold" data-action="wild-boom" data-ci="' + ci + '"'
              + ' title="派本城空闲英雄与驻军去这块地，到了立刻开采">⚡ 派队开工（采集）</button>')
          + '<span class="op-hint">'
          + (garN && gar && gar.genId ? '兵留在原地，收获回驻军' : '自动选一位空闲英雄 + 本城兵力过去')
          + '</span></div>'
        : '<div class="q-empty" style="margin-top:6px;">这块地采不了（'
          + U.escape(ter.name || '此地') + '没有可采之物）—— 往有树/有矿/有水的地块走</div>') +
      '</div>';

    /* v89.83（老板「已占领的野地，其入口操作应只保留派驻」）—— 已占野地是「我的地盘」。
       v89.136（老板「'野地采集（0/3队）'这个弹窗界面不需要」+「地块操作界面加一个采集操作」）：
       采集从"弹窗总入口"**收敛回地块界面**（见上方 gatherBox · 独立「采集」区）——
       开始采集 / 收获 / 召回三件事都在这块地上直接完成；
       本区（地块操作）只留：派驻 / 增派驻军 / 召回驻军 / 筑城。 */
    /* v89.136（老板）：「地块操作界面加一个采集操作（提供采集，收获按钮和采集进度显示），
       与地块操作，危险操作并列」——"野地采集"弹窗退役后，采集的全部操作收敛到这块地上。 */
    /* v89.139（老板 3）：「采集菜单下设置采集和收获两个按钮，**不要召回**」——
       两个按钮**常显**（不可用时置灰 + 悬停写明原因）；
       召回退出本区（撤回驻军仍在地块操作区，语义不变）。 */
    var gatherBox = '';
    if (gatherRes) {
      gatherBox = '<div class="op-zone op-zone-eq"><div class="op-zone-t">采集</div>';
      var gy139 = at ? GAME.gatherYield(at) : null;
      if (at && gy139) {
        var gLeftH139 = Math.max(0, DATA.GATHER.minHours - gy139.hours);
        var gName139 = '（无将）';
        (GAME.state.generals || []).forEach(function (g0) { if (g0.id === at.genId) gName139 = g0.name; });
        gatherBox +=
          '<div class="attr"><span class="k">进度</span><span class="v">' +
            '<span style="display:inline-block;width:132px;height:9px;background:var(--slab-1);border:1px solid var(--gold-dark);border-radius:4px;overflow:hidden;vertical-align:-1px;margin-right:6px;"><i style="display:block;height:100%;width:' + gy139.pct + '%;background:linear-gradient(180deg,var(--gold-light),var(--gold-dark));"></i></span>' +
            '已采 ' + gy139.hours.toFixed(2) + ' / ' + DATA.GATHER.maxHours + ' 游戏时　' +
            (gy139.capReached ? '<span style="color:var(--gold-light);">已封顶</span>'
              : gy139.ready ? '<span style="color:var(--green-ok);">可收获</span>'
              : '<span style="color:var(--text-dim);">还需 ' + U.dur(gLeftH139 * 3600 / GAME.timeScale()) + ' 现实时间满 1 小时</span>') +
          '</span></div>' +
          '<div class="attr"><span class="k">预计收成</span><span class="v">' +
            U.numText(gy139.amount, 0) + ' ' + (RES_NAME[gy139.res] || gy139.res || '') +
            '　<span class="ui-sub">带队 ' + U.escape(gName139) + ' · 负重上限 ' + U.numText(gy139.loadCap || 0, 0) + '</span>' +
          '</span></div>';
      }
      var canSet139 = !at && garN > 0 && gar && gar.genId;
      var canFin139 = !!(at && gy139 && gy139.ready);
      var setTitle139 = at ? '已在采集中'
        : (!garN ? '先派驻军（首次须带将）'
          : (!(gar && gar.genId) ? '驻军须有英雄带队（「增派驻军」时选一位英雄补驻）' : '由驻守英雄带队 · 原地开工'));
      var finTitle139 = !at ? '尚未开始采集'
        : (canFin139 ? '' : '满 1 游戏小时方可收获');
      gatherBox += '<div class="op-row">' +
        '<button class="btn' + (canSet139 ? ' gold' : '') + '" data-action="wild-garrison-gather" data-ci="' + ci +
          '"' + (canSet139 ? '' : ' disabled') +
          (setTitle139 ? ' title="' + setTitle139 + '"' : '') + '>⛏️ 采集</button>' +
        '<button class="btn' + (canFin139 ? ' gold' : '') + '" data-action="gather-finish" data-id="' +
          (at ? at.id : '') + '"' + (canFin139 ? '' : ' disabled') +
          (finTitle139 ? ' title="' + finTitle139 + '"' : '') + '>📦 收获</button>' +
        '</div>';
      if (!at && garN > 0 && gar && !gar.genId) {
        gatherBox += '<div class="q-empty">驻军无英雄 —— 补驻一位英雄后即可开采（「增派驻军」时选将）</div>';
      } else if (!at && !garN) {
        gatherBox += '<div class="q-empty">暂无驻军 —— 先「派驻」（须选带队英雄）</div>';
      }
      gatherBox += '</div>';
    }

    var ops = '<div class="op-zone op-zone-eq"><div class="op-zone-t">地块操作</div><div class="op-row">' +
      /* v151（老板「出征链要 6~7 次点击」）：**一键出征** —— 不在场时最常用的一条路。
         目标就是这一格，编成/主将从「自动出征」配置里取（玩家早就设定过）；没配置就
         按驻军顺位取满，主将取本城空闲英雄。走同一条 march.dispatch，不另开账。 */
      '<button class="btn gold" data-action="onekey-march" data-ci="' + ci + '" data-kind="wild"' +
        ' title="按自动出征的编成与主将，直接对这块地下令（不用再选出征面板）">⚡ 一键出征</button>' +
      (garN
        ? '<button class="btn" data-action="wild-garrison-open" data-ci="' + ci + '">🛡️ 增派驻军</button>' +
          /* v89.155（老板 2）：与附属野地同一条出口（第一次黄 / 第二次执行 / 2 秒回落）；不再有任何说明文字 */
          ui.wildWdBtnHTML(ci, { hasGar: true, lblMode: 'g' })
        : '<button class="btn gold" data-action="wild-garrison-open" data-ci="' + ci + '">🛡️ 派驻</button>') +
      /* v89.190（上轮遗留）：据点情报覆盖「已占领野地」—— 前哨覆盖内的我方地块，
         入口与未占面板同款（🏯 据点情报），内容改我方视角（见 ui.fortIntelHTML）。 */
      (GAME.fortAuraAt && GAME.fortAuraAt(ci)
        ? '<button class="btn" data-action="wild-fortintel" data-ci="' + ci +
          '" title="我方前哨覆盖：查看该地块情报（我方驻军明细 / 衰减提示）">🏯 据点情报</button>'
        : '') +
      (_terKey139 === 'plain'
        ? '<button class="btn gold" data-action="build-city">🏯 建城（净水/生物质/电能/废钢/旧币 各 1 万）</button>' : '') +
      '</div></div>' +
      '<div class="op-zone danger op-zone-eq"><div class="op-zone-t">危险操作</div><div class="op-row">' +
      '<button class="btn red" data-action="wild-abandon-ask" data-ci="' + ci + '">🗑️ 放弃该野地</button>' +
      '<span class="op-hint">失去产量加成' + (gatherRes ? '与采集权' : '') + '，驻军与采集队会先撤回城内</span>' +
      '</div></div>';

    /* v89.139（老板 3）：「湖泊 Lv10（已占），不要（已占）」+「都己方了，怎么还显示守军约多少名」
       —— 已占面板不再自称"已占"（入口本来就是己方野地），也不再显示守军数
       （守军只在**未占领**时的出击面板里有意义）。
       v89.152（老板 5）：**已占野地不显示产出行**（产出是"要不要打"的决策信息，
       已在占领那一刻完成使命）—— 原 note 整行退役。 */
    ui.openModal(
      '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '</div>' + admLine +
      (GAME.jianghuWildMounted ? ui.jianghuHTML(ci) : '') +
      stat + gatherBox + ops +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.135（老板 7）：逐秒刷新 —— 采集时间/驻军/开采状态实时 */
      { live: function () { ui.openLandModalCi(ci); } }
    );
  };

  /* ============================================================
   * ⛔ v89.137（老板 7）：**派驻面板整条退役** ——
   * 老板：「派驻弹出出征界面（即侦察/掠夺/占领界面）…所有军队操作均以出征界面进行，
   *   除非像采集，收获，召回这种默认全军操作」。
   * 本面板（派兵表格 + 选将 + 确定派驻）与其 9 个界面助手（wgOwn / wgRoom / wgSum /
   * wgSet / wgStep / wgMax / wgFill / wgClear / updateWgTotal）一并删除；
   * 「派驻 / 增派驻军」按钮改走 `ui.openExpModal({kind:'wild'})`（方式 = 驻守·增援），
   * 提交链路 = dispatch → prepare（上限预检 + 无将硬闸）→ 抵达 station 分支 → wildGarrisonAdd。
   * 如需恢复：本段代码见 `backup/v89137/ui.js`（判据：`ui.openWildGarrison = function`）。
   * ============================================================ */

  /* 放弃野地二次确认（v23）：不可逆操作必须说清代价 */
  ui.openAbandonWildAsk = function (ci) {
    /* v89.156（老板 1）：上膛式（连点两次）退役。 */
    var w = GAME.map.wildAt(ci);
    if (!w) { ui.toast('该野地尚未占领'); return; }
    var ter = DATA.TERRAIN[w.type];
    var gar = GAME.wildGarrisonAt(ci);
    var garN = GAME.wildGarrisonTotal(gar);
    var at = GAME.gatherAt(ci);
    ui.openModal(
      '<div class="gold-heading">🗑️ 放弃 ' + (ter ? ter.name : w.type) + ' Lv' + w.level + '</div>' +
      '<div class="note">放弃后该地块恢复为无主野地，<b>产量加成与采集权一并失去</b>' +
        (garN || at ? '；驻军与采集队会先撤回城内，不会损失兵力' : '') +
        '。<b>此操作不可撤销</b>。</div>' +
      '<div class="attr"><span class="k">将失去加成</span><span class="v">' + (function () {
        var add = GAME.wildAddOf(w.type, w.level) || {}, out = [];
        for (var r in add) out.push((ui.RES_NAME[r] || r) + ' +' + Math.round(add[r] * 100) + '%');
        return out.join('　') || '—';
      })() + '</span></div>' +
      (garN ? '<div class="attr"><span class="k">撤回驻军</span><span class="v good">' + U.numText(garN, 0) + ' 名</span></div>' : '') +
      (at ? '<div class="attr"><span class="k">撤回采集队</span><span class="v good">' + U.numText(at.troops || 0, 0) + ' 名</span></div>' : '') +
      '<div class="modal-foot">' +
        '<button class="btn red" data-action="wild-abandon-do" data-ci="' + ci + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    );
  };

  /* 放弃城市二次确认（v67 · 老板）——
     不可逆操作必须说清代价：与「放弃野地」同一套写法（note + 逐项 attr + 红按钮）。
     判据与业务共用 GAME.abandonCityCheck（不能放弃时只说明原因，不给确认按钮）。 */
  ui.openAbandonCityAsk = function (cityId) {
    ui._abandonArm138 = null;   /* v89.154：打开即复位 —— 关窗再开必须重新上膛（防误触漏洞一体修） */
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) { ui.toast('城市不存在'); return; }
    var chk = GAME.abandonCityCheck(cityId);
    if (!chk.ok) {
      ui.openShell({
        title: '🗑️ 放弃城市 · ' + U.escape(city.name),
        size: 'sm',
        body: '<div class="q-empty">' + U.escape(chk.msg) + '</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var R = GAME.res(city), recv = chk.receiver;
    var resTxt = GAME.TRANSPORT_KEYS.map(function (k) {
      return GAME.resName(k) + ' ' + U.amtText(R[k] || 0);
    }).join('　');
    var gens = (s.generals || []).filter(function (g) { return g.cityId === city.id; }).length;
    var nb = (s.queues.build || []).filter(function (q) { return q.cityId === city.id; }).length;
    var nt = (s.queues.train || []).filter(function (q) { return q.cityId === city.id; }).length;
    var garN = 0;
    (s.wilds || []).forEach(function (w) {
      if (w.garrison && w.garrison.cityId === city.id) garN += GAME.wildGarrisonTotal(w.garrison);
    });
    ui.openShell({
      title: '🗑️ 放弃 ' + U.escape(city.name),
      sub: ui.cityTierName(city.type) + '　政务厅 Lv' + (GAME.buildingLevel(city, 'guanfu') || 1) +
        '　' + GAME.map.coordText(city.x, city.y),
      size: 'sm',
      body:
        '<div class="note">放弃后这座城与它之上的一切<b>永久失去</b>：建筑、围墙、外城地块、' +
          '库存与驻军。原地块恢复为无主之地；攻占来的城市会重新变成可被攻打的系统城。</div>' +
        '<div class="attr"><span class="k">失去库存</span><span class="v">' + resTxt + '</span></div>' +
        '<div class="attr"><span class="k">失去驻军</span><span class="v">' +
          U.numText(GAME.armyTotal(city), 0) + ' 名</span></div>' +
        '<div class="attr"><span class="k">英雄随迁</span><span class="v good">' +
          gens + ' 名 → ' + U.escape(recv.name) + '</span></div>' +
        (garN ? '<div class="attr"><span class="k">野地驻军归城</span><span class="v good">' +
          U.numText(garN, 0) + ' 名 → ' + U.escape(recv.name) + '</span></div>' : '') +
        ((nb || nt) ? '<div class="attr"><span class="k">在建 / 在募</span><span class="v">' +
          (nb ? nb + ' 项建造' : '') + (nb && nt ? '、' : '') + (nt ? nt + ' 项募兵' : '') +
          '　一并取消（材料不退）</span></div>' : ''),
      /* v89.138（老板 2）：「放弃城市菜单**增加二次确认**」——
         按钮改上膛式：点第一次只"上膛"（变文案、变红、toast 警告），**再点一次**才执行；
         执行仍走原出口 `GAME.abandonCity`（业务侧照 CITY_SCOPED 表批量清理）。 */
      foot: '<div class="m-foot">' +
        '<button class="btn red" data-action="city-abandon-arm" data-city="' + city.id + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  /* ⛔ v89.136 移除：`ui.openGatherModal`（派军采集）与 `ui.openGathers`（"野地采集（N/3队）"弹窗）。
     老板令：「'野地采集（0/3队）'这个弹窗界面不需要」「地块操作界面加一个采集操作
     （提供采集，收获按钮和采集进度显示），与地块操作，危险操作并列」——
     · 采集的**全部操作**收敛到地块界面（openLandModal 的「采集」区：开始采集 / 收获 / 召回 / 进度）；
     · 采集队上限的可见性：军务总览 ③ 采集队表头（N / maxActive 队）；
     · 派军采集（英雄带队）并入「带将驻军原地开工」（GAME.startGather 唯一形态）；
     · 采集队总览的"定位"能力：地块界面即野地本体（无需定位跳转）。 */
  /* 野外城市弹窗 */

  /* ⛔ v157.72（老板 2026-11-16「地块统一一层菜单，不要加地块操作这一层」）：
     `ui.openCellMenu`（「🗺 地块操作」功能主菜单）整条退役。
     ------------------------------------------------------------
     来历：v156.15 曾在「点地块」和「原本的面板」之间插过一层短条，v156.15b 老板以
     「这不是套娃吗」撤掉（点地块直开面板）；v157.57 又按决策把它加了回来。
     本轮的判定：**详情面板里本来就有**「🔭 侦查 / 🔥 掠夺 / 🚩 占领」（`exp-open`）、
     「🏯 经营 / 🛡 派遣」（己方城）、「⚡ 一键出征」，多这一层只是多一次点击，
     不增加任何玩家能按的新东西 —— 按 `AGENTS.md:313` 该退役。
     去向：`map3d.pickAt` 现在直达 `openCellPanel`（按 kind 分发到原面板）；
     四个 `cell-menu-detail/exp/dispatch/scout` 动作在 `main.js` 同步删除。
     `smoke §580②` 已翻转为反向守卫：点击不许再经任何中间菜单。 */
})();
