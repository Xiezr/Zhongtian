# -*- coding: utf-8 -*-
"""v68 修正 2：govMax 作用域提升。

fix1 把 govMax 插在 v64 段的外层 IIFE 里 —— 只对该段可见；
4304（升级军营段）/ v54 段 / 第 55 节都用不到 → `govMax is not defined`。
提升到 smoke 主 IIFE 顶层（`var G = GAME` 之后的 helper 区）。
"""
import io
import os
import sys

SMOKE = os.path.join(r'E:\Deepseekdb', 'smoke-test.js')

LOCAL_BLOCK = """  /* v68（逐步探索）：把城的官府设为"该城满级"（12 + 档位加成）——
     让"建筑应能自由升满"的老测试段不受官府总闸影响。
     总闸本身的验证在「第 55 节 · 建造前置」，那里用低级官府做对照。 */
  function govMax(c) {
    var cap = (DATA.BUILDINGS.guanfu.maxLevel || DATA.MAX_BLEVEL) + (GAME.cityBuildBonus(c) || 0);
    ((c && c.cells) || []).forEach(function (x) {
      if (x.build && x.build.id === 'guanfu') x.build.lvl = cap;
    });
    return c;
  }

  /* 在空地上放一座建筑（造测试环境用；找不到空位返回 false） */"""

LOCAL_AFTER = """  /* 在空地上放一座建筑（造测试环境用；找不到空位返回 false） */"""

TOP_ANCHOR = "  function extOf(st) { return G.extGridOf(st.cities[0]); }"

TOP_AFTER = """  function extOf(st) { return G.extGridOf(st.cities[0]); }

  /* v68（逐步探索）：把城的官府设为"该城满级"（12 + 档位加成）——
     让"建筑应能自由升满"的老测试段不受官府总闸影响。
     总闸本身的验证在「第 55 节 · 建造前置」，那里用低级官府做对照。 */
  function govMax(c) {
    var cap = (DATA.BUILDINGS.guanfu.maxLevel || DATA.MAX_BLEVEL) + (GAME.cityBuildBonus(c) || 0);
    ((c && c.cells) || []).forEach(function (x) {
      if (x.build && x.build.id === 'guanfu') x.build.lvl = cap;
    });
    return c;
  }"""


def main():
    t = io.open(SMOKE, 'rb').read().decode('utf-8')
    crlf0 = t.count('\r\n')

    # 幂等：顶层已有（且局部没有）
    if t.count('function govMax(c)') == 1 and '\n  function extOf' in t and 'function govMax(c)' in t.split(TOP_ANCHOR)[1][:400]:
        print('· 已提升，跳过（幂等）')
        return 0

    if t.count(LOCAL_BLOCK) != 1:
        print('✗ 局部块锚点命中 %d 次' % t.count(LOCAL_BLOCK))
        return 1
    if t.count(TOP_ANCHOR) != 1:
        print('✗ 顶层锚点命中 %d 次' % t.count(TOP_ANCHOR))
        return 1

    t = t.replace(LOCAL_BLOCK, LOCAL_AFTER, 1)
    t = t.replace(TOP_ANCHOR, TOP_AFTER, 1)

    out = t.encode('utf-8')
    if out.count(b'\r\n') != crlf0:
        print('✗ 行尾被改写')
        return 1
    io.open(SMOKE, 'wb').write(out)

    chk = io.open(SMOKE, encoding='utf-8', newline='').read()
    n = chk.count('function govMax(c)')
    top_ok = 'function govMax(c)' in chk.split(TOP_ANCHOR)[1][:500]
    print('✓ 完成：govMax 定义数 %d（应为 1），位于顶层 = %s' % (n, top_ok))
    return 0 if (n == 1 and top_ok) else 1


if __name__ == '__main__':
    sys.exit(main())
