# -*- coding: utf-8 -*-
"""patch_play_600x_v2.py — 修复驾驶舱 v1 的三处逻辑缺陷并落盘（python 定点替换）。

背景：Edit 工具报成功但未落盘（本文件 v1 实测）。
修复项：
  ① 募兵循环在"精锐未解锁"处提前 return → 永远试不到义兵（五年一兵未募）
  ② 建造顺序与依赖链冲突（招贤馆 需客栈 Lv2）＋失败即停 → 主城建筑链卡死
  ③ 里程碑编队改用 takeArmy() 安全取兵
"""
import io

P = r'E:\Deepseekdb\.workbuddy\tools\playtest\play_600x.js'
s = io.open(P, encoding='utf-8', newline='').read()

def rep(old, new, tag, n=1):
    global s
    c = s.count(old)
    assert c == n, '%s: count=%d (期望 %d)' % (tag, c, n)
    s = s.replace(old, new, n)
    print('OK', tag)

# ---------- R12 版本标记 ----------
rep(
"RUN('=== v89.90 600× 推演开始 ===');",
"RUN('=== v89.90 600× 推演开始（HARNESS v2） ===');",
'R12-banner')

# ---------- R1 建造顺序 ----------
rep(
"""var BUILD_PRIO = [
  { bid: 'junying', want: 1 }, { bid: 'zhaoxianguan', want: 1 }, { bid: 'shuyuan', want: 1 },
  { bid: 'kezhan', want: 1 }, { bid: 'cangku', want: 1 }, { bid: 'shichang', want: 1 },
  { bid: 'fenghuotai', want: 1 }, { bid: 'honglusi', want: 1 }, { bid: 'yizhan', want: 1 },
  { bid: 'minfang', want: 6 }, { bid: 'majiu', want: 1 }, { bid: 'tiejiangpu', want: 1 },
  { bid: 'gongjiangzuofang', want: 1 }
];""",
"""var BUILD_PRIO = [
  /* v2：顺序按依赖链修正 —— v1 实测「招贤馆 需客栈 Lv2」，客栈必须先建 */
  { bid: 'junying', want: 1 }, { bid: 'shuyuan', want: 1 }, { bid: 'kezhan', want: 1 },
  { bid: 'zhaoxianguan', want: 1 }, { bid: 'cangku', want: 1 }, { bid: 'shichang', want: 1 },
  { bid: 'honglusi', want: 1 }, { bid: 'fenghuotai', want: 1 }, { bid: 'yizhan', want: 1 },
  { bid: 'minfang', want: 6 }, { bid: 'majiu', want: 1 }, { bid: 'tiejiangpu', want: 1 },
  { bid: 'gongjiangzuofang', want: 1 }
];""",
'R1-buildprio')

# ---------- R2 建造失败继续 ----------
rep(
"""    if (r && r.ok) { RUN('🏗 开建：' + it.bid + ' @格' + idx + '（队列 ' + st.queues.build.length + '/' + slots + '）'); continue; }
    if (r && !r.ok) { noteSoft('build.' + it.bid, r.msg); return; }""",
"""    if (r && r.ok) { RUN('🏗 开建：' + it.bid + ' @格' + idx + '（队列 ' + st.queues.build.length + '/' + slots + '）'); continue; }
    if (r && !r.ok) {
      noteSoft('build.' + it.bid, r.msg);
      if (/同时只能|队列/.test(r.msg || '')) return;   /* 队列满 → 本轮停 */
      continue;                                        /* 前置/资源不符 → 试下一个（真人也是先建能建的） */
    }""",
'R2-buildfail')

