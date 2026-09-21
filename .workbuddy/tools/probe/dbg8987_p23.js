/* v89.87 调试：复现 P-23 断言，打印各中间值 */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';

/* 复用 smoke 的环境头 */
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));

['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
global.GAME.DATA.DEFAULT_SETTINGS.battleWatch = false;

var G = global.GAME;
var st = G.newGame({ name: 'x', cityName: '许都' });
if (!st.map.grid) G.map.generate();
G.state = st;
var city = st.cities[0];

/* 找 fort level >= 4 */
var fort = null;
for (var yy = city.y - 30; yy <= city.y + 30 && !fort; yy++) {
  for (var xx = city.x - 30; xx <= city.x + 30 && !fort; xx++) {
    var f = G.map.fortAt(xx, yy);
    if (f && f.level >= 4) fort = f;
  }
}
console.log('fort =', fort ? (fort.name + ' Lv' + fort.level + ' @' + fort.x + ',' + fort.y) : 'NOT FOUND');
if (!fort) process.exit(1);

var gen = st.generals[0];
gen.status = 'idle';
G.setStaNow(gen, 1000); gen.energy = 100;
city.army = { changqiang: 200 };
st.marches = [];

G.ui.openExpModal({ kind: 'fort', x: fort.x, y: fort.y });
G.ui._expMode = 'occupy';
console.log('_expRes =', JSON.stringify(G.ui._expRes));
global.document.getElementById('exp-gen').value = gen.id;
global.document.getElementById('exp-changqiang').value = '200';

var pw = G.ui.expPowerOf();
console.log('expPowerOf =', JSON.stringify(pw));
console.log('ratio < 0.5 ?', pw && pw.ratio < 0.5);

G.doExpConfirm();
console.log('首击后: marches =', st.marches.length, ' armed =', G.ui._expForceArmed);
console.log('  marches[0] =', st.marches[0] ? st.marches[0].name : '-');
G.doExpConfirm();
console.log('再击后: marches =', st.marches.length, ' armed =', G.ui._expForceArmed);
console.log('  marches[0] =', st.marches[0] ? st.marches[0].name : '-');
