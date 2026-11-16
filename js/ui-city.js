/* ============================================================
 * ui-city.js　城市 · 新手引导 / 城市操作栏 / 侧栏驻军与资源
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

  /* ================= 侧栏 ================= */
  ui.setCity = function (id) {
    if (GAME.cityById(id)) { ui._cityId = id; ui.renderView('city'); ui.renderSide(); }
  };

  /* 侧栏渲染（三段式：城市属性 / 资源 / 驻军）
     v16 起侧栏为常驻固定布局，不再有页签切换 */
  ui.renderSide = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!s || !c) return;
    /* v92.244（老板：「开局提示做连续弹窗，不要在左侧统计栏显示」）：
       这里原本先画一条 `renderNextHint`（侧栏"新手一条"）—— 已撤。
       决策逻辑 `ui.nextHintOf()` 保留（它是"下一步该干什么"的唯一判断源），
       只把**呈现方式**从侧栏一行改成连续弹窗（ui.openTutorial）。 */
    ui.renderCityAttrs(c, s);
    ui.renderResBar(c, s);
    ui.renderGarrison(c, s);
  };

  /* ============================================================
   * v149（实机自检）· **新手一条**
   * ------------------------------------------------------------
   * 问题（无头实机截图确认）：新玩家进游戏，主界面**没有任何一句话**
   * 告诉他"现在该干什么"——顶栏 9 个菜单、城内 48 格、侧栏三块数字，
   * 全靠自己猜。这不是"信息不足"，是**没有下一步**。
   *
   * 所以加**一行**（只一行，不弹窗、不遮挡）：
   *   ① 兵 < 60 → 「先募点兵」      → 点它跳到练兵场
   *   ② 已造建筑 < 4 → 「先把空地盖上」→ 点它看建筑一览
   *   ③ 其余 → 「出发去野外」        → 点它回地图
   * 做完对应那一步就**自动消失**（不打扰）。
   * ============================================================ */
  /* 侧栏提示的"去这一格"：按建筑 id 找第一格、或找第一块空地，直接开它的面板。
     找不到就退回建筑一览（至少不是死路）。 */
  ui.hintGoto = function (h) {
    var c = GAME.currentCity();
    if (!c) return;
    var idx = -1;
    if (h.cell) {
      (c.cells || []).forEach(function (x, i) { if (idx < 0 && x.build && x.build.id === h.cell) idx = i; });
    } else if (h.pick) {
      (c.cells || []).forEach(function (x, i) { if (idx < 0 && !x.build && !x.official) idx = i; });
    }
    if (idx >= 0) {
      ui.setView('city');
      ui.openBuildModal(idx, c.id);
      return;
    }
    ui.openBuildingList();
  };

  /* 沿前置链找到**最底那一环**（玩家真正能动手的那一步）。
     复核第三处：军营要居所 Lv2 → 居所要政务厅 Lv2 —— 只指一层的话，
     点过去还是"需政务厅 Lv2"，等于把人从一个关着的门送到另一个关着的门。 */
  ui._firstBlocker = function (c, bid, depth) {
    if (!GAME.buildPrereqOf) return null;
    /* ⚠️ 要查的是"下一级"（建军营 = 新建，nextLv=1；升居所 = Lv+1）。
       复核第四处：这里一律传 1 时，居所的"升级前置（需政务厅 Lv2）"根本不会被查出来
       —— 提示于是停在"先升居所"，点过去还是那句"需政务厅 Lv2"，链条断在中间。 */
    var nextLv = (GAME.buildingLevel(c, bid) || 0) + 1;
    var pre = GAME.buildPrereqOf(c, bid, nextLv);
    if (!pre || pre.ok || !pre.list || !pre.list.length) return null;
    /* 硬依赖优先（政务厅总闸 / 升级依赖）：那才是"必须先做"的一环；
       软前置（缺某建筑）只有它本身也能建/升时才值得继续往下钻。 */
    var hard = null, soft = null;
    pre.list.forEach(function (x) {
      if (!hard && (x.gate || x.upGate || x.wallGate)) hard = x;
      if (!soft && !(x.gate || x.upGate || x.wallGate)) soft = x;
    });
    var first = hard || soft;
    if (!first) return null;
    if ((depth | 0) >= 4) return first;
    return ui._firstBlocker(c, first.bid, (depth | 0) + 1) || first;
  };
  /* 这一格是不是正在施工（排队中）—— 是的话提示改口，别再让人重复点 */
  ui._buildingNow = function (c, bid) {
    var hit = false;
    ((c && c.cells) || []).forEach(function (x) {
      if (x && x.pending && x.pending.buildId === bid) hit = true;
    });
    return hit;
  };

  ui.nextHintOf = function (c) {
    if (!c) return null;
    var n = GAME.armyTotal ? GAME.armyTotal(c) : 0;
    /* v149.2（复核）：旧版"先募兵 → 去军务"是死路（军营没建、居所才 Lv1，
       募兵页只有一句"本城尚未建造军营"）。现在按**真实前置链**给下一步：
         军营缺 → 沿前置链找到最底一环（可能是政务厅 / 居所）→ 指向那一格；
         正在施工 → 告诉他"等一等"，别让人对着同一个按钮点十次。 */
    var hasBar = (GAME.buildingLevel(c, 'junying') || 0) > 0;
    if (!hasBar) {
      var fb = ui._firstBlocker(c, 'junying');
      if (fb && ui._buildingNow(c, fb.bid)) {
        return { id: 'wait', text: '「' + fb.name + '」正在施工 —— 造好就能接着往下走',
          act: 'hint-go', view: 'city', cell: fb.bid };
      }
      if (fb) {
        return { id: 'barracks', text: '先把「' + fb.name + '」升到 Lv' + fb.need + ' —— 这是建军营的第一道门槛',
          act: 'hint-go', view: 'city', cell: fb.bid };
      }
      return { id: 'barracks', text: '建一座军营 —— 有军营才能募兵', act: 'hint-go', view: 'city', pick: 1 };
    }
    if (n < 60) return { id: 'train', text: '先募一点兵 —— 出门才有底气', act: 'hint-go', view: 'marches' };
    /* ⚠️ 只数**非政务厅**的建筑 —— 立城自带 4 座居所 + 1 座政务厅（共 5 个 build 项），
       直接数 build 会让"建城"这一段永远跳过（实机自测当场抓到）。 */
    var built = ((c.cells || []).filter(function (x) { return x.build && x.build.id !== 'guanfu'; })).length;
    if (built < 4) return { id: 'build', text: '先把空地盖上 —— 城才有产出', act: 'hint-go', view: 'city', list: 1 };
    return { id: 'map', text: '该出门了 —— 地图上能看见的都能去', act: 'hint-go', view: 'map' };
  };
  /* ============================================================
   * v92.244（老板：「给开局提示做连续弹窗，不要在左侧统计栏显示」）
   * ------------------------------------------------------------
   * 改前：`renderNextHint` 把"下一步"塞进侧栏一行灰底条 —— 位置在**左侧统计栏**里，
   *   玩家扫资源数字时容易直接漏过去；而且只有一句，没有前因后果（没有体系）。
   * 现在：**连续弹窗**，一步一步推，最后一步直接给「去办 →」按钮。
   *   · 只在新局第一次进游戏时弹（`state.tut` 落档，看完/跳过即记 1）；
   *   · 「继续 →」逐级推进，随时可「跳过」；
   *   · 最后一步的文案与去处仍由 `ui.nextHintOf()` 决定 —— **唯一决策源没变**，
   *     只是把"呈现"从侧栏一行换成弹窗。
   * ============================================================ */
  ui._tutIdx = 0;
  ui.tutorialSteps = function () {
    var c = GAME.currentCity();
    /* ⛔ v157.85：`pro`（是否前传）随前传退役删除；后续按 `pro` 分支的地方改走正式口径。 */
    var steps = [
      {
        t: '这颗星球，归你了',
        b: '你是这支势力的君主。<br><br>没有剧本，也没有必须走完的关卡 —— '
          + '活下去、把城立起来、把手伸到别处去。',
        n: '继续'
      },
      {
        t: '地图怎么用',
        b: '<b>左键拖动</b>　绕星球转，任意角度<br>'
          + '<b>滚轮 / 底栏缩放条</b>　拉近到贴脸，最远 50 倍星球半径<br>'
          + '<b>点地块</b>　走过去 / 打开它<br>'
          + '<b>底栏</b>　城市 · 军务 · 英雄 · 宝物 · 公文档',
        n: '继续'
      }
    ];
    /* ⛔ v157.85：原来这里按 `pro` 分两套引导（前传 = "先活着，升到 Lv20 立城"）。
       前传退役 → 只剩正式阶段这一套。 */
    {
      var h = c ? ui.nextHintOf(c) : null;
      steps.push({
        t: '接下来的第一步',
        b: h ? ('👉 ' + U.escape(h.text) + '<br><br>点「去办 →」直接跳到那一步。')
          : '先看看城里缺什么，照着提示一格一格补上。',
        n: '开始', go: !!h
      });
    }
    return steps;
  };
  ui.openTutorial = function (i) {
    var steps = ui.tutorialSteps();
    i = Math.max(0, Math.min(steps.length - 1, (i | 0) || 0));
    ui._tutIdx = i;
    var st = steps[i], last = (i === steps.length - 1);
    var dots = steps.map(function (_, k) {
      return '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 3px;'
        + 'background:' + (k === i ? 'var(--gold-light)' : 'var(--slab-1)') + ';"></span>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🧭 ' + U.escape(st.t) + '</div>'
      + '<div class="panel-body" style="line-height:1.9;">'
      + '<div style="margin-bottom:12px;">' + st.b + '</div>'
      + '<div style="text-align:center;">' + dots + '</div>'
      + '</div>'
      + '<div class="panel-foot">'
      + '<button class="btn sm" data-action="tut-skip">跳过</button>'
      + (last && st.go
        ? '<button class="btn gold" data-action="tut-go">去办 →</button>'
        : '<button class="btn gold" data-action="tut-next">' + U.escape(st.n || '继续') + ' →</button>')
      + '</div>'
    );
  };
  /* 记"已看过" —— 只落一次，之后不再弹 */
  ui.tutDone = function () {
    try { if (GAME.state) GAME.state.tut = 1; } catch (e) { }
  };
  /* 新局入口调它：已看过就什么都不做 */
  ui.maybeTutorial = function () {
    try { if (GAME.state && GAME.state.tut) return false; } catch (e) { return false; }
    ui._tutIdx = 0;
    ui.openTutorial(0);
    return true;
  };


  /* ============================================================
   * 城市操作栏（v22 · 需求 3）
   * 原先这些控件全挤在棋盘上方（征收旧币 / 显示比例 / 辖区岁贡），
   * 中央视图被压得只剩半屏。现在下沉到左侧栏 ——
   * 「看的」放中央，「操作的」放侧栏，界面才纯粹。
   * ============================================================ */
  /* v27（需求 1）：`renderCityTools` 整段删除。
     原板块仅剩"切换城市"，且只有多城时才渲染 —— 空着的时候还占一个带标题的分区。
     切城现在并进「城市属性」顶部（见 renderCityAttrs），侧栏从此只有三块：
     君主卡 / 城市属性（含切城）/ 资源与驻军。 */

  /* ============================================================
   * 侧栏驻军栏（v16 · 需求 #17 / v89.215 老板改版）
   * ------------------------------------------------------------
   * v89.215（老板）：「左侧统计栏，驻军，不再设置下拉，直接显示，直接按固定位置和顺序
   *   列出所有兵种和数量，暂无的数量则为 0」
   * ① **折叠开关整条退役**：.gb-head 不再可点（去 `data-action="toggle-garrison"`、
   *    去 ▾/▸ 箭头、去 ui._garrisonOpen 与 main.js 的 case）—— 列表常驻，只有一种形态；
   * ② 列表 = **全部兵种**，顺序唯一来源 = `DATA.TROOPS` 的声明序（18 种）——
   *    位置与顺序恒定，扫一眼就知道"哪个兵种空了"（0 的那几行灰显）；
   * ③ 空态文案（`本城暂无驻军`）随之退役：**0 行本身就是空态**（不再另占 132px 的占位块）。
   * ============================================================ */
  ui.renderGarrison = function (c, s) {
    var el = $('#garrison-bar');
    if (!el || !c) return;
    if (ui.hoverHold(el)) return;      /* v89.158：悬停保护（同资源栏） */
    /* v91.36（老板）：「驻军板块照搬城市属性和资源的 UI 和字体设置」——
       标题已移入 HTML 的 `.side-title`（与「资源」同款），此处只渲染**内容区**；
       兵力合计写进标题右侧的 `#garrison-total`（同 .side-quick 槽位）。
       行样式逐条对齐资源行（见 index.html `.gb-row`）；兵种走 2 字缩写（`ab2`）以适配 2 列窄栏。 */
    var total = 0; for (var tk in (c.army || {})) total += Math.max(0, (c.army[tk] || 0) | 0);
    var totEl = $('#garrison-total'); if (totEl) totEl.textContent = '共 ' + U.numText(total, 0);
    var body = '<div class="gb-list">' + Object.keys(DATA.TROOPS).map(function (k) {
      var t = DATA.TROOPS[k];
      var n = (c.army && c.army[k]) || 0;
      var full = t ? t.name : k;
      return '<div class="gb-row' + (n > 0 ? '' : ' gb-zero') + '" data-troop="' + k + '" title="' + U.escape(full) + '">' +
        '<span class="gb-n">' + U.escape(GAME.troopAb2Of ? GAME.troopAb2Of(k) : full) + '</span>' +
        '<span class="gb-c">' + U.numText(n, 0) + '</span></div>';
    }).join('') + '</div>';
    el.innerHTML = body;
  };

  /* v90.31（老板）：「提供一个建筑明细清单」—— 城内建筑一览（全部建筑 · 等级 · 升级造价 · 效果 · 前置）。 */
  ui.openBuildingList = function () {
    var c = GAME.currentCity();
    if (!c) { ui.toast('未选中城市'); return; }
    var ids = (DATA.BUILD_ORDER || Object.keys(DATA.BUILDINGS)).slice();
    /* 政务厅（随城自带、无 buildCost）排最前 */
    ids.sort(function (a, b2) {
      if (a === 'guanfu') return -1; if (b2 === 'guanfu') return 1;
      /* 判空不是洁癖：`BUILD_ORDER` 与 `BUILDINGS` 是两张表，
         旧存档 / 改过 id 的构建里随时可能对不上，而这里一崩就是整个建筑清单打不开。 */
      return ((DATA.BUILDINGS[a] || {}).series || '').localeCompare(((DATA.BUILDINGS[b2] || {}).series || ''));
    });
    var rows = ids.map(function (id) {
      var b = DATA.BUILDINGS[id]; if (!b) return '';
      var lv = GAME.buildingLevel(c, id);
      var cap = (GAME.buildCapOf ? GAME.buildCapOf(c, id) : (b.maxLevel || 12)) || 12;
      var next = (lv < cap && b.levelCost) ? b.levelCost(lv) : null;
      var costStr = next ? GAME.costString({ grain: next.grain, wood: next.wood, stone: next.stone, iron: next.iron }) : '—';
      var inCity = (c.cells || []).some(function (x) { return x.build && x.build.id === id; });
      var seriesZh = (DATA.SERIES && DATA.SERIES[b.series]) ? DATA.SERIES[b.series].name : (b.series || '');
      return '<tr' + (inCity ? '' : ' style="opacity:.55;"') + '>' +
        '<td><b>' + U.escape(b.name) + '</b> <span class="ui-sub">' + U.escape(seriesZh) + '</span>' +
          (inCity ? '' : ' <span class="ui-sub">（未建）</span>') + '</td>' +
        '<td class="ctr">' + lv + ' / ' + cap + '</td>' +
        '<td class="num" style="font-size:var(--fs-cap);">' + U.escape(costStr) + '</td>' +
        '<td style="font-size:var(--fs-cap);color:var(--text-dim);">' + U.escape(b.desc || '') + '</td>' +
        '</tr>';
    }).join('');
    ui.openModal('<div class="gold-heading">🏗 城内建筑明细 · ' + U.escape(c.name) + '</div>' +
      '<div class="ui-sub" style="text-align:center;margin-bottom:6px;">全部建筑 · 当前等级 / 上限 · 下一级造价 · 效果（灰显 = 本城未建）</div>' +
      '<div class="modal-scroll"><table class="tbl"><thead><tr>' +
        '<th>建筑</th><th class="ctr">等级</th><th class="num">下一级造价</th><th>效果</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
  };

  /* 城市名 + 等级标注（v29 · 需求 9）：
     [旧都] / [首府] / [重镇] / [聚落]，自建城不标（"自建城"三个字没有信息量）。 */
  ui.cityLabelHTML = function (c, short) {
    if (!c) return '';
    var tn = GAME.cityTierName ? GAME.cityTierName(c) : '';
    /* v70（老板）：地名走**全称**（区 · 镇 · 城名，唯一出口 GAME.cityFullName）。
       v71（老板）：「城市属性不要显示坐标和所在区，只显示城市命名即可」——
       窄处（侧栏）传 short=true 走**短名**：城名 + 档位标，与 GAME.cityLabel 同规则；
       全称仍供统计表格 / 出征目标等需要"这是哪一区的城"的地方使用。 */
    var name = short ? U.escape(c.name) : U.escape(GAME.cityFullName(c));
    /* v79（老板）：「主城名称后有【主城】标识」—— 全站走这一个出口 */
    var mt = (GAME.isMainCity && GAME.isMainCity(c)) ? '<span class="city-tier mt">主城</span>' : '';
    return name + (tn ? '<span class="city-tier">[' + tn + ']</span>' : '') + mt;
  };

  /* ② 城市属性栏：民心/民怨/税率/旧币/幸存者 */
  ui.renderCityAttrs = function (c, s) {
    var box = $('#city-attrs');
    if (!box) return;
    /* v89.158：悬停保护 —— 城市下拉/🎲📍 按钮/属性行的悬停态不被每秒重绘打断 */
    if (ui.hoverHold(box)) return;
    /* v89.185（老板 6）：「实际幸存者上限=幸存者上限*民心/100」——
       幸存者行一律显示**有效上限**（民心折算）；基准值在悬停里给出对照。 */
    var maxPopBase185 = GAME.maxPopOf(c);
    var maxPop = GAME.effPopCapOf(c);
    /* v89.204（老板 1）：民心显示走**城级**（含战争创伤）—— 全局基准见 heartsOf */
    var hearts = Math.round(GAME.cityHeartsOf ? GAME.cityHeartsOf(c) : (s.hearts || 100));
    var minyuan = Math.max(0, 100 - hearts);
    var _hWar204 = (GAME.heartsWarOf ? GAME.heartsWarOf(c) : 0);
    var _hTip204 = _hWar204 > 0
      ? ' title="民心 = 基准 ' + Math.round(GAME.heartsOf()) + ' − 战争创伤 ' + Math.round(_hWar204)
        + '（每现实日恢复 ' + (((DATA.SIEGE || {}).repairPerDay) || 0) + '）"'
      : '';
    /* v27（需求 1）：多城时的「切换城市」并入本栏顶部 ——
       它本来就是"这座城的属性"的一部分（换城就是换一整套属性）。
       单城时不渲染，省一行高度。
       v45（需求 3）：由 chips 改为**原生下拉框** ——
       城市数会随进程不断增长，chips 在窄侧栏里折行会把城市属性挤下去；
       下拉框恒定一行，且"我有哪些城"一眼看全。 */
    /* v71（老板）：「即使只有一个城市，也保留这个城市下拉框…」
       v91.28（老板）：**城市管理 / 地图管理解耦** —— 侧栏星球下拉只切"看哪个星球的城"
       （本地筛选 `ui._swPlanetId`），**不** enterPlanet、**不**重建球面、**不**动地图
       （避免切换星球耗资源换后台星球）。只有从**别的星球选城**才 enterPlanet（且地图保持）。 */
    var _actPid = s.activePlanet || 0;
    var _planets = GAME.planetsOf ? GAME.planetsOf() : [];
    var _swPid = ui._swPlanetId;
    /* 星球清单变了（新增/删）→ 复位到当前星球 */
    var _pIds = _planets.map(function (p) { return p.id; }).join(',');
    if (ui._swPids !== _pIds) { ui._swPids = _pIds; _swPid = null; }
    if (_swPid == null || !_planets.some(function (p) { return p.id === _swPid; })) _swPid = ui._swPlanetId = _actPid;
    /* 该"查看星球"的城清单：当前星球走 s.cities（活态），他星走分片快照。 */
    var _swCities = (+_swPid === +_actPid) ? s.cities
      : (((GAME.sliceOf && GAME.sliceOf(_swPid)) || {}).cities || []);
    var planetSel = _planets.length > 1
      ? '<div class="city-switch"><span class="cs-lbl">星球</span>' +
        '<select class="city-select" data-action="switch-planet" title="切换查看的星球（只影响本栏城市清单，不改变地图）">' +
        _planets.map(function (p) {
          return '<option value="' + p.id + '"' + (+p.id === +_swPid ? ' selected' : '') + '>' +
            U.escape(p.name || ('星球 ' + p.id)) + '</option>';
        }).join('') + '</select></div>'
      : '';
    var switcher = planetSel +
      '<div class="city-switch"><span class="cs-lbl">城市</span>' +
      '<select class="city-select" data-action="switch-city" title="切换当前经营的城市">' +
      (_swCities.length ? _swCities.map(function (x) {
        return '<option value="' + x.id + '" data-pid="' + _swPid + '"' + (x.id === c.id ? ' selected' : '') + '>' +
          U.escape(x.name || '城')
          + ((GAME.isMainCity && GAME.isMainCity(x)) ? '【主城】' : '')
          + '</option>';
      }).join('') : '<option value="">（该星球暂无城市）</option>') +
      '</select></div>';
    /* v53（老板："点出来列表马上收回去了"）：**城市清单必须与每秒重绘解耦**。
       主循环每秒调一次 renderSide → renderCityAttrs，改前 switcher 拼在下面的 html 里，
       `box.innerHTML = html` 会把 <select> 整块销毁重建 ——
       原生下拉列表挂在那个元素上，元素一没、列表立刻合上，根本来不及选。
       （还有一处：点 select 展开时那个 click 会被共用委托 dispatch 掉，同样触发重绘；
        已在 main.js 的 click 委托里对 SELECT 直接放行。）
       现在它走**自己的静态节点** #city-switch-host，只在
       "城市清单或当前城市变了"时才重建；城市属性正文照旧每帧重建（正文没有交互态）。 */
    /* v91.34（老板）：城市名行 = 城市名 + 右侧按键组 ——
       🎲 一键随机 / 📍 迁址 / 🏗 建筑清单**从「城市」下拉行右移入城市属性**（城名右侧 · 一键右对齐）。
       名城（地望固定、不可迁址）只出「建筑清单」。 */
    var _curNameEl = $('#city-cur-name');
    if (_curNameEl) {
      /* v91.57（老板）：去前边小图标 · 去「星球N·」星球前缀（只显示城名本身）· 字号收小。 */
      var _cname = (c.name || '城').replace(/^[^·]*·/, '');
      _curNameEl.innerHTML =
        '<span class="ccn-name">' + U.escape(_cname) + '</span>' +
        '<span class="ccn-ops">' +
          (GAME.isMovableCity(c)
            ? '<button class="btn sm" data-action="city-random" title="一键随机：迁到一处空闲平原">🎲</button>' +
              '<button class="btn sm" data-action="city-move-ask" title="迁址：输入格索引 ci">📍</button>'
            : '') +
          '<button class="btn sm" data-action="open-bldg-list" title="城内建筑明细清单（全部建筑 · 等级 · 造价 · 效果）">🏗</button>' +
        '</span>';
    }
    var host = $('#city-switch-host');
    /* v71（老板）：选项文案含城名 / 坐标 —— 签名跟着文案走，
       改名、迁址后下一帧即刷新；否则下拉框会停在旧文案上。 */
    var sig = _swCities.map(function (x) {
      return x.id + ':' + (x.name || '') + ':' + x.ci;
    }).join(',') + '|' + c.id + '|' + (s.mainCityId || '') + '|' + _swPid;   /* v91.28：查看星球也进签名 */
    if (host) {
      if (ui._citySwSig !== sig) {         /* 没变 → 一个字节都不碰这个 select */
        ui._citySwSig = sig;
        host.innerHTML = switcher;
      }
    } else if (switcher) {
      /* 节点缺失只可能是 index.html 被改坏 —— 不许静默 */
      if (typeof console !== 'undefined') console.warn('renderCityAttrs: 缺少 #city-switch-host，城市清单未渲染');
    }
    var html = '' +
      /* v91.25（老板）：城市身份行**删除** —— 城名已在「城市」下拉框显示、🎲/📍/🏗 已并入下拉行，
         此处展示重复。城市属性正文直接从「民心 / 民怨」开始。 */
      /* v26（需求 3）：天时已移到顶栏 —— 它是全局信息，不该占城市属性的位置 */
      /* v28（需求 3）：民心与民怨合并成一行「xx / xx」——
         两者本是同一枚硬币（民怨 = 100 − 民心），各占一行纯粹浪费侧栏高度。 */
      /* v89.128（老板）：「民心/税率/幸存者前边的小图标去掉」 */
      '<div class="res-line"><span class="lbl">民心 / 民怨</span><span class="val"' + _hTip204 + '>' +
        '<b style="color:' + (hearts > 60 ? 'var(--green-ok)' : hearts > 30 ? '#e6a400' : 'var(--red-light)') + ';font-variant-numeric:tabular-nums;">' + hearts + '</b>' +
        ' <span style="color:var(--text-dim);">/</span> ' +
        '<span style="font-variant-numeric:tabular-nums;">' + minyuan + '</span></span></div>' +
      /* v89.104（老板）：「税率调整直接放左侧统计栏的税率处，将目前的数值显示
         改成可调节的税率数值」—— 就地点 −/＋（步长 5%，0~100%），值走 GAME.doSetTax。 */
      '<div class="res-line"><span class="lbl">税率</span><span class="val">' +
        /* v89.128（老板）：「可点击的功能按钮参考资源那里的按钮，统一图标风格大小和颜色」 */
        '<span class="plus-btn" data-action="tax-step" data-d="-5" title="税率 −5%">−</span>' +
        '<b style="font-variant-numeric:tabular-nums;margin:0 6px;">' + Math.round((s.tax || 0) * 100) + '%</b>' +
        '<span class="plus-btn" data-action="tax-step" data-d="5" title="税率 +5%">＋</span>' +
      '</span></div>' +
      /* v20（需求 5/12）：旧币存量、税收速率、可征幸存者**全部去掉** ——
         · 旧币与资源栏重复
         · 税收（旧币/时）数值不准且与资源栏的 /秒 增速口径不一致，删掉避免误导
         · 可征幸存者 信息密度低，需要时在幸存者统计面板看 */
      /* v89.124（老板「幸存者增速也按小时显示。界面规划参考资源」）：
         幸存者行补**增速列**（/时），排版对齐资源行三列（名称 | 存量·上限 | 增速）——
         增速走唯一出口 GAME.popGrowthOf（**现实每小时**口径 v89.126，无需换算）；
         已到上限显示 +0/时（与 tickOnce 的"超上限不增长"同判据）；
         悬停给增速来源分解（与募兵面板 pop-3 同一份 popSourcesOf）。 */
      (function () {
        var popNow = Math.floor(s.res.pop || 0);
        /* ============================================================
         * v157.14（老板「增长速度似乎存在问题」）—— 这里原来有 `Math.floor`：
         * 增速 < 1 人/时的城会被截成 0，界面显示「+0/时」而实际在涨
         * （小城 / 民心被压到很低时很常见）。增速直接传原值，
         * 由 U.perHourText 统一决定档位（<10 保留 1 位小数）。
         * ============================================================ */
        var growRaw = GAME.popGrowthOf(c);
        var grow = (popNow >= maxPop) ? 0 : growRaw;
        var popSrc = '';
        try {
          (GAME.popSourcesOf(c) || []).forEach(function (x) {
            if (Math.abs(x.v) > 1e-9) popSrc += '　· ' + x.name + ' ' + (x.v > 0 ? '+' : '') + Math.round(x.v * 100) + '%';
          });
        } catch (e) {}
        /* v89.126：补满预计（现实时间）—— "固定时间速率"的可读化 */
        var popEta = (popNow < maxPop && grow > 0)
          ? '\n约 ' + U.dur((maxPop - popNow) / (grow / 3600)) + '后补满（现实时间）' : '';
        /* v89.128（老板）：「悬停显示"建筑幸存者/上限幸存者"，建筑幸存者就是各建筑固定占据的
           幸存者数，这部分幸存者不可征兵」—— 劳作占用的**展示名**定为"建筑幸存者"。 */
        var popLab = GAME.popLaborOf(c);
        var popLabLine = '\n建筑幸存者 ' + U.fmt(popLab) + ' / 上限幸存者 ' + U.numText(maxPop, 0)
          + '（民心 ' + hearts + '% 折算 · 基准 ' + U.numText(maxPopBase185, 0) + '）'
          + '\n（建筑幸存者为各建筑固定占用，不可征兵）';
        return '<div class="res-line pop-line"><span class="lbl">幸存者</span><span class="val">' +
          /* v89.128（老板）：「幸存者只显示当前幸存者数，不显示上限，节约空间」——
             上限迁入悬停（与建筑幸存者合并给）。
             ⚠️ 存量仍是**一个** .amt 块（裸文本会变独立网格项、把后续列顶错位）。 */
          '<span class="amt">' + U.numHTML(popNow, 0) + '</span>' +
          '<span class="rate-wrap" data-tip="幸存者增势（现实时间：基准 ' + ((DATA.POP_CFG || {}).fillHours || 2)
            + ' 小时补满）：居所上限决定速率' + popSrc + popEta + popLabLine +
            (popNow >= maxPop ? '\n已到上限 —— 不再增长（建/升居所可提上限 · 或安民抬民心）' : '') + '">' +
          '<span class="num-rate' + (grow > 0 ? '' : ' zero') + '">+' + U.perHourText(grow) + '/时</span>' +
          '</span>' +
          /* v89.128（老板）：「幸存者增速这里加个类似资源增速的加号按钮，用于使用相关道具
             （不要显示现有道具数量）」——与资源 "+" 同款（plus-btn）。 */
          '<span class="plus-btn" data-action="quick-pop" title="使用幸存者道具（招揽令 / 迁入令）">+</span>' +
          '</span></div>';
      })() +
      /* v24（需求 6）：再删两行 ——
         · 「🧱 城防 · 驻军」：驻军栏就在正下方（含兵种与耗粮），城防在「统计」页；
         · 「🌾 城外地块」：城外视图的棋盘本身就是这块数据，重复且挤。
         侧栏从此只留下"本城当下最该一眼看到"的几项。 */
      /* v89.36：断粮警示随军粮维持退役（军队不再吃粮，不存在"粮尽"状态）。 */
      /* ============================================================
       * v89.107（老板）：「左侧统计栏的警报警报（含策略布防）放到军务中，
       *   与出征防守等并列」—— 原先挂在这里的两块**整体搬走**：
       *     · 警报预警横幅（本段 IIFE）      → 军务 · 警报页「① 预警」
       *     · `ui.citySchemeHTML` 计略布防行 → 军务 · 警报页「② 策略布防」
       *   搬走的原因：预警与布防都是**军事决策**，与出征/防守同一层；
       *   留在左侧栏会让它和"幸存者/税率"这类本城日常挤在一起，也看不见别城。
       *   两个出口（invasionDueAt / defensePowerOf）的界面消费点改在
       *   `ui.marchBeaconHTML`，删这里不会让 audit 报死函数。
       * ============================================================ */
      '';
    box.innerHTML = html;
  };

})();
