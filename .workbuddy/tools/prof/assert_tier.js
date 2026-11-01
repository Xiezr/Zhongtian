'use strict';
/* ============================================================
 * assert_tier.js —— 给现有断言**分档**：它锁的是"玩法"还是"实现"？
 * ------------------------------------------------------------
 * 老板 2026-11-02：「如果每一个相关关系都用断言锁住，这个项目岂不是一潭死水，动弹不得？」
 *
 * 这是真问题。行业惯例把断言分成两类：
 *   · **行为/契约断言**（behavior / contract）—— 玩家看得见的结果、模块间的语义约定。
 *     实现怎么改都不该红，红了就是真坏了。
 *   · **实现断言**（implementation）—— DOM 结构、CSS 类名、内部函数名、源码正则。
 *     它们保护的是"刚刚那一版长什么样"，实现一变必然红，**该允许随时删**。
 *
 * 本项目 4418 条里，实现类占多少？这个比例就是"动弹不得"的程度。
 * 判定按"最强的实现证据"优先：一条断言只要在查 DOM 结构/类名/源码，就算实现类。
 *
 * 用法：node .workbuddy/tools/prof/assert_tier.js [--show 12]
 * ============================================================ */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..', '..');
var SHOW = 12;
var args = process.argv.slice(2);
for (var i = 0; i < args.length; i++) if (args[i] === '--show') SHOW = Number(args[i + 1]) || 12;

/* ---- 实现类证据（命中任意一条即算实现断言） ---- */
var IMPL = [
  { re: /class="[a-z][\w-]*"/, why: 'HTML 类名字面量' },
  { re: /'#[a-z][\w-]*'|"#[a-z][\w-]*"/, why: 'DOM id 字面量' },
  { re: /\.[a-z][\w-]*\s*\{/, why: 'CSS 选择器/规则' },
  { re: /innerHTML/, why: 'innerHTML 结构比对' },
  { re: /\.toString\(\)/, why: '函数源码比对' },
  { re: /data-action=|data-view=/, why: 'DOM 属性字面量' },
  { re: /indexOf\('<\/?[a-z]/, why: 'HTML 片段搜索' },
  { re: /__uiAll\(\)|readFileSync|stripComment\(/, why: '读源码正则' },
  { re: /\.className|classList/, why: 'class 断言' },
  { re: /new RegExp|\.test\(u|\.test\(h|\.test\(m/, why: '源码正则匹配' }
];
/* ---- 契约类证据（接口存在性/类型） ---- */
var CONTRACT = [
  { re: /typeof\s+\w+\s*===?\s*'function'/, why: '接口存在' },
  { re: /typeof\s+\w+\s*===\s*'undefined'/, why: '出口已删' },
  { re: /\.length\s*===?\s*\d/, why: '集合规模约定' }
];

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
  var m = /check\(\s*'([^']{2,90})'/.exec(text) || /check\(\s*"([^"]{2,90})"/.exec(text);
  return m ? m[1] : text.split('\n')[0].trim().slice(0, 60);
}

/* 去掉标题行再判（标题里常出现"类名/结构"这类词，会污染判定） */
function bodyOf(text) {
  return text.split('\n').slice(1).join('\n');
}

var stats = { impl: [], contract: [], behavior: [] };
['smoke-test.js', 'e2e-test.js'].forEach(function (f) {
  blocksOf(f).forEach(function (b) {
    var body = bodyOf(b.text);
    var implHit = null;
    for (var i = 0; i < IMPL.length; i++) if (IMPL[i].re.test(body)) { implHit = IMPL[i].why; break; }
    var item = { file: f, line: b.line, title: titleOf(b.text), why: implHit };
    if (implHit) stats.impl.push(item);
    else if (CONTRACT.some(function (c) { return c.re.test(body); })) stats.contract.push(item);
    else stats.behavior.push(item);
  });
});

var total = stats.impl.length + stats.contract.length + stats.behavior.length;
function pct(n) { return (n / total * 100).toFixed(1) + '%'; }

console.log('断言总数 ' + total + '（smoke + e2e）\n');
console.log('  实现断言（锁 DOM/类名/源码）  ' + String(stats.impl.length).padStart(4) + '  ' + pct(stats.impl.length));
console.log('  契约断言（接口存在/规模约定）  ' + String(stats.contract.length).padStart(4) + '  ' + pct(stats.contract.length));
console.log('  行为断言（状态/数值/胜负）      ' + String(stats.behavior.length).padStart(4) + '  ' + pct(stats.behavior.length));

/* 实现断言按"为什么"聚合 */
var byWhy = {};
stats.impl.forEach(function (x) { byWhy[x.why] = (byWhy[x.why] || 0) + 1; });
console.log('\n=== 实现断言的成因分布（"动弹不得"的具体来源） ===');
Object.keys(byWhy).sort(function (a, b) { return byWhy[b] - byWhy[a]; }).forEach(function (w) {
  console.log('  ' + String(byWhy[w]).padStart(4) + '  ' + w);
});

console.log('\n=== 实现断言样例（前 ' + SHOW + ' 条） ===');
stats.impl.slice(0, SHOW).forEach(function (x) {
  console.log('  ' + x.file + ':' + x.line + '  [' + x.why + ']  ' + x.title.slice(0, 46));
});

console.log('\n判读：实现断言占比越高，改界面越寸步难行 ——');
console.log('  它们该被允许"随时删或随时改"，而不是当契约供着。');
