/* ============================================================
 * js/generals.js — **英雄名册（s.generals）归属模块**（v91.65 · 地基第 2 期第四刀）
 * ------------------------------------------------------------
 * 背景：英雄是**状态机**（idle / march / gather / garrison / guard / mayor / wonderExplore），
 *   且"一个英雄同时只能执行一种派遣"是老板 v91.45 明确立下的规则 ——
 *   但此前 **16 处裸改 status + 11 处裸判 idle**，没有任何出口，
 *   互斥全靠各调用方自觉（漏一处 = 同一个英雄能被派两次）。
 *
 * 本模块把**状态与名册**收进唯一出口：
 *   · `GAME.gen.set(g, status)` —— 改状态的唯一入口（校验合法值、离开驻守时清 cityId）；
 *   · `GAME.gen.free(g)` / `GAME.gen.busy(g)` —— "是否可被派遣"的唯一判据；
 *   · `GAME.gen.claim(g, status)` —— **原子占位**（空闲才占，否则返回拒绝原因）；
 *   · `GAME.gen.release(g)` —— 归队（回 idle）；
 *   · `GAME.gen.add(...)` / `GAME.gen.remove(...)` —— 名册增删的唯一入口。
 *
 * 迁移策略同前两刀：先建出口 + 切"状态与互斥"这类规则点（本刀），
 * 名册增删的其余调用点后续刀再逐个切；未切处行为不变。
 * 数据仍存 `s.generals` / `g.status`（存档零迁移）。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
(function () {
  var GAME = window.GAME = window.GAME || {};

  /* 合法状态（唯一来源）：idle = 空闲可派遣；其余均为"占用中"。 */
  var STATUS = {
    idle: '空闲',
    march: '行军中',
    gather: '采集中',
    garrison: '驻守野地',
    guard: '守将',
    mayor: '城主',
    wonderExplore: '奇观探索中',
  };

  var G = GAME.gen = {};
  G.STATUS = STATUS;
  G.ALL = Object.keys(STATUS);
  /* 这些状态"占用英雄"（不可再被委派其他行动） */
  G.OCCUPYING = G.ALL.filter(function (k) { return k !== 'idle'; });

  function list() {
    var s = GAME.state;
    if (!s) return [];
    s.generals = s.generals || [];
    return s.generals;
  }

  /* 读状态（缺省视作空闲） */
  G.statusOf = function (g) { return (g && g.status) || 'idle'; };
  G.isBusy = function (g) { return G.statusOf(g) !== 'idle'; };
  G.isFree = function (g) { return !!(g && !G.isBusy(g)); };

  /* **改状态的唯一入口**。
     规则：合法值校验；离开驻守（garrison）时清掉驻地的 cityId
     （否则英雄回空闲后仍"挂"在野地上，下次派遣会错判归属）。 */
  G.set = function (g, status) {
    if (!g) return false;
    if (G.ALL.indexOf(status) < 0) return false;
    var prev = G.statusOf(g);
    g.status = status;
    if (prev === 'garrison' && status !== 'garrison') g.cityId = null;
    return true;
  };

  /* **原子占位**：空闲才能占；已占用 → 拒绝并给出原因（互斥唯一判据）。 */
  G.claim = function (g, status) {
    if (!g) return { ok: false, msg: '未指定英雄' };
    if (G.isBusy(g)) {
      return { ok: false, msg: g.name + ' 正在' + (STATUS[G.statusOf(g)] || G.statusOf(g)) + '，无法另行派遣' };
    }
    if (!G.set(g, status)) return { ok: false, msg: '未知状态：' + status };
    return { ok: true, msg: '' };
  };

  /* 归队（回空闲） */
  G.release = function (g) { return G.set(g, 'idle'); };

  /* 名册：按 id 取 */
  G.byId = function (id) {
    var arr = list();
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  };
  /* 名册：增（唯一入口 · 去重：同 id 不重复入册） */
  G.add = function (g) {
    if (!g) return null;
    var arr = list();
    if (g.id && G.byId(g.id)) return G.byId(g.id);
    arr.push(g);
    return g;
  };
  G.remove = function (ref) {
    var arr = list();
    var idx = -1;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === ref || (ref && typeof ref === 'string' && arr[i].id === ref)) { idx = i; break; }
    }
    if (idx < 0) return null;
    return arr.splice(idx, 1)[0];
  };
  /* 空闲英雄（自动指派用：逐城/逐星球取一枚） */
  G.freeOnes = function (pred) {
    return list().filter(function (g) { return G.isFree(g) && (!pred || pred(g)); });
  };
})();
