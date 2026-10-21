/* ============================================================
 * fog.js — 探明度（迷雾）
 * ------------------------------------------------------------
 * 老板：「远征带给我另一个角度的思考 —— 全图开放缺探索」。
 *
 * 这个游戏的地图从开局就是**全亮**的：40962 格地形、每座城、
 * 每块野地的等级，玩家一眼看尽。于是「远征」只剩下算最优路线，
 * 没有「发现」—— 没有哪一趟是因为"我想知道那边有什么"而出发的。
 *
 * 本模块补的是**信息**，不是地形：
 *   0 未探明 —— 连地形都不知道（地图上是一团雾，点不开）
 *   1 半明   —— 见过地形，不知道上面有什么（野地等级/守军/据点）
 *   2 全明   —— 地形 + 内容都知道（扎过营 / 侦查过 / 打下来过）
 *
 * ⚠️ 只加一档「未知」，不加新的资源或次数限制 ——
 *    已有 stamina（体力）/ energy（精力）/ 载重 三条约束，
 *    再加一条只会让出征变成"凑够几个数才准出门"。
 *    迷雾的作用是让「去哪」重新变成一个要判断的问题，
 *    而不是让「能不能出门」变成一道算术题。
 *
 * ⚠️ 与既有「侦查」的分工（battle.scoutTarget 已有分层情报）：
 *    迷雾决定**你知不知道这块地上有没有东西**；
 *    侦查决定**你知不知道那东西有多强**。
 *    迷雾是侦查的前置档，不是替代品 —— 所以这里不动 scoutTarget。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var F = GAME.fog = {};

  var NONE = 0, TERRAIN = 1, ALL = 2;
  F.NONE = NONE; F.TERRAIN = TERRAIN; F.ALL = ALL;

  /* 每格 2 bit（0 未探明 / 1 半明 / 2 全明）。
     ⚠️ 但**不按定长 bitset 存**：40962×2bit 的 base64 恒为 13.6KB，
     会把存档从 5KB 直接撑到 18.7KB —— 项目有一条「存档 < 10KB」的守门断言，
     而且自动存档每 20 分钟写一次 localStorage，5MB 配额经不起这么花。
     实际用 RLE：迷雾是**成团**的（开局一整个黑球 + 主城一个亮斑），
     开局约 60 字节，全图探明约 12 字节，中期边界锯齿也就一两 KB。 */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  /* ============================================================
   * 格数 / 种子 —— **以地图球面为准**
   * ------------------------------------------------------------
   * 本项目是双球面：GAME.sphere = 城池所在星球（逻辑），
   * GAME.mapSphere = 地图正在看的星球（渲染）。
   * 迷雾的 ci 必须与 map3d 的 SP.faceCell **同一套索引**，否则
   * 拿逻辑球面的 nv 去查地图球面的 ci，全越界 → get 恒返回 0 → 整球全黑。
   * （实测就是这个：进地图后一颗黑球，探明度却是 10%。）
   * ============================================================ */
  function nv() {
    var ms = GAME.mapSphere, sp = GAME.sphere;
    var n = (ms && ms.nv) || (sp && sp.nv) || 0;
    return n | 0;
  }
  function seedNow() {
    var ms = GAME.mapSphere;
    if (ms && ms.seed3) { try { return ms.seed3() | 0; } catch (e) { /* 内核未建 */ } }
    var st = GAME.state;
    return ((st && st.map && st.map.seed) || 0) | 0;
  }

  var _pack = null;      /* Uint8Array */
  var _n = 0;            /* 建包时的格数 */
  var _seed = -1;        /* 建包时的星球种子 */
  var _sig = '';         /* 星球签名（seed:格数）—— 换星球/换种子必须重建 */
  var _ver = 0;          /* 变化版本号：渲染层据此判断要不要重画雾层 */
  var _stat = null;      /* 探索度缓存 */

  /* ---------- base64（自己写：node 下 smoke/e2e 没有 btoa/atob） ---------- */
  function enc(u8) {
    var out = '', i = 0, len = u8.length;
    for (; i + 2 < len; i += 3) {
      var n = (u8[i] << 16) | (u8[i + 1] << 8) | u8[i + 2];
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    var rest = len - i;
    if (rest === 1) {
      var a = u8[i] << 16;
      out += B64[(a >> 18) & 63] + B64[(a >> 12) & 63] + '==';
    } else if (rest === 2) {
      var b = (u8[i] << 16) | (u8[i + 1] << 8);
      out += B64[(b >> 18) & 63] + B64[(b >> 12) & 63] + B64[(b >> 6) & 63] + '=';
    }
    return out;
  }
  function dec(str) {
    if (!str) return null;
    var idx = {}, i;
    for (i = 0; i < B64.length; i++) idx[B64.charAt(i)] = i;
    var clean = String(str).replace(/[^A-Za-z0-9+/]/g, '');
    var len = clean.length, bytes = Math.floor(len * 3 / 4), out = new Uint8Array(bytes), o = 0;
    for (i = 0; i < len; i += 4) {
      var c0 = idx[clean.charAt(i)], c1 = idx[clean.charAt(i + 1)];
      var c2 = i + 2 < len ? idx[clean.charAt(i + 2)] : 0;
      var c3 = i + 3 < len ? idx[clean.charAt(i + 3)] : 0;
      if (c0 === undefined || c1 === undefined) break;
      var n = (c0 << 18) | (c1 << 12) | ((c2 || 0) << 6) | (c3 || 0);
      if (o < bytes) out[o++] = (n >> 16) & 255;
      if (o < bytes) out[o++] = (n >> 8) & 255;
      if (o < bytes) out[o++] = n & 255;
    }
    return out;
  }

  /* ---------- 读写位 ---------- */
  function getRaw(ci) {
    if (!_pack || ci < 0 || ci >= _n) return NONE;
    var i = ci >> 2;
    return (_pack[i] >> ((ci & 3) << 1)) & 3;
  }
  function setRaw(ci, v) {
    if (!_pack || ci < 0 || ci >= _n) return;
    var i = ci >> 2, sh = (ci & 3) << 1;
    _pack[i] = (_pack[i] & ~(3 << sh)) | ((v & 3) << sh);
  }

  F.sigNow = function () { return seedNow() + ':' + nv(); };

  /* 建包 / 换星球时重建。幂等：签名没变就什么都不做。
     ⚠️ 快速路径必须是**三次数值比较**：buildFog 每次重建要遍历 24 万个面片，
     每个面片调一次 get()。若在这里拼 'seed:n' 字符串，光比较就吃掉 40ms+。 */
  F.ensure = function () {
    var n = nv();
    if (!n) return false;
    var sd = seedNow();
    if (_pack && _n === n && _seed === sd) return true;
    var sig = sd + ':' + n;
    var bytes = Math.ceil(n * 2 / 8);
    /* ============================================================
     * 换星球：**先把旧包的探明度存起来**
     * ------------------------------------------------------------
     * 双球面下玩家随时切去看别的星球（mapSphere 换 seed），
     * 如果这里直接丢包，切回来自己家就变回全黑了 ——
     * 探索度是**每颗球各自的经历**，不是"当前打开的那个"。
     * 按 seed 各存一份（RLE 后通常几十字节 ~ 几 KB）。
     * ============================================================ */
    if (_pack && _n && _seed !== sd && _seed >= 0) {
      var stS = GAME.state;
      if (stS) {
        stS.fogBySeed = stS.fogBySeed || {};
        stS.fogBySeed[_seed] = _packData();
      }
    }
    var st = GAME.state;
    var saved = (st && st.fogBySeed && st.fogBySeed[sd]) || (st && st.fog) || null;
    _pack = new Uint8Array(bytes);
    _n = n;
    _seed = sd;
    _sig = sig;
    _stat = null;
    _ver++;
    /* 同一颗星球（seed 相同、格数相同）→ 沿用存档里的探明度；
       换了星球 → 从全黑开始（探索度是**这颗球**的经历，不该跟着人走）。*/
    if (saved && saved.sig === sig && saved.data) {
      var u8 = dec(saved.data);
      if (u8 && u8.length) {
        if (saved.v === 2) _pack = unpackRle(u8, n);
        else if (u8.length === bytes) _pack.set(u8);      /* v1 定长 bitset（兼容）*/
      }
    }
    return true;
  };

  /* RLE 打包。**不调 ensure** —— 换球前快照旧包时不能用会重建自己的 ensure。 */
  function _packData() {
    if (!_pack || !_n) return { v: 2, sig: _sig, n: _n, data: '' };
    var out = [], run = 0, cnt = 0, ci, v;
    for (ci = 0; ci < _n; ci++) {
      v = getRaw(ci);
      if (cnt === 0) { run = v; cnt = 1; }
      else if (v === run && cnt < 255) cnt++;
      else { out.push(run, cnt); run = v; cnt = 1; }
    }
    if (cnt) out.push(run, cnt);
    return { v: 2, sig: _sig, n: _n, data: enc(new Uint8Array(out)) };
  }

  /* RLE 解包：(value, count) 字节对 → 位图 */
  function unpackRle(u8, n) {
    var pack = new Uint8Array(Math.ceil(n * 2 / 8));
    var ci = 0;
    for (var i = 0; i + 1 < u8.length; i += 2) {
      var v = u8[i] & 3, c = u8[i + 1];
      for (var k = 0; k < c && ci < n; k++, ci++) {
        var bi = ci >> 2, sh = (ci & 3) << 1;
        pack[bi] = (pack[bi] & ~(3 << sh)) | (v << sh);
      }
    }
    return pack;
  }

  F.ver = function () { return _ver; };
  F.total = function () { return _n; };

  /* 丢掉内存里的探明度，下次 ensure 重建。
     ⚠️ 必须是独立出口：`state.fog = null` 不足以让 ensure 重建 ——
     快速路径只看 (格数, 种子)，同种子换一局会**沿用上一局的 _pack**。
     新开局 / 读另一个档时必须显式 reset。 */
  F.reset = function () {
    _pack = null; _n = 0; _seed = -1; _sig = ''; _stat = null; _ver++;
  };

  /* 单格探明度（惰性同步 —— 调用方不必关心 ensure 时序） */
  F.get = function (ci) {
    F.ensure();
    return getRaw(ci);
  };

  F.isKnown = function (ci) { return F.get(ci) > NONE; };      /* 至少见过地形 */
  F.isFull = function (ci) { return F.get(ci) >= ALL; };       /* 地形+内容 */

  /* 提升探明度（**只升不降**）。返回 true = 真的变了（渲染层据此重画）。 */
  F.bump = function (ci, v) {
    F.ensure();
    if (ci < 0 || ci >= _n) return false;
    if (getRaw(ci) >= v) return false;
    setRaw(ci, v);
    _stat = null; _ver++;
    return true;
  };

  /* 半径 r 内提升到 v（BFS 走六边邻接 —— 与行军距离同一把尺子） */
  F.revealAround = function (ci, r, v) {
    F.ensure();
    if (!_n || ci < 0 || ci >= _n) return 0;
    v = v == null ? TERRAIN : v;
    var list = (GAME.sphere && GAME.sphere.hopsWithin) ? GAME.sphere.hopsWithin(ci, r) : [ci];
    var hit = 0;
    for (var i = 0; i < list.length; i++) if (F.bump(list[i], v)) hit++;
    return hit;
  };

  /* 沿大圆插值点亮路径（行军途中看见的）——
     不用 hopsWithin(from, dist) 整块球冠：那会把"绕过去"的一整片也点亮，
     走一条线却看见了整个半球，探索就没代价了。 */
  F.revealPath = function (from, to, v, stepPerTile) {
    F.ensure();
    v = v == null ? TERRAIN : v;
    if (!_n) return 0;
    var a = _dirOf(from), b = _dirOf(to);
    if (!a || !b) { if (from != null) F.revealAround(from.ci != null ? from.ci : from, 1, v); return 0; }
    var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    if (d > 0.999999) { /* 同一点 */
      var c0 = _ciOf(from); return c0 >= 0 ? (F.bump(c0, v) ? 1 : 0) : 0;
    }
    if (d < -0.999999) d = -0.999999;
    var omega = Math.acos(d), so = Math.sin(omega);
    var dist = (GAME.sphere && GAME.sphere.distOf) ? GAME.sphere.distOf(from, to) : 1;
    var steps = Math.max(2, Math.ceil((dist || 1) * (stepPerTile || 1.5)));
    var hit = 0, last = -1;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var s0 = Math.sin((1 - t) * omega) / so, s1 = Math.sin(t * omega) / so;
      var dir = [a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1];
      var L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      dir = [dir[0] / L, dir[1] / L, dir[2] / L];
      var ci = GAME.sphere.nearestCell(dir);
      if (ci >= 0 && ci !== last) { last = ci; if (F.bump(ci, v)) hit++; }
    }
    return hit;
  };

  function _ciOf(e) {
    if (e == null) return -1;
    if (typeof e === 'number') return e;
    if (e.ci != null) return e.ci;
    if (e.x != null && e.y != null && GAME.sphere && GAME.sphere.ciOfXY) return GAME.sphere.ciOfXY(e.x, e.y);
    return -1;
  }
  function _dirOf(e) {
    var ci = _ciOf(e);
    if (ci < 0 || !GAME.sphere || !GAME.sphere.cells) return null;
    var c = GAME.sphere.cells[ci];
    return c && c.dir ? c.dir : null;
  }

  /* ---------- 探索度 ---------- */
  F.stats = function () {
    F.ensure();
    if (_stat && _stat.n === _n) return _stat;
    var seen = 0, full = 0;
    for (var ci = 0; ci < _n; ci++) {
      var v = getRaw(ci);
      if (v > NONE) seen++;
      if (v >= ALL) full++;
    }
    _stat = { n: _n, total: _n, seen: seen, full: full,
      pct: _n ? Math.round(seen / _n * 1000) / 10 : 0, fullPct: _n ? Math.round(full / _n * 1000) / 10 : 0 };
    return _stat;
  };

  /* ---------- 存档往返 ---------- */
  F.pack = function () {
    F.ensure();
    if (!_pack) return { v: 2, sig: _sig, n: _n, data: '' };
    var out = [], run = 0, cnt = 0, ci, v;
    for (ci = 0; ci < _n; ci++) {
      v = getRaw(ci);
      if (cnt === 0) { run = v; cnt = 1; }
      else if (v === run && cnt < 255) cnt++;
      else { out.push(run, cnt); run = v; cnt = 1; }
    }
    if (cnt) out.push(run, cnt);
    return { v: 2, sig: _sig, n: _n, data: enc(new Uint8Array(out)) };
  };
  /* 从存档恢复（loadGame 之后调一次即可；ensure 也会自动认） */
  F.unpack = function (obj) {
    _pack = null; _sig = '';
    if (GAME.state && obj) GAME.state.fog = obj;
    return F.ensure();
  };

  /* ============================================================
   * 据点 / 城池的固有视野
   * ------------------------------------------------------------
   * 只有"我方的"才给视野 —— 敌城不该白送情报。
   * 城 4 格全明（看得清自家门口有什么）；前哨/据点 2 格。
   * ============================================================ */
  F.CITY_R = 4;
  F.OUTPOST_R = 2;

  /* 当前城的视野半径 —— **随探索度成长**（DATA.FOG.tiers）。
     为什么奖励给"看得更远"而不是给攻击/产量：
     给数值，探索就变成刷百分比换 buff；给视野，探索本身就更顺。
     正反馈落在探索上，不落在战力上。 */
  F.radiusOf = function () {
    var C = (GAME.DATA && GAME.DATA.FOG) || {};
    var r = C.baseRadius || F.CITY_R;
    var tiers = C.tiers || [];
    var pct = F.stats().pct;
    for (var i = 0; i < tiers.length; i++) if (pct >= tiers[i].pct) r = tiers[i].r;
    /* v92.8：年景（B5）—— 开拓年视野 +1（只加不减，不给惩罚） */
    var _y = (GAME.yearOf ? GAME.yearOf() : null);
    if (_y && _y.fogPlus) r += _y.fogPlus;
    return r;
  };
  F.outpostRadius = function () {
    var C = (GAME.DATA && GAME.DATA.FOG) || {};
    return C.outpostRadius || F.OUTPOST_R;
  };

  /* 里程碑：探明度跨过新档 → 视野半径永久 +1，立刻重刷一遍所属城。
     幂等（state.fogMilestone 记已达成的最高百分比），返回新达成的档或 null。 */
  F.checkMilestones = function () {
    var st = GAME.state;
    if (!st || !GAME.DATA || !GAME.DATA.FOG) return null;
    var tiers = GAME.DATA.FOG.tiers || [];
    var pct = F.stats().pct;
    var reached = st.fogMilestone || 0;
    var best = null;
    for (var i = 0; i < tiers.length; i++) {
      if (pct >= tiers[i].pct && tiers[i].pct > reached) best = tiers[i];
    }
    if (!best) return null;
    st.fogMilestone = best.pct;
    F.revealOwned();                 /* 新半径立刻生效（不用等下次读档） */
    if (GAME.log && GAME.log.war) {
      GAME.log.war('🗺 ' + best.name + ' —— 行迹 ' + F.stats().pct + '%，城的视野扩到 '
        + best.r + ' 格（探得越远，看得越远）');
    }
    return best;
  };

  F.revealCity = function (city, r) {
    if (!city) return 0;
    var ci = _ciOf(city);
    if (ci < 0) return 0;
    return F.revealAround(ci, r == null ? F.radiusOf() : r, ALL);
  };

  /* 自己所有城 + 前哨 → 全明。开局/读档/每月回访各调一次（幂等，只会变多）。 */
  F.revealOwned = function () {
    F.ensure();
    var st = GAME.state;
    if (!st) return 0;
    var hit = 0;
    var cr = F.radiusOf(), or = F.outpostRadius();
    (st.cities || []).forEach(function (c) {
      if (!c || c.npc) return;
      hit += F.revealCity(c, cr);
    });
    /* 我方前哨（据点被拔除后占据） */
    var ft = st.forts || {};
    Object.keys(ft).forEach(function (k) {
      var f = ft[k];
      if (!f || !f.own) return;
      var ci = _ciOf(f);
      if (ci >= 0) hit += F.revealAround(ci, or, ALL);
    });
    return hit;
  };

  /* 未探明格 → 出征时的提示语（UI 与 dispatch 共用同一句）。
     ⚠️ 必须给出**下一步怎么做** —— 只说"未探明"会让玩家以为卡住了；
     探索的推进方式其实是"从已探明的边缘出兵，抵达即显形"（march.arrive 里点亮半径 2）。 */
  F.unknownMsg = function () {
    return '未探明：这一带没有记载。从已探明的边缘出兵，抵达后周围就会显现。';
  };

  /* ============================================================
   * backfill —— 老档首次接迷雾
   * ------------------------------------------------------------
   * 加迷雾最怕的事：老玩家一读档，已经玩了几十小时的地图变全黑。
   * 那不是"补上未知"，是把他的成果抹了。
   *
   * 原则：**走过的路都算数。**
   *   我方城 / 已占野地 / 我方前哨 → 全明
   *   已知据点 / 采集过的野地 / 在途行军的终点 → 半明
   * 只在"存档里没有迷雾数据"时跑一次（有数据就只刷城视野）。
   * ============================================================ */
  F.backfill = function () {
    F.ensure();
    var st = GAME.state;
    if (!st) return 0;
    var hit = 0, ci;
    hit += F.revealOwned();
    /* 已占野地：在那儿驻过军，地形与内容都该知道 */
    (st.wilds || []).forEach(function (w) {
      if (!w || !w.own) return;
      ci = _ciOf(w);
      if (ci >= 0) hit += F.revealAround(ci, 2, ALL);
    });
    /* 据点：自己占的全明；只是见过的半明 */
    var ft = st.forts || {};
    Object.keys(ft).forEach(function (k) {
      var f = ft[k]; ci = _ciOf(f);
      if (ci < 0) return;
      hit += F.revealAround(ci, f && f.own ? 2 : 1, f && f.own ? ALL : TERRAIN);
    });
    /* 采集队：去过，见过地形 */
    (st.gathers || []).forEach(function (g) {
      ci = _ciOf(g); if (ci >= 0) hit += F.revealAround(ci, 1, TERRAIN);
    });
    /* 在途行军：往那边去过，沿途算半明（终点 ci 在 m.tci） */
    (st.marches || []).forEach(function (m) {
      if (!m) return;
      ci = (m.tci != null) ? m.tci : _ciOf(m);
      if (ci >= 0) hit += F.revealAround(ci, 1, TERRAIN);
    });
    return hit;
  };
})();
