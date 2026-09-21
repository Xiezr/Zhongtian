# -*- coding: utf-8 -*-
"""patch_play_600x_v4.py — 幂等补丁：采集前置（须自家野地）+ 持续占领 + 里程碑时序。

实测发现：
  · 采集要"先占领该野地" —— 需要 keepOccupying 先铺地，采集才可用
  · 里程碑 `break` 逻辑在乱序数组下会提前中断（scout1 挡住 city2）→ 改 continue
  · city2/scout1/city3/npcIntel 时间点前移（覆盖 6h 会话的中段）
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

# ---------- 1. 里程碑循环：break → continue ----------
rep_if(
"""    if (m.done) continue;
    if (tNow < m.at) break;""",
"""    if (m.done) continue;
    if (tNow < m.at) continue;   /* v3：数组非严格按 at 排序，break 会挡住后面的里程碑 */""",
'P1-mile-loop', "数组非严格按 at 排序")

# ---------- 2. 里程碑时间点前移 ----------
rep_if("{ id: 'city2', at: 3600, done: false", "{ id: 'city2', at: 1400, done: false", 'P2-city2', "id: 'city2', at: 1400")
rep_if("{ id: 'scout1', at: 4800, done: false", "{ id: 'scout1', at: 2400, done: false", 'P3-scout1', "id: 'scout1', at: 2400")
rep_if("{ id: 'city3', at: 12000, done: false", "{ id: 'city3', at: 4800, done: false", 'P4-city3', "id: 'city3', at: 4800")
rep_if("{ id: 'npcIntel', at: 14400, done: false", "{ id: 'npcIntel', at: 9600, done: false", 'P5-npcIntel', "id: 'npcIntel', at: 9600")

# ---------- 3. 自家野地采集点 + 持续占领 ----------
rep_if(
"""function findFortSpot(maxLv, radius) {""",
"""/* v3：只采**自家**野地（实测 '需先占领该野地，方可派军采集'） */
function findOwnGatherSpot() {
  var resOf = (DATA.GATHER && DATA.GATHER.resOf) || {};
  var busyList = G.gatherList() || [];
  var best = null;
  (st.wilds || []).forEach(function (w) {
    if (best) return;
    var tl = G.map.tile(w.x, w.y);
    if (!tl || !resOf[tl.terrain]) return;
    var busy = busyList.some(function (g) { return g.x === w.x && g.y === w.y; });
    if (busy) return;
    best = { x: w.x, y: w.y, lv: w.level || 1 };
  });
  return best;
}
function findFortSpot(maxLv, radius) {""",
'P6-ownGatherSpot', 'findOwnGatherSpot')

rep_if(
"""  var gen = idleGen(false);
  if (!gen) return;
  var spot = findWildSpot(9, true);
  if (!spot) { noteSoft('gather.spot', '周边未找到可采地块'); return; }""",
"""  var gen = idleGen(false);
  if (!gen) return;
  var spot = findOwnGatherSpot();
  if (!spot) { noteSoft('gather.spot', '暂无自家野地可采（待占领）'); return; }""",
'P7-gather-own', '暂无自家野地可采')

# ---------- 4. keepOccupying ----------
rep_if(
"""/* 5.6 秘境种田 */""",
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
}

/* 5.6 秘境种田 */""",
'P8-keepOccupying', 'keepOccupying')

rep_if(
"""    safeCall('b.gatherFin', finishRipeGathers);""",
"""    safeCall('b.gatherFin', finishRipeGathers);
    safeCall('b.occupy', keepOccupying);""",
'P9-brain-call', "safeCall('b.occupy'")

# ---------- 5. 战斗结果日志行 ----------
rep_if(
"""      fs.appendFileSync(BATTLES, JSON.stringify(row) + '\\n');""",
"""      fs.appendFileSync(BATTLES, JSON.stringify(row) + '\\n');
      if (BATTLE_SEEN <= 80) RUN('⚔ 战果：' + row.target + ' · ' + row.mode + ' · ' + (row.winner === 'atk' ? '胜' : '败') + ' · ' + row.rounds + ' 回合 · 损 ' + row.atkLoss + ' vs 敌损 ' + row.defLoss);""",
'P10-battle-line', '⚔ 战果')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ALL DONE · bytes =', len(s.encode('utf-8')))
