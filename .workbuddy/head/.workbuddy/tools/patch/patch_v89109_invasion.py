# -*- coding: utf-8 -*-
"""v89.109：state.js —— 来袭防御战战斗化（战报+回放）+ 掠夺 gate + 城墙口径对齐"""
import io, os, shutil
p = r'E:/Deepseekdb/js/state.js'
BK = r'E:/Deepseekdb/.workbuddy/backup'
shutil.copy2(p, os.path.join(BK, 'state.v89108b.js'))
s = io.open(p, encoding='utf-8').read()

# ① invasionArmyOf：插在「下次来袭时间」注释之前
a1 = """  /* 下次来袭时间（游戏秒）。首次进入解锁条件时排期，之后按间隔滚动。 */"""
b1 = """  /* ============================================================
   * v89.109（老板「为烽火防御战提供战报回放，等同出征战报」）：
   *   来袭从"一次比值结算"改成**真打一场** —— 走战斗引擎、与出征同规格。
   *   本函数把「来袭战力」（`invasionPowerOf`，与玩家全境战力同口径）拆成一支军队：
   *   按 `DATA.INVASION.mix` 权重分兵种，并用 `story.troopPower` 折算人头，
   *   使这支军队的战力 ≈ 目标战力（"看起来多少兵，就是多少兵"）。
   * ============================================================ */
  GAME.invasionArmyOf = function (city, cycle) {
    var I = DATA.INVASION || {};
    var power = GAME.invasionPowerOf(city, cycle);
    var mix = I.mix || { yibing: 0.30, changqiang: 0.22, daodun: 0.18, gongjian: 0.18, qingji: 0.12 };
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var wsum = 0, perMan = 0;
    for (var k in mix) {
      wsum += mix[k] || 0;
      var _v = tp ? tp(k) : 1;
      perMan += (mix[k] || 0) * (typeof _v === 'number' && _v > 0 ? _v : 1);
    }
    perMan = (perMan / (wsum || 1)) || 1;
    var total = Math.max(1, Math.round(power / perMan));
    var out = {};
    for (var k2 in mix) {
      var n = Math.round(total * (mix[k2] || 0) / (wsum || 1));
      if (n > 0) out[k2] = n;
    }
    return { army: out, power: power, total: total };
  };

  /* 下次来袭时间（游戏秒）。首次进入解锁条件时排期，之后按间隔滚动。 */"""
assert a1 in s, '①未命中'
s = s.replace(a1, b1, 1)

# ② invasionResolve 整段替换
i2 = s.index('  GAME.invasionResolve = function (city) {')
j2mark = """    var repDrop = Math.round(severity * (L.repDrop || 0));
    if (repDrop > 0) { GAME.state.rep = Math.max(0, (GAME.state.rep || 0) - repDrop); out.repDrop = repDrop; }
    return out;
  };"""
j2 = s.index(j2mark) + len(j2mark)

