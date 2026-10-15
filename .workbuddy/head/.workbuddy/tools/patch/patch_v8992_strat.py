#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""patch_v8992_strat.py — 由 play_gold_600x.js 生成 play_strat_600x.js（v89.92 多策略驾驶舱）

生成物 = 黄金流驾驶舱 + 两个新策略脑（BUFF 宝物流 / EQUIP 装备流）+ MODE 开关。
幂等：每次从源文件重新生成；锚点缺失即报错退出（绝不静默半落盘）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
SRC = R + '.workbuddy/tools/playtest/play_gold_600x.js'
DST = R + '.workbuddy/tools/playtest/play_strat_600x.js'

src = io.open(SRC, encoding='utf-8').read()
orig_len = len(src)

# ---------------------------------------------------------------- 1. header
H_OLD = """/* GOLD v1 */
/* 生成自 play_600x.js（v89.91 黄金流 fork）；禁止手改基线副本。 */"""
H_NEW = """/* STRAT v1 (v89.92) */
/* 生成自 play_gold_600x.js（v89.92 多策略 fork）；禁止手改生成物 —— 改 patch_v8992_strat.py。 */"""
assert H_OLD in src, 'header anchor missing'
src = src.replace(H_OLD, H_NEW, 1)

# ---------------------------------------------------------------- 2. MODE 解析
A_OLD = """var TAG  = ARGV[1] || 'main';"""
A_NEW = """var TAG  = ARGV[1] || 'main';
var MODE = ARGV[2] || 'gold';   /* gold | buff | equip | all（v89.92 策略开关） */"""
assert A_OLD in src, 'argv anchor missing'
src = src.replace(A_OLD, A_NEW, 1)

# ---------------------------------------------------------------- 3. 策略脑插入
BRAIN_ANCHOR = '/* ---------- 6. 里程碑（可延后重试） ---------- */'
assert BRAIN_ANCHOR in src, 'brain insert anchor missing'

