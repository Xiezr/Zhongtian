/* ============================================================
 * ui-exped.js　出征 · 城内布局 / 统一出征面板 / 计略 / 方案 / 辎重 / 战前推演
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
   * 满配城的城内布局（v61 · 老板）
   * ------------------------------------------------------------
   * 老板：「野地里的城市，应默认其建筑全都建满了，城内所有建筑各1个，
   *   兵营2个，其他建居所，位置也相对固定一下」。
   * 规则本身在 `DATA.CITY_PLAN` / `GAME.cityPlanOf`（唯一出口），这里只管呈现 ——
   * **野外城市与未占据名城共用这一份**，免得两处各写一遍数字对不上。
   * ⚠️ 这是"当前事实"（这城里有什么），不是"怎么运作"，所以留在正文而不进 ui.help。
   * ============================================================ */
  ui.planHTML = function (p) {
    if (!p) return '';
    var names = p.items.map(function (it) {
      return it.name + (it.n > 1 ? ' ×' + it.n : '');
    }).join(' · ');
    return '<div class="plan-box">' +
      '<div class="attr"><span class="k">城内建筑</span><span class="v plan-v">' + names +
        '　<span class="plan-dim">（皆 Lv' + p.level + '）</span></span></div>' +
      '<div class="attr"><span class="k">居所 / 围墙</span><span class="v plan-v">居所 ×' + p.minfang +
        ' Lv' + p.level + '　围墙 Lv' + p.wallLv + '<span class="plan-dim">（占城内 1 格）</span></span></div>' +
      '<div class="attr"><span class="k">地块 / 幸存者</span><span class="v plan-v">' +
        p.col + ' × ' + p.row + ' = ' + p.total + ' 格　幸存者上限 ' + U.numText(p.popCap, 0) +
        '　城防 ' + p.def + '</span></div>' +
      '</div>';
  };

  ui.openFortModal = function (f) {
    ui._fortTarget = f;
    ui._expMode = 'occupy';      /* v89.58：打开目标弹窗时方式复位（与 openLandModal 一致） */
    var s = GAME.state;
    var g = GAME.map.fortGarrison(f.level), gNum = 0, parts = [];
    for (var k in g) { gNum += g[k]; if (g[k] > 0) parts.push((DATA.TROOPS[k] ? DATA.TROOPS[k].name : k) + ' ' + U.fmt(g[k])); }
    var c = GAME.currentCity();
    var dist = GAME.cityDist(c, f);
    /* v89.193（老板 2）：本城前哨占用（每城上限 5 —— 满员时"拔除并收为前哨"受阻提示） */
    var _fn193 = GAME.fortsOfCity(c).length;
    var _fm193 = (DATA.FORT_AURA || {}).maxPerCity || 5;
    var _full193 = _fn193 >= _fm193;
    /* v61：城内布局（老板要求"默认建筑全满"）—— 打完能拿到什么，先摆出来 */
    var plan = GAME.fortPlanOf(f);
    /* v63（老板）：「野外城每天只能被掠夺一次」——先在这里说清楚，
       否则玩家点掠夺被拦下来会以为功能坏了（真正的拦截在 battle.prepare）。 */
    var raided = GAME.map.fortRaidedToday && GAME.map.fortRaidedToday(f.ci);
    /* ⛔ v89.186（老板 3）退役：领地上限判据（cc108f）—— 据点剥离后占据=我方前哨，
       **不转城市、不占城市名额** → 领地闸与本面板无关（旧 v89.108 的"置灰"随之退役）。 */
    ui.openModal(
      '<div class="gold-heading">🏕️ 野外城市 · ' + U.escape(GAME.fortLabelOf(f)) + ' Lv' + f.level + '</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' + gNum.toLocaleString() + ' 名 · 距主城 ' + dist + ' 格</div>' +
      ui.planHTML(plan) +
      '<div class="note">守军：' + parts.join('　') + '<br>' +
        '据点等级<b style="color:var(--gold-light)">每日变化</b>，位置固定；城内建筑按等级<b>建满</b>（军营两座，其余为居所）。掠夺可获厚利（材料、资源、珠宝），据点次日重置。<br>' +
        (raided
          ? '<b style="color:var(--red-light);">今日已掠夺此据点 —— 每处每日限一次，明日可再来。</b><br>'
          : '掠夺<b>每日每处限一次</b>（得手才计数）。<br>') +
        '可采材料（一阶）：粗铁 · 松木 · 生皮 · 兽筋 · 碎晶 · 帆布</div>' +
      '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
        '<button class="btn gold" data-action="fort-exp" data-mode="scout">🔭 侦查</button>' +
        '<button class="btn gold" data-action="fort-exp" data-mode="raid">🔥 掠夺</button>' +
        /* v89.186（老板 3）：据点剥离 —— 占领 = 拔除并收为「我方前哨」（不转城市、不占名额）。
           （旧 v89.103「拔除并占据 = 就地转城」文案退役。）
           v89.193（老板 2）：每城上限 5 —— 满员时按"受阻"形态（可点弹原因，v89.189 机制）。 */
        (_full193
          ? '<button class="btn gold" data-action="fort-exp" data-mode="occupy" disabled data-why="「' + U.escape(c.name) +
            '」的前哨已满（' + _fm193 + ' 处）：先放手一处，或从其他城市出征">🚩 拔除并收为前哨</button>'
          : '<button class="btn gold" data-action="fort-exp" data-mode="occupy">🚩 拔除并收为前哨</button>') +
        '<button class="btn" data-action="close-modal">取消</button></div>' +
      '<div class="op-hint" style="text-align:center;margin-top:6px;">🚩 <b>拔除并收为前哨</b>：围攻夺其民心（胜者每战 −20）→ 民心一尽即归我（不转城市、不占城市名额）· 本城前哨 <b>'
        + _fn193 + '/' + _fm193 + '</b>（每城上限 ' + _fm193 + '）——辐射 6~14 格（随据点等级）内野地：衰减减半 / 采集增产 / 驻军上限加成 / 情报 / 商税（均随等级）</div>'
    );
  };

  /* 已探明的野外城市一览（视口范围） */
  ui.openForts = function () {
    var v = GAME.map._view || { vx: 0, vy: 0, span: 12 };
    var list = GAME.map.fortsInView();
    var s = GAME.state;
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    var razed = Object.keys(s.fortsRazed || {}).filter(function (k) { return s.fortsRazed[k] === day; });
    var raided = Object.keys(s.fortRaids || {}).filter(function (k) { return s.fortRaids[k] === day; });
    var html = '<div class="gold-heading">🏕️ 周边野外城市（' + list.length + ' 座）</div>';
    html += '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:8px;">' +
      '范围 (' + v.vx + ',' + v.vy + ') — (' + (v.vx + v.span - 1) + ',' + (v.vy + v.span - 1) + ')　' +
      '全图密度约 1/12（每 12×12 约 12 座）　今日已攻取 ' + razed.length + ' 处 · 今日已掠夺 ' + raided.length + ' 处</div>';
    if (!list.length) {
      html += '<div class="q-empty">本视野内暂无野外城市，可用坐标框移动观察框后再看。</div>';
    } else {
      /* v63：加「地块」列 —— 老板问「现在都是32格的吧，没看懂」，
         格数档位是这轮刚统一的规则，那就该在列表里直接看得见（每两级一档）。
         ⚠️ 同时改成**分页**：列一多、行一多，整块面板就会超出弹窗高度 →
         弹窗内冒出滚动条（老板明令禁止：「弹窗内禁止下拉条，一律分页」）。
         几何探针实测：不分页在 1600×950 超 108px、720p 超 256px；
         8 行/页在 720p 仍超 44px（矮屏弹窗本身就矮）→ 定 6 行/页，三种分辨率全部不超。 */
      var rowList = list.sort(function (a, b) { return a.level - b.level; }).map(function (f) {
        var gg = GAME.map.fortGarrison(f.level), num = 0;
        for (var k in gg) num += gg[k];
        var fp = GAME.fortPlanOf(f);
        var st = GAME.map.fortRaidedToday(f.ci)
          ? '<span style="color:var(--red-light);">今日已掠夺</span>' : '<span style="color:var(--green-ok);">可掠夺</span>';
        return '<tr><td>' + U.escape(f.name) + '</td><td class="ctr">' + f.x + ',' + f.y + '</td>' +
          '<td class="ctr">Lv' + f.level + '</td>' +
          '<td class="ctr">' + fp.col + '×' + fp.row + '（' + fp.total + ' 格）</td>' +
          '<td class="ctr">' + U.fmt(num) + '</td>' +
          '<td class="ctr">' + st + '</td>' +
          '<td class="ctr"><button class="btn sm" data-action="fort-goto" data-x="' + f.x + '" data-y="' + f.y + '">定位</button> ' +
          '<button class="btn sm gold" data-action="fort-pick" data-x="' + f.x + '" data-y="' + f.y + '">出兵</button></td></tr>';
      });
      var pgF = ui.modalPage('forts', rowList, 6, function () { ui.openForts(); });
      html += '<table class="tbl"><thead><tr><th>名称</th><th>坐标</th><th>等级</th><th>地块</th><th>守军</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        pgF.slice.join('') + '</tbody></table>' + pgF.pager;
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* ============================================================
   * 统一出征面板（侦查 / 掠夺 / 占领）
   * ============================================================ */
  /* v63（老板：「野外城每天只能被掠夺一次」）：出征方式的**可选项锁定**判据。
     唯一出口 —— 界面提示与真正的拦截（`GAME.battle.prepare`）说明同一件事，
     免得"按钮能点但打了被拒"或"按钮灰了却不知道为什么"。
     返回 '' 表示可用，否则返回原因。 */
  /* v91.76（老板「到达性限制由目标决定、出发性限制由派出城决定」）——
     **方式可用性唯一出口**：目标侧 + 派出城侧 + 兵力/英雄前置，一次性给出原因。
     界面下拉置灰与执行端（battle.prepare）同源；不适用 = 置灰，不再隐藏。 */
  ui.expModeAvailOf = function (modeId) {
    var tg = ui._expTarget, t = ui._expRes;
    var from = ui.expFromCity();
    if (!t || !from) return '无目标或派出城';
    var m = GAME.battle.modeOf(modeId);
    if (tg && tg.kind === 'wonder') {
      if (modeId !== 'explore') return '奇观只能探索';
      var wd = GAME.wonderOf ? GAME.wonderOf(t.pid) : null;
      if (!wd) return '该星球无奇观';
      if (!GAME.wonderPresent(t.pid)) return '今日奇观未出现';
      if (GAME.wonderActiveCount(t.pid) >= ((DATA.WONDER_CFG || {}).maxActive || 3)) return '奇观探查队已满';
      return '';
    }
    if (modeId === 'explore') return '仅奇观可用';
    if (modeId === 'dispatch' || modeId === 'transport') {
      if (t.kind !== 'owncity') return '仅对己方城市';
      if (t.city && t.city.id === from.id) return '目标即派出城';
      /* v91.76：可选中本身只由目标决定；兵力需求在**确认时**校验（否则先选方式后填兵会被锁死）。 */
      return '';
    }
    if (t.kind === 'owncity') return '己方城市只能派遣/运输';
    if (modeId === 'station') {
      if (!(t.kind === 'wild' && GAME.map.wildAt(t.ci, t.pid))) return '仅对己方野地';
      return '';   /* 无将派驻的后果在摘要/确认时提示（驻军不可采集） */
    }
    if (modeId === 'scout' || modeId === 'raid' || modeId === 'occupy') {
      if (t.kind === 'wild' && GAME.map.wildAt(t.ci, t.pid)) return '己方野地不接战（改用驻守）';
      if (t.kind !== 'wild' && t.kind !== 'fort' && t.kind !== 'city') return '该目标不可' + m.name;
      return ui.expModeLockOf(modeId);   /* 领地上限 / 据点每日掠夺 */
    }
    return '';
  };

  ui.expModeLockOf = function (modeId) {
    var tg = ui._expTarget;
    /* v89.108（老板）：领地上限 —— 占城 / 拔除据点都会产出一座新城，
       到顶时在**方式下拉框**里直接置灰 + 写明原因（与 battle.prepare 的硬闸同一判据）。 */
    if (modeId === 'occupy' && tg && (tg.kind === 'city' || tg.kind === 'fort')) {
      var cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
      if (!cc108.ok) return cc108.msg;
    }
    if (!tg || modeId !== 'raid' || tg.kind !== 'fort') return '';
    if (!(GAME.map && GAME.map.fortRaidedToday)) return '';
    return GAME.map.fortRaidedToday(tg.ci) ? '此据点今日已掠夺（每日限一次）' : '';
  };

  /* ============================================================
   * v86（老板「按计划进行」· G1）：计略选择（出征面板）
   * ------------------------------------------------------------
   * attack/march 计随出征携带（校验不通过给原因；含每日锁）；
   * defense 计在「城市面板 → 布防计略」单独布防（见 ui.openCityScheme）。
   * ============================================================ */
  ui._expScheme = null;
  ui.expSchemeLabel = function () {
    var sid = ui._expScheme;
    if (!sid) return '未用计';
    var sc = GAME.schemeOf(sid);
    return sc ? (sc.icon + ' ' + sc.name + '（精' + sc.energy + ' · 囊' + sc.jinang + '）') : '未用计';
  };
  ui.setExpSchemeLabel = function () {
    var lb = $('#exp-scheme-label');
    if (lb) lb.textContent = ui.expSchemeLabel();
  };
  ui.expSchemeGenOf = function () {
    var s = GAME.state, gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === ui._expGen) gen = g; });
    return gen;
  };
  ui.expSchemePanelHTML = function () {
    var s = GAME.state;
    var t = ui._expRes;
    if (!t) return '';
    var gen = ui.expSchemeGenOf();
    var list = (DATA.SCHEMES || []).filter(function (sc) { return sc.kind === 'attack' || sc.kind === 'march'; });
    return list.map(function (sc) {
      var chk = GAME.schemePrepare(sc.id, t, gen);
      var on = ui._expScheme === sc.id;
      var extra = '';
      if (sc.id === 'tiaobo' && t.npc) {
        var n = GAME.schemeMarksOf(GAME.schemeKeyOf(t), 'tiaobo');
        extra = '　<b style="color:var(--gold-light);font-weight:400;">该城守将忠诚 ' + Math.max(0, 100 - 25 * n) + '</b>';
      }
      var btn = chk.ok
        ? '<button class="btn sm' + (on ? '' : ' gold') + '" data-action="exp-scheme-pick" data-v="' + sc.id + '">' + (on ? '撤下' : '选择') + '</button>'
        : '<button class="btn sm" disabled title="' + U.escape(chk.msg) + '">不可用</button>';
      return '<div class="inn-card" style="margin-bottom:6px;"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">' + sc.icon + ' ' + sc.name +
          '　<span style="color:var(--text-dim);font-size:var(--fs-sub);">精' + sc.energy + ' · 囊' + sc.jinang + '</span>' +
          (on ? '　<span style="color:var(--green-ok);">已选</span>' : '') + extra + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);">' + U.escape(sc.tip) + '</div>' +
        (chk.ok ? '' : '<div style="color:var(--red-light);font-size:var(--fs-sub);margin-top:2px;">' + U.escape(chk.msg) + '</div>') +
        '</div>' + btn + '</div>';
    }).join('');
  };
  /* 面板内展开/收起（不用子弹窗：弹窗是单根系统，切换会丢出征面板） */
  ui.toggleExpScheme = function () {
    var box = $('#exp-scheme-box');
    if (!box) return;
    if (box.classList.contains('hidden')) {
      box.innerHTML = ui.expSchemePanelHTML();
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  };
  /* 布防计略（城市面板）——防御计布在自己城上，持续期内自动生效 */
  ui._csGen = null;
  ui.openCityScheme = function () {
    var c = GAME.currentCity();
    var s = GAME.state;
    var now = (s.world && s.world.elapsed) || 0;
    var ja = (s.items && s.items.jinang) || 0;
    var own = (s.generals || []).filter(function (g) { return g.cityId === c.id; });
    if (!ui._csGen || !own.some(function (g) { return g.id === ui._csGen; })) {
      ui._csGen = own[0] ? own[0].id : '';
    }
    var list = (DATA.SCHEMES || []).filter(function (sc) { return sc.kind === 'defense'; });
    var rows = list.map(function (sc) {
      var act = GAME.schemeDefOf(c, sc.id, now);
      var btn = act
        ? '<span style="color:var(--green-ok);white-space:nowrap;">布防中（余 ' + Math.ceil(act.left / 3600) + ' 时）</span>'
        : '<button class="btn sm gold" data-action="city-scheme-pick" data-v="' + sc.id + '">布防</button>';
      return '<div class="inn-card"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">' + sc.icon + ' ' + sc.name +
          '　<span style="color:var(--text-dim);font-size:var(--fs-sub);">精' + sc.energy + ' · 囊' + sc.jinang + '</span></div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);">' + U.escape(sc.tip) + '</div>' +
        '</div>' + btn + '</div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🎴 布防计略 · ' + U.escape(c.name) + '</div>' +
      '<div class="note">防御计布防于本城，持续期内自动生效。封存匣现有 <b>' + ja + '</b> 个。' +
        '<button class="btn xs" data-action="qb-item" data-item="jinang" data-need="1" style="margin-left:6px;">🛒 购封存匣</button></div>' +
      '<div class="mk-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;">' +
        '<label style="color:var(--text-dim);">施计英雄</label>' +
        '<input type="hidden" id="cs-gen" value="' + ui._csGen + '">' +
        ui.genChips({ cls: 'gen-chips inline', target: 'cs-gen', value: ui._csGen, list: own,
          sub: function (g) { return '精' + Math.round(g.energy || 0); } }) +
      '</div>' +
      rows +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
  };
  ui.doExpSchemePick = function (sid) {
    ui._expScheme = (ui._expScheme === sid) ? null : sid;   /* 再点一次 = 撤下 */
    ui.setExpSchemeLabel();
    var box = $('#exp-scheme-box');
    if (box) box.innerHTML = ui.expSchemePanelHTML();       /* 原地刷新（面板不丢） */
    var sel = document.getElementById('exp-scheme-sel');    /* v89.57：同步下拉框 */
    if (sel) sel.value = ui._expScheme || '';
  };
  ui.doCitySchemePick = function (sid) {
    var c = GAME.currentCity();
    var sc = GAME.schemeOf(sid);
    var s = GAME.state;
    var gsel = document.getElementById('cs-gen');
    var gid = gsel ? gsel.value : ui._csGen;
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === gid) gen = g; });
    if (!sc) return;
    if (!gen) { ui.toast('请选择施计英雄'); return; }
    if ((gen.energy || 0) < sc.energy) { ui.toast(gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + sc.energy + '），可服提神剂'); return; }
    if (((s.items || {}).jinang || 0) < sc.jinang) { ui.toast('封存匣不足（' + ((s.items || {}).jinang || 0) + '/' + sc.jinang + '），可点「🛒 购封存匣」就地购买'); return; }
    GAME.schemeDefSet(c, sc.id, gen);
    ui._csGen = gen.id;
    ui.closeModal();
    ui.toast('已布防「' + sc.name + '」');
    GAME.refreshAll();
  };

  /* v89.52：出征面板的「可用道具」实时条；v89.198（老板 4/6）修订 ——
     · 「封存匣 ×N」数量备注**退役**（老板 6）；
     · 「精力 / 体力」读数**移入主将栏**（#exp-gen-vital，选定主将后显示，老板 4）；
     本函数只管两件事：主将读数行 + 可对主将使用的道具下拉。 */
  ui.refreshExpItems = function () {
    var vital = document.getElementById('exp-gen-vital');
    var sel = document.getElementById('exp-item-sel');
    if (!vital && !sel) return;
    var s = GAME.state;
    var genEl = document.getElementById('exp-gen');
    var gid = (genEl && genEl.value) || ui._expGen || '';
    if (!gid) { if (vital) vital.innerHTML = '<span style="opacity:.75;">未派将（派遣/运输/派驻可不带将）</span>'; }
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === gid) gen = g; });
    if (vital) {
      vital.innerHTML = gen
        ? ('<b>精力</b> ' + Math.round(gen.energy || 0) + '　·　<b>体力</b> '
          + Math.round(GAME.staNow(gen)) + '/' + Math.round(GAME.staMax(gen)))
        : '';
    }
    if (sel) {
      var pills = (DATA.ITEMS || []).filter(function (it) {
        return it.type === 'stamina' && (s.items && s.items[it.id] > 0);
      });
      var keep = sel.value;
      sel.innerHTML = '<option value="">' + (pills.length ? '（选择道具）' : '（无可用道具）') + '</option>' +
        pills.map(function (it) {
          return '<option value="' + it.id + '">' + U.escape(it.name) + ' ×' + s.items[it.id] + '</option>';
        }).join('');
      /* 保持已选项（数量变了仍在）；被用光的项自然消失 → 回落空 */
      if (keep && pills.some(function (it) { return it.id === keep; })) sel.value = keep;
    }
  };

  /* ============================================================
   * v89.57（老板「出征界面多选项尽量用下拉框」）—— 真实出征决策的接线口
   * ------------------------------------------------------------
   * 全部复用既有机制，不新建规则（本项目铁律：写进界面而无消费 = 死数据）：
   *   · 目标候选   → GAME.battle.resolveTarget（城 / 据点 / 野地同一出口）
   *   · 全体站位   → DATA.STANCES + GAME.setTactic / clearTactics（前进 / 防御 / 后退）
   *   · 计略       → DATA.SCHEMES + GAME.schemePrepare（沿用 #exp-scheme-label 与详情面板）
   * ============================================================ */
  ui._expTargets = [];
  /* v89.59（老板需求 1/3）：目标候选三类 ——
     · 当前目标（置顶）
     · **自身城市**（城市间操作：派驻 / 运输）
     · **同一镇下的普通城市**（聚落 / 重镇；不含名城 首府·旧都）+ 附近野外据点
     普通城市按老板要求**在标签上显示等级**。 */
  ui.expTargetCandidates = function (city, cur) {
    var s = GAME.state, list = [], seen = {};
    function push(tg, d) {
      var key = tg.kind + ':' + (tg.id != null ? tg.id : (tg.x + ',' + tg.y));
      if (seen[key]) return; seen[key] = 1;
      list.push({ tg: tg, d: d == null ? 0 : d });
    }
    if (cur) push(cur, -1);                       /* 当前目标永远置顶 */
    if (city) {
      var rg0 = GAME.regionOf ? GAME.regionOf(city.x, city.y) : null;
      var myCounty = (rg0 && rg0.countyCity) ? rg0.countyCity.id : null;
      /* ① 自身城市（城市间操作入口） */
      (s.cities || []).forEach(function (mc) {
        if (mc.id === city.id) return;
        push({ kind: 'own', id: mc.id }, GAME.cityDist(mc, city));
      });
      /* ② 同一聚落下的普通城市（聚落 / 重镇；名城首府·旧都排除） */
      (s.map.cities || []).forEach(function (nc) {
        if (nc.type === 'zhou' || nc.type === 'capital') return;
        var rgc = GAME.regionOf ? GAME.regionOf(nc.x, nc.y) : null;
        var cid = (rgc && rgc.countyCity) ? rgc.countyCity.id : null;
        if (myCounty != null && cid != null && cid !== myCounty) return;   /* 不同聚落 → 不列 */
        push({ kind: 'city', id: nc.id, npc: nc }, GAME.cityDist(nc, city));
      });
      /* ③ 附近野外据点（原有能力保留，排在同聚落池之后） */
      var R = 14;
      for (var dy = -R; dy <= R; dy++) {
        for (var dx = -R; dx <= R; dx++) {
          var x = city.x + dx, y = city.y + dy;
          if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
          var _fci2 = (GAME.sphere && GAME.sphere.ciOfXY) ? GAME.sphere.ciOfXY(x, y) : -1;
          var f = (_fci2 >= 0 && GAME.map.fortAt) ? GAME.map.fortAt(_fci2) : null;
          if (f) push({ kind: 'fort', ci: _fci2, pid: GAME.curPid() }, Math.max(Math.abs(dx), Math.abs(dy)) + 100);
        }
      }
    }
    list.sort(function (a, b) { return a.d - b.d; });
    return list.slice(0, 40).map(function (o) { return o.tg; });
  };
  /* 目标标签（v89.59）：普通城市 / 据点 一律带等级；自身城市标注「己方 · 城市间操作」 */
  ui.expTargetLabel = function (tg) {
    if (tg.kind === 'own') {
      var mc = GAME.cityById(tg.id);
      return mc ? ('🏯 ' + mc.name + '（己方 · 城市间操作）') : '（己方城市）';
    }
    var t = GAME.battle.resolveTarget(tg);
    if (!t.ok) return '（不可达）';
    if (t.kind === 'fort' && t.fort) return '🏕 ' + GAME.fortLabelOf(t.fort) + '（Lv' + (t.fort.level || 1) + '）';
    /* v89.74：目标标签上的等级 = 该城**自己的等级**（与守军同一个数）。
       v89.70 曾改显示档位满配（聚落就写 Lv14），会与"守军按 Lv9 算"当场打架 —— 已回退。 */
    if (t.npc) return '🏯 ' + GAME.cityFullName(t.npc) + '（Lv' + GAME.cityLvOf(t.npc) + '）';
    return t.name;
  };
  /* v89.59：原「全体站位」取值口（expStanceValue）已随站位行并入「出征战术」菜单而退场 */
  /* 计略下拉框选项（攻 / 行军计随出征携带；不可用项标因由并禁用） */
  ui.expSchemeOptionsHTML = function () {
    var t = ui._expRes, head = '<option value="">未用计</option>';
    if (!t) return head;
    return head + (DATA.SCHEMES || []).filter(function (sc) {
      return sc.kind === 'attack' || sc.kind === 'march';
    }).map(function (sc) {
      var chk = GAME.schemePrepare(sc.id, t, ui.expSchemeGenOf());
      return '<option value="' + sc.id + '"' + (ui._expScheme === sc.id ? ' selected' : '') + (chk.ok ? '' : ' disabled') + '>' +
        sc.icon + ' ' + sc.name + '（精' + sc.energy + ' · 囊' + sc.jinang + '）' + (chk.ok ? '' : '　— ' + U.escape(chk.msg)) + '</option>';
    }).join('');
  };
  /* 英雄变 → 计略可用性可能变：重建下拉框；原选中的计若失效则撤下 */
  ui.refreshExpSchemeSel = function () {
    var sel = document.getElementById('exp-scheme-sel');
    if (!sel) return;
    if (ui._expScheme) {
      var chk = GAME.schemePrepare(ui._expScheme, ui._expRes || {}, ui.expSchemeGenOf());
      if (!chk.ok) { ui._expScheme = null; ui.setExpSchemeLabel(); }
    }
    sel.innerHTML = ui.expSchemeOptionsHTML();
  };
  /* 计略 = 显式设定（与 doExpSchemePick 的「再点撤下」区分开，供下拉框用） */
  ui.setExpScheme = function (sid) {
    ui._expScheme = sid || null;
    ui.setExpSchemeLabel();
    var box = $('#exp-scheme-box'); if (box) box.innerHTML = ui.expSchemePanelHTML();
    var sel = document.getElementById('exp-scheme-sel');
    if (sel && sel.value !== (ui._expScheme || '')) sel.value = ui._expScheme || '';
    /* ⛔ v89.198：战法解锁态联动随玩法全撤退役（计略变动不再需要刷新战法按钮）。 */
  };

  /* ============================================================
   * v89.59（老板需求 6）：出征「方案」与「出征战术」两套预设
   * ------------------------------------------------------------
   *   方案 plan      = { id, name, troops:{兵种:数量}, tactics:{兵种:{s,t}} }  ← 固定兵力 + 战术
   *   战术 tacticSet = { id, name, tactics:{兵种:{s,t}} }                       ← 只固定战斗指令
   * 下拉框**套用**（就地生效）；「设置」走弹窗（弹窗单根，会替换出征面板 →
   * 保存/删除后由 GAME 侧重开面板；套用则在重开后再落地）。
   * ============================================================ */
  ui.plansOf = function () { var s = GAME.state; if (s) s.plans = s.plans || []; return (s && s.plans) || []; };
  ui.tacticSetsOf = function () { var s = GAME.state; if (s) s.tacticSets = s.tacticSets || []; return (s && s.tacticSets) || []; };
  ui.expCurrentTroops = function () {
    var city = ui.expFromCity(), out = {};
    Object.keys((city && city.army) || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Number(inp.value) || 0 : 0;
      if (v > 0) out[id] = Math.floor(v);
    });
    return out;
  };
  ui.expPlanOptionsHTML = function () {
    return '<option value="">（不套用）</option>' + ui.plansOf().map(function (p) {
      return '<option value="' + p.id + '">📋 ' + U.escape(p.name) + '</option>';
    }).join('');
  };
  ui.expTacticOptionsHTML = function () {
    /* v89.164（老板 3）：首项 = 「⚡ 智能战斗（通用方案）」——选中即开智能托管；
       选中任何其他项 = 关（回到手动战术）。选中态由 settings.smartBattle 决定。 */
    var smartOn = !!(GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf());
    return '<option value="smart"' + (smartOn ? ' selected' : '') + '>⚡ 智能战斗（通用方案）</option>' +
      '<option value=""' + (smartOn ? '' : ' selected') + '>默认（全体前进）</option>' +
      (DATA.STANCES || []).map(function (st) {
        return '<option value="u:' + st.id + '">' + st.icon + ' 全体' + st.name + '</option>';
      }).join('') +
      ui.tacticSetsOf().map(function (t) {
        return '<option value="s:' + t.id + '">📋 ' + U.escape(t.name) + '</option>';
      }).join('');
  };
  ui.expApplyPlan = function (id) {
    var p = null; ui.plansOf().forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return;
    /* v91.76：方案按**派出城**的兵力裁剪（老板：方案沿用派出城的练兵场上限）。 */
    var city = ui.expFromCity();
    Object.keys((city && city.army) || {}).forEach(function (tid) {
      var inp = document.getElementById('exp-' + tid);
      if (!inp) return;
      inp.value = Math.min((p.troops && p.troops[tid]) || 0, city.army[tid] || 0);
    });
    if (p.tactics) GAME.state.tactics = U.deep(p.tactics);
    ui.updateExpMarch();
    ui.toast('已套用方案：' + p.name);
  };
  ui.expApplyTactic = function (v) {
    /* v89.164（老板 3）：「⚡ 智能战斗」= 开智能托管（逐回合自动指挥）；
       选中任何其他项 = 关智能（回到原手动战术逻辑）。 */
    if (v === 'smart') {
      if (GAME.battle && GAME.battle.setSmartBattle) GAME.battle.setSmartBattle(true);
      ui.toast('⚡ 智能战斗已开启：接敌自动转防御 · 按克制逐回合指派目标');
      return;
    }
    if (GAME.battle && GAME.battle.setSmartBattle) GAME.battle.setSmartBattle(false);
    if (!v) { GAME.clearTactics(); }
    else if (v.indexOf('u:') === 0) {
      var sid = v.slice(2), city = ui.expFromCity();
      Object.keys((city && city.army) || {}).forEach(function (id) { GAME.setTactic(id, { s: sid }); });
    } else if (v.indexOf('s:') === 0) {
      var tid = v.slice(2);
      ui.tacticSetsOf().forEach(function (x) { if (x.id === tid) GAME.state.tactics = U.deep(x.tactics || {}); });
    }
  };
  /* ⛔ v89.198（老板 3）：「阵位」摘要行退役 —— syncExpTacticRow 一并删（行已不渲染）。 */
  ui.openPlanModal = function () {
    var list = ui.plansOf();
    var rows = list.length ? list.map(function (p) {
      var n = 0; for (var k in (p.troops || {})) n += p.troops[k];
      return '<div class="inn-card" style="margin-bottom:6px;"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">📋 ' + U.escape(p.name) +
          '　<span style="color:var(--text-dim);font-size:var(--fs-sub);">兵力 ' + U.fmt(n) + '</span></div></div>' +
        '<button class="btn sm gold" data-action="plan-apply" data-v="' + p.id + '">套用</button>' +
        '<button class="btn sm red" data-action="plan-del" data-v="' + p.id + '">删除</button></div>';
    }).join('') : '<div class="q-empty">暂无方案 —— 配好兵力与战术后「存为新方案」。</div>';
    ui.openShell({
      title: '📋 出征方案',
      sub: '固定「兵力 + 战术」的一套配置',
      body: rows +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-zone-t">存为新方案</div>' +
        '<div class="mk-row"><input type="text" id="plan-name" placeholder="方案名（如：攻城主力）" style="flex:1;"></div>' +
        '<div style="text-align:center;margin-top:6px;"><button class="btn gold" data-action="plan-save">' +
          '存为新方案（取打开弹窗前配置）</button></div></div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
  /* v89.86（顺手修复）：本函数原名为 `ui.openTacticModal` —— 与 v26 的「逐兵种编辑器」
     同名，后定义把前者整个盖掉，「逐兵种」入口实际打开的是本页（一直打不开编辑器）。
     更名 `ui.openTacticSets`（战术**预设**管理），与逐兵种编辑器各归各位；
     改名的三个调用点：main.js 的 open-tactic-set / expSaveTactic / expDeleteTactic。 */
  ui.openTacticSets = function () {
    var list = ui.tacticSetsOf();
    var rows = list.length ? list.map(function (t) {
      return '<div class="inn-card" style="margin-bottom:6px;"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">📋 ' + U.escape(t.name) + '</div></div>' +
        '<button class="btn sm gold" data-action="tac-apply" data-v="' + t.id + '">套用</button>' +
        '<button class="btn sm red" data-action="tac-del" data-v="' + t.id + '">删除</button></div>';
    }).join('') : '<div class="q-empty">暂无战术 —— 用「逐兵种」调好后「存为新战术」。</div>';
    ui.openShell({
      title: '🎯 出征战术',
      sub: '固定「前进 / 防御 / 后退 + 目标」的一套指令',
      body: rows +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-zone-t">存为新战术</div>' +
        '<div class="mk-row"><input type="text" id="tac-name" placeholder="战术名（如：自走火炮后退）" style="flex:1;"></div>' +
        '<div style="text-align:center;margin-top:6px;">' +
        '<button class="btn gold" data-action="tac-save">存为新战术（取打开弹窗前指令）</button>' +
        '<button class="btn" data-action="open-tactic">逐兵种调整</button></div></div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
  ui.expSavePlan = function () {
    var el = document.getElementById('plan-name'), nm = el ? String(el.value || '').trim() : '';
    if (!nm) { ui.toast('请填方案名'); return; }
    var s = GAME.state; s.plans = s.plans || [];
    var snap = ui._planSnap || {};
    s.plans.push({ id: 'pl' + (s.plans.length + 1) + '_' + Date.now(), name: nm,
      troops: snap.troops || {}, tactics: snap.tactics || {} });
    ui.toast('已存方案：' + nm);
    ui.openPlanModal();
  };
  ui.expSaveTactic = function () {
    var el = document.getElementById('tac-name'), nm = el ? String(el.value || '').trim() : '';
    if (!nm) { ui.toast('请填战术名'); return; }
    var s = GAME.state; s.tacticSets = s.tacticSets || [];
    s.tacticSets.push({ id: 'ts' + (s.tacticSets.length + 1) + '_' + Date.now(), name: nm,
      tactics: ui._tacSnap || {} });
    ui.toast('已存战术：' + nm);
    ui.openTacticSets();      /* v89.86：预设管理（原同名覆盖问题见 openTacticSets 注释） */
  };
  ui.expDeletePlan = function (id) {
    var s = GAME.state; s.plans = (s.plans || []).filter(function (p) { return p.id !== id; }); ui.openPlanModal();
  };
  ui.expDeleteTactic = function (id) {
    var s = GAME.state; s.tacticSets = (s.tacticSets || []).filter(function (t) { return t.id !== id; }); ui.openTacticSets();   /* v89.86：预设管理 */
  };

  /* ============================================================
   * ⛔ v89.198（老板「清除战法这个玩法」· 2026-10-05）：战法三选（强攻/围困/奇袭）
   *   从出征面板整条退役 —— 状态（_expOps）/ 锁定判据（expOpsLockOf）/ chips / 说明 /
   *   setExpOps 全清；出征一律按无修正口径。沿革与去向见 js/data.js 的 DATA.OPS 墓碑。
   * ============================================================ */
  /* v89.197（老板 3/4）：**出征模块统一行** ——「名称（固定宽 4.5em）+ 控件（flex:1）」。
     备注（说明性文字）一律收进 .tip-src → 悬停走全站唯一浮层 #tip-layer（规格相同）；
     tipHTML 传 null = 该模块无备注（"底下适合的才给备注"）。 */
  /* v91.75（老板「重复的不要：目标只列一个、主将只列一个，对出征做一次汇总整理」）——
     出征界面**只留一套主档**（目标 / 派出城 / 主将 / 出征方式 / 方案 / 战术 / 计略 / 道具 / 兵力 / 预估），
     各形态的差异收进标题下**一行摘要**，不再各写一块。 */
  ui.expShapeSummary = function (t, city) {
    if (!t) return '';
    var own = ui._expOwn;
    var c = city || ui.expFromCity() || GAME.currentCity();
    var ownWild = !!(t.kind === 'wild' && GAME.map.wildAt(t.ci, t.pid));
    var parts = [];
    if (own) {
      var to = GAME.cityById(t.id);
      parts.push('本境调兵 · 终点「' + U.escape(to ? to.name : '?') + '」');
      parts.push('不接战 · 兵力押运，抵达入城');
      parts.push('可携带辎重（资源），按距离损耗');
    } else if (t.kind === 'wonder') {
      var wd = ui._expWonder && ui._expWonder.wd;
      parts.push('奇观「' + U.escape(wd ? wd.name : '?') + '」· 星球 ' + t.pid);
      parts.push('行动 = 出征方式（采集 / 派军搜查 / 深潜攻坚…）');
      parts.push('派出城只列该星球城市');
    } else if (t.kind === 'wonderFight') {
      var fwd = GAME.wonderOf ? GAME.wonderOf(t.pid) : null;
      parts.push('奇观「' + U.escape(fwd ? fwd.name : '?') + '」第 ' + t.lv + ' 层守卫');
      parts.push('战斗 · 击败即解锁该层材料收集');
    } else if (ownWild) {
      var gw = GAME.map.wildAt(t.ci, t.pid);
      var st = gw && gw.garrison && gw.garrison.genId;
      parts.push('己方野地 · 方式固定「驻守 · 增援」');
      parts.push(st ? '已有驻将 → 本次只并兵、不换将' : '首次驻守需选主将');
      parts.push('不接战 · 不耗体力精力');
    } else if (t.kind === 'fort') {
      parts.push('野外据点 · 占领 = 收为「我方前哨」（不转城市、不占名额）');
      parts.push('每日每处只能掠夺一次');
    } else if (t.kind === 'city') {
      parts.push('名城 · 占领即纳入版图（受领地上限约束）');
      parts.push('掠夺得库藏（约半数），占领得城');
    } else if (t.kind === 'wild') {
      parts.push('无主野地 · 占领得地盘（产量加成 + 采集权），掠夺得财货');
    }
    return parts.length ? parts.join('　·　') : '';
  };

  ui.expRowHTML = function (lab, ctrl, tipHTML) {
    return '<div class="exp-row"' + (tipHTML ? ' data-tip-el="1"' : '') + '>' +
      '<span class="exp-lab">' + lab + '</span>' +
      ctrl +
      (tipHTML ? '<span class="tip-src">' + tipHTML + '</span>' : '') +
      '</div>';
  };
  /* ⛔ v89.198：expOpsChipsHTML / expOpsNoteHTML / expOpsBlockHTML / setExpOps 全清（见上）。 */

  /* ============================================================
   * v89.103：**辎重（资源调配）** —— 出征界面里的"运多少东西"三件套
   * ------------------------------------------------------------
   * · expArmyOf()    —— 从输入框收兵力（发兵与算运力**同一个来源**，不各收一份）
   * · expCargoHTML() —— 资源 + 数量框（只在"本境调运"时出现）
   * · syncCargoEst() —— 实时算运力 / 载重 / 逐项预计实收（与抵达落账同一函数）
   * ============================================================ */
  /* v91.72（老板）：**派出城**的唯一读点 —— 兵力上限 / 已填数量 / 提交都读它。
     改前只改了下拉值与面板读数，提交仍从当前城取兵（选了别城也白选）。 */
  ui.expFromCity = function () {
    var ct = null;
    if (ui._expFrom) ct = GAME.cityByIdAnywhere ? GAME.cityByIdAnywhere(ui._expFrom) : GAME.cityById(ui._expFrom);
    return ct || GAME.currentCity();
  };
  ui.expArmyOf = function () {
    var out = {};
    var city = ui.expFromCity();
    if (!city) return out;
    Object.keys(city.army || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Math.floor(Number(inp.value) || 0) : 0;
      if (v > 0) out[id] = v;
    });
    return out;
  };
  /* ============================================================
   * v89.210（老板拍板 · 不留遗留）：**战前推演** —— 出征前预演一场。
   * ------------------------------------------------------------
   * 全部口径走 GAME.battle.previewOf（与实战同一引擎 / 同一输入构造，见 battle.js）；
   * 本段只做"读选择 → 调推演 → 渲染结果"，**不落任何账**（不扣兵、不发兵）。
   * ============================================================ */
  ui.openExpSim = function () {
    var target = ui._expTarget;
    if (!target) { ui.toast('请先选择目标'); return; }
    var mode = ui._expMode || 'occupy';
    var genSel = document.getElementById('exp-gen');
    var atk = ui.expArmyOf ? ui.expArmyOf() : {};
    if (!Object.keys(atk).length) { ui.toast('请先选择推演兵力'); return; }
    /* v89.137 同款：己方野地已有驻将 → 不带将（与出发口径一致） */
    var _stGen = false;
    if (ui._expRes && ui._expRes.kind === 'wild') {
      var _wm = GAME.map.wildAt(ui._expRes.x, ui._expRes.y);
      _stGen = !!(_wm && _wm.garrison && _wm.garrison.genId);
    }
    var pv = GAME.battle.previewOf(target, mode, atk,
      _stGen ? '' : (genSel ? genSel.value : ''),
      { scheme: _stGen ? null : (ui._expScheme || null) });
    if (!pv.ok) { ui.toast(pv.msg || '无法推演'); return; }
    ui.openModal(ui.expSimHTML(pv));
  };
  /* 推演结果面板（纯展示；关闭走右上角 ✕ / Esc —— 弹栈即回出征面板，输入值不丢） */
  ui.expSimHTML = function (pv) {
    var r = pv.result || {};
    var t = pv.t || {};
    var mode = GAME.battle.modeOf(ui._expMode || 'occupy');
    var win = r.winner === 'atk';
    var rows = '';
    rows += '<div class="res-line"><span class="lbl">⚔ 推演结果</span><span class="val">'
      + (win ? '胜' : '负') + ' · ' + (r.rounds || 0) + ' 回合'
      + (win ? '' : '（此战不利 —— 建议增兵 / 易将 / 改日再战）') + '</span></div>';
    rows += '<div class="res-line"><span class="lbl">我方损失</span><span class="val">'
      + U.fmt(r.atkLoss || 0) + ' · 尚存 ' + U.fmt(r.atkRemain || 0) + '</span></div>';
    rows += '<div class="res-line"><span class="lbl">敌方损失</span><span class="val">'
      + U.fmt(r.defLoss || 0) + ' · 尚存 ' + U.fmt(r.defRemain || 0) + '</span></div>';
    if (mode.occupy && GAME.siegeScopeOf && GAME.siegeScopeOf(t)) {
      var st = GAME.siegeStateOf(t);
      var hold0 = st ? (st.hold == null ? 100 : st.hold) : 100;
      if (win) {
        var chip = GAME.siegeChipOf();
        var hold1 = Math.max(0, hold0 - chip);
        rows += '<div class="res-line"><span class="lbl">围攻推进</span><span class="val">民心 '
          + Math.round(hold0) + '% → ' + Math.round(hold1) + '%（第 '
          + ((st ? (st.waves || 0) : 0) + 1) + ' 波）'
          + (hold1 <= 0 ? ' · 民心已尽，下一胜可拔城' : '') + '</span></div>';
      } else {
        rows += '<div class="res-line"><span class="lbl">围攻进度</span><span class="val">民心 '
          + Math.round(hold0) + '% 未动（得胜方可夺其民心）</span></div>';
      }
    }
    if (pv.def && pv.def.scNote) {
      rows += '<div class="res-line"><span class="lbl">计略</span><span class="val">'
        + U.escape(pv.def.scNote) + '</span></div>';
    }
    return '<div class="gold-heading">🎬 沙盘推演 —— ' + U.escape(t.name || '') + '</div>' +
      '<div class="set-card">' + rows + '</div>' +
      '<div class="ui-sub" style="margin-top:8px;">推演与实战采用<b>同一战斗引擎</b>'
      + '（同输入同结果 · 不扣兵、不落账）；未计入行军期间的天时 / 科技变化与战前斗将'
      + '（随机触发，胜者全军 +10%）。</div>';
  };
  ui.expCargoHTML = function (c) {
    var R = GAME.res(c);
    /* v91.76（老板）：辎重列 = 资源 / 现有 / **上限**（不超过运力的最高数量）/ 起运 / 实收。 */
    var _capW76 = GAME.cargoCapOf(ui.expArmyOf ? ui.expArmyOf() : {});
    var rows = GAME.TRANSPORT_KEYS.map(function (k) {
      var meta = null;
      (DATA.RESOURCES || []).forEach(function (r) { if (r.key === k) meta = r; });
      var have = Math.floor(R[k] || 0);
      var capK = Math.min(have, Math.max(0, _capW76));      /* 载重 1 单位 = 1 资源 */
      return '<tr><td class="et-name">' + (meta ? (meta.icon + ' ' + meta.name) : GAME.resName(k)) + '</td>' +
        '<td class="et-own num">' + U.fmt(have) + '</td>' +
        '<td class="et-own num" id="cg-cap-' + k + '">' + U.fmt(capK) + '</td>' +
        '<td class="et-in"><input type="number" id="cg-' + k + '" min="0" max="' + capK + '" value="0"' +
          (capK > 0 ? '' : ' disabled') + '></td>' +
        '<td class="et-act"><button class="btn sm" data-action="cg-max" data-k="' + k + '"' +
          (capK > 0 ? '' : ' disabled data-why="本城该资源存量为 0 或运力为 0，无法调配"') + '>全</button></td>' +
        '<td class="cg-est num" id="cg-est-' + k + '">—</td></tr>';
    }).join('');
    return '<div class="exp-sec exp-a-cargo"><div class="exp-sec-t" style="display:flex;align-items:center;gap:8px;">辎重 · 资源调配' +
      '<button class="btn sm" data-action="cg-clear">清空</button>' +
      '<span class="ui-sub" id="exp-cargo-cap" style="margin-left:auto;">运力 —</span></div>' +
      '<table class="tbl exp-tbl cg-tbl"><colgroup>' +
        '<col class="cg-c-n"><col class="cg-c-own"><col class="cg-c-cap"><col class="cg-c-in"><col class="cg-c-act"><col class="cg-c-est">' +
      '</colgroup><thead><tr>' +
        '<th>物资</th><th class="num">现有</th><th class="num">上限</th><th class="ctr">起运</th><th class="ctr">全</th><th class="num">实收</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  };
  /* 实时刷新（只改文字，不重建弹窗 —— 与面板"点选不重绘"的约定一致） */
  ui.syncCargoEst = function () {
    if (ui._expMode !== 'dispatch' && ui._expMode !== 'transport') return;
    var from = ui.expFromCity();
    var to = (ui._expTarget && ui._expTarget.kind === 'owncity') ? GAME.cityById(ui._expTarget.id) : null;
    if (!from || !to) return;
    var cap = GAME.cargoCapOf(ui.expArmyOf());
    var load = 0;
    GAME.TRANSPORT_KEYS.forEach(function (k) {
      var el = document.getElementById('cg-' + k);
      load += el ? Math.max(0, Math.floor(Number(el.value) || 0)) : 0;
    });
    /* v91.76：兵力变化 → 逐资源「上限」列与输入框 max 同步刷新。 */
    GAME.TRANSPORT_KEYS.forEach(function (k) {
      var capCell = document.getElementById('cg-cap-' + k);
      var inEl = document.getElementById('cg-' + k);
      var have = Math.floor(GAME.res(from)[k] || 0);
      var capK = Math.min(have, Math.max(0, cap));
      if (capCell) capCell.textContent = U.fmt(capK);
      if (inEl) { inEl.max = capK; if (Number(inEl.value) > capK) inEl.value = capK; }
    });
    var capEl = document.getElementById('exp-cargo-cap');
    if (capEl) {
      capEl.innerHTML = '运力 <b style="color:' + (load > cap ? 'var(--red-light)' : 'var(--gold-light)') + ';">'
        + U.fmt(load) + '</b> / ' + U.fmt(cap)
        + (load > cap ? '　⚠ 载不动' : (cap <= 0 ? '　（先选随行兵力）' : ''));
    }
    GAME.TRANSPORT_KEYS.forEach(function (k) {
      var el = document.getElementById('cg-' + k);
      var out = document.getElementById('cg-est-' + k);
      if (!out) return;
      var qty = el ? Math.max(0, Math.floor(Number(el.value) || 0)) : 0;
      if (qty <= 0) { out.innerHTML = '—'; return; }
      var pl = GAME.transportPlanOf(from, to, k, qty);
      out.innerHTML = '<b style="color:var(--green-ok);">' + U.fmt(pl.landed) + '</b>'
        + (pl.stay > 0 ? '<br><span style="color:var(--amber);">' + U.fmt(pl.stay) + ' 装不下</span>' : '')
        + (pl.lost > 0 ? '<br><span style="color:var(--text-dim);">损耗 ' + U.fmt(pl.lost) + '</span>' : '');
    });
  };
  /* 「全」= 实有量与**余下运力**的较小者（多运的部分反正载不动） */
  ui.cgFillMax = function (k) {
    var from = ui.expFromCity();
    if (!from || !k) return;
    var cap = GAME.cargoCapOf(ui.expArmyOf());
    var used = 0;
    GAME.TRANSPORT_KEYS.forEach(function (kk) {
      if (kk === k) return;
      var el = document.getElementById('cg-' + kk);
      used += el ? Math.max(0, Math.floor(Number(el.value) || 0)) : 0;
    });
    var have = Math.floor(GAME.res(from)[k] || 0);
    var el = document.getElementById('cg-' + k);
    if (el) el.value = Math.max(0, Math.min(have, cap - used));
    ui.syncCargoEst();
  };
  ui.cgClear = function () {
    GAME.TRANSPORT_KEYS.forEach(function (k) {
      var el = document.getElementById('cg-' + k);
      if (el) el.value = 0;
    });
    ui.syncCargoEst();
  };

  /* ============================================================
   * v89.142（老板 6）：「出征界面右侧派遣兵力这里，全带这列表头改成"上限"，
   *   出征地为己方野地时，按野地派驻上限自动填入数量。出征地为其他时，
   *   按练兵场上限（各种加成后），本城军队最大数量，或其他限制设定自动填入数量」
   * ------------------------------------------------------------
   * **总人数上限的唯一出口**（按钮、探针、断言都读它）—— 返回 null 表示"不限"：
   *   · 目标 = 我方野地（驻守 · 增援）：野地派驻上限 − 现有驻军
   *       （与 prepare 的 station 预检、wildGarrisonAdd 的抵达闸**同一把尺**）；
   *   · 目标 = 我方城市（调兵 · 辎重）：**不限**（v89.220 老板 2 —— 驻军不受目标城
   *       练兵场容量限制；原"目标城出征容量 − 现有兵力"口径整条退役）；
   *   · 其余（出征类）：本城出征容量 marchCapOf（练兵场 ×1 万 × 专精/年号/增益 —— 唯一出口）；
   *       无练兵场（cap = 0）→ **不限**（与 prepare 的 `cap > 0` 判据同规：没练兵场不设限）。
   * 逐兵种分配：按兵种表顺序（= 右列表格的行序）依次取 min(拥有, 剩余额度)。
   * ============================================================ */
  ui.expFillCapOf = function (city, t, modeId) {
    city = city || GAME.currentCity();
    t = t || ui._expRes || null;
    if (!city || !t) return null;
    if (modeId === 'station' && t.kind === 'wild') {
      var w = GAME.map.wildAt(t.ci);
      if (!w) return 0;
      /* v89.186（老板 3 · #3 兵站）：传坐标 —— 据点覆盖内驻军上限 +50% */
      return Math.max(0, GAME.wildGarrisonCap(w.level, w.x, w.y) - GAME.wildGarrisonTotal(w.garrison));
    }
    /* ⛔ v89.220（老板 2）：调兵（owncity）**不受任何练兵场容量限制** —— 显式返回 null
       （不设限），别掉到下面的"本城出征容量"分支（那会变成按出发城容量限制调兵）。 */
    if (t.kind === 'owncity' && t.city) return null;
    var cap = GAME.battle.marchCapOf(city);
    return cap > 0 ? cap : null;
  };
  /* 按钮悬停的算法说明（把"这次的上限是怎么来的"写清楚，数字同源） */
  ui.expFillTipOf = function (city, modeId) {
    var t = ui._expRes || null;
    var cap = ui.expFillCapOf(city, t, modeId);
    if (cap == null) return '上限：不限（按各兵种拥有数填满）';
    if (modeId === 'station' && t && t.kind === 'wild') {
      var w = GAME.map.wildAt(t.ci);
      return '上限 = 野地派驻上限 ' + U.numText(GAME.wildGarrisonCap(w ? w.level : 0, w ? w.x : null, w ? w.y : null), 0)
        + '（Lv' + (w ? w.level : 0) + '）− 现有驻军 '
        + U.numText(GAME.wildGarrisonTotal(w ? w.garrison : null), 0) + ' = ' + U.numText(cap, 0);
    }
    return '上限 = 本城出征容量 ' + U.numText(cap, 0) + '（练兵场 ×1万 × 各种加成）';
  };

  /* v89.156（老板 2）：派遣兵力标题里的**额度标签**（唯一出口）——
     「练兵场出征上限」= 行内「上限」按钮的总额度（expFillCapOf），随方式/目标变：
       · 出征类：练兵场出征上限（marchCapOf × 各种加成）；
       · 己方野地（驻守）：派驻上限余量；己方城市（调兵）：不设上限（v89.220）；
       · 无练兵场 = 不设上限。 */
  ui.expCapLabelOf = function (city, t, modeId) {
    var cap = ui.expFillCapOf(city, t, modeId);
    if (cap == null) return '不设上限';
    var md = modeId || ui._expMode || 'occupy';
    if (md === 'station' && t && t.kind === 'wild') return '派驻上限 ' + U.numText(cap, 0);
    return '练兵场出征上限 ' + U.numText(cap, 0);
  };
  ui.refreshExpCapLabel = function () {
    var el = document.getElementById('exp-cap-t');
    if (el) el.textContent = ui.expCapLabelOf(ui.expFromCity(), ui._expRes, ui._expMode);
  };
  /* v89.156（老板 3）：右列」预估」块（原左列整段搬来；exp-wildcap 行退役——
     它的内容并入目标区「限制性信息」）。仅战斗型任务渲染（见 openExpModal）。 */
  ui.expEstBlockHTML = function () {
    var h = '<div class="exp-sec exp-a-est"><div class="exp-sec-t">预估</div>';
    h += '<div class="exp-info exp-info-l" id="exp-march" style="margin-bottom:4px;"></div>';
    h += '<div class="exp-info exp-info-l" id="exp-power" style="margin-bottom:4px;"></div>';
    h += '<div class="exp-info exp-info-l" id="exp-haul" style="margin-bottom:4px;"></div>';
    /* v89.186（老板 2/4）：伤兵回收提示行 —— 独立元素（live 只刷它；苦战时才有内容） */
    h += '<div class="exp-info exp-info-l" id="exp-wound186" style="margin-bottom:0;"></div>';
    h += '</div>';
    return h;
  };
  /* ============================================================
   * v89.144（老板 2）：「上限和清空……放在每个兵种行后边，对单独兵种数量进行操作」
   * ------------------------------------------------------------
   * **行内「上限」的唯一出口**（按钮 / 探针 / 断言都读它）：
   *   该行上限 = min(该兵种拥有, 总额度 − **其他行**已填合计)；
   *   总额度 = ui.expFillCapOf（同一把尺：野地派驻余量 / 出征容量 / 不限；调兵已不限 · v89.220）；
   *   不限（null）→ 上限 = 该兵种拥有数（旧「全带」语义）。
   * 逐行点「上限」= 玩家自己决定分配顺序（点哪行算哪行）—— 不再有"全局一键分配"，
   * 因此也不存在"强兵优先 / 表序优先"之类需要额外约定的分配序（老板 2 明确不要）。
   * ============================================================ */
  ui.expTroopMaxOf = function (troopId, city, modeId) {
    city = city || ui.expFromCity();
    var ei = document.getElementById('exp-' + troopId);
    var own = ei ? (Number(ei.max) || 0) : 0;
    var cap = ui.expFillCapOf(city || GAME.currentCity(), ui._expRes, modeId);
    if (cap == null) return own;
    var used = 0;
    Object.keys(DATA.TROOPS).forEach(function (id) {
      if (id === troopId) return;
      var o = document.getElementById('exp-' + id);
      if (o) used += Number(o.value) || 0;
    });
    return Math.max(0, Math.min(own, cap - used));
  };
  /* 行内「上限」按钮的悬停说明（数字同源：拥有 + 额度口径，含本次总额度的来源） */
  ui.expTroopTipOf = function (city, troopId, modeId) {
    var ct = city || GAME.currentCity();
    var own = (ct && ct.army && ct.army[troopId]) || 0;
    var cap = ui.expFillCapOf(ct, ui._expRes, modeId);
    if (cap == null) return '上限：该兵种全部拥有数 ' + U.numText(own, 0) + '（本次不设总上限）';
    return '上限 = min(该兵种拥有 ' + U.numText(own, 0) + '，本次总额度 ' + U.numText(cap, 0)
      + ' − 其他兵种已填)。　' + ui.expFillTipOf(ct, modeId);
  };

  /* ============================================================
   * v91.76（老板）：「1 个当前目标 + 1 个『其他目标』按钮」——
   * 弹窗只列**当前星球**可选项，按类型分组：
   *   · 己方（城市 / 野地）· 野地（周围 30 格）· 据点（周围 30 格）
   *   · 名城（区 → 重镇/首府/旧都 分级筛选，数据取地图同一份）· 奇观（本星球）
   * 选中 = 直接以该目标重开出征面板（同一出口）。
   * ============================================================ */
  ui.openExpTargetPicker = function () {
    var c = ui.expFromCity() || GAME.currentCity();
    if (!c) { ui.toast('无可用城市'); return; }
    var pid = GAME.curPid(), SP = GAME.sphereOf(pid);
    var kf = GAME.fk(pid);
    var ciAt = function (x, y) { return (SP && SP.ciOfXY) ? SP.ciOfXY(x, y) : -1; };
    var own = (GAME.state.cities || []).filter(function (x) { return GAME.pidOf(x) === pid && x.id !== c.id; });
    var ownWild = (GAME.state.wilds || []).filter(function (w) { return GAME.pidOf(w) === pid; });
    var SCAN = 30, wilds = [], forts = [];
    for (var dy = -SCAN; dy <= SCAN; dy++) {
      for (var dx = -SCAN; dx <= SCAN; dx++) {
        var x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
        var ci = ciAt(x, y); if (ci < 0) continue;
        if (GAME.map.wildAt(ci, pid)) continue;
        if (GAME.map.npcAt && GAME.map.npcAt(ci)) continue;
        var f = GAME.map.fortAt ? GAME.map.fortAt(ci) : null;
        if (f) { if (forts.length < 60) forts.push({ ci: ci, x: x, y: y, lv: f.level, name: f.name }); continue; }
        var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(ci) : 0;
        if (lv > 0 && wilds.length < 60) wilds.push({ ci: ci, x: x, y: y, lv: lv });
      }
    }
    /* 名城：按「区 → 城」分级（与地图行政区同一份 s.map.cities） */
    var npcs = (GAME.state.map.cities || []).slice();
    var states = [];
    npcs.forEach(function (n) { if (n.state && states.indexOf(n.state) < 0) states.push(n.state); });
    var tierName = { county: '聚落', jun: '重镇', zhou: '首府', capital: '旧都' };
    var wonder = GAME.wonderOf ? GAME.wonderOf(pid) : null;
    var row = function (k, id, ci, label, extra) {
      return '<button class="btn sm" data-action="exp-target-set" data-kind="' + k + '"' +
        (id != null ? ' data-id="' + U.escape(String(id)) + '"' : '') +
        (ci != null ? ' data-ci="' + ci + '"' : '') + '>' + label + (extra || '') + '</button> ';
    };
    /* v91.77（老板）：左 1/4 分类（己方城市 / 己方野地 / 周围野地 / 周围据点 / 名城 / 奇观），
       右 3/4 展示选中分类的目标；点击分类切换右侧内容。只列非空分类。 */
    var catDefs = [
      { id: 'own',     title: '🏯 己方城市',     body: (own.length ? own.map(function (x) {
          return row('own', x.id, null, '🏯 ' + U.escape(x.name)); }).join('') : '—') },
      { id: 'ownWild', title: '🌾 己方野地',     body: (ownWild.length ? ownWild.map(function (w) {
          return row('wild', null, w.ci, '🌾 ' + (DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : w.type) + ' Lv' + w.level); }).join('') : null) },
      { id: 'wild',    title: '🗺️ 周围 30 格野地', body: (wilds.length ? wilds.map(function (w) {
          return row('wild', null, w.ci, '🗺️ 野地 Lv' + w.lv + '（' + GAME.map.coordText(w.x, w.y) + '）'); }).join('') : '—') },
      { id: 'fort',    title: '🏕️ 周围 30 格据点', body: (forts.length ? forts.map(function (f) {
          return row('fort', null, f.ci, '🏕️ ' + U.escape(f.name) + ' Lv' + (f.lv || 1)); }).join('') : '—') },
      { id: 'city',    title: '🏛️ 名城（按区分级）', body: (npcs.length ? '<select id="etp-state" style="margin-bottom:6px;">' + states.map(function (st) {
          return '<option value="' + U.escape(st) + '">' + U.escape(st) + '</option>';
        }).join('') + '</select><div id="etp-npcs"></div>' : null) },
      { id: 'wonder',  title: '☄ 奇观（本星球）',  body: (wonder ? row('wonder', null, null, '☄ ' + U.escape(wonder.name)) : null) }
    ];
    var cats = catDefs.filter(function (c) { return c.body != null; });
    if (!cats.length) {
      ui.openModal('<div class="gold-heading">🎯 选择出征目标</div>' +
        '<div class="ui-sub" style="text-align:center;margin:8px 0;">当前星球暂无可选目标</div>', { size: 'xl' });
      return;
    }
    var sideHTML = cats.map(function (cat, i) {
      return '<div class="etp-cat"' + (i === 0 ? ' data-active="1"' : '') +
        ' data-cat="' + cat.id + '"' +
        ' style="padding:8px 10px;margin-bottom:4px;border-radius:8px;cursor:pointer;font-size:var(--fs-sub);' +
        (i === 0 ? 'background:var(--slab-2);color:var(--gold-light);font-weight:800;' : 'color:var(--text);') + '">' +
        U.escape(cat.title) + '</div>';
    }).join('');
    var layout = '<div style="display:flex;gap:12px;align-items:stretch;min-height:320px;">' +
      '<div style="flex:0 0 25%;border-right:1px solid var(--line);padding-right:10px;overflow:auto;">' + sideHTML + '</div>' +
      '<div style="flex:1 1 75%;min-width:0;"><div id="etp-body"></div></div>' +
      '</div>';
    ui.openModal('<div class="gold-heading">🎯 选择出征目标</div>' +
      '<div class="ui-sub" style="text-align:center;margin-bottom:6px;">仅列当前星球 · 选中后以该目标重开出征界面</div>' +
      layout, { size: 'xl' });
    /* 名城分级：区下拉 → 该区名城（档位 + 名称） */
    var paintNpc = function (stSel, boxEl) {
      if (!boxEl) return;
      var st0 = stSel ? stSel.value : (states[0] || '');
      boxEl.innerHTML = npcs.filter(function (n) { return n.state === st0; }).map(function (n) {
        return row('city', n.id, null, '🏛️ ' + U.escape(n.name), '<i style="opacity:.7;">（' + (tierName[n.type] || n.type) + ' Lv' + GAME.cityLvOf(n) + '）</i>');
      }).join('') || '—';
    };
    var paint = function (id) {
      var els = document.querySelectorAll('.etp-cat');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], on = el.getAttribute('data-cat') === id;
        el.setAttribute('data-active', on ? '1' : '0');
        el.style.background = on ? 'var(--slab-2)' : 'transparent';
        el.style.color = on ? 'var(--gold-light)' : 'var(--text)';
        el.style.fontWeight = on ? '800' : '400';
      }
      var cat = null;
      for (var j = 0; j < cats.length; j++) if (cats[j].id === id) { cat = cats[j]; break; }
      if (!cat) return;
      var b = document.getElementById('etp-body');
      if (!b) return;
      b.innerHTML = cat.body;
      if (id === 'city') {
        var stSel = document.getElementById('etp-state');
        var boxEl = document.getElementById('etp-npcs');
        paintNpc(stSel, boxEl);
        if (stSel) stSel.addEventListener('change', function () { paintNpc(stSel, boxEl); });
      }
    };
    paint(cats[0].id);
    var sideEls = document.querySelectorAll('.etp-cat');
    for (var k = 0; k < sideEls.length; k++) {
      (function (el) {
        el.addEventListener('click', function () { paint(el.getAttribute('data-cat')); });
      })(sideEls[k]);
    }
  };

  ui.openExpModal = function (target, opts138) {
    /* v89.138（老板 2）：「派遣」「运输」两个入口共用本界面 ——
       opts138.hint 给一行**入口专属提示**（讲清这次要填什么），不传则不显示。 */
    ui._expHint = (opts138 && opts138.hint) || '';
    /* ============================================================
     * v89.103（老板「任意自身城市向其他城市进行资源运输，应当采用出征界面」
     * ＋「目前主城向分城点击运输时提示城市不存在」）
     * ------------------------------------------------------------
     * 自身城市**不再跳到「城市间操作」小面板** —— 就在出征界面完成：
     * 英雄 / 兵种 / 资源数量三确认，走**同一套行军通道**（有行军时间、可召回）。
     * 老面板那条"点运输 → 城市不存在"的路（`ui._trTo` 没落过默认值，
     * 起运时按空 id 查城）随之整条退场 —— 货运现在只有这一个入口。
     * ============================================================ */
    if (target && target.kind === 'own') {
      var _ownTo = GAME.cityById(target.id);
      var _ownFrom = GAME.currentCity();
      if (!_ownTo) { ui.toast('目标城市不存在'); return; }
      if (_ownFrom && _ownFrom.id === _ownTo.id) { ui.toast('请选择另一座己方城市'); return; }
      target = { kind: 'owncity', id: target.id };     /* 交给既有 resolveTarget（同一出口） */
    }
    ui._expOwn = !!(target && target.kind === 'owncity');
    var s = GAME.state, c = (ui._expFrom && GAME.cityById(ui._expFrom)) || GAME.currentCity();
    /* ⛔ v157.85：前传「没有城」的专属文案已删（前传退役），只留通用兜底。 */
    if (!c) { ui.toast('还没有可用的城'); return; }
    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) { ui.toast(t.msg); return; }
    ui._expTarget = target;
    ui._expScheme = null;      /* v86：每次打开出征面板重置计略（防上次的计意外带上） */
    /* v91.21（老板 C1）：派出城缺省 = 当前城（换目标重开时复位；下拉 change 会重设）。
       v91.72：奇观目标 → 缺省取**该星球**的当前城 / 首城（当前城不在该星时不能默认它）。 */
    if (!(ui._expFrom && GAME.cityByIdAnywhere(ui._expFrom))) ui._expFrom = null;
    if ((target && (target.kind === 'wonder' || target.kind === 'wonderFight')) && target.pid != null) {
      var _wsl = GAME.sliceOf ? GAME.sliceOf(target.pid) : null;
      var _wc = (_wsl && _wsl.cities) || [];
      var _okFrom = false;
      _wc.forEach(function (x) { if (ui._expFrom && x.id === ui._expFrom) _okFrom = true; });
      if (!_okFrom) ui._expFrom = _wc.length ? _wc[0].id : null;
    }
    /* v91.76：本境调运可选「派遣 / 运输」；缺省给运输（带辎重区）。 */
    if (ui._expOwn && ui._expMode !== 'dispatch' && ui._expMode !== 'transport') ui._expMode = 'transport';
    /* v74：把**已解析的目标**存一份 —— 兵力总览/战力对比要用守军与城防，
       同一份 resolveTarget 结果直接读，不再各算一遍（两个出口必漂移）。 */
    ui._expRes = t;
    /* ============================================================
     * v91.49（老板）：「探索奇观的出征界面，最终行动按钮为『占领』，应改为『探索』；
     *   出征按钮跟随出征目的改变，增加相应出征方式到下拉框」——
     * 目标 = 奇观时：出征方式**改为该奇观的各项探索行动**（DATA.WONDER_ACT_DEFS），
     *   确认键 = 「☄ 探索 · {行动名}」，不再借用「占领」这个战斗方式名。
     * ============================================================ */
    ui._expWonder = null;
    ui._expWonderFight = null;
    if (target && (target.kind === 'wonder' || target.kind === 'wonderFight')) {
      /* v91.76（老板）：「探索（奇观统一，选择后增加一个选项『探索层级』）」——
         奇观目标统一为 **explore**；层级下拉默认「不挑战（采集）」，
         选层级 = 挑战该层守卫（沿用现有 6 层、逐层解锁与采集动作下拉）。 */
      var _wwd = GAME.wonderOf ? GAME.wonderOf(t.pid) : null;
      var _wacts2 = (_wwd && _wwd.acts) || [];
      var _wlv76 = (target.kind === 'wonderFight' && target.lv) ? target.lv
        : ((target.kind === 'wonder' && target.lv) ? target.lv : 0);
      ui._expWonder = { pid: t.pid, wd: _wwd, lv: _wlv76 };
      ui._expWonderFight = null;
      ui._expMode = 'explore';
      if (target.kind === 'wonder' && !target.lv) ui._expWonderAct = (_wacts2.indexOf(t.mode) >= 0) ? t.mode : (_wacts2[0] || 'collect');
      else if (!ui._expWonderAct) ui._expWonderAct = _wacts2[0] || 'collect';
    }
    /* ============================================================
     * v89.137（老板 7）：「所有军队操作均以出征界面进行（除非采集/收获/召回这类
     *   默认全军操作）」—— 目标是**己方野地**时：
     *   · 方式默认「驻守 · 增援」（station）——见下面的 modes 过滤；
     *   · 离开己方野地时**自动复位**（防"上次选了驻守、这次打敌方被拒"的粘性）。
     * ============================================================ */
    var isOwnWild137 = !!(target && target.kind === 'wild' && GAME.map.wildAt(target.ci));
    ui._expOwnWild137 = isOwnWild137;         /* 主将段/提交端读（一枚标志，一处判定） */
    ui._expMode = ui._expMode || 'occupy';
    if (isOwnWild137 && ui._expMode !== 'station') ui._expMode = 'station';
    /* v91.76：方式**不粘滞** —— 换目标后若当前方式对它是"不可用"的（比如上次运输、这次点野地），
       复位到该目标的缺省方式（己方城市→运输 / 己方野地→派驻 / 奇观→探索 / 其余→占领）。 */
    var _ownMove76 = !!(target && target.kind === 'owncity');
    if (_ownMove76 && ui._expMode !== 'dispatch' && ui._expMode !== 'transport') ui._expMode = 'transport';
    if (!_ownMove76 && (ui._expMode === 'dispatch' || ui._expMode === 'transport')) ui._expMode = isOwnWild137 ? 'station' : 'occupy';
    if (!isOwnWild137 && ui._expMode === 'station') ui._expMode = 'occupy';
    if (!ui._expWonder && ui._expMode === 'explore') ui._expMode = 'occupy';
    /* v89.138 修正（e2e 抓出）：`station` 与 `transfer` 都是**专用方式** ——
       离开对应目标类型时必须复位，否则会粘到下一次出征上
       （实测：先走"运输"（transfer）再打无主野地 → prepare 连报两次"调兵目标须为本境城市"、
       兵根本没发出去）。 */
    if (!isOwnWild137 && !ui._expOwn && (ui._expMode === 'station' || ui._expMode === 'transfer')) {
      ui._expMode = 'occupy';
    }
    /* v91.49：离开奇观目标时，`_expMode` 里可能残留**探索行动 id**（collect/search…）——
       那不是出征方式，会粘到下一次常规出征上（battle.modeOf 取不到 → 退默认）。
       判据：非奇观目标时，若 _expMode 不在 EXPEDITION.modes 里，复位为 occupy。 */
    if (!ui._expWonder) {
      var _validMode = ((DATA.EXPEDITION && DATA.EXPEDITION.modes) || []).some(function (mm) { return mm.id === ui._expMode; });
      if (!_validMode) ui._expMode = 'occupy';
    }
    /* 己方野地的现役驻将（有 → 纯增援不带将；无 → 首次/补将必选带队英雄） */
    var stGen137 = null;
    if (isOwnWild137) {
      var _w137u = GAME.map.wildAt(target.ci);
      if (_w137u.garrison && _w137u.garrison.genId) {
        (s.generals || []).forEach(function (g) { if (g.id === _w137u.garrison.genId) stGen137 = g; });
      }
    }
    if (target.kind === 'city') ui._attackNpc = t.npc;
    /* v89.57：主将缺省必须在**构建计略选项之前**定好（计略可用性要读当前英雄）
       v91.76：只从**派出城**里取缺省；没有则留空（无将方式合法）。 */
    var _defGen76 = (GAME.generalsIn ? GAME.generalsIn(c) : [])[0];
    if (!ui._expGen || !(GAME.generalsIn ? GAME.generalsIn(c) : []).some(function (g) { return g.id === ui._expGen; })) {
      ui._expGen = _defGen76 ? _defGen76.id : '';
    }
    /* v89.117：缺省主将**必须可出征** —— 旧口径取 generals[0]，若那位正在当城主/守将，
       玩家一开面板就"默认选中一个不能出征的人"（点出征才报错，很别扭）。
       这里把不可出征的缺省换成第一位可出征者（一个都没有时保持原样，交给下游报错）。 */
    var _curGen = null;
    s.generals.forEach(function (g) { if (g.id === ui._expGen) _curGen = g; });
    if (GAME.marchIssueOf && GAME.marchIssueOf(_curGen)) {
      var _okGen = (GAME.expGeneralsOf ? GAME.expGeneralsOf() : []).filter(function (g) {
        return GAME.pidOf(g) === GAME.pidOf(c) && (GAME.genCityOf ? (GAME.genCityOf(g) || {}).id === c.id : true);
      })[0];
      if (_okGen) ui._expGen = _okGen.id;
    }
    var gNum = 0;
    for (var k in (t.garrison || {})) gNum += t.garrison[k];
    /* v89.64（老板「将目前所有兵种都列上，做好分列，列间距固定，好看点」）：
       ① **全部兵种**都上表（DATA.TROOPS 全列，不再只看"城内有的"）——
          没有的也列出来、置灰并禁用，一眼看清"这个兵我还没有"；
       ② 走**表格 + colgroup + table-layout:fixed**（与征召大厅候选表 `.inn-tbl` 同一套做法）：
          列宽只认表头这一次声明，换内容/换城时列**纹丝不动** —— 这正是"列间距固定"；
       ③ 整块搬去**右列**独占（老板：「右边只留兵种及数量」）。 */
    /* v89.144（老板 2）：「上限和清空……放在每个兵种行后边，对单独兵种数量进行操作」——
       每行 = [上限][清空] 两键：
         · 上限 = min(该兵种拥有, 总额度 − **其他行**已填)（唯一出口 ui.expTroopMaxOf；
           不限（无练兵场等）→ 拥有数）；
         · 清空 = 只清该行（不影响其他兵种）。
       分配顺序 = 玩家点哪行算哪行（没有"全局一键分配"，也就无需约定强兵优先之类）。 */
    var troopBlock =
      '<table class="tbl exp-tbl"><colgroup>' +
        '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in"><col class="et-c-act">' +
      '</colgroup><thead><tr>' +
        '<th>兵种</th><th class="num">拥有</th><th class="ctr">出征数量</th><th class="ctr">操作</th>' +
      '</tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).map(function (id) {
        var tr = DATA.TROOPS[id] || {};
        var own = (c.army && c.army[id]) || 0;
        var off = own > 0 ? '' : ' off';
        return '<tr class="et-row' + off + '">' +
          '<td class="et-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-own num">' + own.toLocaleString() + '</td>' +
          '<td class="et-in"><input type="number" id="exp-' + id + '" min="0" max="' + own + '" value="0"' +
            (own > 0 ? '' : ' disabled') + '></td>' +
          '<td class="et-act"><button class="btn sm" data-action="exp-max" data-troop="' + id + '"' +
            ' title="' + U.escape(ui.expTroopTipOf(c, id, ui._expMode)) + '"' +
            (own > 0 ? '' : ' disabled data-why="本城该兵种数量为 0，无兵可派"') + '>上限</button>' +
            '<button class="btn sm" data-action="exp-zero" data-troop="' + id + '"' +
            (own > 0 ? '' : ' disabled data-why="本城该兵种数量为 0，无需清空"') + '>清空</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';

    /* v89.87（需求 2）：调派类（调兵/驻守/采集）**不列出征面板** ——
       三者各有自己的入口（城市间操作 / 派驻面板 / 采集面板），
       混进"出征方式"只会让每次出征都要先跳过三个无关项。 */
    /* v91.49（老板）：「增加相应出征方式到下拉框」——
       奇观目标时：方式 = 该奇观支持的**探索行动**（采集/派军搜查/深潜攻坚…），
       与 DATA.WONDER_ACT_DEFS 同源（新增行动自动出现）。 */
    /* v91.76（老板）：「**固定一个完整界面**，不适用的变为不可选即可，不然每个出征界面都不一样」——
       方式下拉**恒列全部 7 种**（侦查/掠夺/占领/派遣/运输/派驻/探索），
       不适用 = 置灰 + 悬停写原因（`ui.expModeAvailOf` 唯一出口，与执行端同源）。 */
    var ALL_MODES = ['scout', 'raid', 'occupy', 'dispatch', 'transport', 'station', 'explore'];
    var modes = ALL_MODES.map(function (mid) {
      if (mid === 'explore') return { id: 'explore', icon: '☄', name: '探索', stamina: 0, energy: 0, battle: false };
      var m0 = GAME.battle.modeOf(mid);
      if (mid === 'station') return { id: 'station', icon: '🛡️', name: '派驻', stamina: 0, energy: 0, battle: true };
      return m0;
    });
    var modeSelHTML = '<select id="exp-mode" class="exp-mode-select"' + (modes.length ? '' : '') + '>' +
      modes.map(function (m) {
        var lock = ui.expModeAvailOf(m.id);
        var label;
        if (m.id === 'explore') label = '☄ 探索（奇观）';
        else if (m.id === 'dispatch') label = '🧑‍✈️ 派遣（己方城市 · 兵将归属）';
        else if (m.id === 'transport') label = '🚚 运输（己方城市 · 负重调资源 · 原路返回）';
        else if (m.id === 'station') label = '🛡️ 派驻（己方野地 · 藏兵 · 无将不可采集）';
        else label = m.icon + ' ' + m.name + '（体' + (m.stamina || 0) + ' 精' + (m.energy || 0) + '）';
        return '<option value="' + m.id + '"' + (ui._expMode === m.id ? ' selected' : '') +
          (lock ? ' disabled' : '') + ' title="' + U.escape(lock || label) + '">' +
          label + (lock ? '　— ' + U.escape(lock) : '') + '</option>';
      }).join('') + '</select>';
    /* 奇观：方式之上再给一行「探索层级」（不挑战 / 第 N 层），层级影响预估的战斗对象。 */
    var wonderLvRow = '';
    if (ui._expWonder) {
      var _cleared76 = GAME.wonderClearedOf ? GAME.wonderClearedOf(ui._expWonder.pid) : 0;
      var _maxLv76 = GAME.wonderLayerCount ? GAME.wonderLayerCount() : 6;
      var opts76 = ['<option value="0"' + (!ui._expWonder.lv ? ' selected' : '') + '>不挑战（采集）</option>'];
      for (var _l76 = 1; _l76 <= _maxLv76; _l76++) {
        var _done76 = _l76 <= _cleared76, _next76 = _l76 === _cleared76 + 1;
        opts76.push('<option value="' + _l76 + '"' + (ui._expWonder.lv === _l76 ? ' selected' : '') +
          ((!_done76 && !_next76) ? ' disabled' : '') + '>第 ' + _l76 + ' 层' +
          (_done76 ? '（已清）' : (_next76 ? '（可挑战）' : '（须先清前层）')) + '</option>');
      }
      wonderLvRow = ui.expRowHTML('探索层级', '<select id="exp-wl">' + opts76.join('') + '</select>',
        '选“不挑战”则按下方探索行动采集；选层级 = 挑战该层守卫');
      /* 采集行动下拉（原“自己就是方式”迁到这里） */
      var _acts76 = (ui._expWonder.wd && ui._expWonder.wd.acts) || [];
      wonderLvRow += ui.expRowHTML('探索行动',
        '<select id="exp-act">' + _acts76.map(function (aid) {
          var a = (DATA.WONDER_ACT_DEFS || {})[aid] || {};
          return '<option value="' + aid + '"' + (ui._expWonderAct === aid ? ' selected' : '') + '>' +
            '☄ ' + U.escape(a.name || aid) + '</option>';
        }).join('') + '</select>' + '<span class="exp-tac-link" data-action="exp-scheme">详情</span>',
        (_acts76.map(function (aid) { var a = (DATA.WONDER_ACT_DEFS || {})[aid] || {}; return a.name + '：' + (a.cond || ''); }).join('　｜　')));
    }
    var cur = (ui._expWonder && ui._expWonder.lv)
      ? { icon: '⚔', name: '挑战第 ' + ui._expWonder.lv + ' 层守卫', battle: true }
      : (ui._expWonder ? { icon: '☄', name: '探索 · ' + (((DATA.WONDER_ACT_DEFS || {})[ui._expWonderAct] || {}).name || '采集'), battle: false }
        : GAME.battle.modeOf(ui._expMode));

    /* v70（老板）：出征目标写**全称** —— 名城给区·镇·城名，野外城市带所在聚落 */
    var _tTitle = (t.kind === 'fort' && t.fort) ? GAME.fortLabelOf(t.fort)
      : (t.npc ? GAME.cityFullName(t.npc) : t.name);

    /* v91.75（老板「重复的不要：目标只列一个」）——
       目标行**只显示本次目标**（名称即上面金头），不再在出征面板里再摆一份目标候选下拉。
       改目标请关窗回地图/军务选（目标候选由军务「出征」页承担，避免同一屏两处选目标）。 */
    ui._expTargets = ui.expTargetCandidates(c, target);
    var tgtSel = '';
    /* v89.59（需求 6）：站位并入下方「出征战术」菜单（统一进退 + 预设战术），此处不再单列 */
    /* v89.197（老板 3）：裸 select + 详情链接（label 双写退役） */
    var schemeSel = '<select id="exp-scheme-sel">' +
      ui.expSchemeOptionsHTML() + '</select><span class="exp-tac-link" data-action="exp-scheme">详情</span>';

    /* v89.52（老板：出征界面整合为单界面、紧凑有序）：
       目标城市 / 主将+可用道具 / 派遣兵力 / 出征方式 / 战术·计略 / 预估 / 确认，
       六大块用标题小卡分区，一眼扫完；主将改下拉框，可用道具实时可见。 */
    var html = '<div class="gold-heading">⚔️ ' + U.escape(_tTitle) + '</div>';
    /* v91.75：**每个形态只留一行摘要**（差异说明；共用主档不再各写一块）。
       v89.138 的运输/派遣提示并入摘要，不再单独占一行。 */
    var _sum75 = ui.expShapeSummary(t, c);
    if (_sum75 || ui._expHint) {
      html += '<div class="exp-info exp-info-l" style="text-align:center;color:var(--gold-light);margin-bottom:6px;">'
        + U.escape(_sum75)
        + (_sum75 && ui._expHint ? '　·　' : '')
        + (ui._expHint ? U.escape(ui._expHint === 'cargo' ? '押运兵力即运力'
          : (ui._expHint === 'dispatch' ? '主将随军入城' : ui._expHint)) : '')
        + '</div>';
    }
    /* v89.55（老板：出征界面偏小、每区块占整行不紧凑）→ 改 2 列分区网格 + 弹窗升 xl：
       目标+主将并排、战术+预估并排，派遣兵力/出征方式占满整行（需宽度）。 */
    /* v89.64（老板：「目标这里不用显示目标野地/城市的任何备注性信息，不然还要侦察何用？
       计略，方案，战术也放在左侧边，右边只留兵种及数量」）
       —— 于是版面改为**左列信息 / 右列兵力**两栏：
         左列：目标（只留名称与选择器）· 主将·道具 · 出征方式 · 计略 · 方案 · 出征战术 · 预估
         右列：**兵种及数量**（独占，可滚动） */
    html += '<div class="exp-grid"><div class="exp-col-l">';

    /* ① 目标（左上）—— v89.64：**删掉全部情报备注**（守军/城防/地形/库藏/守将/档位优势/布局），
       只留"打谁"这一件事；想知道守军多少、守将是谁，请去**侦查**。 */
    /* v89.197（老板 3）：「一个目标」——标题+label 双写退役；名称固定宽、右边直接是下拉框
       （单目标时给静态文本，名称列照旧对齐）。 */
    html += '<div class="exp-sec exp-a-target">';
    /* v91.76（老板）：「1 个当前目标 + 1 个『其他目标』按钮」—— 合并为**单行**：
       标题在左（exp-one 占满剩余宽度），「其他目标」按钮顶到右侧；不再另起一行重复目标。 */
    html += ui.expRowHTML('目标',
      '<span class="exp-one">' + U.escape(_tTitle) + '</span>' +
      '<button class="btn sm" data-action="exp-target-pick">其他目标</button>', null);
    /* v89.198（老板 5）：「相称建议」由主将区**移入目标区**（它是随目标变化的建议）。
       纯按目标等级给"宜派"的档位（守将实情请侦查；软提示、非门槛）。
       v89.129 建立（原挂主将区）；目标切换时整窗重绘，本行随 t 重建。 */
    var rec129 = GAME.recGenOf(t);
    if (rec129) {
      html += '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin:4px 0 0;">'
        + '相称建议：宜 <b>' + U.escape(rec129.text) + '</b> 带队</div>';
    }
    /* v89.156（老板 3）：「目标」的备注**只提示出征限制性信息**（领地满 / 野地满 /
       据点今日已掠夺……）—— 常规引导（"情报请用侦查"）退役；
       无限制时这行为空。唯一出口 ui.expLimitsHTML（与执行端判据同源）。 */
    html += '<div class="exp-info exp-info-l" id="exp-limits" style="margin-bottom:0;color:var(--red-light);">' +
      ui.expLimitsHTML() + '</div>';
    /* v91.21（老板 C1）：**派出城**下拉 —— 多城时选由哪座城执行（全境己方城；跨星球亦列出）。
       选定后本面板"拥有兵力/出征容量"改读该城；发兵带 fromCityId。 */
    var _mycities = (s.cities || []);
    /* v91.72（老板）：「奇观的探索是星球特有动作，派出城应该提供**所在奇观所在星球**的城市列表」——
       目标是奇观/奇观守军时，派出城只列**目标星球分片**里的城（跨星派队没有意义）。
       ⚔ 挑战奇观层级有同样的约束（同一条奇观通道）。 */
    if ((ui._expWonder || ui._expWonderFight) && t && t.pid != null) {
      var _wpid2 = t.pid;
      var _slice = GAME.sliceOf ? GAME.sliceOf(_wpid2) : null;
      var _wCities = (_slice && _slice.cities) || [];
      if (_wCities.length) _mycities = _wCities;
    }
    /* v91.75（老板「主将只列一个」同口径）—— 派出城**只显示本次从哪座城发兵**：
       只有在同一星球上有多座可选城时才给下拉；否则就是一行静态名（不再每个形态各造一套选择）。 */
    /* v91.77（老板）：下方重复的「目标」行已删除 —— 「其他目标」按钮已并入上方目标行右侧（单行 + 右侧换选）。 */
    if (wonderLvRow) html += wonderLvRow;
    if (!ui._expOwn) {
      var _pickFrom = c;
      if (_mycities.indexOf(c) < 0) _pickFrom = _mycities[0];
      /* v91.76：派出城 = **本星球全部己方城**（老板：根据当前所在城市默认，并提供当前星球可选项）*/
      var _fromHtml;
      if (_mycities.length > 1) {
        _fromHtml = '<select id="exp-from" class="city-select">' + _mycities.map(function (cc) {
          return '<option value="' + cc.id + '"' + (_pickFrom && cc.id === _pickFrom.id ? ' selected' : '') + '>' +
            U.escape(cc.name) + '（' + GAME.map.coordText(cc.x, cc.y) + '）</option>';
        }).join('') + '</select>';
      } else if (_pickFrom) {
        _fromHtml = '<span class="exp-one">' + U.escape(_pickFrom.name) + '（' + GAME.map.coordText(_pickFrom.x, _pickFrom.y) + '）</span>';
      } else {
        _fromHtml = '<span class="exp-one">无可用城市</span>';
      }
      html += ui.expRowHTML('派出城', _fromHtml, null);
    }
    html += '</div>';

    /* ② 主将（左中）—— 主将缺省已在函数开头定好（v89.57）；
       v89.197（老板 3）：统一行（标题双写退役）；
       v89.198（老板 4/5）：备注=驻将说明 + **精力/体力读数**（相称建议移往目标区）。 */
    html += '<div class="exp-sec exp-a-gen">';
    /* v89.137（老板 7）：己方野地已有驻将 → 本次是**纯增援**（只并兵、不换驻将）；
       不给选将（选谁都不会被带走），一句话讲清。首次驻军/老档补将仍须选将。 */
    if (stGen137) {
      html += '<div class="exp-info exp-info-l" style="color:var(--gold-light);margin:2px 0 4px;">🛡️ '
        + U.escape(stGen137.name) + ' Lv' + (stGen137.level || 1)
        + ' 驻守中 —— 本次增援<b>不带将</b>（只并兵，不换驻将）</div>';
    }
    /* v91.76（老板「主将：提供派出城的可选英雄，不要提供全部英雄」· 口径=本城全部+置灰）——
       只列**派出城归属**的英雄；忙碌/城主/守将置灰注明；另给「不派将」（派遣/运输/派驻可用）。 */
    var genSelHTML = '<select id="exp-gen" class="exp-gen-select"' + (stGen137 ? ' disabled' : '') + '>';
    genSelHTML += '<option value=""' + (!ui._expGen ? ' selected' : '') + '>（不派将）</option>';
    (GAME.generalsIn ? GAME.generalsIn(c) : []).forEach(function (g) {
      var a = GAME.genAttrs(g);
      var six = '统' + (a.tong || 0) + ' 勇' + (a.yw || 0) + ' 智' + (a.zm || 0) + ' 政' + (a.nz || 0) +
        ' 速' + (a.spd || 0) + ' 体' + (a.staMax || 0);
      var blk = GAME.marchIssueOf ? GAME.marchIssueOf(g) : null;
      genSelHTML += '<option value="' + g.id + '"' + (g.id === ui._expGen ? ' selected' : '') +
        (blk ? ' disabled' : '') + ' title="' + U.escape(blk || six) + '">' +
        U.escape(g.name) + (blk ? '（' + U.escape(blk) + '）' : '（' + six + '）') + '</option>';
    });
    genSelHTML += '</select>';
    html += ui.expRowHTML('主将', genSelHTML, '所列 = 派出城的英雄；“不派将”仅派遣/运输/派驻可用');
    /* v89.198（老板 4）：「精力 · 体力」读数移入**主将栏**（选定主将后显示，随选将刷新）——
       原挂「可用道具」信息行（同批：封存匣数量备注退役）。内容由 ui.refreshExpItems 填。 */
    html += '<div class="exp-info exp-info-l" id="exp-gen-vital" style="margin:4px 0 0;"></div>';
    /* v89.112：「可用道具」**移入右列**（原在主将段内）——
       物品多时体力丹 pills 会换行（199 物品环境下 +42px，撑高左列顶穿正文区）。
       右列余量充足；语义上也更顺：它和"派遣兵力"同属"带什么走"。 */
    html += '</div>';

    /* v89.66（老板：「计略，出征方式，方案，出征战术再缩减版面，目前是 1×4，改成 2×2」）
       —— 四块聚成一个 2×2 子网格（.exp-quad），左列由 7 行收到 4 行：
            ① 目标　② 主将·道具　③ [2×2 四块]　④ 预估
         排序按老板点名的顺序：计略 · 出征方式 ／ 方案 · 出征战术。
       ⚠️ 这只是**换容器**：四块的内部结构、id、handler 一字未动
       （#exp-scheme-sel / #exp-scheme-label / #exp-mode / #exp-plan / #exp-tactic 全照旧；阵位摘要行随 v89.198 退役）。 */
    html += '<div class="exp-quad">';

    /* v89.212（老板 2）：计略块按新行序**移至「出征战术」之后** ——
       行序自此：目标 → 主将 → 出征方式 → 方案 → 战术 → **计略** → 可用道具。
       （块体一字未动，仅换位置；见下方渲染段。） */
    /* ④ 出征方式（2×2 右上）—— 紧凑下拉框 */
    /* v89.86（整改 P-24）：据点目标的"占领"语义提示；v89.103 改为"据为己有" */
    /* v89.186（老板 3）：据点剥离 —— 占领 = 收为**我方前哨**（不转城市、不占名额） */
    /* v89.197（老板 4）：据点说明改**悬停**（挂「出征方式」名称；内容=游戏内实情） */
    var fortModeNote = (t.kind === 'fort')
      ? '据点：占领=拔除并收为「我方前哨」（不转城市、不占城市名额）——辐射 6~14 格（随据点等级）内野地：衰减减半 / 采集增产 / 驻军上限加成 / 情报 / 商税（均随后哨等级）。'
      : null;
    html += '<div class="exp-sec exp-a-modes">' + ui.expRowHTML('出征方式', modeSelHTML, fortModeNote) + '</div>';
    /* v144.4（C2）：**作战目标**（可选；不选 = 按兵力比自动定档）。
       护送/斩首改变"什么算赢"（不改攻防数值），战报会写明达成与否。 */


    /* v89.156：调运（transfer · 不接战）**不渲染接战专属三块**（方案）——
       原本 2×2 两行、改单列后四块 439px 把左列顶爆（调运面板溢出 141px · modals 审计实锤）；
       语义也正：transfer 是"兵力押运、不接战"，计略/阵位/阵型配置无用途。 */
    /* v89.157（老板 1）：己方野地驻守（station）同样不接战 —— 接战三块一并隐（与调运同规） */
    /* v91.76（老板）：「固定一个完整界面，不适用的变为不可选即可」——
       方案/战术/计略恒渲染；非接战方式下整块半透明并禁用（不再隐藏）。 */
    var _combat76 = !!(cur && cur.battle);
    var _dimStyle76 = _combat76 ? '' : ' style="opacity:.45;pointer-events:none;" title="该出征方式不接战，此设置不适用"';
    html += '<div class="exp-sec exp-a-plan"' + _dimStyle76 + '>';
    html += ui.expRowHTML('方案',
      '<select id="exp-plan"' + (_combat76 ? '' : ' disabled') + '>' + ui.expPlanOptionsHTML() + '</select>' +
      '<span class="exp-tac-link" data-action="open-plan">设置</span>',
      '沿用当前设置 · 套用后按派出城的练兵场上限裁剪');
    html += '</div>';
    /* v144.4（C2）：**作战目标**（可选；不选 = 按兵力比自动定档）。
       护送/斩首改变"什么算赢"（不改攻防数值），战报写明达成与否。 */
    if (_combat76) {
      var _objOpts = [
        { id: '', name: '自动（按兵力比定档）' },
        { id: 'escort', name: '护送 · 撑满回合且还有兵算过' },
        { id: 'behead', name: '斩首 · 打崩守军三成算过' }
      ];
      html += '<div class="exp-sec exp-a-objective">' + ui.expRowHTML('作战目标',
        '<select id="exp-obj">' + _objOpts.map(function (o) {
          return '<option value="' + o.id + '"' + ((ui._expObj || '') === o.id ? ' selected' : '') + '>' + o.name + '</option>';
        }).join('') + '</select>',
        '护送/斩首会改变"什么算赢"（不改攻防数值）') + '</div>';
    }
    /* v89.156：调运（transfer · 不接战）**不渲染接战专属三块**（出征战术）——
       原本 2×2 两行、改单列后四块 439px 把左列顶爆（调运面板溢出 141px · modals 审计实锤）；
       语义也正：transfer 是"兵力押运、不接战"，计略/阵位/阵型配置无用途。 */
    /* v89.157（老板 1）：己方野地驻守（station）同样不接战 —— 接战三块一并隐（与调运同规） */
    html += '<div class="exp-sec exp-a-tacmenu"' + _dimStyle76 + '>';
    html += ui.expRowHTML('出征战术',
      '<select id="exp-tactic"' + (_combat76 ? '' : ' disabled') + '>' + ui.expTacticOptionsHTML() + '</select>' +
      '<span class="exp-tac-link" data-action="open-tactic-set">设置</span>',
      null);
    /* v151（老板「阵前斗将是 50% 概率自动跑，玩家零输入」）：**请战 / 不叫阵** 逐场可选。
       记在 ui._expDuel（undefined = 沿用设置），随军写入 march.duel，抵达时才判。 */
    if (ui._expDuel === undefined) ui._expDuel = true;
    html += ui.expRowHTML('阵前斗将',
      ui.chips({ cls: 'chips-xs', after: 'expduel',
        opts: [{ v: '1', on: ui._expDuel !== false, label: '⚔ 请战' },
               { v: '0', on: ui._expDuel === false, label: '— 不叫阵' }] }),
      '请战：主将先与守将单挑，赢家全军 +10%（打不过就折气势）');
    html += '</div>';
    /* v89.212（老板 2）：计略块（原在「出征方式」之前）按老板令**移至「出征战术」之后** ——
       行序：目标 → 主将 → 出征方式 → 方案 → 战术 → 计略 → 可用道具。
       块体一字未动（仅换位置）；v89.59 语义保留：站位并入「出征战术」菜单，这里只留计略。
       v89.156/157：调运（transfer）与己方野地驻守（station）不接战 —— 本块与方案/战术一并隐。 */
    html += '<div class="exp-sec exp-a-tactic"' + _dimStyle76 + '>';
    html += ui.expRowHTML('计略', schemeSel, '<span id="exp-scheme-label">' + U.escape(ui.expSchemeLabel()) + '</span>');
    html += '<div id="exp-scheme-box" class="hidden exp-body" style="max-height:210px;margin:0 0 6px;"></div>';
    html += '</div>';
    html += '</div>';  /* /.exp-quad（四块容器的闭合 —— 必须在 if 外，否则 transfer 时不闭合、布局炸） */

    /* ⑨ 可用道具（v89.156 老板 2：左列 + 下拉框）；v89.198（老板 6）：信息行退役 ——
       封存匣数量备注不显示；精力/体力读数移入主将栏（#exp-gen-vital）。 */
    html += '<div class="exp-sec exp-a-items">';
    html += ui.expRowHTML('可用道具',
      '<select id="exp-item-sel"><option value="">（选择道具）</option></select>' +
      '<span class="exp-tac-link" id="exp-item-use" data-action="exp-use-item-pick" title="使用所选道具（作用于当前主将）">使用</span>',
      null);
    html += '</div>';
    /* ⑩ 本境调运「辎重 · 资源调配」（transfer 专用**操作区**）——
       v89.156 随"预估"挪去右列后独立成块：它不是预估、是操作，不能跟着藏。
       旧账（v89.112）：右列 辎重221 + 兵种655 = 876px 顶穿正文区 —— 辎重始终留左列。 */
    /* 预估恒渲染（老板：通用内容包括预估）；内容按方式切换（见 updateExpMarch）。 */
    html += ui.expEstBlockHTML();

    /* 右列（独占）：**兵种及数量**（v89.156 老板 2：可用道具整块搬去左列；
       v89.200 老板 3：预估移回左列下方 —— 右列只留兵力表）。 */
    /* v91.76：只有「派遣 / 运输」才是本境调运形态（派驻不是）。 */
    html += '</div><div class="exp-col-r' + (ui._expMode === 'dispatch' || ui._expMode === 'transport' ? ' exp-own' : '') + '">';
    /* v89.144（老板 2）：标题栏的两枚全局键（旧「上限 / 清空」）**整条退役** ——
       两个操作挪进每个兵种行（见 troopBlock）。
       v89.156 老板 2：标题由「派遣兵力 · 兵种数量」改「派遣兵力（练兵场出征上限：N）」——
       上限数值随方式/目标变（行内「上限」按钮的总额度，同一出口 expFillCapOf）。 */
    html += '<div class="exp-sec exp-a-troops"><div class="exp-sec-t">派遣兵力（<span id="exp-cap-t">' +
      U.escape(ui.expCapLabelOf(c, t, ui._expMode)) + '</span>）</div>';
    html += '<div class="exp-troops exp-body" data-mode="' + cur.id + '">' + troopBlock + '</div>';
    html += '</div>';
    /* v89.200（老板 3）：预估调用已移左列下方（见上）——右列只剩兵力表。 */
    html += '</div></div>';  /* /.exp-col-r /.exp-grid */

    /* v91.76：**辎重区**只在「运输」方式展开；放在两列之后（整行），避免撑爆列高。 */
    if (ui._expMode === 'transport') html += ui.expCargoHTML(c);

    /* ⑦ 确认 / 取消 */
    var _cfText76 = ui._expMode === 'transport' ? '🚚 起运（兵 + 辎重）'
      : ui._expMode === 'dispatch' ? '🧑‍✈️ 派遣'
      : (cur.icon + ' ' + cur.name);
    html += '<div class="exp-foot"><button class="btn gold" data-action="exp-confirm">' + _cfText76 + '</button>' +
      /* v89.210（老板拍板）：🎬 战前推演 —— 仅战斗方式显示（本境调运 / 侦查无战役需求）。 */
      ((ui._expOwn || !cur.battle) ? '' : '<button class="btn" data-action="exp-sim" title="沙盘推演：按当前选择预演一场（与实战同一引擎 · 不扣兵不落账）">🎬 推演</button>') +
      /* v89.186（老板 2）：「出征界面提供快购按钮（专用于战役）」——
         军事宝物（攻防/伤兵/出征上限）就地快购；本境调运无战役需求，不显示。 */
      /* v91.49：奇观探索无战役需求 —— 快购/推演一并隐藏（与 `battle=false` 同口径）。 */
      ((ui._expOwn || ui._expWonder) ? '' : '<button class="btn" data-action="qb-cat" data-cat="military_buff">🛒 战备快购</button>') +
      '<button class="btn" data-action="close-modal">取消</button></div>';

    /* v89.186：注册 live（**只刷伤兵行**，不重开面板）——
       弹栈回来（如从快购返回）时由 closeModal 立即调一次，数字不再是旧快照。 */
    ui.openModal(html, { size: 'xxl', live: ui.expWoundLive186 });
    ui.applyExpMode();
    ui.refreshExpItems();
    ui.updateExpMarch();
    ui.updateExpLimits();           /* v89.156：打开即评估限制性信息（双保险，applyExpMode 已调一次） */
    ui.syncCargoEst();              /* v89.103：辎重运力/实收（本境调运） */
    /* v89.103：辎重数量框 —— 手输即可见运力与实收变化（不重绘弹窗） */
    if (ui._expOwn) {
      GAME.TRANSPORT_KEYS.forEach(function (k) {
        var el = document.getElementById('cg-' + k);
        if (el) el.addEventListener('input', function () { ui.syncCargoEst(); });
      });
    }
    /* 主将下拉变更：同步 _expGen 并刷新可用道具 / 预估 / 计略可用性（不出重绘，保住出征面板） */
    var _genSel = document.getElementById('exp-gen');
    if (_genSel) _genSel.addEventListener('change', function () {
      ui._expGen = _genSel.value;
      ui.refreshExpItems();
      ui.updateExpMarch();
      var _sb = document.getElementById('exp-scheme-box');
      if (_sb && !_sb.classList.contains('hidden')) _sb.innerHTML = ui.expSchemePanelHTML();
      ui.refreshExpSchemeSel();          /* v89.57：英雄变 → 计略下拉可用性重算 */
    });
    /* v89.57：目标切换 → 重开面板（守军 / 库藏 / 计略可用性全变）
       v89.103：切到己方城市 → 同样重开（本境调运：辎重区会随之出现） */
    var _tgtSel = document.getElementById('exp-target');
    if (_tgtSel) _tgtSel.addEventListener('change', function () {
      var tg = ui._expTargets[Number(_tgtSel.value)];
      if (!tg) return;
      ui.openExpModal(tg);
    });
    var _plSel = document.getElementById('exp-plan');
    if (_plSel) _plSel.addEventListener('change', function () { if (_plSel.value) ui.expApplyPlan(_plSel.value); });
    var _tcSel = document.getElementById('exp-tactic');
    if (_tcSel) _tcSel.addEventListener('change', function () { ui.expApplyTactic(_tcSel.value); });
    /* v89.57：计略下拉框 → 显式设定（与面板的「再点撤下」共存） */
    var _scSel = document.getElementById('exp-scheme-sel');
    if (_scSel) _scSel.addEventListener('change', function () { ui.setExpScheme(_scSel.value); });
    /* v144.4：作战目标下拉 → 记在界面态（提交时带给执行端） */
    var _objSel = document.getElementById('exp-obj');
    if (_objSel) _objSel.addEventListener('change', function () { ui._expObj = _objSel.value || ''; });
    /* v89.58：出征方式下拉框 → setExpMode（锁 + 按钮文案 + 兵力区置灰） */
    var _mdSel = document.getElementById('exp-mode');
    if (_mdSel) _mdSel.addEventListener('change', function () { ui.setExpMode(_mdSel.value); });
    /* v91.21（老板 C1）：**派出城**下拉 → 记 ui._expFrom 并重开面板（兵力/容量改读该城）。 */
    var _fromSel = document.getElementById('exp-from');
    if (_fromSel) _fromSel.addEventListener('change', function () {
      ui._expFrom = _fromSel.value;
      ui.openExpModal(ui._expTarget);
    });
  };

  /* ============================================================
   * v89.86（整改 P-23）：兵力悬殊二次确认 —— 战力比的**唯一出口** + 按钮两态
   * ------------------------------------------------------------
   * 实测代价（老板试玩）：0.02:1 出兵 → 200 步行机全灭、敌损 0。
   * 预估行与确认闸必须读同一个战力比 —— 各自算一遍就会"面板报悬殊、确认却没拦住"。
   * ============================================================ */
  /* 战力比：我方 = 各兵种填报量 × troopPower；守方 = 守军 × troopPower × (1 + 城防/defDivisor)。
     口径与 v74 预估行完全一致（原逻辑迁移到此处，两处共用）。 */
  /* v89.94（B2 · E2）：情报等级 → 估算误差（±）—— 侦察网络越高，区间越窄。
     Lv0 ±55% / Lv3 ±34% / Lv6 ±13% / Lv8+ ±10%（下限 10%：军师也不是神仙）。 */
  ui.expEstErrOf = function (lv) {
    lv = Math.max(0, Number(lv) || 0);
    return Math.max(0.10, Math.min(0.55, 0.55 - 0.07 * lv));
  };
  /* ============================================================
   * v89.197（老板 1）建立；v89.198（老板「清除战法这个玩法」）修订 ——
   * 本出口 = **计略**对守军侧的修正（估算用）——与结算读同一口径
   *   （battle._settleBattle 的 scArmy/scVal 修正逐项对应；战法分支已随玩法全撤退役）。
   * 返回 { garrisonMul, wallMul, notes: [...] }（notes 供界面"已计入"提示）。
   * ⚠ 字段名用 wallMul（城防）不用 defMul —— defMul 是 v89.179 撤除的克制体系旧名，
   *   smoke §179① 的负向断言按它扫（禁复活），本出口避让命名。
   * ============================================================ */
  ui.expDefModsOf = function () {
    var out = { garrisonMul: 1, wallMul: 1, notes: [] };
    if (ui._expScheme && GAME.schemeOf) {
      var sc = GAME.schemeOf(ui._expScheme);
      if (sc && sc.eff) {
        if (sc.eff.guardPct) {
          out.garrisonMul *= (1 + sc.eff.guardPct);
          out.notes.push(sc.name + ' −' + Math.round(-sc.eff.guardPct * 100) + '%');
        }
        if (sc.eff.defCut) {
          out.wallMul *= (1 - Math.min(0.9, sc.eff.defCut));
          out.notes.push(sc.name + ' 城防 −' + Math.round(Math.min(0.9, sc.eff.defCut) * 100) + '%');
        }
      }
    }
    return out;
  };
  /* 军师估算（v89.94 · E2 改造）：**不再给一键正解** —— 给人一个区间。
     · 点估计 = 兵种加权（与来袭/家底同一把尺），守方含城防；
     · 围攻目标（据点/城市）：守军与城防按**当前民心**折算（与战斗入参同一出口 · v89.204 口径）；
     · 误差 ±err 由侦察网络等级决定 —— 情报越细，区间越窄，"判断"才有价值。 */
  ui.expPowerOf = function () {
    var tp = (GAME.story && GAME.rules.troopPower) ? GAME.rules.troopPower : null;
    var city = ui.expFromCity();   /* v91.76：按派出城读出征兵力 */
    if (!tp || !city) return null;
    var mine = 0, n = 0;
    Object.keys(city.army || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Number(inp.value) || 0 : 0;
      n += v;
      mine += v * tp(id);
    });
    var res = ui._expRes;
    var def = 0, sgS = null;
    if (res) {
      var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
      var wall = (res.def || 0) / div;
      var base = 0;
      for (var k in (res.garrison || {})) base += tp(k) * (res.garrison[k] || 0);
      if (GAME.siegeScopeOf && GAME.siegeScopeOf(res)) {
        sgS = GAME.siegeScaleOf(res);
        base *= sgS.garrison;                 /* 守军随破防衰减 */
        wall *= sgS.def;                      /* 城防同步衰减 */
      }
      /* v89.197（老板 1）建立；v89.198（战法全撤）：**计略修正计入估算**（与结算同一口径）。 */
      var _mods197 = ui.expDefModsOf();
      base *= _mods197.garrisonMul;
      wall *= _mods197.wallMul;
      def = Math.round(base * (1 + wall));
    }
    var lv = (GAME.battle.intelTiersOf ? GAME.battle.intelTiersOf().lv : 0);
    var err = ui.expEstErrOf(lv);
    /* v89.186（老板 3 · #5 情报站）：目标在我方前哨覆盖内 → 情报加成（"免侦查"）。
       v89.193（老板 2）：情报站**随前哨等级** —— 低档（Lv1-4）"半明"（估算误差减半）、
       高档（Lv5+）"确凿"（误差归零）；走唯一出口 GAME.fortEffectOf（不另行判定）。 */
    var _fAura193 = (GAME.fortAuraAt && res && res.ci != null) ? GAME.fortAuraAt(res.ci) : null;
    var aura186 = !!_fAura193;
    if (_fAura193) {
      var _fx193e = GAME.fortEffectOf(_fAura193);
      if (_fx193e.intelFull) err = 0;
      else if (_fx193e.intelHalf) err = err * 0.5;
    }
    var out = {
      aura: aura186,
      mine: Math.round(mine), def: def, n: n,
      ratio: def > 0 ? mine / def : null,
      intelLv: lv, err: err,
      lo: def > 0 ? Math.round(def * (1 - err)) : 0,
      hi: def > 0 ? Math.round(def * (1 + err)) : 0,
      siege: sgS ? { hold: sgS.hold } : null,
      mods: _mods197,                       /* v89.197：战法/计略修正（界面"已计入"提示用） */
    };
    out.ratioLo = out.hi > 0 ? mine / out.hi : null;   /* 最坏情形（守军偏强） */
    out.ratioHi = out.lo > 0 ? mine / out.lo : null;   /* 最好情形（守军偏弱） */
    return out;
  };
  /* "上膛"标记：兵力悬殊时第一次点击置 true（只警告不发兵） */
  ui._expForceArmed = false;
  /* 还原确认按钮（正常态）+ 清"上膛" —— 兵力/方式一变就调它 */
  ui.resetExpConfirm = function () {
    ui._expForceArmed = false;
    var btn = document.querySelector('#modal-root [data-action="exp-confirm"]');
    if (!btn) return;
    var cur = ui._expWonder
      ? { icon: '☄', name: '探索 · ' + (((DATA.WONDER_ACT_DEFS || {})[ui._expMode] || {}).name || ui._expMode) }
      : ui._expWonderFight
        ? { icon: '⚔', name: '挑战第 ' + ui._expWonderFight.lv + ' 层守卫' }
        : GAME.battle.modeOf(ui._expMode || 'occupy');
    btn.className = 'btn gold';
    btn.innerHTML = cur.icon + ' ' + cur.name;
  };

  /* ============================================================
   * v89.186（老板 2/4）：出征「伤兵回收」提示行 + 就地快购 ——
   *   · 苦战判定 = 我方**最好情形**仍弱于守军（ratioHi < 1.0；与军师估算同一份数据）——
   *     优势仗不打扰（v89.178 老板已嫌信息噪音）；
   *   · 数字走唯一出口 GAME.woundedRateOf（含商品/维修科技），
   *     商品可及上限从商品表读（改价/改值自动跟，不写死）；
   *   · 「快购兵书」= 既有快购通道（qb-cat + scope='wound'，零新 case）；
   *     出征常驻的「🛒 战备快购」（exp-foot）列军事宝物全类。
   * ============================================================ */
  ui.expWoundTipHTML186 = function () {
    var pw = ui.expPowerOf ? ui.expPowerOf() : null;
    if (!pw || pw.mine <= 0) return '';
    if (!(pw.ratioHi != null && pw.ratioHi < 1.0)) return '';   /* 非苦战不提示 */
    var E = DATA.EXPEDITION || {};
    var cap = (E.woundCap == null) ? 0.9 : E.woundCap;
    var base = (E.woundedRate == null) ? 0.75 : E.woundedRate;
    var wr = Math.round((GAME.woundedRateOf ? GAME.woundedRateOf(null) : base) * 100);
    var hi = 0;
    (DATA.ITEMS || []).forEach(function (x) {
      if (x.price > 0 && !x.noShop && x.eff && x.eff.wound > 0 && x.eff.wound > hi) hi = x.eff.wound;
    });
    var top = Math.round(Math.min(cap, base + hi) * 100);
    return '💊 此战恐伤损较重 —— 伤兵回收 <b>' + wr + '%</b>（阵亡者按此折为伤兵，花旧币可归队）'
      + (top > wr ? '，购兵书最高可提至 <b>' + top + '%</b>' : '')
      + '　<button class="btn sm" data-action="qb-cat" data-cat="military_buff" data-scope="wound">🛒 快购兵书</button>';
  };
  /* live 刷新：出征面板注册为 opts.live —— 主循环每秒 + 弹栈回来（如从快购返回）各调一次。
     内容不变不重建（防悬停闪烁；v89.158 招式）；只改这一行，不重开面板（保输入/计略/上膛）。 */
  ui.expWoundLive186 = function () {
    var el = document.getElementById('exp-wound186');
    if (!el) return;
    var h = ui.expWoundTipHTML186();
    if (el._h186 !== h) { el._h186 = h; el.innerHTML = h; }
  };

  /* 行军队列预估（出征弹窗内实时显示）
     行军速度由**最慢兵种**决定，所以必须等玩家填完兵力才准；
     未填时按城内现有兵种占位估算，并标注说明。 */
  ui.updateExpMarch = function () {
    var box = $('#exp-march');
    if (!box) return;
    /* v89.86（P-23）：兵力/英雄一变，二次确认重新计数并还原按钮（防"上膛"状态残留） */
    if (ui._expForceArmed) ui.resetExpConfirm();
    /* ⚠️ v89.115：目标一律用 `resolveTarget` 解析后的那份（`ui._expRes`，含 x/y/lv/npc）——
       原始 target 可能是 `{kind:'city', id}` 这种**没有坐标**的入参，直接拿它算会
       在"目标无坐标"处早退，整个预估区（行军/军师估算/搬运）全是空白
       （实机诊断：`🛫 目标无坐标，无法估算行军` → power/haul 三框皆空）。
       与 v89.114 的 haul 预估同一条口径：面板读的就是结算读的那个 t。 */
    var t = ui._expRes || ui._expTarget;
    var city = ui.expFromCity();   /* v91.76：出发性限制全部按派出城 */
    if (!t || !city) { box.textContent = ''; ui.updateExpHaul(); return; }
    var army = {}, any = false;
    Object.keys(city.army || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Number(inp.value) : 0;
      if (v > 0) { army[id] = v; any = true; }
    });
    var fallback = !any;
    if (fallback) army = city.army || {};
    var from = { x: city.x, y: city.y, cityId: city.id };
    if (t.x == null || t.y == null) { box.innerHTML = '🛫 目标无坐标，无法估算行军'; return; }
    var to = { x: t.x, y: t.y };
    var dist = GAME.cityDist(from, to);
    /* v26（需求 2）：主将速度参与行军，预估必须带上这名英雄，否则与实际耗时不符 */
    var egEl = document.getElementById('exp-gen');
    var eGen = null;
    if (egEl) {
      (GAME.state.generals || []).forEach(function (x) { if (x.id === egEl.value) eGen = x; });
    }
    var real = GAME.march.travelTime(from, to, army, null, eGen) / GAME.timeScale();
    box.innerHTML = '🛫 行军 <b>' + dist + '</b> 格　速度系数 <b>' + GAME.march.speedText(army, from, to, eGen) + '</b>　'
      + '预计 <b style="color:var(--gold-light)">' + U.durExact(real) + '</b>'
      + (fallback ? '<span style="opacity:.6;">（按城内现有兵种估算）</span>' : '');
    /* v74（老板：完善出征界面）：兵力总览 + 战力对比（估算）。
       v89.36：军粮维持退役 —— 总览不再列「耗粮 X/时」。
       战力走 STORY.troopPower（与来袭/家底评估同一出口）；
       守军侧对城市/据点吃城防系数（与 defensePowerOf 同一个 defDivisor 常量）。 */
    /* v89.178（老板：「👥 共派遣 N 兵，这不明摆着吗」）——「共派遣」整行退役（#exp-sum 元素同删）；兵力在各兵种输入框上本就可数。 */
    var pow73 = $('#exp-power');
    if (pow73) {
      var tp74 = (GAME.story && GAME.rules.troopPower) ? GAME.rules.troopPower : null;
      var mine74 = 0;
      Object.keys(city.army || {}).forEach(function (id) {
        var inp74 = document.getElementById('exp-' + id);
        var v74 = inp74 ? Number(inp74.value) || 0 : 0;
        var tr74 = DATA.TROOPS[id];
        if (tp74) mine74 += v74 * tp74(id);
      });
      if (pow73) {
        /* v89.103：本境调运不接战 —— 这里改说"辎重与运力"（战报口径里没有守军） */
        if (ui._expOwn) {
          var _capW = GAME.cargoCapOf(ui.expArmyOf ? ui.expArmyOf() : {});
          pow73.innerHTML = '🚚 本境调运：<b>不接战</b>　随军载重 <b style="color:var(--gold-light);">'
            + U.fmt(_capW) + '</b>（板车 ' + DATA.TROOPS.banche.load + ' / 运输平台 ' + DATA.TROOPS.yunshu.load
            + ' —— 想多运就多带挑夫）';
        } else {
        /* v89.94（B2 · E2）：**军师估算** —— 给区间不给答案（误差随侦察网络收窄）。
           区间跨过 1:1 时提示"凶险"：胜则可入史册 —— 把"势均力敌"框成机会而非劝退。 */
        var pw74 = ui.expPowerOf ? ui.expPowerOf() : null;
        if (pw74 && pw74.def > 0 && pw74.mine > 0) {
          var rLo = pw74.ratioLo, rHi = pw74.ratioHi;
          /* v127：三档文案与阈值改读 `DATA.EXP_EST.bands`（原来写死 1.6/1.0/0.6）；
             并追加「预计损兵」—— 实测"兵力充足"的中位损兵仍有 43%，只说"充足"会被读成"便宜赢"。 */
          var _band = (GAME.battle && GAME.battle.bandOfRatio) ? GAME.battle.bandOfRatio(rLo, rHi) : null;
          var lv74 = _band ? [_band.text, _band.color] : ['兵力偏少，此战凶险', 'var(--gold-light)'];
          var _est = (GAME.battle.expLossEstOf && pw74.ratio != null) ? GAME.battle.expLossEstOf(pw74.ratio) : null;
          var _wipeRisk = !!(DATA.EXP_EST && pw74.ratio != null && pw74.ratio < (DATA.EXP_EST.wipeBelow || 0));
          var estH = (_est == null) ? ''
            : '　<span style="opacity:.85;">预计损兵 <b style="color:'
              + (_est >= 60 ? 'var(--red-light)' : 'var(--gold-light)') + ';">~' + _est + '%</b>'
              + (_wipeRisk ? ' · <span style="color:var(--red-light);">有全灭风险</span>' : '')
              + '</span>';
          pow73.innerHTML = '⚔️ 军师估算　我方 <b style="color:var(--blue-info)">' + U.numText(pw74.mine, 0) +
            '</b>　vs　守军 约 <b style="color:var(--red-light)">' + U.numText(pw74.def, 0) + '</b>' +
            (pw74.aura ? '<span style="color:var(--green-ok);">（🗼 情报站覆盖：情报确凿）</span>'
            : '<span style="opacity:.7;">（误差 ±' + Math.round(pw74.err * 100) + '%）</span>') +
            '　<span style="color:' + lv74[1] + ';font-weight:700;">' + lv74[0] + '</span>' + estH +
            /* v89.178（老板：「区间…情报 Lv（升侦察网络可收窄）这个也没必要」）——区间/情报条退役。 */
            /* ⛔ v89.200（老板 2）：「🧱 围攻：守备 X%（守军与城防已按此衰减）」提示行**整条下线** ——
               围攻（据点/聚落的守备衰减）是独立于战法的据点多波机制，结算口径不变
               （expPowerOf 仍按守备值折算守军/城防；战报里的【围攻】记录照旧）；仅此预估提示行退役。 */
            /* v89.197（老板 1）建立；v89.198（战法全撤）：只提示**计略**计入 */
            /* ⚠️ v127 修：这里原来写的是 `+ ((...)...)`，而上一行已经以 `+` 结尾 →
               形成 `+ +`（一元加号），空字符串被强制成 **0**，面板上一直挂着一个孤零零的 "0"。
               旧文案（"势均力敌"）把它淹没了，v127 加了「预计损兵」后才显形。 */
            ((pw74.mods && pw74.mods.notes.length)
              ? '<br><span style="color:var(--green-ok);">⚔️ 计略已计入：'
                + pw74.mods.notes.join(' · ') + '</span>' : '')
            /* v89.115：斗将预告（我方主将 vs 守将；无守将则空） */
            + ((GAME.battle.duelPreviewOf && ui._expRes && ui._expRes.guard)
              ? (function () {
                  var eg = null, sel = document.getElementById('exp-gen');
                  (GAME.state.generals || []).forEach(function (x) { if (sel && x.id === sel.value) eg = x; });
                  var s0 = eg ? GAME.battle.duelPreviewOf(eg, ui._expRes.guard) : '';
                  return s0 ? '<br><span style="color:var(--gold-light);">' + s0 + '</span>' : '';
                })()
              : '');
        } else {
          pow73.innerHTML = '⚔️ 军师估算　' + ((pw74 && pw74.mine > 0) ? '守军兵力未知（先派侦察）' : '填入兵力后显示对比');
        }
        }   /* /else —— 非本境调运（普通出征才谈守军对比） */
      }
    }
    /* v89.114：搬运预估（随军载重 vs 目标可掠量）—— 兵力一变就重算。
       ⚠️ 放在最外层：不挂在预估块的存在性上（那条链一断，这里就静默失效）。 */
    ui.updateExpHaul();
    /* v89.186：伤兵回收提示行（独立元素，内容不变不重建） */
    ui.expWoundLive186();
  };

  /* ============================================================
   * v89.114（老板「掠夺返回的物资数量，与军队总负重有关」）：出征面板**搬运预估**
   * ------------------------------------------------------------
   * 口径与结算同源，一个数都不另算：
   *   · 载重 = GAME.cargoCapOf(ui.expArmyOf())（与随军辎重运力同一个出口）；
   *   · 目标量 = 名城走 GAME.npcLoot（派生库存，精确）；野地/据点走
   *     GAME.battle.lootEstOf（genLoot 同一公式的期望口径，不掷骰不落账）。
   * 只在「掠夺 / 占领」且目标可掠时出现；占领不取财货（mul=0）会明说，
   * 免得玩家以为"占领也能搬库藏"。超载黄字预警 + 给出路（编运输平台/板车）。
   * ============================================================ */
  ui.updateExpHaul = function () {
    var box = document.getElementById('exp-haul');
    if (!box) return;
    /* ⚠️ 目标一律用 `resolveTarget` 解析后的那份（`ui._expRes`，含真实 lv / dropType / npc）——
       原始 target 没有 lv 字段，拿它估算会把 Lv10 野地按 Lv1 算
       （实机首版栽在这：面板报"约 19 万"、真打却是 365 万）。
       `ui._expRes` 也正是 expedition 结算时用的那个 t —— 面板与战果同一份。 */
    var t = ui._expRes || ui._expTarget, city = GAME.currentCity();
    if (!t || !t.kind || !city || ui._expOwn) { box.innerHTML = ''; return; }
    var mode = GAME.battle.modeOf(ui._expMode || 'occupy');
    var tbl = (t.kind === 'wild') ? DATA.EXPEDITION.wildResMul : DATA.EXPEDITION.cityResMul;
    var mul = (tbl || {})[mode.id];
    if (mul == null) mul = 0;
    var army = ui.expArmyOf ? ui.expArmyOf() : {};
    var any = false;
    for (var k in army) { if (army[k] > 0) { any = true; break; } }
    if (!any) {
      box.innerHTML = '🚚 搬运力 <b style="color:var(--text-dim);">—</b>' +
        '<span style="opacity:.7;">（先选随行兵力：随军载重决定这一趟能搬回多少战利品）</span>';
      return;
    }
    var cap = GAME.cargoCapOf(army);
    if (mul <= 0) {
      box.innerHTML = '🚚 随军载重 <b style="color:var(--gold-light);">' + U.fmt(cap) + '</b>' +
        '<span style="opacity:.7;">（此方式不取财货 —— 载重只用于随军辎重）</span>';
      return;
    }
    var est = 0, i, keys = GAME.TRANSPORT_KEYS;
    if (t.kind === 'city' && t.npc) {
      var lo = GAME.npcLoot(t.npc, mode.id);
      for (i = 0; i < keys.length; i++) est += Math.max(0, Math.floor(lo[keys[i]] || 0));
    } else if (GAME.battle.lootEstOf) {
      est = GAME.battle.lootWeightOf(GAME.battle.lootEstOf(t, mul));
    }
    /* v157.70：估掠与抵达落账读**同一张**路线表（battle.js 的 _routeMul 同源）。
       行动台里选了「穿荒近道」，这里的目标估掠就变多，抵达后战利品也真的变多 ——
       不是一句文案，面板与战果同一份系数。 */
    var _routeMul = (GAME.agenda && GAME.agenda.routeLootMulOf)
      ? GAME.agenda.routeLootMulOf(GAME.agenda.routeIdOf()) : 1;
    var _routeName = (GAME.agenda && GAME.agenda.routeOf)
      ? ((GAME.agenda.routeOf(GAME.agenda.routeIdOf()) || {}).name || '') : '';
    est = Math.round(est * _routeMul);
    var over = est > cap;
    box.innerHTML = '🚚 随军载重 <b style="color:var(--gold-light);">' + U.fmt(cap) + '</b>' +
      '　目标估掠 约 <b>' + U.fmt(est) + '</b>'
      + (_routeMul !== 1 ? '　<span style="opacity:.85;">（含路线「' + _routeName
        + '」战果 ×' + _routeMul.toFixed(2) + '）</span>' : '')
      + (over
        ? '　<span style="color:var(--red-light);font-weight:700;">⚠ 库藏超出运力，只能搬回载重内的部分' +
          '（编入运输平台 / 板车可提高搬运量）</span>'
        : '　<span style="color:var(--green-ok);">✓ 运力可尽取</span>');
  };

  /* ============================================================
   * 加点弹窗（v74 · 老板需求 4/5）：自由属性点 或 道具，二选一
   * ------------------------------------------------------------
   * 入口 = 六维表「加点」列的 ＋ 按钮。六维都开放：
   *   · 四项主属性 —— 自由点 g[stat]+1；道具走 systems.useItem（perm 型，沿用 50 上限）
   *   · 速度 / 体力 —— 只有自由点（无对应道具；分别落到 spdAdd / staAdd，
   *     由 genAttrs 与 staBaseMax 吃进），**只能加、不能减**（老板明示）。
   * ============================================================ */
  ui.STAT_NAMES74 = { tong: '指挥', nz: '治理', yw: '武力', zm: '谋略', spd: '速度', sta: '体力' };
  ui.openStatPlus = function (genId, stat) {
    var s = GAME.state, g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('英雄不存在'); return; }
    var nm = ui.STAT_NAMES74[stat] || stat;
    var a = GAME.genAttrs(g);
    var fp = Math.round(g.freePts || 0);
    var curVal = (stat === 'spd') ? (a.spd || 0) : (stat === 'sta') ? (a.staMax || 0) : (a[stat] || 0);
    /* v91.27（老板）：「自由点不能加速度/体力 —— 这两个只能用道具**临时**提升」。
       → spd/sta 走 attr_buff 临时芯片；四维仍走自由点 + 永久血清。 */
    var isTemp = (stat === 'spd' || stat === 'sta');
    var items = (DATA.ITEMS || []).filter(function (it) {
      return isTemp ? (it.type === 'attr_buff' && it.eff && it.eff[stat] != null)
        : (it.type === 'perm' && it.attr === stat);
    });
    var rows = items.length ? items.map(function (it) {
      var have = (s.items || {})[it.id] || 0;
      var used = isTemp ? 0 : ((g.perm || {})[it.attr] || 0);
      var capped = !isTemp && used >= 50;
      var amt = isTemp ? it.eff[stat] : 1;
      return '<div class="stat-row"><span class="sr-name">' + GAME.itemIcon(it) + ' ' + U.escape(it.name) +
        ' <i class="gd-sub">×' + have + '</i></span>' +
        (isTemp ? '<span class="sr-sub">' + (it.dur || 24) + ' 小时</span>'
          : '<span class="sr-sub">已用 ' + used + ' / 50</span>') +
        '<button class="btn sm' + (have > 0 && !capped ? ' gold' : ' dim') + '" data-action="stat-plus-item"' +
          ' data-gen="' + genId + '" data-stat="' + stat + '" data-item="' + it.id + '"' +
          (have > 0 && !capped ? '' : ' disabled') +
          ' title="' + (capped ? '该英雄此项已达上限 50'
            : (have > 0 ? '使用 1 个：' + nm + ' +' + amt + (isTemp ? '（临时·' + (it.dur || 24) + ' 小时）' : '（永久）')
              : '背包中没有该道具（游商有售）')) + '">＋1</button></div>';
    }).join('') : ('<div class="q-empty">此属性暂无对应道具' + (isTemp ? '。' : '（用自由属性点即可）。') + '</div>');
    ui.openShell({
      title: '＋ ' + nm + ' · ' + U.escape(g.name),
      sub: (isTemp ? '' : '自由属性点 ' + fp + '　·　') + nm + ' 现 ' + curVal +
        ui.help(isTemp
          ? '速度 / 体力**不能用自由属性点加** —— 只能用道具**临时**提升（到期自动失效）。'
          : '自由属性点：每升 1 级获得 = 资质成长值（凡人 +1 … 天启体 +8）。\n' +
            '支持一次加多点：填数量（或点「最多」）后点「加点」；只能加、不能减。\n' +
            '四项主属性另有永久血清（游商 · 血清），每将每项上限 50。'),
      size: 'sm',
      body: (isTemp
        ? '<div class="ui-sub">临时道具（到期失效）</div>' + rows
        : '<div class="ui-sub">自由属性点</div>' +
          '<div class="stat-row"><span class="sr-name">🎯 一次加点</span>' +
            '<span class="sr-sub">剩 ' + fp + ' 点</span>' +
            ui.qtyInput('fp-add-' + genId, 1, 0, fp) +
            '<button class="btn sm' + (fp > 0 ? ' gold' : ' dim') + '" data-action="stat-plus-free"' +
              ' data-gen="' + genId + '" data-stat="' + stat + '" data-qty-from="fp-add-' + genId + '"' +
              (fp > 0 ? '' : ' disabled') +
              ' title="' + (fp > 0 ? nm + ' 一次加点（填数量或点「最多」，只增不减）' : '自由属性点不足：升级获得，每级 = 资质成长值') + '">加点</button></div>' +
          '<div class="ui-sub" style="margin-top:10px;">道具</div>' + rows),
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* 切换出征方式（只更新界面，不重开弹窗） */
  ui.setExpMode = function (m) {
    /* v63：不可用的方式点不动（并说明原因）——不能点进去、填完兵才被拦下来 */
    var lock = ui.expModeLockOf(m);
    if (lock) { ui.toast(lock); return; }
    ui._expMode = m;
    var msel = document.getElementById('exp-mode');   /* v89.58：下拉框与内部状态同步 */
    if (msel && msel.value !== m) msel.value = m;
    /* v89.86（P-23）：换方式 → 二次确认重新计数 + 按钮还原（原为直接改 innerHTML，改走唯一出口） */
    ui.resetExpConfirm();
    var body = $('#modal-root .exp-body');
    if (body) body.dataset.mode = m;
    ui.applyExpMode();
  };

  ui.applyExpMode = function () {
    /* v91.76（固定界面）：方式变化后**不隐藏**接战块，只置灰；
       同时刷新兵力上限标签 / 限制性信息 / 预估 / 辎重。 */
    var _md76 = ui._expMode;
    var _mdef76 = GAME.battle.modeOf(_md76);
    var cur = (ui._expWonder && ui._expWonder.lv)
      ? { battle: true, icon: '⚔' }
      : (ui._expWonder ? { battle: false, icon: '☄' } : (_mdef76 || { battle: false }));
    var _combat76b = !!cur.battle;
    ['exp-a-plan', 'exp-a-tacmenu', 'exp-a-tactic'].forEach(function (cls) {
      var el = document.querySelector('#modal-root .' + cls);
      if (!el) return;
      el.style.opacity = _combat76b ? '' : '.45';
      el.style.pointerEvents = _combat76b ? '' : 'none';
      el.title = _combat76b ? '' : '该出征方式不接战，此设置不适用';
    });
    var box = $('#modal-root .exp-troops');
    if (box) box.style.opacity = _combat76b ? '1' : '.55';
    ui.updateExpLimits();           /* 方式变更 → 重算限制性信息 */
    ui.refreshExpCapLabel();        /* 限额标签随方式刷新（出征容量 / 派驻 / 不限） */
    ui.refreshExpModeLocks();       /* 方式可用性随（派驻城/兵力）变化 */
    if (ui.updateExpMarch) ui.updateExpMarch();
    if (ui.syncCargoEst) ui.syncCargoEst();
  };
  /* 重算方式下拉的置灰态（不重绘弹窗）。 */
  ui.refreshExpModeLocks = function () {
    var sel = document.getElementById('exp-mode');
    if (!sel) return;
    Array.prototype.forEach.call(sel.querySelectorAll('option'), function (o) {
      var lock = ui.expModeAvailOf(o.value);
      o.disabled = !!lock;
      o.title = lock || o.textContent;
    });
  };

  /* ============================================================
   * v89.156（老板 3）：「目标」的备注**只提示出征限制性信息**——
   *   · 领地满（占城 / 拔据点都会产出一座新城）；
   *   · 野地满（占领将转为就地取材）；
   *   · 据点今日已掠夺（每处每日限一次）。
   * 判据全部读**执行端同一出口**（cityCapChk / 政务厅+wildCap / fortRaidedToday）——
   * 界面提示与真拦截不许各算一份。无限制时返回空串（该行不占位）。
   * ============================================================ */
  ui.expLimitsHTML = function () {
    var t = ui._expRes;
    var city = ui.expFromCity();   /* v91.76：到达性限制也按派出城判（领地/野地上限与城相关） */
    if (!t || !city) return '';
    var mode = GAME.battle.modeOf(ui._expMode || 'occupy');
    var out = [];
    /* ① 领地上限（占城 / 拔除据点 = 一座新城；与 battle.prepare 硬闸同一判据） */
    if (mode.occupy && (t.kind === 'city' || t.kind === 'fort')) {
      var cc = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
      if (!cc.ok) out.push('⚠️ ' + U.escape(cc.msg) + ' —— 此战攻克也无法纳入版图');
    }
    /* ② 野地上限（占领未占野地；上限口径与 battle 里"转为就地取材"的判定同源：
       政务厅等级 + 威望/主城加成 cityBonusNum('wildCap')） */
    if (mode.occupy && t.kind === 'wild' && !GAME.map.wildAt(t.ci)) {
      var limit = (GAME.buildingLevel(city, 'guanfu') || 1) + GAME.cityBonusNum(city, 'wildCap');
      var have = ((GAME.state && GAME.state.wilds) || []).length;
      if (have >= limit) {
        out.push('⚠️ 野地已达上限（' + have + ' / ' + limit + '）：本次占领将<b>转为就地取材</b>' +
          '（不再取得产量加成与采集权）——可先放弃一处野地，或升政务厅提高上限。');
      }
    }
    /* ③ 据点今日已掠夺（每处每日限一次；与 raid 方式锁同一判据） */
    if (mode.raid && t.kind === 'fort' && GAME.map.fortRaidedToday && GAME.map.fortRaidedToday(t.ci)) {
      out.push('⚠️ 此据点今日已掠夺（每处每日限一次），明日可再来。');
    }
    return out.map(function (x) { return '<div>' + x + '</div>'; }).join('');
  };
  ui.updateExpLimits = function () {
    var box = document.getElementById('exp-limits');
    if (box) box.innerHTML = ui.expLimitsHTML();
  };

  /* ============================================================
   * ⛔ v158.41 退役：`ui.openAttackModal`（点敌方城 → 「⚔️出征」选方式界面）。
   * ------------------------------------------------------------
   * 老板「总是分层，不要立即出征」：点名城/行政城第一层必须是「看城详情」，
   * 出征（侦查/掠夺/占领）只是面板底部按钮。此面板的观察信息（守军/城防/守将/
   * 库藏/建筑等级）与「侦查/掠夺/占领」按钮已并入 `ui.openCityPanel` 的敌方城分支
   * （见 ui-mapui.js openCityPanel 的 `_enemy` 段），敌方城路由（map3d._openCellPanel
   * 的 npc/adm 分支、main.js 2D 兜底 npc 分支）改走 openCityPanel。
   * 挑衅链路已由 openCityPanel 里 `ui._attackNpc = city` 保住（provoke-city 仍读它）。
   * 如需恢复：本函数见 `backup/v89133/ui-exped.js`（判据：`ui.openAttackModal` 定义）。 */


  /* --------- 任务 --------- */
})();
