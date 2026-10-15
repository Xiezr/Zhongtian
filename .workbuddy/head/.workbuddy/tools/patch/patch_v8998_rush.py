# -*- coding: utf-8 -*-
"""
v89.98：从 play_strat_600x.js fork 出 play_rush_1x.js
—— 「1× 300h 全系统极限流」驾驶舱（老板令：重复利用所有板块和道具，走捷径）

改动清单：
  A. 参数化：MAXT 默认 1,080,000（1× 300h）· MODE 默认 'rush' · TS 参数（timeScale）
  B. 时间刻度 T_YEAR/T_HALF/T_QUARTER 按 TS 重算（快照/进度/检查点按游戏时间对齐）
  C. 新增五链脑：围攻打据点 / 爵位晋升 / 节钺扩编 / 通商券 / 丹药
  D. MODE 判断扩展（rush 全开宝物流+装备流）
  E. 快照与终局输出扩展（rush 侧字段）
运行：python patch_v8998_rush.py && node --check play_rush_1x.js
"""
import io

SRC = '.workbuddy/tools/playtest/play_strat_600x.js'
DST = '.workbuddy/tools/playtest/play_rush_1x.js'
s = io.open(SRC, encoding='utf-8').read()
N = [0]


def rep(old, new, tag, must=True):
    global s
    if new and new in s:
        print('SKIP ' + tag)
        return
    if old not in s:
        if must:
            raise AssertionError('MISS ' + tag)
        print('MISS(soft) ' + tag)
        return
    s = s.replace(old, new, 1)
    N[0] += 1
    print('OK   ' + tag)


# ---------- A. 头注释 ----------
rep("""/* STRAT v1 (v89.92) */
/* 生成自 play_gold_600x.js（v89.92 多策略 fork）；禁止手改生成物 —— 改 patch_v8992_strat.py。 */""",
    """/* RUSH v1 (v89.98) —— 1× 300h 全系统极限流 */
/* 生成自 play_strat_600x.js（v89.98 RUSH fork）；禁止手改生成物 —— 改 patch_v8998_rush.py。 */
/* ============================================================
 * v89.98「1× 300h 极限流测评」驾驶舱（老板令：重复利用所有板块和道具，走捷径）
 * 口径：1 tick = 现实 1 秒；timeScale = TS（默认 1× 严格 1:1）
 *   默认 1,080,000 ticks = 300 现实小时 = 18.75 游戏年
 *   对照跑：TS=120 → 9,000 ticks（2.5h 现实）/ TS=600 → 1,800 ticks（0.5h 现实）
 * 新增链：围攻打据点（occupy+围困）/ 爵位晋升 / 节钺扩编 / 通商券 / 丹药
 * ============================================================ */""",
    'header')

# ---------- A2. 用法说明段（顶部注释块里的 "600x" 描述） ----------
rep(""" * 目标：以游戏原生最高速档 600× 实跑 6 现实小时（= 225 游戏年），""",
    """ * 目标：以 1× 实跑 300 现实小时（= 18.75 游戏年 · 全系统极限流），""",
    'usage1', must=False)

# ---------- B. ARGV ----------
rep("""var MAXT = Math.max(96, Number(ARGV[0] || 21600));
var TAG  = ARGV[1] || 'main';
var MODE = ARGV[2] || 'gold';   /* gold | buff | equip | all（v89.92 策略开关） */""",
    """var MAXT = Math.max(96, Number(ARGV[0] || 1080000));   /* v89.98：默认 1× 300h = 1,080,000 ticks */
var TAG  = ARGV[1] || 'rush_1x';
var MODE = ARGV[2] || 'rush';   /* gold | buff | equip | all | rush（v89.98 新增：全系统极限流） */
var TS   = Math.max(1, Number(ARGV[3] || 1));   /* v89.98：timeScale（1 = 严格 1×） */
var T_YEAR = 57600, T_HALF = 28800, T_QUARTER = 14400;   /* 模块加载后按 TS 重算 */""",
    'argv')

# ---------- B1. 固定随机种子（对照跑对齐运气） ----------
rep("""var T_YEAR = 57600, T_HALF = 28800, T_QUARTER = 14400;   /* 模块加载后按 TS 重算 */""",
    """var T_YEAR = 57600, T_HALF = 28800, T_QUARTER = 14400;   /* 模块加载后按 TS 重算 */
/* v89.98：固定随机种子（三倍速对照跑对齐运气 —— 让差异只来自倍率机制本身） */
var _RNG_SEED = Number(ARGV[4] || 20260922);
var _rngS = _RNG_SEED >>> 0;
Math.random = function () {
  _rngS = (_rngS + 0x6D2B79F5) >>> 0;
  var _t = _rngS;
  _t = Math.imul(_t ^ (_t >>> 15), _t | 1);
  _t ^= _t + Math.imul(_t ^ (_t >>> 7), _t | 61);
  return ((_t ^ (_t >>> 14)) >>> 0) / 4294967296;
};""",
    'seeded rng')

