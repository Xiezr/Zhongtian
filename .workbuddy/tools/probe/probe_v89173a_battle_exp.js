/* v89.173 探针 A：出征经验「拿满 0.8 级」现状 vs 方案
   老板需求：「出征带来的经验体验调高一点，出征上限不变，
   但出征对象的等级和所得的经验可以要求低一点，尽量拿满 0.8 级经验」
   —— 全程走真实出口（battleExp / expPenaltyOf / expNeedOf），新参数用"临时替换-还原"法模拟。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

function sampleGen(lv) {
  return { id: 'p173', name: '样本', rank: 'tian', level: lv, exp: 0,
    tong: 40, yw: 40, zm: 40, nz: 40, speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100,
    equip: {}, perm: {}, status: 'idle' };
}

console.log('=== ① 规则参数（现状） ===');
console.log('EXP_RULE   :', JSON.stringify(DATA.EXP_RULE));
console.log('EXP_PENALTY:', JSON.stringify(DATA.EXP_PENALTY));
console.log('');

console.log('=== ② 野地守军典型资源值（min~max 中值 · 实际按日波动 0.85~1.15） ===');
var garr = {}, resv = {};
for (var wl = 1; wl <= 10; wl++) {
  var tbl = DATA.WILD_DEFENSE[wl] || [], army = {};
  tbl.forEach(function (e) { army[e.id] = (e.min + e.max) / 2; });
  garr[wl] = army;
  resv[wl] = G.battle.armyResourceValue(army);
  var r0 = G.battle.battleExp(army, sampleGen(1));
  console.log('Lv' + wl + '：资源 ' + U.numText(resv[wl], 0)
    + '　raw = round(资源/1000)×2 = ' + U.numText(Math.round(resv[wl] / 1000) * 2, 0)
    + (wl <= 3 ? '　(旧口径·对照)' : ''));
}
console.log('');

var GENS = [1, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200];

function matrix(title, gLvList) {
  console.log('=== ' + title + ' ===');
  var head = '将\\野';
  for (var wl = 1; wl <= 10; wl++) head += '\tLv' + wl;
  console.log(head);
  var full = 0, tot = 0, minFull = {};
  gLvList.forEach(function (gLv) {
    var line = 'Lv' + gLv;
    var g = sampleGen(gLv);
    minFull[gLv] = 0;
    for (var wl2 = 1; wl2 <= 10; wl2++) {
      var r = G.battle.battleExp(garr[wl2], g);
      var pen = G.battle.expPenaltyOf(gLv, wl2);
      var gain = r.gain;
      if (pen.mul < 1) gain = Math.max(1, Math.round(gain * pen.mul));
      var pct = r.cap > 0 ? Math.round(gain / r.cap * 100) : 0;
      line += '\t' + Math.min(pct, 100) + '%';
      tot++;
      if (pct >= 100) { full++; if (!minFull[gLv]) minFull[gLv] = wl2; }
    }
    console.log(line + '　→ 拿满起点 ' + (minFull[gLv] ? ('Lv' + minFull[gLv]) : '—'));
  });
  console.log('（满格 ' + full + '/' + tot + ' · 单元格 = 实得 gain / 0.8 级上限）');
  console.log('');
  return { full: full, tot: tot, minFull: minFull };
}

var nowM = matrix('③ 现状矩阵（perResource=1000 · decay=0.65）', GENS);

/* —— 方案模拟：临时替换参数（走真实出口） —— */
var bkPR = DATA.EXP_RULE.perResource, bkDC = DATA.EXP_PENALTY.decay;
DATA.EXP_RULE.perResource = 500;
DATA.EXP_PENALTY.decay = 0.8;
var newM = matrix('④ 方案矩阵（perResource=500 · decay=0.8 · capPct 不变）', GENS);
DATA.EXP_RULE.perResource = bkPR;
DATA.EXP_PENALTY.decay = bkDC;

console.log('=== ⑤ 汇总：拿满起点（打几级野地开始能拿满 0.8 级） ===');
console.log('将领\t现状\t方案');
GENS.forEach(function (gLv) {
  var a = nowM.minFull[gLv] ? ('Lv' + nowM.minFull[gLv]) : '—（打不满）';
  var b = newM.minFull[gLv] ? ('Lv' + newM.minFull[gLv]) : '—（打不满）';
  console.log('Lv' + gLv + '\t' + a + '\t' + b);
});
console.log('满格数：现状 ' + nowM.full + '/' + nowM.tot + ' → 方案 ' + newM.full + '/' + newM.tot);
console.log('');

console.log('=== ⑥ 单场"等级收益"抽点（现状 → 方案） ===');
[[10, 6], [30, 8], [50, 9], [60, 10], [80, 10], [100, 10], [120, 10], [150, 10], [200, 10]].forEach(function (p) {
  var gp = sampleGen(p[0]);
  function calc(pr, dc) {
    var bk1 = DATA.EXP_RULE.perResource, bk2 = DATA.EXP_PENALTY.decay;
    DATA.EXP_RULE.perResource = pr; DATA.EXP_PENALTY.decay = dc;
    var r = G.battle.battleExp(garr[p[1]], gp);
    var pen = G.battle.expPenaltyOf(p[0], p[1]);
    var gain = pen.mul < 1 ? Math.max(1, Math.round(r.gain * pen.mul)) : r.gain;
    DATA.EXP_RULE.perResource = bk1; DATA.EXP_PENALTY.decay = bk2;
    return Math.round(gain / r.cap * 1000) / 10;
  }
  console.log('Lv' + p[0] + ' 打 Lv' + p[1] + '：现状 ' + calc(1000, 0.65) + '% → 方案 ' + calc(500, 0.8) + '%');
});
console.log('');

console.log('=== ⑦ 道具新面额折算（模拟升级到不上不下 · 天授样本） ===');
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });
[['练兵经验', 100000], ['治军之道', 1000000], ['兵仙遗篇', 3000000], ['千古兵圣', 4500000]].forEach(function (x) {
  var g = sampleGen(1);
  var r = G.battle.gainExp(g, x[1], 'probe');
  console.log(x[0] + '　+' + U.numText(x[1], 0) + ' → Lv1 → Lv' + g.level
    + '（余 ' + U.numText(g.exp, 0) + '/' + U.numText(G.expNeedOf(g), 0) + '）');
});
/* 旧对照：v89.171 的 expCumOf 面额（只读现值，防口径错觉） */
console.log('');
console.log('=== ⑧ 旧面额（v89.171 现值）对照 ===');
[['练兵经验', 'lianbing_jingyan'], ['治军之道', 'zhijun_zhidao'], ['兵仙遗篇', 'bingxian_yipian'], ['千古兵圣', 'bingsheng']]
  .forEach(function (x) {
    var it = null;
    (DATA.ITEMS || []).forEach(function (y) { if (y.id === x[1]) it = y; });
    console.log(x[0] + '：amount=' + U.numText(it.amount, 0) + ' capLv=' + (it.capLv || '—'));
  });

process.exit(0);
