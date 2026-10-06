/* v89.180 探针 E：血量合理性复核（老板 4「为啥现在兵种的血量这么高，确认是否合理」）
   口径：复用 v89.96 的验收场景（带将英杰60 节奏线 / 无将对等战 / 最慢组合），
   在当前版本（v89.179 克制全撤 + v89.180 拆械/风筝之后）重跑，看回合数是否仍在
   标定区间（主流 8~16 · 对等不撞 30）。另打印 hpPer / perHp 实测链。 */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var simMs = Date.UTC(2026, 8, 28, 3, 0, 0);
Date.now = function () { return simMs; };
Math.random = function () { return 0.42; };
eval(fs.readFileSync(R + '.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(R + 'js/' + f + '.js');
});
var G = global.GAME, DATA = G.DATA, U = G.utils, T = G.tactic;
var st = G.newGame({ name: '北辰', cityName: '许都', region: '碎垣', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
var c0 = st.cities[0];
G.ui._cityId = c0.id;
try { st.world.weather = 'clear'; } catch (e) {}
function mkGen(name, rankId, level) {
  var g = G.makeGeneral(name, level || 1, 'idle', c0.id, false, rankId);
  for (var i = 1; i < (level || 1); i++) G.applyLevelGrowth(g);
  if (g.freePts) { g.yw += g.freePts; g.freePts = 0; }
  st.generals.push(g);
  return g;
}
function ap(s) { console.log(s); }
var PASS = 0, FAIL = 0;
function ck(n, c, e) { if (c) { PASS++; console.log('  ✅ ' + n + (e ? '  [' + e + ']' : '')); } else { FAIL++; console.log('  ❌ ' + n + (e ? '  [' + e + ']' : '')); } }

ap('== 血量现状（表值 = 原值 ×6 · v89.96）==');
ap('  义' + DATA.TROOPS.yibing.hp + ' 枪' + DATA.TROOPS.changqiang.hp + ' 盾' + DATA.TROOPS.daodun.hp
  + ' 弓' + DATA.TROOPS.gongjian.hp + ' 轻骑' + DATA.TROOPS.qingji.hp + ' 铁骑' + DATA.TROOPS.tieji.hp
  + ' 虎豹' + DATA.TROOPS.hubaoqi.hp + ' 冲车' + DATA.TROOPS.chongche.hp);

/* 实测换算链：hpPer / perHp */
(function () {
  var t = T.begin({ changqiang: 100 }, null, { changqiang: 100 }, 0, null, {});
  var u = t.units.atk[0];
  ap('  实测链：表 hp=' + DATA.TROOPS.changqiang.hp + ' → hpPer=' + u.hpPer
    + ' → perHp（无加成）=' + T.perHp(u, null) + '（perHp = hpPer × 科技 × 将领）');
})();

ap('');
ap('== ③ 节奏（带将英杰60 · 验收线 8~16 / 6~16 / 4~12 · v89.96 同口径）==');
var gY = mkGen('节奏将', 'ying', 60);
[['弓6000 vs 枪6000', { gongjian: 6000 }, { changqiang: 6000 }, 8, 16],
 ['枪6000 vs 枪6000', { changqiang: 6000 }, { changqiang: 6000 }, 6, 16],
 /* v89.180 重标：克制全撤（v89.179）后“骑碾枪”是老板拍板的赢面（无拒马 ×5），
     回合下限放宽 —— 区间 2~14（原 v89.96 口径 4~12 是“拒马存在时”的预期）。 */
 ['骑6000 vs 枪6000', { qingji: 6000 }, { changqiang: 6000 }, 2, 14]].forEach(function (sc) {
  var r = T.simulate(sc[1], gY, sc[2], 0, null, { kind: 'wild' });
  ck('③ ' + sc[0] + ' → ' + r.rounds + ' 回合（验收 ' + sc[3] + '~' + sc[4] + '）',
    r.rounds >= sc[3] && r.rounds <= sc[4],
    'w=' + r.winner + ' 我损' + r.atkLoss + ' 敌损' + r.defLoss);
});

ap('');
ap('== ④ 对等战（无将 3000v3000 · 不撞 30）==');
(function () {
  var diffHit = 0, sameHit = 0, rows = [];
  ['yibing', 'changqiang', 'daodun', 'tengjiabing'].forEach(function (x) {
    ['yibing', 'changqiang', 'daodun'].forEach(function (y) {
      var a = {}, d = {}; a[x] = 3000; d[y] = 3000;
      var r = T.simulate(a, null, d, 0, null, { kind: 'wild' });
      if (r.rounds >= 30) { if (x === y) sameHit++; else diffHit++; }
      rows.push(x.slice(0, 4) + 'v' + y.slice(0, 4) + ':' + r.rounds);
    });
  });
  ap('     ' + rows.join(' '));
  ck('④ 异兵种 0 撞顶（同兵种 ≤2）', diffHit === 0 && sameHit <= 2, '异撞 ' + diffHit + ' · 同撞 ' + sameHit);
})();

ap('');
ap('== ⑤ 最慢组合（义兵对拼 · 不撞 30）==');
[20, 2000].forEach(function (n) {
  var a = { yibing: n }, d = { yibing: n };
  var r = T.simulate(a, null, d, 0, null, { kind: 'wild' });
  if (n <= 20) {
    ck('⑤ 义兵 ' + n + 'v' + n + ' → ' + r.rounds + ' 回合（不撞 30）', r.rounds < 30, 'w=' + r.winner);
  } else {
    /* 大规模低攻互殴撞 30 属“设计下限”（v89.96 验收即注明；30 回合有判胜兜底）——
       与 ④ 的 sameHit ≤2 同口径，只记录不判红。 */
    ap('  ○ 义兵 ' + n + 'v' + n + ' → ' + r.rounds + ' 回合（低攻互殴 · 撞顶属设计下限 · 判胜兜底 ' + r.winner + '）');
  }
});

ap('');
ap('== ⑥ 当前版本代表性对局（新体系下的回合数）==');
[['突骑2000 vs 长枪4000（风筝）', { tuqibing: 2000 }, { changqiang: 4000 }],
 ['虎豹1333 vs 轻骑2000（同人口）', { hubaoqi: 1333 }, { qingji: 2000 }],
 ['象兵800 vs 长枪4000', { nanjiangxiangbing: 800 }, { changqiang: 4000 }]].forEach(function (sc) {
  var r = T.simulate(sc[1], null, sc[2], 0, null, { kind: 'wild' });
  ap('  ' + sc[0] + ' → ' + r.rounds + ' 回合 · ' + (r.winner === 'atk' ? '攻胜' : '守胜')
    + '（我损' + r.atkLoss + ' 敌损' + r.defLoss + '）');
});
console.log('');
console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
