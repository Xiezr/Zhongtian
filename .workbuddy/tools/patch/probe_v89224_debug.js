/* probe_v89224_debug.js — 复现 §191④(pB) 与 §220③c（借用 smoke 的桩头） */
var fs = require('fs');
var src = fs.readFileSync('smoke-test.js', 'utf8');
var a = src.indexOf('global.window = global;');
var b = src.indexOf('var PASS = 0');
eval(src.slice(a, b));
['js/data.js', 'js/state.js', 'js/questdata.js', 'js/systems.js', 'js/domain.js'].forEach(function (f) { require('E:/Deepseekdb/' + f); });
var G = global.GAME, DATA = G.DATA;

console.log('===== 复现 §191④ pB =====');
(function () {
  G.newGame({ name: 'techgate191b', region: '烬环' });
  var c = G.state.cities[0];
  var placed = 0;
  for (var i = 0; i < c.cells.length && placed < 2; i++) {
    var cl = c.cells[i];
    if (cl && !cl.build && !cl.pending && !cl.official) {
      cl.build = { id: placed === 0 ? 'shuyuan' : 'junying', lvl: placed === 0 ? 3 : 2 }; placed++;
    }
  }
  c.cells.forEach(function (x) { if (x && x.build && x.build.id === 'guanfu') x.build.lvl = 12; });
  var pA = G.buildPrereqOf(c, 'junying', 3);
  G.techSet('lianbing', 1, c);
  var pB = G.buildPrereqOf(c, 'junying', 3);
  console.log('pA.ok', pA.ok, JSON.stringify(pA.list));
  console.log('pB.ok', pB.ok, JSON.stringify(pB.list));
  console.log('minfang lvl =', G.buildingLevel(c, 'minfang'), ' junying =', G.buildingLevel(c, 'junying'));
})();

console.log('===== 复现 §220③c =====');
(function () {
  var st = G.newGame({ name: 'v220oldb', region: '烬环', mapSeed: 20261020 });
  var c = st.cities[0];
  c.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 12; });
  console.log('capOld', G.buildCapOf(c, 'junying', { id: 'junying', lvl: 12 }));
  console.log('capNo', G.buildCapOf(c, 'junying'));
  console.log('capNew', G.buildCapOf(c, 'junying', { id: 'junying', lvl: 12, hiLv: 12 }));
  var a2 = G.buildPrereqOf(c, 'junying', 12, { id: 'junying', lvl: 11 });
  var b2 = G.buildPrereqOf(c, 'junying', 12, { id: 'junying', lvl: 11, hiLv: 12 });
  console.log('preOld', a2.ok, JSON.stringify(a2.list));
  console.log('preNew', b2.ok, JSON.stringify(b2.list));
})();
