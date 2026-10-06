/* ============================================================
 * probe_v89183b_plans.js —— 「后期曲线不熄火」候选方案预演（v89.183）
 * ------------------------------------------------------------
 * 问题（probe_v89183a 实证）：体力→生命 渐近曲线在后期熄火 ——
 *   G2 体力 15300 → hpMult ×1.760，再 +6000 体力只 +1.07 个百分点；
 *   满配将已是"2 回合 0 损失"，后期提升无法感知。
 * 本探针预演三种修法（monkey patch GAME.staHpPct，引擎真跑）：
 *   对照 当前： 0.8×s/(s+800)                    （渐近 +80%）
 *   方案A 分段：s≤4000 双曲 + s>4000 线性 2.5%/1000（前快后稳，永不熄火）
 *   方案B 拉长： 1.6×s/(s+2400)                  （渐近 +160%，整体抬升）
 *   方案C 里程碑：原式 + 每满 5000 体力 +5% 跳变
 * 输出：① 曲线扫描 ② 后期边际 ③ 战役实测（三场景 × 四曲线）
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;

G.newGame({ name: '探183b', avatar: '🧔', gender: 'male', region: '碎垣' });
G.state.world.weather = 'clear';

/* ---------- 四条曲线（都是"体力池 → 全军生命加成"） ---------- */
function cur(s) { return 0.8 * s / (s + 800); }
function planA(s) {
  if (s <= 4000) return 0.8 * s / (s + 800);
  return 0.8 * 4000 / 4800 + (s - 4000) / 1000 * 0.025;
}
function planB(s) { return 1.6 * s / (s + 2400); }
function planC(s) { return cur(s) + Math.floor(s / 5000) * 0.05; }

console.log('=== ① 曲线扫描（加成值 = 全军生命 +X%）===');
console.log('体力池'.padEnd(10) + '当前'.padEnd(12) + '方案A分段'.padEnd(14) + '方案B拉长'.padEnd(14) + '方案C里程碑');
[0, 500, 1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 15395, 20000].forEach(function (s) {
  console.log(String(s).padEnd(10)
    + ('+' + (cur(s) * 100).toFixed(1) + '%').padEnd(12)
    + ('+' + (planA(s) * 100).toFixed(1) + '%').padEnd(14)
    + ('+' + (planB(s) * 100).toFixed(1) + '%').padEnd(14)
    + ('+' + (planC(s) * 100).toFixed(1) + '%'));
});

console.log('');
console.log('=== ② 后期边际（体力 15395 处，每 +1000 体力的生命加成增量）===');
[['当前', cur], ['方案A', planA], ['方案B', planB], ['方案C', planC]].forEach(function (p) {
  var base = p[1](15395);
  var plus = p[1](16395);
  console.log('  ' + p[0].padEnd(8) + ('现值 +' + (base * 100).toFixed(1) + '%').padEnd(16)
    + ('+1000 后 +' + (plus * 100).toFixed(1) + '%').padEnd(18)
    + '边际 +' + ((plus - base) * 100).toFixed(2) + ' 个百分点');
});

/* ---------- 满配将领（同 a 版：倚天12 + 百炼满 + 丹药，体力池 15395） ---------- */
var YT11 = ['yt_helm', 'yt_neck', 'yt_should', 'yt_chest', 'yt_back', 'yt_waist',
  'yt_arm', 'yt_feet', 'yt_ring', 'yt_pend', 'yt_sword'];
var SLOTS11 = ['head', 'neck', 'shoulder', 'chest', 'back', 'waist', 'arm', 'feet', 'ring', 'pendant', 'weapon'];
function mkFull() {
  var g = G.makeGeneral('满', 240, 'idle', null, false, 'tian', 'balance');
  g.tong = 140; g.yw = 140; g.zm = 140; g.nz = 140;
  g.tong += 50; g.yw += 50; g.zm += 50; g.nz += 50;
  g.equip = {};
  SLOTS11.forEach(function (s2, i) { g.equip[s2] = { id: YT11[i], enh: 10 }; });
  g.equip.mount = { id: 'jueying', enh: 10 };
  G.setStaNow(g, G.staMax(g));
  return g;
}
var genFull = mkFull();
console.log('');
console.log('（满配将体力池 = ' + G.staNow(genFull) + ' · 四维 ' + G.genAttrs(genFull).yw + ' 勇武）');

/* ---------- ③ 战役实测：monkey patch 四条曲线 ---------- */
var ORIG = G.staHpPct;
function sim(atkArmy, gen, defArmy) {
  return T.simulate(JSON.parse(JSON.stringify(atkArmy)), gen, JSON.parse(JSON.stringify(defArmy)), 0, null, {});
}
function fmtR(r) {
  return String(r.winner).padEnd(8) + ('我损 ' + r.atkLoss).padEnd(16) + ('敌损 ' + r.defLoss).padEnd(16) + r.rounds + ' 回合';
}
/* NPC 守将（Lv100 良材·接近真实守将规格） */
function npcGen() {
  var g = G.makeGeneral('守', 100, 'guard', null, false, 'liang', 'balance');
  return g;
}
var SCENES = [
  ['均势 30000v30000', { changqiang: 30000 }, { changqiang: 30000 }],
  ['劣势 30000v45000', { changqiang: 30000 }, { changqiang: 45000 }],
  ['劣势 30000v45000+NPC守将', { changqiang: 30000 }, { changqiang: 45000 }],
];
console.log('');
console.log('=== ③ 战役实测（我方满配将 · 四条曲线各跑三场景）===');
SCENES.forEach(function (sc, si) {
  console.log('▶ ' + sc[0]);
  [['当前', cur], ['方案A', planA], ['方案B', planB], ['方案C', planC]].forEach(function (p) {
    G.staHpPct = function (pool) { return p[1](Math.max(0, pool || 0)); };
    var dg = (si === 2) ? npcGen() : null;
    var r = sim(sc[1], genFull, sc[2]);
    console.log('    ' + p[0].padEnd(8) + fmtR(r));
  });
});
G.staHpPct = ORIG;

/* ---------- ④ 后期收益感知（方案A 下：再堆 6000 体力的战役差异） ---------- */
console.log('');
console.log('=== ④ 方案A 下"继续堆体力"的战役收益（均势 30000v30000）===');
[['当前体力', 0], ['+3000 体力', 3000], ['+6000 体力', 6000]].forEach(function (x) {
  var g = mkFull();
  G.setStaNow(g, G.staNow(g) + x[1]);
  G.staHpPct = function (pool) { return planA(Math.max(0, pool || 0)); };
  var r = sim({ changqiang: 30000 }, g, { changqiang: 30000 });
  console.log('  ' + x[0].padEnd(12) + fmtR(r));
});
G.staHpPct = ORIG;

console.log('');
console.log('探针完成（曲线为预演公式，引擎真跑；未改任何文件）。');
process.exit(0);
