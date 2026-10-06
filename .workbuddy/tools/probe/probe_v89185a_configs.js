/* ============================================================
 * probe_v89185a_configs.js —— 野地/据点/名城 将领与兵力配置全表（v89.185）
 * ------------------------------------------------------------
 * 老板令：「列出野地/城池/名城的将领和兵力配置，我看有没有必要增强」。
 * 本探针从**真实生成出口**逐档取数（不抄表）：
 *   · 野地   GAME.wildDefenseAt(x, y, lv)      （守军 + 概率守将）
 *   · 据点   GAME.map.fortGarrison(lv) + GAME.map.fortGuardOf(fort)
 *   · 名城   GAME.genGarrison(city) + GAME.npcCityGuard(city)（四档样例城）
 * 附「玩家出兵力对照」（校场容量）供"要不要增强"直接判读。
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

G.newGame({ name: '探185', avatar: '🧔', gender: 'male', region: '碎垣' });
var s = G.state;

function sum(o) { var n = 0; for (var k in o) n += o[k] || 0; return n; }
function mixText(a) {
  var out = [];
  for (var k in a) if (a[k] > 0) out.push((DATA.TROOPS[k] || {}).name + a[k]);
  return out.join(' ');
}
function genText(g) {
  if (!g) return '（无）';
  var rk = (DATA.GEN_RANK_BY_ID && DATA.GEN_RANK_BY_ID[g.rank]) || {};
  return g.name + '（' + (rk.name || g.rank) + ' Lv' + g.level + '）';
}

/* ============================================================
 * 一、野地 Lv0-10
 * ============================================================ */
console.log('=== 一、野地（Lv0-10）守军与守将 ===');
console.log('等级  守军总量(实际roll)   守将概率  守将资质档    守将等级');
[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (lv) {
  var wd = G.wildDefenseAt(100 + lv, 100, lv);
  var tot = sum(wd.army);
  var chance = DATA.WILD_GEN_CHANCE[lv] || 0;
  var rIdx = G.guardRankIdxOf('wild', lv);
  var rkName = (DATA.GEN_RANKS[rIdx] || {}).name || '?';
  var lvTxt = wd.gen ? ('既有 ' + genText(wd.gen)) : ('max(3, ' + (lv * 2) + '~' + (lv * 2 + 5) + ')');
  console.log(String(lv).padEnd(6) + String(tot).padEnd(20)
    + ((chance * 100).toFixed(0) + '%').padEnd(10)
    + rkName.padEnd(14) + lvTxt);
});
console.log('  （样例 roll 于 (100+lv,100)；兵种构成：Lv0-3 义兵/长枪(3起加弓)，Lv4+ 长枪/刀盾/弓，Lv5+ 加轻骑，Lv9+ 加铁骑/床弩，Lv10 加投石）');
console.log('  构成样例 Lv10: ' + mixText(G.wildDefenseAt(110, 100, 10).army));

/* ============================================================
 * 二、据点（野外城池）Lv1-10
 * ============================================================ */
console.log('');
console.log('=== 二、据点（野外城池 Lv1-10）守军与守将 ===');
console.log('等级  守军总量     守将（必有·确定性）');
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (lv) {
  var fg = G.map.fortGarrison(lv);
  var fake = { x: 200 + lv, y: 150, level: lv };
  var gd = G.fortGuardOf(fake);   /* 挂在 GAME 上（非 GAME.map） */
  console.log(String(lv).padEnd(6) + String(sum(fg)).padEnd(13) + genText(gd));
});
console.log('  构成：义兵35% 长枪25% 刀盾20% 弓20%（Lv4+ 加轻骑10%）');
console.log('  守将资质：min(4, 2+⌊lv/3⌋)（比同级野地高一档）· 等级 max(10, lv*4+20)+0~5');

/* ============================================================
 * 三、名城（四档）
 * ============================================================ */
console.log('');
console.log('=== 三、名城（四档）守军/守将/城防/城容 ===');
console.log('档位    城名       城等级  守军总量      守将                  城防  库藏(粮)');
['capital', 'zhou', 'jun', 'county'].forEach(function (ty) {
  var c = null;
  (s.map.cities || []).forEach(function (x) { if (!c && x.type === ty) c = x; });
  if (!c) return;
  var gs = G.genGarrison(c);
  var gd = G.npcCityGuard(c);
  var gdTxt = gd ? (gd.name + '（天授 Lv' + gd.level + '）') : '（无）';
  var a = gd ? G.genAttrs(gd) : null;
  console.log(((DATA.CITY_PERK[ty] || {}).name || ty).padEnd(8) + c.name.padEnd(10)
    + String(G.cityLvOf(c)).padEnd(8) + String(sum(gs)).padEnd(14) + gdTxt.padEnd(22)
    + String(c.def || 0).padEnd(6) + U.fmt((c.res && c.res.grain) || 0)
    + (a ? ('　四维 统' + a.tong + '/武' + a.yw + '/谋' + a.zm) : ''));
});
console.log('  构成（garrisonMix 权重）：' + DATA.NPC_CITY_RES.garrisonMix.map(function (m) { return (DATA.TROOPS[m.id] || {}).name + (m.w * 100) + '%'; }).join(' '));
console.log('  守军波动：同类城 ±8%（确定性哈希）· 全部派生不入档');

/* ============================================================
 * 四、玩家出兵力对照（判读"要不要增强"的尺子）
 * ============================================================ */
console.log('');
console.log('=== 四、玩家出兵力对照（校场容量 = 校场等级 × 10000 人马）===');
var c0 = s.cities[0];
[6, 8, 10, 12].forEach(function (lv) {
  var fake = JSON.parse(JSON.stringify(c0));
  fake.cells.forEach(function (x) { if (x.build && x.build.id === 'xiaochang') x.build.lvl = lv; });
  if (!fake.cells.some(function (x) { return x.build && x.build.id === 'xiaochang'; })) {
    fake.cells[0].build = { id: 'xiaochang', lvl: lv };
  }
  console.log('  校场 Lv' + String(lv).padEnd(4) + '出征容量 = ' + U.fmt(G.battle.marchCapOf(fake)) + ' 人');
});
console.log('');
console.log('=== 五、对照卡（v89.183 已实测的玩家强度基准）===');
console.log('  · 满配将（体力 15395 · 方案A 后 hpMult ×1.952）：全军攻击 atkPct ≈ 657%');
console.log('  · 满配将 3 万兵 vs Lv10 野地满档（5.75 万守军）：大胜（损 19%）');
console.log('  · 满配将 1 万兵 vs 同目标：临界（曲线修复后险胜）');
console.log('  · 对照：县城守军 50 万 = Lv10 野地满档的 8.7 倍；都城 300 万 = 52 倍');
process.exit(0);
