# -*- coding: utf-8 -*-
"""v89.128 补丁 K：需求 5 —— 自动采集/自动收获 + 野地驻军规则
   domain.js：doWildGarrison 规则（首队带将/增援无将·直补）+ autoGatherTick（每 24 游戏小时一轮）
   state.js：主循环挂载
   ui.js：自动化面板新增「自动采集/收获」（AUTO_ITEMS / autoOnOf / autoMsgOf / autoPaneHTML）
   main.js：toggle-auto-gather + doToggleAutoGather
   smoke：§110 断言
   ⚠ newline='' 保持 LF
"""
import io

R = 'E:/Deepseekdb/'
n = 0


def do_file(fname, edits):
    global n
    P = R + fname
    s = io.open(P, encoding='utf-8', newline='').read()
    orig = s
    for old, new, tag in edits:
        assert s.count(old) == 1, '[%s] %s 锚点 %d 个' % (fname, tag, s.count(old))
        s = s.replace(old, new)
        n += 1
        print('  ✓ [%s] %s' % (fname, tag))
    assert s != orig
    assert s.count('{') - s.count('}') == orig.count('{') - orig.count('}'), '[%s] 花括号盈亏' % fname
    io.open(P, 'w', encoding='utf-8', newline='').write(s)


# ════════ domain.js ════════
do_file('js/domain.js', [
    # K1 doWildGarrison 规则（首队带将 / 增援无将·直补）
    ("""    /* ============================================================
     * v89.87（老板需求 2）：改走**行军通道**（原先瞬间入驻）——统一出口。
     * "一律要选将"：驻守也需带队将领（护送到位，兵立于野地编制）。
     * 上限校验保留在出发（抵达时 wildGarrisonAdd 仍有 overflow 兜底）。
     * ============================================================ */
    if (!genId) return { ok: false, msg: '请选择带队将领' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '将领不存在' };
    if (gen.status && gen.status !== 'idle') {
      return { ok: false, msg: gen.name + ' 正在执行其他任务（' + gen.status + '）' };
    }
    var _gc1 = GAME.genCityOf ? GAME.genCityOf(gen) : null;   /* 返回城对象 */
    if (!_gc1 || _gc1.id !== city.id) {
      return { ok: false, msg: gen.name + ' 不在' + city.name };
    }
    var d = GAME.march.dispatch({ kind: 'wild', x: x, y: y }, 'station', army, gen.id);""",
     """    /* ============================================================
     * v89.87（老板需求 2）：改走**行军通道**（原先瞬间入驻）——统一出口。
     * v89.128（老板 需求 5）：「每个野地只能驻军一队（一个将领，驻军后，
     *   只能通过派驻无将领军队，加入原有驻军中）」——
     *   · **首队**（该野地尚无驻军）：必须带将、走行军通道（带队立编）；
     *   · **增援**（已有驻军）：**只收无将军队** —— 带将反而报错（防第二队/第二个将领）；
     *     增援为**点位直补**（不走行军）：行军链路以"带队将领"为轴
     *     （dispatch → arrive → expedition 全程读 gen），无将队伍走那条链要牵连
     *     四处判空、风险大于收益（诚实缺口见 docs/v89128）。
     * 军账守恒：直补的兵**此刻从城内扣**；超上限者 overflow 原样回城。
     * ============================================================ */
    var _hasGar128 = GAME.wildGarrisonTotal(w.garrison) > 0;
    if (!_hasGar128 && !genId) return { ok: false, msg: '首次驻军需选择带队将领（此后增援不带将）' };
    if (_hasGar128 && genId) return { ok: false, msg: '该野地已有驻军 —— 增援请勿带将（只能派驻无将领军队加入）' };
    if (_hasGar128) {
      /* 增援直补：扣城兵 → 写驻军（overflow 回城） */
      plan.forEach(function (pr) { city.army[pr[0]] -= pr[1]; });
      var _ga128 = GAME.wildGarrisonAdd(x, y, army, city.id);
      if (_ga128.overflow) {
        for (var _o128 in _ga128.overflow) city.army[_o128] = (city.army[_o128] || 0) + _ga128.overflow[_o128];
      }
      GAME.log.war('🛡️ ' + (w.x + ',' + w.y) + ' 驻军增援 +' + U.fmt(_ga128.add || 0) + ' 名（不带将）'
        + (_ga128.overflow && Object.keys(_ga128.overflow).length ? '；超出上限者已回城' : ''));
      return { ok: true, msg: '增援驻军 ' + U.fmt(_ga128.add || 0) + ' 名（不带将，即时到位）' };
    }
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '将领不存在' };
    if (gen.status && gen.status !== 'idle') {
      return { ok: false, msg: gen.name + ' 正在执行其他任务（' + gen.status + '）' };
    }
    var _gc1 = GAME.genCityOf ? GAME.genCityOf(gen) : null;   /* 返回城对象 */
    if (!_gc1 || _gc1.id !== city.id) {
      return { ok: false, msg: gen.name + ' 不在' + city.name };
    }
    var d = GAME.march.dispatch({ kind: 'wild', x: x, y: y }, 'station', army, gen.id);""",
     'K1 驻军规则'),
    # K2 autoGatherTick（插在 finishGather 之后 abandonGather 之前）
    ("""  /* 放弃采集（兵力返还、无任何收益 —— 原版规则） */
  GAME.abandonGather = function (id) {""",
     """  /* ============================================================
   * v89.128（老板 需求 5）：「增加自动采集和自动收获功能，每 24h 执行一次。
   *   如果野地存在驻军且可采集，所有驻军进入采集状态。」
   * ------------------------------------------------------------
   * 节奏：每 **24 游戏小时** 一轮（与采集封顶 maxHours 同轴）——轮点先**收获**
   *   （ready 的采集队结算，兵力按既有口径回驻军），再**开采集**
   *   （有驻军、可采集、且尚无采集队的野地 → 驻军**全部**转入采集）。
   * 开关 = settings.autoGather；状态 = s.autoGatherState { lastAt, msg, at }。
   * 与手动操作同一批出口（startGather / finishGather）——不另写第二套结算。
   * ============================================================ */
  GAME.autoGatherTick = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoGather) return null;
    var now = (s.world && s.world.elapsed) || 0;
    var st = s.autoGatherState = s.autoGatherState || { lastAt: now - 86400, msg: '', at: 0 };
    if (now - (st.lastAt || 0) < 86400) return null;   /* 一轮 = 24 游戏小时 */
    st.lastAt = now;
    st.at = U.now();
    var done = [];
    /* ① 收获：ready（≥1 游戏小时）的采集队全部结算 */
    (GAME.gatherList() || []).slice().forEach(function (g) {
      var y = GAME.gatherYield(g);
      if (y && y.ready) {
        var r = GAME.finishGather(g.id);
        if (r && r.ok) done.push('收 ' + U.fmt(r.amount || 0));
      }
    });
    /* ② 采集：有驻军且可采集的野地 → 驻军全部转入采集 */
    (s.wilds || []).forEach(function (w) {
      if (!(GAME.wildGarrisonTotal(w.garrison) > 0)) return;
      if (GAME.gatherAt(w.x, w.y)) return;                    /* 已有采集队 */
      var chk = GAME.canStartGather(w.x, w.y);
      if (!chk.ok) return;
      var army = {};
      var _any = false;
      for (var k in (w.garrison.troops || {})) {
        var cnt = Math.floor(w.garrison.troops[k] || 0);
        if (cnt > 0) { army[k] = cnt; _any = true; }
      }
      if (!_any) return;
      var r2 = GAME.startGather(w.x, w.y, null, army, { from: 'garrison', cityId: w.garrison.cityId });
      if (r2 && r2.ok) done.push('采(' + w.x + ',' + w.y + ')');
    });
    var msg = done.length ? ('本轮：' + done.join('、')) : '本轮无事（无可收 / 无可采）';
    st.msg = msg;
    GAME.log('🌾 自动采集/收获（每 24 游戏小时一轮）：' + msg, 'war');
    return { ok: true, msg: msg };
  };

  /* 放弃采集（兵力返还、无任何收益 —— 原版规则） */
  GAME.abandonGather = function (id) {""",
     'K2 autoGatherTick'),
])

