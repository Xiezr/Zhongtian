/* v89.200 探针A：睡眠/离线期间自动打（挂起战斗自动打完）行为验证 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}

/* 造一场挂起战斗（§196③ 同款姿势） */
function makePending(st) {
  var c0 = st.cities[0];
  G.ui._cityId = c0.id;
  c0.army = { yibing: 60000 };
  var lord = G.lordGeneralOf();
  lord.status = 'idle'; lord.stamina = 100; lord.energy = 100;
  G.setStaNow(lord, G.staMax(lord));
  var w = null;
  for (var y = 5; y < 120 && !w; y++) {
    for (var x = 5; x < 120; x++) {
      var tl = G.map.tile(x, y);
      if (!tl || tl.terrain === 'city') continue;
      if (G.map.wildAt && G.map.wildAt(x, y)) continue;
      var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : G.map.wildLevel(x, y);
      if (lv >= 2 && lv <= 5) { w = { x: x, y: y }; break; }
    }
  }
  if (!w) return null;
  var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 60000 }, lord.id);
  if (!r.ok) return { err: r.msg };
  var n = 0;
  while (st.marches.length && n < 400) {
    G.march.tick(); n++;
    if (st.battles && st.battles.length) break;
  }
  return { rec: (st.battles || [])[0] || null, n: n, w: w };
}

console.log('══════ ① 门槛：60 秒（<300）不自动打 ══════');
var st1 = G.newGame({ name: 'v200a', cityName: '许都' });
st1.world.weather = 'clear';
if (!st1.map.grid) G.map.generate();
var m1 = makePending(st1);
console.log('  挂起: ' + (m1 && m1.rec ? m1.rec.id + '（' + (m1.rec.target && m1.rec.target.name || '') + '）' : JSON.stringify(m1)));
chk('造局：战斗已挂起', !!(m1 && m1.rec));
if (m1 && m1.rec) {
  G.offlineCatchup(60);
  chk('60 秒补算后仍挂起（门槛 300 秒未到）', (st1.battles || []).length === 1,
    'battles=' + (st1.battles || []).length);
  chk('60 秒报告 autoBattles=0', ((G._offlineReport || {}).autoBattles || 0) === 0,
    'ab=' + ((G._offlineReport || {}).autoBattles));
}

console.log('\n══════ ② 600 秒（≥300）→ 自动打完 + 战报 + 沙盘可回看 ══════');
var st2 = G.newGame({ name: 'v200b', cityName: '许都' });
st2.world.weather = 'clear';
if (!st2.map.grid) G.map.generate();
var m2 = makePending(st2);
chk('造局：战斗已挂起', !!(m2 && m2.rec));
if (m2 && m2.rec) {
  var recId = m2.rec.id;
  var rep0 = (st2.reports || []).length;
  G.offlineCatchup(600);
  chk('600 秒后挂起已清空', (st2.battles || []).length === 0, 'battles=' + (st2.battles || []).length);
  var jd = G._battleJustDone;
  chk('结束回执 ok 且 id 对', !!(jd && jd.ok && jd.id === recId), jd ? ('ok=' + jd.ok + ' id=' + jd.id) : 'no jd');
  chk('战报已生成（+1 份）', (st2.reports || []).length === rep0 + 1,
    'reports=' + (st2.reports || []).length + '/' + rep0);
  chk('报告 autoBattles=1', ((G._offlineReport || {}).autoBattles || 0) === 1,
    'ab=' + ((G._offlineReport || {}).autoBattles));
  var rep = st2.reports[0];
  var sb = G.battle.sandboxOf(rep);
  chk('沙盘配方在册（全程可回看）', !!(sb && sb.frames && sb.frames.length > 0),
    sb ? ('frames=' + sb.frames.length + ' rounds=' + sb.rounds) : 'no sb');
  var logHit = false;
  (st2.msgLog || []).forEach(function (m) { if ((m.msg || '').indexOf('场战斗已自动打完') >= 0) logHit = true; });
  chk('军情流水有「自动打完」记录', logHit, '');
  /* 归来报告 HTML 含行 */
  var html = G.ui.offlineReportHTML ? G.ui.offlineReportHTML() : '';
  chk('归来报告含「自动打完」行', html.indexOf('场战斗已自动打完') >= 0, '');
}

console.log('\n══════ ③ 会话缺失（模拟真离线读档）→ 就地重建打完 ══════');
var st3 = G.newGame({ name: 'v200c', cityName: '许都' });
st3.world.weather = 'clear';
if (!st3.map.grid) G.map.generate();
var m3 = makePending(st3);
chk('造局：战斗已挂起', !!(m3 && m3.rec));
if (m3 && m3.rec) {
  delete G._bsess[m3.rec.id];      /* 模拟读档：运行时会话不在 */
  var okRebuild = false;
  G.offlineCatchup(600);
  okRebuild = ((st3.battles || []).length === 0);
  chk('无会话也能打完（_makeEnv 就地重建）', okRebuild, 'battles=' + (st3.battles || []).length);
  chk('战报生成', (st3.reports || []).length >= 1, '');
}

console.log('\n══════ ④ 无战斗时：n=0 不误报 ══════');
var st4 = G.newGame({ name: 'v200d', cityName: '许都' });
st4.world.weather = 'clear';
if (!st4.map.grid) G.map.generate();
G.offlineCatchup(600);
chk('无挂起战斗：autoBattles=0', ((G._offlineReport || {}).autoBattles || 0) === 0, '');
var logHit4 = true;
(st4.msgLog || []).forEach(function (m) { if ((m.msg || '').indexOf('场战斗已自动打完') >= 0) logHit4 = false; });
chk('无战斗不写日志', logHit4, '');

console.log('\n══════ ⑤ 结构：出口与门槛在册 ══════');
chk('DATA.LOOP_GAP.battleAutoSec=300', (DATA.LOOP_GAP || {}).battleAutoSec === 300,
  'gate=' + (DATA.LOOP_GAP || {}).battleAutoSec);
chk('autoFinishBattles 出口在册', typeof G.battle.autoFinishBattles === 'function', '');

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(0);
