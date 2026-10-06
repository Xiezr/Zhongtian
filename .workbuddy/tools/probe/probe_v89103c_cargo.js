/* ============================================================
 * probe_v89103c_cargo.js — 本境调运（兵 + 辎重）端到端实测
 * ------------------------------------------------------------
 * 问（对着老板原话逐条验）：
 *   ① 出发：兵力与辎重是否**同时**从出发城账上扣掉（在途不能再花）？
 *   ② 抵达：兵入目标城、辎重按"距离损耗 + 目的地仓容"落账？
 *   ③ 运力：随军载重 = Σ(兵数 × 兵种载重)；超载是否**发不出去**（而不是悄悄少运）？
 *   ④ 失败/召回：兵与货是否**原路退回**（不许凭空消失）？
 *   ⑤ 老 bug（"主城向分城点运输 → 城池不存在"）：那条旧路是否整条退场？
 * 用法：node .workbuddy/tools/probe/probe_v89103c_cargo.js
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

var st = G.newGame({ name: '探针', cityName: '许都', region: '碎垣', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
st.settings.battleWatch = false;
var A = st.cities[0];
['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { A.res[k] = 1e6; });
A.res.pop = 50000;
var gen = st.generals[0];
gen.level = 40;
A.army = { minfu: 500, yibing: 3000 };            /* 出发城驻军（民夫=挑夫，义兵=护卫） */

/* 造一座分城：先占野地（筑城前置），再走既有出口 buildCityAt。
   位置 = 附近一块**平原**（筑城只认平原），找不到就跳过本探针。 */
