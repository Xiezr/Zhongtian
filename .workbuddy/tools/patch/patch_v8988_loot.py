# -*- coding: utf-8 -*-
"""v89.88（老板需求 3「资源满配」）：battle.js 两处 ——
① genLoot：据点等级因子 线性 (1+lv×0.12) → 满配曲线 1.35^(lv-1)；
② resReportOf：侦查「掠夺可得」口径对齐实际结算（cityResMul.raid = 0.5）。
"""
import io

B = r'E:\Deepseekdb\js\battle.js'
s = io.open(B, encoding='utf-8', newline='').read()

old1 = """    /* 野外城池按等级浮动 */
    if (tier === 'fort') mult *= (1 + (c.lv || c.level || 1) * 0.12);"""
new1 = """    /* v89.88（老板需求 3「资源满配」）：野外城池的等级因子由线性 (1+lv×0.12)
       改为**满配曲线** `1.35^(lv-1)` —— Lv1 ≈ 原值（1.0），Lv8 ≈ 11 倍、
       Lv10 ≈ 15 倍（旧口径 Lv8 只有 2 倍，高级据点"拿不出城的样子"）。
       ⚠️ 上限口径：Lv10 的 7.45 仍低于都城档 mult=8 —— 档位次序不破
       （smoke 有断言钉住 capital > zhou > jun > **fort 任意级**）。 */
    if (tier === 'fort') mult *= Math.pow(1.35, (c.lv || c.level || 1) - 1);"""
assert s.count(old1) == 1, ('loot', s.count(old1))
s = s.replace(old1, new1, 1)

old2 = """    if (t.kind === 'fort' && GAME.battle.genLoot) {
      var mul = (DATA.EXPEDITION && DATA.EXPEDITION.wildResMul && DATA.EXPEDITION.wildResMul.raid) || 1.2;"""
new2 = """    if (t.kind === 'fort' && GAME.battle.genLoot) {
      /* v89.88：口径对齐**实际结算** —— 据点掠夺在 `expedition` 里走
         `cityResMul.raid`（0.5），原先这里读 `wildResMul.raid`（1.2），
         "侦查看到的掠夺可得"比打完拿到的虚报 **2.4 倍**
         （侦查的数 ≠ 打完的数，正是本项目最忌讳的一类不一致）。
         ⚠️ 战时的抢掠技巧 / 计略加成因人而异，这里给的是**基准量**。 */
      var mul = (DATA.EXPEDITION && DATA.EXPEDITION.cityResMul && DATA.EXPEDITION.cityResMul.raid) || 0.5;"""
assert s.count(old2) == 1, ('report', s.count(old2))
s = s.replace(old2, new2, 1)

io.open(B, 'w', encoding='utf-8', newline='').write(s)
print('OK battle.js')
