/* ============================================================
 * probe_v89114b_haul.js — 需求 1 端到端：真打一场，验"掠夺 ≤ 随军载重"
 * 场景三组（全部走真实出口 GAME.battle.expedition）：
 *   ① 纯小股部队打野地 Lv3：掠夺量应被载重截断（haul.factor < 1）
 *   ② 同样兵力 + 足量辎重车：应全数搬回（factor = 1）
 *   ③ 打印战报正文里的「资财/运力」与「运力不足」两行，肉眼复核
 * 用法：node .workbuddy/tools/probe/probe_v89114b_haul.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
  'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils;
var st = G.newGame({ name: '量', cityName: '许都', mapSeed: 20260924 });
if (!st.map.grid) G.map.generate();
var city = G.currentCity();
/* 记录 expedition 的返回值（arrive 内部调用它，局部变量不外露 —— 探针包一层） */
var _exp0 = G.battle.expedition, _lastR = null;
G.battle.expedition = function () { _lastR = _exp0.apply(this, arguments); return _lastR; };

/* 一个将领（出征必须有主将） */
var gen = (st.generals || [])[0];
gen.cityId = city.id; gen.status = 'idle';
G.ui._cityId = city.id;

/* 在城旁放两片野地（Lv3），并给城里放兵 */
function putWild(x, y) {
  var w = { x: x, y: y, type: 'plain', lv: 3, terrain: 'plain' };
  st.wilds.push(w);
  return w;
}
var w1 = putWild(city.x + 2, city.y);
var w2 = putWild(city.x + 3, city.y);
function fill(army) {
  city.army = {};
  Object.keys(army).forEach(function (k) { city.army[k] = army[k]; });
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function sumOf(o) { var t = 0; for (var k in (o || {})) t += Math.max(0, o[k] || 0); return t; }

function run(army, label) {
  fill(clone(army));
  /* 需要体力/精力：直接给满；关观战（挂起会话要逐回合推进，探针不需要） */
  G.setStaNow(gen, 200); gen.energy = 200;
  st.settings = st.settings || {}; st.settings.battleWatch = false;
  var t = { kind: 'wild', x: w1.x, y: w1.y, name: '试野地', lv: 3, terrain: 'plain' };
  /* 出征 = 出发（建行军）→ 拨时钟 → tick（触发抵达结算） */
  var d = G.march.dispatch(t, 'raid', clone(army), gen.id, null, null, null);
  if (!d || d.ok === false) { console.log('\n【' + label + '】出发失败：' + ((d && d.msg) || '-')); return d; }
  _lastR = null;
  (st.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
  G.march.tick();
  var r = _lastR;
  console.log('\n【' + label + '】');
  if (!r) { console.log('  未捕获到结算返回（看下方战报）'); }
  else { console.log('  ok=' + r.ok + '  msg=' + (r.msg || '-')); }
  var h = r && r.gains && r.gains.haul;
  if (!h) { console.log('  无 haul（未走掠夺结算）'); }
  else {
    console.log('  载重 cap=' + U.fmt(h.cap) + '  库藏重 weight=' + U.fmt(h.weight)
      + '  factor=' + h.factor.toFixed(2));
    console.log('  实得 kept=' + U.fmt(h.kept) + '  未及搬走 lost=' + U.fmt(h.lost));
    console.log('  gains.res 总重=' + U.fmt(sumOf(r.gains.res)) + '  （应 = kept 且 ≤ cap）');
  }
  var rep = (G.state.reports || [])[0];
  if (rep) {
    console.log('  战报标题：' + rep.title);
    (rep.loot || []).forEach(function (l) { console.log('    · ' + String(l).replace(/<[^>]*>/g, '')); });
  }
  return r;
}

/* ① 小股部队（300 义兵 = 15000 载重）—— 野地 Lv3 掠夺量 ~27 万 → 应被截断 */
var r1 = run({ yibing: 300 }, '① 300 义兵（远不够搬）');

/* ② 主力 + 辎重车（300 义兵 + 60 辎重车 = 15000 + 120 万载重）—— 应全搬 */
var r2 = run({ yibing: 300, zhouche: 60 }, '② 300 义兵 + 60 辎重车（运力充足）');

/* ③ 断言核对 */
console.log('\n=== 断言核对 ===');
var A = r1.gains.haul, B = r2.gains.haul;
console.log('  ① 截断：factor<1 → ' + (A.factor < 1) + '（' + A.factor.toFixed(3) + '）');
console.log('  ① 入账 ≤ 载重：' + (sumOf(r1.gains.res) <= A.cap) + '（' + sumOf(r1.gains.res) + ' ≤ ' + A.cap + '）');
console.log('  ① 有未搬走：lost>0 → ' + (A.lost > 0) + '（' + A.lost + '）');
console.log('  ② 全搬：factor=1 → ' + (B.factor === 1) + '，lost=0 → ' + (B.lost === 0));
console.log('  ② 入账 > ① 入账（后勤的价值）：' + (sumOf(r2.gains.res) > sumOf(r1.gains.res)));

process.exit(0);
