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
st.world.weather = 'clear';

function fight(atkArmy, defArmy, atkGen, tag) {
  var env = G.tactic.begin(atkArmy, atkGen, defArmy, 0, null,
    { sieging: false, kind: 'wild', defName: 'x' });
  var n = 0;
  while (true) {
    var r = env.step();
    n++;
    if (!r || r.over || n >= 40) break;
  }
  var fin = env.finish();
  var aRem = 0, dRem = 0;
  (fin.atkRemainBy || {}), (fin.defRemainBy || {});
  console.log(tag, '回合=' + n, 'winner=' + fin.winner,
    'atkLoss=' + fin.atkLoss, 'defLoss=' + fin.defLoss);
  return n;
}

function mk(level, opts) {
  var g = G.makeGeneral(opts.name, level, 'idle', st.cities[0].id, false);
  if (opts.buff) { g.tong = opts.tong || 3000; g.yw = opts.yw || 3000; }
  st.generals.push(g);
  return g;
}
var g1 = mk(1, { name: '弱将' });
var g90 = mk(90, { name: '强将', buff: true, tong: 3000, yw: 3000, zm: 3000 });

/* A：Lv0 对称（义兵 N vs 义兵 N） */
[[10, '弱将'], [30, '弱将'], [30, '强将'], [200, '弱将'], [200, '强将']].forEach(function (x) {
  fight({ yibing: x[0] }, { yibing: x[0] }, x[1] === '弱将' ? g1 : g90,
    'A 义兵' + x[0] + 'v' + x[0] + '(' + x[1] + ')');
});
/* B：Lv3 形态对称（yibing/changqiang/gongjian） */
[[100, 40, 25, '弱将'], [100, 40, 25, '强将'], [300, 150, 80, '弱将'], [300, 150, 80, '强将']].forEach(function (x) {
  var A = { yibing: x[0], changqiang: x[1], gongjian: x[2] };
  fight(A, JSON.parse(JSON.stringify(A)), x[3] === '弱将' ? g1 : g90,
    'B 混编' + x[0] + '/' + x[1] + '/' + x[2] + '(' + x[3] + ')');
});
