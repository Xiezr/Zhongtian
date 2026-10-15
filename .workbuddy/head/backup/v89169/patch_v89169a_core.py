# -*- coding: utf-8 -*-
"""v89.169 补丁 A：城墙 0 级虚影环（js/ui.js 四处）
① wallRingGeom 几何唯一出口（从 isoWallSVG 抽出，输出逐字节不变）
② isoWallGhostSVG 虚影环（新）
③ isoBoard 三态（'ghost' / 真值 / 假值）
④ cityHTML 传三态
"""
import io

R = 'E:/Deepseekdb/'
APPLIED = []


def rep(path, tag, old, new, guard=None):
    p = R + path
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %s（已落盘）' % tag)
        return
    assert s.count(old) == 1, '%s：锚点计数=%d' % (tag, s.count(old))
    s = s.replace(old, new)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('  [ ok ] %s' % tag)
    APPLIED.append(tag)


# ════════════════ A1. isoWallSVG 头部 → wallRingGeom 抽取 ════════════════
OLD1 = """  ui.isoWallSVG = function (cols, rows) {
    var M = ui.isoMetrics(cols, rows);
    var w = ui.WALL_PX, cw = M.w, ch = M.h;
    /* 描边以「带中心线」为准：外壁贴容器边，内壁距外壁 w */
    var hw = w / 2;
    var pts = [
      hw.toFixed(2) + ',' + hw.toFixed(2),
      (cw - hw).toFixed(2) + ',' + hw.toFixed(2),
      (cw - hw).toFixed(2) + ',' + (ch - hw).toFixed(2),
      hw.toFixed(2) + ',' + (ch - hw).toFixed(2),
    ].join(' ');"""
NEW1 = """  /* v89.169：墙环**几何唯一出口** —— 带参数（WALL_PX）与四角（带中心线）只在这里算。
     实墙（isoWallSVG）与未修建虚影（isoWallGhostSVG）共用同一份，
     保证「待建的墙」与「建成的墙」永远落在同一条带上（改 WALL_PX / 内距只动一处）。 */
  ui.wallRingGeom = function (cols, rows) {
    var M = ui.isoMetrics(cols, rows);
    var w = ui.WALL_PX, cw = M.w, ch = M.h;
    /* 描边以「带中心线」为准：外壁贴容器边，内壁距外壁 w */
    var hw = w / 2;
    var pts = [
      hw.toFixed(2) + ',' + hw.toFixed(2),
      (cw - hw).toFixed(2) + ',' + hw.toFixed(2),
      (cw - hw).toFixed(2) + ',' + (ch - hw).toFixed(2),
      hw.toFixed(2) + ',' + (ch - hw).toFixed(2),
    ].join(' ');
    return { w: w, cw: cw, ch: ch, hw: hw, pts: pts };
  };
  ui.isoWallSVG = function (cols, rows) {
    var _g169 = ui.wallRingGeom(cols, rows);
    var w = _g169.w, cw = _g169.cw, ch = _g169.ch, hw = _g169.hw, pts = _g169.pts;"""
rep('js/ui.js', 'A1 wallRingGeom 抽取（isoWallSVG 改读）', OLD1, NEW1,
    guard='ui.wallRingGeom = function (cols, rows) {')

# ════════════════ A2. isoWallGhostSVG（插在 isoWallSVG 之后） ════════════════
OLD2 = """      + tower(hw, hw) + tower(cw - hw, hw) + tower(cw - hw, ch - hw) + tower(hw, ch - hw)
      + '</svg>';
  };

  /* 城墙点击热区（v25 · 需求 1）：四条独立的带，只覆盖墙环，不侵入棋盘。"""
