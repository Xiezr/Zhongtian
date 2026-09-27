/* ============================================================
 * gen_tables_index.js —— 数据表索引生成器（v89.134）
 * ------------------------------------------------------------
 * 产物：docs/数据表索引.md（**自动生成 · 勿手改** · 可随时重跑刷新行号）
 * 数据源：audit_v89134_tables.js --json（盘点器 · 卫生判定的唯一出口）
 *         + data.js 的分段标题（按 /* ==== 块的内首行标题提取）
 *
 * 用法：node .workbuddy/tools/gen/gen_tables_index.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var ROOT = path.join(__dirname, '..', '..', '..');

/* ---------- ① 拿盘点结果（require 共享模块 —— 沙箱下 spawn 子进程会 EBUSY） ---------- */
var inv = require(path.join(__dirname, '..', 'audit', 'audit_v89134_tables.js'));
var A = inv.scanAll();

/* ---------- ② 提 data.js 分段标题 ---------- */
var dSrc = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8').replace(/\r\n/g, '\n');
var dLines = dSrc.split('\n');
var sections = [];
for (var i = 0; i < dLines.length; i++) {
  if (!/^\s*\/\* ={10,}/.test(dLines[i])) continue;
  for (var j = i + 1; j < Math.min(i + 8, dLines.length); j++) {
    var m = /^\s*\* (.+)$/.exec(dLines[j]);
    if (m && m[1].slice(0, 6).indexOf('=') < 0) {
      sections.push({ line: i + 1, title: m[1].trim() });
      break;
    }
  }
}

/* ---------- ③ 渲染 ---------- */
var now = new Date();
function pad(n) { return n < 10 ? '0' + n : '' + n; }
var stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
  + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());

var L = [];
L.push('# 数据表索引（自动生成 · 勿手改）');
L.push('');
L.push('> 生成时间：' + stamp + '　·　生成器：`.workbuddy/tools/gen/gen_tables_index.js`（改表后重跑）');
L.push('> 卫生判定：`.workbuddy/tools/audit/audit_v89134_tables.js`（跨文件写/重复定义/孤儿/悬空 · 四查）');
L.push('> 接线断言：`smoke-test.js` §115（死表已删 / 单一来源 / RES_ORDER / INITIAL_EXT / PERK 清单）');
L.push('');
L.push('## 一、改数值的工作流（先看这里）');
L.push('');
L.push('1. **定位**：`js/data.js` 顶部【分区导航】找大类 → 本文件第二节查分段行号；');
L.push('2. **改表**：静态数值唯一写域是 `js/data.js`；任务目录在 `js/questdata.js`（合法分包）；');
L.push('3. **自检**：`node .workbuddy/tools/audit/audit_v89134_tables.js`（四查必须全过）；');
L.push('4. **刷新**：重跑本生成器，刷新本文件的行号。');
L.push('');
L.push('**铁律**（盘点器会抓）：');
L.push('- ⛔ 新增表只能写在 `js/data.js` / `js/questdata.js`；');
L.push('- ⛔ 同一张表不许出现第二个赋值点（构建步骤必须进盘点器白名单并写明理由）；');
L.push('- ⛔ 删表要留墓碑（`⛔ vXX 移除：… —— 去向/理由`），并在测试补"已删"断言；');
L.push('- ⛔ 资源集遍历一律读 `DATA.RES_ORDER`（别再就地写字面量数组）。');
L.push('');
L.push('## 二、分区导航（data.js 全部分段 · 共 ' + sections.length + ' 段）');
L.push('');
L.push('| 行号 | 分段标题 |');
L.push('|---:|---|');
sections.forEach(function (s) {
  L.push('| ' + s.line + ' | ' + s.title.replace(/\|/g, '\\|').slice(0, 96) + ' |');
});
L.push('');

/* 表清单：按名称排序，附位置/结构/引用/消费方 */
var defs = A.defs || {}, refs = A.refs || {};
var names = Object.keys(defs).sort();
L.push('## 三、表清单（' + names.length + ' 张 · 按名称）');
L.push('');
L.push('| 表名 | 位置 | 结构 | 引用数 | 主要消费方 |');
L.push('|---|---|---|---:|---|');
names.forEach(function (n) {
  var d = defs[n][0];
  var extra = defs[n].length > 1 ? ' ×' + defs[n].length : '';
  var r = refs[n] || { total: 0, byFile: {} };
  var consumers = Object.keys(r.byFile).sort(function (a, b) { return r.byFile[b] - r.byFile[a]; })
    .slice(0, 4).map(function (f) { return f.replace('js/', '').replace('.js', ''); }).join(', ');
  L.push('| `' + n + '` | ' + d.file.replace('js/', '') + ':' + d.line + extra + ' | ' + d.kind
    + ' | ' + r.total + ' | ' + (consumers || '—') + ' |');
});
L.push('');

/* 卫生结论 */
L.push('## 四、卫生审计结论（' + stamp + '）');
L.push('');
L.push('- 跨文件写：' + (A.crossWrite.length ? '⛔ ' + A.crossWrite.length + ' 项' : '✅ 无'));
L.push('- 重复定义（白名单外）：' + (A.multiWriteReal.length ? '⛔ ' + A.multiWriteReal.length + ' 项' : '✅ 无'));
L.push('- 孤儿表（白名单外）：' + (A.orphan.length ? '⛔ ' + A.orphan.length + ' 项' : '✅ 无'));
L.push('- 悬空引用（js/ 内）：' + (A.danglingSrc.length ? '⛔ ' + A.danglingSrc.length + ' 项' : '✅ 无'));
L.push('');
L.push('**构建步骤白名单**（同名多次写 = 设计如此 · 见盘点器 `KNOWN_BUILDS`）：');
(A.multiWriteKnown || []).forEach(function (m) {
  L.push('- `' + m.name + '` × ' + m.n + ' @ ' + m.at.map(function (a) { return a.file + ':' + a.line; }).join(', '));
});
L.push('');
L.push('**测试内引用已删名**（墓碑断言/旧名兜底 · 合法测试模式）：');
(A.danglingTest || []).forEach(function (d) { L.push('- `' + d.name + '` × ' + d.total); });
L.push('');

var out = L.join('\n');
var outP = path.join(ROOT, 'docs', '数据表索引.md');
fs.writeFileSync(outP, out, 'utf8');
console.log('OK · ' + outP + '  ' + out.length + ' 字符 · ' + sections.length + ' 段 · ' + names.length + ' 表');
