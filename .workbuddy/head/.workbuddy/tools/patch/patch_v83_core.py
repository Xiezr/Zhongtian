# -*- coding: utf-8 -*-
"""v83 · 核心层：野地经验惩罚机制（每 12 级一个台阶 · 掠夺 / 占领野地时生效）。

老板原文：「形成经验惩罚机制，掠夺、占领野地时，1-10级野地，以12级一个台阶，
将领小于等于12级，打1级野地可以吃满经验，大于12级但小于等于24级，打2级野地
可以吃满经验，类推。大于120级将领，均可通过打10级野地吃满经验」

- 台阶：need = min(10, ceil(level / 12))；野地 0 级按 1 级对待。
- 系数：野地等级 ≥ 台阶 → 1（吃满，不设超额加成）；每差一档 ×0.65，地板 0.03。
- 作用域：只挂野地出征结算口（城池 / 野外城池的歼灭经验口径不变）。
- 可调：全部数值在 DATA.EXP_PENALTY（四个数）。
"""
import io
import sys

DATA = r'E:\Deepseekdb\js\data.js'
BAT = r'E:\Deepseekdb\js\battle.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new and new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== A. data.js ==')
patch(
    DATA,
    """    capPct: 0.8,         // 单场封顶 = 升级需求的 80%
    scout: 30,           // 侦察（无风险，固定小额）
  };""",
    """    capPct: 0.8,         // 单场封顶 = 升级需求的 80%
    scout: 30,           // 侦察（无风险，固定小额）
  };
  /* v83（老板）：「形成经验惩罚机制」——
     掠夺 / 占领**野地**时，野地 1~10 级按「每 12 级一个台阶」对将领等级：
     ≤12 打 1 级吃满、13~24 打 2 级吃满、…、>120 打 10 级吃满（台阶封顶在 10 级野地）；
     打低于自己台阶的野地每差一档 ×decay，地板 minMul（不至于完全归零）。
     调平衡只改这里的四个数；只作用于野地（城池/野外城池的歼灭经验口径不变）。 */
  DATA.EXP_PENALTY = { tier: 12, maxLv: 10, decay: 0.65, minMul: 0.03 };""",
    'A1 DATA.EXP_PENALTY',
)

print()
print('== B. battle.js ==')
# B1 · 两个纯函数（台阶 / 系数）—— 接在 battleExp 之后
patch(
    BAT,
    """    var gain = Math.max(0, Math.min(raw, cap));
    return { gain: gain, raw: raw, cap: cap, capped: raw > cap, value: val };
  };""",
    """    var gain = Math.max(0, Math.min(raw, cap));
    return { gain: gain, raw: raw, cap: cap, capped: raw > cap, value: val };
  };

  /* v83（老板）：「形成经验惩罚机制」——
     掠夺 / 占领**野地**时，按「每 12 级一个台阶」给经验打折（唯一出口）。
     · expTierOf：将领等级 → 该吃满的野地等级（1~10；>120 封顶在 10 级野地）
     · expPenaltyOf：野地等级 ≥ 台阶 → 1（吃满）；每差一档 ×decay，地板 minMul
     野地 0 级按 1 级对待（尚未长成的野地不比 1 级更差）。 */
  GAME.battle.expTierOf = function (genLevel) {
    var P = DATA.EXP_PENALTY || { tier: 12, maxLv: 10 };
    return Math.min(P.maxLv, Math.max(1, Math.ceil((genLevel || 1) / P.tier)));
  };
  GAME.battle.expPenaltyOf = function (genLevel, wildLevel) {
    var P = DATA.EXP_PENALTY || { tier: 12, maxLv: 10, decay: 0.65, minMul: 0.03 };
    var need = GAME.battle.expTierOf(genLevel);
    var wl = Math.max(1, Math.round(wildLevel || 1));
    if (wl >= need) return { mul: 1, need: need, wl: wl, gap: 0 };
    var gap = need - wl;
    return { mul: Math.max(P.minMul, Math.pow(P.decay, gap)), need: need, wl: wl, gap: gap };
  };""",
    'B1 台阶与系数函数',
)

# B2 · 出征结算口挂惩罚（唯一出口）
patch(
    BAT,
    """      var expR = GAME.battle.battleExp(result.defLossBy, gen);
      var exps = GAME.battle.gainExp(gen, expR.gain, mode.name + ' ' + t.name);""",
    """      var expR = GAME.battle.battleExp(result.defLossBy, gen);
      /* v83（老板）：「形成经验惩罚机制」——掠夺 / 占领野地时按台阶打折。
         野地以外（城池 / 野外城池）不适用；打折后保底 1 点（不至于完全归零）。 */
      if (t.kind === 'wild' && expR.gain > 0) {
        var penR = GAME.battle.expPenaltyOf(gen.level, t.lv);
        if (penR.mul < 1) {
          result.expPenalty = {
            mul: penR.mul, need: penR.need, wl: penR.wl, gap: penR.gap,
            before: expR.gain, after: Math.max(1, Math.round(expR.gain * penR.mul)),
          };
          expR.gain = result.expPenalty.after;
        }
      }
      var whyEx = mode.name + ' ' + t.name
        + (result.expPenalty ? '（越级惩罚 ×' + Number(result.expPenalty.mul).toFixed(2) + '）' : '');
      var exps = GAME.battle.gainExp(gen, expR.gain, whyEx);""",
    'B2 出征结算挂惩罚',
)

# B3 · 战报注明越级惩罚（与"单场封顶"同一原则：不写会被当成算漏了）
patch(
    BAT,
    """      line4 = '<br>经验：' + gen.name + ' +' + U.numText(ei.gain, 0)
        + (result.expCapped
          ? '<span style="color:var(--text-dim);">（歼灭 ' + U.numText(result.expRaw || 0, 0)
            + '，已达单场上限 ' + U.numText(ei.gain, 0) + '）</span>'
          : (result.defValue ? '<span style="color:var(--text-dim);">（歼敌值 ' + U.numText(result.defValue, 0) + ' 资源）</span>' : ''))""",
    """      line4 = '<br>经验：' + gen.name + ' +' + U.numText(ei.gain, 0)
        /* v83（老板）：「形成经验惩罚机制」——越级打野地要把打折原因写明白，
           否则玩家会以为经验算漏了（与"单场封顶"同一原则）。 */
        + (result.expPenalty
          ? '<span style="color:var(--text-dim);">（越级惩罚 ×' + Number(result.expPenalty.mul).toFixed(2)
            + '：Lv' + gen.level + ' 宜打 ' + result.expPenalty.need + ' 级野地）</span>'
          : (result.expCapped
            ? '<span style="color:var(--text-dim);">（歼灭 ' + U.numText(result.expRaw || 0, 0)
              + '，已达单场上限 ' + U.numText(ei.gain, 0) + '）</span>'
            : (result.defValue ? '<span style="color:var(--text-dim);">（歼敌值 ' + U.numText(result.defValue, 0) + ' 资源）</span>' : '')))""",
    'B3 战报注明惩罚',
)

print()
print('完成。')
