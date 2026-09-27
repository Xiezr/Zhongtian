# -*- coding: utf-8 -*-
"""v89.162 补丁 A（核心）：
  ① domain.js · mayorBonus 加 `tax` 项（内政 1 点 → 税收 +1%，与产量/建造同率同封顶）
  ② state.js · cityProdPerSec 税收结算接入城主内政
  ③ state.js · prodBreakdown gold 分支重写（逐项对齐结算 · 修"带税制加成时分叉"）
写法：分段落盘 + 幂等 guard（查新特征已在则跳过）+ 写后自检
"""
import io, sys

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
    wr(path, s)          # 分段落盘：每段立即写
    LOG.append('  [ ok ] %s' % tag)

# ══════════ ① domain.js · mayorBonus（无城主分支） ══════════
rep('js/domain.js', 'domain · mayorBonus 无城主分支加 tax:0',
"""    if (!g) return { name: null, prod: 0, build: 0, research: 0, def: 0, faint: 1 };""",
"""    if (!g) return { name: null, prod: 0, build: 0, tax: 0, research: 0, def: 0, faint: 1 };""")

# ══════════ ② domain.js · mayorBonus（主分支加 tax） ══════════
rep('js/domain.js', 'domain · mayorBonus 主分支加 tax（内政 1 点 → 税收 +1%）',
"""      prod: Math.min(1.5, a.nz * 0.01 * faint),     // 内政 1 点 → 产量 +1%（封顶 +150%）
      build: Math.min(1.5, a.nz * 0.01 * faint),    // 内政 1 点 → 建造速度 +1%（封顶 +150%）
      research: Math.min(1.5, a.zm * 0.005 * faint),// 智谋 1 点 → 研究速度 +0.5%""",
"""      prod: Math.min(1.5, a.nz * 0.01 * faint),     // 内政 1 点 → 产量 +1%（封顶 +150%）
      build: Math.min(1.5, a.nz * 0.01 * faint),    // 内政 1 点 → 建造速度 +1%（封顶 +150%）
      /* v89.162（老板「内政对税收也应有加成」）：内政 1 点 → 税收 +1%（与产量/建造同率同封顶）。
         这是城主「内政」的第三处落点（产量/建造/税收）——别再另立系数：
         改率就改这三行的 0.01 与封顶 1.5，结算（cityProdPerSec）与分解（prodBreakdown）同源。 */
      tax: Math.min(1.5, a.nz * 0.01 * faint),
      research: Math.min(1.5, a.zm * 0.005 * faint),// 智谋 1 点 → 研究速度 +0.5%""")

# ══════════ ③ state.js · cityProdPerSec 税收接入城主内政 ══════════
rep('js/state.js', 'state · cityProdPerSec 税收加城主内政',
"""    /* v73（老板「限制黄金的获取」）：税收按 DATA.GOLD_GATE.tax 收紧 */
    var taxGold = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (1 + GAME.cityBonusNum(city, 'taxPct'))
      * (DATA.GOLD_GATE.tax || 1);""",
"""    /* v73（老板「限制黄金的获取」）：税收按 DATA.GOLD_GATE.tax 收紧
       v89.162（老板「内政对税收也应有加成」）：城主内政 → 税收 +1%/点（封顶 +150%，与产量/建造同率），
       与"税制加成"（名城/爵位/主城/神器）**同层相加**（v89.157 的加法口径，不连乘）。 */
    var mbTax162 = GAME.mayorBonus(city).tax || 0;
    var taxGold = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (1 + GAME.cityBonusNum(city, 'taxPct') + mbTax162)
      * (DATA.GOLD_GATE.tax || 1);""")

