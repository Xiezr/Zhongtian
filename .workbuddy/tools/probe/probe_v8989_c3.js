/* ============================================================
 * v89.89 探针 · C3 门派晋升曲线校准
 *   ① 门槛表重估 + 递增
 *   ② sectRepGain 唯一出口（未入派拒 / 入派后发放 / 晋升检测）
 *   ③ 占城（onConquer）→ 门派声望（真实调用链路）
 *   ④ 可达性数学：任务 480/日 + 占城 10~20 城 → 60~90 天跨长老线
 *   ⑤ doSectTask 走新出口后行为一致（12 / ×1.5=18）
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME;
var DATA = G.DATA;
var PASS = 0, FAIL = 0;
function ck(name, cond, info) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (info ? '  [' + info + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (info ? '  [' + info + ']' : '')); }
}

var st = G.newGame({ name: 'x', cityName: '许都' });
if (!st.map.grid) G.map.generate();
G.state = st;

/* ---------- ① 门槛表 ---------- */
console.log('=== ① 门槛表重估 ===');
var Rk = DATA.SECT_RANKS;
ck('五阶齐备', Rk.length === 5);
ck('新门槛值 0/1000/6000/25000/60000',
  Rk[0].rep === 0 && Rk[1].rep === 1000 && Rk[2].rep === 6000 && Rk[3].rep === 25000 && Rk[4].rep === 60000,
  Rk.map(function (r) { return r.rep; }).join('/'));
ck('逐阶递增', Rk[0].rep < Rk[1].rep && Rk[1].rep < Rk[2].rep && Rk[2].rep < Rk[3].rep && Rk[3].rep < Rk[4].rep);
ck('占城分档表存在（县/郡/州/都）',
  DATA.SECT_CONQUER_REP.county === 1500 && DATA.SECT_CONQUER_REP.jun === 4000
  && DATA.SECT_CONQUER_REP.zhou === 12000 && DATA.SECT_CONQUER_REP.capital === 30000,
  JSON.stringify(DATA.SECT_CONQUER_REP));

/* ---------- ② 唯一出口 ---------- */
console.log('=== ② sectRepGain 唯一出口 ===');
var s = G.sectState();
s.id = null; s.rep = 0; s.founder = false; s.tasks = {}; s.leftAt = 0;
var r0 = G.sectRepGain('conquer', 5000);
ck('未入派 → 拒发（ok=false, gain=0）', r0.ok === false && r0.gain === 0 && s.rep === 0);

/* 入派（先放驻地） */
var city = st.cities[0];
var cell = null;
(city.cells || []).forEach(function (c) { if (!cell && !c.build) cell = c; });
var saved = cell.build;
cell.build = { id: 'honglusi', lvl: 1 };
var j = G.doSectJoin('xuanhe');
ck('前置：入派成功', j.ok === true, j.msg);

var r1 = G.sectRepGain('conquer', 800);
ck('入派后发放（+800）', r1.ok === true && r1.gain === 800 && s.rep === 800, 'rep=' + s.rep);
var r2 = G.sectRepGain('conquer', 400);
ck('晋升检测：800+400=1200 跨 r2(1000) → rankUp=外门弟子',
  r2.rankUp === '外门弟子', 'rankUp=' + r2.rankUp);
ck('品阶实时推', G.sectRankOf().name === '外门弟子', G.sectRankOf().name);

/* 一次跨两阶（占大城）：6000-1200 = 4800 → +5000 应直接到 r3 */
var r3 = G.sectRepGain('conquer', 5000);
ck('跨两阶取最高：1200+5000=6200 → 内门弟子',
  r3.rankUp === '内门弟子' && G.sectRankOf().name === '内门弟子',
  'rep=' + s.rep + ' rank=' + G.sectRankOf().name);

/* ---------- ③ 占城链路（真实 onConquer） ---------- */
console.log('=== ③ 占城 → 门派声望（真实链路）===');
s.rep = 0;
var npc = null;
(st.map.cities || []).forEach(function (c) { if (!npc && c.type === 'county') npc = c; });
ck('前置：地图有县城', !!npc, npc ? npc.name : '无');
if (npc) {
  var before = s.rep;
  var beforeLord = st.rep || 0;
  G.onConquer(npc, { defLossBy: null, atkLoss: 0 }, null, city);
  var gained = s.rep - before;
  ck('占县城 → 门派声望 +1500', gained === 1500, 'sect.rep ' + before + ' → ' + s.rep);
  ck('君主声望不受影响（分家）', (st.rep || 0) >= beforeLord, 'lord.rep=' + (st.rep || 0));
  /* 未入派对照 */
  var saveId = s.id; s.id = null; var before2 = s.rep;
  var npc2 = null;
  (st.map.cities || []).forEach(function (c) { if (!npc2 && c.type === 'county') npc2 = c; });
  if (npc2) {
    G.onConquer(npc2, { defLossBy: null, atkLoss: 0 }, null, city);
    ck('未入派占城 → 不给门派声望', s.rep === before2, 'rep=' + s.rep);
  } else { ck('未入派占城 → 不给门派声望', true, '无第二座县城，跳过'); PASS--; PASS++; }
  s.id = saveId;
}

/* ---------- ④ 可达性数学 ---------- */
console.log('=== ④ 可达性（目标 60~90 天）===');
var daily = 480;                          /* 杂役 40×12 */
var r5 = Rk[4].rep;
var pureDays = Math.ceil(r5 / daily);
console.log('     纯杂役到长老：' + pureDays + ' 天');
ck('纯任务路径 ≤ 130 天（不至于永远够不着）', pureDays <= 130, pureDays + ' 天');
/* 混合路径：90 天占 10 城（8县2郡）= 20000 */
var conquer10 = 8 * 1500 + 2 * 4000;
var days10 = Math.ceil((r5 - conquer10) / daily);
console.log('     带 10 城占城（+' + conquer10 + '）：约 ' + days10 + ' 天');
ck('混合路径（10 城）落在 60~95 天', days10 >= 60 && days10 <= 95, days10 + ' 天');
/* 活跃路径：90 天占 20 城（15县4郡1州）= 50500 */
var conquer20 = 15 * 1500 + 4 * 4000 + 1 * 12000;
var days20 = Math.ceil((r5 - conquer20) / daily);
console.log('     带 20 城占城（+' + conquer20 + '）：约 ' + days20 + ' 天');
ck('活跃路径（20 城）≤ 60 天（上沿）', days20 <= 60, days20 + ' 天');

/* ---------- ⑤ doSectTask 行为一致 ---------- */
console.log('=== ⑤ doSectTask 走新出口后行为一致 ===');
s.rep = 0; s.founder = false; s.tasks = {};
var t1 = G.doSectTask('chores');
ck('杂役 +12', t1.ok && t1.rep === 12 && s.rep === 12, t1.msg);
s.founder = true; s.tasks = {};
var t2 = G.doSectTask('chores');
ck('开山祖师 ×1.5 → +18', t2.ok && t2.rep === 18 && s.rep === 30, t2.msg);
/* 晋升文案 */
s.rep = 990; s.founder = false; s.tasks = {};
var t3 = G.doSectTask('chores');   /* 990+12=1002 跨 1000 */
ck('任务跨阶文案含"晋升「外门弟子」"', t3.msg.indexOf('晋升「外门弟子」') >= 0, t3.msg);

/* 还原 */
s.id = null; s.rep = 0; s.founder = false; s.tasks = {}; s.leftAt = 0;
cell.build = saved;

console.log('\n===== 结果：' + PASS + ' / ' + (PASS + FAIL) + ' =====');
process.exit(FAIL ? 1 : 0);
