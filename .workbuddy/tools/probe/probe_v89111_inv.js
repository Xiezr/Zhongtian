'use strict';
/* v89.111 探针：来袭新节奏（每日 9 时一场 · 目标轮转 · 提前 4 时只报一次 · 离线补算）
   跑法：node .workbuddy/tools/probe/probe_v89111_inv.js
   ⚠️ 结尾 process.exit(0)（项目定时器会吊住事件循环） */
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
G.state = st;
st.world = st.world || {};
st.world.elapsed = 0;
st.cities.push(G.makeCity({ id: 'c2', name: '二城', x: 265, y: 215 }));
st.cities.push(G.makeCity({ id: 'c3', name: '三城', x: 266, y: 216 }));
st.cities.forEach(function (c) { c.army = { yibing: 8000 }; });

var L = [];
function p(x) { L.push(x); }
function nMsg() { return (G.msgsOf('beacon') || []).length; }
function lastMsg() { var m = G.msgsOf('beacon') || []; return m.length ? m[0].msg : ''; }
function setT(day, h, m) { st.world.elapsed = day * 86400 + h * 3600 + (m || 0) * 60; }

p('—— 常量 ——');
p('attackHour=' + DATA.INVASION.attackHour + ' · warnHours=' + DATA.INVASION.warnHours
  + ' · intelBeaconMax=' + DATA.INVASION.intelBeaconMax
  + ' · 旧字段 baseDays=' + DATA.INVASION.baseDays + ' / warnBeaconMax=' + DATA.INVASION.warnBeaconMax + '（应为 undefined）');
p('');
p('—— 逐日推演（3 城 · 轮转）——');
for (var d = 0; d < 3; d++) {
  var n0 = nMsg();
  setT(d, 5, 30);                       /* 5:30 进窗 → 应报一条 */
  G.invasionTick(0);
  var n1 = nMsg();
  var warnMsg = lastMsg();
  setT(d, 8, 0);                        /* 8:00 同一天再 tick → 不许再报 */
  G.invasionTick(0);
  var n2 = nMsg();
  setT(d, 9, 1);                        /* 9:01 → 结算一场 */
  var fired = G.invasionTick(1);
  var resMsg = lastMsg();
  setT(d, 10, 0);                       /* 10:00 同一天 → 不许再打 */
  var fired2 = G.invasionTick(0);
  var tgt = G.invasionTargetOfDay(d);
  p('第 ' + d + ' 天：预警 +' + (n1 - n0) + ' 条 · 8:00 后仍 +' + (n1 - n0) + '(重复报=' + (n2 > n1) + ')'
    + ' · 9:01 fired=' + fired + ' · 10:00 fired=' + fired2 + ' · 目标=' + (tgt && tgt.name));
  p('    预警：' + warnMsg.slice(0, 110));
  p('    结算：' + resMsg.slice(0, 110));
}
p('');
p('—— 离线补算（跳 3 天）——');
var nb = nMsg();
setT(6, 9, 1);
var fBulk = G.invasionTick(0);
p('从第 2 天跳到第 6 天 fired=' + fBulk + '（应=4：第 3~6 天各一场）· 烽火消息 +'
  + (nMsg() - nb) + '（4 场结算；无历史补报）');
p('');
p('—— 势力一致性（预警报谁 = 谁来打）——');
setT(10, 5, 30);
var tgt10 = G.invasionTargetOfDay(10);
var src10 = G.invasionSrcOf(tgt10, 10);
G.invasionTick(0);
var w10 = lastMsg();
setT(10, 9, 1);
G.invasionTick(1);
var r10 = lastMsg();
p('目标=' + tgt10.name + ' · 势力=' + src10);
p('预警含该势力=' + (w10.indexOf(src10) >= 0) + ' · 结算含该势力=' + (r10.indexOf(src10) >= 0));
p('预警全文：' + w10.slice(0, 130));
p('');
p('—— 烽火台情报等级（Lv0 → Lv2）——');
p('Lv0：' + G.invasionIntelTextOf(tgt10, 10));
var cell = null;
(tgt10.cells || []).forEach(function (x, i) { if (!x.build && !x.official && cell == null) cell = i; });
if (cell != null) tgt10.cells[cell].build = { id: 'fenghuotai', lvl: 2 };
p('Lv2：' + G.invasionIntelTextOf(tgt10, 10));
p('');
p('—— 烽火页 ——');
var h = G.ui.marchBeaconHTML();
p('含「来犯」=' + (h.indexOf('来犯') >= 0) + ' · 含「剩余」=' + (h.indexOf('剩余') >= 0)
  + ' · 含「每日 9 时」=' + (h.indexOf('每日 9 时') >= 0));
var i1 = h.indexOf('来犯');
p('页面片段：' + (i1 >= 0 ? h.slice(Math.max(0, i1 - 60), i1 + 100).replace(/<[^>]+>/g, ' ') : '(无)'));
console.log(L.join('\n'));
process.exit(0);
