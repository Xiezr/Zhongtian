/* v89.186b（老板 2 · 配套标定）：守将**体力折损**（staPct）与**伤兵率**的组合效果。
   目标：选一组参数，使
     ① 守将体力"比玩家将领稍逊色"（staPct 上抬，老板原话）；
     ② 玩家每场战役**治疗后净损失 ≤ 0.10~0.20**（老板验收）。
   净损率 = 阵亡 × (1 − rate) / sent。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: 'wd2', avatar: '🧔', gender: 'male', region: '碎垣' });
G.state.world.weather = 'clear';
if (!G.state.map.grid) G.map.generate();

function sum(o) { var s = 0; for (var k in o) s += o[k] || 0; return s; }
function mkGen(rankId, lv) {
  var g = G.makeGeneral('测将', lv, 'guard', null, false, rankId, 'balance');
  G.guardFillOf(g, null); g.npcGuard = true; return g;
}
/* 守将（自定义 staPct / dim） */
function mkGuardWith(rankId, lv, staPct, dim) {
  var g = G.makeGeneral('守将', lv, 'guard', null, false, rankId, 'balance');
  G.guardFillOf(g, { dim: dim, staPct: staPct });
  g.npcGuard = true;
  return g;
}
function sim(atk, ag, def, dg) { return T.simulate(JSON.parse(JSON.stringify(atk)), ag, JSON.parse(JSON.stringify(def)), 0, dg, {}); }

var PLAYER = mkGen('ying', 60);   /* 玩家将领（英杰 Lv60 满状态） */
var PLAYER_WEAK = mkGen('liang', 15);

console.log('====== 一、守将体力/属性折损档 → 战斗阵亡率（野地·我方1.5×）======');
console.log('staPct/dim 组合：0.5/0.5（现状） · 0.7/0.5 · 0.8/0.5 · 0.8/0.6 · 0.85/0.6');
[[0.5, 0.5], [0.7, 0.5], [0.8, 0.5], [0.8, 0.6], [0.85, 0.6]].forEach(function (cfg) {
  var line = 'staPct=' + cfg[0] + ' dim=' + cfg[1] + '  ';
  [5, 7, 10].forEach(function (lv) {
    var wd = G.wildDefenseAt(400 + lv, 500, lv);
    var arm = {}; for (var k in wd.army) arm[k] = Math.round(wd.army[k] * 1.5);
    var gd = wd.gen ? mkGuardWith('ying', 30 + (lv - 1) * 10 + 4, cfg[0], cfg[1]) : null;
    var r = sim(arm, PLAYER, wd.army, gd);
    var dr = gd ? r.atkLoss / sum(arm) : 0;
    line += ('Lv' + lv + (gd ? '有将阵亡' + (dr * 100).toFixed(0) + '%' : '无将')).padEnd(16);
  });
  console.log('  ' + line);
});

console.log('');
console.log('====== 二、据点（我方1.5×）======');
[[0.5, 0.5], [0.7, 0.5], [0.8, 0.5], [0.8, 0.6], [0.85, 0.6]].forEach(function (cfg) {
  var line = 'staPct=' + cfg[0] + ' dim=' + cfg[1] + '  ';
  [3, 7, 10].forEach(function (lv) {
    var garr = G.map.fortGarrison(lv);
    var arm = {}; for (var k in garr) arm[k] = Math.round(garr[k] * 1.5);
    var fg = mkGuardWith('ming', 60 + (lv - 1) * 10 + 4, cfg[0], cfg[1]);
    var r = sim(arm, PLAYER, garr, fg);
    line += ('Lv' + lv + '阵亡' + ((r.atkLoss / sum(arm)) * 100).toFixed(0) + '%').padEnd(16);
  });
  console.log('  ' + line);
});