new2 = """  GAME.invasionResolve = function (city, srcName) {
    var I = DATA.INVASION || {};
    var s = GAME.state;
    var now = (s.world && s.world.elapsed) || 0;
    var cycle = Math.floor(now / 86400);
    var atk = GAME.invasionPowerOf(city, cycle);
    var def = GAME.defensePowerOf(city);
    /* ratio ∈ (0,1)：越接近 0 说明守方越强。
       （保留为"表观战力比"—— severity 与消息展示仍用它；胜负判定改为**真打**。） */
    var ratio = atk / (atk + def || 1);

    /* ---- v89.109：真打一场（与出征同一引擎）----
       守方 = 我方驻军 + 守将 + 城防工事；**读玩家的防守战术**（ctx.playerDef），
       含「出城迎战」——野战军挡在城外时，敌人连墙都拆不到（见 tactic.actSide）。 */
    var ia = GAME.invasionArmyOf(city, cycle);
    var guard = GAME.guardOf ? GAME.guardOf(city) : null;
    var wallLv = city.wallLv || (GAME.buildingLevel ? (GAME.buildingLevel(city, 'chengqiang') || 0) : 0);
    var towers = GAME.towerCountOf ? (GAME.towerCountOf(city) || 0) : 0;
    var defVal = GAME.cityDefense ? (GAME.cityDefense(city) || 0) : 0;
    var defArmy0 = U.deep(city.army || {});        /* 战前快照（战报与配方用） */
    var result = null;
    try {
      result = GAME.tactic.simulate(ia.army, null, city.army, defVal, guard, {
        kind: 'city', sieging: true, defName: city.name,
        wallLv: wallLv, towers: towers, playerDef: true,
      });
    } catch (e) {
      result = null;
      if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 战斗异常：', e);
    }
    var held = result ? result.winner === 'def' : (ratio <= 0.5);   /* 引擎异常 → 旧口径兜底 */
    var gate = result ? GAME.battle.lootGateOf(result, { kind: 'city' }) : { ok: true, msg: '' };
    /* v89.109（老板「只有打破城墙并杀死出城迎战的军队，才能进行资源掠夺」）：
       敌得手（winner='atk'）**且过城防闸**才掠得到 —— 与"我方掠夺 NPC"同一把闸。 */
    var lootOk = result ? (result.winner === 'atk' && gate.ok) : !held;

    var severity = held
      ? ratio * 0.35                                  // 守住：也折损，但不是零代价
      : Math.max(0, (ratio - 0.5) * 2);               // 被破：ratio 刚过 0.5 时从 0 起
    /* v86：坚壁清野 —— 生效期内损失 −40%（severity 是唯一的损失总闸） */
    var _jb = GAME.schemeDefOf(city, 'jianbi', now);
    if (_jb) severity *= (1 - _jb.eff.invLossCut);
    var L = I.loss || {};
    var out = { atk: atk, def: def, ratio: ratio, held: held, severity: severity,
      resLost: {}, troopsLost: 0, wallDrop: 0, lootOk: lootOk, src: srcName || '',
      battle: result ? {
        rounds: result.rounds, atkRemain: result.atkRemain, defRemain: result.defRemain,
        atkLoss: result.atkLoss, defLoss: result.defLoss,
        towerStart: result.towerStart, towerLeft: result.towerLeft,
        sortieStart: result.defSortieStart || 0, sortieLeft: result.defSortieLeft || 0,
      } : null };

    /* ---- 兵损：按战斗引擎的逐兵种损失扣（与出征同口径）；引擎异常 → 旧比例口径兜底 ---- */
    if (result) {
      var lossBy = result.defLossBy || {};
      for (var tk in lossBy) {
        var nl = Math.min(lossBy[tk] || 0, city.army[tk] || 0);
        if (nl > 0) { city.army[tk] -= nl; out.troopsLost += nl; }
      }
    } else {
      var tpct = severity * (L.troopPct || 0.10);
      for (var t2 in city.army) {
        var lose2 = Math.floor((city.army[t2] || 0) * tpct);
        if (lose2 > 0) { city.army[t2] -= lose2; out.troopsLost += lose2; }
      }
    }

    /* ---- 掠夺资源：**只有敌得手且破防**才扣（v89.109 老板令） ---- */
    if (!held && lootOk) {
      var R = GAME.res(city);
      for (var k3 in { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1 }) {
        var pct = severity * (L.resPct || 0.15);
        var lost = Math.floor((R[k3] || 0) * pct);
        if (lost > 0) { R[k3] -= lost; out.resLost[k3] = lost; }
      }
    }
    /* ---- 城墙掉级：破防得手才掉（与"墙被打穿"语义对齐） ---- */
    if (!held && lootOk && (L.wallDrop || 0) > 0) {
      var wl = GAME.buildingLevel(city, 'chengqiang') || 0;
      if (wl > 0) { city.wallLv = wl - (L.wallDrop || 1); out.wallDrop = L.wallDrop || 1; }
    }
    var repDrop = Math.round(severity * (L.repDrop || 0));
    if (repDrop > 0) { GAME.state.rep = Math.max(0, (GAME.state.rep || 0) - repDrop); out.repDrop = repDrop; }

    /* ---- 战报（v89.109：与出征同规格 —— 公文·战报页可见、可逐回合回放） ---- */
    if (result) {
      try {
        GAME.invasionReport(city, srcName, result, out, ia, defArmy0, guard);
      } catch (e2) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 战报异常：', e2);
      }
    }
    return out;
  };

  /* 防御战战报（v89.109）—— 与出征战报**同结构**：进公文、可回放/看兵损表。
     独立成函数：让 invasionResolve 主体保持可读，且战报异常不拖垮结算。
     ⚠️ 不给 `sandbox`（沙盘推演的视角固定"攻方 = 我方"）—— 防御战我方在守方，
        给了会把双方画反；`replay`（分回合关键帧）与 `scene`（战场条带）是视角中性的，照给。 */
  GAME.invasionReport = function (city, srcName, r, out, ia, defArmy0, guard) {
    var s = GAME.state;
    var src = srcName || '流寇';
    var held = out.held;
    var defMen0 = 0;
    for (var dk in defArmy0) defMen0 += (defArmy0[dk] || 0);
    var lines = [];
    lines.push('来犯 ' + U.numText(ia.total || 0, 0) + ' 众（' + U.escape(src) + '）　守军 '
      + U.numText(defMen0, 0) + (guard ? '（' + U.escape(guard.name) + ' 统带）' : '（无守将）'));
    lines.push('鏖战 ' + r.rounds + ' 回合：歼敌 ' + U.numText(r.atkLoss, 0)
      + ' · 我军阵亡 ' + U.numText(r.defLoss, 0));
    if (r.towerStart > 0) {
      lines.push('城防工事：拆毁 ' + (r.towerStart - r.towerLeft) + ' / ' + r.towerStart
        + ' 座（余 ' + r.towerLeft + '）');
    }
    if ((r.defSortieStart || 0) > 0) {
      lines.push('出城迎战：' + U.numText(r.defSortieStart, 0) + ' 众，战后余 '
        + U.numText(r.defSortieLeft || 0, 0));
    }
    if (held) {
      lines.push('【守土】敌军铩羽而归，库藏未失。');
    } else if (out.lootOk) {
      var a = [];
      for (var k in out.resLost) a.push(GAME.resName(k) + ' −' + U.fmt(out.resLost[k]));
      lines.push('【遭劫】' + (a.join('、') || '（库藏已空，无物可掠）'));
    } else {
      lines.push('【未破防】敌军破门却未能搬空库藏 —— 城墙 / 野战军仍在，劫掠不成。');
    }
    if (out.wallDrop) lines.push('城墙 −' + out.wallDrop + ' 级');
    var rep = {
      t: U.now(), type: 'defense',
      title: (held ? '🛡 守土' : (out.lootOk ? '💥 城破' : '⚠ 城破未掠'))
        + ' · ' + src + '来袭 · ' + city.name,
      body: '<b>' + (held ? '守土成功' : '城门失守') + '</b>　·　' + U.escape(city.name)
        + '<br>' + lines.join('<br>'),
      win: held,
      loss: {
        atkStart: r.atkStartBy || {}, atkLoss: r.atkLossBy || {},
        defStart: r.defStartBy || {}, defLoss: r.defLossBy || {},
      },
      scene: GAME.battle.compactScene(r),
      replay: GAME.battle.replayFramesOf(r),
      sandbox: null,          /* 见上方注释：视角固定攻方，防御战暂不适用 */
      underdog: GAME.battle.underdogOf ? GAME.battle.underdogOf(r) : null,
      siege: null,
      defense: { src: src, lootOk: out.lootOk,
        sortieStart: r.defSortieStart || 0, sortieLeft: r.defSortieLeft || 0 },
    };
    s.reports.unshift(rep);
    while (s.reports.length > (DATA.REPORT_MAX || 60)) {
      var drop = -1;
      for (var ri = s.reports.length - 1; ri >= 0; ri--) { if (!s.reports[ri].fav) { drop = ri; break; } }
      if (drop < 0) break;
      s.reports.splice(drop, 1);
    }
    s.repUnread = (s.repUnread || 0) + 1;
    return rep;
  };"""
