/* probe_v89179c_paper.js —— v89.179「纸面数据机制复核」（克制全撤后的世界）
   老板原话：「得了，不算了，取消所有克制关系，直接按兵种纸面数据计算，
   复核纸面数据机制是否合理」
   输出：
     ① 全兵种纸面数值表（含每人口派生指标 + 静态支配扫描）
     ② 同人口对局矩阵（15 兵种 · 双向实跑；格 = 胜者简称+胜者损失%；≠ = 两方向结论不一致）
     ③ 复核读数：弓的杀伤排序 / 突骑异常 / 骑兵主链 / §164③ 智能镜像
   跑法：node .workbuddy/tools/probe/probe_v89179c_paper.js
   口径：双方无将 · 晴天 · 无城墙 · 同人口 4000（按 pop 折算） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: '碎垣' });
GAME.state.world.weather = 'clear';

var LIST = ['yibing', 'changqiang', 'daodun', 'gongjian', 'qingji', 'tuqibing', 'tieji', 'hubaoqi',
  'xiliangtieqi', 'chuangnu', 'chongche', 'toudan', 'qingzhoubing', 'tengjiabing', 'nanjiangxiangbing'];
function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
function eq(name, pop) { var o = {}; o[name] = Math.floor(pop / DATA.TROOPS[name].pop); return o; }
function simOne(A, B) {
  var env = T.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
  var g = 0;
  while (!env.over && g++ < 40) env.step();
  var fin = env.finish();
  return { win: fin.winner, rounds: fin.rounds || g, a0: sum(A), d0: sum(B), aL: fin.atkLoss, dL: fin.defLoss };
}
function rPct(r, side) { return Math.round((side === 'a' ? r.aL / r.a0 : r.dL / r.d0) * 100); }
function ab(id) { return DATA.TROOPS[id].ab || id.slice(0, 1); }

/* ---------- ① 纸面数值表 ---------- */
console.log('=== ① 纸面数值表（克制全撤后的唯一依据）===');
console.log('  兵种     pop  hp     atk  def 射程 速度  谷/pop 攻/pop 血/pop ehp/pop');
Object.keys(DATA.TROOPS).forEach(function (id) {
  var t = DATA.TROOPS[id];
  var gpp = Math.round((t.cost.grain || 0) / t.pop);
  var line = '  ' + t.name + String(t.name.length < 4 ? '　'.repeat(4 - t.name.length) : '') .padEnd(2)
    + ' ' + String(t.pop).padStart(3) + ' ' + String(t.hp).padStart(6) + ' ' + String(t.atk).padStart(4)
    + ' ' + String(t.def).padStart(4) + ' ' + String(t.range).padStart(4) + ' ' + String(t.spd).padStart(4)
    + ' ' + String(gpp).padStart(6) + ' ' + String(Math.round(t.atk / t.pop)).padStart(5)
    + ' ' + String(Math.round(t.hp / t.pop)).padStart(5) + ' ' + String(Math.round(t.hp * (1 + t.def / 100) / t.pop)).padStart(6);
  console.log(line);
});
/* 静态支配扫描（同族战斗单位间：atk/pop ≥、hp/pop ≥、def/pop ≥、grain/pop ≤ → 支配） */
console.log('');
console.log('  支配扫描（A 全指标 ≥ B 且成本更低 → 报出）：');
var flags = 0;
LIST.forEach(function (a) {
  LIST.forEach(function (b) {
    if (a === b) return;
    var A = DATA.TROOPS[a], B = DATA.TROOPS[b];
    var ok = (A.atk / A.pop) >= (B.atk / B.pop) && (A.hp / A.pop) >= (B.hp / B.pop)
      && (A.def / A.pop) >= (B.def / B.pop)
      && ((A.cost.grain || 0) / A.pop) <= ((B.cost.grain || 0) / B.pop);
    if (ok && !(A.atk === B.atk && A.hp === B.hp && A.def === B.def && A.pop === B.pop)) {
      console.log('    ' + A.name + ' ≥ ' + B.name + '（攻 ' + Math.round(A.atk / A.pop) + '≥' + Math.round(B.atk / B.pop)
        + ' · 血 ' + Math.round(A.hp / A.pop) + '≥' + Math.round(B.hp / B.pop)
        + ' · 防 ' + Math.round(A.def / A.pop) + '≥' + Math.round(B.def / B.pop)
        + ' · 谷/pop ' + Math.round((A.cost.grain || 0) / A.pop) + '≤' + Math.round((B.cost.grain || 0) / B.pop) + '）');
      flags++;
    }
  });
});
if (!flags) console.log('    （无）');

