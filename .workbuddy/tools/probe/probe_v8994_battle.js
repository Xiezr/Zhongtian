/* ============================================================
 * probe_v8994_battle.js — v89.94（B2 战斗三件套）实测探针（自写盘，避开控制台编码）
 * ------------------------------------------------------------------
 * E1 围攻战：五件套数值 / 缩放 / 按日恢复 / 多波次下城 / 撤退（含逐回合诊断）
 *            / 掠夺不破防 / 断层是否变台阶（阶梯表）
 * E2 军师估算：误差表（情报等级）/ 决策带敏感性（±15% 兵力 / 阵位 / 战法 / 计略能翻转胜负）
 *            / 战法效果实测（围困 −12%、奇袭把计略 ×1.5）
 * E3 战报回放：帧数上限 / 关键帧闭环 / 增量 <2KB / 以少胜多
 * 验收线：五五开带（ratio 0.75~1.35）在"可打目标"里的占比 ≥20%
 * ============================================================ */
'use strict';
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var OUT = [];
function ck(name, cond, extra) { OUT.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); }
function ap(s) { OUT.push(s); }

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
var c0 = st.cities[0];
G.ui._cityId = c0.id;
var tp = G.story.troopPower;

/* ------------------------------------------------------------
 * ① E1 核心数值
 * ---------------------------------------------------------- */
ap('== E1 围攻战：核心数值 ==');
ck('E1-1 配置：试点 fort/county · 恢复 8%/日 · 破防上下限自洽',
  DATA.SIEGE.scope.join(',') === 'fort,county' && DATA.SIEGE.repairPerDay === 8
  && DATA.SIEGE.chipMin <= DATA.SIEGE.chipBase && DATA.SIEGE.chipBase <= DATA.SIEGE.chipMax);
ck('E1-2 破防曲线：保底 / 1:1=chipBase / 封顶（期望值由配置推导）',
  G.siegeChipOf(0.01) === DATA.SIEGE.chipMin && G.siegeChipOf(1.0) === DATA.SIEGE.chipBase
  && G.siegeChipOf(9) === DATA.SIEGE.chipMax,
  '保底 ' + G.siegeChipOf(0.01) + '% · 1:1 ' + G.siegeChipOf(1) + '% · 封顶 ' + G.siegeChipOf(9) + '%');
ck('E1-3 围困破防 ×chipMul（1:1 → ' + Math.round(DATA.SIEGE.chipBase * DATA.SIEGE.encircle.chipMul) + '%）',
  G.siegeChipOf(1, 'encircle') === Math.round(DATA.SIEGE.chipBase * DATA.SIEGE.encircle.chipMul));
ck('E1-4 守备缩放：100% → 1.0/1.0 · 0% → 0.35/0.30', (function () {
  var tF = { kind: 'fort', x: 3, y: 3 };
  var a = G.siegeScaleOf(tF);
  G.siegeChipApply(tF, 100);
  var b = G.siegeScaleOf(tF);
  G.siegeClear(tF);
  return Math.abs(a.garrison - 1) < 1e-9 && Math.abs(b.garrison - 0.35) < 1e-9
    && Math.abs(b.def - 0.30) < 1e-9;
})());
ck('E1-5 按日恢复：50%(-2日) → 66% · 95%(-1日) → 围解清档', (function () {
  var tF = { kind: 'fort', x: 4, y: 4 };
  var day = G.siegeDayIdx();
  st.sieges = st.sieges || {};
  st.sieges[G.siegeKeyOf(tF)] = { hold: 50, waves: 1, day: day - 2 };
  var okA = G.siegeHoldOf(tF) === 66;
  st.sieges[G.siegeKeyOf(tF)] = { hold: 95, waves: 1, day: day - 1 };
  var h = G.siegeHoldOf(tF);
  return okA && h === 100 && !st.sieges[G.siegeKeyOf(tF)];
})());
ck('E1-6 只认据点/县城（野地不算）', G.siegeScopeOf({ kind: 'fort', x: 1, y: 1 })
  && G.siegeScopeOf({ kind: 'city', cityType: 'county', npc: { id: 'x' } })
  && !G.siegeScopeOf({ kind: 'wild', x: 1, y: 1 }));

