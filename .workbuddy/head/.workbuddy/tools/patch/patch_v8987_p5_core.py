# -*- coding: utf-8 -*-
"""v89.87 需求2：派兵统一走行军通道（data/battle/domain 核心）

① data.js：modes 追加 transfer / station / gather 三个方式
② battle.js：resolveTarget 支持 owncity；prepare 三校验；expedition 顶部
   owncity/gather 抵达落账分支（在侦查判定之前）
③ domain.js：doTransferTroops / doWildGarrison 改走 dispatch；startGather 支持
   arrived；新增 GAME.dispatchGather
"""
import io

# ============================================================
# ① data.js：三个新方式
# ============================================================
P1 = r'E:\Deepseekdb\js\data.js'
s1 = io.open(P1, encoding='utf-8', newline='').read()
old1 = """      { id: 'occupy', name: '占领', icon: '🚩', stamina: 22, energy: 9, battle: true, occupy: true, station: true,
        desc: '击溃守军并据而有之：野地归我，军队就地驻守（守地不衰减，直至召回）；据点被拔除（打完撤军、当日移除、次日重置）；名城易主，军仍班师。' },
    ],"""
new1 = """      { id: 'occupy', name: '占领', icon: '🚩', stamina: 22, energy: 9, battle: true, occupy: true, station: true,
        desc: '击溃守军并据而有之：野地归我，军队就地驻守（守地不衰减，直至召回）；据点被拔除（打完撤军、当日移除、次日重置）；名城易主，军仍班师。' },
      /* ============================================================
       * v89.87（老板需求 2）：**派兵统一走行军通道**
       * ------------------------------------------------------------
       * 三条"不带战斗"的调派路径并入本表（原先瞬间到达、绕过行军）：
       *   · transfer —— 跨城调兵（含新城调兵入口）
       *   · station  —— 野地增派驻守（到己方野地，不接战）
       *   · gather   —— 野地采集（抵达后开始采集）
       * 它们与出征共用 march.dispatch：有行军时间、军务可见、可召回。
       * 体力/精力成本保持 0（transfer/station）与采集原值（gather=6）——
       * 本批只并入**通道**，不给这些操作加价。
       * ⚠ station 的 battle:true 是为了让 prepare 继续做兵力/校场校验；
       *   它在 expedition 里由既有的 station 分支短路为"入驻不接战"。
       * ⚠ transfer/gather 的 battle:false —— expedition 顶部有**专属分支**
       *   在"侦查判定"之前处理它们（否则会被当成侦查结算）。
       * ============================================================ */
      { id: 'transfer', name: '调兵', icon: '🚚', stamina: 0, energy: 0, battle: false, occupy: false,
        desc: '兵力调往本境他城：走行军通道，抵城入编（主将随军入驻新城）。' },
      { id: 'station', name: '驻守', icon: '🛡️', stamina: 0, energy: 0, battle: true, station: true,
        desc: '向已属我方的野地增派驻军：走行军通道，抵达即驻（守地不衰减，直至召回）。' },
      { id: 'gather', name: '采集', icon: '⛏️', stamina: 6, energy: 0, battle: false, occupy: false,
        desc: '开赴己方野地开采：走行军通道，抵达后开始采集（满 1 小时方有收成）。' },
    ],"""
assert s1.count(old1) == 1, ('data-modes', s1.count(old1))
io.open(P1, 'w', encoding='utf-8', newline='').write(s1.replace(old1, new1, 1))
print('OK data.js modes')

# ============================================================
# ② battle.js：resolveTarget owncity + prepare 校验 + expedition 分支
# ============================================================
P2 = r'E:\Deepseekdb\js\battle.js'
s2 = io.open(P2, encoding='utf-8', newline='').read()

old2 = """    if (target.kind === 'city') {
      var npc = target.npc || null;   // 允许直接传入城池对象（测试/临时目标）
      if (!npc) (s.map.cities || []).forEach(function (c) { if (c.id === target.id) npc = c; });
      if (!npc) return { ok: false, msg: '目标城池不存在（可能已被攻占）' };"""
