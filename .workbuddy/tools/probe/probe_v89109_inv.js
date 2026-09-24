'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
  'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils;
var st = G.newGame({ name: '量', cityName: '许都', mapSeed: 20260923 });
if (!st.map.grid) G.map.generate();
G.state = st;
var c = st.cities[0];
G.schemeDefConsume(c, 'jianbi');
var cellsSnap = JSON.stringify(c.cells || {}), wallSnap = c.wallLv;
function refill() {
  c.cells = JSON.parse(cellsSnap);
  c.wallLv = wallSnap;
  c.res = c.res || {};
  ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c.res[k] = 100000; });
  c.army = {};
}
refill();
var d1 = G.invasionResolve(c, '流寇');
refill();
G.schemeDefSet(c, 'jianbi', null);
var d2 = G.invasionResolve(c, '流寇');
console.log('d1: held=' + d1.held + ' lootOk=' + d1.lootOk + ' resLost=' + JSON.stringify(d1.resLost)
  + ' troopsLost=' + d1.troopsLost + ' battle=' + JSON.stringify(d1.battle));
console.log('d2: held=' + d2.held + ' lootOk=' + d2.lootOk + ' resLost=' + JSON.stringify(d2.resLost)
  + ' troopsLost=' + d2.troopsLost + ' battle=' + JSON.stringify(d2.battle));
var g1 = (d1.resLost || {}).grain || 0, g2 = (d2.resLost || {}).grain || 0;
console.log('g1=' + g1 + ' g2=' + g2 + ' ratio=' + (g2 / (g1 || 1)).toFixed(3));
process.exit(0);
