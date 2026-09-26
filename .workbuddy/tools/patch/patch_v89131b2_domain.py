# -*- coding: utf-8 -*-
"""v89.131 补丁 B2：domain.js —— 精力公式拆成"零件唯一出口"（energyPartsOf）
界面悬停与断言都读它，不在别处重算权重（唯一出口原则）。
用法：python patch_v89131b2_domain.py
"""
import io

P = 'E:/Deepseekdb/js/domain.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s

old = """  GAME.energyMaxOf = function (g) {
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
  };"""
new = """  /* 零件出口：把"基准 + 六维逐项贡献"摊开给界面与断言读 ——
     这样悬停分解与上限数值**同源**，界面不必自己再算一遍权重（唯一出口）。 */
  GAME.energyPartsOf = function (g) {
    var E = DATA.ENERGY || { base: 40, per: {} };
    var per = E.per || {};
    /* a 走 genAttrs（含装备等一切加成）——"六维"在面板上的含义就是这份 */
    var a = (g && GAME.genAttrs) ? GAME.genAttrs(g)
      : { tong: (g && g.tong) || 0, yw: (g && g.yw) || 0, zm: (g && g.zm) || 0,
        nz: (g && g.nz) || 0, spd: (g && g.speed) || 0,
        staMax: (g && GAME.staMax) ? GAME.staMax(g) : 100 };
    var DIMS = [['tong', '统率'], ['yw', '勇武'], ['zm', '智谋'], ['nz', '内政'],
      ['spd', '速度'], ['staMax', '体力']];
    var items = [];
    DIMS.forEach(function (d) {
      var val = (d[0] === 'staMax') ? (a.staMax != null ? a.staMax : (a.sta || 0)) : (a[d[0]] || 0);
      var w = per[d[0]] || 0;
      if (w) items.push({ k: d[0], n: d[1], val: val, v: Math.round(val * w * 100) / 100 });
    });
    return { base: E.base, items: items,
      total: Math.round(E.base + items.reduce(function (t, x) { return t + x.v; }, 0)) };
  };
  GAME.energyMaxOf = function (g) {
    return GAME.energyPartsOf(g).total;
  };"""
assert s.count(old) == 1, '锚点 %d' % s.count(old)
s = s.replace(old, new)
assert (s.count('{') - s.count('}')) == (orig.count('{') - orig.count('}')), '花括号盈亏'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch B2(domain) OK（energyPartsOf 零件出口）')
