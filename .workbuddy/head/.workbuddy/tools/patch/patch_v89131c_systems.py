# -*- coding: utf-8 -*-
"""v89.131 补丁 C：systems.js —— useItem 新增 'energy' 分支（对照 stamina 分支）
用法：python patch_v89131c_systems.py
"""
import io

P = 'E:/Deepseekdb/js/systems.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s

anchor = """    } else if (item.type === 'perm') {"""
new = """    } else if (item.type === 'energy') {
      /* v89.131（老板「体力精力应当设计加号按钮，供道具使用」）：
         精力族（清心丸/提神散/养神丹/凝神玉露）——与体力分支同构：
         按**上限百分比**回复、满了拒绝（不烧道具）。
         上限走唯一出口 GAME.energyMaxOf（六维公式，domain.js）。 */
      var g8 = S._findGen(targetGenId);
      if (!g8) return { ok: false, msg: '请选择将领' };
      var enMx8 = GAME.energyMaxOf(g8);
      var enNow8 = GAME.energyNowOf(g8);
      if (enNow8 >= enMx8) {
        return { ok: false, msg: g8.name + ' 精力已满（无需服药）' };
      }
      var healed8 = Math.min(enMx8, enNow8 + (item.amount || 0.1) * enMx8) - enNow8;
      GAME.setEnergyNow(g8, enNow8 + healed8);
      ok = true; msg = g8.name + ' 精力 +' + Math.round(healed8);
    } else if (item.type === 'perm') {"""
assert s.count(anchor) == 1, '锚点 %d' % s.count(anchor)
s = s.replace(anchor, new)
assert (s.count('{') - s.count('}')) == (orig.count('{') - orig.count('}')), '花括号盈亏'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch C(systems) OK（energy 分支）')