NEW2 = """      + tower(hw, hw) + tower(cw - hw, hw) + tower(cw - hw, ch - hw) + tower(hw, ch - hw)
      + '</svg>';
  };

  /* ============================================================
   * v89.169（老板）：「城墙 0 级的时候不明显，整得明显一点」
   * ------------------------------------------------------------
   * 病根：0 级（从未修建 / 破城掉回 0）时 `wall.build = null` → isoWallSVG 整段不画，
   *   城内视角**一无所有**；而城墙的唯一入口就是这圈（空格菜单还把城墙剔除了），
   *   于是"想修墙的人在棋盘上找不到墙"。
   * 现在：未修建 = 一圈**虚线虚影**（墙基土垄 + 虚线墙线 + 四角虚影角楼位），
   *   几何与实墙同源（wallRingGeom）；热区照旧（点虚影 = 打开「修建城墙」）。
   * 口径：实墙（完整形制）↔ 虚影（待修建）—— 虚影**不表示等级**，等级只看面板；
   *   配色走 CSS 的 `--gold-rgb`（暗底发亮 / 浅底加深，四套主题自适应）。
   * ============================================================ */
  ui.isoWallGhostSVG = function (cols, rows) {
    var _g169 = ui.wallRingGeom(cols, rows);
    var cw = _g169.cw, ch = _g169.ch, hw = _g169.hw, pts = _g169.pts;
    var t = 26;                                   /* 角楼墩台尺寸与实墙一致（虚影 = 待建位） */
    var corner = function (x, y) {
      return '<rect class="wghost-corner" x="' + (x - t / 2) + '" y="' + (y - t / 2) + '" width="' + t + '" height="' + t
        + '" rx="3.5" fill="none" stroke="rgba(201,162,75,.55)" stroke-width="1.6" stroke-dasharray="5 4"/>';
    };
    return '<svg class="iso-wall iso-wall-ghost" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">'
      + '<polygon class="wghost-base" points="' + pts + '" fill="none" stroke="rgba(201,162,75,.12)" stroke-width="' + _g169.w + '"/>'
      + '<polygon class="wghost-line" points="' + pts + '" fill="none" stroke="rgba(201,162,75,.74)" stroke-width="2.4" stroke-dasharray="10 7"/>'
      + corner(hw, hw) + corner(cw - hw, hw) + corner(cw - hw, ch - hw) + corner(hw, ch - hw)
      + '</svg>';
  };

  /* 城墙点击热区（v25 · 需求 1）：四条独立的带，只覆盖墙环，不侵入棋盘。"""
rep('js/ui.js', 'A2 isoWallGhostSVG 新增', OLD2, NEW2,
    guard='ui.isoWallGhostSVG = function (cols, rows) {')

# ════════════════ A3. isoBoard 三态 ════════════════
OLD3 = """      + (opt.wall ? ui.isoWallSVG(cols, rows) : '')"""
NEW3 = """      /* v89.169：wall 三态 —— 'ghost' = 未修建虚影环；其余真值 = 已修建实墙；假值 = 不画。
         （城墙 0 级的可见入口：以前 0 级整圈不画，棋盘上找不到墙。） */
      + (opt.wall === 'ghost' ? ui.isoWallGhostSVG(cols, rows)
        : (opt.wall ? ui.isoWallSVG(cols, rows) : ''))"""
rep('js/ui.js', 'A3 isoBoard 三态分支', OLD3, NEW3,
    guard="opt.wall === 'ghost' ? ui.isoWallGhostSVG(cols, rows)")

# ════════════════ A4. cityHTML 传三态 ════════════════
OLD4 = """    var board = ui.isoBoard(COLS, ROWS, cells, { wall: !!(c.wall && c.wall.build), wallHit: true, wallAction: 'open-wall' });"""
NEW4 = """    var board = ui.isoBoard(COLS, ROWS, cells, {
      wall: (c.wall && c.wall.build) ? 'full' : 'ghost',   /* v89.169：0 级 = 虚线虚影（可见入口） */
      wallHit: true, wallAction: 'open-wall' });"""
rep('js/ui.js', 'A4 cityHTML 传三态', OLD4, NEW4,
    guard="wall: (c.wall && c.wall.build) ? 'full' : 'ghost',")

print('\n补丁 A 完成：%d 处落盘' % len(APPLIED))
