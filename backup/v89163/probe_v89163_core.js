/* v89.163 探针：①指挥战斗清单加"行军中的军队" ②征兵时长压缩（步兵≤1分/骑兵≤5分）
   跑法：node .workbuddy/tools/probe/probe_v89163_core.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var pass = 0, fail = 0;
function P(n, ok, ex) { if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); } else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); } }

console.log('=== ① 征兵时长：步兵 ≤60 / 骑兵 ≤300（游戏秒 · 单兵耗时） ===');
var T = DATA.TROOPS, overInf = [], overCav = [], craftUntouched = true;
for (var k in T) {
  var t = T[k];
  if (t.cat === 'inf' && t.time > 60) overInf.push(t.name + '=' + t.time);
  if (t.cat === 'cav' && t.time > 300) overCav.push(t.name + '=' + t.time);
  if (t.craft && t.time < 1000) craftUntouched = false;   /* 器械（床弩2910/冲车4370/投石车5830）未动 */
}
console.log('  步兵：' + ['yibing', 'minfu', 'chihou', 'qingzhoubing', 'changqiang', 'tengjiabing', 'daodun', 'gongjian']
  .map(function (id) { return T[id].name + ' ' + T[id].time; }).join(' · '));
console.log('  骑兵：' + ['tuqibing', 'hubaoqi', 'qingji', 'zhouche', 'xiliangtieqi', 'tieji', 'nanjiangxiangbing']
  .map(function (id) { return T[id].name + ' ' + T[id].time; }).join(' · '));
P('★ 步兵全部 ≤ 60 秒（1 分钟）', overInf.length === 0, overInf.join(',') || '全部达标');
P('★ 骑兵全部 ≤ 300 秒（5 分钟）', overCav.length === 0, overCav.join(',') || '全部达标');
P('器械（craft）时间未动（≥1000）', craftUntouched);
P('排序保持（义兵≤民夫≤…≤弓箭手；突骑≤虎豹≤…≤象兵）', (function () {
  var inf = ['yibing', 'minfu', 'chihou', 'qingzhoubing', 'changqiang', 'tengjiabing', 'daodun', 'gongjian'];
  for (var i = 1; i < inf.length; i++) if (T[inf[i]].time < T[inf[i - 1]].time) return false;
  var cav = ['tuqibing', 'hubaoqi', 'qingji', 'zhouche', 'xiliangtieqi', 'tieji', 'nanjiangxiangbing'];
  for (var j = 1; j < cav.length; j++) if (T[cav[j]].time < T[cav[j - 1]].time) return false;
  return true;
})());

console.log('\n=== ② 显示与换算（卡面「单兵耗时」+ 批量现实时间 @默认倍速） ===');
var ts = G.timeScale();
console.log('  时间刻度 = ' + ts + '×');
P('卡面：义兵显示「10秒」· 弓箭手显示「1分」· 象兵显示「5分」',
  U.dur(T.yibing.time) === '10秒' && U.dur(T.gongjian.time) === '1分' && U.dur(T.nanjiangxiangbing.time) === '5分',
  U.dur(T.yibing.time) + ' / ' + U.dur(T.gongjian.time) + ' / ' + U.dur(T.nanjiangxiangbing.time));
P('★ 批量换算：100 弓箭手现实 ≤1 分钟（' + ((T.gongjian.time * 100 / ts)).toFixed(0) + ' 秒 @' + ts + '×）',
  T.gongjian.time * 100 / ts <= 60);
P('★ 批量换算：100 铁骑现实 ≤5 分钟（' + ((T.tieji.time * 100 / ts)).toFixed(0) + ' 秒 @' + ts + '×）',
  T.tieji.time * 100 / ts <= 300);
P('批量换算：100 长枪兵现实（' + ((T.changqiang.time * 100 / ts)).toFixed(0) + ' 秒 @' + ts + '×）≤1 分钟',
  T.changqiang.time * 100 / ts <= 60);

