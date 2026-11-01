/* ui.js 结构分析：为拆分定边界（只读，不改文件）
 *   ① 按现有 `/* ===== 分节 ===== *\/` 把 823 个 ui.xxx 归组，给出每组的行数/函数数
 *   ② 找出"立即执行的顶层语句"（非 ui.xxx 赋值）—— 这些拆错位置会改行为
 *   ③ 找出跨组的直接调用（同一文件内 ui.a 调 ui.b）—— 判断哪些组是叶子
 *
 * 用法：node .workbuddy/tools/prof/analyze_ui.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..', '..');
var file = path.join(ROOT, 'js', 'ui.js');
var lines = fs.readFileSync(file, 'utf8').split('\n');

/* ---- 分节点：以 "倾斜杠 + 六个以上等号" 开头的那类注释 ---- */
var secMarks = [];
for (var i = 0; i < lines.length; i++) {
  if (/^\s*\/\* ={6,}/.test(lines[i])) {
    /* 取注释块里第一句有内容的话当组名 */
    var title = '';
    for (var k = i + 1; k < Math.min(i + 6, lines.length); k++) {
      var t = lines[k].replace(/^\s*\*\s?/, '').trim();
      if (t) { title = t; break; }
    }
    secMarks.push({ line: i, title: title.replace(/^\*+\s*/, '').slice(0, 46) });
  }
}

/* ---- 每个 ui.xxx 定义所在行 ---- */
var defs = [];
for (var j = 0; j < lines.length; j++) {
  var m = /^\s*ui\.([A-Za-z_$][\w$]*)\s*=/.exec(lines[j]);
  if (m) defs.push({ line: j, name: m[1] });
}

/* ---- 把 defs 归到最近的分节 ---- */
function secOf(line) {
  var cur = { line: 0, title: '（文件头 · 未分节）' };
  for (var s = 0; s < secMarks.length; s++) {
    if (secMarks[s].line <= line) cur = secMarks[s]; else break;
  }
  return cur;
}
var groups = {};
defs.forEach(function (d) {
  var s = secOf(d.line);
  var key = s.line + '|' + s.title;
  (groups[key] = groups[key] || { line: s.line, title: s.title, defs: [] }).defs.push(d);
});
var gl = Object.keys(groups).map(function (k) { return groups[k]; })
  .sort(function (a, b) { return a.line - b.line; });

console.log('══ ① 分节归组（共 ' + gl.length + ' 组 / ' + defs.length + ' 个 ui.* 定义）══');
gl.forEach(function (g, idx) {
  var nextLine = idx + 1 < gl.length ? gl[idx + 1].line : lines.length;
  var span = nextLine - g.line;
  console.log('  [' + String(idx).padStart(2) + '] 行' + String(g.line + 1).padStart(6) + '  '
    + String(span).padStart(6) + ' 行  ' + String(g.defs.length).padStart(3) + ' 个  ' + g.title);
});

/* ---- ② 顶层立即执行语句（不是 ui.x = function 的赋值 / 调用） ---- */
console.log('\n══ ② 顶层立即执行语句（拆错位置会改行为）══');
var topStmts = [];
var depth = 0;
for (var q = 0; q < lines.length; q++) {
  var L = lines[q];
  if (/^\s*(import|export)\b/.test(L)) continue;
  if (/^\(function \(\) \{/.test(L)) continue;
  /* 只认缩进 2 空格、且不是 function 赋值的顶层语句 */
  if (!/^  [^ ]/.test(L)) continue;
  if (/^  \/\*/.test(L) || /^  \*/.test(L) || /^  \/\//.test(L)) continue;
  if (/^  ui\.[A-Za-z_$][\w$]*\s*=\s*function/.test(L)) continue;
  if (/^  ui\.[A-Za-z_$][\w$]*\s*=\s*\{/.test(L)) continue;
  if (/^  (var|let|const|function|return|\}|\)|\]|else|if|for|while)\b/.test(L)) continue;
  topStmts.push({ line: q, text: L.trim().slice(0, 88) });
}
console.log('  共 ' + topStmts.length + ' 条：');
topStmts.slice(0, 14).forEach(function (s) {
  console.log('   行' + String(s.line + 1).padStart(6) + '  ' + s.text);
});
if (topStmts.length > 14) console.log('   … 另 ' + (topStmts.length - 14) + ' 条');

/* ---- ③ 跨组调用：每个组调用了多少"别的组"的 ui.xxx ---- */
console.log('\n══ ③ 组间调用依赖（谁调谁）══');
var nameToGroup = {};
gl.forEach(function (g, idx) { g.defs.forEach(function (d) { nameToGroup[d.name] = idx; }); });
var edges = {};
gl.forEach(function (g, gi) {
  var start = g.line, end = gi + 1 < gl.length ? gl[gi + 1].line : lines.length;
  var text = lines.slice(start, end).join('\n');
  var m, re = /\bui\.([A-Za-z_$][\w$]*)/g, out = {};
  while ((m = re.exec(text))) {
    var tgt = nameToGroup[m[1]];
    if (tgt != null && tgt !== gi) out[tgt] = (out[tgt] || 0) + 1;
  }
  edges[gi] = out;
});
gl.forEach(function (g, gi) {
  var ks = Object.keys(edges[gi]);
  if (!ks.length) { console.log('  [' + String(gi).padStart(2) + '] 叶子（不依赖其他组）  ' + g.title); return; }
  console.log('  [' + String(gi).padStart(2) + '] → ' + ks.length + ' 组：'
    + ks.slice(0, 8).map(function (k) { return edges[gi][k] + '×[' + k + ']'; }).join(' '));
});

/* ---- 被依赖最多的组（拆分时要留在底层） ---- */
var inDeg = {};
gl.forEach(function (g, gi) {
  Object.keys(edges[gi]).forEach(function (t) { inDeg[t] = (inDeg[t] || 0) + 1; });
});
var ranked = Object.keys(inDeg).map(function (k) { return { gi: +k, n: inDeg[k] }; })
  .sort(function (a, b) { return b.n - a.n; });
console.log('\n══ ④ 被最多组依赖的（应放在最底层）══');
ranked.slice(0, 6).forEach(function (r) {
  console.log('  ' + String(r.n).padStart(3) + ' 组依赖  [' + r.gi + '] ' + gl[r.gi].title);
});
