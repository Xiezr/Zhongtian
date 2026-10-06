/* v89.188 批次 B 验证探针：税所新口径（现实日·固定500）+ 城主税封顶 + 书价表 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;

console.log('===== ① 税所：首期登记 → 拨钟 2 日 → 幂等 =====');
G.newGame({ name: 't188', avatar: '🧔', gender: 'male', region: '碎垣' });
var st = G.state;
st.forts = { '50,50': { x: 50, y: 50, lv: 5, name: '甲' }, '51,51': { x: 51, y: 51, lv: 3, name: '乙' } };
st.fortTaxDay = null;
var g0 = G.state.gold;
var first = G.fortTaxSettle();
console.log('  首期调用 = ' + JSON.stringify(first) + '（期望 null）· 锚=' + st.fortTaxDay + '（=今日 ' + G.questDayIndex() + '）');
st.fortTaxDay = G.questDayIndex() - 2;
var r = G.fortTaxSettle();
var g1 = G.state.gold;
console.log('  拨钟 2 日 = ' + JSON.stringify(r) + '（期望 gold=2000 · 2处×500×2日）· 金变化 ' + (g1 - g0));
var again = G.fortTaxSettle();
console.log('  幂等重调 = ' + JSON.stringify(again) + '（期望 null）');
/* 等级无关性：把等级改掉应不影响 */
st.forts['50,50'].lv = 1; st.forts['51,51'].lv = 10;
st.fortTaxDay = G.questDayIndex() - 1;
var r2 = G.fortTaxSettle();
console.log('  等级无关（lv 1 与 10 混合）= ' + JSON.stringify(r2) + '（期望 gold=1000）');

console.log('\n===== ② 城主税封顶 =====');
var c = st.cities[0];
st.generals.forEach(function (gg) { gg.status = 'idle'; gg.cityId = null; });
var g0s = st.generals[0];
[100, 300, 500, 733, 1000, 1400].forEach(function (nz) {
  g0s.nz = nz; g0s.cityId = c.id; g0s.status = 'mayor'; g0s.loyalty = 100;
  var mb = G.mayorBonus(c);
  console.log('  内政 ' + String(nz).padEnd(5) + ' → 税 +' + Math.round(mb.tax * 100) + '%　（产量 +' + Math.round(mb.prod * 100) + '% · 不同通道）');
});
st.generals.forEach(function (gg) { gg.status = 'idle'; gg.cityId = null; });

console.log('\n===== ③ 满配内政（1400）实调 cityProdPerSec =====');
g0s.nz = 1400; g0s.cityId = c.id; g0s.status = 'mayor'; g0s.loyalty = 100;
var mbT = G.mayorBonus(c).tax;
console.log('  mayorBonus.tax = +' + Math.round(mbT * 100) + '%（封顶 200 期望 200）');
var taxRow = G.prodBreakdown('gold', c).filter(function (x) { return x.name === '城主内政'; })[0];
console.log('  分解行（城主内政）值 = ' + (taxRow ? taxRow.val.toFixed(1) : '(无)') + '（应 >0，与 200% 同层）');

console.log('\n===== ④ 伤兵书价（表值） =====');
['qingnangshu', 'xuming_shu', 'yisheng_shu'].forEach(function (id) {
  var it = DATA.ITEMS.filter(function (x) { return x.id === id; })[0];
  console.log('  ' + it.name + '：' + it.price + ' 金 · eff.wound=' + it.eff.wound + ' · ' + (it.price / (it.eff.wound * 100)).toFixed(1) + ' 金/pp');
});

process.exit(0);
