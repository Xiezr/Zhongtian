/* ============================================================
 * probe_market_price.js  市场「卖资源换金」定价标定探针（node 直接跑）
 * ------------------------------------------------------------
 * 老板（v89.48）：「市场可以售卖资源，换取黄金，比例按 1,2,3,4 比例呈现，粮食最便宜」
 *   比例已给定（粮 1 : 木 2 : 石 3 : 铁 4）—— **待定的只有"1 是多少金"**。
 *
 * 本探针用**真实数据表**（不mock、不构造临时城）算清三件事：
 *   ① 人口 ← → 产量 ← → 黄金 三者的结构关系：
 *      · 民房 pop 表与农田 prod 表**是同一张**（等级 L → 人口 T[L] / 农田 10·T[L] 每小时）
 *      · 黄金只由税收派生：gold/h = popCap × hearts% × tax × (1+税加成) × GOLD_GATE.tax
 *      → 于是"产粮速度"与"产金速度"被同一张表锁死，兑换价有了唯一正确的锚点。
 *   ② 若干典型城池规模下：一小时税产多少金、一小时粮产多少粮 → **平价兑换价**（1 金 = ? 粮）。
 *   ③ 候选基价下：卖光一小时产能换多少金（相对税产的倍数）、换一次招募要卖多少。
 * 用法：node tools/probe/probe_market_price.js
 * ============================================================ */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  function makeEl() {
    return {
      tagName: 'DIV', textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; }, getContext: function () { return null; }
    };
  }
  global.document = {
    createElement: function () { return makeEl(); }, querySelector: function () { return makeEl(); },
    querySelectorAll: function () { return []; }, addEventListener: function () {}, readyState: 'complete'
  };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  var pathMod = require('path');
  ['data', 'state', 'questdata', 'systems', 'domain', 'map'].forEach(function (m) {
    require(pathMod.join(__dirname, '..', '..', 'js', m + '.js'));
  });
  var G = global.GAME, DATA = G.DATA, U = G.utils;

  var POP = DATA.BUILDINGS.minfang.pop;          /* 民房人口表（等级 → 人口） */
  var FARM = DATA.EXT_BUILDINGS.farm.prod;       /* 农田产量表（等级 → 粮/小时） */
  var TAX = DATA.DEFAULT_SETTINGS.tax;           /* 0.5 */
  var GATE = (DATA.GOLD_GATE && DATA.GOLD_GATE.tax) || 1;
  var RATIO = { grain: 1, wood: 2, stone: 3, iron: 4 };

  console.log('结构：民房人口表[L] = ' + POP.slice(0, 6).join('/') + ' …（Lv12 ' + POP[11] + '）');
  console.log('      农田产量表[L] = ' + FARM.slice(0, 6).join('/') + ' …（Lv12 ' + FARM[11] + ' /小时）');
  console.log('      → 两张表同源：Lv L 的一间民房养活的人口 = 一块农田 10 倍的产粮（10×人口/h）');
  console.log('      税率 ' + TAX + ' · 黄金闸门 tax ×' + GATE + '  → 金/h = 人口上限 × ' + (TAX * GATE).toFixed(2));
  console.log('');

  /* 平价：同一等级下，"一块农田一小时的粮" vs "一间民房一小时的金" */
  console.log('① 平价兑换价（同等级、单座对比）——「1 金值多少粮」：');
  console.log('   等级   民房人口   农田粮/h   该等级税产金/h   平价 1 金 = ? 粮');
  [1, 3, 5, 7, 9, 12].forEach(function (lv) {
    var i = lv - 1, pop = POP[i], grain = FARM[i];
    var gold = pop * TAX * GATE;
    console.log('   Lv' + String(lv).padStart(2) + '   ' + String(U.fmt(pop)).padStart(8) +
      '   ' + String(U.fmt(grain)).padStart(9) + '   ' + String(U.fmt(Math.round(gold))).padStart(13) +
      '   ' + (grain / gold).toFixed(1) + ' 粮');
  });
  console.log('   → 平价稳定在 1 金 ≈ 6.7 粮（全等级一致：两张表同源，比值恒 10 : 1.5）');
  console.log('   → 注意方向：**卖的价永远低于平价**才叫"换金有代价"——');
  console.log('      每 10 单位 1 金 = 0.100 金/粮 = 平价的 0.67 倍；');
  console.log('      每 20 单位 1 金 = 0.050 金/粮 = 平价的 0.34 倍（本档采用）；');
  console.log('      （若哪天出现"每单位 1 金"= 6.7 倍平价，那才是架空税制的印钞机）');
  console.log('');

  /* ② 典型城池：一小时产能 vs 一小时税产 */
  function city(popHouses, lv, plots) {
    var pop = POP[lv - 1] * popHouses, gold = pop * TAX * GATE;
    var each = FARM[lv - 1] * plots;
    return { pop: pop, gold: gold, each: each };
  }
  console.log('② 典型城池：卖光一小时产能换多少金（相对该城税产）：');
  console.log('   规模                    税产金/h   单资源产/h   卖光四资源金/h   倍数');
  [
    { n: '前期 4民房Lv5 + 各4块Lv5', h: 4, lv: 5, p: 4 },
    { n: '中期 6民房Lv7 + 各6块Lv7', h: 6, lv: 7, p: 6 },
    { n: '后期 10民房Lv9 + 各10块Lv9', h: 10, lv: 9, p: 10 }
  ].forEach(function (cfg) {
    var c = city(cfg.h, cfg.lv, cfg.p);
    [10, 20, 50, 100].forEach(function (per) {
      var price = { grain: RATIO.grain / per, wood: RATIO.wood / per, stone: RATIO.stone / per, iron: RATIO.iron / per };
      var tot = c.each * (price.grain + price.wood + price.stone + price.iron);
      console.log('   ' + cfg.n.padEnd(22) + '  每' + String(per).padStart(3) + '单位 1 金：' +
        String(U.fmt(Math.round(c.gold))).padStart(8) + '  ' + String(U.fmt(c.each)).padStart(9) +
        '   ' + String(U.fmt(Math.round(tot))).padStart(13) + '   ' + (tot / c.gold).toFixed(1) + '×');
    });
    console.log('');
  });

  /* ③ 金去处换算：一次招募 / 一次爵位，要卖多少粮 */
  console.log('③ 换一样东西要卖多少粮（取中期规模 6×Lv7，粮 2100/h·块）：');
  var grainPerHour = FARM[6] * 6;
  var recruit = 8000, rank1 = 20000, rank5 = 100000;
  [10, 20, 50, 100].forEach(function (per) {
    var goldPerGrain = 1 / per;
    console.log('   每' + String(per).padStart(3) + '单位 1 金（' + goldPerGrain.toFixed(3) + ' 金/粮）：' +
      ' 招募 8,000 金 = 卖 ' + U.fmt(Math.round(recruit / goldPerGrain)) + ' 粮（' +
      (recruit / goldPerGrain / grainPerHour).toFixed(1) + ' 小时粮产）' +
      ' | 爵位 2 万 = ' + U.fmt(Math.round(rank1 / goldPerGrain)) + ' 粮' +
      ' | 10 万 = ' + U.fmt(Math.round(rank5 / goldPerGrain)) + ' 粮');
  });
  console.log('');
  console.log('判读：');
  console.log('  · 平价 = 0.149 金/粮（1 金 ≈ 6.7 粮）—— 这是"产粮 vs 产金"的天然比价，与等级无关。');
  console.log('  · 每 10 单位 1 金 = 平价的 0.67 倍 · 每 20 单位 1 金 = 0.34 倍（采用）·');
  console.log('    每 50 单位 1 金 = 0.13 倍 · 每 100 单位 1 金 = 0.07 倍（形同虚设，老板会看不出这功能存在）。');
  console.log('  · 表中"卖光四资源 ÷ 税产"的倍数 > 1，是因为同一座城可同时铺农田/伐木/采石/铁矿各 N 块，');
  console.log('    而税产只跟民房走 —— 倍数越大，"把地全拿去卖"越划算（代价是彻底放弃营造）。取 20 档时约 3×。');
  console.log('  · 结论：**per=20**（偏紧、贴合 v73 金贵基调）；想宽松改 10，想更严改 30/40。');
})();