# ---------- B2. 模块加载后重算时间刻度 ----------
rep("""var G = global.GAME, DATA = G.DATA, U = G.utils;""",
    """var G = global.GAME, DATA = G.DATA, U = G.utils;
/* v89.98：按 timeScale 重算时间刻度（1× 下 57,600 ticks = 1 游戏年） */
T_YEAR = Math.max(1, Math.round(((DATA.CALENDAR && DATA.CALENDAR.secPerYear) || 57600) / TS));
T_HALF = Math.max(1, Math.round(T_YEAR / 2));
T_QUARTER = Math.max(1, Math.round(T_YEAR / 4));""",
    'tyear')

# ---------- C. timeScale ----------
rep("""st.settings.timeScale = 600;""",
    """st.settings.timeScale = TS;   /* v89.98：1× 默认（1 游戏秒 / 现实秒） */""",
    'timescale')

# ---------- C2. 建局 RUN 行 ----------
rep("""RUN('建局：北辰 · 「许都」· 豫州 · mapSeed=20260921 · 600× · 目标 ' + MAXT + ' tick（' + (MAXT / 96).toFixed(1) + ' 游戏年）');""",
    """RUN('建局：北辰 · 「许都」· 豫州 · mapSeed=20260921 · ' + TS + '× · 目标 ' + MAXT + ' tick（'
  + (MAXT * TS / 57600).toFixed(2) + ' 游戏年 = ' + (MAXT / 3600).toFixed(1) + ' 现实小时）');""",
    'runline')

