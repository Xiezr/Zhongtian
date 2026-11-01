/* v156.26：给 smoke_slice.js 的非连续拼装加「逐段试编」——保证生成的切片一定能跑。
 * 用法：node .workbuddy/tools/patch/patch_slice_greedy.js
 */
'use strict';
var fs = require('fs');
var p = '.workbuddy/tools/prof/smoke_slice.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('逐段试编') >= 0) { console.log('SKIP'); process.exit(0); }

var old = `if (contiguous) {
  out = out.concat(lines.slice(secs[idxList[0]].start, secEnd(idxList[idxList.length - 1])));
} else {
  idxList.forEach(function (i) {
    out.push("  /* ---- §" + secs[i].no + "（按影响面选入）---- */");
    out = out.concat(lines.slice(secs[i].start, secEnd(i)));
  });
}`;

if (s.indexOf(old) < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

var neu = [
  'if (contiguous) {',
  '  out = out.concat(lines.slice(secs[idxList[0]].start, secEnd(idxList[idxList.length - 1])));',
  '} else {',
  '  /* ============================================================',
  '   * 非连续拼装必须**逐段试编**：',
  '   *   smoke 的"段"并不总是自包含 —— 有的段跨了 IIFE 边界（段头只是标题，',
  '   *   真正的块可能连着下一段）。直接拼 90 段 = 括号不配 → SyntaxError，',
  '   *   而报错只说 "Unexpected end of input"，根本定位不到是哪一段。',
  '   * 做法：按文件位置升序逐段加入，每加一段就在内存里试编译一次',
  '   *   （new Function，不落盘）；编不过就**退回这一段**并记下来。',
  '   *   宁可少跑几段（并明确告诉你跳了哪些），也不要给你一个跑不起来的切片。',
  '   * ============================================================ */',
  '  var tail = [];',
  '  tail.push("  console.log(\'结果（切片）：\' + PASS + \' 通过 / \' + FAIL + \' 失败\');");',
  '  tail.push(\'  process.exit(FAIL ? 1 : 0);\');',
  '  tail.push(\'})();\');',
  '  var acc = out.slice();',
  '  var kept = [], skipped = [];',
  '  function okOf(code) { try { new Function(code); return true; } catch (e) { return false; } }',
  '  idxList.forEach(function (i) {',
  '    var chunk = ["  /* ---- §" + secs[i].no + "（按影响面选入）---- */"]',
  '      .concat(lines.slice(secs[i].start, secEnd(i)));',
  '    var trial = acc.concat(chunk);',
  '    if (okOf(trial.concat(tail).join("\\n"))) { acc = trial; kept.push(secs[i].no); }',
  '    else { skipped.push(secs[i].no); }',
  '  });',
  '  out = acc;',
  '  if (skipped.length) {',
  '    console.log(\'  ⚠️ 跳过 \' + skipped.length + \' 段（单段拼入后括号不配 —— 多半跨了 IIFE 边界）：\'',
  '      + skipped.slice(0, 10).join(\',\') + (skipped.length > 10 ? \' …\' : \'\'));',
  '  }',
  '  console.log(\'  实际纳入 \' + kept.length + \' 段\');',
  '}'
].join('\n');

s = s.replace(old, neu);
fs.writeFileSync(p, s, 'utf8');
console.log('patched: 非连续拼装加逐段试编');
