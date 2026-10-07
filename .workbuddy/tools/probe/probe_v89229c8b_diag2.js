/* v89.229c8b 诊断探针：据点战 defLoss=0 / 俘虏 0 的真因 + 观战挂起会话缺失 */
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

/* ---------- 据点战：逐级看守军与 defLoss / 俘虏 ---------- */
P('=== 据点战逐级 ===');
var forts = [];
for (var ry = 0; ry < 121; ry++) {
  for (var rx = 0; rx < 121; rx++) {
    var fh = G.map.fortAt(c.x - 60 + rx, c.y - 60 + ry);
    if (fh) forts.push({ f: fh, lv: fh.level });
  }
}
P('附近据点数=' + forts.length + ' 等级=' + forts.map(function (x) { return x.lv; }).join(','));
forts.slice(0, 6).forEach(function (x) {
  var d = G.wildDefenseAt(x.f.x, x.f.y, x.lv);
  P('  Lv' + x.lv + ' 守军 total=' + d.total + ' ' + JSON.stringify(d.army));
});

function tryFort(lv) {
  var pick = null;
  for (var i = 0; i < forts.length; i++) if (forts[i].lv === lv) { pick = forts[i].f; break; }
  if (!pick) { P('  Lv' + lv + ' 无据点在附近'); return; }
  var g = G.makeGeneral('诊断' + lv, 60, 'idle', c.id, false);
  g.stamina = 300; g.energy = 100; g.tong = 500; g.yw = 400; g.zm = 400;
  st.generals.push(g);
  st.settings.battleWatch = false;
  if (G.siegeScopeOf({ kind: 'fort', x: pick.x, y: pick.y })) G.siegeClear({ kind: 'fort', x: pick.x, y: pick.y });
  var keepArmy = JSON.parse(JSON.stringify(c.army || {}));
  c.army = { daodanche: 40000 };
  st.captives = {};
  var res = G.battle.expedition({ kind: 'fort', x: pick.x, y: pick.y }, 'occupy', { daodanche: 40000 }, g.id);
  var rr = res && res.result;
  P('  Lv' + lv + ' ok=' + (res && res.ok) + ' winner=' + (rr && rr.winner)
    + ' defLoss=' + (rr && rr.defLoss) + ' defRemain=' + (rr && rr.defRemain)
    + ' atkLoss=' + (rr && rr.atkLoss));
  P('       result keys=' + (rr ? Object.keys(rr).join(',') : '-'));
  P('       defLossBy=' + JSON.stringify(rr && rr.defLossBy) + ' captives=' + JSON.stringify(rr && rr.captives));
  P('       msg=' + (res && res.msg));
  c.army = keepArmy;
  st.generals.pop();
}

tryFort(1);
tryFort(2);
tryFort(3);
tryFort(4);

/* ---------- 观战挂起：会话/状态字段 ---------- */
P('');
P('=== 观战挂起 rec 字段 ===');
(function () {
  var fB = null;
  for (var i = 0; i < forts.length && !fB; i++) if (forts[i].lv >= 8) fB = forts[i].f;
  if (!fB) { P('  无 Lv8+ 据点'); return; }
  var g = G.makeGeneral('挂起', 60, 'idle', c.id, false);
  g.stamina = 300; g.energy = 100; g.tong = 400; g.yw = 300; g.zm = 300;
  st.generals.push(g);
  st.marches = []; st.battles = [];
  var keepArmy = JSON.parse(JSON.stringify(c.army || {}));
  c.army = { daodanche: 12000 };
  st.settings.battleWatch = true;
  var dB = G.march.dispatch({ kind: 'fort', x: fB.x, y: fB.y }, 'occupy', { daodanche: 12000 }, g.id);
  P('  dispatch=' + (dB.ok ? 'ok' : dB.msg));
  var m = st.marches[0];
  m.elapsed = m.totalTime;
  G.march.tick();
  var rec = (st.battles || [])[0];
  P('  battles=' + (st.battles || []).length);
  if (rec) {
    P('  rec keys=' + Object.keys(rec).join(','));
    P('  rec.state=' + rec.state + ' rec.id=' + rec.id + ' rec.kind=' + rec.kind);
    P('  _bsess keys=' + Object.keys(G._bsess || {}).join(','));
    P('  stepBattle → ' + JSON.stringify(G.battle.stepBattle(rec.id)));
  }
  P('  settings.battleWatch=' + st.settings.battleWatch);
  c.army = keepArmy;
})();

/* ---------- 回放帧：同兵种反击文本 ---------- */
P('');
P('=== 同兵种帧文本 ===');
(function () {
  var r = G.tactic.simulate({ buxingji: 4000 }, null, { buxingji: 6000 }, 0, null, { kind: 'wild' });
  var rf = G.battle.replayFramesOf(r);
  (rf && rf.frames || []).forEach(function (f, i) { P('  帧' + i + ': ' + (f.ev || '')); });
})();

fs.writeFileSync(R + '.workbuddy/tmp/p229c8_probe2.txt', out.join('\n'), 'utf8');
console.log('DONE2');
process.exit(0);
