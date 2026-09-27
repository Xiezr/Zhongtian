# -*- coding: utf-8 -*-
"""v89.163 补丁 A：data.js 征兵时长压缩
   步兵（inf）全部 ≤60 游戏秒 · 骑兵（cav）全部 ≤300 游戏秒（按原排序 + 取整到 5 秒）
   按**行**处理（id 定位行 → 行内替换 time），每步校验"""
import io

R = 'E:/Deepseekdb/'
p = 'js/data.js'
s = io.open(R + p, 'r', encoding='utf-8', newline='').read()
if 'v89.163（老板「缩减征兵时长' in s:
    print('skip：已改')
    raise SystemExit(0)

# ══════════ ① 注释块（DATA.TROOPS 之前） ══════════
ANCHOR = "  DATA.TROOPS = {"
NOTE = """  /* ============================================================
   * v89.163（老板「缩减征兵时长，步兵1分钟以内，骑兵5分钟以内」）
   * ------------------------------------------------------------
   * `time` = **单兵训练时长（游戏秒）** —— 兵种卡面「单兵耗时」显示的就是它
   * （U.dur(t.time)）；一批的训练总时长 = time × 数量 ÷（科技/守将/专精等加速）。
   * 本轮按**原排序**压缩并取整到 5 秒：步兵（cat:'inf'）全部 ≤ 60（1 分钟）、
   * 骑兵（cat:'cav'，含辎重车/象兵）全部 ≤ 300（5 分钟）。
   * 器械（床弩/冲车/投石车，craft）不属"征兵"，时间未动。
   * 换算参考：120× 下练 100 个弓箭手 = 60×100÷120 = 50 现实秒（≤1 分钟）。
   * ============================================================ */
  DATA.TROOPS = {"""
assert s.count(ANCHOR) == 1
s = s.replace(ANCHOR, NOTE)

# ══════════ ② 逐兵种（行内替换） ══════════
CHANGES = [
    ('yibing', 20, 10),            # 义兵
    ('minfu', 40, 15),             # 民夫
    ('chihou', 90, 20),            # 斥候
    ('qingzhoubing', 115, 25),     # 青州兵
    ('changqiang', 140, 30),       # 长枪兵
    ('tengjiabing', 170, 35),      # 藤甲兵
    ('daodun', 210, 40),           # 刀盾兵
    ('gongjian', 340, 60),         # 弓箭手
    ('tuqibing', 270, 60),         # 突骑兵
    ('hubaoqi', 385, 70),          # 虎豹骑
    ('qingji', 480, 80),           # 轻骑兵
    ('zhouche', 970, 110),         # 辎重车
    ('xiliangtieqi', 1160, 125),   # 西凉铁骑
    ('tieji', 1450, 150),          # 铁骑兵
    ('nanjiangxiangbing', 3500, 300),  # 南疆象兵
]
lines = s.split('\n')
for tid, old, new in CHANGES:
    hit = -1
    for i, ln in enumerate(lines):
        if ("id: '" + tid + "'") in ln:
            hit = i
            break
    assert hit >= 0, tid + ' 行未找到'
    o = 'time: %d,' % old
    n = 'time: %d,' % new
    assert lines[hit].count(o) == 1, '%s 行内 %s 计数=%d' % (tid, o, lines[hit].count(o))
    lines[hit] = lines[hit].replace(o, n)
s = '\n'.join(lines)
io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
print('15 个兵种 time 已改 · 注释已加')
