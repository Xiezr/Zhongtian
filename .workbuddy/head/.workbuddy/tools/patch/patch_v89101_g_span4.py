# -*- coding: utf-8 -*-
"""patch_v89101_g_span4.py — v89.101d 城流跨越 · 三校准（官府总闸）
根因（实测）：`buildCapOf` —— 城内建筑等级 ≤ 官府等级。junying 被卡 Lv2→3 达 9 游戏年。
修：spanMil 目标链改为 [guanfu→8, junying→7, majiu→3, shuyuan→6]，
    每轮全部尝试 + 金提速；且在"已达当前 cap"时静默等待（由官府升级自然解闸）。
另：升级取**该建筑最高等级的那一格**（buildingLevel = 各格最大等级）。
"""
import io
P = 'E:/Deepseekdb/.workbuddy/tools/playtest/play_rush_1x.js'
s = io.open(P, encoding='utf-8').read()
N = [0]


def rep(old, new, tag):
    global s
    if new in s:
        print('SKIP ' + tag)
        return
    assert old in s, 'MISS: ' + tag
    s = s.replace(old, new, 1)
    N[0] += 1
    print('OK   ' + tag)


rep("""  var c = st.cities[0];
  [['junying', 5], ['majiu', 3], ['shuyuan', 6]].forEach(function (p) {
    var bid = p[0], want = p[1];
    if (G.buildingLevel(c, bid) >= want) return;
    var idx = -1;
    (c.cells || []).forEach(function (cc, i) { if (idx < 0 && cc.build && cc.build.id === bid) idx = i; });
    if (idx < 0) return;""",
    """  var c = st.cities[0];
  /* v89.101d：**官府总闸优先**（实测 junying 被"建筑等级 ≤ 官府等级"卡了 9 年）；
     升级取**最高等级的那一格**（buildingLevel = 各格最大等级） */
  [['guanfu', 8], ['junying', 7], ['majiu', 3], ['shuyuan', 6]].forEach(function (p) {
    var bid = p[0], want = p[1];
    if (G.buildingLevel(c, bid) >= want) return;
    if (G.buildCapOf && G.buildCapOf(c, bid) <= G.buildingLevel(c, bid)) return;   /* 受官府闸：等官府先升 */
    var idx = -1, bl = -1;
    (c.cells || []).forEach(function (cc, i) { if (cc.build && cc.build.id === bid && cc.build.lvl > bl) { bl = cc.build.lvl; idx = i; } });
    if (idx < 0) return;""",
    'spanMil full chain + gov gate')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written（%d 处替换）' % N[0])
