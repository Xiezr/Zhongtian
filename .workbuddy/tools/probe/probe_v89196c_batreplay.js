/* v89.196 探针C：战斗回看（老板 4）——三情形数据链
   ① autoBattle 路径：打完 → _battleJustDone.report 存在 → sandboxOf(report) 帧数 >0
   ② report === s.reports[0]（同步采集正确）
   ③ repRidOf 赋号 + sdOpenDone 可开沙盘（桩 DOM）
   ④ retreatBattle 路径：撤退战同样带回执
   ⑤ 沙盘重跑 verify（智能托管下）*/
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '探针C96', region: '烬环' });
if (!G.state.map.grid) G.map.generate();
var s = G.state, c0 = s.cities[0];
c0.army = { yibing: 60000 };
var lord = G.lordGeneralOf();
lord.stamina = 100; lord.energy = 100;

function findWild() {
  for (var y = 5; y < 120; y++) {
    for (var x = 5; x < 120; x++) {
      var tl = G.map.tile(x, y);
      if (!tl || tl.terrain === 'city') continue;
      if (G.map.wildAt && G.map.wildAt(x, y)) continue;
      var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : G.map.wildLevel(x, y);
      if (lv >= 2 && lv <= 5 && (Math.abs(x - c0.x) > 3 || Math.abs(y - c0.y) > 3)) return { x: x, y: y, lv: lv };
    }
  }
  return null;
}

function runOne(mode, tag) {
  var w = findWild();
  if (!w) { console.log('  ' + tag + '：找不到野地'); return; }
  c0.army = { yibing: 60000 };
  lord.status = 'idle'; lord.stamina = 100; lord.energy = 100;
  s.marches = s.marches || [];
  var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, mode, { yibing: 60000 }, lord.id);
  if (!r.ok) { console.log('  ' + tag + '：dispatch 被拒 ' + r.msg); return; }
  var n = 0;
  while (s.marches.length && n < 400) {
    G.march.tick();
    n++;
    if (s.battles && s.battles.length) break;   /* 抵达转战斗 */
  }
  var rec = (s.battles || [])[0];
  if (!rec) { console.log('  ' + tag + '：未进入战斗（marches=' + s.marches.length + '）'); return; }
  console.log('  ' + tag + '：战斗挂起 rec.id=' + rec.id + '（' + (rec.target && rec.target.name) + '）');
  if (mode === 'raid' && tag.indexOf('撤退') >= 0) {
    G.battle.stepBattle(rec.id);
    G.battle.stepBattle(rec.id);
    var rr = G.battle.retreatBattle(rec.id);
    console.log('    retreatBattle → ' + (rr ? '落账' : 'null'));
  } else {
    var ab = G.battle.autoBattle(rec.id);
    console.log('    autoBattle → ' + (ab ? '落账' : 'null'));
  }
  var jd = G._battleJustDone;
  console.log('    _battleJustDone：ok=' + (jd && jd.ok) + ' winner=' + (jd && jd.winner)
    + ' rounds=' + (jd && jd.rounds) + ' report=' + !!(jd && jd.report));
  if (jd && jd.report) {
    var sb = G.battle.sandboxOf(jd.report);
    console.log('    report === s.reports[0]？' + (jd.report === s.reports[0])
      + '　sandboxOf frames=' + (sb ? sb.frames.length : -1)
      + ' verify=' + (sb ? sb.verify : '-') + '　rounds=' + (sb ? sb.rounds : '-'));
    var rid = G.repRidOf ? G.repRidOf(jd.report) : null;
    console.log('    repRidOf=' + rid + '（应非空）');
  }
}

console.log('══════ ① autoBattle 路径（真打一场）══════');
runOne('raid', 'autoBattle');
console.log('\n══════ ② 撤退路径 ══════');
runOne('raid', '撤退战');
console.log('\n══════ ③ sdOpenDone（桩 DOM · 结束回执直开沙盘）══════');
try {
  var ok3 = G.ui.sdOpenDone();
  console.log('  sdOpenDone → ' + ok3 + '　_sd 建立=' + !!G.ui._sd
    + '（frames=' + (G.ui._sd && G.ui._sd.sb ? G.ui._sd.sb.frames.length : '-') + '）');
} catch (e) { console.log('  sdOpenDone 异常：' + e.message); }

console.log('\n完成。');
process.exit(0);
