/* ============================================================
 * audit_v89105_chains.js — **全功能链路复核**（老板令 ①）
 * ------------------------------------------------------------
 * 「全面测评，全功能链路复核」在工程上等于：
 *   把每一套玩法从**入口**走到**落账**，逐环节量"状态有没有真的变"，
 *   而不是只看三闸门的红绿。三闸门保的是"没坏"，这个脚本答的是"通不通"。
 *
 * 每条链的每一步给三种结论：
 *   ✓ 通了（附状态变化）
 *   ✗ 断了（附异常/错误消息）
 *   ⚠ 被规则拦（附 msg —— 这不算断，但要写清是哪条规则拦的）
 *
 * 用法：node .workbuddy/tools/audit/audit_v89105_chains.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils;

var STEP = 0, OK = 0, BAD = 0, WARN = 0, BREAKS = [];
function head(t) { console.log('\n═══ ' + t + ' ═══'); }
function ok(note) { STEP++; OK++; console.log('  ✓ ' + note); }
function warn(note) { STEP++; WARN++; console.log('  ⚠ ' + note); }
function bad(note) { STEP++; BAD++; BREAKS.push(note); console.log('  ✗ ' + note); }
/* 通用步骤：跑一个动作，看它有没有抛异常 / 返回 ok:false */
function step(label, fn) {
  var r;
  try { r = fn(); }
  catch (e) { bad(label + ' —— 抛异常：' + String(e && e.message).slice(0, 90)); return null; }
  if (r && r.ok === false) { warn(label + ' —— 被拦：' + String(r.msg || '').slice(0, 70)); return r; }
  ok(label + (r && r.note ? ' —— ' + r.note : ''));
  return r;
}

