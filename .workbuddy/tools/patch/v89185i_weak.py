# -*- coding: utf-8 -*-
"""v89.185 · 第7条：智能目标规则库 +`weak`（击其脆弱）——探针实测 infHeavy 我损 -16%。"""
import io

def rep(s, tag, old, new, n=1):
    c = s.count(old)
    assert c == n, tag + ' count=' + str(c)
    return s.replace(old, new, 1)

# ---------- data.js：rules + ruleCN ----------
P = 'js/data.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
orig = s
s = rep(s, 'D1',
"""     * 探针标定（probe_v89175b_strategy.js · 四场景）：
     *   mirror → 静态表 9.36W（独大）· bowHeavy → 清前排 5.27W（静态 2.24W，+3.02）
     *   infHeavy → 清除效率 +0.71 · cavHeavy → 清除效率 +0.49；**3/4 场赛马有增益**。""",
"""     * 探针标定（probe_v89175b_strategy.js · 四场景）：
     *   mirror → 静态表 9.36W（独大）· bowHeavy → 清前排 5.27W（静态 2.24W，+3.02）
     *   infHeavy → 清除效率 +0.71 · cavHeavy → 清除效率 +0.49；**3/4 场赛马有增益**。
     * v89.185（老板 7「改进战役智能」）：新增第 5 条候选 **weak 击其脆弱**（优先每兵生命
     *   最低的目标，清场加速）—— probe_v89185f 实测 infHeavy 场景我损 1310（次优 1561，
     *   **-16%**）→ 入候选库（赛马按局自选）。同轮试过 **ranged 先制远程**：四场景全无增益
     *   （近战够不到后排，评分退化为 dmg）→ **不采用**（记录在案，防后人重试）。""")
s = rep(s, 'D2',
"    rules: ['static', 'dmg', 'eff', 'front'],\n    ruleCN: { static: '静态表', dmg: '伤害最优', eff: '清除效率', front: '清前排' },",
"    rules: ['static', 'dmg', 'eff', 'front', 'weak'],\n    ruleCN: { static: '静态表', dmg: '伤害最优', eff: '清除效率', front: '清前排', weak: '击其脆弱' },")
assert s != orig
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('data OK')

# ---------- battle.js：smartPickTarget 加 weak 分支 ----------
P2 = 'js/battle.js'
s = io.open(P2, 'r', encoding='utf-8', newline='').read()
orig = s
s = rep(s, 'B1',
"""      if (rule === 'dmg') sc = killF;
      else if (rule === 'eff') sc = Math.min(killF, e.count) * 1000 + killF * 0.001;
      else if (rule === 'front') sc = e.adv * 1000 + Math.min(killF, e.count);
      else sc = killF;""",
"""      if (rule === 'dmg') sc = killF;
      else if (rule === 'eff') sc = Math.min(killF, e.count) * 1000 + killF * 0.001;
      else if (rule === 'front') sc = e.adv * 1000 + Math.min(killF, e.count);
      /* v89.185（老板 7「改进战役智能」）：**击其脆弱** —— 优先每兵生命最低的目标
         （清场加速；probe_v89185f 实测 infHeavy 我损 -16% vs 次优规则）。 */
      else if (rule === 'weak') sc = -perHp * 1000 + Math.min(killF, e.count);
      else sc = killF;""")
assert s != orig
io.open(P2, 'w', encoding='utf-8', newline='').write(s)
print('battle OK')

# ---------- smoke：赛马候选数 20 → 25 ----------
P3 = 'smoke-test.js'
s = io.open(P3, 'r', encoding='utf-8', newline='').read()
orig = s
c = s.count('return r1.scores.length === 20 && r1.rule === r2.rule && r1.mode === r2.mode')
assert c == 1, 'S1 count=' + str(c)
s = s.replace('return r1.scores.length === 20 && r1.rule === r2.rule && r1.mode === r2.mode',
              'return r1.scores.length === 25 && r1.rule === r2.rule && r1.mode === r2.mode   /* v89.185：5 模式 × 5 规则 */', 1)
assert s != orig
io.open(P3, 'w', encoding='utf-8', newline='').write(s)
print('smoke OK')
