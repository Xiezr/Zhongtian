# -*- coding: utf-8 -*-
"""v89.138 补丁 A：ui.js —— 地图拟合修复（需求 1：铺满 + 整体放大）"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'ui.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s.count(old))); sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

# ══════════ ① 常量：ZOOM 1.2 → 2.0（CELL_MAX 53 → 88） ══════════
rep(
"""  ui.MAP_ZOOM = 1.2;
  ui.MAP_CELL_MAX = Math.round(44 * ui.MAP_ZOOM);""",
"""  /* ============================================================
   * v89.138（老板 1）：「现在地图没有铺满界面，放大一点（不是视窗视野放大，
   *   而是**整体图像放大**）」——
   * 病根（探针实测 · probe_v89138_base.js）：v89.104 的 ZOOM 是**事后**缩放
   *   `cell = min(CELL_MAX, round(cell × ZOOM))`，而 CELL_MAX 本身已含 ZOOM
   *   （= round(44×1.2) = 53）→ 搜索出的 52 × 1.2 = 62 **被同一上限钳回 53**，
   *   只有 cols/rows 的 ÷ZOOM 生效 —— 结果是"视野窄了、格子没大、还留白"
   *   （1680×1000 实测：22×12@53 · 画布 1166×636 · 覆盖率仅 83%/81%）。
   * 修法：ZOOM 抬到 **2.0**（CELL_MAX = 88），并把 fitMapCell 的评分改成
   *   **"先铺满（覆盖率 ≥ 95%），铺满者取格距最大"**（见下）——
   *   铺满与放大同时满足，不再是二选一。
   * ============================================================ */
  ui.MAP_ZOOM = 2.0;
  ui.MAP_CELL_MAX = Math.round(44 * ui.MAP_ZOOM);""",
'常量 ZOOM')

# ══════════ ② fitMapCell：评分改"铺满优先 → 铺满者取格距最大" ══════════
rep(
"""    var best = null;
    /* v89.104：下限走"放大后的观察框"（= 原下限 ÷ MAP_ZOOM），于是同屏更少格、单格更大 */
    for (var cols = ui.MAP_MIN_COLS; cols <= ui.MAP_SPAN_MAX_X; cols++) {
      for (var rows = ui.MAP_MIN_ROWS; rows <= ui.MAP_SPAN_MAX_Y; rows++) {
        var raw = Math.min(availW / cols, availH / rows);
        if (raw < ui.MAP_CELL_MIN) continue;              /* 塞不下：该行列组合不可行 */
        var cell = Math.min(ui.MAP_CELL_MAX, Math.floor(raw));
        var cw = cols * cell, ch = rows * cell;
        var cov = Math.min(cw >= availW ? 1 : cw / availW, ch >= availH ? 1 : ch / availH);
        var better = !best || cov > best.cov + 0.012
          || (Math.abs(cov - best.cov) <= 0.012 && cell > best.cell);
        if (better) best = { cols: cols, rows: rows, cell: cell, cov: cov };
      }
    }""",
"""    var best = null;
    /* ============================================================
     * v89.138（老板 1）：评分从"覆盖率最高"改为 **"铺满优先 → 铺满者取格距最大"**。
     * ------------------------------------------------------------
     * 旧评分（cov 最大、并列取 cell 更大）在 CELL_MAX 是硬闸时会把格数顶到上限
     * ——覆盖率高但格子小，且 ZOOM 一乘就被钳死（见上）。
     * 新评分两段：
     *   ① 先滤掉"铺不满"的组合（min(宽/高覆盖率) < FILL_MIN = 0.95）；
     *   ② 在铺满的候选里取 **cell 最大**（并列取覆盖面更大者）。
     * 这样 1680×1000 会选 17×9@80（≈99%/98%）而不是 22×12@53（83%/81%）。
     * 兜底：若 window 极端（无任何组合 ≥95%）→ 退化为旧口径（覆盖率最高）。
     * ============================================================ */
    var FILL_MIN = 0.95;
    var fallback = null;
    for (var cols = ui.MAP_MIN_COLS; cols <= ui.MAP_SPAN_MAX_X; cols++) {
      for (var rows = ui.MAP_MIN_ROWS; rows <= ui.MAP_SPAN_MAX_Y; rows++) {
        var raw = Math.min(availW / cols, availH / rows);
        if (raw < ui.MAP_CELL_MIN) continue;              /* 塞不下：该行列组合不可行 */
        var cell = Math.min(ui.MAP_CELL_MAX, Math.floor(raw));
        var cw = cols * cell, ch = rows * cell;
        var cov = Math.min(cw >= availW ? 1 : cw / availW, ch >= availH ? 1 : ch / availH);
        /* 兜底榜（旧口径）：不论铺不铺满，留白最均衡者 */
        if (!fallback || cov > fallback.cov + 0.012
            || (Math.abs(cov - fallback.cov) <= 0.012 && cell > fallback.cell)) {
          fallback = { cols: cols, rows: rows, cell: cell, cov: cov };
        }
        if (cov < FILL_MIN) continue;                     /* ① 铺不满 → 不进主榜 */
        var better = !best || cell > best.cell
          || (cell === best.cell && cov > best.cov);
        if (better) best = { cols: cols, rows: rows, cell: cell, cov: cov };
      }
    }
    if (!best) best = fallback;""",
'fitMapCell 评分')

# ══════════ ③ ZOOM 事后缩放段：加"若破坏铺满则回退"护栏 ══════════
rep(
"""    if (ui.MAP_ZOOM && ui.MAP_ZOOM !== 1) {
      cell = Math.max(ui.MAP_CELL_MIN, Math.min(ui.MAP_CELL_MAX, Math.round(cell * ui.MAP_ZOOM)));
      cols = Math.max(ui.MAP_MIN_COLS, Math.round(cols / ui.MAP_ZOOM));
      rows = Math.max(ui.MAP_MIN_ROWS, Math.round(rows / ui.MAP_ZOOM));
    }""",
"""    /* v89.138：ZOOM 已并入上面的"格距上限"（CELL_MAX = 44 × ZOOM），
       这里**不再**对结果做第二次缩放（那正是"格子没大、还留白"的病根）——
       只保留一个幂等护栏：若历史调用方传进来 ZOOM ≠ 2.0 且缩放后仍铺得满，照做。 */
    if (ui.MAP_ZOOM && ui.MAP_ZOOM !== 2.0) {
      var zc = Math.max(ui.MAP_CELL_MIN, Math.min(ui.MAP_CELL_MAX, Math.round(cell * ui.MAP_ZOOM / 2.0)));
      var zcols = Math.max(ui.MAP_MIN_COLS, Math.round(cols * 2.0 / ui.MAP_ZOOM));
      var zrows = Math.max(ui.MAP_MIN_ROWS, Math.round(rows * 2.0 / ui.MAP_ZOOM));
      var zcov = Math.min(zcols * zc >= availW ? 1 : zcols * zc / availW,
        zrows * zc >= availH ? 1 : zrows * zc / availH);
      if (zcov >= 0.95) { cell = zc; cols = zcols; rows = zrows; }
    }""",
'ZOOM 护栏')

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp138'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'FILL_MIN = 0.95' in chk and 'ui.MAP_ZOOM = 2.0;' in chk, '未落盘'
assert chk.count('{') == chk.count('}'), '花括号不配平 %d/%d' % (chk.count('{'), chk.count('}'))
print('✅ ui.js 补丁A（地图）完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
