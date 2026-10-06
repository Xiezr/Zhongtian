/* v89.127 探针：① U.fmt 千级新格式（k 退役）② 城墙入城迁移不再静默 */
'use strict';
process.chdir('E:/Deepseekdb');
var fs = require('fs');
eval(fs.readFileSync('.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) { require('E:/Deepseekdb/js/' + f + '.js'); });
var G = global.GAME;
var U = G.utils;

console.log('== ① U.fmt 千级新格式（k 退役）==');
[[999, '999'], [1500, '1,500'], [9999, '9,999'], [20000, '2.0万'],
 [123456789, '1.23亿'], [-1234, '-1,234']].forEach(function (a) {
  var got = U.fmt(a[0]);
  console.log('  fmt(' + a[0] + ') = ' + got + (got === a[1] ? '  ✓' : '  ✗ 期望 ' + a[1]));
});

console.log('');
console.log('== ② 迁移提示（满格老档：wallLv=7，无空地 → 有损覆盖）==');
var st = G.newGame({ name: 'X', cityName: '许都', region: '碎垣', mapSeed: 1 });
var c = st.cities[0];
c.cells.forEach(function (x) {
  if (!x.official && !x.build) x.build = { id: 'minfang', lvl: 1 };
});
c.wallLv = 7;
var st2 = G.adoptState(JSON.parse(JSON.stringify(st)));
var c2 = st2.cities[0];
var w = null;
c2.cells.forEach(function (x, i) { if (x.build && x.build.id === 'chengqiang') w = { i: i, lv: x.build.lvl }; });
console.log('  城墙格：' + JSON.stringify(w) + '（期望 lv=7）');
console.log('  wallLv 已删：' + (c2.wallLv === undefined));
var last = (st2.msgLog || [])[st2.msgLog.length - 1];
console.log('  末条消息：' + (last && last.msg));
console.log('  含"城墙入城"：' + !!(last && last.msg.indexOf('城墙入城') >= 0));
console.log('  含"原为"（有损明示）：' + !!(last && last.msg.indexOf('原为') >= 0) + '（期望 true）');
var logHead = (st2.log || [])[0];
console.log('  侧栏消息流头部同条：' + !!(logHead && logHead.msg && logHead.msg.indexOf('城墙入城') >= 0));

console.log('');
console.log('== ③ 有空地时（无损失 → 仍写一条，但不含"原为"）==');
var st3 = G.newGame({ name: 'Y', cityName: '许都', region: '碎垣', mapSeed: 2 });
var c3 = st3.cities[0];
var emptied = 0;
c3.cells.forEach(function (x) { if (!x.official && x.build && emptied < 2) { delete x.build; emptied++; } });
c3.wallLv = 5;
var st4 = G.adoptState(JSON.parse(JSON.stringify(st3)));
var c4 = st4.cities[0];
var w4 = null;
c4.cells.forEach(function (x, i) { if (x.build && x.build.id === 'chengqiang') w4 = { i: i, lv: x.build.lvl }; });
var last4 = (st4.msgLog || [])[st4.msgLog.length - 1];
console.log('  城墙格：' + JSON.stringify(w4) + '（期望 lv=5）');
console.log('  末条消息：' + (last4 && last4.msg));
console.log('  含"原为"（期望 false）：' + !!(last4 && last4.msg.indexOf('原为') >= 0));

console.log('');
console.log('== ④ repeat：迁移只发生一次（无 wallLv 不写第二条）==');
var st5 = G.adoptState(JSON.parse(JSON.stringify(st2)));
var n5 = (st5.msgLog || []).filter(function (m) { return (m.msg || '').indexOf('城墙入城') >= 0; }).length;
console.log('  含"城墙入城"的消息条数：' + n5 + '（期望 1）');
process.exit(0);
