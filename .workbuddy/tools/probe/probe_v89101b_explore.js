/* ============================================================
 * probe_v89101b_explore.js — 四维漏洞雷达 · 修正版
 * ------------------------------------------------------------------
 * 修正 v1 三处口径：① 将领未入册（出征校验失败）② troopPower 签名
 * （STORY.troopPower(troopId) 接的是 id 字符串）③ 平原口径（
 * findPlainSpot 用的是 tile.terrain==='plain' 且 wildAt 为空）
 * 补测试：城流×3 / 据点横扫阶梯 / 磨城到下城（声望采样）/ 县城实攻
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
var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260921, portraitSeed: 20260921 });
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
var gMid = mkGen('中游将', 'ying', 60);
var hero = mkGen('远征将', 'ying', 200);

function tp(tid) { try { return G.story.troopPower(tid); } catch (e) { return 0; } }
function powOf(dict) { var s = 0; for (var k in dict) { s += (tp(k) || 0) * (dict[k] || 0); } return Math.round(s); }
function fmtM(v) { v = Number(v) || 0; if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'; if (v >= 1e4) return (v / 1e4).toFixed(1) + '万'; return '' + Math.round(v); }
function sim(atk, def, defVal, opts) { return T.simulate(atk, gMid, def, defVal || 0, null, opts || { kind: 'wild' }); }
function line(tag, r, extra) {
  return '  ' + tag + ' → ' + r.rounds + '回合 w=' + r.winner + ' · 我损 ' + r.atkLoss + ' / 敌损 ' + r.defLoss + (extra ? ' · ' + extra : '');
}
function sta999(g) { try { if (G.setStaNow) G.setStaNow(g, 999); } catch (e) {} if (!(g.stamina > 100)) g.stamina = 999; g.status = 'idle'; }
function resolveAll() { (st.battles || []).forEach(function (rec) { if (rec.state === 'live') { try { G.battle.autoBattle(rec.id); } catch (e) {} } }); }

ap('===== 0. 修正版环境 =====');
ap('  MAP ' + DATA.MAP_W + '×' + DATA.MAP_H + '｜单兵战力：义兵 ' + tp('yibing') + ' / 枪 ' + tp('changqiang')
  + ' / 弓 ' + tp('gongjian') + ' / 轻骑 ' + tp('qingji') + ' / 铁骑 ' + tp('tieji'));

/* ============================================================
 * A. 同成本对撞（含铁骑）＋ 据点横扫阶梯
 * ============================================================ */
try {
  ap('');
  ap('===== A. 同成本 615 万资源对撞 + 扫荡阶梯 =====');
  var budget = 6150000;
  var nQ = Math.floor(budget / 4100), nT = Math.floor(budget / 9000);
  ap('  同预算：轻骑 ' + nQ + '（战力 ' + fmtM(nQ * tp('qingji')) + '）｜铁骑 ' + nT + '（战力 ' + fmtM(nT * tp('tieji')) + '）');
  var fg4 = G.map.fortGarrison(4);
  ap('  据点 Lv4 守军战力 ' + fmtM(powOf(fg4)));
  [['轻骑 ' + nQ, { qingji: nQ }], ['铁骑 ' + nT, { tieji: nT }]].forEach(function (p) {
    var r = sim(p[1], fg4, 0, { kind: 'fort', sieging: true, fortLv: 4 });
    ap(line(p[0] + ' vs 据点Lv4', r));
  });
  var rM = sim({ qingji: nQ }, { tieji: nT });
  ap(line('对撞 · 轻骑 ' + nQ + ' vs 铁骑 ' + nT, rM));
  ap('');
  ap('  扫荡阶梯（4000 轻骑 · 战力 ' + fmtM(4000 * tp('qingji')) + '）：');
  for (var lv = 3; lv <= 7; lv++) {
    var gf = G.map.fortGarrison(lv);
    var rr = sim({ qingji: 4000 }, gf, 0, { kind: 'fort', sieging: true, fortLv: lv });
    ap(line('vs 据点Lv' + lv + '（战力 ' + fmtM(powOf(gf)) + '）', rr));
  }
} catch (e) { ap('A err ' + e.message); }

/* ============================================================
 * C1. 城流：平原普查 → 占平原 → 即时筑城 ×3
 * ============================================================ */
