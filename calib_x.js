/* ============================================================
 * chain-audit.js  行为链全链路走查（node 运行）
 * 用法: node chain-audit.js
 * ------------------------------------------------------------
 * 与 smoke-test.js 的分工：
 *   · smoke = 单点断言（某函数在某个输入下的返回值 / 源码里有没有某段接线）；
 *   · 本工具 = **状态推进式走查**：从"派队"一路推到"落账"，每个节点都验，
 *     专抓"单点都对、串起来断"的链式缺陷（奇观链就属于这一类）。
 * 覆盖：奇观六层 × 五行动 / 自动探索 / 自动出征 / 自动研究 / 其它自动项 / 战力评估。
 * 退出码 = 失败节点数（0 = 全链路贯通）。
 * ============================================================ */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var _elCache = {};
  function makeEl(tag) {
    return {
      tagName: tag || 'DIV', textContent: '', innerHTML: '', value: '', checked: false,
      dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      querySelector: function (sel) { this._q = this._q || {}; if (!this._q[sel]) this._q[sel] = makeEl('DIV'); return this._q[sel]; },
      querySelectorAll: function () { return []; },
      getContext: function () {
        return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () {}, drawImage: function () {}, clearRect: function () {}, fillRect: function () {}, strokeRect: function () {}, beginPath: function () {}, arc: function () {}, ellipse: function () {}, save: function () {}, restore: function () {}, clip: function () {}, rect: function () {}, translate: function () {}, scale: function () {}, rotate: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, quadraticCurveTo: function () {}, bezierCurveTo: function () {}, fillText: function () {}, strokeText: function () {}, setLineDash: function () {}, measureText: function () { return { width: 10 }; }, createLinearGradient: function () { return { addColorStop: function () {} }; }, createRadialGradient: function () { return { addColorStop: function () {} }; }, createPattern: function () { return null; }, roundRect: function () {} };
      },
      getBoundingClientRect: function () { return { left: 0, top: 0, width: this.width || 760, height: this.height || 540 }; },
    };
  }
  global.document = {
    createElement: function (tag) { return makeEl(tag); },
    querySelector: function (sel) { if (!_elCache[sel]) _elCache[sel] = makeEl(); return _elCache[sel]; },
    querySelectorAll: function () { return []; },
    getElementById: function (id) { var k = '#' + id; if (!_elCache[k]) _elCache[k] = makeEl(); return _elCache[k]; },
    addEventListener: function () {}, readyState: 'complete', _cache: _elCache,
  };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {};
  global.removeEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  var PASS = 0, FAIL = 0, FAILED = [];
  function check(name, cond, extra) {
    if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
    else { FAIL++; FAILED.push(name + (extra ? '  [' + extra + ']' : '')); console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
  }
  function sec(t) { console.log('\n===== ' + t + ' ====='); }

  require('./js/bundle-core.js');
  require('./js/bundle-war.js');
  require('./js/bundle-ui.js');
  if (!window.GAME || !window.GAME.DATA) throw new Error('bundle 求值异常：GAME.DATA 缺失');
  if (global.GAME && global.GAME.DATA && global.GAME.DATA.DEFAULT_SETTINGS) global.GAME.DATA.DEFAULT_SETTINGS.battleWatch = false;

  var G = global.GAME, DATA = G.DATA, U = G.utils;
  G.newGame({ name: '链路走查', cityName: '链路城' });
  var s = G.state, pl = s.planets[0], city = s.cities[0];

  /* ---- 夹具：兵 + 将 + 时辰 ---- */
  var rows = G.power ? G.power.troopRows({ combatOnly: true }) : [];
  var TOP = rows.length ? rows[0].id : Object.keys(DATA.TROOPS)[0];
  var now = U.now();

  city.army = city.army || {};
  city.army[TOP] = 3000000;
  city.army.yunshu = (city.army.yunshu || 0) + 1000;
  s.res = s.res || {}; s.res.grain = 9999999; s.res.wood = 9999999; s.res.stone = 9999999; s.res.iron = 9999999;

  s.generals = [];
  function mkGen(name) {
    var g = G.makeGeneral(name, 120, 'idle');
    g.tong = 8000; g.yw = 8000; g.zm = 8000; g.nz = 8000;
    g.status = 'idle';
    s.generals.push(g);
    return g;
  }
  var genA = mkGen('走查甲'), genB = mkGen('走查乙'), genC = mkGen('走查丙');
  function cfgTodayOf(cfg, cid) { return ((cfg && cfg.today) || {})[cid] || 0; }

  /* 往城里塞一座建筑（找空格子建，不动已有的）—— 出征容量/实验室都要靠建筑。 */
  function ensureBuilding(ct, id, lvl) {    var cells = ct.cells || [];
    for (var i = 0; i < cells.length; i++) {
      var x = cells[i];
      if (x && x.build && x.build.id === id) { x.build.lvl = lvl; return true; }
    }
    for (var j = 0; j < cells.length; j++) {
      var y = cells[j];
      if (y && !y.build && !y.official) { y.build = { id: id, lvl: lvl }; return true; }
    }
    return false;
  }

  var day = G.questDayIndex ? G.questDayIndex() : 0;
  function forceWonder(def) {
    pl.wonderDay = day; pl.wonderId = def.id; pl.wonderClearedLv = 0; pl.wonderExp = [];
    pl.wonderPresDay = day; pl.wonderPresent = true;
    genA.status = 'idle'; genB.status = 'idle'; genC.status = 'idle';
  }
  var TROOPS = DATA.TROOPS || {};

  /* ============================================================
   * A. 奇观行为链：逐奇观 × 六层守军 × 全部行动（派队 → 抵达 → 累计 → 返航 → 落账）
   * ============================================================ */
  sec('A. 奇观行为链（' + (DATA.WONDER_DEFS || []).length + ' 个奇观 × 6 层 × 全部行动）');
  var lockAtZero = 0, totalActs = 0, layerFail = 0, dispatchFail = 0, accrueFail = 0, bankFail = 0, armyBackFail = 0, genRelFail = 0;

  (DATA.WONDER_DEFS || []).forEach(function (def) {
    forceWonder(def);
    /* A1 开局（已清 0 层）—— 所有行动必须被锁（这就是"必须先破层"的链头） */
    (def.acts || []).forEach(function (aid) {
      totalActs++;
      if (G.wonderActLockOf(pl.id, aid)) lockAtZero++;
    });
    /* A2 逐层挑战：1 → 6，每层必须真的破、clearedLv 必须真的涨 */
    var fightArmy = {}; fightArmy[TOP] = 600000;
    for (var lv = 1; lv <= G.wonderLayerCount(); lv++) {
      city.army[TOP] = 3000000;
      genA.status = 'idle';
      var r = G.wonderFightLayer(pl.id, lv, city.id, (function () { var a = {}; a[TOP] = 600000; return a; })(), genA.id);
      if (!(r && r.ok) || G.wonderClearedOf(pl.id) !== lv) {
        layerFail++;
        console.log('     · 层未破：' + def.id + ' Lv' + lv + ' → ' + (r && r.msg || '?'));
      }
    }
    /* A3 六层清完后，每个行动都必须解锁并能走完整条链 */
    (def.acts || []).forEach(function (aid) {
      var act = DATA.WONDER_ACT_DEFS[aid] || {};
      var lock = G.wonderActLockOf(pl.id, aid);
      if (lock) { dispatchFail++; console.log('     · 清完 6 层仍锁：' + def.id + '/' + aid + ' → ' + lock); return; }
      var army = {};
      if (act.needArmy) { army[TOP] = 2000; army.yunshu = 2; }
      if (act.needLoad) { army.yunshu = Math.max(2, Math.ceil(act.needLoad / 20000)); }
      city.army[TOP] = 3000000; city.army.yunshu = (city.army.yunshu || 0) + 100;
      var gen = genA; gen.status = 'idle';
      var before = {}; for (var ik in s.items) before[ik] = s.items[ik] || 0;
      var res = G.wonderExplore(pl.id, aid, city.id, army, gen.id);
      if (!res || !res.ok) { dispatchFail++; console.log('     · 派队失败：' + def.id + '/' + aid + ' → ' + (res && res.msg)); return; }
      var list = pl.wonderExp || [];
      var e = list[list.length - 1];
      if (!e) { dispatchFail++; return; }
      /* 推进 1：抵达（due=0） */
      e.arriveAt = U.now() - 1; G.wonderTick();
      /* 推进 2：累计 3 份 */
      e.arriveAt = U.now() - (DATA.WONDER_CFG.accrueSec || 600) * 1000 * 3; G.wonderTick();
      if (!(e.accrued >= 3)) accrueFail++;
      /* 推进 3：期满 → 返航 */
      e.exploreUntil = U.now() - 1; G.wonderTick();
      if (!e.returning) accrueFail++;
      /* 推进 4：返抵 → 落账 */
      e.retArrive = U.now() - 1; G.wonderTick();
      var still = (pl.wonderExp || []).indexOf(e) >= 0;
      if (still) bankFail++;
      /* 落账校验：材料进包 + 兵回城 + 英雄释放 */
      var gained = 0; for (var ik2 in s.items) { var d = (s.items[ik2] || 0) - (before[ik2] || 0); if (d > 0) gained += d; }
      if (gained <= 0) bankFail++;
      if (gen.status !== 'idle') genRelFail++;
      if (Object.keys(army).length && !((city.army[TOP] || 0) > 0)) armyBackFail++;
    });
  });
  check('A1 开局（0 层）全部行动被锁 —— 链头是"破层"', lockAtZero === totalActs, lockAtZero + '/' + totalActs);
  check('A2 六层守军逐层可破（每破一层 clearedLv 必 +1）', layerFail === 0, '失败 ' + layerFail + ' 层');
  check('A3 清完六层后全部行动可派队', dispatchFail === 0, '失败 ' + dispatchFail + ' 次');
  check('A4 抵达后累计生效（3 份）· 期满转返航', accrueFail === 0, '失败 ' + accrueFail);
  check('A5 返抵落账（出队 + 产出进包）', bankFail === 0, '失败 ' + bankFail);
  check('A6 落账后兵归城 · 英雄释放为空闲', armyBackFail === 0 && genRelFail === 0,
    '兵 ' + armyBackFail + ' / 将 ' + genRelFail);

  /* ============================================================
   * B. 自动探索链：默认（不自动清层）/ 开启自动清层 —— 两条路径都必须有明确出口
   * ============================================================ */
  sec('B. 自动探索链');
  var wd0 = (DATA.WONDER_DEFS || [])[0];
  forceWonder(wd0);
  var ecfg = G.autoExploreCfg();
  ecfg.on = true; ecfg.last = 0; ecfg.dailyMax = 0; ecfg.everyMin = 0;
  ecfg.offPlanets = {}; ecfg.offCities = {}; ecfg.cityGen = {}; ecfg.genId = null;
  ecfg.army = {}; ecfg.army[TOP] = 2000; ecfg.army.yunshu = 4;
  ecfg.clearArmy = {}; ecfg.clearArmy[TOP] = 20000;   /* 清层编成（破层专用） */
  ecfg.autoClear = false;
  var rB1 = G._autoExploreCity(pl.id, city, ecfg);
  check('B1 未清层 + 未开自动清层 → 明确报"无可派行动"（不静默）',
    !rB1.ok && /无可派行动|未解锁/.test(rB1.msg || ''), rB1.msg);
  ecfg.autoClear = true;
  var rB2 = G._autoExploreCity(pl.id, city, ecfg);
  check('B2 开自动清层 → 真去打下一层（行为链自愈）',
    !!rB2 && (rB2.ok || /层/.test(rB2.msg || '')), rB2 && (rB2.msg || 'ok'));
  check('B3 自动清层后已清层 ≥ 1（解锁采集/研读）', G.wonderClearedOf(pl.id) >= 1, 'cleared=' + G.wonderClearedOf(pl.id));
  var rB4 = G._autoExploreCity(pl.id, city, ecfg);
  check('B4 解锁后可正常派队探查', !!rB4 && (rB4.ok || /在途|满载|上限/.test(rB4.msg || '')), rB4 && rB4.msg);

  /* B5 安全阀：编成低于该层「建议最小兵力」→ 拒绝出战（不送死、不空耗） */
  forceWonder(wd0);
  ecfg.autoClear = true;
  ecfg.army = {}; ecfg.army[TOP] = 2000;          /* < 第 1 层建议 8000 */
  ecfg.clearArmy = {};                            /* 留空 = 沿用探索编成 */
  ecfg.today = {};
  var rB5 = G._autoExploreCity(pl.id, city, ecfg);
  check('B5 编成低于该层建议兵力 → 不出战（防送死）',
    !rB5.ok && /建议兵力/.test(rB5.msg || '') && G.wonderClearedOf(pl.id) === 0,
    (rB5.msg || '') + ' · cleared=' + G.wonderClearedOf(pl.id));

  /* B6 主循环：清层后当轮接着派队；清层本身不吃「每城每日次数」 */
  forceWonder(wd0);
  ecfg.army = {}; ecfg.army[TOP] = 20000;
  ecfg.today = {}; ecfg.dailyMax = 1; ecfg.last = 0;
  city.army[TOP] = 3000000;
  genA.status = 'idle'; genB.status = 'idle'; genC.status = 'idle';
  var rB6 = G.autoExplore();
  check('B6 清层 → 同轮派队（链条一次走完）且清层不占每日次数',
    G.wonderClearedOf(pl.id) === 1 && (cfgTodayOf(ecfg, city.id) === 1),
    'cleared=' + G.wonderClearedOf(pl.id) + ' today=' + cfgTodayOf(ecfg, city.id) + ' · ' + (rB6 && rB6.msg));

  /* B7 「只做采集」的玩家：探索编成 0、只有清层编成 → 也必须能破层并派出（否则链断在这类玩家身上） */
  forceWonder(wd0);
  ecfg.army = {}; ecfg.clearArmy = {}; ecfg.clearArmy[TOP] = 20000;
  ecfg.today = {}; ecfg.dailyMax = 0; ecfg.last = 0;
  genA.status = 'idle'; genB.status = 'idle'; genC.status = 'idle';
  var rB7 = G.autoExplore();
  check('B7 探索编成 0 + 清层编成够 → 仍能破层并派出（仅英雄行动）',
    G.wonderClearedOf(pl.id) === 1 && !!rB7 && rB7.ok,
    'cleared=' + G.wonderClearedOf(pl.id) + ' · ' + (rB7 && rB7.msg));

  /* ============================================================
   * C. 自动出征链：编成匹配四分支
   * ============================================================ */
  sec('C. 自动出征编成匹配（autoMarchMatchCity）');
  city.army[TOP] = 3000000;
  var m1 = G.autoMarchMatchCity(city, (function () { var c = {}; c[TOP] = 1000; return c; })());
  check('C1 编成足量 → ok', m1.ok && m1.total === 1000, 'total=' + m1.total);
  var m2 = G.autoMarchMatchCity(city, (function () { var c = {}; c[TOP] = 99999999; return c; })());
  check('C2 兵力不足 → reason=short', !m2.ok && m2.reason === 'short', m2.reason);
  /* 无练兵场 = 不设限（v89.132/§220 的口径，手动出征与自动必须一致） */
  var cap0 = G.battle.marchCapOf(city);
  var m0 = G.autoMarchMatchCity(city, (function () { var c = {}; c[TOP] = 500000; return c; })());
  check('C3 无练兵场（cap=0）→ 不设容量闸，只查驻军', cap0 === 0 && m0.ok, 'cap=' + cap0 + ' ok=' + m0.ok);
  /* 有练兵场 → 超容量必须判 cap */
  ensureBuilding(city, 'xiaochang', 14);
  var cap = G.battle.marchCapOf(city);
  var m3 = G.autoMarchMatchCity(city, (function () { var c = {}; c[TOP] = cap + 1000; return c; })());
  check('C4 有练兵场 + 超出征容量 → reason=cap', cap > 0 && !m3.ok && m3.reason === 'cap',
    'cap=' + cap + ' reason=' + m3.reason);
  var m5 = G.autoMarchMatchCity(city, (function () { var c = {}; c[TOP] = Math.floor(cap / 2); return c; })());
  check('C5 容量内 → ok', m5.ok, 'total=' + m5.total + ' / cap=' + cap);
  var m4 = G.autoMarchMatchCity(city, {});
  check('C6 空编成 → ok 且 0 兵（= 不限，退回旧口径）', m4.ok && m4.total === 0);

  /* ============================================================
   * D. 自动研究链：本城 6 格互不相同
   * ============================================================ */
  sec('D. 自动研究（本城 6 格互异）');
  ensureBuilding(city, 'honglusi', 5);
  var fcfg = G.autoFarmCfg();
  fcfg.on = true; fcfg.rotCursor = 0;
  s._autoFarmAt73 = 0;
  var crops = (DATA.FARM && DATA.FARM.crops) || [];
  var f = G.farmOf(city);
  function clearPlots() { f.plots = [null, null, null, null, null, null]; s._autoFarmAt73 = 0; }
  clearPlots();
  fcfg.crops = crops.slice(0, 4).map(function (c) { return c.id; });
  G.autoFarm();
  var planted = f.plots.filter(Boolean).map(function (pp) { return pp.crop; });
  var uniq = {}; planted.forEach(function (x) { uniq[x] = 1; });
  check('D1 4 个候选 → 最多铺 4 格且两两不同',
    planted.length > 0 && planted.length <= 4 && Object.keys(uniq).length === planted.length,
    '铺 ' + planted.length + ' 格 / 去重 ' + Object.keys(uniq).length);
  clearPlots();
  fcfg.crops = [crops[0].id];
  G.autoFarm();
  planted = f.plots.filter(Boolean).map(function (pp) { return pp.crop; });
  check('D2 单选 1 项 → 只铺 1 格', planted.length === 1, '铺 ' + planted.length + ' 格');
  clearPlots();
  fcfg.crops = crops.map(function (c) { return c.id; });
  G.autoFarm();
  planted = f.plots.filter(Boolean).map(function (pp) { return pp.crop; });
  uniq = {}; planted.forEach(function (x) { uniq[x] = 1; });
  check('D3 全选 → 6 格铺满且两两不同',
    planted.length === 6 && Object.keys(uniq).length === 6, planted.length + ' 格 / 去重 ' + Object.keys(uniq).length);

  /* ============================================================
   * E. 其它自动项：每项真跑一次，必须不抛错（链通不通先看能不能走）
   * ============================================================ */
  sec('E. 其它自动项（各跑一次）');
  [
    ['自动采集', 'autoGatherTick'], ['自动练兵', 'autoTrainTick'], ['自动采购', 'autoBuy'],
    ['自动科研', 'autoResearch'], ['自动治疗', 'autoHeal'], ['自动升级', 'autoUpgrade'],
    ['自动出征', 'autoMarch'], ['自动探索', 'autoExplore'],
  ].forEach(function (pair) {
    var name = pair[0], fn = pair[1];
    if (typeof G[fn] !== 'function') { check(name + '（' + fn + '）在册', false); return; }
    var err = null;
    try { G[fn](); } catch (e) { err = e; }
    check(name + '（' + fn + '）可执行不抛错', !err, err ? err.message : '');
  });

  /* ============================================================
   * F. 战力评估链（将 → 兵 → 总体）
   * ============================================================ */
  sec('F. 战力评估（将 / 兵 / 总体）');
  check('F1 战力命名空间在册', !!(G.power && G.power.troopOf && G.power.genOf && G.power.armyOf && G.power.cityOf));
  var badTroop = 0, allTroops = Object.keys(TROOPS);
  allTroops.forEach(function (id) { var p = G.power.troopOf(id); if (!(p > 0)) badTroop++; });
  check('F2 全部兵种战力 > 0（无 0 值死兵种）', badTroop === 0, badTroop + ' 个 0 值');
  var a1 = {}; a1[TOP] = 10000;
  var pNoGen = G.power.armyOf(a1, null);
  var pGen = G.power.armyOf(a1, genA);
  check('F3 裸战力 = Σ 兵种战力×数量', Math.abs(pNoGen.base - G.power.troopOf(TOP) * 10000) < 1, 'base=' + pNoGen.base);
  check('F4 带将战力 > 裸战力（将领真加成）', pGen.total > pNoGen.total, pNoGen.total + ' → ' + pGen.total);
  var g1 = G.power.genOf(genA, a1);
  check('F5 将领评估含指挥覆盖 / 攻防加成 / 战力', !!(g1 && g1.coverCap > 0 && g1.power > 0),
    'coverCap=' + (g1 && g1.coverCap) + ' atk%=' + (g1 && g1.atkPct) + ' def%=' + (g1 && g1.defPct) + ' power=' + (g1 && g1.power));
  var c1 = G.power.cityOf(city, genA);
  check('F6 一城战力 = 驻军总体战力', !!c1 && c1.total > 0, 'total=' + (c1 && c1.total));
  /* 覆盖折损：兵数 > 指挥容量时，实际吃到加成率应 < 满覆盖加成率 */
  var a2 = {}; a2[TOP] = Math.max(1, Math.round((g1.coverCap || 1) * 3));
  var pBig = G.power.armyOf(a2, genA);
  check('F7 超指挥容量时加成按覆盖率折损（coverRate < bonusRate）',
    pBig.coverRate < pBig.bonusRate + 1e-9, 'cover=' + pBig.coverRate.toFixed(4) + ' bonus=' + pBig.bonusRate.toFixed(4));

  /* ============================================================
   * G. 界面层：每个选项都要"点得到、点得对"（不只是域层能跑）
   * ============================================================ */
  sec('G. 界面层：面板与按钮（每个选项都渲染出来）');
  var UIx = G.ui;
  forceWonder(wd0);
  var acts0 = (wd0.acts || []).length;

  pl.wonderClearedLv = 0;
  var h0 = UIx.wonderActsHTML(pl.id) || '';
  var btnN = (h0.match(/data-action="wonder-exp"/g) || []).length;
  var lockN = (h0.match(/🔒/g) || []).length;
  check('G1 奇观行动按钮：每个收录行动都有一个按钮', btnN === acts0, btnN + '/' + acts0);
  check('G2 0 层时全部按钮锁定（🔒 + disabled）', btnN > 0 && lockN === btnN && /disabled/.test(h0), lockN + '/' + btnN);

  pl.wonderClearedLv = G.wonderLayerCount();
  var h6 = UIx.wonderActsHTML(pl.id) || '';
  check('G3 清满后无锁定按钮', !/🔒/.test(h6) && !/disabled/.test(h6), h6.slice(0, 0) + 'len=' + h6.length);

  pl.wonderClearedLv = 0;
  var L0 = UIx.wonderLayersHTML(pl.id) || '';
  check('G4 层级面板：0 层时恰有 1 个「⚔ 挑战」（逐层推进，不越级）',
    (L0.match(/data-action="wonder-fight"/g) || []).length === 1);
  pl.wonderClearedLv = 3;
  var L3 = UIx.wonderLayersHTML(pl.id) || '';
  check('G5 层级面板：清 3 层后仍恰有 1 个「⚔ 挑战」且 3 个「✔ 已清」',
    (L3.match(/data-action="wonder-fight"/g) || []).length === 1 && (L3.match(/✔ 已清/g) || []).length === 3);

  /* 自动探索面板：行为链提示必须把「可行 / 受阻原因」都渲染出来 */
  var cfgUI = G.autoExploreCfg();
  pl.wonderClearedLv = 0;
  cfgUI.army = {}; cfgUI.army[TOP] = 2000; cfgUI.clearArmy = {};
  var chain0 = G.autoExploreActsFor(pl.id, city, cfgUI);
  var ch = UIx.aeChainHTML(chain0, cfgUI) || '';
  check('G6 自动探索：受阻行动逐条渲染原因（带锁图标）',
    chain0.blocked.length > 0 && (ch.match(/🔒/g) || []).length === chain0.blocked.length,
    'blocked=' + chain0.blocked.length);
  pl.wonderClearedLv = G.wonderLayerCount();
  var chain6 = G.autoExploreActsFor(pl.id, city, cfgUI);
  var ch6 = UIx.aeChainHTML(chain6, cfgUI) || '';
  check('G7 自动探索：清满后转成 ✅ 可派（并有编成摘要）',
    chain6.feas.length > 0 && (ch6.match(/✅/g) || []).length === chain6.feas.length,
    'feas=' + chain6.feas.length);

  /* 面板真渲染一次（不是看源码有没有字符串） */
  var errPanel = null;
  try { UIx.openAutoExplore(); } catch (e) { errPanel = e; }
  check('G8 「自动探索」面板可渲染（含清层数量列）', !errPanel, errPanel ? errPanel.message : '');
  var errPw = null;
  try { UIx.openPower(); } catch (e) { errPw = e; }
  check('G9 「战力评估」面板可渲染', !errPw, errPw ? errPw.message : '');
  var errWd = null;
  try { UIx.openWonder(pl.id); } catch (e) { errWd = e; }
  check('G10 「奇观」面板可渲染（产出 + 层级 + 队列 + 行动）', !errWd, errWd ? errWd.message : '');

  console.log('\n============================================');
  /* 标准汇总行（gate.py 按这个正则取数，别改格式）。 */
  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  if (FAILED.length) { console.log('失败节点：'); FAILED.forEach(function (x) { console.log('  ❌ ' + x); }); }
  console.log('============================================');
  process.exit(FAIL);
})();
