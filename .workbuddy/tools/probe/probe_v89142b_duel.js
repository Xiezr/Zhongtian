'use strict';
/* v89.142 探针 B：斗将链路断点定位（观战挂起 → 结算 → 战报）
   跑法：node .workbuddy/tools/probe/probe_v89142b_duel.js > .workbuddy/tmp/p142b.txt 2>&1 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var st = G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260942 });
if (!st.map.grid) G.map.generate();
var c = st.cities[0];
G.ui._cityId = c.id;

/* 强制必触发（用完还原） */
var chBank = DATA.DUEL.chance; DATA.DUEL.chance = 1;

/* 造一个与我方城相邻的据点（守将由 v89.129 的派生规则给） */
var FX = c.x + 2, FY = c.y + 2;
var fort = G.map.fortAt(FX, FY);
if (!fort && G.map.makeFort) { G.map.makeFort(FX, FY); fort = G.map.fortAt(FX, FY); }
if (!fort) { console.log('⚠ 据点未造出（改打 NPC 城）'); }
var tgt = fort ? { kind: 'fort', x: FX, y: FY } : null;
if (!tgt) {
  var nc = (st.map.cities || [])[0];
  tgt = { kind: 'city', id: nc.id, npc: nc };
}
var tRes = G.battle.resolveTarget(tgt);
console.log('目标解析：kind=' + tRes.kind + ' name=' + tRes.name +
  ' 守将=' + (tRes.guard ? tRes.guard.name : '（无）'));
console.log('我方主将：' + st.generals[0].name);
if (!tRes.guard) { console.log('⚠ 无守将 → 斗将必不触发（命中率类目标请换一个）'); }

/* 配兵（够打一场） */
var gen = st.generals[0];
gen.stamina = 999; gen.energy = 999;
c.army = { changqiang: 60000, gongjian: 20000 };
st.settings.battleWatch = true;              /* 观战（默认）：先挂起 */
var exp = G.battle.expedition(tgt, 'occupy', { changqiang: 30000 }, gen.id, {});
console.log('\n=== ① 观战挂起：返回值 ===');
console.log(JSON.stringify(exp));
var rec = null;
(st.battles || []).forEach(function (b) { rec = b; });
if (!rec) { console.log('⚠ 没有挂起记录（可能即时结算了）'); process.exit(0); }
console.log('\n=== ② rec.sim 字段清单（挂起时保存的权威输入）===');
console.log('keys = ' + JSON.stringify(Object.keys(rec.sim || {})));
console.log('duel      = ' + JSON.stringify(rec.sim.duel === undefined ? '（缺！）' : rec.sim.duel));
console.log('genSim    = ' + JSON.stringify(rec.sim.genSim === undefined ? '（缺！）'
  : { name: rec.sim.genSim.name, _duelBoost: rec.sim.genSim._duelBoost }));
console.log('scGen     = ' + JSON.stringify(rec.sim.scGen && { name: rec.sim.scGen.name, _duelBoost: rec.sim.scGen._duelBoost }));

/* 把战斗推到结束（快进） */
console.log('\n=== ③ 结算后 ===');
var guardN = 0;
while (rec.state === 'live' && guardN++ < 400) {
  var r0 = G.battle.stepBattle(rec.id);
  if (!r0) break;
  if (rec.state !== 'live') break;
}
/* stepBattle 到回合上限会自动 finish；保险再推一次 */
var rep = (G.state.reports || [])[0];
console.log('战斗状态 = ' + rec.state + '（推了 ' + guardN + ' 次）');
if (rep) {
  console.log('最新战报标题 = ' + rep.title);
  console.log('战报含【斗将】= ' + ((rep.body || '').indexOf('【斗将】') >= 0));
  var i = (rep.body || '').indexOf('斗将');
  if (i >= 0) console.log('  片段：' + JSON.stringify(rep.body.slice(Math.max(0, i - 60), i + 120)));
}
/* 斗将日志 */
var duelLogs = (G.state.log || []).filter(function (l) { return (l.text || '').indexOf('斗将') >= 0; });
console.log('日志里的斗将行 = ' + duelLogs.length + (duelLogs[0] ? '：' + duelLogs[0].text.slice(0, 80) : ''));

DATA.DUEL.chance = chBank;
process.exit(0);
