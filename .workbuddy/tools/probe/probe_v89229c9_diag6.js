/* v89.229c9c 探针：§15 采集闸 / 募兵卡 / 悬停 / 满级侦查 / 俘虏营明细 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
var out = [];
function P() { out.push(Array.prototype.join.call(arguments, ' ')); }
G.newGame({ name: 'x', cityName: '灰岗' });
if (!G.state.map.grid) G.map.generate();
G.state.world.weather = 'clear';
var st = G.state, c = st.cities[0];

/* ---------- ① 采集闸 ---------- */
P('=== ① 采集闸 ===');
P('  G.loadMul = ' + G.loadMul + '（未定义即闸死）· DATA.GATHER.loadMul=' + DATA.GATHER.loadMul);
(function () {
  var wl = null;
  for (var y = c.y - 40; y <= c.y + 40 && !wl; y++) {
    for (var x = c.x - 40; x <= c.x + 40 && !wl; x++) {
      var t = G.map.tile(x, y);
      if (t && t.terrain === 'lake') wl = { x: x, y: y };
    }
  }
  if (!wl) { P('  未找到湖泊'); return; }
  st.wilds = [{ x: wl.x, y: wl.y, type: 'lake', level: 8, levelDay: G.questDayIndex() }];
  c.army = { buxingji: 2000, banche: 1000 };
  var gen = st.generals[0];
  gen.status = 'idle';
  var w = G.map.wildAt(wl.x, wl.y);
  w.garrison = { troops: { buxingji: 1000 }, cityId: c.id, genId: gen.id };
  gen.status = 'garrison';
  var r = G.startGather(wl.x, wl.y, { buxingji: 1000 });
  P('  startGather=' + r.ok + ' ' + (r.msg || ''));
  var g = G.gatherAt(wl.x, wl.y);
  P('  gather 记录 keys=' + Object.keys(g || {}).join(','));
  P('  g.troops=' + g.troops + ' g.army=' + JSON.stringify(g.army) + ' origin=' + g.origin);
  P('  gatherPowerOf=' + G.gatherPowerOf(g) + '（Σcount×gather 应为 ' + (1000 * DATA.TROOPS.buxingji.gather) + '）');
  P('  gatherLoadOf=' + G.gatherLoadOf(g) + ' → ×loadMul = ' + (G.gatherLoadOf(g) * DATA.GATHER.loadMul));
  P('  fortAuraAt=' + JSON.stringify(G.fortAuraAt ? G.fortAuraAt(wl.x, wl.y) : null));
  g.elapsed = 8 * 3600;
  var y8 = G.gatherYield(g);
  P('  gatherYield=' + JSON.stringify(y8));
})();

