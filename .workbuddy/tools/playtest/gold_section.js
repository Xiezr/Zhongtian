/* ============================================================
 * v89.91 GOLD 策略脑（旧币流对照）—— 与种田基线 play_600x.js 的唯一差异
 * ------------------------------------------------------------
 * 老板假说：旧币换批招高资质 → 旧币买经验书升将 → 用光自由点 →
 *           旧币提速（建造/生产/募兵）→ 增长应是指数级。
 * 本段如实实现该策略，全部走游戏既有出口（不新增任何游戏规则）：
 *   goldSell   全资源溢出套现（基线只卖粮）     → GAME.marketSell
 *   goldInn    酒馆花旧币换批直到出进化体           → GAME.innReroll + innAuto（门槛=进化体）
 *   goldBooks  最优档经验书喂「高潜将」         → GAME.doShopping + systems.useItemMany
 *   goldPoints 用光全部自由点                   → GAME.addFreePoint
 *   goldRush   建造/科技队列花旧币立成            → GAME.queueRushPay
 *   goldTrainRush 募兵队列花旧币买时间            → GAME.trainRush
 *   goldGuards 各城守将 = 本城最高治理者        → GAME.assignGeneral
 *   goldHerbs  灵草升档（给高潜将）             → systems.useItem（rank_up 分支）
 *   goldNeigong 守卫修内功（治理 +6/重）        → GAME.doShopping + systems.useItem
 *   goldLord   君主练功 + 突破                  → GAME.doLordTrain / doLordBreak
 * ============================================================ */
var GOLD = {
  version: 'GOLD v1',
  reserve: 300000,                                  /* 旧币保留下限（不动） */
  spends: { inn: 0, books: 0, build: 0, tech: 0, train: 0, neigong: 0 },
  rerolls: 0, recruits: 0, booksUsed: 0,
  salesCount: 0, goldSold: 0, freePts: 0,
  milestones: {}
};
function gml(id, s) { if (GOLD.milestones[id]) return; GOLD.milestones[id] = 1; RUN('🏆 ' + s); }
function maxGenLv() { var m = 0; (st.generals || []).forEach(function (g) { if ((g.level || 1) > m) m = g.level || 1; }); return m; }
function rankIdxOf(g) { return G.rankIndex(G.rankOf(g).id); }
function eliteCount() { var n = 0; (st.generals || []).forEach(function (g) { if (rankIdxOf(g) >= 2) n++; }); return n; }
function richCity() {
  var best = st.cities[0], bg = -1;
  st.cities.forEach(function (c) { var g = G.res(c).gold || 0; if (g > bg) { bg = g; best = c; } });
  setCity(best); return best;
}
function guardNzOf(g) { return Math.round((G.genAttrs(g) || {}).nz || 0); }

/* ---------- ① 全资源溢出套现（粮木石铁，基线只卖粮） ---------- */
var GS_LAST = -1e9;
function goldSell() {
  if (tNow - GS_LAST < 120) return;
  GS_LAST = tNow;
  var buf = { grain: 500000, wood: 250000, stone: 250000, iron: 350000 };
  st.cities.forEach(function (city) {
    setCity(city);
    ['grain', 'wood', 'stone', 'iron'].forEach(function (r) {
      var s0 = (G.res(city)[r] || 0);
      var over = s0 - buf[r];
      if (over < 60000) return;
      var amt = Math.min(over, 5000000);
      var gg = 0; try { gg = G.marketSellGold(r, amt); } catch (e) {}
      var rr = safeCall('gold.sell', function () { return G.marketSell(r, amt); });
      if (rr && rr.ok) { GOLD.salesCount++; GOLD.goldSold += gg; }
      else if (rr && !rr.ok) noteSoft('gold.sellfail', rr.msg);
    });
  });
  richCity();
}