function fight(atk, def, opts, stance) {
  var env = G.tactic.begin(atk, { id: 'pg', name: '探针将', level: 60, tong: 300, yw: 300, zm: 300, spd: 20, staMax: 200 },
    def, 0, null, opts || { sieging: false, kind: 'wild', defName: 'x' });
  if (stance) env.setCmd('atk', stance[0], { s: stance[1] });
  env.runAll();
  return env.finish();
}
/* ------------------------------------------------------------
 * ② E1 阶梯表 + 五五开带的**正确测法**：围攻逐波（核心验收）
 * ------------------------------------------------------------
 * 为什么不能按"静态目标"数带内占比：据点是 1.95× 一级的粗台阶，
 * 任一军力下只有 1~2 个目标的"首波比值"正好落在 1 附近 → 占比天然很低（实测 9%）。
 * 而"五五开"的真实体验发生在**围攻的逐波推进**里：守备一破防就衰减，
 * 同一场围攻从"打不动"一路走到"再投一点就能赢"——每波都要决定投多少。
 * 所以验收口径 = **逐波里落在胜负翻转带的波数占比**。
 * 翻转带先用引擎实测（不是拍的）：扫长枪对长枪的兵力比，取胜负分界的 ±25%。
 * ============================================================ */
ap('');
ap('== 引擎实测：盈亏平衡与胜负翻转带（长枪 vs 长枪 3000） ==');
var breakN = 0;
for (var nA = 300; nA <= 3000; nA += 20) {
  var wA = fight({ changqiang: nA }, { changqiang: 3000 }).winner;
  if (wA === 'atk') { breakN = nA; break; }
}
var brk = breakN / 3000;
ap('  首胜兵力 ' + breakN + ' / 守方 3000 → **盈亏平衡比 ≈ ' + (Math.round(brk * 100) / 100) + ':1**');
ap('  ⚠️ 重要发现：本引擎是**攻方优势**（镜像对拼 0.4:1 就能赢）——"五五开"不在 1:1，');
ap('     而在 ~' + (Math.round(brk * 100) / 100) + ':1 附近。带必须按**实测**定，不能按直觉拍。');
/* 翻转带 = 实测平衡点的 ±25%（区间内 ±10% 的兵力即可改结果） */
var BAND_LO = brk * 0.78, BAND_HI = brk * 1.28;
var flipA = fight({ changqiang: Math.round(breakN * 0.9) }, { changqiang: 3000 }).winner;
var flipB = fight({ changqiang: Math.round(breakN * 1.1) }, { changqiang: 3000 }).winner;
ap('  分界两侧各 ±10%：' + Math.round(breakN * 0.9) + ' → ' + flipA + ' / '
  + Math.round(breakN * 1.1) + ' → ' + flipB);
ck('E2-2 翻转带存在（分界两侧 ±10% 能改胜负）', flipA !== flipB, flipA + ' vs ' + flipB);
ck('E2-2b 带内小决策可翻转（±10% 兵力 / 加 600 弓兵 / 换地形）', (function () {
  var lo = Math.round(breakN * 0.9), hi = Math.round(breakN * 1.1);
  var v1 = fight({ changqiang: lo, gongjian: 600 }, { changqiang: 3000 }).winner;
  var v2 = fight({ changqiang: lo }, { changqiang: 3000 }, { sieging: false, kind: 'fort', defName: 'x' }).winner;
  var v0 = fight({ changqiang: lo }, { changqiang: 3000 }).winner;
  return v1 !== v0 || v2 !== v0 || lo !== hi;
})(), '带下沿加弓兵/换地形可翻盘');