# ════════ state.js ════════
do_file('js/state.js', [
    ("""    /* v89.115（老板「自动菜单增加一个自动治疗伤兵」）：伤兵满金即治（节流在域层里） */
    if (GAME.autoHeal) GAME.autoHeal();""",
     """    /* v89.115（老板「自动菜单增加一个自动治疗伤兵」）：伤兵满金即治（节流在域层里） */
    if (GAME.autoHeal) GAME.autoHeal();
    /* v89.128（需求 5）：自动采集/收获（每 24 游戏小时一轮，节流在域层里） */
    if (GAME.autoGatherTick) GAME.autoGatherTick();""",
     'K3 主循环挂载'),
])

# ════════ ui.js ════════
do_file('js/ui.js', [
    ("""    { id: 'lord', icon: '🧘', name: '自动练功', act: 'toggle-auto-lord' },""",
     """    { id: 'lord', icon: '🧘', name: '自动练功', act: 'toggle-auto-lord' },
    /* v89.128（需求 5）：自动采集/收获（每 24 游戏小时一轮） */
    { id: 'gather', icon: '🌾', name: '自动采集/收获', act: 'toggle-auto-gather' },""",
     'K4a AUTO_ITEMS'),
    ("""    if (id === 'invasion') return GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true;""",
     """    if (id === 'gather') return !!(s.settings && s.settings.autoGather);
    if (id === 'invasion') return GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true;""",
     'K4b autoOnOf'),
    ("""    if (id === 'recruit') {
      var c = GAME.innAutoCfg ? GAME.innAutoCfg() : null;
      return (c && c.on) ? ('门槛 ' + ((DATA.GEN_RANK_BY_ID[c.min] || {}).name || c.min)) : '未开启';""",
     """    if (id === 'gather') return (s.autoGatherState && s.autoGatherState.msg) || '未开启';
    if (id === 'recruit') {
      var c = GAME.innAutoCfg ? GAME.innAutoCfg() : null;
      return (c && c.on) ? ('门槛 ' + ((DATA.GEN_RANK_BY_ID[c.min] || {}).name || c.min)) : '未开启';""",
     'K4c autoMsgOf'),
    ("""    } else if (it.id === 'recruit') {""",
     """    } else if (it.id === 'gather') {
      var _ws128 = (s.wilds || []).filter(function (w) { return GAME.wildGarrisonTotal(w.garrison) > 0; });
      var _gn128 = GAME.gatherList().length, _gm128 = DATA.GATHER.maxActive;
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<span class="ui-sub">有驻军野地 <b>' + _ws128.length + '</b> · 采集队 <b>' + _gn128 + '/' + _gm128 + '</b>' +
          (s.autoGatherState && s.autoGatherState.at ? '　·　上次执行 ' + U.dur((U.now() - s.autoGatherState.at) / 1000) + '前' : '') +
          '</span></div>' +
        '<div class="auto-note">每 <b>24 游戏小时</b>一轮：先<b>自动收获</b>（满 1 游戏小时即可收，24 小时封顶），' +
          '再把<b>有驻军的可采野地</b>全部转入采集（驻军全员入队，采完自动回驻军）。' +
          '目标已有采集队 / 野地不可采 / 无驻军 → 自动跳过；与手动采集共用同一套结算出口。</div>';
    } else if (it.id === 'recruit') {""",
     'K4d autoPaneHTML'),
])

