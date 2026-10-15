/* ============================================================
 * probe_v89107_100cities.js — 100 座城会不会崩？（先量，再谈架构）
 * ------------------------------------------------------------
 * 老板问：「假如有一百座玩家城池会不会崩溃，采用界面显示加后台数据分发的思路？
 *           这样不用存储每个城池的冗余信息？你思考思考，别偷懒」
 * 量四样（1 / 10 / 50 / 100 城各量一遍）：
 *   ① 存档体积（savePayload 的 JSON 字符数）
 *   ② 每 tick 开销（tickOnce 平均 ms —— 主循环每秒跑一次）
 *   ③ 来袭检查（invasionTick 一次 ms —— 它逐城循环）
 *   ④ 每城**真正存了什么**（字段清点：哪些是决策数据、哪些是可由它推导的）
 * 用法：node .workbuddy/tools/probe/probe_v89107_100cities.js
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
G.DATA.DEFAULT_SETTINGS.battleWatch = false;

function build(n) {
  var st = G.newGame({ name: '压力测试', cityName: '许都', region: '豫州', mapSeed: 20260923 });
  if (!st.map.grid) G.map.generate();
  var c0 = st.cities[0];
  G.ui._cityId = c0.id;
  ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { c0.res[k] = 9e6; });
  c0.army = { changqiang: 6000, gongjian: 3000, qingji: 1200 };
  /* 用**真出口**建城：先占野地（平原）再 buildCityAt */
  var made = 1, tries = 0;
  while (made < n && tries < 4000) {
    tries++;
    var dx = (tries % 21) - 10, dy = Math.floor(tries / 21) - 10;
    var x = c0.x + dx * 4, y = c0.y + dy * 4;
    var t = G.map.tile(x, y);
    if (!t || t.terrain !== 'plain') continue;
    if ((st.cities || []).some(function (c) { return c.x === x && c.y === y; })) continue;
    if (!st.wilds.some(function (w) { return w.x === x && w.y === y; })) {
      st.wilds.push({ x: x, y: y, type: 'plain', lv: 3 });
    }
    var r = G.buildCityAt(x, y);
    if (r && r.ok !== false) made++;
  }
  return st;
}

function timeIt(fn, times) {
  var t0 = process.hrtime.bigint();
  for (var i = 0; i < times; i++) fn(i);
  var t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6 / times;
}

console.log('城数   存档KB   每tick ms   invasionTick ms   每城平均字节');
var rows = [];
[1, 10, 50, 100].forEach(function (n) {
  var st = build(n);
  var cities = st.cities.length;
  var save = JSON.stringify(G.savePayload ? G.savePayload() : st);
  var tickMs = timeIt(function () { G.tickOnce(); }, 120);
  var invMs = timeIt(function (i) { G.invasionTick(1); }, 40);
  var per = Math.round(save.length / Math.max(1, cities));
  rows.push({ n: cities, kb: save.length / 1024, tick: tickMs, inv: invMs, per: per });
  console.log('%s   %s   %s   %s   %s',
    String(cities).padStart(4), (save.length / 1024).toFixed(0).padStart(6),
    tickMs.toFixed(2).padStart(7), invMs.toFixed(2).padStart(12), String(per).padStart(13));
});
/* ---- 拆解：10ms 花在哪 ---- */
console.log('\n—— tickOnce 逐段耗时（100 城）——');
var st100 = build(100);
if (st100.cities.length >= 100) {
  var seg = {};
  function T(name, fn, n) {
    var t0 = process.hrtime.bigint();
    for (var i = 0; i < n; i++) fn();
    seg[name] = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  }
  T('① 全城产量结算', function () {
    G.state.cities.forEach(function (ct) {
      var p = G.cityProdPerSec(ct), cap = G.storeCapOf(ct), R = G.res(ct);
      for (var k in p) { if (k === 'pop') continue; R[k] = (R[k] || 0) + p[k];
        if (k !== 'gold' && cap > 0 && R[k] > cap) R[k] = cap; }
    });
  }, 60);
  T('② invasionTick', function () { G.invasionTick(1); }, 60);
  T('③ cityProdPerSec ×100', function () {
    G.state.cities.forEach(function (ct) { G.cityProdPerSec(ct); });
  }, 60);
  T('④ storeCapOf ×100', function () {
    G.state.cities.forEach(function (ct) { G.storeCapOf(ct); });
  }, 60);
  T('⑤ tickOnce 全量', function () { G.tickOnce(); }, 60);
  Object.keys(seg).forEach(function (k) {
    console.log('  ' + k.padEnd(22) + seg[k].toFixed(3) + ' ms');
  });
}

console.log('\n—— 每城字段清点（单城实存）——');
var st1 = build(1);
var c = st1.cities[0];
var fields = [];
Object.keys(c).forEach(function (k) {
  var v = c[k];
  var size = JSON.stringify(v == null ? null : v).length;
  var kind = '';
  if (k === 'cells') kind = '决策（8~48 格建筑/等级）';
  else if (k === 'army') kind = '决策（驻军）';
  else if (k === 'res') kind = '决策（余量）';
  else if (k === 'inv') kind = '派生（可换算自 nextAt）';
  else if (k === 'ext') kind = '决策（城外格）';
  else if (/x|y|id|name|region|col|row|tier|official/.test(k)) kind = '静态（可由建城参数复原）';
  else kind = '?';
  fields.push({ k: k, size: size, kind: kind });
});
fields.sort(function (a, b) { return b.size - a.size; });
fields.forEach(function (f) {
  console.log('  ' + f.k.padEnd(14) + String(f.size).padStart(7) + ' B   ' + f.kind);
});
console.log('  合计 ' + JSON.stringify(c).length + ' B');
process.exit(0);
