'use strict';
/* v89.110 探针：两条上限的真实数值取证
   —— 主城等级上限（随爵位解封）· 城池数量上限（随爵位解封）
   跑法：node .workbuddy/tools/probe/probe_v89110_caps.js
   ⚠️ 结尾必须 process.exit(0)：项目 js 的主循环定时器会吊住事件循环。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
  'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA;
var st = G.newGame({ name: '量', cityName: '许都', mapSeed: 20260923 });
if (!st.map.grid) G.map.generate();
var c0 = st.cities[0];
/* 自建城当主城（常规玩家路径） */
st.mainCityId = c0.id;
/* 都城当主城（理论最高档）：最小可用对象，只给 type 与空 cells */
var fakeCap = { id: '__probe_cap__', name: '假都城', type: 'capital', cells: [] };
st.cities.push(fakeCap);

var out = [];
out.push('—— 常量 ——');
out.push('MAX_BLEVEL=' + DATA.MAX_BLEVEL
  + ' · CITY_BUILD_BONUS=' + JSON.stringify(DATA.CITY_BUILD_BONUS)
  + ' · 每档 lift=' + DATA.MAIN_CITY_BUILD_PER_RANK
  + ' · LIFT_MAX=' + DATA.RANK_BUILD_LIFT_MAX
  + ' · MAX_LEVEL_ABS=' + DATA.MAX_LEVEL_ABS
  + ' · RANK 档数=' + DATA.RANK.length);
out.push('minfang.maxLevel=' + (DATA.BUILDINGS.minfang || {}).maxLevel
  + ' · guanfu.maxLevel=' + (DATA.BUILDINGS.guanfu || {}).maxLevel
  + ' · chengqiang.maxLevel=' + (DATA.BUILDINGS.chengqiang || {}).maxLevel);
out.push('');
out.push('idx  爵位        官府上限  民房上限  主城(都城)  城数上限  下档门槛');
for (var r = 0; r < DATA.RANK.length; r++) {
  st.rank = r;
  var lift = G.rankBuildCapOf(c0);
  st.mainCityId = c0.id;
  var capGf = G.buildCapOf(c0, 'guanfu');
  var capMf = G.buildCapOf(c0, 'minfang');
  st.mainCityId = fakeCap.id;
  var capCap = G.buildCapOf(fakeCap, 'guanfu');
  st.mainCityId = c0.id;
  var capCity = G.cityCapOf();
  var nx = DATA.RANK[r + 1];
  out.push(String(r).padStart(2) + '  ' + DATA.RANK[r].name.padEnd(6, '　')
    + '  ' + String(capGf).padStart(6)
    + '  ' + String(capMf).padStart(6)
    + '  ' + String(capCap).padStart(8)
    + '  ' + String(capCity).padStart(6)
    + '  ' + (nx ? ('需 ' + nx.city) : '（满档）'));
}
out.push('');
st.rank = 21;
st.mainCityId = c0.id;
out.push('—— 满档复核 ——');
out.push('自建主城建筑上限 = ' + G.buildCapOf(c0, 'minfang') + '（12 + 21）');
st.mainCityId = fakeCap.id;
out.push('都城主城建筑上限 = ' + G.buildCapOf(fakeCap, 'minfang') + '（24 + 21）');
st.mainCityId = c0.id;
out.push('城池数量上限 = ' + G.cityCapOf());
out.push('');
out.push('—— 世界容量（一次开局）——');
var byT = {};
(st.map.cities || []).forEach(function (c) { byT[c.type] = (byT[c.type] || 0) + 1; });
out.push('地图名城数=' + (st.map.cities || []).length + ' ' + JSON.stringify(byT));
out.push('建城花费=' + JSON.stringify(G.BUILD_CITY_COST || {}));
out.push('');
out.push('—— 算术核对 ——');
out.push('主城自建满档 = 12 + (RANK档数-1) = 12 + ' + (DATA.RANK.length - 1) + ' = '
  + (12 + DATA.RANK.length - 1));
out.push('若要求"12→34"，需要 22 步 lift；当前 22 档里第 1 档是平民（lift=0）→ 只有 21 步。');
console.log(out.join('\n'));
process.exit(0);
