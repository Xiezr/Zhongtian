/* v89.195 探针D：攻防补发 + 守将防顶穿 综合验证
   ① 老档将（attack=10 · Lv60 凡品 · 无 atkAcc）→ rankOf → 补发到 34（10+59×0.4）
   ② 补发幂等（连续多次 rankOf 值不变）；已高于标准线的只补不削
   ③ 守将防顶穿：野地/据点守将（guardFillOf 定值）→ 再调 rankOf → 攻防不被顶到满量线
   ④ 名城守将：attack 仍 undefined（保持既有口径 0）
   ⑤ 玩家升级链：累积器长期均值 = 0.4×成长值 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '探针D', region: '烬环' });
if (!G.state.map.grid) G.map.generate();
var s = G.state, c0 = s.cities[0];

console.log('══════ ① 老档补发 ══════');
var gOld = G.makeGeneral('老将', 60, 'idle', c0.id, false, 'fan', 'balance');
delete gOld.atkAcc; delete gOld.defAcc;
gOld.attack = 10; gOld.defense = 10;
var rkO = G.rankOf(gOld);
var stdO = Math.round(10 + 59 * 0.4 * rkO.grow);
console.log('  fan Lv60 老将补发后：atk=' + gOld.attack + ' def=' + gOld.defense + '（期望 ' + stdO + '）'
  + '　atkAcc=' + gOld.atkAcc);

console.log('\n══════ ② 幂等 / 只补不削 ══════');
G.rankOf(gOld); G.rankOf(gOld); G.rankOf(gOld);
console.log('  连续 3 次 rankOf：atk=' + gOld.attack + ' def=' + gOld.defense + '（应不变）');
var gHi = G.makeGeneral('高将', 60, 'idle', c0.id, false, 'fan', 'balance');
delete gHi.atkAcc; gHi.attack = 500; gHi.defense = 600;
G.rankOf(gHi);
console.log('  高值将（500/600）：atk=' + gHi.attack + ' def=' + gHi.defense + '（应保持 500/600，只补不削）');

console.log('\n══════ ③ 守将防顶穿 ══════');
/* 野地守将：找一个确定性"有守将"的（扫格） */
var wd = null;
for (var yy = 10; yy < 60 && !wd; yy++) {
  for (var xx = 10; xx < 60 && !wd; xx++) {
    var w = G.wildDefenseAt(xx, yy, 8);
    if (w && w.gen) wd = w;
  }
}
if (wd) {
  var wg = wd.gen;
  var a1 = wg.attack;
  G.rankOf(wg); G.rankOf(wg);   /* 再多次 rankOf（模拟 UI 读） */
  console.log('  野地守将（' + wg.name + ' Lv' + wg.level + ' ' + wg.rank + '）：'
    + 'atk=' + wg.attack + '（首次 ' + a1 + '，应不变）'
    + '　npcGuard=' + !!wg.npcGuard + ' wild=' + !!wg.wild);
}
/* 据点守将 */
var fg = G.fortGuardOf({ x: 30, y: 30, level: 8, name: '测据点' });
var b1 = fg.attack;
G.rankOf(fg); G.rankOf(fg);
console.log('  据点守将（' + fg.name + ' Lv' + fg.level + ' ' + fg.rank + '）：'
  + 'atk=' + fg.attack + '（首次 ' + b1 + '，应不变）　npcGuard=' + !!fg.npcGuard);
/* 名城守将 */
var ng = G.npcCityGuard({ id: 'testcity', type: 'jun', x: 0, y: 0 });
G.rankOf(ng);
console.log('  名城守将（' + ng.name + ' Lv' + ng.level + '）：attack=' + ng.attack
  + '（应 undefined，保持既有口径）　npcGuard=' + !!ng.npcGuard);

console.log('\n══════ ④ 守将攻防 = 折损公式（对照）══════');
if (wd) {
  var wg2 = wd.gen;
  var rkG = G.rankOf(wg2);
  var expA = Math.round(10 + (wg2.level - 1) * 0.4 * rkG.grow * 0.25);
  console.log('  野地守将期望 atk = round(10 + (Lv-1)×0.4×grow×0.25) = ' + expA + '　实际 ' + wg2.attack);
}

console.log('\n══════ ⑤ 玩家升级链累积器均值 ══════');
['fan', 'liang', 'ying', 'ming', 'tian'].forEach(function (rid) {
  var gg = G.makeGeneral('均' + rid, 1, 'idle', c0.id, false, rid, 'balance');
  gg.attack = 10; gg.defense = 10;
  for (var i = 1; i <= 200; i++) G.applyLevelGrowth(gg);
  var exp = 10 + 200 * 0.4 * D.GEN_RANK_BY_ID[rid].grow;
  console.log('  ' + rid.padEnd(6) + ' 升 200 级：atk=' + gg.attack + '（期望 ≈ ' + exp + '，差 ' + (gg.attack - exp) + '）');
});

console.log('\n完成。');
process.exit(0);
