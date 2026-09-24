# -*- coding: utf-8 -*-
"""v89.109：更新两条 loot 断言（假想档位 → 真实关系）"""
import io, os
p = r'E:/Deepseekdb/smoke-test.js'
s = io.open(p, encoding='utf-8').read()

a1 = """  check('资源收益按档位递增', withFixedRandom([0.5], function () {
    function loot(tier, lv) { return G.battle.genLoot({ type: tier, level: lv, x: 1, y: 1 }, 1).grain; }
    return loot('capital', 10) > loot('zhou', 9) && loot('zhou', 9) > loot('jun', 7) && loot('jun', 7) > loot('fort', 3);
  }));"""
b1 = """  /* v89.109（老板「10 级野外城池资源量那么少，必有错误」）：
     旧判据比的是"假想档位"（genLoot 里 jun/zhou/capital 的 mult 从未被真实调用 ——
     名城的掠夺走 npcLoot 库藏），既拦不住真 bug、又把据点压得抬不起头。
     改为两条**真实关系**：① 同等级 据点 > 野地；② 据点 Lv10 仍低于县城实际掠夺的 1/5。 */
  check('v89.109：收益次序（同级 据点>野地 · 据点Lv10 < 县城实掠）', withFixedRandom([0.5], function () {
    function tot(c) {
      var o = G.battle.genLoot(c, 1), s = 0;
      ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { s += o[k] || 0; });
      return s;
    }
    var f8 = tot({ kind: 'fort', lv: 8, dropType: 'fort', x: 1, y: 1 });
    var w8 = tot({ kind: 'wild', lv: 8, x: 1, y: 1 });
    var f10 = tot({ kind: 'fort', lv: 10, dropType: 'fort', x: 1, y: 1 });
    /* 县城**合计**库藏 = resByTier.county（那是"粮"上限）× (base 合计 / base 粮)；
       ⚠️ 不能只拿 resByTier.county 当合计 —— 它是粮食单项（探针实测县城合计 7.85 亿）。 */
    var NB = DATA.NPC_CITY_RES || {}, NBbase = NB.base || {};
    var bSum = 0; for (var bk in NBbase) bSum += NBbase[bk] || 0;
    var countyRaid = Math.round((NB.resByTier || {}).county
      * (bSum / (NBbase.grain || 1))
      * ((((DATA.EXPEDITION || {}).cityResMul) || {}).raid || 0.5));
    return f8 > w8 && f10 > f8 * 3 && f10 < countyRaid / 5;
  }));"""
assert a1 in s, '断言1 未命中'
s = s.replace(a1, b1, 1)

a2 = """    check('v89.88（据点）：战利品满配曲线（Lv1→Lv10 ≈15× · 档位次序不破）', (function () {
      var bak = Math.random; Math.random = function () { return 0.5; };
      try {
        function grain(tier, lv) { return G.battle.genLoot({ type: tier, level: lv, x: 1, y: 1 }, 1).grain; }
        var r1 = grain('fort', 1), r10 = grain('fort', 10);
        var curve = r10 / r1 > 12 && r10 / r1 < 18;
        var order = grain('jun', 7) > grain('fort', 3) && grain('capital', 10) > r10;
        return curve && order;
      } finally { Math.random = bak; }
    })());"""
b2 = """    check('v89.109（据点）：战利品满配曲线（Lv1→Lv10 ≈1080× · 次序不破）', (function () {
      var bak = Math.random; Math.random = function () { return 0.5; };
      try {
        function grainFort(lv) { return G.battle.genLoot({ kind: 'fort', lv: lv, dropType: 'fort', x: 1, y: 1 }, 1).grain; }
        function grainWild(lv) { return G.battle.genLoot({ kind: 'wild', lv: lv, x: 1, y: 1 }, 1).grain; }
        var r1 = grainFort(1), r10 = grainFort(10);
        var curve = r10 / r1 > 800 && r10 / r1 < 1400;      /* 2.15^9 ≈ 1080 */
        var order = grainFort(8) > grainWild(8)             /* 同级：据点 > 野地 */
          && grainWild(10) > grainWild(1) * 10              /* 野地也吃等级（v89.109 修） */
          && r10 < Math.round((((DATA.NPC_CITY_RES || {}).resByTier) || {}).county
              * ((((DATA.EXPEDITION || {}).cityResMul) || {}).raid || 0.5) / 5);
        return curve && order;
      } finally { Math.random = bak; }
    })());"""
assert a2 in s, '断言2 未命中'
s = s.replace(a2, b2, 1)

io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(p + '.tmp', p)
print('两条 loot 断言已更新')
