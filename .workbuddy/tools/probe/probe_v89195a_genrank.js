/* v89.195 探针A：将领资质「补全属性」现状全量取证
   ① GEN_RANKS 各档全字段
   ② 生成路径采样：makeGeneral 四维 vs base[0] 地板（英杰×60 次）
   ③ 升档链模拟：凡品 Lv60 → 良材 → 英杰 → 名世 → 天授，每步记录六维 + 攻防 + 上限
   ④ 对照：升档到天授 vs 直接生成天授（同等级）——找"没补全"的维度
   ⑤ 攻防成长口径：applyLevelGrowth 中 attack 的资质相关性 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '探针A', region: '烬环' });
if (!G.state.map.grid) G.map.generate();

console.log('══════ ① GEN_RANKS 全字段 ══════');
D.GEN_RANKS.forEach(function (r) {
  console.log('  ' + r.name + '(' + r.id + ')：base=' + JSON.stringify(r.base)
    + ' grow=' + r.grow + ' lvCap=' + r.lvCap + ' ascend=' + (r.ascend == null ? '（无）' : r.ascend)
    + ' star=' + r.star + ' price=' + r.price);
});

console.log('\n══════ ② 生成采样：英杰×60 次（各 style 15 次）四维 vs base[0]=64 ══════');
var rkY = D.GEN_RANK_BY_ID.ying;
['balance', 'war', 'wis', 'gov'].forEach(function (sid) {
  var mins = { tong: 1e9, nz: 1e9, yw: 1e9, zm: 1e9 }, maxs = { tong: -1, nz: -1, yw: -1, zm: -1 };
  var below = 0, total = 0;
  for (var i = 0; i < 60; i++) {
    var g = G.makeGeneral('样' + i, 1, 'idle', null, false, 'ying', sid);
    ['tong', 'nz', 'yw', 'zm'].forEach(function (k) {
      if (g[k] < mins[k]) mins[k] = g[k];
      if (g[k] > maxs[k]) maxs[k] = g[k];
      total++; if (g[k] < 64) below++;
    });
  }
  console.log('  ' + sid + '：' + JSON.stringify(mins) + ' ~ ' + JSON.stringify(maxs)
    + '　低于地板64的维度计数 = ' + below + '/' + total);
});

console.log('\n══════ ③ 升档链：凡品 Lv60 起步（模拟练满再升档）══════');
var g = G.makeGeneral('升档将', 60, 'idle', null, false, 'fan', 'war');
function snap(tag) {
  var a = G.genAttrs(g);
  console.log('  [' + tag + '] rank=' + g.rank + ' lv=' + g.level
    + ' 四维=' + g.tong + '/' + g.nz + '/' + g.yw + '/' + g.zm
    + ' atk=' + g.attack + ' def=' + g.defense
    + ' spd=' + a.spd + ' staMax=' + a.staMax + ' freePts=' + (g.freePts == null ? 0 : g.freePts)
    + ' ascend=' + (g.ascend || 0));
}
snap('凡品 Lv60');
/* 升档链：fan→liang→ying→ming→tian（用真出口；节钺闸对 tian 需要节钺，先备 2 枚） */
G.state.jieyue = (G.state.jieyue || 0) + 2;
var chain = [
  { from: 'fan', to: 'liang', name: '蕴灵草' },
  { from: 'liang', to: 'ying', name: '洗髓芝' },
  { from: 'ying', to: 'ming', name: '化龙参' },
  { from: 'ming', to: 'tian', name: '天授果' },
];
chain.forEach(function (step) {
  var it = null;
  (D.ITEMS || []).forEach(function (x) { if (x.type === 'rank_up' && x.from === step.from) it = x; });
  if (!it) { console.log('  ⚠ 找不到 ' + step.from + ' 的灵草'); return; }
  var r = G.rankUpUse(g, it);
  console.log('  → ' + step.name + '：ok=' + r.ok + '　' + (r.msg || ''));
  if (r.ok) snap('升到' + step.to);
});

console.log('\n══════ ④ 对照：升档到天授 Lv60 vs 直接生成天授 Lv60（war 猛将）══════');
var g2 = G.makeGeneral('直招将', 60, 'idle', null, false, 'tian', 'war');
var a2 = G.genAttrs(g2);
console.log('  升档将：四维=' + g.tong + '/' + g.nz + '/' + g.yw + '/' + g.zm
  + ' atk=' + g.attack + ' def=' + g.defense + ' staMax=' + G.genAttrs(g).staMax);
console.log('  直招将：四维=' + g2.tong + '/' + g2.nz + '/' + g2.yw + '/' + g2.zm
  + ' atk=' + g2.attack + ' def=' + g2.defense + ' staMax=' + a2.staMax);
/* 对照"全程天授"的攻防理论值（Lv60：每级 +0.4×grow×round 的累积） */
var gTh = G.makeGeneral('理论将', 1, 'idle', null, false, 'tian', 'war');
for (var lv = 1; lv < 60; lv++) G.applyLevelGrowth(gTh);
console.log('  全程天授 Lv60（逐级 applyLevelGrowth 重演）：atk=' + gTh.attack + ' def=' + gTh.defense
  + '　（升档将 atk=' + g.attack + ' → 差额 ' + (gTh.attack - g.attack) + '）');
var gWar = G.makeGeneral('理论将2', 1, 'idle', null, false, 'war' === 'war' ? 'tian' : 'ying', 'war');
for (var lvI = 1; lvI < 60; lvI++) G.applyLevelGrowth(gWar);

console.log('\n══════ ④b 只补不削（已是高攻防的将升档不动它）══════');
var gHi = G.makeGeneral('高攻防将', 60, 'idle', null, false, 'fan', 'war');
gHi.attack = 999; gHi.defense = 999;
var itL = null;
(D.ITEMS || []).forEach(function (x) { if (x.type === 'rank_up' && x.from === 'fan') itL = x; });
var rHi = G.rankUpUse(gHi, itL);
console.log('  升档 ok=' + rHi.ok + '　攻防仍 = ' + gHi.attack + '/' + gHi.defense + '（期望 999/999，只补不削）');

console.log('\n══════ ⑤ 攻防成长口径（累积器修复后；期望≈10+99×0.4×grow）══════');
['fan', 'liang', 'ying', 'ming', 'tian'].forEach(function (rid) {
  var gg = G.makeGeneral('攻防' + rid, 1, 'idle', null, false, rid, 'balance');
  for (var i = 1; i < 100; i++) G.applyLevelGrowth(gg);
  console.log('  ' + rid.padEnd(6) + ' 升到 Lv100：attack=' + gg.attack + ' defense=' + gg.defense
    + '（base 10 + 99×0.4×grow=' + (99 * 0.4 * D.GEN_RANK_BY_ID[rid].grow) + ' ≈ '
    + (10 + 99 * 0.4 * D.GEN_RANK_BY_ID[rid].grow) + '）');
});

console.log('\n══════ ⑥ 速度 / 体力 的资质相关性 ══════');
['fan', 'tian'].forEach(function (rid) {
  var gg = G.makeGeneral('速' + rid, 200, 'idle', null, false, rid, 'balance');
  var aa = G.genAttrs(gg);
  console.log('  ' + rid + ' Lv200：spd=' + aa.spd + '（公式 floor((lv-1)/5)+10 —— 全资质一致？）'
    + ' staMax=' + aa.staMax + '（含 grow 因子）');
});

console.log('\n完成。');
process.exit(0);
