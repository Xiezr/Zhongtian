# -*- coding: utf-8 -*-
"""patch_play_600x_v5.py — 幂等补丁（v4）：真人操作补齐。

四类补丁：
  ① findWildSpot 跳过自家野地（否则占领/采集扫描永远命中同一块）
  ② keepOccupying 改为「只占可采地形」（采集前置；平原留给筑城）
  ③ 筑城链修正：筑城 = 先占**平原**野地 → buildCityAt 于其上（canBuildCityAt 实测要求）
  ④ 新增：驻军回城（doWildWithdraw）+ 市场售粮换金（marketSell，设计内的黄金入口）
  ⑤ 快照补 stats/garrison；seed 购买阈值提高
"""
import io

P = r'E:\Deepseekdb\.workbuddy\tools\playtest\play_600x.js'
s = io.open(P, encoding='utf-8', newline='').read()

def rep_if(old, new, tag, marker):
    global s
    if marker in s:
        print('SKIP %s (already)' % tag)
        return
    c = s.count(old)
    assert c == 1, '%s: old count=%d (期望 1)' % (tag, c)
    s = s.replace(old, new, 1)
    print('OK   %s' % tag)

# ---------- ① findWildSpot 跳过自家野地 ----------
rep_if(
"""        if (G.map.npcAt(x, y) || G.map.ownCityAt(x, y) || G.map.fortAt(x, y)) continue;
        if (forGather && !resOf[tl.terrain]) continue;""",
"""        if (G.map.npcAt(x, y) || G.map.ownCityAt(x, y) || G.map.fortAt(x, y)) continue;
        if (G.map.wildAt(x, y)) continue;   /* v4：已是我方野地（跳过，否则永远命中同一块） */
        if (forGather && !resOf[tl.terrain]) continue;""",
'V5-1-wildskip', '已是我方野地（跳过')

# ---------- ② keepOccupying → 只占可采地形 ----------
rep_if(
"""/* 5.5b 持续占领自家野地（采集前置；v3 实测发现） */
var OCCUPY_LAST = -1e9;
function keepOccupying() {
  if ((st.wilds || []).length >= 4) return;
  if (tNow - OCCUPY_LAST < 240) return;
  if (totalArmy() < 400) return;
  var gen = idleGen(true); if (!gen) return;
  var spot = findWildSpot(3, false);
  if (!spot) return;
  if (G.map.wildAt(spot.x, spot.y)) return;   /* 已是自家野地 */
  setCity(st.cities[0]);
  var tk = takeArmy(st.cities[0], 400);
  if (tk.total < 280) return;
  var r = safeCall('occupy.auto', function () { return G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk.army, gen.id); });
  OCCUPY_LAST = tNow;
  if (r && r.ok) noteSoft('occupy.ok', '占领野地 Lv' + spot.lv + ' @' + spot.x + ',' + spot.y);
  if (r && !r.ok) noteSoft('occupy.auto', r.msg);
}""",
"""/* 5.5b 持续占领**可采地形**野地（采集的前置；v4：平原留给筑城，见 city2/city3） */
var OCCUPY_LAST = -1e9;
function ownedGatherable() {
  var resOf = (DATA.GATHER && DATA.GATHER.resOf) || {};
  return (st.wilds || []).filter(function (w) {
    var tl = G.map.tile(w.x, w.y);
    return tl && resOf[tl.terrain];
  });
}
function keepOccupying() {
  if (ownedGatherable().length >= 3) return;
  if (tNow - OCCUPY_LAST < 240) return;
  if (totalArmy() < 400) return;
  var gen = idleGen(true); if (!gen) return;
  var spot = findWildSpot(4, true);
  if (!spot) return;
  setCity(st.cities[0]);
  var tk = takeArmy(st.cities[0], 400);
  if (tk.total < 280) return;
  var r = safeCall('occupy.auto', function () { return G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk.army, gen.id); });
  OCCUPY_LAST = tNow;
  if (r && r.ok) noteSoft('occupy.ok', '占领可采野地 Lv' + spot.lv + '（' + spot.terrain + '）@' + spot.x + ',' + spot.y);
  if (r && !r.ok) noteSoft('occupy.auto', r.msg);
}

/* 5.5c 驻军回城（占领后留守的兵撤回，否则兵力沉在野地） */
var WD_LAST = -1e9;
function tryWithdraw() {
  if (tNow - WD_LAST < 480) return;
  (st.wilds || []).slice().forEach(function (w) {
    if (!w.garrison || !G.wildGarrisonTotal(w.garrison)) return;
    var r = safeCall('withdraw', function () { return G.doWildWithdraw(w.x, w.y); });
    WD_LAST = tNow;
    if (r && r.ok) noteSoft('withdraw.ok', r.msg);
    if (r && !r.ok) noteSoft('withdraw', r.msg);
  });
}

/* 5.5d 市场售粮换金（设计内的黄金入口：粮→金，平价恒定 ≈ 1 金 / 6.7 粮） */
var SELL_LAST = -1e9;
function tryMarketSell() {
  if (tNow - SELL_LAST < 240) return;
  var gold = st.res.gold || 0;
  if (gold > 150000) return;                 /* 金够用就不卖 */
  var grain = st.res.grain || 0;
  if (grain < 900000) return;                /* 先保 60 万粮底 */
  var amount = Math.min(grain - 600000, 800000);
  if (amount < 10000) return;
  var r = safeCall('market.sell', function () { return G.marketSell('grain', amount); });
  SELL_LAST = tNow;
  if (r && r.ok) noteSoft('market.sell', r.msg);
  if (r && !r.ok) noteSoft('market.sellfail', r.msg);
}""",
'V5-2-occupy', 'ownedGatherable')