# ---------- D. 新脑五链（插在「快照」段之前） ----------
BRAIN = r"""/* ============================================================
 * v89.98 · 策略脑 C：RUSH（1× 300h 全系统极限流）
 * ------------------------------------------------------------
 * 老板令：「以 1 倍速度测评 300h，重复利用所有板块和道具，走捷径」
 * 新增五链（全部走游戏既有出口，不新增任何规则）：
 *   ① 围攻打据点：occupy 多波次 + 围困战法（守军−12% / 破防×1.5）
 *   ② 爵位晋升：声望/城池/金/珠宝齐备即晋（每 4 档得节钺 ×1）
 *   ③ 节钺：≥2 枚时扩编（建造位 +1）；留 1 枚备天授
 *   ④ 通商券：折价张口（mul < 0.92）时开出免折窗（无券则买 1 张）
 *   ⑤ 丹药：君主勇武丹 + 主城守将内政丹（永久 +1，上限 50）
 * ============================================================ */
var RUSH = { siegeRep: 0, siegeWin: 0, siegeFail: 0, tSiege1: null,
  jieyueUsed: 0, promoteN: 0, couponN: 0, permN: 0 };
var SG_LAST = -1e9, PR_LAST = -1e9, JY_LAST = -1e9, CP_LAST = -1e9, PM_LAST = -1e9;
var SG_WATCH = null;

function fortGoingTo(x, y) {
  var going = false;
  (st.marches || []).forEach(function (m) {
    try {
      var tg = m.target || m.to || null;
      if (tg && tg.kind === 'fort' && tg.x === x && tg.y === y) going = true;
    } catch (e) {}
  });
  return going;
}
function siegeWatchCheck() {
  if (!SG_WATCH) return;
  if (!G.map.fortAt(SG_WATCH.x, SG_WATCH.y)) {
    RUSH.siegeWin++;
    RUN('🏕 据点已下：' + SG_WATCH.name + '（Lv' + SG_WATCH.lv + '）· 围攻累计下城 ' + RUSH.siegeWin + ' 座');
    SG_WATCH = null;
  } else {
    var h = null;
    try { h = G.siegeHoldOf({ kind: 'fort', x: SG_WATCH.x, y: SG_WATCH.y }); } catch (e) {}
    SG_WATCH.hold = (h == null ? 100 : Math.round(h));
  }
}
function pickSiegeSpot() {
  var c0 = st.cities[0], k, mt, x0, y0, ff;
  var reg = /^f:(-?\d+),(-?\d+)$/;
  for (k in (st.sieges || {})) {
    mt = reg.exec(k);
    if (!mt) continue;
    x0 = Number(mt[1]); y0 = Number(mt[2]);
    ff = G.map.fortAt(x0, y0);
    if (ff && ff.level <= 5) return { f: ff, resumed: true };
  }
  for (var rr = 4; rr <= 26; rr++) {
    for (var dy = -rr; dy <= rr; dy++) for (var dx = -rr; dx <= rr; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
      var f = G.map.fortAt(c0.x + dx, c0.y + dy);
      if (f && f.level <= 3) return { f: f, resumed: false };
    }
  }
  return null;
}
function siegeBrain() {
  if (tNow - SG_LAST < 300) return;          /* 每 5 现实分钟一波 */
  SG_LAST = tNow;
  siegeWatchCheck();
  var total = totalArmy();
  if (total < 600) return;
  var pick = pickSiegeSpot();
  if (!pick) return;
  var f = pick.f;
  if (fortGoingTo(f.x, f.y)) return;         /* 已有一支部队在路上 */
  var gen = idleGen(true);
  if (!gen) return;
  setCity(st.cities[0]);
  var take = Math.min(9000, Math.max(400, Math.floor(total * 0.45)));
  var tk = takeArmy(st.cities[0], take);
  if (!tk || tk.total < 350) return;
  var r = safeCall('rush.siege', function () {
    return G.march.dispatch({ kind: 'fort', x: f.x, y: f.y }, 'occupy', tk.army, gen.id, null, { ops: 'encircle' });
  });
  if (r && r.ok) {
    RUSH.siegeRep++;
    SG_WATCH = { x: f.x, y: f.y, name: f.name, lv: f.level, hold: 100 };
    if (!RUSH.tSiege1) { RUSH.tSiege1 = tNow; RUN('🏕 围攻线点火：' + f.name + ' Lv' + f.level + '（围困战法 · 守军−12% / 破防×1.5）'); }
  } else if (r && !r.ok) { RUSH.siegeFail++; noteSoft('rush.siege', r.msg); }
}

function promoteBrain() {
  if (tNow - PR_LAST < 600) return;
  PR_LAST = tNow;
  var cp = safeCall('rush.canPromote', function () { return G.systems.canPromote(); });
  if (!cp || !cp.ok) return;
  var r = safeCall('rush.promote', function () { return G.systems.promote(); });
  if (r && r.ok) {
    RUSH.promoteN++;
    RUN('🏅 爵位晋升：' + (r.msg || ''));
    gml('rank' + RUSH.promoteN, '🎖 第 ' + RUSH.promoteN + ' 次晋爵：' + (r.msg || ''));
  }
}

function jieyueBrain() {
  if (tNow - JY_LAST < 600) return;
  JY_LAST = tNow;
  var have = G.jieyueOf ? G.jieyueOf() : 0;
  if (have < 2) return;                      /* 至少留 1 枚备天授 */
  var c = st.cities[0];
  var r = safeCall('rush.expand', function () { return G.jieyueExpandCity(c.id); });
  if (r && r.ok) {
    RUSH.jieyueUsed++;
    RUN('🪓 节钺扩编：' + c.name + ' 建造位 +1（余 ' + (G.jieyueOf ? G.jieyueOf() : '?') + ' 枚）');
  } else if (r && !r.ok) noteSoft('rush.expand', r.msg);
}

function couponBrain() {
  if (tNow - CP_LAST < 120) return;
  CP_LAST = tNow;
  var slip = null, fr = null;
  try { slip = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
  try { fr = G.mktFreeOf ? G.mktFreeOf() : null; } catch (e) {}
  if (fr) return;                                    /* 免折窗已开 */
  if (!slip || !(slip.mul < 0.92)) return;           /* 折价未张口，不用 */
  if ((st.items.tongshang_quan || 0) > 0) {
    var u = safeCall('rush.couponUse', function () { return G.systems.useItem('tongshang_quan', null); });
    if (u && (u.ok || String(u.msg || '').indexOf('免折') >= 0)) { RUSH.couponN++; RUN('🎫 通商券启用（免折 30 分钟 / 50 万当量）'); }
    return;
  }
  var rich = richCity();
  if ((G.res(rich).gold || 0) < GOLD.reserve + 200000) return;
  setCity(rich);
  var b = safeCall('rush.couponBuy', function () { return G.doShopping('tongshang_quan', 1); });
  if (!b || !b.ok) return;
  var u2 = safeCall('rush.couponUse2', function () { return G.systems.useItem('tongshang_quan', null); });
  if (u2 && (u2.ok || String(u2.msg || '').indexOf('免折') >= 0)) { RUSH.couponN++; RUN('🎫 通商券：买入并启用（免折 30 分钟）'); }
}

function permBrain() {
  if (tNow - PM_LAST < 1800) return;
  PM_LAST = tNow;
  var rich = richCity();
  if ((G.res(rich).gold || 0) < GOLD.reserve + 300000) return;
  var lord = G.lordGeneralOf ? G.lordGeneralOf() : null;
  var g0 = G.guardGeneralOf(st.cities[0]);
  var targets = [];
  if (lord) targets.push(['hugu_lingdan', lord.id]);
  if (g0 && (!lord || g0.id !== lord.id)) targets.push(['lingzhi_yulu', g0.id]);
  for (var i = 0; i < targets.length; i++) {
    var id = targets[i][0], gid = targets[i][1];
    var r = null;
    if ((st.items[id] || 0) > 0) {
      r = safeCall('rush.permUse', function () { return G.systems.useItem(id, gid); });
    } else {
      setCity(rich);
      var b = safeCall('rush.permBuy', function () { return G.doShopping(id, 1); });
      if (!b || !b.ok) continue;
      r = safeCall('rush.permUse', function () { return G.systems.useItem(id, gid); });
    }
    if (r && r.ok) { RUSH.permN++; }
    break;                                   /* 每轮只喂 1 颗 */
  }
}

"""
rep("""/* ---------- 8. 快照 ---------- */""",
    BRAIN + """/* ---------- 8. 快照 ---------- */""",
    'brain insert')

