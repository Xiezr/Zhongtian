/* v89.229c 诊断探针：解析 smoke 55 条红单里"非机械替换"那批的真因。
   铁律：结尾 process.exit(0)。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
var out = [];
function P() { out.push(Array.prototype.join.call(arguments, ' ')); }

G.newGame({ name: '诊断', cityName: '灰岗' });
if (!G.state.map.grid) G.map.generate();

/* ---------- ① 采集负重闸：8 小时收成为什么是 120000 ---------- */
G.state.world.weather = 'clear';
P('=== ① 采集收成 / 负重闸 ===');
P('buxingji  gather=' + DATA.TROOPS.buxingji.gather + ' load=' + DATA.TROOPS.buxingji.load);
P('GATHER.powerCap=' + DATA.GATHER.powerCap + ' levelBonus=' + DATA.GATHER.levelBonus + ' loadMul=' + DATA.GATHER.loadMul);
var g8 = {
  id: 'x', x: 1, y: 1, type: 'lake', level: 8, origin: 'garrison', elapsed: 8 * 3600,
  army: { buxingji: 1000 }
};
var gLoad = G.gatherLoadOf ? G.gatherLoadOf(g8) : 'noFn';
P('gatherLoadOf(g8)=' + gLoad + ' → loadCap=' + Math.round(gLoad * (G.loadMul || 0)));
var raw8 = Math.round(Math.min(1000 * DATA.TROOPS.buxingji.gather, DATA.GATHER.powerCap)
  * (1 + 8 * DATA.GATHER.levelBonus) * 8);
P('未受闸的公式值=' + raw8);
var rawY = G._rawGatherYield(g8);
P('_rawGatherYield=' + JSON.stringify(rawY));

/* ---------- ② §120⑦ 负重顶三态 ---------- */
P('');
P('=== ② §120⑦ 负重顶 ===');
var st = G.state, c = st.cities[0];
var wk = { x: c.x + 23, y: c.y + 23 };
st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === wk.x && z.y === wk.y); });
st.wilds.push({ x: wk.x, y: wk.y, type: 'forest', level: 10, day: 0, startDay: 0 });
var gen = st.generals[0];
var w = G.map.wildAt(wk.x, wk.y);
var mk = function (army, id) {
  w.garrison = { troops: army, cityId: c.id, genId: gen.id };
  return G._rawGatherYield({ id: id, x: wk.x, y: wk.y, type: 'forest', level: 10,
    origin: 'garrison', elapsed: 24 * 3600, army: army });
};
P('主战机甲 3000: ' + JSON.stringify(mk({ zhuzhan: 3000 }, 'a')));
P('板车 5000   : ' + JSON.stringify(mk({ banche: 5000 }, 'b')));
P('机甲3000+运60: ' + JSON.stringify(mk({ zhuzhan: 3000, yunshu: 60 }, 'c')));
w.garrison = null;

/* ---------- ③ 反击：隔空打为什么有反击 ---------- */
P('');
P('=== ③ 反击口径 ===');
var cnt = function (r) {
  var n = 0;
  (r.roundsLog || []).forEach(function (rr) {
    (rr.events || []).forEach(function (e) { if (e.kind === 'counter') n++; });
  });
  return n;
};
P('步行机2000 vs 步行机2000 → 反击 ' + cnt(G.tactic.simulate({ buxingji: 2000 }, null, { buxingji: 2000 }, 0, null, { kind: 'wild' })));
P('导弹车2000 vs 步行机2000 → 反击 ' + cnt(G.tactic.simulate({ daodanche: 2000 }, null, { buxingji: 2000 }, 0, null, { kind: 'wild' })));
P('导弹车20000 vs 步行机500 → 反击 ' + cnt(G.tactic.simulate({ daodanche: 20000 }, null, { buxingji: 500 }, 0, null, { kind: 'wild' })));
P('自行火炮20000 vs 步行机500 → 反击 ' + cnt(G.tactic.simulate({ huopao: 20000 }, null, { buxingji: 500 }, 0, null, { kind: 'wild' })));
P('导弹车2000 vs 盾卫2000 → 反击 ' + cnt(G.tactic.simulate({ daodanche: 2000 }, null, { dunwei: 2000 }, 0, null, { kind: 'wild' })));

