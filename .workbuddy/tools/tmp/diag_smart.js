var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: 'd', region: '司隶' });
var A = { yibing: 300, gongjian: 300, qingji: 200 };
var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(A)), 0, null, { stances: {} });
console.log('field =', env.field);
var rec = { side: 'atk', cmd: {} };
var n = G.battle.smartApply(rec, env);
console.log('改了', n, '个 · rec.cmd =', JSON.stringify(rec.cmd));
env.units.atk.forEach(function (u) { console.log('  atk', u.id, 'stance=' + u.stance, 'target=' + JSON.stringify(u.target));
});
env.units.def.forEach(function (u) { console.log('  def', u.id, 'stance=' + u.stance, 'target=' + JSON.stringify(u.target));
});
console.log('--- 结构断言诊断 ---');
var P = DATA.SMART_PLAN || {};
var miss = [];
Object.keys(DATA.TROOPS).forEach(function (k) {
  if (DATA.TROOPS[k].cat === 'cav' && !P.targets[k]) miss.push(k + '(' + DATA.TROOPS[k].name + ')');
});
console.log('cav 缺目标 =', miss.join(',') || '无');
console.log('gtInf=', P.gapInf, 'gtCav=', P.gapCav, 'qiang->', P.targets.changqiang, 'gong->', P.targets.gongjian);
process.exit(0);