# ---------- ③ 筑城链：先占平原 ----------
rep_if(
"""function findFortSpot(maxLv, radius) {""",
"""/* v4：找一块**无主平原**（筑城用；先占后筑） */
function findPlainSpot() {
  var c0 = st.cities[0];
  for (var rr = 3; rr <= 20; rr++) {
    for (var dy = -rr; dy <= rr; dy++) for (var dx = -rr; dx <= rr; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
      var x = c0.x + dx, y = c0.y + dy;
      if (x < 3 || y < 3 || x >= DATA.MAP_W - 3 || y >= DATA.MAP_H - 3) continue;
      var tl = G.map.tile(x, y);
      if (!tl || tl.terrain !== 'plain') continue;
      if (G.map.wildAt(x, y) || G.map.npcAt(x, y) || G.map.ownCityAt(x, y) || G.map.fortAt(x, y)) continue;
      return { x: x, y: y };
    }
  }
  return null;
}
var MILE_TS = {};
/* 筑城准备：有自家平原 → 直接用；没有 → 遣军占一块平原（带冷却） */
function ensurePlainForCity(tag) {
  var plain = null;
  (st.wilds || []).forEach(function (w) { if (!plain && w.type === 'plain') plain = w; });
  if (plain) return { have: true, w: plain };
  if (tNow - (MILE_TS['occ_' + tag] || 0) < 600) return { have: false };
  var gen = idleGen(true); if (!gen) return { have: false };
  var spot = findPlainSpot(); if (!spot) return { have: false };
  setCity(st.cities[0]);
  var tk = takeArmy(st.cities[0], 400);
  if (tk.total < 280) return { have: false };
  var r = safeCall(tag + '.occ', function () { return G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk.army, gen.id); });
  MILE_TS['occ_' + tag] = tNow;
  if (r && r.ok) RUN('🏯 为筑城先占平原 @' + spot.x + ',' + spot.y + '（' + tag + '）');
  if (r && !r.ok) noteSoft(tag + '.occ', r.msg);
  return { have: false };
}
function findFortSpot(maxLv, radius) {""",
'V5-3-plain', 'ensurePlainForCity')

# city2 函数体替换（旧：扫描任意格 canBuildCityAt）
rep_if(
"""      if (st.cities.length >= 2) return 'ok';
      if (yNow() < 1.2) return 'wait';
      var c0 = st.cities[0];
      for (var rr = 4; rr <= 16; rr++) {
        for (var dy = -rr; dy <= rr; dy++) for (var dx = -rr; dx <= rr; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
          var x = c0.x + dx, y = c0.y + dy;
          if (x < 3 || y < 3 || x >= DATA.MAP_W - 3 || y >= DATA.MAP_H - 3) continue;
          var chk = safeCall('canCity', function () { return G.canBuildCityAt(x, y); });
          if (!chk || !chk.ok) continue;
          setCity(c0);
          var r = safeCall('city2', function () { return G.buildCityAt(x, y); });
          if (r && r.ok) { RUN('🏯 筑第二城 @' + x + ',' + y + '：' + r.msg); return 'ok'; }
          if (r && !r.ok) { noteSoft('city2', r.msg); return 'wait'; }
        }
      }
      return 'wait';
    } },""",
"""      if (st.cities.length >= 2) return 'ok';
      if (yNow() < 1.2) return 'wait';
      var g2 = ensurePlainForCity('city2');
      if (!g2.have) return 'wait';
      setCity(st.cities[0]);
      var r2r = safeCall('city2', function () { return G.buildCityAt(g2.w.x, g2.w.y); });
      if (r2r && r2r.ok) { RUN('🏯 筑第二城 @' + g2.w.x + ',' + g2.w.y + '：' + r2r.msg); return 'ok'; }
      if (r2r && !r2r.ok) { noteSoft('city2', r2r.msg); return 'wait'; }
      return 'wait';
    } },""",
'V5-4-city2', "ensurePlainForCity('city2')")

