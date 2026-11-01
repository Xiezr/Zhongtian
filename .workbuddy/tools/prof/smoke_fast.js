'use strict';
/* ============================================================
 * smoke_fast.js —— 内环验证入口：4 分片并行跑 smoke（458s → ~214s）
 * ------------------------------------------------------------
 * 老板 2026-11-02：「全做」—— P0-2 是"分片接进验证链"。
 *
 * 为什么不做成"改 gate.py 用分片"：
 *   门禁是**提交闸门**，跑一次、要求严格；把它换成"4 个进程 + 汇总解析"
 *   会让失败排查变复杂（哪一份红的？要不要复跑整组？）。
 *   真正每轮都在烧的是**我自己的验证**，所以这里只做"内环快跑"：
 *     内环：smoke_fast（~3.5 分钟）→ 提交：gate 串行全量（~8 分钟，严格）
 *
 * 行为：
 *   · 先让 smoke_parallel 生成 4 份（它自带"试编译 + 贪心回退"）
 *   · 并行跑，汇总 PASS/FAIL/WARN
 *   · **任一份崩溃 → 自动回退串行全量**（分片不背锅，宁可慢也要对）
 *   · 输出与 smoke 同格式的汇总行，便于人/工具统一读
 * ============================================================ */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..', '..', '..');
var PARTS = 4;
var args = process.argv.slice(2);
for (var i = 0; i < args.length; i++) if (args[i] === '--parts') PARTS = Math.max(2, parseInt(args[i + 1], 10) || 4);

function run(cmd, argv, opts) {
  return cp.spawnSync(cmd, argv, Object.assign({ cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts || {}));
}

/* ① 生成分片（不跑） */
var t0 = Date.now();
var gen = run(process.execPath, [path.join('.workbuddy/tools/prof/smoke_parallel.js'), '--parts', String(PARTS)]);
if (gen.status !== 0) {
  console.log('⚠️ 分片生成失败，回退串行全量');
  process.exit(run(process.execPath, ['smoke-test.js'], { stdio: 'inherit' }).status || 0);
}
var files = [];
for (var k = 1; k <= PARTS; k++) {
  var f = path.join(ROOT, '.tmp_par' + k + '.js');
  if (fs.existsSync(f)) files.push(f);
}
if (files.length < 2) {
  console.log('⚠️ 分片文件不足（' + files.length + '），回退串行全量');
  process.exit(run(process.execPath, ['smoke-test.js'], { stdio: 'inherit' }).status || 0);
}
console.log('分片生成完成（' + files.length + ' 份，' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒），开始并行…');

/* ② 并行跑 */
var t1 = Date.now();
var procs = files.map(function (f) {
  return cp.spawn(process.execPath, [f], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
});
var bufs = files.map(function () { return ''; });
var dones = 0;
procs.forEach(function (p, idx) {
  p.stdout.on('data', function (d) { bufs[idx] += d.toString('utf8'); });
  p.stderr.on('data', function (d) { bufs[idx] += d.toString('utf8'); });
  p.on('close', function (code) {
    dones++;
    if (dones < procs.length) return;
    finish();
  });
});

var crashed = [];
function finish() {
  var pass = 0, fail = 0, warn = 0, skip = 0;
  bufs.forEach(function (b, idx) {
    var m = /结果（分片）：(\d+) 通过 \/ (\d+) 失败/.exec(b);
    if (!m) { crashed.push(idx + 1); return; }
    pass += +m[1]; fail += +m[2];
    var sk = /跳过（未执行判据）/.exec(b); if (sk) skip += (b.match(/⊘/g) || []).length;
    warn += (b.match(/⚠️/g) || []).length;
  });
  var wall = ((Date.now() - t1) / 1000).toFixed(0);

  if (crashed.length) {
    console.log('⚠️ 分片 ' + crashed.join(',') + ' 崩溃（没打印汇总行）→ 回退串行全量');
    if (files[0]) {
      var idx0 = crashed[0] - 1;
      console.log('---- 分片 ' + crashed[0] + ' 尾部 ----');
      console.log((bufs[idx0] || '').split('\n').slice(-14).join('\n'));
    }
    var r = run(process.execPath, ['smoke-test.js'], { stdio: 'inherit' });
    process.exit(r.status || 0);
  }

  /* 细项：把各份的 ❌ 汇总打印（不然只看总数不知道该修哪条） */
  var fails = [];
  bufs.forEach(function (b, idx) {
    b.split('\n').forEach(function (L) { if (L.indexOf('❌') >= 0) fails.push('  ' + L.trim()); });
  });
  if (fails.length) {
    console.log('\n失败明细（' + fails.length + ' 条）：');
    fails.slice(0, 40).forEach(function (L) { console.log(L); });
    if (fails.length > 40) console.log('  … 另有 ' + (fails.length - 40) + ' 条');
  }

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败'
    + (warn ? (' / ' + warn + ' 待修（实现类·不阻断）') : '')
    + (skip ? (' / ' + skip + ' 跳过（未执行判据）') : '')
    + '　── 4 分片并行，墙钟 ' + wall + ' 秒（串行约 458 秒）');
  /* ============================================================
   * v156.39：**把条数写进 census**，让 tier_audit 的 Q3 有据可查。
   * ------------------------------------------------------------
   * 之前这里写着「分片比串行少 ~116 条属正常」—— 这句话本身就是假绿的许可证。
   * 查下去发现：公共头的断言被换成空壳，**没有任何一份真的跑**（已修）。
   * 现在：分片总数写进 census，Q3 按「不得比串行少 2% 以上」判定。
   * ⚠️ 分片总数**可能略多于**串行：每份自带 newGame，个别条件分支走向不同。
   *   所以判据是「下限」不是「相等」—— 相等在这里恰恰是平凡解。
   * ============================================================ */
  try {
    var cenF = path.join(ROOT, '.workbuddy', 'smoke-census.json');
    var cen = {};
    try { cen = JSON.parse(fs.readFileSync(cenF, 'utf8')); } catch (e2) { cen = {}; }
    cen.lastSplit = { total: pass + fail + warn + skip, pass: pass, fail: fail, warn: warn, skip: skip,
      parts: files.length, wallSec: +wall, at: new Date().toISOString().slice(0, 19) };
    fs.writeFileSync(cenF, JSON.stringify(cen, null, 1));
  } catch (e) { console.log('⚠️ census 写入失败：' + e.message); }
  try {
    fs.writeFileSync(path.join(ROOT, '.workbuddy', 'smoke-last-fast.log'),
      bufs.map(function (b, i) { return '===== 分片 ' + (i + 1) + ' =====\n' + b; }).join('\n'));
  } catch (e) { }
  /* 分片里公共头的 check 不重复计数，比串行少 ~116 条属正常 */
  process.exit(fail ? 1 : 0);
}
