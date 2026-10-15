# v89.142 C4：smoke-test.js —— 两条出口/规则行断言升级到 v89.142 口径
# 跑法：python .workbuddy/tools/patch/v89142_c4_smoke2.py
import io
P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89142/smoke-test.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

rep("""    check('③ 俘虏营两个出口都在册且真的可用（收编加人口 / 释放换声望）', (function () {
      var s = G.state, c = G.currentCity() || s.cities[0];
      var bk = { pop: G.res(c).pop, rep: s.rep, cap: s.captives };
      try {
        s.captives = { yibing: 100 };
        var before = G.res(c).pop;
        var r1 = GAME.doConscriptCaptives(c.id);
        var okPop = r1.ok && G.res(c).pop === before + 100 && GAME.captivesTotalOf() === 0;
        s.captives = { yibing: 100 };
        var rep0 = s.rep || 0;
        var r2 = GAME.doReleaseCaptives();
        return okPop && r2.ok && (s.rep || 0) === rep0 + r2.rep && GAME.captivesTotalOf() === 0;
      } finally { G.res(c).pop = bk.pop; s.rep = bk.rep; s.captives = bk.cap; }
    })());""",
"""    /* v89.142（老板 5）：收编 = **逐兵种转入本城军队 + 支金**（造价 50%）—— 人口与声望口径见下 */
    check('③ 俘虏营两个出口都在册且真的可用（收编入军+支金 / 释放换声望）', (function () {
      var s = G.state, c = G.currentCity() || s.cities[0];
      var bk = { pop: G.res(c).pop, gold: G.res(c).gold, rep: s.rep, cap: s.captives,
        army: JSON.parse(JSON.stringify(c.army || {})) };
      try {
        s.captives = { yibing: 100 };
        var plan = GAME.conscriptPlanOf();
        s.res.gold = plan.cost + 5000;
        var gold0 = s.res.gold, pop0 = G.res(c).pop;
        var men0 = GAME.battle.marchMenOf(c.army);
        var r1 = GAME.doConscriptCaptives(c.id);
        var okArmy = r1.ok && GAME.battle.marchMenOf(c.army) - men0 === 100
          && (gold0 - s.res.gold) === plan.cost
          && G.res(c).pop === pop0                                  /* 人口不动 */
          && GAME.captivesTotalOf() === 0;
        s.captives = { yibing: 100 };
        var rep0 = s.rep || 0;
        var r2 = GAME.doReleaseCaptives();
        return okArmy && r2.ok && (s.rep || 0) === rep0 + r2.rep && GAME.captivesTotalOf() === 0;
      } finally {
        G.res(c).pop = bk.pop; G.res(c).gold = bk.gold; s.rep = bk.rep; s.captives = bk.cap;
        c.army = bk.army;
      }
    })());""",
 's2-两出口')

rep("""    check('① 俘虏**规则行可见**（8% / 上限 3000 / 来源 / 收编口径，数字读 DATA.CAPTIVE）', (function () {
      var h = G.ui.campCard('captive');
      var rate = Math.round((D97.CAPTIVE.rate || 0.08) * 100);
      /* ⚠️ 数字一律走**同一出口**（U.numText：3000 → "3,000"）——
         首版拿 String(3000) 去 indexOf，被判据自己判错（白查一轮）。 */
      return h.indexOf(rate + '%') >= 0
        && h.indexOf(U.numText(D97.CAPTIVE.cap, 0)) >= 0
        && h.indexOf('收编为民') >= 0 && h.indexOf('释放') >= 0
        && /野地|据点|名城|守城得手/.test(h);
    })(), 'rate=' + Math.round(D97.CAPTIVE.rate * 100) + '% cap=' + D97.CAPTIVE.cap);""",
"""    check('① 俘虏**规则行可见**（8% / 上限 3000 / 来源 / 收编入军支金 50%，数字读 DATA.CAPTIVE）', (function () {
      var h = G.ui.campCard('captive');
      var rate = Math.round((D97.CAPTIVE.rate || 0.08) * 100);
      var pct = Math.round((D97.CAPTIVE.conscriptPct == null ? 0.5 : D97.CAPTIVE.conscriptPct) * 100);
      /* ⚠️ 数字一律走**同一出口**（U.numText：3000 → "3,000"）——
         首版拿 String(3000) 去 indexOf，被判据自己判错（白查一轮）。 */
      return h.indexOf(rate + '%') >= 0
        && h.indexOf(U.numText(D97.CAPTIVE.cap, 0)) >= 0
        && h.indexOf('收编入军') >= 0 && h.indexOf('释放') >= 0
        && h.indexOf(pct + '%') >= 0                     /* 支金比例 50% 可见 */
        && /野地|据点|名城|守城得手/.test(h);
    })(), 'rate=' + Math.round(D97.CAPTIVE.rate * 100) + '% cap=' + D97.CAPTIVE.cap);""",
 's2-规则行')

assert '\r\n' not in s
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}'))
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE smoke-test.js  len ' + str(len(bak)) + ' -> ' + str(len(s)))