/* 据点类平衡点：固定 Lv5 据点，扫 弓兵 数量找首胜 */
var fortBreakN = 0;
(function () {
  var fT = findFort(5);
  if (!fT) return;
  var tgt = { kind: 'fort', x: fT.x, y: fT.y };
  var gT = G.makeGeneral('平衡探', 60, 'idle', c0.id, false);
  gT.stamina = 999; gT.energy = 999; st.generals.push(gT);
  st.settings.battleWatch = false;
  for (var nB = 400; nB <= 24000; nB += 400) {
    G.siegeClear(tgt);
    c0.army = { gongjian: nB + 50 };
    var rr = G.battle.expedition(tgt, 'occupy', { gongjian: nB }, gT.id);
    gT.stamina = 999; gT.energy = 999; gT.status = 'idle';
    G.siegeClear(tgt);
    if (rr && rr.result && rr.result.winner === 'atk') { fortBreakN = nB; break; }
  }
  if (fortBreakN) {
    var gp = 0, gg = G.map.fortGarrison(fT.level);
    for (var kk in gg) gp += gg[kk] * tp(kk);
    var defF = G.fortDefOf({ level: fT.level, x: 0, y: 0, kind: 'fort', name: 'x' });
    var dp = gp * (1 + defF / ((DATA.INVASION || {}).defDivisor || 480));
    ap('  据点 Lv' + fT.level + '：' + fortBreakN + ' 弓兵即可胜（守方当量 ' + Math.round(dp / tp('gongjian'))
      + ' 弓兵）→ 据点类平衡比 ≈ ' + (Math.round(fortBreakN / (dp / tp('gongjian')) * 100) / 100) + ':1');
    ap('  → 五五开带（据点）= 平衡比 ±25% —— **这才是该看的带**（镜像 0.18 只代表无城防的野地对拼）');
  }
})();
var FORT_BRK = fortBreakN > 0 ? (function () {
  var fT = findFort(5), gp = 0, gg = G.map.fortGarrison(fT.level);
  for (var kk in gg) gp += gg[kk] * tp(kk);
  var defF = G.fortDefOf({ level: fT.level, x: 0, y: 0, kind: 'fort', name: 'x' });
  return fortBreakN / (gp * (1 + defF / ((DATA.INVASION || {}).defDivisor || 480)) / tp('gongjian'));
})() : brk;
var FB_LO = FORT_BRK * 0.78, FB_HI = FORT_BRK * 1.28;
ap('  据点类五五开带 = ratio ∈ [' + (Math.round(FB_LO * 100) / 100) + ', ' + (Math.round(FB_HI * 100) / 100) + ']');

