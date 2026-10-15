/* v89.185（老板 7「改进战役智能」）：目标规则候选扩充评估 ——
   现有 4 规则（static/dmg/eff/front）vs 2 个新候选：
     · ranged 先制远程：优先敌方远程兵种（射程 ≥500）——"射人先射马，擒贼先擒王"，
       远程是持续输出源，先打掉能减少我方被磨时间；
     · weak   击其脆弱：优先每兵生命最低的目标（清场加速）。
   跑法（真实 smartApply · echelon 姿态 · 无将，纯测目标规则差异）：
   node .workbuddy/tools/probe/probe_v89185f_smart5.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: 'smart5', avatar: '🧔', gender: 'male', region: 'random' });
G.state.world.weather = 'clear';

/* monkey-patch：产品评分器 + 两个新规则（与产品逐点一致，仅新增分支） */
var ORIG_PICK = G.battle.smartPickTarget;
G.battle.smartPickTarget = function (u, foes, rule, D) {
  if (rule !== 'ranged' && rule !== 'weak') return ORIG_PICK(u, foes, rule, D);
  var list = (foes || []).filter(function (e) { return e.count > 0; });
  if (!list.length) return null;
  var TT = G.tactic;
  var perA = TT.perAtk(u);
  var best = null, bestSc = -Infinity;
  list.forEach(function (e) {
    var cf = TT.clashFactor(perA, TT.perDef(e));
    var perHp = TT.perHp(e, null);
    var hold = (e.stance === 'hold') ? (1 - TT.HOLD_DAMAGE_CUT) : 1;
    var _st = DATA.TROOPS[u.id] || {}, _et = DATA.TROOPS[e.id] || {};
    var mechF = (_st.vsMech && _et.mech) ? _st.vsMech : 1;
    var killF = perA * u.count * cf * hold * mechF / perHp;
    var sc;
    if (rule === 'ranged') sc = (((e.range || 0) >= 500) ? 1e9 : 0) + Math.min(killF, e.count) * 1000 + killF * 0.001;
    else sc = -perHp * 1000 + Math.min(killF, e.count);   /* weak：最脆优先 */
    if (sc > bestSc) { bestSc = sc; best = e; }
  });
  return best ? best.id : null;
};

var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};
var SCENES = {
  mirror: ARMY,
  cavHeavy: { qingji: 600, tieji: 400, tuqibing: 400, hubaoqi: 200, xiliangtieqi: 120, changqiang: 400, gongjian: 300 },
  bowHeavy: { gongjian: 1600, chuangnu: 200, toudan: 80, daodun: 300, changqiang: 300 },
  infHeavy: { changqiang: 1300, daodun: 1100, tengjiabing: 700, qingji: 200, gongjian: 400 },
};
var RULES = ['static', 'dmg', 'eff', 'front', 'ranged', 'weak'];

function runRule(rule, scene) {
  var env = T.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(scene)), 0, null, {});
  var rec = { side: 'atk', cmd: {}, smartRule: rule, smartMode: 'echelon' };
  var g = 0;
  while (!env.over && g++ < 40) {
    G.battle.smartApply(rec, env);
    var st = env.step();
    if (!st) break;
  }
  var fin = env.finish();
  var aL = 0, dL = 0;
  for (var k in (fin.atkLossBy || {})) aL += fin.atkLossBy[k];
  for (var k2 in (fin.defLossBy || {})) dL += fin.defLossBy[k2];
  return { aL: aL, dL: dL, win: fin.winner === 'atk', rounds: fin.rounds,
    ratio: dL > 0 ? (aL > 0 ? dL / aL : 999) : 0 };
}
function fmt(r) { return (r.win ? 'W' : 'L') + ' 我损' + String(r.aL).padEnd(6) + ' 敌损' + String(r.dL).padEnd(6) + ' 比' + (r.ratio >= 100 ? '∞' : r.ratio.toFixed(2)) + '(' + r.rounds + ')'; }

console.log('====== 目标规则 × 场景（echelon 姿态 · 无将 · 真实 smartApply）======');
Object.keys(SCENES).forEach(function (sn) {
  var scores = {};
  RULES.forEach(function (r) { scores[r] = runRule(r, SCENES[sn]); });
  /* 找最优（胜优先 → 我损最小 → 交换比） */
  var best = null;
  RULES.forEach(function (r) {
    var s = scores[r];
    var key = (s.win ? 1e9 : 0) + (1e6 - s.aL) + s.ratio;
    if (!best || key > best.key) best = { rule: r, key: key };
  });
  var line = '▶ ' + sn.padEnd(10) + '最优=【' + best.rule + '】  ';
  RULES.forEach(function (r) { line += r + '=' + fmt(scores[r]) + '  '; });
  console.log(line);
});
console.log('');
console.log('（静态表规则 = plan.targets 固定映射；ranged/weak 为候选新规则 —— 若从未最优则无增益）');
process.exit(0);
