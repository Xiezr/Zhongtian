# -*- coding: utf-8 -*-
"""v89.6 引擎补丁：奇遇点位生成 / 线索 / 探奇三段 + 场景机共用（sceneBegin）"""
import io

P = r'E:\Deepseekdb\js\state.js'
d = io.open(P, encoding='utf-8', newline='').read()

# ============ ① 奇遇引擎（插在 jianghuSpotInfo 之后） ============
OLD1 = """    return { n: acts.length, lv: lv, score: score, mark: score >= th };
  };
  GAME.jianghuDone = function (s, x, y, actId, day) {"""

NEW1 = """    return { n: acts.length, lv: lv, score: score, mark: score >= th };
  };

  /* ============================================================
   * v89.6（老板：「探索性和趣味性」）：奇遇 · 见闻录
   * ------------------------------------------------------------
   * 三件套：
   *   ① wonderSites —— 隐藏点位（map.seed 的确定性函数，一次生成缓存）：
   *      三带密度：近郊多逸闻、绝域多奇珍绝景；不与据点/城池重叠。
   *   ② 现形：线索（活动结算时按 day 盐确定性掷）与「就近探察」（开野地弹窗方圆二格）。
   *   ③ 探奇三段 Check/Spend/Roll（与江湖活动同一形状）：首次选择扣费并锁点位，
   *      结算入见闻录；点位一旦动身即断（无论成败）。
   * ============================================================ */
  GAME.wonderState = function () {
    var s = GAME.state;
    if (!s) return null;
    if (!s.wonders) s.wonders = {};
    s.wonders.r = s.wonders.r || {};     /* revealed：已现形（地图悬✦） */
    s.wonders.d = s.wonders.d || {};     /* done：已探（无论成败，缘止于此） */
    s.wonders.j = s.wonders.j || {};     /* journal：见闻录收录（按奇遇 id） */
    return s.wonders;
  };
  GAME.wonderTierName = function (t) {
    return ({ small: '逸闻', rare: '奇珍', epic: '绝景' })[t] || '奇遇';
  };
  GAME.wonderBandName = function (b) {
    return ({ near: '近郊', mid: '远野', far: '绝域' })[b] || '';
  };
  /* 点位生成：地图 seed 的确定性函数（缓存于 map，随 seed 重算） */
  GAME.wonderSites = function () {
    var s = GAME.state;
    if (!s || !s.map || !s.map.grid) return [];
    if (GAME.map._wonderSites && GAME.map._wonderSeed === s.map.seed) return GAME.map._wonderSites;
    var W = DATA.MAP_W, H = DATA.MAP_H, seed = (s.map.seed || 1) | 0;
    var wc = DATA.WONDER || {};
    var near = wc.bandNear || 25, far = wc.bandFar || 70;
    var pNear = wc.nearP || 0.0016, pMid = wc.midP || 0.0006, pFar = wc.farP || 0.00024;
    var sp0 = s.map.startPos || DATA.START_POS || { x: 250, y: 200 };
    var WILD = { caoyuan: 1, zhaoze: 1, lake: 1, forest: 1, desert: 1, hill: 1 };
    /* 三档候选 id 表（各取一次，供逐点指定） */
    var byTier = { small: [], rare: [], epic: [] };
    Object.keys(DATA.WONDERS || {}).forEach(function (id) {
      var t = (DATA.WONDERS[id] || {}).tier;
      if (byTier[t]) byTier[t].push(id);
    });
    /* 类型轮转表 = [逸闻×12 洗牌 ｜ 奇珍×8 ｜ 绝景×4]（前 24 位 = 全部类型，保底覆盖）
       + 「余篇」模式 [奇珍, 绝景, 奇珍, 逸闻] 循环（远离主城的多余点位以奇珍/绝景为主，
       保住「愈远愈奇」的手感）。
       ⚠️ v1 曾按「档内轮转」：当某档点位数 < 档内类型数（逸闻 12 类、实测点位数常 <12）
       必然漏类 —— seed 相关抖动，门禁实测 2/3 红。现改为**全池轮转 + 带序分配**：
       点位按带排序后逐位取表，点位总数 ≥ 24（实测 36~68）即保证全覆盖。 */
    var shuffle0 = function (arr) {
      var a2 = arr.slice();
      var rnd0 = U.rng((seed * 2654435761 ^ 0x77aa2b1) >>> 0);
      for (var k2 = a2.length - 1; k2 > 0; k2--) {
        var j2 = Math.floor(rnd0() * (k2 + 1));
        var tmp2 = a2[k2]; a2[k2] = a2[j2]; a2[j2] = tmp2;
      }
      return a2;
    };
    var sSmall = shuffle0(byTier.small), sRare = shuffle0(byTier.rare), sEpic = shuffle0(byTier.epic);
    var typesCycle = sSmall.concat(sRare).concat(sEpic);
    if (sSmall.length && sRare.length && sEpic.length) {
      for (var q0 = 0; q0 < 40; q0++) {
        typesCycle.push(sRare[q0 % sRare.length], sEpic[q0 % sEpic.length],
          sRare[(q0 + 3) % sRare.length], sSmall[q0 % sSmall.length]);
      }
    }
    var list = [], byKey = {};
    for (var y = 0; y < H; y++) {
      var row = s.map.grid[y];
      if (!row) continue;
      for (var x = 0; x < W; x++) {
        var tl = row[x];
        if (!tl || !WILD[tl.terrain]) continue;
        var dx = x - sp0.x, dy = y - sp0.y;
        var d2 = dx * dx + dy * dy;
        var band = d2 <= near * near ? 'near' : (d2 <= far * far ? 'mid' : 'far');
        var p = band === 'near' ? pNear : (band === 'mid' ? pMid : pFar);
        var h1 = U.rng((x * 73856093 ^ y * 19349663 ^ seed * 2654435761 ^ 0x5a17) >>> 0)();
        if (h1 >= p) continue;
        /* 据点上的点位要排除（据点每日重算，点位必须是"地里长出来"的稳定物）；
           密度筛过之后才查据点 —— 逐格查据点会把 174 城 × 25 万格算爆 */
        if (GAME.map.hasFort(x, y)) continue;
        var it = { x: x, y: y, wid: '', tier: 'small', band: band };
        list.push(it);
        byKey[x + ',' + y] = it;
      }
    }
    /* 带序分配：近郊在前、绝域在后 → 逐位取类型轮转表（tier 跟随类型：奖励/收录/带味一致） */
    var rank0 = { near: 0, mid: 1, far: 2 };
    var order = list.slice().sort(function (a, b) {
      return (rank0[a.band] - rank0[b.band]) || (a.y - b.y) || (a.x - b.x);
    });
    for (var oi = 0; oi < order.length; oi++) {
      var wid0 = typesCycle[oi % typesCycle.length];
      order[oi].wid = wid0;
      order[oi].tier = (DATA.WONDERS[wid0] || {}).tier || 'small';
    }
    GAME.map._wonderSites = list;
    GAME.map._wonderMap = byKey;
    GAME.map._wonderSeed = s.map.seed;
    return list;
  };
  /* 点位查询（未现形/已探状态合并返回；非点位 → null） */
  GAME.wonderSiteOf = function (x, y) {
    GAME.wonderSites();
    var it = (GAME.map._wonderMap || {})[x + ',' + y];
    if (!it) return null;
    var ws = GAME.wonderState();
    return { x: it.x, y: it.y, wid: it.wid, tier: it.tier, band: it.band,
      revealed: !!ws.r[x + ',' + y], done: !!ws.d[x + ',' + y] };
  };
  /* 就近探察：打开野地弹窗时，方圆二格（切比雪夫）内的未现形点位自动现形 —— 返回新现形数 */
  GAME.wonderSurvey = function (x, y) {
    var ws = GAME.wonderState();
    if (!ws) return 0;
    GAME.wonderSites();
    var m = GAME.map._wonderMap || {};
    var n = 0;
    for (var j = -2; j <= 2; j++) {
      for (var i = -2; i <= 2; i++) {
        var it = m[(x + i) + ',' + (y + j)];
        if (!it) continue;
        var k = it.x + ',' + it.y;
        if (ws.r[k] || ws.d[k]) continue;
        ws.r[k] = 1;
        n++;
      }
    }
    if (n) GAME.log('📜 探得异迹 ' + n + ' 处 —— 记于见闻，可于图中寻「✦」往探');
    return n;
  };
  /* 线索：走完一桩江湖事后有几率闻得尚未现形的点位（确定性 roll；无剩余点位则无） */
  GAME.wonderClueRoll = function (x, y, actId, day) {
    var ws = GAME.wonderState();
    var wc = DATA.WONDER || {};
    if (!ws) return null;
    var p = wc.clueP != null ? wc.clueP : 0.18;
    if (p <= 0) return null;
    if (GAME.invasionRoll('wclue|' + x + ',' + y + '|' + actId + '|' + day) >= p) return null;
    var list = GAME.wonderSites();
    var cand = [];
    for (var i = 0; i < list.length; i++) {
      var k = list[i].x + ',' + list[i].y;
      if (!ws.r[k] && !ws.d[k]) cand.push(list[i]);
    }
    if (!cand.length) return null;
    var h = GAME.invasionRoll('wcpick|' + x + ',' + y + '|' + actId + '|' + day);
    var pick = cand[Math.floor(h * cand.length) % cand.length];
    ws.r[pick.x + ',' + pick.y] = 1;
    return { x: pick.x, y: pick.y, band: pick.band, tier: pick.tier };
  };
  /* 线索文案：方向（八向、零三角函数）+ 远近（里数）+ 地带 */
  GAME.wonderClueText = function (site) {
    var home = GAME.currentCity() || (GAME.map.playerCity ? GAME.map.playerCity() : null) || { x: 250, y: 200 };
    var dx = site.x - home.x, dy = site.y - home.y;
    var adx = Math.abs(dx), ady = Math.abs(dy);
    var ns = (dy < -adx * 0.5) ? '北' : ((dy > adx * 0.5) ? '南' : '');
    var ew = (dx > ady * 0.5) ? '东' : ((dx < -ady * 0.5) ? '西' : '');
    var dir = (ew + ns) || '近处';
    var dist = Math.round(Math.sqrt(dx * dx + dy * dy) * 3);
    return '闻得城' + dir + '约 ' + dist + ' 里 ' + GAME.wonderBandName(site.band) +
      ' 之地（' + site.x + ',' + site.y + '），似有异象 —— 或可一探';
  };
  /* 线索挂到结算结果（三处 return 共用出口；线索是边角料，出错不拖累活动结算） */
  GAME._jhClueAttach = function (res, chk) {
    try {
      var site = GAME.wonderClueRoll(chk.x, chk.y, chk.actId, chk.day);
      if (site) {
        res.clue = '📜 ' + GAME.wonderClueText(site);
        GAME.log('📜 闻得异迹（' + site.x + ',' + site.y + '）—— 疑有奇物');
      }
    } catch (e) { /* 线索失败不影响活动结算 */ }
    return res;
  };
  /* --------- 探奇三段：Check / Spend / Roll（与江湖活动同一形状） --------- */
  GAME.wonderCheck = function (x, y, genId) {
    var s = GAME.state;
    var tile = GAME.map.tile(x, y);
    if (!tile) return { ok: false, msg: '坐标越界' };
    var site = GAME.wonderSiteOf(x, y);
    if (!site) return { ok: false, msg: '此地无奇可探' };
    if (site.done) return { ok: false, msg: '此地奇遇已探 —— 缘止于此' };
    if (!site.revealed) return { ok: false, msg: '此地尚无音信 —— 江湖之行或可闻得异迹' };
    var w = (DATA.WONDERS || {})[site.wid];
    if (!w) return { ok: false, msg: '奇物未载于册' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的将领' };
    if (!GAME.canCultivate(gen)) return { ok: false, msg: '寻奇探幽乃君主亲历之事 —— 只有君主可前往' };
    var cost = (DATA.WONDER && DATA.WONDER.cost) || { energy: 6, stam: 2 };
    if ((gen.energy || 0) < cost.energy) {
      return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + cost.energy + '），可服清心丸' };
    }
    if (GAME.staNow(gen) < cost.stam) {
      return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/' + cost.stam + '），休整后再来' };
    }
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    var act = { id: 'wonder', name: w.name, icon: w.ic, kind: 'wonder', cat: '奇遇', alias: GAME.wonderTierName(site.tier),
      energy: cost.energy, stam: cost.stam, desc: w.txt || '', drop: 0 };
    return { ok: true, act: act, gen: gen, day: day, lv: GAME.map.wildLevelNow(x, y),
      x: x, y: y, actId: 'wonder', site: site, wid: site.wid };
  };
  GAME.wonderSpend = function (chk) {
    var a = chk.act, gen = chk.gen;
    gen.energy = Math.max(0, (gen.energy || 0) - a.energy);
    GAME.setStaNow(gen, GAME.staNow(gen) - a.stam);
    var ws = GAME.wonderState();
    ws.d[chk.x + ',' + chk.y] = 1;      /* 一旦动身，此缘即断（无论成败） */
    return { ok: true };
  };
  GAME.wonderRoll = function (chk, mods) {
    var s = GAME.state;
    var x = chk.x, y = chk.y;
    var tile = GAME.map.tile(x, y) || {};
    var w = (DATA.WONDERS || {})[chk.wid] || {};
    var tier = (chk.site && chk.site.tier) || 'small';
    var mo = mods || {};
    var mRw = mo.reward || 1;
    var mWo = mo.wound || 1;
    var seedBase = 'wd|' + x + ',' + y + '|' + chk.wid + '|' + chk.day;
    var roll = function (salt) { return GAME.invasionRoll(seedBase + '|' + salt); };
    var rnd = function (salt, lo, hi) {
      lo = Math.round(lo); hi = Math.round(hi);
      return lo + Math.floor(roll(salt) * (hi - lo + 1));
    };
    var mi = function (n) { return Math.max(1, Math.round(n * mRw)); };
    var rwAll = (DATA.WONDER && DATA.WONDER.rw) || {};
    var rw = rwAll[tier] || rwAll.small || {};
    var ws = GAME.wonderState();
    ws.j[chk.wid] = 1;                  /* 见闻录收录（按奇遇 id，重复不再计数） */
    var texts = [];
    var bad = false;
    s.items = s.items || {};
    if (rw.ess) {
      var ne = mi(rnd('ess', rw.ess[0], rw.ess[1]));
      s.items.lingsui = (s.items.lingsui || 0) + ne;
      texts.push('灵气精华 +' + ne);
    }
    var home = GAME.currentCity();
    if (rw.gold && home) {
      var ng = mi(rnd('gold', rw.gold[0], rw.gold[1]));
      GAME.res(home).gold = (GAME.res(home).gold || 0) + ng;
      texts.push('黄金 +' + ng);
    }
    if (rw.mats) {
      var tbl = DATA.WILD_MATERIAL[tile.terrain] || {};
      var keys = Object.keys(tbl);
      if (keys.length) {
        var nm = mi(rnd('matn', rw.mats[0], rw.mats[1]));
        var bag = {};
        for (var i = 0; i < nm; i++) {
          var mk = keys[Math.floor(roll('mk' + i) * keys.length) % keys.length];
          bag[mk] = (bag[mk] || 0) + 1 + Math.floor(roll('mq' + i) * 2);
        }
        for (var bk in bag) {
          s.items[bk] = (s.items[bk] || 0) + bag[bk];
          var mm = DATA.MATERIAL_BY_ID[bk];
          texts.push((mm ? mm.name : bk) + '×' + bag[bk]);
        }
      }
    }
    if (rw.jewel) {
      var jewels = (DATA.ITEMS || []).filter(function (x2) { return x2.type === 'jewel'; });
      for (var ji = 0; ji < rw.jewel; ji++) {
        var jl = jewels[Math.floor(roll('jl' + ji) * Math.min(4, jewels.length)) % Math.min(4, jewels.length)];
        if (jl) {
          s.items[jl.id] = (s.items[jl.id] || 0) + 1;
          texts.push(jl.name + '×1');
        }
      }
    }
    /* 贪进之险：选项带 wound 修正者，另折些体力（贪字头上一把刀） */
    if (mWo > 1) {
      var hurt = Math.round(6 * (mWo - 1));
      if (hurt > 0) {
        GAME.setStaNow(chk.gen, Math.max(0, GAME.staNow(chk.gen) - hurt));
        texts.push(chk.gen.name + ' 受了些伤，体力 −' + hurt);
        bad = true;
      }
    }
    texts.push('见闻录收录 · ' + GAME.wonderTierName(tier) + '「' + (w.name || '奇遇') + '」');
    GAME.log('✨ 奇遇 · ' + (w.name || '') + '（' + GAME.wonderTierName(tier) + '）：' + texts.join('、'));
    return { ok: true, name: '奇遇 · ' + (w.name || ''), text: texts.join('、'),
      bad: false, grade: 'win', wonder: true };
  };
  GAME.jianghuDone = function (s, x, y, actId, day) {"""

