# -*- coding: utf-8 -*-
"""v85 · CSS：底部缩略地图（条尾 40px）+ 天下大势面板（方形缩略图 + 图例）。"""
import io
import sys

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


CSS = """  /* ============ v85（老板）：底部缩略地图 + 天下大势面板 ============ */
  /* 为条尾缩略图提供定位上下文（单独成条，不动原 .bottombar 块的 46px 高度） */
  .bottombar { position: relative; padding-right: 56px; }
  .bb-mini {
    position: absolute; right: 10px; top: 3px; width: 40px; height: 40px; padding: 0;
    background: #10160c; border: 1px solid var(--gold-dark); border-radius: 6px;
    cursor: pointer; overflow: hidden; line-height: 0;
    box-shadow: 0 2px 6px rgba(var(--sh-rgb), .45);
  }
  .bb-mini:hover { border-color: var(--gold-light); }
  .bb-mini canvas { width: 38px; height: 38px; display: block; }
  /* 天下大势：方形缩略图（内部 1000×1000 高清背衬，显示 ≤500px） */
  .mini-wrap { display: flex; justify-content: center; margin: 8px 0 4px; }
  .mini-wrap canvas {
    width: min(500px, 68vw); height: auto; aspect-ratio: 1 / 1;
    border: 2px solid var(--gold-dark); border-radius: 6px; background: #10160c;
  }
  .mini-legend {
    text-align: center; font-size: var(--fs-sub); color: var(--text-dim);
    margin: 6px 0 2px; letter-spacing: .04em;
  }
  .mini-legend b { font-weight: 700; }
  .mini-legend .lg-state { color: #f0d060; }
  .mini-legend .lg-jun { color: #cfcfc0; }
  .mini-legend .lg-cap { color: #ff5a40; }
  .mini-legend .lg-zhou { color: #ffd76a; }
  .mini-legend .lg-jun-c { color: #f2ead0; }
  .mini-legend .lg-me { color: #ffe9a0; }

  /* v27（需求 6）：数字输入框的原生上下箭头也去掉 —— 它同样是个"小下拉"，"""

print('== S1. index.html CSS ==')
patch(
    H,
    '  /* v27（需求 6）：数字输入框的原生上下箭头也去掉 —— 它同样是个"小下拉"，',
    CSS,
    'S1 缩略图 CSS',
    probe='.bb-mini',
)

print()
print('全部完成。')
