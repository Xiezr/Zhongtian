/* 开局预置厂诊断 */
(function () {
  'use strict';
  var fs = require('fs'), path = require('path');
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  global.document = {
    createElement: function () { return { style: {}, appendChild: function () { }, setAttribute: function () { }, classList: { add: function () { }, remove: function () { } } }; },
    getElementById: function () { return null; }, querySelector: function () { return null; },
    querySelectorAll: function () { return []; }, addEventListener: function () { }, body: { appendChild: function () { } }
  };
  var src = fs.readFileSync(path.join('E:/Deepseekdb', 'js', 'bundle-core.js'), 'utf8');
  (0, eval)(src);
  var G = GAME;
  var seeds = [20260921, 20261125, 1, 7];
  seeds.forEach(function (sd) {
    var st = G.newGame({ name: 'x', cityName: 'y', mapSeed: sd });
    var c = st.cities[0], SP = G.sphereOf(G.curPid());
    var seen = {}, q = [c.ci], cnt = {};
    seen[c.ci] = 1;
    for (var qi = 0; qi < q.length; qi++) {
      var ci = q[qi], t = (SP.cells[ci] || {}).type;
      cnt[t] = (cnt[t] || 0) + 1;
      var an = SP.adj[ci] || [];
      for (var k = 0; k < an.length; k++) { if (!seen[an[k]]) { seen[an[k]] = 1; q.push(an[k]); } }
      if (q.length > 2500) break;
    }
    var plants = G.extGridOf(c);
    console.log('seed ' + sd + '：城 ci=' + c.ci + ' 地形=' + (SP.cells[c.ci] || {}).type
      + ' · BFS ' + q.length + ' 格 ' + JSON.stringify(cnt));
    console.log('   预置厂 ' + plants.length + ' 座：' + plants.map(function (e) { return e.type + '@' + e.ci; }).join(', '));
    console.log('   产量/时 ' + JSON.stringify(G.prodBasePerHourOf(c)));
  });
})();