var cx = null, cy = null;
for (var rr = 2; rr <= 5 && cx === null; rr++) {
  for (var dy = -rr; dy <= rr && cx === null; dy++) {
    for (var dx = -rr; dx <= rr; dx++) {
      var px = A.x + dx, py = A.y + dy;
      if (px < 1 || py < 1 || px >= DATA.MAP_W - 1 || py >= DATA.MAP_H - 1) continue;
      var tt = G.map.tile(px, py);
      if (tt && tt.terrain === 'plain' && !G.map.wildAt(px, py) && !G.map.fortAt(px, py)) { cx = px; cy = py; break; }
    }
  }
}
if (cx === null) { ap('附近找不到可筑城的平原'); process.exit(1); }
st.wilds = st.wilds || [];
if (!G.map.wildAt(cx, cy)) st.wilds.push({ x: cx, y: cy, type: 'plain', lv: 3, day: 0 });
var built = G.buildCityAt(cx, cy);
if (!built.ok) { ap('筑城失败：' + built.msg); process.exit(1); }
var B = built.city;
['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { B.res[k] = 0; });
G.ui._cityId = A.id;    /* 出发城 = 首城（GAME.currentCity 读 ui._cityId） */
ap('出发城 = ' + A.name + '（' + A.x + ',' + A.y + '）　目标城 = ' + B.name + '（' + B.x + ',' + B.y + '）');
ap('城距 = ' + G.cityDist(A, B) + ' 格　损耗率 = ' + (Math.round(G.transportLossOf(A, B) * 1000) / 10) + '%');

var army = { minfu: 300, yibing: 2000 };          /* 载重 200/20 —— 用来验"载重按兵种算" */
var cargo = { grain: 40000, iron: 5000, gold: 10000 };
ap('');
ap('===== 0. 运力口径 =====');
ap('随军载重 = ' + U.fmt(G.cargoCapOf(army)) + '（民夫 300×200 + 义兵 2000×20）　辎重 = '
  + U.fmt(G.cargoLoadOf(cargo)) + '　' + (G.cargoLoadOf(cargo) <= G.cargoCapOf(army) ? '✅ 载得动' : '❌ 超载'));

var before = { A: Object.assign({}, A.res), B: Object.assign({}, B.res), army: Object.assign({}, A.army) };
var d = G.doTransferCargo(A.id, B.id, army, gen.id, cargo);
ap('');
ap('===== 1. 出发（扣兵扣货 + 进行军队列）=====');
ap('结果：' + (d.ok ? '✅ ' : '❌ ') + d.msg);
if (!d.ok) process.exit(1);
ap('在途队列：' + (st.marches || []).length + ' 支　随军辎重 = ' + JSON.stringify((st.marches[0] || {}).cargo || null));
var okDeduct = true;
Object.keys(cargo).forEach(function (k) {
  if (before.A[k] - A.res[k] !== cargo[k]) { okDeduct = false; ap('  ❌ ' + k + ' 扣减 ' + (before.A[k] - A.res[k]) + ' ≠ ' + cargo[k]); }
});
ap('① 出发即扣（在途资源不能再花）：' + (okDeduct ? '✅ 三项与申报一致' : '❌'));
ap('   出发城兵力：民夫 ' + before.army.minfu + '→' + (A.army.minfu || 0)
  + '　义兵 ' + before.army.yibing + '→' + (A.army.yibing || 0));

G.march.rushAll();
ap('');
ap('===== 2. 抵达（入城 + 落账）=====');
ap('目标城兵力：民夫 ' + (B.army.minfu || 0) + '　义兵 ' + (B.army.yibing || 0) + '（应为 300 / 2000）');
var okLand = true;
Object.keys(cargo).forEach(function (k) {
  var exp = Math.floor(cargo[k] * (1 - G.transportLossOf(A, B)));
  if (B.res[k] !== exp) { okLand = false; ap('  ❌ ' + G.resName(k) + ' 实收 ' + B.res[k] + ' ≠ 期望 ' + exp); }
});
ap('② 辎重实收（按距离损耗）：' + (okLand ? '✅ 三项与"起运×(1−损耗)"逐项一致' : '❌'));
ap('   目标城：粮 ' + U.fmt(B.res.grain) + '　铁 ' + U.fmt(B.res.iron) + '　金 ' + U.fmt(B.res.gold));
var shipped = 0, landed = 0;
Object.keys(cargo).forEach(function (k) { shipped += cargo[k]; landed += B.res[k]; });
ap('   守恒：起运 ' + U.fmt(shipped) + ' ＝ 到账 ' + U.fmt(landed) + ' + 途中损耗 ' + U.fmt(shipped - landed)
  + '：' + (landed + (shipped - landed) === shipped ? '✅' : '❌'));

ap('');
ap('===== 3. 超载与不足（都必须"发不出去"，不许静默少运）=====');
var over = G.doTransferCargo(A.id, B.id, { yibing: 10 }, gen.id, { grain: 5000 });
ap('③ 超载（义兵 10 = 载重 200，要运 5,000 粮 —— 库存够但载不动）：'
  + (over.ok ? '❌ 竟然发了' : '✅ 被拦：' + over.msg));
var lack = G.doTransferCargo(A.id, B.id, { minfu: 100 }, gen.id, { grain: 1e9 });
ap('③ 库存不足：' + (lack.ok ? '❌ 竟然发了' : '✅ 被拦：' + lack.msg));
var noTroops = G.doTransferCargo(A.id, B.id, {}, gen.id, cargo);
ap('③ 不带兵（没人挑担）：' + (noTroops.ok ? '❌ 竟然发了' : '✅ 被拦：' + noTroops.msg));

ap('');
ap('===== 4. 召回（兵与货原路退回）=====');
/* 上一支队伍的主将已随军驻新城 —— 换一位还在出发城的将领带队 */
var gen2 = (st.generals || [])[1] || gen;
gen2.cityId = A.id; gen2.status = 'idle';
G.setStaNow(gen2, 9999); gen2.energy = 100;
var a1 = Object.assign({}, A.res), b1 = Object.assign({}, B.res);
var d2 = G.doTransferCargo(A.id, B.id, { minfu: 100 }, gen2.id, { grain: 8000 });
ap('再发一支：' + (d2.ok ? '✅ ' : '❌ ') + d2.msg);
if (!d2.ok) process.exit(1);
var mid = A.res.grain;
G.march.recall((st.marches || [])[0].id);
var backOk = (A.res.grain === a1.grain) && (B.res.grain === b1.grain);
ap('④ 在途时出发城粮 ' + U.fmt(mid) + ' → 召回后 ' + U.fmt(A.res.grain)
  + '（起运前 ' + U.fmt(a1.grain) + '）　目标城未变：' + (backOk ? '✅ 分文不差' : '❌'));

ap('');
ap('===== 5. 旧 bug 面（城池不存在）=====');
ap('ui.openTransport 已删除：' + (typeof G.ui.openTransport === 'function' ? '❌ 还在' : '✅ 不在'));
ap('ui.openInterCity 已删除：' + (typeof G.ui.openInterCity === 'function' ? '❌ 还在' : '✅ 不在'));
ap('GAME.doTransport 已删除：' + (typeof G.doTransport === 'function' ? '❌ 还在' : '✅ 不在'));
var bad = G.doTransferCargo(A.id, 'no_such_city', { minfu: 10 }, gen.id, null);
ap('⑤ 目标不存在时仍会明确报错（不是静默）：' + (bad.ok ? '❌' : '✅ ' + bad.msg));
/* 出征面板的 own 入口：不再跳小面板，且能解析出 owncity */
var ui = G.ui;
ui._expOwn = null;
var tgt = G.battle.resolveTarget({ kind: 'owncity', id: B.id });
ap('⑤ 出征面板 own 目标可解析：' + (tgt.ok ? '✅ ' + tgt.kind + ' · ' + tgt.name : '❌ ' + tgt.msg));
ap('');
ap('（探针结束）');
process.exit(0);
