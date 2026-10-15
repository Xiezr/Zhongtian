# -*- coding: utf-8 -*-
"""v89.109 fix2：断言1 的县城量纲折算（粮食单项 → 合计）"""
import io, os
p = r'E:/Deepseekdb/smoke-test.js'
s = io.open(p, encoding='utf-8').read()

a = """    var f8 = tot({ kind: 'fort', lv: 8, dropType: 'fort', x: 1, y: 1 });
    var w8 = tot({ kind: 'wild', lv: 8, x: 1, y: 1 });
    var f10 = tot({ kind: 'fort', lv: 10, dropType: 'fort', x: 1, y: 1 });
    var countyRaid = Math.round(((DATA.NPC_CITY_RES || {}).resByTier || {}).county
      * (((DATA.EXPEDITION || {}).cityResMul || {}).raid || 0.5));"""
b = """    var f8 = tot({ kind: 'fort', lv: 8, dropType: 'fort', x: 1, y: 1 });
    var w8 = tot({ kind: 'wild', lv: 8, x: 1, y: 1 });
    var f10 = tot({ kind: 'fort', lv: 10, dropType: 'fort', x: 1, y: 1 });
    /* 县城**合计**库藏 = resByTier.county（那是"粮"上限）× (base 合计 / base 粮)；
       ⚠️ 不能只拿 resByTier.county 当合计 —— 它是粮食单项（探针实测县城合计 7.85 亿）。 */
    var NB = DATA.NPC_CITY_RES || {}, NBbase = NB.base || {};
    var bSum = 0; for (var bk in NBbase) bSum += NBbase[bk] || 0;
    var countyRaid = Math.round((NB.resByTier || {}).county
      * (bSum / (NBbase.grain || 1))
      * ((((DATA.EXPEDITION || {}).cityResMul) || {}).raid || 0.5));"""
assert a in s, '未命中'
s = s.replace(a, b, 1)
io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(p + '.tmp', p)
print('断言1 已修正折算')
