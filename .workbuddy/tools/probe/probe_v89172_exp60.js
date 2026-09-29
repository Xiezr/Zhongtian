/* v89.172 探针：1-60 级总经验（老板问「1-60级总经验要多少」）
   口径：全部走唯一出口 DATA.expCumOf / GAME.expNeedOf，不自行复算。
   附：经验道具 11 档面额与 expCumOf(capLv) 对账（v89.171 的口径） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var C = DATA.EXP_CURVE;
console.log('=== 曲线参数（DATA.EXP_CURVE）===');
console.log('topLv=' + C.topLv + '  needTop=' + C.needTop + '  alpha=' + C.alpha + '  total(1..240)=' + C.total);
console.log('');

console.log('=== 1..60 逐级：单级需求（升到下一级）与累计（从 Lv1 起）===');
for (var lv = 1; lv <= 60; lv++) {
  var need = G.expNeedOf({ level: lv });
  var cum = DATA.expCumOf(lv);
  console.log('Lv' + lv + ' → ' + (lv + 1) + '  需 ' + U.numText(need, 0)
    + '   累计(1→' + lv + ') = ' + U.numText(cum, 0));
}
console.log('');

var cum60 = DATA.expCumOf(60);
console.log('=== 汇总（唯一出口直读）===');
console.log('A. Lv1 → Lv60 累计（升 59 次）      = ' + U.numText(cum60, 0));
console.log('B. 含 60→61 的 1..60 单级需求之和  = ' + U.numText(DATA.expCumOf(61), 0));
console.log('C. 59 → 60 单级需求               = ' + U.numText(G.expNeedOf({ level: 59 }), 0));
console.log('D. 1 → 2 单级需求                 = ' + U.numText(G.expNeedOf({ level: 1 }), 0));
console.log('E. cum60 占全曲线 total 的比例     = ' + (cum60 / C.total * 100).toFixed(2) + '%');
console.log('');

console.log('=== 经验道具 11 档面额对账（amount 应 === expCumOf(capLv)）===');
DATA.EXP_ITEM_SPEC.forEach(function (sp) {
  var it = null;
  DATA.ITEMS.forEach(function (x) { if (x.id === sp.id) it = x; });
  var exp = DATA.expCumOf(sp.capLv);
  var ok = it && it.amount === exp;
  console.log((ok ? '  ✅ ' : '  ❌ ') + sp.name + '（capLv ' + sp.capLv + '·价 ' + sp.price + '金）'
    + ' amount=' + (it ? U.numText(it.amount, 0) : 'MISS') + '  expCumOf=' + U.numText(exp, 0));
});

process.exit(0);