new2 = """    /* v89.87（老板需求 2）：调兵目标 —— 本境自家城池（走行军通道） */
    if (target.kind === 'owncity') {
      var oc = GAME.cityById(target.id);
      if (!oc) return { ok: false, msg: '目标城池不存在' };
      return { ok: true, kind: 'owncity', id: oc.id, x: oc.x, y: oc.y, name: oc.name, city: oc };
    }
    if (target.kind === 'city') {
      var npc = target.npc || null;   // 允许直接传入城池对象（测试/临时目标）
      if (!npc) (s.map.cities || []).forEach(function (c) { if (c.id === target.id) npc = c; });
      if (!npc) return { ok: false, msg: '目标城池不存在（可能已被攻占）' };"""
assert s2.count(old2) == 1, ('resolve', s2.count(old2))
s2 = s2.replace(old2, new2, 1)

old3 = """    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) return { ok: false, msg: t.msg || '目标无效' };"""
new3 = """    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) return { ok: false, msg: t.msg || '目标无效' };

    /* v89.87（老板需求 2）：调兵 / 驻守 / 采集的前置校验（统一出口的口子） */
    if (mode.id === 'transfer' && t.kind !== 'owncity') return { ok: false, msg: '调兵目标须为本境城池' };
    if (mode.id === 'station' && !(t.kind === 'wild' && GAME.map.wildAt(t.x, t.y))) {
      return { ok: false, msg: '驻守目标须是已属我方的野地' };
    }
    if (mode.id === 'gather' && !(t.kind === 'wild' && GAME.map.wildAt(t.x, t.y))) {
      return { ok: false, msg: '采集目标须是已属我方的野地' };
    }"""
assert s2.count(old3) == 1, ('prepare', s2.count(old3))
s2 = s2.replace(old3, new3, 1)

old4 = """    /* ---- 侦查：不接战 ---- */
    if (!mode.battle) {"""
new4 = """    /* ============================================================
     * v89.87（老板需求 2）：非战斗行动抵达落账 —— 调兵（owncity）/ 采集（gather）
     * ------------------------------------------------------------
     * 两条路径与出征共用同一行军通道（dispatch 出发时已扣兵/体力），
     * 抵达时在此落账。**必须放在侦查判定之前**：两者的 mode.battle 都是
     * false，若按顺序走会被当成侦查结算（探守军、写侦查公文）。
     * · 调兵：抵达入城（再验一次目标城校场，超容则整体折返）；
     * · 采集：调既有 startGather 的 arrived 路径（跳过重复扣减）。
     * ============================================================ */
    if (t.kind === 'owncity') {
      var _to = t.city;
      var _ocap = (GAME.buildingLevel(_to, 'xiaochang') || 0) * 10000;
      var _np = 0, _ap = 0;
      for (var _oa in (_to.army || {})) _np += (DATA.TROOPS[_oa] ? DATA.TROOPS[_oa].pop : 1) * _to.army[_oa];
      for (var _ob in atkArmy) _ap += (DATA.TROOPS[_ob] ? DATA.TROOPS[_ob].pop : 1) * atkArmy[_ob];
      if (_ocap > 0 && _np + _ap > _ocap) {
        /* 折返（_expArmySettled 保持 false → arrive 兜底原路退回出发城） */
        return { ok: false, msg: _to.name + ' 校场容量不足（途中已满编）' };
      }
      var _mv = 0;
      for (var _ok2 in atkArmy) {
        var _n2 = Math.floor(atkArmy[_ok2] || 0);
        if (_n2 <= 0) continue;
        _to.army[_ok2] = (_to.army[_ok2] || 0) + _n2;
        _mv += _n2;
      }
      gen.cityId = _to.id;                    /* 主将随军入驻新城（城建制） */
      _expArmySettled = true;                 /* 军账已结（兵入新城） */
      GAME.log('🚚 军队调防：' + U.fmt(_mv) + ' 兵入 ' + _to.name + '（' + gen.name + ' 统带）');
      return { ok: true, mode: mode.id, peaceful: true, target: t, moved: _mv,
        msg: '已入驻 ' + _to.name + '（+' + U.fmt(_mv) + ' 兵）' };
    }
    if (mode.id === 'gather') {
      var _gr = GAME.startGather(t.x, t.y, gen.id, atkArmy, { arrived: true, cityId: city.id });
      if (_gr.ok) _expArmySettled = true;     /* 兵已移交采集队（军账在采集记录上） */
      return { ok: _gr.ok, mode: 'gather', peaceful: true, target: t, gather: _gr,
        msg: _gr.msg };
    }

    /* ---- 侦查：不接战 ---- */
    if (!mode.battle) {"""