console.log('');
console.log('====== 三、前期劣势（我方1.0× · 良才Lv15 vs 野地）======');
[[0.5, 0.5], [0.8, 0.5], [0.85, 0.6]].forEach(function (cfg) {
  var line = 'staPct=' + cfg[0] + ' dim=' + cfg[1] + '  ';
  [3, 5, 7].forEach(function (lv) {
    var wd = G.wildDefenseAt(600 + lv, 700, lv);
    var arm = {}; for (var k in wd.army) arm[k] = Math.round(wd.army[k] * 1.0);
    var gd = wd.gen ? mkGuardWith('ying', 30 + (lv - 1) * 10 + 4, cfg[0], cfg[1]) : null;
    var r = sim(arm, PLAYER_WEAK, wd.army, gd);
    var dr = gd ? r.atkLoss / sum(arm) : 0;
    line += ('Lv' + lv + (gd ? '阵亡' + (dr * 100).toFixed(0) + '%' : '无将')).padEnd(14);
  });
  console.log('  ' + line);
});

console.log('');
console.log('====== 四、净损表（staPct=0.8 dim=0.5 档 × rate）======');
var DR = { '野5·1.5': 0, '野7·1.5': 0, '野10·1.5': 0, '据3·1.5': 0, '据7·1.5': 0, '据10·1.5': 0, '前期野5·1.0': 0, '前期野7·1.0': 0 };
[5, 7, 10].forEach(function (lv) {
  var wd = G.wildDefenseAt(800 + lv, 900, lv);
  var arm = {}; for (var k in wd.army) arm[k] = Math.round(wd.army[k] * 1.5);
  var gd = mkGuardWith('ying', 30 + (lv - 1) * 10 + 4, 0.8, 0.5);
  DR['野' + lv + '·1.5'] = sim(arm, PLAYER, wd.army, gd).atkLoss / sum(arm);
  var garr = G.map.fortGarrison(lv);
  var arm2 = {}; for (var k2 in garr) arm2[k2] = Math.round(garr[k2] * 1.5);
  var fg = mkGuardWith('ming', 60 + (lv - 1) * 10 + 4, 0.8, 0.5);
  DR['据' + lv + '·1.5'] = sim(arm2, PLAYER, garr, fg).atkLoss / sum(arm2);
});
[5, 7].forEach(function (lv) {
  var wd = G.wildDefenseAt(950 + lv, 960, lv);
  var arm = {}; for (var k in wd.army) arm[k] = Math.round(wd.army[k] * 1.0);
  var gd = mkGuardWith('ying', 30 + (lv - 1) * 10 + 4, 0.8, 0.5);
  DR['前期野' + lv + '·1.0'] = sim(arm, PLAYER_WEAK, wd.army, gd).atkLoss / sum(arm);
});
var hdr = '场景'.padEnd(14) + '阵亡'.padEnd(8);
[0.70, 0.75, 0.80, 0.85].forEach(function (rt) { hdr += ('净损@' + rt).padEnd(12); });
console.log(hdr);
Object.keys(DR).forEach(function (tag) {
  var dr = DR[tag];
  var line = tag.padEnd(14) + ((dr * 100).toFixed(0) + '%').padEnd(8);
  [0.70, 0.75, 0.80, 0.85].forEach(function (rt) {
    var nr = dr * (1 - rt);
    line += ((nr * 100).toFixed(1) + '%' + (nr <= 0.2 ? '✓' : '✗')).padEnd(12);
  });
  console.log(line);
});

console.log('');
console.log('====== 五、守将体力现状读数（staPct 对照 · 不同等级）======');
[[0.5], [0.7], [0.8]].forEach(function (cfg) {
  var line = 'staPct=' + cfg[0] + '  ';
  [30, 70, 120, 180, 240].forEach(function (lv) {
    var g = mkGuardWith('ying', lv, cfg[0], 0.5);
    line += ('Lv' + lv + ': ' + Math.round(G.staNow(g)) + '/' + Math.round(G.staMax(g))).padEnd(18);
  });
  console.log('  ' + line);
});
console.log('（玩家将领满状态 = staNow 100% 池）');

console.log('');
console.log('====== 六、守城战对齐验证（走新出口后率是否生效）======');
console.log('· 当前 state.js 守城只读 base（无 buff/tech/sect）—— 待统一到 GAME.woundedRateOf');
process.exit(0);
