# -*- coding: utf-8 -*-
"""patch_v89101_d_span.py — v89.101 城流跨越（span 模式）
在 play_rush_1x.js 上追加（幂等；须在 v8999/v89100 补丁链之后应用）：
  ① TROOP_ORDER 的 span 覆盖（轻骑优先）+ 模式播报
  ② SPAN 三件套函数块（spanCities / spanCav / spanMil）
  ③ 主循环挂载
  ④ goldTrainRush 保留线下调（span 专用）
背景（实测）：筑城无上限、即时、5 万资源/座；附近 1233 块可筑平原；
  金 57.4 万买断 5.83 年训练 → 700 轻骑立等入列。
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


# ① TROOP_ORDER span 覆盖 + 播报
rep("var TROOP_ORDER = ['tieji', 'qingji', 'changqiang', 'daodun', 'gongjian', 'yibing'];",
    "var TROOP_ORDER = ['tieji', 'qingji', 'changqiang', 'daodun', 'gongjian', 'yibing'];\n"
    "if (MODE === 'span') TROOP_ORDER = ['qingji', 'tieji', 'changqiang', 'daodun', 'gongjian', 'yibing'];   /* v89.101：城流跨越以轻骑为主力 */\n"
    "if (MODE === 'span') RUN('\U0001F9EA SPAN 模式：城流跨越（筑城无上限 + 轻骑批量成军 + 军链抢建）');",
    'TROOP_ORDER span')

# ② SPAN 函数块（插在“主循环”标题前）
BLOCK = '''/* ============================================================
 * v89.101 · 城流跨越（span）—— 老板「轻骑兵是事实，铁骑兵是不是？
 *   开拓四维，用寻找漏洞的方式寻求跨越式的、不可逆的发展」
 * ① spanCities：占平原 → 即时筑城（实测无上限 · 附近 1233 块可筑平原）
 * ② spanCav：轻骑批量成军（选粮最厚的城，一次募到该城上限）
 * ③ spanMil：军链抢建（军营→5 / 马厩→3 / 书院→6，骑兵门票）
 * ============================================================ */
var SPAN = { maxCity: 9, cityLast: -1e9, cavLast: -1e9, milLast: -1e9 };
function spanCities() {
  if (st.cities.length >= SPAN.maxCity) return;
  if (tNow - SPAN.cityLast < 420) return;
  SPAN.cityLast = tNow;
  var busy = (st.marches || []).some(function (m) { return m.target && m.target.kind === 'wild'; });
  if (busy) return;
  var g = ensurePlainForCity('spanCity');
  if (!g.have) return;
  setCity(st.cities[0]);
  var r = safeCall('span.build', function () { return G.buildCityAt(g.w.x, g.w.y); });
  if (r && r.ok) RUN('\U0001F3EF 城流：筑「' + r.city.name + '」（第 ' + st.cities.length + ' 城 · 建造并行 ' + (st.cities.length * 3) + ' 条）');
  if (r && !r.ok) noteSoft('span.build', r.msg);
}
function spanCav() {
  if (tNow - SPAN.cavLast < 300) return;
  SPAN.cavLast = tNow;
  var best = null, bg = -1, bCap = 0;
  st.cities.forEach(function (c) {
    var jy = cellOf(c, 'junying');
    if (!jy) return;
    setCity(c);
    var okc = false;
    try { okc = (G.canTrain('qingji') || {}).ok; } catch (e) {}
    if (!okc) return;
    var cap = 0;
    try { cap = G.maxTrainCount('qingji', c.id, jy.idx) || 0; } catch (e) {}
    if (!(cap > 0)) return;
    var g = (G.res(c).grain || 0);
    if (g > bg) { bg = g; best = c; bCap = cap; }
  });
  if (!best || !(bCap > 0)) return;
  var jy2 = cellOf(best, 'junying');
  var n = Math.min(bCap, 4000);
  setCity(best);
  var r = safeCall('span.cav', function () { return G.train('qingji', n, best.id, jy2.idx); });
  if (r && r.ok) RUN('\U0001F40E 轻骑成军：' + best.name + ' 一次 ×' + n + '（该城上限 ' + bCap + '）');
  else if (r && !r.ok) noteSoft('span.cav', r.msg);
}
function spanMil() {
  if (tNow - SPAN.milLast < 600) return;
  SPAN.milLast = tNow;
  var c = st.cities[0];
  [['junying', 5], ['majiu', 3], ['shuyuan', 6]].forEach(function (p) {
    var bid = p[0], want = p[1];
    if (G.buildingLevel(c, bid) >= want) return;
    var idx = -1;
    (c.cells || []).forEach(function (cc, i) { if (idx < 0 && cc.build && cc.build.id === bid) idx = i; });
    if (idx < 0) return;
    setCity(c);
    var r = safeCall('span.mil.' + bid, function () { return G.upgradeAt(c.id, idx); });
    if (r && r.ok) RUN('\u2694\uFE0F 军链抢建：' + bid + ' Lv' + G.buildingLevel(c, bid) + ' → 目标 Lv' + want);
  });
}

/* ---------- 9. 主循环 ---------- */'''
rep('/* ---------- 9. 主循环 ---------- */', BLOCK, 'SPAN block')

# ③ 主循环挂载
rep("    safeCall('b.milestones', execMilestones);",
    "    safeCall('b.milestones', execMilestones);\n"
    "    if (MODE === 'span') {\n"
    "      safeCall('b.spanCity', spanCities);\n"
    "      safeCall('b.spanCav', spanCav);\n"
    "      safeCall('b.spanMil', spanMil);\n"
    "    }",
    'main loop span hooks')

# ④ goldTrainRush 保留线下调
rep("  var minKeep = GOLD.reserve + 100000;  /* v89.98b：60 万 → 10 万 */",
    "  var minKeep = GOLD.reserve + 100000;  /* v89.98b：60 万 → 10 万 */\n"
    "  if (MODE === 'span') minKeep = GOLD.reserve + 40000;   /* v89.101：城流跨越——骑兵批量不被保留线压住 */",
    'span minKeep')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written（%d 处替换）' % N[0])
