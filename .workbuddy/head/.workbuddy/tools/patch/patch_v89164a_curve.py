# -*- coding: utf-8 -*-
"""v89.164 补丁 A（核心）：城主六维加成改「分段减半曲线」
   data.js：DATA.MAYOR_CURVE 常量表
   domain.js：curveBonusOf 曲线出口 + mayorBonus 五项走曲线 + 两处二次截断退役
   systems.js：研究加速二次截断退役"""
import io

R = 'E:/Deepseekdb/'
LOG = []

def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, guard=None):
    s = rd(path)
    g = guard if guard is not None else new
    if g in s:
        LOG.append('  [skip] %s（新内容已在）' % tag)
        return
    c = s.count(old)
    assert c == 1, '%s 锚点数=%d（应为 1）' % (tag, c)
    s = s.replace(old, new)
    wr(path, s)
    LOG.append('  [ ok ] %s' % tag)

# ══════════ ① data.js · DATA.MAYOR_CURVE ══════════
rep('js/data.js', 'data · DATA.MAYOR_CURVE（分段减半曲线常量）',
"""  DATA.LOYALTY = {""",
"""  /* ============================================================
   * v89.164（老板 1）：城主六维加成的**曲线**（"第三条路子"定稿）
   * ------------------------------------------------------------
   * 老板原话：「六维加成都走第三条路子，具体比例你进行数值设计」。
   * 定稿：**分段减半折线** —— 每 `seg` 点一段，段内率逐段减半，
   *   总量收敛于「首段满值的 2 倍」（0 → r0·seg·(1 + 1/2 + 1/4 + …) = 2·r0·seg）。
   *   首段率与旧线性段**相同**（内政 1%/点 · 智谋 0.5%/点）→ **seg 以内与旧值一字不差**。
   * 样本（内政系：产量/建造/税收）
   *   150 → +150% · 200 → +175% · 300 → +225% · 500 → +268.75% · 836 → +293.3% · 极限 +300%
   * 样本（智谋系：研究/城防）
   *   150 → +75% · 300 → +112.5% · 836 → +146.7% · 极限 +150%
   * 理由：① 成长感（836 从旧封顶 +150% → +293%，几乎翻倍）；② 有界可控
   *   （不会回到 v89.93 前的 ×10 量级）；③ 前 150 点与旧版完全一致（老档体感不变）。
   * 消费端唯一出口 = `GAME.curveBonusOf`（mayorBonus 内部调用），别处不重算。
   * ============================================================ */
  DATA.MAYOR_CURVE = { seg: 150, maxK: 20 };   /* maxK：段数上限（3000 点后增量 <0.001%，截断无感） */

  DATA.LOYALTY = {""")

# ══════════ ② domain.js · curveBonusOf 出口 ══════════
rep('js/domain.js', 'domain · curveBonusOf（唯一曲线出口）',
"""  GAME.mayorBonus = function (city) {
    var g = GAME.mayorGeneralOf(city);
    if (!g) return { name: null, prod: 0, build: 0, tax: 0, research: 0, def: 0, faint: 1 };""",
"""  /* ============================================================
   * v89.164（老板 1）：**分段减半曲线**（城主六维加成的唯一曲线出口）——
   *   每 `seg` 点一段，段内率 = r0 / 2^k；总量收敛于 2·r0·seg（几何级数和）。
   *   前 `seg` 点与旧线性一字不差（老档体感不变）；`maxK` 段后截断（增量已 <0.001%，无感）。
   * 样本（见 DATA.MAYOR_CURVE 头注）：内政 836 → +293.3% · 智谋 836 → +146.7%。
   * ============================================================ */
  GAME.curveBonusOf = function (pts, r0, seg) {
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
  };
  GAME.mayorBonus = function (city) {
    var g = GAME.mayorGeneralOf(city);
    if (!g) return { name: null, prod: 0, build: 0, tax: 0, research: 0, def: 0, faint: 1 };""")

