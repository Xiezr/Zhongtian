/* ============================================================
 * tactic.js  回合制文字战斗场景（v27 · 需求 5）
 * ------------------------------------------------------------
 * 把"一场仗"从抽象掷骰改成**看得见的战场**：
 *
 *   · 战场是一条**网格化的距离轴**（抽象网格地图），双方相向推进。
 *     距离：攻打野地 2000，攻打野外城池 3000，攻打城池 4000。
 *   · **回合制**。每回合所有存活部队按**速度从高到低**行动（速度含将领加成）。
 *   · v89.87（老板拍板）：每兵种每回合**主动攻击一个目标**；主目标吃满伤害后，
 *     **v89.95 起：一击只打一个目标兵种，溢出伤害作废（无溅射）**——
 *     老板原话：「战斗一个回合只对一个目标兵种出手，后续无溅射伤害」。
 *     改前是"主目标吃满后，溢出对射程内每个敌方兵种各溅射 30%"，
 *     结果是"一回合清掉对面两三支"、战斗 1~3 回合结束（没有回合对战可玩）。
 *   · 行动规则：与最近一支敌军的间距若已在射程内 → 开火；
 *     否则**向对方推进"该兵种速度"这么远**，直到接触对方最前方的兵种。
 *   · 攻击值 = （兵种基础攻击 + 将领/装备加成的攻击）× 该兵种数量
 *     × 攻城修正 × 勇武/科技/宝物/羁绊等百分比加成。
 *   · 杀伤效果 = 攻击值 ÷ 受击部队的**兵种生命值**
 *     （生命值受**守方将领**加成：补给技巧、将领体力、智谋与护甲）。
 *   · 双方将领的四维都参与 —— 攻方看勇武与装备攻击，守方看智谋与生命加成。
 *
 * 与旧实现的关系：
 *   旧的"整军对拼掷骰"保留为 `GAME.battle.simulateDice`（可回退），
 *   `GAME.battle.simulate` 默认走本引擎。两者返回**同一组字段**
 *   （winner / atkLoss / defLoss / atkRemain / defRemain / rounds / log），
 *   于是上层（出征、行军队列、伤兵、战报）一行都不用改。
 *
 * 本引擎**完全确定**（不含 Math.random）—— 同样的输入必得同样的结果，
 * 这也是"装备/体力让损兵更少"这类对比断言能稳定成立的前提。
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  var T = GAME.tactic = {};

  /* ============================================================
   * 战场距离（v57 · 老板拍板：改成「双方最远射程 + 199」）
   * ------------------------------------------------------------
   * 改前是**场地常数**（wild 2000 / fort 3000 / city 4000）—— 也就是说
   * "带不带远程"只影响能不能隔空打，**不影响开战间距**。
   * 原版（4399 战争系统页 + 玩家实测多源一致）：
   *     战场距离 = 双方【最远射程】 + 199     （官方写 +200，实测 +199，差 1 是取整）
   * 自洽验证：野战无远程无城防时战场距离 = **270**，而近战里最远的是铁骑 **70** →
   *     70 + 200 = 270 ✓ —— 所以**近战射程也参与比较**，不是只看远程。
   * 例：满抛射（+50%）弓 1200×1.5=1800 → 1999 ✓；床弩 2299 ✓；投石 2599 ✓。
   *
   * 为什么这是六项里唯一的**结构性**改动：抛射科技不只加射程，它同时把开战间距
   * 推远 → **远程方拿到先手**（老玩家说"弓的第一回合先发打击是关键"的机制来源）。
   * 距离不再是背景参数，它是**先手权的一部分**。
   * ============================================================ */
  /* v89.95（B2）：纵深 = 最远射程 + MARGIN，且**不得小于 FIELD_MIN**。
     老板原话：「现在的速度对战斗具有决定性影响（一步到面前，先手打击，
     溅射伤害收场，根本没有回合对战乐趣）」。
     改前 FIELD_MIN=200、MARGIN=199 → 纯近战纵深 249，而长枪速度 300 →
     **第 1 回合就贴脸**，先手方一轮打光对手。
     ------------------------------------------------------------
     v89.139（老板 1）：「**战场距离不对，考虑兵种速度和最远射程**」——
     旧口径的 1400 是**常数保底**：谁打谁都一样远，于是
       · 民夫互殴（spd 180）要 7.8 回合才接敌，30 回合上限里净走路；
       · 铁骑互冲（spd 600）2.3 回合就贴脸 —— 速度差异只体现为"快的一方先到"，
         但"多久开始打"完全没跟配兵走。
     新口径 = **三个下限取大**：
       ① 最远射程 + MARGIN（原版规则，保证远程方的"进入射程"过程）；
       ② (双方最快单位速度之和) × MARCH_ROUNDS_MIN —— **快 vs 快**时把纵深撑开，
          防"两个精锐骑兵第 1 回合互撞"（老板 v89.95 抱怨的"一步到面前"）；
       ③ FIELD_MIN 1400 保底（慢速组合：民夫互殴也不至于 1 回合贴脸）。
     速度口径与引擎推进**同一把尺**（`t.spd × spdMult(t)`，见 unitsOf 的 spd 字段），
     所以"几步接敌"的推算与实战逐回合记录一致。
     ⚠️ MARCH_ROUNDS_MIN 为什么是 2 而不是 3：
       接敌回合 R = ⌈D ÷ (vA+vD)⌉；若 ②用 ×3，则 D ≥ 3(vA+vD) → **所有配兵都恰好
       3 回合接敌**（速度差异被完全抹平，与"考虑兵种速度"的意图相反）。
       ×2 只抬高快组合的下限：轻骑 vs 义兵 2 回合、长枪 vs 义兵 3 回合、
       民夫互殴 4 回合、投石压阵 5 回合 —— 快者仍先接敌，慢者不再 1 回合贴脸。 */
  /* v89.140（老板 1）：「战场距离是否考虑基于在场兵种**最远射程乘以某个系数**？合理设计」——
     采纳：从"+MARGIN（绝对量）"改为"× FIELD_RANGE_K（比例量）"。
     系数 1.25 的来由：原版口径 maxR+299 在主流射程段与 ×1.25 几乎重合
     （弓 1200 → 1499 vs 1500；投石 1600 → 1899 vs 2000），
     但比例式在**任意射程**下都成立（低射程交给 FIELD_MIN/速度项，高射程自然成比例放大），
     不用再问"为什么是 299 而不是别的数"。 */
  T.FIELD_RANGE_K = 1.25;
  /* ⛔ v89.141：射程**加数式**常数（FIELD_MARGIN，值 299）已删 ——
     v89.140 起纵深改**比例式**（最远射程 × FIELD_RANGE_K），加数式是历史口径；
     留着只会让人以为"哪里还有一处 +299"。纵深三段口径见 battlefieldOf。 */
  /* 快 vs 快的最少接敌回合（接敌回合 = ⌈D ÷ (vA+vD)⌉ ≥ 本值），见上方 ⚠️ 论证 */
  T.MARCH_ROUNDS_MIN = 2;
  /* 绝对保底（v89.95 立的规矩：接敌要走几回合）——慢速组合由它兜底 */
  T.FIELD_MIN = 1400;
  /* ============================================================
   * 溢出溅射比例（v89.87 · 老板拍板）
   * ------------------------------------------------------------
   * 「每个兵种每回合只主动攻击一次，目标为其中一个兵种」——
   * 主目标吃满本次伤害后，**超出部分对射程内其他每个敌方兵种各溅射 30%**。
   * 取代原 v57 的「溢出按由近及远**全额**顺延」。
   * 标靶是**兵种**（编队）不是个体：溅射量按各自防御/生命折算杀兵数，
   * 各自钳制在实有人数内（打不光更多）。
   * ============================================================ */
  /* v89.95（B1）：`T.SPLASH_PCT` **退役**（一击一目标，溢出作废）。
     保留常量 = 0 只为兼容旧引用点（smoke 的老断言会改成新口径）。 */
  T.SPLASH_PCT = 0;
  /* 旧场地常数**保留为回退值**：`opts.field` 显式传入时仍然可用
     （旧战报回放、跨服类玩法要另设距离），不让老数据算不出来。 */
  T.FIELD = { wild: 2000, fort: 3000, city: 4000 };
  T.fieldOf = function (kind) { return T.FIELD[kind] || T.FIELD.wild; };

  /* 一支部队"计入战场距离"的射程：含射程科技与剧情修正；
     守城时远程/器械在城头，射程并入城头火力圈（与 actSide 的 onWall 同一口径）。 */
  function fieldRangeOf(t, side, wallR) {
    var r = (t.range || 0) * (1 + TB('range'));
    if (GAME.story && GAME.story.combatMod) r *= (GAME.story.combatMod().archerRange || 1);
    if (side === 'def' && wallR > 0 && (t.range || 0) >= 500) r = Math.max(r, wallR);
    return r;
  }
  /* 战场距离的唯一出口。`opts.field` 显式给了就用它（旧回放/特殊玩法）。
     v89.139：数值 = max(射程下限, 速度下限, 绝对保底) —— 见 FIELD_MIN 段注释。 */
  T.battlefieldOf = function (atkArmy, defArmy, defVal, opts) {
    opts = opts || {};
    if (opts.field) return opts.field;
    var wallR = opts.sieging ? T.wallFireRangeRaw(defVal, opts.wallLv, opts.towers) : 0;
    /* v59：**箭塔是独立火力源 → 它的射程无条件参与"最远射程"比较**。
       改前只把 wallR 借给"守方远程兵"（fieldRangeOf 的 side==='def' 分支），
       于是守军全近战时箭塔撑不起战场 —— 而原版明说"箭塔射程 2500，我在 2600 还被打到"。 */
    var maxR = wallR;
    /* v89.139：顺带收双方"最快单位速度"（与引擎 unitsOf 的 spd 同一把尺：
       `round(t.spd × spdMult(t))`，将领加成 battle 层已并入 spdMult 的场景除外）。 */
    var fastA = 0, fastD = 0;
    function scan(army, side) {
      Object.keys(army || {}).forEach(function (id) {
        var t = DATA.TROOPS[id];
        /* 斥候不参战、也不该把战场撑大/撑快 */
        if (!t || t.nocombat) return;
        var r = fieldRangeOf(t, side, wallR);
        if (r > maxR) maxR = r;
        var sd = Math.round((t.spd || 0) * spdMult(t));
        if (side === 'atk') { if (sd > fastA) fastA = sd; }
        else { if (sd > fastD) fastD = sd; }
      });
    }
    scan(atkArmy, 'atk');
    scan(defArmy, 'def');
    var spdFloor = Math.round((fastA + fastD) * T.MARCH_ROUNDS_MIN);
    /* v89.140：射程项改 `maxR × FIELD_RANGE_K`（比例式）——三下限取大不变 */
    return Math.max(T.FIELD_MIN, Math.round(maxR * T.FIELD_RANGE_K), spdFloor);
  };

  /* ============================================================
   * 战场机动（v57 · 老板拍板：改回原版 **1:1**）
   * ------------------------------------------------------------
   * v29 曾按「每 1 点速度 = 每回合推进 2.4 丈」换算，为的是让兵种速度差异在
   * 2000/3000/4000 的**大纵深**里看得出来（当时连轻骑都要 3~5 回合才摸到墙）。
   * 现在纵深换成"最远射程 + 199"（野地常常只有 249~1400），再乘 2.4 会一步贴脸，
   * 所以改回原版的 **1:1：速度就是每回合推进的丈数**。
   * 原版战报实录可逐项验证：满科技轻骑"前进 1500"、铁骑 900、长枪 600、
   * 刀盾 550、弓 500 —— 与它们的（含科技）速度一致。
   * ============================================================ */
  T.MARCH_UNIT = 1;
  /* ============================================================
   * v89.96（老板批注「伤害计算不要乱定系数，计算过程应当简洁」）：
   * v89.95 的 `T.DAMAGE_SCALE`（末端总闸）**已删除** —— 平衡一律在源头修：
   *   · 兵种耐久：hp ×10（data.js；杀率地基从 0.73/回合 → 0.073）
   *   · 属性覆盖：勇武/智谋 每 20 点 +1%（genAttrs.atkPct/defPct，唯一换算原子）
   *   · 相克表：**v89.179 已全撤**（战斗按兵种纸面数值；沿革见 data.js 墓碑）
   * 伤害公式回到直读关系：k = perAtk × 数量 × cf ÷ perHp（无任何隐藏乘数）。
   * ============================================================ */
  /* v89.95（B2）：**单回合推进上限** = 纵深 × MARCH_CAP_FRAC。
     速度再高也不能一回合贴脸（老板：「一步到面前」）——超出的部分被截掉，
     于是"速度优势"表现为**早 1~2 回合接敌**，而不是"一轮打光"。 */
  T.MARCH_CAP_FRAC = 0.35;
  T.advanceCapOf = function (D) {
    return Math.max(60, Math.round((D || T.FIELD_MIN) * T.MARCH_CAP_FRAC));
  };

  /* ============================================================
   * v89.103（老板「两方应该在同一片战场上战斗」）：**前线几何**（唯一出口）
   * ------------------------------------------------------------
   * 战场是一条**共享的距离轴**：0 = 我军出发线，D = 敌军出发线。
   *   · 我方前线 = 我方最前**存活**部队的 adv（`frontAdvOf`）；
   *   · 敌方前线 = D − 敌方最前存活部队的 adv；
   *   · 间距     = D − 两方最前之和（与每回合记的 `gap` 同一公式）；
   *   · 接触     = 两军前沿间距已为 0（或已互相出手 —— 见 `hot`）。
   * 引擎的 `front()` 与沙盘/实时战场画的"前线/接触线"都读这里，
   * 界面不许另算一套（改前沙盘把两军各自钉在左右半场，中间 8% 是永久空档，
   * 于是"两半的兵永远不接触"）。
   *
   * `frontAdvOf`：全灭返回 **null**（不是 0）—— 调用方据此区分
   * "还没有人"与"人都在出发线上"（沙盘要靠它画"被攻入腹地"）。
   * ============================================================ */
  T.frontAdvOf = function (list) {
    var m = null;
    (list || []).forEach(function (u) {
      if (u.count > 0 && (m === null || u.adv > m)) m = u.adv;
    });
    return m;
  };
  /* 两军前线几何（唯一出口）。atkUnits/defUnits 只要有 {count, adv, er} 即可
     （引擎的部队、沙盘的态都满足）。
     ============================================================
     v89.104（老板）：「接触判定**按双方位移** —— 如果我一步来到你面前，
     你不能再往前移动；直到我这个兵种被完全消灭，你的后续移动才可以向前」
     ------------------------------------------------------------
     判据从"有没有开过火"（旧 hot 锁）改成**纯位置**：
       接触 = 两军前沿之间的空档 ≤ 双方最前部队的**有效射程**较大者。
     为什么用射程而不是 0：引擎的推进规则是"走到能开火就停"（free = gap − 射程），
     所以近战也是停在 gap = 射程（10~80）而不是贴到 0 —— 用射程判据，
     接触恰好发生在"两军都推不动了"的那一刻（位置事实，与打没打无关）。
     前沿互锁由引擎的推进规则保证：`adv ≤ D − 敌方前沿 − 射程`，
     任何一方都不可能推过对面（smoke/probe 有逐回合断言）。
     ============================================================ */
  T.frontsOf = function (atkUnits, defUnits, D) {
    D = D || T.FIELD_MIN;
    var fa = T.frontAdvOf(atkUnits), fd = T.frontAdvOf(defUnits);
    var aAlive = fa !== null, dAlive = fd !== null;
    /* 全灭的一方"前线"退回自己的出发线 —— 这就是"被攻入大军腹地" */
    var aAdv = aAlive ? Math.max(0, fa) : 0;
    var dAdv = dAlive ? Math.max(0, fd) : 0;
    var posA = aAdv;                       // 我方前沿（共享轴）
    var posD = D - dAdv;                   // 敌方前沿（共享轴）
    var gap = Math.max(0, posD - posA);    // 两军之间的空档
    var broke = !aAlive ? 'atk' : (!dAlive ? 'def' : null);
    /* 双方最前部队的有效射程（缺 er 时退回基础射程） */
    function reachOf(list) {
      var best = 0, m = null;
      (list || []).forEach(function (u) {
        if (u.count <= 0) return;
        if (m === null || u.adv > m) { m = u.adv; best = (u.er != null ? u.er : (u.range || 0)); }
      });
      return best;
    }
    var reach = Math.max(reachOf(atkUnits), reachOf(defUnits));
    var contact = gap <= reach;
    /* 接触线 = 两条前线的中点（= 两军贴着时就是那条贴着的线；
       还没接触时它落在两军之间的空地上，随两军推进而移动到中线）。 */
    var mid = broke ? (broke === 'atk' ? 0 : D) : (posA + posD) / 2;
    return {
      aFront: aAdv, dFront: dAdv,          // 两方最前（各自从本方出发线量）
      posA: posA, posD: posD,              // 两条前线的共享轴坐标
      gap: gap, reach: reach,
      contact: contact,
      broke: broke,                        // 'atk' | 'def' | null
      mid: mid,                            // 接触线位置
    };
  };

  /* ============================================================
   * v89.176（老板「谁在下一回合接敌」）：**接敌预测**（唯一出口）
   * ------------------------------------------------------------
   * 复刻 stepRound 的行动语义，对**当前快照**预演"本回合结束时各支走到哪"，
   * 再判定"下一回合谁将与敌交手"：
   *   · 行动顺序：速度降序、同速守方先（与 stepRound 的 order 同规）；
   *   · 目标选择：指定目标（在场）优先 → 否则"最近"（与 actSide 同规）；
   *   · 推进：free = gap − er（能开火就停）、每回合 ≤ spd、全局封顶 advanceCapOf(D)；
   *   · 开火：预演后 gap ≤ er（与 actSide 的 `if (gap <= effRange)` 同判据）。
   * 返回：
   *   fire     下一回合将开火的支 [{side, id, tgt, gap}]
   *   incoming 下一回合将挨打的支 [{side, id, by, gap}]（fire 的对偶）
   *   engage   合并集合 { 'atk|id': true, ... }（UI 角标按它标记）
   *   contact  两军前沿在预演后是否接触（frontsOf 同口径）/ gapAfter
   * ⚠️ 它是**预测**（给界面预警用），不参与任何结算：攻击造成的减员不在预演里
   *    （探针 probe_v89176e 逐回合对账，属于"预告"不是"保证"）。
   * ============================================================ */
  T.contactForecast = function (atkUnits, defUnits, D) {
    D = D || T.FIELD_MIN;
    var cap = T.advanceCapOf(D);
    var atk = (atkUnits || []).filter(function (u) { return u && u.count > 0; });
    var def = (defUnits || []).filter(function (u) { return u && u.count > 0; });
    function kk(side, id) { return side + '|' + id; }
    function erOf(u) { return (u.er != null ? u.er : (u.range || 0)) || 0; }
    var adv = {};
    atk.forEach(function (u) { adv[kk('atk', u.id)] = u.adv || 0; });
    def.forEach(function (u) { adv[kk('def', u.id)] = u.adv || 0; });
    var list = [];
    atk.forEach(function (u) { list.push({ u: u, side: 'atk' }); });
    def.forEach(function (u) { list.push({ u: u, side: 'def' }); });
    list.sort(function (x, y) {
      if ((y.u.spd || 0) !== (x.u.spd || 0)) return (y.u.spd || 0) - (x.u.spd || 0);
      return x.side === 'def' ? -1 : 1;      /* 同速守方先（与 stepRound 同规） */
    });
    function foesOf(side) { return side === 'atk' ? def : atk; }
    function posOf(side, id) {
      return side === 'atk' ? adv[kk('atk', id)] : D - adv[kk('def', id)];
    }
    function gapOf(side, id, foeSide, foeId) {
      /* 共享轴上两支的间距 —— 用**绝对值**（不依赖谁在左谁在右：
         atk 的 pos = adv、def 的 pos = D − adv，两侧比较时符号天然相反，
         用差值会在一侧恒为 0 —— 对账探针 probe_v89176e 修正）。 */
      return Math.abs(posOf(side, id) - posOf(foeSide, foeId));
    }
    function recOf(ent) {
      var foes = foesOf(ent.side);
      var pref = null;
      if (ent.u.target) {
        foes.forEach(function (e) { if (e.id === ent.u.target) pref = e; });
      }
      var best = null, bg = Infinity;
      (pref ? [pref] : foes).forEach(function (e) {
        var g = gapOf(ent.side, ent.u.id, ent.side === 'atk' ? 'def' : 'atk', e.id);
        if (g < bg) { bg = g; best = e; }
      });
      return best ? { e: best, gap: bg } : null;
    }
    /* 两轮：先全推（每支推一步）、再判定（用**最终位置**）。
       口径取舍（probe_v89176e 对账）：行动时刻版精确率高（81.7%）但漏报多（召回 62.5% ——
       不模拟击杀导致目标切换后够不着）；最终位置版召回高（95.6%）。
       界面是**预警**：宁多勿漏 → 取最终位置版。 */
    list.forEach(function (ent) {
      if ((ent.u.stance || 'advance') !== 'advance') return;
      var r0 = recOf(ent);
      if (!r0) return;
      var free = r0.gap - erOf(ent.u);
      if (free <= 0) return;
      var step = Math.min(ent.u.spd || 0, free, cap);
      if (step > 0) adv[kk(ent.side, ent.u.id)] += step;
    });
    var fire = [], incoming = [], engage = {};
    list.forEach(function (ent) {
      var r1 = recOf(ent);
      if (!r1) return;
      var foeSide = ent.side === 'atk' ? 'def' : 'atk';
      var g = gapOf(ent.side, ent.u.id, foeSide, r1.e.id);
      if (g <= erOf(ent.u)) {
        fire.push({ side: ent.side, id: ent.u.id, tgt: r1.e.id, gap: Math.round(g) });
        engage[kk(ent.side, ent.u.id)] = true;
        incoming.push({ side: foeSide, id: r1.e.id, by: ent.u.id, gap: Math.round(g) });
        engage[kk(foeSide, r1.e.id)] = true;
      }
    });
    /* 接触判定：用预演后的位置重算前沿（frontsOf 同口径） */
    var arrA = [], arrD = [];
    atk.forEach(function (u) { arrA.push({ count: 1, id: u.id, adv: adv[kk('atk', u.id)], er: erOf(u) }); });
    def.forEach(function (u) { arrD.push({ count: 1, id: u.id, adv: adv[kk('def', u.id)], er: erOf(u) }); });
    var fr = T.frontsOf(arrA, arrD, D);
    return { fire: fire, incoming: incoming, engage: engage,
      contact: fr.contact, gapAfter: fr.gap, reach: fr.reach, field: D };
  };
  /* 推算「几步到接触」—— 现在**接收战场距离本身**（`battlefieldOf` 算出），
     不再接场地种类：距离已经变成双方配兵的函数，"按场地查表"不成立了。
     界面把这条讲清楚，玩家才看得见兵种差异（骑兵 1 步 vs 器械靠射程先开火）。
     ⚠️ v89.139 注：这是**单侧**推进口径（"该兵种几步能开火"，用于攻城/机动对比）；
     两军迎面互推的接敌回合 = ⌈D ÷ (vA+vD)⌉，见 battlefieldOf 的 MARCH_ROUNDS_MIN 段。
     （v89.139 一度误判"零引用"而删 —— 实际 smoke §42 在用；引用面必须连测试一起 grep。） */
  T.stepsToWall = function (spd, range, D) {
    D = D || T.FIELD_MIN;
    var adv = 0, n = 0;
    /* 循环结束时 `adv + range >= D`，即**已经可以开火**，
       所以步数就是推进次数 n（不是 n+1 —— 多算一步会把轻骑兵的
       "1 步到墙"写成 2 步，与战场上的实际表现对不上）。 */
    while (adv + (range || 0) < D && n < 60) {
      var free = D - (range || 0) - adv;
      if (free <= 0) break;
      adv += Math.min(spd * T.MARCH_UNIT, free);
      n++;
    }
    return Math.max(1, n);
  };

  /* 回合上限（v57 · 老板拍板 40 → 30）
     原版：野战 30 回合，超时双方仍有兵 = 平局（极速版百科）；
     跨服「逐鹿中原」20 回合、自动/模拟战斗 10 回合 —— 那些属另设。 */
  T.MAX_ROUNDS = 30;
  /* v43：`T.VOLLEY_CAP`（单轮齐射上限）与 `T.CRAFT_CAP_BOOST` **已删除**。
     它们诞生于 v27（"一轮清场 → 战场条带只剩一帧"），但 v28 之后
     溢出杀伤 / 城头火力 / 守军固守 / 器械破城都已落地，多回合不再依赖它们；
     留下的只有副作用（按人头压制 → "龙枪兵"、指数衰减、偏袒人多一方）。
     完整论证见 actSide() 里杀伤计算处。 */

  /* ============================================================
   * 攻守常数（v28 · 需求 0）
   * ------------------------------------------------------------
   * 上一版有四处"看着有、其实没生效"，这里是补齐：
   *
   * ① 攻城器械（冲车/投石车/床弩）带 craft:true，但攻城加成只取
   *    `opts.siegeMult`，而它来自剧情羁绊/赛季国策，**默认恒为 1.0** ——
   *    于是花 19000 资源造一辆投石车，对城池的伤害和一把长枪一模一样。
   *    实测对比（1.2 万攻 / 6000 守 / 县城 Lv4 城墙）：
   *      纯长枪 1.2 万      损 8990
   *      长枪 9000 + 投石 3000  损 5155   ← 差距全来自"少了 3000 长枪"，器械本身没贡献
   *    现在给器械**内建**攻城倍率，与剧情加成相乘。
   *
   * ② 城墙 desc 写着「守军防御 +10N%、远程射程 +3N%」，实现里只有
   *    `wallLvl × 20` 加进城防值，另外两条从未落地。现按"城头火力"实现：
   *    守城时守方的远程与器械站在城上，**有效射程**随城防值放大
   *    （县城 ≈1700 / 郡城 ≈2400 / 州城 ≈3450 / 都城覆盖全场）。
   *
   * ③ 于是**战场纵深第一次真正产生战略含义**：
   *    纵深 4000 的攻城战，攻方要在城头火力下多走 2000 的距离（多挨十几轮箭雨）；
   *    纵深 2000 的野地战没有工事，攻方损失的轮数少得多。
   *    在此之前实测 2000/3000/4000 三档损兵是 59.8%/71.8%/59.8% —— 非单调，
   *    即"距离"当时只是走路回合数不同，与策略无关。
   *
   * ④ 攻方器械同时**拆城**：每多一类器械，守方城防减伤 ×0.8、城头火力 ×0.75
   *    （各最多叠 3 层）—— 这就是"带器械攻城"与"硬堆兵"的区别。
   * ============================================================ */
  /* ============================================================
   * 城防工事：箭塔（v59 · 老板"城墙改用箭塔吧，照搬原版"）
   * ------------------------------------------------------------
   * 取代 v58 的自定系数（城防值 × 120）。**数据与公式照搬原版**：
   *   · 4399 官方「城防介绍」：箭塔 生命 2000 · 攻击 300 · 防御 360 · 射程 1250
   *   · 射程 = 基础 ×(1 + 抛射) + 基础 ×(城墙等级 × 3%) + 100（墙位移）
   *     原版实测：十抛射十墙 → 1250 + 625 + 375 + 100 = **2350** ✓
   *     ⚠️ 这里是**加法**不是乘法：1250×1.5×1.3 = 2437 ≠ 2350。
   *     检索报告 §5.1 那张表的算式写作"×+30%"有歧义，只有结论数字
   *     （2250 + 100 = 2350）自洽 —— 本实现按加法口径。
   *   · **箭塔是可摧毁的**：耐久池 = 座数 × 2000 生命，攻城方把目标指定为箭塔
   *     即开始拆，火力随剩余座数线性衰减（原版战报：[守]箭塔6138-2390=3748）。
   *   · **双倍攻击区**：距离 ≤ 射程/2 + 100 时伤害 ×2
   *     （原版实测："箭塔 2350，双倍攻击区【0, 2250/2+100 = 1225】"）——
   *     这正是"贴脸拆箭塔"与"远处对射"收益差一倍的来源。
   *
   * ⚠️ `TW.perDef`（每 2 点城防值 = 1 座箭塔）是**映射系数、不是原版数据** ——
   *    原版由玩家自己建造工事，我们没有工事建造流程，只能把城防值折成座数。
   * ⚠️ `TW.tough` 是**量纲换算**：原版伤害量纲比本作大两个数量级
   *    （原版战报单次杀伤几百万，本作是几百），直接套 2000 生命会让一回合拆光全城箭塔。
   *    它只影响"拆箭塔要几回合"，不影响箭塔火力本身。
   * ============================================================ */
  var TW = DATA.WALL_TOWER;
  T.tower = TW;
  T.WALL_FIRE_RANGE_MAX = 3200;   /* 防爆护栏：照搬公式后正常玩法上限约 2875
                                     （满抛射 ×1.5 + 都城城墙 24 级 ×0.72 → 2880） */
  T.WALL_DOUBLE_BASE = 0.5;       /* 双倍攻击区的边界 = 射程 × 0.5 + 墙位移 */
  T.WALL_POS = 100;               /* 攻城时城墙（箭塔）所在位置（原版："城墙在位置 100"） */
  /* v89.109（老板「出城迎战的兵种，将可以将我方前线前移，阻止敌军靠近城墙」）：
     出城迎战部队的初始前出位置 —— **城墙（100）之外**。三个效果都是引擎既有机制
     自然产生：① 打击排序按 adv 降序 → 它先挨打（"先杀出城迎战的军队"）；
     ② 攻方主目标恒为最靠前的敌部队 → 它挡在阵前，城头守军挨不到打；
     ③ 守方仍有出城部队存活时**攻方拆不到墙**（见 actSide 的 wantTower）。 */
  T.SORTIE_ADV = 200;
  T.wallTowerCount = function (defVal) {
    return (defVal > 0) ? Math.max(1, Math.round(defVal * TW.perDef)) : 0;
  };
  /* v62：箭塔座数的**显式取值口**。
     玩家城的箭塔有两个来源（城防折出 + 工匠作坊建造，见 `GAME.towerCountOf`），
     只传 `defVal` 表达不了"自建的那部分"，所以战斗允许调用方直接给座数
     （`opts.towers`）。不传时仍按城防折出 —— NPC 城走这条老路，行为不变。 */
  T.towerCountOfArg = function (defVal, towers) {
    if (towers != null) return Math.max(0, Math.floor(towers) || 0);
    return T.wallTowerCount(defVal);
  };
  /* 箭塔射程（照搬原版加法口径）。wallLv = 城墙等级；rangeBonus = 抛射科技 */
  T.arrowTowerRange = function (wallLv, rangeBonus) {
    var base = TW.range;
    return Math.round(base * (1 + (rangeBonus || 0)) + base * (wallLv || 0) * 0.03)
      + TW.wallOffset;
  };
  /* 城头火力的存在性判据从"城防值 > 0"改成"**箭塔座数 > 0**"（v62）——
     否则一座靠工匠作坊造满箭塔但城防值为 0 的城会"有塔却打不到人"。 */
  T.wallFireRangeRaw = function (defVal, wallLv, towers) {
    if (!(T.towerCountOfArg(defVal, towers) > 0)) return 0;
    return Math.min(T.WALL_FIRE_RANGE_MAX, T.arrowTowerRange(wallLv, TB('range')));
  };
  T.wallFireRange = function (defVal, D, wallLv, towers) {
    var raw = T.wallFireRangeRaw(defVal, wallLv, towers);
    return raw > 0 ? Math.min(D, raw) : 0;
  };
  /* 箭塔齐射的攻击值 = 座数 × 300（原版箭塔攻击） */
  T.wallFirePower = function (towerCount, aliveRatio) {
    var n = towerCount * (aliveRatio == null ? 1 : aliveRatio);
    return (n > 0) ? Math.round(n * TW.atk) : 0;
  };
  /* 双倍攻击区（原版）：近半个射程内，箭塔打双倍 */
  T.wallDecay = function (gap, wallRange) {
    if (!(wallRange > 0)) return 1;
    return (gap <= wallRange * T.WALL_DOUBLE_BASE + TW.wallOffset) ? 2 : 1;
  };
  /* ---------- 阵位（v59 · 照搬原版 §九）----------
     动作决定**初始站位**：前进 = 100（第一排）/ 防御 = 50（第二排）/ 后退 = 0（第三排）。
     我们的 `adv` 轴就是"前出距离"，所以行位直接当初始 adv。 */
  T.STANCE_ROW = {};
  (DATA.STANCES || []).forEach(function (x) { T.STANCE_ROW[x.id] = x.row; });
  T.HOLD_DAMAGE_CUT = 0.5;    /* "防御"动作受到的伤害减半（报告 §九）——
                                 ⚠️ 报告 §九（2024 新版）还写着"防御 = 本回合不攻击"，
                                 但那与老版战报实证冲突（战报里"防御"中的床弩/投石**照常开火**、
                                 且守城方"城墙原地防御"却仍在反击）。
                                 两源冲突的裁决：**取老版战报口径 —— 照常开火**。
                                 理由：若"不攻击"，守方默认防御会变成完全不还手，
                                 与"守城方有先手优势""守军会反击"等其余全部资料矛盾。 */
  T.CRAFT_SIEGE_MULT = 2.2;   // 攻城器械对城池的内建伤害倍率
  T.WALL_FIRE_MUL = 0.55;     // 城头射击强度（不如平地齐射密集）
  T.CRAFT_DEF_CUT = 0.8;      // 每类器械：守方城防减伤 ×0.8
  T.CRAFT_FIRE_CUT = 0.75;    // 每类器械：城头火力 ×0.75
  T.CRAFT_STACK = 3;          // 拆城/压制最多叠 3 层
  /* v43：`T.CRAFT_CAP_BOOST` 已随单轮上限一并删除。
     v28 加它是因为"杀伤被 VOLLEY_CAP 卡死，攻城倍率换不来杀伤"；
     现在上限没了，器械的内建攻城倍率（CRAFT_SIEGE_MULT）**直接生效**，
     破阵价值由"拆城"三项（城防减伤 / 城头火力 / 内建倍率）承担，无需额外上限加成。 */

  T.GRID_COLS = 48;       /* 文字战场网格宽度（字符数） */

  /* ---------- 取值包装（battle.js 的私有工具，这里通过导出的接口取） ---------- */
  function TB(type) {
    return (GAME.battle && GAME.battle.techOf) ? GAME.battle.techOf(type) : 0;
  }
  function spdMult(t) {
    return (GAME.battle && GAME.battle.spdMult) ? GAME.battle.spdMult(t) : 1;
  }
  function hpMult(gen) {
    return (GAME.battle && GAME.battle.hpMult) ? GAME.battle.hpMult(gen) : 1;
  }
  /* v42 清理：`totalCount(army)` 已无调用点（兵力合计一律走战报里的 atkStartBy），
     属"闭包内局部死函数"—— audit 看不见这类，靠 smoke 的局部函数零调用门禁抓出。 */

  /* ============================================================
   * 部队展开：把 {兵种: 数量} 变成可行动的"部队单位"
   * ============================================================ */
  T.unitsOf = function (army, side, gen, ctx) {
    var a = gen && GAME.genAttrs ? GAME.genAttrs(gen) : null;
    var out = [];
    Object.keys(army || {}).forEach(function (id) {
      var t = DATA.TROOPS[id], n = Math.floor(army[id] || 0);
      if (!t || n <= 0) return;
      /* v28：斥候（nocombat）是侦察兵，不列阵也不挨打 ——
         它能以 3000 的速度一回合冲到对方面前，射程却只有 20，
         参战只会白白送掉。 */
      if (t.nocombat) return;
      /* 统率覆盖：统率×100 之内吃满加成，超出部分不吃（与本作既有口径一致）。
         v89.115（老板「守将在守城作战中，其属性对参与守城的军队（也就是城内所有军队）
         进行属性加成」）：**守城战**（ctx.playerDef 且本方为守方）改为**全覆盖** ——
         守将的属性加成不打统率折扣（"城内所有军队"人人有份）；
         野战/攻城的口径不动（统率覆盖 = 阵前指挥半径，是既有语义）。
         ⚠️ NPC 守城不在此列（其守将为系统派生，口径保持原样，不给攻城平衡添变量）。 */
      var covered = a ? Math.min(n, a.tong * 100 * (1 + TB('command'))) : 0;
      var cover = (a && n > 0) ? covered / n : 0;
      if (ctx && ctx.playerDef && side === 'def' && a) cover = 1;
      /* v59（阵位与指挥指令）：每支部队带**动作**与**目标**（照搬原版 §九）。
         动作决定初始站位 —— 前进 = 100（第一排）/ 防御 = 50（第二排）/ 后退 = 0（第三排），
         所以初始 `adv` 不再是 0，而是该动作的行位。 */
      /* `ctx.override` 是**引擎级**的阵位覆盖（smoke 用来对比"同一支部队在不同动作下"
         的结果，也供将来做防守战术时复用）。玩家侧只有攻方战术，见 GAME.tacticOf。 */
      var tc = (ctx && ctx.override && ctx.override[id])
        || (GAME.tacticOf ? GAME.tacticOf(side, id, ctx) : null);
      var stance = tc ? tc.s : 'advance';
      /* v89.116（老板「敌方兵种默认前进且目标为自身兵种」）——
         **NPC 那一侧**（`ctx.foeArmy` 有值 = 对面就是玩家）若没指定目标，
         默认打**与我方同兵种**的那支部队（我方没有该兵种 → 保持"任意"）。
         为什么放在引擎里：默认值必须进 `unitsInit`（战报配方就是从它重跑的），
         放在界面里改 = 沙盘重跑与史实不一致（verify 会红）。
         只给 NPC 侧：玩家部队的默认值由「出征 / 防守战术」给，不被这里改写。 */
      /* v89.149（老板 4）：「行动和目标设置的下拉框，**默认显示前进和同兵种**，比如开局都是前进，
         **弓箭兵打弓箭兵，轻骑兵打轻骑兵**」——
         v89.116 只给 NPC 一侧这个默认；本版**两侧同规**：未指定目标 → 默认打**对面同名兵种**
         （对面没有该兵种时，选靶逻辑会自然回落到"最近的敌队"，不需要额外兜底）。
         `DATA.TARGET_ANY`（战术页的「任意」）= **显式不指定** → 还原成空串（打最近的）。
         ⚠️ 必须落在**引擎**里（而不是界面）：默认值要进 `unitsInit`，战报沙盘从它重跑 ——
            放界面 = 史实与重跑不同源（v89.116 §20.5 的教训）。 */
      var tgt = tc ? (tc.t || '') : '';
      if (tgt === DATA.TARGET_ANY) tgt = '';
      else if (!tgt) tgt = id;
      /* v89.109：防守侧「出城迎战」—— 前出到城墙之外（不改动作，改初始位置） */
      var sortie = !!(tc && tc.sortie);
      out.push({
        id: id, name: t.name, side: side, count: n, start: n,
        hpPer: t.hp, range: t.range,
        spd: Math.round(t.spd * spdMult(t) * (1 + (a ? (a.spd || 0) : 0) / 300)),
        cover: cover,
        stance: stance,
        target: tgt,
        sortie: sortie,
        adv: sortie ? T.SORTIE_ADV : (T.STANCE_ROW[stance] || 0),
        /* v89.96（老板「控制影响战斗的其他因素」）：攻/防加成**只走一个来源** ——
           genAttrs 的 atkPct/defPct（唯一换算原子见 domain.js atkPctOf/defPctOf）。
           旧版在这里散装 yw/zm/eqAtk/eqDef 四个字段、在 perAtk/perDef 里各乘一遍，
           与 UI 展示（v52 换算链）相差 4 倍 —— 属"显示与实战分离"，已并链。 */
        atkPct: a ? (a.atkPct || 0) : 0,
        defPct: a ? (a.defPct || 0) : 0,
        vsCity: !!t.craft,
      });
    });
    return out;
  };

  /* 该部队的**单位**攻击值（不含数量）：兵种基础攻 × 加成链
     （将领/装备 → 科技 → 符 → 剧情 → 攻城）。
     v89.96：将领与装备**合入同一条百分比链**（genAttrs.atkPct，每 20 点勇武 +1%、
     装备每 10 攻值 +1%）—— 旧版把装备攻击值当"绝对值加到兵种攻上"
     （弓 220 + 装备 8000 = ×37），与 UI 展示链相差 4 倍；已并链。 */
  T.perAtk = function (u, opts) {
    opts = opts || {};
    var t = DATA.TROOPS[u.id];
    var base = t.atk;                                  // 兵种基础攻（唯一来源）
    var pct = 1 + (u.atkPct || 0) * (u.cover || 0);    // 将领+装备（atkPct 唯一换算原子）
    pct *= (1 + TB('atk'));                            // 兵器技巧等
    var s = GAME.state;
    if (GAME.systems && GAME.systems.buffActive && GAME.systems.buffActive('military')
      && s && s.buffs && s.buffs.military && s.buffs.military.atk) {
      pct *= (1 + s.buffs.military.atk);          // 陷阵战鼓
    }
    if (GAME.story && GAME.story.atkMult) pct *= GAME.story.atkMult();
    /* v28：攻城器械的**内建**攻城倍率（与剧情加成相乘） */
    if (opts && opts.sieging && u.vsCity) pct *= (opts.siegeMult || 1) * T.CRAFT_SIEGE_MULT;
    return base * pct;
  };

  /* 该部队的**单位**防御值（不含数量）：兵种基础防 + 装备防御×覆盖，再乘各类百分比
     * ============================================================
     * v29（需求 11）：防御从"生命值放大"改为**独立的一维**，与攻击对冲。
     * 理由：放大生命只影响"能挨多久"，不影响"这一击打进去多少"，
     * 于是高防部队的表现是"血条莫名很长"，与攻击力之间没有直接的制衡关系。
     * ============================================================ */
  T.perDef = function (u) {
    var t = DATA.TROOPS[u.id];
    var base = t.def;                                  // 兵种基础防（v89.96：装备并链）
    var pct = 1 + (u.defPct || 0) * (u.cover || 0);     // 将领+装备（defPct 唯一换算原子）
    pct *= (1 + TB('def'));                             // 护甲/练兵一类科技
    return Math.max(1, base * pct);
  };

  /* 攻防对冲系数：2A / (A + D)
   *   A = D（攻防相当）  → 1.00　不增不减
   *   A = 2D（攻压制防） → 1.33
   *   A → ∞              → 2.00  封顶
   *   A → 0（攻不破防）  → 0     下限受"至少 1 人"保护，不会出现绝对免伤
   * 取 2A 而非 A 是为了让 A = D 时与旧公式**同量级**，避免整场战斗节奏被改写。 */
  T.clashFactor = function (A, D) {
    A = Math.max(0, A || 0); D = Math.max(0, D || 0);
    if (A + D <= 0) return 1;
    return DATA.CLASH.K * A / (A + D);
  };

  /* 受击部队的单位生命。
     v29（需求 11）：这里**只剩**兵种生命与补给/体力加成 ——
     智谋与装备护甲已移到 perDef()，不再重复计算（否则同一个防御属性被算两遍）。
     v89.96：耐久标定（原值 ×6）已并入表值 —— `hpPer = t.hp` 直读（见 data.js
     TROOPS 注释）；本函数只叠科技（TB('hp')）与将领（hpMult）加成。
     ⚠️ v89.181 修正注释：原文写"×10"，与实现（unitsInit 的 `hpPer: t.hp`）不符 ——
     实测链 表 hp=1800 → hpPer=1800 → perHp=1800（无加成），见 probe_v89180e。 */
  T.perHp = function (u, defGen) {
    return Math.max(1, u.hpPer * (1 + TB('hp')) * hpMult(defGen));
  };

  /* ---------- 兵种相克（已退役）----------
     v89.179：克制系统全撤（老板「取消所有克制关系，直接按兵种纸面数据计算」）——
     `counterAtkOf / counterDefOf` 两条出口随 data.js 两张表一并删除：战斗伤害
     只剩"兵种纸面数值 × 加成链"，不再有"打谁 / 被谁打"的对局态乘数。
     历史注记：防御向出口曾误收 army 对象 → 整套防御向静默失效（全靠实测打印发现）；
     相克系统的功过与全撤依据见 docs/v89179。 */
  

  /* ============================================================
   * 射程衰减（v57 · 老板拍板：补）
   * ------------------------------------------------------------
   * 原版：射程 **1/2 以内 = 全伤害**；**1/2 以外 = 半伤害**；
   *       **贴身 = 1/4**（两处来源写 1/4 与 1/10，取更保守的 1/4）。
   * 补它的意义：这才是"远程不能被近身"的机制来源 —— 改前我们用
   * "首轮 ×1.3"粗略代替（方向对，但没有距离轴）。补上之后，
   * **"推进到半程内"第一次成为有收益的动作**，机动与射程开始互相制衡。
   * ⚠️ 只对**远程**（射程 ≥ 500 的弓/弩/投）生效：近战本来就是贴脸互殴，
   * 给它算"贴身惩罚"等于把所有近战伤害一律除以 4，回合数会翻几倍。
   * ============================================================ */
  T.DECAY_FAR = 0.5;        // 半程以外
  T.DECAY_CLOSE = 0.25;     // 贴身
  T.CLOSE_RANGE = 120;      // "贴身"的界限（丈）
  T.DECAY_MIN_RANGE = 500;  // 低于此射程的兵种不受衰减（近战）
  T.rangeDecay = function (gap, effRange) {
    if (!(effRange > 0) || effRange < T.DECAY_MIN_RANGE) return 1;
    if (gap <= T.CLOSE_RANGE) return T.DECAY_CLOSE;
    if (gap <= effRange / 2) return 1;
    return T.DECAY_FAR;
  };

  /* ============================================================
   * 文字战场网格：一行 48 字符，左军右军相向
   * ============================================================ */
  T.strip = function (aAdv, dAdv, D) {
    var n = T.GRID_COLS;
    var aCol = Math.max(0, Math.floor(aAdv / D * n)); // 我军前锋所在列
                                                     // v59：后退会让 adv 为负，条带要兜底
    var dCol = Math.ceil((D - dAdv) / D * n);       // 敌军前锋所在列
    var out = '';
    for (var i = 0; i < n; i++) {
      if (i < aCol) out += '▓';
      else if (i >= dCol) out += '▓';
      else out += '·';
    }
    return out;
  };

  /* ============================================================
   * 主模拟
   *   atkArmy / defArmy : { 兵种: 数量 }
   *   atkGen / defGen   : 双方主将（都要参与加成 —— 需求明确）
   *   defVal            : 城防值（转为守方减伤）
   *   opts              : { kind:'wild'|'fort'|'city', sieging, defName }
   * ============================================================ */
  /* ============================================================
   * v89.87：T.begin —— 建立战斗**会话**（观战界面用）
   * ------------------------------------------------------------
   * 初始化逻辑与旧 T.simulate 完全同一套。返回 env：
   *   env.step()                        → 推进一回合（返回该回合 events/双方数量/间距/快照）
   *   env.runAll()                      → 跑到结束（≡ 旧 while 循环）
   *   env.finish()                      → 收尾组装 result（与旧返回结构完全一致）
   *   env.snap()                        → 双方部队状态快照（UI 画战场用）
   *   env.setCmd(side, troopId, {s,t})  → 为该兵种下达动作/目标指令
   *   env.units                         → { atk, def } 单位数组（内部引用）
   * 引擎**完全确定**（无随机）→ 会话可由「输入 + 逐回合指令」重放重建（存档恢复）。
   * ============================================================ */
  T.begin = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {
    opts = opts || {};
    /* v57：战场距离由**双方配兵**算出来（最远射程 + 199），不再是场地常数。
       `opts.field` 显式给了仍以它为准（旧战报回放 / 跨服类玩法另设距离）。 */
    var D = T.battlefieldOf(atkArmy, defArmy, defVal, opts);
    var s = GAME.state;

    var stances = opts.stances || {};
    /* v89.116：`foeArmy` 传"对面那支军队" —— 引擎据它给 **NPC 侧**一个默认目标
       （同兵种）。玩家在哪一侧由 `playerDef` 决定：默认玩家是攻方 → NPC 是守方。 */
    var atk = T.unitsOf(atkArmy, 'atk', atkGen,
      /* v89.136（老板 4）：modeId 透传给 GAME.tacticOf —— 出征读"细分（掠夺/占领）覆盖通用" */
      { sieging: !!opts.sieging, override: stances.atk || null, modeId: opts.modeId || null,
        foeArmy: opts.playerDef ? defArmy : null });
    var def = T.unitsOf(defArmy, 'def', defGen,
      /* v89.109：`playerDef` = 守方是**我方城池**（防御战）→ 读玩家「防守战术」设置；
         NPC 守方不传（仍用默认动作）—— 见 GAME.tacticOf 的 def 分支。 */
      { sieging: !!opts.sieging, playerDef: !!opts.playerDef, override: stances.def || null,
        modeId: opts.modeId || null,
        foeArmy: opts.playerDef ? null : atkArmy });
    /* v28：起始兵力只算**参战部队** —— 斥候不参战也不阵亡，
       若把它的数量算进 aStart，收尾的 atkLoss = aStart − aRemain 会把它记成"损失"。 */
    var aStart = atk.reduce(function (n, u) { return n + u.start; }, 0);
    var dStart = def.reduce(function (n, u) { return n + u.start; }, 0);
    /* v89.109：出城迎战部队的初始人数（掠夺前置判据"先歼灭野战军"要用） */
    var defSortieStart = 0;
    def.forEach(function (u) { if (u.sortie) defSortieStart += u.start; });
    var scoutOnly = 0;
    Object.keys(atkArmy || {}).forEach(function (id) {
      var t0 = DATA.TROOPS[id];
      if (t0 && t0.nocombat) scoutOnly += Math.floor(atkArmy[id] || 0);
    });

    /* 城防（守方减伤）+ 守方将领的城防加成（智谋已在生命里体现，这里只算城防工事） */
    var defBonus = Math.min(0.85, (defVal || 0) / 200);
    var siegeMult = (opts.sieging && GAME.story && GAME.story.siegeMult) ? GAME.story.siegeMult() : 1;

    /* 攻方攻城器械：拆城（削城防减伤）+ 压制城头火力 */
    var craftKinds = 0;
    atk.forEach(function (u) { if (u.vsCity) craftKinds++; });
    craftKinds = Math.min(T.CRAFT_STACK, craftKinds);
    if (opts.sieging && craftKinds > 0) {
      defBonus *= Math.pow(T.CRAFT_DEF_CUT, craftKinds);
    }
    var wallRange = opts.sieging ? T.wallFireRange(defVal, D, opts.wallLv, opts.towers) : 0;
    var wallFireMul = Math.pow(T.CRAFT_FIRE_CUT, craftKinds);

    var roundsLog = [], strips = [], log = [];
    var round = 0;

    function alive(list) {
      var out = [];
      list.forEach(function (u) { if (u.count > 0) out.push(u); });
      return out;
    }
    /* 前锋位置 = 存活部队里**最大**的 adv（唯一实现在 T.frontAdvOf，界面也读它）。
       ⚠️ v59 修正：初值原本写 `var m = 0` —— 而"后退"动作会让 adv 变成**负数**
       （退到自己出发线之后），于是负位置永远不大于 0、front 被钳在 0，
       **"后退拉开距离"整个失效**（实测：弓兵连续后退，间距却恒定 1349、被箭塔白打 24 回合）。
       改用 null 哨兵，允许负值。 */
    function front(list) {
      var m = T.frontAdvOf(list);
      return m === null ? 0 : m;
    }
    /* 攻守两方共用一条距离轴：间距 = 纵深 − 我方推进 − 敌方推进 */
    function gapOf(u, enemyFrontAdv) {
      return Math.max(0, D - u.adv - enemyFrontAdv);
    }

    /* 一次开火：把 shooter 的攻击力按"由近及远"落到 enemyUnits 上（溢出杀伤）。
       v57：抽成函数是为了**反击复用** —— 反击与主动攻击的伤害算法必须完全一致，
       否则"反击伤害偏低"会变成一个很难查的暗偏差。 */
    function fireOnce(shooter, enemyUnits, ctx) {
      var perA = T.perAtk(shooter, { sieging: !!opts.sieging, siegeMult: ctx.siegeMult });
      /* v89.180（老板 1「补床弩拆器械特性」）：**拆械**唯一出口 ——
         床弩兵种表 `vsMech`（对器械的最终伤害倍率）× 目标兵种表 `mech` 标签。
         主动攻击与反击都走 fireOnce，故此处一处即全覆盖；其余对位零影响。 */
      var _shT180 = DATA.TROOPS[shooter.id] || {};
      var mechMulOf = function (tgId) {
        if (!_shT180.vsMech || !tgId) return 1;
        var _vt180 = DATA.TROOPS[tgId];
        return (_vt180 && _vt180.mech) ? _shT180.vsMech : 1;
      };
      var av = perA * shooter.count * (ctx.decay || 1);
      if (ctx.onWall) av *= T.WALL_FIRE_MUL * (ctx.wallFireMul || 1);
      if (ctx.defBonus > 0) av *= Math.max(0.05, 1 - ctx.defBonus);
      var pool = enemyUnits.filter(function (e) { return e.count > 0; })
        .sort(function (x, y) { return y.adv - x.adv; });      // 越靠前越先挨打
      /* v59（指挥指令）：**指定目标在射程内 → 优先打它**（照搬原版 §九）——
         实现方式是把该兵种排到打击序列最前，伤害优先落在它头上，
         溢出部分才继续按"由近及远"分配（与既有的溢伤模型一致）。 */
      if (ctx.preferId) {
        pool.sort(function (x, y) {
          var px = (x.id === ctx.preferId) ? 0 : 1;
          var py = (y.id === ctx.preferId) ? 0 : 1;
          return (px - py) || (y.adv - x.adv);
        });
      }
      var hits = [], killed = 0, clash = 1;
      /* ============================================================
       * v89.87（老板拍板）：**主动攻击 = 单主目标制**
       * ------------------------------------------------------------
       *   · 主目标 = 指定目标（`preferId` 已排到池首）/ 否则最近的一支；
       *   · 主目标吃满本次攻击的全部伤害（自然钳制：最多打光它）。
       * v89.95（B1 · 老板「一回合只对一个目标兵种出手，后续无溅射伤害」）：
       *   · **删除溅射** —— 主目标被打光后，**溢出伤害作废**，不再分给别的兵种；
       *   · 连带效果：一回合最多打掉**一支**部队，战斗从 1~3 回合拉长到多回合，
       *     "逐兵种指挥/阵位/计略"这些决策才真正有回本的空间。
       * 反击（counterStrike）本来就是"只打打我那一支"，天然合规。
       * ============================================================ */
      if (ctx.single && pool.length) {
        var tg0 = pool[0];
        var perHp0 = T.perHp(tg0, ctx.defGenOfTarget);
        var cf0 = T.clashFactor(perA, T.perDef(tg0));
        var holdMul0 = (tg0.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
        var eff0 = av * cf0 * holdMul0 * mechMulOf(tg0.id);
        /* v89.96：取整用 **round** 而不是 floor ——
           floor 会让"伤害不足一个人份"的攻击恒为 0 杀：实测义兵 20v20
           （每回合 0.625 人份）双方站着不动到 30 回合（卡死）。
           round 的口径是"伤害接近一个人份就算一个战损"，小规模战斗必收敛；
           大部队（每次几百上千杀）round ≈ floor，节奏不受影响。 */
        var k0 = Math.round(eff0 / perHp0);
        if (k0 > tg0.count) k0 = tg0.count;          // 自然钳制：不能杀超过目标实有人数
        var over = eff0 - k0 * perHp0;               // 主目标吃满后的**超出伤害**
        clash = cf0;
        if (k0 > 0) {
          tg0.count -= k0;
          killed += k0;
          hits.push({ id: tg0.id, name: tg0.name, kill: k0 });
        }
        /* v89.95（B1）：溢出作废 —— 不再对别的兵种溅射（一击一目标） */
        return { killed: killed, hits: hits, clash: Math.round(clash * 100) };
      }
      for (var pi = 0; pi < pool.length && av > 0; pi++) {
        var tg = pool[pi];
        var perHp = T.perHp(tg, ctx.defGenOfTarget);
        var cf = T.clashFactor(perA, T.perDef(tg));
        /* v59：**防御动作受到的伤害减半**（报告 §九） */
        var holdMul = (tg.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
        var eff = av * cf * holdMul * mechMulOf(tg.id);
        var k = Math.round(eff / perHp);             /* v89.96：同 single 分支，round 防小规模卡死 */
        if (k <= 0) break;
        if (k > tg.count) k = tg.count;      // 自然钳制：不能杀超过目标实有人数
        tg.count -= k;
        av = Math.max(0, eff - k * perHp);
        killed += k;
        clash = cf;
        hits.push({ id: tg.id, name: tg.name, kill: k });
      }
      return { killed: killed, hits: hits, clash: Math.round(clash * 100) };
    }

    /* 城防减伤只保护**守方**（攻方没有工事可依） */
    function defBonusAgainst(targetSide) { return targetSide === 'def' ? defBonus : 0; }

    /* ============================================================
     * 城头箭塔（v59 · 每回合齐射一次）
     * ------------------------------------------------------------
     * 座数 = 城防值折出的箭塔数；耐久池 = 座数 × 2000（原版箭塔生命）；
     * 火力 = **存活座数** × 300（原版箭塔攻击）× 城头密集度修正。
     * 箭塔可以被攻方指定为目标摧毁（见 actSide），火力随之线性衰减 ——
     * 这就是原版攻城战"先拆箭塔再上墙"的循环。
     * ============================================================ */
    /* v62：座数走 T.towerCountOfArg —— `opts.towers` 显式给出时以它为准
       （玩家城 = 城防折出 + 工匠作坊建造），否则按城防折出（NPC 城）。 */
    var towerStart = T.towerCountOfArg(defVal, opts.towers);
    var towerDmg = 0;                      /* 已累积的耐久损失（点数） */
    function towerAliveNow() {
      var left = towerStart * TW.hp - towerDmg;
      return Math.max(0, Math.ceil(left / TW.hp));
    }
    function towerHit(dmg) {
      towerDmg += dmg;
      return towerAliveNow();
    }
    /* 攻方与箭塔的距离：箭塔在守方阵线前沿（原版："攻城时城墙在位置 100"） */
    function towerGap(unit) { return Math.max(0, D - unit.adv - T.WALL_POS); }

    function wallVolley(enemyUnits, events) {
      var alive0 = towerAliveNow();
      if (!opts.sieging || wallRange <= 0 || alive0 <= 0) return;
      var power = T.wallFirePower(alive0);
      if (power <= 0) return;
      var av = power * wallFireMul;
      var pool = enemyUnits.filter(function (e) { return e.count > 0; })
        .sort(function (x, y) { return y.adv - x.adv; });
      var hits = [], killed = 0, dbl = 0;
      /* v89.95（B1）：城头火力同样**一击一目标** —— 只打射程内最靠前的那一支。
         改前是"由近及远逐个分伤"，同样属于溅射的一种（一轮打掉两三支）。 */
      var _poolOne = pool.slice(0, 1);
      for (var pi = 0; pi < _poolOne.length && av > 0; pi++) {
        var tg = _poolOne[pi];
        /* ⚠️ v59：**必须按射程筛目标** —— 改前这里无条件打遍全场（v58 的城头射程
           几乎覆盖整个战场，所以那个漏检看不出来）；v59 后箭塔射程有真实上限
           （2350 一级），不筛就会出现"攻方退到射程外仍被箭塔打"的怪象
           —— 实测：弓兵连续后退到间距 2931、箭塔射程只有 1650，却仍每回合被杀 128 人，
           于是"后退躲箭塔"这条原版核心战术**根本用不出来**。
           按 adv 降序排列，所以一旦某支够不着，后面的更够不着 → 直接收工。 */
        if (towerGap(tg) > wallRange) break;
        /* 城头是箭塔：结算只按纸面数值（v89.179 克制全撤 —— 防御向判定已删）。 */
        var perHp = T.perHp(tg, atkGen);        /* 打的是攻方 → 用攻方将领的生命加成 */
        var cf = T.clashFactor(power, T.perDef(tg));
        /* 双倍攻击区（原版）：距离在"射程/2 + 100"以内 → 箭塔打双倍 */
        var dec = T.wallDecay(towerGap(tg), wallRange);
        if (dec > 1) dbl++;
        var holdMul = (tg.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
        var eff = av * cf * dec * holdMul;
        var k = Math.floor(eff / perHp);
        if (k <= 0) break;
        if (k > tg.count) k = tg.count;
        tg.count -= k;
        av = Math.max(0, eff - k * perHp);
        killed += k;
        hits.push({ id: tg.id, name: tg.name, kill: k });
      }
      if (killed > 0) {
        events.push({
          kind: 'wall', side: 'def', id: '_wall', name: TW.name + (dbl ? '（双倍区）' : ''),
          target: '我军', kill: killed, hits: hits, towers: alive0, dbl: dbl > 0,
        });
      }
    }

    /* 一支部队的有效射程（科技 + 剧情 + 守城时并入城头火力圈）——
       提成函数是为了让"主动开火"与"反击"用同一套口径。 */
    function effRangeFor(unit) {
      var r = unit.range * (1 + TB('range'));
      if (GAME.story && GAME.story.combatMod) r *= (GAME.story.combatMod().archerRange || 1);
      /* v89.109：出城迎战的部队在**城外**，不再吃城头火力圈（出城 = 放弃城墙护佑） */
      if (unit.side === 'def' && !unit.sortie && wallRange > 0 && unit.range >= 500) r = Math.max(r, wallRange);
      return r;
    }
    function onWallOf(unit) {
      return (unit.side === 'def') && !unit.sortie && wallRange > 0 && unit.range >= 500;
    }

    /* ============================================================
     * 反击（v57 · 老板拍板：补）
     * ------------------------------------------------------------
     * 原版（4399 战争系统页）：「如果双方都在射程内，则攻击方的每次进攻都将
     * 遭到防御方的反击。**其反击人数按照被攻击后的数量计算**。」
     * 三条要点，逐条落地：
     *   ① 触发条件是**双方都在射程内** —— 我隔着射程外打你，你够不着，就没有反击；
     *   ② 反击用的是**被打完之后剩下的兵**（`def0.count` 此时已被扣过）——
     *      战报实证：同一支部队第 2 回合反击 10,710,272，第 3 回合只剩 1,231,194，
     *      因为它已经被打残了；
     *   ③ 反击**不再触发再反击**（没有递归）—— 否则两支远程对射会无限循环。
     * ============================================================ */
    function counterStrike(shooterUnit, hit, enemyUnits, ownGen2, enemyGen2, events) {
      var def0 = null;
      for (var i = 0; i < enemyUnits.length; i++) {
        if (enemyUnits[i].id === hit.id) { def0 = enemyUnits[i]; break; }
      }
      if (!def0 || def0.count <= 0) return;         // 这一支已被打光 → 无人反击
      var rng = effRangeFor(def0);
      var g2 = Math.max(0, D - def0.adv - shooterUnit.adv);
      if (g2 > rng) return;                          // 够不着 → 不反击
      var rres = fireOnce(def0, [shooterUnit], {
        siegeMult: siegeMult,
        decay: T.rangeDecay(g2, rng),
        onWall: onWallOf(def0),
        wallFireMul: wallFireMul,
        defBonus: defBonusAgainst(shooterUnit.side),
        defGenOfTarget: ownGen2,                     // 被打的是 shooterUnit，用它自己那方的将领
      });
      if (rres.killed > 0) {
        events.push({
          kind: 'counter', side: def0.side, id: def0.id, name: def0.name,
          target: shooterUnit.name, targetId: shooterUnit.id,
          kill: rres.killed, gap: Math.round(g2),
          decay: T.rangeDecay(g2, rng),
        });
      }
    }

    /* 一方的行动阶段 */
    function actSide(sideUnits, enemyUnits, ownGen, enemyGen, events) {
      sideUnits.forEach(function (u) {
        if (u.count <= 0) return;
        if (!alive(enemyUnits).length) return;
        /* 目标 = 箭塔。⚠️ 箭塔拆完之后**自动转为打敌军** ——
           否则"指定打箭塔"的部队会在工事清空后对着空地站到 30 回合
           （实测：投石 4000 拆完 100 座箭塔后发呆 19 回合，最后按兵力比判负）。
           原版语义也是"指定目标不在射程内 → 打射程内任意目标"。 */
        /* v89.109（老板「阻止敌军靠近城墙」）：**守方仍有出城迎战部队存活时，攻方拆不到墙** ——
           野战军挡在城外，攻方必须先把它打完，才能逼近城墙拆工事。
           这就是"前线前移"的硬语义（也是需求 3「打破城墙 + 杀死出城迎战军队」的前置）。 */
        var _defSortieAlive = false;
        if (u.side === 'atk') {
          for (var _si = 0; _si < enemyUnits.length; _si++) {
            if (enemyUnits[_si].sortie && enemyUnits[_si].count > 0) { _defSortieAlive = true; break; }
          }
        }
        var wantTower = (u.target === DATA.TARGET_WALL) && opts.sieging
          && towerAliveNow() > 0 && !_defSortieAlive;
        var ef = front(enemyUnits);
        var rec = null, bestGap = Infinity;
        enemyUnits.forEach(function (e) {
          if (e.count <= 0) return;
          var g = gapOf(u, ef) + (ef - e.adv);   // 与该单位自身的间距
          if (g < bestGap) { bestGap = g; rec = e; }
        });
        /* v59（指挥指令）：**指定目标**优先 ——
           ① 指定兵种：把它选为战报里的目标（伤害偏好由 fireOnce 的 preferId 落实）；
           ② 指定箭塔：本回合不与守军交火，距离以"与工事的距离"为准（一路推进去拆）。 */
        if (u.target && !wantTower) {
          var pref = null;
          enemyUnits.forEach(function (e) { if (e.count > 0 && e.id === u.target) pref = e; });
          if (pref) { rec = pref; bestGap = gapOf(u, ef) + (ef - pref.adv); }
        }
        if (wantTower) bestGap = towerGap(u);
        if (!rec && !wantTower) return;
        var effRange = effRangeFor(u);
        var onWall = onWallOf(u);
        var gap = bestGap;
        var free = gap - effRange;
        /* ============================================================
         * 指令：动作（v59 · 照搬原版 §九）
         * ------------------------------------------------------------
         *   advance 前进 → 每回合向敌阵推进
         *   hold    防御 → 原地不动（受到的伤害减半，见 fireOnce / wallVolley）
         *   retreat 后退 → 向己方后撤、拉开距离（adv 可为负 = 退到自己出发线之后）
         * ⚠️ v28 那句"攻城时守方全军固守"（holdLine）**已删除** ——
         *    固守现在由"守方默认动作 = 防御"承接，它是一条**玩家可改的指令**，
         *    不该在引擎里写死；否则"指挥守军主动出击"永远做不到。
         * ============================================================ */
        var stance = u.stance || 'advance';
        if (stance === 'advance' && free > 0 && !onWall) {
          /* 推进：每回合走「兵种速度 × MARCH_UNIT」丈，走到接触点就停。
             v57：MARCH_UNIT 已改回 **1:1**（速度即每回合丈数）。 */
          var step = Math.min(u.spd * T.MARCH_UNIT, free);
          var _cap = T.advanceCapOf(D);
          if (step > _cap) step = _cap;
          u.adv += step;
          gap -= step;
          events.push({ kind: 'move', side: u.side, id: u.id, name: u.name, step: Math.round(step), gap: Math.round(gap) });
        } else if (stance === 'retreat') {
          /* 后退（v59）：向己方后撤 —— 原版攻城战里"退到某段距离与箭塔对射、
             避开它的双倍攻击区"是核心战术（战报实录："GJ 后退到【1226,1799】处和箭塔对射"）。
             下限取 −D：允许退到自己出发线之后，但不能无限远（否则战斗永远无接触）。 */
          var back = Math.min(u.spd * T.MARCH_UNIT, u.adv + D);
          var _capB = T.advanceCapOf(D);
          if (back > _capB) back = _capB;
          if (back > 0) {
            u.adv -= back;
            gap += back;
            events.push({ kind: 'retreat', side: u.side, id: u.id, name: u.name,
              step: Math.round(back), gap: Math.round(gap) });
          }
        }
        /* ---------- 拆箭塔（指挥指令：目标 = 城防工事） ---------- */
        if (wantTower) {
          if (opts.sieging && towerAliveNow() > 0 && gap <= effRange) {
            var tPerA = T.perAtk(u, { sieging: !!opts.sieging, siegeMult: siegeMult });
            var tAv = tPerA * u.count * T.rangeDecay(gap, effRange);
            /* 箭塔的防御取原版 360（每兵攻防对冲口径与打兵完全一致） */
            var tDmg = tAv * T.clashFactor(tPerA, TW.def) / TW.tough;
            var tBefore = towerAliveNow();
            var tAfter = towerHit(tDmg);
            if (tAfter < tBefore) {
              events.push({ kind: 'tower', side: u.side, id: u.id, name: u.name,
                destroy: tBefore - tAfter, left: tAfter, total: towerStart });
            }
          }
          return;
        }
        if (gap <= effRange) {
          /* v89.87（老板拍板）：主动攻击 = **单主目标**（rec，指定目标优先/否则最近），
             主目标吃满后超出伤害对**射程内其他每个**敌方兵种各溅射 30%。
             溅射目标在此预筛："与射手自身的间距 ≤ 射手有效射程"的其余兵种。 */
          var decay = T.rangeDecay(gap, effRange);
          var splash = [];
          enemyUnits.forEach(function (e) {
            if (e.count <= 0 || e === rec) return;
            var ge = gapOf(u, ef) + (ef - e.adv);
            if (ge <= effRange) splash.push(e);
          });
          var res = fireOnce(u, enemyUnits, {
            siegeMult: siegeMult, decay: decay, onWall: onWall,
            wallFireMul: wallFireMul,
            preferId: u.target || '',
            defBonus: defBonusAgainst(u.side === 'atk' ? 'def' : 'atk'),
            defGenOfTarget: enemyGen,
            single: true, splashTargets: splash,
          });
          if (res.killed > 0) {
            events.push({
              kind: 'attack', side: u.side, id: u.id, name: u.name,
              targetId: rec.id, target: rec.name, kill: res.killed, hits: res.hits,
              clash: res.clash, decay: decay,
            });
            /* 被打到且还活着的，逐个反击（顺序即"由近及远"的打击顺序） */
            res.hits.forEach(function (h) {
              counterStrike(u, h, enemyUnits, ownGen, enemyGen, events);
            });
          }
        }
      });
    }

    /* v89.87：原 `while (…round < MAX_ROUNDS)` 循环体抽成 stepRound()，由 env.step 调用 */
    function stepRound() {
      if (env.over) return null;
      round++;
      var events = [];
      /* 速度高的先行动 —— 双方混排后统一排序（需求：速度高的兵种先行动） */
      var order = alive(atk).concat(alive(def));
      order.sort(function (x, y) {
        if (y.spd !== x.spd) return y.spd - x.spd;
        /* 同速 → **防守方先行动**（原版规则，4399 战争系统页多源一致：
           「每一回合，按照速度决定行动次序。速度快的军队先行动。
             速度相同时，防守方先行动。」）
           ⚠️ 这里原本写的是"同速时我方（攻方）略先"，与原文**正好相反**，
           而我在 v57 的检索报告里把这一栏标成"✅ 同（速度含将领加成）"——
           那是**误判**：只核了"按速度排序"，没核"同速谁先"。
           同速先手在"同兵种对拼"里是决定性的（先手方一次齐射就可能清场）。 */
        return x.side === 'def' ? -1 : 1;
      });
      order.forEach(function (u) {
        if (u.count <= 0) return;
        var enemy = (u.side === 'atk') ? def : atk;
        if (!alive(enemy).length) return;
        actSide([u], enemy,
          u.side === 'atk' ? atkGen : defGen,        // ownGen：它自己那方的将领
          u.side === 'atk' ? defGen : atkGen,        // enemyGen：敌方将领
          events);
      });
      /* 城头工事每回合开火一次（原版：箭塔/擂石是守城方自带的火力） */
      if (opts.sieging) wallVolley(atk, events);
      var _rA = alive(atk).reduce(function (n, u) { return n + u.count; }, 0);
      var _rD = alive(def).reduce(function (n, u) { return n + u.count; }, 0);
      var _rG = Math.round(gapOf({ adv: front(atk) }, front(def)));
      roundsLog.push({ r: round, a: _rA, d: _rD, gap: _rG, events: events });
      strips.push(T.strip(front(atk), front(def), D));
      if (!alive(atk).length || !alive(def).length || round >= T.MAX_ROUNDS) env.over = true;
      return { r: round, a: _rA, d: _rD, gap: _rG, events: events, over: env.over, snap: snapUnits() };
    }

    /* ---------- 会话对象（v89.87） ---------- */
    function snapUnits() {
      /* ============================================================
       * v89.151（老板 5）：「战中兵种悬停显示的血都是零」——病根：本函数**手写字段清单**，
       *   只抄了 11 个，漏了引擎结算与悬停都要读的 6 个
       *   （`hpPer` / `atkPct` / `defPct` / `cover` / `start` / `sortie`）——
       *   `perHp()` 读 `u.hpPer` 得 undefined → `Math.max(1, NaN)` = **NaN** →
       *   悬停显示"血 0（基础 1800）"、全军血量 0，攻/防也丢了全部加成
       *   （显示的是无加成的兵种基础值）。语法过、测试过、零报错。
       *   ⚠️ 与 v89.142 的 `rec.sim` 漏存 duel/genSim 是**同族事故**（§56.1）——
       *     "手写字段清单的打包函数"必须逐字段核对（smoke §131 有对账断言）。
       *   ⛔ 快照只服务 UI（战场渲染/悬停/沙盘起点），多带字段零副作用；
       *     但**字段清单从此以引擎 unitsInit 为准** —— 加字段要同步这里与断言。
       * ============================================================ */
      function cp(u) {
        return { side: u.side, id: u.id, name: u.name, count: u.count, adv: Math.round(u.adv),
                 spd: u.spd, range: u.range, er: Math.round(effRangeFor(u)),   /* v89.104：有效射程 */
                 stance: u.stance, target: u.target || '', vsCity: !!u.vsCity,
                 /* v89.151：以下 6 项 = 引擎结算链（perAtk/perDef/perHp）的输入 —— 缺一即静默失真 */
                 hpPer: u.hpPer, cover: u.cover || 0, atkPct: u.atkPct || 0, defPct: u.defPct || 0,
                 start: u.start || 0, sortie: !!u.sortie };
      }
      return { round: round, field: D, atk: atk.map(cp), def: def.map(cp),
        maxRounds: T.MAX_ROUNDS,
        /* 攻城时的城防箭塔（界面显示"余 N / M 座"用） */
        towers: (opts.sieging && towerStart > 0) ? { start: towerStart, left: towerAliveNow() } : null };
    }
    var env = {
      field: D, over: false,
      units: { atk: atk, def: def },
      setCmd: function (side, troopId, patch) {
        var list = (side === 'def') ? def : atk;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === troopId) {
            if (patch && patch.s) list[i].stance = patch.s;
            if (patch && patch.t !== undefined) list[i].target = patch.t;
          }
        }
      },
      snap: snapUnits,
    };
    env.over = !(alive(atk).length && alive(def).length);
    /* v89.102（老板「固定沙盘」）：**初始列阵快照** —— 沙盘回放/推演的起点。
       每支部队的初始行位（动作决定）、速度、射程、兵力、指令（动作/目标）。
       存进战报后，沙盘可以"用同一把引擎重跑"重现整场仗的逐帧画面；
       重跑时以这里记下的 `stance/target` 走 `opts.stances` 覆盖 ——
       否则玩家事后改了出征战术，同一份战报会跑出不同结果。 */
    var initSnap = snapUnits();
    env.step = stepRound;
    env.runAll = function () { while (!env.over) stepRound(); };
    var _fin = null;
    env.finish = function () {
      if (_fin) return _fin;

    /* ---------- 收尾 ---------- */
    var aRemain = alive(atk).reduce(function (n, u) { return n + u.count; }, 0);
    var dRemain = alive(def).reduce(function (n, u) { return n + u.count; }, 0);
    var winner;
    if (dRemain <= 0 && aRemain > 0) winner = 'atk';
    else if (aRemain <= 0 && dRemain > 0) winner = 'def';
    else if (aRemain > 0 && dRemain > 0) {
      winner = (aRemain / Math.max(1, aStart)) > (dRemain / Math.max(1, dStart)) ? 'atk' : 'def';
    } else winner = 'def';

    function lossBy(list) {
      var out = {}, startBy = {};
      list.forEach(function (u) {
        startBy[u.id] = u.start;
        var lost = u.start - u.count;
        if (lost > 0) out[u.id] = lost;
      });
      return { loss: out, start: startBy, remain: (function () {
        var o = {}; list.forEach(function (u) { if (u.count > 0) o[u.id] = u.count; }); return o;
      })() };
    }
    var aBy = lossBy(atk), dBy = lossBy(def);
    /* v89.109：出城迎战部队的**存活**人数（0 = 野战军已被歼灭） */
    var defSortieLeft = 0;
    def.forEach(function (u) { if (u.sortie && u.count > 0) defSortieLeft += u.count; });

    /* 逐回合纪要（文字）—— 供战报直接展示 */
    /* 回合纪要：只写**接战结果**，推进过程交给战场条带去看 ——
       把"每支部队这一回合走了多远"也写进正文，会把战报变成流水账。
       v89.119（老板）：「反击应该在敌方出手后…反击和对方出手记录在同一行」——
       反击不再独立成段：并入**引发它的那次出手**（同段、紧跟其后），
       形如「长枪兵(我) → 轻骑兵 杀伤 784（轻骑兵反击 杀伤 374）」。
       宿主判定：counter.targetId === 出手者 id（键带阵营，同名兵种互射不串台）。 */
    roundsLog.forEach(function (rr) {
      var at = [], hostOf = {}, open = {};
      rr.events.forEach(function (e) {
        if (e.kind === 'attack') {
          at.push(e.name + (e.side === 'atk' ? '(我)' : '(敌)') + ' → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0));
          if (e.id != null) hostOf[(e.side === 'atk' ? 'a' : 'd') + '|' + e.id] = at.length - 1;
        } else if (e.kind === 'wall') {
          at.push(e.name + ' → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0));
        } else if (e.kind === 'counter') {
          var hi = hostOf[(e.side === 'atk' ? 'd' : 'a') + '|' + e.targetId];
          /* v89.136（老板 3）：「'对方'应该是'我方'才对」——按**反击者阵营**给词 */
          var piece = (e.side === 'atk' ? '我方' : '敌方') + e.name + '反击 杀伤 ' + U.numText(e.kill, 0);
          if (hi != null) {
            at[hi] += (open[hi] ? '，' : '（') + piece;
            open[hi] = true;
          } else {
            /* 兜底：找不到那次出手（异常数据）→ 才独立成段 */
            at.push(e.name + (e.side === 'atk' ? '(我)' : '(敌)') + ' 反击 ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0));
          }
        } else if (e.kind === 'tower') {
          /* v59：拆箭塔 —— 原版战报写作"[守]箭塔6666-272=6394" */
          at.push(e.name + '(我) 攻箭塔，摧毁 ' + e.destroy + ' 座（余 ' + e.left + ' / ' + e.total + '）');
        }
      });
      Object.keys(open).forEach(function (k) { if (open[k]) at[k] += '）'; });
      log.push('第 ' + rr.r + ' 回合：' + (at.length ? at.join('；')
        : '两军推进（最近距离 ' + U.numText(Math.max(0, rr.gap), 0) + '）'));
    });

    if (craftKinds > 0) {
      log.push('攻城器械 ' + craftKinds + ' 类：城防减伤降至 '
        + Math.round(defBonus * 100) + '%，城头火力压制至 '
        + Math.round(wallFireMul * 100) + '%');
    } else if (wallRange > 0) {
      log.push(TW.name + '射程 ' + U.numText(Math.round(wallRange), 0)
        + '（' + towerAliveNow() + ' / ' + towerStart + ' 座）'
        + ' —— 无攻城器械，城防减伤 ' + Math.round(defBonus * 100) + '%');
    }
    /* v59：拆箭塔战果汇总 —— 攻城方最想知道的一句话 */
    if (towerStart > 0 && towerDmg > 0) {
      log.push('此役拆毁 ' + TW.name + ' ' + (towerStart - towerAliveNow()) + ' 座，尚存 '
        + towerAliveNow() + ' / ' + towerStart + ' 座');
    }
    if (scoutOnly > 0) log.push('斥候 ' + scoutOnly + ' 骑随行侦察，不列阵（不受损失）');

    _fin = {
      winner: winner,
      atkLoss: aStart - aRemain, defLoss: dStart - dRemain,
      atkRemain: aRemain, defRemain: dRemain,
      rounds: round, log: log,
      /* 战斗场景（v27 新增） */
      engine: 'tactic',
      field: D,
      /* v28：本次战场口径 —— 攻城器械数量、城头火力射程、斥候（不参战）数量 */
      craft: craftKinds, wallRange: wallRange, wallFireMul: wallFireMul,
      defBonusEff: defBonus, scoutOnly: scoutOnly,
      /* v59：城防箭塔 —— 开局座数 / 剩余座数（战报与界面都要显示"拆了几座"） */
      towerStart: towerStart, towerLeft: towerAliveNow(),
      roundsLog: roundsLog, strips: strips,
      /* v89.102：初始列阵（沙盘回放/推演起点；见 initSnap 处注释） */
      unitsInit: initSnap,
      atkLossBy: aBy.loss, defLossBy: dBy.loss,
      atkStartBy: aBy.start, defStartBy: dBy.start,
      atkRemainBy: aBy.remain, defRemainBy: dBy.remain,
      /* v89.109（老板「杀死出城迎战的军队才能掠夺」）：守方**出城迎战部队**的起/余 ——
         掠夺闸（battle.lootGateOf）与战报都读它。 */
      defSortieStart: defSortieStart, defSortieLeft: defSortieLeft,
    };
    return _fin;
    };
    return env;
  };

  /* v89.87：T.simulate 包装为会话（begin → runAll → finish）——
     与旧实现逐字节同行为；观战界面改用 env.step 逐回合推进。 */
  T.simulate = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {
    var env = T.begin(atkArmy, atkGen, defArmy, defVal, defGen, opts);
    env.runAll();
    return env.finish();
  };

  /* 供界面/战报使用：把一场战斗画成文字战场 */
  T.renderScene = function (r, limit) {
    if (!r || !r.strips || !r.strips.length) return '';
    limit = limit || 10;
    var n = r.strips.length;
    var idx = [];
    for (var i = 0; i < n; i++) {
      if (i < limit - 2 || i >= n - 2) idx.push(i);
    }
    var out = [];
    var last = -1;
    idx.forEach(function (i) {
      if (last >= 0 && i > last + 1) out.push('<div class="bt-gap">　　……</div>');
      var rr = r.roundsLog[i];
      out.push('<div class="bt-row"><span class="bt-r">' + (i + 1) + '</span>' +
        '<span class="bt-strip">' + r.strips[i].replace(/▓/g, '<i>▓</i>').replace(/·/g, '<u>·</u>') + '</span>' +
        '<span class="bt-n">我 ' + U.fmt(rr.a) + '　敌 ' + U.fmt(rr.d) + '</span>' +
        '<span class="bt-g">最近距离 ' + U.numText(rr.gap, 0) + '</span></div>');
      last = i;
    });
    return '<div class="bt-scene">' +
      '<div class="bt-head"><span>我方</span><span class="bt-scale">战场纵深 ' + U.numText(r.field, 0) + '</span><span>敌军</span></div>' +
      out.join('') + '</div>';
  };
})();
