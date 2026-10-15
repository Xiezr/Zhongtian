# -*- coding: utf-8 -*-
"""v89.109 收尾2：坚壁清野对兵损同样生效 + 断言改到破防场景"""
import io, os
# ① state.js：兵损吃坚壁清野折扣
p = r'E:/Deepseekdb/js/state.js'
s = io.open(p, encoding='utf-8').read()
a1 = """    if (result) {
      var lossBy = result.defLossBy || {};
      for (var tk in lossBy) {
        var nl = Math.min(lossBy[tk] || 0, city.army[tk] || 0);
        if (nl > 0) { city.army[tk] -= nl; out.troopsLost += nl; }
      }
    } else {"""
b1 = """    /* v86 坚壁清野：**一切损失** −40% —— v89.109 起兵损改走引擎明细（不再经 severity），
       折扣必须在这里同样折进去，否则"坚壁清野"会突然只保资源、不保人。 */
    var jbMul = _jb ? (1 - _jb.eff.invLossCut) : 1;
    if (result) {
      var lossBy = result.defLossBy || {};
      for (var tk in lossBy) {
        var nl = Math.floor(Math.min(lossBy[tk] || 0, city.army[tk] || 0) * jbMul);
        if (nl > 0) { city.army[tk] -= nl; out.troopsLost += nl; }
      }
    } else {"""
assert a1 in s, '①未命中'
s = s.replace(a1, b1, 1)
io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(p + '.tmp', p)
print('state.js：兵损折扣已折入')

# ② smoke：断言改到"破防场景"（守军清空）
pg = r'E:/Deepseekdb/smoke-test.js'
g = io.open(pg, encoding='utf-8').read()
a2 = """  check('实测：坚壁清野使来袭损失 ×0.6（守备冻结 · 同城对照）', (function () {
    var s = GAME.state, c = s.cities[0];
    GAME.schemeDefConsume(c, 'jianbi');
    /* 冻结影响 severity 输入的守备（army / cells 城墙）与资源；两次结算前各恢复一次。
       （不用"双城同 id"对照：schemeDefOf 按 city.id 取键，同 id 会串门。） */
    var armySnap = JSON.stringify(c.army || {});
    var cellsSnap = JSON.stringify(c.cells || []);
    var wallSnap = c.wallLv;
    var refill = function () {
      c.army = JSON.parse(armySnap);
      c.cells = JSON.parse(cellsSnap);
      c.wallLv = wallSnap;
      c.res = c.res || {};
      ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 100000; });
    };"""
b2 = """  check('实测：坚壁清野使来袭损失 ×0.6（**破防场景** · 同城对照）', (function () {
    var s = GAME.state, c = s.cities[0];
    GAME.schemeDefConsume(c, 'jianbi');
    /* 冻结影响结算的城防（cells 城墙）与资源；两次结算前各恢复一次。
       （不用"双城同 id"对照：schemeDefOf 按 city.id 取键，同 id 会串门。）
       ⚠️ v89.109：资源损失只在**破防**时发生（守军全歼或工事拆光，见 lootGateOf）——
       本用例**清空守军**：敌必得手、defRemain=0 过闸，两次结算只差坚壁清野，
       测到的才是"损失比例"，而不是"没被掠"（改前实测：守军若守赢则 g1=0，误报红）。 */
    var cellsSnap = JSON.stringify(c.cells || []);
    var wallSnap = c.wallLv;
    var refill = function () {
      c.cells = JSON.parse(cellsSnap);
      c.wallLv = wallSnap;
      c.res = c.res || {};
      ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 100000; });
      c.army = {};                        /* 无守军 → 敌必得手且过"破防"闸 */
    };"""
assert a2 in g, '②未命中'
g = g.replace(a2, b2, 1)
io.open(pg + '.tmp', 'w', encoding='utf-8', newline='').write(g)
os.replace(pg + '.tmp', pg)
print('smoke 断言已更新')
