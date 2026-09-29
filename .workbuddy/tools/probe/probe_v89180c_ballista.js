/* v89.180 探针 C：床弩 vs 器械族 现状矩阵（拆械特性补丁前的基线）
   同人口口径；后续用同一脚本扫 vsMech 倍率定值。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;

G.newGame({ name: 'p180c', avatar: '🧔', gender: 'male', region: '豫州' });
try { GAME.state.world.weather = 'clear'; } catch (e) {}

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function sim(aId, bId, scale) {
  var ta = DATA.TROOPS[aId], tb = DATA.TROOPS[bId];
  var aN = Math.floor(scale / ta.pop), bN = Math.floor(scale / tb.pop);
  var A = {}, B = {}; A[aId] = aN; B[bId] = bN;
  var r = T.simulate(A, null, B, 0, null, {});
  return { aN: aN, bN: bN, win: r.winner, rounds: r.rounds, aLoss: r.atkLoss / aN, dLoss: r.defLoss / bN };
}
function line(tag, r) {
  console.log('  ' + tag.padEnd(30) + (r.aN + ' vs ' + r.bN).padEnd(14)
    + ' → ' + (r.win === 'atk' ? '弩胜' : '弩败') + ' ' + r.rounds + '回合'
    + ' 弩损' + pct(r.aLoss) + ' 敌损' + pct(r.dLoss));
}

console.log('当前 vsMech 配置: ' + JSON.stringify(DATA.TROOPS.chuangnu.vsMech == null ? '（未实现）' : DATA.TROOPS.chuangnu.vsMech));
console.log('');
console.log('=== 床弩（pop3）同人口对局（4000 人口 = 弩 1333）===');
[['chuangnu', 'chongche'], ['chongche', 'chuangnu'],
 ['chuangnu', 'toudan'], ['toudan', 'chuangnu'],
 ['chuangnu', 'zhouche'], ['zhouche', 'chuangnu'],
 ['chuangnu', 'changqiang'], ['chuangnu', 'gongjian']].forEach(function (p) {
  var r = sim(p[0], p[1], 4000);
  line(DATA.TROOPS[p[0]].name + ' vs ' + DATA.TROOPS[p[1]].name, r);
});
console.log('');
console.log('=== 倍率扫描（同人口 4000：弩1333 vs 冲800 / 投1000）===');
if (DATA.TROOPS.chuangnu.vsMech != null) {
  [1.25, 1.5, 2, 2.5, 3].forEach(function (m) {
    DATA.TROOPS.chuangnu.vsMech = m;
    var r1 = sim('chuangnu', 'chongche', 4000);
    var r2 = sim('chuangnu', 'toudan', 4000);
    var r3 = sim('chuangnu', 'changqiang', 4000);
    console.log('  ×' + String(m).padEnd(5) + ' 打冲车: ' + (r1.win === 'atk' ? '胜' : '负') + ' 弩损' + pct(r1.aLoss) + ' 冲损' + pct(r1.dLoss)
      + ' | 打投石: ' + (r2.win === 'atk' ? '胜' : '负') + ' 弩损' + pct(r2.aLoss) + ' 投损' + pct(r2.dLoss)
      + ' | 打长枪(对照): ' + (r3.win === 'atk' ? '胜' : '负') + ' 弩损' + pct(r3.aLoss));
  });
  DATA.TROOPS.chuangnu.vsMech = 2; /* 还原默认候选 */
}
process.exit(0);
