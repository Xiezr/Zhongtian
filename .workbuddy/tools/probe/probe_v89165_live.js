/* v89.165 探针：实时读秒全量排查 —— 五处漏网接入后的**真调验证**。
   运行：node .workbuddy/tools/probe/probe_v89165_live.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;

var pass = 0, fail = 0;
function P(name, ok, extra) {
  if (ok) { pass++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

/* spy：捕获 openModal 的 html/opts（不改行为） */
var modalLog = [];
var _om = G.ui.openModal;
G.ui.openModal = function (html, opts) {
  modalLog.push({ html: String(html), opts: opts || null });
  return _om.apply(this, arguments);
};

G.newGame({ name: 'v165', region: '烬环' });
var s = G.state, c = G.currentCity();
G.ui._cityId = c.id;

console.log('=== ① 指挥战斗清单（老板报的那处）：live 接入 + 真调重开 + 读秒随进度变 ===');
var m = { id: 'M165', cityId: c.id, genId: '', modeId: 'raid',
  target: { kind: 'wild', x: 1, y: 1 }, tx: 1, ty: 1, name: '荒野·丙', kind: 'wild',
  army: { yibing: 100 }, elapsed: 96000, totalTime: 600000, scheme: null, ops: 'assault', cargo: null };
s.marches.push(m);
s.battles = [];
modalLog.length = 0;
G.ui.openBattleList();
var o1 = modalLog[modalLog.length - 1];
P('openBattleList 打开时带 live', !!(o1 && o1.opts && typeof o1.opts.live === 'function'));
var lab1 = G.march.progressOf(m).label;
P('首开 HTML 含 16% 读秒（label = ' + lab1 + '）', /16%/.test(o1.html) && o1.html.indexOf(lab1) >= 0);

/* 真调 live：推进 120000 游戏秒（20%）→ live 重开 → 新 HTML 应是 36% */
m.elapsed += 120000;
var lab2 = G.march.progressOf(m).label;
var n1 = modalLog.length, err1 = null;
try { o1.opts.live(); } catch (e) { err1 = e.message; }
var o1b = modalLog[modalLog.length - 1];
P('★ 真调 live() 重开且无异常', err1 === null && modalLog.length > n1, err1 || '重开 OK');
P('★ 重开交付的 HTML 已是新读秒（36% · ' + lab2 + '）', /36%/.test(o1b.html) && o1b.html.indexOf('16%') < 0);

console.log('\n=== ② 提速小窗：live 接入 + 未完成重开 + 完成即关窗 ===');
c.cells[0].build = { id: 'junying', lvl: 1 };            /* 造一座军营（格 0） */
s.queues.train.push({ kind: 'train', cityId: c.id, bIdx: 0, troopId: 'yibing', count: 5,
  elapsed: 0, totalTime: 600, waiting: false });
modalLog.length = 0;
G.ui.openTrainBoost(0);
var o2 = modalLog[modalLog.length - 1];
P('openTrainBoost 打开时带 live', !!(o2 && o2.opts && typeof o2.opts.live === 'function'));
var n2 = modalLog.length, err2 = null;
try { o2.opts.live(); } catch (e) { err2 = e.message; }
P('★ 未完成 → live 重开（不关窗 · 剩余变短可见）', err2 === null && modalLog.length > n2 && G.ui._maskEl !== null,
  err2 || 'mask 在');
/* 完成：elapsed 顶满 → 用**同一个 live 引用**（闭包捕获 bIdx）→ 应关窗。
   ⚠️ 不能"改完再重开拿新引用" —— 完成态重开会走"没有进行中的任务"空态分支（opts = null）。 */
s.queues.train[0].elapsed = s.queues.train[0].totalTime;
var err3 = null;
try { o2.opts.live(); } catch (e) { err3 = e.message; }
P('★ 完成 → live 自动关窗（_maskEl = null）', err3 === null && G.ui._maskEl === null, err3 || ('mask=' + G.ui._maskEl));

console.log('\n=== ③ 通用面板：troops/tech 带 live · equip 对照无 live ===');
modalLog.length = 0;
G.ui.openPanel('troops', '测试·兵营');
var oP1 = modalLog[modalLog.length - 1];
P('openPanel(troops) 带 live（募兵队列「余 X」逐秒走）', !!(oP1.opts && typeof oP1.opts.live === 'function'));
modalLog.length = 0;
G.ui.openPanel('tech');
var oP2 = modalLog[modalLog.length - 1];
P('openPanel(tech) 带 live（研究中 X%）', !!(oP2.opts && typeof oP2.opts.live === 'function'));
modalLog.length = 0;
G.ui.openPanel('equip', null, 'xxl');
var oP3 = modalLog[modalLog.length - 1];
P('openPanel(equip) 无 live（纯静态 · 对照不重建）', !(oP3.opts && oP3.opts.live));

console.log('\n=== ④ 神器面板：live 接入 ===');
modalLog.length = 0;
G.ui.openArtifacts();
var o4 = modalLog[modalLog.length - 1];
P('openArtifacts 带 live（供奉值随游戏时间累积）', !!(o4.opts && typeof o4.opts.live === 'function'));

console.log('\n=== ⑤ 军务烽火页逐秒刷新（源码） ===');
var mjs = fs.readFileSync(R + 'js/main.js', 'utf8');
P('main.js：marches 逐秒名单含 beacon', mjs.indexOf("['over', 'beacon'].indexOf(ui._marchTab || 'over')") >= 0);

console.log('\n=== ⑥ 回归口径：全站五个时序列的 live 现状（与 audit_v89165_live 同源） ===');
var ujs = fs.readFileSync(R + 'js/ui.js', 'utf8');
[['openBattleList', 'ui.openBattleList();'],
 ['openTrainBoost', 'ui.openTrainBoost(bIdx);'],
 ['openPanel', 'ui.openPanel(view, title, size);'],
 ['openArtifacts', 'ui.openArtifacts();']].forEach(function (p) {
  P(p[0] + ' 的 live 回调就位', ujs.indexOf('live: function () { ' + p[1] + ' }') >= 0 || ujs.indexOf(p[1]) >= 0);
});
P('提速小窗 live 含完成判据（queueDone138）', ujs.indexOf('if (ui.queueDone138(bIdx)) ui.closeModal();') >= 0);

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
