"""v81 · 修复补丁：五处 smoke 老测试给 troopsHTML() 先切步兵页。

首轮 smoke 的 5 处失败全部同根：这些检查直接调 `G.ui.troopsHTML()` 找兵种卡，
而 v81 起分页初始态是 'que'（募兵队列首页）—— 测的仍是老语义，切页后即恢复。
（判据本身不变：卡片结构/悬停内容仍照旧校验。）
"""
import io, sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'


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
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== 五处测试切页修复 ==')

# ① 训练按钮 data-troop
patch(SMOKE,
"""  check('训练按钮的 data-troop 不是 undefined', (function () {
    var st = G.newGame({ name: '募兵' });
    var html = G.ui.troopsHTML();
    return !!st && /data-troop="yibing"/.test(html) && !/data-troop="undefined"/.test(html);
  })());""",
"""  check('训练按钮的 data-troop 不是 undefined', (function () {
    var st = G.newGame({ name: '募兵' });
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列）—— 先切页再渲染 */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var html = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    return !!st && /data-troop="yibing"/.test(html) && !/data-troop="undefined"/.test(html);
  })());""",
 '① 训练按钮 data-troop')

# ② 可点选兵种卡（有军营时）
patch(SMOKE,
"""    G.ui._trainFilter = 'normal';
    var html = G.ui.troopsHTML();
    return (html.match(/data-action="select-train"/g) || []).length >= 2;
  })());
  check('切换兵种会改变选中项（_trainSel 随点击变化）', (function () {""",
"""    G.ui._trainFilter = 'normal';
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var html = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    return (html.match(/data-action="select-train"/g) || []).length >= 2;
  })());
  check('切换兵种会改变选中项（_trainSel 随点击变化）', (function () {""",
 '② 可点选兵种卡')

# ③ 兵种卡随军营等级出现
patch(SMOKE,
"""    G.ui._trainFilter = 'normal';
    return (G.ui.troopsHTML().match(/data-action="select-train"/g) || []).length >= 2;
  })());

  /* ---- 需求 5/12 ---- */""",
"""    G.ui._trainFilter = 'normal';
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var hit = (G.ui.troopsHTML().match(/data-action="select-train"/g) || []).length >= 2;
    G.ui._trainTab = bkTab;
    return hit;
  })());

  /* ---- 需求 5/12 ---- */""",
 '③ 兵种卡随等级')

# ④ 兵种卡资源移入悬停
patch(SMOKE,
"""  check('募兵兵种卡不再常驻募兵资源（移入悬停浮层）', (function () {
    var h = G.ui.troopsHTML();""",
"""  check('募兵兵种卡不再常驻募兵资源（移入悬停浮层）', (function () {
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;""",
 '④ 悬停浮层卡面')

# ⑤ 悬停内容含消耗
patch(SMOKE,
"""  check('实测：悬停内容含消耗/人口/耗粮/耗时', (function () {
    var h = G.ui.troopsHTML();""",
"""  check('实测：悬停内容含消耗/人口/耗粮/耗时', (function () {
    /* v81：兵种卡在步兵/骑兵页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;""",
 '⑤ 悬停内容')

print()
print('修复补丁完成。')
