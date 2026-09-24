'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
  'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA;
var _st = G.newGame({ name: '探', cityName: '许都', mapSeed: 1 });
if (!_st.map.grid) G.map.generate();

function run(sortie, steps) {
  var ov = {};
  ov['changqiang'] = { s: 'hold', t: '', sortie: sortie };
  var env = G.tactic.begin({ toudan: 200 }, null, { changqiang: 100000 }, 0, null,
    { kind: 'city', sieging: true, defName: '试', wallLv: 10, towers: 8,
      stances: { atk: { toudan: { s: 'advance', t: DATA.TARGET_WALL } }, def: ov } });
  console.log('  units.atk=' + JSON.stringify(env.units.atk.map(function (u) { return { id: u.id, t: u.target, s: u.stance, adv: u.adv, sortie: u.sortie }; })));
  console.log('  units.def=' + JSON.stringify(env.units.def.map(function (u) { return { id: u.id, t: u.target, s: u.stance, adv: u.adv, sortie: u.sortie }; })));
  console.log('  field=' + env.field);
  var out = [];
  for (var i = 0; i < (steps || 1); i++) {
    var st = env.step();
    if (!st) break;
    if (st.r % 3 === 1 || (st.snap.towers && st.snap.towers.left < st.snap.towers.start)) out.push('r' + st.r + ' tower=' + JSON.stringify(env.snap().towers)
      + ' atk=' + st.a + ' def=' + st.d + ' gap=' + st.gap
      + ' er=' + st.snap.atk[0].er
      + ' ev=' + JSON.stringify(st.events.map(function (e) { return e.kind + ':' + (e.name || '') + (e.kill ? '杀' + e.kill : ''); })).slice(0, 130));
  }
  var r = env.finish();
  return { log: out, fin: { towerStart: r.towerStart, towerLeft: r.towerLeft,
    sortieStart: r.defSortieStart, sortieLeft: r.defSortieLeft, rounds: r.rounds,
    atkRemain: r.atkRemain, defRemain: r.defRemain } };
}
console.log('=== sortie=true（应有野战军挡住） ===');
var a = run(true, 20);
a.log.forEach(function (l) { console.log('  ' + l); });
console.log('  fin=' + JSON.stringify(a.fin));
console.log('=== sortie=false（对照，应能拆） ===');
var b = run(false, 20);
b.log.forEach(function (l) { console.log('  ' + l); });
console.log('  fin=' + JSON.stringify(b.fin));
process.exit(0);
