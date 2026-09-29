/* v89.180 探针 A：虎豹骑「总人口口径」复核（老板：在意"能上场的总人口和总攻防"）
   口径：同总人口（Σ 队数 × pop 相等）下的实战对局 + 每万人口的总攻/总防/总血表。
   全程走真实引擎 T.simulate；天气固定 clear；region 固定。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;

G.newGame({ name: 'p180a', avatar: '🧔', gender: 'male', region: '豫州' });
try { GAME.state.world.weather = 'clear'; } catch (e) {}
console.log('天气=' + (GAME.story && GAME.story.currentWeather ? GAME.story.currentWeather().name : '?'));

function fmt(n) { n = Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function pad(s, n) { s = String(s); while (s.length < n) s += '　'; return s; }
function pct(x) { return (x * 100).toFixed(1) + '%'; }

console.log('');
console.log('=== ① 每万人口总攻/总防/总血（"能上场的总战力"表）===');
var ids = ['changqiang', 'daodun', 'gongjian', 'qingji', 'tieji', 'hubaoqi', 'xiliangtieqi', 'tuqibing', 'chuangnu', 'chongche', 'toudan'];
console.log('兵种        pop  每万人口队数   总攻       总防       总血');
ids.forEach(function (id) {
  var t = DATA.TROOPS[id];
  var n = Math.floor(10000 / t.pop);
  console.log(pad(t.name, 8) + '  ' + t.pop + '　' + pad(String(n), 6) + '　' + pad(fmt(n * t.atk), 10) + '　' + pad(fmt(n * t.def), 10) + '　' + fmt(n * t.hp));
});

function sim(aId, bId, scale) {
  var ta = DATA.TROOPS[aId], tb = DATA.TROOPS[bId];
  var aN = Math.floor(scale / ta.pop), bN = Math.floor(scale / tb.pop);
  var A = {}, B = {}; A[aId] = aN; B[bId] = bN;
  var r = T.simulate(A, null, B, 0, null, {});
  return { aN: aN, bN: bN, win: r.winner, rounds: r.rounds, aLoss: r.atkLoss / aN, dLoss: r.defLoss / bN };
}
function cell(r) {
  return (r.win === 'atk' ? '攻胜' : (r.win === 'def' ? '守胜' : '平')) + ' ' + r.rounds + '回合' + ' 先手损' + pct(r.aLoss) + ' 后手损' + pct(r.dLoss);
}

console.log('');
console.log('=== ② 同人口 4000 对局矩阵（攻方=先手，守方=后手；全为纯纸面数值）===');
var pairs = [
  ['hubaoqi', 'qingji'], ['qingji', 'hubaoqi'],
  ['hubaoqi', 'tieji'], ['tieji', 'hubaoqi'],
  ['hubaoqi', 'xiliangtieqi'], ['xiliangtieqi', 'hubaoqi'],
  ['hubaoqi', 'tuqibing'], ['tuqibing', 'hubaoqi'],
  ['hubaoqi', 'changqiang'], ['hubaoqi', 'gongjian'],
];
pairs.forEach(function (p) {
  var r = sim(p[0], p[1], 4000);
  console.log('  ' + pad(DATA.TROOPS[p[0]].name + '(' + r.aN + ')', 16) + ' vs ' + pad(DATA.TROOPS[p[1]].name + '(' + r.bN + ')', 16) + ' → ' + cell(r));
});

console.log('');
console.log('=== ③ 规模稳定性（同人口 8000 复跑核心两局）===');
[['hubaoqi', 'qingji'], ['qingji', 'hubaoqi']].forEach(function (p) {
  var r = sim(p[0], p[1], 8000);
  console.log('  ' + pad(DATA.TROOPS[p[0]].name + '(' + r.aN + ')', 16) + ' vs ' + pad(DATA.TROOPS[p[1]].name + '(' + r.bN + ')', 16) + ' → ' + cell(r));
});

console.log('');
console.log('=== ④ 虎豹 vs 轻骑：多规模扫描（看趋势）===');
[1500, 2500, 4000, 6000, 8000].forEach(function (s) {
  var r1 = sim('hubaoqi', 'qingji', s), r2 = sim('qingji', 'hubaoqi', s);
  console.log('  人口' + pad(String(s), 6) + ' 虎豹先手→' + cell(r1) + '　|　轻骑先手→' + cell(r2));
});
process.exit(0);
