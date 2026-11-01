/* smoke 快切片 —— 支持两种用法：
 *
 *  A. 按段号（原行为）
 *       node .workbuddy/tools/prof/smoke_slice.js --from 585
 *       node .workbuddy/tools/prof/smoke_slice.js --from 580 --to 588
 *       node .workbuddy/tools/prof/smoke_slice.js --last 3
 *
 *  B. **按改动文件反查相关段（v156.26 影响面路由）**
 *       node .workbuddy/tools/prof/smoke_slice.js --changed js/map.js
 *       node .workbuddy/tools/prof/smoke_slice.js --changed js/fog.js js/battle.js
 *
 *     做法：从改动文件里抽"对外符号"（GAME./DATA./SP./ui./M./F. 的成员名 + function 名），
 *       再在 smoke 的每一段里找这些符号。命中即纳入待跑，最后 N 段（默认 3）总是纳入。
 *     为什么要它：全量 smoke 458 秒，而改一个模块通常只影响几十条断言。
 *       这是"秒级内环"的入口，**不是门禁的替代品** —— 它按文本命中猜影响面，
 *       间接调用会漏，所以提交前仍要跑全量。
 *
 *  产物：仓库根 .tmp_smoke_slice.js（smoke 内部按 __dirname 找 js/）
 *
 * ⚠️ 已知边界：跳过中间段可能丢掉它们定义的顶层变量 → 切片运行时 ReferenceError。
 *   那不代表代码坏了，只代表"这一段依赖被跳过的段" → 老实跑全量。
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..', '..');

var args = process.argv.slice(2);
function opt(name, def) {
  var i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
}
function has(name) { return args.indexOf('--' + name) >= 0; }

var FROM = opt('from', null);
var TO = opt('to', null);
var LAST = opt('last', null);
var ALWAYS_LAST = parseInt(opt('always-last', '3'), 10) || 0;
/* --include 40,51：手动补段（崩在哪段就补哪段） */
var INCLUDE = (opt('include', '') || '').split(',').filter(function (x) { return x; }).map(function (x) { return parseInt(x, 10); });

/* --changed 后面可以有多个文件名（直到下一个 -- 开头的参数） */
var CHANGED = [];
(function () {
  var i = args.indexOf('--changed');
  if (i < 0) return;
  for (var j = i + 1; j < args.length; j++) {
    if (args[j].indexOf('--') === 0) break;
    CHANGED.push(args[j]);
  }
})();

var lines = fs.readFileSync(path.join(ROOT, 'smoke-test.js'), 'utf8').split('\n');

var secs = [];
var reSec = /=====\s*(\d+)\.\s/;
for (var i = 0; i < lines.length; i++) {
  var m = reSec.exec(lines[i]);
  if (m) secs.push({ no: parseInt(m[1], 10), start: i });
}
if (!secs.length) { console.error('找不到段头'); process.exit(1); }

var preludeEnd = secs[0].start;
var _closed;              /* 非连续模式下由贪心拼装设置 */

/* ⚠️ 段头在文件里**不按编号顺序**出现（实测尾部是 575,577,576,578,585）——
   所以下一段的起点不能按数组下标取，必须按**文件位置**取大于当前起点的最小值。
   用下标取过一次：逆序的那一对 slice(start,end) 得到空数组 → 该段内容整段丢失
   → 括号不闭合 → 切片 SyntaxError: Unexpected end of input。 */
var _starts = secs.map(function (x) { return x.start; }).sort(function (a, b) { return a - b; });
function secEnd(i) {
  var s0 = secs[i].start;
  for (var k = 0; k < _starts.length; k++) if (_starts[k] > s0) return _starts[k];
  return lines.length;
}
function secText(i) { return lines.slice(secs[i].start, secEnd(i)).join('\n'); }

