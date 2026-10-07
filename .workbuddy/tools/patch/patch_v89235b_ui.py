# -*- coding: utf-8 -*-
"""patch_v89235b_ui.py —— 需求 1（政务厅角标）+ 需求 2 界面同尺

B1 政务厅格：等级角标并入名称行（与普通格子同构）
B2 城外面板：升级可用性加 buildPrereqOf 闸（与内核同尺）+ 卡闸时给准确原因

用法：python patch_v89235b_ui.py [--apply]
"""
import io, sys
R = 'E:/Deepseekdb/'
APPLY = '--apply' in sys.argv
P = 'js/ui.js'
s = io.open(R + P, encoding='utf-8', newline='').read()
LOG, FAIL = [], []


def rep(tag, old, new, mark, cnt=1):
    global s
    if s.count(mark) >= 1:
        LOG.append('[skip] ' + tag)
        return
    c = s.count(old)
    if c != cnt:
        FAIL.append('!! %s count=%d want=%d' % (tag, c, cnt))
        return
    s = s.replace(old, new, cnt)
    LOG.append('[ok] ' + tag)


# ---- B1 政务厅角标并入名称行 ----
rep('B1 政务厅角标',
    """      (lvl ? '<span class="tile-badge' + (isMax ? ' max' : '') + '">' + lvl + '</span>' : '') +
      '<span class="tile-label"><span class="nm">' + (b ? b.name : '政务厅') + '</span></span>' +""",
    """      /* v89.235（老板「政务厅等级位置不对」）：等级角标并入名称行（与普通格子同构）——
         v89.229 把「名称+等级」合成同一行时，政务厅这块漏改：badge 独立成 span，
         而 .tile-badge 已改 position:static → 角标掉出格顶名称行、位置不对。 */
      '<span class="tile-label"><span class="nm">' + (b ? b.name : '政务厅') + '</span>' +
        (lvl ? '<span class="tile-badge' + (isMax ? ' max' : '') + '">' + lvl + '</span>' : '') +
      '</span>' +""",
    "v89.235（老板「政务厅等级位置不对」）")

# ---- B2a 城外面板：闸 + 准确原因 ----
rep('B2a 城外闸',
    """      var upCost = e.lv < GAME.buildCapOf(c) ? GAME.buildCostDiscountOf(GAME.extBuildCost(e.type, e.lv)) : null;
      var costStr = upCost ? GAME.costString(upCost) : '已满级';""",
    """      /* v89.235（老板）：「城外资源建筑等级也不能超过政务厅等级」—— 与内核同尺：
         buildPrereqOf 官府闸 + buildCapOf 传 bid（本座）；被闸卡住时报准确原因
         （"已达最高等级"会误导 —— 与城内 v68 口径对齐）。 */
      var upPre = GAME.buildPrereqOf(c, e.type, e.lv + 1, e);
      var upCost = (e.lv < GAME.buildCapOf(c, e.type, e) && upPre.ok)
        ? GAME.buildCostDiscountOf(GAME.extBuildCost(e.type, e.lv)) : null;
      var costStr = upCost ? GAME.costString(upCost) : (upPre.ok ? '已满级' : upPre.short);""",
    "var upPre = GAME.buildPrereqOf(c, e.type, e.lv + 1, e);")

# ---- B2b 渲染段：卡闸文案 ----
rep('B2b 渲染文案',
    "              : '<span class=\"op-done\">已达最高等级</span>') +",
    "              : '<span class=\"op-done\">' + (upPre.ok ? '已达最高等级' : U.escape(ui.prereqText(c, upPre))) + '</span>') +",
    "upPre.ok ? '已达最高等级' : U.escape(ui.prereqText(c, upPre))")

if FAIL:
    print('== FAIL ==')
    for x in FAIL:
        print(' ', x)
    sys.exit(1)
if APPLY:
    io.open(R + P, 'w', encoding='utf-8', newline='').write(s)
    print('== APPLIED ==')
else:
    print('== DRY-RUN ==')
for x in LOG:
    print(' ', x)
