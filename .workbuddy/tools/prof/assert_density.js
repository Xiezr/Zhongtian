'use strict';
/* v156.38：**断言密度扫描** —— 一个 UI 元素 / 出口被多少条 check 钉着？
   ------------------------------------------------------------
   老板 2026-11-02：「为什么界面上部分元素的增删会牵扯这么多」
   实测那一轮：两个 span 被 11 条断言从 7 个角度钉着，删起来要逐条翻口径。
   这个工具把"谁被钉得最多"排出来，作为合并（去冗余）的依据。

   用法：node .workbuddy/tools/prof/assert_density.js [--top 30] [--file smoke-test.js]
   ------------------------------------------------ */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..', '..');
var FILE = 'smoke-test.js';
var TOP = 30;
var args = process.argv.slice(2);
for (var i = 0; i < args.length; i++) {
  if (args[i] === '--top') TOP = Number(args[i + 1]) || 30;
  if (args[i] === '--file') FILE = args[i + 1];
}

var src = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
var lines = src.split('\n');

/* ① 切块：每一行以 `check(` 起头的，到一个**同级缩进**的 `});` / `})());` 收尾。
   近似但够用（本仓断言都是"平铺 + IIFE"两种写法）。 */
var blocks = [];
for (var n = 0; n < lines.length; n++) {
  if (!/^\s*check\(/.test(lines[n])) continue;
  var indent = lines[n].match(/^\s*/)[0].length;
  var buf = [lines[n]];
  for (var j = n + 1; j < Math.min(lines.length, n + 80); j++) {
    buf.push(lines[j]);
    var m = lines[j].match(/^\s*/)[0].length;
    if (m === indent && /^\s*\}\)+\)?;?\s*$/.test(lines[j])) { n = j; break; }
    if (m === indent && /^\s*check\(/.test(lines[j])) { n = j - 1; break; }
  }
  blocks.push(buf.join('\n'));
}

/* ② 从每块里抽"被测对象"：DOM id/class、GAME./ui./SP./M. 成员、显式函数名 */
function symbolsOf(txt) {
  var out = {};
  var re, m;
  re = /'#([A-Za-z][\w-]*)'/g;
  while ((m = re.exec(txt))) out['#' + m[1]] = 1;
  re = /"(#([A-Za-z][\w-]*))"/g;
  while ((m = re.exec(txt))) out['#' + m[1]] = 1;
  re = /\b(?:GAME|G|ui|UI|SP|M|DATA|F)\.([A-Za-z_$][\w$]*)/g;
  while ((m = re.exec(txt))) {
    if (m[1].length > 2 && !/^(state|now|form|html|text|log|type|name|map|cells|data|value|id|x|y|ci)$/.test(m[1])) {
      out[(/^(ui|UI)$/.test(RegExp.$2 || '') ? 'ui.' : 'GAME.') + m[1]] = 1;
    }
  }
  re = /class="([a-z][\w-]*)"/g;
  while ((m = re.exec(txt))) out['.' + m[1]] = 1;
  return Object.keys(out);
}

var count = {};
blocks.forEach(function (b) {
  symbolsOf(b).forEach(function (s) { count[s] = (count[s] || 0) + 1; });
});

/* ⚠️ 只保留**界面层**被测对象（#id / .class / ui.*）：GAME.newGame / currentCity / systems 这类
   是测试脚手架 —— 358 条断言都调 newGame 不等于'钉了 newGame 358 次'，把它们算进来只会
   得出'能砍 3000 条'的荒谬结论（第一版就这么算过）。 */
 var rows = Object.keys(count).filter(function (k) {
   return k.charAt(0) === '#' || k.charAt(0) === '.' || k.indexOf('ui.') === 0;
 }).map(function (k) { return { sym: k, n: count[k] }; })
  .sort(function (a, b) { return b.n - a.n; });

console.log('[' + FILE + '] 断言块 ' + blocks.length + ' 个 · 不同被测对象 ' + rows.length + ' 个');
console.log('\n=== 被钉得最多的 ' + TOP + ' 个（"牵扯多"的根源） ===');
console.log('  次数  对象');
rows.slice(0, TOP).forEach(function (r) {
  console.log('  ' + String(r.n).padStart(4) + '  ' + r.sym);
});

/* ③ 分布：超过 N 次的分别有多少个 */
var buckets = { '≥14': 0, '10-13': 0, '6-9': 0, '3-5': 0, '1-2': 0 };
rows.forEach(function (r) {
  if (r.n >= 14) buckets['≥14']++;
  else if (r.n >= 10) buckets['10-13']++;
  else if (r.n >= 6) buckets['6-9']++;
  else if (r.n >= 3) buckets['3-5']++;
  else buckets['1-2']++;
});
console.log('\n=== 密度分布 ===');
Object.keys(buckets).forEach(function (k) { console.log('  ' + k.padEnd(7) + ' ' + buckets[k] + ' 个对象'); });

/* ④ 粗估"如果 ≥6 次的收敛到 3 次"能省多少条 */
var heavy = rows.filter(function (r) { return r.n >= 6; });
var save = heavy.reduce(function (a, r) { return a + (r.n - 3); }, 0);
console.log('\n被钉 ≥6 次的对象 ' + heavy.length + ' 个；若每个收敛到 3 条，可减少约 ' + save + ' 条断言'
  + '（占 ' + (save / blocks.length * 100).toFixed(1) + '%）');
