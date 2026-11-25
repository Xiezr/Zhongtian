/* ============================================================
 * ui-view.js　视图与枢纽 · setView / 交易站 / 英雄枢纽 / 节钺 / 行政 / 世界账本
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
  var BAG_LEGACY_TAB = ui._C.BAG_LEGACY_TAB;
  var BLDG_FUNC = ui._C.BLDG_FUNC;

  /* ================= 中央视图 ================= */
  ui.setView = function (v) {
    ui.view = v;
    /* v41（需求 4）：进公文页即视为「已读」—— 闪黄提醒的寿命到玩家看一眼为止。
       清零后立刻同步一次徽标，否则要等主循环下一拍才灭（体感像"点了没反应"）。 */
    /* v41（需求 4）：进公文页即视为「已读」—— 闪黄提醒的寿命到玩家看一眼为止。
       清零后立刻同步一次徽标，否则要等主循环下一拍才灭（体感像"点了没反应"）。
       v82：收编同段重复块（v67 基线带来的逐字双份）。 */
    if (v === 'reports' && GAME.state && GAME.state.repUnread) {
      GAME.state.repUnread = 0;
      ui.syncBadges();
    }
    /* v20（需求 7）：左侧栏只在**城市场景**显示 ——
       地图/英雄/任务等页面要的是整屏空间，挂一条城市资源栏既占地方又容易误读。
       v26：显隐判断**只在 renderView 里做一次** —— 原先 setView 与 renderView
       各写一份，改"哪些视图算城市场景"时必然只改到一处（renderView 后跑，
       于是错误被掩盖，但另一处已成死逻辑）。 */
    $$('#topnav .tab[data-view]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.view === v);
    });
    ui.renderView(v);
    /* v158.18（老板「新手玩法」）：切视图即刷任务链提示 —— 新手在城内与地图页之间
       来回时提示要跟着变（城内给「去大世界」入口，大世界里给当前步骤）。 */
    if (ui.renderQuestHint) ui.renderQuestHint();
  };

  /* 背包页签 */
  /* v29（需求 4）：切页签 / 换排序一律回到第 1 页 ——
     否则从"材料第 2 页"切到"图纸"再切回来，会停在一个已经没有内容的页码上
     （分页条看着有页码、正文却是空的）。 */
  ui.setBagTab = function (t) {
    /* v89.115：顶层两类（装备 / 宝物）；旧值 'mat' / 'item' / 'bp' 自动迁移到
       「宝物 + 对应二级分类」（老深链、老测试、老脚本都不炸）。 */
    if (BAG_LEGACY_TAB[t]) {
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
  };
  ui.setBagSort = function (v) {
    var sk = ((ui._bagTab || 'equip') === 'equip') ? 'equip' : 'treasure';
    ui._bagSort[sk] = v;
    ui._pages['bag-' + sk] = 1;
    ui.openBag(ui._bagTab);
  };
  /* ⛔ v89.218（老板）：「不再保留史册，故事集」——
     ui.storyHTML（史册：天时/时代之志/实力折算/当前评定 + 待阅逸闻）与
     ui.storiesHTML（故事集：收集与回看）两视图整条退役；顶栏页签一并移除。
     天时（年/季/天气）仍在顶栏天时行（story.skyLine）与公文播报中可见。 */

  /* ================= 征召大厅：招募（v89.188：统一话术） ================= */
  /* v89.62（老板「增加自动招募按钮，可设置当征召大厅刷新出什么品质的时候自动招募，
     直至达到英雄枢纽空位上限」）—— 征召大厅面板顶部的自动招募条：
       开关（点按钮翻转）+ 资质门槛（点选 chip，从突变体起，不新增下拉框）。
     执行与择优全在 GAME.innAutoRun（唯一出口），界面只写 s.settings.innAuto 这一个对象。 */
  ui.autoRecruitHTML = function () {
    /* v89.73（老板：「自动招募做到顶部的『自动』菜单下，不要放征召大厅里」）
       —— 从征召大厅搬到「自动」页，与自动升级/研究/出征同处（都是"挂机自动"这一族）。
       门槛只列**征召大厅出得到的档位**（≤ 进化体）：v89.73 起征召大厅封顶进化体，
       若还把觉醒体/天启体列出来，那就是两个**永远招不到的死选项**，
       开了自动招募会静默地永不触发 —— 比没有这个开关更糟。 */
    var c = GAME.innAutoCfg();
    var capName = (DATA.GEN_RANK_BY_ID[GAME.INN_RANK_CAP] || {}).name || '进化体';
    var capI = GAME.rankIndex(GAME.INN_RANK_CAP);
    var ranks = (DATA.GEN_RANKS || []).filter(function (r) {
      var i = GAME.rankIndex(r.id);
      return i >= 1 && i <= capI;
    });
    /* v89.115：去外壳（.auto-card / 标题 / 开关按钮）—— 新的自动化界面由右侧详情 pane
       统一提供外壳与开关（ui.autoPaneHTML），这里只出**设置正文**，避免两个开关并排。 */
    return '<div class="auto-state">开启后：征召大厅每批候选到手即自动招募<b>达到门槛者</b>，资质高者优先，' +
          '直至英雄枢纽空位满 / 旧币不足为止。</div>' +
        '<div class="auto-line"><span class="al-k">资质门槛</span>' +
          '<div class="chips chips-xs" style="justify-content:flex-start;">' +
            ranks.map(function (r) {
              return '<span class="chip' + (c.min === r.id ? ' on' : '') +
                '" data-action="auto-recruit-min" data-v="' + r.id + '">' + r.name + '及以上</span>';
            }).join('') +
          '</div></div>' +
        '<div class="auto-state">征召大厅候选资质上限 <b>' + capName +
          '</b>　·　觉醒体 / 天启体不直接招募，只能靠<b>血清升档</b>。</div>';
  };
  /* ============================================================
   * v89.190（老板 2）：**自动征兵**设置面板（自动化 · 右详情正文）
   * ------------------------------------------------------------
   * 老板原话：「自动征兵。构思界面，提供设置，包括触发条件，停止条件，
   *   目标兵种，可用栏位（与对应城市内可用兵营募兵队列相关，提供判别机制）等等」。
   * 本函数只画 —— 读数全走唯一出口（GAME.autoTrainCfg / autoTrainPlanOf）；
   * 数值输入走 change 委托（data-action="autotrain-set"）→ 落库 → 就地重绘本页。
   * ============================================================ */
  ui.autoTrainHTML = function () {
    var s = GAME.state || {};
    var c = GAME.autoTrainCfg();
    if (!c) return '';
    var on = !!(s.settings && s.settings.autoTrain);
    var ids = Object.keys(DATA.TROOPS);
    var rows = ids.map(function (id) {
      var t = DATA.TROOPS[id], tg = c.targets[id] || { min: 0, max: 0 };
      var part = (tg.max || 0) > 0;
      var have = 0, queued = 0;
      (s.cities || []).forEach(function (c0) { have += (c0.army && c0.army[id]) || 0; });
      ((s.queues && s.queues.train) || []).forEach(function (q) { if (q.troopId === id) queued += (q.count || 0); });
      return '<tr' + (part ? ' class="at-on"' : '') + '>' +
        '<td>' + t.icon + ' ' + U.escape(t.name) +
          (t.craft ? ' <span class="ui-sub">🏭 精密制造厂</span>' : '') + '</td>' +
        '<td class="ctr"><input type="number" class="at-num" min="0" max="9999999" value="' + (tg.min || 0) +
          '" data-action="autotrain-set" data-k="min" data-troop="' + id + '"></td>' +
        '<td class="ctr"><input type="number" class="at-num" min="0" max="9999999" value="' + (tg.max || 0) +
          '" data-action="autotrain-set" data-k="max" data-troop="' + id + '"></td>' +
        '<td class="num">' + U.numText(have, 0) +
          (queued ? ' <span class="ui-sub">+' + U.numText(queued, 0) + ' 在训</span>' : '') + '</td>' +
        '</tr>';
    }).join('');
    var cityLines = (s.cities || []).map(function (c0) {
      var plan = GAME.autoTrainPlanOf(c0);
      var gaps = plan.needs.filter(function (n) { return n.need > 0; })
        .map(function (n) { return ((DATA.TROOPS[n.troopId] || {}).name || n.troopId) + ' 差 ' + U.fmt(n.need); });
      var slotTxt = (plan.bars.length || plan.craftBars.length)
        ? (plan.bars.length ? '军营 ' + plan.bars.length + ' 座　空位 <b>' + plan.left + ' / ' + plan.total + '</b>' : '')
          + (plan.craftBars.length ? (plan.bars.length ? '　·　' : '') + '精密制造厂 ' + plan.craftBars.length + ' 座　空位 <b>' + plan.craftLeft + ' / ' + plan.craftTotal + '</b>' : '')
        : '<span class="ui-sub">无军营 / 精密制造厂 —— 不参与</span>';
      /* v89.199（老板 2）：「待补」清单逐项累积（每个参与的兵种一项）——wrap-ok =
         换行许可；不加时 nowrap 会把本行撑到上千 px、连锁撑宽整页（实测 1408→2383）。 */
      return '<div class="res-line wrap-ok"><span class="lbl">' + U.escape(c0.name) + '</span><span class="val">' + slotTxt +
        (gaps.length
          ? '　待补：' + gaps.join('、')
            + (plan.left <= 0 && plan.craftLeft <= 0 ? '　<span style="color:var(--amber);">队列满（消化后自动继续）</span>' : '')
          : (plan.needs.length ? '　<span style="color:var(--green-ok);">已达标</span>' : '')) +
        '</span></div>';
    }).join('');
    var log = c.log || [];
    var logRows = log.length ? log.map(function (r) {
      var d = new Date(r.t || U.now());
      return '<div class="res-line wrap-ok"><span class="lbl">🕒 ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) +
        '</span><span class="val">' + U.escape(r.city || '') + '　' + U.escape(r.troop || '') +
        ' ×' + U.numText(r.count || 0, 0) + '</span></div>';
    }).join('') : '<div class="q-empty">暂无记录 —— 开启后每次真补单都会记一条（含城市 / 兵种 / 数量）</div>';
    var gapS = Math.round(((DATA.AUTO_TRAIN || {}).gapMs || 10000) / 1000);
    return '<div class="auto-state">' + (on
        ? '已开启 —— 每 ' + gapS + ' 现实秒检查一轮：逐城判别、自动补单（下表为「触发线 / 目标」逐兵种设置）。'
        : '已关闭 —— 配置会保留，重开即用。') + '</div>' +
      '<div class="auto-line"><span class="al-k">触发条件</span><span>某城某兵种（驻军 + 在训）<b>低于「触发线」</b>即自动补单（触发线设 0 = 低于目标就补）</span></div>' +
      '<div class="auto-line"><span class="al-k">停止条件</span><span>达到<b>「目标」</b>即停 · <b>旧币 / 净水低于保底</b>即停（暂停不关开关）· 军营队列满则等待（消化后自动继续）</span></div>' +
      '<div class="auto-line"><span class="al-k">执行范围</span><span>全境统一规则、<b>逐城独立执行</b>（各用各的城市资源与队列）；器械（无人轰炸机 / 东风快递）走<b>精密制造厂队列</b>，与军营队列分开排空位</span></div>' +
      '<div class="auto-line"><span class="al-k">可用栏位</span><span>只往<b>有空位</b>的队列放单 —— 军营位 = Σ 军营（队列位 − 已占）、精密制造厂位同理；与募兵面板同一把尺（trainQueueSlots 唯一出口）</span></div>' +
      '<table class="tbl" style="margin-top:var(--sp-3);"><thead><tr><th>目标兵种</th><th class="ctr">触发线（低于）</th><th class="ctr">目标（补到）</th><th class="num">全境现状</th></tr></thead><tbody>' +
        rows + '</tbody></table>' +
      '<div class="auto-line" style="margin-top:var(--sp-3);"><span class="al-k">资源保底</span>' +
        '<span>旧币 ≥ <input type="number" class="at-num" min="0" max="999999999" value="' + (c.goldKeep || 0) +
          '" data-action="autotrain-set" data-k="goldKeep"></span>' +
        '<span>净水（各城）≥ <input type="number" class="at-num" min="0" max="999999999" value="' + (c.grainKeep || 0) +
          '" data-action="autotrain-set" data-k="grainKeep"></span>' +
        '<span class="ui-sub">0 = 不设保底</span></div>' +
      '<div class="auto-note" style="margin-top:var(--sp-4);"><b>各城栏位与缺口</b>（逐城判别 · 实时）</div>' +
        (cityLines || '<div class="q-empty">尚无城市</div>') +
      '<div class="auto-note" style="margin-top:var(--sp-4);"><b>触发记录</b>（最近 ' + log.length + ' 单 · 逐单列出）</div>' + logRows;
  };
  ui.openInn = function () {
    var s = GAME.state;
    var city = GAME.currentCity();
    var lv = GAME.innLevel(city);
    if (lv <= 0) {
      ui.openModal('<div class="gold-heading">🍶 征召大厅</div>' +
        '<div class="q-empty">尚未建造征召大厅</div>' +
        '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
      return;
    }
    var list = GAME.innRefresh();
    /* v64：招贤以**这座城 + 这座城的空位**为准 */
    var chk = GAME.canRecruitGeneral(city);
    var cap = GAME.genSlotsOf(city);
    var usedIn = GAME.generalsIn(city).length;
    var left = Math.ceil(GAME.innRefreshLeft() / 1000);
    var leftTxt = left > 0 ? (left + ' 秒后自动更换') : '可更换';
    /* v89.86（整改 P-15）：无空位时的**升级引导** —— 此前只有一句"已无空位"，
       新手不知道升到几级、按钮禁用旁也没有原因（引导链断在这里）。 */
    var slotGuide = '';
    if (cap > 0 && usedIn >= cap) {
      var zxgLv15 = GAME.buildingLevel(city, 'zhaoxianguan') || 0;
      var zxgCap15 = GAME.buildCapOf(city, 'zhaoxianguan');
      var govLv15 = GAME.buildingLevel(city, 'guanfu') || 0;
      var govCap15 = GAME.buildCapOf(city, 'guanfu');
      if (zxgLv15 < zxgCap15) {
        slotGuide = '升英雄枢纽至 Lv' + (zxgLv15 + 1) + ' 可添 1 席';
      } else if (govLv15 < govCap15) {
        /* v68 规则：城内建筑等级被政务厅压顶 —— 英雄枢纽想再升，得政务厅先升 */
        slotGuide = '先升政务厅至 Lv' + (govLv15 + 1) + '，再升英雄枢纽可添 1 席';
      } else {
        slotGuide = '英雄枢纽已至上顶（Lv' + zxgCap15 + '）—— 可把英雄派往他城腾位';
      }
    }

    /* v77（老板）：「英雄招募字太密了，整成列表，表头比如英雄，等级，资质，专长，
       指挥……俸禄」——候选改**表格**：表头 + 每位一行；
       新增「月俸」列（与月俸体系同源：GAME.genSalaryOf）。
       v75 的两条仍立着：单行显示 / 成长备注只在资质徽章悬停里。 */
    var STYLE_NAME = {};
    (DATA.GEN_STYLES || []).forEach(function (x) { STYLE_NAME[x.id] = x.name; });
    var rows = list.map(function (c) {
      var can = chk.ok && (s.res.gold || 0) >= c.cost;
      return '<tr class="inn-tr' + (can ? '' : ' off') + '">' +
        '<td><span class="inn-face-cell"><span class="inn-avatar">' + ui.faceOf(
          { name: c.name, rank: c.rank, beauty: c.beauty, portraitSeed: c.portraitSeed }, 28) + '</span>' +
          /* v80（老板）：招募行去「史实英雄」标；v89.188（老板 3）：全站撤 hero/beauty
             标签与「相亲」话术（所有英雄标识统一 —— 招募行只留姓名）。 */
          '<span class="inn-name" style="white-space:nowrap;">' + U.escape(c.name) + '</span></span></td>' +
        '<td class="ctr">Lv' + c.level + '</td>' +
        '<td class="ctr">' + ui.rankBadge(c) + '</td>' +
        '<td class="ctr">' + (STYLE_NAME[c.style] || '均衡') + '</td>' +
        '<td class="num">' + c.tong + '</td>' +
        '<td class="num">' + c.nz + '</td>' +
        '<td class="num">' + c.yw + '</td>' +
        '<td class="num">' + c.zm + '</td>' +
        '<td class="num" title="每 7 游戏日结算一次（按等级、属性与资质定价）">' +
          U.fmt(GAME.genSalaryOf(c)) + '</td>' +
        '<td><span class="inn-act">' +
          /* v90.44（老板）：招募费不再内联，移入「招募」按钮悬停。 */
          '<button class="btn sm' + (can ? ' gold' : '') + '" data-action="inn-recruit" data-id="' + c.id + '"' +
            /* v89.86（整改 P-15）：按钮旁给出禁用原因（无空位 → 升级引导；缺旧币 → 旧币不足）
               v90.44：费用恒在悬停（招募费）；禁用时再附原因。 */
            ' title="' + U.escape('招募费：' + U.fmt(c.cost) + ' 旧币'
              + (can ? '' : '\n' + (slotGuide || chk.msg || ('旧币不足（需 ' + U.fmt(c.cost) + '）')))) + '"' +
            (can ? '' : ' disabled') +
            /* v89.188（老板 3）：全站统一「招募」（「相亲」话术退役） */
            '>招募</button>' +
        '</span></td></tr>';
    }).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">征召大厅中暂无贤士，稍候再来。</td></tr>';

    /* v75（老板）：「征召大厅的招募界面大一点，尽量所有候选都能在同一页」
       「地下的各资质四维，成长和概率也不显示」——
       ① 改走三段式（v19 的 m-head / m-body / m-foot）：标题与按钮固定，只有候选区滚动
          （旧版「列表 414px 上限 + 面板滚动」两道滚动条并存，这里收敛成一处）；
       ② 尺寸用新档 xxl（980×800）：候选行紧凑单行（36px），14 位（征召大厅 Lv12 + 专精 2）
          与 16 位（聚落上限）真机一页装下；
       ③ 资质一览（rk-box / rankTable）整块退役。 */
    ui.openShell({
      /* v89.136（清单①）：逐秒刷新（候选/空位/刷新次数实时） */
      live: function () { ui.openInn(); },
      title: '🍶 征召大厅 · Lv' + lv,
      sub: '每级 1 位候选　|　' + U.escape(city.name) + ' 英雄枢纽空位 ' + usedIn + '/' + cap +
        '　|　' + leftTxt,
      body:
        (chk.ok ? '' : '<div class="note-warn">' + U.escape(chk.msg) + (slotGuide ? '　·　' + slotGuide : '') + '</div>') +
        /* v89.73（老板）：自动招募条**从征召大厅搬到「自动」菜单** —— 见 ui.autoRecruitHTML。
           征召大厅只管"这一批候选、招谁"，挂机自动化统一归「自动」页。 */
        /* v80（老板）：「招募界面的表格行宽相对固定，根据字串长度搞个适合的固定表，
           在换人时框架不动，只有英雄信息变动」——colgroup + table-layout: fixed，
           列宽只认表头这一次声明，换批只动内容（列宽表在 index.html 的 .inn-tbl 段）。 */
        '<table class="tbl inn-tbl"><colgroup>' +
          '<col class="c-name"><col class="c-lv"><col class="c-rank"><col class="c-style">' +
          '<col class="c-attr"><col class="c-attr"><col class="c-attr"><col class="c-attr">' +
          '<col class="c-salary"><col class="c-act"></colgroup>' +
          '<thead><tr>' +
          '<th>英雄</th><th class="ctr">等级</th><th class="ctr">资质</th><th class="ctr">专长</th>' +
          '<th class="num">指挥</th><th class="num">治理</th><th class="num">武力</th><th class="num">谋略</th>' +
          '<th class="num">月俸</th><th class="ctr">招募</th></tr></thead><tbody>' + rows + '</tbody></table>',
      foot: '<div class="m-foot">' +
        '<button class="btn sm" data-action="inn-reroll">另请一批（' + U.fmt(GAME.innRefreshCost()) + ' 旧币）</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      size: 'xxl'
    });
  };

  /* ================= 交易站：4 资源 ↔ 旧币（v89.60 单块重做） =================
     老板：「交易站的界面太杂了，4资源+旧币可买卖就行，没必要分成 3 个板块」。
     旧版三块（① 资源互换 ② 售卖换旧币 ③ 旧币换物资）合并为**一张表**：
       · 每行一个资源：库存 / 卖出（每千得旧币）/ 买入（每千耗旧币）/ 行尾「卖出·买入」；
       · 旧币只作计价（顶栏一行显示），数量由**共用输入框**给出（单位 = 资源单位数）；
       · 比价与折损只在表下说明一次 —— 不再分散到三个板块各写一遍。
     **资源互换（粮→木）入口退役**：后端 GAME.marketTrade 保留（历史 API 与 smoke 覆盖），
     UI 不再暴露 —— 卖粮得旧币再买木，口径统一到这一张表里。
     口径**只读出口**：卖价 marketSellGold / 买价 marketBuyGoldFor，界面不自己算
     （"算第二遍"是本项目最经典的失效模式）。 */
  /* ⛔ v90.92 退役：ui.openSect（派系面板）整条删除 —— 老板「去掉门派」。
     原入口 = 建筑 honglusi 建筑面板的「⚔️ 派系」按钮（已从 BLDG_FUNC 摘除）。
     三种形态（未入派名录 / 已入派品阶声望任务 / 退派）随系统一并移除。 */

  /* v91.72（老板）：「交易数量在设定后买入或卖出后不要跳回 10 万」——
     数量框的值记在界面态 ui._mkAmount（不落存档），面板每次重建都回填它。 */
  ui._mkAmount = 0;
  ui.mkAttach = function (root) {
    var inEl = (root || document).querySelector('#mk-amount');
    if (!inEl || inEl._mkBound) return;
    inEl._mkBound = true;
    var sync = function () {
      var v = Math.max(1, Math.floor(Number(inEl.value) || 0));
      if (v > 0) ui._mkAmount = v;
    };
    inEl.addEventListener('input', sync);
    inEl.addEventListener('change', sync);
  };
  ui.openMarket = function () {
    var s = GAME.state;
    var lv = GAME.marketLevel();
    /* v89.62（老板「交易站去除商队计数和限制，去除相应标注」）：
       · 撤掉"尚未建造交易站 → 直接挡在门外"这道门槛：**无交易站也能买卖**，只是折损最大
         （marketRate 的 0.6 底）；交易站等级的作用收敛为**只影响折损**。
       · 标题里的「（商队 N）」连同"商队"这个概念一并退场，改标**折损系数**。 */
    var rate = GAME.marketRate();
    var loss = Math.round((GAME.marketBuyCfg().loss || 0) * 100);
    var metaOf = function (k) {
      var m = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) m = r; });
      return m;
    };
    var rows = ['grain', 'wood', 'stone', 'iron'].map(function (k) {
      var meta = metaOf(k);
      return '<tr>' +
        '<td class="ms-name">' + (meta ? meta.icon + ' ' + meta.name : k) + '</td>' +
        '<td class="ms-stock">' + U.fmt(s.res[k] || 0) + '</td>' +
        '<td class="ms-gold">' + U.fmt(GAME.marketSellGold(k, 1000)) + '</td>' +
        '<td class="ms-cost">' + U.fmt(GAME.marketBuyGoldFor(k, 1000)) + '</td>' +
        '<td class="ms-act">' +
          '<button class="btn xs" data-action="market-sell" data-res="' + k + '">卖出</button>' +
          '<button class="btn xs" data-action="market-buy" data-res="' + k + '">买入</button>' +
        '</td>' +
      '</tr>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🏪 市集' + (lv > 0 ? ' · Lv' + lv : '') +
        '　<span style="font-size:var(--fs-sub);font-weight:400;color:var(--text-dim);">折损 ×' +
        rate.toFixed(2) + '</span></div>' +
      '<div class="res-line" style="margin-top:2px;border:none;"><span class="lbl">旧币</span><span class="val">💰 ' +
        U.fmt(s.res.gold || 0) + '</span></div>' +
      /* v89.95（A2/A3）：物多价贱 —— 今日已售/当前汇率/通商券免折额度 */
      '<div class="ms-note" style="margin-top:2px;">📉 ' + U.escape(GAME.mktSlipText ? GAME.mktSlipText() : '') + '</div>' +
      /* v89.100：资源表专属 class（ms-res-table）—— 市集里新增"寄售"表后，
         e2e 的"四行表"判据必须能精确选中资源表（数 .ms-table 会把寄售表也算进去）。 */
      '<table class="ms-table ms-res-table"><thead><tr>' +
        '<th>资源</th><th>库存</th><th>卖出·每千得旧币</th><th>买入·每千耗旧币</th><th>交易</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="mk-row"><input type="number" id="mk-amount" min="1" value="' +
        (ui._mkAmount && ui._mkAmount > 0 ? ui._mkAmount : 100000) + '" placeholder="数量" data-persist="mk">' +
        '<span class="mk-hint">交易数量（资源单位）</span></div>' +
      /* v89.62（老板「买卖数量以 10万，百万，千万，亿量级加减」）：
         四档量级一键设定 + ÷10 / ×10 两键按量级增减；数量框仍可直接手填（两条路并存）。 */
      '<div class="mk-presets">' +
        [[100000, '10 万'], [1000000, '百万'], [10000000, '千万'], [100000000, '亿']].map(function (m) {
          return '<button class="btn sm" data-action="mk-preset" data-target="mk-amount" data-v="' + m[0] + '">' + m[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div class="mk-presets" style="margin-top:4px;">' +
        '<button class="btn sm" data-action="mk-scale" data-target="mk-amount" data-v="0.1">− 10 倍</button>' +
        '<button class="btn sm" data-action="mk-scale" data-target="mk-amount" data-v="10">+ 10 倍</button>' +
      '</div>' +
      /* v89.105：比价细则原为两行（38px）—— 市集是"两段表格"的大面板，
         多这两行就到不了头。压成一行摘要，细则挂标题旁的 ?（信息一字不删）。 */
      '<div class="ms-note">比价 <b>净水 1 : 生物质 2 : 电能 3 : 废钢 4</b>（净水最便宜）' +
        ui.help('卖出折损后系数 ×' + rate.toFixed(2) + '（交易站等级越高折损越小）\n'
          + '买入再扣 ' + loss + '%（旧币 → 物资吃亏，城市间运输更划算，交易站只作应急）'
          + (lv > 0 ? '' : '\n未建交易站：折损最大，建交易站可提高折损系数')) + '</div>' +
      /* v89.100：寄售战利品（按购买价 75% 回收）—— 价/校验全走 systems.consign* 出口 */
      (function () {
        var list = (GAME.systems.consignList ? GAME.systems.consignList() : []);
        if (!list.length) return '';
        /* v89.105：原列 12 种（表高 230px）—— 12 行 + 两段表把市集顶出窗外。
           收到 8 种（154px）：按价值降序，前 8 种已覆盖绝大部分可得旧币；
           真要全卖有「一键寄售全部」，能力不减，只少占版面。 */
        var top = list.slice(0, 8);
        var sumAll = 0;
        list.forEach(function (x) { sumAll += x.total; });
        return '<div class="gold-heading" style="margin-top:10px;">🎒 寄售战利品' +
            '　<span style="font-size:var(--fs-sub);font-weight:400;color:var(--text-dim);">按购买价 75% 回收</span></div>' +
          '<table class="ms-table"><thead><tr><th>道具</th><th>持有</th><th>单价</th><th>全卖得旧币</th><th></th></tr></thead><tbody>' +
          top.map(function (x) {
            return '<tr><td class="ms-name">' + U.escape(x.name) + '</td>' +
              '<td class="ms-stock">' + U.fmt(x.qty) + '</td>' +
              '<td class="ms-gold">' + U.fmt(x.unit) + '</td>' +
              '<td class="ms-gold">' + U.fmt(x.total) + '</td>' +
              '<td class="ms-act"><button class="btn xs gold" data-action="consign-sell" data-item="' + x.id + '">寄售</button></td></tr>';
          }).join('') +
          '</tbody></table>' +
          (list.length > 8 ? '<div class="ms-note">…按价值列前 8 种（共 ' + list.length + ' 种，可一键全售）</div>' : '') +
          /* v89.105：按钮行贴紧它作用的那张表（间距 6→2）—— 合"邻近原则"，也收回最后 4px */
          '<div class="mk-presets" style="margin-top:2px;">' +
            '<button class="btn sm gold" data-action="consign-all">一键寄售全部（共得 ' + U.fmt(sumAll) + ' 旧币）</button>' +
          '</div>' +
          '<div class="ms-note">装备请用「拆解」回收材料；血清 / 辐能核心无购买价，不参与寄售。</div>';
      })() +
      '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.105：内容实测 786px（两段表格纵向叠放）—— lg(600) 装不下、xl(700) 差 90、
         xxl(800) 才容得下。选档依据写在 docs/v89105（v89.236 已清理），改内容时**重新量**再选档。
         v89.136（清单①）：live 逐秒刷新（报价 / 折损 / 库存随交易即时变）。 */
      { size: 'xxl', live: function () { ui.openMarket(); } }
    );
    ui.mkAttach(document);
  };


  /* ================= 战储仓：储量上限 ================= */
  ui.openStore = function () {
    var s = GAME.state;
    /* v89.158（老板 1）：口径统一 —— ① 等级取**等级和**（多仓叠加才是容量口径；
       改前 buildingLevel 只给"最高一座"，2 座 Lv1 显示 Lv1 而容量按 2 级算，两把尺）；
       ② "基础储量"拆账（不再把城外堆场算进"基础"）；③ 标题按有无战储仓分形态。 */
    var sp = GAME.storePartsOf(GAME.currentCity());
    var lv = sp.lv;
    /* v89.212（老板 1）：堆场按资源分账 —— 逐行上限取自己的 cap（不再有"全局 cap"）；
       空战储仓提示改为按资源列账（账目 = 基础 + 本类堆场，逐项自洽）。 */
    var _extParts212 = [];
    DATA.RESOURCES.forEach(function (r) {
      if (sp.extByRes && sp.extByRes[r.key] > 0) _extParts212.push(r.name + ' +' + U.fmt(sp.extByRes[r.key]));
    });
    var near = lv > 0 ? '' : ('<div class="note-warn">未建战储仓：仅保有基础储量 ' + U.fmt(sp.base)
      + (_extParts212.length ? ('；城外堆场按资源分账：' + _extParts212.join(' · ')) : '')
      + '（超出部分将停止增长）</div>');
    /* v89.160（老板 1）：逾溢折损（唯一出口 GAME.overflowRotOf / DATA.OVERFLOW）——
       涨不动就罢了，超出上限的部分还会被"天灾"慢慢吃掉：规则与**当前超出量**写在这里。 */
    var _C160 = DATA.OVERFLOW || {};
    var _rotEx160 = GAME.overflowRotOf(GAME.currentCity()).reduce(function (t, x) { return t + x.excess; }, 0);
    var rotNote = '<div class="note-warn" style="margin-top:6px;">⚠️ 逾溢折损：超出仓容上限的部分，每 '
      + ((_C160.periodGameHours || 24) / 24) + ' 游戏日（现实约 ' + ui.rotPeriodRealText() + '）折损 ' + Math.round((_C160.ratio == null ? 0.25 : _C160.ratio) * 100) + '%'
      + '（' + ((_C160.events || []).map(function (e) { return e.name; }).join(' / ')) + '）'
      + '　·　当前超出上限：<b>' + (_rotEx160 > 0 ? U.fmt(_rotEx160) : '无') + '</b></div>';
    /* v91.72（老板）：空间压缩 —— 每 500 万物资 = 1 份压缩物资（入背包），压缩后释放等量城储。
       行尾给「压缩」按钮；背包里的压缩物资可在战储仓顺手解压（仓容不足会拒绝）。 */
    var _CMP = GAME.resCrateCfg();
    var _cmpAll = GAME.items.count('crate_grain') + GAME.items.count('crate_wood')
      + GAME.items.count('crate_stone') + GAME.items.count('crate_iron');
    var rows = ['grain', 'wood', 'stone', 'iron'].map(function (k) {
      var meta = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
      var v = s.res[k] || 0;
      /* v89.212（老板 1）：逐行用**本资源自己的**上限（战储仓 base + 本类地块堆场），悬停给分解 */
      var capK = (sp.capByRes && sp.capByRes[k] != null) ? sp.capByRes[k] : sp.total;
      var exK = (sp.extByRes && sp.extByRes[k]) || 0;
      var pct = Math.min(100, Math.round(v / capK * 100));
      var cid = GAME.resCrateIdOf(k), cn = cid ? GAME.items.count(cid) : 0;
      var canN = Math.floor(v / _CMP.unit);
      var ctl = '<span class="store-cmp" style="display:flex;gap:4px;align-items:center;margin-left:8px;">' +
        '<button class="btn xs" data-action="store-compress-ask" data-res="' + k + '"' +
          (canN > 0 ? '' : ' disabled title="满 ' + U.fmt(_CMP.unit) + ' 才能压缩 1 份"') + '>压缩</button>' +
        (cn > 0 ? '<button class="btn xs" data-action="store-decompress" data-res="' + k +
          '" title="解压 1 份（' + U.fmt(_CMP.unit) + '）入本城，需仓容足够">解压 ×' + cn + '</button>' : '') +
        '</span>';
      return '<div class="store-row"><span class="lbl">' + (meta ? meta.icon + meta.name : k) + '</span>' +
        '<span class="prog" style="flex:1;margin:0 10px;"><i style="width:' + pct + '%' + (pct > 90 ? ';background:linear-gradient(90deg,#a33,#e66)' : '') + '"></i></span>' +
        '<span class="val">' + U.numHTML(v, 0) + ' <span class="cap" title="战储仓 ' + U.fmt(sp.base)
          + (exK > 0 ? (' + 城外堆场 ' + U.fmt(exK)) : '') + '">/ ' + U.numText(capK, 0) + '</span></span>' +
        ctl + '</div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🏚️ 战储仓 · ' + (lv > 0 ? ('Lv' + lv + '（多仓叠加）') : '未建') + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:8px;">每级 +' + U.fmt(GAME.DATA.BASE_STORE || 2000000) + ' 储量上限</div>' +
      near + rotNote + rows +
      '<div class="note" style="margin-top:8px;">🗜️ 空间压缩：每 <b>' + U.fmt(_CMP.unit) +
        '</b> 物资可压缩为 1 份对应压缩物资（入背包，不占仓容）；解压回城需仓容足够。' +
        '背包中现有压缩物资 <b>' + _cmpAll + '</b> 份。</div>' +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>'
    );
  };
  ui.openItemSellAsk = function (itemId) {
    var s = GAME.state, item = GAME.systems.itemInfo(itemId);
    if (!item) { ui.toast('未知道具'); return; }
    var n = (s.items || {})[itemId] || 0;
    var unit = GAME.systems.consignPriceOf(itemId);
    if (!(n > 0) || !(unit > 0)) { ui.toast('「' + item.name + '」不可寄售'); return; }
    ui.openShell({
      title: '💰 寄售 · ' + U.escape(item.name),
      size: 'sm',
      body: '<div class="attr"><span class="k">持有</span><span class="v">' + U.numText(n, 0) + ' 件</span></div>' +
        '<div class="attr"><span class="k">回收价</span><span class="v">' + U.fmt(unit) + ' 旧币 / 件（购买价 75%）</span></div>' +
        '<div class="op-zone" style="margin-top:10px;"><div class="op-row">' +
          ui.qtyInput('sell-q', 1, unit, n) +
          '<span class="op-hint">只卖这一种；一次卖一件或多件</span>' +
        '</div></div>',
      foot: '<div class="m-foot"><button class="btn gold" data-action="item-sell-do" data-item="' + itemId + '">确认寄售</button>' +
        '<button class="btn" data-action="consign-sell" data-item="' + itemId + '">全部寄售</button></div>'
    });
  };
  /* 压缩份数确认小窗（默认 1 份；输入框可改） */
  ui.openCompressAsk = function (key) {
    var city = GAME.currentCity();
    if (!city) return;
    var cfg = GAME.resCrateCfg(), maxN = GAME.resCrateLeftOf(city, key);
    var meta = null; DATA.RESOURCES.forEach(function (r) { if (r.key === key) meta = r; });
    var cid = GAME.resCrateIdOf(key);
    var cName = ((DATA.ITEM_BY_ID || {})[cid] || {}).name || '压缩物资';
    ui.openShell({
      title: '🗜️ 压缩 ' + ((meta && meta.name) || key),
      size: 'sm',
      body: '<div class="attr"><span class="k">当前库存</span><span class="v">' +
          U.numText((GAME.res(city) || {})[key] || 0, 0) + '</span></div>' +
        '<div class="attr"><span class="k">可压缩</span><span class="v good">' + maxN + ' 份（每份 ' +
          U.fmt(cfg.unit) + '）</span></div>' +
        '<div class="attr"><span class="k">产物</span><span class="v">' + U.escape(cName) + ' ×N</span></div>' +
        '<div class="op-zone" style="margin-top:10px;"><div class="op-row">' +
          ui.qtyInput('cmp-q', Math.max(1, Math.min(maxN, 1)), 0, Math.max(1, maxN)) +
          '<span class="op-hint">压缩后等量释放城市储量；解压需仓容足够</span>' +
        '</div></div>',
      foot: '<div class="m-foot"><button class="btn gold" data-action="store-compress-do" data-res="' + key +
        '">确认压缩</button></div>'
    });
  };

  /* ================= 英雄资质徽章 ================= */
  ui.rankBadge = function (gen) {
    var rk = GAME.rankOf(gen);
    if (!rk) return '';
    var style = '';
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === gen.style) style = x.name; });
    /* v75（老板）：「成长 +2/级这个备注也去掉，改成鼠标悬停在资质上时浮现备注」——
       成长备注收进徽章悬停（desc 里本就有等级上限）；英雄清单 / 派遣 / 解雇弹窗同步受益。 */
    /* v89.188（老板 4）：「为资质的星号留 5 个型号的位置」——星号区以**透明星补位**到
       恒 5 星宽（.rpad），任何资质 / 任何星数下后续要素（风格名 / 忠于…）横位一致。 */
    var starN = rk.star || 0;
    return '<span class="rank-badge r-' + rk.id + '" title="' + U.escape(rk.desc || '') +
      '每级属性成长 +' + rk.grow + '。">' +
      rk.name + ' <span class="rstar">' + '★'.repeat(starN) +
      (starN < 5 ? '<i class="rpad">' + '★'.repeat(5 - starN) + '</i>' : '') + '</span>' +
      (style ? ' · ' + style : '') + '</span>';
  };

  /* v75（老板）：「地下的各资质四维，成长和概率也不显示」——
     资质一览（ui.rankTable / .rk-box）整块退役：候选行的资质徽章 + 悬停备注已够用。 */

  /* ================= 英雄枢纽：英雄名录 ================= */
  /* ============================================================
   * 英雄枢纽（v29 · 需求 15）
   * ------------------------------------------------------------
   * 改前：这里是**英雄名录** —— 与顶栏「英雄」菜单一字不差地重复一份。
   * 同一份数据摆两个入口，代价是"改了一处忘另一处"（两边的排序、分页、
   * 忠诚告警都要各维护一遍），收益为零。
   * 现在英雄枢纽只讲它**自己**负责的事：房间数（英雄容量）、建筑专精、
   * 缺房时该怎么办。要看谁在帐下 → 去「英雄」菜单。
   * ============================================================ */
  /* ============================================================
   * v89.132（老板「节钺设计再开拓一下」）：节钺专属面板 ——
   * 「余额 · 来源 · 四种用途 · 全境扩编进度」一屏说完。
   * 数字一律读唯一出口（jieyueOf / jieyueExpandOf / DATA.JIEYUE），不抄文案。
   * ============================================================ */
  ui.openJieyue = function () {
    var s = GAME.state;
    var C = DATA.JIEYUE || {};
    var kinds = ['city', 'xc', 'gen'];
    var used = 0, max = 0;
    (s.cities || []).forEach(function (c) {
      kinds.forEach(function (k) {
        var st = GAME.jieyueExpandOf(c, k);
        used += st.used; max += st.max;
      });
    });
    var man = C.byTier || {};
    var rankN = Math.floor(((DATA.RANK || []).length - 1) / (C.rankEvery || 4));
    var body =
      '<div class="res-line"><span class="lbl">余额</span><span class="val">' + (C.icon || '🪓') +
        ' ×<b>' + GAME.jieyueOf() + '</b> 枚</span></div>' +
      '<div class="note">旧币买不到的「开门」资源 —— 不解锁强度，只解锁「再往上走」的资格：' +
        '顶档资质、编制扩张，都要它放行。</div>' +
      '<div class="gold-heading" style="margin-top:10px;">🪙 获得（只能打出来 / 赐下来）</div>' +
      '<div class="res-line"><span class="lbl">首占名城</span><span class="val">聚落 +' +
        (man.county || 1) + ' · 重镇 +' + (man.jun || 2) + ' · 首府 +' + (man.zhou || 3) + ' · 旧都 +' +
        (man.capital || 5) + '　（同一座城只算一次）</span></div>' +
      '<div class="res-line"><span class="lbl">威望赏赐</span><span class="val">每 ' +
        (C.rankEvery || 4) + ' 档 +1（共 ' + rankN + ' 枚）</span></div>' +
      '<div class="gold-heading" style="margin-top:10px;">🛠️ 用途</div>' +
      '<div class="res-line"><span class="lbl">① 问鼎天启体</span><span class="val">1 枚 / 将 —— 觉醒体 → 天启体（英雄面板 · 资质晋升）</span></div>' +
      '<div class="res-line"><span class="lbl">② 城建扩编</span><span class="val">1 枚 / 次 —— 建造位 +1（城市面板 · 每城 ≤' + (C.citySlotMax || 2) + ' 次）</span></div>' +
      '<div class="res-line"><span class="lbl">③ 练兵场扩编</span><span class="val">1 枚 / 次 —— 出征容量 +1 万人马（练兵场面板 · 每城 ≤' + (C.xcMax || 2) + ' 次）</span></div>' +
      '<div class="res-line"><span class="lbl">④ 招揽人才</span><span class="val">1 枚 / 次 —— 英雄席位 +1（英雄枢纽面板 · 每城 ≤' + (C.genMax || 2) + ' 次）</span></div>' +
      '<div class="res-line"><span class="lbl">全境扩编</span><span class="val">已用 ' + used + ' / 上限 ' + max + ' 次</span></div>';
    ui.openShell({
      title: (C.icon || '🪓') + ' 节钺',
      sub: '现有 ' + GAME.jieyueOf() + ' 枚 · 全境扩编 ' + used + '/' + max,
      size: 'sm',
      body: body
    });
  };

  ui.openHostel = function () {
    var s = GAME.state;
    var c = GAME.currentCity();
    var lv = GAME.buildingLevel(c, 'zhaoxianguan') || 0;
    /* v64：席位是**这座城**的（`genSlotsOf`），在册人数也是**这座城**的 */
    var cap = GAME.genSlotsOf(c);
    var used = GAME.generalsIn(c).length;
    var mTier137 = GAME.masteryTierOf ? GAME.masteryTierOf(c, 'zhaoxianguan') : 0;   /* v89.137：三档 */
    var maxLv = GAME.buildCapOf(c, 'zhaoxianguan');           /* v54：名城上限更高 */
    var full = used >= cap;
    var zIdx = -1;
    (c.cells || []).forEach(function (x, i) {
      if (zIdx < 0 && x.build && x.build.id === 'zhaoxianguan') zIdx = i;
    });
    var body =
      '<div class="attr"><span class="k">房间（本城英雄席位）</span><span class="v">' +
        '<b style="color:' + (full ? 'var(--amber)' : 'var(--green-ok)') + ';font-variant-numeric:tabular-nums;">' +
        used + '</b> / ' + cap + '</span></div>' +
      '<div class="attr"><span class="k">本馆等级</span><span class="v">Lv' + lv + ' / ' + maxLv + '</span></div>' +
      '<div class="attr"><span class="k">每级房间</span><span class="v">+1 席</span></div>' +
      /* v89.132（老板「节钺设计再开拓一下」）：节钺 · 招揽人才入口（唯一落点 = 英雄枢纽面板） */
      '<div class="auto-line"><button class="btn" data-action="jieyue-gen" data-city="' + c.id +
        '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
          + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺 · 招揽人才（' +
        (function () {
          var jg = GAME.jieyueExpandOf(c, 'gen');
          return (jg.used >= jg.max)
            ? '本城已满 ' + jg.used + '/' + jg.max
            : '本城 ' + jg.used + '/' + jg.max + '　持符 ' + GAME.jieyueOf();
        })() + '）</button>' +
        '<span class="ui-sub">英雄席位 +1（至多 ' + ((DATA.JIEYUE || {}).genMax || 2) + ' 次）</span></div>' +
      (mTier137 > 0
        ? '<div class="attr"><span class="k">建筑专精</span><span class="v good">房间 +' + (2 * mTier137)
          + '<span style="color:var(--text-dim);">（每档 +2 · 现 ×' + mTier137 + ' 档）</span></span></div>'
        : '<div class="attr"><span class="k">建筑专精</span><span class="v" style="color:var(--text-dim);">'
          + 'Lv' + ((DATA.MASTERY_TIERS || [12])[0]) + ' 起：房间 +2（每档 +2）</span></div>') +
      '<div class="attr"><span class="k">全境席位</span><span class="v">' +
        GAME.generalsIn(c).length + ' / ' + cap + '　（各城合计 ' + GAME.genSlotsTotal() + ' 席）</span></div>' +
      '<div class="note" style="margin-top:10px;">英雄枢纽决定<b>本城能容纳多少英雄</b>；' +
        (full
          ? '现已满员，<b>升级英雄枢纽</b>才能继续招募新将，或把英雄派往他城。'
          : '尚有空位，可去<b>征召大厅</b>招募新将，也可从别城<b>派遣</b>过来。') +
        '<br>席位**按城**计：每座城的英雄枢纽只管自己这座城的人。名录见顶栏「英雄」菜单。</div>' +
      (full && lv < maxLv && zIdx >= 0
        ? '<div style="text-align:center;margin-top:12px;">' +
            /* 走既有的 confirm-upgrade —— 升级只认「当前城市的格位序号」，
               所以这里必须现算英雄枢纽在第几格，不能凭"建筑 id"假设点得到。 */
            '<button class="btn gold" data-action="confirm-upgrade" data-idx="' + zIdx +
            '">升级英雄枢纽 → Lv' + (lv + 1) + '</button></div>'
        : '');
    ui.openShell({
      title: '🎎 英雄枢纽 · Lv' + lv,
      sub: '本城席位 ' + used + ' / ' + cap,
      /* v89.141（复核修复）：sm(433×414) 在基准态溢出 4px；更糟的是"满员可升级"
         分支还要再加一行升级按钮（≈ +42px）→ 那个分支会溢出 ~46px。
         升 md(660×620)：所有分支（含升级按钮）都在框内，长 note 也更舒展。 */
      size: 'md',
      body: body,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ================= 制造厂 · 打造 ================= */
  /* ============================================================
   * v90.97（老板）**行政大菜单**（顶栏「军务」右侧）
   * ------------------------------------------------------------
   * 左 1/4：星球→城市 **分级树**（默认只列星球，点星球展开其下辖城市）。
   * 右 3/4：选中城市的**只读总览** —— 据点 / 占领野地 / 管理英雄 / 在建建筑 /
   *         招募队列 / 研究中科技（只监控，不在此操作；操作仍回各专页）。
   * 数据出口：星球 = GAME.planetsOf / GAME.mapSliceOf（SSOT）；英雄 = GAME.generalsIn。
   * ============================================================ */
  ui.adminHTML = function () {
    var s = GAME.state;
    var open = ui._admOpen = ui._admOpen || {};      /* {pid:true} 展开的星球 */
    var planets = GAME.planetsOf ? GAME.planetsOf() : [];
    function sliceOf(pid) { return (GAME.sliceOf ? GAME.sliceOf(pid) : null) || { cities: [], wilds: [], forts: {}, queues: { build: [], train: [], tech: [] } }; }
    /* 默认选中：当前城（若属某星球）；否则首星球首城 */
    var cur = GAME.currentCity ? GAME.currentCity() : null;
    if (!ui._admSel) {
      if (cur) ui._admSel = { pid: (GAME.activePlanetOf && GAME.activePlanetOf() ? GAME.activePlanetOf().id : (s.activePlanet || 1)), cityId: cur.id };
      else { var p0 = planets[0]; var c0 = p0 ? (sliceOf(p0.id).cities || [])[0] : null; ui._admSel = p0 ? { pid: p0.id, cityId: c0 ? c0.id : null } : null; }
    }
    var sel = ui._admSel;

    /* ---------- 左：分级树 ---------- */
    var tree = planets.map(function (p) {
      var sl = sliceOf(p.id), cities = sl.cities || [];
      var isOpen = !!open[p.id];
      var isCurPlanet = (GAME.activePlanetOf && GAME.activePlanetOf() && GAME.activePlanetOf().id === p.id);
      var head = '<div class="adm-node' + (isOpen ? ' open' : '') + '" data-action="adm-planet-toggle" data-pid="' + p.id + '" title="点开/收起该星球下辖城市">' +
        '<span class="adm-caret">' + (isOpen ? '▾' : '▸') + '</span>' +
        '<span class="adm-pname">' + (isCurPlanet ? '🪐 ' : '· ') + U.escape(p.name || ('星球 ' + p.id)) + '</span>' +
        /* v91.14（老板）：「星球可以命名」—— 星球名右侧加改名按钮（嵌套 data-action，点按钮不触发展开）。 */
        '<button class="btn xs adm-rename" data-action="adm-planet-rename" data-pid="' + p.id + '" title="给这颗星球命名">✎</button>' +
        '<span class="adm-n">' + cities.length + ' 城</span></div>';
      if (!isOpen) return head;
      var kids = cities.length ? cities.map(function (c) {
        var on = sel && sel.pid === p.id && sel.cityId === c.id;
        return '<div class="adm-city' + (on ? ' cur' : '') + '" data-action="adm-city-pick" data-pid="' + p.id + '" data-city="' + c.id + '" title="查看该城行政总览">' +
          U.escape(c.name || '城市') + ' <span class="adm-cmeta">' + (GAME.map.coordText ? GAME.map.coordText(c.x, c.y) : '') + '</span></div>';
      }).join('') : '<div class="adm-empty">— 无城 —</div>';
      return head + '<div class="adm-kids">' + kids + '</div>';
    }).join('');

    /* ---------- 右：只读总览 ---------- */
    var detail;
    if (!sel) detail = '<div class="adm-empty">暂无星球</div>';
    else {
      var sl2 = sliceOf(sel.pid);
      var city = null;
      (sl2.cities || []).forEach(function (c) { if (c.id === sel.cityId) city = c; });
      if (!city) detail = '<div class="adm-empty">请选择一座城市</div>';
      else detail = ui._admDetailHTML(sl2, city, sel.pid);
    }
    return '<div class="ui-page"><div class="gold-heading">🏛 行政' +
        ui.help('左栏按「星球 → 城市」分级——默认只列星球，点星球展开其下辖城市。\n' +
          '选中城市后，右栏：**左列选分类**（管理英雄 / 据点 / 野地 / 在建 / 招募 / 研究…），**右侧看该分类的列表**（只读总览）。\n' +
          '这里只做监控：具体操作仍在「城市 / 军务 / 英雄 / 地图」各页。') +
      '</div>' +
      ui.factionBarHTML() +
      '<div class="adm-split">' +
        '<div class="adm-tree">' + (tree || '<div class="adm-empty">暂无星球</div>') + '</div>' +
        '<div class="adm-detail">' + detail + '</div>' +
      '</div></div>';
  };

  /* ============================================================
   * v92.5：四方势力态势条（行政页顶部 · 与「星球→城市」树并列展示）
   * ------------------------------------------------------------
   * 世界现在只有玩家会动 —— 这一条就是"别人也在动"的证据。
   * ⚠️ 只报态势，不报战力：介入战斗之前，任何"他们会来打你"的暗示都是假的。
   * ============================================================ */
  /* ============================================================
   * v94.1：世界的账本（六层世界最小可运行版的唯一界面）
   * ------------------------------------------------------------
   * 为什么单独一个面板而不是塞进城建面板：
   *   这六件事**没有一件是"这座城的事"** —— 温度是全国的天，辐射云是全图的圈，
   *   污染是工业的账，竞争者是别人的脚步，补给是地图的连通，残页是旧世界的碎片。
   *   它们共同回答一个问题：**这个世界在我之外，正在发生什么。**
   * ============================================================ */
  ui.openWorldPanel = function () {
    var s = GAME.state;
    if (!s) { ui.toast('无存档'); return; }
    var h = '';
    /* ============================================================
     * v133（逐屏核查 v129 记的账，本轮补上）：**每节改成可折叠**。
     * ------------------------------------------------------------
     * 实测：`.m-body` 内容高 2481px、可视 513px —— **溢出 1968px 还带滚动条**，
     * 违反本项目"弹窗里不许滚动条"的铁律（v129 逐屏核查记的就是这条）。
     * 六条线（温度/辐射云/污染/竞争者/补给/残页）全有数据时必然撑爆。
     * 改法：标题行常驻 + **一行摘要**（收起时也看得到大意），明细默认收起。
     * 走现成的 `fold-toggle` + `ui._foldOpen`（弹窗有 live 回调，会就地重绘）。
     * 默认收起是刻意的：这页是"看状态"，一屏扫完六条比逐条滚动强。
     * ============================================================ */
    /* v150（P0-1）：第 4 参 `need` = 该节需要的阶段（'mid'/'late'）。
       early 期不放行的节**不消失**，而是折成一条灰行 —— 让玩家知道"还有东西在后面"，
       又不把 12 条信息一次砸在脸上（"空屏"和"菜单墙"两头都不好）。 */
    var sec = function (title, line, extra, need) {
      /* v149（实机自检）：每节右上角给一个「去办」入口 —— 之前"账本说得出问题，
         但每一条都要玩家自己去别的菜单里找得到地方处理"（截图确认：一屏 20 条，0 个可点去处）。
         入口按关键词落到既有页面，不新造功能。 */
      var gotoOf = function (t) {
        /* v151（老板「账本说得出问题，但每一条都要自己去菜单里找地方处理」）：
           **本节自己有处理按钮的，就不跳走** —— 直接"展开这一节"（见下面 gotoChip）。
           真没有动作的，才路由到对应视图/弹窗（顺序：具体优先于大类）。 */
        var map = [
          [/集市|交易/, 'open-market'],
          [/废墟|残页|地下|远行|奇观/, 'map'],
          [/兵源|人从哪来|老兵|兵员|作战目标|护送|斩首|惰性|懒|怠/, 'marches'],
          [/竞争|势力|宣战|传闻|世界里|年景|年成|历法/, 'admin'],
          [/温度|辐射云|污染|领土|暴露|危险梯度/, 'map']
        ];
        for (var i = 0; i < map.length; i++) if (map[i][0].test(t || '')) return map[i][1];
        return null;
      };
      var fkey = 'world|' + title;
      /* 阶段门控：需要更高阶段而当前不够 → 灰行（可点，点了只说还差什么） */
      if (need && ui.gatedOut(need, title)) {
        return '<div style="border-bottom:1px dashed var(--wood-light);">'
          + '<div style="padding:4px 0;display:flex;align-items:baseline;gap:7px;opacity:.55;">'
          + '<span style="font-size:var(--fs-cap);color:var(--text-dim);font-weight:700;white-space:nowrap;">'
          + '🔒 ' + title + '</span>'
          + '<span style="font-size:var(--fs-cap);opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">'
          + U.escape(ui.gateWhyText(title)) + '</span>'
          + '</div></div>';
      }
      var open = !!ui._foldOpen[fkey];
      var goView = gotoOf(title);
      var brief = String(line || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return '<div style="border-bottom:1px dashed var(--wood-light);">'
        + '<div class="op-zone-t" data-action="fold-toggle" data-fold="' + U.escape(fkey) + '"'
        + ' style="cursor:pointer;user-select:none;padding:4px 0;display:flex;align-items:baseline;gap:7px;">'
        + '<span style="font-size:var(--fs-cap);color:var(--gold-light);font-weight:700;white-space:nowrap;">'
        + (open ? '▾ ' : '▸ ') + title + '</span>'
        + (open ? '' : '<span style="font-size:var(--fs-cap);opacity:.72;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">'
            + U.escape(brief) + (brief.length >= 40 ? '…' : '') + '</span>')
        /* v151：本节**自带处理按钮**的，就不把人支走 —— 点一下就地展开，按钮就在眼前。
           只有本节真没有动作时，才给「去办 →」跳到对应视图。 */
        + ((String(extra || '').indexOf('data-action=') >= 0)
          ? '<span data-action="fold-toggle" data-fold="' + U.escape(fkey) + '" data-force="1"'
            + ' title="就地展开这一节的处理按钮"'
            + ' style="margin-left:auto;cursor:pointer;font-size:var(--fs-cap);color:var(--green-ok);'
            + 'border:1px solid rgba(var(--green-ok-rgb),.4);border-radius:var(--r-sm);padding:0 6px;white-space:nowrap;">'
            + (open ? '收起 ▴' : '展开处理 →') + '</span>'
          : (goView ? '<span data-action="hint-go" data-view="' + goView + '" title="去处理这一条"'
            + ' style="margin-left:auto;cursor:pointer;font-size:var(--fs-cap);color:var(--gold-light);'
            + 'border:1px solid rgba(var(--gold-rgb),.35);border-radius:var(--r-sm);padding:0 6px;white-space:nowrap;">去办 →</span>' : ''))
        + '</div>'
        + (open ? '<div style="padding:0 0 8px;">'
            + '<div style="font-size:var(--fs-cap);line-height:1.75;">' + (line || '') + '</div>'
            + (extra || '') + '</div>' : '')
        + '</div>';
    };
    var cities = (GAME.city && GAME.city.all) ? GAME.city.all() : [];

    /* ---------- 温度 ---------- */
    if (GAME.climate) {
      var CL = GAME.climate;
      h += sec('🌡 温度', CL.lineOf(),
        '<div class="chips" style="margin-top:5px;">' + cities.map(function (c) {
          var warm = CL.isWarm(c);
          return '<span class="chip' + (warm ? ' dim' : '') + '"'
            + (warm ? '' : ' data-action="world-warm" data-cid="' + U.escape(c.id) + '"')
            + '>' + U.escape(c.name) + (warm ? ' · 这个月烧上了' : ' · 烧柴 ' + U.numText(CL.fuelCostOf(c), 0) + ' 木')
            + '</span>';
        }).join('') + '</div>');
    }

    /* ---------- 辐射云（v144.4：给云里的城一个真入口 —— 迁址） ---------- */
    if (GAME.surge) {
      var _cloudCities = cities.filter(function (c) { return GAME.surge.cityInCloud(c); });
      var _cloudAct = _cloudCities.length
        ? '<div class="chips" style="margin-top:5px;">' + _cloudCities.map(function (c) {
          var mv = GAME.isMovableCity && GAME.isMovableCity(c);
          return '<span class="chip' + (mv ? '' : ' dim') + '"' + (mv
            ? ' data-action="city-move-ask" data-city="' + U.escape(c.id) + '"'
            : ' title="名城地望固定，不可迁址"') + '>'
            + U.escape(c.name) + (mv ? ' · 迁出云外' : ' · 名城不可迁') + '</span>';
        }).join('') + '</div>'
        : '';
      h += sec('☁ 辐射云', GAME.surge.lineOf(),
        _cloudAct
        + '<div class="ui-sub" style="margin-top:3px;">圈心在你**开局时**那片地的重心，立城之后就不再移动（v157.41 修：原来每帧按城的重心算，永远追不上你）。半径按月往回收、每收 12 个月停 3 个月。'
        + '云里的城不会立刻崩，只是人会一点一点往圈里搬 —— 要不要把家搬进来，是你的决定。</div>');
    }

    /* ---------- 污染 ---------- */
    if (GAME.taint) {
      var TN = GAME.taint;
      h += sec('☢ 污染', TN.lineOf(),
        '<div class="chips" style="margin-top:5px;">' + cities.map(function (c) {
          var t = TN.of(c), lv = TN.levelOf(c);
          return '<span class="chip" data-action="world-clean" data-cid="' + U.escape(c.id) + '"'
            + ' title="净化一次：' + U.escape(JSON.stringify((GAME.DATA.TAINT || {}).cleanCost || {})) + '">'
            + U.escape(c.name) + ' · ' + Math.round(t) + '（' + lv.name + '）· 净化</span>';
        }).join('') + '</div>', 'mid');
    }

    /* ---------- 竞争者 ---------- */
    if (GAME.rival) {
      var RV = GAME.rival;
      RV.ensure();
      var live = RV.alive();
      var teamH = live.length ? live.map(function (t) {
        /* v98.1：把「他们正在朝哪走」写出来 —— 攻城前必须有这一段，
           否则玩家永远只会在被抢之后才知道有人来过。 */
        var aim = '';
        if (t.dest && t.dest.kind === 'city') {
          var tc = (GAME.city && GAME.city.byId) ? GAME.city.byId(t.dest.ci) : null;
          if (tc) aim = '<span style="color:var(--red-light);">　⚠ 正朝 ' + U.escape(tc.name) + ' 来</span>';
        } else if (t.dest && t.dest.kind === 'village') {
          aim = '<span style="color:var(--text-dim);">　→ 一处村社</span>';
        } else if (t.dest && t.dest.kind === 'ruin') {
          aim = '<span style="color:var(--text-dim);">　→ 一处遗迹</span>';
        }
        return '<div style="margin-top:4px;">🏴 <b>' + U.escape(t.name) + '</b>　约 '
          + U.numText(t.pop | 0, 0) + ' 人　已抢 ' + (t.claims | 0) + ' 处' + aim + '　'
          + '<button class="btn" style="font-size:var(--fs-cap);padding:0 6px;"'
          + ' data-action="world-drive" data-rid="' + U.escape(t.id) + '">驱赶</button></div>';
      }).join('') : '<div class="ui-sub">暂时没有他们的消息（都被赶散了）。</div>';
      h += sec('🏴 竞争者', '你之外，还有人在做同一件事：他们抢村子的人，抢遗迹里的东西。',
        teamH + '<div class="ui-sub" style="margin-top:3px;">驱赶要 300 兵、要在 8 格内 —— 赢了他们散掉，'
        + '人回附近的村子；输了折兵。他们不会灭，只会再拉一支。'
        + '人口过 ' + U.numText((GAME.DATA.RIVAL || {}).cityAtPop || 1200, 0)
        + ' 就会开始惦记你的城：城防 + 守军顶得住就打退他们，顶不住就抢走两成半库存、'
        + '打掉一成二守军（抢完 8 个月不再来）。</div>', 'mid');
    }

    /* ---------- 补给连通 ---------- */
    if (GAME.land) {
      h += sec('🛣 领土连通', GAME.land.lineOf(),
        '<div class="ui-sub" style="margin-top:3px;">按陆地走：只有从老家走得到的城才算"连着的"。'
        + '现在只算不罚（这一版先把地图算准，扣产出等下一版）。</div>', 'mid');
    }

    /* ---------- 废墟科技 ---------- */
    if (GAME.relic) {
      var TE = GAME.relic;
      var opts = TE.options();
      h += sec('📜 废墟科技',
        TE.lineOf() + '　<span style="color:var(--text-dim);">一共 6 条，一辈子只有 3 个位置</span>',
        '<div class="chips" style="margin-top:5px;">' + opts.map(function (o) {
          return '<span class="chip' + (o.ok ? '' : ' dim') + '"'
            + (o.ok ? ' data-action="relic-pick" data-tid="' + U.escape(o.id) + '"' : '')
            + ' title="' + U.escape(o.desc) + '">' + U.escape(o.name) + ' · ' + o.cost + ' 页'
            + (o.taken ? ' ✓' : (o.ok ? '' : '（' + U.escape(o.why) + '）')) + '</span>';
        }).join('') + '</div>'
        + '<div class="ui-sub" style="margin-top:3px;">残页只来自**你自己翻的**遗迹 —— 被竞争者抢先翻走的，'
        + '一张都不算。落定不能退。</div>', 'mid');
    }


    /* ============================================================
     * v95 · 玩法台：能按的东西都放这里
     * ------------------------------------------------------------
     * 老板：「要给玩家提供真实、可以开拓玩法的时间」。
     * 所以这一块不是"再读一遍数字"，是**按了会发生事**：
     * 治伤兵 / 安抚民怨 / 布置工事 / 派人下地 / 换牌 / 备指令。
     * ============================================================ */
    (function () {
      var c0 = (GAME.currentCity && GAME.currentCity()) || cities[0] || null;
      var cn = c0 ? U.escape(c0.name) : '—';

      /* v100：**注册表渲染** —— 兵源/兵员等级/惰性/世界形态四块由模块自己声明
         （见各模块末尾的 `GAME.reg.add`）。order 决定顺序：兵源 10 → 兵员 60 → 惰性 70 → 世界形态 90。 */
      /* v150（P0-1）：模块面板也按阶段门控 —— 给它们一个**包了门控的 sec**：
         达到阶段用真的 sec，没到就返回一条灰行（模块自己不感知阶段，零改动）。 */
      var secG = function (title, line, extra) {
        var need = null;
        var list = ui.GATE_SEC || [];
        for (var gi = 0; gi < list.length; gi++) if (title.indexOf(list[gi][0]) >= 0) need = list[gi][1];
        /* 注册表模块按 id 门控（trooplv/idle/events/founding 是 mid，ending 是 late）——
           这里用标题反查不到 id，所以按标题前缀表补上 */
        var byTitle = { '🪖 兵员等级': 'mid', '🧠 惰性': 'mid', '🤝 遇到什么': 'mid',
          '🏯 该不该开一座城': 'mid', '🌗 世界形态': 'late' };
        for (var tk in byTitle) if (title.indexOf(tk) >= 0) need = byTitle[tk];
        return sec(title, line, extra, need);
      };
      h += GAME.reg.panels({ sec: secG, U: U, cities: cities, c0: c0,
        toast: ui.toast, refresh: function () { ui.openWorldPanel(); GAME.refreshView(); } });


      /* ① 作战目标（让"带多少兵"成为一个选择） */
      if (GAME.goals) {
        /* 四档的**战场修正**直接摊出来：玩家在出征前就该知道自己会变成什么样
           （攻高多少、防低多少、血薄多少），而不是打完才发现死得多。 */
        var tierH = ((GAME.DATA.GOALS || {}).tiers || []).map(function (t) {
          var m = t.mod || {};
          var bit = [];
          if (m.atk) bit.push('攻 ' + (m.atk > 0 ? '+' : '') + Math.round(m.atk * 100) + '%');
          if (m.def) bit.push('防 ' + (m.def > 0 ? '+' : '') + Math.round(m.def * 100) + '%');
          if (m.hp) bit.push('血 ' + (m.hp > 0 ? '+' : '') + Math.round(m.hp * 100) + '%');
          return '<div style="margin-top:3px;">🎯 <b>' + U.escape(t.name) + '</b>　'
            + U.escape(bit.length ? bit.join(' · ') : '无修正（稳推）')
            + '　<span style="color:var(--text-dim);">战利品 ×' + t.loot + '</span></div>';
        }).join('');
        h += sec('🎯 作战目标', GAME.goals.lineOf(),
          tierH + '<div class="ui-sub" style="margin-top:4px;">没有单独的下拉框 —— '
          + '**你带多少兵就决定了怎么打**：带满平推（稳），带少就自动变成斩首/奇袭'
          + '（攻更高、防更低、血更薄，但战利品翻倍）。'
          + '这一行不是说明，是战场上的真数值。</div>', 'mid');
      }

      /* ② 伤兵 / 老兵 */
      if (GAME.veteran) {
        var wl = GAME.veteran.totalWounded();
        h += sec('🩹 伤兵与老兵',
          '伤兵 <b>' + U.numText(wl, 0) + '</b> 人（每月自愈 10%）　'
          + (c0 ? ('老兵等级：' + Math.round(GAME.veteran.avgLvlOf(c0.id) * 10) / 10 + '/5') : ''),
          '<div class="chips" style="margin-top:5px;">'
          + (wl > 0 ? ('<span class="chip" data-action="vet-treat" data-cid="' + (c0 ? U.escape(c0.id) : '') + '">'
            + '花旧币治好 ' + U.numText(wl, 0) + ' 人</span>') : '')
          + '</div>'
          + '<div class="ui-sub" style="margin-top:3px;">伤兵是这一版唯一的「不可逆」：他们占着你的人，'
          + '要等十个月才好。以前这些人是直接死掉再 2 小时补满的。</div>', 'mid');
      }

      /* ③ 民怨 */
      if (GAME.unrest) {
        h += sec('🔥 民怨', GAME.unrest.lineOf() || '各城都还安稳',
          '<div class="chips" style="margin-top:5px;">' + cities.map(function (c) {
            var v = GAME.unrest.of(c);
            if (v < 30) return '';
            return '<span class="chip" data-action="unrest-calm" data-cid="' + U.escape(c.id) + '">'
              + U.escape(c.name) + ' · ' + v + '/100 · 安抚</span>';
          }).join('') + '</div>'
          + '<div class="ui-sub" style="margin-top:3px;">民心低于 55 就开始攒；攒满 100 会反：'
          + '库房被抢两成半、守军跑一成二。降税治本，安抚只压一阵。</div>', 'mid');
      }

      /* ④ 守城工事 + 破墙 */
      if (GAME.tower) {
        var worksH = cities.map(function (c) {
          return '<div style="margin-top:4px;">🏯 ' + U.escape(c.name) + '　'
            + GAME.tower.cityLine(c) + '　'
            + GAME.tower.kinds().map(function (k) {
              return '<button class="btn" style="font-size:var(--fs-cap);padding:0 5px;"'
                + ' data-action="works-build" data-cid="' + U.escape(c.id) + '" data-kind="' + k.id + '"'
                + ' title="' + U.escape(k.desc + ' · 城防 +' + k.def) + '">+' + U.escape(k.name) + '</button>';
            }).join('')
            + (c.wallBroken > 0 ? ('　<button class="btn" style="font-size:var(--fs-cap);padding:0 5px;"'
              + ' data-action="works-repair" data-cid="' + U.escape(c.id) + '">补墙</button>') : '')
            + '</div>';
        }).join('');
        h += sec('🏯 守城工事', '每城 3 个槽：炮塔 / 拒马 / 雷区，算进城防',
          worksH + '<div class="ui-sub" style="margin-top:3px;">攻不下来的城，墙会裂 22% —— '
          + '下个月再来就更好打。这就是两阶段攻城。</div>', 'mid');
      }

      /* ⑤ 地下远征 */
      if (GAME.delve) {
        var run = GAME.delve.runOf();
        var dh;
        if (run) {
          dh = '<div>第 <b>' + run.layer + '</b> 层　' + U.numText(run.troops, 0) + ' 人　'
            + '已带回粮 ' + U.numText(run.loot.grain, 0) + ' · 铁 ' + U.numText(run.loot.iron, 0) + '</div>'
            + '<div class="chips" style="margin-top:5px;">'
            + '<span class="chip" data-action="delve-push">再下一层</span>'
            + '<span class="chip" data-action="delve-retreat">收手上来（带走七成）</span></div>'
            + '<div class="ui-sub" style="margin-top:3px;">'
            + (run.log.slice(-2).map(function (x) { return U.escape(x.msg); }).join('<br>') || '还没推进')
            + '</div>';
        } else {
          dh = '<button class="btn" style="font-size:var(--fs-cap);padding:1px 8px;"'
            + ' data-action="delve-start" data-cid="' + (c0 ? U.escape(c0.id) : '') + '">'
            + '派 300 人下地（' + cn + '）</button>'
            + '<div class="ui-sub" style="margin-top:3px;">逐层推进，随时可撤。到底一次大丰收；'
            + '塌方会吞掉你已经拿到的东西。人是要留在地下的。</div>';
        }
        h += sec('🕳 地下远征', '五层，越深越肥，也越容易折人', dh, 'mid');
      }

      /* ⑥ 指令牌（8 选 5） */
      if (GAME.deck) {
        var cards = (GAME.DATA.DECK || {}).cards || [];
        /* v107（D3）：每张牌标出它要什么风格的将 —— 选牌时就要看得见，不是打完才知道 */
        var styleName107 = function (id) {
          var nm = '';
          ((GAME.DATA.GEN_STYLES) || []).forEach(function (s) { if (s.id === id) nm = s.name; });
          return nm;
        };
        h += sec('🃏 指令牌', GAME.deck.lineOf(),
          '<div class="chips" style="margin-top:5px;">' + cards.map(function (cd) {
            var on = GAME.deck.has(cd.id);
            return '<span class="chip' + (on ? '' : ' dim') + '" data-action="deck-toggle" data-card="' + cd.id + '"'
              + ' title="' + U.escape(cd.desc) + '">' + U.escape(cd.name)
              + (cd.style ? '<span class="ui-sub"> · ' + U.escape(styleName107(cd.style)) + '</span>' : '')
              + (on ? ' ✓' : '') + '</span>';
          }).join('') + '</div>'
          + '<div class="ui-sub" style="margin-top:3px;">只能带 ' + GAME.deck.pickLimit()
          + ' 张。<b>带队的将风格对不上的牌，这一仗打不出去</b>（均衡型的将什么牌都能打）。'
          + '狂怒那种"攻高但多死人"的牌，是你自己选的代价。</div>', 'mid');
      }

      /* ⑦ 套装指令 */
      if (GAME.setskill) {
        var un = GAME.setskill.unlockedOf();
        if (un.length) {
          h += sec('🧩 套装指令', '凑齐一套解锁一个能按的按钮，用完全进冷却',
            '<div class="chips" style="margin-top:5px;">' + un.map(function (x) {
              var armed = (GAME.setskill.activeOf() || {}).id === x.id;
              return '<span class="chip' + (x.cdLeft ? ' dim' : '') + '" data-action="skill-arm" data-sid="' + x.id + '"'
                + ' title="' + U.escape(x.desc) + '">' + U.escape(x.name)
                + '（' + x.tier + '件' + (x.cdLeft ? ' · 冷却 ' + x.cdLeft : '') + (armed ? ' · 已备' : '') + '）</span>';
            }).join('') + '</div>', 'mid');
        }
      }

      /* ⑧ 奇观归属 + 驻守（v98.4：占下来的东西得有人看着） */
      if (GAME.wonderwar) {
        var wl2 = GAME.wonderwar.lineOf();
        if (wl2) {
          var mineW = GAME.wonderwar.mineOf();
          var wH = mineW.map(function (w) {
            /* ⚠️ 这里原来写成 `w.0 || w.pid`（手滑），JS 把它解析成"数字 0 的属性"，
               竟然不报错但永远是 undefined —— 名字永远退成"奇观 N"。 */
            var nm = (GAME.wonderOf && GAME.wonderOf(w.pid))
              ? ((GAME.wonderOf(w.pid) || {}).name || ('奇观 ' + w.pid))
              : ('奇观 ' + w.pid);
            return '<div style="margin-top:4px;">☄ ' + U.escape(nm || ('奇观 ' + w.pid)) + '　驻守 '
              + U.numText(w.guard, 0) + ' 人　被夺概率 ÷' + (Math.round(w.factor * 100) / 100) + '　'
              + '<button class="btn" style="font-size:var(--fs-cap);padding:0 6px;"'
              + ' data-action="wonder-keep" data-pid="' + w.pid + '">派 500 人</button>'
              + (w.guard > 0 ? ('<button class="btn" style="font-size:var(--fs-cap);padding:0 6px;"'
                + ' data-action="wonder-pull" data-pid="' + w.pid + '">撤回</button>') : '')
              + '</div>';
          }).join('');
          h += sec('☄ 奇观', wl2, (wH ? wH + '<div class="ui-sub" style="margin-top:4px;">' : '')
            + '<div class="ui-sub" style="margin-top:3px;">打穿奇观就能占下，保护 6 个月；'
            + '之后声望越高越招人惦记。**派兵驻守能让被夺概率变低**（每 1000 人 ÷1.6），'
            + '但那些兵就不在城里了。</div>' + (wH ? '</div>' : ''), 'late');
        }
      }

      /* ⑨ 暴露（v144.4：逐队给名字/人数/目标城/到城倒计时） */
      if (GAME.expose) {
        var el = GAME.expose.lineOf();
        if (el) {
          var _wt = GAME.expose.watchTextOf ? GAME.expose.watchTextOf() : '';
          var _rows = (GAME.expose.watchersOf ? GAME.expose.watchersOf() : []).map(function (w) {
            return '<div style="margin-top:3px;">👁 <b>' + U.escape(w.name) + '</b>　'
              + U.numText(w.pop, 0) + ' 人　'
              + (w.target
                ? ('→ ' + U.escape(w.target) + (w.eta != null ? ('　<span style="color:var(--red-light);">约 '
                  + w.eta + ' 月后到城</span>') : ''))
                : '<span style="color:var(--text-dim);">还在游荡</span>')
              + '</div>';
          }).join('');
          h += sec('👁 谁看见了你', el, (warn ? _rows : _rows)
            + '<div class="ui-sub" style="margin-top:4px;">' + U.escape(_wt) + '</div>'
            + '<div class="ui-sub" style="margin-top:3px;">被发现之后他们会转向最近的城 —— '
            + '要么补守军、要么建工事、要么花 300 兵驱赶（都在竞者面板里）。</div>', 'late');
        }
      }
    })();

    ui.openShell({
      live: function () { ui.openWorldPanel(); },
      title: '🌍 世界的账本',
      sub: '六条线：温度 · 辐射云 · 污染 · 竞争者 · 补给 · 残页',
      /* v133：**两列**。六条线本来就是一屏该扫完的东西，竖着排必然撑爆
         （实测单列溢出 1968px、加折叠后仍溢出 285px）。
         两列之后横向空间用起来，纵向直接减半 —— 这比再加滚动条或换大号弹窗都对。 */
      /* ⚠️ 必须是 `minmax(0,1fr)` 而不是 `1fr` —— grid 子项默认 `min-width:auto`，
         内容不换行时会把列撑破（实测右列被弹窗边缘裁掉：「竞争者 你之9」「遗骸科技 一3」）。
         `minmax(0,…)` 允许子项收缩到 0，文字才会换行。 */
      body: h ? '<div class="world-grid">' + h + '</div>'
        : '<div class="q-empty">这个世界还没有动起来。</div>'
    });
  };

  ui.factionBarHTML = function () {
    var F = GAME.faction;
    if (!F) return '';
    F.ensure();
    var arr = F.stats();
    if (!arr.length) return '';
    var th = F.threatOf();
    var Y = GAME.yearOf ? GAME.yearOf() : null;
    var h = '<div style="margin:0 0 10px;padding:8px 10px;border:1px solid var(--wood-light);border-radius:4px;">';
    /* ============================================================
     * v93.1~3：**这个世界还剩什么**
     * ------------------------------------------------------------
     * 放在最上面一行，因为它是这一屏最该被看见的数字：
     *   不是"我有多少兵"，是"还有几处人家、多少人活着"。
     * 玩家做的每个决定（抢/护/征召/派人出去）都在改这三个数。
     * ============================================================ */
    (function () {
      var vs = (GAME.village && GAME.village.statsOf) ? GAME.village.statsOf() : null;
      var rn = GAME.renown ? GAME.renown.tier() : null;
      if (!vs && !rn) return;
      h += '<div style="font-size:var(--fs-cap);line-height:1.7;margin-bottom:6px;'
        + 'padding-bottom:6px;border-bottom:1px dashed var(--wood-light);">';
      if (vs) {
        h += '<span style="color:var(--gold-light);">🏘 还有 <b>' + vs.alive + '</b> 处村社 · 约 '
          + U.numText(vs.pop, 0) + ' 人活着</span>'
          + (vs.dead ? ('　<span style="color:var(--text-dim);">已空 ' + vs.dead + ' 处</span>') : '')
          + '<br>';
      }
      if (rn) {
        h += '<span style="color:var(--text-dim);">👤 外面怎么看你：<b>' + U.escape(rn.name) + '</b>　'
          + U.escape(rn.note) + '</span>';
      }
      h += '<br><button class="btn" style="font-size:var(--fs-cap);padding:1px 8px;margin-top:3px;"'
        + ' data-action="open-convoy">🚚 拓荒队（派人去拿买不到的东西）</button>';
      h += '</div>';
    })();
    /* v92.8：年景（B5）—— 今年是什么年，直接写在世界态势上面一行 */
    if (Y) {
      h += '<div style="font-size:var(--fs-cap);color:var(--text-dim);margin-bottom:4px;">'
        + '🌍 今年 · <b style="color:var(--gold-light);">' + U.escape(Y.name) + '</b>　'
        + U.escape(Y.note || '')
        + (GAME.coldActiveOf && GAME.coldActiveOf()
          ? '　<span style="color:var(--red-light);">❄ 寒潮：粮产 −'
            + Math.round((1 - (GAME.coldMulOf ? GAME.coldMulOf() : 0.8)) * 100) + '%</span>'
          : (GAME.coldLeftOf ? ('　<span style="color:var(--text-dim);">❄ 距寒潮 ' + GAME.coldLeftOf() + ' 个月</span>') : ''))
        + '</div>';
    }
    h += '<div style="font-size:var(--fs-cap);color:var(--gold-light);margin-bottom:6px;">⚔ 四方势力'
      + (th ? '　<span style="color:var(--red-light);">⚠ ' + U.escape(th.name) + ' 已到 ' + Math.round(th.near) + ' 格内</span>' : '')
      + '</div>';
    /* v115：四家**全都**没探明时，别铺四块一模一样的「？？？（未探明）派侦察队…」——
       那不是"有信息"，那是同一句废话抄四遍。引导只写一次，格子里只留「？？？」。 */
    var allUnknown = arr.length > 0 && arr.every(function (x) { return x.known === false; });
    if (allUnknown) {
      h += '<div class="ui-sub" style="line-height:1.7;margin-bottom:6px;">'
        + '都还没探明 —— 派侦察队出去，找到它们的核心，才知道这是谁、它想干什么。</div>';
    }
    h += '<div style="display:flex;gap:16px;flex-wrap:wrap;">';
    arr.forEach(function (x) {
      /* v92.12（A8）：核心没探明 → 只知道"有这么一家"，不知道是谁、多大 */
      if (x.known === false) {
        h += '<div style="font-size:var(--fs-cap);line-height:1.5;color:var(--text-dim);">'
          + '<b>？？？</b>'
          + (allUnknown ? '' : '<br>未探明')      /* 全都未探明时上面已经写过了，不再重复 */
          + '</div>';
        return;
      }
      /* v93.6：**它想干什么**放在第一行。
         以前这一格只有"半径 12 格"，玩家看得出它多大，看不出它要做什么 ——
         而"会不会打我"才是玩家真正在算的那件事。 */
      var _it = x.intent || null;
      var _itColor = !_it ? 'var(--text-dim)'
        : (_it.id === 'hunt' ? 'var(--red-light)'
          : (_it.id === 'avoid' ? 'var(--green-ok)'
            : (_it.id === 'ally' || _it.id === 'truce' ? 'var(--gold-light)' : 'var(--text-dim)')));
      h += '<div style="font-size:var(--fs-cap);line-height:1.5;">'
        + '<b>' + U.escape(x.name) + '</b> <span style="color:var(--text-dim);">' + U.escape(x.trait) + '</span>'
        + (_it ? ('　<span style="color:' + _itColor + ';font-weight:700;">' + U.escape(_it.name) + '</span>') : '')
        + '<br>'
        + (_it ? ('<span style="color:' + _itColor + ';">' + U.escape(_it.because) + '</span><br>') : '')
        + '半径 ' + x.r + ' · 约 ' + U.numText(x.cells, 0) + ' 格'
        + (x.near != null ? '<br><span style="color:var(--text-dim);">距你 ' + Math.round(x.near) + ' 格</span>' : '')
        + (x.truce > 0 ? ('<br><span style="color:var(--gold-light);">🤝 停战中（剩 ' + x.truce + ' 月）</span>') : '')
        + (x.ally > 0 ? ('<br><span style="color:var(--green-ok);">🛡 盟友（剩 ' + x.ally + ' 月不扩张）</span>') : '')
        + (x.alarm > 0 ? ('<br><span style="color:var(--red-light);">👁 已惊动 ' + x.alarm + ' 次（每次 +0.15 格）</span>') : '')
        /* v93.6：它怎么看你 —— 怨恨 / 畏惧 / 信任，三个数分开显示。
           合成一个"好感度"会让玩家看不出"它到底是怕我还是恨我"，
           而这两者对应的后果完全相反。 */
        + (x.stand && (x.stand.g || x.stand.f || x.stand.t)
          ? ('<br><span style="color:var(--text-dim);">怨 ' + Math.round(x.stand.g)
            + ' · 惧 ' + Math.round(x.stand.f) + ' · 信 ' + Math.round(x.stand.t) + '</span>')
          : '')
        + '<br><button class="btn" style="font-size:var(--fs-cap);padding:1px 8px;margin-top:3px;"'
        + ' data-action="duel-with" data-fid="' + x.id + '">⚔ 叫阵</button>'
        + (x.truce > 0 ? '' : ('<button class="btn" style="font-size:var(--fs-cap);padding:1px 8px;margin:3px 0 0 4px;"'
          + ' data-action="faction-tribute" data-fid="' + x.id + '">🤝 纳贡</button>'))
        + (x.ally > 0 ? '' : ('<button class="btn" style="font-size:var(--fs-cap);padding:1px 8px;margin:3px 0 0 4px;"'
          + ' data-action="faction-ally" data-fid="' + x.id + '">🛡 结盟</button>'))
        + ((x.ally > 0 || x.truce > 0) ? '' : ('<button class="btn" style="font-size:var(--fs-cap);padding:1px 8px;margin:3px 0 0 4px;"'
          + ' data-action="faction-incite" data-fid="' + x.id + '">🔥 挑拨</button>'))
        /* v144.5（B2「打」）：宣战 —— 花军费让它按月真的来打你最近的城。 */
        + (GAME.faction.warLeft && GAME.faction.warLeft(x.id) > 0
          ? ('<br><span style="color:var(--red-light);">⚔ 交战中（剩 ' + GAME.faction.warLeft(x.id) + ' 月 · 按月来犯）</span>')
          : ('<button class="btn" style="font-size:var(--fs-cap);padding:1px 8px;margin:3px 0 0 4px;"'
            + ' data-action="faction-war" data-fid="' + x.id + '">⚔ 宣战</button>'))
        + '</div>';
    });
    h += '</div>';
    h += '<div style="font-size:var(--fs-cap);color:var(--text-dim);margin-top:6px;">'
      + '按月推进（一年约 +10 格 · 半径上限 14）。**宣战**之后它会按月集结来打你最近的城'
      + '（走真实战斗结算，不是播报）；纳贡/结盟能买时间。</div>';
    /* ============================================================
     * v94.1：世界的另外六件事
     * ------------------------------------------------------------
     * 势力只是"别人会不会打你"。这个世界还有六条独立的线：
     * 温度、辐射云、污染、竞争者、补给、残页。
     * 全部收在世界账本里 —— 一行摘要 + 一个入口，不占态势版面。
     * ============================================================ */
    (function () {
      var parts = [];
      if (GAME.climate) parts.push(GAME.climate.lineOf());
      if (GAME.surge) parts.push(GAME.surge.lineOf());
      if (GAME.taint) parts.push(GAME.taint.lineOf());
      if (GAME.rival) parts.push(GAME.rival.lineOf());
      if (GAME.land) parts.push(GAME.land.lineOf());
      if (GAME.relic) parts.push(GAME.relic.lineOf());
      parts = parts.filter(function (x) { return !!x; });
      if (!parts.length) return;
      /* ============================================================
       * v156.31（老板 2026-11-02「把世界账本去掉，放行政里边就行，
       *   我看到已经有了，那就里边图标闪烁」）
       * ------------------------------------------------------------
       * 顶栏的 #nav-ev 整条退役，入口只留这一处。
       * 有事件时按钮**自己闪**（.ev-on → ev-breathe），文案换成「⚡ 事件名」，
       * 与顶栏那版同一个视觉语言；平时就是「🌍 世界的账本」。
       * ⚠️ 行政页**不随 tick 重绘**（main.js 只对 city/ext/map/generals/marches 重绘），
       *   所以这里给它初值；玩家停在行政页时来了事件，由 ui.syncBadges 补那一刀。
       * ============================================================ */
      var evNow = (GAME.events && GAME.events.current) ? GAME.events.current() : null;
      var evLive = !!(evNow && evNow.def);
      var evLabel = evLive ? ('⚡ ' + U.escape(evNow.def.name || '有件事')) : '🌍 世界的账本';
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--wood-light);'
        + 'font-size:var(--fs-cap);line-height:1.85;">'
        + parts.map(function (x) { return '<div>' + x + '</div>'; }).join('')
        + '<button class="btn' + (evLive ? ' ev-on' : '') + '"'
        + ' style="font-size:var(--fs-cap);padding:1px 8px;margin-top:5px;"'
        + ' data-action="open-world">' + evLabel + '</button></div>';
    })();
    h += '</div>';
    return h;
  };
  /* 右栏：某城的只读行政明细 */
  ui._admDetailHTML = function (sl, city, pid) {
    function empty(t) { return '<div class="adm-empty">— ' + (t || '无') + ' —</div>'; }
    /* 据点（前哨）：按 cityId 归属该城 */
    var fo = sl.forts || {}, fortRows = [];
    Object.keys(fo).forEach(function (k) {
      var f = fo[k]; if (!f || String(f.cityId) !== String(city.id)) return;
      fortRows.push('<div class="adm-row"><span class="adm-k">' + U.escape(f.name || '前哨') + '</span>' +
        '<span class="adm-v">Lv' + (f.lv || f.level || 0) + ' · ' + (GAME.map.coordText ? GAME.map.coordText(f.x, f.y) : '') + '</span></div>');
    });
    /* 占领野地：驻军 garrison.cityId 归属该城。v91.22（老板 2）：行尾加「野地详情」按钮 →
       弹出该野地的**单独管理界面**（ui.openLandModal，含已占野地的全部操作）。 */
    var wildRows = [];
    (sl.wilds || []).forEach(function (w) {
      var g = w.garrison; if (!g || String(g.cityId) !== String(city.id)) return;
      var gn = ''; if (g.genId) { var gg = (GAME.state.generals || []).filter(function (x) { return x.id === g.genId; })[0]; if (gg) gn = ' · 守将 ' + U.escape(gg.name); }
      var t = (DATA.TERRAIN || {})[w.type];
      /* 野地详情：切到该野地所在**星球**（若他星）→ 打开野地面板。 */
      var _wpid = pid;
      wildRows.push('<div class="adm-row"><span class="adm-k">' + (t ? t.name : w.type || '野地') + ' Lv' + (w.level || 0) + '</span>' +
        '<span class="adm-v">' + (GAME.map.coordText ? GAME.map.coordText(w.x, w.y) : '') + gn + '</span>' +
        '<button class="btn xs adm-wild-open" data-action="adm-wild-open" data-pid="' + _wpid + '" data-ci="' + w.ci + '" title="野地详情（单独管理界面）">详情</button></div>');
    });
    /* 管理英雄：归属该城的英雄 */
    var gens = (GAME.generalsIn ? GAME.generalsIn(city) : []);
    var genRows = gens.map(function (g) {
      var st = ui.genStatusName ? ui.genStatusName(g) : '';
      return '<div class="adm-row"><span class="adm-k">' + U.escape(g.name) + '</span>' +
        '<span class="adm-v">Lv' + (g.level || 1) + ' · ' + st + '</span></div>';
    });
    /* 在建建筑 */
    var bq = (sl.queues && sl.queues.build) || [];
    var buildRows = bq.filter(function (q) { return String(q.cityId) === String(city.id); }).map(function (q) {
      var b = (DATA.BUILDINGS || {})[q.buildId] || (DATA.EXT_BUILDINGS || {})[q.buildId] || {};
      return '<div class="adm-row"><span class="adm-k">' + U.escape(b.name || q.buildId) + '</span>' +
        '<span class="adm-v">' + ui.pctOf(q.elapsed, q.totalTime) + '</span></div>';
    });
    /* 招募队列 */
    var tq = (sl.queues && sl.queues.train) || [];
    var trainRows = tq.filter(function (q) { return String(q.cityId) === String(city.id); }).map(function (q) {
      var t = (DATA.TROOPS || {})[q.troopId] || {};
      return '<div class="adm-row"><span class="adm-k">' + U.escape(t.name || q.troopId) + ' ×' + (q.count || 0) + '</span>' +
        '<span class="adm-v">' + ui.pctOf(q.elapsed, q.totalTime) + '</span></div>';
    });
    /* 研究中科技 */
    var kq = (sl.queues && sl.queues.tech) || [];
    var techRows = kq.filter(function (q) { return String(q.cityId) === String(city.id); }).map(function (q) {
      var name = q.techId; (DATA.TECH || []).forEach(function (x) { if (x.id === q.techId) name = x.name; });
      return '<div class="adm-row"><span class="adm-k">🔬 ' + U.escape(name) + '</span>' +
        '<span class="adm-v">' + ui.pctOf(q.elapsed, q.totalTime) + '</span></div>';
    });
    /* 已研科技由下方分类 cats 的 techLvRows 现算（v91.04：不再预拼 techLvNames） */
    /* 星球名（非「当前」字样 —— 读该 pid 的星球） */
    var pl97 = null; (GAME.planetsOf ? GAME.planetsOf() : []).forEach(function (p) { if (p.id === pid) pl97 = p; });
    var isCur97 = (GAME.activePlanetOf && GAME.activePlanetOf() && GAME.activePlanetOf().id === pid);
    return '<div class="adm-city-title">🏯 ' + U.escape(city.name || '城市') +
        ' <span class="adm-cmeta">' + (GAME.map.coordText ? GAME.map.coordText(city.x, city.y) : '') +
        ' · 星球 ' + U.escape((pl97 && pl97.name) || ('#' + pid)) + (isCur97 ? '（当前城所在）' : '') + '</span>' +
        '<button class="btn sm' + (isCur97 ? '' : ' gold') + '" data-action="adm-city-enter" data-pid="' + pid + '" data-city="' + city.id + '"' +
        (isCur97 ? ' title="该城即当前城">已是当前城' : ' title="进入该城（城市界面切到该城所在星球）">进入该城') + '</button></div>' +
      (function () {
        /* v91.04（老板）：右栏改**分类清单 + 选中列表**（参考募兵界面 .troop-split）——
           左小列 = 各分类（带条数），右 = 该分类完整列表（不再 7 张卡平铺 → 一屏装得下）。 */
        var techsC = city.techs || {};
        var techLvRows = Object.keys(techsC).filter(function (k) { return techsC[k] > 0; }).map(function (k) {
          var n = k; (DATA.TECH || []).forEach(function (x) { if (x.id === k) n = x.name; });
          return '<div class="adm-row"><span class="adm-k">' + U.escape(n) + '</span><span class="adm-v">Lv' + techsC[k] + '</span></div>';
        });
        /* v115（老板 2026-10-23 评估）：**空状态不许只有一个"— 无 —"**。
           七个分类里有六个是空的，玩家看到的是六个 0 + 六句"无"，
           人类读作"这游戏没做完"，而不是"我还没开始"。
           每个分类给一句"去哪儿搞" —— 玩家不用猜就知道下一步点哪。 */
        var cats = [
          { id: 'gen', icon: '🧑‍✈️', label: '管理英雄', rows: genRows,
            tip: '还没有招募过英雄 —— 去「英雄」页看看有没有人愿意跟你' },
          { id: 'fort', icon: '🚩', label: '据点（前哨）', rows: fortRows,
            tip: '还没有前哨 —— 先在地图上占一块野地，再在那儿设哨' },
          { id: 'wild', icon: '🌿', label: '占领野地', rows: wildRows,
            tip: '还没占野地 —— 去地图点一块无主野地，派兵过去' },
          { id: 'build', icon: '🏗', label: '在建建筑', rows: buildRows,
            tip: '没有在建 —— 回城里点一块空地开工' },
          { id: 'train', icon: '⚔️', label: '招募队列', rows: trainRows,
            tip: '没有在招 —— 城外军营里训练，先得有人口' },
          { id: 'tech', icon: '🔬', label: '研究中科技', rows: techRows,
            tip: '没有在研 —— 先建研究院，再去科技树挑一项' },
          { id: 'techdone', icon: '📚', label: '已研科技', rows: techLvRows,
            tip: '还没有科技 —— 研究完的会列在这里' }
        ];
        var cat = ui._admCat, found = false;
        cats.forEach(function (c) { if (c.id === cat) found = true; });
        if (!found) cat = ui._admCat = cats[0].id;
        var selCat = cats.filter(function (c) { return c.id === cat; })[0];
        /* v115：空分类**视觉上退后**，条数不写"0"而写"—"。
           六个"0"排成一列，人类读作"全是空的、没做完"；
           "—"读作"这里暂时没东西"，而且视线不会被六个零吸走。 */
        var catRow = function (arr, c) {
          var empty2 = !c.rows.length;
          return '<div class="adm-cat' + (c.id === cat ? ' cur' : '') + '"'
            + ' style="' + (empty2 && c.id !== cat ? 'opacity:.45;' : '') + '"'
            + ' data-action="adm-cat-pick" data-cat="' + c.id + '">'
            + '<span class="adm-cat-ic">' + c.icon + '</span><span class="adm-cat-nm">' + c.label + '</span>'
            + '<span class="adm-cat-n">' + (empty2 ? '—' : c.rows.length) + '</span></div>';
        };
        /* 有内容的排前面 —— 玩家打开这一页是想看"我有什么"，不是看"我没有什么" */
        var catsSorted = cats.slice().sort(function (a, b) {
          return (b.rows.length ? 1 : 0) - (a.rows.length ? 1 : 0);
        });
        var catList = catsSorted.map(function (c) { return catRow(cats, c); }).join('');
        return '<div class="adm-cat-split">' +
            '<div class="adm-cat-list">' + catList + '</div>' +
            '<div class="adm-cat-body">' +
              '<div class="adm-cat-body-t">' + selCat.icon + ' ' + selCat.label +
                ' <span class="adm-cmeta">（' + selCat.rows.length + '）</span></div>' +
              '<div class="adm-cat-rows">' + (selCat.rows.length ? selCat.rows.join('') : empty(selCat.tip)) + '</div>' +
            '</div>' +
          '</div>';
      })();
  };
  /* 进度百分比（在建/招募/研究的统一展示） */
  ui.pctOf = function (elapsed, total) {
    total = Math.max(0, total || 0);
    var p = total > 0 ? Math.max(0, Math.min(100, Math.round((elapsed || 0) / total * 100))) : 0;
    return p + '%';
  };

  ui.renderView = function (v) {
    ui.syncTheme();   /* v39：主题落点（幂等） */
    var box = $('#view-container');
    /* v29（需求 3/4）：本帧重新收集分页条 —— 绝不能沿用上一帧的，
       否则切到没有分页的页面时，底部还挂着上一个视图的页码（点下去会翻错列表）。 */
    ui._bottom = [];
    /* v26（需求 5）：城内（city）与城外（ext）现在是**平级视图**，
       两者同属"我这座城"，所以侧栏（城市属性 / 资源 / 驻军）在两边都保留。 */
    var isCity = (v === 'city' || v === 'ext');
    var side2 = $('.auth-side');
    if (side2) side2.classList.toggle('hidden', !isCity);
    ui.syncHeader();
    /* 侧栏隐藏时主区自动占满整宽（由 .main 的 grid 列数控制） */
    var mainEl = $('.main');
    if (mainEl) mainEl.classList.toggle('solo', !isCity);
    if (v === 'city') box.innerHTML = ui.cityHTML();
    else if (v === 'ext') box.innerHTML = ui.extHTML();
    else if (v === 'troops') box.innerHTML = ui.troopsHTML();
    else if (v === 'generals') box.innerHTML = ui.generalsHTML();
    else if (v === 'marches') box.innerHTML = ui.marchesHTML();
    /* v90.97（老板）：行政大菜单（星球→城市分级树 + 城市只读总览） */
    else if (v === 'admin') box.innerHTML = ui.adminHTML();
    else if (v === 'equip') box.innerHTML = ui.equipHTML();
    else if (v === 'tech') box.innerHTML = ui.techHTML();
    else if (v === 'items') box.innerHTML = ui.itemsHTML();
    else if (v === 'rank') box.innerHTML = ui.rankHTML();
    else if (v === 'galaxy') box.innerHTML = ui.galaxyHTML();
    /* v91.60（老板）：奇观建造（类星球建造场 · 耗奇观材料 · 全局 buff） */
    /* v91.71：奇观建造场 → 空间站（卡牌船坞） */
    else if (v === 'station' || v === 'build') box.innerHTML = ui.stationHTML();
    else if (v === 'map') box.innerHTML = ui.mapHTML();
    /* v25（需求 2）：游商 / 背包 由弹窗改为整页视图 */
    else if (v === 'shop') box.innerHTML = ui.shopHTML();
    else if (v === 'bag') box.innerHTML = ui.bagHTML();
    /* v89.194（老板 S3）：收藏（陈列馆）—— 与游商 / 背包并列的整页视图 */
    else if (v === 'collection') box.innerHTML = ui.collectHTML();
    else if (v === 'reports') box.innerHTML = ui.reportsHTML();
    else if (v === 'settings') box.innerHTML = ui.settingsHTML();
    /* v29（需求 5）：自动化独立成菜单（自动升级 / 研究 / 出征） */
    else if (v === 'auto') box.innerHTML = ui.autoHTML();
    /* v26（需求 5）：子页签与 ui._citySub 一并删除 —— 城内/城外走顶栏 data-view，
       不再有"独立于视图的 sub 状态"，也就不会出现"切了视图但页签还亮着旧值"。 */
    if (v === 'map') { ui.ensureMap3D(); requestAnimationFrame(function () { ui.renderMapCanvas(); }); }
    if (v === 'galaxy') requestAnimationFrame(function () { ui.renderGalaxy(); });
    ui.softenBlocked(box);   /* v89.189：视图页的受阻按钮同样转「可点+说明」 */
    ui.paintBottom();
    /* v114（老板 2026-10-23 评估）：前传期盖一层全屏荒野界面 ——
       12 个 tab、三级下拉、坐标输入、9 个地图按钮全部藏起来，
       只留天数 / 等级 / 三个动作。立城后 P.on() 变 false，这里自动撤掉。
       放在**所有刷新路径的汇合点**（renderView）而不是 setView：
       ctx.refresh 走的是 GAME.refreshView → renderView，漏了它打完一场界面就不更新。 */
    /* ⛔ v157.85：前传 HUD 的 syncScreen 已删（前传退役）。 */
    /* v150（P0-1）：顶栏按阶段软隐藏（幂等、不删节点）——
       放在同一个汇合点：任何刷新路径都会经过这里。 */
    ui.syncPhase();
    /* v123：core 模块不能直接调界面（架构棘轮），所以它们只留一条
       `state._tip`，由这里消费一次并清空 —— "立城后先建农田"就是这么弹的。 */
    (function () {
      var sp = GAME.state;
      if (sp && sp._tip) {
        var msg = sp._tip;
        sp._tip = null;
        if (msg) ui.toast(msg);
      }
    })();
  };

  /* --------- 辖区岁贡（v14）：占城的持续收益面板 --------- */
  ui.yieldHTML = function (compact) {
    var sum = GAME.dailyYieldSummary ? GAME.dailyYieldSummary() : null;
    var box = compact
      ? 'border-top:1px solid var(--sep-gold);padding-top:8px;margin-top:10px;'
      : 'background:var(--slab-1);border:1px solid var(--line-strong);border-radius:6px;padding:11px 13px;margin-top:12px;';
    if (!sum || !sum.cities) {
      return '<div style="' + box + '">' +
        '<div style="color:var(--gold);font-size:var(--fs-body);font-weight:700;margin-bottom:5px;">🏛 辖区岁贡</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);line-height:1.7;">尚无归属名城</div>' +
        '</div>';
    }
    var matLine = [];
    for (var mid in sum.mats) {
      var m = DATA.MATERIAL_BY_ID[mid];
      matLine.push('<span style="color:' + (m && m.tier >= 3 ? 'var(--gold-light)' : 'var(--text)') + ';">' +
        (m ? m.name : mid) + '×' + sum.mats[mid] + (m && m.tier === 4 ? '★' : '') + '</span>');
    }
    var stateLine = [];
    for (var st in sum.byState) {
      var b = sum.byState[st];
      var mm = DATA.MATERIAL_BY_ID[b.mat];
      stateLine.push('<span style="display:inline-block;background:var(--slab-3);border:1px solid #464a56;border-radius:9px;' +
        'padding:1px 7px;margin:2px 3px 2px 0;font-size:var(--fs-sub);color:' + (b.seat ? 'var(--gold-light)' : 'var(--text-dim)') + ';">' +
        st + ' · ' + (mm ? mm.name : b.mat) + ' ×' + b.count + '座' + (b.seat ? '（首府 ×' + DATA.STATE_SEAT_BONUS + '）' : '') + '</span>');
    }
    var left = GAME.dailyYieldLeft ? Math.round(GAME.dailyYieldLeft() / 1000) : 0;
    return '<div style="' + box + '">' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:6px;">' +
        '<span style="color:var(--gold);font-size:var(--fs-body);font-weight:700;">🏛 辖区岁贡（每现实日结算）</span>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">距下次 ' + U.durExact(left) + '</span>' +
      '</div>' +
      '<div style="font-size:var(--fs-sub);line-height:1.8;">' +
        '归属名城 <b>' + sum.cities + '</b> 座' +
        (sum.seats.length ? ' · 首府在握：<span style="color:var(--gold-light)">' + sum.seats.join('、') + '</span>' : '') +
      '</div>' +
      '<div style="font-size:var(--fs-sub);line-height:1.8;">每 日 收 入：旧币 <b style="color:var(--gold-light)">+' + U.fmt(sum.gold) + '</b>' +
        ' · 声望 <b style="color:var(--gold-light)">+' + U.fmt(sum.rep) + '</b></div>' +
      (matLine.length ? '<div style="font-size:var(--fs-sub);line-height:1.9;">特产材料：' + matLine.join('、') +
        '<span style="color:var(--text-dim);font-size:var(--fs-cap);">（★ 四阶）</span></div>' : '') +
      (stateLine.length ? '<div style="margin-top:6px;line-height:1.9;">' + stateLine.join('') + '</div>' : '') +
      '</div>';
  };

  /* 显示比例（v16）：城内/城外/地图整体缩放，缓解「界面太小费眼睛」 */
  ui.zoom = function () {
    var s = GAME.state;
    return (s && s.settings && s.settings.zoom) || 100;
  };
  /* v89.104（老板）：「显示比例，将数值档次改成连续拖动的进度条样式，
     从 80%-120% 可连续拖动，自由设置它们之间的整数显示比例」——
     唯一出口 = 一个 range 滑块（80~120、step 1），值走既有的 GAME.doSetZoom。
     旧的档次 chips（80/100/120/140/160）退役：上限收到 120，避免把界面缩到不可读。 */
  ui.ZOOM_MIN = 80;
  ui.ZOOM_MAX = 120;
  ui.zoomBarHTML = function () {
    var cur = Math.max(ui.ZOOM_MIN, Math.min(ui.ZOOM_MAX, ui.zoom()));
    return '<input type="range" id="zoom-range" class="zoom-range" min="' + ui.ZOOM_MIN + '" max="' + ui.ZOOM_MAX +
      '" step="1" value="' + cur + '">';
  };
  ui.zoomStyle = function () { return 'zoom:' + (ui.zoom() / 100) + ';'; };
})();
