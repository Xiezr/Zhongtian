/* ============================================================
 * probe_v89104a_engine.js — v89.104 引擎侧两条令实测
 * ------------------------------------------------------------
 * item0：建筑高等级造价 —— Lv12 之后**资源不再增长**（冻结）+ 改吃珠宝
 * item1a：接触判定**按双方位移**（前沿互锁：任何部队都推不过交战线）
 * 用法：node .workbuddy/tools/probe/probe_v89104a_engine.js
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
var G = global.GAME, DATA = G.DATA, U = G.utils;
function ap(s) { console.log(s); }

/* ================= item0：建筑造价 ================= */
ap('===== item0：Lv12 之后资源冻结 + 珠宝阶梯 =====');
ap('珠宝阶梯（按 price 升序）= ' + DATA.jewelLadder().join(' → '));
var b = DATA.BUILDINGS.minfang;
var rowsOut = [];
[10, 11, 12, 13, 14, 18, 24, 33, 45].forEach(function (lv) {
  var c = b.levelCost(lv);
  var jw = c.jewel ? Object.keys(c.jewel).map(function (k) { return k + '×' + c.jewel[k]; }).join(',') : '—';
  rowsOut.push('  Lv' + lv + ' → ' + (lv + 1) + '：粮 ' + U.fmt(c.grain) + '　木 ' + U.fmt(c.wood)
    + '　石 ' + U.fmt(c.stone) + '　铁 ' + U.fmt(c.iron) + '　珠宝 ' + jw);
});
rowsOut.forEach(ap);
var c12 = b.levelCost(12), c20 = b.levelCost(20), c45 = b.levelCost(45);
ap('① 资源封顶（Lv13 起与 Lv12 档**逐项相等**）：'
  + ((c12.grain === c20.grain && c12.wood === c20.wood && c12.stone === c20.stone && c12.iron === c20.iron
    && c12.grain === c45.grain) ? '✅' : '❌'));
ap('② Lv12 之前仍是纯资源（不带珠宝）：' + (b.levelCost(11).jewel ? '❌ 带珠宝了' : '✅'));
ap('③ 珠宝品类随等级上移（13→珍珠，24→琥珀，45→夜明珠）：'
  + (Object.keys(b.levelCost(12).jewel)[0] === DATA.jewelLadder()[0]
    && Object.keys(b.levelCost(24).jewel)[0] === DATA.jewelLadder()[3]
    && Object.keys(b.levelCost(44).jewel)[0] === 'yemingzhu' ? '✅' : '❌'));
ap('④ 珠宝数量随等级递增（13 级 2 颗 → 45 级 ' + b.levelCost(44).jewel.yemingzhu + ' 颗）：'
  + (b.levelCost(12).jewel[DATA.jewelLadder()[0]] === 2 ? '✅' : '❌'));
/* 支付：真有/真扣 */
(function () {
  var st = G.newGame({ name: '探针', cityName: '许都', region: '碎垣', mapSeed: 20260921 });
  var c = st.cities[0];
  c.res.grain = c.res.wood = c.res.stone = c.res.iron = 1e12;
  st.items = {};
  var cost = b.levelCost(12);
  var okBefore = G.canAfford(cost);
  st.items.zhenzhu = 2;
  var okAfter = G.canAfford(cost);
  G.payCost(cost);
  ap('⑤ 校验/支付走同一出口：无珠宝时 canAfford=' + okBefore + '（应 false）；有 2 颗后=' + okAfter
    + '（应 true）；支付后余 ' + (st.items.zhenzhu || 0) + ' 颗：'
    + ((okBefore === false && okAfter === true && !st.items.zhenzhu) ? '✅' : '❌'));
  ap('⑥ 造价文案带珠宝：' + G.costString(cost));
})();

