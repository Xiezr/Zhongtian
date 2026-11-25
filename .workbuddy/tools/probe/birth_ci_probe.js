/* 出生格定位对照：city.ci vs ciOfXY(city.x,city.y)，在 G.sphere / sphereOf 两颗球上 */
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
  [20260921, 20261125].forEach(function (sd) {
    var st = G.newGame({ name: 'x', cityName: 'y', mapSeed: sd });
    var c = st.cities[0];
    var spA = G.sphere, spB = G.sphereOf(G.curPid());
    function t(sp, ci) { return (sp && sp.cells && sp.cells[ci]) ? sp.cells[ci].type : '(无)'; }
    var ciXY = spB.ciOfXY ? spB.ciOfXY(c.x, c.y) : -1;
    console.log('seed ' + sd + ' 城(' + c.x + ',' + c.y + ') ci字段=' + c.ci);
    console.log('  G.sphere    同球? ' + (spA === spB) + '  cells[' + c.ci + ']=' + t(spA, c.ci)
      + '  ciOfXY=' + ciXY + '→' + t(spA, ciXY));
    console.log('  sphereOf(1) cells[' + c.ci + ']=' + t(spB, c.ci) + '  ciOfXY=' + ciXY + '→' + t(spB, ciXY));
    console.log('  x/y 合法? ' + (c.x >= 0 && c.y >= 0) + '  MAP_W/H=' + G.DATA.MAP_W + '/' + G.DATA.MAP_H);
  });
})();
