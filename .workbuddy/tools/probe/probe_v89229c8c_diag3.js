/* v89.229c8c 诊断探针：据点战为何 defLoss=0 / 是否空守军；智能战斗开关存在性 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
var out = [];
function P() { out.push(Array.prototype.join.call(arguments, ' ')); }

G.newGame({ name: '诊断', cityName: '灰岗' });
if (!G.state.map.grid) G.map.generate();
G.state.world.weather = 'clear';
var st = G.state, c = st.cities[0];

P('smartOnOf=' + (typeof G.battle.smartOnOf) + ' setSmartBattle=' + (typeof G.setSmartBattle)
  + ' 当前=' + (G.battle.smartOnOf ? G.battle.smartOnOf() : '?'));
P('SMART_PLAN.retreatAt=' + (DATA.SMART_PLAN || {}).retreatAt);
P('SIEGE=' + JSON.stringify(DATA.SIEGE));

/* 找三个 Lv≤3 据点，逐个打印战前守军与战后明细 */
var picks = [];
for (var ry = 0; ry < 121; ry++) {
  for (var rx = 0; rx < 121; rx++) {
    var fh = G.map.fortAt(c.x - 60 + rx, c.y - 60 + ry);
    if (fh && fh.level <= 3 && picks.length < 3) picks.push(fh);
  }
}
picks.forEach(function (f, i) {
  var d = G.wildDefenseAt(f.x, f.y, f.level);
  P('');
  P('--- #' + i + ' ' + f.name + ' Lv' + f.level + ' (' + f.x + ',' + f.y + ') 战前守军 total=' + d.total
    + ' ' + JSON.stringify(d.army) + ' gen=' + (d.gen ? d.gen.name + ' Lv' + d.gen.level : 'null'));
  var g = G.makeGeneral('诊断', 60, 'idle', c.id, false);
  g.stamina = 300; g.energy = 100; g.tong = 500; g.yw = 400; g.zm = 400;
  st.generals.push(g);
  st.settings.battleWatch = false;
  if (G.siegeScopeOf({ kind: 'fort', x: f.x, y: f.y })) G.siegeClear({ kind: 'fort', x: f.x, y: f.y });
  var keepArmy = JSON.parse(JSON.stringify(c.army || {}));
  c.army = { daodanche: 40000 };
  st.captives = {};
  var res = G.battle.expedition({ kind: 'fort', x: f.x, y: f.y }, 'occupy', { daodanche: 40000 }, g.id);
  var rr = res && res.result;
  P('   ok=' + (res && res.ok) + ' winner=' + (rr && rr.winner) + ' rounds=' + (rr && rr.rounds));
  P('   defStartBy=' + JSON.stringify(rr && rr.defStartBy) + ' defLossBy=' + JSON.stringify(rr && rr.defLossBy));
  P('   atkStartBy=' + JSON.stringify(rr && rr.atkStartBy) + ' atkLossBy=' + JSON.stringify(rr && rr.atkLossBy));
  P('   siege=' + JSON.stringify(rr && rr.siege));
  P('   defValue=' + (rr && rr.defValue) + ' unitsInit.def=' + JSON.stringify(rr && rr.unitsInit && rr.unitsInit.def));
  P('   msg=' + (res && res.msg));
  c.army = keepArmy;
  st.generals.pop();
});

/* 野地战作对照：同兵种攻野地是否产俘获 */
P('');
P('--- 野地战对照（kind=wild）---');
(function () {
  var w = null;
  for (var i = 0; i < st.wilds.length; i++) if (st.wilds[i].type !== 'plain') { w = st.wilds[i]; break; }
  if (!w) { P('  无野地'); return; }
  var g = G.makeGeneral('诊断野', 60, 'idle', c.id, false);
  g.stamina = 300; g.energy = 100; g.tong = 500; g.yw = 400; g.zm = 400;
  st.generals.push(g);
  var keepArmy = JSON.parse(JSON.stringify(c.army || {}));
  c.army = { daodanche: 40000 };
  st.captives = {};
  var res = G.battle.expedition({ kind: 'wild', x: w.x, y: w.y }, 'raid', { daodanche: 40000 }, g.id);
  var rr = res && res.result;
  P('   野地 (' + w.x + ',' + w.y + ') Lv' + w.level + ' type=' + w.type);
  P('   ok=' + (res && res.ok) + ' winner=' + (rr && rr.winner) + ' defLoss=' + (rr && rr.defLoss));
  P('   defLossBy=' + JSON.stringify(rr && rr.defLossBy) + ' captives=' + JSON.stringify(rr && rr.captives));
  P('   defStartBy=' + JSON.stringify(rr && rr.defStartBy));
  c.army = keepArmy;
  st.generals.pop();
})();

fs.writeFileSync(R + '.workbuddy/tmp/p229c8_probe3.txt', out.join('\n'), 'utf8');
console.log('DONE3');
process.exit(0);