/* ---------- ② 酒馆：花旧币换批 → 自动招进化体 ---------- */
var GI_LAST = -1e9;
function goldInn() {
  if (tNow - GI_LAST < 90) return;
  GI_LAST = tNow;
  var cfg = G.innAutoCfg();
  cfg.on = true;
  cfg.min = (GOLD.recruits < 6 && yNow() < 120) ? 'ying' : 'liang';
  st.cities.slice().sort(function (a, b) { return (G.res(b).gold || 0) - (G.res(a).gold || 0); })
    .forEach(function (city) {
      if ((G.innLevel(city) || 0) < 6) return;        /* 酒馆太低不出货，等升上来 */
      if (G.genFreeOf(city) <= 0) return;
      setCity(city);
      var budget = Math.min((G.res(city).gold || 0) - 200000, 450000);
      var guard = 0;
      while (guard++ < 80) {
        if (G.genFreeOf(city) <= 0) break;
        var cost = G.innRefreshCost();
        if (budget < cost || (G.res(city).gold || 0) < cost + 100000) break;
        var before = (st.stats && st.stats.recruited) || 0;
        var r = safeCall('gold.innReroll', function () { return G.innReroll(); });
        if (!r || !r.ok) { if (r && !r.ok) noteSoft('gold.inn.fail', r.msg); break; }
        GOLD.rerolls++; GOLD.spends.inn += cost; budget -= cost;
        if (((st.stats && st.stats.recruited) || 0) > before) {
          GOLD.recruits++;
          var ng = st.generals[st.generals.length - 1];
          if (ng) {
            noteSoft('gold.recruit', '酒馆录用 ' + ng.name + '（' + G.rankOf(ng).name + '）');
            if (rankIdxOf(ng) >= 2) gml('firstElite', '酒馆录得高资质：' + ng.name + '（' + G.rankOf(ng).name + '）');
          }
        }
      }
    });
  richCity();
}