s = s[:i2] + new2 + s[j2:]

# ③ tick：src 提前到 resolve 之前 + 消息增强（含"战报已入公文"）
a3 = """        var detail = GAME.invasionResolve(city);
        fired++;
        var src = (I.sources || ['敌军'])[Math.floor(GAME.invasionRoll('src|' + city.id + '|' + city.inv.nextAt) * (I.sources || ['敌军']).length)];
        var head = detail.held
          ? '🛡 ' + city.name + ' 击退' + src + '（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
          : '⚔ ' + city.name + ' 被' + src + '攻破城门（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）';
        var bits = [];
        for (var rk in detail.resLost) bits.push(GAME.resName(rk) + ' −' + U.fmt(detail.resLost[rk]));
        if (detail.troopsLost) bits.push('损兵 ' + U.fmt(detail.troopsLost));
        if (detail.wallDrop) bits.push('城墙 −' + detail.wallDrop + ' 级');
        if (detail.repDrop) bits.push('声望 −' + detail.repDrop);"""
b3 = """        /* v89.109：src 提前算 —— 防御战报的标题要用它（resolve 现在真要打一仗并写战报） */
        var src = (I.sources || ['敌军'])[Math.floor(GAME.invasionRoll('src|' + city.id + '|' + city.inv.nextAt) * (I.sources || ['敌军']).length)];
        var detail = GAME.invasionResolve(city, src);
        fired++;
        var head = detail.held
          ? '🛡 ' + city.name + ' 击退' + src + '（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
          : (detail.lootOk
            ? '⚔ ' + city.name + ' 被' + src + '攻破城门（守备 ' + U.fmt(detail.def) + ' vs 来犯 ' + U.fmt(detail.atk) + '）'
            : '⚠️ ' + city.name + ' 城门失守但**未被掠**（' + src + ' 未能破防）');
        var bits = [];
        for (var rk in detail.resLost) bits.push(GAME.resName(rk) + ' −' + U.fmt(detail.resLost[rk]));
        if (detail.troopsLost) bits.push('损兵 ' + U.fmt(detail.troopsLost));
        if (detail.wallDrop) bits.push('城墙 −' + detail.wallDrop + ' 级');
        if (detail.repDrop) bits.push('声望 −' + detail.repDrop);
        if (detail.battle) bits.push('战报已入公文（' + detail.battle.rounds + ' 回合）');"""
assert a3 in s, '③未命中'
s = s.replace(a3, b3, 1)

io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(p + '.tmp', p)
print('state.js：invasion 战斗化完成')
