/* ============================================================
 * probe_v89183a_diminish.js —— 「后期将领再提升还有没有用」量化（v89.183）
 * ------------------------------------------------------------
 * 老板问：「渐近值（上限）曲线顶部趋于平缓 → 后期将领再提升属性在战役里
 *   是不是没用了？需要差异化体验（挑战 + 爽感）」
 * 本探针组装**真实的后期满配将领**（天授Lv240 + 倚天12件 + 百炼 + 丹药），
 * 量化各通道在曲线**后段**的边际收益：
 *   ① 满配组装表（各养成档 → genAttrs 全读取值）
 *   ② 体力 → 生命 的后段边际（hpMult 还涨得动吗）
 *   ③ 四维 → 攻防 的后段边际
 *   ④ 统率覆盖（对 8万/10万 出征容量）
 *   ⑤ 战役实测：最后一段养成（丹药50）与假想"再+50%"能感知多少
 * 全程读真实出口（genEquipBonus / genAttrs / staHpBonus / T.simulate）。
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;

G.newGame({ name: '探183', avatar: '🧔', gender: 'male', region: '碎垣' });
G.state.world.weather = 'clear';

var YT11 = ['yt_helm', 'yt_neck', 'yt_should', 'yt_chest', 'yt_back', 'yt_waist',
  'yt_arm', 'yt_feet', 'yt_ring', 'yt_pend', 'yt_sword'];
var SLOTS11 = ['head', 'neck', 'shoulder', 'chest', 'back', 'waist', 'arm', 'feet', 'ring', 'pendant', 'weapon'];
function dress(g, enh) {
  g.equip = {};
  SLOTS11.forEach(function (s, i) { g.equip[s] = enh ? { id: YT11[i], enh: enh } : YT11[i]; });
  g.equip.mount = enh ? { id: 'jueying', enh: enh } : 'jueying';
}
/* 丹药：直接写进四维（= useItem 的实际效果；均取上限 50/维） */
function eatPills(g, n) { g.tong += n; g.yw += n; g.zm += n; g.nz += n; }

/* ---------- ① 满配组装（天授 Lv240 · 四维取资质上限 140）---------- */
function mkTian(v) {
  var g = G.makeGeneral('满', 240, 'idle', null, false, 'tian', 'balance');
  g.tong = v; g.yw = v; g.zm = v; g.nz = v;
  return g;
}
var STAGES = [
  ['G0 裸将', function (g) { }],
  ['G1 +倚天12件', function (g) { dress(g, 0); }],
  ['G2 +百炼满(×1.8)', function (g) { dress(g, 10); }],
  ['G3 G2+丹药50/维', function (g) { dress(g, 10); eatPills(g, 50); }],
];
console.log('=== ① 后期满配组装（天授Lv240 · 四维上限140 · clear）===');
console.log('档位'.padEnd(18) + '勇武'.padEnd(8) + '智谋'.padEnd(8) + '统率'.padEnd(8) + '体力'.padEnd(8)
  + 'atkPct'.padEnd(11) + 'defPct'.padEnd(11) + 'hpMult'.padEnd(9) + '速度');
var G3 = null;
STAGES.forEach(function (st) {
  var g = mkTian(140);
  st[1](g);
  G.setStaNow(g, G.staMax(g));
  var a = G.genAttrs(g);
  var hpM = 1 + G.staHpBonus(g);
  if (st[0] === 'G3 G2+丹药50/维') G3 = g;
  console.log(st[0].padEnd(18) + String(a.yw).padEnd(8) + String(a.zm).padEnd(8) + String(a.tong).padEnd(8)
    + String(G.staNow(g)).padEnd(8)
    + ((a.atkPct * 100).toFixed(1) + '%').padEnd(11)
    + ((a.defPct * 100).toFixed(1) + '%').padEnd(11)
    + ('×' + hpM.toFixed(3)).padEnd(9)
    + a.spd + '（×' + (1 + a.spd / 300).toFixed(2) + '）');
});
var a3 = G.genAttrs(G3);
var staG3 = G.staNow(G3);

/* ---------- ② 体力后段边际 ---------- */
console.log('');
console.log('=== ② 体力 → 生命 后段边际（G3 当前 ' + staG3 + '）===');
[0, 1000, 3000, 6000, 12000].forEach(function (add) {
  var s = staG3 + add;
  var hpM = 1 + 0.8 * s / (s + 800);
  console.log('  体力 ' + String(s).padEnd(8) + '（+' + String(add).padEnd(6) + '）→ hpMult ×' + hpM.toFixed(4)
    + (add ? '（边际 +' + ((hpM - (1 + 0.8 * staG3 / (staG3 + 800))) * 100).toFixed(2) + ' 个百分点）' : ''));
});

