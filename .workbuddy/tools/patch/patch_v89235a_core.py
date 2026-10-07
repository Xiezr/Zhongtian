# -*- coding: utf-8 -*-
"""patch_v89235a_core.py —— 需求 2 内核：城外资源建筑等级 ≤ 政务厅等级

三处（domain.js）：
  A1 buildCapCoreOf 官府闸：DATA.BUILDINGS → 两表并查（含 EXT_BUILDINGS）
  A2 buildPrereqOf  官府闸：同上（界面提示与内核拦截同尺）
  A3 upgradeExt：加 buildPrereqOf 检查 + buildCapOf 传 bid（本座）

用法：python patch_v89235a_core.py          # dry-run
      python patch_v89235a_core.py --apply
"""
import io, sys
R = 'E:/Deepseekdb/'
APPLY = '--apply' in sys.argv
P = 'js/domain.js'
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


# ---- A1a 注释换代 ----
rep('A1a 注释',
    '''   /* v68 · 逐步探索：城内建筑（含围墙）等级**不得超过政务厅等级**。
       - 政务厅自身、城外建筑、以及"没有政务厅的城"（异常数据/测试构造）不受此闸；''',
    '''   /* v68 · 逐步探索：建筑（含围墙）等级**不得超过政务厅等级**。
       - 政务厅自身、以及"没有政务厅的城"（异常数据/测试构造）不受此闸；
       ⛔ v89.235（老板）：「城外资源建筑等级也不能超过政务厅等级」——
         原「城外建筑不受此闸」口径退役（改前域侧天然可超：upgradeExt 未传 bid、
         本函数只认 DATA.BUILDINGS）。城外资源建筑与城内同吃此闸。''',
    '原「城外建筑不受此闸」口径退役')

# ---- A1b 判定行 ----
rep('A1b 判定',
    "    if (bid && DATA.BUILDINGS[bid] && bid !== 'guanfu') {\n      var govLv = GAME.buildingLevel(city, 'guanfu');\n      if (govLv > 0) cap = Math.min(cap, govLv);\n    }",
    "    if (bid && (DATA.BUILDINGS[bid] || DATA.EXT_BUILDINGS[bid]) && bid !== 'guanfu') {   /* v89.235：城外资源建筑一并纳入 */\n      var govLv = GAME.buildingLevel(city, 'guanfu');\n      if (govLv > 0) cap = Math.min(cap, govLv);\n    }",
    '/* v89.235：城外资源建筑一并纳入 */')

# ---- A2 buildPrereqOf 官府闸 ----
rep('A2 前置闸',
    "    var b = DATA.BUILDINGS[bid];\n    if (b && bid !== 'guanfu') {",
    "    var b = DATA.BUILDINGS[bid] || DATA.EXT_BUILDINGS[bid];   /* v89.235：城外同吃此闸（界面提示与内核拦截同尺） */\n    if (b && bid !== 'guanfu') {",
    '/* v89.235：城外同吃此闸')

# ---- A3 upgradeExt ----
rep('A3 upgradeExt',
    "    var eb = DATA.EXT_BUILDINGS[e.type];\n    if (e.lv >= GAME.buildCapOf(city)) return { ok: false, msg: '已达最高等级' };",
    '''    var eb = DATA.EXT_BUILDINGS[e.type];
    /* v89.235（老板）：「城外资源建筑等级也不能超过政务厅等级」——与城内同尺：
       ① buildPrereqOf 官府闸（拒绝时给出「需政务厅 LvN」的明确原因）；
       ② buildCapOf 传 bid（本座）——官府闸落进上限值。 */
    var pre = GAME.buildPrereqOf(city, e.type, e.lv + 1, e);
    if (!pre.ok) return pre;
    if (e.lv >= GAME.buildCapOf(city, e.type, e)) return { ok: false, msg: '已达最高等级' };''',
    '① buildPrereqOf 官府闸（拒绝时给出')

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