/* ---------- B 模式：按改动文件反查段 ---------- */
function pickSectionsByChanged(files) {
  /* 1) 抽符号：命名空间成员 + function 名 */
  var words = {}, total = 0;
  files.forEach(function (f) {
    var p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { console.warn('  跳过不存在的文件：' + f); return; }
    var src = fs.readFileSync(p, 'utf8');
    var reNs = /\b(?:GAME|DATA|SP|ui|U|M|F|G)\.([A-Za-z_$][\w$]{3,})/g, mm;
    while ((mm = reNs.exec(src))) { words[mm[1]] = 1; }
    var reFn = /\bfunction\s+([A-Za-z_$][\w$]{4,})\s*\(/g;
    while ((mm = reFn.exec(src))) { words[mm[1]] = 1; }
    var reCap = /\b([A-Z][A-Z0-9_]{4,})\s*=/g;      /* 常量表，如 DATA.FOO_BAR */
    while ((mm = reCap.exec(src))) { words[mm[1]] = 1; }
  });
  var list = Object.keys(words).filter(function (w) {
    /* 丢掉太通用的：这些名字在任何文件里都有，命中没有区分度 */
    return !/^(prototype|length|constructor|arguments|undefined|function|return|window|document|exports|require|string|number|object|length|forEach|filter|slice|indexOf|push|map|join|split|replace|toString|valueOf|hasOwnProperty)$/.test(w);
  });
  total = list.length;
  if (!total) { console.warn('  没能从改动文件里抽出符号'); return []; }

  /* 2) 每段命中多少符号（先粗算，再把"命中面过宽"的符号剔除） */
  var texts = secs.map(function (_, i) { return secText(i); });
  var hitCount = {};                      /* 符号 → 命中的段数 */
  list.forEach(function (w) {
    var c = 0;
    for (var k = 0; k < texts.length; k++) if (texts[k].indexOf(w) >= 0) c++;
    hitCount[w] = c;
  });
  var wide = Math.max(8, Math.floor(texts.length * 0.2));
  var kept = list.filter(function (w) { return hitCount[w] > 0 && hitCount[w] <= wide; });
  var dropped = list.filter(function (w) { return hitCount[w] > wide; });
  if (dropped.length) {
    console.log('  （剔除 ' + dropped.length + ' 个过于通用的符号，命中超过 ' + wide + ' 段：'
      + dropped.slice(0, 5).join(', ') + (dropped.length > 5 ? ' …' : '') + '）');
  }

  /* 3) 命中段（按命中符号数降序，最后按段号升序输出） */
  var scored = [];
  for (var s = 0; s < texts.length; s++) {
    var sc = 0, names = [];
    for (var q = 0; q < kept.length; q++) {
      if (texts[s].indexOf(kept[q]) >= 0) { sc++; if (names.length < 4) names.push(kept[q]); }
    }
    if (sc > 0) scored.push({ i: s, no: secs[s].no, sc: sc, names: names });
  }
  scored.sort(function (a, b) { return b.sc - a.sc; });
  console.log('  符号 ' + kept.length + ' 个（有区分度） · 命中 ' + scored.length + '/' + secs.length + ' 段');
  scored.slice(0, 8).forEach(function (r) {
    console.log('    §' + r.no + '  ' + r.sc + ' 命中  (' + r.names.join(',') + ')');
  });
  return scored.map(function (r) { return r.i; });
}

var idxList = [];
if (CHANGED.length) {
  idxList = pickSectionsByChanged(CHANGED);
  if (!idxList.length) {
    console.error('✗ 没有段命中 —— 可能改动只在非断言路径上。建议直接跑全量。');
    process.exit(2);
  }
  if (idxList.length > secs.length * 0.5) {
    console.error('✗ 命中 ' + idxList.length + '/' + secs.length + ' 段（>50%）—— 影响面太大，跑全量更省时间。');
    process.exit(2);
  }
  /* 第 1 段 = 骨架段（stub / require / 公共工具，如 fsMod/pathMod 就在这里），
     任何切片都必须带上 —— 否则选中段一用到 fsMod 就 ReferenceError。
     这是"总是带上第 1 段"。 */
  if (idxList.indexOf(0) < 0) idxList.push(0);

  /* --include：按段号手动补（用于"崩在哪段就补哪段"） */
  INCLUDE.forEach(function (no) {
    for (var w = 0; w < secs.length; w++) if (secs[w].no === no && idxList.indexOf(w) < 0) idxList.push(w);
  });

  /* 最近新增的段总是纳入（新功能往往还没被人"引用"过） */
  for (var z = Math.max(0, secs.length - ALWAYS_LAST); z < secs.length; z++) {
    if (idxList.indexOf(z) < 0) idxList.push(z);
  }
  idxList.sort(function (a, b) { return a - b; });
} else {
  var fromNo, toNo;
  if (LAST != null) {
    fromNo = secs[Math.max(0, secs.length - parseInt(LAST, 10))].no;
    toNo = secs[secs.length - 1].no;
  } else {
    fromNo = parseInt(FROM || secs[0].no, 10);
    toNo = TO != null ? parseInt(TO, 10) : secs[secs.length - 1].no;
  }
  var fromIdx = -1, toIdx = -1;
  for (var j = 0; j < secs.length; j++) {
    if (fromIdx < 0 && secs[j].no === fromNo) fromIdx = j;
    if (secs[j].no === toNo) toIdx = j;
  }
  if (fromIdx < 0 || toIdx < 0) { console.error('段号不存在：' + fromNo + '~' + toNo); process.exit(1); }
  for (var t = fromIdx; t <= toIdx; t++) idxList.push(t);
}

/* ---------- 拼装 ---------- */
var out = lines.slice(0, preludeEnd);
var nos = idxList.map(function (i) { return secs[i].no; });
var label = CHANGED.length
  ? ('按改动反查 ' + CHANGED.join(' ') + ' → ' + nos.length + ' 段')
  : ('第 ' + nos[0] + '~' + nos[nos.length - 1] + ' 段');
out.push("  console.log('===== [切片] " + label + " =====');");
/* 预热：切片跳过了前面段的"建世界"，但很多断言要 cells —— 先建一颗（距离已缓存，很快） */
out.push("  try { var _wst = GAME.newGame({ name: '切片', cityName: '灰岗', region: '碎垣', mapSeed: 20260921 }); if (!_wst.map.grid) GAME.map.generate(); } catch (e) { }");

/* 段号连续时整段保留（原行为）；不连续时逐段复制并标出跳过了哪些 */
var contiguous = true;
for (var c = 1; c < idxList.length; c++) if (idxList[c] !== idxList[c - 1] + 1) { contiguous = false; break; }

if (contiguous) {
  out = out.concat(lines.slice(secs[idxList[0]].start, secEnd(idxList[idxList.length - 1])));
} else {
  /* ============================================================
   * 非连续拼装必须**逐段试编**：
   *   smoke 的"段"并不总是自包含 —— 有的段跨了 IIFE 边界（段头只是标题，
   *   真正的块可能连着下一段）。直接拼 90 段 = 括号不配 → SyntaxError，
   *   而报错只说 "Unexpected end of input"，根本定位不到是哪一段。
   * 做法：按文件位置升序逐段加入，每加一段就在内存里试编译一次
   *   （new Function，不落盘）；编不过就**退回这一段**并记下来。
   *   宁可少跑几段（并明确告诉你跳了哪些），也不要给你一个跑不起来的切片。
   * ============================================================ */
  var tail = [];
  tail.push("  console.log('结果（切片）：' + PASS + ' 通过 / ' + FAIL + ' 失败');");
  tail.push('  process.exit(FAIL ? 1 : 0);');
  tail.push('})();');
  var acc = out.slice();
  var kept = [], skipped = [];
  var closedBySelf = false;      /* 最后纳入的那一段是否自带文件收尾 */
  function okOf(code) { try { new Function(code); return true; } catch (e) { return false; } }
  idxList.forEach(function (i) {
    /* SECMARK：往 stderr 打段号 —— 崩了能立刻知道是"进入哪一段之后崩的"。
       走 stderr 是为了不污染 smoke 的 stdout 汇总格式（门禁按「结果：」行解析）。 */
    var chunk = ["  /* ---- §" + secs[i].no + "（按影响面选入）---- */",
      "  try { process.stderr.write('[SEC] §" + secs[i].no + "\\n'); } catch (e) { }"]
      .concat(lines.slice(secs[i].start, secEnd(i)));
    var trial = acc.concat(chunk);
    /* ① 先试"不带 tail"：能独立编译 = 这段自带完整块（甚至自带文件收尾） */
    if (okOf(trial.join("\n"))) {
      acc = trial; kept.push(secs[i].no); closedBySelf = true;
      return;
    }
    /* ② 再试"补 tail"：段本身开源未闭，靠外层 IIFE 收口 */
    if (okOf(trial.concat(tail).join("\n"))) {
      acc = trial; kept.push(secs[i].no); closedBySelf = false;
      return;
    }
    skipped.push(secs[i].no);
  });
  out = acc;
  _closed = closedBySelf;   /* 供收尾判断用 */
  if (skipped.length) {
    console.log('  ⚠️ 跳过 ' + skipped.length + ' 段（单段拼入后括号不配 —— 多半跨了 IIFE 边界）：'
      + skipped.slice(0, 10).join(',') + (skipped.length > 10 ? ' …' : ''));
  }
  console.log('  实际纳入 ' + kept.length + ' 段');
}

/* 收尾：看**实际纳入的最后一段**是否自带闭合，而不是用候选段的段号去猜 */
var atTail = (typeof _closed !== "undefined") ? _closed
  : (idxList[idxList.length - 1] === secs.length - 1);
if (!atTail) {
  out.push("  console.log('结果（切片）：' + PASS + ' 通过 / ' + FAIL + ' 失败');");
  out.push('  process.exit(FAIL ? 1 : 0);');
  out.push('})();');
}

var file = path.join(ROOT, '.tmp_smoke_slice.js');
fs.writeFileSync(file, out.join('\n'), 'utf8');
console.log('已生成 ' + file + '（' + label + ' · ' + out.length + ' 行）');
if (has('run')) {
  var cp = require('child_process');
  console.log('\n━━ 直接运行 ━━');
  var t0 = Date.now();
  var r = cp.spawnSync(process.execPath, [file], { encoding: 'utf8', maxBuffer: 1 << 28 });
  var secs2 = Date.now() - t0;
  var outTxt = (r.stdout || '') + (r.stderr || '');
  /* 取 stderr 里最后一个 [SEC] 标记 = 崩溃前最后进入的段 */
  var marks = (r.stderr || '').match(/\[SEC\] §(\d+)/g) || [];
  var lastSec = marks.length ? marks[marks.length - 1].replace(/[^0-9]/g, '') : '?';
  var passN = (outTxt.match(/✅/g) || []).length;
  var failN = (outTxt.match(/❌/g) || []).length;
  var crashed = /Error|error/.test((r.stderr || '').split('\n').slice(-40).join('\n')) && !/结果（切片）/.test(outTxt);
  console.log('  耗时 ' + (secs2 / 1000).toFixed(1) + ' 秒 · 通过 ' + passN + ' · 失败 ' + failN
    + (crashed ? ' · ⚠️ 中途崩溃' : ''));
  if (crashed) {
    var errLine = (r.stderr || '').split('\n').filter(function (L) { return /Error|not defined|not a function/.test(L); }).slice(-1)[0];
    console.log('  崩溃点：§' + lastSec + (errLine ? ('  ' + errLine.trim()) : ''));
    console.log('  → 这一段的依赖在被跳过的段里。要么把它加进 --include，要么跑全量。');
    process.exit(r.status || 1);
  }
  process.exit(r.status || 0);
}
console.log('跑法：node .tmp_smoke_slice.js');
console.log('      或加 --run 直接跑（崩了会报出崩在哪一段）');