/* ---------- ④ 回合上限 30：同/异兵种撞顶计数 ---------- */
P('');
P('=== ④ 回合上限撞顶 ===');
var g1 = G.makeGeneral('上限甲', 30, 'idle', G.state.cities[0].id, false, 'ying');
var g2 = G.makeGeneral('上限乙', 30, 'idle', G.state.cities[0].id, false, 'ying');
var xs = ['buxingji', 'dunwei', 'dianci'], ys = ['buxingji', 'dunwei'];
var hitDiff = 0, hitSame = 0, rows = [];
xs.forEach(function (x) {
  ys.forEach(function (y) {
    var a = {}, d = {}; a[x] = 3000; d[y] = 3000;
    var rd = G.tactic.simulate(a, g1, d, 0, g2, { kind: 'wild' }).rounds;
    if (rd >= 30) { if (x === y) hitSame++; else hitDiff++; }
    rows.push(x + 'vs' + y + '=' + rd);
  });
});
P(rows.join(' · '));
P('hitDiff=' + hitDiff + ' hitSame=' + hitSame);

/* ---------- ⑤ 双倍区：近战/远程 ---------- */
P('');
P('=== ⑤ 攻城双倍区 ===');
var dbl = function (army, id) {
  G.setTactic(id, { s: 'advance', t: DATA.TARGET_WALL });
  var r = G.tactic.simulate(army, null, { buxingji: 1500 }, 200, null,
    { kind: 'city', sieging: true, wallLv: 8 });
  G.clearTactics();
  return (r.roundsLog || []).filter(function (rr) {
    return (rr.events || []).some(function (e) { return e.kind === 'wall' && e.dbl; });
  }).length;
};
['buxingji', 'dunwei', 'kuanglie', 'zhuzhan', 'daodanche', 'huopao'].forEach(function (id) {
  P('  ' + id + ' 双倍回合 ' + dbl((function () { var o = {}; o[id] = 3000; return o; })(), id));
});

/* ---------- ⑥ 机动 stepsToWall 单调性（新 14 兵种） ---------- */
P('');
P('=== ⑥ 纵深 1399 步数 ===');
['fujiche', 'kuanglie', 'zhuzhan', 'wuzhi', 'buxingji', 'dunwei', 'dianci', 'daodanche', 'huopao', 'taitan', 'banche']
  .forEach(function (id) {
    var t = DATA.TROOPS[id];
    P('  ' + id + ' spd=' + t.spd + ' range=' + t.range + ' load=' + t.load + ' grp=' + t.grp +
      ' 步数1399=' + G.tactic.stepsToWall(t.spd, t.range, 1399) +
      ' 步数249=' + G.tactic.stepsToWall(t.spd, t.range, 249));
  });
var Dd = G.tactic.battlefieldOf({ daodanche: 500 }, { buxingji: 500 }, 0, {});
P('battlefieldOf(导弹车 vs 步行机)=' + Dd);

/* ---------- ⑦ E1：stepBattle 为什么 null ---------- */
P('');
P('=== ⑦ 观战挂起 stepBattle ===');
P('stepBattle 类型=' + typeof G.battle.stepBattle + ' _recOf 类型=' + typeof G.battle._recOf);
(function () {
  var fB = null;
  for (var ry2 = 0; ry2 < 121 && !fB; ry2++) {
    for (var rx2 = 0; rx2 < 121 && !fB; rx2++) {
      var fh = G.map.fortAt(c.x - 60 + rx2, c.y - 60 + ry2);
      if (fh && fh.level === 8) fB = fh;
    }
  }
  if (!fB) { P('  未找到 Lv8 据点'); return; }
  var gB = G.makeGeneral('诊断乙', 60, 'idle', c.id, false);
  gB.stamina = 300; gB.energy = 100; gB.tong = 400; gB.yw = 300; gB.zm = 300;
  st.generals.push(gB);
  st.marches = [];
  st.battles = [];
  c.army = { daodanche: 12000 };
  st.settings.battleWatch = true;
  var dB = G.march.dispatch({ kind: 'fort', x: fB.x, y: fB.y }, 'occupy', { daodanche: 12000 }, gB.id);
  P('  dispatch=' + (dB.ok ? 'ok' : dB.msg));
  var mB = st.marches[0];
  mB.elapsed = mB.totalTime;
  G.march.tick();
  P('  battles=' + (st.battles || []).length);
  var recB = st.battles[0];
  if (!recB) { P('  无战斗记录'); return; }
  P('  rec.over=' + recB.over + ' round=' + recB.round + ' 有 sim=' + !!recB.sim);
  if (G.battle.stepBattle) {
    var stB = G.battle.stepBattle(recB.id);
    P('  stepBattle → ' + (stB ? JSON.stringify({ r: stB.r, over: stB.over }) : 'null'));
  }
  P('  _recOf → ' + (G.battle._recOf ? !!G.battle._recOf(recB.id) : 'noFn'));
  P('  守军 total=' + JSON.stringify(G.wildDefenseAt ? G.wildDefenseAt(fB.x, fB.y, 8) : null).slice(0, 160));
})();

