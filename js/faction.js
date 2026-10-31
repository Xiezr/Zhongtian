/* ============================================================
 * faction.js — 四个军阀（v92.5 / 构想清单 B1 的最小闭环）
 * ------------------------------------------------------------
 * 起因（docs/玩法提案-从进度条到选择.md 第 5 节）：
 *   「外交 ❌ 无」「十类玩法，空了七个」。而世界里现在只有玩家会动 ——
 *   174 座 NPC 城是静止的布景，占下来就完事。
 *
 * 这一版只做**态势**，不碰数值、不跑战斗：
 *   · 4 个军阀各有核心与领地半径，**每月推进一次**；
 *   · 领地按"距离 + 半径"算，存档只存 4×3 个数字（不存格子，几十字节）；
 *   · 面板里看得到四家的势力范围、离你最近多少格；
 *   · 逼近到 8 格内给一条警报。
 *
 * ⚠️ 刻意**不做**的事（诚实标注，不假装做了）：
 *   · 不给领地野地加守军倍率 —— 那会让"侦查所见 = 战斗所遇"这条铁律破功
 *     （侦查读 wildDefenseAt，实战若另乘系数，情报就成了假的）；
 *   · 不做势力间吞并与战争 —— B1 里那套"战力比 + 骰子"要真改世界状态，
 *     没有战斗接入前做了也只是播报，是假动作。
 *   所以：**它现在只是"世界在动"**。接入战斗是下一步，不是这一版。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var FA = GAME.faction = {};   /* ⚠️ 不用 F：fog.js 已占 FA.（audit 按字面前缀查重名，会误报）*/
  var U = GAME.utils;

  function SP() { return (GAME.sphereOf ? GAME.sphereOf()
    : (GAME.mapSphere || GAME.sphere))   /* v98.6：`GAME.sphereOf()` 是**既有**出口（state.js：按 pid 取那颗星球的球面，
      默认当前星球 → 返回有 cells 的 GAME.sphere）。
      原来的 `GAME.mapSphere || GAME.sphere` 在玩家**还没打开地图**时是致命的：
      mapSphere 对象存在但没 build，`||` 不生效 → 拿到空球 → 村社/遗迹/势力/竞争者全空。 */; }
  function cfg() { return (GAME.DATA && GAME.DATA.FACTION) || {}; }

  /* 纯哈希（只吃 ci + seed）：同一颗球，四家的位置永远一样 */
  function h(ci, salt) {
    var x = (ci * 2654435761 + salt * 40503) >>> 0;
    x ^= x >>> 13; x = (x * 1274126177) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /* 挑 4 个核心：彼此至少 `DATA.FACTION.coreMinGap` 格（v152：格数 40962→10242 后
     55 格在大球上放不下四家 —— 按**球面尺度**折算成 27 格，即原间距的 √(1/4)），
     离玩家主城至少 `coreMinCity` 格（别一开局就贴脸）。 */
  function _gap(k, d) {
    var D = (GAME.DATA && GAME.DATA.FACTION) || {};
    return D[k] == null ? d : D[k];
  }
  function pickCores(sd, s, n) {
    var out = [], tries = 0, total = s.cells.length;
    var pc = GAME.currentCity ? GAME.currentCity() : null;
    while (out.length < n && tries < 30000) {
      var ci = Math.floor(h(tries++, sd + 4401) * total) % total;
      var cell = s.cells[ci];
      if (!cell || cell.type === 'lake') continue;
      var ok = true;
      for (var i = 0; i < out.length; i++) {
        if (s.distOf({ ci: out[i] }, { ci: ci }) < _gap('coreMinGap', 55)) { ok = false; break; }
      }
      if (!ok) continue;
      if (pc && pc.ci >= 0 && s.distOf({ ci: pc.ci }, { ci: ci }) < _gap('coreMinCity', 25)) continue;
      out.push(ci);
    }
    return out;
  }

  /* 建/换星球时重建（幂等：seed 没变什么都不做） */
  FA.ensure = function () {
    var st = GAME.state, s = SP();
    if (!st || !s || !s.cells) return false;
    var sd = (s.seed3 ? s.seed3() : 0) | 0;
    st.factions = st.factions || {};
    if (st.factions.seed === sd && st.factions.arr) return true;
    var list = cfg().list || [];
    var cores = pickCores(sd, s, list.length);
    if (!cores.length) return false;
    st.factions = {
      seed: sd,
      lastMonth: -1,
      arr: cores.map(function (ci, i) {
        return { id: list[i] ? list[i].id : ('f' + i), core: ci, r: cfg().startRadius || 2 };
      })
    };
    return true;
  };

  FA.arr = function () { return ((GAME.state || {}).factions || {}).arr || []; };

  /* 某格归谁：最近的那家说了算，且必须在它的半径内；两圆重叠时近者胜。
     ⚠️ 必须自己挡越界 ci：`hexDist` 对越界索引不保证给正数（实测给 0），
     于是 999999 会被算成"距离 0 = 就在铁砧家里"。 */
  FA.controlOf = function (ci) {
    var s = SP(), arr = FA.arr();
    if (!s || !arr.length || !s.cells) return null;
    if (ci == null || ci < 0 || ci >= s.cells.length) return null;
    if (!s.cells[ci]) return null;
    var best = null, bd = 1e9;
    for (var i = 0; i < arr.length; i++) {
      var d = s.distOf({ ci: arr[i].core }, { ci: ci });
      if (d < bd) { bd = d; best = arr[i]; }
    }
    if (!best) return null;
    if (bd > best.r + 0.001) return null;
    return best.id;
  };

  FA.defOf = function (id) {
    var list = cfg().list || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  /* ============================================================
   * v92.9（构想 C1）：势力代将 —— 斗将的对手
   * ------------------------------------------------------------
   * 每家有固定的人格（名字 + 三维），玩家可以**记住他的出招倾向**：
   *   铁砧断钉（武力 22）爱突刺 · 灰墙老砧（统率 22）爱格挡
   *   焰誓灰烬（武力 20）爱突刺 · 商盟秤砣（谋略 20）爱佯攻
   * 这就是「可预判」：不是纯掷骰，属性高什么、就更容易出什么。
   * ============================================================ */
  FA.rivalOf = function (fid) {
    var T = {
      anvil: { name: '断钉', yw: 22, zm: 12, tong: 14 },
      wall: { name: '老砧', yw: 14, zm: 14, tong: 22 },
      oath: { name: '灰烬', yw: 20, zm: 16, tong: 14 },
      guild: { name: '秤砣', yw: 12, zm: 20, tong: 18 }
    }[fid] || { name: '无名将', yw: 16, zm: 16, tong: 16 };
    var d = FA.defOf(fid);
    return {
      id: 'rival-' + fid,
      name: (d ? d.name + ' · ' : '') + T.name,
      yw: T.yw, zm: T.zm, tong: T.tong,
      level: 20,
      _rival: true
    };
  };

  /* ============================================================
   * tick —— 每月推进一次（不按"日"：日只有 1.3 现实秒，会变成抽搐）
   * ------------------------------------------------------------
   * 半径增长 × 该家的侵略性。上限 maxR 保证不会把整颗球吃干净 ——
   * 势力是"压力"，不是"终局"。
   * ============================================================ */
  FA.tick = function () {
    var st = GAME.state;
    if (!st || !GAME.DATA) return null;
    FA.ensure();
    var arr = FA.arr();
    if (!arr.length) return null;
    var C = GAME.DATA.CALENDAR || {};
    var spm = (C.secPerYear || 57600) / 12;          /* 游戏秒/月 */
    var month = Math.floor(((st.world && st.world.elapsed) || 0) / spm);
    if (month === st.factions.lastMonth) return null;
    var first = st.factions.lastMonth < 0;
    st.factions.lastMonth = month;
    if (first) return null;                          /* 第一次只记基准，不推进 */
    var c = cfg();
    /* v144.5（B2「打」）：**宣战中的势力按月真的来犯** ——
       每场落在一座**最近的我方城**上，走既有入侵结算（真战斗，非播报）。
       与「定期来袭」共用同一个结算出口 GAME.invasionResolve；
       宣战期内在 `tick` 这里额外触发，避免改 invasionTick 的时间轮口径。 */
    var _warHits = [];
    if (GAME.invasionResolve && GAME.invasionAcceptOn && GAME.invasionAcceptOn()) {
      arr.forEach(function (f) {
        if (!FA.isAtWar(f.id)) return;
        var fdef = FA.defOf(f.id) || {};
        var cities = (GAME.city && GAME.city.all ? GAME.city.all() : []);
        var best = null, bd = 1e9, sp0 = SP();
        cities.forEach(function (cc) {
          if (!cc || cc.ci == null || !sp0 || !sp0.distOf) return;
          var dd = sp0.distOf({ ci: f.core }, { ci: cc.ci });
          if (dd < bd) { bd = dd; best = cc; }
        });
        if (!best) return;
        /* 只有"够得着"才出征（半径 14 + 6 格机动） */
        if (!(bd <= (f.r || 2) + 6)) {
          GAME.log.war('⚔ ' + (fdef.name || f.id) + ' 宣战了，但它在 ' + Math.round(bd) + ' 格外 —— 这一月没能出发。');
          return;
        }
        try {
          var _slot = GAME.invasionSlotOf ? GAME.invasionSlotOf(GAME.realNow()) : 0;
          var _det = GAME.invasionResolve(best, (fdef.name || f.id), _slot + 900);
          _warHits.push({ fid: f.id, city: best.name, held: !!(_det && _det.held) });
          /* 战果回写它的版图（与定期来袭同一出口） */
          if (GAME.faction.onInvasionResult) GAME.faction.onInvasionResult(f.id, !!(_det && _det.held));
        } catch (e) { /* 单场异常不影响月度推进 */ }
      });
    }
    arr.forEach(function (f) {
      /* v93.6：**它想干什么，决定它长多快**。
         以前四家一段代码、一个速率；现在"集结"真的比"推进"快，
         "绕着你走"真的几乎不涨 —— 否则 intent 只是面板上的一句话。 */
      var it = FA.intentOf(f.id);
      if (it.id === 'ally' || it.id === 'truce') return;   /* 盟友 / 收了钱的，不动 */
      var d = FA.defOf(f.id) || {};
      var pm = FA.personaOf(f.id);
      var mul = pm.expandMul;
      if (it.id === 'hunt') mul = pm.huntMul;
      else if (it.id === 'avoid') mul = 0.15;              /* 怕你：几乎不往这边推 */
      else if (it.id === 'fortify') mul = 0.35;            /* 守成：修墙比扩地重要 */
      /* v92.8：年景（B5）—— 战年军阀并起，推进翻倍。 */
      var g = (c.growPerMonth || 0.8) * (d.aggr || 1) * (GAME.yearMulOf ? GAME.yearMulOf('factionMul') : 1) * mul;
      f.r = Math.min(c.maxR || 14, Math.round((f.r + g) * 100) / 100);
    });
    /* v92.17：**互战** —— 每 clashEveryMonths 个月，领地相交的两家打一场。
       领地相交的判据用球面距离 vs 双方半径和（与 controlOf 同一把尺）。
       盟友不参战；停战中的也不参战（拿了钱的不能转头就打）。 */
    /* v92.20（B5 补完）：**战年互战加剧** —— 文档 B5 原文就写了"军阀年势力互战率×3"。
       用"缩短间隔"表达：战年 clashMul=0.34 → 每 3 个月一场变成每月一场。
       这是年景唯一影响"互战"的地方，不动年景映射本身。 */
    var every = (c.clashEveryMonths || 3) * (GAME.yearMulOf ? GAME.yearMulOf('clashMul') : 1);
    every = Math.max(1, Math.round(every));
    var out = { month: month, clashes: [] };
    if (every > 0 && month % every === 0) {
      var sp = SP();
      for (var i2 = 0; i2 < arr.length; i2++) {
        for (var j2 = i2 + 1; j2 < arr.length; j2++) {
          var A = arr[i2], B2 = arr[j2];
          if (FA.isAlly(A.id) || FA.isAlly(B2.id)) continue;
          if (FA.truceLeft(A.id) > 0 || FA.truceLeft(B2.id) > 0) continue;
          if (!sp || !sp.distOf) continue;
          var dd = sp.distOf({ ci: A.core }, { ci: B2.core });
          if (dd > A.r + B2.r) continue;         /* 领地不相交，打不起来 */
          var rs = FA._clash(A.id, B2.id);
          if (rs) out.clashes.push(rs);
        }
      }
      if (out.clashes.length && GAME.log && GAME.log.war) {
        out.clashes.forEach(function (x) { GAME.log.war('⚔ ' + x.msg); });
      }
    }
    out.war = _warHits;
    return out;
  };

  /* ============================================================
   * v92.11（B2 之一：纳贡）—— 交钱换时间
   * ------------------------------------------------------------
   * 打不过、又不想它继续长：付一笔保护费，换它停几个月。
   * 定价随半径走（越大越贵），所以"养虎为患"是有代价的。
   * ⚠️ 目前只有这一种"外交"。打/盟/挑 都要先有战斗接入 ——
   *    没有战斗的结盟只是播报，是假动作，这一版不做。
   * ============================================================ */
  FA.monthNow = function () {
    var C = GAME.DATA.CALENDAR || {};
    var spm = (C.secPerYear || 57600) / 12;
    var st = GAME.state || {};
    return Math.floor(((st.world && st.world.elapsed) || 0) / spm);
  };

  FA.tributeCostOf = function (fid) {
    var arr = FA.arr(), f = null;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === fid) f = arr[i];
    if (!f) return null;
    var per = cfg().tributePerR || { grain: 200, iron: 100 };
    /* v93.1：你是什么人，价钱不一样 —— 屠夫要先付（他们不信你会守约），
       仁名可以少付（他们赌你不会反悔）。这是名声在"外交"上的唯一落点。 */
    var _pm = (GAME.renown && GAME.renown.priceMul) ? GAME.renown.priceMul() : 1;
    return {
      grain: Math.max(100, Math.round((per.grain || 200) * f.r * _pm)),
      iron: Math.max(50, Math.round((per.iron || 100) * f.r * _pm))
    };
  };

  /* 还在停战期吗（剩几个月） */
  FA.truceLeft = function (fid) {
    var t = ((GAME.state || {}).truces || {})[fid] | 0;
    var m = FA.monthNow();
    return t > m ? (t - m) : 0;
  };

  FA.tribute = function (fid) {
    var st = GAME.state;
    if (!st) return { ok: false, msg: '无存档' };
    FA.ensure();
    var def = FA.defOf(fid);
    if (!def) return { ok: false, msg: '没有这家势力' };
    if (FA.truceLeft(fid) > 0) return { ok: false, msg: '还在停战期内（还剩 ' + FA.truceLeft(fid) + ' 个月）' };
    var cost = FA.tributeCostOf(fid);
    if (!cost) return { ok: false, msg: '这家已经不在了' };
    var city = GAME.currentCity ? GAME.currentCity() : null;
    if (!city) return { ok: false, msg: '没有可支付的城市' };
    city.res = city.res || {};
    if ((city.res.grain || 0) < cost.grain) return { ok: false, msg: '粮不够：要 ' + U.numText(cost.grain, 0) };
    if ((city.res.iron || 0) < cost.iron) return { ok: false, msg: '铁不够：要 ' + U.numText(cost.iron, 0) };
    city.res.grain -= cost.grain;
    city.res.iron -= cost.iron;
    st.truces = st.truces || {};
    var months = cfg().truceMonths || 6;
    st.truces[fid] = FA.monthNow() + months;
    FA.remember(fid, 'tribute');          /* v93.6：给钱，它记你的好（也只记钱）*/
    return { ok: true, msg: '向' + def.name + '纳贡：粮 −' + U.numText(cost.grain, 0)
      + '、铁 −' + U.numText(cost.iron, 0) + '，换它 ' + months + ' 个月不动' };
  };

  /* v92.12（A8）：这一家你见过没有 —— 以"它的核心格是否已探明"为准。
     为什么用核心格：那是它的老巢，探到才知道是谁；只在外围晃过不算。 */
  FA.knownOf = function (fid) {
    var arr = FA.arr();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id !== fid) continue;
      if (!GAME.fog) return true;                 /* 没有迷雾系统时退回"全都知道" */
      return GAME.fog.get(arr[i].core) > 0;
    }
    return false;
  };

  /* ============================================================
   * v92.16（B1 补完）：**势力核心可以打**
   * ------------------------------------------------------------
   * 之前势力只会长、能纳贡 —— 你拿它没办法。它的核心格现在是
   * 一个**可以讨伐的目标**：守军按该家半径算（越大越难打），
   * 打赢了它的半径腰斩（r × 0.5，保底 2）—— 这就是"打回去"的实感。
   *
   * 刻意**不做灭家**：`stats`/面板按"四家"写死，突然少一家会让 UI 空一块。
   * 削到 r=2 它基本退回老巢，威胁解除，但世界还完整 ——
   * 这比"打进数组删元素"安全得多，也不会让存档出现半截状态。
   * ============================================================ */
  FA.coreAt = function (ci) {
    var arr = FA.arr();
    if (ci == null || ci < 0) return null;
    for (var i = 0; i < arr.length; i++) if (arr[i].core === ci) return arr[i].id;
    return null;
  };

  /* 核心守军：按半径线性放大 —— r=2 约 2.3k，r=14 约 8.8k（一座大城的量级）*/
  FA.coreGarrisonOf = function (fid) {
    var arr = FA.arr(), f = null;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === fid) f = arr[i];
    if (!f) return null;
    var d = FA.defOf(fid) || {};
    var base = Math.round(1200 * (1 + f.r * 0.45) * (0.9 + (d.aggr || 1) * 0.1));
    var army = { buxingji: Math.round(base * 0.55), dunwei: Math.round(base * 0.25), paoshou: Math.round(base * 0.2) };
    var total = 0;
    for (var k in army) { if (army[k] <= 0) delete army[k]; else total += army[k]; }
    return { army: army, total: total, gen: FA.rivalOf(fid), r: f.r };
  };

  /* 讨伐得手：半径腰斩，保底 2 */
  FA.onRaidWin = function (fid) {
    var arr = FA.arr(), f = null;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === fid) f = arr[i];
    if (!f) return null;
    var before = f.r;
    f.r = Math.max(2, Math.round((f.r * 0.5) * 100) / 100);
    f.hit = (f.hit || 0) + 1;
    /* v93.6：它记住了（恨 + 怕），**其余各家也看见了**（怕） */
    FA.remember(fid, 'raidWin');
    FA.witnessed(fid);
    var d = FA.defOf(fid) || {};
    /* v98：**削到保底 2 = 这家被你打散了** —— 这是终局三条件之一
       （"打掉一家势力核心"）。只在"刚到 2"的那一次记一次，别反复刷。 */
    if (before > 2 && f.r <= 2 && GAME.ending && GAME.ending.onFactionDown) {
      GAME.ending.onFactionDown();
    }
    return {
      before: before, after: f.r,
      msg: '攻破' + (d.name || fid) + ' 的核心：它的势力范围从 ' + before + ' 缩到 ' + f.r + ' 格'
    };
  };

  /* ============================================================
   * v92.17（B2 补完：挑 / 盟 / 互战）
   * ------------------------------------------------------------
   * 文档 B2 的四种用法：打 / 贡 / 盟 / 挑。
   *   · 打 —— v92.16（核心可讨伐）✅
   *   · 贡 —— v92.11（交钱换 6 个月）✅
   *   · 挑 —— 本节：花一笔钱让两家立刻开打，它们耗掉的是彼此的半径 ✅
   *   · 盟 —— 本节：花更大一笔换 12 个月不扩张；与"贡"的区别是**长期**
   *   · 互战 —— 每月自动判定：领地相交的两家按半径掷骰，强者进、弱者退
   *
   * 全是态势层的账（改 `arr[i].r`），**不碰战斗引擎**。
   * 玩家的收益不是"抢到什么"，而是"看着它们互相消耗" ——
   * 这正是文档里"挑：让 A 打 B，收渔利"那句话。
   * ============================================================ */
  FA.isAlly = function (fid) {
    var a = ((GAME.state || {}).allies) || {};
    return (a[fid] | 0) > FA.monthNow();
  };
  FA.allyLeft = function (fid) {
    var a = ((GAME.state || {}).allies) || {};
    var t = a[fid] | 0;
    var m = FA.monthNow();
    return t > m ? (t - m) : 0;
  };

  FA.ally = function (fid) {
    var st = GAME.state;
    if (!st) return { ok: false, msg: '无存档' };
    FA.ensure();
    var def = FA.defOf(fid);
    if (!def) return { ok: false, msg: '没有这家势力' };
    if (FA.isAlly(fid)) return { ok: false, msg: '已经是盟友了（还剩 ' + FA.allyLeft(fid) + ' 个月）' };
    var cost = cfg().allyCost || { grain: 6000, iron: 3000 };
    var city = GAME.currentCity ? GAME.currentCity() : null;
    if (!city) return { ok: false, msg: '没有可支付的城市' };
    city.res = city.res || {};
    if ((city.res.grain || 0) < cost.grain) return { ok: false, msg: '粮不够：要 ' + U.numText(cost.grain, 0) };
    if ((city.res.iron || 0) < cost.iron) return { ok: false, msg: '铁不够：要 ' + U.numText(cost.iron, 0) };
    city.res.grain -= cost.grain;
    city.res.iron -= cost.iron;
    st.allies = st.allies || {};
    var months = cfg().allyMonths || 12;
    st.allies[fid] = FA.monthNow() + months;
    FA.remember(fid, 'ally');             /* v93.6：盟约比纳贡重得多 */
    return { ok: true, msg: '与' + def.name + '结盟：粮 −' + U.numText(cost.grain, 0)
      + '、铁 −' + U.numText(cost.iron, 0) + '，它 ' + months + ' 个月不再扩张' };
  };

  /* ============================================================
   * v144.5（B2「打」）：**宣战** —— 从态势层升级为真正的战争
   * ------------------------------------------------------------
   * 面板原话是「目前只影响态势与警报 —— 尚未接入战斗」。现在接入：
   *   · 宣战 = 花军费，把这家对你的「怨」顶到 warGrudge（高于 persona.huntAt 才可能集结）；
   *   · 之后每月 `tick` 的集结判定会真的派远征军来打你**最近的城**
   *     （入侵通道是既有的 `GAME.invasionResolve` → 真战斗，不是播报）；
   *   · 有冷却（warCdMonths），不会无限重开。
   * ============================================================ */
  FA.isAtWar = function (fid) {
    var w = ((GAME.state || {}).factionWar) || {};
    return (w[fid] | 0) > FA.monthNow();
  };
  FA.warLeft = function (fid) {
    var w = ((GAME.state || {}).factionWar) || {};
    var t = w[fid] | 0, m = FA.monthNow();
    return t > m ? (t - m) : 0;
  };
  FA.declareWar = function (fid) {
    var st = GAME.state;
    if (!st) return { ok: false, msg: '无存档' };
    FA.ensure();
    var def = FA.defOf(fid);
    if (!def) return { ok: false, msg: '没有这家势力' };
    if (FA.isAtWar(fid)) return { ok: false, msg: '已经在交战（剩 ' + FA.warLeft(fid) + ' 个月）' };
    var city = GAME.currentCity ? GAME.currentCity() : null;
    if (!city) return { ok: false, msg: '没有可支付的城市' };
    var cost = cfg().warCost || { grain: 4000, iron: 2000, gold: 20000 };
    var R = GAME.res(city);
    if ((R.grain || 0) < cost.grain) return { ok: false, msg: '粮不够：要 ' + U.numText(cost.grain, 0) };
    if ((R.iron || 0) < cost.iron) return { ok: false, msg: '铁不够：要 ' + U.numText(cost.iron, 0) };
    if ((st.res.gold || 0) < cost.gold) return { ok: false, msg: '旧币不够：要 ' + U.numText(cost.gold, 0) };
    if (GAME.city && GAME.city.sub) { GAME.city.sub(city, 'grain', cost.grain); GAME.city.sub(city, 'iron', cost.iron); }
    if (GAME.goldAdd) GAME.goldAdd(-cost.gold);
    st.factionWar = st.factionWar || {};
    var months = cfg().warCdMonths || 6;
    st.factionWar[fid] = FA.monthNow() + months;
    /* 把怨顶到开战线（三数增量：怨涨、信跌）—— 走既有的 standingOf 三数 */
    var _st = FA.standingOf(fid);
    _st.g = Math.max(0, Math.min(100, (_st.g | 0) + (cfg().warGrudge || 55)));
    _st.t = Math.max(0, Math.min(100, (_st.t | 0) - 30));
    GAME.log.war('⚔ 向' + def.name + '宣战：粮 −' + U.numText(cost.grain, 0)
      + '、铁 −' + U.numText(cost.iron, 0) + '、旧币 −' + U.numText(cost.gold, 0)
      + '。他们会按月集结，来打你最近的城。');
    return { ok: true, msg: '已向' + def.name + '宣战（' + months + ' 个月内它会陆续来犯）' };
  };

  /* 一场互战：按半径掷骰，强者进、弱者退。返回战果（便于播报与测试） */
  FA._clash = function (aId, bId) {
    var arr = FA.arr();
    var A = null, B = null;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === aId) A = arr[i];
      if (arr[i].id === bId) B = arr[i];
    }
    if (!A || !B || A === B) return null;
    var sa = A.r * (1 + (FA.defOf(A.id) || {}).aggr * 0.3);
    var sb = B.r * (1 + (FA.defOf(B.id) || {}).aggr * 0.3);
    var roll = GAME.invasionRoll ? GAME.invasionRoll('clash|' + aId + '|' + bId + '|' + FA.monthNow()) : 0.5;
    var aWins = (sa / (sa + sb)) > roll;
    var gain = cfg().clashGain || 0.35;
    if (FA.isFeud(aId, bId)) gain *= (cfg().feudMul || 1.6);   /* v93.6：世仇打得更狠 */
    var win = aWins ? A : B, lose = aWins ? B : A;
    win.r = Math.min(cfg().maxR || 14, Math.round((win.r + gain) * 100) / 100);
    lose.r = Math.max(2, Math.round((lose.r - gain) * 100) / 100);
    var wn = ((FA.defOf(win.id) || {}).name || win.id);
    var ln = ((FA.defOf(lose.id) || {}).name || lose.id);
    return { winner: win.id, loser: lose.id,
      msg: wn + ' 与 ' + ln + ' 交兵：' + wn + ' 进（r ' + win.r + '），' + ln + ' 退（r ' + lose.r + '）' };
  };

  /* 挑拨：花钱让两家立刻打一场 */
  /* v93.6：**世仇** —— 它们之间的账，与你无关。
     四家不是互相等价的关系：铁砧要推平灰墙的墙，焰誓要烧商盟的货栈。
     有世仇的两家打起来更狠（半径变化 ×feudMul），也更频繁（见 tick 的对手挑选）。 */
  FA.isFeud = function (aId, bId) {
    var da = FA.defOf(aId);
    if (!da || !da.rivals) return false;
    return da.rivals.indexOf(bId) >= 0;
  };

  FA.incite = function (aId, bId) {
    var st = GAME.state;
    if (!st) return { ok: false, msg: '无存档' };
    if (!aId || !bId || aId === bId) return { ok: false, msg: '要挑两家' };
    var da = FA.defOf(aId), db = FA.defOf(bId);
    if (!da || !db) return { ok: false, msg: '没有这两家' };
    if (FA.isAlly(aId) || FA.isAlly(bId)) return { ok: false, msg: '盟友不参与挑拨' };
    var cost = cfg().clashCost || { grain: 3000, iron: 1500 };
    var city = GAME.currentCity ? GAME.currentCity() : null;
    if (!city) return { ok: false, msg: '没有可支付的城市' };
    city.res = city.res || {};
    if ((city.res.grain || 0) < cost.grain) return { ok: false, msg: '粮不够：要 ' + U.numText(cost.grain, 0) };
    if ((city.res.iron || 0) < cost.iron) return { ok: false, msg: '铁不够：要 ' + U.numText(cost.iron, 0) };
    city.res.grain -= cost.grain;
    city.res.iron -= cost.iron;
    var res = FA._clash(aId, bId);
    if (!res) return { ok: false, msg: '挑拨失败（这两家打不起来）' };
    return { ok: true, msg: '挑拨得手：' + res.msg };
  };

  /* 挑拨的自动配对：与它最近的那一家。
     为什么自动配：挑拨要选两家，做成两个下拉会让面板臃肿；
     而"打你最近的邻居"本来就是挑拨最常用的形态。 */
  FA.nearestOtherOf = function (fid) {
    var sp = SP(), arr = FA.arr();
    var me = null;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === fid) me = arr[i];
    if (!me || !sp || !sp.distOf) return null;
    var best = null, bd = 1e9;
    for (var j = 0; j < arr.length; j++) {
      if (arr[j].id === fid) continue;
      var d = sp.distOf({ ci: me.core }, { ci: arr[j].core });
      if (d < bd) { bd = d; best = arr[j]; }
    }
    return best ? best.id : null;
  };

  /* ============================================================
   * v92.21（A7 安全版：**点亮即暴露**）
   * ------------------------------------------------------------
   * 文档 A7：「你点亮一格，附近的东西也会注意到你」。
   * 但 NPC 不侦查，做成"随机事件"就是赌博 —— 换一个**确定**的版本：
   *   **你在它领地内打赢一场，它就会警惕起来**（半径 +0.15，最多触发 5 次）。
   *
   * 为什么是"打赢"而不是"进入"：
   *   · 进入领地就暴露 = 玩家连路过都不敢，是惩罚；
   *   · 打赢才惊动 = "动手是有代价的"，且这个代价可预判（你知道打它会涨）。
   * 上限 5 次，避免"打一次涨一次"把世界提前吃满。
   * ============================================================ */
  FA.alarmBy = function (fid) {
    var arr = FA.arr(), f = null;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === fid) f = arr[i];
    if (!f) return null;
    var n = f.alarm | 0;
    if (n >= 5) return null;                        /* 惊动够了，不再涨 */
    f.alarm = n + 1;
    var before = f.r;
    f.r = Math.min(cfg().maxR || 14, Math.round((f.r + 0.15) * 100) / 100);
    var d = FA.defOf(fid) || {};
    return { before: before, after: f.r, n: f.alarm,
      msg: (d.name || fid) + ' 因你在它地盘上动兵而警觉：势力范围 ' + before + ' → ' + f.r };
  };

  /* ============================================================
   * v92.24（世界级反馈）：**谁在打你**
   * ------------------------------------------------------------
   * 原系统每 30 分钟来一场入侵，来源是 `DATA.INVASION.sources` 里的固定字符串
   * （"敌军"）。强度只跟**玩家自己**的战力成正比 —— 那是"系统定期刷怪"，
   * 不是"世界在反击"：你打不打它、它长多大，都不影响谁来找你。
   *
   * 现在改三处，让战争有因果：
   *   ① 来源 = **领地压到你这座城的那家势力**（没有势力压到 → 退回旧逻辑）；
   *   ② 强度 × (1 + r·0.04) —— 它版图越大，远征越凶；
   *   ③ 战果回写它的半径：你顶住了它受挫（−0.3），它打赢了版图扩张（+0.3）。
   * ============================================================ */
  FA.attackerOf = function (city) {
    if (!city || !GAME.faction) return null;
    var ci = city.ci;
    if (ci == null || ci < 0) return null;
    var fid = FA.controlOf(ci);
    if (!fid) return null;
    var def = FA.defOf(fid);
    return def ? def.name : null;
  };
  /* 该城的势力攻击者（供强度与战果回写用；没有 → null） */
  FA.attackerIdOf = function (city) {
    if (!city || !GAME.faction) return null;
    var ci = city.ci;
    if (ci == null || ci < 0) return null;
    return FA.controlOf(ci);
  };
  /* 战果回写：守住了 → 它受挫；被破了 → 它扩张 */
  FA.onInvasionResult = function (fid, held) {
    var arr = FA.arr(), f = null;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === fid) f = arr[i];
    if (!f) return null;
    var d = FA.defOf(fid) || {};
    var before = f.r;
    f.r = held
      ? Math.max(2, Math.round((f.r - 0.3) * 100) / 100)
      : Math.min(cfg().maxR || 14, Math.round((f.r + 0.3) * 100) / 100);
    /* v93.6：打赢它，它更恨你也更怕你；它打赢你，它觉得你没那么可怕 */
    FA.remember(fid, held ? 'invasionHeld' : 'invasionBroke');
    return { before: before, after: f.r, held: !!held,
      msg: held
        ? ('你顶住了' + (d.name || fid) + ' 的远征：它的版图从 ' + before + ' 缩到 ' + f.r)
        : ((d.name || fid) + ' 攻破了你的城防：它的版图从 ' + before + ' 扩到 ' + f.r) };
  };

  /* 态势：每家半径、约格数（六边面积 ≈ 3r²）、离玩家主城多少格 */
  FA.stats = function () {
    var s = SP(), arr = FA.arr();
    var pc = GAME.currentCity ? GAME.currentCity() : null;
    return arr.map(function (f) {
      var d = FA.defOf(f.id) || {};
      var near = (pc && pc.ci >= 0) ? s.distOf({ ci: pc.ci }, { ci: f.core }) : null;
      return {
        id: f.id, name: d.name || f.id, trait: d.trait || '',
        r: f.r, cells: Math.round(3 * f.r * f.r), near: near,
        truce: FA.truceLeft(f.id),
        ally: FA.allyLeft(f.id),
        /* v93.6：**它现在想干什么** —— 面板最该显示的不是半径，是意图 */
        intent: FA.intentOf(f.id),
        stand: FA.standingOf(f.id),
        persona: FA.personaOf(f.id).name,
        word: d.line || '',
        /* v92.23：惊动次数（在它地盘上动过几次兵）—— 玩家要能看见"它为什么变凶了" */
        alarm: f.alarm | 0,
        /* v92.12（A8「迷雾里的势力」）：**没探明它的核心，就不知道它是谁**。
           以前这里白给"距你 32 格"——势力面板成了全能雷达。
           现在：核心未探明 → unknown，界面上是「？？？」。 */
        known: FA.knownOf(f.id)
      };
    }).sort(function (a, b) { return (a.near == null ? 1e9 : a.near) - (b.near == null ? 1e9 : b.near); });
  };

  /* 逼近警报：最近的一家进入 warnAt 格内 → 返回它（UI 每帧节流调用即可） */
  FA.threatOf = function () {
    var st = GAME.state;
    if (!st) return null;
    var warn = cfg().warnAt || 8;
    var s2 = FA.stats();
    for (var i = 0; i < s2.length; i++) {
      /* v92.12（A8）：不知道是谁，就给不出"某某逼近"的警报 */
      if (s2[i].known === false) continue;
      if (s2[i].near != null && s2[i].near <= warn) return s2[i];
    }
    return null;
  };

  /* 一行文字（面板与战报共用，避免两处措辞不一致） */
  /* ============================================================
   * v93.6：**恩怨账** —— 它们记得你做过什么
   * ------------------------------------------------------------
   * 三个数（0~100），可以同时很高：
   *   g 怨恨 · f 畏惧 · t 信任
   * 一个"又恨又怕你"的家会绕着你走；一个"又恨又不怕你"的家会来打你。
   * 只用一个数（比如"好感度"）表达不了这件事 —— 那正是原来四个数值的问题。
   *
   * ⚠️ 刻意**不衰减**：做过的事不会因为时间过去就变淡（与名声同一条尺子）。
   *    想改善只有一条路：给它钱、跟它结盟、或者把它打怕。
   * ============================================================ */
  FA.standingOf = function (fid) {
    var arr = FA.arr();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id !== fid) continue;
      if (!arr[i].standing) arr[i].standing = { g: 0, f: 0, t: 0 };
      return arr[i].standing;
    }
    return { g: 0, f: 0, t: 0 };
  };

  /* 它记住了一件事。kind 见 DATA.FACTION.standing */
  FA.remember = function (fid, kind) {
    var w = (cfg().standing || {})[kind];
    if (!w) return null;
    var st = FA.standingOf(fid);
    st.g = Math.max(0, Math.min(100, (st.g | 0) + (w.g || 0)));
    st.f = Math.max(0, Math.min(100, (st.f | 0) + (w.f || 0)));
    st.t = Math.max(0, Math.min(100, (st.t | 0) + (w.t || 0)));
    return st;
  };

  /* 你打了某一家 → **其余各家都看见了**（杀鸡儆猴）。
     这是"世界在看着你"的具体形状：不是所有家都恨你，但它们都开始怕你。 */
  FA.witnessed = function (exceptId) {
    var arr = FA.arr();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === exceptId) continue;
      FA.remember(arr[i].id, 'witness');
    }
  };

  FA.personaOf = function (fid) {
    var d = FA.defOf(fid) || {};
    var P = (cfg().persona || {});
    return P[d.persona] || P.raider || { name: '掠夺', huntAt: 45, avoidAt: 70, expandMul: 1, huntMul: 1.5, note: '' };
  };

  /* ============================================================
   * FA.intentOf —— **它下一步想干什么**
   * ------------------------------------------------------------
   * 这是整个模块唯一真正重要的出口：不是"它有多少半径"，
   * 是"它打算拿这个半径做什么"。玩家要能读到这个。
   *
   * 返回 { id, name, note, because }
   *   ally / truce  —— 现在不会动你（原因写清楚）
   *   trade         —— 逐利的，永远想做生意
   *   avoid         —— 怕你，绕着你走（半径几乎不涨）
   *   hunt          —— 恨你且不怕你，集结（半径涨得快）
   *   fortify       —— 守成的，恨你但不出去（扩得慢）
   *   expand        —— 默认：往前推
   * ============================================================ */
  FA.intentOf = function (fid) {
    var st = FA.standingOf(fid);
    var pm = FA.personaOf(fid);
    var d = FA.defOf(fid) || {};
    if (FA.isAlly(fid)) return { id: 'ally', name: '盟友', because: '你给了它粮，它现在不动你', note: '按兵不动' };
    var tl = FA.truceLeft(fid);
    if (tl > 0) return { id: 'truce', name: '收了钱', because: '纳贡换来的 ' + tl + ' 个月', note: '按兵不动' };
    if ((d.persona || '') === 'trader') {
      return { id: 'trade', name: '做生意', because: '它不打仗，它买', note: '想要你的粮和铁' };
    }
    if (st.f >= pm.avoidAt) {
      return { id: 'avoid', name: '绕着你走', because: '它怕你（畏惧 ' + Math.round(st.f) + '）', note: '不敢往你这边推' };
    }
    if (st.g >= pm.huntAt) {
      return { id: 'hunt', name: '集结', because: '它恨你（怨恨 ' + Math.round(st.g) + '）', note: '正在纠集人手' };
    }
    if ((d.persona || '') === 'holder' && st.g >= 20) {
      return { id: 'fortify', name: '加固', because: '它恨你，但它不出去', note: '在修墙' };
    }
    return { id: 'expand', name: '推进', because: '还没注意到你', note: '往外扩' };
  };

  FA.lineOf = function (x) {
    if (!x) return '';
    return x.name + '（' + x.trait + '）· 半径 ' + x.r + ' ≈ ' + U.numText(x.cells, 0) + ' 格'
      + (x.near != null ? (' · 距你 ' + Math.round(x.near) + ' 格') : '');
  };
})();
