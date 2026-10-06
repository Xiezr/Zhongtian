/* ============================================================
 * probe_v89102b_sandbox.js — 沙盘（配方→逐帧）端到端实测
 * ------------------------------------------------------------
 * 问：
 *   ① 真实战报里的 sandbox 配方有多大？（验收线：≤4KB/场）
 *   ② sandboxOf(rep) 重建的帧数 / 校验是否通过？
 *   ③ 帧序列自洽：兵力只减不增、位置与间距一致、终局与史实相等？
 *   ④ 推演（另起会话）能不能从同一配方跑出同样的结果？
 * 用法：node .workbuddy/tools/probe/probe_v89102b_sandbox.js
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

var st = G.newGame({ name: '探针', cityName: '许都', region: '碎垣', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
st.settings.battleWatch = false;
var city = st.cities[0];
city.res.grain = 5e6; city.res.wood = 5e6; city.res.stone = 5e6;
city.res.iron = 5e6; city.res.gold = 5e6; city.res.pop = 60000;
city.cells.forEach(function (c) {
  if (c.build) c.build.lvl = Math.max(c.build.lvl || 1, 10);
});
var gen = st.generals[0];
gen.level = 30;

/* 连打三场：野地（小仗）/ 据点（中仗）/ 县城（大仗 · 拼长回合） */
/* 野地 = 任意非城池地块（等级由坐标哈希定，不需要"已占野地"记录） */
function findWild(minLv) {
  for (var y = 4; y < (DATA.MAP_H || 61) - 4; y++) {
    for (var x = 4; x < (DATA.MAP_W || 61) - 4; x++) {
      var t = G.map.tile(x, y);
      if (!t || t.terrain === 'city') continue;
      if (G.map.npcAt && G.map.npcAt(x, y)) continue;
      if (G.map.fortAt && G.map.fortAt(x, y)) continue;
      var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : 1;
      if (lv >= minLv && lv <= 6) return { x: x, y: y, lv: lv };
    }
  }
  return null;
}
function findFort(minLv, maxLv) {
  for (var y = 0; y < DATA.MAP_H; y++) {
    for (var x = 0; x < DATA.MAP_W; x++) {
      var o = G.map.fortAt(x, y);
      if (o && (o.level || 1) >= minLv && (o.level || 1) <= maxLv) return { x: x, y: y, o: o };
    }
  }
  return null;
}
function findCounty() {
  var cs = st.map.cities || [];
  for (var i = 0; i < cs.length; i++) if (cs[i].type === 'county') return cs[i];
  return null;
}
var county = findCounty();
var out = [];
var cases = [
  { label: '野地', t: (function () { var w = findWild(4); return w ? { kind: 'wild', x: w.x, y: w.y } : null; })(),
    army: { qingji: 3000 } },
  { label: '据点', t: (function () { var f = findFort(4, 6); return f ? { kind: 'fort', x: f.x, y: f.y } : null; })(),
    army: { qingji: 4000, changqiang: 3000 } },
  { label: '郡城', t: county ? { kind: 'city', npc: county, id: county.id } : null,
    army: null },
];
cases.forEach(function (cs) {
  if (!cs.t) { out.push('[跳过] ' + cs.label + '：没找到目标'); return; }
  /* 打城按守军规模配兵（≈1:1，拼长回合——帧数上界就在这种仗里） */
  var army = cs.army;
  if (!army) {
    var g = (cs.t.npc && cs.t.npc.garrison) || {};
    var tot = 0, k;
    for (k in g) tot += g[k];
    var scale = Math.max(1, Math.round(tot * 1.05 / 3000));
    army = { qingji: scale * 3000 };
    if (tot > 400000) army = { qingji: 60000, gongjian: 40000, toudan: 300 };
    out.push('  （' + cs.label + ' 守军合计 ' + tot + ' → 我方配兵 ' + JSON.stringify(army) + '）');
  }
  cs.army = army;
  var before = (st.reports || []).length;
  city.army = Object.assign({}, army);
  G.setStaNow(gen, 9999); gen.energy = 100;
  var r = null;
  try {
    r = G.battle.expedition(cs.t, 'raid', army, gen.id);
  } catch (e) { out.push('[异常] ' + cs.label + '：' + e.message); return; }
  /* ⚠️ 战报是 unshift 进数组的 —— 最新的在第 0 位（踩过：拿 length-1 会读到最旧那份） */
  var rep = (st.reports || [])[0];
  if (!rep || (st.reports || []).length === before) { out.push('[无战报] ' + cs.label + ' msg=' + (r && r.msg)); return; }
  var size = JSON.stringify(rep.sandbox || {}).length;
  var sb = G.battle.sandboxOf(rep);
  out.push('===== ' + cs.label + ' ' + ((rep.title || '').slice(0, 28)) + ' =====');
  out.push('  战果：' + (r && r.msg) + '　回合 ' + (rep.scene ? rep.scene.rounds : '?')
    + '　我损 ' + sumOf(rep.loss && rep.loss.atkLoss) + '　敌损 ' + sumOf(rep.loss && rep.loss.defLoss));
  out.push('  ① 配方体积 = ' + size + ' B（含将领快照 ' + JSON.stringify((rep.sandbox || {}).gen || {}).length
    + ' B · 敌军 ' + JSON.stringify((rep.sandbox || {}).scArmy || {}).length + ' B）');
  if (!sb) { out.push('  ② sandboxOf = null（不可用）'); return; }
  out.push('  ② 帧数 = ' + sb.frames.length + '　回合 = ' + sb.rounds
    + '　校验 = ' + (sb.verify ? '✅ 通过' : '❌ 不过')
    + '　（重跑 回合' + sb.sim.rounds + '/损' + sb.sim.atkLoss + ' vs 史实 '
    + sb.hist.rounds + '/损' + sb.hist.atkLoss + '）');
  /* ③ 自洽性：走一遍帧，兵力单调不增、零兵力不再出手 */
  var state = { atk: {}, def: {}, towers: sb.towers };
  sb.init.atk.forEach(function (u) { state.atk[u.id] = u.count; });
  sb.init.def.forEach(function (u) { state.def[u.id] = u.count; });
  var bad = [], last = { atk: null, def: null };
  sb.frames.forEach(function (f, i) {
    var mine = f[1] === 0;
    var own = mine ? state.atk : state.def, foe = mine ? state.def : state.atk;
    var uid = sb.ids[f[2]], tid = (f[4] >= 0) ? sb.ids[f[4]] : '';
    var k = f[3], v1 = f[5];
    if ((k === 'a' || k === 'c' || k === 'w') && tid) {
      if (!(tid in foe)) bad.push('帧' + i + ' 打不存在的兵种 ' + tid);
      else {
        if (foe[tid] <= 0 && v1 > 0) bad.push('帧' + i + ' 对已灭兵种 ' + tid + ' 还造成杀伤 ' + v1);
        foe[tid] = Math.max(0, foe[tid] - v1);
      }
      if (uid && own[uid] !== undefined && own[uid] <= 0) bad.push('帧' + i + ' 已灭兵种 ' + uid + ' 还在出手');
    }
  });
  var endA = 0, endD = 0, k2;
  for (k2 in state.atk) endA += state.atk[k2];
  for (k2 in state.def) endD += state.def[k2];
  var hA = sumOf(rep.loss && rep.loss.atkStart) - sumOf(rep.loss && rep.loss.atkLoss);
  var hD = sumOf(rep.loss && rep.loss.defStart) - sumOf(rep.loss && rep.loss.defLoss);
  out.push('  ③ 帧推演终局：我 ' + endA + ' / 敌 ' + endD
    + '　史实剩余：我 ' + hA + ' / 敌 ' + hD
    + '　→ ' + ((endA === hA && endD === hD) ? '✅ 逐项吻合' : '❌ 不一致')
    + '　自洽问题 ' + bad.length + ' 条' + (bad.length ? '：' + bad.slice(0, 3).join(' / ') : ''));
  /* ④ 推演：另起会话（等于界面里点「沙盘推演」） */
  try {
    var env2 = G.tactic.begin((rep.sandbox || {}).atkArmy, (rep.sandbox || {}).gen,
      (rep.sandbox || {}).scArmy, (rep.sandbox || {}).scVal, (rep.sandbox || {}).scGen,
      Object.assign({}, (rep.sandbox || {}).simOpts || {}));
    env2.runAll();
    var fin2 = env2.finish();
    out.push('  ④ 推演（无指令覆盖）：回合 ' + fin2.rounds + '　我损 ' + fin2.atkLoss + '　敌损 ' + fin2.defLoss
      + '　→ ' + ((fin2.rounds === sb.hist.rounds && fin2.atkLoss === sb.hist.atkLoss) ? '✅ 与史实一致' : '⚠ 有偏差'));
  } catch (e) { out.push('  ④ 推演异常：' + e.message); }
});
function sumOf(o) { var n = 0; for (var k in (o || {})) n += o[k]; return n; }
console.log(out.join('\n'));
