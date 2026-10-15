# -*- coding: utf-8 -*-
"""patch_v89101_f_span3.py — v89.101c 城流跨越 · 二校准
根因（实测）：
  ① 建造队列字段是 **gridIndex**（不是 idx）→ 军链提速查询恒为 null，从未生效
  ② queueRushPay 实测只要 900 金/次（Lv1 建筑）→ 阈值 45000 过高，降到 12000
  ③ span 没接"生产宝物"线（buffProd 门没有 span）→ 经济/金流弱于 rush
  ④ goldTrainRush 保留线再降（骑兵批量不应被压）
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


# ① gridIndex 修正 + 阈值下调 + 失败诊断
rep("    if (r && r.ok && (G.res(c).gold || 0) >= 45000) {\n"
    "      /* v89.101b：军链金提速（实测 junying Lv2→3 卡了 3.2 游戏年） */\n"
    "      var qb = null;\n"
    "      (st.queues.build || []).forEach(function (x) { if (!qb && x.cityId === c.id && x.idx === idx) qb = x; });\n"
    "      if (qb) {\n"
    "        var pay = safeCall('span.mil.pay', function () { return G.queueRushPay(qb, '工程'); });\n"
    "        if (pay && pay.ok) RUN('军链提速：' + bid + ' 花金完工');\n"
    "      }\n"
    "    }",
    "    if (r && r.ok && (G.res(c).gold || 0) >= 12000) {\n"
    "      /* v89.101c：军链金提速 —— 队列字段实测为 **gridIndex**（不是 idx）；单次仅 ~900 金 */\n"
    "      var qb = null;\n"
    "      (st.queues.build || []).forEach(function (x) { if (!qb && x.cityId === c.id && x.gridIndex === idx) qb = x; });\n"
    "      if (qb) {\n"
    "        var pay = safeCall('span.mil.pay', function () { return G.queueRushPay(qb, '工程'); });\n"
    "        if (pay && pay.ok) RUN('军链提速：' + bid + ' 花金完工');\n"
    "        else if (pay && !pay.ok) noteSoft('span.mil.pay', pay.msg);\n"
    "      }\n"
    "    }",
    'gridIndex + threshold 12000')

# ② buffProd 门加 span（生产宝物 → 经济/金流）
rep("    if (MODE === 'buff' || MODE === 'all' || MODE === 'rush') {\n"
    "      safeCall('b.buffCorvee', buffCorvee);",
    "    if (MODE === 'buff' || MODE === 'all' || MODE === 'rush' || MODE === 'span') {\n"
    "      safeCall('b.buffCorvee', buffCorvee);",
    'buff gate + span')

# ③ goldTrainRush 保留线再降
rep("  if (MODE === 'span') minKeep = GOLD.reserve + 40000;   /* v89.101：城流跨越——骑兵批量不被保留线压住 */",
    "  if (MODE === 'span') minKeep = GOLD.reserve + 15000;   /* v89.101c：骑兵批量不被保留线压住 */",
    'span minKeep 15000')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written（%d 处替换）' % N[0])
