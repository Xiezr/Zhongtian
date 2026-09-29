/* v89.180 探针 F：虎豹骑"稍微加强"候选标定（老板 2）
   候选 = hp/def 小步档位；对局 = 同人口（4000）双向矩阵；选取标准：
   「vs 轻骑从对称平手打破为小优（不碾压）· vs 铁骑/西凉改善但不反超 · 其余对位不破坏」。 */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(R + '.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(R + 'js/' + f + '.js');
});
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: 'p180f', avatar: '🧔', gender: 'male', region: '豫州' });
try { GAME.state.world.weather = 'clear'; } catch (e) {}

var HB = DATA.TROOPS.hubaoqi;
var BK = { hp: HB.hp, def: HB.def };
function setHB(hp, def) { HB.hp = hp; HB.def = def; }
function restore() { setHB(BK.hp, BK.def); }

function sim(aId, bId, scale) {
  var ta = DATA.TROOPS[aId], tb = DATA.TROOPS[bId];
  var aN = Math.floor(scale / ta.pop), bN = Math.floor(scale / tb.pop);
  var A = {}, B = {}; A[aId] = aN; B[bId] = bN;
  var r = T.simulate(A, null, B, 0, null, {});
  return { aN: aN, bN: bN, win: r.winner, aLoss: r.atkLoss / aN, dLoss: r.defLoss / bN };
}
function pc(x) { return Math.round(x * 100) + '%'; }

var CAND = [
  ['现（4800/250）', 4800, 250],
  ['A hp5400（+12.5%）', 5400, 250],
  ['B hp5200+def270', 5200, 270],
  ['C def300（+20%）', 4800, 300],
  ['D hp5400+def280', 5400, 280],
  ['E hp6000（+25%）', 6000, 250],
  ['F hp6000+def300（上限参考）', 6000, 300],
];

console.log('=== 虎豹候选扫描（同人口 4000 · 守卫标准见文件头）===');
console.log('候选'.padEnd(24) + 'vs轻骑(虎先手损/轻先手损)   vs铁骑(铁损)  vs西凉(西损)  vs突骑(虎损)  vs长枪(虎损)');
CAND.forEach(function (c) {
  setHB(c[1], c[2]);
  var r1 = sim('hubaoqi', 'qingji', 4000);    /* 虎豹先手 */
  var r2 = sim('qingji', 'hubaoqi', 4000);    /* 轻骑先手 */
  var r3 = sim('tieji', 'hubaoqi', 4000);     /* 铁骑先手 → 报铁骑损 */
  var r4 = sim('xiliangtieqi', 'hubaoqi', 4000);
  var r5 = sim('hubaoqi', 'tuqibing', 4000);
  var r6 = sim('hubaoqi', 'changqiang', 4000);
  /* 口径：r1 虎豹先手（虎豹胜 · 报虎豹损）→ 越低越强；r2 轻骑先手（轻骑胜 · 报轻骑损）→ 越高说明虎豹越强 */
  console.log(c[0].padEnd(24)
    + (pc(r1.aLoss) + ' / ' + pc(r2.aLoss) + (r2.win === 'def' ? '（虎已能反杀）' : '')).padEnd(26)
    + pc(r3.aLoss).padEnd(12) + pc(r4.aLoss).padEnd(12)
    + pc(r5.aLoss).padEnd(12) + pc(r6.aLoss).padEnd(12));
});
restore();

console.log('');
console.log('=== 每万人口总攻/防/血（现状 → 候选示例）===');
[[4800, 250, '现'], [5400, 250, 'A'], [5400, 280, 'D']].forEach(function (c) {
  var n = Math.floor(10000 / 3);
  console.log('  ' + c[2].padEnd(4) + ' hp' + c[0] + '/def' + c[1] + ' → 总攻 ' + (n * 510 / 10000).toFixed(1) + '万'
    + ' · 总防 ' + (n * c[1] / 10000).toFixed(1) + '万 · 总血 ' + (n * c[0] / 10000).toFixed(1) + '万');
});
console.log('');
console.log('判定读法：vs轻骑 = 虎先手损/轻骑先手损（对称平手时两个数相同 ~67%）——');
console.log('  虎豹变强 → 左数下降、右数上升；「小优」目标 ≈ 左 60~64% · 右 70~74%。');
process.exit(0);
