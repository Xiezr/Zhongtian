/* 出生点视野探针 —— 老板「增大平原占比」后，出生点附近还能否看出地形变化
 * 用法：node .workbuddy/tools/probe/birth_view_probe.js [seed]
 * 默认 seed = 20261016（smoke-test.js §⑥ 用的那个）
 */
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
  try { (0, eval)(src); } catch (e) { console.log('CORE_LOAD_ERR', e.message); process.exit(1); }

  var seed = parseInt(process.argv[2], 10) || 20261016;
  var G = GAME;
  var out = {};
  try {
    var st = G.newGame({ name: '视野验收', cityName: '灰岗', mapSeed: seed });
    var c0 = st.cities[0];
    var SP = G.sphereOf ? G.sphereOf(G.curPid ? G.curPid() : 1) : G.sphere;
    if (!SP || !SP.cells) { console.log('无球面'); process.exit(1); }
    function kinds(r) {
      var seen = {};
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var ci = SP.ciOfXY ? SP.ciOfXY(c0.x + dx, c0.y + dy) : -1;
        var cc = ci >= 0 ? SP.cells[ci] : null;
        if (cc && cc.type) seen[cc.type] = 1;
      }
      return Object.keys(seen);
    }
    out = { seed: seed, city: c0.name, x: c0.x, y: c0.y, r3: kinds(3), r5: kinds(5), r9: kinds(9) };
  } catch (e) {
    console.log('NEWGAME_ERR', e.message);
    process.exit(2);
  }
  console.log('seed ' + out.seed + ' 出生城 ' + out.city + ' (' + out.x + ',' + out.y + ')');
  console.log('  ±3：' + out.r3.length + ' 种 → ' + out.r3.join(','));
  console.log('  ±5：' + out.r5.length + ' 种 → ' + out.r5.join(','));
  console.log('  ±9：' + out.r9.length + ' 种 → ' + out.r9.join(','));
})();
