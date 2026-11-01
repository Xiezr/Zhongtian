/* v156.26c：给 smoke_slice 加两件事，让它"崩了也说清楚崩在哪"：
 *   ① 每段之前往 stderr 打 `§N` 标记（stdout 保持干净，不污染 smoke 输出格式）
 *   ② `--run`：生成后立刻跑，崩了就报出"最后进入的那一段"
 * 用法：node .workbuddy/tools/patch/patch_slice_run.js
 */
'use strict';
var fs = require('fs');
var p = '.workbuddy/tools/prof/smoke_slice.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('--run') >= 0 && s.indexOf('SECMARK') >= 0) { console.log('SKIP'); process.exit(0); }

/* ① 段边界打 stderr 标记 */
var oldChunk = [
  '    var chunk = ["  /* ---- §" + secs[i].no + "（按影响面选入）---- */"]',
  '      .concat(lines.slice(secs[i].start, secEnd(i)));'
].join('\n');
var newChunk = [
  '    /* SECMARK：往 stderr 打段号 —— 崩了能立刻知道是"进入哪一段之后崩的"。',
  '       走 stderr 是为了不污染 smoke 的 stdout 汇总格式（门禁按「结果：」行解析）。 */',
  '    var chunk = ["  /* ---- §" + secs[i].no + "（按影响面选入）---- */",',
  '      "  try { process.stderr.write(\'[SEC] §" + secs[i].no + "\\\\n\'); } catch (e) { }"]',
  '      .concat(lines.slice(secs[i].start, secEnd(i)));'
].join('\n');
if (s.indexOf(oldChunk) < 0) { console.error('ANCHOR chunk NOT FOUND'); process.exit(1); }
s = s.replace(oldChunk, newChunk);

/* ② --run：生成后直接跑，并解析崩溃段 */
var oldEnd = "console.log('跑法：node .tmp_smoke_slice.js');";
var newEnd = [
  'if (has(\'run\')) {',
  '  var cp = require(\'child_process\');',
  '  console.log(\'\\n━━ 直接运行 ━━\');',
  '  var t0 = Date.now();',
  '  var r = cp.spawnSync(process.execPath, [file], { encoding: \'utf8\', maxBuffer: 1 << 28 });',
  '  var secs2 = Date.now() - t0;',
  '  var outTxt = (r.stdout || \'\') + (r.stderr || \'\');',
  '  /* 取 stderr 里最后一个 [SEC] 标记 = 崩溃前最后进入的段 */',
  '  var marks = (r.stderr || \'\').match(/\\[SEC\\] §(\\d+)/g) || [];',
  '  var lastSec = marks.length ? marks[marks.length - 1].replace(/[^0-9]/g, \'\') : \'?\';',
  '  var passN = (outTxt.match(/✅/g) || []).length;',
  '  var failN = (outTxt.match(/❌/g) || []).length;',
  '  var crashed = /Error|error/.test((r.stderr || \'\').split(\'\\n\').slice(-40).join(\'\\n\')) && !/结果（切片）/.test(outTxt);',
  '  console.log(\'  耗时 \' + (secs2 / 1000).toFixed(1) + \' 秒 · 通过 \' + passN + \' · 失败 \' + failN',
  '    + (crashed ? \' · ⚠️ 中途崩溃\' : \'\'));',
  '  if (crashed) {',
  '    var errLine = (r.stderr || \'\').split(\'\\n\').filter(function (L) { return /Error|not defined|not a function/.test(L); }).slice(-1)[0];',
  '    console.log(\'  崩溃点：§\' + lastSec + (errLine ? (\'  \' + errLine.trim()) : \'\'));',
  '    console.log(\'  → 这一段的依赖在被跳过的段里。要么把它加进 --include，要么跑全量。\');',
  '    process.exit(r.status || 1);',
  '  }',
  '  process.exit(r.status || 0);',
  '}',
  "console.log('跑法：node .tmp_smoke_slice.js');",
  "console.log('      或加 --run 直接跑（崩了会报出崩在哪一段）');"
].join('\n');
if (s.indexOf(oldEnd) < 0) { console.error('ANCHOR end NOT FOUND'); process.exit(1); }
s = s.replace(oldEnd, newEnd);

/* ③ 支持 --include（手动补段） */
var oldInc = "var ALWAYS_LAST = parseInt(opt('always-last', '3'), 10) || 0;";
var newInc = [
  "var ALWAYS_LAST = parseInt(opt('always-last', '3'), 10) || 0;",
  "/* --include 40,51：手动补段（崩在哪段就补哪段） */",
  "var INCLUDE = (opt('include', '') || '').split(',').filter(function (x) { return x; }).map(function (x) { return parseInt(x, 10); });"
].join('\n');
if (s.indexOf(oldInc) < 0) { console.error('ANCHOR include NOT FOUND'); process.exit(1); }
s = s.replace(oldInc, newInc);

var oldAdd = '  if (idxList.indexOf(0) < 0) idxList.push(0);';
var newAdd = [
  '  if (idxList.indexOf(0) < 0) idxList.push(0);',
  '',
  '  /* --include：按段号手动补（用于"崩在哪段就补哪段"） */',
  '  INCLUDE.forEach(function (no) {',
  '    for (var w = 0; w < secs.length; w++) if (secs[w].no === no && idxList.indexOf(w) < 0) idxList.push(w);',
  '  });'
].join('\n');
if (s.indexOf(oldAdd) < 0) { console.error('ANCHOR add NOT FOUND'); process.exit(1); }
s = s.replace(oldAdd, newAdd);

fs.writeFileSync(p, s, 'utf8');
console.log('patched: --run / SECMARK / --include');
