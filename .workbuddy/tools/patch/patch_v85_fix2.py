# -*- coding: utf-8 -*-
"""v85.1 · 全面复核修复：缩略地图「城点 × 州色块」零错位。

背景（复核探针实测）：旧版 miniBuild 按「最近州心（13 座州城）Voronoi」划分
州域 —— 174 城中 24 城（13.8%）色块与自身州归属不符（如宛县属荆州却落在
司隶色块内、高陵属司隶却落在凉州色块内），其中 14 座是会在图面上出点的郡城。

修法：换为**多源「最近城」距离场**——每座非县城城市（109 座）为源、带自身
state 与 jun id，两遍 chamfer 扫描（正交 5 / 对角 7，近似欧氏）传播最近源标签。
城自身格距离 0 必归自己 → 城点与色块 100% 一致；界线沿相邻城平分线、
天然不跨州（标签自带 state）。

三处补丁：①块注释同步 ②第一段 forEach 去掉 junByState（不再需要）
③填充算法 Voronoi → chamfer。
"""
import io
import sys

MAP = r'E:\Deepseekdb\js\map.js'


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


print('== R1. 块注释同步（Voronoi → 距离场） ==')
patch(
    MAP,
    """   *   · 州心 = 都城 / 州城（13 个）；每格取最近州心 → 州域（Voronoi）。
   *   · 郡单元 = 每座郡城 + 所属州城（州直辖）；**先定州、再在本州郡心里取最近**
   *     —— 两遍最近邻保证郡界不跨州（不会出现交叉行政区）。""",
    """   *   · 州域 = **多源「最近城」距离场**（每座非县城城市一个源，两遍 chamfer
   *     扫描近似欧氏传播）—— 城自身格必归自己，城点与色块严格一致。
   *   · 郡界 = 同州内相邻城的 jun id 变化处（标签自带 state，天然不跨州）。
   *   · v85.1（全面复核修复）：旧版按「最近州心 Voronoi」划分，实测 174 城中
   *     24 城（13.8%）色块与自身归属不符（如宛县属荆州却落在司隶色块内）——
   *     已换用下述距离场方案，复核探针验证零错位。""",
    'R1 块注释',
    probe='多源「最近城」距离场',
)