# ══════════ ③ domain.js · mayorBonus 五项走曲线 ══════════
rep('js/domain.js', 'domain · mayorBonus 走曲线（五项）',
"""    /* v89.93（整改 W3/U3）：**产量加成封顶 +150%** —— 与建造/征兵/研究（1.5）
       及城防（1.0）同口径。改前它是全游戏**唯一不封顶**的加成项
       （守卫 nz 980 → 产量 ×10.8；宝物流实测推到 nz 6,203 → ×63）。 */
    return {
      name: g.name, gen: g, faint: faint, loyalty: g.loyalty,
      prod: Math.min(1.5, a.nz * 0.01 * faint),     // 内政 1 点 → 产量 +1%（封顶 +150%）
      build: Math.min(1.5, a.nz * 0.01 * faint),    // 内政 1 点 → 建造速度 +1%（封顶 +150%）
      /* v89.162（老板「内政对税收也应有加成」）：内政 1 点 → 税收 +1%（与产量/建造同率同封顶）。
         这是城主「内政」的第三处落点（产量/建造/税收）——别再另立系数：
         改率就改这三行的 0.01 与封顶 1.5，结算（cityProdPerSec）与分解（prodBreakdown）同源。 */
      tax: Math.min(1.5, a.nz * 0.01 * faint),
      research: Math.min(1.5, a.zm * 0.005 * faint),// 智谋 1 点 → 研究速度 +0.5%
      def: Math.min(1.0, a.zm * 0.005 * faint),     // 智谋 1 点 → 城防 +0.5%（封顶 +100%）
    };""",
"""    /* v89.164（老板 1）：「六维加成都走第三条路子」——**分段减半曲线**（DATA.MAYOR_CURVE）：
       首段（≤150 点）率与旧线性一致（老档体感不变），之后每段率减半、
       总量收敛于首段满值的 2 倍（内政极限 +300% · 智谋极限 +150%）。
       旧的三条"封顶"常量（1.5/1.5/1.0）随之下线 —— 曲线自带边界，消费端不再二次截断。 */
    var MB_SEG = (DATA.MAYOR_CURVE || {}).seg || 150;
    return {
      name: g.name, gen: g, faint: faint, loyalty: g.loyalty,
      prod: GAME.curveBonusOf(a.nz, 0.01, MB_SEG) * faint,      // 内政 → 产量（150→+150% · 极限 +300%）
      build: GAME.curveBonusOf(a.nz, 0.01, MB_SEG) * faint,     // 内政 → 建造（同率同曲线）
      /* v89.162（老板「内政对税收也应有加成」）：税收是内政的第三处落点 —— 同率同曲线，
         结算（cityProdPerSec）与分解（prodBreakdown）同源。 */
      tax: GAME.curveBonusOf(a.nz, 0.01, MB_SEG) * faint,
      research: GAME.curveBonusOf(a.zm, 0.005, MB_SEG) * faint, // 智谋 → 研究（150→+75% · 极限 +150%）
      def: GAME.curveBonusOf(a.zm, 0.005, MB_SEG) * faint,      // 智谋 → 城防（同率同曲线）
    };""")

# ══════════ ④ domain.js · cityBuildMult 去二次截断 ══════════
rep('js/domain.js', 'domain · cityBuildMult 去二次截断',
"""  GAME._rawCityBuildMult = function (city) {
    var mb = GAME.mayorBonus(city);
    return 1 / (1 + Math.min(1.5, mb.build || 0));
  };""",
"""  GAME._rawCityBuildMult = function (city) {
    var mb = GAME.mayorBonus(city);
    return 1 / (1 + (mb.build || 0));      /* v89.164：曲线自带边界，二次截断（旧 min 1.5）退役 */
  };""")

# ══════════ ⑤ domain.js · cityDefenseBase 去二次截断 ══════════
rep('js/domain.js', 'domain · cityDefenseBase 去二次截断',
"""    var mbc = GAME.mayorBonus(city);
    if (mbc.name) base = Math.round(base * (1 + Math.min(1.0, mbc.def))); // 城主智谋：城防""",
"""    var mbc = GAME.mayorBonus(city);
    /* v89.164：曲线自带边界，二次截断（旧 min 1.0）退役 */
    if (mbc.name) base = Math.round(base * (1 + (mbc.def || 0))); // 城主智谋：城防""")

# ══════════ ⑥ systems.js · 研究加速去二次截断 ══════════
rep('js/systems.js', 'systems · 研究加速去二次截断',
"""      if (_mb.research) time = Math.round(time / (1 + Math.min(1.5, _mb.research))); // 城主智谋：研究加速""",
"""      /* v89.164：曲线自带边界，二次截断（旧 min 1.5）退役 */
      if (_mb.research) time = Math.round(time / (1 + _mb.research)); // 城主智谋：研究加速""")

print('\n'.join(LOG))
print('补丁 A 完成')
