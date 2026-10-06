/* v89.157 探针：消息主题覆盖 + 发射点分类清点（源扫描） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;

G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
var feed = G.msgFeedOf();
console.log('msgFeedOf 条数 = ' + feed.length);
var bySub = {};
feed.forEach(function (r) { var s = G.msgSubOf(r); bySub[s] = (bySub[s] || 0) + 1; });
console.log('开局主题分布: ' + JSON.stringify(bySub));
feed.slice(0, 10).forEach(function (r) { console.log('  [' + G.msgSubOf(r) + '] ' + String(r.msg).slice(0, 70)); });

/* ---- 源扫描：所有 GAME.log( 调用点的 kind/sub 统计 ---- */
var FILES = ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'story', 'ui', 'main'];
var kindCount = {}, subCount = {}, noSub = [];
var re = /GAME\.log\(([^;]*?)\);/g;
FILES.forEach(function (f) {
  var s = fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8');
  var m;
  while ((m = re.exec(s)) !== null) {
    var call = m[1];
    /* 抓字符串字面量 */
    var lits = call.match(/'[^']*'/g) || [];
    var kind = lits[1] || '(none)', sub = lits[2] || '(none)';
    kindCount[kind] = (kindCount[kind] || 0) + 1;
    subCount[sub] = (subCount[sub] || 0) + 1;
    if (sub === '(none)') noSub.push(f + ': ' + call.slice(0, 70).replace(/\s+/g, ' '));
  }
});
console.log('');
console.log('=== 源扫描 GAME.log 统计 ===');
console.log('kind 分布: ' + JSON.stringify(kindCount));
console.log('sub 分布: ' + JSON.stringify(subCount));
console.log('无 sub 的调用点（前 40）：');
noSub.slice(0, 40).forEach(function (x) { console.log('  ' + x); });
console.log('无 sub 总数 = ' + noSub.length);
process.exit(0);
