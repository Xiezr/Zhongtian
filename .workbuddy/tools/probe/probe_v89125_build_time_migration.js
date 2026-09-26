/* v89.125 探针：建筑时间表口径（城墙哨兵 0）与移民令新语义
   复跑：node .workbuddy/tools/probe/probe_v89125_build_time_migration.js
   —— ① 城墙时间"标称 vs 入队"：旧算法从 backup/v89125/data.js 提取真跑（防口述）；
   —— ② 移民令"每次 +上限 25%"（增量语义）实测。 */
var R = 'E:/Deepseekdb/';
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
  'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

console.log('════ ① 城墙时间：旧外推算法 vs 新数据（标称值）════');
/* 旧算法真跑：从改动前的备份 data.js 正则提取 `function extRows` */
var oldSrc = fs.readFileSync(path.join(R, '.workbuddy/backup/v89125/data.js'), 'utf8');
var mOld = oldSrc.match(/function extRows\(rows, n\) \{[\s\S]*?\n  \}/);
if (!mOld) {
  console.log('  ⚠ 未能从备份提取旧 extRows —— 跳过对照（备份缺失？）');
} else {
  var oldExtRows = eval('(' + mOld[0] + ')');
  /* 城墙原始表的 time 列全 0（哨兵）；资源列在外推中与 time 无关，用占位 1 */
  var wallRaw = [];
  for (var i = 0; i < 10; i++) wallRaw.push([1, 1, 1, 1, 0]);
  var oldOut = oldExtRows(wallRaw.map(function (r) { return r.slice(); }), 45);
  console.log('  旧算法外推 time 列（第 11/12/13 项）:', oldOut[10][4], oldOut[11][4], oldOut[12][4],
    '← 哨兵 0 被 max(1, 0×1.85) 变成 1、2');
}
var cq = DATA.BUILDINGS.chengqiang;
console.log('  新数据 levelCost(9/10/11/12).time =',
  [9, 10, 11, 12].map(function (lv) { return cq.levelCost(lv).time; }).join(' '), '（全 0 = 哨兵，走兜底 60）');

/* 真调入队（新局 + 官府 12 解闸 + wallLv=10） */
var st = G.newGame({ name: 'v125p', cityName: '许都' });
G.state = st;
var c = st.cities[0];
st.res.grain = 1e9; st.res.wood = 1e9; st.res.stone = 1e9; st.res.iron = 1e9;
(c.cells || []).forEach(function (cl) { if (cl.build && cl.build.id === 'guanfu') cl.build.lvl = 12; });
c.wallLv = 10;
var rw = G.upgradeWall(c.id);
var q = (st.queues.build || [])[0];
console.log('  真调升级 Lv10→11:', rw.ok, '| totalTime =', q && Math.round(q.totalTime),
  '（= max(60×倍率, 5×timeScale)，timeScale=' + G.timeScale() + '）');
console.log('  ⚠ 诚实说明：因"最短 5 现实秒"地板（5×' + G.timeScale() + '=' + G.buildMinTime() + ' 游戏秒），');
console.log('    修复前（标称 1 秒）与修复后的**入队时间相同** —— 玩家侧无感；');
console.log('    修复的是"标称值与时间表读数"（表里不该出现 1~2 秒），地板一旦调整即会暴露。');

console.log('');
console.log('════ ② 移民令：每次 +上限 25%（增量语义）════');
var c2 = st.cities[0];
G.ui._cityId = c2.id;
var cap = G.maxPopOf(c2);
st.items = st.items || {};
st.items.yiminling = 3;
c2.res.pop = Math.floor(cap * 0.4);
var r1 = G.systems.useItem('yiminling', null);
console.log('  上限 =', cap, '，pop 摆 40%');
console.log('  用一次 →', Math.round(c2.res.pop / cap * 100) + '%（旧口径"补到 50%"只会到 50%，新口径 +25%）ok=' + r1.ok);
console.log('    msg:', r1.msg);
c2.res.pop = cap;
var r2 = G.systems.useItem('yiminling', null);
console.log('  满员时使用 → ok=' + r2.ok + '｜msg=' + r2.msg + '｜库存未扣=' + (st.items.yiminling === 2) + '（用前 3）');

process.exit(0);
