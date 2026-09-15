/* ============================================================
 * domain.js  核心业务逻辑（真实数值版）
 * 建造/升级/拆除、城外资源建筑、造兵、任务、将领、产出计算
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  /* 科技加成取值（统一入口；缺失时返回 0，保证测试环境可跑） */
  function techB(type) {
    return (GAME.systems && GAME.systems.techBonus) ? GAME.systems.techBonus(type) : 0;
  }

  /* --------- 当前操作城池（支持多城，默认首城） --------- */
  GAME.currentCity = function () {
    var s = GAME.state;
    if (!s || !s.cities.length) return null;
    var id = (GAME.ui && GAME.ui._cityId);
    if (id) { var c = GAME.cityById(id); if (c) return c; }
    return s.cities[0];
  };

  /* --------- 资源检查/支付（time 字段不计入资源） --------- */
  GAME.canAfford = function (cost) {
    var s = GAME.state; if (!s) return false;
    for (var k in cost) {
      if (k === 'time') continue;
      if ((s.res[k] || 0) < cost[k]) return false;
    }
    return true;
  };
  GAME.payCost = function (cost) {
    var s = GAME.state; if (!s) return;
    for (var k in cost) {
      if (k === 'time') continue;
      s.res[k] = (s.res[k] || 0) - cost[k];
    }
  };
  /* 按比例缩放一份造价对象（仅用于展示返还量，不改变资源） */
  GAME.scaledCost = function (cost, ratio) {
    var o = {};
    for (var k in cost) o[k] = Math.floor((cost[k] || 0) * ratio);
    return o;
  };
  GAME.refundCert = function (cost, ratio) {
    ratio = ratio == null ? 0.5 : ratio;
    var s = GAME.state; if (!s) return;
    for (var k in cost) s.res[k] = (s.res[k] || 0) + Math.floor(cost[k] * ratio);
  };

  /* ============================================================
   * 满级专精（v28 · 需求 1）
   * ------------------------------------------------------------
   * 建筑达到等级上限（DATA.MAX_BLEVEL）时，按 DATA.MASTERY 给一条加成。
   * 加成一律**按当前城**判定 —— "这座城的民房满级" 与 "别城的仓库满级" 是两回事；
   * 只有全局口径的量（如建造队列、仓储存量）由调用方决定用全境还是本城，
   * 所以这里只提供"取值"这一件事，不给默认口径。
   * ============================================================ */
  GAME.masteryOf = function (city, bid) {
    if (!city) return false;
    var b = DATA.BUILDINGS[bid];
    if (!b) return false;
    return (GAME.buildingLevel(city, bid) || 0) >= b.maxLevel;
  };
  /* 取某一专精键的合计值。city 传 null 时表示**全境**（任一城满级即计入）。 */
  GAME.mastery = function (key, city) {
    var sum = 0, list = DATA.MASTERY || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.key !== key) continue;
      if (city === null) {
        var ok = false;
        ((GAME.state && GAME.state.cities) || []).forEach(function (ct) {
          if (GAME.masteryOf(ct, m.bid)) ok = true;
        });
        if (ok) sum += m.val;
      } else {
        var c = city || (GAME.currentCity ? GAME.currentCity() : null);
        if (GAME.masteryOf(c, m.bid)) sum += m.val;
      }
    }
    return sum;
  };
  /* v60（需求 3）：`GAME.masteryListOf` 已删 ——
     它唯一的消费点是全境汇总的「丙 · 满级专精」那一节，而老板要求
     专精说明搬进**对应建筑**的面板里（那里直接读 masteryOf(bid)，不需要列表）。
     留着就是死函数（audit 会报），所以整段撤掉。 */

  /* --------- 人口上限（民房等级表） --------- */
  GAME.maxPopOf = function (city, ignoreGuard) {
    var cap = 0;
    city.cells.forEach(function (c) {
      if (c.build && c.build.id === 'minfang') {
        var p = DATA.BUILDINGS.minfang.pop[c.build.lvl - 1];
        if (p) cap += p;
      }
    });
    /* v28：民房满级专精 —— 人口上限 +20% */
    cap = Math.round(cap * (1 + GAME.mastery('popPct', city)));
    /* v74（老板需求 1）：「取消将领对人口上限的加成」——
       守将统率的人口贡献整段撤除（DATA.POP_PER_TONG 一并下线）。
       人口上限从此**只**由民房（+ 满级专精）决定：一个来源，一眼可查。
       （`ignoreGuard` 参数保留：历史调用点传 true 表示"不含守将加成"，
        现在本来就没有该加成 —— 不删参数是为了不动那些调用点。） */
    return cap;
  };

  /* --------- 城内建筑统计 --------- */
  GAME.numBuilding = function (city, bid) {
    var n = 0;
    city.cells.forEach(function (c) { if (c.build && c.build.id === bid) n++; });
    return n;
  };
  /* 同类建筑等级**求和**（v19：仓库等多建建筑用；buildingLevel 只取最高级） */
  GAME.buildingLevelSum = function (city, bid) {
    if (!city) return 0;
    var n = 0;
    (city.cells || []).forEach(function (c) { if (c.build && c.build.id === bid) n += (c.build.lvl || 0); });
    return n;
  };

  GAME.buildingLevel = function (city, bid) {
    if (!city) return 0;
    /* v16：城墙不再占格，等级存在 city.wallLv */
    if (bid === 'chengqiang') return city.wallLv || 0;
    var l = 0;
    (city.cells || []).forEach(function (c) { if (c.build && c.build.id === bid && c.build.lvl > l) l = c.build.lvl; });
    return l;
  };
  /* --------- 城墙（v16：不占格，环绕城池一圈） --------- */
  GAME.wallCost = function (city) {
    var b = DATA.BUILDINGS.chengqiang;
    if (!b) return null;
    var lv = city ? (city.wallLv || 0) : 0;
    var c = b.levelCost(lv);
    if (!c) return null;
    /* 初次修建（0→1）用 buildCost；后续升级用 levelCost */
    if (lv === 0) {
      c = b.buildCost;
      var t0 = b.levelCost(0);
      c = { grain: c.grain, wood: c.wood, stone: c.stone, iron: c.iron, time: (t0 && t0.time) || 60 };
    }
    /* 城防技术：城墙建造与升级成本 −5%/级（封顶 −60%） */
    var disc = Math.min(0.6, techB('citydef'));
    if (disc > 0) {
      var out = {};
      for (var k in c) out[k] = (k === 'time') ? c[k] : Math.round(c[k] * (1 - disc));
      return out;
    }
    return c;
  };
  GAME.buildWall = function (cityId) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    if ((city.wallLv || 0) >= 1) return GAME.upgradeWall(cityId);
    var cost = GAME.wallCost(city);
    if (!cost) return { ok: false, msg: '未知费用' };
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足（城墙耗石尤多）' };
    GAME.payCost(cost);
    s.queues.build.push({ cityId: city.id, type: 'wall', buildId: 'chengqiang',
      targetLevel: 1, elapsed: 0,
      totalTime: Math.max((cost.time || 60) * GAME.guardBuildMult(city), GAME.buildMinTime()) });
    return { ok: true, msg: '开始修建城墙' };
  };
  /* ============================================================
   * 建筑等级上限（v54 · 老板）
   * ------------------------------------------------------------
   * 基准 12（DATA.MAX_BLEVEL），**名城**另有加成：
   * 县城 +2 / 郡城 +4 / 州城 +8 / 都城 +12；自建城不加成。
   * **这是"一级建筑能盖到几级"的唯一出口** ——
   * 升级守卫、城墙、城外建筑、自动建造、UI 的升级按钮全部读它。
   * （不这样收口，就会出现"域层允许升到 24、UI 却在 12 级就把按钮撤掉"这种
   *  静默不一致 —— 城外建筑在 v28 就正好踩过一次：域层给到 12，UI 写死 10。）
   * ⚠️ 满级专精（DATA.MASTERY）的门槛**仍是基准 12**，不跟着名城上限走：
   * 否则已到手的专精会因为上限提高而凭空消失。
   * ============================================================ */
  GAME.cityBuildBonus = function (city) {
    if (!city) return 0;
    var t = DATA.CITY_BUILD_BONUS || {};
    var v = t[city.type];
    return v || 0;
  };
  GAME.buildCapOf = function (city, bid) {
    var b = bid ? (DATA.BUILDINGS[bid] || DATA.EXT_BUILDINGS[bid] || null) : null;
    var base = (b && b.maxLevel) || DATA.MAX_BLEVEL;
    var cap = base + GAME.cityBuildBonus(city);
    /* v68 · 逐步探索：城内建筑（含城墙）等级不得超过官府等级。
       - 官府自身、城外建筑、以及"没有官府的城"（异常数据/测试构造）不受此闸；
       - 与 DATA.BUILD_PREREQ 分工：这里管**等级上限**，那里管**建造前置**。 */
    if (bid && DATA.BUILDINGS[bid] && bid !== 'guanfu') {
      var govLv = GAME.buildingLevel(city, 'guanfu');
      if (govLv > 0) cap = Math.min(cap, govLv);
    }
    return cap;
  };

  /* 建造前置的唯一出口（v68 · 逐步探索）：
       · 特殊前置：DATA.BUILD_PREREQ（先 X 后 Y）
       · 官府总闸：只有当"升官府真能解锁"时才报官府（官府自身到顶则交给等级硬顶去报）
     返回 { ok, list, short, msg } —— short 供卡片角标，msg 供提示条。 */
  GAME.buildPrereqOf = function (city, bid, nextLv) {
    var list = [];
    if (!city || !bid) return { ok: true, list: list };
    var req = DATA.BUILD_PREREQ && DATA.BUILD_PREREQ[bid];
    if (req) {
      for (var k in req) {
        var cur = GAME.buildingLevel(city, k);
        if (cur < req[k]) list.push({ bid: k, name: (DATA.BUILDINGS[k] || {}).name || k, need: req[k], cur: cur });
      }
    }
    var b = DATA.BUILDINGS[bid];
    if (b && bid !== 'guanfu') {
      var govLv = GAME.buildingLevel(city, 'guanfu');
      var govCap = (DATA.BUILDINGS.guanfu.maxLevel || DATA.MAX_BLEVEL) + GAME.cityBuildBonus(city);
      /* nextLv：本次动作要到达的等级。
         新建（buildAt）显式传 1 —— 可多建建筑（仓库/民房…）已有等级时，
         不能用 buildingLevel+1，否则"新建第二座"会被当成"升到 N+1"误拦。
         升级（upgradeAt）不传，默认 lvl+1。 */
      var next = nextLv || (GAME.buildingLevel(city, bid) + 1);
      /* govLv < govCap：官府还没到自己的顶，"再升官府"是真实可执行的下一步；
         官府已到顶时不报 gate，让等级硬顶去报「已达最高等级」。 */
      if (govLv > 0 && next > govLv && govLv < govCap) {
        list.push({ bid: 'guanfu', name: '官府', need: Math.min(next, govCap), cur: govLv, gate: true });
      }
    }
    if (!list.length) return { ok: true, list: list };
    var parts = list.map(function (o) { return o.name + ' 需 Lv' + o.need + '（当前 Lv' + o.cur + '）'; });
    var f = list[0];
    return { ok: false, list: list, short: '需' + f.name + ' Lv' + f.need, msg: '前置未满足：' + parts.join('；') };
  };

  /* 该城是否已有城墙在建造队列里。
     ⚠️ 自动升级**必须**查它：城墙不占格，没有 `cell.pending` 可看，
     不查就会每 tick 再排一次 —— 重复扣料、同一个等级付好几份钱、
     队列位也被同一条城墙占满（v64 的破坏测试抓到的就是这个真 bug）。
     同时供城墙面板显示"施工中"，一处判定两处用。 */
  GAME.wallPendingOf = function (cityId) {
    var s = GAME.state;
    return (((s && s.queues && s.queues.build) || [])).some(function (q) {
      return q.type === 'wall' && q.cityId === cityId;
    });
  };

  GAME.upgradeWall = function (cityId) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var lv = city.wallLv || 0;
    if (lv <= 0) return GAME.buildWall(cityId);
    if (lv >= GAME.buildCapOf(city, 'chengqiang')) return { ok: false, msg: '城墙已满级' };
    var cost = DATA.BUILDINGS.chengqiang.levelCost(lv);
    if (!cost) return { ok: false, msg: '未知费用' };
    if (s.buffs && s.buffs.buildCost && GAME.systems.buffActive('buildCost')) {
      cost = GAME.applyBuildCostDiscount(cost);
    }
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足' };
    GAME.payCost(cost);
    s.queues.build.push({ cityId: city.id, type: 'wall', buildId: 'chengqiang',
      targetLevel: lv + 1, elapsed: 0,
      totalTime: Math.max((cost.time || 60) * GAME.guardBuildMult(city), GAME.buildMinTime()) });
    return { ok: true, msg: '开始升级城墙 → Lv' + (lv + 1) };
  };

  /* --------- 建造队列限制（原版：同时最多2个，道具可增加） --------- */
  /* 建造/升级的最小现实时长（秒）：保证进度条与倒计时可见，避免高倍率下一闪而过 */
  GAME.buildMinTime = function () { return 5 * GAME.timeScale(); };

  GAME.buildSlots = function (city) {
    var s = GAME.state;
    /* v28：官府满级专精 —— 同时建造 +1 队（全境口径：任一城官府满级即可）
       v60（需求 5）：**名城档位优势**再 +buildSlot（帝都 +1、州治 +1）——
       这是 perks 里"同时建造"那项的落地点（不加这句它就是死属性）。 */
    city = city || GAME.currentCity();
    var base = 2 + GAME.mastery('buildSlot', null) + GAME.cityBonusNum(city, 'buildSlot');   /* v79：+ 爵位建造位 */
    if (s && s.buffs && s.buffs.buildQueue && s.buffs.buildQueue.until > U.now()) {
      base += (s.buffs.buildQueue.add || 0);   // 徭役令 +3
    }
    return base;
  };
  GAME.buildQueueUsed = function (cityId) {
    var s = GAME.state, n = 0;
    (s.queues.build || []).forEach(function (q) { if (!cityId || q.cityId === cityId) n++; });
    return n;
  };
  GAME.checkBuildSlot = function (cityId) {
    /* v60：队列位按**该城**算（名城 perk 的 buildSlot 是城属性） */
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var used = GAME.buildQueueUsed(cityId), cap = GAME.buildSlots(city);
    if (used >= cap) return { ok: false, msg: '同时只能建造/升级 ' + cap + ' 个建筑（徭役令可增加队列）' };
    return { ok: true };
  };

  /* --------- 取消建造（原版：按剩余时间比例返还部分资源） --------- */
  GAME.cancelBuild = function (kind, idx, cityId) {
    var s = GAME.state;
    var cur = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var qi = -1, q = null;
    for (var i = 0; i < s.queues.build.length; i++) {
      var x = s.queues.build[i];
      /* 外城地块已按城池独立，同一下标在多城间会重复，必须同时匹配 cityId；
         城墙（wall）无下标，按类型 + 城池匹配 */
      var hit = kind === 'wall'
        ? (x.type === 'wall' && (!cur || !x.cityId || x.cityId === cur.id))
        : kind === 'city'
          ? (x.gridIndex === idx && (x.type === 'build' || x.type === 'upgrade') && (!cur || !x.cityId || x.cityId === cur.id))
          : (x.extIdx === idx && (x.type === 'ext_build' || x.type === 'ext_upgrade') && (!cur || !x.cityId || x.cityId === cur.id));
      if (hit) { qi = i; q = x; break; }
    }
    if (!q) return { ok: false, msg: '没有进行中的建造' };
    /* 反查成本 */
    var cost = null;
    if (q.type === 'build') cost = DATA.BUILDINGS[q.buildId].buildCost;
    else if (q.type === 'upgrade') cost = DATA.BUILDINGS[q.buildId].levelCost(q.targetLevel - 1);
    else if (q.type === 'wall') cost = DATA.BUILDINGS.chengqiang.levelCost(q.targetLevel - 1) || DATA.BUILDINGS.chengqiang.buildCost;
    else if (q.type === 'ext_build') cost = GAME.extBuildCost(q.buildId, 0);
    else if (q.type === 'ext_upgrade') cost = GAME.extBuildCost(q.buildId, q.targetLevel - 1);
    /* 按剩余时间比例返还 80% */
    var remainRatio = Math.max(0, 1 - q.elapsed / q.totalTime);
    var refund = {}, total = 0;
    if (cost) {
      for (var k in cost) {
        if (k === 'time') continue;
        refund[k] = Math.floor(cost[k] * remainRatio * 0.8);
        total += refund[k];
      }
      for (var k2 in refund) s.res[k2] = (s.res[k2] || 0) + refund[k2];
    }
    /* 清除 pending 标记 */
    if (kind === 'city') {
      var c = GAME.cityById(q.cityId);
      if (c && c.cells[q.gridIndex]) c.cells[q.gridIndex].pending = null;
    } else {
      var qc = GAME.cityById(q.cityId);
      var qg = qc ? GAME.extGridOf(qc) : [];
      if (qg[q.extIdx]) qg[q.extIdx].pending = null;
    }
    s.queues.build.splice(qi, 1);
    GAME.log('取消建造，返还部分资源（' + Math.round(remainRatio * 80) + '%）');
    return { ok: true, msg: '已取消建造，返还 ' + U.fmt(total) + ' 资源' };
  };

  /* --------- 城外资源建筑（地块制 · v14 改为**按城池独立**） ---------
   * 此前 state.extGrid 是全局单份，导致多占城池不增加资源地块，攻城只剩税收。
   * 现在每城各有一份外城网格，上限 = 12 + (本城官府等级-1)×3。
   * 统一入口 GAME.extGridOf(city)，不要再直接读 state.extGrid。
   * ------------------------------------------------------------------ */
  GAME.extGridOf = function (city) {
    var s = GAME.state;
    if (!city) city = GAME.currentCity() || (s && s.cities && s.cities[0]);
    if (!city) return [];
    if (!city.extGrid) city.extGrid = [];
    return city.extGrid;
  };
  GAME.extCap = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var lv = GAME.buildingLevel(city, 'guanfu') || 1;
    /* v24（需求 7）：按官府等级查表（10 级 = 40 块，正好 8 列 × 5 整行）。
       旧公式 12+(lv-1)×3 到 10 级是 39，末行缺一格，看着像掉了块地。 */
    var t = DATA.EXT_CAP_BY_LV || [];
    var n = t[Math.max(0, Math.min(lv - 1, t.length - 1))];
    return n != null ? n : 12 + (lv - 1) * 3;
  };
  /* 保证外城地块数达到上限（官府升级后自动补空地）。不传 city 则针对当前城 */
  GAME.ensureExtGrid = function (city) {
    var s = GAME.state;
    if (!city) city = GAME.currentCity() || (s && s.cities && s.cities[0]);
    if (!city) return [];
    var g = GAME.extGridOf(city);
    var cap = GAME.extCap(city);
    while (g.length < cap) g.push({ id: 'e' + (g.length + 1), type: null, lv: 0 });
    return g;
  };
  /* 外城地块全境统计（多城经营展示用）：返回 { towns, used, cap, byType, maxLv } */
  GAME.extSummary = function () {
    var s = GAME.state, out = { towns: 0, used: 0, cap: 0, byType: {}, maxLv: {} };
    ((s && s.cities) || []).forEach(function (c) {
      out.towns++;
      out.cap += GAME.extCap(c);
      (c.extGrid || []).forEach(function (e) {
        if (!e || !e.type) return;
        out.used++;
        out.byType[e.type] = (out.byType[e.type] || 0) + 1;
        out.maxLv[e.type] = Math.max(out.maxLv[e.type] || 0, e.lv || 0);
      });
    });
    return out;
  };
  GAME.extCount = function (city, eid) {
    city = city || GAME.currentCity();
    var n = 0;
    GAME.extGridOf(city).forEach(function (e) { if (e.type === eid) n++; });
    return n;
  };
  GAME.extUsed = function (city) {
    city = city || GAME.currentCity();
    var n = 0;
    GAME.extGridOf(city).forEach(function (e) { if (e.type) n++; });
    return n;
  };
  GAME.extBuildCost = function (eid, lv) {
    var eb = DATA.EXT_BUILDINGS[eid];
    if (!eb) return null;
    var r = eb.cost[lv];
    /* 越界返回 null（而不是读 r[0] 抛异常）—— 等级上限提到 12 之后，
       任何一处"按 10 级算"的旧调用都会走到这里，宁可返回"无费用"也不要崩。 */
    if (!r) return null;
    return { grain: r[0], wood: r[1], stone: r[2], iron: r[3], time: r[4] };
  };
  /* 在指定外城地块建造资源建筑 */
  GAME.buildExt = function (extIdx, eid) {
    var s = GAME.state, city = GAME.currentCity();
    var eb = DATA.EXT_BUILDINGS[eid];
    if (!eb) return { ok: false, msg: '未知建筑' };
    var e = GAME.extGridOf(city)[extIdx];
    if (!e) return { ok: false, msg: '地块不存在' };
    if (e.type || e.pending) return { ok: false, msg: '该地块已占用' };
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = GAME.extBuildCost(eid, 0);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资源不足' };
    GAME.payCost(cost);
    e.pending = eid;
    s.queues.build.push({ cityId: city.id, extIdx: extIdx, buildId: eid, type: 'ext_build', elapsed: 0, totalTime: Math.max(cost.time * GAME.guardBuildMult(city), GAME.buildMinTime()) });
    return { ok: true, msg: '开始建造 ' + eb.name };
  };
  GAME.upgradeExt = function (extIdx, cityId) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var e = GAME.extGridOf(city)[extIdx];
    if (!e || !e.type) return { ok: false, msg: '该地块未建造建筑' };
    var eb = DATA.EXT_BUILDINGS[e.type];
    if (e.lv >= GAME.buildCapOf(city)) return { ok: false, msg: '已达最高等级' };
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = GAME.extBuildCost(e.type, e.lv);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资源不足' };
    GAME.payCost(cost);
    e.pending = e.type;
    s.queues.build.push({ cityId: city.id, extIdx: extIdx, buildId: e.type, type: 'ext_upgrade', targetLevel: e.lv + 1, elapsed: 0, totalTime: Math.max(cost.time * GAME.guardBuildMult(city), GAME.buildMinTime()) });
    return { ok: true, msg: '开始升级 ' + eb.name };
  };

  /* 唯一建筑（城内只能建1座，民房/军营/仓库可多建）。城墙不占格，已移出此表。
     v19（需求 10）：仓库移出 —— 允许多建，储量按各仓库等级求和叠加。
     ⚠ 这份表**必须唯一**：ui.js 曾自行复制一份，改 domain 却漏改 ui，
     结果后端放行、前端仍把仓库标成「已建造(唯一)」并禁用按钮。
     现在统一走 GAME.UNIQUE_BUILDINGS 单一数据源。 */
  GAME.UNIQUE_BUILDINGS = { shuyuan: 1, xiaochang: 1, shichang: 1, kezhan: 1, zhaoxianguan: 1, honglusi: 1, tiejiangpu: 1, gongjiangzuofang: 1, majiu: 1, yizhan: 1, fenghuotai: 1 };
  var UNIQUE_BUILDINGS = GAME.UNIQUE_BUILDINGS;

  /* --------- 城内建造 / 升级 / 拆除 --------- */
  GAME.buildAt = function (cityId, gridIndex, buildId) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) return { ok: false, msg: '城池不存在' };
    var cell = city.cells[gridIndex];
    if (!cell || cell.build) return { ok: false, msg: '该格已被占用' };
    if (cell.official) return { ok: false, msg: '官府区域不可建造' };
    if (cell.pending) return { ok: false, msg: '该格正在建设中' };
    var b = DATA.BUILDINGS[buildId];
    if (!b) return { ok: false, msg: '未知建筑' };
    if (!b.buildCost) return { ok: false, msg: '该建筑不可建造（初始自带）' };
    if (UNIQUE_BUILDINGS[buildId] && GAME.buildingLevel(city, buildId) > 0) {
      return { ok: false, msg: b.name + ' 全城唯一（已建造）' };
    }
    /* v68 · 逐步探索：建造前置（先 X 后 Y）—— 与升级共用同一判定，见 buildPrereqOf */
    var pre = GAME.buildPrereqOf(city, buildId, 1);
    if (!pre.ok) return pre;
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = b.buildCost;
    if (GAME.systems && GAME.systems.buffActive && GAME.systems.buffActive('buildCost')) {
      cost = GAME.applyBuildCostDiscount(cost);
    }
    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足，无法建造' };
    GAME.payCost(cost);
    cell.pending = { buildId: buildId, targetLevel: 1 };
    var totalTime = 60; // 默认1分钟（真实建筑1级多为此量级）
    var lc = b.levelCost(0);
    if (lc && lc.time) totalTime = lc.time;
    totalTime = Math.max(totalTime * GAME.guardBuildMult(GAME.cityById(cityId)), GAME.buildMinTime());
    s.queues.build.push({ cityId: cityId, gridIndex: gridIndex, buildId: buildId, type: 'build', elapsed: 0, totalTime: totalTime });
    return { ok: true, msg: '开始建造 ' + b.name };
  };

  GAME.applyBuildCostDiscount = function (cost) {
    var s = GAME.state, out = {};
    if (s.buffs && s.buffs.buildCost) {
      for (var k in cost) out[k] = Math.round(cost[k] * (1 - s.buffs.buildCost.eff));
    } else {
      for (var k2 in cost) out[k2] = cost[k2];
    }
    return out;
  };

  GAME.upgradeAt = function (cityId, gridIndex) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) return { ok: false, msg: '城池不存在' };
    var cell = city.cells[gridIndex];
    if (!cell || !cell.build) return { ok: false, msg: '空地无法升级' };
    /* v16：升级中必须有 pending 标记 —— 否则可对同一建筑重复排队，
       且点开建筑看不到「升级中」（这正是「升级中看不到进度、无法取消」的根因） */
    if (cell.pending) return { ok: false, msg: '该建筑正在施工中（可点开查看进度或取消）' };
    var b = DATA.BUILDINGS[cell.build.id];
    /* v68 · 逐步探索：前置（含官府总闸）优先于等级硬顶 ——
       两者都不满足时，报"升官府可解锁"比报"已达最高等级"更接近玩家的下一步动作。 */
    var pre = GAME.buildPrereqOf(city, cell.build.id);
    if (!pre.ok) return pre;
    if (cell.build.lvl >= GAME.buildCapOf(city, cell.build.id)) return { ok: false, msg: '已达最高等级' };
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = b.levelCost(cell.build.lvl);
    if (!cost) return { ok: false, msg: '未知费用' };
    if (GAME.systems.buffActive('buildCost')) cost = GAME.applyBuildCostDiscount(cost);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足' };
    GAME.payCost(cost);
    cell.pending = { buildId: cell.build.id, targetLevel: cell.build.lvl + 1 };
    var totalTime = Math.max(5, cost.time || cell.build.lvl * 60);
    totalTime = Math.max(totalTime * GAME.guardBuildMult(GAME.cityById(cityId)), GAME.buildMinTime());
    s.queues.build.push({ cityId: cityId, gridIndex: gridIndex, buildId: cell.build.id, type: 'upgrade', targetLevel: cell.build.lvl + 1, elapsed: 0, totalTime: totalTime });
    return { ok: true, msg: '开始升级 ' + b.name + ' → Lv' + (cell.build.lvl + 1) };
  };

  /* 建筑累计投入（用于拆毁返还评估）：1级造价 + 各级升级造价 */
  GAME.investedIn = function (b, lvl) {
    var out = { grain: 0, wood: 0, stone: 0, iron: 0 };
    for (var i = 0; i < (lvl || 1); i++) {
      var c = b.levelCost(i);
      if (!c) continue;
      out.grain += c.grain || 0; out.wood += c.wood || 0;
      out.stone += c.stone || 0; out.iron += c.iron || 0;
    }
    return out;
  };
  /* 城内建筑拆毁（v76 老板：「拆除（1级，只能逐级拆除）」）——
     每次只降 1 级：返还**本步投入**（达到当前等级的那一份造价 = 累计差）的 50%；
     Lv1 时拆除 = 整座移除（返还首级投入的 50%）。 */
  GAME.demolishRefund = function (city, gridIndex) {
    var cell = city && city.cells[gridIndex];
    if (!cell || !cell.build) return null;
    var b = DATA.BUILDINGS[cell.build.id];
    if (!b) return null;
    var lv = cell.build.lvl;
    var inv = GAME.investedIn(b, lv), prev = GAME.investedIn(b, Math.max(0, lv - 1));
    var step = { grain: inv.grain - prev.grain, wood: inv.wood - prev.wood,
      stone: inv.stone - prev.stone, iron: inv.iron - prev.iron };
    return GAME.scaledCost(step, DATA.DEMOLISH_RATE);
  };
  GAME.demolishAt = function (cityId, gridIndex) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) return { ok: false, msg: '城池不存在' };
    var cell = city.cells[gridIndex];
    if (!cell || !cell.build) return { ok: false, msg: '空地块' };
    if (cell.official) return { ok: false, msg: '官府不可拆除' };
    var b = DATA.BUILDINGS[cell.build.id];
    var lv = cell.build.lvl;
    /* v76（老板）：「拆除（1级，只能逐级拆除）」—— 一级一级拆：
       Lv>1 每次只降 1 级；拆到 Lv1 再拆才整座移除（腾出地块）。
       返还 = 本步投入（累计差）的 50%。 */
    var inv = GAME.investedIn(b, lv), prev = GAME.investedIn(b, Math.max(0, lv - 1));
    var step = { grain: inv.grain - prev.grain, wood: inv.wood - prev.wood,
      stone: inv.stone - prev.stone, iron: inv.iron - prev.iron };
    var back = GAME.scaledCost(step, DATA.DEMOLISH_RATE);
    GAME.refundCert(step, DATA.DEMOLISH_RATE);
    if (lv > 1) {
      cell.build.lvl = lv - 1;
      GAME.statBump('demolished', 1);
      GAME.log('拆 ' + b.name + ' Lv' + lv + ' → Lv' + (lv - 1) + '，返还 ' + GAME.costString(back));
      return { ok: true, msg: '已拆 1 级：' + b.name + ' Lv' + lv + ' → Lv' + (lv - 1) + '，返还 ' + GAME.costString(back), back: back };
    }
    cell.build = null;
    cell.pending = null;
    /* 清掉该格的建造/升级队列项，避免队列完成后写入已拆毁的格子 */
    s.queues.build = (s.queues.build || []).filter(function (q) {
      return !(q.cityId === cityId && q.gridIndex === gridIndex);
    });
    GAME.statBump('demolished', 1);
    GAME.log('拆毁 ' + b.name + ' Lv' + lv + '，返还 ' + GAME.costString(back));
    return { ok: true, msg: '已拆毁 ' + b.name + ' Lv' + lv + '，返还 ' + GAME.costString(back), back: back };
  };

  /* ============================================================
   * 城内建筑移形换位（v19 · 需求 8）
   *   规则：与空地「搬过去」、与另一个建筑「互换」；等级与状态随建筑走。
   *   限制：官府是城池中枢（占 4 格且等级需四格同步），不可移动；
   *         任一方在施工中也不可移动 —— 否则建造队列的 gridIndex 会指向错位的格子。
   *   不收费：建材已在城中，只是重新规划地皮。
   * ============================================================ */
  GAME.moveBuilding = function (cityId, fromIdx, toIdx) {
    var s = GAME.state, city = GAME.cityById(cityId) || GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    if (fromIdx === toIdx) return { ok: false, msg: '起点与终点相同' };
    var a = city.cells[fromIdx], b = city.cells[toIdx];
    if (!a || !b) return { ok: false, msg: '地块不存在' };
    if (!a.build) return { ok: false, msg: '该地块没有建筑可移动' };
    if (a.official || b.official) return { ok: false, msg: '官府为城池中枢，不可移动' };
    if (a.pending || b.pending) return { ok: false, msg: '有建筑正在施工，暂不可移动（可先取消施工）' };
    var moved = a.build, swapped = b.build;
    a.build = swapped;
    b.build = moved;
    var n1 = DATA.BUILDINGS[moved.id] ? DATA.BUILDINGS[moved.id].name : moved.id;
    var n2 = swapped ? (DATA.BUILDINGS[swapped.id] ? DATA.BUILDINGS[swapped.id].name : swapped.id) : null;
    GAME.log(n2
      ? '🔄 ' + n1 + ' 与 ' + n2 + ' 互换位置'
      : '🔄 ' + n1 + ' 已迁至新地块');
    return { ok: true, msg: n2 ? (n1 + ' 与 ' + n2 + ' 互换位置') : (n1 + ' 已迁至新地块') };
  };

  /* ============================================================
   * 城外资源地块「改建」（v19 · 需求 8）
   *   把已建的资源建筑改成另一种类型，**等级保留**。
   *   收费 = 目标建筑「当前等级」的累计造价 × 60%（改建折扣：
   *   地基与人力已在，只需改造）。
   * ============================================================ */
  GAME.EXT_CONVERT_RATE = 0.6;
  GAME.extConvertCost = function (extIdx, newType, cityId) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var e = GAME.extGridOf(city)[extIdx];
    if (!e || !e.type) return null;
    var eb = DATA.EXT_BUILDINGS[newType];
    if (!eb) return null;
    var out = { grain: 0, wood: 0, stone: 0, iron: 0 };
    for (var i = 0; i < (e.lv || 1); i++) {
      var c = eb.cost[i];
      if (!c) continue;
      out.grain += c[0] || 0; out.wood += c[1] || 0; out.stone += c[2] || 0; out.iron += c[3] || 0;
    }
    for (var k in out) out[k] = Math.round(out[k] * GAME.EXT_CONVERT_RATE);
    return out;
  };
  GAME.convertExt = function (extIdx, newType, cityId) {
    var s = GAME.state, city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var e = GAME.extGridOf(city)[extIdx];
    if (!e || !e.type) return { ok: false, msg: '该地块没有建筑可改建' };
    if (e.pending) return { ok: false, msg: '施工中不可改建（可先取消施工）' };
    var eb = DATA.EXT_BUILDINGS[newType];
    if (!eb) return { ok: false, msg: '未知建筑类型' };
    if (e.type === newType) return { ok: false, msg: '与当前类型相同' };
    var cost = GAME.extConvertCost(extIdx, newType, city.id);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '改建材料不足' };
    GAME.payCost(cost);
    var old = DATA.EXT_BUILDINGS[e.type];
    var oldName = old ? old.name : e.type;
    e.type = newType;
    GAME.statBump('converted', 1);
    GAME.log('🔧 城外 ' + oldName + ' 改建为 ' + eb.name + '（Lv' + e.lv + ' 保留）');
    return { ok: true, msg: oldName + ' 已改建为 ' + eb.name + '（等级保留）' };
  };

  /* 城外资源地块拆毁（返还累计投入的 50%） */
  GAME.demolishExtRefund = function (extIdx, cityId) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var e = GAME.extGridOf(city)[extIdx];
    if (!e || !e.type) return null;
    var eb = DATA.EXT_BUILDINGS[e.type];
    if (!eb) return null;
    var out = { grain: 0, wood: 0, stone: 0, iron: 0 };
    for (var i = 0; i < (e.lv || 1); i++) {
      var c = eb.cost[i];
      if (!c) continue;
      out.grain += c[0] || 0; out.wood += c[1] || 0; out.stone += c[2] || 0; out.iron += c[3] || 0;
    }
    return GAME.scaledCost(out, DATA.DEMOLISH_RATE);
  };
  GAME.demolishExt = function (extIdx, cityId) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var e = GAME.extGridOf(city)[extIdx];
    if (!e) return { ok: false, msg: '地块不存在' };
    if (e.pending) return { ok: false, msg: '该地块正在施工，请先取消建造' };
    if (!e.type) return { ok: false, msg: '该地块为荒地' };
    var eb = DATA.EXT_BUILDINGS[e.type];
    var back = GAME.demolishExtRefund(extIdx, city ? city.id : null);
    var out = { grain: 0, wood: 0, stone: 0, iron: 0 };
    for (var i = 0; i < (e.lv || 1); i++) {
      var c = eb.cost[i];
      if (!c) continue;
      out.grain += c[0] || 0; out.wood += c[1] || 0; out.stone += c[2] || 0; out.iron += c[3] || 0;
    }
    GAME.refundCert(out, DATA.DEMOLISH_RATE);
    var lv = e.lv;
    e.type = null; e.lv = 1; e.pending = null;
    s.queues.build = (s.queues.build || []).filter(function (q) {
      if (q.extIdx !== extIdx) return true;
      if (!city) return false;
      return q.cityId && q.cityId !== city.id;   // 只清本城该地块的队列项
    });
    GAME.statBump('demolished', 1);
    GAME.log('拆毁城外 ' + eb.name + ' Lv' + lv + '，返还 ' + GAME.costString(back));
    return { ok: true, msg: '已拆毁 ' + eb.name + ' Lv' + lv + '，返还 ' + GAME.costString(back), back: back };
  };

  /* --------- 造兵 --------- */
  /* 兵种解锁检查：一次性列出全部未满足项，便于玩家知道还缺什么 */
  GAME.canTrain = function (troopId) {
    var s = GAME.state, t = DATA.TROOPS[troopId];
    if (!t) return { ok: false, msg: '未知兵种' };
    var city = GAME.currentCity() || s.cities[0];
    var u = t.unlock || {};
    var fails = [];
    for (var k in u) {
      if (k === 'city') {
        var need = u.city;
        var STATE_NAME = { qingzhou: '青州', yizhou: '益州', hebei: '冀州', sili: '幽州', liangzhou: '凉州' };
        var CITY_NAME = { qingzhou: '临淄', yizhou: '雒县', hebei: '鄗县', sili: '蓟县', liangzhou: '陇县' };
        var has = false;
        s.cities.forEach(function (c) {
          /* v45：身份判据用 **origName**（原名）—— 玩家可以把洛阳改名叫"许都"，
             但"我是否握着司隶州治"这件事不该跟着名字变。 */
          if (c.state === need || (c.origName || c.name) === (CITY_NAME[need] || need)) has = true;
        });
        if (!has) fails.push('需占领' + (STATE_NAME[need] || need) + '州城');
      } else if (k === 'tech') {
        for (var tk in u.tech) {
          if ((s.techs[tk] || 0) < u.tech[tk]) {
            var tn = null;
            DATA.TECH.forEach(function (x) { if (x.id === tk) tn = x.name; });
            fails.push('需科技' + (tn || tk) + ' Lv' + u.tech[tk]);
          }
        }
      } else {
        /* v29（需求 13）：器械由**工匠作坊**制造 —— "造投石车要先有 8 级军营"
           既不合逻辑，也让作坊等级形同虚设。其余门槛（书院、作坊）照旧。 */
        if (t.craft && k === 'junying') continue;
        var lv = GAME.buildingLevel(city, k);
        if (lv < u[k]) fails.push('需' + (DATA.BUILDINGS[k] ? DATA.BUILDINGS[k].name : k) + ' Lv' + u[k]);
      }
    }
    if (fails.length) return { ok: false, msg: fails.join('　') };
    return { ok: true };
  };


  /* ============================================================
   * 军营与募兵队列位（v24 · 需求 8）
   * ------------------------------------------------------------
   * 募兵不再"全城共用一个队列"，而是**每座军营各一条**：
   *   · 队列位 = 1（执行）+ (Lv≥5 ? 1 : 0) + (Lv≥10 ? 1 : 0)，最多 3 条
   *   · 同一军营只有**最早的一条**在走倒计时，其余排队等待
   *   · 执行中完成 → 下一条自动开跑
   * bIdx = 城内格子下标，旧档队列没有 bIdx 时由读档迁移补上。
   * ============================================================ */
  GAME.trainQueueSlots = function (lv, city) {
    lv = Number(lv) || 0;
    /* v28（需求 1）：军营满级专精再 +1 位。
       city 可选 —— 不传时按"当前城"判定；调用方若已知是哪座城，务必传进来。
       v60（需求 5）：**名城档位优势**再 +troopSlot（帝都 +1）——
       perks 里"募兵队列 +1"那项的落地点（不加这句它就是死属性）。 */
    var bonus = city ? (GAME.masteryOf(city, 'junying') ? 1 : 0) : GAME.mastery('trainSlot', null);
    return 1 + (lv >= 5 ? 1 : 0) + (lv >= 10 ? 1 : 0) + bonus
      + GAME.perkNum(city || GAME.currentCity(), 'troopSlot');
  };

  /* ============================================================
   * 募兵上限（v28 · 需求 5）
   * ------------------------------------------------------------
   * "填数量"是这个游戏里最繁琐的一步：玩家知道要募兵，但不知道该填多少，
   * 只能反复点 +10 试探，或者自己拿人口和四种资源去心算。
   * 这里把上限一次算出来（人口与四种资源各能支撑多少，取最小），
   * 界面上一个「上限」按钮直接填进去。
   *
   * 口径与 GAME.train 的校验**完全一致**（同一个人口消耗、同一套资源单价、
   * 同一个单次上限），否则会出现"按了上限却提示资源不足"的自相矛盾。
   * ============================================================ */
  GAME.maxTrainCount = function (troopId, cityId, bIdx) {
    var s = GAME.state, t = DATA.TROOPS[troopId];
    if (!s || !t) return 0;
    /* v29（需求 13）：器械与募兵的上限口径相同（人口 + 资源短板），
       bIdx 只是调用方用来定位队列的，不参与上限计算。 */
    var n = 500000;                                  // 与 GAME.train 的单次上限一致
    /* 人口：可用人口 ÷ 每兵占人口 */
    if (t.pop > 0) n = Math.min(n, Math.floor((s.res.pop || 0) / t.pop));
    /* 资源：逐项余量 ÷ 单兵消耗，取最小的那一项（短板决定上限） */
    for (var k in (t.cost || {})) {
      var need = t.cost[k];
      if (need > 0) n = Math.min(n, Math.floor((s.res[k] || 0) / need));
    }
    return Math.max(0, Math.floor(n));
  };

  /* 下一个等待位的解锁等级（用于"队列已满"时告诉玩家差多少） */
  GAME.trainNextSlotLv = function (lv) {
    lv = Number(lv) || 0;
    if (lv < 5) return 5;
    /* v28：10 级之后还有 12 级满级专精 +1 位，所以"下一个等待位"是 12 而非 null */
    if (lv < 5) return 5;
    if (lv < 10) return 10;
    if (lv < DATA.MAX_BLEVEL) return DATA.MAX_BLEVEL;
    return 0;
    return 0;
  };
  GAME.barracksOf = function (city) {
    city = city || GAME.currentCity();
    var out = [];
    if (!city) return out;
    (city.cells || []).forEach(function (cell, idx) {
      if (cell.build && cell.build.id === 'junying') out.push({ idx: idx, lvl: cell.build.lvl || 1 });
    });
    return out;
  };
  GAME.barracksLevel = function (city, idx) {
    var l = 0;
    idx = Number(idx);
    GAME.barracksOf(city).forEach(function (b) { if (b.idx === idx) l = b.lvl; });
    return l;
  };
  /* 默认军营（无 bIdx 时兜底）；本城无军营返回 -1 */
  GAME.firstBarracksIdx = function (city) {
    var list = GAME.barracksOf(city);
    return list.length ? list[0].idx : -1;
  };
  /* ============================================================
   * 工匠作坊（v29 · 需求 13）
   * ------------------------------------------------------------
   * 器械（床弩 / 冲车 / 投石车）不再跟募兵挤同一条队列：
   *   · 队列位由**作坊等级**决定（与军营同一套阶梯：1 / Lv5 +1 / Lv10 +1 / 满级专精 +1）
   *   · 队列挂在**作坊格位**上，与军营队列互不占位
   * 实现上仍然共用 `s.queues.train` 这一条数组，靠条目上的 `kind` 分组 ——
   * 于是推进逻辑（GAME.advanceTrainQueues）一行都不用改，
   * 也不会出现"两套推进代码各自漂移"的老问题。
   * ============================================================ */
  GAME.craftWorkshopsOf = function (city) {
    city = city || GAME.currentCity();
    var out = [];
    if (!city) return out;
    (city.cells || []).forEach(function (cell, idx) {
      if (cell.build && cell.build.id === 'gongjiangzuofang') out.push({ idx: idx, lvl: cell.build.lvl || 1 });
    });
    return out;
  };
  GAME.craftLevel = function (city, idx) {
    var l = 0;
    idx = Number(idx);
    GAME.craftWorkshopsOf(city).forEach(function (b) { if (b.idx === idx) l = b.lvl; });
    return l;
  };
  GAME.firstWorkshopIdx = function (city) {
    var list = GAME.craftWorkshopsOf(city);
    return list.length ? list[0].idx : -1;
  };
  /* 队列键：**含 kind**，于是军营组与作坊组天然分开推进 */
  GAME.trainQueueKey = function (q) {
    return (q.kind || 'train') + '|' + (q.cityId || '') + '#' + (q.bIdx == null ? -1 : q.bIdx);
  };
  GAME.queueKindOf = function (kind) { return kind === 'craft' ? 'craft' : 'train'; };
  /* ============================================================
   * 募兵队列推进 —— **唯一实现**，在线 tickOnce 与离线 simulateBulk 共用。
   * ------------------------------------------------------------
   * 规则：按军营分组，每组只有**最早一条**吃时间；它完成后，剩余时间
   * 结转给同组的下一条（不是重新按整段推进，否则离线补算会凭空多出兵）。
   * 曾经两处各写一份：只改了离线那份，实测仍然是"所有队列齐步走"。
   * ============================================================ */
  GAME.advanceTrainQueues = function (secGame) {
    var s = GAME.state;
    if (!s || !s.queues.train.length || !(secGame > 0)) {
      if (s) (s.queues.train || []).forEach(function (q, i) { q.waiting = i > 0; });
      return;
    }
    var groups = {}, order = [];
    s.queues.train.forEach(function (q) {
      var k = GAME.trainQueueKey(q);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(q);
    });
    order.forEach(function (k) {
      var list = groups[k], left = secGame, running = null;
      while (left > 0 && list.length) {
        var head = list[0];
        var need = head.totalTime - head.elapsed;
        running = head;                       // 这一条确实分到了时间 → 它就是"募兵中"
        if (need > left) { head.elapsed += left; left = 0; break; }
        head.elapsed = head.totalTime;
        left -= need;
        var at = s.queues.train.indexOf(head);
        if (at >= 0) s.queues.train.splice(at, 1);
        list.shift();
        running = null;                       // 已完成出队，下一条尚未开始
        GAME.applyTrainDone(head);
      }
      /* 用「这一轮到底有没有分到时间」判定，而不是用下标 ——
         时间刚好在某条上用完时，下一条虽然排在第 0 位却并没有开始，
         一刀切写 waiting=true 会把正在募兵的那条也标成"排队等待"。 */
      list.forEach(function (q) { q.waiting = (q !== running); });
    });
  };
  /* 该军营当前的募兵队列（按入队顺序） */
  GAME.trainQueuesOf = function (city, bIdx) {
    var s = GAME.state;
    if (!s || !city) return [];
    bIdx = Number(bIdx);
    if (!isFinite(bIdx)) bIdx = -1;
    var kind = GAME.queueKindOf(arguments[2]);
    return (s.queues.train || []).filter(function (q) {
      return GAME.queueKindOf(q.kind) === kind
        && q.cityId === city.id && (q.bIdx == null ? -1 : q.bIdx) === bIdx;
    });
  };
  /* 该军营 / 该作坊还剩几个空位 */
  GAME.trainSlotsLeft = function (city, bIdx, kind) {
    kind = GAME.queueKindOf(kind);
    var lv = kind === 'craft' ? GAME.craftLevel(city, bIdx) : GAME.barracksLevel(city, bIdx);
    var slots = GAME.trainQueueSlots(lv, city);
    return Math.max(0, slots - GAME.trainQueuesOf(city, bIdx, kind).length);
  };

  GAME.train = function (troopId, count, cityId, bIdx) {
    var s = GAME.state, t = DATA.TROOPS[troopId];
    var city = GAME.cityById(cityId || (s && s.cities[0] && s.cities[0].id));
    if (!t) return { ok: false, msg: '未知兵种（请先在上方选择要训练的兵种）' };
    if (!city) return { ok: false, msg: '城池不存在' };
    count = Math.floor(Number(count));
    if (!count || count <= 0 || !isFinite(count)) return { ok: false, msg: '训练数量无效（请填写大于 0 的整数）' };
    /* 单次训练上限：防止误输入超大数量把队列时长撑到天量 */
    if (count > 500000) return { ok: false, msg: '单次训练不超过 50 万（可分多次训练）' };
    var chk = GAME.canTrain(troopId);
    if (!chk.ok) return chk;
    /* v24（需求 8）：募兵归属**具体一座军营**，队列位由该军营等级决定。
       放在数量与解锁校验**之后** —— 否则填错数量时会得到"队列已满"这种驴唇不对马嘴的提示。 */
    /* v29（需求 13）：器械走**工匠作坊**的队列，募兵走军营的队列 —— 两不相干 */
    var kind = t.craft ? 'craft' : 'train';
    if (bIdx == null || bIdx === '') {
      bIdx = kind === 'craft' ? GAME.firstWorkshopIdx(city) : GAME.firstBarracksIdx(city);
    }
    bIdx = Number(bIdx);
    if (!isFinite(bIdx)) bIdx = -1;
    var bLv = kind === 'craft' ? GAME.craftLevel(city, bIdx) : GAME.barracksLevel(city, bIdx);
    if (bLv <= 0) {
      return { ok: false, msg: kind === 'craft'
        ? '本城尚无工匠作坊，无法制造器械（先建工匠作坊）'
        : '本城尚无军营，无法募兵（先建军营）' };
    }
    if (GAME.trainSlotsLeft(city, bIdx, kind) <= 0) {
      var nx = GAME.trainNextSlotLv(bLv);
      return { ok: false, msg: (kind === 'craft' ? '本作坊制造队列已满' : '本营募兵队列已满')
        + (nx ? '（' + (kind === 'craft' ? '作坊 ' : '军营 ') + nx + ' 级解锁下一个等待位）' : '') };
    }
    /* 校场出征容量提示（造兵只需资源+人口，出征时校场才限制） */
    var xc = GAME.buildingLevel(city, 'xiaochang') || 0;
    var needPop = t.pop * count;
    var cost = {};
    for (var k in t.cost) cost[k] = t.cost[k] * count;
    cost.pop = needPop;
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资源或人口不足' };
    GAME.payCost(cost);
    /* 训练时间：单个训练秒×数量（练兵技巧/韩信三篇减时） */
    var totalTime = count * t.time;
    var trainRed = GAME.systems.techBonus('train');
    totalTime = Math.round(totalTime * (1 - Math.min(0.6, trainRed)));
    if (GAME.story) totalTime = Math.round(totalTime / GAME.story.trainMult()); // 年号：训练加速
    /* v63（老板）：征兵加速取**本城**守将的勇武（改前吃全境守将之和） */
    var gbT = GAME.guardBonus(city);
    if (gbT.train) totalTime = Math.round(totalTime / (1 + Math.min(1.5, gbT.train))); // 守将勇武：征兵加速
    /* v28（需求 1）：工匠作坊满级专精 —— 器械（craft 兵种）打造耗时 −15% */
    if (t.craft && GAME.masteryOf(city, 'gongjiangzuofang')) totalTime = Math.round(totalTime * 0.85);
    if (s.buffs && s.buffs.trainRed && s.buffs.trainRed.until > U.now()) {
      totalTime = Math.round(totalTime * (1 - s.buffs.trainRed.eff));
    }
    s.queues.train.push({ kind: kind, cityId: city.id, bIdx: bIdx, troopId: troopId, count: count,
      elapsed: 0, totalTime: Math.max(2, totalTime), waiting: false });
    return { ok: true, msg: (kind === 'craft' ? '开始制造 ' : '开始训练 ') + t.name + ' ×' + count };
  };

  /* ============================================================
   * 城池重命名（v25 · 需求 8）
   * ------------------------------------------------------------
   * 只有**自己建的城**（type === 'self'）能改名 ——
   * 攻占的史实名城（洛阳/江陵…）名字是史料的一部分，改了会让
   * 战报、岁贡、州治加成这些地方对不上号。
   * ============================================================ */
  /* 城池名 + 等级标注（v29 · 需求 9）
     ------------------------------------------------------------
     地图、侧栏、统计、官府、战报抬头…… 到处都在显示城池名，但"这是都城还是县城"
     只写在数据里 —— 玩家得自己记住"洛阳是都城"。统一给一个取值口：
       · 自建城不标注（"自建城"三个字没有信息量，只添乱）；
       · 名城标注 [都城] / [州城] / [郡城] / [县城]。
     所有引用的地方都改走这里，改名与标注就不会两处各写一份。 */
  GAME.cityTierName = function (city) {
    if (!city) return '';
    var t = city.type || 'self';
    if (t === 'self') return '';
    return DATA.CITY_TIER[t] || '';
  };
  GAME.cityLabel = function (city) {
    if (!city) return '';
    var tn = GAME.cityTierName(city);
    return city.name + (tn ? '[' + tn + ']' : '');
  };

  GAME.canRenameCity = function (city) {
    city = city || GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    /* v45（需求 4）：**所有已拥有的城池都可改名**（含洛阳这类史实名城）。
       改前只放行 `type === 'self'`，而玩家的开局城就是洛阳（都城）——
       于是按钮永远置灰，老板因此以为"官府根本没有改名功能"。
       名城改名不会破坏任何引用：原名在第一次改名时另存 `city.origName`，
       州治判定 / 洛阳归属判定 / 玩家可见的"原名"标注一律读 origName 而非 name。 */
    if (!city.origName) city.origName = city.name;
    return { ok: true };
  };
  GAME.renameCity = function (cityId, name) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var chk = GAME.canRenameCity(city);
    if (!chk.ok) return chk;
    name = String(name == null ? '' : name).trim();
    if (!name) return { ok: false, msg: '名字不能为空' };
    if (name.length > 12) return { ok: false, msg: '名字不超过 12 个字' };
    if (name === city.name) return { ok: false, msg: '名字未改动' };
    var dup = false;
    (GAME.state.cities || []).forEach(function (c) { if (c.id !== city.id && c.name === name) dup = true; });
    if (dup) return { ok: false, msg: '已有同名城池' };
    var old = city.name;
    /* 原名只记第一次 —— 反复改名时 origName 始终是"它本来是谁" */
    if (!city.origName) city.origName = old;
    city.name = name;
    GAME.log('🏯 城池改名：' + old + ' → ' + name);
    return { ok: true, msg: '已改名为「' + name + '」' };
  };

  /* --------- 部队统计 --------- */
  GAME.armyTotal = function (city) {
    var total = 0;
    for (var k in (city.army || {})) total += city.army[k];
    return total;
  };

  /* ============================================================
   * 客栈 / 招贤馆 / 仓库 / 市场（建筑功能实现）
   * 原则：每座功能建筑都要有实际作用，且其等级应构成其他玩法的门槛。
   * ============================================================ */

  /* --------- 招贤馆：将领席位（**按城**，唯一出口） ---------
   * v64（老板）：「将领归属于城市，根据**该城的招贤馆等级**有相应空位」。
   * 改前 `GAME.generalCap()` 读的是**当前城**的招贤馆等级，却拿去约束**全境总数**，
   * 于是两件事都说不通：
   *   · 多城经营时席位不随城数增加（第二座城的招贤馆白建）；
   *   · 切到招贤馆小的城，反而连一个人都不许招 —— "到底哪个城的容量"没法回答。
   * 现在席位跟着城走，且**只由一个出口给出**：
   *   `genSlotsOf(city)` = 该城招贤馆等级 +（该城招贤馆满级专精 ? 2 : 0）。
   * 超编不会赶人走，但**不许再进人**（招募 / 派遣 / 归降之外一律拦）。 */
  GAME.genSlotsOf = function (city) {
    if (!city) return 0;
    /* v28：招贤馆满级专精 —— 房间 +2
       v79：+ 爵位 / 主城 的将领席位加成（cityBonusNum 汇总口） */
    return (GAME.buildingLevel(city, 'zhaoxianguan') || 0)
      + (GAME.masteryOf(city, 'zhaoxianguan') ? 2 : 0)
      + GAME.cityBonusNum(city, 'genCap');
  };
  /* 某城现有将领 —— **与将领页名单同源**（两边都走 `genCityOf`）。
     判据不一致就会出现"名单上 6 人、却提示只剩 1 个空位"这类自相矛盾。
     出征/采集途中的将**仍属原城**：人走了，位置不空。 */
  GAME.generalsIn = function (city) {
    city = city || GAME.currentCity();
    if (!city) return [];
    return ((GAME.state && GAME.state.generals) || []).filter(function (g) {
      var gc = GAME.genCityOf(g);
      return !!(gc && gc.id === city.id);
    });
  };
  /* 某城剩余席位数（负数按 0 记） */
  GAME.genFreeOf = function (city) {
    return Math.max(0, GAME.genSlotsOf(city) - GAME.generalsIn(city).length);
  };
  /* 全境席位合计（**只给"全境"视图显示**；任何判定都必须按城） */
  GAME.genSlotsTotal = function () {
    var s = GAME.state;
    return (((s && s.cities) || [])).reduce(function (a, c) { return a + GAME.genSlotsOf(c); }, 0);
  };

  /* --------- 仓库：资源容量上限 --------- */
  var BASE_STORE = 2000000;   // 无仓库时的保底容量（早期无感）
  GAME.storeCap = function () {
    /* v60（需求 4）：仓储上限**按城**（资源既然归属城池，仓容也跟着走）。
       `storeCap` = 当前城的 cap，跨城看别人的仓容是上一版的 bug 来源。
       跨城调拨请用「资源运输」（见 GAME.doTransport）。 */
    return GAME.storeCapOf(GAME.currentCity());
  };
  /* 指定城的仓储上限（唯一出口，别处不要再自己乘一遍） */
  GAME.storeCapOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return BASE_STORE;
    /* v19：仓库可多建 —— 储量按**本城各仓等级之和**计（一座 Lv5 = 五座 Lv1）。
       储存技术 +5%/级；仓库满级专精再 +50%；名城档位优势再 +storePct（都城 +50%）。 */
    var lv = GAME.buildingLevelSum(city, 'cangku');
    var base = lv > 0 ? BASE_STORE * lv : BASE_STORE;
    return Math.round(base * (1 + techB('store'))
      * (1 + (GAME.masteryOf(city, 'cangku') ? 0.5 : 0))
      * (1 + GAME.cityBonusNum(city, 'storePct')));   /* v79：+ 爵位/主城/神器 仓储 */
  };

  /* --------- 市场：商队数与交易折扣 --------- */
  GAME.caravanCount = function () {
    var s = GAME.state, city = GAME.currentCity() || (s && s.cities[0]);
    if (!city) return 0;
    return GAME.buildingLevel(city, 'shichang') || 0;
  };

  /* ============================================================
   * 客栈：候选生成 / 招募 / 相亲
   * ============================================================ */
  var INN_SURNAME = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭',
    '何', '高', '林', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '萧', '田', '董', '潘'];
  var INN_GIVEN_M = ['武', '霸', '雄', '烈', '毅', '刚', '勇', '猛', '威', '震', '远', '达', '通', '博', '文', '彦',
    '德', '义', '信', '忠', '孝', '安', '宁', '泰', '康', '盛', '昌', '隆', '兴', '平', '靖', '桓', '峤', '琮', '玠', '绍'];
  var INN_GIVEN_F = ['娥', '婵', '环', '姬', '婉', '姝', '媛', '娴', '云', '月', '兰', '芝', '玉', '珠', '环', '瑶',
    '瑾', '琬', '莹', '翠', '秀', '英', '华', '芳', '倩', '绫', '罗', '绮', '纨', '素'];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  /* 客栈等级（按城；不传则当前城）—— 招募的名额就在这座城的客栈里 */
  GAME.innLevel = function (city) {
    var s = GAME.state;
    city = city || GAME.currentCity() || (s && s.cities[0]);
    if (!city) return 0;
    return GAME.buildingLevel(city, 'kezhan') || 0;
  };

  /* 这座城还能不能在客栈招人（v64：按城判，不再拿当前城的容量卡全境） */
  GAME.canRecruitGeneral = function (city) {
    city = city || GAME.currentCity();
    if (!city) return { ok: false, msg: '无城池可招贤' };
    if (GAME.innLevel(city) <= 0) return { ok: false, msg: city.name + ' 需先建造客栈（城内空地可建）' };
    var cap = GAME.genSlotsOf(city), used = GAME.generalsIn(city).length;
    if (cap <= 0) return { ok: false, msg: city.name + ' 需先建造招贤馆（每级 +1 席位）' };
    if (used >= cap) {
      return { ok: false, msg: city.name + ' 招贤馆已无空位（' + used + '/' + cap
        + '）—— 可升级招贤馆，或把将领派往他城' };
    }
    return { ok: true, city: city, cap: cap, used: used };
  };

  /* 生成一位候选：资质分档（凡品/良材/英杰/名世/天授），客栈等级越高越易出高资质。
   * 高资质出现概率低，但属性区间与成长都更夸张 —— 拉开档次差异 */
  function makeCandidate(lv, owned) {
    var isBeauty = Math.random() < 0.30;
    /* v73（老板「限制高资质将领的直接获取，概率再降 10 倍」）：名将直取
       0.30 → 0.03。池内史实名将按 HERO_RANK_LINE 皆是英杰以上的高资质，
       与 DATA.GEN_RANKS 权重再 ÷10 是一套组合拳 —— 高资质将领从此以
       「秘境灵草养成」为主路（见 DATA.FARM）。 */
    if (lv >= 5 && Math.random() < 0.03) {
      var pool = ((isBeauty ? DATA.BEAUTIES : DATA.HEROES) || []).filter(function (h) { return !owned[h.name]; });
      if (pool.length) {
        var h = pick(pool);
        owned[h.name] = true;
        var sum = (h.tong || 0) + (h.yw || 0) + (h.zm || 0) + (h.nz || 0);
        var hrk = GAME.heroRank(sum);
        var mul = isBeauty ? 1.25 : 1.0;
        return {
          id: 'cd' + (GAME._cndSeq = (GAME._cndSeq || 0) + 1),
          name: h.name, hero: true, beauty: isBeauty, avatar: isBeauty ? '👩' : '🧔',
          tong: Math.round((h.tong || 60) * mul), nz: Math.round((h.nz || 60) * mul),
          yw: Math.round((h.yw || 60) * mul), zm: Math.round((h.zm || 60) * mul),
          level: Math.max(1, lv + 1), loyalty: 60,
          rank: hrk.id, style: 'balance',
          cost: Math.round(800 * lv * hrk.price * (isBeauty ? 1.6 : 1.0)),
        };
      }
    }
    var rk = GAME.pickRank(lv);
    var st = GAME.pickStyle(rk);
    var rand = U.rng((U.now() + (GAME._cndSeq || 0) * 7919 + Math.floor(Math.random() * 1e7)) >>> 0);
    function roll() { return U.randInt(rand, rk.base[0], rk.base[1]); }
    var nm = pick(INN_SURNAME) + (isBeauty ? pick(INN_GIVEN_F) : pick(INN_GIVEN_M));
    return {
      id: 'cd' + (GAME._cndSeq = (GAME._cndSeq || 0) + 1),
      name: nm, hero: false, beauty: isBeauty, avatar: isBeauty ? '👩' : '🧔',
      tong: Math.round(roll() * st.mul.tong),
      nz: Math.round(roll() * (isBeauty ? st.mul.nz * 1.15 : st.mul.nz)),
      yw: Math.round(roll() * (isBeauty ? st.mul.yw * 0.7 : st.mul.yw)),
      zm: Math.round(roll() * (isBeauty ? st.mul.zm * 1.15 : st.mul.zm)),
      level: Math.max(1, lv + randInt(-1, 1)), loyalty: 70,
      rank: rk.id, style: st.id,
      cost: Math.round(800 * lv * rk.price * (isBeauty ? 1.4 : 1.0)),
    };
  }

  var INN_FRESH_MS = 5 * 60 * 1000;   // 候选 5 分钟自动更换一批

  /* 取候选列表（必要时自动刷新）。force=true 强制换一批 */
  /* 客栈候选位数（v28）：客栈等级 + 满级专精 +2 */
  GAME.innSlots = function (city) {
    var lv = GAME.innLevel();
    if (lv <= 0) return 0;
    return lv + (GAME.masteryOf(city || GAME.currentCity(), 'kezhan') ? 2 : 0);
  };

  GAME.innRefresh = function (force) {
    var s = GAME.state;
    var lv = GAME.innSlots();
    if (lv <= 0) return [];
    if (!s.inn) s.inn = { candidates: [], at: 0 };
    var now = U.now();
    if (!force && s.inn.candidates && s.inn.candidates.length && (now - s.inn.at) < INN_FRESH_MS) {
      return s.inn.candidates;
    }
    var owned = {};
    (s.generals || []).forEach(function (g) { owned[g.name] = true; });
    var list = [];
    for (var i = 0; i < lv; i++) list.push(makeCandidate(lv, owned));   // 客栈 N 级 = N 位候选
    s.inn.candidates = list;
    s.inn.at = now;
    return list;
  };

  /* 候选下次刷新剩余时间（毫秒） */
  GAME.innRefreshLeft = function () {
    var s = GAME.state;
    if (!s.inn) return 0;
    return Math.max(0, INN_FRESH_MS - (U.now() - (s.inn.at || 0)));
  };

  GAME.innRefreshCost = function () {
    var lv = GAME.innLevel();
    return 500 * Math.max(1, lv);
  };

  /* 花金立即换一批 */
  GAME.innReroll = function () {
    var lv = GAME.innLevel();
    if (lv <= 0) return { ok: false, msg: '需先建造客栈' };
    var s = GAME.state;
    var cost = GAME.innRefreshCost();
    if ((s.res.gold || 0) < cost) return { ok: false, msg: '黄金不足（需 ' + U.fmt(cost) + '）' };
    s.res.gold -= cost;
    GAME.innRefresh(true);
    return { ok: true, msg: '已另请一批贤士（-' + U.fmt(cost) + '金）' };
  };

  /* 招募 / 相亲 */
  GAME.innRecruit = function (cid, cityId) {
    var s = GAME.state;
    /* v64：招贤以**客栈所在城**为准 —— 名额按该城算、黄金从该城扣、人落在该城 */
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity();
    if (!city) return { ok: false, msg: '无城池可招贤' };
    var chk = GAME.canRecruitGeneral(city);
    if (!chk.ok) return chk;
    var list = GAME.innRefresh();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === cid) { idx = i; break; }
    if (idx < 0) return { ok: false, msg: '此人已离去，请刷新候选' };
    var cnd = list[idx];
    var R = GAME.res(city);
    if ((R.gold || 0) < cnd.cost) return { ok: false, msg: city.name + ' 黄金不足（需 ' + U.fmt(cnd.cost) + '）' };
    R.gold -= cnd.cost;
    var g = GAME.makeGeneral(cnd.name, cnd.level, 'idle', city.id, false, cnd.rank, cnd.style);
    g.tong = cnd.tong; g.nz = cnd.nz; g.yw = cnd.yw; g.zm = cnd.zm;
    g.avatar = cnd.avatar;
    g.loyalty = cnd.loyalty;
    g.hero = cnd.hero;
    g.beauty = cnd.beauty;
    s.generals.push(g);
    list.splice(idx, 1);
    var rkName = GAME.rankOf(g).name;
    GAME.statBump('recruited', 1);
    GAME.log((cnd.beauty ? '相亲结缘：' : '招募成功：') + cnd.name + '（' + rkName + '）入我帐下。');
    return { ok: true, msg: (cnd.beauty ? '迎娶 ' : '招募 ') + cnd.name + '·' + rkName + '（-' + U.fmt(cnd.cost) + '金）', gen: g };
  };

  /* ============================================================
   * 市场：资源互换（需市场等级，有折损）
   * ============================================================ */
  var TRADE_RES = ['grain', 'wood', 'stone', 'iron'];
  GAME.marketRate = function () {
    var lv = GAME.caravanCount();
    if (lv <= 0) return 0.6;
    /* v28（需求 1）：市场满级专精 —— 交易折损再 −10 个百分点 */
    var mb = GAME.mastery ? GAME.mastery('caravanPct', null) : 0;
    return Math.min(0.98, 0.6 + lv * 0.035 + mb);
  };
  GAME.marketTrade = function (from, to, amount) {
    var s = GAME.state;
    if (TRADE_RES.indexOf(from) < 0 || TRADE_RES.indexOf(to) < 0 || from === to) {
      return { ok: false, msg: '交易资源有误' };
    }
    if (GAME.caravanCount() <= 0) return { ok: false, msg: '需先建造市场' };
    amount = Math.floor(amount || 0);
    if (amount <= 0) return { ok: false, msg: '数量无效' };
    if ((s.res[from] || 0) < amount) return { ok: false, msg: '库存不足' };
    var gain = Math.floor(amount * GAME.marketRate());
    s.res[from] -= amount;
    s.res[to] = (s.res[to] || 0) + gain;
    GAME.statBump('trades', 1);
    GAME.log('市易：以 ' + U.fmt(amount) + ' 换得 ' + U.fmt(gain) + '。');
    return { ok: true, msg: '换得 ' + U.fmt(gain) + '（折损 ' + Math.round((1 - GAME.marketRate()) * 100) + '%）' };
  };


  /* ============================================================
   * 州特产 & 名城岁贡（v14）
   * 按**现实日**结算的持续收益 —— 占城不再只有一次性战利品。
   *   · 州特产：与地理绑定，占该州城池即产该州独有材料
   *   · 岁贡：按城档位给 黄金 / 声望 / 特产材料
   *   · 州治加成：握有该州州城（司隶以都城为治）时，本州特产 ×1.5
   * 目的：解开「三/四阶材料只在州城(12)/都城(1) 一次掉落后占完即断供」的断层，
   *       让「打哪里」直接决定「能造什么装备」。
   * ============================================================ */
  /* 城池州属：显式字段优先；玩家自建城按坐标就近认领最近的州城/都城 */
  GAME.stateOfCity = function (city) {
    if (!city) return null;
    if (city.state) return city.state;
    var best = null, bd = 1e9;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type !== 'zhou' && c.type !== 'capital') return;
      var d = Math.abs(c.x - (city.x || 0)) + Math.abs(c.y - (city.y || 0));
      if (d < bd) { bd = d; best = c; }
    });
    return best ? best.state : null;
  };
  /* ============================================================
   * 行政区划「州 · 郡 · 县」—— 唯一出口（v70 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「每个名城按州郡县标识（假设青州琅琊郡XX县）……
   *   其他野地城池的标识应写上其所在县」
   *
   * 判据 = **就近归属**（确定性，无随机）：
   *   · 县 = 最近的**县城**（65 座县城铺满全图，任何坐标都归一个县）；
   *   · 郡 = 该县**本州内**最近的郡城（郡城的从属不随问询点漂移 —— 用县城的坐标算）；
   *   · 州 = 该县数据里写死的 state。
   * 两个坐标问同一个县 → 永远同一结果，可断言、可缓存。
   * ============================================================ */
  GAME.regionOf = function (x, y) {
    var best = null, bd = Infinity;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type !== 'county') return;
      var d = Math.abs(c.x - x) + Math.abs(c.y - y);
      if (d < bd) { bd = d; best = c; }
    });
    if (!best) return null;
    var jun = null, jd = Infinity;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type !== 'jun' || c.state !== best.state) return;
      var d = Math.abs(c.x - best.x) + Math.abs(c.y - best.y);
      if (d < jd) { jd = d; jun = c; }
    });
    return {
      state: best.state, county: best.name, countyCity: best,
      jun: jun ? jun.name : null, junCity: jun,
    };
  };
  /* 行政名规范化：已带后缀（郡/国/县/道）的原样保留，否则补一个 —— 不造新名 */
  GAME.junNameOf = function (raw) {
    raw = String(raw == null ? '' : raw);
    return /[郡国县道州]$/.test(raw) ? raw : raw + '郡';
  };
  GAME.countyNameOf = function (raw) {
    raw = String(raw == null ? '' : raw);
    return /[郡国县道]$/.test(raw) ? raw : raw + '县';
  };
  /* 城池全称（州 · 郡 · 县 链）。名城三级齐备；自建城给「州 · 城名」；
     改过名的城用 origName 顶**行政层**（地名不随主公改名而变，参照 v45 的 origName 约定）。 */
  GAME.cityFullName = function (city) {
    if (!city) return '';
    var st = city.state || GAME.stateOfCity(city);
    var renamed = !!(city.origName && city.origName !== city.name);
    var parts = [];
    if (st) parts.push(st);
    /* 县城：行政链到「郡」为止（县本身是末段的"名字"那一层） */
    if (city.type === 'county') {
      var rg = GAME.regionOf(city.x, city.y);
      if (rg && rg.jun) parts.push(GAME.junNameOf(rg.jun));
    }
    /* 末段 = 这座城的名字：
       未改名 → 按档位规范化（郡城补「郡」、县城补「县」）；
       改过名 → **原样**用玩家起的名字（"汉寿"不该被写成"汉寿县"，
       改名也必须立刻反映在侧栏 / 城池面板上 —— e2e 的「侧栏城池名同步」盯着这条）。 */
    var name = city.name;
    if (!renamed) {
      if (city.type === 'jun') name = GAME.junNameOf(name);
      else if (city.type === 'county') name = GAME.countyNameOf(name);
    }
    parts.push(name);
    return parts.join(' · ');
  };
  /* 野外城池的标识（v70 老板「标识应写上其所在县」）：`乐安县 · 青石营` */
  GAME.fortLabelOf = function (fort) {
    if (!fort) return '';
    var rg = GAME.regionOf(fort.x, fort.y);
    return (rg && rg.county ? GAME.countyNameOf(rg.county) + ' · ' : '') + fort.name;
  };

  GAME.specialtyOf = function (city) {
    var st = GAME.stateOfCity(city);
    return st ? (DATA.STATE_SPECIALTY[st] || null) : null;
  };
  /* 该州州治是否已在我手中（司隶以都城洛阳为治） */
  GAME.hasStateSeat = function (stateName) {
    var s = GAME.state, has = false;
    if (!stateName) return false;
    ((s && s.cities) || []).forEach(function (c) {
      if (has) return;
      if (c.type !== 'zhou' && c.type !== 'capital') return;
      if (GAME.stateOfCity(c) === stateName) has = true;
    });
    return has;
  };
  /* 单城每日岁贡：{ gold, rep, mat, qty, seat }；自建城返回 null（靠外城地块与税收） */
  GAME.cityDailyYield = function (city) {
    if (!city) return null;
    var y = (DATA.CITY_YIELD || {})[city.type];
    if (!y) return null;
    var sp = GAME.specialtyOf(city);
    var seat = sp ? GAME.hasStateSeat(GAME.stateOfCity(city)) : false;
    var mul = seat ? (DATA.STATE_SEAT_BONUS || 1) : 1;
    return {
      /* v73（老板「限制黄金的获取」）：岁贡黄金走 DATA.GOLD_GATE.yield ——
         展示（官府面板）与结算（settleDailyYield）共用这一出口，不会两本账。 */
      gold: Math.round(y.gold * (DATA.GOLD_GATE.yield || 1)), rep: y.rep,
      mat: sp ? sp.mat : null,
      qty: sp ? [Math.round(y.matQty[0] * mul), Math.round(y.matQty[1] * mul)] : null,
      seat: seat,
    };
  };
  /* 全境每日岁贡汇总（UI 展示与结算共用；材料按区间中值估算） */
  GAME.dailyYieldSummary = function () {
    var s = GAME.state;
    var out = { gold: 0, rep: 0, mats: {}, cities: 0, byState: {}, seats: [] };
    ((s && s.cities) || []).forEach(function (c) {
      var d = GAME.cityDailyYield(c);
      if (!d) return;
      out.cities++;
      out.gold += d.gold;
      out.rep += d.rep;
      var st = GAME.stateOfCity(c);
      if (d.mat) {
        out.mats[d.mat] = (out.mats[d.mat] || 0) + Math.round((d.qty[0] + d.qty[1]) / 2);
        out.byState[st] = out.byState[st] || { mat: d.mat, tier: d.tier, count: 0, seat: false };
        out.byState[st].count++;
        if (d.seat) out.byState[st].seat = true;
      }
    });
    for (var k in out.byState) if (out.byState[k].seat) out.seats.push(k);
    return out;
  };
  /* 按现实日结算（主循环与离线补算均调用；同日只结一次） */
  GAME.settleDailyYield = function () {
    var s = GAME.state;
    if (!s) return null;
    var today = GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
    if (s.yieldDay == null) { s.yieldDay = today; return null; }   // 首日只登记，不发贡
    var days = today - s.yieldDay;
    if (days <= 0) return null;
    var capped = Math.min(days, DATA.YIELD_MAX_DAYS || 30);
    var gold = 0, rep = 0, mats = {};
    for (var d = 0; d < capped; d++) {
      (s.cities || []).forEach(function (c) {
        var y = GAME.cityDailyYield(c);
        if (!y) return;
        gold += y.gold; rep += y.rep;
        if (y.mat) {
          var n = y.qty[0] + Math.floor(Math.random() * (y.qty[1] - y.qty[0] + 1));
          mats[y.mat] = (mats[y.mat] || 0) + n;
        }
      });
    }
    /* 岁贡黄金是货币，不受仓库上限约束 */
    s.res.gold = (s.res.gold || 0) + gold;
    /* 声望（受赛季国策「人心思附」加成） */
    rep = Math.round(rep * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1));
    s.rep = (s.rep || 0) + rep;
    s.items = s.items || {};
    var got = [];
    for (var mid in mats) {
      s.items[mid] = (s.items[mid] || 0) + mats[mid];
      got.push((DATA.MATERIAL_BY_ID[mid] ? DATA.MATERIAL_BY_ID[mid].name : mid) + '×' + mats[mid]);
    }
    s.yieldDay = today;
    var head = '岁贡入府（' + (days > capped ? '离线 ' + days + ' 日，计 ' + capped + ' 日' : days + ' 日') + '）';
    GAME.log(head + '：金 +' + U.fmt(gold) + '、声望 +' + U.fmt(rep) + (got.length ? '、' + got.join('、') : ''));
    if (GAME.story && GAME.story.chronicleAdd) {
      GAME.story.chronicleAdd('州郡岁贡至：金' + U.fmt(gold) + '，声望' + U.fmt(rep) + '。', 'note');
    }
    return { days: days, capped: capped, gold: gold, rep: rep, mats: mats, got: got };
  };
  /* ============================================================
   * 将领月俸（v77 · 老板「经过 7 个游戏日结算 1 次」）
   * ------------------------------------------------------------
   * 定价：GAME.genSalaryOf（展示与结算唯一出口）；
   * 结算：GAME.settleGenSalary —— 锚点 world.elapsed（游戏秒），
   *   离线跨期一次结清（上限 DATA.GEN_SALARY.maxPeriods 期，防长挂扣穿）。
   * 扣款：从**各将所在城**的府库扣（与旧的逐秒扣款同一路径，只是改成月结）。
   * 缺金：扣到 0 为止，余数记欠俸（进讯息；不损忠诚 —— v14.1 拍板
   *   「忠诚只在出征战败时下降」，欠俸只警示不惩罚）。
   * ============================================================ */
  GAME.genSalaryOf = function (g) {
    if (!g) return 0;
    if (g.isLord || (GAME.isLordGeneral && GAME.isLordGeneral(g))) return 0;  // 君主不领俸
    var C = DATA.GEN_SALARY || {};
    var sum = (g.tong || 0) + (g.nz || 0) + (g.yw || 0) + (g.zm || 0);
    var v = (C.base || 0) + (g.level || 1) * (C.perLevel || 0) + sum * (C.perAttr || 0);
    var mul = (C.rankMul && C.rankMul[g.rank]) || 1;
    return Math.round(v * mul);
  };
  /* 全境月俸合计（每期）—— 君主面板 / 侧栏悬停读它 */
  GAME.genSalaryTotal = function () {
    var s = GAME.state, t = 0;
    ((s && s.generals) || []).forEach(function (g) { t += GAME.genSalaryOf(g); });
    return t;
  };
  GAME.settleGenSalary = function () {
    var s = GAME.state;
    if (!s || !s.world) return null;
    var C = DATA.GEN_SALARY || {};
    var period = (C.periodDays || 7) * 86400;
    if (!period) return null;
    if (s.salaryAt == null) { s.salaryAt = s.world.elapsed || 0; return null; }   // 旧档只登记锚点
    var due = Math.floor(((s.world.elapsed || 0) - s.salaryAt) / period);
    if (due <= 0) return null;
    var capped = Math.min(due, C.maxPeriods || 30);
    s.salaryAt = s.salaryAt + due * period;
    var paid = 0, short = 0;
    (s.cities || []).forEach(function (ct) {
      var per = 0;
      ((s.generals) || []).forEach(function (g) {
        if (g.cityId === ct.id) per += GAME.genSalaryOf(g);
      });
      if (!per) return;
      var amount = per * capped;
      var R = GAME.res(ct);
      var have = R.gold || 0;
      if (have >= amount) { R.gold = have - amount; paid += amount; }
      else { R.gold = 0; paid += have; short += amount - have; }
    });
    if (!paid && !short) return { periods: capped, paid: 0, short: 0 };
    var line = '💰 将领月俸结算（' + capped + ' 期）：金 −' + U.fmt(paid);
    if (short > 0) line += '；⚠️ 府库不足，欠俸 ' + U.fmt(short) + ' 金';
    GAME.log(line);
    return { periods: capped, paid: paid, short: short };
  };

  /* 距下次岁贡结算的剩余现实毫秒 */
  GAME.dailyYieldLeft = function () {
    var s = GAME.state;
    if (!s) return 0;
    var today = GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
    var base = (s.yieldDay == null) ? today : s.yieldDay;
    return Math.max(0, (base + 1) * 86400000 - Date.now());
  };


  /* ============================================================
   * 野地（v15）：加成线性 / 采集 / 等级衰减
   * 原版铁律：**掠夺得资源，占领得地盘**。占领野地的回报是
   *   ① 长期产量加成（每级线性，10 级湖泊 +80%）
   *   ② 采集权（把闲置兵力转成资源，并有机会得珠宝/宝物）
   *   ③ 等级会随据守时间衰减 —— 迫使轮换争夺
   * ============================================================ */
  /* 野地加成（线性）：type + 等级 → { grain: 0.24 } */
  GAME.wildAddOf = function (type, level) {
    var t = DATA.TERRAIN[type];
    if (!t || !t.add) return null;
    var lv = Math.max(0, Math.min(10, level == null ? 0 : level));
    var out = {};
    for (var r in t.add) out[r] = t.add[r] * lv;
    return out;
  };
  /* 该地形可采资源；平原/平地不可采（原版铁律）→ 返回 null */
  GAME.gatherResOf = function (type) {
    return (DATA.GATHER.resOf || {})[type] || null;
  };
  /* ============================================================
   * 野地管理（v23 · 需求 1）：驻军 / 撤军 / 放弃
   * ------------------------------------------------------------
   * 驻军不是"摆着好看"：被占野地默认**每现实日 −1 级**（decayWilds），
   * 有驻军的野地不再衰减 —— 这就是驻军的实际价值，也是它的消费点。
   * 代价：兵力离城，不再计入城内驻军。
   * ============================================================ */
  /* ============================================================
   * 野地守军（防守方）—— v27 · 需求 3
   * ------------------------------------------------------------
   * 与上面的 `wildGarrisonAt` **不是一回事**：
   *   · wildGarrisonAt  = 我方派驻在已占野地上的**驻军**（有兵就守地不衰减）
   *   · wildDefenseAt   = 野地上原本的**守军**（打它才能占）
   * 命名特意错开，避免又一次"两个同名概念互相覆盖"。
   *
   * 生成规则：按 (x, y, 现实日) 三者的哈希确定性掷点 ——
   *   同一块地在**同一天内**多次读取结果完全一致（侦查所见即所得），
   *   每现实日换一批（"今天好打、明天未必"）。
   * ============================================================ */
  GAME.wildDefenseDay = function () {
    return GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
  };
  GAME.wildDefenseAt = function (x, y, lv) {
    if (lv == null) lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : GAME.map.wildLevel(x, y);
    lv = Math.max(0, Math.min(10, lv | 0));
    var day = GAME.wildDefenseDay();
    var hash = ((x | 0) * 73856093) ^ ((y | 0) * 19349663) ^ (day * 83492791);
    var rand = U.rng(hash >>> 0);
    var tbl = DATA.WILD_DEFENSE[lv] || [];
    var wave = DATA.WILD_DEFENSE_WAVE;
    var mul = wave[0] + (wave[1] - wave[0]) * rand();
    var army = {}, total = 0;
    tbl.forEach(function (e) {
      var n = Math.round((e.min + (e.max - e.min) * rand()) * mul);
      if (n > 0) { army[e.id] = n; total += n; }
    });
    /* 守将：等级越高越可能有。有将则整支守军吃将领加成（战斗里真的生效）。 */
    var gen = null;
    var chance = DATA.WILD_GEN_CHANCE[lv] || 0;
    if (chance > 0 && rand() < chance) {
      var sn = DATA.WILD_LORD_SURNAME[Math.floor(rand() * DATA.WILD_LORD_SURNAME.length)];
      var gn = DATA.WILD_LORD_GIVEN[Math.floor(rand() * DATA.WILD_LORD_GIVEN.length)];
      var title = DATA.WILD_LORD_TITLE[Math.floor(rand() * DATA.WILD_LORD_TITLE.length)];
      var rk = DATA.GEN_RANKS[Math.min(DATA.GEN_RANKS.length - 1, 1 + Math.floor(lv / 3))];
      var g = GAME.makeGeneral(sn + gn, Math.max(3, lv * 2 + Math.floor(rand() * 5)), 'guard', null, false, rk.id, 'balance');
      g.wild = true;
      g.title = title;
      gen = g;
    }
    return { lv: lv, day: day, army: army, total: total, gen: gen };
  };

  GAME.wildGarrisonAt = function (x, y) {
    var w = GAME.map.wildAt(x, y);
    return (w && w.garrison) ? w.garrison : null;
  };
  GAME.wildGarrisonTotal = function (g) {
    var n = 0, t = (g && g.troops) || {};
    for (var k in t) n += t[k] || 0;
    return n;
  };
  /* 该野地是否被驻军守住（等级不衰减） */
  GAME.wildHeld = function (w) {
    return !!(w && w.garrison && GAME.wildGarrisonTotal(w.garrison) > 0);
  };

  /* 派军驻守：从城池扣兵 → 写入野地 garrison */
  GAME.doWildGarrison = function (x, y, army, cityId) {
    var s = GAME.state, w = GAME.map.wildAt(x, y);
    if (!w) return { ok: false, msg: '该野地尚未占领' };
    var city = GAME.cityById(cityId) || GAME.currentCity() || (s.cities || [])[0];
    if (!city) return { ok: false, msg: '无可用城池' };
    var plan = [], total = 0;
    for (var k in (army || {})) {
      var n = Math.max(0, Math.floor(army[k] || 0));
      if (!n) continue;
      if ((city.army[k] || 0) < n) {
        return { ok: false, msg: (DATA.TROOPS[k] ? DATA.TROOPS[k].name : k) + ' 不足（城内 ' + U.numText(city.army[k] || 0, 0) + '）' };
      }
      plan.push([k, n]);
      total += n;
    }
    if (!total) return { ok: false, msg: '未派遣任何兵力' };
    /* v29（需求 0）：可派驻数量 = 野地等级 × 10000。
       注意这里**只在派驻时校验一次**：野地等级日后衰减不会把已驻扎的军队
       赶回城 —— 驻军的价值正是"守住这块地不掉级"，若因掉级而强制撤军，
       就成了"越守越少"的荒诞循环。 */
    var cap = GAME.wildGarrisonCap(w.level);
    var have = GAME.wildGarrisonTotal(w.garrison);
    if (have + total > cap) {
      return {
        ok: false,
        msg: '驻军上限 ' + U.numText(cap, 0) + '（' + w.level + ' 级野地 ×'
          + U.numText(DATA.WILD_GARRISON.perLevel, 0) + '）　现有 '
          + U.numText(have, 0) + '，本次最多再派 ' + U.numText(Math.max(0, cap - have), 0),
      };
    }
    plan.forEach(function (p) {
      city.army[p[0]] -= p[1];
      if (city.army[p[0]] <= 0) delete city.army[p[0]];
    });
    w.garrison = w.garrison || { troops: {} };
    plan.forEach(function (p) {
      w.garrison.troops[p[0]] = (w.garrison.troops[p[0]] || 0) + p[1];
    });
    w.garrison.cityId = city.id;
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : w.type;
    GAME.log('驻军 ' + U.fmt(total) + ' 名于 ' + tn + ' Lv' + w.level + '（守地不衰减）');
    return { ok: true, msg: '已驻军 ' + U.fmt(total) + ' 名' };
  };

  /* 撤回驻军：兵力回城 */
  GAME.doWildWithdraw = function (x, y) {
    var s = GAME.state, w = GAME.map.wildAt(x, y);
    if (!w || !w.garrison) return { ok: false, msg: '该野地没有驻军' };
    var city = GAME.cityById(w.garrison.cityId) || GAME.currentCity() || (s.cities || [])[0];
    var n = 0;
    for (var k in w.garrison.troops) {
      var c = w.garrison.troops[k] || 0;
      if (c <= 0 || !city) continue;
      city.army[k] = (city.army[k] || 0) + c;
      n += c;
    }
    w.garrison = null;
    if (!city) return { ok: true, msg: '驻军已解散（无城池可归）' };
    GAME.log('撤回驻军 ' + U.fmt(n) + ' 名，已归 ' + city.name);
    return { ok: true, msg: '撤回驻军 ' + U.fmt(n) + ' 名' };
  };

  /* 放弃野地：先把驻军与采集队撤回（否则兵力凭空消失），再解除占领 */
  GAME.doAbandonWild = function (x, y) {
    var s = GAME.state, w = GAME.map.wildAt(x, y);
    if (!w) return { ok: false, msg: '该野地尚未占领' };
    var back = 0;
    if (w.garrison) {
      back += GAME.wildGarrisonTotal(w.garrison);
      GAME.doWildWithdraw(x, y);
    }
    var gth = GAME.gatherAt(x, y);
    if (gth) {
      back += gth.troops || 0;
      GAME.doAbandonGather(gth.id);
    }
    s.wilds = (s.wilds || []).filter(function (z) { return !(z.x === x && z.y === y); });
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : w.type;
    GAME.log('放弃野地：' + tn + ' Lv' + w.level + '（产量加成与采集权一并失去' +
      (back ? '，' + U.fmt(back) + ' 名守军/采集队已归城' : '') + '）');
    return { ok: true, msg: '已放弃 ' + tn + ' Lv' + w.level + (back ? '（' + U.fmt(back) + ' 兵归城）' : '') };
  };

  /* ============================================================
   * 城池关联数据登记表（v67 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「添加放弃城池的功能，注意梳理一下一切伴随城市产生的数据，
   *   既能便于对应产生，又能伴随放弃城市批量清除（本质上是搞好数据库表）」
   * 所以这里先立一张**表**，而不是散着写几个 filter：
   *   · 凡是"按城挂载"的数据，都在 GAME.CITY_SCOPED 里登记一行；
   *   · 放弃城池**照表清理**（clean 按表顺序执行）；
   *   · 测试照表检查：放弃之后 cityRefsOf 必须返回空 —— 漏清一项就红。
   * 新增一类按城挂载的数据时，往表里加一行即可；忘加会在测试里露出来，
   * 而不是变成线上"悬空引用"（某个队列还在指向已删的城）。
   *
   * 字段：
   *   key   state 上的路径（点号），值是数组或对象
   *   path  条目上取"归属城"的字段路径（点号；如 'garrison.cityId'）
   *   label 界面上怎么说（拒绝理由与日志都用它）
   *   hard  true = 有它就不许放弃（清了会丢兵：在途行军 / 在外采集）
   *   clean 清理动作（按表的**顺序**执行；'cities' 必须在最后 —— 前面几项还要用 city/recv）
   * ============================================================ */
  GAME.CITY_SCOPED = [
    { key: 'generals', path: 'cityId', label: '将领',
      clean: function (s, city, recv) {
        (s.generals || []).forEach(function (g) {
          if (g.cityId !== city.id) return;
          g.cityId = recv.id;
          /* 守将随城解任：城都没了，守将位自然不存在 */
          if (g.status === 'guard') g.status = 'idle';
        });
      } },
    { key: 'queues.build', path: 'cityId', label: '建造队列',
      clean: function (s, city) {
        s.queues.build = (s.queues.build || []).filter(function (q) { return q.cityId !== city.id; });
      } },
    { key: 'queues.train', path: 'cityId', label: '募兵队列',
      clean: function (s, city) {
        s.queues.train = (s.queues.train || []).filter(function (q) { return q.cityId !== city.id; });
      } },
    /* 在途部队与在外采集**不许清**：清了兵就凭空消失，所以标 hard（有它就不让放弃） */
    { key: 'marches', path: 'cityId', label: '在途行军', hard: true },
    { key: 'gathers', path: 'cityId', label: '在外采集队', hard: true },
    { key: 'wilds', path: 'garrison.cityId', label: '野地驻军',
      clean: function (s, city, recv) {
        /* 兵不丢：先把归属改到接收城，再走**既有的唯一出口**撤回
           （doWildWithdraw 自己会把兵并进那座城，不另写一份搬兵逻辑）。 */
        (s.wilds || []).forEach(function (w) {
          if (!w.garrison || w.garrison.cityId !== city.id) return;
          w.garrison.cityId = recv.id;
          GAME.doWildWithdraw(w.x, w.y);
        });
      } },
    /* ⚠️ 城池本体放最后：上面的清理还要用 city / recv */
    { key: 'cities', path: 'id', label: '城池本体',
      clean: function (s, city) {
        s.cities = (s.cities || []).filter(function (c) { return c.id !== city.id; });
      } },
  ];
  /* 按点号路径取值（登记表用；对 null/undefined 安全） */
  GAME.cityPath = function (o, p) {
    var a = p.split('.'), v = o, i;
    for (i = 0; i < a.length && v != null; i++) v = v[a[i]];
    return v;
  };
  /* 这座城身上还挂着哪些数据（只读）—— 确认框、日志与测试都读它 */
  GAME.cityRefsOf = function (cityId) {
    var s = GAME.state, out = [];
    if (!s || !cityId) return out;
    GAME.CITY_SCOPED.forEach(function (e) {
      var list = GAME.cityPath(s, e.key);
      if (!list) return;
      if (!(list instanceof Array)) list = [list];
      var n = 0;
      list.forEach(function (it) { if (GAME.cityPath(it, e.path) === cityId) n++; });
      if (n) out.push({ key: e.key, label: e.label, n: n, hard: !!e.hard });
    });
    return out;
  };
  /* 能不能放弃（真实判据的**唯一出口** —— 界面与业务共用，不许各写一份） */
  GAME.abandonCityCheck = function (cityId) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    if ((s.cities || []).length <= 1) {
      return { ok: false, msg: '这是最后一座城池 —— 放弃它就没有立足之地了' };
    }
    var refs = GAME.cityRefsOf(cityId);
    var hard = refs.filter(function (r) { return r.hard; });
    if (hard.length) {
      return { ok: false, msg: '还有 ' + hard.map(function (r) {
        return r.n + ' 支' + r.label;
      }).join('、') + '属于这座城 —— 撤回或等它们回城之后再放弃' };
    }
    var others = (s.cities || []).filter(function (c) { return c.id !== cityId; });
    return { ok: true, city: city, receiver: others[0], others: others, refs: refs };
  };
  /* 把这一格还给地图：攻占来的城 → 系统城回来；自建城 → 回到平原 */
  GAME.restoreCityTile = function (city) {
    var s = GAME.state;
    if (!s.map || !city) return;
    /* 口径与 map.generate 里的剔除**完全一致**（按各城 origId 排除已占的系统城）。
       ⚠️ 不能直接调 map.generate()：grid 已在时它开头就 return（见 map.js）。 */
    if (s.map.cities) {
      var taken = {};
      (s.cities || []).forEach(function (c) { if (c.origId) taken[c.origId] = 1; });
      s.map.cities = GAME.buildNpcCities(s.map.seed).filter(function (c) { return !taken[c.id]; });
    }
    /* 地形：攻占城的格子保持 'city'（回来的正是那座系统城，hasFort 也按 city 认）；
       自建城只可能建在平原上（canBuildCityAt 的硬约束），还回平原。 */
    var t = GAME.map.tile(city.x, city.y);
    if (t && !city.origId) t.terrain = 'plain';
  };
  /* 放弃城池（唯一入口）：照 CITY_SCOPED 表批量清理，再把格子还给地图 */
  GAME.abandonCity = function (cityId) {
    var s = GAME.state;
    var chk = GAME.abandonCityCheck(cityId);
    if (!chk.ok) return chk;
    var city = chk.city, recv = chk.receiver;
    var before = {
      army: GAME.armyTotal(city),
      gens: (s.generals || []).filter(function (g) { return g.cityId === city.id; }).length,
      build: (s.queues.build || []).filter(function (q) { return q.cityId === city.id; }).length,
      train: (s.queues.train || []).filter(function (q) { return q.cityId === city.id; }).length,
    };
    GAME.CITY_SCOPED.forEach(function (e) { if (e.clean) e.clean(s, city, recv); });
    GAME.restoreCityTile(city);
    /* UI 指针不许指向已删城（否则侧栏/城池视图会拿到一座不存在的城） */
    if (GAME.ui && GAME.ui._cityId === city.id) GAME.ui._cityId = recv.id;
    /* 自检：清完不该再有引用 —— 有的话就是登记表漏了一项（日志里能看见） */
    var left = GAME.cityRefsOf(city.id);
    GAME.log('🗑️ 放弃城池：' + city.name + '（' + U.fmt(before.army) + ' 驻军、' + before.gens
      + ' 将领归 ' + recv.name + '；建造 ' + before.build + ' 项、募兵 ' + before.train
      + ' 项取消）' + (left.length ? '　⚠️ 残留引用 ' + left.length + ' 类：'
        + left.map(function (x) { return x.key; }).join(',') : '　清理干净'));
    return { ok: true, receiver: recv, refs: left, before: before,
      msg: '已放弃 ' + city.name + '：' + U.fmt(before.army) + ' 驻军与 ' + before.gens
        + ' 名将领归 ' + recv.name };
  };

  GAME.gatherList = function () {
    var s = GAME.state;
    if (!s) return [];
    s.gathers = s.gathers || [];
    return s.gathers;
  };
  GAME.gatherAt = function (x, y) {
    var list = GAME.gatherList();
    for (var i = 0; i < list.length; i++) if (list[i].x === x && list[i].y === y) return list[i];
    return null;
  };
  GAME.gatherByGen = function (genId) {
    var list = GAME.gatherList();
    for (var i = 0; i < list.length; i++) if (list[i].genId === genId) return list[i];
    return null;
  };
  /* ============================================================
   * 采集力（v29 · 需求 0）
   * ------------------------------------------------------------
   * 收成从"数人头"改为"看采集力"：采集力 = Σ(兵种数量 × 兵种采集效率)。
   * 高级兵种单位采集效率更高（民夫 2 / 枪盾 4 / 弓 5 / 轻骑 6 / 铁骑 9 /
   * 虎豹·西凉铁骑 10 / 大象 12），于是：
   *   · 同样 5000 人，民夫产 10000 采力、铁骑产 45000 —— 一个精锐顶四个民夫；
   *   · 达到同一采力上限所需的人更少，好兵可以省下来打仗；
   *   · 器械（床弩/冲车/投石车）不善耕作，只有 2。
   * 兼容：老存档 / 只记了人数的采集队按民夫基准（basePerHour）折算。
   * ============================================================ */
  GAME.gatherPowerOf = function (g) {
    var G = DATA.GATHER;
    var army = g && g.army;
    if (army) {
      var p = 0;
      for (var id in army) {
        var t = DATA.TROOPS[id];
        if (t && army[id] > 0) p += army[id] * (t.gather != null ? t.gather : G.basePerHour);
      }
      return p;
    }
    return ((g && g.troops) || 0) * G.basePerHour;
  };
  /* 野地驻军上限（v29 · 需求 0）：野地等级 × 10000。
     **只在派驻时校验**；野地日后掉级不会把已驻军队赶回城（见 DATA.WILD_GARRISON 注释）。 */
  GAME.wildGarrisonCap = function (lv) {
    return Math.max(0, Math.round((lv || 0) * DATA.WILD_GARRISON.perLevel));
  };

  /* 采集进度与预计收成：{ hours, capped, pct, ready, res, amount, capReached } */
  GAME.gatherYield = function (g) {
    var y = GAME._rawGatherYield(g);
    if (!y) return null;
    /* 负重技巧：掠夺与采集收获 +5%/级（决定能带回多少）
       注意：返回的是**对象**，加成要作用在 amount 上，不能对整个对象取整 */
    if (y.amount > 0) y.amount = Math.round(y.amount * (1 + techB('load')));
    return y;
  };
  GAME._rawGatherYield = function (g) {
    var G = DATA.GATHER;
    if (!g) return null;
    var hours = (g.elapsed || 0) / 3600;
    var capped = Math.min(hours, G.maxHours);
    var res = GAME.gatherResOf(g.type);
    var ready = hours >= G.minHours;
    var amount = 0;
    var rawPower = GAME.gatherPowerOf(g);
    var power = Math.min(rawPower, G.powerCap);
    if (ready && res) {
      amount = Math.round(power * (1 + (g.level || 0) * G.levelBonus) * capped);
    }
    return {
      hours: hours, capped: capped, res: res, amount: amount, ready: ready,
      power: power, powerFull: rawPower, powerCap: G.powerCap,
      pct: Math.min(100, Math.floor(capped / G.maxHours * 100)),
      capReached: hours >= G.maxHours,
    };
  };
  /* 宝物概率（**将领等级只影响此项**，不影响资源收成 —— 原版规则） */
  GAME.gatherTreasureChance = function (g, genLv) {
    var G = DATA.GATHER;
    var hours = Math.min(((g && g.elapsed) || 0) / 3600, G.maxHours);
    if (hours < G.minHours) return 0;
    return Math.min(G.treasureCap, (G.treasureBase + (genLv || 0) * G.treasurePerGenLv) * Math.sqrt(hours));
  };
  GAME.canStartGather = function (x, y) {
    var s = GAME.state, G = DATA.GATHER;
    var w = GAME.map.wildAt(x, y);
    if (!w) return { ok: false, msg: '需先占领该野地，方可派军采集' };
    if (!GAME.gatherResOf(w.type)) {
      var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : '该地形';
      return { ok: false, msg: tn + '无可采之物（原版：平地不可采集）' };
    }
    if (GAME.gatherAt(x, y)) return { ok: false, msg: '该野地已在采集中' };
    if (GAME.gatherList().length >= G.maxActive) return { ok: false, msg: '同时最多 ' + G.maxActive + ' 支采集队' };
    return { ok: true, wild: w };
  };
  GAME.startGather = function (x, y, genId, army) {
    var s = GAME.state, G = DATA.GATHER;
    var chk = GAME.canStartGather(x, y);
    if (!chk.ok) return chk;
    var w = chk.wild;
    var gen = null;
    s.generals.forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的将领' };
    if (gen.status === 'march') return { ok: false, msg: gen.name + ' 正在出征中' };
    if (gen.status === 'guard') return { ok: false, msg: gen.name + ' 已任守将，请先解除任命' };
    if (GAME.gatherByGen(genId)) return { ok: false, msg: gen.name + ' 已在采集别处' };
    var troops = 0;
    for (var k in (army || {})) troops += army[k] || 0;
    if (troops <= 0) return { ok: false, msg: '请派遣兵力（兵越多收成越高）' };
    if (GAME.staNow(gen) < G.stamina) {
      return { ok: false, msg: gen.name + ' 体力不足（需 ' + G.stamina + '，现 ' + Math.round(GAME.staNow(gen)) + '）' };
    }
    var city = GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    for (var a in army) {
      if ((city.army[a] || 0) < army[a]) {
        return { ok: false, msg: '兵力不足（' + (DATA.TROOPS[a] ? DATA.TROOPS[a].name : a) + '）' };
      }
    }
    for (var a2 in army) city.army[a2] -= army[a2];
    GAME.setStaNow(gen, GAME.staNow(gen) - G.stamina);   /* v66：唯一写入口 */
    gen.status = 'gather';
    gen.cityId = null;
    var rec = {
      id: 'ga' + (s._gatherSeq = (s._gatherSeq || 0) + 1),
      x: x, y: y, type: w.type, level: w.level || 0,
      genId: genId, army: U.deep(army), troops: troops,
      cityId: city.id, elapsed: 0,
    };
    GAME.gatherList().push(rec);
    GAME.statBump('gathers', 1);
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : '';
    GAME.log('🔍 ' + gen.name + ' 率 ' + troops + ' 兵赴 ' + tn + ' Lv' + rec.level + ' 采集（满 1 小时方有收成，24 小时封顶）');
    return { ok: true, msg: '开始采集：' + gen.name + ' 率 ' + troops + ' 兵（1 小时后可收获）', gather: rec };
  };
  /* 收获 */
  GAME.finishGather = function (id) {
    var s = GAME.state, G = DATA.GATHER;
    var list = GAME.gatherList();
    var idx = -1, g = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; g = list[i]; break; }
    if (!g) return { ok: false, msg: '采集队不存在' };
    var y = GAME.gatherYield(g);
    if (!y.ready) {
      /* 原版：不足 1 小时收获为零，**并重置计时** */
      g.elapsed = 0;
      GAME.log('采集不足 1 小时，无功而返（计时重新开始）');
      return { ok: false, msg: '不足 1 小时，收获为零（计时已重置）', reset: true };
    }
    var gen = null;
    s.generals.forEach(function (x) { if (x.id === g.genId) gen = x; });
    var cap = GAME.storeCap ? GAME.storeCap() : 0;
    if (y.res && y.amount > 0) {
      s.res[y.res] = (s.res[y.res] || 0) + y.amount;
      if (cap > 0 && s.res[y.res] > cap) s.res[y.res] = cap;
    }
    /* 宝物：只有此项受将领等级影响 */
    var got = null;
    if (Math.random() < GAME.gatherTreasureChance(g, gen ? gen.level : 0)) {
      var pool = (DATA.ITEMS || []).filter(function (it) {
        return it.price > 0 && it.type !== 'material' && it.type !== 'blueprint'
          && it.type !== 'seed'   /* v78：种子走 grantSeedDrop 专属口，不进宝物随机池 */
          && it.price <= G.treasureMaxPrice;
      });
      if (pool.length) {
        var tr = pool[Math.floor(Math.random() * pool.length)];
        s.items = s.items || {};
        s.items[tr.id] = (s.items[tr.id] || 0) + 1;
        got = tr.name;
      }
    }
    /* v78（老板需求 1）：种子 —— 采集归来的另一项收获（种子的主渠道） */
    var seedGot = GAME.grantSeedDrop(g.level || 1, 1, '🌱 采集所得种子');
    /* 兵力与将领归还 */
    var city = GAME.cityById(g.cityId) || GAME.currentCity();
    if (city) { for (var a in g.army) city.army[a] = (city.army[a] || 0) + g.army[a]; }
    if (gen) {
      gen.status = 'idle';
      gen.cityId = city ? city.id : null;
      /* v26（需求 1）：统一走唯一入口 —— 顺带把这次获得的经验写进公文，
         原先裸加时玩家完全看不到采集也会涨经验。 */
      GAME.battle.gainExp(gen, Math.round(y.amount / 500) + 20, '采集归来');
    }
    list.splice(idx, 1);
    var resName = '';
    DATA.RESOURCES.forEach(function (r) { if (r.key === y.res) resName = r.name; });
    var msg = '采集收获：' + (resName || '无') + ' +' + U.fmt(y.amount) + (got ? '，另得宝物「' + got + '」' : '')
      + (seedGot.length ? '，另得 ' + seedGot.join('、') : '');
    GAME.log('📦 ' + msg);
    return { ok: true, msg: msg, res: y.res, amount: y.amount, treasure: got, seeds: seedGot };
  };
  /* 放弃采集（兵力返还、无任何收益 —— 原版规则） */
  GAME.abandonGather = function (id) {
    var s = GAME.state;
    var list = GAME.gatherList();
    var idx = -1, g = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; g = list[i]; break; }
    if (!g) return { ok: false, msg: '采集队不存在' };
    var gen = null;
    s.generals.forEach(function (x) { if (x.id === g.genId) gen = x; });
    var city = GAME.cityById(g.cityId) || GAME.currentCity();
    if (city) { for (var a in g.army) city.army[a] = (city.army[a] || 0) + g.army[a]; }
    if (gen) { gen.status = 'idle'; gen.cityId = city ? city.id : null; }
    list.splice(idx, 1);
    GAME.log('撤回采集队（无收益）');
    return { ok: true, msg: '已撤回，兵力归还（放弃采集无收益）' };
  };
  /* 按「由弱到强」抽调兵力（采集用；采集收益只看兵力总数，不看兵种）。
     这样玩家只需填一个数字，不必逐兵种分配。 */
  GAME.autoPickTroops = function (count, city) {
    city = city || GAME.currentCity();
    if (!city) return {};
    var avail = [];
    for (var id in (city.army || {})) {
      if (city.army[id] > 0 && DATA.TROOPS[id]) avail.push({ id: id, n: city.army[id], atk: DATA.TROOPS[id].atk });
    }
    avail.sort(function (a, b) { return a.atk - b.atk; });
    var out = {}, left = Math.max(0, Math.floor(Number(count) || 0));
    for (var i = 0; i < avail.length && left > 0; i++) {
      var take = Math.min(left, avail[i].n);
      if (take > 0) { out[avail[i].id] = take; left -= take; }
    }
    return out;
  };
  /* 采集推进（主循环每秒调用）：不满 24 游戏小时则累加 */
  GAME.tickGathers = function (ts) {
    var list = GAME.gatherList(), G = DATA.GATHER;
    var maxSec = G.maxHours * 3600;
    for (var i = 0; i < list.length; i++) {
      if (list[i].elapsed < maxSec) {
        list[i].elapsed = Math.min(maxSec, list[i].elapsed + ts);
      }
    }
  };
  /* 被占野地每现实日 −1 级（最低 1 级）；无主野地由日盐自动 +1 级 */
  GAME.decayWilds = function () {
    var s = GAME.state;
    if (!s || !s.wilds || !s.wilds.length) return [];
    var today = GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
    var changed = [];
    s.wilds.forEach(function (w) {
      if (w.levelDay == null) { w.levelDay = today; return; }
      /* v23（需求 1）：有驻军守着 → 等级不衰减。
         这是「驻军」的实际价值：否则占下的地只能靠轮番占领维持等级。 */
      if (GAME.wildHeld(w)) {
        if (w.levelDay !== today) w.levelDay = today;
        return;
      }
      var days = today - w.levelDay;
      if (days <= 0) return;
      var nl = Math.max(1, (w.level || 1) - days);
      w.levelDay = today;
      if (nl !== w.level) { w.level = nl; changed.push(w); }
    });
    if (changed.length) {
      GAME.log('⚠️ 久据之下野地渐荒：' + changed.length + ' 块野地等级下降（被占野地每现实日 -1 级，需轮换争夺）');
    }
    return changed;
  };


  /* ============================================================
   * 自动升级：按等级从低到高，自动升级城内/城外建筑
   * 规则：
   *   · 受建造队列上限约束（默认 2，徭役令可 +3）
   *   · 同等级优先城内功能建筑，再城外资源地块
   *   · 官府 4 格同体，只取一格代表发起
   *   · 资源不足 → 暂停并记录原因（不关闭开关）
   *   · 全部满级 → 停止
   * ============================================================ */
  GAME.autoUpgrade = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoUpgrade) return null;
    var city = GAME.currentCity() || s.cities[0];
    if (!city) return null;

    var slots = GAME.buildSlots(city);   /* v60：按该城算（名城 perk 是城属性） */
    if ((s.queues.build || []).length >= slots) {
      s.autoState = { paused: false, msg: '队列已满（' + slots + '）' };
      return null;
    }

    /* 收集候选：城内 + 城外，两者均**遍历所有城池**（v14 支持多城经营） */
    var multi = (s.cities || []).length > 1;
    var cands = [];
    (s.cities || []).forEach(function (ct) {
      var gfFirst = -1;
      for (var ci = 0; ci < ct.cells.length; ci++) {
        if (ct.cells[ci] && ct.cells[ci].official) { gfFirst = ci; break; }
      }
      ct.cells.forEach(function (cell, idx) {
        if (!cell || !cell.build || cell.pending) return;
        var b = DATA.BUILDINGS[cell.build.id];
        if (!b || cell.build.lvl >= GAME.buildCapOf(ct, b.id)) return;
        if (cell.official && idx !== gfFirst) return;   // 官府 4 格只取一格代表
        cands.push({ kind: 'city', idx: idx, cityId: ct.id, lv: cell.build.lvl,
          name: (multi ? ct.name + '·' : '') + b.name });
      });
    });
    (s.cities || []).forEach(function (ct) {
      (ct.extGrid || []).forEach(function (e, idx) {
        if (!e || !e.type || e.pending) return;
        var eb = DATA.EXT_BUILDINGS[e.type];
        if (!eb || e.lv >= GAME.buildCapOf(ct)) return;
        cands.push({ kind: 'ext', idx: idx, cityId: ct.id, lv: e.lv,
          name: (multi ? ct.name + '·' : '') + eb.name });
      });
    });

    /* v64（老板）：「城墙纳入自动建筑中」——
       城墙**不占格**（等级存在 `city.wallLv`），原先根本不在候选里，
       于是"自动升级"永远不碰它，城墙等级一直停在玩家手点的那一级。
       现在它作为**每城一个**候选参与，等级序与别的建筑同一条规则。 */
    (s.cities || []).forEach(function (ct) {
      var wlv = ct.wallLv || 0;
      if (wlv >= GAME.buildCapOf(ct, 'chengqiang')) return;
      /* 城墙不占格 → 没有 `cell.pending` 可看，必须单独查"是否已在队列里" */
      if (GAME.wallPendingOf(ct.id)) return;
      cands.push({ kind: 'wall', idx: -1, cityId: ct.id, lv: wlv,
        name: (multi ? ct.name + '·' : '') + DATA.BUILDINGS.chengqiang.name });
    });

    if (!cands.length) {
      s.autoState = { paused: false, done: true, msg: '全部建筑已满级（含城墙）' };
      return null;
    }

    /* 等级从低到高；同级**城内功能建筑 → 城墙 → 城外资源地块**
       （城墙耗石尤多，同级时不该抢在城内建筑前面） */
    var KIND_ORD = { city: 0, wall: 1, ext: 2 };
    cands.sort(function (a, b) {
      if (a.lv !== b.lv) return a.lv - b.lv;
      if (a.kind !== b.kind) return KIND_ORD[a.kind] - KIND_ORD[b.kind];
      return a.idx - b.idx;
    });

    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var r = c.kind === 'ext' ? GAME.upgradeExt(c.idx, c.cityId)
        : (c.kind === 'wall' ? GAME.buildWall(c.cityId)
          : GAME.upgradeAt(c.cityId || city.id, c.idx));
      if (r && r.ok) {
        s.autoState = { paused: false, last: c.name, msg: '正在升级 ' + c.name + ' → Lv' + (c.lv + 1) };
        GAME.log('自动升级：' + c.name + ' → Lv' + (c.lv + 1));
        return { ok: true, target: c };
      }
      if (r && !r.ok && /不足/.test(r.msg)) {
        /* 资源不足 → 暂停，等待资源恢复后自动继续 */
        s.autoState = { paused: true, reason: r.msg, want: c.name, msg: '资源不足，暂停中（待升级 ' + c.name + '）' };
        return { paused: true, reason: r.msg, target: c };
      }
    }
    s.autoState = { paused: false, msg: '暂无可升级项' };
    return null;
  };

  /* ============================================================
   * 自动研究（v16 · 需求 #8）：与自动建造并列
   * 按「科技等级从低到高」自动排队；黄金/资源不足则暂停（不关开关）
   * ============================================================ */
  /* ============================================================
   * 自动出征（v29 · 需求 5）
   * ------------------------------------------------------------
   * 参数：将领 / 兵力 / 目标类型 / 目标等级上限 / 出征类型 / 频率。
   * 红线（写死在实现里，不进设置）：
   *   ① 只派**空闲**将领 —— 出征中/守将/采集中的一律跳过；
   *   ② 体力不足该出征方式的门槛就不出发（不会把将跑废）；
   *   ③ 器械（床弩/冲车/投石车）、斥候、辎重**不编入**自动队伍 ——
   *      它们拖慢行军且是守城家底；
   *   ④ 只从**当前城池**的驻军里取兵，不抽空别的城；
   *   ⑤ 目标必须是"离当前城最近的、符合条件的那一块"，
   *      已占野地与今日已破的据点跳过（不做重复劳动）。
   * ============================================================ */
  GAME.autoMarchCfg = function () {
    var s = GAME.state;
    if (!s || !s.settings) return null;
    var A = DATA.AUTO_MARCH;
    if (!s.settings.autoMarch) {
      s.settings.autoMarch = {
        on: false, genId: null, troops: A.troopOptions[1], target: 'wild',
        maxLevel: 3, mode: 'raid', everyMin: A.defaultFreqMin, last: 0,
      };
    }
    var c = s.settings.autoMarch;
    /* 旧档/手工改档的兜底：字段缺失就补默认，避免界面读到 undefined */
    if (c.troops == null) c.troops = A.troopOptions[1];
    if (c.target == null) c.target = 'wild';
    if (c.maxLevel == null) c.maxLevel = 3;
    if (c.mode == null) c.mode = 'raid';
    if (c.everyMin == null) c.everyMin = A.defaultFreqMin;
    return c;
  };
  /* 附近有没有可打的目标（按切比雪夫距离取最近的一块） */
  GAME.autoMarchTargetAt = function (cfg, x, y, d) {
    var tile = GAME.map.tile(x, y);
    if (!tile || tile.terrain === 'city') return null;
    if (cfg.target === 'wild') {
      if (GAME.map.wildAt(x, y)) return null;              // 已占的野地不重复打
      var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : GAME.map.wildLevel(x, y);
      if (lv > cfg.maxLevel) return null;
      return { kind: 'wild', x: x, y: y, lv: lv, d: d };
    }
    if (cfg.target === 'fort') {
      if (!GAME.map.fortAt) return null;
      var f = GAME.map.fortAt(x, y);
      if (!f || f.level > cfg.maxLevel) return null;
      var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
      if ((GAME.state.fortsRazed || {})[x + ',' + y] === day) return null;  // 今日已破
      return { kind: 'fort', x: x, y: y, lv: f.level, d: d };
    }
    return null;
  };
  GAME.autoMarchFindTarget = function (cfg, city) {
    var A = DATA.AUTO_MARCH, rad = A.searchRadius;
    var best = null, bestD = Infinity;
    /* 「名城」目标不在坐标里找，而是从已生成的 NPC 城池列表里挑最近的一座 */
    if (cfg.target === 'city') {
      ((GAME.state.map && GAME.state.map.cities) || []).forEach(function (npc) {
        if (!npc || npc.owner !== 'npc') return;
        if ((npc.level || 0) > cfg.maxLevel) return;
        var d = Math.max(Math.abs(npc.x - city.x), Math.abs(npc.y - city.y));
        if (d < bestD) { bestD = d; best = { kind: 'city', id: npc.id, x: npc.x, y: npc.y, lv: npc.level, d: d, name: npc.name }; }
      });
      return best;
    }
    for (var dy = -rad; dy <= rad; dy++) {
      for (var dx = -rad; dx <= rad; dx++) {
        var d2 = Math.max(Math.abs(dx), Math.abs(dy));
        if (d2 >= bestD) continue;
        var x = city.x + dx, y = city.y + dy;
        if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
        var hit = GAME.autoMarchTargetAt(cfg, x, y, d2);
        if (hit) { best = hit; bestD = d2; }
      }
    }
    return best;
  };
  /* 编队：按优先级从当前城取够 want 人；器械/斥候/辎重不编入 */
  GAME.autoMarchPickArmy = function (city, want) {
    var A = DATA.TROOPS, out = {}, n = 0;
    (DATA.AUTO_MARCH.troopOrder || []).forEach(function (id) {
      if (n >= want) return;
      var have = ((city.army) || {})[id] || 0;
      var t = A[id];
      if (have <= 0 || !t || t.craft || t.nocombat) return;
      var take = Math.min(have, want - n);
      if (take > 0) { out[id] = take; n += take; }
    });
    return { army: out, total: n };
  };
  GAME.autoMarchOnce = function (cfg) {
    var s = GAME.state;
    cfg = cfg || GAME.autoMarchCfg();
    if (!cfg) return { ok: false, msg: '状态未就绪' };
    var city = GAME.currentCity();
    if (!city) return { ok: false, msg: '无可用城池' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === cfg.genId) gen = g; });
    if (!gen) return { ok: false, msg: '请先指定执行自动出征的将领' };
    /* 红线①：只派空闲将领 */
    if (gen.status && gen.status !== 'idle') {
      return { ok: false, msg: gen.name + ' 正在' + (gen.status === 'guard' ? '任守将'
        : gen.status === 'march' ? '出征' : '采集') + '，本次跳过' };
    }
    var mode = GAME.battle.modeOf(cfg.mode);
    /* 红线②：体力不足不出征（v66：池子口径，与界面显示的体力是同一个数） */
    if (GAME.staNow(gen) < mode.stamina) {
      return { ok: false, msg: gen.name + ' 体力不足（需 ' + mode.stamina + '，现 '
        + Math.round(GAME.staNow(gen)) + '），休整中' };
    }
    var t = GAME.autoMarchFindTarget(cfg, city);
    if (!t) {
      return { ok: false, msg: '「' + city.name + '」周边 ' + DATA.AUTO_MARCH.searchRadius
        + ' 格内没有符合条件的目标（' + mode.name + ' · 等级 ≤ ' + cfg.maxLevel + '）' };
    }
    var pick = GAME.autoMarchPickArmy(city, cfg.troops);
    if (!pick.total) return { ok: false, msg: city.name + ' 城内无兵可派（器械与斥候不计入编队）' };
    var r = GAME.march.dispatch(t, cfg.mode, pick.army, gen.id);
    if (!r || !r.ok) return { ok: false, msg: (r && r.msg) || '出征未能发出' };
    var tl = t.kind === 'wild' ? ('野地 Lv' + t.lv + ' (' + t.x + ',' + t.y + ')') : (t.name || '目标');
    return {
      ok: true, target: t, gen: gen, army: pick.army, total: pick.total,
      msg: gen.name + ' 率 ' + U.fmt(pick.total) + ' 兵 ' + mode.name + ' ' + tl,
    };
  };
  /* 主循环驱动：按"频率"（现实分钟）节流 */
  GAME.autoMarch = function () {
    var s = GAME.state;
    var cfg = GAME.autoMarchCfg();
    if (!cfg || !cfg.on) return null;
    var now = U.now();
    if (now - (cfg.last || 0) < cfg.everyMin * 60000) return null;
    cfg.last = now;
    var r = GAME.autoMarchOnce(cfg);
    s.autoMarchInfo = { ok: r.ok, msg: r.msg, at: now };
    if (r.ok) GAME.log('🤖 自动出征：' + r.msg);
    return r;
  };

  GAME.autoResearch = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoResearch) return null;
    var city = GAME.currentCity() || s.cities[0];
    if (!city) return null;
    var shuLv = GAME.buildingLevel(city, 'shuyuan');
    if (shuLv <= 0) { s.autoTechState = { paused: true, msg: '需先建造书院' }; return null; }
    if ((s.queues.tech || []).length > 0) {
      var cur = s.queues.tech[0];
      var cn = cur.techId;
      (DATA.TECH || []).forEach(function (t) { if (t.id === cur.techId) cn = t.name; });
      s.autoTechState = { msg: '正在研究 ' + cn };
      return null;
    }
    var cands = (DATA.TECH || []).filter(function (t) {
      return shuLv >= t.lv && (s.techs[t.id] || 0) < 10;
    }).sort(function (a, b) {
      var la = s.techs[a.id] || 0, lb = s.techs[b.id] || 0;
      return la - lb || a.lv - b.lv;
    });
    if (!cands.length) { s.autoTechState = { done: true, msg: '科技已全部满级（或受书院等级限制）' }; return null; }
    for (var i = 0; i < cands.length; i++) {
      var r = GAME.systems.research(cands[i].id);
      if (r && r.ok) { s.autoTechState = { msg: '正在研究 ' + cands[i].name }; GAME.log('自动研究：' + cands[i].name); return r; }
      if (r && /不足/.test(r.msg)) { s.autoTechState = { paused: true, want: cands[i].name, msg: r.msg }; return r; }
    }
    s.autoTechState = { msg: '暂无可研究项' };
    return null;
  };

  /* ============================================================
   * 平原筑城（v16 · P2-10）：原版平地带资源可筑新城
   * ============================================================ */
  GAME.BUILD_CITY_COST = { grain: 10000, wood: 10000, stone: 10000, iron: 10000, gold: 10000 };
  GAME.canBuildCityAt = function (x, y) {
    var s = GAME.state;
    var w = GAME.map.wildAt(x, y);
    if (!w) return { ok: false, msg: '需先占领该野地，方可在其上筑城' };
    if (w.type !== 'plain') {
      var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : w.type;
      return { ok: false, msg: '只有**平原**可以筑城（' + tn + ' 不可）' };
    }
    for (var i = 0; i < (s.cities || []).length; i++) {
      if (s.cities[i].x === x && s.cities[i].y === y) return { ok: false, msg: '此处已是我方城池' };
    }
    if (!GAME.canAfford(GAME.BUILD_CITY_COST)) {
      return { ok: false, msg: '资源不足（需 粮/木/石/铁/金 各 ' + U.fmt(GAME.BUILD_CITY_COST.grain) + '）' };
    }
    return { ok: true, wild: w };
  };
  GAME.buildCityAt = function (x, y) {
    var s = GAME.state;
    var chk = GAME.canBuildCityAt(x, y);
    if (!chk.ok) return chk;
    GAME.payCost(GAME.BUILD_CITY_COST);
    var stName = GAME.stateOfCity({ x: x, y: y });
    var city = GAME.makeCity({
      id: 'new_' + x + '_' + y, name: '新城' + (s.cities.length + 1),
      x: x, y: y, type: 'self', state: stName,
    });
    s.cities.push(city);
    /* 筑城后该野地转为城池地块，从附属野地中移除 */
    s.wilds = (s.wilds || []).filter(function (w) { return !(w.x === x && w.y === y); });
    var tile = GAME.map.tile(x, y);
    if (tile) tile.terrain = 'city';
    GAME.log('🏯 于 (' + x + ',' + y + ') 筑新城「' + city.name + '」（耗 粮木石铁金 各 ' + U.fmt(GAME.BUILD_CITY_COST.grain) + '）');
    return { ok: true, msg: '筑城成功：' + city.name, city: city };
  };

  /* ============================================================
   * 城池坐标与迁址（v70 · 老板）
   * ------------------------------------------------------------
   * 老板三条：
   *   ① 「城池的主界面提供其坐标（500×500），自动确认」；
   *   ② 「一键随机当前城池坐标位置（除名城，名城固定）」；
   *   ③ 「为玩家城池提供坐标切换，移动到某坐标时，替换原地块建筑」
   *
   * 口径（唯一出口，界面与业务共用 —— 界面置灰与真执行读同一份判据）：
   *   · 可迁 = **自建城**（`type === 'self'`）。攻占来的名城/州郡县城带 origId，
   *     它的坐标是"历史上就在那里"的地理事实 → 固定（老板："除名城，名城固定"）。
   *   · 可迁入的坐标 = **平原**、界内（0~499）、且无任何占用
   *     （我方城 / 系统城 / 野外城池 / 已占野地）。与「平原筑城」同一条地形约束 ——
   *     自建城脚下必是平原，所以"旧地块还原"有确定答案：还回平原。
   *   · 「替换原地块建筑」= 旧坐标那格归还地图（恢复地形），新坐标那格成为城池。
   * ============================================================ */
  GAME.COORD_MAX = (DATA.MAP_W || 500) - 1;
  GAME.coordText = function (city) {
    if (!city) return '—';
    return '(' + city.x + ', ' + city.y + ')';
  };
  /* 可迁判据：自建城才可迁（名城 = 地理固定） */
  GAME.isMovableCity = function (city) {
    return !!(city && city.type === 'self');
  };
  /* 目标坐标是否可迁入 —— **唯一判据** */
  GAME.canCityMoveTo = function (city, x, y) {
    var s = GAME.state;
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    if (!GAME.isMovableCity(city)) {
      return { ok: false, msg: '名城地望固定 —— 只有自建城可以迁址' };
    }
    x = Math.round(Number(x)); y = Math.round(Number(y));
    if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x > GAME.COORD_MAX || y > GAME.COORD_MAX) {
      return { ok: false, msg: '坐标须在 0 ~ ' + GAME.COORD_MAX + ' 之间' };
    }
    if (city.x === x && city.y === y) return { ok: false, msg: '已在目标坐标上' };
    var own = GAME.map.ownCityAt(x, y);
    if (own) return { ok: false, msg: '该坐标已有我方城池「' + own.name + '」' };
    var npc = GAME.map.npcAt(x, y);
    if (npc) return { ok: false, msg: '该坐标为名城「' + npc.name + '」所据，不可占用' };
    var fort = GAME.map.fortAt(x, y);
    if (fort) return { ok: false, msg: '该坐标是野外城池「' + fort.name + '」，需先攻取' };
    var w = GAME.map.wildAt(x, y);
    if (w) return { ok: false, msg: '该坐标是已占野地，不可占用' };
    var t = GAME.map.tile(x, y);
    if (!t) return { ok: false, msg: '坐标越出地图' };
    if (t.terrain !== 'plain') {
      var tn = DATA.TERRAIN[t.terrain] ? DATA.TERRAIN[t.terrain].name : t.terrain;
      return { ok: false, msg: '只有**平原**可以立城（' + tn + ' 不可）' };
    }
    return { ok: true };
  };
  /* 迁址（唯一执行）：旧格归还地图 → 新址脚下变城池 → 坐标落定 */
  GAME.moveCityTo = function (cityId, x, y) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var chk = GAME.canCityMoveTo(city, x, y);
    if (!chk.ok) return chk;
    x = Math.round(Number(x)); y = Math.round(Number(y));
    var from = { x: city.x, y: city.y };
    /* ① 旧格归还：走「放弃城池」同一出口 restoreCityTile（自建城 → 还回平原） */
    GAME.restoreCityTile(city);
    /* ② 落新址 */
    city.x = x; city.y = y;
    var t = GAME.map.tile(x, y);
    if (t) t.terrain = 'city';
    GAME.log('📍 迁址：' + city.name + ' (' + from.x + ',' + from.y + ') → (' + x + ',' + y + ')');
    return { ok: true, msg: '已迁至 (' + x + ', ' + y + ')', city: city, from: from };
  };
  /* 掷一个可迁坐标（纯函数：rnd 可注入 → 测试确定；默认 Math.random） */
  GAME.randomCityCoord = function (city, rnd) {
    var rand = rnd || Math.random;
    var M = GAME.COORD_MAX;
    for (var i = 0; i < 400; i++) {
      var x = Math.floor(rand() * (M + 1)), y = Math.floor(rand() * (M + 1));
      if (GAME.canCityMoveTo(city, x, y).ok) return { x: x, y: y };
    }
    return null;
  };
  /* 一键随机（老板："一键随机当前城池坐标位置"） */
  GAME.randomMoveCity = function (cityId) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    if (!GAME.isMovableCity(city)) return { ok: false, msg: '名城地望固定 —— 只有自建城可以迁址' };
    var c = GAME.randomCityCoord(city);
    if (!c) return { ok: false, msg: '地图上暂无可迁的平原空地' };
    var r = GAME.moveCityTo(city.id, c.x, c.y);
    if (r.ok) r.msg = '🎲 已随机迁至 (' + c.x + ', ' + c.y + ')';
    return r;
  };

  /* v82（老板）：「官府不需要征收物质这个功能去除」——
     征收（GAME.levy / GAME.levyPlan / GAME.levyReady + DATA.LEVY_CD /
     LEVY_RES_RATE / LEVY_MAT_QTY / LEVY_HEARTS + city.lastLevy）整段退役。
     特产展示改读 GAME.specialtyOf / GAME.stateOfCity（岁贡与州治加成的口径不变）。 */
  /* ============================================================
   * 铁匠铺打造（装备获取的主要途径）
   * ① 铁匠铺等级决定可打造品质（1/3/5/7 级 → 凡/良/珍/神品）
   * ② 消耗黄金 + 铁 + 木 + 石；套装件成本 ×2.2
   * ③ 套装件需先持有该套「图纸」（商城购买 / 攻城缴获 / 奇遇）
   * ============================================================ */
  GAME.forgeLevel = function () {
    var c = GAME.currentCity();
    return GAME.buildingLevel(c, 'tiejiangpu') || 0;
  };
  /* 铁匠铺等级 → 可打造的最高品质 */
  GAME.forgeMaxQ = function () {
    var lv = GAME.forgeLevel(), t = DATA.FORGE.tierLv, out = 0;
    for (var i = 0; i < t.length; i++) if (lv >= t[i]) out = i + 1;
    return out;
  };
  GAME.forgeCost = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (!it) return null;
    var base = DATA.FORGE.costByQ[it.q] || DATA.FORGE.costByQ[1];
    var m = (it.set ? DATA.FORGE.setMul : 1) * (DATA.FORGE.slotMul[it.slot] || DATA.FORGE.slotMulDef);
    /* 合成技巧：打造黄金消耗 −3%/级（封顶 −50%） */
    var goldDisc = Math.min(0.5, techB('synth'));
    return {
      gold: Math.round(base.gold * m * (1 - goldDisc)),
      iron: Math.round(base.iron * m),
      wood: Math.round(base.wood * m),
      stone: Math.round(base.stone * m),
    };
  };
  /* 该装备所需材料（按部位定种类，按品质定数量） */
  /* --------- 物品估值（背包排序与展示用） --------- */
  GAME.itemValue = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (it) {
      var base = [0, 120, 700, 4200, 24000][it.q] || 100;
      return Math.round(base * (DATA.FORGE.slotMul[it.slot] || 1) * (it.set ? 2.2 : 1));
    }
    var x = null;
    (DATA.ITEMS || []).forEach(function (v) { if (v.id === itemId) x = v; });
    if (x) return (x.price || 1) * 100;
    return 10;
  };

  /* ============================================================
   * v79（老板第 4 条）：「装备强化是针对单件装备的，同名装备搞个区分办法」
   * ------------------------------------------------------------
   * 装备从"种"升级为"件"：库存与穿戴里存**实例** { u, id, enh }——
   *   u   = 件号（s.nextEqU 递增；同名按件号排序 → 甲/乙/丙… 序号）
   *   id  = 装备谱 id（DATA.EQUIP 的键）
   *   enh = 百炼等级（**按件**记，0..max）
   * 兼容：旧的纯 id 字符串（老档 / 测试夹具）照读不误 ——
   *   一律经 eqId / eqEnhOf 取值，读取方**不许**再直接下标。
   * ============================================================ */
  GAME.eqId = function (x) { return (x && typeof x === 'object') ? x.id : x; };
  GAME.eqEnhOf = function (x) { return (x && typeof x === 'object' && x.enh) || 0; };
  GAME.eqUidOf = function (x) { return (x && typeof x === 'object') ? x.u : null; };
  GAME.eqMake = function (id, enh) {
    var s = GAME.state;
    s.nextEqU = (s.nextEqU || 0) + 1;
    return { u: s.nextEqU, id: id, enh: Math.max(0, Math.min(GAME.enhMax(), enh || 0)) };
  };
  /* 入包（**唯一出口**：打造 / 缴获 / 卸下 / 归还 都走它） */
  GAME.addEquip = function (id, enh) {
    var s = GAME.state;
    s.inventory = s.inventory || [];
    var inst = GAME.eqMake(id, enh);
    s.inventory.push(inst);
    return inst;
  };
  /* 全部件（背包 + 穿戴） */
  GAME.eqPieces = function () {
    var s = GAME.state, out = [];
    ((s && s.inventory) || []).forEach(function (x) { if (x) out.push(x); });
    ((s && s.generals) || []).forEach(function (g) {
      for (var sl in (g.equip || {})) if (g.equip[sl]) out.push(g.equip[sl]);
    });
    return out;
  };
  /* 找一件：件号（数字）→ 实例；实例 → 自身；装备 id → 第一件（背包优先） */
  GAME.eqFind = function (ref) {
    var s = GAME.state;
    if (ref && typeof ref === 'object') return ref;
    var inv = (s && s.inventory) || [], found = null, i;
    var isNum = (typeof ref === 'number') || /^\d+$/.test(String(ref));
    if (isNum) {
      var u = Number(ref);
      for (i = 0; i < inv.length; i++) if (inv[i] && inv[i].u === u) return inv[i];
      ((s && s.generals) || []).forEach(function (g) {
        for (var sl in (g.equip || {})) if (g.equip[sl] && g.equip[sl].u === u) found = found || g.equip[sl];
      });
      return found;
    }
    for (i = 0; i < inv.length; i++) if (GAME.eqId(inv[i]) === ref) return inv[i];
    ((s && s.generals) || []).forEach(function (g) {
      for (var sl in (g.equip || {})) if (GAME.eqId(g.equip[sl]) === ref) found = found || g.equip[sl];
    });
    return found;
  };
  /* 同名群（按件号升序）—— 序号（甲/乙/丙…）由此派生 */
  GAME.eqGroupOf = function (id) {
    return GAME.eqPieces().filter(function (x) { return GAME.eqId(x) === id; })
      .sort(function (a, b) { return (GAME.eqUidOf(a) || 0) - (GAME.eqUidOf(b) || 0); });
  };
  GAME.eqSerial = function (x) {
    var u = GAME.eqUidOf(x);
    if (u == null) return '';
    var g = GAME.eqGroupOf(GAME.eqId(x));
    if (g.length < 2) return '';
    var idx = -1;
    for (var i = 0; i < g.length; i++) if (GAME.eqUidOf(g[i]) === u) { idx = i; break; }
    if (idx < 0) return '';
    var STEMS = '甲乙丙丁戊己庚辛壬癸';
    return idx < STEMS.length ? STEMS.charAt(idx) : ('#' + (idx + 1));
  };
  GAME.eqName = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    return it ? it.name : '（装备）';
  };
  /* 显示名 = 名 + 强化 + 同名序号（老板要的「区分办法」） */
  GAME.eqLabel = function (x) {
    var lv = GAME.eqEnhOf(x), sn = GAME.eqSerial(x);
    return GAME.eqName(x) + (lv ? ' +' + lv : '') + (sn ? '·' + sn : '');
  };
  /* 存档迁移（唯一出口；loadGame 调用）：旧 id 串 → 实例；
     旧"按种"强化（s.forgeEnh）并入该种**第一件**，其余从 0 起。 */
  GAME.migrateEquipModel = function (s) {
    if (!s || s._eqModel2) return s;
    var legacyEnh = s.forgeEnh || {};
    var mk = function (id, enh) {
      s.nextEqU = (s.nextEqU || 0) + 1;
      return { u: s.nextEqU, id: id, enh: enh || 0 };
    };
    var take = function (id) {
      if (legacyEnh[id] > 0) { var e = legacyEnh[id]; delete legacyEnh[id]; return e; }
      return 0;
    };
    if (Array.isArray(s.inventory)) {
      s.inventory = s.inventory.map(function (x) {
        if (x && typeof x === 'object') return x;
        return mk(x, take(x));
      });
    }
    (s.generals || []).forEach(function (g) {
      if (!g || !g.equip) return;
      for (var sl in g.equip) {
        var v = g.equip[sl];
        if (v && typeof v === 'object') continue;
        g.equip[sl] = mk(v, take(v));
      }
    });
    delete s.forgeEnh;
    s._eqModel2 = 1;
    return s;
  };

  /* --------- 装备拆解：回收部分打造材料（v79：按**件**拆） --------- */
  GAME.salvageEquip = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '背包中没有这件装备' };
    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '无此装备' };
    var idx = (s.inventory || []).indexOf(inst);
    if (idx < 0) return { ok: false, msg: '该件不在背包（正穿在将领身上，先卸下）' };
    var label = GAME.eqLabel(inst);
    var mats = GAME.forgeMaterials(itemId), got = [];
    var due = { };
    for (var k in mats) {
      var n = Math.max(1, Math.floor(mats[k] * (DATA.FORGE.salvageRate || 0.4)));
      due[k] = n;
      got.push((DATA.MATERIAL_BY_ID[k] ? DATA.MATERIAL_BY_ID[k].name : k) + '×' + n);
    }
    s.items = s.items || {};
    for (var k2 in due) s.items[k2] = (s.items[k2] || 0) + due[k2];
    s.inventory.splice(idx, 1);
    GAME.statBump('salvaged', 1);
    GAME.log('拆解 ' + label + '，回收 ' + got.join('、'));
    return { ok: true, msg: '已拆解 ' + label + '，回收 ' + got.join('、'), got: got };
  };

  /* 配方解析（v13）：部位 → 系列组合；品质 → 品阶（1~4）
   * 例：武器 = 铁系+木系+筋系，神品(q4) 即 陨铁×16 + 建木×11 + 龙筋×6 */
  GAME.forgeMaterials = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (!it) return {};
    var series = DATA.FORGE.matBySlot[it.slot] || ['iron', 'leather'];
    var qty = DATA.FORGE.qtyByQ[it.q] || DATA.FORGE.qtyByQ[1];
    var mul = it.set ? (DATA.FORGE.setMatMul || 1) : 1;
    var out = {};
    /* 打造技巧：材料消耗 −3%/级（封顶 −60%，至少各 1 个） */
    var matDisc = Math.min(0.6, techB('forge'));
    for (var i = 0; i < series.length; i++) {
      var mid = DATA.MAT_OF(series[i], it.q);
      if (!mid) continue;
      out[mid] = Math.max(1, Math.round((qty[i] || 1) * mul * (1 - matDisc)));
    }
    return out;
  };
  GAME.hasMaterials = function (itemId) {
    var need = GAME.forgeMaterials(itemId), s = GAME.state, items = s.items || {};
    for (var k in need) if ((items[k] || 0) < need[k]) return false;
    return true;
  };
  GAME.payMaterials = function (itemId) {
    var need = GAME.forgeMaterials(itemId), s = GAME.state, items = s.items = s.items || {};
    for (var k in need) {
      items[k] = (items[k] || 0) - need[k];
      if (items[k] <= 0) delete items[k];
    }
  };

  /* 该装备所需图纸（套装件才有） */
  GAME.blueprintOf = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (!it || !it.set) return null;
    for (var i = 0; i < DATA.BLUEPRINTS.length; i++) if (DATA.BLUEPRINTS[i].set === it.set) return DATA.BLUEPRINTS[i];
    return null;
  };
  GAME.hasBlueprint = function (itemId) {
    var bp = GAME.blueprintOf(itemId);
    if (!bp) return true;
    var s = GAME.state;
    return !!((s.items || {})[bp.id] > 0);
  };
  /* 可打造清单（按品质分组，供 UI 渲染） */
  GAME.forgeList = function () {
    var maxQ = GAME.forgeMaxQ();
    var out = [];
    Object.keys(DATA.EQUIP).forEach(function (id) {
      var it = DATA.EQUIP[id];
      if (!it || it.craft !== true && !it.set) return;   // 只列可打造件（散件 + 套装件）
      out.push({
        id: id, item: it, q: it.q,
        tierOk: it.q <= maxQ,
        bpOk: GAME.hasBlueprint(id),
        bp: GAME.blueprintOf(id),
        cost: GAME.forgeCost(id),
        mats: GAME.forgeMaterials(id),
        matsOk: GAME.hasMaterials(id),
        forged: (GAME.state.forged || []).indexOf(id) >= 0,
      });
    });
    out.sort(function (a, b) { return a.q - b.q || (a.item.slot < b.item.slot ? -1 : 1); });
    return out;
  };
  GAME.forge = function (itemId) {
    var s = GAME.state, it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '未知装备' };
    var canCraft = it.craft === true || !!it.set;
    if (!canCraft) return { ok: false, msg: '此物非铁匠铺所能打造' };
    if (GAME.forgeLevel() <= 0) return { ok: false, msg: '需先建造铁匠铺' };
    var maxQ = GAME.forgeMaxQ();
    if (it.q > maxQ) {
      var needLv = DATA.FORGE.tierLv[it.q - 1] || 7;
      return { ok: false, msg: '铁匠铺等级不足（打造' + (DATA.Q_NAME[it.q] || '') + '需 Lv' + needLv + '）' };
    }
    var bp = GAME.blueprintOf(itemId);
    if (bp && !GAME.hasBlueprint(itemId)) return { ok: false, msg: '缺少「' + bp.name + '」（商城可购，或攻占名城缴获）' };
    var cost = GAME.forgeCost(itemId);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资材不足（需 ' + GAME.costString(cost) + '）' };
    var mats = GAME.forgeMaterials(itemId);
    if (!GAME.hasMaterials(itemId)) {
      var lack = [];
      var sItems = GAME.state.items || {};
      for (var mk in mats) {
        if ((sItems[mk] || 0) < mats[mk]) {
          var md = DATA.MATERIAL_BY_ID[mk];
          lack.push((md ? md.name : mk) + ' ' + (sItems[mk] || 0) + '/' + mats[mk]);
        }
      }
      return { ok: false, msg: '打造材料不足：' + lack.join('、') + '（攻打野地或城池可获）' };
    }
    GAME.payCost(cost);
    GAME.payMaterials(itemId);
    /* v16：套装件打造**消耗 1 张图纸**（此前为永久持有、无限打造） */
    if (bp) {
      s.items = s.items || {};
      s.items[bp.id] = (s.items[bp.id] || 0) - 1;
      if (s.items[bp.id] <= 0) delete s.items[bp.id];
    }
    GAME.addEquip(itemId);   /* v79：入包唯一出口（生成实例，件号递增） */
    s.forged = s.forged || [];
    if (s.forged.indexOf(itemId) < 0) s.forged.push(itemId);
    GAME.statBump('forgedCount', 1);
    GAME.log('铁匠铺打造：' + it.name + '（' + (DATA.Q_NAME[it.q] || '') + '）');
    return { ok: true, msg: '打造完成：' + it.name, itemId: itemId };
  };

  /* ============================================================
   * 铁匠铺 · 百炼强化（v77 立项 / v79 改**按件**）
   * ------------------------------------------------------------
   * 老板第 4 条：「装备强化是针对单件装备的，同名装备搞个区分办法」——
   * 强化等级从 s.forgeEnh[itemId]（按种共享）迁到**实例** inst.enh（按件）：
   * 同名多件各有各的等级，靠 +N 与 甲/乙/丙 序号区分（见 GAME.eqLabel）。
   * 效果并入 genEquipBonus（唯一出口），这里只管"能不能升、花多少"。
   * ============================================================ */
  GAME.enhOf = function (x) { return GAME.eqEnhOf(x); };   /* 实例/身份证 → 该件强化级 */
  GAME.enhMax = function () { return (DATA.ENHANCE && DATA.ENHANCE.max) || 10; };
  /* 下一级成本（唯一出口；UI 与扣费读同一份） */
  GAME.enhCost = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    if (!it) return null;
    var base = (DATA.FORGE.costByQ || {})[it.q] || DATA.FORGE.costByQ[1];
    var lv = GAME.enhOf(x);
    var C = DATA.ENHANCE || {};
    return {
      gold: Math.round((base.gold || 0) * (C.goldMul || 0.35) * (lv + 1)),
      iron: Math.round((base.iron || 0) * (C.ironMul || 0.22) * (lv + 1)),
      stone: Math.round((base.stone || 0) * (C.stoneMul || 0.22) * (lv + 1)),
    };
  };
  /* 可强化清单：背包 + 穿戴里的**全部件**（品质高、已强化者在前） */
  GAME.enhList = function () {
    var out = GAME.eqPieces().slice();
    out.sort(function (a, b) {
      return (DATA.EQUIP[GAME.eqId(b)].q - DATA.EQUIP[GAME.eqId(a)].q)
        || (GAME.enhOf(b) - GAME.enhOf(a));
    });
    return out;
  };
  GAME.enhance = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '尚未拥有这件装备（先打造或缴获）' };
    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '未知装备' };
    if (GAME.forgeLevel() <= 0) return { ok: false, msg: '需先建造铁匠铺' };
    var lv = GAME.enhOf(inst);
    var label0 = GAME.eqLabel(inst);
    if (lv >= GAME.enhMax()) return { ok: false, msg: '「' + label0 + '」已至 +' + GAME.enhMax() + '（满级）' };
    var cost = GAME.enhCost(inst);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资材不足（需 ' + GAME.costString(cost) + '）' };
    GAME.payCost(cost);
    if (inst && typeof inst === 'object') inst.enh = lv + 1;   /* 按件 +1 */
    GAME.log('铁匠铺百炼：' + label0 + ' → +' + (lv + 1));
    return { ok: true, msg: '「' + GAME.eqLabel(inst) + '」强化 +' + (lv + 1)
      + '（装备属性 +' + Math.round((lv + 1) * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%）' };
  };

  /* --------- 君主改名（v77 · 君主面板） --------- */
  GAME.renameLord = function (name) {
    var s = GAME.state;
    name = String(name == null ? '' : name).trim();
    if (!name) return { ok: false, msg: '名字不能为空' };
    if (name.length > 8) return { ok: false, msg: '名字过长（8 字以内）' };
    s.ruler = s.ruler || {};
    s.ruler.name = name;
    var lg = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null;
    if (lg) lg.name = name;   // 君主本人也是将领（v70）：两处同源
    GAME.log('君主更名：' + name);
    return { ok: true, msg: '君主已更名为 ' + name };
  };

  /* --------- 解雇将领（装备全数归还；名将离去损声望） --------- */
  GAME.dismissGeneral = function (genId) {
    var s = GAME.state;
    if ((s.generals || []).length <= 1) return { ok: false, msg: '帐下至少须留一位将领' };
    var g = null, idx = -1;
    s.generals.forEach(function (x, i) { if (x.id === genId) { g = x; idx = i; } });
    if (!g) return { ok: false, msg: '将领不存在' };
    /* v70（老板）：「不可解雇」—— 君主本人（框架与守卫同源：GAME.isLordGeneral） */
    if (GAME.isLordGeneral(g)) return { ok: false, msg: '君主本人不可解雇' };
    if (g.status === 'march') return { ok: false, msg: g.name + ' 正在出征，不可解雇' };
    s.inventory = s.inventory || [];
    var back = 0;
    for (var slot in (g.equip || {})) { s.inventory.push(g.equip[slot]); back++; }
    s.generals.splice(idx, 1);
    var repCost = g.hero ? 50 : 0;
    if (repCost) s.rep = Math.max(0, (s.rep || 0) - repCost);
    s.hearts = U.clamp((s.hearts || 100) - 2, 0, 100);
    GAME.statBump('dismissed', 1);
    GAME.log('解雇 ' + g.name + '（归还装备 ' + back + ' 件' + (repCost ? '，声望 -' + repCost : '') + '）');
    if (GAME.story && g.hero) GAME.story.chronicleAdd(g.name + '去，不复为吾用。', 'note');
    return { ok: true, msg: '已解雇 ' + g.name + '，归还装备 ' + back + ' 件'
      + (repCost ? '（声望 -' + repCost + '）' : '') };
  };

  /* --------- 守将加成（城守对城池经营的作用） ---------
   * 报告 9.2：内政1点 = 产量+1%、建造速度+1%；勇武1点 = 征兵速度+0.5%；
   *           智谋1点 = 研究速度+0.5%、城防+0.5%
   *
   * v63（老板）：「守将属性**只对当前城池**起加成作用，不同城市有不同的守将」。
   * 改前是 `guardBonusTotal()` —— 把**全境所有守将**的加成累加起来，
   * 然后拿这个总数去算产量（`prodFactors`）、建造加速、征兵加速、研究加速。
   * 于是一个 B 城的守将也能给 A 城加成，甚至加成哪个城加起来都一样 ——
   * 这是最典型的"同一个数被当成全局用"。现在全部改成**读本城守将**：
   *   · 产量   → `GAME.prodFactors(r, city)` / `cityProdPerSec(city)`
   *   · 建造   → `GAME.guardBuildMult(city)`
   *   · 征兵   → `GAME.guardBonus(city).train`
   *   · 研究   → 研究由某城的书院发起，取**发起城**的守将（`S.research(id, cityId)`）
   * ------------------------------------------------------------ */
  /* 守将建造加速系数（内政 1 点 → 建造速度 +1%，最多加速 60%）——
     **按城取**：传哪座城就只吃哪座城的守将。 */
  GAME.guardBuildMult = function (city) {
    return GAME._rawGuardBuildMult(city) / (1 + techB('build'));   // 建筑技术：耗时 −5%/级
  };
  GAME._rawGuardBuildMult = function (city) {
    var gb = GAME.guardBonus(city);
    return 1 / (1 + Math.min(1.5, gb.build || 0));
  };

  GAME.guardGeneralOf = function (city) {
    var s = GAME.state;
    if (!s || !city) return null;
    for (var i = 0; i < s.generals.length; i++) {
      var g = s.generals[i];
      if (g.cityId === city.id && g.status === 'guard') return g;
    }
    return null;
  };

  GAME.guardBonus = function (city) {
    var g = GAME.guardGeneralOf(city);
    if (!g) return { name: null, prod: 0, build: 0, train: 0, research: 0, def: 0, faint: 1 };
    var a = GAME.genAttrs(g);
    /* 忠诚低于警戒线 → 该将勤勉不足，加成打折（让忠诚第一次真正影响数值） */
    var faint = (g.loyalty != null && g.loyalty < DATA.LOYALTY.warnAt) ? DATA.LOYALTY.faintMul : 1;
    return {
      name: g.name, gen: g, faint: faint, loyalty: g.loyalty,
      prod: a.nz * 0.01 * faint,       // 内政 1 点 → 产量 +1%
      build: a.nz * 0.01 * faint,      // 内政 1 点 → 建造速度 +1%
      train: a.yw * 0.005 * faint,     // 勇武 1 点 → 征兵速度 +0.5%
      research: a.zm * 0.005 * faint,  // 智谋 1 点 → 研究速度 +0.5%
      def: a.zm * 0.005 * faint,       // 智谋 1 点 → 城防 +0.5%
    };
  };

  /* 全部守将加成累加（多城多守将则叠加）
   * ⛔ v63 已删 —— 它是"守将加成被当成全局数"的源头。
   * 老板：「守将属性只对当前城池起加成作用」→ 需要加成的地方一律传城，
   * 走 `GAME.guardBonus(city)`（唯一出口）。留着这个函数就等于留了个后门，
   * 顺手改回全境口径只要一行 —— 所以按项目规矩**删掉**而不是留着不用。 */
  /* --------- 城防 --------- */
  /* 城防（守备力）—— **不含自建箭塔**的基础值。
     v62：拆出 Base 是为了断开"箭塔 ↔ 城防"的循环：
       箭塔座数由城防折出（v59），若城防又把箭塔算进去，就会互相喂。
       所以：`cityDefenseBase` = 城防的本体（城墙/驻防/专精/天时/守将），
       `cityDefense` = Base + 自建箭塔的贡献（给界面与"守军减伤"用），
       而**箭塔座数**只从 Base 折出来（见 GAME.towerCountOf）。 */
  GAME.cityDefenseBase = function (city) {
    var wallLvl = GAME.buildingLevel(city, 'chengqiang');
    var base = city.def + wallLvl * 20;
    /* v28（需求 1）：城墙满级专精 —— 城防 +25% */
    if (GAME.masteryOf(city, 'chengqiang')) base = Math.round(base * 1.25);
    if (GAME.story) base = Math.round(base * GAME.story.cityDefMult()); // 名将羁绊：守御
    var gbc = GAME.guardBonus(city);
    if (gbc.name) base = Math.round(base * (1 + Math.min(1.0, gbc.def))); // 守将智谋：城防
    return base;
  };
  GAME.cityDefense = function (city) {
    /* v62（老板：「工匠作坊可以造箭塔，箭塔默认参与防守」）：
       自建箭塔按 `homeDef` 计入守备力 —— 造好即生效、无需指派。
       这也是"造箭塔"立刻看得见的回报（守备力数字 + 守军减伤 defBonus）。 */
    return GAME.cityDefenseBase(city) + GAME.towersBuiltOf(city) * TW_T().homeDef;
  };

  /* ============================================================
   * 箭塔（v62 · 老板）—— 两个来源，**一个出口**
   * ------------------------------------------------------------
   *   来源① 城防折出（v59 照搬原版：每 2 点城防 = 1 座）
   *   来源② 工匠作坊建造（玩家自己造的，存 `city.towers`）
   * 战斗与界面一律读 `GAME.towerCountOf(city)` ——
   * 别处不要再自己 `wallTowerCount(cityDefense(...))`（那就是第二个出口）。
   * ============================================================ */
  function TW_T() { return DATA.WALL_TOWER; }
  GAME.towersBuiltOf = function (city) {
    return Math.max(0, Math.floor((city && city.towers) || 0));
  };
  /* 城防折出的座数（不含自建） */
  GAME.towersFromDef = function (city) {
    if (!city) return 0;
    var T = GAME.tactic;
    var base = GAME.cityDefenseBase(city);
    return T ? T.wallTowerCount(base) : 0;
  };
  /* **唯一出口**：本城箭塔总座数 */
  GAME.towerCountOf = function (city) {
    if (!city) return 0;
    return GAME.towersFromDef(city) + GAME.towersBuiltOf(city);
  };
  /* 工匠作坊能造多少座（上限 = 作坊等级 × buildMaxPerLv） */
  GAME.towerCapOf = function (city) {
    if (!city) return 0;
    var lv = GAME.buildingLevel(city, 'gongjiangzuofang');
    return lv * TW_T().buildMaxPerLv;
  };
  /* 还能再造几座 */
  GAME.towerRoomOf = function (city) {
    return Math.max(0, GAME.towerCapOf(city) - GAME.towersBuiltOf(city));
  };
  /* 造 n 座的总价（唯一出口；界面与扣费都读它） */
  GAME.towerCostOf = function (n) {
    var c = TW_T().buildCost, out = {};
    n = Math.max(0, Math.floor(n) || 0);
    for (var k in c) out[k] = c[k] * n;
    return out;
  };
  GAME.buildTowers = function (cityId, n) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    var lv = GAME.buildingLevel(city, 'gongjiangzuofang');
    if (lv <= 0) return { ok: false, msg: city.name + '尚无工匠作坊，无从制造' };
    n = Math.floor(Number(n) || 0);
    if (!(n > 0)) return { ok: false, msg: '数量必须大于 0' };
    var room = GAME.towerRoomOf(city);
    if (room <= 0) {
      return { ok: false, msg: '已达上限：作坊 Lv' + lv + ' 最多造 ' + GAME.towerCapOf(city) + ' 座箭塔' };
    }
    n = Math.min(n, room);
    /* 费用从**该城**库存扣（v60 起资源归属城池）——
       ⚠️ 不要用 `canAfford`/`payCost`：那两个绑的是**当前城**的库存，
       在 B 城的界面上造 A 城的箭塔就会扣错城。 */
    var R = GAME.res(city);
    var unit = TW_T().buildCost;
    /* 数量请求可被资源**自动下调**：`造满`这类按钮的语义是"尽可能多"，
       点了只回一句"资源不足"等于没反应。能造几座就造几座，并在消息里写明。 */
    var affordable = n;
    for (var uk in unit) {
      if (unit[uk] > 0) affordable = Math.min(affordable, Math.floor((R[uk] || 0) / unit[uk]));
    }
    if (affordable <= 0) {
      /* 用 GAME.resName 自己拼，不走 GAME.costString ——
         那个出口挂在 ui 层（`GAME.costString = ui.costString`），
         domain 依赖 ui 会让"只加载 domain 的探针/测试"直接崩。 */
      var needStr = Object.keys(unit).map(function (k2) {
        return GAME.resName(k2) + ' ' + U.fmt(unit[k2]);
      }).join('　');
      return { ok: false, msg: '资源不足：每座' + TW_T().name + '需 ' + needStr };
    }
    var asked = n;
    n = Math.min(n, affordable);
    city.towers = GAME.towersBuiltOf(city) + n;
    for (var k in GAME.towerCostOf(n)) R[k] = (R[k] || 0) - GAME.towerCostOf(n)[k];
    var msg = city.name + ' 新筑' + TW_T().name + ' ' + n + ' 座（共 ' + city.towers + ' / ' +
      GAME.towerCapOf(city) + '）· 守备力 ' + GAME.cityDefense(city) +
      (asked > n ? '　（资源所限，未按请求的 ' + asked + ' 座）' : '');
    GAME.log('🏹 ' + msg);
    return { ok: true, msg: msg, built: n, total: city.towers };
  };

  /* --------- v53：**一城一守将** ---------
     改前：同一座城可以连任多个守将，而 guardGeneralOf 只取**第一个**匹配 ——
     于是后来任命的那位既不生效、也不报错，加成始终挂在旧将身上。
     老板观察到的现象正是这个：任命了新守将，"相应加成链条数值"却没跟着新将领的属性走。
     现在：任命即替换（旧任自动解任），读档也做归一化，两条路都走下面这一个执行口。 */
  /* 解除某城的守将（keepId 那位除外），返回被解任者名字数组 */
  GAME.releaseGuardsOf = function (cityId, keepId) {
    var out = [];
    (((GAME.state || {}).generals) || []).forEach(function (x) {
      if (x.id === keepId) return;
      if (x.status === 'guard' && x.cityId === cityId) {
        x.status = 'idle'; x.cityId = null; out.push(x.name);
      }
    });
    return out;
  };
  /* 读档归一化：同一座城的多个守将只留**最先出现**的那位
     （= 改前 guardGeneralOf 取首个时实际生效的那位，读档不改变玩家现状），其余退回空闲。 */
  /* v64：把**没有归属城**的将领挂到首城。
     为什么要归一化：席位是"按城"算的（`generalsIn` 走 `genCityOf`），
     而 `genCityOf` 对 cityId 为空的人会**回落到当前城** ——
     那样这个人会随"我现在在看哪座城"飘来飘去，席位统计自然跟着飘。
     实名的来源只有两处：名将归降（`battle.grantHero` 现在会带出发城）
     与老存档（v64 之前降将的 cityId 是 null）。 */
  GAME.normalizeGenCities = function () {
    var s = GAME.state;
    if (!s || !s.generals || !s.cities || !s.cities.length) return 0;
    var ids = {};
    s.cities.forEach(function (c) { ids[c.id] = 1; });
    var home = s.cities[0].id, n = 0;
    s.generals.forEach(function (g) {
      if (!g.cityId || !ids[g.cityId]) { g.cityId = home; n++; }
    });
    return n;
  };

  GAME.normalizeGuards = function () {
    var s = GAME.state;
    if (!s || !s.generals) return [];
    var keep = {}, out = [];
    s.generals.forEach(function (g) {
      if (g.status !== 'guard' || !g.cityId) return;
      if (!keep[g.cityId]) keep[g.cityId] = g.id;
    });
    Object.keys(keep).forEach(function (cid) {
      out = out.concat(GAME.releaseGuardsOf(cid, keep[cid]));
    });
    return out;
  };

  /* ============================================================
   * 出征战术（v59 · 阵位与指挥指令的**唯一取值口**）
   * ------------------------------------------------------------
   * 每兵种两项：动作（前进/防御/后退）+ 目标（敌方兵种 id，或 `_tower` = 箭塔）。
   * · 攻方：读玩家在「校场 → 出征战术」里的设置；
   * · 守方（NPC 城池 / 野地）：恒用默认动作 —— 原版攻城战里守方常态是
   *   "城墙原地防御"，所以默认 `hold`。**不设"防守战术"入口**：
   *   本作守方没有可指挥的场合，做了就是没有消费点的死数据（本项目铁律）。
   * 非法值一律回落默认 —— 否则单位行位会变成 NaN，整场战斗静默跑坏。
   * ============================================================ */
  GAME.tacticOf = function (side, troopId, ctx) {
    var d = (DATA.STANCE_DEFAULT || {})[side] || 'advance';
    /* 守方默认按**场地**分：攻城（有城墙可依）→ 固守；野地/据点 → 迎击。
       见 DATA.STANCE_DEFAULT 的注释（野地守军原地不动会白挨打整个 30 回合）。 */
    if (side === 'def') {
      if (ctx && ctx.sieging) d = (DATA.STANCE_DEFAULT || {}).siege || 'hold';
      return { s: d, t: '' };
    }
    var m = (GAME.state.tactics || {})[troopId];
    var sid = null;
    (DATA.STANCES || []).forEach(function (x) { if (m && m.s === x.id) sid = x.id; });
    return { s: sid || d, t: (m && typeof m.t === 'string') ? m.t : '' };
  };
  GAME.setTactic = function (troopId, patch) {
    if (!DATA.TROOPS[troopId]) return { ok: false, msg: '兵种不存在' };
    patch = patch || {};
    var s = GAME.state;
    s.tactics = s.tactics || {};
    var cur = s.tactics[troopId] || {};
    if (patch.s !== undefined) {
      var ok = false;
      (DATA.STANCES || []).forEach(function (x) { if (x.id === patch.s) ok = true; });
      if (ok) cur.s = patch.s;
    }
    if (patch.t !== undefined) cur.t = String(patch.t || '');
    s.tactics[troopId] = cur;
    return { ok: true };
  };
  /* 当前出征战术的一句话摘要（出征弹窗用）—— 与"设了什么"一一对应，不是固定文案 */
  GAME.tacticSummary = function () {
    var m = GAME.state.tactics || {};
    var ids = Object.keys(m);
    if (!ids.length) return '全体前进（默认）';
    var n = {};
    ids.forEach(function (id) {
      var t = GAME.tacticOf('atk', id);
      n[t.s] = (n[t.s] || 0) + 1;
    });
    var parts = [];
    (DATA.STANCES || []).forEach(function (x) { if (n[x.id]) parts.push(n[x.id] + ' 种' + x.name); });
    return parts.join(' · ');
  };
  GAME.clearTactics = function () {
    GAME.state.tactics = {};
    return { ok: true, msg: '已恢复默认战术（全军前进）' };
  };

  /* --------- 将领 --------- */
  GAME.assignGeneral = function (genId, role, cityId) {
    var s = GAME.state, g = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === genId) g = s.generals[i];
    if (!g) return { ok: false, msg: '将领不存在' };
    var cityArg = cityId || (GAME.currentCity() || {}).id || null;
    if (role !== 'guard') {
      g.status = role; g.cityId = cityArg;
      return { ok: true, msg: '解除任命 ' + g.name };
    }
    /* 任命：同城旧任自动让位（守将也换城时走同一条 —— 一个人不能同时守两座城） */
    var out = GAME.releaseGuardsOf(cityArg, g.id);
    g.status = 'guard'; g.cityId = cityArg;
    var cn = (GAME.cityById(cityArg) || {}).name;
    return { ok: true, msg: '任命 ' + g.name + (cn ? ' 为「' + cn + '」' : ' 为') + '守将' +
      (out.length ? '　（已自动解除 ' + out.join('、') + '）' : '') };
  };

  /* 将领真实属性（含装备/丹药/符） */
  /* ============================================================
   * v52（老板给定）：将领属性 → 军队加成的换算链
   * ------------------------------------------------------------
   *   1 勇武 = 10 攻击值          1 智谋 = 10 防御值
   *   每 10 攻击值 = 全军攻击 +1%   每 10 防御值 = 全军防御 +1%
   * 老板还要求「将领属性对军队的加成**不直接增加**」——
   *   改前是 `1 + yw/100`（勇武一点直接一趴进乘区），
   *   改后走「属性 → 攻防值 → 百分比」这条链，**装备/套装的 atk/def 也并入同一条链**
   *   （老板：「装备的属性注意按逻辑加成到将领属性中」）。
   *
   * 一个必须写明的数学事实：勇武那一段与旧公式**数值等价**
   *   （yw×10 ÷10 ÷100 = yw/100）。真正变的是**装备攻防的口径**：
   *   旧代码把装备攻击按 `/10000` 并入（+650 → +6.5%），
   *   新链按 `/1000`（+650 → +65%），**强度 ×10**，且与勇武同一条链、可直接相加。
   * ============================================================ */
  GAME.ATK_PER_YW = 10;      /* 1 勇武 → 10 攻击值 */
  GAME.DEF_PER_ZM = 10;      /* 1 智谋 → 10 防御值 */
  GAME.PCT_PER_ATK = 10;     /* 每 10 攻击值 → 全军攻击 +1% */
  GAME.PCT_PER_DEF = 10;     /* 每 10 防御值 → 全军防御 +1% */

  /* 换算原子 —— **公式只有这一份**。
     ⚠️ 上一版写成 `GAME.genAtkVal(g)=genAttrs(g).atkVal` 这种"出口包装"，
     结果 audit 直接报「GAME.genDefVal 无任何引用」：包装层没有消费点，就是死代码。
     改成"原子公式 + genAttrs 内部调用"，既保住单一来源、又不留没人用的壳。 */
  GAME.atkValOf = function (yw, atkEq) { return (yw || 0) * GAME.ATK_PER_YW + (atkEq || 0); };
  GAME.defValOf = function (zm, defEq) { return (zm || 0) * GAME.DEF_PER_ZM + (defEq || 0); };
  GAME.pctOfVal = function (val, per) { return (val || 0) / (per || 1) / 100; };

  GAME.genAttrs = function (g) {
    var b = GAME.systems.genEquipBonus(g);
    /* v26（需求 2）：**丹药不再单独一列，也不再重复累加**。
       永久丹药在使用时已经写进 g[attr]（systems.useItem 里 `g5[attr] += 1`），
       所以 g[attr] 本身就是"已经嗑过药的基础值"；这里再加一次 perm 会变成双倍。
       perm 只留作「每将上限 50」的计数用，不参与属性求和。
       五维（统率/勇武/智谋/内政/速度）在这里一次性求和：基础 + 装备 + 战斗符。 */
    /* v65（老板）：「将领/装备属性数值应只为整数」——
       装备与套装里有 .5 的加成（打造品质、套装档位都是半数），
       原先一路带小数进界面（统2751.5 那种），既占宽度又不好读。
       **在这里一次性取整**（唯一出口），下游任何地方都不再各 round 一遍。 */
    var a = {
      tong: Math.round((g.tong || 0) + b.tong),
      nz: Math.round((g.nz || 0) + b.nz),
      yw: Math.round((g.yw || 0) + b.yw),
      zm: Math.round((g.zm || 0) + b.zm),
      /* 速度 = 出身脚力 + 等级成长 + 装备/套装/坐骑 + 自由点（全部相加，不做乘算）。
         等级成长直接**派生**而不写进 g.speed：这样老存档不用迁移也能立刻对上，
         也不会出现"升级时加一次、求和时又加一次"的双重计数。
         v74：自由点投放的 spdAdd 也走这条和（与装备同层，但来源清楚）。 */
      spd: Math.round((g.speed || 0) + Math.max(0, (g.level || 1) - 1) + b.spd + (g.spdAdd || 0)),
      /* 装备/套装的攻防（单独留一份：UI 的"装备贡献"与旧存档兼容都要它） */
      atkEq: Math.round(b.atk),
      defEq: Math.round(b.def),
      /* v29（需求 11）：**体力升为第六维**。
         v66：装备体力并入上限后，这里给出三个口径，**界面只读它们**：
           sta    = 当前体力（战斗取值，含装备贡献）
           staMax = 上限（等级/资质/内政 + 装备与套装的体力）
           staEq  = 装备贡献了多少体力（"装备提供"清单用）
         ⚠️ `a.hp`（生命值）在 v66 已删：那个字段原本就是装备体力折算出来的
            第二套说法，现在只走"装备体力 → 体力上限"一条链。 */
      sta: Math.round(GAME.staNow(g)),
      staMax: Math.round(GAME.staMax(g)),
      staEq: Math.round(b.sta || 0),
    };
    a.atk = Math.round((g.attack || 0) + b.atk);
    a.def = Math.round((g.defense || 0) + b.def);
    /* 符类 buff */
    var s = GAME.state;
    if (s.buffs && s.buffs.gens && s.buffs.gens[g.id]) {
      for (var bid in s.buffs.gens[g.id]) {
        var buf = s.buffs.gens[g.id][bid];
        if (buf.until > U.now()) {
          if (buf.tong_mult) a.tong = Math.round(a.tong * (1 + buf.tong_mult));
          if (buf.nz_mult) a.nz = Math.round(a.nz * (1 + buf.nz_mult));
          if (buf.yw_mult) a.yw = Math.round(a.yw * (1 + buf.yw_mult));
          if (buf.zm_mult) a.zm = Math.round(a.zm * (1 + buf.zm_mult));
          if (buf.spd) a.spd += buf.spd;
        }
      }
    }
    /* v77 · 内功（DATA.NEIGONG）：每重 +per 到对应维（与装备/丹药同层求和）。
       修习/精进走 systems.useItem → S._neigongUse；这里只管把加成算进去。 */
    if (g.ng && g.ng.id) {
      var ngD = null;
      (DATA.NEIGONG || []).forEach(function (x) { if (x.id === g.ng.id) ngD = x; });
      if (ngD && ngD.attr && a[ngD.attr] != null) a[ngD.attr] += (ngD.per || 0) * (g.ng.lv || 0);
    }

    /* ---------- v52 派生：攻防值 → 全军加成 ----------
       **必须在 buff 之后算**（武曲星符改的是 a.yw，派生要吃到它）。
       公式走上面那三个原子（唯一来源），一次算完、多处读
       （battle / UI 都读这几个字段），避免"每处各算一遍、某处漏了装备"。 */
    a.atkVal = GAME.atkValOf(a.yw, a.atk);                 /* 将领攻击值 */
    a.defVal = GAME.defValOf(a.zm, a.def);                 /* 将领防御值 */
    a.atkPct = GAME.pctOfVal(a.atkVal, GAME.PCT_PER_ATK);  /* 全军攻击加成（小数） */
    a.defPct = GAME.pctOfVal(a.defVal, GAME.PCT_PER_DEF);  /* 全军防御加成（小数） */
    return a;
  };

  /* 升级所需经验（唯一口径）：等级²×100。
     v26（需求 1）：原先 battle.js / ui.js 各写了一遍 `g.level*g.level*100`，
     一旦要改公式就得同时改三处 —— 收敛到这里，其余地方一律调用。 */
  GAME.expNeedOf = function (g) {
    var lv = Math.max(1, (g && g.level) || 1);
    var C = DATA.EXP_CURVE, s = C.softFrom;
    /* Lv ≤ 30：原版公式逐点不变（老存档进度不受影响） */
    if (lv <= s) return lv * lv * 100;
    /* Lv > 30：线性放缓。理由见 DATA.EXP_CURVE 注释 ——
       原公式到 Lv240 累计需 4.6 亿经验，比全服最大经验道具大 1500 倍，
       会让"天授上限 240"变成一句空话。 */
    return Math.round(s * s * 100 * (1 + (lv - s) * C.grow));
  };

  /* ---------- 等级上限 & 体力（v29 · 需求 2 / 11） ---------- */
  GAME.genLevelCap = function (g) {
    var rk = GAME.rankOf ? GAME.rankOf(g) : null;
    return (rk && rk.lvCap) || (DATA.GEN_RANKS[0] && DATA.GEN_RANKS[0].lvCap) || 60;
  };
  /* 经验道具能不能用（唯一出口）→ 返回 '' 表示可以用，否则返回给玩家看的原因。
     v66（老板）：「将领等级到上限后不能再使用经验道具」。
     改前 checkLevelUp 里是 `gen.level < capLv` 才升级 —— 到顶后经验照样堆、
     道具照样扣，属于"烧掉了没反应"。现在三处消费点（单个使用 / 批量使用 / 界面）
     一律先问这里。 */
  GAME.expBlockOf = function (g) {
    if (!g) return '请先选择将领';
    var cap = GAME.genLevelCap(g);
    if ((g.level || 1) < cap) return '';
    var rk = GAME.rankOf ? GAME.rankOf(g) : null;
    return g.name + ' 已达' + ((rk && rk.name) || '') + '上限 Lv' + cap
      + '，无法再使用经验道具（资质决定等级上限）';
  };
  GAME.expBlocked = function (g) { return !!GAME.expBlockOf(g); };
  /* 体力上限：基础 100 + 等级成长（资质成长点 × perLevel）× 内政修正。
     内政越高，同样的等级能养出更长的气力 —— 这是内政除产量/建造之外的第三个落点。 */
  /* ============================================================
   * 体力（v29 立第六维 · v52 补套装 · v66 补装备）
   * ------------------------------------------------------------
   * 口径（唯一出口，别再在别处拼这个式子）：
   *     体力上限 staMax = staBaseMax（等级/资质/内政）+ staEquipOf（装备与套装体力）
   *
   * v66（老板）：「部分将领的体力没有加上装备的数值」——
   *   根因是装备那一列（源数据表的「体力」，原字段名 hp）**走的是另一条路**：
   *   battle 里折算成"全军生命 +N%"（封顶 25%），而六维/状态里的"体力"是出征消耗池。
   *   于是同一个数在两处说话，穿散件当然"一点都不涨"。
   *   现在装备体力 1:1 并进上限，并把 battle 那条并行路径删掉（见 hpMultOf）。
   *
   *   `g.stamina` 存的是**等级那一份的余量**（不含装备）：
   *     装备体力是"常备额度"—— 换装即得、卸装即失，不因出征被消耗，
   *     也不会出现"刚穿上装备，体力条只剩 8%"这种假象。
   *     要改这个规则只动 staNow/setStaNow 两处。
   * ============================================================ */
  GAME.staBaseMax = function (g) {
    var S = DATA.STAMINA;
    if (!g) return S.base;
    var rk = GAME.rankOf ? GAME.rankOf(g) : null;
    var grow = (rk && rk.grow) || 1;
    var nz = g.nz || 0;
    /* v74：自由点投放的 staAdd 计入上限（与等级/资质/内政同层） */
    return S.base + Math.max(0, (g.level || 1) - 1) * grow * S.perLevel * (1 + nz / S.nzDiv)
      + (g.staAdd || 0);
  };
  /* 装备与套装贡献的体力（唯一出口：散件 sta + 套装件 sta + 套装档位 sta，
     三者已在 genEquipBonus 里合并成一个 b.sta） */
  GAME.staEquipOf = function (g) {
    if (!GAME.systems || !GAME.systems.genEquipBonus) return 0;
    return GAME.systems.genEquipBonus(g).sta || 0;
  };
  GAME.staMax = function (g) {
    return Math.round(GAME.staBaseMax(g) + GAME.staEquipOf(g));
  };
  GAME.staNow = function (g) {
    if (!g) return DATA.STAMINA.base;
    var mx = GAME.staMax(g), eq = GAME.staEquipOf(g), base = mx - eq;
    if (g.stamina == null) return mx;                     // 从未记过 = 满
    return Math.round(Math.min(mx, Math.max(0, Math.min(base, g.stamina)) + eq));
  };
  /* 体力当前值的**唯一写入口**（入参是"池子里的真实体力"，不是 g.stamina 的余量） */
  GAME.setStaNow = function (g, v) {
    var mx = GAME.staMax(g), eq = GAME.staEquipOf(g), base = mx - eq;
    var nv = Math.max(0, Math.min(mx, v));
    g.stamina = Math.max(0, Math.min(base, nv - eq));
    return GAME.staNow(g);
  };
  /* 体力 → 全军生命加成（双曲，渐近 +80%，永不硬顶出断崖）。
     拆成"按池子取值"的纯函数，界面要算"装备带来多少全军生命"时直接复用它，
     不必再让将领对象跑一遍。 */
  GAME.staHpPct = function (pool) {
    var S = DATA.STAMINA;
    var s = Math.max(0, pool || 0);
    return S.hpCap * s / (s + S.hpK);
  };
  GAME.staHpBonus = function (g) {
    return GAME.staHpPct(GAME.staNow(g));
  };

  /* --------- 任务进度（v12 指标驱动） --------- */
  /* ---------- 指标求值 ---------- */
  GAME.questMetric = function (metric, sub) {
    var s = GAME.state;
    if (!s) return 0;
    var sst = s.stats || {};
    var i, t, k;
    switch (metric) {
      case 'bldCount':
        t = 0; (s.cities || []).forEach(function (c) { t += GAME.numBuilding(c, sub); });
        return t;
      case 'bldLevel':
        t = 0; (s.cities || []).forEach(function (c) { t = Math.max(t, GAME.buildingLevel(c, sub) || 0); });
        return t;
      case 'bldTotal':
        t = 0; (s.cities || []).forEach(function (c) { t += c.cells.filter(function (x) { return x.build; }).length; });
        return t;
      case 'extCount':
        t = 0; (s.cities || []).forEach(function (c) {
          (c.extGrid || []).forEach(function (e) { if (e.type === sub) t += 1; });
        });
        return t;
      case 'extLevel':
        t = 0; (s.cities || []).forEach(function (c) {
          (c.extGrid || []).forEach(function (e) { if (e.type === sub) t = Math.max(t, e.lv); });
        });
        return t;
      case 'extTotal':
        t = 0; (s.cities || []).forEach(function (c) {
          (c.extGrid || []).forEach(function (e) { if (e.type && !e.pending) t += 1; });
        });
        return t;
      case 'techLevel': return (s.techs && s.techs[sub]) || 0;
      case 'techTotal':
        t = 0; for (k in (s.techs || {})) t += s.techs[k];
        return t;
      case 'troopCount':
        t = 0; (s.cities || []).forEach(function (c) { t += (c.army && c.army[sub]) || 0; });
        return t;
      case 'armyTotal':
        t = 0; (s.cities || []).forEach(function (c) { t += GAME.armyTotal(c); });
        return t;
      case 'genCount': return (s.generals || []).length;
      case 'heroCount': return (s.generals || []).filter(function (g) { return g.hero; }).length;
      case 'cityCount': return (s.cities || []).length;
      case 'rank': return s.rank || 0;
      case 'rep': return s.rep || 0;
      case 'hearts': return s.hearts || 0;
      case 'pop': return s.res.pop || 0;
      case 'popCap':
        t = 0; (s.cities || []).forEach(function (c) { t += GAME.maxPopOf(c); });
        return t;
      case 'res': return s.res[sub] || 0;
      case 'gold': return s.res.gold || 0;
      case 'itemOwn': return (s.items || {})[sub] || 0;
      case 'matTotal':
        t = 0; (DATA.MATERIAL_IDS || []).forEach(function (id) { t += (s.items || {})[id] || 0; });
        return t;
      case 'equipCount':
        t = 0; (s.generals || []).forEach(function (g) { t += Object.keys(g.equip || {}).length; });
        return t;
      case 'invCount': return (s.inventory || []).length;
      case 'forgeKinds': return (s.forged || []).length;
      case 'wildCount': return (s.wilds || []).length;
      case 'conquerCount': return sst.conquer || 0;
      case 'winCount': return sst.wins || 0;
      case 'buildDone': return sst.buildDone || 0;
      case 'techDone': return sst.techDone || 0;
      case 'trainTotal': return sst.trained || 0;
      case 'forgeTotal': return sst.forgedCount || 0;
      case 'recruitCount': return sst.recruited || 0;
      case 'tradeCount': return sst.trades || 0;
      default: return 0;
    }
  };

  /* ============================================================
   * 指标 → 人话（v25 · 需求 11）
   * ------------------------------------------------------------
   * 任务详情要把"需求"讲清楚，而 metric 是 `bldLevel + sub` 这种机器口径。
   * 这里做一张模板表：不是给玩家看代码，而是给一句能读懂的军令。
   * ============================================================ */
  GAME.QUEST_METRIC_NEED = {
    bldCount: '城内「{x}」达到 {g} 座', bldLevel: '「{x}」达到 {g} 级', bldTotal: '城内建筑共达 {g} 座',
    extCount: '城外「{x}」达到 {g} 块', extLevel: '城外「{x}」达到 {g} 级', extTotal: '城外已开发 {g} 块',
    techLevel: '科技「{x}」达到 {g} 级', techTotal: '科技总等级达 {g} 级',
    troopCount: '「{x}」达到 {g} 名', armyTotal: '总兵力达到 {g}',
    genCount: '麾下将领达 {g} 人', heroCount: '麾下名将达 {g} 人', cityCount: '据有城池 {g} 座',
    rank: '爵位达到「{r}」', rep: '声望达到 {g}', hearts: '民心达到 {g}', pop: '人口达到 {g}',
    popCap: '人口上限达到 {g}', res: '{x} 存量达到 {g}', gold: '黄金达到 {g}',
    itemOwn: '持有「{x}」×{g}', matTotal: '打造材料共 {g} 件', equipCount: '已穿戴装备 {g} 件',
    invCount: '背包装备达 {g} 件', forgeKinds: '打造出 {g} 种装备', wildCount: '占领野地 {g} 块',
    conquerCount: '累计攻占 {g} 座城池', winCount: '累计获胜 {g} 场', buildDone: '累计建造/升级 {g} 次',
    techDone: '累计完成 {g} 项科技', trainTotal: '累计募兵 {g} 名', forgeTotal: '累计打造 {g} 件',
    recruitCount: '累计招募将领 {g} 人', tradeCount: '累计市易 {g} 次',
  };
  /* sub 的中文名（建筑/城外/兵种/科技/资源/材料/宝物 通查一遍） */
  GAME.subName = function (id) {
    if (!id) return '';
    var hit = null;
    function find(arr, key) {
      (arr || []).forEach(function (x) { var v = x[key]; if (v === id) hit = x.name; });
    }
    if (DATA.BUILDINGS[id]) return DATA.BUILDINGS[id].name;
    if (DATA.EXT_BUILDINGS[id]) return DATA.EXT_BUILDINGS[id].name;
    if (DATA.TROOPS[id]) return DATA.TROOPS[id].name;
    if (DATA.MATERIAL_BY_ID[id]) return DATA.MATERIAL_BY_ID[id].name;
    find(DATA.TECH, 'id'); if (hit) return hit;
    find(DATA.RESOURCES, 'key'); if (hit) return hit;
    find(DATA.ITEMS, 'id'); if (hit) return hit;
    return id;
  };
  /* 需求文案：一句"要什么"，外加当前进度 */
  GAME.questNeedText = function (def) {
    if (!def) return '';
    var tpl = GAME.QUEST_METRIC_NEED[def.metric];
    var g = GAME.questGoal(def);
    if (!tpl) return (DATA.QUEST_METRIC_DESC[def.metric] || def.metric) + ' 达到 ' + g;
    return tpl.split('{x}').join(GAME.subName(def.sub))
      .split('{g}').join(String(g))
      .split('{r}').join((DATA.RANK[g] || {}).name || String(g));
  };

  /* ---------- 成长型任务 ---------- */
  GAME.questAmount = function (q) { return GAME.questMetric(q.metric, q.sub); };
  GAME.questGoal = function (q) { return q.goal || 1; };
  GAME.questReady = function (q) {
    return !GAME.state.quests.done[q.id] && GAME.questAmount(q) >= GAME.questGoal(q);
  };
  GAME.questDone = function (q) { return !!GAME.state.quests.done[q.id]; };

  GAME.claimQuest = function (qid) {
    var s = GAME.state, q = null;
    (DATA.QUESTS || []).forEach(function (x) { if (x.id === qid) q = x; });
    if (!q) return { ok: false, msg: '未知任务' };
    if (s.quests.done[qid]) return { ok: false, msg: '任务已领取' };
    if (GAME.questAmount(q) < GAME.questGoal(q)) return { ok: false, msg: '任务尚未完成' };
    s.quests.done[qid] = true;
    GAME.grantReward(q.reward);
    s.quests.log = s.quests.log || [];
    s.quests.log.unshift({ id: q.id, title: q.title, kind: 'growth', t: U.now() });
    GAME.log('完成任务：' + q.title);
    return { ok: true, msg: '获得奖励！' };
  };

  GAME.grantReward = function (reward) {
    var s = GAME.state;
    if (!reward) return;
    for (var k in reward) {
      if (k === 'rep') { s.rep = (s.rep || 0) + reward[k]; continue; }
      if (DATA.MATERIAL_BY_ID && DATA.MATERIAL_BY_ID[k]) {
        s.items = s.items || {};
        s.items[k] = (s.items[k] || 0) + reward[k];
        continue;
      }
      if (!DATA.RESOURCES.some(function (r) { return r.key === k; })) {
        /* 其余视为宝物 id */
        s.items = s.items || {};
        s.items[k] = (s.items[k] || 0) + reward[k];
        continue;
      }
      s.res[k] = (s.res[k] || 0) + reward[k];
    }
  };


  /* ---------- 随机型任务 ---------- */
  var RQ_BY_ID = {};
  (DATA.RANDOM_QUESTS || []).forEach(function (q) { RQ_BY_ID[q.id] = q; });
  GAME.randomQuestDef = function (id) { return RQ_BY_ID[id] || null; };

  GAME.questDayIndex = function () { return Math.floor(Date.now() / 86400000); };

  /* 随机任务进度：abs 类读绝对值，其余读「自接取以来的增量」 */
  GAME.randQuestAmount = function (entry) {
    var def = RQ_BY_ID[entry.id];
    if (!def) return 0;
    var v = GAME.questMetric(def.metric, def.sub);
    if (def.abs) return v;
    return Math.max(0, v - (entry.base || 0));
  };
  GAME.randQuestReady = function (entry) {
    var def = RQ_BY_ID[entry.id];
    return !!def && GAME.randQuestAmount(entry) >= def.goal;
  };

  /* 抽一批随机任务：同批内类型互不相同 */
  function rollBatch(count, pool) {
    var usedType = {}, usedId = {};
    pool.forEach(function (e) {
      var d = RQ_BY_ID[e.id];
      if (d) usedType[d.type] = true;
      usedId[e.id] = true;
    });
    var out = [];
    for (var i = 0; i < count; i++) {
      var cands = DATA.RANDOM_QUESTS.filter(function (q) {
        return !usedType[q.type] && !usedId[q.id];
      });
      if (!cands.length) {
        cands = DATA.RANDOM_QUESTS.filter(function (q) { return !usedId[q.id]; });
      }
      if (!cands.length) break;
      var q = cands[Math.floor(Math.random() * cands.length)];
      usedType[q.type] = true; usedId[q.id] = true;
      out.push(q);
    }
    return out;
  }

  function makeEntry(def) {
    return {
      id: def.id,
      day: GAME.questDayIndex(),
      base: GAME.questMetric(def.metric, def.sub),
      at: U.now(),
    };
  }

  /* 每日刷新（tick 内调用，幂等） */
  GAME.ensureDailyQuests = function (force) {
    var s = GAME.state;
    if (!s || !DATA.RANDOM_QUESTS) return 0;
    s.quests.pool = s.quests.pool || [];
    var today = GAME.questDayIndex();
    if (!force && s.quests.poolDay === today) return 0;
    var last = s.quests.poolDay == null ? today : s.quests.poolDay;
    var daily = DATA.QUEST_DAILY;
    /* 清理过保留期的陈年项 */
    s.quests.pool = s.quests.pool.filter(function (e) {
      return today - (e.day == null ? today : e.day) < (daily.keepDays || 7);
    });
    /* 同时在手上限（默认 5）：满则不再新增，未完成的不会被顶掉 */
    var cap = daily.maxActive || daily.perDay || 5;
    var days = Math.max(1, today - last);
    var budget = (daily.perDay || 5) * days;
    var room = Math.max(0, cap - s.quests.pool.length);
    var want = Math.min(budget, room);
    var batch = rollBatch(want, s.quests.pool);
    batch.forEach(function (d2) { s.quests.pool.push(makeEntry(d2)); });
    s.quests.poolDay = today;
    if (batch.length) GAME.log('📜 新增随机任务 ' + batch.length + ' 项（每日 5 项，同时在手上限 ' + cap + '）');
    return batch.length;
  };

  /* 换新：单条 3000 金；全部换新按条数计价（避免靠点击无限刷任务） */
  GAME.randQuestRerollCost = function () { return 3000; };
  GAME.randQuestRerollAllCost = function () {
    var s = GAME.state;
    return (s.quests.pool || []).length * GAME.randQuestRerollCost();
  };
  GAME.rerollAllRandomQuests = function () {
    var s = GAME.state;
    var pool = s.quests.pool || [];
    if (!pool.length) return { ok: false, msg: '当前没有随机任务' };
    var cost = GAME.randQuestRerollAllCost();
    if ((s.res.gold || 0) < cost) return { ok: false, msg: '黄金不足（需 ' + U.fmt(cost) + '）' };
    s.res.gold -= cost;
    var batch = rollBatch(pool.length, []);
    s.quests.pool = batch.map(function (d) { return makeEntry(d); });
    return { ok: true, msg: '已换新 ' + batch.length + ' 项随机任务（-' + U.fmt(cost) + '金）' };
  };
  GAME.rerollRandomQuest = function (entryId) {
    var s = GAME.state;
    var idx = -1;
    (s.quests.pool || []).forEach(function (e, i) { if (e.id === entryId) idx = i; });
    if (idx < 0) return { ok: false, msg: '任务不存在' };
    var cost = GAME.randQuestRerollCost();
    if ((s.res.gold || 0) < cost) return { ok: false, msg: '黄金不足（需 ' + U.fmt(cost) + '）' };
    s.res.gold -= cost;
    var batch = rollBatch(1, s.quests.pool);
    if (!batch.length) return { ok: false, msg: '暂无可换任务' };
    s.quests.pool[idx] = makeEntry(batch[0]);
    return { ok: true, msg: '已换新任务：' + batch[0].title + '（-' + U.fmt(cost) + '金）' };
  };

  GAME.claimRandomQuest = function (entryId) {
    var s = GAME.state;
    var idx = -1;
    (s.quests.pool || []).forEach(function (e, i) { if (e.id === entryId) idx = i; });
    if (idx < 0) return { ok: false, msg: '任务不存在或已过期' };
    var entry = s.quests.pool[idx], def = RQ_BY_ID[entry.id];
    if (!def) return { ok: false, msg: '未知任务' };
    if (!GAME.randQuestReady(entry)) return { ok: false, msg: '任务尚未完成' };
    s.quests.pool.splice(idx, 1);
    GAME.grantReward(def.reward);
    s.quests.log = s.quests.log || [];
    s.quests.log.unshift({ id: def.id, title: def.title, kind: 'random', t: U.now() });
    if (s.quests.log.length > 200) s.quests.log.length = 200;
    GAME.log('完成随机任务：' + def.title);
    return { ok: true, msg: '随机任务完成：' + def.title };
  };

  /* 兼容旧接口 */
  GAME.advanceQuestTrain = function (troopId, count) {
    var s = GAME.state;
    s.quests.stash = s.quests.stash || {};
    s.quests.stash[troopId] = (s.quests.stash[troopId] || 0) + count;
  };

  /* 供旧接口调用（攻打城池计数） */
  GAME.advanceConquer = function () {
    var s = GAME.state;
    s.quests.conquerCount = (s.quests.conquerCount || 0) + 1;
    GAME.statBump('conquer', 1);
  };
  GAME.checkProgressQuests = function () { };

  /* ---------- 汇总（UI / 侧栏红点） ---------- */
  GAME.questSummary = function () {
    var s = GAME.state;
    var growthReady = (DATA.QUESTS || []).filter(function (q) { return GAME.questReady(q); }).length;
    var growthUndone = (DATA.QUESTS || []).filter(function (q) { return !GAME.questDone(q); }).length;
    var randReady = (s.quests.pool || []).filter(function (e) { return GAME.randQuestReady(e); }).length;
    return {
      growthReady: growthReady, growthUndone: growthUndone,
      randReady: randReady, randTotal: (s.quests.pool || []).length,
      ready: growthReady + randReady,
    };
  };


  /* --------- 建造进度查询（供格子/弹窗实时刷新） --------- */
  /* kind: 'city'|'ext'，idx: 格子/地块索引；返回 {pct, left, label} 或 null */
  GAME.buildProgress = function (kind, idx, cityId) {
    var s = GAME.state;
    if (!s) return null;
    var cur = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    for (var i = 0; i < s.queues.build.length; i++) {
      var q = s.queues.build[i];
      /* v14：外城地块按城池独立，同一下标会在多城间重复，须同时匹配 cityId；
         v16：城墙（wall）无下标，按类型 + 城池匹配 */
      var sameCity = !cur || !q.cityId || q.cityId === cur.id;
      var hit = kind === 'wall'
        ? (q.type === 'wall' && sameCity)
        : kind === 'city'
          ? (q.gridIndex === idx && (q.type === 'build' || q.type === 'upgrade') && sameCity)
          : (q.extIdx === idx && (q.type === 'ext_build' || q.type === 'ext_upgrade') && sameCity);
      if (hit) {
        var pct = Math.min(100, Math.floor(q.elapsed / q.totalTime * 100));
        var left = Math.max(0, (q.totalTime - q.elapsed) / GAME.timeScale());
        return { pct: pct, left: left, label: pct + '% · ' + U.durExact(left) };
      }
    }
    return null;
  };
  /* 兼容旧接口：返回展示文本 "X% · MM:SS" */
  GAME.buildPct = function (kind, idx, cityId) {
    var p = GAME.buildProgress(kind, idx, cityId);
    return p ? p.label : '';
  };

  /* ============================================================
   * 城池间调拨（v60 · 需求 4）
   * ------------------------------------------------------------
   * 老板：「城池之间，资源需要运输，将领需要派遣，为自己占据的城池提供相关功能按钮」。
   * 资源既然归属城池（见 GAME.res 的注释），就必须给出**搬运**的手段 ——
   * 否则多城经营会变成"每座城各自为政、资源互不相通"的死局。
   *
   *   · 运输：即时结算（不做车队动画），按**距离**抽损耗 ——
   *     让"就近布局"有意义，也让"把后方的粮运到前线"有代价。
   *     损耗可被【市场】等级削减（城池经营对运输的回报）。
   *     目的地仓容不足时**原路带回**（不做静默丢弃）。
   *   · 派遣：一人一城，改 `g.cityId` 即可。守将必须先解任 ——
   *     否则会出现"人已被派走、守将加成还挂在原城"的静默失效（本项目老毛病）。
   * ============================================================ */
  /* 可运输的资源：人口不在其列（人口随城池自然增长，不靠搬运） */
  GAME.TRANSPORT_KEYS = ['grain', 'wood', 'stone', 'iron', 'gold'];
  /* 资源名（唯一出口；数据源是 DATA.RESOURCES）—— 战报/日志/运输面板都读它，
     不要在各处自己维护一张中文名表。 */
  GAME.resName = function (key) {
    var n = key;
    (DATA.RESOURCES || []).forEach(function (r) { if (r.key === key) n = r.name; });
    return n;
  };
  /* 城距：切比雪夫距离（与地图行军的口径一致 —— 菱形网格两轴各走 N 格） */
  GAME.cityDist = function (a, b) {
    if (!a || !b) return 0;
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  };
  /* 从 from 运往 to 的损耗率（0~1）。唯一出口，界面与结算都读它。 */
  GAME.transportLossOf = function (from, to) {
    var T = DATA.TRANSPORT || {};
    if (!from || !to) return 0;
    var d = GAME.cityDist(from, to);
    var raw = Math.min(T.lossMax || 0.30, d * (T.lossPerTile || 0.004));
    var cut = Math.min(T.marketCutMax || 0.45,
      (GAME.buildingLevel(from, 'shichang') || 0) * (T.marketCutPerLv || 0.015));
    return raw * (1 - cut);
  };
  GAME.doTransport = function (fromId, toId, key, qty) {
    var s = GAME.state;
    if (!s) return { ok: false, msg: '尚未开局' };
    var from = GAME.cityById(fromId), to = GAME.cityById(toId);
    if (!from || !to) return { ok: false, msg: '城池不存在' };
    if (from.id === to.id) return { ok: false, msg: '不能运往本城' };
    if (GAME.TRANSPORT_KEYS.indexOf(key) < 0) return { ok: false, msg: '该物资不可运输' };
    var nm = GAME.resName ? GAME.resName(key) : key;
    qty = Math.floor(Number(qty) || 0);
    if (!(qty > 0)) return { ok: false, msg: '数量必须大于 0' };
    var R = GAME.res(from);
    var have = Math.floor(R[key] || 0);
    if (have <= 0) return { ok: false, msg: from.name + '没有' + nm + '可运' };
    qty = Math.min(qty, have);
    var loss = GAME.transportLossOf(from, to);
    var R2 = GAME.res(to);
    /* 目的地仓容：装不下的部分**原地不动** —— 既不抽损耗、也不静默丢弃。
       做法是先反推"最多能起运多少"（由目的地剩余仓容与损耗率共同决定），
       再把"没起运的那部分"留在出发城（改前是"先起运再带回"，
       结果装不下时损耗照抽 —— 东西没运走却凭空少了，说不通）。 */
    var room = Infinity;
    if (key !== 'gold') {
      var cap = GAME.storeCapOf(to);
      if (cap > 0) room = Math.max(0, cap - Math.floor(R2[key] || 0));
    }
    var ship = qty;
    if (room !== Infinity) {
      ship = Math.min(qty, Math.ceil(room / Math.max(1e-9, 1 - loss)));
      /* 浮点与取整的边界：实收不许超过剩余仓容 */
      while (ship > 0 && Math.floor(ship * (1 - loss)) > room) ship--;
      if (ship < 0) ship = 0;
    }
    var landed = Math.floor(ship * (1 - loss));
    var kept = qty - ship;                       // 装不下，留在出发城（未起运）
    R[key] = (R[key] || 0) - ship;
    R2[key] = (R2[key] || 0) + landed;
    var msg = '运输 ' + nm + '：' + U.fmt(ship) + ' → ' + to.name
      + '（实收 ' + U.fmt(landed) + '，途中损耗 ' + U.fmt(ship - landed) + '）'
      + (kept > 0 ? '；' + to.name + '仓容不足，' + U.fmt(kept) + ' 未能起运' : '');
    GAME.log('🚚 ' + msg);
    return { ok: true, msg: msg, landed: landed, loss: ship - landed, returned: kept, shipped: ship };
  };
  /* 可派遣的将领：本城、且不在出征/采集途中 */
  GAME.dispatchableGensOf = function (city) {
    var s = GAME.state;
    city = city || GAME.currentCity();
    if (!s || !city) return [];
    return (s.generals || []).filter(function (g) {
      var gc = GAME.genCityOf(g);
      return gc && gc.id === city.id && g.status !== 'march' && g.status !== 'gather';
    });
  };
  /* 将领所在城（v60 · 需求 4）：**唯一出口**。
     `g.cityId` 为空时（历史存档 / 刚被解任 / 测试构造）归到**当前城** ——
     不兜底的话，这些将领会从将领页的"本城"名单里凭空消失，
     玩家会以为人丢了（这是"归属城池"改造最容易踩的坑）。 */
  GAME.genCityOf = function (g) {
    var s = GAME.state;
    if (!g) return null;
    var c = g.cityId ? GAME.cityById(g.cityId) : null;
    if (c) return c;
    return GAME.currentCity() || (s && s.cities && s.cities[0]) || null;
  };
  GAME.doDispatch = function (genId, toCityId) {
    var s = GAME.state;
    if (!s) return { ok: false, msg: '尚未开局' };
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var to = GAME.cityById(toCityId);
    if (!to) return { ok: false, msg: '目标城池不存在' };
    if (g.cityId === to.id) return { ok: false, msg: g.name + ' 已在' + to.name };
    if (g.status === 'guard') {
      var fc = GAME.cityById(g.cityId);
      return { ok: false, msg: '需先解除 ' + g.name + ' 在' + (fc ? fc.name : '原城') + '的守将职务' };
    }
    if (g.status === 'march') return { ok: false, msg: g.name + ' 正在出征途中' };
    if (g.status === 'gather') return { ok: false, msg: g.name + ' 正在采集，暂不可派遣' };
    /* v64（老板）：「也可其他自己的城池派遣」——但目标城得有位置：
       将领是**归属城市**的，席位就是该城招贤馆的房间数。
       不拦的话人到了 B 城却住不下，B 城的名册会静默超编。 */
    var slotsT = GAME.genSlotsOf(to), usedT = GAME.generalsIn(to).length;
    if (usedT >= slotsT) {
      return { ok: false, msg: slotsT <= 0
        ? (to.name + ' 尚无招贤馆（0 席）—— 先在该城建造招贤馆才能安置将领')
        : (to.name + ' 招贤馆无空位（' + usedT + '/' + slotsT + '），请先升级该城招贤馆') };
    }
    var fromC = GAME.cityById(g.cityId);
    g.cityId = to.id;
    var msg = g.name + ' 自' + (fromC ? fromC.name : '外') + '调往' + to.name;
    GAME.log('🎖 ' + msg);
    return { ok: true, msg: msg };
  };

  /* ============================================================
   * 名城专属选项（v60 · 需求 5）
   * ------------------------------------------------------------
   * 老板：「设计一些名城专有的资源、优势，或者选项」——这一层是**选项**：
   * 只有名城（县城及以上）才有的额外操作，与"档位优势"（CITY_PERK，被动加成）
   * 和"州特产岁贡"（专有资源）互补。
   *
   * 冷却按**游戏日**（与每日产出同一把尺子），代价从**本城**库存扣 ——
   * 资源归属城池以后，"在 B 城征调却扣 A 城的粮"是不允许出现的。
   * 数据源 DATA.CITY_OPTS：加一条新选项 = 加一行数据（不动业务代码）。
   * ============================================================ */
  GAME.cityOptsOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return [];
    return (DATA.CITY_OPTS || []).filter(function (o) {
      return (o.minType || []).indexOf(city.type) >= 0;
    });
  };
  /* 距可用的剩余天数（0 = 现在就能用） */
  GAME.cityOptCdLeft = function (city, opt) {
    if (!city || !opt) return 0;
    var day = GAME.questDayIndex();
    var last = (city.optDay || {})[opt.id];
    if (last == null) return 0;
    return Math.max(0, (opt.cdDays || 1) - (day - last));
  };
  GAME.doCityOpt = function (cityId, optId) {
    var s = GAME.state;
    var city = GAME.cityById(cityId) || GAME.currentCity();
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    var opt = null;
    (DATA.CITY_OPTS || []).forEach(function (o) { if (o.id === optId) opt = o; });
    if (!opt) return { ok: false, msg: '没有这项操作' };
    if ((opt.minType || []).indexOf(city.type) < 0) return { ok: false, msg: city.name + '不可' + opt.name };
    var cdLeft = GAME.cityOptCdLeft(city, opt);
    if (cdLeft > 0) return { ok: false, msg: opt.name + ' 尚需 ' + cdLeft + ' 日方可再用' };
    var R = GAME.res(city), k;
    for (k in (opt.cost || {})) {
      if ((R[k] || 0) < opt.cost[k]) {
        return { ok: false, msg: GAME.resName(k) + '不足（需 ' + U.fmt(opt.cost[k]) + '）' };
      }
    }
    for (k in (opt.cost || {})) R[k] = (R[k] || 0) - opt.cost[k];
    var lv = GAME.buildingLevel(city, 'guanfu') || city.level || 1;
    var gain = '';
    if (optId === 'levy') {
      /* 征调：按官府等级复利给一笔物资（与 NPC 城库存同一套"等级 → 量"的口径） */
      var amt = Math.round(3000 * Math.pow(1.5, lv - 1) * (1 + GAME.perkNum(city, 'prodPct')));
      ['grain', 'wood', 'stone', 'iron'].forEach(function (kk) { R[kk] = (R[kk] || 0) + amt; });
      gain = '粮木石铁各 +' + U.fmt(amt);
    } else if (optId === 'fest') {
      s.hearts = Math.min(100, (s.hearts || 0) + 8);
      var g = GAME.guardGeneralOf ? GAME.guardGeneralOf(city) : null;
      if (g) g.loyalty = Math.min(100, (g.loyalty == null ? 70 : g.loyalty) + 5);
      gain = '民心 +8' + (g ? '，守将 ' + g.name + ' 忠诚 +5' : '');
    } else if (optId === 'summon') {
      city.def = (city.def || 0) + 3;
      gain = '城防 +3（现 ' + GAME.cityDefense(city) + '）';
    } else {
      gain = '已执行';
    }
    city.optDay = city.optDay || {};
    city.optDay[optId] = GAME.questDayIndex();
    var msg = opt.name + '（' + city.name + '）：' + gain;
    GAME.log('🏛 ' + msg);
    return { ok: true, msg: msg };
  };
  /* 训练进度（城） */
  /* 科技进度 */

  /* ============================================================
   * 种田秘境（v73 · 老板需求 3）：个人田庄 —— 种灵植，收高阶材料与资质灵草
   * ------------------------------------------------------------
   * 链条：种子（采集 / 征战所得，v78 起不花黄金）→ 灵田播种 → 游戏时间生长 → 收获
   *      ├─ 材料作物 → 3 阶主产（有机率出 4 阶）→ 铁匠铺高阶打造
   *      └─ 灵草作物 → 蕴灵草 / 洗髓芝 / 化龙参 / 天授果 → 资质逐档提升
   * 数据全在 DATA.FARM（加作物 = 加一行）；生长吃**游戏时间**：
   * 与建造 / 研究同一把尺 —— 在线主循环与离线补算各推一次（tickFarm），
   * 调时间倍率、挂机离线都有效，不需要另起一套计时。
   * 存档：s.farm 懒初始化（旧档缺失即补），不动 SAVE_VERSION。
   * ============================================================ */
  GAME.farmOf = function () {
    var s = GAME.state;
    if (!s.farm) s.farm = { plots: [] };
    var n = (DATA.FARM && DATA.FARM.plots) || 6;
    while (s.farm.plots.length < n) s.farm.plots.push(null);
    return s.farm;
  };
  GAME.farmCrop = function (id) { return (DATA.FARM_CROP_BY_ID || {})[id] || null; };
  /* 单块地状态：empty / growing / ripe（left = 剩余游戏秒） */
  GAME.farmPlotState = function (idx) {
    var f = GAME.farmOf(), p = f.plots[idx];
    if (!p) return { state: 'empty' };
    var total = p.totalTime || 0;
    var left = Math.max(0, total - (p.elapsed || 0));
    return {
      state: left <= 0 ? 'ripe' : 'growing',
      crop: GAME.farmCrop(p.crop), left: left,
      pct: total ? Math.min(100, Math.floor((p.elapsed || 0) / total * 100)) : 100,
    };
  };
  /* 播种 = 用**种子**落地（v78 · 老板需求 1：「种子只有通过将领其他活动获得，
     而不是花金币」）。种子从采集归来 / 出征缴获里掷（GAME.grantSeedDrop），
     不设黄金购买口；播种消耗 ×1。 */
  GAME.farmPlant = function (idx, cropId) {
    var f = GAME.farmOf();
    var c = GAME.farmCrop(cropId);
    if (!c) return { ok: false, msg: '未知作物' };
    if (idx < 0 || idx >= f.plots.length) return { ok: false, msg: '地块不存在' };
    if (f.plots[idx]) return { ok: false, msg: '这块地还占着' };
    var s = GAME.state, items = s.items = s.items || {};
    var seedId = c.seedItem;
    var seedName = farmItemName(seedId);
    if (!seedId || (items[seedId] || 0) < 1) {
      return { ok: false, msg: '缺「' + seedName + '」—— 种子从采集与征战中获得' };
    }
    items[seedId] -= 1;
    if (items[seedId] <= 0) delete items[seedId];
    f.plots[idx] = { crop: cropId, elapsed: 0, totalTime: Math.round(c.hours * 3600) };
    GAME.log('🌱 秘境播种：' + c.name + '（用 ' + seedName + '×1）');
    return { ok: true, msg: '播下 ' + c.name + '（' + seedName + ' -1）' };
  };
  /* 生长推进（在线主循环 / 离线补算共用；secGame = 游戏秒） */
  GAME.tickFarm = function (secGame) {
    var s = GAME.state;
    if (!s || !s.farm || !s.farm.plots) return;
    s.farm.plots.forEach(function (p) {
      if (p && p.elapsed < p.totalTime) p.elapsed = Math.min(p.totalTime, p.elapsed + secGame);
    });
  };
  /* v78（老板需求 1）：种子掉落 —— **唯一出口**（采集归来 / 出征获胜各调一次）。
     sourceLv：野地 1~10 级；城池走 DATA.SEED_DROP.cityLv 折算（县城 3 … 都城 9）。
     mult：战事 ×battleMult；采集 1。返回掉落文案数组，同时写进 s.items。 */
  GAME.grantSeedDrop = function (sourceLv, mult, label) {
    var tbl = DATA.SEED_DROP;
    var s = GAME.state;
    if (!tbl || !s || !tbl.table) return [];
    s.items = s.items || {};
    var lv = Math.max(1, Math.min(10, Math.round(sourceLv || 1)));
    var m = (mult == null ? 1 : mult);
    var got = [];
    tbl.table.forEach(function (row) {
      if (lv < row.minLv) return;
      if (Math.random() >= (row.base + row.perLv * lv) * m) return;
      var n = U.randInt(Math.random, row.qty[0], row.qty[1]);
      if (n <= 0) return;
      s.items[row.id] = (s.items[row.id] || 0) + n;
      got.push(row.name + '×' + n);
    });
    if (got.length && label) GAME.log(label + '：' + got.join('、'));
    return got;
  };
  /* 材料 / 道具名（材料在 MATERIAL_BY_ID、灵草在 ITEMS，两表各查一次） */
  function farmItemName(id) {
    var m = DATA.MATERIAL_BY_ID[id];
    if (m) return m.name;
    var nm = id;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) nm = x.name; });
    return nm;
  }
  /* 收获：成熟才给 —— 材料作物 = 3 阶主产 ×区间 + 4 阶副产（几率）；灵草作物 = 1 株 */
  GAME.farmHarvest = function (idx) {
    var s = GAME.state, f = GAME.farmOf();
    var st = GAME.farmPlotState(idx);
    if (st.state === 'empty') return { ok: false, msg: '这块地空着' };
    if (st.state !== 'ripe') {
      return { ok: false, msg: st.crop.name + ' 还差 ' + U.durExact(st.left / GAME.timeScale()) + ' 成熟' };
    }
    var c = st.crop, items = s.items = s.items || {};
    var got = [];
    if (c.herb) {
      items[c.herb] = (items[c.herb] || 0) + 1;
      got.push(farmItemName(c.herb) + ' ×1');
    } else {
      var q = U.randInt(Math.random, c.qty[0], c.qty[1]);
      items[c.mat] = (items[c.mat] || 0) + q;
      got.push(farmItemName(c.mat) + ' ×' + q);
      if (c.rare && Math.random() < (c.rareP || 0.15)) {
        items[c.rare] = (items[c.rare] || 0) + 1;
        got.push(farmItemName(c.rare) + ' ×1');
      }
    }
    f.plots[idx] = null;
    var txt = got.join('、');
    GAME.log('🌾 秘境收获：' + c.name + ' → ' + txt);
    return { ok: true, msg: '收获 ' + txt };
  };
  /* 一键收获：把成熟的全收了（面板里的快捷按钮） */
  GAME.farmHarvestAll = function () {
    var f = GAME.farmOf(), got = [], any = false;
    for (var i = 0; i < f.plots.length; i++) {
      if (GAME.farmPlotState(i).state !== 'ripe') continue;
      var r = GAME.farmHarvest(i);
      if (r.ok) { any = true; got.push(r.msg.replace(/^收获 /, '')); }
    }
    if (!any) return { ok: false, msg: '没有成熟的作物' };
    return { ok: true, msg: '收获 ' + got.join('、') };
  };

})();
