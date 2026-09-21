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
var seen = {};
for (var i = 0; i < 8; i++) {
  var st = G.newGame({ name: 'w' + i, cityName: '许都' });
  var w = (st.world && st.world.weather) || '(none)';
  seen[w] = (seen[w] || 0) + 1;
  console.log('run' + i + ' weather =', w);
}
console.log('分布:', JSON.stringify(seen));