# ══════════ ④ state.js · prodBreakdown gold 分支重写 ══════════
OLD_BD = """    if (r === 'gold') {
      var s = GAME.state;
      var popCap = city ? GAME.maxPopOf(city)
        : s.cities.reduce(function (a, c) { return a + GAME.maxPopOf(c); }, 0);
      /* v73：黄金闸门与 cityProdPerSec / productionPerSec 同口径 ——
         否则"分解各项之和 = 总产量"对不上（显示与结算是两本账，本项目的老病）。 */
      var tax = popCap * (s.hearts || 100) / 100 * (s.tax || 0) * (DATA.GOLD_GATE.tax || 1);
      var salary = (DATA.RANK[s.rank || 0].salary || 0) * (DATA.GOLD_GATE.salary || 1);
      rows.push({ name: '税收（人口' + U.numText(popCap, 0) + '×民心' + Math.round(s.hearts || 100) + '%×税率' + Math.round((s.tax || 0) * 100) + '%）', val: tax / 3600 * ts });
      if (salary) rows.push({ name: '爵位俸禄', val: salary / 3600 * ts });
      var itemM = GAME.prodBuffMult();
      var baseG = tax + salary;
      if (itemM.gold) rows.push({ name: '宝物加成 +' + Math.round(itemM.gold * 100) + '%', val: baseG * itemM.gold / 3600 * ts });
      if (GAME.story) {
        var smg = GAME.story.prodMult('gold');
        if (Math.abs(smg - 1) > 1e-9) rows.push({ name: '天时（季/天候/年号）' + (smg >= 1 ? '+' : '') + Math.round((smg - 1) * 100) + '%', val: baseG * (smg - 1) / 3600 * ts });
      }
      return rows;
    }"""

NEW_BD = """    if (r === 'gold') {
      var s = GAME.state;
      /* v89.162（老板「内政对税收也应有加成」· 顺修）：税收分解与结算**逐项对齐** ——
         修"带税制加成（爵位/名城/主城/神器）时分解之和 < 结算值"的分叉
         （这些加成此前只在 cityProdPerSec 里乘、分解里没有列 = 显示与结算两本账）。
         逐城求和（名城档位/主城因城而异 · 城主内政按城），与 cityProdPerSec 逐城相乘的结构同源。 */
      var _cts162 = city ? [city] : (s.cities || []);
      var _popC162 = 0, _taxBase162 = 0, _taxCity162 = 0, _taxMayor162 = 0;
      _cts162.forEach(function (ct) {
        var pop1 = GAME.maxPopOf(ct);
        _popC162 += pop1;
        var b1 = pop1 * (s.hearts || 100) / 100 * (s.tax || 0) * (DATA.GOLD_GATE.tax || 1);
        _taxBase162 += b1;
        _taxCity162 += b1 * GAME.cityBonusNum(ct, 'taxPct');
        _taxMayor162 += b1 * (GAME.mayorBonus(ct).tax || 0);
      });
      rows.push({ name: '税收（人口' + U.numText(_popC162, 0) + '×民心' + Math.round(s.hearts || 100) + '%×税率' + Math.round((s.tax || 0) * 100) + '%）', val: _taxBase162 / 3600 * ts });
      if (_taxCity162) rows.push({ name: '税制加成（名城/爵位/主城/神器）', val: _taxCity162 / 3600 * ts });
      if (_taxMayor162) rows.push({ name: '城主内政', val: _taxMayor162 / 3600 * ts });
      var salary = (DATA.RANK[s.rank || 0].salary || 0) * (DATA.GOLD_GATE.salary || 1);
      /* 俸禄乘子（宝物×天时）走 productionPerSec 的原口径（连乘），直接给最终值一行 */
      var gmS162 = 1;
      var itemM = GAME.prodBuffMult();
      if (itemM.gold) gmS162 *= (1 + itemM.gold);
      var smg = 1;
      if (GAME.story) { smg = GAME.story.prodMult('gold'); gmS162 *= smg; }
      if (salary) rows.push({ name: '爵位俸禄' + (Math.abs(gmS162 - 1) > 1e-9 ? '（含宝物/天时）' : ''), val: salary * gmS162 / 3600 * ts });
      /* 宝物/天时对**税收部分**：结算为加法（v89.157），逐项展开 —— 各项之和 = 总值 */
      var _taxAll162 = _taxBase162 + _taxCity162 + _taxMayor162;
      if (itemM.gold) rows.push({ name: '宝物加成 +' + Math.round(itemM.gold * 100) + '%', val: _taxAll162 * itemM.gold / 3600 * ts });
      if (GAME.story && Math.abs(smg - 1) > 1e-9) rows.push({ name: '天时（季/天候/年号）' + (smg >= 1 ? '+' : '') + Math.round((smg - 1) * 100) + '%', val: _taxAll162 * (smg - 1) / 3600 * ts });
      return rows;
    }"""

rep('js/state.js', 'state · prodBreakdown gold 逐项对齐（含税制加成行 + 城主内政行）', OLD_BD, NEW_BD)

print('\n'.join(LOG))
print('补丁 A 完成')