# ---------- E. 主循环：脑调用 ----------
rep("""    safeCall('b.milestones', execMilestones);
  }""",
    """    safeCall('b.milestones', execMilestones);
    /* v89.98：RUSH 五链（围攻 / 爵位 / 节钺 / 通商券 / 丹药） */
    safeCall('b.siege', siegeBrain);
    safeCall('b.promote', promoteBrain);
    safeCall('b.jieyue', jieyueBrain);
    safeCall('b.coupon', couponBrain);
    safeCall('b.perm', permBrain);
  }""",
    'mainloop brain')

# ---------- F. 快照频率与检查点 ----------
rep("""var SNAP_EVERY = 96;""",
    """var SNAP_EVERY = T_QUARTER;   /* v89.98：每 1/4 游戏年（1× 下 = 14,400 ticks） */""",
    'snap every')
rep("""RUN('主循环启动：每 tick = 1 现实秒 × 600 倍率；快照 1/游戏年；脑决策 ' + '40t(前10min)→120t');""",
    """RUN('主循环启动：每 tick = 1 现实秒 × ' + TS + ' 倍率；快照 1/4 游戏年；脑决策 40t(前10min)→120t（现实秒语义）');""",
    'loop runline')
rep("""  if (tNow % 480 === 0) {""",
    """  if (tNow % T_HALF === 0) {""",
    'prog every')
rep("""  if (tNow % 2400 === 0) {""",
    """  if (tNow % T_YEAR === 0) {""",
    'ckpt every')
rep("""    try { fs.writeFileSync(path.join(OUT, 'checkpoints', 'y' + Math.round(tNow / 96) + '.json'), G.savePayload()); } catch (e) { noteErr('ckpt', e); }""",
    """    try { fs.writeFileSync(path.join(OUT, 'checkpoints', 'y' + Math.round(tNow * TS / 57600) + '.json'), G.savePayload()); } catch (e) { noteErr('ckpt', e); }""",
    'ckpt name')

# ---------- G. 快照字段 ----------
rep("""    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\\n');""",
    """    if (typeof RUSH !== 'undefined') {
      o.rush = { sieRep: RUSH.siegeRep, sieWin: RUSH.siegeWin, sieFail: RUSH.siegeFail,
        jy: (G.jieyueOf ? G.jieyueOf() : 0), jyUsed: RUSH.jieyueUsed,
        promo: RUSH.promoteN, coupon: RUSH.couponN, perm: RUSH.permN,
        rank: st.rank || 0, rep: Math.round(st.rep || 0) };
    }
    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\\n');""",
    'snap rush')

# ---------- H. 终局输出 ----------
rep("""RUN('=== 推演结束 ===');""",
    """try {
  fs.writeFileSync(path.join(OUT, 'rush_final.json'), JSON.stringify({
    mode: MODE, TS: TS, ticks: MAXT, years: +(MAXT * TS / 57600).toFixed(2),
    rush: { sieRep: RUSH.siegeRep, sieWin: RUSH.siegeWin, sieFail: RUSH.siegeFail, tSiege1: RUSH.tSiege1,
      jieyue: (G.jieyueOf ? G.jieyueOf() : 0), jieyueUsed: RUSH.jieyueUsed,
      promote: RUSH.promoteN, coupon: RUSH.couponN, perm: RUSH.permN, rank: st.rank || 0 },
    gold: { sold: Math.round(GOLD.goldSold), sales: GOLD.salesCount, spends: GOLD.spends,
      recruits: GOLD.recruits, rerolls: GOLD.rerolls, books: GOLD.booksUsed },
    cities: st.cities.map(function (c) { var Rr = G.res(c); return { name: c.name,
      grain: Math.round(Rr.grain || 0), gold: Math.round(Rr.gold || 0), pop: Math.round(Rr.pop || 0),
      army: armyAll(c.army), slots: G.buildSlots(c) }; }),
    rep: Math.round(st.rep || 0), rank: st.rank || 0
  }, null, 1));
} catch (e) { noteErr('rush.final', e); }
RUN('=== 推演结束 ===');""",
    'rush final')

# ---------- I. MODE 全开（幂等） ----------
if "MODE === 'rush'" not in s:
    s = s.replace("(MODE === 'buff' || MODE === 'all')", "(MODE === 'buff' || MODE === 'all' || MODE === 'rush')")
    s = s.replace("(MODE === 'equip' || MODE === 'all')", "(MODE === 'equip' || MODE === 'all' || MODE === 'rush')")
    print('OK   mode expand')
else:
    print('SKIP mode expand')

# ---------- J. v89.98a 三处关键修正（1× 实测后的优化） ----------
# J1. 自动出征改「占领」：原来只掠夺 —— 家里永远"无自家野地可采"，采集线饿死
rep("""amc.mode = 'raid'; amc.everyMin = 5; amc.radius = 14; amc.dailyMax = 0;""",
    """amc.mode = 'occupy';   /* v89.98a：直接**占领**野地（原来只掠夺 —— 家里永远"无自家野地可采"，
                          采集线整局饿死；占领同时把 occupy1 里程碑一并做掉） */
amc.everyMin = 5; amc.radius = 14; amc.dailyMax = 0;""",
    'J1 amc occupy')