console.log('\n=== ③ 指挥战斗清单：战斗 + 行军中 两段 ===');
var st = G.newGame({ name: '清测', region: '司隶' });
var c = st.cities[0];
var g0 = st.generals[0];
st.battles = [];
st.marches = [{
  id: 'mrT1', cityId: c.id, genId: g0.id, modeId: 'raid',
  target: { kind: 'wild', x: 1, y: 1 }, tx: 1, ty: 1, name: '荒野·试', kind: 'wild',
  army: { yibing: 100 }, elapsed: 50, totalTime: 100, scheme: null, ops: 'assault', cargo: null,
}];
var h1 = G.ui.battleListHTML();
console.log('  无战斗 + 1 行军 → 含「战斗待指挥（0）」=' + (h1.indexOf('⚔ 战斗待指挥（0）') >= 0)
  + ' · 含「行军中的军队（1）」=' + (h1.indexOf('🛫 行军中的军队（1）') >= 0));
P('★ 两段都在（战斗 0 也显示空态行）', h1.indexOf('⚔ 战斗待指挥（0）') >= 0
  && h1.indexOf('🛫 行军中的军队（1）') >= 0 && h1.indexOf('当前没有待指挥的战斗') >= 0);
P('★ 行军行含：军队名 / 主将 / 兵力 / 进度 / 召回按钮', h1.indexOf('荒野·试') >= 0 && h1.indexOf('赵子龙') >= 0
  && h1.indexOf('100') >= 0 && h1.indexOf('50%') >= 0 && h1.indexOf('data-action="march-recall" data-id="mrT1"') >= 0);
P('清单容器有 .war-list 标记（供召回重绘探测宿主）', h1.indexOf('class="war-list"') >= 0);
/* 加一场 live 战斗 → 两段都有实体行 */
st.battles = [{ id: 'T1', state: 'live', side: 'atk', modeId: 'raid', target: { name: '荒野·甲' } }];
var h2 = G.ui.battleListHTML();
P('战斗 1 + 行军 1 → 两段都有实体行', h2.indexOf('⚔ 战斗待指挥（1）') >= 0
  && h2.indexOf('🛫 行军中的军队（1）') >= 0 && h2.indexOf('data-action="bt-open"') >= 0);
/* 两段都空 */
st.battles = []; st.marches = [];
var h3 = G.ui.battleListHTML();
P('两段都空 → 两段各给空态提示', h3.indexOf('当前没有待指挥的战斗') >= 0 && h3.indexOf('当前没有行军中军队') >= 0);
var toasts = [];
var bkToast = G.ui.toast;
G.ui.toast = function (m) { toasts.push(m); };
var threw = false;
try { G.ui.openBattleList(); } catch (e) { threw = true; }
G.ui.toast = bkToast;
P('★ 两段都空 → openBattleList 不弹、只 toast（不崩）', !threw && toasts.length === 1 && /没有待指挥的战斗与行军中军队/.test(toasts[0]),
  toasts.join('|'));

console.log('\n=== ④ 源代码级（唯一出口 / 宿主探测 / 底栏文案） ===');
var mS = fs.readFileSync(path.join(R, 'js', 'main.js'), 'utf8');
var uS = fs.readFileSync(path.join(R, 'js', 'ui.js'), 'utf8');
P('召回重绘跟宿主走（.war-list 探测 + openBattleList 分支 · querySelectorAll 口径）',
  /document\.querySelectorAll\('#modal-root \.war-list'\)\.length\) ui\.openBattleList\(\)/.test(mS)
  && /else ui\.openMarches\(\)/.test(mS));
P('底栏「指挥战斗」title 写明"与行军中的军队"', /查看正在进行的战斗与行军中的军队/.test(uS));
P('唯一出口：ui.marchListOf / ui.marchRowsHTML 各一处定义', (function () {
  return (uS.match(/ui\.marchListOf = function/g) || []).length === 1
    && (uS.match(/ui\.marchRowsHTML = function/g) || []).length === 1
    && (uS.match(/ui\.battleListHTML = function/g) || []).length === 1
    && (uS.match(/ui\.openBattleList = function/g) || []).length === 1;
})());

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(0);