# ---------- R3 募兵重写 + takeArmy ----------
rep(
"""var TRAIN_QUEUE_MAP = {};
function tryTrain() {
  var target = armyTarget(), cur = totalArmy();
  if (cur >= target) return;
  var lack = target - cur;
  st.cities.forEach(function (city) {
    var jy = cellOf(city, 'junying');
    if (!jy) return;
    var busy = (st.queues.train || []).some(function (q) {
      return (q.cityId ? q.cityId === city.id : (TRAIN_QUEUE_MAP[city.id] && TRAIN_QUEUE_MAP[city.id] > tNow - 3600));
    });
    if (busy) return;
    setCity(city);
    for (var i = 0; i < TROOP_ORDER.length; i++) {
      var tid = TROOP_ORDER[i];
      var mc = safeCall('maxTrain.' + tid, function () { return G.maxTrainCount(tid, city.id, jy.idx); });
      var mcn = (typeof mc === 'number') ? mc : Number(mc && (mc.n || mc.count || mc.max) || 0);
      if (!(mcn > 0)) continue;
      var n = Math.min(mcn, Math.max(20, Math.floor(lack)));
      var r = safeCall('train.' + tid, function () { return G.train(tid, n, city.id, jy.idx); });
      if (r && r.ok) { TRAIN_QUEUE_MAP[city.id] = tNow; noteSoft('train.ok', '募兵 ' + tid + ' ×' + n); return; }
      if (r && !r.ok) { noteSoft('train.' + tid, r.msg); return; }
    }
  });
}""",
"""function tryTrain() {
  if ((st.queues.train || []).length >= 4) return;     /* 队列已有 4 批 → 先等 */
  var target = armyTarget(), cur = totalArmy();
  if (cur >= target) return;
  var lack = target - cur;
  st.cities.forEach(function (city) {
    var jy = cellOf(city, 'junying');
    if (!jy) return;
    setCity(city);
    /* v2：从精锐到基础逐个尝试 —— **未解锁的兵种要跳过继续试后面的**
       （v1 在第一个失败处 return —— 永远试不到义兵，五年一兵未募的根因） */
    var lastFail = '';
    for (var i = 0; i < TROOP_ORDER.length; i++) {
      var tid = TROOP_ORDER[i];
      var mc = safeCall('maxTrain.' + tid, function () { return G.maxTrainCount(tid, city.id, jy.idx); });
      var mcn = (typeof mc === 'number') ? mc : Number(mc && (mc.n || mc.count || mc.max) || 0);
      if (!(mcn > 0)) continue;
      var n = Math.min(mcn, Math.max(20, Math.floor(lack)));
      var r = safeCall('train.' + tid, function () { return G.train(tid, n, city.id, jy.idx); });
      if (r && r.ok) { noteSoft('train.ok', '募兵 ' + tid + ' ×' + n); return; }
      if (r && !r.ok) { lastFail = r.msg || ''; continue; }
    }
    if (lastFail) noteSoft('train.fail', lastFail);
  });
}
/* v2：编队取兵 —— 按 prefer 顺序从城内抽 n 名（不超实有） */
function takeArmy(city, n, order) {
  order = order || ['tieji', 'qingji', 'changqiang', 'daodun', 'gongjian', 'yibing'];
  var out = {}, need = n;
  order.forEach(function (tid) {
    if (need <= 0) return;
    var have = city.army[tid] || 0;
    var use = Math.min(have, need);
    if (use > 0) { out[tid] = use; need -= use; }
  });
  var tot = 0; for (var k in out) tot += out[k];
  return { army: out, total: tot };
}""",
'R3-train')

# ---------- R4 采集取兵 ----------
rep(
"""  var c0 = st.cities[0];
  setCity(c0);
  var army = null;
  var pool = c0.army || {};
  if ((pool.minfu || 0) >= 50) army = { minfu: Math.min(pool.minfu, 400) };
  else if ((pool.yibing || 0) >= 100) army = { yibing: Math.min(pool.yibing, 300) };
  if (!army) return;""",
"""  var c0 = st.cities[0];
  setCity(c0);
  var tkG = takeArmy(c0, 300, ['minfu', 'yibing', 'changqiang']);
  if (tkG.total < 50) return;
  var army = tkG.army;""",
'R4-gather')

# ---------- R5 raid1 ----------
rep(
"""      setCity(st.cities[0]);
      var r = G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'raid',
        { yibing: Math.min(280, Math.floor((st.cities[0].army.yibing || 0) * 0.7) || 200) }, gen.id);""",
"""      setCity(st.cities[0]);
      var tk1 = takeArmy(st.cities[0], 280);
      if (tk1.total < 120) return 'wait';
      var r = G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'raid', tk1.army, gen.id);""",
'R5-raid1')

# ---------- R6 occupy1 ----------
rep(
"""      if (totalArmy() < 600) return 'wait';
      var gen = idleGen(true); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var r = G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy',
        { yibing: 400 }, gen.id);""",
"""      if (totalArmy() < 500) return 'wait';
      var gen = idleGen(true); if (!gen) return 'wait';
      var spot = findWildSpot(2, false); if (!spot) return 'wait';
      setCity(st.cities[0]);
      var tk2 = takeArmy(st.cities[0], 600);
      if (tk2.total < 350) return 'wait';
      var r = G.march.dispatch({ kind: 'wild', x: spot.x, y: spot.y }, 'occupy', tk2.army, gen.id);""",
'R6-occupy1')

