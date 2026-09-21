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
var st = G.newGame({ name: 'x', cityName: 'x' });
if (!st.map.grid) G.map.generate();
G.state = st;
console.log('SPLASH_PCT', G.tactic.SPLASH_PCT, 'day', G.questDayIndex());
var env1 = G.tactic.begin({ gongjian: 7000 }, null, { yibing: 2, qingji: 60 }, 0, null,
  { sieging: false, kind: 'wild', defName: 'x' });
var r1 = env1.step();
var evs = (r1.events || []);
console.log('round1 events:', evs.length);
evs.forEach(function (e) {
  console.log(' ', e.kind, e.side, e.name, '->', e.target || '', 'kill', e.kill,
    'hits', JSON.stringify((e.hits || []).map(function (h) { return h.id + ':' + h.kill + (h.splash ? '(splash)' : ''); })));
});
console.log('snap def:', JSON.stringify((r1.snap.def || []).map(function (u) { return u.id + ':' + u.count; })));
console.log('snap atk:', JSON.stringify((r1.snap.atk || []).map(function (u) { return u.id + ':' + u.count; })));

console.log('--- 关溅射（SPLASH_PCT=0）---');
var oldp = G.tactic.SPLASH_PCT;
G.tactic.SPLASH_PCT = 0;
var env0 = G.tactic.begin({ gongjian: 7000 }, null, { yibing: 2, qingji: 60 }, 0, null,
  { sieging: false, kind: 'wild', defName: 'x' });
var r0 = env0.step();
G.tactic.SPLASH_PCT = oldp;
var ev0 = (r0.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; })[0];
console.log('ev0 hits:', JSON.stringify((ev0 && ev0.hits || []).map(function (h) { return h.id + ':' + h.kill + (h.splash ? '(s)' : ''); })));
console.log('flip 条件: !ev0 || hits.slice(1).length===0 =>', !ev0 || (ev0.hits || []).slice(1).length === 0);

/* 再跑一遍"第一段"看 okSplash（确认可复现） */
var env1b = G.tactic.begin({ gongjian: 7000 }, null, { yibing: 2, qingji: 60 }, 0, null,
  { sieging: false, kind: 'wild', defName: 'x' });
var r1b = env1b.step();
var ev1b = (r1b.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; })[0];
console.log('okSplash 条件 =>', !!ev1b && ev1b.hits.length >= 2 && !ev1b.hits[0].splash && ev1b.hits[1].splash === true);
