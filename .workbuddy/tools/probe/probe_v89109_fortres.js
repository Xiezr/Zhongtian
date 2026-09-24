/* ============================================================
 * probe_v89109_fortres.js — 需求 5 取证：10 级野外城池资源为什么这么少？
 * 量三组对照（各采样 400 次取均值）：
 *   ① 据点 fort Lv1/3/5/8/10 的掠夺量（genLoot）与其守军
 *   ② 野地 wild Lv1/5/10 的掠夺量（genLoot —— 顺便验证"野地是不是不吃等级"）
 *   ③ 四种名城档位的库藏与掠夺量（npcLoot）
 * 用法：node .workbuddy/tools/probe/probe_v89109_fortres.js
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
var st = G.newGame({ name: '量', cityName: '许都', mapSeed: 20260923 });
if (!st.map.grid) G.map.generate();

function lootSamples(t, extMul, n) {
  var sum = { grain: 0, wood: 0, stone: 0, iron: 0, gold: 0 }, cnt = 0;
  for (var i = 0; i < n; i++) {
    var o = G.battle.genLoot(t, extMul);
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { sum[k] += o[k] || 0; });
    cnt++;
  }
  var tot = 0;
  ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { sum[k] = Math.round(sum[k] / cnt); tot += sum[k]; });
  return { per: sum, total: tot };
}
var cm = DATA.EXPEDITION.cityResMul, wm = DATA.EXPEDITION.wildResMul;
function wan(x) { return (x / 1e4).toFixed(1) + '万'; }

console.log('=== ① 据点 fort：掠夺量（genLoot × cityResMul.raid=' + cm.raid + '）与守军 ===');
[1, 3, 5, 8, 10].forEach(function (lv) {
  var t = { kind: 'fort', lv: lv, dropType: 'fort', name: '测' + lv };
  var r = lootSamples(t, cm.raid, 400);
  var gs = G.map.fortGarrison(lv), gsum = 0; for (var k in gs) gsum += gs[k];
  console.log('  Lv' + lv + '  守军 ' + wan(gsum).padStart(8) + ' · 掠夺合计 ' + wan(r.total).padStart(8)
    + '  （粮 ' + wan(r.per.grain) + ' 金 ' + wan(r.per.gold) + '）');
});

console.log('=== ② 野地 wild：掠夺量（genLoot × wildResMul.raid=' + wm.raid + '）—— 验"吃不吃等级" ===');
[1, 5, 10].forEach(function (lv) {
  var t = { kind: 'wild', lv: lv, name: '野' + lv };     /* 无 type/dropType → tier 落 county */
  var r = lootSamples(t, wm.raid, 400);
  console.log('  Lv' + lv + '  掠夺合计 ' + wan(r.total).padStart(8));
});

console.log('=== ③ 名城：库藏 / 掠夺 / 守军（npcLoot × cityResMul.raid）===');
['county', 'jun', 'zhou', 'capital'].forEach(function (ty) {
  var c = (st.map.cities || []).filter(function (x) { return x.type === ty; })[0];
  if (!c) { console.log('  ' + ty + ' 无样本'); return; }
  var res = G.npcCityRes(c), tot = 0; for (var k in res) { if (k !== 'pop') tot += res[k]; }
  var lo = G.npcLoot(c, 'raid'), lt = 0; for (var k2 in lo) lt += lo[k2];
  console.log('  ' + ty.padEnd(8) + ' Lv' + G.cityLvOf(c) + ' 库藏 ' + wan(tot).padStart(9)
    + ' · 掠夺 ' + wan(lt).padStart(9) + ' · 守军 ' + wan(DATA.NPC_CITY_RES.garrisonByTier[ty] || 0));
});

console.log('\n=== ④ 量纲核对：守军 : 掠夺（同场战斗的"投入比"）===');
[1, 5, 10].forEach(function (lv) {
  var gs = G.map.fortGarrison(lv), gsum = 0; for (var k in gs) gsum += gs[k];
  var t = { kind: 'fort', lv: lv, dropType: 'fort' };
  var r = lootSamples(t, cm.raid, 400);
  console.log('  据点 Lv' + lv + '：守军 ' + wan(gsum) + ' / 掠夺 ' + wan(r.total) + ' → 掠夺/守军 = ' + (r.total / gsum).toFixed(2));
});
var cc = (st.map.cities || []).filter(function (x) { return x.type === 'county'; })[0];
if (cc) {
  var lo2 = G.npcLoot(cc, 'raid'), lt2 = 0; for (var k3 in lo2) lt2 += lo2[k3];
  var g2 = DATA.NPC_CITY_RES.garrisonByTier.county;
  console.log('  县城（对照）：守军 ' + wan(g2) + ' / 掠夺 ' + wan(lt2) + ' → 掠夺/守军 = ' + (lt2 / g2).toFixed(2));
}

/* ⛔ 必须显式退出：项目 js 的主循环定时器会把 Node 事件循环吊住，
   进程不退出 → 前台会被沙箱当"卡死" SIGTERM 掉（本轮踩过，白查半天）。 */
process.exit(0);
