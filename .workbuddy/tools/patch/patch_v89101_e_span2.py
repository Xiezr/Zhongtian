# -*- coding: utf-8 -*-
"""patch_v89101_e_span2.py — v89.101b 城流跨越 · 校准版
首跑（span_1x）暴露三处瓶颈，本补丁逐一对齐（幂等 · 纯 ASCII 锚点）：
  ① spanMil 军链**金提速**：junying Lv2→3 实测卡 3.2 游戏年（建造队拥堵）
     → 抢建后立即 queueRushPay 花金买时间，把骑兵门票从 ~16 年压到开头几年
  ② spanCities 多城付款：单城（许都）资源不足卡住 85 次
     → 逐城试付，谁付得起谁出
  ③ spanCav 缺人时放人：骑兵解锁但人口为 0（实测 city0 pop=1）
     → releaseBank 解散义兵归农，把人口让给轻骑（"要特定兵种时解散改募"）
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


# ① spanMil 军链金提速
rep("    var r = safeCall('span.mil.' + bid, function () { return G.upgradeAt(c.id, idx); });",
    "    var r = safeCall('span.mil.' + bid, function () { return G.upgradeAt(c.id, idx); });\n"
    "    if (r && r.ok && (G.res(c).gold || 0) >= 45000) {\n"
    "      /* v89.101b：军链金提速（实测 junying Lv2→3 卡了 3.2 游戏年） */\n"
    "      var qb = null;\n"
    "      (st.queues.build || []).forEach(function (x) { if (!qb && x.cityId === c.id && x.idx === idx) qb = x; });\n"
    "      if (qb) {\n"
    "        var pay = safeCall('span.mil.pay', function () { return G.queueRushPay(qb, '工程'); });\n"
    "        if (pay && pay.ok) RUN('军链提速：' + bid + ' 花金完工');\n"
    "      }\n"
    "    }",
    'spanMil rush-pay')

# ② spanCities 多城付款
rep("  setCity(st.cities[0]);\n  var r = safeCall('span.build', function () { return G.buildCityAt(g.w.x, g.w.y); });",
    "  /* v89.101b：逐城试付 —— 首跑单城卡资源不足 85 次（石/铁见底） */\n"
    "  var r = null;\n"
    "  for (var i2 = 0; i2 < st.cities.length && !(r && r.ok); i2++) {\n"
    "    setCity(st.cities[i2]);\n"
    "    try { if (!G.canAfford(G.BUILD_CITY_COST)) continue; } catch (e) { continue; }\n"
    "    r = safeCall('span.build.' + st.cities[i2].name, function () { return G.buildCityAt(g.w.x, g.w.y); });\n"
    "  }",
    'spanCities multi-city pay')

# ③ spanCav 放人兜底
rep("  var best = null, bg = -1, bCap = 0;",
    "  var best = null, bg = -1, bCap = 0, anyUnlocked = false;",
    'spanCav anyUnlocked decl')
rep("    var okc = false;\n    try { okc = (G.canTrain('qingji') || {}).ok; } catch (e) {}\n    if (!okc) return;",
    "    var okc = false;\n    try { okc = (G.canTrain('qingji') || {}).ok; } catch (e) {}\n    if (!okc) return;\n    anyUnlocked = true;",
    'spanCav anyUnlocked set')
rep("  if (!best || !(bCap > 0)) return;",
    "  if (!best || !(bCap > 0)) {\n"
    "    /* v89.101b：骑兵解锁但缺人 → 解散义兵放人（要特定兵种时解散改募） */\n"
    "    if (anyUnlocked) safeCall('span.cav.rel', function () { return releaseBank(500, '轻骑待募·放人'); });\n"
    "    return;\n"
    "  }",
    'spanCav release fallback')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written（%d 处替换）' % N[0])
