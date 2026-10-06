/* ============================================================
 * probe_v89182a_gen_bonus.js —— 将领对军队战的加成 全链路取证（v89.182）
 * ------------------------------------------------------------
 * 老板问：「目前是否考虑了将领对军队战的加成呢？」
 * 本探针用**真实出口**回答：
 *   ① 加成链读数（genAttrs → atkPct/defPct/cover/hpMult/spdMul 五条通道）
 *   ② 镜像对局（长枪5000 vs 长枪5000）：无将 vs 五档资质将 → 胜负/损失
 *   ③ 单通道拆解（顶配将：全开 / 去攻 / 去防 / 去生命 / 去速度）
 *   ④ 统率覆盖边界（同将变统率：全覆盖 vs 折半）
 *   ⑤ 守城战全覆盖（playerDef：cover 强制 1）
 * 全程走 GAME.genAttrs / GAME.staHpBonus / T.simulate —— 不自行复算公式。
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils, T = G.tactic;

G.newGame({ name: '探182', avatar: '🧔', gender: 'male', region: '碎垣' });
G.state.world.weather = 'clear';        /* §90.1：战斗数字受天气影响，固定晴天 */
console.log('天气 = ' + G.story.currentWeather().name + '（固定）');

/* ---------- 将领工厂：资质中值四维 + 满体力 ---------- */
var RANKS = [
  ['fan', '凡品Lv60', 60, 37],
  ['liang', '良材Lv100', 100, 54],
  ['ying', '英杰Lv140', 140, 74],
  ['ming', '名世Lv180', 180, 96],
  ['tian', '天授Lv240', 240, 124],
];
function mkGen(rankId, lv, v) {
  var g = G.makeGeneral('探', lv, 'idle', null, false, rankId, 'balance');
  g.tong = v; g.yw = v; g.zm = v; g.nz = v;
  G.setStaNow(g, G.staMax(g));          /* 满体力（hpMult 通道拉满） */
  return g;
}

/* ============================================================
 * ① 加成链读数
 * ============================================================ */
console.log('');
console.log('=== ① 加成链读数（勇武/智谋/统率/速度 四维同值 v）===');
console.log('档位'.padEnd(12) + '四维'.padEnd(8) + '体力'.padEnd(8) + 'atkPct'.padEnd(10) + 'defPct'.padEnd(10) + 'hpMult'.padEnd(10) + 'spd'.padEnd(8) + 'cover(5000兵)');
var gens = {};
RANKS.forEach(function (r) {
  var g = mkGen(r[0], r[2], r[3]);
  gens[r[0]] = g;
  var a = G.genAttrs(g);
  var hpM = 1 + G.staHpBonus(g);
  var cover = Math.min(1, a.tong * 100 / 5000);
  var spdMul = 1 + a.spd / 300;
  console.log(r[1].padEnd(12) + String(r[3] + '×4').padEnd(8)
    + String(G.staNow(g)).padEnd(8)
    + ((a.atkPct * 100).toFixed(2) + '%').padEnd(10)
    + ((a.defPct * 100).toFixed(2) + '%').padEnd(10)
    + ('×' + hpM.toFixed(3)).padEnd(10)
    + String(a.spd).padEnd(8)
    + cover.toFixed(2) + (spdMul > 1.001 ? ('（速 ×' + spdMul.toFixed(3) + '）') : ''));
});
console.log('  （无将 = 全通道为 0：atkPct 0 / defPct 0 / hpMult 1 / cover 0）');

/* ============================================================
 * ② 镜像对局：无将 vs 五档
 * ============================================================ */
function sim(atkArmy, atkGen, defArmy, defGen, opts) {
  return T.simulate(JSON.parse(JSON.stringify(atkArmy)), atkGen,
    JSON.parse(JSON.stringify(defArmy)), 0, defGen, opts || {});
}
console.log('');
console.log('=== ② 镜像对局：长枪 5000 vs 长枪 5000（我方带将 · 敌方无将）===');
console.log('我方档位'.padEnd(14) + '结果'.padEnd(10) + '我损'.padEnd(10) + '敌损'.padEnd(10) + '回合');
var base0 = sim({ changqiang: 5000 }, null, { changqiang: 5000 }, null);
console.log('（对照：双方都无将）'.padEnd(14) + base0.winner.padEnd(10)
  + String(base0.atkLoss).padEnd(10) + String(base0.defLoss).padEnd(10) + base0.rounds);
RANKS.forEach(function (r) {
  var res = sim({ changqiang: 5000 }, gens[r[0]], { changqiang: 5000 }, null);
  console.log(r[1].padEnd(14) + String(res.winner).padEnd(10)
    + String(res.atkLoss).padEnd(10) + String(res.defLoss).padEnd(10) + res.rounds);
});

