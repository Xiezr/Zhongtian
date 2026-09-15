# -*- coding: utf-8 -*-
"""v82 · 核心层：君主凡品开局（①）/ 官府征收整段退役（③）。

- ① data.js：DATA.LORD_GEN.rankId 'ming' → 'fan'（靠灵草逐档提升）
- ③ 征收退役：domain.js（GAME.levy/levyPlan/levyReady + DATA.LEVY_*）
     state.js（城市模板 lastLevy + 迁移块）
     main.js（do-levy 分发）
     注：城池面板的「征调民力」（DATA.CITY_OPTS.levy / GAME.doCityOpt）是另一套系统，不动。
"""
import io
import sys

BASE = r'E:\Deepseekdb'
DATA = BASE + r'\js\data.js'
ST = BASE + r'\js\state.js'
DOM = BASE + r'\js\domain.js'
MAIN = BASE + r'\js\main.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


def replace_span(path, start, end_marker, block, done_marker, tag):
    """把 [start, end_marker) 替换为 block（end_marker 保留）。"""
    t = io.open(path, encoding='utf-8', newline='').read()
    if done_marker in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    c = t.count(start)
    if c != 1:
        print('  ✗ %s：起点命中 %d 次' % (tag, c))
        sys.exit(1)
    i = t.find(start)
    j = t.find(end_marker, i + len(start))
    if j < 0:
        print('  ✗ %s：找不到段尾' % tag)
        sys.exit(1)
    t = t[:i] + block + t[j:]
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print('  ✓ %s（整段替换）' % tag)


print('== A. data.js ==')
# A1 · 君主开局凡品
patch(DATA,
"""  DATA.LORD_GEN = { rankId: 'ming', styleId: 'balance', level: 1 };""",
"""  /* v82（老板）：「君主初始资质为最差，需要逐步升级」——
     开局给**凡品**（最低档，等级上限 60）：靠种田秘境的资质灵草逐档提升
     （凡→良→英→名→天，走 GAME.rankUpUse 唯一出口；灵草升档另有隐藏加成）。 */
  DATA.LORD_GEN = { rankId: 'fan', styleId: 'balance', level: 1 };""",
'A1 君主凡品开局')

print()
print('== B. domain.js：征收整段退役 ==')
replace_span(
    DOM,
    """  /* ============================================================
   * 征收（v16 引入 · v24 需求 4/5 重构）""",
    """  /* ============================================================
   * 铁匠铺打造（装备获取的主要途径）""",
    """  /* v82（老板）：「官府不需要征收物质这个功能去除」——
     征收（GAME.levy / GAME.levyPlan / GAME.levyReady + DATA.LEVY_CD /
     LEVY_RES_RATE / LEVY_MAT_QTY / LEVY_HEARTS + city.lastLevy）整段退役。
     特产展示改读 GAME.specialtyOf / GAME.stateOfCity（岁贡与州治加成的口径不变）。 */
""",
    'v82：官府征收整段退役',
    'B1 征收退役',
)

print()
print('== C. state.js ==')
# C1 · 城市模板去 lastLevy
patch(ST,
"""      lastLevy: null,                           // v16：上次征收的游戏秒（null = 从未征收；冷却 1 游戏小时）
""",
"",
'C1 城市模板去 lastLevy')
# C2 · 迁移块去 lastLevy（附带修一处重复行）
patch(ST,
"""      if (st.repUnread == null) st.repUnread = 0;        // v41：旧档补字段
      if (st.repUnread == null) st.repUnread = 0;        // v41：旧档补字段
      /* v24（需求 4）：征收冷却从「全境一份」改为**按城一份**（city.lastLevy）。
         旧档的全局 lastLevy 归给首城，避免迁移后冷却被白清。 */
      (st.cities || []).forEach(function (c, i) {
        if (c.lastLevy === undefined) c.lastLevy = (i === 0 ? (st.lastLevy == null ? null : st.lastLevy) : null);
      });
      delete st.lastLevy;
""",
"""      if (st.repUnread == null) st.repUnread = 0;        // v41：旧档补字段（v82 顺手去重复行）
      /* v82：征收退役 —— v24 的 lastLevy 迁移块随功能一并撤除（旧档残留字段无害）。 */
""",
'C2 迁移块去 lastLevy')

print()
print('== D. main.js ==')
# D1 · do-levy 分发退役
patch(MAIN,
"""      /* v24（需求 4）：征收开在官府弹窗里 —— 结果只重绘弹窗，refreshView 只管中央视图 */
      case 'do-levy': {
        var rl = GAME.levy();
        ui.toast(rl.msg);
        if (rl.ok) { ui.openGuanfu(); GAME.refreshAll(); }
        break;
      }
""",
"""      /* v82：征收退役 —— do-levy 分发随功能撤除（官府面板不再产出该按钮）。 */
""",
'D1 do-levy 退役')

print()
print('核心层完成。')
