# -*- coding: utf-8 -*-
"""v89.99-G 脑校准（幂等）：体力药剂改"备弹制度" —— 围攻波次上限的最后一根钉子"""
import io, sys
R = 'E:/Deepseekdb/'
P = R + '.workbuddy/tools/playtest/play_rush_1x.js'
s = io.open(P, encoding='utf-8').read()
if '备弹制度' in s:
    print('SKIP 备弹'); sys.exit(0)
old = """  var rich = richCity();
  /* v89.99：体力 = 围攻的燃料（1× 实测：15 波 0 下城的根因就是这里空转）——
     金过 5 万就该给体力让路（绝对门槛，不挂保留线）。 */
  if ((G.res(rich).gold || 0) < 50000) return false;
  setCity(rich);
  var b = safeCall('rush.staBuy', function () { return G.doShopping('dahuandan', 1); });
  if (!b || !b.ok) return false;
  var u = safeCall('rush.staUse', function () { return G.systems.useItem('dahuandan', gen.id); });"""
new = """  var rich = richCity();
  /* v89.99：体力 = 围攻的燃料（1× 实测：波次上限被"药门槛"卡死 —— 全跑只买到 1 颗，
     围攻被自然再生压到 ~7 小时/波）。改**备弹制度**：
       · 金 ≥6 万 → 囤到 5 颗（每颗 3,000 金 = 8 波体力，效率远超任何别的花法）；
       · 否则金 ≥1.2 万 → 随用随买 1 颗（4 倍于药价的应急底，不再空转）。 */
  var havePill = st.items['dahuandan'] || 0;
  if (havePill <= 0) {
    if ((G.res(rich).gold || 0) < 12000) return false;
    var wantPill = (G.res(rich).gold || 0) >= 60000 ? 5 : 1;
    setCity(rich);
    var b = safeCall('rush.staBuy', function () { return G.doShopping('dahuandan', wantPill); });
    if (!b || !b.ok) return false;
  } else {
    setCity(rich);
  }
  var u = safeCall('rush.staUse', function () { return G.systems.useItem('dahuandan', gen.id); });"""
if old not in s:
    print('MISS 备弹'); sys.exit(1)
s = s.replace(old, new, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK 备弹制度')