# ---------- R7 fort1 ----------
rep(
"""      setCity(st.cities[0]);
      var r = G.march.dispatch({ kind: 'fort', x: spot.x, y: spot.y }, 'raid',
        { yibing: Math.min(2000, Math.floor(st.cities[0].army.yibing || 0)) || 800 }, gen.id);""",
"""      setCity(st.cities[0]);
      var tk3 = takeArmy(st.cities[0], 2500);
      if (tk3.total < 1200) return 'wait';
      var r = G.march.dispatch({ kind: 'fort', x: spot.x, y: spot.y }, 'raid', tk3.army, gen.id);""",
'R7-fort1')

# ---------- R8 fort2 ----------
rep(
"""      setCity(st.cities[0]);
      var n = Math.min(8000, Math.floor(totalArmy() * 0.5));
      var army = {};
      var need = n;
      ['changqiang', 'daodun', 'gongjian', 'yibing', 'qingji'].forEach(function (tid) {
        var have = (st.cities[0].army[tid] || 0);
        var use = Math.min(have, need);
        if (use > 0) { army[tid] = use; need -= use; }
      });
      if (need > 0) return 'wait';
      var r = G.march.dispatch({ kind: 'fort', x: spot.x, y: spot.y }, 'raid', army, gen.id);""",
"""      setCity(st.cities[0]);
      var tk4 = takeArmy(st.cities[0], Math.min(8000, Math.floor(totalArmy() * 0.5)));
      if (tk4.total < 3000) return 'wait';
      var r = G.march.dispatch({ kind: 'fort', x: spot.x, y: spot.y }, 'raid', tk4.army, gen.id);""",
'R8-fort2')

# ---------- R9 npcAtk ----------
rep(
"""      setCity(c0);
      var army = {}; var need = Math.floor(totalArmy() * 0.8);
      ['tieji', 'qingji', 'changqiang', 'daodun', 'gongjian', 'yibing'].forEach(function (tid) {
        var have = c0.army[tid] || 0;
        var use = Math.min(have, need);
        if (use > 0) { army[tid] = use; need -= use; }
      });
      var r = G.march.dispatch({ kind: 'city', id: npc.id, npc: npc }, 'raid', army, gen.id);""",
"""      setCity(c0);
      var tk5 = takeArmy(c0, Math.floor(totalArmy() * 0.8));
      var r = G.march.dispatch({ kind: 'city', id: npc.id, npc: npc }, 'raid', tk5.army, gen.id);""",
'R9-npcAtk')

# ---------- R10 dumps ----------
rep(
"""  if (tNow === 600) {
    dumpOnce('quests', st.quests, 30);
    var gl0 = G.gatherList(); if (gl0 && gl0[0]) dumpOnce('gatherRec', gl0[0], 30);
    var mr0 = (st.marches || [])[0]; if (mr0) dumpOnce('marchRec', mr0, 30);
    var gd0 = st.generals[0]; if (gd0) dumpOnce('genRec', gd0, 40);
  }""",
"""  if (tNow === 600) {
    dumpOnce('quests', st.quests, 30);
    var gl0 = G.gatherList(); if (gl0 && gl0[0]) dumpOnce('gatherRec', gl0[0], 30);
    var mr0 = (st.marches || [])[0]; if (mr0) dumpOnce('marchRec', mr0, 30);
    var gd0 = st.generals[0]; if (gd0) dumpOnce('genRec', gd0, 40);
    var tq0 = (st.queues.train || [])[0]; if (tq0) dumpOnce('trainQ', tq0, 20);
    var qb0 = (st.queues.build || [])[0]; if (qb0) dumpOnce('buildQ', qb0, 20);
    dumpOnce('stats', st.stats, 40);
    dumpOnce('world', st.world, 40);
  }""",
'R10-dumps')

# ---------- R11 battleRec dump ----------
rep(
"""    if (rec._seen === 1) {
      BATTLE_SEEN++;
      var tn = rec.target && (rec.target.name || ('(' + rec.target.x + ',' + rec.target.y + ')'));
      if (BATTLE_SEEN <= 30) RUN('⚔ 战斗挂起 #' + BATTLE_SEEN + '：' + tn + ' · ' + rec.modeId + '（观战 60s/回合，稍后一键结算）');
    }""",
"""    if (rec._seen === 1) {
      BATTLE_SEEN++;
      var tn = rec.target && (rec.target.name || ('(' + rec.target.x + ',' + rec.target.y + ')'));
      if (BATTLE_SEEN <= 30) RUN('⚔ 战斗挂起 #' + BATTLE_SEEN + '：' + tn + ' · ' + rec.modeId + '（观战 60s/回合，稍后一键结算）');
      if (BATTLE_SEEN === 1) dumpOnce('battleRec', rec, 40);
    }""",
'R11-battleRec')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ALL PATCHED · bytes =', len(s.encode('utf-8')))