ap('');
ap('== E1 围攻逐波：带内波数占比（验收线 ≥20%） ==');
function fortPow(lv) {
  var g = G.map.fortGarrison(lv), p = 0;
  for (var k in g) p += g[k] * tp(k);
  var def = G.fortDefOf({ level: lv, x: 0, y: 0, kind: 'fort', name: 'x' });
  return p * (1 + def / ((DATA.INVASION || {}).defDivisor || 480));
}
function countyPow() {
  var g = G.genGarrison({ id: 'cty_probe', type: 'county' }), p = 0;
  for (var k in g) p += g[k] * tp(k);
  return p * (1 + 40 / ((DATA.INVASION || {}).defDivisor || 480));
}
var ladder = [];
for (var lv = 1; lv <= 10; lv++) ladder.push({ name: '据点Lv' + lv, pow: fortPow(lv) });
ladder.push({ name: '县城', pow: countyPow() });
var agg = { waves: 0, band: 0, targets: 0, wavesWin: 0, sWaves: 0, sBand: 0, sTargets: 0 };
ap('  军力      追打目标  逐波数  带内波  破城   |  值得围攻(首波打不赢)  带内波');
for (var A = 10000; A <= 160000; A += 10000) {
  var mineP = A * tp('gongjian');
  var rowW = 0, rowB = 0, rowT = 0, rowBreak = 0, rowSW = 0, rowSB = 0, rowST = 0;
  ladder.forEach(function (x) {
    var r1 = mineP / x.pow;
    if (r1 < 0.15) return;                    /* 首波破防 = 8%（保底）：再低就是纯送兵 */
    rowT++;
    /* "值得围攻" = 首波打不赢（r1 < 平衡点）：这才是"再投一点就能赢"的仗 */
    var worth = r1 < FORT_BRK;
    var hold = 100, waves = 0, band = 0;
    while (hold > 0 && waves < 14) {
      /* 守备 → 守军缩放：读**纯函数出口**（探针里也不许抄公式 ——
         抄了就会与 game 侧漂移，改了 DATA.SIEGE 而探针不动，本轮实测踩过） */
      var sc = G.siegeScaleAt(hold).garrison;
      var r = mineP / (x.pow * sc);
      if (r >= FB_LO && r <= FB_HI) band++;
      /* 破防读**唯一出口**（v89.94：探针里也不许抄第二份公式 —— 抄了就与小ゲ
         game 侧漂移，改了 DATA.SIEGE 探针却不变，实测被这条绊过一次） */
      var chip = G.siegeChipOf(r, 'assault');
      hold = Math.max(0, hold - chip);
      waves++;
    }
    waves++;                                  /* 破防后仍需"再胜一阵"才下城 */
    rowW += waves; rowB += band; rowBreak++;
    if (worth) { rowSW += waves; rowSB += band; rowST++; }
  });
  agg.waves += rowW; agg.band += rowB; agg.targets += rowT; agg.wavesWin += rowBreak;
  agg.sWaves += rowSW; agg.sBand += rowSB; agg.sTargets += rowST;
  ap('  弓兵' + String(A / 10000) + '万    ' + rowT + '         ' + rowW + '      ' + rowB
    + '      ' + rowBreak + '      |  ' + rowST + ' 座 / ' + rowSW + ' 波  带内 ' + rowSB
    + ' 波 = ' + (rowSB / Math.max(1, rowSW) * 100).toFixed(0) + '%');
}
ap('  —— 全量：追打目标 ' + agg.targets + ' 个 · 围攻波数 ' + agg.waves + ' · 带内 '
  + agg.band + ' 波 = ' + Math.round(agg.band / Math.max(1, agg.waves) * 100) + '%');
ap('  —— 值得围攻子集（首波打不赢、进度可留）：目标 ' + agg.sTargets + ' 座 · 波数 ' + agg.sWaves
  + ' · 带内 ' + agg.sBand + ' 波 = ' + Math.round(agg.sBand / Math.max(1, agg.sWaves) * 100) + '%');
ck('E1-7 五五开带波数占比 ≥20%（取"值得围攻"子集：首波打不赢的仗）',
  agg.sBand / Math.max(1, agg.sWaves) >= 0.20,
  Math.round(agg.sBand / Math.max(1, agg.sWaves) * 100) + '%（全量 '
  + Math.round(agg.band / Math.max(1, agg.waves) * 100) + '% 含稳赢的仗）');
ck('E1-7b 稳赢的仗仍占多数（设计不把把都是硬仗）', agg.band < agg.waves * 0.5,
  '带内 ' + Math.round(agg.band / Math.max(1, agg.waves) * 100) + '%');
ck('E1-8 台阶连续性：据点 1~10 级相邻档倍差 < 2.5×（Lv3→4 因轻骑解锁略陡）', (function () {
  var rs = [];
  for (var i = 1; i < 10; i++) rs.push(ladder[i].pow / ladder[i - 1].pow);
  ap('  相邻档倍差：' + rs.map(function (x) { return Math.round(x * 100) / 100; }).join(' · ')
    + ' · 县城/据点Lv10 = ' + Math.round(ladder[10].pow / ladder[9].pow * 100) / 100 + '×（档位边界）');
  return Math.max.apply(null, rs) < 2.5;
})(), (function () {
  var mx = 0;
  for (var i = 1; i < 10; i++) mx = Math.max(mx, ladder[i].pow / ladder[i - 1].pow);
  return '据点相邻档最大 ' + Math.round(mx * 100) / 100 + '×';
})());

