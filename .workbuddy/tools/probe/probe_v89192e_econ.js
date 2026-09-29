/* v89.192 探针E：价值体系全盘（收入/消耗对账 + sink 充分性 + "花钱跳过"清单）
 * 数据源：30h 试玩档（中期真实规模）+ 当前价目表
 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA;

/* ---- 载入 30h 试玩档（中期真实规模） ---- */
var dir = path.join(R, '.workbuddy/tmp/playtest600');
var cands = [];
try {
  fs.readdirSync(dir).forEach(function (sub) {
    var f = path.join(dir, sub, 'final_state.json');
    try { if (fs.statSync(f).isFile()) cands.push({ f: f, m: fs.statSync(f).mtimeMs }); } catch (e) {}
  });
} catch (e) {}
cands.sort(function (a, b) { return b.m - a.m; });
var raw = null;
for (var i = 0; i < cands.length; i++) {
  try { raw = JSON.parse(fs.readFileSync(cands[i].f, 'utf8'));
    console.log('档: ' + cands[i].f); break; } catch (e) {}
}
if (!raw) { console.log('(无试玩档，跳过)'); process.exit(0); }
G.state = raw;

console.log('══════ A. 中期档（30h 试玩）规模 ══════');
var cities = raw.cities || [];
console.log('城数 =', cities.length, '· 将领 =', (raw.generals || []).length,
  '· 金 =', Math.round(raw.gold || 0));
var dayIncome = 0;
cities.forEach(function (c) {
  var y = G.cityDailyYield(c);
  var yg = (y && y.gold) || 0;
  dayIncome += yg;
  console.log('  ' + c.name + '（' + (c.type || 'self') + '）岁贡金/游戏日 = ' + Math.round(yg));
});
console.log('  ▶ 岁贡合计 / 游戏日 = ' + Math.round(dayIncome)
  + '　（×120 = 现实日 ' + Math.round(dayIncome * 120) + '）');

/* 俸禄 */
var sal = 0;
(raw.generals || []).forEach(function (g) {
  if (g.status === 'dead') return;
  sal += (G.salaryOf ? G.salaryOf(g) : 0) || 0;
});
console.log('  ▶ 将领月俸合计 / 游戏月 = ' + Math.round(sal)
  + '　（/30 ≈ ' + Math.round(sal / 30) + ' / 游戏日；×120/30 = 现实日 ' + Math.round(sal / 30 * 120) + '）');

/* 税所（前哨） */
var forts = Object.keys(raw.forts || {}).length;
console.log('  ▶ 前哨（税所）数 = ' + forts + '　→ 现实日 +' + (forts * 500));

console.log('');
console.log('══════ B. 主要金耗项（现值目） ══════');
/* B1 县城满配造价（金部分）——用影子城 */
var shadow = G.npcCityShadow ? G.npcCityShadow('county', 12) : null;
console.log('  [建造] 县城档满配（Lv12）总金耗 ≈ ' + (shadow && shadow.goldTotal ? Math.round(shadow.goldTotal) : '（无出口）'));

/* B2 募兵单价（各兵种 gold 成本） */
var rows = [];
Object.keys(D.TROOPS).forEach(function (id) {
  var t = D.TROOPS[id];
  if (t.craft) return;
  var c = t.cost || {};
  rows.push(id + ' 金' + (c.gold || 0) + ' 粮' + (c.grain || 0));
});
console.log('  [募兵单价] ' + rows.slice(0, 8).join(' | ') + ' …（共 ' + rows.length + ' 兵种）');

/* B3 治疗 10 金/兵 基准 */
console.log('  [治疗] 10 金/兵（v89.188 锚）—— 一场万人战役伤兵 5 千 ≈ 5 万金');

/* B4 加速（trainRush 三档 + 30% 封顶） */
if (D.TRAIN_RUSH) {
  console.log('  [加速] TRAIN_RUSH =', JSON.stringify(D.TRAIN_RUSH));
}
if (D.BOOST_CAP != null) console.log('  [加速封顶] BOOST_CAP =', D.BOOST_CAP);

/* B5 爵位晋升 */
if (D.RANKS) {
  var last = D.RANKS[D.RANKS.length - 2] || D.RANKS[D.RANKS.length - 1];
  console.log('  [爵位] 顶档晋升金 = ' + JSON.stringify(last && (last.cost || last.need || {})).slice(0, 120));
}

/* B6 商城主价目（取 gold 价格分布） */
var prices = [];
Object.keys(D.ITEMS || {}).forEach(function (id) {
  var it = D.ITEMS[id];
  if (it.price > 0 && !it.noShop) prices.push(it.price);
});
if (prices.length) {
  prices.sort(function (a, b) { return a - b; });
  var q = function (p) { return prices[Math.floor((prices.length - 1) * p)]; };
  console.log('  [商城] 在售 ' + prices.length + ' 件 · 价格分位 10%/50%/90%/max = '
    + q(0.1) + ' / ' + q(0.5) + ' / ' + q(0.9) + ' / ' + prices[prices.length - 1]);
}
/* 最贵 8 件 */
var top = Object.keys(D.ITEMS || {}).map(function (id) { return { id: id, n: D.ITEMS[id].name, p: D.ITEMS[id].price || 0 }; })
  .filter(function (x) { return x.p > 0; }).sort(function (a, b) { return b.p - a.p; }).slice(0, 8);
console.log('  [商城 top8] ' + top.map(function (x) { return x.n + '=' + x.p; }).join('　'));

/* B7 固定费用 */
console.log('  [设都] 改设 = 10 万金；[改名] 见面板价；[建城] BUILD_CITY_COST = '
  + JSON.stringify(D.BUILD_CITY_COST || {}));

console.log('');
console.log('══════ C. "金 → 跳过节流" 路径清单（老板：不能全部可跳） ══════');
var skips = [
  ['建造等待', 'boostBuildQueue / 快购（BOOST_CAP ' + D.BOOST_CAP + ' 封顶）'],
  ['募兵等待', 'boostTrainQueue / trainRush（10/20/30% 三档）'],
  ['研究等待', '有无金加速？'],
  ['行军', '无（不可跳过）'],
  ['伤兵自愈', '治疗 10 金/兵（金即疗，无等待）'],
  ['战斗', '无（必须真打）'],
  ['民心恢复', '措施（施粥）花金提速？'],
  ['将领等级', '经验道具（已撤等级限制 · v89.173 老板令）'],
];
skips.forEach(function (x) { console.log('  · ' + x[0] + ' → ' + x[1]); });

/* 检查"研究加速"是否存在 */
var hasResearchRush = /researchRush|studyRush|boostStudy/.test(fs.readFileSync(path.join(R, 'js/systems.js'), 'utf8'));
console.log('  [核查] 研究加速出口存在？ ' + hasResearchRush);

process.exit(0);
