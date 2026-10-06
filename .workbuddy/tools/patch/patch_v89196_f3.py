# -*- coding: utf-8 -*-
"""v89.196 批次F3：三红修复
F3a smoke unlockCol196 键名修正（gather → gathers，statBump 的真实键）
F3b map.js fortRingOf 环连接改**无向走法**（段方向不一致时也能连成环）
F3c smoke §196③ 早退点加诊断"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# ---------------- F3a 键名修正 ----------------
F3A_OLD = """      st.stats = { wins: 999, conquer: 999, wilds: 999, gather: 999, scouts: 999, forts: 999,
        recruited: 999, trades: 999, forgedCount: 999, trained: 999999, buildDone: 999 };"""
F3A_NEW = """      /* ⚠️ 键名与 statBump 真实键一字不差（gathers 不是 gather —— 曾写错致凉州系锁死）。 */
      st.stats = { wins: 999, conquer: 999, wilds: 999, gathers: 999, scouts: 999, forts: 999,
        recruited: 999, trades: 999, forgedCount: 999, trained: 999999, buildDone: 999 };"""
rep('smoke-test.js', 'F3a gather→gathers', F3A_OLD, F3A_NEW, 'gathers 不是 gather')

# ---------------- F3b fortRingOf 无向环连接 ----------------
F3B_OLD = """    /* 环连接（填充用）：每个端点恰好接两条段 → 沿链走一圈 */
    var ends = {}, k2 = function (x, y) { return x + '|' + y; };
    segs.forEach(function (sg, i) {
      var a = k2(sg[0], sg[1]), b = k2(sg[2], sg[3]);
      (ends[a] = ends[a] || []).push(i);
      (ends[b] = ends[b] || []).push(i);
    });
    var ring = [], used = {}, cur = 0, guard = 0;
    while (segs[cur] && guard++ < segs.length + 8) {
      used[cur] = 1;
      ring.push([segs[cur][0], segs[cur][1]]);
      var b3 = k2(segs[cur][2], segs[cur][3]);
      var nxt = -1;
      (ends[b3] || []).forEach(function (i2) { if (nxt < 0 && !used[i2]) nxt = i2; });
      if (nxt < 0) break;
      cur = nxt;
    }"""
F3B_NEW = """    /* 环连接（填充用）：**无向走法** —— 段的方向不保证首尾同向（按格序生成），
       所以沿"当前端点 → 找另一条以它为端点的未用段 → 跳到该段另一端"走；
       网格边界的角点度数为 2（无对角接触时），必走出一个闭合环。
       ⚠️ 首版按"有向链"走（每段终点接下一段起点）——在端点方向不一致时会提前断链
       （实测 R1 环只连出 5/12 段，smoke 抓出）。 */
    var ends = {}, k2 = function (x, y) { return x + '|' + y; };
    segs.forEach(function (sg, i) {
      var a = k2(sg[0], sg[1]), b = k2(sg[2], sg[3]);
      (ends[a] = ends[a] || []).push(i);
      (ends[b] = ends[b] || []).push(i);
    });
    var ring = [], used = {}, guard = 0;
    var pt = [segs[0][0], segs[0][1]];
    var startK = k2(pt[0], pt[1]);
    while (guard++ < segs.length + 8) {
      var pk = k2(pt[0], pt[1]);
      var hit = -1;
      (ends[pk] || []).forEach(function (i2) { if (hit < 0 && !used[i2]) hit = i2; });
      if (hit < 0) break;
      used[hit] = 1;
      var sg2 = segs[hit];
      var npt = (k2(sg2[0], sg2[1]) === pk) ? [sg2[2], sg2[3]] : [sg2[0], sg2[1]];
      ring.push(pt);
      pt = npt;
      if (k2(pt[0], pt[1]) === startK) break;       /* 回起点 = 闭合 */
    }"""
rep('js/map.js', 'F3b 无向环连接', F3B_OLD, F3B_NEW, '首版按"有向链"走')

# ---------------- F3c §196③ 早退诊断 ----------------
F3C_OLD = """        var w = null;
        for (var y = 5; y < 120 && !w; y++) {
          for (var x = 5; x < 120; x++) {
            var tl = G.map.tile(x, y);
            if (!tl || tl.terrain === 'city') continue;
            if (G.map.wildAt && G.map.wildAt(x, y)) continue;
            var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : G.map.wildLevel(x, y);
            if (lv >= 2 && lv <= 5) { w = { x: x, y: y }; break; }
          }
        }
        if (!w) return false;
        st.marches = st.marches || [];
        var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 60000 }, lord.id);
        if (!r.ok) return false;
        var n = 0;
        while (st.marches.length && n < 400) { G.march.tick(); n++; if (st.battles && st.battles.length) break; }
        var rec = (st.battles || [])[0];
        if (!rec) return false;"""
F3C_NEW = """        var w = null;
        for (var y = 5; y < 120 && !w; y++) {
          for (var x = 5; x < 120; x++) {
            var tl = G.map.tile(x, y);
            if (!tl || tl.terrain === 'city') continue;
            if (G.map.wildAt && G.map.wildAt(x, y)) continue;
            var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : G.map.wildLevel(x, y);
            if (lv >= 2 && lv <= 5) { w = { x: x, y: y }; break; }
          }
        }
        if (!w) { global.__d196c = 'no-wild'; return false; }
        st.marches = st.marches || [];
        var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 60000 }, lord.id);
        if (!r.ok) { global.__d196c = 'dispatch: ' + r.msg; return false; }
        var n = 0;
        while (st.marches.length && n < 400) { G.march.tick(); n++; if (st.battles && st.battles.length) break; }
        var rec = (st.battles || [])[0];
        if (!rec) { global.__d196c = 'no-battle marches=' + st.marches.length + ' n=' + n; return false; }"""
rep('smoke-test.js', 'F3c 早退诊断', F3C_OLD, F3C_NEW, "global.__d196c = 'dispatch: ' + r.msg")

print('批次F3 完成')