BRAINS = r'''
/* ============================================================
 * v89.92 · 策略脑 A：BUFF（宝物流）
 * ------------------------------------------------------------
 * 探针实证（probe_v8992）：
 *   · 生产类宝物 3,000 金 = 产量 +100%，且 prodUntil **从不被消费**
 *     （死字段）→ 永不到期、叠加无上限 —— 游戏内最便宜的金→产量出口；
 *   · 符类（治粟+安民+玄德+文曲星）= 守将内政 ×6.56（24h，正常到期）；
 *   · 大役令 = 建造队列 +5（24h）。
 * 本段如实实现这条路线，全部走游戏既有出口（doShopping + useItem），
 * 不新增任何游戏规则。
 * ============================================================ */
var ITEM_PRICE = {}, MAT_PRICE = {};
(DATA.ITEMS || []).forEach(function (x) { if (x.price) ITEM_PRICE[x.id] = x.price * 100; });
(DATA.MATERIALS || []).forEach(function (m) { MAT_PRICE[m.id] = (m.price || 0) * 100; });

var BUFF = { spend: { prod: 0, attr: 0, corvee: 0 }, units: {}, flags: {}, tFirst: null };
/* ① 大役令：建造队列 +5（24h；一次） */
function buffCorvee() {
  if (BUFF.flags.corvee) return;
  var rich = richCity();
  if ((G.res(rich).gold || 0) < GOLD.reserve + 40000) return;
  var b = safeCall('buff.cvBuy', function () { return G.doShopping('corvee5', 1); });
  if (!b || !b.ok) return;
  var u = safeCall('buff.cvUse', function () { return G.systems.useItem('corvee5', null); });
  if (u && u.ok) { BUFF.flags.corvee = 1; BUFF.spend.corvee += 20000; RUN('🎏 大役令：建造队列 → ' + G.buildSlots(rich)); }
}
/* ② 符类：各城守将四符叠加（内政 ×6.56；到期自动续） */
var BA_LAST = -1e9;
var ATTR_FU = [['zhisu', 28000], ['anmin', 20000], ['xuande', 13000], ['wenquxing', 6000]];
function buffAttr() {
  if (tNow - BA_LAST < 240) return;
  BA_LAST = tNow;
  ATTR_FU.forEach(function (pair) {
    var id = pair[0], price = pair[1];
    st.cities.forEach(function (city) {
      var g = G.guardGeneralOf(city);
      if (!g) return;
      var cur = (st.buffs && st.buffs.gens && st.buffs.gens[g.id]) || {};
      if (cur[id] && cur[id].until > U.now()) return;
      var rich = richCity();
      if ((G.res(rich).gold || 0) < price + GOLD.reserve) return;
      var b = safeCall('buff.fuBuy', function () { return G.doShopping(id, 1); });
      if (!b || !b.ok) return;
      var u = safeCall('buff.fuUse', function () { return G.systems.useItem(id, g.id); });
      if (u && u.ok) {
        BUFF.spend.attr += price;
        if (!BUFF.flags['fu' + id]) { BUFF.flags['fu' + id] = 1; RUN('🎏 符类叠起：' + g.name + ' ← ' + (DATA.ITEMS.filter(function (x) { return x.id === id; })[0] || {}).name + '（nz ' + guardNzOf(g) + '）'); }
      }
    });
  });
}
/* ③ 生产宝物：金 → 产量 直接兑换（v89.93 修复后：同类只取最强 + 24h 到期）
   —— 脑按游戏规则行动：同类已有**同级或更强**效果就不再买（钱留给别的线）。 */
var BP_LAST = -1e9;
var PROD_FLOOR = 50000;
var PROD_LIST = [['houji', 3000, 200], ['ganjianglu', 3000, 40], ['jumuling', 3000, 40], ['yugongling', 3000, 40], ['taozhu', 5000, 40]];
function prodItemOf(id) {
  var hit = null;
  (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) hit = x; });
  return hit;
}
function buffOkFor(id) {
  /* 返回 true = 值得买（当前无该资源效果，或现存效果弱于本品） */
  var it = prodItemOf(id);
  if (!it) return false;
  var prod = (st.buffs && st.buffs.prod) || {};
  var until = (st.buffs && st.buffs.prodUntil) || {};
  var cur = prod[it.res] || 0;
  var live = (until[it.res] || 0) > U.now();
  return !(live && cur >= (it.eff || 0));
}
function buffProd() {
  if (tNow - BP_LAST < 90) return;
  BP_LAST = tNow;
  var rich = richCity();
  var surplus = (G.res(rich).gold || 0) - PROD_FLOOR;
  if (surplus < 3000) return;
  var budget = Math.min(surplus * 0.55, 3000000);
  PROD_LIST.forEach(function (it) {
    if (budget < it[1]) return;
    if (!buffOkFor(it[0])) return;                   /* v89.93：已有同级/更强 → 不重复买 */
    var n = 1;                                       /* v89.93：买 1 个即可（刷新 24h） */
    var b = safeCall('buff.pbBuy', function () { return G.doShopping(it[0], n); });
    if (!b || !b.ok || !b.bought) return;
    var got = b.bought;
    var u = safeCall('buff.pbUse', function () { return G.systems.useItemMany(it[0], null, got); });
    var used = (u && u.count) || 0;
    BUFF.spend.prod += it[1] * got;
    BUFF.units[it[0]] = (BUFF.units[it[0]] || 0) + used;
    budget -= it[1] * got;
    if (!BUFF.tFirst && used > 0) { BUFF.tFirst = tNow; RUN('🎏 生产宝物线点火：首个「' + it[0] + '」（+100% 产量/个 · 3,000 金）'); }
  });
}

/* ============================================================
 * v89.92 · 策略脑 B：EQUIP（装备流）
 * ------------------------------------------------------------
 * 老板假说：「装备拉满 + 强化拉满 → 原始积累会更快？」
 * 本段如实实现这条路线：
 *   铁匠铺升 Lv7 → 买图纸 → 缺材料就买 → 打造 12 件倚天套
 *   → 百炼逐级升到 +10 → 整套装到主城守将。
 * 目标套装 = 倚天套（探针实测：+10 后内政 +861 —— 七套中唯一
 * 能显著抬内政的套装；全成本约 4,004 万金）。
 * ============================================================ */
var EQUIP = {
  spend: { bp: 0, mat: 0, craft: 0, enh: 0 },
  crafted: {}, wornCount: 0, wornGen: null,
  tCraft1: null, tCraft12: null, tEnh120: null, tWorn12: null
};
var YT_IDS = null;
function ytIds() {
  if (!YT_IDS) YT_IDS = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id].set === 'yitian'; });
  return YT_IDS;
}
function forgeCity() {
  var best = null;
  st.cities.forEach(function (c) {
    var lv = G.buildingLevel(c, 'tiejiangpu') || 0;
    if (lv > 0 && (!best || lv > best.lv)) best = { city: c, lv: lv };
  });
  return best;
}
/* ① 铁匠铺专职升级到 Lv7 */
var EF_LAST = -1e9;
function equipForgeUp() {
  if (tNow - EF_LAST < 60) return;
  EF_LAST = tNow;
  var f = forgeCity();
  if (!f || f.lv >= 7) return;
  var city = f.city;
  if (!G.checkBuildSlot(city.id).ok) return;
  var c = cellOf(city, 'tiejiangpu');
  if (!c) return;
  setCity(city);
  var r = safeCall('equip.forgeUp', function () { return G.upgradeAt(city.id, c.idx); });
  if (r && r.ok) { RUN('⚒ 装备流：铁匠铺 → Lv' + (f.lv + 1) + ' 开建'); EF_LAST = tNow + 240; }
  else if (r && !r.ok) noteSoft('equip.forgeUp', r.msg);
}
/* ② 打造（缺材料/图纸先买；每轮一件，大额支出留痕） */
var EC_LAST = -1e9;
function equipCraft() {
  if (tNow - EC_LAST < 60) return;
  EC_LAST = tNow;
  var f = forgeCity();
  if (!f || f.lv < 7) return;
  setCity(f.city);
  var ids = ytIds();
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (EQUIP.crafted[id]) continue;
    var cost = G.forgeCost(id) || {}, mats = G.forgeMaterials(id) || {};
    var need = (cost.gold || 0);
    var lacks = [];
    for (var k in mats) {
      var have = st.items[k] || 0;
      if (have < mats[k]) { lacks.push([k, mats[k] - have]); need += (mats[k] - have) * (MAT_PRICE[k] || 0); }
    }
    if (!(st.items.bp_yitian > 0)) need += 32000;
    if ((G.res(f.city).gold || 0) - GOLD.reserve < need) return;   /* 钱不够，等下一轮 */
    for (var li2 = 0; li2 < lacks.length; li2++) {
      var lackRow = lacks[li2];
      var b1 = safeCall('equip.matBuy', function () { return G.doShopping(lackRow[0], lackRow[1]); });
      if (b1 && b1.ok) EQUIP.spend.mat += lackRow[1] * (MAT_PRICE[lackRow[0]] || 0);
    }
    if (!(st.items.bp_yitian > 0)) {
      var b2 = safeCall('equip.bpBuy', function () { return G.doShopping('bp_yitian', 1); });
      if (b2 && b2.ok) EQUIP.spend.bp += 32000;
    }
    var r = safeCall('equip.forge', function () { return G.forge(id); });
    if (r && r.ok) {
      EQUIP.crafted[id] = 1; EQUIP.spend.craft += (cost.gold || 0);
      var cnum = Object.keys(EQUIP.crafted).length;
      if (!EQUIP.tCraft1) { EQUIP.tCraft1 = tNow; RUN('⚒ 装备流：首件打造 ' + r.msg + '（1/12）'); }
      else if (cnum % 4 === 0) RUN('⚒ 装备流：倚天套进度 ' + cnum + '/12');
      if (cnum >= 12 && !EQUIP.tCraft12) { EQUIP.tCraft12 = tNow; RUN('🏆 装备流：倚天套 12 件打造完成'); }
    } else if (r && !r.ok) { noteSoft('equip.forge', r.msg); }
    return;   /* 每轮只打造一件 */
  }
}
/* ③ 百炼 +10（逐级；钱/铁/石够就升一件） */
var EE_LAST = -1e9;
function equipEnhance() {
  if (tNow - EE_LAST < 40) return;
  EE_LAST = tNow;
  var f = forgeCity();
  if (!f || f.lv < 7) return;
  setCity(f.city);
  var ids = ytIds();
  for (var ii = 0; ii < ids.length; ii++) {
    var id = ids[ii];
    var inst = G.eqFind(id);
    if (!inst) continue;
    var lv = G.eqEnhOf(inst);
    if (lv >= 10) continue;
    var c = G.enhCost(inst) || {};
    if ((G.res(f.city).gold || 0) - GOLD.reserve < (c.gold || 0)) return;
    if ((st.res.iron || 0) < (c.iron || 0) || (st.res.stone || 0) < (c.stone || 0)) return;
    var r = safeCall('equip.enh', function () { return G.enhance(inst.u); });
    if (r && r.ok) {
      EQUIP.spend.enh += (c.gold || 0);
      if (G.eqEnhOf(inst) >= 10) {
        var all10 = ytIds().every(function (x) { var i2 = G.eqFind(x); return i2 && G.eqEnhOf(i2) >= 10; });
        RUN('⚒ 百炼：' + G.eqLabel(inst) + ' 满级（+10）' + (all10 ? ' —— 12 件全部 +10 达成' : ''));
        if (all10 && !EQUIP.tEnh120) EQUIP.tEnh120 = tNow;
      }
      return;
    }
    if (r && !r.ok) noteSoft('equip.enh', r.msg);
  }
}
/* ④ 穿戴：整套装到「主城守将」（守将变更则随迁） */
var EW_LAST = -1e9;
function equipWear() {
  if (tNow - EW_LAST < 120) return;
  EW_LAST = tNow;
  var g = G.guardGeneralOf(st.cities[0]);
  if (!g) {
    var best = null, bn = -1;
    (G.generalsIn(st.cities[0]) || []).forEach(function (x) { var nz = guardNzOf(x); if (nz > bn) { bn = nz; best = x; } });
    if (!best) return;
    safeCall('equip.guard', function () { return G.assignGeneral(best.id, 'guard', st.cities[0].id); });
    g = best;
  }
  var ids = ytIds(), n = 0;
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var cur = (g.equip || {})[DATA.EQUIP[id].slot];
    var inst = G.eqFind(id);
    if (!inst) continue;
    if (cur && G.eqId(cur) === id && G.eqUidOf(cur) === G.eqUidOf(inst)) { n++; continue; }
    var r = safeCall('equip.wear', function () { return G.systems.equipItem(g.id, inst.u); });
    if (r && r.ok) n++;
  }
  EQUIP.wornCount = n; EQUIP.wornGen = g.name;
  if (n >= 12 && !EQUIP.tWorn12) { EQUIP.tWorn12 = tNow; RUN('🏆 装备流：12 件倚天套全部上身（' + g.name + '，nz ' + guardNzOf(g) + '，产量 +' + Math.round(G.guardBonus(st.cities[0]).prod * 100) + '%）'); }
}
/* ⑤ 状态行 */
function stratLine() {
  var s = '';
  if (MODE === 'buff' || MODE === 'all') {
    var pf = G.prodFactors('grain', st.cities[0]) || [], fm = 1;
    pf.forEach(function (x) { fm *= (1 + x.d); });
    s += ' · 🎏宝物流：粮因子 ×' + (fm >= 1e4 ? (fm / 1e4).toFixed(2) + '万' : fm.toFixed(1))
      + ' · 犁 ' + (BUFF.units.houji || 0) + ' · 花 ' + fmtNum(BUFF.spend.prod + BUFF.spend.attr + BUFF.spend.corvee);
  }
  if (MODE === 'equip' || MODE === 'all') {
    var f = forgeCity();
    s += ' · ⚒装备流：炉 Lv' + (f ? f.lv : 0) + ' · 造 ' + Object.keys(EQUIP.crafted).length + '/12'
      + ' · 穿 ' + EQUIP.wornCount + '/12 · 花 ' + fmtNum(EQUIP.spend.bp + EQUIP.spend.mat + EQUIP.spend.craft + EQUIP.spend.enh);
  }
  return s;
}

'''
src = src.replace(BRAIN_ANCHOR, BRAINS + BRAIN_ANCHOR, 1)

