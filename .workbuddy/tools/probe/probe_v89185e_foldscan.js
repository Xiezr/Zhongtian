/* v89.185（老板 2 · 平衡扫描）：守将"等级→战力"的**折损系数**扫描 ——
   dim：四维成长折 · staPct：体力增量折（100 基础不动）。
   目标：让"有将"明显有感（vs 半残将）+100% 上下，又不至于让 Lv10 据点不可胜。
   名城侧（npcCityGuard 不折）另列。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: 'fold', avatar: '🧔', gender: 'male', region: '碎垣' });
G.state.world.weather = 'clear';
function sum(o) { var s = 0; for (var k in o) s += o[k] || 0; return s; }

/* 造守将（复刻 guardFillOf 逻辑 + fold 参数） */
function mk(rankId, lv, dim, staPct) {
  var g = G.makeGeneral('测', lv, 'guard', null, false, rankId, 'balance');
  var rk = G.rankOf(g);
  var m = { tong: 1, nz: 1, yw: 1, zm: 1 }, f = 1.25;   /* balance：mul 全 1 → f=5/4 */
  var up = Math.max(0, lv - 1);
  ['tong', 'yw', 'zm', 'nz'].forEach(function (d) {
    g[d] = Math.round(rk.base[1] * m[d] + up * (rk.grow || 1) * m[d] * f * dim);
  });
  g.freePts = 0;
  G.setStaNow(g, Math.round(100 + (G.staMax(g) - 100) * staPct));
  g.npcGuard = true;
  return g;
}
var MYGEN = mk('ying', 60, 1, 1);   /* 我方将（满状态英杰 Lv60） */
function sim(atk, ag, def, dg) { return T.simulate(JSON.parse(JSON.stringify(atk)), ag, JSON.parse(JSON.stringify(def)), 0, dg, {}); }

var FOLDS = [
  ['无折(1.0/1.0)', 1.0, 1.0],
  ['轻折(0.7/0.7)', 0.7, 0.7],
  ['半折(0.5/0.5)', 0.5, 0.5],
  ['深折(0.35/0.35)', 0.35, 0.35],
];
[[1, 0, 0], [1, 0, 0], [0, 0, 0]].forEach(function () {});

console.log('====== 野地 / 据点 × fold 扫描（我方 1.5×守军 · 英杰 Lv60 满状态）======');
[['野地', 10, 'wild'], ['野地', 7, 'wild'], ['据点', 10, 'fort'], ['据点', 7, 'fort'], ['据点', 5, 'fort']].forEach(function (sc) {
  var kind = sc[2], lv = sc[1];
  var def, armyA;
  if (kind === 'wild') {
    var wd = G.wildDefenseAt(200 + lv, 260, lv);
    def = wd.army;
    armyA = {}; for (var k in def) armyA[k] = Math.round(def[k] * 1.5);
  } else {
    def = G.map.fortGarrison(lv);
    armyA = {}; for (var k2 in def) armyA[k2] = Math.round(def[k2] * 1.5);
  }
  var rankId = (kind === 'wild') ? 'ying' : 'ming';
  var base = (kind === 'wild') ? 30 + (lv - 1) * 10 + 4 : 60 + (lv - 1) * 10 + 4;
  var r0 = sim(armyA, MYGEN, def, null);
  var line = '▶ ' + sc[0] + ' Lv' + lv + '（守军 ' + sum(def) + ' · 我方 ' + sum(armyA) + '）  无将: 我损 ' + r0.atkLoss;
  console.log(line);
  FOLDS.forEach(function (fd) {
    var r = sim(armyA, MYGEN, def, mk(rankId, base, fd[1], fd[2]));
    var mul = (r.atkLoss / r0.atkLoss).toFixed(2);
    console.log('    ' + fd[0].padEnd(16) + (r.winner === 'atk' ? '我胜' : '守胜') + '  我损 ' + String(r.atkLoss).padEnd(7)
      + '（×' + mul + '） 敌损 ' + String(r.defLoss).padEnd(7) + r.rounds + '回合');
  });
});
console.log('');
console.log('====== 名城侧（npcCityGuard 不折 · 旧区间 vs 新区间 · 县城 46 万守军模型）======');
/* 县城守军模型：用 fortGarrison(10) × 2 近似 46 万（只测方向差异） */
var bigDef = { changqiang: 160000, daodun: 130000, gongjian: 90000, qingji: 50000, tieji: 30000 };
var armyA15 = { changqiang: 60000, daodun: 45000, gongjian: 30000, qingji: 15000 };
['旧县将Lv68', '新县将Lv135'].forEach(function (tag, i) {
  var lv = i === 0 ? 68 : 135;
  var g = mk('tian', lv, 1, 1);
  var r = sim(armyA15, MYGEN, bigDef, g);
  console.log('  ' + tag + ' → ' + (r.winner === 'atk' ? '我胜' : '守胜') + ' 我损 ' + r.atkLoss + ' 敌损 ' + r.defLoss + ' ' + r.rounds + '回合');
});
console.log('  （我方 15 万 vs 46 万守军：方向性对照——守将 68 → 135 的磨血差异）');
process.exit(0);
