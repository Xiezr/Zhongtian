/* v89.187 评估（老板 2）：宝具掉率（据点 55%）＋ 税所金额（Lv×40/游戏日）。
   四问：① 据点供给（日均能打几次）② 宝具节奏（凑齐第一件"高"要几天）
        ③ 税所 vs 岁贡/掠夺/城内收入 的量级对照 ④ 结论与旋钮 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: 'ec', avatar: '🧔', gender: 'male', region: '豫州' });
G.state.world.weather = 'clear';
if (!G.state.map.grid) G.map.generate();

console.log('====== 〇、换算基线 ======');
console.log('· 时间倍率 ' + G.timeScale() + '× → 1 游戏日 = ' + Math.round(86400 / G.timeScale() / 60)
  + ' 现实分钟 = ' + (86400 / G.timeScale() / 3600).toFixed(2) + ' 现实小时');
console.log('· 1 现实日 = ' + (86400 * G.timeScale() / 86400).toFixed(0) + ' 游戏日');
console.log('· 税所公式：Σ(据点Lv × ' + (DATA.FORT_AURA.goldPerLvDay) + ') 金/游戏日');

console.log('');
console.log('====== 一、据点供给（地图扫描 · 当前 seed） ======');
var lvDist = {}, nFort = 0, lvSum = 0;
for (var y = 0; y < (DATA.MAP_H || 240); y++) {
  for (var x = 0; x < (DATA.MAP_W || 240); x++) {
    var f = G.map.fortAt(x, y);
    if (!f) continue;
    nFort++; lvSum += f.level;
    lvDist[f.level] = (lvDist[f.level] || 0) + 1;
  }
}
console.log('· 全图据点 ' + nFort + ' 处（均 Lv' + (lvSum / Math.max(1, nFort)).toFixed(1) + '）');
console.log('· 等级分布：' + Object.keys(lvDist).sort(function (a, b) { return a - b; })
  .map(function (k) { return 'Lv' + k + '×' + lvDist[k]; }).join(' '));
console.log('· 掠夺：每处每现实日一次、次日重置 → **日均上限 = ' + nFort + ' 次**（掠夺不消耗据点）');
console.log('· 占领：占一处少一处（永久），是"渠道收缩"的另一条路');
console.log('· 现实玩家节奏参考：按每次出征/行军 1~3 现实分钟 + 兵力/体力约束，**日均预期 2~6 次**（估）');

console.log('');
console.log('====== 二、单次掉落的品质分布（55% × 档位权重 × 据点等级 cap） ======');
/* tier 权重 4:3:2:1；cap=ceil(lv/3)；低=tier1-2 · 中=tier3 · 高=tier4 */
function tierPmf(lv) {
  var cap = Math.max(1, Math.min(4, Math.ceil(lv / (DATA.BAOJU_DROP.tierOfLv || 3))));
  var W = DATA.BAOJU_DROP.weights, pool = [];
  DATA.BAOJU.forEach(function (b) { if ((b.tier || 1) <= cap) pool.push(b); });
  var tw = 0;
  pool.forEach(function (b) { tw += (W[b.tier] || 1); });
  var byTier = {};
  pool.forEach(function (b) { byTier[b.tier] = (byTier[b.tier] || 0) + (W[b.tier] || 1) / tw; });
  return byTier;
}
[1, 3, 5, 7, 10].forEach(function (lv) {
  var p = tierPmf(lv), line = '· Lv' + lv + ' 据点：';
  [1, 2, 3, 4].forEach(function (t) {
    if (p[t]) line += 'tier' + t + ' ' + (p[t] * 100).toFixed(0) + '%　';
  });
  var low = (p[1] || 0) + (p[2] || 0), mid = (p[3] || 0), high = (p[4] || 0);
  line += '→ 品质 低 ' + (low * 100).toFixed(0) + '% / 中 ' + (mid * 100).toFixed(0) + '% / 高 ' + (high * 100).toFixed(0) + '%';
  console.log(line);
});