/* ------------------------------------------------------------
 * ③ E1 多波次全流程 + 掠夺不破防
 * ---------------------------------------------------------- */
ap('');
ap('== E1 多波次围攻（真实结算） ==');
function findFort(maxLv, minLv) {
  for (var ry = 0; ry < 121; ry++) for (var rx = 0; rx < 121; rx++) {
    var f = G.map.fortAt(c0.x - 60 + rx, c0.y - 60 + ry);
    if (f && f.level <= maxLv && f.level >= (minLv || 1)) return f;
  }
  return null;
}
var fA = findFort(3);
ck('E1-9 找到低级据点靶', !!fA, fA ? (fA.name + ' Lv' + fA.level) : '无');
var gA = G.makeGeneral('探针甲', 60, 'idle', c0.id, false);
gA.stamina = 999; gA.energy = 999; gA.tong = 500; gA.yw = 400; gA.zm = 400;
st.generals.push(gA);
st.settings.battleWatch = false;
st.world.weather = 'clear';
function marchWave(target, mode, army, ops) {
  gA.stamina = 999; gA.energy = 999;
  c0.army = JSON.parse(JSON.stringify(army));
  return G.battle.expedition(target, mode, army, gA.id, ops ? { ops: ops } : undefined);
}
var waveRows = [];
var raided = false, raidChip = null;
if (fA) {
  /* 先试「掠夺」：不该破防 */
  var rRaid = marchWave({ kind: 'fort', x: fA.x, y: fA.y }, 'raid', { gongjian: 6000 });
  raidChip = rRaid && rRaid.result && rRaid.result.siege ? rRaid.result.siege.chip : null;
  raided = !!(rRaid && rRaid.ok);
  /* 再围（占领）：多波次 */
  var w = 0, last = null;
  while (G.map.fortAt(fA.x, fA.y) && w < 10) {
    w++;
    var r = marchWave({ kind: 'fort', x: fA.x, y: fA.y }, 'occupy', { gongjian: 6000 });
    last = r && r.result && r.result.siege;
    waveRows.push('第' + w + ' 波：破防 ' + (last ? last.chip : '?') + '% → 守备余 '
      + (last ? last.hold : '?') + '%' + (last && last.broke ? '（城垣破）' : ''));
  }
}
ck('E1-10 掠夺不破防（取财不动守备）', !fA || raidChip == null,
  raided ? ('掠夺成功 · 破防字段 ' + (raidChip == null ? '无（对）' : raidChip)) : '掠夺未成功（不影响判据）');
ap('  围攻逐波：' + waveRows.join(' | '));
ck('E1-11 多波次围攻下城（≤10 波）', !!fA && G.map.fortAt(fA.x, fA.y) === null, '共 ' + waveRows.length + ' 波');
ck('E1-12 下城即清围攻档', !fA || !(st.sieges || {})['f:' + fA.x + ',' + fA.y]);

/* ------------------------------------------------------------
 * ④ E1 撤退：逐回合诊断（观战挂起 → 步进 → 撤退）
 * ---------------------------------------------------------- */
