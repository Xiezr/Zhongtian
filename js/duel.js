/* ============================================================
 * js/duel.js — **斗将竞技场** 引擎（v144.1 · 老板「斗将正式化」）
 * ------------------------------------------------------------
 * 老板原话：「一个对战场景，两边是双方画像，每回合各自主动出手一次，
 *   画像飞向对方并造成伤害，伤害有英雄攻击，防御决定，血量由体力决定」。
 *
 * 三条口径（**只此一份**，界面/前传/场景遭遇/测试同读）：
 *   ① 血量 = 体力上限（staMax）；开打时的血 = **当前体力**（体力就是这一仗的本钱）
 *   ② 伤害 = 血池基准 × 攻防对冲 × 出手倍率 × 挨打倍率 × 克制 × 确定性抖动
 *       · 攻防对冲沿用 `DATA.CLASH` 的 K·A/(A+D)（与军队战**同一把尺**）
 *       · 血池基准 = √(双方体力上限)（几何平均）——
 *         于是"体力"与"攻防"两头都真起作用，且对等级/装备跨度免疫：
 *         血厚者更耐打（挨的绝对血更多），攻高防低者打得更疼。
 *         若改用"挨打方自己的血条"当基准，体力就成了摆设（掉血按比例，几合必死不变）。
 *   ③ 每合**双方各出手一次**（都出手、都掉血），不是"你一下我一下"；
 *      招式相克只改倍率（克招方 ×critMul / 被克方 ×weakMul），不改"谁出手"。
 *
 * 纯函数：`play()` 用**累积出招序列**从头复算（同 seed 同招 → 逐位同结果），
 *   不落任何状态 —— 与 `battle.duelPlay` 同构，挂起/重开都不会漂。
 *   落账（经验/体力/战利品/难度下降）由调用方（prologue.duelStep）负责。
 *
 * ⚠️ 与 `battle.duelPlay`（5 合比分制 · 势力叫阵/挑衅在用）是**两个玩法**：
 *   那个是"心理战比谁占先"，这个是"真打血量"。相克表与对手倾向**共用**
 *   （`DATA.DUEL.moves` / `battle.duelEnemyMove`），不另起一套。
 * ============================================================ */
