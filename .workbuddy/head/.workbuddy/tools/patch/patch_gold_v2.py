# -*- coding: utf-8 -*-
"""v89.91 patch v2：修黄金脑「购书过度购买」bug + 补日志。
1) goldBooks：按预算买 120 本/次 → 改「按需买 1 本 + 先用背包存货」
   （实测 bug：终局积压 570 本千古兵圣 = 2.28 亿金存货、报表失真）
2) goldHerbs：无适用对象时记日志（此前静默）
3) goldLine：并入内功支出
"""
import io
P = r'E:\Deepseekdb\.workbuddy\tools\playtest\gold_section.js'
s = io.open(P, encoding='utf-8', newline='').read()

def rep(old, new, tag, n=1):
    global s
    c = s.count(old)
    assert c == n, '锚点[%s] 命中 %d 次（预期 %d）' % (tag, c, n)
    s = s.replace(old, new, n)
    print('OK', tag)

# ① 购书循环重写
rep('''  var guard = 0;
  while (guard++ < 40) {
    var rich = richCity();
    var budget = (G.res(rich).gold || 0) - GOLD.reserve;
    if (budget < 60000) break;
    var tier = null;
    for (var i = 0; i < tiers.length; i++) { if (budget >= tiers[i][1]) { tier = tiers[i]; break; } }
    if (!tier) break;
    var qty = Math.min(120, Math.max(1, Math.floor(budget / tier[1])));
    var r = safeCall('gold.buy', function () { return G.doShopping(tier[0], qty); });
    if (!r || !r.ok) { if (r && !r.ok) noteSoft('gold.buyfail', r.msg); break; }
    var bought = r.bought || 0;
    if (bought <= 0) break;
    GOLD.spends.books += tier[1] * bought;
    var use = safeCall('gold.use', function () { return G.systems.useItemMany(tier[0], tgt.id, bought); });
    var used = (use && use.count) || 0;
    if (used <= 0) { if (use && !use.ok) noteSoft('gold.usefail', use.msg); break; }
    GOLD.booksUsed += used;
    gmlLv(tgt, tgt.level || 1);
    if (G.expBlocked(tgt)) break;                    /* 到顶 → 下一轮换人 */
  }''',
'''  var guard = 0;
  while (guard++ < 60) {
    var rich = richCity();
    var budget = (G.res(rich).gold || 0) - GOLD.reserve;
    if (budget < 45000) break;
    var tier = null;
    for (var i = 0; i < tiers.length; i++) { if (budget >= tiers[i][1]) { tier = tiers[i]; break; } }
    if (!tier) break;
    /* v2 修 bug：**按需购买（一次一本）** —— v1 按预算买 120 本/次，超出目标上限
       的部分全堆进背包（实测终局积压 570 本千古兵圣 = 2.28 亿金存货，报表失真）。
       现在：背包有同档存货先用存货；否则买 1 本 → 用 1 本 → 循环。 */
    var use = null;
    var bagN = st.items[tier[0]] || 0;
    if (bagN > 0) {
      use = safeCall('gold.use', function () { return G.systems.useItemMany(tier[0], tgt.id, 1); });
    } else {
      var r = safeCall('gold.buy', function () { return G.doShopping(tier[0], 1); });
      if (!r || !r.ok) { if (r && !r.ok) noteSoft('gold.buyfail', r.msg); break; }
      var bought = r.bought || 0;
      if (bought <= 0) break;
      GOLD.spends.books += tier[1] * bought;
      use = safeCall('gold.use', function () { return G.systems.useItemMany(tier[0], tgt.id, bought); });
    }
    var used = (use && use.count) || 0;
    if (used <= 0) { if (use && !use.ok) noteSoft('gold.usefail', use.msg); break; }
    GOLD.booksUsed += used;
    gmlLv(tgt, tgt.level || 1);
    if (G.expBlocked(tgt)) break;                    /* 到顶 → 下一轮换人 */
  }''', 'B1')

# ② 升档无对象记日志
rep('''      if (!tgt) break;
      var r = safeCall('gold.rankup', function () { return G.systems.useItem(hid, tgt.id); });''',
    '''      if (!tgt) { noteSoft('gold.herbno', hid + '：无适用资质的将领（from=' + item.from + '）'); break; }
      var r = safeCall('gold.rankup', function () { return G.systems.useItem(hid, tgt.id); });''', 'B2')

# ③ 状态行并入内功
rep("""    + ' · 提速 建' + fmtNum(GOLD.spends.build) + '/科' + fmtNum(GOLD.spends.tech) + '/兵' + fmtNum(GOLD.spends.train)""",
    """    + ' · 提速 建' + fmtNum(GOLD.spends.build) + '/科' + fmtNum(GOLD.spends.tech) + '/兵' + fmtNum(GOLD.spends.train) + '/内功' + fmtNum(GOLD.spends.neigong)""", 'B3')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE gold_section.js', len(s))
