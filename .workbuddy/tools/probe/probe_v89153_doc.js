/* v89.153 探针：公文重构（页签/默认页/三源合一/小标签/主题色）+ 采集收获明细
 * 跑法：node .workbuddy/tools/probe/probe_v89153_doc.js
 */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

console.log('=== ① 公文页签：顺序 系统/战报/侦查 · task 与 beacon 不出页签 ===');
var tabs = G.ui.docKinds().map(function (k) { return k.id; });
console.log('    页签 = ' + tabs.join(' → '));
ck('顺序 = sys, war, scout（老板原话排序）', tabs.join(',') === 'sys,war,scout', tabs.join(','));
ck('task 是合法类别但不出页签（doc:false）', !!DATA.MSG_KIND_BY.task && DATA.MSG_KIND_BY.task.doc === false);
ck('默认页签 = sys', G.ui._docTab === 'sys', G.ui._docTab);
var seg = fs.readFileSync(R + 'js/ui.js', 'utf8');
ck('战报页源码无军情流水（warFlowOf 已退役）', seg.indexOf('ui.warFlowOf = function') < 0);

console.log('=== ② 主题体系：发射点打标 + msgSubOf 唯一出口 ===');
G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260927 });
G.log('天时：晴（测）', 'sys', 'weather');
G.log('🎏 改元 测元：测', 'task', 'era');
G.log('建筑完成：民房', 'sys', 'build');
G.log('📦 采集收获（湖泊 Lv8）：粮食 +1；珠宝 蚌珠×2', 'sys', 'gather');
G.log('军情一条', 'war');
G.log('任务完成：测', 'task');
G.log('普通系统消息');
G.log('非法主题', 'sys', 'nosuch_sub');
var feed = G.msgFeedOf();
console.log('    feed = ' + feed.length + ' 条；subOf 分布：' +
  feed.map(function (r) { return G.msgSubOf(r); }).join(','));
ck('weather/era/build/gather 落库为 sub', feed.some(function (r) { return r.sub === 'weather'; })
  && feed.some(function (r) { return r.sub === 'era'; }) && feed.some(function (r) { return r.sub === 'build'; })
  && feed.some(function (r) { return r.sub === 'gather'; }));
ck('非法 sub 不落库（落回 sys）', !feed.some(function (r) { return r.sub === 'nosuch_sub'; }));
var subOf = {};
feed.forEach(function (r) { subOf[G.msgSubOf(r)] = (subOf[G.msgSubOf(r)] || 0) + 1; });
console.log('    标签分布 = ' + JSON.stringify(subOf));
ck('七类标签值域（era/weather/build/gather/war/task/sys）', Object.keys(subOf).every(function (k) {
  return ['era', 'weather', 'build', 'gather', 'war', 'task', 'sys'].indexOf(k) >= 0;
}));
ck('war→军情 命名', G.ui.msgTagNameOf('war') === '军情' && G.ui.msgTagNameOf('era') === '改元');
ck('主题色来自数据表', G.ui.msgTagColorOf('era') === DATA.MSG_SUB_BY.era.color
  && G.ui.msgTagColorOf('war') === DATA.MSG_TAG_COLOR.war);

console.log('=== ③ 系统页渲染：chips（全部 + 有消息的）+ 行色 + 任务摘要 ===');
var body = G.ui.docBodyHTML('sys');
var chips = (body.match(/data-action="msg-tag" data-v="([a-z]+)"/g) || []);
console.log('    chips = ' + chips.join(' '));
ck('含「全部」chip', body.indexOf('data-action="msg-tag" data-v="all"') >= 0);
ck('含 军情/任务/改元 等 chip（有消息才列）', body.indexOf('data-v="war"') >= 0
  && body.indexOf('data-v="task"') >= 0 && body.indexOf('data-v="era"') >= 0);
ck('chips 带主题色（字体颜色不同）', body.indexOf('style="color:' + DATA.MSG_SUB_BY.era.color) >= 0);
ck('消息行带主题色', body.indexOf('style="color:' + DATA.MSG_TAG_COLOR.war) >= 0);
ck('任务摘要置顶（可领取 N 项）', body.indexOf('任务 · 可领取') >= 0);
ck('「此标签下暂无消息」不会误报（有消息）', body.indexOf('此标签下暂无消息') < 0);

