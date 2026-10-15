# -*- coding: utf-8 -*-
"""v89.109 收尾3：invasionArmyOf 最小分配 bug + 坚壁清野断言场景（兵力在别城）"""
import io, os
# ① state.js：分配保证非空（余数补到最后一项）
p = r'E:/Deepseekdb/js/state.js'
s = io.open(p, encoding='utf-8').read()
a1 = """    var total = Math.max(1, Math.round(power / perMan));
    var out = {};
    for (var k2 in mix) {
      var n = Math.round(total * (mix[k2] || 0) / (wsum || 1));
      if (n > 0) out[k2] = n;
    }
    return { army: out, power: power, total: total };"""
b1 = """    var total = Math.max(1, Math.round(power / perMan));
    /* ⚠️ 分配必须**保底非空**：total=1 时五个 round(0.3/0.22/…) 全是 0 ——
       军队成了空对象 → 引擎跑出"0 回合、双方 0 人、判定守方胜"（本轮白查一次的坑）。
       口径：按权重取整，**余数补到最后一项**（总量恒等于 total）。 */
    var out = {}, left = total, lastK = null;
    for (var k2 in mix) { lastK = k2; }
    for (var k3 in mix) {
      var n3;
      if (k3 === lastK) n3 = left;
      else { n3 = Math.round(total * (mix[k3] || 0) / (wsum || 1)); if (n3 > left) n3 = left; }
      if (n3 > 0) { out[k3] = n3; left -= n3; }
    }
    if (left > 0 && lastK) out[lastK] = (out[lastK] || 0) + left;
    return { army: out, power: power, total: total };"""
assert a1 in s, '①未命中'
s = s.replace(a1, b1, 1)
io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(p + '.tmp', p)
print('state.js：分配保底已修')

# ② smoke：断言场景 —— 兵力放别城（来袭由全境战力撑，被攻城必失守）
pg = r'E:/Deepseekdb/smoke-test.js'
g = io.open(pg, encoding='utf-8').read()
a2 = """  check('实测：坚壁清野使来袭损失 ×0.6（**破防场景** · 同城对照）', (function () {
    var s = GAME.state, c = s.cities[0];
    GAME.schemeDefConsume(c, 'jianbi');"""
b2 = """  check('实测：坚壁清野使来袭损失 ×0.6（**破防场景** · 同城对照）', (function () {
    var s = GAME.state, c = s.cities[0];
    /* v89.109：来袭规模按**全境战力**缩放（invasionPowerOf）—— 要造"必破防"的场景，
       兵力必须放在**别城**：被攻的 A 城空守军（必失守、defRemain=0 过闸），
       乙城有兵（来袭规模由它撑起来、不至于空对空）。用完即撤，不留痕。 */
    var b = G.makeCity({ id: 'jb_b_probe', name: '坚壁乙城', x: 9, y: 9, type: 'self' });
    b.army = { yibing: 1000 };
    s.cities.push(b);
    GAME.schemeDefConsume(c, 'jianbi');"""
assert a2 in g, '②未命中'
g = g.replace(a2, b2, 1)

a3 = """    var d2 = GAME.invasionResolve(c);
    var g1 = (d1.resLost || {}).grain || 0, g2 = (d2.resLost || {}).grain || 0;
    if (g1 <= 0) return false;
    return Math.abs(g2 / g1 - 0.6) < 0.03;
  })());"""
b3 = """    var d2 = GAME.invasionResolve(c);
    /* 撤掉临时乙城（不留痕） */
    var _bi = s.cities.indexOf(b);
    if (_bi >= 0) s.cities.splice(_bi, 1);
    var g1 = (d1.resLost || {}).grain || 0, g2 = (d2.resLost || {}).grain || 0;
    if (g1 <= 0) return false;
    return Math.abs(g2 / g1 - 0.6) < 0.03;
  })());"""
assert a3 in g, '③未命中'
g = g.replace(a3, b3, 1)
io.open(pg + '.tmp', 'w', encoding='utf-8', newline='').write(g)
os.replace(pg + '.tmp', pg)
print('smoke 断言场景已更新')