/* ---------- ② 募兵面板 ---------- */
P('');
P('=== ② 募兵面板 ===');
(function () {
  c.cells.forEach(function (x) { if (x.build && x.build.id === 'minfang') x.build.lvl = Math.max(5, x.build.lvl || 1); });
  var has = 0;
  c.cells.forEach(function (x) { if (x.build && x.build.id === 'junying') has++; });
  if (!has) {
    for (var k = 0; k < c.cells.length; k++) {
      if (!c.official && !c.cells[k].build) { G.buildAt(c.id, k, 'junying'); break; }
    }
    var guard = 0;
    while (st.queues.build.length && guard++ < 10) {
      var q = st.queues.build[0]; q.elapsed = q.totalTime; G.applyBuildDone(q);
      var ix = st.queues.build.indexOf(q); if (ix >= 0) st.queues.build.splice(ix, 1);
    }
  }
  var bk = G.ui._trainTab, bkS = G.ui._trainSel;
  G.ui._trainTab = 'g1';
  var h = G.ui.troopsHTML();
  P('  _trainSel=' + G.ui._trainSel + '（g1 组内第一项应被选中）');
  P('  class="troop-card 计数=' + (h.match(/class="troop-card/g) || []).length
    + ' data-troop 计数=' + (h.match(/data-troop="/g) || []).length
    + ' select-train 计数=' + (h.match(/data-action="select-train"/g) || []).length);
  var ids1 = Object.keys(DATA.TROOPS).filter(function (id) { return DATA.TROOPS[id].grp === 1; });
  P('  grp1 表项=' + ids1.join(',') + ' canTrain=' + ids1.map(function (id) { return id + ':' + G.canTrain(id).ok; }).join(' '));
  P('  tip 命中=' + !!h.match(/<div class="tcard-tip tip-src">([\s\S]*?)<\/div><\/div>/));
  var tip = (h.match(/<div class="tcard-tip tip-src">([\s\S]*?)<\/div><\/div>/) || ['', ''])[1];
  P('  tip 片段=' + JSON.stringify(tip.slice(0, 260)));
  G.ui._trainTab = bk; G.ui._trainSel = bkS;
})();

/* ---------- ③ 满级侦查 ---------- */
P('');
P('=== ③ 满级侦查 ===');
(function () {
  var w0 = st.world.weather, t0 = G.systems.techLevel('zhencha');
  st.world.weather = 'clear';
  G.techSet('zhencha', 10);
  var tgt = { kind: 'wild', x: 10, y: 10, terrain: 'lake', lv: 5,
    garrison: { buxingji: 100, dunwei: 40 }, guard: null };
  var sc = G.battle.scoutTarget(tgt, st.generals[0]);
  st.world.weather = w0; G.techSet('zhencha', t0);
  P('  totalExact=' + sc.totalExact + ' gNum=' + sc.gNum);
  P('  roster=' + JSON.stringify((sc.roster || []).map(function (x) { return x.name + ':' + x.n; })));
  P('  spoils.jewels=' + JSON.stringify(sc.spoils && sc.spoils.jewels)
    + ' types=' + (sc.spoils && sc.spoils.types && sc.spoils.types.length)
    + ' materials=' + (sc.spoils && sc.spoils.materials && sc.spoils.materials.length));
})();

/* ---------- ④ 俘虏营明细 ---------- */
P('');
P('=== ④ 俘虏营明细 ===');
(function () {
  var st2 = G.newGame({ name: '俘', cityName: '灰岗' });
  var bak = G.state; G.state = st2;
  try {
    st2.captives = { buxingji: 40, dunwei: 12 };
    st2.wounded = 10; st2.woundedArmy = { buxingji: 10 };
    var hC = G.ui.campCard('captive');
    var hW = G.ui.campCard('wounded');
    P('  captive: 不限量=' + (hC.indexOf('不限量') >= 0) + ' img=' + (hC.indexOf('<img') >= 0)
      + ' 步行机=' + (hC.indexOf('步行机') >= 0));
    P('  wounded: img=' + (hW.indexOf('<img') >= 0));
    P('  hC 片段=' + JSON.stringify(hC.slice(0, 300)));
  } finally { G.state = bak; }
})();

/* ---------- ⑤ 搬运计划三态 ---------- */
P('');
P('=== ⑤ 搬运计划三态 ===');
(function () {
  var loot = { grain: 1000, wood: 500 };
  var Dv = G.battle.haulPlanOf({ army: { buxingji: 100 }, result: { atkRemain: 100 },
    cargo: { grain: 4000 }, loot: loot });
  P('  cargoCapOf(100 步行机)=' + G.cargoCapOf({ buxingji: 100 }));
  P('  Dv=' + JSON.stringify(Dv));
  P('  A=' + JSON.stringify(G.battle.haulPlanOf({ army: { buxingji: 10000 }, result: { atkRemain: 10000 }, loot: loot })));
  P('  B=' + JSON.stringify(G.battle.haulPlanOf({ army: { zhencha: 10 }, result: { atkRemain: 10 }, loot: loot })));
})();

fs.writeFileSync(R + '.workbuddy/tmp/p229c9_probe.txt', out.join('\n'), 'utf8');
console.log('DONE9');
process.exit(0);
