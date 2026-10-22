/* ============================================================
 * registry.js — 模块注册表（v100 · 可插拔）
 * ------------------------------------------------------------
 * 老板原话：「按照之前进行过了切片之类的操作，代码分块啥的你留意下，
 *   不要累积屎山代码，可插拔，可维护性提高」。
 *
 * 加一个模块要改几处？改前是 **7 处**：
 *   ① build_bundle.py 的 ORDER
 *   ② smoke-test.js 的 ORDER
 *   ③ audit.js 的 MODULES
 *   ④ audit.js 的 REF_MODULES
 *   ⑤ main.js 的 import
 *   ⑥ main.js 的动作 case
 *   ⑦ state.js 的 _safeTick 列表
 *   ⑧ ui.js 的面板块
 * 每加一项都要在八个地方各写一遍，漏一个就是"模块存在但没生效"——
 * 本项目已经因此吃过好几次（六层世界那批、兵源那批）。
 *
 * 这个表把 ⑥⑦⑧ 收敛成**一次声明**：
 *
 *   GAME.reg.add({
 *     id: 'muster', order: 60,
 *     tick: function(){ MU.tick(); },              // 月度 tick（自动 try/catch）
 *     panel: function(ctx){ return ctx.sec(...); }, // 世界账本的一块（自动排序）
 *     actions: { 'muster-accept': function(el, ctx){ ... } }  // 动作（自动分发）
 *   });
 *
 * ①②③④ 仍然是静态清单（构建脚本要读文件顺序，没法运行时推导）——
 * 但那四处是**纯登记**，不承载逻辑，加一行即可。
 *
 * ⚠️ 刻意保留旧硬编码：老模块（faction/wonderwar/...）的面板块还在 ui.js 里，
 *    本轮只把**新模块**迁进来。一次全迁 = 一次大改 = 一次大炸，不干。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var RG = GAME.reg = { mods: [] };

  /* ---------------- 注册 ---------------- */
  RG.add = function (spec) {
    if (!spec || !spec.id) return null;
    /* 幂等：同一个 id 重复注册只保留最后一次（热重载/重复 import 不至于出双份） */
    for (var i = 0; i < RG.mods.length; i++) {
      if (RG.mods[i].id === spec.id) { RG.mods[i] = spec; return spec; }
    }
    RG.mods.push(spec);
    return spec;
  };

  RG.get = function (id) {
    for (var i = 0; i < RG.mods.length; i++) if (RG.mods[i].id === id) return RG.mods[i];
    return null;
  };

  /* ---------------- 月度 tick ----------------
   * 每个模块自己管"这个月跑过没有"（它们都有一句 `if (!force && s.xMonth === m) return`），
   * 这里只负责**逐个隔离开**：一个模块抛错不许拖停别的模块，更不许拖停主循环。
   * （v95 的教训：`_safeTick` 就是为了这个，现在统一到这里。）
   */
  RG._warned = {};
  RG.tickAll = function (force) {
    var out = { ok: 0, err: 0 };
    RG.mods.forEach(function (m) {
      if (typeof m.tick !== 'function') return;
      try {
        m.tick(force);
        out.ok++;
      } catch (e) {
        out.err++;
        if (!RG._warned[m.id]) {
          RG._warned[m.id] = 1;
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[monthly tick] ' + m.id, e);
          }
        }
      }
    });
    return out;
  };

  /* ---------------- 界面块 ----------------
   * `ctx` 由 ui.js 给：{ sec, U, cities, c0, esc }
   * 每个 panel 返回一段 HTML；抛错就渲染成一行"这块没加载"，不整个面板崩掉。
   */
  RG.panels = function (ctx) {
    var list = RG.mods.filter(function (m) { return typeof m.panel === 'function'; });
    list.sort(function (a, b) {
      return (a.order == null ? 500 : a.order) - (b.order == null ? 500 : b.order);
    });
    return list.map(function (m) {
      try {
        var h = m.panel(ctx);
        return h || '';
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[panel] ' + m.id, e);
        return '<div class="ui-sub" style="color:var(--red-light);">'
          + '（' + m.id + ' 这块没加载：' + (e && e.message ? e.message : e) + '）</div>';
      }
    }).join('');
  };

  /* ---------------- 动作分发 ----------------
   * main.js 的 switch 里加一句兜底：`if (GAME.reg.action(a, el, ctx)) break;`
   * 返回 true = 这个动作归注册表管（调用方不要再往下走）。
   */
  RG.action = function (name, el, ctx) {
    for (var i = 0; i < RG.mods.length; i++) {
      var m = RG.mods[i];
      var f = m.actions && m.actions[name];
      if (typeof f !== 'function') continue;
      try { f(el, ctx); return true; } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[action] ' + name, e);
        return true;
      }
    }
    return false;
  };

  /* ---------------- 自检 ----------------
   * 给 smoke 用：注册了几个、各自有没有 tick/panel/actions。
   * 这是"可插拔"能被验证的地方 —— 不然新机制自己也会变成没人读的死代码。
   */
  RG.stats = function () {
    var s = { total: RG.mods.length, tick: 0, panel: 0, actions: 0, ids: [] };
    RG.mods.forEach(function (m) {
      if (typeof m.tick === 'function') s.tick++;
      if (typeof m.panel === 'function') s.panel++;
      if (m.actions) s.actions += Object.keys(m.actions).length;
      s.ids.push(m.id);
    });
    return s;
  };
})();
