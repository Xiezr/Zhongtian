/* v89.186d：§186⑦ 断言阈值预量 —— 自制守军（确定性，不依赖地图坐标）。*/
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: 'w4', avatar: '🧔', gender: 'male', region: '豫州' });
G.state.world.weather = 'clear';

var dg = G.makeGeneral('验将', 59, 'guard', null, false, 'ying', 'balance');
G.guardFillOf(dg, DATA.GUARD_FOLD);
console.log('守将：Lv' + dg.level + '（' + dg.rank + '）体力 ' + Math.round(G.staNow(dg)) + '/' + Math.round(G.staMax(dg))
  + ' 四维 ' + dg.tong + '/' + dg.yw + '/' + dg.zm + '/' + dg.nz);

var def = { gongjian: 400, daodun: 300 };
function run(tag, mul, buff) {
  var s = G.state, bk = s.buffs;
  try {
    s.buffs = s.buffs || {};
    s.buffs.military = buff ? { wound: buff } : {};
    s.buffs.militaryUntil = Date.now() + 3600000;
    var atk = { gongjian: Math.round(400 * mul), daodun: Math.round(300 * mul) };
    var sent = 700 * mul;
    var r = G.battle.simulate(atk, null, def, 0, dg, { kind: 'wild' });
    var rate = G.woundedRateOf(null);
    var net = (r.atkLoss / sent) * (1 - rate);
    console.log(tag + '：sent=' + sent + ' 阵亡=' + r.atkLoss + '（' + ((r.atkLoss / sent) * 100).toFixed(0) + '%）'
      + ' rate=' + rate.toFixed(3) + ' 净损=' + (net * 100).toFixed(1) + '% 回合=' + r.rounds
      + ' ' + (r.winner === 'atk' ? '我胜' : '守胜'));
  } finally { s.buffs = bk; }
}
console.log('--- 无将我方（null）---');
run('正常 1.5×', 1.5, 0);
run('苦仗 1.0× 无buff', 1.0, 0);
run('苦仗 1.0× +医圣(0.15)', 1.0, 0.15);
console.log('--- 有将我方（英杰 Lv30 满状态）---');
var pg = G.makeGeneral('我将', 30, 'guard', null, false, 'ying', 'balance');
G.guardFillOf(pg, null);
run('正常 1.5× 带将', 1.5, 0);
run('苦仗 1.0× 带将', 1.0, 0);
run('苦仗 1.0× 带将+医圣', 1.0, 0.15);
process.exit(0);
