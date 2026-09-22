/* ============================================================
 * probe_v8993_facts.js — v89.93 设计整改总纲 · 事实核验探针
 * ------------------------------------------------------------
 * 只读 + 走既有出口。核验五组事实（写入 tmp/probe_v8993_facts.txt）：
 *   A. 种子链：五种种子的商城价与在售状态 → 秘境种植 → 灵草 → 资质升档（全链实测）
 *   B. 人口：民房人口表 / 增势 / 上限构成（v74 后只剩民房）
 *   C. 仓库：BASE_STORE 与当前城仓容构成
 *   D. 资质档位：GEN_RANKS 全表（等级上限 / 权重 / 升档隐藏加成）
 *   E. 战斗出手面：战力估算 / 战术指令 / 计略 / 观战 API 清单
 * ============================================================ */
'use strict';
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var OUT = [];

/* SIM 时钟 */
var _RN = Date.now.bind(Date);
var simMs = Date.UTC(2026, 8, 22, 1, 0, 0);
Date.now = function () { return simMs; };

eval(fs.readFileSync(R + '.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(R + 'js/' + f + '.js');
});
fs.readdirSync(R + 'story').filter(function (f) { return /^vol-.*\.js$/.test(f); })
  .forEach(function (f) { try { require(R + 'story/' + f); } catch (e) {} });

var G = global.GAME, DATA = G.DATA, U = G.utils;
var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
var city0 = st.cities[0];
G.ui = G.ui || {}; G.ui._cityId = city0.id;
function W(s) { OUT.push(s); }
W('# v89.93 事实核验（probe_v8993_facts）\n');

