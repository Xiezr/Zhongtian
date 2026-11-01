/* ============================================================
 * ui-battle.js　战斗 · 观战 / 沙盘 / 战略战术 / 俘虏 / 警报 / 阵亡名录
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
  var BLDG_FUNC = ui._C.BLDG_FUNC;

  /* ============================================================
   * 在办事项（v29 · 需求 6）：建造 / 募兵 / 自动升级 / 行军 一览
   * ------------------------------------------------------------
   * 原先挂在「公文」页，公文的职责是"报告与消息"，队列是"正在办的活"，
   * 性质不同、也不该占公文半屏。现在迁到**政务厅弹窗**（城务的归口）——
   * 玩家想查"还在建什么、还在募什么"时，去城务面板看，符合直觉。
   * ============================================================ */
  /* `limit` 可选：政务厅面板只列前 N 条（v65 收口）——
     面板的高度必须可控（老板硬规矩：弹窗内不许有下拉条），
     而"在办事项"是最容易无限长的一块（募兵一排队就十几条）。 */
  ui.queueBody = function (limit) {
    var s = GAME.state;
    if (!s) return '';
    var rows = [];
    /* ① 建造 / 升级 */
    (s.queues.build || []).forEach(function (q) {
      var b = DATA.BUILDINGS[q.buildId] || DATA.EXT_BUILDINGS[q.buildId];
      var city = GAME.cityById(q.cityId);
      var tail = q.type === 'ext_build' ? ' 新建' : (q.type === 'ext_upgrade' ? ' 升 Lv' + q.targetLevel : '');
      rows.push({
        kind: '🏗️ 建造',
        what: (city ? U.escape(city.name) + ' · ' : '') + (b ? b.name : '建筑') + tail,
        pct: Math.min(100, Math.floor((q.elapsed || 0) / q.totalTime * 100)),
      });
    });
    /* ② 募兵：按军营分列，标明执行中 / 排队等待 */
    var byBar = {};
    (s.queues.train || []).forEach(function (q) {
      var k = GAME.trainQueueKey(q);
      byBar[k] = byBar[k] || [];
      byBar[k].push(q);
    });
    Object.keys(byBar).forEach(function (k) {
      var list = byBar[k];
      var city = GAME.cityById(list[0].cityId);
      var bIdx = (list[0].bIdx == null ? -1 : list[0].bIdx);
      var lv = city ? GAME.barracksLevel(city, bIdx) : 0;
      list.forEach(function (q, i) {
        var t = DATA.TROOPS[q.troopId];
        rows.push({
          kind: '⚔️ 募兵',
          what: (city ? U.escape(city.name) + ' · ' : '') +
            (bIdx >= 0 ? '军营' + (lv ? ' Lv' + lv : '') + '（城内第 ' + (bIdx + 1) + ' 格） · ' : '') +
            (t ? t.name : q.troopId) + ' ×' + U.numText(q.count, 0) +
            (i === 0 ? '' : '<span class="ui-sub">（排队第 ' + (i + 1) + '）</span>'),
          pct: i === 0 ? Math.min(100, Math.floor((q.elapsed || 0) / q.totalTime * 100)) : -1,
        });
      });
    });
    /* ③ 自动升级（只在开启时出现） */
    if (s.settings && s.settings.autoUpgrade) {
      var as2 = s.autoState || {};
      rows.push({ kind: '自动升级', what: U.escape(as2.msg || '待命'), pct: -1 });
    }
    /* ④ 行军 */
    (s.marches || []).forEach(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      rows.push({ kind: '🛫 行军', what: U.escape(m.name) + '（' + md.name + '）' + pr.label, pct: -1 });
    });

    if (!rows.length) return '<div class="q-empty">队列空闲：没有在建、在募、在途的任务。</div>';
    var shown = limit ? rows.slice(0, limit) : rows;
    var more = (limit && rows.length > limit)
      ? '<div class="op-hint">另有 ' + (rows.length - limit) + ' 条在办（按入队顺序推进，完成后自动接续）</div>'
      : '';
    return '<table class="tbl"><thead><tr><th>类别</th><th>内容</th><th style="width:130px;">进度</th></tr></thead><tbody>' +
      shown.map(function (r) {
        return '<tr><td>' + r.kind + '</td><td>' + r.what + '</td><td class="num">' +
          (r.pct < 0 ? '—'
            : '<span class="qbar" style="display:inline-block;width:64px;vertical-align:middle;margin-right:6px;">' +
              '<i style="width:' + r.pct + '%"></i></span>' + r.pct + '%') +
          '</td></tr>';
      }).join('') + '</tbody></table>' + more;
    /* 注（v64）试过给这张表加分页 —— **没用**：分页条自己 ~50px，
       而队列常只有 1~2 行、根本不触发分页，净效果更高。
       v65 换成"只列前 N 条 + 摘要一行"，高度才真正可控。 */
  };

  /* ============================================================
   * 行军队列面板（v18）
   * 出征不再是「点一下就出结果」，而是先出发、再抵达 —— 这里能看到每支队伍
   * 走到哪了，并支持召回（无收益）与急行军令（立即抵达）。
   * ============================================================ */
  /* ============================================================
   * 伤兵营（v21 · 需求 1）
   * 原先挂在「设置」里 —— 位置本身就是错的：伤兵是**战斗产物**，
   * 不是系统配置项，玩家打完仗在设置里翻找才治得了伤。
   * 现归属两处：**练兵场**（军事建筑）与**行军菜单**（战果结算处）。
   * host 决定治疗后重绘谁：'xiaochang' → 练兵场弹窗 · 'marches' → 行军队列弹窗
   * ============================================================ */
  /* ============================================================
   * v89.116（老板「伤兵营放在军务处下，俘虏营也是。出现伤病或俘虏时，
   *   列出具体兵种及数量，不要一个总数量」）
   * ------------------------------------------------------------
   * 改前：伤兵营在**四处**各摆一套（设置→练兵场→行军队列弹窗→行军视图→军务处），
   *   除军务处外都只给一个总数，治疗按钮也散着放 —— 老板要的是"一个落点 + 逐兵种"。
   * 现在：**唯一落点 = 军务 · 军务处**（`ui.marchAffairsHTML` 里的两营卡片）；
   *   本函数降级为**一行指引**（保留计数 + 一键跳转），供练兵场 / 行军 / 行军弹窗使用。
   * ============================================================ */
  ui.WOUNDED_HOME_TXT = '伤兵营与俘虏营统一在「军务 · 军务处」——逐兵种清单、治疗归队、收编 / 释放都在那里。';
  ui.woundedBlock = function (host) {
    var n = GAME.state.wounded || 0;
    var fee = GAME.healFeeOf ? GAME.healFeeOf(n) : n * 10;   /* v89.115：走唯一出口 */
    return '<div class="wounded-box"' + (host ? ' data-heal-host="' + host + '"' : '') + '>' +
      '<div class="wb-head">' +
        '<span class="wb-t">🏥 伤兵营</span>' +
        '<span class="wb-n">' + U.numText(n, 0) + ' 名</span></div>' +
      /* v90.44（老板）：治疗费不再内联，移入按钮悬停。 */
      '<div class="wb-act">' +
        '<button class="btn' + (n ? ' gold' : '') + '" data-action="go-affairs"'
          + ' title="' + (n ? ('治疗费 ' + U.numText(fee, 0) + ' 旧币') : '暂无伤兵') + '">🏥 去军务处' +
          (n ? '（治疗 / 逐兵种清单）' : '（伤兵营）') + '</button>' +
      '</div></div>';
  };

  /* ⛔ v89.133（v89.128 第二批第 10 条 · 老板）：「练兵场不要现在的界面功能，点击建筑功能
     直接进入'军务'界面」—— 练兵场面板（openXiaochang）整条退役：
       · 出征 / 出征战术 → 「军务 · 出征 / 出征战术」页（main.js 的 open-xiaochang 改跳转）；
       · 伤兵营 → 「军务 · 军务处」（v89.116 起的唯一落点）；
       · 演武 / 阅兵（v89.80 练兵）→ 迁到「出征战术」页尾（见 ui.trainBlockHTML）。 */
  /* ⛔ v89.136 移除：`ui.trainBlockHTML`（练兵块 · 演武 / 阅兵）——
     老板第 4 条：「不要练兵 · 练兵场这个菜单和演武和阅兵，相应功能去除」。
     随本块一并退役：动作 `xc-spar` / `xc-review` / `xc-gen-pick`（main.js 墓碑）、
     域函数组 `GAME.xcSpar / xcReview / …`（domain.js 墓碑）、数据表 `DATA.XIAOCHANG`（data.js 墓碑）。
     练兵场建筑本身保留（出征队列 / 每队兵力上限的限额职能不变，见 BLDG_FUNC）。 */

  /* v89.179c（老板②B方案）：行军逐行的操作格 ——「⚡ 急行军」+「召回」。
     原先这里**只有**「召回」，而"立即抵达"只有面板底部一个**免费**按钮，
     结果付费的急行军令/疾行令被免费按钮完全压死（鬼商品）。
     现在单支即刻抵达也落成行内按钮，且**消耗急行军令**（marchScope:'one'）。 */
  ui.marchOpsCell = function (m) {
    var have = ((GAME.state || {}).items || {}).jixingjunling || 0;
    return '<td class="ctr">' +
      '<button class="btn sm" data-action="march-rush" data-id="' + m.id + '">⚡ 急行军（令 ' + have + '）</button> ' +
      '<button class="btn sm red" data-action="march-recall" data-id="' + m.id + '">召回</button></td>';
  };
  /* 面板底部的「全部即刻抵达」—— **消耗疾行令**（与行内那支分工：一支一个 · 一支全部）。
     持有 0 时按钮仍可点（点了会提示缺道具并就地开快购），不做 disabled 的"点了没反应"。 */
  ui.marchRushAllBtn = function (list) {
    if (!list || !list.length) return '';
    var have = ((GAME.state || {}).items || {}).jixing_ling || 0;
    return '<div style="text-align:center;margin-top:10px;">' +
      '<button class="btn' + (have > 0 ? ' gold' : '') + '" data-action="march-rush">' +
      '⚡ 疾行令 · 全部即刻抵达（持有 ' + have + '）</button></div>';
  };

  ui.openMarches = function () {
    var s = GAME.state;
    var list = s.marches || [];
    /* v20（需求 9）：弹窗内分页，重绘弹窗自身 */
    var pgM = ui.modalPage('marches', list, 8, function () { ui.openMarches(); });
    list = pgM.slice;
    var rows = list.map(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      var gen = null;
      (s.generals || []).forEach(function (g) { if (g.id === m.genId) gen = g; });
      var city = GAME.cityById(m.cityId);
      var n = 0;
      for (var k in m.army) n += m.army[k] || 0;
      return '<tr>' +
        '<td>' + md.icon + ' ' + U.escape(m.name) + '</td>' +
        '<td class="ctr">' + (gen ? U.escape(gen.name) : '—') + '</td>' +
        '<td class="ctr">' + (city ? U.escape(city.name) : '—') + '</td>' +
        '<td class="num">' + U.numText(n, 0) + '</td>' +
        '<td class="ctr">' + md.name + '</td>' +
        '<td style="min-width:120px;">' +
          '<div class="pbar"><i style="width:' + pr.pct + '%"></i></div>' +
          '<span style="font-size:var(--fs-cap);color:var(--text-dim);">' + pr.label + '</span></td>' +
        ui.marchOpsCell(m) +
        '</tr>';
    }).join('');
    var body = list.length
      ? '<table class="tbl"><thead><tr><th>目标</th><th>主将</th><th>出发城</th><th>兵力</th><th>方式</th><th>行军进度</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>'
      : '<div class="q-empty">当前没有行军队列</div>';
    ui.openModal(
      '<div class="gold-heading">🛫 行军队列（' + list.length + '）</div>' +
      ui.woundedBlock('marches') +
      body +
      pgM.pager +
      ui.marchRushAllBtn(list) +
      '<div style="text-align:center;margin-top:10px;"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.135（老板 7）：行军进度/倒计时逐秒刷新（分页状态在 _pages，重开不丢） */
      { live: function () { ui.openMarches(); } }
    );
  };

  /* ============================================================
   * 行军视图（v19 · 需求 6）：监控**本城在外军队**
   *   ① 行军中：出发 → 抵达的队列（可召回）
   *   ② 在外驻军：野地采集队（可收获/撤回）
   * ============================================================ */
  /* ============================================================
   * v89.86（整改 P-20）：行军视图 → **军务总览**
   * ------------------------------------------------------------
   * 老板实测：91 兵散在 4 块野地、2 支采集队在外，全站没有一个页面能
   * 一眼看全"我的兵都在哪"（只能逐块点开野地弹窗）。
   * 本页收敛为五段：城内 / 驻守野地 / 采集队 / 行军 / 伤兵。
   * data-view="marches" 与既有动作（召回 / 收获 / 治疗）一字未动 —— 只换内容。
   * ============================================================ */
  /* ============================================================
   * 战场界面（v89.87 · 老板需求 4）：实时观战 + 逐回合指挥
   * ------------------------------------------------------------
   * · 距离轴战场：左我军 / 右敌军，位置 = 推进度（adv）映射；
   *   CSS `transition: left` 做位移动画 —— 每回合结算后两军"看着走"；
   * · 逐兵种指令：前进 / 驻守 / 后退 + 指定目标（敌方兵种 / 城防箭塔）；
   * · 读秒：`settings.battleSec` 真实秒（默认 60）—— 到点自动结算本回合，
   *   点「完成回合」立即结算（老板需求：完成后立即完成该回合）；
   * · 「自动战斗」一键跑完；关闭 = 转后台（军务总览「征战中」可再进）；
   * · 单例：同一时刻只展示一个战场（其他挂起战斗在军务里切换）。
   * ============================================================ */
  ui._bt = null;                    /* { id, lastRound, playing, timer } */
  ui.btStanceName = { advance: '前进', hold: '驻守', retreat: '后退' };
  ui.btSideName = function (side) { return side === 'atk' ? '我军' : '敌军'; };

  /* ---- 按推进度映射横轴位置（%）：我军 4→46，敌军 96→54 ---- */
  /* ============================================================
   * v89.103（老板「两方应该在同一片战场上战斗」）：**共享距离轴**
   * ------------------------------------------------------------
   * 改前：我军钉在 4%→46%、敌军钉在 96%→54% —— 各自只走半个场，
   *       中间 8% 是**永久空档**，两半的兵永远不接触（老板原话）。
   * 现在：两个方向共用一条轴（0 = 我军出发线，D = 敌军出发线），
   *       映射到 4%..96% —— 双方都推进到中线就**照面**，
   *       谁的前沿被歼，谁的线就往自己出发线退。
   * ⚠️ 唯一出口：实时战场（bt-field）与战报沙盘（sd-field）都读它。
   * ============================================================ */
  ui.btPosPct = function (side, adv, D) {
    var f = Math.max(0, Math.min(1, (adv || 0) / (D || 1)));
    return side === 'atk' ? (4 + f * 92) : (96 - f * 92);
  };
  /* 共享轴坐标（0 = 我军出发线，D = 敌军出发线）→ 屏上 % —— 接触线/前线画在轴上 */
  ui.sdAxisPct = function (pos, D) {
    return ui.btPosPct('atk', Math.max(0, Math.min(D || 1, pos || 0)), D);
  };

  /* 间距读数（唯一出口）：**开打前**也要给真间距，不能拿"纵深"顶替 ——
     v89.116（老板「战场间距似乎不对，确认间距规则」）实证：
       旧代码 `rec.gapLast == null ? snap.field : rec.gapLast` 在第一帧之前
       显示的是**纵深 1400**（整片战场），而真实间距是 1400−100−100 = **1200**。
     间距规则（引擎 frontsOf 唯一出口）：
       posA = 我方最前推进度；posD = 纵深 − 敌方最前推进度；
       gap = max(0, posD − posA)；两军各自推进到"进入自己有效射程"就停 → gap 会稳定在
       较近战的一方射程上（步行机对步行机实测稳定在 50）。 */
  ui.btGapOf = function (rec, snap) {
    if (rec && rec.gapLast != null) return rec.gapLast;
    try { return GAME.tactic.frontsOf(snap.atk || [], snap.def || [], snap.field || 1).gap; }
    catch (e) { return null; }
  };
  /* v89.149（老板 7）：「左上备注：间距 30，**这里的间距统一设置为最近距离/全局战场距离**」——
     读数文案**唯一出口**（战场顶栏 / 沙盘顶栏 / 实时刷新都读它，不再各写一串）：
       最近距离 = 两军最前线之间的距离（= 引擎 frontsOf 的 gap；推进到进入射程即停）
       全局     = 战场纵深（由双方配兵决定，见 tactic.battlefieldOf）
     改前只写"间距 30" —— 玩家不知道 30 是什么尺度、更不知道战场有多深。 */
  ui.gapReadOf = function (gap, D) {
    /* v89.151（老板旧账 7）：「读数统一，**距离 XX/XX**」——
       v89.149 曾作「最近距离 X / 全局 D」两段标签，现收敛为**一段双数**：
       前数 = 两军最前线距离（引擎 frontsOf 的 gap）· 后数 = 战场纵深（双方配兵决定）。
       详细解释仍走 title（btGapTextOf），读数本身只留数字。 */
    var near = (gap == null) ? '—' : U.numText(gap, 0);
    return '距离 <b>' + near + '</b>' + (D ? ' / <b>' + U.numText(D, 0) + '</b>' : '');
  };
  ui.btGapTextOf = function (rec, snap, rGap) {
    var gp = (rGap == null) ? ui.btGapOf(rec, snap) : rGap;
    var D = (snap && snap.field) || null;
    return '<span id="bt-gap" title="距离 = 两军最前线之间的距离（纵深 − 双方推进度；'
      + '推进到进入射程即停）/ 后数 = 战场纵深（双方配兵决定）">'
      + ui.gapReadOf(gp, D) + '</span>';
  };
  /* ---- 顶部条 ---- */
  /* v89.175：智能指示 span 的**唯一出口**（btTopHTML 首绘 + btAfterStep 每回合同步）。
     老板「每回合我要看见调整（可以不动，但需要显示智能调兵完成）」：
     文本 = "⚡ 智能 · 调整 N / 维持"（读 rec.smartNote 快照）；
     title = 赛马采用的目标策略 + 本回合明细（前 6 条）。 */
  ui.btSmartHTML = function (rec) {
    if (!(GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf() && rec && rec.side === 'atk')) return '';
    var sn175 = rec.smartNote;
    var rc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.ruleCN || {})[rec.smartRule] || rec.smartRule || '静态表';
    var tip175 = '智能战斗：赛马采用「' + rc175 + '」——' + (sn175 && sn175.n
      ? ('本回合调整 ' + sn175.n + ' 项：' + (sn175.notes || []).slice(0, 6).join('；'))
      : '本回合维持阵型（无需调整）')
      + '。切换在「出征 / 自动出征 · 战术」下拉。';
    return '<span class="bt-smart" title="' + U.escape(tip175) + '">⚡ 智能'
      + (sn175 ? (' · ' + (sn175.n ? ('调整 ' + sn175.n) : '维持')) : '') + '</span>';
  };
  /* v150（P0-2）：**指挥模式行** —— 托管 / 已接管，一眼看清"现在听谁的"。
     假控制的病根就是"改了却被打回、还看不出来"，所以这一行必须常驻。 */
  ui.btModeHTML = function (rec) {
    var off = !!rec.autoOff;
    return '<span class="bt-mode" id="bt-mode" data-action="bt-auto-off"'
      + ' style="cursor:pointer;font-size:var(--fs-cap);padding:0 var(--sp-1);'
      + 'border-radius:var(--r-sm);border:1px solid var(--line);color:'
      + (off ? 'var(--gold-light)' : 'var(--text-dim)') + ';"'
      + ' title="' + U.escape(off ? '你现在说的算。点一下交回托管（每回合自动调整）'
        : '正在托管：每回合自动调整指令。点一下由你接管') + '">'
      + (off ? '✋ 已接管' : '🤖 托管中') + '</span>';
  };
  /* 三选一条：第 N 回合结算后出现（**嵌在面板里，不弹窗**，不阻塞主循环）。 */
  ui.btAskHTML = function (rec) {
    if (!rec || rec.askAt == null) return '';
    var A = (GAME.DATA && GAME.DATA.BATTLE_ASK) || {}, C = A.choices || {};
    var btn = function (k) {
      var d = C[k]; if (!d) return '';
      return '<button class="btn sm' + (k === 'flee' ? '' : ' gold') + '" data-action="bt-pick" data-choice="' + k + '"'
        + ' title="' + U.escape(d.desc || '') + '">' + d.name + '</button>';
    };
    return '<div id="bt-ask" style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;'
      + 'padding:var(--sp-2) var(--sp-3);margin:var(--sp-1) 0;border:1px solid var(--gold-dark);'
      + 'border-radius:var(--r-sm);background:rgba(var(--gold-rgb),.10);">'
      + '<b style="color:var(--gold-light);">第 ' + rec.askAt + ' 回合 · 你来定</b>'
      + btn('assault') + btn('hold') + btn('flee')
      + '<span data-action="bt-auto-off" style="cursor:pointer;font-size:var(--fs-cap);'
      + 'color:var(--text-dim);text-decoration:underline;">以后都托管</span>'
      + '</div>';
  };

  ui.btTopHTML = function (rec, snap) {
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 10;
    var cnt = (rec.cnt == null) ? sec : rec.cnt;
    /* v89.120（老板「那三个雷霆大按钮，完成回合、自动战斗、撤回。缩小，
       放到战场上方读秒那行正中间」）：三键从弹窗底栏移到读秒行 ——
       `.bt-top` 改 grid 三列（左=读数 / 中=三键 / 右=提示），按钮降为 btn sm；
       长说明挪进 title（别与中间按钮挤）。 */
    return '<div class="bt-top">' +
      '<span class="bt-left">' +
        '<span class="bt-cd">⏳ <b id="bt-cd">' + Math.max(0, Math.ceil(cnt)) + '</b> 秒</span>' +
        '<span>第 <b id="bt-round">' + (snap.round || 0) + '</b> / ' + (snap.maxRounds || 30) + ' 回合</span>' +
        /* v89.164（老板 3）：智能战斗指示 —— 开着时玩家能看出"为什么接敌自动变防御"；
           切换入口在出征 / 自动出征面板的「战术」下拉。守城战不受托管（不显示）。
           v89.175（老板 1）：指示带**本回合调整**（"调整 N"/"维持"）+ 赛马策略；
           唯一出口 ui.btSmartHTML —— 首绘与每回合同步共用（见 btAfterStep）。
           ⚠️ 顶栏首绘于"进战场"那一刻、打回合时**不整体重建** —— 所以 btAfterStep
           必须显式同步这个 span（否则后缀停在上一次快照 = "看不见调整"）。 */
        ui.btSmartHTML(rec) +
        ui.btModeHTML(rec) +
        ui.btGapTextOf(rec, snap) +
        ui.btLossHTML(rec, snap) +
      '</span>' +
      '<span class="bt-acts" id="bt-acts">' +
        /* v89.207（老板 1·快赢④）：战斗增速档（1×/2×/4×）—— 只快放观战动画，不改战斗结果 */
        ui.btSpdHTML() +
        '<button class="btn sm gold" data-action="bt-done">✅ 完成回合</button>' +
        '<button class="btn sm" data-action="bt-auto">⏩ 自动战斗</button>' +
        '<button class="btn sm" data-action="bt-retreat">🏳️ 撤退</button>' +
      '</span>' +
      /* ⛔ v89.149（老板 6）「不要这个备注：左侧设动作/目标」整条退役 ——
         动作/目标就在两侧下拉里（点一下就知道）；右列留空后三键仍居中（grid 1fr auto 1fr）。 */
      '</div>';
  };

  /* ---- 战场条：**只画兵种图标**（数量在两侧列表的图标下 —— 老板需求 8） ---- */
  ui.btFieldHTML = function (snap) {
    var D = snap.field || 1;
    /* v89.103：两军共用一条距离轴 → 交战时会在同一 x 上照面。
       于是敌方每队**下移半行**（21px）——"我方第 i 队 vs 敌方第 i 队"上下相邻，
       兵牌不会互相遮住，接触时看起来就是"贴上了"。
       v89.116：令牌内容收敛为**一枚图标** —— 名称与数量都不在场上（数量看左右列表）。 */
    /* v89.149（老板 5）：「中间战场区域的下方**拉到回合记录的上方**（高度拉高）」——
       改前：高度 = 兵种行数 × 42 + 35（内容撑高）——3 队时只有 203px，而 board 行 339px
       → 战场条底边离回合记录留 **140px** 空白（实机实测）。
       改后：高度交给 CSS（`.bt-field { height: 100% }` 填满 board 行），兵牌按 `--rel` **纵向铺满**：
         atk 第 i 队 → rel = i / n；def 第 i 队 → rel = (i + 0.5) / n（错半行，与 v89.103 同规）。
       `--rel` 是无单位数，CSS 用 `top: calc((100% - 牌高) * var(--rel))`；
       兵种数 > 8 队时挂 `dense` 档（牌与图标缩一档），12 队也能一屏放下。 */
    /* v89.176（老板「谁在下一回合接敌」）：接敌预测一次算好 ——
       兵牌角标（本函数）与顶栏读数（btLossHTML）读同一个出口（contactForecast）。 */
    var _inc176 = {};
    try {
      var _fc176 = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast(snap.atk || [], snap.def || [], D) : null;
      if (_fc176) _inc176 = _fc176.engage || {};
    } catch (e) { _inc176 = {}; }
    function uHTML(u, idx, side, denom) {
      /* v89.117（老板「兵种数量降为 0（该兵种被消灭后），战场上的兵种图标变暗」）：
         初绘就带 dead（后台推进时可能"没动过就全灭"），后续由 btSyncCounts 增删。 */
      var rel = ((idx + (side === 'def' ? 0.5 : 0)) / denom).toFixed(4);
      /* v89.150（老板 1）：兵牌外框按兵种三档 —— 形态走唯一出口 GAME.troopShapeOf
         （界面只回显；宽度差由 CSS 的 --u-w 三档实现）。
         v89.230：类名同步 —— walk（徒步）/ ride（机车）/ craft（器械）。 */
      var _sh150 = (GAME.troopShapeOf ? GAME.troopShapeOf(u.id) : 'walk');
      /* v89.151（老板 5）：悬停从 title（纯文本）改**富浮层**（#tip-layer 走 data-tip-el 机制）
         —— 克制/被克要绿字红字，title 装不下颜色。文案与侧栏共用同一出口 `ui.btUnitTip`。 */
      return '<div class="bt-unit ' + side + ' ' + _sh150 + (u.count > 0 ? '' : ' dead')
        + (_inc176[side + '|' + u.id] ? ' incoming' : '') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        'data-tip-el="1" ' +
        'style="left:' + ui.btPosPct(side, u.adv, D) + '%;--rel:' + rel + ';">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<span class="tip-src">' + ui.btUnitTip(u, side) + '</span></div>';
    }
    var nA = (snap.atk || []).length, nD = (snap.def || []).length;
    /* v89.149：铺满口径 —— 分母 = max(两侧行数) − 0.5（def 侧错半行，末位正好落 1.0 = 贴底）
       → 第一枚贴顶、最后一枚贴底，整叠**纵向铺满**；单兵种（rows=1）时退化为"上半场"，
       不把两支孤军甩到战场两端（分母下限 1）。 */
    var _rows149 = Math.max(1, Math.max(nA, nD));
    var denom149 = Math.max(1, _rows149 - 0.5);
    var atkH = (snap.atk || []).map(function (u, i) { return uHTML(u, i, 'atk', denom149); }).join('');
    var defH = (snap.def || []).map(function (u, i) { return uHTML(u, i, 'def', denom149); }).join('');
    var cast = snap.towers
      ? '<div class="bt-castle">🏯 箭塔 <b id="bt-tower">' + snap.towers.left + '</b> / ' + snap.towers.start + '</div>'
      : '';
    return '<div class="bt-field' + ((Math.max(nA, nD) > 8) ? ' dense' : '') + '" id="bt-field">'
      + atkH + defH + cast
      /* v89.176（老板「沙盘与战场沙盘统一化」）：与战报沙盘共用三线 + 标尺
         （同一把 frontsOf 口径；line/scale 的唯一出口在 fieldLinesHTML/fieldScaleHTML） */
      + ui.fieldLinesHTML(ui.btSideName, snap.atk || [], snap.def || [], D, 'bt-fl')
      + ui.fieldScaleHTML(ui.btSideName, D) + '</div>';
  };

  /* ============================================================
   * v89.116（老板需求 8）：两侧兵种列表（各占 1/4）
   * ------------------------------------------------------------
   * 一行 = 图标 + **图标下的数量** + 动作下拉 + 目标下拉。
   *  · 我方（atk）：两个下拉都可改（动作 = 前进 / 驻守 / 后退；目标 = 敌方兵种 / 箭塔）；
   *  · 敌方（def）：**只读**，默认动作=前进、目标=我方同兵种（引擎级默认，见 tactic.unitsOf）。
   * 动作从"三个并排按钮"改成**一个下拉框**（老板：「不要直接列出，节省空间」）——
   * 下拉走既有 `change → GAME.action` 分发（main.js），动作名 `bt-stance` 不变。
   * ============================================================ */
  /* ============================================================
   * v89.136（老板 2）：「军队战斗界面我军和敌军上方显示双方英雄，悬停可显示英雄六维」
   * ------------------------------------------------------------
   * 数据来源（同一出口）：
   *   · 我方 = rec.genId → state.generals（实时对象，含装备加成后的六维）；
   *   · 敌方 = rec.sim.scGen（**确定性守将快照** —— 与侦查/战斗同一个 guard）。
   * 六维悬停 = ui.GEN_DIMS × GAME.genAttrs（不手抄字段，防漂移）。
   * ============================================================ */
  /* ============================================================
   * v89.137（老板 2）：「军队战斗界面，鼠标悬停兵种时，显示其**最终属性**
   *   （各种科技，英雄等加成后）」——
   * 唯一出口 = GAME.battle.unitFinalOf（它再读引擎的 perAtk / perDef / perHp，
   * 悬停与结算同一把尺）；本函数只负责"取该单位所属方的英雄 + 排版"。
   * 英雄来源与 btGenLine 同源：我方 = rec.genId；敌方 = rec.sim.scGen。
   * ============================================================ */
  /* ============================================================
  /* v89.179：克制系统全撤 —— `ui.troopCounterOf`（克制/抗性/被克反查，v89.151 唯一出口）
     随两张相克表一并退役；兵种悬停不再有"克制 / 抗性 / 被克"三行
     （v89.157 的"无相克不显示"至此演进为"全局无相克"）。 */
  ui.btUnitTip = function (u, side) {
    if (!u) return '';
    var bt = ui._bt;
    var rec = bt ? GAME.battle._recOf(bt.id) : null;
    var gen = null;
    if (rec) {
      if (side === 'atk') {
        (GAME.state.generals || []).forEach(function (x) { if (x.id === rec.genId) gen = x; });
      } else {
        gen = (rec.sim && rec.sim.scGen) || null;
      }
    }
    var f = GAME.battle.unitFinalOf ? GAME.battle.unitFinalOf(u, gen) : null;
    if (!f) return U.escape(u.name || '');
    /* v89.151（老板 5）：改成**富浮层 HTML** —— 排版按老板指定自上而下：
       兵种 → 数量 → 射程（并速度）→ 全军血量 → 全军攻击 → 全军防御 →
       收尾一行带队与加成说明（v89.179：克制三行随全撤删除）。
       ⛔ 显示"计算值"：血/攻/防都走 unitFinalOf（同一把尺，含科技/英雄/装备加成）。 */
    var h = '<div class="tip-t">' + U.escape(f.name) + '</div>';
    h += '<div class="tip-l">数量 <b>' + U.fmt(f.count) + '</b> 名</div>';
    h += '<div class="tip-l">射程 <b>' + U.fmt(f.range) + '</b>　速度 <b>' + U.fmt(f.spd) + '</b></div>';
    h += '<div class="tip-l">全军血量 <b>' + U.fmt(f.totalHp) + '</b></div>';
    h += '<div class="tip-l">全军攻击 <b>' + U.fmt(f.totalAtk) + '</b></div>';
    h += '<div class="tip-l">全军防御 <b>' + U.fmt(f.totalDef) + '</b></div>';
    /* v89.180（老板 1）：拆械特性行（无人轰炸机专属 · 有才显示） */
    var _tt180 = DATA.TROOPS[u.id];
    if (_tt180 && _tt180.vsMech) h += '<div class="tip-l">拆械 对器械伤害 ×' + _tt180.vsMech + '</div>';
    /* v89.179：克制/抗性/被克三行随全撤删除。 */
    h += '<div class="tip-a">' + (gen ? '带队 ' + U.escape(gen.name) + '（Lv' + (gen.level || 1) + '）· ' : '（无英雄带队）· ')
      + '已含科技 / 英雄 / 装备加成</div>';
    return h;
  };

  ui.btGenTip = function (g) {
    if (!g) return '';
    var a = GAME.genAttrs(g);
    return (ui.GEN_DIMS || []).map(function (d) {
      return d.n + ' ' + (a[d.val || d.k] || 0);
    }).join(' · ');
  };
  ui.btGenLine = function (side) {
    var bt = ui._bt;
    var rec = bt ? GAME.battle._recOf(bt.id) : null;
    var g = null;
    if (rec) {
      if (side === 'atk') {
        (GAME.state.generals || []).forEach(function (x) { if (x.id === rec.genId) g = x; });
      } else {
        g = (rec.sim && rec.sim.scGen) || null;
      }
    }
    if (!g) return '<div class="bt-gen' + (side === 'atk' ? ' mine' : ' foe') + '">' +
      '<span class="bt-gen-q">英雄：—</span></div>';
    var tip = '英雄 ' + (g.name || '—') + '（Lv' + (g.level || 1) + '）\n' + ui.btGenTip(g);
    return '<div class="bt-gen' + (side === 'atk' ? ' mine' : ' foe') + '" title="' + U.escape(tip) + '">' +
      '⚔ ' + U.escape(g.name || '—') + '<span class="bt-gen-lv">Lv' + (g.level || 1) + '</span></div>';
  };

    /* ============================================================
   * v89.149（老板 4）：「不要再显示"目标："这样的标识」——
   *   目标文案**唯一出口**（战场两侧只读行 + 沙盘只读行都读它）：
   *     同兵种（打对面同名兵种）/ 城头箭塔 / 兵种名 / 任意。
   *   ⚠️ "同兵种"的判定 = `target === 自己的兵种 id`（引擎的匹配规则就是按 id 找对面那支），
   *   不是界面自造的语义 —— 界面只做回显。
   * ============================================================ */
  ui.btTargetLabelOf = function (u, foeList) {
    var tg = (u && u.target) || '';
    if (!tg) return '任意';
    if (tg === DATA.TARGET_WALL) return '城头箭塔';
    if (u && tg === u.id) return '同兵种';
    var hit = (foeList || []).filter(function (x) { return x.id === tg; })[0];
    return hit ? U.escape(hit.name) : U.escape(tg);
  };
  ui.btSideHTML = function (snap, side) {
    var foeList = (side === 'atk') ? (snap.def || []) : (snap.atk || []);
    var mine = (side === 'atk');
    var myList = mine ? (snap.atk || []) : (snap.def || []);
    /* v89.140（老板 1）：「左右的兵种设置这里建议不要图标了，直接**第一行是兵种名称+行动，
       第二行是数量+目标**。然后还是**只显示在场的兵种**吧，没有的就不要了」——
       于是：① 去掉 `.bt-ico`；② 每格两行（名+动作 / 数+目标）；③ 只遍历**参战**列表
       （v89.139 的"全兵种 + 灰暗占位"整段退役）。 */
    var rows = myList.map(function (u) {
      var alive = u.count > 0;
      var stOpts = ['advance', 'hold', 'retreat'].map(function (s) {
        return '<option value="' + s + '"' + ((u.stance || 'advance') === s ? ' selected' : '') + '>'
          + ui.btStanceName[s] + '</option>';
      }).join('');
      /* v89.149（老板 4）：「行动和目标设置的下拉框，**默认显示前进和同兵种**……
         不要再显示'目标：'这样的标识」——选项 = 同兵种（默认）/ 任意 / 各敌兵种（只写名字）/ 城防箭塔。
         默认值不在界面造：**引擎**里给（`unitsOf`：未设目标 → 打同兵种），界面如实回显 ——
         史实与沙盘重跑才同源（§20.5 v89.116 的规矩）。 */
      var tOpts = '<option value="' + u.id + '"' + (u.target === u.id ? ' selected' : '') + '>同兵种</option>'
        + '<option value=""' + (!u.target ? ' selected' : '') + '>任意</option>';
      foeList.forEach(function (d) {
        if (d.id === u.id) return;                    /* 同兵种已在首项，不重复列 */
        tOpts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>'
          + U.escape(d.name) + '</option>';
      });
      if (snap.towers && snap.towers.left > 0) {
        tOpts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '')
          + '>城防箭塔</option>';
      }
      /* 悬停"最终属性"移到**名称**上（图标没了，名称即靶心）；
         v89.149（老板 3）：「为兵种设置一个**一字简称**，不要挤压行动设置和目标设置」——
         名称改简称（`GAME.troopAbOf` 唯一出口），全名与最终属性都还在悬停里（信息不丢）。
         实测改前：格子 105px，名字吃掉 60px → 两个下拉只剩 31px / 57px。 */
      return '<div class="bt-card' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        '<span class="bt-l1">' +
          /* v89.151（老板 5）：同走富浮层（与兵牌同一出口）—— 简称是悬停靶心 */
          '<i class="bt-rnm" data-tip-el="1">' + U.escape(GAME.troopAbOf(u.id))
            + '<span class="tip-src">' + ui.btUnitTip(u, side) + '</span></i>' +
          (mine
            ? '<select class="bt-sel" data-action="bt-stance" data-troop="' + u.id + '" id="bt-s-' + u.id + '">'
                + stOpts + '</select>'
            : '<span class="bt-ro">' + (ui.btStanceName[u.stance] || u.stance) + '</span>') +
        '</span>' +
        '<span class="bt-l2">' +
          '<b class="bt-rn" id="bt-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
          (mine
            ? '<select class="bt-sel" data-action="bt-target" data-troop="' + u.id + '" id="bt-t-' + u.id + '">'
                + tOpts + '</select>'
            : '<span class="bt-ro">' + ui.btTargetLabelOf(u, foeList) + '</span>') +
        '</span></div>';
    }).join('');
    return '<div class="bt-side ' + (mine ? 'mine' : 'foe') + '" id="bt-side-' + side + '">' +
      /* v89.148（老板 3）：「上方这个备注去掉：我军（3 队）、敌军（5 队）」——
         表头只留"我军 / 敌军"（队数在下方各兵种卡上一目了然）。 */
      '<div class="bt-side-h">' + ui.btSideName(side) + '</div>' +
      /* v89.136（老板 2）：「我军和敌军上方显示双方英雄，悬停可显示英雄六维」 */
      ui.btGenLine(side) +
      '<div class="bt-cards">' + (rows || '<div class="q-empty">无</div>') + '</div></div>';
  };
  /* ============================================================
   * v89.176（老板「减少伤亡很重要」+「让问题记录和暴露，以便分析和改进」）：
   * **损失读数**（唯一出口）——从快照的 start↔count 算双方损失率
   * （v89.151 起快照带 start）；无 start（老快照/桩数据）→ 返回 null 不渲染。
   * ============================================================ */
  ui.btLossOf = function (snap) {
    if (!snap) return null;
    function sum(list) {
      var s0 = 0, s1 = 0, has = false;
      (list || []).forEach(function (u) {
        if (u.start == null) return;
        has = true; s0 += u.start || 0; s1 += u.count || 0;
      });
      return (has && s0 > 0) ? { pct: (s0 - s1) / s0, s0: s0, s1: s1 } : null;
    }
    var a = sum(snap.atk), d = sum(snap.def);
    return (a || d) ? { a: a, d: d } : null;
  };
  /* 顶栏损失 span：常态 / .warn（近撤退线）/ .danger（达线）；含接敌计数（与角标同源） */
  ui.btLossHTML = function (rec, snap) {
    var L = ui.btLossOf(snap);
    if (!L) return '';
    var aPct = L.a ? Math.round(L.a.pct * 100) : 0;
    var dPct = L.d ? Math.round(L.d.pct * 100) : 0;
    var incN = 0;
    try {
      var fc = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast((snap && snap.atk) || [], (snap && snap.def) || [],
            (snap && snap.field) || 1) : null;
      Object.keys((fc && fc.engage) || {}).forEach(function (kq) {
        if (kq.indexOf('atk|') === 0) incN++;
      });
    } catch (e) { incN = 0; }
    var ra = GAME.battle.retreatAtOf(), wa = GAME.battle.warnAtOf();
    var cls = (aPct / 100 >= ra) ? ' danger' : ((aPct / 100 >= wa) ? ' warn' : '');
    var tip = '我军损失 ' + aPct + '%（撤退线 ' + Math.round(ra * 100) + '% —— 到线且非名城目标将自动撤退）'
      + ' · 敌军损失 ' + dPct + '%' + (incN ? ' · 下一回合 ' + incN + ' 支将交手' : '');
    return '<span class="bt-loss' + cls + '" id="bt-loss" title="' + U.escape(tip) + '">📉 我损 '
      + aPct + '% · 敌损 ' + dPct + '%' + (incN ? ' · ⚔ ' + incN : '') + '</span>';
  };
  /* 接敌角标随回合同步（btAfterStep 调）——预测重算 + DOM 类增删（与初绘同出口） */
  ui.btMarkIncoming = function (snap) {
    if (!snap || !document.querySelectorAll) return;
    var D = snap.field || 1;
    var inc = {};
    try {
      var fc = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast(snap.atk || [], snap.def || [], D) : null;
      inc = (fc && fc.engage) || {};
    } catch (e) { inc = {}; }
    [['atk', snap.atk || []], ['def', snap.def || []]].forEach(function (pair) {
      pair[1].forEach(function (u) {
        var fu = document.querySelector('#bt-field .bt-unit[data-bside="' + pair[0] + '"][data-troop="' + u.id + '"]');
        if (fu && fu.classList) fu.classList.toggle('incoming', !!inc[pair[0] + '|' + u.id]);
      });
    });
  };

  /* 上部分整块（左我军 · 中战场 · 右敌军） */
  ui.btBoardHTML = function (snap) {
    return '<div class="bt-board" id="bt-board">' +
      ui.btSideHTML(snap, 'atk') + ui.btFieldHTML(snap) + ui.btSideHTML(snap, 'def') + '</div>';
  };

  /* ⛔ v89.116：`ui.btCmdHTML`（旧"逐兵种指令"块：三个并排按钮 + 目标下拉）**整条退役** ——
     动作/目标的设置全部搬进两侧兵种列表（`ui.btSideHTML`，动作改下拉框）。
     老板：「前进驻守撤退通过下拉框选择，不要直接列出，节省空间」。 */

  /* ============================================================
   * v89.142（老板 7）：「斗将战从未触发。**直接在回合战况这里播报即可**。
   *   斗将后自动开始军队战」
   * ------------------------------------------------------------
   * 病根（探针 probe_v89142b 实证）：斗将掷了、日志也写了，但
   *   ① 挂起会话 rec.sim **漏存 duel/genSim** → 结算后战报没有【斗将】段、
   *      我方斗将加成丢失（只有守方 scGen 带加成生效）；
   *   ② 回合战况（本函数下方的 #bt-log）**从来没有斗将行** —— 玩家全程看不见。
   * 播报口径：斗将不属于任何回合 → 固定压在播报窗**最底 = 时间最早**处；
   *   数据源 = `rec.sim.duel`（挂起时随会话保存的权威结果，绝不重掷）。
   *   新回合块插到顶部，这一行自然随之下沉，最后与最旧回合一起被 BT_LOG_MAX 裁掉。
   * ============================================================ */
  /* v89.144（老板 1）：斗将结果**文案的唯一出口**（顶部固定行与回合战况行同源 —— 改文案只改这里） */
  ui.btDuelLine = function (rec) {
    var d = (rec && rec.sim && rec.sim.duel) || null;
    if (!d || !d.done) return '';
    var side = (d.winner === 'atk') ? '我方' : '敌方';
    var pct = Math.round((d.bonusPct == null ? 0.10 : d.bonusPct) * 100);
    return '⚔ 战前斗将：' + (d.rounds || 3) + ' 合，' + side + '英雄 ' + (d.winnerName || '') +
      ' 胜（' + (d.wa || 0) + ' : ' + (d.wb || 0) + '）· 其全军 +' + pct + '%（限本战）';
  };
  ui.btDuelHTML = function (rec) {
    var line = ui.btDuelLine(rec);
    return line ? '<div class="bt-ev duel">' + U.escape(line) + '</div>' : '';
  };
  /* ⛔ v89.148（老板 2）退役：`ui.btDuelBarHTML`（战场最顶的固定斗将行）——
     老板原话：「这个播报出现在 2 处，**保留回合记录中的就行**」。
     保留的那一处 = `ui.btDuelHTML`（#bt-log 里的 `.bt-ev.duel` 行）；
     文案唯一出口 `ui.btDuelLine` 不变（两处曾同源，现在只剩一处读它）。 */
  ui.battlefieldHTML = function (rec) {
    var ses = GAME._bsess && GAME._bsess[rec.id];
    var snap = rec.snapLast || (ses ? ses.snap() : null) ||
      { round: rec.round || 0, field: 0, atk: [], def: [], towers: null };
    /* v89.116（老板需求 8）：上 = 三列（兵种列表 · 战场 · 兵种列表）；
       下 = **战况回合播报**（一回合一行，行动与战果同行）。
       v89.142：播报窗**预置战前斗将行**（重绘即恢复，不额外挂载）。 */
    return ui.btTopHTML(rec, snap) + ui.btAskHTML(rec) + ui.btBoardHTML(snap) +
      '<div class="bt-log" id="bt-log">' + ui.btDuelHTML(rec) + '</div>';
  };

  /* ============ 打开 / 关闭 ============ */
  /* ============================================================
   * v89.150（老板 5）：「不要主动直接弹出战斗界面，如果目前触发新战斗，提供一个弹窗，
   *   假设同时有多场战斗，简洁提供上方标题，下方表格样式的：目标，战斗类型，是否观战按钮」
   * ------------------------------------------------------------
   * 旧：行军抵达（`onMarchArrive`）→ **直接进战场**（玩家正在做别的事也被拽走）。
   * 新：弹本清单 —— **所有待指挥战斗**（`state === 'live'`）一处列出，多场并列；
   *   点「观战」才进战场。不点也行：战斗按 `settings.battleSec` 逐回合自动推进
   *   （后台照打，只是没有即时指挥）。
   * ============================================================ */
  ui.battleListOf = function () {
    return (((GAME.state || {}).battles) || []).filter(function (b) { return b.state === 'live'; });
  };
  /* 目标名：`rec.target` 存的是**原始目标**（`{kind:'wild',x,y}` —— 没有 name），
     名字要经 `GAME.battle.resolveTarget` 解析（与出征面板/预估**同一出口**，
     §18.2 的老规矩：界面读数一律用解析后的对象）。 */
  ui.battleListNameOf = function (t) {
    if (!t) return '（未知目标）';
    if (t.name) return t.name;
    try {
      var rt = (GAME.battle && GAME.battle.resolveTarget) ? GAME.battle.resolveTarget(t) : null;
      if (rt && rt.name) return rt.name;
    } catch (e) { /* 目标已不存在（被占/被拔）→ 落兜底 */ }
    return '（目标已变更）';
  };
  ui.battleListRowsHTML = function (list) {
    return (list || []).map(function (b) {
      var t = b.target || {};
      var mode = (GAME.battle && GAME.battle.modeOf) ? GAME.battle.modeOf(b.modeId) : null;
      var type = (b.side === 'def') ? '守城' : (((mode || {}).name) || '战斗');
      return '<tr>' +
        '<td>' + U.escape(ui.battleListNameOf(t)) + '</td>' +
        '<td>' + U.escape(type) + '</td>' +
        '<td class="num"><button class="btn sm gold" data-action="bt-open" data-id="' + b.id + '">👁 观战</button></td>' +
        '</tr>';
    }).join('');
  };
  /* ============================================================
   * v89.163（老板 1）：「导航栏 · 指挥战斗，将行军中的军队也显示在这个菜单中，多一个入口」——
   *   清单从"只有待指挥战斗"扩为**两段**：⚔ 战斗待指挥（观战）+ 🛫 行军中的军队（召回）。
   *   两段的只读出口各自唯一：`ui.battleListOf`（战斗 live）/ `ui.marchListOf`（行军中）。
   *   抵达自动弹（main.onMarchArrive）与底栏按钮共用本出口 —— 一份清单，两处入口。
   * ============================================================ */
  ui.marchListOf = function () {
    return (((GAME.state || {}).marches) || []);
  };
  ui.marchRowsHTML = function (list) {
    var s = GAME.state || {};
    return (list || []).map(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      var gen = null;
      (s.generals || []).forEach(function (g) { if (g.id === m.genId) gen = g; });
      var n = 0;
      for (var k in m.army) n += m.army[k] || 0;
      return '<tr>' +
        '<td>' + md.icon + ' ' + U.escape(m.name) + '</td>' +
        '<td class="ctr">' + (gen ? U.escape(gen.name) : '—') + '</td>' +
        '<td class="num">' + U.numText(n, 0) + '</td>' +
        '<td style="min-width:120px;">' +
          '<div class="pbar"><i style="width:' + pr.pct + '%"></i></div>' +
          '<span style="font-size:var(--fs-cap);color:var(--text-dim);">' + pr.label + '</span></td>' +
        ui.marchOpsCell(m) +
        '</tr>';
    }).join('');
  };
  /* ============================================================
   * v91.42（老板）：「奇观探索等同行军，请作为**行军管理的一部分**列入」——
   * 奇观探索在规则上就是一支行军队（1 现实小时抵达 · 可返回 · 按军力结算），
   * 故并入行军管理：① 军务总览「行军」段列进行内（带进度/读秒），
   * ② 「指挥战斗 · 行军中的军队」弹窗并入（读秒每秒跳动）。
   * ⚠️ 数据仍挂在**星球对象** `p.wonderExp`（非 state.marches —— 那是 `_savePlanetSlice`
   *   的**当前分片**槽位，异星球的队在切换时会丢）；出队列**按星球分组**渲染（各球奇观不同）。
   * ============================================================ */
  ui._pheOf = function (e, now) {
    var W = DATA.WONDER_CFG || { marchRealSec: 3600, exploreSec: 14400 };
    if (e.returning) return { ico: '↩︎', name: '返回', t: (e.retArrive - now) / 1000, retro: true };
    if (now < e.arriveAt) return { ico: '🛫', name: '行军', t: (e.arriveAt - now) / 1000, retro: false };
    /* v91.50（老板）：「在探索队列补充剩余探索时间」—— 累计阶段显示**距自动返航还剩多久**。 */
    var until = e.exploreUntil || (e.arriveAt + (W.exploreSec || 14400) * 1000);
    return { ico: '⛏', name: '探查累计', t: Math.max(0, (until - now) / 1000), retro: false, isAccrue: true };
  };
  /* 全星球奇观探索队 → 行内。
     vFull=true（军务总览 7 列：目标/出发/主将/方式/兵力/进度/操作）；
     vFull=false（指挥战斗弹窗 5 列：军队/主将/兵力/进度/操作 —— 列数随宿主表头，避免错位）。 */
  ui._wonderFlightRows = function (vFull) {
    var s = GAME.state || {}, now = U.now();
    var W = DATA.WONDER_CFG || { marchRealSec: 3600 };
    var rows = '';
    (GAME.planetsOf ? GAME.planetsOf() : []).forEach(function (pl) {
      var w = GAME.wonderOf ? GAME.wonderOf(pl.id) : null;
      (pl.wonderExp || []).forEach(function (e) {
        var ph = ui._pheOf(e, now);
        var g = null; (s.generals || []).forEach(function (x) { if (x.id === e.genId) g = x; });
        var city = GAME.cityByIdAnywhere ? GAME.cityByIdAnywhere(e.cityId) : GAME.cityById(e.cityId);
        var n = e.troops || 0;
        var baseSec = (W.marchRealSec || 3600);
        var expSec = (W.exploreSec || 14400);
        var pct, label;
        if (ph.isAccrue) {                       /* v91.50：累计阶段 —— 进度按**探索期**（exploreSec）走 */
          var elapsed = Math.max(0, expSec - ph.t);
          pct = Math.max(0, Math.min(100, Math.round(elapsed / expSec * 100)));
          label = '⛏ 探查累计 · 累计 ' + (e.accrued || 0) + ' 份 · 距返航 ' + U.durExact(ph.t);
        } else {
          pct = Math.max(0, Math.min(100, Math.round((ph.retro || ph.t <= 0) ? 0 : (1 - ph.t / baseSec) * 100)));
          label = ph.ico + ' ' + ph.name + ' · ' + pct + '% · 余 ' + U.durExact(ph.t);
        }
        var progCell = '<td style="min-width:150px;">' +
            '<div class="pbar"><i style="width:' + pct + '%"></i></div>' +
            '<span style="font-size:var(--fs-cap);color:var(--text-dim);">' + label + '</span></td>';
        var opCell = '<td class="ctr" style="white-space:nowrap;">' +
          (e.returning ? '' : '<button class="btn sm" data-action="wonder-recall" data-pid="' + pl.id + '" data-gen="' + U.escape(e.genId || '') + '" title="撤军：下令返航（英雄随之归位）">召回</button> ') +
          '<button class="btn sm" data-action="wonder-open" data-pid="' + pl.id + '" title="查看该星球的奇观（产出 / 探查队列）">查看</button></td>';
        if (vFull) {
          rows += '<tr>' +
            '<td>' + U.escape(w ? w.name : '奇观') + ' · ' + U.escape(pl.name) + '</td>' +
            '<td class="ctr">' + (city ? U.escape(city.name) : '—') + '</td>' +
            '<td class="ctr">' + (g ? U.escape(g.name) + ' Lv' + g.level : '无将') + '</td>' +
            '<td class="ctr">☄ 奇观探查</td>' +
            '<td class="num">' + U.numText(n, 0) + '</td>' + progCell + opCell + '</tr>';
        } else {
          rows += '<tr>' +
            '<td>' + U.escape(w ? w.name : '奇观') + ' · ' + U.escape(pl.name) + '</td>' +
            '<td class="ctr">' + (g ? U.escape(g.name) + ' Lv' + g.level : '无将') + '</td>' +
            '<td class="num">' + U.numText(n, 0) + '</td>' + progCell + opCell + '</tr>';
        }
      });
    });
    return rows;
  };
  ui.wonderFlightCount = function () {
    var n = 0; (GAME.planetsOf ? GAME.planetsOf() : []).forEach(function (pl) { n += (pl.wonderExp || []).length; }); return n;
  };
  ui.battleListHTML = function () {
    var list = ui.battleListOf();
    var mList = ui.marchListOf();
    var sec = ((GAME.state || {}).settings || {}).battleSec || 10;
    var h = '<div class="war-list">';
    h += '<div class="gold-heading">⚔ 战斗待指挥（' + list.length + '）</div>';
    if (list.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:10px;">' +
        '共 <b style="color:var(--gold-light);">' + list.length + '</b> 场 ——— ' +
        '点「观战」进场指挥；不观战也会每 ' + sec + ' 秒自动推进一回合（后台照打）。</div>' +
        '<table class="tbl"><thead><tr><th>目标</th><th>战斗类型</th><th>是否观战</th></tr></thead>' +
        '<tbody>' + ui.battleListRowsHTML(list) + '</tbody></table>';
    } else {
      h += '<div class="q-empty">当前没有待指挥的战斗</div>';
    }
    var _wf = ui._wonderFlightRows(false);
    var _wfn = ui.wonderFlightCount();
    h += '<div class="gold-heading" style="margin-top:16px;">🛫 行军中的军队（' + (mList.length + _wfn) + '）</div>';
    if (mList.length || _wfn) {
      h += '<table class="tbl"><thead><tr><th>军队</th><th class="ctr">主将</th><th class="num">兵力</th>' +
        '<th>行军进度</th><th class="ctr">操作</th></tr></thead>' +
        '<tbody>' + ui.marchRowsHTML(mList) + _wf + '</tbody></table>';
    } else {
      h += '<div class="q-empty">当前没有行军中军队（地图上对野地 / 据点 / 城市「出兵」即进入行军）</div>';
    }
    h += '</div>';
    return h;
  };
  ui.openBattleList = function () {
    /* v89.163：两段都空才不弹（改前只判战斗 —— 只有行军时也该进得来）。
       弹窗**已开着**时（.war-list 在）即使两段都空也**原地重绘** ——
       否则在清单里召回最后一条行军后会留下"幽灵行"（弹窗不刷新）。
       未开着且两段全空 → 只 toast。 */
    var opened = false;
    /* ⚠️ 用 querySelectorAll.length 而非 querySelector 真值 —— smoke 的 DOM 桩
       querySelector 恒返回假元素（永远 truthy），只有 querySelectorAll 会如实给 []。 */
    try { opened = !!(document && document.querySelectorAll
      && document.querySelectorAll('#modal-root .war-list').length > 0); } catch (e0) { opened = false; }
    if (!ui.battleListOf().length && !ui.marchListOf().length && !ui.wonderFlightCount() && !opened) {
      ui.toast('当前没有待指挥的战斗与行军中军队');
      return;
    }
    /* v89.165（老板：「指挥战斗界面的行军读秒和进度条不动」）：行军段含
       pbar + 「余 X」读秒 —— 与「行军队列」（openMarches）同口径接入 live
       每秒重开：读秒/进度条逐秒跳动；战斗段的行数增减也随之即时可见。 */
    ui.openModal(ui.battleListHTML(), {
      size: 'md',
      live: function () { ui.openBattleList(); },
    });
  };

  ui.openBattlefield = function (id) {
    var rec = GAME.battle._recOf(id);
    /* v89.196（老板 4）：已结束的战斗 → 导流「回看全程」（沙盘）——
       v89.150 起战斗类公文默认直进沙盘（ui.viewReport），这里把话说全。 */
    if (!rec) { ui.toast('战斗已结束 —— 可在「公文」点开战报回看全程'); return; }
    ui.btTeardown();                             /* 单例：先拆旧的 */
    var ses = GAME._bsess && GAME._bsess[id];
    if (!ses) {
      try {
        GAME._bsess = GAME._bsess || {};
        GAME._bsess[id] = GAME.battle._makeEnv(rec);
        ses = GAME._bsess[id];
      } catch (e) { ui.toast('战斗会话不可用'); return; }
    }
    var snap = rec.snapLast || ses.snap();
    ui._bt = { id: id, lastRound: snap.round || rec.round || 0, playing: false, timer: null };
    ui._btRetreatArmed = false;                   /* v89.94：撤退两段确认，开界面即复位 */
    /* v89.139（老板 1）：副标题备注整条去掉（老板原话点名那行说明）——
       回合秒数由读秒行（bt-cd）表达、"转后台"由底栏按钮自身表达，不必再写一行副标题。 */
    ui.openShell({
      title: '⚔ 战场 · ' + U.escape((rec.target && rec.target.name) || '目标'),
      /* v89.150（老板 4）：「战场战斗界面铺满界面，目前主要是左右留空了，导致战场画面被压缩」
         —— 档位 xxl(1200×850) → **max**（画布 − 16px，实测 1424×884）：
         左右留白清零、中间战场随宽度长出来（列宽见 index.html 的 .bt-board）。 */
      size: 'max',
      body: '<div id="bt-wrap">' + ui.battlefieldHTML(rec) + '</div>',
      /* v89.120：三键已移到读秒行（.bt-acts，见 ui.btTopHTML）——
         底栏只留"后台运行"（它是关闭键，由 openModal 统一剥离） */
      foot: '<button class="btn" data-action="close-modal">后台运行</button>',
      /* v89.150（老板 6）：「关闭战场后，不返回目标界面（野地或某城市）而会到点开弹窗的
         大界面，在哪里点开就回到哪里（如地图，城内或城外）」——
         `closeAll` = 该层关闭键走 closeAllModals（一次关净 → 回视图层）；
         否则会弹回上一级面板（出征界面/野地面板那类"中间界面"）。 */
      closeAll: true,
    });
    /* v89.192（老板 2）：中途进入 → 把已发生的回合补渲染（#bt-log 先有历史，再续实时）。
       round=0（刚开打）时跳过 —— 没有历史可补。 */
    ui.btReplayHistory(rec);
    ui._bt.timer = setInterval(ui.btTick, 500);
  };

  /* ============================================================
   * v89.192（老板 2）：「点进去观战的时候，没有看到前边回合的记录」
   * ------------------------------------------------------------
   * 病根：战斗按 settings.battleSec **后台照打**（可推进 N 回合），玩家中途点
   * 「观战」进来时 `ui._bt.lastRound` 直接初始化成"当前回合"——
   * 前面已发生的回合**从未渲染**（#bt-log 只有斗将行）。
   * 修法：用会话重放（与读档恢复同一路径 `_makeEnv`，只多一个收集数组）把
   * 已发生的回合逐块补渲染进 #bt-log —— 复用**同一个回合块出口** `ui.btRoundLine`
   * （倒叙语义由它保证：从最旧补起、每块插顶部 → 最终顺序 [N,...,1]，
   *  最新在最上，与实时路径完全一致）。
   * 成本：一次重放（≤30 回合，毫秒级）——只在"打开观战"这一次动作里付。
   * ============================================================ */
  ui.btReplayHistory = function (rec) {
    if (!rec || !(rec.round > 0)) return 0;
    var steps = [];
    try { GAME.battle._makeEnv(rec, steps); } catch (e) { return 0; }
    var n = 0;
    steps.forEach(function (st) {
      ui.btRoundLine({ r: st.r, gap: st.gap, events: st.events }, st.snap, rec);
      n++;
    });
    return n;
  };

  /* 拆装（关闭界面 / 切换战斗）：恢复 rec.anim，防"动画卡住 → 后台停摆" */
  ui.btTeardown = function () {
    var bt = ui._bt;
    if (!bt) return;
    if (bt.timer) clearInterval(bt.timer);
    var rec = GAME.battle._recOf(bt.id);
    if (rec) rec.anim = false;
    ui._bt = null;
  };

  /* ---- 每 500ms：倒计时数字 + 检测"结算追上来"（后台/自动推进时补播） ---- */
  ui.btTick = function () {
    var bt = ui._bt;
    if (!bt) return;
    var rec = GAME.battle._recOf(bt.id);
    if (!rec) { ui.btShowEnd(bt); return; }
    var cd = document.getElementById('bt-cd');
    if (cd) cd.textContent = Math.max(0, Math.ceil(rec.cnt == null ? 0 : rec.cnt));
    if (!bt.playing && rec.round > bt.lastRound) {
      ui.btAfterStep(rec, { r: rec.round, gap: rec.gapLast, events: rec.evLast || [], snap: rec.snapLast });
    }
  };

  /* ---- 指令写入（chips / 下拉）→ 会话即时生效（本回合结算用得上） ---- */
  ui.btSetCmd = function (rec, troopId, patch) {
    /* v150（P0-2）：手点任何一条指令 = 本场**由你指挥**（否则托管下一回合就把它改回去）。 */
    if (rec && !rec.autoOff) {
      rec.autoOff = true;
      ui.toast('已接管本场战斗：你的指令优先（点顶部「已接管」可交回托管）');
    }
    rec.cmd = rec.cmd || {};
    var c = rec.cmd[troopId] = rec.cmd[troopId] || {};
    if (patch && patch.s) c.s = patch.s;
    if (patch && patch.t !== undefined) c.t = patch.t;
    var ses = GAME._bsess && GAME._bsess[rec.id];
    if (ses) ses.setCmd('atk', troopId, c);
    /* v89.149（老板 2）：「动作设置……**每回合可以重新设置**，如不动，则继承上回合设置」——
       重绘棋盘必须读**会话快照**（它含刚下达的待生效指令），不能读 `rec.snapLast`
       （那是**上一回合结束时**的快照 —— 实机实测：改成"后退"后棋盘立刻跳回"前进"，
        玩家以为"改了不生效"，而会话里其实已生效、下一回合按新指令打）。
       回读顺序反过来：`ses.snap() || rec.snapLast`。播放动画期间不重绘（位移动画正在跑）。 */
    var box = document.getElementById('bt-board');
    var snap = ses ? ses.snap() : (rec.snapLast || null);
    if (box && snap && !(ui._bt && ui._bt.playing)) box.outerHTML = ui.btBoardHTML(snap);
  };

  /* ---- 一回合结算后：更新顶栏 → 位移动画 → 逐条事件字幕 ---- */
  /* 三选一条 + 模式行的**唯一同步出口**（回合推进后、玩家点完之后都走它）——
     局部换 DOM，不整页重建：不打断位移动画，也不丢玩家正在填的输入。 */
  ui.btSyncAsk = function (rec) {
    if (!rec) return;
    try {
      var askEl = document.getElementById('bt-ask');
      var askNew = ui.btAskHTML(rec);
      if (askEl && !askNew) askEl.remove();
      else if (!askEl && askNew) {
        var _top = document.getElementById('bt-board');
        if (_top && _top.parentNode) _top.insertAdjacentHTML('beforebegin', askNew);
      } else if (askEl && askNew) askEl.outerHTML = askNew;
      var mdEl = document.getElementById('bt-mode');
      if (mdEl) mdEl.outerHTML = ui.btModeHTML(rec);
    } catch (e) { /* 同步失败不打断战斗 */ }
  };

  ui.btAfterStep = function (rec, r) {
    var bt = ui._bt;
    if (!bt || bt.id !== rec.id) return;
    bt.lastRound = r.r;
    var rd = document.getElementById('bt-round');
    if (rd) rd.textContent = r.r;
    var gp = document.getElementById('bt-gap');
    /* v89.149（老板 7）：实时刷新也走同一出口（最近距离 / 全局） */
    if (gp) gp.innerHTML = ui.gapReadOf(r.gap, (r.snap || rec.snapLast || {}).field);
    /* v89.175（老板 1）：智能指示随回合同步 —— 顶栏只在"进战场"时整绘一次，
       打回合不重建它，必须在这里显式刷新（否则"调整 N/维持"停在旧快照）。 */
    /* v150（P0-2）：三选一条 / 模式行随状态同步（唯一出口 ui.btSyncAsk） */
    ui.btSyncAsk(rec);
    var smEl = document.querySelector('#modal-root .bt-smart');
    if (smEl) {
      var smNew = ui.btSmartHTML(rec);
      if (smNew && smEl.outerHTML !== undefined) smEl.outerHTML = smNew;
    }
    /* v89.176：损失读数与接敌角标随回合同步（顶栏不整体重建 —— 与 bt-smart 同规） */
    var _snap176 = r.snap || rec.snapLast || null;
    var lsEl = document.getElementById('bt-loss');
    if (lsEl && _snap176) {
      var lsNew = ui.btLossHTML(rec, _snap176);
      if (lsNew) lsEl.outerHTML = lsNew;
      else if (lsEl.parentNode) lsEl.parentNode.removeChild(lsEl);
    }
    if (_snap176) ui.btMarkIncoming(_snap176);
    /* v89.116：位移动画后再次对齐间距读数（r.gap 与 frontsOf 同源，此处只做同值确认） */
    ui.btPlay(rec, r, bt);
  };

  /* ============================================================
   * v89.207（老板 1·快赢④）：**战斗增速档**（1× / 2× / 4×）
   * ------------------------------------------------------------
   * 只影响**观战动画节拍**（实时战场 btPlay 的事件间隔 + 战报沙盘 sdToggle 的帧间隔）——
   * **不影响战斗结果**（结算仍是同一份引擎数据）；也不影响"自动结算倒计时"
   * （battleSec 约束的是玩家思考时间，与动画无关）。
   * · 档位 = 会话级（ui._btSpd，重开页面回 1×）；节拍基数 = DATA.BATTLE_WATCH。
   * · 战场（#bt-acts）与沙盘（#sd-foot-dyn）共用同一组按钮出口（btSpdHTML）与同一状态。
   * ============================================================ */
  ui._btSpd = 1;
  ui.btSpdOf = function () {
    var S = (DATA.BATTLE_WATCH && DATA.BATTLE_WATCH.speeds) || [1, 2, 4];
    return S.indexOf(ui._btSpd) >= 0 ? ui._btSpd : 1;   /* 只认表内档位（防脏值） */
  };
  ui.btSpdSet = function (v) {
    var S = (DATA.BATTLE_WATCH && DATA.BATTLE_WATCH.speeds) || [1, 2, 4];
    var n = Number(v);
    if (S.indexOf(n) >= 0) ui._btSpd = n;
  };
  ui.btSpdHTML = function () {
    var S = (DATA.BATTLE_WATCH && DATA.BATTLE_WATCH.speeds) || [1, 2, 4];
    var cur = ui.btSpdOf();
    return '<span class="bt-spd">' + S.map(function (v) {
      return '<button class="btn sm mini' + (v === cur ? ' gold' : '') + '" data-action="bt-spd"'
        + ' data-v="' + v + '" title="观战动画速度 ' + v + '×（不影响战斗结果）">' + v + '×</button>';
    }).join('') + '</span>';
  };
  /* 节拍唯一出口：基准毫秒 ÷ 当前档（下限 40ms —— 4× 下事件 65ms 仍可辨、不闪帧） */
  ui.btWatchDelay = function (ms) {
    return Math.max(40, Math.round((ms || 0) / ui.btSpdOf()));
  };
  ui.btSpdRepaint = function () {
    var cur = ui.btSpdOf();
    var els = [];
    try { els = document.querySelectorAll('[data-action="bt-spd"]'); } catch (e) { els = []; }
    for (var i = 0; i < els.length; i++) {
      var on = Number(els[i].dataset ? els[i].dataset.v : els[i].getAttribute('data-v')) === cur;
      if (els[i].classList) els[i].classList.toggle('gold', on);
    }
  };
  ui.btPlay = function (rec, r, bt) {
    bt.playing = true;
    rec.anim = true;                             /* 动画期间倒计时暂停 */
    var snap = r.snap || ((GAME._bsess[rec.id]) ? GAME._bsess[rec.id].snap() : null);
    if (snap) ui.btPlace(snap);                  /* ① 位置过渡（CSS transition） */
    var evs = (r.events || []).slice();
    /* v89.116（老板需求 8）：「战况回合播报放在下部分，行动和战果写在同一行，避免太多行」
       —— 一个回合**只写一行**（先把该回合的逐条事件压成一句话），
       逐条事件仍逐条播（只做受击闪烁），不再一行一条地刷屏。 */
    ui.btRoundLine(r, snap);
    var i = 0;
    function fin() {
      if (ui._bt && ui._bt.id === rec.id) ui._bt.playing = false;
      if (snap) ui.btSyncCounts(snap);
      rec.anim = false;
    }
    function next() {
      if (!ui._bt || ui._bt.id !== rec.id || i >= evs.length) { fin(); return; }
      ui.btEvent(evs[i++], true);                /* true = 静默（不写日志，只闪烁） */
      /* v89.207（快赢④）：节拍走唯一出口（基准在 DATA.BATTLE_WATCH；旧值 260/620 即表值） */
      setTimeout(next, ui.btWatchDelay((DATA.BATTLE_WATCH || {}).eventMs || 260));
    }
    setTimeout(next, ui.btWatchDelay((DATA.BATTLE_WATCH || {}).firstMs || 620));
  };

  /* ============================================================
   * v89.117（老板需求 7）：「每回合一行太紧凑，可以每兵种各一行，兵种的移动、
   *   战斗动作放在同一行，根据出手时间先后，行数错开；不同回合之间虚线间隔」
   * v89.119（老板）：「反击应该在敌方出手后，而不是己方移动后直接反击…
   *   我方移动，出手，对方反击（如有）；对方移动，出手，我方相应反击（如有）。
   *   反击和对方出手记录在同一行」
   * ------------------------------------------------------------
   * 唯一出口：本函数返回**结构化行**（side / name / txt / indent / cls），
   * 界面按它落 DOM，断言直接读返回值（不必赌 DOM）。
   *   · 分组键 = `side|兵种id`（引擎事件里带 id，见 tactic.js 的 events.push）；
   *   · **反击不再自建行** —— 并入"引发它的那次出手"（同一行、紧跟其后）：
   *     `进 30 · → 伏击车 歼 784（伏击车反击 歼 374）`；
   *   · **出手顺序** = 该兵种在本回合事件流里**首次出现**的下标（这就是引擎的结算顺序）；
   *   · 错开 = 按该下标递进缩进（每级 14px，最多 5 级 —— 再多就贴到右边缘了）。
   * ============================================================ */
  ui.btRoundLines = function (r, snap) {
    var evs = (r && r.events) || [];
    var foeName = {};
    ((snap && snap.atk) || []).forEach(function (u) { foeName[u.id] = u.name; });
    ((snap && snap.def) || []).forEach(function (u) { foeName[u.id] = u.name; });
    var order = [], by = {}, hostOf = {};
    function rowOf(side, id, name) {
      var key = side + '|' + (id == null ? (name || '_') : id);
      if (!by[key]) {
        by[key] = { side: side, id: id, name: name, moves: [], acts: [] };
        order.push(key);
      }
      return { key: key, g: by[key] };
    }
    evs.forEach(function (e) {
      if (!e || e.side == null) return;
      if (e.kind === 'counter') {
        /* 宿主键 = **对面阵营 + 出手者 id**（同名兵种互射也不串台） */
        var hKey = (e.side === 'atk' ? 'def' : 'atk') + '|' +
          (e.targetId == null ? (e.target || '_') : e.targetId);
        var host = hostOf[hKey];
        /* v89.136：带阵营 —— 文案按**反击者阵营**给词（我方行里的反击 = 敌方反击，反之亦然） */
        if (host) host.counters.push({ name: e.name, kill: e.kill, side: e.side });
        else {
          /* 兜底：找不到引发它的那次出手（异常数据）→ 独立成格，不静默丢事件 */
          var fr = rowOf(e.side, e.id, e.name);
          fr.g.acts.push({ txt: '反击 → ' + (e.target || foeName[e.targetId] || '敌') + ' 歼 ' + U.numText(e.kill, 0) });
        }
        return;
      }
      var row = rowOf(e.side, e.id, e.name), g = row.g;
      if (e.kind === 'move') g.moves.push('进 ' + U.numText(e.step, 0));
      else if (e.kind === 'retreat') g.moves.push('退 ' + U.numText(e.step, 0));
      else if (e.kind === 'attack') {
        var act = { target: (e.target || foeName[e.targetId] || '敌'), kill: e.kill, counters: [] };
        g.acts.push(act);
        hostOf[row.key] = act;
      } else if (e.kind === 'tower') {
        g.acts.push({ txt: '拆箭塔 ' + U.numText(e.destroy, 0) + '（余 ' + U.numText(e.left, 0) + '）' });
      } else if (e.kind === 'wall') {
        g.name = '城头箭塔';
        g.moves.push('→ ' + (e.target || '我军') + ' 歼 ' + U.numText(e.kill, 0));
      } else if (e.kind === 'duel') {
        g.acts.push({ txt: '斗将：' + (e.txt || (e.win ? '胜' : '负')) });
      }
    });
    return order.map(function (key, i) {
      var g = by[key];
      var bits = g.moves.slice();
      g.acts.forEach(function (a) {
        if (a.txt != null) { bits.push(a.txt); return; }
        var s = '→ ' + a.target + ' 歼 ' + U.numText(a.kill, 0);
        if (a.counters && a.counters.length) {
          /* v89.136（老板 3）：①「'对方'应该是'我方'才对」——按反击者阵营给词；
             ②「这句应以白色字体显示，因为是我方动作」——我方片段包 U+0001/U+0002
             受控标记（渲染层 btLogItem 转 span.bt-me，白色）。 */
          s += '（' + a.counters.map(function (c) {
            var _txt = (c.side === 'atk' ? '我方' : '敌方') + c.name + '反击 歼 ' + U.numText(c.kill, 0);
            return c.side === 'atk' ? ('\u0001' + _txt + '\u0002') : _txt;
          }).join('，') + '）';
        }
        bits.push(s);
      });
      return {
        side: g.side,
        cls: g.side === 'atk' ? 'atk' : 'def',
        name: g.name || '—',
        txt: '[' + (g.side === 'atk' ? '我' : '敌') + '] ' + (g.name || '—') + '　' +
          (bits.length ? bits.join(' · ') : '待命'),
        indent: Math.min(5, i) * 14,
      };
    });
  };

  /* 兼容出口：旧调用点（ui.btPlay）读的是这一个 —— 返回结构化行文本数组。
     v89.120（老板「回合记录倒叙记录，最新战况显示在最上方」）：
     整回合**整块插到最前** —— 块内部保持"回合头 → 逐兵种行"的正序，
     块与块之间 = 最新在上（每条块自带一条虚线，即块间分隔线）。 */
  ui.btRoundLine = function (r, snap, recIn) {
    var lines = ui.btRoundLines(r, snap);
    var log = document.getElementById('bt-log');
    if (!log || !log.insertBefore) return lines.map(function (L) { return L.txt; });
    var frag = document.createDocumentFragment();
    frag.appendChild(ui.btLogItem('', 'sep'));
    frag.appendChild(ui.btLogItem('第 ' + ((r && r.r) || 0) + ' 回合　·　最近距离 '
      + U.numText((r && r.gap) || 0, 0), 'hdr'));
    /* v89.175（老板 1）：「每回合我要看见调整（可以不动，但需要显示智能调兵完成，
       开始回合战斗）」—— 智能行的**判据 = 该回合有 smartLog 记录**（有记录=智能开过）
       recIn 可选参：正常从 ui._bt 取；测试/回放可显式传入。 */
    (function () {
      var rec175 = recIn || ((ui._bt && GAME.battle && GAME.battle._recOf) ? GAME.battle._recOf(ui._bt.id) : null);
      if (!rec175 || rec175.side !== 'atk' || !(rec175.smartLog || []).length) return;
      var sn175 = null;
      (rec175.smartLog || []).forEach(function (x) { if (x.r === ((r && r.r) || 0)) sn175 = x; });
      if (!sn175) return;
      var rc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.ruleCN || {})[sn175.rule] || sn175.rule || '静态表';
      /* v89.176（老板「总体策略」）：阵型模式并入策略名（"错落有致 · 静态表"） */
      var mc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.modeCN || {})[sn175.mode] || '';
      var strat175 = mc175 ? (mc175 + ' · ' + rc175) : rc175;
      /* v89.176：保兵撤退行（损失达线 · 本波收兵）——与"智能调兵完成"并列的可见事件 */
      if (sn175.retreat) {
        frag.appendChild(ui.btLogItem('🏳️ 智能撤退：' + ((sn175.notes || []).join('；')
          || '损失达线') + ' —— 残部带回 · 本波收兵（破防按半计）', 'smart'));
        return;
      }
      var det175 = (sn175.notes || []).slice(0, 4).join('；');
      if ((sn175.notes || []).length > 4) det175 += ' 等 ' + sn175.notes.length + ' 项';
      frag.appendChild(ui.btLogItem('🤖 智能调兵完成（' + (sn175.n
        ? ('调整 ' + sn175.n + ' 项：' + det175) : '维持阵型')
        + '）· 采用「' + strat175 + '」· 开始回合战斗', 'smart'));
    })();
    lines.forEach(function (L) { frag.appendChild(ui.btLogItem(L.txt, L.cls, L.indent)); });
    if (!lines.length) frag.appendChild(ui.btLogItem('[我] 待命　　[敌] 待命', 'atk', 0));
    log.insertBefore(frag, log.firstChild);                   /* 新回合置顶（倒叙） */
    ui.btLogTrim(log);
    if (typeof log.scrollTop === 'number') log.scrollTop = 0;  /* 视口钉在最新（顶部） */
    return lines.map(function (L) { return L.txt; });          /* 数组：调用方/断言可直接读 */
  };
  /* 播报窗行元素**唯一工厂**（格式只在这里定义一处 —— 回合块与逐条流共用） */
  ui.btLogItem = function (line, cls, indent) {
    var d = document.createElement('div');
    d.className = 'bt-ev ' + (cls || 'round');
    /* v89.117：**按出手顺序错开** —— indent（px）由 ui.btRoundLines 给 */
    if (indent) d.style.paddingLeft = indent + 'px';
    /* v89.136（老板 3）：我方动作片段白色 —— U+0001 / U+0002 受控标记 → span.bt-me。
       先整串 escape 再替换标记：标记之外的任何字符都不会变成 HTML（无注入面）。 */
    if (line != null && line.indexOf('\u0001') >= 0) {
      d.innerHTML = U.escape(line)
        .replace(/\u0001/g, '<span class="bt-me">')
        .replace(/\u0002/g, '</span>');
    } else {
      d.textContent = line;
    }
    return d;
  };
  /* 播报窗行数上限：一场 6 兵种 ≈ 8 行/回合，64 行 ≈ 看得见 7~8 个回合；
     与 .bt-log 的 336px 视高（16 行 · v89.137 老板 3）配套。
     倒叙后**最旧的在最下**，裁剪从末尾删。 */
  ui.BT_LOG_MAX = 64;
  ui.btLogTrim = function (log) {
    var kids = log && log.children;
    /* ⚠️ 测试桩的 DOM 可能给一个"没有 children"的壳元素 —— 判能力再动手 */
    if (!kids || typeof kids.length !== 'number') return;
    while (kids.length > ui.BT_LOG_MAX && log.lastChild) log.removeChild(log.lastChild);
  };
  /* 往播报窗推一行（逐条流；**最新在上**，与回合块同口径） */
  ui.btLogPush = function (line, cls, indent) {
    var log = document.getElementById('bt-log');
    if (!log || (!line && cls !== 'sep') || !log.insertBefore) return;
    log.insertBefore(ui.btLogItem(line, cls, indent), log.firstChild);
    ui.btLogTrim(log);
    if (typeof log.scrollTop === 'number') log.scrollTop = 0;
  };

  ui.btPlace = function (snap) {
    var D = snap.field || 1;
    [['atk', snap.atk], ['def', snap.def]].forEach(function (pair) {
      (pair[1] || []).forEach(function (u) {
        var el = document.querySelector('#bt-field [data-bside="' + pair[0] + '"][data-troop="' + u.id + '"]');
        if (el) el.style.left = ui.btPosPct(pair[0], u.adv, D) + '%';
      });
    });
    if (snap.towers) {
      var tw = document.getElementById('bt-tower');
      if (tw) tw.textContent = snap.towers.left;
    }
  };

  ui.btSyncCounts = function (snap) {
    /* v89.116：数量在**两侧列表**（图标下），战场只画图标 —— id 不变，逻辑照旧 */
    [['atk', snap.atk], ['def', snap.def]].forEach(function (pair) {
      (pair[1] || []).forEach(function (u) {
        var el = document.getElementById('bt-n-' + pair[0] + '-' + u.id);
        if (el) el.textContent = U.fmt(u.count);
        var row = document.querySelector('#bt-board [data-row="' + pair[0] + '-' + u.id + '"]');
        if (row && row.classList) row.classList.toggle('dead', !(u.count > 0));
        /* v89.117：**战场上那枚令牌**同样变暗（此前只暗列表行，场上还是亮的） */
        var fu = document.querySelector('#bt-field [data-bside="' + pair[0] + '"][data-troop="' + u.id + '"]');
        if (fu && fu.classList) fu.classList.toggle('dead', !(u.count > 0));
      });
    });
  };

  /* 单条事件：目标闪烁（`quiet` = 只闪不写日志 —— 日志已由 ui.btRoundLine 压成一行） */
  ui.btEvent = function (e, quiet) {
    var line = '';
    if (e.kind === 'move') line = '🚶 ' + ui.btSideName(e.side) + ' ' + e.name + ' 前进 ' + U.numText(e.step, 0) + '（最近距离 ' + U.numText(e.gap, 0) + '）';
    else if (e.kind === 'retreat') line = '↩️ ' + ui.btSideName(e.side) + ' ' + e.name + ' 后退 ' + U.numText(e.step, 0);
    else if (e.kind === 'attack') line = '⚔️ ' + ui.btSideName(e.side) + ' ' + e.name + ' → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0);
    else if (e.kind === 'counter') line = '🛡️ ' + ui.btSideName(e.side) + ' ' + e.name + ' 反击 → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0);
    else if (e.kind === 'tower') line = '🏯 ' + e.name + ' 攻箭塔，摧毁 ' + e.destroy + ' 座（余 ' + e.left + ' / ' + e.total + '）';
    else if (e.kind === 'wall') line = '🏯 城头火力 → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0);
    if (!line) return;
    if (e.targetId) {
      var tEl = document.querySelector('#bt-field [data-bside="' + (e.side === 'atk' ? 'def' : 'atk') +
        '"][data-troop="' + e.targetId + '"]');
      if (tEl && tEl.classList) {
        tEl.classList.add('hit');
        setTimeout(function () { tEl.classList.remove('hit'); }, 360);
      }
    }
    if (quiet) return;
    ui.btLogPush(line, e.kind);
  };

  /* ---- 结束：播报窗收束（v89.136 起不再开"战果"面板） ----
     老板令：「（最后一回合）无需弹窗，直接在下方回合记录里记录回合结束」。
     三个动作：
       ① **补最后一回合** —— 它此前必被吞掉：`onBattleDone` 在 `stepBattle` 内部同步触发
          （finishBattle → _settleBattle），先把 `ui._bt` 置空，main.js 随后的
          `btAfterStep(rec, r)` 检查 `ui._bt` 直接 return（老板实测"最后一回合没有完整显示"的病根）；
       ② 战果写成播报窗的最后一行（含损失/回合数/战报去向）；
       ③ 三键收成提示（防"点了没反应"）。 */
  ui.btShowEnd = function (bt) {
    if (bt && bt.timer) clearInterval(bt.timer);
    var res = GAME._battleJustDone;
    if (ui._bt && (!bt || ui._bt.id === bt.id)) ui._bt = null;
    var same = res && bt && res.id === bt.id;
    if (same && res.lastStep && res.lastStep.snap) {
      ui.btRoundLine(res.lastStep, res.lastStep.snap);   /* ① 补最后一回合 */
    }
    var txt;
    if (same) {
      txt = '🏁 战斗结束：' + (!res.ok ? '战斗中止（大军折返）'
        : (res.winner === 'atk' ? '我军得胜' : '我军失利'))
        + '　·　共 ' + (res.rounds || 0) + ' 回合　·　我军损失 ' + U.numText(res.atkLoss || 0, 0)
        + '　·　敌军损失 ' + U.numText(res.defLoss || 0, 0) + '　·　战报已入公文';
    } else {
      txt = '🏁 战斗已结束（战报见「公文」）';
    }
    ui.btLogPush(txt, 'end');                            /* ② 结束行 */
    var acts = document.getElementById('bt-acts');
    if (acts) {
      /* v89.196（老板 4）：「我想要看到全部战斗过程……战斗已结束……自动战斗直接结算」——
         结束瞬间直接给「🎬 回看全程」（走 _battleJustDone.report 的沙盘配方）；
         数据过期（页面重载等）时退回"战报见公文"的导流文案。 */
      var canReplay196 = !!(same && res && res.ok && res.report);
      acts.innerHTML = (canReplay196
          ? '<button class="btn sm gold" data-action="bt-replay">🎬 回看全程</button> '
          : '')
        + '<span class="bt-hint">战斗已结束 —— '
        + (canReplay196 ? '可回看全程；' : '')
        + '战报见「公文」；右上角 ✕ 关闭</span>';
    }
    var cd = document.getElementById('bt-cd');
    if (cd) cd.textContent = '0';
  };

  /* finishBattle 的统一回调（battle.js 调用）：界面开着 → 战果面板；否则 toast */
  ui.onBattleDone = function (res) {
    var bt = ui._bt;
    if (bt && bt.id === res.id) { ui.btShowEnd(bt); return; }
    if (!res.ok) { ui.toast('⚠️ 战斗中止，大军折返'); return; }
    ui.toast('⚔️ 战斗结束：' + (res.winner === 'atk' ? '我军得胜' : '我军失利') +
      '（我方损失 ' + U.numText(res.atkLoss || 0, 0) + '，战报见公文）');
  };

  /* ---- 军务总览：征战中段（供 marchesHTML 调用） ---- */
  ui.btPendingBlock = function () {
    var s = GAME.state;
    var n = GAME.battle.pendingCount();          /* 计数走唯一出口 */
    if (!n) return null;
    var list = (s.battles || []).filter(function (b) { return b.state === 'live'; });
    var rows = list.map(function (b) {
      return '<tr><td>⚔ ' + U.escape((b.target && b.target.name) || '目标') + '</td>' +
        '<td class="ctr">第 ' + (b.round || 0) + ' 回合</td>' +
        '<td class="ctr"><button class="btn sm gold" data-action="bt-open" data-id="' + b.id + '">进入战场</button></td></tr>';
    }).join('');
    return { n: n,
      html: '<table class="tbl"><thead><tr><th>目标</th><th class="ctr">进度</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table>' };
  };

  /* ============================================================
   * v89.104（老板）：「在军务这里，增加几个军务总览并列的界面。包括出征（链接出征界面），
   * 防守，军务处（伤病，逃兵，降兵管理）」
   * ------------------------------------------------------------
   * 口径：军务页顶部一条**页签**（军务总览 / 出征 / 防守 / 军务处）——
   *   · 总览 = 原来的内容（在城兵力 / 驻守野地 / 行军队列），一字未动；
   *   · 出征 = 附近可打目标（据点/同聚落名城/己方城市）一键进**出征界面** + 在途队列；
   *   · 防守 = 逐城防御体检（驻军 / 围墙 / 箭塔 / 守将 / 防御力 + 风险提示）；
   *   · 军务处 = 两营左右分列（伤兵营 + 俘虏营，逐兵种清单；
   *     治疗 / 收编 / 释放都在这里）—— v89.132 起「兵源与征募」「军心」两卡退役。
   * ⚠️ 四个页签只换正文，动作全部复用既有出口（openExpModal / heal-wounded / …）。
   * ============================================================ */
  /* v89.133（v89.128 第二批第 9 条）：菜单改名 + 新增「出征」——
     exp = 出征战术（原「出征」改）、def = 防守战术（原「防守」改）、act = 出征（新）。 */
  /* v89.144（老板 3）：「编制 · 出战能力」改名**军队练兵场扩容**、整块搬出出征页，
     作为独立页签放在**军务总览右边**。 */
  ui.MARCH_TABS = [['over', '军务总览'], ['expand', '军队练兵场扩容'], ['act', '出征'], ['exp', '出征战术'], ['def', '防守战术'], ['beacon', '警报'], ['affairs', '军务处'], ['memorial', '阵亡名录']];
  /* v89.116（老板「警报相关流水已经存在于军务的警报中」）：警报流水窗口 ——
     公文不再给警报页签，这条流水就是它的**唯一落点**，窗口从 12 提到 24 条。 */
  ui.BEACON_FLOW = 24;
  ui.marchTabHTML = function () {
    var cur = ui._marchTab || 'over';
    /* v89.117（老板「还是没有俘虏营…要让玩家看得到」）：
       「军务处」页签挂**两营合计角标**（伤兵 + 俘虏）—— 有货才显示。
       玩家点进军务第一眼就知道"营里有东西"，不必先切页签才知道。 */
    var badge = (ui.campBadgeN ? ui.campBadgeN() : 0);
    return '<div class="march-tabs">' + ui.MARCH_TABS.map(function (t) {
      return '<span class="mt' + (cur === t[0] ? ' on' : '') + '" data-action="march-tab" data-v="' + t[0] + '">' +
        t[1] + (t[0] === 'affairs' && badge > 0
          ? '<i class="mt-n" title="伤兵 / 俘虏待处理">' + U.fmt(badge) + '</i>' : '') + '</span>';
    }).join('') + '</div>';
  };
  /* ============================================================
   * v89.133（v89.128 第二批第 9/11 条 · 老板）：「增加一个新的'出征'菜单 ——
   *   这个菜单就是点击野地进行出征行动（掠夺，占领等）后弹出的军队行动界面，
   *   直接引用这个界面作为功能即可」＋「出征界面作为一切军事行动的入口，包括对外出征
   *   或对内的城市/野地间操作。出征目标目前提供的是哪些目标，一定距离内吗」。
   * ------------------------------------------------------------
   * 口径：**出征页 = 一切军事行动的入口** —— 先选目标（下拉），再进军队行动界面
   *   （`ui.openExpModal` **原样引用** —— 不另造第二套编队界面）。
   * 目标范围（回答老板「一定距离内吗」）：
   *   · 我方野地 / 我方城市 —— **全境**（不限距离）；
   *   · 同聚落普通城市 —— 同聚落（不限距离）；
   *   · 野外据点 —— 当前城 **14 格内**（半径在 `expTargetCandidates` 唯一出口里）;
   *   · 其余任意目标（名城 / 远据点 / 中立野地）—— **地图点选**（本页给指路，不另列）。
   * ============================================================ */
  /* ============================================================
   * v89.142（老板 2）：「目标分成 5 类，分行显示：我方城市 / 我方野地 / 名城 /
   *   野地 / 野外据点。进入军事行动这个按钮放在界面底部」
   * ------------------------------------------------------------
   * **分组候选的唯一出口**（渲染 / 提交 / 探针 / 断言全读它，不许各列一份）：
   *   · 我方城市 / 我方野地 —— **全境**（不限距离）；
   *   · 名城（NPC 聚落·重镇·首府·旧都）—— 按距离排序取**最近 N_LIST**处（全图百余座，全列没意义）；
   *   · 野地（中立）—— 本城周边（半径 SCAN）内按距离取**最近 N_LIST**处；
   *   · 野外据点 —— 本城 **14 格内**（与 expTargetCandidates 同一把尺），取最近 N_LIST。
   * 每组带 `total`（截断前的总数）—— 界面用「共 N 处 · 列出最近 24」如实交代，
   * 不给"列了 24 个就以为全图只有 24 个"的假象。
   * 旧的 `ui.actTargetsOf`（v89.133 的"一锅烩扁平列表"）随本需求整条退役。
   * ============================================================ */
  ui.ACT_LIST_N = 24;
  ui.actTargetGroups = function (c) {
    var s = GAME.state;
    c = c || GAME.currentCity();
    if (!c) return [];
    var N = ui.ACT_LIST_N;
    var dist = function (x, y) { return GAME.cityDist({ x: x, y: y }, c); };
    var groups = [
      { key: 'owncity', label: '🏯 我方城市', targets: [] },
      { key: 'ownwild', label: '🌾 我方野地', targets: [] },
      { key: 'npc', label: '🏛️ 名城', targets: [] },
      { key: 'wild', label: '🗺️ 野地', targets: [] },
      { key: 'fort', label: '🏕️ 野外据点', targets: [] },
    ];
    var by = {};
    groups.forEach(function (g) { by[g.key] = g; });
    /* ① 我方城市（全境）—— 派遣 / 运输都从这里发起 */
    (s.cities || []).forEach(function (mc) {
      if (mc.id === c.id) return;
      by.owncity.targets.push({ d: dist(mc.x, mc.y),
        label: '🏯 ' + mc.name + '（己方 · 城市间操作）',
        tg: { kind: 'own', id: mc.id } });
    });
    /* ② 我方野地（全境）—— 驻军 / 采集 / 撤回 */
    (s.wilds || []).forEach(function (w) {
      var t = DATA.TERRAIN[w.type] || { name: w.type };
      var gn = GAME.wildGarrisonTotal(w.garrison);
      by.ownwild.targets.push({ d: dist(w.x, w.y),
        label: '🌾 ' + t.name + ' Lv' + w.level + '（' + GAME.map.coordText(w.x, w.y) + '）'
          + (gn > 0 ? '　· 驻军 ' + U.numText(gn, 0) : '　· 无驻军'),
        tg: { kind: 'wild', ci: w.ci, pid: GAME.pidOf(w) } });
    });
    /* ③ 名城（NPC 城市 —— 聚落/重镇/首府/旧都，按距离取最近 N 处） */
    (s.map.cities || []).forEach(function (nc) {
      by.npc.targets.push({ d: dist(nc.x, nc.y),
        label: ui.expTargetLabel({ kind: 'city', id: nc.id, npc: nc }),
        tg: { kind: 'city', id: nc.id, npc: nc } });
    });
    /* ④ 野地（中立）—— 本城周边扫一圈（半径 20），按距离取最近 N 处。
       排除：我方野地格 / NPC 城市格 / 据点格（那些格子另有归组）。 */
    /* v91.75：这里必须走 **ci**（wildAt/npcAt/fortAt/wildLevelNow 都按六边格索引）——
       改前把平面 (x,y) 当 ci 传，结果"野地"候选全是伪目标、"我方野地/据点"永远筛不干净。 */
    var SCAN = 20, _pid = GAME.curPid();
    var _ciAt = function (x, y) { return (GAME.sphere && GAME.sphere.ciOfXY) ? GAME.sphere.ciOfXY(x, y) : -1; };
    for (var dy = -SCAN; dy <= SCAN; dy++) {
      for (var dx = -SCAN; dx <= SCAN; dx++) {
        var x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
        var _wci = _ciAt(x, y);
        if (_wci < 0) continue;
        if (GAME.map.wildAt(_wci, _pid)) continue;                  /* 我方野地 → ② */
        if (GAME.map.npcAt && GAME.map.npcAt(_wci)) continue;       /* 名城格 → ③ */
        if (GAME.map.fortAt && GAME.map.fortAt(_wci)) continue;     /* 据点格 → ⑤ */
        var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(_wci) : 0;
        if (!(lv > 0)) continue;
        by.wild.targets.push({ d: Math.max(Math.abs(dx), Math.abs(dy)),
          label: '🗺️ 野地 Lv' + lv + '（' + GAME.map.coordText(x, y) + '）',
          tg: { kind: 'wild', ci: _wci, pid: _pid } });
      }
    }
    /* ⑤ 野外据点（本城 14 格内 —— 与 expTargetCandidates 同一半径） */
    var R = 14;
    for (var fy = -R; fy <= R; fy++) {
      for (var fx = -R; fx <= R; fx++) {
        var fxx = c.x + fx, fyy = c.y + fy;
        if (fxx < 0 || fyy < 0 || fxx >= DATA.MAP_W || fyy >= DATA.MAP_H) continue;
        var _fci = _ciAt(fxx, fyy);
        if (_fci < 0) continue;
        var f = GAME.map.fortAt ? GAME.map.fortAt(_fci) : null;
        if (!f) continue;
        by.fort.targets.push({ d: Math.max(Math.abs(fx), Math.abs(fy)),
          label: '🏕️ ' + GAME.fortLabelOf(f) + '（Lv' + (f.level || 1) + '）',
          tg: { kind: 'fort', ci: _fci, pid: _pid } });
      }
    }
    groups.forEach(function (g) {
      g.targets.sort(function (a, b) { return a.d - b.d; });
      g.total = g.targets.length;
      if (g.targets.length > N) g.targets = g.targets.slice(0, N);
    });
    return groups;
  };
  /* 当前选中的目标（**唯一出口**）：`ui._actPick = {grp, idx}` 由下拉 change 落库，
     按钮与断言都读这里 —— 不许渲染时"看着像选中"而提交时另算一个（v89.30 的教训）。 */
  ui._actPick = null;
  ui.actPickOf = function () {
    /* v89.144（老板 4）：「默认显示为空」—— **删掉"兜底选第一个有货组第一项"**：
       只有玩家真的在下拉里选过（_actPick 落库）才返回目标；目标失效则自动清空。 */
    if (!ui._actPick) return null;
    var groups = ui.actTargetGroups(GAME.currentCity());
    var g2 = null;
    groups.forEach(function (x) { if (x.key === ui._actPick.grp) g2 = x; });
    if (!g2 || !g2.targets[ui._actPick.idx]) { ui._actPick = null; return null; }
    return { tg: g2.targets[ui._actPick.idx].tg, label: g2.targets[ui._actPick.idx].label, grp: g2.key };
  };
  ui.marchActHTML = function () {
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城市。</div>';
    var groups = ui.actTargetGroups(c);
    var pick = ui.actPickOf();
    /* v89.144（老板 3）：本城出征容量与练兵场扩编的数据**整块随卡片搬去独立页签**
       （ui.marchExpandHTML）—— 本页只剩"选目标 → 进入军事行动"。 */
    /* v89.142（老板 2）：目标**分 5 类、各占一行**（我方城市 / 我方野地 / 名城 /
       野地 / 野外据点）—— 每类一个下拉，选中项落库 ui._actPick；
       「进入军事行动」按钮移到**界面底部**（页面最末）。 */
    /* v89.144（老板 4）：
       · **固定下拉框位置与长度** —— 5 行用同一结构（.act-row：label 定宽 + 下拉定宽 20 个中文），
         起点一律对齐「我方城市」那行；
       · **默认显示为空** —— 每行首项 = 空 option（不预选）；actPickOf 也不再兜底选第一个；
       · 去掉「共 N · 列最近 24」备注（目标只在（对应行的）下拉框里出现）；
       · 选定后立刻 live 刷新（main.js 的 exp-act-pick → GAME.refreshView）——
         在**另一行**再选一个目标时，原来那一行自动回到空（_actPick 只有一份）。 */
    var rows = groups.map(function (g) {
      var sel = (ui._actPick && ui._actPick.grp === g.key) ? ui._actPick.idx : -1;
      var ctrl = g.targets.length
        ? '<select class="city-select act-sel" data-action="exp-act-pick" data-grp="' + g.key + '">' +
            '<option value=""' + (sel < 0 ? ' selected' : '') + '></option>' +
            g.targets.map(function (o, i) {
              return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' +
                U.escape(o.label) + '</option>';
            }).join('') + '</select>'
        : '<span class="ui-sub act-none">（无）</span>';
      return '<div class="exp-sel act-row"><label>' + g.label + '</label>' + ctrl + '</div>';
    }).join('');
    return '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' +
      '一切军事行动的入口：选目标 → 进军队行动界面（编队 / 战术 / 计略都在里面）</div>' +
      '<div class="story-card"><div class="gold-heading">⚔️ 出征 · 目标' +
        ui.help('目标按**五类分行**列出：\n· 我方城市 / 我方野地 —— 全境（不限距离）；\n'
          + '· 名城（聚落·重镇·首府·旧都）/ 野地（中立）—— 按距离列出最近 ' + ui.ACT_LIST_N + ' 处；\n'
          + '· 野外据点 —— 本城 14 格内。\n'
          + '选定后进入**军队行动界面**（与地图点野地弹出的是同一个界面）。') + '</div>' +
      rows +
      '<div class="ui-sub" style="margin-top:4px;">目标范围：我方城市 / 我方野地 —— <b>全境</b>；'
        + '名城 / 野地 —— 按距离取最近 ' + ui.ACT_LIST_N + ' 处；野外据点 —— 本城 <b>14 格内</b>；'
        + '其余远处目标仍可<b>在地图上点选</b>。</div></div>' +
      /* v89.144（老板 3）：原「编制 · 出战能力」卡片已搬去独立页签「军队练兵场扩容」
         （ui.marchExpandHTML，军务总览右边）。 */
      /* v89.142（老板 2）：**「进入军事行动」按钮放界面底部** —— 页面最末的独立操作条；
         上方一行写明"当前选中的是哪个目标"（5 个下拉，必须说清按钮会去哪一个）。 */
      '<div class="ui-sub" style="text-align:center;margin:10px 0 2px;">当前目标：<b>' +
        (pick ? U.escape(pick.label) : '（尚未选择）') + '</b></div>' +
      '<div class="exp-foot" style="justify-content:center;">' +
        /* v89.144（老板 4）：按钮可用性只看**是否真的选了目标**（默认空 → 置灰；
           选定后 live 刷新即亮起）。 */
        '<button class="btn gold" data-action="exp-act-go"' + (pick ? '' : ' disabled') +
          (pick ? '' : ' data-why="尚未选择出征目标 —— 先在地图上点选，或从上方列表选择一个目标"') +
          ' style="min-width:240px;font-size:var(--fs-h1);">⚔️ 进入军事行动 →</button></div>';
  };
  /* ============================================================
   * v89.144（老板 3）：「军务，出征这里，编制·出战能力改成**军队练兵场扩容**，
   *   整体挪到作为一个单独菜单放在**军务总览右边**」
   * ------------------------------------------------------------
   * 独立页签（march-tab 动作复用）· 内容 = 本城出征容量 + 节钺 · 练兵场扩编入口。
   * 数据全读既有唯一出口（marchCapOf / buildingLevel / jieyueExpandOf / jieyueOf），
   * 界面不自己算任何口径。
   * ============================================================ */
  ui.marchExpandHTML = function () {
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城市。</div>';
    var cap = GAME.battle.marchCapOf(c);
    var xcLv = GAME.buildingLevel(c, 'xiaochang') || 0;
    var jx = GAME.jieyueExpandOf(c, 'xc');
    var _jxTxt = (jx.used >= jx.max)
      ? '本城已满 ' + jx.used + '/' + jx.max
      : '本城 ' + jx.used + '/' + jx.max + '　持符 ' + GAME.jieyueOf();
    return '<div class="story-card"><div class="gold-heading">🪓 军队练兵场扩容' +
        ui.help('出征容量 = 练兵场等级 × 1 万 × 加成；节钺 · 练兵场扩编每次 +1 万人马'
          + '（等效练兵场 +1 级，每城至多 ' + ((DATA.JIEYUE || {}).xcMax || 2) + ' 次）。\n'
          + '节钺来源：首占名城 / 威望赏赐（旧币买不到）。') + '</div>' +
      '<div class="res-line"><span class="lbl">本城出征容量</span><span class="val">' +
        U.numText(cap, 0) + ' 人马' + (xcLv > 0 ? '（练兵场 Lv' + xcLv + ' + 扩编 ' + (c.jieyueXc || 0) + '）'
          : '（尚无练兵场）') + '</span></div>' +
      '<div class="auto-line"><button class="btn" data-action="jieyue-xc" data-city="' + c.id +
        '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
          + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺 · 练兵场扩编（' + _jxTxt + '）</button>' +
        '<span class="ui-sub">出征容量 +1 万人马（等效练兵场 +1 级）</span></div></div>';
  };

  /* —— 出征页（v89.109 · 老板「军务的出征菜单不是给地址栏的，而是设置出征战术的地方」）：
     主体 = **出征战术设置**（全兵种 × 动作 × 首选歼敌目标）；在途队列保留（召回/急行军在那儿）。
     "近处可打目标"列表已删 —— 出征目标在地图上点选（城市 / 据点 / 野地）。 —— */
  ui.marchExpHTML = function () {
    /* ============================================================
     * v89.133（v89.128 第二批第 13 条 · 老板）：「军务中出征战术……**不要在途的行军队列**」——
     *   在途队列本页撤除（在途信息仍在「军务总览 · ④ 行军」段，一处不丢）。
     * 页面 = 出征战术（两列下拉）+ 练兵块（练兵场面板退役后演武/阅兵的新家）。
     * ============================================================ */
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城市。</div>';
    /* v89.136（老板 4）：「出征战术**细分掠夺，占领**，分别允许进行相应的默认战术设置」——
       本页改**两小页**（掠夺 / 占领，样式与「防守战术」页内小页同构）：
       每页只设该模式下的默认战术；未单独设置的兵种**沿用通用表**（老档数据所在）。
       页面显示"生效值"（细分覆盖通用 —— 与战斗读取同一口径 GAME.tacticsFor）。 */
    var tsub = (ui._expTac === 'raid') ? 'raid' : 'occupy';
    var tabs = '<div class="def-tabs">' +
      [['occupy', '🚩 占领战术'], ['raid', '🔥 掠夺战术']].map(function (t) {
        return '<span class="dt' + (tsub === t[0] ? ' on' : '') + '" data-action="exp-tac-sub" data-v="' + t[0] +
          '">' + t[1] + '</span>';
      }).join('') + '</div>';
    return '<div class="story-card"><div class="gold-heading">⚔️ 出征战术' +
      ui.help('出征战术**按出征方式细分**（「掠夺 / 占领」两个小页分别设置）。\n'
        + '每兵种两栏下拉：**动作**（前进 / 防御 / 后退 —— 决定初始站位与推进方式）＋ '
        + '**目标**（敌方某一兵种 / 箭塔 / 自动）。\n'
        + '动作：前进 = 每回合推进（到射程即停）；防御 = 原地不动、**受伤减半**；'
        + '后退 = 每回合后撤（躲箭塔双倍攻击区）。\n'
        + '目标：指定兵种在射程内就优先打它；选**箭塔**则专拆城防工事（拆完自动转打守军）。\n'
        + '未单独设置的兵种**沿用通用战术**（老档的设置继续生效）；'
        + '「恢复默认」只清本小页的细分设置；防守战术在「防守战术」页单独设。') + '</div>' +
      '<div class="ui-sub" style="margin:2px 0 6px;">当前（' +
        (tsub === 'raid' ? '掠夺' : '占领') + '）：' + GAME.tacticSummary(tsub) + '</div>' +
      ui.tacticBlockHTML(tsub) + '</div>' +
      /* v89.142（老板 3）：「掠夺战术和占领战术按钮放在界面底部」
         —— 与防守战术页的小页按钮**位置与图标风格保持一致**（都在卡片下方） */
      tabs;
  };
  /* —— 防守页：逐城防御体检 + **防守战术设置**（v89.109） —— */
  ui._defSub = 'over';
  ui.marchDefHTML = function () {
    /* ============================================================
     * v89.133（v89.128 第二批第 14 条 · 老板）：「军务的防守战术，在底下分两个小页面
     *   （避免后边城市过多，显示不过来），第一个是目前的全境体检，改名为**全境防御**
     *   （按目前方式显示城市清单）。第二个是**防守战术**，参考调整后的出征战术缩略显示」。
     * 两小页共用页内切换（ui._defSub）—— 城多时体检表再长，也不再与战术设置互相顶屏。
     * ============================================================ */
    var s = GAME.state;
    var sub = ui._defSub === 'tac' ? 'tac' : 'over';
    var tabs = '<div class="def-tabs">' +
      [['over', '🛡️ 全境防御'], ['tac', '⚔️ 防守战术']].map(function (t) {
        return '<span class="dt' + (sub === t[0] ? ' on' : '') + '" data-action="def-sub" data-v="' + t[0] +
          '">' + t[1] + '</span>';
      }).join('') + '</div>';
    if (sub === 'tac') {
      /* v89.142（老板 4）：「防守战术和全境防御按钮放在界面底部」—— 与出征战术页同款位置 */
      return '<div class="story-card"><div class="gold-heading">⚔️ 防守战术' +
        ui.help('我方城市被攻打时，守军按**这套设置**作战（NPC 守方不用你的设置）。\n'
          + '每兵种两栏下拉：动作 + 目标，与出征战术同一套控件。\n'
          + '「**出城迎战**」= 该兵种前出围墙之外迎敌：攻方必须先把它打完，才够得着围墙拆工事；\n'
          + '但它也吃不到围墙护佑 —— 是把前线前移的进攻性防御，代价与收益都归自己。') + '</div>' +
        ui.tacticBlockHTML('def') + '</div>' + tabs;
    }
    var rows = (s.cities || []).map(function (ct) {
      var army = GAME.armyTotal(ct);
      var wall = GAME.buildingLevel(ct, 'chengqiang') || 0;   /* v89.126：围墙占格后同一读法 */
      var towers = GAME.towerCountOf ? (GAME.towerCountOf(ct) || 0) : 0;
      var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(ct) : null;   /* v89.116：函数名笔误修正 */
      var def = GAME.defensePowerOf ? Math.round(GAME.defensePowerOf(ct) || 0) : 0;
      var risks = [];
      if (army <= 0) risks.push('无驻军');
      if (wall <= 0) risks.push('无围墙');
      if (!guard) risks.push('未任命守将');
      /* v89.113：城主缺席 = 治理/谋略加成为零（城市面板会写明），体检里点出来 */
      var mayor = GAME.mayorGeneralOf ? GAME.mayorGeneralOf(ct) : null;
      if (!mayor) risks.push('未任命城主');
      return '<tr><td>' + U.escape(ct.name) + '</td>' +
        '<td class="num">' + U.numText(army, 0) + '</td>' +
        '<td class="num">' + (wall > 0 ? 'Lv' + wall : '—') + '</td>' +
        '<td class="num">' + towers + '</td>' +
        '<td>' + (mayor ? U.escape(mayor.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td>' + (guard ? U.escape(guard.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td class="num" title="' + U.escape(GAME.defenseLineOf ? GAME.defenseLineOf(ct) : '') + '">'
          + U.numText(def, 0) + '</td>' +
        '<td style="color:' + (risks.length ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
          (risks.length ? risks.join(' · ') : '齐备') + '</td></tr>';
    }).join('');
    return '<div class="story-card"><div class="gold-heading">🛡️ 全境防御' +
      ui.help('防御力 = 驻军 × 兵种战力 × (1 + 围墙/城主谋略加成)（与来袭结算同一出口 defensePowerOf）。\n'
        + '城主（文治）= 治理→产量/建造/税收、谋略→研究/城防；守将（武功）= 武力→征兵、战时对阵。\n'
        + '"齐备"= 有驻军 + 有围墙 + 有城主 + 有守将；缺哪项就在那行里点出来。') +
      '</div>' + (rows ? '<table class="tbl"><thead><tr><th>城市</th><th class="num">驻军</th><th class="num">围墙</th>' +
        '<th class="num">箭塔</th><th>城主</th><th>守将</th><th class="num">防御力</th><th>风险</th></tr></thead><tbody>' + rows + '</tbody></table>'
      /* v92.15（C3）：城防拆账明细 —— 修墙/造塔到底加了多少，写在这里。
         数值一直在算，但玩家看不到"这 480 是谁给的"，也就没有理由去修。 */
      + (function () {
        var cs = (GAME.state.cities || []).filter(function (c) { return !c.npc; });
        if (!cs.length || !GAME.defenseLineOf) return '';
        var items = cs.map(function (c) {
          return '<div style="font-size:var(--fs-cap);color:var(--text-dim);">'
            + U.escape(c.name) + '：' + U.escape(GAME.defenseLineOf(c)) + '</div>';
        }).join('');
        return '<div style="margin-top:8px;padding:6px 8px;border-top:1px dashed var(--wood-light);">'
          + '<div style="font-size:var(--fs-cap);color:var(--gold-light);margin-bottom:3px;">城防构成</div>'
          + items + '</div>';
      })()
        : '<div class="q-empty">尚无城市。</div>') + '</div>' + tabs;
  };
  /* —— 军务处：两营并列（v89.132 起只此两块；动作全部复用既有出口） —— */
  /* 逐兵种清单（两个营共用）：把 { 兵种: 数量 } 摊成若干行 ——
     老板：「列出具体兵种及数量，不要一个总数量」。行序按数量降序（多的在前）。 */
  /* v89.118（老板「俘虏营直接文字显示就行，放图标太大了」）：
     opts.textOnly = 纯文字行（不摆兵种图标）—— 俘虏营用。
     伤兵营仍带图标（本轮指令只点名俘虏营；要统一改一处调用即可）。 */
  ui.armyBreakdownRows = function (map, emptyTxt, extraOf, opts) {
    var _o = opts || {};
    var arr = [];
    Object.keys(map || {}).forEach(function (k) {
      var v = Math.max(0, Math.floor(map[k] || 0));
      if (v > 0) arr.push([k, v]);
    });
    if (!arr.length) return '<div class="res-line"><span class="lbl">明细</span><span class="val" ' +
      'style="color:var(--text-dim);">' + U.escape(emptyTxt || '（空）') + '</span></div>';
    arr.sort(function (a, b) { return b[1] - a[1]; });
    return arr.map(function (x) {
      var nm = DATA.TROOPS[x[0]] ? DATA.TROOPS[x[0]].name : (x[0] === 'unknown' ? '来历不明' : x[0]);
      return '<div class="res-line"><span class="lbl">'
        + (_o.textOnly ? '' :
          (((GAME.icons && GAME.icons.forTroop && GAME.icons.forTroop(x[0])) || '') + ' '))
        + U.escape(nm) + '</span><span class="val">' + U.numText(x[1], 0) + ' 人'
        + (extraOf ? (extraOf(x[0], x[1]) || '') : '') + '</span></div>';
    }).join('');
  };
  /* ============================================================
   * v89.117（老板「还是没有俘虏营或者降兵营，目前俘虏设置是什么，要让玩家看得到」）
   * ------------------------------------------------------------
   * 伤兵营 / 俘虏营的**唯一落点**仍是「军务 · 军务处」，但两处不达标（本轮诊断）：
   *   ① 军务的默认页签是「军务总览」—— 玩家点进军务**看不到两营**；
   *   ② 俘虏规则（8% / 单场上限 3000 / 来源 / 收编口径）只写在**悬停提示**里，
   *      不悬停就看不见（老板原话：「目前俘虏设置是什么，要让玩家看得到」）。
   * 改：本函数收成**唯一组件**（军务处唯一形态 = camp-card 卡片），
   *     规则一律**可见文字**，数字读唯一出口（DATA.CAPTIVE / healFeeOf），不抄文案。
   * v89.132（老板）：「军务总览里边，不需要两营这个菜单，只在军务处即可」——
   *     总览页的 compact 档与 ⑤ 区一并退役（不留第二个形态 = 不留第二个出口）。
   * ============================================================ */
  ui.campCard = function (kind) {
    var s = GAME.state;
    var C = DATA.CAPTIVE || {};
    var ratePct = Math.round((C.rate == null ? 0.08 : C.rate) * 100);
    var capN = C.cap == null ? 3000 : C.cap;
    var srcNames = { wild: '野地', fort: '据点', city: '名城', defense: '守城得手' };
    var srcTxt = (C.kinds || []).map(function (k) { return srcNames[k] || k; }).join(' / ');
    if (kind === 'wounded') {
      var wn = s.wounded || 0;
      var fee = GAME.healFeeOf ? GAME.healFeeOf(wn) : wn * 10;
      /* v89.186：显示**当前实际回收率**（走唯一出口 —— 含商品/维修科技） */
      var wr = Math.round((GAME.woundedRateOf ? GAME.woundedRateOf(null)
        : ((DATA.EXPEDITION || {}).woundedRate || 0.75)) * 100);
      return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🏥 伤兵营</span>' +
        '<span class="wb-n">' + U.numText(wn, 0) + ' 名</span></div>' +
        ui.armyBreakdownRows(s.woundedArmy, '伤兵营已空 —— 打完仗有了伤兵会列在这里') +
        '<div class="camp-rule"><b>规则</b>　来源：战斗阵亡者按 <b>' + wr + '%</b> 折为伤兵（受伤者不当场消失）　·　' +
          '归队：花旧币一次性治疗，按兵种加回本城　·　' +
          '自动化：「自动化 · 治疗伤兵」可托管</div>' +
        '<div class="auto-line"><button class="btn' + (wn ? ' gold' : ' dim') + '" data-action="heal-wounded"' +
          (wn ? '' : ' disabled data-why="伤兵营已空 —— 打完仗产生伤兵后才能治疗"') + '>治疗伤兵（归队）</button>' +
          '<span class="ui-sub">治疗费 ' + U.numText(fee, 0) + ' 旧币</span></div></div>';
    }
    /* 俘虏营 —— v89.142（老板 5）：收编 = **直接转入本城相应兵种** + 支旧币（造价 50%）；
       花费与明细一律读唯一出口 conscriptPlanOf（界面不自己折算，防两处漂移）。 */
    var cn = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;
    var plan = GAME.conscriptPlanOf ? GAME.conscriptPlanOf(s.captives) : { men: cn, cost: 0, pct: 0.5 };
    var pctN = Math.round((plan.pct == null ? 0.5 : plan.pct) * 100);
    var goldN = (s.res && s.res.gold) || 0;
    var afford = cn > 0 && goldN >= plan.cost;
    var kkN = Object.keys(plan.byType || {}).length;
    var rep = Math.max(1, Math.round(cn / 50));
    return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🪶 俘虏营</span>' +
      '<span class="wb-n">' + U.numText(cn, 0) + ' 名</span></div>' +
      ui.armyBreakdownRows(s.captives, '俘虏营已空 —— 战果里有俘获就会列在这里', null, { textOnly: true }) +
      '<div class="camp-rule"><b>规则</b>　来源：' + U.escape(srcTxt) + '　·　' +
        '折算：敌军逐兵种损失 × <b>' + ratePct + '%</b>（不足 10 不收；单场上限 ' + U.numText(capN, 0) +
        ' 人 —— 营中<b>不限量</b>）　·　' +
        '<b>收编入军</b>：**逐兵种直接转入本城军队**（数量 +N，共 ' + kkN + ' 类）；' +
        '支旧币 = 各兵种造价的 <b>' + pctN + '%</b>（资源按交易站平价折旧币）　·　' +
        '<b>释放</b>：不添兵，换声望（每 50 人 +1）</div>' +
      '<div class="auto-line"><button class="btn' + (afford ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
        (afford ? '' : ' disabled') + ' title="' + (cn
          ? (goldN >= plan.cost ? '逐兵种转入本城军队' : '旧币不足：需 ' + U.numText(plan.cost, 0) + '，现有 ' + U.numText(goldN, 0))
          : '俘虏营为空') + '">收编入军（兵 ' + U.numText(cn, 0) + ' · 费 ' + U.numText(plan.cost, 0) + ' 旧币）</button>' +
        '<button class="btn' + (cn ? '' : ' dim') + '" data-action="release-captives"' +
        (cn ? '' : ' disabled data-why="俘虏营为空，无俘可释"') + '>释放（声望 +' + rep + '）</button>' +
        '</div></div>';
  };
  /* 两营合计（页签角标 + 总览摘要共读的唯一出口） */
  ui.campBadgeN = function () {
    var s = GAME.state || {};
    return Math.max(0, s.wounded || 0) + (GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0);
  };

  ui.marchAffairsHTML = function () {
    /* v89.132（老板「军务处伤兵营和俘虏营左右分列，均列出详细兵种。
       兵源与征募这个菜单不要，军心这个菜单也不要」）——
       军务处 = 两营左右分列（.camp-cards），其余卡片一概不留。 */
    return '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' +
      '两营的唯一落点：逐兵种清单、治疗归队、收编 / 释放都在这里</div>' +
      '<div class="camp-cards">' + ui.campCard('wounded') + ui.campCard('captive') + '</div>';
  };

  /* ============================================================
   * 军务 · 警报页（v89.107 · 老板）
   * ------------------------------------------------------------
   * 老板令：「左侧统计栏的警报警报（含策略布防）放到军务中，与出征防守等并列，
   *          有警报时，建筑瞭望塔颜色明暗闪烁」。
   * 于是左侧「城市属性」不再有警报横幅与「计略布防」行 —— 两者整体搬到这里：
   *   ① 预警 = 各城下次来袭（invasionDueAt 唯一出口）+ 守备力（defensePowerOf）
   *      + 是否在预警窗内（invasionAlertOf，与瞭望塔闪烁同源）+ 瞭望塔等级；
   *   ② 布防 = 空城计 / 坚壁清野（schemeDefOf 读状态，布防走既有 openCityScheme）；
   *   ③ 流水 = 警报类消息最近 12 条（预警 / 击退或被破 / 防守计）。
   * ============================================================ */
  /* 下次来袭的显示文本（v89.115）：**现实时间口径** —— 剩余 M 分 S 秒。
     due / now 皆为现实毫秒（now 缺省取当前）；不再显示"今日/明日 9 时"（那是游戏时口径）。 */
  ui.invDueText = function (due, now) {
    var n0 = (now == null ? GAME.realNow() : now);
    var left = Math.max(0, Math.round((due - n0) / 1000));
    return '<b>' + U.dur(left) + '</b> 后' +
      '<br><span style="color:var(--text-dim);font-size:var(--fs-sub);">（现实时间）</span>';
  };
  /* ============================================================
   * v89.118（老板需求 3）：「外敌来犯」的**介绍（触发与规则）**与**警报流水**——
   *   原先在「军务 · 警报」页（v89.113 落的），本轮迁到「自动化 · 外敌来犯」：
   *   警报页只留**预警（排期表）+ 布防**；规则与流水跟"开关"同页
   *   （管开不开的人，才最需要知道规则与历史）。
   * 字段全部动态引用 DATA.INVASION（改数值这里自动跟，不抄第二份）。
   * ============================================================ */
  ui.invasionRulesHTML = function () {
    var I = DATA.INVASION || {};
    var rMin0 = (I.realMin == null ? 30 : I.realMin);
    var wMin0 = (I.warnMin == null ? 5 : I.warnMin);
    var lo0 = Math.round((I.ratioMin == null ? 0.28 : I.ratioMin) * 100);
    var hi0 = Math.round((I.ratioMax == null ? 0.45 : I.ratioMax) * 100);
    return '<div class="story-card" style="margin-top:var(--sp-4);">' +
      '<div class="gold-heading">📜 来犯 · 触发与规则' +
      ui.help('本栏为「外敌来犯」的全局规则（与开关同页）。\n' +
        '各城排期与布防见「军务 · 警报」。\n' +
        '规则字段与 DATA.INVASION 同源（改数据这里自动跟）。') + '</div>' +
      '<div class="res-line"><span class="lbl">触发点</span><span class="val">' +
        U.escape((I.sources || ['流寇']).join(' ／ ')) + '　（诸方势力轮番来犯）</span></div>' +
      '<div class="res-line"><span class="lbl">开战门槛</span><span class="val">拥有 <b>' +
        (I.unlockCities == null ? 2 : I.unlockCities) + '</b> 座以上城市后，始有兵戈之扰</span></div>' +
      '<div class="res-line"><span class="lbl">时机</span><span class="val">每 <b>' + rMin0 +
        ' 分钟</b>一场（<b>现实时间</b> —— 与本作倍速无关）；目标城<b>按场轮转</b> —— 人人有份，可预判</span></div>' +
      '<div class="res-line"><span class="lbl">规模</span><span class="val">来袭战力约为全境战力的 <b>' +
        lo0 + '%~' + hi0 + '%</b> —— 兵收拢、墙修高，便守得住</span></div>' +
      '<div class="res-line"><span class="lbl">预警</span><span class="val">提前 <b>' + wMin0 +
        ' 分钟</b>（现实时间）警报一次；瞭望塔越高，警讯里的敌情越细</span></div>' +
      '<div class="res-line"><span class="lbl">离线</span><span class="val">离城期间最多补算 <b>' +
        (I.catchUpMax == null ? 3 : I.catchUpMax) + ' 场</b>，其余敌军自行散去（不翻旧账）</span></div>' +
      '<div class="res-line"><span class="lbl">底线</span><span class="val">' +
        (I.loseCity ? '城破丢城' : '<b style="color:var(--green-ok);">城破不丢城</b>') +
        ' —— 只损资源 / 兵力 / 围墙等级</span></div>' +
      '<div class="ui-sub" style="margin-top:6px;">防御三件套：驻军 · 围墙箭塔 · 城主（谋略加到城防）与守将（战时对阵）。' +
        '布防（空城计 / 坚壁清野）在「军务 · 警报」。</div>' +
      '</div>';
  };
  /* 警报流水（唯一落点：自动化 · 外敌来犯 —— 与开关同页） */
  ui.beaconFlowHTML = function () {
    var flow = GAME.msgsOf('beacon').slice(0, ui.BEACON_FLOW);
    if (!flow.length) return '';
    return ui.sealH('警报流水', '最近 ' + flow.length + ' 条 · 警报与来犯消息的唯一落点（军务·警报 只留预警与布防）') +
      '<div class="msg-log">' + flow.map(function (m) {
        var d = new Date(m.t);
        return '<div class="bb-line beacon"><span class="bl-t">' + U.pad(d.getHours()) + ':' +
          U.pad(d.getMinutes()) + '</span>' + U.escape(m.msg) + '</div>';
      }).join('') + '</div>';
  };

  ui.marchBeaconHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var now = (s.world && s.world.elapsed) || 0;
    var out = '';
    /* v89.133（v89.128 第二批第 15 条 · 老板）：「军方的警报，去掉这种备注行」——
       指路行退役（规则与流水仍在「自动化 · 外敌来犯」，位置没变，只是不再占页头）。 */
    /* ① 预警 —— v89.115（老板「为啥每分钟都被打一次」）：改**现实时间**节奏（每 realMin 分钟一场） */
    var rows = [];
    var nowR = GAME.realNow();
    (s.cities || []).forEach(function (ct) {
      var due = GAME.invasionDueAt(ct);
      if (!due) return;
      var al = GAME.invasionAlertOf(ct);
      var w = GAME.invasionWarnSec(ct);
      var def = GAME.defensePowerOf ? Math.round(GAME.defensePowerOf(ct) || 0) : 0;
      rows.push({ ct: ct, al: al, due: due, def: def, bc: w.bc,
        left: Math.round((due - nowR) / 1000) });
    });
    rows.sort(function (a, b) { return a.left - b.left; });
    var next = rows[0];
    var rMin = (DATA.INVASION.realMin == null ? 30 : DATA.INVASION.realMin);
    out += '<div class="story-card"><div class="gold-heading">🔥 警报 · 预警' +
      ui.help('来犯每 **' + rMin + ' 分钟**一场（**现实时间**，与倍速无关），目标城按场轮转。\n提前 ' +
        (DATA.INVASION.warnMin == null ? 5 : DATA.INVASION.warnMin) +
        ' 分钟（现实）**只报一次**，警讯里含来袭剩余时间。\n进窗后：城内瞭望塔会明暗闪烁。\n' +
        '瞭望塔越高 → 警讯里的敌情越细（Lv1 +战力 · Lv2 +兵种明细）。') + '</div>';
    if (!rows.length) {
      out += '<div class="q-empty">暂无排期 —— 拥有 2 座以上城市后，敌军每 ' + rMin +
        ' 分钟（现实时间）来犯一场（目标城按场轮转）。</div></div>';
    } else {
      out += '<div class="ui-sub" style="text-align:center;margin-bottom:8px;">' +
        (next.al ? '<b style="color:var(--red-light);">⚠ 警报中</b>：' + U.escape(next.ct.name) +
            ' · 剩余 ' + U.dur(Math.max(0, next.left)) + '（现实时间）'
          : '最近一场：' + U.escape(next.ct.name) +
            ' · 剩余 ' + U.dur(Math.max(0, next.left)) + '（现实时间）') + '</div>' +
        '<table class="tbl"><thead><tr><th>城市</th><th class="ctr">下次来袭</th>' +
        '<th>来犯</th><th class="ctr">瞭望塔</th><th class="num">守备力</th><th class="ctr">状态</th></tr></thead><tbody>' +
        rows.slice(0, 12).map(function (r) {
          return '<tr><td>' + (r.al ? '🔥 ' : '') + U.escape(r.ct.name) + '</td>' +
            '<td class="ctr">' + ui.invDueText(r.due, nowR) + '</td>' +
            '<td>' + U.escape(GAME.invasionIntelTextOf(r.ct, GAME.invasionSlotOf(r.due))) + '</td>' +
            '<td class="ctr">' + (r.bc > 0 ? 'Lv' + r.bc : '<span style="color:var(--text-dim);">无</span>') + '</td>' +
            '<td class="num">' + U.fmt(r.def) + '</td>' +
            '<td class="ctr">' + (r.al
              ? '<b style="color:var(--red-light);">警报中（闪烁）</b>'
              : '<span style="color:var(--text-dim);">待命</span>') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (rows.length > 12 ? '<div class="ui-sub" style="text-align:center;">另有 ' + (rows.length - 12) + ' 城未列出</div>' : '') +
        '</div>';
    }
    /* ② 布防（策略布防 —— 从左侧统计栏搬来） */
    if (c && GAME.schemeDefOf) {
      var kc = GAME.schemeDefOf(c, 'kongcheng', now);
      var jb = GAME.schemeDefOf(c, 'jianbi', now);
      /* v89.116：这里原写 `GAME.itemCount ? GAME.itemCount('jinang') : 0` ——
         该函数**全仓不存在**（同 `guardOf` 那一类"拼错就被三元吞掉"）→ 封存匣数恒 0。
         真口径 = 背包里的数量（与"背包点封存匣用掉"同一份数据）。 */
      var ja = (GAME.state.items || {}).jinang || 0;
      out += '<div class="story-card"><div class="gold-heading">🎴 策略布防 · ' + U.escape(c.name) +
        ui.help('防御计布防于本城，持续期内自动生效（与来袭结算同一套出口）。\n' +
          '空城计：下一次来犯不战而退；坚壁清野：遭来犯时损失 −40%。\n封存匣可用 ' + ja + ' 个。') + '</div>' +
        '<div class="res-line"><span class="lbl">🎭 空城计</span><span class="val">' +
          (kc ? '<b style="color:var(--green-ok);">布防中（余 ' + Math.ceil(kc.left / 3600) + ' 时）</b>'
              : '<span style="color:var(--text-dim);">未布防</span>') + '</span></div>' +
        '<div class="res-line"><span class="lbl">🏜️ 坚壁清野</span><span class="val">' +
          (jb ? '<b style="color:var(--green-ok);">布防中（余 ' + Math.ceil(jb.left / 3600) + ' 时）</b>'
              : '<span style="color:var(--text-dim);">未布防</span>') + '</span></div>' +
        '<div class="auto-line"><button class="btn gold" data-action="city-scheme">🎴 布防 / 更换</button>' +
          '<span class="ui-sub">封存匣现有 ' + ja + ' 个（游商 / 战利品可得）</span></div></div>';
    }
    /* ③ v89.118（老板需求 3）：流水**已迁至「自动化 · 外敌来犯」**（与开关同页）——
       函数 ui.beaconFlowHTML() 是它的新家，本页不再渲染。 */
    return out;
  };

  /* ============================================================
   * v92：阵亡名录
   * ------------------------------------------------------------
   * 老板：「死多少不是问题，问题是死亡换来什么。」
   * 老板：「不必过于强调死亡换来什么，这将调整玩家的道德感。」
   *
   * 所以这一页**只做一件事：把名字留下来。**
   * ⚠️ 刻意的空白：
   *   · 不给任何加成（"阵亡 N 人全军 +X%"）—— 那是给死亡标价；
   *   · 不做"复仇任务"—— 那是把死人变成任务道具；
   *   · 不拦出征、不弹警告 —— 它是一面墙，不是一道闸。
   * 唯一"有用"的地方：它把**这场仗值不值**从数字变成了一张脸。
   * ============================================================ */
  ui.memorialHTML = function () {
    var M = GAME.memorial;
    if (!M) return '<div class="q-empty">阵亡名录未接入。</div>';
    var st = (GAME.state || {}).stats || {};
    var total = M.total();
    var battles = st.deadBattles || 0;
    var list = M.list(40);

    var h = '<div class="sec-h">阵亡名录</div>';
    h += '<div style="display:flex;gap:18px;flex-wrap:wrap;margin:6px 0 12px;">'
      + '<div><div style="font-size:var(--fs-title);color:var(--gold-light);">' + U.fmt(total) + '</div>'
      + '<div style="font-size:var(--fs-cap);color:var(--text-dim);">人未归</div></div>'
      + '<div><div style="font-size:var(--fs-title);color:var(--text);">' + U.fmt(battles) + '</div>'
      + '<div style="font-size:var(--fs-cap);color:var(--text-dim);">场有去无回</div></div>'
      + '<div><div style="font-size:var(--fs-title);color:var(--text);">' + U.fmt(list.length) + '</div>'
      + '<div style="font-size:var(--fs-cap);color:var(--text-dim);">条刻在墙上</div></div>'
      + '</div>';

    /* 探索度：和"未归"放一起 —— 都是这场远征的账。 */
    if (GAME.fog && GAME.fog.stats) {
      var fs = GAME.fog.stats();
      h += '<div style="margin:0 0 12px;padding:8px 10px;border:1px solid var(--wood-light);border-radius:4px;">'
        + '<div style="font-size:var(--fs-cap);color:var(--text-dim);">行迹 · 这颗星球已探明</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">'
        + '<div class="pbar" style="flex:1;"><i style="width:' + Math.max(0.5, fs.pct) + '%"></i></div>'
        + '<span style="font-size:var(--fs-cap);">' + U.fmt(fs.seen) + ' / ' + U.fmt(fs.total) + ' 格（' + fs.pct + '%）</span>'
        + '</div>'
        /* v92.19：传闻 —— 不指路，只说"还剩多少没看见" */
        + (GAME.rumorLineOf
          ? ('<div style="font-size:var(--fs-cap);color:var(--text-dim);margin-top:5px;">'
            + U.escape(GAME.rumorLineOf()) + '</div>')
          : '')
        + '</div>';
    }

    if (!list.length) {
      h += '<div class="q-empty">' + U.escape(M.emptyText()) + '</div>';
    } else {
      var rows = list.map(function (r) {
        var by = Object.keys(r.by || {}).map(function (id) {
          var T = DATA.TROOPS[id] || {};
          return (T.name || id) + ' ' + U.fmt(r.by[id]);
        }).join(' · ');
        return '<tr>'
          + '<td style="white-space:nowrap;">第 ' + r.y + ' 年' + ['春', '夏', '秋', '冬'][r.s % 4] + '</td>'
          + '<td>' + U.escape(r.place) + '</td>'
          + '<td class="num" style="color:var(--gold-light);">' + U.fmt(r.n) + '</td>'
          + '<td style="font-size:var(--fs-cap);color:var(--text-dim);">' + U.escape(by || '—') + '</td>'
          + '<td class="ctr" style="color:' + (r.win ? 'var(--text)' : 'var(--red-light)') + ';">'
          + (r.win ? '胜' : '败') + '</td>'
          + '</tr>';
      }).join('');
      h += '<table class="tbl"><thead><tr><th>年月</th><th>地方</th><th class="num">未归</th><th>兵马</th><th class="ctr">战果</th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table>';
    }
    h += '<div style="margin-top:10px;font-size:var(--fs-cap);color:var(--text-dim);">'
      + '名录只记再也不回来的人 —— 归队的、抬回来治好的，都不算。'
      + '</div>';
    return h;
  };

  ui.marchesHTML = function () {
    var s = GAME.state;
    var c = GAME.currentCity();
    var tab = ui._marchTab || 'over';
    if (tab === 'expand') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchExpandHTML() + '</div>';
    if (tab === 'act') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchActHTML() + '</div>';
    if (tab === 'exp') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchExpHTML() + '</div>';
    if (tab === 'def') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchDefHTML() + '</div>';
    if (tab === 'beacon') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchBeaconHTML() + '</div>';
    if (tab === 'affairs') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchAffairsHTML() + '</div>';
    if (tab === 'memorial') return '<div class="ui-page">' + ui.marchTabHTML() + ui.memorialHTML() + '</div>';

    /* ---------- ① 城内（v89.140 老板 2：表头 = 各兵种名称，逐格显示数量） ----------
       老板原话：「兵种明显直接增加表头为各兵种名称，分别显示数量。**固定行宽**，
       超过 1W 的以万缩略显示」——
       · 列 = 全境**出现过**的兵种（按 DATA.TROOPS 顺序；没兵的兵种不占列）；
       · 数量一律走 `U.fmt`（≥1 万 → X.X 万；< 1 万千分位）；
       · 列宽固定（CSS `.mc-tbl`，table-layout: fixed）—— 数量长短不再撑动版式。 */
    var troopCols = Object.keys(DATA.TROOPS).filter(function (tid) {
      if (DATA.TROOPS[tid].nocombat) return false;
      return (s.cities || []).some(function (ct) { return ((ct.army || {})[tid] || 0) > 0; });
    });
    var cityRows = (s.cities || []).map(function (ct) {
      var cells = troopCols.map(function (tid) {
        var n = (ct.army || {})[tid] || 0;
        return '<td class="num">' + (n > 0 ? U.fmt(n) : '<span style="opacity:.25;">—</span>') + '</td>';
      }).join('');
      return '<tr><td class="mc-name">' + U.escape(ct.name) +
        ((GAME.isMainCity && GAME.isMainCity(ct)) ? ' <span class="city-tier mt">主城</span>' : '') +
        ((c && ct.id === c.id) ? ' <span style="color:var(--gold-light);font-size:var(--fs-cap);">当前</span>' : '') + '</td>' +
        '<td class="num">' + U.fmt(GAME.armyTotal(ct)) + '</td>' + cells + '</tr>';
    }).join('');
    var cityBlock = (s.cities || []).length
      ? '<table class="tbl mc-tbl"><thead><tr><th class="mc-name">城市</th><th class="num">合计</th>' +
        troopCols.map(function (tid) { return '<th class="num">' + U.escape(DATA.TROOPS[tid].name) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + cityRows + '</tbody></table>'
      : '<div class="q-empty">尚无城市。</div>';

    /* ⛔ v89.140（老板 2）：「军务总览中，**不再显示驻守野地和采集队菜单**」——
       两块（含各自的列表与合计）整段退役：驻军的唯一落点 = **附属野地界面**
       （每野地一行：英雄 / 驻军 / 操作），采集的唯一落点 = 地块与军务处。
       合计值 `garTot` 随统计行一并退役（那个统计行也在本轮删掉）。 */

    /* ⛔ v89.140（老板 2）：采集队块同上退役（"不再显示…采集队菜单"）——
       采集的进度/收获统一在**地块界面**与**军务处**操作；
       全境采集一览在「附属野地」（已含带领英雄与驻军数）。 */

    /* ---------- v89.87（老板需求 4）：④′ 征战中（待指挥的观战战斗） ---------- */
    var btPend = ui.btPendingBlock();

    /* ---------- ④ 行军（**全境**队列，不只看当前城） ---------- */
    var list = (s.marches || []).slice();
    var marchTot = 0;
    var rows = list.map(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      var gen = null;
      (s.generals || []).forEach(function (g) { if (g.id === m.genId) gen = g; });
      var n = 0;
      for (var k in m.army) n += m.army[k] || 0;
      marchTot += n;
      var left = Math.max(0, (m.totalTime - m.elapsed) / GAME.timeScale());
      var from = GAME.cityById(m.cityId);
      return '<tr>' +
        '<td>' + md.icon + ' ' + U.escape(m.name) + '</td>' +
        '<td class="ctr">' + (from ? U.escape(from.name) : '—') + '</td>' +
        '<td class="ctr">' + (gen ? U.escape(gen.name) : '—') + '</td>' +
        '<td class="ctr">' + md.name + '</td>' +
        '<td class="num">' + U.numText(n, 0) + '</td>' +
        '<td style="min-width:150px;">' +
          '<div class="pbar"><i style="width:' + pr.pct + '%"></i></div>' +
          '<span style="font-size:var(--fs-cap);color:var(--text-dim);">' + pr.pct + '% · 余 ' + U.durExact(left) + '</span></td>' +
        ui.marchOpsCell(m) +
        '</tr>';
    }).join('');
    /* v91.42（老板）：「奇观探索等同行军，作为行军管理的一部分」——
       奇观探索队（全星球）并入本段，与常规行军同表头（出发/主将/方式=☄奇观探查/兵力…）。
       常规行军与奇观探索都空时才提示"没有在途队列"。 */
    var _wfRows = ui._wonderFlightRows(true), _wfN = ui.wonderFlightCount();
    var _marchHead = '<thead><tr><th>目标</th><th class="ctr">出发</th><th class="ctr">主将</th><th class="ctr">方式</th><th class="num">兵力</th><th>行军进度</th><th class="ctr">操作</th></tr></thead>';
    var marchBlock;
    if (list.length || _wfN) {
      marchBlock = '';
      if (list.length) marchBlock += '<table class="tbl">' + _marchHead + '<tbody>' + rows + '</tbody></table>' + ui.marchRushAllBtn(list);
      if (_wfN) marchBlock += '<table class="tbl"' + (list.length ? ' style="margin-top:8px;"' : '') + '>' + _marchHead + '<tbody>' + _wfRows + '</tbody></table>';
    } else {
      marchBlock = '<div class="q-empty">当前没有在途行军队列。在地图上对野地 / 据点 / 城市点「出兵」即会进入行军。</div>';
    }

    /* v89.140（老板 2）：① 统计行（"在城 X · 驻守 Y · 采集 Z …"）**整行去掉**；
       ② 驻守野地 / 采集队两块去掉；③ 编号重排为 ① 城内 / ② 征战中 / ③ 行军。 */
    return '<div class="ui-page">' + ui.marchTabHTML() +
      '<div class="gold-heading">⚔ 军务总览</div>' +
      '<div class="q-sec" style="margin-top:6px;"><span class="q-sec-t">① 城内</span><span class="q-sec-n">' + (s.cities || []).length + ' 城' +
        '　<button class="btn sm" data-action="open-power" title="英雄 / 兵种 / 总体战力评估（基于英雄对兵种的加成）">⚖ 战力评估</button></span></div>' +
      cityBlock +
      (btPend ? '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">② ⚔ 征战中</span><span class="q-sec-n">' + btPend.n + ' 处</span></div>' + btPend.html : '') +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">' + (btPend ? '③' : '②') + ' 行军</span><span class="q-sec-n">' + (list.length + _wfN) + ' 队</span></div>' +
      marchBlock +
      /* v89.132（老板「军务总览里边，不需要两营（伤兵·俘虏）这个菜单，只在军务处即可」）：
         ⑤ 两营区整体退役 —— 两营（含逐兵种清单与操作）的**唯一落点** = 军务 · 军务处；
         军务处页签角标（campBadgeN）仍提示待处理数，点进军务一眼就知道有没有活。 */
      '</div>';
  };

  /* 实时刷新建造进度（格子/城外地块/弹窗倒计时 + 进度条，不整页重绘） */
  ui.updateProgress = function () {
    ['data-build-progress', 'data-ext-progress', 'data-modal-progress'].forEach(function (attr) {
      var els = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < els.length; i++) {
        var key = els[i].getAttribute(attr); // "city:3" / "city:wall"（v89.174：'wall' 槽）
        var p = key.split(':');
        /* v89.174：非数字槽位原样传 —— 改前 Number('wall')=NaN，围墙行会永远显示 '…' */
        var pv174 = /^\d+$/.test(p[1]) ? Number(p[1]) : p[1];
        els[i].textContent = GAME.buildPct(p[0], pv174) || '…';
      }
    });
    /* v82：征收退役 —— 按钮冷却同步随功能撤除。 */
    /* 进度条宽度 */
    var bars = document.querySelectorAll('[data-build-bar]');
    for (var b = 0; b < bars.length; b++) {
      var bk = bars[b].getAttribute('data-build-bar');
      var bp = bk.split(':');
      var pr = GAME.buildProgress(bp[0], Number(bp[1]));
      bars[b].style.width = (pr ? pr.pct : 100) + '%';
    }
    /* v73：基因实验室 —— 面板开着时倒计时每秒走、完成即换出「提取」按钮
       （与征收冷却同一套"弹窗不整页重绘、靠这里每秒同步"的口径）。 */
    var _farmCity = GAME.currentCity();
    var fLeft = document.querySelectorAll('[data-farm-left]');
    for (var f1 = 0; f1 < fLeft.length; f1++) {
      var fi1 = Number(fLeft[f1].getAttribute('data-farm-left'));
      var fs1 = GAME.farmPlotState(fi1, _farmCity);
      fLeft[f1].textContent = fs1.state === 'ripe'
        ? '✨ 可提取'
        : ('完成还需 ' + U.durExact(fs1.left / GAME.timeScale()));
    }
    var fBars = document.querySelectorAll('[data-farm-bar]');
    for (var f2 = 0; f2 < fBars.length; f2++) {
      var fi2 = Number(fBars[f2].getAttribute('data-farm-bar'));
      fBars[f2].style.width = GAME.farmPlotState(fi2, _farmCity).pct + '%';
    }
    if (document.querySelector('.farm-space')) {
      var fr = GAME.farmOf(_farmCity), ripeN = 0;
      for (var f3 = 0; f3 < fr.plots.length; f3++) {
        if (GAME.farmPlotState(f3, _farmCity).state === 'ripe') ripeN++;
      }
      var shownN = document.querySelectorAll('.farm-cell [data-action="farm-extract"]').length;
      if (ripeN !== shownN) ui.openFarm();
    }
  };

  /* 公文页正文的实时刷新（v16 起消息流整合进公文）
     v89.107：刷新的是**当前页签的正文**（#doc-body）；页签本身不由这里重画 ——
     它带条数，每秒重画会把 hover 态和位置一起抖没。 */
  ui.renderLog = function () {
    var el = $('#doc-body');
    if (!el) return;                     // 仅在公文档可见时刷新
    if (ui.hoverHold(el)) return;        /* v89.158：悬停保护（消息行/按钮的悬停不被打断） */
    el.innerHTML = ui.docBodyHTML(ui._docTab || 'war');
  };

})();