# city3 函数体替换
rep_if(
"""      if (st.cities.length >= 3) return 'ok';
      var c0 = st.cities[0];
      for (var rr = 4; rr <= 18; rr++) {
        for (var dy = -rr; dy <= rr; dy++) for (var dx = -rr; dx <= rr; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
          var x = c0.x + dx, y = c0.y + dy;
          if (x < 3 || y < 3 || x >= DATA.MAP_W - 3 || y >= DATA.MAP_H - 3) continue;
          var chk = safeCall('canCity3', function () { return G.canBuildCityAt(x, y); });
          if (!chk || !chk.ok) continue;
          setCity(c0);
          var r = safeCall('city3', function () { return G.buildCityAt(x, y); });
          if (r && r.ok) { RUN('🏯 筑第三城 @' + x + ',' + y + '：' + r.msg); return 'ok'; }
          if (r && !r.ok) { noteSoft('city3', r.msg); return 'wait'; }
        }
      }
      return 'wait';
    } },""",
"""      if (st.cities.length >= 3) return 'ok';
      var g3 = ensurePlainForCity('city3');
      if (!g3.have) return 'wait';
      setCity(st.cities[0]);
      var r3r = safeCall('city3', function () { return G.buildCityAt(g3.w.x, g3.w.y); });
      if (r3r && r3r.ok) { RUN('🏯 筑第三城 @' + g3.w.x + ',' + g3.w.y + '：' + r3r.msg); return 'ok'; }
      if (r3r && !r3r.ok) { noteSoft('city3', r3r.msg); return 'wait'; }
      return 'wait';
    } },""",
'V5-5-city3', "ensurePlainForCity('city3')")

# ---------- ④ 脑内调用 ----------
rep_if(
"""    safeCall('b.occupy', keepOccupying);""",
"""    safeCall('b.occupy', keepOccupying);
    safeCall('b.withdraw', tryWithdraw);
    safeCall('b.market', tryMarketSell);""",
'V5-6-brain', "safeCall('b.market'")

# ---------- ⑤ 快照补 stats/garrison ----------
rep_if(
"""    o.auto = {
      up: (st.autoState && st.autoState.msg) || '', tech: (st.autoTechState && st.autoTechState.msg) || '',
      march: (st.autoMarchInfo && st.autoMarchInfo.msg) || ''
    };""",
"""    o.auto = {
      up: (st.autoState && st.autoState.msg) || '', tech: (st.autoTechState && st.autoTechState.msg) || '',
      march: (st.autoMarchInfo && st.autoMarchInfo.msg) || ''
    };
    try {
      o.stats2 = { trained: (st.stats && st.stats.trained) || 0, wins: (st.stats && st.stats.wins) || 0,
        raid: (st.stats && st.stats.raidCount) || 0, conquer: (st.stats && st.stats.conquer) || 0,
        build: (st.stats && st.stats.buildDone) || 0, tech: (st.stats && st.stats.techDone) || 0,
        recruited: (st.stats && st.stats.recruited) || 0, trades: (st.stats && st.stats.trades) || 0 };
      o.garrison = (st.wilds || []).reduce(function (s2, w) { return s2 + (w.garrison ? G.wildGarrisonTotal(w.garrison) : 0); }, 0);
    } catch (e) {}""",
'V5-7-snap', 'o.stats2')

# ---------- ⑥ seed 购买阈值 200k → 300k ----------
rep_if(
"""  if ((st.items.seed_fan || 0) < 2 && (st.res.gold || 0) > 200000 && G.farmOf().plots.some(function (p) { return !p; })) {""",
"""  if ((st.items.seed_fan || 0) < 2 && (st.res.gold || 0) > 300000 && G.farmOf().plots.some(function (p) { return !p; })) {""",
'V5-8-seed', '(st.res.gold || 0) > 300000')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ALL DONE · bytes =', len(s.encode('utf-8')))
