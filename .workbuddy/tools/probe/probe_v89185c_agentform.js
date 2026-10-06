/* v89.185（老板 2 深化）：守将形态审计 —— 三类守将的"等级是否真转战力"实锤。
   疑点：wildDefenseAt / fortGuardOf 走 makeGeneral（四维=base 区间随机 + stamina 固定 100），
   等级似乎不转化为四维/体力；而 npcCityGuard 手写公式（四维按等级 + 无 stamina 字段=满体力）。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
G.newGame({ name: 'form', avatar: '🧔', gender: 'male', region: '碎垣' });
G.state.world.weather = 'clear';

function dumpGuard(tag, g) {
  if (!g) { console.log('  ' + tag + '：null'); return; }
  var a = G.genAttrs(g);
  var st = G.staNow(g), sm = G.staMax(g);
  console.log('  ' + tag + '：' + g.name + ' Lv' + g.level + ' 资质=' + g.rank
    + ' | 四维 统' + a.tong + '/勇' + a.yw + '/智' + a.zm + '/内' + a.nz
    + ' | 体 ' + Math.round(st) + '/' + Math.round(sm) + '（stamina字段=' + JSON.stringify(g.stamina) + '）'
    + ' | hpMult=×' + (1 + G.staHpBonus(g)).toFixed(3));
}

console.log('====== 一、现状三类守将的真实形态 ======');
console.log('▶ 野地（wildDefenseAt · 取 Lv3 / Lv7 / Lv10）');
[3, 7, 10].forEach(function (lv) {
  var wd = G.wildDefenseAt(210 + lv, 260, lv);
  dumpGuard('野地Lv' + lv + (wd.gen ? '' : '（今日无将）'), wd.gen);
});
console.log('▶ 据点（fortGuardOf · Lv3 / Lv7 / Lv10）');
[3, 7, 10].forEach(function (lv) {
  dumpGuard('据点Lv' + lv, G.fortGuardOf({ x: 11, y: 12, level: lv }));
});
console.log('▶ 名城（npcCityGuard · 县城/郡城/州城/都城）');
['county', 'jun', 'zhou', 'capital'].forEach(function (tp) {
  dumpGuard('名城' + tp, G.npcCityGuard({ id: 'nc_' + tp, type: tp, level: 10, name: '测' }));
});

console.log('');
console.log('====== 二、实锤：守将加成在引擎里的实际生效值 ======');
function simDef(atk, def, dg) {
  var env = T.begin(JSON.parse(JSON.stringify(atk)), null, JSON.parse(JSON.stringify(def)), 0, dg, {});
  var u0 = env.units.def[0];
  return { hpPer: u0 ? u0.hpPer : null, atkPct: u0 ? u0.atkPct : null, defPct: u0 ? u0.defPct : null,
    cover: u0 ? u0.cover : null, id: u0 ? u0.id : null };
}
var armyA = { changqiang: 4000 };
var armyD = { qingji: 4000 };
var noG = simDef(armyA, armyD, null);
console.log('  无将对照：守军 ' + noG.id + ' hpPer=' + noG.hpPer + ' atkPct=' + (noG.atkPct * 100).toFixed(2) + '% cover=' + (noG.cover || 0).toFixed(2));
var wd10 = G.wildDefenseAt(214, 260, 10);
if (wd10.gen) {
  var wG = simDef(armyA, armyD, wd10.gen);
  console.log('  野地将(Lv' + wd10.gen.level + ')：守军 hpPer=' + wG.hpPer + ' atkPct=' + (wG.atkPct * 100).toFixed(2) + '% cover=' + (wG.cover || 0).toFixed(2));
}
var ft10 = G.fortGuardOf({ x: 11, y: 12, level: 10 });
var fG = simDef(armyA, armyD, ft10);
console.log('  据点将(Lv' + ft10.level + ')：守军 hpPer=' + fG.hpPer + ' atkPct=' + (fG.atkPct * 100).toFixed(2) + '% cover=' + (fG.cover || 0).toFixed(2));
var nc = G.npcCityGuard({ id: 'nc_t', type: 'county', level: 10, name: '测' });
var nG = simDef(armyA, armyD, nc);
console.log('  名城将(Lv' + nc.level + ')：守军 hpPer=' + nG.hpPer + ' atkPct=' + (nG.atkPct * 100).toFixed(2) + '% cover=' + (nG.cover || 0).toFixed(2));
/* 等级与加成的相关性（野地 5 档） */
console.log('');
console.log('====== 三、等级 vs 实际加成（野地 5/7/9 档 · 说明"等级空转"）======');
[5, 7, 9].forEach(function (lv) {
  var wd = G.wildDefenseAt(230 + lv, 270, lv);
  if (!wd.gen) { console.log('  Lv' + lv + '：今日无将'); return; }
  var r = simDef({ changqiang: 3000 }, { qingji: 3000 }, wd.gen);
  console.log('  野地Lv' + lv + ' 守将 Lv' + wd.gen.level + '（' + wd.gen.rank + '）→ 守军 hpPer ' + r.hpPer
    + '（对照无将 ' + noG.hpPer + '）· atkPct ' + (r.atkPct * 100).toFixed(2) + '%');
});
process.exit(0);