# J2/J3. 围攻脑：选体力最高的将 + 体力不足时用道具（大还丹 60% / 3,000 金）
rep("""function siegeBrain() {
  if (tNow - SG_LAST < 300) return;          /* 每 5 现实分钟一波 */
  SG_LAST = tNow;
  siegeWatchCheck();
  var total = totalArmy();
  if (total < 600) return;
  var pick = pickSiegeSpot();
  if (!pick) return;
  var f = pick.f;
  if (fortGoingTo(f.x, f.y)) return;         /* 已有一支部队在路上 */
  var gen = idleGen(true);
  if (!gen) return;""",
    """/* v89.98a：选「体力最高的空闲将」（原来 idleGen 不看体力 —— 1× 实测 1064 次派兵
   全被"体力不足"拦下：1× 下体力恢复仅 3 点/游戏小时，出征门槛 25 点）。 */
function pickSiegeGen() {
  var best = null, bs = -1;
  (st.generals || []).forEach(function (g) {
    if (g.isLord) return;                                    /* 君主不外出 */
    if (g.status === 'march' || g.status === 'gather' || g.status === 'guard') return;
    var s = G.staNow ? G.staNow(g) : (g.stamina || 0);
    if (s > bs) { bs = s; best = g; }
  });
  return best;
}
/* 体力不足 → 金够就嗑「大还丹」（60%/3,000 金）；金不够就等（1× 经济紧张，门槛 6 万） */
function staminaFix(gen, need) {
  var sta = G.staNow ? G.staNow(gen) : (gen.stamina || 0);
  if (sta >= need) return true;
  var rich = richCity();
  if ((G.res(rich).gold || 0) < GOLD.reserve + 60000) return false;
  setCity(rich);
  var b = safeCall('rush.staBuy', function () { return G.doShopping('dahuandan', 1); });
  if (!b || !b.ok) return false;
  var u = safeCall('rush.staUse', function () { return G.systems.useItem('dahuandan', gen.id); });
  if (u && u.ok) {
    RUSH.staUsed = (RUSH.staUsed || 0) + 1;
    RUN('💊 体力补给：' + gen.name + ' ← 大还丹（60% · 3,000 金）· 累计 ' + RUSH.staUsed + ' 颗');
    return true;
  }
  return false;
}
function siegeBrain() {
  if (tNow - SG_LAST < 300) return;          /* 每 5 现实分钟一波 */
  SG_LAST = tNow;
  siegeWatchCheck();
  var total = totalArmy();
  if (total < 600) return;
  var pick = pickSiegeSpot();
  if (!pick) return;
  var f = pick.f;
  if (fortGoingTo(f.x, f.y)) return;         /* 已有一支部队在路上 */
  var gen = pickSiegeGen();
  if (!gen) return;
  if (!staminaFix(gen, 30)) return;          /* v89.98a：体力 <30 → 嗑药或等待 */""",
    'J2J3 siege stamina')

# RUSH 对象加 staUsed 字段
rep("""var RUSH = { siegeRep: 0, siegeWin: 0, siegeFail: 0, tSiege1: null,
  jieyueUsed: 0, promoteN: 0, couponN: 0, permN: 0 };""",
    """var RUSH = { siegeRep: 0, siegeWin: 0, siegeFail: 0, tSiege1: null,
  jieyueUsed: 0, promoteN: 0, couponN: 0, permN: 0, staUsed: 0 };""",
    'J4 staUsed')

rep("""      o.rush = { sieRep: RUSH.siegeRep, sieWin: RUSH.siegeWin, sieFail: RUSH.siegeFail,""",
    """      o.rush = { sta: RUSH.staUsed, sieRep: RUSH.siegeRep, sieWin: RUSH.siegeWin, sieFail: RUSH.siegeFail,""",
    'J5 snap sta')

rep("""    rush: { sieRep: RUSH.siegeRep, sieWin: RUSH.siegeWin, sieFail: RUSH.siegeFail, tSiege1: RUSH.tSiege1,""",
    """    rush: { sta: RUSH.staUsed, sieRep: RUSH.siegeRep, sieWin: RUSH.siegeWin, sieFail: RUSH.siegeFail, tSiege1: RUSH.tSiege1,""",
    'J6 final sta')

# ---------- K. v89.98b 十项修正（老板批注：停自动出征 / 用足有利因素 / 规避失败路线） ----------
# K1. **停掉自动出征**：A2 实测它每 5 分钟偷一次体力（1× 下体力 8.3 小时才回一次），
#     把围攻/占领/建城的体力全吸干（围攻 1064 次被饿死）。
rep("""amc.on = true; amc.genId = null; amc.troops = 500; amc.target = 'wild'; amc.maxLevel = 2;""",
    """amc.on = false;   /* v89.98b：**停掉自动出征**！出征改由脑按「体力优先」调度
                     （keepOccupying / siegeBrain / 建城占平原）——不再有引擎级体力黑洞。 */
amc.genId = null; amc.troops = 500; amc.target = 'wild'; amc.maxLevel = 2;""",
    'K1 automarch off')

