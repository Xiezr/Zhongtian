# -*- coding: utf-8 -*-
"""v85.1 · 测试补丁：新增「174 城零错位」断言（复核修复的关键不变量）。

smoke：70 节「缩略地图数据层」段尾追加实测断言。
e2e ：v85 段「缩略数据」断言后追加同款（真实 DOM 环境）。
"""
import io
import sys

SM = r'E:\Deepseekdb\smoke-test.js'
E2 = r'E:\Deepseekdb\e2e-test.js'


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


print('== T1. smoke 追加零错位断言 ==')
patch(
    SM,
    """    return edgeN > 500 && jedgeN > 500 && G.map.miniBuild() === d;
  })());""",
    """    return edgeN > 500 && jedgeN > 500 && G.map.miniBuild() === d;
  })());
  check('实测：174 城零错位（城格色块 = 城自身州 · v85.1 复核修复）', (function () {
    var d = G.map.miniBuild();
    var idx = {};
    d.stName.forEach(function (n, i) { idx[n] = i; });
    var mis = 0;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (d.state[c.y * 500 + c.x] !== idx[c.state]) mis++;
    });
    return mis === 0;
  })());""",
    'T1 smoke 零错位',
    probe='174 城零错位',
)

print()
print('== T2. e2e 追加零错位断言 ==')
patch(
    E2,
    """      return e1 > 10 && e2 > 10;
    })());
    G.ui.closeModal();""",
    """      return e1 > 10 && e2 > 10;
    })());
    check('v85.1：174 城零错位（城格色块 = 城自身州 · 复核修复）', (function () {
      const d = G.map.miniBuild();
      const idx = {};
      d.stName.forEach((n, i) => { idx[n] = i; });
      let mis = 0;
      (G.DATA.NPC_CITIES || []).forEach((c) => { if (d.state[c.y * 500 + c.x] !== idx[c.state]) mis++; });
      return mis === 0;
    })());
    G.ui.closeModal();""",
    'T2 e2e 零错位',
    probe='v85.1：174 城零错位',
)

print()
print('全部完成。')
