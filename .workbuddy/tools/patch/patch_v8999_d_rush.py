# -*- coding: utf-8 -*-
"""v89.99-D 推演脑：阶段自适应 + 人口银行 + 增民令/税制策略（幂等）

生成链：play_strat_600x.js →(patch_v8998_rush.py)→ play_rush_1x.js →(本脚本)→ 同上
本脚本直接作用于 play_rush_1x.js（后处理器；重复运行安全）。

老板批注原文：「代码岂能钉死，发展阶段不一样，面对的有利/不利条件可能发生转换」。
本补丁把 A3/A4 里"钉死"的四处全部改成**条件驱动**：
  1. amc.on 常关  → 两班将分权 + 军力 margin 条件（收割/收回自动翻转）
  2. 金保留线按年份档 → 按"在办目标的下一笔开销"（建城期/养将期/应急底）
  3. 税制固定 0.5 → 阶段+财政条件翻转（轻徭聚人 / 财政吃紧先保金）
  4. 新增人口银行（贴顶的增长存成义兵；募兵缺人时解散归农再募）
"""
import io, sys
R = 'E:/Deepseekdb/'
P = R + '.workbuddy/tools/playtest/play_rush_1x.js'
s = io.open(P, encoding='utf-8').read()
N = [0]
def rep(old, new, tag, must=True):
    global s
    if new in s:
        print('SKIP ' + tag); return
    if old not in s:
        if must: print('MISS ' + tag); sys.exit(1)
        print('miss(soft) ' + tag); return
    s = s.replace(old, new, 1); N[0] += 1
    print('OK   ' + tag)

# ---------- R1 amc 初始化注释 ----------
rep("""amc.everyMin = 5; amc.radius = 14; amc.dailyMax = 0;""",
"""amc.everyMin = 5; amc.radius = 14; amc.dailyMax = 0;
/* v89.99（老板「代码岂能钉死」）：amc.on **不再钉死** ——
   由 applyPolicies() 按阶段与条件动态翻转：军力有余量就放出去收割资源，
   吃紧或没有采集将可用就收回。执行将与围攻将**分班**（见 pickAmcGen）。 */""",
'R1 amc 注释')

# ---------- R2 pickSiegeGen 排除采集将 ----------
rep("""    if (g.isLord) return;                                    /* 君主不外出 */
    if (g.status === 'march' || g.status === 'gather' || g.status === 'guard') return;
    var s = G.staNow ? G.staNow(g) : (g.stamina || 0);""",
"""    if (g.isLord) return;                                    /* 君主不外出 */
    if (amc.genId && g.id === amc.genId) return;             /* v89.99：采集将不入围攻班（两班分权） */
    if (g.status === 'march' || g.status === 'gather' || g.status === 'guard') return;
    var s = G.staNow ? G.staNow(g) : (g.stamina || 0);""",
'R2 pickSiegeGen 排除采集将')

# ---------- R3 manageAutoMarch：只留"等级/兵力"两个旋钮 ----------
rep("""function manageAutoMarch() {
  var y = yNow();
  var wantLv = y < 2 ? 2 : y < 5 ? 4 : y < 15 ? 6 : y < 40 ? 7 : 8;
  var wantTroops = y < 0.5 ? 500 : y < 2 ? 2000 : y < 5 ? 5000 : y < 20 ? 10000 : y < 60 ? 20000 : 50000;
  if (amc.maxLevel !== wantLv) amc.maxLevel = wantLv;
  if (amc.troops !== wantTroops) amc.troops = wantTroops;
  var cur = null;
  (st.generals || []).forEach(function (g) { if (g.id === amc.genId) cur = g; });
  if (!cur) {
    var pick = null;
    (st.generals || []).forEach(function (g) {
      if (!pick && !g.isLord && g.status === 'idle') pick = g;
    });
    if (pick) { amc.genId = pick.id; noteSoft('automarch.gen', '自动出征执行将 → ' + pick.name); }
  }
}""",
"""function manageAutoMarch() {
  var y = yNow();
  var wantLv = y < 2 ? 2 : y < 5 ? 4 : y < 15 ? 6 : y < 40 ? 7 : 8;
  var wantTroops = y < 0.5 ? 500 : y < 2 ? 2000 : y < 5 ? 5000 : y < 20 ? 10000 : y < 60 ? 20000 : 50000;
  if (amc.maxLevel !== wantLv) amc.maxLevel = wantLv;
  if (amc.troops !== wantTroops) amc.troops = wantTroops;
  /* v89.99：执行将不再"随便抓一个空闲的"（那是 RUSH v89.98 的体力黑洞根源）——
     交给 applyPolicies 的两班分权：围攻将 / 采集将分开，互不抢体力。 */
}""",
'R3 manageAutoMarch 瘦身')