assert s2.count(old4) == 1, ('exp-branch', s2.count(old4))
s2 = s2.replace(old4, new4, 1)
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('OK battle.js 分支')

# ============================================================
# ③ domain.js：doTransferTroops / doWildGarrison / startGather / dispatchGather
# ============================================================
P3 = r'E:\Deepseekdb\js\domain.js'
s3 = io.open(P3, encoding='utf-8', newline='').read()

# --- doTransferTroops ---
old5 = """  GAME.doTransferTroops = function (fromId, toId, army) {
    var s = GAME.state;
    if (!s) return { ok: false, msg: '尚未开局' };
    var from = GAME.cityById(fromId), to = GAME.cityById(toId);
    if (!from || !to) return { ok: false, msg: '城池不存在' };
    if (from.id === to.id) return { ok: false, msg: '不能派驻本城' };"""
new5 = """  GAME.doTransferTroops = function (fromId, toId, army, genId) {
    var s = GAME.state;
    if (!s) return { ok: false, msg: '尚未开局' };
    var from = GAME.cityById(fromId), to = GAME.cityById(toId);
    if (!from || !to) return { ok: false, msg: '城池不存在' };
    if (from.id === to.id) return { ok: false, msg: '不能派驻本城' };"""
assert s3.count(old5) == 1, ('tt-head', s3.count(old5))
s3 = s3.replace(old5, new5, 1)

old6 = """    for (var c in army) {
      var m = Math.floor(army[c] || 0);
      if (m <= 0) continue;
      from.army[c] -= m;
      to.army[c] = (to.army[c] || 0) + m;
    }
    GAME.log('⚔ 军队派驻：' + U.fmt(moved) + ' 兵 由 ' + from.name + ' 调往 ' + to.name + '。');
    return { ok: true, msg: '已派驻 ' + U.fmt(moved) + ' 兵 至 ' + to.name };
  };"""
new6 = """    /* ============================================================
     * v89.87（老板需求 2）：改走**行军通道**（原先瞬间到达直接改兵账）——
     * "派兵只通过出征通道"（老板拍板，含自身城池/野地/其他城池统一出口）。
     * 校验（含目标城校场容量）仍在出发完成；抵达时再验一次，
     * 超容则大军整体折返（见 expedition 的 owncity 分支）。
     * "一律要选将"（老板拍板）：调兵也需带队将领（随军入驻新城）。
     * ============================================================ */
    if (!genId) return { ok: false, msg: '请选择带队将领' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '将领不存在' };
    if (gen.status && gen.status !== 'idle') {
      return { ok: false, msg: gen.name + ' 正在执行其他任务（' + gen.status + '）' };
    }
    if (GAME.genCityOf && GAME.genCityOf(gen) !== from.id) {
      return { ok: false, msg: gen.name + ' 不在' + from.name };
    }
    var d = GAME.march.dispatch({ kind: 'owncity', id: to.id }, 'transfer', army, gen.id);
    if (!d.ok) return d;
    return { ok: true, msg: '大军开拔：' + U.fmt(moved) + ' 兵 → ' + to.name + '（' + d.msg + '）' };
  };"""
