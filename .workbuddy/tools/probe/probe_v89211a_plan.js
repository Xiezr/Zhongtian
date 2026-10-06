/* v89.211 探针 A：城内地块布局与占城补齐（老板 2「占领县城后有一格未建造 · 猜测是仓库」）
   ------------------------------------------------------------
   实证目标：① 8×6 布局里"城墙格"= r5c6（idx37）——它就是占城后被释放的空格；
             ② 占城（onConquer）后城内 48 格应全建成（城墙格补民房）——目标态；
             ③ 存量档修复出口 migrateWallCell211 按签名补齐（只碰"占来的城+恰一空格在墙位"）。
   落盘前跑 → 红；落盘后跑 → 全绿。
   运行：node .workbuddy/tools/probe/probe_v89211a_plan.js（输出重定向到文件再读） */
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra == null ? '' : extra) + ']'); }
}

var keep = G.state;
try {
  /* ---------- ① 布局定位 ---------- */
  console.log('=== ① 8×6 布局里的城墙格与仓库 ===');
  var plan = G.cityPlanOf(5, 12);
  var wallIdx = -1, cang = [], mf = 0;
  plan.cells.forEach(function (c, i) {
    if (!c.build) return;
    if (c.build.id === 'chengqiang') wallIdx = i;
    if (c.build.id === 'cangku') cang.push(i);
    if (c.build.id === 'minfang') mf++;
  });
  chk('①a 布局里城墙格 = r5c6（idx37）', wallIdx === 37, 'idx=' + wallIdx);
  chk('①b 仓库 4 座（r1c4/r4c6/r5c4/r5c5）', cang.join(',') === '3,29,35,36', cang.join(','));
  chk('①c 布局民房 26 座（城墙格不在民房列）', mf === 26, 'n=' + mf);

  /* ---------- ② 占城（真调 onConquer）→ 城内应全建成 ---------- */
  console.log('=== ② 占城后城内空格 ===');
  var st = G.newGame({ name: '布局探针', cityName: '许都', mapSeed: 7 });
  G.state = st;
  if (!st.map.grid) G.map.generate();
  var vic = st.map.cities.filter(function (c) { return c.type === 'county'; })[0];
  chk('②a 找到县城档 NPC 城', !!vic, vic && vic.name);
  G.onConquer(vic, { winner: 'atk' }, st.generals[0]);
  var nc = st.cities[st.cities.length - 1];
  chk('②b 占城入库（末位新记录）', nc && nc.origId === vic.id, nc && nc.name);
  var emptN = 0, emptIdx = [], mfN = 0;
  (nc.cells || []).forEach(function (c, i) {
    if (!c.build && !c.pending) { emptN++; emptIdx.push(i); }
    if (c.build && c.build.id === 'minfang') mfN++;
  });
  chk('②c 占城后 0 空格（城墙格补建 · 目标态）', emptN === 0,
    '空 ' + emptN + ' 格 idx=' + emptIdx.join(','));
  chk('②d 城墙格补为民房（民房 26→27）', mfN === 27, 'minfang=' + mfN);
  chk('②e 城墙仍回环城槽（不占格 · 等级在册）', !!(nc.wall && nc.wall.build),
    nc.wall && nc.wall.build ? 'Lv' + nc.wall.build.lvl : 'null');
  chk('②f 48 格无城墙残留', !(nc.cells || []).some(function (c) { return c.build && c.build.id === 'chengqiang'; }));

  /* ---------- ③ 存量档修复出口（migrateWallCell211） ---------- */
  console.log('=== ③ 存量档修复（签名：占来的城 + 恰一空格在墙位）===');
  chk('③a GAME.migrateWallCell211 在册', typeof G.migrateWallCell211 === 'function');
  if (typeof G.migrateWallCell211 === 'function') {
    /* 造"旧版释放后"的现场：把 ② 的城退回空格 */
    nc.cells[37].build = null; nc.cells[37].pending = null;
    var before = nc.cells[37].build;
    var s2 = G.migrateWallCell211(st);
    chk('③b 旧签名命中 → 墙位补齐民房（等级随城墙环）',
      nc.cells[37].build && nc.cells[37].build.id === 'minfang'
        && nc.cells[37].build.lvl === (nc.wall.build && nc.wall.build.lvl),
      JSON.stringify(nc.cells[37].build) + ' wallLv=' + (nc.wall.build && nc.wall.build.lvl));
    /* 负例 1：玩家自建城（无 origId、恰一空格）→ 不得补 */
    var p1 = st.cities[0];
    var p1Empty0 = 0;
    (p1.cells || []).forEach(function (c) { if (!c.build && !c.pending) p1Empty0++; });
    G.migrateWallCell211(st);
    var p1Empty1 = 0;
    (p1.cells || []).forEach(function (c) { if (!c.build && !c.pending) p1Empty1++; });
    chk('③c 玩家自建城不被动（空格数不变）', p1Empty0 === p1Empty1 && p1Empty0 > 0,
      p1Empty0 + '→' + p1Empty1);
    /* 负例 2：占来的城但空格 ≥2（玩家动过）→ 不补 */
    nc.cells[5].build = null; nc.cells[5].pending = null;   /* 再拆一格 → 两空格 */
    nc.cells[37].build = null; nc.cells[37].pending = null;
    G.migrateWallCell211(st);
    chk('③d 签名不符（两空格）不补', !nc.cells[37].build);
    /* 负例 3：在建格（pending）不算空格 → 不因它误判 */
    nc.cells[5].pending = { id: 'minfang' };
    G.migrateWallCell211(st);
    chk('③e 在建格不算空（不误判）', !nc.cells[37].build);
    nc.cells[5].pending = null;
  }

  /* ---------- ④ 源码核对 ---------- */
  console.log('=== ④ 源码（唯一出口）===');
  var bS = fs.readFileSync(R + 'js/battle.js', 'utf8');
  var iRel = bS.indexOf('v89.211');
  chk('④a battle.js 占城释放块已改"补民房"', iRel >= 0 && /minfang/.test(bS.slice(iRel, iRel + 600)),
    iRel >= 0 ? 'ankle@' + iRel : 'no v89.211');
  var sS = fs.readFileSync(R + 'js/state.js', 'utf8');
  chk('④b state.js 迁移释放块已改"补民房"', /v89.211[\s\S]{0,400}minfang/.test(sS)
    || /minfang[\s\S]{0,200}v89\.211/.test(sS));
} catch (e) {
  console.log('  ✗ 探针异常: ' + (e && e.stack || e));
  FAIL++;
} finally {
  G.state = keep;
}
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
