# -*- coding: utf-8 -*-
"""v89.126 补丁 I2：citydef 折扣接线（仅 ③）"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'js/domain.js')
s = io.open(P, encoding='utf-8').read()

old3 = ("    (city.cells || []).forEach(function (x, i) {\n"
        "      if (idx < 0 && x.build && x.build.id === 'chengqiang') idx = i;\n"
        "    });\n"
        "    return idx;\n"
        "  };\n")
assert s.count(old3) == 1, 'wallCellIdxOf 收尾锚点 %d' % s.count(old3)
new3 = (old3 +
        "  /* v89.126：**城防技术**（citydef，−5%/级，封顶 −60%）对**城墙造价**的折扣 ——\n"
        "     城墙并入通用路径后，折扣在这里挂一次（buildAt / upgradeAt 读它）；\n"
        "     顺带修掉一处历史不一致：旧实现里「修建」打折、「升级」不打折，现在两头都打。 */\n"
        "  GAME.cityDefCostOf = function (bid, cost) {\n"
        "    if (bid !== 'chengqiang' || !cost) return cost;\n"
        "    var disc = Math.min(0.6, techB('citydef'));\n"
        "    if (!(disc > 0)) return cost;\n"
        "    var out = {};\n"
        "    for (var k in cost) out[k] = (k === 'time') ? cost[k] : Math.round((cost[k] || 0) * (1 - disc));\n"
        "    return out;\n"
        "  };\n")
s = s.replace(old3, new3)

old4 = ("    var cost = b.buildCost;\n"
        "    if (GAME.systems && GAME.systems.buffActive && GAME.systems.buffActive('buildCost')) {\n"
        "      cost = GAME.applyBuildCostDiscount(cost);\n"
        "    }\n"
        "    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足，无法建造' };")
new4 = ("    var cost = b.buildCost;\n"
        "    if (GAME.systems && GAME.systems.buffActive && GAME.systems.buffActive('buildCost')) {\n"
        "      cost = GAME.applyBuildCostDiscount(cost);\n"
        "    }\n"
        "    cost = GAME.cityDefCostOf(buildId, cost);   /* v89.126：城墙吃城防技术折扣 */\n"
        "    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足，无法建造' };")
assert s.count(old4) == 1, 'buildAt cost 锚点 %d' % s.count(old4)
s = s.replace(old4, new4)

old5 = ("    var cost = b.levelCost(cell.build.lvl);\n"
        "    if (!cost) return { ok: false, msg: '未知费用' };\n"
        "    if (GAME.systems.buffActive('buildCost')) cost = GAME.applyBuildCostDiscount(cost);\n"
        "    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足' };")
new5 = ("    var cost = b.levelCost(cell.build.lvl);\n"
        "    if (!cost) return { ok: false, msg: '未知费用' };\n"
        "    if (GAME.systems.buffActive('buildCost')) cost = GAME.applyBuildCostDiscount(cost);\n"
        "    cost = GAME.cityDefCostOf(cell.build.id, cost);   /* v89.126：城墙吃城防技术折扣 */\n"
        "    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足' };")
assert s.count(old5) == 1, 'upgradeAt cost 锚点 %d' % s.count(old5)
s = s.replace(old5, new5)

tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:400]
print('✓ domain：cityDefCostOf 接线完成（buildAt + upgradeAt）')
