/* ============================================================
 * js/rules.js —— **数值规则层**（core）
 * ------------------------------------------------------------
 * v156.43（老板 2026-11-02「应该做到什么程度，你把握」）
 *
 * 为什么有这个文件：
 *   体检发现 `js/story.js` 在 **ui 包**里，却提供 `prodMult` / `combatMod` /
 *   `troopPower` 这些**决定全局数值**的函数。结果是：
 *     · `battle` 调它 17 处、`state` 调它 9 处、`tactic` 调它 4 处 —— 全是反向依赖；
 *     · 改一个天气数值系数，在依赖图上等于"改了 UI"。
 *   全仓 177 个跨层调用点里，**122 个是 compute**（计算函数被放在上层），
 *   这是最大的一块。
 *
 * 边界（刻意只搬这些）：
 *   ✅ 只依赖 `DATA` 与 `GAME.state.world` 的**纯计算** → 搬进来
 *   ❌ 依赖 `STORY.activeBonds()` 的（`bondBonus` / `cityDefMult`）→ 留在 story
 *   ❌ 事件/播报/界面（`init` / `skyLine` / `openXxx`）→ 留在 story
 *
 * 零行为风险的做法：
 *   `story.js` 里同名函数**保留并转发**到本文件。所以 34 处调用点里
 *   没改的那些照样工作，行为逐字节不变；改的那些只是换了个入口。
 * ============================================================ */
(function (global) {
  'use strict';
  var GAME = global.GAME || (global.GAME = {});
  var DATA = GAME.DATA;
  var R = GAME.rules = GAME.rules || {};

  /* ---- 当前季节 / 天气：只读 state.world 与 DATA ---- */
  R.currentSeason = function () {
    var s = GAME.state;
    if (!s || !s.world) return DATA.SEASONS[0];
    return DATA.SEASONS[s.world.season % 4];
  };

  R.currentWeather = function () {
    var s = GAME.state;
    if (!s || !s.world) return DATA.WEATHERS.clear;
    return DATA.WEATHERS[s.world.weather] || DATA.WEATHERS.clear;
  };

  /* ---- 产出倍率：季节 × 天气（v90.93 起只有这两项） ---- */
  R.prodMult = function (res) {
    var se = R.currentSeason(), we = R.currentWeather();
    var m = 1;
    if (res === 'grain') {
      m *= (1 + (se.grain || 0));
      m *= (1 + (we.grain || 0));
    }
    return m;
  };

  /* ---- 兵种战力：纯查表 ---- */
  R.troopPower = function (troopId) {
    var t = DATA.TROOPS[troopId];
    if (!t) return 0;
    var W = DATA.POWER.troopWeight;
    return (t.hp * W.hp + t.atk * W.atk + t.def * W.def + t.spd * W.spd) || 1;
  };

  /* ---- 战斗修正：天气对射程/火攻/伏击/侦察/移动 ---- */
  R.combatMod = function () {
    var we = R.currentWeather();
    return {
      weather: we,
      archerRange: 1 + (we.archerRange || 0),
      fire: we.fire == null ? 1 : we.fire,
      ambush: we.ambush || 1,
      scout: we.scout !== false,
      move: we.move || 1,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