/* ---------- A. 种子链 ---------- */
W('## A. 种子链（商城价 → 秘境 → 灵草 → 升档）');
var SEEDS = ['seed_fan', 'seed_yunling', 'seed_xisui', 'seed_hualong', 'seed_tianshou'];
var inShop = {};
(G.ui.shopItems ? (G.ui.shopItems() || []) : []).forEach(function (x) { inShop[x.id] = 1; });
SEEDS.forEach(function (id) {
  var it = null; (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
  W('  - ' + id + '：price=' + (it ? it.price : '?') + ' 元宝 = ' + ((it && it.price || 0) * 100) + ' 金 · 在售=' + (inShop[id] ? '是' : '否'));
});
/* 实测购买 */
st.res.gold = 5000000;
var b1 = G.doShopping('seed_hualong', 1);
W('  · 购化龙种子：' + JSON.stringify({ ok: b1 && b1.ok, msg: b1 && b1.msg, bought: b1 && b1.bought }));
var b2 = G.doShopping('seed_tianshou', 1);
W('  · 购天授种子：' + JSON.stringify({ ok: b2 && b2.ok, msg: b2 && b2.msg, bought: b2 && b2.bought }));
/* 种下并推进时间 */
try {
  var pr = G.farmPlant(0, 'hualongshen');
  W('  · 种化龙参：' + JSON.stringify({ ok: pr && pr.ok, msg: pr && pr.msg }));
  /* 推 48 游戏小时 = 48*3600 游戏秒；ts=120 → 现实秒 = 48*3600/120 */
  var tsm = (st.settings && st.settings.timeScale) || 120;
  for (var i = 0; i < Math.ceil(48 * 3600 / tsm) + 2; i++) { simMs += 1000; try { G.tickOnce(); } catch (e) {} }
  var hr = G.farmHarvestAll();
  W('  · 收化龙参（推 48 游戏时）：' + JSON.stringify({ ok: hr && hr.ok, msg: hr && hr.msg }));
  W('  · 背包化龙参数量：' + ((st.items && st.items.hualongshen) || 0));
} catch (e) { W('  · 秘境链异常：' + e.message); }
/* 升档实测：先造一个英杰 */
try {
  var gtest = st.generals[st.generals.length - 1];
  gtest.rank = 'ying';
  var ru = G.rankUpUse(gtest, { id: 'hualongshen', name: '化龙参', from: 'ying', to: 'ming' });
  W('  · 英杰→名世升档：' + JSON.stringify({ ok: ru && ru.ok, msg: ru && ru.msg, rank: gtest.rank }));
  W('  · 名世档位：' + JSON.stringify(G.rankOf(gtest)));
} catch (e) { W('  · 升档异常：' + e.message); }

/* ---------- B. 人口 ---------- */
W('\n## B. 人口');
var mf = DATA.BUILDINGS.minfang;
W('  · 民房人口表（每座）：' + JSON.stringify(mf.pop));
var popSum = 0; city0.cells.forEach(function (c) { if (c && c.build && c.build.id === 'minfang') popSum += (DATA.BUILDINGS.minfang.pop[c.build.lvl - 1] || 0); });
W('  · 初始城（民房 ' + (city0.cells.filter(function (c) { return c && c.build && c.build.id === 'minfang'; }).length) + ' 座）上限 = ' + G.maxPopOf(city0));
W('  · 人口增势/时 = ' + G.popGrowthOf(city0) + '（0.05%×上限，下限 1）');
W('  · 满民房（12 级×N 座）上限示例：1 座 = ' + mf.pop[11] + ' · 4 座 = ' + (mf.pop[11] * 4));
W('  · 兵源关系：募兵 1 兵 = 1 人口（见 DATA.TROOPS cost.pop 或 maxTrainCount）');
try { W('  · DATA.TROOPS.yibing.cost = ' + JSON.stringify(DATA.TROOPS.yibing.cost)); } catch (e) {}
try { W('  · 将格（generalsPerCity）：' + JSON.stringify({ slots: G.genSlotsOf(city0), innLv: G.innLevel(city0) })); } catch (e) {}

/* ---------- C. 仓库 ---------- */
W('\n## C. 仓库');
W('  · DATA.BASE_STORE = ' + DATA.BASE_STORE);
W('  · 当前城仓容 = ' + G.storeCapOf(city0) + '（民房/仓库等级和 = ' + G.buildingLevelSum(city0, 'cangku') + '）');
W('  · 仓容构成：BASE × 仓库等级和 × (1+储存技术) × (1+专精) × (1+名城档位)');
W('  · 实测初始仓容（无仓库）：' + G.storeCapOf(city0));

/* ---------- D. 资质档位表 ---------- */
W('\n## D. 资质档位（GEN_RANKS）');
(DATA.GEN_RANKS || []).forEach(function (r) {
  W('  - ' + r.id + '(' + r.name + ')：等级上限 ' + r.maxLv + ' · w=' + r.w + ' · wg=' + r.wg +
    ' · ascend=' + (r.ascend || 0) + ' · 成长基数 ' + (r.growth || r.base || '?'));
});
W('  · 升档链隐藏加成合计：四维各 +' + (DATA.GEN_RANKS || []).reduce(function (a, r) { return a + (r.ascend || 0); }, 0));
try { W('  · 客栈资质上限：' + G.innCapRank(18)); } catch (e) {}

/* ---------- E. 战斗出手面 ---------- */
W('\n## E. 战斗可干预面（API 清单）');
var apiNames = [];
['battle', 'tactic', 'march', 'systems', 'domain'].forEach(function (mod) {
  var m = G[mod]; if (!m) return;
  Object.keys(m).forEach(function (k) {
    if (/^(begin|step|finish|auto|order|cmd|tactic|stratagem|scout|preview|power|expPower|setOrder)/i.test(k)) apiNames.push(mod + '.' + k);
  });
});
W('  · 疑似战斗出口：' + apiNames.slice(0, 60).join(' · '));
try { W('  · 战力估算出口：ui.expPowerOf = ' + (typeof G.ui.expPowerOf)); } catch (e) {}
try {
  var pw = G.battle.powerOf ? 'battle.powerOf' : null;
  W('  · battle.powerOf: ' + (typeof G.battle.powerOf));
} catch (e) {}
W('  · 计略（tactic）出口：' + Object.keys(G.tactic || {}).slice(0, 30).join(' · '));

/* ---------- F. 时间倍率档位 ---------- */
W('\n## F. 时间与倍率');
W('  · secPerYear = ' + (DATA.TIME && DATA.TIME.secPerYear || '?') + ' · 设置档位 = ' + JSON.stringify((DATA.TIME && DATA.TIME.scaleOptions) || (st.settings && st.settings.timeScale)));
W('  · 默认倍率 = ' + ((DATA.DEFAULT_SETTINGS && DATA.DEFAULT_SETTINGS.timeScale) || '?'));
W('  · 当前倍率 = ' + G.timeScale());

fs.writeFileSync(R + '.workbuddy/tmp/probe_v8993_facts.txt', OUT.join('\n'), 'utf8');
process.exit(0);
