/* ============================================================
 * quest.js — v158.6（P5-b · 任务链）大世界引导链
 * ------------------------------------------------------------
 * 老板要的结果：一条任务链把 P0~P4 已经交付的能力串起来 ——
 * 行走 → 走近交互 → 进街区 → 开车 → 遇到居民对话/开打。
 * 让"一个大世界"不再只是每次开档重建的演示，而是有一条
 * 玩家可跟随、可量化的引导线。
 *
 * 六条硬纪律（与 AGENTS.md 〇之〇「实现老板意图，不许异化」对齐）：
 *  1. 观察器，不是拦截器：本模块**不新增任何按键分支**，只在
 *     tick 里轮询 P0~P4 的既有状态（走过没 / 进没进街区 / 开没开车 /
 *     跟 NPC 说过话打过架没），达标就推进。绝不改 main.js 的
 *     P3→P4→P1 分派顺序、绝不动那几行逐字断言。
 *  2. 进度入档、位置派生：state.quest 只存 {step, done:{…}}，
 *     不存任何坐标 / 目标位置；存档里没有 questPos。
 *     读档后由世界时间 + 状态机原位重建。
 *  3. 纯事件驱动、无时钟依赖：walk 靠位姿切向位移累计，其余五步靠
 *     P1~P4 的观察钩子（onLook/onEnter/onRide/onTalk/onFight）后置登记；
 *     不读 world.elapsed、不碰 questDayIndex（那是现实日索引），
 *     因此不受游戏内时间快进/慢进影响，也不会误用现实日。
 *  4. 判定出口不另算：对话只观察 GAME.npc.talk 的成功返回值，
 *     开打只观察 GAME.npc.fight 的成功返回值；不自己调 duel、
 *     不自己写体力、不自己加日志正文（只记一条进度日志）。
 *  5. 不碰退役痕迹：旧任务系统在 v90.92 已整条退役（s.quests
 *     字段移除），本模块是**全新系统**，字段叫 state.quest，
 *     与旧 s.quests 彻底分开，不恢复、不迁移任何旧数据。
 *  6. 开关 M.QUEST=false 回到 v158.5：引导链停摆，其余照常。
 *
 * 本模块排在 core 包（npc 之后），加载期只定义函数；所有对
 * ui / npc / vehicle / district 的访问都在调用期。
 * ============================================================ */