# ---------------------------------------------------------------- 4. 主循环调用
C_OLD = "    safeCall('b.goldSell', goldSell);"
C_NEW = """    /* v89.92：宝物流优先级 = 最先（这是它的打法本体 —— 金先换产量） */
    if (MODE === 'buff' || MODE === 'all') {
      safeCall('b.buffCorvee', buffCorvee);
      safeCall('b.buffAttr', buffAttr);
      safeCall('b.buffProd', buffProd);
    }
    safeCall('b.goldSell', goldSell);"""
assert C_OLD in src, 'main loop anchor missing'
src = src.replace(C_OLD, C_NEW, 1)

C2_OLD = """    safeCall('b.goldLord', goldLord);"""
C2_NEW = """    safeCall('b.goldLord', goldLord);
    if (MODE === 'equip' || MODE === 'all') {
      safeCall('b.equipForgeUp', equipForgeUp);
      safeCall('b.equipCraft', equipCraft);
      safeCall('b.equipEnhance', equipEnhance);
      safeCall('b.equipWear', equipWear);
    }"""
assert C2_OLD in src, 'main loop equip anchor missing'
src = src.replace(C2_OLD, C2_NEW, 1)

# ---------------------------------------------------------------- 5. 快照附加
S_OLD = "    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\\n');"
S_NEW = """    if (MODE === 'buff' || MODE === 'all') {
      var pf2 = G.prodFactors('grain', st.cities[0]) || [], fm2 = 1;
      pf2.forEach(function (x) { fm2 *= (1 + x.d); });
      o.buff = { grainMult: +fm2.toFixed(2), units: { houji: BUFF.units.houji || 0, taozhu: BUFF.units.taozhu || 0 },
        spend: { prod: Math.round(BUFF.spend.prod), attr: Math.round(BUFF.spend.attr), corvee: Math.round(BUFF.spend.corvee) },
        gnz: (function () { var gg = G.guardGeneralOf(st.cities[0]); return gg ? guardNzOf(gg) : 0; })() };
    }
    if (MODE === 'equip' || MODE === 'all') {
      var fE = forgeCity();
      o.equip = { forge: fE ? fE.lv : 0, crafted: Object.keys(EQUIP.crafted).length, worn: EQUIP.wornCount,
        enhSum: ytIds().reduce(function (a2, x) { var i3 = G.eqFind(x); return a2 + (i3 ? G.eqEnhOf(i3) : 0); }, 0),
        spend: Math.round(EQUIP.spend.bp + EQUIP.spend.mat + EQUIP.spend.craft + EQUIP.spend.enh),
        gnz: (function () { var gg = G.guardGeneralOf(st.cities[0]); return gg ? guardNzOf(gg) : 0; })() };
    }
    fs.appendFileSync(SNAPS, JSON.stringify(o) + '\\n');"""
