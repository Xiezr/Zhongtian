# -*- coding: utf-8 -*-
"""v83 · 测试补丁：smoke 新增 §68（台阶 / 系数 / 战报 / 出征全链路）+ e2e 小段。

全链路实测用**打桩守军与等级**（确定性，不赌地图随机）：真实 expedition →
resolveTarget → 结算口 → gainExp 走通，低阶吃满 / 高阶 0.65² 打折逐项断言。
"""
import io
import sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E = r'E:\Deepseekdb\e2e-test.js'


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


SEC68 = r'''  /* ============================================================
   * 68. v83（老板）：野地经验惩罚机制（每 12 级一个台阶）
   * ============================================================ */
  console.log('\n===== 68. v83 经验惩罚（野地越级） =====');
  (function () {
    check('台阶：每 12 级一档（12→1 / 13→2 / 24→2 / 25→3 / 120→10 / 121+→10）', (function () {
      var cases = [[1, 1], [12, 1], [13, 2], [24, 2], [25, 3], [73, 7], [120, 10], [121, 10], [200, 10]];
      return cases.every(function (cc) { return G.battle.expTierOf(cc[0]) === cc[1]; });
    })());
    check('吃满：野地等级 ≥ 台阶 → 系数 1（不设超额加成）',
      G.battle.expPenaltyOf(20, 2).mul === 1 && G.battle.expPenaltyOf(20, 9).mul === 1
      && G.battle.expPenaltyOf(121, 10).mul === 1);
    check('惩罚：每低一档 ×0.65（低1档 0.65 / 低6档 0.65⁶）', (function () {
      var p1 = G.battle.expPenaltyOf(20, 1);
      var p6 = G.battle.expPenaltyOf(73, 1);
      return Math.abs(p1.mul - 0.65) < 1e-9 && Math.abs(p6.mul - Math.pow(0.65, 6)) < 1e-9
        && p1.need === 2 && p6.need === 7 && p6.wl === 1;
    })());
    check('地板：极深越级不低于 0.03（不至于归零）',
      Math.abs(G.battle.expPenaltyOf(200, 1).mul - 0.03) < 1e-9);
    check('野地 0 级按 1 级对待（尚未长成不比 1 级更差）',
      G.battle.expPenaltyOf(5, 0).mul === 1 && Math.abs(G.battle.expPenaltyOf(13, 0).mul - 0.65) < 1e-9);
    check('数值全在 DATA.EXP_PENALTY（改一处即可调平衡）',
      DATA.EXP_PENALTY.tier === 12 && DATA.EXP_PENALTY.maxLv === 10
      && DATA.EXP_PENALTY.decay === 0.65 && DATA.EXP_PENALTY.minMul === 0.03);

    check('结构：惩罚挂在野地出征结算口（唯一出口），非野地不适用', (function () {
      var bs = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8'));
      return /GAME\.battle\.expPenaltyOf = function/.test(bs)
        && /GAME\.battle\.expTierOf = function/.test(bs)
        && /t\.kind === 'wild' && expR\.gain > 0/.test(bs)
        && /GAME\.battle\.expPenaltyOf\(gen\.level, t\.lv\)/.test(bs);
    })());
    check('战报注明越级惩罚（否则玩家以为经验算漏了）', (function () {
      var txt = G.battle.reportText('野地 Lv1', {}, { name: '测试将', level: 73 },
        { winner: 'atk', rounds: 3, atkLoss: 1, atkRemain: 9, defLoss: 10, defRemain: 0,
          expInfo: { gain: 8, level: 73, exp: 8, need: 99999, up: 0 },
          expPenalty: { mul: 0.0754, need: 7, wl: 1, gap: 6, before: 106, after: 8 } });
      return txt.indexOf('越级惩罚 ×') >= 0 && txt.indexOf('宜打 7 级野地') >= 0;
    })());

    /* 实测：真实出征走完整链路 —— 打桩野地守军与等级（确定性，不赌地图随机） */
    check('实测：低阶将吃满、高阶将越级打折（出征全链路）', withoutEncounter(function () {
      return withFreshState('越级测试', function (st) {
        var c = st.cities[0];
        var spot = null;
        for (var r = 1; r <= 12 && !spot; r++) {
          for (var dy = -r; dy <= r && !spot; dy++) for (var dx = -r; dx <= r && !spot; dx++) {
            var tl = G.map.tile(c.x + dx, c.y + dy);
            if (tl && tl.terrain !== 'city') spot = { x: c.x + dx, y: c.y + dy };
          }
        }
        if (!spot) return true;
        var keepLv = G.map.wildLevelNow, keepDef = G.wildDefenseAt;
        try {
          /* 打桩：目标固定 Lv2 野地、守军 30 义兵（必胜；经验 = 30×230/1000×2 = 14） */
          G.map.wildLevelNow = function () { return 2; };
          G.wildDefenseAt = function () { return { army: { yibing: 30 }, gen: null, day: 0 }; };
          var gen = st.generals[1] || st.generals[0];
          st.res.grain = 1e8;

          gen.level = 5; gen.exp = 0; gen.stamina = 100; gen.energy = 100;
          c.army = { yibing: 300000 };
          var rLow = G.battle.expedition({ kind: 'wild', x: spot.x, y: spot.y }, 'raid', { yibing: 300000 }, gen.id);
          if (!rLow.ok || !rLow.result || rLow.result.winner !== 'atk' || !(rLow.result.expGain > 0)) return false;

          gen.level = 48; gen.exp = 0; gen.stamina = 100; gen.energy = 100;   /* 48/12 = 4 档 */
          c.army = { yibing: 300000 };
          var rHigh = G.battle.expedition({ kind: 'wild', x: spot.x, y: spot.y }, 'raid', { yibing: 300000 }, gen.id);
          if (!rHigh.ok || !rHigh.result || rHigh.result.winner !== 'atk') return false;

          var pen = rHigh.result.expPenalty;
          var wantMul = Math.pow(DATA.EXP_PENALTY.decay, 4 - 2);   /* 差 2 档 */
          return !rLow.result.expPenalty
            && !!pen && pen.need === 4 && pen.wl === 2 && pen.gap === 2
            && Math.abs(pen.mul - wantMul) < 1e-9
            && pen.after === rHigh.result.expGain
            && rHigh.result.expGain < rLow.result.expGain;
        } finally {
          G.map.wildLevelNow = keepLv; G.wildDefenseAt = keepDef;
        }
      });
    }), '低阶 14 / 高阶 14×0.65²');
  })();

'''
patch(
    SMOKE,
    "\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    '\n' + SEC68 + "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    'A1 新增 §68',
)

