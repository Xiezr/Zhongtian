/* ============================================================
 * probe_v89154_wild.js —— v89.154 探针
 * ① 排序出口（采集 > 驻军 > 无驻军·地形→等级降序）
 * ② openWilds 渲染顺序（与出口同序）
 * ③ 操作列第 5 颗「放弃」按钮（两段式 + 防误触类）
 * ④ ask 弹窗（不可撤销 + arm 名）
 * ⑤ 上膛链路（两次 GAME.action）+ 打开即复位
 * ⑥ 下拉框与面板同用出口（源码断言）
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;

var P = 0, F = 0;
function ck(name, cond, extra) {
  if (cond) { P++; console.log('  ✓ ' + name); }
  else { F++; console.log('  ✗ ' + name + (extra ? '   [' + extra + ']' : '')); }
}

G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
var st = G.state, c = st.cities[0];
G.ui._cityId = c.id;

/* ---------- 造局：5 片野地 ---------- */
/* ⚠ 造局序**故意倒置**（D→C→E→B→A）：若出口退化成"直接返回原数组"，判据必须能抓
   （期望是 A→B→E→C→D，与原序不同 = 防平凡解）。 */
st.wilds = [];
st.gathers = [];
var gen = st.generals[0];
var bakGen = { status: gen.status, cityId: gen.cityId };
var W = [
  { x: 804, y: 804, type: 'hill', level: 4, tag: 'D山地4' },
  { x: 803, y: 803, type: 'hill', level: 9, tag: 'C山地9' },
  { x: 802, y: 802, type: 'desert', level: 7, tag: 'E荒漠7' },
  { x: 801, y: 801, type: 'caoyuan', level: 5, tag: 'B驻军' },
  { x: 800, y: 800, type: 'lake', level: 3, tag: 'A采集' }
];
W.forEach(function (w) {
  st.wilds.push({ x: w.x, y: w.y, type: w.type, level: w.level, day: 0, startDay: 0 });
});
/* A：驻军带将 + 开采中 */
gen.status = 'garrison';
G.map.wildAt(800, 800).garrison = { troops: { changqiang: 5000 }, cityId: c.id, genId: gen.id };
var sg = G.startGather(800, 800, { changqiang: 5000 }, { cityId: c.id });
/* B：驻军（无将） */
G.map.wildAt(801, 801).garrison = { troops: { changqiang: 500 }, cityId: c.id };

console.log('=== ① 排序出口 ===');
console.log('    startGather(800,800) = ' + JSON.stringify(sg && sg.msg));
var sorted = G.ui.wildSortedOf(st.wilds);
var seq = sorted.map(function (w) {
  var tag = '';
  W.forEach(function (x) { if (x.x === w.x) tag = x.tag; });
  return tag;
});
console.log('    实测顺序 = ' + seq.join(' → '));
ck('三档优先级：采集中最前 → 有驻军 → 无驻军', seq[0] === 'A采集' && seq[1] === 'B驻军');
ck('无驻军按地形（desert 表序 5 < hill 6 → 荒漠在山区前）', seq[2] === 'E荒漠7');
ck('同地形按等级降序（山地 9 → 4）', seq[3] === 'C山地9' && seq[4] === 'D山地4');
ck('不改原数组（s.wilds 仍是倒序原序 804 → 800）', st.wilds[0].x === 804 && st.wilds[4].x === 800);

/* 边界：空数组 / undefined */
ck('边界：undefined → []', G.ui.wildSortedOf(undefined).length === 0);
ck('边界：空数组 → []', G.ui.wildSortedOf([]).length === 0);

console.log('=== ② openWilds 渲染顺序 ===');
var html = '';
var _om = G.ui.openModal;
G.ui.openModal = function (h) { html = h; };
try { G.ui.openWilds(); } catch (e) { html = 'ERR:' + e.message; }
G.ui.openModal = _om;
var iA = html.indexOf('data-x="800" data-y="800"');
var iB = html.indexOf('data-x="801" data-y="801"');
var iE = html.indexOf('data-x="802" data-y="802"');
var iC = html.indexOf('data-x="803" data-y="803"');
var iD = html.indexOf('data-x="804" data-y="804"');
console.log('    行位置 = A:' + iA + ' B:' + iB + ' E:' + iE + ' C:' + iC + ' D:' + iD);
ck('渲染行序 = 采集 → 驻军 → 荒漠 → 山9 → 山4', iA >= 0 && iA < iB && iB < iE && iE < iC && iC < iD);
ck('渲染含「驻军」列 500（B 行）', /data-x="801"[^]*?500/.test(html) || html.indexOf('>500<') >= 0);

