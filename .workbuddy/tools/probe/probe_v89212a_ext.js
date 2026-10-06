/* v89.212（老板 1）：「城外资源建筑并未提供准确储存上限……各资源地块数量不同，
   但是最终储存上限一样，应该是地块多的存的多吧」
   —— 目标态探针：城外堆场**按资源分账**（农田只堆粮 / 林场只堆木……）。
   同一支脚本：改前跑红（缺陷实证）/ 改后全绿（翻转证据）。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
var BASE = DATA.BASE_STORE, DIV = DATA.EXT_STORE_DIV;   /* 200万 / 6 */
var U1 = Math.round(BASE / DIV);                        /* 单块 Lv1 = 33.33 万 */

var st = G.newGame({ name: 'p212', cityName: '许都', mapSeed: 212 });
G.state = st;
var s = G.state;

/* 造自定义外城地块的城（替换默认 12 格为给定清单） */
function mkCity(id, exts) {
  var c = G.makeCity({ id: id, name: id, col: 6, row: 6 });
  s.cities.push(c);
  var g = G.extGridOf(c);
  g.length = 0;
  exts.forEach(function (t, i) {
    if (typeof t === 'string') g.push({ id: 'x' + i, type: t, lv: 1 });
    else g.push({ id: 'x' + i, type: t.type, lv: t.lv });
  });
  return c;
}
function capK(c, k) { return G.storeCapOf(c, k); }

/* ============ ① 首城基线（2田1木1石1铁 · 全 Lv1）============ */
console.log('=== ① 首城基线（初始模板 2田1木1石1铁）===');
var c0 = s.cities[0];
var sp0 = G.storePartsOf(c0);
console.log('    base=' + sp0.base + '  ext=' + sp0.ext + '  total=' + sp0.total + '  lv=' + sp0.lv);
console.log('    extByRes=' + JSON.stringify(sp0.extByRes || '(缺)'));
console.log('    capByRes=' + JSON.stringify(sp0.capByRes || '(缺)'));
chk('①a storePartsOf 含 extByRes（按资源分账）', !!sp0.extByRes && typeof sp0.extByRes === 'object',
  JSON.stringify(sp0.extByRes));
chk('①b storePartsOf 含 capByRes（各资源实际上限）', !!sp0.capByRes && typeof sp0.capByRes === 'object',
  JSON.stringify(sp0.capByRes));
if (sp0.extByRes) {
  /* 首城：田2 → 粮 ext=round(2×BASE/DIV)；木1石1铁各 round(1×BASE/DIV)
     （取整在"该类等级和"上做一次 —— 不是逐块取整再相加） */
  chk('①c 首城分账值：粮 ext = round(2×底) · 木/石/铁各 = round(1×底)',
    sp0.extByRes.grain === Math.round(2 * BASE / DIV) && sp0.extByRes.wood === Math.round(1 * BASE / DIV)
    && sp0.extByRes.stone === Math.round(1 * BASE / DIV) && sp0.extByRes.iron === Math.round(1 * BASE / DIV),
    JSON.stringify(sp0.extByRes) + ' want=' + Math.round(2 * BASE / DIV));
  chk('①d 粮上限 > 木上限（农田多 → 粮存得多）',
    capK(c0, 'grain') > capK(c0, 'wood'),
    'grain=' + capK(c0, 'grain') + ' wood=' + capK(c0, 'wood'));
}

