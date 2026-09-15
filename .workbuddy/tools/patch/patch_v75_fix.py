# -*- coding: utf-8 -*-
"""v75 修 · 客栈候选行紧凑几何（行高 52 → 36）

根因：共用「卡片基线」规则（.q-card, …, .inn-card, … { padding: var(--sp-4) }）
      写在文件更后处，同权重后者胜 → 我给的 4px 内衬被覆盖成 10px，
      行高被撑到 52px（14 位候选溢出 151px）。

修法：
  F1  .inn-card 主规则交出内衬/外边距（几何交给下面的紧凑覆盖）
  F2  在共用基线之后补一条 .inn-card 紧凑覆盖（3px 内衬 + 3px 底距）
  F3/F4  .inn-avatar 两处 30 → 28px（内容高 28 → 行高 = 3+3+28+2 = 36）
  F5  ui.js faceOf 调用 30 → 28
  F6  smoke §61 ⑤ 断言同步（30 → 28 + 紧凑覆盖校验）
  F7/F8 注释数字同步（行高实测 36px；14/16 位一页装下）
"""
import io, sys

UI = r'E:\Deepseekdb\js\ui.js'
HTML = r'E:\Deepseekdb\index.html'
SMOKE = r'E:\Deepseekdb\smoke-test.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t or new.replace('\n', '\r\n') in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    cands = []
    if old in t:
        cands.append((old, new))
    else:
        old_c, new_c = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
        if old_c in t:
            cands.append((old_c, new_c))
    if not cands:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    old2, new2 = cands[0]
    c = t.count(old2)
    if c != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, c))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


# F1 · .inn-card 主规则：交出内衬/外边距
patch(
    HTML,
    """  .inn-card { display: flex; align-items: center; gap: 10px; padding: 4px 10px; margin-bottom: 4px;
    background: rgba(var(--sh-rgb),.2); border: 1px solid var(--gold-dark); border-radius: 7px; }""",
    """  .inn-card { display: flex; align-items: center; gap: 10px;
    background: rgba(var(--sh-rgb),.2); border: 1px solid var(--gold-dark); border-radius: 7px; }""",
    'F1 inn-card 主规则瘦身',
)

# F2 · 共用基线之后：紧凑覆盖
patch(
    HTML,
    """  /* 描边统一为发丝级；金色描边只保留给「可交互的兵种卡」等有语义处 */
  .q-card, .item-row, .bag-cell, .eq-cell, .inn-card, .story-card, .xc-row {
    border-color: var(--line);
  }""",
    """  /* 描边统一为发丝级；金色描边只保留给「可交互的兵种卡」等有语义处 */
  .q-card, .item-row, .bag-cell, .eq-cell, .inn-card, .story-card, .xc-row {
    border-color: var(--line);
  }
  /* v75（老板）：「尽量所有候选都能在同一页」——客栈候选行**紧凑几何**：
     共用基线给的 10px 内衬对"一页装下"太厚，这里就地收窄
     （同权重、写在基线之后者胜）；配 28px 头像 → 行高实测 36px。 */
  .inn-card { padding: 3px 10px; margin-bottom: 3px; }""",
    'F2 紧凑几何覆盖',
)

# F3 · .inn-avatar 第一处 30 → 28
patch(
    HTML,
    """  .inn-avatar { font-size: 20px; width: 30px; text-align: center; }""",
    """  .inn-avatar { font-size: 20px; width: 28px; text-align: center; }""",
    'F3 头像列 28px（第一处）',
)

# F4 · .inn-avatar 第二处 30 → 28
patch(
    HTML,
    """  .inn-avatar { width: 30px; display: flex; align-items: center; justify-content: center; }""",
    """  .inn-avatar { width: 28px; display: flex; align-items: center; justify-content: center; }""",
    'F4 头像列 28px（第二处）',
)

# F5 · ui.js faceOf 调用 30 → 28
patch(
    UI,
    """          { name: c.name, rank: c.rank, beauty: c.beauty, portraitSeed: c.portraitSeed }, 30) + '</span>' +""",
    """          { name: c.name, rank: c.rank, beauty: c.beauty, portraitSeed: c.portraitSeed }, 28) + '</span>' +""",
    'F5 faceOf 28',
)

# F6 · smoke §61 ⑤ 断言同步
patch(
    SMOKE,
    """  check('⑤ 头像列 30px（两处规则一致）',
    /width: 30px/.test(cssBlock(hS1, '.inn-avatar {'))
      && /width: 30px/.test(cssBlock(hS1, '.inn-avatar { width: 30px;')));""",
    """  check('⑤ 紧凑几何：内衬 3px 覆盖共用基线 + 头像列 28px（两处一致）', (function () {
    var compact = cssBlock(hS1, '.inn-card { padding:');
    return /padding: 3px 10px/.test(compact) && /margin-bottom: 3px/.test(compact)
      && /width: 28px/.test(cssBlock(hS1, '.inn-avatar {'))
      && /width: 28px/.test(cssBlock(hS1, '.inn-avatar { width: 28px;'));
  })());""",
    'F6 smoke 断言同步',
)

# F7 · modal-xxl 注释数字
patch(
    HTML,
    """  /* xxl（v75 客栈招募）：980×800 —— 老板「大一点，尽量所有候选同一页」。
     单行候选（行高 ~40px）× 14 位 + 三段式标题/按钮，真机实测一页装下；兜底同其余档位。 */""",
    """  /* xxl（v75 客栈招募）：980×800 —— 老板「大一点，尽量所有候选同一页」。
     单行候选（行高实测 36px）：14 位（客栈 Lv12 + 专精 2）与 16 位（县城上限）真机一页装下；
     兜底规则同其余档位。 */""",
    'F7 modal-xxl 注释',
)

# F8 · ui.js openInn 注释数字
patch(
    UI,
    """       ② 尺寸用新档 xxl（980×800）：14 位候选（客栈 Lv12 + 满级专精 2）真机一页装下；""",
    """       ② 尺寸用新档 xxl（980×800）：候选行紧凑单行（36px），14 位（客栈 Lv12 + 专精 2）
          与 16 位（县城上限）真机一页装下；""",
    'F8 openInn 注释',
)

print('\n修复补丁落盘完成。')
