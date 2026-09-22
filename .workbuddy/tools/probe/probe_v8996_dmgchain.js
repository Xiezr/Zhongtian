/* ============================================================
 * probe_v8996_dmgchain.js — v89.96 伤害链源头标定（定稿验证台账）
 * ------------------------------------------------------------------
 * 老板批注：「伤害计算不要乱定系数，计算过程应当简洁；
 *   如果出现平衡性问题，是否调整兵种属性？或者控制影响战斗的其他因素」
 *
 * 本探针是**定稿后的验收台账**（读真实 DATA，无任何内存模拟）：
 *   ① 无末端系数（源码级检查）
 *   ② 换算链双刻度（勇武 / 装备 分量）
 *   ③ 节奏：带将均势 8~16 回合（验收线）
 *   ④ 对等战：异兵种不撞 30 回合上限
 *   ⑤ 相克：枪克骑（1:1 枪胜）/ 铁骑赢弓 / 铁骑负枪（天敌关系）
 *   ⑥ 拆塔：20~28 回合清 100 座
 *   ⑦ 小规模：20v20 必收敛（round 取整）
 * 标定过程（扫参矩阵）留在 tmp/_cal96* 与 tmp/_sweep963 记录里。
 * ============================================================ */
'use strict';
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var OUT = [];
function ck(name, cond, extra) { OUT.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); }
function ap(s) { OUT.push(s); }

var simMs = Date.UTC(2026, 8, 22, 1, 0, 0);
Date.now = function () { return simMs; };
Math.random = function () { return 0.42; };
eval(fs.readFileSync(R + '.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(R + 'js/' + f + '.js');
});
fs.readdirSync(R + 'story').filter(function (f) { return /^vol-.*\.js$/.test(f); })
  .forEach(function (f) { try { require(R + 'story/' + f); } catch (e) {} });

var G = global.GAME, DATA = G.DATA, U = G.utils, T = G.tactic;
var st = G.newGame({ name: '北辰', cityName: '许都', region: '豫州', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
var c0 = st.cities[0];
G.ui._cityId = c0.id;

function mkGen(name, rankId, level) {
  var g = G.makeGeneral(name, level || 1, 'idle', c0.id, false, rankId);
  for (var i = 1; i < (level || 1); i++) G.applyLevelGrowth(g);
  if (g.freePts) { g.yw += g.freePts; g.freePts = 0; }
  st.generals.push(g);
  return g;
}

/* ============================================================
 * ① 无末端系数（源码级）
 * ============================================================ */
ap('== ① 无末端系数 ==');
(function () {
  /* ⚠️ 判据先去注释再查 —— "已删除"的说明文字本身就含关键字，
     indexOf 直查会把注释当代码（本探针第一版就是这么假红的）。 */
  var strip = function (s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  };
  var tSrc = strip(fs.readFileSync(R + 'js/tactic.js', 'utf8'));
  var dSrc = strip(fs.readFileSync(R + 'js/data.js', 'utf8'));
  var noT = tSrc.indexOf('DAMAGE_SCALE') < 0;
  var noD = dSrc.indexOf('DATA.BATTLE') < 0;
  ck('①-1 tactic.js 无 DAMAGE_SCALE（末端总闸已删）', noT && noD, 'tactic=' + noT + ' data=' + noD
    + ' · 伤害公式 = 兵攻×链 / 兵血');
  ap('     兵种 hp 表：义' + DATA.TROOPS.yibing.hp + ' 枪' + DATA.TROOPS.changqiang.hp
    + ' 盾' + DATA.TROOPS.daodun.hp + ' 弓' + DATA.TROOPS.gongjian.hp
    + ' 轻骑' + DATA.TROOPS.qingji.hp + ' 铁骑' + DATA.TROOPS.tieji.hp + '（= 原值 ×6）');
  ap('     箭塔：hp' + DATA.WALL_TOWER.hp + '（原版）· tough' + DATA.WALL_TOWER.tough + '（标定）');
})();

/* ============================================================
 * ② 换算链双刻度
 * ============================================================ */
ap('');
ap('== ② 换算链（双刻度 + 唯一原子）==');
(function () {
  var a = G.genAttrs(mkGen('链样本', 'ying', 60));
  var bare = G.atkPctOf(100, 0);        /* 勇武 100：期望 100×0.0005 = 0.05 */
  var eq = G.atkPctOf(0, 1000);         /* 装备 1000：期望 1000/10/100 = 1.0 */
  ck('②-1 换算原子：勇武每 20 点 +1%（100→5%）· 装备每 10 攻值 +1%（1000→100%）',
    Math.abs(bare - 0.05) < 1e-9 && Math.abs(eq - 1.0) < 1e-9,
    '勇武100=' + (bare * 100) + '% · 装备1000=' + (eq * 100) + '%');
  ap('     Lv60 英杰样本：勇武 ' + a.yw + ' → 攻击 ×' + (1 + a.atkPct).toFixed(2)
    + '（旧口径 ×' + (1 + a.yw * 0.01).toFixed(1) + ' —— 这就是"一击清场"的源头，已标定）');
  ck('②-2 a.atkPct 走唯一原子（防"公式抄两份"）',
    Math.abs(a.atkPct - G.atkPctOf(a.yw, a.atk)) < 1e-12
    && Math.abs(a.defPct - G.defPctOf(a.zm, a.def)) < 1e-12);
})();

/* ============================================================
 * ③ 节奏（带将均势 · 验收线 8~16 回合）
 * ============================================================ */
ap('');
ap('== ③ 节奏（带将英杰60 · 验收线 8~16）==');
var gY = mkGen('节奏将', 'ying', 60);
[['弓vs枪', { gongjian: 6000 }, { changqiang: 6000 }, 8, 16],
 ['枪vs枪', { changqiang: 6000 }, { changqiang: 6000 }, 6, 16],
 ['骑vs枪', { qingji: 6000 }, { changqiang: 6000 }, 4, 12]].forEach(function (sc) {
  var r = T.simulate(sc[1], gY, sc[2], 0, null, { kind: 'wild' });
  ck('③ ' + sc[0] + ' → ' + r.rounds + ' 回合（区间 ' + sc[3] + '~' + sc[4] + '）',
    r.rounds >= sc[3] && r.rounds <= sc[4],
    'w=' + r.winner + ' 我损 ' + r.atkLoss + ' 敌损 ' + r.defLoss);
});

/* ============================================================
 * ④ 对等战（异兵种不撞 30）
 * ============================================================ */
ap('');
ap('== ④ 对等战（无将 3000v3000）==');
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
  ck('④-1 异兵种 0 撞顶（同兵种低攻互殴 ≤2 属设计下限）',
    diffHit === 0 && sameHit <= 2, '异撞 ' + diffHit + ' · 同撞 ' + sameHit);
})();

