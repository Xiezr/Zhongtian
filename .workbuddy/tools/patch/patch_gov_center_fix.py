# -*- coding: utf-8 -*-
"""v68 官府居中 · 修正：剩余 4 处断言适配。

1. 系统城布局段：「同一公式」断言改为与 G.govCellsOf 对拍（更能证明"同一出口"）
2. 系统城布局段：「军营紧贴官府左邻」的官府左列从写死 `8-2` 改为按落位实算
3. 布局统一段：「靠右居中」断言改为「棋盘正中」
4. 第 55 节自纠：「不许写死旧格号」断言放行了迁移段的 oldPos（老档识别必须用它），
   只禁 makeCity / cityPlanOf 的落位定义处。
"""
import io
import os
import sys

SMOKE = os.path.join(r'E:\Deepseekdb', 'smoke-test.js')

F1_OLD = """  check('实测：官府落位与玩家城**同一公式**（8×6 → col 6-7 × row 2-3）', (function () {
    var plan = G.cityPlanOf(8);
    var gf = plan.cells.map(function (c, i) { return (c.build && c.build.id === 'guanfu') ? i : -1; })
      .filter(function (i) { return i >= 0; });
    return gf.join(',') === [6 + 8 * 2, 7 + 8 * 2, 6 + 8 * 3, 7 + 8 * 3].join(',');
  })());"""
F1_NEW = """  check('实测：官府落位与玩家城**同一出口**（8×6 → 棋盘正中 [19,20,27,28]）', (function () {
    var plan = G.cityPlanOf(8);
    var gf = plan.cells.map(function (c, i) { return (c.build && c.build.id === 'guanfu') ? i : -1; })
      .filter(function (i) { return i >= 0; });
    return gf.join(',') === G.govCellsOf(plan.col, plan.row).join(',');
  })());"""

F2_OLD = """  check('实测：军营紧贴官府左邻一列（成对、挨着官府）', (function () {
    var plan = G.cityPlanOf(8);
    var gCol = 8 - 2;   /* 官府左列 */
    var bars = plan.cells.map(function (c, i) { return (c.build && c.build.id === 'junying') ? i : -1; })
      .filter(function (i) { return i >= 0; });
    return bars.length === 2 && bars.every(function (i) { return (i % plan.col) === gCol - 1; });
  })());"""
F2_NEW = """  check('实测：军营紧贴官府左邻一列（成对、挨着官府）', (function () {
    var plan = G.cityPlanOf(8);
    /* v68：官府居中后左列不能再写死 —— 按落位出口实算 */
    var gfCols = G.govCellsOf(plan.col, plan.row).map(function (i) { return i % plan.col; });
    var gCol = Math.min.apply(null, gfCols);   /* 官府最左列 */
    var bars = plan.cells.map(function (c, i) { return (c.build && c.build.id === 'junying') ? i : -1; })
      .filter(function (i) { return i >= 0; });
    return bars.length === 2 && bars.every(function (i) { return (i % plan.col) === gCol - 1; });
  })());"""

F3_OLD = """  check('实测：官府仍在"靠右居中"（与 makeCity 同一套落位公式）', (function () {
    var bad = [];
    for (var lv = 1; lv <= 10; lv++) {
      var p = G.cityPlanOf(lv), gf = [];
      p.cells.forEach(function (c, i) { if (c.official) gf.push(i); });
      var gc = p.col - 2, gr = Math.floor((p.row - 2) / 2);
      var want = [gr * p.col + gc, gr * p.col + gc + 1, (gr + 1) * p.col + gc, (gr + 1) * p.col + gc + 1];
      if (gf.join(',') !== want.join(',')) bad.push(lv);
    }
    return bad.length === 0;
  })(), '官府 4 格恒为「右侧第 2 列起、垂直居中」');"""
F3_NEW = """  check('实测：官府在"棋盘正中"（与 makeCity 同一出口 GAME.govCellsOf）', (function () {
    var bad = [];
    for (var lv = 1; lv <= 10; lv++) {
      var p = G.cityPlanOf(lv), gf = [];
      p.cells.forEach(function (c, i) { if (c.official) gf.push(i); });
      if (gf.join(',') !== G.govCellsOf(p.col, p.row).join(',')) bad.push(lv);
    }
    return bad.length === 0;
  })(), '官府 4 格恒为「第三行 4-5 与第四行 4-5」（正中央）');"""

F4_OLD = """    check('全项目不再写死官府旧格号 [6+8*2, 7+8*2, ...]（防回退）',
      (function () {
        var all = '';
        ['state', 'domain', 'ui'].forEach(function (f) { all += stripComment(fs55(f)); });
        return !/6 \\+ 8 \\* 2, 7 \\+ 8 \\* 2/.test(all);
      })());"""
F4_NEW = """    check('落位定义处不许写死旧格号（迁移识别旧档的 oldPos 除外）',
      (function () {
        var st55s = stripComment(fs55('state'));
        var mk = codeOf(st55s, 'GAME.makeCity = function');
        var cp = codeOf(st55s, 'GAME.cityPlanOf = function');
        return mk.length > 100 && cp.length > 100
          && !/6 \\+ 8 \\* 2/.test(mk) && !/6 \\+ 8 \\* 2/.test(cp)
          /* 迁移必须仍认得旧格号 —— 老档靠它识别（这行是"合法保留"的锚） */
          && /var oldPos = \\[6 \\+ 8 \\* 2/.test(st55s);
      })());"""

PLAN = [
    (F1_OLD, F1_NEW, '同一出口断言'),
    (F2_OLD, F2_NEW, '军营左邻断言'),
    (F3_OLD, F3_NEW, '正中断言'),
    (F4_OLD, F4_NEW, '第 55 节自纠'),
]


def main():
    t = io.open(SMOKE, 'rb').read().decode('utf-8')
    if '同一出口' in t and '官府在"棋盘正中"' in t and 'oldPos 除外' in t:
        print('· 已修，跳过（幂等）')
        return 0
    crlf0 = t.count('\r\n')
    done = []
    for old, new, tag in PLAN:
        c = t.count(old)
        if c != 1:
            print('✗ [%s] 锚点命中 %d 次' % (tag, c))
            return 1
        t = t.replace(old, new, 1)
        done.append(tag)
    out = t.encode('utf-8')
    if out.count(b'\r\n') != crlf0:
        print('✗ 行尾被改写')
        return 1
    io.open(SMOKE, 'wb').write(out)
    print('本次改动: %d 处 —— %s' % (len(done), ' / '.join(done)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
