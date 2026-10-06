/* probe_v89179d_smart_mirror.js —— v89.179 全撤后：镜像对局赛马重测
   （§175③b 的期望值需按新口径复测；v89.164 时静态表 9.36 独大） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: '碎垣' });
GAME.state.world.weather = 'clear';

var A = { minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30 };
var rec = { side: 'atk', genId: null, atkArmy: A,
  sim: { scArmy: JSON.parse(JSON.stringify(A)), scVal: 0, scGen: null, simOpts: {} } };
var r = G.battle.smartArbitrate(rec);
console.log('赛马结果：rule=' + r.rule + ' mode=' + r.mode + ' ms=' + r.ms);
console.log('');
console.log('全 20 组合成绩（按返回顺序 = 候选顺序）：');
console.log('  序号 规则      阵型      胜    交换比   我损率   敌损率');
r.scores.forEach(function (s, i) {
  console.log('  ' + String(i).padStart(3) + ' ' + s.rule.padEnd(8) + s.mode.padEnd(10)
    + (s.win ? ' 胜' : ' 败') + ' ' + String(s.ratio.toFixed(2)).padStart(7)
    + ' ' + String((s.aLossPct != null ? s.aLossPct : (s.aLoss / 100)).toFixed(0)).padStart(6)
    + '% ' + String((s.dLossPct != null ? s.dLossPct : 0)).padStart(6) + '%');
});
process.exit(0);
