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
/* v156.40：变异测试透传（`--mutate <name>` → 各分片 `--mutate=<name>`） */
var MUTATE = null;
var _mi = args.indexOf('--mutate');
if (_mi >= 0 && args[_mi + 1]) MUTATE = args[_mi + 1];

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

/* ② 并行跑
   v156.40：每份用 SMOKE_TITLES 落一份断言标题清单，跑完与串行全量的清单比对 ——
   「条数一样但换了两条」只有比集合才看得出来（Q3 从比条数升级为比标题）。 */
var t1 = Date.now();
var titleFiles = files.map(function (f, i) {
  return path.join(ROOT, '.tmp_titles_' + (i + 1) + '.json');
});
var procs = files.map(function (f, i) {
  var env = Object.assign({}, process.env);
  env.SMOKE_TITLES = titleFiles[i];
  var argv2 = MUTATE ? [f, '--mutate=' + MUTATE] : [f];
  return cp.spawn(process.execPath, argv2, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: env });
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
      parts: files.length, wallSec: +wall, at: new Date().toISOString().slice(0, 19),
      /* v157.28：分片记录也绑版本 —— 与 gate 写的 fullSig 同一把尺（md5 前 12 位）。
         没有它，Q3 会拿"上周的全量"比"这周的分片"，把版本差异报成分片漏段。 */
      sig: (function () {
        try {
          return require('crypto').createHash('md5')
            .update(fs.readFileSync(path.join(ROOT, 'smoke-test.js'))).digest('hex').slice(0, 12);
        } catch (e) { return ''; }
      })() };
    fs.writeFileSync(cenF, JSON.stringify(cen, null, 1));
  } catch (e) { console.log('⚠️ census 写入失败：' + e.message); }
  try {
    fs.writeFileSync(path.join(ROOT, '.workbuddy', 'smoke-last-fast.log'),
      bufs.map(function (b, i) { return '===== 分片 ' + (i + 1) + ' =====\n' + b; }).join('\n'));
  } catch (e) { }

  /* ============================================================
   * v156.40：**标题集合比对**（Q3 从「比条数」升级为「比标题」）。
   * ------------------------------------------------------------
   * 条数相等但换了两条断言，条数比看不出来 —— 而换掉的那两条可能正是关键的。
   * 这里把各分片的标题清单合并，与串行全量的清单逐条比：
   *   · 缺了哪几条 → 直接列出**标题原文**（hash 不可读，所以清单存了 [hash, 标题]）；
   *   · 多了哪几条 → 说明分片走到了串行走不到的分支（各份自带世界的副作用）。
   * 结果写进 census，Q3 读它决定红不红。
   * ============================================================ */
  var titleCmp = null;
  try {
    var fullT = null;
    try {
      fullT = JSON.parse(fs.readFileSync(path.join(ROOT, '.workbuddy', 'smoke-titles-full.json'), 'utf8'));
    } catch (e3) { fullT = null; }
    var splitMap = {};
    titleFiles.forEach(function (tf) {
      try {
        JSON.parse(fs.readFileSync(tf, 'utf8')).forEach(function (x) {
          if (x && x.h != null) splitMap[x.h] = x.t;
        });
      } catch (e4) { }
    });
    if (fullT && fullT.length) {
      var fullMap = {};
      fullT.forEach(function (x) { if (x && x.h != null) fullMap[x.h] = x.t; });
      var missing = [], extra = [];
      Object.keys(fullMap).forEach(function (h) { if (splitMap[h] === undefined) missing.push(fullMap[h]); });
      Object.keys(splitMap).forEach(function (h) { if (fullMap[h] === undefined) extra.push(splitMap[h]); });
      titleCmp = { full: Object.keys(fullMap).length, split: Object.keys(splitMap).length,
        missing: missing.length, missingTitles: missing.slice(0, 12), extra: extra.length };
      console.log('\n标题集合：全量 ' + titleCmp.full + ' / 分片 ' + titleCmp.split
        + '　缺 ' + missing.length + '　多 ' + extra.length);
      if (missing.length) {
        console.log('  ⚠️ 分片漏跑的断言：');
        missing.slice(0, 12).forEach(function (t) { console.log('     · ' + t); });
        if (missing.length > 12) console.log('     … 另有 ' + (missing.length - 12) + ' 条');
      }
    } else {
      console.log('\n标题集合：没有串行基线（.workbuddy/smoke-titles-full.json），跳过比对');
    }
  } catch (e) { console.log('⚠️ 标题比对比对失败：' + e.message); }

  /* 把标题比对结果并进 census（Q3 读它；单独写一次，避免打乱上面那段） */
  if (titleCmp) {
    try {
      var _cf2 = path.join(ROOT, '.workbuddy', 'smoke-census.json');
      var _c2 = JSON.parse(fs.readFileSync(_cf2, 'utf8'));
      _c2.titles = titleCmp;
      fs.writeFileSync(_cf2, JSON.stringify(_c2, null, 1));
    } catch (e5) { }
  }

  /* v156.40：这行原来的注释是「比串行少 ~116 条属正常」——**那句话是假绿的许可证**。
     真正的因果已查明并修掉（公共头的断言被换成空壳，没有任何一份真的跑）。
     现在条数与标题集合都对得上，才敢说"正常"；少一条就要说清是哪一条。 */
  process.exit(fail ? 1 : 0);
}