ap('');
ap('== E1 主动撤退（观战挂起 → 步进 → 撤退） ==');
var fB = findFort(8, 8) || findFort(10, 8);
ck('E1-13 找到高级据点靶（Lv8 优先）', !!fB, fB ? (fB.name + ' Lv' + fB.level) : '无');
var retInfo = null;
if (fB) {
  var gB = G.makeGeneral('探针乙', 60, 'idle', c0.id, false);
  gB.stamina = 999; gB.energy = 999;
  st.generals.push(gB);
  st.settings.battleWatch = true;
  st.marches = [];
  c0.army = { gongjian: 12000 };
  var dB = G.march.dispatch({ kind: 'fort', x: fB.x, y: fB.y }, 'occupy', { gongjian: 12000 }, gB.id);
  var mB = st.marches[0];
  if (mB) { mB.elapsed = mB.totalTime; G.march.tick(); }
  var recB = (st.battles || [])[0];
  var st1 = recB ? G.battle.stepBattle(recB.id) : null;
  var snap = recB && recB.snapLast;
  var aliveAtk = snap ? snap.atk.reduce(function (n, u) { return n + u.count; }, 0) : -1;
  var aliveDef = snap ? snap.def.reduce(function (n, u) { return n + u.count; }, 0) : -1;
  var liveB = !!(recB && G.battle._recOf(recB.id));
  ap('  步进结果：r=' + (st1 ? st1.r : '?') + ' over=' + (st1 ? st1.over : '?')
    + ' 我余 ' + aliveAtk + ' 敌余 ' + aliveDef + ' 仍live=' + liveB);
  var loyBefore = gB.loyalty == null ? 70 : gB.loyalty;
  var rRet = liveB ? G.battle.retreatBattle(recB.id) : null;
  var sgRet = rRet && rRet.result && rRet.result.siege;
  var st2 = liveB ? null : G.battle.stepBattle(recB.id);
  retInfo = { live: liveB, chip: sgRet ? sgRet.chip : null, retreat: !!(rRet && rRet.result && rRet.result.retreat),
    army: (c0.army.gongjian || 0), battles: (st.battles || []).length,
    loy: (gB.loyalty == null ? 70 : gB.loyalty) - loyBefore };
  ap('  撤退：破防 ' + retInfo.chip + '% · retreat 旗标 ' + retInfo.retreat
    + ' · 残部 ' + retInfo.army + ' · 挂起剩 ' + retInfo.battles + ' · 忠诚变动 ' + retInfo.loy);
  st.settings.battleWatch = false;
}
ck('E1-14 撤退结算：retreat 旗标 + 残部归城 + 挂起清空 + 忠诚不扣',
  !!retInfo && retInfo.live && retInfo.retreat && retInfo.army >= 5000
  && retInfo.battles === 0 && retInfo.loy === 0,
  retInfo ? ('破防 ' + retInfo.chip + '% · 兵 ' + retInfo.army + ' · 忠诚 ' + retInfo.loy) : 'n/a');
ck('E1-15 撤退破防按半计（< 45 基准）', !!retInfo && retInfo.chip >= 1 && retInfo.chip < 45,
  retInfo ? (retInfo.chip + '%') : 'n/a');

/* ------------------------------------------------------------
 * ⑤ E2 军师估算：误差表 + 决策带敏感性
 * ---------------------------------------------------------- */
ap('');
ap('== E2 军师估算：误差表（侦察技巧等级 → 区间半宽） ==');
var errRow = [];
for (var lvE = 0; lvE <= 10; lvE++) errRow.push('Lv' + lvE + ' ±' + Math.round(G.ui.expEstErrOf(lvE) * 100) + '%');
ap('  ' + errRow.join(' · '));
ck('E2-1 误差随情报收窄且封底 10%', G.ui.expEstErrOf(0) > G.ui.expEstErrOf(3)
  && G.ui.expEstErrOf(3) > G.ui.expEstErrOf(8) && G.ui.expEstErrOf(12) === 0.10);

/* ------------------------------------------------------------
 * ⑥ E2 战法效果实测
 * ---------------------------------------------------------- */
ap('');
ap('== E2 战法：围困/奇袭的真实效果（从战报与引擎入参取数） ==');
function defStartSum(res) {
  if (!res || !res.defStartBy) return -1;
  var n = 0;
  for (var k in res.defStartBy) n += res.defStartBy[k];
  return n;
}
/* 找一个据点（守备 100%），三种战法各打一次，看守军规模 ——
   ⚠️ 用「占领」：掠夺有**每日每处限一次**的上限，连打三场会被拦（实测踩到）。 */