console.log('');
console.log('====== 三、宝具节奏（蒙特卡洛 · 2低=中 · 2中=高） ======');
/* 库存按 tier 计；合成：2件 tier≤2 → 随机 tier3；2件 tier3 → 随机 tier4 */
function simulate(days, perDay, avgLv) {
  var pool = { 1: 0, 2: 0, 3: 0, 4: 0 };
  var firstHigh = null, midGot = 0, fuse = 0;
  for (var d = 1; d <= days; d++) {
    for (var k = 0; k < perDay; k++) {
      if (Math.random() >= 0.55) continue;
      var p = tierPmf(avgLv), tw = 0, tks = [];
      [1, 2, 3, 4].forEach(function (t) { if (p[t]) { tks.push(t); tw += p[t]; } });
      var roll = Math.random(), acc = 0, got = 1;
      for (var i = 0; i < tks.length; i++) { acc += p[tks[i]]; if (roll < acc) { got = tks[i]; break; } }
      pool[got]++;
      /* 合成直到不足：2 低 → 1 中；2 中 → 1 高 */
      while ((pool[1] + pool[2]) >= 2) {
        var take = Math.min(2, pool[1]) >= 2 ? [1, 1] : (pool[1] >= 1 && pool[2] >= 1 ? [1, 2] : [2, 2]);
        pool[take[0]]--; pool[take[1]]--; pool[3]++; fuse++;
      }
    }
    while (pool[3] >= 2) { pool[3] -= 2; pool[4]++; fuse++; }
    if (firstHigh == null && pool[4] > 0) firstHigh = d;
  }
  return { firstHigh: firstHigh, high: pool[4], mid: pool[3], fuse: fuse };
}
[3, 5, 10].forEach(function (k) {
  var runs = 400, fh = [], highs = [];
  for (var i = 0; i < runs; i++) {
    var r = simulate(60, k, 6);
    fh.push(r.firstHigh == null ? 61 : r.firstHigh);
    highs.push(r.high);
  }
  fh.sort(function (a, b) { return a - b; });
  var avg = fh.reduce(function (a, b) { return a + b; }, 0) / runs;
  var avgH = highs.reduce(function (a, b) { return a + b; }, 0) / runs;
  console.log('· 日均 ' + k + ' 次掉落 → 第一件"高"中位 ' + fh[Math.floor(runs / 2)] + ' 天 · 平均 ' + avg.toFixed(1)
    + ' 天 · 60 天库存高×' + avgH.toFixed(1) + '（中×' + (function () { return simulate(60, k, 6).mid; })().toFixed(0) + ' 视随机）');
});
console.log('（模型：tier 权重 4:3:2:1 · 每掉落 55% 命中 · 即时合成 · 平均打卡据点 Lv6）');

console.log('');
console.log('====== 四、税所 vs 其他黄金来源（每现实日口径） ======');
console.log('· 城内金矿/市场：');
var c = G.state.cities[0];
c.level = 10;
try { console.log('   Lv10 城主城金产出/游戏时 = ' + JSON.stringify((GAME.prodFactors ? GAME.prodFactors(c) : {}).gold || '（查表）')); } catch (e) {}
/* 金矿建筑表 */
var goldBld = null;
(DATA.BUILDINGS ? Object.keys(DATA.BUILDINGS) : []).forEach(function (k) {
  var b = DATA.BUILDINGS[k];
  if (b && (b.prod === 'gold' || (b.res === 'gold'))) goldBld = { id: k, name: b.name, per: b.per, base: b.base };
});
console.log('   金产地建筑：' + (goldBld ? goldBld.name + '（' + JSON.stringify(goldBld) + '）' : '未找到（金走税收/市集？）'));
/* 岁贡（现实日） */
console.log('· 岁贡（每现实日 · 按城型）：');
Object.keys(DATA.CITY_YIELD || {}).forEach(function (t) {
  console.log('   ' + t + '：金 ' + DATA.CITY_YIELD[t].gold + '/现实日（GOLD_GATE.yield=' + (DATA.GOLD_GATE || {}).yield + '）');
});
console.log('· 税所（每游戏日 → 现实日换算 ×120）：');
[1, 5, 10].forEach(function (lv) {
  var perGameDay = lv * DATA.FORT_AURA.goldPerLvDay;
  console.log('   Lv' + lv + ' 据点：' + perGameDay + ' 金/游戏日 = ' + (perGameDay * 120)
    + ' 金/现实日（3 处 Lv5 ≈ ' + (200 * 3 * 120) + ' 金/现实日）');
});
console.log('· 掠夺单次（据点 Lv5 · 持金 50%）：');
try {
  var fake = { kind: 'fort', lv: 5, fort: { x: 88, y: 66, level: 5, name: '测' }, dropType: 'fort' };
  var loot = G.battle.genLoot(fake, (DATA.EXPEDITION.cityResMul || {}).raid || 0.5);
  console.log('   ' + JSON.stringify(loot));
} catch (e) { console.log('   genLoot 失败：' + e.message); }

console.log('');
console.log('====== 五、结论草稿（详见文档） ======');
console.log('· 掉率：日均 3~5 次 → 第一件"高"约 X 天（见上）——评估"是否偏快/偏慢"');
console.log('· 税所：与岁贡/掠夺的同口径对照——评估"占比是否合理"');
process.exit(0);