/* ============ ② 地块多存得多（A/B 交叉对照）============ */
console.log('=== ② 地块多存得多（4田1木 vs 1田4木）===');
var cA = mkCity('p212a', ['farm', 'farm', 'farm', 'farm', 'forest']);
var cB = mkCity('p212b', ['farm', 'forest', 'forest', 'forest', 'forest']);
var aGrain = capK(cA, 'grain'), aWood = capK(cA, 'wood');
var bGrain = capK(cB, 'grain'), bWood = capK(cB, 'wood');
console.log('    A(4田1木): 粮=' + aGrain + ' 木=' + aWood);
console.log('    B(1田4木): 粮=' + bGrain + ' 木=' + bWood);
chk('②a A 城粮上限 > B 城粮上限（田多）', aGrain > bGrain, aGrain + ' vs ' + bGrain);
chk('②b B 城木上限 > A 城木上限（林多）', bWood > aWood, bWood + ' vs ' + aWood);
chk('②c 期望值锚定：A 粮 = base + 4×单块 · A 木 = base + 1×单块',
  aGrain === BASE + Math.round(4 * BASE / DIV) && aWood === BASE + Math.round(1 * BASE / DIV),
  aGrain + '/' + (BASE + Math.round(4 * BASE / DIV)) + '  ' + aWood + '/' + (BASE + Math.round(1 * BASE / DIV)));

/* ============ ③ 按资源封顶（tickOnce 行为 · 交叉场景）============ */
console.log('=== ③ 按资源封顶（tickOnce 实跑 · 各资源各用自己的上限）===');
var cC = mkCity('p212c', [{ type: 'farm', lv: 6 }, { type: 'forest', lv: 12 }]);
/* C 城：粮 ext = 6×U1 = 200万 → 粮 cap 400万；木 ext = 12×U1 = 400万 → 木 cap 600万。
   设 粮=450万（超自身 cap · 应不涨）、木=500万（低于自身 cap · 应涨）。 */
var Rc = G.res(cC);
Rc.grain = 4500000; Rc.wood = 5000000;
var g0 = Rc.grain, w0 = Rc.wood;
for (var t = 0; t < 120; t++) G.tickOnce();
var gD = Rc.grain - g0, wD = Rc.wood - w0;
console.log('    粮 450万→' + Math.round(Rc.grain) + '（Δ' + Math.round(gD) + '）· 木 500万→' + Math.round(Rc.wood) + '（Δ' + Math.round(wD) + '）');
console.log('    C 城 cap：粮=' + capK(cC, 'grain') + ' 木=' + capK(cC, 'wood'));
chk('③a 粮超自身上限（450万 > 400万）→ 不涨（只封增长不削存量）', gD <= 2, 'Δ=' + gD);
chk('③b 木低于自身上限（500万 < 600万）→ 正常增长', wD > 1, 'Δ=' + wD);
chk('③c 两资源上限不同（粮 400万 ≠ 木 600万）',
  capK(cC, 'grain') !== capK(cC, 'wood'),
  capK(cC, 'grain') + ' vs ' + capK(cC, 'wood'));

/* ============ ④ 单块贡献口径不变（回归）============ */
console.log('=== ④ 单块贡献（回归：仍是同级仓容 1/6）===');
chk('④a 单块 Lv12 = 400万（口径不变）',
  G.extStoreCapOneOf({ type: 'farm', lv: 12 }) === 4000000,
  String(G.extStoreCapOneOf({ type: 'farm', lv: 12 })));
chk('④b 未建地块不计', G.extStoreCapOneOf({ type: null, lv: 24 }) === 0);
chk('④c extStoreCapOf 无 key = 四类合计（兼容口径保留）',
  G.extStoreCapOf(cC) === Math.round(18 * BASE / DIV),
  G.extStoreCapOf(cC) + ' vs ' + Math.round(18 * BASE / DIV));

/* ============ ⑤ 逾溢折损按资源（唯一出口同源）============ */
console.log('=== ⑤ 逾溢判定按资源 ===');
var rows0 = G.overflowRotOf(cC);   /* 粮 450万 > 400万 → 应报粮；木 500万 < 600万 → 不报 */
var ks = rows0.map(function (x) { return x.k; });
console.log('    超出清单：' + JSON.stringify(rows0.map(function (x) { return x.k + ':' + Math.round(x.excess); })));
chk('⑤a 仅粮报超出（超自身 cap），木不在列', ks.indexOf('grain') >= 0 && ks.indexOf('wood') < 0, JSON.stringify(ks));

console.log('');
console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