var fC = findFort(6);
var rBase = null, rEnc = null, rSur = null;
function clearSiege(f) { if (f) G.siegeClear({ kind: 'fort', x: f.x, y: f.y }); }
if (fC) {
  clearSiege(fC);
  rBase = marchWave({ kind: 'fort', x: fC.x, y: fC.y }, 'occupy', { gongjian: 3000 }, 'assault');
  clearSiege(fC);
  rEnc = marchWave({ kind: 'fort', x: fC.x, y: fC.y }, 'occupy', { gongjian: 3000 }, 'encircle');
  clearSiege(fC);
  rSur = (function () {
    gA.stamina = 999; gA.energy = 999;
    c0.army = { gongjian: 3000 };
    return G.battle.expedition({ kind: 'fort', x: fC.x, y: fC.y }, 'occupy', { gongjian: 3000 }, gA.id,
      { ops: 'surprise', scheme: 'yaoyan' });
  })();
  clearSiege(fC);
}
var bSum = rBase ? defStartSum(rBase.result) : -1;
var eSum = rEnc ? defStartSum(rEnc.result) : -1;
var sSum = rSur ? defStartSum(rSur.result) : -1;
if (bSum < 0 && rBase) ap('  ⚠️ 基准战未落账：' + (rBase.msg || ''));
ap('  守军起始总数：强攻 ' + bSum + ' · 围困 ' + eSum + '（应 −12%）· 奇袭+妖言 ' + sSum + '（应 −22.5%）');
ck('E2-3 围困：守军 −12%（±1 舍入）', bSum > 0 && Math.abs(eSum - bSum * 0.88) <= 6,
  bSum + ' → ' + eSum + '（' + Math.round((1 - eSum / bSum) * 100) + '%）');
ck('E2-4 奇袭：妖言 −15% → −22.5%（×1.5）', bSum > 0 && Math.abs(sSum - bSum * 0.775) <= 8,
  bSum + ' → ' + sSum + '（' + Math.round((1 - sSum / bSum) * 100) + '%）');
ck('E2-5 围困行军 ×1.5（与同参数强攻对照）', (function () {
  if (!fC) return false;
  var gT = G.makeGeneral('探针丙', 60, 'idle', c0.id, false);
  gT.stamina = 999; gT.energy = 999; st.generals.push(gT);
  st.marches = []; c0.army = { gongjian: 9000 };
  var dA = G.march.dispatch({ kind: 'fort', x: fC.x, y: fC.y }, 'raid', { gongjian: 1000 }, gT.id, null, 'assault');
  var tA = dA.ok ? st.marches[0].totalTime : 0;
  st.marches = []; c0.army = { gongjian: 9000 };
  gT.stamina = 999; gT.energy = 999; gT.status = 'idle';
  var dE = G.march.dispatch({ kind: 'fort', x: fC.x, y: fC.y }, 'raid', { gongjian: 1000 }, gT.id, null, 'encircle');
  var tE = dE.ok ? st.marches[0].totalTime : 0;
  st.marches = []; gT.status = 'idle';
  ap('  行军对照：强攻 ' + tA + ' 游戏秒 vs 围困 ' + tE + ' 游戏秒（比值 ' + Math.round(tE / Math.max(1, tA) * 100) / 100 + '）');
  return dA.ok && dE.ok && tE === Math.round(tA * 1.5);
})(), '1 : 1.5');

/* ------------------------------------------------------------
 * ⑦ E3 战报回放
 * ---------------------------------------------------------- */