assert d.count(OLD1) == 1, ('state 锚点①', d.count(OLD1))
d = d.replace(OLD1, NEW1, 1)

# ============ ② 线索挂三处 return ============
OLD2 = """      return { ok: true, name: a.name + ' · ' + name0, text: (ev ? ev.text : '') + '（' + body0 + '）', bad: false, grade: 'win' };"""
NEW2 = """      return GAME._jhClueAttach({ ok: true, name: a.name + ' · ' + name0, text: (ev ? ev.text : '') + '（' + body0 + '）', bad: false, grade: 'win' }, chk);"""
assert d.count(OLD2) == 1, ('state 锚点②', d.count(OLD2))
d = d.replace(OLD2, NEW2, 1)

OLD3 = """      return { ok: true, name: out2.t, text: texts.join('、'), bad: bad,
        grade: (out2.wound ? 'lose' : (out2.none ? 'partial' : 'win')) };"""
NEW3 = """      return GAME._jhClueAttach({ ok: true, name: out2.t, text: texts.join('、'), bad: bad,
        grade: (out2.wound ? 'lose' : (out2.none ? 'partial' : 'win')) }, chk);"""
assert d.count(OLD3) == 1, ('state 锚点③', d.count(OLD3))
d = d.replace(OLD3, NEW3, 1)

