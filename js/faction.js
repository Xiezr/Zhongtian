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

  function SP() { return GAME.mapSphere || GAME.sphere; }
  function cfg() { return (GAME.DATA && GAME.DATA.FACTION) || {}; }

  /* 纯哈希（只吃 ci + seed）：同一颗球，四家的位置永远一样 */
  function h(ci, salt) {
    var x = (ci * 2654435761 + salt * 40503) >>> 0;
    x ^= x >>> 13; x = (x * 1274126177) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /* 挑 4 个核心：彼此至少 55 格、离玩家主城至少 25 格（别一开局就贴脸） */
  function pickCores(sd, s, n) {
    var out = [], tries = 0, total = s.cells.length;
    var pc = GAME.currentCity ? GAME.currentCity() : null;
    while (out.length < n && tries < 30000) {
      var ci = Math.floor(h(tries++, sd + 4401) * total) % total;
      var cell = s.cells[ci];
      if (!cell || cell.type === 'sea' || cell.type === 'ocean') continue;
      var ok = true;
      for (var i = 0; i < out.length; i++) {
        if (s.distOf({ ci: out[i] }, { ci: ci }) < 55) { ok = false; break; }
      }
      if (!ok) continue;
      if (pc && pc.ci >= 0 && s.distOf({ ci: pc.ci }, { ci: ci }) < 25) continue;
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
    arr.forEach(function (f) {
      if (FA.truceLeft(f.id) > 0) return;         /* v92.11：纳贡期内停手 */
      var d = FA.defOf(f.id) || {};
      /* v92.8：年景（B5）—— 战年军阀并起，推进翻倍。 */
      var g = (c.growPerMonth || 0.8) * (d.aggr || 1) * (GAME.yearMulOf ? GAME.yearMulOf('factionMul') : 1);
      f.r = Math.min(c.maxR || 14, Math.round((f.r + g) * 100) / 100);
    });
    return { month: month };
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
    return {
      grain: Math.max(100, Math.round((per.grain || 200) * f.r)),
      iron: Math.max(50, Math.round((per.iron || 100) * f.r))
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
    return { ok: true, msg: '向' + def.name + '纳贡：粮 −' + U.numText(cost.grain, 0)
      + '、铁 −' + U.numText(cost.iron, 0) + '，换它 ' + months + ' 个月不动' };
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
        truce: FA.truceLeft(f.id)
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
      if (s2[i].near != null && s2[i].near <= warn) return s2[i];
    }
    return null;
  };

  /* 一行文字（面板与战报共用，避免两处措辞不一致） */
  FA.lineOf = function (x) {
    if (!x) return '';
    return x.name + '（' + x.trait + '）· 半径 ' + x.r + ' ≈ ' + U.numText(x.cells, 0) + ' 格'
      + (x.near != null ? (' · 距你 ' + Math.round(x.near) + ' 格') : '');
  };
})();
