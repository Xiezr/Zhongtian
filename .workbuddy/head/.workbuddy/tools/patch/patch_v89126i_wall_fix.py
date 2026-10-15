# -*- coding: utf-8 -*-
"""v89.126 补丁 I：
① 删 ui.openWallModal（G2 的 cut 被同脚本 patch 覆盖，这里独立重删）
② smoke.minUpgradableLv：城墙段删（占格后由 cells 扫描包含）
③ citydef（城防技术）折扣接线：新增 GAME.cityDefCostOf + buildAt/upgradeAt 调用
"""
import io, os, subprocess

R = r'E:/Deepseekdb'

def write_check(P):
    r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
    assert r.returncode == 0, '[%s] node --check 失败：%s' % (P, r.stderr[:400])

def cut(s, start, end, what, tomb=''):
    assert s.count(start) == 1, '[%s] start 计数 %d' % (what, s.count(start))
    i = s.find(start)
    j = s.find(end, i)
    assert j > i, '[%s] 找不到 end' % what
    return s[:i] + tomb + s[j + len(end):]

# ═══════ ① ui.js：删 openWallModal（独立写盘） ═══════
P = os.path.join(R, 'js/ui.js')
s = io.open(P, encoding='utf-8').read()
s = cut(s,
        "  /* ============================================================\n   * 城墙（v16：不占格，环绕城池一圈）\n",
        "      '<div class=\"bldg-foot\"><span></span><button class=\"btn\" data-action=\"close-modal\">关闭</button><span></span></div>');\n  };\n\n",
        'openWallModal',
        "  /* v89.126：原「城墙」独立面板（openWallModal）退役 ——\n"
        "     城墙占格后走**通用建筑面板**（ui.openBuildModal，含建造/升级/取消/提速）；\n"
        "     环城热区 `open-wall` 由 main.js 转发到该面板。 */\n\n")
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
write_check(P)
chk = io.open(P, encoding='utf-8').read()
assert 'ui.openWallModal = function' not in chk and 'data-action="rush-wall"' not in chk and 'data-action="wall-build"' not in chk
print('✓ ui.js：openWallModal 段已删（含 rush-wall / wall-build 按钮）')

# ═══════ ② smoke：minUpgradableLv 城墙段 ═══════
P = os.path.join(R, 'smoke-test.js')
s = io.open(P, encoding='utf-8').read()
old2 = """    /* v64（老板）：「城墙纳入自动建筑中」——城墙不占格（`city.wallLv`），
       但它是自动升级的候选之一，所以"当前最低等级"必须把它算进来 */
    S21.cities.forEach(function (ct) {
      var wcap = G.buildCapOf(ct, 'chengqiang');
      if ((ct.wallLv || 0) < wcap) m = Math.min(m, ct.wallLv || 0);"""
assert s.count(old2) == 1, 'minUpgradableLv 锚点 %d' % s.count(old2)
# 该段之后紧跟 })(); 之类收尾，这里把整段替换为空（城墙占格后由 cells 扫描天然包含）
old2_full = None
# 找该段结束：从锚点起，找下一个 "    });" 收尾
i = s.find(old2)
j = s.find("\n    });", i)
assert j > i, 'minUpgradableLv 收尾未找到'
old2_full = s[i:j + len("\n    });")]
new2 = """    /* v89.126：城墙占格后**由上面的 cells 扫描天然包含**（`chengqiang` 是普通建筑）——
       原"单独把 city.wallLv 算进最低等级"整段退役。 */"""
s = s.replace(old2_full, new2)
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
write_check(P)
print('✓ smoke：minUpgradableLv 城墙段退役')

# ═══════ ③ domain：citydef 折扣接线 ═══════
P = os.path.join(R, 'js/domain.js')
s = io.open(P, encoding='utf-8').read()
# 新增出口（插在 wallCellIdxOf 之后）
old3 = ("    return idx;\n"
        "  };\n")
assert s.count(old3) == 1, 'wallCellIdxOf 收尾锚点 %d' % s.count(old3)
new3 = ("    return idx;\n"
        "  };\n"
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
# buildAt 调用
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
# upgradeAt 调用
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
write_check(P)
print('✓ domain：cityDefCostOf 接线（buildAt + upgradeAt）')

print('补丁 I 完成。')