# K2. keepOccupying：体力门槛 + 选最佳将
rep("""function keepOccupying() {
  if (ownedGatherable().length >= 3) return;
  if (tNow - OCCUPY_LAST < 240) return;
  if (totalArmy() < 400) return;
  var gen = idleGen(true); if (!gen) return;""",
    """function keepOccupying() {
  if (ownedGatherable().length >= 3) return;
  if (tNow - OCCUPY_LAST < 240) return;
  if (totalArmy() < 400) return;
  /* v89.98b：体力优先 —— 选体力最高空闲将；不足 30 先嗑药/等待（不再空转撞墙） */
  var gen = pickSiegeGen(); if (!gen) return;
  if (!staminaFix(gen, 30)) return;""",
    'K2 occupy stamina')

# K3. ensurePlainForCity（筑城前置：占平原）同样走体力优先
rep("""  if (tNow - (MILE_TS['occ_' + tag] || 0) < 600) return { have: false };
  var gen = idleGen(true); if (!gen) return { have: false };
  var spot = findPlainSpot(); if (!spot) return { have: false };""",
    """  if (tNow - (MILE_TS['occ_' + tag] || 0) < 600) return { have: false };
  /* v89.98b：占平原是筑城的门票（1× 里 city2 卡死的直接原因）—— 一样体力优先 */
  var gen = pickSiegeGen(); if (!gen) return { have: false };
  if (!staminaFix(gen, 30)) return { have: false };
  var spot = findPlainSpot(); if (!spot) return { have: false };""",
    'K3 plain stamina')

# K4. 里程碑不再按「60 次」放弃（1× 下仅覆盖 2 游戏小时 → 误杀全部 7 个里程碑）
rep("""  else if (m.retries > 60) { m.done = true; RUN('⏭ 里程碑 ' + m.id + ' 放弃（重试 ' + m.retries + ' 次未达成）'); }""",
    """  /* v89.98b：改为按**游戏时间**兜底放弃 —— "重试 60 次"在 1× 下只覆盖 2 游戏小时
     （体力都回不满），在 120× 下却覆盖 15 游戏年。跑满 18.5 游戏年才允许放弃。 */
  else if (yNow() > 18.5 && m.retries > 60) { m.done = true; RUN('⏭ 里程碑 ' + m.id + ' 放弃（18.5 游戏年未达成）'); }""",
    'K4 milestones no giveup')

# K5. 人口保护：筑城要 100 人口（DATA.NEW_CITY_RES.pop）—— 1× 实测人口被征兵抽到 0
rep("""function tryTrain() {
  if ((st.queues.train || []).length >= 4) return;     /* 队列已有 4 批 → 先等 */""",
    """function tryTrain() {
  if ((st.queues.train || []).length >= 4) return;     /* 队列已有 4 批 → 先等 */
  /* v89.98b：**筑城前保住人口**（城 2 = 爵位线门票）。人口 < 150 且未建城 2 → 暂停征兵。 */
  if (st.cities.length < 2 && ((G.res(st.cities[0]) || {}).pop || 0) < 150) return;""",
    'K5 pop reserve')

# K6a. goldSell：只在保价区卖（不再触底抛售 —— 那是把建楼资源按 1 折卖掉）
rep("""      var over = s0 - buf[r];
      if (over < 60000) return;
      var amt = Math.min(over, 5000000);""",
    """      var over = s0 - buf[r];
      if (over < 60000) return;
      /* v89.98b：**只在保价区卖**（mul ≥ 0.85）—— 触底抛售正是 1× 建筑等级只有
         120× 三分之一的根因。资源优先留给建设。 */
      var _slip = null; try { _slip = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
      if (_slip && _slip.mul < 0.85) return;
      var amt = Math.min(over, 5000000);""",
    'K6a goldSell price floor')

# K6b. tryMarketSell（基线卖粮）同样加保价检查
rep("""  var grain = st.res.grain || 0;
  if (grain < 900000) return;                /* 先保 60 万粮底 */
  var amount = Math.min(grain - 600000, 800000);""",
    """  var grain = st.res.grain || 0;
  if (grain < 900000) return;                /* 先保 60 万粮底 */
  /* v89.98b：同 goldSell —— 折价区不卖（保资源建设） */
  var _slip3 = null; try { _slip3 = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
  if (_slip3 && _slip3.mul < 0.85) return;
  var amount = Math.min(grain - 600000, 800000);""",
    'K6b baseline price floor')

# K7. 体力道具门槛 6 万 → 3 万
rep("""  if ((G.res(rich).gold || 0) < GOLD.reserve + 60000) return false;""",
    """  if ((G.res(rich).gold || 0) < GOLD.reserve + 30000) return false;   /* v89.98b：3 万即用（体力比金贵） */""",
    'K7 stamina threshold')

# K8a. 金保留线自适应（30 万是 600×/450 年时代的线；1× 全程金 < 26 万 → 一切金消费被锁死）
rep("""function permBrain() {""",
    """/* v89.98b：**金保留线自适应** —— 固定 30 万在 1×（金 10 万级）下把书/内功/丹/符/提速
   全部锁死（"金不足"其实是"门槛错"）。按游戏年分档，小规模时代用小额保留线。 */
function reserveNow() {
  var y = yNow();
  if (y < 3) return 10000;
  if (y < 8) return 30000;
  if (y < 20) return 80000;
  return 300000;
}
function permBrain() {""",
    'K8a reserveNow')