/* ---------- ③ 经验书：喂「高潜将」（资质优先 → 守将 → 等级） ---------- */
var GB_LAST = -1e9;
function goldBookTarget() {
  var list = (st.generals || []).filter(function (g) { return !g.isLord; });
  list.sort(function (a, b) {
    var ra = rankIdxOf(a), rb = rankIdxOf(b);
    if (ra !== rb) return rb - ra;
    var ga = (a.status === 'guard') ? 1 : 0, gb = (b.status === 'guard') ? 1 : 0;
    if (ga !== gb) return gb - ga;
    return (b.level || 1) - (a.level || 1);
  });
  for (var i = 0; i < list.length; i++) {
    if (rankIdxOf(list[i]) < 1) continue;            /* 凡品不喂 */
    if (G.expBlocked(list[i])) continue;
    return list[i];
  }
  var lord = G.lordGeneralOf ? G.lordGeneralOf() : null;
  if (lord && !G.expBlocked(lord)) return lord;
  return null;
}
function gmlLv(g, lv) {
  [{ l: 60, t: '首位 Lv60' }, { l: 100, t: '首位 Lv100' }, { l: 140, t: '首位 Lv140（进化体满级）' },
   { l: 180, t: '首位 Lv180（觉醒体满级）' }, { l: 240, t: '首位 Lv240（天启体满级）' }].forEach(function (x) {
    if (lv >= x.l) gml('lv' + x.l, x.t + '：' + g.name + '（' + G.rankOf(g).name + '）Lv' + lv);
  });
}
function goldBooks() {
  if (tNow - GB_LAST < 60) return;
  GB_LAST = tNow;
  var tgt = goldBookTarget();
  if (!tgt) return;
  /* 档位按「每旧币经验」效率从高到低；买得起哪档用哪档（大宗优惠口径） */
  var tiers = [['bingsheng', 400000], ['taigong_bingshu', 330000], ['bingxian_yipian', 240000],
    ['mingjiang_xinchuan', 156000], ['dudu_bingfa', 84000], ['jiangjun_zhanlu', 45000]];
  var guard = 0;
  while (guard++ < 60) {
    var rich = richCity();
    var budget = (G.res(rich).gold || 0) - GOLD.reserve;
    if (budget < 45000) break;
    var tier = null;
    for (var i = 0; i < tiers.length; i++) { if (budget >= tiers[i][1]) { tier = tiers[i]; break; } }
    if (!tier) break;
    /* v2 修 bug：**按需购买（一次一本）** —— v1 按预算买 120 本/次，超出目标上限
       的部分全堆进背包（实测终局积压 570 本千古兵圣 = 2.28 亿旧币存货，报表失真）。
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
  }
}

/* ---------- ④ 自由点：全部用光（守将/高潜 → 治理；其余 → 武力） ---------- */
function goldPoints() {
  var list = (st.generals || []).filter(function (g) { return !g.isLord; });
  list.sort(function (a, b) {
    var ra = rankIdxOf(a), rb = rankIdxOf(b);
    if (ra !== rb) return rb - ra;
    return (b.level || 1) - (a.level || 1);
  });
  var groomed = {}, n = 0;
  for (var i = 0; i < list.length && n < 3; i++) {
    if (list[i].status !== 'guard') { groomed[list[i].id] = 1; n++; }
  }
  (st.generals || []).forEach(function (g) {
    var fp = Math.floor(g.freePts || 0);
    if (fp < 1) return;
    var stat = 'yw';
    if (!g.isLord && (g.status === 'guard' || groomed[g.id])) stat = 'nz';
    var r = safeCall('gold.pts', function () { return G.addFreePoint(g, stat, fp); });
    if (r && r.ok) GOLD.freePts += fp;
  });
}

/* ---------- ⑤ 队列旧币提速（建造 / 科技） ---------- */
function goldRush() {
  var rich = richCity();
  var minKeep = GOLD.reserve + 150000;
  (st.queues.build || []).slice().forEach(function (q) {
    if ((G.res(rich).gold || 0) < minKeep) return;
    var c = 0; try { c = G.queueRushCost(q); } catch (e) {}
    if (!(c > 0)) return;
    var r = safeCall('gold.rush', function () { return G.queueRushPay(q, '工程'); });
    if (r && r.ok) GOLD.spends.build += c;
  });
  var tq = (st.queues.tech || [])[0];
  if (tq && (G.res(rich).gold || 0) >= minKeep) {
    var c2 = 0; try { c2 = G.queueRushCost(tq); } catch (e) {}
    if (c2 > 0) {
      var r2 = safeCall('gold.rusht', function () { return G.queueRushPay(tq, '研究'); });
      if (r2 && r2.ok) GOLD.spends.tech += c2;
    }
  }
}

/* ---------- ⑥ 募兵花旧币买时间（高水位才动 —— 大兵力批次很贵） ---------- */
function goldTrainRush() {
  var rich = richCity();
  var minKeep = GOLD.reserve + 600000;
  st.cities.forEach(function (city) {
    if ((G.res(rich).gold || 0) < minKeep) return;
    var jy = cellOf(city, 'junying');
    if (!jy) return;
    var q = G.trainRunningOf(city.id, jy.idx, 'train');
    if (!q) return;
    var c = 0; try { c = G.trainRushCost(q, 1.0); } catch (e) {}
    if (!(c > 0)) return;
    var r = safeCall('gold.trush', function () { return G.trainRush(city.id, jy.idx, 1.0, 'train'); });
    if (r && r.ok) GOLD.spends.train += c;
  });
}

/* ---------- ⑦ 守将：本城最高治理者（带滞后带，防来回换） ---------- */
function goldGuards() {
  if ((st.generals || []).length < 3) return;
  st.cities.forEach(function (city) {
    var cur = G.guardGeneralOf(city);
    var best = null, bn = -1;
    (G.generalsIn(city) || []).forEach(function (g) {
      if (g.isLord) return;
      var okState = (g.status === 'idle') || (g.status === 'guard' && g.cityId === city.id);
      if (!okState) return;
      var nz = guardNzOf(g) * 1000 + (g.level || 1);
      if (nz > bn) { bn = nz; best = g; }
    });
    if (!best) return;
    if (cur && best.id === cur.id) return;
    var curScore = cur ? (guardNzOf(cur) * 1000 + (cur.level || 1)) : -1;
    if (cur && bn <= curScore + 5000) return;
    var r = safeCall('gold.guard', function () { return G.assignGeneral(best.id, 'guard', city.id); });
    if (r && r.ok) noteSoft('gold.guard', r.msg);
  });
}

/* ---------- ⑧ 灵草升档（基因实验室产；优先给守将/高等级） ---------- */
function goldHerbs() {
  ['tianshouguo', 'hualongshen', 'xisuizhi', 'yunlingcao'].forEach(function (hid) {
    var guard = 0;
    while ((st.items[hid] || 0) > 0 && guard++ < 20) {
      var item = G.systems.itemInfo(hid);
      if (!item) break;
      var tgt = null, bs = -1;
      (st.generals || []).forEach(function (g) {
        if (G.rankOf(g).id !== item.from) return;
        if (g.status === 'march' || g.status === 'gather') return;
        var sc = (g.level || 1) + ((g.status === 'guard') ? 1000 : 0);
        if (sc > bs) { bs = sc; tgt = g; }
      });
      if (!tgt) { noteSoft('gold.herbno', hid + '：无适用资质的英雄（from=' + item.from + '）'); break; }
      var r = safeCall('gold.rankup', function () { return G.systems.useItem(hid, tgt.id); });
      if (!r || !r.ok) { if (r && !r.ok) noteSoft('gold.rankupfail', r.msg); break; }
      gml('rankup1', '🧬 灵草升档：' + r.msg);
    }
  });
}

/* ---------- ⑨ 内功（守卫修尉缭子·治理 +6/重；君主修三略·武力 +6/重） ---------- */
var GNG_LAST = -1e9;
function goldNeigong() {
  if (tNow - GNG_LAST < 300) return;
  GNG_LAST = tNow;
  var pairs = [];
  st.cities.forEach(function (c) { var g = G.guardGeneralOf(c); if (g) pairs.push({ g: g, book: 'book_weiliu', ng: 'weiliu' }); });
  var lord = G.lordGeneralOf ? G.lordGeneralOf() : null;
  if (lord) pairs.push({ g: lord, book: 'book_sanlue', ng: 'sanlue' });
  pairs.forEach(function (p) {
    var g = p.g;
    if (g.ng && g.ng.id && g.ng.id !== p.ng) return; /* 已修他门，不转修 */
    var lv = (g.ng && g.ng.id === p.ng) ? (g.ng.lv || 0) : 0;
    var steps = 0, before = lv;
    while (lv < 10 && steps++ < 12) {
      var rich = richCity();
      if ((G.res(rich).gold || 0) < GOLD.reserve + 100000) break;
      var b = safeCall('gold.ngbuy', function () { return G.doShopping(p.book, 1); });
      if (!b || !b.ok) break;
      GOLD.spends.neigong += 16000;
      var u = safeCall('gold.nguse', function () { return G.systems.useItem(p.book, g.id); });
      if (!u || !u.ok) { if (u && !u.ok) noteSoft('gold.nguse', u.msg); break; }
      lv = (g.ng && g.ng.lv) || 0;
    }
    if (lv > before) noteSoft('gold.ng', '📖 ' + g.name + ' 内功「' + p.ng + '」→ ' + lv + ' 重');
  });
}

/* ---------- ⑩ 君主：练功 + 突破（段顶自动续升） ---------- */
var GL_LAST = -1e9;
function goldLord() {
  var lord = G.lordGeneralOf ? G.lordGeneralOf() : null;
  if (!lord) return;
  if (tNow - GL_LAST >= 120) {
    GL_LAST = tNow;
    if (G.staNow(lord) > DATA.STAMINA.base * 0.4) {
      var r1 = safeCall('gold.lordTrain', function () { return G.doLordTrain(); });
      if (r1 && !r1.ok) noteSoft('gold.lordTrain', r1.msg);
    }
  }
  var need = G.lordCultivNeed(lord);
  if (need != null && (lord.cultiv || 0) >= need) {
    var r2 = safeCall('gold.lordBreak', function () { return G.doLordBreak(); });
    if (r2 && r2.ok) gml('lordBreak' + G.lordBreaksOf(lord), '👑 君主突破：' + r2.msg);
  }
}

/* ---------- ⑪ 状态行 ---------- */
function goldLine() {
  return '💰 旧币流：累卖 ' + fmtNum(GOLD.goldSold) + ' 旧币/' + GOLD.salesCount + ' 笔'
    + ' · 书耗 ' + fmtNum(GOLD.spends.books) + '（' + GOLD.booksUsed + ' 本）'
    + ' · 换批 ' + GOLD.rerolls + ' 次/招 ' + GOLD.recruits + ' 人（进化体 ' + eliteCount() + '）'
    + ' · 提速 建' + fmtNum(GOLD.spends.build) + '/科' + fmtNum(GOLD.spends.tech) + '/兵' + fmtNum(GOLD.spends.train) + '/内功' + fmtNum(GOLD.spends.neigong)
    + ' · 最高将 Lv' + maxGenLv();
}
