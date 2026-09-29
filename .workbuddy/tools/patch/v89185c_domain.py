# -*- coding: utf-8 -*-
"""v89.185 批次1 · domain.js —— 不封口曲线 / 衰减-2 / 守将成型 / 民心人口。"""
import io

P = 'js/domain.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
orig = s
def rep(tag, old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, tag + ' count=' + str(c)
    s = s.replace(old, new, 1)

# ==== C1. curveBonusOf 上方注释 ====
rep('C1',
"""  /* ============================================================
   * v89.164（老板 1）：**分段减半曲线**（城主六维加成的唯一曲线出口）——
   *   每 `seg` 点一段，段内率 = r0 / 2^k；总量收敛于 2·r0·seg（几何级数和）。
   *   前 `seg` 点与旧线性一字不差（老档体感不变）；`maxK` 段后截断（增量已 <0.001%，无感）。
   * 样本（见 DATA.MAYOR_CURVE 头注）：内政 836 → +293.3% · 智谋 836 → +146.7%。
   * ============================================================ */""",
"""  /* ============================================================
   * v89.164（老板 1）→ v89.185（老板「设计不封口上限」）：城主六维加成的唯一曲线出口 ——
   *   率 = r0 / min(2^k, tailDiv)（k 为段号）：前两段减半照旧（与 v89.164 逐点相同），
   *   段 2 起率恒定 r0/4 —— **不再减半、永不封顶**（内政 +0.25%/点 · 智谋 +0.125%/点）。
   *   450 点以内与旧曲线一字不差（老档体感不变）；尾段边际恒定（后期提升永不熄火）。
   * 样本（见 DATA.MAYOR_CURVE 头注）：内政 1400 → +500%（旧封顶 +299.5%）。
   * ============================================================ */""")

# ==== C2. curveBonusOf 函数本体 ====
rep('C2',
"""  GAME.curveBonusOf = function (pts, r0, seg) {
    var MC = DATA.MAYOR_CURVE || {};
    seg = Math.max(1, seg || MC.seg || 150);
    var maxK = MC.maxK || 20;
    var total = 0, left = Math.max(0, pts || 0), k = 0;
    while (left > 0 && k < maxK) {
      var take = Math.min(left, seg);
      total += take * (r0 / Math.pow(2, k));
      left -= take; k++;
    }
    return total;
  };""",
"""  GAME.curveBonusOf = function (pts, r0, seg) {
    var MC = DATA.MAYOR_CURVE || {};
    seg = Math.max(1, seg || MC.seg || 150);
    var tailDiv = Math.max(1, MC.tailDiv || 4);
    var total = 0, left = Math.max(0, pts || 0), k = 0;
    while (left > 0) {
      var div = Math.min(Math.pow(2, k), tailDiv);
      if (div >= tailDiv) { total += left * r0 / tailDiv; break; }   /* v89.185：尾段恒定率 —— 不封口 */
      var take = Math.min(left, seg);
      total += take * r0 / div;
      left -= take; k++;
    }
    return total;
  };""")

# ==== C3. mayorBonus 注释 ====
rep('C3',
"""    /* v89.164（老板 1）：「六维加成都走第三条路子」——**分段减半曲线**（DATA.MAYOR_CURVE）：
       首段（≤150 点）率与旧线性一致（老档体感不变），之后每段率减半、
       总量收敛于首段满值的 2 倍（内政极限 +300% · 智谋极限 +150%）。
       旧的三条"封顶"常量（1.5/1.5/1.0）随之下线 —— 曲线自带边界，消费端不再二次截断。 */""",
"""    /* v89.164（老板 1）→ v89.185（老板「设计不封口上限」）：六维加成走 DATA.MAYOR_CURVE 曲线 ——
       前两段减半照旧、段 2 起率恒定（内政尾段 +0.25%/点 · 智谋 +0.125%/点），永不封顶。
       旧的三条"封顶"常量（1.5/1.5/1.0）**与 v89.164 的收敛边界都已下线** —— 消费端不做任何二次截断。 */""")

# ==== C4/C5. 行内注释 ====
rep('C4',
"      prod: GAME.curveBonusOf(a.nz, 0.01, MB_SEG) * faint,      // 内政 → 产量（150→+150% · 极限 +300%）",
"      prod: GAME.curveBonusOf(a.nz, 0.01, MB_SEG) * faint,      // 内政 → 产量（150→+150% · 尾段恒定不封口）")
rep('C5',
"      research: GAME.curveBonusOf(a.zm, 0.005, MB_SEG) * faint, // 智谋 → 研究（150→+75% · 极限 +150%）",
"      research: GAME.curveBonusOf(a.zm, 0.005, MB_SEG) * faint, // 智谋 → 研究（150→+75% · 尾段恒定不封口）")

# ==== C6. guardRankIdxOf 注释 + 函数 ====
rep('C6',
"""   * 野外目标守将的**资质档位映射**（唯一出口）—— 三处共用：
   *   · GAME.wildDefenseAt（野地守将）：档位 1 + ⌊lv/3⌋
   *   · GAME.fortGuardOf（据点守将）：档位 2 + ⌊lv/3⌋（据点=城，比同级野地高一档）
   *   · GAME.recGenOf（出征面板"相称建议"）：同一张映射 —— 打谁，宜与谁同档。
   * 以后调守将资质强度只改这里（界面建议自动跟）。
   * ============================================================ */
  GAME.guardRankIdxOf = function (kind, lv) {
    var base = (kind === 'fort') ? 2 : 1;
    var v = Math.max(0, lv | 0);
    return Math.min(DATA.GEN_RANKS.length - 1, base + Math.floor(v / 3));
  };""",
"""   * 野外目标守将的**资质档位映射**（唯一出口）—— 三处共用：
   *   · GAME.wildDefenseAt（野地守将）：**英杰**（v89.185 老板：「其资质普遍设定为英杰」）
   *   · GAME.fortGuardOf（据点守将）：**名世**（v89.185 老板：「据点则为名世」）
   *   · GAME.recGenOf（出征面板"相称建议"）：同一张映射 —— 打谁，宜与谁同档。
   * v89.185 起资质**不再随等级抬档**（旧口径 Lv6+ 出天授 —— 老板定调"普遍英杰"）；
   *   守将强度改由**等级**承担（见 DATA.WILD_GUARD_LV / FORT_GUARD_LV 与 GAME.guardFillOf）。
   * 以后调守将资质只改这里（界面建议自动跟）。
   * ============================================================ */
  GAME.guardRankIdxOf = function (kind, lv) {
    /* v89.185（老板 2）：资质定稿（lv 参数保留以兼容签名；强度不再经资质、改经等级） */
    var want = (kind === 'fort') ? 'ming' : 'ying';
    var idx = -1;
    (DATA.GEN_RANKS || []).forEach(function (r, i) { if (idx < 0 && r.id === want) idx = i; });
    return idx >= 0 ? idx : ((kind === 'fort') ? 3 : 2);
  };""")

# ==== C7. 插入 guardFillOf（在 recGenOf 注释块之前）====
rep('C7',
"""  /* ============================================================
   * v89.129：**"相称"尺子**（唯一出口）—— 出征某目标"宜派"什么资质/等级的将领。""",
"""  /* ============================================================
   * v89.185（老板 2 配套）：**守将成型（满状态）唯一出口**
   * ------------------------------------------------------------
   * 本轮取证发现（真缺陷）：`wildDefenseAt / fortGuardOf` 走 `makeGeneral` 生成守将，
   *   而 makeGeneral 的四维 = 资质区间随机（**不随等级**）、体力 = 初始 100
   *   （STA 上限虽随等级派生，但 staNow 停在 100 → hpMult 恒 ×1.089）——
   *   "等级 / 资质"在野地/据点守将身上**只是标签，不转战力**
   *   （对照：名城守将 npcCityGuard 走手写公式，四维/体力都随等级 —— 两套口径不一致）。
   * 本出口把守将补成与真实将领同源的**全量形态**（三处守将共用同一把尺）：
   *   ① 四维 = 资质上界×特性权重 + (等级−1)×成长×特性权重×(5/Σ权重)
   *      （= v89.73 名城守将公式：自动加点 + 自由点都按特性投放）；
   *   ② 体力 = 满（setStaNow(staMax) —— 守将出战即满状态；与 v89.159"升级回满"同族）。
   * 以后调"守将强度"只改这里（野地 / 据点 / 名城三处生成全接）。
   * ============================================================ */
  GAME.guardFillOf = function (g) {
    if (!g) return g;
    var rk = GAME.rankOf(g);
    var st = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) st = x; });
    if (!st) st = (DATA.GEN_STYLES || [])[0] || { mul: { tong: 1, nz: 1, yw: 1, zm: 1 } };
    var m = st.mul;
    var mSum = (m.tong + m.nz + m.yw + m.zm) || 4;
    var f = 5 / mSum;
    var dims = ['tong', 'yw', 'zm', 'nz'], up = Math.max(0, (g.level || 1) - 1);
    dims.forEach(function (d) {
      g[d] = Math.round(rk.base[1] * m[d] + up * (rk.grow || 1) * m[d] * f);
    });
    g.freePts = 0;
    if (GAME.setStaNow && GAME.staMax) GAME.setStaNow(g, GAME.staMax(g));
    return g;
  };

  /* ============================================================
   * v89.129：**"相称"尺子**（唯一出口）—— 出征某目标"宜派"什么资质/等级的将领。""")

# ==== C7b. recGenOf 注释里的旧公式说明 ====
rep('C7b',
"""   *   · 野地：资质 = guardRankIdxOf('wild', lv)（与 wildDefenseAt 同源）、
   *     等级 ≥ max(3, lv*2)（= 野地守将等级公式的下限）；
   *   · 据点：资质 = guardRankIdxOf('fort', lv)（与 fortGuardOf 同源）、
   *     等级 ≥ max(10, lv*4 + 20)（= 据点守将等级下限）；""",
"""   *   · 野地：资质 = guardRankIdxOf('wild', lv)（与 wildDefenseAt 同源）、
   *     等级 ≥ DATA.WILD_GUARD_LV 下限（v89.185：base + (lv−1)×perLv —— 与守将生成同尺）；
   *   · 据点：资质 = guardRankIdxOf('fort', lv)（与 fortGuardOf 同源）、
   *     等级 ≥ DATA.FORT_GUARD_LV 下限（v89.185：base + (lv−1)×perLv）；""")

# ==== C8. decayWilds 区间替换 ====
a = s.index('  /* 被占野地每现实日 \u22121 级')
b = s.index('return changed;\n  };', a) + len('return changed;\n  };')
new8 = """  /* 被占野地每现实日衰减（v89.185 起基础 2 级；有驻军减半为 1 级；最低 1 级）；
     无主野地由日盐自动 +1 级。 */
  GAME.decayWilds = function () {
    var s = GAME.state;
    if (!s || !s.wilds || !s.wilds.length) return [];
    var WD_ = DATA.WILD_DECAY || { perDay: 2, heldPerDay: 1 };
    var today = GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
    var changed = [];
    s.wilds.forEach(function (w) {
      if (w.levelDay == null) { w.levelDay = today; return; }
      /* v89.185（老板 3）：「有驻军嚯嚯，等级确实应该降低更快，每个现实日降 2 级」——
         驻军不再"免衰减"（v23 旧口径：1 兵驻军即可白嫖保鲜），改为**减半**（2 → 1）；
         且**任何保护都不能把衰减降到 0** —— 老板第 5 条：「即使这样，我还是建议等级衰竭每天-1」。 */
      var step = GAME.wildHeld(w) ? Math.max(1, WD_.heldPerDay) : Math.max(1, WD_.perDay);
      var days = today - w.levelDay;
      if (days <= 0) return;
      var nl = Math.max(1, (w.level || 1) - days * step);
      w.levelDay = today;
      if (nl !== w.level) { w.level = nl; changed.push(w); }
    });
    if (changed.length) {
      GAME.log('\u26a0\ufe0f 久据之下野地渐荒：' + changed.length + ' 块野地等级下降（每现实日 -' + (WD_.perDay || 2)
        + ' 级 \u00b7 有驻军 -' + (WD_.heldPerDay || 1) + ' 级 \u00b7 需轮换争夺）');
    }
    return changed;
  };"""
s = s[:a] + new8 + s[b:]

# ==== C9. wildDefenseAt 守将段 ====
rep('C9',
"""      var rk = DATA.GEN_RANKS[GAME.guardRankIdxOf('wild', lv)];   /* v89.129：唯一出口 */
      var g = GAME.makeGeneral(sn + gn, Math.max(3, lv * 2 + Math.floor(rand() * 5)), 'guard', null, false, rk.id, 'balance');""",
"""      var rk = DATA.GEN_RANKS[GAME.guardRankIdxOf('wild', lv)];   /* v89.129：唯一出口（v89.185：野地=英杰） */
      /* v89.185（老板 2）：「野地1-10级，分别设置30-120级野外将领」——
         等级 = base + (lv−1)×perLv + rand(jit)（DATA.WILD_GUARD_LV）；
         传确定性 rand 流（第 8 参）→ 同一天侦查所见即战斗所遇（含四维）；
         生成后走 guardFillOf 补成"满状态全量将"（等级/资质真转战力）。 */
      var LG = DATA.WILD_GUARD_LV || { base: 30, perLv: 10, jit: 10 };
      var glv = LG.base + Math.max(0, lv - 1) * LG.perLv + Math.floor(rand() * LG.jit);
      var g = GAME.makeGeneral(sn + gn, glv, 'guard', null, false, rk.id, 'balance', rand);
      GAME.guardFillOf(g);""")

# ==== C10. recGenOf 两行 lvMin ====
rep('C10a',
"      lvMin = Math.max(3, (t.lv || 0) * 2);",
"""      /* v89.185：与守将生成同尺（DATA.WILD_GUARD_LV 的下限 = base + (lv−1)×perLv） */
      var _wg185 = DATA.WILD_GUARD_LV || { base: 30, perLv: 10 };
      lvMin = _wg185.base + Math.max(0, (t.lv || 0) - 1) * _wg185.perLv;""")
rep('C10b',
"      lvMin = Math.max(10, (t.lv || 1) * 4 + 20);",
"""      /* v89.185：与守将生成同尺（DATA.FORT_GUARD_LV） */
      var _fg185 = DATA.FORT_GUARD_LV || { base: 60, perLv: 10 };
      lvMin = _fg185.base + Math.max(0, (t.lv || 1) - 1) * _fg185.perLv;""")

# ==== C11. popGrowthOf 基数（+注释）====
rep('C11a',
"       基数仍是民房上限。分解走 GAME.popSourcesOf（界面悬停可见，不搞黑箱）。 */",
"       基数 = 民房上限（v89.185：已折算民心的**有效上限**）。分解走 GAME.popSourcesOf（界面悬停可见，不搞黑箱）。 */")
rep('C11b',
"    var base = GAME.maxPopOf(city) / Math.max(0.1, cfg.fillHours == null ? 2 : cfg.fillHours);",
"""    /* v89.185（老板 6）：「实际人口上限=人口上限*民心/100」——
       增速基数改走**有效上限**（民心折算）："2 小时补满"补到的是实际能到的上限。 */
    var base = GAME.effPopCapOf(city) / Math.max(0.1, cfg.fillHours == null ? 2 : cfg.fillHours);""")

# ==== C12. 插入 effPopCapOf（maxPopOf 之后）====
rep('C12',
"""       现在本来就没有该加成 —— 不删参数是为了不动那些调用点。） */
    return cap;
  };""",
"""       现在本来就没有该加成 —— 不删参数是为了不动那些调用点。） */
    return cap;
  };
  /* ============================================================
   * v89.185（老板 6）：**实际人口上限** —— 唯一出口
   * ------------------------------------------------------------
   * 老板原话：「民心与人口比例挂钩，实际人口上限=人口上限*民心/100」。
   * 口径：
   *   · 基准 = GAME.maxPopOf（民房 + 专精，一个来源）；
   *   · 实际 = round(基准 × 民心% ÷ 100)（民心走唯一出口 GAME.heartsOf）；
   *   · **只封增长、不削存量**（与资源"超上限停止增长"同规）：民心下滑时人口停在原地。
   * 消费面（v89.185 全量）：人口增长爬升目标（tickOnce）· 增速基数（popGrowthOf）·
   *   城栏与统计面板显示 · 移民令封顶 · 任务"人口上限"指标。
   * 不改消费面（刻意）：税收基数（已含 hearts/100 因子，别双层打折）· 劳作占用（建筑规模口径）。
   * ============================================================ */
  GAME.effPopCapOf = function (city) {
    var base = GAME.maxPopOf(city);
    var h = GAME.heartsOf ? GAME.heartsOf() : 100;
    return Math.round(base * Math.max(0, Math.min(100, h)) / 100);
  };""")

# ==== C13. 任务口径（指标 + 生成校验）====
rep('C13a',
"""      case 'popCap':
        t = 0; (s.cities || []).forEach(function (c) { t += GAME.maxPopOf(c); });
        return t;""",
"""      case 'popCap':
        /* v89.185（老板 6）：任务口径 = **实际人口上限**（民心折算）——"面板写 60000、实际只能到 48000"的落差不再出现 */
        t = 0; (s.cities || []).forEach(function (c) { t += (GAME.effPopCapOf ? GAME.effPopCapOf(c) : GAME.maxPopOf(c)); });
        return t;""")
rep('C13b',
"      (s.cities || []).forEach(function (ct) { popCap += (GAME.maxPopOf ? GAME.maxPopOf(ct) : 0) || 0; });",
"      (s.cities || []).forEach(function (ct) { popCap += (GAME.effPopCapOf ? GAME.effPopCapOf(ct) : 0) || 0; });")

# ==== 写盘 + 自检 ====
assert s != orig
assert s.count('GAME.guardFillOf = function') == 1
assert s.count('GAME.effPopCapOf = function') == 1
assert 'maxK' not in s.split('GAME.curveBonusOf')[1][:300]
for gone in ['var maxK = MC.maxK || 20;', '档位 1 + ⌊lv/3⌋', '档位 2 + ⌊lv/3⌋']:
    assert gone not in s, 'residue: ' + gone
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch domain OK, len=' + str(len(s)))