# K8b. 主循环刷新保留线
rep("""    BRAIN_LAST = tNow;
    safeCall('b.quests', tryQuests);""",
    """    BRAIN_LAST = tNow;
    GOLD.reserve = reserveNow();          /* v89.98b：按时代刷新金保留线 */
    safeCall('b.quests', tryQuests);""",
    'K8b reserve refresh')

# K8c. 各项「+N 万」门槛同步下调到 1× 可及区间
rep("""  var minKeep = GOLD.reserve + 150000;""",
    """  var minKeep = GOLD.reserve + 50000;   /* v89.98b：15 万 → 5 万（1× 里金买时间=省现实时间，值） */""",
    'K8c rush threshold')
rep("""  var minKeep = GOLD.reserve + 600000;""",
    """  var minKeep = GOLD.reserve + 100000;  /* v89.98b：60 万 → 10 万 */""",
    'K8d trainRush threshold')
rep("""      if ((G.res(rich).gold || 0) < GOLD.reserve + 100000) break;""",
    """      if ((G.res(rich).gold || 0) < GOLD.reserve + 40000) break;   /* v89.98b：10 万 → 4 万 */""",
    'K8e neigong threshold')
rep("""  if ((G.res(rich).gold || 0) < GOLD.reserve + 200000) return;""",
    """  if ((G.res(rich).gold || 0) < GOLD.reserve + 40000) return;   /* v89.98b：20 万 → 4 万（折价窗口值得用券） */""",
    'K8f coupon threshold')
rep("""  if ((G.res(rich).gold || 0) < GOLD.reserve + 300000) return;""",
    """  if ((G.res(rich).gold || 0) < GOLD.reserve + 60000) return;   /* v89.98b：30 万 → 6 万（丹药激活） */""",
    'K8g perm threshold')

# K9. 军力目标下调（原 4 万远超 19 年人口供给 → "永远征兵中"抽干人口）
rep("""function armyTarget() {
  var y = yNow();
  if (y < 0.25) return 300;
  if (y < 1) return 1200;
  if (y < 3) return 5000;
  if (y < 8) return 15000;
  if (y < 20) return 40000;""",
    """function armyTarget() {
  var y = yNow();
  /* v89.98b：目标下调 —— 原 5000/15000/40000 远超 18.75 年的人口供给（人口=民房唯一来源），
     会导致"永远征兵中"把人口抽干（城 2 因此建不起来）。 */
  if (y < 0.25) return 300;
  if (y < 1) return 1000;
  if (y < 3) return 3000;
  if (y < 8) return 8000;
  if (y < 20) return 15000;""",
    'K9 army target')

# K10. 人口保护阈值 150 → 110（150 会让兵太少、军事门槛过不去 → 死锁）；扩展到"城 3 前"
rep("""  /* v89.98b：**筑城前保住人口**（城 2 = 爵位线门票）。人口 < 150 且未建城 2 → 暂停征兵。 */
  if (st.cities.length < 2 && ((G.res(st.cities[0]) || {}).pop || 0) < 150) return;""",
    """  /* v89.98b：**筑城前保住人口**（筑城要 100 人）。阈值 110：既保住建城底线，
     又留 90+ 兵力给"占平原"（150 会死锁：兵太少连平原都占不下）。城 3 前同样保护。 */
  if (st.cities.length < 3 && ((G.res(st.cities[0]) || {}).pop || 0) < 110) return;""",
    'K10 pop 110')

# K11. 军事门槛下调：野地 Lv1~2 守军很弱（实测战损 0~3），不需要 280~400 兵。
#      门槛不降，K10 的 90 兵就什么都打不了（原版 1× 就是被这两头夹死的）。
rep("""  if (ownedGatherable().length >= 3) return;
  if (tNow - OCCUPY_LAST < 240) return;
  if (totalArmy() < 400) return;""",
    """  if (ownedGatherable().length >= 3) return;
  if (tNow - OCCUPY_LAST < 240) return;
  if (totalArmy() < 80) return;          /* v89.98b：400 → 80（人口增长 4~9 人/游戏小时 · 开局仅 ~90 兵可用） */""",
    'K11a occupy 150')
rep("""  var tk = takeArmy(st.cities[0], 400);
  if (tk.total < 280) return;
  var r = safeCall('occupy.auto', function () { return G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk.army, gen.id); });""",
    """  var tk = takeArmy(st.cities[0], 100);
  if (tk.total < 60) return;             /* v89.98b：280 → 60 */
  var r = safeCall('occupy.auto', function () { return G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk.army, gen.id); });""",
    'K11b occupy 120')
