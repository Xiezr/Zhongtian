# -*- coding: utf-8 -*-
"""v89.185 批次1 · data.js —— 六维不封口曲线表 + 守将体系表 + 衰减表。"""
import io

P = 'js/data.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
orig = s

# ---- D1. MAYOR_CURVE 注释块（段：老板原话 → 理由）----
old1 = """   * 老板原话：「六维加成都走第三条路子，具体比例你进行数值设计」。
   * 定稿：**分段减半折线** —— 每 `seg` 点一段，段内率逐段减半，
   *   总量收敛于「首段满值的 2 倍」（0 → r0·seg·(1 + 1/2 + 1/4 + …) = 2·r0·seg）。
   *   首段率与旧线性段**相同**（内政 1%/点 · 智谋 0.5%/点）→ **seg 以内与旧值一字不差**。
   * 样本（内政系：产量/建造/税收）
   *   150 → +150% · 200 → +175% · 300 → +225% · 500 → +268.75% · 836 → +293.3% · 极限 +300%
   * 样本（智谋系：研究/城防）
   *   150 → +75% · 300 → +112.5% · 836 → +146.7% · 极限 +150%
   * 理由：① 成长感（836 从旧封顶 +150% → +293%，几乎翻倍）；② 有界可控
   *   （不会回到 v89.93 前的 ×10 量级）；③ 前 150 点与旧版完全一致（老档体感不变）。"""
new1 = """   * 老板原话：「六维加成都走第三条路子，具体比例你进行数值设计」。
   * v89.164 定稿 = 分段减半折线（r0, r0/2, r0/4, r0/8…），总量收敛 2·r0·seg（内政 +300% 封顶）。
   * v89.185（老板「有相应的封顶设置，可能打击玩家热情，设计不封口上限」）——
   *   改法（与体力方案A 同一设计语言）：**前两段减半照旧、段 2 起率恒定不再衰减**：
   *   率 = r0 / min(2^k, tailDiv)（k 为段号，tailDiv = 4 → 段 2 起恒为 r0/4）。
   *   段 2 以内（≤450 点）与 v89.164 **逐点相同**（老档体感不变）；此后永不封顶。
   * 样本（内政系：产量/建造/税收）
   *   150 → +150% · 300 → +225% · 450 → +262.5% · 600 → +300% · 1000 → +400% · 1400 → +500%
   * 样本（智谋系：研究/城防）
   *   150 → +75% · 300 → +112.5% · 450 → +131.3% · 1000 → +200% · 1400 → +250%
   * 理由：① 满配（四维 1400）从旧封顶 +299.5% → +500%，后期提升永不熄火；
   *   ② 前期 / 老档零变化；③ 尾段边际恒定（+0.25%/点），可预期。"""
assert s.count(old1) == 1, 'D1 count=' + str(s.count(old1))
s = s.replace(old1, new1, 1)

# ---- D2. MAYOR_CURVE 定义行 ----
old2 = "  DATA.MAYOR_CURVE = { seg: 150, maxK: 20 };   /* maxK：段数上限（3000 点后增量 <0.001%，截断无感） */"
new2 = "  DATA.MAYOR_CURVE = { seg: 150, tailDiv: 4 };   /* v89.185：率 = r0/min(2^k, tailDiv)，段 2 起恒定 —— 不封口 */"
assert s.count(old2) == 1, 'D2 count=' + str(s.count(old2))
s = s.replace(old2, new2, 1)

# ---- D3. NPC_GUARD_LV（注释行 + 定义）----
old3a = """   * 上界对齐天授的等级上限（DATA.GEN_RANKS.tian.lvCap = 240）：
   *   县 60~100 · 郡 100~140 · 州 140~190 · 都 190~240"""
new3a = """   * v89.185（老板 2）：「名城则为天授120-240级」——整体上抬、都城顶格不变：
   *   县 120~150 · 郡 150~180 · 州 180~210 · 都 210~240
   * 上界对齐天授的等级上限（DATA.GEN_RANKS.tian.lvCap = 240）。"""
assert s.count(old3a) == 1, 'D3a count=' + str(s.count(old3a))
s = s.replace(old3a, new3a, 1)

old3b = """  DATA.NPC_GUARD_LV = {
    county: [60, 100], jun: [100, 140], zhou: [140, 190], capital: [190, 240],
  };"""
new3b = """  DATA.NPC_GUARD_LV = {
    county: [120, 150], jun: [150, 180], zhou: [180, 210], capital: [210, 240],
  };"""
assert s.count(old3b) == 1, 'D3b count=' + str(s.count(old3b))
s = s.replace(old3b, new3b, 1)

# ---- D4. 新增三张表（插在 WILD_GEN_CHANCE 行后）----
old4 = "  DATA.WILD_GEN_CHANCE = [0, 0, 0, 0.04, 0.08, 0.14, 0.22, 0.34, 0.48, 0.64, 0.8];"
new4 = old4 + """
  /* ============================================================
   * v89.185（老板 2）：野外守将体系 —— 等级与衰减（唯一来源）
   * ------------------------------------------------------------
   * 老板原话：「野地1-10级，分别设置30-120级野外将领，其资质普遍设定为英杰。
   *   据点则为名世，等级60起步-150级。名城则为天授120-240级」。
   * · 野地守将等级 = base + (lv−1)×perLv + rand(jit)  → Lv1: 30~39 …… Lv10: 120~129
   * · 据点守将等级 = base + (lv−1)×perLv + rand(jit)  → Lv1: 60~69 …… Lv10: 150~159
   * · 资质：野地=英杰 · 据点=名世 · 名城=天授（见 GAME.guardRankIdxOf / npcCityGuard）。
   * 生成处：GAME.wildDefenseAt / GAME.fortGuardOf；
   * 成型（等级/资质**真转战力**：四维按等级 + 满体力）见 GAME.guardFillOf。
   * ============================================================ */
  DATA.WILD_GUARD_LV = { base: 30, perLv: 10, jit: 10 };
  DATA.FORT_GUARD_LV = { base: 60, perLv: 10, jit: 10 };
  /* v89.185（老板 3）：「有驻军嚯嚯，等级确实应该降低更快，每个现实日降2级」——
     被占野地每现实日衰减 **2 级**（perDay）；有驻军守着减半为 1 级（heldPerDay）——
     驻军不再"完全免除"衰减（旧口径让 1 兵驻军即可白嫖保鲜），但保留一半价值；
     **任何保护都不能把衰减降到 0**（老板第 5 条：「即使这样，我还是建议等级衰竭每天-1」）。
     下限 1 级（低于 1 不再降）。推进处：GAME.decayWilds。 */
  DATA.WILD_DECAY = { perDay: 2, heldPerDay: 1 };"""
assert s.count(old4) == 1, 'D4 count=' + str(s.count(old4))
s = s.replace(old4, new4, 1)

# ---- 写盘 + 自检 ----
assert s != orig
assert s.count('tailDiv: 4') == 1
assert s.count('DATA.WILD_GUARD_LV') == 1 and s.count('DATA.FORT_GUARD_LV') == 1
assert s.count('DATA.WILD_DECAY') == 1
assert 'maxK' not in s.split('DATA.MAYOR_CURVE')[1][:200], 'maxK residue'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch data OK, len=' + str(len(s)))
