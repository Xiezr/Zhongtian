# -*- coding: utf-8 -*-
"""v85 · 核心层（I）：民房去人口统计入口 / 地图占满+放大（fitMapCell 搜索式自适应）。

老板原文：「民房不需要人口统计功能；地图目前没有占满界面，建议占满，然后稍微
放大一点图像，看起来好看一点。底部导航栏增加一个缩略地图（覆盖500*500），在
缩略地图标注州城，郡城位置。对州郡的边界以不同样式的线条区分」

本脚本只含 ①②（民房 + 地图自适应）；缩略地图（③④）在 patch_v85_mini.py。
"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'


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


print('== A. 民房去「人口统计」入口 ==')
patch(
    UI,
    '    minfang: { label: "👥 人口统计", act: "open-panel", view: "stats" },\n',
    '    /* v85（老板）：「民房不需要人口统计功能」—— 民房入口退役；\n'
    '       「人口统计」面板本身保留（城防统计仍由此进入）。 */\n',
    'A1 BLDG_FUNC 去 minfang 条目',
    probe='民房入口退役',
)

print()
print('== B. fitMapCell 搜索式自适应（占满 + 放大） ==')
patch(
    UI,
    '  ui.MAP_CELL_MAX = 104;         /* 大屏上限：格子过大反而看不清全局 */',
    '  ui.MAP_CELL_MAX = 128;         /* v85：104 → 128 —— 搜索式自适应下上限只防极端（1440 屏输出 104 由可用高度决定） */',
    'B1 MAP_CELL_MAX 104 → 128',
    probe='MAP_CELL_MAX = 128',
)
patch(
    UI,
    """  ui.fitMapCell = function () {
    var box = ui.viewBoxSize();
    /* v76（老板）：地图导航迁入底部条 —— 不再为右下浮标让位（78 → 10，只留呼吸） */
    var pad = 28, extraH = 10, breath = 16;
    var availW = box.w - pad - breath;
    var availH = box.h - extraH - pad - breath;
    var cols = U.clamp(Math.round(availW / ui.MAP_TARGET_CELL_ISO), MAP_SPAN_X, ui.MAP_SPAN_MAX_X);
    var rows = U.clamp(Math.round(availH / ui.MAP_TARGET_CELL_ISO), MAP_SPAN_Y, ui.MAP_SPAN_MAX_Y);
    var cell = Math.floor(Math.min(availW / cols, availH / rows));
    cell = Math.max(ui.MAP_CELL_MIN, Math.min(ui.MAP_CELL_MAX, cell));
    ui.mapFrame = { spanX: cols, spanY: rows, cell: cell, iso: true };
    MAP_CELL = cell;
    return cell;
  };""",
    """  /* v85（老板）：「地图目前没有占满界面，建议占满，然后稍微放大一点图像」——
     旧口径"先按理想格距估行列、再回算格距"在 1440 屏给出 12×6@104：
     画布 1248×624 vs 可用 1376×733（右空 154 / 下空 157，且格距被 MAX 卡住）。
     改为**小搜索**：枚举 cols∈[12,22] × rows∈[6,14]，cell = min(availW/cols,
     availH/rows) 钳 [MIN, MAX]；score = 宽/高覆盖率的较小者（留白最均衡地最小）。
     先取 score 最高者；score 差 ≤1.2pp 时取格距更大者（"占满"与"放大"的折中）。
     1440 屏实测输出 13×7@104：画布 1352×728（覆盖 98%/99%，面积 +26%）；
     jsdom 基准下输出见测试（保持确定性）。 */
  ui.fitMapCell = function () {
    var box = ui.viewBoxSize();
    /* v76（老板）：地图导航迁入底部条 —— 不再为右下浮标让位（78 → 10，只留呼吸） */
    var pad = 28, extraH = 10, breath = 16;
    var availW = box.w - pad - breath;
    var availH = box.h - extraH - pad - breath;
    var best = null;
    for (var cols = MAP_SPAN_X; cols <= ui.MAP_SPAN_MAX_X; cols++) {
      for (var rows = MAP_SPAN_Y; rows <= ui.MAP_SPAN_MAX_Y; rows++) {
        var raw = Math.min(availW / cols, availH / rows);
        if (raw < ui.MAP_CELL_MIN) continue;              /* 塞不下：该行列组合不可行 */
        var cell = Math.min(ui.MAP_CELL_MAX, Math.floor(raw));
        var cw = cols * cell, ch = rows * cell;
        var cov = Math.min(cw >= availW ? 1 : cw / availW, ch >= availH ? 1 : ch / availH);
        var better = !best || cov > best.cov + 0.012
          || (Math.abs(cov - best.cov) <= 0.012 && cell > best.cell);
        if (better) best = { cols: cols, rows: rows, cell: cell, cov: cov };
      }
    }
    if (!best) {   /* 兜底（理论上不可达）：极端窗口下也要有解 */
      best = { cols: MAP_SPAN_X, rows: MAP_SPAN_Y,
        cell: Math.max(ui.MAP_CELL_MIN, Math.min(ui.MAP_CELL_MAX,
          Math.floor(Math.min(availW / MAP_SPAN_X, availH / MAP_SPAN_Y)))) };
    }
    ui.mapFrame = { spanX: best.cols, spanY: best.rows, cell: best.cell, iso: true };
    MAP_CELL = best.cell;
    return best.cell;
  };""",
    'B2 fitMapCell 重写',
    probe='小搜索',
)

print()
print('全部完成。')