V83E2E = r'''  /* ============================================================
   * v83（老板）：野地经验惩罚 —— 台阶口径 / 战报注明
   * ============================================================ */
  console.log('\n--- v83. 经验惩罚（野地越级） ---');
  check('v83：台阶 = 每 12 级一档（12→1 / 13→2 / 120→10 / 121+→10）', (function () {
    return G.battle.expTierOf(12) === 1 && G.battle.expTierOf(13) === 2
      && G.battle.expTierOf(120) === 10 && G.battle.expTierOf(200) === 10;
  })());
  check('v83：越级惩罚 ×0.65^gap（Lv73 打 1 级 → 0.65⁶）', (function () {
    const p = G.battle.expPenaltyOf(73, 1);
    return p.need === 7 && Math.abs(p.mul - Math.pow(0.65, 6)) < 1e-9;
  })());
  check('v83：战报注明越级惩罚与宜打等级', (function () {
    const txt = G.battle.reportText('野地 Lv1', {}, { name: '测试将', level: 73 },
      { winner: 'atk', rounds: 3, atkLoss: 1, atkRemain: 9, defLoss: 10, defRemain: 0,
        expInfo: { gain: 8, level: 73, exp: 8, need: 99999, up: 0 },
        expPenalty: { mul: 0.0754, need: 7, wl: 1, gap: 6, before: 106, after: 8 } });
    return txt.indexOf('越级惩罚 ×') >= 0 && txt.indexOf('宜打 7 级野地') >= 0;
  })());
  await sleep(30);

'''
patch(
    E2E,
    "\n  G.ui.setView('city');\n  await sleep(60);\n  return finish();\n}",
    '\n' + V83E2E + "  G.ui.setView('city');\n  await sleep(60);\n  return finish();\n}",
    'B1 e2e v83 段',
)

print()
print('完成。')