import './core.js';
import './data.js';
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA;

  var DU = GAME.duel = {};

  /* ---------- 配置（数值全在 DATA.DUEL_ARENA，改平衡只改那里） ---------- */
  DU.cfg = function () { return DATA.DUEL_ARENA || {}; };

  /* ---------- 三条口径的零件（界面与断言都要读，故逐个开出口） ---------- */
  /* 血量：体力上限（下限 1 —— 不允许出现 0 血开打） */
  DU.hpMaxOf = function (g) {
    var a = (g && GAME.genAttrs) ? GAME.genAttrs(g) : null;
    var v = a ? (a.staMax || 0) : (g && g.staMax) || 0;
    return Math.max(1, Math.round(v || 100));
  };
  /* 开打时的血 = 当前体力（体力不满 = 这一仗的本钱就薄） */
  DU.hp0Of = function (g) {
    var a = (g && GAME.genAttrs) ? GAME.genAttrs(g) : null;
    var now = a ? (a.sta != null ? a.sta : a.staMax) : (g && g.stamina) || 0;
    var mx = DU.hpMaxOf(g);
    return Math.max(1, Math.min(mx, Math.round(now || mx)));
  };
  DU.atkOf = function (g) {
    var a = (g && GAME.genAttrs) ? GAME.genAttrs(g) : null;
    return Math.max(1, Math.round(a ? (a.atk || 0) : (g && g.attack) || 0));
  };
  DU.defOf = function (g) {
    var a = (g && GAME.genAttrs) ? GAME.genAttrs(g) : null;
    return Math.max(0, Math.round(a ? (a.def || 0) : (g && g.defense) || 0));
  };
  /* 攻防对冲（与军队战同一把尺 —— 见 tactic.clashFactor 的注释） */
  DU.clash = function (A, D) {
    var K = ((DATA.CLASH || {}).K == null ? 2 : DATA.CLASH.K);
    A = Math.max(0, A || 0); D = Math.max(0, D || 0);
    if (A + D <= 0) return 1;
    return K * A / (A + D);
  };
  /* 血池基准 = √(双方体力上限) */
  DU.hpRefOf = function (a, b) {
    return Math.sqrt(DU.hpMaxOf(a) * DU.hpMaxOf(b));
  };
  /* 单次伤害（纯函数）：血池基准 × 对冲 × 倍率 × 抖动，下限 1（没有"零伤害的出手"） */
  DU.hitOf = function (hpRef, atk, def, mul, taken, advMul, jitter) {
    var C = DU.cfg();
    var rate = C.rate == null ? 0.18 : C.rate;
    var v = hpRef * rate * DU.clash(atk, def) * (mul || 1) * (taken || 1) * (advMul || 1) * (jitter || 1);
    return Math.max(1, Math.round(v));
  };

  /* ---------- 叫阵门槛：体力就是血，低于比例不许叫阵 ---------- */
  DU.gate = function (g) {
    var C = DU.cfg();
    var need = C.minStaPct == null ? 0.15 : C.minStaPct;
    var mx = DU.hpMaxOf(g), now = DU.hp0Of(g);
    if (mx <= 0 || now / mx >= need) return { ok: true, pct: mx ? now / mx : 1 };
    return { ok: false, pct: now / mx,
      msg: '气力只剩 ' + Math.round(now / mx * 100) + '%（血就是体力）—— 先歇过再来叫阵' };
  };

  /* ---------- 复算一整场（纯函数 · 唯一判定出口） ----------
     moves：我方逐合出招（长度 = 已打合数）；对手每合的招由
     `battle.duelEnemyMove` 按属性倾向确定（与比分制共用 —— 不另起一套）。
     返回 null 仅当"人都不齐"（调用方按失败处理）。 */
  DU.play = function (a, b, moves, seed) {
    var C = DU.cfg();
    var D = DATA.DUEL || {}, MV = D.moves || {};
    if (!a || !b) return null;
    moves = moves || [];
    var maxA = DU.hpMaxOf(a), maxB = DU.hpMaxOf(b);
    var hpRef = DU.hpRefOf(a, b);
    var atkA = DU.atkOf(a), defA = DU.defOf(a);
    var atkB = DU.atkOf(b), defB = DU.defOf(b);
    var hpA = DU.hp0Of(a), hpB = DU.hp0Of(b);
    var jitter = C.jitter == null ? 0.12 : C.jitter;
    var critMul = C.critMul == null ? 1.6 : C.critMul;
    var weakMul = C.weakMul == null ? 0.6 : C.weakMul;
    var maxR = C.maxRounds || 12;
    var rows = [], log = [], wa = 0, wb = 0, winner = null, over = false;
    var ida = a.id || 'a', idb = b.id || 'b';
    var nmA = a.name || '我', nmB = b.name || '对手';

    for (var i = 0; i < moves.length && i < maxR; i++) {
      var ma = moves[i];
      var mb = (GAME.battle && GAME.battle.duelEnemyMove) ? GAME.battle.duelEnemyMove(b, i + 1, seed) : 'stab';
      /* 克制：只改倍率，不改"谁出手"（每合双方都出手） */
      var adv = 0;
      if (ma !== mb) {
        if (MV[ma] && MV[ma].beats === mb) adv = 1;
        else if (MV[mb] && MV[mb].beats === ma) adv = -1;
      }
      var mvA = MV[ma] || {}, mvB = MV[mb] || {};
      var jA = 1 + ((GAME.invasionRoll ? GAME.invasionRoll('duelj|' + ida + '|' + (i + 1) + '|' + seed) : 0.5) * 2 - 1) * jitter;
      var jB = 1 + ((GAME.invasionRoll ? GAME.invasionRoll('duelj|' + idb + '|' + (i + 1) + '|' + seed) : 0.5) * 2 - 1) * jitter;
      /* 我打他：我的出手倍率 × 他这一招的破绽（taken） × 克制倍率 */
      var dmgToB = DU.hitOf(hpRef, atkA, defB, mvA.mul, mvB.taken,
        adv > 0 ? critMul : (adv < 0 ? weakMul : 1), jA);
      /* 他打我：同理 */
      var dmgToA = DU.hitOf(hpRef, atkB, defA, mvB.mul, mvA.taken,
        adv < 0 ? critMul : (adv > 0 ? weakMul : 1), jB);
      hpA = Math.max(0, hpA - dmgToA);
      hpB = Math.max(0, hpB - dmgToB);
      if (adv > 0) wa++; else if (adv < 0) wb++;
      rows.push({
        r: i + 1, a: ma, b: mb,
        aName: mvA.name || ma, bName: mvB.name || mb,
        res: adv > 0 ? 'a' : (adv < 0 ? 'b' : 'tie'),
        dmgToA: dmgToA, dmgToB: dmgToB, hpA: hpA, hpB: hpB
      });
      log.push('第' + (i + 1) + '合：' + (mvA.name || ma) + ' 对 ' + (mvB.name || mb)
        + '　我掉 ' + dmgToA + ' · 他掉 ' + dmgToB);
      if (hpA <= 0 || hpB <= 0) break;
    }

    if (hpB <= 0 && hpA > 0) { winner = 'atk'; over = true; }
    else if (hpA <= 0 && hpB > 0) { winner = 'def'; over = true; }
    else if (hpA <= 0 && hpB <= 0) {                 /* 同归于尽：按这一合谁打得多 */
      winner = (rows.length && rows[rows.length - 1].dmgToB >= rows[rows.length - 1].dmgToA) ? 'atk' : 'def';
      over = true;
    } else if (moves.length >= maxR) {               /* 打满：比谁剩得多（按比例） */
      var ra = hpA / maxA, rb = hpB / maxB;
      winner = ra > rb ? 'atk' : (rb > ra ? 'def' : 'draw');
      over = true;
    }
    if (over) {
      log.push(winner === 'atk' ? (nmA + ' 拿下（' + hpA + '/' + maxA + ' 对 ' + hpB + '/' + maxB + '）')
        : winner === 'def' ? (nmB + ' 拿下（' + hpA + '/' + maxA + ' 对 ' + hpB + '/' + maxB + '）')
        : '打满 ' + maxR + ' 合，谁也没倒（平手）');
    }
    return {
      rounds: rows, hpA: hpA, hpB: hpB, maxA: maxA, maxB: maxB, hpRef: Math.round(hpRef),
      atkA: atkA, atkB: atkB, defA: defA, defB: defB,
      wa: wa, wb: wb, winner: winner, over: over, maxRounds: maxR, log: log
    };
  };
})();