assert s3.count(old6) == 1, ('tt-tail', s3.count(old6))
s3 = s3.replace(old6, new6, 1)

# --- doWildGarrison ---
old7 = """    plan.forEach(function (p) {
      city.army[p[0]] -= p[1];
      if (city.army[p[0]] <= 0) delete city.army[p[0]];
    });
    /* v89.63：写入走唯一出口（上面已校验过驻军上限，故这里的 overflow 必为空） */
    GAME.wildGarrisonAdd(x, y, army, city.id);
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : w.type;
    GAME.log('驻军 ' + U.fmt(total) + ' 名于 ' + tn + ' Lv' + w.level + '（守地不衰减）');
    return { ok: true, msg: '已驻军 ' + U.fmt(total) + ' 名' };
  };"""
new7 = """    /* ============================================================
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
    if (GAME.genCityOf && GAME.genCityOf(gen) !== city.id) {
      return { ok: false, msg: gen.name + ' 不在' + city.name };
    }
    var d = GAME.march.dispatch({ kind: 'wild', x: x, y: y }, 'station', army, gen.id);
    if (!d.ok) return d;
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : w.type;
    return { ok: true, msg: '大军开拔：' + U.fmt(total) + ' 兵 → ' + tn + ' Lv' + w.level + '（' + d.msg + '）' };
  };"""
assert s3.count(old7) == 1, ('wg-tail', s3.count(old7))
s3 = s3.replace(old7, new7, 1)

# doWildGarrison 签名
old8 = "  GAME.doWildGarrison = function (x, y, army, cityId) {"
new8 = "  GAME.doWildGarrison = function (x, y, army, cityId, genId) {"
assert s3.count(old8) == 1, ('wg-head', s3.count(old8))
s3 = s3.replace(old8, new8, 1)

# --- startGather：arrived 支持 ---
old9 = """    var gen = null;
    if (!fromGar) {
      s.generals.forEach(function (g) { if (g.id === genId) gen = g; });
      if (!gen) return { ok: false, msg: '请选择带队的将领' };
      if (gen.status === 'march') return { ok: false, msg: gen.name + ' 正在出征中' };
      if (gen.status === 'guard') return { ok: false, msg: gen.name + ' 已任守将，请先解除任命' };
      if (GAME.gatherByGen(genId)) return { ok: false, msg: gen.name + ' 已在采集别处' };
    } else {"""
new9 = """    var gen = null;
    if (!fromGar) {
      s.generals.forEach(function (g) { if (g.id === genId) gen = g; });
      if (!gen) return { ok: false, msg: '请选择带队的将领' };
      /* v89.87（需求 2）：arrived（行军队列抵达）时状态与体力已由出发流程处理；
         此处只做"不要在采集别处"的重复检查 */
      if (!opts.arrived) {
        if (gen.status === 'march') return { ok: false, msg: gen.name + ' 正在出征中' };
        if (gen.status === 'guard') return { ok: false, msg: gen.name + ' 已任守将，请先解除任命' };
      }
      if (GAME.gatherByGen(genId)) return { ok: false, msg: gen.name + ' 已在采集别处' };
    } else {"""
assert s3.count(old9) == 1, ('sg-gen', s3.count(old9))
s3 = s3.replace(old9, new9, 1)

old10 = """    if (!fromGar && GAME.staNow(gen) < G.stamina) {
      return { ok: false, msg: gen.name + ' 体力不足（需 ' + G.stamina + '，现 ' + Math.round(GAME.staNow(gen)) + '）' };
    }
    var city = GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var pool = fromGar ? gar.troops : city.army;
    for (var a in army) {
      if ((pool[a] || 0) < army[a]) {
        return { ok: false, msg: (fromGar ? '驻军' : '兵力') + '不足（' + (DATA.TROOPS[a] ? DATA.TROOPS[a].name : a) + '）' };
      }
    }
    for (var a2 in army) {
      pool[a2] -= army[a2];
      if (fromGar && pool[a2] <= 0) delete pool[a2];
    }
    if (fromGar && !GAME.wildGarrisonTotal(gar)) w.garrison = null;
    if (!fromGar) {
      GAME.setStaNow(gen, GAME.staNow(gen) - G.stamina);   /* v66：唯一写入口 */
      gen.status = 'gather';
      gen.cityId = null;
    }"""
