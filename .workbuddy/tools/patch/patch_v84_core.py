# -*- coding: utf-8 -*-
"""v84 · 核心层：兵种卡去「拥有」行 / 辎重车→骑兵、斥候→步兵。

老板原文：「募兵界面兵种底下不要"拥有：0"这个提示，辎重车是骑兵吧，斥候是步兵」

- 卡面：`.troop-card` 的「拥有：N」行整行退役（`own` 读数一并退役）；
  未解锁原因不再挂卡面 —— 悬停浮层（.tcard-tip）照旧给出，信息不丢。
- 分类：DATA.TROOPS[].cat 只决定**募兵分页归属**（inf → 步兵页 / cav → 骑兵页）：
  斥候 cav → inf、辎重车 inf → cav。消费方只有 ui.troopsHTML 分页过滤一处。

幂等：显式 probe（改过后必定成立/不成立的独特判据）——
避开两类子串纠缠：① 删除型 new 是 old 子串（B2）；② 注释新增型 old 是 new
子串（A3 的整行会被新文本以"注释+原行"包住）——备忘 §25.2 的两次教训。
"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'
DATA = r'E:\Deepseekdb\js\data.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
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


print('== A. data.js（分类对调 + 口径注释） ==')
patch(
    DATA,
    "    chihou:  { id: 'chihou', cat: 'cav',",
    "    chihou:  { id: 'chihou', cat: 'inf',",
    'A1 斥候 cav → inf',
    probe="    chihou:  { id: 'chihou', cat: 'inf',",
)
patch(
    DATA,
    "    zhouche: { id: 'zhouche', cat: 'inf',",
    "    zhouche: { id: 'zhouche', cat: 'cav',",
    'A2 辎重车 inf → cav',
    probe="    zhouche: { id: 'zhouche', cat: 'cav',",
)
patch(
    DATA,
    '  DATA.TROOPS = {',
    """  /* v84（老板）：「辎重车是骑兵吧，斥候是步兵」——
     cat 只决定**募兵分页归属**（inf → 步兵页 / cav → 骑兵页），与战场定位无关：
     斥候（侦察）归步兵页，辎重车（后勤货运）归骑兵页。 */
  DATA.TROOPS = {""",
    'A3 DATA.TROOPS 口径注释',
    probe='cat 只决定',
)

print()
print('== B. ui.js（卡面去「拥有」行） ==')
patch(
    UI,
    """        '<div class="tstat">血' + t.hp + ' 攻' + t.atk + ' 防' + t.def + ' 射' + t.range + ' 速' + t.spd + '</div>' +
        '<div class="tstat">拥有：' + own + (unlocked ? '' : ' · <span style="color:var(--red-light)">' + chk.msg + '</span>') + '</div>' +
""",
    """        '<div class="tstat">血' + t.hp + ' 攻' + t.atk + ' 防' + t.def + ' 射' + t.range + ' 速' + t.spd + '</div>' +
        /* v84（老板）：「兵种底下不要『拥有：0』这个提示」—— 拥有行整行退役；
           own 读数一并退役；未解锁原因不再挂卡面（悬停浮层照旧给出，信息不丢）。 */
""",
    'B1 卡面删「拥有」行',
    probe='拥有行整行退役',
)
patch(
    UI,
    """      var unlocked = chk.ok;
      var own = c.army[id] || 0;
""",
    """      var unlocked = chk.ok;
""",
    'B2 读数 own 退役',
    probe='var own = c.army[id] || 0;',
    probe_must_exist=False,
)

print()
print('== 验证 ==')
t1 = io.open(UI, encoding='utf-8', newline='').read()
t2 = io.open(DATA, encoding='utf-8', newline='').read()
checks = [
    ('A1 新值', "    chihou:  { id: 'chihou', cat: 'inf'," in t2),
    ('A2 新值', "    zhouche: { id: 'zhouche', cat: 'cav'," in t2),
    ('A3 注释', 'cat 只决定' in t2),
    ('B1 注释', '拥有行整行退役' in t1),
    ('B2 删除', 'var own = c.army[id] || 0;' not in t1),
]
bad = [n for n, ok in checks if not ok]
if bad:
    print('  ✗ 未就位：' + ', '.join(bad))
    sys.exit(1)
print('  ✓ 五处全部就位')
