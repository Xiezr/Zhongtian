# -*- coding: utf-8 -*-
# v89.212（老板 1）：城外堆场按资源分账 —— state.js 三处资源循环（按资源封顶）
# ⚠️ 段间 mark 必须各自独有（§105.6：共享子串会误 skip）——B1/B2/B3 用含各自注释的复合 mark。
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if mark and s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

S = 'E:/Deepseekdb/js/state.js'

# ---------------- B1: simulateOfflineOverflow（0.5 倍率档） ----------------
rep(S, 'B1 simulateOfflineOverflow 按资源',
    """      var prod = GAME.cityProdPerSec(ct);
      var cap = GAME.storeCapOf(ct);
      var R = GAME.res(ct);
      for (var k in prod) {
        if (k === 'pop') continue;
        /* v89.158：只封增长、不削存量（同在线口径） */""",
    """      var prod = GAME.cityProdPerSec(ct);
      /* v89.212（老板 1）：城外堆场按资源分账 —— 上限逐资源取（每城算一次，循环内查表） */
      var caps = GAME.storePartsOf(ct).capByRes || {};
      var R = GAME.res(ct);
      for (var k in prod) {
        if (k === 'pop') continue;
        var cap = (k === 'gold') ? 0 : (caps[k] != null ? caps[k] : GAME.storeCapOf(ct, k));
        /* v89.158：只封增长、不削存量（同在线口径） */""",
    'caps[k] != null ? caps[k] : GAME.storeCapOf(ct, k));\n        /* v89.158：只封增长、不削存量（同在线口径） */')

# ---------------- B2: 离线 bulk（full 倍率档） ----------------
rep(S, 'B2 离线 bulk 按资源',
    """      var prod = GAME.cityProdPerSec(ct);
      var cap = GAME.storeCapOf(ct);
      var R = GAME.res(ct);
      for (var k in prod) {
        if (k === 'pop') continue;
        /* v89.158：只封增长、不削存量（与在线 tickOnce 同一口径） */""",
    """      var prod = GAME.cityProdPerSec(ct);
      /* v89.212（老板 1）：城外堆场按资源分账 —— 上限逐资源取（每城算一次，循环内查表） */
      var caps = GAME.storePartsOf(ct).capByRes || {};
      var R = GAME.res(ct);
      for (var k in prod) {
        if (k === 'pop') continue;
        var cap = (k === 'gold') ? 0 : (caps[k] != null ? caps[k] : GAME.storeCapOf(ct, k));
        /* v89.158：只封增长、不削存量（与在线 tickOnce 同一口径） */""",
    'caps[k] != null ? caps[k] : GAME.storeCapOf(ct, k));\n        /* v89.158：只封增长、不削存量（与在线 tickOnce 同一口径） */')

# ---------------- B3: tickOnce（在线逐秒） ----------------
rep(S, 'B3 tickOnce 按资源',
    """      var cap = GAME.storeCapOf(ct);
      var R = GAME.res(ct);
      for (var rk2 in p) {
        if (rk2 === 'pop') continue;""",
    """      /* v89.212（老板 1）：城外堆场按资源分账 —— 上限逐资源取（每城算一次，循环内查表） */
      var caps = GAME.storePartsOf(ct).capByRes || {};
      var R = GAME.res(ct);
      for (var rk2 in p) {
        if (rk2 === 'pop') continue;
        var cap = (rk2 === 'gold') ? 0 : (caps[rk2] != null ? caps[rk2] : GAME.storeCapOf(ct, rk2));""",
    'var cap = (rk2 === \'gold\') ? 0 : (caps[rk2] != null ? caps[rk2] : GAME.storeCapOf(ct, rk2));')

print('--- B 批完成 ---')

# ---------------- C: systems.js _openChest ----------------
SY = 'E:/Deepseekdb/js/systems.js'
rep(SY, 'C1 _openChest 按资源',
    """    var cap = GAME.storeCap ? GAME.storeCap() : 0;
    ['grain', 'wood', 'stone', 'iron'].sort(function () { return Math.random() - 0.5; }).slice(0, 2)
      .forEach(function (k) {
        var amt = rnd(rt[0], rt[1]);
        var before = R[k] || 0;
        R[k] = cap > 0 ? Math.min(cap, before + amt) : before + amt;""",
    """    ['grain', 'wood', 'stone', 'iron'].sort(function () { return Math.random() - 0.5; }).slice(0, 2)
      .forEach(function (k) {
        /* v89.212（老板 1）：按资源上限 —— 两件资源各自的仓容（堆场分账） */
        var cap = GAME.storeCapOf ? GAME.storeCapOf(GAME.currentCity(), k) : 0;
        var amt = rnd(rt[0], rt[1]);
        var before = R[k] || 0;
        R[k] = cap > 0 ? Math.min(cap, before + amt) : before + amt;""",
    '两件资源各自的仓容（堆场分账）')
print('--- C 批完成 ---')
