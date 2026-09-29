/* v89.176 探针 A：**炮灰卡线**实证 —— "1 个兵能否卡住线、遏止前线推进"
   机制链（从引擎直读）：
     · v89.95 一击一目标、**溢出伤害作废** → 打 1 兵炮灰时，超大伤害只杀 1 兵；
     · v89.104 **前沿互锁**：推进 free = gap(目标) − effRange → 敌方停在"能打到目标"处，不越线；
     · v89.149 **两侧同规**：未指定目标 → 默认打**对面同名兵种**（找不到才回落"最近"）。
   于是两个对照场景：
     A 有同名（我方带弓，敌方也带弓）→ 敌弓应"穿透"（去打弓）——炮灰无效组；
     B 无同名（我方不带弓/骑）→ 敌全军目标缺失 → 全打炮灰 ——炮灰封线组。
   跑法：node .workbuddy/tools/probe/probe_v89176a_fodder.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });

function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
function pick(list, id) { var o = null; list.forEach(function (u) { if (u.id === id) o = u; }); return o; }

/* 敌方（守方）：弓 + 轻骑 —— 两个"可被同名锁定"的兵种 */
var FOE = { gongjian: 1200, qingji: 800 };
/* 我方三段配置（不含炮灰基数，炮灰由参数加） */
var CORE_WITH_BOW = { changqiang: 500, gongjian: 500 };   /* 场景 A：带弓（有同名） */
var CORE_NO_BOW  = { changqiang: 500, daodun: 300 };       /* 场景 B：不带弓/骑（无同名） */

/* 我方姿态：炮灰(民夫) = advance 前压；主力 = hold（站定输出/不抢线） */
function myStances(fodderN) {
  var o = { changqiang: { s: 'hold' }, gongjian: { s: 'hold' }, daodun: { s: 'hold' } };
  if (fodderN > 0) o.minfu = { s: 'advance' };
  return o;
}
/* 敌方默认（野地守方 = 前进；目标 = 引擎默认同名） */
function foeStances() { return { gongjian: { s: 'advance' }, qingji: { s: 'advance' } }; }

function runScene(name, core, fodderN, trace) {
  var atk = {};
  for (var k in core) atk[k] = core[k];
  if (fodderN > 0) atk.minfu = fodderN;
  var env = T.begin(atk, null, FOE, 0, null, {
    stances: { atk: myStances(fodderN), def: foeStances() },
  });
  var startA = {}, startD = {};
  env.units.atk.forEach(function (u) { startA[u.id] = u.count; });
  env.units.def.forEach(function (u) { startD[u.id] = u.count; });
  var a0 = sum(startA), d0 = sum(startD);
  var g = 0, rows = [];
  while (!env.over && g++ < 30) {
    var st2 = env.step();
    var aR = 0, dR = 0, fA = 0, fD = 0;
    env.units.atk.forEach(function (u) { if (u.count > 0) { aR += u.count; if (u.adv > fA) fA = u.adv; } });
    env.units.def.forEach(function (u) { if (u.count > 0) { dR += u.count; if (u.adv > fD) fD = u.adv; } });
    rows.push({ r: st2.r, gap: st2.gap, aRem: aR, dRem: dR, aF: Math.round(fA), dF: Math.round(fD) });
  }
  var r = env.finish();
  var out = { name: name, rounds: r.rounds || g, win: r.winner, a0: a0, d0: d0,
    aLoss: r.atkLoss, dLoss: r.defLoss,
    byA: {}, byD: {}, rows: rows };
  Object.keys(startA).forEach(function (id) {
    var u = pick(env.units.atk, id);
    out.byA[id] = startA[id] - (u ? u.count : 0);
  });
  env.units.def.forEach(function (u) { out.byD[u.id] = startD[u.id] - u.count; });
  env.units.atk.forEach(function (u) { if (!(u.id in out.byA)) out.byA[u.id] = 0; });
  console.log('== ' + name + ' ==  结局=' + (r.winner === 'atk' ? '胜' : (r.winner === 'def' ? '败' : '平'))
    + '  回合=' + out.rounds + '  我损=' + r.atkLoss + '/' + a0 + '（' + Math.round(r.atkLoss / a0 * 100) + '%）'
    + '  敌损=' + r.defLoss + '/' + d0 + '（' + Math.round(r.defLoss / d0 * 100) + '%）');
  var seg = [];
  Object.keys(out.byA).forEach(function (id) { if (out.byA[id] > 0) seg.push(id + '-' + out.byA[id]); });
  console.log('   我损明细: ' + (seg.join(' ') || '无'));
  seg = [];
  Object.keys(out.byD).forEach(function (id) { if (out.byD[id] > 0) seg.push(id + '-' + out.byD[id]); });
  console.log('   敌损明细: ' + (seg.join(' ') || '无'));
  if (trace) {
    console.log('   逐回合: [回合 距 我前 敌前] + 累计损');
    out.rows.forEach(function (x) {
      console.log('     r' + x.r + ' gap=' + x.gap + ' 我前=' + x.aF + ' 敌前=' + x.dF
        + ' 存:我' + x.aRem + '/敌' + x.dRem);
    });
  }
  return out;
}

console.log('=============================');
console.log('【场景 A】我方带弓（敌弓可锁定"同名"）—— 期望：炮灰**挡不住**敌弓');
console.log('=============================');
runScene('A0 无炮灰', CORE_WITH_BOW, 0, true);
runScene('A1 炮灰1兵', CORE_WITH_BOW, 1, true);
runScene('A2 炮灰50兵', CORE_WITH_BOW, 50, false);

console.log('');
console.log('=============================');
console.log('【场景 B】我方不带弓/骑（敌目标缺失 → 全打最近=炮灰）—— 期望：炮灰**封线**');
console.log('=============================');
runScene('B0 无炮灰', CORE_NO_BOW, 0, true);
runScene('B1 炮灰1兵', CORE_NO_BOW, 1, true);
runScene('B2 炮灰50兵', CORE_NO_BOW, 50, true);
runScene('B3 炮灰300兵', CORE_NO_BOW, 300, false);

console.log('');
console.log('=============================');
console.log('【附加】炮灰 300 兵时我方弓换成"前压到能打炮灰处的射程边"（错落有致）');
console.log('=============================');
(function () {
  var atk = { changqiang: 500, gongjian: 500, minfu: 300 };
  var env = T.begin(atk, null, FOE, 0, null, {
    stances: { atk: { changqiang: { s: 'hold' }, gongjian: { s: 'advance' }, minfu: { s: 'advance' } }, def: foeStances() },
  });
  var a0 = 0, d0 = 0;
  env.units.atk.forEach(function (u) { a0 += u.count; });
  env.units.def.forEach(function (u) { d0 += u.count; });
  var g = 0;
  while (!env.over && g++ < 30) env.step();
  var r = env.finish();
  console.log('== B4 弓前压+炮灰300 ==  结局=' + (r.winner === 'atk' ? '胜' : (r.winner === 'def' ? '败' : '平'))
    + '  回合=' + (r.rounds || g) + '  我损=' + r.atkLoss + '/' + a0 + '（' + Math.round(r.atkLoss / a0 * 100) + '%）'
    + '  敌损=' + r.defLoss + '/' + d0 + '（' + Math.round(r.defLoss / d0 * 100) + '%）');
})();

process.exit(0);
