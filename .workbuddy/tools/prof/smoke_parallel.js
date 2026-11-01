'use strict';
/* ============================================================
 * smoke_parallel.js —— 把 smoke 切成 N 份并行跑（实验）
 * ------------------------------------------------------------
 * 老板 2026-11-02：「测试是否有根本性的改善」
 *
 * 背景（实测，不是推测）：
 *   smoke 全量 458 秒，其中 87% 是 newGame；v156.21 给 hexDist 加了距离缓存后
 *   同 seed 重建只要 **15ms** —— 也就是说「段必须共享同一个世界」这个前提
 *   早就已经不成立了，只是没人验过。
 *
 * 这个工具回答一个问题：**把 238 段按区间切给 N 个进程，能不能跑通、结果对不对。**
 * 如果能，458s 就能压到 "单份耗时"（约 1/N），这才是迭代速度的根本改善。
 *
 * ⚠️ 已知风险：段与段之间可能共享顶层声明（`var xxx` 在 A 段定义、B 段使用）。
 *   切开后 B 段会 ReferenceError。故每一份都做**试编译**，编不过就把那一段
 *   退回上一份（贪心），并打印"哪一段没切出去"。
 *
 * 用法：
 *   node .workbuddy/tools/prof/smoke_parallel.js --parts 4          # 只生成
 *   node .workbuddy/tools/prof/smoke_parallel.js --parts 4 --run    # 生成 + 并行跑 + 汇总
 * ============================================================ */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.resolve(__dirname, '..', '..', '..');
var SRC = path.join(ROOT, 'smoke-test.js');
/* ⚠️ 分片必须落在**仓库根**：smoke 里用 （相对 __dirname），
   放进 .workbuddy/tmp/par/ 会 Cannot find module（第一版就这样，4 份全崩 0.2 秒）。 */
var OUTDIR = ROOT;
var SEG_RE = /=====\s*(\d+)\.\s/;

var args = process.argv.slice(2);
var PARTS = 4;
var RUN = args.indexOf('--run') >= 0;
var pi = args.indexOf('--parts');
if (pi >= 0) PARTS = Math.max(2, parseInt(args[pi + 1], 10) || 4);

/* ============================================================
 * --head N：前 N 段作为"公共头"复制到每一份
 * ------------------------------------------------------------
 * 实测（4 份并行，第一版）：只有 part1 跑通，其余三份崩在
 *     ReferenceError: fsMod is not defined
 *     ReferenceError: DC is not defined
 * 因为 `fsMod/pathMod` 定义在**段 0 内**（第 219 行），`DC` 在**段 1 内**（第 539 行），
 * 而 prelude 只到第 217 行 —— 它们不在公共前置里。
 * 但公共头里的 check 不能重复计数，故生成时把它们换成 `__headCheck`（空函数）。
 * ============================================================ */
var HEAD = 2;
var hi = args.indexOf('--head');
if (hi >= 0) HEAD = Math.max(0, parseInt(args[hi + 1], 10) || 0);

var lines = fs.readFileSync(SRC, 'utf8').split('\n');

/* ---- 段边界 ---- */
var segs = [];
for (var i = 0; i < lines.length; i++) {
  var m = SEG_RE.exec(lines[i]);
  if (m) segs.push({ no: +m[1], line: i });
}
if (!segs.length) { console.error('✗ 找不到段标记'); process.exit(1); }

var PRELUDE_END = segs[0].line;                 /* 0..PRELUDE_END-1 是公共前置 */
var prelude = lines.slice(0, PRELUDE_END);

/* 段范围：[seg[i].line, seg[i+1].line)，最后一段到文件末尾 */
function segEnd(k) { return (k + 1 < segs.length) ? segs[k + 1].line : lines.length; }

var TAIL = [
  "  console.log('结果（分片）：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
  "  _emitTitles();",
  '  process.exit(FAIL ? 1 : 0);',
  '})();'
];

function compiles(arr) {
  var body = arr.filter(function (L) { return !/^\s*import\s/.test(L); }).join('\n');
  try { new Function(body); return true; } catch (e) { return false; }
}

