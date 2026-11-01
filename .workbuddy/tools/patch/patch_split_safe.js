/* 修 split_ui.js 的切点判定：**用试编译证明切点在顶层**，不再靠缩进猜。
 *
 * 事故（2026-11-01 首次拆分）：
 *   吸附规则是「往前找最近的 `斜杠星号 + 等号` 行」，但函数体内部也有同风格注释块，
 *   于是切点落进了 `ui.cityHTML` / `ui.openModal` 等函数**内部** →
 *   前一截被硬切、函数体不完整。
 *   更阴险的是 `node --check` **照样通过**：文件末尾的 `})();` 恰好把半截函数体"借"闭合了。
 *   真正抓住它的是函数快照比对（4 个函数 sha1 不符）。
 *
 * 正确判据：`lines[0..idx] + '})();'` 能编译 = 切点处括号深度为 0（在顶层）。
 */
'use strict';
var fs = require('fs');
var p = '.workbuddy/tools/patch/split_ui.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('safeCut') >= 0) { console.log('SKIP: 已修'); process.exit(0); }

var old = `/* ---- 吸附：往前找最近的分节标题，保证不切断函数体 ---- */
function snapToSection(lineNo) {
  var i = lineNo - 1;
  for (; i >= 0; i--) {
    if (/^\\s*\\/\\* ={6,}/.test(lines[i])) return i;
  }
  return lineNo - 1;
}`;

var neu = `/* ============================================================
 * 切点判定：**试编译证明它在顶层**
 * ------------------------------------------------------------
 * ⛔ 不要用"缩进 2 空格 + 分节注释"当判据 —— 函数体内部也有同风格注释块，
 *    第一次拆分就是这样把 ui.cityHTML / ui.openModal 切成了半截。
 *    更阴险的是 node --check 照样通过：文件末尾的 \`})();\` 会把半截函数体"借"闭合。
 * 判据：把「文件开头到切点」+ 一个收尾 \`})();\` 拼起来，能编译 = 括号在切点处是平的。
 * ============================================================ */
function safeCut(idx) {
  if (idx <= 0) return false;
  var code = lines.slice(0, idx).join('\\n') + '\\n})();\\n';
  try { new Function(code); return true; } catch (e) { return false; }
}

/* 优先吸附到最近的「顶层分节标题」；找不到就退到最近的任意安全切点 */
function snapToSection(lineNo) {
  var start = lineNo - 1;
  for (var i = start; i >= 0 && i > start - 600; i--) {
    if (/^  \\/\\* ={6,}/.test(lines[i]) && safeCut(i)) return i;
  }
  for (var j = start; j >= 0; j--) if (safeCut(j)) return j;
  return start;
}`;

if (s.indexOf(old) < 0) { console.error('ANCHOR snapToSection NOT FOUND'); process.exit(1); }
s = s.replace(old, neu);

/* 额外自检：每个切点都必须是安全切点，否则直接拒绝执行 */
var oldCheck = `var cuts = PLAN.map(function (p, i) {`;
var newCheck = `PLAN.forEach(function (p) {
  var idx = snapToSection(p.at);
  if (!safeCut(idx)) {
    console.error('✗ 找不到安全切点：' + p.name + '（目标行 ' + p.at + '）');
    process.exit(1);
  }
});

var cuts = PLAN.map(function (p, i) {`;
if (s.indexOf(oldCheck) < 0) { console.error('ANCHOR cuts NOT FOUND'); process.exit(1); }
s = s.replace(oldCheck, newCheck);

fs.writeFileSync(p, s, 'utf8');
console.log('split_ui.js: 切点改用试编译判定');
