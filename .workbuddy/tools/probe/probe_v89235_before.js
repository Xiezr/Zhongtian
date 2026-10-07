/* v89.235 改前取证：① 政务厅等级角标位置 vs 普通格子 ② 城外资源建筑升级闸现状
   运行：node .workbuddy/tools/probe/probe_v89235_before.js > 输出.txt 2>&1 */
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons',
  'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA;
var out = [];
function P() { out.push(Array.prototype.join.call(arguments, ' ')); }

G.newGame({ name: '取证', cityName: '灰岗', mapSeed: 20261007 });
if (!G.state.map.grid) G.map.generate();
var st = G.state, c = st.cities[0];

/* ===== ① 政务厅角标 DOM 结构取证（源码层，两侧对比） ===== */
P('===== ① 政务厅 vs 普通格子 渲染结构 =====');
var uiSrc = fs.readFileSync(R + 'js/ui.js', 'utf8');
/* 普通格子块（isoCell 里） */
var iBtn = uiSrc.indexOf("var lab = o.name");
P('普通格子（isoCell）:');
P(uiSrc.slice(uiSrc.indexOf('var badge = o.lvl', iBtn - 400), iBtn + 260).split('\n').slice(0, 8).join('\n'));
P('');
var iGov = uiSrc.indexOf("(lvl ? '<span class=\"tile-badge'", uiSrc.indexOf('govPalaceHTML'));
if (iGov < 0) iGov = uiSrc.indexOf("(lvl ? '<span class=\"tile-badge'");
var iGovStart = uiSrc.lastIndexOf('\n', iGov);
P('政务厅块（govPalaceHTML）:');
P(uiSrc.slice(iGovStart - 60, iGov + 200));
P('');

/* ===== ② 城外资源建筑升级闸现状 ===== */
P('===== ② 城外升级闸（改前行为） =====');
/* 造局：给城配资源 + 建政务厅 Lv2 + 建城外资源建筑，升到顶 */
c.res.grain = 9e7; c.res.wood = 9e7; c.res.stone = 9e7; c.res.iron = 9e7;
/* 先建政务厅（城 0 格是官府区，检查现状） */
var govLv = G.buildingLevel(c, 'guanfu');
P('初始政务厅等级:', govLv);
if (govLv === 0) {
  /* 找官府格建 */
  var gcells = G.govCellsOf ? G.govCellsOf(c) : null;
  P('govCellsOf:', JSON.stringify(gcells));
  if (gcells && gcells.length) {
    var rB = G.buildAt(c.id, gcells[0], 'guanfu');
    P('建政务厅:', JSON.stringify(rB));
    /* 推建造队列完成 */
    for (var i = 0; i < 400; i++) G.tickOnce();
    govLv = G.buildingLevel(c, 'guanfu');
    P('政务厅建成后等级:', govLv);
  }
}
/* 再升政务厅（验证闸）：在 c.cells 里找带 guanfu build 的那一格 */
var govIdx = -1;
for (var gi = 0; gi < c.cells.length; gi++) {
  if (c.cells[gi].build && c.cells[gi].build.id === 'guanfu') { govIdx = gi; break; }
}
P('政务厅格号:', govIdx, ' 等级:', govLv);
/* 连升政务厅到 Lv3（每次升级后推完队列） */
for (var up1 = 0; up1 < 3; up1++) {
  govLv = G.buildingLevel(c, 'guanfu');
  if (govLv >= 3) break;
  var ru = G.upgradeAt(c.id, govIdx);
  P('升政务厅 Lv' + (govLv + 1) + ':', JSON.stringify(ru));
  if (!ru.ok) break;
  for (var i2 = 0; i2 < 3000; i2++) G.tickOnce();
}
P('最终政务厅等级:', G.buildingLevel(c, 'guanfu'));

/* 建城外资源建筑（找空格） */
var eg = G.extGridOf(c);
var idx = -1;
for (var e2 = 0; e2 < eg.length; e2++) { if (!eg[e2].type && !eg[e2].pending) { idx = e2; break; } }
P('城外空格 idx:', idx);
if (idx >= 0) {
  var rB2 = G.buildExt(idx, 'farm');
  P('建净化厂:', rB2.ok, rB2.msg);
  for (var i3 = 0; i3 < 800; i3++) G.tickOnce();
  P('净化厂等级:', eg[idx].lv);
  /* 尝试升到 Lv2（政务厅 Lv2，应该允许） */
  var rU2 = G.upgradeExt(idx);
  P('升净化厂 Lv2:', rU2.ok, rU2.msg);
  for (var i4 = 0; i4 < 800; i4++) G.tickOnce();
  P('净化厂等级:', eg[idx].lv);
  /* 尝试升到 Lv3（政务厅 Lv2 → 改前应允许（bug）、改后应拒绝） */
  var rU3 = G.upgradeExt(idx);
  P('升净化厂 Lv3（政务厅 Lv2）:', rU3.ok, rU3.msg, ' ← 改前=ok（缺口）· 改后=拒');
  /* cap 读数 */
  P('buildCapOf(city) 无bid:', G.buildCapOf(c));
  P('buildCapOf(city,"farm"):', G.buildCapOf(c, 'farm'));
  P('buildCapCoreOf(city,"farm"):', G.buildCapCoreOf(c, 'farm'));
  /* 把政务厅升到 Lv3 → 净化厂应可升 Lv3（闭环）；先建围墙 Lv1（v89.157 既有链） */
  var rw = G.buildAt(c.id, 'wall', 'chengqiang');
  P('建围墙:', rw.ok, rw.msg);
  for (var iw = 0; iw < 3000; iw++) G.tickOnce();
  P('围墙等级:', G.buildingLevel(c, 'chengqiang'));
  for (var up2 = 0; up2 < 3; up2++) {
    govLv = G.buildingLevel(c, 'guanfu');
    if (govLv >= 3) break;
    var ru2 = G.upgradeAt(c.id, govIdx);
    P('升政务厅 Lv' + (govLv + 1) + ':', ru2.ok, ru2.msg);
    if (!ru2.ok) break;
    for (var i5 = 0; i5 < 3000; i5++) G.tickOnce();
  }
  var eg2 = G.extGridOf(c);
  P('政务厅到位后 Lv:', G.buildingLevel(c, 'guanfu'), ' 净化厂 Lv:', eg2[idx] && eg2[idx].lv);
  var rU4 = G.upgradeExt(idx);
  P('净化厂升 Lv3（政务厅 Lv3）:', rU4.ok, rU4.msg, ' ← 改后=ok（闭环）');
  for (var i6 = 0; i6 < 800; i6++) G.tickOnce();
  P('净化厂最终等级:', G.extGridOf(c)[idx] && G.extGridOf(c)[idx].lv);
}

fs.writeFileSync(R + '.workbuddy/tmp/p235_before.txt', out.join('\n'), 'utf8');
console.log('DONE');
process.exit(0);
