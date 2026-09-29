/* v89.173 探针 B（改后验证 0/0）：道具固定面额（撤等级限制）+ 出征经验新口径
   全绿 = 本轮口径落地。数字全部走真实出口（DATA/expItemGrantOf/battleExp/expPenaltyOf）。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
var bad = 0;
var P = function (n, ok, ex) {
  if (!ok) bad++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + n + (ex ? '  [' + ex + ']' : ''));
};
var gen = function (lv) {
  return { id: 'p173b', name: '样本', rank: 'tian', level: lv, exp: 0,
    tong: 40, yw: 40, zm: 40, nz: 40, speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100,
    equip: {}, perm: {} };
};
var byId = function (id) { var r = null; (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) r = x; }); return r; };

console.log('=== ① 道具族（固定面额 · 无 capLv · 实售 = 内部价 ×100）===');
[['练兵经验', 'lianbing_jingyan', 100000, 800],
 ['治军之道', 'zhijun_zhidao', 1000000, 19200],
 ['兵仙遗篇', 'bingxian_yipian', 3000000, 240000],
 ['千古兵圣', 'bingsheng', 4500000, 400000]].forEach(function (x) {
  var it = byId(x[1]);
  P(x[0] + '：面额 ' + U.numText(it.amount, 0) + ' · 实售 ' + U.numText(it.price * 100, 0) + ' 金'
    + ' · desc「' + it.desc + '」',
    it.amount === x[2] && it.price * 100 === x[3] && it.desc === '将领经验+' + x[2] && !it.capLv);
});
var capResid = (DATA.ITEMS || []).filter(function (x) { return x.type === 'exp' && x.capLv; }).length;
P('全族 exp 道具 capLv 残留 = 0', capResid === 0, 'resid=' + capResid);
P('expCumOf / expItemCapOf 已退役', DATA.expCumOf === undefined && G.expItemCapOf === undefined);

console.log('=== ② 闸门（不设等级限制 · 资质闸保留）===');
[1, 60, 120, 200].forEach(function (lv) {
  var t = G.expItemGrantOf(gen(lv), byId('bingxian_yipian'));
  P('Lv' + lv + ' 用兵仙遗篇 → ok=' + t.ok + ' grant=' + U.numText(t.grant || 0, 0),
    t.ok === true && t.grant === 3000000);
});
var tFan = G.expItemGrantOf({ id: 'x', name: '凡品', rank: 'fan', level: 60, exp: 0 }, byId('bingxian_yipian'));
P('凡品 Lv60 → 资质闸仍拒（消息含「上限」）', tFan.ok === false && /上限/.test(tFan.msg || ''), (tFan.msg || '').slice(0, 46));

console.log('=== ③ 出征参数与拿满抽点 ===');
P('perResource=500 · decay=0.8 · capPct=0.8 · winMul=2',
  DATA.EXP_RULE.perResource === 500 && DATA.EXP_PENALTY.decay === 0.8
  && DATA.EXP_RULE.capPct === 0.8 && DATA.EXP_RULE.winMul === 2);
var armyOf = function (lv) { var a = {}; (DATA.WILD_DEFENSE[lv] || []).forEach(function (e) { a[e.id] = (e.min + e.max) / 2; }); return a; };
[[10, 10, true], [50, 9, true], [100, 10, true], [120, 9, false], [200, 10, false]].forEach(function (c) {
  var g = gen(c[0]);
  var r = G.battle.battleExp(armyOf(c[1]), g);
  var pen = G.battle.expPenaltyOf(c[0], c[1]);
  var gain = pen.mul < 1 ? Math.max(1, Math.round(r.gain * pen.mul)) : r.gain;
  var pct = Math.round(gain / r.cap * 100);
  var full = pct >= 100;
  P('Lv' + c[0] + ' 打 Lv' + c[1] + ' 野地 → ' + Math.min(pct, 100) + '%'
    + (c[2] ? '（应满）' : '（不应满）'), full === c[2], 'gain=' + gain + ' cap=' + r.cap);
});
var pen1 = G.battle.expPenaltyOf(120, 9), pen3 = G.battle.expPenaltyOf(120, 7);
P('惩罚放宽：差 1 档 ×0.8（' + pen1.mul + '）· 差 3 档 ×0.512（' + pen3.mul.toFixed(4) + '）',
  Math.abs(pen1.mul - 0.8) < 1e-9 && Math.abs(pen3.mul - 0.512) < 1e-9);

console.log('=== ④ 道具折算（Lv1 天授样本 → 到达等级）===');
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });
[['练兵经验', 100000, 11], ['治军之道', 1000000, 30], ['兵仙遗篇', 3000000, 49], ['千古兵圣', 4500000, 59]].forEach(function (x) {
  var g = gen(1);
  G.battle.gainExp(g, x[1], 'probe');
  P(x[0] + ' +' + U.numText(x[1], 0) + ' → Lv' + g.level + '（余 ' + U.numText(g.exp, 0) + '）',
    g.level === x[2], 'Lv' + g.level);
});

console.log('');
console.log(bad ? ('❌ ' + bad + ' 项未过') : '✅ 全过（0/0）');
process.exit(bad ? 1 : 0);
