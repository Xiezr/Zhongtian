# -*- coding: utf-8 -*-
"""v89184c —— 升级两条「训练提速」旧断言到 v89.179 BOOST_CAP 新口径。
背景：并行会话（代码复核修复）引入 BOOST_CAP（花金/宝物合并封顶 30%，自然至少留 70%），
两条旧断言（v89.49 口径：一次做完/越接近越便宜）未同步 → smoke 2 红。
本补丁只做「测试同步」（纯机械：期望值改成新口径实测值），不改任何机制代码。
实测依据：.workbuddy/tmp/_boostinv184.txt（rush(0.5)→el=3000/10000、boosted=3000、
再 rush 被拒「已达上限」、报价归零；宝物路径同规）。
纪律：幂等 guard；newline='' 写盘；写后 node --check + 立刻跑 smoke。
"""
import io, sys

P = 'smoke-test.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

if 'BOOST_CAP：花金最多削 30%' in s:
    print('ALREADY DONE — skip')
    sys.exit(0)

# ---------------- 1. 「结算扣金 + 缩短 + 封顶」断言 ----------------
old1 = """check('实测：结算扣金 + 缩短 + 封顶（不越 totalTime）· 越接近完工越便宜', (function () {
  var c = G.state.cities[0], s = G.state;
  var bkQ = s.queues.train.slice(), bkR = s.res.gold;
  s.queues.train = [];
  var idx = -1;
  c.cells.forEach(function (x, i) { if (x.build && x.build.id === 'junying') idx = i; });
  if (idx < 0) return true;
  s.res.gold = 9999999; s.res.pop = 999999;
  s.res.grain += 500000; s.res.wood += 500000; s.res.iron += 500000;
  G.train('yibing', 1000, c.id, idx);
  var q = G.trainRunningOf(c.id, idx, 'train');
  if (!q) { s.queues.train = bkQ; s.res.gold = bkR; return false; }
  var g0 = s.res.gold, cost = G.trainRushCost(q, 0.5), p1 = G.trainRushCost(q, 1);
  var r = G.trainRush(c.id, idx, 0.5, 'train');
  var q2 = G.trainRunningOf(c.id, idx, 'train');
  var ok = r.ok && s.res.gold === g0 - cost
    && q2.elapsed === Math.round(q.totalTime * 0.5)
    && G.trainRushCost(q2, 1) < p1                       /* 越接近完工越便宜 */
    && G.trainRush(c.id, idx, 1, 'train').ok
    /* 一次做完 = elapsed 顶到 totalTime（**不越界**）；出队由主循环扫走，故这里只断言完工 */
    && G.trainRunningOf(c.id, idx, 'train').elapsed === G.trainRunningOf(c.id, idx, 'train').totalTime;
  s.queues.train = bkQ; s.res.gold = bkR;
  return ok;
})());"""

new1 = """check('实测：结算扣金 + 缩短 + 额度封顶（v89.179 BOOST_CAP：花金最多削 30%，自然至少留 70%）', (function () {
  var c = G.state.cities[0], s = G.state;
  var bkQ = s.queues.train.slice(), bkR = s.res.gold;
  s.queues.train = [];
  var idx = -1;
  c.cells.forEach(function (x, i) { if (x.build && x.build.id === 'junying') idx = i; });
  if (idx < 0) return true;
  s.res.gold = 9999999; s.res.pop = 999999;
  s.res.grain += 500000; s.res.wood += 500000; s.res.iron += 500000;
  G.train('yibing', 1000, c.id, idx);
  var q = G.trainRunningOf(c.id, idx, 'train');
  if (!q) { s.queues.train = bkQ; s.res.gold = bkR; return false; }
  var CAP = DATA.BOOST_CAP || 0.3;
  var g0 = s.res.gold, cost = G.trainRushCost(q, 0.5);
  var r = G.trainRush(c.id, idx, 0.5, 'train');
  var q2 = G.trainRunningOf(c.id, idx, 'train');
  /* v89.179 新口径（实测 probe：1500/5000 或 3000/10000）：
     请求 50% → 被额度削到 30%（elapsed = totalTime × CAP）；跳过量记入 q.boosted；
     额度用满后再次提速被拒（不扣金、elapsed 不再变）。 */
  var ok = r.ok && s.res.gold === g0 - cost
    && Math.abs(q2.elapsed - q.totalTime * CAP) <= 1
    && Math.abs((q2.boosted || 0) - q.totalTime * CAP) <= 1
    && G.trainRush(c.id, idx, 1, 'train').ok === false
    && /已达上限/.test(G.trainRush(c.id, idx, 1, 'train').msg)
    && G.trainRunningOf(c.id, idx, 'train').elapsed === q2.elapsed;
  s.queues.train = bkQ; s.res.gold = bkR;
  return ok;
})());"""

assert s.count(old1) == 1, 'old1 count=' + str(s.count(old1))
s = s.replace(old1, new1)

# ---------------- 2. 「S._boost 三条分支封顶」结构断言 ----------------
old2 = """check('v89.49：顺带修复 —— S._boost 三条分支封顶（不再把 elapsed 顶过 totalTime）', (function () {
  var y = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'systems.js'), 'utf8'));
  var fn = codeOf(y, 'S._boost = function');
  var n = (fn.match(/Math\\.min\\(q\\.totalTime/g) || []).length;
  return n >= 1 && !/q\\.elapsed \\+=/ .test(fn);
})());"""

new2 = """check('v89.49/v89.179：S._boost 三条分支封顶（BOOST_CAP：capElapsed 收口，三分支各有额度守卫）', (function () {
  var y = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'systems.js'), 'utf8'));
  var fn = codeOf(y, 'S._boost = function');
  /* v89.179（BOOST_CAP）：封顶口径升级 —— capElapsed = totalTime × (1 − BOOST_CAP)（读表值），
     Math.min 收口；`q.elapsed +=` 裸加仍为 0；研究/建造/训练三条分支各有「已达上限」守卫。 */
  return /capElapsed/.test(fn) && /DATA\\.BOOST_CAP/.test(fn)
    && (fn.match(/Math\\.min\\(/g) || []).length >= 1
    && !/q\\.elapsed \\+=/.test(fn)
    && (fn.match(/已达上限/g) || []).length >= 3;
})());"""

assert s.count(old2) == 1, 'old2 count=' + str(s.count(old2))
s = s.replace(old2, new2)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('PATCH OK, len=', len(s))

# 自检
s2 = io.open(P, 'r', encoding='utf-8', newline='').read()
assert 'BOOST_CAP：花金最多削 30%' in s2 and 'capElapsed' in s2, 'new markers'
assert '越接近完工越便宜' not in s2, 'old1 title remains (should be gone)'
print('SELF-CHECK PASS')