/* ---------- ② 同人口对局矩阵 ---------- */
console.log('');
console.log('=== ② 同人口对局矩阵（双向实跑 · 格 = 胜者+损失% · ≠ = 方向不一致）===');
console.log('        ' + LIST.map(function (id) { return ab(id).padEnd(5); }).join(''));
var asym = [];
var rec = {};
LIST.forEach(function (a) { rec[a] = { w: 0, l: 0 }; });
LIST.forEach(function (a, i) {
  var line = '  ' + ab(a).padEnd(5) + ' ';
  LIST.forEach(function (b, j) {
    if (i === j) { line += '  ·  '; return; }
    if (j < i) { line += '     '; return; }   /* 只算上三角，逐格双向 */
    var r1 = simOne(eq(a, 4000), eq(b, 4000));            /* a 攻 b 守 */
    var r2 = simOne(eq(b, 4000), eq(a, 4000));            /* b 攻 a 守 */
    function wof(r, atkId, defId) {
      var w = r.win === 'atk' ? atkId : defId;
      var p = Math.round(((r.win === 'atk') ? r.aL / r.a0 : r.dL / r.d0) * 100);
      return { id: w, p: p };
    }
    var w1 = wof(r1, a, b), w2 = wof(r2, b, a);
    var mark = (w1.id === w2.id && Math.abs(w1.p - w2.p) <= 8) ? '' : '≠';
    if (mark) asym.push(ab(a) + '/' + ab(b) + '(' + ab(w1.id) + w1.p + ' vs ' + ab(w2.id) + w2.p + ')');
    var cell = ab(w1.id) + String(w1.p).padStart(2, '0') + mark;
    line += cell.padEnd(5);
    rec[w1.id].w++;
    rec[w1.id === a ? b : a].l++;
  });
  console.log(line);
});
console.log('  方向不一致格：' + (asym.length ? asym.join('  ') : '（0 —— 双向结论稳定）'));

/* ---------- ③ 复核读数 ---------- */
console.log('');
console.log('=== ③ 复核读数 ===');
function killsOf(army, def) {
  var r = G.tactic.simulate(army, null, def, 0, null, { kind: 'wild' });
  var n = 0;
  (r.roundsLog || []).forEach(function (rr) {
    (rr.events || []).forEach(function (e) { if (e.kind === 'attack' && e.side === 'atk') n += e.kill; });
  });
  return n;
}
var kQ = killsOf({ gongjian: 1000 }, { changqiang: 1000 });
var kD = killsOf({ gongjian: 1000 }, { daodun: 1000 });
var kC = killsOf({ gongjian: 1000 }, { chongche: 1000 });
console.log('  弓1000 的杀伤：打长枪 ' + kQ + ' / 打刀盾 ' + kD + ' / 打冲车 ' + kC
  + '（排序 ' + (kQ > kD && kD > kC ? '长枪>刀盾>冲车 ✓' : '⚠ 与直觉不符') + '）');
console.log('');
console.log('  骑兵主链（同人口 4000 vs 长枪）与突骑对照：');
['qingji', 'tieji', 'hubaoqi', 'xiliangtieqi', 'tuqibing'].forEach(function (c) {
  var r = simOne(eq('changqiang', 4000), eq(c, 4000));
  var win = r.win === 'atk' ? '枪胜' : '骑胜';
  console.log('    ' + DATA.TROOPS[c].name + '  ' + win + '（枪损 ' + rPct(r, 'a') + '% · 骑损 ' + rPct(r, 'd') + '%）');
});
console.log('');
console.log('  突骑（骑射）其余对局：');
['gongjian', 'qingji', 'tieji'].forEach(function (c) {
  var r = simOne(eq('tuqibing', 4000), eq(c, 4000));
  var win = r.win === 'atk' ? '突骑胜' : '对手胜';
  console.log('    突骑 vs ' + DATA.TROOPS[c].name + '  ' + win + '（突损 ' + rPct(r, 'a') + '% · 敌损 ' + rPct(r, 'd') + '%）');
});
console.log('');
console.log('  §164③ 智能战斗镜像（对照 smoke §164③ 阈值）：');
var A164 = { yibing: 500, changqiang: 500, daodun: 400, gongjian: 400, qingji: 200, tieji: 100, chuangnu: 40, toudan: 20 };
function run164(smart) {
  var env = G.tactic.begin(JSON.parse(JSON.stringify(A164)), null, JSON.parse(JSON.stringify(A164)), 0, null, { stances: {} });
  var rc = { side: 'atk', cmd: {} };
  var guard = 0;
  while (!env.over && guard++ < 36) {
    if (smart) G.battle.smartApply(rc, env);
    var st = env.step(); if (!st) break;
  }
  var fin = env.finish();
  var aL = 0, dL = 0;
  for (var k in fin.atkLossBy) aL += fin.atkLossBy[k];
  for (var k in fin.defLossBy) dL += fin.defLossBy[k];
  return { aL: aL, dL: dL };
}
var off164 = run164(false), on164 = run164(true);
console.log('    off aL=' + off164.aL + ' dL=' + off164.dL + ' 比=' + (off164.dL / off164.aL).toFixed(2)
  + ' ｜ on aL=' + on164.aL + ' dL=' + on164.dL + ' 比=' + (on164.dL / on164.aL).toFixed(2)
  + ' ｜ 判据(on比≥2×off比 且 on.aL<off.aL/2)：'
  + (((on164.dL / on164.aL) > (off164.dL / off164.aL) * 2 && on164.aL < off164.aL * 0.5) ? '过' : '⚠ 不过'));
console.log('');
console.log('（探针结束）');
process.exit(0);
