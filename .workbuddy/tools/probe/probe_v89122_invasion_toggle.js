/* ============================================================
 * probe_v89122_invasion_toggle.js — 「外敌来犯」开关失效复现（老板报）
 * ------------------------------------------------------------
 * 真调 GAME.doToggleInvasionAccept 两次，逐次打印：
 *   settings.invasion / invasionAcceptOn() / 下一次来犯排期（invasionDueAt）
 * 预期（bug）：点完 acceptOn 仍为 true（状态不翻转），而 toast 却报"已拒战"。
 * 用法：node .workbuddy/tools/probe/probe_v89122_invasion_toggle.js
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
var G = global.GAME, DATA = G.DATA;

var st = G.newGame({ name: '探', cityName: '许都', region: '碎垣', mapSeed: 20260926 });
G.state = st;
if (!st.map.grid) G.map.generate();
/* 两座城（来犯需要城池数 ≥ unlockCities） */
st.cities.push(G.makeCity({ id: 'c2', name: '二城', x: 265, y: 215 }));
G.ui._cityId = st.cities[0].id;

function snap(tag) {
  var soon = 0;
  st.cities.forEach(function (c) {
    var d = G.invasionDueAt(c);
    if (d && (!soon || d < soon)) soon = d;
  });
  console.log(pad(tag, 14)
    + 'settings.invasion=' + String(st.settings.invasion)
    + '  acceptOn=' + G.invasionAcceptOn()
    + '  下一场排期=' + (soon ? Math.round((soon - G.realNow()) / 1000) + 's 后' : '无'));
}
function pad(s, n) { while (s.length < n) s += ' '; return s; }

console.log('== 「外敌来犯」开关：真调两次 ==');
snap('初始');
G.doToggleInvasionAccept();
snap('点第 1 次');
G.doToggleInvasionAccept();
snap('点第 2 次');
console.log('');
var okToggle = true;
/* 复现断言（放进探针，同时给 smoke 挪一份） */
var a0 = G.invasionAcceptOn();
G.doToggleInvasionAccept();
var a1 = G.invasionAcceptOn();
if (!(a0 === true && a1 === false)) { okToggle = false; console.log('✗ 第 1 次点击后 acceptOn 应为 false，实为 ' + a1 + '（状态没翻转）'); }
G.doToggleInvasionAccept();
var a2 = G.invasionAcceptOn();
if (!(a2 === true)) { okToggle = false; console.log('✗ 第 2 次点击后 acceptOn 应翻回 true，实为 ' + a2); }
console.log(okToggle ? '✓ 开关翻转正常' : '✗ 开关翻转不正常（bingo：这就是"看起来没起作用"）');
process.exit(0);