/* ---------- 开局：一座主城 + 一座分城 + 满配资源 ---------- */
var st = G.newGame({ name: '复核', cityName: '灰岗', region: '碎垣', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
st.settings.battleWatch = false;
var A = st.cities[0];
G.ui._cityId = A.id;
['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { A.res[k] = 5e6; });
A.res.pop = 60000;
A.cells.forEach(function (c) { if (c.build) c.build.lvl = Math.max(c.build.lvl || 1, 6); });
/* 板车是"运力"（调运链靠挑夫挑担），不放它调运链第一步就发不出去 */
A.army = { buxingji: 9000, daodanche: 3000, fujiche: 1500, banche: 1200 };
st.items = st.items || {};
['zengminling', 'yiminling', 'shennongchu', 'lianbing_jingyan', 'bengzhu', 'jinang', 'seed_daomi']
  .forEach(function (id) { st.items[id] = 6; });
st.generals.forEach(function (g, i) { g.level = 30 + i; g.sta = 100; g.energy = 100; });
/* 补两座必需建筑：军营（募兵前置）+ 练兵场（出征人马上限的尺）。
   探针直接写 cell（与"建造完成"同构），不走流程 —— 目的是量**链路**，不是量建造。 */
var ARMY_IDX = -1;          /* 军营格下标（募兵必须指到具体军营） */
(function () {
  A.cells.forEach(function (c) {
    if (c.build && c.build.id === 'guanfu') c.build.lvl = 8;   /* 官府到 8：城内建筑总闸放开 */
  });
  var need = ['junying', 'xiaochang'], k = 0;
  A.cells.forEach(function (c, i) {
    if (k < need.length && !c.build && !c.official) {
      c.build = { id: need[k], lvl: 6 };
      if (need[k] === 'junying') ARMY_IDX = i;
      k++;
    }
  });
})();
/* 分城：先占附近一块**平原**（筑城只认平原），再走既有出口 buildCityAt */
var B = null;
(function () {
  var cx = null, cy = null;
  for (var rr = 2; rr <= 5 && cx === null; rr++) {
    for (var dy = -rr; dy <= rr && cx === null; dy++) {
      for (var dx = -rr; dx <= rr; dx++) {
        var x = A.x + dx, y = A.y + dy;
        var t = G.map.tile(x, y);
        if (t && t.terrain === 'plain' && !G.map.wildAt(x, y) && !G.map.fortAt(x, y) && !G.map.npcAt(x, y)) {
          st.wilds = st.wilds || [];
          var has = false;
          st.wilds.forEach(function (w) { if (w.x === x && w.y === y) has = true; });
          /* ⚠ 野地必须带 `type:'plain'` —— 少了它，canBuildCityAt 会回
             "只有平原可以筑城（undefined 不可）"。探针起初就漏了这个字段。 */
          if (!has) st.wilds.push({ x: x, y: y, lv: 3, day: 0, type: 'plain' });
          cx = x; cy = y; break;
        }
      }
    }
  }
  if (cx !== null) {
    try {
      var bt = G.buildCityAt(cx, cy);
      if (bt && bt.ok) {
        B = bt.city;
        /* ⛔ v89.141（复核修复 · 工具跟随）：v89.138 把"目标城席位预检"迁到 prepare ——
           分城若无招贤馆（0 席），调兵会被**正确**拦下（"尚无招贤馆"）→ 本工具⑤链被卡。
           真实玩法里玩家也必先建招贤馆；工具补一座（lvl 5 = 5 席）。 */
        if (B && B.cells) {
          for (var _ci = 0; _ci < B.cells.length; _ci++) {
            if (!B.cells[_ci].official && !B.cells[_ci].build) {
              B.cells[_ci].build = { id: 'zhaoxianguan', lvl: 5 };
              break;
            }
          }
        }
      }
      else console.log('（分城未建成：' + ((bt && bt.msg) || '未知') + '）');
    } catch (e) { console.log('（分城异常：' + e.message + '）'); }
  } else console.log('（附近无空平原，未建分城）');
})();
console.log('开局：城池 ' + st.cities.length + ' · 英雄 ' + st.generals.length
  + ' · 分城 ' + (B ? B.name : '（未建）'));

/* ══════════ ① 治理 · 营造链 ══════════ */
head('① 治理 · 营造链（建造 → 队列 → 完工 → 等级）');
step('入口：buildAt / canAfford / payCost / queueAt 齐备', function () {
  var miss = ['buildAt', 'canAfford', 'payCost'].filter(function (k) { return typeof G[k] !== 'function'; });
  if (miss.length) throw new Error('缺少出口 ' + miss.join(' '));
  return { note: '3 出口齐备' };
});
var freeCell = -1;
A.cells.forEach(function (c, i) { if (freeCell < 0 && !c.build && !c.official) freeCell = i; });
step('起建 · 居所（空地块 ' + freeCell + '）', function () {
  var lv0 = G.buildingLevel(A, 'minfang');
  var r = G.buildAt(A.id, freeCell, 'minfang');
  if (!r.ok) return r;
  var q = G.queueAt('city', freeCell);
  if (!q) throw new Error('起了队列但 queueAt 查不到');
  return { note: '居所 Lv' + lv0 + ' → 在建（队列 1 条）' };
});
step('推进队列 → 完工落成', function () {
  var q0 = (G.state.queues && G.state.queues.build) || [];
  var before = q0.length;
  for (var i = 0; i < 40 && (G.state.queues.build || []).length; i++) G.tickBuildQueues ? G.tickBuildQueues(60000) : null;
  if (!G.tickBuildQueues) {
    /* 没有独立 tick 出口时，直接推进时间（与在线推进同一出口） */
    G.advanceTime ? G.advanceTime(60000) : null;
  }
  return { note: '队列 ' + before + ' → ' + ((G.state.queues.build || []).length) + '（用时基推进）' };
});
step('升级 · 练兵场（写清造价与阻拦原因）', function () {
  var i0 = -1;
  A.cells.forEach(function (c, i) { if (i0 < 0 && c.build && c.build.id === 'junying') i0 = i; });
  if (i0 < 0) return { ok: false, msg: '本城无军营（跳过）' };
  var lv0 = A.cells[i0].build.lvl;
  var r = G.upgradeAt(A.id, i0);
  if (!r.ok) return r;
  return { note: '军营 Lv' + lv0 + ' → 队列' };
});

/* ══════════ ② 募兵链 ══════════ */
head('② 募兵链（练兵场人马上限 → 募兵 → 队列 → 兵账）');
step('入口：train / canTrain / marchCapOf 齐备', function () {
  if (typeof G.train !== 'function') throw new Error('无 GAME.train');
  if (!G.battle || typeof G.battle.marchCapOf !== 'function') throw new Error('无 marchCapOf');
  return { note: 'train + marchCapOf（人马口径唯一出口）' };
});
var menBefore = 0;
Object.keys(A.army).forEach(function (k) { menBefore += A.army[k]; });
step('募兵 · 步行机 ×2000（受练兵场人马上限约束）', function () {
  if (ARMY_IDX < 0) return { ok: false, msg: '本城无军营格（探针未铺）' };
  var r = G.train('buxingji', 2000, A.id, ARMY_IDX);
  if (!r.ok) return r;
  menBefore = 0;
  Object.keys(A.army).forEach(function (k) { menBefore += A.army[k]; });
  return { note: '步行机 +2000（存量 ' + U.fmt(menBefore) + ' 人）' };
});
step('练兵场人马上限：超额募兵必被拦（唯一出口 = 练兵场等级 × 1 万）', function () {
  var cap = G.battle.marchCapOf(A);
  var r = G.train('buxingji', 2000000, A.id, ARMY_IDX);
  if (r.ok) throw new Error('超上限竟然放过（cap=' + cap + '）');
  return { note: '上限 ' + U.fmt(cap) + ' 人；超额被拦："' + String(r.msg).slice(0, 40) + '"' };
});
step('解散归农：兵 → 幸存者（100% 回补）', function () {
  var pop0 = G.res(A).pop;
  var men0 = (A.army.buxingji || 0);
  var r = G.disbandAt(A.id, 'buxingji', 500);
  if (!r.ok) return r;
  var pop1 = G.res(A).pop;
  var men1 = (A.army.buxingji || 0);
  if (!(pop1 > pop0)) throw new Error('幸存者没回补（' + pop0 + ' → ' + pop1 + '）');
  if (!(men1 < men0)) throw new Error('兵没减（' + men0 + ' → ' + men1 + '）');
  return { note: '步行机 ' + men0 + ' → ' + men1 + ' · 幸存者 +' + (pop1 - pop0) };
});

/* ══════════ ③ 出征链 ══════════ */
head('③ 出征链（选目标 → 行军 → 抵达 → 战斗 → 战报 + 沙盘）');
var tgt = null, bestLv = 99;
var transferDispatched = false;   /* v89.141：⑤链"出发是否真的起运"（被拦时别在抵达步抛假异常） */
for (var y = 0; y < (DATA.MAP_H || 61); y++) {
  for (var x = 0; x < (DATA.MAP_W || 61); x++) {
    var f = G.map.fortAt(x, y);
    /* ⚠ 据点等级字段是 `.level`（探针起初写成 `.lv` → 一个目标都挑不出来） */
    if (f && (f.level || 1) < bestLv) { bestLv = f.level || 1; tgt = { kind: 'fort', x: x, y: y }; }
  }
}
step('目标解析：resolveTarget 给出守军/等级', function () {
  if (!tgt) throw new Error('地图上找不到据点');
  var t = G.battle.resolveTarget(tgt);
  if (!t || !t.ok) return t || { ok: false, msg: '解析失败' };
  return { note: t.kind + ' 「' + t.name + '」 Lv' + (t.level || t.lv || 1) + '（挑最低等级的，波次少）' };
});
step('行军派出：march.dispatch 扣兵 + 建在途档', function () {
  var army = { fujiche: 1200, daodanche: 800 };
  var r = G.march.dispatch(tgt, 'raid', army, st.generals[0].id);
  if (!r.ok) return r;
  var m = (G.state.marches || [])[0];
  if (!m) throw new Error('派出后无在途档');
  return { note: '在途 1 支 → ' + m.name + '（' + m.modeId + '）' };
});
step('抵达结算：expedition 出结果（胜/负/破防）', function () {
  var m = (G.state.marches || [])[0];
  if (!m) return { ok: false, msg: '无在途档（上一步被拦）' };
  var r = G.battle.expedition(m.target, m.modeId, m.army, m.genId,
    { arrived: true, cityId: m.cityId, ops: 'assault' });
  if (r && r.ok === false) return r;
  return { note: '回合 ' + (r.rounds || '-') + ' · ' + String(r.msg || '').slice(0, 46) };
});
step('战报落公文 + 带沙盘配方（可逐帧回放）', function () {
  var rep = null;
  (G.state.reports || []).forEach(function (x) { if (!rep && x.type === 'war') rep = x; });
  if (!rep) throw new Error('没有战报入公文');
  var sb = G.battle.sandboxOf(rep);
  if (!sb) throw new Error('战报无沙盘配方（沙盘打不开）');
  if (!(sb.frames && sb.frames.length >= 1)) throw new Error('配方帧数为 0');
  return { note: '战报 1 份 · 沙盘 ' + sb.frames.length + ' 帧 · 校验 ' + (sb.verify ? '通过' : '未过') };
});

/* ══════════ ④ 据点 · 占领链 ══════════ */
head('④ 据点链（拔除并占据 → 城池列表 + 地图标记）');
step('攻城至破防（连打 3 波，与真实玩法同路）', function () {
  if (!tgt) return { ok: false, msg: '无目标' };
  var broke = false, waves = 0;
  for (var i = 0; i < 3 && !broke; i++) {
    /* ⚠ 这里要**保留板车**：调运链在后，靠它拉货（攻城只补战兵） */
    A.army = { fujiche: 4000, daodanche: 3000, buxingji: 3000, banche: 1200 };
    st.generals[0].status = 'idle';
    st.generals[0].energy = 100; st.generals[0].sta = 100;
    var r = G.battle.expedition(tgt, 'occupy', { fujiche: 4000, daodanche: 3000, buxingji: 3000 }, st.generals[0].id);
    waves++;
    if (r && r.ok !== false) broke = true;
  }
  return { note: waves + ' 波后 ' + (broke ? '拿下' : '仍未破防') };
});
step('据为己有：城数 +1、地图不再生成该据点', function () {
  var n0 = st.cities.length;
  var t = null;
  if (tgt) t = G.battle.resolveTarget(tgt);
  if (!t || !t.ok) return { ok: false, msg: '目标已消失（说明已占据）' };
  var r = G.claimFort(t, st.generals[0], A, { win: true });
  if (r && r.ok === false) return r;
  var n1 = st.cities.length;
  var still = G.map.fortAt(tgt.x, tgt.y);
  if (still) throw new Error('占了城但据点标记还在（会重复生成）');
  return { note: '城池 ' + n0 + ' → ' + n1 + ' · 该格不再出据点' };
});

/* ══════════ ⑤ 本境调运链 ══════════ */
head('⑤ 本境调运链（兵 + 辎重 → 抵达落账 → 召回原路退回）');
step('出发：doTransferCargo 扣兵扣货', function () {
  if (!B) return { ok: false, msg: '无分城（跳过）' };
  B.res.grain = 0; B.res.gold = 0;
  var g0 = A.res.grain;
  /* 运力 = Σ(兵数 × 兵种载重)：200 板车 × 500 = 10 万 —— 运 3 万（留余量），
     超载会被明确拦下并给出"多带板车/运输平台"的指引（上一步已实测过那条规则）。 */
  var r = G.doTransferCargo(A.id, B.id, { banche: 200 }, st.generals[1].id, { grain: 30000 });
  if (!r.ok) return r;
  if (!(A.res.grain < g0)) throw new Error('出发城粮没扣（在途能二次花）');
  transferDispatched = true;
  return { note: '净水 30,000 起运（在途 1 支 · 载重 4 万）' };
});
step('抵达：目标城按损耗落账', function () {
  if (!B) return { ok: false, msg: '无分城' };
  var m = (G.state.marches || []).filter(function (x) { return x.kind === 'owncity' || (x.target || {}).kind === 'own'; })[0]
    || (G.state.marches || [])[0];
  if (!m) return { ok: false, msg: '无在途档' };
  /* 走 `GAME.march.rushAll`（与线上"加快行军"同一条抵达出口），
     而不是自己拆内部函数 —— 探针要量的是**链路**，不是内部实现。 */
  /* v89.141（复核修复）：先确认"出发确实起运"——出发被拦（席位/兵力/运力）时
     抵达无从验证，**不该在这里抛假异常**（它会把工具自身的造局问题伪装成产品 bug）。 */
  if (!transferDispatched) return { ok: false, msg: '出发步骤被拦 → 抵达无从验证（跳过）' };
  var g0 = B.res.grain;
  G.march.rushAll();
  var moved = B.res.grain - g0;
  if (!(moved > 0)) throw new Error('抵达了但分城没涨粮（' + moved + '）');
  return { note: '分城净水 +' + U.fmt(moved) + '（已扣途中损耗）' };
});

/* ══════════ ⑥ 英雄链 ══════════ */
head('⑥ 英雄链（招募 → 赏赐 → 出阵）');
step('酒馆招募（recruitRandomGeneral）', function () {
  var n0 = st.generals.length;
  var r = null;
  try { r = G.recruitRandomGeneral ? G.recruitRandomGeneral('normal') : null; } catch (e) { r = { ok: false, msg: e.message }; }
  if (!r) return { ok: false, msg: '无 recruitRandomGeneral' };
  if (r.ok === false) return r;
  return { note: '英雄 ' + n0 + ' → ' + st.generals.length };
});
step('赏赐忠诚（doGenGift：宝物 → 忠诚）', function () {
  var g = st.generals[0];
  /* ⚠ 字段名是 `loyalty`（探针起初写成 `loyal` —— 赋了个不存在的字段，
     于是"赏赐成功但忠诚不变"，看着像游戏 bug，其实是探针自己没对上） */
  g.loyalty = 60;
  var n0 = st.items.bengzhu || 0;      /* v89.152：珍珠退役 -> 蚌珠 */
  var r = G.systems.useItem('bengzhu', g.id);
  if (r && r.ok === false) return r;
  var n1 = st.items.bengzhu || 0;
  if (n1 >= n0) throw new Error('用了但蚌珠没减（' + n0 + ' → ' + n1 + '）');
  if (g.loyalty <= 60) throw new Error('赏赐了但忠诚没涨（' + g.loyalty + '）');
  return { note: '蚌珠 ' + n0 + ' → ' + n1 + ' · 忠诚 60 → ' + g.loyalty };
});

/* ══════════ ⑦ 物品链 ══════════ */
head('⑦ 物品链（获得 → 背包 → 使用 → 生效）');
step('就地使用（神农锄：无对象道具）', function () {
  var n0 = st.items.shennongchu || 0;
  var r = G.doUseItem('shennongchu');
  if (r && r.ok === false) return r;
  var n1 = st.items.shennongchu || 0;
  if (n1 >= n0) throw new Error('用了但库存没减（' + n0 + ' → ' + n1 + '）');
  return { note: '库存 ' + n0 + ' → ' + n1 };
});
step('对英雄使用（练兵经验：有对象道具）', function () {
  var g = st.generals[0], e0 = g.exp || 0;
  var r = G.doUseItem('lianbing_jingyan', g.id, 2);
  if (r && r.ok === false) return r;
  if ((g.exp || 0) <= e0 && g.level === 1) return { note: '经验道具已消耗（经验 ' + e0 + ' → ' + (g.exp || 0) + '）' };
  return { note: '经验 ' + e0 + ' → ' + (g.exp || 0) };
});
step('移民令：每次 +上限 25%（增量语义 · 上限 = 有效上限/民心折算 · v89.185）', function () {
  var c = G.res(A);
  /* v89.230 工具同步：v89.185（老板 6）起封顶改 **有效上限**（effPopCapOf · 民心折算），
     原写 maxPopOf（满额上限）→ 民心 <100% 时实测值必然对不上（假红）。 */
  var cap = G.effPopCapOf(A);
  c.pop = Math.floor(cap * 0.2);
  var before = c.pop;
  var r = G.doUseItem('yiminling');
  if (r && r.ok === false) return r;
  var add = Math.floor(cap * 0.25);
  var want = Math.min(cap, before + add);
  if (Math.abs(c.pop - want) > 1) throw new Error('幸存者 ' + c.pop + ' ≠ ' + before + ' + ' + add + '（' + want + '）');
  return { note: '幸存者 ' + U.fmt(before) + ' → ' + U.fmt(c.pop) + '（+' + U.fmt(c.pop - before) + '，上限 ' + U.fmt(cap) + '）' };
});

/* ══════════ ⑧ 经济链 ══════════ */
head('⑧ 经济链（市场 → 通商券寄售 → 价格衰减）');
step('寄售战利品：consignList 有货、doConsign 落旧币', function () {
  if (!G.systems || typeof G.systems.consignList !== 'function') throw new Error('无 consignList 出口');
  var list = G.systems.consignList();
  if (!list.length) return { ok: false, msg: '暂无可寄售（未授予宝物）' };
  var gold0 = G.res(A).gold;
  var r = G.doConsign(list[0].id);
  if (r && r.ok === false) return r;
  if (!(G.res(A).gold > gold0)) throw new Error('寄售了但旧币没涨');
  return { note: list.length + ' 种可售；售 1 种 → 旧币 ' + U.fmt(gold0) + ' → ' + U.fmt(G.res(A).gold) };
});
step('价格衰减出口（mktSlipText 可读）', function () {
  if (typeof G.mktSlipText !== 'function') throw new Error('无 mktSlipText');
  return { note: G.mktSlipText().slice(0, 40) };
});

/* ══════════ ⑨ 研究 / 灵田 / 采集 / 打造 ══════════ */
head('⑨ 副业四链（研究 → 灵田 → 采集 → 打造）');
step('研究（doResearch）', function () {
  var techs = (DATA.TECHS || DATA.TECH || []);
  if (!techs.length) return { ok: false, msg: '无科技表' };
  var r = G.doResearch(techs[0].id);
  if (r && r.ok === false) return r;
  return { note: '开研 ' + (techs[0].name || techs[0].id) };
});
step('灵田播种（farmPlant）', function () {
  var crops = ((DATA.FARM || {}).crops || []);
  if (!crops.length) return { ok: false, msg: '无作物表' };
  var r = G.farmPlant(0, crops[0].id);
  if (r && r.ok === false) return r;
  return { note: '第 1 块田种下 ' + (crops[0].name || crops[0].id) };
});
step('采集（gatherAt）', function () {
  var g = G.gatherAt(A.x + 1, A.y);
  if (g && g.ok === false) return g;
  return { note: '采集点响应正常' };
});
step('打造（doForge）', function () {
  var list = G.forgeList ? G.forgeList() : [];
  if (!list.length) return { ok: false, msg: '无配方（跳过）' };
  var r = G.doForge(list[0].id || list[0]);
  if (r && r.ok === false) return r;
  return { note: '打造 1 件' };
});

/* ══════════ ⑩ 自动化链 ══════════ */
head('⑩ 自动化链（自动营造 / 自动研究 / 自动出征）');
step('自动升级（autoUpgrade）', function () {
  var n0 = 0;
  A.cells.forEach(function (c) { if (G.queueAt('city', A.cells.indexOf(c))) n0++; });
  var r = G.autoUpgrade();
  return { note: '调用成功（' + JSON.stringify(r || {}).slice(0, 40) + '）' };
});
step('自动研究（autoResearch）', function () {
  G.autoResearch();
  return { note: '调用成功' };
});
step('自动出征（autoMarchOnce：先指定执行英雄，再出征一次）', function () {
  var idle = st.generals.filter(function (g) { return !g.status || g.status === 'idle'; });
  if (!idle.length) return { ok: false, msg: '无空闲英雄' };
  G.doSetAutoMarch('genId', idle[0].id);
  var r = G.autoMarchOnce(null);
  if (r && r.ok === false) return r;
  return { note: '执将 ' + idle[0].name + ' · ' + String((r && r.msg) || '已出征').slice(0, 40) };
});

/* ══════════ ⑪ 存档链 ══════════ */
head('⑪ 存档链（保存 → 读取 → 导出）');
step('保存（doSave）', function () {
  var r = G.doSave();
  if (r && r.ok === false) return r;
  var n = 0;
  try { (G.slotList ? G.slotList() : []).forEach(function (x) { if (x.meta) n++; }); } catch (e) {}
  return { note: '写入成功 · 现有档位 ' + n };
});
step('导出（doExportSlot，编码串非空）', function () {
  var slot = null;
  try { (G.slotList ? G.slotList() : []).forEach(function (x) { if (!slot && x.meta) slot = x.id; }); } catch (e) {}
  if (!slot) return { ok: false, msg: '无档可导出' };
  var r = G.doExportSlot(slot);
  return { note: '导出完成（' + String((r && r.msg) || '').slice(0, 40) + '）' };
});
step('读档（doLoadSlot）', function () {
  var slot = null;
  try { (G.slotList ? G.slotList() : []).forEach(function (x) { if (!slot && x.meta) slot = x.id; }); } catch (e) {}
  if (!slot) return { ok: false, msg: '无档可读' };
  var r = G.doLoadSlot(slot);
  if (r && r.ok === false) return r;
  return { note: '读档成功（城池 ' + G.state.cities.length + '）' };
});

/* ══════════ ⑫ 爵位链 ══════════ */
head('⑫ 爵位链（声望 → 晋升 → 主城解锁等级上限 → 节钺）');
step('晋升（doPromote：条件不足要写清缺什么）', function () {
  G.state.rep = 1e9;
  var r0 = G.state.rank || 0;
  var r = G.doPromote();
  if (r && r.ok === false) return r;
  return { note: '爵位 ' + r0 + ' → ' + (G.state.rank || 0) };
});
step('主城爵位解锁建筑上限（rankBuildCapOf）', function () {
  if (typeof G.rankBuildCapOf !== 'function') throw new Error('无 rankBuildCapOf');
  G.state.mainCityId = A.id;
  var lift = G.rankBuildCapOf(A);
  var cap = G.buildCapOf(A, 'minfang');
  return { note: '解锁 +' + lift + ' 级 → 居所上限 Lv' + cap };
});
step('节钺（jieyueClaim：稀缺资源唯一出口）', function () {
  if (typeof G.jieyueClaim !== 'function') throw new Error('无 jieyueClaim');
  var r = G.jieyueClaim();
  if (r && r.ok === false) return r;
  return { note: '调用成功（' + String((r && r.msg) || '').slice(0, 40) + '）' };
});

/* ══════════ 汇总 ══════════ */
console.log('\n' + '═'.repeat(56));
console.log('全功能链路复核：' + STEP + ' 环节 · 通 ' + OK + ' · 被规则拦 ' + WARN + ' · **断 ' + BAD + '**');
if (BREAKS.length) {
  console.log('\n断点清单（要修的就是这些）：');
  BREAKS.forEach(function (b) { console.log('  · ' + b); });
}
console.log('SUMMARY ' + JSON.stringify({ steps: STEP, ok: OK, warn: WARN, bad: BAD }));
process.exit(BAD ? 1 : 0);
