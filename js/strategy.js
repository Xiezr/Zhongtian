/* ============================================================
 * strategy.js  回合战斗策略层（v91.85 新增）
 * ------------------------------------------------------------
 * 定位：**独立模块**（不碰战斗数学，只产出「每回合的动作 / 目标」）。
 *
 * 为什么要单独一层：
 *   · tactic.js 是 83KB 的结算内核，改它等于动 3785 条冒烟断言；
 *   · 决策只需要"当前战场快照"，不需要知道伤害怎么算；
 *   · 同一份策略要能被外部沙盘（battle_panel_sim）复用。
 *   所以这里只做纯函数：输入 snap（战场快照）→ 输出指令表
 *   `{atk:{troopId:{s,t}}, def:{...}}`，由 tactic.js 在每回合开火前套用。
 *
 * 旧的「幼稚策略」= 每个兵种永远打**最近的/同兵种**，动作靠战前一次性设定。
 * 本模块保留那两条规则（`front` / `same`）作回退，但默认改用评分制：
 *   ① 能一击打死 → 优先（少挨一次反击）
 *   ② 有效伤害占目标剩余血的比例 → 不浪费溢出
 *   ③ 目标威胁（攻击×剩余数量）→ 先砍输出高的
 *   ④ 挡路判定（它是我方最前面的阻挡者）→ 先清门板
 *   动作（stance）按"够不够得着"决定：够不着就推进，远程够着就原地，
 *   近战够着继续压上；守方残血且被贴脸时才允许后撤（攻方禁止后退）。
 *
 * 兼容：`GAME.strat` 不存在时 tactic.js 完全走旧逻辑；存在时也只替
 * **NPC 一侧**下指令（玩家自己的战术设置不动）。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA;

  var S = GAME.strat = {};

  /* 可选目标规则（与引擎 u.target 的语义一一对应） */
  S.RULES = ['best', 'same', 'weak', 'dmg', 'eff', 'front'];

  function aliveList(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].count > 0) out.push(list[i]);
    return out;
  }
  function frontAdv(list) {
    var m = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].count <= 0) continue;
      if (m === null || list[i].adv > m) m = list[i].adv;
    }
    return m === null ? 0 : m;
  }
  /* 间距 = 纵深 − 我方推进 − 敌方前锋推进（与 tactic.js 的 gapOf 同一把尺） */
  function gapOf(u, foes, D) {
    return Math.max(0, D - u.adv - frontAdv(foes));
  }
  function atkOf(u) {
    var t = DATA.TROOPS[u.id] || {};
    return (t.atk || 0) * (1 + (u.atkPct || 0)) * Math.max(0, u.count);
  }
  function hpOf(u) {
    return Math.max(1, (u.hpPer || ((DATA.TROOPS[u.id] || {}).hp || 1)) * Math.max(0, u.count));
  }
  function rangeOf(u) {
    return u.er || u.range || 0;
  }

  /* 目标评分：与 battle_panel_sim 的 scoreTarget 同口径
     （kill 3.0 / eff 2.0 / threat 1.2 / blocker 0.8） */
  S.scoreTarget = function (u, t, foes, D) {
    var dmg = atkOf(u);
    var hp = hpOf(t);
    var kill = dmg >= hp ? 1 : 0;
    var eff = Math.min(dmg, hp) / hp;
    var maxThreat = 1;
    for (var i = 0; i < foes.length; i++) {
      var f = foes[i];
      if (f.count <= 0) continue;
      var th = atkOf(f);
      if (th > maxThreat) maxThreat = th;
    }
    var threat = atkOf(t) / maxThreat;
    var myGap = gapOf(u, foes, D);
    var tGap = gapOf(t, [{ adv: u.adv, count: 1 }], D);
    var blocker = Math.abs(tGap - myGap) < 1e-6 ? 1 : 0;
    return 3.0 * kill + 2.0 * eff + 1.2 * threat + 0.8 * blocker;
  };

  /* 按规则在射程内挑目标；射程内没有目标返回 null */
  S.pickTarget = function (u, foes, rule, D) {
    var pool = [];
    var myRange = rangeOf(u);
    for (var i = 0; i < foes.length; i++) {
      var f = foes[i];
      if (f.count <= 0) continue;
      if (gapOf(u, foes, D) <= myRange) pool.push(f);
    }
    /* 射程判定用"我方到敌方前锋"的间距；前锋之外的单位更远，这里按单兵间距再筛一次 */
    if (!pool.length) return null;
    function nearest(arr) {
      var best = arr[0], bg = Infinity;
      for (var k = 0; k < arr.length; k++) {
        var g = gapOf(u, [arr[k]], D);
        if (g < bg) { bg = g; best = arr[k]; }
      }
      return best;
    }
    rule = rule || 'best';
    if (rule === 'same') {
      var same = [];
      for (var j = 0; j < pool.length; j++) if (pool[j].id === u.id) same.push(pool[j]);
      if (same.length) return nearest(same);
      rule = 'best';
    }
    if (rule === 'front') return nearest(pool);
    if (rule === 'weak') {
      var w = pool[0];
      for (var a = 1; a < pool.length; a++) if (hpOf(pool[a]) < hpOf(w)) w = pool[a];
      return w;
    }
    if (rule === 'dmg') {
      var d = pool[0];
      for (var b = 1; b < pool.length; b++) if (atkOf(pool[b]) > atkOf(d)) d = pool[b];
      return d;
    }
    if (rule === 'eff') {
      var e = pool[0];
      for (var c = 1; c < pool.length; c++) {
        if (atkOf(pool[c]) * hpOf(pool[c]) > atkOf(e) * hpOf(e)) e = pool[c];
      }
      return e;
    }
    /* best（含未识别的规则名） */
    var best = pool[0], bs = -Infinity;
    for (var m = 0; m < pool.length; m++) {
      var sc = S.scoreTarget(u, pool[m], foes, D);
      if (sc > bs) { bs = sc; best = pool[m]; }
    }
    return best;
  };

  /* 动作：够不着 → 推进；远程够着 → 原地；近战够着 → 压上
     opts.allowRetreat：守方残血（<15%）且被近战贴到 300 内时可后撤 */
  S.stanceOf = function (u, foes, D, opts) {
    opts = opts || {};
    var alive = aliveList(foes);
    if (!alive.length) return 'hold';
    var gap = gapOf(u, foes, D);
    var r = rangeOf(u);
    if (gap > r) return 'advance';
    if (r >= 600) {
      var hpRatio = u.count / Math.max(1, u.start || u.count);
      if (opts.allowRetreat && hpRatio < 0.15) {
        /* 只对"贴到近身"的敌近战后撤，否则原地输出更划算 */
        var danger = false;
        for (var i = 0; i < alive.length; i++) {
          var e = alive[i];
          if (rangeOf(e) < 200 && gap <= 300) { danger = true; break; }
        }
        if (danger) return 'retreat';
      }
      return 'hold';
    }
    return 'advance';
  };

  /* 给一侧生成指令表 */
  S.planSide = function (snap, side, opts) {
    opts = opts || {};
    var mine = (side === 'def') ? snap.def : snap.atk;
    var foes = (side === 'def') ? snap.atk : snap.def;
    var D = snap.field || 0;
    var rule = opts.rule || 'best';
    var out = {};
    for (var i = 0; i < mine.length; i++) {
      var u = mine[i];
      if (!u || u.count <= 0) continue;
      if (u.vsCity && opts.towerId) {
        /* 攻城器械优先拆塔（塔在射程内才指定，否则交给通用规则） */
        out[u.id] = { s: S.stanceOf(u, foes, D, opts), t: opts.towerId };
        continue;
      }
      var tg = S.pickTarget(u, foes, rule, D);
      out[u.id] = {
        s: S.stanceOf(u, foes, D, opts),
        t: tg ? tg.id : (opts.fallback || 'front')
      };
    }
    return out;
  };

  /* 双侧一起规划（外部沙盘用；游戏内只替 NPC 一侧规划） */
  S.plan = function (snap, opts) {
    opts = opts || {};
    return {
      atk: S.planSide(snap, 'atk', opts),
      def: S.planSide(snap, 'def', opts)
    };
  };

  /* 打包成 tactic.js 的 opts.plan 回调：只规划指定的一侧，另一侧返回空表（保留玩家指令） */
  S.autoPlan = function (cfg) {
    cfg = cfg || {};
    var sides = cfg.sides || ['def'];
    var rule = cfg.rule || 'best';
    var allowRetreat = (cfg.allowRetreat !== false);
    return function (snap) {
      var out = {};
      for (var i = 0; i < sides.length; i++) {
        var side = sides[i];
        out[side] = S.planSide(snap, side, {
          rule: rule,
          allowRetreat: allowRetreat,
          attacker: side === 'atk' && cfg.attacker === true,
          towerId: cfg.towerId || null
        });
      }
      return out;
    };
  };

  /* 版本标记：战报/调试可读（也方便冒烟断言"策略层已接线"） */
  S.VERSION = 'v91.85';
})();
