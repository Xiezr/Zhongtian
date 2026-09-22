# -*- coding: utf-8 -*-
"""v89.99-E 脑校准（幂等）：保留线回落 / 增民令绝对门槛 / 税制阈值 / 放人节流"""
import io, sys
R = 'E:/Deepseekdb/'
P = R + '.workbuddy/tools/playtest/play_rush_1x.js'
s = io.open(P, encoding='utf-8').read()
N = [0]
def rep(old, new, tag):
    global s
    if new in s:
        print('SKIP ' + tag); return
    if old not in s:
        print('MISS ' + tag); sys.exit(1)
    s = s.replace(old, new, 1); N[0] += 1
    print('OK   ' + tag)

# (a) 保留线：120k/60k/30k 全线下调（首测暴露"又锁死了"——金常年 1~6 万）
rep("""  var must = 30000;
  if (st.cities.length < 3) must = 120000;
  else if (maxGenLv() < 140) must = 60000;""",
"""  var must = 20000;
  if (st.cities.length < 3) must = 40000;      /* 筑城金 1 万 + 珠宝/启动 + 缓冲 */
  else if (maxGenLv() < 140) must = 30000;""",
'(a) 保留线下调')

# (b) 增民令：绝对可负担 + 未生效才买
rep("""  var rich = richCity();
  var gold = G.res(rich).gold || 0;
  if (gold < GOLD.reserve + 20000) return;
  var popTight = st.cities.length < 3 || totalArmy() < armyTarget();
  if (!popTight) return;""",
"""  if (G.popBoostMult() > 1) return;      /* 已有增民令效果：同类只取最强，重复=白花钱 */
  var rich = richCity();
  var gold = G.res(rich).gold || 0;
  /* 3000 金的道具：绝对可负担即可 —— **不挂保留线**（增速是复利型收益；
     保留线是给"必办大事"留的，不是给复利道具设的门）。 */
  if (gold < 15000) return;
  var popTight = st.cities.length < 3 || totalArmy() < armyTarget();
  if (!popTight) return;""",
'(b) 增民令门槛')

# (c) 税制：阈值 0.2 → 0.1；财政条件改绝对底线（原条件永不触发）
rep("""  if (wantTax < 0.5 && goldNow < GOLD.reserve + 30000) wantTax = 0.5;   /* 财政吃紧 → 先保金 */
  if (tNow - TAX_LAST > 3600 && Math.abs(st.tax - wantTax) >= 0.2) {""",
"""  if (wantTax < 0.5 && goldNow < 8000) wantTax = 0.5;   /* 现金见底 → 先保财政（条件翻转） */
  if (tNow - TAX_LAST > 3600 && Math.abs(st.tax - wantTax) >= 0.1) {""",
'(c) 税制阈值')

# (d) 放人节流（每 5 现实分钟最多一次，避免"募→散"高频churn）
rep("""var POPB_LAST = -1e9, TAX_LAST = -1e9;""",
"""var POPB_LAST = -1e9, TAX_LAST = -1e9, REL_LAST = -1e9;""",
'(d1) REL_LAST 声明')
rep("""  if (!(((G.res(st.cities[0]) || {}).pop) >= 60)) releaseBank(150, '募兵缺人');""",
"""  if (!(((G.res(st.cities[0]) || {}).pop) >= 60) && tNow - REL_LAST > 300) {
    REL_LAST = tNow;
    releaseBank(150, '募兵缺人');       /* v89.99：5 分钟一次上限 —— 放人是桥，不是常态 */
  }""",
'(d2) 放人节流')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('--- E 校准完成：%d 处 ---' % N[0])
