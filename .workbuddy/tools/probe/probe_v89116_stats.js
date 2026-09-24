/* ============================================================
 * v89.116 探针①：兵种数值梳理（老板「兵种数值是否有误，梳理」）
 * ------------------------------------------------------------
 * 只取证、不改数。四张表：
 *   ① desc 文案 vs 实际数值（措辞里出现的数字/射程/攻防是否与字段一致）
 *   ② 每人口口径：atk/pop、ehp/pop（ehp = hp × 1/(1-减伤近似) 用 hp×def 权重简化）
 *      —— 按 data.js 自述的"单调不降"原则逐档核对，标出缺口
 *   ③ 相克表（COUNTER_ATK / COUNTER_DEF）覆盖：骑/弓/器械族是否都有因子
 *   ④ load 口径与 desc 是否一致 + 兵种定位（nocombat / craft）清点
 * 跑法：node .workbuddy/tools/probe/probe_v89116_stats.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'domain', 'map', 'battle', 'tactic'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils;
G.newGame({ name: '探', cityName: '许都' });     /* tactic 需要 state 就绪 */

var T = DATA.TROOPS;
var ids = Object.keys(T);
console.log('兵种共 ' + ids.length + ' 个\n');

/* ---------- ① desc 里出现的数字是否与字段一致 ---------- */
console.log('===== ① desc 文案 vs 实际数值（只报可疑） =====');
var CN = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
ids.forEach(function (id) {
  var t = T[id], d = t.desc || '', bad = [];
  /* 抓 "攻N" / "防N" / "射程N" / "负重N" / "攻N防M" 这类描述 */
  var m = d.match(/攻\s*(\d+)/); if (m && Number(m[1]) !== t.atk) bad.push('desc 攻' + m[1] + ' ≠ 实际 ' + t.atk);
  m = d.match(/防\s*(\d+)/); if (m && Number(m[1]) !== t.def) bad.push('desc 防' + m[1] + ' ≠ 实际 ' + t.def);
  m = d.match(/射程\s*(\d+)/); if (m && Number(m[1]) !== t.range) bad.push('desc 射程' + m[1] + ' ≠ 实际 ' + t.range);
  m = d.match(/负重\s*(\d+)/); if (m && Number(m[1]) !== t.load) bad.push('desc 负重' + m[1] + ' ≠ 实际 ' + t.load);
  if (bad.length) console.log('  ✗ ' + t.name + '（' + id + '）: ' + bad.join('；') + '\n      desc = ' + d);
});

/* ---------- ② 每人口口径 ---------- */
console.log('\n===== ② 每人口攻击 / 每人口有效生命（按 pop 分组，看单调性） =====');
function ehp(t) { return t.hp * (1 + t.def / 300); }        /* 简化：def 越高越耐打 */
var byPop = {};
ids.forEach(function (id) {
  var t = T[id];
  if (t.nocombat) return;
  (byPop[t.pop] = byPop[t.pop] || []).push({
    id: id, name: t.name, atkPop: t.atk / t.pop, ehpPop: ehp(t) / t.pop,
    atk: t.atk, hp: t.hp, def: t.def, range: t.range,
  });
});
Object.keys(byPop).sort(function (a, b) { return a - b; }).forEach(function (p) {
  var arr = byPop[p].sort(function (a, b) { return b.atkPop - a.atkPop; });
  console.log('  pop=' + p + '：');
  arr.forEach(function (x) {
    console.log('    ' + x.name.padEnd(6, '　') + ' atk/pop ' + x.atkPop.toFixed(1).padStart(7)
      + '   ehp/pop ' + x.ehpPop.toFixed(0).padStart(7)
      + '  (atk ' + x.atk + ' hp ' + x.hp + ' def ' + x.def + ' 射距 ' + x.range + ')');
  });
});

