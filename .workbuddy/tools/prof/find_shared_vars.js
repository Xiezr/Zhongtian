/* 找出「跨功能的顶层局部变量」—— 拆分后它们会变成未定义。
 *
 * 背景：拆分前 ui.js 是一个 IIFE，16 个顶层 `var XXX = …` 全文件可见；
 *   拆成 19 个 IIFE 之后，每个文件只看得到自己声明的。
 *   第一次拆分只处理了 GAME/DATA/U/$/$$，漏了这 16 个 →
 *   e2e 直接报 `BAG_LEGACY_TAB is not defined`。
 *
 * 输出：每个变量的「定义行 → 所属段」与「引用行 → 所属段」，标出跨段的。
 * 用法：node .workbuddy/tools/prof/find_shared_vars.js [--file .workbuddy/backup/ui.js.bak]
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..', '..');

var argv = process.argv.slice(2);
var i = argv.indexOf('--file');
var SRC = i >= 0 ? path.resolve(ROOT, argv[i + 1]) : path.join(ROOT, 'js', 'ui.js');

var lines = fs.readFileSync(SRC, 'utf8').split('\n');

/* 段边界：用 split_ui.js 的 PLAN（保证口径一致） */
var PLAN = [
  ['ui-fx', 20], ['ui-core', 258], ['ui-modal', 453], ['ui-shell', 1257], ['ui-battle', 1746],
  ['ui-city', 3942], ['ui-army', 4408], ['ui-bag', 4775], ['ui-craft', 5504], ['ui-view', 7904],
  ['ui-build', 9406], ['ui-planet', 11236], ['ui-space', 13555], ['ui-delve', 14791],
  ['ui-mapui', 15379], ['ui-exped', 16258], ['ui-report', 18363], ['ui-config', 19885]
];
function segOf(lineNo) {
  var cur = '（初始化区）';
  for (var k = 0; k < PLAN.length; k++) if (PLAN[k][1] <= lineNo) cur = PLAN[k][0];
  return cur;
}

/* 顶层声明（缩进 2，排除 ui / GAME / DATA 这类已处理的） */
var decls = [];
for (var j = 0; j < lines.length; j++) {
  var m = /^  (var|let|const|function)\s+([A-Za-z_$][\w$]*)/.exec(lines[j]);
  if (!m) continue;
  var name = m[2];
  if (name === 'ui' || name === 'GAME' || name === 'DATA' || name === 'U' || name === '$' || name === '$$') continue;
  decls.push({ name: name, line: j + 1, kind: m[1] });
}

/* 每个名字的全部引用行（词边界） */
function refLines(name) {
  var re = new RegExp('(^|[^.\\w$])' + name.replace(/\$/g, '\\$') + '\\b');
  var out = [];
  for (var k = 0; k < lines.length; k++) {
    if (re.test(lines[k])) out.push(k + 1);
  }
  return out;
}

console.log('══ 顶层局部变量：定义段 vs 引用段 ══\n');
var cross = [];
decls.forEach(function (d) {
  var refs = refLines(d.name);
  var defSeg = segOf(d.line);
  var segs = {};
  refs.forEach(function (r) { segs[segOf(r)] = (segs[segOf(r)] || 0) + 1; });
  var segNames = Object.keys(segs);
  var isCross = segNames.some(function (s) { return s !== defSeg; });
  console.log((isCross ? '⚠️ ' : '   ') + d.kind + ' ' + d.name
    + '  定义@' + d.line + ' [' + defSeg + ']  引用 ' + refs.length + ' 行');
  console.log('      段分布：' + segNames.map(function (s) { return s + '×' + segs[s]; }).join('  '));
  if (isCross) cross.push(d.name);
});

console.log('\n══ 跨段（拆分后必须处理）══');
console.log('  ' + cross.length + ' 个：' + cross.join(', '));