print()
print('== R2+R3. 第一段 forEach 简化 + 填充算法替换 ==')
patch(
    MAP,
    """    var stName = [], stX = [], stY = [];                    /* 州心（出现顺序 = 色板下标） */
    var junByState = [], junN = 0;                          /* 每州的郡单元：{x,y,id} */
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type === 'county') return;                      /* 县城不参与中心 */
      var si = stName.indexOf(c.state);
      if (si < 0) { si = stName.length; stName.push(c.state); }
      if (c.type === 'capital' || c.type === 'zhou') {
        if (stX[si] == null) { stX[si] = c.x; stY[si] = c.y; }
      }
      if (!junByState[si]) junByState[si] = [];
      junByState[si].push({ x: c.x, y: c.y, id: junN++ });
    });
    var S = stName.length;
    var ownerState = new Uint8Array(W * H), ownerJun = new Uint8Array(W * H);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var bs = 0, bd = 4294967295;
        for (var i = 0; i < S; i++) {
          var dx = x - stX[i], dy = y - stY[i], d = dx * dx + dy * dy;
          if (d < bd) { bd = d; bs = i; }
        }
        var J = junByState[bs], bjId = 0, bd2 = 4294967295;
        for (var j = 0; j < J.length; j++) {
          var dx2 = x - J[j].x, dy2 = y - J[j].y, d2 = dx2 * dx2 + dy2 * dy2;
          if (d2 < bd2) { bd2 = d2; bjId = J[j].id; }
        }
        ownerState[y * W + x] = bs;
        ownerJun[y * W + x] = bjId;
      }
    }""",
    """    var stName = [], stX = [], stY = [];   /* 州心（出现顺序 = 色板下标；stX/stY 保留为输出扩展位） */
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type === 'county') return;                      /* 县城不参与中心 */
      var si = stName.indexOf(c.state);
      if (si < 0) { si = stName.length; stName.push(c.state); }
      if (c.type === 'capital' || c.type === 'zhou') {
        if (stX[si] == null) { stX[si] = c.x; stY[si] = c.y; }
      }
    });
    /* v85.1（全面复核修复）：多源「最近城」距离场 —— 替换旧版「13 州心 Voronoi」。
       旧版实测 174 城中 24 城（13.8%）色块与自身州归属不符（如宛县属荆州却落在
       司隶色块内）。新法**以每座非县城城市为源**（带自身 state + jun id），
       两遍 chamfer 扫描（正交 5 / 对角 7，近似欧氏）传播「最近城」标签：
       城自身格距离 0 必归自己 → 城点与色块 100% 一致；界线沿相邻城平分线，
       且天然不跨州（标签自带 state）。 */
    var ownerState = new Uint8Array(W * H), ownerJun = new Uint8Array(W * H);
    var dist = new Int32Array(W * H), INF = 0x3fffffff;
    for (var q0 = 0; q0 < dist.length; q0++) dist[q0] = INF;
    var ng = 0;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type === 'county') return;
      var p = c.y * W + c.x;
      dist[p] = 0;
      ownerState[p] = stName.indexOf(c.state);
      ownerJun[p] = ng++;
    });
    /* 正扫：左 / 上 / 左上 / 右上 四个已处理邻居 */
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var a = y * W + x, d = dist[a], s = ownerState[a], j = ownerJun[a], n, nd;
        if (x > 0) { n = a - 1; nd = dist[n] + 5; if (nd < d) { d = nd; s = ownerState[n]; j = ownerJun[n]; } }
        if (y > 0) { n = a - W; nd = dist[n] + 5; if (nd < d) { d = nd; s = ownerState[n]; j = ownerJun[n]; } }
        if (x > 0 && y > 0) { n = a - W - 1; nd = dist[n] + 7; if (nd < d) { d = nd; s = ownerState[n]; j = ownerJun[n]; } }
        if (x < W - 1 && y > 0) { n = a - W + 1; nd = dist[n] + 7; if (nd < d) { d = nd; s = ownerState[n]; j = ownerJun[n]; } }
        dist[a] = d; ownerState[a] = s; ownerJun[a] = j;
      }
    }
    /* 反扫：右 / 下 / 右下 / 左下 四个已处理邻居 */
    for (var y2 = H - 1; y2 >= 0; y2--) {
      for (var x2 = W - 1; x2 >= 0; x2--) {
        var a2 = y2 * W + x2, d2 = dist[a2], s2 = ownerState[a2], j2 = ownerJun[a2], n2, nd2;
        if (x2 < W - 1) { n2 = a2 + 1; nd2 = dist[n2] + 5; if (nd2 < d2) { d2 = nd2; s2 = ownerState[n2]; j2 = ownerJun[n2]; } }
        if (y2 < H - 1) { n2 = a2 + W; nd2 = dist[n2] + 5; if (nd2 < d2) { d2 = nd2; s2 = ownerState[n2]; j2 = ownerJun[n2]; } }
        if (x2 < W - 1 && y2 < H - 1) { n2 = a2 + W + 1; nd2 = dist[n2] + 7; if (nd2 < d2) { d2 = nd2; s2 = ownerState[n2]; j2 = ownerJun[n2]; } }
        if (x2 > 0 && y2 < H - 1) { n2 = a2 + W - 1; nd2 = dist[n2] + 7; if (nd2 < d2) { d2 = nd2; s2 = ownerState[n2]; j2 = ownerJun[n2]; } }
        dist[a2] = d2; ownerState[a2] = s2; ownerJun[a2] = j2;
      }
    }""",
    'R2+R3 距离场替换',
    probe='多源「最近城」距离场 —— 替换旧版',
    probe_must_exist=True,
)

print()
print('== R4. 县城也作源（零错位收尾） ==')
patch(
    MAP,
    """    var ownerState = new Uint8Array(W * H), ownerJun = new Uint8Array(W * H);
    var dist = new Int32Array(W * H), INF = 0x3fffffff;
    for (var q0 = 0; q0 < dist.length; q0++) dist[q0] = INF;
    var ng = 0;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type === 'county') return;
      var p = c.y * W + c.x;
      dist[p] = 0;
      ownerState[p] = stName.indexOf(c.state);
      ownerJun[p] = ng++;
    });""",
    """    var ownerState = new Uint8Array(W * H), ownerJun = new Uint8Array(W * H);
    var dist = new Int32Array(W * H), INF = 0x3fffffff;
    for (var q0 = 0; q0 < dist.length; q0++) dist[q0] = INF;
    /* jun id 分配：非县城按出现序 0..108；县城复用「同州最近郡心」的 id。
       （v85.1 复核补充：县城也是城、也作源 —— 首轮只修到 173/174，
       东平（兖州县城）仍被青州城抢走色块；县城入源后错位归零。） */
    var allC = DATA.NPC_CITIES || [];
    var junIds = [];
    var ng = 0;
    allC.forEach(function (c, cix) { junIds[cix] = c.type === 'county' ? -1 : ng++; });
    allC.forEach(function (c, cix) {
      var p = c.y * W + c.x;
      var j = junIds[cix];
      if (j < 0) {
        var bd = 1e18, bj = 0;
        allC.forEach(function (o, oix) {
          if (junIds[oix] < 0 || o.state !== c.state) return;
          var dx = c.x - o.x, dy = c.y - o.y, dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; bj = junIds[oix]; }
        });
        j = bj;
      }
      dist[p] = 0;
      ownerState[p] = stName.indexOf(c.state);
      ownerJun[p] = j;
    });""",
    'R4 县城入源',
    probe='县城复用「同州最近郡心」的 id',
    probe_must_exist=True,
)

print()
print('全部完成。')