/* ---------- ③ 相克覆盖 ---------- */
console.log('\n===== ③ 相克表覆盖 =====');
var cav = ids.filter(function (id) { return T[id].cat === 'cav' || /骑|象/.test(T[id].name); });
var ranged = ids.filter(function (id) { return T[id].range >= 500 && !T[id].nocombat; });
var craft = ids.filter(function (id) { return T[id].craft; });
console.log('  骑兵族（' + cav.length + '）：' + cav.map(function (i) { return T[i].name; }).join('、'));
console.log('  远程族（' + ranged.length + '）：' + ranged.map(function (i) { return T[i].name; }).join('、'));
console.log('  器械族（' + craft.length + '）：' + craft.map(function (i) { return T[i].name; }).join('、'));
console.log('  COUNTER_ATK 覆盖兵种：' + Object.keys(DATA.COUNTER_ATK).map(function (k) { return T[k] ? T[k].name : k; }).join('、'));
Object.keys(DATA.COUNTER_ATK).forEach(function (k) {
  console.log('    ' + (T[k] ? T[k].name : k) + ' 打 → ' + Object.keys(DATA.COUNTER_ATK[k]).map(function (x) {
    return (T[x] ? T[x].name : x) + '×' + DATA.COUNTER_ATK[k][x];
  }).join('、'));
});
console.log('  COUNTER_DEF 覆盖兵种：' + Object.keys(DATA.COUNTER_DEF).map(function (k) { return T[k] ? T[k].name : k; }).join('、'));
Object.keys(DATA.COUNTER_DEF).forEach(function (k) {
  console.log('    ' + (T[k] ? T[k].name : k) + ' 挨打 → ' + Object.keys(DATA.COUNTER_DEF[k]).map(function (x) {
    return (T[x] ? T[x].name : x) + '×' + DATA.COUNTER_DEF[k][x];
  }).join('、'));
});
/* 缺口：骑兵族里没有"被枪克"的、远程族里没有"盾挡/骑防"的 */
var missAtk = cav.filter(function (id) { return !(DATA.COUNTER_ATK.changqiang || {})[id] && !T[id].nocombat; });
if (missAtk.length) console.log('  ⚠ 骑兵族里未被长枪克制的：' + missAtk.map(function (i) { return T[i].name; }).join('、'));
var missDef = ranged.filter(function (id) { return !(DATA.COUNTER_DEF.daodun || {})[id]; });
if (missDef.length) console.log('  ⚠ 远程族里未被刀盾防的：' + missDef.map(function (i) { return T[i].name; }).join('、'));

/* ---------- ④ load 与定位 ---------- */
console.log('\n===== ④ 负重与定位 =====');
ids.forEach(function (id) {
  var t = T[id];
  var flags = [];
  if (t.nocombat) flags.push('不参战');
  if (t.craft) flags.push('器械(作坊造)');
  console.log('  ' + t.name.padEnd(6, '　') + ' load ' + String(t.load).padStart(6)
    + '  atk/hp ' + String(t.atk).padStart(4) + '/' + String(t.hp).padStart(6)
    + '  pop ' + t.pop + '  spd ' + String(t.spd).padStart(4)
    + (flags.length ? '  [' + flags.join('·') + ']' : '')
    + (t.cat ? '  cat=' + t.cat : '  cat=(无)'));
});
var noLoad = ids.filter(function (id) { return T[id].load == null; });
console.log(noLoad.length ? '  ⚠ 缺 load 字段：' + noLoad.join('、') : '  ✓ 全部有 load');

/* ---------- ⑤ 一场对拼实测（量"每人口强弱"是否与表一致） ---------- */
console.log('\n===== ⑤ 1:1 同人口对拼实测（30 回合上限，看谁赢/剩多少） =====');
var sim = G.tactic.simulate;
var pairs = [
  ['yibing', 'changqiang'], ['changqiang', 'daodun'], ['daodun', 'gongjian'],
  ['gongjian', 'qingji'], ['qingji', 'tieji'], ['changqiang', 'qingji'],
  ['gongjian', 'tieji'], ['qibingcheck', ''],
];
pairs.forEach(function (p) {
  if (!T[p[0]] || !T[p[1]]) return;
  var n = 600;                                   /* 双方各 600 人口 */
  var a = {}; a[p[0]] = Math.floor(n / T[p[0]].pop);
  var d = {}; d[p[1]] = Math.floor(n / T[p[1]].pop);
  var r = sim(a, null, d, 0, null, { kind: 'wild' });
  console.log('  ' + T[p[0]].name + ' vs ' + T[p[1]].name + '（各 ' + n + ' 人口）: '
    + r.rounds + ' 回合　我损 ' + U.fmt(r.atkLoss) + ' / 敌损 ' + U.fmt(r.defLoss)
    + '　胜方 ' + r.winner);
});

process.exit(0);
