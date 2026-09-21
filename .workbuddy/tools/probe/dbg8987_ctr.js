/* debug: 反击场景日志 */
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

var env = G.tactic.begin({ yibing: 20 }, null, { yibing: 20 }, 0, null,
  { sieging: false, kind: 'wild', defName: '探针野地' });
env.runAll();
var r = env.finish();
console.log('winner', r.winner, 'rounds', r.rounds);
console.log('log:');
(r.log || []).slice(0, 8).forEach(function (l) { console.log('  ' + l); });
var kinds = {};
(r.roundsLog || []).forEach(function (rr) {
  (rr.events || []).forEach(function (e) { kinds[e.kind + ':' + (e.side || '')] = (kinds[e.kind + ':' + (e.side || '')] || 0) + 1; });
});
console.log('event kinds:', JSON.stringify(kinds));
var last = r.roundsLog[r.roundsLog.length - 1];
console.log('last round events:');
(last.events || []).forEach(function (e) {
  console.log('  ', e.kind, e.side, e.name, '→', e.target || '', 'kill=' + (e.kill || 0), 'gap=' + (e.gap || ''), 'hits=' + JSON.stringify(e.hits || []));
});
