# -*- coding: utf-8 -*-
"""v84 · 顺手修存量 flake：e2e 第 23 节「出征弹窗行军预估」的固定偏移坐标。

背景：地图种子 = U.now() % 100000（state.js: mapSeed），每次跑 e2e 地图都不同。
第 23 节把出征目标写死在 c23.x+3 / c23.y+3 —— 该位置恰好是城池 / 越界时，
resolveTarget 会拒绝、弹窗不开，两条断言（速度系数 / 预计）假红。
v84 首跑实测命中（728/2），复跑（换种子）即绿（730/0）—— 判定为存量 flake。

修法（同 v83 §57 flake 先例）：**换标的、不放宽判据** —— ring 搜索一块
合法野地（非城、不越界）当靶子；断言（弹窗含行军预估）一个字不改。
"""
import io
import sys

E2E = r'E:\Deepseekdb\e2e-test.js'


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


print('== F1. e2e 第 23 节：固定偏移 → ring 搜索合法野地 ==')
patch(
    E2E,
    """    /* 出征弹窗的行军预估 */
    G.ui._expTarget = { kind: 'wild', x: c23.x + 3, y: c23.y + 3, name: '测试野地', terrain: 'lake', level: 3, def: 0, garrison: { yibing: 100 } };""",
    """    /* 出征弹窗的行军预估 */
    /* v84 顺手修存量 flake：地图种子每次运行都不同（state.js: mapSeed = U.now() % 100000），
       写死的 c23.x+3 / c23.y+3 可能落在城池 / 越界 —— resolveTarget 拒绝、弹窗不开，
       两条断言假红（实测命中）。改为 ring 搜索一块合法野地当靶子（换标的、不放宽判据）。 */
    let emSpot = null;
    for (let emR = 1; emR <= 12 && !emSpot; emR++) {
      for (let emDy = -emR; emDy <= emR && !emSpot; emDy++) for (let emDx = -emR; emDx <= emR && !emSpot; emDx++) {
        const tl23 = G.map.tile(c23.x + emDx, c23.y + emDy);
        if (tl23 && tl23.terrain !== 'city') emSpot = { x: c23.x + emDx, y: c23.y + emDy };
      }
    }
    G.ui._expTarget = { kind: 'wild', x: emSpot.x, y: emSpot.y, name: '测试野地', terrain: 'lake', level: 3, def: 0, garrison: { yibing: 100 } };""",
    'F1 出征目标改 ring 搜索',
    probe='let emSpot = null;',
)

print()
print('全部完成。')
