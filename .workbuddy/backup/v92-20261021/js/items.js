/* ============================================================
 * js/items.js — **宝物背包（s.items）归属模块**（v91.62 · 地基第 2 期第一刀）
 * ------------------------------------------------------------
 * 背景：`s.items` 原先是"谁都能写"的裸对象 —— 全仓 **62 个写点**散在 8 个文件里，
 *   写法各异（`= (x||0)+n` / `= Math.max(0,(x||0)-n)` / 裸 `-= 1`），
 *   其中数处**无下界保护**（可写出负库存 → 界面显示负数、消耗校验错乱）。
 *
 * 本模块是 s.items 的**唯一归属**：
 *   · 增量 / 扣减 / 查询 一律走这里（下界恒为 0，数量恒为整数）；
 *   · 所有"校验 + 扣费"成对的操作走 `GAME.itemsTake`（**原子**：不够就整单拒绝，不动账）。
 *
 * 迁移策略（**渐进 · 每刀可回退**）：
 *   1. 本刀：先建立出口，并把**无保护/易错**的写点切过来（负库存风险点）。
 *   2. 后续刀：其余"= (x||0)+n"型写点逐簇切过来；最后加 lint 守卫（禁裸写 s.items）。
 *   —— 未切的写点行为不变（仍是裸读写），故本刀**风险极低**。
 *
 * ⚠️ 本文件不持有状态：数据仍存 `GAME.state.items`（存档兼容，零迁移）。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA;

  /* 背包对象（惰性补齐；老档缺字段时自动建） */
  function bag() {
    var s = GAME.state;
    if (!s) return {};
    s.items = s.items || {};
    return s.items;
  }
  /* 数量归一：非负整数 */
  function norm(n) {
    n = Math.floor(Number(n) || 0);
    return n > 0 ? n : 0;
  }

  var IT = GAME.items = {};

  /* 持有数量（**读的唯一出口**） */
  IT.count = function (id) { return bag()[id] || 0; };

  /* 是否够（**校验的唯一出口**） */
  IT.has = function (id, n) { return IT.count(id) >= norm(n); };

  /* 增加（**写的唯一出口**）。返回新增后的数量。 */
  IT.add = function (id, n) {
    n = norm(n);
    if (!id || n <= 0) return IT.count(id);
    var b = bag();
    var next = norm(b[id]) + n;
    b[id] = next;
    if (next === 0) delete b[id];
    return next;
  };

  /* 扣减。**下界恒为 0**（修掉"裸 -= 1 写出负数"的口子）。
     返回实际扣掉的量；库存不足时**只扣到 0**，不抛错 —— 需要"不够就整单拒绝"请用 take()。 */
  IT.sub = function (id, n) {
    n = norm(n);
    var b = bag();
    var cur = norm(b[id]);
    var cut = Math.min(cur, n);
    if (cut <= 0) return 0;
    var next = cur - cut;
    if (next === 0) delete b[id]; else b[id] = next;
    return cut;
  };

  /* **原子扣减**（校验 + 扣费一体）：
     `req` 可以是 `{ itemId: n }` 或按 id 单个。任一不足 → 整单拒绝，**不动任何库存**。
     返回 { ok, msg, lack:[{id,need,have}] }。 */
  IT.take = function (req, n) {
    var need = {};
    if (typeof req === 'string') need[req] = norm(n);
    else for (var k in (req || {})) { var v = norm(req[k]); if (v > 0) need[k] = v; }
    var lack = [];
    for (var id in need) {
      var have = IT.count(id);
      if (have < need[id]) lack.push({ id: id, need: need[id], have: have });
    }
    if (lack.length) {
      return { ok: false, msg: '物品不足：' + lack.map(function (x) {
        return ((DATA.ITEM_BY_ID || {})[x.id] || {}).name || x.id;
      }).join('、'), lack: lack };
    }
    for (var id2 in need) IT.sub(id2, need[id2]);
    return { ok: true, msg: '' };
  };

  /* 一次性批量增加（战利品 / 结算汇总常用）；跳过非正数量。 */
  IT.addAll = function (map) {
    for (var id in (map || {})) IT.add(id, map[id]);
  };
  /* 批量查询：返回 [{id,n}]（只列持有量 > 0 的，用于界面）。 */
  IT.list = function (pred) {
    var b = bag(), out = [];
    for (var id in b) {
      var n = norm(b[id]);
      if (n <= 0) continue;
      if (pred && !pred(id, n)) continue;
      out.push({ id: id, n: n });
    }
    return out;
  };
})();