console.log('=== ④ 标签筛选（setMsgTag + 过滤） ===');
G.ui._msgTag = 'era';
var bodyEra = G.ui.docBodyHTML('sys');
ck('切「改元」：只剩改元消息', bodyEra.indexOf('🎏 改元 测元') >= 0 && bodyEra.indexOf('军情一条') < 0);
ck('切「改元」：任务摘要不显示', bodyEra.indexOf('任务 · 可领取') < 0);
G.ui._msgTag = 'war';
var bodyWar = G.ui.docBodyHTML('sys');
ck('切「军情」：只剩军情', bodyWar.indexOf('军情一条') >= 0 && bodyWar.indexOf('🎏 改元 测元') < 0);
G.ui._msgTag = 'all';

console.log('=== ⑤ 老档兼容：直调已移出类别给指引 ===');
ck('docBodyHTML(task) → 并入系统页指引', G.ui.docBodyHTML('task').indexOf('已并入「系统」页') >= 0);
ck('docBodyHTML(beacon) → 军务·烽火指引', G.ui.docBodyHTML('beacon').indexOf('已移出公文') >= 0);

console.log('=== ⑥ 采集收获明细（老板 3）：逐项列出 + 各带数量 ===');
var st = G.state, c = st.cities[0];
st.wilds = st.wilds || [];
st.wilds.push({ x: c.x + 2, y: c.y + 2, type: 'lake', level: 8, day: 0, startDay: 0 });
var gen = st.generals[0];
gen.status = 'garrison';
G.map.wildAt(c.x + 2, c.y + 2).garrison = { troops: { changqiang: 5000 }, cityId: c.id, genId: gen.id };
G.startGather(c.x + 2, c.y + 2, { changqiang: 5000 }, { cityId: c.id });
var g0 = G.gatherList()[0];
g0.elapsed = 24 * 3600;
var r = G.finishGather(g0.id);
console.log('    msg = ' + r.msg);
console.log('    rewardText = ' + r.rewardText);
ck('msg 含地形与等级（湖泊 Lv8）', r.msg.indexOf('（湖泊 Lv8）') >= 0);
ck('msg 含资源与数量', /粮食 \+/.test(r.msg));
ck('rewardText 存在（自动收获同用）', typeof r.rewardText === 'string' && r.rewardText.length > 0);
var sawJewel = false, sawMsg = '';
for (var i = 0; i < 12 && !sawJewel; i++) {          /* 34% 概率；每次**重开采集**（记录用过即删） */
  G.startGather(c.x + 2, c.y + 2, { changqiang: 5000 }, { cityId: c.id });
  var gx = G.gatherList().filter(function (x) { return x.x === c.x + 2; })[0];
  if (!gx) break;
  gx.elapsed = 24 * 3600;
  var rx = G.finishGather(gx.id);
  if (rx.ok && rx.jewel) { sawJewel = true; sawMsg = rx.msg; }
}
if (sawJewel) console.log('    （第 ' + (i) + ' 次见珠宝）' + sawMsg);
ck('多次收获能见到「珠宝 XX×N」（数量在）', sawJewel);
ck('收获消息落「采集收获」主题', (function () {
  var hit = G.msgsOf('sys').filter(function (m) { return G.msgSubOf(m) === 'gather'; });
  return hit.length > 0;
})());

console.log('=== ⑦ 自动收获也列全产出 ===');
st.settings.autoGather = true;
st.autoGatherState = { lastAt: 0, msg: '', at: 0, lastChk: null };
st.wilds.push({ x: c.x + 3, y: c.y + 3, type: 'forest', level: 6, day: 0, startDay: 0 });
G.map.wildAt(c.x + 3, c.y + 3).garrison = { troops: { changqiang: 3000 }, cityId: c.id, genId: gen.id };
G.startGather(c.x + 3, c.y + 3, { changqiang: 3000 }, { cityId: c.id });
var g2 = G.gatherList().filter(function (x) { return x.x === c.x + 3; })[0];
g2.elapsed = 24 * 3600;
var ar = G.autoGatherTick();
console.log('    自动收获 msg = ' + (ar ? ar.msg : '(null)'));
ck('自动收获列地形与产出（不再只有"收 X"）', !!ar && /森林 Lv6/.test(ar.msg) && /木/.test(ar.msg));
st.settings.autoGather = false;

console.log('\n===== ' + pass + ' pass / ' + fail + ' fail =====');
process.exit(fail ? 1 : 0);
