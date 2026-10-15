/* v89.169 改后验证：城墙 0 级虚影环（可见入口） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, pass = 0, fail = 0;
var P = function (n, ok, ex) { if (ok) pass++; else fail++; console.log((ok ? '  ✅ ' : '  ❌ ') + n + (ex ? '  [' + ex + ']' : '')); };
G.newGame({ name: '改后', cityName: '许都', region: '豫州', mapSeed: 7 });
var c = G.currentCity();

console.log('=== ① 城墙 0 级（未修建）→ 虚线虚影环 ===');
var h0 = G.ui.cityHTML();
var i0 = h0.indexOf('<svg class="iso-wall iso-wall-ghost"');
var g0 = i0 >= 0 ? h0.slice(i0, h0.indexOf('</svg>', i0) + 6) : '';
P('0 级出现虚影环 SVG（iso-wall-ghost）', i0 >= 0);
P('虚影含虚线（stroke-dasharray）', g0.indexOf('stroke-dasharray') >= 0);
P('虚影四角 = 4 个 wghost-corner（待建角楼位）', (g0.match(/wghost-corner/g) || []).length === 4);
P('虚影不含实墙形制（无 wtower / 无 wallBody 渐变）', g0.indexOf('wtower') < 0 && g0.indexOf('wallBody') < 0);
P('0 级热区仍在（4 条 open-wall）', (h0.match(/class="wall-hit /g) || []).length === 4);

console.log('\n=== ② 已修建（Lv3）→ 实墙环、无虚影 ===');
c.wall.build = { id: 'chengqiang', lvl: 3 };
var h3 = G.ui.cityHTML();
P('实墙在（wtower × 4、wallBody 渐变）', h3.indexOf('wtower') >= 0 && h3.indexOf('url(#wallBody)') >= 0);
P('虚影退场（建好就不画虚影）', h3.indexOf('iso-wall-ghost') < 0);

console.log('\n=== ③ 几何同源：虚影与实墙同一条带 ===');
var i3 = h3.indexOf('<svg class="iso-wall" ');
var w3 = i3 >= 0 ? h3.slice(i3, h3.indexOf('</svg>', i3) + 6) : '';
var ptsG = /class="wghost-line" points="([^"]+)"/.exec(g0);
var ptsW = /<polygon points="([^"]+)"/.exec(w3);
P('两者 polygon points 逐字节一致', !!ptsG && !!ptsW && ptsG[1] === ptsW[1],
  ptsG && ptsW ? ('len=' + ptsG[1].length + ' vs ' + ptsW[1].length) : '未取到');

console.log('\n=== ④ 破城掉回 0（build=null）→ 虚影回归 ===');
c.wall.build = { id: 'chengqiang', lvl: 4 };
c.wall.build = null;                       /* 掉到 0 的真实形态：置 null */
var h4 = G.ui.cityHTML();
P('掉 0 后虚影回归（与未修建同态）', h4.indexOf('iso-wall-ghost') >= 0 && h4.indexOf('wtower') < 0);

console.log('\n=== ⑤ 源码：几何唯一出口 + 三态 ===');
var uiS = fs.readFileSync(path.join(R, 'js', 'ui.js'), 'utf8');
P('wallRingGeom 出口在册', /ui\.wallRingGeom = function/.test(uiS));
P('虚影函数在册', /ui\.isoWallGhostSVG = function/.test(uiS));
P('两处 SVG 都读几何出口（≥2 处调用）', (uiS.match(/ui\.wallRingGeom\(cols, rows\)/g) || []).length >= 2,
  (uiS.match(/ui\.wallRingGeom\(cols, rows\)/g) || []).length + ' 处');
P('isoBoard 三态分支在册', /opt\.wall === 'ghost' \? ui\.isoWallGhostSVG/.test(uiS));
var hS = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
P('CSS：虚影描边走主题金（4 条规则）', hS.indexOf('.iso-wall-ghost .wghost-line') >= 0
  && hS.indexOf('.iso-wall-ghost .wghost-base') >= 0 && hS.indexOf('.iso-wall-ghost .wghost-corner') >= 0);
P('CSS：悬停提亮规则在册', /\.iso-board:has\(\.wall-hit:hover\) \.iso-wall-ghost \{ filter: brightness\(1.45\); \}/.test(hS));

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
