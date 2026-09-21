/* ============================================================
 * v89.89 探针 · B1/D4/C4/E3/A3/A4 综合验证
 *   B1 任务一键全领（doClaimAllQuests 汇总 + 逐条出口）
 *   D4 战报筛选（setRepFilter）+ 收藏（toggleRepFav，随档字段）
 *   C4 故事集（storyHTML 渲染：已读显名/未读？？？/分类/重读入口）
 *   E3 人口三段条（troopHTML 工具条 pop-3 渲染）
 *   A3 歼敌值解释（战报正文含 title 悬停）
 *   A4 材料产地（matGoTargetOf 目标解析 + data-tip）
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
// 载入故事卷（与主页面一致）
['vol-01', 'vol-02', 'vol-03', 'vol-04', 'vol-05', 'vol-06', 'vol-07', 'vol-08', 'vol-09', 'vol-10',
 'vol-11', 'vol-12', 'vol-13', 'vol-14'].forEach(function (v) {
  try { require(path.join(R, 'story', v + '.js')); } catch (e) {}
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
var city = st.cities[0];

/* ============================================================
 * B1 任务一键全领
 * ============================================================ */
console.log('=== B1 任务一键全领 ===');
/* 前置：把难度=0 的成长任务直接置成"已达标" */
var li = 0;
(DATA.QUESTS || []).forEach(function (q) {
  if (li >= 2) return;
  if (G.questDone(q)) return;
  /* 直接写入 stash/计数不可行 —— 用"目标数"判定：growth 任务多数按 questAmount 现算。
     简便法：把 questAmount 打成目标值（借助调试：某些任务允许直接 push done log 不成立）。
     改用：找一个 random 池任务 + 用手动 claimQuest 不适用 → 直接调 doClaimAllQuests 看返回。 */
});
/* 直接验证出口：注册两条必达任务 —— 利用 stash 口径（troopCount 类任务读 stash） */
st.quests = st.quests || { pool: [], done: {}, log: [], stash: {} };
st.quests.done = {};
st.quests.pool = [];
/* 手工造"已达标"：
   ① 成长任务：找 goal 最小的一个，直接写 needs —— 走 questAmount 出口无法直接写。
   实际做法：先取一条成长任务，把它的 done 标记清掉，然后把它记入 stash 使 questAmount ≥ goal。
   不同 metric 口径不同，这里用一个通用捷径：GAME.questGoal 可被 mock（仅探针环境）。 */
var q1 = (DATA.QUESTS || [])[0];
var q2 = (DATA.QUESTS || [])[1];
var origGoal = G.questGoal;
var origAmount = G.questAmount;
var q1n = q1 ? 1 : 0, q2n = q2 ? 1 : 0;
G.questGoal = function (q) { return q === q1 || q === q2 ? 5 : origGoal.call(G, q); };
G.questAmount = function (q) { return q === q1 || q === q2 ? 9 : origAmount.call(G, q); };
var n0 = 0;
G.doClaimAllQuests();
ck('一键全领：两条达标成长任务均入账', !!st.quests.done[q1.id] && !!st.quests.done[q2.id],
  'done=' + JSON.stringify(Object.keys(st.quests.done)));
/* 重复点击 → 无新可领（防重领） */
var before = JSON.stringify(st.quests.done);
G.doClaimAllQuests();
ck('重复一键不重复入账（防重领）', JSON.stringify(st.quests.done) === before);
G.questGoal = origGoal; G.questAmount = origAmount;
ck('出口存在（GAME.doClaimAllQuests）', typeof G.doClaimAllQuests === 'function');

/* ============================================================
 * D4 战报筛选 + 收藏
 * ============================================================ */
console.log('=== D4 战报筛选 + 收藏 ===');
st.reports = [
  { t: Date.now(), title: '胜报甲', body: 'x', win: true },
  { t: Date.now(), title: '败报乙', body: 'x', win: false },
  { t: Date.now(), title: '胜报丙', body: 'x', win: true },
];
G.ui._repFilter = 'all';
G.ui._pages['rep'] = 1;
var hAll = G.ui.reportsHTML();
ck('筛选 chips 齐（全部/胜/败/收藏）',
  hAll.indexOf('data-v="all"') >= 0 && hAll.indexOf('data-v="win"') >= 0
  && hAll.indexOf('data-v="lose"') >= 0 && hAll.indexOf('data-v="fav"') >= 0);
ck('全部视图：3 条都在', hAll.indexOf('胜报甲') >= 0 && hAll.indexOf('败报乙') >= 0 && hAll.indexOf('胜报丙') >= 0);
ck('行内收藏星标存在', hAll.indexOf('data-action="rep-fav"') >= 0);
G.ui.setRepFilter('lose');
var hLose = G.ui.reportsHTML();
ck('筛选「败」：只剩败报', hLose.indexOf('败报乙') >= 0 && hLose.indexOf('胜报甲') < 0);
G.ui.setRepFilter('win');
var hWin = G.ui.reportsHTML();
ck('筛选「胜」：只剩胜报', hWin.indexOf('胜报甲') >= 0 && hWin.indexOf('败报乙') < 0);
/* 收藏切换 */
G.ui.toggleRepFav(0);
ck('收藏写入条目（s.reports[0].fav）', st.reports[0].fav === true);
G.ui.setRepFilter('fav');
var hFav = G.ui.reportsHTML();
ck('筛选「收藏」：只显已收藏', hFav.indexOf('胜报甲') >= 0 && hFav.indexOf('败报乙') < 0);
G.ui.toggleRepFav(0);
ck('再切取消收藏', st.reports[0].fav === false);
G.ui.setRepFilter('all');

