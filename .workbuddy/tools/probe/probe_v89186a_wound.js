/* v89.186（老板 2+4 · 取证）：伤兵回收率现状与"净损失 ≤ 0.1~0.2"所需的 rate。
   目标口径：
     · 阵亡率 = atkLoss / sent
     · 净损失率 = 阵亡 × (1 − rate) / sent（治疗后）
     · 老板验收：净损失率 ≤ 0.10~0.20
   跑真实引擎（tactic.simulate），覆盖：野地/据点 各档 × 有将/无将 × 1.5×/1.0× 兵力。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: 'wd', avatar: '🧔', gender: 'male', region: '豫州' });
G.state.world.weather = 'clear';
if (!G.state.map.grid) G.map.generate();

function sum(o) { var s = 0; for (var k in o) s += o[k] || 0; return s; }
function mkGen(rankId, lv) {
  var g = G.makeGeneral('测将', lv, 'guard', null, false, rankId, 'balance');
  G.guardFillOf(g, null);
  g.npcGuard = true;
  return g;
}
function sim(atk, ag, def, dg) { return T.simulate(JSON.parse(JSON.stringify(atk)), ag, JSON.parse(JSON.stringify(def)), 0, dg, {}); }

var RATE = (DATA.EXPEDITION && DATA.EXPEDITION.woundedRate) || 0.45;
console.log('====== 基础 woundedRate = ' + RATE + ' ======');
console.log('（净损率 = 阵亡 × (1−rate) / sent；老板验收 ≤ 0.10~0.20）');
console.log('');

function row(tag, atk, ag, def, dg) {
  var sent = sum(atk);
  var r = sim(atk, ag, def, dg);
  var loss = r.atkLoss;
  var dr = loss / sent;
  var net = loss * (1 - RATE);
  var nr = net / sent;
  /* 要让净损率 ≤ 0.20 需要的 rate；≤0.10 同理 */
  var need20 = dr > 0.2 ? (1 - 0.2 / dr) : 0;
  var need10 = dr > 0.1 ? (1 - 0.1 / dr) : 0;
  console.log('· ' + tag);
  console.log('    sent=' + sent + ' 阵亡=' + loss + '（' + (dr * 100).toFixed(1) + '%）'
    + ' 回合=' + r.rounds + ' ' + (r.winner === 'atk' ? '我胜' : '守胜'));
  console.log('    净损=' + Math.round(net) + '（' + (nr * 100).toFixed(1) + '%）'
    + '  | 达≤20%需 rate≥' + need20.toFixed(2) + ' · 达≤10%需 rate≥' + need10.toFixed(2));
}

console.log('------ 一、野地（我方 1.5× 兵力 · 英杰 Lv60 满状态） ------');
[1, 3, 5, 7, 10].forEach(function (lv) {
  var wd = G.wildDefenseAt(200 + lv, 260, lv);
  var armyA = {}; for (var k in wd.army) armyA[k] = Math.round(wd.army[k] * 1.5);
  row('野地 Lv' + lv + ' 无将（守军' + wd.total + '）', armyA, mkGen('ying', 60), wd.army, null);
  if (wd.gen) {
    var gd = G.wildDefenseAt(200 + lv, 260, lv).gen;
    row('野地 Lv' + lv + ' 有将（守军' + wd.total + '）', armyA, mkGen('ying', 60), wd.army, gd);
  }
});

console.log('');
console.log('------ 二、据点（我方 1.5× 兵力） ------');
[1, 3, 5, 7, 10].forEach(function (lv) {
  var garr = G.map.fortGarrison(lv);
  var armyA = {}; for (var k in garr) armyA[k] = Math.round(garr[k] * 1.5);
  var fg = null;
  try { fg = G.fortGuardOf({ x: 210, y: 261, lv: lv, level: lv }); } catch (e) {}
  row('据点 Lv' + lv + '（守军' + sum(garr) + '）', armyA, mkGen('ying', 60), garr, fg || null);
});

console.log('');
console.log('------ 三、劣势场景：玩家前期（1.0× 兵力 · 英杰 Lv15） ------');
[1, 3, 5, 7, 10].forEach(function (lv) {
  var wd = G.wildDefenseAt(230 + lv, 270, lv);
  var armyA = {}; for (var k in wd.army) armyA[k] = Math.round(wd.army[k] * 1.0);
  var gd = wd.gen;
  row('野地 Lv' + lv + '（同兵力' + wd.total + '）', armyA, mkGen('liang', 15), wd.army, gd);
});

console.log('');
console.log('------ 四、rate 敏感性：各场景在不同 rate 下的净损率 ------');
var scen = [];
[1, 3, 5, 7, 10].forEach(function (lv) {
  var wd = G.wildDefenseAt(260 + lv, 300, lv);
  var arm1 = {}; for (var k in wd.army) arm1[k] = Math.round(wd.army[k] * 1.5);
  var r1 = sim(arm1, mkGen('ying', 60), wd.army, wd.gen || null);
  scen.push({ tag: '野地Lv' + lv + '·1.5×', dr: r1.atkLoss / sum(arm1) });
  var garr = G.map.fortGarrison(lv);
  var arm2 = {}; for (var k2 in garr) arm2[k2] = Math.round(garr[k2] * 1.5);
  var fg2 = null; try { fg2 = G.fortGuardOf({ x: 261, y: 301, lv: lv, level: lv }); } catch (e) {}
  var r2 = sim(arm2, mkGen('ying', 60), garr, fg2 || null);
  scen.push({ tag: '据点Lv' + lv + '·1.5×', dr: r2.atkLoss / sum(arm2) });
});
var hdr = '场景'.padEnd(14);
[RATE, 0.55, 0.65, 0.75, 0.85].forEach(function (rt) { hdr += ('rate=' + rt).padEnd(11); });
console.log(hdr);
scen.forEach(function (s) {
  var line = s.tag.padEnd(14) + '(阵亡' + (s.dr * 100).toFixed(0) + '%)'.padEnd(6);
  [RATE, 0.55, 0.65, 0.75, 0.85].forEach(function (rt) {
    var nr = s.dr * (1 - rt);
    line += ((nr * 100).toFixed(1) + '%').padEnd(11);
  });
  console.log(line);
});

console.log('');
console.log('------ 五、伤兵系商品现状（替换语义 vs 基础 ' + RATE + '） ------');
['qingnangshu', 'xuming_shu', 'yisheng_shu'].forEach(function (id) {
  var it = null;
  (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
  if (!it) { console.log('· ' + id + ' 未找到'); return; }
  var v = it.eff && it.eff.wound;
  var delta = v - RATE;
  console.log('· ' + it.name + '（' + id + '） buff=' + v + ' 价=' + it.price
    + ' → 相对基础 ' + (delta > 0 ? '+' : '') + (delta * 100).toFixed(0) + '%'
    + (delta <= 0 ? '  ⚠ 无收益/负收益' : ''));
});
process.exit(0);
