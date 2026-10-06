/* v89.210 探针：战前推演（previewOf）—— 与实战同源对照 + 零落账
   ------------------------------------------------------------
   断言按目标态写：previewOf 落盘前跑 → 红（previewOf 不存在 → 探针走防御分支）；
   落盘后跑 → 全绿。
   对照法：关斗将（DATA.DUEL.enabled=false，用完还原）→ 推演与真打一场的结果应逐项相等。
   ------------------------------------------------------------
   运行：node .workbuddy/tools/probe/probe_v89210_sim.js（输出重定向到文件再读） */
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra == null ? '' : extra) + ']'); }
}

console.log('=== ① previewOf 在册 ===');
chk('① previewOf / defenseInputsOf 唯一出口在册', typeof G.battle.previewOf === 'function'
  && typeof G.battle.defenseInputsOf === 'function');

var keep = G.state;
var bkDuel = DATA.DUEL.enabled;
try {
  var st = G.newGame({ name: '推演探针', cityName: '许都' });
  G.state = st;
  if (!st.map.grid) G.map.generate();
  st.world.weather = 'clear';
  st.settings.battleWatch = false;          /* 即时结算 */
  DATA.DUEL.enabled = false;                /* 关斗将随机（对照需同一输入） */

  var c0 = st.cities[0];
  c0.army = { yibing: 300000 };
  var g0 = st.generals[0];
  G.setStaNow(g0, G.staMax(g0)); g0.energy = 100;

  /* 找有守军的无主野地（§200② 选靶三查） */
  var w = null;
  for (var rr = 2; rr <= 40 && !w; rr++) {
    for (var dy = -rr; dy <= rr && !w; dy++) for (var dx = -rr; dx <= rr && !w; dx++) {
      var x = c0.x + dx, y = c0.y + dy;
      var tl = G.map.tile(x, y);
      if (!tl || tl.terrain === 'city') continue;
      if (G.map.wildAt(x, y) || G.map.npcAt(x, y) || G.map.fortAt(x, y)) continue;
      var lv = G.map.wildLevelNow(x, y);
      if (!(lv > 0)) continue;
      var dfe = G.wildDefenseAt(x, y, lv);
      if (dfe && dfe.total > 0) w = { x: x, y: y, lv: lv };
    }
  }
  chk('② 选靶：有守军的野地', !!w, w ? ('Lv' + w.lv + ' @' + w.x + ',' + w.y) : 'none');
  if (!w) { console.log('（造局失败：随机地图，跳过后续）'); process.exit(0); }

  console.log('=== ③ 推演：零落账 ===');
  var a0 = c0.army.yibing, r0 = (st.reports || []).length, m0 = (st.marches || []).length;
  var sta0 = G.staNow(g0);
  var pv = G.battle.previewOf({ kind: 'wild', x: w.x, y: w.y }, 'occupy', { yibing: 60000 }, g0.id);
  chk('③a 推演返回 ok', !!(pv && pv.ok), pv && pv.msg);
  chk('③b 推演不动兵', c0.army.yibing === a0, 'army=' + c0.army.yibing + ' vs ' + a0);
  chk('③c 推演不动体力', Math.abs(G.staNow(g0) - sta0) < 0.001, 'sta=' + G.staNow(g0) + ' vs ' + sta0);
  chk('③d 推演不写战报 / 不发兵', (st.reports || []).length === r0 && (st.marches || []).length === m0);
  if (pv && pv.ok) {
    console.log('    推演读数：winner=' + pv.result.winner + ' rounds=' + pv.result.rounds
      + ' 我损=' + pv.result.atkLoss + ' 敌损=' + pv.result.defLoss
      + ' 我存=' + pv.result.atkRemain + ' 敌存=' + pv.result.defRemain);
  }

  console.log('=== ④ 与实战对照（真打一场） ===');
  var ry = G.battle.expedition({ kind: 'wild', x: w.x, y: w.y }, 'occupy', { yibing: 60000 }, g0.id);
  chk('④a 真打返回 ok', !!(ry && ry.ok), ry && ry.msg);
  var rr2 = ry && ry.result;
  if (pv && pv.ok && rr2) {
    chk('④b winner 一致', pv.result.winner === rr2.winner, pv.result.winner + ' vs ' + rr2.winner);
    chk('④c atkLoss 一致', pv.result.atkLoss === rr2.atkLoss, pv.result.atkLoss + ' vs ' + rr2.atkLoss);
    chk('④d defLoss 一致', pv.result.defLoss === rr2.defLoss, pv.result.defLoss + ' vs ' + rr2.defLoss);
    chk('④e rounds 一致', pv.result.rounds === rr2.rounds, pv.result.rounds + ' vs ' + rr2.rounds);
    chk('④f atkRemain / defRemain 一致',
      pv.result.atkRemain === rr2.atkRemain && pv.result.defRemain === rr2.defRemain,
      pv.result.atkRemain + '/' + pv.result.defRemain + ' vs ' + rr2.atkRemain + '/' + rr2.defRemain);
  }
  console.log('=== ⑤ 城防缩放同源（据点对照：defenseInputsOf 直读 vs 推演） ===');
  var ft = null;
  for (var x2 = 30; x2 < 130 && !ft; x2++) for (var y2 = 30; y2 < 130 && !ft; y2++) {
    var f2 = G.map.fortAt(x2, y2);
    if (f2) ft = f2;
  }
  if (ft) {
    var tp = G.battle.resolveTarget({ kind: 'fort', x: ft.x, y: ft.y });
    var di = G.battle.defenseInputsOf(tp, 'occupy', {});
    chk('⑤ 守方输入含围攻缩放（scArmy / scVal / simOpts 在册）',
      !!di && !!di.scArmy && !!di.simOpts && typeof di.scVal === 'number',
      'scNote=' + (di && di.scNote) + ' scVal=' + (di && di.scVal));
  } else {
    chk('⑤ 据点造局（随机地图缺据点 → 跳过）', true, 'skip');
  }
} finally {
  DATA.DUEL.enabled = bkDuel;
  G.state = keep;
}

console.log('\n===== 探针结果：' + PASS + ' / ' + (PASS + FAIL) + ' =====');
process.exit(FAIL ? 1 : 0);