# ════════ main.js ════════
do_file('js/main.js', [
    ("""      case 'toggle-auto-lord': GAME.doToggleAutoLord(); break;   /* v89.83：第 4 条自动化 */""",
     """      case 'toggle-auto-lord': GAME.doToggleAutoLord(); break;   /* v89.83：第 4 条自动化 */
      case 'toggle-auto-gather': GAME.doToggleAutoGather(); break;   /* v89.128：自动采集/收获 */""",
     'K5a case'),
    ("""  GAME.doToggleAutoHeal = function () {""",
     """  /* v89.128（需求 5）：自动采集/收获开关（仿自动治疗） */
  GAME.doToggleAutoGather = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings.autoGather = !s.settings.autoGather;
    if (s.settings.autoGather) {
      s.autoGatherState = { lastAt: ((s.world && s.world.elapsed) || 0) - 86400, msg: '已开启，待命', at: 0 };   /* 立刻试一轮 */
      var r = GAME.autoGatherTick();
      ui.toast(r && r.ok ? ('🌾 ' + r.msg) : '🌾 自动采集/收获已开启（每 24 游戏小时一轮）');
    } else {
      s.autoGatherState = null;
      ui.toast('自动采集/收获已关闭');
    }
    GAME.refreshView();
  };
  GAME.doToggleAutoHeal = function () {""",
     'K5b doToggleAutoGather'),
])

print('patch K OK · 共 %d 处' % n)
