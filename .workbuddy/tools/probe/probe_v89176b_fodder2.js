/* v89.176 探针 B（修正版）：**谁在前线 / 谁挨打 / 炮灰能否卡线**
   上一版教训（探针 A，已留档）：让主力 hold 是错的构造 ——
   "防御"= 原地不动，敌方前进到 gap=80（骑 er）就享**单方面输出**
   （我方 chq er=50 / 盾 er=30 够不着），hold 阵营 12 回合全灭。
   本版改为**双方全 advance**（真实默认），炮灰靠"民夫 er=10 最小 → 天然冲最前"实现。
   量：① 逐回合双方前排；② 挨打统计（敌打谁 / 我打谁）；③ 炮灰存活与敌线是否被锁。
   跑法：node .workbuddy/tools/probe/probe_v89176b_fodder2.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });

function sum(o) { var s = 0; for (var k in o) s += o[k]; return s; }
function pick(list, id) { var o = null; list.forEach(function (u) { if (u.id === id) o = u; }); return o; }

var FOE = { gongjian: 1200, qingji: 800 };

function runScene(name, atk, trace) {
  var env = T.begin(atk, null, FOE, 0, null, {});   /* 无 override：双方全按引擎默认（advance） */
  var startA = {}, startD = {};
  env.units.atk.forEach(function (u) { startA[u.id] = u.count; });
  env.units.def.forEach(function (u) { startD[u.id] = u.count; });
  var a0 = sum(startA), d0 = sum(startD);
  var hitFoe = {}, hitMe = {};      /* 挨打统计：targetId → 总击杀 */
  var g = 0, rows = [];
  while (!env.over && g++ < 30) {
    var st = env.step();
    (st.events || []).forEach(function (e) {
      if (e.kind === 'attack' || e.kind === 'counter' || e.kind === 'wall') {
        var m = (e.side === 'atk') ? hitFoe : hitMe;
        var key = e.targetId || e.target || '?';
        m[key] = (m[key] || 0) + (e.kill || 0);
      }
    });
    var aR = 0, dR = 0, fA = 0, fD = 0, fAid = '', fDid = '';
    env.units.atk.forEach(function (u) { if (u.count > 0) { aR += u.count; if (u.adv > fA) { fA = u.adv; fAid = u.id; } } });
    env.units.def.forEach(function (u) { if (u.count > 0) { dR += u.count; if (u.adv > fD) { fD = u.adv; fDid = u.id; } } });
    rows.push({ r: st.r, gap: st.gap, aRem: aR, dRem: dR, fA: Math.round(fA), fAid: fAid, fD: Math.round(fD), fDid: fDid });
  }
  var r = env.finish();
  console.log('== ' + name + ' ==  结局=' + (r.winner === 'atk' ? '胜' : (r.winner === 'def' ? '败' : '平'))
    + '  回合=' + (r.rounds || g) + '  我损=' + r.atkLoss + '/' + a0 + '（' + Math.round(r.atkLoss / a0 * 100) + '%）'
    + '  敌损=' + r.defLoss + '/' + d0 + '（' + Math.round(r.defLoss / d0 * 100) + '%）');
  var seg = [];
  Object.keys(r.atkLossBy || {}).forEach(function (id) { seg.push(id + '-' + r.atkLossBy[id]); });
  console.log('   我损明细: ' + (seg.join(' ') || '无'));
  seg = [];
  Object.keys(r.defLossBy || {}).forEach(function (id) { seg.push(id + '-' + r.defLossBy[id]); });
  console.log('   敌损明细: ' + (seg.join(' ') || '无'));
  seg = [];
  Object.keys(hitMe).forEach(function (k) { seg.push(k + '←' + hitMe[k]); });
  console.log('   敌军打在我军各支的击杀: ' + (seg.join('  ') || '无'));
  seg = [];
  Object.keys(hitFoe).forEach(function (k) { seg.push(k + '←' + hitFoe[k]); });
  console.log('   我军打在敌军各支的击杀: ' + (seg.join('  ') || '无'));
  if (trace) {
    rows.forEach(function (x) {
      console.log('     r' + x.r + ' gap=' + x.gap + ' 我前=' + x.fA + '(' + x.fAid + ') 敌前=' + x.fD + '(' + x.fDid + ')'
        + ' 存:我' + x.aRem + '/敌' + x.dRem);
    });
  }
  var out2 = { name: name, win: r.winner, rounds: r.rounds, rows: rows,
    atkLossBy: r.atkLossBy, defLossBy: r.defLossBy, hitMe: hitMe, hitFoe: hitFoe };
  return out2;
}

console.log('==============================================');
console.log('【场景 C】我方带弓（敌弓锁我弓；敌骑目标缺失 → 打最近）· 双方全 advance');
console.log('==============================================');
runScene('C0 无炮灰（changqiang500+gongjian500）', { changqiang: 500, gongjian: 500 }, true);
runScene('C1 +1 民夫', { changqiang: 500, gongjian: 500, minfu: 1 }, true);
runScene('C2 +100 民夫', { changqiang: 500, gongjian: 500, minfu: 100 }, true);
runScene('C3 +500 民夫', { changqiang: 500, gongjian: 500, minfu: 500 }, false);

console.log('');
console.log('==============================================');
console.log('【场景 D】我方不带弓/骑（敌**全军**目标缺失 → 全打最近）· 双方全 advance');
console.log('==============================================');
runScene('D0 无炮灰（changqiang500+daodun300）', { changqiang: 500, daodun: 300 }, true);
runScene('D1 +1 民夫', { changqiang: 500, daodun: 300, minfu: 1 }, true);
runScene('D2 +100 民夫', { changqiang: 500, daodun: 300, minfu: 100 }, true);
runScene('D3 +500 民夫', { changqiang: 500, daodun: 300, minfu: 500 }, false);

process.exit(0);
