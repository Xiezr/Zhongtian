/* ============================================================
 * goals.js — 作战目标 · 战果总装配（v95 · C2 + 第二批的统一入口）
 * ------------------------------------------------------------
 * 老板 2026-10-22：「全做出来，框架搭进去，后边再优化。要给玩家提供真实、
 *   可以开拓玩法的时间，而不要停留在感人叙事层面。」
 *
 * 这一轮一次做十项，所以定了**一个架构**：
 *   **所有新系统的效果都从"战果"这一个口子落地**，不改 `tactic.simulate`。
 *   理由很实在：战斗引擎是全项目最贵的东西，一次动十处必炸。
 *   而战果层能表达的东西比想象中多 —— 战利品倍率、额外伤亡、声望、
 *   老兵经验、伤兵回收、破墙进度。这些加起来就是"不同的打法"。
 *
 * C2 的落地方式（关键设计）：
 *   **不新增下拉框**。作战目标由"你带了多少兵"决定 ——
 *     带满 → 平推（稳、没什么可捡）
 *     打平 → 强攻（多抢一点，多死一点）
 *     带少 → 斩首（战利品 ×1.45，但伤得更重）
 *     再少 → 奇袭（×1.9，输面大）
 *   于是"带多少"第一次变成了一个**选择**，而不是"当然带满"。
 *   玩家看到的是一行提示（出征界面的战力对比里），不需要学新面板。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var GO = GAME.goals = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.GOALS) || {}; }

  /* ============================================================
   * tierOf —— 兵力比 → 作战目标档位
   * ------------------------------------------------------------
   * 用**双方总兵力**（剩余 + 损失），不是"剩余" —— 否则打得越惨判定越离谱。
   * ============================================================ */
  GO.tierOf = function (myTotal, foeTotal) {
    var tiers = D().tiers || [];
    if (!tiers.length) return { id: 'annihilate', name: '平推', loot: 1, rep: 1, extraLoss: 0 };
    var ratio = (foeTotal > 0) ? (myTotal / foeTotal) : 99;
    for (var i = 0; i < tiers.length; i++) if (ratio >= tiers[i].at) return tiers[i];
    return tiers[tiers.length - 1];
  };

  /* 派兵前的预估（出征界面显示一行） */
  GO.previewOf = function (myTotal, foeTotal) {
    var t = GO.tierOf(myTotal, foeTotal);
    return {
      id: t.id, name: t.name,
      line: '🎯 预计作战目标：' + t.name + '（战利品 ×' + t.loot + '　声望 ×' + t.rep
        + (t.extraLoss ? '　额外伤兵 ' + Math.round(t.extraLoss * 100) + '%' : '') + '）',
      note: t.desc || ''
    };
  };

  /* ============================================================
   * afterBattle —— 一场仗打完，所有新系统在这里结账
   * ------------------------------------------------------------
   * ⚠️ 整段包在 try/catch 里：这是"框架期"，任何一个新模块抛错都不许
   *    影响主流程（兵已经归城、资源已经入账，出错只是少了一段加成）。
   * ============================================================ */
  GO.afterBattle = function (rec, result, resp) {
    var out = null;
    try {
      out = _run(rec, result, resp);
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[goals.afterBattle]', e);
      out = null;
    }
    return out;
  };

  function _run(rec, result, resp) {
    var s = GAME.state;
    if (!s || !rec || !result) return null;
    if (rec.side === 'def') return null;              /* 守城战不走这里（另算） */
    var myLoss = result.atkLoss || 0, myKeep = result.atkRemain || 0;
    var foeLoss = result.defLoss || 0, foeKeep = result.defRemain || 0;
    var myTotal = myLoss + myKeep, foeTotal = foeLoss + foeKeep;
    if (myTotal <= 0) return null;

    var tier = GO.tierOf(myTotal, foeTotal);
    var win = (result.winner === 'atk') && !result.retreat;

    /* v96：**兵员等级不够，打不出这一档的效果** ——
       奇袭要 Lv3、斩首要 Lv2（`DATA.TROOPLV.tasks`）。
       不够就按低一档结算：战利品倍率掉下来。这条让"整训"第一次有直接回报。 */
    var lvNote = null;
    if (win && GAME.trooplv && GAME.trooplv.checkCity) {
      var fromCity = (GAME.city && GAME.city.byId) ? GAME.city.byId(rec.cityId) : null;
      var chk = fromCity ? GAME.trooplv.checkCity(fromCity, tier.id) : { ok: true };
      if (chk && !chk.ok) {
        /* ⚠️ 档位数组是**从易到难**排的（annihilate → raiddeep），
           "降一档"是 index **减** 1，不是加 1 —— 加 1 会降到更难的那档（第一版就这么写的）。 */
        var tiers2 = D().tiers || [];
        var idx = tiers2.findIndex(function (x) { return x.id === tier.id; });
        var lower = tiers2[Math.max(0, (idx < 0 ? 0 : idx) - 1)] || tier;
        lvNote = '兵员等级不够（' + chk.msg + '），只能按「' + lower.name + '」结算';
        tier = lower;
      }
    }

    var add = { loot: 1, rep: 1, loss: 0, note: [] };

    /* ① 作战目标本身的倍率 */
    add.loot *= (tier.loot || 1);
    add.rep *= (tier.rep || 1);

    /* ② 老兵与伤兵（veteran）：先把"阵亡"拆成阵亡 + 伤兵 */
    if (GAME.veteran && GAME.veteran.afterBattle) {
      var v = GAME.veteran.afterBattle(rec, result, { win: win, tier: tier });
      if (v) {
        add.loot *= (1 + (v.lootBonus || 0));
        if (v.note) add.note.push(v.note);
      }
    }

    /* ③ 套装指令（setskill）：解锁的"按钮"是否真的按了 */
    if (GAME.setskill && GAME.setskill.activeOf) {
      var sk = GAME.setskill.activeOf();
      if (sk) {
        if (sk.effect === 'loot') add.loot *= (1 + sk.mul);
        else if (sk.effect === 'loss') add.loss -= sk.mul;
        else if (sk.effect === 'rep') add.rep *= (1 + sk.mul);
        add.note.push('【' + sk.name + '】');
        GAME.setskill.consume();
      }
    }

    /* ④ 指令牌（deck）：战前选的那五张 */
    if (GAME.deck && GAME.deck.effOf) {
      var dk = GAME.deck.effOf();
      add.loot *= (1 + (dk.loot || 0));
      add.rep *= (1 + (dk.rep || 0));
      add.loss -= (dk.loss || 0);
      if (dk.wound) add.woundBonus = dk.wound;
      if (dk.note) add.note.push(dk.note);
    }

    /* ⑤ 破墙（tower）：攻城未破 → 墙防受损，下次更好打（两阶段攻城的实质） */
    if (GAME.tower && GAME.tower.afterSiege) {
      var tw = GAME.tower.afterSiege(rec, result, { win: win });
      if (tw && tw.note) add.note.push(tw.note);
    }

    /* ⑥ 结算：战利品倍率与声望
       ⚠️ 资源**按"这一仗的规模"给**（出征兵力 × 0.15 × 超出 1 的那部分），
          不是给一个固定数 —— 否则小仗带少兵打奇袭也能拿满额外战利品。
          基数小 + 倍率高，才是"刀口舔血"。 */
    var city = GAME.city && GAME.city.byId ? GAME.city.byId(rec.cityId) : null;
    if (city && add.loot > 1) {
      var base = Math.max(1, Math.round(myTotal * 0.15 * (add.loot - 1)));
      /* 三种资源各给一份（按兵种口径没有意义：战利品就是杂货） */
      if (GAME.city.add) {
        GAME.city.add(city, 'grain', base);
        GAME.city.add(city, 'iron', Math.round(base * 0.4));
        GAME.city.add(city, 'wood', Math.round(base * 0.4));
      }
      add.gained = base;
    }
    if (GAME.renown && Math.abs(add.rep - 1) > 0.01) {
      GAME.renown.add(win ? 'honor' : 'valor', Math.round((add.rep - 1) * 12));
    }

    /* ⑦ 战报一行：让玩家知道"这一仗为什么拿得多/死得多" */
    if (lvNote) add.note.push('⚠ ' + lvNote);
    if (GAME.log && GAME.log.war && (tier.id !== 'annihilate' || add.note.length)) {
      GAME.log.war('🎯 ' + tier.name + '（我军 ' + U.numText(myTotal, 0) + ' vs 守军 '
        + U.numText(foeTotal, 0) + '）：战利品 ×' + Math.round(add.loot * 100) / 100
        + '　声望 ×' + Math.round(add.rep * 100) / 100
        + (add.note.length ? '　' + add.note.join(' ') : ''));
    }

    return { tier: tier, win: win, add: add };
  }

  /* 一行摘要（军务页/世界账本用） */
  GO.lineOf = function () {
    var t = (D().tiers || []);
    if (!t.length) return '';
    return '🎯 作战目标随带兵量变化：带满＝平推（稳）· 打平＝强攻 · 带少＝斩首（战利品 ×1.45）· 更少＝奇袭（×1.9）';
  };
})();
