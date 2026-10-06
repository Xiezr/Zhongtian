/* v89.164 动态目标版：目标按敌方阵容实时选（类中人数最多者） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;

var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};
function sum(a){var s=0;for(var k in a)s+=a[k];return s;}
function catOf(id) {
  var t = DATA.TROOPS[id] || {};
  if (t.craft) return 'siege';
  if (t.cat === 'cav') return 'cav';
  if ((t.range || 0) >= 500) return 'ranged';
  return 'inf';
}
var TARGET_RULE = {
  changqiang: ['cav'], daodun: ['ranged'], tengjiabing: ['inf'],
  gongjian: ['ranged'], toudan: ['ranged'], chuangnu: ['siege', 'ranged'],
  qingji: ['ranged'], tieji: ['ranged'], tuqibing: ['ranged'],
  hubaoqi: ['ranged'], xiliangtieqi: ['ranged'], nanjiangxiangbing: ['ranged'],
};
function pickTarget(theirs, cats) {
  for (var i = 0; i < cats.length; i++) {
    var best = null, bestN = 0;
    theirs.forEach(function (u) {
      if (u.count <= 0) return;
      if (catOf(u.id) !== cats[i]) return;
      if (u.count > bestN) { bestN = u.count; best = u.id; }
    });
    if (best) return best;
  }
  return '';
}
function smartTick(env, side, opt) {
  opt = opt || {};
  var mine = env.units[side], theirs = env.units[side === 'atk' ? 'def' : 'atk'];
  var D = env.field || 1, themFront = 0;
  theirs.forEach(function (u) { if (u.count > 0 && u.adv > themFront) themFront = u.adv; });
  mine.forEach(function (u) {
    if (u.count <= 0) return;
    var gap = D - u.adv - themFront;
    var isRanged = u.range >= 500, isCav = (u.spd >= 400 && (DATA.TROOPS[u.id] || {}).cat === 'cav'), want;
    if (isRanged) want = (gap <= u.range * (opt.rangeK || 1)) ? 'hold' : 'advance';
    else if (isCav) want = (gap <= (opt.gapCav != null ? opt.gapCav : 250)) ? 'hold' : 'advance';
    else want = (gap <= (opt.gapInf != null ? opt.gapInf : 250)) ? 'hold' : 'advance';
    var patch = {};
    if (u.stance !== want) patch.s = want;
    if (opt.dynTarget) {
      var cats = TARGET_RULE[u.id];
      var wantT = cats ? pickTarget(theirs, cats) : (u.target || '');
      if ((u.target || '') !== wantT) patch.t = wantT;
    }
    if (patch.s || patch.t !== undefined) env.setCmd(side, u.id, patch);
  });
}
function plan(opt) { return { byId: {}, smart: function (env, side) { smartTick(env, side, opt || {}); } }; }
function run(atkPlan, defArmy, label) {
  var env = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(defArmy || ARMY)), 0, null, { stances: {} });
  var guard = 0;
  while (!env.over && guard++ < 36) { if (atkPlan.smart) atkPlan.smart(env, 'atk'); var st = env.step(); if (!st) break; }
  var fin = env.finish();
  var aL = sum(fin.atkLossBy), dL = sum(fin.defLossBy), aTot = sum(ARMY), dTot = sum(defArmy || ARMY);
  console.log('  [' + label + '] r=' + fin.rounds + ' 我损=' + (aL/aTot*100).toFixed(1) + '% 敌损=' + (dL/dTot*100).toFixed(1) + '% 交换=' + (aL>0?(dL/aL).toFixed(2):'inf') + ' w=' + fin.winner);
  return { aL: aL, dL: dL };
}
G.newGame({ name: 'dyn', region: '烬环' });
console.log('=== 镜像：静态目标 vs 动态目标 ===');
run(plan({ dynTarget: false, gapInf: 250, gapCav: 250 }), null, '静态目标(写死)');
run(plan({ dynTarget: true, gapInf: 250, gapCav: 250 }), null, '★ 动态目标');
console.log('=== 动态目标 · 三场景 ===');
var S_CAV = { qingji: 600, tieji: 300, tuqibing: 400, hubaoqi: 200, xiliangtieqi: 150, nanjiangxiangbing: 40 };
var S_BOW = { gongjian: 1000, chuangnu: 150, toudan: 60, daodun: 400 };
var S_INF = { yibing: 1200, changqiang: 1200, daodun: 900, tengjiabing: 600, minfu: 300 };
[[S_CAV, '敌骑重'], [S_BOW, '敌弓重'], [S_INF, '敌步重']].forEach(function (p) {
  run(plan({ dynTarget: false }), p[0], p[1] + ' · 静态');
  run(plan({ dynTarget: true }), p[0], p[1] + ' · 动态');
});
console.log('=== 动态目标 · 阈值再扫 ===');
[150, 200, 300, 400].forEach(function (g) { run(plan({ dynTarget: true, gapInf: g, gapCav: g }), null, 'gap=' + g); });
process.exit(0);
