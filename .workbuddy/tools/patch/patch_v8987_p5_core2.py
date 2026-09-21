# -*- coding: utf-8 -*-
"""v89.87 需求2：domain.js 三函数（承 p5_core：data/battle 已落盘）"""
import io

P3 = r'E:\Deepseekdb\js\domain.js'
s3 = io.open(P3, encoding='utf-8', newline='').read()

# --- doTransferTroops ---
old5 = "  GAME.doTransferTroops = function (fromId, toId, army) {"
new5 = "  GAME.doTransferTroops = function (fromId, toId, army, genId) {"
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
old8 = "  GAME.doWildGarrison = function (x, y, army, cityId) {"
new8 = "  GAME.doWildGarrison = function (x, y, army, cityId, genId) {"
assert s3.count(old8) == 1, ('wg-head', s3.count(old8))
s3 = s3.replace(old8, new8, 1)

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

# --- startGather：gen 校验段 ---
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
         此处只保留"不要在采集别处"的重复检查 */
      if (!opts.arrived) {
        if (gen.status === 'march') return { ok: false, msg: gen.name + ' 正在出征中' };
        if (gen.status === 'guard') return { ok: false, msg: gen.name + ' 已任守将，请先解除任命' };
      }
      if (GAME.gatherByGen(genId)) return { ok: false, msg: gen.name + ' 已在采集别处' };
    } else {"""
assert s3.count(old9) == 1, ('sg-gen', s3.count(old9))
s3 = s3.replace(old9, new9, 1)

# --- startGather：体力/池子段（含注释行修正） ---
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
    /* 驻军被抽空 → 这块地就不再有驻军（等级会恢复衰减，与撤回同义） */
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
      /* 驻军被抽空 → 这块地就不再有驻军（等级会恢复衰减，与撤回同义） */
      if (fromGar && !GAME.wildGarrisonTotal(gar)) w.garrison = null;
    }
    if (!fromGar) {
      if (!opts.arrived) GAME.setStaNow(gen, GAME.staNow(gen) - G.stamina);   /* arrived：出发时已扣 */
      gen.status = 'gather';
      gen.cityId = null;
    }"""
assert s3.count(old10) == 1, ('sg-pool', s3.count(old10))
s3 = s3.replace(old10, new10, 1)

# --- dispatchGather 新函数 ---
old11 = "  GAME.startGather = function (x, y, genId, army, opts) {"
new11 = """  /* ============================================================
   * v89.87（老板需求 2）：采集**出发** —— 走行军通道
   * ------------------------------------------------------------
   * 原先 doStartGather 直接调 startGather（瞬间扣兵、即刻开采）；
   * 现在与出征同通道：dispatch 出发（扣兵/扣体力）→ 抵达后由
   * expedition 的 gather 分支调 startGather(arrived) 开始采。
   * 驻军开采（from:'garrison'）**不走此路径** —— 兵本就在野地，属就地开采
   * （保持 startGather 原调用，不经行军）。
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
print('OK domain.js 三函数（含 dispatchGather）')