/* ============================================================
 * C4 故事集
 * ============================================================ */
console.log('=== C4 故事集 ===');
var allSt = G.SG.list();
ck('前置：故事已载入（>0 篇）', allSt.length > 0, allSt.length + ' 篇');
/* 读一篇 → 进度入 s.stories */
if (allSt.length) {
  var st0 = allSt[0];
  st.stories = st.stories || {};
  st.stories[st0.id] = { done: ['e1'], n: 3, grade: 'good' };
}
var hStory = G.ui.storyHTML();
ck('故事集卡片出现', hStory.indexOf('📖 故事集') >= 0);
ck('已读篇目显名', hStory.indexOf('《' + allSt[0].title + '》') >= 0, allSt[0].title);
ck('未读篇目 ??? 不剧透', hStory.indexOf('《？？？》') >= 0);
ck('重读入口（story-read-at）', hStory.indexOf('data-action="story-read-at"') >= 0);
ck('分类归组（SG_KIND 五类之一）', hStory.indexOf('sg-k') >= 0 && hStory.indexOf('sg-items') >= 0);
ck('进度计数（已读 1 / N）', hStory.indexOf('已读 1 / ' + allSt.length) >= 0);
/* 重读出口可打开 */
var opened = false;
try {
  G.ui.openStory(allSt[0].id, true);
  opened = !!(G.SG._run && G.SG._run.st && G.SG._run.st.id === allSt[0].id);
  G.SG.close();
} catch (e) { opened = 'ERR ' + e.message; }
ck('重读打开阅读器（openStory）', opened === true, String(opened));

/* ============================================================
 * E3 人口三段条
 * ============================================================ */
console.log('=== E3 人口三段条 ===');
G.ui._trainTab = 'inf';        /* 工具条在兵种卡页（队列页不渲染） */
G.ui._trainFilter = 'normal';
G.ui._trainSel = 'yibing';
var hTrain = G.ui.troopsHTML();
ck('三段条渲染（pop-3）', hTrain.indexOf('pop-3') >= 0,
  hTrain.indexOf('pop-3') >= 0 ? 'pop-3 在' : 'pop-3 未在（可能兵种卡页）');
ck('可征 / 上限 / 增势 三词齐',
  hTrain.indexOf('可征') >= 0 && hTrain.indexOf('上限') >= 0 && hTrain.indexOf('增势') >= 0);
ck('popGrowthOf 出口存在', typeof G.popGrowthOf === 'function');
var gr = G.popGrowthOf(city);
ck('增势 = max(1, 上限×0.0005)', gr === Math.max(1, G.maxPopOf(city) * 0.0005), 'growth=' + gr);
var capT = G.maxPopOf(city);
var availT = Math.floor(city.res.pop || 0);
ck('可征数 = 城池库存人口', hTrain.indexOf(U2num(availT)) >= 0 || availT === 0,
  'avail=' + availT);
function U2num(n) { return G.utils.numText(n, 0); }

/* ============================================================
 * A3 歼敌值解释（源码级：战报正文 title）
 * ============================================================ */
console.log('=== A3 歼敌值解释 ===');
var bSrc = fs.readFileSync(path.join(R, 'js', 'battle.js'), 'utf8');
ck('战报正文含「歼敌值」悬停解释',
  bSrc.indexOf('title="歼敌值 = 按歼灭敌军的资源造价折算（与将领经验同一口径）"') >= 0);

/* ============================================================
 * A4 材料产地
 * ============================================================ */
console.log('=== A4 材料产地 ===');
var matId = null;
for (var mid in (DATA.STATE_SPECIALTY || {})) { matId = DATA.STATE_SPECIALTY[mid].mat; break; }
ck('前置：找到有州特产的材料', !!matId, matId);
if (matId) {
  var tgt = G.ui.matGoTargetOf(matId);
  ck('产地跳转目标可解析（州治或自己的城）', !!tgt,
    tgt ? (tgt.state + ' → ' + tgt.name + '(' + tgt.x + ',' + tgt.y + ')' + (tgt.owned ? ' 已据' : ' 未据')) : 'null');
}
var uSrc = fs.readFileSync(path.join(R, 'js', 'ui.js'), 'utf8');
ck('材料行含 data-tip 产地提示', uSrc.indexOf('data-tip="产地：') >= 0);
ck('材料行含 🗺️ 跳转（mat-go）', uSrc.indexOf('data-action="mat-go"') >= 0);

console.log('\n===== 结果：' + PASS + ' / ' + (PASS + FAIL) + ' =====');
process.exit(FAIL ? 1 : 0);
