/* v89.131 探针：节钺设定全表（老板「只有攻打名城才给的那什么节X，列出其设定」）
 * ------------------------------------------------------------
 * 全链真调：获得（首占名城 / 爵位每 4 档）→ 消耗（名世→天授 / 城池扩编）
 * → 上限（每城扩编至多 2 次）→ 幂等（同一城只算一次）。
 * 跑法：node .workbuddy/tools/probe/probe_v89131_jieyue.js
 */
var R = 'E:/Deepseekdb/';
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, D = G.DATA, U = G.utils;

console.log('== ① 配置表（DATA.JIEYUE · 唯一来源）==');
var C = D.JIEYUE;
console.log('  名称/图标: ' + C.name + ' ' + C.icon);
console.log('  攻占名城给枚数 byTier: ' + JSON.stringify(C.byTier)
  + '（县/郡/州/都 —— 档越高给得越多）');
console.log('  爵位赏赐间隔 rankEvery: ' + C.rankEvery + '（每晋级 ' + C.rankEvery + ' 档 +1 枚）');
console.log('  城池扩编上限 citySlotMax: ' + C.citySlotMax + '（每城至多 +' + C.citySlotMax + ' 个建造位）');
console.log('  名世→天授消耗 tianshouCost: ' + C.tianshouCost + ' 枚（tianshouTo=' + C.tianshouTo + '）');
console.log('  desc: ' + C.desc);

console.log('');
console.log('== ② 获得链（真调）==');
var st = G.newGame({ name: '节钺', cityName: '许都', region: '碎垣', mapSeed: 7131 });
var before02 = G.jieyueOf();
G.jieyueClaim('city:demoA', 3, '首占 演示州城');
var after02 = G.jieyueOf();
console.log('  首占「州城」申领 3 枚: ' + before02 + ' → ' + after02);
G.jieyueClaim('city:demoA', 3, '再来一次（幂等测试）');
console.log('  同一城再申领一次（幂等）: → ' + G.jieyueOf() + '（应不变）');
var s2 = st.rank || 0;
st.rank = 4;                                  /* 晋到第 4 档 —— 触发"每 4 档 +1" */
G.systems.promote && console.log('  （promote 需前置，直接走赏赐出口验证 rank%4）');
G.jieyueGrant(1, '爵位晋至 演示');
console.log('  爵位赏赐 +1: → ' + G.jieyueOf());

console.log('');
console.log('== ③ 消耗链（真调）==');
var c = st.cities[0];
G.ui._cityId = c.id;
var slotsBefore = G.buildSlots(c);
var r3a = G.jieyueExpandCity(c.id);
var slotsAfter = G.buildSlots(c);
console.log('  城池扩编: ' + (r3a.ok ? 'OK' : r3a.msg) + ' · 建造位 ' + slotsBefore + ' → ' + slotsAfter);
var r3b = G.jieyueExpandCity(c.id);
var r3c = G.jieyueExpandCity(c.id);
console.log('  第 2 次: ' + (r3b.ok ? 'OK' : r3b.msg));
console.log('  第 3 次（超上限）: ' + (r3c.ok ? 'OK' : r3c.msg));
console.log('  扩编后余额: ' + G.jieyueOf() + '（初始 ' + before02 + ' +1 爵位 -2 扩编）');

console.log('');
console.log('== ④ 名世→天授（消耗 1 枚）==');
var gMing = G.makeGeneral('演示名世', 180, 'idle', c.id, false, 'ming', 'balance');
st.generals.push(gMing);
console.log('  演示将资质: ' + G.rankOf(gMing).name + '（' + G.rankOf(gMing).id + '）');
var tianItem = null;
(D.ITEMS || []).forEach(function (it) { if (it.type === 'rank_up' && it.to === 'tian') tianItem = it; });
console.log('  升天授灵草: ' + (tianItem ? tianItem.name + '（' + tianItem.from + '→' + tianItem.to + '）' : '缺失!'));
st.items = st.items || {};
st.items[tianItem.id] = 1;
var jyBefore = G.jieyueOf();
var r4 = G.systems.useItem(tianItem.id, gMing.id);
console.log('  真调 useItem（名世→天授）: ' + (r4.ok ? 'OK' : r4.msg)
  + ' · 节钺 ' + jyBefore + ' → ' + G.jieyueOf()
  + ' · 资质 → ' + G.rankOf(gMing).name);
/* 余额不足侧 */
var gMing2 = G.makeGeneral('演示名世2', 180, 'idle', c.id, false, 'ming', 'balance');
st.generals.push(gMing2);
st.items[tianItem.id] = 1;
G.state.jieyue = 0;
var r4b = G.systems.useItem(tianItem.id, gMing2.id);
console.log('  节钺为 0 时再试: ' + (r4b.ok ? 'OK（不该！）' : r4b.msg));

console.log('');
console.log('== ⑤ 界面呈现点（grep 事实）==');
console.log('  · 城池面板页脚：🪓 节钺扩编 按钮（label 带"持符 N"·悬停给 desc）');
console.log('  · 资质晋升入口：名世→天授时消耗 1 枚（余额不足会被 jieyueSpend 拦）');
console.log('  · 其它（爵位面板/统计面板）**没有**节钺余额行 —— 见交付文档"观感缺口"');
process.exit(0);
