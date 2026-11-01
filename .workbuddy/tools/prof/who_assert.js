'use strict';
/* ============================================================
 * who_assert.js —— **改一个 UI 元素 / 出口前，先问"会牵动哪些断言"**
 * ------------------------------------------------------------
 * 老板 2026-11-02：「为什么界面上部分元素的增删会牵扯这么多」
 *
 * 病根不是"断言太密"，是**改之前不知道会牵动谁** —— 只能改完跑 8 分钟全量，
 * 让红的自己报出来（这轮就漏了一处 `#map-info`，跑完 8 分钟才在 e2e 里炸）。
 *
 * 这个工具把"牵动面"提前摆出来：扫 smoke / e2e 的每个 check 块，
 * 找包含某个关键词的块，打印 文件:行号 + 断言标题。
 *
 * 用法：
 *   node .workbuddy/tools/prof/who_assert.js "#map-info"
 *   node .workbuddy/tools/prof/who_assert.js mapPickText ui.mapPick
 *   node .workbuddy/tools/prof/who_assert.js --all "#modal-root"     # 连片段一起打印
 * ============================================================ */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..', '..');
var FILES = ['smoke-test.js', 'e2e-test.js'];
var args = process.argv.slice(2).filter(function (a) { return a !== '--all'; });
var SHOW = process.argv.indexOf('--all') >= 0;
if (!args.length) {
  console.log('用法: node who_assert.js <关键词...> [--all]');
  process.exit(1);
}

/* 切块：以 `check(` 起头，到下一条同级 `check(` 或同级收尾行为止 */
function blocksOf(file) {
  var lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  var out = [];
  for (var n = 0; n < lines.length; n++) {
    if (!/^\s*check\(/.test(lines[n])) continue;
    var indent = lines[n].match(/^\s*/)[0].length;
    var buf = [lines[n]], end = n;
    for (var j = n + 1; j < Math.min(lines.length, n + 90); j++) {
      var m = lines[j].match(/^\s*/)[0].length;
      if (m === indent && (/^\s*\}\)+\)?;?\s*$/.test(lines[j]) || /^\s*check\(/.test(lines[j]))) { end = j - 1; break; }
      buf.push(lines[j]); end = j;
    }
    out.push({ line: n + 1, text: buf.join('\n') });
    n = end;
  }
  return out;
}

function titleOf(text) {
  var m = /check\(\s*'([^']{2,80})'/.exec(text) || /check\(\s*"([^"]{2,80})"/.exec(text);
  return m ? m[1] : text.split('\n')[0].trim().slice(0, 60);
}

var total = 0;
args.forEach(function (kw) {
  console.log('\n════ 关键词 ' + kw + ' ════');
  var hit = 0;
  FILES.forEach(function (f) {
    blocksOf(f).forEach(function (b) {
      if (b.text.indexOf(kw) < 0) return;
      hit++;
      console.log('  ' + f + ':' + b.line + '  ' + titleOf(b.text));
      if (SHOW) {
        b.text.split('\n').slice(0, 6).forEach(function (l) { console.log('      | ' + l.trim().slice(0, 110)); });
      }
    });
  });
  console.log('  → 共 ' + hit + ' 条断言牵动');
  total += hit;
});
console.log('\n合计 ' + total + ' 条。改之前先看这张单子，比跑完全量等红要快 8 分钟。');
