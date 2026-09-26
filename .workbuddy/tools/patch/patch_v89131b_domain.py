# -*- coding: utf-8 -*-
"""v89.131 补丁 B：domain.js —— 精力三出口（上限 / 当前 / 写入）
插在 GAME.setStaNow 之后（体力三出口的同族位置）。
用法：python patch_v89131b_domain.py
"""
import io

P = 'E:/Deepseekdb/js/domain.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s

anchor = """  /* 体力 → 全军生命加成（双曲，渐近 +80%，永不硬顶出断崖）。"""
new = """  /* ============================================================
   * 精力（v89.131 · 老板「精力的数值设定基于六维设计一个公式」）
   * ------------------------------------------------------------
   * 口径（唯一出口，别再在别处拼这个式子）：
   *     精力上限 energyMax = DATA.ENERGY.base + Σ(六维 × DATA.ENERGY.per[维])
   *   六维取自 GAME.genAttrs（含装备/套装/丹药/内功——与面板上的六维同一份数），
   *   其中"体力"一维取 **staMax**（第六维的展示值就是体力上限）。
   *
   * 为什么不复用 staMax 当精力上限（v89.116 的临时兜底）：
   *   那个写法让"精力/上限"跟着体力涨到几千，而回复段又硬顶 100 ——
   *   显示与回复两个口径（典型的"同一数据两个出口"）。
   *   现在上限由本函数一处给出，回复段与面板都读它。
   * ============================================================ */
  GAME.energyMaxOf = function (g) {
    var E = DATA.ENERGY || { base: 40, per: {} };
    if (!g) return E.base;
    var per = E.per || {};
    /* a 走 genAttrs（含装备等一切加成）——"六维"在面板上的含义就是这份 */
    var a = GAME.genAttrs ? GAME.genAttrs(g) : { tong: g.tong || 0, yw: g.yw || 0, zm: g.zm || 0,
      nz: g.nz || 0, spd: g.speed || 0, staMax: GAME.staMax ? GAME.staMax(g) : 100 };
    var v = E.base
      + (a.tong || 0) * (per.tong || 0) + (a.yw || 0) * (per.yw || 0)
      + (a.zm || 0) * (per.zm || 0) + (a.nz || 0) * (per.nz || 0)
      + (a.spd || 0) * (per.spd || 0)
      + ((a.staMax != null ? a.staMax : (a.sta || 0))) * (per.sta || 0);
    return Math.round(v);
  };
  /* 精力当前值：从未记过 = 满（与体力 staNow 的"null = 满"同一约定）；
     越界夹回 [0, 上限]（上限随六维变动——换装备/升级后不越界）。 */
  GAME.energyNowOf = function (g) {
    if (!g) return 0;
    var mx = GAME.energyMaxOf(g);
    if (g.energy == null) return mx;
    return Math.max(0, Math.min(mx, Math.round(g.energy)));
  };
  /* 精力当前值的**唯一写入口** */
  GAME.setEnergyNow = function (g, v) {
    if (!g) return 0;
    var mx = GAME.energyMaxOf(g);
    g.energy = Math.max(0, Math.min(mx, Math.round(v)));
    return g.energy;
  };

  /* 体力 → 全军生命加成（双曲，渐近 +80%，永不硬顶出断崖）。"""
assert s.count(anchor) == 1, '锚点 %d' % s.count(anchor)
s = s.replace(anchor, new)
assert (s.count('{') - s.count('}')) == (orig.count('{') - orig.count('}')), '花括号盈亏'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch B(domain) OK（精力三出口）')
