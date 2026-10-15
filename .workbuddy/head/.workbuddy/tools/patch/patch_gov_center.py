# -*- coding: utf-8 -*-
"""v68 · 官府居中（老板 2026-09-14）：
   ① 官府 2×2 从「右侧中部」移到「棋盘正中」（8×6 → 第三行 4-5 与第四行 4-5）
   ② 落位抽成唯一出口 GAME.govCellsOf（makeCity / cityPlanOf / 迁移 三处共用）
   ③ 新增"右侧 → 居中"的旧档迁移（中央占用者与旧位对调，队列索引重映射）
   ④ 同步注释与 5 处既有测试断言；新增第 55 节专门验证
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
ST = os.path.join(ROOT, 'js', 'state.js')
UI = os.path.join(ROOT, 'js', 'ui.js')
DA = os.path.join(ROOT, 'js', 'data.js')
SMOKE = os.path.join(ROOT, 'smoke-test.js')

MARK = 'GAME.govCellsOf = function'

# ---------------------------------------------------------------- state.js
S1_OLD = "  GAME.makeCity = function (opts) {"
S1_NEW = """  /* 官府 2×2 的落位（唯一出口 · v68 老板）：
     城内棋盘**正中央** —— 8×6 时占「第三行 4、5 与第四行 4、5」。
     makeCity / cityPlanOf（系统城）/ 旧档迁移三处都走它，别处不许再写死格号。 */
  GAME.govCellsOf = function (col, row) {
    var gc = Math.floor((col - 2) / 2), gr = Math.floor((row - 2) / 2);
    return [gr * col + gc, gr * col + gc + 1, (gr + 1) * col + gc, (gr + 1) * col + gc + 1];
  };

  GAME.makeCity = function (opts) {"""

S2_OLD = """    /* 官府占 4 格：v16 移到城池**右侧**（col 4-5 × row 2-3），不再占正中央。
       城墙另存 city.wallLv（不占格，见 GAME.buildingLevel 特判）。 */
    var gfIdx = [6 + 8 * 2, 7 + 8 * 2, 6 + 8 * 3, 7 + 8 * 3];   /* col 6-7 × row 2-3（右侧中部） */
"""
S2_NEW = """    /* 官府占 4 格：v68（老板）移回**正中央** —— 8×6 时占「第三行 4、5 与第四行 4、5」。
       落位公式的唯一出口是 GAME.govCellsOf（makeCity / cityPlanOf / 旧档迁移共用）。
       城墙另存 city.wallLv（不占格，见 GAME.buildingLevel 特判）。 */
    var gfIdx = GAME.govCellsOf(city.col, city.row);
"""

S3_OLD = """    /* ① 官府 2×2：右侧第 2 列起、垂直居中 —— 与 makeCity 的落位规则同一套 */
    var gc = col - 2, gr = Math.max(0, Math.floor((row - 2) / 2));
    var gf = [gr * col + gc, gr * col + gc + 1, (gr + 1) * col + gc, (gr + 1) * col + gc + 1];
"""
S3_NEW = """    /* ① 官府 2×2：**棋盘正中**（v68 老板）—— 走与 makeCity 同一出口 */
    var gf = GAME.govCellsOf(col, row);
    var gc = Math.floor((col - 2) / 2), gr = Math.floor((row - 2) / 2);
"""

S4_OLD = "          [6 + 8 * 2, 7 + 8 * 2, 6 + 8 * 3, 7 + 8 * 3].forEach(function (gi) {"
S4_NEW = "          GAME.govCellsOf(8, 6).forEach(function (gi) {"

S5_OLD = """      });
      /* 存档迁移：旧默认倍率 30× → 120×（真实数值下 30× 读秒过慢） */"""
S5_NEW = """      });
      /* ---- v68 迁移：官府从"右侧中部"移到"棋盘正中"（老板 2026-09-14）----
         对调式：中央 4 格上的占用者与旧官府位**一一对调** —— 玩家建筑不丢。
         队列里引用这些格号的项（在建 gridIndex / 军营 bIdx）一起重映射，
         漏了就是"在建项指向错格"（v40 迁移踩过的同一个坑）。 */
      (st.cities || []).forEach(function (c) {
        if (!c.cells || c.cells.length !== 48) return;
        var oldPos = [6 + 8 * 2, 7 + 8 * 2, 6 + 8 * 3, 7 + 8 * 3];
        var newPos = GAME.govCellsOf(c.col || 8, c.row || 6);
        var has = [];
        c.cells.forEach(function (x, i) { if (x.official) has.push(i); });
        var atOld = has.length === 4 && has.every(function (i) { return oldPos.indexOf(i) >= 0; });
        if (!atOld) return;
        var gLv = 1;
        has.forEach(function (i) {
          if (c.cells[i].build && c.cells[i].build.id === 'guanfu') gLv = c.cells[i].build.lvl;
        });
        var remap = {};
        oldPos.forEach(function (oi, n) {
          var ni = newPos[n];
          remap[ni] = oi;                       /* 中央格 → 旧官府位 */
          var dis = c.cells[ni];                /* 中央格上的占用者（空/建筑/在建皆可） */
          c.cells[oi].official = false;
          c.cells[oi].build = dis.build || null;
          c.cells[oi].pending = dis.pending || null;
        });
        newPos.forEach(function (ni) {
          c.cells[ni].official = true;
          c.cells[ni].build = { id: 'guanfu', lvl: gLv };
          c.cells[ni].pending = null;
        });
        ((st.queues && st.queues.build) || []).forEach(function (q) {
          if (q.cityId !== c.id || q.gridIndex == null) return;
          if (remap[q.gridIndex] != null) q.gridIndex = remap[q.gridIndex];
        });
        ((st.queues && st.queues.train) || []).forEach(function (q) {
          if (q.cityId !== c.id || q.bIdx == null) return;
          if (remap[q.bIdx] != null) q.bIdx = remap[q.bIdx];
        });
      });
      /* 存档迁移：旧默认倍率 30× → 120×（真实数值下 30× 读秒过慢） */"""

S6_OLD = "  /* ---------------- 新建玩家城（城内 8×6=48 格，官府占右侧4格，余44格可建）---------------"
S6_NEW = "  /* ---------------- 新建玩家城（城内 8×6=48 格，官府居中4格，余44格可建）---------------"

S7_OLD = "   *   · 官府 2×2，落位公式与 `GAME.makeCity` **完全一致**（右侧第 2 列起、垂直居中）；"
S7_NEW = "   *   · 官府 2×2 **居中**，落位走与 `GAME.makeCity` 相同的唯一出口 `GAME.govCellsOf`；"

S8_OLD = """       基准取城池中心而不是官府中心 —— 用官府中心排会把功能建筑全挤到右侧半边，
       左边留一大片民房，"一边倒"不像一座城。 */"""
S8_NEW = """       基准取城池中心（不取官府中心）—— "中心"跨棋盘尺寸是稳定参照；
       v68 官府居中后两者结果接近，仍以城池中心为准。 */"""

# ---------------------------------------------------------------- data.js
D1_OLD = "   *   ① 官府：右侧第 2 列起 2×2（**与玩家城 `makeCity` 的落位规则完全一致**，"
D1_NEW = "   *   ① 官府：**棋盘正中** 2×2（v68 起与玩家城 `makeCity` 走同一出口 `GAME.govCellsOf`，"

# ---------------------------------------------------------------- ui.js
U1_OLD = "   * 官府**固定占 4 格**（2×2，位于棋盘右侧中部，见 state.makeCity 的 gfIdx），"
U1_NEW = "   * 官府**固定占 4 格**（2×2，位于棋盘正中 —— 第三行 4-5 与第四行 4-5，见 GAME.govCellsOf），"

# ---------------------------------------------------------------- smoke 适配
T1_OLD = "  /* v40（需求 2）：老板要「8*6，6 行 8 列」→ 48 格，官府仍占右侧 4 格、余 44 可建 */\n  check('城内 48 格（8 列 × 6 行 · 官府占右侧4格）',"
T1_NEW = "  /* v40（需求 2）：老板要「8*6，6 行 8 列」→ 48 格；v68 起官府居中 4 格、余 44 可建 */\n  check('城内 48 格（8 列 × 6 行 · 官府居中4格）',"

T2_OLD = """  check('官府 4 格位于城池右侧（col 6-7 × row 2-3）', (function () {
    var c = G.makeCity({ id: 'govpos', name: 'G' });
    var idx = [];
    c.cells.forEach(function (x, i) { if (x.official) idx.push(i); });
    return idx.length === 4 && idx.every(function (i) { return [22, 23, 30, 31].indexOf(i) >= 0; });"""
T2_NEW = """  check('官府 4 格位于城池正中（col 3-4 × row 2-3，v68 老板）', (function () {
    var c = G.makeCity({ id: 'govpos', name: 'G' });
    var idx = [];
    c.cells.forEach(function (x, i) { if (x.official) idx.push(i); });
    return idx.length === 4 && idx.every(function (i) { return [19, 20, 27, 28].indexOf(i) >= 0; });"""

T3_OLD = """  check('#2 官府 4 格位于城池右侧', (function () {
    var c = G.makeCity({ id: 'w2', name: 'W' });
    var idx = []; c.cells.forEach(function (x, i) { if (x.official) idx.push(i); });
    return idx.join(',') === '22,23,30,31';   /* v40：8 列坐标系下的右侧中部 */
  })());"""
T3_NEW = """  check('#2 官府 4 格位于城池正中', (function () {
    var c = G.makeCity({ id: 'w2', name: 'W' });
    var idx = []; c.cells.forEach(function (x, i) { if (x.official) idx.push(i); });
    return idx.join(',') === '19,20,27,28';   /* v68：8 列坐标系下的正中央 */
  })());"""

T4_OLD = """  check('官府 4 格落位随坐标系同步（col 6-7 × row 2-3）',
    /var gfIdx = \\[6 \\+ 8 \\* 2, 7 \\+ 8 \\* 2, 6 \\+ 8 \\* 3, 7 \\+ 8 \\* 3\\]/.test(ST));"""
T4_NEW = """  check('官府 4 格落位走唯一出口 GAME.govCellsOf（居中，v68 老板）',
    /var gfIdx = GAME\\.govCellsOf\\(city\\.col, city\\.row\\)/.test(ST)
    && /GAME\\.govCellsOf = function/.test(ST));"""

T5_OLD = """  check('实测：新开局 48 格 · 官府占右侧 4 格',
    (function () {
      var c = G.makeCity({ id: 'v40chk', name: 'V' });
      var g = [];
      c.cells.forEach(function (x, i) { if (x.official) g.push(i); });
      return c.cells.length === 48 && c.col === 8 && c.row === 6
        && g.join(',') === '22,23,30,31';
    })());"""
T5_NEW = """  check('实测：新开局 48 格 · 官府居中 4 格',
    (function () {
      var c = G.makeCity({ id: 'v40chk', name: 'V' });
      var g = [];
      c.cells.forEach(function (x, i) { if (x.official) g.push(i); });
      return c.cells.length === 48 && c.col === 8 && c.row === 6
        && g.join(',') === '19,20,27,28';
    })());"""

S54_TAIL_OLD = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""

N55 = """  /* ============================================================
   * 55. v68：官府居中 + 旧档迁移（老板 2026-09-14）
   * ------------------------------------------------------------
   * 「官府在城内的地块居中放置，占第三行 4，5 和第四行 4，5 空格」
   *   · 8×6：col 3-4 × row 2-3（0-based）→ 格号 [19,20,27,28]
   *   · 落位唯一出口 GAME.govCellsOf；makeCity / cityPlanOf / 迁移 都走它
   *   · 旧档（官府在右侧 [22,23,30,31]）自动迁移：中央占用者与旧位**对调**（不丢）
   * ============================================================ */
  console.log('\\n--- 第 55 节：官府居中 + 旧档迁移 ---');
  (function () {
    var fs55 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var govIdxOf = function (c) {
      var g = []; c.cells.forEach(function (x, i) { if (x.official) g.push(i); });
      return g.join(',');
    };
    /* ① 玩家城居中 */
    check('★ 玩家城官府居中（第三行 4-5 / 第四行 4-5 → [19,20,27,28]）',
      govIdxOf(G.makeCity({ id: 'g55a', name: 'A' })) === '19,20,27,28',
      govIdxOf(G.makeCity({ id: 'g55b', name: 'B' })));
    /* ② 系统城（cityPlanOf）同一出口 */
    check('★ 系统城官府同样居中（走同一出口）',
      (function () {
        var p = G.cityPlanOf(5);
        var g = []; p.cells.forEach(function (x, i) { if (x.official) g.push(i); });
        return g.join(',') === '19,20,27,28';
      })());
    /* ③ 出口唯一性 + 防回退 */
    check('官府落位只有一个出口：govCellsOf 定义 1 处、makeCity/cityPlanOf 都接',
      (function () {
        var st = stripComment(fs55('state'));
        return (st.match(/GAME\\.govCellsOf\\s*=\\s*function/g) || []).length === 1
          && (st.match(/GAME\\.govCellsOf\\(/g) || []).length >= 2;
      })());
    check('全项目不再写死官府旧格号 [6+8*2, 7+8*2, ...]（防回退）',
      (function () {
        var all = '';
        ['state', 'domain', 'ui'].forEach(function (f) { all += stripComment(fs55(f)); });
        return !/6 \\+ 8 \\* 2, 7 \\+ 8 \\* 2/.test(all);
      })());
    /* ④ 旧档迁移：右侧 → 居中；中央占用者对调；等级/在建/队列一起走 */
    var keep55 = G.state;
    try {
      var st55 = G.newGame({ name: 'govmig' });
      G.state = st55;
      var c55 = st55.cities[0];
      c55.cells.forEach(function (x) { x.official = false; x.build = null; x.pending = null; });
      [22, 23, 30, 31].forEach(function (i) {
        c55.cells[i].official = true; c55.cells[i].build = { id: 'guanfu', lvl: 5 };
      });
      c55.cells[19].build = { id: 'minfang', lvl: 3 };
      c55.cells[20].build = { id: 'junying', lvl: 4 };
      c55.cells[27].pending = { buildId: 'cangku', targetLevel: 1 };
      st55.queues.build = [{ cityId: c55.id, gridIndex: 27, buildId: 'cangku', type: 'build', elapsed: 0, totalTime: 10 }];
      var mig = G.adoptState(st55);
      var mc = mig.cities[0];
      check('★ 迁移：官府自动从右侧移到正中', govIdxOf(mc) === '19,20,27,28', govIdxOf(mc));
      check('★ 迁移：官府等级保留（5 级不丢）',
        !!(mc.cells[19].build && mc.cells[19].build.id === 'guanfu' && mc.cells[19].build.lvl === 5));
      check('★ 迁移：中央的建筑与旧位对调（民房/军营不丢）',
        !!(mc.cells[22].build && mc.cells[22].build.id === 'minfang' && mc.cells[22].build.lvl === 3
          && mc.cells[23].build && mc.cells[23].build.id === 'junying' && mc.cells[23].build.lvl === 4));
      check('★ 迁移：在建项与 pending 一起换位（队列索引重映射）',
        mc.cells[27].pending === null && !!mc.cells[30].pending && mc.cells[30].pending.buildId === 'cangku'
          && (mig.queues.build || []).some(function (q) { return q.gridIndex === 30 && q.buildId === 'cangku'; }));
      /* ⑤ 幂等：已居中的档再读一次不折腾 */
      var again = G.adoptState(mig);
      check('★ 迁移幂等：已居中的档再读一次不变化',
        govIdxOf(again.cities[0]) === '19,20,27,28'
          && !!(again.cities[0].cells[22].build && again.cities[0].cells[22].build.id === 'minfang'));
    } finally {
      G.state = keep55;
    }
  })();

"""

S55_TAIL_NEW = N55 + S54_TAIL_OLD

PLAN = [
    (ST, S1_OLD, S1_NEW, 'state.js · govCellsOf 唯一出口'),
    (ST, S2_OLD, S2_NEW, 'state.js · makeCity 居中'),
    (ST, S3_OLD, S3_NEW, 'state.js · cityPlanOf 居中'),
    (ST, S4_OLD, S4_NEW, 'state.js · 36→48 迁移目标位'),
    (ST, S5_OLD, S5_NEW, 'state.js · 新增右侧→居中迁移'),
    (ST, S6_OLD, S6_NEW, 'state.js · 注释'),
    (ST, S7_OLD, S7_NEW, 'state.js · 注释 2'),
    (ST, S8_OLD, S8_NEW, 'state.js · 注释 3'),
    (DA, D1_OLD, D1_NEW, 'data.js · 注释'),
    (UI, U1_OLD, U1_NEW, 'ui.js · 注释'),
    (SMOKE, T1_OLD, T1_NEW, 'smoke · 文案 1'),
    (SMOKE, T2_OLD, T2_NEW, 'smoke · 断言 2'),
    (SMOKE, T3_OLD, T3_NEW, 'smoke · 断言 3'),
    (SMOKE, T4_OLD, T4_NEW, 'smoke · 断言 4'),
    (SMOKE, T5_OLD, T5_NEW, 'smoke · 断言 5'),
    (SMOKE, S54_TAIL_OLD, S55_TAIL_NEW, 'smoke · 第 55 节'),
]


def main():
    texts = {}
    for p in {ST, UI, DA, SMOKE}:
        texts[p] = io.open(p, 'rb').read().decode('utf-8')

    if MARK in texts[ST] and '第 55 节：官府居中' in texts[SMOKE]:
        print('· 已存在，跳过（幂等）')
        return 0

    crlf0 = {p: texts[p].count('\r\n') for p in texts}
    done = []
    for path, old, new, tag in PLAN:
        t = texts[path]
        c = t.count(old)
        if c != 1:
            print('✗ [%s] 锚点命中 %d 次（应为 1），拒绝写盘' % (tag, c))
            return 1
        texts[path] = t.replace(old, new, 1)
        done.append(tag)

    for path in texts:
        out = texts[path].encode('utf-8')
        if out.count(b'\r\n') != crlf0[path]:
            print('✗ 行尾被改写（%s）' % path)
            return 1
        io.open(path, 'wb').write(out)

    print('本次改动: %d 处' % len(done))
    for d in done:
        print('  ·', d)
    chk = io.open(ST, encoding='utf-8', newline='').read()
    ok = MARK in chk and 'GAME.govCellsOf(8, 6).forEach' in chk
    print('✓ 完成' if ok else '✗ 核验未过')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
