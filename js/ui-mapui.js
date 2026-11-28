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
    /* ============================================================
     * v158.41（老板「总是分层，不要立即出征」）：**敌方城（名城/行政城）也走本面板**。
     * ------------------------------------------------------------
     * 点一座敌方城，第一层必须是「🏙 看这座城」的观察视角（守军/库藏/守将/建筑），
     * 出征（侦查/掠夺/占领）只是面板底部的一组按钮 —— 与野地、己方城统一分层，
     * 从源头消灭「点城直接弹出 ⚔️出征界面」。
     * 这里算好敌方城详情所需的数据（openAttackModal 退役后由本面板承接），
     * body / foot 两个分支共用；同时落 `ui._attackNpc` 保住「派将挑衅」等后续链路
     * （provoke-city 读 `ui._attackNpc`，openAttackModal 原来就设这个）。 */
    var _enemy = null;
    if (!isOwn) {
      ui._attackNpc = city;                       /* 挑衅 / 侦查等动作的城快照（与 openAttackModal 同源） */
      ui._expMode = 'occupy';
      ui._expTarget = { kind: 'city', id: city.id, npc: city };
      var _nci = GAME.npcCityInfo(city);
      var _tier = GAME.cityTierName(city) || '聚落';
      var _g = city.garrison || {}, _gNum = 0;
      for (var _gk in _g) _gNum += _g[_gk];
      var _ng = _nci.guard;
      var _myc = GAME.currentCity();
      var _dist = _myc ? GAME.cityDist(_myc, city) : null;
      var _blv = GAME.npcBuildLvOf(city);
      var _bcap = DATA.MAX_BLEVEL + GAME.cityBuildBonus(city);
      _enemy = { nci: _nci, tier: _tier, gNum: _gNum, ng: _ng, dist: _dist, blv: _blv, bcap: _bcap };
    }
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
      sub: ui.cityTierName(city.type) +
        (isOwn ? '　政务厅 Lv' + lv : '　城等级 Lv' + GAME.cityLvOf(city)) +
        '　' + GAME.map.coordText(city.x, city.y) +
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
          : (function () {
              /* v158.41：敌方城详情 —— 承接 openAttackModal 的观察信息，但标题是「看城」不是「⚔️出征」。
                 守军/城防/守将/库藏/建筑等级都在这一层；出征按钮下沉到 foot。 */
              if (!_enemy) return '<div class="q-empty">尚未据有此地。</div>';
              var nci = _enemy.nci, ng = _enemy.ng;
              var h = '<div class="attr"><span class="k">⚔ 守军</span><span class="v">约 ' +
                _enemy.gNum.toLocaleString() + ' 名　城防 <b style="color:var(--gold-light)">' +
                (city.def || 0) + '</b></span></div>';
              if (ng) {
                var _fv = GAME.battle.fearOf({ npc: city });
                h += '<div class="attr"><span class="k">🎖 守将</span><span class="v">' +
                  U.escape(ng.name) + '（' + U.escape(ng.title || '守将') + ' Lv' + ng.level + '）</span></div>' +
                  '<div style="text-align:center;margin:4px 0 8px;">' +
                  '<button class="btn" data-action="provoke-city">⚔ 派将挑衅</button>' +
                  (_fv > 0
                    ? ('<span style="color:var(--gold-light);font-size:var(--fs-cap);margin-left:8px;">守军胆寒中（−' +
                      Math.round(_fv * 100) + '%）</span>')
                    : '<span style="color:var(--text-dim);font-size:var(--fs-cap);margin-left:8px;">赢了：该城守军胆寒 24 小时</span>') +
                  '</div>';
              }
              h += '<div class="attr"><span class="k">🏛 建筑</span><span class="v">Lv' + _enemy.blv + '（' +
                (_enemy.blv >= _enemy.bcap ? '该档上限 · 满配' : ('按城等级 · 该档上限 Lv' + _enemy.bcap)) + '）</span></div>' +
                '<div class="attr"><span class="k">📦 库藏</span><span class="v">净水 <b>' + U.fmt(nci.res.grain) + '</b>' +
                '　生物质 ' + U.fmt(nci.res.wood) + '　电能 ' + U.fmt(nci.res.stone) +
                '　废钢 ' + U.fmt(nci.res.iron) + '　旧币 <b>' + U.fmt(nci.res.gold) + '</b>' +
                '　幸存者 ' + U.fmt(nci.res.pop) + '</span></div>' +
                '<div class="attr"><span class="k">🏆 攻占收益</span><span class="v">攻占后库藏尽归我有</span></div>';
              return h;
            })()) +
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
            /* v158.2（P2 大世界）：同一坐标系的街区入口 —— 不切场景、不读盘。
               与上面的 city-enter-3d（旧 scene3d 独立 renderer）并存，互不改写。 */
            '<button class="btn" data-action="district-enter" data-city="' + city.id + '"' +
              ' title="' + U.escape('走进这座城的街道（无读盘；按 Q 或右下角按钮回星球）')
              + '">🚶 走进街区</button>' +
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
        /* v158.41：敌方城的出征按钮 —— 下沉到 foot，与野地/己方城统一「先看详情再点按钮出征」。
           侦查/掠夺/占领三键（含领地到顶时占领置灰），复用 exp-open → doOpenExp → openExpModal 唯一出口。 */
        (!isOwn && _enemy ? (function () {
          var _ccAtk = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
          return '<button class="btn gold" data-action="exp-open" data-kind="city" data-mode="scout">🔭 侦查</button>' +
            '<button class="btn gold" data-action="exp-open" data-kind="city" data-mode="raid">🔥 掠夺</button>' +
            '<button class="btn gold" data-action="exp-open" data-kind="city" data-mode="occupy"' +
            (_ccAtk.ok ? '' : ' disabled title="' + U.escape(_ccAtk.msg) + '"') + '>🚩 占领</button>';
        })() : '') +
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

  /* ⛔ v158.43（老板「不要再弹出这个了『未探明地块』」）：
     `ui.openFogModalCi`（v158.38 未探明一级详情面板）整条退役 ——
     按诉求 2 拍板口径「常规情况下左键点击地面无需响应」，雾格点击静默
     （map3d pickAt 雾分支 + _openCellPanel 雾守卫都不再弹窗）。
     原面板唯一行动「🚶 派队探索」入口随之退役；未探明格勘探走建造模式
     （点左键自动勘探，v158.43 诉求 3 已打通）。 */

  ui.openLandModalCi = function (ci) {
    var RES_NAME = ui.RES_NAME;
    /* v158.17（老板「参考现有成熟设计完善」⑤）：「生」这种单字在面板里是黑话。
       地块面板一律用 DATA.RESOURCES 的**全名**（净水/生物质/电能/废钢）；
       `ui.RES_NAME` 的短名留给密集的排行榜/资源条，别在正文里出现。 */
    var RES_FULL = {};
    (DATA.RESOURCES || []).forEach(function (m) { if (m && m.key) RES_FULL[m.key] = m.name; });
    function resFull(k) { return RES_FULL[k] || RES_NAME[k] || k; }
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
    for (var r in add) addStr += (addStr ? '　' : '') + resFull(r) + ' +' + Math.round(add[r] * 100) + '%';
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
    /* ============================================================
     * v158.12（S3 勘探）· 资源地块区块
     * ------------------------------------------------------------
     * 老板「资源地块只有近地面勘探后才能建厂生产」——地块面板就是"近地面"
     * 的定点作业面：走近点这一格，就能看到这块地是什么资源、值不值得开厂。
     *
     * 三个刻意的设计（都是老板的交互原则落地）：
     *   ① **只对有工业价值的地形出这个区块**（森林/山地/荒漠）。平原/草原/湖泊
     *      也映射净水，但那是遍地都是的基础资源 —— 每块地都挂一段"净水地块"
     *      纯属噪音（原则 1：复杂留给系统）。
     *   ② **勘探前不报丰度/储量**。丰度是勘探的回报；提前报出来，勘探这个动作
     *      就没有意义了。
     *   ③ 走 `RS.view()`（纯计算不写档）而不是 `RS.at/ensure` —— 打开面板看一眼
     *      不该在存档里给这一格建档。
     * ============================================================ */
    var resBox = '';
    (function () {
      var RS = GAME.resource;
      if (!RS || !RS.view || !RS.ON_MAP) return;
      var rv = null;
      try { rv = RS.view(ci); } catch (e0) { rv = null; }
      if (!rv) {
        /* ============================================================
         * v158.21（老板连问三次「我的建造呢？」）
         * ------------------------------------------------------------
         * 湖泊 + 沼泽占全图约 37%（实测 12888 + 2454 / 40962）—— 它们只能**派军采集**、
         * 不建采集场（EXT_BUILDINGS 只有农场/林场/采石场/矿场四种）。
         * 原来这里直接 return，什么都不显示 → 玩家点这类格找不到建造，以为功能没了。
         * 现在给一块"说清楚"的说明：这块地为什么不能建、能建的地长什么样。
         * ============================================================ */
        var _tn = (ter && ter.name) || '这块地';
        resBox = '<div class="op-zone op-zone-eq"><div class="op-zone-t">🏭 采集场</div>' +
          '<div class="attr"><span class="k">' + U.escape(_tn) + '</span>' +
          '<span class="v" style="color:var(--text-dim);">只能派军采集，不能建厂' +
          ' —— 建厂要森林 / 山地 / 荒漠 / 平原 / 草原</span></div>' +
          '<div class="op-hint">采集场是资源建筑：建好后按丰度持续产出，不用派兵守着。</div></div>';
        return;
      }
      /* ⛔ v158.21（老板「我的建造呢？」×3）：这行原来是
         `if (!(rv.type === 'forest' || rv.type === 'hill' || rv.type === 'desert')) return;`
         —— 把**平原和草原（都是农场 grain）也挡掉了**，玩家点平原/草原看不到建造入口。
         现在交给 `RS.RES_OF_TYPE` 自己判断（有资源就给区块），不再另写一份白名单。 */
      /* 资源**全名**（净水/生物质/电能/废钢）—— 面板里用 `ui.RES_NAME` 的短名（水/生/电/钢）
         会读成黑话，这里按 DATA.RESOURCES 取正式名（`resFull`，v158.17 提到函数级）。 */
      /* ============================================================
       * v158.24（老板「什么叫做走近勘探后才能建，怎么走近，行为逻辑链真的有吗」）
       * ------------------------------------------------------------
       * 之前是**假承诺**：文案写「走近勘探后才能建厂」，而 RS.scan(ci) 零距离校验
       * —— 实测人站在 4.6 格外点一下就勘探成功、人一步没动。玩家读到"走近"就会去找
       * "怎么走近"，可游戏里根本没有这个动作，链路在玩家心里当场断掉。
       *
       * 现在做成真的：离得远**只给"走过去"**，点一次自动走到地块上，
       * 到达后自动勘探并重开本面板（`M._walkThen`）；近了才给「勘探 / 建厂」。
       * 阈值 2 格（≈11 米）：站在自己脚下能处理相邻格，再远就得挪步。
       * ============================================================ */
      var _nearM = 0, _isNear = true;
      try {
        var _M24 = GAME.map3d;
        var _pci24 = (_M24 && _M24.playerCi) ? _M24.playerCi() : -1;
        var _cells24 = (_M24 && _M24._collider) ? _M24._collider.cells : null;
        if (_pci24 >= 0 && _pci24 !== ci && _cells24 && _cells24[_pci24] && _cells24[ci]) {
          var _a24 = _cells24[_pci24].dir, _b24 = _cells24[ci].dir;
          var _dot24 = Math.max(-1, Math.min(1, _a24[0] * _b24[0] + _a24[1] * _b24[1] + _a24[2] * _b24[2]));
          _nearM = Math.acos(_dot24) * (_M24.R || 300);
          _isNear = _nearM <= 11;
        }
      } catch (eNear24) { }
      var rname = resFull(rv.res || '');
      var toneCol = { legend: 'var(--gold-light)', good: 'var(--green-ok)', normal: 'var(--text)', poor: 'var(--text-dim)' };
      /* v158.21（老板连问三次「我的建造呢？」）：「资源地块」这四个字读不出"这里能建东西"。
         标题改成直白的「🏭 采集场」，未勘探时直接写"勘探后即可建造"。 */
      resBox = '<div class="op-zone op-zone-eq"><div class="op-zone-t">🏭 采集场' +
        (rv.scanned ? '' : ' · 未勘探（勘探后即可建造）') + '</div>';
      if (!rv.scanned) {
        resBox +=
          '<div class="attr"><span class="k">资源</span><span class="v" style="color:var(--text-dim);">未知 —— 地形特征推断可能有 ' +
            U.escape(rname) + '</span></div>' +
          (_isNear
            ? '<div class="op-row"><button class="btn gold" data-action="res-scan" data-ci="' + ci +
              '">🔍 勘探</button><span class="op-hint">勘探不花资源、立刻给出丰度与储量；不勘探不能建采集场</span></div>'
            : '<div class="op-row"><button class="btn gold" data-action="res-go-scan" data-ci="' + ci +
              '">🚶 走过去勘探（约 ' + Math.round(_nearM) + ' 米）</button>' +
              '<span class="op-hint">走到地块上才能勘探、建厂（点一下自动走过去）</span></div>');
      } else {
        var tier = RS.richTier ? RS.richTier(rv.richness) : { name: '普通', tone: 'normal' };
        var pct = rv.reserveMax > 0 ? Math.max(0, Math.min(100, rv.reserve / rv.reserveMax * 100)) : 0;
        var depleted = rv.reserve <= 0;
        /* v158.17（老板 ⑤）：「贫瘠 ×0.63」读不成句 —— 丰度与储量是**两个量**
           （丰度管产量、储量管能采多久），各自带标签，别把档位名和倍率拼成一句黑话。
           储量也不再并排两个大数字（"1,015,432 / 1,600,000"没人知道谁是谁）：
           主看剩余百分比，绝对量退到副文本并标清"上限"。 */
        resBox +=
          '<div class="attr"><span class="k">资源</span><span class="v">' + U.escape(rname) + '</span></div>' +
          '<div class="attr"><span class="k">丰度</span><span class="v">' +
            '<span style="color:' + (toneCol[tier.tone] || 'var(--text)') + ';">' + tier.name +
            '</span>　产量 ×' + rv.richness.toFixed(2) + '</span></div>' +
          '<div class="attr"><span class="k">储量</span><span class="v">' +
            '<span style="display:inline-block;width:132px;height:9px;background:var(--slab-1);border:1px solid var(--gold-dark);border-radius:4px;overflow:hidden;vertical-align:-1px;margin-right:6px;"><i style="display:block;height:100%;width:' + pct.toFixed(1) + '%;background:linear-gradient(180deg,var(--gold-light),var(--gold-dark));"></i></span>' +
            '剩 ' + pct.toFixed(0) + '%　<span class="ui-sub">（' + U.numText(rv.reserve, 0) +
            ' / 上限 ' + U.numText(rv.reserveMax, 0) + '）</span>' +
            (depleted ? '　<span style="color:var(--red-light);">已枯竭（残采 25%）</span>' : '') +
          '</span></div>';
        /* 施工中：队列里有这块地的活就不给"建采集场"按钮 ——
           否则点下去只会被 `buildPlant` 回一句"这块地已经在施工了"，
           面板等于在骗人（视觉走查当场看到按钮还亮着，v158.13 视觉轮补）。 */
        var _qRes = null;
        ((GAME.state.queues && GAME.state.queues.build) || []).forEach(function (x) {
          if (x && x.ci === ci && (x.type === 'plant_build' || x.type === 'plant_upgrade')) _qRes = x;
        });
        if (rv.plant) {
          var eb = (DATA.EXT_BUILDINGS || {})[rv.plant] || {};
          resBox += '<div class="attr"><span class="k">采集场</span><span class="v">' +
            U.escape(eb.name || rv.plant) + ' Lv' + rv.plantLv + '</span></div>';
        } else if (!_qRes) {
          resBox += (_isNear
            ? '<div class="op-row"><button class="btn gold" data-action="res-build-open" data-ci="' + ci +
              '">⚒ 建采集场</button><span class="op-hint">在这块地上开厂，按丰度持续产出</span></div>'
            : '<div class="op-row"><button class="btn gold" data-action="res-go-build" data-ci="' + ci +
              '">🚶 走过去建厂（约 ' + Math.round(_nearM) + ' 米）</button>' +
              '<span class="op-hint">走到地块上才能建采集场（点一下自动走过去）</span></div>');
        }
        if (_qRes) {
          var _qp = _qRes.totalTime > 0 ? Math.min(100, (_qRes.elapsed / _qRes.totalTime) * 100) : 0;
          resBox += '<div class="attr"><span class="k">施工</span><span class="v">' +
            (_qRes.type === 'plant_build' ? '建造中' : '升级中') + '　<b>' + _qp.toFixed(0) + '%</b>' +
            '　<span class="ui-sub">' + U.dur(Math.max(0, (_qRes.totalTime || 0) - (_qRes.elapsed || 0)))
            + ' 后落成</span></span></div>';
        }
      }
      resBox += '</div>';
    })();

    if (!owned) {
      var prodBox =
        '<div class="op-zone op-zone-eq"><div class="op-zone-t">产出</div>' +
        '<div class="attr"><span class="k">资源</span><span class="v">' +
          (gatherRes
            ? '<b style="color:var(--gold-light)">' + U.escape(resFull(gatherRes)) + '</b>（占领后可派军采集）'
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
        /* v158.21（老板「为什么地块一点就进入了占领啊什么的？那我怎么进行资源建筑的建造？我的建造呢？」
           ×3）—— 建造区块原来排在 prodBox（产量/材料/珠宝）**之后**，下面是「侦查/掠夺/占领」
           三个大按钮，玩家一眼只看到"占领"，以为这块地只能打。现在把 resBox 提到最前，
           紧跟标题 —— 点开第一眼就是"这里能建什么"。 */
        resBox + prodBox +
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
          '<button class="btn" data-action="cell-teleport" data-ci="' + ci +
            '" title="把人物传送到这一格（并关闭此面板）">⤓ 传送</button>' +
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
            U.numText(gy139.amount, 0) + ' ' + resFull(gy139.res || '') +
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
      stat + resBox + gatherBox + ops +
      /* v157.96：已占领地块也给「⤓ 传送」（老板要的是"地块"通用，不是只管未占领）*/
      '<div class="modal-foot"><button class="btn" data-action="cell-teleport" data-ci="' + ci +
        '" title="把人物传送到这一格（并关闭此面板）">⤓ 传送</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
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

  /* ============================================================
   * v158.13（S4）· 采集场面板（建 / 升 / 拆）
   * ------------------------------------------------------------
   * 老板：「资源建筑从城外转移到大地图」「要设计一个在城外进行建造的流程」。
   * 这个面板就是那条流程的界面：站在哪块地上，就只能开哪种厂（地形决定资源），
   * 造价/工期/产量/可采时长**全部摆在明面上**再让人点确认 ——
   * 不是"点了才知道建了什么"，也不是"建完才知道能采多久"。
   * 三种状态一个面板：未建（建厂）· 已建（升级/拆除）· 施工中（进度）。
   * ============================================================ */
  ui.openPlantModal = function (ci) {
    var RS = GAME.resource;
    if (!RS || !RS.ON_MAP || !RS.MIGRATE_EXT) { ui.toast('资源大地图模式未开启'); return; }
    var rv = RS.view(ci);
    if (!rv) { ui.toast('这一格不是资源地块'); return; }
    if (!rv.scanned) { ui.toast('先勘探这块地'); return; }
    var RES_NAME2 = {};
    (DATA.RESOURCES || []).forEach(function (m) { if (m && m.key) RES_NAME2[m.key] = m.name; });
    var eid = (RS.PLANT_OF_RES || {})[rv.res];
    var eb = (DATA.EXT_BUILDINGS || {})[eid];
    if (!eb) { ui.toast('这块地没有对应的采集场'); return; }
    var city = GAME.currentCity() || (GAME.state.cities && GAME.state.cities[0]);
    var pid = GAME.pidOf ? GAME.pidOf(city) : null;
    var tier = RS.richTier ? RS.richTier(rv.richness) : { name: '普通' };
    var curLv = rv.plant ? rv.plantLv : 0;
    var ts = GAME.timeScale ? GAME.timeScale() : 120;

    /* 施工中：队列里有这块地的任务就不给重复下单 */
    var q = null;
    ((GAME.state.queues && GAME.state.queues.build) || []).forEach(function (x) {
      if (x && (x.type === 'plant_build' || x.type === 'plant_upgrade') && x.ci === ci) q = x;
    });

    /* v158.17（老板 ⑤）：丰度单独成行并带标签 —— 原来拼在「地块」行里写成
       「森林 · 生物质　贫瘠 ×0.63」，读起来像"贫瘠却乘 0.63"的自相矛盾句。
       丰度管产量、储量管能采多久，是两个量，必须分开说。 */
    var head =
      '<div class="attr"><span class="k">地块</span><span class="v">' +
        U.escape((DATA.TERRAIN[rv.type] || {}).name || rv.type) + ' · ' + U.escape(RES_NAME2[rv.res] || rv.res) +
        '</span></div>' +
      '<div class="attr"><span class="k">采集场</span><span class="v">' + U.escape(eb.icon || '') + ' ' +
        U.escape(eb.name) + (curLv ? (' Lv' + curLv) : '') + '</span></div>' +
      '<div class="attr"><span class="k">丰度</span><span class="v">' +
        '<span style="color:var(--gold-light);">' + tier.name + '</span>　产量 ×' + rv.richness.toFixed(2) +
        '　<span class="ui-sub">（这块地肥不肥，管产量、不管能采多久）</span></span></div>';

    /* 产量与可采时长（丰度已计入，枯竭后按残采系数） */
    var per = eb.prod[Math.max(0, (curLv || 1) - 1)] || 0;
    var yieldH = per * rv.richness * (rv.reserve > 0 ? 1 : RS.DEPLETE_MULT);
    var hours = yieldH > 0 ? (rv.reserve / yieldH) : 0;           /* 游戏小时 */
    var realH = hours * 3600 / ts / 3600;                          /* 现实小时 */
    /* v158.17：`1333.3 现实小时` 不是人能读的量 —— 超过两天换"天"，
       并明说这是**现实**时间（游戏时 ×1 的换算也要有个说法）。 */
    var realTxt = realH >= 48 ? ((realH / 24).toFixed(1) + ' 天') : (realH.toFixed(1) + ' 小时');
    var reservePct = rv.reserveMax > 0 ? Math.max(0, Math.min(100, rv.reserve / rv.reserveMax * 100)) : 0;
    var body = head +
      '<div class="attr"><span class="k">产量</span><span class="v">' +
        U.numText(yieldH, 0) + ' / 游戏时　<span class="ui-sub">（基础 ' + U.numText(per, 0) +
        ' × 丰度 ' + rv.richness.toFixed(2) + (rv.reserve > 0 ? '' : ' × 残采 ' + RS.DEPLETE_MULT) + '）</span></span></div>' +
      /* v89.212（老板 1）「地块多的存的多」：这座厂的**露天堆场**另加本资源上限
         （= 同级战储仓的 1/6，纯加法不吃加成）—— 迁移到星球后口径不变，只是
         "地块"从城内堆场格变成了这块地，算式仍走 extStoreCapOneOf 唯一出口。
         v158.17：原文明写「另加生物质上限 +1,200（每级另加生物质上限 +200）」，
         同一个词说两遍 —— 收成「生物质上限 +1,200（每级 +200）」。 */
      '<div class="attr"><span class="k">堆场</span><span class="v">' +
        U.escape(RES_NAME2[rv.res] || '资源') + '上限 +' +
        (GAME.extStoreCapOneOf ? U.fmt(GAME.extStoreCapOneOf({ type: eid, lv: Math.max(1, curLv) })) : '—') +
        '　<span class="ui-sub">（每级 +' +
        (GAME.extStoreCapOneOf ? U.fmt(GAME.extStoreCapOneOf({ type: eid, lv: 1 })) : '—') + '）</span></span></div>' +
      '<div class="attr"><span class="k">储量</span><span class="v">' +
        '剩 ' + reservePct.toFixed(0) + '%　<span class="ui-sub">（' + U.numText(rv.reserve, 0) +
        ' / 上限 ' + U.numText(rv.reserveMax, 0) + '）</span>' +
        '　<span class="ui-sub">按当前产量约可采 ' + realTxt + '现实时间</span></span></div>';

    var foot = '';
    if (q) {
      var pct = q.totalTime > 0 ? Math.min(100, (q.elapsed / q.totalTime) * 100) : 0;
      body += '<div class="attr"><span class="k">施工</span><span class="v">' +
        (q.type === 'plant_build' ? '建造中' : '升级中') + '　' + pct.toFixed(0) + '%</span></div>';
      foot = '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    } else if (!rv.plant) {
      var cost = GAME.buildCostDiscountOf ? GAME.buildCostDiscountOf(GAME.extBuildCost(eid, 0)) : GAME.extBuildCost(eid, 0);
      /* v158.17：造价与工期拆两行 —— 四种材料 + 工期挤在一行时，
         后半个「工期」在窄弹窗里会被折行吃掉（老板「造价挤一行」）。 */
      body += '<div class="attr"><span class="k">造价</span><span class="v">' +
        [[cost.grain, 'grain'], [cost.wood, 'wood'], [cost.stone, 'stone'], [cost.iron, 'iron']].filter(function (x) { return x[0]; })
          .map(function (x) { return (RES_NAME2[x[1]] || x[1]) + ' ' + U.numText(x[0], 0); }).join('　') +
        '</span></div>' +
        '<div class="attr"><span class="k">工期</span><span class="v">' + U.dur(cost.time) + '</span></div>';
      var afford = GAME.canAffordIn ? GAME.canAffordIn(city, cost) : true;
      foot = '<div class="modal-foot">' +
        '<button class="btn gold" data-action="plant-build-do" data-ci="' + ci + '" data-eid="' + eid + '"' +
          (afford ? '' : ' disabled title="本城资源不足"') + '>' + U.escape(eb.icon || '⚒') + ' 开工建造</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>';
    } else {
      var costU = GAME.buildCostDiscountOf ? GAME.buildCostDiscountOf(GAME.extBuildCost(eid, curLv)) : GAME.extBuildCost(eid, curLv);
      var capLv = GAME.buildCapOf ? GAME.buildCapOf(city, eid) : 99;
      body += '<div class="attr"><span class="k">升级</span><span class="v">Lv' + (curLv + 1) +
        ' → 产量 ' + U.numText((eb.prod[curLv] || 0) * rv.richness, 0) + ' / 游戏时' +
        '　<span class="ui-sub">' + (costU ? (U.numText(costU.grain, 0) + ' 净水 · ' + U.numText(costU.wood, 0) + ' 生物质 · 工期 ' + U.dur(costU.time)) : '已满级') + '</span></span></div>';
      foot = '<div class="modal-foot">' +
        (curLv < capLv && costU
          ? '<button class="btn gold" data-action="plant-upgrade-do" data-ci="' + ci + '">⬆ 升级至 Lv' + (curLv + 1) + '</button>'
          : '<button class="btn" disabled title="已达最高等级">已满级</button>') +
        '<button class="btn red" data-action="plant-dismantle-do" data-ci="' + ci + '">🗑 拆除</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>';
    }

    ui.openModal(
      /* v158.17：标题图标取建筑自己的（水培温室是 🌱 不是 🏭）——「🏭 水培温室」
         这种搭配会让人以为建的是工厂。 */
      '<div class="gold-heading">' + U.escape(eb.icon || '⚒') + ' ' + U.escape(eb.name) + '</div>' +
      '<div class="m-body">' + body + '</div>' + foot,
      { size: 'md', live: function () { ui.openPlantModal(ci); } }
    );
  };

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

  /* ============================================================
   * v158.14（老板「人物如何走动，我至今没有发现操作选项」）：跟随态操作条
   * ------------------------------------------------------------
   * 旧状：进入人物视角只有一条 2.2 秒就消失的 toast，之后屏幕上再无任何
   *   操作说明 —— 玩家（含老板本人）按方向键没反应，就判定"没有移动功能"。
   * 这里给一条**常驻**操作条，跟 district-hud / vehicle-hud 同风格：
   *   纯文字、pointer-events:none（不放按钮 → 不产生孤儿按钮），
   *   挂左下角（右下是街区 HUD、中下是交互提示，互不遮挡）。
   * 显隐由 M.setFollow() 唯一出口驱动，与底栏「🧍 人物」高亮同一个开关。
   * ============================================================ */
  /* ============================================================
   * v158.31（老板「怎么走，怎么交互，乱七八糟」）
   * ------------------------------------------------------------
   * 这是**屏幕上唯一的操作说明**，原来写的是
   *   `W A S D 或 ↑↓←→ 走动 · A/D 转向 · E 交互 · Tab 退出`
   * 三处都不对：
   *   ① 「Tab 退出」—— 人物模式 v158.20 已退役，Tab 什么都不做；
   *   ② 左键（点哪走哪）/ 右键（转视角）/ 滚轮（高度）/ 鼠标贴边（推进地图）一个字没提；
   *   ③ 它只由 `M.setFollow()` 驱动，人物模式退役后基本不再被调用
   *      → 这条条子在实际游戏里根本不出现。
   * 现在：文案按**真实键位**重写；显隐改跟**地表状态**（见 map3d 的 `_applySurf`）。
   * ============================================================ */
  /* ============================================================
   * v158.34（老板「画面太卡」）：F2 自测条 —— 左上角一行小字
   * `60fps · 16.7ms · p95 18 · 重建 27ms`
   * 卡的时候一眼能分清是"渲染慢"还是"整层重建"。
   * ============================================================ */
  ui.perfHud = function (st) {
    var root = (ui.layerRoot && ui.layerRoot()) || null;
    if (!root || !root.appendChild) return null;
    var el = document.getElementById('perf-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'perf-hud';
      el.style.cssText = 'position:absolute;left:12px;top:44px;z-index:2200;'
        + 'pointer-events:none;font:12px/1.5 ui-monospace,Consolas,monospace;'
        + 'background:rgba(8,12,18,.78);color:#9fe3c0;border:1px solid rgba(120,200,160,.35);'
        + 'border-radius:6px;padding:4px 8px;white-space:pre;';
      root.appendChild(el);
    }
    var on = !!(GAME.map3d && GAME.map3d.PERF);
    el.style.display = on ? 'block' : 'none';
    if (!on) return el;
    el.textContent = st.fps + 'fps · ' + st.ms.toFixed(1) + 'ms · p95 ' + st.p95
      + 'ms · 重建 ' + (st.rebuildMs || 0).toFixed(1) + 'ms';
    return el;
  };
  ui.renderFollowHud = function (on) {
    var root = (ui.layerRoot && ui.layerRoot()) || null;
    if (!root || !root.appendChild) return null;
    var el = document.getElementById('follow-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'follow-hud';
      el.style.cssText = 'position:absolute;left:22px;bottom:88px;z-index:1901;'
        + 'display:none;pointer-events:none;font-size:14px;line-height:1.9;'
        + 'opacity:1;transition:opacity .8s;';
      /* ⛔ v158.46b（老板「『操作说明见设置页』就是我见过最垃圾最废物的文案和指示」）：
         HUD 直接印键位，不再写任何"去设置页看"的废话指示 ——
         指示就该出现在操作现场，不能把玩家打发去翻设置。 */
      el.innerHTML = '<span style="display:inline-block;background:rgba(12,18,26,.88);'
        + 'color:var(--gold-light,#f5e6b8);border:1px solid var(--gold-dark,#8a6d2f);'
        + 'border-radius:8px;padding:8px 12px;font-weight:700;">'
        + '<span style="opacity:.82;font-weight:600;">左键 点哪走哪　·　左键长按 平移镜头　·　右键长按 转视角　·　WASD/方向键 走动　·　E 交互　·　滚轮 升空</span></span>';
      root.appendChild(el);
    }
    if (!on) { el.style.display = 'none'; return el; }
    /* v158.46c（老板「不要占据用户的心智，任何游戏主体之外的内容，
       不要长久挂载占据界面和过程」）：键位条不再常驻 ——
       **每局首次进地表显示 8 秒后自动淡出**，之后不再打扰。 */
    if (!GAME._fhShown) {
      GAME._fhShown = true;
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.display = 'block';
      if (ui._fhTimer) clearTimeout(ui._fhTimer);
      ui._fhTimer = setTimeout(function () {
        var e2 = document.getElementById('follow-hud');
        if (!e2) return;
        e2.style.transition = 'opacity .8s';
        e2.style.opacity = '0';
        setTimeout(function () {
          var e3 = document.getElementById('follow-hud');
          if (e3) e3.style.display = 'none';
        }, 850);
      }, 8000);
    }
    return el;
  };
  /* ============================================================
   * v158.46（老板「地图界面上加一个相机实时高度数值」）：高度 HUD ——
   * 地图页常驻一行相机离地高度（米），由 map3d 渲染循环按 sig 去重驱动
   * （取整变化才写一次 DOM）。左上角，不挡中央视野。
   * ============================================================ */
  ui.renderAltHud = function (agl) {
    var root = (ui.layerRoot && ui.layerRoot()) || null;
    if (!root || !root.appendChild) return null;
    var el = document.getElementById('alt-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'alt-hud';
      el.style.cssText = 'position:absolute;left:12px;top:70px;z-index:1900;'
        + 'pointer-events:none;display:none;white-space:nowrap;'
        + 'background:rgba(12,18,26,.72);color:#bfe3ff;'
        + 'border:1px solid rgba(110,160,210,.35);border-radius:6px;'
        + 'padding:3px 9px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;'
        + 'opacity:1;transition:opacity .6s;';
      root.appendChild(el);
    }
    if (agl == null || !isFinite(agl)) {
      /* v158.46c（老板「不要占据用户的心智」）：静止即淡出，不留残影 */
      if (el.style.display !== 'none') {
        el.style.transition = 'opacity .6s';
        el.style.opacity = '0';
        if (ui._ahTimer) clearTimeout(ui._ahTimer);
        ui._ahTimer = setTimeout(function () { el.style.display = 'none'; }, 650);
      }
      return el;
    }
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.textContent = '📐 相机高度 ' + Math.round(agl) + ' m（海拔）';
    el.style.display = 'block';
    return el;
  };

  /* ============================================================
   * v158.43（诉求1·高空空天飞机飞行）：飞行 HUD —— 只有高空有速度时显示
   * 一行速度 + 键位（占屏最小；静止即隐）。由 map3d 渲染循环按 sig 去重驱动
   * （速度取整变化才写一次 DOM）。诉求 5「必要时对操作方式加以说明」。
   * ============================================================ */
  ui.renderFlyHud = function (v) {
    var root = (ui.layerRoot && ui.layerRoot()) || null;
    if (!root || !root.appendChild) return null;
    var el = document.getElementById('fly-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fly-hud';
      el.style.cssText = 'position:absolute;left:50%;bottom:120px;transform:translateX(-50%);'
        + 'z-index:1902;pointer-events:none;display:none;white-space:nowrap;'
        + 'background:rgba(12,18,26,.86);color:#8fd8ff;'
        + 'border:1px solid rgba(90,160,220,.45);border-radius:8px;'
        + 'padding:5px 12px;font-size:14px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.45);';
      root.appendChild(el);
    }
    if (v == null || (ui.modalVisible && ui.modalVisible())) {
      el.style.display = 'none';
      return el;
    }
    var _sp = Math.round(Math.abs(v));
    el.innerHTML = '<span style="opacity:.9;">🚀 空天飞机 · </span>'
      + U.escape(String(_sp)) + ' m/s · ' + (v >= 0 ? '前进' : '倒飞')
      + '<span style="opacity:.6;font-weight:600;margin-left:8px;">E 加速 · Q 减速 · W/S 俯仰 · A/D 转向</span>';
    el.style.display = 'block';
    return el;
  };

  /* ============================================================
   * v158.1（P1 大世界）：走近交互提示条
   * ------------------------------------------------------------
   * 不是新面板 —— 只是一行跟随态常驻提示；M.nearestInteractable() 出目标，
   * 由 map3d 渲染循环按 sig 去重后驱动（跨格才写一次 DOM）。
   * ⚠️ 必须挂 `GAME.ui.*`：新开顶层 `GAME.interactHint` 会让 arch 多一条 core>ui 边。
   * ============================================================ */
  ui.renderInteractHint = function (hit) {
    var root = (ui.layerRoot && ui.layerRoot()) || null;
    if (!root || !root.appendChild) return null;
    var el = document.getElementById('interact-hint');
    if (!el) {
      el = document.createElement('div');
      el.id = 'interact-hint';
      el.style.cssText = 'position:absolute;left:50%;bottom:88px;transform:translateX(-50%);'
        + 'z-index:1900;pointer-events:none;display:none;white-space:nowrap;'
        + 'background:rgba(12,18,26,.86);color:var(--gold-light,#f5e6b8);'
        + 'border:1px solid var(--gold-dark,#8a6d2f);border-radius:8px;'
        + 'padding:6px 12px;font-size:15px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.45);';
      root.appendChild(el);
    }
    if (!hit || (ui.modalVisible && ui.modalVisible())) {
      el.style.display = 'none';
      el.textContent = '';
      el.removeAttribute('data-ci');
      return el;
    }
    el.innerHTML = '<span style="display:inline-block;background:var(--gold,#c9a44c);color:#1a1206;'
      + 'border-radius:4px;padding:1px 7px;margin-right:8px;font-size:13px;">E</span>'
      + U.escape(String(hit.verb || '查看') + String(hit.name || '目标'));
    el.setAttribute('data-ci', String(hit.ci));
    el.setAttribute('data-kind', String(hit.kind || ''));
    el.style.display = 'block';
    return el;
  };

  /* ============================================================
   * v158.2（P2 大世界）：街区态 HUD
   * ------------------------------------------------------------
   * ⚠️ 不复用 #interact-hint：那一条 pointer-events:none 且每帧按 sig 重写
   *    innerHTML，按钮会被吃掉（P1 探针 B1/B2 就是拿它做反向守卫的）。
   * 仍挂 ui.layerRoot() 唯一挂载点；出口挂 GAME.ui.*，不新增顶层全局。
   * ============================================================ */
  ui.renderDistrictHud = function (on) {
    var root = (ui.layerRoot && ui.layerRoot()) || null;
    if (!root || !root.appendChild) return null;
    var el = document.getElementById('district-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'district-hud';
      el.style.cssText = 'position:absolute;right:22px;bottom:88px;z-index:1901;'
        + 'display:none;pointer-events:auto;font-size:14px;';
      el.innerHTML = '<span id="district-hud-tip" style="display:inline-block;background:rgba(12,18,26,.88);'
        + 'color:var(--gold-light,#f5e6b8);border:1px solid var(--gold-dark,#8a6d2f);'
        + 'border-radius:8px;padding:8px 12px;margin-right:8px;">WASD / 方向键 走动 · A/D 转向 · 走出南边即回星球</span>'
        + '<button class="btn" data-action="district-exit" style="font-weight:700;">退出街区（Q）</button>';
      root.appendChild(el);
    }
    /* v158.17：出口提示由**这块地有没有墙**决定 —— 有墙是"走出南门"，
       没墙（城墙还没建）就是"走到南边尽头"。文案跟数据走，不写死。 */
    if (on) {
      var _tip = document.getElementById('district-hud-tip');
      if (_tip) {
        var _hasWall = !!(GAME.district && GAME.district.plan && GAME.district.plan.wall);
        _tip.textContent = 'WASD / 方向键 走动 · A/D 转向 · ' +
          (_hasWall ? '走出南门即回星球' : '走到南边尽头即回星球');
      }
    }
    el.style.display = on ? 'block' : 'none';
    /* v158.14：街区态由本条**接管**操作说明 —— 左下那条跟随态操作条同时收起，
       否则一屏两处「WASD 走动」并列（实测啰嗦）。退出街区（Q / 按钮 / 退出跟随）
       都走本函数 on=false，跟随条随之还原，不会漏。 */
    var _fh = document.getElementById('follow-hud');
    if (_fh) _fh.style.display = (!on && GAME.map3d && GAME.map3d.FOLLOW) ? 'block' : 'none';
    return el;
  };

  /* ============================================================
   * v158.18（老板「新手玩法」）：任务链常驻提示条
   * ------------------------------------------------------------
   * 新手第一卡点（探针 p_newbie 实测）：`Q.hint()` 一直有内容
   * （🚶 任务链 · 走一段路），却没接到任何可见 HUD —— hintShown=false /
   * questPanel=false / anyGuideText=false，开局后屏幕上没有一个字说"该干嘛"。
   * 照 #interact-hint 的既有范式：挂 ui.layerRoot() 唯一挂载点、
   * sig 去重（不每帧重写 innerHTML），出口挂 GAME.ui.* 不新增顶层全局。
   * 另：大世界入口「🧍 人物」只在**地图页底栏**（map-dock），新手开局在
   * 城内视图根本看不到它 —— 所以城内态额外补一枚「去大世界走走」，
   * 走同一个 follow-toggle 出口（不新开入口）。
   * ============================================================ */
  ui.renderQuestHint = function () {
    var root = (ui.layerRoot && ui.layerRoot()) || null;
    if (!root || !root.appendChild) return null;
    var G = GAME;
    var hint = (G.questline && G.questline.hint) ? G.questline.hint() : '';
    /* ============================================================
     * v158.24（老板「怎么走近」）：走动中**优先显示行程**。
     * 没有这条时，玩家点完「走过去勘探」会盯着一个不动的画面等 20 秒
     * —— 那正是"点了没反应"的另一种形态。
     * ============================================================ */
    var _wt24 = (G.map3d && G.map3d.walkTarget) ? G.map3d.walkTarget() : -1;
    if (_wt24 >= 0) {
      var _left24 = 0;
      try {
        var _M24b = G.map3d, _pp24 = _M24b.playerPose();
        var _cl24 = _M24b._collider && _M24b._collider.cells;
        if (_pp24 && _cl24 && _cl24[_wt24]) {
          var _t24 = _cl24[_wt24].dir;
          var _d24 = Math.max(-1, Math.min(1, _pp24.dir[0] * _t24[0] + _pp24.dir[1] * _t24[1] + _pp24.dir[2] * _t24[2]));
          _left24 = Math.acos(_d24) * (_M24b.R || 300);
        }
      } catch (eWT24) { }
      hint = _left24 > 1.5
        ? ('🚶 正在走过去…还剩 ' + Math.round(_left24) + ' 米（点别处可改目标）')
        : '🚶 快到了…';
    }
    var el = document.getElementById('quest-hint');
    if (!hint || !G.state) {                      /* 任务链走完 / 没开局 → 收起 */
      if (el) { el.style.display = 'none'; el.innerHTML = ''; el.removeAttribute('data-sig'); }
      return null;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'quest-hint';
      el.style.cssText = 'position:absolute;left:22px;top:64px;z-index:1901;'
        + 'display:none;pointer-events:auto;font-size:14px;line-height:1.7;';
      root.appendChild(el);
    }
    /* ⛔ v158.20（老板「去掉人物模式 · 只提示人物位置」）：v158.18 加的那枚
       「🧍 去大世界走走」按钮随 follow-toggle 一起退役 —— 不再有"进入人物视角"这个动作。
       地图上一直有小人标着位置，点哪它就真的走过去（map3d.walkTo / stepWalkTo）。
       这条 HUD 现在只做一件事：显示任务链当前该干什么。 */
    var sig = hint;
    if (el.getAttribute('data-sig') !== sig) {
      el.setAttribute('data-sig', sig);
      el.innerHTML = '<span style="display:inline-block;background:rgba(12,18,26,.88);'
        + 'color:var(--gold-light,#f5e6b8);border:1px solid var(--gold-dark,#8a6d2f);'
        + 'border-radius:8px;padding:7px 12px;font-weight:700;">'
        + U.escape(hint) + '</span>';
    }
    el.style.display = 'block';
    return el;
  };

  /* ============================================================
   * v158.3（P3 大世界）：载具态 HUD（纯文字，不新增按钮 → 无孤儿按钮风险）
   * ------------------------------------------------------------
   * ⚠️ 同 P2：不复用 #interact-hint（每帧按 sig 重写 innerHTML、pointer-events:none）。
   * 上马时由 main.js 的 E 分支点亮；下车/离街区时熄灭。出口挂 GAME.ui.*。
   * ============================================================ */
  ui.renderVehicleHud = function (on) {
    var root = (ui.layerRoot && ui.layerRoot()) || null;
    if (!root || !root.appendChild) return null;
    var el = document.getElementById('vehicle-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vehicle-hud';
      el.style.cssText = 'position:absolute;left:50%;bottom:132px;transform:translateX(-50%);'
        + 'z-index:1902;display:none;pointer-events:none;white-space:nowrap;font-size:14px;';
      el.innerHTML = '<span style="display:inline-block;background:rgba(12,18,26,.9);'
        + 'color:var(--gold-light,#f5e6b8);border:1px solid var(--gold-dark,#8a6d2f);'
        + 'border-radius:8px;padding:7px 13px;font-weight:700;">'
        + 'E 下车 · WASD 驾驶 · A/D 转向</span>';
      root.appendChild(el);
    }
    el.style.display = on ? 'block' : 'none';
    return el;
  };

  /* ============================================================
   * v158.4（P4 大世界）：街区居民提示条
   * ------------------------------------------------------------
   * ⚠️ 同 P2/P3：不复用 #interact-hint（每帧按 sig 重写 innerHTML、
   *    pointer-events:none）。由 GAME.npc.tick 按 id/hostile/verb 的签名
   *    去重驱动；挂 GAME.ui.*，不新增顶层全局、不抢 P1/P3 拾取。
   * ============================================================ */
  ui.renderNpcHint = function (hit) {
    var root = (ui.layerRoot && ui.layerRoot()) || null;
    if (!root || !root.appendChild) return null;
    var el = document.getElementById('npc-hint');
    if (!el) {
      el = document.createElement('div');
      el.id = 'npc-hint';
      el.style.cssText = 'position:absolute;left:50%;bottom:132px;transform:translateX(-50%);'
        + 'z-index:1903;display:none;pointer-events:none;white-space:nowrap;font-size:14px;';
      root.appendChild(el);
    }
    if (!hit || (ui.modalVisible && ui.modalVisible())) {
      el.style.display = 'none';
      el.textContent = '';
      /* 桩环境（smoke 的 DOM stub）没有 removeAttribute —— 观测层不许炸玩法。 */
      if (el.removeAttribute) el.removeAttribute('data-npc');
      return el;
    }
    el.innerHTML = '<span style="display:inline-block;background:var(--gold,#c9a44c);color:#1a1206;'
      + 'border-radius:4px;padding:1px 7px;margin-right:8px;font-size:13px;">E</span>'
      + U.escape(String(hit.verb || '交谈') + String(hit.name || '行人'));
    el.setAttribute('data-npc', String(hit.id));
    el.setAttribute('data-hostile', hit.hostile ? '1' : '0');
    el.style.display = 'block';
    return el;
  };
})();
