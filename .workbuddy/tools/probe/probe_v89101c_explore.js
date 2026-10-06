/* ============================================================
 * probe_v89101c_explore.js — 跨越式三连锁实测
 * L1 金提速瞬时成军（轻骑 700 + 铁骑 300，真通道 train/trainRush）
 * L2 城流再验（连建到 9 城）
 * L3 据点掠夺掉落采样
 * L4 磨城（rep 采样）
 * L5 爵位晋升实测（城数→爵位→永久特权）
 * ============================================================ */
'use strict';
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var OUT = [];
function ap(s) { OUT.push(s); }
var simMs = Date.UTC(2026, 8, 22, 9, 0, 0);
Date.now = function () { return simMs; };
Math.random = function () { return 0.42; };
eval(fs.readFileSync(R + '.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(R + 'js/' + f + '.js');
});
fs.readdirSync(R + 'story').filter(function (f) { return /^vol-.*\.js$/.test(f); })
  .forEach(function (f) { try { require(R + 'story/' + f); } catch (e) {} });

var G = global.GAME, DATA = G.DATA, U = G.utils, T = G.tactic;
var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
var c0 = st.cities[0];
st.settings.battleWatch = false;
function setCity(c) { G.ui._cityId = c.id; }
setCity(c0);
var RICH = 50000000;
['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c0.res[k] = RICH; });
c0.res.pop = 60000;

function mkGen(name, rankId, level) {
  var g = G.makeGeneral(name, level || 1, 'idle', c0.id, false, rankId);
  for (var i = 1; i < (level || 1); i++) G.applyLevelGrowth(g);
  if (g.freePts) { g.yw += g.freePts; g.freePts = 0; }
  try { if (G.setStaNow) G.setStaNow(g, 999); } catch (e) {}
  if (!(g.stamina > 100)) g.stamina = 999;
  st.generals.push(g);
  return g;
}
var hero = mkGen('远征将', 'ying', 200);
function sta999(g) { try { if (G.setStaNow) G.setStaNow(g, 999); } catch (e) {} if (!(g.stamina > 100)) g.stamina = 999; g.status = 'idle'; }
function fmtM(v) { v = Number(v) || 0; if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'; if (v >= 1e4) return (v / 1e4).toFixed(1) + '万'; return '' + Math.round(v); }
function resolveAll() { (st.battles || []).forEach(function (rec) { if (rec.state === 'live') { try { G.battle.autoBattle(rec.id); } catch (e) {} } }); }

/* ---------------- L1 金提速瞬时成军 ---------------- */
try {
  ap('===== L1. 金提速瞬时成军（实测） =====');
  /* 手工落三级建筑（沙盘：直写 cell.build，走游戏读取口径 buildingLevel） */
  function placeB(city, bid, lvl) {
    for (var i = 0; i < city.cells.length; i++) {
      var c = city.cells[i];
      if (c.build && c.build.id === bid) { c.build.lvl = lvl; return i; }
    }
    for (var j = 0; j < city.cells.length; j++) {
      var c2 = city.cells[j];
      if (!c2.build && !c2.pending && !c2.official) { c2.build = { id: bid, lvl: lvl }; return j; }
    }
    return -1;
  }
  var jyIdx = placeB(c0, 'junying', 9);
  placeB(c0, 'shuyuan', 9);
  placeB(c0, 'majiu', 3);
  ap('  建筑就位：军营 Lv' + (G.buildingLevel(c0, 'junying')) + ' / 书院 Lv' + (G.buildingLevel(c0, 'shuyuan'))
    + ' / 马厩 Lv' + (G.buildingLevel(c0, 'majiu')));
  ap('  canTrain 轻骑 = ' + JSON.stringify(G.canTrain('qingji')));
  ap('  canTrain 铁骑 = ' + JSON.stringify(G.canTrain('tieji')));

  function instantTrain(tid, n) {
    setCity(c0);
    var g0 = G.res(c0).gold || 0;
    var r = G.train(tid, n, c0.id, jyIdx);
    if (!r || !r.ok) return '训练发起失败：' + (r && r.msg);
    var q = (st.queues.train || []).filter(function (x) { return x.troopId === tid; })[0];
    var natural = q ? (q.totalTime / 57600).toFixed(2) : '?';
    var cost = 0; try { cost = G.trainRushCost(q, 1.0); } catch (e) {}
    var rr = G.trainRush(c0.id, jyIdx, 1.0, 'train');
    if (!rr || !rr.ok) return '提速失败：' + (rr && rr.msg);
    for (var k = 0; k < 3; k++) { try { G.tickOnce(); } catch (e) {} }
    var army = (c0.army || {})[tid] || 0;
    return tid + ' ×' + n + '：自然需 ' + natural + ' 游戏年 → 金 ' + fmtM(cost) + ' → 立即入列 ' + army
      + '（金 ' + fmtM(g0) + '→' + fmtM(G.res(c0).gold || 0) + '）';
  }
  ap('  ' + instantTrain('qingji', 700));
  ap('  ' + instantTrain('tieji', 300));
} catch (e) { ap('L1 err ' + e.message); }

/* ---------------- L2 城流再验（建到 9 城） ---------------- */
try {
  ap('');
  ap('===== L2. 城流（连建到 9 城） =====');
  function findPlains(n) {
    var out = [];
    for (var rr = 2; rr <= 40 && out.length < n; rr++) {
      for (var dy = -rr; dy <= rr && out.length < n; dy++) {
        for (var dx = -rr; dx <= rr && out.length < n; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
          var x = c0.x + dx, y = c0.y + dy;
          if (x < 3 || y < 3 || x >= DATA.MAP_W - 3 || y >= DATA.MAP_H - 3) continue;
          var tl = G.map.tile(x, y);
          if (!tl || tl.terrain !== 'plain') continue;
          if (G.map.wildAt(x, y) || G.map.npcAt(x, y) || G.map.ownCityAt(x, y) || G.map.fortAt(x, y)) continue;
          out.push({ x: x, y: y });
        }
      }
    }
    return out;
  }
  var plains2 = findPlains(8);
  ap('  找到候选平原 ' + plains2.length + ' 块');
  for (var i = 0; i < plains2.length; i++) {
    var p = plains2[i];
    setCity(c0);
    c0.army = { yibing: 4000 };
    sta999(hero);
    var d = G.march.dispatch({ kind: 'wild', x: p.x, y: p.y }, 'occupy', { yibing: 4000 }, hero.id);
    if (!d || !d.ok) { ap('   [' + i + '] 占失败 ' + (d && d.msg)); continue; }
    var mm = null;
    (st.marches || []).forEach(function (m) { if (!mm && m.target && m.target.x === p.x && m.target.y === p.y) mm = m; });
    if (mm) { mm.elapsed = mm.totalTime; try { G.march.tick(); } catch (e) {} }
    resolveAll();
    setCity(c0);
    var rb = null; try { rb = G.buildCityAt(p.x, p.y); } catch (e) { rb = { ok: false, msg: e.message }; }
    ap('   [' + i + '] (' + p.x + ',' + p.y + ') 筑城 → ' + (rb.ok ? ('「' + rb.city.name + '」') : ('失败 ' + rb.msg)));
  }
  var slots = 0; st.cities.forEach(function (cc) { slots += G.buildSlots(cc); });
  ap('  城数 = ' + st.cities.length + '（初始 1；每城 3 位 → 建造并行 ' + slots + ' 条）');
} catch (e) { ap('L2 err ' + e.message); }

/* ---------------- L3 据点掠夺掉落采样 ---------------- */
try {
  ap('');
  ap('===== L3. 据点掠夺（掉落采样） =====');
  var fs2 = [];
  for (var dyy = -26; dyy <= 26; dyy++) {
    for (var dxx = -26; dxx <= 26; dxx++) {
      var f = G.map.fortAt(c0.x + dxx, c0.y + dyy);
      if (f && f.level <= 4) fs2.push({ x: c0.x + dxx, y: c0.y + dyy, name: f.name, level: f.level });
    }
  }
  var f2 = fs2[0];
  if (f2) {
    setCity(c0); c0.army = { qingji: 3000 }; sta999(hero);
    var it0 = JSON.parse(JSON.stringify(st.items || {}));
    var res0 = JSON.parse(JSON.stringify(c0.res));
    var rep0 = st.rep || 0;
    var rr2 = null;
    try { rr2 = G.battle.expedition({ kind: 'fort', x: f2.x, y: f2.y }, 'raid', { qingji: 3000 }, hero.id); } catch (e) { ap('  err ' + e.message); }
    if (rr2) ap('  raid ' + f2.name + 'Lv' + f2.level + '：ok=' + rr2.ok + ' ' + (rr2.result ? JSON.stringify({ w: rr2.result.winner, rounds: rr2.result.rounds, atkLoss: rr2.result.atkLoss, defLoss: rr2.result.defLoss }) : String(rr2.msg).slice(0, 80)));
    var g1 = [];
    Object.keys(st.items || {}).forEach(function (k) { var d2 = (st.items[k] || 0) - (it0[k] || 0); if (d2 > 0) g1.push(k + '+' + d2); });
    var g2 = [];
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { var d2 = (c0.res[k] || 0) - (res0[k] || 0); if (Math.abs(d2) > 1000) g2.push(k + (d2 > 0 ? '+' : '') + fmtM(d2)); });
    ap('  掉落物品：' + (g1.join(' ') || '无') + '｜资源：' + (g2.join(' ') || '无指标变化') + '｜声望 ' + rep0 + '→' + (st.rep || 0));
  } else { ap('  无 Lv≤4 据点'); }
} catch (e) { ap('L3 err ' + e.message); }

/* ---------------- L4 磨城（rep） ---------------- */
try {
  ap('');
  ap('===== L4. 磨城到下城（rep 采样） =====');
  var fs3 = [];
  for (var d3 = -30; d3 <= 30; d3++) {
    for (var d4 = -30; d4 <= 30; d4++) {
      var f3 = G.map.fortAt(c0.x + d4, c0.y + d3);
      if (f3 && f3.level <= 3) fs3.push({ x: c0.x + d4, y: c0.y + d3, name: f3.name, level: f3.level });
    }
  }
  var f4 = fs3[0];
  if (f4) {
    var rep1 = st.rep || 0;
    for (var wv = 1; wv <= 10; wv++) {
      setCity(c0); c0.army = { qingji: 3000 }; sta999(hero);
      var rw = null;
      try { rw = G.battle.expedition({ kind: 'fort', x: f4.x, y: f4.y }, 'occupy', { qingji: 3000 }, hero.id, { ops: 'encircle' }); } catch (e) { break; }
      var hold = null; try { hold = G.siegeHoldOf({ kind: 'fort', x: f4.x, y: f4.y }); } catch (e) {}
      var gone = !G.map.fortAt(f4.x, f4.y);
      ap('   波' + wv + '：守备余 ' + (hold == null ? '?' : Math.round(hold)) + '%' + (gone ? ' → 下城' : ''));
      if (gone) break;
    }
    ap('   ' + f4.name + 'Lv' + f4.level + '：声望 ' + rep1 + ' → ' + (st.rep || 0) + '（+' + ((st.rep || 0) - rep1) + '）');
  }
} catch (e) { ap('L4 err ' + e.message); }

/* ---------------- L5 爵位晋升实测 ---------------- */
try {
  ap('');
  ap('===== L5. 爵位晋升（城数→爵位→永久特权） =====');
  st.rep = 5000;
  st.items = st.items || {};
  st.items.zhenzhu = 20; st.items.shanhu = 20; st.items.liuli = 20; st.items.hupo = 20;
  setCity(c0);
  var b0 = G.buildSlots(c0);
  var cp1 = G.systems.canPromote();
  ap('  canPromote（城' + st.cities.length + ' · 声望 ' + st.rep + ' · 珠宝齐） = ' + JSON.stringify(cp1));
  if (cp1 && cp1.ok) {
    var pr1 = G.systems.promote();
    ap('  晋爵 → ' + JSON.stringify(pr1) + '｜现档 rank=' + st.rank + ' · 建造位 ' + b0 + '→' + G.buildSlots(c0));
    var cp2 = G.systems.canPromote();
    ap('  canPromote ×2 = ' + JSON.stringify(cp2));
    if (cp2 && cp2.ok) {
      var pr2 = G.systems.promote();
      ap('  再晋 → ' + JSON.stringify(pr2) + '｜现档 rank=' + st.rank + ' · 建造位 ' + G.buildSlots(c0));
    }
  }
} catch (e) { ap('L5 err ' + e.message); }

ap('');
ap('===== 汇总 =====');
ap('  L1 成军 / L2 城流 / L3 掠夺 / L4 磨城 / L5 爵位 —— 数字见上');
fs.writeFileSync(R + '.workbuddy/tmp/probe_v89101c_explore.txt', OUT.join('\n'), 'utf8');
console.log('EXPLORE PROBE C DONE · lines=' + OUT.length);