# ---------- R4 reserveNow：条件驱动 ----------
rep("""/* v89.98b：**金保留线自适应** —— 固定 30 万在 1×（金 10 万级）下把书/内功/丹/符/提速
   全部锁死（"金不足"其实是"门槛错"）。按游戏年分档，小规模时代用小额保留线。 */
function reserveNow() {
  var y = yNow();
  if (y < 3) return 10000;
  if (y < 8) return 30000;
  if (y < 20) return 80000;
  return 300000;
}""",
"""/* v89.99：**保留线 = 当前"在办目标"的下一笔开销**（条件驱动，不是年份档位）——
   建城期留筑城钱（含启动物资）；养将期留换书钱；两件都办完只剩应急底。
   金远超保留线时再压半 —— 避免"金多却被保留线锁住花不出去"（v89.98 的教训）。 */
function reserveNow() {
  var must = 30000;
  if (st.cities.length < 3) must = 120000;
  else if (maxGenLv() < 140) must = 60000;
  var gold = 0;
  try { gold = G.res(richCity()).gold || 0; } catch (e) {}
  if (gold > must * 3) must = Math.round(must * 0.5);
  return must;
}""",
'R4 reserveNow 条件化')

# ---------- R5 阶段引擎 + 人口银行 + 增民令（插在主循环之前） ----------
rep("""/* ---------- 9. 主循环 ---------- */""",
"""/* ============================================================
 * v89.99 · 阶段自适应引擎（老板：「代码岂能钉死，条件会转换」）
 * ------------------------------------------------------------
 * 三张总资源各有一个**条件驱动**的调度器（不是按年份钉死的档位）：
 *   ① 体力：两班将（围攻将 / 采集将）分开 —— 采集只吃主攻将之外的余量；
 *      军力不足 margin 时自动收回，充足时放出去收割（会溢出的恢复 → 资源）。
 *   ② 金：保留线 = 在办目标的下一笔开销（建城期 / 养将期 / 应急底，见 reserveNow）。
 *   ③ 人口：贴顶的增长"存"进义兵（**人口银行**）；募兵缺人时解散归农再募
 *      —— 对应老板「有人口就征义兵，避免人口停在顶端；要特定兵种时解散改募」。
 * 阶段（ERA）由**条件**判定（城数/等级/战果），切换即换规则（税制/打法/掠夺模式）。
 * ============================================================ */
var ERA = { id: 'E0', n: 0, log: [] };
var BANK = { joined: 0, released: 0, peak: 0 };
var POPB_LAST = -1e9, TAX_LAST = -1e9;

function eraNow() {
  var cityN = st.cities.length;
  var lv = maxGenLv();
  var siege = RUSH.siegeWin || 0;
  if (cityN >= 3 && lv >= 120) return 'E4';        /* 鼎立：书养将 */
  if (cityN >= 3) return 'E3';                      /* 三城：围攻+晋爵 */
  if (cityN >= 2 || siege >= 1) return 'E2';        /* 双城/首胜：人口银行开张 */
  if (yNow() >= 1.5) return 'E1b';                  /* 拓野 */
  return 'E1a';                                     /* 立足 */
}
function eraRuleOf(id) {
  var T = {
    E1a: { mode: 'occupy', tax: 0.35, bank: 0, note: '立足：占野地/换将；税轻聚人' },
    E1b: { mode: 'occupy', tax: 0.35, bank: 0, note: '拓野：围攻试点；自动出征只吃余量' },
    E2:  { mode: 'occupy', tax: 0.35, bank: 1, note: '奠基：双城/首胜；人口银行开张' },
    E3:  { mode: 'raid',   tax: 0.35, bank: 1, note: '三城：围攻+晋爵；转掠夺收割' },
    E4:  { mode: 'raid',   tax: 0.5,  bank: 1, note: '鼎立：书养将；财政转常规' },
  };
  return T[id] || T.E1a;
}
function bestSta(g) { return g ? (G.staNow ? G.staNow(g) : (g.stamina || 0)) : 0; }
/* 采集将：已指定的只要还能用就不换（避免两班将来回抢位）；否则挑一个非主攻将 */
function pickAmcGen(mg) {
  var cur = null;
  (st.generals || []).forEach(function (g) { if (g.id === amc.genId) cur = g; });
  if (cur && !cur.isLord && cur.status !== 'march' && cur.status !== 'guard'
    && (!mg || cur.id !== mg.id) && bestSta(cur) >= 20) return cur;
  var pick = null;
  (st.generals || []).forEach(function (g) {
    if (g.isLord) return;
    if (mg && g.id === mg.id) return;
    if (g.status === 'march' || g.status === 'gather' || g.status === 'guard') return;
    if (!pick || bestSta(g) > bestSta(pick)) pick = g;
  });
  return (pick && bestSta(pick) >= 30) ? pick : null;
}
function applyPolicies() {
  var er = eraNow();
  if (er !== ERA.id) {
    ERA.n++; ERA.id = er; ERA.log.push({ t: tNow, y: +yNow().toFixed(2), id: er });
    RUN('🚩 阶段切换 → ' + er + '（' + eraRuleOf(er).note + '）');
  }
  var RP = eraRuleOf(er);

  /* ① 体力/军力调度：两班将 + margin 条件（不足收回、充足收割） */
  var mg = pickSiegeGen();
  var pick = pickAmcGen(mg);
  var margin = (amc.troops || 0) + 600;
  var wantAmc = !!pick && totalArmy() >= margin;
  if (wantAmc && amc.genId !== pick.id) {
    amc.genId = pick.id;
    RUN('🤖 采集将定班 → ' + pick.name + '（与围攻将分权，互不抢体力）');
  }
  if (amc.on !== wantAmc) {
    amc.on = wantAmc;
    RUN((wantAmc ? '🟢' : '⚪') + ' 自动出征 ' + (wantAmc ? '开' : '关') + '（' + er + '：'
      + (wantAmc ? '军力余 ' + fmtNum(totalArmy() - margin) + '，放它收割' : '军力/将不足，收回保战事') + '）');
  }
  /* 打法定式与"条件翻转"：野地技能位占满 3 块后，占领变掠夺（占领是有限的） */
  amc.mode = (ownedGatherable().length >= 3) ? 'raid' : RP.mode;

  /* ② 税制：阶段 + 财政双条件（可双向翻转） */
  if (st.tax == null) st.tax = 0.5;
  var wantTax = RP.tax;
  var goldNow = 0;
  try { goldNow = G.res(richCity()).gold || 0; } catch (e) {}
  if (wantTax < 0.5 && goldNow < GOLD.reserve + 30000) wantTax = 0.5;   /* 财政吃紧 → 先保金 */
  if (tNow - TAX_LAST > 3600 && Math.abs(st.tax - wantTax) >= 0.2) {
    TAX_LAST = tNow;
    st.tax = wantTax;
    RUN('🧾 税制切至 ' + Math.round(wantTax * 100) + '%（' + (wantTax < 0.5 ? '轻徭薄赋·聚人口' : '常规·先保财政') + '）');
  }
}

/* 人口银行：贴顶的增长"存"进义兵（避免增长停在顶端被浪费） */
function bankPop() {
  var RP = eraRuleOf(ERA.id);
  if (!RP.bank) return;
  var c = st.cities[0];
  var cap = G.maxPopOf(c);
  var pop = (G.res(c).pop || 0);
  if (cap > 0) BANK.peak = Math.max(BANK.peak, pop);
  if (cap <= 0) return;
  if (pop < cap * 0.9) return;                          /* 没贴顶：先让 tryTrain 正常吃人 */
  if (totalArmy() < armyTarget()) return;               /* 军队有缺口：人口留给正经募兵 */
  if (((c.army || {}).yibing || 0) > 1500) return;      /* 银行上限（存太多是纯浪费军资） */
  var jy = cellOf(c, 'junying');
  if (!jy) return;
  if ((st.queues.train || []).length >= 4) return;
  var room = Math.floor(pop - cap * 0.6);
  var n = Math.min(room, 120);
  if (n < 10) return;
  var Rr = G.res(c);
  if ((Rr.grain || 0) < 40000 || (Rr.wood || 0) < 12000 || (Rr.iron || 0) < 6000) return;
  setCity(c);
  var r = safeCall('bank.train', function () { return G.train('yibing', n, c.id, jy.idx); });
  if (r && r.ok) {
    BANK.joined += n;
    if (BANK.joined <= 600) noteSoft('bank.join', '存人：义兵 ×' + n + '（人口银行）');
  }
}
/* 放人：募兵缺人时解散义兵归农（"要特定兵种时解散兵种、改募别的"） */
function releaseBank(needPop, why) {
  var c = st.cities[0];
  if (!c) return 0;
  var bank = (c.army || {}).yibing || 0;
  if (bank <= 0) return 0;
  var Rr = G.res(c);
  var gap = Math.max(0, Math.ceil(needPop - (Rr.pop || 0)));
  if (gap <= 0) return 0;
  var n = Math.min(bank, gap, 400);
  if (n < 10) return 0;
  var r = safeCall('bank.release', function () { return G.disbandAt(c.id, 'yibing', n); });
  if (r && r.ok) {
    BANK.released += n;
    RUN('🕊 人口银行放人：解散义兵 ×' + n + ' → 归农 +' + r.pop + '（' + why + '）');
    return r.pop;
  }
  return 0;
}

/* 民生：增民令（金换增速；**人口是当前瓶颈时才买** —— 条件驱动） */
function popBrain() {
  if (tNow - POPB_LAST < 1500) return;
  POPB_LAST = tNow;
  var rich = richCity();
  var gold = G.res(rich).gold || 0;
  if (gold < GOLD.reserve + 20000) return;
  var popTight = st.cities.length < 3 || totalArmy() < armyTarget();
  if (!popTight) return;
  var have = st.items['zengminling'] || 0;
  if (have <= 0) {
    setCity(rich);
    var b = safeCall('popb.buy', function () { return G.doShopping('zengminling', 1); });
    if (!b || !b.ok) return;
  }
  var u = safeCall('popb.use', function () { return G.systems.useItem('zengminling', null); });
  if (u && u.ok) {
    RUSH.popUses = (RUSH.popUses || 0) + 1;
    RUN('👶 增民令：人口增速 ×3（24 游戏时）· 累计 ' + RUSH.popUses + ' 张');
  }
}

/* ---------- 9. 主循环 ---------- */""",
'R5 阶段引擎 + 人口银行 + 增民令')

