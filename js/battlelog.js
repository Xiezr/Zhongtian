/* ============================================================
 * js/battlelog.js — **战斗回合推进的声明式转移表 + 操作日志**（v142.3）
 * ------------------------------------------------------------
 * 由来（v142.3 · 借鉴 boardgame.io 的 move 白名单 + log 模式，**不引库**）：
 *   chain-audit 证明了「单点都对、串起来断」是本项目最贵的缺陷形态；
 *   战斗线（派队 → 抵达 → 逐回合 → 落账）正是最长的一条链，而它的状态迁移
 *   原先散落在 4 个入口各自的 `rec.state !== 'live'` 硬判里：
 *     · 判据重复 4 份，改一处漏三处；
 *     · 没有日志，出问题只能靠 round/evLast 反推；
 *     · 「非法转移」靠人 review 发现，没有机器判据。
 *
 * 本模块做三件事，**零行为变化**（转移表与硬判完全同口径）：
 *   ① **转移表白名单** `MOVES` —— 战斗会话的状态迁移全部收进这张表
 *      （6 个入口：create 抵达建档 · step/auto/finish/retreat 四个玩家动作 ·
 *      settle 共用落账段），每个入口声明 from/to；`can()` 是**唯一合法性出口**，
 *      battle.js 四个入口的状态闸全部改判据到这张表（单一事实源）。
 *   ② **操作日志** `push()` —— 每执行一个动作往 `rec.blog` 记一条
 *      （随记录进存档，**零迁移**；老档没有该字段 = 空日志）。
 *   ③ **日志自检** `check()` —— 三条不变式：
 *      ① 每个动作都在表白名单里；
 *      ② 相邻动作的转移合法（前一条的 to 必须允许后一条的 from）；
 *      ③ 终态动作（settle）至多一次、必须在末尾（防「落账两次」/「打完还能打」）。
 *
 * 设计约束：
 *   · 日志是**观测层，不是参与者** —— push 内部全 try/catch，
 *     任何异常都不许影响战斗本身（观测故障不许变成产品故障）。
 *   · rec 已被落账清出 s.battles 时，条目进模块级**有界溢出缓冲**（50 条），
 *     不丢、也不涨内存。
 *   · **settle 即封版** —— 落账瞬间把终态日志快照进模块级 DONE 缓存
 *     （最近 20 场）。因为 rec 清场后 blog 随记录不可达，而「打完按 id
 *     复盘这场仗」正是日志的存在理由；快照让战后读日志仍然成立。
 *   · 只追加不修改 —— 日志的历史部分不可变（可复放的前提）。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
(function () {
  var GAME = window.GAME = window.GAME || {};
  var BL = GAME.battlelog = {};

  BL.VERSION = 'v142.3';

  /* ============================================================
   * ① 转移表白名单（战斗会话状态机的唯一事实源）
   * ------------------------------------------------------------
   *   create   抵达目标，战斗待指挥        [] → live
   *   step     推进一回合                  live → live
   *   auto     一键跑完（内部仍是 step 循环） live → live
   *   finish   打完收尾                    live → settling
   *   retreat  主动撤退（残部带回）          live → settling
   *   settle   落账段（finish/retreat 共用） settling → done
   * settling 是**瞬态**：finish/retreat 只是"请求落账"，
   * 真正改状态的是共用的 _settleBattle —— 与 battle.js 的代码事实一致。
   * ============================================================ */
  BL.MOVES = {
    create:  { from: [],          to: 'live',    desc: '抵达目标，战斗待指挥' },
    step:    { from: ['live'],    to: 'live',    desc: '推进一回合' },
    auto:    { from: ['live'],    to: 'live',    desc: '一键跑完（内部仍是 step 循环）' },
    finish:  { from: ['live'],    to: 'settling', desc: '打完收尾落账' },
    retreat: { from: ['live'],    to: 'settling', desc: '主动撤退（残部带回、破防按半计）' },
    settle:  { from: ['settling'], to: 'done',   desc: '落账段（finish/retreat 共用）' },
    /* v150（P0-2）：战场三选一 —— 只改指令，不改状态（live → live，回合号不倒退） */
    choose:  { from: ['live'],    to: 'live',    desc: '玩家在战场上做的选择（突击/稳住/撤退）' }
  };

  /* 合法性判定（**唯一出口**）：动作在不在表白名单 + 当前状态允不允许 */
  BL.can = function (move, state) {
    var m = BL.MOVES[move];
    if (!m) return { ok: false, why: '未知动作「' + move + '」（不在表白名单）' };
    if (m.from.length && m.from.indexOf(state) < 0) {
      return { ok: false, why: '状态 ' + state + ' 不允许「' + move + '」（只允许 ' + m.from.join('/') + '）' };
    }
    return { ok: true, move: move, to: m.to };
  };

  /* ============================================================
   * ② 记账
   * ------------------------------------------------------------
   * entry = { seq, move, at, round, detail }
   *   · seq 全模块单调递增（跨战斗也可比先后）
   *   · round = 记这条时会话打到第几回合（check 用它验单调性）
   *   · detail 由调用方给（胜方/是否撤退/间距…），只追加不改写
   * ============================================================ */
  var OVERFLOW = [];       /* rec 已清场后的有界溢出缓冲 */
  var DONE = [];           /* 落账封版后的日志快照（rec 清场后 blog 不可达，战后复盘靠它） */
  BL._seq = 0;

  BL.push = function (id, move, detail) {
    try {
      var rec = (GAME.battle && GAME.battle._recOf) ? GAME.battle._recOf(id) : null;
      BL._seq += 1;
      var entry = {
        seq: BL._seq, move: String(move || ''),
        at: (GAME.utils && GAME.utils.now) ? GAME.utils.now() : 0,
        round: rec ? (rec.round || 0) : 0,
        detail: detail || null
      };
      if (rec) {
        rec.blog = rec.blog || [];
        rec.blog.push(entry);
        if (rec.blog.length > 400) rec.blog.shift();   /* 有界：超长战斗不涨存档 */
        /* v142.3：settle 即封版 —— 趁 rec 还在，把终态日志快照进 DONE，
           否则下一步 rec 被清出 s.battles，这份日志就永远读不到了 */
        if (entry.move === 'settle') BL.close(id, rec.blog);
      } else {
        OVERFLOW.push(entry);
        if (OVERFLOW.length > 50) OVERFLOW.shift();
      }
      return entry;
    } catch (e) {
      /* 观测层故障不许影响战斗：静默降级（调用方不依赖返回值做判断） */
      return null;
    }
  };

  /* 封版：把终态日志快照进 DONE（有界 20 场，同 id 重开覆盖旧档） */
  BL.close = function (id, log) {
    try {
      DONE = DONE.filter(function (d) { return d.id !== id; });
      DONE.push({ id: id, log: (log || []).slice(),
        at: (GAME.utils && GAME.utils.now) ? GAME.utils.now() : 0 });
      if (DONE.length > 20) DONE.shift();
    } catch (e) { /* 观测层静默降级 */ }
  };

  /* 读：某场战斗的日志（活记录优先 → 封版快照兜底 → 老档无该字段 = 空数组） */
  BL.of = function (id) {
    var rec = (GAME.battle && GAME.battle._recOf) ? GAME.battle._recOf(id) : null;
    if (rec) return rec.blog || [];
    for (var i = DONE.length - 1; i >= 0; i--) if (DONE[i].id === id) return DONE[i].log;
    return [];
  };
  /* 读：溢出缓冲（落账清场后仍被 push 的条目 —— 正常应为空） */
  BL.overflow = function () { return OVERFLOW.slice(); };

  /* ============================================================
   * ③ 日志自检（三条不变式；chain-audit / 属性测试 / 调试共用）
   * 返回 { ok: true, moves: n } 或 { ok: false, why: '...' }
   * ============================================================ */
  BL.check = function (log) {
    if (!log || !log.length) return { ok: false, why: '空日志（老档或未建档）' };
    var bad = [], state = null, i, e, m;
    for (i = 0; i < log.length; i++) {
      e = log[i];
      m = BL.MOVES[e.move];
      if (!m) { bad.push('#' + i + ' 未知动作「' + e.move + '」'); continue; }
      if (state !== null && m.from.length && m.from.indexOf(state) < 0) {
        bad.push('#' + i + '「' + e.move + '」在状态 ' + state + ' 下不合法');
      }
      /* 回合号单调不减（同回合内可有多条，但不许回退） */
      if (i > 0 && (e.round || 0) < (log[i - 1].round || 0)) {
        bad.push('#' + i + ' 回合号回退 ' + (log[i - 1].round || 0) + '→' + (e.round || 0));
      }
      state = m.to;
    }
    var terminal = log.filter(function (x) { return x.move === 'settle'; });
    if (terminal.length > 1) bad.push('settle 出现 ' + terminal.length + ' 次（落账只能一次）');
    if (terminal.length === 1 && terminal[0] !== log[log.length - 1]) bad.push('settle 不在日志末尾（落账后还有动作）');
    if (state === 'settling') bad.push('日志停在 settling（finish/retreat 后没有落账）');
    if (state !== 'done') bad.push('日志未到终态 done（当前 ' + state + '）');
    return bad.length ? { ok: false, why: bad.join('；') } : { ok: true, moves: log.length };
  };

  /* 汇总：从日志还原一场仗的轮廓（战报/调试/回放校验用） */
  BL.summarize = function (log) {
    var out = { moves: (log || []).length, steps: 0, rounds: 0, ended: false, retreat: false, detail: null };
    (log || []).forEach(function (e) {
      if (e.move === 'step') out.steps += 1;
      if (e.move === 'retreat') out.retreat = true;
      if (e.move === 'settle') { out.ended = true; out.detail = e.detail; }
      out.rounds = Math.max(out.rounds, e.round || 0);
    });
    return out;
  };
})();