assert S_OLD in src, 'snapshot anchor missing'
src = src.replace(S_OLD, S_NEW, 1)

# ---------------------------------------------------------------- 6. 终局输出
F_OLD = "} catch (e) { noteErr('gold.final', e); }"
F_NEW = """} catch (e) { noteErr('gold.final', e); }
try {
  fs.writeFileSync(path.join(OUT, 'strat_final.json'), JSON.stringify({
    mode: MODE,
    buff: (MODE === 'buff' || MODE === 'all') ? { spend: BUFF.spend, units: BUFF.units, tFirst: BUFF.tFirst } : null,
    equip: (MODE === 'equip' || MODE === 'all') ? { spend: EQUIP.spend, crafted: Object.keys(EQUIP.crafted),
      worn: EQUIP.wornCount, wornGen: EQUIP.wornGen, tCraft1: EQUIP.tCraft1, tCraft12: EQUIP.tCraft12,
      tEnh120: EQUIP.tEnh120, tWorn12: EQUIP.tWorn12,
      enh: ytIds().map(function (x) { var i4 = G.eqFind(x); return { id: x, e: i4 ? G.eqEnhOf(i4) : -1 }; }) } : null,
    guards: st.cities.map(function (c) {
      var gg = G.guardGeneralOf(c);
      return gg ? { c: c.name, g: gg.name, r: G.rankOf(gg).name, lv: gg.level, nz: guardNzOf(gg) } : null;
    })
  }, null, 1));
} catch (e) { noteErr('strat.final', e); }"""
assert F_OLD in src, 'final anchor missing'
src = src.replace(F_OLD, F_NEW, 1)

# ---------------------------------------------------------------- 7. 状态行接入
L_OLD = "RUN(goldLine());"
assert src.count(L_OLD) >= 2, 'goldLine anchor missing'
src = src.replace(L_OLD, "RUN(goldLine() + stratLine());")

# ---------------------------------------------------------------- 8. 横幅
B_OLD = "RUN('=== v89.91 黄金流对照推演开始（GOLD v1） ===');"
B_NEW = "RUN('=== v89.92 多策略对照推演开始（STRAT v1 · MODE=' + MODE + '） ===');"
if B_OLD in src:
    src = src.replace(B_OLD, B_NEW, 1)

io.open(DST, 'w', encoding='utf-8').write(src)
print('OK  %s -> %s  (%d -> %d bytes)' % (os.path.basename(SRC), os.path.basename(DST), orig_len, len(src)))