# ---------- R6 主循环接线 ----------
rep("""    GOLD.reserve = reserveNow();          /* v89.98b：按时代刷新金保留线 */""",
"""    GOLD.reserve = reserveNow();          /* v89.99：按"在办目标"刷新的金保留线 */
    safeCall('b.policies', applyPolicies);/* v89.99：阶段自适应（体力/税制/自动出征条件翻转） */
    safeCall('b.bank', bankPop);          /* v89.99：人口银行（贴顶的增长存成义兵） */
    safeCall('b.popb', popBrain);         /* v89.99：增民令（人口瓶颈时才买） */""",
'R6 主循环接线')

# ---------- R7 tryTrain：募兵缺人先放人（含 110 门槛之前） ----------
rep("""function tryTrain() {
  if ((st.queues.train || []).length >= 4) return;     /* 队列已有 4 批 → 先等 */""",
"""function tryTrain() {
  if ((st.queues.train || []).length >= 4) return;     /* 队列已有 4 批 → 先等 */
  /* v89.99：募兵缺人而人口银行有货 → 先解散义兵放人（"要特定兵种时解散改募"） */
  if (!(((G.res(st.cities[0]) || {}).pop) >= 60)) releaseBank(150, '募兵缺人');""",
'R7 tryTrain 放人')

