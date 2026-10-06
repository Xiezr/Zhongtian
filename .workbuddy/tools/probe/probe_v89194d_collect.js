/* v89.194 探针D：藏珍阁（S3 收藏）行为验证
   ① 数据表规模：18 系列 / 71 件 / id 唯一 / 与 ITEMS 零冲突
   ② 购买：扣金 / 入藏 / 重复拒 / 金不足拒（不扣金）
   ③ 集齐：系列声望入账 + 日志 + 编年史
   ④ 全收集：allRep 幂等（再买不发）
   ⑤ 一键集齐：预检总价 / 逐件走同一出口 / 已集齐拒
   ⑥ 统计出口：collectStatOf 与卡片口径 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '藏珍阁', region: '烬环' });
var s = G.state;

console.log('══════ ① 数据表规模 ══════');
var C = D.COLLECT;
var nItems = 0, ids = {}, dup = [], total = 0;
(C.series || []).forEach(function (sr) {
  (sr.items || []).forEach(function (it) {
    nItems++; total += it.price || 0;
    if (ids[it.id]) dup.push(it.id);
    ids[it.id] = 1;
  });
});
console.log('  系列 ' + C.series.length + ' / 藏品 ' + nItems + ' 件 / 重复 id ' + dup.length);
console.log('  总价 ' + U.fmt(total) + ' 金（≈ ' + (total / 2540000).toFixed(1) + ' 日满编月俸的量级参照）');
var clash = (D.ITEMS || []).filter(function (it) { return ids[it.id]; });
console.log('  与 ITEMS 冲突 ' + clash.length + '（须为 0）');
/* 系列内与系列间 id 唯一、price>0 */
var badPrice = [];
(C.series || []).forEach(function (sr) {
  (sr.items || []).forEach(function (it) { if (!(it.price > 0)) badPrice.push(it.id); });
});
console.log('  price≤0 的件 ' + badPrice.length + '（须为 0）');

console.log('\n══════ ② 购买（真调 collectBuy）══════');
G.goldAdd(1000000 - G.goldOf());
var it1 = C.series[0].items[0];
var gold0 = G.goldOf();
var r1 = G.collectBuy(it1.id);
console.log('  买「' + it1.name + '」：ok=' + r1.ok + ' 金 ' + gold0 + ' → ' + G.goldOf() + '（应 -' + it1.price + '）');
console.log('  已藏 = ' + G.collectHaveOf(it1.id));
var r2 = G.collectBuy(it1.id);
console.log('  重复买：ok=' + r2.ok + ' msg=' + r2.msg);
G.goldAdd(-G.goldOf());
var r3 = G.collectBuy(C.series[0].items[1].id);
console.log('  金不足：ok=' + r3.ok + ' msg=' + r3.msg + '（金 = ' + G.goldOf() + '，须 0）');

console.log('\n══════ ③ 集齐系列 ══════');
G.goldAdd(10000000 - G.goldOf());
var rep0 = s.rep || 0;
var sr1 = C.series[0];   /* 曹魏五子良将 rep 240 */
sr1.items.forEach(function (it) { if (!G.collectHaveOf(it.id)) G.collectBuy(it.id); });
var d1 = G.collectSeriesDoneOf(sr1.id);
console.log('  ' + sr1.name + '：' + d1.have + '/' + d1.total + ' done=' + d1.done
  + ' 声望 ' + rep0 + ' → ' + (s.rep || 0) + '（应 +' + sr1.rep + '）');
var chron = (s.story && s.story.chronicle) ? s.story.chronicle.length : -1;
console.log('  编年史条数 = ' + chron + '（应 ≥1，含成系列记录）');

console.log('\n══════ ④ 全收集与幂等 ══════');
/* 把其余系列全买下 */
(C.series || []).forEach(function (sr) {
  (sr.items || []).forEach(function (it) { if (!G.collectHaveOf(it.id)) G.collectBuy(it.id); });
});
G.goldAdd(100000000 - G.goldOf());
var st1 = G.collectStatOf();
console.log('  全收集：' + st1.have + '/' + st1.total + ' 系列 ' + st1.seriesDone + '/' + st1.seriesTotal);
var repA = s.rep || 0;
/* 再买一件已藏（触发一次 collectBuy 走重复分支）→ allRep 不应再发 */
var rRepeat = G.collectBuy(sr1.items[0].id);
console.log('  已藏复购被拒 = ' + (rRepeat.ok === false) + ' · 声望未变 = ' + (repA === (s.rep || 0)));
console.log('  allBonus 标记 = ' + s.collectAllBonus + '（须 1）');

console.log('\n══════ ⑤ 一键集齐 ══════');
G.newGame({ name: '一键', region: '烬环' });
var s2 = G.state, C2 = D.COLLECT;
G.goldAdd(5000000 - G.goldOf());
var sr2 = C2.series[12];  /* 三国奇女子 4 件 ×15万 = 60万 */
var rSer = G.collectBuySeries(sr2.id);
var dSer = G.collectSeriesDoneOf(sr2.id);
console.log('  一键集齐「' + sr2.name + '」：ok=' + rSer.ok + ' 买 ' + rSer.bought + ' 件 耗 ' + U.fmt(rSer.cost)
  + ' 完成度 ' + dSer.have + '/' + dSer.total);
var rSer2 = G.collectBuySeries(sr2.id);
console.log('  再点：ok=' + rSer2.ok + ' msg=' + rSer2.msg);
G.goldAdd(-G.goldOf());
var rSer3 = G.collectBuySeries(C2.series[1].id);
console.log('  金不足预检：ok=' + rSer3.ok + ' msg=' + rSer3.msg);
console.log('  未买半套（' + G.collectSeriesDoneOf(C2.series[1].id).have + '/'
  + G.collectSeriesDoneOf(C2.series[1].id).total + '，须 0/5）');

console.log('\n完成。');
process.exit(0);
