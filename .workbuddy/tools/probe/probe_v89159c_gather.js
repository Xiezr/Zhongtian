'use strict';
/* v89.159 探针 C：奖励入账唯一出口 addResCapped（复核轮抓出的真 bug）
   三态：① 存量超上限 → 一点都不加、不削存量；② 低于上限 → 加到上限为止；
        ③ 装不下的量能被报出来（trimmed）；④ 黄金不设上限。
   另：真调 finishGather（造一支 ready 的采集队）验证端到端。 */
var fs = require('fs'), path = require('path');
eval(fs.readFileSync('.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join('E:/Deepseekdb/js/', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: '探159c', cityName: '许都', region: '豫州', mapSeed: 20260959 });
var s = G.state, c = G.currentCity();
function P(tag, v) { console.log((v ? '  ✓ ' : '  ✗ ') + tag); return v; }

var cap = G.storeCapOf(c);
console.log('仓容 =', Math.round(cap));

console.log('\n=== ① 存量超上限：不加、不削 ===');
G.res(c).grain = cap + 123456;
var r1 = G.addResCapped('grain', 1000, c);
console.log('  →', JSON.stringify(r1));
P('存量不被削（仍是 cap+123456）', Math.round(G.res(c).grain) === Math.round(cap + 123456));
P('added = 0 · trimmed = 1000', r1.added === 0 && r1.trimmed === 1000);

console.log('\n=== ② 低于上限：加到上限为止 ===');
G.res(c).grain = cap - 300;
var r2 = G.addResCapped('grain', 1000, c);
console.log('  →', JSON.stringify(r2));
P('加了 300（补满）· 截掉 700', r2.added === 300 && r2.trimmed === 700);
P('正好到上限', Math.round(G.res(c).grain) === Math.round(cap));

console.log('\n=== ③ 富余时全额入账 ===');
G.res(c).grain = 0;
var r3 = G.addResCapped('grain', 500, c);
P('全进', r3.added === 500 && r3.trimmed === 0 && G.res(c).grain === 500);

console.log('\n=== ④ 黄金不设上限 ===');
G.res(c).gold = cap * 3;
var r4 = G.addResCapped('gold', 777, c);
P('黄金照加', r4.added === 777 && G.res(c).gold === cap * 3 + 777);

console.log('\n=== ⑤ 端到端：真调 finishGather（满仓态 · 老式将领带队记录形状） ===');
if (!s.map.grid) G.map.generate();             /* v89.159：地图惰性生成（实机同款坑） */
var t5 = null, tp5 = null;                       /* 找一块"有采集产出"的地形（plain 产 0） */
(function () {
  for (var y = 1; y < DATA.MAP_H - 1 && !tp5; y++) {
    for (var x = 1; x < DATA.MAP_W - 1 && !tp5; x++) {
      var t = G.map.tile(x, y);
      if (t && t.terrain !== 'city' && G.gatherResOf(t.terrain)) { t5 = { x: x, y: y }; tp5 = t.terrain; }
    }
  }
})();
console.log('  采集地形 =', tp5, JSON.stringify(t5));
var g5 = { id: 'g159', x: t5.x, y: t5.y, type: tp5,
  level: 5, elapsed: 999999, army: { minfu: 5000 }, genId: null, cityId: c.id };
s.gathers.push(g5);
G.res(c).grain = cap + 50000;                       /* 满仓之上 */
var before5 = G.res(c).grain;
var fin = G.finishGather('g159');
console.log('  收获 →', JSON.stringify(fin).slice(0, 260));
P('返回 ok', fin.ok === true);
P('满仓时收获不削存量（' + Math.round(before5) + ' → ' + Math.round(G.res(c).grain) + '）',
  G.res(c).grain >= before5 - 0.001);
P('trimmed 记录被截量 = ' + fin.trimmed, fin.trimmed === fin.amount);
P('收获明细写明「仓容已满…未入库」', /仓容已满/.test(fin.rewardText || ''));
console.log('  明细 =', fin.rewardText);
process.exit(0);
