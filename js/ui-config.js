/* ============================================================
 * ui-config.js　设置与自动化 · 存档 / 自动出征 / 自动采购 / 奇观 / 战力评估
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
   * 设置（v29 · 需求 5）
   * ------------------------------------------------------------
   * ① 「时间倍率 / 显示比例 / 税率」三行**改用同一套点选控件**（ui.chips）——
   *    改前时间倍率是 <button>、显示比例是 chip、税率又是 <button>：
   *    三行三个模样，明明都是"从几个百分数里挑一个"。
   * ② ~~三个自动化开关并排一行~~ → **v36 整段撤出**：
   *    自动化只在「自动」菜单（开关 + 全部参数同处一地）。
   *    设置页该管"一次性偏好"（倍率/比例/税率）与存档，不管自动化。
   * ③ 「存档 / 新游戏」留在这里（顶栏的那一份已删）。
   * ============================================================ */
  /* ⛔ v89.115：`ui.autoSwitchBtn` 退役 —— 自动化界面改成「左名单 + 右详情」后，
     开关按钮由 `ui.autoPaneHTML` 的 ap-head 统一画（每个功能一个，样式同一处），
     这个"并排开关条"的零件没有消费点了（audit 死函数门禁抓的正是它）。 */
  /* ============================================================
   * v89.115（老板）：「整合界面，左三分之一为自动功能列表（简洁），
   *   右侧三分之二为介绍展示和详细设置面板（类似英雄界面），
   *   通过切换左侧自动化功能浏览和设置」+「自动菜单增加一个自动治疗伤兵」
   * ------------------------------------------------------------
   * 版式 = 英雄界面同款左右分栏（.auto-grid：左 1fr 名单 / 右 2fr 详情）：
   *   左 = 七项自动化的**清单**（图标 + 名称 + 开/关圆点 + 一行摘要）—— 简洁；
   *   右 = 选中项的**介绍 + 详细设置**（开关 / 参数 / 上次结果 / 入口）+ 红线说明。
   * 状态：`ui._autoSel`（当前选中项 id，界面态不落存档 —— 与 ui._trainTab 同类）。
   * 单一出口：开/关判据 `ui.autoOnOf(id)`、状态摘要 `ui.autoMsgOf(id)` —— 左右两侧同读它，
   *   不许各写一份（改一处两边一起对）。
   * ============================================================ */
  ui.AUTO_ITEMS = [
    { id: 'upgrade', icon: '🔨', name: '自动升级', act: 'toggle-auto-upgrade' },
    { id: 'research', icon: '📜', name: '自动研究', act: 'toggle-auto-research' },
    { id: 'march', icon: '⚔️', name: '自动出征', act: 'toggle-auto-march' },
    /* v91.36（老板）：「增加自动探索功能，城中有任意空闲英雄和可用兵种时，每个城市均可
       向奇观派遣探索队」（参考自动出征 · 不设固定英雄）。 */
    { id: 'explore', icon: '✨', name: '自动探索', act: 'toggle-auto-explore' },
    /* ⛔ v91.57（老板「去除君主修行」）：自动练功项退役。 */
    /* v89.128（需求 5）：自动采集/收获（每 24 游戏小时一轮） */
    { id: 'gather', icon: '🌾', name: '自动采集/收获', act: 'toggle-auto-gather' },
    { id: 'recruit', icon: '🧲', name: '自动招募', act: 'auto-recruit-toggle' },
    /* v89.190（老板 2）：自动征兵（兵营募兵 · 与「自动招募」= 征召大厅招将并列） */
    { id: 'train', icon: '🛡️', name: '自动征兵', act: 'toggle-auto-train' },
    { id: 'heal', icon: '🏥', name: '自动治疗', act: 'toggle-auto-heal' },
    /* v91.59（老板）：自动采购 —— 统一数量补货（每现实日上限内）。 */
    { id: 'buy', icon: '🛒', name: '自动采购', act: 'toggle-auto-buy' },
    /* v91.72（老板）：自动基因研究 —— 各城有空舱自动立项、成熟自动收获。 */
    { id: 'farm', icon: '🧬', name: '自动基因研究', act: 'toggle-auto-farm' },
    /* v89.118（老板需求 3）：外敌来犯的**接受开关** + 介绍 + 警报流水（从军务·警报迁来） */
    { id: 'invasion', icon: '🔥', name: '外敌来犯', act: 'toggle-auto-invasion' },
  ];
  /* 开/关判据（唯一出口） */
  ui.autoOnOf = function (id) {
    var s = GAME.state || {};
    var cfg = GAME.autoMarchCfg ? GAME.autoMarchCfg() : null;
    if (id === 'upgrade') return !!(s.settings && s.settings.autoUpgrade);
    if (id === 'research') return !!(s.settings && s.settings.autoResearch);
    if (id === 'march') return !!(cfg && cfg.on);
    if (id === 'explore') { var _ec = GAME.autoExploreCfg ? GAME.autoExploreCfg() : null; return !!(_ec && _ec.on); }
    if (id === 'recruit') return !!(GAME.innAutoCfg && GAME.innAutoCfg().on);
    if (id === 'train') return !!(s.settings && s.settings.autoTrain);
    if (id === 'heal') return !!(s.settings && s.settings.autoHeal);
    if (id === 'gather') return !!(s.settings && s.settings.autoGather);
    if (id === 'buy') { var _bc = GAME.autoBuyCfg ? GAME.autoBuyCfg() : null; return !!(_bc && _bc.on); }
    if (id === 'farm') { var _fc = GAME.autoFarmCfg ? GAME.autoFarmCfg() : null; return !!(_fc && _fc.on); }
    if (id === 'invasion') return GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true;
    return false;
  };
  /* 状态摘要（唯一出口） */
  ui.autoMsgOf = function (id) {
    var s = GAME.state || {};
    if (id === 'upgrade') return (s.autoState && s.autoState.msg) || '未开启';
    if (id === 'research') return (s.autoTechState && s.autoTechState.msg) || '未开启';
    if (id === 'march') return (s.autoMarchInfo && s.autoMarchInfo.msg) || '未开启';
    if (id === 'explore') return (s.autoExploreInfo && s.autoExploreInfo.msg) || '未开启';
    if (id === 'gather') return (s.autoGatherState && s.autoGatherState.msg) || '未开启';
    if (id === 'recruit') {
      var c = GAME.innAutoCfg ? GAME.innAutoCfg() : null;
      return (c && c.on) ? ('门槛 ' + ((DATA.GEN_RANK_BY_ID[c.min] || {}).name || c.min)) : '未开启';
    }
    if (id === 'train') return (s.autoTrain && s.autoTrain.msg) || (s.settings && s.settings.autoTrain ? '已开启，待命' : '未开启');
    if (id === 'heal') return (s.autoHealState && s.autoHealState.msg) || '未开启';
    if (id === 'buy') return (s.autoBuyInfo && s.autoBuyInfo.msg) || '未开启';
    if (id === 'farm') return (s.autoFarmState && s.autoFarmState.msg) || '未开启';
    if (id === 'invasion') {
      if (!(GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true)) return '已拒战 —— 外敌不来犯';
      var soon = 0;
      (s.cities || []).forEach(function (ct) {
        var due = GAME.invasionDueAt ? GAME.invasionDueAt(ct) : 0;
        if (!due) return;
        if (!soon || due < soon) soon = due;
      });
      if (!soon) return '已接受 · 暂无排期（城市数不够）';
      return '已接受 · 下一场 ' +
        U.dur(Math.max(0, Math.round((soon - GAME.realNow()) / 1000))) + ' 后（现实时间）';
    }
    return '';
  };
  /* 左侧清单（v90.15 老板：「小图标没有比有好」——去图标，只留状态点 + 名称 + 摘要） */
  ui.autoSideHTML = function () {
    return ui.AUTO_ITEMS.map(function (it) {
      var on = ui.autoOnOf(it.id);
      return '<div class="auto-item' + (on ? ' on' : '') + (ui._autoSel === it.id ? ' sel' : '') + '"' +
        ' data-action="auto-pick" data-key="' + it.id + '">' +
        '<span class="ai-dot"></span>' +
        '<span class="ai-main"><b class="ai-name">' + it.name + '</b>' +
          '<span class="ai-sub">' + U.escape(ui.autoMsgOf(it.id)) + '</span></span>' +
        '</div>';
    }).join('');
  };
  /* 右侧详情（介绍 + 详细设置） */
  /* v89.116（老板「自动治疗下放一个触发记录，如果进行了自动治疗，显示具体兵种及数量」）
     —— 触发记录：每条 = 时间 + 兵种 × 数量 + 治疗费 + 归入城市。
     数据在 `s.autoHealLog`（`GAME.autoHeal` 写入，上限 DATA.AUTO_HEAL_LOG_MAX），
     本函数只负责画（不在界面里另存一份状态）。 */
  ui.autoHealLogHTML = function () {
    var s = GAME.state || {};
    var log = s.autoHealLog || [];
    if (!log.length) {
      return '<div class="auto-note" style="margin-top:var(--sp-4);"><b>触发记录</b></div>' +
        '<div class="auto-note" style="margin:0;">尚无自动治疗记录 —— 开启后每次真治成了都会记一条' +
        '（含兵种与人数）。</div></div>';
    }
    var rows = log.map(function (rec) {
      var d = new Date(rec.t || U.now());
      var by = rec.by || {};
      var items = [];
      Object.keys(by).sort(function (a, b) { return (by[b] || 0) - (by[a] || 0); }).forEach(function (k) {
        var nm = DATA.TROOPS[k] ? DATA.TROOPS[k].name : (k === 'unknown' ? '来历不明' : k);
        items.push(U.escape(nm) + ' ×' + U.numText(by[k], 0));
      });
      if (!items.length) items.push('（无兵种记录，已遣散）');
      return '<div class="res-line"><span class="lbl">🕒 ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes())
        + ':' + U.pad(d.getSeconds()) + '</span><span class="val">'
        + (items.length ? items.join('、') : '（无兵种记录，已遣散）')
        + '　<span class="ui-sub">' + U.numText(rec.n || 0, 0) + ' 人 · ' + U.numText(rec.gold || 0, 0)
        + ' 旧币' + (rec.city ? ' · 归入' + U.escape(rec.city) : '') + '</span></span></div>';
    }).join('');
    return '<div class="auto-note" style="margin-top:var(--sp-4);"><b>触发记录</b>（最近 ' + log.length
      + ' 次 · 逐次列出兵种与人数）</div>' + rows;
  };

  ui.autoPaneHTML = function (id) {
    var s = GAME.state || {}, cfg = GAME.autoMarchCfg ? GAME.autoMarchCfg() : null;
    var it = null;
    ui.AUTO_ITEMS.forEach(function (x) { if (x.id === id) it = x; });
    if (!it) it = ui.AUTO_ITEMS[0];
    var on = ui.autoOnOf(it.id);
    var head = '<div class="ap-head"><span class="ap-ico">' + it.icon + '</span>' +
      '<span class="ap-name">' + it.name + '</span>' +
      '<button class="btn sm' + (on ? ' gold' : '') + '" data-action="' + it.act + '">' +
      (on ? '已开启' : '已关闭') + '</button></div>' +
      '<div class="ap-state">' + U.escape(ui.autoMsgOf(it.id)) + '</div>';
    var body = '';
    if (it.id === 'upgrade') {
      body = '<div class="auto-note">按等级从低到高（<b>不再区分城内城外</b>）；' +
        '<b>每城独立建造位</b> —— 逐城遍历、各自排满（不会几座城合抢一个额度）。' +
        '某项资源不足就<b>顺延试下一项</b>，全部试遍都升不动才暂停（开关不关，资源恢复后自动继续）；' +
        '全部满级则停止。只升级已有建筑，不会替你新建（免得程序改动你的布局）。</div>';
    } else if (it.id === 'research') {
      body = '<div class="auto-note">从科研中心当前能研究的科技里挑最便宜的一项；' +
        '资源不足则暂停等待，不影响开关状态。</div>';
    } else if (it.id === 'buy') {
      var bcfg = GAME.autoBuyCfg ? GAME.autoBuyCfg() : null;
      var bset = (bcfg && bcfg.qty) || 0;   /* v91.72：统一采购数量 */
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<button class="btn gold" data-action="open-auto-buy">⚙️ 详细配置</button>' +
          '<button class="btn" data-action="auto-buy-once">🛒 立即采购</button>' +
          '<span class="ui-sub">统一数量 ' + bset + ' 件/种　·　每 ' + ((bcfg && bcfg.everyMin) || 10) +
            ' 现实分钟补货一次（每商品每现实日上限 ' + GAME.shopDailyMax() + '）</span></div>' +
        '<div class="auto-note">按你设定的**目标持有量**逐商品补货 —— 持有不足目标即买入（补到目标），' +
        '受旧币与每日购买上限约束；已达目标或旧币不足则跳过。</div>';
    } else if (it.id === 'farm') {
      var _fc2 = GAME.autoFarmCfg ? GAME.autoFarmCfg() : null;
      var _crops = ((DATA.FARM && DATA.FARM.crops) || []);
      var _selC = (_fc2 && _fc2.crops) || [];
      var _labN = 0;
      (s.cities || []).forEach(function (ct) {
        if (GAME.buildingLevel(ct, 'honglusi') > 0) _labN++;
      });
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<button class="btn" data-action="auto-farm-once">🧬 立即执行一次</button>' +
          '<span class="ui-sub">建有基因实验室的城市 <b>' + _labN + '</b> 座　·　' +
            (_fc2 && _fc2.on ? '逐城自动立项 / 收获' : '未开启') + '</span></div>' +
        '<div class="auto-line"><span class="al-k">研究项目</span>' +
          '<div class="chips chips-xs" style="justify-content:flex-start;">' +
            _crops.map(function (c) {
              return '<span class="chip' + (_selC.indexOf(c.id) >= 0 ? ' on' : '') +
                '" data-action="autofarm-crop" data-crop="' + c.id + '">' + c.icon + ' ' + c.name + '</span>';
            }).join('') +
          '</div></div>' +
        '<div class="auto-note">项目可多选（只种选中的；<b>都不选 = 全部项目都种</b>）。' +
          '每城先收成熟产物、再补空舱；同一城按"一舱一项目"去重，不会 6 舱全种同一项。' +
          '只对<b>建有基因实验室</b>的城生效；与手动立项/提取共用同一套出口。</div>';
    } else if (it.id === 'march') {
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<button class="btn gold" data-action="open-auto-march">⚙️ 详细配置</button>' +
          '<button class="btn" data-action="auto-march-once">⚔️ 立即出征</button>' +
          '<span class="ui-sub">距离 ' + GAME.autoMarchRadius(cfg) + ' 格　·　今日 ' +
            (cfg.todayCount || 0) + (cfg.dailyMax > 0 ? '/' + cfg.dailyMax : '（不限）') + ' 次　·　' +
            '下次 ' + (cfg.on ? ('约 ' + cfg.everyMin + ' 分钟后（或体力恢复后）') : '未开启') + '</span></div>' +
        '<div class="auto-note"><b>红线（不可关闭）</b>：' +
          '① 只派<b>空闲</b>英雄，出征中/守将/采集中一律跳过；' +
          '② 体力不足以支付本次出征就不出发；' +
          '③ 器械（无人轰炸机/东风快递）、侦察单元、辎重<b>不编入</b>自动队伍 —— ' +
          '它们拖慢行军，且是守城家底；' +
          '④ 只从<b>当前城市</b>取兵；' +
          '⑤ 已占野地与今日已攻破的据点不会被重复打。</div>';
    } else if (it.id === 'explore') {
      var _ecfg = GAME.autoExploreCfg ? GAME.autoExploreCfg() : null;
      var _pid = s.activePlanet || 1, _wd = GAME.wonderOf ? GAME.wonderOf(_pid) : null;
      var _act = GAME.wonderActiveCount ? GAME.wonderActiveCount(_pid) : 0;
      var _max = (DATA.WONDER_CFG || {}).maxActive || 3;
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<button class="btn gold" data-action="open-auto-explore">⚙️ 详细配置</button>' +
          '<button class="btn" data-action="auto-explore-once">✨ 立即探索一次</button>' +
          '<span class="ui-sub">' + (_wd ? (_wd.icon + ' ' + _wd.name) : '本星球暂无奇观') +
            '　·　在途 ' + _act + '/' + _max + ' 队　·　' +
            (_ecfg && _ecfg.on ? ('约 ' + _ecfg.everyMin + ' 分钟一轮') : '未开启') + '</span></div>' +
        '<div class="auto-note"><b>口径</b>：' +
          '① <b>不设固定英雄</b> —— 每城每次现取一枚<b>空闲</b>英雄带队（出征中/守将/采集中跳过）；' +
          '② 兵力取你在「详细配置」里逐兵种填的<b>上限</b>（0 = 不自动派）；' +
          '③ 只对<b>当前所在星球</b>的今日奇观派队，在途满队即等候；' +
          '④ 每城每日次数上限见配置。</div>';
    } else if (it.id === 'gather') {
      var _ws128 = (s.wilds || []).filter(function (w) { return GAME.wildGarrisonTotal(w.garrison) > 0; });
      var _gn128 = GAME.gatherList().length, _gm128 = DATA.GATHER.maxActive;
      /* v91.60（老板）：上限改为**每城** maxActive —— 列出各城已用队数。 */
      var _gcn = 0, _gcl = '';
      (s.cities || []).forEach(function (ct) {
        var n = GAME.gatherCountOfCity(ct.id);
        if (n > 0) { _gcn++; _gcl += (ct.name || ct.id) + ' ' + n + '/' + _gm128 + '　'; }
      });
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<span class="ui-sub">有驻军野地 <b>' + _ws128.length + '</b> · 采集队共 <b>' + _gn128 + '</b> 支' +
          (_gcn ? '（' + _gcl.replace(/　$/, '') + '）' : '') +
          (s.autoGatherState && s.autoGatherState.at ? '　·　上次执行 ' + U.dur((U.now() - s.autoGatherState.at) / 1000) + '前' : '') +
          '</span></div>' +
        '<div class="auto-note">按<b>城市独立</b>进行（<b>每城最多 ' + _gm128 + ' 支</b>采集队 —— 各城各用各的编制）：' +
          '把<b>有驻军的可采野地</b>转入采集（驻军全员入队，满 1 游戏小时即可收、24 小时封顶，采完自动回驻军）。' +
          '某城编制已满 / 野地不可采 / 无驻军 → 自动跳过；与手动采集共用同一套结算出口。</div>';
    } else if (it.id === 'recruit') {
      /* 招募门槛/说明的正文由 ui.autoRecruitHTML 提供（去壳版：外壳与开关由本 pane 统一给） */
      body = ui.autoRecruitHTML();
    } else if (it.id === 'train') {
      /* v89.190（老板 2）：自动征兵设置（正文由 ui.autoTrainHTML 提供） */
      body = ui.autoTrainHTML();
    } else if (it.id === 'heal') {
      var n0 = s.wounded || 0;
      var fee0 = GAME.healFeeOf ? GAME.healFeeOf(n0) : n0 * 10;
      var gold0 = (GAME.res(GAME.currentCity()) || {}).gold || 0;
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<span class="ui-sub">伤兵 <b>' + U.fmt(n0) + '</b> 名　·　治疗费 <b>' + U.fmt(fee0) +
            '</b> 旧币　·　现存 <b>' + U.fmt(gold0) + '</b></span>' +
          '<button class="btn" data-action="heal-wounded"' + (n0 > 0 ? '' : ' disabled') +
            '>立即治疗</button></div>' +
        '<div class="auto-note">伤兵营有伤兵、旧币够治疗费 → <b>自动治完全部</b>' +
          '（花旧币一次结清，15 现实秒最多尝试一次）。' +
          '旧币不足时<b>暂停但不关开关</b>，旧币恢复后自动继续。' +
          '治疗即归队：按兵种把伤兵加回城市，不是"清个数字"。</div>' +
        ui.autoHealLogHTML();
    } else if (it.id === 'invasion') {
      var acc = GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true;
      /* 最近一场（多城取最早）—— 与警报页、预警同一批出口，界面不另算一份 */
      var soonCt = null, soonDue = 0;
      (s.cities || []).forEach(function (ct) {
        var due = GAME.invasionDueAt ? GAME.invasionDueAt(ct) : 0;
        if (!due) return;
        if (!soonDue || due < soonDue) { soonDue = due; soonCt = ct; }
      });
      var need0 = (DATA.INVASION || {}).unlockCities == null ? 2 : DATA.INVASION.unlockCities;
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<span class="ui-sub">' + (acc
            ? (soonCt
              ? '最近一场：<b>' + U.escape(soonCt.name) + '</b> · 剩余 <b>' +
                U.dur(Math.max(0, Math.round((soonDue - GAME.realNow()) / 1000))) + '</b>（现实时间）'
              : '已接受 · 暂无排期（拥有 <b>' + need0 + '</b> 座以上城市后开始）')
            : '已拒战：警报无排期、敌军不来（随时可重开）') + '</span>' +
          '<button class="btn" data-action="go-beacon">🔥 去警报页看预警与布防</button></div>' +
        '<div class="auto-note"><b>开关含义</b>：<b>开启</b> = 接受外敌来犯 —— ' +
          '诸方势力按<b>现实时间</b>轮番来袭；被击破会损资源 / 兵力 / 围墙等级，' +
          '守城得手则有俘获。' +
          '<b>关闭</b> = 拒战 —— 不再有任何来犯与预警（也没有守城俘获）。' +
          (acc ? '' : '<br><b style="color:var(--red-light);">当前：拒绝来犯</b> —— 想恢复历练点上面的按钮重开。') +
        '</div>' +
        ui.invasionRulesHTML() +
        ui.beaconFlowHTML();
    }
    return head + body;
  };
  /* 组装：左 1/3 名单 + 右 2/3 详情 */
  ui.autoHTML = function () {
    if (!ui._autoSel) ui._autoSel = 'upgrade';
    return '<div class="ui-page">' +
      '<div class="gold-heading">🤖 自动化' +
        ui.help('左侧切换自动化功能，右侧看介绍与详细设置。\n' +
          '各项彼此独立；「暂停」只发生在资源/条件不足时 —— 开关不会自己关掉。\n' +
          '自动出征只派空闲英雄、器械与侦察单元不编入，且只从当前城市取兵。') +
      '</div>' +
      '<div class="auto-grid">' +
        '<div class="auto-side">' + ui.autoSideHTML() + '</div>' +
        '<div class="auto-pane">' + ui.autoPaneHTML(ui._autoSel) + '</div>' +
      '</div></div>';
  };
  /* 点选控件（时间倍率 / 税率）—— 与显示比例同款，全站一套 */
  /* ⛔ v89.104：`ui.optBar` 退役 —— 它只服务"设置页税率"那一个点选行，
     税率已移到侧栏（−/＋ 就地调），点选行随之退场。 */

  /* --------- 设置 --------- */

  /* ============================================================
   * v67 · 存档管理面板
   * ------------------------------------------------------------
   * 一屏放 7 个槽位 + 导入区，**不出下拉条**（老板的硬规矩）。
   * 每行的判据：有档才亮「读取/导出/删除」，空槽只留「存入」。
   * 导入走"第一个空的手动槽"，**绝不覆盖**已有档（覆盖式导入是数据事故的常见来源）。
   * ============================================================ */
  ui._svPaste = false;
  ui.svRowHTML = function (s) {
    var m = s.meta;
    var kindTxt = (s.kind === 'main' ? '主档 · 进游戏时读它'
      : (s.kind === 'auto' ? '自动备份' : '手动'));
    var sum;
    if (m) {
      sum = U.escape(m.name) + '　第 ' + (m.year || 1) + ' 年　' +
        '城 ' + m.cities + '　将 ' + m.gens + '　' + (m.size / 1024).toFixed(1) + 'KB';
      if (m.savedAt && GAME.metaTimeText) sum += '　' + GAME.metaTimeText(m.savedAt);
    } else {
      sum = '<span class="sv-empty">（空）</span>';
    }
    var b = '';
    b += '<button class="btn sm' + (s.kind === 'main' ? ' gold' : '') +
      '" data-action="save-slot-write" data-slot="' + s.id + '">存入</button>';
    if (m) {
      if (s.kind !== 'auto') b += '<button class="btn sm" data-action="save-slot-load" data-slot="' + s.id + '">读取</button>';
      b += '<button class="btn sm" data-action="save-slot-export" data-slot="' + s.id + '">导出</button>';
    }
    if (s.kind !== 'main') {
      b += '<button class="btn sm dim" data-action="save-slot-drop" data-slot="' + s.id + '"' +
        (m ? '' : ' disabled') + '>清空</button>';
    }
    return '<div class="sv-row"><div class="sv-n">' + s.name +
      '<div class="sv-s">' + kindTxt + '</div></div>' +
      '<div class="sv-s">' + sum + '</div><div class="sv-b">' + b + '</div></div>';
  };
  ui.openSaveManager = function () {
    var list = GAME.slotList();
    var body = ui.help('存档存在本浏览器里（localStorage）：关网页、关浏览器都还在，' +
      '但**换浏览器、清缓存、或换一个打开方式**（双击文件 vs 本地服务）就看不到了。' +
      '要带走就用「导出」，在另一台机器上用「导入」——导入只会写进空的手动槽，不会覆盖你已有的档。') +
      '<div class="sv-list">' + list.map(ui.svRowHTML).join('') + '</div>' +
      '<div class="sv-imp">' +
        '<div class="auto-line">' +
          '<button class="btn sm" data-action="save-import-file">📂 选择存档文件…</button>' +
          '<button class="btn sm" data-action="save-import-toggle">' +
            (ui._svPaste ? '收起粘贴框' : '✍️ 粘贴存档文本…') + '</button>' +
        '</div>' +
        (ui._svPaste
          ? '<textarea id="sv-paste" class="sv-ta" placeholder="把导出的存档文本整段粘贴到这里"></textarea>' +
            '<div class="auto-line" style="margin-top:6px;">' +
            '<button class="btn sm gold" data-action="save-import-text">导入</button></div>'
          : '') +
      '</div>';
    ui._modalKind = 'saves';
    ui.openShell({
      title: '💾 存档管理', sub: '主档 + 3 手动槽 + 3 自动备份',
      body: body, size: 'xl',
      /* ⚠️ openShell 的 foot 是 **HTML 字符串**（modalShell 直接拼接），不是数组 */
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  ui.settingsHTML = function () {
    /* ============================================================
     * v89.104（老板）：「设置界面的内容搞紧凑一点，就这么几样东西都搞出下拉框来了」
     *   ＋「设置里不要音效」＋「存档管理有两处，统一一下」
     *   ＋「税率调整直接放左侧统计栏的税率处」＋「离线推进上限解除，设置里不要这个」
     *   ＋「显示比例…连续拖动 80%-120%」
     * ------------------------------------------------------------
     * 结果：设置页只剩 **四行**（显示比例 / 时间倍率 / 界面主题 / 存档管理），
     * 全部就地点选（chips）或拖动（range），没有下拉框；
     * 音效、离线上限、税率三块整体撤出（音效一律不播、离线上限=不限、税率移到侧栏）。
     * ============================================================ */
    var s = GAME.state;
    var ts = s.settings.timeScale || 1;
    var z = Math.max(ui.ZOOM_MIN, Math.min(ui.ZOOM_MAX, ui.zoom()));
    var nSlot = 0;
    GAME.slotList().forEach(function (x) { if (x.meta) nSlot++; });
    return '<div class="ui-page">' +
      '<div class="gold-heading">⚙️ 设置</div>' +
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">🔍 显示比例</span><span class="val" id="zoom-txt">' + z + '%</span></div>' +
        '<div class="auto-line">' + ui.zoomBarHTML() + '</div>' +
      '</div>' +
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">⏱️ 时间倍率</span><span class="val">' + ts + '×</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'timescale',
          opts: [1, 10, 30, 120, 300, 600].map(function (v) {
            return { v: v, on: ts === v, label: v + '×' };
          })
        }) + '</div>' +
      '</div>' +
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">🎨 界面主题</span><span class="val">' +
          ui.themeDef(ui.theme()).name + '</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'theme',
          opts: (DATA.THEMES || []).map(function (t) {
            return { v: t.id, on: ui.theme() === t.id, label: t.name };
          })
        }) + '</div>' +
      '</div>' +
      /* v158.43（老板「把 WSAD 之类操作方式说明放到设置中，别占屏幕」）：
         操作说明从屏幕 HUD 集中搬到设置页 —— 不再占屏，需要时来这里查。 */
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">🕹️ 操作说明</span><span class="val">大世界 · 键位一览</span></div>' +
        '<div class="ui-sub" style="line-height:2;">' +
          '<b>地面</b>：<b>W A S D</b> 或 <b>↑↓←→</b> 走动　·　<b>左键</b> 点哪走哪　·　<b>左键长按拖动</b> 平移镜头　·　<b>右键长按拖动</b> 转动视角<br>' +
          '<b>交互</b>：走到目标旁按 <b>E</b> 查看 / 上车 / 对话　·　<b>滚轮</b> 升降视野高度<br>' +
          '<b>建造</b>：切「建造」模式后，左键点地块 = 勘探 / 放置　·　<b>R</b> 旋转手持物<br>' +
          '<b>高空</b>：<b>W</b> 加速 / <b>S</b> 减速（空天飞机惯性滑行）　·　<b>A D</b> 转向　·　<b>右键</b> 转头（双击回正）　·　<b>滚轮</b> 缩放　·　<b>左键</b> 停止飞行' +
        '</div>' +
      '</div>' +
      /* v151（老板：「打一场仗要盯 3~5 分钟，设置里还找不到开关」）：
         战斗节奏 = 两枚就地点选（观战 / 每回合读秒）。默认 10 秒。 */
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">⚔️ 战斗</span><span class="val">' +
          (s.settings.battleWatch === false ? '不进战场 · 自动结算' : '进战场 · 你说了算') + '</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'battlewatch',
          opts: [{ v: '1', on: s.settings.battleWatch !== false, label: '进战场观战' },
                 { v: '0', on: s.settings.battleWatch === false, label: '全自动结算' }]
        }) + '</div>' +
        '<div class="res-line" style="margin-top:6px;"><span class="lbl">⏱️ 每回合读秒</span><span class="val">' +
          ((s.settings.battleSec | 0) || 10) + ' 秒</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'battlesec',
          opts: [6, 10, 20, 30, 60].map(function (v) {
            return { v: v, on: ((s.settings.battleSec | 0) || 10) === v, label: v + 's' };
          })
        }) + '</div>' +
        '<div class="ui-sub" style="margin-top:6px;">战场里每回合都能三选一（突击 / 稳住 / 撤退）；' +
          '不想等就点「完成回合」。' + ui.help('读秒只控制"这回合什么时候结算"，不锁你的操作 —— 点完成回合立即进下一合。') + '</div>' +
      '</div>' +
      /* 存档管理：**唯一入口**（原先页首与页尾各一张卡，现在合并成一张）
         v89.199：margin-bottom:0 让给其后的「运行版本」卡（末卡收底）。 */
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">💾 存档管理</span><span class="val">' + nSlot + ' / 7 有档</span></div>' +
        '<div class="auto-line">' +
          '<button class="btn gold" data-action="open-saves">存档 / 读取 / 导出 / 导入</button>' +
          '<button class="btn" data-action="save">保存进度</button>' +
          '<button class="btn red" data-action="new-game">新游戏（清档）</button>' +
        '</div>' +
        '<div class="ui-sub" style="margin-top:6px;">自动存档每 5 分钟一次（覆盖式写入，只保留最新一档）' +
          ui.help('存档 v3。导入走"第一个空的手动槽"，绝不覆盖已有档。') + '</div>' +
      '</div>' +
      /* v89.199（老板）：**运行版本行** —— 页面"长开不刷新"会一直跑旧会话代码
         （更新文件后旧页面不会自动换新代码），版本不一致时强制刷新即获得最新交付。 */
      '<div class="set-card" style="margin-bottom:0;">' +
        '<div class="res-line"><span class="lbl">🧩 运行版本</span><span class="val">' +
          U.escape(GAME.VERSION || '未知') + '</span></div>' +
        /* v157.91：**包 hash**（index.html 里 script 标签的 ?v=）。
           为什么加：老板连报三次"还有斑纹"，而我这边同版复现不出 —— 需要一条能证明
           "你屏幕上是哪一个包"的硬凭据。hash 与实际加载的 bundle 同源，不吃缓存就是新值。*/
        '<div class="res-line"><span class="lbl">📦 包 hash</span><span class="val" data-build-hash>' +
          U.escape((function () {
            try {
              var st = document.querySelector('script[src*="bundle-ui.js"]');
              var m = st && /[?&]v=([0-9a-f]{8})/.exec(st.src);
              return m ? m[1] : '未知';
            } catch (e) { return '未知'; }
          })()) + '</span></div>' +
        '<div class="ui-sub" style="margin-top:6px;">若与最新交付不一致：按 <b>Ctrl + F5</b> 强制刷新后即加载新代码' +
          ui.help('页面运行的是"打开那一刻"的代码；本行为运行时版本（GAME.VERSION）。') + '</div>' +
        '<div class="ui-sub" style="margin-top:6px;">键盘：<b>1-9</b> 切页 · <b>Shift+1-3</b> 续号（公文 / 自动 / 设置）· <b>Esc</b> 关弹窗 · 弹窗内 <b>Tab / Enter</b> 导航</div>' +
      '</div>' +
      '</div>';
  };

  /* ============================================================
   * 自动化（v29 · 需求 5）—— 顶栏「自动」菜单
   * ------------------------------------------------------------
   * 三件事放在一起：自动升级 / 自动研究 / **自动出征**。
   * 自动出征的参数（英雄 · 兵力 · 目标 · 目标等级 · 出征类型 · 频率）
   * 全部在下面这六个点选行里给出，改完立即生效、下一轮按新参数执行。
   * 面板里同时把"红线"写清楚（只派空闲将、体力不足不出征、器械不编入），
   * 免得玩家以为系统会无条件地把家底打光。
   * ============================================================ */
  /* ⛔ v89.104（老板）：`autoReserveLine` 退役 —— 预算闸门与"自动研究上限"
     两个设置项整体撤除（自动化只挑候选，不再自己设线）。 */

  /* ============================================================
   * 自动出征「详细配置」弹窗（v89.65 · 老板：「自动出征精细化，
   *   根据现有出征界面形成弹窗即可……加入自动出征特有的字段」）
   * ------------------------------------------------------------
   * 版面**照抄出征面板**：同一个 .exp-grid 两栏 + .exp-sec / .exp-sel / .exp-tbl，
   * 所以两处看起来是一家人。差别只在内容：
   *   左栏 = **策略**：执行英雄 / 目标与等级 / 出征方式 / 兵力与留守 / 频率与上限；
   *   右栏 = **只读编成表**：自动编队按 DATA.AUTO_MARCH.troopOrder 取，
   *          器械／侦察单元／辎重不编入 —— 刻意**没有输入框**：无人值守时"派多少兵"
   *          由策略决定，逐兵种手填是出征面板的事（一件事只在一个地方说）。
   * 自动出征**特有**的字段（出征面板没有的）：
   *   ① 出征频率（现实分钟节流）　② 每日次数上限　③ 城内留守兵力。
   * 「改完即生效」：下拉 change → 写 cfg → **就地重开本弹窗**，
   * 于是可派兵力、今日次数、守军等随之刷新（与出征面板同一套做法）。
   * ============================================================ */
  /* v89.83（老板「自动出征的界面再依据出征界面进行修整，再加入其他自动化选项。
     目标的选择可以加上距离，等级的选择直接给出等级列表，无需兵力留守这个菜单项」）
     ------------------------------------------------------------
     与出征面板的关系：**同一套版面、同一套出口**（.exp-grid 两栏 / .exp-sec / .exp-sel / .exp-tbl），
     差别只在内容 —— 出征面板是"这一趟怎么打"，这里是"无人值守时每趟都怎么打"。
       左栏 = 策略：执行英雄 · 目标（类型/等级/距离）· 出征方式 · 计略 · 出征战术 · 频率与上限
       右栏 = 兵力：单次兵力 + 只读编成表 + 今日次数 / 上次结果
       底部 = 预估（与出征面板同源的 travelTime / 编队 / 守军出口）
     本轮的四处改动：
       ① 目标加**距离**（搜索半径，唯一出口 autoMarchRadius）；
       ② 等级改**按目标类型给真实等级列表**（野地/据点 1~10，名城 12/16/20/24）——
          改前一张通用表 [12,16,20,24] 在选「野地」时**一个目标都筛不出来**；
       ③ 补上出征面板有、这里缺的**计略**与**出征战术**（都走既有出口，
          计略在出发时校验、不通过则本次不用计并写明原因 —— 无人值守不能被计略卡死）；
       ④ 退役「城内留守」：它与「单次兵力」是同一件事的两种说法。
     「改完即生效」：下拉 change → 写 cfg → **就地重开本弹窗**，于是预估、可派兵、
     今日次数随之刷新（与出征面板同一套做法）。
     v89.198（老板 1）：「管理弹窗」统一行改造 —— 名称固定列 + 右边直接下拉框（双写退役）、
     说明进悬停、出征战术行与出征面板同构（含「设置」链）；阵位摘要行随老板 3 退役。 */
  ui.amEstHTML = function (pv) {
    if (!pv) return '';
    if (!pv.ok) return '<div class="exp-info exp-info-l" style="color:var(--warn);margin-bottom:0;">' + U.escape(pv.msg) + '</div>';
    var genTxt = pv.gen ? U.escape(pv.gen.name) : '（未指定英雄）';
    return '<div class="exp-info exp-info-l" style="margin-bottom:4px;">🛫 目标 <b>' + U.escape(pv.label) + '</b>' +
      '　距离 <b>' + pv.dist + '</b> 格　·　' + genTxt + ' 率 <b>' + U.numText(pv.total, 0) + '</b> 兵' +
      '　·　预计 <b style="color:var(--gold-light)">' + U.durExact(pv.travel) + '</b></div>' +
      '<div class="exp-info exp-info-l" style="margin-bottom:0;">👥 守军约 <b>' + U.numText(pv.def, 0) + '</b> 名' +
      (pv.total > 0 && pv.def > 0
        ? '　·　兵力比 <b style="color:' + (pv.total >= pv.def ? 'var(--green-ok)' : 'var(--red-light)') + ';">' +
          (pv.total / pv.def).toFixed(2) + ' : 1</b>'
        : '') + '</div>';
  };
  ui.openAutoMarch = function () {
    var s = GAME.state, A = DATA.AUTO_MARCH, cfg = GAME.autoMarchCfg();
    if (!cfg) return;
    var city = GAME.currentCity();
    var mode = GAME.battle.modeOf(cfg.mode);
    var have = city ? GAME.armyTotal(city) : 0;
    var idle = (s.generals || []).filter(function (g) { return !g.status || g.status === 'idle'; });
    var left = GAME.autoMarchTodayLeft(cfg);
    var rad = GAME.autoMarchRadius(cfg);
    var lvList = GAME.autoMarchLevelOpts(cfg);
    var pv = GAME.autoMarchPreview(cfg);

    /* 下拉拼装（唯一出口 —— 每行同形，只这里写一次）。
       v89.198（老板 1）：改**统一行**（ui.expRowHTML：名称固定列 4.5em + 右边直接下拉框），
       与出征面板同一套规范；说明（desc / 校验口径 / 起点距离规则）一律进悬停。 */
    var sel = function (id, opts) {
      var inner = (typeof opts === 'string') ? opts : opts.map(function (o) {
        return '<option value="' + o.v + '"' + (o.on ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('');
      return '<select id="' + id + '">' + inner + '</select>';
    };

    /* v91.53（老板）：「执行英雄固定首行加『不指定英雄』，会**随机选择当前空闲英雄**」——
       首行哨兵 v='' = 不指定（每城各随机取一枚空闲英雄）；其余为具体英雄。 */
    var genOpts = [{ v: '', on: !cfg.genId, label: '🎲 不指定英雄（随机指派空闲英雄）' }].concat(
      (s.generals || []).map(function (g) {
        var busy = g.status && g.status !== 'idle';
        return { v: g.id, on: g.id === cfg.genId,
          label: U.escape(g.name) + (busy ? '（' + ui.genStatusName(g) + '）' : '') };
      }));

    /* v91.80（老板）：已「按城指定」英雄的城数（界面提示用） */
    var _cg = cfg.cityGen || {}, _cgN = 0;
    for (var _cgk in _cg) if (_cg[_cgk]) _cgN++;

    var tgtOpts = A.targetOptions.map(function (x) { return { v: x[0], on: cfg.target === x[0], label: x[1] }; });
    /* v89.83：等级候选按**当前目标类型**给（野地/据点 1~10；名城 12/16/20/24） */
    var lvOpts = lvList.map(function (v) {
      return { v: v, on: v === cfg.maxLevel, label: '≤ Lv' + v };
    });
    var radOpts = (A.radiusOptions || []).map(function (v) {
      return { v: v, on: v === rad, label: v + ' 格' + (v === A.defaultRadius ? '（默认）' : '') };
    });
    var modeOpts = ((DATA.EXPEDITION && DATA.EXPEDITION.modes) || []).map(function (m) {
      return { v: m.id, on: cfg.mode === m.id,
        label: m.icon + ' ' + m.name + '（体' + m.stamina + ' 精' + m.energy + '）' };
    });
    var schemeOpts = [{ v: '', on: !cfg.scheme, label: '未用计（不耗封存匣）' }].concat(
      (DATA.SCHEMES || []).filter(function (sc) { return sc.kind === 'attack' || sc.kind === 'march'; })
        .map(function (sc) {
          return { v: sc.id, on: cfg.scheme === sc.id,
            label: sc.icon + ' ' + sc.name + '（精' + sc.energy + ' · 囊' + sc.jinang + '）' };
        }));
    /* ⛔ v89.140（老板 7'）：`troopOpts`（单次兵力下拉的选项）随该块退役 */
    var freqOpts = A.freqOptions.map(function (v) { return { v: v, on: v === cfg.everyMin, label: v + ' 分钟' }; });
    var dailyOpts = (A.dailyOptions || [0]).map(function (v) {
      return { v: v, on: v === cfg.dailyMax, label: v ? ('每日 ' + v + ' 次') : '不限次数' };
    });

    /* 右栏编成表（v89.140 老板 7'）：「兵种编成这里保留 **3 列**：兵种、拥有（改成**驻军数量**）、
       **自动出征数量**（各兵种提供数量输入框）」——
       输入框直接写 cfg.army[tid]（`army:<tid>` 键，经 doSetAutoMarch）；
       v91.36（老板「兵种列表不全…去除兵种名称前的垃圾小图标」）：
       · 列表改为**全部可作战兵种**（含器械）——与出征面板同口径（只剔 nocombat 侦察），
         "不全"即此前漏了器械（东风快递 / 无人轰炸机）两行；
       · 兵种名**不再带图标前缀**（图标是噪声，名称本身够读）。 */
    /* v91.79（老板）：右侧兵种**不再引用某城市现存兵种**，改为「玩家设定编成组成」——
       各城按自身驻军与练兵场容量匹配，达不到的城市自动跳过不出征。 */
    var _comp79 = {};
    Object.keys(cfg.army || {}).forEach(function (id) { var q = Math.max(0, Math.floor(cfg.army[id] || 0)); if (q > 0) _comp79[id] = q; });
    var troopBlock = '<table class="tbl exp-tbl"><colgroup>' +
      '<col class="et-c-name"><col class="et-c-in"></colgroup><thead><tr>' +
      '<th>兵种</th><th class="ctr">出征数量</th></tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).filter(function (id) { var t = DATA.TROOPS[id]; return t && !t.nocombat; }).map(function (id) {
        var tr = DATA.TROOPS[id] || {}, cfgN = (cfg.army && cfg.army[id]) || 0;
        return '<tr class="et-row' + (cfgN > 0 ? ' on' : '') + '">' +
          '<td class="et-name">' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-in"><input type="number" id="am-a-' + id + '" min="0" value="' + cfgN + '"></td></tr>';
      }).join('') + '</tbody></table>';
    /* 各城可达标统计（让玩家一眼看清哪些城能执行） */
    var _reach = { ok: 0, total: 0 };
    if (_comp79 && Object.keys(_comp79).length) {
      GAME.planetsOf().forEach(function (pl) {
        (s.cities || []).filter(function (c) { return GAME.pidOf(c) === pl.id; }).forEach(function (ct) {
          _reach.total++; if (GAME.autoMarchMatchCity(ct, _comp79).ok) _reach.ok++;
        });
      });
    }

    var html = '<div class="gold-heading">⚔️ 自动出征 · 详细配置' +
      '<span style="font-weight:400;font-size:var(--fs-sub);color:var(--text-dim);">' +
      '（无人值守按下列策略循环出征）</span>' + ui.help(
        '与出征面板同源：兵力取法、出征方式、目标搜索都走同一套出口。\n' +
        '自动出征特有的：出征频率 / 每日次数上限 / 搜索距离。\n' +
        '计略在**每次出发时**校验，不通过则本次不用计并写明原因 —— 不会因为没封存匣就不动。') + '</div>' +
      '<div class="exp-grid">' +
        '<div class="exp-col-l">' +
          /* ① 执行英雄（v89.198：统一行 —— 名称列 + 右边直接下拉；规则说明进悬停） */
          '<div class="exp-sec">' +
            ui.expRowHTML('执行英雄', sel('am-gen', genOpts) +
                '<span class="exp-tac-link" data-action="open-am-citygen">按城指定' +
                (_cgN ? '（' + _cgN + ' 城）' : '') + '</span>',
              '只派空闲英雄；出征中／守将／采集中一律跳过（现空闲 ' + idle.length + ' 位）。\n' +
              '优先级：按城指定 > 全局指定 > 不限（随机取空闲，优先本城）。\n' +
              '「按城指定」可为每座城单独固定英雄；未指定的城 = 不限。') + '</div>' +
          /* ② 目标：类型 · 等级 · 距离（三行同一名称列宽） */
          '<div class="exp-sec">' +
            ui.expRowHTML('目标类型', sel('am-target', tgtOpts), null) +
            ui.expRowHTML('目标等级', sel('am-level', lvOpts), null) +
            ui.expRowHTML('搜索距离', sel('am-radius', radOpts),
              '以「' + U.escape(city ? GAME.cityLabel(city) : '—') + '」为起点，' + rad +
              ' 格内取最近目标（' + (cfg.target === 'city' ? '名城不在坐标里找，取最近一座' : '切比雪夫距离') + '）') +
          '</div>' +
          /* ③ 出征方式 · 计略 ／ 出征战术 · 频率上限（与出征面板同款 .exp-quad + 统一行） */
          '<div class="exp-quad">' +
            '<div class="exp-sec">' +
              ui.expRowHTML('出征方式', sel('am-mode', modeOpts), U.escape(mode.desc || '')) + '</div>' +
            '<div class="exp-sec">' +
              ui.expRowHTML('计略', sel('am-scheme', schemeOpts), '出发时校验，不通过则本次不用计') + '</div>' +
            /* 出征战术行**直接复用出征面板的选项出口**（expTacticOptionsHTML）——
               两处各写一份选项 = 两个出口，加一种战术就会漏一处。
               v89.198（老板 3）：阵位摘要/逐兵种链退役；补「设置」链与出征面板同构。 */
            '<div class="exp-sec">' +
              ui.expRowHTML('出征战术',
                sel('am-tactic', ui.expTacticOptionsHTML()) +
                '<span class="exp-tac-link" data-action="open-tactic-set">设置</span>', null) + '</div>' +
            '<div class="exp-sec">' +
              ui.expRowHTML('出征频率', sel('am-freq', freqOpts), null) +
              ui.expRowHTML('每日上限', sel('am-daily', dailyOpts), null) +
              '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">今日已出征 ' +
              (cfg.todayCount || 0) + ' 次' +
              (left === Infinity ? '（不限次数）' : '，尚可 ' + left + ' 次') + '</div></div>' +
          '</div>' +
          /* ④ 预估（与出征面板同源） */
          '<div class="exp-sec"><div class="exp-sec-t">预估</div>' + ui.amEstHTML(pv) + '</div>' +
        '</div>' +
        '<div class="exp-col-r">' +
          '<div class="exp-sec exp-a-troops"><div class="exp-sec-t">编成组成（玩家设定）</div>' +
            '<div class="exp-troops exp-body">' + troopBlock + '</div>' +
            '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
            (_reach.total ? ('设定一支队伍的兵种组成；当前可达标城市 <b>' + _reach.ok + ' / ' + _reach.total + '</b>（达不到的城市自动跳过）。') : '设定一支队伍的兵种组成（0 = 不带）。') +
            '各城按自身驻军与练兵场出征容量匹配。</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="exp-foot">' +
        '<button class="btn' + (cfg.on ? ' gold' : '') + '" data-action="am-toggle">' +
          (cfg.on ? '⏸ 关闭自动出征' : '▶️ 开启自动出征') + '</button>' +
        '<button class="btn" data-action="am-once">立即出征一次</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>' +
      '</div>';
    /* v89.140（老板 7'）：「不要这种播报：上次结果：杨秀 率 500 兵 侦查 矿口」——
       该行整条删除（结果仍在公文/日志里可查，主面板不再常驻一行噪声）。 */

    ui.openModal(html, { size: 'xxl' });   /* v89.105：内容实测超 xl（出征 711 / 自动出征 815） */
    /* 下拉「改完即生效」：写 cfg → 就地重开（数值字段一律走 doSetAutoMarch 的转换，
       界面不自己 Number()，免得"界面转一遍、分发器转一遍"两个出口） */
    var bind = function (id, key) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        GAME.doSetAutoMarch(key, el.value);
        ui.openAutoMarch();
      });
    };
    bind('am-gen', 'genId'); bind('am-target', 'target'); bind('am-level', 'maxLevel');
    bind('am-radius', 'radius'); bind('am-mode', 'mode'); bind('am-scheme', 'scheme');
    /* v89.140（老板 7'）：`am-troops`（单次兵力）退役 —— 改为逐兵种输入框（`am-a-<tid>`）。
       写值走 doSetAutoMarch('army:<tid>')，界面不自己拼 cfg（保留"唯一出口"）。 */
    bind('am-freq', 'everyMin'); bind('am-daily', 'dailyMax');
    (function () {
      var ins = document.querySelectorAll('[id^="am-a-"]');
      for (var ii = 0; ii < ins.length; ii++) {
        (function (el2) {
          el2.addEventListener('change', function () {
            GAME.doSetAutoMarch('army:' + el2.id.slice(5), el2.value);
          });
        })(ins[ii]);
      }
    })();
    /* 出征战术不存 cfg —— 它写的是全局战术（GAME.state.tactics），
       与出征面板共用同一个出口 ui.expApplyTactic（"一处设定、两处生效"）。 */
    var _tacSel = document.getElementById('am-tactic');
    if (_tacSel) _tacSel.addEventListener('change', function () {
      ui.expApplyTactic(_tacSel.value);
      ui.openAutoMarch();
    });
  };

  /* ============================================================
   * v91.80（老板）：「自动出征的执行英雄可不限，但提供弹窗选择，列出可选城市，
   *   对应城市提供英雄下拉框选择，选项前带勾选框，供选中/不选中」——
   *   按城指定执行英雄：{ cityId: genId } 写进 cfg.cityGen，唯一出口
   *   doSetAutoMarch('cityGen:<cid>')（与 army:<tid> 同构，界面不自己改 cfg）。
   *   勾选框 = 该城是否固定英雄（不勾 = 不限，随机取空闲）；下拉只列**本城**在册英雄。
   * ============================================================ */
  ui.openAutoMarchCityGen = function () {
    var s = GAME.state, cfg = GAME.autoMarchCfg();
    if (!cfg) return;
    var _cg = cfg.cityGen || {};
    var _gensOf = function (cid) {
      return (s.generals || []).filter(function (g) {
        var gc = GAME.genCityOf ? GAME.genCityOf(g) : null;
        return gc && gc.id === cid;
      });
    };
    var rows = '';
    GAME.planetsOf().forEach(function (pl) {
      var list = (s.cities || []).filter(function (c) { return GAME.pidOf(c) === pl.id; });
      if (!list.length) return;
      rows += '<tr class="et-row"><td colspan="3" style="font-weight:600;color:var(--text-dim);">' +
        U.escape(pl.name || ('星球 ' + pl.id)) + '</td></tr>';
      list.forEach(function (c) {
        var gens = _gensOf(c.id), cur = _cg[c.id] || '';
        var opts = '<option value=""' + (cur ? '' : ' selected') + '>🎲 不限（随机空闲英雄）</option>' +
          gens.map(function (g) {
            var busy = g.status && g.status !== 'idle';
            return '<option value="' + g.id + '"' + (g.id === cur ? ' selected' : '') + '>' +
              U.escape(g.name) + (busy ? '（' + ui.genStatusName(g) + '）' : '') + '</option>';
          }).join('');
        rows += '<tr class="et-row' + (cur ? ' on' : '') + '">' +
          '<td class="ctr"><input type="checkbox" id="am-cg-on-' + c.id + '"' + (cur ? ' checked' : '') + '></td>' +
          '<td class="et-name">' + U.escape(GAME.cityLabel(c)) + '</td>' +
          '<td class="et-in"><select id="am-cg-gen-' + c.id + '">' + opts + '</select></td></tr>';
      });
    });
    var n = 0;
    for (var k in _cg) if (_cg[k]) n++;
    var html = '<div class="gold-heading">⚔️ 按城指定执行英雄' +
      '<span style="font-weight:400;font-size:var(--fs-sub);color:var(--text-dim);">' +
      '（已指定 ' + n + ' 座城 · 未勾选的城 = 不限）</span></div>' +
      '<div class="exp-info exp-info-l" style="color:var(--text-dim);">' +
      '勾选框 = 该城固定使用所选英雄；<b>不勾选 = 该城不限</b>（随机取空闲英雄，优先本城）。' +
      '英雄下拉只列<b>本城</b>在册英雄。</div>' +
      '<div class="exp-troops exp-body" style="max-height:52vh;overflow:auto;">' +
      '<table class="tbl exp-tbl"><colgroup><col style="width:3.2em">' +
      '<col class="et-c-name"><col class="et-c-in"></colgroup>' +
      '<thead><tr><th class="ctr">指定</th><th>城市</th><th>执行英雄</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3" style="color:var(--text-dim);">暂无城市</td></tr>') +
      '</tbody></table></div>' +
      '<div class="exp-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html, { size: 'xl' });
    /* 勾选框与下拉任一变动 → 按「勾中且有英雄 → 写；否则 → 清（= 不限）」落盘。
       不重开本弹窗（重开会丢滚动位置），doSetAutoMarch 内部的 refreshView 已同步主视图。 */
    var _apply = function (cid) {
      var cb = document.getElementById('am-cg-on-' + cid);
      var sl = document.getElementById('am-cg-gen-' + cid);
      if (!cb || !sl) return;
      GAME.doSetAutoMarch('cityGen:' + cid, cb.checked ? sl.value : '');
    };
    (s.cities || []).forEach(function (c) {
      var cb = document.getElementById('am-cg-on-' + c.id);
      var sl = document.getElementById('am-cg-gen-' + c.id);
      if (cb) cb.addEventListener('change', function () { _apply(c.id); });
      if (sl) sl.addEventListener('change', function () {
        var cb2 = document.getElementById('am-cg-on-' + c.id);
        if (cb2) cb2.checked = !!sl.value;   /* 选了具体英雄 → 自动勾上；选「不限」→ 自动取消 */
        _apply(c.id);
      });
    });
  };

  /* ============================================================
   * v91.59（老板）：「增加自动采购功能，可以设定所有商品的数量，每现实日均购买 X 件」——
   *   逐商品设目标持有量（0 = 不自动买）；主循环按频率补货到目标（受旧币 + 每日上限钳制）。
   *   版面：频率下拉 + 逐商品目标下拉（bought 走 GAME.doSetAutoBuy('item:<id>')）。
   * ============================================================ */
  ui.openAutoBuy = function () {
    var cfg = GAME.autoBuyCfg();
    if (!cfg) { ui.toast('尚未开局'); return; }
    var A = DATA.AUTO_BUY || {};
    var freqOpts = (A.freqOptions || [1, 3, 5, 10, 20, 30]).map(function (m) {
      return { v: m, on: m === cfg.everyMin, label: m + ' 分钟' };
    });
    var tgtOpts = (A.targetOptions || [0, 1, 3, 5, 10, 20, 50, 100]).map(function (n) {
      return { v: n, label: n === 0 ? '不自动买' : ('目标 ' + n) };
    });
    /* v91.72（老板）：统一数量 —— 不再逐商品各设一个目标。 */
    var uniSel = '<select id="ab-qty">' + tgtOpts.map(function (o) {
      return '<option value="' + o.v + '"' + (o.v === (cfg.qty || 0) ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('') + '</select>';
    var freqSel = '<select id="ab-freq">' + freqOpts.map(function (o) {
      return '<option value="' + o.v + '"' + (o.on ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('') + '</select>';
    var items = GAME.ui.shopItems();
    var rows = items.map(function (it) {
      var have = (GAME.state.items || {})[it.id] || 0;
      var left = GAME.shopTodayLeft(it.id);
      return '<div class="lf-row"><span class="lf-nm">' + U.escape(it.name) +
        '<i>持有 ' + U.numText(have, 0) + '　·　今日余 ' + left + '</i></span>' +
        '<span class="lf-step"><span class="ui-sub">补到 ' + (cfg.qty || 0) + '</span></span></div>';
    }).join('');
    var html = '<div class="gold-heading">🛒 自动采购 · 详细配置</div>' +
      ui.expRowHTML('补货频率', freqSel, '每多久尝试补货一次（现实时间）') +
      ui.expRowHTML('统一数量', uniSel, '每种商品都补到这个持有量（0 = 不自动买）') +
      '<div class="auto-note" style="margin-top:8px;">**统一设定一个数量**：所有可购商品都补到该持有量，' +
        '受旧币与**每商品每现实日上限 ' + GAME.shopDailyMax() + ' 件**约束；已达数量或旧币不足的跳过。</div>' +
      '<div class="lf-list">' + (rows || '<div class="q-empty">暂无可购买商品。</div>') + '</div>' +
      '<div class="m-foot">' +
        '<button class="btn' + (cfg.on ? ' gold' : '') + '" data-action="ab-toggle">' +
          (cfg.on ? '⏸ 关闭自动采购' : '▶️ 开启自动采购') + '</button>' +
        '<button class="btn" data-action="ab-once">立即采购一次</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html, { size: 'xl' });
    /* 下拉改完即生效 */
    var fq = document.getElementById('ab-freq');
    if (fq) fq.addEventListener('change', function () { GAME.doSetAutoBuy('everyMin', fq.value); ui.openAutoBuy(); });
    var uq = document.getElementById('ab-qty');
    if (uq) uq.addEventListener('change', function () { GAME.doSetAutoBuy('qty', uq.value); ui.openAutoBuy(); });
  };

  /* ============================================================
   * v91.36（老板）：「增加自动探索功能 —— 城中有任意空闲英雄和可用兵种时，
   *   每个城市均可向奇观派遣探索队。其他设置参考自动出征，但**不设固定英雄**。」
   * ------------------------------------------------------------
   * 版面照抄「自动出征 · 详细配置」的左列（频率/每日上限/预估）+ 右列（逐兵种数量上限），
   * 去掉英雄/目标/等级/距离/方式/计略（自动探索无这些旋钮）。
   * ============================================================ */
  /* v91.83：奇观**行为链**现状 —— 逐行动标出"可派 / 为什么不可派"（界面与域层同一出口
     `GAME.autoExploreActsFor`，不另写判据）。附「自动清层」开关。 */
  ui.aeChainHTML = function (chain, cfg) {
    var rows = [];
    (chain.feas || []).forEach(function (f) {
      rows.push('<div class="exp-info exp-info-l">✅ <b>' + U.escape(f.name) + '</b>　'
        + (f.total ? ('编成 ' + U.fmt(f.total) + ' 兵' + (f.load ? ' · 负重 ' + U.fmt(f.load) : ''))
                   : '仅需英雄 · 不带兵')
        + '</div>');
    });
    (chain.blocked || []).forEach(function (b) {
      var ic = b.kind === 'lock' ? '🔒' : '⚠️';
      rows.push('<div class="exp-info exp-info-l" style="color:var(--text-dim);">'
        + ic + ' ' + U.escape(b.name) + ' —— ' + U.escape(b.why) + '</div>');
    });
    if (!rows.length) rows.push('<div class="exp-info exp-info-l" style="color:var(--text-dim);">本奇观未收录任何行动</div>');
    return '<div style="margin-top:6px;">' + rows.join('') +
      '<label style="display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer;">' +
      '<input type="checkbox" id="ae-autoclear"' + (cfg.autoClear ? ' checked' : '') + '>' +
      '<span>无可行行动时<b>自动派兵破下一层</b>（清层 → 解锁行动 → 采集）'
      + '　<i class="gd-sub">默认开 · 编成低于该层建议兵力时不出战 · 不占每日次数</i></span></label>' +
      /* v92.1：探路开关 —— 挂机也能推进探索，但默认关（不打招呼就烧兵是坏设计）。 */
      '<label style="display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer;">' +
      '<input type="checkbox" id="ae-probe"' + (cfg.probe ? ' checked' : '') + '>' +
      '<span>奇观无活时<b>顺带派侦察探路</b>（往已探明边缘外推）'
      + '　<i class="gd-sub">默认关 · 用上面的探索编成 · 吃每城每日次数 · 抵达后点亮周围 6 格</i></span></label>' +
      '</div>';
  };

  ui.openAutoExplore = function () {
    var s = GAME.state, cfg = GAME.autoExploreCfg();
    if (!cfg) return;
    var pid = s.activePlanet || 1;
    var wd = GAME.wonderOf ? GAME.wonderOf(pid) : null;
    var E = DATA.AUTO_EXPLORE || {};
    var present = GAME.wonderPresent ? GAME.wonderPresent(pid) : true;
    var active = GAME.wonderActiveCount ? GAME.wonderActiveCount(pid) : 0;
    var maxA = (DATA.WONDER_CFG || {}).maxActive || 3;
    /* v91.79（老板）：自动探索**不再限定主角行动** —— 由域层按本星球奇观类型，
       从「已解锁」的可用行动里随机取一种（采集/派军搜查/深潜攻坚/圣殿研读/方舟救援各自行为不一）。
       故本面板移除「主角行动」下拉，改由系统在运行时随机分配。 */
    var _aeComp = {};
    Object.keys(cfg.army || {}).forEach(function (id) { var q = Math.max(0, Math.floor(cfg.army[id] || 0)); if (q > 0) _aeComp[id] = q; });
    var sel = function (id, opts) {
      return '<select id="' + id + '">' + opts.map(function (o) {
        return '<option value="' + o.v + '"' + (o.on ? ' selected' : '') + '>' + U.escape(o.label) + '</option>';
      }).join('') + '</select>';
    };
    var freqOpts = (E.freqOptions || []).map(function (v) { return { v: v, on: v === cfg.everyMin, label: v + ' 分钟' }; });
    var dailyOpts = (E.dailyOptions || [0]).map(function (v) { return { v: v, on: v === cfg.dailyMax, label: v ? ('每城每日 ' + v + ' 次') : '不限次数' }; });
    /* 全境城（跨星球：当前球活态 + 各球分片）—— 用于"全境合计"兵力。 */
    var allCities = [];
    GAME.planetsOf().forEach(function (pl) {
      var cs = (s.cities || []).filter(function (c) { return GAME.pidOf(c) === pl.id; });
      cs.forEach(function (c) { allCities.push(c); });
    });
    /* v91.79（老板）：自动探索编成**同自动出征** —— 玩家设定组成，不再引用各城现存兵种。 */
    var rows = Object.keys(DATA.TROOPS).filter(function (id) { return !DATA.TROOPS[id].nocombat; }).map(function (id) {
      var tr = DATA.TROOPS[id] || {};
      var capN = (cfg.army && cfg.army[id]) || 0;
      var clrN = (cfg.clearArmy && cfg.clearArmy[id]) || 0;
      return '<tr class="et-row' + (capN > 0 || clrN > 0 ? ' on' : '') + '">' +
        '<td class="et-name">' + U.escape(tr.name || id) + '</td>' +
        '<td class="et-in"><input type="number" id="ae-a-' + id + '" min="0" value="' + capN + '"></td>' +
        '<td class="et-in"><input type="number" id="ae-cl-' + id + '" min="0" value="' + clrN +
          '" placeholder="' + (capN > 0 ? String(capN) : '0') + '"></td></tr>';
    }).join('');
    /* 各城可达标统计（与自动出征同源） */
    var _aeReach = { ok: 0, total: 0 };
    if (_aeComp && Object.keys(_aeComp).length) {
      GAME.planetsOf().forEach(function (pl) {
        (s.cities || []).filter(function (c) { return GAME.pidOf(c) === pl.id; }).forEach(function (ct) {
          _aeReach.total++; if (GAME.autoMarchMatchCity(ct, _aeComp).ok) _aeReach.ok++;
        });
      });
    }
    /* v91.81（老板「开发所有星球和城市选项」）：探索范围摘要（默认全域 = 所有星球所有城） */
    var _sc = GAME.autoExploreScopeCount ? GAME.autoExploreScopeCount(cfg) : { planets: 0, cities: 0 };
    /* v91.82（老板「自动探索也要按城指定英雄」）：已固定英雄的城数（界面摘要） */
    var _aeGenN = 0;
    for (var _agk in (cfg.cityGen || {})) if (cfg.cityGen[_agk]) _aeGenN++;
    /* v91.83（老板「自动探索加上英雄选择」）：**全局执行英雄**下拉 —— 与自动出征同构
       （首行「🎲 不限」= 每城各随机取一枚空闲英雄；选定则作**全局兜底**）。
       优先级：按城指定 > 全局指定 > 不限（与 pickAutoGen 三级链一致）。 */
    var _aeGenOpts = [{ v: '', on: !cfg.genId, label: '🎲 不限（每城随机取空闲英雄）' }].concat(
      (s.generals || []).map(function (g) {
        var busy = g.status && g.status !== 'idle';
        return { v: g.id, on: g.id === cfg.genId,
          label: U.escape(g.name) + (busy ? '（' + ui.genStatusName(g) + '）' : '') };
      }));
    /* v91.83：本星球奇观的**行为链现状**（已清层 / 各行动可否派）—— 界面与域层同一出口。 */
    var _cc0 = GAME.currentCity ? GAME.currentCity() : null;
    var _aePid = _cc0 ? GAME.pidOf(_cc0) : (GAME.planetsOf()[0] || {}).id;
    var _aeChain = (function () {
      var city = GAME.currentCity ? GAME.currentCity() : null;
      if (_aePid == null || !city || !GAME.autoExploreActsFor) return null;
      var r = GAME.autoExploreActsFor(_aePid, city, cfg);
      return { cleared: GAME.wonderClearedOf(_aePid), layers: GAME.wonderLayerCount(),
        feas: r.feas, blocked: r.blocked, city: city };
    })();
    /* ============================================================
     * v91.41（老板）：「各星球奇观不同，在自动探索处加上**全部星球的奇观类型列表**、
     *   兵种要求、上限」+「确保统一规则可适配所有已经/将来可能有的类型增加或更新」。
     * 本表**全部由数据派生**（planetsOf × wonderOf × WONDER_ACT_DEFS × WONDER_CFG）——
     *   新增奇观/新行动/新门槛**无需改本表**，自动出现（"统一规则适配所有类型"）。
     * ============================================================ */
    var _AD = DATA.WONDER_ACT_DEFS || {};
    var planetRows = GAME.planetsOf().map(function (pl) {
      var w = GAME.wonderOf ? GAME.wonderOf(pl.id) : null;
      var pres = GAME.wonderPresent ? GAME.wonderPresent(pl.id) : true;
      var act = GAME.wonderActiveCount ? GAME.wonderActiveCount(pl.id) : 0;
      /* 该星球奇观支持的行动 —— 紧凑标签（名称）+ 悬停显示条件，避免整列换行。 */
      var acts = ((w && w.acts) || []).map(function (a) {
        var d = _AD[a] || {};
        return '<span style="display:inline-block;margin:1px 3px;padding:0 5px;border:1px solid var(--line,#444);' +
          'border-radius:3px;font-size:var(--fs-sub);white-space:nowrap;" title="' +
          U.escape((d.name || a) + '：' + (d.cond || '需英雄带队')) + '">' + U.escape(d.name || a) + '</span>';
      }).join('') || '—';
      return '<tr class="et-row' + (pres ? '' : ' off') + '">' +
        '<td class="et-name">' + U.escape(pl.name) +
          (pl.id === (s.activePlanet || 0) ? ' <i class="gd-sub">当前</i>' : '') + '</td>' +
        '<td style="white-space:nowrap;">' + (w ? (w.icon + ' ' + U.escape(w.name)) : '<span style="color:var(--text-dim);">—</span>') + '　' +
          (pres ? '<span style="color:var(--green-ok);">在场</span>' : '<span style="color:var(--red-light);">未出现</span>') + '</td>' +
        '<td>' + acts + '</td>' +
        '<td class="num">' + act + ' / ' + maxA + '</td></tr>';
    }).join('');
    var planetTable = '<div class="op-zone" style="margin-top:8px;"><div class="op-zone-t">全部星球 · 奇观一览（类型 · 行动 · 在途上限）</div>' +
      '<table class="tbl exp-tbl"><colgroup><col style="width:5.5em"><col style="width:9em"><col style="width:auto"><col class="et-c-own"></colgroup>' +
      '<thead><tr><th>星球</th><th>今日奇观</th><th>收录行动</th><th class="num">在途</th></tr></thead><tbody>' +
      (planetRows || '<tr><td colspan="4" class="q-empty">暂无星球</td></tr>') + '</tbody></table>' +
      '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">本表**由数据自动生成**：' +
      '各星球今日奇观来自 `DATA.WONDER_DEFS`、行动与兵种要求来自 `DATA.WONDER_ACT_DEFS`、' +
      '在途上限来自 `DATA.WONDER_CFG.maxActive` —— 新增奇观/行动/门槛会自动出现在此，无需改界面。</div></div>';
    var html = '<div class="gold-heading">✨ 自动探索 · 详细配置' +
      '<span style="font-weight:400;font-size:var(--fs-sub);color:var(--text-dim);">（全域逐城派空闲英雄探奇观）</span>' +
      ui.help('与自动出征同构：频率节流 + 每日上限 + 玩家设定编成。\n' +
        '**默认不限英雄** —— 每城每次现取一枚空闲英雄带队；要固定就点「执行英雄 → 按城指定」。\n' +
        '**覆盖全部星球**：各星球的城向**本星球今日奇观**派队（各球奇观不同）。\n' +
        '**行动随机**：按本星球奇观类型，从已解锁的可用行动里随机取一种（不再限定主角行动）。\n' +
        '仅英雄行动（采集/圣殿研读）即使设了兵也不带兵；需兵行动按编成匹配，达不到的城市跳过。\n' +
        '在途满 ' + maxA + ' 队（每球各自计）即等候。') + '</div>' +
      '<div class="exp-grid"><div class="exp-col-l">' +
        /* v91.81（老板「自动探索开发所有星球和城市选项 · 目前限定为当前星球了」）：
           新增「探索范围」—— 默认全域，可逐个取消勾选星球/城市；下列「当前星球奇观」
           降级为**参考信息**（不再代表探索范围，范围由上面的「探索范围」决定）。 */
        '<div class="exp-sec"><div class="exp-sec-t">探索范围</div>' +
          ui.expRowHTML('范围',
            '<span class="exp-tac-link" data-action="open-ae-scope">选择星球 / 城市</span>' +
            '<span style="margin-left:8px;">已选 <b>' + _sc.planets + '</b> 星球 · <b>' + _sc.cities + '</b> 城</span>', null) +
          '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
          '默认<b>全域</b>（所有星球的所有城市，各城向<b>本星球</b>奇观派队）。' +
          '点「选择星球 / 城市」可逐个取消勾选；被取消的星球 / 城市不再派队。</div>' +
        '</div>' +
        /* v91.82（老板「自动探索也要按城指定英雄」）：与自动出征同构的「按城指定」入口。 */
        '<div class="exp-sec"><div class="exp-sec-t">执行英雄</div>' +
          ui.expRowHTML('指定方式',
            '<span class="exp-tac-link" data-action="open-ae-citygen">按城指定</span>' +
            '<span style="margin-left:8px;">已指定 <b>' + _aeGenN + '</b> 座城 · 其余不限</span>', null) +
          ui.expRowHTML('全局英雄', sel('ae-gen', _aeGenOpts),
            '优先级：**按城指定 > 全局英雄 > 不限**。全局英雄是兜底——' +
            '没被「按城指定」的城会用这位；若未选，则每城各随机取一枚空闲英雄（优先本城、排除君主）。') +
          '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
          '已固定的城若该英雄<b>正在忙碌</b>或<b>已不在册</b> → 该城<b>本次跳过</b>（不随机顶替）。</div>' +
        '</div>' +
        '<div class="exp-sec"><div class="exp-sec-t">当前星球奇观（参考）</div>' +
          '<div class="ui-sub" style="margin-bottom:6px;">' + (wd ? (wd.icon + ' ' + U.escape(wd.name) + ' · ' + U.escape(wd.body)) : '本星球暂无奇观') +
          '　·　' + (present ? '今日在场' : '<span style="color:var(--red-light);">今日未出现</span>') +
          '　·　在途 ' + active + '/' + maxA + ' 队' +
          (_aeChain ? ('　·　已清 <b>' + _aeChain.cleared + ' / ' + _aeChain.layers + '</b> 层') : '') + '</div>' +
          '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
          '行动由系统在<b>本城可行</b>的行动里随机取一种（可行 = 该奇观收录 ∩ 已清层达标 ∩ 编成/负重满足）。</div>' +
          (_aeChain ? ui.aeChainHTML(_aeChain, cfg) : '') +
        '</div>' +
        '<div class="exp-sec">' +
          ui.expRowHTML('探索频率', sel('ae-freq', freqOpts), null) +
          ui.expRowHTML('每城每日上限', sel('ae-daily', dailyOpts), null) + '</div>' +
        planetTable +
      '</div>' +
      '<div class="exp-col-r"><div class="exp-sec exp-a-troops"><div class="exp-sec-t">编成组成（玩家设定）</div>' +
        '<div class="exp-troops exp-body"><table class="tbl exp-tbl"><colgroup>' +
          '<col class="et-c-name"><col class="et-c-in"><col class="et-c-in"></colgroup><thead><tr>' +
          '<th>兵种</th><th class="ctr">探索数量</th><th class="ctr" title="破层是一场真战斗，与探索编成分开；留空 = 沿用探索数量">清层数量</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
        (_aeReach.total ? ('设定编成；当前可达标城市 <b>' + _aeReach.ok + ' / ' + _aeReach.total + '</b>（达不到跳过）。') : '设定编成（0 = 不带）。') +
        '仅英雄行动（采集/圣殿研读）即使设兵也不带兵；需兵行动按编成匹配。' +
        '破层按<b>清层数量</b>（留空沿用探索数量），低于该层建议兵力时不出战。</div></div></div>' +
      '</div>' +
      '<div class="exp-foot">' +
        '<button class="btn' + (cfg.on ? ' gold' : '') + '" data-action="ae-toggle">' +
          (cfg.on ? '⏸ 关闭自动探索' : '▶️ 开启自动探索') + '</button>' +
        '<button class="btn" data-action="ae-once">立即探索一次</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html, { size: 'xxl' });
    var bind = function (id, key) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('change', function () { GAME.doSetAutoExplore(key, el.value); ui.openAutoExplore(); });
    };
    bind('ae-freq', 'everyMin'); bind('ae-daily', 'dailyMax');
    /* v91.83：全局执行英雄（兜底）+ 自动清层开关。 */
    bind('ae-gen', 'genId');
    (function () {
      var cb = document.getElementById('ae-autoclear'); if (!cb) return;
      cb.addEventListener('change', function () {
        GAME.doSetAutoExplore('autoClear', cb.checked ? 1 : '');
        ui.openAutoExplore();
      });
    })();
    /* v92.1：探路开关 */
    (function () {
      var cb2 = document.getElementById('ae-probe'); if (!cb2) return;
      cb2.addEventListener('change', function () {
        GAME.doSetAutoExplore('probe', cb2.checked ? 1 : '');
        ui.openAutoExplore();
      });
    })();
    (function () {
      var ins = document.querySelectorAll('[id^="ae-a-"]');
      for (var ii = 0; ii < ins.length; ii++) (function (el2) {
        el2.addEventListener('change', function () { GAME.doSetAutoExplore('army:' + el2.id.slice(5), el2.value); });
      })(ins[ii]);
    })();
    /* v91.84：清层数量列（破层专用编成；清空 = 沿用探索数量）。 */
    (function () {
      var ins = document.querySelectorAll('[id^="ae-cl-"]');
      for (var ii = 0; ii < ins.length; ii++) (function (el2) {
        el2.addEventListener('change', function () { GAME.doSetAutoExplore('clearArmy:' + el2.id.slice(6), el2.value); });
      })(ins[ii]);
    })();
  };

  /* ============================================================
   * v91.81（老板）：「自动探索，开发所有星球和城市选项，参考出征界面。目前限定为当前星球了」——
   *   探索范围选择器：**左 1/4 星球导航 + 右 3/4 该星球城市（逐城勾选框）**，
   *   版面沿用出征界面「其他目标」弹窗（.etp-cat 同构）。
   *   语义 = **排除表**：默认全勾选（全域）；取消勾选 → 该星球 / 该城不派探索队。
   *   落盘走唯一出口 doSetAutoExplore('offPlanet:<pid>') / ('offCity:<cityId>')。
   * ============================================================ */
  ui.openAutoExploreScope = function () {
    var s = GAME.state, cfg = GAME.autoExploreCfg();
    if (!cfg) return;
    var citiesOf = function (pid) {
      return (s.cities || []).filter(function (c) { return GAME.pidOf(c) === pid; });
    };
    var planets = GAME.planetsOf().filter(function (pl) { return citiesOf(pl.id).length > 0; });
    if (!planets.length) {
      ui.openModal('<div class="gold-heading">🗺️ 选择探索范围</div>' +
        '<div class="ui-sub" style="text-align:center;margin:8px 0;">暂无城市</div>', { size: 'xl' });
      return;
    }
    var nOn = function (pid) {
      return citiesOf(pid).filter(function (c) { return GAME.autoExploreInScope(cfg, pid, c.id); }).length;
    };
    var sideHTML = planets.map(function (pl, i) {
      var pOn = GAME.autoExploreInScope(cfg, pl.id);
      return '<div class="aes-cat"' + (i === 0 ? ' data-active="1"' : '') + ' data-pid="' + pl.id + '"' +
        ' style="padding:8px 10px;margin-bottom:4px;border-radius:8px;cursor:pointer;font-size:var(--fs-sub);' +
        (i === 0 ? 'background:var(--slab-2);color:var(--gold-light);font-weight:800;' : 'color:var(--text);') + '">' +
        '<input type="checkbox" id="aes-p-' + pl.id + '"' + (pOn ? ' checked' : '') + '> ' +
        U.escape(pl.name) + ' <i style="opacity:.7;">（' + nOn(pl.id) + '/' + citiesOf(pl.id).length + '）</i></div>';
    }).join('');
    ui.openModal('<div class="gold-heading">🗺️ 选择探索范围' +
      '<span style="font-weight:400;font-size:var(--fs-sub);color:var(--text-dim);">' +
      '（取消勾选 = 该星球 / 该城市不派探索队）</span></div>' +
      '<div style="display:flex;gap:12px;align-items:stretch;min-height:320px;">' +
        '<div style="flex:0 0 25%;border-right:1px solid var(--line);padding-right:10px;overflow:auto;">' + sideHTML + '</div>' +
        '<div style="flex:1 1 75%;min-width:0;"><div id="aes-body"></div></div>' +
      '</div>' +
      '<div class="exp-foot"><button class="btn" data-action="close-modal">关闭</button></div>', { size: 'xl' });

    var curPid = planets[0].id;
    /* 左侧计数与星球勾选框回写（cfg 是同一对象，doSetAutoExplore 改后这里立即生效） */
    var refreshSide = function () {
      planets.forEach(function (pl) {
        var cat = document.querySelector('.aes-cat[data-pid="' + pl.id + '"]');
        if (cat) { var ii = cat.querySelector('i'); if (ii) ii.textContent = '（' + nOn(pl.id) + '/' + citiesOf(pl.id).length + '）'; }
        var pcb = document.getElementById('aes-p-' + pl.id);
        if (pcb) pcb.checked = GAME.autoExploreInScope(cfg, pl.id);
      });
    };
    var paint = function (pid) {
      curPid = pid;
      var els = document.querySelectorAll('.aes-cat');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], on = String(el.getAttribute('data-pid')) === String(pid);
        el.setAttribute('data-active', on ? '1' : '0');
        el.style.background = on ? 'var(--slab-2)' : 'transparent';
        el.style.color = on ? 'var(--gold-light)' : 'var(--text)';
        el.style.fontWeight = on ? '800' : '400';
      }
      var b = document.getElementById('aes-body');
      if (!b) return;
      var cs = citiesOf(pid);
      b.innerHTML = '<div style="margin-bottom:6px;display:flex;gap:12px;">' +
          '<span class="exp-tac-link" id="aes-all-on">本星球全选</span>' +
          '<span class="exp-tac-link" id="aes-all-off">本星球全不选</span></div>' +
        (cs.length ? cs.map(function (c) {
          var on = GAME.autoExploreInScope(cfg, pid, c.id);
          return '<label style="display:flex;align-items:center;gap:6px;padding:3px 0;">' +
            '<input type="checkbox" id="aes-c-' + c.id + '"' + (on ? ' checked' : '') + '>' +
            '<span>' + U.escape(GAME.cityLabel(c)) + '</span></label>';
        }).join('') : '<div class="ui-sub">该星球暂无城市</div>');
      /* 逐城勾选：勾 = 参与探索（清排除）；取消 = 排除 */
      cs.forEach(function (c) {
        var cb = document.getElementById('aes-c-' + c.id);
        if (!cb) return;
        cb.addEventListener('change', function () {
          GAME.doSetAutoExplore('offCity:' + c.id, cb.checked ? '' : '1');
          refreshSide();
        });
      });
      var onBtn = document.getElementById('aes-all-on'), offBtn = document.getElementById('aes-all-off');
      var bulk = function (on) {
        cs.forEach(function (c) { GAME.doSetAutoExplore('offCity:' + c.id, on ? '' : '1'); });
        paint(pid); refreshSide();
      };
      if (onBtn) onBtn.addEventListener('click', function () { bulk(true); });
      if (offBtn) offBtn.addEventListener('click', function () { bulk(false); });
    };
    /* 左侧：星球条目点击切右侧；星球勾选框独立生效（stopPropagation 防误切换分类） */
    planets.forEach(function (pl) {
      var cat = document.querySelector('.aes-cat[data-pid="' + pl.id + '"]');
      if (cat) cat.addEventListener('click', function () { paint(pl.id); });
      var pcb = document.getElementById('aes-p-' + pl.id);
      if (pcb) {
        pcb.addEventListener('click', function (e) { if (e.stopPropagation) e.stopPropagation(); });
        pcb.addEventListener('change', function () {
          GAME.doSetAutoExplore('offPlanet:' + pl.id, pcb.checked ? '' : '1');
          paint(curPid); refreshSide();
        });
      }
    });
    paint(curPid);
  };

  /* ============================================================
   * v91.82（老板「自动探索也要按城指定英雄」）—— 与自动出征「按城指定」同构：
   *   按星球分组列出全部城市，每行 = **勾选框 + 城市名 + 本城英雄下拉**。
   *   勾选 = 该城固定用所选英雄；不勾选 = 该城不限（随机空闲英雄，优先本城）。
   *   版面沿用 `openAutoMarchCityGen`（同一张表），仅写入口换成 doSetAutoExplore。
   * ============================================================ */
  ui.openAutoExploreCityGen = function () {
    var s = GAME.state, cfg = GAME.autoExploreCfg();
    if (!cfg) return;
    var _cg = cfg.cityGen || {};
    var _gensOf = function (cid) {
      return (s.generals || []).filter(function (g) {
        var gc = GAME.genCityOf ? GAME.genCityOf(g) : null;
        return gc && gc.id === cid;
      });
    };
    var rows = '';
    GAME.planetsOf().forEach(function (pl) {
      var list = (s.cities || []).filter(function (c) { return GAME.pidOf(c) === pl.id; });
      if (!list.length) return;
      rows += '<tr class="et-row"><td colspan="3" style="font-weight:600;color:var(--text-dim);">' +
        U.escape(pl.name || ('星球 ' + pl.id)) + '</td></tr>';
      list.forEach(function (c) {
        var gens = _gensOf(c.id), cur = _cg[c.id] || '';
        var opts = '<option value=""' + (cur ? '' : ' selected') + '>🎲 不限（随机空闲英雄）</option>' +
          gens.map(function (g) {
            var busy = g.status && g.status !== 'idle';
            return '<option value="' + g.id + '"' + (g.id === cur ? ' selected' : '') + '>' +
              U.escape(g.name) + (busy ? '（' + ui.genStatusName(g) + '）' : '') + '</option>';
          }).join('');
        rows += '<tr class="et-row' + (cur ? ' on' : '') + '">' +
          '<td class="ctr"><input type="checkbox" id="am-eg-on-' + c.id + '"' + (cur ? ' checked' : '') + '></td>' +
          '<td class="et-name">' + U.escape(GAME.cityLabel(c)) + '</td>' +
          '<td class="et-in"><select id="am-eg-gen-' + c.id + '">' + opts + '</select></td></tr>';
      });
    });
    var n = 0;
    for (var k in _cg) if (_cg[k]) n++;
    var html = '<div class="gold-heading">✨ 按城指定探索英雄' +
      '<span style="font-weight:400;font-size:var(--fs-sub);color:var(--text-dim);">' +
      '（已指定 ' + n + ' 座城 · 未勾选的城 = 不限）</span></div>' +
      '<div class="exp-info exp-info-l" style="color:var(--text-dim);">' +
      '勾选框 = 该城固定使用所选英雄；<b>不勾选 = 该城不限</b>（随机取空闲英雄，优先本城）。' +
      '英雄下拉只列<b>本城</b>在册英雄；指定的英雄若正在忙碌或已不在册，该城<b>本次跳过</b>。</div>' +
      '<div class="exp-troops exp-body" style="max-height:52vh;overflow:auto;">' +
      '<table class="tbl exp-tbl"><colgroup><col style="width:3.2em">' +
      '<col class="et-c-name"><col class="et-c-in"></colgroup>' +
      '<thead><tr><th class="ctr">指定</th><th>城市</th><th>探索英雄</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3" style="color:var(--text-dim);">暂无城市</td></tr>') +
      '</tbody></table></div>' +
      '<div class="exp-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html, { size: 'xl' });
    /* 与出征同款：勾选框/下拉任一变动 →「勾中且有英雄 → 写；否则 → 清（= 不限）」落盘。
       不重开本弹窗（重开会丢滚动位置）。 */
    var _apply = function (cid) {
      var cb = document.getElementById('am-eg-on-' + cid);
      var sl = document.getElementById('am-eg-gen-' + cid);
      if (!cb || !sl) return;
      GAME.doSetAutoExplore('cityGen:' + cid, cb.checked ? sl.value : '');
    };
    (s.cities || []).forEach(function (c) {
      var cb = document.getElementById('am-eg-on-' + c.id);
      var sl = document.getElementById('am-eg-gen-' + c.id);
      if (cb) cb.addEventListener('change', function () { _apply(c.id); });
      if (sl) sl.addEventListener('change', function () {
        var cb2 = document.getElementById('am-eg-on-' + c.id);
        if (cb2) cb2.checked = !!sl.value;   /* 选了具体英雄 → 自动勾上；选「不限」→ 自动取消 */
        _apply(c.id);
      });
    });
  };

  /* ============================================================
   * 基因实验室（v73 立 · v89.220 改名 · v89.224 迁入建筑 + 去播种化）
   *   ⚠ 命名沿革：种田秘境（v89.216 前）→ 温室农场（v89.216）→ 基因实验室（v89.220）。
   * ------------------------------------------------------------
   * v89.224（老板 1/2）：实验室从「政务厅要务」迁到**城内建筑「基因实验室」**（honglusi 格）；
   *   播种 / 种子整体退役 —— 六座培养舱直接「立项研发」：材料研发 ×6 + 基因调试 ×4，
   *   完成即提取产物。面板只管展示与派发 data-action，逻辑全在 GAME.farm*（域层）。
   * ============================================================ */
  /* ============================================================
   * v91.30 奇观菜单：今日奇观 + 可能产出物品栏 + 探索行动（含每日剩余次数）
   * ============================================================ */
  ui.wonderHTML = function (pid) {
    var wd = GAME.wonderOf ? GAME.wonderOf(pid) : null;
    if (!wd) return '<div class="q-empty">此星球暂无奇观。</div>';
    var W = DATA.WONDER_CFG || { maxActive: 3, marchRealSec: 3600, accrueSec: 600 };
    var present = GAME.wonderPresent ? GAME.wonderPresent(pid) : true;
    var active = GAME.wonderActiveCount ? GAME.wonderActiveCount(pid) : 0;
    /* v91.34（老板）：「奇观界面给一个消失时间倒计时」—— 今日奇观现实日一翻即消散/刷新，
       剩余在场时间 = 到本现实日零点。走唯一出口 GAME.wonderLeftToday（与 present 同轴）。 */
    var leftMs = GAME.wonderLeftToday ? GAME.wonderLeftToday(pid) : 0;
    var cdTip = '今日奇观随现实日刷新：约每 5 天缺席 1 天（当日无奇观）。剩余时间一满即消散或刷新。';
    var cdLine = present
      ? '<span style="color:var(--gold-light);" title="' + U.escape(cdTip) + '">下一日刷新 ' + U.dur(leftMs / 1000) + '</span>'
      : '<span style="color:var(--red-light);" title="' + U.escape(cdTip) + '">今日已消散</span>';
    /* v91.51（老板）：产出 = **主产材料（必给）** + **通用掉落（任意奇观都有独立几率）**：
       珠宝 / 图纸 / 残页。列表如实展示（主产 + 三类通用几率），不再"某奇观只产某几张"。 */
    var DIFF_TIP = '采集：不派兵、安稳取**少量**材料；派军搜查/深潜攻坚：**出征界面**选将选兵，'
      + '按**军力**给更多材料（有损兵风险）。**珠宝 / 图纸 / 残页为通用掉落，任意奇观均有一定几率**。';
    var rows = '';
    /* ① 主产（v91.54 老板：该奇观 **3 种**材料，**同一行等分 1/3** 显示） */
    var _mats = wd.mats || (wd.mat ? [wd.mat] : []);
    var _mcell = _mats.map(function (mid) {
      var it = DATA.ITEM_BY_ID[mid] || {}, have = (GAME.state.items || {})[mid] || 0;
      return '<span style="flex:1 1 33.33%;min-width:0;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' +
        U.escape(DIFF_TIP) + '">' + (it.icon || '📦') + ' ' + U.escape(it.name || mid) +
        ' <i class="gd-sub">×' + have + '</i></span>';
    }).join('');
    rows += '<div class="stat-row"><span class="sr-name" style="display:flex;flex:1;min-width:0;">' + _mcell + '</span>' +
      '<span class="sr-sub">主产 · 每份随机 1 种</span></div>';
    /* ② 通用掉落（各自独立几率） */
    function _genericRow(icon, name, pct, have) {
      return '<div class="stat-row" title="' + U.escape(DIFF_TIP) + '"><span class="sr-name">' + icon + ' ' + name +
        '</span><span class="sr-sub">通用 · 每份 ' + Math.round(pct * 100) + '% 几率</span></div>';
    }
    var _band = (DATA.wonderJewelBandOf ? DATA.wonderJewelBandOf(wd) : 2);
    var _bnames = ((DATA.WONDER_JEWEL_BANDS || {})[_band] || []).map(function (id) { return (DATA.ITEM_BY_ID[id] || {}).name || id; }).join('/');
    rows += _genericRow('💎', '珠宝（' + _band + ' 档：' + _bnames + '）', (W.jewelChance || 0));
    rows += _genericRow('📜', '套装图纸（任意套）', (W.bpChance || 0));
    rows += _genericRow('📖', '战技残页', (wd.banner === 'page' ? (W.pageBannerChance || 0.08) : (W.pageChance || 0.03)));
    if (wd.out && wd.out.length) {
      wd.out.forEach(function (oid) { var it = DATA.ITEM_BY_ID[oid] || {}; rows += '<div class="stat-row"><span class="sr-name">' + (it.icon || '📦') + ' ' + U.escape(it.name || oid) + '</span><span class="sr-sub">附带 · 小概率</span></div>'; });
    }
    return '<div class="op-zone"><div class="op-zone-t">' + wd.icon + ' ' + U.escape(wd.name) + ' · ' + U.escape(wd.body) + '</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:6px;">' +
        (present ? '今日在场' : '<span style="color:var(--red-light);">今日未出现</span>') +
        '　·　' + cdLine +
        '　·　在途 ' + active + ' / ' + (W.maxActive || 3) + ' 队　·　行军 ' + Math.round((W.marchRealSec || 3600) / 60) +
        ' 分抵达后**持续累计**（每 ' + Math.round((W.accrueSec || 600) / 60) + ' 分 +1 份 · 满 ' +
        Math.round((W.exploreSec || 14400) / 3600) + ' 小时自动返航）</div>' +
      '<div class="ui-sub" title="' + U.escape(DIFF_TIP) + '">可能产出　<span style="color:var(--text-dim);">（悬停看「采集 / 派军搜查」差异）</span></div>' +
      (rows || '<div class="q-empty">—</div>') + '</div>';
  };
  /* 奇观行动按钮（**放弹窗底部**）。
     v91.36（老板）：「对奇观的动作应等同于出征，**直连出征界面，必须由将领带队**，
     但根据出征动作的不同，需要不一样」（研读只需将 / 救援需总负重达标…）——
     所有行动一律走 `wonder-exp` → **出征界面**（选将 · 选兵 · 自由定数量）；
     各行动的**带队条件**写进 `DATA.WONDER_ACT_DEFS[].cond`，**悬停显示**（图标/按钮 title）。 */
  ui.wonderActsHTML = function (pid) {
    var wd = GAME.wonderOf ? GAME.wonderOf(pid) : null;
    if (!wd) return '';
    var active = GAME.wonderActiveCount ? GAME.wonderActiveCount(pid) : 0;
    var W = DATA.WONDER_CFG || { maxActive: 3 };
    var cleared = GAME.wonderClearedOf ? GAME.wonderClearedOf(pid) : 0;
    return (wd.acts || []).map(function (aid) {
      var a = (DATA.WONDER_ACT_DEFS || {})[aid]; if (!a) return '';
      var lock = GAME.wonderActLockOf ? GAME.wonderActLockOf(pid, aid) : '';
      var gate = GAME.wonderActGateOf ? GAME.wonderActGateOf(aid) : 1;
      var tip = a.desc + '\n条件：' + (a.cond || '需英雄带队')
        + '\n门槛：需已清 ' + gate + ' 层（当前 ' + cleared + ' 层）'
        + (a.risk ? '\n风险：可能损兵 ' + Math.round(a.risk * 100) + '%' : '')
        + '\n（走出征界面 · 选将选兵 · 按军力给奖励）';
      return '<button class="btn' + (lock ? '' : ' gold') + '" data-action="wonder-exp" data-pid="' + pid + '" data-act="' + aid + '"'
        + (lock ? ' disabled' : '') + ' title="' + U.escape(lock ? lock : tip) + '">' + (lock ? '🔒 ' : '') + a.name + '</button>';
    }).join(' ') + '<span class="ui-sub" style="margin-left:8px;">已清 ' + cleared + '/' +
      (GAME.wonderLayerCount ? GAME.wonderLayerCount() : 6) + ' 层 · 在途 ' + active + ' / ' + (W.maxActive || 3) + ' 队</span>';
  };
  /* v91.52（老板）：**探索层级**面板 —— 逐层守军（青铜/白银/黄金/钻石/星耀/王级），
     逐层"挑战"；已清层解锁更深行动。 */
  ui.wonderLayersHTML = function (pid) {
    var wd = GAME.wonderOf ? GAME.wonderOf(pid) : null; if (!wd) return '';
    var cleaned = GAME.wonderClearedOf ? GAME.wonderClearedOf(pid) : 0;
    var n = GAME.wonderLayerCount ? GAME.wonderLayerCount() : 6;
    var rows = '';
    for (var lv = 1; lv <= n; lv++) {
      var d = GAME.wonderLayerDefOf(lv);
      var isCleared = lv <= cleaned, isNext = lv === cleaned + 1;
      var state = isCleared ? '<span style="color:var(--green-ok);">✔ 已清</span>'
        : isNext ? '<button class="btn sm gold" data-action="wonder-fight" data-pid="' + pid + '" data-lv="' + lv + '"'
          + ' title="走出征界面选将选兵，挑战本层守军（建议 ≥ ' + U.fmt(d.minTroops) + ' 兵）">⚔ 挑战</button>'
        : '<span style="color:var(--text-dim);">🔒 未解锁</span>';
      rows += '<tr' + (isCleared ? ' style="opacity:.6;"' : '') + '>' +
        '<td>第 ' + lv + ' 层 · <b>' + d.rank.name + '</b></td>' +
        '<td class="num">' + U.fmt(d.total) + ' 兵</td>' +
        '<td class="num">' + U.fmt(d.gen.level) + ' 级 / 四维 ' + U.fmt(d.gen.tong * 4) + ' / 速 ' + d.gen.spd + '</td>' +
        '<td class="ctr">' + state + '</td></tr>';
    }
    return '<div class="op-zone"><div class="op-zone-t">🗝 探索层级（击败守军 → 解锁更深行动）</div>' +
      '<table class="tbl"><thead><tr><th>层级 · 守卫</th><th class="num">守军</th><th class="num">守卫属性</th><th class="ctr">状态</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">该奇观守军总数 ' +
      U.fmt((DATA.WONDER_LAYER_CFG || {}).totalArmy) + '，按层**递增切分**（越深越多、越精锐）。' +
      '各行动的**门槛层**：采集/研读 → 1 层，救援 → 2 层，派军搜查 → 3 层，深潜攻坚 → 5 层。</div></div>';
  };
  /* 探查中队列：将领 · 军力 · 计时 · 累计奖励（每现实秒刷新）。 */
  ui.wonderQueueHTML = function (pid) {
    var pl = GAME._planetOf ? GAME._planetOf(pid) : null;
    var list = (pl && pl.wonderExp) || [];
    var now = U.now(), W = DATA.WONDER_CFG || { marchRealSec: 3600, accrueSec: 600 };
    var h = '<div class="op-zone"><div class="op-zone-t">探查中队列（' + list.length + '）</div>';
    if (!list.length) return h + '<div class="q-empty">暂无探查队 —— 派出后在此看进度与累计奖励。</div></div>';
    list.forEach(function (e) {
      var g = null; (GAME.state.generals || []).forEach(function (x) { if (x.id === e.genId) g = x; });
      var city = GAME.cityByIdAnywhere ? GAME.cityByIdAnywhere(e.cityId) : GAME.cityById(e.cityId);
      var accStr = (e.acc || []).map(function (x) { return ((DATA.ITEM_BY_ID[x.id] || {}).name || x.id) + '×' + x.n; }).join('、') || '—';
      var phase, tsec, untilNote = '';
      if (e.returning) { phase = '↩︎ 返回中'; tsec = Math.max(0, (e.retArrive - now) / 1000); }
      else if (now < e.arriveAt) { phase = '🛫 行军'; tsec = Math.max(0, (e.arriveAt - now) / 1000); }
      else {
        /* v91.50（老板）：「在探索队列补充剩余探索时间」—— 累计阶段显示**距自动返航**还剩多久。 */
        phase = '⛏ 探查累计';
        var _until = e.exploreUntil || (e.arriveAt + (W.exploreSec || 14400) * 1000);
        tsec = Math.max(0, (_until - now) / 1000);
        untilNote = '　·　剩 ';
      }
      h += '<div class="stat-row"><span class="sr-name">' + (g ? U.escape(g.name) + ' Lv' + g.level : '无将')
        + (city ? '　<i class="gd-sub">' + U.escape(city.name) + '</i>' : '') + '</span>'
        + '<span class="sr-sub">' + U.numText(e.troops || 0, 0) + ' 兵　·　' + phase
        + (tsec > 0 ? (untilNote + U.durExact(tsec)) : '') + '　·　累计 ' + (e.accrued || 0) + ' 份'
        + (e.returning ? '' : '　<button class="btn sm" data-action="wonder-recall" data-pid="' + pid + '" data-gen="' + U.escape(e.genId || '') + '" title="撤军：下令返航（英雄随之归位）">召回</button>')
        + '</span></div>';
      h += '<div class="ui-sub" style="margin:-2px 0 4px;">　收获：' + U.escape(accStr) + '</div>';
    });
    return h + '</div>';
  };
  /* ============================================================
   * v91.84（老板）：「补充英雄战力评估，兵种战力评估体系。基于英雄对兵种的加成，
   *   建立**总体战力评估**」——
   *   三块同屏（数值**全部**来自 `GAME.power` 唯一出口，界面不另算一套）：
   *     ① 总体：编成 × 英雄加成（覆盖率公式与战斗引擎 damageOf 同一份）；
   *     ② 英雄：四维 / 指挥容量 / 攻防加成（满覆盖）/ 战力；
   *     ③ 兵种：纸面分项 + 派生（每人口战力 / 性价比 / 定位）。
   *   ⚠️ 速度/先手**不折进战力** —— 先手要有对手才能判（firstStrike 需双方），
   *     单列 `spd`，避免"无对手也能算出先手"的伪精度。
   *   入口：军务总览「⚖ 战力评估」。
   * ============================================================ */
  ui.openPower = function (opts) {
    opts = opts || {};
    if (!GAME.power) { ui.toast('战力模块未加载'); return; }
    var s = GAME.state;
    var city = (opts.cityId && GAME.cityById(opts.cityId)) || GAME.currentCity() || (s.cities && s.cities[0]) || null;
    var army = (city && city.army) || {};
    var genId = (opts.genId != null ? opts.genId : (ui._pwGen || ''));
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });

    /* ---------- ① 总体 ---------- */
    var agg = GAME.power.armyOf(army, gen);
    var gOpts = [{ v: '', on: !genId, label: '🎲 不带将（裸战力）' }].concat(
      (s.generals || []).map(function (g) {
        return { v: g.id, on: g.id === genId, label: U.escape(g.name) + ' Lv' + (g.level || 1) };
      }));
    /* ⚠️ id 用 am- 前缀是**刻意**的：冒烟门禁的「下拉框白名单」只认登记过的前缀
       （见 smoke-test.js selectsRegistered），换前缀会被判红。别"顺手改名"。 */
    var genSel = '<select id="am-pw-gen">' + gOpts.map(function (o) {
      return '<option value="' + o.v + '"' + (o.on ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('') + '</select>';
    var block1 = '<div class="op-zone"><div class="op-zone-t">① 总体战力' +
      (city ? '（' + U.escape(city.name) + ' 驻军）' : '') + '</div>' +
      ui.expRowHTML('带队英雄', genSel, null) +
      '<div class="stat-row"><span class="sr-name">裸战力（Σ 兵种战力 × 数量）</span>' +
        '<span class="sr-sub"><b>' + U.numText(agg.base, 0) + '</b></span></div>' +
      '<div class="stat-row"><span class="sr-name">兵力加成（× 覆盖率）</span>' +
        '<span class="sr-sub">+' + U.numText(agg.add, 0) +
        (gen ? '（满覆盖 ' + Math.round(agg.bonusRate * 100) + '% · 实得 ' + Math.round(agg.coverRate * 100) + '%）' : '（未带将 = 0）') +
        '</span></div>' +
      '<div class="stat-row"><span class="sr-name"><b>总体战力</b></span>' +
        '<span class="sr-sub"><b style="color:var(--gold-light);">' + U.numText(agg.total, 0) + '</b></span></div>' +
      '<div class="stat-row"><span class="sr-name">兵力 / 负重 / 均速</span>' +
        '<span class="sr-sub">' + U.numText(agg.troops, 0) + ' 人　·　' + U.numText(agg.load, 0) +
        '　·　' + Math.round(agg.spd) + '</span></div>' +
      '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
      '加成原子（全军攻/防 %）与战斗引擎同源；覆盖率 = min(兵力, 指挥容量)/兵力，**逐兵种**算，' +
      '与伤害公式同一份。速度不折进战力（先手需双方才能判）。</div></div>';

    /* ---------- ② 英雄评估 ---------- */
    var grows = GAME.power.genRows(army).slice(0, 12).map(function (r) {
      return '<tr><td>' + U.escape(r.name) + ' <i class="gd-sub">Lv' + r.level + '</i></td>' +
        '<td class="num">' + U.fmt(r.tong) + '/' + U.fmt(r.yw) + '/' + U.fmt(r.zm) + '/' + U.fmt(r.nz) + '</td>' +
        '<td class="num">' + U.fmt(r.coverCap) + '</td>' +
        '<td class="num">+' + Math.round(r.atkPct * 100) + '% / +' + Math.round(r.defPct * 100) + '%</td>' +
        '<td class="num"><b>' + U.numText(r.power, 0) + '</b></td></tr>';
    }).join('') || '<tr><td colspan="5" class="q-empty">暂无英雄</td></tr>';
    var block2 = '<div class="op-zone"><div class="op-zone-t">② 英雄战力（按战力降序 · 前 12）</div>' +
      '<table class="tbl"><thead><tr><th>英雄</th><th class="num">四维（统/勇/智/政）</th>' +
      '<th class="num">指挥容量</th><th class="num">攻/防加成</th><th class="num">战力</th></tr></thead>' +
      '<tbody>' + grows + '</tbody></table>' +
      '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
      '战力 = 指挥容量 × 攻防加成均值 × 当前编成加权单兵战力（= 塞满兵时凭加成额外贡献的战力）。' +
      '加成取自 `GAME.genAttrs`（与战斗同源），不是另写一张表。</div></div>';

    /* ---------- ③ 兵种评估 ---------- */
    var trows = GAME.power.troopRows({ combatOnly: true }).map(function (r) {
      return '<tr' + (r.id === (opts.hi || '') ? ' style="background:rgba(255,200,80,.08);"' : '') + '>' +
        '<td>' + U.escape(r.name) + '</td>' +
        '<td class="num">' + U.fmt(r.atk) + '/' + U.fmt(r.def) + '/' + U.fmt(r.hp) + '</td>' +
        '<td class="num">' + U.fmt(r.range) + '</td>' +
        '<td class="num">' + U.fmt(r.spd) + '</td>' +
        '<td class="num"><b>' + U.numText(r.power, 0) + '</b></td>' +
        '<td class="num">' + (r.perPop ? r.perPop.toFixed(1) : '—') + '</td>' +
        '<td class="num">' + (r.perCost ? r.perCost.toFixed(2) : '—') + '</td>' +
        '<td class="num">' + U.escape(r.role) + '</td></tr>';
    }).join('');
    var block3 = '<div class="op-zone"><div class="op-zone-t">③ 兵种战力（按战力降序）</div>' +
      '<table class="tbl"><thead><tr><th>兵种</th><th class="num">攻/防/血</th><th class="num">射程</th>' +
      '<th class="num">速度</th><th class="num">战力</th><th class="num">每人口</th><th class="num">性价比</th>' +
      '<th class="num">定位</th></tr></thead><tbody>' + trows + '</tbody></table>' +
      '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
      '战力走 `STORY.troopPower` 唯一出口（与来袭/家底同一把尺）；定位由数据派生（运输/远程/防御/突击）。</div></div>';

    ui.openModal('<div class="gold-heading">⚖ 战力评估</div>' + block1 + block2 + block3 +
      '<div class="m-foot" style="justify-content:center;">' +
      '<button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl', live: function () { ui.openPower({ cityId: city && city.id, genId: genId, hi: opts.hi }); } });

    var sel2 = document.getElementById('am-pw-gen');
    if (sel2) sel2.addEventListener('change', function () {
      ui._pwGen = sel2.value;
      ui.openPower({ cityId: city && city.id, genId: sel2.value, hi: opts.hi });
    });
  };

  ui.openWonder = function (pid) {
    ui.openModal('<div class="gold-heading">✨ 奇观</div>' + ui.wonderHTML(pid) + ui.wonderLayersHTML(pid) + ui.wonderQueueHTML(pid) +
      /* v91.31（老板）：**点击性按钮放弹窗底部**。 */
      '<div class="m-foot" style="justify-content:center;flex-wrap:wrap;gap:8px;">' + ui.wonderActsHTML(pid) +
      '<button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'md', live: function () { ui.openWonder(pid); } });
  };

  ui.openFarm = function (city) {
    ui.openModal('<div class="ui-page farm-space">' + ui.farmHTML(city) + '</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xxl', closeAll: true });
      /* v89.135（老板 8）：「基因实验室关闭后直接会到城市界面」—— closeAll 语义：
         关闭键 = 全关回游戏视图（不弹回进实验室前的那层）。 */
  };
  ui.farmHTML = function (city) {
    var ct = city || GAME.currentCity();
    var f = GAME.farmOf(ct);
    var ripeN = 0;
    var cells = f.plots.map(function (p, i) {
      var st = GAME.farmPlotState(i, ct);
      var body, act = '';
      if (st.state === 'empty') {
        body = '<div class="farm-ic">🧫</div><div class="farm-crop">空闲</div>' +
          '<div class="farm-sub">可立项</div>';
        act = '<button class="btn sm gold" data-action="farm-projects" data-idx="' + i + '">立项</button>';
      } else if (st.state === 'growing') {
        body = '<div class="farm-ic">' + st.crop.icon + '</div>' +
          '<div class="farm-crop">' + st.crop.name + '</div>' +
          '<div class="pbar"><i data-farm-bar="' + i + '" style="width:' + st.pct + '%;"></i></div>' +
          '<div class="farm-sub" data-farm-left="' + i + '">完成还需 ' +
            U.durExact(st.left / GAME.timeScale()) + '</div>';
      } else {
        ripeN++;
        body = '<div class="farm-ic">' + st.crop.icon + '</div>' +
          '<div class="farm-crop">' + st.crop.name + '</div>' +
          '<div class="farm-sub" style="color:var(--gold-light);">✨ 可提取</div>';
        act = '<button class="btn sm gold" data-action="farm-extract" data-idx="' + i + '">提取</button>';
      }
      return '<div class="farm-cell' + (st.state === 'ripe' ? ' ripe' : '') + '">' + body + act + '</div>';
    }).join('');
    return '<div class="gold-heading">🧬 基因实验室' + (ct ? ' · ' + U.escape(ct.name) : '') + '</div>' +
      '<div class="ui-sub" style="text-align:center;">旧世实验室 · 六座培养舱（各城独立）　立项即开工，研发走游戏时间</div>' +
      '<div class="farm-grid">' + cells + '</div>' +
      (ripeN
        ? '<div class="op-row" style="justify-content:flex-end;">' +
            '<button class="btn gold" data-action="farm-extract-all">一键提取（' + ripeN + '）</button></div>'
        : '') +
      '<div class="op-zone"><div class="op-zone-t">研发与去向</div>' +
        '<div class="attr"><span class="k">材料研发</span><span class="v">3 阶打造主料（钢锭 / 铁木 / 硬甲皮 / 巨兽筋 / 纯晶 / 高强纤维），有机率出 4 阶</span></div>' +
        '<div class="attr"><span class="k">基因调试</span><span class="v">激活 / 蜕变 / 觉醒 / 天启血清 —— 英雄资质逐档提升</span></div>' +
        '<div class="attr"><span class="k">去向</span><span class="v">材料 → 制造厂打造；血清 → 宝物背包 → 选英雄使用</span></div>' +
      '</div>';
  };
  /* 立项弹窗：列出全部研发项目（6 材料 + 4 基因调试）—— 直接立项，不消耗道具 */
  ui.openFarmProjects = function (idx) {
    var rows = (DATA.FARM.crops || []).map(function (c) {
      var yieldTxt;
      if (c.herb) {
        var it = null;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === c.herb) it = x; });
        yieldTxt = '得 ' + ((it && it.name) || c.herb) + ' ×1（英雄资质提升一档）';
      } else {
        var m3 = DATA.MATERIAL_BY_ID[c.mat] || {};
        var m4 = DATA.MATERIAL_BY_ID[c.rare] || {};
        yieldTxt = '得 ' + (m3.name || c.mat) + ' ×' + c.qty[0] + '~' + c.qty[1] +
          '（' + Math.round((c.rareP || 0.15) * 100) + '% 出 ' + (m4.name || c.rare) + '）';
      }
      return '<div class="farm-proj">' +
        '<div class="farm-ic">' + c.icon + '</div>' +
        '<div class="farm-proj-main">' +
          '<div class="farm-crop">' + c.name + '</div>' +
          '<div class="farm-sub">' + U.escape(c.desc) + '</div>' +
          '<div class="farm-sub">⏱ ' + c.hours + ' 游戏小时　' + yieldTxt + '</div>' +
        '</div>' +
        '<button class="btn sm gold" data-action="farm-start" data-idx="' + idx +
          '" data-crop="' + c.id + '">立项</button>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">🧬 第 ' + (idx + 1) + ' 号培养舱 · 立项</div>' +
      '<div class="ui-sub" style="text-align:center;">直接立项，不消耗道具；完成后回实验室提取产物。</div>' +
      rows +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };
  /* ⛔ v156.15b（老板：「为什么地图上地块现在多了一层菜单…这不是套娃吗」）：
     `ui.openMapBar` / `ui.mapBarDetail` 整条撤除 —— 它们只做了一件事：
     把"点地块 → 原面板"多插了一层（出征/侦查/详情）。
     那三个动作原本就在面板里，所以这层是纯冗余；点地块现在直接开面板（见 map3d.pickAt）。
     smoke §580 反向钉住"不许多一层"。 */
  /* ⛔ v89.218（老板）：「故事全部去除」——
     文字游戏阅读器（#story-fx / SG_KIND / SG_MURAL / openStory / sgDefer /
     sgTryTrigger / sgTryAct / sgPendingHTML / sgReadPending / sgDropPending /
     sgRender / sgHTML / sgPick / sgClose）整条退役；内容层 story/ 已删。 */
})();