console.log('=== ③ 操作列放弃按钮 ===');
ck('列表含放弃按钮（data-action=wild-abandon-ask）', html.indexOf('data-action="wild-abandon-ask"') >= 0);
ck('放弃按钮带防误触类 wild-drop', html.indexOf('wild-drop') >= 0);
ck('列表**不直接**执行（无 wild-abandon-arm）', html.indexOf('wild-abandon-arm') < 0);
var iW = html.indexOf('data-action="wild-withdraw"');
var iDrop = html.indexOf('data-action="wild-abandon-ask"');
ck('放弃在召回之后（操作列末位）', iDrop > iW && iW >= 0);

console.log('=== ④ ask 弹窗 ===');
html = '';
G.ui.openModal = function (h) { html = h; };
try { G.ui.openAbandonWildAsk(800, 800); } catch (e) { html = 'ERR:' + e.message; }
G.ui.openModal = _om;
ck('ask 含上膛按钮 wild-abandon-arm', html.indexOf('data-action="wild-abandon-arm"') >= 0);
ck('ask 明写「不可撤销」', html.indexOf('不可撤销') >= 0);
ck('ask 逐项列出代价（失去加成 / 撤回驻军 / 撤回采集队）',
  html.indexOf('将失去加成') >= 0 && html.indexOf('撤回驻军') >= 0 && html.indexOf('撤回采集队') >= 0);

console.log('=== ⑤ 上膛链路（两次点击） ===');
var el = { dataset: { x: '802', y: '802' }, innerHTML: '确定放弃' };
G.action('wild-abandon-arm', el);
ck('第一次点击只上膛（文案变「再点一次」）', /再点一次/.test(el.innerHTML));
ck('第一次点击后野地仍在', !!G.map.wildAt(802, 802));
ck('上膛标志已记', G.ui._wildArm154 === '802,802');
G.action('wild-abandon-arm', el);
ck('第二次点击才执行（野地消失）', !G.map.wildAt(802, 802));
ck('执行后标志清零', G.ui._wildArm154 === null);
ck('s.wilds 同步移除', st.wilds.filter(function (w) { return w.x === 802; }).length === 0);

/* 打开即复位：先污染标志，再开 ask（不同目标） */
G.ui._wildArm154 = '999,999';
html = '';
G.ui.openModal = function (h) { html = h; };
try { G.ui.openAbandonWildAsk(803, 803); } catch (e) { html = 'ERR:' + e.message; }
G.ui.openModal = _om;
ck('打开 ask 即复位上膛标志（防「关窗重开一击即中」）', G.ui._wildArm154 === null);

console.log('=== ⑥ 双处同用出口（源码断言） ===');
var usrc = fs.readFileSync(R + 'js/ui.js', 'utf8');
var msrc = fs.readFileSync(R + 'js/main.js', 'utf8');
ck('ui.js 两处调用 ui.wildSortedOf（面板 + 下拉框）', (usrc.match(/ui\.wildSortedOf\(/g) || []).length === 2,
  'got ' + (usrc.match(/ui\.wildSortedOf\(/g) || []).length);
ck('排序出口定义唯一', (usrc.match(/ui\.wildSortedOf = function/g) || []).length === 1);
ck('main.js 有上膛 case', /case 'wild-abandon-arm':/.test(msrc));
ck('main.js 无旧 do case（可执行形态）', !/case 'wild-abandon-do':/.test(msrc));
ck('ext-convert 走 closeAllModals（改建后回大界面）',
  (function () {
    var i = msrc.indexOf("case 'ext-convert': (function () {");
    return i >= 0 && msrc.slice(i, i + 600).indexOf('ui.closeAllModals()') >= 0;
  })());

/* ---------- 还原 ---------- */
G.map.wildAt(800, 800).garrison = null;
st.wilds = [];
st.gathers = [];
gen.status = bakGen.status; gen.cityId = bakGen.cityId;

console.log('\n结果：' + P + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
