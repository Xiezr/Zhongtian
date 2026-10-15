# -*- coding: utf-8 -*-
"""v89.197 批次B：据点等级分布改权重表（老板 2：5级以上占80% · 等级越高比例越高）
① data.js：levelDist → weights 表（3/4/5/8 + 10/12/13/14/15/16）
② map.js：_fortLevelTable 改按累计占比边界切段（构造性不变）
③ smoke-test.js：三条旧断言按新口径重写（配置 / 配额成立 / 逐日重掷）
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(p, tag, old, new, mark, cnt=1):
    s = rd(p)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + ' (expect ' + str(cnt) + ')'
    wr(p, s.replace(old, new))
    print('[ok] ' + tag)

# ══════════ ① data.js ══════════
rep('js/data.js', 'B1 levelDist 权重表',
    u"""    /* v89.88（老板需求 3）：等级分布 —— 8/9/10 各 `highPct`（合计 90%），
       1~7 级合计 `lowPct` 均分。**构造性配额**（全图按当日哈希排序切段，
       不是掷点 —— v89.72 的教训：掷点占比不成立）。 */
    levelDist: { high: [8, 9, 10], highPct: 0.30, lowPct: 0.10 },""",
    u"""    /* v89.197（老板 2）：「据点等级改为5级以上占百分之八十，等级越高比例越高」——
       分布改**权重表**（构造性配额：全图按当日哈希排序、以累计占比边界切段；
       仍不掷点 —— v89.72 的教训：掷点占比不成立）：
       Lv1:3% · Lv2:4% · Lv3:5% · Lv4:8%（合计 20%）；
       Lv5:10% · Lv6:12% · Lv7:13% · Lv8:14% · Lv9:15% · Lv10:16%（合计 80%）。
       ——"5 级以上占 80%"与"等级越高占比越大"两条都由本表唯一保证；
       调分布只改这张表（占比方案即数据本身）。 */
    levelDist: { weights: { 1: 3, 2: 4, 3: 5, 4: 8, 5: 10, 6: 12, 7: 13, 8: 14, 9: 15, 10: 16 } },""",
    'v89.197（老板 2）：「据点等级改为5级以上占百分之八十')

# ══════════ ② map.js ══════════
rep('js/map.js', 'B2 切段实现',
    u"""    var D = F.levelDist || { high: [8, 9, 10], highPct: 0.30 };
    var highs = (D.high || [8, 9, 10]).slice();
    /* 排序键先算好再排序（比较器里现算哈希 = 每次比较两个闭包，20k 规模直接卡顿） */
    var arr = GAME.map._fortCandidates().map(function (k) {
      return { k: k, r: GAME.map._fortHash(k % W, (k / W) | 0, 9001 + day) };
    });
    arr.sort(function (a, b) { return a.r - b.r; });
    var n = arr.length, map = {};
    var nTop = Math.round(n * (D.highPct == null ? 0.30 : D.highPct));
    var idx = 0, i, k;
    for (i = 0; i < highs.length; i++) {
      var end = Math.min(n, idx + nTop);
      for (; idx < end; idx++) { k = arr[idx].k; map[k] = highs[i]; }
    }
    /* 低档：剩余名额均分到 levelMin ~（高档最低 - 1）—— 轮转分配保证均匀 */
    var lows = [];
    for (var lv = F.levelMin; lv < highs[0]; lv++) lows.push(lv);
    if (lows.length) {
      for (i = 0; idx < n; idx++, i++) { k = arr[idx].k; map[k] = lows[i % lows.length]; }
    } else {
      for (; idx < n; idx++) { k = arr[idx].k; map[k] = F.levelMin; }
    }""",
    u"""    /* v89.197（老板 2）：「5 级以上占 80% · 等级越高比例越高」——
       按**累计占比边界**逐级切段（构造性：排序后切段，不是掷点；v89.72 教训）。
       边界 = round(n × 累计权重 / 总权重)，最后一级吃满 —— 总数恒 = 候选数；
       各档占比与权重表逐级一致（smoke 有逐级 ±0.003 判据）。 */
    var Wt = (F.levelDist && F.levelDist.weights) || null;
    /* 排序键先算好再排序（比较器里现算哈希 = 每次比较两个闭包，20k 规模直接卡顿） */
    var arr = GAME.map._fortCandidates().map(function (k) {
      return { k: k, r: GAME.map._fortHash(k % W, (k / W) | 0, 9001 + day) };
    });
    arr.sort(function (a, b) { return a.r - b.r; });
    var n = arr.length, map = {}, idx = 0, k;
    if (Wt) {
      var tot = 0, lv;
      for (lv in Wt) tot += (Wt[lv] || 0);
      var levels = Object.keys(Wt).map(Number).sort(function (a, b) { return a - b; });
      var cum = 0;
      levels.forEach(function (lv2, li) {
        cum += (Wt[lv2] || 0);
        var end = (li === levels.length - 1) ? n : Math.min(n, Math.round(n * cum / tot));
        for (; idx < end; idx++) { k = arr[idx].k; map[k] = lv2; }
      });
    } else {
      /* 表缺失兜底：全 levelMin（防手抖；正常永不走到 —— smoke 断表在册） */
      for (; idx < n; idx++) { map[arr[idx].k] = F.levelMin; }
    }""",
    'B2 切段实现：累计占比边界')

# ══════════ ③ smoke-test.js 三条断言 ══════════
rep('smoke-test.js', 'B3a 配置断言',
    u"""    check('v89.88（据点）：上限 10 · 分布配置（8/9/10 各 30% · 低档 10%）', (function () {
      var D = DATA.FORT;
      return D.levelMin === 1 && D.levelMax === 10
        && !!D.levelDist && D.levelDist.high.join(',') === '8,9,10' && D.levelDist.highPct === 0.30;
    })());""",
    u"""    /* v89.197（老板 2）规则变更所致：「5 级以上占 80%、等级越高比例越高」——
       旧口径（8/9/10 各 30% · 低档 10%）按权重表重写。 */
    check('§197（据点）：上限 10 · 分布权重表（5级+合计 80% · 逐级递增 · 1~4级合计 20%）', (function () {
      var D = DATA.FORT;
      if (!(D.levelMin === 1 && D.levelMax === 10 && !!D.levelDist && D.levelDist.weights)) return false;
      var W = D.levelDist.weights, sum = 0, lv;
      for (lv = 1; lv <= 10; lv++) { if (W[lv] == null) return false; sum += W[lv]; }
      var hi = 0, lo = 0;
      for (lv = 5; lv <= 10; lv++) hi += W[lv];
      for (lv = 1; lv <= 4; lv++) lo += W[lv];
      var inc = true;                                        /* 严格递增（等级越高占比越高） */
      for (lv = 2; lv <= 10; lv++) if (!(W[lv] > W[lv - 1])) inc = false;
      return Math.abs(hi / sum - 0.80) < 1e-9 && Math.abs(lo / sum - 0.20) < 1e-9 && inc;
    })());""",
    'B3a：§197（据点）：上限 10 · 分布权重表')

rep('smoke-test.js', 'B3b 配额断言',
    u"""    check('v89.88（据点）：全图配额精确成立（Lv8/9/10 各 30.0% · 1~7 合计 10%）', (function () {
      var cand = G.map._fortCandidates();
      if (!cand.length) return false;
      var day = G.questDayIndex ? G.questDayIndex() : 0;
      var tbl = G.map._fortLevelTable(day);
      var cnt = {}, n = cand.length;
      Object.keys(tbl).forEach(function (k) { cnt[tbl[k]] = (cnt[tbl[k]] || 0) + 1; });
      var ok = Math.abs(cnt[8] / n - 0.30) <= 0.002 && Math.abs(cnt[9] / n - 0.30) <= 0.002
        && Math.abs(cnt[10] / n - 0.30) <= 0.002;
      var low = 0, lows = [];
      for (var lv = 1; lv <= 7; lv++) { low += (cnt[lv] || 0); lows.push(cnt[lv] || 0); }
      ok = ok && Math.abs(low / n - 0.10) <= 0.002
        && (Math.max.apply(null, lows) - Math.min.apply(null, lows)) <= 1;
      c88 = { n: n, cnt: cnt };
      return ok;
    })(), c88 ? ('共 ' + c88.n + ' 座 · Lv8/9/10 = ' + c88.cnt[8] + '/' + c88.cnt[9] + '/' + c88.cnt[10]) : '无候选');""",
    u"""    check('§197（据点）：全图配额精确成立（5级+ 合计 80% · 逐级占比与权重表一致）', (function () {
      var cand = G.map._fortCandidates();
      if (!cand.length) return false;
      var day = G.questDayIndex ? G.questDayIndex() : 0;
      var tbl = G.map._fortLevelTable(day);
      var cnt = {}, n = cand.length;
      Object.keys(tbl).forEach(function (k) { cnt[tbl[k]] = (cnt[tbl[k]] || 0) + 1; });
      var W = DATA.FORT.levelDist.weights, tot = 0, lv;
      for (lv = 1; lv <= 10; lv++) tot += W[lv];
      var ok = true;
      for (lv = 1; lv <= 10; lv++) {                          /* 逐级 ±0.003（round 边界误差 ≤1 格） */
        if (Math.abs((cnt[lv] || 0) / n - W[lv] / tot) > 0.003) ok = false;
      }
      var hi = 0, lo2 = 0;
      for (lv = 5; lv <= 10; lv++) hi += (cnt[lv] || 0);
      for (lv = 1; lv <= 4; lv++) lo2 += (cnt[lv] || 0);
      ok = ok && Math.abs(hi / n - 0.80) <= 0.004 && Math.abs(lo2 / n - 0.20) <= 0.004;
      c88 = { n: n, cnt: cnt };
      return ok;
    })(), c88 ? ('共 ' + c88.n + ' 座 · 5级+ 合计 ' + (function () {
      var hi = 0; for (var lv = 5; lv <= 10; lv++) hi += (c88.cnt[lv] || 0); return (hi / c88.n * 100).toFixed(1) + '%';
    })() + ' · Lv10 = ' + c88.cnt[10]) : '无候选');""",
    'B3b：§197（据点）：全图配额精确成立')

rep('smoke-test.js', 'B3c 逐日重掷断言',
    u"""      var distOk = Math.abs(cnt[8] / n - 0.30) <= 0.002 && Math.abs(cnt[10] / n - 0.30) <= 0.002;""",
    u"""      var hi2 = 0;                                            /* v89.197：配额随日重掷同样成立 */
      for (var lv5 = 5; lv5 <= 10; lv5++) hi2 += (cnt[lv5] || 0);
      var distOk = Math.abs(hi2 / n - 0.80) <= 0.004 && Math.abs((cnt[10] || 0) / n - 0.16) <= 0.004;""",
    'B3c：配额随日重掷同样成立')

print('批次 B 完成')
