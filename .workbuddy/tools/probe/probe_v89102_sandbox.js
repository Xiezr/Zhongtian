/* ============================================================
 * probe_v89102_sandbox.js — 战报沙盘（逐兵种逐帧）数据可行性实测
 * ------------------------------------------------------------
 * 问三件事：
 *   ① 一场真仗的**全量帧**（每个兵种的移动/攻击各一帧）有多大？
 *      —— 决定"帧能不能随战报存档"，还是只留最近 N 份。
 *   ② 将领快照（U.deep(gen)）有多大？—— 决定"沙盘推演"能不能
 *      用同一把引擎重跑（recipe 存档）。
 *   ③ 重跑一致性：同 recipe 重跑是否逐字节复现原战果（回合/损失）？
 *      —— 这是"推演可信"的唯一前提。
 *
 * 用法：node .workbuddy/tools/probe/probe_v89102_sandbox.js
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

var st = G.newGame({ name: '探针', cityName: '许都', region: '豫州', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
st.settings.battleWatch = false;      /* 探针要即时结算（观战会挂起） */

var city = st.cities[0];
city.army = { yibing: 40000, changqiang: 20000, daodun: 12000, gongjian: 8000, qingji: 3000, toudan: 400 };
city.cells.forEach(function (c) {
  if (c.build && c.build.id === 'xiaochang') c.build.lvl = Math.max(c.build.lvl || 1, 9);
  if (c.build && c.build.id === 'junying') c.build.lvl = Math.max(c.build.lvl || 1, 10);
  if (c.build && c.build.id === 'shuyuan') c.build.lvl = Math.max(c.build.lvl || 1, 10);
});
var gen = st.generals[0];
gen.level = 30; gen.tong = 90; gen.yw = 88; gen.zm = 70; gen.nz = 60;

/* 找一座据点打（fortAt 返回 {level}，不是 lv —— 踩过） */
var wx = null, wy = null;
for (var y = 0; y < DATA.MAP_H && wx === null; y++) {
  for (var x = 0; x < DATA.MAP_W; x++) {
    var f = G.map.fortAt(x, y);
    if (f && (f.level || 1) >= 4) { wx = x; wy = y; break; }
  }
}
if (wx === null) { for (var y2 = 0; y2 < DATA.MAP_H && wx === null; y2++) {
  for (var x2 = 0; x2 < DATA.MAP_W; x2++) { if (G.map.wildAt(x2, y2)) { wx = x2; wy = y2; break; } }
} }
if (wx === null) { console.log('未找到目标 —— 中止'); process.exit(1); }
var tgtKind = G.map.fortAt(wx, wy) ? 'fort' : 'wild';
console.log('目标 =', tgtKind, wx, wy, 'level', (G.map.fortAt(wx, wy) || G.map.wildAt(wx, wy) || {}).level);

var army = { yibing: 30000, changqiang: 15000, daodun: 9000, gongjian: 6000, qingji: 2000 };
var r = G.battle.expedition({ kind: tgtKind, x: wx, y: wy }, 'raid', army, gen.id);
console.log('战斗结果 ok=', r.ok, 'msg=', r.msg);
var res = r.result;
console.log('回合 =', res.rounds, '我损 =', res.atkLoss, '敌损 =', res.defLoss,
  '我剩 =', res.atkRemain, '敌剩 =', res.defRemain);

/* ---------- ① 全量帧 ---------- */
function framesOf(result) {
  var out = [], log = result.roundsLog || [];
  log.forEach(function (rr) {
    (rr.events || []).forEach(function (e) { out.push(e); });
  });
  return out;
}
var frames = framesOf(res);
console.log('\n[① 帧数] 回合数 =', (res.roundsLog || []).length, '· 事件帧 =', frames.length,
  '· 平均/回合 =', (frames.length / Math.max(1, (res.roundsLog || []).length)).toFixed(1));

/* 紧凑编码：数组化 + 短键 */
var KIND = { move: 0, retreat: 1, attack: 2, counter: 3, tower: 4, wall: 5 };
function pack(frames2, res2) {
  var ids = {}; var nid = 0;
  function idOf(s) { if (!(s in ids)) ids[s] = nid++; return ids[s]; }
  var row = [];
  frames2.forEach(function (e) {
    row.push([
      e.r || 0,
      e.side === 'atk' ? 0 : 1,
      idOf(e.id || ''),
      KIND[e.kind] == null ? 9 : KIND[e.kind],
      e.targetId ? idOf(e.targetId) : -1,
      Math.round(e.step || e.kill || e.destroy || 0),
      Math.round(e.gap || 0),
    ]);
  });
  return { ids: ids, rows: row };
}
var pk = pack(frames, res);
var rawJson = JSON.stringify(frames).length;
var packJson = JSON.stringify(pk).length;
console.log('[① 体积] 原始 events JSON =', rawJson, 'B · 紧凑编码 =', packJson, 'B',
  '· 折算存档(60 份) =', (packJson * 60 / 1024).toFixed(0), 'KB');

/* 逐回合兵力快照（界面画"每帧后总兵力"用）也计一遍 */
var perRound = (res.roundsLog || []).map(function (rr) { return [rr.r, rr.a, rr.d, rr.gap]; });
console.log('[① 体积] 逐回合兵力 =', JSON.stringify(perRound).length, 'B');

/* ---------- ② 将领快照体积 ---------- */
var gJson = JSON.stringify(U.deep(gen)).length;
console.log('\n[② 将领快照] U.deep(gen) =', gJson, 'B · 单条战报占比 =',
  (gJson * 60 / 1024).toFixed(0), 'KB / 60 份');
console.log('[② 敌军侧] scGen 已由 rec.sim 深拷贝（见 _suspendExpedition）');

/* ---------- ③ 重跑一致性 ---------- */
var env = G.tactic.begin(army, gen, res.defStartBy || {}, res.defBonusEffRaw || 0, null,
  { kind: 'wild', sieging: false });
env.runAll();
var again = env.finish();
console.log('\n[③ 重跑] 回合', again.rounds, 'vs', res.rounds,
  '· 我损', again.atkLoss, 'vs', res.atkLoss,
  '· 敌损', again.defLoss, 'vs', res.defLoss);
console.log('[③ 一致] ', (again.rounds === res.rounds && again.atkLoss === res.atkLoss
  && again.defLoss === res.defLoss) ? '✅ 逐项复现' : '❌ 不一致（推演需带 recipe）');

/* ---------- ④ 初始快照（沙盘布局用） ---------- */
var env2 = G.tactic.begin(army, gen, res.defStartBy || {}, 0, null, { kind: 'wild' });
var snap0 = env2.snap();
console.log('\n[④ 初始快照] 我方单位', snap0.atk.length, '· 敌方单位', snap0.def.length,
  '· JSON', JSON.stringify(snap0).length, 'B');
console.log('   我方单位样例 =', JSON.stringify(snap0.atk[0]));
console.log('   STANCE_ROW =', JSON.stringify(G.tactic.STANCE_ROW),
  '· FIELD_MIN =', G.tactic.FIELD_MIN, '· MAX_ROUNDS =', G.tactic.MAX_ROUNDS);
console.log('   本场战场纵深 D =', snap0.field);