try {
  ap('');
  ap('===== C1. 城流（占平原 → 即时筑城） =====');
  var plainTiles = [], terrainCnt = {};
  for (var dy = -30; dy <= 30; dy++) {
    for (var dx = -30; dx <= 30; dx++) {
      var x = c0.x + dx, y = c0.y + dy;
      if (x < 3 || y < 3 || x >= DATA.MAP_W - 3 || y >= DATA.MAP_H - 3) continue;
      var tl = G.map.tile(x, y);
      if (!tl) continue;
      terrainCnt[tl.terrain] = (terrainCnt[tl.terrain] || 0) + 1;
      if (tl.terrain !== 'plain') continue;
      if (G.map.wildAt(x, y) || G.map.npcAt(x, y) || G.map.ownCityAt(x, y) || G.map.fortAt(x, y)) continue;
      plainTiles.push({ x: x, y: y, d: Math.abs(dx) + Math.abs(dy) });
    }
  }
  plainTiles.sort(function (a, b) { return a.d - b.d; });
  ap('  地形分布(61×61)：' + JSON.stringify(terrainCnt));
  ap('  可筑城平原 ' + plainTiles.length + ' 块；最近 5：' + plainTiles.slice(0, 5).map(function (p) { return '(' + p.x + ',' + p.y + ')'; }).join(' '));

  function occupyAt(p) {
    setCity(c0);
    c0.army = { yibing: 4000 };
    sta999(hero);
    var d = G.march.dispatch({ kind: 'wild', x: p.x, y: p.y }, 'occupy', { yibing: 4000 }, hero.id);
    if (!d || !d.ok) return { ok: false, msg: (d && d.msg) || 'dispatch fail' };
    var mm = null;
    (st.marches || []).forEach(function (m) { if (!mm && m.target && m.target.x === p.x && m.target.y === p.y) mm = m; });
    if (mm) { mm.elapsed = mm.totalTime; try { G.march.tick(); } catch (e) {} }
    resolveAll();
    var own = !!G.map.wildAt(p.x, p.y);
    return { ok: own, msg: 'own=' + own + ' wilds=' + (st.wilds || []).length };
  }

  for (var ci = 0; ci < Math.min(3, plainTiles.length); ci++) {
    var pp = plainTiles[ci];
    var occ = occupyAt(pp);
    setCity(c0);
    var rb = null; try { rb = G.buildCityAt(pp.x, pp.y); } catch (e) { rb = { ok: false, msg: e.message }; }
    ap('   [' + ci + '] (' + pp.x + ',' + pp.y + ') 占 → ' + occ.msg + ' → 筑城 ' + JSON.stringify({ ok: rb.ok, msg: rb.msg }));
    if (rb && rb.ok && rb.city) {
      var nc = rb.city;
      ap('       「' + nc.name + '」lv' + nc.level + ' · cells ' + (nc.cells || []).length + ' · ext ' + ((nc.extGrid || []).length)
        + ' · 建造位 ' + G.buildSlots(nc) + ' · 民房上限 ' + G.maxPopOf(nc)
        + ' · res ' + JSON.stringify(Object.keys(nc.res || {}).reduce(function (a, k) { a[k] = Math.round(nc.res[k]); return a; }, {})));
    }
  }
  var slotSum = 0; st.cities.forEach(function (cc) { slotSum += G.buildSlots(cc); });
  ap('   城数=' + st.cities.length + ' · 建造并行合计=' + slotSum + ' 条 | ' + st.cities.map(function (cc) { return cc.name + '×' + G.buildSlots(cc) + '位'; }).join(' '));
} catch (e) { ap('C1 err ' + e.message); }

/* ============================================================
 * C2. 守军战力（真实口径）
 * ============================================================ */
try {
  ap('');
  ap('===== C2. 守军战力 =====');
  ap('  据点 Lv1~7 战力：');
  for (var lv2 = 1; lv2 <= 7; lv2++) { ap('   Lv' + lv2 + ' = ' + fmtM(powOf(G.map.fortGarrison(lv2)))); }
  var ncities = (st.map.cities || []).filter(function (c) { return c.owner === 'npc'; });
  ['county', 'jun', 'zhou', 'capital'].forEach(function (ty) {
    var c = ncities.filter(function (x) { return x.type === ty; })[0];
    if (!c) return;
    ap('   ' + c.name + '（' + ty + '）：战力 ' + fmtM(powOf(G.genGarrison(c))) + ' · def=' + c.def);
  });
} catch (e) { ap('C2 err ' + e.message); }

/* ============================================================
 * C3. 县城围攻数学 + 实攻样本
 * ============================================================ */
try {
  ap('');
  ap('===== C3. 县城围攻 =====');
  var nc2 = (st.map.cities || []).filter(function (c) { return c.owner === 'npc'; });
  var cty = nc2.filter(function (x) { return x.type === 'county'; })[0];
  if (cty) {
    var defPow = powOf(G.genGarrison(cty));
    var myPow = 1500 * tp('qingji');
    var ratio = defPow > 0 ? myPow / defPow : 0;
    var chip = G.siegeChipOf(ratio, 'encircle');
    ap('  1500 轻骑（' + fmtM(myPow) + '）压县城（' + fmtM(defPow) + '）：比 ' + ratio.toFixed(4)
      + ' → 单波破防 ' + chip + '% → 磨到 0 需 ' + Math.ceil(100 / chip) + ' 波');
    ap('  决战门槛（守备 0）：守军×35%×0.88 ≈ ' + fmtM(defPow * 0.35 * 0.88));
    setCity(c0); c0.army = { qingji: 3000 }; sta999(hero);
    var rc = null;
    try { rc = G.battle.expedition({ kind: 'city', id: cty.id, x: cty.x, y: cty.y }, 'occupy', { qingji: 3000 }, hero.id); } catch (e) { ap('  实攻 err ' + e.message); }
    if (rc) ap('  实攻样本（3000 轻骑）：ok=' + rc.ok + ' msg=' + String(rc.msg).slice(0, 110)
      + (rc.result ? ' result=' + JSON.stringify({ w: rc.result.winner, sg: rc.result.siege }) : ''));
  }
} catch (e) { ap('C3 err ' + e.message); }

