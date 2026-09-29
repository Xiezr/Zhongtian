/* v89.186c：补验证 —— ① 扫格找"有守将"的野地坐标（守将生成是确定性 hash）；
   ② 前期场景（良才 Lv15 vs 有将野地）在 staPct 0.8 下的净损；
   ③ 据点 Lv10 staPct 0.8 是否仍"可胜"（不破墙）。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: 'wd3', avatar: '🧔', gender: 'male', region: '豫州' });
G.state.world.weather = 'clear';
if (!G.state.map.grid) G.map.generate();

function sum(o) { var s = 0; for (var k in o) s += o[k] || 0; return s; }
function mkGen(rankId, lv) {
  var g = G.makeGeneral('测将', lv, 'guard', null, false, rankId, 'balance');
  G.guardFillOf(g, null); g.npcGuard = true; return g;
}
function mkGuardWith(rankId, lv, staPct, dim) {
  var g = G.makeGeneral('守将', lv, 'guard', null, false, rankId, 'balance');
  G.guardFillOf(g, { dim: dim, staPct: staPct });
  g.npcGuard = true; return g;
}
function sim(atk, ag, def, dg) { return T.simulate(JSON.parse(JSON.stringify(atk)), ag, JSON.parse(JSON.stringify(def)), 0, dg, {}); }

/* 扫格找"有守将"的野地坐标（确定性 hash，同一次 seed 内稳定） */
function findWithGen(lv) {
  for (var x = 150; x < 320; x += 1) {
    for (var y = 150; y < 320; y += 1) {
      var tl = G.map.tile(x, y);
      if (!tl || tl.terrain === 'city' || tl.terrain === 'water' || tl.terrain === 'mountain') continue;
      var wd = G.wildDefenseAt(x, y, lv);
      if (wd && wd.gen) return { x: x, y: y, wd: wd };
    }
  }
  return null;
}

var PLAYER = mkGen('ying', 60);
var PLAYER_WEAK = mkGen('liang', 15);
var W = { 3: findWithGen(3), 5: findWithGen(5), 7: findWithGen(7) };
console.log('====== 0、扫描结果（有守将坐标）======');
[3, 5, 7].forEach(function (lv) {
  var f = W[lv];
  console.log('  野地 Lv' + lv + '：' + (f ? '(' + f.x + ',' + f.y + ') 守军 ' + f.wd.total + ' 守将 Lv' + f.wd.gen.level + '（' + f.wd.gen.rank + '）' : '未找到'));
});

console.log('');
console.log('====== 一、前期场景（良才 Lv15 · 1.0× 兵力 vs 有将野地）—— staPct 对照 ======');
console.log('（老板语境：「玩家将领前期还不如野地」→ 提高伤兵比例的动机场景）');
[[0.5, 0.5], [0.8, 0.5]].forEach(function (cfg) {
  var line = 'staPct=' + cfg[0] + ' dim=' + cfg[1] + '  ';
  [3, 5, 7].forEach(function (lv) {
    var f = W[lv]; if (!f) { line += ('Lv' + lv + '无').padEnd(20); return; }
    var arm = {}; for (var k in f.wd.army) arm[k] = Math.round(f.wd.army[k] * 1.0);
    var gd = mkGuardWith('ying', f.wd.gen.level, cfg[0], cfg[1]);
    var r = sim(arm, PLAYER_WEAK, f.wd.army, gd);
    var dr = r.atkLoss / sum(arm);
    line += ('Lv' + lv + ':' + (r.winner === 'atk' ? '胜' : '负') + ' 阵亡' + (dr * 100).toFixed(0) + '%').padEnd(20);
  });
  console.log('  ' + line);
});

console.log('');
console.log('====== 二、正常场景（英杰 Lv60 · 1.5× 兵力）—— staPct 对照（胜负+阵亡） ======');
[[0.5, 0.5], [0.8, 0.5]].forEach(function (cfg) {
  var line = 'staPct=' + cfg[0] + '  ';
  [3, 5, 7].forEach(function (lv) {
    var f = W[lv]; if (!f) { line += ('Lv' + lv + '无').padEnd(20); return; }
    var arm = {}; for (var k in f.wd.army) arm[k] = Math.round(f.wd.army[k] * 1.5);
    var gd = mkGuardWith('ying', f.wd.gen.level, cfg[0], cfg[1]);
    var r = sim(arm, PLAYER, f.wd.army, gd);
    line += ('Lv' + lv + ':' + (r.winner === 'atk' ? '胜' : '负') + ' 阵亡' + ((r.atkLoss / sum(arm)) * 100).toFixed(0) + '%').padEnd(20);
  });
  console.log('  ' + line);
});

console.log('');
console.log('====== 三、据点 Lv10 破墙检查（staPct 0.8 · 1.5× 兵力）======');
[0.5, 0.8].forEach(function (st) {
  var garr = G.map.fortGarrison(10);
  var arm = {}; for (var k in garr) arm[k] = Math.round(garr[k] * 1.5);
  var fg = mkGuardWith('ming', 60 + 9 * 10 + 4, st, 0.5);
  var r = sim(arm, PLAYER, garr, fg);
  console.log('  staPct=' + st + '：' + (r.winner === 'atk' ? '我胜' : '守胜') + ' 我损 ' + r.atkLoss
    + '（' + ((r.atkLoss / sum(arm)) * 100).toFixed(0) + '%）敌损 ' + r.defLoss + ' ' + r.rounds + '回合');
});

console.log('');
console.log('====== 四、净损总表（staPct=0.8 · base rate 对照）======');
var rows = [];
[3, 5, 7].forEach(function (lv) {
  var f = W[lv]; if (!f) return;
  [{ mul: 1.0, gen: PLAYER_WEAK, tag: '前期' }, { mul: 1.5, gen: PLAYER, tag: '正常' }].forEach(function (sc) {
    var arm = {}; for (var k in f.wd.army) arm[k] = Math.round(f.wd.army[k] * sc.mul);
    var gd = mkGuardWith('ying', f.wd.gen.level, 0.8, 0.5);
    var r = sim(arm, sc.gen, f.wd.army, gd);
    rows.push({ tag: sc.tag + '野' + lv + '×' + sc.mul, dr: r.atkLoss / sum(arm) });
  });
});
var garr10 = G.map.fortGarrison(10);
var arm10 = {}; for (var k10 in garr10) arm10[k10] = Math.round(garr10[k10] * 1.5);
var r10 = sim(arm10, PLAYER, garr10, mkGuardWith('ming', 154, 0.8, 0.5));
rows.push({ tag: '正常据10×1.5', dr: r10.atkLoss / sum(arm10) });

var hdr = '场景'.padEnd(16) + '阵亡'.padEnd(8);
[0.70, 0.75, 0.80].forEach(function (rt) { hdr += ('净损@' + rt).padEnd(12); });
console.log(hdr);
rows.forEach(function (s) {
  var line = s.tag.padEnd(16) + ((s.dr * 100).toFixed(0) + '%').padEnd(8);
  [0.70, 0.75, 0.80].forEach(function (rt) {
    var nr = s.dr * (1 - rt);
    line += ((nr * 100).toFixed(1) + '%' + (nr <= 0.2 ? '✓' : '✗')).padEnd(12);
  });
  console.log(line);
});
console.log('');
console.log('（✓ = 满足老板验收「净损 ≤ 0.2」）');
process.exit(0);