# ---------- R8 快照带阶段/银行 ----------
rep("""    o.res = res; o.pop = Math.round(pop); o.popCap = Math.round(popCap);""",
"""    o.res = res; o.pop = Math.round(pop); o.popCap = Math.round(popCap);
    o.era = ERA.id; o.bankJ = BANK.joined; o.bankR = BANK.released;   /* v89.99：阶段与人口银行 */""",
'R8 快照')

# ---------- R9 终局写出 ----------
rep("""      promote: RUSH.promoteN, coupon: RUSH.couponN, perm: RUSH.permN, rank: st.rank || 0 },""",
"""      promote: RUSH.promoteN, coupon: RUSH.couponN, perm: RUSH.permN, rank: st.rank || 0,
      era: ERA.id, eras: ERA.log, popUses: (RUSH.popUses || 0), tax: (st.tax != null ? st.tax : null),
      bank: { join: BANK.joined, release: BANK.released, peak: BANK.peak } },""",
'R9 rush_final')

rep("""RUN('终态：第 ' + yNow().toFixed(1) + ' 游戏年 · 城 ' + st.cities.length + ' · 军 ' + fmtNum(totalArmy())
  + ' · 金 ' + fmtNum(st.res.gold) + ' · 将 ' + st.generals.length + ' · 战报 ' + (st.reports || []).length + ' 份');""",
"""RUN('终态：第 ' + yNow().toFixed(1) + ' 游戏年 · 城 ' + st.cities.length + ' · 军 ' + fmtNum(totalArmy())
  + ' · 金 ' + fmtNum(st.res.gold) + ' · 将 ' + st.generals.length + ' · 战报 ' + (st.reports || []).length + ' 份'
  + ' · 阶段 ' + ERA.id + '（' + ERA.n + ' 次切换）· 银行 存' + BANK.joined + '/放' + BANK.released);""",
'R10 终态行')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('--- D 补丁完成：%d 处 ---' % N[0])