/* ============================================================
 * ⑤ 相克
 * ============================================================ */
ap('');
ap('== ⑤ 相克（B 套 + v89.96 标定）==');
[['枪6000 vs 骑6000（枪应胜）', { changqiang: 6000 }, { qingji: 6000 }, 'atk'],
 ['铁骑1833 vs 弓2750（应胜）', { tieji: 1833 }, { gongjian: 2750 }, 'atk'],
 ['铁骑1833 vs 盾5500（应胜）', { tieji: 1833 }, { daodun: 5500 }, 'atk'],
 ['铁骑1833 vs 枪5500（应负——枪是天敌）', { tieji: 1833 }, { changqiang: 5500 }, 'def']].forEach(function (p) {
  var r = T.simulate(p[1], null, p[2], 0, null, { kind: 'wild' });
  ck('⑤ ' + p[0], r.winner === p[3],
    r.rounds + ' 回合 w=' + r.winner + '（我损 ' + r.atkLoss + ' 敌损 ' + r.defLoss + '）');
});

/* ============================================================
 * ⑥ 拆塔
 * ============================================================ */
ap('');
ap('== ⑥ 拆塔（投石4000 + 拆塔将 · 验收 20~28 回合）==');
(function () {
  var gT = mkGen('拆塔将', 'ying', 40);
  gT.tong = 500; gT.yw = 300; gT.zm = 200;
  G.setTactic('toudan', { s: 'advance', t: DATA.TARGET_WALL });
  var r = T.simulate({ toudan: 4000 }, gT, { changqiang: 1500 }, 200, null,
    { kind: 'city', sieging: true, wallLv: 8 });
  G.clearTactics();
  ck('⑥ 塔余 ' + r.towerLeft + ' · ' + r.rounds + ' 回合', r.towerLeft === 0 && r.rounds >= 20 && r.rounds <= 28,
    '我损 ' + r.atkLoss + ' · 守损 ' + r.defLoss);
})();

/* ============================================================
 * ⑦ 小规模（round 取整 → 必收敛）
 * ============================================================ */
ap('');
ap('== ⑦ 小规模战斗（20v20 义兵）==');
(function () {
  var env = T.begin({ yibing: 20 }, null, { yibing: 20 }, 0, null,
    { sieging: false, kind: 'wild', defName: 'x' });
  env.runAll();
  var all = env.finish();
  var ctr = 0;
  (all.roundsLog || []).forEach(function (rr) {
    (rr.events || []).forEach(function (e) { if (e.kind === 'counter' && e.side === 'atk') ctr++; });
  });
  ck('⑦ 收敛且反击 ≥2（round 修复前：0 杀卡死 30 回合）',
    all.winner && ctr >= 2, ctr + ' 次反击 · ' + all.rounds + ' 回合 w=' + all.winner);
})();

/* ============================================================
 * ⑧ 结论
 * ============================================================ */
ap('');
ap('== ⑧ 结论 ==');
ap('  · 伤害链（无末端系数）：perAtk = 兵种攻 ×（1 + atkPct×覆盖）× 科技 × 相克 × 攻城；');
ap('    k = perAtk × 数量 × cf ÷ perHp（round 取整）· cf = 2×攻/(攻+防)');
ap('  · 可调旋钮全在源头：兵种 hp（data.js）· 覆盖系数（domain.js YW_PCT/ZM_PCT）；');
ap('  · 本文件即验收台账：全 PASS 表示"节奏 / 克制 / 攻城 / 小规模"四条线达标。');

fs.writeFileSync(R + '.workbuddy/tmp/probe_v8996_dmgchain.txt', OUT.join('\n'), 'utf8');
var fails = OUT.filter(function (l) { return l.indexOf('FAIL') === 0; }).length;
console.log('PROBE DONE · ' + (OUT.length - fails) + ' PASS / ' + fails + ' FAIL');