/* ============================================================
 * ③ 单通道拆解（天授顶配：全开 / 逐条归零）
 * ============================================================ */
console.log('');
console.log('=== ③ 单通道拆解（天授Lv240 · 长枪5000 vs 长枪5000）===');
var V = 124;
function variant(tag, mut) {
  var g = mkGen('tian', 240, V);
  if (mut) mut(g);
  var res = sim({ changqiang: 5000 }, g, { changqiang: 5000 }, null);
  var a = G.genAttrs(g);
  console.log(('  ' + tag).padEnd(20) + String(res.winner).padEnd(10)
    + ('我损 ' + res.atkLoss).padEnd(14) + ('敌损 ' + res.defLoss).padEnd(14) + res.rounds + ' 回合'
    + '  [yw' + a.yw + ' zm' + a.zm + ' spd' + a.spd + ' 体' + G.staNow(g) + ']');
}
variant('全开（基准）', null);
variant('去攻（yw=0）', function (g) { g.yw = 0; });
variant('去防（zm=0）', function (g) { g.zm = 0; });
variant('去生命（体力=0）', function (g) { G.setStaNow(g, 0); });
variant('去速度（纯 spdAdd 抵消）', function (g) { g.spdAdd = -(10 + Math.floor(239 / 5)); });   /* 只清速度通道：不动 level（level 会连带体力上限）*/
variant('全去（仅统率）', function (g) { g.yw = 0; g.zm = 0; g.spdAdd = -(10 + Math.floor(239 / 5)); G.setStaNow(g, 0); });

/* ============================================================
 * ④ 统率覆盖边界（同将：统率变 → cover 变）
 * ============================================================ */
console.log('');
console.log('=== ④ 统率覆盖（四维固定 124 · 仅统率变 · 长枪5000 vs 长枪5000）===');
function withTong(tong, tag) {
  var g = mkGen('tian', 240, 124);
  g.tong = tong;
  var a = G.genAttrs(g);
  var cover = Math.min(1, a.tong * 100 / 5000);
  var res = sim({ changqiang: 5000 }, g, { changqiang: 5000 }, null);
  console.log('  ' + tag.padEnd(30) + 'cover=' + cover.toFixed(2).padEnd(8)
    + String(res.winner).padEnd(10) + ('我损 ' + res.atkLoss).padEnd(14) + ('敌损 ' + res.defLoss).padEnd(14) + res.rounds + ' 回合');
}
withTong(124, '统率124（覆盖 12400 ≥ 5000）');
withTong(25, '统率25（仅覆盖 2500 兵）');
withTong(1, '统率1（仅覆盖 100 兵）');

/* ============================================================
 * ⑤ 守城战全覆盖（v89.115 playerDef）
 * ============================================================ */
console.log('');
console.log('=== ⑤ 守城战：守将加成全覆盖（playerDef）===');
function coverRead(playerDef) {
  var g = mkGen('ying', 140, 74);
  g.tong = 20;                          /* 统率故意低 → 野战只覆盖 2000 兵 */
  var env = T.begin({ changqiang: 6000 }, null, { changqiang: 5000 }, 0, g,
    playerDef ? { playerDef: true } : {});
  var u = env.units.def[0];
  return u ? u.cover : null;
}
console.log('  野战（无 playerDef）：cover = ' + coverRead(false) + '（统率20 → 2000/5000 = 0.40）');
console.log('  守城（playerDef:true）：cover = ' + coverRead(true) + '（守将加成不打折扣）');

/* ============================================================
 * ⑥ 体力通道单测（同资质 · 满体力 vs 空体力）
 * ============================================================ */
console.log('');
console.log('=== ⑥ 体力通道（名世Lv180 · 仅体力变）===');
[['满体力', G.staMax(mkGen('ming', 180, 96))], ['空体力', 0]].forEach(function (x) {
  var g = mkGen('ming', 180, 96);
  G.setStaNow(g, x[1]);
  var res = sim({ changqiang: 5000 }, g, { changqiang: 5000 }, null);
  console.log('  ' + x[0].padEnd(10) + ('体力' + G.staNow(g)).padEnd(12)
    + 'hpMult=×' + (1 + G.staHpBonus(g)).toFixed(3) + '  '
    + String(res.winner).padEnd(10) + ('我损 ' + res.atkLoss).padEnd(14) + ('敌损 ' + res.defLoss).padEnd(14) + res.rounds + ' 回合');
});

console.log('');
console.log('探针完成（全程读真实出口：genAttrs / staHpBonus / T.simulate）。');
process.exit(0);
