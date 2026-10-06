/* 对比：新旧 ui.js 生成的"已修建墙环 SVG"是否逐字节一致 + 新虚影 -->
   用法：node wardiff_v89169.js new|old */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var mode = process.argv[2];
if (mode === 'old') eval(fs.readFileSync(path.join(R, 'backup/v89169/ui.js'), 'utf8'));
else require(path.join(R, 'js', 'ui.js'));
var G = global.GAME;
G.newGame({ name: 'x', cityName: '许都', region: '碎垣', mapSeed: 7 });
var c = G.currentCity();
c.wall.build = { id: 'chengqiang', lvl: 3 };
var h = G.ui.cityHTML();
var i = h.indexOf('<svg class="iso-wall"');
var j = h.indexOf('</svg>', i) + 6;
fs.writeFileSync(R + '.workbuddy/tmp/wall_' + mode + '.html', h.slice(i, j), 'utf8');
console.log(mode + ' 墙环 SVG = ' + (j - i) + ' 字节');
process.exit(0);
