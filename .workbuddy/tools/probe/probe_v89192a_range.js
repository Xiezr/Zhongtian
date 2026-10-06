/* v89.192 探针A：指定目标在射程外时是否出手（老板实测场景复现）
 * ------------------------------------------------------------
 * 老板日志（战报沙盘回放）：
 *   敌军 轻骑兵 前进 875（最近距离 1,425）
 *   敌军 长枪兵 前进 300（最近距离 2,000）
 *   敌军 刀盾兵 前进 275（最近距离 2,025）
 *   我军 弓箭手 前进 267（最近距离 1,733）
 *   敌军 弓箭手 前进 250（最近距离 1,783）
 *   全域 2300（推自数据；老板记成 2500）
 * 推演：我弓 target=长枪（1733 外），但最近敌人轻骑 1158 已在射程 1200 内
 *   → 引擎只让它"前进"、不开火。验证点：
 *   ① 复现：目标在射程外 + 有敌人在射程内 → events 里有 move 无 attack（BUG）
 *   ② 目标在射程内 → 打目标（既有行为，不能被修复破坏）
 *   ③ 通用：无指定目标 + 有敌人在射程内 → 打最近（既有行为）
 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;
G.newGame({ name: 'range192', region: '烬环' });
G.state.world.weather = 'clear';                        /* v89.178 纪律：战斗探针固定天气 */

var T = G.tactic;
var D = 2300;
var ARMY_ATK = { gongjian: 3000 };
var ARMY_DEF = { qingji: 3000, changqiang: 3000, daodun: 3000, gongjian: 3000 };

function mkEnv(stances) {
  var env = T.begin(ARMY_ATK, null, ARMY_DEF, 0, null, { field: D, stances: stances || {} });
  return env;
}
function setAdv(env, side, id, adv) {
  env.units[side].forEach(function (u) { if (u.id === id) u.adv = adv; });
}
function evOf(env, r, side, id) {
  return (r.events || []).filter(function (e) { return e.side === side && e.id === id; });
}
function fmt(evs) {
  return evs.map(function (e) {
    return e.kind + (e.step ? '(' + Math.round(e.step) + ')' : '') + (e.kill ? '(' + e.kill + '→' + (e.target || '') + ')' : '');
  }).join(' ');
}
function one(side, id) { return (evs) => evs; } /* noop */

console.log('══════ 场景①：目标=长枪（射程外 1733）· 轻骑在射程内（1158）══════');
(function () {
  var env = mkEnv();
  /* 老板场景静止一帧：我弓 adv=267（刚前进完 267）· 敌轻骑 875 · 长枪 300 · 刀盾 275 · 敌弓 0
     → 距轻骑 = 2300-267-875 = 1158（**射程 1200 内**）· 距目标长枪 = 1733（外）
     全敌 hold（不推进）—— 稳定复现"目标远、轻骑近"的那一帧 */
  setAdv(env, 'atk', 'gongjian', 267);
  setAdv(env, 'def', 'qingji', 875); setAdv(env, 'def', 'changqiang', 300);
  setAdv(env, 'def', 'daodun', 275); setAdv(env, 'def', 'gongjian', 0);
  ['qingji', 'changqiang', 'daodun', 'gongjian'].forEach(function (id) {
    env.setCmd('def', id, { s: 'hold' });
  });
  env.setCmd('atk', 'gongjian', { s: 'advance', t: 'changqiang' });
  var r = env.step();
  var evs = evOf(env, r, 'atk', 'gongjian');
  var gaps = { 轻骑: D - 267 - 875, 长枪: D - 267 - 300, 刀盾: D - 267 - 275, 敌弓: D - 267 - 0 };
  console.log('  行动前距各敌：', JSON.stringify(gaps), ' 射程=1200');
  console.log('  弓箭手事件：', fmt(evs) || '(无)');
  console.log('  判定：' + (evs.some(function (e) { return e.kind === 'attack'; })
    ? '✅ 有出手（射程内轻骑被打到）'
    : '❌ 复现 BUG —— 射程内有敌（轻骑 1158）却只前进不开火'));
})();

