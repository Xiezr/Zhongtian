/* v156.26b：修 smoke_slice 的收尾判定 ——
 * 含文件收尾的段（§585 那一块，一直延伸到文件末 `})();`）本身是"已闭合"的，
 * 再给它拼 tail 就多一个 `})();` → 编译失败 → 被贪心跳过 → 最终切片缺收尾。
 * 改成"先试不带 tail，不行再带 tail"，并记住最终是否需要 tail。
 * 用法：node .workbuddy/tools/patch/patch_slice_tail.js
 */
'use strict';
var fs = require('fs');
var p = '.workbuddy/tools/prof/smoke_slice.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('closedBySelf') >= 0) { console.log('SKIP'); process.exit(0); }

var oldLoop = [
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
  '  out = acc;'
].join('\n');

var newLoop = [
  '  var acc = out.slice();',
  '  var kept = [], skipped = [];',
  '  var closedBySelf = false;      /* 最后纳入的那一段是否自带文件收尾 */',
  '  function okOf(code) { try { new Function(code); return true; } catch (e) { return false; } }',
  '  idxList.forEach(function (i) {',
  '    var chunk = ["  /* ---- §" + secs[i].no + "（按影响面选入）---- */"]',
  '      .concat(lines.slice(secs[i].start, secEnd(i)));',
  '    var trial = acc.concat(chunk);',
  '    /* ① 先试"不带 tail"：能独立编译 = 这段自带完整块（甚至自带文件收尾） */',
  '    if (okOf(trial.join("\\n"))) {',
  '      acc = trial; kept.push(secs[i].no); closedBySelf = true;',
  '      return;',
  '    }',
  '    /* ② 再试"补 tail"：段本身开源未闭，靠外层 IIFE 收口 */',
  '    if (okOf(trial.concat(tail).join("\\n"))) {',
  '      acc = trial; kept.push(secs[i].no); closedBySelf = false;',
  '      return;',
  '    }',
  '    skipped.push(secs[i].no);',
  '  });',
  '  out = acc;',
  '  var _closed = closedBySelf;'
].join('\n');

if (s.indexOf(oldLoop) < 0) { console.error('ANCHOR loop NOT FOUND'); process.exit(1); }
s = s.replace(oldLoop, newLoop);

/* 收尾判定改成看 _closed（不再用段号推） */
var oldTail = [
  'var atTail = idxList[idxList.length - 1] === secs.length - 1;',
  'if (!atTail) {'
].join('\n');
var newTail = [
  '/* 收尾：看**实际纳入的最后一段**是否自带闭合，而不是用候选段的段号去猜 */',
  'var atTail = (typeof _closed !== "undefined") ? _closed',
  '  : (idxList[idxList.length - 1] === secs.length - 1);',
  'if (!atTail) {'
].join('\n');
if (s.indexOf(oldTail) < 0) { console.error('ANCHOR tail NOT FOUND'); process.exit(1); }
s = s.replace(oldTail, newTail);

/* _closed 在连续分支里没定义 → 用 typeof 兜住（上面已处理），但 var 提升会把它变成 undefined，
   所以连续分支也要赋个值，避免 undefined 覆盖原判据。改为只在非连续里设全局。 */
s = s.replace('  var _closed = closedBySelf;', '  _closed = closedBySelf;   /* 供收尾判断用 */');
s = s.replace('var preludeEnd = secs[0].start;', 'var preludeEnd = secs[0].start;\nvar _closed;              /* 非连续模式下由贪心拼装设置 */');

fs.writeFileSync(p, s, 'utf8');
console.log('patched: 收尾判定按"是否自带闭合"');
