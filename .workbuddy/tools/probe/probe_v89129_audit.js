/* ============================================================
 * v89.129 探针（老板两条：①城墙独立建造时间 ②野外目标带将梳理）
 * ------------------------------------------------------------
 * 固化"梳理当前设置"的证据：
 *   A. 城墙的耗材/耗资/耗时 vs 建筑体系（秩序检查）
 *   B. 野外目标守将现状（野地 / 据点 / 城池）—— 逐类真调 resolveTarget
 *   C. 我方出征无将 → 真调 dispatch 是否被拦（引擎硬闸实证）
 *   D. 据点守将缺口：巡查/结算读的 t.guard 是否存在
 * ============================================================ */
var R = 'E:/Deepseekdb/';
var fs = require('fs');
var path = require('path');
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.Utils || global.U;

console.log('════════ A. 城墙：耗材/耗资/耗时 vs 体系 ════════');
var rows = Object.keys(DATA.BUILDINGS).map(function (k) {
  var c = DATA.BUILDINGS[k].levelCost(11);
  var res = c ? (c.grain + c.wood + c.stone + c.iron) : 0;
  return { k: k, name: DATA.BUILDINGS[k].name, res: res, t: DATA.buildTimeSec(k, 11) };
});
var maxRes = Math.max.apply(null, rows.map(function (r) { return r.res; }));
rows.sort(function (a, b) { return b.res - a.res; });
rows.forEach(function (r) {
  var mk = (r.k === 'chengqiang') ? '  ← 城墙' : '';
  console.log('  ' + r.name.padEnd(5) + ' 资源 ' + String(r.res).padStart(9)
    + '  时间 ' + (r.t / 3600).toFixed(2) + 'h  资源/时 ' + Math.round(r.res / (r.t / 3600)) + mk);
});
console.log('  城墙资源占全表最高（' + Math.round(rows[0].res) + '）的比 = '
  + (DATA.BUILDINGS.chengqiang.levelCost(11).grain + DATA.BUILDINGS.chengqiang.levelCost(11).wood
     + DATA.BUILDINGS.chengqiang.levelCost(11).stone + DATA.BUILDINGS.chengqiang.levelCost(11).iron) / maxRes * 100 + '%');

console.log('');
console.log('════════ B. 野外目标守将现状（逐类真调 resolveTarget）════════');
var st = G.newGame({ name: 'X', cityName: '许都', region: '豫州', mapSeed: 20260926 });
if (!st.map.grid) { try { G.map.generate(); } catch (e) {} }
G.ui._cityId = st.cities[0].id;

/* ① 野地：生成 30 个样本，统计"有将率" */
var withGen = 0, sampN = 0, lvSet = {};
for (var i = 0; i < 30; i++) {
  var wd = G.wildDefenseAt(5 + (i % 7), 5 + ((i / 7) | 0), 2 + (i % 9));
  sampN++;
  if (wd.gen) {
    withGen++;
    var rkN = G.rankOf(wd.gen).name;
    lvSet[wd.gen.level] = true;
  }
}
console.log('  野地（30 样本，Lv2-10）：有将 ' + withGen + '/' + sampN
  + '；样本守将等级 ' + Object.keys(lvSet).map(Number).sort(function (a, b) { return a - b; }).join(','));
console.log('  野地守将概率表 WILD_GEN_CHANCE = ' + JSON.stringify(DATA.WILD_GEN_CHANCE));

/* ② 据点：resolveTarget 的 fort 分支有没有 guard */
var fortHit = null;
for (var yy = 0; yy < (DATA.MAP_H || 60) && !fortHit; yy++) {
  for (var xx = 0; xx < (DATA.MAP_W || 60) && !fortHit; xx++) {
    var f = G.map.fortAt ? G.map.fortAt(xx, yy) : null;
    if (f) fortHit = f;
  }
}
if (fortHit) {
  var tf = G.battle.resolveTarget({ kind: 'fort', x: fortHit.x, y: fortHit.y });
  console.log('  据点（' + fortHit.name + ' Lv' + fortHit.level + '）：');
  console.log('    resolveTarget → kind=' + tf.kind + ' lv=' + tf.lv
    + ' guard=' + JSON.stringify(tf.guard) + (tf.guard ? '' : '  ← ⚠ 无守将字段'));
} else {
  console.log('  据点：地图上未找到（seed 不含）—— 跳过');
}

/* ③ 城池：npcCityGuard */
if (st.map && st.map.cities && st.map.cities.length) {
  var nc = st.map.cities[0];
  var ng = G.npcCityGuard(nc);
  var tc = G.battle.resolveTarget({ kind: 'city', id: nc.id });
  console.log('  城池（' + nc.name + ' ' + nc.type + '）：guard=' + (ng ? ng.name : 'null')
    + ' ' + (ng ? G.rankOf(ng).name + ' Lv' + ng.level : '')
    + '；resolveTarget guard=' + (tc.guard ? tc.guard.name : 'null'));
}

console.log('');
console.log('════════ C. 我方出征无将 → 真调是否被拦 ════════');
st.res.grain = 1e9; st.res.wood = 1e9; st.res.stone = 1e9; st.res.iron = 1e9;
var c0 = st.cities[0];
c0.army = { yibing: 500 };
var r1 = G.march.dispatch({ kind: 'wild', x: 3, y: 3 }, 'raid', { yibing: 100 }, '');
var r2 = G.battle.expedition({ kind: 'wild', x: 3, y: 3 }, 'raid', { yibing: 100 }, null);
console.log('  march.dispatch(genId=\'\') → ok=' + (r1 && r1.ok) + '  msg=' + ((r1 && r1.msg) || '-'));
console.log('  battle.expedition(genId=null) → ok=' + (r2 && r2.ok) + '  msg=' + ((r2 && r2.msg) || '-'));

console.log('');
console.log('════════ D. 据点守将缺口：战斗侧读到的 scGen ════════');
if (fortHit) {
  var tf2 = G.battle.resolveTarget({ kind: 'fort', x: fortHit.x, y: fortHit.y });
  console.log('  战斗结算读 scGen = t.guard || null → ' + (tf2.guard ? '有将' : 'null（守方无将领加成）'));
  console.log('  侦查面板守将行读 out.guard = t.guard → ' + (tf2.guard ? '名册可见' : '显示「无（守军无将，即无加成）」'));
}

console.log('');
console.log('════════ E. 自动出征选将现状 ════════');
var cfg = G.autoMarchCfg ? G.autoMarchCfg() : null;
console.log('  cfg.genId = ' + (cfg ? cfg.genId : 'null') + '（固定一位；目标等级不参与选将）');

process.exit(0);