/* ============================================================
 * C4. 据点：掠夺采样 + 磨城到下城（声望采样）
 * ============================================================ */
try {
  ap('');
  ap('===== C4. 据点样本 =====');
  var forts = [];
  for (var dyy = -26; dyy <= 26; dyy++) {
    for (var dxx = -26; dxx <= 26; dxx++) {
      var fx = c0.x + dxx, fy = c0.y + dyy;
      var f = G.map.fortAt(fx, fy);
      if (f) forts.push({ x: fx, y: fy, name: f.name, level: f.level, d: Math.abs(dxx) + Math.abs(dyy) });
    }
  }
  forts.sort(function (a, b) { return a.d - b.d; });
  var lvCnt = {}; forts.forEach(function (f) { lvCnt['Lv' + f.level] = (lvCnt['Lv' + f.level] || 0) + 1; });
  ap('  附近据点 ' + forts.length + ' 座：' + JSON.stringify(lvCnt));
  /* 掠夺（raid）一次 */
  var f0 = forts.filter(function (f) { return f.level >= 2; })[0] || forts[0];
  setCity(c0); c0.army = { qingji: 3000 }; sta999(hero);
  var rep0 = st.rep || 0;
  var items0 = JSON.parse(JSON.stringify(st.items || {}));
  var res0 = JSON.parse(JSON.stringify(c0.res));
  var rF = null;
  try { rF = G.battle.expedition({ kind: 'fort', x: f0.x, y: f0.y }, 'raid', { qingji: 3000 }, hero.id, null); } catch (e) { ap('  raid err ' + e.message); }
  if (rF) ap('  raid ' + f0.name + 'Lv' + f0.level + '：ok=' + rF.ok + ' ' + (rF.result ? JSON.stringify({ w: rF.result.winner, rounds: rF.result.rounds, atkLoss: rF.result.atkLoss, defLoss: rF.result.defLoss }) : String(rF.msg).slice(0, 80)));
  var gained = [];
  Object.keys(st.items || {}).forEach(function (k) { var d = (st.items[k] || 0) - (items0[k] || 0); if (d > 0) gained.push(k + '+' + d); });
  var resG = [];
  ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { var d = (c0.res[k] || 0) - (res0[k] || 0); if (Math.abs(d) > 1000) resG.push(k + (d > 0 ? '+' : '') + fmtM(d)); });
  ap('  掉落：' + (gained.join(' ') || '无') + ' | 城资源变化：' + (resG.join(' ') || '无（以掉落为准）'));
  ap('  声望 ' + rep0 + ' → ' + (st.rep || 0));
  /* 磨城：挑一座 Lv1~2 连续 occupy 直到 raze */
  var fS = forts.filter(function (f) { return f.level <= 2; })[0];
  if (fS) {
    ap('');
    ap('  磨城样本：' + fS.name + 'Lv' + fS.level);
    var rep1 = st.rep || 0;
    for (var wv = 1; wv <= 12; wv++) {
      setCity(c0); c0.army = { qingji: 3000 }; sta999(hero);
      var rw = null;
      try { rw = G.battle.expedition({ kind: 'fort', x: fS.x, y: fS.y }, 'occupy', { qingji: 3000 }, hero.id, { ops: 'encircle' }); } catch (e) { ap('   波 err ' + e.message); break; }
      var hold = null; try { hold = G.siegeHoldOf({ kind: 'fort', x: fS.x, y: fS.y }); } catch (e) {}
      var gone = !G.map.fortAt(fS.x, fS.y);
      ap('    第' + wv + '波：w=' + (rw && rw.result ? rw.result.winner : '?') + ' 守备余 ' + (hold == null ? '?' : Math.round(hold)) + '%'
        + (rw && rw.result && rw.result.siege ? '（破防 ' + rw.result.siege.chip + '%）' : '') + (gone ? ' → 下城！' : ''));
      if (gone) break;
    }
    ap('    声望变化：' + rep1 + ' → ' + (st.rep || 0) + '（+' + ((st.rep || 0) - rep1) + '）· 据点今日已不复现（次日重生：见 fortRazedToday 语义）');
  }
} catch (e) { ap('C4 err ' + e.message); }

ap('');
ap('===== 汇总 =====');
ap('  见上：A 对撞/阶梯 · C1 城流 · C2 守军 · C3 县城 · C4 据点样本');
fs.writeFileSync(R + '.workbuddy/tmp/probe_v89101b_explore.txt', OUT.join('\n'), 'utf8');
console.log('EXPLORE PROBE B DONE · lines=' + OUT.length);
