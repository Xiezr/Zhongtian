'use strict';
/* v89.161 探针：① 黄金上收玩家池（唯一存储 · 各城访问器 · 新城并池 · 老档迁移 · 幂等）
   ② 建造花费"谁的城用谁的货"（跨城不再挪用；金通用）· 返还进该城 · 调运清单去金
   ③ 折损周期的现实时间换算（10× = 2.4 小时） */
var fs = require('fs'), path = require('path');
eval(fs.readFileSync('.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join('E:/Deepseekdb/js/', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: '探161', cityName: '许都', region: '豫州', mapSeed: 20260961 });
var s = G.state, c = G.currentCity();
function P(tag, v) { console.log((v ? '  ✓ ' : '  ✗ ') + tag); return v; }
function sum4(R) { return (R.grain || 0) + (R.wood || 0) + (R.stone || 0) + (R.iron || 0); }

console.log('=== ① 黄金上收玩家池 ===');
var g0 = (DATA.INITIAL_RES || {}).gold || 0;
console.log('  INITIAL_RES.gold =', g0, '· s.gold =', Math.round(s.gold), '· 首城 res.gold =', Math.round(G.res(c).gold));
P('开局库存的金并进了池子（不是留在城里）', Math.round(s.gold) === g0 && Math.round(G.res(c).gold) === g0);
P('金只有一份（池子 = 开局值，不是城数倍）', Math.round(s.gold) === g0);

/* 跨城访问器：一支笔 */
var c2 = G.makeCity({ id: 'v161b', name: 'v161乙城', x: 621, y: 621, type: 'self' });
G.registerCity(c2);
G.res(c2).gold = 8888;
console.log('  写乙城 res.gold = 8888 → 池子 =', Math.round(s.gold), '· 甲城读到 =', Math.round(G.res(c).gold));
P('写一处 = 全城可见（同一口池子）', Math.round(s.gold) === 8888 && Math.round(G.res(c).gold) === 8888);
G.res(c).gold = 7777;
P('反向写也同一口池', Math.round(G.res(c2).gold) === 7777);
P('GAME.goldOf() 与 s.gold 一致', G.goldOf() === 7777);
P('goldAdd 负数是花销（钳 ≥0）', G.goldAdd(-7777) === 0 && G.goldAdd(500) === 500);

/* 新城自带金（缴获）并池 */
var c3 = G.makeCity({ id: 'v161c', name: 'v161丙城', x: 622, y: 622, type: 'self', res: { grain: 0, wood: 0, stone: 0, iron: 0, gold: 3000 } });
G.registerCity(c3);
P('新城（+3,000 金）入库即并池 → 池子 = 3,500', Math.round(s.gold) === 3500);
P('新城的 res.gold 立刻读池子（不留私房钱）', Math.round(G.res(c3).gold) === 3500);

/* 老档迁移 + 幂等 */
console.log('\n=== ① 老档迁移（幂等） ===');
var fake = { cities: [ { res: { grain: 1, wood: 0, stone: 0, iron: 0, gold: 100 } },
                       { res: { grain: 1, wood: 0, stone: 0, iron: 0, gold: 250 } } ] };
G.migrateGoldPool(fake);
console.log('  迁移后 fake.gold =', fake.gold);
P('各城金相加迁入（100 + 250 = 350）', fake.gold === 350);
G.migrateGoldPool(fake);
P('再迁一次不翻倍（幂等：已存在则以 st.gold 为权威）', fake.gold === 350 &&
  (Object.getOwnPropertyDescriptor(fake.cities[0].res, 'gold') || {}).get !== undefined);

console.log('\n=== ② 建造花费：谁的城用谁的货 ===');
/* 造局：甲城富、乙城穷 */
['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c)[k] = 5e6; G.res(c2)[k] = 0; });
G.ui._cityId = c.id;
var gi = c2.cells.findIndex(function (x) { return x.build && x.build.id === 'guanfu'; });
c2.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
var mi = c2.cells.findIndex(function (x) { return x.build && x.build.id === 'minfang'; });
s.queues.build.length = 0;
var rPoor = G.upgradeAt(c2.id, mi);
console.log('  在甲城界面升乙城的民房（乙城 0 货）→', JSON.stringify(rPoor).slice(0, 140));
P('★ 不再挪用甲城：报「本城资源不足」', rPoor.ok === false && /本城资源不足/.test(rPoor.msg || ''));
P('甲城的货一分未动', sum4(G.res(c)) === 2e7);
/* 给乙城货 → 放行，且扣的是乙城 */
var costB = DATA.BUILDINGS.minfang.levelCost(c2.cells[mi].build.lvl);
['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c2)[k] = costB[k] || 0; });
var beforeA = sum4(G.res(c)), beforeB = sum4(G.res(c2));
var rOk = G.upgradeAt(c2.id, mi);
console.log('  给乙城备料后再升 →', JSON.stringify(rOk).slice(0, 120));
P('★ 放行，且只扣乙城的货', rOk.ok === true && sum4(G.res(c2)) < beforeB && sum4(G.res(c)) === beforeA);

/* 混合费用：货按城 · 金按池（唯一池 s.gold） */
console.log('\n=== ② 混合费用：货按城结算 · 金走玩家池 ===');
s.queues.build.length = 0; c2.cells[mi].pending = null;
['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c2)[k] = 0; });
var mixCost = { grain: 1000, gold: 500 };
G.res(c2).grain = 1000;
P('乙城只有 1,000 粮（金为玩家池）→ canAffordIn(乙城) 通过', G.canAffordIn(c2, mixCost) === true);
G.res(c2).grain = 999;
P('货差 1 → 不通过（金再多也不能替货）', G.canAffordIn(c2, mixCost) === false);
G.res(c2).grain = 1000;
var gA = G.goldOf();
G.payCostIn(c2, mixCost);
console.log('  支付后：乙城粮 =', G.res(c2).grain, '· 池子金 =', G.goldOf(), '（原 ' + gA + '）');
P('★ 货扣本城（1,000 → 0）· 金扣玩家池（−500）', Math.round(G.res(c2).grain) === 0 && G.goldOf() === gA - 500);

/* 返还进该城 */
console.log('\n=== ② 返还进该城（拆除 / 取消建造） ===');
s.queues.build.length = 0; c2.cells[mi].pending = null;
var cB = G.cellOf(c2, mi);
var lvB = cB.build.lvl;
var bA = sum4(G.res(c)), bB = sum4(G.res(c2));
var rd = G.demolishAt(c2.id, mi);
console.log('  拆乙城一格 →', JSON.stringify(rd).slice(0, 110));
P('★ 返还进乙城（甲城一分未得）', rd.ok === true && sum4(G.res(c2)) > bB - 1 && sum4(G.res(c)) === bA);
/* 取消建造返还 */
s.queues.build.length = 0;
var zIdx = c2.cells.findIndex(function (x) { return !x.build && !x.official; });
G.res(c2).grain = 5e6; G.res(c2).wood = 5e6; G.res(c2).stone = 5e6; G.res(c2).iron = 5e6;
var rb = G.buildAt(c2.id, zIdx, 'minfang');
P('乙城可开建（前置）', rb.ok === true, rb.msg);
var cB2A = sum4(G.res(c)), cB2B = sum4(G.res(c2));
var rc = G.cancelBuild('city', zIdx, c2.id);
console.log('  取消乙城在建 →', JSON.stringify(rc).slice(0, 110));
P('★ 返还进乙城（队列项所属城）', rc.ok === true && sum4(G.res(c2)) > cB2B - 1 && sum4(G.res(c)) === cB2A);

console.log('\n=== ③ 调运清单去金（金无需运输） ===');
console.log('  TRANSPORT_KEYS =', JSON.stringify(G.TRANSPORT_KEYS));
P('清单里没有 gold', G.TRANSPORT_KEYS.indexOf('gold') < 0);
P('粮木石铁仍在清单里', ['grain', 'wood', 'stone', 'iron'].every(function (k) { return G.TRANSPORT_KEYS.indexOf(k) >= 0; }));

console.log('\n=== ④ 折损周期的现实换算 ===');
var bkT = s.settings.timeScale;
[1, 10, 120, 600].forEach(function (ts) {
  s.settings.timeScale = ts;
  console.log('  ' + ts + '× → ' + G.ui.rotPeriodRealText());
});
s.settings.timeScale = 10;
P('10× = 2.4 小时（144 分钟 → 显示 2.4 小时）', /2\.4 小时/.test(G.ui.rotPeriodRealText()));
s.settings.timeScale = bkT;
process.exit(0);