console.log('══════ 场景②：目标=长枪 且**在射程内**（我弓 adv=900 → 距长枪 1100）══════');
(function () {
  var env = mkEnv();
  setAdv(env, 'atk', 'gongjian', 900);
  setAdv(env, 'def', 'qingji', 875); setAdv(env, 'def', 'changqiang', 300);
  setAdv(env, 'def', 'daodun', 275); setAdv(env, 'def', 'gongjian', 0);
  env.setCmd('atk', 'gongjian', { s: 'advance', t: 'changqiang' });
  var r = env.step();
  var evs = evOf(env, r, 'atk', 'gongjian');
  console.log('  行动前距：轻骑=575（更近）· 长枪=1100（目标·射程内）');
  console.log('  弓箭手事件：', fmt(evs) || '(无)');
  var atk = evs.filter(function (e) { return e.kind === 'attack'; })[0];
  console.log('  判定：' + (atk && atk.targetId === 'changqiang'
    ? '✅ 打的是指定目标（长枪）—— 指定优先保留'
    : (atk ? '⚠ 打的是 ' + atk.targetId + '（应=changqiang）' : '❌ 没开火')));
})();

console.log('══════ 场景③：无指定目标 · 轻骑在射程内（1158）→ 应打最近（轻骑）══════');
(function () {
  var env = mkEnv();
  setAdv(env, 'atk', 'gongjian', 267);
  setAdv(env, 'def', 'qingji', 875); setAdv(env, 'def', 'changqiang', 300);
  setAdv(env, 'def', 'daodun', 275); setAdv(env, 'def', 'gongjian', 0);
  ['qingji', 'changqiang', 'daodun', 'gongjian'].forEach(function (id) {
    env.setCmd('def', id, { s: 'hold' });
  });
  /* 不设 target —— 默认；距轻骑 1158 在射程内 */
  var r = env.step();
  var evs = evOf(env, r, 'atk', 'gongjian');
  console.log('  弓箭手事件：', fmt(evs) || '(无)');
  var atk = evs.filter(function (e) { return e.kind === 'attack'; })[0];
  console.log('  判定：' + (atk ? ('✅ 有出手（目标=' + (atk.targetId || atk.target) + '）')
    : '❌ 没开火（不该：轻骑 1158 在射程内）'));
})();

console.log('══════ 场景④：目标在射程外 + **推进应停在"能打最近敌人"处**（步长核对）══════');
(function () {
  var env = mkEnv();
  setAdv(env, 'def', 'qingji', 600); setAdv(env, 'def', 'changqiang', 100);
  setAdv(env, 'def', 'daodun', 100); setAdv(env, 'def', 'gongjian', 100);
  env.setCmd('atk', 'gongjian', { s: 'advance', t: 'changqiang' });
  var r = env.step();
  var evs = evOf(env, r, 'atk', 'gongjian');
  console.log('  行动前距：轻骑=' + (D - 600) + '（射程外）· 目标长枪=' + (D - 100));
  console.log('  弓箭手事件：', fmt(evs) || '(无)');
  console.log('  （预期：前进 250 逐步接敌，直到轻骑进射程——步长=min(spd, free)）');
})();

console.log('══════ 场景⑤：目标兵种**灭失**（不受本修复影响 · v89.164 实测最优行为）══════');
(function () {
  var env = mkEnv();
  setAdv(env, 'def', 'qingji', 875); setAdv(env, 'def', 'changqiang', 300);
  setAdv(env, 'def', 'daodun', 275); setAdv(env, 'def', 'gongjian', 0);
  env.units.def.forEach(function (u) { if (u.id === 'changqiang') u.count = 0; });
  env.setCmd('atk', 'gongjian', { s: 'advance', t: 'changqiang' });
  var r = env.step();
  var evs = evOf(env, r, 'atk', 'gongjian');
  console.log('  弓箭手事件：', fmt(evs) || '(无)');
  var atk = evs.filter(function (e) { return e.kind === 'attack'; })[0];
  console.log('  判定：' + (atk ? ('✅ 目标灭失 → 回落打射程内（' + (atk.targetId || '') + '）') : '（未开火·正常）'));
})();

process.exit(0);
