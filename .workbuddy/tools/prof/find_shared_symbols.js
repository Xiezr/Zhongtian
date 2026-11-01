'use strict';
/* ============================================================
 * find_shared_symbols.js —— 找出"跨段共享的顶层符号"
 * ------------------------------------------------------------
 * 为什么需要它：smoke 能分片跑（实测 4 份并行 458s → 205s），但一崩就崩在
 *   `ReferenceError: DC is not defined` / `withoutEncounter is not defined` ——
 * 这些符号**定义在某个段里**，被别的段用。切走定义它的段，用它的段就断。
 *
 * 只要把这些符号挪进"公共头"（每份都带），分片就能全绿。
 * 这个工具负责把清单列出来：谁、定义在哪段、被哪些段用。
 *
 * 用法：node .workbuddy/tools/prof/find_shared_symbols.js [--top 30]
 * ============================================================ */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..', '..');
var SRC = path.join(ROOT, 'smoke-test.js');
var TOP = 30;
var args = process.argv.slice(2);
for (var i = 0; i < args.length; i++) if (args[i] === '--top') TOP = Number(args[i + 1]) || 30;

var lines = fs.readFileSync(SRC, 'utf8').split('\n');

/* 段边界：`===== N. 标题 =====` */
var segs = [];
for (var n = 0; n < lines.length; n++) {
  if (/=====\s*\d+\.\s/.test(lines[n])) segs.push({ no: n, line: n });
}
segs.forEach(function (s, i) { s.end = (i + 1 < segs.length) ? segs[i + 1].line : lines.length; });
var PRELUDE_END = segs.length ? segs[0].line : 0;

/* 顶层声明：IIFE 内缩进恰好 2 空格的 var/let/const/function */
var declRe = /^  (?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=|^  function\s+([A-Za-z_$][\w$]*)\s*\(/;
var defs = {};   /* name -> {seg, line} */
for (var k = 0; k < lines.length; k++) {
  var m = declRe.exec(lines[k]);
  if (!m) continue;
  var name = m[1] || m[2];
  if (!name || name === 'undefined') continue;
  /* ⚠️ 排除 ≤2 字符的名（n / ok / c / i …）：它们本来就是循环临时量，
     用 \b 在整个仓库里搜必然命中上百段 —— 第一版就是这样刷出 211 个'共享符号'的假清单。 */
  if (name.length <= 2) continue;
  if (!defs[name]) defs[name] = { seg: segIndexAt(k), line: k + 1 };
}
function segIndexAt(lineNo) {
  for (var i = 0; i < segs.length; i++) if (lineNo >= segs[i].line && lineNo < segs[i].end) return i;
  return -1;   /* prelude */
}

/* 统计每个"段内定义的符号"被多少**别的**段引用 */
var users = {};   /* name -> Set(segIndex) */
Object.keys(defs).forEach(function (name) {
  var re = new RegExp('\\b' + name.replace(/\$/g, '\\$') + '\\b');
  var set = {};
  segs.forEach(function (s, i) {
    if (i === defs[name].seg) return;
    for (var j = s.line; j < s.end; j++) {
      if (re.test(lines[j])) { set[i] = 1; break; }
    }
  });
  users[name] = Object.keys(set).map(Number);
});

var rows = Object.keys(defs).map(function (name) {
  var d = defs[name];
  return {
    name: name,
    defSeg: d.seg < 0 ? 'prelude' : ('段 #' + (d.seg + 1)),
    line: d.line,
    users: users[name]
  };
}).filter(function (r) { return r.defSeg !== 'prelude' && r.users.length > 0; })
  .sort(function (a, b) { return b.users.length - a.users.length; });

console.log('smoke 分段 ' + segs.length + ' 个 · 段内顶层声明 ' + Object.keys(defs).length + ' 个');
console.log('其中**被别的段引用**的 ' + rows.length + ' 个 —— 这些必须挪进公共头，否则分片必崩\n');
console.log('  影响段数  符号                    定义位置');
rows.slice(0, TOP).forEach(function (r) {
  console.log('  ' + String(r.users.length).padStart(7) + '  ' + r.name.padEnd(22)
    + ' smoke-test.js:' + r.line + '（' + r.defSeg + '）');
});
if (rows.length > TOP) console.log('  … 另有 ' + (rows.length - TOP) + ' 个');

var must = rows.filter(function (r) { return r.users.length >= 1; });
console.log('\n→ 共 ' + must.length + ' 个符号需要迁移。迁到 prelude 后，分片应当全绿。');

/* 按"定义所在段"聚合，看看集中在哪几段（一次搬一段最省事） */
var bySeg = {};
must.forEach(function (r) { (bySeg[r.defSeg] = bySeg[r.defSeg] || []).push(r.name); });
console.log('\n按"定义所在段"聚合（搬的时候整段搬最省事）：');
Object.keys(bySeg).sort(function (a, b) { return bySeg[b].length - bySeg[a].length; }).slice(0, 8)
  .forEach(function (s) {
    console.log('  ' + s.padEnd(8) + ' ' + bySeg[s].length + ' 个: ' + bySeg[s].slice(0, 6).join(', ')
      + (bySeg[s].length > 6 ? ' …' : ''));
  });
