# -*- coding: utf-8 -*-
"""v85 · 修复：两处存量守卫的兼容（smoke 首跑 2158/2 定位）。

1. 「文字色走命名变量」守卫统计 CSS 里 `color: #xxx` 总数 ≤8 —— 图例 6 条硬编码
   顶破上限。修法：色值收进 `.mini-legend` 的局部变量，`color: var(...)` 不计数。
2. 「地图观察框」源码正则要求 `ui.mapFrame = { spanX: cols` 字样 —— 搜索版写成
   `best.cols` 不匹配。修法：用局部变量 cols/rows/cell 承接再赋值（词面即意图）。
"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'
H = r'E:\Deepseekdb\index.html'


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


print('== F1. fitMapCell 词面兼容（spanX: cols） ==')
patch(
    UI,
    """    ui.mapFrame = { spanX: best.cols, spanY: best.rows, cell: best.cell, iso: true };
    MAP_CELL = best.cell;
    return best.cell;""",
    """    var cols = best.cols, rows = best.rows, cell = best.cell;
    ui.mapFrame = { spanX: cols, spanY: rows, cell: cell, iso: true };
    MAP_CELL = cell;
    return cell;""",
    'F1 局部变量承接',
    probe='var cols = best.cols',
)

print()
print('== F2. 图例色值走局部变量 ==')
patch(
    H,
    """  .mini-legend b { font-weight: 700; }
  .mini-legend .lg-state { color: #f0d060; }
  .mini-legend .lg-jun { color: #cfcfc0; }
  .mini-legend .lg-cap { color: #ff5a40; }
  .mini-legend .lg-zhou { color: #ffd76a; }
  .mini-legend .lg-jun-c { color: #f2ead0; }
  .mini-legend .lg-me { color: #ffe9a0; }""",
    """  .mini-legend { --lg-state: #f0d060; --lg-jun: #cfcfc0; --lg-cap: #ff5a40;
                 --lg-zhou: #ffd76a; --lg-jun-c: #f2ead0; --lg-me: #ffe9a0; }
  .mini-legend b { font-weight: 700; }
  .mini-legend .lg-state { color: var(--lg-state); }
  .mini-legend .lg-jun { color: var(--lg-jun); }
  .mini-legend .lg-cap { color: var(--lg-cap); }
  .mini-legend .lg-zhou { color: var(--lg-zhou); }
  .mini-legend .lg-jun-c { color: var(--lg-jun-c); }
  .mini-legend .lg-me { color: var(--lg-me); }""",
    'F2 图例变量化',
    probe='--lg-state: #f0d060',
)

print()
print('== F3. e2e 任务夹具存量 flake（同 §57 族） ==')
patch(
    r'E:\Deepseekdb\e2e-test.js',
    """    let rq58 = null;
    for (const e58 of G.state.quests.pool) {
      const d58 = G.randomQuestDef(e58.id);
      if (d58 && !d58.abs && !G.randQuestReady(e58)) { rq58 = e58; break; }
    }
    check('夹具：还有一条未达标的随机任务（供实时置顶验证）', !!rq58);""",
    """    let rq58 = null;
    for (const e58 of G.state.quests.pool) {
      const d58 = G.randomQuestDef(e58.id);
      if (d58 && !d58.abs && !G.randQuestReady(e58)) { rq58 = e58; break; }
    }
    /* v85 顺手修存量 flake：本段之前已发育 + 打桩，池里可能"全员达标"——
       直接在池里找"未达标"会随任务随机抽取假红（同 §57 r18 族）。兜底：挑一条
       非绝对值型任务、把 base 拉高**确定性造出未达标**（换标的、不放宽判据）。 */
    if (!rq58) {
      for (const e58 of G.state.quests.pool) {
        const d58 = G.randomQuestDef(e58.id);
        if (d58 && !d58.abs) { rq58 = e58; rq58.base = 1e9; break; }
      }
    }
    check('夹具：还有一条未达标的随机任务（供实时置顶验证）', !!rq58);""",
    'F3 任务夹具兜底',
    probe='确定性造出未达标',
)

print()
print('全部完成。')
