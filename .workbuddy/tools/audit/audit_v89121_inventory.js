/* ============================================================
 * audit_v89121_inventory.js — 全量物品清点器（老板令「逐项功能、物品」第一步）
 * ------------------------------------------------------------
 * 产出三样：
 *   ① 物品全域清单（宝物/装备/灵装/材料/计略/神器/资源）逐项
 *   ② 每项的"代码引用计数"（除 data.js 定义外的引用次数）—— 0 引用 = 孤儿嫌疑
 *   ③ 类别统计（有多少项、多少类）
 * 用法：node .workbuddy/tools/audit/audit_v89121_inventory.js [--json]
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

/* ---------- 代码引用扫描 ----------
   ⚠ 口径修正（首版教训）：本项目**数据驱动**——物品 id 大量出现在 data.js 的
   其他表里（爵位 jewel 消耗表 / 掉落表 / 任务奖励表），而非散落在逻辑代码。
   所以"除 data.js 外"的口径会把珍珠这种核心物品误判成孤儿。
   正确口径 = **全部 js 文件**统计，把"定义行本身"减掉（定义行 = id+name+type 同现）。 */
var CODE = {};   // file → 源码
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  CODE[f] = fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8');
});
function refCount(id) {
  /* ⚠ 口径 v2：引号形态会漏掉**对象键形态**（`jewel: { zhenzhu: 3 }` —— 珍珠
     全仓只出现在定义行与这句无引号键里；首版把珍珠误判成孤儿）。改**词边界**扫描。 */
  var n = 0, files = [];
  var esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp('(^|[^A-Za-z0-9_])' + esc + '($|[^A-Za-z0-9_])', 'g');
  Object.keys(CODE).forEach(function (f) {
    var c = (CODE[f].match(re) || []).length;
    if (c > 0) { n += c; files.push(f + '×' + c); }
  });
  if (n > 0) n -= 1;   /* 减掉定义行本身 */
  return { n: n, files: files.join(',') };
}

var OUT = [];
function line(s) { OUT.push(s); console.log(s); }

/* ---------- ① 宝物（DATA.ITEMS） ---------- */
line('═══ ① 宝物 DATA.ITEMS ═══');
var byType = {};
DATA.ITEMS.forEach(function (it) {
  var t = it.type || 'unknown';
  (byType[t] = byType[t] || []).push(it);
});
var totalItems = 0;
Object.keys(byType).sort().forEach(function (t) {
  var arr = byType[t];
  totalItems += arr.length;
  line('  【' + t + '】×' + arr.length);
  arr.forEach(function (it) {
    var rc = refCount(it.id);
    line('    ' + (rc.n === 0 ? '⚠孤儿? ' : '        ') + pad(it.id, 18) + pad(it.name, 12)
      + ' shop=' + (it.noShop ? '下架' : (it.price || 0)) + '  引用' + rc.n + (rc.files ? ' (' + rc.files + ')' : ''));
  });
});
line('  —— 宝物合计 ' + totalItems + ' 项 / ' + Object.keys(byType).length + ' 类');

/* ---------- ② 装备（DATA.EQUIP，含灵装） ---------- */
line('\n═══ ② 装备 DATA.EQUIP ═══');
var eqAll = Object.keys(DATA.EQUIP);
var mil = [], ling = [], free = [], setItems = {};
eqAll.forEach(function (id) {
  var e = DATA.EQUIP[id];
  if (e.ling) ling.push(e);
  else if (e.craft) mil.push(e);
  else if (e.set) (setItems[e.set] = setItems[e.set] || []).push(e);
  else free.push(e);
});
line('  军装·套装件：' + Object.keys(setItems).map(function (s) { return s + '×' + setItems[s].length; }).join(' · '));
line('  军装·散件（craft 生成）：×' + mil.length + '（12 槽 × 4 品）');
line('  灵装（ling 生成）：×' + ling.length + '（12 槽 × 6 阶）');
line('  特殊（新手装等）：×' + free.length + ' → ' + free.map(function (e) { return e.id; }).join(' '));
/* 散件与灵装的 id 是拼出来的，引用扫前缀 */
['cr_', 'lg_'].forEach(function (pre) {
  var n = 0;
  Object.keys(CODE).forEach(function (f) { n += (CODE[f].split("'" + pre).length - 1) + (CODE[f].split('"' + pre).length - 1); });
  line('  前缀引用 "' + pre + '"：' + n + ' 次（散件/灵装按前缀寻址）');
});
line('  —— 装备合计 ' + eqAll.length + ' 项');

/* ---------- ③ 材料 ---------- */
line('\n═══ ③ 材料 DATA.MATERIALS ═══');
var matBad = [];
DATA.MATERIALS.forEach(function (m) {
  var rc = refCount(m.id);
  if (rc.n === 0) matBad.push(m.id);
});
line('  合计 ' + DATA.MATERIALS.length + ' 项（6 系 × 4 品）· 零引用 ' + matBad.length
  + (matBad.length ? '：' + matBad.join(' ') : ' ✓'));

/* ---------- ④ 计略 / 神器 / 资源 ---------- */
line('\n═══ ④ 计略 · 神器 · 资源 ═══');
line('  计略 DATA.SCHEMES ×' + DATA.SCHEMES.length + '：' + DATA.SCHEMES.map(function (s) { return s.name; }).join(' '));
line('  神器 DATA.ARTIFACTS ×' + DATA.ARTIFACTS.length + '：' + DATA.ARTIFACTS.map(function (a) { return a.name; }).join(' '));
line('  资源 DATA.RESOURCES ×' + DATA.RESOURCES.length + '：' + DATA.RESOURCES.map(function (r) { return r.name; }).join(' '));

/* ---------- ⑤ 孤儿汇总 ---------- */
line('\n═══ ⑤ 零引用（孤儿嫌疑）汇总 ═══');
var orphans = [];
DATA.ITEMS.forEach(function (it) { if (refCount(it.id).n === 0) orphans.push('宝物:' + it.id); });
line(orphans.length ? '  ' + orphans.join('\n  ') : '  无（全部物品在非 data.js 代码中有引用）');

/* JSON 版（给模拟器/报告用） */
if (process.argv.indexOf('--json') >= 0) {
  var j = { items: DATA.ITEMS.map(function (it) { return { id: it.id, name: it.name, type: it.type, refs: refCount(it.id).n }; }),
    equip: eqAll.length, materials: DATA.MATERIALS.length, schemes: DATA.SCHEMES.length,
    artifacts: DATA.ARTIFACTS.length, orphans: orphans };
  fs.writeFileSync(path.join(R, '.workbuddy/tmp/inventory_v89121.json'), JSON.stringify(j, null, 1));
  console.log('\n  JSON → .workbuddy/tmp/inventory_v89121.json');
}
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
console.log('\n清点完毕：宝物 ' + totalItems + ' · 装备 ' + eqAll.length + ' · 材料 ' + DATA.MATERIALS.length
  + ' · 计略 ' + DATA.SCHEMES.length + ' · 神器 ' + DATA.ARTIFACTS.length);
process.exit(0);
