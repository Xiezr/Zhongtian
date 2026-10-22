/* ============================================================
 * convoy.js — 拓荒队：**用这一代人，换下一代人能活**
 * ------------------------------------------------------------
 * 提案第 294~307 行（八.3）：
 *   「在废土语境里，死亡最崇高的交换不是资源，是
 *     **用这一代人，换下一代人能活。**」
 *
 *     派出去找什么 | 他们可能死 | 但换来
 *     种子库       | 是        | 城市明年有粮
 *     旧时代图纸   | 是        | 城里有电了
 *     医疗档案     | 是        | 下次瘟疫不死那么多人
 *
 * 这条线一直没落地。现有所有"探索"都不死人：
 *   侦查（不接战）· 自动探路 · 遗迹翻找 · 营地交涉 ——
 * 地图是点亮了，但**没有任何一次是用命换来的**。
 *
 * ⚠️ 三条硬规则（缺一条这套就不成立）：
 *   ① **带走的必须是人**，不是兵。兵是资产，人是这个世界的存量。
 *   ② **死了就真死了** —— 进阵亡名录，不返场，不复活。
 *   ③ **带回来的不能用资源替代** —— 能拿钱买的东西，就不是"用命换"。
 *
 * ⚠️ 刻意不做：
 *   · 不做"成功率抽奖"的纯赌。风险是**看得见**的（距离/目标/人数都摊在面板上），
 *     玩家是在做取舍，不是点老虎机。
 *   · 不给"全灭"加戏剧化弹窗。人没回来就是没回来，一行字。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var CV = GAME.convoy = {};
  var U = GAME.utils;

  function SP() { return GAME.mapSphere || GAME.sphere; }
  function D() { return (GAME.DATA && GAME.DATA.CONVOY) || {}; }

  function h(ci, salt) {
    var x = (ci * 2654435761 + salt * 40503) >>> 0;
    x ^= x >>> 13; x = (x * 1274126177) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /* 已拿到的永久物（累计次数） */
  CV.got = function () {
    var s = GAME.state;
    if (!s) return {};
    if (!s.convoyGot) s.convoyGot = {};
    return s.convoyGot;
  };
  CV.done = function () {
    var s = GAME.state;
    if (!s) return {};
    if (!s.convoyDone) s.convoyDone = {};
    return s.convoyDone;
  };

  CV.nOf = function (kind) { return CV.got()[kind] | 0; };

  /* ============================================================
   * 目标：一处具体的旧世界设施
   * ------------------------------------------------------------
   * 位置是**哈希固定的**（同一颗球永远是同一处），
   * 所以玩家可以记住"东北边那个变电站还没去"。
   * 每处只能去一次 —— 拿空了就是拿空了。
   * ============================================================ */
  CV.targetOf = function (kind) {
    var s = SP(), st = GAME.state;
    if (!s || !s.cells || !st) return null;
    var sd = (s.seed3 ? s.seed3() : 0) | 0;
    var kinds = D().kinds || [];
    var kh = 0, i;
    for (i = 0; i < kinds.length; i++) { if (kinds[i].id === kind) kh = 1000 + i; }
    if (!kh) return null;

    var home = GAME.currentCity ? GAME.currentCity() : null;
    if (!home || home.ci == null) return null;

    /* 在"离城 12~70 格"的陆地里，找哈希最高的一格 —— 不遍历全图，
       用等距采样：从全图里按 seed 抽 400 个候选，挑最像的那一处。 */
    var n = s.cells.length;
    var best = null, bestScore = -1;
    for (i = 0; i < 400; i++) {
      var ci = Math.floor(h(i, sd + kh) * n) % n;
      var cell = s.cells[ci];
      if (!cell) continue;
      if (cell.type === 'lake') continue;
      var dist = s.distOf ? s.distOf({ ci: home.ci }, { ci: ci }) : 30;
      if (dist < 12 || dist > 70) continue;
      var score = h(ci, sd + kh + 7) - Math.abs(dist - 38) / 200;   /* 越接近 38 格越可能是它 */
      if (score > bestScore) { bestScore = score; best = { ci: ci, dist: dist }; }
    }
    if (!best) return null;

    var def = null;
    for (i = 0; i < kinds.length; i++) if (kinds[i].id === kind) def = kinds[i];
    if (!def) return null;

    return {
      kind: kind, ci: best.ci, dist: best.dist,
      name: def.name, icon: def.icon, gainName: def.gainName,
      hard: def.hard || 0,
      cleared: !!CV.done()[kind + '@' + best.ci]
    };
  };

  /* 全部目标（面板列表用） */
  CV.targets = function () {
    var kinds = D().kinds || [];
    var out = [];
    for (var i = 0; i < kinds.length; i++) {
      var t = CV.targetOf(kinds[i].id);
      if (t) out.push(t);
    }
    return out;
  };

  /* ============================================================
   * riskOf —— 风险**摊开算**，不藏
   * ------------------------------------------------------------
   * 不做"30% 成功率"这种黑盒：死的比例是算得出来的，
   * 玩家自己决定值不值。这就是"可预判"。
   * ============================================================ */
  CV.riskOf = function (t, sent) {
    if (!t) return 1;
    var d = D();
    var base = d.baseRisk == null ? 0.12 : d.baseRisk;
    var perTile = d.riskPerTile == null ? 0.006 : d.riskPerTile;
    var r = base + t.dist * perTile + (t.hard || 0);
    /* 人多能压风险，但压不到零（下限 25% 的死亡比例封底） */
    var crew = d.crewRelief == null ? 0.35 : d.crewRelief;
    var relief = Math.min(crew, (sent || 100) / 3000);
    return Math.max(0.04, r * (1 - relief));
  };

  /* 预计伤亡（面板直接显示这个数，不是百分比） */
  CV.deadEstimateOf = function (t, sent) {
    return Math.max(1, Math.round((sent || 100) * CV.riskOf(t, sent)));
  };

  /* ============================================================
   * send —— 派出去
   * ------------------------------------------------------------
   * o = { kind, sent }
   * 返回 { ok, dead, back, gain, msg }
   *
   * ⚠️ 人从**城市人口**里扣（`GAME.res(city).pop` 唯一出口），不是从兵里扣。
   *    死了进 GAME.memorial（名录），不返场。
   * ============================================================ */
  CV.send = function (kind, sent) {
    var st = GAME.state;
    if (!st) return { ok: false, msg: '无存档' };
    var t = CV.targetOf(kind);
    if (!t) return { ok: false, msg: '找不到这个方向的目标' };
    if (t.cleared) return { ok: false, msg: t.name + '已经被搬空了' };

    var city = GAME.currentCity ? GAME.currentCity() : null;
    if (!city) return { ok: false, msg: '没有出发的城市' };
    sent = Math.max(20, Math.round(sent || 100));
    var RW = GAME.res(city);                 /* ⚠️ 人口在 res.pop，不在 city.pop */
    if ((RW.pop || 0) < sent) {
      return { ok: false, msg: '人口不够：要带 ' + sent + ' 人，城里只有 ' + Math.round(RW.pop || 0) };
    }

    var d = D();
    var risk = CV.riskOf(t, sent);
    var dead = Math.min(sent, Math.max(1, Math.round(sent * risk)));
    var back = sent - dead;

    RW.pop = Math.max(0, (RW.pop || 0) - sent);             /* 人走了 */
    CV.done()[kind + '@' + t.ci] = 1;                        /* 这处清空了 */

    /* 全灭：一个人都没回来 —— 东西也没带回来 */
    if (back <= 0) {
      CV._bury(sent, t, city, true);
      return { ok: true, dead: sent, back: 0, gain: null, wiped: true,
        msg: '去' + t.name + '的 ' + sent + ' 人，一个都没回来。' };
    }

    /* 有人回来 → 带回东西。回来的人越多，拿得越全（三档） */
    var rate = back / sent;
    var tiers = d.gainTiers || [{ at: 0.7, mul: 1 }, { at: 0.4, mul: 0.6 }, { at: 0, mul: 0.3 }];
    var mul = 0.3;
    for (var i = 0; i < tiers.length; i++) { if (rate >= tiers[i].at) { mul = tiers[i].mul; break; } }
    var got = CV.got();
    got[kind] = (got[kind] | 0) + mul;

    CV._bury(dead, t, city, false);

    /* 回城的人会留在人口里（他们还是人，只是老了、残了、不肯再出门） */
    RW.pop = (RW.pop || 0) + back;

    return { ok: true, dead: dead, back: back, mul: mul, gain: t.gainName,
      msg: '去' + t.name + '的 ' + sent + ' 人回来了 ' + back + ' 个，'
        + '带回 ' + t.gainName + (mul < 1 ? '（只有一部分）' : '（完整的）')
        + '。没回来的 ' + dead + ' 个人，名字刻在墙上了。' };
  };

  /* 进阵亡名录（复用 memorial 的唯一出口，不另建一套记账） */
  CV._bury = function (dead, t, city, wiped) {
    if (!dead || !GAME.memorial) return;
    var army = {};
    army.pingmin = dead;
    try {
      GAME.memorial.record({
        sent: army, back: {}, wounded: {},
        place: t.name, ci: t.ci, win: false, mode: 'convoy',
        gen: null, note: wiped ? '拓荒队全灭' : '拓荒队'
      });
    } catch (e) { /* 名录失败不阻断（人已经走了，账不能倒回去） */ }
  };

  /* ============================================================
   * 永久效果 —— 四个出口，都在别处被消费
   * ------------------------------------------------------------
   * 这些是**唯一**不能拿资源换的东西，所以每条都必须真的生效，
   * 否则"用命换"这句话就是假的。
   * ============================================================ */

  /* ① 种子库 → 粮产（每次 +6%，最多 3 次 = +18%） */
  CV.seedMul = function () {
    var n = Math.min(3, CV.nOf('seed'));
    return 1 + n * 0.06;
  };

  /* ② 广播塔 → 视野半径 +1（每次 +1，最多 +2） */
  CV.radioPlus = function () {
    return Math.min(2, Math.floor(CV.nOf('radio')));
  };

  /* ③ 医疗档案 → 寒潮/疫年的人口流失减半 */
  CV.medMul = function () {
    return CV.nOf('med') > 0 ? 0.5 : 1;
  };

  /* ④ 农具图纸 → 营地/村社愿意跟你走的人 +15%（每次 +15%，最多 +45%） */
  CV.toolMul = function () {
    return 1 + Math.min(3, Math.floor(CV.nOf('tool'))) * 0.15;
  };

  /* 一行摘要（面板顶部） */
  CV.lineOf = function () {
    var seg = [];
    if (CV.nOf('seed') > 0) seg.push('种子库 ×' + CV.nOf('seed').toFixed(1) + '（粮产 +' + Math.round((CV.seedMul() - 1) * 100) + '%）');
    if (CV.nOf('med') > 0) seg.push('医疗档案（寒潮伤亡减半）');
    if (CV.nOf('radio') > 0) seg.push('广播塔（视野 +' + CV.radioPlus() + '）');
    if (CV.nOf('tool') > 0) seg.push('农具图纸（招募 +' + Math.round((CV.toolMul() - 1) * 100) + '%）');
    if (!seg.length) return '还没有任何一支拓荒队回来过。这东西只能派人去拿，买不到。';
    return seg.join(' · ');
  };
})();