/* ---------- ⑧ D 实战集成：俘获为什么 0 ---------- */
P('');
P('=== ⑧ 俘获实战 ===');
(function () {
  var fD = null;
  for (var ry = 0; ry < 121 && !fD; ry++) {
    for (var rx = 0; rx < 121 && !fD; rx++) {
      var fh = G.map.fortAt(c.x - 60 + rx, c.y - 60 + ry);
      if (fh && fh.level <= 3) fD = fh;
    }
  }
  if (!fD) { P('  未找到 Lv≤3 据点'); return; }
  var gD = G.makeGeneral('诊断丙', 60, 'idle', c.id, false);
  gD.stamina = 300; gD.energy = 100; gD.tong = 500; gD.yw = 400; gD.zm = 400;
  st.generals.push(gD);
  st.settings.battleWatch = false;
  st.world.weather = 'clear';
  if (G.siegeScopeOf({ kind: 'fort', x: fD.x, y: fD.y })) G.siegeClear({ kind: 'fort', x: fD.x, y: fD.y });
  c.army = { daodanche: 40000 };
  st.captives = {};
  var res = G.battle.expedition({ kind: 'fort', x: fD.x, y: fD.y }, 'occupy', { daodanche: 40000 }, gD.id);
  P('  fort Lv' + fD.level + ' 结果=' + (res && res.ok) + ' winner=' + (res && res.result && res.result.winner));
  P('  defLoss=' + (res && res.result && res.result.defLoss) + ' 俘虏=' + JSON.stringify(res && res.result && res.result.captives));
  P('  CAPTIVE=' + JSON.stringify(DATA.CAPTIVE));
  P('  守军=' + JSON.stringify(G.wildDefenseAt ? G.wildDefenseAt(fD.x, fD.y, fD.level) : null).slice(0, 200));
})();

/* ---------- ⑨ 回放帧：反击配对 ---------- */
P('');
P('=== ⑨ 回放帧配对 ===');
(function () {
  var r = G.tactic.simulate({ buxingji: 4000 }, null, { dunwei: 6000 }, 0, null, { kind: 'wild' });
  var rf = G.battle.replayFramesOf(r);
  var all = (rf && rf.frames) ? rf.frames.map(function (f) { return f.ev || ''; }).join('｜') : '';
  var ctr = (all.match(/反击/g) || []).length;
  var paired = (all.match(/（[^）]*反击 杀 /g) || []).length;
  P('同兵种 步行机4000 vs 盾卫6000: frames=' + (rf && rf.frames ? rf.frames.length : 0)
    + ' 反击=' + ctr + ' 配对=' + paired);
  P('样本: ' + all.slice(0, 400));
  var r2 = G.tactic.simulate({ buxingji: 4000 }, null, { buxingji: 6000 }, 0, null, { kind: 'wild' });
  var rf2 = G.battle.replayFramesOf(r2);
  var all2 = (rf2 && rf2.frames) ? rf2.frames.map(function (f) { return f.ev || ''; }).join('｜') : '';
  P('同兵种 步行机4000 vs 步行机6000: 反击=' + (all2.match(/反击/g) || []).length
    + ' 配对=' + (all2.match(/（[^）]*反击 杀 /g) || []).length);
})();

/* ---------- ⑩ §163/§164 时间锚 ---------- */
P('');
P('=== ⑩ 时长表 ===');
Object.keys(DATA.TROOPS).forEach(function (id) {
  var t = DATA.TROOPS[id];
  P('  ' + id + ' grp=' + t.grp + ' time=' + t.time + ' → ' + U.dur(t.time));
});

/* ---------- ⑪ 自动治疗界面文案 ---------- */
P('');
P('=== ⑪ 两营/自动治疗界面 ===');
P('autoHealLogHTML 有"弩"=' + (G.ui.autoHealLogHTML ? G.ui.autoHealLogHTML().indexOf('弩') >= 0 : 'noFn'));
P('campCard 存在=' + (typeof G.ui.campCard));

fs.writeFileSync(R + '.workbuddy/tmp/p229c8_probe.txt', out.join('\n'), 'utf8');
console.log('DONE -> .workbuddy/tmp/p229c8_probe.txt');
process.exit(0);