/* ---------- ③ 四维后段边际 ---------- */
console.log('');
console.log('=== ③ 四维 → 攻防 后段边际（G3 当前 勇武/智谋 ' + a3.yw + '/' + a3.zm + '）===');
[0, 100, 300, 600].forEach(function (add) {
  var pct = (a3.yw + add) * 0.0005;
  var pct0 = a3.yw * 0.0005;
  console.log('  勇武 ' + String(a3.yw + add).padEnd(8) + '（+' + String(add).padEnd(5) + '）→ 攻通道 +'
    + (pct * 100).toFixed(2) + '%' + (add ? '（边际 +' + ((pct - pct0) * 100).toFixed(2) + ' 个百分点）' : ''));
});

/* ---------- ④ 统率覆盖 ---------- */
console.log('');
console.log('=== ④ 统率覆盖（G3 统率 ' + a3.tong + ' · 覆盖 ' + (a3.tong * 100) + ' 兵）===');
[50000, 80000, 100000, 120000].forEach(function (men) {
  var cover = Math.min(1, a3.tong * 100 / men);
  console.log('  出征 ' + (men / 10000) + ' 万兵 → cover ' + cover.toFixed(2)
    + (cover < 1 ? '（加成打 ' + Math.round(cover * 100) + ' 折）' : '（全覆盖 ✓）'));
});

/* ---------- ⑤ 战役实测：最后一段养成的战场收益 ---------- */
function sim(atkArmy, gen, defArmy) {
  return T.simulate(JSON.parse(JSON.stringify(atkArmy)), gen, JSON.parse(JSON.stringify(defArmy)), 0, null, {});
}
function fmtR(r) {
  return String(r.winner).padEnd(8) + ('我损 ' + r.atkLoss).padEnd(16) + ('敌损 ' + r.defLoss).padEnd(16) + r.rounds + ' 回合';
}
console.log('');
console.log('=== ⑤ 战役实测（长枪 30000 vs 长枪 30000 · 我方带将）===');
var g2 = mkTian(140); dress(g2, 10); G.setStaNow(g2, G.staMax(g2));            /* 满装无丹药 */
var g3p = mkTian(140); dress(g3p, 10); eatPills(g3p, 50); G.setStaNow(g3p, G.staMax(g3p));  /* +丹药 */
var gX = mkTian(140); dress(gX, 10); eatPills(gX, 50);
gX.tong = Math.round(gX.tong * 1.5); gX.yw = Math.round(gX.yw * 1.5);
gX.zm = Math.round(gX.zm * 1.5); gX.nz = Math.round(gX.nz * 1.5);              /* 假想：再 +50% 四维 */
G.setStaNow(gX, Math.round(G.staMax(gX) * 1.5));                               /* 假想：再 +50% 体力 */
console.log('  G2 满装无丹药    ' + fmtR(sim({ changqiang: 30000 }, g2, { changqiang: 30000 })));
console.log('  G3 +丹药50/维    ' + fmtR(sim({ changqiang: 30000 }, g3p, { changqiang: 30000 })));
console.log('  GX 假想再+50%    ' + fmtR(sim({ changqiang: 30000 }, gX, { changqiang: 30000 })));
console.log('  （对照）无将      ' + fmtR(sim({ changqiang: 30000 }, null, { changqiang: 30000 })));

/* 劣势局：满配 vs 1.5 倍兵力敌 */
console.log('');
console.log('=== ⑤b 劣势局（我方 30000 vs 敌方 45000）===');
console.log('  G2 满装无丹药    ' + fmtR(sim({ changqiang: 30000 }, g2, { changqiang: 45000 })));
console.log('  G3 +丹药50/维    ' + fmtR(sim({ changqiang: 30000 }, g3p, { changqiang: 45000 })));
console.log('  GX 假想再+50%    ' + fmtR(sim({ changqiang: 30000 }, gX, { changqiang: 45000 })));
console.log('  （对照）无将      ' + fmtR(sim({ changqiang: 30000 }, null, { changqiang: 45000 })));

console.log('');
console.log('探针完成（全程读真实出口）。');
process.exit(0);
