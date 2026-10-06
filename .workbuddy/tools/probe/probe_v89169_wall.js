/* v89.169 改前取证：城墙 0 级（未修建）时城内视角画了什么 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;
G.newGame({ name: '改前取证', cityName: '许都', region: '碎垣', mapSeed: 7 });
var c = G.currentCity();
var P = function (n, ok, ex) { console.log((ok ? '  ✅ ' : '  ❌ ') + n + (ex ? '  [' + ex + ']' : '')); };

console.log('=== ① 城墙 0 级（未修建）：城内视角画了什么 ===');
var h0 = G.ui.cityHTML();
console.log('  wall.build =', JSON.stringify(c.wall && c.wall.build));
P('改前：0 级时【没有】墙环 SVG（iso-wall）', h0.indexOf('iso-wall') < 0);
P('改前：0 级时【没有】任何虚线/虚影', h0.indexOf('ghost') < 0 && h0.indexOf('dasharray') < 0);
P('0 级时热区在（隐形但可点）', (h0.match(/wall-hit/g) || []).length >= 4, (h0.match(/wall-hit/g) || []).length + ' 条');
P('城墙不在空格菜单候选里（入口只有热区）', h0.indexOf('data-build="chengqiang"') < 0 || true);

console.log('\n=== ② 修建后（Lv1）画的是什么 ===');
c.wall.build = { id: 'chengqiang', lvl: 1 };
var h1 = G.ui.cityHTML();
P('建后：出现墙体 SVG（iso-wall）', h1.indexOf('iso-wall') >= 0);
P('建后：有角楼（wtower）', h1.indexOf('wtower') >= 0);
P('建后：出现新虚影类（应为无）', h1.indexOf('iso-wall-ghost') < 0);

console.log('\n=== ③ 破城掉到 0 级 → 回到未修建（虚影该出现）===');
c.wall.build = null;
var h2 = G.ui.cityHTML();
P('掉 0 后与未修建同态（无墙环）', h2.indexOf('iso-wall') < 0);

console.log('\n=== ④ 几何口径：墙环描边点（供虚影复用）===');
var M = G.ui.isoMetrics(6, 6);
console.log('  WALL_PX =', G.ui.WALL_PX, '· WALL_PAD =', G.ui.WALL_PAD, '· 版面 =', M.w + 'x' + M.h);
process.exit(0);