new10 = """    if (!fromGar && !opts.arrived && GAME.staNow(gen) < G.stamina) {
      return { ok: false, msg: gen.name + ' 体力不足（需 ' + G.stamina + '，现 ' + Math.round(GAME.staNow(gen)) + '）' };
    }
    var city = (opts.cityId && GAME.cityById(opts.cityId)) || GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    /* v89.87（需求 2）：arrived（抵达落账）时兵力已在 dispatch 出发时扣离城池，
       此处**跳过** pool 校验与扣减（只建采集记录）。 */
    if (!opts.arrived) {
      var pool = fromGar ? gar.troops : city.army;
      for (var a in army) {
        if ((pool[a] || 0) < army[a]) {
          return { ok: false, msg: (fromGar ? '驻军' : '兵力') + '不足（' + (DATA.TROOPS[a] ? DATA.TROOPS[a].name : a) + '）' };
        }
      }
      for (var a2 in army) {
        pool[a2] -= army[a2];
        if (fromGar && pool[a2] <= 0) delete pool[a2];
      }
      if (fromGar && !GAME.wildGarrisonTotal(gar)) w.garrison = null;
    }
    if (!fromGar) {
      if (!opts.arrived) GAME.setStaNow(gen, GAME.staNow(gen) - G.stamina);   /* arrived：出发时已扣 */
      gen.status = 'gather';
      gen.cityId = null;
    }"""
assert s3.count(old10) == 1, ('sg-pool', s3.count(old10))
s3 = s3.replace(old10, new10, 1)

# --- dispatchGather 新函数（插在 startGather 前） ---
old11 = "  GAME.startGather = function (x, y, genId, army, opts) {"
new11 = """  /* ============================================================
   * v89.87（老板需求 2）：采集**出发** —— 走行军通道
   * ------------------------------------------------------------
   * 原先 doStartGather 直接调 startGather（瞬间扣兵、即刻开采）；
   * 现在与出征同通道：dispatch 出发（扣兵/扣体力）→ 抵达后由
   * expedition 的 gather 分支调 startGather(arrived) 开始采。
   * 驻军开采（from:'garrison'）**不走此路径** —— 兵本就在野地，
   * 属就地开采（保持 startGather 原调用）。
   * ============================================================ */
  GAME.dispatchGather = function (x, y, genId, army) {
    var s = GAME.state;
    var chk = GAME.canStartGather(x, y);
    if (!chk.ok) return chk;
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的将领' };
    if (gen.status && gen.status !== 'idle') {
      return { ok: false, msg: gen.name + ' 正在执行其他任务（' + gen.status + '）' };
    }
    var troops = 0;
    for (var k in (army || {})) troops += Math.floor(army[k] || 0);
    if (troops <= 0) return { ok: false, msg: '请派遣兵力（兵越多收成越高）' };
    var d = GAME.march.dispatch({ kind: 'wild', x: x, y: y }, 'gather', army, gen.id);
    if (!d.ok) return d;
    return { ok: true, msg: '采集队开拔：' + U.fmt(troops) + ' 兵（' + d.msg + '）' };
  };

  GAME.startGather = function (x, y, genId, army, opts) {"""
assert s3.count(old11) == 1, ('sg-head', s3.count(old11))
s3 = s3.replace(old11, new11, 1)

io.open(P3, 'w', encoding='utf-8', newline='').write(s3)
print('OK domain.js 三函数')