import './core.js';
(function () {
  'use strict';
  var G = GAME;
  var Q = G.questline = G.questline || {};

  /* ---------- 常量 ---------- */
  Q.STEPS = [
    { id: 'walk',  name: '迈出第一步', verb: '走一段路',     icon: '🚶' },
    { id: 'look',  name: '环顾四周',   verb: '走近一格看看', icon: '👀' },
    { id: 'enter', name: '进城',       verb: '走进街区',     icon: '🏘️' },
    { id: 'ride',  name: '上车',       verb: '登上一辆车',   icon: '🛻' },
    { id: 'talk',  name: '打听消息',   verb: '与居民交谈',   icon: '💬' },
    { id: 'fight', name: '露一手',     verb: '与街边好汉过招', icon: '⚔️' }
  ];
  /* 每步达成的最小可观测下限（防平凡解）：走过 ≥N 米 / 对话 ≥1 次 / 开打 ≥1 回合 */
  Q.MIN_WALK_M = 3;      /* 累计行走 ≥3 米才算"走过" */
  Q.MIN_ROUNDS = 1;      /* 街边冲突至少打满 1 回合才算"开打" */

  /* ---------- 状态（进度入档；位置/目标派生，不入档） ---------- */
  Q._lastFightRounds = 0;

  /** 读取/初始化进度（幂等）。老档无 quest 时按世界时间原位重建为空进度。 */
  Q.state = function () {
    var s = G.state;
    if (!s) return null;
    if (!s.quest || typeof s.quest !== 'object') {
      s.quest = { step: 0, done: {} };
    }
    return s.quest;
  };

  /** 当前步骤（0-based；越界 = 已完成）。 */
  Q.now = function () {
    var q = Q.state();
    return q ? q.step : 0;
  };
  Q.done = function () {
    var q = Q.state();
    return q ? q.step >= Q.STEPS.length : false;
  };

  /** 当前步骤定义。 */
  Q.curStep = function () {
    var q = Q.state();
    if (!q) return null;
    return q.step < Q.STEPS.length ? Q.STEPS[q.step] : null;
  };

  /* ---------- 观察器：轮询 P0~P4 既有状态，达标推进 ---------- */
  Q._walkAcc = 0;
  Q._lastPose = null;

  /** 累计行走距离（切向位移，只在球面 P0 行走态累积，不把街区局部坐标混进来）。 */
  function observeWalk() {
    var M = G.map3d;
    if (!M || typeof M.playerPose !== 'function') return;
    if (M.DISTRICT && G.district && G.district.active) return; /* 街区态不算"球面行走" */
    var p = M.playerPose();
    if (!p || !p.dir) return;
    if (Q._lastPose) {
      var dx = p.dir[0] - Q._lastPose[0];
      var dy = p.dir[1] - Q._lastPose[1];
      var dz = p.dir[2] - Q._lastPose[2];
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 0.5) Q._walkAcc += d;   /* 单位球切向弦长，小步累加 */
    }
    Q._lastPose = [p.dir[0], p.dir[1], p.dir[2]];
  }

  /** 主 tick：一次推进一步（不跨步，让玩家看清每一步）。 */
  Q.tick = function () {
    var M = G.map3d;
    if (M && M.QUEST === false) return null;
    var q = Q.state();
    if (!q || q.step >= Q.STEPS.length) return null;
    var st = Q.STEPS[q.step];

    observeWalk();

    var hit = false, detail = '';
    switch (st.id) {
      case 'walk':
        if (Q._walkAcc >= Q.MIN_WALK_M) hit = true, detail = Q._walkAcc.toFixed(1) + 'm';
        break;
      case 'look':
        /* 走进一格看看 = 打开过至少一次格面板（P1 的 openCellPanel 同一出口） */
        if (q.done.look) hit = true;
        break;
      case 'enter':
        if (q.done.enter) hit = true;
        break;
      case 'ride':
        if (q.done.ride) hit = true;
        break;
      case 'talk':
        if (q.done.talk) hit = true;
        break;
      case 'fight':
        if (q.done.fight && Q._lastFightRounds >= Q.MIN_ROUNDS) hit = true;
        break;
    }

    if (hit) {
      q.step++;
      var fin = q.step >= Q.STEPS.length;
      if (G.log) {
        G.log((st.icon || '') + ' 任务链 · ' + st.name + '完成' + (fin ? ' —— 大世界走通了' : ''),
          'quest', 'quest');
      }
      if (G.ui && G.ui.toast) {
        G.ui.toast((st.icon || '') + ' ' + st.name + (fin ? ' · 大世界走通了！' : ' · 完成'));
      }
      return { ok: true, step: st.id, advanced: q.step, done: fin, detail: detail };
    }
    return null;
  };

  /** P1 面板打开观察钩子（由 openCellPanel 调用后置，见 map3d 接线）。
   *  只登记"看过格"，不拦截、不改面板内容。 */
  Q.onLook = function () {
    var q = Q.state();
    if (!q) return;
    q.done.look = true;
  };
  Q.onEnter = function () {
    var q = Q.state();
    if (!q) return;
    q.done.enter = true;
  };
  Q.onRide = function () {
    var q = Q.state();
    if (!q) return;
    q.done.ride = true;
  };
  Q.onTalk = function () {
    var q = Q.state();
    if (!q) return;
    q.done.talk = true;
  };
  Q.onFight = function (rounds) {
    var q = Q.state();
    if (!q) return;
    q.done.fight = true;
    Q._lastFightRounds = rounds | 0;
  };

  /** 提示文本（给 UI / HUD 用）。 */
  Q.hint = function () {
    var st = Q.curStep();
    if (!st) return '';
    return st.icon + ' 任务链 · ' + st.verb;
  };

  /** 进度摘要（面板 / 探针用）。 */
  Q.summary = function () {
    var q = Q.state();
    var out = [];
    for (var i = 0; i < Q.STEPS.length; i++) {
      out.push({
        id: Q.STEPS[i].id, name: Q.STEPS[i].name,
        done: i < (q ? q.step : 0)
      });
    }
    return { step: q ? q.step : 0, total: Q.STEPS.length, items: out };
  };

  /** 重置（探针 / 回退用；只清运行时，不写存档）。 */
  Q.reset = function () {
    Q._walkAcc = 0;
    Q._lastPose = null;
    Q._lastFightRounds = 0;
  };

  /* ============================================================
   * 自注册（可插拔 —— 见 registry.js）
   * 不设 tick（引导链由 map3d 主循环调 Q.tick，避免与月度 tickAll 撞节奏），
   * 只提供 panel 与进度可见性。
   * ============================================================ */
  if (G.reg) {
    G.reg.add({
      id: 'questline',
      order: 15,
      panel: function (ctx) {
        var sec = ctx.sec, U = ctx.U;
        var s = Q.summary();
        var rows = s.items.map(function (it) {
          return '<div style="font-size:var(--fs-cap);">'
            + (it.done ? '✅ ' : '⬜ ') + U.escape(it.name) + '</div>';
        }).join('');
        var line = s.step >= s.total
          ? '大世界引导链已完成'
          : '当前：' + (Q.STEPS[s.step] ? Q.STEPS[s.step].verb : '');
        return sec('🧭 大世界引导', line, rows);
      }
    });
  }
})();
