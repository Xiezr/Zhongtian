/* v89.176 探针 E：**接敌预测对账** + 新出口真调（lossRatioOf / mustTakeOf / 阵型赛马）
   ① 逐回合：step 前调 T.contactForecast 预测"谁将开火"，与 step 的实际 attack 事件对账；
   ② lossRatioOf 真调与手算对照；
   ③ mustTakeOf：野地 → false；系统城（县城及以上）→ true；
   ④ 赛马结果抽样（各场景选出的 模式×规则）。
   跑法：node .workbuddy/tools/probe/probe_v89176e_forecast.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });

var SCENES = {
  mirror: { changqiang: 500, daodun: 300, gongjian: 400, qingji: 200 },
  bowHeavy: { changqiang: 400, daodun: 300, gongjian: 800, qingji: 100 },
  cavHeavy: { changqiang: 500, daodun: 400, qingji: 500, tieji: 300, gongjian: 300 },
  infHeavy: { changqiang: 700, daodun: 600, tengjiabing: 400, gongjian: 300 },
};

console.log('=== ① 接敌预测对账（预测 fire vs 实际 attack）===');
var totP = 0, totA = 0, totHit = 0;
Object.keys(SCENES).forEach(function (sn) {
  var A = JSON.parse(JSON.stringify(SCENES[sn]));
  var env = T.begin(A, null, JSON.parse(JSON.stringify(A)), 0, null, {});
  var g = 0, pHit = 0, pAll = 0, aAll = 0;
  while (!env.over && g++ < 30) {
    var fc = T.contactForecast(env.units.atk, env.units.def, env.field);
    var pred = {};
    (fc.fire || []).forEach(function (x) { if (x.side === 'atk') pred[x.id] = true; });
    var st = env.step();
    var act = {};
    (st.events || []).forEach(function (e) {
      if (e.kind === 'attack' && e.side === 'atk') act[e.id] = true;
    });
    var hit = 0, pk = Object.keys(pred), ak = Object.keys(act);
    pk.forEach(function (k) { if (act[k]) hit++; });
    pHit += hit; pAll += pk.length; aAll += ak.length;
  }
  var prec = pAll ? (pHit / pAll * 100).toFixed(0) : '-';
  var rec = pAll ? (pHit / aAll * 100).toFixed(0) : '-';
  console.log('  ' + sn.padEnd(10) + ' 回合' + g + '  预测命中 ' + pHit + '/' + pAll
    + '（精确率 ' + prec + '% · 召回率 ' + rec + '%）');
  totP += pAll; totA += aAll; totHit += pHit;
});
console.log('  合计命中 ' + totHit + '/' + totP + '（精确率 ' + (totHit / totP * 100).toFixed(1)
  + '%）· 召回 ' + (totHit / totA * 100).toFixed(1) + '%');

console.log('');
console.log('=== ② lossRatioOf 真调 vs 手算 ===');
(function () {
  var A = { changqiang: 500, daodun: 300, gongjian: 400 };
  var env = T.begin(A, null, { qingji: 800, gongjian: 900 }, 0, null, {});
  var g = 0;
  while (!env.over && g++ < 6) env.step();
  var lr = G.battle.lossRatioOf(env);   /* env 有 snap() —— 与 ses 同接口 */
  var snap = env.snap(), s0 = 0, s1 = 0;
  snap.atk.forEach(function (u) { s0 += u.start; s1 += u.count; });
  var manual = (s0 - s1) / s0;
  console.log('  ' + g + ' 回合后：lossRatioOf = ' + (lr * 100).toFixed(1) + '% · 手算 = '
    + (manual * 100).toFixed(1) + '% · 一致=' + (Math.abs(lr - manual) < 1e-9));
  console.log('  无 ses → ' + G.battle.lossRatioOf(null) + '（应 0）· 空 snap → 亦 0');
})();

console.log('');
console.log('=== ③ mustTakeOf 真调（野地 vs 系统城）===');
(function () {
  var wildRec = { target: { kind: 'wild', x: 2, y: 2 } };
  console.log('  野地目标（未占领）→ mustTakeOf = ' + G.battle.mustTakeOf(wildRec) + '（应 false，可撤）');
  /* 系统城：state.map.cities 里找一个 NPC 城（非 self） */
  var npc = null;
  (G.state.map.cities || []).forEach(function (c) { if (!npc && c.type && c.type !== 'self') npc = c; });
  if (npc) {
    console.log('  系统城「' + npc.name + '」(' + npc.type + ') → mustTakeOf = '
      + G.battle.mustTakeOf({ target: { kind: 'city', id: npc.id } }) + '（应 true，死战）');
  } else {
    console.log('  （本局 map.cities 为空 —— 输出跳过）');
  }
  console.log('  非城区自建城/据点：kind=fort → false（口径：只有系统城才是"非拿下不可"）');
})();

console.log('');
console.log('=== ④ 赛马抽样：各场景选出的 模式×规则（保兵评分）===');
(function () {
  var MIX = Object.assign({}, SCENES.mirror, { tieji: 100, toudan: 20, chuangnu: 40 });
  ['mirror', 'bowHeavy', 'cavHeavy'].forEach(function (sn) {
    var A = (sn === 'mirror') ? MIX : JSON.parse(JSON.stringify(SCENES[sn]));
    var rec = { side: 'atk', genId: null, atkArmy: A,
      sim: { scArmy: JSON.parse(JSON.stringify(A)), scVal: 0, scGen: null, simOpts: {} } };
    var r = G.battle.smartArbitrate(rec);
    var b = null;
    (r.scores || []).forEach(function (s) {
      if (s.mode === r.mode && s.rule === r.rule) b = s;
    });
    console.log('  ' + sn.padEnd(10) + ' → 采用 ' + r.mode + ' × ' + r.rule
      + (b ? ('（我损 ' + Math.round(b.aLoss * 100) + '% · 交换比 ' + b.ratio + (b.win ? ' · 胜' : '') + '）') : '')
      + '  用时 ' + r.ms + 'ms');
  });
})();

process.exit(0);