/* ---- 公共头：前 HEAD 段（提供 fsMod / pathMod / DC 等跨段工具） ---- */
var headLines = [];
for (var hk = 0; hk < HEAD && hk < segs.length; hk++) {
  headLines = headLines.concat(lines.slice(segs[hk].line, segEnd(hk)));
}
/* 公共头里的断言**不重复计数**：换成空函数（否则 N 份各数一遍，合计虚高） */
var headDefs = headLines.map(function (L) {
  return L.replace(/(^|[^\w$.])check\(/g, '$1__headCheck(');
});
/* check 可能是 const/function 声明，__headCheck 用同名空壳顶上 */
var HEAD_SHIM = [
  '  function __headCheck() { /* 公共头的断言只算一次（在主分片里） */ }',
  /* ============================================================
   * 每份**自带世界**。
   * ------------------------------------------------------------
   * 实测（第二版 4 份并行）：part1 通、其余三份崩在
   *     TypeError: Cannot read properties of undefined (reading 'battles')   // st.battles
   *     TypeError: Cannot read properties of undefined (reading 'ruler')     // s.ruler
   * 根因不是工具变量，是 **GAME.state 为空** —— 全量跑时前面的段替后面建好了世界，
   * 分片后没人建。
   * 这里补一次 newGame：v156.21 给 hexDist 加了距离缓存后，同 seed 重建只要 ~15ms。
   * ⚠️ 但这一步**改变语义**：全量里后面的段看到的是"被前面段改过的世界"，
   *   分片里每份看到的是全新世界。所以分片结果只能当**加速冒烟**，不能当回归裁判。
   * ============================================================ */
  '  try {',
  '    var __w0 = GAME.newGame({ name: "分片", cityName: "灰岗", region: "碎垣", mapSeed: 20260921 });',
  '    if (!__w0.map.grid) GAME.map.generate();',
  '  } catch (e) { }'
];

/* ---- 贪心分块：每块尽量均分，但必须可编译 ---- */
var bodyStart = HEAD;                       /* 从第 HEAD 段开始分配 */
var target = Math.ceil((segs.length - bodyStart) / PARTS);
var blocks = [];
var cur = [];
var curCount = 0;

for (var k = bodyStart; k < segs.length; k++) {
  var chunk = lines.slice(segs[k].line, segEnd(k));
  var trial = cur.concat(chunk);
  var isLast = (k === segs.length - 1);

  /* 加进去能编译，或者还没到目标大小 → 先收下；到目标且可编译 → 封块 */
  var canCompile = compiles(prelude.concat(headDefs).concat(trial).concat(TAIL));
  if (canCompile && (curCount + 1 >= target || isLast)) {
    cur = trial;
    blocks.push({ body: cur });
    cur = []; curCount = 0;
    continue;
  }
  cur = trial; curCount++;

  if (isLast) {
    blocks.push({ body: cur });
  }
}/* 最后一块吃到了文件末尾，里面**已经**有原文自己的收尾
   （`console.log('结果：…')` + `process.exit` + `})();`）。
 *
 * ⚠️ 千万不要"剥掉尾部再拼自己的收尾"：末尾常常是连续的 `})();`
 *   （§591 自己的 IIFE + 最外层 IIFE），按 while 循环剥会把该保留的那个也剥掉
 *   → `SyntaxError: Unexpected end of input`（第一版就这样，part4 编不过）。
 * 正解：**最后一块完全不动结构**，只把汇总行的标签改一下，好让并行聚合认出来。
 */
var outFiles = [];
fs.mkdirSync(OUTDIR, { recursive: true });
blocks.forEach(function (b, idx) {
  var name = '.tmp_par' + (idx + 1) + '.js';
  var isLast = (idx === blocks.length - 1);
  var body;
  if (isLast) {
    body = b.body.map(function (L) {
      return L.replace("console.log('结果：'", "console.log('结果（分片）：'");
    });
  } else {
    body = b.body.concat(TAIL);
  }
  /* 顺序：prelude → 公共头 → 本块
   * ------------------------------------------------------------
   * ⛔ v156.39（体系自审抓出来的**真漏跑**）：
   *   原先每份都用 `headDefs`（断言被换成空壳），注释写着"只算一次（在主分片里）"，
   *   但**没有任何一份真的跑它们** —— 公共头里那 112 条断言在分片模式下从未执行。
   *   这就是"分片合计比串行少 112 条"的真正原因，也是分片体系最隐蔽的假绿：
   *   少了不报错，只少个数字。
   *   现在：**第一份用原样 headLines（真跑）**，第 2 份起仍用空壳（避免重复计数）。 */
  var headForThis = (idx === 0) ? headLines : headDefs;
  var full = prelude.concat(HEAD_SHIM).concat(headForThis).concat(body);
  fs.writeFileSync(path.join(OUTDIR, name), full.join('\n'), 'utf8');
  outFiles.push({ name: name, lines: body.length, file: path.join(OUTDIR, name) });
});

console.log('【分片】' + segs.length + ' 段 → ' + blocks.length + ' 份'
  + '（prelude ' + PRELUDE_END + ' 行 + 公共头 ' + HEAD + ' 段 复用到每份）');
outFiles.forEach(function (f) {
  console.log('  ' + f.name + '  ' + f.lines + ' 行  ' + (fs.statSync(f.file).size / 1024).toFixed(0) + ' KB');
});

if (!RUN) {
  console.log('\n生成完毕。跑：node .workbuddy/tools/prof/smoke_parallel.js --parts ' + PARTS + ' --run');
  process.exit(0);
}

/* ---- 并行跑 ---- */
console.log('\n开始并行执行…');
var t0 = Date.now();
var done = 0, results = [];

outFiles.forEach(function (f) {
  var child = cp.spawn(process.execPath, [f.file], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, {
      NODE_PATH: 'C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules'
    })
  });
  var out = '', err = '';
  child.stdout.on('data', function (d) { out += d; });
  child.stderr.on('data', function (d) { err += d; });
  child.on('close', function (code) {
    var m = /结果（分片）：(\d+) 通过 \/ (\d+) 失败/.exec(out);
    results.push({
      name: f.name, code: code,
      pass: m ? +m[1] : 0, fail: m ? +m[2] : -1,
      crashed: !m, errTail: err.split('\n').filter(Boolean).slice(0, 6).join(' | ')
    });
    done++;
    if (done === outFiles.length) {
      var wall = ((Date.now() - t0) / 1000).toFixed(1);
      results.sort(function (a, b) { return a.name.localeCompare(b.name); });
      console.log('');
      var tp = 0, tf = 0;
      results.forEach(function (r) {
        tp += r.pass; if (r.fail > 0) tf += r.fail;
        console.log('  ' + r.name.padEnd(10) + (r.crashed ? '✗ 崩溃' : '✅') +
          '  ' + r.pass + ' 通过 / ' + (r.fail < 0 ? '?' : r.fail) + ' 失败' +
          (r.crashed ? '   ' + r.errTail : ''));
      });
      console.log('');
      console.log('  合计 ' + tp + ' 通过 / ' + tf + ' 失败　墙钟 ' + wall + ' 秒（' + PARTS + ' 进程并行）');
      console.log('  对照：全量串行 458 秒');
      process.exit(tf > 0 ? 1 : 0);
    }
  });
});
