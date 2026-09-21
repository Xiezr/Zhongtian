'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME;
var st = G.newGame({ name: 'x', cityName: '许都' });
if (!st.map.grid) G.map.generate();
G.state = st;
var fake = { cells: [{ build: { id: 'minfang', lvl: 12 } }] };
var mp = G.maxPopOf(fake);
console.log('maxPop(Lv12民房) =', mp);
console.log('growth =', G.popGrowthOf(fake));
console.log('系数判定 ok =', G.popGrowthOf(fake) === mp * 0.0005 && mp * 0.0005 > 1);