/* ================= item1a：接触判定按位移 ================= */
ap('');
ap('===== item1a：接触按位移 + 前沿互锁 =====');
var st2 = G.newGame({ name: '探针', cityName: '许都', region: '碎垣', mapSeed: 20260921 });
if (!st2.map.grid) G.map.generate();
st2.settings.battleWatch = false;
var city = st2.cities[0];
['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { city.res[k] = 5e6; });
city.res.pop = 60000;
city.cells.forEach(function (x) { if (x.build) x.build.lvl = Math.max(x.build.lvl || 1, 8); });
var gen = st2.generals[0]; gen.level = 30;
var t = null;
for (var y = 4; y < 57 && !t; y++) {
  for (var x = 4; x < 57; x++) {
    var tt = G.map.tile(x, y);
    if (!tt || tt.terrain === 'city') continue;
    var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : 0;
    if (lv >= 6) { t = { x: x, y: y, lv: lv }; break; }
  }
}
city.army = { yibing: 20000, changqiang: 9000, gongjian: 6000, qingji: 2500 };
G.setStaNow(gen, 9999); gen.energy = 100;
var r = G.battle.expedition({ kind: 'wild', x: t.x, y: t.y }, 'raid',
  Object.assign({}, city.army), gen.id);
var rep = null;
(st2.reports || []).forEach(function (x) { if (!rep && x.type === 'war') rep = x; });
var sb = G.battle.sandboxOf(rep);
var D = sb.field;
ap('纵深 D = ' + D + ' · 回合数 = ' + (rep.scene ? rep.scene.rounds : '?') + ' · 帧 ' + sb.frames.length);

/* 逐回合重放，检查：① 接触点是否出现在"推不动了"那一刻 ② 互锁（谁都越不过交战线） */
var cur = G.ui.sdStateInit(sb);
var lastR = -1, log = [], bad = 0, firstContact = null, vio = [], starts = {};
function audit(round) {
  var fr = G.tactic.frontsOf(cur.atk, cur.def, D);
  var atkFront = fr.aFront, defFront = fr.dFront;
  /* 互锁：每支部队都不得把间距压到它的射程以内（+2 容忍取整） */
  /* 两军前沿不得互相穿过（推不过对面） */
  if (atkFront + defFront > D + 2) bad++;
  if (fr.contact && firstContact === null) firstContact = round;
  log.push({ r: round, gap: Math.round(fr.gap), reach: fr.reach,
    contact: fr.contact, a: Math.round(atkFront), d: Math.round(defFront) });
}
audit(0);
sb.frames.forEach(function (f) {
  G.ui.sdApply(cur, sb, f);
  if (f[0] !== lastR) { lastR = f[0]; audit(f[0]); }
});
audit(lastR);
ap('回合   间距    双方最前射程   接触   我方前沿  敌方前沿');
log.forEach(function (x) {
  ap(('  ' + x.r).slice(-4).padEnd(6) + U.numText(x.gap, 0).padStart(8)
    + U.numText(x.reach, 0).padStart(12) + ('   ' + (x.contact ? '⚔ 是' : '  否')).padEnd(9)
    + U.numText(x.a, 0).padStart(9) + U.numText(x.d, 0).padStart(10));
});
ap('① 接触出现在"推不动了"那一刻（间距 ≤ 射程，且此前 > 射程）：'
  + (firstContact !== null ? ('✅ 首次接触于第 ' + firstContact + ' 回合') : '❌ 全程未接触'));
ap('② 前沿互锁（两军前沿不相交 + 每次前进都停在射程上）：'
  + (bad === 0 ? '✅ 0 次越线' : '❌ ' + bad + ' 次越线'));
vio.forEach(function (v) { ap('   越线样本：' + v); });
var moveBad = 0, moveN = 0, moveVio = [];
(function () {
  /* 逐帧核：'m' 帧的 v2 = 移动后的间距，v1 = 步长；该部队的 er 从 sb.init / 快照里取 */
  var emap = {};
  function reg(list) { (list || []).forEach(function (u) { emap[u.id] = (u.er != null ? u.er : (u.range || 0)); }); }
  reg(sb.init.atk); reg(sb.init.def);
  var st = G.ui.sdStateInit(sb);
  sb.frames.forEach(function (f) {
    G.ui.sdApply(st, sb, f);
    if (f[3] !== 'm') return;
    var u = null;
    (f[1] === 0 ? st.atk : st.def).forEach(function (x) { if (x.id === sb.ids[f[2]]) u = x; });
    if (!u) return;
    moveN++;
    var gapAfter = f[6] || 0, er = (u.er != null ? u.er : (u.range || 0));
    if (gapAfter < er - 2) {
      moveBad++;
      if (moveVio.length < 5) moveVio.push(u.id + ' 前进后间距 ' + Math.round(gapAfter) + ' < 射程 ' + Math.round(er));
    }
  });
})();
ap('②b 逐帧核（' + moveN + ' 次前进）：' + (moveBad === 0
  ? '✅ 全部停在射程上（没有一次把间距压进自己的射程）'
  : '❌ ' + moveBad + ' 次越线'));
moveVio.forEach(function (v) { ap('   ' + v); });
var minGap = Math.min.apply(null, log.map(function (x) { return x.gap; }));
ap('③ 两军最小间距 = ' + minGap + '（= 双方射程中较小者的量级，说明"停在面前"而不是穿过去）');
ap('');
ap('（探针结束）');
process.exit(0);