rep("""  var tk = takeArmy(st.cities[0], 400);
  if (tk.total < 280) return { have: false };
  var r = safeCall(tag + '.occ', function () { return G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk.army, gen.id); });""",
    """  var tk = takeArmy(st.cities[0], 100);
  if (tk.total < 60) return { have: false };   /* v89.98b：280 → 60 */
  var r = safeCall(tag + '.occ', function () { return G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk.army, gen.id); });""",
    'K11c plain 120')
rep("""      if (totalArmy() < 280) return 'wait';
      var gen = idleGen(true); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk1 = takeArmy(st.cities[0], 280);
      if (tk1.total < 120) return 'wait';""",
    """      if (totalArmy() < 120) return 'wait';      /* v89.98b：280 → 60 */
      var gen = pickSiegeGen(); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk1 = takeArmy(st.cities[0], 150);
      if (tk1.total < 80) return 'wait';         /* v89.98b：120 → 80 */""",
    'K11d raid1 lower')
rep("""      if (totalArmy() < 500) return 'wait';
      var gen = idleGen(true); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk2 = takeArmy(st.cities[0], 600);
      if (tk2.total < 350) return 'wait';""",
    """      if (totalArmy() < 200) return 'wait';      /* v89.98b：500 → 200 */
      var gen = pickSiegeGen(); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk2 = takeArmy(st.cities[0], 300);
      if (tk2.total < 150) return 'wait';        /* v89.98b：350 → 150 */""",
    'K11e occupy1 lower')

# ---------- M. v89.98c 两处补漏（老板批注第二轮：把"能买却没买"的都买上） ----------
# M1. 晋爵前**先补珠宝** —— 珍珠/珊瑚/琥珀全是商城货（单价 200~2600 金），
#     1× 里"卡珠宝"纯属脑失误：金 9 万却不买 4,000 金的晋级套件。
rep("""function promoteBrain() {
  if (tNow - PR_LAST < 600) return;
  PR_LAST = tNow;
  var cp = safeCall('rush.canPromote', function () { return G.systems.canPromote(); });
  if (!cp || !cp.ok) return;""",
    """function promoteBrain() {
  if (tNow - PR_LAST < 600) return;
  PR_LAST = tNow;
  /* v89.98c：**先补晋爵珠宝**（硬门槛；珠宝=商城货，金够就该买齐）。 */
  var nextR = safeCall('rush.nextRank', function () { return G.systems.nextRank(); });
  if (nextR && nextR.jewel) {
    for (var jid in nextR.jewel) {
      var needJ = (nextR.jewel[jid] || 0) - (st.items[jid] || 0);
      if (needJ <= 0) continue;
      var infoJ = G.systems.itemInfo ? G.systems.itemInfo(jid) : null;
      var priceJ = (infoJ && infoJ.price ? infoJ.price : 0) * 100;
      if (!(priceJ > 0)) continue;
      var richJ = richCity();
      if ((G.res(richJ).gold || 0) < priceJ * needJ + GOLD.reserve) continue;
      setCity(richJ);
      var bJ = safeCall('rush.jewelBuy', function () { return G.doShopping(jid, needJ); });
      if (bJ && bJ.ok) RUN('💎 珠宝补齐：' + (infoJ ? infoJ.name : jid) + ' ×' + needJ + '（晋爵门槛）');
    }
  }
  var cp = safeCall('rush.canPromote', function () { return G.systems.canPromote(); });
  if (!cp || !cp.ok) return;""",
    'M1 jewel buy')

# M2. 保价策略加「淤积兜底」—— 高倍速下每日重置不存在（模拟现实时间仅 0.5~2.5h），
#     纯保价 = 永不卖金（600×/120× 的建城金就是这么断的）。资源淤积 >70% 仓容时兜底抛售。
rep("""      var _slip = null; try { _slip = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
      if (_slip && _slip.mul < 0.85) return;
      var amt = Math.min(over, 5000000);""",
    """      var _slip = null; try { _slip = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
      if (_slip && _slip.mul < 0.85) {
        /* v89.98c：折价区默认不卖（保资源建设）；**淤积 >70% 仓容时兜底**（高倍速无每日重置）。 */
        var _capB = 0; try { _capB = G.storeCapOf ? G.storeCapOf(city) : 0; } catch (e) {}
        if (!(_capB > 0 && s0 > _capB * 0.7)) return;
      }
      var amt = Math.min(over, 5000000);""",
    'M2a goldSell silt')
rep("""  var _slip3 = null; try { _slip3 = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
  if (_slip3 && _slip3.mul < 0.85) return;
  var amount = Math.min(grain - 600000, 800000);""",
    """  var _slip3 = null; try { _slip3 = G.mktSlipOf ? G.mktSlipOf() : null; } catch (e) {}
  if (_slip3 && _slip3.mul < 0.85) {
    var _capC = 0; try { _capC = G.storeCapOf ? G.storeCapOf(st.cities[0]) : 0; } catch (e) {}
    if (!(_capC > 0 && grain > _capC * 0.7)) return;   /* v89.98c：同 goldSell 淤积兜底 */
  }
  var amount = Math.min(grain - 600000, 800000);""",
    'M2b baseline silt')

io.open(DST, 'w', encoding='utf-8', newline='').write(s)
print('written %s（%d 处替换）' % (DST, N[0]))
