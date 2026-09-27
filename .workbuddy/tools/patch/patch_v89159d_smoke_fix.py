# -*- coding: utf-8 -*-
"""v89.159 补丁 D：修 §159②/③ 用例的资源摆放（s.res 是**当前城**的 getter ——
必须先把新造的城设为当前城；珠宝在 s.items 而不是 s.jewels）。"""
import io, sys

R = 'E:/Deepseekdb/'
P = 'smoke-test.js'


def rep(tag, old, new, guard):
    s = io.open(R + P, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %-34s 已落盘' % tag); sys.stdout.flush(); return
    n = s.count(old)
    assert n == 1, '%s 命中 %d 次' % (tag, n)
    io.open(R + P, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('  [ ok ] %-34s （1/1 · 已写盘）' % tag); sys.stdout.flush()


# ── §159②：把新造的城设为当前城（s.res 是当前城的 getter）+ 还原 ──
OLD1 = """      var c = G.makeCity({ id: 'v159a', name: 'v159城', x: 600, y: 600, type: 'self' });
      var bkQ = (st.queues.build || []).slice();
      st.cities.push(c);
      try {
        var idxs = [];
        c.cells.forEach(function (x, i) { if (x.build && x.build.id === 'minfang') idxs.push(i); });
        if (idxs.length < 2) return false;
        c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
        c.cells[idxs[0]].build.lvl = 4; c.cells[idxs[1]].build.lvl = 3;
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });"""
NEW1 = """      var c = G.makeCity({ id: 'v159a', name: 'v159城', x: 600, y: 600, type: 'self' });
      var bkQ = (st.queues.build || []).slice();
      var bkCity159 = G.ui._cityId;                    /* s.res 是**当前城**的 getter */
      st.cities.push(c);
      try {
        G.ui._cityId = c.id;
        var idxs = [];
        c.cells.forEach(function (x, i) { if (x.build && x.build.id === 'minfang') idxs.push(i); });
        if (idxs.length < 2) return false;
        c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
        c.cells[idxs[0]].build.lvl = 4; c.cells[idxs[1]].build.lvl = 3;
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { st.res[k] = 1e9; });"""
rep('smoke · §159② 资源摆放', OLD1, NEW1, 'bkCity159')

OLD1B = """      } finally {
        st.cities = st.cities.filter(function (x) { return x.id !== 'v159a'; });
        st.queues.build = bkQ.slice();
      }
    })(), '改前：另一座 Lv4 让本座被按"4→5"拦下（报需官府 Lv5）');"""
NEW1B = """      } finally {
        st.cities = st.cities.filter(function (x) { return x.id !== 'v159a'; });
        st.queues.build = bkQ.slice();
        G.ui._cityId = bkCity159;
      }
    })(), '改前：另一座 Lv4 让本座被按"4→5"拦下（报需官府 Lv5）');"""
rep('smoke · §159② 城市还原', OLD1B, NEW1B, 'bkCity159;\n      }\n    })(), \'改前')

# ── §159③：同样切当前城 + 珠宝走 s.items（附还原） ──
OLD2 = """      var c = G.makeCity({ id: 'v159b', name: 'v159b城', x: 601, y: 601, type: 'self' });
      var bkQ = (st.queues.build || []).slice();
      var bkMain = st.mainCityId, bkRank = st.rank;
      st.cities.push(c);
      try {
        var gi = -1, mi = -1;"""
NEW2 = """      var c = G.makeCity({ id: 'v159b', name: 'v159b城', x: 601, y: 601, type: 'self' });
      var bkQ = (st.queues.build || []).slice();
      var bkMain = st.mainCityId, bkRank = st.rank;
      var bkCity159b = G.ui._cityId, bkRes159b = {}, bkItems159b = {};
      st.cities.push(c);
      try {
        G.ui._cityId = c.id;                          /* 资源写入当前城 */
        var gi = -1, mi = -1;"""
rep('smoke · §159③ 城市切换', OLD2, NEW2, 'bkCity159b')

OLD3 = """        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 1e9; });
        var _c = DATA.BUILDINGS.minfang.levelCost(12) || {};
        if (_c.jewel) { st.jewels = st.jewels || {}; for (var jk in _c.jewel) st.jewels[jk] = Math.max(st.jewels[jk] || 0, _c.jewel[jk]); }"""
NEW3 = """        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { bkRes159b[k] = st.res[k]; st.res[k] = 1e9; });
        var _c = DATA.BUILDINGS.minfang.levelCost(12) || {};
        if (_c.jewel) {
          st.items = st.items || {};
          for (var jk in _c.jewel) { bkItems159b[jk] = st.items[jk]; st.items[jk] = Math.max(st.items[jk] || 0, _c.jewel[jk]); }
        }"""
rep('smoke · §159③ 资源/珠宝摆放', OLD3, NEW3, 'bkRes159b')

OLD4 = """      } finally {
        st.cities = st.cities.filter(function (x) { return x.id !== 'v159b'; });
        st.queues.build = bkQ.slice();
        st.mainCityId = bkMain; st.rank = bkRank;
      }"""
NEW4 = """      } finally {
        st.cities = st.cities.filter(function (x) { return x.id !== 'v159b'; });
        st.queues.build = bkQ.slice();
        st.mainCityId = bkMain; st.rank = bkRank;
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { if (bkRes159b[k] != null) st.res[k] = bkRes159b[k]; });
        for (var jk2 in bkItems159b) st.items[jk2] = bkItems159b[jk2];
        G.ui._cityId = bkCity159b;
      }"""
rep('smoke · §159③ 还原', OLD4, NEW4, 'bkItems159b;\n        G.ui._cityId = bkCity159b;')

print('\n补丁 D 完成。')
