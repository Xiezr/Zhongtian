var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;
G.newGame({ name: 'x', region: '烬环' });
var ARMY = { yibing: 800, changqiang: 800, gongjian: 700, qingji: 300, toudan: 30 };
var env = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(ARMY)), 0, null, { stances: {} });
console.log('field =', env.field);
console.log('初始 atk：');
env.units.atk.forEach(function (u) { console.log('  ' + u.id + ' stance=' + u.stance + ' adv=' + u.adv + ' range=' + u.range + ' spd=' + u.spd + ' count=' + u.count); });
console.log('初始 def：');
env.units.def.forEach(function (u) { console.log('  ' + u.id + ' stance=' + u.stance + ' adv=' + u.adv); });
env.setCmd('atk', 'gongjian', { s: 'hold' });
console.log('setCmd 后 gongjian stance =', env.units.atk.filter(function (u) { return u.id === 'gongjian'; })[0].stance);
var st = env.step();
console.log('step1 后 gongjian stance =', env.units.atk.filter(function (u) { return u.id === 'gongjian'; })[0].stance,
  ' adv=', env.units.atk.filter(function (u) { return u.id === 'gongjian'; })[0].adv);
console.log('step1 events 数 =', (st.events || []).length, ' events 种类 =', JSON.stringify((st.events || []).slice(0, 6).map(function (e) { return e.kind + ':' + (e.name || e.id || ''); })));
process.exit(0);
