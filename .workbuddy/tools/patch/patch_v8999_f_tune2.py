# -*- coding: utf-8 -*-
"""v89.99-F 脑校准（幂等）：体力药剂门槛 —— 围攻的燃料优先于金（条件驱动）"""
import io, sys
R = 'E:/Deepseekdb/'
P = R + '.workbuddy/tools/playtest/play_rush_1x.js'
s = io.open(P, encoding='utf-8').read()
if '金过 5 万就该给体力让路' in s:
    print('SKIP 体力门槛')
    sys.exit(0)
old = """  if ((G.res(rich).gold || 0) < GOLD.reserve + 30000) return false;   /* v89.98b：3 万即用（体力比金贵） */"""
new = """  /* v89.99：体力 = 围攻的燃料（1× 实测：15 波 0 下城的根因就是这里空转）——
     金过 5 万就该给体力让路（绝对门槛，不挂保留线）。 */
  if ((G.res(rich).gold || 0) < 50000) return false;"""
if old not in s:
    print('MISS 体力门槛'); sys.exit(1)
s = s.replace(old, new, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK 体力门槛 → 5 万')