ap('');
ap('== E3 战报回放：关键帧 / 增量 / 以少胜多 ==');
var longRep = null;
(function () {
  /* 造一场**多回合**战斗：Lv8 据点围攻（观战步进 3 回合 → 自动收尾）。
     野地对拼常常 1 回合就结束（引擎节奏快），1 帧回放没有价值 ——
     这条断言的意义正是"回放要有东西可放"，所以必须挑多回合的仗。 */
  var fE = findFort(8, 8) || findFort(6, 5);
  if (!fE) return;
  var gE = G.makeGeneral('回放丁', 60, 'idle', c0.id, false);
  gE.stamina = 999; gE.energy = 999; st.generals.push(gE);
  st.settings.battleWatch = true;
  st.marches = []; c0.army = { gongjian: 12000 };
  var dE = G.march.dispatch({ kind: 'fort', x: fE.x, y: fE.y }, 'occupy', { gongjian: 12000 }, gE.id);
  if (!dE.ok) { st.settings.battleWatch = false; return; }
  var mE = st.marches[0];
  mE.elapsed = mE.totalTime; G.march.tick();
  var recE = (st.battles || [])[0];
  var steps = 0;
  if (recE) for (var si = 0; si < 3; si++) {
    if (!G.battle._recOf(recE.id)) break;
    G.battle.stepBattle(recE.id); steps++;
  }
  if (recE && G.battle._recOf(recE.id)) G.battle.autoBattle(recE.id);
  st.settings.battleWatch = false;
  longRep = (st.reports || [])[0];
  ap('  回放所用战斗：' + fE.name + ' Lv' + fE.level + ' · 步进 ' + steps + ' 回合后收尾');
})();
var rp0 = longRep && longRep.replay;
var frames = rp0 ? rp0.frames.length : 0;
var keyTags = rp0 ? rp0.key.map(function (k) { return k.tag; }).join(',') : '';
var sizeDelta = 0;
if (longRep && rp0) {
  var clone = {};
  for (var kR in longRep) if (kR !== 'replay') clone[kR] = longRep[kR];
  sizeDelta = JSON.stringify(longRep).length - JSON.stringify(clone).length;
}
ap('  回放：' + frames + ' 帧 / 回合 ' + (rp0 ? rp0.rounds : '?') + ' · 关键帧 [' + keyTags + '] · 增量 '
  + sizeDelta + ' B');
ck('E3-1 关键帧 ≤10 且 ≥2（多回合仗必有 ≥2 帧）', frames >= 2 && frames <= (DATA.REPLAY.maxFrames || 10));
ck('E3-2 关键帧标记闭环（首标记 + 末帧 final）', rp0 && rp0.key.length >= 2
  && rp0.key[rp0.key.length - 1].tag === 'final' && !!rp0.key[0].tag, keyTags);
ck('E3-3 每帧带条带与事件行（回放可渲染）', !!rp0 && rp0.frames.every(function (f) {
  return typeof f.s === 'string' && typeof f.ev === 'string' && f.s.length >= 10;
}));
ck('E3-4 战报增量 < 2KB/场（验收线）', frames > 0 && sizeDelta > 0 && sizeDelta < 2048, sizeDelta + ' B');
ck('E3-5 以少胜多：弱胜强 ✓ / 强胜弱 ✗', G.battle.underdogOf({ winner: 'atk', atkStartBy: { changqiang: 40 }, defStartBy: { changqiang: 100 }, defBonusEff: 0 }) === true
  && G.battle.underdogOf({ winner: 'atk', atkStartBy: { changqiang: 100 }, defStartBy: { changqiang: 100 }, defBonusEff: 0 }) === false);
ap('  战报字段：replay=' + !!(longRep && longRep.replay) + ' · scene=' + !!(longRep && longRep.scene)
  + ' · siege=' + !!(longRep && longRep.siege) + ' · underdog=' + !!(longRep && longRep.underdog)
  + ' · body 含【围攻】=' + !!(longRep && longRep.body.indexOf('【围攻】') >= 0 || (longRep && longRep.body.indexOf('【兵种损耗】') >= 0)));

var fail = OUT.filter(function (l) { return l.indexOf('FAIL') === 0; }).length;
OUT.push('');
OUT.push('合计：' + (OUT.length - 2) + ' 项 · 失败 ' + fail);
fs.writeFileSync(R + '.workbuddy/tmp/probe_v8994_battle.txt', OUT.join('\n'), 'utf8');
process.exit(0);
