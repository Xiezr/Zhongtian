/* debug: 驻军走行军的失败点 */
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
var c = st.cities[0];
var gen = st.generals[0];
gen.status = 'idle'; gen.cityId = c.id;

var wt = null;
for (var dy = 5; dy <= 9 && !wt; dy++) for (var dx = 5; dx <= 9 && !wt; dx++) {
  var tl = G.map.tile(c.x + dx, c.y + dy);
  if (tl && tl.terrain !== 'city' && !G.map.wildAt(c.x + dx, c.y + dy)) wt = { x: c.x + dx, y: c.y + dy, t: tl.terrain };
}
console.log('wt =', JSON.stringify(wt));
st.wilds = st.wilds || [];
st.wilds.push({ x: wt.x, y: wt.y, type: wt.t, level: 5, day: 0, startDay: 0 });
c.army = { yibing: 1000 };
st.marches = [];

console.log('genCityOf(gen) =', G.genCityOf(gen), ' c.id =', c.id);
var r = G.doWildGarrison(wt.x, wt.y, { yibing: 400 }, c.id, gen.id);
console.log('doWildGarrison →', JSON.stringify(r));
console.log('after: army =', JSON.stringify(c.army), 'marches =', st.marches.length, 'gen.status =', gen.status);
if (st.marches.length) {
  var m = st.marches[0];
  console.log('march:', JSON.stringify({ mode: m.modeId, name: m.name, total: m.totalTime, army: m.army }));
  m.elapsed = m.totalTime;
  G.march.tick();
  console.log('after tick: marches =', st.marches.length, 'garrison =', JSON.stringify(G.map.wildAt(wt.x, wt.y).garrison));
}
console.log('recent logs:', st.log.slice(-4).map(function (x) { return x.msg || x; }).join(' | '));
