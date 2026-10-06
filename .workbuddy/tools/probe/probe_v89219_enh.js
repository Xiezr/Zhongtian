var path = require('path'), fs = require('fs'); var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA;
G.newGame({ name: '强化验收', region: '烬环', mapSeed: 20261019 });

/* ---------- ① 悬停口径：白=原始 / 金=增量（老板 2） ---------- */
var hi = { u: 99001, id: 'yt_sword', enh: 10 };
var lo = { u: 99002, id: 'yt_sword', enh: 0 };
var R10 = G.equipStatRowsOf(hi), R0 = G.equipStatRowsOf(lo);
var atk = R10.filter(function (r) { return r.k === 'atk'; })[0];
console.log('① yt_sword atk: base=' + atk.base + ' val=' + atk.val + ' add=' + atk.add
  + ' · add/base=' + (atk.add / atk.base * 100).toFixed(1) + '%（应 80.0%）');
var html = G.ui.equipStatsHTML(hi);
console.log('   悬停白字含 base(' + atk.base + ')?', html.indexOf('>' + atk.base + '<') >= 0,
  '| 金增量含 +' + atk.add + '?', html.indexOf('+' + atk.add) >= 0,
  '| 现值 ' + atk.val + ' 不再出现在白字?', html.indexOf('>' + atk.val + '<') < 0);
console.log('   脚注:', G.ui.equipEnhNoteHTML(hi).replace(/<[^>]*>/g, ''));
console.log('   未强化件（+0）渲染:', G.ui.equipStatsHTML(lo).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 90));

/* ---------- ② 套装件盘点 ---------- */
var bySet = {};
Object.keys(D.EQUIP).forEach(function (k) {
  var it = D.EQUIP[k];
  if (it.set && !it.ling) (bySet[it.set] = bySet[it.set] || []).push(k);
});
console.log('② 套装:', Object.keys(bySet).map(function (s) {
  return s + '(' + (D.SETS[s] ? D.SETS[s].name : '?') + ' ×' + bySet[s].length + ')';
}).join(' '));

/* ---------- ③ 整套强化：真调 ---------- */
var c = G.currentCity();
var idx = c.cells.findIndex(function (x) { return !x.build && !x.official; });
if (idx >= 0) c.cells[idx].build = { id: 'tiejiangpu', lvl: 3 };
console.log('③ 锻造间等级 =', G.forgeLevel());
G.state.res.gold = 1e9; G.state.res.iron = 1e9; G.state.res.stone = 1e9;

var setId = Object.keys(bySet)[0];
var ids = bySet[setId].slice(0, 3).concat(bySet[setId].slice(0, 3));
var pe = G.addEquip(bySet[setId][0], 0), pb = G.addEquip(bySet[setId][1], 0), pc = G.addEquip(bySet[setId][2], 0);
var info = G.enhSetInfoOf(setId);
console.log('   套装 ' + setId + '（' + info.def.name + '）：拥有 ' + info.all.length + ' 件 · 可升 ' + info.todo.length
  + ' 件 · 总价 ' + G.costString(info.cost));
var g0 = G.state.res.gold, i0 = G.state.res.iron, s0 = G.state.res.stone;
var r1 = G.enhanceSet(setId);
console.log('   整套 +1 →', r1.ok, '|', r1.msg);
console.log('   三件等级:', G.eqEnhOf(pe), G.eqEnhOf(pb), G.eqEnhOf(pc),
  '| 金 ' + g0 + '→' + G.state.res.gold + '（差 ' + (g0 - G.state.res.gold) + '，总价 ' + r1.cost.gold + '）',
  '| 铁差 ' + (i0 - G.state.res.iron) + '/' + r1.cost.iron, '| 石差 ' + (s0 - G.state.res.stone) + '/' + r1.cost.stone);

/* 资材不足 → 整体不动 */
G.state.res.gold = 10; G.state.res.iron = 10; G.state.res.stone = 10;
var lvBefore = [G.eqEnhOf(pe), G.eqEnhOf(pb), G.eqEnhOf(pc)];
var r2 = G.enhanceSet(setId);
console.log('   资材不足 →', r2.ok, '|', r2.msg, '| 等级未动:', String([G.eqEnhOf(pe), G.eqEnhOf(pb), G.eqEnhOf(pc)] === String(lvBefore)));

/* 满级件跳过：把一件顶满 */
G.state.res.gold = 1e9; G.state.res.iron = 1e9; G.state.res.stone = 1e9;
pe.enh = G.enhMax();
var info2 = G.enhSetInfoOf(setId);
console.log('   一件满级后：可升件数 =', info2.todo.length, '（应为 ' + (info2.all.length - 1) + '）');
var r3 = G.enhanceSet(setId);
console.log('   再整套 →', r3.ok, '| 满级件不动:', pe.enh === G.enhMax(), '| 其余 +1:', G.eqEnhOf(pb), G.eqEnhOf(pc));

/* 单件套（只有 1 件）→ UI 不该给整套键（DOM 判据放 e2e；这里验数据面） */
var solo = 'yitian';
console.log('④ 单件场景数据面：', JSON.stringify({ all: G.enhSetInfoOf(solo) ? G.enhSetInfoOf(solo).all.length : null }));

/* ---------- ⑤ 长按出口形态 ---------- */
console.log('⑤ ui.HOLD_ACTS =', JSON.stringify(G.ui.HOLD_ACTS), '| holdStart=', typeof G.ui.holdStart,
  '| holdStop=', typeof G.ui.holdStop, '| HOLD_DELAY=' + G.ui.HOLD_DELAY, 'HOLD_EVERY=' + G.ui.HOLD_EVERY);
process.exit(0);