OLD4 = """    return { ok: true, name: a.name + ' · ' + title, text: body, bad: bad, grade: grade };"""
NEW4 = """    return GAME._jhClueAttach({ ok: true, name: a.name + ' · ' + title, text: body, bad: bad, grade: grade }, chk);"""
assert d.count(OLD4) == 1, ('state 锚点④', d.count(OLD4))
d = d.replace(OLD4, NEW4, 1)

# ============ ③ 场景机共用：sceneBegin + wonderStart ============
OLD5 = """  GAME.sceneStart = function (x, y, genId, actId) {
    var chk = GAME.jianghuCheck(x, y, genId, actId);
    if (!chk.ok) return chk;
    var fly = (DATA.SCENE_FLOW || {})[actId];
    if (!fly) return { ok: true, fx: null };
    GAME.sceneFx = {
      chk: chk, fly: fly, actId: actId,
      stage: 0, picks: [],
      mods: { pow: 1, reward: 1, wound: 1, luck: 0 },
      spent: false, phase: 'stage', result: null, grade: null
    };
    return { ok: true, fx: GAME.sceneFx };
  };"""
NEW5 = """  /* v89.6：剧本开场内核抽成共用出口 —— 江湖活动与奇遇共用同一套场景机 */
  GAME.sceneBegin = function (chk, fly, extra) {
    GAME.sceneFx = {
      chk: chk, fly: fly, actId: chk.actId,
      stage: 0, picks: [],
      mods: { pow: 1, reward: 1, wound: 1, luck: 0 },
      spent: false, phase: 'stage', result: null, grade: null
    };
    if (extra) { for (var k6 in extra) GAME.sceneFx[k6] = extra[k6]; }
    return { ok: true, fx: GAME.sceneFx };
  };
  GAME.sceneStart = function (x, y, genId, actId) {
    var chk = GAME.jianghuCheck(x, y, genId, actId);
    if (!chk.ok) return chk;
    var fly = (DATA.SCENE_FLOW || {})[actId];
    if (!fly) return { ok: true, fx: null };
    return GAME.sceneBegin(chk, fly, null);
  };
  /* 探奇开场：奇遇剧本（kind:'wonder' —— 扣费/结算在 scenePick 里分流） */
  GAME.wonderStart = function (x, y, genId) {
    var chk = GAME.wonderCheck(x, y, genId);
    if (!chk.ok) return chk;
    var w = (DATA.WONDERS || {})[chk.wid] || {};
    var wc = DATA.WONDER || {};
    var fly = {
      art: w.ic || '✨', scene: w.scene || 'meadow',
      escLabel: '🍃 就此离去', backLabel: '收拢此行',
      exits: wc.exits || {},
      stages: w.stages || []
    };
    return GAME.sceneBegin(chk, fly, { kind: 'wonder', wid: chk.wid, tier: chk.site.tier });
  };"""
assert d.count(OLD5) == 1, ('state 锚点⑤', d.count(OLD5))
d = d.replace(OLD5, NEW5, 1)

# ============ ④ scenePick 分流（扣费 / 结算） ============
OLD6 = """    if (!fx.spent) { GAME.jianghuSpend(fx.chk); fx.spent = true; }"""
NEW6 = """    if (!fx.spent) { (fx.kind === 'wonder') ? GAME.wonderSpend(fx.chk) : GAME.jianghuSpend(fx.chk); fx.spent = true; }"""
assert d.count(OLD6) == 1, ('state 锚点⑥', d.count(OLD6))
d = d.replace(OLD6, NEW6, 1)

OLD7 = """      fx.result = GAME.jianghuRoll(fx.chk, fx.mods);"""
NEW7 = """      fx.result = (fx.kind === 'wonder') ? GAME.wonderRoll(fx.chk, fx.mods) : GAME.jianghuRoll(fx.chk, fx.mods);"""
assert d.count(OLD7) == 1, ('state 锚点⑦', d.count(OLD7))
d = d.replace(OLD7, NEW7, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('OK state.js: 奇遇引擎 + 线索挂接 + sceneBegin 分流 已写入')
